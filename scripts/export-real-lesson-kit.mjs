import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import crypto from 'node:crypto';
import ts from 'typescript';
import * as zip from '../public/apresentacoes/zip.js';

// Export only: load the existing exporter without a Supabase client or RPC transport.
function load(file){
 const full=path.resolve(file),require=createRequire(full),module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const resolve=specifier=>{
  if(specifier==='./supabaseClient')return {supabase:{}};
  if(specifier==='./learningContent')return load('src/lib/learningContent.ts');
  if(specifier.endsWith('?raw'))return fs.readFileSync(path.resolve(path.dirname(full),specifier.slice(0,-4)),'utf8');
  return require(specifier);
 };
 new Function('require','module','exports',code)(resolve,module,module.exports);
 return module.exports;
}
const kit=JSON.parse(fs.readFileSync('test-results/content-workspace/real-lesson-kit.json','utf8'));
if(kit.lesson_id!=='b17a2000-0000-4000-8000-000000001003'||kit.origin!=='https://plataforma-ensino-chi.vercel.app'||kit.inventory.length||kit.slots.length!==3)throw Error('Identidade ou inventário divergente');
const tools=load('src/lib/lessonPackages.ts');
const bytes=await tools.exportProductionKit(kit,zip,JSON.parse(fs.readFileSync('public/apresentacoes/presentation.schema.json','utf8')));
const entries=await zip.readZipArchive(bytes,{zip:1024*1024,entries:10,total:1024*1024,ratio:100},()=>({limit:1024*1024}));
const identity=JSON.parse(new TextDecoder().decode(entries.find(entry=>entry.path==='identidade.json').data));
if(entries.length!==7||identity.lesson_id!==kit.lesson_id||identity.origin!==kit.origin||JSON.stringify(identity.slots)!==JSON.stringify(kit.slots))throw Error('Integridade ou identidade do ZIP divergente');
for(const entry of entries.filter(entry=>entry.path.startsWith('schemas/')))JSON.parse(new TextDecoder().decode(entry.data));
fs.mkdirSync('exports',{recursive:true});
const file='exports/kit-work-aula-03-internet-web.zip';
fs.writeFileSync(file,bytes);
const result={file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),lessonId:kit.lesson_id,lessonTitle:kit.lesson.title,origin:kit.origin,zipIntegrityVerified:true,entries:entries.map(entry=>entry.path),existingExporterUsed:true,noSupabaseClient:true,noImportOrPublication:true};
fs.writeFileSync('test-results/content-workspace/real-kit-export.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
