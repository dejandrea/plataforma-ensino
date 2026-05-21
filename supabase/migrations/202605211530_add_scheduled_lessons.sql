create table if not exists public.scheduled_lessons (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid references public.profiles (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  session_track text not null default 'mentoring' check (session_track in ('mentoring', 'course')),
  status text not null default 'available' check (status in ('available', 'scheduled', 'completed', 'cancelled')),
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  meet_link text,
  calendar_provider text,
  calendar_calendar_id text,
  calendar_event_id text,
  recurrence_group_id uuid,
  recurrence_index integer not null default 1,
  booked_at timestamp with time zone,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_scheduled_lessons_teacher_id
  on public.scheduled_lessons (teacher_id);

create index if not exists idx_scheduled_lessons_student_id
  on public.scheduled_lessons (student_id);

create index if not exists idx_scheduled_lessons_status_starts_at
  on public.scheduled_lessons (status, starts_at);

alter table public.scheduled_lessons enable row level security;

drop policy if exists scheduled_lessons_admin_all on public.scheduled_lessons;
create policy scheduled_lessons_admin_all
  on public.scheduled_lessons
  for all
  to authenticated
  using (
    (
      select profiles.role
      from public.profiles
      where profiles.id = auth.uid()
    ) = 'admin'
  )
  with check (
    (
      select profiles.role
      from public.profiles
      where profiles.id = auth.uid()
    ) = 'admin'
  );

drop policy if exists scheduled_lessons_teacher_select on public.scheduled_lessons;
create policy scheduled_lessons_teacher_select
  on public.scheduled_lessons
  for select
  to authenticated
  using (
    teacher_id = auth.uid()
    and (
      select profiles.role
      from public.profiles
      where profiles.id = auth.uid()
    ) in ('admin', 'professor')
  );

drop policy if exists scheduled_lessons_teacher_insert on public.scheduled_lessons;
create policy scheduled_lessons_teacher_insert
  on public.scheduled_lessons
  for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and created_by = auth.uid()
    and (
      select profiles.role
      from public.profiles
      where profiles.id = auth.uid()
    ) in ('admin', 'professor')
  );

drop policy if exists scheduled_lessons_teacher_update on public.scheduled_lessons;
create policy scheduled_lessons_teacher_update
  on public.scheduled_lessons
  for update
  to authenticated
  using (
    teacher_id = auth.uid()
    and (
      select profiles.role
      from public.profiles
      where profiles.id = auth.uid()
    ) in ('admin', 'professor')
  )
  with check (
    teacher_id = auth.uid()
    and (
      select profiles.role
      from public.profiles
      where profiles.id = auth.uid()
    ) in ('admin', 'professor')
  );

drop policy if exists scheduled_lessons_teacher_delete on public.scheduled_lessons;
create policy scheduled_lessons_teacher_delete
  on public.scheduled_lessons
  for delete
  to authenticated
  using (
    teacher_id = auth.uid()
    and (
      select profiles.role
      from public.profiles
      where profiles.id = auth.uid()
    ) in ('admin', 'professor')
  );

drop policy if exists scheduled_lessons_student_select on public.scheduled_lessons;
create policy scheduled_lessons_student_select
  on public.scheduled_lessons
  for select
  to authenticated
  using (
    student_id = auth.uid()
    or (
      status = 'available'
      and exists (
        select 1
        from public.teacher_student_relations relations
        where relations.teacher_id = scheduled_lessons.teacher_id
          and relations.student_id = auth.uid()
      )
    )
  );

create table if not exists public.lesson_access_logs (
  id uuid primary key default gen_random_uuid(),
  scheduled_lesson_id uuid not null references public.scheduled_lessons (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  entrypoint text not null default 'platform',
  accessed_at timestamp with time zone not null default now()
);

create index if not exists idx_lesson_access_logs_session_id
  on public.lesson_access_logs (scheduled_lesson_id);

create index if not exists idx_lesson_access_logs_student_id
  on public.lesson_access_logs (student_id);

alter table public.lesson_access_logs enable row level security;

drop policy if exists lesson_access_logs_admin_all on public.lesson_access_logs;
create policy lesson_access_logs_admin_all
  on public.lesson_access_logs
  for all
  to authenticated
  using (
    (
      select profiles.role
      from public.profiles
      where profiles.id = auth.uid()
    ) = 'admin'
  )
  with check (
    (
      select profiles.role
      from public.profiles
      where profiles.id = auth.uid()
    ) = 'admin'
  );

drop policy if exists lesson_access_logs_teacher_select on public.lesson_access_logs;
create policy lesson_access_logs_teacher_select
  on public.lesson_access_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.scheduled_lessons lesson
      where lesson.id = lesson_access_logs.scheduled_lesson_id
        and lesson.teacher_id = auth.uid()
    )
  );

drop policy if exists lesson_access_logs_student_select on public.lesson_access_logs;
create policy lesson_access_logs_student_select
  on public.lesson_access_logs
  for select
  to authenticated
  using (student_id = auth.uid());

create or replace function public.book_scheduled_lesson(p_lesson_id uuid)
returns public.scheduled_lessons
language plpgsql
security definer
set search_path = public
as $$
declare
  booked_lesson public.scheduled_lessons;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  update public.scheduled_lessons lesson
  set
    student_id = auth.uid(),
    status = 'scheduled',
    booked_at = now(),
    updated_at = now()
  where lesson.id = p_lesson_id
    and lesson.status = 'available'
    and lesson.student_id is null
    and exists (
      select 1
      from public.teacher_student_relations relations
      where relations.teacher_id = lesson.teacher_id
        and relations.student_id = auth.uid()
    )
  returning *
  into booked_lesson;

  if booked_lesson.id is null then
    raise exception 'Este horario nao esta mais disponivel.';
  end if;

  return booked_lesson;
end;
$$;

grant execute on function public.book_scheduled_lesson(uuid) to authenticated;

create or replace function public.log_scheduled_lesson_access(p_lesson_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_log_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if not exists (
    select 1
    from public.scheduled_lessons lesson
    where lesson.id = p_lesson_id
      and lesson.student_id = auth.uid()
  ) then
    raise exception 'Aula nao encontrada para este aluno.';
  end if;

  insert into public.lesson_access_logs (
    scheduled_lesson_id,
    student_id
  )
  values (
    p_lesson_id,
    auth.uid()
  )
  returning id
  into new_log_id;

  return new_log_id;
end;
$$;

grant execute on function public.log_scheduled_lesson_access(uuid) to authenticated;
