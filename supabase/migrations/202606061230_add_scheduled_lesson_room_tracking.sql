alter table public.scheduled_lessons
  add column if not exists started_at timestamp with time zone,
  add column if not exists student_joined_at timestamp with time zone,
  add column if not exists teacher_joined_at timestamp with time zone,
  add column if not exists completed_by uuid references public.profiles (id) on delete set null;

create index if not exists idx_scheduled_lessons_student_completed_at
  on public.scheduled_lessons (student_id, completed_at desc);

create or replace function public.start_scheduled_lesson_session(p_lesson_id uuid)
returns public.scheduled_lessons
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role text;
  updated_lesson public.scheduled_lessons;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select role
  into current_role
  from public.profiles
  where id = auth.uid();

  update public.scheduled_lessons lesson
  set
    started_at = coalesce(lesson.started_at, now()),
    student_joined_at = case
      when lesson.student_id = auth.uid() then coalesce(lesson.student_joined_at, now())
      else lesson.student_joined_at
    end,
    teacher_joined_at = case
      when lesson.teacher_id = auth.uid() and current_role in ('admin', 'professor')
        then coalesce(lesson.teacher_joined_at, now())
      else lesson.teacher_joined_at
    end,
    updated_at = now()
  where lesson.id = p_lesson_id
    and lesson.status = 'scheduled'
    and (
      lesson.student_id = auth.uid()
      or (
        lesson.teacher_id = auth.uid()
        and current_role in ('admin', 'professor')
      )
    )
  returning *
  into updated_lesson;

  if updated_lesson.id is null then
    raise exception 'Aula nao encontrada para este usuario ou ainda nao esta agendada.';
  end if;

  return updated_lesson;
end;
$$;

grant execute on function public.start_scheduled_lesson_session(uuid) to authenticated;
