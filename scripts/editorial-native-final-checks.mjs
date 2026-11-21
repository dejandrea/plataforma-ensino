import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {PGlite,nativeConnections} from '../tests/fixtures/native-postgres.mjs';
const base='D:/Documentos/Bitaria/HomologacaoEditorial';
const prior=JSON.parse(readFileSync(`${base}/evidencias/homologacao-integrada-2026-11-20T03-39-17-607Z.json`,'utf8'));
process.env.BITARIA_LOCAL_PG_DATABASE=prior.database;
const output={environment:'LOCAL_SYNTHETIC_ONLY',database:prior.database,startedAt:new Date().toISOString(),tests:[],productionAccess:false};
const command=args=>new Promise((resolve,reject)=>{const p=spawn(`${base}/pg17/bin/pg_ctl.exe`,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let s='';p.stdout.on('data',v=>s+=v);p.stderr.on('data',v=>s+=v);p.on('error',reject);p.on('exit',c=>c?reject(new Error(s)):resolve(s));});
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let started=false;
async function step(name,fn){const t=performance.now();try{const details=await fn();output.tests.push({name,passed:true,ms:performance.now()-t,...details});console.log(`PASS ${name}`);}catch(e){output.tests.push({name,passed:false,error:e.message});throw e;}}
try{
 await command(['-D',`${base}/data`,'-l',`${base}/logs/final-checks-20261120.log`,'-w','start']);started=true;
 const db=new PGlite();
 const rpc=async(c,name,args)=> (await c.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) value`,args)).rows[0].value;
 await step('ACLs efetivas, owner, search_path, RLS, admin inativo e auditoria imutavel',async()=>{
  const functions=(await db.query("select p.oid::regprocedure::text signature, p.prosecdef, p.proconfig, r.rolname owner, has_function_privilege('anon',p.oid,'execute') anon_execute, has_function_privilege('authenticated',p.oid,'execute') authenticated_execute from pg_proc p join pg_roles r on r.oid=p.proowner join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('admin_editorial_lesson','plan_editorial_lesson','save_editorial_draft','publish_editorial_draft','lesson_package_state','create_lesson_package_kit','publish_lesson_package')")).rows;
  assert.equal(functions.length,7);for(const f of functions){assert.equal(f.anon_execute,false);assert.equal(f.authenticated_execute,true);assert.equal(f.prosecdef,true);assert.equal(f.owner,'postgres');assert.ok(f.proconfig.some(v=>v.startsWith('search_path=')));}
  const tables=(await db.query("select c.relname,c.relrowsecurity,has_table_privilege('authenticated',c.oid,'select,insert,update,delete') authenticated_access,has_table_privilege('anon',c.oid,'select,insert,update,delete') anon_access from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r' and (c.relname like 'editorial_%' or c.relname like 'lesson_package_%')")).rows;
  assert.ok(tables.length>=8);for(const t of tables){assert.equal(t.relrowsecurity,true);assert.equal(t.authenticated_access,false);assert.equal(t.anon_access,false);}
  await db.query("update profiles set role='admin' where id=$1",[id(6)]);
  const inactive=new PGlite();await inactive.exec('begin;set local role authenticated;');await inactive.query("select set_config('request.jwt.claim.sub',$1,true)",[id(6)]);
  await assert.rejects(rpc(inactive,'lesson_package_state',[id(9925)]),/administradores/);await inactive.exec('rollback;');await inactive.close();await db.query("update profiles set role='student' where id=$1",[id(6)]);
  await assert.rejects(db.query('update private.editorial_events set operation=operation'),/imut|immutable|historico/i);
  return {functions,tables};
 });
 await step('Perda real de conexao reverte transacao e libera locks',async()=>{
  const c=new PGlite();await c.exec('begin;');const pid=(await c.query('select pg_backend_pid() pid')).rows[0].pid;
  const before=(await db.query('select title from lessons where id=$1',[id(9925)])).rows[0].title;
  await c.query('update lessons set title=$1 where id=$2',['Operacao sintetica interrompida',id(9925)]);
  assert.equal((await db.query('select pg_terminate_backend($1) terminated',[pid])).rows[0].terminated,true);
  for(let i=0;i<100;i++){if(!(await db.query('select pid from pg_stat_activity where pid=$1',[pid])).rows.length)break;await new Promise(r=>setTimeout(r,20));}
  assert.equal((await db.query('select title from lessons where id=$1',[id(9925)])).rows[0].title,before);
  assert.equal((await db.query('select count(*)::int n from pg_locks where pid=$1',[pid])).rows[0].n,0);
  return {terminatedSyntheticPid:pid};
 });
 output.result='completed';
}catch(e){output.result='failed';output.error=e.stack;console.error(e.message);process.exitCode=1;}
finally{
 for(const c of [...nativeConnections])await c.close().catch(()=>{});
 if(started){await command(['-D',`${base}/data`,'-m','fast','-w','stop']);output.controlledShutdown=true;}
 output.endedAt=new Date().toISOString();writeFileSync(`${base}/evidencias/verificacoes-finais-20261120.json`,JSON.stringify(output,null,2));
}
