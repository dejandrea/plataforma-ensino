alter table public.teacher_calendar_settings
  add column if not exists sync_calendar_ids text[] not null default '{}',
  add column if not exists sync_calendar_names text[] not null default '{}';
