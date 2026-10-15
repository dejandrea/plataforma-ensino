create policy scheduled_lessons_manual_insert_guard
on public.scheduled_lessons as restrictive for insert to authenticated
with check (
  (status <> 'completed' and calendar_provider is distinct from 'manual')
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active
  )
);
