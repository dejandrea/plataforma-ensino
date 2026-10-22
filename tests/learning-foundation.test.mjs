import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const sql = file => readFileSync(file, 'utf8');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('foundation migration, real progression, RLS and integrity in isolated PostgreSQL', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(sql('tests/fixtures/learning-baseline.sql'));
  await db.exec(sql('supabase/migrations/20261006034320_course_progression_and_completed_evaluations.sql'));
  const filename = readdirSync('supabase/migrations').find(f => f.endsWith('_learning_environment_foundation.sql'));
  await db.exec(sql(`supabase/migrations/${filename}`));
  const query = (text, params = []) => db.query(text, params);
  const count = async (table, where = '') => Number((await query(`select count(*) n from public.${table} ${where}`)).rows[0].n);
  const asUser = async (role, user = null) => {
    await db.exec('reset role');
    await query("select set_config('request.jwt.claim.sub',$1,false)", [user ?? '']);
    await db.exec(`set role ${role}`);
  };
  const student = id(1), other = id(2), teacher = id(3), stranger = id(4), admin = id(5), inactive = id(6);
  await query(`insert into profiles(id,role,student_service_scope,is_active) values
    ($1,'student','course',true),($2,'student','course',true),($3,'professor',null,true),
    ($4,'professor',null,true),($5,'admin',null,true),($6,'student','course',false)`, [student, other, teacher, stranger, admin, inactive]);
  await query('insert into teacher_student_relations values($1,$2)', [teacher,student]);
  await query('insert into courses values($1,\'HTML\',true)', [id(10)]);
  await query('insert into modules values($1,$3,\'First\',0,true),($2,$3,\'Second\',1,true)', [id(11),id(12),id(10)]);
  await query('insert into submodules values($1,$2,true),($3,$4,true)', [id(13),id(11),id(14),id(12)]);
  await query('insert into lessons values($1,$2),($3,$4)', [id(15),id(13),id(16),id(14)]);
  await query('insert into scheduled_lessons values($1,$2,$3,\'course\',\'scheduled\'),($4,$5,$3,\'course\',\'scheduled\')', [id(17),teacher,student,id(18),stranger]);
  const payload = JSON.parse(sql('docs/examples/html-primeira-pagina.v1.json'));
  const activityIds = payload.activities.map((_,i) => id(30+i));
  await asUser('authenticated', admin);
  await query("insert into lesson_learning_metadata(lesson_id,objectives) values($1,array['Entender HTML'])",[id(15)]);
  for (const [i,a] of payload.activities.entries()) await query(`insert into lesson_activities
    (id,lesson_id,key,title,activity_type,order_index,content_json) values($1,$2,$3,$4,$5,$6,$7)`,
    [activityIds[i],id(15),a.key,a.title,a.type,i,JSON.stringify(a.content)]);
  await query('insert into activity_quiz_keys(activity_id,content_json) values($1,$2)', [activityIds[2],JSON.stringify(payload.teacherOnly.quizKeys[0].content)]);
  await query('insert into teacher_lesson_plans(id,activity_id,revision,content_json) values($1,$2,1,$3)', [id(50),activityIds[3],JSON.stringify(payload.teacherOnly.lessonPlans[0].content)]);
  await query('insert into activity_prerequisites values($1,$2)', [activityIds[4],activityIds[2]]);
  await assert.rejects(query('insert into activity_prerequisites values($1,$2)', [activityIds[2],activityIds[4]]), /circular/);
  await query("update lesson_activities set publication_status='published' where id<>$1", [activityIds[1]]);
  // A published activity in the next module must stay inaccessible by direct ID.
  await query(`insert into lesson_activities(id,lesson_id,key,title,activity_type,order_index,content_json,publication_status)
    values($1,$2,'locked','Locked','slides',0,$3,'published')`, [id(40),id(16),JSON.stringify(payload.activities[0].content)]);
  await asUser('postgres');
  await query(`insert into student_activity_progress(student_id,activity_id,activity_revision) values($1,$2,1),($3,$2,1)`, [student,activityIds[0],other]);
  await query(`insert into quiz_attempts(student_id,activity_id,activity_revision,attempt_number,answers_json,score,passed)
    values($1,$2,1,1,'{"conteudo-visivel":"body"}',100,true)`, [student,activityIds[2]]);
  await query(`insert into project_submissions(id,student_id,activity_id,activity_revision,version,submission_url)
    values($1,$2,$3,1,1,'https://example.org/project')`, [id(60),student,activityIds[4]]);
  await query(`insert into project_submission_reviews(submission_id,reviewed_by,status,teacher_feedback)
    values($1,$2,'needs_revision','Inclua o idioma do documento.')`, [id(60),teacher]);

  await t.test('anonymous has no table or helper access', async () => {
    await asUser('anon');
    await assert.rejects(query('select * from lesson_activities'), /permission denied/);
    await assert.rejects(query('select private.learning_role()'), /permission denied/);
  });
  await t.test('student sees published unlocked content, own records and feedback only', async () => {
    await asUser('authenticated',student);
    assert.equal(await count('lesson_activities'),4);
    assert.equal(await count('lesson_learning_metadata'),1);
    assert.equal(await count('activity_quiz_keys'),0);
    assert.equal(await count('teacher_lesson_plans'),0);
    assert.equal(await count('student_activity_progress'),1);
    assert.equal(await count('quiz_attempts'),1);
    assert.equal(await count('project_submissions'),1);
    assert.equal(await count('project_submission_reviews'),1);
    assert.equal(await count('lesson_plan_sessions'),0);
    const publicRows = (await query('select content_json from lesson_activities')).rows;
    assert.equal(JSON.stringify(publicRows).includes('expectedAnswer'),false);
    await assert.rejects(query("update student_activity_progress set status='completed',completed_at=now()"), /permission denied/);
    await assert.rejects(query("insert into quiz_attempts(student_id) values($1)",[student]), /permission denied/);
    await assert.rejects(query("insert into project_submissions(student_id) values($1)",[student]), /permission denied/);
    await assert.rejects(query("insert into project_submission_reviews(submission_id,reviewed_by,status) values($1,$2,'approved')",[id(60),student]), /permission denied/);
    await assert.rejects(query("update profiles set role='admin' where id=$1",[student]), /Somente administradores/);
    await assert.rejects(query("insert into lesson_activities(lesson_id,key,title,activity_type,order_index,content_json) values($1,'forged','Forged','slides',9,$2)",[id(15),JSON.stringify(payload.activities[0].content)]), /row-level security/);
    assert.equal((await query("update lesson_activities set is_active=false returning id")).rows.length,0);
    assert.equal((await query("delete from lesson_activities returning id")).rows.length,0);
  });
  await t.test('other student and inactive accounts cannot read protected records', async () => {
    await asUser('authenticated',other);
    assert.equal(await count('quiz_attempts'),0);
    assert.equal(await count('project_submission_reviews'),0);
    await asUser('authenticated',inactive);
    assert.equal(await count('lesson_activities'),0);
    assert.equal(await count('student_activity_progress'),0);
    assert.equal(await count('lesson_learning_metadata'),0);
    await assert.rejects(query('update profiles set is_active=true where id=$1',[inactive]), /Somente administradores/);
  });
  await t.test('teacher scope, saved steps, session relationships and private notes', async () => {
    await asUser('authenticated',stranger);
    assert.equal(await count('teacher_lesson_plans'),1);
    assert.equal(await count('activity_quiz_keys'),1);
    assert.equal(await count('quiz_attempts'),0);
    await assert.rejects(query('insert into lesson_plan_sessions(scheduled_lesson_id,plan_id,activity_id,plan_revision) values($1,$2,$3,1)',[id(17),id(50),activityIds[3]]), /row-level security/);
    await asUser('authenticated',teacher);
    assert.equal(await count('quiz_attempts'),1);
    await query('insert into lesson_plan_sessions(id,scheduled_lesson_id,plan_id,activity_id,plan_revision) values($1,$2,$3,$4,1)',[id(70),id(17),id(50),activityIds[3]]);
    await query("update lesson_plan_sessions set completed_step_keys=array['criar-documento'],notes='Retomar semantica' where id=$1",[id(70)]);
    assert.deepEqual((await query('select completed_step_keys from lesson_plan_sessions')).rows[0].completed_step_keys,['criar-documento']);
    await assert.rejects(query("update lesson_plan_sessions set completed_step_keys=array['unknown']"), /Etapas invalidas/);
    await assert.rejects(query('update lesson_plan_sessions set scheduled_lesson_id=$1',[id(18)]), /imutaveis/);
    await asUser('authenticated',student);
    assert.equal(await count('lesson_plan_sessions'),0);
    await assert.rejects(query('insert into lesson_plan_sessions(scheduled_lesson_id,plan_id,activity_id,plan_revision) values($1,$2,$3,1)',[id(17),id(50),activityIds[3]]), /row-level security/);
  });
  await t.test('published content, foreign keys and private JSON cannot be corrupted', async () => {
    await asUser('authenticated',admin);
    assert.equal(await count('student_activity_progress'),2);
    await assert.rejects(query("update lesson_activities set title='Rewrite' where id=$1",[activityIds[0]]), /imutavel/);
    await assert.rejects(query("update activity_quiz_keys set content_json=content_json where activity_id=$1",[activityIds[2]]), /imutavel/);
    await assert.rejects(query('insert into teacher_lesson_plans(activity_id,revision,content_json) values($1,2,$2)',[activityIds[0],JSON.stringify(payload.teacherOnly.lessonPlans[0].content)]), /foreign key/);
    const bad = structuredClone(payload.activities[2].content); bad.questions[0].options[0].isCorrect = false;
    await assert.rejects(query(`insert into lesson_activities(lesson_id,key,title,activity_type,order_index,content_json)
      values($1,'leak','Leak','quiz',9,$2)`,[id(15),JSON.stringify(bad)]), /check constraint/);
    await assert.rejects(query('delete from teacher_lesson_plans'), /permission denied/);
  });
  await t.test('legacy lesson completion still unlocks the next module', async () => {
    await asUser('authenticated',student);
    await query('insert into student_progress values($1,$2,now())',[student,id(15)]);
    assert.equal(await count('lesson_activities',`where id='${id(40)}'`),1);
    assert.equal(await count('student_activity_progress'),1); // No implicit activity completion.
  });
  await t.test('service role can write, other clients cannot forge execution history', async () => {
    await asUser('service_role');
    await query(`insert into project_submissions(student_id,activity_id,activity_revision,version,submission_url)
      values($1,$2,1,2,'https://example.org/revision')`,[student,activityIds[4]]);
    await assert.rejects(query(`insert into project_submissions(student_id,activity_id,activity_revision,version,submission_url)
      values($1,$2,1,3,'javascript:alert(1)')`,[student,activityIds[4]]), /check constraint/);
    await assert.rejects(query("update project_submissions set student_notes='rewrite'"), /Historico imutavel/);
    await assert.rejects(query('delete from quiz_attempts'), /Historico imutavel/);
    await asUser('authenticated',student);
    assert.equal(await count('project_submissions'),2);
    await assert.rejects(query('delete from project_submissions'), /permission denied/);
  });
  await t.test('manual rollback removes only foundation and supports reapplication', async () => {
    await asUser('postgres');
    await db.exec(sql('supabase/rollbacks/learning_environment_foundation.sql'));
    assert.equal((await query("select to_regclass('public.lesson_activities') value")).rows[0].value,null);
    assert.equal(await count('student_progress'),1);
    assert.equal(await count('lessons'),2);
    await db.exec(sql(`supabase/migrations/${filename}`));
    assert.equal(await count('lesson_activities'),0);
  });
});
