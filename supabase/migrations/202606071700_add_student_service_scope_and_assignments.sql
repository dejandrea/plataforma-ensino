alter table public.profiles
  add column if not exists student_service_scope text
    check (student_service_scope in ('mentoring', 'course', 'both')),
  add column if not exists commercial_assignments jsonb not null default '[]'::jsonb;

alter table public.access_invites
  add column if not exists student_service_scope text
    check (student_service_scope in ('mentoring', 'course', 'both')),
  add column if not exists commercial_assignments jsonb not null default '[]'::jsonb;

update public.profiles
set
  student_service_scope = coalesce(
    student_service_scope,
    case
      when role = 'student' and pricing_session_track in ('mentoring', 'course') then pricing_session_track
      else null
    end
  ),
  commercial_assignments = case
    when jsonb_typeof(commercial_assignments) = 'array' and jsonb_array_length(commercial_assignments) > 0 then commercial_assignments
    when role = 'student'
      and pricing_mode in ('rate', 'package')
      and pricing_session_track in ('mentoring', 'course')
    then jsonb_build_array(
      jsonb_build_object(
        'session_track', pricing_session_track,
        'pricing_mode', pricing_mode,
        'pricing_package_id', pricing_package_id,
        'hourly_rate', hourly_rate
      )
    )
    else '[]'::jsonb
  end
where role = 'student';

update public.access_invites
set
  student_service_scope = coalesce(
    student_service_scope,
    case
      when role = 'student' and pricing_session_track in ('mentoring', 'course') then pricing_session_track
      else null
    end
  ),
  commercial_assignments = case
    when jsonb_typeof(commercial_assignments) = 'array' and jsonb_array_length(commercial_assignments) > 0 then commercial_assignments
    when role = 'student'
      and pricing_mode in ('rate', 'package')
      and pricing_session_track in ('mentoring', 'course')
    then jsonb_build_array(
      jsonb_build_object(
        'session_track', pricing_session_track,
        'pricing_mode', pricing_mode,
        'pricing_package_id', pricing_package_id,
        'hourly_rate', hourly_rate
      )
    )
    else '[]'::jsonb
  end
where role = 'student';

create or replace function public.list_user_commercial_settings()
returns table (
  invite_id uuid,
  user_id uuid,
  student_service_scope text,
  commercial_assignments jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  return query
  with invite_rows as (
    select
      ai.id as invite_id,
      ai.claimed_user_id as user_id,
      ai.student_service_scope,
      ai.commercial_assignments
    from public.access_invites ai
    where ai.role = 'student'
  ),
  legacy_rows as (
    select
      null::uuid as invite_id,
      p.id as user_id,
      p.student_service_scope,
      p.commercial_assignments
    from public.profiles p
    where p.role = 'student'
      and not exists (
        select 1
        from public.access_invites ai
        where ai.claimed_user_id = p.id
      )
  )
  select * from invite_rows
  union all
  select * from legacy_rows;
end;
$$;

create or replace function public.claim_access_invite(
  p_email text,
  p_user_id uuid
)
returns table (
  id uuid,
  full_name text,
  last_name text,
  nickname text,
  birth_date date,
  role text,
  is_active boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.access_invites;
begin
  select *
  into v_invite
  from public.access_invites
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_invite.id is null then
    raise exception 'Invite not found';
  end if;

  if v_invite.claimed_at is not null and v_invite.claimed_user_id is distinct from p_user_id then
    raise exception 'Invite already claimed';
  end if;

  insert into public.profiles (
    id,
    full_name,
    last_name,
    nickname,
    birth_date,
    role,
    hourly_rate,
    pricing_mode,
    pricing_session_track,
    pricing_package_id,
    student_service_scope,
    commercial_assignments,
    invited_at,
    is_active
  )
  values (
    p_user_id,
    v_invite.full_name,
    v_invite.last_name,
    v_invite.nickname,
    v_invite.birth_date,
    v_invite.role,
    case when v_invite.role = 'student' then v_invite.hourly_rate else null end,
    case when v_invite.role = 'student' then v_invite.pricing_mode else null end,
    case when v_invite.role = 'student' then v_invite.pricing_session_track else null end,
    case when v_invite.role = 'student' then v_invite.pricing_package_id else null end,
    case when v_invite.role = 'student' then v_invite.student_service_scope else null end,
    case when v_invite.role = 'student' then coalesce(v_invite.commercial_assignments, '[]'::jsonb) else '[]'::jsonb end,
    v_invite.invited_at,
    true
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    last_name = excluded.last_name,
    nickname = excluded.nickname,
    birth_date = excluded.birth_date,
    role = excluded.role,
    hourly_rate = excluded.hourly_rate,
    pricing_mode = excluded.pricing_mode,
    pricing_session_track = excluded.pricing_session_track,
    pricing_package_id = excluded.pricing_package_id,
    student_service_scope = excluded.student_service_scope,
    commercial_assignments = excluded.commercial_assignments,
    invited_at = excluded.invited_at,
    is_active = true,
    updated_at = now();

  update public.access_invites
  set
    claimed_at = coalesce(claimed_at, now()),
    claimed_user_id = p_user_id
  where id = v_invite.id;

  return query
  select
    p.id,
    p.full_name,
    p.last_name,
    p.nickname,
    p.birth_date,
    p.role,
    p.is_active
  from public.profiles p
  where p.id = p_user_id;
end;
$$;
