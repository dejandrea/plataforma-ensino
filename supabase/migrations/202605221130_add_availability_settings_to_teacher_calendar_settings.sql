alter table public.teacher_calendar_settings
  add column if not exists availability_weekdays integer[] not null default '{1,2,3,4,5}',
  add column if not exists availability_start_time text not null default '08:00',
  add column if not exists availability_end_time text not null default '18:00',
  add column if not exists availability_slot_minutes integer not null default 60,
  add column if not exists availability_horizon_days integer not null default 21;
