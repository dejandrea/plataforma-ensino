-- Regression checks for progressive module access and finished-course evaluation.
-- Fixtures and changes to existing data are rolled back at the end.
begin;
-- Fixture content and progress are rolled back; no existing learning history is changed.
delete from public.student_progress where student_id='993f12d9-bc6a-433d-a497-2fb4deaba2f4';
delete from public.module_evaluations where id='5f7372c1-b228-4a0b-ba2f-faf95658c8cb';
insert into public.submodules(id,module_id,title,order_index,is_active)
values('11111111-1111-4111-8111-111111111101','76c52064-81dc-48e9-9c79-7dedae6477cd','Progression test II',999,true),
('11111111-1111-4111-8111-111111111102','97322dd7-fbf8-419c-a84b-88d4515e0a95','Progression test III',999,true);
insert into public.lessons(id,submodule_id,title,order_index)
values('11111111-1111-4111-8111-111111111201','11111111-1111-4111-8111-111111111101','Progression test II',999),
('11111111-1111-4111-8111-111111111202','11111111-1111-4111-8111-111111111102','Progression test III',999);
set local role authenticated;
select set_config('request.jwt.claim.sub','993f12d9-bc6a-433d-a497-2fb4deaba2f4',true);
do $$
begin
  if (select count(*) from public.student_curriculum_status(auth.uid()) where is_unlocked) <> 1 then
    raise exception 'TEST FAILED: only first module should be unlocked';
  end if;
  if exists (select 1 from public.lessons where id='11111111-1111-4111-8111-111111111201') then
    raise exception 'TEST FAILED: direct access to locked lesson';
  end if;
  begin
    insert into public.student_progress(student_id,lesson_id,completed_at)
    values(auth.uid(),'11111111-1111-4111-8111-111111111201',now());
    raise exception 'TEST FAILED: locked lesson completion accepted';
  exception when check_violation then null;
  end;
end;
$$;
insert into public.student_progress(student_id,lesson_id,completed_at)
select auth.uid(), l.id, now() from public.lessons l join public.submodules s on s.id=l.submodule_id
where s.module_id='253477d3-e90d-42b8-88d8-a4a512418cf5' and s.is_active;
do $$
begin
  if not (select is_unlocked from public.student_curriculum_status(auth.uid()) where id='76c52064-81dc-48e9-9c79-7dedae6477cd')
     or (select is_unlocked from public.student_curriculum_status(auth.uid()) where id='97322dd7-fbf8-419c-a84b-88d4515e0a95') then
    raise exception 'TEST FAILED: completion should unlock only next module';
  end if;
  if exists(select 1 from public.student_curriculum_status(auth.uid()) where course_completed) then
    raise exception 'TEST FAILED: incomplete course marked complete';
  end if;
end;
$$;
select set_config('request.jwt.claim.sub','9277c104-36ef-49ba-9987-a889e809dc16',true);
do $$
begin
  begin
    insert into public.module_evaluations(student_id,module_id,teacher_id)
    values('993f12d9-bc6a-433d-a497-2fb4deaba2f4','253477d3-e90d-42b8-88d8-a4a512418cf5',auth.uid());
    raise exception 'TEST FAILED: teacher evaluated unfinished course';
  exception when check_violation then null;
  end;
end;
$$;
select set_config('request.jwt.claim.sub','993f12d9-bc6a-433d-a497-2fb4deaba2f4',true);
insert into public.student_progress(student_id,lesson_id,completed_at)
values(auth.uid(),'11111111-1111-4111-8111-111111111201',now());
insert into public.student_progress(student_id,lesson_id,completed_at)
values(auth.uid(),'11111111-1111-4111-8111-111111111202',now());
do $$
begin
  if exists(select 1 from public.student_curriculum_status(auth.uid()) where not course_completed) then
    raise exception 'TEST FAILED: finished course not eligible for evaluation';
  end if;
end;
$$;
select set_config('request.jwt.claim.sub','9277c104-36ef-49ba-9987-a889e809dc16',true);
insert into public.module_evaluations(student_id,module_id,teacher_id)
values('993f12d9-bc6a-433d-a497-2fb4deaba2f4','253477d3-e90d-42b8-88d8-a4a512418cf5',auth.uid());
reset role;
update public.profiles set student_service_scope='mentoring' where id='993f12d9-bc6a-433d-a497-2fb4deaba2f4';
set local role authenticated;
select set_config('request.jwt.claim.sub','993f12d9-bc6a-433d-a497-2fb4deaba2f4',true);
do $$
begin
  if exists(select 1 from public.student_curriculum_status(auth.uid())) then
    raise exception 'TEST FAILED: mentoring-only student received course access';
  end if;
end;
$$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111999',true);
do $$
begin
  begin
    perform * from public.student_curriculum_status('993f12d9-bc6a-433d-a497-2fb4deaba2f4');
    raise exception 'TEST FAILED: unauthorized user read student progress';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;
