import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPresentationsDb,presentationRpc,roleQuery} from './fixtures/presentations-db.mjs';
import {prepareLessonPackages,packageLesson,kitTools} from './fixtures/lesson-package-db.mjs';
import {lessonPackagePipeline} from './fixtures/lesson-package-runtime.mjs';
import {fixtureUsers,id} from './fixtures/learning-test-db.mjs';
import * as zip from '../public/apresentacoes/zip.js';
import {lessonPackageLimits} from '../public/apresentacoes/lesson-package.js';
import {zipFiles} from './fixtures/presentation-package.mjs';
import {readFileSync} from 'node:fs';

test('real coordinator and SQL: resumable private draft, atomic automatic links, authorization and no XP',{timeout:180000},async t=>{
 const d=await createPresentationsDb();t.after(()=>d.db.close());await prepareLessonPackages(d);
 assert.deepEqual((await d.query('select private.lesson_package_schema() value')).rows[0].value,JSON.parse(readFileSync('src/contracts/lesson-package.v1.schema.json','utf8')));
 const call=(name,args=[],who='admin',role='authenticated')=>presentationRpc(d,who,name,args,role);
 const kit=await call('create_lesson_package_kit',[packageLesson,'https://example.invalid',null]);
 const bytes=readFileSync('docs/examples/unified-lesson-package/pacote-sintetico-completo.zip');assert.equal(await zip.sha256(bytes),await zip.sha256(await kitTools.syntheticLessonPackage(kit,zip)));const pipeline=lessonPackagePipeline(d);
 const request=(who='admin',input=bytes,lessonId=packageLesson)=>pipeline.handle(new Request('http://local/import',{method:'POST',headers:{authorization:`Bearer ${who}`,'x-lesson-id':lessonId,'x-confirmed':'true'},body:input}));
 const state=()=>call('lesson_package_state',[packageLesson]);
 const count=async table=>{await d.login('admin','postgres');return (await d.query(`select count(*) n from ${table}`)).rows[0].n;};
 const xpBefore=await count('student_xp_events');
 async function changedDocument(mutate,productionId){
 const files=Object.fromEntries((await zip.readZipArchive(bytes,lessonPackageLimits,()=>({limit:10e6}))).map(f=>[f.path,f.data]));
 const manifest=JSON.parse(new TextDecoder().decode(files['manifest.json'])),doc=JSON.parse(new TextDecoder().decode(files['aula.json']));mutate(doc);if(productionId)manifest.productionId=productionId;
 files['aula.json']=new TextEncoder().encode(JSON.stringify(doc));const ref=manifest.files.find(f=>f.path==='aula.json');ref.bytes=files['aula.json'].length;ref.sha256=await zip.sha256(files['aula.json']);files['manifest.json']=JSON.stringify(manifest);return zipFiles(files);
 }
 assert.equal((await request('unknown')).status,401);
 await assert.rejects(call('lesson_package_state',[packageLesson],'','anon'),/permission denied/);
 for(const who of ['student','teacher','inactive']){assert.equal((await request(who)).status,403);await assert.rejects(call('lesson_package_state',[packageLesson],who),/administradores/);}
 await assert.rejects(roleQuery(d,'admin','select * from private.lesson_package_operations'),/permission denied/);
 await assert.rejects(call('begin_lesson_package',[fixtureUsers.admin,packageLesson,'{}','{}','0'.repeat(64),'0'.repeat(64),'[]']),/permission denied/);
 await t.test('wrong context/key fail before any preparation; inactive administrator denied',async()=>{
 for(const mutate of [doc=>{doc.context.courseTitle='wrong';},doc=>{doc.lesson.key='wrong-key';}])assert.equal((await request('admin',await changedDocument(mutate))).status,400);
 assert.equal(await count('private.lesson_package_operations'),0);
 await d.query("update profiles set role='admin' where id=$1",[fixtureUsers.inactive]);assert.equal((await request('inactive')).status,403);await assert.rejects(call('lesson_package_state',[packageLesson],'inactive'),/administradores/);await d.query("update profiles set role='student' where id=$1",[fixtureUsers.inactive]);
 });
 await t.test('failure after partial upload is private and recoverable',async()=>{
 pipeline.failUploadAfter(1);const response=await request();assert.equal(response.status,400,JSON.stringify(await response.clone().json()));
 const s=await state();assert.equal(s.operation.status,'preparing');assert.ok(s.operation.last_error);assert.equal(s.operation.intents.length,2);assert.equal(pipeline.objects.size,1);
 await d.login('admin','postgres');assert.equal((await d.query('select count(*) n from lesson_activities where lesson_id=$1',[packageLesson])).rows[0].n,0);
 assert.equal((await d.query('select draft_version from private.lesson_package_operations')).rows[0].draft_version,null);
 });
 await t.test('resume same package and restore draft without any public activity or active deck',async()=>{
 pipeline.failUploadAfter(Infinity);const response=await request();assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
 const s=await state();assert.equal(s.operation.status,'ready');assert.equal(s.operation.draft_version,1);
 assert.equal((await d.query('select count(*) n from lesson_activities where lesson_id=$1',[packageLesson])).rows[0].n,0);
 assert.equal((await d.query('select count(*) n from web_presentations where lesson_id=$1 and active_version_id is not null',[packageLesson])).rows[0].n,0);
 assert.equal((await d.query('select count(*) n from web_presentation_links')).rows[0].n,0);
 const repacked=zipFiles(Object.fromEntries((await zip.readZipArchive(bytes,lessonPackageLimits,()=>({limit:10e6}))).map(f=>[f.path,f.data])));
 assert.equal((await request('admin',repacked)).status,200);assert.equal((await state()).operation.draft_version,1);assert.equal(pipeline.objects.size,4);
 const changed=await request('admin',await changedDocument(doc=>{doc.activities[0].title+=' changed';}));assert.equal(changed.status,400);assert.match((await changed.json()).error,/productionId/);
 });
 let op=(await state()).operation;
 await t.test('independent E1/web publication and forged commit permits are blocked',async()=>{
 const draft=(await call('admin_editorial_lesson',[packageLesson])).draft;
 await assert.rejects(call('publish_editorial_draft',[packageLesson,draft.source_token,draft.version,true]),/reservada|pacote/);
 await assert.rejects(call('publish_web_presentation',[op.intents[0].presentation_id,op.intents[0].version_id,null,true]),/reservada/);
 await assert.rejects(roleQuery(d,'admin','insert into private.lesson_package_commit_permits values(txid_current(),$1,$2,1,$3)',[op.id,packageLesson,draft.source_token]),/permission denied/);
 assert.equal(await count('private.lesson_package_commit_permits'),0);
 });
 await t.test('history appearing after save prevents publication and leaves previous state intact',async()=>{
 await d.login('admin','postgres');await d.query('insert into student_progress(student_id,lesson_id) values($1,$2)',[fixtureUsers.student,packageLesson]);
 await assert.rejects(call('publish_lesson_package',[op.id,op.draft_version,true]),/historico/);
 await d.login('admin','postgres');assert.equal((await state()).operation.status,'ready');await d.query('delete from student_progress where student_id=$1 and lesson_id=$2',[fixtureUsers.student,packageLesson]);
 });
 await t.test('publication late failure rolls back activities, active versions, links and draft',async()=>{
 await d.login('admin','postgres');await d.db.exec(`create function public.fail_package_bind() returns trigger language plpgsql as $$begin raise exception 'synthetic bind failure';end$$;create trigger fail_package_bind before insert on web_presentation_links for each row execute function public.fail_package_bind();`);
 await assert.rejects(call('publish_lesson_package',[op.id,op.draft_version,true]),/synthetic bind failure/);
 await d.login('admin','postgres');assert.equal((await d.query('select count(*) n from lesson_activities where lesson_id=$1',[packageLesson])).rows[0].n,0);
 assert.equal((await d.query('select count(*) n from web_presentations where lesson_id=$1 and active_version_id is not null',[packageLesson])).rows[0].n,0);
 assert.equal((await state()).operation.status,'ready');assert.equal(await count('private.editorial_permits'),0);
 assert.equal(await count('private.lesson_package_commit_permits'),0);
 await d.db.exec('drop trigger fail_package_bind on web_presentation_links;drop function public.fail_package_bind();');
 });
 await t.test('single RPC publishes all and binds automatically; no curriculum publication or XP',async()=>{
 const before=(await d.query('select publication_status from lessons where id=$1',[packageLesson])).rows[0];
 for(const who of ['student','teacher'])await assert.rejects(call('publish_lesson_package',[op.id,op.draft_version,true],who),/administradores/);
 await assert.rejects(call('publish_lesson_package',[op.id,op.draft_version,false]),/Confirme/);
 const receipt=await call('publish_lesson_package',[op.id,op.draft_version,true]);assert.equal(receipt.presentations,2);
 assert.deepEqual(await call('publish_lesson_package',[op.id,op.draft_version,true]),receipt);assert.equal((await request()).status,200);
 await d.login('admin','postgres');assert.equal((await d.query('select count(*) n from lesson_activities where lesson_id=$1',[packageLesson])).rows[0].n,9);
 assert.equal((await d.query('select count(*) n from web_presentation_links l join lesson_activities a on a.id=l.activity_id where a.lesson_id=$1',[packageLesson])).rows[0].n,2);
 assert.deepEqual((await d.query('select publication_status from lessons where id=$1',[packageLesson])).rows[0],before);
 assert.equal(await count('student_xp_events'),xpBefore);assert.equal(await count('private.editorial_permits'),0);
 assert.equal(await count('private.lesson_package_commit_permits'),0);
 await assert.rejects(call('create_lesson_package_kit',[packageLesson,'https://example.invalid',null]),/vazia/);
 assert.equal((await roleQuery(d,'student','select * from activity_quiz_keys')).rows.length,0);
 assert.equal((await state()).eligible,false);
 });
 await t.test('legacy materials, existing presentations and another editorial draft are not empty lessons',async()=>{
 await d.login('admin','postgres');
 for(const n of [9942,9943,9944])await d.query('insert into lessons(id,module_id,submodule_id,title,order_index) values($1,$2,$3,$4,$5)',[id(n),id(26),id(27),'Outra aula sintetica '+n,n]);
 await d.query('update lessons set slides_url=$1 where id=$2',['https://drive.google.com/file/d/legado-sintetico/view',id(9942)]);
 await assert.rejects(call('create_lesson_package_kit',[id(9942),'https://example.invalid',null]),/legados/);
 await d.query('insert into web_presentations(id,lesson_id,title,created_by) values($1,$2,$3,$4)',[id(9950),id(9943),'Deck anterior',fixtureUsers.admin]);
 await assert.rejects(call('create_lesson_package_kit',[id(9943),'https://example.invalid',null]),/anteriores/);
 const target=id(9944),kit2=await call('create_lesson_package_kit',[target,'https://example.invalid',null]);
 const copy=structuredClone(op.document);copy.lesson.key=kit2.lesson_key;copy.lesson.title=kit2.lesson.title;
 const plan=await call('plan_editorial_lesson',[target,JSON.stringify(copy)]);await call('save_editorial_draft',[target,JSON.stringify(copy),plan.sourceToken,plan.draftVersion,true]);
 await assert.rejects(call('create_lesson_package_kit',[target,'https://example.invalid',null]),/rascunho/);
 });
 await t.test('another administrator changing the ready editorial draft blocks the coordinated publication',async()=>{
 await d.login('admin','postgres');const target=id(9945);await d.query('insert into lessons(id,module_id,submodule_id,title,order_index) values($1,$2,$3,$4,45)',[target,id(26),id(27),'Concorrencia sintetica']);
 const kit2=await call('create_lesson_package_kit',[target,'https://example.invalid',null]);const bytes2=await kitTools.syntheticLessonPackage(kit2,zip);assert.equal((await request('admin',bytes2,target)).status,200);
 const s=await call('lesson_package_state',[target]);const copy=structuredClone(s.operation.document);copy.activities[0].title+=' alterado';const plan=await call('plan_editorial_lesson',[target,JSON.stringify(copy)]);
 await call('save_editorial_draft',[target,JSON.stringify(copy),plan.sourceToken,plan.draftVersion,true]);
 await assert.rejects(call('publish_lesson_package',[s.operation.id,s.operation.draft_version,true]),/rascunho|alterado/i);
 await d.login('admin','postgres');assert.equal((await d.query('select count(*) n from lesson_activities where lesson_id=$1',[target])).rows[0].n,0);assert.equal(await count('private.lesson_package_commit_permits'),0);
 });
 await t.test('legacy v1, A02 and web manager coexist with installed E1a/E2a reservation guards',async()=>{
 await d.login('admin','postgres');const a02=JSON.parse(readFileSync('tests/fixtures/a02-reconciliation.v2.admin.json','utf8'));
 const plan=await call('plan_a02_reconciliation',[JSON.stringify(a02)]);const reconciliation=await call('apply_a02_reconciliation',[JSON.stringify(a02),plan.token,true]);assert.equal(reconciliation.newActivityIds.length,2);
 const target=id(9951);await d.query('insert into lessons(id,module_id,submodule_id,title,order_index) values($1,$2,$3,$4,51)',[target,id(26),id(27),'Inclusao legada sintetica']);
 const legacy=JSON.parse(readFileSync('docs/examples/html-primeira-pagina.v1.json','utf8'));legacy.context=kit.context;legacy.lesson.title='Inclusao legada sintetica';
 const imported=await call('import_learning_lesson',[target,JSON.stringify(legacy),true]);assert.equal(imported.activityIds.length,5);
 const deck=zip.createStoredZip([{path:'apresentacao.json',data:JSON.stringify({schemaVersion:1,title:'Apresentacao legada sintetica',slides:[{type:'concept',title:'Conceito',body:'Exemplo de fluxo anterior preservado.'}]})}]);
 const response=await pipeline.legacyHandle(new Request('http://local/import',{method:'POST',headers:{authorization:'Bearer admin','x-lesson-id':target},body:deck}));assert.equal(response.status,200,JSON.stringify(await response.clone().json()));const web=await response.json();
 await call('publish_web_presentation',[web.presentationId,web.versionId,null,true]);
 const activity=(await d.query("select id from lesson_activities where lesson_id=$1 and activity_type='slides'",[target])).rows[0].id;
 await call('bind_web_presentation',[web.presentationId,activity,null,true]);assert.equal((await d.query('select presentation_id from web_presentation_links where activity_id=$1',[activity])).rows[0].presentation_id,web.presentationId);
 assert.equal(await count('student_xp_events'),xpBefore);
 });
});
