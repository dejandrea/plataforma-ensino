-- Manual only; authorization/backup required. Retains attempts/progress/XP, but
-- removes retry IDs and saved per-question feedback introduced by Etapa B.
begin;
drop function public.student_lesson_learning(uuid);
drop function public.complete_student_lesson(uuid);
drop function public.submit_student_quiz(uuid,jsonb,uuid);
drop function public.complete_student_study(uuid);
drop function public.start_student_activity(uuid);
drop trigger learning_sync_progress on public.student_activity_progress;
drop trigger learning_guard_lesson_completion on public.student_progress;
drop function private.learning_student_lesson(uuid);
drop function private.learning_complete_student_lesson(uuid);
drop function private.learning_submit_quiz(uuid,jsonb,uuid);
drop function private.learning_record_study(uuid,boolean);
drop function private.learning_sync_progress_trigger();
drop function private.learning_sync_lesson(uuid,uuid);
drop function private.learning_guard_lesson_completion();
drop function private.learning_lesson_ready(uuid,uuid);
drop function private.learning_prerequisites_complete(uuid,uuid);
drop function private.learning_require_student_lesson(uuid);
alter table public.quiz_attempts drop column request_id,drop column feedback_json;
commit;
