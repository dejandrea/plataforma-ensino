import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {createLearningBrowser} from './fixtures/learning-browser-harness.mjs';
import {prepareInteractiveContent} from './fixtures/interactive-content.mjs';
import {id} from './fixtures/learning-test-db.mjs';

test('Drive HTML M01 S01 A01: import, publish and complete five required activities without optional matching', {timeout:120000}, async t=>{
  const app=await createLearningBrowser(t);
  const {page,appUrl,setIdentity,query,pageErrors}=app;
  const document=JSON.parse(readFileSync('tests/fixtures/html-m01-s01-a01.v2.admin.json','utf8'));
  const {lessonId}=await prepareInteractiveContent(app,{importContent:false});
  await app.login('admin','postgres');
  await query('update courses set title=$1 where id=$2',[document.context.courseTitle,id(900)]);
  await query('update modules set title=$1 where id=$2',[document.context.moduleTitle,id(901)]);
  await query('update submodules set title=$1 where id=$2',[document.context.submoduleTitle,id(902)]);
  await query('update lessons set title=$1 where id=$2',[document.lesson.title,lessonId]);
  setIdentity('admin');
  await page.goto(`${appUrl}tests/fixtures/learning-browser.html?mode=import&lesson=${lessonId}&title=${encodeURIComponent(document.lesson.title)}`);
  await page.getByRole('textbox',{name:'Conteúdo JSON',exact:true}).fill(JSON.stringify(document));
  await page.getByRole('region',{name:'Prévia pública das atividades'}).waitFor();
  await page.getByRole('button',{name:'Importar atividades',exact:true}).click();
  await page.getByText('Rascunho importado. Confira a prévia antes de publicar.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Publicar atividades importadas',exact:true}).click();
  await page.getByText('Atividades publicadas.',{exact:true}).waitFor();
  setIdentity('student');
  await page.goto(`${appUrl}tests/fixtures/learning-browser.html?lesson=${lessonId}`);
  await page.getByRole('heading',{name:document.lesson.title,exact:true}).waitFor();
  const nav=page.getByRole('navigation',{name:'Atividades da aula'});
  for(const activity of document.activities.filter(a=>a.required)) {
    await nav.getByRole('button').filter({hasText:activity.title}).click();
    if(['slides','mindmap'].includes(activity.type)) {
      assert.equal(await page.getByRole('link',{name:/Abrir material de estudo|Abrir mapa mental/}).getAttribute('href'),activity.content.resourceUrl);
      await page.getByRole('button',{name:'Confirmar estudo',exact:true}).click();
    } else if(activity.type==='interactive') {
      const list=page.getByRole('list',{name:'Sequência de itens'});
      await list.waitFor();
      const expected=document.teacherOnly.interactiveKeys.find(k=>k.activityKey===activity.key).content.correctOrder;
      for(let target=0;target<expected.length;target++) {
        const ids=await list.locator('li').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-item-id')));
        let current=ids.indexOf(expected[target]);
        const label=activity.content.items.find(i=>i.id===expected[target]).label;
        while(current-->target) await page.getByRole('button',{name:`Mover ${label} para cima`,exact:true}).click();
      }
      await page.getByRole('button',{name:'Verificar resposta',exact:true}).click();
      await page.getByText('Atividade aprovada! · 100/100',{exact:true}).waitFor();
    } else {
      for(const answer of document.teacherOnly.quizKeys[0].content.answers) {
        const question=activity.content.questions.find(q=>q.key===answer.questionKey);
        await page.getByRole('radio',{name:question.options.find(o=>o.key===answer.optionKey).text,exact:true}).check();
      }
      await page.getByRole('button',{name:'Enviar respostas',exact:true}).click();
    }
    await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
  }
  await page.getByRole('heading',{name:'Aula concluída',exact:true}).waitFor();
  await page.reload();
  await page.getByRole('heading',{name:'Aula concluída',exact:true}).waitFor();
  assert.equal(await page.getByRole('progressbar',{name:'Atividades obrigatórias concluídas'}).getAttribute('aria-valuenow'),'5');
  await mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/html-lesson-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await nav.getByRole('button').filter({hasText:document.activities[3].title}).click();
  for(const pair of document.teacherOnly.interactiveKeys[1].content.pairs) {
    const label=document.activities[3].content.leftItems.find(i=>i.id===pair.leftId).label;
    await page.getByRole('combobox',{name:`Associar ${label}`,exact:true}).selectOption(pair.rightId);
  }
  await page.getByRole('button',{name:'Verificar resposta',exact:true}).click();
  await page.getByText('Atividade aprovada! · 100/100',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'test-results/html-lesson-mobile.png',fullPage:true});
  assert.deepEqual(pageErrors,[]);
});
