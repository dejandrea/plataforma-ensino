create table if not exists public.teacher_calendar_settings (
  teacher_id uuid primary key references public.profiles (id) on delete cascade,
  provider text not null default 'google_calendar',
  provider_account_email text,
  calendar_id text,
  booking_page_url text,
  timezone text,
  sync_mode text not null default 'booking_link' check (sync_mode in ('booking_link', 'calendar_sync')),
  auto_create_meet boolean not null default true,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.teacher_calendar_settings enable row level security;

drop policy if exists teacher_calendar_settings_admin_all on public.teacher_calendar_settings;
create policy teacher_calendar_settings_admin_all
  on public.teacher_calendar_settings
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

drop policy if exists teacher_calendar_settings_teacher_select on public.teacher_calendar_settings;
create policy teacher_calendar_settings_teacher_select
  on public.teacher_calendar_settings
  for select
  to authenticated
  using (teacher_id = auth.uid());

drop policy if exists teacher_calendar_settings_student_select on public.teacher_calendar_settings;
create policy teacher_calendar_settings_student_select
  on public.teacher_calendar_settings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.teacher_student_relations relations
      where relations.teacher_id = teacher_calendar_settings.teacher_id
        and relations.student_id = auth.uid()
    )
  );

drop policy if exists teacher_calendar_settings_teacher_insert on public.teacher_calendar_settings;
create policy teacher_calendar_settings_teacher_insert
  on public.teacher_calendar_settings
  for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and (
      select profiles.role
      from public.profiles
      where profiles.id = auth.uid()
    ) in ('admin', 'professor')
  );

drop policy if exists teacher_calendar_settings_teacher_update on public.teacher_calendar_settings;
create policy teacher_calendar_settings_teacher_update
  on public.teacher_calendar_settings
  for update
  to authenticated
  using (
    teacher_id = auth.uid()
    and (
      select profiles.role
      from public.profiles
      where profiles.id = auth.uid()
    ) in ('admin', 'professor')
  )
  with check (
    teacher_id = auth.uid()
    and (
      select profiles.role
      from public.profiles
      where profiles.id = auth.uid()
    ) in ('admin', 'professor')
  );
