begin;
set local lock_timeout='5s';

-- A narrowly scoped correction for the unused A02 activities. Never a general upsert.
create table private.a02_reconciliation_permits(
 transaction_id bigint not null,activity_id uuid not null,before_row jsonb not null,after_row jsonb not null,
 primary key(transaction_id,activity_id)
);
create table private.a02_reconciliation_audit(
 id bigint generated always as identity primary key,actor_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),document jsonb not null,before_state jsonb not null,after_state jsonb not null
);
alter table private.a02_reconciliation_permits enable row level security;
alter table private.a02_reconciliation_audit enable row level security;
revoke all on private.a02_reconciliation_permits,private.a02_reconciliation_audit from public,anon,authenticated,service_role;
create trigger a02_reconciliation_audit_immutable before update or delete on private.a02_reconciliation_audit
 for each row execute function private.learning_reject_history_change();

create function private.a02_reconciliation_permitted(p_old public.lesson_activities,p_new public.lesson_activities)
returns boolean language sql stable security definer set search_path='' as $$
 select p_old.lesson_id='b17a2000-0000-4000-8000-000000001002'::uuid
 and private.learning_role()='admin' and exists(select 1 from private.a02_reconciliation_permits p
 where p.transaction_id=txid_current() and p.activity_id=p_old.id
 and p.before_row=to_jsonb(p_old)-'updated_at' and p.after_row=to_jsonb(p_new)-'updated_at');
$$;
revoke all on function private.a02_reconciliation_permitted(public.lesson_activities,public.lesson_activities) from public,anon,authenticated,service_role;

-- Retain every existing validation. Replace only the immutable-row condition,
-- failing closed if the installed function no longer has the audited structure.
do $$ declare body text;needle text:='if old.published_at is not null and'; begin
 body:=pg_get_functiondef('private.learning_guard_activity()'::regprocedure);
 if length(body)-length(replace(body,needle,''))<>length(needle) then
  raise exception 'Guard de atividades divergente; revisar antes de instalar.';
 end if;
 body:=replace(body,needle,'if old.published_at is not null and not private.a02_reconciliation_permitted(old,new) and');
 execute body;
end $$;

create function private.a02_reconciliation_state() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'lesson',(select to_jsonb(l) from public.lessons l where l.id='b17a2000-0000-4000-8000-000000001002'),
 'context',(select jsonb_build_object('courseTitle',c.title,'moduleTitle',m.title,'submoduleTitle',s.title)
 from public.lessons l join public.submodules s on s.id=l.submodule_id join public.modules m on m.id=s.module_id
 join public.courses c on c.id=m.course_id where l.id='b17a2000-0000-4000-8000-000000001002'),
 'metadata',(select to_jsonb(m) from public.lesson_learning_metadata m where m.lesson_id='b17a2000-0000-4000-8000-000000001002'),
 'activities',(select coalesce(jsonb_agg(to_jsonb(a) order by a.key),'[]') from public.lesson_activities a where a.lesson_id='b17a2000-0000-4000-8000-000000001002'),
 'keys',(select coalesce(jsonb_agg(to_jsonb(k) order by k.activity_id),'[]') from public.activity_quiz_keys k join public.lesson_activities a on a.id=k.activity_id where a.lesson_id='b17a2000-0000-4000-8000-000000001002'),
 'links',(select coalesce(jsonb_agg(to_jsonb(k) order by k.activity_id),'[]') from public.web_presentation_links k join public.lesson_activities a on a.id=k.activity_id where a.lesson_id='b17a2000-0000-4000-8000-000000001002'),
 'presentations',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') from public.web_presentations p where p.lesson_id='b17a2000-0000-4000-8000-000000001002'));
$$;
revoke all on function private.a02_reconciliation_state() from public,anon,authenticated,service_role;

create function private.a02_reconciliation_has_history() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.student_progress where lesson_id='b17a2000-0000-4000-8000-000000001002')
 or exists(select 1 from public.student_activity_progress p join public.lesson_activities a on a.id=p.activity_id where a.lesson_id='b17a2000-0000-4000-8000-000000001002')
 or exists(select 1 from public.quiz_attempts p join public.lesson_activities a on a.id=p.activity_id where a.lesson_id='b17a2000-0000-4000-8000-000000001002')
 or exists(select 1 from public.activity_attempt_sessions p join public.lesson_activities a on a.id=p.activity_id where a.lesson_id='b17a2000-0000-4000-8000-000000001002')
 or exists(select 1 from public.project_submissions p join public.lesson_activities a on a.id=p.activity_id where a.lesson_id='b17a2000-0000-4000-8000-000000001002')
 or exists(select 1 from public.lesson_plan_sessions p join public.lesson_activities a on a.id=p.activity_id where a.lesson_id='b17a2000-0000-4000-8000-000000001002')
 or exists(select 1 from private.flashcard_review_progress p join public.lesson_activities a on a.id=p.activity_id where a.lesson_id='b17a2000-0000-4000-8000-000000001002')
 or exists(select 1 from public.student_xp_events e where e.source_id='b17a2000-0000-4000-8000-000000001002' or e.source_id in(select id from public.lesson_activities where lesson_id='b17a2000-0000-4000-8000-000000001002'));
$$;
revoke all on function private.a02_reconciliation_has_history() from public,anon,authenticated,service_role;

create function private.plan_a02_reconciliation(p_document jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s jsonb;spec jsonb;a jsonb;b public.lesson_activities;target jsonb;rows jsonb:='[]';changes text[];k jsonb;
 expected text[]:=array['a02-v2-arquivos-secretos','a02-v2-associacao-parte1','a02-v2-detetive-tecnologia','a02-v2-flashcards-seis-nomes','a02-v2-mapa-grandes-ideias','a02-v2-novas-pistas','a02-v2-seis-descobertas','a02-v2-video-genios'];
begin
 perform private.web_presentation_admin();
 if p_document is null or length(p_document::text)>2000000 then raise exception 'Documento ausente ou maior que 2 MB.' using errcode='22023';end if;
 select document into spec from private.learning_content_schemas where version=2;
 if p_document->>'schemaVersion'<>'2' or not coalesce(private.learning_json_matches(spec,p_document),false) then raise exception 'JSON fora do contrato v2.' using errcode='22023';end if;
 if (select array_agg(x->>'key' order by x->>'key') from jsonb_array_elements(p_document->'activities') x) is distinct from expected
 or (select array_agg((x->>'orderIndex')::integer order by (x->>'orderIndex')::integer) from jsonb_array_elements(p_document->'activities') x) is distinct from array[0,1,2,3,4,5,6,7]
 then raise exception 'Reconciliação exige as oito keys da Aula 02 e posições únicas de 0 a 7.' using errcode='23514';end if;
 s:=private.a02_reconciliation_state();
 if s->'lesson' is null or s->'lesson'->>'title'<>'Grandes Nomes da Tecnologia'
 or p_document->'lesson'->>'title'<>s->'lesson'->>'title' or p_document->'lesson'->>'key'<>'html-m01-s01-a02'
 then raise exception 'Destino não corresponde à Aula 02.' using errcode='23514';end if;
 if private.a02_reconciliation_has_history() then raise exception 'Aula com histórico de aluno; atualização bloqueada. É necessário planejar versionamento.' using errcode='23514';end if;
 if exists(select 1 from public.lesson_activities where lesson_id='b17a2000-0000-4000-8000-000000001002' and (not(key=any(expected)) or not is_active))
 or exists(select 1 from public.activity_prerequisites d join public.lesson_activities source_activity on source_activity.id=d.activity_id join public.lesson_activities dependency on dependency.id=d.prerequisite_activity_id where source_activity.lesson_id='b17a2000-0000-4000-8000-000000001002' or dependency.lesson_id='b17a2000-0000-4000-8000-000000001002')
 then raise exception 'Inventário ou dependências divergentes; revisar manualmente.' using errcode='23514';end if;
 if exists(select 1 from unnest(array['a02-v2-arquivos-secretos','a02-v2-associacao-parte1','a02-v2-detetive-tecnologia','a02-v2-mapa-grandes-ideias','a02-v2-novas-pistas','a02-v2-seis-descobertas']) missing(key) where not exists(select 1 from public.lesson_activities current_activity where current_activity.lesson_id='b17a2000-0000-4000-8000-000000001002' and current_activity.key=missing.key)) then raise exception 'As seis atividades originais precisam existir.' using errcode='23514';end if;
 if jsonb_array_length(p_document->'teacherOnly'->'quizKeys')<>1 or jsonb_array_length(p_document->'teacherOnly'->'interactiveKeys')<>2 or jsonb_array_length(p_document->'teacherOnly'->'lessonPlans')<>0 then raise exception 'Gabaritos divergentes da Aula 02.' using errcode='23514';end if;
 for a in select value from jsonb_array_elements(p_document->'activities') loop
  if jsonb_array_length(a->'prerequisites')<>0 or not private.learning_public_content_valid(a->>'type',a->'content') or not private.learning_validate_reward(a->>'type',coalesce(a->'gamification','{}')) then raise exception 'Conteúdo, pré-requisitos ou recompensa inválidos: %',a->>'key' using errcode='23514';end if;
  if a->>'type' is distinct from (case a->>'key' when 'a02-v2-video-genios' then 'video' when 'a02-v2-flashcards-seis-nomes' then 'flashcards' when 'a02-v2-detetive-tecnologia' then 'quiz' when 'a02-v2-mapa-grandes-ideias' then 'mindmap' when 'a02-v2-associacao-parte1' then 'interactive' when 'a02-v2-seis-descobertas' then 'interactive' else 'slides' end) then raise exception 'Tipo divergente para key existente.' using errcode='23514';end if;
  if a->>'type'='flashcards' and not private.flashcards_unique_ids(a->'content') then raise exception 'IDs de cartões duplicados.' using errcode='23514';end if;
  select * into b from public.lesson_activities where lesson_id='b17a2000-0000-4000-8000-000000001002' and key=a->>'key';
  target:=jsonb_build_object('title',a->>'title','description',a->>'description','activity_type',a->>'type','order_index',(a->>'orderIndex')::integer,'duration_minutes',(a->>'durationMinutes')::integer,'is_required',(a->>'required')::boolean,'content_json',a->'content','gamification_json',coalesce(a->'gamification','{}'));
  changes:=array(select field from jsonb_object_keys(target) field where to_jsonb(b)->field is distinct from target->field order by field);
  if b.id is not null and b.activity_type is distinct from a->>'type' then raise exception 'Troca de tipo não permitida.' using errcode='23514';end if;
  if a->>'type' in('quiz','interactive') then
   select x->'content' into k from jsonb_array_elements((p_document->'teacherOnly'->'quizKeys')||(p_document->'teacherOnly'->'interactiveKeys')) x where x->>'activityKey'=a->>'key';
   if (select count(*) from jsonb_array_elements((p_document->'teacherOnly'->'quizKeys')||(p_document->'teacherOnly'->'interactiveKeys')) x where x->>'activityKey'=a->>'key')<>1
   or k is distinct from(select content_json from public.activity_quiz_keys where activity_id=b.id)
   or a->'content' is distinct from b.content_json then raise exception 'Alteração de avaliação/gabarito exige versionamento separado.' using errcode='23514';end if;
  end if;
  if b.id is not null and cardinality(changes)>0 and exists(select 1 from public.web_presentation_links where activity_id=b.id) then raise exception 'Atividade com apresentação vinculada; revisar o vínculo antes de atualizar.' using errcode='23514';end if;
  rows:=rows||jsonb_build_array(jsonb_build_object('key',a->>'key','id',b.id,'action',case when b.id is null then 'insert' when cardinality(changes)=0 then 'keep' else 'update' end,'changedFields',changes,'before',case when b.id is null then null else jsonb_build_object('title',b.title,'order_index',b.order_index,'duration_minutes',b.duration_minutes,'is_required',b.is_required,'content_json',b.content_json,'description',b.description,'gamification_json',b.gamification_json,'publication_status',b.publication_status) end,'after',target));
 end loop;
 return jsonb_build_object('token',md5(s::text||p_document::text),'lessonId','b17a2000-0000-4000-8000-000000001002','actualContext',s->'context','documentContext',p_document->'context','activities',rows,'lessonBefore',s->'lesson','lessonAfter',p_document->'lesson','objectivesBefore',s->'metadata'->'objectives','objectivesAfter',p_document->'lesson'->'objectives');
end $$;
revoke all on function private.plan_a02_reconciliation(jsonb) from public,anon,authenticated,service_role;

create function public.plan_a02_reconciliation(p_document jsonb) returns jsonb
language sql security definer set search_path='' as $$select private.plan_a02_reconciliation(p_document)$$;
revoke all on function public.plan_a02_reconciliation(jsonb) from public,anon;
grant execute on function public.plan_a02_reconciliation(jsonb) to authenticated;

create function public.apply_a02_reconciliation(p_document jsonb,p_expected_token text,p_confirmed boolean) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare plan jsonb;before_state jsonb;item jsonb;old_row public.lesson_activities;target jsonb;new_document jsonb;result jsonb;new_ids jsonb:='[]';
begin
 perform private.web_presentation_admin();
 if p_confirmed is distinct from true then raise exception 'Confirme a comparação antes de salvar.' using errcode='22023';end if;
 -- Brief locks serialize history, FK insertions and inventory writes before checking
 -- the snapshot. No HTTP calls or user interaction occur while these locks are held.
 lock table public.lessons,public.lesson_activities,public.lesson_learning_metadata,public.activity_quiz_keys,
 public.activity_prerequisites,public.student_progress,public.student_activity_progress,public.quiz_attempts,
 public.activity_attempt_sessions,public.project_submissions,public.lesson_plan_sessions,
 private.flashcard_review_progress,public.student_xp_events,public.web_presentation_links,public.web_presentations,
 public.modules,public.submodules,public.courses in share row exclusive mode;
 plan:=private.plan_a02_reconciliation(p_document);
 if p_expected_token is null or plan->>'token' is distinct from p_expected_token then raise exception 'A aula ou o documento mudou. Refaça a comparação.' using errcode='40001';end if;
 before_state:=private.a02_reconciliation_state();
 for item in select value from jsonb_array_elements(plan->'activities') where value->>'action'='update' loop
  select * into strict old_row from public.lesson_activities where id=(item->>'id')::uuid;
  target:=(to_jsonb(old_row)||(item->'after'))-'updated_at';
  insert into private.a02_reconciliation_permits values(txid_current(),old_row.id,to_jsonb(old_row)-'updated_at',target);
  update public.lesson_activities set title=target->>'title',description=target->>'description',order_index=(target->>'order_index')::integer,
   duration_minutes=(target->>'duration_minutes')::integer,is_required=(target->>'is_required')::boolean,
   content_json=target->'content_json',gamification_json=target->'gamification_json' where id=old_row.id;
  delete from private.a02_reconciliation_permits where transaction_id=txid_current() and activity_id=old_row.id;
 end loop;
 -- Reuse the existing importer for the genuinely new video/cards. Their keys are
 -- known and no assessment keys or prerequisites are created by this operation.
 if exists(select 1 from jsonb_array_elements(plan->'activities') x where x->>'action'='insert') then
  new_document:=p_document||jsonb_build_object('context',plan->'actualContext','activities',
   (select jsonb_agg(a) from jsonb_array_elements(p_document->'activities') a where a->>'key' in(select x->>'key' from jsonb_array_elements(plan->'activities') x where x->>'action'='insert')),
   'teacherOnly',jsonb_build_object('quizKeys','[]'::jsonb,'interactiveKeys','[]'::jsonb,'lessonPlans','[]'::jsonb));
  result:=private.learning_import_lesson('b17a2000-0000-4000-8000-000000001002',new_document,false);
  new_ids:=result->'activityIds';
 else
  update public.lessons set description=p_document->'lesson'->>'description',duration_minutes=(p_document->'lesson'->>'durationMinutes')::integer where id='b17a2000-0000-4000-8000-000000001002';
  insert into public.lesson_learning_metadata(lesson_id,objectives) values('b17a2000-0000-4000-8000-000000001002',array(select jsonb_array_elements_text(p_document->'lesson'->'objectives')))
  on conflict(lesson_id) do update set objectives=excluded.objectives;
 end if;
 if (select count(distinct order_index) from public.lesson_activities where lesson_id='b17a2000-0000-4000-8000-000000001002')<>8 then raise exception 'Posições finais inconsistentes.' using errcode='23514';end if;
 insert into private.a02_reconciliation_audit(actor_id,document,before_state,after_state) values(auth.uid(),p_document,before_state,private.a02_reconciliation_state());
 return jsonb_build_object('newActivityIds',new_ids,'published',false,'activityCount',8);
end $$;
revoke all on function public.apply_a02_reconciliation(jsonb,text,boolean) from public,anon;
grant execute on function public.apply_a02_reconciliation(jsonb,text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
