-- Flashcards: additive v2 activity. No content imports or production data updates.
begin;
create table private.flashcards_installation_backup(key text primary key,value jsonb not null);
alter table private.flashcards_installation_backup enable row level security;
revoke all on private.flashcards_installation_backup from public,anon,authenticated;
insert into private.flashcards_installation_backup select 'schema',document from private.learning_content_schemas where version=2;

update private.learning_content_schemas set document=jsonb_set(document,'{properties,activities,items,oneOf}',
 (document#>'{properties,activities,items,oneOf}')||'{"type":"object","properties":{"key":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"type":{"const":"flashcards"},"title":{"type":"string","minLength":1,"maxLength":20000},"description":{"type":"string","minLength":1,"maxLength":20000},"orderIndex":{"type":"integer","minimum":0,"maximum":100000},"durationMinutes":{"type":"integer","minimum":1,"maximum":1440},"required":{"type":"boolean"},"prerequisites":{"type":"array","items":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"minItems":0,"maxItems":200,"uniqueItems":true},"content":{"type":"object","properties":{"schemaVersion":{"const":2},"type":{"const":"flashcards"},"cards":{"type":"array","minItems":1,"maxItems":100,"items":{"type":"object","properties":{"id":{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},"front":{"type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"question":{"type":"string","minLength":1,"maxLength":1000,"pattern":"\\S"},"image":{"type":"object","properties":{"resourceUrl":{"type":"string","minLength":1,"maxLength":2048,"pattern":"^https://[a-zA-Z0-9.-]+(:443)?(/[^\\s]*)?$"},"altText":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"}},"required":["resourceUrl","altText"],"additionalProperties":false}},"required":["title","question"],"additionalProperties":false},"back":{"type":"object","properties":{"summary":{"type":"string","minLength":1,"maxLength":1000,"pattern":"\\S"},"explanation":{"type":"string","minLength":1,"maxLength":4000,"pattern":"\\S"},"impact":{"type":"string","minLength":1,"maxLength":4000,"pattern":"\\S"},"curiosity":{"type":"string","minLength":1,"maxLength":4000,"pattern":"\\S"},"image":{"type":"object","properties":{"resourceUrl":{"type":"string","minLength":1,"maxLength":2048,"pattern":"^https://[a-zA-Z0-9.-]+(:443)?(/[^\\s]*)?$"},"altText":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"}},"required":["resourceUrl","altText"],"additionalProperties":false}},"required":["summary","explanation","impact"],"additionalProperties":false}},"required":["id","front","back"],"additionalProperties":false}}},"required":["schemaVersion","type","cards"],"additionalProperties":false},"gamification":{"type":"object","properties":{"rewardRuleKey":{"enum":["activity_quiz","activity_interactive","activity_study","activity_online","activity_project","activity_final_project"]},"awardOn":{"enum":["completed","teacher_confirmed","approved"]},"achievementKeys":{"type":"array","items":{"type":"string","pattern":"^custom:[a-zA-Z0-9_-]{1,90}$"},"minItems":0,"maxItems":20,"uniqueItems":true}},"required":["rewardRuleKey","awardOn","achievementKeys"],"additionalProperties":false}},"required":["key","type","title","orderIndex","required","prerequisites","content"],"additionalProperties":false}'::jsonb) where version=2;
alter table public.lesson_activities drop constraint lesson_activities_activity_type_check;
alter table public.lesson_activities add constraint lesson_activities_activity_type_check
 check(activity_type in('slides','mindmap','quiz','online_lesson','project','interactive','video','flashcards'));

create function private.flashcards_unique_ids(p_content jsonb) returns boolean
language sql immutable set search_path='' as $$
 select jsonb_array_length(p_content->'cards')=(select count(distinct c->>'id') from jsonb_array_elements(p_content->'cards') c);
$$;
revoke all on function private.flashcards_unique_ids(jsonb) from public,anon;
grant execute on function private.flashcards_unique_ids(jsonb) to authenticated,service_role;
alter table public.lesson_activities add constraint flashcards_unique_ids
 check(activity_type<>'flashcards' or private.flashcards_unique_ids(content_json));

create table private.flashcard_review_progress(
 student_id uuid not null references public.profiles(id) on delete restrict,
 activity_id uuid not null,activity_revision integer not null,
 card_id text not null check(card_id ~ '^[a-z][a-z0-9-]{0,63}$'),
 first_reviewed_at timestamptz not null default now(),
 last_reviewed_at timestamptz not null default now(),
 primary key(student_id,activity_id,activity_revision,card_id),
 foreign key(activity_id,activity_revision) references public.lesson_activities(id,revision) on delete restrict
);
create index flashcard_review_activity on private.flashcard_review_progress(activity_id,student_id);
alter table private.flashcard_review_progress enable row level security;
revoke all on private.flashcard_review_progress from public,anon,authenticated;

-- Reuse the exact existing reward pipeline and the scoped pedagogical reader.
do $patch$
declare e record; source text;
begin
 for e in select * from(values
 ('private.learning_validate_reward(text,jsonb)','when ''video'' then rule=''activity_study''','when ''video'' then rule=''activity_study'' when ''flashcards'' then rule=''activity_study'''),
 ('private.learning_award_activity(uuid,uuid)','when ''video'' then ''activity_study''','when ''video'' then ''activity_study'' when ''flashcards'' then ''activity_study'''),
 ('private.pedagogy_lesson_detail(uuid,uuid,integer,integer)','a.revision,a.order_index,',
 'a.revision,a.order_index,case when a.activity_type=''flashcards'' then jsonb_array_length(a.content_json->''cards'') end flashcards_total,case when a.activity_type=''flashcards'' then (select count(*) from private.flashcard_review_progress f where f.student_id=p_student_id and f.activity_id=a.id and f.activity_revision=a.revision) end flashcards_reviewed,')
 ) patches(signature,needle,replacement) loop
  source:=pg_get_functiondef(e.signature::regprocedure);
  if (length(source)-length(replace(source,e.needle,'')))/length(e.needle)<>1 then
   raise exception 'Flashcards: função % diverge da versão esperada.',e.signature;
  end if;
  insert into private.flashcards_installation_backup values(e.signature,to_jsonb(source));
  execute replace(source,e.needle,e.replacement);
 end loop;
end $patch$;

create function private.require_student_flashcards(p_activity_id uuid) returns public.lesson_activities
language plpgsql stable security definer set search_path='' as $$
declare a public.lesson_activities;
begin
 if private.learning_role() is distinct from 'student' then raise exception 'Entre com uma conta de aluno ativa.' using errcode='42501';end if;
 select * into a from public.lesson_activities where id=p_activity_id and activity_type='flashcards' and is_active and publication_status='published';
 if not found then raise exception 'Cartões indisponíveis.' using errcode='42501';end if;
 perform private.learning_require_student_lesson(a.lesson_id);
 if not private.learning_prerequisites_complete(auth.uid(),a.id) then
 raise exception 'Conclua os pré-requisitos desta atividade.' using errcode='23514';end if;
 return a;
end $$;
revoke all on function private.require_student_flashcards(uuid) from public,anon,authenticated;

create function private.student_flashcard_progress(p_activity_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.lesson_activities; ids jsonb; total integer;
begin
 a:=private.require_student_flashcards(p_activity_id);
 total:=jsonb_array_length(a.content_json->'cards');
 select coalesce(jsonb_agg(c->>'id' order by position),'[]'::jsonb) into ids
 from jsonb_array_elements(a.content_json->'cards') with ordinality cards(c,position)
 where exists(select 1 from private.flashcard_review_progress f where f.student_id=auth.uid() and f.activity_id=a.id and f.activity_revision=a.revision and f.card_id=c->>'id');
 return jsonb_build_object('activity_id',a.id,'activity_revision',a.revision,'reviewed_card_ids',ids,
 'reviewed_count',jsonb_array_length(ids),'total',total,'completed',exists(select 1 from public.student_activity_progress p where p.student_id=auth.uid() and p.activity_id=a.id and p.activity_revision=a.revision and p.status='completed'));
end $$;
revoke all on function private.student_flashcard_progress(uuid) from public,anon;
grant execute on function private.student_flashcard_progress(uuid) to authenticated;
create function public.student_flashcard_progress(p_activity_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select private.student_flashcard_progress(p_activity_id);$$;
revoke all on function public.student_flashcard_progress(uuid) from public,anon;
grant execute on function public.student_flashcard_progress(uuid) to authenticated;

create function private.review_student_flashcard(p_activity_id uuid,p_card_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.lesson_activities; done boolean;
begin
 if private.learning_role() is distinct from 'student' then raise exception 'Entre com uma conta de aluno ativa.' using errcode='42501';end if;
 perform 1 from public.profiles where id=auth.uid() and is_active and role='student' for update;
 if not found then raise exception 'Entre com uma conta de aluno ativa.' using errcode='42501';end if;
 perform 1 from public.lesson_activities where id=p_activity_id for share;
 a:=private.require_student_flashcards(p_activity_id);
 if p_card_id is null or not exists(select 1 from jsonb_array_elements(a.content_json->'cards') c where c->>'id'=p_card_id) then
 raise exception 'Cartão inválido para esta atividade.' using errcode='22023';end if;
 insert into private.flashcard_review_progress(student_id,activity_id,activity_revision,card_id)
 values(auth.uid(),a.id,a.revision,p_card_id)
 on conflict(student_id,activity_id,activity_revision,card_id) do update set last_reviewed_at=now();
 select not exists(select 1 from jsonb_array_elements(a.content_json->'cards') c where not exists(
 select 1 from private.flashcard_review_progress f where f.student_id=auth.uid() and f.activity_id=a.id and f.activity_revision=a.revision and f.card_id=c->>'id')) into done;
 insert into public.student_activity_progress(student_id,activity_id,activity_revision,status,started_at,completed_at)
 values(auth.uid(),a.id,a.revision,case when done then 'completed' else 'in_progress' end,now(),case when done then now() end)
 on conflict(student_id,activity_id) do update set
 status=case when student_activity_progress.status='completed' or done then 'completed' else 'in_progress' end,
 started_at=coalesce(student_activity_progress.started_at,excluded.started_at),
 completed_at=coalesce(student_activity_progress.completed_at,excluded.completed_at);
 return private.student_flashcard_progress(a.id);
end $$;
revoke all on function private.review_student_flashcard(uuid,text) from public,anon;
grant execute on function private.review_student_flashcard(uuid,text) to authenticated;
create function public.review_student_flashcard(p_activity_id uuid,p_card_id text) returns jsonb
language sql security invoker set search_path='' as $$select private.review_student_flashcard(p_activity_id,p_card_id);$$;
revoke all on function public.review_student_flashcard(uuid,text) from public,anon;
grant execute on function public.review_student_flashcard(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
