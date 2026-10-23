import {createLearningTestDb,learningMigration,readSql} from './learning-test-db.mjs';
export async function createImprovementsDb() {
 const d=await createLearningTestDb({b1:true});
 await d.login('admin','postgres');
 await d.db.exec(`alter table profiles add column github_url text,add column linkedin_url text,add column instagram_url text;
 alter table scheduled_lessons add column recurrence_index integer,add column started_at timestamptz,add column student_joined_at timestamptz,add column teacher_joined_at timestamptz,add column updated_at timestamptz;
 create table auth.sessions(id uuid primary key,user_id uuid not null,created_at timestamptz,updated_at timestamptz);
 create schema cron;
 create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to anon,authenticated;
 grant select,insert on storage.objects to anon,authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[:array_length(string_to_array($1,'/'),1)-1] $$;
 create table cron.jobs(name text primary key,schedule text,command text);
 create function cron.schedule(text,text,text) returns bigint language plpgsql as $$begin insert into cron.jobs values($1,$2,$3) on conflict(name) do update set schedule=excluded.schedule,command=excluded.command;return 1;end$$;`);
 for(const suffix of ['_teacher_learning_workspace.sql','_official_xp_rules_v1.sql','_improvements_scheduling.sql','_improvements_content_catalogs.sql','_improvements_official_achievements.sql','_catalog_icon_images.sql','_project_review_history_and_criteria.sql']) await d.db.exec(readSql(learningMigration(suffix)));
 return d;
}
