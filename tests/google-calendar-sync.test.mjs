import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compile = (path) => ts.transpileModule(readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
globalThis.Deno = { env: { get: () => '' } };
const google = await import(`data:text/javascript;base64,${Buffer.from(compile('supabase/functions/_shared/google-calendar.ts')).toString('base64')}`);

test('fetches every page including minimal cancellation records', async () => {
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(new URL(url));
    return Response.json(urls.length === 1
      ? { items: [{ id: 'active' }], nextPageToken: 'page2' }
      : { items: [{ id: 'deleted', status: 'cancelled' }] });
  };
  const events = await google.getGoogleCalendarEvents({ accessToken: 'token', calendarId: 'cal', timeMin: 'min', timeMax: 'max' });
  assert.equal(events.length, 2);
  assert.equal(urls[1].searchParams.get('pageToken'), 'page2');
  assert.equal(urls[1].searchParams.get('showDeleted'), 'true');
  globalThis.fetch = async () => Response.json({ error: { message: 'denied' } }, { status: 403 });
  await assert.rejects(() => google.getGoogleCalendarEvents({ accessToken: 'token', calendarId: 'cal', timeMin: 'min', timeMax: 'max' }), /denied/);
});

test('only confirmed missing events become cancellations', async () => {
  for (const status of [404, 410]) {
    globalThis.fetch = async () => new Response('', { status });
    assert.equal((await google.getGoogleCalendarEvent({ accessToken: 'token', calendarId: 'cal', eventId: 'deleted', allowMissing: true })).status, 'cancelled');
    await assert.rejects(() => google.getGoogleCalendarEvent({ accessToken: 'token', calendarId: 'cal', eventId: 'deleted' }));
  }
  globalThis.fetch = async () => Response.json({ error: { message: 'denied' } }, { status: 403 });
  await assert.rejects(() => google.getGoogleCalendarEvent({ accessToken: 'token', calendarId: 'cal', eventId: 'deleted', allowMissing: true }), /denied/);
});

test('sync preserves cancelled lesson details and checks absent events before cancelling', async () => {
  let handler;
  const updates = [];
  const checked = [];
  const client = { from(table) {
    let update;
    const query = new Proxy({}, { get(_, key) {
      if (key === 'then') return (resolve) => resolve({ error: null, data:
        table === 'teacher_calendar_settings' ? { is_active: true, event_calendar_ids: ['cal'] }
        : table === 'scheduled_lessons' && !update ? [
          { id: 'minimal', calendar_calendar_id: 'cal', calendar_event_id: 'deleted' },
          { id: 'missing', calendar_calendar_id: 'cal', calendar_event_id: 'missing' },
          { id: 'moved', calendar_calendar_id: 'cal', calendar_event_id: 'moved' },
        ] : [] });
      return (...args) => {
        if (key === 'update') { update = args[0]; if (table === 'scheduled_lessons') updates.push(update); }
        if (key === 'in' && update && table === 'scheduled_lessons') updates.push(args[1]);
        return query;
      };
    } });
    return query;
  } };
  const source = compile('supabase/functions/google-calendar-sync/index.ts').replace(/^import[\s\S]*?from .*?;\s*$/gm, '');
  const run = new Function('serve', 'corsHeaders', 'getAuthenticatedProfile', 'ensureFreshGoogleAccessToken', 'getGoogleCalendarEvents', 'getGoogleCalendarEvent', 'extractMeetLink', source);
  run(fn => { handler = fn; }, {}, async () => ({ adminClient: client, user: { id: 'teacher' }, profile: { role: 'professor' } }),
    async () => ({ accessToken: 'token' }), async () => [{ id: 'deleted', status: 'cancelled' }],
    async ({ eventId }) => { checked.push(eventId); return { status: eventId === 'missing' ? 'cancelled' : 'confirmed' }; }, () => null);
  const response = await handler(new Request('https://local/sync', { method: 'POST', body: '{}' }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).cancelledEvents, 2);
  assert.deepEqual(checked, ['missing', 'moved']);
  assert.deepEqual(updates[1], ['minimal', 'missing']);
  assert.deepEqual(Object.keys(updates[0]).sort(), ['status', 'updated_at']);
});

test('sync skips past lessons without a student and preserves a previously confirmed student', async () => {
  let handler;
  let imported = [];
  const client = { from(table) {
    const query = new Proxy({}, { get(_, key) {
      if (key === 'then') return (resolve) => resolve({ error: null, data:
        table === 'teacher_calendar_settings' ? { is_active: true, event_calendar_ids: ['cal'] }
        : table === 'scheduled_lessons' ? [{ id: 'stored', student_id: 'student', calendar_calendar_id: 'cal', calendar_event_id: 'confirmed' }]
        : [] });
      return (...args) => { if (key === 'upsert') imported = args[0]; return query; };
    } });
    return query;
  } };
  const event = (id, start, end) => ({ id, status: 'confirmed', start: { dateTime: start }, end: { dateTime: end } });
  const events = [
    event('unconfirmed', '2020-01-01T10:00:00Z', '2020-01-01T11:00:00Z'),
    event('confirmed', '2020-01-02T10:00:00Z', '2020-01-02T11:00:00Z'),
    event('future-unconfirmed', '2099-01-01T10:00:00Z', '2099-01-01T11:00:00Z'),
  ];
  const source = compile('supabase/functions/google-calendar-sync/index.ts').replace(/^import[\s\S]*?from .*?;\s*$/gm, '');
  new Function('serve', 'corsHeaders', 'getAuthenticatedProfile', 'ensureFreshGoogleAccessToken', 'getGoogleCalendarEvents', 'getGoogleCalendarEvent', 'extractMeetLink', source)(
    fn => { handler = fn; }, {}, async () => ({ adminClient: client, user: { id: 'teacher' }, profile: { role: 'professor' } }),
    async () => ({ accessToken: 'token' }), async () => events, async () => ({ status: 'confirmed' }), () => 'https://meet.google.com/test',
  );
  const response = await handler(new Request('https://local/sync', { method: 'POST', body: '{}' }));
  assert.equal(response.status, 200);
  assert.equal(imported.length, 2);
  assert.equal(imported.some(row => row.calendar_event_id === 'unconfirmed'), false);
  const confirmed = imported.find(row => row.calendar_event_id === 'confirmed');
  assert.equal(confirmed.student_id, 'student');
  assert.equal(confirmed.status, 'completed');
  assert.equal(imported.find(row => row.calendar_event_id === 'future-unconfirmed').status, 'available');
});
