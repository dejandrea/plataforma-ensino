import {supabase} from './supabaseClient';
import type {LearningActivity} from '../types/learning';
import type {ParsedPresentation,PresentationBundle,PresentationDeck,PresentationFile,PresentationState} from '../types/presentations';

type ParserModule={parsePresentationPackage:(input:Uint8Array,schema:unknown)=>Promise<ParsedPresentation>;sha256:(bytes:Uint8Array)=>Promise<string>;readLimited:(stream:ReadableStream<Uint8Array>|null,limit:number)=>Promise<Uint8Array>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function managedPresentationPath(id:string){if(!uuid.test(id))throw new Error('Apresentação inválida.');return `/apresentacoes/gerenciada/${id}`;}
let parser:Promise<ParserModule>|undefined;
async function packageParser(){
  const url=new URL('/apresentacoes/package.js',window.location.origin).href;
  return parser??=import(/* @vite-ignore */url) as Promise<ParserModule>;
}
async function schema(){const response=await fetch('/apresentacoes/presentation.schema.json');if(!response.ok)throw new Error('Contrato de apresentações indisponível.');return response.json();}
export async function parseWebPresentation(file:File){if(file.size>10*1024*1024)throw new Error('O ZIP deve ter até 10 MB.');return (await packageParser()).parsePresentationPackage(new Uint8Array(await file.arrayBuffer()),await schema());}
export function localPresentationBundle(parsed:ParsedPresentation):{bundle:PresentationBundle;dispose:()=>void}{
  const assets=Object.fromEntries(parsed.files.filter(f=>f.kind==='image').map(file=>[`./${file.path}`,URL.createObjectURL(new Blob([new Uint8Array(file.data)],{type:file.mime}))]));
  return {bundle:{deck:parsed.deck,assets,versionKey:parsed.packageHash},dispose:()=>Object.values(assets).forEach(url=>URL.revokeObjectURL(url))};
}
function readError(error:{message:string;code?:string}){
  if(['PGRST202','42883','42P01'].includes(error.code??''))return new Error('O gerenciador ainda não foi preparado neste ambiente. A migration e a função de importação precisam ser instaladas.');
  if(['42501','23514','40001'].includes(error.code??''))return new Error(error.message);
  return new Error('Não foi possível acessar as apresentações. Atualize a lista e tente novamente.');
}
export async function fetchPresentationState(lessonId:string):Promise<PresentationState>{const {data,error}=await supabase.rpc('web_presentation_state',{p_lesson_id:lessonId});if(error)throw readError(error);return data as PresentationState;}
export async function savePresentationPackage(lessonId:string,presentationId:string|null,file:File){
  const {data,error}=await supabase.functions.invoke('import-web-presentation',{body:file,headers:{'Content-Type':'application/zip','x-lesson-id':lessonId,...(presentationId?{'x-presentation-id':presentationId}:{})}});
  if(error){
    let message='Não foi possível validar e salvar o pacote no servidor.';
    if(error.context instanceof Response){try{const body=await error.context.json();if(typeof body.error==='string')message=body.error;}catch{/* Keep a useful network message. */}}
    throw new Error(message);
  }
  return data as {presentationId:string;versionId:string;versionNumber:number;warnings:string[]};
}
export async function publishPresentation(id:string,versionId:string,expected:string|null){const {error}=await supabase.rpc('publish_web_presentation',{p_presentation_id:id,p_version_id:versionId,p_expected_active_version:expected,p_confirmed:true});if(error)throw readError(error);}
export async function bindPresentation(id:string,activityId:string,expected:string|null){const {error}=await supabase.rpc('bind_web_presentation',{p_presentation_id:id,p_activity_id:activityId,p_expected_presentation:expected,p_confirmed:true});if(error)throw readError(error);}

export async function resolvePresentationBundle(id:string,versionId:string|null=null):Promise<PresentationBundle>{
  managedPresentationPath(id);if(versionId&&!uuid.test(versionId))throw new Error('Versão inválida.');
  const {data,error}=await supabase.rpc('resolve_web_presentation',{p_presentation_id:id,p_version_id:versionId});if(error)throw readError(error);
  const metadata=data as {id:string;version_id:string;files:PresentationFile[]};
  if(metadata.id!==id||!uuid.test(metadata.version_id)||!Array.isArray(metadata.files))throw new Error('Resposta de apresentação inválida.');
  const prefix=`presentations/${id}/versions/${metadata.version_id}/`;
  for(const file of metadata.files)if(!/^(apresentacao\.json|creditos-imagens\.md|images\/[a-z0-9][a-z0-9_-]{0,99}\.(webp|png|jpg|jpeg))$/.test(file.path))throw new Error('Caminho de apresentação inválido.');
  const {data:signed,error:signError}=await supabase.storage.from('web-presentations').createSignedUrls(metadata.files.map(file=>prefix+file.path),300);
  if(signError||!signed||signed.some(item=>item.error||!item.signedUrl))throw new Error('Não foi possível autorizar os arquivos desta apresentação.');
  const origin=new URL(import.meta.env.VITE_SUPABASE_URL).origin;
  const urls=new Map(signed.map(item=>{
    const url=new URL(item.signedUrl);
    if(url.origin!==origin||!decodeURIComponent(url.pathname).startsWith(`/storage/v1/object/sign/web-presentations/${prefix}`))throw new Error('Origem de arquivo inválida.');
    return [item.path,item.signedUrl];
  }));
  const deckFile=metadata.files.find(file=>file.path==='apresentacao.json');const deckUrl=urls.get(prefix+'apresentacao.json');
  if(!deckFile||!deckUrl)throw new Error('JSON da apresentação ausente.');
  const response=await fetch(deckUrl,{cache:'no-store'});if(!response.ok)throw new Error('Não foi possível carregar a versão autorizada.');
  const runtime=await packageParser();const bytes=await runtime.readLimited(response.body,512000);
  if(await runtime.sha256(bytes)!==deckFile.sha256)throw new Error('A integridade da apresentação não confere.');
  const deck=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'')) as PresentationDeck;
  const assets=Object.fromEntries(metadata.files.filter(file=>file.path.startsWith('images/')).map(file=>[`./${file.path}`,urls.get(prefix+file.path)!]));
  return {deck,assets,versionKey:metadata.version_id,assetOrigin:origin};
}

/** Optional overlay: never rewrites the immutable pedagogical content or revision. */
export async function withPresentationLinks(lessonId:string,activities:LearningActivity[]):Promise<LearningActivity[]>{
  const {data,error}=await supabase.rpc('lesson_web_presentations',{p_lesson_id:lessonId});
  if(error){if(['PGRST202','42883'].includes(error.code??''))return activities;throw readError(error);}
  const links=new Map((data as {activity_id:string;presentation_id:string}[]??[]).filter(link=>uuid.test(link.presentation_id)).map(link=>[link.activity_id,link.presentation_id]));
  return activities.map(activity=>activity.activity_type==='slides'&&links.has(activity.id)?{...activity,web_presentation_id:links.get(activity.id)}:activity);
}
