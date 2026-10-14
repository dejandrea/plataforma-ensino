-- Preserve enrollment independently of subsequent profile edits or invitations.
alter table public.profiles add column platform_joined_at timestamptz;
update public.profiles p set platform_joined_at = least(p.invited_at, u.created_at)
from auth.users u where u.id = p.id;
update public.profiles set platform_joined_at = coalesce(platform_joined_at, invited_at, now());
alter table public.profiles alter column platform_joined_at set default now();
alter table public.profiles alter column platform_joined_at set not null;

create function public.preserve_platform_joined_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.platform_joined_at := old.platform_joined_at;
  return new;
end;
$$;
revoke all on function public.preserve_platform_joined_at() from public, anon, authenticated;
create trigger preserve_platform_joined_at before update of platform_joined_at on public.profiles
for each row execute function public.preserve_platform_joined_at();

alter table public.module_evaluations add column reference_month date;
alter table public.module_evaluations add constraint evaluation_target_check check (
  (module_id is not null and reference_month is null)
  or (module_id is null and reference_month is not null and extract(day from reference_month) = 1)
);
create unique index evaluations_student_month_unique on public.module_evaluations(student_id, reference_month)
where reference_month is not null;

create function public.student_has_mentoring(p_student_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = p_student_id and p.role = 'student'
    and (p.student_service_scope in ('mentoring', 'both')
      or (p.student_service_scope is null and (
        p.pricing_session_track = 'mentoring'
        or p.commercial_assignments @> '[{"session_track":"mentoring"}]'::jsonb
      ))));
$$;
revoke all on function public.student_has_mentoring(uuid) from public, anon;
grant execute on function public.student_has_mentoring(uuid) to authenticated;

create function public.pending_mentoring_evaluation_months(p_student_id uuid)
returns table(reference_month date) language sql stable security invoker set search_path = '' as $$
  select month::date from public.profiles p
  cross join lateral generate_series(
    date_trunc('month', p.platform_joined_at at time zone 'America/Bahia'),
    date_trunc('month', now() at time zone 'America/Bahia') - interval '1 month',
    interval '1 month'
  ) month
  where p.id = p_student_id and p.is_active and public.student_has_mentoring(p.id)
    and not exists (select 1 from public.module_evaluations e
      where e.student_id = p.id and e.reference_month = month::date)
  order by month;
$$;
revoke all on function public.pending_mentoring_evaluation_months(uuid) from public, anon;
grant execute on function public.pending_mentoring_evaluation_months(uuid) to authenticated;

create or replace function public.validate_evaluation_student_course()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.reference_month is not null then
    if new.module_id is not null or not exists (
      select 1 from public.profiles p where p.id = new.student_id and p.is_active
        and public.student_has_mentoring(p.id)
        and extract(day from new.reference_month) = 1
        and new.reference_month >= date_trunc('month', p.platform_joined_at at time zone 'America/Bahia')::date
        and new.reference_month < date_trunc('month', now() at time zone 'America/Bahia')::date
    ) then
      raise exception 'O mês deve estar encerrado e pertencer ao período de ingresso de um aluno de mentoria ativo.' using errcode='23514';
    end if;
  else
    if exists (select 1 from public.profiles p where p.id = new.student_id and (
      p.student_service_scope = 'mentoring' or (p.student_service_scope is null
        and public.student_has_mentoring(p.id)
        and not (p.commercial_assignments @> '[{"session_track":"course"}]'::jsonb)
        and coalesce(p.pricing_session_track, '') <> 'course')
    )) then
      raise exception 'Alunos de mentoria devem receber avaliações mensais.' using errcode='23514';
    end if;
    if not exists (
      select 1 from public.student_curriculum_status(new.student_id) status
      where status.id = new.module_id and status.course_completed
    ) then
      raise exception 'O aluno so pode receber avaliacao de uma materia que ja concluiu.' using errcode='23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_evaluation_student_course() from public, anon, authenticated;
drop trigger validate_evaluation_student_course on public.module_evaluations;
create trigger validate_evaluation_student_course before insert or update of student_id, module_id, reference_month
on public.module_evaluations for each row execute function public.validate_evaluation_student_course();
