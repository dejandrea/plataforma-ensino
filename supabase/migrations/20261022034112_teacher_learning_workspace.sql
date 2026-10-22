-- Etapa C. Apply only after A/B/B1; no remote application or real data changes.
begin;
alter table public.lesson_plan_sessions
  add column version integer not null default 1,
  add column confirmed_at timestamptz,
  add column confirmed_by uuid references public.profiles(id) on delete restrict,
  add constraint learning_session_confirmation_pair check ((confirmed_at is null)=(confirmed_by is null));
create index lesson_plan_sessions_confirmed_by on public.lesson_plan_sessions(confirmed_by);

-- All browser writes now pass authorization, validation and optimistic locking.
revoke insert,update on public.lesson_plan_sessions from authenticated;

create function private.learning_require_teacher_meeting(p_meeting uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
  if private.learning_role() not in ('admin','professor') or
    not coalesce(private.learning_can_manage_session(p_meeting),false) then
    raise exception 'Encontro indisponivel para esta conta.' using errcode='42501';
  end if;
end; $$;
revoke all on function private.learning_require_teacher_meeting(uuid) from public,anon,authenticated;

create function public.teacher_learning_workspace(p_scheduled_lesson_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare meeting public.scheduled_lessons;
begin
  perform private.learning_require_teacher_meeting(p_scheduled_lesson_id);
  select * into meeting from public.scheduled_lessons where id=p_scheduled_lesson_id;
  return jsonb_build_object('meeting',jsonb_build_object('id',meeting.id,'status',meeting.status),
    'activities',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,
      'lesson_title',l.title,'submodule_title',sm.title,'module_title',m.title,'course_title',c.title) order by c.title,m.order_index,sm.title,l.title,a.order_index)
      from public.lesson_activities a join public.lessons l on l.id=a.lesson_id
      join public.submodules sm on sm.id=l.submodule_id and sm.is_active
      join public.modules m on m.id=sm.module_id
      join public.courses c on c.id=m.course_id and c.is_active
      join public.student_curriculum_status(meeting.student_id) access on access.id=m.id and access.is_unlocked
      where a.activity_type='online_lesson' and a.is_active and a.publication_status='published'
      and exists(select 1 from public.teacher_lesson_plans p where p.activity_id=a.id)), '[]'::jsonb),
    'sessions',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('plan',p.content_json,
      'activity_title',a.title,'lesson_title',l.title,'submodule_title',sm.title,'module_title',m.title,'course_title',c.title)
      order by c.title,m.order_index,sm.title,l.title,a.order_index,s.id) from public.lesson_plan_sessions s join public.teacher_lesson_plans p on p.id=s.plan_id
      join public.lesson_activities a on a.id=s.activity_id join public.lessons l on l.id=a.lesson_id
      join public.submodules sm on sm.id=l.submodule_id join public.modules m on m.id=sm.module_id
      join public.courses c on c.id=m.course_id where s.scheduled_lesson_id=meeting.id), '[]'::jsonb));
end; $$;

create function public.link_teacher_learning_activity(p_scheduled_lesson_id uuid,p_activity_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare meeting public.scheduled_lessons; a public.lesson_activities; plan public.teacher_lesson_plans;
begin
  perform private.learning_require_teacher_meeting(p_scheduled_lesson_id);
  select * into meeting from public.scheduled_lessons where id=p_scheduled_lesson_id for update;
  perform private.learning_require_teacher_meeting(p_scheduled_lesson_id);
  if meeting.status='cancelled' then raise exception 'Encontro cancelado.' using errcode='23514'; end if;
  select * into a from public.lesson_activities where id=p_activity_id and activity_type='online_lesson'
    and is_active and publication_status='published';
  if not found or not exists(select 1 from public.lessons l join public.submodules sm on sm.id=l.submodule_id and sm.is_active
      join public.student_curriculum_status(meeting.student_id) m on m.id=sm.module_id and m.is_unlocked where l.id=a.lesson_id) then
    raise exception 'Atividade curricular indisponivel para este aluno.' using errcode='42501';
  end if;
  select * into plan from public.teacher_lesson_plans where activity_id=a.id order by revision desc limit 1;
  if not found then raise exception 'Plano indisponivel.' using errcode='23514'; end if;
  insert into public.lesson_plan_sessions(scheduled_lesson_id,plan_id,activity_id,plan_revision)
    values(meeting.id,plan.id,a.id,plan.revision) on conflict(scheduled_lesson_id,activity_id) do nothing;
  return public.teacher_learning_workspace(meeting.id);
end; $$;

create function public.save_teacher_learning_session(p_session_id uuid,p_version integer,p_completed_step_keys text[],p_notes text,p_evaluation jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.lesson_plan_sessions; plan jsonb; k text; v jsonb;
begin
  select * into s from public.lesson_plan_sessions where id=p_session_id;
  perform private.learning_require_teacher_meeting(s.scheduled_lesson_id);
  perform 1 from public.scheduled_lessons where id=s.scheduled_lesson_id and status<>'cancelled' for update;
  if not found then raise exception 'Encontro cancelado.' using errcode='23514'; end if;
  perform private.learning_require_teacher_meeting(s.scheduled_lesson_id);
  select * into s from public.lesson_plan_sessions where id=p_session_id for update;
  if p_version is null or s.version<>p_version then
    raise exception 'O registro mudou em outra aba. Recarregue antes de salvar.' using errcode='40001';
  end if;
  select content_json into plan from public.teacher_lesson_plans where id=s.plan_id;
  if p_notes is null or length(p_notes)>20000 or p_completed_step_keys is null or array_position(p_completed_step_keys,null) is not null
    or p_evaluation is null or jsonb_typeof(p_evaluation)<>'object' or octet_length(p_evaluation::text)>100000 then
    raise exception 'Registro pedagogico invalido.' using errcode='23514';
  end if;
  for k,v in select * from jsonb_each(p_evaluation) loop
    if k in ('comprehension','practice','autonomy') then
      if jsonb_typeof(v)<>'string' or v#>>'{}' not in ('needs_support','developing','autonomous') then
        raise exception 'Nivel pedagogico invalido.' using errcode='23514';
      end if;
    elsif k in ('difficulties','recommendations','revisitStepKeys') then
      if jsonb_typeof(v)<>'array' then raise exception 'Lista pedagogica invalida.' using errcode='23514'; end if;
      if jsonb_array_length(v)>200 or exists(select 1 from jsonb_array_elements(v) e where jsonb_typeof(e)<>'string' or length(e#>>'{}') not between 1 and 20000) then
        raise exception 'Lista pedagogica invalida.' using errcode='23514';
      end if;
      if k='revisitStepKeys' and exists(select 1 from jsonb_array_elements_text(v) key where not exists(
        select 1 from jsonb_array_elements(plan->'steps') step where step->>'key'=key)) then
        raise exception 'Etapa de retomada invalida.' using errcode='23514';
      end if;
    else raise exception 'Campo pedagogico desconhecido.' using errcode='23514';
    end if;
  end loop;
  update public.lesson_plan_sessions set completed_step_keys=p_completed_step_keys,notes=p_notes,
    evaluation_json=p_evaluation,version=version+1 where id=s.id returning * into s;
  return to_jsonb(s);
end; $$;

create function public.confirm_teacher_learning_activity(p_session_id uuid,p_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.lesson_plan_sessions; meeting public.scheduled_lessons; a public.lesson_activities;
begin
  select * into s from public.lesson_plan_sessions where id=p_session_id;
  perform private.learning_require_teacher_meeting(s.scheduled_lesson_id);
  select * into meeting from public.scheduled_lessons where id=s.scheduled_lesson_id;
  -- Same lock order as the existing student/XP operations, then meeting/session.
  perform 1 from public.profiles where id=meeting.student_id for update;
  select * into meeting from public.scheduled_lessons where id=s.scheduled_lesson_id for update;
  perform private.learning_require_teacher_meeting(meeting.id);
  select * into s from public.lesson_plan_sessions where id=p_session_id for update;
  if s.confirmed_at is not null then return to_jsonb(s); end if;
  if p_version is null or s.version<>p_version then raise exception 'O registro mudou em outra aba. Recarregue antes de confirmar.' using errcode='40001'; end if;
  if meeting.status<>'completed' then raise exception 'Encerre o encontro antes de confirmar a atividade curricular.' using errcode='23514'; end if;
  select * into a from public.lesson_activities where id=s.activity_id for update;
  if not a.is_active or a.publication_status<>'published' or not exists(
      select 1 from public.lessons l join public.submodules sm on sm.id=l.submodule_id and sm.is_active
      join public.student_curriculum_status(meeting.student_id) m on m.id=sm.module_id and m.is_unlocked where l.id=a.lesson_id)
    or not private.learning_prerequisites_complete(meeting.student_id,a.id) then
    raise exception 'Atividade ou pre-requisitos indisponiveis para o aluno.' using errcode='23514';
  end if;
  update public.lesson_plan_sessions set confirmed_at=now(),confirmed_by=auth.uid(),version=version+1 where id=s.id returning * into s;
  insert into public.student_activity_progress(student_id,activity_id,activity_revision,status,started_at,completed_at)
    values(meeting.student_id,a.id,a.revision,'completed',now(),now())
    on conflict(student_id,activity_id) do update set status='completed',started_at=coalesce(public.student_activity_progress.started_at,now()),
      completed_at=coalesce(public.student_activity_progress.completed_at,now()),updated_at=now();
  return to_jsonb(s);
end; $$;

revoke all on function public.teacher_learning_workspace(uuid),public.link_teacher_learning_activity(uuid,uuid),
  public.save_teacher_learning_session(uuid,integer,text[],text,jsonb),public.confirm_teacher_learning_activity(uuid,integer) from public,anon;
grant execute on function public.teacher_learning_workspace(uuid),public.link_teacher_learning_activity(uuid,uuid),
  public.save_teacher_learning_session(uuid,integer,text[],text,jsonb),public.confirm_teacher_learning_activity(uuid,integer) to authenticated;
commit;
