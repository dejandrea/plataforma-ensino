create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Teachers need the student's progress even though student_progress has owner-only RLS.
-- The privileged implementation is private and checks the caller before reading it.
create or replace function private.student_curriculum_status(p_student_id uuid)
returns table (id uuid, title text, course_id uuid, course_title text, order_index double precision,
  total_lessons bigint, completed_lessons bigint, is_completed boolean, is_unlocked boolean, course_completed boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles caller where caller.id=auth.uid() and caller.is_active
    and (caller.id=p_student_id or caller.role='admin'
      or (caller.role='professor' and exists (
        select 1 from public.teacher_student_relations r where r.teacher_id=caller.id and r.student_id=p_student_id
      )))
  ) then
    raise exception 'Sem permissao para consultar o progresso deste aluno.' using errcode='42501';
  end if;
  return query
  with summary as (
    select m.id, m.title, m.course_id, c.title course_title, m.order_index,
      count(l.id) total_lessons,
      count(l.id) filter (where exists (
        select 1 from public.student_progress sp where sp.student_id=p_student_id
          and sp.lesson_id=l.id and sp.completed_at is not null
      )) completed_lessons
    from public.modules m
    join public.courses c on c.id=m.course_id and c.is_active
    join public.profiles student on student.id=p_student_id and student.role='student'
      and student.is_active and student.student_service_scope in ('course','both')
    left join public.submodules s on s.module_id=m.id and s.is_active
    left join public.lessons l on l.submodule_id=s.id
    where m.is_active
    group by m.id,c.title
  ), states as (
    select summary.*, summary.total_lessons>0 and summary.completed_lessons=summary.total_lessons is_completed,
      row_number() over (partition by summary.course_id order by summary.order_index nulls last, summary.id) position
    from summary
  )
  select current.id,current.title,current.course_id,current.course_title,current.order_index,
    current.total_lessons,current.completed_lessons,current.is_completed,
    not exists (select 1 from states previous where previous.course_id=current.course_id
      and previous.position<current.position and not previous.is_completed) is_unlocked,
    bool_and(current.is_completed) over (partition by current.course_id) course_completed
  from states current order by current.course_title,current.position;
end;
$$;
revoke all on function private.student_curriculum_status(uuid) from public,anon;
grant execute on function private.student_curriculum_status(uuid) to authenticated;

create or replace function public.student_curriculum_status(p_student_id uuid)
returns table (id uuid, title text, course_id uuid, course_title text, order_index double precision,
  total_lessons bigint, completed_lessons bigint, is_completed boolean, is_unlocked boolean, course_completed boolean)
language sql stable security invoker set search_path = '' as $$
  select * from private.student_curriculum_status(p_student_id);
$$;
revoke all on function public.student_curriculum_status(uuid) from public,anon;
grant execute on function public.student_curriculum_status(uuid) to authenticated;

create or replace function public.validate_evaluation_student_course()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.student_curriculum_status(new.student_id) status
    where status.id=new.module_id and status.course_completed
  ) then
    raise exception 'O aluno so pode receber avaliacao de uma materia que ja concluiu.' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_evaluation_student_course() from public,anon,authenticated;

-- Prevent access to later modules through a direct lesson URL or Data API.
drop policy if exists "Alunos veem aulas" on public.lessons;
drop policy if exists "Permitir leitura pública de aulas" on public.lessons;
drop policy if exists "Usuários logados podem ver aulas" on public.lessons;
create policy lessons_staff_read on public.lessons for select to authenticated using (
  exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','professor') and p.is_active)
);
create policy lessons_unlocked_student_read on public.lessons for select to authenticated using (
  exists (select 1 from public.submodules s
    join public.student_curriculum_status((select auth.uid())) status on status.id=s.module_id
    where s.id=lessons.submodule_id and s.is_active and status.is_unlocked)
);

create or replace function public.validate_student_progress_access()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.lessons l join public.submodules s on s.id=l.submodule_id and s.is_active
    join public.student_curriculum_status(new.student_id) status on status.id=s.module_id
    where l.id=new.lesson_id and status.is_unlocked
  ) then
    raise exception 'Conclua o modulo anterior antes de registrar esta aula.' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_student_progress_access() from public,anon,authenticated;
create trigger validate_student_progress_access before insert or update on public.student_progress
for each row execute function public.validate_student_progress_access();

