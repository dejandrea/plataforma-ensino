import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';

const root=path.resolve('test-results/content-workspace'),folder=path.join(root,'frontend');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'frontend-manifest.json'),'utf8'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
for(const file of manifest.frontend){
 const full=path.join(folder,file.path);
 if(sha(fs.readFileSync(full))!==file.sha256)throw Error(`Hash divergente: ${file.path}`);
 if(!/\.[cm]?[jt]sx?$/.test(file.path))continue;
 const imports=ts.preProcessFile(fs.readFileSync(full,'utf8'),true,true).importedFiles;
 for(const item of imports){
  if(!item.fileName.startsWith('.'))continue;
  const target=path.resolve(path.dirname(full),item.fileName.split('?')[0]);
  if(!['','.ts','.tsx','.js','.jsx','.json','/index.ts','/index.tsx','/index.js'].some(suffix=>fs.existsSync(target+suffix)))throw Error(`Dependência ausente: ${file.path} → ${item.fileName}`);
 }
}
const production=parseEnv(fs.readFileSync('test-results/implantacao-e1a-e2a-20261120/frontend/.vercel/.env.production.local','utf8'));
const url=production.VITE_SUPABASE_URL,key=production.VITE_SUPABASE_ANON_KEY;
if(url!=='https://gnyiyhnbpjhdgrhsevbh.supabase.co'||!key)throw Error('Configuração de produção ausente ou divergente');
const log=fs.openSync(path.join(root,'isolated-build.log'),'w');
const stages=[];
for(const [command,args] of [['npm.cmd',['ci','--include=dev']],['npm.cmd',['run','build']]]){
 const start=Date.now();
 const result=spawnSync(command,args,{cwd:folder,shell:true,env:{...process.env,NODE_ENV:'production',VITE_SUPABASE_URL:url,VITE_SUPABASE_ANON_KEY:key},stdio:['ignore',log,log]});
 stages.push({command:[command,...args].join(' '),exitCode:result.status,milliseconds:Date.now()-start});
 if(result.status!==0){fs.closeSync(log);throw Error(`Falha no build isolado: ${stages.at(-1).command}. Consulte isolated-build.log.`);}
}
fs.closeSync(log);
const html=fs.readFileSync(path.join(folder,'dist/index.html'),'utf8'),entry=html.match(/src="([^"\s]+\.js)"/)[1];
const bytes=fs.readFileSync(path.join(folder,'dist',entry));
if(!bytes.includes(Buffer.from(url)))throw Error('Destino Supabase ausente no bundle');
const result={passed:true,sourceFiles:manifest.frontend.length,relativeImportsResolved:true,productionConfigured:true,supabaseProject:'gnyiyhnbpjhdgrhsevbh',manifestSha256:sha(fs.readFileSync(path.join(root,'frontend-manifest.json'))),stages,entry,entrySha256:sha(bytes)};
fs.writeFileSync(path.join(root,'isolated-build.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
