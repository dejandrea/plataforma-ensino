-- Before use only. Never remove authored flashcards or review history.
begin;
lock table public.lesson_activities,private.flashcard_review_progress in share row exclusive mode;
do $$declare e record;begin
 if exists(select 1 from public.lesson_activities where activity_type='flashcards') or exists(select 1 from private.flashcard_review_progress) then
 raise exception 'Cartões já cadastrados ou revisados. Preserve os registros e faça correção progressiva.' using errcode='23514';end if;
 for e in select key,value from private.flashcards_installation_backup where key<>'schema' loop execute e.value#>>'{}';end loop;
end $$;
update private.learning_content_schemas set document=(select value from private.flashcards_installation_backup where key='schema') where version=2;
alter table public.lesson_activities drop constraint flashcards_unique_ids;
alter table public.lesson_activities drop constraint lesson_activities_activity_type_check;
alter table public.lesson_activities add constraint lesson_activities_activity_type_check check(activity_type in('slides','mindmap','quiz','online_lesson','project','interactive','video'));
drop function public.review_student_flashcard(uuid,text);
drop function public.student_flashcard_progress(uuid);
drop function private.review_student_flashcard(uuid,text);
drop function private.student_flashcard_progress(uuid);
drop function private.require_student_flashcards(uuid);
drop function private.flashcards_unique_ids(jsonb);
drop table private.flashcard_review_progress;
drop table private.flashcards_installation_backup;
notify pgrst,'reload schema';
commit;
