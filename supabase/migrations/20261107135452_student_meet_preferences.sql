-- Local proposal only. No backfill and no changes to scheduled_lessons.
begin;
alter table public.teacher_student_relations add column default_meet_link text
  check (default_meet_link is null or default_meet_link ~ '^https://meet[.]google[.]com/[a-z]{3}-[a-z]{4}-[a-z]{3}$');
create policy teacher_student_meet_admin_read on public.teacher_student_relations
for select to authenticated using (exists(select 1 from public.profiles p
  where p.id=(select auth.uid()) and p.role='admin' and p.is_active));
-- Do not add a generic UPDATE policy: some installations grant table-wide UPDATE.
-- The narrowly scoped RPC changes only this field and checks the actor again.
create schema if not exists private;
create function private.set_student_meet_link(p_teacher_id uuid,p_student_id uuid,p_link text)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles p
    where p.id=auth.uid() and p.is_active and (p.role='admin' or (p.role='professor' and p.id=p_teacher_id))) then
    raise exception 'Acesso não autorizado.' using errcode='42501';
  end if;
  update public.teacher_student_relations set default_meet_link=p_link
    where teacher_id=p_teacher_id and student_id=p_student_id;
  if not found then raise exception 'Vínculo não encontrado.' using errcode='23514';end if;
  return p_student_id;
end $$;
revoke all on function private.set_student_meet_link(uuid,uuid,text) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.set_student_meet_link(uuid,uuid,text) to authenticated;
create function public.set_student_meet_link(p_teacher_id uuid,p_student_id uuid,p_link text)
returns uuid language sql security invoker set search_path='' as $$
  select private.set_student_meet_link(p_teacher_id,p_student_id,p_link)
$$;
revoke all on function public.set_student_meet_link(uuid,uuid,text) from public,anon;
grant execute on function public.set_student_meet_link(uuid,uuid,text) to authenticated;
commit;
