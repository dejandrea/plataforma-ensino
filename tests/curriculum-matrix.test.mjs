import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv';
import {createPresentationsDb, presentationRpc} from './fixtures/presentations-db.mjs';
import {prepareLessonPackages, kitTools} from './fixtures/lesson-package-db.mjs';
import {prepareCurriculumMatrix} from './fixtures/curriculum-matrix-db.mjs';
import {fixtureUsers, id} from './fixtures/learning-test-db.mjs';
import * as zip from '../public/apresentacoes/zip.js';

const json = name => JSON.parse(readFileSync(name, 'utf8'));
const schema = json('src/contracts/curriculum-matrix.v1.schema.json');
const example = json('src/contracts/examples/curriculum-matrix.v1.json');
const firstLesson = doc => doc.course.modules[0].submodules[0].lessons[0];

test('curriculum matrix contract and transactional RPCs', {timeout: 180000}, async t => {
  const validate = new Ajv().compile(schema);
  assert.equal(validate(example), true);
  const d = await createPresentationsDb();
  t.after(() => d.db.close());
  await prepareLessonPackages(d);
  await prepareCurriculumMatrix(d);
  assert.deepEqual((await d.query('select private.curriculum_matrix_schema() schema')).rows[0].schema, schema);
  const call = (name, args, who = 'admin', role = 'authenticated') => presentationRpc(d, who, name, args, role);
  const preview = (mode, course, doc, who) => call('preview_curriculum_matrix', [mode, course, JSON.stringify(doc)], who);
  const confirm = (mode, course, doc, token, approved = true, who) =>
    call('confirm_curriculum_matrix', [mode, course, JSON.stringify(doc), token, approved], who);
  const exportCourse = course => call('export_curriculum_matrix', [course]);
  const row = async (sql, args) => (await d.query(sql, args)).rows[0];
  let course, module, submodule, lesson;

  await t.test('authorization, validation and a read-only preview', async () => {
    for (const who of ['student', 'teacher', 'inactive']) {
      await assert.rejects(preview('create', null, example, who), /administradores/);
      await assert.rejects(confirm('create', null, example, 'token', true, who), /administradores/);
      await assert.rejects(call('export_curriculum_matrix', [id(25)], who), /administradores/);
    }
    await assert.rejects(call('preview_curriculum_matrix', ['create', null, JSON.stringify(example)], '', 'anon'), /permission denied/);
    await assert.rejects(preview('create', null, {...example, schemaVersion: 2}), /schemaVersion/);
    const invalid = structuredClone(example);
    firstLesson(invalid).durationMinutes = -5;
    await assert.rejects(preview('create', null, invalid), /lessons\[0\].durationMinutes/);
    firstLesson(invalid).durationMinutes = 30;
    firstLesson(invalid).objectives = ['   '];
    await assert.rejects(preview('create', null, invalid), /objectives/);
    firstLesson(invalid).objectives = ['Válido'];
    firstLesson(invalid).orderIndex = 1.25;
    await assert.rejects(preview('create', null, invalid), /orderIndex/);
    const oldCount = await row('select count(*) from courses');
    const plan = await preview('create', null, example);
    assert.deepEqual(plan.counts, {create: 4});
    assert.deepEqual(await row('select count(*) from courses'), oldCount);
    await assert.rejects(confirm('create', null, example, plan.token, false), /Confirme/);
    assert.deepEqual(await row('select count(*) from courses'), oldCount);
  });

  await t.test('create, round trip and duplicate prevention', async () => {
    const doc = structuredClone(example);
    delete firstLesson(doc).objectives;
    delete firstLesson(doc).description;
    const plan = await preview('create', null, doc);
    assert.deepEqual(plan.conflicts, []);
    const receipt = await confirm('create', null, doc, plan.token);
    assert.deepEqual(receipt.counts, {create: 4});
    course = receipt.courseId;
    const exported = await exportCourse(course);
    assert.equal(validate(exported), true, JSON.stringify(validate.errors));
    module = exported.course.modules[0].id;
    submodule = exported.course.modules[0].submodules[0].id;
    lesson = firstLesson(exported).id;
    assert.equal(firstLesson(exported).objectives, null);
    assert.deepEqual(await row('select publication_status from lessons where id=$1', [lesson]), {publication_status: 'planned'});
    assert.equal((await row('select count(*) from lesson_activities where lesson_id=$1', [lesson])).count, 0);
    const repeat = await preview('update', course, exported);
    assert.deepEqual(repeat.counts, {unchanged: 4});
    await confirm('update', course, exported, repeat.token);
    assert.deepEqual(await exportCourse(course), exported);
    const duplicate = await preview('create', null, doc);
    assert.match(duplicate.conflicts[0], /Já existe/);
    await assert.rejects(confirm('create', null, doc, duplicate.token), /conflitos/);
  });

  await t.test('complement missing metadata and export the actual Work ZIP', async () => {
    const doc = await exportCourse(course);
    doc.course.description = 'Preserve a descrição original';
    const lessonData = firstLesson(doc);
    Object.assign(lessonData, {description: 'Descrição importada', objectives: ['Decompor uma tarefa.'], durationMinutes: 60});
    const plan = await preview('complement', course, doc);
    assert.deepEqual(plan.counts, {unchanged: 3, complement: 1});
    await confirm('complement', course, doc, plan.token);
    const kit = await call('create_lesson_package_kit', [lesson, 'https://example.invalid', null]);
    const bytes = await kitTools.exportProductionKit(kit, zip, json('public/apresentacoes/presentation.schema.json'));
    const files = await zip.readZipArchive(bytes, {entries: 20, total: 10e6}, () => ({limit: 10e6}));
    const identity = JSON.parse(new TextDecoder().decode(files.find(file => file.path === 'identidade.json').data));
    assert.deepEqual(identity.context, {courseTitle: example.course.title, moduleTitle: 'Instruções', submoduleTitle: 'Sequências'});
    assert.deepEqual(identity.curriculum, {
      courseId: course, moduleId: module, submoduleId: submodule, courseDescription: example.course.description,
      moduleDescription: 'Organize instruções em uma sequência.', submoduleDescription: 'Compare sequências de instruções.',
    });
    assert.equal(identity.lesson_id, lesson);
    assert.equal(identity.lesson.description, lessonData.description);
    assert.equal(identity.lesson.duration_minutes, 30);
    assert.deepEqual(identity.metadata.objectives, lessonData.objectives);
    assert.deepEqual((await preview('complement', course, doc)).counts, {unchanged: 4});
  });

  await t.test('stale preview, update and added descendants preserve UUIDs', async () => {
    const doc = await exportCourse(course);
    doc.course.modules.push({title: 'Novo módulo', submodules: [{title: 'Novo submódulo', lessons: [{title: 'Nova aula'}]}]});
    firstLesson(doc).description = 'Descrição atualizada';
    firstLesson(doc).objectives = ['Praticar outra habilidade.'];
    const plan = await preview('update', course, doc);
    assert.equal(plan.counts.update, 1);
    assert.equal(plan.counts.create, 3);
    assert.equal(plan.rows.find(item => item.id === lesson).before.description, 'Descrição importada');
    await d.query('update courses set description=$1 where id=$2', ['Mudança concorrente', course]);
    await assert.rejects(confirm('update', course, doc, plan.token), /nova prévia/);
    const fresh = await preview('update', course, doc);
    await confirm('update', course, doc, fresh.token);
    assert.deepEqual((await preview('update', course, doc)).counts, {unchanged: 7});
    const exported = await exportCourse(course);
    assert.equal(firstLesson(exported).id, lesson);
    assert.deepEqual(firstLesson(exported).objectives, firstLesson(doc).objectives);
    const empty = structuredClone(exported);
    empty.course.modules.pop();
    Object.assign(firstLesson(empty), {description: '  ', objectives: [], durationMinutes: null});
    const noChange = await preview('update', course, empty);
    assert.deepEqual(noChange.counts, {unchanged: 7});
    await confirm('update', course, empty, noChange.token);
    assert.deepEqual(await exportCourse(course), exported);
  });

  await t.test('wrong parents, duplicate identifiers and ambiguous exact names', async () => {
    const doc = await exportCourse(course);
    const sibling = doc.course.modules[1].submodules[0];
    sibling.lessons.push({...firstLesson(doc)});
    assert.match((await preview('update', course, doc)).conflicts.join(' '), /hierarquia/);
    assert.match((await preview('update', id(25), doc)).conflicts[0], /hierarquia/);
    sibling.lessons.pop();
    doc.course.modules[0].submodules[0].lessons.push({...firstLesson(doc)});
    assert.match((await preview('update', course, doc)).conflicts.join(' '), /mais de uma vez/);
    doc.course.modules[0].submodules[0].lessons.pop();
    await d.query('insert into lessons(module_id,submodule_id,title,order_index,publication_status) values($1,$2,$3,12,$4)',
      [module, submodule, firstLesson(doc).title, 'planned']);
    delete firstLesson(doc).id;
    assert.equal((await preview('update', course, doc)).rows.find(item => item.id === lesson).match, 'key');
    delete firstLesson(doc).lessonKey;
    assert.match((await preview('update', course, doc)).conflicts.join(' '), /ambíguo/);
  });

  await t.test('existing history and published content cause conflicts and are preserved', async () => {
    const before = await row(`select p.*,m.course_id,s.module_id,l.submodule_id,l.title
      from student_progress p join lessons l on l.id=p.lesson_id
      join submodules s on s.id=l.submodule_id join modules m on m.id=s.module_id limit 1`);
    const protectedLesson = before.lesson_id;
    const protectedBefore = await row('select * from lesson_activities where lesson_id=$1 limit 1', [protectedLesson]);
    const doc = await exportCourse(before.course_id);
    const target = doc.course.modules.find(item => item.id === before.module_id).submodules
      .find(item => item.id === before.submodule_id).lessons.find(item => item.id === protectedLesson);
    target.title += ' editada';
    const blocked = await preview('update', before.course_id, doc);
    assert.match(blocked.conflicts.join(' '), /histórico/);
    await assert.rejects(confirm('update', before.course_id, doc, blocked.token), /conflitos/);
    assert.equal((await row('select title from lessons where id=$1', [protectedLesson])).title, before.title);
    assert.equal((await row('select completed_at from student_progress where student_id=$1 and lesson_id=$2',
      [before.student_id, protectedLesson])).completed_at?.getTime(), before.completed_at?.getTime());
    assert.deepEqual(await row('select * from lesson_activities where lesson_id=$1 limit 1', [protectedLesson]), protectedBefore);
  });

  await t.test('complement 1 module, 8 submodules and 32 synthetic lesson placeholders', async () => {
    const doc = {schemaVersion: 1, course: {title: 'Lógica sintética para homologação', modules: [{
      title: 'Lógica', submodules: Array.from({length: 8}, (_, s) => ({
        title: `Unidade ${s + 1}`, lessons: Array.from({length: 4}, (_, l) => ({title: `Aula ${l + 1}`, durationMinutes: 25})),
      })),
    }]}};
    const initial = await preview('create', null, doc);
    const newCourse = (await confirm('create', null, doc, initial.token)).courseId;
    const filled = await exportCourse(newCourse);
    const ids = filled.course.modules[0].submodules.flatMap(item => item.lessons.map(l => l.id));
    for (const sub of filled.course.modules[0].submodules) {
      for (const l of sub.lessons) {
        l.description = `Descrição de ${sub.title} e ${l.title}.`;
        l.objectives = ['Descrever a sequência de passos.'];
      }
    }
    const plan = await preview('complement', newCourse, filled);
    assert.deepEqual(plan.counts, {complement: 32, unchanged: 10});
    await confirm('complement', newCourse, filled, plan.token);
    assert.deepEqual(await exportCourse(newCourse), filled);
    assert.equal((await row('select count(*) from lesson_learning_metadata where lesson_id=any($1::uuid[])', [ids])).count, 32);
  });

  await t.test('enrollment invalidates a preview that would change progression', async () => {
    const doc = await exportCourse(course);
    doc.course.modules[0].submodules[0].lessons.push({title: 'Outra aula nova'});
    const plan = await preview('complement', course, doc);
    assert.equal(plan.counts.create, 1);
    await d.query('insert into student_courses(student_id,course_id) values($1,$2)', [fixtureUsers.student, course]);
    await assert.rejects(confirm('complement', course, doc, plan.token), /nova prévia/);
    const blocked = await preview('complement', course, doc);
    assert.match(blocked.conflicts.join(' '), /alunos ou progresso/);
  });

  await t.test('drafts and reserved lesson packages invalidate previews and keep their state', async () => {
    const doc = await exportCourse(course);
    firstLesson(doc).description = 'Outra descrição';
    const clean = await preview('update', course, doc);
    const kit = await row('select * from private.lesson_package_kits where lesson_id=$1', [lesson]);
    await d.query(`insert into private.editorial_lessons(lesson_id,course_id,lesson_key,adopted_by)
      values($1,$2,$3,$4)`, [lesson, course, kit.lesson_key, fixtureUsers.admin]);
    await d.query(`insert into private.editorial_drafts(lesson_id,version,document,source_token,status,updated_by)
      values($1,1,'{}','synthetic','draft',$2)`, [lesson, fixtureUsers.admin]);
    await assert.rejects(confirm('update', course, doc, clean.token), /nova prévia/);
    assert.match((await preview('update', course, doc)).conflicts.join(' '), /rascunho editorial/);
    assert.equal((await row('select status from private.editorial_drafts where lesson_id=$1', [lesson])).status, 'draft');
    await d.query('delete from private.editorial_drafts where lesson_id=$1', [lesson]);
    await d.query(`insert into private.lesson_package_operations
      (lesson_id,semantic_hash,raw_hash,manifest,document,source_token,created_by,updated_by)
      values($1,$2,$2,'{}','{}','synthetic',$3,$3)`, [lesson, '0'.repeat(64), fixtureUsers.admin]);
    const reserved = await preview('update', course, doc);
    assert.match(reserved.conflicts.join(' '), /pacote reservado/);
    await assert.rejects(confirm('update', course, doc, reserved.token), /conflitos/);
    assert.equal((await row('select status from private.lesson_package_operations where lesson_id=$1', [lesson])).status, 'preparing');
    assert.notEqual(firstLesson(await exportCourse(course)).description, firstLesson(doc).description);
  });

  await t.test('a late metadata failure rolls back the entire hierarchy', async () => {
    await d.db.exec(`
      create function public.fail_curriculum_metadata() returns trigger language plpgsql as $$
      begin raise exception 'falha sintética de metadados'; end $$;
      create trigger fail_curriculum_metadata before insert on lesson_learning_metadata
      for each row execute function public.fail_curriculum_metadata();
    `);
    const doc = structuredClone(example);
    doc.course.title = 'Curso sintético para testar rollback';
    const plan = await preview('create', null, doc);
    const before = await row('select (select count(*) from courses) courses, (select count(*) from modules) modules, (select count(*) from submodules) submodules, (select count(*) from lessons) lessons');
    await assert.rejects(confirm('create', null, doc, plan.token), /falha sintética/);
    assert.deepEqual(await row('select (select count(*) from courses) courses, (select count(*) from modules) modules, (select count(*) from submodules) submodules, (select count(*) from lessons) lessons'), before);
  });
});
