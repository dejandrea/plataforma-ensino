-- Isolated structural fixture: early base tables are absent from repository history.
-- No production UUIDs/data. Apply the real 20261006 progression migration on top.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
grant usage on schema auth to anon,authenticated,service_role;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
create table public.profiles(id uuid primary key,role text not null,is_active boolean not null default true,student_service_scope text);
create table public.teacher_student_relations(teacher_id uuid references public.profiles(id),student_id uuid references public.profiles(id),primary key(teacher_id,student_id));
create table public.courses(id uuid primary key,title text,is_active boolean);
create table public.modules(id uuid primary key,course_id uuid references public.courses(id),title text,order_index double precision,is_active boolean);
create table public.submodules(id uuid primary key,module_id uuid references public.modules(id),is_active boolean);
create table public.lessons(id uuid primary key,submodule_id uuid references public.submodules(id));
create table public.student_progress(student_id uuid references public.profiles(id),lesson_id uuid references public.lessons(id),completed_at timestamptz,primary key(student_id,lesson_id));
create table public.scheduled_lessons(id uuid primary key,teacher_id uuid references public.profiles(id),student_id uuid references public.profiles(id),session_track text,status text);
alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_owner_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
alter table public.lessons enable row level security;
grant select on all tables in schema public to authenticated;
grant update on public.profiles to authenticated;
grant insert,update on public.student_progress to authenticated;
