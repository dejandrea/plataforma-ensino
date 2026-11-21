import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Reuse the exact published frontend and overlay only the scoped UX change.
const base='test-results/implantacao-e1a-e2a-20261120';
const output='test-results/content-workspace';
const baseline=JSON.parse(fs.readFileSync(`${base}/frontend-manifest-311.json`,'utf8'));
const changed=['src/App.tsx','src/pages/SystemManagement.tsx','src/components/management/TabContent.tsx','src/components/learning/EditorialLessonEditor.tsx','src/components/learning/UnifiedLessonImporter.tsx','src/components/learning/LessonContentImporter.tsx','src/components/management/WebPresentationManager.tsx','src/components/management/CurriculumLessonPublication.tsx'];
const added=['src/lib/lessonWorkspace.ts','src/lib/lessonChanges.ts','src/components/management/LessonChanges.tsx','src/pages/ContentCurriculum.tsx','src/pages/LessonEditor.tsx'];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const files=[];
for(const item of baseline.frontend){
 const frozen=fs.readFileSync(`${base}/frontend/${item.path}`);
 if(sha(frozen)!==item.sha256)throw Error(`Baseline divergente: ${item.path}`);
 const bytes=changed.includes(item.path)?fs.readFileSync(item.path):frozen;
 files.push({path:item.path,bytes:bytes.length,sha256:sha(bytes)});
 const destination=`${output}/frontend/${item.path}`;fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes);
}
for(const file of added){const bytes=fs.readFileSync(file),destination=`${output}/frontend/${file}`;fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes);files.push({path:file,bytes:bytes.length,sha256:sha(bytes)});}
if(files.length!==316)throw Error('Contagem inesperada');
const manifest={baselineManifestSha256:sha(fs.readFileSync(`${base}/frontend-manifest-311.json`)),changed,added,frontend:files.sort((a,b)=>a.path.localeCompare(b.path))};
const bytes=JSON.stringify(manifest,null,2)+'\n';fs.writeFileSync(`${output}/frontend-manifest.json`,bytes);fs.writeFileSync(`${output}/frontend-manifest.sha256`,sha(bytes)+'\n');
console.log(JSON.stringify({files:files.length,modified:changed.length,added:added.length,manifestSha256:sha(bytes)}));
