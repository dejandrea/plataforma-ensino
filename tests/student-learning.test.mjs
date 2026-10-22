import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLearningTestDb, fixtureUsers, id, learningMigration, readSql } from './fixtures/learning-test-db.mjs';

test('student learning operations, privacy, grading and legacy progression',async t => {
  const { db,query,rpc,count,login,example } = await createLearningTestDb();
  t.after(() => db.close());
  t.beforeEach(() => login());
  const snapshot = () => rpc('student_lesson_learning',[id(15)]);
  const submit = (activity,answer,request) => rpc('submit_student_quiz',[id(activity),JSON.stringify({ 'conteudo-visivel':answer }),id(request)]);

  await t.test('snapshot exposes published content and own meeting without teacher data',async () => {
    const data = await snapshot();
    assert.equal(data.lesson.id,id(15));
    assert.equal(data.has_activity_model,true);
    assert.equal(data.can_complete,false);
    assert.equal(data.completed_at,null);
    assert.equal(data.activities.length,8);
    assert.equal(data.activities.find(a => a.id===id(34)).is_unlocked,false);
    assert.equal(data.meetings.length,1);
    assert.equal(data.meetings[0].scheduled_lesson_id,id(17));
    assert.equal(data.attempts.length,0);
    for (const secret of ['expectedAnswer','optionKey','NOTA PRIVADA','OUTRO ALUNO','meet.google.com/private-test','meet.google.com/legacy-main-test','teacherOnly']) {
      assert.equal(JSON.stringify(data).includes(secret),false,secret);
    }
  });
  await t.test('anonymous, inactive accounts, mentoring-only and staff cannot impersonate learners',async () => {
    await login('none','anon'); await assert.rejects(snapshot(), /permission denied/);
    for (const user of ['inactive','mentoring','teacher','admin']) {
      await login(user);
      await assert.rejects(snapshot(), /ativa|liberada/);
      await assert.rejects(rpc('complete_student_study',[id(30)]), /ativa|liberada/);
      await assert.rejects(submit(32,'body',100), /ativa|liberada/);
    }
    await login();
    await assert.rejects(rpc('student_lesson_learning',[id(16)]), /liberada/);
    await assert.rejects(rpc('start_student_activity',[id(40)]), /liberada/);
  });
  await t.test('raw API cannot write results, bypass required work or invoke internal helpers',async () => {
    await assert.rejects(query("insert into student_activity_progress(student_id,activity_id,activity_revision,status,completed_at) values($1,$2,1,'completed',now())",[fixtureUsers.student,id(32)]), /permission denied/);
    await assert.rejects(query("insert into quiz_attempts(student_id) values($1)",[fixtureUsers.student]), /permission denied/);
    await assert.rejects(query('select private.learning_sync_lesson($1,$2)',[fixtureUsers.student,id(15)]), /permission denied/);
    await assert.rejects(query('insert into student_progress values($1,$2,now())',[fixtureUsers.student,id(15)]), /obrigatorias/);
    await assert.rejects(rpc('complete_student_lesson',[id(15)]), /obrigatorias/);
    for (const unavailable of [35,36]) await assert.rejects(rpc('complete_student_study',[id(unavailable)]), /indisponivel/);
    await assert.rejects(rpc('start_student_activity',[id(34)]), /pre-requisitos/);
  });
  await t.test('starting an activity saves state without awarding completion',async () => {
    const first = await rpc('start_student_activity',[id(30)]);
    const again = await rpc('start_student_activity',[id(30)]);
    assert.equal(first.status,'in_progress');
    assert.equal(first.started_at,again.started_at);
    assert.equal(first.completed_at,null);
    assert.equal(await count('student_progress'),0);
  });
  await t.test('malformed and forged quiz answers are rejected without consuming attempts',async () => {
    for (const answers of [null,{},[],{'conteudo-visivel':true},{'conteudo-visivel':'unknown'},{'conteudo-visivel':'body',score:100}]) {
      await assert.rejects(rpc('submit_student_quiz',[id(32),JSON.stringify(answers),id(101)]), /alternativa|Respostas|pergunta/);
    }
    await assert.rejects(rpc('submit_student_quiz',[id(32),'{"conteudo-visivel":"body"}',null]), /Identificador/);
    await assert.rejects(rpc('complete_student_study',[id(32)]), /confirmacao/);
    assert.equal(await count('quiz_attempts'),0);
  });
  await t.test('failed quiz persists selected answers, score and post-submission feedback',async () => {
    const failed = await submit(32,'head',110);
    assert.equal(Number(failed.score),0);
    assert.equal(failed.passed,false);
    assert.equal(failed.attempt_number,1);
    assert.equal(failed.feedback_json[0].isCorrect,false);
    assert.equal(Object.hasOwn(failed.feedback_json[0],'optionKey'),false);
    const duplicate = await submit(32,'head',110);
    assert.equal(duplicate.id,failed.id);
    assert.equal(await count('quiz_attempts'),1);
    await assert.rejects(submit(32,'body',110), /outras respostas/);
    const data = await snapshot();
    assert.equal(data.attempts[0].id,failed.id);
    assert.equal(data.progress.find(p => p.activity_id===id(32)).status,'in_progress');
    assert.equal(data.completed_at,null);
    await login('other');
    assert.equal((await snapshot()).attempts.length,0);
    assert.equal((await snapshot()).progress.length,0);
    await login();
  });
  await t.test('server enforces maximum attempts and unique retry identifiers',async () => {
    await submit(37,'head',111);
    await assert.rejects(submit(37,'body',112), /Limite de tentativas/);
    const retries = await Promise.all([submit(38,'head',113),submit(38,'head',113)]);
    assert.equal(retries[0].id,retries[1].id);
    const distinct = await Promise.allSettled([submit(39,'head',114),submit(39,'body',115)]);
    assert.equal(distinct.filter(r => r.status==='fulfilled').length,1);
    assert.equal(await count('quiz_attempts',`where activity_id='${id(39)}'`),1);
  });
  await t.test('last required activity completes lesson, unlocks next module and awards XP once',async () => {
    const studied = await rpc('complete_student_study',[id(30)]);
    assert.equal(studied.status,'completed');
    assert.equal((await rpc('complete_student_study',[id(30)])).completed_at,studied.completed_at);
    assert.equal((await rpc('start_student_activity',[id(30)])).status,'completed');
    assert.equal((await snapshot()).completed_at,null);
    const passed = await submit(32,'body',120);
    assert.equal(Number(passed.score),100); assert.equal(passed.passed,true); assert.equal(passed.attempt_number,2);
    const data = await snapshot();
    assert.ok(data.completed_at);
    assert.equal(data.activities.find(a => a.id===id(34)).is_unlocked,true);
    assert.equal((await rpc('student_lesson_learning',[id(16)])).lesson.id,id(16));
    assert.equal(await count('student_xp_events',"where event_type='lesson' and active"),1);
    const xp = (await query('select xp_points from profiles where id=$1',[fixtureUsers.student])).rows[0].xp_points;
    assert.equal(new Date(await rpc('complete_student_lesson',[id(15)])).getTime(),new Date(data.completed_at).getTime());
    assert.equal((await submit(32,'body',120)).id,passed.id);
    assert.equal((await query('select xp_points from profiles where id=$1',[fixtureUsers.student])).rows[0].xp_points,xp);
    await assert.rejects(submit(32,'head',121), /ja foi aprovado/);
  });
  await t.test('online lessons and projects still require authorized confirmation',async () => {
    for (const activity of [33,34,80,81]) await assert.rejects(rpc('complete_student_study',[id(activity)]), /confirmacao/);
    await assert.rejects(rpc('complete_student_lesson',[id(24)]), /obrigatorias/);
    await login('teacher','service_role');
    await assert.rejects(query('insert into student_progress values($1,$2,now())',[fixtureUsers.student,id(24)]), /obrigatorias/);
    await query("insert into student_activity_progress(student_id,activity_id,activity_revision,status,started_at,completed_at) values($1,$2,1,'completed',now(),now())",[fixtureUsers.student,id(80)]);
    await login(); assert.equal((await rpc('student_lesson_learning',[id(24)])).completed_at,null);
    await login('teacher','service_role');
    await query("insert into student_activity_progress(student_id,activity_id,activity_revision,status,started_at,completed_at) values($1,$2,1,'completed',now(),now())",[fixtureUsers.student,id(81)]);
    await login(); assert.ok((await rpc('student_lesson_learning',[id(24)])).completed_at);
  });
  await t.test('multi-question scoring uses equal weights and rounds only the final percentage',async () => {
    await login('admin','postgres');
    const content={schemaVersion:1,type:'quiz',passingScore:67,maxAttempts:3,questions:['one','two','three'].map(key => ({key,prompt:key,options:[{key:'a',text:'A'},{key:'b',text:'B'}]}))};
    const key={schemaVersion:1,answers:content.questions.map(q => ({questionKey:q.key,optionKey:'a',feedback:'Revise a estrutura.'}))};
    await query("insert into lesson_activities(id,lesson_id,key,title,activity_type,order_index,is_required,content_json) values($1,$2,'three-questions','Três perguntas','quiz',20,false,$3)",[id(47),id(15),JSON.stringify(content)]);
    await query('insert into activity_quiz_keys(activity_id,content_json) values($1,$2)',[id(47),JSON.stringify(key)]);
    await query("update lesson_activities set publication_status='published' where id=$1",[id(47)]);
    await login();
    const partial=await rpc('submit_student_quiz',[id(47),JSON.stringify({one:'a',two:'a',three:'b'}),id(150)]);
    assert.equal(Number(partial.score),66.67); assert.equal(partial.passed,false);
    const passed=await rpc('submit_student_quiz',[id(47),JSON.stringify({one:'a',two:'a',three:'a'}),id(151)]);
    assert.equal(Number(passed.score),100); assert.equal(passed.passed,true);
  });
  await t.test('legacy/draft-only lessons remain manual; unpublished activities do not bypass gates',async () => {
    assert.equal((await rpc('student_lesson_learning',[id(28)])).has_activity_model,false);
    await query('insert into student_progress values($1,$2,now())',[fixtureUsers.student,id(28)]);
    assert.ok(await rpc('complete_student_lesson',[id(28)]));
    const draftOnly = await rpc('student_lesson_learning',[id(29)]);
    assert.equal(draftOnly.has_activity_model,false); assert.equal(draftOnly.can_complete,true);
    assert.ok(await rpc('complete_student_lesson',[id(29)]));
    const hidden = await rpc('student_lesson_learning',[id(42)]);
    assert.equal(hidden.has_activity_model,true); assert.equal(hidden.activities.length,0); assert.equal(hidden.can_complete,false);
    await assert.rejects(rpc('complete_student_lesson',[id(42)]), /obrigatorias/);
  });
  await t.test('optional-only lessons can be explicitly finished and earlier completions are preserved',async () => {
    await login('admin','postgres');
    await query("insert into lessons(id,submodule_id,title) values($1,$2,'Atividades opcionais')",[id(49),id(27)]);
    await query("insert into lesson_activities(id,lesson_id,key,title,activity_type,order_index,is_required,content_json,publication_status) values($1,$2,'optional-study','Estudo livre','slides',0,false,$3,'published')",[id(48),id(49),JSON.stringify(example.activities[0].content)]);
    await query("insert into lesson_activities(id,lesson_id,key,title,activity_type,order_index,is_required,content_json,publication_status) values($1,$2,'new-material','Nova revisão','slides',0,true,$3,'published')",[id(52),id(28),JSON.stringify(example.activities[0].content)]);
    await login();
    const optional=await rpc('student_lesson_learning',[id(49)]);
    assert.equal(optional.can_complete,true); assert.equal(optional.completed_at,null);
    assert.ok(await rpc('complete_student_lesson',[id(49)]));
    const earlier=await rpc('student_lesson_learning',[id(28)]);
    assert.ok(earlier.completed_at); assert.equal(earlier.can_complete,false);
    assert.equal(new Date(await rpc('complete_student_lesson',[id(28)])).getTime(),new Date(earlier.completed_at).getTime());
    assert.equal(earlier.progress.length,0);
  });
  await t.test('rollback preserves academic history and can be reapplied locally',async () => {
    await login('admin','postgres');
    const before = await count('student_progress');
    await db.exec(readSql('supabase/rollbacks/student_learning_experience.sql'));
    assert.equal(await count('student_progress'),before);
    await assert.rejects(rpc('student_lesson_learning',[id(15)]), /does not exist/);
    await db.exec(readSql(learningMigration('_student_learning_experience.sql')));
    await login(); assert.ok((await snapshot()).completed_at);
  });
});
