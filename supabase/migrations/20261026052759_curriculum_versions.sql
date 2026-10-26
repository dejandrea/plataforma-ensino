-- Version-aware curriculum. Existing lessons remain v1/published.
begin;
alter table public.lessons
 add column curriculum_version integer not null default 1 check(curriculum_version>0),
 add column curriculum_number integer check(curriculum_number between 0 and 999),
 add column publication_status text not null default 'published' check(publication_status in('planned','published'));

create table private.curriculum_releases(
 module_id uuid primary key references public.modules(id) on delete restrict,
 current_version integer not null check(current_version>0),
 label text not null,
 created_at timestamptz not null default now()
);
create table private.student_curriculum_cohorts(
 student_id uuid not null references public.profiles(id) on delete restrict,
 module_id uuid not null references private.curriculum_releases(module_id) on delete restrict,
 version integer not null check(version>0),
 assigned_at timestamptz not null default now(),
 primary key(student_id,module_id)
);
create table private.curriculum_function_backups(
 signature text primary key,definition text not null
);
alter table private.curriculum_releases enable row level security;
alter table private.student_curriculum_cohorts enable row level security;
alter table private.curriculum_function_backups enable row level security;
revoke all on private.curriculum_releases,private.student_curriculum_cohorts,private.curriculum_function_backups from public,anon,authenticated;

-- Internal predicate: no access grant. It is also used by the existing XP calculator.
create function private.curriculum_lesson_in_version(p_student_id uuid,p_lesson_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.lessons l join public.submodules sm on sm.id=l.submodule_id
 left join private.curriculum_releases r on r.module_id=sm.module_id
 left join private.student_curriculum_cohorts c on c.module_id=sm.module_id and c.student_id=p_student_id
 where l.id=p_lesson_id and l.curriculum_version<=least(coalesce(c.version,r.current_version,1),coalesce(r.current_version,1)));
$$;
revoke all on function private.curriculum_lesson_in_version(uuid,uuid) from public,anon,authenticated;
create function private.curriculum_lesson_available(p_student_id uuid,p_lesson_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.curriculum_lesson_in_version(p_student_id,p_lesson_id)
 and exists(select 1 from public.lessons l where l.id=p_lesson_id and l.publication_status='published');
$$;
revoke all on function private.curriculum_lesson_available(uuid,uuid) from public,anon,authenticated;

-- Only this own-user predicate is granted for RLS. Planned rows show the roadmap;
-- learner RPCs and activity policies separately require the lesson to be published.
create function private.curriculum_can_read_lesson(p_lesson_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.learning_role()='student' and private.curriculum_lesson_in_version(auth.uid(),p_lesson_id);
$$;
revoke all on function private.curriculum_can_read_lesson(uuid) from public,anon;
grant execute on function private.curriculum_can_read_lesson(uuid) to authenticated;

-- Retain original definitions for review/forward recovery. Every patch is exact
-- and aborts on unexpected source drift; CREATE OR REPLACE preserves all ACLs.
do $patch$
declare item record; source text; changed text;
begin
 for item in select * from (values
 ('private.student_curriculum_status(uuid)','left join public.lessons l on l.submodule_id=s.id',
  'left join public.lessons l on l.submodule_id=s.id and private.curriculum_lesson_in_version(p_student_id,l.id)'),
 ('private.sync_student_base_xp(uuid)','left join public.lessons l on l.submodule_id=s.id',
  'left join public.lessons l on l.submodule_id=s.id and private.curriculum_lesson_in_version(p_student_id,l.id)'),
 ('private.learning_require_student_lesson(uuid)','where l.id=p_lesson_id',
  'where l.id=p_lesson_id and private.curriculum_lesson_available(auth.uid(),l.id)'),
 ('public.validate_student_progress_access()','where l.id=new.lesson_id and status.is_unlocked',
  'where l.id=new.lesson_id and status.is_unlocked and private.curriculum_lesson_available(new.student_id,l.id)'),
 ('private.learning_can_read_activity(uuid)','where a.id=p_activity_id',
  'where a.id=p_activity_id and private.curriculum_lesson_available(auth.uid(),l.id)'),
 ('private.learning_award_submodule()','where l.submodule_id=sub and not exists(',
  'where l.submodule_id=sub and private.curriculum_lesson_in_version(new.student_id,l.id) and not exists('),
 ('private.pedagogy_student_journey(uuid,uuid)','select l.id,l.title,l.submodule_id,',
  'select l.id,l.title,l.submodule_id,l.publication_status,l.curriculum_number,l.curriculum_version,'),
 ('private.pedagogy_student_journey(uuid,uuid)','left join public.student_progress p on p.lesson_id=l.id and p.student_id=p_student_id',
  'left join public.student_progress p on p.lesson_id=l.id and p.student_id=p_student_id where private.curriculum_lesson_in_version(p_student_id,l.id)'),
 ('private.pedagogy_require_lesson(uuid,uuid)','where l.id=p_lesson_id)',
  'where l.id=p_lesson_id and private.curriculum_lesson_available(p_student_id,l.id))'),
 ('public.teacher_learning_workspace(uuid)', 'where a.activity_type=''online_lesson''',
  'where private.curriculum_lesson_available(meeting.student_id,l.id) and a.activity_type=''online_lesson'''),
 ('public.link_teacher_learning_activity(uuid,uuid)','where l.id=a.lesson_id)',
  'where l.id=a.lesson_id and private.curriculum_lesson_available(meeting.student_id,l.id))'),
 ('public.confirm_teacher_learning_activity(uuid,integer)','where l.id=a.lesson_id)',
  'where l.id=a.lesson_id and private.curriculum_lesson_available(meeting.student_id,l.id))')
 ) as edits(signature,needle,replacement)
 loop
  select pg_get_functiondef(item.signature::regprocedure) into source;
  source:=replace(source,E'\r\n',E'\n');
  if strpos(source,item.needle)=0 or
    (length(source)-length(replace(source,item.needle,'')))/length(item.needle)<>1 then
   raise exception 'Curriculum migration: unexpected definition for %',item.signature;
  end if;
  insert into private.curriculum_function_backups values(item.signature,source) on conflict do nothing;
  changed:=replace(source,item.needle,item.replacement);
  execute changed;
 end loop;
end $patch$;

insert into private.curriculum_function_backups
 select 'private.learning_lesson_ready(uuid,uuid)',pg_get_functiondef('private.learning_lesson_ready(uuid,uuid)'::regprocedure);
create or replace function private.learning_lesson_ready(p_student_id uuid,p_lesson_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.curriculum_lesson_available(p_student_id,p_lesson_id) and (
 not exists(select 1 from public.lesson_activities where lesson_id=p_lesson_id and published_at is not null)
 or (exists(select 1 from public.lesson_activities where lesson_id=p_lesson_id and is_active and publication_status='published')
 and not exists(select 1 from public.lesson_activities a where a.lesson_id=p_lesson_id and a.is_active and a.publication_status='published' and a.is_required
 and not exists(select 1 from public.student_activity_progress p where p.student_id=p_student_id
 and p.activity_id=a.id and p.activity_revision=a.revision and p.status='completed'))));
$$;

drop policy lessons_unlocked_student_read on public.lessons;
create policy lessons_unlocked_student_read on public.lessons for select to authenticated using(
 private.curriculum_can_read_lesson(id) and exists(
 select 1 from public.submodules s join public.student_curriculum_status((select auth.uid())) status on status.id=s.module_id
 where s.id=lessons.submodule_id and s.is_active and status.is_unlocked)
);

-- No empty lesson may award completion/XP. Both direct updates and the explicit
-- publish RPC pass this trigger; importing activities does not publish a lesson.
create function private.guard_curriculum_lesson() returns trigger
language plpgsql security definer set search_path='' as $$
declare release_version integer;
begin
 if tg_op='INSERT' then
  select r.current_version into release_version from private.curriculum_releases r
  join public.submodules sm on sm.module_id=r.module_id where sm.id=new.submodule_id;
  if release_version is not null then
   new.curriculum_version:=release_version;
   new.publication_status:='planned';
  end if;
 end if;
 if tg_op='UPDATE' and (new.curriculum_version<>old.curriculum_version or new.submodule_id is distinct from old.submodule_id
 or old.publication_status='published' and new.publication_status='planned')
 and (exists(select 1 from public.student_progress where lesson_id=old.id)
 or exists(select 1 from public.lesson_activities where lesson_id=old.id)) then
  raise exception 'A identidade curricular de uma aula com histórico deve ser preservada.' using errcode='23514';
 end if;
 if new.publication_status='published' and (tg_op='INSERT' and new.curriculum_version>1
 or tg_op='UPDATE' and old.publication_status='planned') and not exists(
 select 1 from public.lesson_activities a where a.lesson_id=new.id and a.is_active and a.publication_status='published') then
  raise exception 'Importe e valide as atividades antes de liberar esta aula.' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function private.guard_curriculum_lesson() from public,anon,authenticated;
create trigger guard_curriculum_lesson before insert or update on public.lessons
 for each row execute function private.guard_curriculum_lesson();

create function private.publish_curriculum_lesson(p_lesson_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if private.learning_role() is distinct from 'admin' then
 raise exception 'Somente administradores podem liberar aulas.' using errcode='42501';end if;
 perform 1 from public.lessons where id=p_lesson_id for update;
 if not found then raise exception 'Aula não encontrada.' using errcode='22023';end if;
 update public.lessons set publication_status='published' where id=p_lesson_id and publication_status='planned';
end $$;
revoke all on function private.publish_curriculum_lesson(uuid) from public,anon;
grant execute on function private.publish_curriculum_lesson(uuid) to authenticated;
create function public.publish_curriculum_lesson(p_lesson_id uuid) returns void
language sql security invoker set search_path='' as $$select private.publish_curriculum_lesson(p_lesson_id);$$;
revoke all on function public.publish_curriculum_lesson(uuid) from public,anon;
grant execute on function public.publish_curriculum_lesson(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
