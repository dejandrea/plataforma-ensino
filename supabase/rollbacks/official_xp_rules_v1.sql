-- Manual rollback only before official credits or project writes have been used.
begin;
do $$ begin
 if exists(select 1 from public.xp_event_audit) or exists(select 1 from public.project_submissions where submitted_at>=(select starts_at from private.official_xp_policy where version=1))
  or exists(select 1 from public.project_submission_reviews where created_at>=(select starts_at from private.official_xp_policy where version=1)) then
  raise exception 'Rollback recusado: existem registros da politica oficial; preserve o historico e os identificadores.';
 end if;
end $$;
drop function public.teacher_project_inbox(uuid);
drop function public.review_student_project(uuid,text,numeric,text,uuid);
drop function public.submit_student_project(uuid,text,text,uuid);
drop trigger official_project_grade_xp on public.project_submission_reviews;
drop function private.award_project_grade_xp();
drop trigger official_project_submission_xp on public.project_submissions;
drop function private.award_project_submission_xp();
drop function private.official_project_kind(uuid);
drop trigger official_quiz_minimum on public.lesson_activities;
drop function private.require_four_quiz_questions();
drop trigger official_quiz_xp on public.quiz_attempts;
drop function private.award_first_quiz_xp();
drop trigger official_lesson_xp_context on public.student_xp_events;
drop function private.tag_official_lesson_xp();
drop trigger official_xp_receipt_guard on public.student_xp_events;
drop function private.guard_official_xp_receipt();
drop function private.learning_award_activity(uuid,uuid);
alter function private.learning_award_before_official_xp(uuid,uuid) rename to learning_award_activity;
drop function private.sync_student_xp(uuid);
alter function private.sync_student_before_official_xp(uuid) rename to sync_student_xp;
drop function private.sync_student_masteries(uuid);
alter function private.sync_masteries_before_official_xp(uuid) rename to sync_student_masteries;
drop trigger official_xp_audit on public.student_xp_events;
drop function private.audit_official_xp();
drop table public.xp_event_audit;
alter table public.project_submission_reviews drop column grade,drop column request_id;
alter table public.project_submissions drop column request_id;
drop trigger official_xp_rule_guard on public.xp_reward_rules;
drop function private.protect_official_xp_rules();
update public.xp_reward_rules r set points=(v->>'points')::integer from private.official_xp_policy p,
 lateral jsonb_array_elements(p.previous_rules) v where r.event_type=v->>'event_type';
delete from public.xp_reward_rules where event_type='project_evaluation';
alter table public.xp_reward_rules drop column calculation,drop column is_official,drop constraint xp_reward_rules_event_type_check;
alter table public.xp_reward_rules add constraint xp_reward_rules_event_type_check check(event_type in(
 'welcome','lesson','scheduled_lesson','module','course','evaluation','evaluation_star','activity_quiz','activity_interactive',
 'activity_study','activity_online','activity_project','activity_final_project','submodule_completion'));
do $$ declare r record; i integer;
begin
 for r in select version,document from private.learning_content_schemas loop
  for i in select ordinality::integer-1 from jsonb_array_elements(r.document#>'{properties,activities,items,oneOf}') with ordinality a(item,ordinality)
    where item#>>'{properties,type,const}'='quiz' loop
    update private.learning_content_schemas set document=jsonb_set(document,array['properties','activities','items','oneOf',i::text,'properties','content','properties','questions','minItems'],'1') where version=r.version;
  end loop;
 end loop;
end $$;
drop table private.official_xp_policy;
commit;
