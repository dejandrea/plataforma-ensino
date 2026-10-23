import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLearningTestDb, fixtureUsers, id, readSql } from './fixtures/learning-test-db.mjs';
import { learningMigration } from './fixtures/learning-test-db.mjs';
import { prepareInteractiveContent, interactiveDocument } from './fixtures/interactive-content.mjs';

test('B1: private grading, durable randomization, rewards and import',async t => {
  const database=await createLearningTestDb({b1:true});
  const {db,query,rpc,count,login}=database;
  t.after(() => db.close()); t.beforeEach(() => login());
  assert.ok((await query("select points from xp_reward_rules where event_type like 'activity_%' or event_type='submodule_completion'")).rows.every(row=>Number(row.points)===0));
  const {activities,lessonId,document}=await prepareInteractiveContent(database);
  const ordering=activities['linha-do-tempo'],matching=activities['tecnologias-web'],quiz=activities['instrucoes-quiz'];
  const correctOrder=document.teacherOnly.interactiveKeys[0].content.correctOrder;
  const correctPairs=Object.fromEntries(document.teacherOnly.interactiveKeys[1].content.pairs.map(p => [p.leftId,p.rightId]));
  const begin=activity => rpc('begin_student_assessment',[activity]);
  const submit=(activity,session,answers) => rpc('submit_student_assessment',[activity,JSON.stringify(answers),session.id]);
  const xp=async()=>Number((await query('select xp_points from profiles where id=$1',[fixtureUsers.student])).rows[0].xp_points);
  let quizSession;

  await t.test('v1 content works and new global rewards default to zero without changing levels',async()=>{
    assert.equal((await rpc('student_lesson_learning',[id(15)])).activities[0].content_json.schemaVersion,1);
    assert.equal(Number((await query("select points from xp_reward_rules where event_type='lesson'")).rows[0].points),10);
    assert.equal((await query('select min_xp from player_levels where level=10')).rows[0].min_xp,3200);
    assert.equal(await xp(),50);
    assert.equal(await count('activity_attempt_sessions'),0);
  });
  await t.test('presentation is immutable, stable on reload, independent of answer keys and user-specific',async()=>{
    quizSession=await begin(quiz);
    assert.equal((await begin(quiz)).id,quizSession.id);
    assert.deepEqual((await begin(quiz)).presentation_json,quizSession.presentation_json);
    const snap=await rpc('student_lesson_learning',[lessonId]);
    for(const secret of ['correctOrder','optionKey','rightId','NOTA PRIVADA','teacherOnly']) assert.equal(JSON.stringify(snap).includes(`"${secret}"`),false,secret);
    await assert.rejects(query("update activity_attempt_sessions set presentation_json='{}'"),/permission denied/);
    await login('other');
    assert.equal(await count('activity_attempt_sessions'),0);
    await assert.rejects(submit(quiz,quizSession,{instrucoes:'programa'}),/Retome|Tentativa|duplicate|Chave|unique/i);
  });
  await t.test('four-choice quizzes vary over attempts; grading uses keys and enforces maximum attempts',async()=>{
    const orders=[];
    for(let n=0;n<8;n++) {
      const session=await begin(quiz); orders.push(session.presentation_json.quiz.instrucoes.join(','));
      const result=await submit(quiz,session,{instrucoes:'cor'});
      assert.equal(Number(result.score),0); assert.equal(result.passed,false);
      assert.deepEqual(result.presentation_json,session.presentation_json);
      if(n>0) assert.notEqual(orders[n],orders[n-1]);
    }
    assert.ok(new Set(orders).size>1);
    await assert.rejects(begin(quiz),/Limite/);
    assert.equal(await xp(),50);
  });
  await t.test('ordering rejects positional indices, grades incorrect/correct sequences and awards once',async()=>{
    const first=await begin(ordering);
    await assert.rejects(submit(ordering,first,{sequence:[0,1,2,3]}),/Sequencia/);
    const wrong=[...correctOrder].reverse();
    const failed=await submit(ordering,first,{sequence:wrong});
    assert.equal(Number(failed.score),0); assert.equal(await xp(),50);
    const second=await begin(ordering); assert.notEqual(second.id,first.id);
    assert.notDeepEqual(second.presentation_json.items,first.presentation_json.items);
    const repeated=await Promise.all([submit(ordering,second,{sequence:correctOrder}),submit(ordering,second,{sequence:correctOrder})]);
    assert.equal(repeated[0].id,repeated[1].id); assert.equal(repeated[0].passed,true);
    assert.equal(await xp(),65);
    assert.equal(await count('student_xp_events',"where event_type='learning_activity'"),1);
    assert.equal(await count('student_achievements',"where code='custom:historian' and active"),1);
    await assert.rejects(begin(ordering),/aprovada/);
  });
  await t.test('existing XP/mastery recalculations preserve receipt points and achievement unlock time',async()=>{
    const before=(await query("select unlocked_at from student_achievements where code='custom:historian'")).rows[0].unlocked_at;
    await login('admin','postgres');
    await query("update xp_reward_rules set points=20 where event_type='activity_interactive'");
    await query('select private.sync_student_xp($1)',[fixtureUsers.student]);
    await query('select private.sync_student_masteries($1)',[fixtureUsers.student]);
    await login(); assert.equal(await xp(),65);
    assert.equal(new Date((await query("select unlocked_at from student_achievements where code='custom:historian' and active")).rows[0].unlocked_at).getTime(),new Date(before).getTime());
    await assert.rejects(query('update profiles set xp_points=99999 where id=$1',[fixtureUsers.student]),/XP/);
  });
  await t.test('matching validates a bijection and grade threshold before adding configured XP',async()=>{
    const first=await begin(matching);
    const reload=await begin(matching);assert.deepEqual(reload.presentation_json,first.presentation_json);
    await assert.rejects(submit(matching,first,{pairs:{html:'estrutura',css:'estrutura',javascript:'estrutura'}}),/Associacoes/);
    const incorrect={html:'aparencia',css:'interacao',javascript:'estrutura'};
    const failed=await submit(matching,first,{pairs:incorrect});assert.equal(failed.passed,false);assert.equal(await xp(),65);
    const next=await begin(matching);
    assert.notDeepEqual(next.presentation_json.left,first.presentation_json.left);
    assert.notDeepEqual(next.presentation_json.right,first.presentation_json.right);
    const passed=await submit(matching,next,{pairs:correctPairs});assert.equal(Number(passed.score),100);assert.equal(await xp(),85);
    assert.equal(await count('student_xp_events',"where event_type='learning_activity'"),2);
    assert.equal((await rpc('student_lesson_learning',[lessonId])).completed_at,null);
  });
  await t.test('successful quiz, submodule, curriculum and level integration stay idempotent',async()=>{
    // A different learner has fresh attempts; there is no learner reset RPC.
    await login('other');
    for(const activity of [ordering,matching]) {
      const session=await begin(activity);
      await submit(activity,session,activity===ordering?{sequence:correctOrder}:{pairs:correctPairs});
    }
    const session=await begin(quiz);
    const passed=await submit(quiz,session,{instrucoes:'programa'});
    assert.equal(passed.passed,true);
    assert.equal((await submit(quiz,session,{instrucoes:'programa'})).id,passed.id);
    const snapshot=await rpc('student_lesson_learning',[lessonId]);assert.ok(snapshot.completed_at);assert.equal(snapshot.gamification.level,2);
    assert.equal(await count('student_xp_events',"where event_type='learning_submodule'"),1);
    assert.equal(await count('student_achievements',"where code='custom:historian' and active"),1);
  });
  await t.test('project and final-project rewards require an authorized approval',async()=>{
    await login('admin','postgres');
    const project=JSON.parse(readSql('tests/fixtures/legacy-content/html-primeira-pagina.v1.json')).activities.find(a=>a.type==='project');
    for(const [number,rule] of [[970,'activity_project'],[971,'activity_final_project']]) {
      await query("insert into lesson_activities(id,lesson_id,key,title,activity_type,order_index,is_required,content_json,gamification_json,publication_status) values($1,$2,$3,'Projeto','project',30,false,$4,$5,'published')",[id(number),id(24),`project-${number}`,JSON.stringify(project.content),JSON.stringify({rewardRuleKey:rule,awardOn:'approved',achievementKeys:[]})]);
      await query("insert into project_submissions(id,student_id,activity_id,activity_revision,version,submission_url) values($1,$2,$3,1,1,'https://example.org/project')",[id(number+10),fixtureUsers.student,id(number)]);
      await query("insert into student_activity_progress(student_id,activity_id,activity_revision,status,started_at,completed_at) values($1,$2,1,'completed',now(),now())",[fixtureUsers.student,id(number)]);
      assert.equal(await count('student_xp_events',`where source_id='${id(number)}'`),0);
      await query("insert into project_submission_reviews(submission_id,reviewed_by,status) values($1,$2,'approved')",[id(number+10),fixtureUsers.teacher]);
      assert.equal(await count('student_xp_events',`where source_id='${id(number)}'`),1);
      assert.equal(Number((await query('select points from student_xp_events where source_id=$1',[id(number)])).rows[0].points),number===970?40:60);
    }
  });
  await t.test('study rewards are autonomous while online rewards wait for backend confirmation',async()=>{
    const before=await xp();
    const content=JSON.parse(readSql('tests/fixtures/legacy-content/html-primeira-pagina.v1.json'));
    await login('admin','postgres');
    for(const [number,index,type,rule,award] of [[972,0,'slides','activity_study','completed'],[973,3,'online_lesson','activity_online','teacher_confirmed']]) {
      await query("insert into lesson_activities(id,lesson_id,key,title,activity_type,order_index,is_required,content_json,gamification_json) values($1,$2,$3,'Atividade', $4,40,false,$5,$6)",[id(number),id(24),`reward-${number}`,type,JSON.stringify(content.activities[index].content),JSON.stringify({rewardRuleKey:rule,awardOn:award,achievementKeys:[]})]);
      if(type==='online_lesson') await query('insert into teacher_lesson_plans(activity_id,revision,content_json) values($1,1,$2)',[id(number),JSON.stringify(content.teacherOnly.lessonPlans[0].content)]);
      await query("update lesson_activities set publication_status='published' where id=$1",[id(number)]);
    }
    await login();await rpc('complete_student_study',[id(972)]);assert.equal(await xp(),before+3);
    await rpc('start_student_activity',[id(973)]);assert.equal(await xp(),before+3);
    await assert.rejects(rpc('complete_student_study',[id(973)]),/confirmacao/);
    await login('teacher','service_role');
    await query("update student_activity_progress set status='completed',completed_at=now() where student_id=$1 and activity_id=$2",[fixtureUsers.student,id(973)]);
    await login();assert.equal(await xp(),before+13);
  });
  await t.test('import validates JSON/keys/rewards on the server and refuses overwrite or privilege escalation',async()=>{
    await assert.rejects(rpc('import_learning_lesson',[lessonId,JSON.stringify(document),true]),/administradores/);
    await assert.rejects(rpc('publish_learning_activities',[lessonId,[ordering]]),/administradores/);
    await login('admin');
    await assert.rejects(rpc('import_learning_lesson',[lessonId,JSON.stringify(document),true]),/repetidas|sobrescrito/);
    const invalid=interactiveDocument();invalid.activities[0].content.correctOrder=['secret'];
    await assert.rejects(rpc('import_learning_lesson',[lessonId,JSON.stringify(invalid),true]),/contrato/);
    assert.equal(await count('lesson_activities',`where lesson_id='${lessonId}'`),3);
  });
  await t.test('presentation and award receipts remain immutable even to backend updates',async()=>{
    await login('admin','postgres');
    await assert.rejects(query("update activity_attempt_sessions set presentation_json='{}' where id=$1",[quizSession.id]),/imutavel/);
    await assert.rejects(query("update student_xp_events set points=999 where event_type='learning_activity'"),/imutavel/);
    await assert.rejects(db.exec(readSql('supabase/rollbacks/interactive_learning_and_rewards.sql')),/preservacao/);
    await db.exec('rollback');
  });
});

test('empty B1 rollback/reapply preserves legacy curriculum and gamification',async t=>{
  const {db,login,query,rpc}=await createLearningTestDb({b1:true});t.after(()=>db.close());
  await login('admin','postgres');
  await db.exec(readSql('supabase/rollbacks/interactive_learning_and_rewards.sql'));
  await login();assert.equal((await rpc('student_lesson_learning',[id(15)])).lesson.id,id(15));
  assert.equal(Number((await query("select points from xp_reward_rules where event_type='lesson'")).rows[0].points),10);
  await login('admin','postgres');await db.exec(readSql(learningMigration('_interactive_learning_and_rewards.sql')));
  await login();assert.ok((await rpc('student_lesson_learning',[id(15)])).gamification);
});
