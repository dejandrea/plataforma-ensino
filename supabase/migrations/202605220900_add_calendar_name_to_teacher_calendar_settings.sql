alter table public.teacher_calendar_settings
  add column if not exists calendar_name text;
