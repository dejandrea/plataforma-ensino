import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync('src/lib/learningProgress.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
}).outputText;
const { requiredActivityProgress,resumeActivityId,safeHttpsUrl,safeVideoEmbed,activityStatusLabels,resourcePreview } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('student PDF preview uses Drive embed URLs, preserves resource keys and only trusts the exact viewer origin',()=>{
 assert.deepEqual(resourcePreview('https://drive.google.com/file/d/file_123/view?usp=sharing&authuser=1&resourcekey=share-key'),{url:'https://drive.google.com/file/d/file_123/preview?resourcekey=share-key',googleDrive:true});
 assert.equal(resourcePreview('https://drive.google.com/open?id=file_123').url,'https://drive.google.com/file/d/file_123/preview');
 assert.equal(resourcePreview('https://drive.google.com/file/d/file_123/preview').googleDrive,true);
 assert.equal(resourcePreview('https://drive.google.com.evil.example/file/d/file_123/view').googleDrive,false);
 assert.equal(resourcePreview('https://drive.google.com/accounts/login').googleDrive,false);
 assert.equal(resourcePreview('https://example.org/slides.pdf').googleDrive,false);
 assert.equal(resourcePreview('javascript:alert(1)'),null);
});

test('reloading resumes saved work before untouched optional activities',() => {
  const activities=[{id:'optional',is_required:false,revision:1,is_unlocked:true},{id:'required',is_required:true,revision:1,is_unlocked:true},{id:'quiz',revision:1,is_unlocked:true}];
  assert.equal(resumeActivityId({activities,progress:[]}),'required');
  assert.equal(resumeActivityId({activities,progress:[{activity_id:'quiz',activity_revision:1,status:'in_progress',updated_at:'2026-10-21T01:00:00Z'}]}),'quiz');
  assert.equal(resumeActivityId({activities:[],progress:[]}),null);
});

test('required progress excludes optional, retired, draft and outdated revision records',() => {
  const activity = (id,other={}) => ({id,revision:1,is_required:true,is_active:true,publication_status:'published',...other});
  const data = {activities:[activity('a'),activity('b'),activity('c'),activity('optional',{is_required:false}),activity('retired',{is_active:false}),activity('draft',{publication_status:'draft'})],
    progress:[{activity_id:'a',activity_revision:1,status:'completed'},{activity_id:'b',activity_revision:2,status:'completed'},{activity_id:'c',activity_revision:1,status:'pending_review'}]};
  assert.deepEqual(requiredActivityProgress(data),{completed:1,total:3,percent:33});
  assert.deepEqual(requiredActivityProgress({activities:[activity('optional',{is_required:false})],progress:[]}),{completed:0,total:0,percent:0});
});

test('all learning states have distinct student labels',() => {
  assert.equal(Object.keys(activityStatusLabels).length,5);
  assert.equal(new Set(Object.values(activityStatusLabels)).size,5);
  assert.equal(activityStatusLabels.pending_review,'Aguardando professora');
  assert.equal(activityStatusLabels.needs_revision,'Precisa de ajustes');
});

test('resources reject executable, malformed and non-HTTPS URLs',() => {
  for (const url of [null,'','javascript:alert(1)','data:text/html,hi','http://example.com','/local','https://example.com/with space','https://example.com\n']) assert.equal(safeHttpsUrl(url),null);
  assert.equal(safeHttpsUrl('https://example.com/material.pdf'),'https://example.com/material.pdf');
});

test('legacy video embeds are limited to recognized video providers, other links stay external',() => {
  assert.equal(safeVideoEmbed('https://www.youtube.com/watch?v=abcdefghijk'),'https://www.youtube-nocookie.com/embed/abcdefghijk');
  assert.equal(safeVideoEmbed('https://youtu.be/abcdefghijk'),'https://www.youtube-nocookie.com/embed/abcdefghijk');
  assert.equal(safeVideoEmbed('https://player.vimeo.com/video/12345'),'https://player.vimeo.com/video/12345');
  assert.equal(safeVideoEmbed('https://example.com/unsafe-html'),null);
  assert.equal(safeVideoEmbed('https://www.youtube.com.evil.example/watch?v=abcdefghijk'),null);
});

function service(result) {
  const calls=[];
  const supabase={rpc:async(name,args) => {calls.push({name,args}); return result;}};
  const source=ts.transpileModule(readFileSync('src/lib/studentLearning.ts','utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  const module={exports:{}};
  new Function('require','module','exports',source)(() => ({supabase}),module,module.exports);
  return {api:module.exports,calls};
}

test('missing migration fails closed instead of switching to unsafe manual completion',async() => {
  const {api}=service({data:null,error:{code:'PGRST202',message:'RPC missing'}});
  await assert.rejects(api.fetchStudentLesson('lesson'),/temporariamente indisponível/);
  await assert.rejects(api.completeStudentLesson('lesson'),/temporariamente indisponível/);
});

test('unexpected API errors do not expose SQL internals in the student interface',async() => {
  const {api}=service({data:null,error:{code:'42P01',message:'relation private.secret_table does not exist'}});
  await assert.rejects(api.fetchStudentLesson('lesson'),error => !error.message.includes('secret_table') && error.message.includes('Verifique sua conexão'));
});

test('client sends only selected answers and a stable request ID; results remain server-owned',async() => {
  const {api,calls}=service({data:{id:'attempt',score:0,passed:false},error:null});
  const result=await api.submitStudentQuiz('activity',{'question':'option'},'retry-id');
  assert.equal(result.score,0);
  assert.deepEqual(calls,[{name:'submit_student_quiz',args:{p_activity_id:'activity',p_answers:{question:'option'},p_request_id:'retry-id'}}]);
});
