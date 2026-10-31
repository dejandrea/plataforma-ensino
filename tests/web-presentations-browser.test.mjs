import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from '@playwright/test';

test('standalone presentation: desktop/mobile, keyboard, touch, local JSON and safe rendering',{timeout:90000},async t=>{
  const base = resolve('public');
  const server = createServer(async(req,res)=>{
    const path = resolve(base, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(!path.startsWith(base+sep)) {res.writeHead(403).end();return;}
    try {const filename = path.endsWith('apresentacoes') ? resolve(path,'index.html') : path;
      const file = await readFile(filename);
      res.setHeader('Content-Type', {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.ttf':'font/ttf'}[extname(filename)]??'application/octet-stream');res.end(file);
    }catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(r=>server.close(r)));
  const browser=await chromium.launch({channel:process.platform==='win32'?'chrome':undefined,headless:true});t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:1366,height:900},hasTouch:true});
  const page=await context.newPage(); const errors=[];const requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  const url=`http://127.0.0.1:${server.address().port}/apresentacoes/`;
  await page.goto(url);await page.getByRole('heading',{name:'Grandes nomes. Ideias conectadas.'}).waitFor();
  await mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/presentations-cover-desktop.png',fullPage:true});
  assert.equal(await page.locator('#previous').isDisabled(),true);
  for(const width of [1366,768,390]) {
    await page.setViewportSize({width,height:900});
    await page.locator('#slide').focus();await page.keyboard.press('Home');
    for(let i=0;i<11;i++) {
      assert.equal(await page.locator('#position').innerText(),`${i+1} / 11`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      const title=await page.locator('h1').boundingBox(); assert.ok(title.x>=0&&title.x+title.width<=width+1);
      if(width===390||width===1366) await page.screenshot({path:`test-results/presentation-${width}-${i+1}.png`,fullPage:true});
      if(i<10) await page.keyboard.press('ArrowRight');
    }
    assert.equal(await page.locator('#next').isDisabled(),true);
  }
  await page.keyboard.press('Home');
  const touch = await context.newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y:300}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:100,y:310}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await page.locator('#position').innerText(),'2 / 11');
  await page.getByRole('button',{name:'Próximo slide',exact:true}).click();
  assert.equal(await page.locator('#position').innerText(),'3 / 11');
  if(await page.locator('#fullscreen').isVisible()) {
    await page.locator('#fullscreen').click();
    assert.equal(await page.evaluate(()=>Boolean(document.fullscreenElement)),true);
    await page.getByRole('button',{name:'Sair da tela cheia'}).click();
    assert.equal(await page.evaluate(()=>Boolean(document.fullscreenElement)),false);
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('#slide').evaluate(el=>getComputedStyle(el).animationName),'none');
  const hostile={schemaVersion:1,title:'Local',slides:[{type:'example',title:'<img src=x onerror=alert(1)>',body:'Texto',code:'<script>window.injected=true</script>'}]};
  await page.locator('#file').setInputFiles({name:'local.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(hostile))});
  await page.getByRole('heading',{name:hostile.slides[0].title,exact:true}).waitFor();
  assert.equal(await page.locator('#slide img, #slide script').count(),0);
  assert.equal(await page.evaluate(()=>window.injected),undefined);
  await page.locator('#file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{bad')});
  await page.locator('#error').waitFor({state:'visible'});
  assert.equal(await page.locator('h1').innerText(),hostile.slides[0].title);
  await page.route('**/images/ideias-conectadas.svg',route=>route.abort());
  await page.goto(url);await page.locator('#next:enabled').waitFor();
  await page.locator('#slide').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
  await page.getByText('Imagem indisponível:',{exact:false}).waitFor();
  await page.getByRole('heading',{name:'Uma rede de contribuições'}).waitFor();
  await page.goto(url+'?deck=../secret');await page.locator('#error').waitFor({state:'visible'});
  await page.goto(url+'?deck=missing');await page.locator('#error').waitFor({state:'visible'});
  assert.deepEqual(errors,[]);
  assert.equal(requests.some(u=>!u.startsWith(url.split('/apresentacoes/')[0])),false,'No remote services');
  assert.equal(requests.some(u=>/supabase|rpc|student_progress|xp_events/.test(u)),false);
});
