import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('supabase/functions/update-lesson-history-status/index.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace(/^import.*;\s*$/gm, '');

async function run({ role = 'professor', owner = 'teacher', current = 'completed', status = 'cancelled', student = 'student' } = {}) {
  let handler;
  let updates;
  const client = { from: () => {
    const query = {
      select: () => query, eq: () => query,
      update: value => { updates = value; return query; },
      single: async () => ({ data: updates ? { id: 'lesson', ...updates } : { id: 'lesson', teacher_id: owner, student_id: student, status: current } }),
    };
    return query;
  } };
  new Function('serve', 'corsHeaders', 'getAuthenticatedProfile', source)(
    fn => { handler = fn; }, {}, async () => ({ adminClient: client, user: { id: 'teacher' }, profile: { role } }),
  );
  const response = await handler(new Request('https://local', { method: 'POST', body: JSON.stringify({ lessonId: 'lesson', status }) }));
  return { response, updates };
}

test('cancelling clears completion tracking', async () => {
  const { response, updates } = await run();
  assert.equal(response.status, 200);
  assert.equal(updates.status, 'cancelled');
  assert.equal(updates.completed_at, null);
  assert.equal(updates.completed_by, null);
  assert.ok(updates.cancelled_at);
});

test('completing clears cancellation and records operator', async () => {
  const { response, updates } = await run({ current: 'cancelled', status: 'completed' });
  assert.equal(response.status, 200);
  assert.equal(updates.cancelled_at, null);
  assert.equal(updates.completed_by, 'teacher');
  assert.ok(updates.completed_at);
});

test('rejects students, other teachers, invalid statuses and non-history lessons', async () => {
  for (const options of [{ role: 'student' }, { owner: 'other' }, { status: 'available' }, { current: 'scheduled' }, {student:null,status:'completed'}]) {
    const { response, updates } = await run(options);
    assert.equal(response.status, 400);
    assert.equal(updates, undefined);
  }
});

test('admin can correct another teacher history and repeated status does not rewrite dates', async () => {
  assert.equal((await run({ role: 'admin', owner: 'other' })).response.status, 200);
  const { response, updates } = await run({ status: 'completed' });
  assert.equal(response.status, 200);
  assert.equal(updates, undefined);
});
