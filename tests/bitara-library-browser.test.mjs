import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';

test('Bitara gallery is development-only; slides select official poses, stay responsive and recover from failures',{timeout:120000},async t=>{
  const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0}});
  await server.listen();t.after(()=>server.close());
  const url=`http://127.0.0.1:${server.httpServer.address().port}`;
  const browser=await chromium.launch({channel:process.platform==='win32'?'chrome':undefined,headless:true});t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  const errors=[];const requests=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
  await page.goto(`${url}/__dev/bitara`);
  await page.getByRole('heading',{name:'Biblioteca visual da Bitara',exact:true}).waitFor();
  await page.getByText('64 de 64 imagens',{exact:false}).waitFor();
  assert.equal(await page.locator('article').count(),64);
  await page.getByLabel('Categoria',{exact:true}).selectOption('investigadora');
  assert.equal(await page.locator('article').count(),5);
  await page.getByLabel('Buscar por nome, ID ou tag').fill('bitara-044');
  assert.equal(await page.locator('article').count(),1);
  await page.getByRole('img').evaluate(img=>img.decode());
  await mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/bitara-gallery.png',fullPage:true});
  requests.length=0;
  await page.goto(`${url}/apresentacoes/?deck=bitara-demo`);
  await page.waitForFunction(()=>document.querySelector('#position')?.textContent || (document.querySelector('#error') && !document.querySelector('#error').hidden));
  assert.equal(await page.locator('#error').isVisible(),false,await page.locator('#error').textContent());
  await page.locator('.mascot img').waitFor({timeout:5000}).catch(async error=>{
    throw new Error(`${error.message}\n${await page.locator('body').innerText()}\n${JSON.stringify(errors)}\n${JSON.stringify(requests)}`);
  });await page.locator('.mascot img').evaluate(img=>img.decode());
  assert.equal(await page.locator('.mascot img').getAttribute('data-mascot-id'),'bitara-001');
  assert.equal(requests.filter(u=>u.endsWith('.webp')).length,1,'Only the current slide image is loaded');
  const ids=['bitara-001','bitara-006','bitara-020','bitara-005','bitara-003','bitara-052','bitara-044','bitara-002'];
  for(const width of [1366,390]) {
    await page.setViewportSize({width,height:900});
    await page.locator('#slide').focus();await page.keyboard.press('Home');
    for(let index=0;index<ids.length;index++) {
      await page.waitForFunction(id=>document.querySelector('.mascot img')?.dataset.mascotId===id,ids[index]);
      const image=page.locator('.mascot img');await image.evaluate(img=>img.decode());
      assert.equal(await image.evaluate(img=>getComputedStyle(img).objectFit),'contain');
      assert.ok((await image.getAttribute('alt')).length>10);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      if(index===0||index===2||index===7)await page.screenshot({path:`test-results/bitara-${width}-${index+1}.png`,fullPage:true});
      if(index<ids.length-1)await page.keyboard.press('ArrowRight');
    }
  }
  const compatible=JSON.parse(await readFile('public/apresentacoes/decks/aula-02-demo.json','utf8'));
  compatible.slides.forEach(slide=>{slide.mascot={category:'explicando'};});
  await page.locator('#file').setInputFiles({name:'all-layouts.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(compatible))});
  for(let index=0;index<compatible.slides.length;index++) {
    await page.locator('.mascot img').waitFor();await page.locator('.mascot img').evaluate(img=>img.decode());
    assert.equal(await page.locator('h1').innerText(),compatible.slides[index].title);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    if(index<compatible.slides.length-1)await page.getByRole('button',{name:'Próximo slide',exact:true}).click();
  }
  await page.goto(`${url}/apresentacoes/?deck=bitara-demo`);await page.locator('.mascot img').waitFor();
  await page.route('**/images/bitara-020.webp',route=>route.abort());
  await page.locator('#slide').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
  await page.waitForFunction(()=>document.querySelector('.mascot img')?.dataset.mascotId==='bitara-001');
  await page.locator('.mascot img').evaluate(img=>img.decode());
  await page.route('**/images/bitara-001.webp',route=>route.abort());
  await page.reload();await page.getByText('Imagem da Bitara indisponível.',{exact:true}).waitFor();
  await page.getByRole('heading',{name:'Uma companheira para cada descoberta'}).waitFor();
  await page.route('**/biblioteca-bitara/catalog.json',route=>route.abort());
  await page.reload();await page.getByText('Imagem da Bitara indisponível.',{exact:true}).waitFor();
  assert.equal(await page.locator('#next').isEnabled(),true);
  assert.deepEqual(errors,[]);
  assert.equal(requests.some(u=>!u.startsWith(url)&&!u.startsWith('ws:')),false);
  const plugin=server.config.plugins.find(plugin=>plugin.name==='bitara-development-gallery');assert.equal(plugin.apply,'serve');
});
