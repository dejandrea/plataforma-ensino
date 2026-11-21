import fs from 'node:fs';
import crypto from 'node:crypto';
const root='test-results/content-workspace';
const baseline=JSON.parse(fs.readFileSync(root+'/frontend-manifest.json'));
const changed=['src/pages/LessonEditor.tsx','src/components/learning/UnifiedLessonImporter.tsx'];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
for(const file of baseline.frontend){
 const published=fs.readFileSync(root+'/deploy-source/'+file.path);
 if(sha(published)!==file.sha256)throw Error('Baseline publicada divergente');
 const bytes=changed.includes(file.path)?fs.readFileSync(file.path):published;
 if(!changed.includes(file.path)&&sha(fs.readFileSync(root+'/frontend/'+file.path))!==file.sha256)throw Error('Alteração fora do escopo: '+file.path);
 if(changed.includes(file.path))fs.writeFileSync(root+'/frontend/'+file.path,bytes);
 file.bytes=bytes.length;file.sha256=sha(bytes);
}
const manifest={baselineDeployment:'dpl_9rHL9iBEQVax3ohtThi3LB1GeruD',changedSinceBaseline:changed,frontend:baseline.frontend};
const bytes=JSON.stringify(manifest,null,2)+'\n';
fs.writeFileSync(root+'/frontend-manifest-import-button.json',bytes);
console.log(JSON.stringify({files:manifest.frontend.length,changed:changed.length,sha256:sha(bytes)}));
