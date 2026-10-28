import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {createFlashcardsDb,flashcardsDocument} from './fixtures/flashcards-db.mjs';
import {createCurriculumDb} from './fixtures/curriculum-db.mjs';
import {id,fixtureUsers,learningMigration,readSql} from './fixtures/learning-test-db.mjs';
const require=createRequire(import.meta.url),module={exports:{}};
new Function('require','module','exports',ts.transpileModule(readSql('src/lib/learningContent.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText)(name=>name.endsWith('.json')?JSON.parse(readFileSync('src/contracts/'+name.split('/').at(-1),'utf8')):require(name),module,module.exports);
const {validateLessonImport,toStudentLesson}=module.exports;
const shuffleModule=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readSql('src/lib/flashcards.ts'),{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText).toString('base64'));
const invalid={
 'empty deck':d=>{d.activities[0].content.cards=[];},
 'too many cards':d=>{d.activities[0].content.cards=Array.from({length:101},(_,i)=>({...d.activities[0].content.cards[0],id:'card-'+i}));},
 'duplicate IDs':d=>{d.activities[0].content.cards[1].id='html';},
 'blank title':d=>{d.activities[0].content.cards[0].front.title='  ';},
 'oversized explanation':d=>{d.activities[0].content.cards[0].back.explanation='x'.repeat(4001);},
 'unknown field':d=>{d.activities[0].content.cards[0].front.correct=true;},
 'image missing alt':d=>{d.activities[0].content.cards[0].front.image={resourceUrl:'https://example.org/image.png'};},
 'unsafe image':d=>{d.activities[0].content.cards[0].front.image={resourceUrl:'javascript:alert(1)',altText:'Imagem'};},
 'credentials in image':d=>{d.activities[0].content.cards[0].front.image={resourceUrl:'https://user:pass@example.org/image.png',altText:'Imagem'};},
 'v1 envelope':d=>{d.schemaVersion=1;},
 'wrong reward':d=>{d.activities[0].gamification.rewardRuleKey='activity_interactive';}
};
test('flashcards v2 contract, safe student projection and immutable shuffle',()=>{
 const doc=flashcardsDocument(),before=structuredClone(doc);assert.equal(validateLessonImport(doc).valid,true);assert.deepEqual(doc,before);
 assert.equal(validateLessonImport(JSON.parse(readSql('docs/examples/cartoes-didaticos.v2.admin.json'))).valid,true);
 const contract=JSON.parse(readSql('src/contracts/learning-content.v2.schema.json')).properties.activities.items.oneOf.find(v=>v.properties.type.const==='flashcards').properties.content;
 assert.deepEqual(JSON.parse(readSql('docs/examples/flashcards-content.v2.schema.json')),contract);
 assert.equal('teacherOnly' in toStudentLesson(doc),false);
 doc.activities[0].content.cards[0].front.image={resourceUrl:'https://example.org/card.png',altText:'Descrição da imagem'};
 assert.equal(validateLessonImport(doc).valid,true);
 for(const [name,mutate] of Object.entries(invalid)){const d=flashcardsDocument();mutate(d);assert.equal(validateLessonImport(d).valid,false,name);}
 for(const file of ['html-primeira-pagina.v1.json','maquinas-interativas.v2.json'])assert.equal(validateLessonImport(JSON.parse(readSql('docs/examples/'+file))).valid,true);
 const ids=before.activities[0].content.cards.map(c=>c.id),shuffled=shuffleModule.shuffleCards(ids,()=>0);
 assert.notDeepEqual(shuffled,ids);assert.deepEqual([...shuffled].sort(),[...ids].sort());assert.deepEqual(ids,before.activities[0].content.cards.map(c=>c.id));
});
test('flashcards: backend persistence, authorization, completion and unique official study reward',async t=>{
 const d=await createFlashcardsDb();t.after(()=>d.db.close());const {rpc,query,login,activityId,lessonId,document}=d;
 const review=card=>rpc('review_student_flashcard',[activityId,card]);
 await t.test('read-only opens and partial review do not complete or award XP; generic completion cannot bypass cards',async()=>{
  const empty=await rpc('student_flashcard_progress',[activityId]);assert.equal(empty.reviewed_count,0);
  assert.equal((await query('select count(*) n from student_activity_progress where activity_id=$1',[activityId])).rows[0].n,0);
  await rpc('start_student_activity',[activityId]);await assert.rejects(rpc('complete_student_study',[activityId]),/avaliacao|confirmacao/);
  const partial=await review('html');assert.equal(partial.reviewed_count,1);assert.equal(partial.completed,false);
  await assert.rejects(review('forged-id'),/Cartão inválido/);
  await assert.rejects(rpc('complete_student_lesson',[lessonId]),/obrigatorias/);
  assert.equal((await query('select count(*) n from student_xp_events where source_id=$1',[activityId])).rows[0].n,0);
 });
 await t.test('reload and retries merge the server state and preserve first review; two students cannot share progress',async()=>{
  const state=await rpc('student_flashcard_progress',[activityId]);assert.deepEqual(state.reviewed_card_ids,['html']);
  const firstReview=()=>d.db.transaction(async tx=>{await tx.exec('set local role postgres');return (await tx.query("select first_reviewed_at from private.flashcard_review_progress where student_id=$1 and activity_id=$2 and card_id='html'",[fixtureUsers.student,activityId])).rows[0].first_reviewed_at;});
  const first=await firstReview();
  await Promise.all([review('html'),review('html')]);assert.equal((await rpc('student_flashcard_progress',[activityId])).reviewed_count,1);
  assert.deepEqual(await firstReview(),first);
  await login('other');assert.equal((await rpc('student_flashcard_progress',[activityId])).reviewed_count,0);
  await review('css');assert.equal((await rpc('student_flashcard_progress',[activityId])).reviewed_count,1);await login();
 });
 await t.test('only all valid backs complete the activity and lesson; repeated reviews never duplicate XP',async()=>{
  for(const card of document.activities[0].content.cards.slice(1))await review(card.id);
  const complete=await rpc('student_flashcard_progress',[activityId]);assert.equal(complete.completed,true);assert.equal(complete.reviewed_count,6);
  await Promise.all([review('html'),review('accessibility')]);await rpc('start_student_activity',[activityId]);
  await login('admin','postgres');
  const points=(await query("select points from student_xp_events where student_id=$1 and source_id=$2 and event_type='learning_activity'",[fixtureUsers.student,activityId])).rows;
  assert.deepEqual(points,[{points:10}]);
  assert.equal((await query('select count(*) n from student_progress where student_id=$1 and lesson_id=$2 and completed_at is not null',[fixtureUsers.student,lessonId])).rows[0].n,1);
  assert.equal((await query('select count(*) n from private.flashcard_review_progress where student_id=$1 and activity_id=$2',[fixtureUsers.student,activityId])).rows[0].n,6);
 });
 await t.test('teacher sees scoped counts without private answers; other teacher cannot traverse the student',async()=>{
  await login('teacher');const detail=await rpc('pedagogy_lesson_detail',[fixtureUsers.student,lessonId,1,20]);const card=detail.items.find(a=>a.id===activityId);
  assert.equal(card.flashcards_total,6);assert.equal(card.flashcards_reviewed,6);assert.equal(card.xp,10);
  for(const secret of ['teacherOnly','answers_json','optionKey'])assert.equal(JSON.stringify(detail).includes(secret),false);
  await login('stranger');await assert.rejects(rpc('pedagogy_lesson_detail',[fixtureUsers.student,lessonId,1,20]),/indisponível/);
 });
 await t.test('non-students, inactive profiles, anonymous and direct private-table access are denied',async()=>{
  for(const user of ['admin','teacher','stranger','inactive','mentoring']){await login(user);await assert.rejects(rpc('student_flashcard_progress',[activityId]));await assert.rejects(review('html'));}
  await login('student');await assert.rejects(query('select * from private.flashcard_review_progress'),/permission denied/);
  await assert.rejects(query("insert into private.flashcard_review_progress values($1,$2,1,'html',now(),now())",[fixtureUsers.student,activityId]),/permission denied/);
  await login('admin','anon');await assert.rejects(review('html'),/permission denied/);
 });
 await t.test('backend rejects the same invalid contracts; failures roll back imports atomically',async()=>{
  await login('admin');
  for(const [name,mutate] of Object.entries(invalid)){const doc=flashcardsDocument();mutate(doc);doc.activities[0].key='bad-'+name.replaceAll(' ','-');
   await assert.rejects(rpc('import_learning_lesson',[lessonId,JSON.stringify(doc),false]),undefined,name);
  }
  const doc=flashcardsDocument();await assert.rejects(rpc('import_learning_lesson',[lessonId,JSON.stringify(doc),false]),/repetidas/);
 });
 await t.test('drafts, inactive decks, prerequisites and planned curriculum remain guarded',async()=>{
  await login('admin','postgres');
  const gated=flashcardsDocument();gated.activities[0].key='gated-cards';gated.activities[0].orderIndex=5;gated.activities[0].prerequisites=['gate-study'];
  gated.activities.unshift({...d.example.activities[0],key:'gate-study',orderIndex:4,prerequisites:[]});
  await login('admin');const gate=await rpc('import_learning_lesson',[lessonId,JSON.stringify(gated),true]);
  await login('other');await assert.rejects(rpc('review_student_flashcard',[gate.activityIds[1],'html']),/pré-requisitos/);
  await login('admin','postgres');
  await query('update lesson_activities set is_active=false where id=$1',[activityId]);await login();await assert.rejects(review('html'),/indisponíveis/);
  await login('admin','postgres');await query('update lesson_activities set is_active=true where id=$1',[activityId]);
  const draft=flashcardsDocument();draft.activities[0].key='draft-flashcards';draft.activities[0].orderIndex=6;
  await login('admin');const imported=await rpc('import_learning_lesson',[lessonId,JSON.stringify(draft),false]);
  await login();await assert.rejects(rpc('student_flashcard_progress',[imported.activityIds[0]]),/indisponíveis/);
  await login('admin','postgres');await query("insert into lessons(id,module_id,submodule_id,title,order_index) values($1,$2,$3,'Cartões planejados de teste',99)",[id(9960),'253477d3-e90d-42b8-88d8-a4a512418cf5','7ba3b0f4-7078-47df-aaa4-a7ee460b3f3e']);
  const planned=flashcardsDocument();planned.lesson.title='Cartões planejados de teste';planned.context={courseTitle:'HTML',moduleTitle:'HTML Básico',submoduleTitle:'As Origens da Tecnologia'};
  await login('admin');const p=await rpc('import_learning_lesson',[id(9960),JSON.stringify(planned),true]);
  await login('other');await assert.rejects(rpc('review_student_flashcard',[p.activityIds[0],'html']),/liberada/);
 });
 await t.test('rollback refuses to erase authored decks or review history',async()=>{
  await login('admin','postgres');await assert.rejects(d.db.exec(readSql('supabase/rollbacks/flashcards_learning_activity.sql')),/Preserve os registros/);await d.db.exec('rollback');
 });
});
test('flashcards rollback before use restores original schema, functions and grants',async t=>{
 const d=await createCurriculumDb();t.after(()=>d.db.close());
 const schema=(await d.query('select document from private.learning_content_schemas where version=2')).rows[0].document;
 const acl=async()=>(await d.query("select proname,proacl::text,prosecdef,proconfig from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='private' and proname in('learning_validate_reward','learning_award_activity','pedagogy_lesson_detail') order by proname")).rows;
 const before=await acl();
 await d.db.exec(readSql(learningMigration('_flashcards_learning_activity.sql')));
 assert.deepEqual((await d.query('select document from private.learning_content_schemas where version=2')).rows[0].document,JSON.parse(readSql('src/contracts/learning-content.v2.schema.json')));
 assert.deepEqual(await acl(),before);
 await d.db.exec(readSql('supabase/rollbacks/flashcards_learning_activity.sql'));
 assert.deepEqual((await d.query('select document from private.learning_content_schemas where version=2')).rows[0].document,schema);
 assert.deepEqual(await acl(),before);
 await d.db.exec(readSql(learningMigration('_flashcards_learning_activity.sql')));
});
