import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Compile the real runtime validator without depending on a frontend bundler.
const require = createRequire(import.meta.url);
const source = readFileSync('src/lib/learningContent.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const module = { exports: {} };
const localRequire = name => name.endsWith('.json') ? JSON.parse(readFileSync(`src/contracts/${name.split('/').at(-1)}`, 'utf8')) : require(name);
new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
const { validateLessonImport, toStudentLesson } = module.exports;
const example = () => JSON.parse(readFileSync('docs/examples/html-primeira-pagina.v1.json', 'utf8'));

test('both HTML authoring examples validate without mutation', () => {
  for (const file of ['html-conhecendo', 'html-primeira-pagina']) {
    const input = JSON.parse(readFileSync(`docs/examples/${file}.v1.json`, 'utf8'));
    const before = structuredClone(input);
    assert.equal(validateLessonImport(input).valid, true);
    assert.deepEqual(input, before);
  }
});

test('student projection removes teacher plans, keys and expected answers', () => {
  const input = example();
  const output = toStudentLesson(input);
  const json = JSON.stringify(output);
  for (const field of ['teacherOnly', 'expectedAnswer', 'optionKey', 'guidance']) assert.equal(json.includes(`"${field}"`), false);
  output.activities[0].title = 'Changed';
  assert.notEqual(output.activities[0].title, input.activities[0].title);
});

const invalidCases = {
  'unsupported version': d => { d.schemaVersion = 2; },
  'missing field': d => { delete d.lesson.objectives; },
  'unknown field': d => { d.activities[0].content.correctAnswer = 'secret'; },
  'secret inside a question': d => { d.activities[2].content.questions[0].correctOption = 'body'; },
  'secret inside an option': d => { d.activities[2].content.questions[0].options[0].correct = false; },
  'unsafe resource URL': d => { d.activities[0].content.resourceUrl = 'javascript:alert(1)'; },
  'inconsistent type': d => { d.activities[0].type = 'quiz'; },
  'invalid passing score': d => { d.activities[2].content.passingScore = 101; },
  'fractional attempts': d => { d.activities[2].content.maxAttempts = 1.5; },
  'no attempts': d => { d.activities[2].content.maxAttempts = 0; },
  'duplicate activity keys': d => { d.activities[1].key = d.activities[0].key; },
  'duplicate positions': d => { d.activities[1].orderIndex = 0; },
  'missing prerequisite': d => { d.activities[0].prerequisites = ['missing']; },
  'self prerequisite': d => { d.activities[0].prerequisites = [d.activities[0].key]; },
  'cyclic prerequisites': d => { d.activities[0].prerequisites = [d.activities[4].key]; d.activities[2].prerequisites = [d.activities[0].key]; },
  'duplicate questions': d => { d.activities[2].content.questions.push(structuredClone(d.activities[2].content.questions[0])); },
  'duplicate options': d => { d.activities[2].content.questions[0].options[1].key = 'head'; },
  'missing key': d => { d.teacherOnly.quizKeys = []; },
  'incomplete key': d => { d.activities[2].content.questions.push({ key: 'second', prompt: 'Another?', options: [{ key: 'a', text: 'A' }, { key: 'b', text: 'B' }] }); },
  'invalid answer': d => { d.teacherOnly.quizKeys[0].content.answers[0].optionKey = 'unknown'; },
  'duplicate key': d => { d.teacherOnly.quizKeys.push(structuredClone(d.teacherOnly.quizKeys[0])); },
  'plan attached to wrong type': d => { d.teacherOnly.lessonPlans[0].activityKey = 'pagina-pessoal'; },
  'missing plan': d => { d.teacherOnly.lessonPlans = []; },
  'duplicate plan steps': d => { const steps = d.teacherOnly.lessonPlans[0].content.steps; steps[1].key = steps[0].key; },
};
for (const [name, mutate] of Object.entries(invalidCases)) test(`rejects ${name}`, () => {
  const input = example(); mutate(input);
  const result = validateLessonImport(input);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
  assert.throws(() => toStudentLesson(input));
});
