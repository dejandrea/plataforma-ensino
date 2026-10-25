import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPedagogyDb} from './fixtures/pedagogy-db.mjs';
import {id,fixtureUsers,learningMigration,readSql} from './fixtures/learning-test-db.mjs';
import {createImprovementsDb} from './fixtures/improvements-db.mjs';

test('pedagogical read projections respect official curriculum, scope, pagination and existing project grading',async t=>{
 const d=await createPedagogyDb();t.after(()=>d.db.close());const {login,rpc,query}=d;
 await t.test('administrator sees active students and courses; teacher sees only assigned students',async()=>{
  await login('admin');const admin=await rpc('pedagogy_dashboard');
  assert.equal(admin.summary.active_students,3);assert.equal(admin.summary.pending_projects,3);
  assert.ok(admin.items.some(x=>x.student_id===fixtureUsers.mentoring&&x.status==='no_course'));
  await login('teacher');const teacher=await rpc('pedagogy_dashboard');
  assert.equal(teacher.summary.active_students,1);assert.equal(teacher.summary.pending_projects,2);
  assert.ok(teacher.items.every(x=>x.student_id===fixtureUsers.student));
  assert.deepEqual(teacher.teachers.map(x=>x.id),[fixtureUsers.teacher]);
 });
 await t.test('direct RPCs deny students, inactive profiles, anonymous and cross-teacher traversal',async()=>{
  const calls=[['pedagogy_dashboard',[]],['pedagogy_student_journey',[fixtureUsers.student]],['pedagogy_lesson_detail',[fixtureUsers.student,id(15)]],['pedagogy_activity_attempts',[fixtureUsers.student,id(32)]],['pedagogy_projects',[]],['pedagogy_project_detail',[d.submissions.mini.id]]];
  for(const user of ['student','inactive','mentoring']){await login(user);for(const [name,args] of calls)await assert.rejects(rpc(name,args),/equipe ativa/);}
  await login('admin','anon');for(const [name,args] of calls)await assert.rejects(rpc(name,args),/permission denied/);
  await login('stranger');
  for(const [name,args] of calls.slice(1).filter(([name])=>name!=='pedagogy_projects')) await assert.rejects(rpc(name,args),/indisponível/);
  assert.ok((await rpc('pedagogy_dashboard')).items.every(x=>x.student_id===fixtureUsers.other));
  assert.deepEqual((await rpc('pedagogy_projects')).items.map(x=>x.student_id),[fixtureUsers.other]);
 });
 await t.test('official lesson completion, optional activity, hierarchy, quiz history and XP are projected without private keys',async()=>{
  await login('teacher');const journey=await rpc('pedagogy_student_journey',[fixtureUsers.student,id(10)]);
  const official=(await query('select * from student_curriculum_status($1)',[fixtureUsers.student])).rows;
  assert.equal(journey.courses.find(c=>c.course_id===id(10)).percent,50);
  assert.equal(journey.courses.find(c=>c.course_id===id(10)).status,'in_progress');
  assert.equal(journey.modules.find(m=>m.id===id(11)).is_completed,official.find(m=>m.id===id(11)).is_completed);
  assert.equal(journey.submodules.find(s=>s.id===id(13)).completed_lessons,1);
  const lesson=journey.lessons.find(l=>l.id===id(15));assert.equal(lesson.status,'completed');assert.equal(lesson.required_completed,lesson.required_total);
  const details=await rpc('pedagogy_lesson_detail',[fixtureUsers.student,id(15)]);
  assert.equal(details.items.find(a=>a.id===id(9101)).status,'in_progress');assert.equal(details.items.find(a=>a.id===id(9101)).is_required,false);
  const quiz=details.items.find(a=>a.id===id(32));assert.equal(quiz.question_count,1);assert.equal(quiz.attempts_total,2);assert.equal(quiz.latest_attempt.passed,true);
  const attempts=await rpc('pedagogy_activity_attempts',[fixtureUsers.student,id(32),1,1]);assert.equal(attempts.total,2);assert.equal(attempts.items.length,1);assert.equal(attempts.items[0].score,100);
  const next=await rpc('pedagogy_activity_attempts',[fixtureUsers.student,id(32),2,1]);assert.equal(next.items[0].score,0);
  for(const json of [journey,details,attempts])for(const secret of ['optionKey','correctOrder','answers_json','content_json','teacherOnly','NOTA PRIVADA'])assert.equal(JSON.stringify(json).includes(secret),false);
 });
 await t.test('filters and bounded pagination apply on the server and never widen teacher scope',async()=>{
  await login('admin');const page=await rpc('pedagogy_dashboard',['',null,null,'all',1,2]);assert.equal(page.items.length,2);assert.ok(page.total>2);
  const next=await rpc('pedagogy_dashboard',['',null,null,'all',2,2]);assert.notDeepEqual(page.items.map(x=>[x.student_id,x.course_id]),next.items.map(x=>[x.student_id,x.course_id]));
  const search=await rpc('pedagogy_dashboard',['Ana',id(10),fixtureUsers.teacher,'in_progress']);assert.equal(search.total,1);
  assert.equal((await rpc('pedagogy_dashboard',['Ninguém'])).total,0);
  await assert.rejects(rpc('pedagogy_dashboard',['',null,null,'all',0,20]),/inválid/);
  await assert.rejects(rpc('pedagogy_projects',['',null,null,'all',1,1000]),/inválid/);
  await login('teacher');assert.equal((await rpc('pedagogy_dashboard',['',null,fixtureUsers.stranger])).total,0);
 });
 await t.test('viewing every dashboard/detail leaves progress, receipts, reviews and balances unchanged',async()=>{
  await login('admin','postgres');
  const snapshot=async()=>(await query("select jsonb_build_object('progress',(select jsonb_agg(to_jsonb(p) order by p.student_id,p.lesson_id) from student_progress p),'activities',(select jsonb_agg(to_jsonb(p) order by p.id) from student_activity_progress p),'receipts',(select jsonb_agg(to_jsonb(e) order by e.student_id,e.event_type,e.source_id) from student_xp_events e),'reviews',(select jsonb_agg(to_jsonb(r) order by r.id) from project_submission_reviews r),'balances',(select jsonb_agg(jsonb_build_object('id',p.id,'xp',p.xp_points) order by p.id) from profiles p)) snapshot")).rows[0].snapshot;
  const before=await snapshot();await login('teacher');
  await rpc('pedagogy_dashboard');await rpc('pedagogy_projects');await rpc('pedagogy_project_detail',[d.submissions.mini.id]);await rpc('pedagogy_student_journey',[fixtureUsers.student]);await rpc('pedagogy_lesson_detail',[fixtureUsers.student,id(15)]);await rpc('pedagogy_activity_attempts',[fixtureUsers.student,id(32)]);
  await login('admin','postgres');assert.deepEqual(await snapshot(),before);
 });
 await t.test('mini-project and final-project assessment reuses idempotent official RPC without duplicating submission XP',async()=>{
  const points=async(activity,event)=>d.db.transaction(async tx=>{await tx.exec('set local role postgres');return (await tx.query('select points from student_xp_events where student_id=$1 and source_id=$2 and event_type=$3',[fixtureUsers.student,activity,event])).rows[0]?.points;});
  await login('teacher');const pending=await rpc('pedagogy_projects');assert.equal(pending.total,2);
  const detail=await rpc('pedagogy_project_detail',[d.submissions.mini.id]);assert.equal(detail.additional_links.length,2);assert.ok(detail.assessment_criteria.length);
  for(const [item,activity,submissionPoints,n] of [[d.submissions.mini,id(80),50,9300],[d.submissions.project,id(9100),100,9301]]){
   assert.equal(await points(activity,'project_submission'),submissionPoints);
   const args=[item.id,'approved',80,'Muito bom',id(n)];const first=await rpc('review_student_project',args);assert.equal((await rpc('review_student_project',args)).id,first.id);
   assert.equal(await points(activity,'project_evaluation'),80);assert.equal(await points(activity,'project_submission'),submissionPoints);
   await rpc('review_student_project',[item.id,'approved',65,'Nota revisada',id(n+10)]);
   assert.equal(await points(activity,'project_evaluation'),65);assert.equal((await rpc('pedagogy_project_detail',[item.id])).reviews.length,2);
  }
  assert.equal((await rpc('pedagogy_projects',['',null,null,'pending'])).total,0);assert.equal((await rpc('pedagogy_projects',['',null,null,'reviewed'])).total,2);
 });
 await t.test('revisions preserve previous submissions/reviews and reject reviewing an obsolete submission',async()=>{
  await login('teacher');await rpc('review_student_project',[d.submissions.mini.id,'needs_revision',55,'Revisar contraste',id(9400)]);
  assert.equal((await rpc('pedagogy_projects',['',null,null,'needs_revision'])).total,1);
  await login();const second=await rpc('submit_student_project',[id(80),'https://example.org/ana-v2','Segunda versão',id(9401),'Contraste revisado','[]']);
  await login('teacher');
  await assert.rejects(rpc('pedagogy_project_detail',[d.submissions.mini.id]),/mais recente/);
  const detail=await rpc('pedagogy_project_detail',[second.id]);assert.equal(detail.version,2);assert.equal(detail.previous_versions.length,1);assert.equal(detail.previous_versions[0].reviews.length,3);
  await assert.rejects(rpc('review_student_project',[second.id,'approved',101,'Nota inválida',id(9402)]),/invalida/);
  await rpc('review_student_project',[second.id,'approved',70,'Contraste corrigido',id(9403)]);
  const history=await rpc('pedagogy_project_detail',[second.id]);assert.equal(history.reviews.length,1);assert.equal(history.previous_versions[0].reviews.length,3);
 });
 await t.test('opening optional materials never completes a course; official lesson records do complete it',async()=>{
  await login('admin','postgres');
  await query("insert into courses values($1,'Curso de conclusão',true)",[id(9600)]);
  await query("insert into modules values($1,$2,'Módulo de conclusão',0,true)",[id(9601),id(9600)]);
  for(const [sub,lesson,name] of [[9602,9603,'Primeira aula'],[9604,9605,'Segunda aula']]){
   await query("insert into submodules(id,module_id,title,is_active) values($1,$2,'Parte do curso',true)",[id(sub),id(9601)]);
   await query('insert into lessons(id,submodule_id,title) values($1,$2,$3)',[id(lesson),id(sub),name]);
  }
  await query("insert into lesson_activities(id,lesson_id,key,title,activity_type,order_index,is_required,content_json) values($1,$2,'optional-video','Vídeo opcional','video',0,false,$3)",[id(9606),id(9603),JSON.stringify({schemaVersion:2,type:'video',resourceUrl:'https://drive.google.com/file/d/test/view'})]);
  await query("update lesson_activities set publication_status='published' where id=$1",[id(9606)]);
  await login();await rpc('start_student_activity',[id(9606)]);
  await login('teacher');let journey=await rpc('pedagogy_student_journey',[fixtureUsers.student,id(9600)]);
  assert.equal(journey.courses.find(c=>c.course_id===id(9600)).status,'in_progress');assert.equal(journey.modules[0].is_completed,false);
  assert.equal(journey.lessons.find(l=>l.id===id(9603)).status,'in_progress');
  await login();await rpc('complete_student_lesson',[id(9603)]);
  await login('teacher');journey=await rpc('pedagogy_student_journey',[fixtureUsers.student,id(9600)]);assert.equal(journey.courses.find(c=>c.course_id===id(9600)).percent,50);
  await login();await rpc('complete_student_lesson',[id(9605)]);
  await login('teacher');journey=await rpc('pedagogy_student_journey',[fixtureUsers.student,id(9600)]);
  assert.equal(journey.courses.find(c=>c.course_id===id(9600)).status,'completed');assert.equal(journey.modules[0].is_completed,true);assert.ok(journey.submodules.every(s=>s.completed_lessons===s.total_lessons));
  assert.equal((await rpc('pedagogy_lesson_detail',[fixtureUsers.student,id(9603)])).items[0].status,'in_progress');
 });
 await t.test('period counts and activity pagination are bounded and the pending student filter cannot escape scope',async()=>{
  await login('teacher');
  const all=await rpc('pedagogy_dashboard',['',null,null,'all',1,50,'2000-01-01T00:00:00Z','2100-01-01T00:00:00Z']);
  const future=await rpc('pedagogy_dashboard',['',null,null,'all',1,50,'2099-01-01T00:00:00Z','2100-01-01T00:00:00Z']);
  assert.ok(all.summary.completed_activities>0);assert.equal(future.summary.completed_activities,0);
  const page=await rpc('pedagogy_lesson_detail',[fixtureUsers.student,id(15),1,2]);assert.equal(page.items.length,2);assert.ok(page.total>2);
  await assert.rejects(rpc('pedagogy_activity_attempts',[fixtureUsers.student,id(32),1,500]),/inválida/);
  await assert.rejects(rpc('pedagogy_projects',['',null,null,'all',1,10,fixtureUsers.other]),/indisponível/);
  await assert.rejects(rpc('pedagogy_student_journey',[fixtureUsers.student,id(99999)]),/indisponível/);
 });
});

test('central migration and rollback only add/remove authorized stable readers, preserving data and XP configuration',async t=>{
 const d=await createImprovementsDb();t.after(()=>d.db.close());await d.login('admin','postgres');
 const snapshot=async()=>(await d.query("select jsonb_build_object('rules',(select jsonb_agg(to_jsonb(r) order by event_type) from xp_reward_rules r),'activities',(select jsonb_agg(to_jsonb(a) order by id) from lesson_activities a),'reviews',(select jsonb_agg(to_jsonb(r) order by id) from project_submission_reviews r),'profiles',(select jsonb_agg(to_jsonb(p) order by id) from profiles p)) snapshot")).rows[0].snapshot;
 const before=await snapshot();await d.db.exec(readSql(learningMigration('_pedagogical_monitoring_center.sql')));assert.deepEqual(await snapshot(),before);
 const functions=(await d.query("select n.nspname,p.proname,p.prosecdef,p.provolatile,p.proconfig,has_function_privilege('anon',p.oid,'execute') anonymous from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname like 'pedagogy_%' and n.nspname in ('public','private')")).rows;
 assert.equal(functions.length,16);assert.ok(functions.every(f=>!f.anonymous&&f.provolatile==='s'&&f.proconfig.includes('search_path=""')));assert.ok(functions.filter(f=>f.nspname==='public').every(f=>!f.prosecdef));
 await d.db.exec(readSql('supabase/rollbacks/pedagogical_monitoring_center.sql'));assert.deepEqual(await snapshot(),before);
 assert.equal((await d.query("select count(*)::int n from pg_proc where proname like 'pedagogy_%'")).rows[0].n,0);
 await d.db.exec(readSql(learningMigration('_pedagogical_monitoring_center.sql')));await d.login('teacher');assert.equal((await d.rpc('pedagogy_dashboard')).summary.active_students,1);
});
