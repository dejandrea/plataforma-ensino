-- Containment before any v2 learner use or new authored activity.
-- Does not delete curriculum rows, histories, cohorts or XP. Keep the version
-- infrastructure installed: removing its predicates would expose planned rows.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table public.profiles,public.lessons,public.lesson_activities,public.submodules,
 public.student_progress,public.student_activity_progress,public.quiz_attempts,
 public.activity_attempt_sessions,public.project_submissions,public.student_xp_events,
 public.scheduled_lessons,public.lesson_plan_sessions,public.module_evaluations in share row exclusive mode;
do $rollback$
declare target constant uuid:='253477d3-e90d-42b8-88d8-a4a512418cf5'; state jsonb; item record;
begin
 select before_state into state from private.curriculum_migration_snapshots where key='html-basic-v2';
 if state is null then raise exception 'Snapshot da migração não encontrado.';end if;
 if exists(select 1 from public.lesson_activities a join public.lessons l on l.id=a.lesson_id where l.module_id=target and l.curriculum_version=2)
 or exists(
 select 1 from public.profiles p where p.role='student'
 and not exists(select 1 from private.student_curriculum_cohorts c where c.student_id=p.id and c.module_id=target and c.version=1)
 and (
 exists(select 1 from public.student_progress x join public.lessons l on l.id=x.lesson_id where x.student_id=p.id and l.module_id=target)
 or exists(select 1 from public.student_activity_progress x join public.lesson_activities a on a.id=x.activity_id join public.lessons l on l.id=a.lesson_id where x.student_id=p.id and l.module_id=target)
 or exists(select 1 from public.quiz_attempts x join public.lesson_activities a on a.id=x.activity_id join public.lessons l on l.id=a.lesson_id where x.student_id=p.id and l.module_id=target)
 or exists(select 1 from public.activity_attempt_sessions x join public.lesson_activities a on a.id=x.activity_id join public.lessons l on l.id=a.lesson_id where x.student_id=p.id and l.module_id=target)
 or exists(select 1 from public.project_submissions x join public.lesson_activities a on a.id=x.activity_id join public.lessons l on l.id=a.lesson_id where x.student_id=p.id and l.module_id=target)
 )) then
 raise exception 'A grade v2 já recebeu conteúdo ou uso. Preserve os registros e faça correção progressiva.' using errcode='23514';end if;
 update private.curriculum_releases set current_version=1 where module_id=target;
 for item in select value as e from jsonb_array_elements(state->'submodules') loop
 update public.submodules set title=item.e->>'title',description=item.e->>'description',
 order_index=(item.e->>'order_index')::double precision,is_active=(item.e->>'is_active')::boolean
 where id=(item.e->>'id')::uuid;
 end loop;
 update public.submodules set is_active=false where module_id=target
 and id not in(select (value->>'id')::uuid from jsonb_array_elements(state->'submodules'));
 for item in select value as e from jsonb_array_elements(state->'lessons') loop
 update public.lessons set curriculum_number=(item.e->>'curriculum_number')::integer where id=(item.e->>'id')::uuid;
 end loop;
end $rollback$;
notify pgrst,'reload schema';
commit;
