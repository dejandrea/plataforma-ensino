import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

export const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const fixtureUsers = { student: id(1), other: id(2), teacher: id(3), stranger: id(4), admin: id(5), inactive: id(6), mentoring: id(7) };
export const readSql = file => readFileSync(file, 'utf8');
export const learningMigration = suffix => `supabase/migrations/${readdirSync('supabase/migrations').find(file => file.endsWith(suffix))}`;

export async function createLearningTestDb({ b1 = false } = {}) {
  const db = new PGlite();
  await db.exec(readSql('tests/fixtures/learning-baseline.sql'));
  await db.exec(`
    alter table profiles add column xp_points integer not null default 0;
    alter table profiles add column level integer not null default 1,add column full_name text,add column nickname text;
    alter table submodules add column title text not null default 'Conteúdo';
    alter table lessons add column title text not null default 'HTML',add column description text,
      add column duration_minutes integer,add column video_url text,add column pdf_url text,add column slides_url text,add column meet_link text;
    alter table scheduled_lessons add column title text not null default 'Encontro HTML',add column starts_at timestamptz default now(),
      add column ends_at timestamptz default now()+interval '1 hour',add column meet_link text;
    create table module_evaluations(id uuid primary key,student_id uuid,created_at timestamptz,
      score_technical integer,score_logic integer,score_creativity integer,score_autonomy integer,
      score_communication integer,score_organization integer,score_engagement integer,score_patience integer);
    alter table student_progress enable row level security;
    create policy student_progress_owner on student_progress for all to authenticated using(student_id=auth.uid()) with check(student_id=auth.uid());
    grant all on all tables in schema public to service_role;
  `);
  await db.exec(readSql('supabase/migrations/20261006034320_course_progression_and_completed_evaluations.sql'));
  await db.exec(readSql('supabase/migrations/20261015203620_add_student_xp_rewards.sql'));
  if (b1) await db.exec(readSql('supabase/migrations/20261015210535_add_gamification_levels_and_masteries.sql'));
  await db.exec(readSql(learningMigration('_learning_environment_foundation.sql')));
  await db.exec(readSql(learningMigration('_student_learning_experience.sql')));
  if (b1) await db.exec(readSql(learningMigration('_interactive_learning_and_rewards.sql')));
  const query = (sql, params = []) => db.query(sql, params);
  const login = async (user = 'student', role = 'authenticated') => {
    await db.exec('reset role');
    await query("select set_config('request.jwt.claim.sub',$1,false)", [fixtureUsers[user] ?? '']);
    await db.exec(`set role ${role}`);
  };
  const rpc = async (name, args = []) => (await query(`select public.${name}(${args.map((_,i) => `$${i+1}`).join(',')}) value`, args)).rows[0].value;
  const count = async (table, where = '', args = []) => Number((await query(`select count(*) n from public.${table} ${where}`,args)).rows[0].n);
  await query(`insert into profiles(id,role,student_service_scope,is_active) values
    ($1,'student','course',true),($2,'student','course',true),($3,'professor',null,true),
    ($4,'professor',null,true),($5,'admin',null,true),($6,'student','course',false),($7,'student','mentoring',true)`,Object.values(fixtureUsers));
  await query('insert into teacher_student_relations values($1,$2)',[fixtureUsers.teacher,fixtureUsers.student]);
  const course = async (courseId,moduleId,submoduleId,lessonId,title) => {
    await query('insert into courses values($1,$2,true)',[id(courseId),title]);
    await query('insert into modules values($1,$2,$3,0,true)',[id(moduleId),id(courseId),title]);
    await query('insert into submodules values($1,$2,true)',[id(submoduleId),id(moduleId)]);
    await query('insert into lessons(id,submodule_id,title,description,duration_minutes) values($1,$2,$3,\'Estude HTML com atividades.\',90)',[id(lessonId),id(submoduleId),title]);
  };
  await course(10,11,13,15,'Minha primeira página HTML');
  await query('update lessons set meet_link=$1 where id=$2',['https://meet.google.com/legacy-main-test',id(15)]);
  await query('insert into modules values($1,$2,\'Segundo módulo\',1,true)',[id(12),id(10)]);
  await query('insert into submodules values($1,$2,true)',[id(14),id(12)]);
  await query('insert into lessons(id,submodule_id,title) values($1,$2,\'Próxima aula\')',[id(16),id(14)]);
  await course(21,22,23,24,'Prática acompanhada');
  await course(25,26,27,28,'Aula antiga');
  await query('insert into lessons(id,submodule_id,title) values($1,$2,\'Somente rascunhos\')',[id(29),id(27)]);
  await course(43,44,45,42,'Conteúdo em revisão');
  const example = JSON.parse(readSql('docs/examples/html-primeira-pagina.v1.json'));
  const addActivity = async (number, lessonNumber, activity, required = activity.required) => {
    await query(`insert into lesson_activities(id,lesson_id,key,title,description,activity_type,order_index,is_required,content_json)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[id(number),id(lessonNumber),`${activity.key}-${number}`,activity.title,activity.description ?? null,activity.type,activity.orderIndex,required,JSON.stringify(activity.content)]);
  };
  await query('insert into lesson_learning_metadata(lesson_id,objectives) values($1,$2)',[id(15),example.lesson.objectives]);
  for (const [index,activity] of example.activities.entries()) await addActivity(30+index,15,activity,!['online_lesson','project'].includes(activity.type) && activity.required);
  await query('insert into activity_quiz_keys(activity_id,content_json) values($1,$2)',[id(32),JSON.stringify(example.teacherOnly.quizKeys[0].content)]);
  await query('insert into teacher_lesson_plans(id,activity_id,revision,content_json) values($1,$2,1,$3)',[id(50),id(33),JSON.stringify(example.teacherOnly.lessonPlans[0].content)]);
  await query('insert into activity_prerequisites values($1,$2)',[id(34),id(32)]);
  await query("update lesson_activities set publication_status='published'");
  await addActivity(35,15,example.activities[0],false); // draft
  await addActivity(36,15,example.activities[0],false); // retired
  await query("update lesson_activities set publication_status='published' where id=$1",[id(36)]);
  await query('update lesson_activities set is_active=false where id=$1',[id(36)]);
  for (const number of [37,38,39]) {
    const limited = structuredClone(example.activities[2]); limited.content.maxAttempts=1;
    await addActivity(number,15,limited,false);
    await query('insert into activity_quiz_keys(activity_id,content_json) values($1,$2)',[id(number),JSON.stringify(example.teacherOnly.quizKeys[0].content)]);
    await query("update lesson_activities set publication_status='published' where id=$1",[id(number)]);
  }
  await addActivity(40,16,example.activities[0]);
  await addActivity(41,42,example.activities[0]);
  await query("update lesson_activities set publication_status='published' where id in ($1,$2)",[id(40),id(41)]);
  await query("update lesson_activities set publication_status='draft' where id=$1",[id(41)]);
  await addActivity(46,29,example.activities[0]);
  await addActivity(80,24,example.activities[4]);
  await addActivity(81,24,example.activities[3]);
  await query('insert into teacher_lesson_plans(id,activity_id,revision,content_json) values($1,$2,1,$3)',[id(51),id(81),JSON.stringify(example.teacherOnly.lessonPlans[0].content)]);
  await query("update lesson_activities set publication_status='published' where id in ($1,$2)",[id(80),id(81)]);
  await query(`insert into scheduled_lessons(id,teacher_id,student_id,session_track,status,title,starts_at,ends_at,meet_link)
    values($1,$2,$3,'course','scheduled','Encontro HTML',now()+interval '15 minutes',now()+interval '1 hour','https://meet.google.com/private-test'),
      ($4,$2,$5,'course','scheduled','Outro aluno',now()+interval '30 minutes',now()+interval '2 hours','https://meet.google.com/other-test')`,
    [id(17),fixtureUsers.teacher,fixtureUsers.student,id(18),fixtureUsers.other]);
  await query(`insert into lesson_plan_sessions(scheduled_lesson_id,plan_id,activity_id,plan_revision,notes,evaluation_json)
    values($1,$2,$3,1,'NOTA PRIVADA DA PROFESSORA','{"comprehension":"needs_support"}'),($4,$2,$3,1,'OUTRO ALUNO','{}')`,[id(17),id(50),id(33),id(18)]);
  await login();
  return { db,query,rpc,count,login,example };
}
