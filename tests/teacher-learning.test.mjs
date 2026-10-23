import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLearningTestDb,fixtureUsers,id,learningMigration,readSql} from './fixtures/learning-test-db.mjs';

test('C: restricted plans, persisted execution, evaluation and explicit curriculum confirmation',async t=>{
  const db=await createLearningTestDb({b1:true});
  t.after(()=>db.db.close());
  const {login,query,rpc,count}=db;
  await login('admin','postgres');
  await db.db.exec(readSql(learningMigration('_teacher_learning_workspace.sql')));
  const workspace=()=>rpc('teacher_learning_workspace',[id(17)]);
  const initial=()=>rpc('save_teacher_learning_session',[session.id,session.version,[],session.notes,JSON.stringify(session.evaluation_json)]);
  let session;
  await t.test('student, unrelated teacher, inactive and anonymous accounts cannot read or modify plans',async()=>{
    for(const role of ['student','other','stranger','inactive']) {
      await login(role);
      await assert.rejects(workspace(),/indisponivel/);
      await assert.rejects(rpc('link_teacher_learning_activity',[id(17),id(81)]),/indisponivel/);
      await assert.rejects(rpc('save_teacher_learning_session',[id(999),1,[],'','{}']),/indisponivel/);
      await assert.rejects(rpc('confirm_teacher_learning_activity',[id(999),1]),/indisponivel/);
      assert.equal(await count('lesson_plan_sessions'),0);
    }
    await login('','anon');await assert.rejects(workspace(),/permission denied/);
  });
  await t.test('responsible teacher reads pinned plan; invalid curriculum links are refused; linking is idempotent',async()=>{
    await login('teacher');
    const data=await workspace();
    session=data.sessions[0];assert.equal(session.notes,'NOTA PRIVADA DA PROFESSORA');
    assert.equal(session.plan.steps.length>0,true);
    assert.ok(data.activities.some(a=>a.id===id(81)));
    await assert.rejects(rpc('link_teacher_learning_activity',[id(17),id(30)]),/indisponivel/);
    await assert.rejects(rpc('link_teacher_learning_activity',[id(17),id(41)]),/indisponivel/);
    const linked=await rpc('link_teacher_learning_activity',[id(17),id(81)]);
    assert.equal(linked.sessions.length,2);
    assert.equal((await rpc('link_teacher_learning_activity',[id(17),id(81)])).sessions.length,2);
    assert.equal((await workspace()).sessions.find(s=>s.id===session.id).plan_revision,session.plan_revision);
    await assert.rejects(query('update lesson_plan_sessions set notes=$1 where id=$2',['forged',session.id]),/permission denied/);
  });
  await t.test('autosave fields and pedagogical levels survive readback; stale writes and invalid values fail atomically',async()=>{
    const step=session.plan.steps[0].key;
    const evaluation={comprehension:'developing',practice:'needs_support',autonomy:'autonomous',difficulties:['Seletores'],recommendations:['Retomar HTML'],revisitStepKeys:[step]};
    const saved=await rpc('save_teacher_learning_session',[session.id,session.version,[step],'Observação restrita',JSON.stringify(evaluation)]);
    assert.equal(saved.version,2);
    await assert.rejects(initial(),/outra aba/);
    session={...session,...saved};
    assert.deepEqual((await workspace()).sessions.find(s=>s.id===session.id).evaluation_json,evaluation);
    for(const invalid of [{comprehension:'approved'},{score:100},{revisitStepKeys:['missing']},{recommendations:'texto'}])
      await assert.rejects(rpc('save_teacher_learning_session',[session.id,session.version,[],'',JSON.stringify(invalid)]),/invalido|invalida|desconhecido/);
    await assert.rejects(rpc('save_teacher_learning_session',[session.id,session.version,['missing'],'','{}']),/Etapas invalidas/);
    await assert.rejects(rpc('save_teacher_learning_session',[session.id,session.version,[null],'','{}']),/invalido/);
    assert.equal((await workspace()).sessions.find(s=>s.id===session.id).version,2);
    assert.equal(await count('student_activity_progress',`where activity_id='${id(33)}'`),0);
  });
  await t.test('administrative completion and checklist do not complete curriculum; confirmation requires completed meeting',async()=>{
    await assert.rejects(rpc('confirm_teacher_learning_activity',[session.id,session.version]),/Encerre/);
    await login('admin','postgres');
    await query("update scheduled_lessons set status='completed' where id=$1",[id(17)]);
    assert.equal(await count('student_activity_progress',`where activity_id='${id(33)}'`),0);
    await login('teacher');
    await assert.rejects(rpc('confirm_teacher_learning_activity',[session.id,0]),/outra aba/);
    // The required activity in this fixture has prerequisites? Confirmation must
    // accept unfinished teaching steps while still enforcing curriculum rules.
    const confirmed=await rpc('confirm_teacher_learning_activity',[session.id,session.version]);
    assert.ok(confirmed.confirmed_at);assert.equal(confirmed.confirmed_by,fixtureUsers.teacher);
    assert.equal(confirmed.completed_step_keys.length,1);
    assert.equal((await rpc('confirm_teacher_learning_activity',[session.id,session.version])).confirmed_at,confirmed.confirmed_at);
    assert.equal(await count('student_activity_progress',`where activity_id='${id(33)}' and status='completed'`),1);
    await login('student');
    const publicData=JSON.stringify(await rpc('student_lesson_learning',[id(15)]));
    assert.equal(publicData.includes('Observação restrita'),false);assert.equal(publicData.includes('expectedAnswer'),false);
  });
  await t.test('cancelled meetings reject changes and confirmations; administrators can read authorized sessions',async()=>{
    await login('admin','postgres');await query("update scheduled_lessons set status='cancelled' where id=$1",[id(18)]);
    await login('admin');const other=(await rpc('teacher_learning_workspace',[id(18)])).sessions[0];
    await assert.rejects(rpc('save_teacher_learning_session',[other.id,other.version,[],'','{}']),/cancelado/);
    await assert.rejects(rpc('link_teacher_learning_activity',[id(18),id(81)]),/cancelado/);
    await assert.rejects(rpc('confirm_teacher_learning_activity',[other.id,other.version]),/Encerre/);
  });
  await t.test('confirmation enforces prerequisites and awards configured online XP only once',async()=>{
    await login('admin','postgres');
    const doc=JSON.parse(readSql('tests/fixtures/legacy-content/html-primeira-pagina.v1.json'));
    await query("insert into lesson_activities(id,lesson_id,key,title,activity_type,order_index,is_required,content_json,gamification_json) values($1,$2,'live-c','Encontro C','online_lesson',50,false,$3,$4)",
      [id(1001),id(24),JSON.stringify(doc.activities[3].content),JSON.stringify({rewardRuleKey:'activity_online',awardOn:'teacher_confirmed',achievementKeys:[]})]);
    await query('insert into teacher_lesson_plans(activity_id,revision,content_json) values($1,1,$2)',[id(1001),JSON.stringify(doc.teacherOnly.lessonPlans[0].content)]);
    await query('insert into activity_prerequisites values($1,$2)',[id(1001),id(80)]);
    await query("update lesson_activities set publication_status='published' where id=$1",[id(1001)]);
    await query("update xp_reward_rules set points=17 where event_type='activity_online'");
    await login('teacher');
    const linked=await rpc('link_teacher_learning_activity',[id(17),id(1001)]);
    const live=linked.sessions.find(s=>s.activity_id===id(1001));
    await assert.rejects(rpc('confirm_teacher_learning_activity',[live.id,live.version]),/pre-requisitos/);
    assert.equal((await workspace()).sessions.find(s=>s.id===live.id).confirmed_at,null);
    assert.equal(await count('student_xp_events',`where source_id='${id(1001)}'`),0);
    await login('admin','postgres');
    await query("insert into student_activity_progress(student_id,activity_id,activity_revision,status,started_at,completed_at) values($1,$2,1,'completed',now(),now())",[fixtureUsers.student,id(80)]);
    await login('teacher');
    const confirmed=await rpc('confirm_teacher_learning_activity',[live.id,live.version]);
    assert.deepEqual(confirmed.completed_step_keys,[]);
    await rpc('confirm_teacher_learning_activity',[live.id,live.version]);
    await login('student');
    assert.equal(await count('student_xp_events',`where source_id='${id(1001)}'`),1);
    assert.equal((await query('select points from student_xp_events where source_id=$1',[id(1001)])).rows[0].points,17);
  });
  await t.test('rollback refuses to erase confirmation provenance',async()=>{
    await login('admin','postgres');
    await assert.rejects(db.db.exec(readSql('supabase/rollbacks/teacher_learning_workspace.sql')),/confirmacoes/);
    await db.db.exec('rollback');
    assert.equal(await count('lesson_plan_sessions','where confirmed_at is not null'),2);
  });
});

test('C: rollback before confirmations preserves existing session data and reapplies',async t=>{
  const db=await createLearningTestDb({b1:true});t.after(()=>db.db.close());
  await db.login('admin','postgres');
  const migration=readSql(learningMigration('_teacher_learning_workspace.sql'));
  await db.db.exec(migration);
  await db.db.exec(readSql('supabase/rollbacks/teacher_learning_workspace.sql'));
  assert.equal(await db.count('lesson_plan_sessions'),2);
  await db.db.exec(migration);
  await db.login('teacher');assert.equal((await db.rpc('teacher_learning_workspace',[id(17)])).sessions.length,1);
});
