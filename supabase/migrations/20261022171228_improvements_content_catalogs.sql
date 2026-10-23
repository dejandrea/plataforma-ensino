begin;
alter table public.technologies add column if not exists icon text not null default '💻';
alter table public.missions add column if not exists icon text not null default '🎯';
alter table public.technologies add constraint technologies_icon_check check(length(trim(icon)) between 1 and 2048);
alter table public.missions add constraint missions_icon_check check(length(trim(icon)) between 1 and 2048);
grant insert on public.technologies to authenticated;
grant update(name,bronze_title,silver_title,gold_title,icon) on public.technologies to authenticated;
create policy technologies_admin_insert on public.technologies for insert to authenticated with check(private.learning_role()='admin');
create policy technologies_admin_update on public.technologies for update to authenticated using(private.learning_role()='admin') with check(private.learning_role()='admin');
revoke insert on public.achievement_definitions from authenticated;
drop policy achievement_definitions_admin_create on public.achievement_definitions;
grant update(title,description,icon) on public.achievement_definitions to authenticated;
create policy achievement_definitions_admin_update on public.achievement_definitions for update to authenticated using(private.learning_role()='admin') with check(private.learning_role()='admin');

create function private.register_technology_medals() returns trigger language plpgsql security definer set search_path='' as $$
declare tier text;label text;previous_label text;
begin
 foreach tier in array array['bronze','silver','gold'] loop
  label:=to_jsonb(new)->>(tier||'_title');previous_label:=case when tg_op='UPDATE' then to_jsonb(old)->>(tier||'_title') end;
  insert into public.achievement_definitions(code,title,description,icon) values('mastery:'||new.slug||':'||tier,label,'Maestria em '||new.name,case tier when 'bronze' then '🥉' when 'silver' then '🥈' else '🥇' end)
  on conflict(code) do update set title=case when label is distinct from previous_label then excluded.title else public.achievement_definitions.title end;
 end loop;
 return new;
end $$;
revoke all on function private.register_technology_medals() from public,anon,authenticated;
create trigger register_technology_medals after insert or update of bronze_title,silver_title,gold_title on public.technologies for each row execute function private.register_technology_medals();
insert into public.achievement_definitions(code,title,description,icon)
 select 'mastery:'||t.slug||':'||tier,to_jsonb(t)->>(tier||'_title'),'Maestria em '||t.name,case tier when 'bronze' then '🥉' when 'silver' then '🥈' else '🥇' end
 from public.technologies t cross join unnest(array['bronze','silver','gold']) tier on conflict do nothing;

alter table public.project_submissions add column project_description text not null default '',add column additional_links jsonb not null default '[]'::jsonb;
drop function public.submit_student_project(uuid,text,text,uuid);
create function public.submit_student_project(p_activity_id uuid,p_submission_url text,p_student_notes text,p_request_id uuid,p_project_description text default null,p_additional_links jsonb default '[]') returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.lesson_activities; previous public.project_submissions; submitted public.project_submissions; next_version integer; latest_status text;link jsonb;description text;
begin
 if private.learning_role() is distinct from 'student' then raise exception 'Entre com uma conta de aluno ativa.' using errcode='42501';end if;
 perform 1 from public.profiles where id=auth.uid() and is_active for update;
 select * into a from public.lesson_activities where id=p_activity_id and activity_type='project' and is_active and publication_status='published' for share;
 if not found then raise exception 'Projeto indisponivel.' using errcode='42501';end if;
 perform private.learning_require_student_lesson(a.lesson_id);
 if p_request_id is null or p_submission_url is null or p_submission_url !~ '^https://[^[:space:]]+$' or length(p_submission_url)>2048 or p_student_notes is null or length(p_student_notes)>20000 then raise exception 'Informe um link HTTPS valido e uma identificacao de envio.' using errcode='22023';end if;
 description:=coalesce(p_project_description,left(p_student_notes,2000),'');
 if (p_project_description is not null and length(trim(description)) not between 1 and 2000) or p_additional_links is null or jsonb_typeof(p_additional_links)<>'array' then raise exception 'Descricao ou links adicionais invalidos.' using errcode='22023';end if;
 if jsonb_array_length(p_additional_links)>2 then raise exception 'Informe ate dois links adicionais.' using errcode='22023';end if;
 for link in select * from jsonb_array_elements(p_additional_links) loop
  if jsonb_typeof(link)<>'object' or link-array['url','description']<>'{}' or jsonb_typeof(link->'url') is distinct from 'string' or jsonb_typeof(link->'description') is distinct from 'string'
   or (link->>'url') !~ '^https://[^[:space:]]+$' or length(link->>'url')>2048 or length(trim(link->>'description')) not between 1 and 2000 then raise exception 'Link adicional invalido; use HTTPS e descricao.' using errcode='22023';end if;
 end loop;
 select * into previous from public.project_submissions where student_id=auth.uid() and activity_id=a.id and request_id=p_request_id;
 if found then
  if previous.submission_url<>p_submission_url or previous.student_notes<>p_student_notes or (p_project_description is not null and (previous.project_description<>description or previous.additional_links<>p_additional_links)) then raise exception 'Identificador ja usado em outro envio.' using errcode='22023';end if;
  return to_jsonb(previous);
 end if;
 if not private.learning_prerequisites_complete(auth.uid(),a.id) then raise exception 'Conclua os pre-requisitos.' using errcode='23514';end if;
 select * into previous from public.project_submissions where student_id=auth.uid() and activity_id=a.id order by version desc limit 1;
 if found then
  select status into latest_status from public.project_submission_reviews where submission_id=previous.id order by created_at desc,id desc limit 1;
  if latest_status is distinct from 'needs_revision' then raise exception 'Aguarde a avaliacao; reenvio permitido apos solicitacao de ajustes.' using errcode='23514';end if;
 end if;
 next_version:=coalesce(previous.version,0)+1;
 insert into public.project_submissions(student_id,activity_id,activity_revision,version,submission_url,student_notes,request_id,project_description,additional_links)
 values(auth.uid(),a.id,a.revision,next_version,p_submission_url,p_student_notes,p_request_id,description,p_additional_links) returning * into submitted;
 insert into public.student_activity_progress(student_id,activity_id,activity_revision,status,started_at)
 values(auth.uid(),a.id,a.revision,'pending_review',now()) on conflict(student_id,activity_id) do update set status='pending_review',completed_at=null,started_at=coalesce(public.student_activity_progress.started_at,now()),updated_at=now();
 return to_jsonb(submitted);
end $$;
revoke all on function public.submit_student_project(uuid,text,text,uuid,text,jsonb) from public,anon;
grant execute on function public.submit_student_project(uuid,text,text,uuid,text,jsonb) to authenticated;
commit;
