import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLearningBrowser} from './fixtures/learning-browser-harness.mjs';

test('report downloads in browser with local assets; failed assets can be retried',{timeout:90000},async t=>{
 const app=await createLearningBrowser(t);const {page}=app;
 await page.goto(`${app.appUrl}tests/fixtures/learning-browser.html`,{waitUntil:'domcontentloaded',timeout:60000});
 const data={studentName:'Aluno de teste',periodLabel:'outubro de 2026',hourlyRate:25,totalLessons:1,totalHours:1,totalAmount:25,grossAmount:25,discountAmount:0,lessons:[{title:'Introdução ao HTML',session_track:'course',starts_at:'2026-10-20T18:00:00-03:00',ends_at:'2026-10-20T19:00:00-03:00'}]};
 await page.route('**/assets/fonts/Inter.ttf*',route=>route.request().resourceType()==='fetch'?route.fulfill({status:503,body:'unavailable'}):route.continue());
 const error=await page.evaluate(async data=>{try{await (await import('/src/lib/lessonReportPdf.ts')).downloadLessonReportPdf(data);return null;}catch(e){return e.message;}},data);
 assert.match(error,/carregar os recursos/);
 await page.unroute('**/assets/fonts/Inter.ttf*');
 const downloadPromise=page.waitForEvent('download');
 await page.evaluate(async data=>(await import('/src/lib/lessonReportPdf.ts')).downloadLessonReportPdf(data),data);
 const download=await downloadPromise;
 assert.equal(download.suggestedFilename(),'relatorio-aulas-aluno-de-teste-outubro-de-2026.pdf');
 assert.equal(await download.failure(),null);
 await download.saveAs('test-results/lesson-report-browser.pdf');
 assert.deepEqual(app.pageErrors,[]);
});
