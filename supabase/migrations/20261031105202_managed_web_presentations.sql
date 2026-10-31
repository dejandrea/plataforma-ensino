-- Repository-only implementation. No existing activity/content/progress is rewritten.
begin;
set local lock_timeout='5s';
create table public.web_presentations(
 id uuid primary key default gen_random_uuid(),
 lesson_id uuid not null references public.lessons(id) on delete restrict,
 title text not null check(length(trim(title)) between 1 and 160),
 active_version_id uuid,
 created_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index web_presentations_lesson on public.web_presentations(lesson_id);
create table public.web_presentation_versions(
 id uuid primary key,presentation_id uuid not null references public.web_presentations(id) on delete restrict,
 version_number integer not null check(version_number>0),
 title text not null check(length(trim(title)) between 1 and 160),
 package_hash text not null check(package_hash ~ '^[a-f0-9]{64}$'),
 files jsonb not null check(jsonb_typeof(files)='array' and jsonb_array_length(files) between 1 and 80),
 warnings jsonb not null default '[]' check(jsonb_typeof(warnings)='array'),
 slide_count integer not null check(slide_count between 1 and 60),
 created_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(presentation_id,version_number),unique(presentation_id,id),unique(presentation_id,package_hash)
);
alter table public.web_presentations add constraint web_presentations_active_version
 foreign key(id,active_version_id) references public.web_presentation_versions(presentation_id,id) on delete restrict;
create table public.web_presentation_links(
 activity_id uuid primary key references public.lesson_activities(id) on delete restrict,
 presentation_id uuid not null references public.web_presentations(id) on delete restrict,
 linked_by uuid not null references public.profiles(id) on delete restrict,
 linked_at timestamptz not null default now()
);
create index web_presentation_links_presentation on public.web_presentation_links(presentation_id);
create table private.web_presentation_events(
 id bigint generated always as identity primary key,
 presentation_id uuid not null references public.web_presentations(id) on delete restrict,
 actor_id uuid not null references public.profiles(id) on delete restrict,
 action text not null check(action in('import','publish','rollback','bind')),
 version_id uuid references public.web_presentation_versions(id) on delete restrict,
 activity_id uuid references public.lesson_activities(id) on delete restrict,
 previous_id uuid,created_at timestamptz not null default now()
);
create index web_presentation_events_history on private.web_presentation_events(presentation_id,id);
alter table public.web_presentations enable row level security;
alter table public.web_presentation_versions enable row level security;
alter table public.web_presentation_links enable row level security;
alter table private.web_presentation_events enable row level security;
revoke all on public.web_presentations,public.web_presentation_versions,public.web_presentation_links from public,anon,authenticated;
revoke all on private.web_presentation_events from public,anon,authenticated;
grant select on public.web_presentations,public.web_presentation_versions,public.web_presentation_links to authenticated;
grant select on public.web_presentations to service_role;
create policy web_presentations_admin_read on public.web_presentations for select to authenticated using(private.learning_role()='admin');
create policy web_versions_admin_read on public.web_presentation_versions for select to authenticated using(private.learning_role()='admin');
create policy web_links_admin_read on public.web_presentation_links for select to authenticated using(private.learning_role()='admin');
create trigger web_versions_immutable before update or delete on public.web_presentation_versions for each row execute function private.learning_reject_history_change();
create trigger web_events_immutable before update or delete on private.web_presentation_events for each row execute function private.learning_reject_history_change();

create function private.web_presentation_admin() returns void language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or private.learning_role() is distinct from 'admin' then
 raise exception 'Apenas administradores ativos podem gerenciar apresentações.' using errcode='42501';end if;
end $$;
revoke all on function private.web_presentation_admin() from public,anon,authenticated;

create function private.can_read_web_version(p_presentation_id uuid,p_version_id uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare p public.web_presentations;
begin
 if auth.uid() is null then return false;end if;
 select * into p from public.web_presentations where id=p_presentation_id;
 if not found or not exists(select 1 from public.web_presentation_versions where id=p_version_id and presentation_id=p.id) then return false;end if;
 if private.learning_role()='admin' then return true;end if;
 if private.learning_role() is distinct from 'student' or p.active_version_id is distinct from p_version_id then return false;end if;
 begin perform private.learning_require_student_lesson(p.lesson_id);
 exception when insufficient_privilege then return false;end;
 return exists(select 1 from public.web_presentation_links l join public.lesson_activities a on a.id=l.activity_id
  where l.presentation_id=p.id and a.lesson_id=p.lesson_id and a.activity_type='slides' and a.is_active and a.publication_status='published'
  and private.learning_can_read_activity(a.id) and private.learning_prerequisites_complete(auth.uid(),a.id));
end $$;
revoke all on function private.can_read_web_version(uuid,uuid) from public,anon;
grant execute on function private.can_read_web_version(uuid,uuid) to authenticated;

create function private.can_read_web_object(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.web_presentation_versions v cross join lateral jsonb_array_elements(v.files) f
 where v.id=case when split_part(p_name,'/',4) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then split_part(p_name,'/',4)::uuid else null end
 and p_name='presentations/'||v.presentation_id::text||'/versions/'||v.id::text||'/'||(f->>'path')
 and private.can_read_web_version(v.presentation_id,v.id));
$$;
revoke all on function private.can_read_web_object(text) from public,anon;
grant execute on function private.can_read_web_object(text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('web-presentations','web-presentations',false,5242880,array['application/json','image/png','image/jpeg','image/webp','text/markdown']);
-- No client upload/update/delete policy. Only the validated server pipeline writes.
create policy web_presentation_assets_read on storage.objects for select to authenticated
 using(bucket_id='web-presentations' and private.can_read_web_object(name));

-- Service-only registration follows successful server validation and immutable upload.
create function private.register_web_presentation(p_actor uuid,p_lesson_id uuid,p_presentation_id uuid,p_version_id uuid,p_title text,p_hash text,p_files jsonb,p_warnings jsonb,p_slide_count integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.web_presentations;f jsonb;next_number integer;prefix text;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role='admin' and is_active) then raise exception 'Administrador não autorizado.' using errcode='42501';end if;
 perform 1 from public.lessons where id=p_lesson_id for update;
 if not found then raise exception 'Aula não encontrada.' using errcode='23514';end if;
 if exists(select 1 from public.web_presentation_versions v join public.web_presentations existing_presentation on existing_presentation.id=v.presentation_id where existing_presentation.lesson_id=p_lesson_id and v.package_hash=p_hash) then
  raise exception 'Este pacote já existe nesta aula.' using errcode='23505';end if;
 if jsonb_typeof(p_files) is distinct from 'array' or jsonb_array_length(p_files) not between 1 and 80 then raise exception 'Manifesto inválido.' using errcode='23514';end if;
 if (select count(*) from jsonb_array_elements(p_files) x where x->>'path'='apresentacao.json' and x->>'mime'='application/json')<>1
 or (select count(distinct x->>'path') from jsonb_array_elements(p_files) x)<>jsonb_array_length(p_files) then raise exception 'Manifesto incompleto ou duplicado.' using errcode='23514';end if;
 prefix:='presentations/'||p_presentation_id::text||'/versions/'||p_version_id::text||'/';
 for f in select * from jsonb_array_elements(p_files) loop
  if (f->>'path')!~'^(apresentacao\.json|creditos-imagens\.md|images/[a-z0-9][a-z0-9_-]{0,99}\.(webp|png|jpg|jpeg))$'
   or coalesce(f->>'sha256','')!~'^[a-f0-9]{64}$' or coalesce((f->>'size')::integer,0) not between 1 and 5242880
   or not exists(select 1 from storage.objects o where o.bucket_id='web-presentations' and o.name=prefix||(f->>'path')
    and (o.metadata->>'size')::bigint=(f->>'size')::bigint and o.metadata->>'mimetype'=f->>'mime') then
    raise exception 'Arquivo não validado ou upload incompleto.' using errcode='23514';end if;
 end loop;
 insert into public.web_presentations(id,lesson_id,title,created_by) values(p_presentation_id,p_lesson_id,p_title,p_actor) on conflict(id) do nothing;
 select * into p from public.web_presentations where id=p_presentation_id for update;
 if p.lesson_id<>p_lesson_id then raise exception 'Apresentação pertence a outra aula.' using errcode='23514';end if;
 select coalesce(max(version_number),0)+1 into next_number from public.web_presentation_versions where presentation_id=p.id;
 insert into public.web_presentation_versions(id,presentation_id,version_number,title,package_hash,files,warnings,slide_count,created_by)
 values(p_version_id,p.id,next_number,p_title,p_hash,p_files,p_warnings,p_slide_count,p_actor);
 insert into private.web_presentation_events(presentation_id,actor_id,action,version_id) values(p.id,p_actor,'import',p_version_id);
 return jsonb_build_object('presentationId',p.id,'versionId',p_version_id,'versionNumber',next_number);
end $$;
revoke all on function private.register_web_presentation(uuid,uuid,uuid,uuid,text,text,jsonb,jsonb,integer) from public,anon,authenticated;
grant execute on function private.register_web_presentation(uuid,uuid,uuid,uuid,text,text,jsonb,jsonb,integer) to service_role;
create function public.register_web_presentation(p_actor uuid,p_lesson_id uuid,p_presentation_id uuid,p_version_id uuid,p_title text,p_hash text,p_files jsonb,p_warnings jsonb,p_slide_count integer) returns jsonb
language sql security invoker set search_path='' as $$select private.register_web_presentation(p_actor,p_lesson_id,p_presentation_id,p_version_id,p_title,p_hash,p_files,p_warnings,p_slide_count)$$;
revoke all on function public.register_web_presentation(uuid,uuid,uuid,uuid,text,text,jsonb,jsonb,integer) from public,anon,authenticated;
grant execute on function public.register_web_presentation(uuid,uuid,uuid,uuid,text,text,jsonb,jsonb,integer) to service_role;

create function private.web_presentation_state(p_lesson_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.web_presentation_admin();
 return jsonb_build_object('presentations',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('versions',coalesce((select jsonb_agg(to_jsonb(v) order by v.version_number desc) from public.web_presentation_versions v where v.presentation_id=p.id),'[]'::jsonb)) order by p.created_at,p.id) from public.web_presentations p where p.lesson_id=p_lesson_id),'[]'::jsonb),
 'activities',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'key',a.key,'title',a.title,'publication_status',a.publication_status,'resource_url',a.content_json->>'resourceUrl','presentation_id',l.presentation_id) order by a.order_index,a.id) from public.lesson_activities a left join public.web_presentation_links l on l.activity_id=a.id where a.lesson_id=p_lesson_id and a.activity_type='slides' and a.is_active),'[]'::jsonb));
end $$;
revoke all on function private.web_presentation_state(uuid) from public,anon;
grant execute on function private.web_presentation_state(uuid) to authenticated;
create function public.web_presentation_state(p_lesson_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.web_presentation_state(p_lesson_id)$$;
revoke all on function public.web_presentation_state(uuid) from public,anon;
grant execute on function public.web_presentation_state(uuid) to authenticated;

create function private.publish_web_presentation(p_presentation_id uuid,p_version_id uuid,p_expected_active_version uuid,p_confirmed boolean) returns void
language plpgsql security definer set search_path='' as $$
declare p public.web_presentations;old_number integer;new_number integer;
begin
 perform private.web_presentation_admin();
 if p_confirmed is distinct from true then raise exception 'Confirme a revisão antes de publicar.' using errcode='23514';end if;
 select * into p from public.web_presentations where id=p_presentation_id for update;
 if not found then raise exception 'Apresentação não encontrada.' using errcode='23514';end if;
 if p.active_version_id is distinct from p_expected_active_version then raise exception 'A versão ativa mudou. Atualize a lista antes de continuar.' using errcode='40001';end if;
 select version_number into new_number from public.web_presentation_versions where id=p_version_id and presentation_id=p.id;
 if not found then raise exception 'Versão não validada para esta apresentação.' using errcode='23514';end if;
 if p.active_version_id=p_version_id then return;end if;
 select version_number into old_number from public.web_presentation_versions where id=p.active_version_id;
 update public.web_presentations set active_version_id=p_version_id,title=(select title from public.web_presentation_versions where id=p_version_id),updated_at=now() where id=p.id;
 insert into private.web_presentation_events(presentation_id,actor_id,action,version_id,previous_id)
 values(p.id,auth.uid(),case when new_number<old_number then 'rollback' else 'publish' end,p_version_id,p.active_version_id);
end $$;
revoke all on function private.publish_web_presentation(uuid,uuid,uuid,boolean) from public,anon;
grant execute on function private.publish_web_presentation(uuid,uuid,uuid,boolean) to authenticated;
create function public.publish_web_presentation(p_presentation_id uuid,p_version_id uuid,p_expected_active_version uuid,p_confirmed boolean) returns void
language sql security invoker set search_path='' as $$select private.publish_web_presentation(p_presentation_id,p_version_id,p_expected_active_version,p_confirmed)$$;
revoke all on function public.publish_web_presentation(uuid,uuid,uuid,boolean) from public,anon;
grant execute on function public.publish_web_presentation(uuid,uuid,uuid,boolean) to authenticated;

create function private.bind_web_presentation(p_presentation_id uuid,p_activity_id uuid,p_expected_presentation uuid,p_confirmed boolean) returns void
language plpgsql security definer set search_path='' as $$
declare p public.web_presentations;a public.lesson_activities;previous uuid;
begin
 perform private.web_presentation_admin();
 if p_confirmed is distinct from true then raise exception 'Confirme o vínculo com a atividade escolhida.' using errcode='23514';end if;
 select * into p from public.web_presentations where id=p_presentation_id for update;
 if not found or p.active_version_id is null then raise exception 'Publique uma versão antes de vincular.' using errcode='23514';end if;
 select * into a from public.lesson_activities where id=p_activity_id for update;
 if not found or a.activity_type<>'slides' or not a.is_active or a.lesson_id<>p.lesson_id then raise exception 'Escolha uma atividade slides existente desta aula.' using errcode='23514';end if;
 select presentation_id into previous from public.web_presentation_links where activity_id=a.id;
 if previous is distinct from p_expected_presentation then raise exception 'O vínculo mudou. Atualize a lista.' using errcode='40001';end if;
 insert into public.web_presentation_links(activity_id,presentation_id,linked_by) values(a.id,p.id,auth.uid())
 on conflict(activity_id) do update set presentation_id=excluded.presentation_id,linked_by=excluded.linked_by,linked_at=now();
 insert into private.web_presentation_events(presentation_id,actor_id,action,version_id,activity_id,previous_id)
 values(p.id,auth.uid(),'bind',p.active_version_id,a.id,previous);
 -- Deliberately no UPDATE of lesson_activities or student/XP tables.
end $$;
revoke all on function private.bind_web_presentation(uuid,uuid,uuid,boolean) from public,anon;
grant execute on function private.bind_web_presentation(uuid,uuid,uuid,boolean) to authenticated;
create function public.bind_web_presentation(p_presentation_id uuid,p_activity_id uuid,p_expected_presentation uuid,p_confirmed boolean) returns void
language sql security invoker set search_path='' as $$select private.bind_web_presentation(p_presentation_id,p_activity_id,p_expected_presentation,p_confirmed)$$;
revoke all on function public.bind_web_presentation(uuid,uuid,uuid,boolean) from public,anon;
grant execute on function public.bind_web_presentation(uuid,uuid,uuid,boolean) to authenticated;

create function private.resolve_web_presentation(p_presentation_id uuid,p_version_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.web_presentations;v public.web_presentation_versions;
begin
 select * into p from public.web_presentations where id=p_presentation_id;
 select * into v from public.web_presentation_versions where presentation_id=p.id and id=coalesce(p_version_id,p.active_version_id);
 if v.id is null or not private.can_read_web_version(p.id,v.id) then raise exception 'Apresentação indisponível para esta conta.' using errcode='42501';end if;
 return jsonb_build_object('id',p.id,'title',v.title,'version_id',v.id,'version_number',v.version_number,'files',v.files);
end $$;
revoke all on function private.resolve_web_presentation(uuid,uuid) from public,anon;
grant execute on function private.resolve_web_presentation(uuid,uuid) to authenticated;
create function public.resolve_web_presentation(p_presentation_id uuid,p_version_id uuid default null) returns jsonb
language sql security invoker set search_path='' as $$select private.resolve_web_presentation(p_presentation_id,p_version_id)$$;
revoke all on function public.resolve_web_presentation(uuid,uuid) from public,anon;
grant execute on function public.resolve_web_presentation(uuid,uuid) to authenticated;

create function private.lesson_web_presentations(p_lesson_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('activity_id',l.activity_id,'presentation_id',p.id)),'[]'::jsonb)
 from public.web_presentation_links l join public.web_presentations p on p.id=l.presentation_id
 where p.lesson_id=p_lesson_id and private.can_read_web_version(p.id,p.active_version_id);
$$;
revoke all on function private.lesson_web_presentations(uuid) from public,anon;
grant execute on function private.lesson_web_presentations(uuid) to authenticated;
create function public.lesson_web_presentations(p_lesson_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.lesson_web_presentations(p_lesson_id)$$;
revoke all on function public.lesson_web_presentations(uuid) from public,anon;
grant execute on function public.lesson_web_presentations(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
