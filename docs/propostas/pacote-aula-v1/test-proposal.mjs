import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url));
const validator=path.join(here,'validate-proposal.mjs');
const json=async f=>JSON.parse(await readFile(f,'utf8'));
const save=async(f,d)=>writeFile(f,JSON.stringify(d,null,2)+'\n','utf8');
const sha=b=>createHash('sha256').update(b).digest('hex');
for(const name of ['minimo','completo'])test('valid documentation example: '+name,()=>{
 const report=JSON.parse(execFileSync(process.execPath,[validator,path.join(here,'exemplos',name)],{encoding:'utf8',stdio:'pipe',windowsHide:true}));
 assert.equal(report.status,'PROPOSTA_ESTRUTURALMENTE_VALIDA');assert.equal(report.publicProjectionExcludesTeacherOnly,true);
});
const cases=[
 ['unsupported-manifest','MANIFEST_INVALID',async(folder,m)=>{m.publish=true;}],
 ['changed-bytes','FILE_INTEGRITY',async(folder,m)=>{await writeFile(path.join(folder,'aula.json'),'{}');}],
 ['unknown-activity-binding','BINDING_INVALID',async(folder,m)=>{m.presentations[0].activityKey='atividade-inexistente';}],
 ['duplicate-key','LESSON_INVALID',async(folder,m)=>{const f=path.join(folder,'aula.json');const d=await json(f);d.activities[1].key=d.activities[0].key;await save(f,d);const b=await readFile(f);Object.assign(m.files.find(x=>x.path==='aula.json'),{bytes:b.length,sha256:sha(b)});}],
 ['private-folder','PATH_INVALID',async(folder,m)=>{await mkdir(path.join(folder,'professor'));await writeFile(path.join(folder,'professor','gabarito.md'),'Apenas sintético');}],
 ['invalid-deck','PRESENTATION_INVALID',async(folder,m)=>{const p=m.presentations[0].path;const b=Buffer.from('not-a-zip');await writeFile(path.join(folder,p),b);Object.assign(m.files.find(x=>x.path===p),{bytes:b.length,sha256:sha(b)});}],
 ['teacher-link-public','PRIVACY_INVALID',async(folder,m)=>{const f=path.join(folder,'aula.json');const d=await json(f);d.lesson.description=m.teacherResources[0].url;await save(f,d);const b=await readFile(f);Object.assign(m.files.find(x=>x.path==='aula.json'),{bytes:b.length,sha256:sha(b)});}]
];
for(const [name,code,mutate] of cases)test('invalid proposal example: '+name,async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'bitaria-contract-example-'));await cp(path.join(here,'exemplos','completo'),folder,{recursive:true});
 const m=await json(path.join(folder,'manifest.json'));await mutate(folder,m);await save(path.join(folder,'manifest.json'),m);
 let output='';try{execFileSync(process.execPath,[validator,folder],{encoding:'utf8',stdio:'pipe',windowsHide:true});assert.fail('Invalid example was accepted');}catch(e){assert.ok(e.status>0);output=String(e.stderr);}
 assert.ok(output.includes(code),output);
});
