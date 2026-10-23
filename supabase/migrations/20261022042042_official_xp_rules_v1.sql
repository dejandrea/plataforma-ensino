begin;
-- Prospective policy: no recalculation of receipts earned before this migration.
create table private.official_xp_policy(version integer primary key, starts_at timestamptz not null,previous_rules jsonb not null);
insert into private.official_xp_policy select 1,clock_timestamp(),jsonb_agg(to_jsonb(r)) from public.xp_reward_rules r;
alter table private.official_xp_policy enable row level security;
revoke all on private.official_xp_policy from public,anon,authenticated;

alter table public.xp_reward_rules add column calculation text not null default 'fixed',add column is_official boolean not null default false;
alter table public.xp_reward_rules drop constraint xp_reward_rules_event_type_check;
alter table public.xp_reward_rules add constraint xp_reward_rules_event_type_check check(event_type in(
 'welcome','lesson','scheduled_lesson','module','course','evaluation','evaluation_star','activity_quiz','activity_interactive',
 'activity_study','activity_online','activity_project','activity_final_project','submodule_completion','project_evaluation'));
update public.xp_reward_rules set points=case event_type when 'activity_study' then 10 when 'activity_interactive' then 15 when 'activity_online' then 15
  when 'activity_project' then 50 when 'activity_final_project' then 100 when 'lesson' then 50 when 'activity_quiz' then 100 end,
  is_official=true,calculation=case when event_type='activity_quiz' then 'first_quiz_score' else 'fixed' end
where event_type in ('activity_study','activity_interactive','activity_online','activity_project','activity_final_project','lesson','activity_quiz');
insert into public.xp_reward_rules(event_type,points,calculation,is_official) values('project_evaluation',100,'project_grade',true);
create function private.protect_official_xp_rules() returns trigger language plpgsql set search_path='' as $$
begin
  if old.is_official and new is distinct from old then raise exception 'Regra oficial de XP protegida; alteracoes exigem nova versao da politica.' using errcode='42501'; end if;
  return new;
end $$;
revoke all on function private.protect_official_xp_rules() from public,anon,authenticated;
create trigger official_xp_rule_guard before update on public.xp_reward_rules for each row execute function private.protect_official_xp_rules();

alter table public.project_submissions add column request_id uuid not null default gen_random_uuid(),add constraint project_submission_request_unique unique(student_id,activity_id,request_id);
alter table public.project_submission_reviews add column grade numeric(5,2) check(grade between 0 and 100),
  add column request_id uuid not null default gen_random_uuid(),add constraint project_review_request_unique unique(reviewed_by,request_id);

create table public.xp_event_audit(
 id uuid primary key default gen_random_uuid(),student_id uuid not null references public.profiles(id) on delete restrict,
 event_type text not null,source_id uuid not null,previous_points integer,new_points integer not null,
 reward_context jsonb not null,changed_by uuid references public.profiles(id) on delete restrict,changed_at timestamptz not null default clock_timestamp());
create index xp_event_audit_student on public.xp_event_audit(student_id,changed_at desc);
create index xp_event_audit_actor on public.xp_event_audit(changed_by);
alter table public.xp_event_audit enable row level security;
revoke all on public.xp_event_audit from public,anon,authenticated;
grant select on public.xp_event_audit to authenticated;
create policy xp_event_audit_read on public.xp_event_audit for select to authenticated using(
 student_id=auth.uid() or private.learning_role()='admin');
create trigger xp_event_audit_immutable before update or delete on public.xp_event_audit for each row execute function private.learning_reject_history_change();
create function private.audit_official_xp() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.reward_context->>'policyVersion'='1' and (tg_op='INSERT' or new.points is distinct from old.points or new.reward_context is distinct from old.reward_context) then
  insert into public.xp_event_audit(student_id,event_type,source_id,previous_points,new_points,reward_context,changed_by)
  values(new.student_id,new.event_type,new.source_id,case when tg_op='UPDATE' then old.points end,new.points,new.reward_context,auth.uid());
 end if;
 return null;
end $$;
revoke all on function private.audit_official_xp() from public,anon,authenticated;
create trigger official_xp_audit after insert or update on public.student_xp_events for each row execute function private.audit_official_xp();

-- Reuse the existing balance/level/mastery pipeline; keep project receipts active
-- after the legacy synchronizer resets derived events.
alter function private.sync_student_masteries(uuid) rename to sync_masteries_before_official_xp;
create function private.sync_student_masteries(p_student_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.sync_masteries_before_official_xp(p_student_id);
 -- A failed first quiz may earn XP, but completion badges still require approval.
 insert into public.student_achievements(student_id,code)
 select distinct p_student_id,code from public.student_xp_events e join public.lesson_activities a on a.id=e.source_id
 cross join lateral jsonb_array_elements_text(coalesce(a.gamification_json->'achievementKeys','[]')) code
 where e.student_id=p_student_id and e.active and e.reward_context->>'policyVersion'='1'
 and ((a.activity_type='quiz' and e.event_type='learning_activity' and exists(select 1 from public.quiz_attempts q where q.student_id=p_student_id and q.activity_id=a.id and q.passed))
 or (a.activity_type='project' and e.event_type='project_evaluation' and exists(select 1 from public.project_submissions s join public.project_submission_reviews r on r.submission_id=s.id where s.student_id=p_student_id and s.activity_id=a.id and r.status='approved')))
 on conflict(student_id,code) do update set active=true;
end $$;
revoke all on function private.sync_student_masteries(uuid) from public,anon,authenticated;
alter function private.sync_student_xp(uuid) rename to sync_student_before_official_xp;
create function private.sync_student_xp(p_student_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.sync_student_before_official_xp(p_student_id);
 update public.student_xp_events set active=true where student_id=p_student_id and event_type in ('project_submission','project_evaluation');
 update public.profiles set xp_points=(select coalesce(sum(points),0)::integer from public.student_xp_events where student_id=p_student_id and active) where id=p_student_id;
 perform private.sync_student_masteries(p_student_id);
end $$;
revoke all on function private.sync_student_xp(uuid) from public,anon,authenticated;

-- A fixed receipt per activity, including v1 content without gamification metadata.
alter function private.learning_award_activity(uuid,uuid) rename to learning_award_before_official_xp;
create function private.learning_award_activity(p_student_id uuid,p_activity_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare a public.lesson_activities; rule text; points integer;
begin
 perform 1 from public.profiles where id=p_student_id and role='student' and is_active for update;
 if not found then return; end if;
 select * into a from public.lesson_activities where id=p_activity_id;
 if not found or not exists(select 1 from public.student_activity_progress where student_id=p_student_id and activity_id=a.id and status='completed' and activity_revision=a.revision) then return; end if;
 if a.activity_type in ('quiz','project') then perform private.sync_student_masteries(p_student_id);return; end if;
 if a.activity_type='online_lesson' and not exists(select 1 from public.lesson_plan_sessions s join public.scheduled_lessons m on m.id=s.scheduled_lesson_id
   where s.activity_id=a.id and s.confirmed_at is not null and m.student_id=p_student_id) then return; end if;
 rule:=case a.activity_type when 'slides' then 'activity_study' when 'mindmap' then 'activity_study' when 'interactive' then 'activity_interactive' else 'activity_online' end;
 select r.points into points from public.xp_reward_rules r where r.event_type=rule;
 insert into public.student_xp_events(student_id,event_type,source_id,title,points,reward_context)
 values(p_student_id,'learning_activity',a.id,a.title,points,a.gamification_json||jsonb_build_object('policyVersion',1,'rewardRuleKey',rule,'activityType',a.activity_type,'activityRevision',a.revision)) on conflict do nothing;
 perform private.sync_student_xp(p_student_id);
end $$;

revoke all on function private.learning_award_activity(uuid,uuid) from public,anon,authenticated;

create function private.guard_official_xp_receipt() returns trigger language plpgsql set search_path='' as $$
begin
 if old.event_type='project_submission' and (tg_op='DELETE' or (to_jsonb(new)-'active') is distinct from (to_jsonb(old)-'active')) then
  raise exception 'Recibo de envio imutavel.' using errcode='23514';
 end if;
 if old.event_type='project_evaluation' and (tg_op='DELETE' or (to_jsonb(new)-array['active','points','reward_context']) is distinct from (to_jsonb(old)-array['active','points','reward_context'])) then
  raise exception 'Recibo de avaliacao protegido.' using errcode='23514';
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
revoke all on function private.guard_official_xp_receipt() from public,anon,authenticated;
create trigger official_xp_receipt_guard before update or delete on public.student_xp_events for each row execute function private.guard_official_xp_receipt();
create function private.tag_official_lesson_xp() returns trigger language plpgsql set search_path='' as $$
begin
 if new.event_type='lesson' then new.reward_context:=new.reward_context||jsonb_build_object('policyVersion',1,'rewardRuleKey','lesson'); end if;
 return new;
end $$;
revoke all on function private.tag_official_lesson_xp() from public,anon,authenticated;
create trigger official_lesson_xp_context before insert on public.student_xp_events for each row execute function private.tag_official_lesson_xp();

-- Quiz points are independent of approval. Only the first *submitted* attempt
-- counts; a zero-point receipt also consumes the one-time award.
create function private.award_first_quiz_xp() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.lesson_activities;
begin
 if new.activity_type<>'quiz' or new.attempt_number<>1 then return null; end if;
 perform 1 from public.profiles where id=new.student_id for update;
 select * into a from public.lesson_activities where id=new.activity_id;
 insert into public.student_xp_events(student_id,event_type,source_id,title,points,reward_context)
 values(new.student_id,'learning_activity',a.id,a.title,round(new.score)::integer,a.gamification_json||jsonb_build_object('achievementKeys','[]'::jsonb,'policyVersion',1,'rewardRuleKey','activity_quiz','attemptId',new.id,'score',new.score,'activityRevision',a.revision)) on conflict do nothing;
 perform private.sync_student_xp(new.student_id);
 return null;
end $$;
revoke all on function private.award_first_quiz_xp() from public,anon,authenticated;
create trigger official_quiz_xp after insert on public.quiz_attempts for each row execute function private.award_first_quiz_xp();

-- Existing published quizzes retain their historical content. New definitions,
-- imports and publication require at least four questions, in both v1 and v2.
create function private.require_four_quiz_questions() returns trigger language plpgsql set search_path='' as $$
begin
 if new.activity_type='quiz' and (tg_op='INSERT' or old.published_at is null) and coalesce(jsonb_array_length(new.content_json->'questions'),0)<4 then
  raise exception 'Questionarios novos exigem pelo menos 4 perguntas.' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function private.require_four_quiz_questions() from public,anon,authenticated;
create trigger official_quiz_minimum before insert or update on public.lesson_activities for each row execute function private.require_four_quiz_questions();
do $$ declare r record; i integer;
begin
 for r in select version,document from private.learning_content_schemas loop
  for i in select ordinality::integer-1 from jsonb_array_elements(r.document#>'{properties,activities,items,oneOf}') with ordinality a(item,ordinality)
    where item#>>'{properties,type,const}'='quiz' loop
    update private.learning_content_schemas set document=jsonb_set(document,array['properties','activities','items','oneOf',i::text,'properties','content','properties','questions','minItems'],'4') where version=r.version;
  end loop;
 end loop;
end $$;

create function private.official_project_kind(p_activity uuid) returns text language sql stable security definer set search_path='' as $$
 select case when gamification_json->>'rewardRuleKey'='activity_final_project' then 'project' else 'mini_project' end from public.lesson_activities where id=p_activity and activity_type='project';
$$;
revoke all on function private.official_project_kind(uuid) from public,anon,authenticated;

create function private.award_project_submission_xp() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.lesson_activities; kind text; points integer;
begin
 perform 1 from public.profiles where id=new.student_id for update;
 -- Existing versions/legacy approval receipts must never be rewarded a second time.
 if new.version<>1 or exists(select 1 from public.student_xp_events where student_id=new.student_id and event_type='learning_activity' and source_id=new.activity_id) then return null; end if;
 select * into a from public.lesson_activities where id=new.activity_id;
 kind:=private.official_project_kind(a.id);
 select r.points into points from public.xp_reward_rules r where r.event_type=case kind when 'project' then 'activity_final_project' else 'activity_project' end;
 insert into public.student_xp_events(student_id,event_type,source_id,title,points,reward_context)
 values(new.student_id,'project_submission',a.id,a.title,points,jsonb_build_object('policyVersion',1,'projectKind',kind,'submissionId',new.id,'activityRevision',a.revision)) on conflict do nothing;
 perform private.sync_student_xp(new.student_id);
 return null;
end $$;
revoke all on function private.award_project_submission_xp() from public,anon,authenticated;
create trigger official_project_submission_xp after insert on public.project_submissions for each row execute function private.award_project_submission_xp();

create function private.award_project_grade_xp() returns trigger language plpgsql security definer set search_path='' as $$
declare submission public.project_submissions; a public.lesson_activities;
begin
 if new.grade is null then return null; end if;
 select * into submission from public.project_submissions where id=new.submission_id;
 perform 1 from public.profiles where id=submission.student_id for update;
 if not exists(select 1 from public.profiles reviewer where reviewer.id=new.reviewed_by and reviewer.is_active and (reviewer.role='admin' or (reviewer.role='professor' and exists(
   select 1 from public.teacher_student_relations where teacher_id=reviewer.id and student_id=submission.student_id)))) then raise exception 'Avaliadora nao autorizada.' using errcode='42501'; end if;
 if exists(select 1 from public.student_xp_events where student_id=submission.student_id and event_type='learning_activity' and source_id=submission.activity_id) then return null; end if;
 select * into a from public.lesson_activities where id=submission.activity_id;
 insert into public.student_xp_events(student_id,event_type,source_id,title,points,reward_context)
 values(submission.student_id,'project_evaluation',a.id,a.title,round(new.grade)::integer,jsonb_build_object('policyVersion',1,'projectKind',private.official_project_kind(a.id),'reviewId',new.id,'submissionId',submission.id,'grade',new.grade,'reviewedBy',new.reviewed_by))
 on conflict(student_id,event_type,source_id) do update set points=excluded.points,reward_context=excluded.reward_context;
 perform private.sync_student_xp(submission.student_id);
 return null;
end $$;
revoke all on function private.award_project_grade_xp() from public,anon,authenticated;
create trigger official_project_grade_xp after insert on public.project_submission_reviews for each row execute function private.award_project_grade_xp();

create function public.submit_student_project(p_activity_id uuid,p_submission_url text,p_student_notes text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.lesson_activities; previous public.project_submissions; submitted public.project_submissions; next_version integer; latest_status text;
begin
 if private.learning_role() is distinct from 'student' then raise exception 'Entre com uma conta de aluno ativa.' using errcode='42501'; end if;
 perform 1 from public.profiles where id=auth.uid() and is_active for update;
 select * into a from public.lesson_activities where id=p_activity_id and activity_type='project' and is_active and publication_status='published' for share;
 if not found then raise exception 'Projeto indisponivel.' using errcode='42501'; end if;
 perform private.learning_require_student_lesson(a.lesson_id);
 if p_request_id is null or p_submission_url is null or p_submission_url !~ '^https://[^[:space:]]+$' or length(p_submission_url)>2048 or p_student_notes is null or length(p_student_notes)>20000 then raise exception 'Informe um link HTTPS valido e uma identificacao de envio.' using errcode='22023'; end if;
 select * into previous from public.project_submissions where student_id=auth.uid() and activity_id=a.id and request_id=p_request_id;
 if found then
  if previous.submission_url<>p_submission_url or previous.student_notes<>p_student_notes then raise exception 'Identificador ja usado em outro envio.' using errcode='22023'; end if;
  return to_jsonb(previous);
 end if;
 if not private.learning_prerequisites_complete(auth.uid(),a.id) then raise exception 'Conclua os pre-requisitos.' using errcode='23514'; end if;
 select * into previous from public.project_submissions where student_id=auth.uid() and activity_id=a.id order by version desc limit 1;
 if found then
  select status into latest_status from public.project_submission_reviews where submission_id=previous.id order by created_at desc,id desc limit 1;
  if latest_status is distinct from 'needs_revision' then raise exception 'Aguarde a avaliacao; reenvio permitido apos solicitacao de ajustes.' using errcode='23514'; end if;
 end if;
 next_version:=coalesce(previous.version,0)+1;
 insert into public.project_submissions(student_id,activity_id,activity_revision,version,submission_url,student_notes,request_id)
 values(auth.uid(),a.id,a.revision,next_version,p_submission_url,p_student_notes,p_request_id) returning * into submitted;
 insert into public.student_activity_progress(student_id,activity_id,activity_revision,status,started_at)
 values(auth.uid(),a.id,a.revision,'pending_review',now()) on conflict(student_id,activity_id) do update set status='pending_review',completed_at=null,started_at=coalesce(public.student_activity_progress.started_at,now()),updated_at=now();
 return to_jsonb(submitted);
end $$;

create function public.review_student_project(p_submission_id uuid,p_status text,p_grade numeric,p_feedback text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.project_submissions; review public.project_submission_reviews; previous public.project_submission_reviews;
begin
 select * into s from public.project_submissions where id=p_submission_id;
 if not found or not coalesce(private.learning_manages_student(s.student_id),false) then raise exception 'Entrega indisponivel para esta conta.' using errcode='42501'; end if;
 perform 1 from public.profiles where id=s.student_id for update;
 if not private.learning_manages_student(s.student_id) then raise exception 'Avaliadora nao autorizada.' using errcode='42501'; end if;
 if p_request_id is null or p_status not in ('in_review','needs_revision','approved') or p_status is null or p_feedback is null or length(p_feedback)>20000
   or (p_grade is not null and (p_grade<0 or p_grade>100 or p_grade<>round(p_grade,2))) or (p_status='approved' and p_grade is null) then raise exception 'Avaliacao invalida; informe nota entre 0 e 100 para aprovar.' using errcode='22023'; end if;
 select * into previous from public.project_submission_reviews where reviewed_by=auth.uid() and request_id=p_request_id;
 if found then
  if (previous.submission_id,previous.status,previous.grade,previous.teacher_feedback) is distinct from (p_submission_id,p_status,p_grade,p_feedback) then raise exception 'Identificador ja usado em outra avaliacao.' using errcode='22023'; end if;
  return to_jsonb(previous);
 end if;
 if s.version<>(select max(version) from public.project_submissions where student_id=s.student_id and activity_id=s.activity_id) then raise exception 'Avalie a versao mais recente do projeto.' using errcode='23514'; end if;
 -- A transaction may have started before waiting for the student's lock.
 -- Keep review order consistent with the serialized final-grade decision.
 insert into public.project_submission_reviews(submission_id,reviewed_by,status,grade,teacher_feedback,request_id,created_at)
 values(s.id,auth.uid(),p_status,p_grade,p_feedback,p_request_id,greatest(clock_timestamp(),coalesce((
   select max(r.created_at)+interval '1 microsecond' from public.project_submission_reviews r join public.project_submissions prior on prior.id=r.submission_id
   where prior.student_id=s.student_id and prior.activity_id=s.activity_id),'-infinity'::timestamptz))) returning * into review;
 insert into public.student_activity_progress(student_id,activity_id,activity_revision,status,started_at,completed_at)
 values(s.student_id,s.activity_id,s.activity_revision,case p_status when 'approved' then 'completed' when 'needs_revision' then 'needs_revision' else 'pending_review' end,now(),case when p_status='approved' then now() end)
 on conflict(student_id,activity_id) do update set status=excluded.status,started_at=coalesce(public.student_activity_progress.started_at,now()),completed_at=excluded.completed_at,updated_at=now();
 return to_jsonb(review);
end $$;

create function public.teacher_project_inbox(p_scheduled_lesson_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare student uuid;
begin
 perform private.learning_require_teacher_meeting(p_scheduled_lesson_id);
 select student_id into student from public.scheduled_lessons where id=p_scheduled_lesson_id;
 return coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('title',a.title,'project_kind',private.official_project_kind(a.id),
 'reviews',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at,r.id) from public.project_submission_reviews r where r.submission_id=s.id),'[]'::jsonb)) order by s.submitted_at desc)
 from public.project_submissions s join public.lesson_activities a on a.id=s.activity_id where s.student_id=student
 and s.version=(select max(version) from public.project_submissions where student_id=student and activity_id=s.activity_id)),'[]'::jsonb);
end $$;
revoke all on function public.submit_student_project(uuid,text,text,uuid),public.review_student_project(uuid,text,numeric,text,uuid),public.teacher_project_inbox(uuid) from public,anon;
grant execute on function public.submit_student_project(uuid,text,text,uuid),public.review_student_project(uuid,text,numeric,text,uuid),public.teacher_project_inbox(uuid) to authenticated;
commit;
