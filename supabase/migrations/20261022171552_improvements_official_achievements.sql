begin;
-- No browser-provided login counter, timestamp, period or XP amount is trusted.
create table private.achievement_settings(id boolean primary key default true check(id),timezone text not null,required_profile_fields text[] not null);
insert into private.achievement_settings values(true,'America/Bahia',array['full_name']);
alter table private.achievement_settings enable row level security;
revoke all on private.achievement_settings from public,anon,authenticated;

insert into public.achievement_definitions(code,title,description,icon) values
 ('official:profile_exemplar','Perfil Exemplar','Completar os dados obrigatórios do cadastro.','⭐'),
 ('official:networking','Mestre do Networking','Preencher os links do GitHub e LinkedIn.','🤝'),
 ('official:instagram','Instagrameiro','Preencher o link do Instagram.','📷'),
 ('official:project_submission','Envio de Projetos','Enviar um projeto válido.','📤'),
 ('official:project_review','Conclusão do Projeto','Receber uma avaliação com nota da professora.','🏆'),
 ('official:quiz_completion','Conclusão do Questionário','Concluir uma tentativa de questionário.','🧠'),
 ('official:dedication_month','Dedicação Total','Pelo menos oito logins efetivos no mês.','🔥'),
 ('official:engagement_week','Super Engajado','Pelo menos dois logins efetivos na semana.','🚀') on conflict(code) do nothing;

alter table public.xp_reward_rules drop constraint xp_reward_rules_event_type_check;
alter table public.xp_reward_rules add constraint xp_reward_rules_event_type_check check(event_type in(
 'welcome','lesson','scheduled_lesson','module','course','evaluation','evaluation_star','activity_quiz','activity_interactive','activity_study','activity_online',
 'activity_project','activity_final_project','submodule_completion','project_evaluation','profile_exemplar','networking','instagram','dedication_month','engagement_week','dedication_bonus','engagement_bonus'));
insert into public.xp_reward_rules(event_type,points,is_official) values('profile_exemplar',30,true),('networking',30,true),('instagram',10,true),('dedication_month',50,true),('engagement_week',20,true),('dedication_bonus',120,true),('engagement_bonus',50,true);

create table public.student_login_events(session_id uuid primary key,student_id uuid not null,logged_at timestamptz not null);
create index student_login_events_period on public.student_login_events(student_id,logged_at);
alter table public.student_login_events enable row level security;
revoke all on public.student_login_events from public,anon,authenticated;
grant select on public.student_login_events to authenticated;
create policy login_events_self on public.student_login_events for select to authenticated using(student_id=auth.uid() or private.learning_role()='admin');
create trigger login_events_immutable before update or delete on public.student_login_events for each row execute function private.learning_reject_history_change();
create function private.capture_effective_login() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.profiles where id=new.user_id and (role<>'student' or not is_active)) then return new;end if;
 insert into public.student_login_events(session_id,student_id,logged_at) values(new.id,new.user_id,coalesce(new.created_at,clock_timestamp())) on conflict do nothing;
 return new;
end $$;
revoke all on function private.capture_effective_login() from public,anon,authenticated;
create trigger bitaria_effective_login after insert on auth.sessions for each row execute function private.capture_effective_login();

create table public.student_achievement_periods(
 id uuid primary key default gen_random_uuid(),student_id uuid not null references public.profiles(id) on delete restrict,
 kind text not null check(kind in ('dedication_month','engagement_week')),reference_date date not null,login_count integer not null,
 processed_at timestamptz not null default clock_timestamp(),unique(student_id,kind,reference_date));
alter table public.student_achievement_periods enable row level security;
revoke all on public.student_achievement_periods from public,anon,authenticated;
grant select on public.student_achievement_periods to authenticated;
create policy achievement_periods_self on public.student_achievement_periods for select to authenticated using(student_id=auth.uid() or private.learning_role()='admin');
create trigger achievement_periods_immutable before update or delete on public.student_achievement_periods for each row execute function private.learning_reject_history_change();

alter function private.sync_student_masteries(uuid) rename to sync_masteries_before_improvements;
create function private.sync_student_masteries(p_student_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.sync_masteries_before_improvements(p_student_id);
 insert into public.student_achievements(student_id,code)
 select distinct p_student_id,code from public.student_xp_events e cross join lateral jsonb_array_elements_text(coalesce(e.reward_context->'achievementKeys','[]')) code
 where e.student_id=p_student_id and e.active and e.event_type in ('official_profile','official_engagement')
 on conflict(student_id,code) do update set active=true;
 insert into public.student_achievements(student_id,code)
 select p_student_id,'official:project_submission' where exists(select 1 from public.project_submissions where student_id=p_student_id)
 union all select p_student_id,'official:project_review' where exists(select 1 from public.project_submissions s join public.project_submission_reviews r on r.submission_id=s.id where s.student_id=p_student_id and r.grade is not null)
 union all select p_student_id,'official:quiz_completion' where exists(select 1 from public.quiz_attempts where student_id=p_student_id and activity_type='quiz')
 on conflict(student_id,code) do update set active=true;
end $$;
revoke all on function private.sync_student_masteries(uuid) from public,anon,authenticated;
alter function private.sync_student_xp(uuid) rename to sync_xp_before_improvements;
create function private.sync_student_xp(p_student_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.sync_xp_before_improvements(p_student_id);
 update public.student_xp_events set active=true where student_id=p_student_id and event_type in ('official_profile','official_engagement','official_engagement_bonus');
 update public.profiles set xp_points=(select coalesce(sum(points),0)::integer from public.student_xp_events where student_id=p_student_id and active) where id=p_student_id;
 perform private.sync_student_masteries(p_student_id);
end $$;
revoke all on function private.sync_student_xp(uuid) from public,anon,authenticated;
create function private.guard_official_achievement_receipt() returns trigger language plpgsql set search_path='' as $$
begin
 if old.event_type in ('official_profile','official_engagement','official_engagement_bonus') and (tg_op='DELETE' or (to_jsonb(new)-'active') is distinct from (to_jsonb(old)-'active')) then raise exception 'Conquista oficial imutavel.' using errcode='23514';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function private.guard_official_achievement_receipt() from public,anon,authenticated;
create trigger official_achievement_receipt_guard before update or delete on public.student_xp_events for each row execute function private.guard_official_achievement_receipt();

create function private.award_profile_achievements(p_student_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.profiles;v_code text;eligible boolean;fields text[];
begin
 select * into p from public.profiles where id=p_student_id and role='student' and is_active for update;
 if not found then return;end if;
 select required_profile_fields into fields from private.achievement_settings where id;
 foreach v_code in array array['profile_exemplar','networking','instagram'] loop
  eligible:=case v_code when 'profile_exemplar' then not exists(select 1 from unnest(fields) field where length(trim(coalesce(to_jsonb(p)->>field,'')))=0)
   when 'networking' then coalesce(to_jsonb(p)->>'github_url','') ~* '^https://(www\.)?github\.com/[^/?#[:space:]]+' and coalesce(to_jsonb(p)->>'linkedin_url','') ~* '^https://([a-z]{2,3}\.)?(www\.)?linkedin\.com/(in|company)/[^/?#[:space:]]+'
   else coalesce(to_jsonb(p)->>'instagram_url','') ~* '^https://(www\.)?instagram\.com/[^/?#[:space:]]+' end;
  if eligible then
   insert into public.student_xp_events(student_id,event_type,source_id,title,points,reward_context)
   select p.id,'official_profile',md5(p.id::text||':'||v_code)::uuid,d.title,r.points,jsonb_build_object('policyVersion',1,'rewardRuleKey',v_code,'achievementKeys',jsonb_build_array('official:'||v_code))
   from public.xp_reward_rules r join public.achievement_definitions d on d.code='official:'||v_code where r.event_type=v_code on conflict do nothing;
  end if;
 end loop;
 perform private.sync_student_xp(p.id);
end $$;
revoke all on function private.award_profile_achievements(uuid) from public,anon,authenticated;
create function private.profile_achievement_trigger() returns trigger language plpgsql security definer set search_path='' as $$
begin perform private.award_profile_achievements(new.id);return null;end $$;
revoke all on function private.profile_achievement_trigger() from public,anon,authenticated;
create trigger official_profile_achievements after insert or update of full_name,github_url,linkedin_url,instagram_url on public.profiles for each row execute function private.profile_achievement_trigger();

create function private.process_recurring_achievements(p_as_of timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare student record;period record;bonus record;created public.student_achievement_periods;zone text;today date;total_new integer:=0;
begin
 select timezone into zone from private.achievement_settings where id;today:=(p_as_of at time zone zone)::date;
 for student in select id from public.profiles where role='student' and is_active order by id loop
  perform 1 from public.profiles where id=student.id for update;
  for period in
   with logins as(select (logged_at at time zone zone)::date login_day from public.student_login_events where student_id=student.id and logged_at<p_as_of),
   candidates as(
    select 'dedication_month' kind,date_trunc('month',login_day)::date reference_date,count(*) n from logins group by 2 having count(*)>=8
    union all select 'engagement_week',(login_day-extract(dow from login_day)::integer)::date,count(*) from logins group by 2 having count(*)>=2)
   select * from candidates where (kind='dedication_month' and reference_date+interval '1 month'<=today) or (kind='engagement_week' and reference_date+7<=today)
   order by reference_date,kind
  loop
   insert into public.student_achievement_periods(student_id,kind,reference_date,login_count) values(student.id,period.kind,period.reference_date,period.n)
    on conflict do nothing returning * into created;
   if found then
    total_new:=total_new+1;
    insert into public.student_xp_events(student_id,event_type,source_id,title,points,reward_context)
    select student.id,'official_engagement',created.id,d.title||' · '||period.reference_date::text,r.points,
     jsonb_build_object('policyVersion',1,'rewardRuleKey',period.kind,'referenceDate',period.reference_date,'loginCount',period.n,'achievementKeys',jsonb_build_array(d.code))
    from public.xp_reward_rules r join public.achievement_definitions d on d.code=case period.kind when 'dedication_month' then 'official:dedication_month' else 'official:engagement_week' end where r.event_type=period.kind on conflict do nothing;
   end if;
  end loop;
  for bonus in select kind,count(*)::integer/12 blocks from public.student_achievement_periods where student_id=student.id group by kind having count(*)>=12 loop
   insert into public.student_xp_events(student_id,event_type,source_id,title,points,reward_context)
   select student.id,'official_engagement_bonus',md5(student.id::text||':'||bonus.kind||':'||block)::uuid,'Bônus por 12 conquistas · '||bonus.kind,r.points,
    jsonb_build_object('policyVersion',1,'rewardRuleKey',r.event_type,'blockNumber',block,'periodKind',bonus.kind)
   from generate_series(1,bonus.blocks) block cross join public.xp_reward_rules r where r.event_type=case bonus.kind when 'dedication_month' then 'dedication_bonus' else 'engagement_bonus' end on conflict do nothing;
  end loop;
  perform private.sync_student_xp(student.id);
 end loop;
 return jsonb_build_object('newPeriods',total_new,'asOf',p_as_of);
end $$;
revoke all on function private.process_recurring_achievements(timestamptz) from public,anon,authenticated;
create function public.process_recurring_achievements() returns jsonb language sql security definer set search_path='' as $$select private.process_recurring_achievements(clock_timestamp());$$;
revoke all on function public.process_recurring_achievements() from public,anon,authenticated;
grant execute on function public.process_recurring_achievements() to service_role;

-- Both jobs are safe to retry and catch up any closed periods after outages.
do $$ begin
 if to_regprocedure('cron.schedule(text,text,text)') is not null then
  perform cron.schedule('bitaria-weekly-achievements','5 3 * * 0','select public.process_recurring_achievements();');
  perform cron.schedule('bitaria-monthly-achievements','5 3 1 * *','select public.process_recurring_achievements();');
 else raise notice 'pg_cron indisponivel: habilite e execute supabase/schedules/official_achievements.sql no ambiente autorizado.';
 end if;
end $$;
do $$ declare p record;begin for p in select id from public.profiles where role='student' and is_active order by id loop perform private.award_profile_achievements(p.id);end loop;end $$;
commit;
