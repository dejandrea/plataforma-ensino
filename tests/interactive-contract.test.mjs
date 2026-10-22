import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {interactiveDocument,prepareInteractiveContent} from './fixtures/interactive-content.mjs';
import {createLearningTestDb,id} from './fixtures/learning-test-db.mjs';

const require=createRequire(import.meta.url);
const compiled=ts.transpileModule(readFileSync('src/lib/learningContent.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const module={exports:{}};
new Function('require','module','exports',compiled)(name=>name.endsWith('.json')?JSON.parse(readFileSync(`src/contracts/${name.split('/').at(-1)}`,'utf8')):require(name),module,module.exports);
const {validateLessonImport,toStudentLesson}=module.exports;
const invalid={
  'unsupported version':d=>{d.schemaVersion=3;},
  'duplicate ordering IDs':d=>{d.activities[0].content.items[1].id=d.activities[0].content.items[0].id;},
  'duplicate matching IDs':d=>{d.activities[1].content.rightItems[1].id=d.activities[1].content.rightItems[0].id;},
  'incomplete matching sides':d=>{d.activities[1].content.rightItems.pop();},
  'incomplete order key':d=>{d.teacherOnly.interactiveKeys[0].content.correctOrder.pop();},
  'unknown item in key':d=>{d.teacherOnly.interactiveKeys[0].content.correctOrder[0]='unknown';},
  'duplicate order key':d=>{d.teacherOnly.interactiveKeys[0].content.correctOrder[1]=d.teacherOnly.interactiveKeys[0].content.correctOrder[0];},
  'repeated right association':d=>{d.teacherOnly.interactiveKeys[1].content.pairs[1].rightId=d.teacherOnly.interactiveKeys[1].content.pairs[0].rightId;},
  'orphan key':d=>{d.teacherOnly.interactiveKeys[0].activityKey='unknown';},
  'missing key':d=>{d.teacherOnly.interactiveKeys.pop();},
  'duplicate key':d=>{d.teacherOnly.interactiveKeys.push(structuredClone(d.teacherOnly.interactiveKeys[0]));},
  'key in public content':d=>{d.activities[0].content.correctOrder=['abaco'];},
  'incorrect award condition':d=>{d.activities[0].gamification.awardOn='approved';},
  'incorrect reward rule':d=>{d.activities[0].gamification.rewardRuleKey='activity_project';},
  'browser XP amount':d=>{d.activities[0].gamification.xpReward=10000;},
  'future subtype':d=>{d.activities[0].content.interactionType='fill_blank';},
  'invalid score':d=>{d.activities[0].content.passingScore=101;},
  'invalid maximum':d=>{d.activities[0].content.maxAttempts=0;},
};
test('v2 authoring validates without mutation and public projection strips all keys',()=>{
  const d=interactiveDocument(),before=structuredClone(d);assert.equal(validateLessonImport(d).valid,true);assert.deepEqual(d,before);
  const publicDoc=toStudentLesson(d);for(const secret of ['teacherOnly','correctOrder','rightId','optionKey'])assert.equal(JSON.stringify(publicDoc).includes(`"${secret}"`),false);
  assert.equal(validateLessonImport(JSON.parse(readFileSync('docs/examples/html-primeira-pagina.v1.json','utf8'))).valid,true);
});
for(const [name,mutate] of Object.entries(invalid))test(`v2 rejects ${name}`,()=>{const d=interactiveDocument();mutate(d);assert.equal(validateLessonImport(d).valid,false);});

test('backend validates the same examples and rejects invalid imports atomically',async t=>{
  const db=await createLearningTestDb({b1:true});t.after(()=>db.db.close());
  const {lessonId}=await prepareInteractiveContent(db,{importContent:false});await db.login('admin');
  for(const [name,mutate] of Object.entries(invalid)) {
    const d=interactiveDocument();mutate(d);
    await assert.rejects(db.rpc('import_learning_lesson',[lessonId,JSON.stringify(d),true]),undefined,name);
    assert.equal(await db.count('lesson_activities',`where lesson_id='${lessonId}'`),0,name);
  }
  const v2=interactiveDocument();
  const result=await db.rpc('import_learning_lesson',[lessonId,JSON.stringify(v2),false]);assert.equal(result.published,false);
  await db.login();assert.equal((await db.rpc('student_lesson_learning',[lessonId])).activities.length,0);
  await db.login('admin');await db.rpc('publish_learning_activities',[lessonId,result.activityIds]);
  await db.login();assert.equal((await db.rpc('student_lesson_learning',[lessonId])).activities.length,3);
  await db.login('admin','postgres');
  const v1=JSON.parse(readFileSync('docs/examples/html-primeira-pagina.v1.json','utf8'));v1.context=v2.context;
  await db.query('insert into lessons(id,submodule_id,title) values($1,$2,$3)',[id(905),id(902),v1.lesson.title]);
  await db.login('admin');
  const legacy=await db.rpc('import_learning_lesson',[id(905),JSON.stringify(v1),true]);assert.equal(legacy.activityIds.length,5);
});
