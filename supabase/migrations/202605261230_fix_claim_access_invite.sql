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
  from public.access_invites ai
  where lower(ai.email) = lower(trim(p_email))
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
    invited_at = excluded.invited_at,
    is_active = true,
    updated_at = now();

  update public.access_invites ai
  set
    claimed_at = coalesce(ai.claimed_at, now()),
    claimed_user_id = p_user_id
  where ai.id = v_invite.id;

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
