import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createImprovementsDb} from './fixtures/improvements-db.mjs';
import {id,fixtureUsers} from './fixtures/learning-test-db.mjs';
const compile=async file=>import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')}`);

test('targeted icon activation is repeatable and enforces administrator ownership without installing the other package changes',async t=>{
 const d=await createImprovementsDb();t.after(()=>d.db.close());await d.login('admin','postgres');
 await d.db.exec('drop policy catalog_icons_admin_upload on storage.objects; drop policy catalog_icons_public_read on storage.objects; drop policy technologies_admin_update on technologies;');
 const sql=readFileSync('supabase/setup/activate_catalog_icons.sql','utf8');await d.db.exec(sql);await d.db.exec(sql);
 await d.login('admin');
 await d.query("insert into storage.objects(bucket_id,name) values('catalog-icons',$1)",[fixtureUsers.admin+'/test.png']);
 await d.query("update technologies set icon='https://example.org/icon.png'");
 await d.login();
 await assert.rejects(d.query("insert into storage.objects(bucket_id,name) values('catalog-icons',$1)",[fixtureUsers.student+'/test.png']),/row-level/);
 assert.equal((await d.query("update technologies set icon='https://example.org/forged.png' returning id")).rows.length,0);
});

test('phase 1: recurrence uses multiple weekdays, range, DST and legacy single-day mode',async()=>{
 const {planRecurrence,shiftZonedWeeks}=await compile('supabase/functions/_shared/recurrence.ts');
 const dates=planRecurrence('2026-10-20T22:00:00Z',4,[2,4,4],'America/Bahia');
 assert.deepEqual(dates,['2026-10-20T22:00:00.000Z','2026-10-22T22:00:00.000Z','2026-10-27T22:00:00.000Z','2026-10-29T22:00:00.000Z']);
 assert.equal(new Set(dates).size,4);
 assert.equal(planRecurrence(dates[0],4,[2,4],'America/Bahia','2026-10-23').length,2);
 assert.deepEqual(planRecurrence(dates[0],2),[dates[0],dates[2]]);
 assert.equal(shiftZonedWeeks('2026-03-01T15:00:00Z',1,'America/New_York'),'2026-03-08T14:00:00.000Z');
 assert.throws(()=>planRecurrence(dates[0],200),/104/);
 assert.throws(()=>planRecurrence(dates[0],4,[9]),/inválidos/);
});
test('phase 1: visibility and access tolerate fifteen minutes without losing history; discount preview rounds in cents',async()=>{
 const {canEnterLesson,isUpcomingLesson}=await compile('src/lib/lessonAccess.ts');
 const {calculateDiscount}=await compile('src/lib/discounts.ts');
 const start=Date.parse('2026-10-20T22:00:00Z'),lesson={starts_at:new Date(start).toISOString(),meet_link:'https://meet.google.com/test'};
 assert.equal(canEnterLesson(lesson,start-5*60000),true);
 assert.equal(canEnterLesson(lesson,start+15*60000),true);
 assert.equal(isUpcomingLesson(lesson.starts_at,start+15*60000),true);
 assert.equal(canEnterLesson(lesson,start+15*60000+1),false);
 assert.equal(isUpcomingLesson(lesson.starts_at,start+15*60000+1),false);
 assert.equal(canEnterLesson({...lesson,meet_link:null},start),false);
 assert.deepEqual(calculateDiscount(300,{kind:'percentage',value:10}),{gross:300,discount:30,net:270});
});

test('package: database access, catalogs, project links and official recurring achievements',async t=>{
 const d=await createImprovementsDb();t.after(()=>d.db.close());
 const {login,query,rpc,count}=d;
 const points=async(type)=>Number((await query('select coalesce(sum(points),0) n from student_xp_events where student_id=$1 and event_type=$2 and active',[fixtureUsers.student,type])).rows[0].n);
 await t.test('phase 1: server enforces time bounds and preserves the scheduled record',async()=>{
  await login('admin','postgres');await query("update scheduled_lessons set starts_at=now()-interval '10 minutes' where id=$1",[id(17)]);
  await login();await rpc('start_scheduled_lesson_session',[id(17)]);const opened=(await query('select student_joined_at,status from scheduled_lessons where id=$1',[id(17)])).rows[0];assert.ok(opened.student_joined_at);assert.equal(opened.status,'scheduled');
  await login('admin','postgres');await query("update scheduled_lessons set starts_at=now()-interval '16 minutes' where id=$1",[id(17)]);
  await login();await assert.rejects(rpc('start_scheduled_lesson_session',[id(17)]),/horario/);
  await login('admin','postgres');assert.equal(await count('scheduled_lessons',`where id='${id(17)}' and status='scheduled'`),1);
 });
 await t.test('phase 2: administrator maintains technology/mission/mastery icons; no browser can create arbitrary badges',async()=>{
  await login('admin');
  await query("insert into technologies(id,slug,name,bronze_title,silver_title,gold_title,icon) values($1,'test-tech','Tech Teste','Início','Meio','Avançado','⚙️')",[id(6000)]);
  assert.equal(await count('achievement_definitions',"where code like 'mastery:test-tech:%'"),3);
  await query("update achievement_definitions set icon='🚀' where code='mastery:test-tech:bronze'");
  assert.equal((await query("select icon from achievement_definitions where code='mastery:test-tech:bronze'")).rows[0].icon,'🚀');
  await assert.rejects(query("insert into achievement_definitions values('custom:forged','Forge','Forge','🏅',true)"),/permission denied/);
  await query("insert into missions(id,title,category,technology_ids,icon) values($1,'Missão Teste','practice',$2,'🎯')",[id(6001),[id(6000)]]);
  await query("update missions set icon='💡' where id=$1",[id(6001)]);
  await login('student');await assert.rejects(query("insert into technologies(slug,name,bronze_title,silver_title,gold_title) values('forged','forged','a','b','c')"),/row-level/);
  assert.equal((await query("update achievement_definitions set title='forged' where code='mastery:test-tech:bronze' returning code")).rows.length,0);
 });
 await t.test('phase 1: database rejects duplicate recurrence occurrences and occupied ranges',async()=>{
  await login('admin','postgres');
  const insert=async(n,index,start,end)=>query("insert into scheduled_lessons(id,teacher_id,student_id,session_track,status,starts_at,ends_at,scheduling_request_id,recurrence_index) values($1,$2,$3,'course','scheduled',$4,$5,$6,$7)",[id(n),fixtureUsers.teacher,fixtureUsers.student,start,end,id(6050),index]);
  await insert(6051,1,'2030-01-01T19:00:00Z','2030-01-01T20:00:00Z');
  await assert.rejects(insert(6052,2,'2030-01-01T19:30:00Z','2030-01-01T20:30:00Z'),/horario/);
  await assert.rejects(insert(6053,1,'2030-01-03T19:00:00Z','2030-01-03T20:00:00Z'),/unique/);
 });
 await t.test('catalog images: HTTPS URLs persist, unsafe schemes fail and only active administrators upload to their own folder',async()=>{
  await login('admin');
  const url='https://example.org/'+ 'a'.repeat(180)+'.png';
  await query('update technologies set icon=$1 where id=$2',[url,id(6000)]);
  assert.equal((await query('select icon from technologies where id=$1',[id(6000)])).rows[0].icon,url);
  await assert.rejects(query("update technologies set icon='javascript:alert(1)' where id=$1",[id(6000)]),/check constraint/);
  await query("insert into storage.objects(bucket_id,name) values('catalog-icons',$1)",[fixtureUsers.admin+'/icon.png']);
  await assert.rejects(query("insert into storage.objects(bucket_id,name) values('catalog-icons',$1)",[fixtureUsers.student+'/icon.png']),/row-level/);
  await login();await assert.rejects(query("insert into storage.objects(bucket_id,name) values('catalog-icons',$1)",[fixtureUsers.student+'/icon.png']),/row-level/);
  assert.equal((await query("select count(*) n from storage.objects where bucket_id='catalog-icons'")).rows[0].n,1);
  await login('admin','postgres');const bucket=(await query("select * from storage.buckets where id='catalog-icons'")).rows[0];assert.equal(Number(bucket.file_size_limit),2097152);assert.deepEqual(bucket.allowed_mime_types,['image/png','image/jpeg','image/webp']);
 });
 await t.test('phase 3: configured 70 percent approval survives; first completed attempt alone determines quiz XP and completion badge',async()=>{
  await login('admin','postgres');
  const content={schemaVersion:1,type:'quiz',passingScore:70,maxAttempts:5,questions:Array.from({length:10},(_,i)=>({key:`p-${i}`,prompt:`Pergunta ${i+1}`,options:[{key:'yes',text:'Correta'},{key:'no',text:'Outra'}]}))};
  await query("insert into lesson_activities(id,lesson_id,key,title,activity_type,order_index,is_required,content_json) values($1,$2,'quiz-70','Questionário 70%','quiz',99,false,$3)",[id(6060),id(24),JSON.stringify(content)]);
  await query('insert into activity_quiz_keys(activity_id,content_json) values($1,$2)',[id(6060),JSON.stringify({schemaVersion:1,answers:content.questions.map(q=>({questionKey:q.key,optionKey:'yes',feedback:'Explicação'}))})]);
  await query("update lesson_activities set publication_status='published' where id=$1",[id(6060)]);
  await login();
  const answer=async correct=>{const session=await rpc('begin_student_assessment',[id(6060)]);return rpc('submit_student_assessment',[id(6060),JSON.stringify(Object.fromEntries(content.questions.map((q,i)=>[q.key,i<correct?'yes':'no']))),session.id]);};
  const first=await answer(6);assert.equal(Number(first.score),60);assert.equal(first.passed,false);
  assert.equal(await count('student_achievements',"where code='official:quiz_completion' and active and student_id='"+fixtureUsers.student+"'"),1);
  assert.equal((await answer(7)).passed,true);
  const receipts=(await query("select points from student_xp_events where source_id=$1 and event_type='learning_activity'",[id(6060)])).rows;assert.equal(receipts.length,1);assert.equal(receipts[0].points,60);
 });
 await t.test('phase 3: main description and two additional links survive grading, retain permissions and do not duplicate XP',async()=>{
  await login();
  const links=[{url:'https://github.com/student/repo',description:'Código-fonte'},{url:'https://figma.com/test',description:'Protótipo'}];
  const args=[id(80),'https://example.org/main','Reflexão',id(6100),'Uma página pessoal',JSON.stringify(links)];
  const first=await rpc('submit_student_project',args);assert.deepEqual(first.additional_links,links);assert.equal(first.project_description,'Uma página pessoal');
  assert.equal((await rpc('submit_student_project',args)).id,first.id);
  await assert.rejects(rpc('submit_student_project',[...args.slice(0,4),'',JSON.stringify(links)]),/invalidos/);
  await assert.rejects(rpc('submit_student_project',[id(80),'https://example.org/main','',id(6101),'Descrição',JSON.stringify([{url:'javascript:alert(1)',description:'inválido'}])]),/invalido/);
  await login('teacher');await rpc('review_student_project',[first.id,'approved',80,'Bom trabalho',id(6102)]);
  const inbox=await rpc('teacher_project_inbox',[id(17)]);assert.deepEqual(inbox[0].additional_links,links);
  await login();assert.equal((await query("select sum(points)::integer n from student_xp_events where student_id=$1 and source_id=$2 and event_type in ('project_submission','project_evaluation')",[fixtureUsers.student,id(80)])).rows[0].n,130);
  assert.equal(await count('student_achievements',"where code in ('official:project_submission','official:project_review') and active"),2);
  await login('other');assert.equal(await count('project_submissions',`where id='${first.id}'`),0);
 });
 await t.test('phase 4: profile rewards are one-time and cannot be forged or multiplied',async()=>{
  await login('admin','postgres');
  await query("update profiles set full_name='Nome do Aluno',github_url='https://github.com/student',linkedin_url='https://linkedin.com/in/student',instagram_url='https://instagram.com/student' where id=$1",[fixtureUsers.student]);
  const before=await points('official_profile');assert.equal(before,70);
  await query('update profiles set full_name=full_name where id=$1',[fixtureUsers.student]);
  assert.equal(await points('official_profile'),before);
  await query('select private.sync_student_xp($1)',[fixtureUsers.student]);
  assert.equal(await count('student_achievements',"where student_id='"+fixtureUsers.student+"' and code in ('official:profile_exemplar','official:networking','official:instagram') and active"),3);
 });
 await t.test('phase 4: effective Auth sessions count once; refreshes, reloads and client inserts cannot add logins',async()=>{
  await login('admin','postgres');await query('insert into auth.sessions values($1,$2,now(),now())',[id(6200),fixtureUsers.student]);
  await query('update auth.sessions set updated_at=now() where id=$1',[id(6200)]);
  assert.equal(await count('student_login_events',`where session_id='${id(6200)}'`),1);
  for(const [index,user] of ['teacher','admin','inactive'].entries())await query('insert into auth.sessions values($1,$2,now(),now())',[id(6250+index),fixtureUsers[user]]);
  assert.equal(await count('student_login_events',`where session_id in ('${id(6250)}','${id(6251)}','${id(6252)}')`),0);
  await login();await assert.rejects(query('insert into student_login_events values($1,$2,now())',[id(6201),fixtureUsers.student]),/permission denied/);
  await assert.rejects(rpc('process_recurring_achievements'),/permission denied/);
  await assert.rejects(query('insert into auth.sessions values($1,$2,now(),now())',[id(6201),fixtureUsers.student]),/permission denied/);
 });
 await t.test('phase 4: month and Sunday boundaries use Bahia and never reward an open period',async()=>{
  await login('admin','postgres');
  for(let n=1;n<=8;n++)await query('insert into auth.sessions(id,user_id,created_at) values($1,$2,$3)',[id(6400+n),fixtureUsers.mentoring,`2024-08-${String(n).padStart(2,'0')}T15:00:00Z`]);
  await query("select private.process_recurring_achievements('2024-09-01T02:59:59Z')");
  assert.equal(await count('student_achievement_periods',`where student_id='${fixtureUsers.mentoring}' and kind='dedication_month'`),0);
  await query("select private.process_recurring_achievements('2024-09-01T03:05:00Z')");
  assert.equal(await count('student_achievement_periods',`where student_id='${fixtureUsers.mentoring}' and kind='dedication_month'`),1);
  for(let n=1;n<=2;n++)await query('insert into auth.sessions(id,user_id,created_at) values($1,$2,$3)',[id(6450+n),fixtureUsers.mentoring,`2024-10-0${n}T15:00:00Z`]);
  const filter=`where student_id='${fixtureUsers.mentoring}' and kind='engagement_week' and reference_date='2024-09-29'`;
  await query("select private.process_recurring_achievements('2024-10-06T02:59:59Z')");assert.equal(await count('student_achievement_periods',filter),0);
  await query("select private.process_recurring_achievements('2024-10-06T03:05:00Z')");assert.equal(await count('student_achievement_periods',filter),1);
 });
 await t.test('phase 4: twelve months and twelve weeks award correct bonuses, with period audit and idempotent jobs',async()=>{
  await login('admin','postgres');
  for(let month=1;month<=12;month++) for(let n=1;n<=8;n++) await query('insert into auth.sessions(id,user_id,created_at) values($1,$2,$3)',[id(7000+month*10+n),fixtureUsers.student,`2025-${String(month).padStart(2,'0')}-${String(n).padStart(2,'0')}T15:00:00Z`]);
  for(let week=0;week<12;week++) for(let n=0;n<2;n++) await query('insert into auth.sessions(id,user_id,created_at) values($1,$2,$3)',[id(8000+week*10+n),fixtureUsers.other,new Date(Date.parse('2025-01-07T15:00:00Z')+(week*7+n)*86400000).toISOString()]);
  await query("select private.process_recurring_achievements('2026-01-01T03:05:00Z')");
  assert.equal(await count('student_achievement_periods',`where student_id='${fixtureUsers.student}' and kind='dedication_month'`),12);
  assert.equal((await query("select points from student_xp_events where student_id=$1 and event_type='official_engagement_bonus' and reward_context->>'rewardRuleKey'='dedication_bonus'",[fixtureUsers.student])).rows[0].points,120);
  assert.equal((await query("select points from student_xp_events where student_id=$1 and event_type='official_engagement_bonus' and reward_context->>'rewardRuleKey'='engagement_bonus'",[fixtureUsers.other])).rows[0].points,50);
  const before=(await query('select count(*) n from student_xp_events')).rows[0].n;
  await query("select private.process_recurring_achievements('2026-01-01T03:05:00Z')");
  assert.equal((await query('select count(*) n from student_xp_events')).rows[0].n,before);
  assert.equal((await query('select count(*) n from cron.jobs')).rows[0].n,2);
  const total=(await query('select sum(points)::integer n from student_xp_events where student_id=$1 and active',[fixtureUsers.student])).rows[0].n;
  assert.equal((await query('select xp_points from profiles where id=$1',[fixtureUsers.student])).rows[0].xp_points,total);
 });
});
