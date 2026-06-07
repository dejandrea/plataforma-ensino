drop function if exists public.list_access_invites();

create or replace function public.list_access_invites()
returns table (
  id uuid,
  email text,
  full_name text,
  last_name text,
  nickname text,
  birth_date date,
  role text,
  hourly_rate numeric,
  pricing_mode text,
  pricing_session_track text,
  pricing_package_id uuid,
  student_service_scope text,
  commercial_assignments jsonb,
  invited_at timestamptz,
  claimed_at timestamptz,
  claimed_user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  return query
  select
    ai.id,
    ai.email,
    ai.full_name,
    ai.last_name,
    ai.nickname,
    ai.birth_date,
    ai.role,
    ai.hourly_rate,
    ai.pricing_mode,
    ai.pricing_session_track,
    ai.pricing_package_id,
    ai.student_service_scope,
    ai.commercial_assignments,
    ai.invited_at,
    ai.claimed_at,
    ai.claimed_user_id
  from public.access_invites ai
  order by ai.invited_at desc;
end;
$$;

drop function if exists public.list_system_users();

create or replace function public.list_system_users()
returns table (
  invite_id uuid,
  user_id uuid,
  email text,
  full_name text,
  last_name text,
  nickname text,
  birth_date date,
  role text,
  hourly_rate numeric,
  pricing_mode text,
  pricing_session_track text,
  pricing_package_id uuid,
  student_service_scope text,
  commercial_assignments jsonb,
  invited_at timestamptz,
  claimed_at timestamptz,
  claimed_user_id uuid,
  is_active boolean,
  source text,
  can_delete_invite boolean
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
      p.id as user_id,
      coalesce(ai.email, au.email::text) as email,
      coalesce(nullif(p.full_name, ''), ai.full_name) as full_name,
      coalesce(nullif(p.last_name, ''), ai.last_name) as last_name,
      coalesce(nullif(p.nickname, ''), ai.nickname) as nickname,
      coalesce(p.birth_date, ai.birth_date) as birth_date,
      coalesce(nullif(p.role, ''), ai.role) as role,
      case
        when coalesce(nullif(p.role, ''), ai.role) = 'student'
          then coalesce(p.hourly_rate, ai.hourly_rate)
        else null::numeric
      end as hourly_rate,
      case
        when coalesce(nullif(p.role, ''), ai.role) = 'student'
          then coalesce(p.pricing_mode, ai.pricing_mode)
        else null::text
      end as pricing_mode,
      case
        when coalesce(nullif(p.role, ''), ai.role) = 'student'
          then coalesce(p.pricing_session_track, ai.pricing_session_track)
        else null::text
      end as pricing_session_track,
      case
        when coalesce(nullif(p.role, ''), ai.role) = 'student'
          then coalesce(p.pricing_package_id, ai.pricing_package_id)
        else null::uuid
      end as pricing_package_id,
      case
        when coalesce(nullif(p.role, ''), ai.role) = 'student'
          then coalesce(p.student_service_scope, ai.student_service_scope)
        else null::text
      end as student_service_scope,
      case
        when coalesce(nullif(p.role, ''), ai.role) = 'student'
          then coalesce(p.commercial_assignments, ai.commercial_assignments, '[]'::jsonb)
        else '[]'::jsonb
      end as commercial_assignments,
      ai.invited_at,
      ai.claimed_at,
      ai.claimed_user_id,
      p.is_active,
      case
        when ai.claimed_user_id is not null then 'claimed_invite'
        else 'invite_only'
      end as source,
      true as can_delete_invite,
      coalesce(p.invited_at, ai.invited_at, au.created_at) as sort_at
    from public.access_invites ai
    left join public.profiles p
      on p.id = ai.claimed_user_id
    left join auth.users au
      on au.id = coalesce(ai.claimed_user_id, p.id)
  ),
  legacy_profiles as (
    select
      null::uuid as invite_id,
      p.id as user_id,
      au.email::text as email,
      p.full_name,
      p.last_name,
      p.nickname,
      p.birth_date,
      p.role,
      case
        when p.role = 'student' then p.hourly_rate
        else null::numeric
      end as hourly_rate,
      case
        when p.role = 'student' then p.pricing_mode
        else null::text
      end as pricing_mode,
      case
        when p.role = 'student' then p.pricing_session_track
        else null::text
      end as pricing_session_track,
      case
        when p.role = 'student' then p.pricing_package_id
        else null::uuid
      end as pricing_package_id,
      case
        when p.role = 'student' then p.student_service_scope
        else null::text
      end as student_service_scope,
      case
        when p.role = 'student' then coalesce(p.commercial_assignments, '[]'::jsonb)
        else '[]'::jsonb
      end as commercial_assignments,
      p.invited_at,
      p.invited_at as claimed_at,
      p.id as claimed_user_id,
      p.is_active,
      'legacy_profile'::text as source,
      false as can_delete_invite,
      coalesce(p.invited_at, au.created_at) as sort_at
    from public.profiles p
    left join auth.users au
      on au.id = p.id
    where not exists (
      select 1
      from public.access_invites ai
      where ai.claimed_user_id = p.id
         or (
           au.email is not null
           and lower(ai.email) = lower(au.email::text)
         )
    )
  )
  select
    rows.invite_id,
    rows.user_id,
    rows.email,
    rows.full_name,
    rows.last_name,
    rows.nickname,
    rows.birth_date,
    rows.role,
    rows.hourly_rate,
    rows.pricing_mode,
    rows.pricing_session_track,
    rows.pricing_package_id,
    rows.student_service_scope,
    rows.commercial_assignments,
    rows.invited_at,
    rows.claimed_at,
    rows.claimed_user_id,
    rows.is_active,
    rows.source,
    rows.can_delete_invite
  from (
    select * from invite_rows
    union all
    select * from legacy_profiles
  ) as rows
  order by rows.sort_at desc nulls last, rows.full_name nulls last, rows.email nulls last;
end;
$$;
