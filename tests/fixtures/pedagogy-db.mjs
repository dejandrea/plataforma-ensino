import {createImprovementsDb} from './improvements-db.mjs';
import {id,fixtureUsers,learningMigration,readSql} from './learning-test-db.mjs';

export async function preparePedagogy(d) {
 const {login,query,rpc,db}=d;
 await login('admin','postgres');
 await db.exec(readSql(learningMigration('_video_learning_activity.sql')));
 await db.exec(readSql(learningMigration('_pedagogical_monitoring_center.sql')));
 for(const [user,name] of [['student','Ana Ribeiro'],['other','Bruno Costa'],['teacher','Carla Professora'],['stranger','Dora Professora'],['mentoring','Eva Mentoria']]) await query('update profiles set full_name=$1 where id=$2',[name,fixtureUsers[user]]);
 await query('insert into teacher_student_relations values($1,$2)',[fixtureUsers.stranger,fixtureUsers.other]);
 await query("insert into lesson_activities(id,lesson_id,key,title,activity_type,order_index,is_required,content_json,gamification_json) select $1,lesson_id,'pedagogy-final','Projeto final: meu primeiro site','project',99,false,content_json,'{\"rewardRuleKey\":\"activity_final_project\",\"awardOn\":\"approved\",\"achievementKeys\":[]}' from lesson_activities where id=$2",[id(9100),id(80)]);
 await query("update lesson_activities set publication_status='published' where id=$1",[id(9100)]);
 await query("insert into lesson_activities(id,lesson_id,key,title,activity_type,order_index,is_required,content_json) values($1,$2,'pedagogy-video','Vídeo: boas-vindas','video',100,false,$3)",[id(9101),id(15),JSON.stringify({schemaVersion:2,type:'video',resourceUrl:'https://drive.google.com/file/d/fixture_video/view?resourcekey=test-key'})]);
 await query("update lesson_activities set publication_status='published' where id=$1",[id(9101)]);
 await login();
 await rpc('start_student_activity',[id(9101)]);
 await rpc('complete_student_study',[id(30)]);
 await rpc('complete_student_study',[id(31)]);
 for(const answer of ['head','body']) {
  const attempt=await rpc('begin_student_assessment',[id(32)]);
  await rpc('submit_student_assessment',[id(32),JSON.stringify({'conteudo-visivel':answer}),attempt.id]);
 }
 const mini=await rpc('submit_student_project',[id(80),'https://example.org/ana-mini','Minha primeira entrega',id(9200),'Página com apresentação e navegação',JSON.stringify([{url:'https://example.org/repository',description:'Código-fonte'},{url:'https://example.org/demo',description:'Demonstração'}])]);
 const project=await rpc('submit_student_project',[id(9100),'https://example.org/ana-final','Meu projeto final',id(9201),'Site completo do projeto final','[]']);
 await login('other');const other=await rpc('submit_student_project',[id(80),'https://example.org/bruno','Entrega de Bruno',id(9202),'Projeto de outra professora','[]']);
 await login('teacher');
 return {mini,project,other};
}
export async function createPedagogyDb() {
 const d=await createImprovementsDb();
 const submissions=await preparePedagogy(d);
 return {...d,submissions};
}
