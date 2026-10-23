import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createLearningBrowser} from './fixtures/learning-browser-harness.mjs';
test('package browser: four admin tabs, icon preview/edit persistence and responsive catalog', {timeout:120000},async t=>{
 const app=await createLearningBrowser(t,{improvements:true});const {page,appUrl}=app;
 const badge={code:'official:test',title:'Conquista de teste',description:'Reconhecimento',icon:'⭐'};
 const technology={id:'test-tech',name:'HTML',slug:'html',bronze_title:'Bronze',silver_title:'Prata',gold_title:'Ouro',icon:'💻'};
 await page.route('**/rest/v1/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.pathname.includes('/rpc/'))return route.fallback();
  const table=url.pathname.split('/').at(-1);let rows=[];
  if(table==='achievement_definitions')rows=[badge,{...badge,code:'mastery:html:bronze',title:'Bronze HTML'}];
  if(table==='technologies')rows=[technology];
  if(req.method()==='PATCH'){const payload=req.postDataJSON();if(table==='technologies')Object.assign(technology,payload);if(table==='achievement_definitions')Object.assign(badge,payload);rows=table==='technologies'?[technology]:[badge];}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(req.headers().accept?.includes('vnd.pgrst.object')?rows[0]:rows)});
 });
 await page.goto(`${appUrl}tests/fixtures/learning-browser.html?mode=catalog`);
 assert.equal(await page.getByRole('tab').count(),4);
 await page.getByRole('button',{name:'Editar Conquista de teste',exact:true}).click();
 await page.getByRole('button',{name:'Usar ícone 🚀',exact:true}).click();
 assert.equal(await page.getByLabel('Prévia do ícone').innerText(),'🚀');
 const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM9kAAAAASUVORK5CYII=','base64');
 await page.route('https://example.org/**',route=>route.fulfill({status:200,contentType:'image/png',body:image}));
 const iconUrl='https://example.org/test-icon.png';
 await page.getByLabel('Ícone personalizado ou link HTTPS').fill(iconUrl);
 await page.getByLabel('Prévia do ícone').locator('img').waitFor();
 await page.getByRole('button',{name:'Salvar conquista',exact:true}).click();
 await page.getByRole('heading',{name:'Conquista de teste',exact:true}).locator('img').waitFor();assert.equal(badge.icon,iconUrl);
 await page.getByRole('tab',{name:'Tecnologias',exact:true}).click();
 await page.getByRole('button',{name:'Editar HTML',exact:true}).click();
 await page.getByRole('button',{name:'Usar ícone 🧠',exact:true}).click();
 await page.getByLabel('Carregar imagem do ícone').setInputFiles({name:'unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
 await page.getByRole('alert').filter({hasText:'Escolha PNG'}).waitFor();
 let uploaded=false;
 await page.route('**/storage/v1/object/catalog-icons/**',route=>route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({statusCode:'404',error:'not_found',message:'Bucket not found'})}));
 await page.getByLabel('Carregar imagem do ícone').setInputFiles({name:'icon.png',mimeType:'image/png',buffer:image});
 await page.getByRole('alert').filter({hasText:'armazenamento de ícones ainda não foi configurado'}).waitFor();
 assert.equal(await page.getByLabel('Prévia do ícone').innerText(),'🧠');
 await page.route('**/storage/v1/object/catalog-icons/**',async route=>{uploaded=true;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({Key:'catalog-icons/test.png'})});});
 await page.getByLabel('Carregar imagem do ícone').setInputFiles({name:'icon.png',mimeType:'image/png',buffer:image});
 await page.waitForFunction(()=>document.querySelector('input[id]:not([type=file])')?.value?.startsWith('https://example.org/icons/'));
 assert.equal(uploaded,true);
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/improvements-icon-upload.png',fullPage:true});
 await page.getByRole('button',{name:'Salvar alterações',exact:true}).click();
 await page.getByRole('rowheader',{name:'HTML',exact:true}).locator('img').waitFor();assert.match(technology.icon,/https:\/\/example.org\/icons\/.+\.png$/);
 await page.getByRole('tab',{name:'Missões',exact:true}).click();
 await page.getByText('Nenhuma missão disponível ainda.',{exact:true}).waitFor();
 await page.getByRole('tab',{name:'Maestrias',exact:true}).click();
 await page.getByRole('heading',{name:'Medalhas de maestria',exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/improvements-catalog-mobile.png',fullPage:true});
 assert.deepEqual(app.pageErrors,[]);
});

test('package browser: financial preview never saves implicitly and package labels preserve modality and IDs',{timeout:120000},async t=>{
 const app=await createLearningBrowser(t,{improvements:true});const {page,appUrl}=app;const writes=[];
 await page.route('**/rest/v1/**',async route=>{
  const req=route.request(),table=new URL(req.url()).pathname.split('/').at(-1);
  if(req.method()!=='GET'&&table!=='get_student_billing')writes.push(table);
  let data=[];
  if(table==='get_student_billing')data={plan:null,plans:[],remaining:0,credits:0,consumed:0,overage:0,overdue_blocked:false,balance_blocked:false,invoices:[],payments:[]};
  if(table==='commercial_packages')data=[{id:'course-package',name:'HTML Básico',session_track:'course',lesson_quantity:4,package_price:300},{id:'mentoring-package',name:'Web',session_track:'mentoring',lesson_quantity:2,package_price:200}];
  if(table==='commercial_discounts')data=[{id:'discount-ten',name:'Dez por cento',kind:'percentage',value:10,is_active:true}];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto(`${appUrl}tests/fixtures/learning-browser.html?mode=finance`);
 await page.getByLabel('Tipo de cobrança').selectOption('prepaid');
 assert.equal(await page.getByRole('option',{name:'Curso — HTML Básico',exact:true}).getAttribute('value'),'course-package');
 assert.equal(await page.getByRole('option',{name:'Mentoria — Web',exact:true}).getAttribute('value'),'mentoring-package');
 await page.getByLabel('Desconto cadastrado').selectOption('discount-ten');
 const preview=await page.getByRole('region',{name:'Prévia do desconto'}).innerText();
 assert.match(preview,/300,00/);assert.match(preview,/30,00/);assert.match(preview,/270,00/);assert.match(preview,/10%/);assert.deepEqual(writes,[]);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/improvements-finance-mobile.png',fullPage:true});
 assert.deepEqual(app.pageErrors,[]);
});

test('invoice discount browser: preset and custom value coexist; preview has no side effect and confirmation sends an invoice-scoped amount',{timeout:120000},async t=>{
 const app=await createLearningBrowser(t,{improvements:true});const {page,appUrl}=app;const writes=[];
 const invoice={id:'00000000-0000-4000-8000-000000009001',student_id:'00000000-0000-4000-8000-000000000001',kind:'monthly',billing_mode:'prepaid',reference_month:'2026-10-01',due_date:'2026-10-05',gross_amount:300,discount_amount:0,paid_total:0,outstanding:300,overdue_days:0,is_draft:false,pricing_missing:false,lesson_quantity:4,last_paid_on:null};
 const snapshot=()=>({plan:null,plans:[],remaining:4,credits:4,consumed:0,overage:0,overdue_blocked:false,balance_blocked:false,invoices:[invoice],payments:[]});
 await page.route('**/rest/v1/**',async route=>{
  const req=route.request(),table=new URL(req.url()).pathname.split('/').at(-1);let data=[];
  if(table==='get_student_billing')data=snapshot();
  if(table==='commercial_discounts')data=[{id:'00000000-0000-4000-8000-000000009002',name:'Dez por cento',kind:'percentage',value:10,is_active:true}];
  if(table==='apply_invoice_discount'){
   const args=req.postDataJSON();writes.push(args);invoice.discount_amount=args.p_amount;invoice.outstanding=300-args.p_amount;invoice.discount_override={kind:'fixed',value:args.p_amount,name:'Desconto avulso',discountId:null};data=snapshot();
  }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto(`${appUrl}tests/fixtures/learning-browser.html?mode=finance`);
 await page.getByText('Aplicar desconto nesta cobrança',{exact:true}).click();
 const form=page.getByRole('form',{name:'Desconto da cobrança'});
 await form.getByLabel('Tipo de desconto').selectOption('00000000-0000-4000-8000-000000009002');
 assert.match(await form.innerText(),/270,00/);
 await form.getByLabel('Tipo de desconto').selectOption('custom');
 await form.getByLabel('Valor do desconto avulso (R$)').fill('45.50');
 assert.match(await form.innerText(),/254,50/);assert.equal(writes.length,0);
 await form.getByLabel('Valor do desconto avulso (R$)').fill('301');assert.equal(await form.getByRole('button',{name:'Aplicar desconto',exact:true}).isDisabled(),true);
 await form.getByLabel('Valor do desconto avulso (R$)').fill('45.50');
 await form.getByRole('button',{name:'Aplicar desconto',exact:true}).click();
 await page.getByText('Registro salvo com sucesso.',{exact:true}).waitFor();
 assert.equal(writes.length,1);assert.equal(writes[0].p_invoice_id,invoice.id);assert.equal(writes[0].p_amount,45.5);assert.equal(writes[0].p_discount_id,null);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/invoice-ad-hoc-discount-mobile.png',fullPage:true});assert.deepEqual(app.pageErrors,[]);
});
