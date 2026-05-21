create table if not exists public.access_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  last_name text,
  nickname text,
  birth_date date,
  role text not null default 'student' check (role in ('student', 'professor', 'admin')),
  invited_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_user_id uuid references auth.users (id) on delete set null
);

create unique index if not exists access_invites_email_key
  on public.access_invites (lower(email));

alter table public.access_invites enable row level security;

create or replace function public.require_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'Admin access required';
  end if;
end;
$$;

create or replace function public.list_access_invites()
returns table (
  id uuid,
  email text,
  full_name text,
  last_name text,
  nickname text,
  birth_date date,
  role text,
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
    ai.invited_at,
    ai.claimed_at,
    ai.claimed_user_id
  from public.access_invites ai
  order by ai.invited_at desc;
end;
$$;

create or replace function public.create_access_invite(
  p_email text,
  p_full_name text,
  p_last_name text,
  p_nickname text,
  p_birth_date date,
  p_role text
)
returns public.access_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.access_invites;
begin
  perform public.require_admin();

  insert into public.access_invites (
    email,
    full_name,
    last_name,
    nickname,
    birth_date,
    role
  )
  values (
    lower(trim(p_email)),
    p_full_name,
    p_last_name,
    p_nickname,
    p_birth_date,
    p_role
  )
  returning * into v_invite;

  return v_invite;
end;
$$;

create or replace function public.delete_access_invite(
  p_invite_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  delete from public.access_invites
  where id = p_invite_id;
end;
$$;

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

grant execute on function public.list_access_invites() to authenticated;
grant execute on function public.create_access_invite(text, text, text, text, date, text) to authenticated;
grant execute on function public.delete_access_invite(uuid) to authenticated;
grant execute on function public.get_access_invite(text) to anon, authenticated;
grant execute on function public.claim_access_invite(text, uuid) to anon, authenticated;
