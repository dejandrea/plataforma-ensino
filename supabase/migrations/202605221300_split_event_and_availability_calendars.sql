alter table public.teacher_calendar_settings
  add column if not exists event_calendar_ids text[] not null default '{}'::text[],
  add column if not exists event_calendar_names text[] not null default '{}'::text[],
  add column if not exists availability_calendar_ids text[] not null default '{}'::text[],
  add column if not exists availability_calendar_names text[] not null default '{}'::text[];

update public.teacher_calendar_settings
set
  event_calendar_ids = case
    when coalesce(array_length(event_calendar_ids, 1), 0) = 0
      then coalesce(sync_calendar_ids, case when calendar_id is not null then array[calendar_id] else '{}'::text[] end)
    else event_calendar_ids
  end,
  event_calendar_names = case
    when coalesce(array_length(event_calendar_names, 1), 0) = 0
      then coalesce(sync_calendar_names, case when calendar_name is not null then array[calendar_name] else '{}'::text[] end)
    else event_calendar_names
  end,
  availability_calendar_ids = case
    when coalesce(array_length(availability_calendar_ids, 1), 0) = 0
      then coalesce(sync_calendar_ids, case when calendar_id is not null then array[calendar_id] else '{}'::text[] end)
    else availability_calendar_ids
  end,
  availability_calendar_names = case
    when coalesce(array_length(availability_calendar_names, 1), 0) = 0
      then coalesce(sync_calendar_names, case when calendar_name is not null then array[calendar_name] else '{}'::text[] end)
    else availability_calendar_names
  end;
