import {createAdminClient,createUserClient} from '../_shared/supabase.ts';
// Shared parser and exact existing JSON v1 schema; no independent slide renderer.
import {parsePresentationPackage,readLimited,packageLimits} from '../../../public/apresentacoes/package.js';
import schema from '../../../public/apresentacoes/presentation.schema.json' with {type:'json'};

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type, x-lesson-id, x-presentation-id',
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});

export async function handleImport(req:Request){
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Método não permitido.'},405);
  const userClient=createUserClient(req);
  const {data:{user},error:authError}=await userClient.auth.getUser();
  if(authError||!user)return json({error:'Entre com uma conta administrativa.'},401);
  const admin=createAdminClient();
  const {data:profile,error:profileError}=await admin.from('profiles').select('role,is_active').eq('id',user.id).single();
  if(profileError||profile?.role!=='admin'||!profile.is_active)return json({error:'Apenas administradores ativos podem importar apresentações.'},403);
  const lessonId=req.headers.get('x-lesson-id')??'';
  const supplied=req.headers.get('x-presentation-id');
  if(!uuid.test(lessonId)||(supplied&&!uuid.test(supplied)))return json({error:'Identificação de aula ou apresentação inválida.'},400);
  const presentationId=supplied??crypto.randomUUID();
  const versionId=crypto.randomUUID();
  const uploaded:string[]=[];
  try{
    // Verify target ownership before consuming/decompressing a potentially large body.
    const {data:lesson,error:lessonError}=await admin.from('lessons').select('id').eq('id',lessonId).single();
    if(lessonError||!lesson)return json({error:'Aula não encontrada.'},404);
    if(supplied){
      const {data:target}=await admin.from('web_presentations').select('lesson_id').eq('id',supplied).single();
      if(!target||target.lesson_id!==lessonId)return json({error:'Apresentação não pertence à aula escolhida.'},400);
    }
    if(Number(req.headers.get('content-length'))>packageLimits.zip)return json({error:'O ZIP deve ter até 10 MB.'},413);
    const bytes=await readLimited(req.body,packageLimits.zip);
    const parsed=await parsePresentationPackage(bytes,schema);
    const prefix=`presentations/${presentationId}/versions/${versionId}/`;
    for(const file of parsed.files){
      if(!file.data)throw new Error('Arquivo validado sem conteúdo.');
      const path=prefix+file.path;
      const {error}=await admin.storage.from('web-presentations').upload(path,file.data,{contentType:file.mime,upsert:false,cacheControl:'300'});
      if(error)throw new Error('Falha no upload privado. A versão não foi publicada.');
      uploaded.push(path);
    }
    const files=parsed.files.map(({path,mime,size,sha256}:{path:string;mime:string;size:number;sha256:string})=>({path,mime,size,sha256}));
    const {data,error}=await admin.rpc('register_web_presentation',{
      p_actor:user.id,p_lesson_id:lessonId,p_presentation_id:presentationId,p_version_id:versionId,
      p_title:parsed.deck.title,p_hash:parsed.packageHash,p_files:files,p_warnings:parsed.warnings,p_slide_count:parsed.slideCount,
    });
    if(error)throw new Error(error.code==='23505'?'Este pacote já está salvo nesta apresentação. Use a versão existente ou a reversão.':'Não foi possível registrar a versão validada. Nenhuma publicação foi alterada.');
    return json({...data,warnings:parsed.warnings});
  }catch(cause){
    if(uploaded.length)await admin.storage.from('web-presentations').remove(uploaded);
    return json({error:cause instanceof Error?cause.message:'Não foi possível validar e salvar o pacote.'},400);
  }
}
Deno.serve(handleImport);
