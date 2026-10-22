import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync('src/lib/xp.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { combineEvaluationXp } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const event = (event_type, source_id, points) => ({ event_type, source_id, points, title: 'Fixture', earned_at: '2026-10-15' });

test('combines only stars from the matching evaluation, keeping order and other rewards', () => {
  const input = [event('evaluation', 'a', 20), event('lesson', 'lesson', 10), event('evaluation', 'b', 20),
    event('evaluation_star', 'b', 80), event('evaluation_star', 'a', 16)];
  const result = combineEvaluationXp(input);
  assert.deepEqual(result.map(row => [row.event_type, row.source_id, row.points]), [
    ['evaluation', 'a', 36], ['lesson', 'lesson', 10], ['evaluation', 'b', 100],
  ]);
  assert.equal(input[0].points, 20);
  assert.equal(result.reduce((sum, row) => sum + row.points, 0), input.reduce((sum, row) => sum + row.points, 0));
});

test('retains evaluation base when no star entry exists', () => {
  assert.equal(combineEvaluationXp([event('evaluation', 'a', 20)])[0].points, 20);
  assert.deepEqual(combineEvaluationXp([]), []);
});
