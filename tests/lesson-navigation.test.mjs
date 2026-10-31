import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(readFileSync('src/lib/lessonNavigation.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.ESNext}}).outputText;
const { nextAvailableLesson } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const modules = [{id:'m1',course_id:'c',order_index:1},{id:'m2',course_id:'c',order_index:2},{id:'other',course_id:'other',order_index:1}];
const subs = [{id:'s1',module_id:'m1',order_index:1},{id:'s2',module_id:'m1',order_index:2},{id:'s3',module_id:'m2',order_index:1},{id:'other',module_id:'other',order_index:1}];
const lesson = (id, submodule_id, order_index, publication_status='published') => ({id,title:id,submodule_id,order_index,publication_status});
test('next lesson follows submodule and module order and stays in the course', () => {
  const lessons = [lesson('d','s3',1),lesson('b','s1',2),lesson('a','s1',1),lesson('c','s2',1),lesson('other','other',2)];
  assert.equal(nextAvailableLesson('a',lessons,subs,modules).id,'b');
  assert.equal(nextAvailableLesson('b',lessons,subs,modules).id,'c');
  assert.equal(nextAvailableLesson('c',lessons,subs,modules).id,'d');
  assert.equal(nextAvailableLesson('d',lessons,subs,modules),null);
});
test('unpublished, inaccessible and unknown lessons never become navigation targets', () => {
  const lessons = [lesson('a','s1',1),lesson('planned','s1',2,'planned'),lesson('orphan','missing',3)];
  assert.equal(nextAvailableLesson('a',lessons,subs,modules),null);
  assert.equal(nextAvailableLesson('missing',lessons,subs,modules),null);
});
