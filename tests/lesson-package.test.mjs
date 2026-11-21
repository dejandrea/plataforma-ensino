import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv';
import {parseLessonPackage,lessonPackageLimits} from '../public/apresentacoes/lesson-package.js';
import * as zip from '../public/apresentacoes/zip.js';
import {zipFiles} from './fixtures/presentation-package.mjs';
import {kitTools,syntheticPackageKit} from './fixtures/lesson-package-db.mjs';
import {validators} from './fixtures/lesson-package-runtime.mjs';
import {id} from './fixtures/learning-test-db.mjs';
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const validateManifest=new Ajv().compile(json('src/contracts/lesson-package.v1.schema.json'));
export const syntheticKit=syntheticPackageKit;
const options=kit=>({validateLesson:validators.validateLessonImport,validateManifest,presentationSchema:json('public/apresentacoes/presentation.schema.json'),targetLessonId:kit.lesson_id,lessonKey:kit.lesson_key,platformOrigin:kit.origin,slots:kit.slots});
const unpack=bytes=>zip.readZipArchive(bytes,lessonPackageLimits,()=>({limit:10*1024*1024}));
test('unified ZIP, kit and zero-to-three presentations; malformed packages and semantic idempotency',async t=>{
 const original=await kitTools.syntheticLessonPackage(syntheticKit,zip);const parsed=await parseLessonPackage(original,options(syntheticKit));
 assert.equal(new Set(parsed.document.activities.map(a=>a.type)).size,8);assert.equal(parsed.decks.length,2);
 assert.equal(Object.hasOwn(validators.toStudentLesson(parsed.document),'teacherOnly'),false);
 assert.equal(await zip.sha256(original),await zip.sha256(readFileSync('docs/examples/unified-lesson-package/pacote-sintetico-completo.zip')),'Delivered example must match its generator');
 const repack=zipFiles(Object.fromEntries((await unpack(original)).map(f=>[f.path,f.data])));assert.notEqual(await zip.sha256(repack),await zip.sha256(original));assert.equal((await parseLessonPackage(repack,options(syntheticKit))).semanticHash,parsed.semanticHash);
 const kitFiles=await zip.readZipArchive(await kitTools.exportProductionKit(syntheticKit,zip,json('public/apresentacoes/presentation.schema.json')),{zip:25e6,total:32e6,entries:20,ratio:200},()=>({limit:10e6}));
 for(const expected of ['identidade.json','LEIA-ME-Work.md','schemas/learning-content.v2.schema.json','schemas/presentation.schema.json'])assert.ok(kitFiles.some(f=>f.path===expected));
 async function changed(change){const files=Object.fromEntries((await unpack(original)).map(f=>[f.path,f.data]));const manifest=JSON.parse(new TextDecoder().decode(files['manifest.json']));await change(files,manifest);files['manifest.json']=JSON.stringify(manifest);return zipFiles(files);}
 const invalid=[
 ['wrong target',async(f,m)=>{m.targetLessonId=id(9926);}],
 ['wrong origin',async(f,m)=>{m.platformOrigin='https://wrong.invalid';}],
 ['unknown manifest field',async(f,m)=>{m.publish=true;}],
 ['missing file',async f=>{delete f['aula.json'];}],
 ['hash mismatch',async(f,m)=>{m.files[0].sha256='0'.repeat(64);}],
 ['extra file',async f=>{f['segredo.txt']='private';}],
 ['traversal',async f=>{f['../aula.json']='unsafe';}],
 ['unknown presentation identity',async(f,m)=>{m.presentations[0].presentationId=id(9999);}],
 ['incompatible inner deck',async(f,m)=>{const ref=m.files.find(x=>x.path.endsWith('.zip'));const bytes=zip.createStoredZip([{path:'apresentacao.json',data:'{"schemaVersion":99}'}]);f[ref.path]=bytes;ref.bytes=bytes.length;ref.sha256=await zip.sha256(bytes);}],
 ['invalid reference',async(f,m)=>{const d=JSON.parse(new TextDecoder().decode(f['aula.json']));d.activities.find(a=>a.type==='slides').content.resourceUrl='http://invalid';const b=new TextEncoder().encode(JSON.stringify(d));f['aula.json']=b;m.files[0].bytes=b.length;m.files[0].sha256=await zip.sha256(b);}],
 ];
 await t.test('presentation JSON whitespace does not change completed-content identity',async()=>{
 const reformatted=await changed(async(f,m)=>{const ref=m.files.find(x=>x.path.endsWith('.zip'));const inner=await zip.readZipArchive(f[ref.path],{zip:10e6,total:25e6,entries:80,ratio:200},()=>({limit:5e6}));
 const replacement=zipFiles(Object.fromEntries(inner.map(file=>[file.path,file.path==='apresentacao.json'?JSON.stringify(JSON.parse(new TextDecoder().decode(file.data)),null,2):file.data])));f[ref.path]=replacement;ref.bytes=replacement.length;ref.sha256=await zip.sha256(replacement);
 });assert.equal((await parseLessonPackage(reformatted,options(syntheticKit))).semanticHash,parsed.semanticHash);
 });
 for(const [name,mutation] of invalid)await t.test(name,async()=>assert.rejects(parseLessonPackage(await changed(mutation),options(syntheticKit))));
 await t.test('valid package with no web deck',async()=>{
 const bytes=await changed(async(f,m)=>{const d=JSON.parse(new TextDecoder().decode(f['aula.json']));for(const a of d.activities.filter(a=>a.type==='slides'))a.content.resourceUrl='https://drive.google.com/file/d/material-sintetico/view';f['aula.json']=JSON.stringify(d);for(const ref of m.presentations)delete f[ref.path];m.presentations=[];const b=new TextEncoder().encode(f['aula.json']);m.files=[{path:'aula.json',bytes:b.length,sha256:await zip.sha256(b)}];});
 assert.equal((await parseLessonPackage(bytes,options(syntheticKit))).decks.length,0);
 });
 await t.test('valid package with one or three presentations',async()=>{
 for(const count of [1,3]){
 const bytes=await changed(async(f,m)=>{
 const d=JSON.parse(new TextDecoder().decode(f['aula.json']));
 if(count===1){const removed=m.presentations.pop();delete f[removed.path];d.activities.find(a=>a.key===removed.activityKey).content.resourceUrl='https://drive.google.com/file/d/material-sintetico/view';}
 else{const a=structuredClone(d.activities.find(a=>a.type==='slides'));a.key='slides-complementares';a.orderIndex=d.activities.length;const slot=syntheticKit.slots[2];a.content.resourceUrl=`${syntheticKit.origin}/apresentacoes/gerenciada/${slot.presentationId}`;d.activities.push(a);const path=`apresentacoes/${slot.key}.zip`;m.presentations.push({...slot,activityKey:a.key,path});f[path]=zip.createStoredZip([{path:'apresentacao.json',data:JSON.stringify({schemaVersion:1,title:'Complemento',slides:[{type:'concept',title:'Revisar',body:'Material complementar sintético.'}]})}]);}
 f['aula.json']=new TextEncoder().encode(JSON.stringify(d));m.files=[];for(const [path,data] of Object.entries(f)){if(path==='manifest.json')continue;m.files.push({path,bytes:data.length,sha256:await zip.sha256(data)});}
 });assert.equal((await parseLessonPackage(bytes,options(syntheticKit))).decks.length,count);
 }
 });
 await t.test('invalid outer size and corrupted CRC',async()=>{await assert.rejects(parseLessonPackage(new Uint8Array(lessonPackageLimits.zip+1),options(syntheticKit)),/limite/);const bad=original.slice();bad[50]^=1;await assert.rejects(parseLessonPackage(bad,options(syntheticKit)));});
});
