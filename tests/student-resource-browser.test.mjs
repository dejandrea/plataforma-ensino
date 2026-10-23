import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createLearningBrowser} from './fixtures/learning-browser-harness.mjs';
import {id} from './fixtures/learning-test-db.mjs';

test('student Drive preview runs the trusted viewer while the external link and explicit completion remain intact',{timeout:90000},async t=>{
 const app=await createLearningBrowser(t);const {page,query,appUrl}=app;
 await app.login('admin','postgres');
 const url='https://drive.google.com/file/d/1e7q-xbKNMMj8l8cCFXffv1K9TS1eBs_h/view?usp=drivesdk';
 await query("insert into lesson_activities(id,lesson_id,key,title,activity_type,order_index,is_required,content_json) select $3,lesson_id,'drive-preview-test','Slides do Drive','slides',99,false,jsonb_set(jsonb_set(content_json,'{resourceUrl}',to_jsonb($1::text)),'{format}','\"pdf\"') from lesson_activities where lesson_id=$2 and activity_type='slides' limit 1",[url,id(15),id(9700)]);
 await query("update lesson_activities set publication_status='published' where id=$1",[id(9700)]);
 if(process.env.TEST_LIVE_GOOGLE_PREVIEW==='1') {
  // Live verification must not replace Google's API/CDN responses with fixture text.
  await page.route('**/*',route=>route.continue());
 } else {
  await page.route('https://drive.google.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<html><body><script>document.body.textContent="Visualizador de PDF carregado para o aluno"</script></body></html>'}));
 }
 await page.goto(`${appUrl}tests/fixtures/learning-browser.html?lesson=${id(15)}`,{waitUntil:'domcontentloaded'});
 await page.getByRole('navigation',{name:'Atividades da aula'}).getByRole('button').filter({hasText:'Slides do Drive'}).click();
 const iframe=page.locator('iframe').first();await iframe.waitFor();
 const toggle=page.getByRole('navigation',{name:'Atividades da aula'}).getByRole('button').filter({hasText:'Slides do Drive'});
 assert.equal(await toggle.getAttribute('aria-expanded'),'true');
 const toggleBox=await toggle.boundingBox();const frameBox=await iframe.boundingBox();
 assert.ok(frameBox.width>toggleBox.width*0.85);assert.ok(frameBox.y>toggleBox.y);
 await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await page.locator('iframe').count(),0);
 await toggle.click();await iframe.waitFor();
 await page.setViewportSize({width:390,height:844});
 await page.locator('footer').scrollIntoViewIfNeeded();
 const progressBox=await page.getByRole('complementary',{name:'Progresso da aula'}).boundingBox();
 assert.ok(progressBox.y>=0&&progressBox.y+progressBox.height<=845);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 await page.screenshot({path:'test-results/lesson-column-mobile.png',fullPage:true});
 await page.setViewportSize({width:1365,height:1000});

 await iframe.scrollIntoViewIfNeeded();
 assert.equal(await iframe.getAttribute('src'),'https://drive.google.com/file/d/1e7q-xbKNMMj8l8cCFXffv1K9TS1eBs_h/preview');
 assert.equal(await iframe.getAttribute('sandbox'),'allow-scripts allow-same-origin');
 assert.equal(await page.getByRole('link',{name:/Abrir material de estudo/}).getAttribute('href'),url);
 if(process.env.TEST_LIVE_GOOGLE_PREVIEW==='1') {
  // Google positions the viewer outside the body's own bounding box.
  await page.frameLocator('iframe').locator('body').waitFor({state:'attached'});
  await page.waitForTimeout(7000);
  const body=await page.frameLocator('iframe').locator('body').innerText();
  assert.doesNotMatch(body,/Você precisa ter acesso|You need access|Request access/i);
  const frame=page.frames().find(item=>item.url().startsWith('https://drive.google.com/file/'));
  assert.ok(frame);assert.match(await frame.title(),/HTML-M01-S01-A01-slides\.pdf/);
  t.diagnostic(body.slice(0,500));
 } else await page.frameLocator('iframe').getByText('Visualizador de PDF carregado para o aluno',{exact:true}).waitFor();
 assert.equal((await query("select count(*) n from student_activity_progress where status='completed'")).rows[0].n,0);
 await mkdir('test-results',{recursive:true});await page.screenshot({path:`test-results/student-drive-preview${process.env.TEST_LIVE_GOOGLE_PREVIEW==='1'?'-live':''}.png`,fullPage:true});
 if(process.env.TEST_LIVE_GOOGLE_PREVIEW==='1')await iframe.screenshot({path:'test-results/student-drive-viewer-live.png'});
});
