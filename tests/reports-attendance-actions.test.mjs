import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLearningBrowser} from './fixtures/learning-browser-harness.mjs';
import {id} from './fixtures/learning-test-db.mjs';

test('attendance owns subject/status edits; history stays read-only and filters persist',{timeout:120000},async t=>{
 const app=await createLearningBrowser(t);const {page}=app;
 const rows=[
  {id:id(17),title:'Assunto original',status:'completed',teacher_id:id(3),student_id:id(1),session_track:'mentoring',starts_at:'2026-10-20T18:00:00-03:00',ends_at:'2026-10-20T19:00:00-03:00',started_at:'2026-10-20T18:01:00-03:00',student_joined_at:null,teacher_joined_at:null},
  {id:id(18),title:'Aula cancelada de teste',status:'cancelled',teacher_id:id(3),student_id:id(1),session_track:'mentoring',starts_at:'2026-10-18T18:00:00-03:00',ends_at:'2026-10-18T19:00:00-03:00'},
 ];
 const mutations=[];
 await page.route('**/rest/v1/**',async route=>{
  const url=new URL(route.request().url()),table=url.pathname.split('/').at(-1);let body=[];
  if(table==='profiles')body=url.searchParams.has('id')?{id:id(5),role:'admin',full_name:'Gestão'}:url.searchParams.get('role')==='eq.student'?[{id:id(1),full_name:'Aluno de teste',hourly_rate:50}]:[{id:id(3),full_name:'Professora'}];
  if(table==='scheduled_lessons'){
   if(route.request().method()==='PATCH'){
    const update=route.request().postDataJSON();assert.deepEqual(Object.keys(update),['title']);assert.equal(url.searchParams.get('status'),'eq.completed');
    const row=rows.find(r=>`eq.${r.id}`===url.searchParams.get('id'));row.title=update.title;mutations.push(update);body={title:row.title};
   }else body=rows;
  }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.route('**/functions/v1/update-lesson-history-status',async route=>{
  const {lessonId,status}=route.request().postDataJSON();mutations.push({lessonId,status});
  const row=rows.find(r=>r.id===lessonId);row.status=status;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({lesson:row})});
 });
 await page.goto(`${app.appUrl}tests/fixtures/learning-browser.html?mode=reports`,{waitUntil:'domcontentloaded',timeout:60000});
 await page.getByRole('heading',{name:'Presença e acompanhamento das aulas'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Editar título/assunto',exact:true}).count(),1);
 assert.equal(await page.getByRole('button',{name:'Marcar como cancelada',exact:true}).count(),1);
 assert.equal(await page.getByRole('combobox',{name:'Status da aula'}).inputValue(),'completed');
 assert.equal(await page.getByRole('button',{name:'Marcar como concluída',exact:true}).count(),0);
 await page.getByRole('button',{name:'Editar título/assunto',exact:true}).click();
 await page.getByRole('textbox',{name:'Título/assunto da aula'}).fill('Figma: componentes e variantes');
 await page.getByRole('button',{name:'Salvar título/assunto'}).click();await page.getByRole('heading',{name:'Figma: componentes e variantes',exact:true}).waitFor();
 await page.getByRole('button',{name:'Marcar como cancelada',exact:true}).click();
 await page.getByRole('status').filter({hasText:'marcada como cancelada'}).waitFor();
 await page.getByRole('combobox',{name:'Status da aula'}).selectOption('cancelled');
 assert.equal(await page.getByRole('button',{name:'Marcar como concluída',exact:true}).count(),2);
 await page.getByRole('button',{name:'Marcar como concluída',exact:true}).first().click();
 await page.getByRole('status').filter({hasText:'marcada como concluída'}).waitFor();
 await page.getByRole('button',{name:'Limpar filtros',exact:true}).click();
 assert.equal(await page.getByRole('combobox',{name:'Status da aula'}).inputValue(),'completed');
 await page.getByRole('button',{name:'Historico',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:/Editar título|Marcar como/}).count(),0);
 await page.getByRole('heading',{name:'Figma: componentes e variantes',exact:true}).waitFor();
 await page.getByRole('button',{name:'Presenca',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'test-results/reports-attendance-actions-mobile.png',fullPage:true});
 assert.equal(mutations.length,3);assert.deepEqual(app.pageErrors,[]);
});
