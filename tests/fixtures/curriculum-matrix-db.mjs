import {learningMigration, readSql} from './learning-test-db.mjs';

export async function prepareCurriculumMatrix(d) {
  await d.login('admin', 'postgres');
  // The minimal historical fixture omits these established catalog columns/defaults.
  await d.db.exec(`
    alter table courses add column description text, add column total_hours integer default 0,
      alter column is_active set default true, alter column id set default gen_random_uuid();
    alter table modules add column description text, add column duration_minutes integer,
      alter column is_active set default true, alter column id set default gen_random_uuid();
    alter table submodules add column duration_minutes integer,
      alter column is_active set default true, alter column id set default gen_random_uuid();
    alter table lessons alter column id set default gen_random_uuid();
    alter table module_evaluations add column if not exists teacher_id uuid;
  `);
  await d.db.exec(readSql(learningMigration('_restrict_evaluations_to_active_curriculum.sql')));
  await d.db.exec(readSql(learningMigration('_curriculum_matrix.sql')));
}
