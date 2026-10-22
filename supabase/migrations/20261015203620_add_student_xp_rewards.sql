create table public.xp_reward_rules (
  event_type text primary key check(event_type in ('welcome','lesson','scheduled_lesson','module','course','evaluation','evaluation_star')),
  points integer not null check(points between 0 and 10000)
);
insert into public.xp_reward_rules values
 ('welcome',50),('lesson',10),('scheduled_lesson',10),('module',10),('course',10),('evaluation',20),('evaluation_star',2);
alter table public.xp_reward_rules enable row level security;
revoke all on public.xp_reward_rules from public,anon,authenticated;
grant select on public.xp_reward_rules to authenticated;
grant update(points) on public.xp_reward_rules to authenticated;
create policy xp_rules_read on public.xp_reward_rules for select to authenticated using (
 exists(select 1 from public.profiles where id=(select auth.uid()) and is_active));
create policy xp_rules_admin_update on public.xp_reward_rules for update to authenticated
 using(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active))
 with check(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));

create table public.student_xp_events (
  student_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  source_id uuid not null,
  title text not null,
  points integer not null check(points>=0),
  active boolean not null default true,
  earned_at timestamptz not null default now(),
  primary key(student_id,event_type,source_id)
);
alter table public.student_xp_events enable row level security;
revoke all on public.student_xp_events from public,anon,authenticated;
grant select on public.student_xp_events to authenticated;
create policy xp_events_read on public.student_xp_events for select to authenticated using (
 student_id=(select auth.uid()) or exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active));
create index student_xp_events_history on public.student_xp_events(student_id,earned_at desc);

-- Keep the existing balance explicit rather than silently replacing previously earned XP.
insert into public.student_xp_events(student_id,event_type,source_id,title,points)
 select id,'opening',id,'Saldo anterior',xp_points from public.profiles where role='student' and xp_points>0;

-- Internal only: no client can request points or choose a source/student to credit.
create function private.sync_student_xp(p_student_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles where id=p_student_id and role='student' for update;
  if not found then return; end if;
  update public.student_xp_events set active=false where student_id=p_student_id and event_type not in ('opening','welcome');
  with module_status as (
    select m.id,m.course_id,m.title,count(l.id) total,
      count(l.id) filter(where sp.completed_at is not null) completed,
      max(sp.completed_at) completed_at
    from public.modules m join public.courses c on c.id=m.course_id and c.is_active
    left join public.submodules s on s.module_id=m.id and s.is_active
    left join public.lessons l on l.submodule_id=s.id
    left join public.student_progress sp on sp.lesson_id=l.id and sp.student_id=p_student_id
    where m.is_active group by m.id
  ), candidates as (
    select 'welcome' kind,p_student_id source,'Boas-vindas à Bitaria' title,now() earned,1 units
    union all
    select 'lesson',l.id,l.title,sp.completed_at,1 from public.student_progress sp
      join public.lessons l on l.id=sp.lesson_id where sp.student_id=p_student_id and sp.completed_at is not null
    union all
    select 'scheduled_lesson',id,title,ends_at,1 from public.scheduled_lessons where student_id=p_student_id and status='completed'
    union all
    select 'module',id,title,completed_at,1 from module_status where total>0 and total=completed
    union all
    select 'course',c.id,c.title,max(ms.completed_at),1 from module_status ms join public.courses c on c.id=ms.course_id
      group by c.id having bool_and(ms.total>0 and ms.total=ms.completed)
    union all
    select 'evaluation',id,'Avaliação da professora',created_at,1 from public.module_evaluations where student_id=p_student_id
    union all
    select 'evaluation_star',id,'Estrelas da avaliação',created_at,
      coalesce(score_technical,0)+coalesce(score_logic,0)+coalesce(score_creativity,0)+coalesce(score_autonomy,0)+
      coalesce(score_communication,0)+coalesce(score_organization,0)+coalesce(score_engagement,0)+coalesce(score_patience,0)
      from public.module_evaluations where student_id=p_student_id
  )
  insert into public.student_xp_events(student_id,event_type,source_id,title,points,earned_at)
    select p_student_id,c.kind,c.source,c.title,r.points*c.units,coalesce(c.earned,now())
    from candidates c join public.xp_reward_rules r on r.event_type=c.kind
    on conflict(student_id,event_type,source_id) do update set active=true;
  update public.profiles set xp_points=(select coalesce(sum(points),0)::integer from public.student_xp_events
    where student_id=p_student_id and active) where id=p_student_id;
end;
$$;
revoke all on function private.sync_student_xp(uuid) from public,anon,authenticated;

create function private.refresh_student_xp_trigger() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op <> 'INSERT' then perform private.sync_student_xp(old.student_id); end if;
  if tg_op <> 'DELETE' and (tg_op='INSERT' or new.student_id is distinct from old.student_id) then
    perform private.sync_student_xp(new.student_id);
  end if;
  return null;
end;
$$;
revoke all on function private.refresh_student_xp_trigger() from public,anon,authenticated;
create trigger xp_progress after insert or update or delete on public.student_progress for each row execute function private.refresh_student_xp_trigger();
create trigger xp_scheduled after insert or update or delete on public.scheduled_lessons for each row execute function private.refresh_student_xp_trigger();
create trigger xp_evaluations after insert or update or delete on public.module_evaluations for each row execute function private.refresh_student_xp_trigger();

create function private.welcome_student_xp_trigger() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.role='student' then perform private.sync_student_xp(new.id); end if;
  return null;
end;
$$;
revoke all on function private.welcome_student_xp_trigger() from public,anon,authenticated;
create trigger xp_welcome after insert or update of role on public.profiles for each row execute function private.welcome_student_xp_trigger();

create function private.protect_profile_xp() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if current_user not in ('postgres','supabase_admin','service_role') then
    if tg_op='INSERT' then
      new.xp_points:=0;
    elsif new.xp_points is distinct from old.xp_points then
      raise exception 'O XP é calculado automaticamente pelas conquistas.' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.protect_profile_xp() from public,anon,authenticated;
create trigger profiles_protect_xp before insert or update on public.profiles for each row execute function private.protect_profile_xp();

do $$ declare student record; begin
  for student in select id from public.profiles where role='student' order by id loop
    perform private.sync_student_xp(student.id);
  end loop;
end $$;
