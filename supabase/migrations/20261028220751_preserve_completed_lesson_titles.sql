-- Keep the subject edited in attendance reports across Google synchronizations.
-- Existing titles and all billing/XP behavior remain untouched.
begin;
set local lock_timeout='5s';
alter table public.scheduled_lessons add column title_customized boolean not null default false;

create function private.mark_completed_lesson_title() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if current_setting('role',true)='authenticated' and old.status='completed'
 and new.title is distinct from old.title then new.title_customized:=true;end if;
 return new;
end $$;
revoke all on function private.mark_completed_lesson_title() from public,anon,authenticated;
create trigger mark_completed_lesson_title before update of title on public.scheduled_lessons
 for each row execute function private.mark_completed_lesson_title();

-- Preserve the current service-only RPC's ACL, billing context and validations.
do $patch$
declare source text;needle constant text:='title=excluded.title';
begin
 source:=pg_get_functiondef('public.import_google_calendar_lessons(uuid,jsonb)'::regprocedure);
 if (length(source)-length(replace(source,needle,'')))/length(needle)<>1 then
  raise exception 'A função de importação do Google mudou; confira a versão antes de aplicar.';
 end if;
 execute replace(source,needle,'title=case when scheduled_lessons.title_customized or scheduled_lessons.status=''completed'' then scheduled_lessons.title else excluded.title end');
end $patch$;
notify pgrst,'reload schema';
commit;
