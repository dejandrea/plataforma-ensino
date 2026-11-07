import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';

test('A02: all 15 slides on desktop/mobile, credits, controls, return to lesson and no viewer writes',{timeout:120000},async t=>{
  const base='http://localhost:5173';
  let server,browser,existing;
  t.after(async()=>{if(browser)await browser.close();if(server)await server.close();});
  try { existing=await fetch(`${base}/apresentacoes/decks/html-m01-s01-a02.json`,{signal:AbortSignal.timeout(3000)}); } catch { /* Start an isolated server below. */ }
  if(existing) {
    assert.equal(existing.ok,true,'The existing server must serve this project.');
    assert.deepEqual(Buffer.from(await existing.arrayBuffer()),await readFile('public/apresentacoes/decks/html-m01-s01-a02.json'),'Reuse port 5173 only for the exact current presentation.');
  } else {
    server=await createServer({logLevel:'error',server:{host:'localhost',port:5173,strictPort:true}});
    await server.listen();
  }
  browser=await chromium.launch({channel:process.platform==='win32'?'chrome':undefined,headless:true});
  const context=await browser.newContext({viewport:{width:1366,height:900},hasTouch:true});
  const page=await context.newPage();const requests=[];const errors=[];
  context.on('request',request=>requests.push({url:request.url(),method:request.method()}));
  context.on('page',tab=>tab.on('pageerror',error=>errors.push(error.message)));
  page.on('pageerror',error=>errors.push(error.message));
  const url=`${base}/apresentacoes/?deck=html-m01-s01-a02`;
  const deck=JSON.parse(await readFile('public/apresentacoes/decks/html-m01-s01-a02.json','utf8'));
  await page.goto(url);await page.getByRole('heading',{name:deck.slides[0].title,exact:true}).waitFor();
  assert.equal(page.url(),url);
  await mkdir('test-results/a02-web',{recursive:true});
  for(const width of [1366,390]) {
    await page.setViewportSize({width,height:width===390?844:900});
    await page.locator('#slide').focus();await page.keyboard.press('Home');
    for(let index=0;index<deck.slides.length;index++) {
      const slide=deck.slides[index];
      assert.equal(await page.locator('h1').innerText(),slide.title);
      assert.equal(await page.locator('#position').innerText(),`${index+1} / 15`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      const title=await page.locator('h1').boundingBox();assert.ok(title.x>=0&&title.x+title.width<=width+1);
      if(slide.image||slide.mascot) {
        const image=page.locator('#slide img');await image.waitFor();await image.evaluate(img=>img.decode());
        assert.equal(await image.evaluate(img=>getComputedStyle(img).objectFit),'contain');
        assert.ok((await image.getAttribute('alt')).trim());
        if(slide.image) {
          assert.equal(await image.getAttribute('alt'),slide.image.alt);
          assert.ok((await page.locator('figcaption').innerText()).includes(slide.image.caption));
          assert.equal(await page.getByRole('link',{name:'Ver licença da imagem ↗',exact:true}).getAttribute('href'),slide.sources.find(s=>s.startsWith('https://creativecommons.org/')));
        }
      }
      if(slide.image?.src==='./images/tim-berners-lee.webp') {
        const caption=page.locator('figcaption');assert.equal(await caption.isVisible(),true);
        assert.match(await caption.innerText(),/Paul Clarke.*CC BY 2\.0.*Conversão para WebP e redução de resolução/s);
        const license=page.getByRole('link',{name:'Ver licença da imagem ↗',exact:true});
        assert.equal(await license.getAttribute('href'),'https://creativecommons.org/licenses/by/2.0/');
        assert.equal(await license.getAttribute('target'),'_blank');
      }
      await page.evaluate(()=>document.fonts.ready);
      await page.screenshot({path:`test-results/a02-web/${width}-${String(index+1).padStart(2,'0')}.png`,fullPage:true});
      if(index<14)await page.keyboard.press('ArrowRight');
    }
    assert.equal(await page.locator('#next').isDisabled(),true);
    await page.keyboard.press('Home');assert.equal(await page.locator('#previous').isDisabled(),true);
    await page.keyboard.press('End');assert.equal(await page.locator('#position').innerText(),'15 / 15');
  }
  await page.keyboard.press('Home');
  const touch=await context.newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y:300}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:100,y:310}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await page.locator('#position').innerText(),'2 / 15');
  await page.getByRole('button',{name:'Próximo slide',exact:true}).click();
  assert.equal(await page.locator('#position').innerText(),'3 / 15');
  await page.locator('#file').setInputFiles('public/apresentacoes/decks/html-m01-s01-a02.json');
  await page.getByRole('heading',{name:deck.slides[0].title,exact:true}).waitFor();
  assert.equal(await page.locator('#position').innerText(),'1 / 15');
  // The existing ActivityRenderer opens a new tab. A synthetic HTTPS origin is
  // routed entirely to the local server; no real activity or API is modified.
  await context.route('https://presentation.test/**',async route=>{
    const target=new URL(route.request().url());
    const response=await context.request.get(`${base}${target.pathname}${target.search}`);
    await route.fulfill({response});
  });
  const lesson=await context.newPage();await lesson.goto(`${base}/tests/fixtures/presentation-return.html`);
  await lesson.getByRole('button',{name:'Confirmar estudo',exact:true}).waitFor();
  const popupPromise=lesson.waitForEvent('popup');
  await lesson.getByRole('link',{name:'Abrir material de estudo em nova aba',exact:false}).click();
  const popup=await popupPromise;await popup.getByRole('heading',{name:deck.slides[0].title,exact:true}).waitFor();
  await popup.locator('#slide').focus();await popup.keyboard.press('End');
  assert.equal(await popup.locator('#position').innerText(),'15 / 15');
  assert.equal(await lesson.getByTestId('confirmations').innerText(),'Confirmações: 0');
  await popup.close();await lesson.bringToFront();
  assert.equal(await lesson.getByRole('button',{name:'Confirmar estudo',exact:true}).isEnabled(),true);
  await lesson.getByRole('button',{name:'Confirmar estudo',exact:true}).click();
  assert.equal(await lesson.getByTestId('confirmations').innerText(),'Confirmações: 1');
  assert.deepEqual(errors,[]);
  assert.equal(requests.some(r=>r.method!=='GET'),false,'Viewer never writes progress, XP or candidate data');
  assert.equal(requests.some(r=>/\/rest\/|\/rpc\//.test(r.url)||new URL(r.url).hostname.endsWith('.supabase.co')),false);
});
