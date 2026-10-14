import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('supabase/functions/generate-feedback/index.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace(/^import.*;\s*$/gm, '');
const keys = ['technical', 'logic', 'creativity', 'autonomy', 'communication', 'organization', 'engagement', 'patience'];
const scores = Object.fromEntries(keys.map(key => [key, 4]));
const valid = Object.fromEntries([...keys.map(key => [key, 'á'.repeat(80)]), ['general', 'ã'.repeat(300)]]);

async function generate(outputs, input = scores) {
  let handler;
  const requests = [];
  new Function('serve', 'corsHeaders', 'Deno', 'fetch', source)(fn => { handler = fn; }, {}, { env: { get: () => 'test-key' } }, async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return Response.json({ choices: [{ message: { content: JSON.stringify(outputs[Math.min(requests.length - 1, outputs.length - 1)]) } }] });
  });
  const response = await handler(new Request('https://local', { method: 'POST', body: JSON.stringify({ scores: input, teacherComment: 'Observação da professora.' }) }));
  return { status: response.status, data: await response.json(), requests };
}

test('returns full feedback and supplies calculated average and teacher comment', async () => {
  const result = await generate([valid]);
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, valid);
  const input = JSON.parse(result.requests[0].messages[1].content);
  assert.equal(input.averageScore, 8);
  assert.equal(input.averageScale, '0 a 10');
  assert.equal(input.teacherComment, 'Observação da professora.');
});

test('retries short areas and overlong general feedback without truncation', async () => {
  const result = await generate([{ ...valid, technical: 'Curto', general: 'a'.repeat(401) }, valid]);
  assert.equal(result.status, 200);
  assert.equal(result.requests.length, 2);
  assert.match(result.requests[1].messages.at(-1).content, /general: 401/);
  assert.deepEqual(result.data, valid);
});

test('rejects too-short general feedback after three attempts', async () => {
  const result = await generate([{ ...valid, general: 'a'.repeat(249) }]);
  assert.equal(result.status, 500);
  assert.equal(result.requests.length, 3);
});

test('rejects missing and invalid scores before calling AI', async () => {
  for (const input of [{}, { ...scores, technical: 0 }, { ...scores, logic: 5.5 }]) {
    const result = await generate([valid], input);
    assert.equal(result.status, 400);
    assert.equal(result.requests.length, 0);
  }
});
