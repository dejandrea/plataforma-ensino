import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as parser from '../../public/apresentacoes/lesson-package.js';
import * as zip from '../../public/apresentacoes/zip.js';
import {presentationRpc,localImportPipeline} from './presentations-db.mjs';
const require=createRequire(import.meta.url);
export function loadPackageTs(file,overrides={}){
 const m={exports:{}};const compiled=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const resolve=name=>{
  if(Object.hasOwn(overrides,name))return overrides[name];
  if(name.endsWith('.json'))return JSON.parse(readFileSync(name.includes('presentation.schema')?'public/apresentacoes/presentation.schema.json':`src/contracts/${name.includes('/examples/')?'examples/':''}${name.split('/').at(-1)}`,'utf8'));
  return require(name);
 };
 new Function('require','module','exports','Deno',compiled)(resolve,m,m.exports,{serve:()=>{}});return m.exports;
}
export const validators=loadPackageTs('src/lib/learningContent.ts');
export function lessonPackagePipeline(d,pipeline=localImportPipeline(d)){
 const rpcArgs={begin_lesson_package:['p_actor','p_lesson_id','p_manifest','p_document','p_semantic_hash','p_raw_hash','p_decks'],prepared_lesson_package_version:['p_actor','p_operation','p_key'],finish_lesson_package:['p_actor','p_operation'],record_lesson_package_failure:['p_actor','p_operation','p_error']};
 const oldRpc=pipeline.admin.rpc;
 pipeline.admin.rpc=async(name,params)=>{
  if(!rpcArgs[name])return oldRpc(name,params);
  try{return {data:await presentationRpc(d,'admin',name,rpcArgs[name].map(k=>['p_manifest','p_document','p_decks'].includes(k)?JSON.stringify(params[k]):params[k]),'service_role'),error:null};}catch(error){return {data:null,error};}
 };
 const dependencies={...pipeline.dependencies,createUserClient:req=>({...pipeline.dependencies.createUserClient(req),rpc:async(name,params)=>{
  const identity=req.headers.get('authorization')?.replace('Bearer ','');try{return {data:await presentationRpc(d,identity,name,[params.p_lesson_id]),error:null};}catch(error){return {data:null,error};}
 }})};
 const loaded=loadPackageTs('supabase/functions/import-lesson-package/index.ts',{'../_shared/supabase.ts':dependencies,'../_shared/prepare-web-presentation.ts':pipeline.preparePresentation,'../../../public/apresentacoes/lesson-package.js':parser,'../../../public/apresentacoes/zip.js':zip,'../../../src/lib/learningContent.ts':validators});
 return {...pipeline,legacyHandle:pipeline.handle,handle:loaded.handleLessonPackage};
}
