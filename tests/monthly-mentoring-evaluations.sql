-- Run against a project with an active mentoring student. All test writes roll back.
begin;
do $$
declare
  student uuid;
  month date;
  joined timestamptz;
  current_month date := date_trunc('month', now() at time zone 'America/Bahia')::date;
begin
  select p.id, m.reference_month, p.platform_joined_at into student, month, joined
  from public.profiles p cross join lateral public.pending_mentoring_evaluation_months(p.id) m
  where p.student_service_scope = 'mentoring' limit 1;
  if student is null then raise exception 'Test requires a mentoring student with a pending month'; end if;

  insert into public.module_evaluations(student_id, reference_month, teacher_comment)
  values(student, month, 'TEST - ROLLBACK');
  if exists(select 1 from public.pending_mentoring_evaluation_months(student) m where m.reference_month = month) then
    raise exception 'Saved month still pending';
  end if;
  begin
    insert into public.module_evaluations(student_id, reference_month) values(student, month);
    raise exception 'Duplicate month accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.module_evaluations(student_id, reference_month) values(student, current_month);
    raise exception 'Current month accepted';
  exception when check_violation then null; end;
  begin
    insert into public.module_evaluations(student_id, reference_month)
    values(student, (date_trunc('month', joined at time zone 'America/Bahia') - interval '1 month')::date);
    raise exception 'Month before enrollment accepted';
  exception when check_violation then null; end;
  begin
    insert into public.module_evaluations(student_id, reference_month) values(student, month + 1);
    raise exception 'Non-first day accepted';
  exception when check_violation then null; end;
  begin
    insert into public.module_evaluations(student_id, module_id)
    select student, id from public.modules limit 1;
    raise exception 'Mentoring-only module evaluation accepted';
  exception when check_violation then null; end;

  update public.profiles set platform_joined_at = now() where id = student;
  if (select platform_joined_at from public.profiles where id = student) <> joined then
    raise exception 'Enrollment date was changed';
  end if;
  if exists(select 1 from public.profiles p cross join lateral public.pending_mentoring_evaluation_months(p.id) m
    where p.student_service_scope = 'course') then raise exception 'Course-only student has monthly pending evaluations'; end if;
end;
$$;
select 'Monthly evaluation rules passed; all writes rolled back' as result;
rollback;
