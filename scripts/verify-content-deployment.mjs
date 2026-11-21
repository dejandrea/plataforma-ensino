import fs from 'node:fs';
import crypto from 'node:crypto';
const origin=process.argv[2];
if(!['https://plataforma-ensino-4o0l7nwvq-andrea-francas-projects.vercel.app','https://plataforma-ensino-chi.vercel.app'].includes(origin))throw Error('Destino inesperado');
const response=await fetch(origin);
if(!response.ok)throw Error('Frontend inacessível: '+response.status);
const html=await response.text(),entry=html.match(/src="([^"\s]+\.js)"/)[1];
const js=await fetch(new URL(entry,origin)).then(r=>r.text());
const projects=[...new Set(js.match(/https:\/\/[a-z0-9]+\.supabase\.co/g)||[])];
if(projects.length!==1||projects[0]!=='https://gnyiyhnbpjhdgrhsevbh.supabase.co'||!js.includes('/gestao/aulas/:lessonId')||!js.includes('/gestao/conteudo'))throw Error('Bundle ou destino divergente');
const editor=js.match(/LessonEditor-[A-Za-z0-9_-]+\.js/)[0];
const tool=await fetch(origin+'/assets/'+editor).then(r=>r.text());
if(!['Visão geral','Atividades','Importar','Publicação'].every(s=>tool.includes(s)))throw Error('Editor ausente no bundle');
const routes=[];
for(const route of ['/gestao/conteudo','/gestao/aulas/b17a2000-0000-4000-8000-000000001003']){
 const r=await fetch(origin+route);
 if(r.status!==200||!(await r.text()).includes(entry))throw Error('Rota sem fallback SPA');
 routes.push({route,status:r.status});
}
const result={deployment:'dpl_9rHL9iBEQVax3ohtThi3LB1GeruD',origin,passed:true,entry,entrySha256:crypto.createHash('sha256').update(js).digest('hex'),supabaseProject:'gnyiyhnbpjhdgrhsevbh',editorChunk:editor,routes,noDatabaseWrites:true};
fs.writeFileSync('test-results/content-workspace/'+(origin.includes('-chi.')?'production-bundle.json':'new-deployment-bundle.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
