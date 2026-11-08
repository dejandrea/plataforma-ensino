import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {PDFDocument} from 'pdf-lib';

test('real components: default Meet selection/save and private A4 evaluation print documents',{timeout:120000},async t=>{
  const server=await createServer({logLevel:'error',plugins:[{name:'synthetic-supabase-only',enforce:'pre',configureServer(server){server.middlewares.use('/__printblank',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head></head><body></body></html>');});},load(id){if(id.replaceAll('\\','/').endsWith('/src/lib/supabaseClient.ts')) return 'export const supabase=new Proxy({}, {get:(_,key)=>window.syntheticClient[key]});';}}],server:{host:'127.0.0.1',port:0}});
  await server.listen();t.after(()=>server.close());
  const base=server.resolvedUrls.local[0];
  const browser=await chromium.launch({channel:process.platform==='win32'?'chrome':undefined,headless:true});t.after(()=>browser.close());
  const context=await browser.newContext();
  const external=[];
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname==='127.0.0.1'||url.hostname==='localhost')return route.continue();external.push(url.origin);return route.abort();});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  t.after(()=>t.diagnostic(JSON.stringify({errors,external})));
  await page.goto(base+'tests/fixtures/scheduling-print.html?scenario=meet');
  const fixed=page.getByLabel('Usar link fixo do Google Meet para este aluno');
  await fixed.waitFor();await page.waitForFunction(()=>document.querySelector('[data-testid="selected-meet"]')?.textContent==='https://meet.google.com/abc-defg-hij');
  assert.equal(await fixed.isChecked(),true);
  await page.getByLabel('Link destas novas aulas (opcional)').fill('https://meet.google.com/klm-nopq-rst');
  assert.equal(await page.evaluate(()=>window.syntheticMeetDb.defaults['student-a']),'https://meet.google.com/abc-defg-hij');
  await page.getByLabel('Link padrão do aluno',{exact:true}).fill('https://meet.google.com/uvw-xyza-bcd');
  await page.getByRole('button',{name:'Salvar link padrão',exact:true}).click();await page.getByText('Padrão salvo para novos agendamentos deste aluno com esta professora. As aulas existentes foram preservadas.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.syntheticMeetDb.defaults['student-a']),'https://meet.google.com/uvw-xyza-bcd');
  assert.equal(await page.getByTestId('selected-meet').innerText(),'https://meet.google.com/klm-nopq-rst');
  await page.getByLabel('Aluno sintético',{exact:true}).selectOption('student-b');
  await page.waitForFunction(()=>document.querySelector('[data-testid="selected-meet"]')?.textContent==='');
  assert.equal(await fixed.isChecked(),false);
  await mkdir('output/pdf',{recursive:true});
  for(const scenario of ['sparse','complete','long']) {
    await page.goto(base+'tests/fixtures/scheduling-print.html?scenario='+scenario);
    // Keep the prepared iframe alive to inspect exactly the document passed to print().
    await page.evaluate(()=>{const append=Element.prototype.append;Element.prototype.append=function(...nodes){const result=append.apply(this,nodes);for(const node of nodes)if(node instanceof HTMLIFrameElement)node.contentWindow.print=()=>{window.syntheticPrintCalled=true;};return result;};});
    await page.getByRole('button',{name:'Imprimir avaliação',exact:true}).click();
    await page.waitForFunction(()=>window.syntheticPrintCalled===true);
    const frame=page.frames().find(f=>f!==page.mainFrame());assert.ok(frame);
    const body=await frame.locator('body').innerText();assert.ok(body.includes('Aluno Sintético da Bitaria'));
    assert.equal(body.includes('MENU ADMINISTRATIVO'),false);assert.equal(await frame.locator('button,nav').count(),0);
    if(scenario==='sparse') assert.ok(body.includes('Não registrado'));
    if(scenario==='long') assert.ok(body.includes('FIM DO COMENTÁRIO LONGO.'));
    const printPage=await context.newPage();await printPage.goto(base+'__printblank');await printPage.setContent(await frame.content());
    await printPage.evaluate(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images,image=>image.decode()));});
    await printPage.emulateMedia({media:'print'});
    const bytes=await printPage.pdf({path:`output/pdf/avaliacao-${scenario}.pdf`,preferCSSPageSize:true,printBackground:true});
    const doc=await PDFDocument.load(bytes);assert.equal(Math.round(doc.getPage(0).getWidth()),595);assert.equal(Math.round(doc.getPage(0).getHeight()),842);
    if(scenario==='sparse'||scenario==='complete')assert.equal(doc.getPageCount(),1);if(scenario==='long')assert.equal(doc.getPageCount(),4);
    await printPage.screenshot({path:`output/pdf/avaliacao-${scenario}-browser.png`,fullPage:true});
    await printPage.close();await page.evaluate(()=>document.querySelector('iframe').contentWindow.dispatchEvent(new Event('afterprint')));
    assert.equal(await page.locator('iframe').count(),0);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
});
