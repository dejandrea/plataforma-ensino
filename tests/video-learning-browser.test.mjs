import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLearningBrowser} from './fixtures/learning-browser-harness.mjs';
import {prepareVideoLesson} from './fixtures/video-content.mjs';

const viewer='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body style="margin:0;display:grid;place-content:center;min-height:100vh;background:#111022;color:#ddd8ef;font:14px sans-serif;text-align:center"><div style="font-size:30px" aria-hidden="true">▶</div><p>Vídeo de demonstração HTML</p><small>Visualizador do Drive simulado no teste local</small></body></html>';

test('admin imports video, previews without writes; student concludes manually with ten XP on desktop/mobile',{timeout:120000},async t=>{
  const app=await createLearningBrowser(t,{video:true});const {page,appUrl,query}=app;
  const {document,lessonId}=await prepareVideoLesson(app);
  await page.route('https://drive.google.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:viewer}));
  app.setIdentity('admin');
  await page.goto(`${appUrl}tests/fixtures/learning-browser.html?mode=import&lesson=${lessonId}&title=${encodeURIComponent(document.lesson.title)}`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByRole('textbox',{name:'Conteúdo JSON'}).fill(JSON.stringify(document));
  await page.getByText('Contrato v2 válido',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Visualizar resultado como aluno',exact:true}).click();
  await page.getByRole('navigation',{name:'Atividades da aula'}).getByRole('button').filter({hasText:document.activities[0].title}).click();
  await page.locator('iframe').waitFor();
  await page.locator('iframe').scrollIntoViewIfNeeded();
  await page.frameLocator('iframe').getByText('Vídeo de demonstração HTML',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Concluir vídeo',exact:true}).isDisabled(),true);
  assert.equal(await page.getByText('8 min estimados',{exact:true}).count()>0,true);
  assert.equal(app.requests.length,0);
  await page.screenshot({path:'test-results/video-admin-preview.png',fullPage:true});
  await page.getByRole('button',{name:'Importar atividades',exact:true}).click();
  await page.getByText('Rascunho importado. Confira a prévia antes de publicar.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Publicar atividades importadas',exact:true}).click();
  await page.getByText('Atividades publicadas.',{exact:true}).waitFor();
  assert.equal(app.requests.some(r=>/^(start_student|complete_student|submit_student|begin_student)/.test(r.name)),false);
  const video=app.requests.find(r=>r.name==='import_learning_lesson').params.p_document.activities[0];
  assert.deepEqual(video,document.activities[0]);
  app.setIdentity('student');
  await page.goto(`${appUrl}tests/fixtures/learning-browser.html?lesson=${lessonId}`,{waitUntil:'domcontentloaded',timeout:60000});
  const frame=page.locator('iframe');await frame.waitFor();
  assert.equal(await frame.getAttribute('src'),'https://drive.google.com/file/d/EXEMPLO_VIDEO_ID/preview?resourcekey=EXEMPLO_CHAVE');
  assert.equal(await frame.getAttribute('sandbox'),'allow-scripts allow-same-origin');
  assert.equal(await frame.getAttribute('allow'),'fullscreen');
  assert.equal(await frame.getAttribute('title'),`Vídeo: ${video.title}`);
  assert.equal(await page.getByRole('link',{name:'Abrir vídeo em nova aba ↗'}).getAttribute('href'),video.content.resourceUrl);
  assert.equal(await page.getByRole('button',{name:'Concluir aula',exact:true}).isDisabled(),true);
  assert.equal(await app.count('student_xp_events',`where source_id in (select id from lesson_activities where lesson_id='${lessonId}')`),0);
  await frame.scrollIntoViewIfNeeded();
  await page.screenshot({path:'test-results/video-student-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  const box=await frame.boundingBox();assert.ok(box.width>200&&box.width<391);assert.ok(Math.abs(box.width/box.height-16/9)<0.06);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.screenshot({path:'test-results/video-student-mobile.png',fullPage:true});
  // Drive failures are inside a cross-origin frame: recovery must remain available
  // even when the browser does not emit an iframe error event.
  await page.route('https://drive.google.com/**',route=>route.fulfill({status:403,contentType:'text/html; charset=utf-8',body:'<p>Arquivo indisponível ou sem permissão.</p>'}));
  await page.getByRole('button',{name:'Recarregar vídeo',exact:true}).click();await frame.waitFor();
  await page.getByText('Se o vídeo não carregar ou o Google pedir acesso, abra em nova aba.',{exact:false}).waitFor();
  await page.route('https://drive.google.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:viewer}));
  await page.getByRole('button',{name:'Recarregar vídeo',exact:true}).click();await frame.waitFor();
  assert.equal(app.requests.some(r=>r.name==='complete_student_study'),false);
  // A failed completion remains retryable; the retry sends only the activity id.
  await page.route('**/rpc/complete_student_study',async route=>{
    await page.unroute('**/rpc/complete_student_study');
    await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'Falha temporária ao salvar o vídeo',code:'22023'})});
  });
  await page.getByRole('button',{name:'Concluir vídeo',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Falha temporária ao salvar o vídeo'}).waitFor();
  const complete=page.getByRole('button',{name:'Concluir vídeo',exact:true});await complete.focus();await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'Vídeo concluído',exact:true}).waitFor();
  const saved=app.requests.find(r=>r.name==='complete_student_study');assert.deepEqual(Object.keys(saved.params),['p_activity_id']);
  const receipt=async()=>(await query("select points from student_xp_events where source_id=$1 and event_type='learning_activity'",[saved.params.p_activity_id])).rows;
  assert.deepEqual(await receipt(),[{points:10}]);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('navigation',{name:'Atividades da aula'}).getByRole('button').filter({hasText:document.activities[0].title}).click();
  await page.getByRole('button',{name:'Vídeo concluído',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Vídeo concluído',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'Recarregar vídeo',exact:true}).click();
  assert.deepEqual(await receipt(),[{points:10}]);assert.deepEqual(app.pageErrors,[]);
});

test('saved admin video preview rejects invalid links and never calls student mutations',{timeout:90000},async t=>{
  const app=await createLearningBrowser(t,{video:true});const {page,appUrl,query}=app;
  const {document,lessonId}=await prepareVideoLesson(app);
  const result=await app.rpc('import_learning_lesson',[lessonId,JSON.stringify(document),false]);
  const rows=(await query('select * from lesson_activities where lesson_id=$1 order by order_index',[lessonId])).rows;
  app.setIdentity('admin');
  let invalid=false;
  await page.route('**/rest/v1/lesson_activities?*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows.map(row=>row.id===result.activityIds[0]&&invalid?{...row,content_json:{...row.content_json,resourceUrl:'https://evil.example/video'}}:row))}));
  await page.route('https://drive.google.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:viewer}));
  const url=`${appUrl}tests/fixtures/learning-browser.html?mode=preview&lesson=${lessonId}`;
  await page.goto(url);await page.locator('iframe').waitFor();
  assert.equal(await page.getByRole('button',{name:'Concluir vídeo',exact:true}).isDisabled(),true);
  invalid=true;await page.reload();await page.getByRole('alert').filter({hasText:'Vídeo indisponível'}).waitFor();
  assert.equal(await page.locator('iframe').count(),0);
  assert.equal(await page.getByRole('link',{name:'Abrir vídeo em nova aba ↗'}).count(),0);
  assert.equal(app.requests.length,0);
  assert.equal(await app.count('student_activity_progress',`where activity_id='${result.activityIds[0]}'`),0);
  assert.equal(await app.count('student_xp_events',`where source_id='${result.activityIds[0]}'`),0);
  assert.deepEqual(app.pageErrors,[]);
});
