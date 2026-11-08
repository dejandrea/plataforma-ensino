-- Narrow prerequisite for the scheduling functions already integrated in main.
-- Do not apply the unrelated attendance-window changes from improvements_scheduling.
begin;
set local lock_timeout='5s';
alter table public.scheduled_lessons add column scheduling_request_id uuid;
create unique index scheduled_request_occurrence
  on public.scheduled_lessons(teacher_id,scheduling_request_id,recurrence_index)
  where scheduling_request_id is not null;
commit;
