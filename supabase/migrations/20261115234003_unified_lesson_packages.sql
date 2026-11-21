begin;
set local lock_timeout='5s';
create table private.lesson_package_kits(
 lesson_id uuid primary key references public.lessons(id),course_id uuid not null references public.courses(id),
 lesson_key text not null check(lesson_key ~ '^[a-z][a-z0-9-]{0,63}$'),origin text not null,
 slots jsonb not null,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),unique(course_id,lesson_key)
);
create table private.lesson_package_operations(
 id uuid primary key default gen_random_uuid(),lesson_id uuid not null references private.lesson_package_kits(lesson_id),
 semantic_hash text not null check(semantic_hash ~ '^[a-f0-9]{64}$'),raw_hash text not null,
 manifest jsonb not null,document jsonb not null,source_token text not null,
 status text not null default 'preparing' check(status in('preparing','ready','published')),
 draft_version integer,draft_source text,last_error text,receipt jsonb,
 created_by uuid not null references public.profiles(id),updated_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(lesson_id,semantic_hash)
);
create unique index lesson_package_one_pending on private.lesson_package_operations(lesson_id) where status<>'published';
create table private.lesson_package_productions(
 lesson_id uuid not null references public.lessons(id),production_id text not null,operation_id uuid not null references private.lesson_package_operations(id),primary key(lesson_id,production_id)
);
create table private.lesson_package_intents(
 operation_id uuid not null references private.lesson_package_operations(id),key text not null,activity_key text not null,
 presentation_id uuid not null,version_id uuid not null default gen_random_uuid(),package_hash text not null,files jsonb not null,
 primary key(operation_id,key),unique(operation_id,activity_key),unique(operation_id,presentation_id)
);
create table private.lesson_package_commit_permits(
 transaction_id bigint not null,operation_id uuid not null,lesson_id uuid not null,draft_version integer not null,source_token text not null,
 primary key(transaction_id,operation_id)
);
create index lesson_package_intent_identity on private.lesson_package_intents(presentation_id);
do $$declare t text;begin
 foreach t in array array['lesson_package_kits','lesson_package_operations','lesson_package_productions','lesson_package_intents','lesson_package_commit_permits'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);end loop;
end $$;
create function private.lesson_package_commit_allowed(p_lesson uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.learning_role()='admin' and exists(select 1 from private.lesson_package_commit_permits p join private.lesson_package_operations op on op.id=p.operation_id
 where p.transaction_id=txid_current() and p.lesson_id=p_lesson and op.lesson_id=p_lesson and op.status='ready' and p.draft_version=op.draft_version and p.source_token=op.draft_source);
$$;
create function private.lesson_package_activity_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.lesson_package_operations where lesson_id=new.lesson_id and status<>'published') and not private.lesson_package_commit_allowed(new.lesson_id) then
 raise exception 'Aula reservada por pacote pendente: use a publicacao coordenada.' using errcode='23514';end if;
 return new;
end $$;
create trigger lesson_package_reserved_activity before insert or update on public.lesson_activities for each row execute function private.lesson_package_activity_guard();
create function private.lesson_package_draft_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='published' and exists(select 1 from private.lesson_package_operations where lesson_id=new.lesson_id and status<>'published') and not private.lesson_package_commit_allowed(new.lesson_id) then
 raise exception 'Publique este rascunho pelo pacote completo.' using errcode='23514';end if;
 return new;
end $$;
create trigger lesson_package_reserved_draft before update on private.editorial_drafts for each row execute function private.lesson_package_draft_guard();
create function private.lesson_package_web_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.active_version_id is distinct from old.active_version_id and exists(select 1 from private.lesson_package_intents i join private.lesson_package_operations op on op.id=i.operation_id where i.presentation_id=new.id and op.status<>'published')
 and not private.lesson_package_commit_allowed(new.lesson_id) then raise exception 'Apresentacao reservada por pacote: publique o conjunto.' using errcode='23514';end if;
 return new;
end $$;
create trigger lesson_package_reserved_web before update on public.web_presentations for each row execute function private.lesson_package_web_guard();
create function private.lesson_package_version_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare i private.lesson_package_intents;
begin
 select intent.* into i from private.lesson_package_intents intent join private.lesson_package_operations op on op.id=intent.operation_id where intent.presentation_id=new.presentation_id and op.status<>'published';
 if i.operation_id is not null and (new.id<>i.version_id or new.package_hash<>i.package_hash or new.files<>i.files) then raise exception 'Versao diferente da preparacao reservada.' using errcode='23514';end if;
 return new;
end $$;
create trigger lesson_package_reserved_version before insert on public.web_presentation_versions for each row execute function private.lesson_package_version_guard();
create function private.lesson_package_actor(p_actor uuid) returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where id=p_actor and role='admin' and is_active) then raise exception 'Administrador ativo obrigatorio.' using errcode='42501';end if;
end $$;
create function private.lesson_package_eligibility(p_lesson uuid) returns text language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.lessons l join public.submodules s on s.id=l.submodule_id join public.modules m on m.id=s.module_id where l.id=p_lesson) then return 'Aula curricular inexistente.';end if;
 if private.editorial_has_history(p_lesson) then return 'Aula com historico: pacote inicial bloqueado.';end if;
 if exists(select 1 from public.lesson_activities where lesson_id=p_lesson) then return 'E2a aceita somente aula vazia; nenhuma atividade sera substituida.';end if;
 if exists(select 1 from public.lessons where id=p_lesson and coalesce(nullif(btrim(video_url),''),nullif(btrim(pdf_url),''),nullif(btrim(slides_url),''),nullif(btrim(meet_link),'')) is not null) then return 'Aula com materiais legados: revisar antes do pacote inicial.';end if;
 if exists(select 1 from public.web_presentations p where p.lesson_id=p_lesson and not exists(select 1 from private.lesson_package_intents i join private.lesson_package_operations op on op.id=i.operation_id where i.presentation_id=p.id and op.lesson_id=p_lesson and op.status<>'published')) then return 'Apresentacoes anteriores exigem revisao; nao serao substituidas.';end if;
 if exists(select 1 from private.editorial_drafts d where d.lesson_id=p_lesson and d.status='draft' and not exists(
 select 1 from private.lesson_package_operations op where op.lesson_id=p_lesson and op.status='ready' and op.draft_version=d.version and op.document=d.document)) then return 'Outro rascunho editorial exige revisao antes do pacote.';end if;
 return null;
end $$;
create function private.lesson_package_eligible(p_lesson uuid) returns void language plpgsql stable security definer set search_path='' as $$
declare reason text;
begin
 reason:=private.lesson_package_eligibility(p_lesson);if reason is not null then raise exception '%',reason using errcode='23514';end if;
end $$;
create function private.lesson_package_snapshot(p_lesson uuid,p_operation uuid) returns text language sql stable security definer set search_path='' as $$
 select md5(jsonb_set(private.editorial_snapshot(p_lesson),'{presentations}',coalesce((select jsonb_agg(x order by x->>'id')
 from jsonb_array_elements(private.editorial_snapshot(p_lesson)->'presentations') x
 where not exists(select 1 from private.lesson_package_intents i where i.operation_id=p_operation and i.presentation_id=(x->>'id')::uuid)),'[]'))::text);
$$;
create function public.create_lesson_package_kit(p_lesson_id uuid,p_origin text,p_lesson_key text default null) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare k private.lesson_package_kits;s jsonb;key text;
begin
 perform private.web_presentation_admin();perform private.editorial_lock();perform private.lesson_package_eligible(p_lesson_id);
 if p_origin !~ '^https://[a-zA-Z0-9.-]+(:443)?$' or length(p_origin)>253 then raise exception 'Origem HTTPS invalida.' using errcode='22023';end if;
 select * into k from private.lesson_package_kits where lesson_id=p_lesson_id;
 s:=private.editorial_snapshot(p_lesson_id);
 key:=coalesce(p_lesson_key,(select lesson_key from private.editorial_lessons where lesson_id=p_lesson_id),'aula-'||replace(p_lesson_id::text,'-',''));
 if k.lesson_id is not null then
 if k.origin<>p_origin or (p_lesson_key is not null and k.lesson_key<>p_lesson_key) then raise exception 'Kit existente tem identidade ou origem diferente.' using errcode='23514';end if;
 else
 if exists(select 1 from private.editorial_lessons where lesson_id=p_lesson_id and lesson_key<>key) then raise exception 'Key editorial divergente.' using errcode='23514';end if;
 insert into private.lesson_package_kits(lesson_id,course_id,lesson_key,origin,slots,created_by)
 values(p_lesson_id,(s->>'courseId')::uuid,key,p_origin,
 (select jsonb_agg(jsonb_build_object('key',name,'presentationId',gen_random_uuid())) from unnest(array['principal','revisao','complementar']) name),auth.uid()) returning * into k;
 end if;
 return to_jsonb(k)||jsonb_build_object('context',s->'context','lesson',s->'lesson','metadata',s->'metadata','inventory',s->'activities',
 'curriculum',(select jsonb_build_object('courseId',m.course_id,'moduleId',sm.module_id,'submoduleId',sm.id) from public.lessons l join public.submodules sm on sm.id=l.submodule_id join public.modules m on m.id=sm.module_id where l.id=p_lesson_id));
end $$;
create function public.lesson_package_state(p_lesson_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare op private.lesson_package_operations;reason text;
begin
 perform private.web_presentation_admin();
 select * into op from private.lesson_package_operations where lesson_id=p_lesson_id order by created_at desc limit 1;
 reason:=private.lesson_package_eligibility(p_lesson_id);
 return jsonb_build_object('kit',(select to_jsonb(k) from private.lesson_package_kits k where lesson_id=p_lesson_id),
 'operation',case when op.id is null then null else to_jsonb(op)||jsonb_build_object('intents',(select coalesce(jsonb_agg(to_jsonb(i) order by key),'[]') from private.lesson_package_intents i where operation_id=op.id)) end,
 'eligible',reason is null,'eligibilityReason',reason);
end $$;

create function private.lesson_package_schema() returns jsonb language sql immutable set search_path='' as $$select '{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "urn:bitaria:lesson-package:1",
  "title": "Bitaria Lesson Package v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["packageVersion", "productionId", "targetLessonId", "platformOrigin", "files"],
  "properties": {
    "packageVersion": {"const": 1},
    "productionId": {"type": "string", "pattern": "^[a-z0-9][a-z0-9._-]{0,99}$"},
    "targetLessonId": {"$ref": "#/definitions/uuid"},
    "platformOrigin": {"type": "string", "pattern": "^https://[a-zA-Z0-9.-]+(:443)?$", "maxLength": 253},
    "files": {
      "type": "array", "minItems": 1, "maxItems": 4,
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["path", "bytes", "sha256"],
        "properties": {
          "path": {"type": "string", "pattern": "^(aula\\.json|apresentacoes/[a-z][a-z0-9-]{0,63}\\.zip)$"},
          "bytes": {"type": "integer", "minimum": 1, "maximum": 10485760},
          "sha256": {"type": "string", "pattern": "^[a-f0-9]{64}$"}
        }
      }
    },
    "presentations": {
      "type": "array", "maxItems": 3,
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["key", "activityKey", "presentationId", "path"],
        "properties": {
          "key": {"$ref": "#/definitions/key"},
          "activityKey": {"$ref": "#/definitions/key"},
          "presentationId": {"$ref": "#/definitions/uuid"},
          "path": {"type": "string", "pattern": "^apresentacoes/[a-z][a-z0-9-]{0,63}\\.zip$"}
        }
      }
    },
    "teacherResources": {
      "type": "array", "maxItems": 50,
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["key", "title", "url", "kind"],
        "properties": {
          "key": {"$ref": "#/definitions/key"},
          "title": {"type": "string", "minLength": 1, "maxLength": 200, "pattern": "\\S"},
          "url": {"type": "string", "minLength": 1, "maxLength": 2048, "pattern": "^https://[^\\s]+$"},
          "kind": {"enum": ["lesson_plan", "notes", "exercise", "other"]}
        }
      }
    }
  },
  "definitions": {
    "key": {"type": "string", "pattern": "^[a-z][a-z0-9-]{0,63}$"},
    "uuid": {"type": "string", "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"}
  }
}
'::jsonb$$;
create function public.begin_lesson_package(p_actor uuid,p_lesson_id uuid,p_manifest jsonb,p_document jsonb,p_semantic_hash text,p_raw_hash text,p_decks jsonb) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare k private.lesson_package_kits;op private.lesson_package_operations;ref jsonb;found_id uuid;
begin
 perform private.lesson_package_actor(p_actor);perform private.editorial_lock();
 if not coalesce(private.learning_json_matches(private.lesson_package_schema(),p_manifest),false) then raise exception 'Manifesto invalido.' using errcode='23514';end if;
 select * into k from private.lesson_package_kits where lesson_id=p_lesson_id;
 if k.lesson_id is null or p_manifest->>'targetLessonId'<>p_lesson_id::text or p_manifest->>'platformOrigin'<>k.origin or p_document->'lesson'->>'key'<>k.lesson_key then raise exception 'Destino ou identidade diferente do kit.' using errcode='23514';end if;
 perform private.learning_validate_document(p_document);
 if p_document->>'schemaVersion'<>'2' or p_document->'context' is distinct from private.editorial_snapshot(p_lesson_id)->'context' then raise exception 'Contexto curricular divergente.' using errcode='23514';end if;
 select operation_id into found_id from private.lesson_package_productions where lesson_id=p_lesson_id and production_id=p_manifest->>'productionId';
 if found_id is not null then
 select * into op from private.lesson_package_operations where id=found_id;
 if op.semantic_hash<>p_semantic_hash then raise exception 'productionId reutilizado com conteudo diferente.' using errcode='23514';end if;
 else
 select * into op from private.lesson_package_operations where lesson_id=p_lesson_id and semantic_hash=p_semantic_hash;
 end if;
 if op.id is not null then
 insert into private.lesson_package_productions values(p_lesson_id,p_manifest->>'productionId',op.id) on conflict do nothing;
 return to_jsonb(op)||jsonb_build_object('intents',(select coalesce(jsonb_agg(to_jsonb(i) order by key),'[]') from private.lesson_package_intents i where operation_id=op.id));
 end if;
 perform private.lesson_package_eligible(p_lesson_id);
 if exists(select 1 from private.editorial_drafts where lesson_id=p_lesson_id and status='draft') or exists(select 1 from private.lesson_package_operations where lesson_id=p_lesson_id and status<>'published') then raise exception 'Ha rascunho ou operacao pendente. Retome o mesmo pacote; nao sera sobrescrito.' using errcode='23514';end if;
 if jsonb_array_length(p_decks)<>jsonb_array_length(coalesce(p_manifest->'presentations','[]')) then raise exception 'Intencoes incompletas.' using errcode='23514';end if;
 insert into private.lesson_package_operations(lesson_id,semantic_hash,raw_hash,manifest,document,source_token,created_by,updated_by)
 values(p_lesson_id,p_semantic_hash,p_raw_hash,p_manifest,p_document,'pending',p_actor,p_actor) returning * into op;
 for ref in select value from jsonb_array_elements(p_decks) loop
 if not exists(select 1 from jsonb_array_elements(k.slots) slot where slot->>'key'=ref->>'key' and slot->>'presentationId'=ref->>'presentationId')
 or not exists(select 1 from jsonb_array_elements(p_manifest->'presentations') m where m->>'key'=ref->>'key' and m->>'activityKey'=ref->>'activityKey' and m->>'presentationId'=ref->>'presentationId')
 or not exists(select 1 from jsonb_array_elements(p_document->'activities') a where a->>'key'=ref->>'activityKey' and a->>'type'='slides' and a->'content'->>'format'='link' and a->'content'->>'resourceUrl'=k.origin||'/apresentacoes/gerenciada/'||(ref->>'presentationId'))
 or exists(select 1 from public.web_presentations where id=(ref->>'presentationId')::uuid) then raise exception 'Intencao incompativel ou identidade ja utilizada.' using errcode='23514';end if;
 insert into private.lesson_package_intents(operation_id,key,activity_key,presentation_id,package_hash,files)
 values(op.id,ref->>'key',ref->>'activityKey',(ref->>'presentationId')::uuid,ref->>'packageHash',ref->'files');
 end loop;
 update private.lesson_package_operations set source_token=private.lesson_package_snapshot(p_lesson_id,op.id) where id=op.id returning * into op;
 insert into private.lesson_package_productions values(p_lesson_id,p_manifest->>'productionId',op.id);
 return to_jsonb(op)||jsonb_build_object('intents',(select coalesce(jsonb_agg(to_jsonb(i) order by key),'[]') from private.lesson_package_intents i where operation_id=op.id));
end $$;

create function public.prepared_lesson_package_version(p_actor uuid,p_operation uuid,p_key text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.lesson_package_actor(p_actor);
 select jsonb_build_object('presentationId',v.presentation_id,'versionId',v.id,'versionNumber',v.version_number,'packageHash',v.package_hash,'files',v.files) into result
 from private.lesson_package_intents i join public.web_presentation_versions v on v.id=i.version_id and v.presentation_id=i.presentation_id where i.operation_id=p_operation and i.key=p_key;
 return result;
end $$;
revoke all on function public.prepared_lesson_package_version(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.prepared_lesson_package_version(uuid,uuid,text) to service_role;
create function private.lesson_package_files(p_operation uuid) returns void language plpgsql stable security definer set search_path='' as $$
declare i private.lesson_package_intents;v public.web_presentation_versions;f jsonb;
begin
 for i in select * from private.lesson_package_intents where operation_id=p_operation loop
 select * into v from public.web_presentation_versions where id=i.version_id and presentation_id=i.presentation_id;
 if v.id is null or v.package_hash<>i.package_hash or v.files<>i.files
 or exists(select 1 from public.web_presentations where id=i.presentation_id and active_version_id is not null)
 or exists(select 1 from public.web_presentation_versions where presentation_id=i.presentation_id and id<>i.version_id) then raise exception 'Preparacao privada incompleta ou divergente.' using errcode='23514';end if;
 for f in select value from jsonb_array_elements(v.files) loop
 if not exists(select 1 from storage.objects o where bucket_id='web-presentations' and name='presentations/'||i.presentation_id::text||'/versions/'||i.version_id::text||'/'||(f->>'path') and (metadata->>'size')::bigint=(f->>'size')::bigint and metadata->>'mimetype'=f->>'mime') then raise exception 'Arquivo privado ausente.' using errcode='23514';end if;
 end loop;
 end loop;
end $$;
create function public.finish_lesson_package(p_actor uuid,p_operation uuid) returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare op private.lesson_package_operations;plan jsonb;draft jsonb;
begin
 perform private.lesson_package_actor(p_actor);perform private.editorial_lock();lock table storage.objects,public.web_presentation_versions in share row exclusive mode;
 select * into op from private.lesson_package_operations where id=p_operation for update;
 if op.id is null then raise exception 'Operacao inexistente.' using errcode='23514';end if;
 if op.status<>'preparing' then return to_jsonb(op);end if;
 perform private.lesson_package_eligible(op.lesson_id);
 if op.source_token<>private.lesson_package_snapshot(op.lesson_id,op.id) then raise exception 'A aula mudou durante a preparacao. Revisao necessaria.' using errcode='40001';end if;
 perform private.lesson_package_files(op.id);
 if exists(select 1 from private.editorial_drafts where lesson_id=op.lesson_id and status='draft') then raise exception 'Outro rascunho surgiu durante a preparacao.' using errcode='40001';end if;
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 plan:=private.editorial_plan(op.lesson_id,op.document);
 draft:=public.save_editorial_draft(op.lesson_id,op.document,plan->>'sourceToken',(plan->>'draftVersion')::int,true);
 update private.lesson_package_operations set status='ready',draft_version=(draft->>'version')::int,draft_source=draft->>'source_token',last_error=null,updated_by=p_actor,updated_at=now() where id=op.id returning * into op;
 return to_jsonb(op);
end $$;
create function public.record_lesson_package_failure(p_actor uuid,p_operation uuid,p_error text) returns void language plpgsql security definer set search_path='' as $$
begin perform private.lesson_package_actor(p_actor);
 update private.lesson_package_operations set last_error=left(p_error,500),updated_by=p_actor,updated_at=now() where id=p_operation and status='preparing';
end $$;
create function public.publish_lesson_package(p_operation uuid,p_expected_version integer,p_confirmed boolean) returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare op private.lesson_package_operations;d private.editorial_drafts;i private.lesson_package_intents;activity uuid;result jsonb;
begin
 perform private.web_presentation_admin();
 if p_confirmed is distinct from true then raise exception 'Confirme a publicacao do conjunto.' using errcode='23514';end if;
 perform private.editorial_lock(true);lock table storage.objects,public.web_presentation_versions in share row exclusive mode;
 select * into op from private.lesson_package_operations where id=p_operation for update;
 if op.id is null or op.status='preparing' or p_expected_version is distinct from op.draft_version then raise exception 'Rascunho de pacote divergente.' using errcode='40001';end if;
 if op.status='published' then return op.receipt;end if;
 perform private.lesson_package_eligible(op.lesson_id);perform private.lesson_package_files(op.id);
 select * into d from private.editorial_drafts where lesson_id=op.lesson_id;
 if d.version is distinct from op.draft_version or d.document is distinct from op.document or d.source_token is distinct from op.draft_source or d.status<>'draft' then raise exception 'Rascunho editorial foi alterado. Publicacao bloqueada.' using errcode='40001';end if;
 insert into private.lesson_package_commit_permits values(txid_current(),op.id,op.lesson_id,op.draft_version,op.draft_source);
 result:=public.publish_editorial_draft(op.lesson_id,op.draft_source,op.draft_version,true);
 for i in select * from private.lesson_package_intents where operation_id=op.id order by key loop
 perform public.publish_web_presentation(i.presentation_id,i.version_id,null,true);
 select id into activity from public.lesson_activities where lesson_id=op.lesson_id and key=i.activity_key;
 perform public.bind_web_presentation(i.presentation_id,activity,null,true);
 end loop;
 result:=result||jsonb_build_object('operationId',op.id,'presentations',(select count(*) from private.lesson_package_intents where operation_id=op.id));
 update private.lesson_package_operations set status='published',receipt=result,updated_by=auth.uid(),updated_at=now() where id=op.id;
 delete from private.lesson_package_commit_permits where transaction_id=txid_current() and operation_id=op.id;
 return result;
end $$;
do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'lesson_package_%' loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;
end $$;
revoke all on function public.create_lesson_package_kit(uuid,text,text),public.lesson_package_state(uuid),public.publish_lesson_package(uuid,integer,boolean) from public,anon,service_role;
grant execute on function public.create_lesson_package_kit(uuid,text,text),public.lesson_package_state(uuid),public.publish_lesson_package(uuid,integer,boolean) to authenticated;
revoke all on function public.begin_lesson_package(uuid,uuid,jsonb,jsonb,text,text,jsonb),public.finish_lesson_package(uuid,uuid),public.record_lesson_package_failure(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.begin_lesson_package(uuid,uuid,jsonb,jsonb,text,text,jsonb),public.finish_lesson_package(uuid,uuid),public.record_lesson_package_failure(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
