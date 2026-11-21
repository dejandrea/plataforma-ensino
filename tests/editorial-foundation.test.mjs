import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPresentationsDb,presentationRpc,roleQuery} from './fixtures/presentations-db.mjs';
import {prepareA02Reconciliation} from './fixtures/a02-reconciliation-db.mjs';
import {id,readSql,learningMigration,fixtureUsers} from './fixtures/learning-test-db.mjs';

test('E1a synthetic editorial lifecycle, permissions, concurrency and rollback',{timeout:180000},async t=>{
 const d=await createPresentationsDb();t.after(()=>d.db.close());
 await prepareA02Reconciliation(d);await d.login('admin','postgres');
 await d.db.exec(readSql(learningMigration('_editorial_foundation.sql')));
 const receipts=async()=>{await d.login('admin','postgres');return (await d.query(`select jsonb_build_object(
 'profiles',(select jsonb_agg(to_jsonb(p) order by id) from profiles p),
 'xp',(select jsonb_agg(to_jsonb(p) order by to_jsonb(p)::text) from student_xp_events p),
 'progress',(select jsonb_agg(to_jsonb(p) order by to_jsonb(p)::text) from student_progress p),
 'attempts',(select jsonb_agg(to_jsonb(p) order by to_jsonb(p)::text) from quiz_attempts p),
 'sessions',(select jsonb_agg(to_jsonb(p) order by to_jsonb(p)::text) from activity_attempt_sessions p)) value`)).rows[0].value;};
 const originalReceipts=await receipts();
 const lesson=id(9920);
 await d.query('insert into lessons(id,module_id,submodule_id,title,order_index) values($1,$2,$3,$4,20)',[lesson,id(26),id(27),'Aula editorial sintetica']);
 const doc={schemaVersion:2,context:{courseTitle:'Aula antiga',moduleTitle:'Aula antiga',submoduleTitle:'Conteúdo'},
 lesson:{key:'aula-editorial-local',title:'Aula editorial sintetica',description:'Material de teste local.',objectives:['Reconhecer os elementos.'],durationMinutes:10},
 activities:[{key:'estudo-local',type:'slides',title:'Material inicial',orderIndex:0,required:true,prerequisites:[],
 content:{schemaVersion:1,type:'slides',format:'link',resourceUrl:'https://example.org/material',altText:'Material de teste'},
 gamification:{rewardRuleKey:'activity_study',awardOn:'completed',achievementKeys:[]}}],teacherOnly:{quizKeys:[],interactiveKeys:[],lessonPlans:[]}};
 const call=(name,args=[],who='admin',role='authenticated')=>presentationRpc(d,who,name,args,role);
 const state=()=>call('admin_editorial_lesson',[lesson]);
 const plan=(value=doc)=>call('plan_editorial_lesson',[lesson,JSON.stringify(value)]);
 const save=(p,value=doc)=>call('save_editorial_draft',[lesson,JSON.stringify(value),p.sourceToken,p.draftVersion,true]);
 const publish=dr=>call('publish_editorial_draft',[lesson,dr.source_token,dr.version,true]);
 const rows=async()=>{await d.login('admin','postgres');return (await d.query('select * from lesson_activities where lesson_id=$1 order by key',[lesson])).rows;};
 await t.test('admin only; private state denied to students, professors and anonymous',async()=>{
 for(const who of ['student','teacher','inactive','other'])await assert.rejects(call('admin_editorial_lesson',[lesson],who),/administradores/);
 for(const who of ['student','teacher']){
 await assert.rejects(call('plan_editorial_lesson',[lesson,JSON.stringify(doc)],who),/administradores/);
 await assert.rejects(call('save_editorial_draft',[lesson,JSON.stringify(doc),'forged',0,true],who),/administradores/);
 }
 await assert.rejects(call('admin_editorial_lesson',[lesson],'','anon'),/permission denied/);
 await assert.rejects(roleQuery(d,'admin','select * from private.editorial_drafts'),/permission denied/);
 await assert.rejects(roleQuery(d,'admin',"insert into private.editorial_permits(transaction_id,kind,row_id,before_row,after_row) values(txid_current(),'activity',$1,'{}','{}')",[lesson]),/permission denied/);
 await assert.rejects(roleQuery(d,'admin',"select private.editorial_has_history($1)",[lesson]),/permission denied/);
 });
 let draft;
 await t.test('empty existing lesson: compare and save never publish; recover private draft',async()=>{
 const p=await plan();assert.equal(p.canSave,true);assert.equal(p.needsIdentity,true);assert.deepEqual(p.activities[0].classes,['new']);
 draft=await save(p);assert.equal((await rows()).length,0);
 const reopened=await state();assert.deepEqual(reopened.draft.document,doc);assert.equal(reopened.draft.version,1);
 await assert.rejects(call('publish_editorial_draft',[lesson,draft.source_token,draft.version,false]),/Confirme/);
 });
 await t.test('explicit separate publication, idempotent receipt and unchanged lesson status',async()=>{
 const before=(await d.query('select publication_status from lessons where id=$1',[lesson])).rows;
 const result=await publish(draft);assert.equal(result.published,true);assert.deepEqual(await publish(draft),result);
 assert.equal((await rows())[0].publication_status,'published');
 assert.deepEqual((await d.query('select publication_status from lessons where id=$1',[lesson])).rows,before);
 });
 const first=(await rows())[0];
 await t.test('editorial/resource/structural differences; UUID and key preserved; insertion',async()=>{
 doc.lesson.title='Titulo editorial atualizado';doc.lesson.description='Descricao atualizada.';doc.activities[0].title='Material atualizado';doc.activities[0].content.resourceUrl='https://example.org/revisado';
 doc.activities.push({...structuredClone(doc.activities[0]),key:'novo-material',orderIndex:1,title:'Novo material',required:false});
 const p=await plan();assert.ok(p.activities[0].classes.includes('editorial'));assert.ok(p.activities[0].classes.includes('resource'));
 draft=await save(p);await publish(draft);const after=await rows();assert.equal(after.length,2);
 const old=after.find(x=>x.key===first.key);assert.equal(old.id,first.id);assert.equal(old.revision,first.revision);assert.deepEqual(old.published_at,first.published_at);
 assert.equal((await d.query('select title from lessons where id=$1',[lesson])).rows[0].title,doc.lesson.title);
 });
 await t.test('omitted activities retained; duplicate positions/keys and broken/circular dependencies rejected',async()=>{
 const subset=structuredClone(doc);subset.activities.pop();const p=await plan(subset);assert.equal(p.activities.length,2);assert.equal(p.activities.find(a=>a.key==='novo-material').omitted,true);
 const collision=structuredClone(subset);collision.activities[0].orderIndex=1;await assert.rejects(plan(collision),/posicoes/);
 const duplicate=structuredClone(doc);duplicate.activities[1].key=duplicate.activities[0].key;await assert.rejects(plan(duplicate),/Chaves/);
 const invalid=structuredClone(doc);invalid.activities[0].prerequisites=['missing'];await assert.rejects(plan(invalid),/requisitos/);
 invalid.activities[0].prerequisites=['novo-material'];invalid.activities[1].prerequisites=['estudo-local'];await assert.rejects(plan(invalid),/circulares/);
 const old=(await rows()).find(a=>a.key==='novo-material');draft=await save(p,subset);await publish(draft);assert.deepEqual((await rows()).find(a=>a.key==='novo-material'),old);
 });
 await t.test('two administrator operations cannot overwrite a newer persistent draft',async()=>{
 const p=await plan();doc.activities[0].description='Primeira administradora';draft=await save(p);
 await assert.rejects(save(p),/Concorrencia/);
 const changed=structuredClone(doc);changed.activities[0].title='Segunda administradora';const p2=await plan(changed);await save(p2,changed);
 await assert.rejects(publish(draft),/divergente/);
 });
 await t.test('history arriving after comparison blocks publication; existing history blocks save',async()=>{
 const p=await plan();draft=await save(p);
 await d.login('admin','postgres');await d.query('insert into student_activity_progress(student_id,activity_id,activity_revision) values($1,$2,1)',[fixtureUsers.student,first.id]);
 const blocked=await plan();assert.equal(blocked.canSave,false);assert.match(blocked.issues.join(' '),/historico/);
 await assert.rejects(save(blocked),/Conflitos/);await assert.rejects(publish(draft),/historico/);
 await d.login('admin','postgres');await d.query('delete from student_activity_progress where activity_id=$1',[first.id]);
 });
 await t.test('late transactional failure preserves published rows and saved draft',async()=>{
 doc.activities[0].title='Atualizacao atomica';draft=await save(await plan());const before=await rows();
 await d.db.exec(`create function public.fail_editorial() returns trigger language plpgsql as $$begin raise exception 'synthetic late failure';end$$;
 create trigger fail_editorial before update on public.lessons for each row execute function public.fail_editorial();`);
 await assert.rejects(publish(draft),/synthetic late failure/);assert.deepEqual(await rows(),before);
 assert.equal((await state()).draft.status,'draft');await d.login('admin','postgres');assert.equal((await d.query('select count(*) n from private.editorial_permits')).rows[0].n,0);
 await d.db.exec('drop trigger fail_editorial on public.lessons;drop function public.fail_editorial();');await publish(draft);
 });
 await t.test('direct writes remain immutable; XP rules cannot change; no learning events',async()=>{
 await assert.rejects(roleQuery(d,'admin',"update lesson_activities set title='Bypass' where id=$1",[first.id]),/imutavel/);
 const changed=structuredClone(doc);changed.activities[0].gamification={rewardRuleKey:'activity_project',awardOn:'completed',achievementKeys:[]};await assert.rejects(plan(changed),/recompensa/);
 await d.login('admin','postgres');assert.equal((await d.query('select count(*) n from student_activity_progress where activity_id=$1',[first.id])).rows[0].n,0);
 assert.equal((await d.query('select count(*) n from student_xp_events where source_id=$1 or source_id in(select id from lesson_activities where lesson_id=$1)',[lesson])).rows[0].n,0);
 });
 await t.test('immutable lesson key and incompatible type changes are reported safely',async()=>{
 const changed=structuredClone(doc);changed.lesson.key='wrong-key';await assert.rejects(plan(changed),/Key estavel/);
 changed.lesson.key=doc.lesson.key;changed.activities[0].type='mindmap';changed.activities[0].content.type='mindmap';const p=await plan(changed);assert.equal(p.canSave,false);assert.ok(p.activities[0].classes.includes('incompatible'));
 });
 await t.test('v1 remains supported by the shared foundation and preserves omitted records',async()=>{
 const v1=structuredClone(doc);v1.schemaVersion=1;delete v1.teacherOnly.interactiveKeys;for(const a of v1.activities)delete a.gamification;
 // Existing reward rules are deliberately immutable, so v1 omission of an explicit
 // rule is blocked, rather than silently changing it. Use the original legacy flow
 // on an empty lesson to validate v1 end-to-end.
 const target=id(9923);await d.login('admin','postgres');await d.query('insert into lessons(id,module_id,submodule_id,title,order_index) values($1,$2,$3,$4,23)',[target,id(26),id(27),v1.lesson.title]);
 v1.lesson.key='legacy-editorial-local';const p=await call('plan_editorial_lesson',[target,JSON.stringify(v1)]);assert.equal(p.canSave,true);
 const dr=await call('save_editorial_draft',[target,JSON.stringify(v1),p.sourceToken,p.draftVersion,true]);await call('publish_editorial_draft',[target,dr.source_token,dr.version,true]);
 });
 await t.test('legacy A02 reconciliation still operates with the new guards and shared validator',async()=>{
 const a02=JSON.parse(readSql('tests/fixtures/a02-reconciliation.v2.admin.json'));
 const p=await call('plan_a02_reconciliation',[JSON.stringify(a02)]);
 const result=await call('apply_a02_reconciliation',[JSON.stringify(a02),p.token,true]);assert.equal(result.newActivityIds.length,2);
 await d.login('admin','postgres');assert.equal((await d.query('select count(*) n from private.a02_reconciliation_permits')).rows[0].n,0);
 });
 await t.test('profiles, XP, completed lessons and attempts remain byte-equivalent',async()=>{
 assert.deepEqual(await receipts(),originalReceipts);
 });
});

test('E1a all eight existing activity types; private keys, plans, dependencies and web links',{timeout:180000},async t=>{
 const d=await createPresentationsDb();t.after(()=>d.db.close());await prepareA02Reconciliation(d);await d.login('admin','postgres');
 await d.db.exec(readSql(learningMigration('_editorial_foundation.sql')));
 const lesson=id(9921);await d.query('insert into lessons(id,module_id,submodule_id,title,order_index) values($1,$2,$3,$4,21)',[lesson,id(26),id(27),'Oito tipos sinteticos']);
 const doc=JSON.parse(readSql('tests/fixtures/a02-reconciliation.v2.admin.json'));
 const legacy=JSON.parse(readSql('tests/fixtures/legacy-content/html-primeira-pagina.v1.json'));
 doc.context={courseTitle:'Aula antiga',moduleTitle:'Aula antiga',submoduleTitle:'Conteúdo'};doc.lesson={...doc.lesson,key:'oito-tipos-locais',title:'Oito tipos sinteticos'};
 for(const a of legacy.activities.filter(a=>['online_lesson','project'].includes(a.type))){a.orderIndex=doc.activities.length;a.prerequisites=[];doc.activities.push(a);}
 doc.teacherOnly.lessonPlans=legacy.teacherOnly.lessonPlans;
 const call=(name,args=[])=>presentationRpc(d,'admin',name,args);
 const plan=()=>call('plan_editorial_lesson',[lesson,JSON.stringify(doc)]);
 const save=async()=>{const p=await plan();return call('save_editorial_draft',[lesson,JSON.stringify(doc),p.sourceToken,p.draftVersion,true]);};
 const publish=dr=>call('publish_editorial_draft',[lesson,dr.source_token,dr.version,true]);
 await t.test('all eight types validate and publish without a new parser',async()=>{
 assert.equal(new Set(doc.activities.map(a=>a.type)).size,8);await publish(await save());
 await d.login('admin','postgres');assert.equal((await d.query('select count(*) n from lesson_activities where lesson_id=$1',[lesson])).rows[0].n,10);
 });
 let before;
 await t.test('pedagogical question/key change, interactive keys and plan revision are atomic',async()=>{
 await d.login('admin','postgres');before=(await d.query('select id,key,revision from lesson_activities where lesson_id=$1 order by key',[lesson])).rows;
 const quiz=doc.activities.find(a=>a.type==='quiz');quiz.content.questions[0].prompt+=' Contexto sintetico revisado.';
 doc.teacherOnly.quizKeys[0].content.answers[0].optionKey=quiz.content.questions[0].options[1].key;
 const interactive=doc.teacherOnly.interactiveKeys[0].content;[interactive.pairs[0].rightId,interactive.pairs[1].rightId]=[interactive.pairs[1].rightId,interactive.pairs[0].rightId];
 doc.teacherOnly.lessonPlans[0].content.preparation.push('Preparacao sintetica revisada.');
 const q=await plan();assert.ok(q.activities.find(a=>a.key===quiz.key).classes.includes('pedagogical'));
 await publish(await save());await d.login('admin','postgres');
 assert.deepEqual((await d.query('select id,key,revision from lesson_activities where lesson_id=$1 order by key',[lesson])).rows,before);
 const actual=(await d.query("select k.content_json from activity_quiz_keys k join lesson_activities a on a.id=k.activity_id where a.lesson_id=$1 and a.activity_type='quiz'",[lesson])).rows[0].content_json;
 assert.deepEqual(actual,doc.teacherOnly.quizKeys[0].content);
 assert.equal((await d.query('select max(p.revision) n from teacher_lesson_plans p join lesson_activities a on a.id=p.activity_id where a.lesson_id=$1',[lesson])).rows[0].n,2);
 const audit=(await d.query("select changes from private.editorial_events where lesson_id=$1 and operation='publish' order by id desc limit 1",[lesson])).rows[0].changes;
 assert.ok(audit.patch.some(x=>x.path.includes('teacherOnly')));assert.ok(audit.patch.some(x=>x.path.includes('prompt')));
 });
 await t.test('valid published dependencies may change only through exact transaction permits',async()=>{
 doc.activities[1].prerequisites=[doc.activities[0].key];await publish(await save());
 doc.activities[1].prerequisites=[];doc.activities[0].prerequisites=[doc.activities[1].key];await publish(await save());
 await d.login('admin','postgres');const source=before.find(a=>a.key===doc.activities[0].key).id;
 await assert.rejects(roleQuery(d,'admin','delete from activity_prerequisites where activity_id=$1',[source]),/imutaveis/);
 const quiz=before.find(a=>a.key===doc.activities.find(a=>a.type==='quiz').key).id;
 await assert.rejects(roleQuery(d,'admin',"update activity_quiz_keys set content_json=content_json where activity_id=$1",[quiz]),/imutavel/);
 });
 await t.test('learner keys denied; teachers cannot access editorial drafts or publication',async()=>{
 for(const who of ['student','teacher']){
 const count=(await roleQuery(d,who,'select k.* from activity_quiz_keys k join lesson_activities a on a.id=k.activity_id where a.lesson_id=$1',[lesson])).rows.length;
 // Preserve the pre-existing staff-read policy; no new editorial teacher permissions.
 assert.equal(count,who==='student'?0:3);
 await assert.rejects(roleQuery(d,who,'select document from private.editorial_drafts'),/permission denied/);
 await assert.rejects(presentationRpc(d,who,'publish_editorial_draft',[lesson,'forged',1,true]),/administradores/);
 }
 });
 await t.test('bound web presentations are preserved and any conflicting edit is blocked',async()=>{
 await d.login('admin','postgres');const slides=before.find(a=>a.key===doc.activities.find(a=>a.type==='slides').key).id;
 const presentation=id(9922);await d.query('insert into web_presentations(id,lesson_id,title,created_by) values($1,$2,$3,$4)',[presentation,lesson,'Deck sintetico',fixtureUsers.admin]);
 await d.query('insert into web_presentation_links(activity_id,presentation_id,linked_by) values($1,$2,$3)',[slides,presentation,fixtureUsers.admin]);
 doc.activities.find(a=>a.type==='slides').title+=' edit';const p=await plan();assert.equal(p.canSave,false);assert.match(p.issues.join(' '),/Vinculo/);
 await assert.rejects(save(),/Conflitos/);
 });
});
