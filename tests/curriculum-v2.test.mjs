import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCurriculumDb,curriculumManifest as m} from './fixtures/curriculum-db.mjs';
import {fixtureUsers,id,readSql} from './fixtures/learning-test-db.mjs';

const protectedTables=['student_progress','student_activity_progress','quiz_attempts','activity_attempt_sessions','project_submissions','project_submission_reviews','student_xp_events','xp_event_audit','student_achievements','student_technology_progress','xp_reward_rules','lesson_activities','activity_quiz_keys','teacher_lesson_plans','lesson_plan_sessions','module_evaluations','profiles','scheduled_lessons'];
async function snapshot(d) {
 await d.login('admin','postgres');
 const result={};
 for(const table of protectedTables)
 result[table]=(await d.query('select coalesce(jsonb_agg(row order by row::text),\'[]\') value from(select to_jsonb(t) row from public.'+table+' t)r')).rows[0].value;
 return result;
}
const status=async(d,user)=>(await d.query('select * from student_curriculum_status($1)',[fixtureUsers[user]])).rows.find(x=>x.id===m.moduleId);
const recover=async d=>d.db.exec('rollback');
test('HTML v2 preserves legacy progress and receipts, stages the complete new roadmap and gates release',async t=>{
 const d=await createCurriculumDb();t.after(()=>d.db.close());
 const before=await snapshot(d);
 await d.db.exec(d.releaseSql);
 await t.test('five submodules, fourteen curricular lessons plus introduction; stable IDs and no fabricated content',async()=>{
  const lessons=(await d.query('select * from lessons where module_id=$1 order by curriculum_number',[m.moduleId])).rows;
  assert.equal(lessons.length,15);
  assert.deepEqual(lessons.map(l=>l.curriculum_number),Array.from({length:15},(_,i)=>i));
  assert.equal((await d.query('select count(*) n from submodules where module_id=$1',[m.moduleId])).rows[0].n,5);
  assert.deepEqual(lessons.filter(l=>l.publication_status==='published').map(l=>l.id),m.existingLessons.map(l=>l.id));
  assert.ok(lessons.filter(l=>l.curriculum_version===2).every(l=>l.publication_status==='planned'&&!l.video_url&&!l.slides_url));
  assert.deepEqual(await snapshot(d),before);
 });
 await t.test('existing learners stay on v1, including inactive starters; fresh learners get all fifteen v2 lessons',async()=>{
  const cohorts=(await d.query('select student_id,version from private.student_curriculum_cohorts where module_id=$1',[m.moduleId])).rows;
  assert.deepEqual(cohorts.map(c=>c.student_id).sort(),[fixtureUsers.student,fixtureUsers.inactive].sort());
  await d.login();
  assert.equal((await status(d,'student')).total_lessons,2);assert.equal((await status(d,'student')).is_completed,true);
  assert.equal((await d.query('select * from student_curriculum_status($1)',[fixtureUsers.student])).rows.find(x=>x.id===id(9801)).is_unlocked,true);
  assert.equal((await d.query('select count(*) n from lessons where module_id=$1',[m.moduleId])).rows[0].n,2);
  await d.login('other');const fresh=await status(d,'other');
  assert.equal(fresh.total_lessons,15);assert.equal(fresh.completed_lessons,0);
  assert.equal((await d.query('select count(*) n from lessons where module_id=$1',[m.moduleId])).rows[0].n,15);
 });
 await t.test('planned lessons reject direct URLs, completion and progress writes; empty publication is impossible',async()=>{
  for(const user of ['student','other']){
   await d.login(user);
   await assert.rejects(d.rpc('student_lesson_learning',[m.lessons[0].id]),/liberada/);
   await assert.rejects(d.rpc('complete_student_lesson',[m.lessons[0].id]),/liberada/);
   await assert.rejects(d.query('insert into student_progress(student_id,lesson_id,completed_at) values($1,$2,now())',[fixtureUsers[user],m.lessons[0].id]),/atividades|modulo|módulo/);
   await assert.rejects(d.rpc('publish_curriculum_lesson',[m.lessons[0].id]),/administradores/);
  }
  await d.login('admin');
  await assert.rejects(d.rpc('publish_curriculum_lesson',[m.lessons[0].id]),/Importe/);
  await d.login('admin','postgres');
  await assert.rejects(d.query("update lessons set publication_status='published' where id=$1",[m.lessons[0].id]),/Importe/);
 });
 await t.test('teacher journey uses the student cohort; planned lessons have safe metadata; unavailable detail remains denied',async()=>{
  await d.login('teacher');
  const legacy=await d.rpc('pedagogy_student_journey',[fixtureUsers.student,m.courseId]);
  assert.equal(legacy.lessons.filter(l=>l.curriculum_number!=null).length,2);
  await assert.rejects(d.rpc('pedagogy_lesson_detail',[fixtureUsers.student,m.lessons[0].id]),/indisponível/);
  await assert.rejects(d.rpc('pedagogy_student_journey',[fixtureUsers.other,m.courseId]),/indisponível/);
  await d.login('admin');const fresh=await d.rpc('pedagogy_student_journey',[fixtureUsers.other,m.courseId]);
  assert.equal(fresh.lessons.filter(l=>l.publication_status==='planned').length,13);
  assert.equal(fresh.modules.find(x=>x.id===m.moduleId).total_lessons,15);
  for(const forbidden of ['teacherOnly','correctOrder','optionKey','answers_json'])
  assert.equal(JSON.stringify(fresh).includes(forbidden),false);
 });
 await t.test('later official XP/mastery synchronization preserves prior credits, balance, achievements and unlocked modules',async()=>{
  const prior=await snapshot(d);
  await d.query('select private.sync_student_xp($1)',[fixtureUsers.student]);
  const after=await snapshot(d);
  for(const key of ['student_xp_events','student_achievements','student_technology_progress','profiles','xp_reward_rules'])
   assert.deepEqual(after[key],prior[key],key);
  assert.equal((await status(d,'student')).is_completed,true);
 });
 await t.test('reapplying the structural release creates no duplicates and changes no histories',async()=>{
  const prior=await snapshot(d);await d.db.exec(d.releaseSql);
  assert.deepEqual(await snapshot(d),prior);
  assert.equal((await d.query('select count(*) n from lessons where module_id=$1',[m.moduleId])).rows[0].n,15);
 });
 await t.test('only explicit admin publication enables a prepared lesson for new-cohort students; legacy history stays immutable',async()=>{
  const lesson=m.lessons[0];const a=d.doc.activities[0];
  await d.query("insert into lesson_activities(id,lesson_id,key,title,activity_type,order_index,is_required,content_json,gamification_json) values($1,$2,'new-study','Material novo','slides',0,true,$3,$4)",[id(9900),lesson.id,JSON.stringify(a.content),JSON.stringify(a.gamification)]);
  await d.query("update lesson_activities set publication_status='published' where id=$1",[id(9900)]);
  await d.login('other');await assert.rejects(d.rpc('start_student_activity',[id(9900)]),/liberada|indisponível|disponivel/);
  await d.login('admin');await d.rpc('publish_curriculum_lesson',[lesson.id]);await d.rpc('publish_curriculum_lesson',[lesson.id]);
  await d.login('other');
  assert.equal((await d.rpc('student_lesson_learning',[lesson.id])).lesson.id,lesson.id);
  await d.rpc('complete_student_study',[id(9900)]);await d.rpc('complete_student_lesson',[lesson.id]);
  assert.equal((await status(d,'other')).completed_lessons,1);
  await d.login();await assert.rejects(d.rpc('student_lesson_learning',[lesson.id]),/liberada/);
  await d.login('admin','postgres');
  await assert.rejects(d.query('update lessons set curriculum_version=2 where id=$1',[m.existingLessons[1].id]),/identidade curricular/);
  assert.equal((await d.query("select count(*) n from student_xp_events where student_id=$1 and event_type='lesson' and source_id=$2",[fixtureUsers.other,lesson.id])).rows[0].n,1);
 });
 await t.test('private cohorts and backups are not client writable or readable; anonymous has no new RPC',async()=>{
  await d.login('other');
  for(const table of ['curriculum_releases','student_curriculum_cohorts','curriculum_function_backups','curriculum_migration_snapshots'])
  await assert.rejects(d.query('select * from private.'+table),/permission denied/);
  await assert.rejects(d.query('update private.student_curriculum_cohorts set version=2'),/permission denied/);
  await d.login('admin','anon');await assert.rejects(d.rpc('publish_curriculum_lesson',[m.lessons[1].id]),/permission denied/);
 });
 await t.test('additional manual lessons inherit the current version and planned state; the original lessons cannot be withdrawn',async()=>{
  await d.login('admin','postgres');
  await d.query("insert into lessons(id,module_id,submodule_id,title,order_index) values($1,$2,$3,'Aula adicional em autoria',99)",[id(9970),m.moduleId,m.submodules[0].id]);
  const row=(await d.query('select curriculum_version,publication_status from lessons where id=$1',[id(9970)])).rows[0];
  assert.deepEqual(row,{curriculum_version:2,publication_status:'planned'});
  await d.login();assert.equal((await d.query('select count(*) n from lessons where id=$1',[id(9970)])).rows[0].n,0);
  await d.login('admin','postgres');
  await assert.rejects(d.query("update lessons set publication_status='planned' where id=$1",[m.existingLessons[0].id]),/identidade curricular/);
 });
 await t.test('teacher meeting selection and linking follow both cohort and lesson publication',async()=>{
  await d.login('admin','postgres');
  await d.query('insert into teacher_student_relations values($1,$2)',[fixtureUsers.teacher,fixtureUsers.other]);
  const lesson=m.lessons.find(l=>l.number===10);
  const online=d.example.activities.find(a=>a.type==='online_lesson');
  await d.query("insert into lesson_activities(id,lesson_id,key,title,activity_type,order_index,is_required,content_json) values($1,$2,'new-meeting','Prática da nova grade','online_lesson',0,true,$3)",[id(9971),lesson.id,JSON.stringify(online.content)]);
  await d.query('insert into teacher_lesson_plans(id,activity_id,revision,content_json) select $1,$2,1,content_json from teacher_lesson_plans where id=$3',[id(9972),id(9971),id(50)]);
  await d.query("update lesson_activities set publication_status='published' where id=$1",[id(9971)]);
  await d.login('teacher');
  assert.equal((await d.rpc('teacher_learning_workspace',[id(18)])).activities.some(a=>a.id===id(9971)),false);
  await assert.rejects(d.rpc('link_teacher_learning_activity',[id(18),id(9971)]),/indisponivel/);
  await d.login('admin');await d.rpc('publish_curriculum_lesson',[lesson.id]);
  await d.login('teacher');
  assert.equal((await d.rpc('teacher_learning_workspace',[id(18)])).activities.some(a=>a.id===id(9971)),true);
  assert.equal((await d.rpc('teacher_learning_workspace',[id(17)])).activities.some(a=>a.id===id(9971)),false);
  await d.rpc('link_teacher_learning_activity',[id(18),id(9971)]);
 });
});
test('HTML migration aborts atomically on audited content drift',async t=>{
 const d=await createCurriculumDb();t.after(()=>d.db.close());
 await d.query('update lesson_activities set is_active=false where id=$1',[m.activityHashes[0].id]);
 await assert.rejects(d.db.exec(d.releaseSql),/atividades existentes mudaram/);await recover(d);
 assert.equal((await d.query('select count(*) n from lessons where module_id=$1',[m.moduleId])).rows[0].n,2);
 assert.equal((await d.query('select count(*) n from private.curriculum_releases')).rows[0].n,0);
 assert.equal((await d.query('select title from submodules where id=$1',[m.submodules[0].id])).rows[0].title,m.submodules[0].previousTitle);
});
test('pre-use containment restores old visibility without deleting any record; post-use containment is refused',async t=>{
 const d=await createCurriculumDb();t.after(()=>d.db.close());
 await d.db.exec(d.releaseSql);const before=await snapshot(d);
 const rollback=readSql('supabase/rollbacks/html_basic_curriculum_v2.sql');
 await d.db.exec(rollback);
 assert.deepEqual(await snapshot(d),before);
 assert.equal((await d.query('select count(*) n from lessons where module_id=$1',[m.moduleId])).rows[0].n,15);
 await d.login('other');assert.equal((await status(d,'other')).total_lessons,2);
 await d.login('admin','postgres');
 await d.query('update private.curriculum_releases set current_version=2 where module_id=$1',[m.moduleId]);
 await d.login('other');
 await d.rpc('start_student_activity',['53c5fdec-da42-4843-b8b7-f0856dad9f1e']);
 await d.login('admin','postgres');
 await assert.rejects(d.db.exec(rollback),/já recebeu conteúdo ou uso/);await recover(d);
 assert.equal((await d.query('select current_version from private.curriculum_releases where module_id=$1',[m.moduleId])).rows[0].current_version,2);
});
