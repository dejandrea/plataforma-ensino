import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createLearningBrowser} from './fixtures/learning-browser-harness.mjs';
import {id} from './fixtures/learning-test-db.mjs';

test('C browser: private teaching panel autosaves, resumes, handles failures and confirms separately', {timeout:120000},async t=>{
  const app=await createLearningBrowser(t,{teacher:true});
  const {page,query,appUrl,setIdentity,pageErrors}=app;
  setIdentity('teacher');
  const open=async(status='scheduled')=>{
    await page.goto(`${appUrl}tests/fixtures/learning-browser.html?mode=teacher&lesson=${id(17)}&status=${status}`);
    await page.getByRole('article').first().waitFor();
  };
  await open();
  const article=page.getByRole('article').filter({hasText:'Minha primeira página HTML'});
  const checkbox=article.getByRole('checkbox').first();
  await checkbox.check();
  await article.getByLabel('Observações da professora',{exact:true}).fill('Registro privado do encontro.');
  await article.getByLabel('Compreensão dos conceitos',{exact:true}).selectOption('developing');
  await article.getByLabel('Dificuldades identificadas (uma por linha)',{exact:true}).fill('Seletores\nEstrutura');
  await article.getByLabel('Recomendações para o próximo encontro (uma por linha)',{exact:true}).fill('Revisar HTML');
  await article.getByRole('group',{name:'Etapas que precisam ser retomadas'}).getByRole('checkbox').first().check();
  await article.getByText('Registro salvo.',{exact:true}).waitFor();
  await page.reload();await article.waitFor();
  assert.equal(await checkbox.isChecked(),true);
  assert.equal(await article.getByLabel('Observações da professora',{exact:true}).inputValue(),'Registro privado do encontro.');
  assert.equal(await article.getByLabel('Compreensão dos conceitos',{exact:true}).inputValue(),'developing');
  assert.equal(await article.getByLabel('Dificuldades identificadas (uma por linha)',{exact:true}).inputValue(),'Seletores\nEstrutura');
  assert.equal(await article.getByRole('button',{name:'Confirmar atividade curricular do aluno'}).isDisabled(),true);
  assert.equal((await query('select count(*) n from student_activity_progress where activity_id=$1',[id(33)])).rows[0].n,0);
  // Simulate a rejected save once; preserve the teacher's draft and allow retry.
  let fail=true;
  await page.route('**/rpc/save_teacher_learning_session',async route=>{
    if(fail){fail=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Falha de rede simulada'})});}
    else await route.continue();
  });
  await article.getByLabel('Observações da professora',{exact:true}).fill('Observação recuperada após falha.');
  await article.getByRole('alert').waitFor();
  assert.equal(await article.getByLabel('Observações da professora',{exact:true}).inputValue(),'Observação recuperada após falha.');
  await article.getByRole('button',{name:'Tentar salvar novamente'}).click();
  await article.getByText('Registro salvo.',{exact:true}).waitFor();
  await page.getByLabel('Vincular atividade curricular').selectOption(id(81));
  await page.getByRole('button',{name:'Vincular plano ao encontro'}).click();
  await page.waitForFunction(()=>document.querySelectorAll('article').length===2);
  assert.equal((await query('select count(*) n from student_activity_progress where activity_id=$1',[id(33)])).rows[0].n,0);
  await app.login('admin','postgres');await query("update scheduled_lessons set status='completed' where id=$1",[id(17)]);
  await open('completed');
  await article.getByRole('button',{name:'Confirmar atividade curricular do aluno'}).click();
  await article.getByText(/Atividade curricular confirmada em/).waitFor();
  await page.reload();await article.getByText(/Atividade curricular confirmada em/).waitFor();
  assert.equal((await query('select count(*) n from student_activity_progress where activity_id=$1 and status=\'completed\'',[id(33)])).rows[0].n,1);
  await mkdir('test-results',{recursive:true});
  await article.locator('details').nth(1).locator('summary').click();
  await page.screenshot({path:'test-results/teacher-learning-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'test-results/teacher-learning-mobile.png',fullPage:true});
  assert.deepEqual(pageErrors,[]);
  setIdentity('student');
  await page.goto(`${appUrl}tests/fixtures/learning-browser.html?mode=teacher&lesson=${id(17)}`);
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByRole('article').count(),0);
  assert.equal((await page.locator('body').innerText()).includes('Observação recuperada'),false);
});
