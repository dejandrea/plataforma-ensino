import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLearningBrowser} from './fixtures/learning-browser-harness.mjs';
import {readSql,id,fixtureUsers} from './fixtures/learning-test-db.mjs';

test('completed lesson subject saves with existing RLS, preserves other fields and rejects stale status',{timeout:120000},async t=>{
 const app=await createLearningBrowser(t);const {page,db,query,login}=app;
 const sql=readSql('supabase/migrations/202605211530_add_scheduled_lessons.sql');
 await db.exec('alter table scheduled_lessons add column created_by uuid; alter table scheduled_lessons enable row level security; grant update on scheduled_lessons to authenticated;');
 await db.exec(sql.slice(sql.indexOf('drop policy if exists scheduled_lessons_admin_all'),sql.indexOf('create table if not exists public.lesson_access_logs')));
 await query("update scheduled_lessons set status='completed' where id=$1",[id(17)]);
 const initial=(await query('select * from scheduled_lessons where id=$1',[id(17)])).rows[0];
 for(const user of ['student','stranger']){
  await login(user);assert.equal((await query('update scheduled_lessons set title=$1 where id=$2 returning id',['forged',id(17)])).rows.length,0);
 }
 await login('teacher');assert.equal((await query('update scheduled_lessons set title=$1 where id=$2 returning id',[initial.title,id(17)])).rows.length,1);
 await login('admin','postgres');
 const mutations=[];
 await page.route('**/rest/v1/scheduled_lessons?*',async route=>{
  const request=route.request(),url=new URL(request.url()),body=request.postDataJSON();
  assert.equal(request.method(),'PATCH');assert.equal(url.searchParams.get('status'),'eq.completed');
  assert.equal(url.searchParams.get('id'),`eq.${id(17)}`);assert.deepEqual(Object.keys(body),['title']);mutations.push(body);
  const row=await db.transaction(async tx=>{
   await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[fixtureUsers.teacher]);
   return (await tx.query("update scheduled_lessons set title=$1 where id=$2 and status='completed' returning title",[body.title,id(17)])).rows[0];
  });
  await route.fulfill({status:row?200:406,contentType:'application/json',body:JSON.stringify(row??{message:'No matching row',code:'PGRST116'})});
 });
 await page.goto(`${app.appUrl}tests/fixtures/learning-browser.html?mode=lesson-title&lesson=${id(17)}`,{waitUntil:'domcontentloaded',timeout:60000});
 await page.getByRole('button',{name:'Editar título/assunto',exact:true}).click();
 const input=page.getByRole('textbox',{name:'Título/assunto da aula'});
 await input.fill('Rascunho descartado');await page.getByRole('button',{name:'Cancelar edição'}).click();assert.equal(mutations.length,0);
 await page.getByRole('button',{name:'Editar título/assunto',exact:true}).click();await input.fill('   ');
 assert.equal(await page.getByRole('button',{name:'Salvar título/assunto'}).isDisabled(),true);
 const title='Introdução ao Figma: componentes e organização';await input.fill(`  ${title}  `);
 await page.getByRole('button',{name:'Salvar título/assunto'}).click();await page.getByRole('heading',{name:title,exact:true}).waitFor();
 const saved=(await query('select * from scheduled_lessons where id=$1',[id(17)])).rows[0];assert.deepEqual(saved,{...initial,title});
 await page.screenshot({path:'test-results/completed-lesson-title.png'});
 await page.getByRole('button',{name:'Editar título/assunto',exact:true}).click();await input.fill('Não deve salvar');
 await query("update scheduled_lessons set status='cancelled' where id=$1",[id(17)]);
 await page.getByRole('button',{name:'Salvar título/assunto'}).click();await page.getByRole('alert').waitFor();
 assert.equal((await query('select title from scheduled_lessons where id=$1',[id(17)])).rows[0].title,title);
 assert.deepEqual(app.pageErrors,[]);
});
