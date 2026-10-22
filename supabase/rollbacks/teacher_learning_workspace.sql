-- Manual rollback only before any curricular confirmation from etapa C.
begin;
do $$ begin
  if exists(select 1 from public.lesson_plan_sessions where confirmed_at is not null) then
    raise exception 'Rollback recusado: existem confirmacoes curriculares; preserve sua autoria e data.';
  end if;
end $$;
drop function public.confirm_teacher_learning_activity(uuid,integer);
drop function public.save_teacher_learning_session(uuid,integer,text[],text,jsonb);
drop function public.link_teacher_learning_activity(uuid,uuid);
drop function public.teacher_learning_workspace(uuid);
drop function private.learning_require_teacher_meeting(uuid);
alter table public.lesson_plan_sessions drop column confirmed_at,drop column confirmed_by,drop column version;
grant insert,update on public.lesson_plan_sessions to authenticated;
commit;
