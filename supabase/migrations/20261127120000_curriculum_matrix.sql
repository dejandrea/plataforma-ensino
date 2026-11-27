begin;
set local lock_timeout = '5s';

-- The published draft-07 schema is mirrored here for RPC-side validation.
-- The integration test compares this copy against the downloadable artifact.
create function private.curriculum_matrix_schema() returns jsonb
language sql immutable set search_path='' as $$
 select $schema${"$schema":"http://json-schema.org/draft-07/schema#","title":"Matriz curricular Bitaria v1","type":"object","additionalProperties":false,"required":["schemaVersion","course"],"properties":{"schemaVersion":{"const":1},"course":{"type":"object","required":["title"],"additionalProperties":false,"properties":{"id":{"type":"string","pattern":"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"},"title":{"type":"string","maxLength":300,"pattern":"[^\\s]"},"description":{"oneOf":[{"type":"string","maxLength":20000},{"type":"null"}]},"totalHours":{"oneOf":[{"type":"integer","minimum":0,"maximum":100000},{"type":"null"}]},"modules":{"type":"array","maxItems":1000,"items":{"type":"object","required":["title"],"additionalProperties":false,"properties":{"id":{"type":"string","pattern":"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"},"title":{"type":"string","maxLength":300,"pattern":"[^\\s]"},"description":{"oneOf":[{"type":"string","maxLength":20000},{"type":"null"}]},"orderIndex":{"oneOf":[{"type":"number","minimum":-1000000,"maximum":1000000},{"type":"null"}]},"durationMinutes":{"oneOf":[{"type":"integer","minimum":0,"maximum":1440},{"type":"null"}]},"submodules":{"type":"array","maxItems":1000,"items":{"type":"object","required":["title"],"additionalProperties":false,"properties":{"id":{"type":"string","pattern":"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"},"title":{"type":"string","maxLength":300,"pattern":"[^\\s]"},"description":{"oneOf":[{"type":"string","maxLength":20000},{"type":"null"}]},"orderIndex":{"oneOf":[{"type":"number","minimum":-1000000,"maximum":1000000},{"type":"null"}]},"durationMinutes":{"oneOf":[{"type":"integer","minimum":0,"maximum":1440},{"type":"null"}]},"lessons":{"type":"array","maxItems":1000,"items":{"type":"object","required":["title"],"additionalProperties":false,"properties":{"id":{"type":"string","pattern":"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"},"title":{"type":"string","maxLength":300,"pattern":"[^\\s]"},"description":{"oneOf":[{"type":"string","maxLength":20000},{"type":"null"}]},"orderIndex":{"oneOf":[{"type":"integer","minimum":-1000000,"maximum":1000000},{"type":"null"}]},"durationMinutes":{"oneOf":[{"type":"integer","minimum":0,"maximum":1440},{"type":"null"}]},"curriculumNumber":{"oneOf":[{"type":"integer","minimum":0,"maximum":999},{"type":"null"}]},"objectives":{"oneOf":[{"type":"array","maxItems":100,"uniqueItems":true,"items":{"type":"string","maxLength":2000,"pattern":"[^\\s]"}},{"type":"null"}]},"lessonKey":{"oneOf":[{"type":"string","pattern":"^[a-z][a-z0-9-]{0,63}$"},{"type":"null"}]}}}}}}}}}}}}}}$schema$::jsonb;
$$;

create function private.curriculum_matrix_validate(s jsonb, v jsonb, path text) returns void
language plpgsql immutable set search_path='' as $$
declare field text; child jsonb; item record;
begin
 -- Walk the structural containers to report the path of the invalid value.
 if s->>'type'='object' and jsonb_typeof(v)='object' then
  for field in select jsonb_array_elements_text(s->'required') loop
   if not v ? field then raise exception 'Campo obrigatório: %.%',path,field using errcode='22023'; end if;
  end loop;
  for field,child in select * from jsonb_each(v) loop
   if not (s->'properties') ? field then raise exception 'Campo desconhecido: %.%',path,field using errcode='22023';end if;
   perform private.curriculum_matrix_validate(s->'properties'->field,child,path||'.'||field);
  end loop;
 elsif s->'items'->>'type'='object' and jsonb_typeof(v)='array'
       and jsonb_array_length(v)<=(s->>'maxItems')::int then
  for item in select value,ordinality from jsonb_array_elements(v) with ordinality loop
   perform private.curriculum_matrix_validate(s->'items',item.value,path||'['||(item.ordinality-1)||']');
  end loop;
 elsif not private.learning_json_matches(s,v) then
  raise exception 'Valor inválido em %. Confira o tipo, a versão e os limites no schema oficial.',path using errcode='22023';
 end if;
end $$;

-- This allowlist is also the complete set of exported fields.
create function private.curriculum_matrix_rows(p_course uuid)
returns table(depth integer,id uuid,parent uuid,fields jsonb,state jsonb)
language sql stable set search_path='' as $$
 select 0,c.id,null::uuid,jsonb_build_object('title',c.title,'description',c.description,'totalHours',c.total_hours),to_jsonb(c.is_active)
 from public.courses c where c.id=p_course
 union all
 select 1,m.id,m.course_id,jsonb_build_object('title',m.title,'description',m.description,'orderIndex',m.order_index,'durationMinutes',m.duration_minutes),to_jsonb(m.is_active)
 from public.modules m where m.course_id=p_course
 union all
 select 2,s.id,s.module_id,jsonb_build_object('title',s.title,'description',s.description,'orderIndex',s.order_index,'durationMinutes',s.duration_minutes),to_jsonb(s.is_active)
 from public.submodules s join public.modules m on m.id=s.module_id where m.course_id=p_course
 union all
 select 3,l.id,l.submodule_id,jsonb_build_object('title',l.title,'description',l.description,'orderIndex',l.order_index,
   'durationMinutes',l.duration_minutes,'curriculumNumber',l.curriculum_number,'objectives',meta.objectives,'lessonKey',coalesce(e.lesson_key,k.lesson_key)),
   jsonb_build_array(l.publication_status,l.curriculum_version,l.module_id)
 from public.lessons l join public.submodules s on s.id=l.submodule_id join public.modules m on m.id=s.module_id
 left join public.lesson_learning_metadata meta on meta.lesson_id=l.id
 left join private.editorial_lessons e on e.lesson_id=l.id
 left join private.lesson_package_kits k on k.lesson_id=l.id
 where m.course_id=p_course;
$$;

create function private.curriculum_matrix_tree(p_rows jsonb,p_depth int,p_parent uuid) returns jsonb
language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(
  row.fields||jsonb_build_object('id',row.id)
  ||case when p_depth=3 then '{}'::jsonb else jsonb_build_object(
     (array['modules','submodules','lessons'])[p_depth+1],
     private.curriculum_matrix_tree(p_rows,p_depth+1,row.id)) end
  order by (row.fields->>'orderIndex')::numeric nulls last,row.id
 ),'[]'::jsonb)
 from jsonb_to_recordset(p_rows) row(depth int,id uuid,parent uuid,fields jsonb)
 where row.depth=p_depth and row.parent is not distinct from p_parent;
$$;

create function public.export_curriculum_matrix(p_course uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; doc jsonb;
begin
 perform private.web_presentation_admin();
 select jsonb_agg(to_jsonb(r)) into rows from private.curriculum_matrix_rows(p_course) r;
 if rows is null then raise exception 'Curso inexistente.' using errcode='22023'; end if;
 if jsonb_array_length(rows)>1000 then raise exception 'O curso excede o limite de 1.000 registros.' using errcode='22023';end if;
 doc:=jsonb_build_object('schemaVersion',1,'course',private.curriculum_matrix_tree(rows,0,null)->0);
 if octet_length(doc::text)>1000000 then raise exception 'O curso excede o limite de 1 MB.' using errcode='22023';end if;
 perform private.curriculum_matrix_validate(private.curriculum_matrix_schema(),doc,'matriz');
 return doc;
end $$;

create function private.curriculum_matrix_guard(p_depth int,p_id uuid,p_changes jsonb) returns text
language plpgsql stable set search_path='' as $$
begin
 if exists(
  select 1 from public.lessons l
  join public.submodules s on s.id=l.submodule_id join public.modules m on m.id=s.module_id
  where (case p_depth when 0 then m.course_id when 1 then m.id when 2 then s.id else l.id end)=p_id
  and (exists(select 1 from private.editorial_drafts d where d.lesson_id=l.id and d.status='draft')
   or exists(select 1 from private.lesson_package_operations op where op.lesson_id=l.id and op.status<>'published'))
 ) then return 'Há rascunho editorial ou pacote reservado nesta estrutura.';end if;

 if p_depth=3 and (
  private.editorial_has_history(p_id)
  or exists(select 1 from public.lesson_activities where lesson_id=p_id and (publication_status='published' or published_at is not null))
  or exists(select 1 from public.web_presentations where lesson_id=p_id and active_version_id is not null)
  or exists(select 1 from public.lessons where id=p_id and publication_status='published'
    and coalesce(nullif(btrim(video_url),''),nullif(btrim(pdf_url),''),nullif(btrim(slides_url),''),nullif(btrim(meet_link),'')) is not null)
 ) then return 'A aula tem histórico ou conteúdo publicado. Revise a mudança pelo fluxo editorial.';end if;

 if p_depth in (1,2) and p_changes ? 'orderIndex' and exists(
  select 1 from public.lessons l join public.submodules s on s.id=l.submodule_id
  where (case p_depth when 1 then s.module_id else s.id end)=p_id and l.publication_status='published'
 ) then return 'A ordem alteraria uma sequência curricular publicada.';end if;
 return null;
end $$;

create function private.curriculum_matrix_title_key(p_title text) returns text
language sql immutable set search_path='' as $$
 select lower(regexp_replace(p_title,'^\s+|\s+$','','g'));
$$;

create function private.curriculum_matrix_plan(p_mode text,p_course uuid,p_document jsonb) returns jsonb
language plpgsql stable set search_path='' as $$
declare
 existing jsonb; entry record; matched uuid; candidates uuid[]; prior jsonb; changes jsonb;
 parent_id uuid; seen uuid[]:='{}'; rows jsonb:='[]'; input_rows jsonb; incoming_title text; preserved jsonb;
 action text; match_method text; issue text; problems jsonb:='[]'; counts jsonb;
 course_in_use boolean; parent_entry jsonb; positions jsonb:='{}'; identities jsonb:='{}'; token text;
begin
 if p_mode is null or p_mode not in ('create','complement','update')
   or (p_mode='create') is distinct from (p_course is null) then
  raise exception 'Selecione o modo e o curso de destino.' using errcode='22023';
 end if;
 if p_document is null or octet_length(p_document::text)>1000000 then
  raise exception 'Envie uma matriz JSON de até 1 MB.' using errcode='22023';
 end if;
 perform private.curriculum_matrix_validate(private.curriculum_matrix_schema(),p_document,'matriz');
 with recursive nodes(depth,location,parent_location,pos,body) as (
  select 0,'course'::text,null::text,1::bigint,p_document->'course'
  union all
  select n.depth+1,n.location||'.'||key.name||'['||(x.ordinality-1)||']',n.location,x.ordinality,x.value
  from nodes n
  cross join lateral (select (array['modules','submodules','lessons'])[n.depth+1] name) key
  cross join lateral jsonb_array_elements(n.body->key.name) with ordinality x
 )
 select jsonb_agg(to_jsonb(n) order by depth,parent_location,pos) into input_rows from nodes n;
 if jsonb_array_length(input_rows)>1000 then
  raise exception 'A matriz aceita até 1.000 registros.' using errcode='22023';
 end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.depth,r.id),'[]') into existing
 from private.curriculum_matrix_rows(p_course) r;
 if p_course is not null and existing='[]'::jsonb then raise exception 'Curso de destino inexistente.' using errcode='22023';end if;

 select exists(select 1 from public.student_courses sc where sc.course_id=p_course)
     or exists(select 1 from public.student_progress sp join public.lessons l on l.id=sp.lesson_id
       join public.submodules s on s.id=l.submodule_id join public.modules m on m.id=s.module_id
       where m.course_id=p_course)
 into course_in_use;

 for entry in select * from jsonb_to_recordset(input_rows) r(depth int,location text,parent_location text,pos int,body jsonb) loop
  incoming_title:=entry.body->>'title';
  issue:=null;matched:=null;prior:='{}';match_method:=null;changes:='{}';preserved:='[]';
  parent_entry:=positions->entry.parent_location;
  parent_id:=(parent_entry->>'id')::uuid;
  if parent_entry->>'action'='conflict' then
   issue:='Resolva primeiro o conflito no registro pai.';
  elsif entry.body ? 'id' then
   matched:=(entry.body->>'id')::uuid;
   select r.fields into prior from jsonb_to_recordset(existing) r(depth int,id uuid,parent uuid,fields jsonb)
   where r.id=matched and r.depth=entry.depth and r.parent is not distinct from parent_id;
   if prior is null then issue:='O identificador não pertence ao destino e à hierarquia informados.';end if;
   match_method:='id';
   if issue is null and entry.body->>'lessonKey' is not null and entry.body->>'lessonKey' is distinct from prior->>'lessonKey' then
    issue:='A chave editorial não corresponde ao UUID informado.';
   end if;
  elsif entry.body->>'lessonKey' is not null then
   select array_agg(r.id),(jsonb_agg(r.fields)->0) into candidates,prior
   from jsonb_to_recordset(existing) r(depth int,id uuid,parent uuid,fields jsonb)
   where r.depth=3 and r.parent=parent_id and r.fields->>'lessonKey'=entry.body->>'lessonKey';
   if cardinality(candidates)=1 then matched:=candidates[1];match_method:='key';
   else issue:='A chave editorial é ambígua ou não pertence a este submódulo.';end if;
  elsif entry.depth=0 then
   if p_course is not null then
    matched:=p_course;
    select r.fields into prior from jsonb_to_recordset(existing) r(id uuid,fields jsonb) where r.id=matched;
    if prior->>'title'<>incoming_title then issue:='Use o UUID exportado para alterar o título do curso selecionado.';end if;
    match_method:='title';
   end if;
  elsif parent_id is not null then
   select array_agg(r.id), (jsonb_agg(r.fields)->0) into candidates,prior
   from jsonb_to_recordset(existing) r(depth int,id uuid,parent uuid,fields jsonb)
   where r.depth=entry.depth and r.parent=parent_id and r.fields->>'title'=incoming_title;
   if cardinality(candidates)>1 then issue:='Título ambíguo neste nível. Use os UUIDs do arquivo exportado.';
   else matched:=candidates[1];end if;
   if matched is not null then match_method:='title';
   elsif issue is null and exists(
    select 1 from jsonb_to_recordset(existing) r(depth int,parent uuid,fields jsonb)
    where r.depth=entry.depth and r.parent=parent_id
     and private.curriculum_matrix_title_key(r.fields->>'title')=private.curriculum_matrix_title_key(incoming_title)
   ) then issue:='Há um título equivalente neste nível. Use o UUID do registro existente.';
   end if;
  end if;

  if issue is null and entry.depth=0 and exists(
    select 1 from public.courses c where c.id is distinct from matched and private.curriculum_matrix_title_key(c.title)=private.curriculum_matrix_title_key(incoming_title)
  ) and (matched is null or (p_mode='update' and prior->>'title'<>incoming_title)) then
   issue:='Já existe um curso com este título.';
  end if;
  if issue is null and matched=any(seen) then issue:='O mesmo identificador foi informado mais de uma vez.';end if;
  if issue is null and matched is null and course_in_use and (
    entry.depth=1 or (entry.depth=3 and exists(
     select 1 from public.submodules s join public.modules m on m.id=s.module_id
     where m.is_active and (s.id=parent_id and s.is_active or
       parent_id is null and m.id=(positions->(parent_entry->>'parent')->>'id')::uuid)
    ))
  ) then issue:='A inclusão alteraria a sequência de um curso com alunos ou progresso. Revise a versão curricular antes de incluir.';
  end if;
  if matched is not null then seen:=array_append(seen,matched);end if;

  if issue is null then
   select coalesce(jsonb_object_agg(k,v),'{}') into changes
   from jsonb_each(entry.body-'id'-'lessonKey'-'modules'-'submodules'-'lessons') f(k,v)
   where v not in ('null','[]','""') and
    (jsonb_typeof(v)<>'string' or (v#>>'{}') ~ '[^\s]') and
    (matched is null or (prior->k is distinct from v and (p_mode='update' or
     prior->k is null or prior->k in ('null','[]','""') or
     (jsonb_typeof(prior->k)='string' and (prior->>k) !~ '[^\s]') or
     (k in ('durationMinutes','totalHours') and prior->k='0'::jsonb and v<>'0'::jsonb))));
   if matched is not null and p_mode='complement' then
    select coalesce(jsonb_agg(k order by k),'[]') into preserved
    from jsonb_each(entry.body-'id'-'lessonKey'-'modules'-'submodules'-'lessons') f(k,v)
    where v not in ('null','[]','""') and (jsonb_typeof(v)<>'string' or (v#>>'{}') ~ '[^\s]')
      and prior->k is distinct from v and not changes ? k;
   end if;
   if matched is null then
    if entry.depth=0 then
     changes:=jsonb_build_object('totalHours',0)||changes;
    else
     changes:=jsonb_build_object('orderIndex',entry.pos,'durationMinutes',0)||changes;
    end if;
   end if;
   if entry.depth>0 and changes ? 'title' then
    -- An existing spelling can remain, while new titles must stay unambiguous.
    token:=jsonb_build_array(entry.parent_location,private.curriculum_matrix_title_key(incoming_title))::text;
    if identities ? token or exists(
     select 1 from jsonb_to_recordset(existing) r(depth int,id uuid,parent uuid,fields jsonb)
     where r.depth=entry.depth and r.id is distinct from matched and r.parent=parent_id
       and private.curriculum_matrix_title_key(r.fields->>'title')=private.curriculum_matrix_title_key(incoming_title)
    ) then issue:='Título duplicado no mesmo nível.';
    else identities:=identities||jsonb_build_object(token,true);end if;
   end if;
   if issue is null and entry.depth=1 and changes ? 'orderIndex' and course_in_use and exists(
    select 1 from public.modules m where m.id=matched and m.is_active
   ) then issue:='A ordem alteraria a sequência de um curso com alunos ou progresso.';
   end if;
   if issue is null and matched is not null and changes<>'{}' then
    issue:=private.curriculum_matrix_guard(entry.depth,matched,changes);
   end if;
  end if;

  action:=case when issue is not null then 'conflict' when matched is null then 'create'
   when changes='{}' then 'unchanged' when p_mode='complement' then 'complement' else 'update' end;
  if issue is not null then problems:=problems||jsonb_build_array(entry.location||': '||issue);end if;
  positions:=positions||jsonb_build_object(entry.location,jsonb_build_object('id',matched,'action',action,'parent',entry.parent_location));
  rows:=rows||jsonb_build_array(jsonb_build_object('depth',entry.depth,'path',entry.location,'parent',entry.parent_location,
   'id',matched,'title',coalesce(prior->>'title',incoming_title),'action',action,'match',match_method,
   'before',coalesce((select jsonb_object_agg(k,prior->k) from jsonb_object_keys(changes) k where matched is not null),'{}'),
   'after',changes,'issue',issue,'preserved',preserved));
 end loop;

 -- Include omitted records in the report, with their existing parents.
 rows:=rows||coalesce((
  select jsonb_agg(jsonb_build_object('depth',r.depth,'path',r.id::text,'parent',coalesce(
   (select x->>'path' from jsonb_array_elements(rows) x where x->>'id'=r.parent::text limit 1),r.parent::text),
   'id',r.id,'title',r.fields->>'title','action','unchanged','before','{}'::jsonb,'after','{}'::jsonb)
   order by r.depth,(r.fields->>'orderIndex')::numeric,r.id)
  from jsonb_to_recordset(existing) r(depth int,id uuid,parent uuid,fields jsonb) where not r.id=any(seen)
 ),'[]'::jsonb);
 if jsonb_array_length(rows)>1000 then
  problems:=problems||jsonb_build_array('O curso resultante excederia 1.000 registros.');
 end if;
 select jsonb_object_agg(a.action,a.total) into counts from (
  select x->>'action' action,count(*) total from jsonb_array_elements(rows) x group by x->>'action'
 ) a;
 return jsonb_build_object('courseId',p_course,'courseTitle',coalesce(existing->0->'fields'->>'title',p_document->'course'->>'title'),
  'rows',rows,'counts',counts,'conflicts',problems,
  'token',encode(sha256(convert_to(jsonb_build_array(auth.uid(),p_mode,p_course,p_document,existing,course_in_use,rows)::text,'UTF8')),'hex'));
end $$;

create function public.preview_curriculum_matrix(p_mode text,p_course uuid,p_document jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.web_presentation_admin();
 return private.curriculum_matrix_plan(p_mode,p_course,p_document);
end $$;

create function public.confirm_curriculum_matrix(p_mode text,p_course uuid,p_document jsonb,p_token text,p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare plan jsonb; row jsonb; fields jsonb; ids jsonb:='{}'; result jsonb:='[]'; actual_id uuid; parent_id uuid;
begin
 perform private.web_presentation_admin();
 if p_confirmed is distinct from true or p_token is null then
  raise exception 'Confirme a prévia antes de importar.' using errcode='22023';
 end if;
 -- Coordinate with ordinary CRUD, lesson history, publishing and editorial/package reservations.
 perform private.editorial_lock();
 lock table public.student_courses in share row exclusive mode;
 perform 1 from public.profiles where id=auth.uid() for share;
 perform private.web_presentation_admin();
 plan:=private.curriculum_matrix_plan(p_mode,p_course,p_document);
 if plan->>'token' is distinct from p_token then
  raise exception 'O currículo ou a situação editorial mudou. Gere uma nova prévia.' using errcode='40001';
 end if;
 if plan->'conflicts'<>'[]' then raise exception 'Resolva os conflitos da prévia.' using errcode='23514';end if;

 for row in select value from jsonb_array_elements(plan->'rows') loop
  actual_id:=(row->>'id')::uuid;
  parent_id:=(ids->>(row->>'parent'))::uuid;
  fields:=row->'after';
  if row->>'action'='create' then
   case (row->>'depth')::int
    when 0 then
     insert into public.courses(title,description,total_hours)
     values(fields->>'title',fields->>'description',coalesce((fields->>'totalHours')::int,0)) returning id into actual_id;
     p_course:=actual_id;
    when 1 then
     insert into public.modules(course_id,title,description,order_index,duration_minutes)
     values(parent_id,fields->>'title',fields->>'description',(fields->>'orderIndex')::double precision,coalesce((fields->>'durationMinutes')::int,0)) returning id into actual_id;
    when 2 then
     insert into public.submodules(module_id,title,description,order_index,duration_minutes)
     values(parent_id,fields->>'title',fields->>'description',(fields->>'orderIndex')::double precision,coalesce((fields->>'durationMinutes')::int,0)) returning id into actual_id;
    when 3 then
     insert into public.lessons(module_id,submodule_id,title,description,order_index,duration_minutes,curriculum_number,publication_status)
     values((select module_id from public.submodules where id=parent_id),parent_id,fields->>'title',fields->>'description',
       (fields->>'orderIndex')::int,coalesce((fields->>'durationMinutes')::int,0),(fields->>'curriculumNumber')::int,'planned')
     returning id into actual_id;
   end case;
  elsif row->>'action' in ('complement','update') then
   case (row->>'depth')::int
    when 0 then
     update public.courses set title=coalesce(fields->>'title',title),description=coalesce(fields->>'description',description),
      total_hours=coalesce((fields->>'totalHours')::int,total_hours) where id=actual_id;
    when 1 then
     update public.modules set title=coalesce(fields->>'title',title),description=coalesce(fields->>'description',description),
      order_index=coalesce((fields->>'orderIndex')::double precision,order_index),
      duration_minutes=coalesce((fields->>'durationMinutes')::int,duration_minutes) where id=actual_id;
    when 2 then
     update public.submodules set title=coalesce(fields->>'title',title),description=coalesce(fields->>'description',description),
      order_index=coalesce((fields->>'orderIndex')::double precision,order_index),
      duration_minutes=coalesce((fields->>'durationMinutes')::int,duration_minutes) where id=actual_id;
    when 3 then
     if fields-'objectives'<>'{}' then
      update public.lessons set title=coalesce(fields->>'title',title),description=coalesce(fields->>'description',description),
       order_index=coalesce((fields->>'orderIndex')::int,order_index),duration_minutes=coalesce((fields->>'durationMinutes')::int,duration_minutes),
       curriculum_number=coalesce((fields->>'curriculumNumber')::int,curriculum_number) where id=actual_id;
     end if;
   end case;
  end if;
  if fields ? 'objectives' then
   insert into public.lesson_learning_metadata(lesson_id,objectives)
   values(actual_id,array(select jsonb_array_elements_text(fields->'objectives')))
   on conflict(lesson_id) do update set objectives=excluded.objectives,updated_at=now();
  end if;
  ids:=ids||jsonb_build_object(row->>'path',actual_id);
  result:=result||jsonb_build_array(row||jsonb_build_object('id',actual_id,'title',coalesce(fields->>'title',row->>'title')));
 end loop;
 return (plan-'token')||jsonb_build_object('courseId',p_course,'courseTitle',result->0->>'title','rows',result);
end $$;

revoke all on function private.curriculum_matrix_schema(),private.curriculum_matrix_validate(jsonb,jsonb,text),
 private.curriculum_matrix_rows(uuid),private.curriculum_matrix_tree(jsonb,int,uuid),private.curriculum_matrix_guard(int,uuid,jsonb),
 private.curriculum_matrix_title_key(text),private.curriculum_matrix_plan(text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.export_curriculum_matrix(uuid),public.preview_curriculum_matrix(text,uuid,jsonb),
 public.confirm_curriculum_matrix(text,uuid,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.export_curriculum_matrix(uuid),public.preview_curriculum_matrix(text,uuid,jsonb),
 public.confirm_curriculum_matrix(text,uuid,jsonb,text,boolean) to authenticated;

-- Add context to identity.json while preserving the package's strict context object.
do $patch$
declare source text; needle text:='''courseId'',m.course_id,''moduleId'',sm.module_id,''submoduleId'',sm.id';
begin
 select pg_get_functiondef('public.create_lesson_package_kit(uuid,text,text)'::regprocedure) into source;
 if (length(source)-length(replace(source,needle,'')))/length(needle)<>1 then
  raise exception 'A definição do Kit Work diverge da versão esperada.';
 end if;
 execute replace(source,needle,needle||',''courseDescription'',(select c.description from public.courses c where c.id=m.course_id),''moduleDescription'',m.description,''submoduleDescription'',sm.description');
end $patch$;
notify pgrst,'reload schema';
commit;
