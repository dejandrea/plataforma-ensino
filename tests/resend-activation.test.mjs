import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('supabase/functions/create-platform-user/index.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace(/^import.*;\s*$/gm, '');

async function resend({ role = 'admin', confirmed = false, sendError = null, body = {} } = {}) {
  const calls = [];
  const client = {
    from() { throw new Error('Resending must not modify profile or commercial settings'); },
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: { email: 'student@example.com', email_confirmed_at: confirmed ? 'date' : null } } }),
        inviteUserByEmail: async (...args) => { calls.push(['invite', ...args]); return { error: sendError }; },
      },
      resetPasswordForEmail: async (...args) => { calls.push(['recovery', ...args]); return { error: sendError }; },
    },
  };
  let handler;
  new Function('serve', 'corsHeaders', 'getAuthenticatedProfile', source)(
    fn => { handler = fn; }, {}, async () => ({ adminClient: client, profile: { role } }),
  );
  const response = await handler(new Request('https://local', {
    method: 'POST', body: JSON.stringify({ action: 'resend_activation', userId: 'student', redirectTo: 'https://app/redefinir-senha', ...body }),
  }));
  return { response, calls, data: await response.json() };
}

test('resends invitation without changing existing user settings', async () => {
  const { response, calls } = await resend();
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [['invite', 'student@example.com', { redirectTo: 'https://app/redefinir-senha' }]]);
});

test('confirmed users receive a password link', async () => {
  const { response, calls } = await resend({ confirmed: true });
  assert.equal(response.status, 200);
  assert.equal(calls[0][0], 'recovery');
});

test('rejects non-admins and invalid targets without sending', async () => {
  for (const options of [{ role: 'student' }, { body: { userId: null } }, { body: { redirectTo: '' } }]) {
    const { response, calls } = await resend(options);
    assert.equal(response.status, 400);
    assert.equal(calls.length, 0);
  }
});

test('reports email service errors', async () => {
  const { response, data } = await resend({ sendError: { message: 'Email rate limit exceeded' } });
  assert.equal(response.status, 400);
  assert.equal(data.error, 'Email rate limit exceeded');
});
