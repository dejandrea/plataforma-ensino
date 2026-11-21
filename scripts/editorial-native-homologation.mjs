import {spawn} from 'node:child_process';
// Local synthetic homologation; reduced-memory execution explicitly authorized.
import {writeFileSync,existsSync,readFileSync} from 'node:fs';
import {freemem,totalmem} from 'node:os';
import {randomBytes} from 'node:crypto';
import {registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
const base='D:/Documentos/Bitaria/HomologacaoEditorial',bin=`${base}/pg17/bin`,data=`${base}/data`;
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const evidence={date:'2026-11-20',environment:'LOCAL_SYNTHETIC_ONLY',reducedMemoryAuthorized:true,startedAt:new Date().toISOString(),memoryBefore:{available:freemem(),total:totalmem()},tests:[],productionAccess:false};
const evidenceFile=`${base}/evidencias/homologacao-integrada-${stamp}.json`;
const save=()=>writeFileSync(evidenceFile,JSON.stringify(evidence,null,2));
function command(exe,args,env=process.env){return new Promise((resolve,reject)=>{const child=spawn(exe,args,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);child.on('error',reject);child.on('exit',code=>code===0?resolve(output):reject(new Error(`${exe.split('/').at(-1)} (${code}): ${output}`)));});}
async function step(name,fn){const start=performance.now();try{if(freemem()<256*1024**2)throw new Error('Memoria disponivel abaixo de 256 MiB; interrompendo de forma controlada.');const details=await fn();evidence.tests.push({name,passed:true,ms:+(performance.now()-start).toFixed(2),availableMemory:freemem(),...details});console.log(`PASS ${name} (${(performance.now()-start).toFixed(0)} ms)`);save();}catch(e){evidence.tests.push({name,passed:false,ms:+(performance.now()-start).toFixed(2),error:e.message});save();throw e;}}
let started=false,d,Native,nativeConnections;
try{
 if(freemem()<512*1024**2)throw new Error('Menos de 512 MiB livres no modo economico; nenhum servidor iniciado.');
 evidence.binaryVersion=(await command(`${bin}/postgres.exe`,['--version'])).trim();assert.match(evidence.binaryVersion,/17\.12/);
 const status=await command(`${bin}/pg_ctl.exe`,['-D',data,'status']).catch(e=>e.message);if(!/no server running|does not exist|não existe|nao existe|nao.*servidor/i.test(status)&&existsSync(`${data}/postmaster.pid`))throw new Error('Cluster ja iniciado: revisar antes de continuar.');
 const net=await import('node:net');await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',reject);probe.listen(55439,'127.0.0.1',()=>probe.close(resolve));});
 if(!existsSync(`${data}/PG_VERSION`)){
  const password=randomBytes(32).toString('base64');
  writeFileSync(`${base}/secrets/initdb-password.txt`,password);writeFileSync(`${base}/secrets/pgpass-local.conf`,`127.0.0.1:55439:*:postgres:${password}\n`);
  await command(`${bin}/initdb.exe`,['-D',data,'-U','postgres','--encoding=UTF8','--locale=C','--auth=scram-sha-256',`--pwfile=${base}/secrets/initdb-password.txt`]);
 }
 writeFileSync(`${data}/postgresql.conf`,"listen_addresses='127.0.0.1'\nport=55439\ncluster_name='bitaria_editorial_homolog_local'\nshared_buffers='32MB'\nwork_mem='1MB'\nmaintenance_work_mem='32MB'\nmax_connections=12\npassword_encryption='scram-sha-256'\nfsync=on\nfull_page_writes=on\nsynchronous_commit=on\nlog_statement='none'\nlog_min_error_statement='panic'\n");
 writeFileSync(`${data}/pg_hba.conf`,'host all all 127.0.0.1/32 scram-sha-256\n');
 await command(`${bin}/pg_ctl.exe`,['-D',data,'-l',`${base}/logs/postgres-homologacao-${stamp}.log`,'-w','start']);started=true;
 ({PGlite:Native,nativeConnections}=await import('../tests/fixtures/native-postgres.mjs'));
 process.env.BITARIA_LOCAL_PG_DATABASE='postgres';let ctl=new Native();
 evidence.server=(await ctl.query("select version(),inet_server_addr()::text as address,inet_server_port() as port,current_setting('data_directory') as data_directory,current_setting('listen_addresses') as listen,current_setting('cluster_name') as cluster")).rows[0];assert.equal(evidence.server.listen,'127.0.0.1');assert.equal(evidence.server.port,55439);
 const dbname=`bitaria_editorial_local_${Date.now()}`;await ctl.exec(`create database ${dbname};`);await ctl.close();process.env.BITARIA_LOCAL_PG_DATABASE=dbname;evidence.database=dbname;
 registerHooks({resolve(specifier,context,next){return specifier==='@electric-sql/pglite'?{url:pathToFileURL(`${process.cwd()}/tests/fixtures/native-postgres.mjs`).href,shortCircuit:true}:next(specifier,context);}});
 const {createPresentationsDb,presentationRpc,roleQuery}=await import('../tests/fixtures/presentations-db.mjs');
 const {prepareLessonPackages,kitTools,packageLesson}=await import('../tests/fixtures/lesson-package-db.mjs');
 const {lessonPackagePipeline,validators}=await import('../tests/fixtures/lesson-package-runtime.mjs');
 const {id,fixtureUsers,readSql,learningMigration}=await import('../tests/fixtures/learning-test-db.mjs');
 const zip=await import('../public/apresentacoes/zip.js');
 await step('Estrutura sintetica e migrations reais anteriores',async()=>{d=await createPresentationsDb();return {pglite:false};});
 // A full migration must roll back even its guard rewrites if a late error occurs.
 const originalExec=d.db.exec.bind(d.db);let rollbackChecked=false;
 d.db.exec=async sql=>{
  if(sql.includes('create table private.editorial_guard_backups')&&!rollbackChecked){rollbackChecked=true;
   await assert.rejects(originalExec(sql.replace(/commit;\s*$/i,'select 1/0;\nrollback;')),/division by zero/);
   const state=(await d.query("select to_regclass('private.editorial_drafts')::text as drafts,to_regprocedure('private.editorial_permitted(text,uuid,jsonb,jsonb)')::text as permit")).rows[0];assert.equal(state.drafts,null);assert.equal(state.permit,null);
  }return originalExec(sql);
 };
 await step('E1a e E2a integradas; rollback de DDL E1a',async()=>{await prepareLessonPackages(d);assert.equal(rollbackChecked,true);});d.db.exec=originalExec;
 const call=(name,args=[],user='admin',role='authenticated')=>presentationRpc(d,user,name,args,role);
 const pipeline=lessonPackagePipeline(d);
 const request=(bytes,lessonId,user='admin')=>pipeline.handle(new Request('http://127.0.0.1/import',{method:'POST',headers:{authorization:`Bearer ${user}`,'x-lesson-id':lessonId,'x-confirmed':'true'},body:bytes}));
 await d.login('admin','postgres');await d.query("insert into profiles(id,role,is_active) values($1,'admin',true)",[id(80000)]);fixtureUsers.admin2=id(80000);
 const baseline=async()=>(await d.query("select jsonb_build_object('xp',(select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from student_xp_events x),'progress',(select jsonb_agg(to_jsonb(x) order by student_id,lesson_id) from student_progress x),'attempts',(select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from quiz_attempts x)) value")).rows[0].value;
 const before=await baseline();
 let serial=81000;
 async function makeReady({types=false}={}){const lesson=id(serial++);await d.login('admin','postgres');await d.query('insert into lessons(id,module_id,submodule_id,title,order_index) values($1,$2,$3,$4,$5)',[lesson,id(26),id(27),'Homologacao sintetica '+serial,serial]);
  const kit=await call('create_lesson_package_kit',[lesson,'https://example.invalid',null]);const bytes=await kitTools.syntheticLessonPackage(kit,zip);const res=await request(bytes,lesson);assert.equal(res.status,200,JSON.stringify(await res.clone().json()));const op=(await call('lesson_package_state',[lesson])).operation;return {lesson,kit,bytes,op};}
 let pack;
 await step('ZIP representativo: falha parcial, retomada, rascunho privado e seguranca',async()=>{
  const kit=await call('create_lesson_package_kit',[packageLesson,'https://example.invalid',null]),bytes=await kitTools.syntheticLessonPackage(kit,zip);
  for(const user of ['student','teacher','inactive']){assert.equal((await request(bytes,packageLesson,user)).status,403);await assert.rejects(call('lesson_package_state',[packageLesson],user),/administradores/);}
  assert.equal((await request(bytes,packageLesson,'unknown')).status,401);await assert.rejects(call('lesson_package_state',[packageLesson],'','anon'),/permission denied/);
  pipeline.failUploadAfter(1);assert.equal((await request(bytes,packageLesson)).status,400);assert.equal((await call('lesson_package_state',[packageLesson])).operation.status,'preparing');pipeline.failUploadAfter(Infinity);
  const response=await request(bytes,packageLesson);assert.equal(response.status,200,JSON.stringify(await response.clone().json()));const op=(await call('lesson_package_state',[packageLesson])).operation;
  assert.equal(op.status,'ready');assert.equal(op.intents.length,2);assert.equal((await d.query('select count(*)::int n from lesson_activities where lesson_id=$1',[packageLesson])).rows[0].n,0);
  assert.equal((await d.query('select count(*)::int n from web_presentations where lesson_id=$1 and active_version_id is not null',[packageLesson])).rows[0].n,0);
  await assert.rejects(roleQuery(d,'admin','select * from private.editorial_drafts'),/permission denied/);await assert.rejects(roleQuery(d,'admin','select * from private.lesson_package_operations'),/permission denied/);
  await assert.rejects(roleQuery(d,'admin',"insert into private.editorial_permits values(txid_current(),'activity',$1,'{}','{}')",[packageLesson]),/permission denied/);
  await assert.rejects(roleQuery(d,'admin','insert into private.lesson_package_commit_permits values(txid_current(),$1,$2,1,$3)',[op.id,packageLesson,'forged']),/permission denied/);
  assert.equal((await roleQuery(d,'student','select * from activity_quiz_keys')).rows.length,0);
  pack={lesson:packageLesson,kit,bytes,op};return {zipBytes:bytes.length,activities:op.document.activities.length,types:[...new Set(op.document.activities.map(a=>a.type))],decks:op.intents.length};
 });
 const publish=(p,user='admin')=>call('publish_lesson_package',[p.op.id,p.op.draft_version,true],user);
 await step('Rollback tardio da publicacao coordenada e ausencia de permits residuais',async()=>{
  await d.login('admin','postgres');await d.db.exec("create function public.fail_native_bind() returns trigger language plpgsql as $$begin raise exception 'native synthetic bind failure';end$$; create trigger fail_native_bind before insert on web_presentation_links for each row execute function public.fail_native_bind();");
  await assert.rejects(publish(pack),/native synthetic bind failure/);assert.equal((await d.query('select count(*)::int n from lesson_activities where lesson_id=$1',[pack.lesson])).rows[0].n,0);assert.equal((await call('lesson_package_state',[pack.lesson])).operation.status,'ready');await d.db.exec('drop trigger fail_native_bind on web_presentation_links;drop function public.fail_native_bind();');
  assert.equal((await d.query('select (select count(*) from private.editorial_permits)+(select count(*) from private.lesson_package_commit_permits) as n')).rows[0].n,0);
 });
 await step('A: publicacao natural, vinculos e reimportacao idempotente',async()=>{
  const start=performance.now(),result=await publish(pack),publishMs=performance.now()-start;assert.equal(result.presentations,2);assert.deepEqual(await publish(pack),result);assert.equal((await request(pack.bytes,pack.lesson)).status,200);
  assert.equal((await d.query('select count(*)::int n from lesson_activities where lesson_id=$1',[pack.lesson])).rows[0].n,9);return {publicationMs:+publishMs.toFixed(2)};
 });
 // Further independent-session concurrency cases are appended below.
 await runConcurrency({d,Native,call,makeReady,publish,id,fixtureUsers,step,evidence});
 await d.login('admin','postgres');
 await step('XP, progresso e tentativas anteriores preservados',async()=>{assert.deepEqual(await baseline(),before);});
 await step('Compatibilidade real: A02, importador v1 e ZIP web legado',async()=>{
  const a02=JSON.parse(readFileSync('tests/fixtures/a02-reconciliation.v2.admin.json','utf8'));
  const plan=await call('plan_a02_reconciliation',[JSON.stringify(a02)]);assert.equal((await call('apply_a02_reconciliation',[JSON.stringify(a02),plan.token,true])).newActivityIds.length,2);
  const target=id(serial++);await d.login('admin','postgres');await d.query('insert into lessons(id,module_id,submodule_id,title,order_index) values($1,$2,$3,$4,$5)',[target,id(26),id(27),'Legado sintetico',serial]);
  const legacy=JSON.parse(readFileSync('docs/examples/html-primeira-pagina.v1.json','utf8'));legacy.context=pack.kit.context;legacy.lesson.title='Legado sintetico';
  assert.equal((await call('import_learning_lesson',[target,JSON.stringify(legacy),true])).activityIds.length,5);
  const bytes=zip.createStoredZip([{path:'apresentacao.json',data:JSON.stringify({schemaVersion:1,title:'Legado sintetico',slides:[{type:'concept',title:'Conceito',body:'Conteudo sintetico.'}]})}]);
  const res=await pipeline.legacyHandle(new Request('http://127.0.0.1/import',{method:'POST',headers:{authorization:'Bearer admin','x-lesson-id':target},body:bytes}));assert.equal(res.status,200,JSON.stringify(await res.clone().json()));const web=await res.json();
  await call('publish_web_presentation',[web.presentationId,web.versionId,null,true]);const activity=(await d.query("select id from lesson_activities where lesson_id=$1 and activity_type='slides'",[target])).rows[0].id;
  await call('bind_web_presentation',[web.presentationId,activity,null,true]);
  assert.equal((await d.query('select presentation_id from web_presentation_links where activity_id=$1',[activity])).rows[0].presentation_id,web.presentationId);
 });
 await step('Capacidade editorial: 200 atividades e Unicode em documento representativo',async()=>{
  const lesson=id(serial++);await d.login('admin','postgres');await d.query('insert into lessons(id,module_id,submodule_id,title,order_index) values($1,$2,$3,$4,$5)',[lesson,id(26),id(27),'Capacidade sintetica',serial]);
  const doc=JSON.parse(readFileSync('docs/examples/html-primeira-pagina.v1.json','utf8'));doc.context=pack.kit.context;doc.lesson.title='Capacidade sintetica';doc.lesson.key='capacidade-sintetica';
  const slide=doc.activities[0];doc.activities=Array.from({length:200},(_,i)=>({...structuredClone(slide),key:`slide-${i}`,orderIndex:i,content:{...slide.content,altText:'á'.repeat(4000)}}));doc.teacherOnly={quizKeys:[],lessonPlans:[]};
  const t=performance.now(),valid=validators.validateLessonImport(doc);assert.equal(valid.valid,true,JSON.stringify(valid.errors));const validationMs=performance.now()-t;
  const p0=performance.now(),plan=await call('plan_editorial_lesson',[lesson,JSON.stringify(doc)]),planMs=performance.now()-p0;
  const s0=performance.now(),draft=await call('save_editorial_draft',[lesson,JSON.stringify(doc),plan.sourceToken,plan.draftVersion,true]),saveMs=performance.now()-s0;
  const p1=performance.now();await call('publish_editorial_draft',[lesson,draft.source_token,draft.version,true]);const publicationMs=performance.now()-p1;
  assert.equal((await d.query('select count(*)::int n from lesson_activities where lesson_id=$1',[lesson])).rows[0].n,200);
  return {activities:200,normalizedBytes:validators.lessonDocumentBytes(doc),fileBytes:Buffer.byteLength(JSON.stringify(doc)),validationMs,planMs,saveMs,publicationMs};
 });
 await step('UTF-8: cliente e PostgreSQL concordam inclusive no limite',async()=>{
  const sample={text:'á漢😀\n"\\',list:[null,true,10,{space:'a, b: c'}]};assert.equal(validators.lessonDocumentBytes(sample),(await d.query('select octet_length($1::jsonb::text) n',[JSON.stringify(sample)])).rows[0].n);
  for(const delta of [-1,0,1]){const v={text:'á'.repeat(900000),tail:''};const overhead=validators.lessonDocumentBytes(v);v.tail='a'.repeat(2_000_000-overhead+delta);const js=validators.lessonDocumentBytes(v),pg=(await d.query('select octet_length($1::jsonb::text) n',[JSON.stringify(v)])).rows[0].n;assert.equal(js,pg);assert.equal(js,2_000_000+delta);if(delta>0)await assert.rejects(d.query('select private.learning_validate_document($1::jsonb)',[JSON.stringify(v)]),/bytes UTF-8/);}
 });
 evidence.result='completed';
}catch(error){evidence.result='failed';evidence.error=error.stack;console.error(error.message);process.exitCode=1;}
finally{
 if(nativeConnections)for(const connection of [...nativeConnections])await connection.close().catch(()=>{});
 if(started){try{await command(`${bin}/pg_ctl.exe`,['-D',data,'-m','fast','-w','stop']);evidence.controlledShutdown=true;}catch(e){evidence.shutdownError=e.message;process.exitCode=1;}}
 evidence.memoryAfter={available:freemem(),total:totalmem()};evidence.endedAt=new Date().toISOString();save();console.log(`Evidence: ${evidenceFile}`);
}

async function runConcurrency({d,Native,call,makeReady,publish,id,fixtureUsers,step:recordStep,evidence}){
 const sessions=[];
 const step=(name,fn)=>recordStep(name,async()=>{try{return await fn();}finally{for(const c of sessions){if(!c.closed){await c.exec('rollback;').catch(()=>{});await c.close();c.closed=true;}}}});
 async function session(user='admin'){const c=new Native();sessions.push(c);await c.exec('begin; set local role authenticated;');await c.query("select set_config('request.jwt.claim.sub',$1,true)",[fixtureUsers[user]]);c.pid=(await c.query('select pg_backend_pid() pid')).rows[0].pid;return c;}
 const rpc=(c,name,args=[])=>c.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) value`,args).then(x=>x.rows[0].value);
 const pub=(c,p)=>rpc(c,'publish_lesson_package',[p.op.id,p.op.draft_version,true]);
 async function blocked(pid){for(let i=0;i<100;i++){const row=(await d.query('select pid,wait_event_type,wait_event,pg_blocking_pids(pid) blockers from pg_stat_activity where pid=$1',[pid])).rows[0];if(row?.wait_event_type==='Lock'&&row.blockers.length)return row;await new Promise(r=>setTimeout(r,20));}throw new Error(`No observed lock wait for ${pid}`);}
 async function editorial(){const p=await makeReady();await publish(p);const doc=(await call('admin_editorial_lesson',[p.lesson])).document;doc.activities.find(a=>a.type==='mindmap').title+=' atualizado';const plan=await call('plan_editorial_lesson',[p.lesson,JSON.stringify(doc)]),draft=await call('save_editorial_draft',[p.lesson,JSON.stringify(doc),plan.sourceToken,plan.draftVersion,true]);
  const rows=(await d.query('select id,activity_type,revision from lesson_activities where lesson_id=$1',[p.lesson])).rows;return {...p,doc,draft,study:rows.find(a=>a.activity_type==='slides'),live:rows.find(a=>a.activity_type==='online_lesson')};}
 const pubEditorial=(c,p)=>rpc(c,'publish_editorial_draft',[p.lesson,p.draft.source_token,p.draft.version,true]);
 try{
 await step('B: leitura de outra aula aguarda publicacao e retoma apos COMMIT',async()=>{
  const p=await makeReady(),a=await session(),b=await session('student');await pub(a,p);let done=false;const pending=b.query('select title from lessons where id=$1',[id(24)]).then(x=>{done=true;return x;});
  const wait=await blocked(b.pid);assert.equal(done,false);await a.exec('commit;');assert.ok((await pending).rows.length);await b.exec('rollback;');return {pids:[a.pid,b.pid],wait,artificialHold:true};
 });
 await step('C1: aluno primeiro; publicacao aguarda e recusa historico confirmado',async()=>{
  const p=await editorial(),student=await session('student'),admin=await session();await rpc(student,'start_student_activity',[p.study.id]);
  const pending=pubEditorial(admin,p).then(value=>({value}),error=>({error}));const wait=await blocked(admin.pid);await student.exec('commit;');const result=await pending;assert.match(result.error?.message??'',/historico/);await admin.exec('rollback;');return {pids:[student.pid,admin.pid],wait};
 });
 await step('C2: publicacao primeiro; inicio do aluno aguarda e utiliza conteudo final',async()=>{
  const p=await editorial(),admin=await session(),student=await session('student');await pubEditorial(admin,p);const pending=rpc(student,'start_student_activity',[p.study.id]);const wait=await blocked(student.pid);await admin.exec('commit;');const progress=await pending;assert.equal(progress.activity_revision,p.study.revision);await student.exec('rollback;');assert.equal((await d.query('select title from lesson_activities where lesson_id=$1 and key=$2',[p.lesson,p.doc.activities.find(a=>a.type==='mindmap').key])).rows[0].title,p.doc.activities.find(a=>a.type==='mindmap').title);return {pids:[admin.pid,student.pid],wait};
 });
 await step('D1: sessao docente primeiro; publicacao recusa historico sem plano obsoleto',async()=>{
  const p=await editorial(),teacher=await session('teacher'),admin=await session();assert.ok(p.live);await rpc(teacher,'link_teacher_learning_activity',[id(17),p.live.id]);const pending=pubEditorial(admin,p).then(value=>({value}),error=>({error}));const wait=await blocked(admin.pid);await teacher.exec('commit;');const result=await pending;assert.match(result.error?.message??'',/historico/);await admin.exec('rollback;');return {pids:[teacher.pid,admin.pid],wait};
 });
 await step('D2: publicacao primeiro; sessao docente aguarda e fixa revisao final',async()=>{
  const p=await editorial(),admin=await session(),teacher=await session('teacher');await pubEditorial(admin,p);const pending=rpc(teacher,'link_teacher_learning_activity',[id(17),p.live.id]);const wait=await blocked(teacher.pid);await admin.exec('commit;');const workspace=await pending;assert.ok(workspace.sessions.some(s=>s.activity_id===p.live.id&&s.plan_revision===1));await teacher.exec('rollback;');return {pids:[admin.pid,teacher.pid],wait};
 });
 await step('E1: dois administradores nao sobrescrevem rascunho concorrente',async()=>{
  const p=await makeReady(),document=structuredClone(p.op.document);document.activities[0].title+=' revisao';const plan=await call('plan_editorial_lesson',[p.lesson,JSON.stringify(document)]);
  const a=await session(),b=await session('admin2'),args=[p.lesson,JSON.stringify(document),plan.sourceToken,plan.draftVersion,true];await rpc(a,'save_editorial_draft',args);const pending=rpc(b,'save_editorial_draft',args).then(value=>({value}),error=>({error}));const wait=await blocked(b.pid);await a.exec('commit;');const result=await pending;assert.match(result.error?.message??'',/Concorrencia/);await b.exec('rollback;');return {pids:[a.pid,b.pid],wait};
 });
 await step('E2: dois administradores publicam uma unica operacao idempotente',async()=>{
  const p=await makeReady(),a=await session(),b=await session('admin2');const first=await pub(a,p);const pending=pub(b,p);const wait=await blocked(b.pid);await a.exec('commit;');assert.deepEqual(await pending,first);await b.exec('commit;');assert.equal((await d.query('select count(*)::int n from lesson_activities where lesson_id=$1',[p.lesson])).rows[0].n,9);return {pids:[a.pid,b.pid],wait};
 });
 await step('F: lock_timeout real, rollback completo e retomada',async()=>{
  const p=await makeReady(),reader=await session('student'),admin=await session();await reader.query('select title from lessons where id=$1',[id(24)]);const start=performance.now();const pending=pub(admin,p).then(value=>({value}),error=>({error}));const wait=await blocked(admin.pid),result=await pending,waitMs=performance.now()-start;assert.equal(result.error?.code,'55P03');assert.ok(waitMs>=4800);await admin.exec('rollback;');await reader.exec('rollback;');assert.equal((await call('lesson_package_state',[p.lesson])).operation.status,'ready');assert.equal((await d.query('select count(*)::int n from lesson_activities where lesson_id=$1',[p.lesson])).rows[0].n,0);await publish(p);return {pids:[reader.pid,admin.pid],wait,waitMs:+waitMs.toFixed(2)};
 });
 }finally{for(const c of sessions){await c.exec('rollback;').catch(()=>{});await c.close();}}
 evidence.distinctPids=[...new Set(sessions.map(c=>c.pid))];
}
