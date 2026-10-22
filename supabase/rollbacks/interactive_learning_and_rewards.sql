-- Manual rollback only. Refuses to discard B1 attempts, content, rewards or
-- nonzero reward configuration. Export/archive those records and review a
-- dedicated recovery migration instead of deleting learning history.
begin;
do $$ begin
 if exists(select 1 from public.activity_attempt_sessions) or exists(select 1 from public.lesson_activities where activity_type='interactive' or gamification_json<>'{}')
   or exists(select 1 from public.student_xp_events where event_type in ('learning_activity','learning_submodule'))
   or exists(select 1 from public.xp_reward_rules where (event_type like 'activity_%' or event_type='submodule_completion') and points<>0) then
   raise exception 'B1 possui dados ou configuracoes; reversao exige plano de preservacao.';
 end if;
end $$;
drop function public.import_learning_lesson(uuid,jsonb,boolean);
drop function public.publish_learning_activities(uuid,uuid[]);
drop function public.submit_student_assessment(uuid,jsonb,uuid);
drop function public.begin_student_assessment(uuid);
drop function private.learning_student_lesson(uuid);
alter function private.learning_student_lesson_before_b1(uuid) rename to learning_student_lesson;
grant execute on function private.learning_student_lesson(uuid) to authenticated;
drop trigger learning_award_activity on public.student_activity_progress;
drop trigger learning_award_project_review on public.project_submission_reviews;
drop trigger learning_award_submodule on public.student_progress;
drop trigger learning_guard_reward_receipt on public.student_xp_events;
drop function private.sync_student_xp(uuid);
alter function private.sync_student_pre_learning_xp(uuid) rename to sync_student_xp;
drop function private.sync_student_masteries(uuid);
alter function private.sync_student_pre_learning_masteries(uuid) rename to sync_student_masteries;
create or replace function private.learning_guard_activity() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare answers jsonb;
begin
  if tg_op='UPDATE' then
    if old.published_at is not null and
      (to_jsonb(new)-array['updated_at','is_active','publication_status']) is distinct from
      (to_jsonb(old)-array['updated_at','is_active','publication_status']) then
      raise exception 'Atividade publicada e imutavel; crie uma nova revisao.' using errcode='23514';
    end if;
    new.published_at := old.published_at;
  end if;
  if new.publication_status='published' then
    if new.activity_type='quiz' then
      select content_json->'answers' into answers from public.activity_quiz_keys where activity_id=new.id;
      if answers is null or jsonb_typeof(answers)<>'array' then
        raise exception 'Publicacao exige gabarito valido.' using errcode='23514';
      end if;
      if jsonb_array_length(answers)<>jsonb_array_length(new.content_json->'questions')
        or (select count(distinct a->>'questionKey') from jsonb_array_elements(answers) a)<>jsonb_array_length(answers)
        or exists(select 1 from jsonb_array_elements(answers) a where not exists (
          select 1 from jsonb_array_elements(new.content_json->'questions') q,
            jsonb_array_elements(q->'options') o where q->>'key'=a->>'questionKey' and o->>'key'=a->>'optionKey')) then
        raise exception 'Publicacao exige gabarito completo e consistente.' using errcode='23514';
      end if;
    end if;
    if new.activity_type='online_lesson' and not exists(select 1 from public.teacher_lesson_plans where activity_id=new.id) then
      raise exception 'Publicacao exige plano pedagogico.' using errcode='23514';
    end if;
    new.published_at := coalesce(new.published_at,now());
  end if;
  new.updated_at := now(); return new;
end;
$$;
create or replace function private.learning_public_content_valid(kind text, content jsonb) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare allowed text[]; question jsonb; option_item jsonb;
begin
  if jsonb_typeof(content) is distinct from 'object' or content->'schemaVersion' is distinct from '1'::jsonb
    or content->>'type' is distinct from kind then return false; end if;
  allowed := case kind
    when 'slides' then array['schemaVersion','type','resourceUrl','format','altText']
    when 'mindmap' then array['schemaVersion','type','resourceUrl','format','altText']
    when 'quiz' then array['schemaVersion','type','passingScore','maxAttempts','questions']
    when 'online_lesson' then array['schemaVersion','type','objective','preparation']
    when 'project' then array['schemaVersion','type','instructions','objectives','requirements','assessmentCriteria','resources']
    else null end;
  if allowed is null or not (content ?& allowed) or content - allowed <> '{}'::jsonb then return false; end if;
  if kind='quiz' then
    if jsonb_typeof(content->'passingScore') <> 'number' or jsonb_typeof(content->'maxAttempts') <> 'number'
      or (content->>'passingScore')::numeric not between 0 and 100
      or (content->>'maxAttempts')::numeric not between 1 and 100
      or (content->>'passingScore')::numeric <> trunc((content->>'passingScore')::numeric)
      or (content->>'maxAttempts')::numeric <> trunc((content->>'maxAttempts')::numeric)
      or jsonb_typeof(content->'questions') <> 'array' then return false; end if;
    if jsonb_array_length(content->'questions') not between 1 and 100 then return false; end if;
    for question in select value from jsonb_array_elements(content->'questions') loop
      if jsonb_typeof(question) <> 'object' or not(question ?& array['key','prompt','options'])
        or question - array['key','prompt','options'] <> '{}'::jsonb
        or jsonb_typeof(question->'key') <> 'string' or jsonb_typeof(question->'prompt') <> 'string'
        or jsonb_typeof(question->'options') <> 'array' then return false; end if;
      if jsonb_array_length(question->'options') not between 2 and 12 then return false; end if;
      for option_item in select value from jsonb_array_elements(question->'options') loop
        if jsonb_typeof(option_item) <> 'object' or not(option_item ?& array['key','text'])
          or option_item - array['key','text'] <> '{}'::jsonb
          or jsonb_typeof(option_item->'key') <> 'string' or jsonb_typeof(option_item->'text') <> 'string'
          then return false; end if;
      end loop;
    end loop;
  end if;
  return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end;
$$;
create or replace function private.learning_submit_quiz(p_activity_id uuid,p_answers jsonb,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.lesson_activities; previous public.quiz_attempts; attempt public.quiz_attempts;
  answer_key jsonb; feedback jsonb; question_count integer; correct_count integer; attempt_number integer; score numeric(5,2); passed boolean;
begin
  if auth.uid() is null or private.learning_role() is distinct from 'student' then
    raise exception 'Entre com uma conta de aluno ativa.' using errcode='42501';
  end if;
  perform 1 from public.profiles where id=auth.uid() and is_active and role='student' for update;
  if not found then raise exception 'Entre com uma conta de aluno ativa.' using errcode='42501'; end if;
  select * into a from public.lesson_activities where id=p_activity_id and is_active
    and publication_status='published' and activity_type='quiz' for share;
  if not found then raise exception 'Questionario indisponivel.' using errcode='42501'; end if;
  perform private.learning_require_student_lesson(a.lesson_id);
  if p_request_id is null then raise exception 'Identificador da submissao obrigatorio.' using errcode='22023'; end if;
  select * into previous from public.quiz_attempts where student_id=auth.uid() and activity_id=a.id and request_id=p_request_id;
  if found then
    if previous.answers_json is distinct from p_answers then
      raise exception 'Identificador ja utilizado com outras respostas.' using errcode='22023';
    end if;
    return to_jsonb(previous);
  end if;
  if not private.learning_prerequisites_complete(auth.uid(),a.id) then
    raise exception 'Conclua os pre-requisitos desta atividade.' using errcode='23514';
  end if;
  if exists(select 1 from public.student_activity_progress where student_id=auth.uid() and activity_id=a.id and status='completed') then
    raise exception 'Este questionario ja foi aprovado.' using errcode='23514';
  end if;
  select coalesce(max(q.attempt_number),0)+1 into attempt_number from public.quiz_attempts q where q.student_id=auth.uid() and q.activity_id=a.id;
  if attempt_number>(a.content_json->>'maxAttempts')::integer then
    raise exception 'Limite de tentativas atingido. Converse com sua professora.' using errcode='23514';
  end if;
  question_count:=jsonb_array_length(a.content_json->'questions');
  if p_answers is null or jsonb_typeof(p_answers)<>'object' then
    raise exception 'Envie uma alternativa para cada pergunta.' using errcode='22023';
  end if;
  if (select count(*) from jsonb_object_keys(p_answers))<>question_count or exists(
    select 1 from jsonb_array_elements(a.content_json->'questions') q where not exists (
      select 1 from jsonb_array_elements(q->'options') o
      where jsonb_typeof(p_answers->(q->>'key'))='string' and o->>'key'=p_answers->>(q->>'key'))) then
    raise exception 'Respostas incompletas ou alternativas invalidas.' using errcode='22023';
  end if;
  select content_json->'answers' into answer_key from public.activity_quiz_keys where activity_id=a.id;
  if answer_key is null or jsonb_array_length(answer_key)<>question_count or question_count=0
    or (select count(distinct q->>'key') from jsonb_array_elements(a.content_json->'questions') q)<>question_count
    or (select count(distinct k->>'questionKey') from jsonb_array_elements(answer_key) k)<>question_count
    or exists(select 1 from jsonb_array_elements(answer_key) k where not exists (
      select 1 from jsonb_array_elements(a.content_json->'questions') q,jsonb_array_elements(q->'options') o
      where q->>'key'=k->>'questionKey' and o->>'key'=k->>'optionKey')) then
    raise exception 'Questionario com configuracao invalida. Avise sua professora.' using errcode='23514';
  end if;
  select count(*) filter(where p_answers->>(k->>'questionKey')=k->>'optionKey'),
    jsonb_agg(jsonb_build_object('questionKey',k->>'questionKey','isCorrect',p_answers->>(k->>'questionKey')=k->>'optionKey','feedback',k->>'feedback'))
    into correct_count,feedback from jsonb_array_elements(answer_key) k;
  score:=round(100.0*correct_count/question_count,2);
  passed:=score>=(a.content_json->>'passingScore')::numeric;
  insert into public.quiz_attempts(student_id,activity_id,activity_revision,attempt_number,answers_json,score,passed,request_id,feedback_json)
    values(auth.uid(),a.id,a.revision,attempt_number,p_answers,score,passed,p_request_id,feedback) returning * into attempt;
  insert into public.student_activity_progress(student_id,activity_id,activity_revision,status,started_at,completed_at)
    values(auth.uid(),a.id,a.revision,case when passed then 'completed' else 'in_progress' end,now(),case when passed then now() end)
  on conflict(student_id,activity_id) do update set status=excluded.status,
    started_at=coalesce(student_activity_progress.started_at,excluded.started_at),completed_at=excluded.completed_at;
  return to_jsonb(attempt);
end;
$$;
drop function private.learning_submit_assessment(uuid,jsonb,uuid);
drop function private.learning_begin_assessment(uuid,uuid);
drop function private.learning_shuffle(text[],jsonb);
drop function private.learning_import_lesson(uuid,jsonb,boolean);
drop function private.learning_publish_import(uuid,uuid[]);
drop function private.learning_award_activity_trigger();
drop function private.learning_award_project_review();
drop function private.learning_award_activity(uuid,uuid);
drop function private.learning_award_submodule();
drop function private.learning_guard_reward_receipt();
drop table public.activity_attempt_sessions;
drop function private.learning_guard_attempt_session();
drop function private.learning_interactive_key_valid(jsonb,jsonb);
drop function private.learning_validate_reward(text,jsonb);
drop function private.learning_json_matches(jsonb,jsonb,integer);
drop table private.learning_content_schemas;
alter table public.quiz_attempts drop column presentation_json;
alter table public.student_xp_events drop column reward_context;
alter table public.lesson_activities drop column gamification_json;
alter table public.lesson_activities drop constraint lesson_activities_activity_type_check;
alter table public.lesson_activities add constraint lesson_activities_activity_type_check check(activity_type in ('slides','mindmap','quiz','online_lesson','project'));
alter table public.activity_quiz_keys drop constraint activity_quiz_keys_activity_type_check;
alter table public.activity_quiz_keys add constraint activity_quiz_keys_activity_type_check check(activity_type='quiz');
alter table public.activity_quiz_keys drop constraint activity_quiz_keys_content_json_check;
alter table public.activity_quiz_keys add constraint activity_quiz_keys_content_json_check check(coalesce(jsonb_typeof(content_json)='object' and content_json->'schemaVersion'='1'::jsonb and jsonb_typeof(content_json->'answers')='array',false));
alter table public.quiz_attempts drop constraint quiz_attempts_activity_type_check;
alter table public.quiz_attempts add constraint quiz_attempts_activity_type_check check(activity_type='quiz');
delete from public.xp_reward_rules where event_type like 'activity_%' or event_type='submodule_completion';
alter table public.xp_reward_rules drop constraint xp_reward_rules_event_type_check;
alter table public.xp_reward_rules add constraint xp_reward_rules_event_type_check check(event_type in ('welcome','lesson','scheduled_lesson','module','course','evaluation','evaluation_star'));
commit;
