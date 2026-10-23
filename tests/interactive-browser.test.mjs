import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLearningBrowser} from './fixtures/learning-browser-harness.mjs';
import {prepareInteractiveContent} from './fixtures/interactive-content.mjs';

test('B1 browser: admin preview/import, persistent randomization, keyboard/mobile interactions and XP', {timeout:90000},async t=>{
  const app=await createLearningBrowser(t);
  const {page,appUrl,setIdentity,query,pageErrors}=app;
  const {document,lessonId}=await prepareInteractiveContent(app,{importContent:false,document:JSON.parse(readFileSync('docs/examples/maquinas-interativas.v2.json','utf8'))});
  setIdentity('admin');
  await page.goto(`${appUrl}tests/fixtures/learning-browser.html?mode=import&lesson=${lessonId}&title=${encodeURIComponent(document.lesson.title)}`,{waitUntil:'domcontentloaded'});
  await page.getByRole('textbox',{name:'Conteúdo JSON',exact:true}).fill(JSON.stringify(document));
  await page.getByRole('region',{name:'Prévia pública das atividades'}).waitFor();
  await page.getByRole('button',{name:'Visualizar resultado como aluno',exact:true}).click();
  const adminPreview=page.getByRole('region',{name:'Visualiza\u00e7\u00e3o como aluno',exact:true});
  await adminPreview.getByRole('button').filter({hasText:document.activities[0].title}).click();
  await adminPreview.getByText(document.activities[0].content.instructions,{exact:true}).waitFor();
  assert.equal(app.requests.some(r=>/^(start_student|begin_student|submit_student|complete_student)/.test(r.name)),false);
  await page.getByRole('button',{name:'Importar atividades',exact:true}).click();
  await page.getByText('Rascunho importado. Confira a prévia antes de publicar.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Publicar atividades importadas',exact:true}).click();
  await page.getByText('Atividades publicadas.',{exact:true}).waitFor();
  setIdentity('student');
  const open=async()=>{
    await page.goto(`${appUrl}tests/fixtures/learning-browser.html?lesson=${lessonId}`,{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:document.lesson.title,exact:true}).waitFor();
  };
  await open();
  const list=page.getByRole('list',{name:'Sequência de itens'});
  await list.waitFor();
  const ids=()=>list.locator('li').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-item-id')));
  const first=await ids();
  const moveButton=list.getByRole('button',{name:/para baixo$/}).first();
  await moveButton.focus();await page.keyboard.press('Enter');
  const changed=await ids();assert.notDeepEqual(changed,first);
  await page.reload();await list.waitFor();assert.deepEqual(await ids(),changed);
  const expected=document.teacherOnly.interactiveKeys[0].content.correctOrder;
  for(let target=0;target<expected.length;target++) {
    let current=(await ids()).indexOf(expected[target]);
    while(current>target) {
      const label=document.activities[0].content.items.find(i=>i.id===expected[target]).label;
      await page.getByRole('button',{name:`Mover ${label} para cima`,exact:true}).click();current--;
    }
  }
  await page.getByRole('button',{name:'Verificar resposta',exact:true}).click();
  await page.getByText('Atividade aprovada! · 100/100',{exact:true}).waitFor();
  await page.getByText(/Conquista desbloqueada: Explorador da história/).waitFor();
  await page.getByRole('navigation').getByRole('button',{name:/Cada tecnologia/}).click();
  await page.getByRole('combobox',{name:'Associar HTML'}).waitFor();
  for(const pair of document.teacherOnly.interactiveKeys[1].content.pairs) {
    const label=document.activities[1].content.leftItems.find(i=>i.id===pair.leftId).label;
    await page.getByRole('combobox',{name:`Associar ${label}`,exact:true}).selectOption(pair.rightId);
  }
  await page.reload();await page.getByRole('combobox',{name:'Associar HTML'}).waitFor();
  assert.equal(await page.getByRole('combobox',{name:'Associar HTML'}).inputValue(),'estrutura');
  await page.getByRole('button',{name:'Verificar resposta',exact:true}).click();
  await page.getByText('Atividade aprovada! · 100/100',{exact:true}).waitFor();
  await page.getByRole('navigation').getByRole('button',{name:/O que orienta/}).click();
  await page.getByRole('radio').first().waitFor();
  const order=()=>page.getByRole('radio').evaluateAll(nodes=>nodes.map(n=>n.value));
  const before=await order();await page.getByRole('radio',{name:'O peso do teclado',exact:true}).check();
  for(const question of document.activities[2].content.questions.slice(1)) await page.getByRole('radio',{name:question.options.find(o=>o.key==='wrong').text,exact:true}).check();
  assert.deepEqual(await order(),before);await page.reload();await page.getByRole('radio').first().waitFor();assert.deepEqual(await order(),before);
  assert.equal(await page.getByRole('radio',{name:'O peso do teclado',exact:true}).isChecked(),true);
  await page.getByRole('button',{name:'Enviar respostas',exact:true}).click();await page.getByText('Continue praticando · 0/100',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();await page.getByRole('radio').first().waitFor();
  assert.notDeepEqual(await order(),before);
  const answer=document.activities[2].content.questions[0].options.find(o=>o.key==='programa').text;
  await page.getByRole('radio',{name:answer,exact:true}).check();
  for(const question of document.activities[2].content.questions.slice(1)) await page.getByRole('radio',{name:question.options.find(o=>o.key==='correct').text,exact:true}).check();
  await page.getByRole('button',{name:'Enviar respostas',exact:true}).click();
  await page.getByRole('heading',{name:'Aula concluída',exact:true}).waitFor();
  assert.equal(await page.getByRole('progressbar',{name:'Atividades obrigatórias concluídas'}).getAttribute('aria-valuenow'),'3');
  assert.equal((await query("select count(*) n from student_xp_events where event_type='learning_activity'")).rows[0].n,3);
  await page.screenshot({path:'test-results/interactive-desktop.png',fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('navigation').getByRole('button',{name:/Cada tecnologia/}).click();await page.getByRole('combobox',{name:'Associar HTML'}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'test-results/interactive-mobile.png',fullPage:true,animations:'disabled'});
  assert.deepEqual(pageErrors,[]);
});
