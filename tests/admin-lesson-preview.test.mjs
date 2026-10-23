import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLearningBrowser} from './fixtures/learning-browser-harness.mjs';
import {id} from './fixtures/learning-test-db.mjs';

test('admin opens saved activities including drafts without student mutations',{timeout:90000},async t=>{
  const app=await createLearningBrowser(t);const {page,query,appUrl}=app;
  app.setIdentity('admin');await app.login('admin','postgres');
  const {rows}=await query('select * from lesson_activities where lesson_id=$1 order by order_index',[id(15)]);
  assert.ok(rows.length);
  rows[0].publication_status='draft';
  await page.route('**/rest/v1/lesson_activities?*',route=>{
    const url=new URL(route.request().url());
    assert.equal(url.searchParams.get('lesson_id'),`eq.${id(15)}`);
    assert.ok(!url.searchParams.get('select').includes('quiz_keys'));
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows)});
  });
  await page.goto(`${appUrl}tests/fixtures/learning-browser.html?mode=preview&lesson=${id(15)}`);
  await page.getByText('Rascunho',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Confirmar estudo',exact:true}).isDisabled(),true);
  await page.screenshot({path:'test-results/admin-saved-lesson-preview.png',fullPage:true});
  const quiz=rows.find(r=>r.activity_type==='quiz');assert.ok(quiz);
  await page.getByRole('navigation').getByRole('button').filter({hasText:quiz.title}).first().click();
  await page.getByRole('radio').first().check();
  assert.equal(app.requests.some(r=>/^(start_student|begin_student|submit_student|complete_student)/.test(r.name)),false);
  assert.deepEqual(app.pageErrors,[]);
});

