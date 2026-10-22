-- Etapa B: all learner writes are authenticated, transactional operations.
-- Apply only after the foundation, with explicit deployment authorization.
begin;
alter table public.quiz_attempts
  add column request_id uuid not null default gen_random_uuid(),
  add column feedback_json jsonb not null default '[]'::jsonb check(jsonb_typeof(feedback_json)='array'),
  add constraint quiz_attempt_request_unique unique(student_id,activity_id,request_id);

create function private.learning_require_student_lesson(p_lesson_id uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or private.learning_role() is distinct from 'student' then
    raise exception 'Entre com uma conta de aluno ativa.' using errcode='42501';
  end if;
  if not exists(select 1 from public.lessons l
    join public.submodules s on s.id=l.submodule_id and s.is_active
    join public.student_curriculum_status(auth.uid()) m on m.id=s.module_id and m.is_unlocked
    where l.id=p_lesson_id) then
    raise exception 'Esta aula ainda nao esta liberada.' using errcode='42501';
  end if;
end;
$$;
revoke all on function private.learning_require_student_lesson(uuid) from public,anon,authenticated;

create function private.learning_prerequisites_complete(p_student_id uuid,p_activity_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select not exists(select 1 from public.activity_prerequisites d
    join public.lesson_activities a on a.id=d.prerequisite_activity_id
    where d.activity_id=p_activity_id and (not a.is_active or a.publication_status<>'published'
      or not exists(select 1 from public.student_activity_progress p
        where p.student_id=p_student_id and p.activity_id=a.id and p.activity_revision=a.revision and p.status='completed')));
$$;
revoke all on function private.learning_prerequisites_complete(uuid,uuid) from public,anon,authenticated;

-- Once a lesson has published activities, hiding all of them must not reopen
-- the old manual-completion path. Draft-only lessons keep legacy behavior.
create function private.learning_lesson_ready(p_student_id uuid,p_lesson_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select not exists(select 1 from public.lesson_activities where lesson_id=p_lesson_id and published_at is not null)
    or (exists(select 1 from public.lesson_activities where lesson_id=p_lesson_id and is_active and publication_status='published')
      and not exists(select 1 from public.lesson_activities a where a.lesson_id=p_lesson_id
        and a.is_active and a.publication_status='published' and a.is_required
        and not exists(select 1 from public.student_activity_progress p where p.student_id=p_student_id
          and p.activity_id=a.id and p.activity_revision=a.revision and p.status='completed')));
$$;
revoke all on function private.learning_lesson_ready(uuid,uuid) from public,anon,authenticated;

create function private.learning_guard_lesson_completion() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.completed_at is not null and not private.learning_lesson_ready(new.student_id,new.lesson_id) then
    raise exception 'Conclua as atividades obrigatorias antes de finalizar a aula.' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function private.learning_guard_lesson_completion() from public,anon,authenticated;
create trigger learning_guard_lesson_completion before insert or update on public.student_progress
for each row execute function private.learning_guard_lesson_completion();

-- Reuse student_progress and its existing curriculum/XP triggers. Preserve
-- earlier completions: publishing new material never rewrites academic history.
create function private.learning_sync_lesson(p_student_id uuid,p_lesson_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.lesson_activities where lesson_id=p_lesson_id and is_active
      and publication_status='published' and is_required)
    and private.learning_lesson_ready(p_student_id,p_lesson_id) then
    insert into public.student_progress(student_id,lesson_id,completed_at)
      values(p_student_id,p_lesson_id,now()) on conflict(student_id,lesson_id) do nothing;
  end if;
end;
$$;
revoke all on function private.learning_sync_lesson(uuid,uuid) from public,anon,authenticated;
create function private.learning_sync_progress_trigger() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='completed' then
    perform private.learning_sync_lesson(new.student_id,(select lesson_id from public.lesson_activities where id=new.activity_id));
  end if;
  return null;
end;
$$;
revoke all on function private.learning_sync_progress_trigger() from public,anon,authenticated;
create trigger learning_sync_progress after insert or update on public.student_activity_progress
for each row execute function private.learning_sync_progress_trigger();

-- No student ID/status/result parameter. Serialize mutations on the student
-- profile FIRST (same lock order as existing XP), then lock the source activity.
create function private.learning_record_study(p_activity_id uuid,p_complete boolean) returns jsonb
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
  if p_complete is null or (p_complete and a.activity_type not in ('slides','mindmap')) then
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
revoke all on function private.learning_record_study(uuid,boolean) from public,anon;
grant execute on function private.learning_record_study(uuid,boolean) to authenticated;

create function public.start_student_activity(p_activity_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.learning_record_study(p_activity_id,false); $$;
create function public.complete_student_study(p_activity_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.learning_record_study(p_activity_id,true); $$;
revoke all on function public.start_student_activity(uuid),public.complete_student_study(uuid) from public,anon;
grant execute on function public.start_student_activity(uuid),public.complete_student_study(uuid) to authenticated;

create function private.learning_submit_quiz(p_activity_id uuid,p_answers jsonb,p_request_id uuid) returns jsonb
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
revoke all on function private.learning_submit_quiz(uuid,jsonb,uuid) from public,anon;
grant execute on function private.learning_submit_quiz(uuid,jsonb,uuid) to authenticated;
create function public.submit_student_quiz(p_activity_id uuid,p_answers jsonb,p_request_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.learning_submit_quiz(p_activity_id,p_answers,p_request_id); $$;
revoke all on function public.submit_student_quiz(uuid,jsonb,uuid) from public,anon;
grant execute on function public.submit_student_quiz(uuid,jsonb,uuid) to authenticated;

create function private.learning_complete_student_lesson(p_lesson_id uuid) returns timestamptz
language plpgsql security definer set search_path='' as $$
declare completed timestamptz;
begin
  perform 1 from public.profiles where id=auth.uid() and is_active and role='student' for update;
  if not found then raise exception 'Entre com uma conta de aluno ativa.' using errcode='42501'; end if;
  perform private.learning_require_student_lesson(p_lesson_id);
  select completed_at into completed from public.student_progress where student_id=auth.uid() and lesson_id=p_lesson_id;
  if completed is not null then return completed; end if;
  if not private.learning_lesson_ready(auth.uid(),p_lesson_id) then
    raise exception 'Conclua as atividades obrigatorias antes de finalizar a aula.' using errcode='23514';
  end if;
  insert into public.student_progress(student_id,lesson_id,completed_at) values(auth.uid(),p_lesson_id,now())
    on conflict(student_id,lesson_id) do update set completed_at=coalesce(student_progress.completed_at,excluded.completed_at)
    returning completed_at into completed;
  return completed;
end;
$$;
revoke all on function private.learning_complete_student_lesson(uuid) from public,anon;
grant execute on function private.learning_complete_student_lesson(uuid) to authenticated;
create function public.complete_student_lesson(p_lesson_id uuid) returns timestamptz
language sql security invoker set search_path='' as $$ select private.learning_complete_student_lesson(p_lesson_id); $$;
revoke all on function public.complete_student_lesson(uuid) from public,anon;
grant execute on function public.complete_student_lesson(uuid) to authenticated;

-- One authorized snapshot for the page. Neither plans, expected answers, private
-- session notes, quiz keys nor raw Meet links are included for learning activities.
create function private.learning_student_lesson(p_lesson_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform private.learning_require_student_lesson(p_lesson_id);
  select jsonb_build_object(
    'lesson',jsonb_build_object('id',l.id,'title',l.title,'description',l.description,'duration_minutes',l.duration_minutes,
      'video_url',l.video_url,'pdf_url',l.pdf_url,'slides_url',l.slides_url,'meet_link',case
        when not exists(select 1 from public.lesson_activities where lesson_id=l.id and published_at is not null) then l.meet_link end),
    'objectives',coalesce((select to_jsonb(m.objectives) from public.lesson_learning_metadata m where m.lesson_id=l.id),'[]'::jsonb),
    'has_activity_model',exists(select 1 from public.lesson_activities where lesson_id=l.id and published_at is not null),
    'can_complete',private.learning_lesson_ready(auth.uid(),l.id),
    'completed_at',(select completed_at from public.student_progress where student_id=auth.uid() and lesson_id=l.id),
    'activities',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object(
      'is_unlocked',private.learning_prerequisites_complete(auth.uid(),a.id),
      'prerequisite_ids',coalesce((select jsonb_agg(d.prerequisite_activity_id) from public.activity_prerequisites d where d.activity_id=a.id),'[]'::jsonb))
      order by a.order_index,a.id) from public.lesson_activities a
      where a.lesson_id=l.id and a.is_active and a.publication_status='published'),'[]'::jsonb),
    'progress',coalesce((select jsonb_agg(to_jsonb(p)) from public.student_activity_progress p join public.lesson_activities a on a.id=p.activity_id
      where p.student_id=auth.uid() and a.lesson_id=l.id and a.is_active and a.publication_status='published'),'[]'::jsonb),
    'attempts',coalesce((select jsonb_agg(to_jsonb(q) order by q.attempt_number) from public.quiz_attempts q join public.lesson_activities a on a.id=q.activity_id
      where q.student_id=auth.uid() and a.lesson_id=l.id and a.is_active and a.publication_status='published'),'[]'::jsonb),
    'submissions',coalesce((select jsonb_agg(to_jsonb(s) order by s.version) from public.project_submissions s join public.lesson_activities a on a.id=s.activity_id
      where s.student_id=auth.uid() and a.lesson_id=l.id and a.is_active and a.publication_status='published'),'[]'::jsonb),
    'reviews',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at,r.id) from public.project_submission_reviews r
      join public.project_submissions s on s.id=r.submission_id join public.lesson_activities a on a.id=s.activity_id
      where s.student_id=auth.uid() and a.lesson_id=l.id and a.is_active and a.publication_status='published'),'[]'::jsonb),
    'meetings',coalesce((select jsonb_agg(jsonb_build_object('activity_id',ps.activity_id,'scheduled_lesson_id',s.id,
      'title',s.title,'starts_at',s.starts_at,'ends_at',s.ends_at) order by s.starts_at,s.id)
      from public.lesson_plan_sessions ps join public.scheduled_lessons s on s.id=ps.scheduled_lesson_id
      join public.lesson_activities a on a.id=ps.activity_id
      where s.student_id=auth.uid() and s.status='scheduled' and s.ends_at>now() and a.lesson_id=l.id
        and a.is_active and a.publication_status='published'),'[]'::jsonb)
  ) into result from public.lessons l where l.id=p_lesson_id;
  return result;
end;
$$;
revoke all on function private.learning_student_lesson(uuid) from public,anon;
grant execute on function private.learning_student_lesson(uuid) to authenticated;
create function public.student_lesson_learning(p_lesson_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.learning_student_lesson(p_lesson_id); $$;
revoke all on function public.student_lesson_learning(uuid) from public,anon;
grant execute on function public.student_lesson_learning(uuid) to authenticated;
commit;
