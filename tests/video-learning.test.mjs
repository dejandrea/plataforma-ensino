import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createLearningTestDb,learningMigration,readSql,fixtureUsers,id} from './fixtures/learning-test-db.mjs';
import {videoDocument,prepareVideoLesson,videoLessonId} from './fixtures/video-content.mjs';
import {createImprovementsDb} from './fixtures/improvements-db.mjs';

const require=createRequire(import.meta.url);
const compiled=ts.transpileModule(readSql('src/lib/learningContent.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const module={exports:{}};
new Function('require','module','exports',compiled)(name=>name.endsWith('.json')?JSON.parse(readFileSync(`src/contracts/${name.split('/').at(-1)}`,'utf8')):require(name),module,module.exports);
const {validateLessonImport,toStudentLesson}=module.exports;
const progressCode=ts.transpileModule(readSql('src/lib/learningProgress.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {driveVideoPreview}=await import(`data:text/javascript;base64,${Buffer.from(progressCode).toString('base64')}`);
const validUrls=[
  ['https://drive.google.com/file/d/file_123/view?authuser=1&resourcekey=secret','https://drive.google.com/file/d/file_123/preview?resourcekey=secret&authuser=1'],
  ['https://drive.google.com/file/d/file_123/view?usp=sharing&resourcekey=0-share_key','https://drive.google.com/file/d/file_123/preview?resourcekey=0-share_key'],
  ['https://drive.google.com/file/u/1/d/file_123/preview?resourcekey=a%2Bb','https://drive.google.com/file/d/file_123/preview?resourcekey=a%2Bb'],
  ['https://drive.google.com/open?resourcekey=secret&id=file_123','https://drive.google.com/file/d/file_123/preview?resourcekey=secret'],
  ['https://drive.google.com/uc?id=file_123&export=download','https://drive.google.com/file/d/file_123/preview'],
];
const invalidUrls=['http://drive.google.com/file/d/id/view','javascript:alert(1)','https://example.org/video.mp4','https://drive.google.com.evil.example/file/d/id/view','https://drive.google.com@evil.example/file/d/id/view','https://user:secret@drive.google.com/file/d/id/view','https://drive.google.com:8443/file/d/id/view','https://drive.google.com/accounts/login','https://drive.google.com/file/d/../view','https://drive.google.com/open?id=','https://drive.google.com/file/d/id/view with space'];

test('v2 video validates without mutation; v1/v2 lessons without video remain accepted',()=>{
  const d=videoDocument(),before=structuredClone(d);
  assert.equal(validateLessonImport(d).valid,true);assert.deepEqual(d,before);
  assert.equal('teacherOnly' in toStudentLesson(d),false);
  for(const file of ['html-primeira-pagina.v1.json','maquinas-interativas.v2.json']) assert.equal(validateLessonImport(JSON.parse(readSql(`docs/examples/${file}`))).valid,true);
  for(const required of [true,false]) {d.activities[0].required=required;assert.equal(validateLessonImport(d).valid,true);}
  const noVideo=videoDocument();noVideo.activities.shift();assert.equal(validateLessonImport(noVideo).valid,true);
});
test('trusted Drive video URLs preserve access keys; arbitrary iframe origins are rejected',()=>{
  for(const [url,expected] of validUrls){const d=videoDocument();d.activities[0].content.resourceUrl=url;assert.equal(validateLessonImport(d).valid,true,url);assert.equal(driveVideoPreview(url),expected);}
  for(const url of invalidUrls){const d=videoDocument();d.activities[0].content.resourceUrl=url;assert.equal(validateLessonImport(d).valid,false,url);assert.equal(driveVideoPreview(url),null,url);}
});
const mutations={
  'client points':d=>{d.activities[0].gamification.points=1000;},
  'wrong rule':d=>{d.activities[0].gamification.rewardRuleKey='activity_online';},
  'wrong award condition':d=>{d.activities[0].gamification.awardOn='teacher_confirmed';},
  'content version':d=>{d.activities[0].content.schemaVersion=1;},
  'unknown public fields':d=>{d.activities[0].content.autocomplete=true;},
  'missing URL':d=>{delete d.activities[0].content.resourceUrl;},
  'self dependency':d=>{d.activities[0].prerequisites=['video-estrutura'];},
  'v1 video':d=>{d.schemaVersion=1;delete d.teacherOnly.interactiveKeys;},
};
for(const [label,mutate] of Object.entries(mutations))test(`video contract rejects ${label}`,()=>{const d=videoDocument();mutate(d);assert.equal(validateLessonImport(d).valid,false);});

test('video import, required/optional progress, official ten XP, idempotency and access control',async t=>{
  const d=await createLearningTestDb({b1:true});t.after(()=>d.db.close());
  const {db,login,query,rpc,count}=d;await login('admin','postgres');
  for(const suffix of ['_teacher_learning_workspace.sql','_official_xp_rules_v1.sql']) await db.exec(readSql(learningMigration(suffix)));
  const before=(await query('select id,activity_type,content_json from lesson_activities order by id')).rows;
  const acl=async()=>(await query("select proname,proacl::text,prosecdef,proconfig from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='private' and proname in ('learning_record_study','learning_validate_reward','learning_award_activity') order by proname")).rows;
  const permissions=await acl();
  await db.exec(readSql(learningMigration('_video_learning_activity.sql')));
  await db.exec(readSql(learningMigration('_video_learning_activity.sql')));
  assert.deepEqual(await acl(),permissions);
  for(const [resourceUrl] of validUrls) assert.equal((await query("select private.learning_public_content_valid('video',$1) valid",[JSON.stringify({schemaVersion:2,type:'video',resourceUrl})])).rows[0].valid,true);
  assert.deepEqual((await query('select id,activity_type,content_json from lesson_activities order by id')).rows,before);
  assert.deepEqual((await query('select document from private.learning_content_schemas where version=2')).rows[0].document,JSON.parse(readSql('src/contracts/learning-content.v2.schema.json')));
  await prepareVideoLesson(d);
  await t.test('server rejects invalid imports atomically including forged XP and unsafe URLs',async()=>{
    for(const mutate of [...Object.values(mutations),...invalidUrls.map(url=>doc=>{doc.activities[0].content.resourceUrl=url;})]){
      const doc=videoDocument();mutate(doc);await assert.rejects(rpc('import_learning_lesson',[videoLessonId,JSON.stringify(doc),true]));
      assert.equal(await count('lesson_activities',`where lesson_id='${videoLessonId}'`),0);
    }
  });
  const doc=videoDocument();doc.activities[1].prerequisites=['video-estrutura'];
  let result=await rpc('import_learning_lesson',[videoLessonId,JSON.stringify(doc),false]);
  await login();assert.equal((await rpc('student_lesson_learning',[videoLessonId])).activities.length,0);
  await login('admin');await rpc('publish_learning_activities',[videoLessonId,result.activityIds]);
  await login();let lesson=await rpc('student_lesson_learning',[videoLessonId]);
  const video=lesson.activities.find(a=>a.activity_type==='video').id;
  const slides=lesson.activities.find(a=>a.activity_type==='slides').id;
  assert.equal(lesson.can_complete,false);assert.equal(lesson.activities.find(a=>a.id===slides).is_unlocked,false);
  await assert.rejects(rpc('complete_student_lesson',[videoLessonId]),/obrigatorias/);
  await assert.rejects(rpc('complete_student_study',[slides]),/pre-requisitos/);
  await rpc('start_student_activity',[video]);
  assert.equal(await count('student_xp_events',`where source_id='${video}'`),0);
  await rpc('complete_student_study',[video]);await rpc('complete_student_study',[video]);await rpc('start_student_activity',[video]);
  lesson=await rpc('student_lesson_learning',[videoLessonId]);assert.ok(lesson.completed_at);
  assert.equal(lesson.activities.find(a=>a.id===slides).is_unlocked,true);
  assert.equal(lesson.progress.find(p=>p.activity_id===video).status,'completed');
  let events=(await query("select points,reward_context from student_xp_events where source_id=$1 and event_type='learning_activity'",[video])).rows;
  assert.equal(events.length,1);assert.equal(events[0].points,10);assert.equal(events[0].reward_context.rewardRuleKey,'activity_study');
  // A different student receives their own receipt once; clients cannot insert receipts directly.
  await assert.rejects(query("insert into student_xp_events(student_id,event_type,source_id,title,points) values($1,'learning_activity',$2,'forged',999)",[fixtureUsers.student,id(9999)]),/permission denied/);
  for(const user of ['teacher','stranger','inactive','mentoring','admin']){await login(user);await assert.rejects(rpc('complete_student_study',[video]));}
  await login('other');await rpc('complete_student_study',[video]);assert.equal(await count('student_xp_events',`where source_id='${video}'`),1);
  await login('admin','anon');await assert.rejects(rpc('complete_student_study',[video]),/permission denied/);
  await login('admin','postgres');await query('select private.sync_student_xp($1)',[fixtureUsers.student]);
  events=(await query("select points from student_xp_events where student_id=$1 and source_id=$2 and event_type='learning_activity'",[fixtureUsers.student,video])).rows;
  assert.deepEqual(events,[{points:10}]);
  // An optional video does not prevent completion of a different lesson.
  const optional=videoDocument();optional.activities[0].required=false;delete optional.activities[0].gamification;
  await query('insert into lessons(id,submodule_id,title) values($1,$2,$3)',[id(9804),id(9802),optional.lesson.title]);
  await login('admin');result=await rpc('import_learning_lesson',[id(9804),JSON.stringify(optional),true]);
  await login();assert.equal((await rpc('student_lesson_learning',[id(9804)])).can_complete,true);
  await rpc('complete_student_lesson',[id(9804)]);
  assert.equal(await count('student_activity_progress',`where activity_id='${result.activityIds[0]}'`),0);
  await rpc('complete_student_study',[result.activityIds[0]]);
  assert.equal((await query("select points from student_xp_events where source_id=$1 and event_type='learning_activity'",[result.activityIds[0]])).rows[0].points,10);
  // Existing study and assessment behavior is preserved.
  await rpc('complete_student_study',[id(30)]);await rpc('complete_student_study',[id(31)]);
  await assert.rejects(rpc('complete_student_study',[id(32)]),/avaliacao/);
  assert.equal((await rpc('student_lesson_learning',[id(28)])).has_activity_model,false);
});

test('video integrates with the latest content catalogs, achievements and project-review migrations',async t=>{
  const d=await createImprovementsDb();t.after(()=>d.db.close());
  await d.login('admin','postgres');
  await d.db.exec(readSql(learningMigration('_fix_learning_profile_service_permissions.sql')));
  await d.db.exec(readSql(learningMigration('_video_learning_activity.sql')));
  await prepareVideoLesson(d);
  const imported=await d.rpc('import_learning_lesson',[videoLessonId,JSON.stringify(videoDocument()),true]);
  await d.login();
  await d.rpc('complete_student_study',[imported.activityIds[0]]);
  await d.rpc('complete_student_study',[imported.activityIds[0]]);
  const events=(await d.query("select points from student_xp_events where source_id=$1 and event_type='learning_activity'",[imported.activityIds[0]])).rows;
  assert.deepEqual(events,[{points:10}]);
  assert.ok((await d.rpc('student_lesson_learning',[videoLessonId])).completed_at);
});
