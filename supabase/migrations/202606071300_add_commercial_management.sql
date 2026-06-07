create table if not exists public.commercial_rate_settings (
  id uuid primary key default gen_random_uuid(),
  session_track text not null unique check (session_track in ('mentoring', 'course')),
  hourly_rate numeric(10,2) not null default 0,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.commercial_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  session_track text not null check (session_track in ('mentoring', 'course')),
  lesson_quantity integer not null default 1 check (lesson_quantity > 0),
  package_price numeric(10,2) not null default 0,
  validity_days integer check (validity_days is null or validity_days >= 0),
  description text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

insert into public.commercial_rate_settings (session_track, hourly_rate)
values
  ('mentoring', 0),
  ('course', 0)
on conflict (session_track) do nothing;

alter table public.commercial_rate_settings enable row level security;
alter table public.commercial_packages enable row level security;

drop policy if exists commercial_rate_settings_admin_all on public.commercial_rate_settings;
create policy commercial_rate_settings_admin_all
  on public.commercial_rate_settings
  for all
  to authenticated
  using (
    (
      select profiles.role
      from public.profiles
      where profiles.id = auth.uid()
    ) = 'admin'
  )
  with check (
    (
      select profiles.role
      from public.profiles
      where profiles.id = auth.uid()
    ) = 'admin'
  );

drop policy if exists commercial_packages_admin_all on public.commercial_packages;
create policy commercial_packages_admin_all
  on public.commercial_packages
  for all
  to authenticated
  using (
    (
      select profiles.role
      from public.profiles
      where profiles.id = auth.uid()
    ) = 'admin'
  )
  with check (
    (
      select profiles.role
      from public.profiles
      where profiles.id = auth.uid()
    ) = 'admin'
  );
