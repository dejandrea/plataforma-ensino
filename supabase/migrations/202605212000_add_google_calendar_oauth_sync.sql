create table if not exists public.teacher_google_calendar_tokens (
  teacher_id uuid primary key references public.profiles (id) on delete cascade,
  provider_account_email text,
  access_token text,
  refresh_token text,
  token_type text,
  scope text,
  expires_at timestamp with time zone,
  oauth_state text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.teacher_google_calendar_tokens enable row level security;

drop policy if exists teacher_google_calendar_tokens_admin_all on public.teacher_google_calendar_tokens;
create policy teacher_google_calendar_tokens_admin_all
  on public.teacher_google_calendar_tokens
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

alter table public.teacher_calendar_settings
  add column if not exists connection_status text not null default 'disconnected'
    check (connection_status in ('disconnected', 'pending', 'connected', 'error')),
  add column if not exists last_synced_at timestamp with time zone,
  add column if not exists last_sync_error text;

create unique index if not exists idx_scheduled_lessons_google_event
  on public.scheduled_lessons (teacher_id, calendar_provider, calendar_event_id);
