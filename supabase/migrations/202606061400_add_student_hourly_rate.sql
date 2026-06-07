alter table public.profiles
  add column if not exists hourly_rate numeric(10, 2);

alter table public.access_invites
  add column if not exists hourly_rate numeric(10, 2);

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
    ai.invited_at,
    ai.claimed_at,
    ai.claimed_user_id
  from public.access_invites ai
  order by ai.invited_at desc;
end;
$$;

drop function if exists public.get_access_invite(text);

create or replace function public.get_access_invite(
  p_email text
)
returns table (
  email text,
  full_name text,
  last_name text,
  nickname text,
  birth_date date,
  role text,
  hourly_rate numeric,
  claimed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    ai.email,
    ai.full_name,
    ai.last_name,
    ai.nickname,
    ai.birth_date,
    ai.role,
    ai.hourly_rate,
    ai.claimed_at
  from public.access_invites ai
  where lower(ai.email) = lower(trim(p_email))
  limit 1;
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
