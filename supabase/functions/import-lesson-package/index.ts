import Ajv from 'ajv';
import {createAdminClient,createUserClient} from '../_shared/supabase.ts';
import {prepareWebPresentation,type PreparedDeck} from '../_shared/prepare-web-presentation.ts';
import {parseLessonPackage,lessonPackageLimits} from '../../../public/apresentacoes/lesson-package.js';
import {readLimited} from '../../../public/apresentacoes/zip.js';
import {validateLessonImport} from '../../../src/lib/learningContent.ts';
import manifestSchema from '../../../src/contracts/lesson-package.v1.schema.json' with {type:'json'};
import presentationSchema from '../../../public/apresentacoes/presentation.schema.json' with {type:'json'};
const validateManifest=new Ajv({allErrors:true}).compile(manifestSchema);
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type, x-lesson-id, x-confirmed'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function handleLessonPackage(req:Request){
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'Método não permitido.'},405);
 const client=createUserClient(req);const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)return json({error:'Entre como administrador.'},401);
 const admin=createAdminClient();const {data:profile}=await admin.from('profiles').select('role,is_active').eq('id',user.id).single();
 if(profile?.role!=='admin'||!profile.is_active)return json({error:'Administrador ativo obrigatório.'},403);
 const lessonId=req.headers.get('x-lesson-id')??'';if(!uuid.test(lessonId)||req.headers.get('x-confirmed')!=='true')return json({error:'Selecione a aula e confirme salvar o rascunho.'},400);
 let operationId:string|null=null;
 try{
  const {data:state,error:stateError}=await client.rpc('lesson_package_state',{p_lesson_id:lessonId});if(stateError||!state?.kit)throw new Error('Exporte primeiro o kit para esta aula.');
  if(Number(req.headers.get('content-length'))>lessonPackageLimits.zip)return json({error:'ZIP acima de 25 MiB.'},413);
  const bytes=await readLimited(req.body,lessonPackageLimits.zip);
  const parsed=await parseLessonPackage(bytes,{validateLesson:validateLessonImport,validateManifest,presentationSchema,targetLessonId:lessonId,lessonKey:state.kit.lesson_key,platformOrigin:state.kit.origin,slots:state.kit.slots});
  const decks=parsed.decks.map(d=>({key:d.key,activityKey:d.activityKey,presentationId:d.presentationId,packageHash:d.parsed.packageHash,files:d.parsed.files.map(({path,mime,size,sha256}:PreparedDeck['files'][number])=>({path,mime,size,sha256}))}));
  const {data:op,error:beginError}=await admin.rpc('begin_lesson_package',{p_actor:user.id,p_lesson_id:lessonId,p_manifest:parsed.manifest,p_document:parsed.document,p_semantic_hash:parsed.semanticHash,p_raw_hash:parsed.rawHash,p_decks:decks});
  if(beginError)throw new Error(beginError.message);operationId=op.id;
  if(op.status==='preparing'){
   for(const deck of parsed.decks){
    const intent=op.intents.find((i:{key:string})=>i.key===deck.key);if(!intent)throw new Error('Intenção persistente ausente.');
    // Repacking identical content retains the first preparation's immutable identity.
    const prepared={...deck.parsed,packageHash:intent.package_hash,files:intent.files.map((meta:{path:string;sha256:string})=>{
     const file=deck.parsed.files.find((f:PreparedDeck['files'][number])=>f.path===meta.path&&f.sha256===meta.sha256);if(!file)throw new Error('Arquivos da intenção divergentes.');return file;
    })};
    await prepareWebPresentation(admin,prepared,{actor:user.id,lessonId,presentationId:intent.presentation_id,versionId:intent.version_id},{retainOnFailure:true,existing:async()=>{
     const {data,error}=await admin.rpc('prepared_lesson_package_version',{p_actor:user.id,p_operation:op.id,p_key:deck.key});if(error)throw new Error(error.message);return data;
    }});
   }
   const {error}=await admin.rpc('finish_lesson_package',{p_actor:user.id,p_operation:op.id});if(error)throw new Error(error.message);
  }
  return json({operationId,status:op.status==='published'?'published':'ready',warnings:parsed.warnings});
 }catch(cause){
  const message=cause instanceof Error?cause.message:'Não foi possível preparar o pacote.';
  if(operationId)await admin.rpc('record_lesson_package_failure',{p_actor:user.id,p_operation:operationId,p_error:message});
  return json({error:message,operationId},400);
 }
}
Deno.serve(handleLessonPackage);
