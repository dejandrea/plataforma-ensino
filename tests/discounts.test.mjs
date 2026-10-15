import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync('src/lib/discounts.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { calculateDiscount, calculateStudentTotal, effectiveDiscount, lessonMonth, normalizeHourlyRate } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const rule = (scope, month, value, kind = 'percentage', student = 'a') => ({
  id: `${scope}-${month}`, student_id: student, scope, effective_month: `${month}-01`,
  discount_id: 'catalog', name: 'Test', kind, value,
});
const lesson = (month) => ({ starts_at: `${month}-15T10:00:00-03:00`, ends_at: `${month}-15T11:00:00-03:00` });

test('rounds discounts in cents, caps to subtotal, and supports full scholarships', () => {
  assert.deepEqual(calculateDiscount(99.99, { kind: 'percentage', value: '10' }), { gross: 99.99, discount: 10, net: 89.99 });
  assert.deepEqual(calculateDiscount(25, { kind: 'fixed', value: 40 }), { gross: 25, discount: 25, net: 0 });
  assert.equal(calculateDiscount(80, { kind: 'percentage', value: 100 }).net, 0);
  assert.equal(calculateDiscount(0, { kind: 'fixed', value: 40 }).net, 0);
});

test('monthly override takes precedence, never stacks, and does not leak across students or months', () => {
  const rows = [rule('recurring', '2026-09', 10), rule('monthly', '2026-10', 30), rule('monthly', '2026-10', 95, 'percentage', 'b')];
  assert.equal(effectiveDiscount(rows, 'a', '2026-08'), undefined);
  assert.equal(effectiveDiscount(rows, 'a', '2026-10').value, 30);
  assert.equal(effectiveDiscount(rows, 'a', '2026-11').value, 10);
  const total = calculateStudentTotal('a', [lesson('2026-09'), lesson('2026-10'), lesson('2026-11')], 100, rows);
  assert.equal(total.gross, 300);
  assert.equal(total.discount, 50);
  assert.equal(total.net, 250);
});

test('a new recurring rule preserves earlier months and zero ends the ongoing discount', () => {
  const rows = [rule('recurring', '2026-09', 10), rule('recurring', '2026-11', 20), rule('recurring', '2026-12', 0)];
  assert.equal(effectiveDiscount(rows, 'a', '2026-10').value, 10);
  assert.equal(effectiveDiscount(rows, 'a', '2026-11').value, 20);
  assert.equal(effectiveDiscount(rows, 'a', '2027-01').value, 0);
});

test('fixed amounts apply once per month, rather than once per lesson or once per whole range', () => {
  const total = calculateStudentTotal('a', [lesson('2026-10'), lesson('2026-10'), lesson('2026-11')], 100, [rule('recurring', '2026-10', 25, 'fixed')]);
  assert.equal(total.gross, 300);
  assert.equal(total.discount, 50);
  assert.equal(total.net, 250);
});

test('an explicit zero monthly override suspends recurring only in that month', () => {
  const rows = [rule('recurring', '2026-09', 10), rule('monthly', '2026-10', 0)];
  assert.equal(calculateStudentTotal('a', [lesson('2026-10')], 100, rows).net, 100);
  assert.equal(calculateStudentTotal('a', [lesson('2026-11')], 100, rows).net, 90);
});

test('uses Bahia month at UTC boundaries and keeps unset rates distinct from zero', () => {
  assert.equal(lessonMonth('2026-11-01T01:00:00Z'), '2026-10');
  assert.equal(normalizeHourlyRate(null), null);
  assert.equal(normalizeHourlyRate(''), null);
  assert.equal(normalizeHourlyRate('invalid'), null);
  assert.equal(normalizeHourlyRate('0'), 0);
  assert.equal(normalizeHourlyRate('99.90'), 99.9);
});
