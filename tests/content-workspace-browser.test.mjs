import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium} from '@playwright/test';
import {createStoredZip} from '../public/apresentacoes/zip.js';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const lessonId=id(9925),a02='b17a2000-0000-4000-8000-000000001002';
const lesson={id:lessonId,title:'Aula pacote sintetico',description:'Uma aula para investigar, compreender e criar com segurança.',duration_minutes:25,publication_status:'planned',curriculum_number:3,order_index:1,submodule_id:id(27),module_id:id(26),video_url:null,pdf_url:null,slides_url:null,meet_link:null};
const course={id:id(25),title:'Aula antiga',total_hours:20,is_active:true};
const module={id:id(26),course_id:course.id,title:'Aula antiga',order_index:1,is_active:true};
const submodule={id:id(27),module_id:module.id,title:'Conteúdo',order_index:1,is_active:true};
const kit={lesson_id:lessonId,lesson_key:'aula-pacote-local',origin:'https://example.invalid',slots:['principal','revisao','complementar'].map((key,i)=>({key,presentationId:id(9930+i)}))};
const doc=JSON.parse(readFileSync('src/contracts/examples/lesson-package.v2.json','utf8'));doc.context={courseTitle:course.title,moduleTitle:module.title,submoduleTitle:submodule.title};doc.lesson.title=lesson.title;
const legacy=JSON.parse(readFileSync('docs/examples/html-primeira-pagina.v1.json','utf8'));legacy.lesson.title=lesson.title;legacy.context=doc.context;
const simpleDeck=createStoredZip([{path:'apresentacao.json',data:JSON.stringify({schemaVersion:1,title:'Apresentação sintética',slides:[{type:'concept',title:'Conceito',body:'Material sintético, sem dados de alunos.'}]})}]);

test('Currículo e editor dedicados: navegação, cinco abas, proteção local e compatibilidade sem gravar conteúdo',{timeout:240000},async t=>{
 mkdirSync('test-results/content-workspace',{recursive:true});
 const vite=await createServer({configFile:false,envFile:false,plugins:[react()],server:{host:'127.0.0.1',port:0,watch:null},define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('http://127.0.0.1:54321'),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('synthetic-public-key')},optimizeDeps:{include:['react','react-dom/client','react-router-dom','@supabase/supabase-js','ajv','pdf-lib','@pdf-lib/fontkit']}});
 await vite.listen();t.after(()=>vite.close());
 const browser=await chromium.launch({channel:'chrome',headless:true});t.after(()=>browser.close());
 const origin=vite.resolvedUrls.local[0].replace(/\/$/,'');
 async function app(options={}){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});t.after(()=>context.close());
  const errors=[],mutations=[],requests=[];let lessonFailures=options.lessonFailures??0;
  const lessonGate=options.holdLesson?Promise.withResolvers():null;
  t.after(()=>lessonGate?.resolve());
  const role=options.role??'admin';
  if(role!=='anon')await context.addInitScript(({role})=>{
   const user={id:'00000000-0000-4000-8000-000000000005',email:'admin@example.invalid',aud:'authenticated',role:'authenticated',user_metadata:{}};
   const token='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'+btoa(JSON.stringify({sub:user.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}))+'.synthetic';
   localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}));
   localStorage.setItem('test-role',role);
  },{role});
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin===origin){
    if(options.brokenTool&&url.pathname.endsWith('/WebPresentationManager.tsx'))return route.fulfill({contentType:'application/javascript',body:"throw new Error('Falha sintética no módulo de apresentações');"});
    return route.continue();
   }
   const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(body)});
   if(url.origin!=='http://127.0.0.1:54321')return route.fulfill({status:200,body:'Recurso externo sintético.'});
   if(req.method()==='OPTIONS')return json({});
   const name=url.pathname.split('/').at(-1);requests.push({name,method:req.method()});
   if(url.pathname.includes('/auth/'))return json(name==='user'?{id:id(5),email:'admin@example.invalid',aud:'authenticated',role:'authenticated'}:{});
   if(url.pathname.includes('/rpc/')){
    const args=req.postDataJSON();
    if(name==='admin_editorial_lesson')return json({document:doc,lessonTitle:lesson.title,sourceToken:'source-synthetic',hasHistory:false,draft:options.draft?{version:1,document:doc,source_token:'source-synthetic',status:'draft'}:null,events:[]});
    if(name==='lesson_package_state')return json({kit,eligible:true,eligibilityReason:null,operation:options.pending?{id:id(9991),semantic_hash:'0'.repeat(64),status:'preparing',document:doc,manifest:{},draft_version:null,last_error:'Preparação interrompida: exemplo sintético.',intents:[]}:null});
    if(name==='lesson_web_presentations')return json([]);
    if(name==='web_presentation_state')return json({presentations:[{id:id(9930),title:'Deck sintético salvo',active_version_id:null,versions:[{id:id(9940),version_number:1,slide_count:1,files:[],warnings:[],package_hash:'a'.repeat(64)}]}],activities:[]});
    if(name==='plan_editorial_lesson')return json({lessonId,args,sourceToken:'source-synthetic',draftVersion:0,needsIdentity:false,canSave:true,issues:[],document:args.p_document,lessonBefore:{},lessonAfter:{},lessonClasses:[],teacherChanges:[],activities:[]});
    mutations.push(name);return json({message:'Operação de escrita bloqueada no teste.'},403);
   }
   if(req.method()!=='GET'){mutations.push(name);return json({},403);}
   if(name==='profiles')return json({role,is_active:options.active!==false,student_service_scope:'course'});
   if(name==='lessons'&&url.searchParams.has('id')){
    await lessonGate?.promise;
    if(options.delay)await new Promise(r=>setTimeout(r,options.delay));
    if(lessonFailures-->0)return json({message:'Falha sintética'},400);
    const wanted=url.searchParams.get('id').slice(3);return json(wanted===lessonId?lesson:wanted===id(9926)?{...lesson,id:id(9926),title:'Outra aula sintética',order_index:2}:wanted===a02?{...lesson,id:a02,title:'Grandes Nomes da Tecnologia'}:null);
   }
   const tables={courses:[course],modules:[module],submodules:[submodule],lessons:[lesson,{...lesson,id:id(9926),title:'Outra aula sintética',order_index:2}],lesson_activities:[{id:id(9910),lesson_id:lessonId,key:'slides-sinteticos',title:'Material sintético',description:null,activity_type:'slides',content_json:{schemaVersion:1,type:'slides',resourceUrl:'https://example.invalid/material',format:'link',altText:'Material'},order_index:0,duration_minutes:5,is_required:true,is_active:true,publication_status:'draft',revision:1,created_at:'2026-11-20',updated_at:'2026-11-20',published_at:null}]};
   const rows=tables[name]??[];return json(url.searchParams.has('id')?rows.find(row=>row.id===url.searchParams.get('id').slice(3))??null:rows);
  });
  const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error('Synthetic browser error:',e.message);});page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(60000);
  const goto=async path=>{await page.goto(origin+path);};
  const clean=async()=>{assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);await context.close();};
  return {page,context,goto,errors,mutations,requests,clean,releaseLesson:()=>lessonGate?.resolve()};
 }

 await t.test('Currículo: seleção acessível, editor em rota real e retorno preservado',async()=>{
  const a=await app(),{page}=a;await a.goto('/gestao/conteudo');
  await page.getByLabel('Curso atual').selectOption(course.id);
  await page.getByRole('button',{name:'Selecionar '+module.title,exact:true}).click();
  await page.getByRole('button',{name:'Selecionar '+submodule.title,exact:true}).focus();await page.keyboard.press('Enter');
  const open=page.getByRole('link',{name:'Abrir editor de '+lesson.title});await open.waitFor();
  assert.equal(await page.getByRole('button',{name:'Importar atividades JSON',exact:true}).count(),0);
  await page.screenshot({path:'test-results/content-workspace/curriculo-desktop.png',fullPage:true});
  await open.click();await page.getByRole('heading',{name:lesson.title,exact:true}).waitFor();assert.match(page.url(),new RegExp('/gestao/aulas/'+lessonId));
  await page.getByRole('link',{name:'Voltar ao currículo',exact:true}).click();await open.waitFor();
  assert.equal(await page.getByLabel('Curso atual').inputValue(),course.id);assert.match(page.url(),/submodulo=/);assert.match(page.url(),/aula=/);
  await page.getByRole('link',{name:'Abrir editor de Outra aula sintética',exact:true}).click();
  await page.getByRole('heading',{name:'Outra aula sintética',exact:true}).waitFor();
  assert.equal(await page.getByRole('heading',{name:lesson.title,exact:true}).count(),0);
  assert.equal(await page.getByRole('tab',{name:'Visão geral',exact:true}).getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('textarea[id^="editorial-json-"]').count(),0);
  assert.match(await page.getByText(id(9926),{exact:true}).innerText(),new RegExp(id(9926)));
  await a.clean();
 });

 await t.test('Cinco abas: estado editorial único, comparação e importadores preservados',async()=>{
  const a=await app({draft:true}),{page}=a;await a.goto('/gestao/aulas/'+lessonId);await page.getByRole('heading',{name:lesson.title,exact:true}).waitFor();
  assert.equal(a.requests.some(r=>r.name==='web_presentation_state'),false);
  await page.getByRole('tab',{name:'Atividades',exact:true}).click();await page.getByRole('region',{name:'Visualização como aluno'}).waitFor();
  await page.getByRole('button',{name:'Editar documento editorial',exact:true}).click();const source=page.getByLabel('Documento da aula');await source.waitFor();await source.fill('documento local não salvo');
  await page.getByRole('tab',{name:'Publicação',exact:true}).click();await page.getByRole('tab',{name:'Atividades',exact:true}).click();assert.equal(await source.inputValue(),'documento local não salvo');
  assert.equal(await page.locator('textarea[id^="editorial-json-"]').count(),1);await source.fill(JSON.stringify(doc,null,2));
  await page.getByRole('button',{name:'Comparar sem salvar',exact:true}).click();await page.getByRole('heading',{name:'Comparação do conteúdo final'}).waitFor();
  await page.getByRole('tab',{name:'Publicação',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Publicar rascunho salvo',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'Liberar aula para alunos',exact:true}).waitFor();
  await page.getByRole('tab',{name:'Apresentações',exact:true}).click();await page.getByLabel('Apresentação',{exact:true}).selectOption(id(9930));await page.getByRole('button',{name:'Visualizar versão salva'}).waitFor();assert.equal(await page.getByRole('button',{name:'Publicar versão 1',exact:true}).isDisabled(),true);
  await page.getByLabel('Pacote ZIP',{exact:true}).setInputFiles({name:'deck.zip',mimeType:'application/zip',buffer:Buffer.from(simpleDeck)});await page.getByRole('region',{name:'Arquivos validados'}).waitFor();
  await page.getByRole('tab',{name:'Importar',exact:true}).click();await page.getByRole('button',{name:/Atividades em JSON/}).click();
  await page.getByLabel('Conteúdo JSON').fill(JSON.stringify(legacy));await page.getByText(/Contrato v1 válido/).waitFor();
  await page.getByRole('button',{name:/Importar aula por ZIP/}).click();
  const uploadButton=page.getByRole('button',{name:'Importar ZIP da aula',exact:true});await uploadButton.waitFor();
  assert.equal(await uploadButton.isEnabled(),true);await page.getByText(/Não envie o Kit Work\./).waitFor();
  const chooserEvent=page.waitForEvent('filechooser');await uploadButton.click();const chooser=await chooserEvent;
  await chooser.setFiles('docs/examples/unified-lesson-package/pacote-sintetico-completo.zip');await page.getByRole('status').filter({hasText:'Pacote válido.'}).waitFor();
  await page.getByText('Arquivo selecionado: pacote-sintetico-completo.zip',{exact:true}).waitFor();
  await page.screenshot({path:'test-results/content-workspace/importar-zip-button.png',fullPage:true});
  assert.equal(await page.getByRole('button',{name:'Salvar pacote em rascunho',exact:true}).isDisabled(),true);
  await page.getByRole('tab',{name:'Apresentações',exact:true}).click();await page.getByRole('region',{name:'Arquivos validados'}).waitFor();
  await page.getByRole('tab',{name:'Importar',exact:true}).click();await page.getByRole('button',{name:/Atividades em JSON/}).click();assert.equal(await page.getByLabel('Conteúdo JSON').inputValue(),JSON.stringify(legacy));
  await a.clean();
 });

 await t.test('Confirma saída por link, voltar do navegador e recarregamento de rascunho',async()=>{
  const a=await app(),{page}=a;await a.goto('/gestao/conteudo?curso='+course.id+'&modulo='+module.id+'&submodulo='+submodule.id);await page.getByRole('link',{name:'Abrir editor de '+lesson.title}).click();
  await page.getByRole('tab',{name:'Atividades',exact:true}).click();await page.getByRole('button',{name:'Editar documento editorial',exact:true}).click();const source=page.getByLabel('Documento da aula');await source.waitFor();const original=await source.inputValue();await source.fill('alteração local');
  page.once('dialog',d=>d.dismiss());await page.getByRole('link',{name:'Voltar ao currículo',exact:true}).click();assert.match(page.url(),/\/gestao\/aulas\//);assert.equal(await source.inputValue(),'alteração local');
  page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Recarregar aula e rascunho'}).click();assert.equal(await source.inputValue(),'alteração local');
  page.once('dialog',d=>d.dismiss());await page.goBack();await page.waitForURL(/\/gestao\/aulas\//);assert.equal(await source.inputValue(),'alteração local');
  await source.fill(original);await page.getByRole('link',{name:'Voltar ao currículo',exact:true}).click();await page.getByRole('heading',{name:'Currículo',exact:true}).waitFor();await a.clean();
 });

 await t.test('Operação de pacote interrompida é recuperada em leitura e preservada entre abas',async()=>{
  const a=await app({pending:true}),{page}=a;await a.goto('/gestao/aulas/'+lessonId+'?aba=publication');
  await page.getByRole('button',{name:'Pacote completo',exact:true}).click();await page.getByRole('heading',{name:'Operação em preparação',exact:true}).waitFor();
  await page.getByRole('tab',{name:'Visão geral',exact:true}).click();await page.getByRole('tab',{name:'Publicação',exact:true}).click();await page.getByRole('heading',{name:'Operação em preparação'}).waitFor();await a.clean();
 });

 await t.test('A02 mantém modo de reconciliação legado sem gravar',async()=>{
  const a=await app(),{page}=a;await a.goto('/gestao/aulas/'+a02+'?aba=import');await page.getByRole('button',{name:/Atividades em JSON/}).click();await page.getByRole('checkbox',{name:/Atualizar a Aula 02/}).waitFor();assert.equal(await page.getByRole('checkbox',{name:/Atualizar a Aula 02/}).isChecked(),true);await a.clean();
 });

 await t.test('Estados de carregamento, erro e recuperação; identificador inexistente',async()=>{
  const a=await app({holdLesson:true,lessonFailures:2}),{page}=a;await a.goto('/gestao/aulas/'+lessonId);await page.getByText('Carregando aula…',{exact:true}).waitFor();a.releaseLesson();await page.getByRole('alert').filter({hasText:'Não foi possível carregar a aula'}).waitFor();await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();await page.getByRole('heading',{name:lesson.title,exact:true}).waitFor();
  await a.goto('/gestao/aulas/'+id(99999));await page.getByText('Aula não encontrada ou sem permissão de acesso.',{exact:true}).waitFor();await a.clean();
 });

 await t.test('Acesso administrativo: anônimo, estudante, professor e admin inativo recusados',async()=>{
  for(const settings of [{role:'anon'},{role:'student'},{role:'professor'},{role:'admin',active:false}]){const a=await app(settings);await a.goto('/gestao/aulas/'+lessonId);await a.page.waitForURL(origin+'/');assert.equal(a.requests.some(r=>r.name==='lessons'||r.name==='admin_editorial_lesson'),false);assert.equal(await a.page.getByRole('heading',{name:lesson.title,exact:true}).count(),0);await a.clean();}
 });

 await t.test('Falha de módulo fica contida na ferramenta e permite continuar navegando',async()=>{
  const a=await app({brokenTool:true}),{page}=a;await a.goto('/gestao/aulas/'+lessonId+'?aba=presentations');
  await page.getByRole('alert').filter({hasText:'Não foi possível abrir esta ferramenta.'}).waitFor();
  await page.getByRole('tab',{name:'Visão geral',exact:true}).click();await page.getByRole('heading',{name:'Sobre esta aula',exact:true}).waitFor();
  await page.getByRole('link',{name:'Voltar ao currículo',exact:true}).click();await page.getByRole('heading',{name:'Currículo',exact:true}).waitFor();await a.clean();
 });

 await t.test('Teclado, desktop e tablet sem overflow horizontal',async()=>{
  const a=await app(),{page}=a;await a.goto('/gestao/aulas/'+lessonId);await page.getByRole('heading',{name:lesson.title,exact:true}).waitFor();
  await page.getByRole('tab',{name:'Visão geral',exact:true}).focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('#tab-activities')?.getAttribute('aria-selected')==='true');await page.keyboard.press('End');await page.waitForFunction(()=>document.querySelector('#tab-publication')?.getAttribute('aria-selected')==='true');
  await page.getByRole('tab',{name:'Visão geral',exact:true}).click();await page.getByRole('heading',{name:'Sobre esta aula',exact:true}).waitFor();await page.getByText('Processando…',{exact:true}).waitFor({state:'hidden'});await page.screenshot({path:'test-results/content-workspace/editor-desktop.png',fullPage:true});
  for(const width of [1024,768]){await page.setViewportSize({width,height:1024});for(const tab of ['Visão geral','Atividades','Apresentações','Importar','Publicação']){await page.getByRole('tab',{name:tab,exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${tab}: ${width}`);}}
  await page.getByRole('tab',{name:'Importar',exact:true}).click();await page.screenshot({path:'test-results/content-workspace/editor-tablet.png',fullPage:true});await a.clean();
 });
 writeFileSync('test-results/content-workspace/result.json',JSON.stringify({syntheticOnly:true,productionAccess:false,contentMutationsPerformed:false,localDatabaseStarted:false},null,2));
});
