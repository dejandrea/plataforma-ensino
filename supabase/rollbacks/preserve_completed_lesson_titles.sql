-- Refuse to remove the customization marker once it protects an edited title.
begin;
lock table public.scheduled_lessons in share row exclusive mode;
do $rollback$
declare source text;needle constant text:='title=case when scheduled_lessons.title_customized or scheduled_lessons.status=''completed'' then scheduled_lessons.title else excluded.title end';
begin
 if exists(select 1 from public.scheduled_lessons where title_customized) then
 raise exception 'Existem assuntos personalizados; preserve a proteção e faça correção progressiva.';end if;
 source:=pg_get_functiondef('public.import_google_calendar_lessons(uuid,jsonb)'::regprocedure);
 if (length(source)-length(replace(source,needle,'')))/length(needle)<>1 then raise exception 'Importação divergente da versão esperada.';end if;
 execute replace(source,needle,'title=excluded.title');
end $rollback$;
drop trigger mark_completed_lesson_title on public.scheduled_lessons;
drop function private.mark_completed_lesson_title();
alter table public.scheduled_lessons drop column title_customized;
notify pgrst,'reload schema';
commit;
