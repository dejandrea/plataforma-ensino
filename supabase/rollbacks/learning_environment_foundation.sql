-- MANUAL ONLY. Never placed under migrations; never run against production
-- without explicit authorization, a backup and review of later dependencies.
-- Destructive: removes all new learning content and history. Does not undo
-- legacy curriculum data or delete the shared private schema.
begin;
drop table public.lesson_plan_sessions;
drop table public.project_submission_reviews;
drop table public.project_submissions;
drop table public.quiz_attempts;
drop table public.student_activity_progress;
drop table public.teacher_lesson_plans;
drop table public.activity_quiz_keys;
drop table public.activity_prerequisites;
drop table public.lesson_learning_metadata;
drop table public.lesson_activities;
drop trigger learning_guard_profile_access on public.profiles;
drop function private.learning_guard_profile_access();
drop function private.learning_guard_session();
drop function private.learning_guard_activity();
drop function private.learning_guard_prerequisite();
drop function private.learning_guard_quiz_key();
drop function private.learning_reject_history_change();
drop function private.learning_touch_progress();
drop function private.learning_can_manage_session(uuid);
drop function private.learning_can_read_activity(uuid);
drop function private.learning_public_content_valid(text,jsonb);
drop function private.learning_manages_student(uuid);
drop function private.learning_role();
commit;
