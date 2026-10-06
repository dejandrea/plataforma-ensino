create table public.student_courses (
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, course_id)
);
alter table public.student_courses enable row level security;
grant select, insert, delete on public.student_courses to authenticated;
create policy student_courses_read on public.student_courses for select to authenticated using (
  student_id = (select auth.uid())
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active)
  or exists (select 1 from public.teacher_student_relations r where r.student_id = student_courses.student_id and r.teacher_id = (select auth.uid()))
);
create policy student_courses_admin_insert on public.student_courses for insert to authenticated with check (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active)
  and exists (select 1 from public.profiles p where p.id = student_id and p.role = 'student')
);
create policy student_courses_admin_delete on public.student_courses for delete to authenticated using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active)
);
create or replace function public.validate_evaluation_student_course()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.student_courses sc
    join public.modules m on m.course_id = sc.course_id
    join public.courses c on c.id = sc.course_id
    join public.profiles p on p.id = sc.student_id
    where sc.student_id = new.student_id and m.id = new.module_id
      and m.is_active and c.is_active and p.role = 'student' and p.is_active
  ) then
    raise exception 'Este modulo nao pertence a uma materia ativa vinculada ao aluno.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_evaluation_student_course() from public, anon, authenticated;
create trigger validate_evaluation_student_course
before insert or update of student_id, module_id on public.module_evaluations
for each row execute function public.validate_evaluation_student_course();
revoke all on public.student_courses from anon;
revoke update, truncate, references, trigger on public.student_courses from authenticated;
create policy evaluations_assigned_teacher_select on public.module_evaluations for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'professor' and p.is_active)
  and exists (select 1 from public.teacher_student_relations r where r.student_id = module_evaluations.student_id and r.teacher_id = (select auth.uid()))
);
create policy evaluations_assigned_teacher_insert on public.module_evaluations for insert to authenticated with check (
  teacher_id = (select auth.uid())
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'professor' and p.is_active)
  and exists (select 1 from public.teacher_student_relations r where r.student_id = module_evaluations.student_id and r.teacher_id = (select auth.uid()))
);


