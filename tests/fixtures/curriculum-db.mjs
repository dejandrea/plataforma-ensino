import {createImprovementsDb} from './improvements-db.mjs';
import {readSql,learningMigration,id,fixtureUsers} from './learning-test-db.mjs';
import {readFileSync} from 'node:fs';
export const curriculumManifest=JSON.parse(readFileSync('docs/manifests/html-basic-v2.json','utf8'));
export async function prepareCurriculumFixture(d) {
 const {db,login,query,rpc}=d;const m=curriculumManifest;
 await login('admin','postgres');
 await db.exec(readSql(learningMigration('_video_learning_activity.sql')));
 await db.exec(readSql(learningMigration('_pedagogical_monitoring_center.sql')));
 // Structural fixture fills columns absent from the historical minimal baseline.
 await db.exec("alter table lessons add column module_id uuid,add column order_index integer;alter table submodules add column description text,add column order_index double precision;alter table module_evaluations add column module_id uuid;");
 await query("insert into courses values($1,'HTML',true)",[m.courseId]);
 await query("insert into modules values($1,$2,'HTML Básico',1,true)",[m.moduleId,m.courseId]);
 for(const s of m.submodules.filter(x=>x.previousTitle))
 await query("insert into submodules(id,module_id,is_active,title,description,order_index) values($1,$2,true,$3,'Descrição original',$4)",[s.id,m.moduleId,s.previousTitle,s.order]);
 for(const l of m.existingLessons)
 await query("insert into lessons(id,module_id,submodule_id,title,order_index,duration_minutes) values($1,$2,$3,$4,$5,$6)",[l.id,m.moduleId,m.submodules[0].id,l.title,l.order,l.number?24:5]);
 await query("insert into modules values($1,$2,'HTML I',2,true)",[id(9801),m.courseId]);
 await query("insert into submodules(id,module_id,is_active,title,order_index) values($1,$2,true,'Depois do básico',1)",[id(9802),id(9801)]);
 await query("insert into lessons(id,module_id,submodule_id,title,order_index) values($1,$2,$3,'Próxima etapa',1)",[id(9803),id(9801),id(9802)]);
 const doc=JSON.parse(readSql('tests/fixtures/html-m01-s01-a01.v2.admin.json'));
 const audit=JSON.parse(readSql('docs/auditoria-curricular-html-v2.snapshot.json'));
 const find=key=>audit.dependencies.activities.find(x=>x.key===key).id;
 for(const a of doc.activities)
 await query("insert into lesson_activities(id,lesson_id,key,title,description,activity_type,order_index,is_required,content_json,gamification_json) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
 [find(a.key),m.existingLessons[1].id,a.key,a.title,a.description,a.type,a.orderIndex,a.required,JSON.stringify(a.content),JSON.stringify(a.gamification)]);
 for(const k of doc.teacherOnly.quizKeys)await query("insert into activity_quiz_keys(activity_id,content_json) values($1,$2)",[find(k.activityKey),JSON.stringify(k.content)]);
 for(const k of doc.teacherOnly.interactiveKeys)await query("insert into activity_quiz_keys(activity_id,activity_type,content_json) values($1,'interactive',$2)",[find(k.activityKey),JSON.stringify(k.content)]);
 for(const a of audit.dependencies.activities.filter(x=>x.lesson_id===m.existingLessons[0].id)) {
 const content=a.type==='video'?{schemaVersion:2,type:'video',resourceUrl:'https://drive.google.com/file/d/fixture_video/view'}:doc.activities[0].content;
 await query("insert into lesson_activities(id,lesson_id,key,title,activity_type,order_index,is_required,content_json,gamification_json) values($1,$2,$3,$4,$5,$6,true,$7,$8)",
 [a.id,a.lesson_id,a.key,a.title,a.type,a.order,JSON.stringify(content),JSON.stringify(a.reward)]);
 }
 await query("update lesson_activities set publication_status='published' where lesson_id=any($1::uuid[])",[m.existingLessons.map(l=>l.id)]);
 await login();
 const quiz=find('a01-v2-desafio-final');
 const session=await rpc('begin_student_assessment',[quiz]);
 const answers=Object.fromEntries(doc.teacherOnly.quizKeys[0].content.answers.map(x=>[x.questionKey,x.optionKey]));
 await rpc('submit_student_assessment',[quiz,JSON.stringify(answers),session.id]);
 await login('admin','postgres');
 await db.exec('alter table student_progress disable trigger learning_guard_lesson_completion');
 for(const l of m.existingLessons)await query('insert into student_progress(student_id,lesson_id,completed_at) values($1,$2,now())',[fixtureUsers.student,l.id]);
 await db.exec('alter table student_progress enable trigger learning_guard_lesson_completion');
 await query("insert into student_activity_progress(student_id,activity_id,activity_revision,status,started_at) values($1,$2,1,'in_progress',now())",[fixtureUsers.inactive,find('a00-v2-video-boas-vindas')]);
 await db.exec(readSql(learningMigration('_curriculum_versions.sql')));
 const actual=(await query("select a.id,md5(to_jsonb(a)::text) row_hash from lesson_activities a join lessons l on l.id=a.lesson_id where l.module_id=$1 order by a.id",[m.moduleId])).rows;
 // The audited production fingerprints pin real content; isolated synthetic rows
 // have different timestamps/resources. Substitute only these manifest hashes.
 let releaseSql=readSql(learningMigration('_html_basic_curriculum_v2.sql'));
 for(const x of actual)releaseSql=releaseSql.replaceAll(m.activityHashes.find(h=>h.id===x.id).row_hash,x.row_hash);
 return {...d,releaseSql,doc};
}
export async function createCurriculumDb(){const d=await createImprovementsDb();return prepareCurriculumFixture(d);}
