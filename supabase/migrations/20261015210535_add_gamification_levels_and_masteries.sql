create table public.player_levels (
  level integer primary key check(level between 1 and 10),
  min_xp integer not null unique check(min_xp>=0),
  title text not null, description text not null, icon text not null
);
insert into public.player_levels values
 (1,0,'Aprendiz de Bits','Sua aventura no universo da programação começou!','🌱'),
 (2,100,'Explorador Digital','Descobrindo novas ferramentas e possibilidades.','🧭'),
 (3,250,'Caçador de Bugs','Os desafios já não assustam tanto.','🐛'),
 (4,450,'Domador de Códigos','Transformando ideias em linhas de código.','⌨️'),
 (5,700,'Mestre das Missões','Cada desafio é uma nova conquista.','🎯'),
 (6,1000,'Arquiteto Digital','Construindo soluções cada vez mais complexas.','🏗️'),
 (7,1400,'Guardião dos Algoritmos','Dominando a lógica e o pensamento computacional.','🛡️'),
 (8,1900,'Mago da Programação','Criatividade e tecnologia trabalhando juntas.','🪄'),
 (9,2500,'Lenda do Código','Uma referência entre os exploradores da Bitaria.','🏆'),
 (10,3200,'Lenda Bitaria','Alcançou o topo desta primeira jornada!','👑');
alter table public.player_levels enable row level security;
revoke all on public.player_levels from public,anon,authenticated;
grant select on public.player_levels to authenticated;
create policy player_levels_read on public.player_levels for select to authenticated using(true);

create function private.calculate_player_level() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  new.level:=coalesce((select max(level) from public.player_levels where min_xp<=coalesce(new.xp_points,0)),1);
  return new;
end;
$$;
revoke all on function private.calculate_player_level() from public,anon,authenticated;
create trigger zz_calculate_player_level before insert or update on public.profiles for each row execute function private.calculate_player_level();
update public.profiles set level=coalesce((select max(level) from public.player_levels where min_xp<=coalesce(profiles.xp_points,0)),1);

create table public.technologies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, name text not null,
  bronze_title text not null, silver_title text not null, gold_title text not null
);
insert into public.technologies(slug,name,bronze_title,silver_title,gold_title) values
 ('html','HTML','Explorador de Tags','Construtor de Páginas','Mestre do HTML'),
 ('css','CSS','Aprendiz de Estilos','Artista das Interfaces','Mestre do CSS'),
 ('javascript','JavaScript','Despertar do JS','Domador de Funções','Mestre do JavaScript'),
 ('react','React','Aprendiz de Componentes','Arquiteto React','Mestre dos Componentes'),
 ('python','Python','Explorador Python','Encantador de Scripts','Mestre Python'),
 ('sql','SQL','Explorador de Dados','Guardião das Consultas','Mestre dos Dados'),
 ('git','Git','Primeiro Commit','Guardião das Branches','Mestre do Versionamento'),
 ('ai','IA','Explorador da IA','Criador Inteligente','Mestre da IA'),
 ('scratch','Scratch','Criador de Blocos','Inventor de Jogos','Mestre Scratch'),
 ('nodejs','Node.js','Explorador Backend','Construtor de APIs','Mestre do Backend');
alter table public.technologies enable row level security;
revoke all on public.technologies from public,anon,authenticated;
grant select on public.technologies to authenticated;
create policy technologies_read on public.technologies for select to authenticated using(true);

create table public.mastery_rules (
 tier text primary key check(tier in ('bronze','silver','gold')),
 min_xp integer not null check(min_xp>=0), min_missions integer not null check(min_missions>=1),
 requires_project boolean not null default false
);
insert into public.mastery_rules values('bronze',50,3,false),('silver',200,8,false),('gold',500,15,true);
alter table public.mastery_rules enable row level security;
revoke all on public.mastery_rules from public,anon,authenticated;
grant select on public.mastery_rules to authenticated;
grant update(min_xp,min_missions,requires_project) on public.mastery_rules to authenticated;
create policy mastery_rules_read on public.mastery_rules for select to authenticated using(true);
create policy mastery_rules_admin on public.mastery_rules for update to authenticated
 using(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active))
 with check(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));

create table public.missions (
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title)) between 1 and 180),
 description text not null default '', category text not null check(category in ('practice','debugging','logic','project')),
 xp integer not null default 10 check(xp between 0 and 10000),
 technology_ids uuid[] not null check(cardinality(technology_ids)>0),
  achievement_codes text[] not null default '{}',
 is_final_project boolean not null default false,
 is_active boolean not null default true,
 check(not is_final_project or category='project')
);
create table public.mission_submissions (
 id uuid primary key default gen_random_uuid(), mission_id uuid not null references public.missions(id),
 student_id uuid not null references public.profiles(id) on delete cascade,
 work_url text not null check(length(trim(work_url)) between 1 and 2000),
 note text not null default '', status text not null default 'pending' check(status in ('pending','approved','rejected')),
 submitted_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid references public.profiles(id),
 xp_awarded integer, approved_category text, approved_technologies uuid[], approved_final_project boolean,
  approved_achievements text[],
 unique(student_id,mission_id)
);
create index mission_submissions_review on public.mission_submissions(status,submitted_at);
create index mission_submissions_mission on public.mission_submissions(mission_id);
create index mission_submissions_reviewer on public.mission_submissions(reviewed_by);
alter table public.missions enable row level security;
alter table public.mission_submissions enable row level security;
revoke all on public.missions,public.mission_submissions from public,anon,authenticated;
grant select,insert,update on public.missions to authenticated;
grant select on public.mission_submissions to authenticated;
create policy missions_read on public.missions for select to authenticated using(is_active or exists(
 select 1 from public.profiles where id=(select auth.uid()) and is_active and role='admin'));
create policy missions_admin_insert on public.missions for insert to authenticated with check(exists(
 select 1 from public.profiles where id=(select auth.uid()) and is_active and role='admin'));
create policy missions_admin_update on public.missions for update to authenticated using(exists(
 select 1 from public.profiles where id=(select auth.uid()) and is_active and role='admin')) with check(exists(
 select 1 from public.profiles where id=(select auth.uid()) and is_active and role='admin'));
create policy submissions_read on public.mission_submissions for select to authenticated using(student_id=(select auth.uid()) or exists(
 select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and (p.role='admin' or(p.role='professor' and exists(
 select 1 from public.teacher_student_relations r where r.teacher_id=p.id and r.student_id=mission_submissions.student_id)))));

create function private.validate_mission() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if cardinality(new.technology_ids)<>(select count(distinct id) from public.technologies where id=any(new.technology_ids)) then
   raise exception 'Selecione tecnologias válidas e sem repetição.'; end if;
 if cardinality(new.achievement_codes)<>(select count(distinct code) from public.achievement_definitions where is_custom and code=any(new.achievement_codes)) then
   raise exception 'Selecione conquistas personalizadas válidas e sem repetição.'; end if;
 return new;
end $$;
revoke all on function private.validate_mission() from public,anon,authenticated;
create trigger validate_mission before insert or update on public.missions for each row execute function private.validate_mission();
create function private.validate_submission() returns trigger language plpgsql security definer set search_path='' as $$
declare mission public.missions;
begin
 select * into mission from public.missions where id=new.mission_id and is_active;
 if not found then raise exception 'Missão indisponível.'; end if;
 if new.work_url !~ '^https?://' then raise exception 'Informe um link HTTP ou HTTPS para sua entrega.'; end if;
 new.submitted_at:=now();
 new.status:='approved'; new.reviewed_at:=now(); new.reviewed_by:=null;
 new.xp_awarded:=mission.xp; new.approved_category:=mission.category;
 new.approved_technologies:=mission.technology_ids; new.approved_final_project:=mission.is_final_project;
 new.approved_achievements:=mission.achievement_codes;
 return new;
end $$;
revoke all on function private.validate_submission() from public,anon,authenticated;
create trigger validate_submission before insert on public.mission_submissions for each row execute function private.validate_submission();

create table public.student_technology_progress (
 student_id uuid not null references public.profiles(id) on delete cascade,
 technology_id uuid not null references public.technologies(id),
 xp numeric not null default 0, completed_missions integer not null default 0,
 final_project_approved boolean not null default false, primary key(student_id,technology_id)
);
create table public.achievement_definitions (
 code text primary key check(length(code) between 1 and 100), title text not null check(length(trim(title)) between 1 and 100),
 description text not null, icon text not null, is_custom boolean not null default false
);
insert into public.achievement_definitions(code,title,description,icon) values
 ('first_code','Primeiro Código','Primeira missão concluída','🚀'),
 ('bug_hunter','Caça-Bugs','5 desafios de depuração concluídos','🐛'),
 ('on_fire','Em Chamas','3 dias seguidos de prática com missões concluídas','🔥'),
 ('logic_mind','Mente Lógica','10 desafios de lógica concluídos','🧠'),
 ('creator','Criador','Primeiro projeto concluído','🛠️'),
 ('bitaria_legend','Lenda Bitaria','Alcançar o nível 10','👑');
create table public.student_achievements (
 student_id uuid not null references public.profiles(id) on delete cascade,
 code text not null, technology_id uuid references public.technologies(id),
 unlocked_at timestamptz not null default now(), active boolean not null default true,
 primary key(student_id,code)
);
create index student_achievements_technology on public.student_achievements(technology_id);
alter table public.student_technology_progress enable row level security;
alter table public.achievement_definitions enable row level security;
alter table public.student_achievements enable row level security;
revoke all on public.student_technology_progress,public.achievement_definitions,public.student_achievements from public,anon,authenticated;
grant select on public.student_technology_progress,public.achievement_definitions,public.student_achievements to authenticated;
grant insert on public.achievement_definitions to authenticated;
create policy achievement_definitions_read on public.achievement_definitions for select to authenticated using(true);
create policy achievement_definitions_admin_create on public.achievement_definitions for insert to authenticated with check(
 is_custom and code like 'custom:%' and exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));
create policy technology_progress_self on public.student_technology_progress for select to authenticated using(student_id=(select auth.uid()) or exists(
 select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));
create policy achievements_self on public.student_achievements for select to authenticated using(student_id=(select auth.uid()) or exists(
 select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));

create function private.sync_student_masteries(p_student_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.profiles where id=p_student_id and role='student' for update;
 if not found then return; end if;
 update public.student_technology_progress set xp=0,completed_missions=0,final_project_approved=false where student_id=p_student_id;
 insert into public.student_technology_progress(student_id,technology_id,xp,completed_missions,final_project_approved)
 select p_student_id,t.id,sum(s.xp_awarded::numeric/cardinality(s.approved_technologies)),count(*),bool_or(s.approved_final_project)
 from public.mission_submissions s cross join lateral unnest(s.approved_technologies) t(id)
 where s.student_id=p_student_id and s.status='approved' group by t.id
 on conflict(student_id,technology_id) do update set xp=excluded.xp,completed_missions=excluded.completed_missions,final_project_approved=excluded.final_project_approved;
 update public.student_achievements set active=false where student_id=p_student_id;
 with stats as (
 select count(*) total,count(*) filter(where approved_category='debugging') bugs,
 count(*) filter(where approved_category='logic') logic,count(*) filter(where approved_category='project') projects
 from public.mission_submissions where student_id=p_student_id and status='approved'
 ), days as (
 select distinct(submitted_at at time zone 'America/Bahia')::date as activity_date
 from public.mission_submissions where student_id=p_student_id and status='approved'
 ), streaks as(select activity_date,activity_date-(row_number() over(order by activity_date))::integer grp from days), eligible as (
 select 'first_code' code,null::uuid tech from stats where total>=1
 union all select 'bug_hunter',null from stats where bugs>=5
 union all select 'logic_mind',null from stats where logic>=10
 union all select 'creator',null from stats where projects>=1
 union all select 'on_fire',null where exists(select 1 from streaks group by grp having count(*)>=3)
 union all select 'bitaria_legend',null from public.profiles where id=p_student_id and level>=10
 union select distinct unnest(approved_achievements),null::uuid from public.mission_submissions where student_id=p_student_id and status='approved'
 union all select 'mastery:'||t.slug||':'||r.tier,t.id from public.student_technology_progress p
 join public.technologies t on t.id=p.technology_id cross join public.mastery_rules r
 where p.student_id=p_student_id and p.xp>=r.min_xp and p.completed_missions>=r.min_missions
 and(not r.requires_project or p.final_project_approved)
 ) insert into public.student_achievements(student_id,code,technology_id)
 select p_student_id,code,tech from eligible on conflict(student_id,code) do update set active=true;
end $$;
revoke all on function private.sync_student_masteries(uuid) from public,anon,authenticated;

-- Keep mission XP separate from the original sources, preserving the existing calculator.
alter function private.sync_student_xp(uuid) rename to sync_student_base_xp;
create function private.sync_student_xp(p_student_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.sync_student_base_xp(p_student_id);
 if not exists(select 1 from public.profiles where id=p_student_id and role='student') then return; end if;
 insert into public.student_xp_events(student_id,event_type,source_id,title,points,earned_at)
 select p_student_id,'mission',s.id,m.title,s.xp_awarded,s.reviewed_at from public.mission_submissions s
 join public.missions m on m.id=s.mission_id where s.student_id=p_student_id and s.status='approved'
 on conflict(student_id,event_type,source_id) do update set active=true;
 update public.profiles set xp_points=(select coalesce(sum(points),0)::integer from public.student_xp_events where student_id=p_student_id and active) where id=p_student_id;
 perform private.sync_student_masteries(p_student_id);
end $$;
revoke all on function private.sync_student_xp(uuid) from public,anon,authenticated;

create trigger xp_missions after insert or update or delete on public.mission_submissions for each row execute function private.refresh_student_xp_trigger();

create function private.complete_mission(p_mission_id uuid,p_work_url text,p_note text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare submission_id uuid;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='student' and is_active) then
 raise exception 'Somente alunos ativos podem concluir missões.' using errcode='42501'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select id into submission_id from public.mission_submissions where student_id=auth.uid() and mission_id=p_mission_id;
 if found then return submission_id; end if;
 insert into public.mission_submissions(student_id,mission_id,work_url,note)
 values(auth.uid(),p_mission_id,trim(p_work_url),coalesce(p_note,'')) returning id into submission_id;
 return submission_id;
end $$;
revoke all on function private.complete_mission(uuid,text,text) from public,anon;
grant execute on function private.complete_mission(uuid,text,text) to authenticated;
create function public.complete_mission(p_mission_id uuid,p_work_url text,p_note text default '') returns uuid
language sql security invoker set search_path='' as $$select private.complete_mission(p_mission_id,p_work_url,p_note);$$;
revoke all on function public.complete_mission(uuid,text,text) from public,anon;
grant execute on function public.complete_mission(uuid,text,text) to authenticated;

create function private.refresh_mastery_rules() returns trigger language plpgsql security definer set search_path='' as $$
declare student record; begin
 for student in select id from public.profiles where role='student' order by id loop perform private.sync_student_masteries(student.id); end loop;
 return null;
end $$;
revoke all on function private.refresh_mastery_rules() from public,anon,authenticated;
create trigger refresh_mastery_rules after update on public.mastery_rules for each statement execute function private.refresh_mastery_rules();

create function private.gamification_ranking()
returns table("position" bigint,student_id uuid,display_name text,xp integer,level integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and is_active) then raise exception 'Acesso negado.' using errcode='42501'; end if;
 return query select dense_rank() over(order by coalesce(p.xp_points,0) desc),p.id,
 coalesce(nullif(trim(p.nickname),''),split_part(p.full_name,' ',1),'Aluno'),coalesce(p.xp_points,0),coalesce(p.level,1)
 from public.profiles p where p.role='student' and p.is_active
 order by coalesce(p.xp_points,0) desc,p.id limit 100;
end $$;
revoke all on function private.gamification_ranking() from public,anon;
grant execute on function private.gamification_ranking() to authenticated;
create function public.gamification_ranking()
returns table("position" bigint,student_id uuid,display_name text,xp integer,level integer)
language sql stable security invoker set search_path='' as $$select * from private.gamification_ranking();$$;
revoke all on function public.gamification_ranking() from public,anon;
grant execute on function public.gamification_ranking() to authenticated;

do $$ declare student record; begin
 for student in select id from public.profiles where role='student' order by id loop perform private.sync_student_xp(student.id); end loop;
end $$;
