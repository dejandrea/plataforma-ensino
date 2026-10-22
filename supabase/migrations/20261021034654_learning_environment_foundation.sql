-- Etapa A only. No seed data, no changes to legacy curriculum completion.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

-- Trusted profile lookups: avoid profile RLS recursion, never trust user_metadata.
create function private.learning_role() returns text
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active;
$$;
create function private.learning_manages_student(p_student_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles s where s.id=p_student_id and s.role='student' and s.is_active
    and (private.learning_role()='admin' or (private.learning_role()='professor' and exists (
      select 1 from public.teacher_student_relations r where r.teacher_id=auth.uid() and r.student_id=s.id))));
$$;
revoke all on function private.learning_role(), private.learning_manages_student(uuid) from public, anon;
grant execute on function private.learning_role(), private.learning_manages_student(uuid) to authenticated;

-- Existing owner UPDATE policy must not allow self-promotion or self-reactivation.
create function private.learning_guard_profile_access() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('authenticated','anon') and private.learning_role() is distinct from 'admin'
    and (new.role, new.is_active, new.student_service_scope) is distinct from
        (old.role, old.is_active, old.student_service_scope) then
    raise exception 'Somente administradores podem alterar permissoes do perfil.' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function private.learning_guard_profile_access() from public, anon, authenticated;
create trigger learning_guard_profile_access before update on public.profiles
for each row execute function private.learning_guard_profile_access();

-- Whitelist the public JSON surface, especially quiz questions/options. A typed
-- importer performs full JSON Schema + cross-reference validation before saving.
create function private.learning_public_content_valid(kind text, content jsonb) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare allowed text[]; question jsonb; option_item jsonb;
begin
  if jsonb_typeof(content) is distinct from 'object' or content->'schemaVersion' is distinct from '1'::jsonb
    or content->>'type' is distinct from kind then return false; end if;
  allowed := case kind
    when 'slides' then array['schemaVersion','type','resourceUrl','format','altText']
    when 'mindmap' then array['schemaVersion','type','resourceUrl','format','altText']
    when 'quiz' then array['schemaVersion','type','passingScore','maxAttempts','questions']
    when 'online_lesson' then array['schemaVersion','type','objective','preparation']
    when 'project' then array['schemaVersion','type','instructions','objectives','requirements','assessmentCriteria','resources']
    else null end;
  if allowed is null or not (content ?& allowed) or content - allowed <> '{}'::jsonb then return false; end if;
  if kind='quiz' then
    if jsonb_typeof(content->'passingScore') <> 'number' or jsonb_typeof(content->'maxAttempts') <> 'number'
      or (content->>'passingScore')::numeric not between 0 and 100
      or (content->>'maxAttempts')::numeric not between 1 and 100
      or (content->>'passingScore')::numeric <> trunc((content->>'passingScore')::numeric)
      or (content->>'maxAttempts')::numeric <> trunc((content->>'maxAttempts')::numeric)
      or jsonb_typeof(content->'questions') <> 'array' then return false; end if;
    if jsonb_array_length(content->'questions') not between 1 and 100 then return false; end if;
    for question in select value from jsonb_array_elements(content->'questions') loop
      if jsonb_typeof(question) <> 'object' or not(question ?& array['key','prompt','options'])
        or question - array['key','prompt','options'] <> '{}'::jsonb
        or jsonb_typeof(question->'key') <> 'string' or jsonb_typeof(question->'prompt') <> 'string'
        or jsonb_typeof(question->'options') <> 'array' then return false; end if;
      if jsonb_array_length(question->'options') not between 2 and 12 then return false; end if;
      for option_item in select value from jsonb_array_elements(question->'options') loop
        if jsonb_typeof(option_item) <> 'object' or not(option_item ?& array['key','text'])
          or option_item - array['key','text'] <> '{}'::jsonb
          or jsonb_typeof(option_item->'key') <> 'string' or jsonb_typeof(option_item->'text') <> 'string'
          then return false; end if;
      end loop;
    end loop;
  end if;
  return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end;
$$;
revoke all on function private.learning_public_content_valid(text,jsonb) from public, anon;
grant execute on function private.learning_public_content_valid(text,jsonb) to authenticated,service_role;

create table public.lesson_activities (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete restrict,
  key text not null check(key ~ '^[a-z][a-z0-9-]{0,63}$'),
  title text not null check(length(btrim(title))>0), description text,
  activity_type text not null check(activity_type in ('slides','mindmap','quiz','online_lesson','project')),
  order_index integer not null check(order_index>=0),
  duration_minutes integer check(duration_minutes between 1 and 1440),
  is_required boolean not null default true, is_active boolean not null default true,
  publication_status text not null default 'draft' check(publication_status in ('draft','published')),
  revision integer not null default 1 check(revision>0),
  content_json jsonb not null check(private.learning_public_content_valid(activity_type,content_json)),
  published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(lesson_id,key), unique(id,activity_type), unique(id,revision)
);
create table public.lesson_learning_metadata (
  lesson_id uuid primary key references public.lessons(id) on delete restrict,
  schema_version integer not null default 1 check(schema_version=1),
  objectives text[] not null check(cardinality(objectives)>0),
  updated_at timestamptz not null default now()
);
create index lesson_activities_order on public.lesson_activities(lesson_id,order_index,id);
create table public.activity_prerequisites (
  activity_id uuid not null references public.lesson_activities(id) on delete cascade,
  prerequisite_activity_id uuid not null references public.lesson_activities(id) on delete restrict,
  primary key(activity_id,prerequisite_activity_id), check(activity_id<>prerequisite_activity_id)
);
create index activity_prerequisites_reverse on public.activity_prerequisites(prerequisite_activity_id);
create table public.activity_quiz_keys (
  activity_id uuid primary key, activity_type text not null default 'quiz' check(activity_type='quiz'),
  content_json jsonb not null check(coalesce(jsonb_typeof(content_json)='object' and content_json->'schemaVersion'='1'::jsonb
    and jsonb_typeof(content_json->'answers')='array',false)),
  updated_at timestamptz not null default now(),
  foreign key(activity_id,activity_type) references public.lesson_activities(id,activity_type) on delete cascade
);
create table public.teacher_lesson_plans (
  id uuid primary key default gen_random_uuid(), activity_id uuid not null,
  activity_type text not null default 'online_lesson' check(activity_type='online_lesson'),
  revision integer not null check(revision>0),
  content_json jsonb not null check(coalesce(jsonb_typeof(content_json)='object' and content_json->'schemaVersion'='1'::jsonb
    and jsonb_typeof(content_json->'steps')='array',false)),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(activity_id,revision), unique(id,activity_id,revision),
  foreign key(activity_id,activity_type) references public.lesson_activities(id,activity_type) on delete restrict
);
create table public.student_activity_progress (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete restrict,
  activity_id uuid not null, activity_revision integer not null,
  status text not null default 'not_started' check(status in ('not_started','in_progress','pending_review','completed','needs_revision')),
  started_at timestamptz, completed_at timestamptz, updated_at timestamptz not null default now(),
  unique(student_id,activity_id),
  check((status='completed')=(completed_at is not null)),
  check(completed_at is null or (started_at is not null and completed_at>=started_at)),
  foreign key(activity_id,activity_revision) references public.lesson_activities(id,revision) on delete restrict
);
create index student_activity_progress_activity on public.student_activity_progress(activity_id,student_id);
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete restrict,
  activity_id uuid not null, activity_type text not null default 'quiz' check(activity_type='quiz'),
  activity_revision integer not null, attempt_number integer not null check(attempt_number>0),
  answers_json jsonb not null check(jsonb_typeof(answers_json)='object'),
  score numeric(5,2) not null check(score between 0 and 100), passed boolean not null,
  submitted_at timestamptz not null default now(), unique(student_id,activity_id,attempt_number),
  foreign key(activity_id,activity_type) references public.lesson_activities(id,activity_type) on delete restrict,
  foreign key(activity_id,activity_revision) references public.lesson_activities(id,revision) on delete restrict
);
create index quiz_attempts_activity on public.quiz_attempts(activity_id,student_id);
create table public.project_submissions (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete restrict,
  activity_id uuid not null, activity_type text not null default 'project' check(activity_type='project'),
  activity_revision integer not null, version integer not null check(version>0),
  submission_url text not null check(submission_url ~ '^https://[^[:space:]]+$' and length(submission_url)<=2048),
  student_notes text not null default '', submitted_at timestamptz not null default now(),
  unique(student_id,activity_id,version),
  foreign key(activity_id,activity_type) references public.lesson_activities(id,activity_type) on delete restrict,
  foreign key(activity_id,activity_revision) references public.lesson_activities(id,revision) on delete restrict
);
create index project_submissions_activity on public.project_submissions(activity_id,student_id);
-- New corrections are new rows. Students see only feedback deliberately saved here.
create table public.project_submission_reviews (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.project_submissions(id) on delete restrict,
  reviewed_by uuid not null references public.profiles(id) on delete restrict,
  status text not null check(status in ('in_review','needs_revision','approved')),
  teacher_feedback text not null default '', evaluation_json jsonb not null default '{}' check(jsonb_typeof(evaluation_json)='object'),
  created_at timestamptz not null default now()
);
create index project_reviews_history on public.project_submission_reviews(submission_id,created_at,id);
create index project_reviews_reviewer on public.project_submission_reviews(reviewed_by);
create table public.lesson_plan_sessions (
  id uuid primary key default gen_random_uuid(),
  scheduled_lesson_id uuid not null references public.scheduled_lessons(id) on delete restrict,
  plan_id uuid not null, activity_id uuid not null,
  activity_type text not null default 'online_lesson' check(activity_type='online_lesson'), plan_revision integer not null,
  completed_step_keys text[] not null default '{}', notes text not null default '',
  evaluation_json jsonb not null default '{}' check(jsonb_typeof(evaluation_json)='object'),
  updated_at timestamptz not null default now(), unique(scheduled_lesson_id,activity_id),
  foreign key(plan_id,activity_id,plan_revision) references public.teacher_lesson_plans(id,activity_id,revision) on delete restrict,
  foreign key(activity_id,activity_type) references public.lesson_activities(id,activity_type) on delete restrict
);
create index lesson_plan_sessions_plan on public.lesson_plan_sessions(plan_id,activity_id,plan_revision);
create index lesson_plan_sessions_activity on public.lesson_plan_sessions(activity_id);

create function private.learning_can_read_activity(p_activity_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.learning_role() in ('admin','professor') then return true; end if;
  if private.learning_role() is distinct from 'student' then return false; end if;
  return exists(select 1 from public.lesson_activities a
    join public.lessons l on l.id=a.lesson_id
    join public.submodules s on s.id=l.submodule_id and s.is_active
    join public.student_curriculum_status(auth.uid()) m on m.id=s.module_id and m.is_unlocked
    where a.id=p_activity_id and a.is_active and a.publication_status='published');
end;
$$;
revoke all on function private.learning_can_read_activity(uuid) from public,anon;
grant execute on function private.learning_can_read_activity(uuid) to authenticated;

-- A published activity's pedagogical identity/content cannot be rewritten. Create
-- a new key/revision for changed content; existing execution keeps its exact source.
create function private.learning_guard_activity() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare answers jsonb;
begin
  if tg_op='UPDATE' then
    if old.published_at is not null and
      (to_jsonb(new)-array['updated_at','is_active','publication_status']) is distinct from
      (to_jsonb(old)-array['updated_at','is_active','publication_status']) then
      raise exception 'Atividade publicada e imutavel; crie uma nova revisao.' using errcode='23514';
    end if;
    new.published_at := old.published_at;
  end if;
  if new.publication_status='published' then
    if new.activity_type='quiz' then
      select content_json->'answers' into answers from public.activity_quiz_keys where activity_id=new.id;
      if answers is null or jsonb_typeof(answers)<>'array' then
        raise exception 'Publicacao exige gabarito valido.' using errcode='23514';
      end if;
      if jsonb_array_length(answers)<>jsonb_array_length(new.content_json->'questions')
        or (select count(distinct a->>'questionKey') from jsonb_array_elements(answers) a)<>jsonb_array_length(answers)
        or exists(select 1 from jsonb_array_elements(answers) a where not exists (
          select 1 from jsonb_array_elements(new.content_json->'questions') q,
            jsonb_array_elements(q->'options') o where q->>'key'=a->>'questionKey' and o->>'key'=a->>'optionKey')) then
        raise exception 'Publicacao exige gabarito completo e consistente.' using errcode='23514';
      end if;
    end if;
    if new.activity_type='online_lesson' and not exists(select 1 from public.teacher_lesson_plans where activity_id=new.id) then
      raise exception 'Publicacao exige plano pedagogico.' using errcode='23514';
    end if;
    new.published_at := coalesce(new.published_at,now());
  end if;
  new.updated_at := now(); return new;
end;
$$;
revoke all on function private.learning_guard_activity() from public,anon,authenticated;
create trigger learning_guard_activity before insert or update on public.lesson_activities
for each row execute function private.learning_guard_activity();

create function private.learning_touch_progress() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
revoke all on function private.learning_touch_progress() from public,anon,authenticated;
create trigger learning_touch_progress before update on public.student_activity_progress
for each row execute function private.learning_touch_progress();
create trigger learning_touch_metadata before update on public.lesson_learning_metadata
for each row execute function private.learning_touch_progress();

create function private.learning_guard_session() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op='UPDATE' and (new.scheduled_lesson_id,new.plan_id,new.activity_id,new.plan_revision) is distinct from
    (old.scheduled_lesson_id,old.plan_id,old.activity_id,old.plan_revision) then
    raise exception 'Os vinculos da sessao sao imutaveis.' using errcode='23514';
  end if;
  if exists(select 1 from unnest(new.completed_step_keys) k where not exists (
    select 1 from public.teacher_lesson_plans p, jsonb_array_elements(p.content_json->'steps') s
    where p.id=new.plan_id and s->>'key'=k)) or
    cardinality(new.completed_step_keys)<>(select count(distinct k) from unnest(new.completed_step_keys) k) then
    raise exception 'Etapas invalidas para este plano.' using errcode='23514';
  end if;
  new.updated_at := now(); return new;
end;
$$;
revoke all on function private.learning_guard_session() from public,anon,authenticated;
create trigger learning_guard_session before insert or update on public.lesson_plan_sessions
for each row execute function private.learning_guard_session();

-- Published prerequisite graphs are fixed, scoped to one lesson and acyclic.
create function private.learning_guard_prerequisite() returns trigger
language plpgsql security definer set search_path = '' as $$
declare source_id uuid;
begin
  source_id := case when tg_op='DELETE' then old.activity_id else new.activity_id end;
  -- Serialize edits to avoid concurrent cycle creation.
  perform pg_advisory_xact_lock(hashtextextended('bitaria-learning-prerequisites',0));
  if exists(select 1 from public.lesson_activities where id=source_id and published_at is not null) then
    raise exception 'Pre-requisitos publicados sao imutaveis.' using errcode='23514';
  end if;
  if tg_op='DELETE' then return old; end if;
  if tg_op='UPDATE' then raise exception 'Remova e recrie o pre-requisito.' using errcode='23514'; end if;
  if not exists(select 1 from public.lesson_activities a join public.lesson_activities b on a.lesson_id=b.lesson_id
      where a.id=new.activity_id and b.id=new.prerequisite_activity_id) or exists (
    with recursive deps(id) as (
      select new.prerequisite_activity_id union
      select p.prerequisite_activity_id from public.activity_prerequisites p join deps d on p.activity_id=d.id
    ) select 1 from deps where id=new.activity_id) then
    raise exception 'Pre-requisito invalido ou circular.' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function private.learning_guard_prerequisite() from public,anon,authenticated;
create trigger learning_guard_prerequisite before insert or update or delete on public.activity_prerequisites
for each row execute function private.learning_guard_prerequisite();

-- Prevent edits to keys once their public questions have been published.
create function private.learning_guard_quiz_key() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.lesson_activities where id=old.activity_id and published_at is not null) then
    raise exception 'Gabarito publicado e imutavel.' using errcode='23514';
  end if;
  if tg_op='DELETE' then return old; end if;
  new.updated_at := now(); return new;
end;
$$;
revoke all on function private.learning_guard_quiz_key() from public,anon,authenticated;
create trigger learning_guard_quiz_key before update or delete on public.activity_quiz_keys
for each row execute function private.learning_guard_quiz_key();

create function private.learning_reject_history_change() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Historico imutavel; grave uma nova versao.' using errcode='23514';
end;
$$;
revoke all on function private.learning_reject_history_change() from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['quiz_attempts','project_submissions','project_submission_reviews','teacher_lesson_plans'] loop
    execute format('create trigger learning_immutable_history before update or delete on public.%I
      for each row execute function private.learning_reject_history_change()',t);
  end loop;
end $$;

-- Explicit grants + RLS. Service role is backend-only. Learner execution writes
-- remain closed until authenticated, transactional submission RPCs exist in B/D.
do $$ declare t text; begin
  foreach t in array array['lesson_activities','lesson_learning_metadata','activity_prerequisites','activity_quiz_keys','teacher_lesson_plans',
    'student_activity_progress','quiz_attempts','project_submissions','project_submission_reviews','lesson_plan_sessions'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
grant insert,update,delete on public.lesson_activities,public.activity_prerequisites,public.activity_quiz_keys to authenticated;
grant insert,update,delete on public.lesson_learning_metadata to authenticated;
grant insert on public.teacher_lesson_plans to authenticated;
grant insert,update on public.lesson_plan_sessions to authenticated;

create policy learning_activities_read on public.lesson_activities for select to authenticated
using(private.learning_can_read_activity(id));
create policy learning_activities_admin on public.lesson_activities for all to authenticated
using(private.learning_role()='admin') with check(private.learning_role()='admin');
create policy learning_metadata_read on public.lesson_learning_metadata for select to authenticated
using(private.learning_role() in ('admin','professor') or exists (
  select 1 from public.lesson_activities a where a.lesson_id=lesson_learning_metadata.lesson_id
    and private.learning_can_read_activity(a.id)));
create policy learning_metadata_admin on public.lesson_learning_metadata for all to authenticated
using(private.learning_role()='admin') with check(private.learning_role()='admin');
create policy learning_prerequisites_read on public.activity_prerequisites for select to authenticated
using(private.learning_can_read_activity(activity_id) and private.learning_can_read_activity(prerequisite_activity_id));
create policy learning_prerequisites_admin on public.activity_prerequisites for all to authenticated
using(private.learning_role()='admin') with check(private.learning_role()='admin');
create policy learning_keys_staff_read on public.activity_quiz_keys for select to authenticated
using(private.learning_role() in ('admin','professor'));
create policy learning_keys_admin on public.activity_quiz_keys for all to authenticated
using(private.learning_role()='admin') with check(private.learning_role()='admin');
create policy learning_plans_staff_read on public.teacher_lesson_plans for select to authenticated
using(private.learning_role() in ('admin','professor'));
create policy learning_plans_admin_insert on public.teacher_lesson_plans for insert to authenticated
with check(private.learning_role()='admin');

do $$ declare t text; begin
  foreach t in array array['student_activity_progress','quiz_attempts','project_submissions'] loop
    execute format('create policy learning_execution_read on public.%I for select to authenticated using (
      (private.learning_role()=''student'' and student_id=(select auth.uid()))
      or private.learning_manages_student(student_id))',t);
  end loop;
end $$;
create policy learning_reviews_read on public.project_submission_reviews for select to authenticated
using(exists(select 1 from public.project_submissions s where s.id=submission_id));

create function private.learning_can_manage_session(p_scheduled_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.scheduled_lessons s
    where s.id=p_scheduled_id and s.session_track='course' and s.student_id is not null
    and private.learning_manages_student(s.student_id)
    and (private.learning_role()='admin' or s.teacher_id=auth.uid()));
$$;
revoke all on function private.learning_can_manage_session(uuid) from public,anon;
grant execute on function private.learning_can_manage_session(uuid) to authenticated;
create policy learning_sessions_read on public.lesson_plan_sessions for select to authenticated
using(private.learning_can_manage_session(scheduled_lesson_id));
create policy learning_sessions_insert on public.lesson_plan_sessions for insert to authenticated
with check(private.learning_can_manage_session(scheduled_lesson_id));
create policy learning_sessions_update on public.lesson_plan_sessions for update to authenticated
using(private.learning_can_manage_session(scheduled_lesson_id))
with check(private.learning_can_manage_session(scheduled_lesson_id));
commit;
