import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const load = async (path) => {
  const output = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
};
const { invoiceStatus, nextBillingMonth, dateLabel, todayInBahia } = await load('src/lib/billing.ts');
const { assertStudentCanBook } = await load('supabase/functions/_shared/billing.ts');

test('only flags automatic restriction after day 15, and distinguishes draft, partial and paid invoices', () => {
  assert.equal(invoiceStatus({ is_draft: true, outstanding: 0, overdue_days: 0 }), 'Em apura\u00e7\u00e3o');
  assert.equal(invoiceStatus({ outstanding: 25, overdue_days: 15 }), 'Em atraso');
  assert.equal(invoiceStatus({ outstanding: 25, overdue_days: 16 }), 'Atraso superior a 15 dias');
  assert.equal(invoiceStatus({ outstanding: 0, overdue_days: 25 }), 'Pago');
  assert.equal(invoiceStatus({ outstanding: 25, overdue_days: 0 }), 'Pendente');
});

test('date helpers preserve calendar month boundaries and Bahia date format', () => {
  assert.equal(nextBillingMonth('2026-12'), '2027-01');
  assert.equal(nextBillingMonth('2026-01'), '2026-02');
  assert.equal(dateLabel('2026-02-28'), '28/02/2026');
  assert.match(todayInBahia(), /^\d{4}-\d{2}-\d{2}$/);
});

test('booking gateway propagates backend restrictions before any calendar side effects', async () => {
  const calls = [];
  const client = { async rpc(name, args) { calls.push({ name, args }); return { error: { message: 'blocked' } }; } };
  await assert.rejects(() => assertStudentCanBook(client, 'student'), /blocked/);
  assert.deepEqual(calls, [{ name: 'assert_student_can_book', args: { p_student_id: 'student' } }]);
  await assert.doesNotReject(() => assertStudentCanBook({ rpc: async () => ({ error: null }) }, 'student'));
});
