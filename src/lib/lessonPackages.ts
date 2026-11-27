import Ajv from 'ajv';
import {supabase} from './supabaseClient';
import {getLearningContentSchemas,validateLessonImport} from './learningContent';
import manifestSchema from '../contracts/lesson-package.v1.schema.json';
import example from '../contracts/examples/lesson-package.v2.json';
import instructions from '../contracts/work-lesson-package.md?raw';
import type {LessonImportV2} from '../types/learning';
import type {ParsedPresentation,PresentationFile} from '../types/presentations';
export type PackageSlot={key:string;presentationId:string};
export type PackageKit={lesson_id:string;lesson_key:string;origin:string;slots:PackageSlot[]};
export type FullPackageKit=PackageKit&{context:LessonImportV2['context'];curriculum?:{courseId:string;moduleId:string;submoduleId:string;courseDescription?:string|null;moduleDescription?:string|null;submoduleDescription?:string|null};lesson:{title:string;description:string|null;duration_minutes:number|null};metadata:{objectives:string[]}|null;inventory:unknown[]};
export type PackageManifest={packageVersion:1;productionId:string;targetLessonId:string;platformOrigin:string;files:{path:string;bytes:number;sha256:string}[];presentations?:{key:string;activityKey:string;presentationId:string;path:string}[];teacherResources?:{key:string;title:string;url:string;kind:string}[]};
export type ParsedLessonPackage={manifest:PackageManifest;document:LessonImportV2;decks:({key:string;activityKey:string;presentationId:string;path:string;parsed:ParsedPresentation})[];resources:{path:string;url:string;kind:string;private:boolean}[];semanticHash:string;rawHash:string;warnings:string[]};
export type PackageOperation={id:string;semantic_hash:string;status:'preparing'|'ready'|'published';document:LessonImportV2;manifest:PackageManifest;draft_version:number|null;last_error:string|null;intents:{key:string;activity_key:string;presentation_id:string;version_id:string;files:PresentationFile[]}[]};
export type PackageState={kit:PackageKit|null;operation:PackageOperation|null;eligible:boolean;eligibilityReason:string|null};
type ZipModule={createStoredZip:(entries:{path:string;data:string|Uint8Array}[])=>Uint8Array;sha256:(bytes:Uint8Array)=>Promise<string>};
type Parser={parseLessonPackage:(bytes:Uint8Array,options:Record<string,unknown>)=>Promise<ParsedLessonPackage>};
const validateManifest=new Ajv({allErrors:true}).compile(manifestSchema);
async function runtime<T>(name:string):Promise<T>{return import(/* @vite-ignore */new URL(`/apresentacoes/${name}.js`,window.location.origin).href) as Promise<T>;}
async function presentationContract(){const response=await fetch('/apresentacoes/presentation.schema.json');if(!response.ok)throw new Error('Schema oficial de apresentações indisponível.');return response.json();}
export async function parseUnifiedLesson(file:File,kit:PackageKit){
 if(file.size>25*1024*1024)throw new Error('O ZIP deve ter até 25 MiB.');
 return (await runtime<Parser>('lesson-package')).parseLessonPackage(new Uint8Array(await file.arrayBuffer()),{validateLesson:validateLessonImport,validateManifest:(m:unknown)=>validateManifest(m)===true,presentationSchema:await presentationContract(),targetLessonId:kit.lesson_id,lessonKey:kit.lesson_key,platformOrigin:kit.origin,slots:kit.slots});
}
async function rpc<T>(name:string,params:Record<string,unknown>):Promise<T>{const {data,error}=await supabase.rpc(name,params);if(error)throw new Error(['PGRST202','42883'].includes(error.code)?'O importador unificado ainda não está instalado neste ambiente.':error.message);return data as T;}
export const packageState=(lessonId:string)=>rpc<PackageState>('lesson_package_state',{p_lesson_id:lessonId});
export const createPackageKit=(lessonId:string,origin:string)=>rpc<FullPackageKit>('create_lesson_package_kit',{p_lesson_id:lessonId,p_origin:origin,p_lesson_key:null});
export const publishPackage=(op:PackageOperation)=>rpc('publish_lesson_package',{p_operation:op.id,p_expected_version:op.draft_version,p_confirmed:true});
export async function saveUnifiedLesson(lessonId:string,file:File){
 const {data,error}=await supabase.functions.invoke('import-lesson-package',{body:file,headers:{'Content-Type':'application/zip','x-lesson-id':lessonId,'x-confirmed':'true'}});
 if(error){let message='Não foi possível preparar o pacote. Recarregue para recuperar a operação.';if(error.context instanceof Response)try{const body=await error.context.json();message=body.error??message;}catch{/* Keep recoverable error. */}throw new Error(message);}return data;
}
export function downloadPackage(bytes:Uint8Array,name:string){const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/zip'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function syntheticLessonPackage(kit:FullPackageKit,providedZip?:ZipModule){
 const zip=providedZip??await runtime<ZipModule>('zip');const document=structuredClone(example) as LessonImportV2;
 document.context=kit.context;document.lesson.key=kit.lesson_key;document.lesson.title=kit.lesson.title;
 for(const a of document.activities){if(a.type==='video')a.content.resourceUrl='https://drive.google.com/file/d/bitaria-sintetico-video-000001/view';if(a.type==='mindmap')a.content.resourceUrl='https://drive.google.com/file/d/bitaria-sintetico-mapa-000001/view';}
 const entries:{path:string;data:string|Uint8Array}[]=[],refs:NonNullable<PackageManifest['presentations']>=[];
 const slides=document.activities.filter(a=>a.type==='slides');
 for(let index=0;index<2;index++){
  const slot=kit.slots[index],activity=slides[index];activity.content.format='link';activity.content.resourceUrl=`${kit.origin}/apresentacoes/gerenciada/${slot.presentationId}`;
  const deck={schemaVersion:1,title:`Demonstração sintética ${index+1}`,slides:[{type:'concept',title:'Exemplo de conceito',body:'Conteúdo sintético para homologar o fluxo; substituir antes de usar em aulas reais.'},{type:'concept',title:'Revisão',body:'Observar, relacionar e explicar as ideias estudadas.'}]};
  const path=`apresentacoes/${slot.key}.zip`;entries.push({path,data:zip.createStoredZip([{path:'apresentacao.json',data:JSON.stringify(deck)},{path:'creditos-imagens.md',data:'Exemplo sintético, sem imagens ou fontes externas.'}])});refs.push({...slot,activityKey:activity.key,path});
 }
 entries.unshift({path:'aula.json',data:JSON.stringify(document)});
 const manifest:PackageManifest={packageVersion:1,productionId:'demonstracao-local-v1',targetLessonId:kit.lesson_id,platformOrigin:kit.origin,files:[],presentations:refs,teacherResources:[{key:'notas-docentes',title:'Notas docentes sintéticas',url:'https://drive.google.com/file/d/bitaria-sintetico-notas-docentes/view',kind:'notes'}]};
 for(const entry of entries){const bytes=typeof entry.data==='string'?new TextEncoder().encode(entry.data):entry.data;manifest.files.push({path:entry.path,bytes:bytes.length,sha256:await zip.sha256(bytes)});}
 return zip.createStoredZip([{path:'manifest.json',data:JSON.stringify(manifest)},...entries]);
}
export async function exportProductionKit(kit:FullPackageKit,providedZip?:ZipModule,providedPresentationSchema?:unknown){
 const zip=providedZip??await runtime<ZipModule>('zip');
 const {v1:lessonSchemaV1,v2:lessonSchemaV2}=getLearningContentSchemas();
 const identity={lesson_id:kit.lesson_id,lesson_key:kit.lesson_key,origin:kit.origin,slots:kit.slots,context:kit.context,curriculum:kit.curriculum,
 lesson:{title:kit.lesson.title,description:kit.lesson.description,duration_minutes:kit.lesson.duration_minutes},metadata:kit.metadata,inventory:kit.inventory};
 return zip.createStoredZip([{path:'identidade.json',data:JSON.stringify(identity,null,2)},{path:'LEIA-ME-Work.md',data:instructions},
 {path:'schemas/lesson-package.v1.schema.json',data:JSON.stringify(manifestSchema)},{path:'schemas/learning-content.v1.schema.json',data:JSON.stringify(lessonSchemaV1)},
 {path:'schemas/learning-content.v2.schema.json',data:JSON.stringify(lessonSchemaV2)},{path:'schemas/presentation.schema.json',data:JSON.stringify(providedPresentationSchema??await presentationContract())},
 {path:`exemplo-sintetico/bitaria-${kit.lesson_key}-demonstracao-local-v1.zip`,data:await syntheticLessonPackage(kit,zip)}]);
}
