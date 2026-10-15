import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compile = (path) => ts.transpileModule(readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { parseManualLesson } = await import(`data:text/javascript;base64,${Buffer.from(compile('supabase/functions/_shared/manual-lesson.ts')).toString('base64')}`);
const payload = {
  requestId: '10000000-0000-4000-8000-000000000001',
  studentId: '10000000-0000-4000-8000-000000000002',
  teacherId: '10000000-0000-4000-8000-000000000003',
  title: ' Aula realizada ', sessionTrack: 'mentoring', description: ' Observations ',
  startsAt: '2026-01-10T10:00:00-03:00', endsAt: '2026-01-10T11:00:00-03:00',
};

test('validates historical times and normalizes timezone and text', () => {
  const row = parseManualLesson(payload);
  assert.equal(row.title, 'Aula realizada');
  assert.equal(row.starts_at, '2026-01-10T13:00:00.000Z');
  assert.equal(row.ends_at, '2026-01-10T14:00:00.000Z');
  assert.equal(row.id, payload.requestId);
});

test('rejects missing identities, invalid track, future, zero and reversed durations', () => {
  for (const patch of [
    { studentId: '' }, { teacherId: 'invalid' }, { requestId: '' }, { title: ' ' },
    { sessionTrack: 'other' }, { endsAt: payload.startsAt },
    { endsAt: '2026-01-10T09:00:00-03:00' },
    { startsAt: '2099-01-10T10:00:00-03:00', endsAt: '2099-01-10T11:00:00-03:00' },
    { startsAt: '2026-01-10T10:00' }, { endsAt: '2026-01-12T11:00:00-03:00' },
    { startsAt: '2026-02-30T10:00:00-03:00', endsAt: '2026-02-30T11:00:00-03:00' },
  ]) assert.throws(() => parseManualLesson({ ...payload, ...patch }));
});

const runHandler = (role, { active = true, duplicate = false } = {}) => {
  let handler;
  const inserts = [];
  let authQueries = 0;
  const client = { from(table) {
    let id, insert;
    const query = {
      select() { return query; },
      eq(key, value) { if (key === 'id') id = value; return query; },
      insert(row) { insert = row; inserts.push(row); return query; },
      async single() {
        if (table === 'profiles') {
          authQueries++;
          if (id === 'admin') return { data: { is_active: active }, error: null };
          return { data: { id, role: id === payload.studentId ? 'student' : 'professor' }, error: null };
        }
        if (insert && duplicate) return { data: null, error: { code: '23505' } };
        return { data: { id: payload.requestId, ...(insert || {}) }, error: null };
      },
    };
    return query;
  } };
  const source = compile('supabase/functions/create-manual-lesson/index.ts').replace(/^import .*;\s*$/gm, '');
  new Function('serve', 'corsHeaders', 'getAuthenticatedProfile', 'parseManualLesson', source)(
    (fn) => { handler = fn; }, {}, async () => ({ adminClient: client, user: { id: 'admin' }, profile: { role } }), parseManualLesson,
  );
  return { handler, inserts, get queries() { return authQueries; } };
};
const request = () => new Request('https://local/create', { method: 'POST', body: JSON.stringify(payload) });

test('denies professor/student and inactive admins before any lesson write', async () => {
  for (const role of ['professor', 'student']) {
    const result = runHandler(role);
    assert.equal((await result.handler(request())).status, 403);
    assert.equal(result.inserts.length, 0);
    assert.equal(result.queries, 0);
  }
  const inactive = runHandler('admin', { active: false });
  assert.equal((await inactive.handler(request())).status, 403);
  assert.equal(inactive.inserts.length, 0);
});

test('records completed manual lesson, manager attribution, and no invented attendance', async () => {
  const result = runHandler('admin');
  const response = await result.handler(request());
  assert.equal(response.status, 201);
  const row = result.inserts[0];
  assert.equal(row.status, 'completed');
  assert.equal(row.calendar_provider, 'manual');
  assert.equal(row.created_by, 'admin');
  assert.equal(row.completed_by, 'admin');
  assert.equal(row.completed_at, row.ends_at);
  assert.equal(row.teacher_id, payload.teacherId);
  assert.equal(row.student_id, payload.studentId);
  assert.equal('student_joined_at' in row, false);
  assert.equal('teacher_joined_at' in row, false);
});

test('returns previously saved lesson on duplicate retry without a second generated ID', async () => {
  const result = runHandler('admin', { duplicate: true });
  const response = await result.handler(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).lesson.id, payload.requestId);
});
