begin;
set local lock_timeout='5s';
-- Extracted verbatim semantic checks from the existing inclusion importer.
create function private.learning_validate_document(p_document jsonb) returns void
language plpgsql stable security definer set search_path='' as $$
declare spec jsonb;a jsonb;entry jsonb;k jsonb;n integer;
begin
 if p_document is null then raise exception 'Documento ausente.' using errcode='22023';end if;
 if octet_length(p_document::text)>2000000 then raise exception 'JSON normalizado acima de 2.000.000 bytes UTF-8.' using errcode='22023'; end if;
 select document into spec from private.learning_content_schemas where version::text=p_document->>'schemaVersion';
 if spec is null or not private.learning_json_matches(spec,p_document) then raise exception 'JSON fora do contrato versionado.' using errcode='22023'; end if;
 n:=jsonb_array_length(p_document->'activities');
 if n<>(select count(distinct x->>'key') from jsonb_array_elements(p_document->'activities') x)
   or n<>(select count(distinct x->>'orderIndex') from jsonb_array_elements(p_document->'activities') x) then
   raise exception 'Chaves ou posicoes repetidas; conteudo existente nao sera sobrescrito.' using errcode='23514'; end if;
 if exists(select 1 from jsonb_array_elements(p_document->'activities') x,jsonb_array_elements_text(x->'prerequisites') dep
   where not exists(select 1 from jsonb_array_elements(p_document->'activities') y where y->>'key'=dep)) or exists(
   with recursive edges(src,dst) as(select x->>'key',dep from jsonb_array_elements(p_document->'activities') x,jsonb_array_elements_text(x->'prerequisites') dep),
   paths(src,dst) as(select * from edges union select p.src,e.dst from paths p join edges e on e.src=p.dst)
   select 1 from paths where src=dst) then raise exception 'Pre-requisitos invalidos ou circulares.' using errcode='23514'; end if;
 for a in select value from jsonb_array_elements(p_document->'activities') loop
   if a->>'type'='quiz' then
     select count(*),jsonb_agg(e->'content')->0 into n,k from jsonb_array_elements(p_document->'teacherOnly'->'quizKeys') e where e->>'activityKey'=a->>'key';
     if n<>1 or jsonb_array_length(k->'answers')<>jsonb_array_length(a->'content'->'questions')
       or jsonb_array_length(k->'answers')<>(select count(distinct x->>'questionKey') from jsonb_array_elements(k->'answers') x)
       or jsonb_array_length(k->'answers')<>(select count(distinct q->>'key') from jsonb_array_elements(a->'content'->'questions') q)
       or exists(select 1 from jsonb_array_elements(a->'content'->'questions') q where jsonb_array_length(q->'options')<>(select count(distinct o->>'key') from jsonb_array_elements(q->'options') o))
       or exists(select 1 from jsonb_array_elements(k->'answers') ans where not exists(select 1 from jsonb_array_elements(a->'content'->'questions') q,jsonb_array_elements(q->'options') o where q->>'key'=ans->>'questionKey' and o->>'key'=ans->>'optionKey')) then
       raise exception 'Gabarito do questionario inconsistente.' using errcode='23514'; end if;
   elsif a->>'type'='interactive' then
     select count(*),jsonb_agg(e->'content')->0 into n,k from jsonb_array_elements(p_document->'teacherOnly'->'interactiveKeys') e where e->>'activityKey'=a->>'key';
     if n<>1 or not coalesce(private.learning_interactive_key_valid(a->'content',k),false) then raise exception 'Gabarito interativo inconsistente.' using errcode='23514'; end if;
   elsif a->>'type'='online_lesson' then
     select count(*),jsonb_agg(e->'content')->0 into n,k from jsonb_array_elements(p_document->'teacherOnly'->'lessonPlans') e where e->>'activityKey'=a->>'key';
     if n<>1 or jsonb_array_length(k->'steps')<>(select count(distinct x->>'key') from jsonb_array_elements(k->'steps') x) then raise exception 'Plano pedagogico inconsistente.' using errcode='23514'; end if;
   end if;
 end loop;
 for entry in select value from jsonb_array_elements(p_document->'teacherOnly'->'quizKeys') loop
   if not exists(select 1 from jsonb_array_elements(p_document->'activities') x where x->>'key'=entry->>'activityKey' and x->>'type'='quiz') then raise exception 'Gabarito sem questionario.' using errcode='23514'; end if;
 end loop;
 for entry in select value from jsonb_array_elements(coalesce(p_document->'teacherOnly'->'interactiveKeys','[]')) loop
   if not exists(select 1 from jsonb_array_elements(p_document->'activities') x where x->>'key'=entry->>'activityKey' and x->>'type'='interactive') then raise exception 'Gabarito sem atividade interativa.' using errcode='23514'; end if;
 end loop;
 for entry in select value from jsonb_array_elements(p_document->'teacherOnly'->'lessonPlans') loop
   if not exists(select 1 from jsonb_array_elements(p_document->'activities') x where x->>'key'=entry->>'activityKey' and x->>'type'='online_lesson') then raise exception 'Plano sem atividade online.' using errcode='23514'; end if;
 end loop;

 for a in select value from jsonb_array_elements(p_document->'activities') loop
  if not private.learning_public_content_valid(a->>'type',a->'content')
   or not private.learning_validate_reward(a->>'type',coalesce(a->'gamification','{}'))
   or (a->>'type'='flashcards' and not private.flashcards_unique_ids(a->'content')) then
   raise exception 'Conteudo, recompensa ou cartoes invalidos: %',a->>'key' using errcode='23514';end if;
 end loop;
end $$;
revoke all on function private.learning_validate_document(jsonb) from public,anon,authenticated,service_role;

create or replace function private.learning_import_lesson(p_lesson_id uuid,p_document jsonb,p_publish boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare spec jsonb; a jsonb; entry jsonb; k jsonb; n integer; new_id uuid; ids uuid[]:='{}';
begin
 if private.learning_role() is distinct from 'admin' then raise exception 'Somente administradores ativos podem importar conteudo.' using errcode='42501'; end if;
 if octet_length(p_document::text)>2000000 then raise exception 'JSON normalizado acima de 2.000.000 bytes UTF-8.' using errcode='22023'; end if;
 select document into spec from private.learning_content_schemas where version::text=p_document->>'schemaVersion';
 if spec is null or not private.learning_json_matches(spec,p_document) then raise exception 'JSON fora do contrato versionado.' using errcode='22023'; end if;
 perform 1 from public.lessons l join public.submodules s on s.id=l.submodule_id join public.modules m on m.id=s.module_id join public.courses c on c.id=m.course_id
   where l.id=p_lesson_id and l.title=p_document->'lesson'->>'title' and c.title=p_document->'context'->>'courseTitle'
    and m.title=p_document->'context'->>'moduleTitle' and s.title=p_document->'context'->>'submoduleTitle' for update of l;
 if not found then raise exception 'Confira a aula, curso, modulo e submodulo de destino.' using errcode='23514'; end if;
 perform private.learning_validate_document(p_document);
 if exists(select 1 from jsonb_array_elements(p_document->'activities') x join public.lesson_activities a on a.lesson_id=p_lesson_id and a.key=x->>'key') then
 raise exception 'Chaves ou posicoes repetidas; conteudo existente nao sera sobrescrito.' using errcode='23514';end if;
 for a in select value from jsonb_array_elements(p_document->'activities') loop
   insert into public.lesson_activities(lesson_id,key,title,description,activity_type,order_index,duration_minutes,is_required,content_json,gamification_json)
     values(p_lesson_id,a->>'key',a->>'title',a->>'description',a->>'type',(a->>'orderIndex')::int,(a->>'durationMinutes')::int,(a->>'required')::boolean,a->'content',coalesce(a->'gamification','{}')) returning id into new_id;
   ids:=array_append(ids,new_id);
 end loop;
 for entry in select value from jsonb_array_elements(p_document->'teacherOnly'->'quizKeys') union all select value from jsonb_array_elements(coalesce(p_document->'teacherOnly'->'interactiveKeys','[]')) loop
   insert into public.activity_quiz_keys(activity_id,activity_type,content_json)
     select id,activity_type,entry->'content' from public.lesson_activities where lesson_id=p_lesson_id and key=entry->>'activityKey';
 end loop;
 for entry in select value from jsonb_array_elements(p_document->'teacherOnly'->'lessonPlans') loop
   insert into public.teacher_lesson_plans(activity_id,revision,content_json) select id,1,entry->'content' from public.lesson_activities where lesson_id=p_lesson_id and key=entry->>'activityKey';
 end loop;
 insert into public.activity_prerequisites(activity_id,prerequisite_activity_id)
 select a.id,b.id from jsonb_array_elements(p_document->'activities') x,jsonb_array_elements_text(x->'prerequisites') d,
 public.lesson_activities a,public.lesson_activities b where a.lesson_id=p_lesson_id and b.lesson_id=p_lesson_id and a.key=x->>'key' and b.key=d;
 insert into public.lesson_learning_metadata(lesson_id,objectives) values(p_lesson_id,array(select jsonb_array_elements_text(p_document->'lesson'->'objectives')))
   on conflict(lesson_id) do update set objectives=excluded.objectives;
 update public.lessons set description=p_document->'lesson'->>'description',duration_minutes=(p_document->'lesson'->>'durationMinutes')::integer where id=p_lesson_id;
 if p_publish then update public.lesson_activities set publication_status='published' where id=any(ids); end if;
 return jsonb_build_object('activityIds',to_jsonb(ids),'published',coalesce(p_publish,false));
end $$;

-- Private authoring state. Nothing in this schema is exposed to learners.
create table private.editorial_lessons(
 lesson_id uuid primary key references public.lessons(id) on delete restrict,
 course_id uuid not null references public.courses(id),lesson_key text not null check(lesson_key ~ '^[a-z][a-z0-9-]{0,63}$'),
 adopted_by uuid not null references public.profiles(id),adopted_at timestamptz not null default now(),unique(course_id,lesson_key)
);
create table private.editorial_drafts(
 lesson_id uuid primary key references private.editorial_lessons(lesson_id),version integer not null check(version>0),
 document jsonb not null,source_token text not null,status text not null check(status in('draft','published')),
 updated_by uuid not null references public.profiles(id),updated_at timestamptz not null default now(),receipt jsonb
);
create table private.editorial_events(
 id bigint generated always as identity primary key,lesson_id uuid not null references public.lessons(id),
 actor_id uuid not null references public.profiles(id),created_at timestamptz not null default now(),
 operation text not null check(operation in('adopt','save','publish')),draft_version integer not null,changes jsonb not null
);
create index editorial_events_lesson on private.editorial_events(lesson_id,id desc);
create table private.editorial_permits(
 transaction_id bigint not null,kind text not null,row_id uuid not null,before_row jsonb not null,after_row jsonb not null,
 id bigint generated always as identity primary key
);
create index editorial_permits_lookup on private.editorial_permits(transaction_id,kind,row_id);
revoke all on sequence private.editorial_events_id_seq,private.editorial_permits_id_seq from public,anon,authenticated,service_role;
-- Guard definitions are retained once, for a reviewed forward recovery.
create table private.editorial_guard_backups(signature text primary key,definition text not null);
do $$declare t text;begin
 foreach t in array array['editorial_lessons','editorial_drafts','editorial_events','editorial_permits','editorial_guard_backups'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;
create trigger editorial_events_immutable before update or delete on private.editorial_events
 for each row execute function private.learning_reject_history_change();

create function private.editorial_permitted(p_kind text,p_id uuid,p_before jsonb,p_after jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select private.learning_role()='admin' and exists(select 1 from private.editorial_permits
 where transaction_id=txid_current() and kind=p_kind and row_id=p_id and before_row=p_before and after_row=p_after);
$$;
-- Separate exact-row permits; the existing A02 exception is not changed.
do $$declare body text;needle text;signature text;replacement text;begin
 for signature,needle,replacement in values
 ('private.learning_guard_activity()',
 'if old.published_at is not null and not private.a02_reconciliation_permitted(old,new) and',
 'if old.published_at is not null and not private.a02_reconciliation_permitted(old,new) and not private.editorial_permitted(''activity'',old.id,to_jsonb(old)-''updated_at'',to_jsonb(new)-''updated_at'') and'),
 ('private.learning_guard_quiz_key()',
 'if exists(select 1 from public.lesson_activities where id=old.activity_id and published_at is not null) then',
 'if exists(select 1 from public.lesson_activities where id=old.activity_id and published_at is not null) and not private.editorial_permitted(''key'',old.activity_id,to_jsonb(old)-''updated_at'',case when tg_op=''DELETE'' then ''null''::jsonb else to_jsonb(new)-''updated_at'' end) then'),
 ('private.learning_guard_prerequisite()',
 'if exists(select 1 from public.lesson_activities where id=source_id and published_at is not null) then',
 'if exists(select 1 from public.lesson_activities where id=source_id and published_at is not null) and not private.editorial_permitted(''dependency'',source_id,case when tg_op=''INSERT'' then ''null''::jsonb else to_jsonb(old) end,case when tg_op=''DELETE'' then ''null''::jsonb else to_jsonb(new) end) then')
 loop
 body:=pg_get_functiondef(signature::regprocedure);
 if length(body)-length(replace(body,needle,''))<>length(needle) then raise exception 'Guard divergente: %',signature;end if;
 insert into private.editorial_guard_backups values(signature,body);
 execute replace(body,needle,replacement);
 end loop;
end $$;

create function private.editorial_has_history(p_lesson_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.student_progress where lesson_id=p_lesson_id)
 or exists(select 1 from public.student_activity_progress p join public.lesson_activities a on a.id=p.activity_id where a.lesson_id=p_lesson_id)
 or exists(select 1 from public.quiz_attempts p join public.lesson_activities a on a.id=p.activity_id where a.lesson_id=p_lesson_id)
 or exists(select 1 from public.activity_attempt_sessions p join public.lesson_activities a on a.id=p.activity_id where a.lesson_id=p_lesson_id)
 or exists(select 1 from public.project_submissions p join public.lesson_activities a on a.id=p.activity_id where a.lesson_id=p_lesson_id)
 or exists(select 1 from public.lesson_plan_sessions p join public.lesson_activities a on a.id=p.activity_id where a.lesson_id=p_lesson_id)
 or exists(select 1 from private.flashcard_review_progress p join public.lesson_activities a on a.id=p.activity_id where a.lesson_id=p_lesson_id)
 or exists(select 1 from public.student_xp_events e where e.source_id=p_lesson_id or e.source_id in(select id from public.lesson_activities where lesson_id=p_lesson_id));
$$;

create function private.editorial_snapshot(p_lesson_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('lesson',(select to_jsonb(l) from public.lessons l where l.id=p_lesson_id),
 'context',(select jsonb_build_object('courseTitle',c.title,'moduleTitle',m.title,'submoduleTitle',s.title) from public.lessons l
 join public.submodules s on s.id=l.submodule_id join public.modules m on m.id=s.module_id join public.courses c on c.id=m.course_id where l.id=p_lesson_id),
 'courseId',(select m.course_id from public.lessons l join public.submodules s on s.id=l.submodule_id join public.modules m on m.id=s.module_id where l.id=p_lesson_id),
 'metadata',(select to_jsonb(x) from public.lesson_learning_metadata x where lesson_id=p_lesson_id),
 'activities',(select coalesce(jsonb_agg(to_jsonb(a) order by a.key),'[]') from public.lesson_activities a where lesson_id=p_lesson_id),
 'keys',(select coalesce(jsonb_agg(to_jsonb(k) order by k.activity_id),'[]') from public.activity_quiz_keys k join public.lesson_activities a on a.id=k.activity_id where a.lesson_id=p_lesson_id),
 'plans',(select coalesce(jsonb_agg(to_jsonb(k) order by k.activity_id,k.revision),'[]') from public.teacher_lesson_plans k join public.lesson_activities a on a.id=k.activity_id where a.lesson_id=p_lesson_id),
 'dependencies',(select coalesce(jsonb_agg(to_jsonb(d) order by d.activity_id,d.prerequisite_activity_id),'[]') from public.activity_prerequisites d join public.lesson_activities a on a.id=d.activity_id where a.lesson_id=p_lesson_id),
 'links',(select coalesce(jsonb_agg(to_jsonb(k) order by k.activity_id),'[]') from public.web_presentation_links k join public.lesson_activities a on a.id=k.activity_id where a.lesson_id=p_lesson_id),
 'presentations',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') from public.web_presentations p where lesson_id=p_lesson_id));
$$;

create function private.editorial_document(p_lesson_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('schemaVersion',2,'context',private.editorial_snapshot(p_lesson_id)->'context',
 'lesson',jsonb_strip_nulls(jsonb_build_object('key',(select lesson_key from private.editorial_lessons where lesson_id=l.id),
 'title',l.title,'description',l.description,'durationMinutes',l.duration_minutes,'objectives',m.objectives)),
 'activities',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('key',a.key,'type',a.activity_type,'title',a.title,
 'description',a.description,'orderIndex',a.order_index,'durationMinutes',a.duration_minutes,'required',a.is_required,
 'content',a.content_json,'gamification',nullif(a.gamification_json,'{}'::jsonb),
 'prerequisites',(select coalesce(jsonb_agg(b.key order by b.key),'[]') from public.activity_prerequisites d join public.lesson_activities b on b.id=d.prerequisite_activity_id where d.activity_id=a.id))) order by a.order_index,a.key)
 from public.lesson_activities a where a.lesson_id=l.id),'[]'),
 'teacherOnly',jsonb_build_object(
 'quizKeys',coalesce((select jsonb_agg(jsonb_build_object('activityKey',a.key,'content',k.content_json) order by a.key) from public.activity_quiz_keys k join public.lesson_activities a on a.id=k.activity_id where a.lesson_id=l.id and a.activity_type='quiz'),'[]'),
 'interactiveKeys',coalesce((select jsonb_agg(jsonb_build_object('activityKey',a.key,'content',k.content_json) order by a.key) from public.activity_quiz_keys k join public.lesson_activities a on a.id=k.activity_id where a.lesson_id=l.id and a.activity_type='interactive'),'[]'),
 'lessonPlans',coalesce((select jsonb_agg(jsonb_build_object('activityKey',a.key,'content',k.content_json) order by a.key) from public.lesson_activities a join lateral(select content_json from public.teacher_lesson_plans p where p.activity_id=a.id order by revision desc limit 1) k on true where a.lesson_id=l.id),'[]')))
 from public.lessons l left join public.lesson_learning_metadata m on m.lesson_id=l.id where l.id=p_lesson_id;
$$;

create function private.editorial_plan(p_lesson_id uuid,p_document jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s jsonb;current_doc jsonb;merged jsonb;items jsonb;teacher jsonb;section text;a jsonb;b jsonb;row_info jsonb;
 rows jsonb:='[]';classes text[];lesson_classes text[]:='{}';fields text[];issues jsonb:='[]';stable_key text;
begin
 perform private.web_presentation_admin();
 perform private.learning_validate_document(p_document);
 s:=private.editorial_snapshot(p_lesson_id);current_doc:=private.editorial_document(p_lesson_id);
 if s->'lesson'='null'::jsonb or s->>'courseId' is null then raise exception 'Aula curricular de destino inexistente.' using errcode='23514';end if;
 if s->'context' is distinct from p_document->'context' then raise exception 'Contexto diferente da aula selecionada.' using errcode='23514';end if;
 select lesson_key into stable_key from private.editorial_lessons where lesson_id=p_lesson_id;
 if stable_key is not null and stable_key is distinct from p_document->'lesson'->>'key' then raise exception 'Key estavel da aula divergente.' using errcode='23514';end if;
 if exists(select 1 from private.editorial_lessons where course_id=(s->>'courseId')::uuid and lesson_key=p_document->'lesson'->>'key' and lesson_id<>p_lesson_id) then raise exception 'Key ja vinculada a outra aula.' using errcode='23514';end if;
 if private.editorial_has_history(p_lesson_id) then issues:=issues||jsonb_build_array('Aula com historico de aprendizagem; E3 necessario.');end if;
 items:=p_document->'activities'||coalesce((select jsonb_agg(x) from jsonb_array_elements(current_doc->'activities') x where not exists(select 1 from jsonb_array_elements(p_document->'activities') y where y->>'key'=x->>'key')),'[]');
 teacher:=p_document->'teacherOnly';
 foreach section in array array['quizKeys','interactiveKeys','lessonPlans'] loop
 if section='interactiveKeys' and p_document->>'schemaVersion'='1' then
 if jsonb_array_length(current_doc->'teacherOnly'->'interactiveKeys')>0 then raise exception 'Use contrato v2 para preservar atividades interativas.' using errcode='23514';end if;
 continue;
 end if;
 teacher:=jsonb_set(teacher,array[section],coalesce(teacher->section,'[]')||coalesce((select jsonb_agg(x) from jsonb_array_elements(current_doc->'teacherOnly'->section) x where not exists(select 1 from jsonb_array_elements(p_document->'activities') y where y->>'key'=x->>'activityKey')),'[]'));
 end loop;
 merged:=jsonb_set(jsonb_set(p_document,'{activities}',items),'{teacherOnly}',teacher);
 -- Validate the FINAL inventory, including omitted records and their dependencies.
 perform private.learning_validate_document(merged);
 for a in select value from jsonb_array_elements(items) loop
 select x into b from jsonb_array_elements(current_doc->'activities') x where x->>'key'=a->>'key';
 select x into row_info from jsonb_array_elements(s->'activities') x where x->>'key'=a->>'key';
 fields:=array(select field from jsonb_object_keys(a||coalesce(b,'{}')) field where a->field is distinct from b->field order by field);
 classes:='{}';
 if b is null then classes:=array['new'];else
 if b->>'type' is distinct from a->>'type' then classes:=array_append(classes,'incompatible');issues:=issues||jsonb_build_array('Troca de tipo bloqueada: '||(a->>'key'));end if;
 if coalesce(a->'gamification','{}') is distinct from coalesce(b->'gamification','{}') then classes:=array_append(classes,'conflict');issues:=issues||jsonb_build_array('Regra de XP existente deve ser preservada: '||(a->>'key'));end if;
 if a-array['title','description','content','orderIndex','prerequisites','required','durationMinutes','gamification'] is distinct from b-array['title','description','content','orderIndex','prerequisites','required','durationMinutes','gamification'] then classes:=array_append(classes,'structural');end if;
 if a->'title' is distinct from b->'title' or a->'description' is distinct from b->'description' then classes:=array_append(classes,'editorial');end if;
 if a->'orderIndex' is distinct from b->'orderIndex' or a->'required' is distinct from b->'required' or a->'prerequisites' is distinct from b->'prerequisites' or a->'durationMinutes' is distinct from b->'durationMinutes' then classes:=array_append(classes,'structural');end if;
 if a->'content' is distinct from b->'content' then
 classes:=array_append(classes,case when a->>'type' in('video','slides','mindmap') then 'resource' else 'pedagogical' end);end if;
 foreach section in array array['quizKeys','interactiveKeys','lessonPlans'] loop
 if (select x->'content' from jsonb_array_elements(teacher->section) x where x->>'activityKey'=a->>'key') is distinct from
 (select x->'content' from jsonb_array_elements(current_doc->'teacherOnly'->section) x where x->>'activityKey'=a->>'key') then
 classes:=array_append(classes,'pedagogical');fields:=array_append(fields,'teacherOnly.'||section);end if;
 end loop;
 if cardinality(fields)>0 and exists(select 1 from public.web_presentation_links where activity_id=(row_info->>'id')::uuid) then issues:=issues||jsonb_build_array('Vinculo de apresentacao exige revisao: '||(a->>'key'));classes:=array_append(classes,'conflict');end if;
 if row_info->>'is_active'='false' then issues:=issues||jsonb_build_array('Atividade inativa exige revisao: '||(a->>'key'));classes:=array_append(classes,'conflict');end if;
 if cardinality(classes)=0 then classes:=array['unchanged'];end if;
 end if;
 rows:=rows||jsonb_build_array(jsonb_build_object('key',a->>'key','id',row_info->'id','classes',classes,'changedFields',fields,'before',b,'after',a,
 'publicationBefore',row_info->'publication_status',
 'publicationAfter',case when exists(select 1 from jsonb_array_elements(p_document->'activities') x where x->>'key'=a->>'key') then 'published' else row_info->>'publication_status' end,
 'omitted',not exists(select 1 from jsonb_array_elements(p_document->'activities') x where x->>'key'=a->>'key')));
 end loop;
 if current_doc->'lesson'->'title' is distinct from p_document->'lesson'->'title' or current_doc->'lesson'->'description' is distinct from p_document->'lesson'->'description' then lesson_classes:=array_append(lesson_classes,'editorial');end if;
 if current_doc->'lesson'->'durationMinutes' is distinct from p_document->'lesson'->'durationMinutes' then lesson_classes:=array_append(lesson_classes,'structural');end if;
 if current_doc->'lesson'->'objectives' is distinct from p_document->'lesson'->'objectives' then lesson_classes:=array_append(lesson_classes,'pedagogical');end if;
 if cardinality(lesson_classes)=0 then lesson_classes:=array['unchanged'];end if;
 return jsonb_build_object('lessonId',p_lesson_id,'sourceToken',md5(s::text),'draftVersion',coalesce((select version from private.editorial_drafts where lesson_id=p_lesson_id),0),
 'needsIdentity',stable_key is null,'canSave',jsonb_array_length(issues)=0,'issues',issues,'activities',rows,'document',merged,
 'lessonBefore',current_doc->'lesson','lessonAfter',p_document->'lesson','lessonClasses',lesson_classes,
 'teacherChanges',private.editorial_delta(current_doc->'teacherOnly',teacher));
end $$;

create function public.admin_editorial_lesson(p_lesson_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.web_presentation_admin();
 if not exists(select 1 from public.lessons where id=p_lesson_id) then raise exception 'Aula inexistente.' using errcode='23514';end if;
 return jsonb_build_object('document',private.editorial_document(p_lesson_id),'lessonTitle',(select title from public.lessons where id=p_lesson_id),'sourceToken',md5(private.editorial_snapshot(p_lesson_id)::text),
 'hasHistory',private.editorial_has_history(p_lesson_id),'draft',(select to_jsonb(d) from private.editorial_drafts d where lesson_id=p_lesson_id),
 'events',(select coalesce(jsonb_agg(x order by x.id desc),'[]') from(select id,operation,draft_version,created_at from private.editorial_events where lesson_id=p_lesson_id order by id desc limit 30)x));
end $$;
create function public.plan_editorial_lesson(p_lesson_id uuid,p_document jsonb) returns jsonb
language sql stable security definer set search_path='' as $$select private.editorial_plan(p_lesson_id,p_document)$$;

-- A compact reversible patch, with paths and only differing values. One current
-- draft is stored; audit does not repeat unchanged full documents on each save.
create function private.editorial_delta(p_before jsonb,p_after jsonb,p_path text[] default '{}') returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb:='[]';k text;i integer;
begin
 if p_before is not distinct from p_after then return result;end if;
 if jsonb_typeof(p_before)='object' and jsonb_typeof(p_after)='object' then
 for k in select jsonb_object_keys(p_before||p_after) loop
 result:=result||private.editorial_delta(p_before->k,p_after->k,p_path||k);end loop;
 elsif jsonb_typeof(p_before)='array' and jsonb_typeof(p_after)='array' then
 for i in 0..greatest(jsonb_array_length(p_before),jsonb_array_length(p_after))-1 loop
 result:=result||private.editorial_delta(p_before->i,p_after->i,p_path||i::text);end loop;
 else
 result:=jsonb_build_array(jsonb_build_object('path',p_path,'before',p_before,'after',p_after,'beforeExists',p_before is not null,'afterExists',p_after is not null));
 end if;
 return result;
end $$;

create function private.editorial_lock(p_publishing boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 -- Drain ALL readers before publishing. In particular, the existing teacher
 -- linking RPC reads its activity/plan before creating a session without FOR SHARE.
 -- A write-only history lock would allow that stale session to arrive afterwards.
 -- No learner RPC is rewritten in E1a. These locks are short, fail closed and also
 -- block reads; verify real PostgreSQL contention before deployment.
 if p_publishing then
 lock table public.lessons,public.lesson_activities in access exclusive mode;
 end if;
 -- Same ordering as A02, plus plans. No HTTP or user interaction under locks.
 lock table public.lessons,public.lesson_activities,public.lesson_learning_metadata,public.activity_quiz_keys,
 public.activity_prerequisites,public.student_progress,public.student_activity_progress,public.quiz_attempts,
 public.activity_attempt_sessions,public.project_submissions,public.lesson_plan_sessions,
 private.flashcard_review_progress,public.student_xp_events,public.web_presentation_links,public.web_presentations,
 public.modules,public.submodules,public.courses,public.teacher_lesson_plans,
 private.editorial_lessons,private.editorial_drafts in share row exclusive mode;
end $$;

create function public.save_editorial_draft(p_lesson_id uuid,p_document jsonb,p_expected_source text,p_expected_version integer,p_confirm_identity boolean) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare plan jsonb;d private.editorial_drafts;v integer;prior_document jsonb;
begin
 perform private.web_presentation_admin();perform private.editorial_lock();
 plan:=private.editorial_plan(p_lesson_id,p_document);
 select * into d from private.editorial_drafts where lesson_id=p_lesson_id;
 prior_document:=d.document;
 if p_expected_source is distinct from plan->>'sourceToken' or p_expected_version is distinct from coalesce(d.version,0) then raise exception 'Concorrencia: recarregue e compare novamente.' using errcode='40001';end if;
 if plan->>'canSave'<>'true' then raise exception 'Conflitos: %',plan->'issues' using errcode='23514';end if;
 if plan->>'needsIdentity'='true' then
 if p_confirm_identity is distinct from true then raise exception 'Confirme a identidade da aula selecionada.' using errcode='23514';end if;
 insert into private.editorial_lessons(lesson_id,course_id,lesson_key,adopted_by) values(p_lesson_id,(private.editorial_snapshot(p_lesson_id)->>'courseId')::uuid,p_document->'lesson'->>'key',auth.uid());
 insert into private.editorial_events(lesson_id,actor_id,operation,draft_version,changes) values(p_lesson_id,auth.uid(),'adopt',1,jsonb_build_object('key',p_document->'lesson'->>'key'));
 end if;
 if d.status='draft' and d.document=p_document and d.source_token=plan->>'sourceToken' then return to_jsonb(d);end if;
 v:=coalesce(d.version,0)+1;
 insert into private.editorial_drafts(lesson_id,version,document,source_token,status,updated_by)
 values(p_lesson_id,v,p_document,plan->>'sourceToken','draft',auth.uid())
 on conflict(lesson_id) do update set version=v,document=p_document,source_token=plan->>'sourceToken',status='draft',updated_by=auth.uid(),updated_at=now(),receipt=null returning * into d;
 insert into private.editorial_events(lesson_id,actor_id,operation,draft_version,changes) values(p_lesson_id,auth.uid(),'save',v,
 jsonb_build_object('sourceToken',d.source_token,'patch',private.editorial_delta(coalesce(prior_document,'{}'),p_document)));
 return to_jsonb(d);
end $$;

create function public.publish_editorial_draft(p_lesson_id uuid,p_expected_source text,p_expected_version integer,p_confirmed boolean) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare d private.editorial_drafts;plan jsonb;doc jsonb;before_document jsonb;item jsonb;a jsonb;entry jsonb;section text;new_id uuid;
 old_row public.lesson_activities;after_row public.lesson_activities;old_key public.activity_quiz_keys;new_key public.activity_quiz_keys;
edge record;dep text;target_id uuid;result_receipt jsonb;
begin
 perform private.web_presentation_admin();
 if p_confirmed is distinct from true then raise exception 'Confirme a publicacao separadamente.' using errcode='23514';end if;
 perform private.editorial_lock(true);select * into d from private.editorial_drafts where lesson_id=p_lesson_id for update;
 if d.version is null or d.version is distinct from p_expected_version or d.source_token is distinct from p_expected_source then raise exception 'Rascunho divergente; recarregue.' using errcode='40001';end if;
 if d.status='published' then return d.receipt;end if;
 plan:=private.editorial_plan(p_lesson_id,d.document);
 if plan->>'sourceToken' is distinct from d.source_token then raise exception 'Conteudo mudou; compare novamente.' using errcode='40001';end if;
 if plan->>'canSave'<>'true' then raise exception 'Publicacao bloqueada: %',plan->'issues' using errcode='23514';end if;
 doc:=plan->'document';before_document:=private.editorial_document(p_lesson_id);
 -- Insert new activities as drafts. Existing identities and revisions never change.
 for item in select value from jsonb_array_elements(plan->'activities') loop
 a:=item->'after';
 if item->>'id' is null then
 insert into public.lesson_activities(lesson_id,key,title,description,activity_type,order_index,duration_minutes,is_required,content_json,gamification_json)
 values(p_lesson_id,a->>'key',a->>'title',a->>'description',a->>'type',(a->>'orderIndex')::int,(a->>'durationMinutes')::int,(a->>'required')::boolean,a->'content',coalesce(a->'gamification','{}'));
 end if;
 end loop;
 -- Update private assessments before public content; validation above covers both.
 foreach section in array array['quizKeys','interactiveKeys'] loop
 for entry in select value from jsonb_array_elements(coalesce(doc->'teacherOnly'->section,'[]')) loop
 select id into target_id from public.lesson_activities where lesson_id=p_lesson_id and key=entry->>'activityKey';
 select * into old_key from public.activity_quiz_keys where activity_id=target_id;
 if old_key.activity_id is null then
 insert into public.activity_quiz_keys(activity_id,activity_type,content_json) select id,activity_type,entry->'content' from public.lesson_activities where id=target_id;
 elsif old_key.content_json is distinct from entry->'content' then
 new_key:=old_key;new_key.content_json:=entry->'content';
 insert into private.editorial_permits values(txid_current(),'key',target_id,to_jsonb(old_key)-'updated_at',to_jsonb(new_key)-'updated_at');
 update public.activity_quiz_keys set content_json=new_key.content_json where activity_id=target_id;
 end if;
 end loop;
 end loop;
 for entry in select value from jsonb_array_elements(doc->'teacherOnly'->'lessonPlans') loop
 select id into target_id from public.lesson_activities where lesson_id=p_lesson_id and key=entry->>'activityKey';
 if entry->'content' is distinct from(select content_json from public.teacher_lesson_plans where activity_id=target_id order by revision desc limit 1) then
 insert into public.teacher_lesson_plans(activity_id,revision,content_json) select target_id,coalesce(max(revision),0)+1,entry->'content' from public.teacher_lesson_plans where activity_id=target_id;
 end if;
 end loop;
 -- Replace only changed dependency sets. All removals precede additions.
 for item in select value from jsonb_array_elements(plan->'activities') where value->'before'->'prerequisites' is distinct from value->'after'->'prerequisites' loop
 select id into target_id from public.lesson_activities where lesson_id=p_lesson_id and key=item->>'key';
 for edge in select * from public.activity_prerequisites where activity_id=target_id loop
 insert into private.editorial_permits values(txid_current(),'dependency',target_id,to_jsonb(edge),'null');
 delete from public.activity_prerequisites where activity_id=target_id and prerequisite_activity_id=edge.prerequisite_activity_id;
 end loop;
 end loop;
 for item in select value from jsonb_array_elements(plan->'activities') where value->'before'->'prerequisites' is distinct from value->'after'->'prerequisites' loop
 select id into target_id from public.lesson_activities where lesson_id=p_lesson_id and key=item->>'key';
 for dep in select jsonb_array_elements_text(item->'after'->'prerequisites') loop
 select id into new_id from public.lesson_activities where lesson_id=p_lesson_id and key=dep;
 insert into private.editorial_permits values(txid_current(),'dependency',target_id,'null',jsonb_build_object('activity_id',target_id,'prerequisite_activity_id',new_id));
 insert into public.activity_prerequisites values(target_id,new_id);
 end loop;
 end loop;
 for item in select value from jsonb_array_elements(plan->'activities') loop
 a:=item->'after';select * into old_row from public.lesson_activities where lesson_id=p_lesson_id and key=item->>'key';
 after_row:=old_row;after_row.title:=a->>'title';after_row.description:=a->>'description';after_row.order_index:=(a->>'orderIndex')::int;
 after_row.duration_minutes:=(a->>'durationMinutes')::int;after_row.is_required:=(a->>'required')::boolean;after_row.content_json:=a->'content';
 -- An omitted activity retains its exact row and publication state.
 if item->>'omitted'<>'true' then
 if old_row.published_at is not null then
 insert into private.editorial_permits values(txid_current(),'activity',old_row.id,to_jsonb(old_row)-'updated_at',to_jsonb(after_row)-'updated_at') on conflict do nothing;
 end if;
 update public.lesson_activities set title=after_row.title,description=after_row.description,order_index=after_row.order_index,
 duration_minutes=after_row.duration_minutes,is_required=after_row.is_required,content_json=after_row.content_json where id=old_row.id;
 update public.lesson_activities set publication_status='published' where id=old_row.id and publication_status<>'published';
 end if;
 end loop;
 update public.lessons set title=doc->'lesson'->>'title',description=doc->'lesson'->>'description',duration_minutes=(doc->'lesson'->>'durationMinutes')::int where id=p_lesson_id;
 insert into public.lesson_learning_metadata(lesson_id,objectives) values(p_lesson_id,array(select jsonb_array_elements_text(doc->'lesson'->'objectives')))
 on conflict(lesson_id) do update set objectives=excluded.objectives;
 result_receipt:=jsonb_build_object('lessonId',p_lesson_id,'draftVersion',d.version,'published',true,'activities',jsonb_array_length(doc->'activities'));
 insert into private.editorial_events(lesson_id,actor_id,operation,draft_version,changes)
 values(p_lesson_id,auth.uid(),'publish',d.version,jsonb_build_object('patch',private.editorial_delta(before_document,doc),
 'identities',(select jsonb_agg(jsonb_build_object('id',id,'key',key) order by key) from public.lesson_activities where lesson_id=p_lesson_id)));
 update private.editorial_drafts set status='published',receipt=result_receipt,updated_at=now(),updated_by=auth.uid() where lesson_id=p_lesson_id;
 delete from private.editorial_permits where transaction_id=txid_current();
 return result_receipt;
end $$;

-- Deny all private helpers, including SECURITY DEFINER functions' default PUBLIC grant.
do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'editorial_%' loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
end $$;
revoke all on function public.admin_editorial_lesson(uuid),public.plan_editorial_lesson(uuid,jsonb),
 public.save_editorial_draft(uuid,jsonb,text,integer,boolean),public.publish_editorial_draft(uuid,text,integer,boolean) from public,anon,service_role;
grant execute on function public.admin_editorial_lesson(uuid),public.plan_editorial_lesson(uuid,jsonb),
 public.save_editorial_draft(uuid,jsonb,text,integer,boolean),public.publish_editorial_draft(uuid,text,integer,boolean) to authenticated;
commit;
