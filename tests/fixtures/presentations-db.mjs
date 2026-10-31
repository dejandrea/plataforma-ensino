import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createFlashcardsDb} from './flashcards-db.mjs';
import {fixtureUsers,learningMigration,readSql} from './learning-test-db.mjs';
import * as parser from '../../public/apresentacoes/package.js';

export async function preparePresentations(d){
  await d.login('admin','postgres');
  await d.db.exec(`grant usage on schema storage to anon,authenticated,service_role;
    alter table storage.objects add column metadata jsonb,add unique(bucket_id,name);
    grant select,insert,update,delete on storage.objects to authenticated,service_role;`);
  await d.db.exec(readSql(learningMigration('_managed_web_presentations.sql')));
}
export async function createPresentationsDb(){const d=await createFlashcardsDb();await preparePresentations(d);return d;}
export async function roleQuery(d,user,sql,args=[],role='authenticated'){
  return d.db.transaction(async tx=>{
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[fixtureUsers[user]??'']);
    return tx.query(sql,args);
  });
}
export async function presentationRpc(d,user,name,args=[],role='authenticated'){
  return (await roleQuery(d,user,`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) value`,args,role)).rows[0].value;
}
/** Actual Edge handler, with only Auth/HTTP Storage transport replaced locally. */
export function localImportPipeline(d){
  const objects=new Map();let failAfter=Infinity;let uploaded=0;
  const storage={from:()=>({
    upload:async(path,bytes,options)=>{
      if(uploaded++>=failAfter)return {error:{message:'simulated failure'}};
      try{
        await d.query('insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',['web-presentations',path,JSON.stringify({size:bytes.length,mimetype:options.contentType})]);
        objects.set(path,{bytes:Buffer.from(bytes),mime:options.contentType});return {error:null};
      }catch(error){return {error};}
    },
    remove:async paths=>{for(const path of paths){await d.query('delete from storage.objects where bucket_id=$1 and name=$2',['web-presentations',path]);objects.delete(path);}return {error:null};},
  })};
  const admin={storage,from:table=>{
    let column,value;
    const query={select:()=>query,eq:(key,id)=>{column=key;value=id;return query;},single:async()=>{
      if(!['profiles','lessons','web_presentations'].includes(table)||column!=='id')throw new Error('Unexpected local test query');
      const rows=(await d.query(`select * from public.${table} where id=$1`,[value])).rows;
      return {data:rows[0]??null,error:rows[0]?null:{message:'not found'}};
    }};return query;
  },rpc:async(name,params)=>{
    if(name!=='register_web_presentation')throw new Error('Unexpected registration RPC');
    try{return {data:await presentationRpc(d,'admin',name,[params.p_actor,params.p_lesson_id,params.p_presentation_id,params.p_version_id,params.p_title,params.p_hash,JSON.stringify(params.p_files),JSON.stringify(params.p_warnings),params.p_slide_count],'service_role'),error:null};}
    catch(error){return {data:null,error};}
  }};
  const dependencies={
    createAdminClient:()=>admin,
    createUserClient:req=>({auth:{getUser:async()=>{
      const identity=req.headers.get('authorization')?.replace('Bearer ','');
      return {data:{user:fixtureUsers[identity]?{id:fixtureUsers[identity]}:null},error:fixtureUsers[identity]?null:{message:'invalid token'}};
    }}}),
  };
  const module={exports:{}};const require=createRequire(import.meta.url);
  const compiled=ts.transpileModule(readFileSync('supabase/functions/import-web-presentation/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const localRequire=name=>name.includes('_shared/supabase')?dependencies:name.endsWith('package.js')?parser:name.endsWith('.json')?JSON.parse(readFileSync('public/apresentacoes/presentation.schema.json','utf8')):require(name);
  new Function('require','module','exports','Deno',compiled)(localRequire,module,module.exports,{serve:()=>{}});
  return {objects,handle:module.exports.handleImport,failUploadAfter:count=>{failAfter=count;uploaded=0;}};
}
