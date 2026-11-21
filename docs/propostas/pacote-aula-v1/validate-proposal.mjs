// Documentation-only contract harness. No HTTP, database, imports or publication.
// Accepts a local example directory, NOT an arbitrary outer ZIP.
import {readFile,readdir,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../..');
const require=createRequire(import.meta.url);
const Ajv=require('ajv');const ts=require('typescript');
const readJson=async f=>JSON.parse(await readFile(f,'utf8'));
const schema=await readJson(path.join(here,'manifest.proposta.schema.json'));
const validateManifest=new Ajv({allErrors:true,jsonPointers:true}).compile(schema);
const compiled=ts.transpileModule(await readFile(path.join(repo,'src/lib/learningContent.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const module={exports:{}};
const contracts=new Map();for(const v of [1,2])contracts.set(`learning-content.v${v}.schema.json`,await readJson(path.join(repo,`src/contracts/learning-content.v${v}.schema.json`)));
new Function('require','module','exports',compiled)(name=>name.endsWith('.json')?contracts.get(name.split('/').at(-1)):require(name),module,module.exports);
const {validateLessonImport,toStudentLesson}=module.exports;
const {parsePresentationPackage}=await import(pathToFileURL(path.join(repo,'public/apresentacoes/package.js')).href);
const presentationSchema=await readJson(path.join(repo,'public/apresentacoes/presentation.schema.json'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=(code,message)=>{throw new Error(`${code}: ${message}`);};
const unique=(values,label)=>{if(new Set(values).size!==values.length)fail('DUPLICATE_REFERENCE',label);};
function https(value){let u;try{u=new URL(value);}catch{fail('URL_INVALID','URL ausente ou inválida');}if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443'))fail('URL_INVALID','Use HTTPS sem credenciais');return u;}
async function walk(root,prefix=''){
 const names=[];for(const name of await readdir(path.join(root,prefix))){const rel=prefix?prefix+'/'+name:name;const stat=await lstat(path.join(root,rel));if(stat.isSymbolicLink())fail('PATH_INVALID','Links simbólicos não permitidos');if(stat.isDirectory()){if(rel!=='apresentacoes')fail('PATH_INVALID',rel);names.push(...await walk(root,rel));}else names.push(rel);}return names;
}
async function main(){
 if(!process.argv[2])fail('USAGE','node docs/propostas/pacote-aula-v1/validate-proposal.mjs <pasta-do-exemplo>');
 const root=await realpath(process.argv[2]);if(!(await lstat(root)).isDirectory())fail('USAGE','Esta ferramenta de planejamento recebe uma pasta, não o ZIP externo');
 const manifestBytes=await readFile(path.join(root,'manifest.json'));if(manifestBytes.length>65536)fail('SIZE_LIMIT','Manifesto acima de 64 KiB');
 const manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(manifestBytes));
 if(!validateManifest(manifest))fail('MANIFEST_INVALID',validateManifest.errors.map(e=>`${e.dataPath}: ${e.message}`).join('; '));
 unique(manifest.files.map(f=>f.path.toLowerCase()),'Arquivos do manifesto');
 const actual=await walk(root);unique(actual.map(f=>f.toLowerCase()),'Caminhos locais');
 const allowed=new Set(['manifest.json',...manifest.files.map(f=>f.path)]);
 if(actual.length!==allowed.size||actual.some(f=>!allowed.has(f)))fail('FILE_INVENTORY','Arquivos ausentes ou não declarados');
 if(!manifest.files.some(f=>f.path==='aula.json'))fail('FILE_INVENTORY','aula.json é obrigatório');
 let total=manifestBytes.length;
 for(const file of manifest.files){const bytes=await readFile(path.join(root,file.path));if(bytes.length!==file.bytes||sha(bytes)!==file.sha256)fail('FILE_INTEGRITY',file.path);total+=bytes.length;}
 if(total>32*1024*1024)fail('SIZE_LIMIT','Conteúdo externo expandido acima de 32 MiB');
 const lessonBytes=await readFile(path.join(root,'aula.json'));if(lessonBytes.length>2000000)fail('SIZE_LIMIT','aula.json acima de 2.000.000 bytes');
 const lesson=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(lessonBytes));const result=validateLessonImport(lesson);
 if(!result.valid)fail('LESSON_INVALID',result.errors.join('; '));
 if(lesson.schemaVersion!==2)fail('LESSON_INVALID','O envelope candidato exige aula v2; v1 continua no importador legado');
 const projection=toStudentLesson(lesson);if(Object.hasOwn(projection,'teacherOnly'))fail('PRIVACY_INVALID','teacherOnly na projeção pública');
 const presentations=manifest.presentations??[];
 for(const prop of ['key','activityKey','presentationId','path'])unique(presentations.map(p=>p[prop]),`Apresentações: ${prop}`);
 unique((manifest.teacherResources??[]).map(r=>r.key),'Referências docentes');
 for(const ref of manifest.teacherResources??[]){https(ref.url);if(JSON.stringify(projection).includes(ref.url))fail('PRIVACY_INVALID','Referência docente também aparece no conteúdo público');}
 let expanded=manifestBytes.length+lessonBytes.length;let slides=0;
 for(const ref of presentations){
  if(ref.path!==`apresentacoes/${ref.key}.zip`||!manifest.files.some(f=>f.path===ref.path))fail('BINDING_INVALID','Arquivo de apresentação ausente ou key divergente');
  const activity=lesson.activities.find(a=>a.key===ref.activityKey);
  if(!activity||activity.type!=='slides')fail('BINDING_INVALID','Apresentação deve apontar para atividade slides deste documento');
  const expected=`${manifest.platformOrigin}/apresentacoes/gerenciada/${ref.presentationId}`;
  if(activity.content.format!=='link'||activity.content.resourceUrl!==expected)fail('BINDING_INVALID','resourceUrl deve corresponder à identidade e origem fornecidas pelo kit');
  https(activity.content.resourceUrl);
  let parsed;try{parsed=await parsePresentationPackage(await readFile(path.join(root,ref.path)),presentationSchema);}catch(e){fail('PRESENTATION_INVALID',e.message);}
  expanded+=parsed.files.reduce((sum,f)=>sum+f.size,0);slides+=parsed.slideCount;
 }
 if(manifest.files.filter(f=>f.path.endsWith('.zip')).some(f=>!presentations.some(p=>p.path===f.path)))fail('BINDING_INVALID','ZIP sem apresentação declarada');
 if(expanded>50*1024*1024)fail('SIZE_LIMIT','Conteúdo efetivo expandido acima de 50 MiB');
 console.log(JSON.stringify({status:'PROPOSTA_ESTRUTURALMENTE_VALIDA',activities:lesson.activities.length,presentations:presentations.length,slides,publicProjectionExcludesTeacherOnly:true,warnings:['ZIP_EXTERNO_NAO_VALIDADO_POR_ESTA_FERRAMENTA','DESTINO_E_PERMISSOES_DO_DRIVE_NAO_VERIFICADOS','ENVELOPE_AINDA_NAO_SUPORTADO_PELO_PAINEL']}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
