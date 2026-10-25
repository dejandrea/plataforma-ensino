-- Video activities extend v2; existing content, progress and receipts are untouched.
-- Apply in production only with explicit authorization.
begin;
update private.learning_content_schemas
set document=jsonb_set(document,'{properties,activities,items,oneOf}',
  (document#>'{properties,activities,items,oneOf}') || $video${"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"type":{"const":"video"},"title":{"type":"string","minLength":1,"maxLength":20000},"description":{"type":"string","minLength":1,"maxLength":20000},"orderIndex":{"type":"integer","minimum":0,"maximum":100000},"durationMinutes":{"type":"integer","minimum":1,"maximum":1440},"required":{"type":"boolean"},"prerequisites":{"type":"array","items":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"minItems":0,"maxItems":200,"uniqueItems":true},"content":{"type":"object","properties":{"schemaVersion":{"const":2},"type":{"const":"video"},"resourceUrl":{"type":"string","format":"uri","maxLength":2048,"pattern":"^https://drive\\.google\\.com/(file/(u/[0-9]+/)?d/[a-zA-Z0-9_-]+(/(view|preview|edit))?/?(\\?[^\\s#]*)?|(open|uc)\\?([^\\s#]*&)?id=[a-zA-Z0-9_-]+(&[^\\s#]*)?)(#[^\\s]*)?$"}},"required":["schemaVersion","type","resourceUrl"],"additionalProperties":false},"gamification":{"type":"object","properties":{"rewardRuleKey":{"enum":["activity_quiz","activity_interactive","activity_study","activity_online","activity_project","activity_final_project"]},"awardOn":{"enum":["completed","teacher_confirmed","approved"]},"achievementKeys":{"type":"array","items":{"type":"string","pattern":"^custom:[a-zA-Z0-9_-]{1,90}$"},"minItems":0,"maxItems":20,"uniqueItems":true}},"required":["rewardRuleKey","awardOn","achievementKeys"],"additionalProperties":false}},"required":["key","type","title","orderIndex","required","prerequisites","content"],"additionalProperties":false}$video$::jsonb)
where version=2 and not exists(
  select 1 from jsonb_array_elements(document#>'{properties,activities,items,oneOf}') variant
  where variant#>>'{properties,type,const}'='video');

alter table public.lesson_activities drop constraint lesson_activities_activity_type_check;
alter table public.lesson_activities add constraint lesson_activities_activity_type_check
  check(activity_type in ('slides','mindmap','quiz','online_lesson','project','interactive','video'));

create or replace function private.learning_validate_reward(kind text,g jsonb) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare spec jsonb; rule text;
begin
 if g='{}' then return true; end if;
 select document->'properties'->'activities'->'items'->'oneOf'->0->'properties'->'gamification' into spec from private.learning_content_schemas where version=2;
 if not private.learning_json_matches(spec,g) then return false; end if;
 rule:=g->>'rewardRuleKey';
 return (case kind when 'quiz' then rule='activity_quiz' when 'interactive' then rule='activity_interactive'
   when 'slides' then rule='activity_study' when 'mindmap' then rule='activity_study' when 'video' then rule='activity_study'
   when 'online_lesson' then rule='activity_online' when 'project' then rule in ('activity_project','activity_final_project') else false end)
   and g->>'awardOn'=case kind when 'project' then 'approved' when 'online_lesson' then 'teacher_confirmed' else 'completed' end
   and exists(select 1 from public.xp_reward_rules where event_type=rule)
   and not exists(select 1 from jsonb_array_elements_text(g->'achievementKeys') codes(value)
     where not exists(select 1 from public.achievement_definitions d where d.code=codes.value and d.is_custom));
end $$;

create or replace function private.learning_record_study(p_activity_id uuid,p_complete boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.lesson_activities; progress public.student_activity_progress;
begin
  if auth.uid() is null or private.learning_role() is distinct from 'student' then
    raise exception 'Entre com uma conta de aluno ativa.' using errcode='42501';
  end if;
  perform 1 from public.profiles where id=auth.uid() and is_active and role='student' for update;
  if not found then raise exception 'Entre com uma conta de aluno ativa.' using errcode='42501'; end if;
  select * into a from public.lesson_activities where id=p_activity_id and is_active and publication_status='published' for share;
  if not found then raise exception 'Atividade indisponivel.' using errcode='42501'; end if;
  perform private.learning_require_student_lesson(a.lesson_id);
  if not private.learning_prerequisites_complete(auth.uid(),a.id) then
    raise exception 'Conclua os pre-requisitos desta atividade.' using errcode='23514';
  end if;
  if p_complete is null or (p_complete and a.activity_type not in ('slides','mindmap','video')) then
    raise exception 'Esta atividade exige avaliacao ou confirmacao autorizada.' using errcode='42501';
  end if;
  insert into public.student_activity_progress(student_id,activity_id,activity_revision,status,started_at,completed_at)
    values(auth.uid(),a.id,a.revision,case when p_complete then 'completed' else 'in_progress' end,now(),case when p_complete then now() end)
  on conflict(student_id,activity_id) do update set
    status=case when student_activity_progress.status='completed' then 'completed'
      when p_complete then 'completed' when student_activity_progress.status='not_started' then 'in_progress'
      else student_activity_progress.status end,
    started_at=coalesce(student_activity_progress.started_at,excluded.started_at),
    completed_at=coalesce(student_activity_progress.completed_at,excluded.completed_at)
  returning * into progress;
  return to_jsonb(progress);
end;
$$;

create or replace function private.learning_award_activity(p_student_id uuid,p_activity_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare a public.lesson_activities; rule text; points integer;
begin
 perform 1 from public.profiles where id=p_student_id and role='student' and is_active for update;
 if not found then return; end if;
 select * into a from public.lesson_activities where id=p_activity_id;
 if not found or not exists(select 1 from public.student_activity_progress where student_id=p_student_id and activity_id=a.id and status='completed' and activity_revision=a.revision) then return; end if;
 if a.activity_type in ('quiz','project') then perform private.sync_student_masteries(p_student_id);return; end if;
 if a.activity_type='online_lesson' and not exists(select 1 from public.lesson_plan_sessions s join public.scheduled_lessons m on m.id=s.scheduled_lesson_id
   where s.activity_id=a.id and s.confirmed_at is not null and m.student_id=p_student_id) then return; end if;
 rule:=case a.activity_type when 'slides' then 'activity_study' when 'mindmap' then 'activity_study' when 'video' then 'activity_study' when 'interactive' then 'activity_interactive' else 'activity_online' end;
 select r.points into points from public.xp_reward_rules r where r.event_type=rule;
 insert into public.student_xp_events(student_id,event_type,source_id,title,points,reward_context)
 values(p_student_id,'learning_activity',a.id,a.title,points,a.gamification_json||jsonb_build_object('policyVersion',1,'rewardRuleKey',rule,'activityType',a.activity_type,'activityRevision',a.revision)) on conflict do nothing;
 perform private.sync_student_xp(p_student_id);
end $$;

-- CREATE OR REPLACE preserves the existing ACLs, owners and SECURITY modes.
-- No new RPC, policy, grant, ledger or client-supplied points.
commit;
