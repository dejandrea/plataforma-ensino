-- Run in a transaction; the final exception deliberately rolls back all fixtures.
do $$
declare student uuid:=gen_random_uuid(); admin_id uuid; teacher uuid;
  course_id uuid; module_id uuid; submodule_id uuid; lesson_id uuid; evaluation_id uuid;
  scheduled_id uuid; balance integer;
begin
  select id into admin_id from public.profiles where role='admin' and is_active limit 1;
  select id into teacher from public.profiles where role='professor' and is_active limit 1;
  perform set_config('request.jwt.claims',json_build_object('sub',admin_id,'role','authenticated')::text,true);
  insert into auth.users(id,email,raw_user_meta_data) values(student,student::text||'@xp.invalid','{"full_name":"XP fixture"}');
  update public.profiles set role='student',student_service_scope='both',is_active=true where id=student;
  select xp_points into balance from public.profiles where id=student;
  if balance is distinct from 50 then raise exception 'Welcome must award exactly 50, got %',balance; end if;
  perform private.sync_student_xp(student);
  if (select xp_points from public.profiles where id=student)<>50 then raise exception 'Welcome duplicated'; end if;

  insert into public.courses(title,is_active) values('XP fixture',true) returning id into course_id;
  insert into public.modules(title,course_id,is_active) values('XP fixture',course_id,true) returning id into module_id;
  insert into public.submodules(title,module_id) values('XP fixture',module_id) returning id into submodule_id;
  insert into public.lessons(title,module_id,submodule_id,order_index) values('XP fixture',module_id,submodule_id,1) returning id into lesson_id;
  insert into public.student_progress(student_id,lesson_id,completed_at) values(student,lesson_id,now());
  if (select xp_points from public.profiles where id=student)<>80 then raise exception 'Lesson/module/course must award 30'; end if;
  update public.student_progress set completed_at=now() where student_id=student;
  if (select xp_points from public.profiles where id=student)<>80 then raise exception 'Repeated completion duplicated XP'; end if;

  insert into public.module_evaluations(student_id,module_id,teacher_id,
    score_technical,score_logic,score_creativity,score_autonomy,score_communication,score_organization,score_engagement,score_patience)
    values(student,module_id,teacher,1,1,1,1,1,1,1,1) returning id into evaluation_id;
  if (select xp_points from public.profiles where id=student)<>116 then raise exception 'Minimum evaluation must award 36'; end if;
  delete from public.module_evaluations where id=evaluation_id;
  insert into public.module_evaluations(student_id,module_id,teacher_id,
    score_technical,score_logic,score_creativity,score_autonomy,score_communication,score_organization,score_engagement,score_patience)
    values(student,module_id,teacher,5,5,5,5,5,5,5,5) returning id into evaluation_id;
  if (select xp_points from public.profiles where id=student)<>180 then raise exception 'Maximum evaluation must award 100'; end if;

  insert into public.scheduled_lessons(teacher_id,student_id,created_by,title,status,starts_at,ends_at,calendar_provider)
    values(teacher,student,admin_id,'XP fixture','completed',now()-interval '2 hours',now()-interval '1 hour','manual') returning id into scheduled_id;
  if (select xp_points from public.profiles where id=student)<>190 then raise exception 'Scheduled lesson must award 10'; end if;
  update public.xp_reward_rules set points=99 where event_type='scheduled_lesson';
  update public.scheduled_lessons set status='cancelled' where id=scheduled_id;
  if (select xp_points from public.profiles where id=student)<>180 then raise exception 'Cancellation must reverse points'; end if;
  update public.scheduled_lessons set status='completed' where id=scheduled_id;
  if (select xp_points from public.profiles where id=student)<>190 then raise exception 'Reactivation must preserve original points'; end if;
  perform set_config('bitaria_test.student',student::text,true);
end $$;

set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('bitaria_test.student'),'role','authenticated')::text,true);
do $$ begin
  if (select count(*) from public.student_xp_events where student_id<>auth.uid())<>0 then raise exception 'Student can read another balance'; end if;
  update public.xp_reward_rules set points=999 where event_type='lesson';
  if found then raise exception 'Student can change reward rules'; end if;
  begin
    update public.profiles set xp_points=999999 where id=auth.uid();
    raise exception 'Student can forge XP';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.student_xp_events(student_id,event_type,source_id,title,points) values(auth.uid(),'welcome',gen_random_uuid(),'Forgery',100);
    raise exception 'Student can forge ledger';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin raise exception 'XP_PREFLIGHT_OK'; end $$;
