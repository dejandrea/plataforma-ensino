-- Auditoria HTML Básico v2.0: somente leitura, sem chamar RPCs de negócio.
-- Executar com acesso administrativo de leitura, não distribuir credenciais.
-- IDs confirmados em produção em 26/10/2026; revisar se o destino for outro banco.
begin transaction isolation level repeatable read read only;

select current_timestamp as collected_at,
  'gnyiyhnbpjhdgrhsevbh' as expected_project,
  '253477d3-e90d-42b8-88d8-a4a512418cf5'::uuid as target_module;

select c.id course_id,c.title course_title,c.is_active course_active,
 m.id module_id,m.title module_title,m.order_index module_order,m.is_active module_active,
 s.id submodule_id,s.title submodule_title,s.order_index submodule_order,s.is_active submodule_active,
 l.id lesson_id,l.title lesson_title,l.order_index lesson_order,l.module_id direct_module_id,
 l.duration_minutes
from public.courses c join public.modules m on m.course_id=c.id
left join public.submodules s on s.module_id=m.id
left join public.lessons l on l.submodule_id=s.id
where c.id='6fada12b-4073-40ce-9bfb-e5ecfc2c453d'
order by m.order_index,m.id,s.order_index,s.id,l.order_index,l.id;

select l.id,l.title,l.module_id,l.submodule_id
from public.lessons l
where l.module_id in(select id from public.modules where course_id='6fada12b-4073-40ce-9bfb-e5ecfc2c453d')
 and (l.submodule_id is null or not exists(
 select 1 from public.submodules s where s.id=l.submodule_id and s.module_id=l.module_id));

select a.id,a.lesson_id,a.key,a.title,a.activity_type,a.order_index,a.is_required,
 a.is_active,a.publication_status,a.revision,a.gamification_json,
 case when a.activity_type='quiz' then jsonb_array_length(coalesce(a.content_json->'questions','[]'::jsonb)) end as question_count,
 case when a.activity_type='interactive' then a.content_json->>'interactionType' end as interactive_subtype
from public.lesson_activities a join public.lessons l on l.id=a.lesson_id
where l.module_id='253477d3-e90d-42b8-88d8-a4a512418cf5'
order by a.lesson_id,a.order_index;

with target_lessons as (
 select l.id from public.lessons l left join public.submodules s on s.id=l.submodule_id
 where l.module_id='253477d3-e90d-42b8-88d8-a4a512418cf5'
 or s.module_id='253477d3-e90d-42b8-88d8-a4a512418cf5'
), a as(select id from public.lesson_activities where lesson_id in(select id from target_lessons))
select jsonb_build_object(
 'legacy_enrollments',(select count(*) from public.student_courses where course_id='6fada12b-4073-40ce-9bfb-e5ecfc2c453d'),
 'eligible_active_students',(select count(*) from public.profiles where role='student' and is_active and student_service_scope in('course','both')),
 'lesson_progress',(select count(*) from public.student_progress where lesson_id in(select id from target_lessons)),
 'completed_lessons',(select count(*) from public.student_progress where lesson_id in(select id from target_lessons) and completed_at is not null),
 'activity_progress',(select count(*) from public.student_activity_progress where activity_id in(select id from a)),
 'quiz_attempts',(select count(*) from public.quiz_attempts where activity_id in(select id from a)),
 'attempt_sessions',(select count(*) from public.activity_attempt_sessions where activity_id in(select id from a)),
 'project_submissions',(select count(*) from public.project_submissions where activity_id in(select id from a)),
 'project_reviews',(select count(*) from public.project_submission_reviews where submission_id in(select id from public.project_submissions where activity_id in(select id from a))),
 'teacher_plans',(select count(*) from public.teacher_lesson_plans where activity_id in(select id from a)),
 'teacher_sessions',(select count(*) from public.lesson_plan_sessions where activity_id in(select id from a)),
 'module_evaluations',(select count(*) from public.module_evaluations where module_id='253477d3-e90d-42b8-88d8-a4a512418cf5'),
 'all_achievements',(select count(*) from public.student_achievements)
) as counts;

select p.activity_id,p.prerequisite_activity_id
from public.activity_prerequisites p
where exists(select 1 from public.lesson_activities a join public.lessons l on l.id=a.lesson_id
 where l.module_id='253477d3-e90d-42b8-88d8-a4a512418cf5'
 and a.id in(p.activity_id,p.prerequisite_activity_id));

with sources as (
 select '253477d3-e90d-42b8-88d8-a4a512418cf5'::uuid as id
 union select '6fada12b-4073-40ce-9bfb-e5ecfc2c453d'::uuid
 union select id from public.submodules where module_id='253477d3-e90d-42b8-88d8-a4a512418cf5'
 union select id from public.lessons where module_id='253477d3-e90d-42b8-88d8-a4a512418cf5'
 union select a.id from public.lesson_activities a join public.lessons l on l.id=a.lesson_id
 where l.module_id='253477d3-e90d-42b8-88d8-a4a512418cf5'
)
select event_type,source_id,active,count(*) as receipts,sum(points) as points
from public.student_xp_events where source_id in(select id from sources)
group by event_type,source_id,active order by event_type,source_id,active;

select event_type,points from public.xp_reward_rules order by event_type;

select conrelid::regclass::text as source,conname,pg_get_constraintdef(oid) as definition
from pg_constraint where contype='f'
and confrelid in('public.lessons'::regclass,'public.submodules'::regclass,
 'public.modules'::regclass,'public.lesson_activities'::regclass)
order by 1,2;

select n.nspname,p.proname,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='private' and p.proname in(
 'student_curriculum_status','learning_complete_student_lesson','learning_guard_lesson_completion',
 'learning_award_submodule','sync_student_xp','sync_student_before_official_xp',
 'sync_student_pre_learning_xp','sync_student_base_xp','refresh_student_xp_trigger'))
or (n.nspname='public' and p.proname='validate_evaluation_student_course')
order by 1,2;

rollback;
