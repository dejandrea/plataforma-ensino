begin;
set local lock_timeout = '5s';
-- NULL preserves the existing weekday/window rules until the teacher saves the new editor.
alter table public.teacher_calendar_settings
  add column availability_weekly_intervals jsonb,
  add constraint teacher_calendar_weekly_intervals_object
    check (availability_weekly_intervals is null or jsonb_typeof(availability_weekly_intervals) = 'object');
comment on column public.teacher_calendar_settings.availability_weekly_intervals is
  'Weekly intervals by ISO weekday 1..7: {"1":[{"start":"14:00","end":"20:00"}],"6":[{"start":"07:00","end":"12:00"}]}. Missing/empty days are closed; NULL uses legacy weekdays and global window.';
notify pgrst, 'reload schema';
commit;
