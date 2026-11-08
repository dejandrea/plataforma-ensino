import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';

const compile = file => ts.transpileModule(readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
const load = async file => import(`data:text/javascript;base64,${Buffer.from(compile(file)).toString('base64')}`);
const meet = await load('supabase/functions/_shared/meet-link.ts');
globalThis.Deno = {env: {get: () => ''}};
const google = await load('supabase/functions/_shared/google-calendar.ts');
const recurrence = await load('supabase/functions/_shared/recurrence.ts');
const fixed = 'https://meet.google.com/abc-defg-hij', exception = 'https://meet.google.com/klm-nopq-rst';

function clientFor(rows, preference = fixed) {
  const state = {rows: structuredClone(rows), preference, active: true};
  const client = {from(table) {
    let conditions=[], action, payload;
    const query = {
      select: () => query, order: () => query,
      eq: (k,v) => {conditions.push(r => r[k] === v); return query;},
      is: (k,v) => {conditions.push(r => (r[k] ?? null) === v); return query;},
      gte: (k,v) => {conditions.push(r => r[k]>=v); return query;},
      lte: (k,v) => {conditions.push(r => r[k]<=v); return query;},
      gt: (k,v) => {conditions.push(r => r[k]>v); return query;},
      lt: (k,v) => {conditions.push(r => r[k]<v); return query;},
      update: value => {action='update';payload=value;return query;},
      insert: value => {action='insert';payload=value;return query;},
      maybeSingle: async () => {const r=execute();return {data:Array.isArray(r)?r[0]??null:r,error:null};},
      single: async () => query.maybeSingle(),
      then: (ok, bad) => Promise.resolve({data:execute(),error:null}).then(ok,bad),
    };
    function execute() {
      if(table==='teacher_student_relations') return {student_id:'student', default_meet_link:state.preference};
      if(table==='profiles') return {full_name:'Aluno sintético',is_active:state.active};
      if(table==='access_invites') return {email:'synthetic@example.test'};
      if(table==='teacher_calendar_settings') return {is_active:true,connection_status:'connected',event_calendar_ids:['test'],timezone:'America/Bahia',auto_create_meet:true};
      if(table==='scheduled_lessons') {
        if(action==='insert') {const added=(Array.isArray(payload)?payload:[payload]).map(r=>({...r,id:crypto.randomUUID()}));state.rows.push(...added);action=null;return added;}
        const found=state.rows.filter(r=>conditions.every(c=>c(r)));
        if(action==='update') {for(const row of found)Object.assign(row,payload);action=null;}
        return found;
      }
      throw new Error('Unexpected test table '+table);
    }
    return query;
  }};
  return {state, client};
}
function edge(name, client, role='professor') {
  let handler; const calls=[];
  const dependencies = {
    serve: fn => {handler=fn;}, corsHeaders: {},
    getAuthenticatedProfile: async()=>({adminClient:client,user:{id:role==='student'?'student':'teacher'},profile:{role,full_name:'Aluno sintético'}}),
    assertStudentCanBook: async()=>{}, ensureFreshGoogleAccessToken: async()=>({accessToken:'synthetic'}),
    createGoogleCalendarEvent: async args=>{calls.push(args); return {id:crypto.randomUUID(),hangoutLink:args.meetLink || exception};},
    updateGoogleCalendarEvent: async args=>{calls.push(args);return {hangoutLink:exception};},
    replaceGoogleEventMeet: async args=>{calls.push(args);return {};},
    extractMeetLink: google.extractMeetLink, ...meet, ...recurrence,
  };
  const source=compile(`supabase/functions/${name}/index.ts`).replace(/^import[\s\S]*?from .*?;\s*$/gm,'').replace(/^export /gm,'');
  new Function(...Object.keys(dependencies),source)(...Object.values(dependencies));
  const raw=body=>handler(new Request('https://local.test',{method:'POST',body:JSON.stringify(body)}));
  return {calls,raw,invoke:async body=>{const response=await raw(body);const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;}};
}
const slot = i => ({id:`slot-${i}`,teacher_id:'teacher',student_id:null,status:'available',title:'Aula sintética',starts_at:`2099-01-${String(i).padStart(2,'0')}T18:00:00Z`,ends_at:`2099-01-${String(i).padStart(2,'0')}T19:00:00Z`,session_track:'mentoring',meet_link:null});

test('actual booking handler uses default on multiple new lessons, per-lesson exception and later default never rewrite history',async()=>{
  const {state,client}=clientFor([slot(1),slot(2),slot(3)]);
  const book=edge('book-platform-lesson',client,'student');
  for(const row of state.rows.slice(0,2))await book.invoke({lessonId:row.id});
  assert.deepEqual(state.rows.slice(0,2).map(r=>r.meet_link),[fixed,fixed]);
  assert.ok(book.calls.every(c=>c.meetLink===fixed&&c.autoCreateMeet===false));
  state.preference=exception;
  await book.invoke({lessonId:'slot-3'});
  assert.deepEqual(state.rows.map(r=>r.meet_link),[fixed,fixed,exception]);
  state.rows[1].meet_link=exception;
  const before=structuredClone(state.rows);
  const reschedule=edge('reschedule-platform-lesson',client);
  await reschedule.invoke({lessonId:'slot-1',startsAt:'2099-02-01T18:00:00Z',scope:'single'});
  assert.equal(state.rows[0].meet_link,fixed);
  assert.deepEqual(state.rows.slice(1),before.slice(1));
});
test('actual staff confirmation supports an explicit exception without changing the default',async()=>{
  const {state,client}=clientFor([slot(1)]);
  const confirm=edge('confirm-platform-lesson',client);
  await confirm.invoke({lessonId:'slot-1',studentId:'student',meetLink:exception,useDefaultMeet:false,requestId:crypto.randomUUID()});
  assert.equal(state.rows[0].meet_link,exception);assert.equal(state.preference,fixed);
  assert.equal(confirm.calls[0].meetLink,exception);assert.equal(confirm.calls[0].autoCreateMeet,false);
});
test('no default retains automatic conference generation; invalid links and unconfirmed replacement are rejected',async()=>{
  const {client}=clientFor([slot(1)],null);const book=edge('book-platform-lesson',client,'student');await book.invoke({lessonId:'slot-1'});
  assert.equal(book.calls[0].autoCreateMeet,true);
  for(const url of ['https://meet.google.com.evil.test/abc-defg-hij','http://meet.google.com/abc-defg-hij','https://user@meet.google.com/abc-defg-hij','https://meet.google.com/abc-defg-hij?x=1','javascript:alert(1)']) assert.throws(()=>meet.normalizeMeetLink(url));
  assert.throws(()=>meet.chooseNewLessonMeet(fixed,exception,null,true,false),/Confirme/);
});
test('Google request with fixed room has no conference createRequest; explicit room survives synchronization',async()=>{
  let request;
  globalThis.fetch=async(url,options)=>{request={url:new URL(url),body:JSON.parse(options.body)};return Response.json({id:'event'});};
  await google.createGoogleCalendarEvent({accessToken:'synthetic',calendarId:'test',summary:'Aula',startDateTime:'2099-01-01',endDateTime:'2099-01-02',autoCreateMeet:true,meetLink:fixed});
  assert.equal(request.body.conferenceData,undefined);assert.equal(request.body.location,fixed);assert.equal(request.url.searchParams.has('conferenceDataVersion'),false);
  assert.equal(google.extractMeetLink({...request.body,hangoutLink:exception}),fixed);
  await assert.rejects(google.replaceGoogleEventMeet({confirmed:false}),/Confirme/);
  globalThis.fetch=async(url,options)=>{
    if(options.method!=='PATCH') return Response.json({etag:'version-1',extendedProperties:{private:{keep:'yes'}},summary:'Original'});
    request={url:new URL(url),body:JSON.parse(options.body),headers:options.headers};return Response.json({id:'event'});
  };
  await google.replaceGoogleEventMeet({accessToken:'synthetic',calendarId:'test',eventId:'event',meetLink:fixed,confirmed:true});
  assert.equal(request.body.conferenceData,null);assert.equal(request.body.extendedProperties.private.keep,'yes');
  assert.equal(request.headers['If-Match'],'version-1');assert.equal(request.body.summary,undefined);assert.equal(request.body.start,undefined);
  globalThis.fetch=async(_url,options)=>options.method==='POST' ? new Response('{}',{status:409}) : Response.json({hangoutLink:exception});
  await assert.rejects(google.createGoogleCalendarEvent({accessToken:'synthetic',calendarId:'test',eventId:'retry',summary:'Aula',startDateTime:'2099-01-01',endDateTime:'2099-01-02',autoCreateMeet:false,meetLink:fixed}),/outra sala/);
});

test('per-lesson endpoint rejects unrelated/student/inactive callers, stale links and unconfirmed external changes',async()=>{
  const row={...slot(1),status:'scheduled',student_id:'student',meet_link:fixed,calendar_event_id:'external',calendar_calendar_id:'test'};
  const {client,state}=clientFor([row,{...row,id:'other-lesson'}]);
  const request={lessonId:row.id,meetLink:exception,expectedMeetLink:fixed};
  const staff=edge('update-lesson-meet',client);
  assert.equal((await staff.raw(request)).status,400);assert.equal(staff.calls.length,0);
  assert.equal((await edge('update-lesson-meet',client,'student').raw({...request,confirmExternalChange:true})).status,400);
  state.active=false;assert.equal((await staff.raw({...request,confirmExternalChange:true})).status,400);state.active=true;
  assert.equal((await staff.raw({...request,expectedMeetLink:exception,confirmExternalChange:true})).status,400);
  await staff.invoke({...request,confirmExternalChange:true});
  assert.equal(state.rows[0].meet_link,exception);assert.equal(state.rows[1].meet_link,fixed);assert.equal(state.preference,fixed);
  state.rows[0].teacher_id='other';assert.equal((await staff.raw({...request,expectedMeetLink:exception,confirmExternalChange:true})).status,400);
  state.rows[0].teacher_id='teacher';state.rows[0].status='completed';
  assert.equal((await staff.raw({...request,expectedMeetLink:exception,confirmExternalChange:true})).status,400);
});

test('real migration preserves existing rows and RLS permits assigned teacher/admin only to update the default',async t=>{
  const db=new PGlite();t.after(()=>db.close());
  await db.exec(`create role authenticated;create role anon;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create table profiles(id uuid primary key,role text,is_active boolean);create table teacher_student_relations(teacher_id uuid,student_id uuid,primary key(teacher_id,student_id));
    alter table teacher_student_relations enable row level security;grant select on profiles,teacher_student_relations to authenticated;
    create policy assigned_read on teacher_student_relations for select to authenticated using(teacher_id=auth.uid() or student_id=auth.uid());
    insert into profiles values('00000000-0000-4000-8000-000000000001','professor',true),('00000000-0000-4000-8000-000000000002','student',true),('00000000-0000-4000-8000-000000000003','admin',true),('00000000-0000-4000-8000-000000000004','professor',true);
    insert into teacher_student_relations values('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');`);
  await db.exec(readFileSync('supabase/migrations/20261108210555_student_meet_preferences.sql','utf8'));
  assert.equal((await db.query('select default_meet_link from teacher_student_relations')).rows[0].default_meet_link,null);
  await db.exec('set role authenticated');
  const login=n=>db.query("select set_config('test.uid',$1,false)",[`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`]);
  const save=link=>db.query("select public.set_student_meet_link('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',$1)",[link]);
  for(const n of [2,4]){await login(n);await assert.rejects(save(fixed),/autorizado/);}
  for(const n of [1,3]){await login(n);assert.equal((await save(fixed)).rows.length,1);}
  await assert.rejects(db.query("update teacher_student_relations set teacher_id='00000000-0000-4000-8000-000000000004'"),/permission denied/);
  await assert.rejects(save('https://evil.test'),/check/);
  await db.exec('reset role');
  await db.exec(`create table module_evaluations(id integer primary key,student_id uuid);alter table module_evaluations enable row level security;
    grant select on module_evaluations to authenticated;
    insert into module_evaluations values(1,'00000000-0000-4000-8000-000000000002'),(2,'00000000-0000-4000-8000-000000000099');`);
  const evaluationReadPolicy=readFileSync('supabase/migrations/20261006032049_restrict_evaluations_to_active_curriculum.sql','utf8').match(/create policy evaluations_assigned_teacher_select[\s\S]*?\n\);/)[0];
  await db.exec(evaluationReadPolicy);await db.exec('set role authenticated');
  await login(1);assert.equal((await db.query('select * from module_evaluations')).rows.length,1);
  await login(4);assert.equal((await db.query('select * from module_evaluations')).rows.length,0);
  await db.exec('reset role');await db.exec("update profiles set is_active=false where role='professor'");await db.exec('set role authenticated');
  await login(1);assert.equal((await db.query('select * from module_evaluations')).rows.length,0);await assert.rejects(save(fixed),/autorizado/);
});

test('narrow scheduling prerequisite preserves legacy rows and enforces occurrence idempotency',async t=>{
  const db=new PGlite();t.after(()=>db.close());
  await db.exec(`create table scheduled_lessons(id integer primary key,teacher_id uuid,recurrence_index integer,meet_link text);
    insert into scheduled_lessons values(1,'00000000-0000-4000-8000-000000000001',1,'https://meet.google.com/abc-defg-hij');`);
  const before=(await db.query('select to_jsonb(s) row from scheduled_lessons s')).rows[0].row;
  await db.exec(readFileSync('supabase/migrations/20261108210544_scheduling_request_prerequisite.sql','utf8'));
  const after=(await db.query("select to_jsonb(s)-'scheduling_request_id' row from scheduled_lessons s")).rows[0].row;
  assert.deepEqual(after,before);
  await db.exec("insert into scheduled_lessons values(2,'00000000-0000-4000-8000-000000000001',1,null,'00000000-0000-4000-8000-000000000009')");
  await assert.rejects(db.exec("insert into scheduled_lessons values(3,'00000000-0000-4000-8000-000000000001',1,null,'00000000-0000-4000-8000-000000000009')"),/unique/);
});
