import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLearningTestDb,fixtureUsers,id,learningMigration,readSql} from './fixtures/learning-test-db.mjs';
import {prepareInteractiveContent} from './fixtures/interactive-content.mjs';

export async function officialXpDb() {
 const db=await createLearningTestDb({b1:true});
 await prepareInteractiveContent(db,{importContent:false});
 await db.login('admin','postgres');
 await db.db.exec(readSql(learningMigration('_teacher_learning_workspace.sql')));
 await db.db.exec(readSql(learningMigration('_official_xp_rules_v1.sql')));
 return db;
}

test('official XP v1: scoring, receipts, projects, audit, progression and authorization',async t=>{
 const db=await officialXpDb();t.after(()=>db.db.close());
 const {login,rpc,query,count}=db;
 const add=async(n,type,{questions=5,required=false,rule,achievementKeys=[]}={})=>{
  await login('admin','postgres');
  let content;
  if(type==='quiz') content={schemaVersion:1,type,passingScore:60,maxAttempts:10,questions:Array.from({length:questions},(_,i)=>({key:`q-${i}`,prompt:`Pergunta ${i+1}`,options:[{key:'yes',text:`Resposta correta ${i+1}`},{key:'no',text:`Outra resposta ${i+1}`}]}))};
  else if(['slides','mindmap'].includes(type)) content={schemaVersion:1,type,resourceUrl:'https://example.org/study.pdf',format:'pdf',altText:'Material'};
  else if(type==='project') content=JSON.parse(readSql('docs/examples/html-primeira-pagina.v1.json')).activities.find(a=>a.type==='project').content;
  else content={schemaVersion:2,type:'interactive',interactionType:'ordering',instructions:'Ordene',passingScore:100,maxAttempts:10,items:[{id:'first',label:'Primeiro'},{id:'last',label:'Último'}]};
  const g=rule?{rewardRuleKey:rule,awardOn:type==='project'?'approved':'completed',achievementKeys}:{};
  await query('insert into lesson_activities(id,lesson_id,key,title,activity_type,order_index,is_required,content_json,gamification_json) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id(n),id(904),`official-${n}`,`Atividade ${n}`,type,n,required,JSON.stringify(content),JSON.stringify(g)]);
  if(type==='quiz'||type==='interactive') await query('insert into activity_quiz_keys(activity_id,activity_type,content_json) values($1,$2,$3)',[id(n),type,JSON.stringify(type==='quiz'?{schemaVersion:1,answers:content.questions.map(q=>({questionKey:q.key,optionKey:'yes',feedback:'Explicação'}))}:{schemaVersion:2,interactionType:'ordering',correctOrder:['first','last'],feedback:'Correto'})]);
  await query("update lesson_activities set publication_status='published' where id=$1",[id(n)]);
  await login();return id(n);
 };
 const points=async(activity,event='learning_activity')=>{
  const rows=(await query('select points from student_xp_events where student_id=$1 and source_id=$2 and event_type=$3',[fixtureUsers.student,activity,event])).rows;
  return rows[0]?.points;
 };
 const quiz=async(activity,size,correct,request)=>{
  const session=await rpc('begin_student_assessment',[activity]);
  const answers=Object.fromEntries(Array.from({length:size},(_,i)=>[`q-${i}`,i<correct?'yes':'no']));
  const args=[activity,JSON.stringify(answers),session.id];
  return {result:await rpc('submit_student_assessment',args),args,request};
 };
 await t.test('official configuration is protected; slides and maps give ten each exactly once',async()=>{
  await login('admin');await assert.rejects(query("update xp_reward_rules set points=999 where event_type='lesson'"),/oficial/);
  for(const [n,type] of [[2000,'slides'],[2001,'mindmap']]) {
   const activity=await add(n,type);await rpc('complete_student_study',[activity]);await rpc('complete_student_study',[activity]);
   assert.equal(await points(activity),10);
   assert.equal(await count('student_xp_events',`where source_id='${activity}'`),1);
  }
 });
 await t.test('first quiz submission awards 0, 25, 60, 80 or 100 independent of passing; retries never add XP',async()=>{
  for(const [index,size,correct,expected] of [[0,4,0,0],[1,4,1,25],[2,5,3,60],[3,5,4,80],[4,5,5,100],[5,6,1,17]]) {
   const activity=await add(2010+index,'quiz',{questions:size});
   const {result,args}=await quiz(activity,size,correct);
   assert.equal(Number(result.score),Math.round(correct/size*10000)/100);
   assert.equal(await points(activity),expected);
   assert.equal((await rpc('submit_student_assessment',args)).id,result.id);
   if(!result.passed) {await quiz(activity,size,size);assert.equal(await points(activity),expected);}
   assert.equal(await count('student_xp_events',`where source_id='${activity}'`),1);
  }
 });
 await t.test('new quizzes shorter than four and forged XP payloads are rejected',async()=>{
  await assert.rejects(add(2020,'quiz',{questions:3}),/4 perguntas/);
  await login();
  await assert.rejects(query("insert into student_xp_events(student_id,event_type,source_id,title,points) values($1,'learning_activity',$2,'forged',10000)",[fixtureUsers.student,id(2020)]),/permission denied/);
  const activity=await add(2021,'quiz',{questions:4});
  const session=await rpc('begin_student_assessment',[activity]);
  await assert.rejects(rpc('submit_student_assessment',[activity,JSON.stringify({'q-0':'yes','q-1':'yes','q-2':'yes','q-3':'yes',xp:10000}),session.id]),/Respostas/);
  assert.equal(await points(activity),undefined);
 });
 await t.test('failed first quiz awards XP without a completion badge; later approval unlocks only the badge',async()=>{
  const activity=await add(2022,'quiz',{questions:4,rule:'activity_quiz',achievementKeys:['custom:historian']});
  await quiz(activity,4,0);assert.equal(await points(activity),0);
  assert.equal(await count('student_achievements',"where code='custom:historian' and active"),0);
  await quiz(activity,4,4);assert.equal(await points(activity),0);
  assert.equal(await count('student_achievements',"where code='custom:historian' and active"),1);
  await login('admin','postgres');await query('select private.sync_student_xp($1)',[fixtureUsers.student]);
  await login();assert.equal(await count('student_achievements',"where code='custom:historian' and active"),1);
 });
 await t.test('ordering awards fifteen on completion, never on failure',async()=>{
  const activity=await add(2030,'interactive');
  let session=await rpc('begin_student_assessment',[activity]);
  await rpc('submit_student_assessment',[activity,JSON.stringify({sequence:['last','first']}),session.id]);
  assert.equal(await points(activity),undefined);
  session=await rpc('begin_student_assessment',[activity]);
  await rpc('submit_student_assessment',[activity,JSON.stringify({sequence:['first','last']}),session.id]);
  assert.equal(await points(activity),15);
 });
 await t.test('matching completion and protected online confirmation award fifteen once',async()=>{
  await login('admin','postgres');
  const content={schemaVersion:2,type:'interactive',interactionType:'matching',instructions:'Associe',passingScore:100,maxAttempts:10,leftItems:[{id:'a',label:'A'},{id:'b',label:'B'}],rightItems:[{id:'one',label:'Um'},{id:'two',label:'Dois'}]};
  await query("insert into lesson_activities(id,lesson_id,key,title,activity_type,order_index,is_required,content_json) values($1,$2,'match-official','Associar','interactive',99,false,$3)",[id(2031),id(904),JSON.stringify(content)]);
  await query("insert into activity_quiz_keys(activity_id,activity_type,content_json) values($1,'interactive',$2)",[id(2031),JSON.stringify({schemaVersion:2,interactionType:'matching',pairs:[{leftId:'a',rightId:'one'},{leftId:'b',rightId:'two'}],feedback:'Correto'})]);
  await query("update lesson_activities set publication_status='published' where id=$1",[id(2031)]);
  await query("update scheduled_lessons set status='completed' where id=$1",[id(17)]);
  await login();let session=await rpc('begin_student_assessment',[id(2031)]);
  await rpc('submit_student_assessment',[id(2031),JSON.stringify({pairs:{a:'one',b:'two'}}),session.id]);
  assert.equal(await points(id(2031)),15);
  await login('teacher');const live=(await rpc('teacher_learning_workspace',[id(17)])).sessions[0];
  await rpc('confirm_teacher_learning_activity',[live.id,live.version]);await rpc('confirm_teacher_learning_activity',[live.id,live.version]);
  await login();assert.equal(await points(id(33)),15);
 });
 await t.test('valid mini-project/project submissions and grades use separate unique receipts; grade changes replace points with audit',async()=>{
  for(const [n,rule,submissionPoints] of [[2040,'activity_project',50],[2041,'activity_final_project',100]]) {
   const activity=await add(n,'project',{rule});
   await assert.rejects(rpc('submit_student_project',[activity,'javascript:alert(1)','',id(n+100)]),/HTTPS/);
   const args=[activity,'https://example.org/project','Minha entrega',id(n+100)];
   const submitted=await rpc('submit_student_project',args);
   assert.equal((await rpc('submit_student_project',args)).id,submitted.id);
   assert.equal(await points(activity,'project_submission'),submissionPoints);
   await assert.rejects(rpc('submit_student_project',[activity,'https://example.org/again','',id(n+101)]),/Aguarde/);
   await login('stranger');await assert.rejects(rpc('review_student_project',[submitted.id,'approved',100,'',id(n+200)]),/indisponivel/);
   await login('student');await assert.rejects(rpc('review_student_project',[submitted.id,'approved',100,'',id(n+200)]),/indisponivel/);
   await login('teacher');
   await assert.rejects(rpc('review_student_project',[submitted.id,'approved',101,'',id(n+200)]),/invalida/);
   const reviewArgs=[submitted.id,'needs_revision',40,'Revisar estrutura',id(n+200)];
   const reviewed=await rpc('review_student_project',reviewArgs);
   assert.equal((await rpc('review_student_project',reviewArgs)).id,reviewed.id);
   await login();assert.equal(await points(activity,'project_evaluation'),40);
   const second=await rpc('submit_student_project',[activity,'https://example.org/revised','Revisto',id(n+300)]);
   assert.equal(second.version,2);assert.equal(await points(activity,'project_submission'),submissionPoints);
   await login('teacher');
   await assert.rejects(rpc('review_student_project',[submitted.id,'approved',100,'',id(n+400)]),/recente/);
   await rpc('review_student_project',[second.id,'approved',80,'Melhorou',id(n+400)]);
   await rpc('review_student_project',[second.id,'approved',65.5,'Nota definitiva',id(n+500)]);
   await login();
   assert.equal(await points(activity,'project_evaluation'),66);
   const audit=(await query("select previous_points,new_points,reward_context from xp_event_audit where student_id=$1 and source_id=$2 and event_type='project_evaluation' order by changed_at",[fixtureUsers.student,activity])).rows;
   assert.deepEqual(audit.map(r=>[r.previous_points,r.new_points]),[[null,40],[40,80],[80,66]]);
   assert.equal(await count('project_submission_reviews',`where submission_id in ('${submitted.id}','${second.id}')`),3);
   await assert.rejects(query('update xp_event_audit set new_points=999'),/permission denied/);
   await login('other');assert.equal(await count('xp_event_audit',`where source_id='${activity}'`),0);
   await login('teacher');const inbox=await rpc('teacher_project_inbox',[id(17)]);assert.ok(inbox.some(s=>s.id===second.id));
  }
 });
 await t.test('last lesson awards fifty once and preserves advancement, balance and immutable receipts',async()=>{
  await login('admin','postgres');
  await query("insert into courses values($1,'Ultimo curso',true)",[id(2500)]);
  await query("insert into modules values($1,$2,'Ultimo modulo',0,true)",[id(2501),id(2500)]);
  await query("insert into submodules(id,module_id,is_active,title) values($1,$2,true,'Ultimo submodulo')",[id(2502),id(2501)]);
  await query("insert into lessons(id,submodule_id,title) values($1,$2,'Ultima aula')",[id(2503),id(2502)]);
  await query("insert into modules values($1,$2,'Proximo modulo',1,true)",[id(2504),id(2500)]);
  await query("insert into submodules(id,module_id,is_active,title) values($1,$2,true,'Proximo submodulo')",[id(2505),id(2504)]);
  await query("insert into lessons(id,submodule_id,title) values($1,$2,'Ultima aula do curso')",[id(2506),id(2505)]);
  await login();assert.equal((await query('select is_unlocked from student_curriculum_status($1) where id=$2',[fixtureUsers.student,id(2504)])).rows[0].is_unlocked,false);
  await login();await rpc('complete_student_lesson',[id(2503)]);await rpc('complete_student_lesson',[id(2503)]);
  assert.equal((await query('select is_unlocked from student_curriculum_status($1) where id=$2',[fixtureUsers.student,id(2504)])).rows[0].is_unlocked,true);
  await rpc('complete_student_lesson',[id(2506)]);await rpc('complete_student_lesson',[id(2506)]);
  assert.equal(await points(id(2506),'lesson'),50);
  assert.equal(await points(id(2503),'lesson'),50);
  assert.equal(await count('student_xp_events',`where source_id='${id(2503)}' and event_type='lesson'`),1);
  const total=(await query('select sum(points)::integer n from student_xp_events where student_id=$1 and active',[fixtureUsers.student])).rows[0].n;
  const balance=(await query('select xp_points from profiles where id=$1',[fixtureUsers.student])).rows[0].xp_points;
  assert.equal(balance,total);
  await login('admin','postgres');
  await query('select private.sync_student_xp($1)',[fixtureUsers.student]);
  assert.equal((await query('select xp_points from profiles where id=$1',[fixtureUsers.student])).rows[0].xp_points,total);
  await assert.rejects(query("update student_xp_events set points=999 where source_id=$1 and event_type='project_submission'",[id(2040)]),/imutavel/);
  await assert.rejects(query('delete from xp_event_audit'),/imutavel/);
  await assert.rejects(db.db.exec(readSql('supabase/rollbacks/official_xp_rules_v1.sql')),/Rollback recusado/);
  await db.db.exec('rollback');
 });
});

test('official XP rollback before use restores prior rules and schemas without deleting legacy data',async t=>{
 const db=await officialXpDb();t.after(()=>db.db.close());
 await db.login('admin','postgres');
 for(const version of [1,2]) {
  const actual=(await db.query('select document from private.learning_content_schemas where version=$1',[version])).rows[0].document;
  assert.deepEqual(actual,JSON.parse(readSql(`src/contracts/learning-content.v${version}.schema.json`)));
 }
 await db.db.exec(readSql('supabase/rollbacks/official_xp_rules_v1.sql'));
 assert.equal((await db.query("select points from xp_reward_rules where event_type='activity_study'")).rows[0].points,3);
 assert.equal(await db.count('lesson_plan_sessions'),2);
 await db.db.exec(readSql(learningMigration('_official_xp_rules_v1.sql')));
 assert.equal((await db.query("select points from xp_reward_rules where event_type='activity_study'")).rows[0].points,10);
});

test('official XP migration preserves legacy balances and does not reward a later quiz attempt retroactively',async t=>{
 const db=await createLearningTestDb({b1:true});t.after(()=>db.db.close());
 const {login,query,rpc}=db;
 await login();await rpc('complete_student_study',[id(30)]);
 const session=await rpc('begin_student_assessment',[id(32)]);
 await rpc('submit_student_assessment',[id(32),'{"conteudo-visivel":"head"}',session.id]);
 await login('admin','postgres');
 const before=(await query('select * from student_xp_events order by student_id,event_type,source_id')).rows;
 const balance=(await query('select xp_points from profiles where id=$1',[fixtureUsers.student])).rows[0].xp_points;
 await db.db.exec(readSql(learningMigration('_teacher_learning_workspace.sql')));
 await db.db.exec(readSql(learningMigration('_official_xp_rules_v1.sql')));
 assert.deepEqual((await query('select * from student_xp_events order by student_id,event_type,source_id')).rows,before);
 assert.equal((await query('select xp_points from profiles where id=$1',[fixtureUsers.student])).rows[0].xp_points,balance);
 await login();const next=await rpc('begin_student_assessment',[id(32)]);
 await rpc('submit_student_assessment',[id(32),'{"conteudo-visivel":"body"}',next.id]);
 assert.equal(await db.count('student_xp_events',`where source_id='${id(32)}' and event_type='learning_activity'`),0);
});
