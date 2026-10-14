import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compile = (file) => ts.transpileModule(readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
}).outputText;
const helpers = await import(`data:text/javascript;base64,${Buffer.from(compile('src/lib/evaluationDraft.ts')).toString('base64')}`);
const feedback = Object.fromEntries([...helpers.evaluationCriteria.map(({ id }) => [id, 'a'.repeat(80)]), ['general', 'g'.repeat(300)]]);

// Exercise the component handlers with deterministic hooks and API responses.
async function form({ failAI = false } = {}) {
  const state = [];
  const effects = [];
  let cursor = 0;
  const inserts = [];
  let aiCalls = 0;
  const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }) };
  const useState = (initial) => {
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
  };
  const useRef = initial => {
    const index = cursor++;
    if (!(index in state)) state[index] = { current: initial };
    return state[index];
  };
  const useEffect = (effect) => { const index = cursor++; if (!(index in state)) { state[index] = true; effects.push(effect); } };
  const supabase = {
    from() {
      let payload;
      const query = { select: () => query, eq: () => query,
        maybeSingle: async () => ({ data: null }),
        insert: value => { inserts.push(value); payload = value; return query; },
        single: async () => ({ data: { id: 'saved', ...payload } }),
      };
      return query;
    },
    rpc: async () => ({ data: [{ reference_month: '2026-09-01' }] }),
    auth: { getUser: async () => ({ data: { user: { id: 'teacher' } } }) },
    functions: { invoke: async () => { aiCalls++; return failAI ? { error: new Error('AI unavailable') } : { data: { ...feedback } }; } },
  };
  const source = compile('src/components/EvaluationForm.tsx').replace(/^import.*;\s*$/gm, '').replace('export const EvaluationForm', 'const EvaluationForm');
  const names = ['React', 'useState', 'useEffect', 'useRef', 'FunctionsHttpError', 'supabase', 'fetchStudentModules', 'formatEvaluationMonth', 'averageOutOfTen', 'characterCount', 'criteria', 'hasCompleteScores', 'isValidFeedback'];
  const Component = new Function(...names, `${source}\nreturn EvaluationForm;`)(React, useState, useEffect, useRef, class extends Error {}, supabase, async () => [], () => 'setembro', helpers.averageOutOfTen, helpers.characterCount, helpers.evaluationCriteria, helpers.hasCompleteScores, helpers.isValidFeedback);
  let tree;
  const render = () => { cursor = 0; tree = Component({ studentId: 'student', referenceMonth: '2026-09-01' }); return tree; };
  function nodes(node = tree) { return node && typeof node === 'object' ? [node, ...node.children.flatMap(nodes)] : []; }
  const find = predicate => nodes().find(predicate);
  const button = label => find(node => node.type === 'button' && node.children.includes(label));
  render(); effects.forEach(effect => effect());
  await new Promise(resolve => setImmediate(resolve)); render();
  for (const { label } of helpers.evaluationCriteria) {
    find(node => node.props['aria-label'] === `${label}: nota 4`).props.onClick(); render();
  }
  return { render, find, button, inserts, aiCalls: () => aiCalls };
}

test('generation does not save; review persists edited texts and locks the saved form', async () => {
  const ui = await form();
  assert.equal(ui.button('Salvar avaliação').props.disabled, true);
  await ui.button('Enviar notas').props.onClick();
  await new Promise(resolve => setImmediate(resolve)); ui.render();
  assert.equal(ui.aiCalls(), 1);
  assert.equal(ui.inserts.length, 0);
  assert.equal(ui.button('Salvar avaliação').props.disabled, false);
  ui.find(node => node.props.id === 'feedback-technical').props.onChange({ target: { value: 'Texto revisado pela professora.' } }); ui.render();
  const general = 'Texto geral revisado. '.repeat(15).trim();
  ui.find(node => node.props.id === 'evaluation-comment').props.onChange({ target: { value: general } }); ui.render();
  await ui.button('Salvar avaliação').props.onClick();
  await new Promise(resolve => setImmediate(resolve)); ui.render();
  assert.equal(ui.inserts.length, 1);
  assert.equal(ui.inserts[0].ai_feedback_json.technical, 'Texto revisado pela professora.');
  assert.equal(ui.inserts[0].ai_feedback_json.general, general);
  assert.equal(ui.inserts[0].teacher_comment, general);
  assert.equal(ui.button('Salvar avaliação'), undefined);
  assert.equal(ui.find(node => node.props.id === 'feedback-technical').props.disabled, true);
});

test('AI failure keeps saving disabled and does not insert', async () => {
  const ui = await form({ failAI: true });
  ui.button('Enviar notas').props.onClick();
  await new Promise(resolve => setImmediate(resolve)); ui.render();
  assert.equal(ui.button('Salvar avaliação').props.disabled, true);
  assert.equal(ui.inserts.length, 0);
});

test('changing notes invalidates the generated review and blank area remains editable', async () => {
  const ui = await form();
  ui.button('Enviar notas').props.onClick();
  await new Promise(resolve => setImmediate(resolve)); ui.render();
  ui.find(node => node.props.id === 'feedback-technical').props.onChange({ target: { value: '' } }); ui.render();
  assert.ok(ui.find(node => node.props.id === 'feedback-technical'));
  assert.equal(ui.button('Salvar avaliação').props.disabled, true);
  ui.find(node => node.props['aria-label'] === 'Proficiência técnica: nota 5').props.onClick(); ui.render();
  assert.equal(ui.button('Salvar avaliação').props.disabled, true);
  assert.equal(ui.button('Enviar notas').props.disabled, false);
});

test('five stars equals ten and reviewed text limits are enforced', () => {
  assert.equal(helpers.averageOutOfTen(Object.fromEntries(helpers.evaluationCriteria.map(({ id }) => [id, 5]))), 10);
  assert.equal(helpers.isValidFeedback({ ...feedback, general: 'a'.repeat(401) }), false);
  assert.equal(helpers.isValidFeedback({ ...feedback, technical: '' }), false);
});
