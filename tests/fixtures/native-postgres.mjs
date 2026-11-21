// Real PostgreSQL through persistent psql connections, no new npm driver.
// Credentials are read only by psql from the restricted external pgpass file.
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const base='D:/Documentos/Bitaria/HomologacaoEditorial';
export const nativeConnections=new Set();
export class PGlite {
 constructor(){
  const env={...process.env,PGPASSFILE:`${base}/secrets/pgpass-local.conf`,PGCLIENTENCODING:'UTF8',PGAPPNAME:'bitaria_editorial_local_test'};
  for(const k of ['PGHOST','PGHOSTADDR','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGSERVICE','PGSERVICEFILE','PGOPTIONS'])delete env[k];
  this.child=spawn(`${base}/pg17/bin/psql.exe`,['-X','-q','-A','-t','-w','-h','127.0.0.1','-p','55439','-U','postgres','-d',process.env.BITARIA_LOCAL_PG_DATABASE??'bitaria_editorial_local_20261117','-v','VERBOSITY=verbose'],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});
  this.tail=Promise.resolve();this.out='';this.err='';this.pending=null;
  this.child.stdout.setEncoding('utf8');this.child.stderr.setEncoding('utf8');
  this.child.stdout.on('data',s=>{this.out+=s;this.flush();});
  this.child.stderr.on('data',s=>{this.err+=s;this.flush();});
  this.child.on('error',e=>this.pending?.reject(e));
  this.child.on('exit',code=>{nativeConnections.delete(this);this.pending?.reject(new Error(`psql closed (${code})`));});
  nativeConnections.add(this);
 }
 flush(){const p=this.pending;if(!p||!this.out.includes(p.mark)||!this.err.includes(p.mark))return;
  const stdout=this.out.slice(0,this.out.indexOf(p.mark)).trim(),stderr=this.err.slice(0,this.err.indexOf(p.mark)).trim();
  this.out=this.out.slice(this.out.indexOf(p.mark)+p.mark.length).replace(/^\r?\n/,'');this.err=this.err.slice(this.err.indexOf(p.mark)+p.mark.length).replace(/^\r?\n/,'');this.pending=null;
  if(/ERROR:|FATAL:|PANIC:/.test(stderr)){const error=new Error(stderr);error.code=stderr.match(/(?:ERROR|FATAL):\s+([A-Z0-9]{5}):/)?.[1];p.reject(error);}else p.resolve(stdout);
 }
 command(sql){if(!nativeConnections.has(this))return Promise.reject(new Error('Connection already closed'));const next=this.tail.then(()=>new Promise((resolve,reject)=>{const mark=`__bitaria_${randomUUID().replaceAll('-','')}__`;this.pending={mark,resolve,reject};this.child.stdin.write(`${sql}\n\\echo ${mark}\n\\warn ${mark}\n`);}));this.tail=next.catch(()=>{});return next;}
 async exec(sql){
  // Roles belong to the portable cluster, not to each fresh synthetic database.
  sql=sql.replace(/create role (anon|authenticated|service_role) (nologin(?: bypassrls)?);/g,(_,role,options)=>`do $native_role$ begin if not exists(select 1 from pg_roles where rolname='${role}') then create role ${role} ${options}; end if; end $native_role$;`);
  await this.command(`${sql}\n;`);
 }
 async query(sql,args=[]){
  const literal=value=>{if(value===null||value===undefined)return 'NULL';if(typeof value==='boolean')return value?'TRUE':'FALSE';if(typeof value==='number')return String(value);if(Array.isArray(value))return `ARRAY[${value.map(literal).join(',')}]`;const text=String(value);let tag='$bitaria$';while(text.includes(tag))tag=`$b${randomUUID().replaceAll('-','')}$`;return `${tag}${text}${tag}`;};
  const bound=sql.replace(/\$(\d+)\b/g,(_,n)=>literal(args[Number(n)-1])).trim().replace(/;\s*$/,'');
  if(!/^(select|with)\b/i.test(bound)&&!/\breturning\b/i.test(bound)){await this.exec(`${bound};`);return {rows:[]};}
  const rowSql=/^(insert|update|delete)\b/i.test(bound)?`with native_result as (${bound}) select * from native_result`:bound;
  const output=await this.command(`select coalesce(json_agg(native_row),'[]'::json)::text from (${rowSql}) native_row;`);
  return {rows:JSON.parse(output)};
 }
 async transaction(fn){const tx=new PGlite();try{await tx.exec('begin;');const value=await fn(tx);await tx.exec('commit;');return value;}catch(e){await tx.exec('rollback;');throw e;}finally{await tx.close();}}
 async close(){if(!nativeConnections.has(this))return;await this.tail;this.child.stdin.end('\\q\n');await new Promise(resolve=>this.child.once('exit',resolve));}
}
