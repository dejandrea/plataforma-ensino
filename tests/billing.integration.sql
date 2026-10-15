-- Run with supabase db query --file tests/billing.integration.sql.
-- All fixtures, mocked clock and financial records are rolled back.
begin;
create or replace function private.billing_today() returns date language sql stable set search_path='' as $$
  select current_setting('bitaria_test.today')::date;
$$;
select set_config('bitaria_test.today','2090-01-15',true);
select set_config('request.jwt.claims',json_build_object('sub',(select id from public.profiles where role='admin' and is_active limit 1),'role','authenticated')::text,true);
do $$
declare student uuid; teacher uuid; snapshot jsonb; invoice uuid; payment uuid; extra uuid; discount uuid;
  cancel_lesson uuid; second_lesson uuid;
begin
  select id into student from public.profiles where role='student' and is_active limit 1;
  select id into teacher from public.profiles where role='professor' limit 1;
  if student is null or teacher is null then raise exception 'Existing test actors required'; end if;
  perform set_config('bitaria_test.student',student::text,true);
  -- Keep existing discounts from affecting the deterministic fixture months.
  insert into public.student_discounts(student_id,scope,effective_month,discount_id)
    select student,'monthly',m::date,null from generate_series('2090-01-01'::date,'2090-06-01'::date,interval '1 month') m;
  snapshot:=public.save_student_billing_plan(student,'2090-01-01','prepaid',31,4,400,null);
  if (snapshot->>'remaining')::int<>4 then raise exception 'Initial allowance failed'; end if;
  if snapshot->'invoices'->0->>'due_date'<>'2090-01-31' then raise exception 'January due date failed'; end if;

  insert into public.scheduled_lessons(teacher_id,student_id,created_by,title,status,starts_at,ends_at,calendar_provider)
    select teacher,student,auth.uid(),'Billing fixture','completed',s,s+interval '1 hour','manual'
    from generate_series('2090-01-02 10:00-03'::timestamptz,'2090-01-03 10:00-03'::timestamptz,interval '1 day') s;
  snapshot:=public.get_student_billing(student);
  if (snapshot->>'remaining')::int<>2 then raise exception 'Completed lesson consumption failed'; end if;
  insert into public.scheduled_lessons(teacher_id,student_id,created_by,title,status,starts_at,ends_at,calendar_provider)
    values(teacher,student,auth.uid(),'Billing fixture','completed','2090-01-04 10:00-03','2090-01-04 11:00-03','manual') returning id into cancel_lesson;
  insert into public.scheduled_lessons(teacher_id,student_id,created_by,title,status,starts_at,ends_at,calendar_provider)
    values(teacher,student,auth.uid(),'Billing fixture','completed','2090-01-05 10:00-03','2090-01-05 11:00-03','manual') returning id into second_lesson;
  snapshot:=public.get_student_billing(student);
  if not (snapshot->>'balance_blocked')::boolean then raise exception 'Zero balance did not block'; end if;
  begin
    perform private.billing_check_booking(student);
    raise exception 'Zero balance booking accepted';
  exception when raise_exception then
    if sqlerrm not like 'Saldo de aulas esgotado%' then raise; end if;
  end;
  update public.scheduled_lessons set status='cancelled' where id=cancel_lesson;
  snapshot:=public.get_student_billing(student);
  if (snapshot->>'remaining')::int<>1 then raise exception 'Cancellation did not restore balance'; end if;
  perform private.billing_check_booking(student);

  perform set_config('bitaria_test.today','2090-02-01',true);
  snapshot:=public.get_student_billing(student);
  if (snapshot->>'remaining')::int<>5 then raise exception 'Monthly renewal did not accumulate unused credit'; end if;
  select id into invoice from public.student_billing_invoices where student_id=student and kind='monthly' and reference_month='2090-01-01';
  perform public.record_student_payment(invoice,400,'2090-01-31',gen_random_uuid());
  insert into public.commercial_discounts(name,kind,value) values('Billing fixture','percentage',25) returning id into discount;
  update public.student_discounts set discount_id=discount where student_id=student and scope='monthly' and effective_month='2090-02-01';
  snapshot:=public.get_student_billing(student);
  select id into invoice from public.student_billing_invoices where student_id=student and kind='monthly' and reference_month='2090-02-01';
  if (select due_date from public.student_billing_invoices where id=invoice)<>'2090-02-28' then raise exception 'Short-month due date clamp failed'; end if;
  if (select discount_amount from public.student_billing_invoices where id=invoice)<>100 then raise exception 'Invoice discount failed'; end if;
  perform public.record_student_payment(invoice,300,'2090-02-01',gen_random_uuid());

  extra:=gen_random_uuid();
  snapshot:=public.add_student_topup(student,2,100,extra);
  if (snapshot->>'remaining')::int<>5 then raise exception 'Unpaid topup granted credit'; end if;
  snapshot:=public.record_student_payment(extra,50,'2090-02-01',gen_random_uuid());
  if (snapshot->>'remaining')::int<>5 then raise exception 'Part-paid topup granted credit'; end if;
  payment:=gen_random_uuid();
  snapshot:=public.record_student_payment(extra,50,'2090-02-01',payment);
  if (snapshot->>'remaining')::int<>7 then raise exception 'Paid topup did not grant credit'; end if;
  snapshot:=public.record_student_payment(extra,50,'2090-02-01',payment);
  if (snapshot->>'remaining')::int<>7 then raise exception 'Payment retry duplicated credit'; end if;
  snapshot:=public.void_student_payment(payment);
  if (snapshot->>'remaining')::int<>5 then raise exception 'Payment reversal did not restore unpaid topup'; end if;
  perform public.record_student_payment(extra,50,'2090-02-01',gen_random_uuid());
  perform public.save_student_billing_plan(student,'2090-03-01','postpaid',31,0,0,null);
  perform set_config('bitaria_test.today','2090-03-15',true);
  snapshot:=public.get_student_billing(student);
  select id into invoice from public.student_billing_invoices where student_id=student and kind='monthly' and reference_month='2090-03-01';
  update public.student_billing_invoices set hourly_rate=100 where id=invoice;
  insert into public.scheduled_lessons(teacher_id,student_id,created_by,title,status,starts_at,ends_at,calendar_provider)
    values(teacher,student,auth.uid(),'Postpaid fixture','completed','2090-03-10 10:00-03','2090-03-10 11:30-03','manual');
  update public.commercial_discounts set value=10 where id=discount;
  update public.student_discounts set discount_id=discount where student_id=student and scope='monthly' and effective_month='2090-03-01';
  snapshot:=public.get_student_billing(student);
  if (snapshot->>'remaining')::int<>7 then raise exception 'Postpaid consumed prepaid credits'; end if;
  begin
    perform public.record_student_payment(invoice,1,'2090-03-15',gen_random_uuid());
    raise exception 'Draft invoice accepted payment';
  exception when raise_exception then
    if sqlerrm not like 'O fechamento%' then raise; end if;
  end;
  perform set_config('bitaria_test.today','2090-04-01',true);
  snapshot:=public.get_student_billing(student);
  if (select gross_amount-discount_amount from public.student_billing_invoices where id=invoice)<>135 then raise exception 'Postpaid monthly closing amount failed'; end if;
  if (select due_date from public.student_billing_invoices where id=invoice)<>'2090-04-30' then raise exception 'Postpaid due month failed'; end if;
  perform set_config('bitaria_test.today','2090-05-15',true);
  snapshot:=public.get_student_billing(student);
  if (snapshot->>'overdue_blocked')::boolean then raise exception 'Blocked at exactly 15 days'; end if;
  perform set_config('bitaria_test.today','2090-05-16',true);
  snapshot:=public.get_student_billing(student);
  if not (snapshot->>'overdue_blocked')::boolean then raise exception 'Not blocked after 15 days'; end if;
  begin
    insert into public.scheduled_lessons(teacher_id,student_id,created_by,title,status,starts_at,ends_at)
    values(teacher,student,auth.uid(),'Forbidden fixture','scheduled','2090-06-01 10:00-03','2090-06-01 11:00-03');
    raise exception 'Overdue account booked lesson';
  exception when raise_exception then
    if sqlerrm not like 'Novos agendamentos bloqueados%' then raise; end if;
  end;
  snapshot:=public.record_student_payment(invoice,135,'2090-05-16',gen_random_uuid());
  if (snapshot->>'overdue_blocked')::boolean then raise exception 'Payment did not unlock booking'; end if;
end;
$$;

select set_config('request.jwt.claims',json_build_object('sub',current_setting('bitaria_test.student'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare snapshot jsonb;
begin
  snapshot:=public.get_student_billing(auth.uid());
  if snapshot->'plan'->>'billing_mode'<>'postpaid' then raise exception 'Student cannot read own billing'; end if;
  begin
    perform public.get_student_billing(gen_random_uuid());
    raise exception 'Student read another account';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_student_billing_plan(auth.uid(),'2091-01-01','prepaid',5,100,0,null);
    raise exception 'Student edited own billing';
  exception when insufficient_privilege then null; end;
  begin
    perform public.record_student_payment(gen_random_uuid(),10,'2090-05-16',gen_random_uuid());
    raise exception 'Student recorded payment';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.student_billing_plans(student_id,effective_month,billing_mode,due_day) values(auth.uid(),'2091-01-01','postpaid',5);
    raise exception 'Student bypassed billing RPC';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set role='admin' where id=auth.uid();
    raise exception 'Student elevated own role';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set hourly_rate=0 where id=auth.uid();
    raise exception 'Student modified own price';
  exception when insufficient_privilege then null; end;
  update public.profiles set nickname='Billing rollback fixture' where id=auth.uid();
end;
$$;
rollback;
