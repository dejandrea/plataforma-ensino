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

grant execute on function public.list_system_users() to authenticated;
