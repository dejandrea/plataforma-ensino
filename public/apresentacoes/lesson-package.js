import {readZipArchive,sha256} from './zip.js';
import {parsePresentationPackage} from './package.js';
export const lessonPackageLimits=Object.freeze({zip:25*1024*1024,total:32*1024*1024,effective:50*1024*1024,entries:8,ratio:200});
const decoder=new TextDecoder('utf-8',{fatal:true});
const fail=message=>{throw new Error(message);};
function fileType(name){
 if(name==='manifest.json')return {limit:65536,kind:'manifest'};
 if(name==='aula.json')return {limit:2000000,kind:'lesson'};
 if(/^apresentacoes\/[a-z][a-z0-9-]{0,63}\.zip$/.test(name))return {limit:10*1024*1024,kind:'presentation'};
 fail(`Arquivo não permitido no pacote: ${name}`);
}
export function canonicalJson(value){
 return JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0)):v);
}
function unique(values,label){if(new Set(values).size!==values.length)fail(`Referência duplicada: ${label}`);}
function https(value){let u;try{u=new URL(value);}catch{fail('Referência HTTPS inválida.');}if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443'))fail('Use HTTPS sem credenciais.');return u;}
/** Only ZIP/envelope orchestration. Activity semantics use the existing validator. */
export async function parseLessonPackage(input,{validateLesson,validateManifest,presentationSchema,targetLessonId,lessonKey,platformOrigin,slots}){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 const files=await readZipArchive(bytes,lessonPackageLimits,fileType,['apresentacoes/']);
 const json=path=>{const f=files.find(f=>f.path===path);if(!f)fail(`Arquivo ausente: ${path}`);try{return JSON.parse(decoder.decode(f.data).replace(/^\uFEFF/,''));}catch{fail(`JSON UTF-8 inválido: ${path}`);}};
 const manifest=json('manifest.json');if(!validateManifest(manifest))fail('Manifesto fora do contrato v1.');
 if(manifest.targetLessonId!==targetLessonId||manifest.platformOrigin!==platformOrigin)fail('Aula de destino ou origem diferente do kit selecionado.');
 unique(manifest.files.map(f=>f.path.toLowerCase()),'arquivos');
 const expected=new Set(['manifest.json',...manifest.files.map(f=>f.path)]);
 if(files.length!==expected.size||files.some(f=>!expected.has(f.path)))fail('Inventário de arquivos ausente ou não declarado.');
 for(const f of manifest.files){const actual=files.find(x=>x.path===f.path);if(!actual||f.bytes!==actual.size||f.sha256!==actual.sha256)fail(`Integridade divergente: ${f.path}`);}
 const document=json('aula.json'),validation=validateLesson(document);
 if(!validation.valid)fail(validation.errors.join('\n'));if(document.schemaVersion!==2)fail('O pacote unificado exige aula v2.');
 if(document.lesson.key!==lessonKey)fail('Key da aula diferente da identidade do kit.');
 const presentations=manifest.presentations??[];
 for(const field of ['key','activityKey','presentationId','path'])unique(presentations.map(p=>p[field]),field);
 unique((manifest.teacherResources??[]).map(r=>r.key),'materiais docentes');
 const publicText=JSON.stringify({schemaVersion:document.schemaVersion,context:document.context,lesson:document.lesson,activities:document.activities});
 for(const ref of manifest.teacherResources??[]){https(ref.url);if(publicText.includes(ref.url))fail('Referência docente no conteúdo público.');}
 let effective=files.filter(f=>f.kind!=='presentation').reduce((n,f)=>n+f.size,0);const decks=[];
 for(const ref of presentations){
  if(!slots.some(s=>s.key===ref.key&&s.presentationId===ref.presentationId)||ref.path!==`apresentacoes/${ref.key}.zip`)fail('Identidade de apresentação não fornecida pelo kit.');
  const activity=document.activities.find(a=>a.key===ref.activityKey),file=files.find(f=>f.path===ref.path);
  if(!file||activity?.type!=='slides'||activity.content.format!=='link'||activity.content.resourceUrl!==`${platformOrigin}/apresentacoes/gerenciada/${ref.presentationId}`)fail('Vínculo de apresentação incompatível.');
  const parsed=await parsePresentationPackage(file.data,presentationSchema);effective+=parsed.files.reduce((n,f)=>n+f.size,0);
  if(effective>lessonPackageLimits.effective)fail('Conteúdo efetivo expandido acima de 50 MiB.');decks.push({...ref,parsed});
 }
 if(files.filter(f=>f.kind==='presentation').some(f=>!presentations.some(p=>p.path===f.path)))fail('ZIP interno sem intenção de vínculo.');
 const resources=[];
 function inventory(value,path=''){
  if(!value||typeof value!=='object')return;
  for(const [key,item] of Object.entries(value)){
   const at=`${path}/${key}`;
   if(['resourceUrl','url'].includes(key)&&typeof item==='string'){
    const u=https(item);const managed=presentations.some(p=>item===`${platformOrigin}/apresentacoes/gerenciada/${p.presentationId}`);
    if(u.pathname.startsWith('/apresentacoes/gerenciada/')&&!managed)fail('Apresentação gerenciada sem vínculo declarado.');
    resources.push({path:at,url:item,kind:managed?'managed':u.hostname==='drive.google.com'?'drive':'external',private:at.startsWith('/teacherOnly')});
   }else inventory(item,at);
  }
 }
 inventory(document);for(const r of manifest.teacherResources??[])resources.push({path:`/teacherResources/${r.key}`,url:r.url,kind:'drive-or-external',private:true});
 unique(decks.map(d=>d.parsed.packageHash),'pacotes web idênticos');
 const semantic={targetLessonId,platformOrigin,document,teacherResources:manifest.teacherResources??[],presentations:decks.map(({parsed,...ref})=>({...ref,deck:parsed.deck,files:parsed.files.filter(f=>f.kind!=='deck').map(({path,sha256,size})=>({path,sha256,size})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)}))};
 return {manifest,document,decks,resources,rawHash:await sha256(bytes),semanticHash:await sha256(new TextEncoder().encode(canonicalJson(semantic))),warnings:['Confirme manualmente o acesso e as licenças dos recursos externos.',...decks.flatMap(d=>d.parsed.warnings)]};
}
