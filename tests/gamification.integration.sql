do $$
declare student uuid:=gen_random_uuid(); mission_id uuid; first_mission uuid; submission_id uuid;
 html uuid; css uuid; python uuid; admin_id uuid; i integer; balance integer;
begin
 select id into admin_id from public.profiles where role='admin' and is_active limit 1;
 select id into html from public.technologies where slug='html';
 select id into css from public.technologies where slug='css';
 select id into python from public.technologies where slug='python';
 insert into auth.users(id,email,raw_user_meta_data) values(student,student::text||'@gamification.invalid','{"full_name":"Gamification fixture"}');
 update public.profiles set role='student',is_active=true where id=student;
 if (select level from public.profiles where id=student)<>1 then raise exception 'New student must start at level 1'; end if;
 perform set_config('request.jwt.claims',json_build_object('sub',student,'role','authenticated')::text,true);
 insert into public.achievement_definitions(code,title,description,icon,is_custom) values('custom:fixture','Fixture','Fixture','test',true);
 for i in 1..3 loop
   insert into public.missions(title,category,xp,technology_ids,achievement_codes)
   values('Gamification fixture','practice',101,array[html,css],array['custom:fixture']) returning id into mission_id;
   submission_id:=public.complete_mission(mission_id,'https://example.com/work','Fixture');
   if i=1 then first_mission:=mission_id; end if;
 end loop;
 if (select xp_points from public.profiles where id=student)<>353 then raise exception 'Mission XP must be granted once'; end if;
 if (select level from public.profiles where id=student)<>3 then raise exception 'Level thresholds failed'; end if;
 if (select xp from public.student_technology_progress where student_id=student and technology_id=html)<>151.5 then raise exception 'Multi-technology split failed'; end if;
 if not exists(select 1 from public.student_achievements where student_id=student and code='mastery:html:bronze' and active) then raise exception 'Bronze not unlocked'; end if;
 if not exists(select 1 from public.student_achievements where student_id=student and code='custom:fixture' and active) then raise exception 'Custom badge not unlocked'; end if;
 if (select count(*) from public.student_achievements where student_id=student and code='first_code' and active)<>1 then raise exception 'First code badge missing'; end if;
 update public.missions set xp=999,technology_ids=array[python],achievement_codes='{}' where id=first_mission;
 perform public.complete_mission(first_mission,'https://example.com/again','Repeat');
 perform private.sync_student_xp(student);
 if (select xp_points from public.profiles where id=student)<>353 then raise exception 'Repeated mission duplicated XP or catalog edits changed snapshots'; end if;
 if (select xp from public.student_technology_progress where student_id=student and technology_id=html)<>151.5 then raise exception 'Technology snapshot changed'; end if;
 update public.mission_submissions set submitted_at='2026-10-01 15:00Z' where student_id=student;
 update public.mission_submissions s set submitted_at='2026-10-02 15:00Z' where s.student_id=student and s.mission_id=first_mission;
 update public.mission_submissions set submitted_at='2026-10-03 15:00Z' where id=submission_id;
 if not exists(select 1 from public.student_achievements where student_id=student and code='on_fire' and active) then raise exception 'Three-day streak missing'; end if;
 for i in 1..5 loop
   insert into public.missions(title,category,xp,technology_ids) values('Debug fixture','debugging',0,array[html]) returning id into mission_id;
   perform public.complete_mission(mission_id,'https://example.com/debug','');
 end loop;
 if not exists(select 1 from public.student_achievements where student_id=student and code='bug_hunter' and active) then raise exception 'Bug badge missing'; end if;
 if exists(select 1 from public.student_achievements where student_id=student and code='mastery:html:silver' and active) then raise exception 'Silver unlocked without enough XP'; end if;
 insert into public.missions(title,category,xp,technology_ids) values('Silver fixture','practice',100,array[html]) returning id into mission_id;
 perform public.complete_mission(mission_id,'https://example.com/silver','');
 if not exists(select 1 from public.student_achievements where student_id=student and code='mastery:html:silver' and active) then raise exception 'Silver missing'; end if;
 insert into public.missions(title,category,xp,technology_ids,is_final_project) values('Project fixture','project',400,array[html],true) returning id into mission_id;
 perform public.complete_mission(mission_id,'https://example.com/project','');
 if exists(select 1 from public.student_achievements where student_id=student and code='mastery:html:gold' and active) then raise exception 'Gold unlocked without enough missions'; end if;
 for i in 1..10 loop
   insert into public.missions(title,category,xp,technology_ids) values('Logic fixture','logic',0,array[html]) returning id into mission_id;
   perform public.complete_mission(mission_id,'https://example.com/logic','');
 end loop;
 if (select count(*) from public.student_achievements where student_id=student and code in ('logic_mind','creator','mastery:html:gold') and active)<>3 then raise exception 'Logic, creator or gold badge missing'; end if;
 insert into public.missions(title,category,xp,technology_ids) values('Legend fixture','practice',2400,array[html]) returning id into mission_id;
 perform public.complete_mission(mission_id,'https://example.com/legend','');
 if (select level from public.profiles where id=student)<>10 then raise exception 'Maximum level missing'; end if;
 if not exists(select 1 from public.student_achievements where student_id=student and code='bitaria_legend' and active) then raise exception 'Legend badge missing'; end if;
 if (select sum(xp) from public.student_technology_progress where student_id=student)<>(select sum(xp_awarded) from public.mission_submissions where student_id=student) then raise exception 'Technology XP not conserved'; end if;
 perform set_config('bitaria_test.gamification_student',student::text,true);
end $$;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('bitaria_test.gamification_student'),'role','authenticated')::text,true);
do $$ begin
 if (select count(*) from public.student_technology_progress where student_id<>auth.uid())<>0 then raise exception 'Technology progress leaked'; end if;
 begin
   insert into public.missions(title,category,xp,technology_ids) select 'Forgery','practice',999,array[id] from public.technologies limit 1;
   raise exception 'Student can create mission';
 exception when insufficient_privilege then null; end;
 begin
   insert into public.student_achievements(student_id,code) values(auth.uid(),'custom:forged');
   raise exception 'Student can forge badges';
 exception when insufficient_privilege then null; end;
 update public.mastery_rules set min_xp=0;
 if found then raise exception 'Student can change mastery rules'; end if;
 if (select count(*) from public.gamification_ranking())=0 then raise exception 'Ranking missing'; end if;
end $$;
reset role;
-- Runner adds XP regression tests ending with XP_PREFLIGHT_OK to roll back everything.
