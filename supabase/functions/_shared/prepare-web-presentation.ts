import type {createAdminClient} from './supabase.ts';
type Client=ReturnType<typeof createAdminClient>;
export type PreparedDeck={deck:{title:string};files:{path:string;mime:string;size:number;sha256:string;data:Uint8Array}[];packageHash:string;warnings:string[];slideCount:number};
type Receipt={presentationId:string;versionId:string;versionNumber:number;packageHash?:string;files?:Omit<PreparedDeck['files'][number],'data'>[]};
/** Shared upload/registration pipeline. Coordinated imports retain resumable files. */
export async function prepareWebPresentation(admin:Client,parsed:PreparedDeck,target:{actor:string;lessonId:string;presentationId:string;versionId:string},options:{retainOnFailure?:boolean;existing?:()=>Promise<Receipt|null>}={}){
 const uploaded:string[]=[];
 const existing=async()=>{
  const value=await options.existing?.();if(!value)return null;
  if(value.packageHash!==parsed.packageHash||value.files?.length!==parsed.files.length||parsed.files.some(f=>!value.files?.some(x=>x.path===f.path&&x.mime===f.mime&&x.size===f.size&&x.sha256===f.sha256)))throw new Error('Preparação existente divergente.');
  return value;
 };
 const previous=await existing();if(previous)return previous;
 const prefix=`presentations/${target.presentationId}/versions/${target.versionId}/`;
 try{
  for(const file of parsed.files){
   const path=prefix+file.path;
   const {error}=await admin.storage.from('web-presentations').upload(path,file.data,{contentType:file.mime,upsert:false,cacheControl:'300'});
   if(error){
    if(!options.existing)throw new Error('Falha no upload privado. A versão não foi publicada.');
    const {data:old,error:readError}=await admin.storage.from('web-presentations').download(path);
    if(readError||!old||old.size!==file.size)throw new Error('Falha no upload privado; reenvie o mesmo pacote para retomar.');
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await old.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');
    if(digest!==file.sha256)throw new Error('Arquivo privado divergente; não será sobrescrito.');
   }else uploaded.push(path);
  }
  const files=parsed.files.map(({path,mime,size,sha256})=>({path,mime,size,sha256}));
  const {data,error}=await admin.rpc('register_web_presentation',{p_actor:target.actor,p_lesson_id:target.lessonId,p_presentation_id:target.presentationId,p_version_id:target.versionId,p_title:parsed.deck.title,p_hash:parsed.packageHash,p_files:files,p_warnings:parsed.warnings,p_slide_count:parsed.slideCount});
  if(error){const raced=await existing();if(raced)return raced;throw new Error(error.code==='23505'?'Este pacote já está salvo nesta aula. Revise as identidades.':'Não foi possível registrar a versão privada.');}
  return data as Receipt;
 }catch(error){
  if(uploaded.length&&!options.retainOnFailure){const cleanup=await admin.storage.from('web-presentations').remove(uploaded);if(cleanup.error)throw new Error('Falha na preparação; limpeza dos arquivos privados ficou pendente.');}
  throw error;
 }
}
