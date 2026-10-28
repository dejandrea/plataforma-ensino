import { createServer as createHttpServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createServer as createViteServer } from 'vite';
import react from '@vitejs/plugin-react';
import { createLearningTestDb, fixtureUsers, id, learningMigration, readSql } from './learning-test-db.mjs';


export async function createLearningBrowser(t, {teacher = false,officialXp = false,improvements = false,video = false,pedagogy = false,curriculum = false,flashcards = false} = {}) {
  const database = improvements||pedagogy||curriculum||flashcards ? await (await import('./improvements-db.mjs')).createImprovementsDb() : await createLearningTestDb({b1:true});
  const { db,query,login } = database;
  t.after(() => db.close());
  await login('admin','postgres');
  if(!improvements&&!pedagogy&&(teacher||officialXp||video)) await db.exec(readSql(learningMigration('_teacher_learning_workspace.sql')));
  if(!improvements&&!pedagogy&&(officialXp||video)) await db.exec(readSql(learningMigration('_official_xp_rules_v1.sql')));
  if(video) await db.exec(readSql(learningMigration('_video_learning_activity.sql')));
  if(pedagogy) await (await import('./pedagogy-db.mjs')).preparePedagogy(database);
  if(curriculum||flashcards) {const prepared=await (await import('./curriculum-db.mjs')).prepareCurriculumFixture(database);await db.exec(prepared.releaseSql);}
  if(flashcards) await (await import('./flashcards-db.mjs')).prepareFlashcards(database);
  const requests = [];
  let loseQuizResponse = false;
  let identity = 'student';
  const rpcArguments = {
    student_lesson_learning:['p_lesson_id'],start_student_activity:['p_activity_id'],complete_student_study:['p_activity_id'],
    complete_student_lesson:['p_lesson_id'],submit_student_quiz:['p_activity_id','p_answers','p_request_id'],
    begin_student_assessment:['p_activity_id'],submit_student_assessment:['p_activity_id','p_answers','p_session_id'],
    import_learning_lesson:['p_lesson_id','p_document','p_publish'],publish_learning_activities:['p_lesson_id','p_activity_ids'],
    teacher_learning_workspace:['p_scheduled_lesson_id'],link_teacher_learning_activity:['p_scheduled_lesson_id','p_activity_id'],
    save_teacher_learning_session:['p_session_id','p_version','p_completed_step_keys','p_notes','p_evaluation'],
    confirm_teacher_learning_activity:['p_session_id','p_version'],
    submit_student_project:['p_activity_id','p_submission_url','p_student_notes','p_request_id',...(improvements||pedagogy?['p_project_description','p_additional_links']:[])],
    review_student_project:['p_submission_id','p_status','p_grade','p_feedback','p_request_id'],teacher_project_inbox:['p_scheduled_lesson_id'],teacher_student_projects:['p_student_id'],
    pedagogy_dashboard:['p_search','p_course_id','p_teacher_id','p_status','p_page','p_page_size','p_since','p_until'],
    pedagogy_student_journey:['p_student_id','p_course_id'],pedagogy_lesson_detail:['p_student_id','p_lesson_id','p_page','p_page_size'],
    pedagogy_activity_attempts:['p_student_id','p_activity_id','p_page','p_page_size'],
    pedagogy_projects:['p_search','p_course_id','p_teacher_id','p_status','p_page','p_page_size','p_student_id'],pedagogy_project_detail:['p_submission_id'],
    publish_curriculum_lesson:['p_lesson_id'],
    student_flashcard_progress:['p_activity_id'],review_student_flashcard:['p_activity_id','p_card_id'],
  };
  // Only PostgREST's HTTP shape/auth identity is replaced. Every operation below
  // runs the actual migration's function as authenticated inside a transaction.
  const api = createHttpServer(async (req,res) => {
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,x-client-info');
    if (req.method==='OPTIONS') { res.writeHead(204); res.end(); return; }
    const name = req.url?.split('/').at(-1);
    if (req.method!=='POST' || !Object.hasOwn(rpcArguments,name) || req.headers.authorization!=='Bearer test-local-public-key') {
      res.writeHead(403); res.end('{}'); return;
    }
    try {
      let body = ''; for await (const chunk of req) body+=chunk;
      const params = JSON.parse(body);
      requests.push({ name,params });
      const args = rpcArguments[name].map(key => ['p_answers','p_document','p_evaluation','p_additional_links'].includes(key) ? JSON.stringify(params[key]) : params[key]);
      const value = await db.transaction(async tx => {
        await tx.exec('set local role authenticated');
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[fixtureUsers[identity]]);
        return (await tx.query(`select public.${name}(${args.map((_,i) => `$${i+1}`).join(',')}) value`,args)).rows[0].value;
      });
      if (['submit_student_quiz','submit_student_assessment','review_student_flashcard'].includes(name) && loseQuizResponse) { loseQuizResponse=false; req.socket.destroy(); return; }
      res.writeHead(200,{'content-type':'application/json'}); res.end(JSON.stringify(value));
    } catch (error) {
      res.writeHead(400,{'content-type':'application/json'});
      res.end(JSON.stringify({ message:error.message,code:error.code,details:null,hint:null }));
    }
  });
  await new Promise(resolve => api.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => api.close(resolve)));
  const apiUrl = `http://127.0.0.1:${api.address().port}`;
  const vite = await createViteServer({ configFile:false,envFile:false,plugins:[react()],server:{host:'127.0.0.1',port:0},
    optimizeDeps:{include:['react','react-dom/client','react-router-dom','@supabase/supabase-js','ajv','pdf-lib','@pdf-lib/fontkit']},
    define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(apiUrl),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('test-local-public-key')} });
  await vite.listen(); t.after(() => vite.close());
  const appUrl = vite.resolvedUrls.local[0];
  const browser = await chromium.launch({ channel:process.env.PLAYWRIGHT_CHANNEL ?? (process.platform==='win32' ? 'chrome' : undefined),headless:true });
  let lastPage;
  const pageErrors = [];
  const steps = [];
  t.after(async () => {
    if (lastPage && !lastPage.isClosed()) {
      await mkdir('test-results',{recursive:true});
      await lastPage.screenshot({path:'test-results/learning-last-state.png',fullPage:true}).catch(() => {});
      t.diagnostic(JSON.stringify({steps,pageErrors,requests:requests.map(r => r.name),page:await lastPage.locator('body').innerText().catch(() => 'closed')}).slice(0,4000));
    }
    await browser.close();
  });
  const context = await browser.newContext({ viewport:{ width:1365,height:1000 } });
  await context.route('**/*',route => {
    const url = new URL(route.request().url());
    return url.hostname==='127.0.0.1' || url.hostname==='localhost' ? route.continue() : route.fulfill({ status:200,contentType:'text/plain',body:'Recurso externo simulado no teste local.' });
  });
  const page = await context.newPage();
  lastPage=page;
  page.setDefaultTimeout(25000);
  page.setDefaultNavigationTimeout(30000);
  page.on('pageerror',error => pageErrors.push(error.message));
  return { ...database,context,page,appUrl,requests,pageErrors,steps,setIdentity:user => { identity=user; },loseResponse:() => { loseQuizResponse=true; } };
}
