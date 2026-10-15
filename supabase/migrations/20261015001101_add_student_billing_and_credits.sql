create schema if not exists private;

create table public.student_billing_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  effective_month date not null check (extract(day from effective_month)=1),
  billing_mode text not null check (billing_mode in ('prepaid','postpaid')),
  due_day integer not null check (due_day between 1 and 31),
  monthly_lessons integer not null default 0 check (monthly_lessons between 0 and 1000),
  monthly_price numeric(10,2) not null default 0 check (monthly_price >= 0 and monthly_price <> 'NaN'::numeric),
  package_id uuid references public.commercial_packages(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (billing_mode <> 'prepaid' or monthly_lessons > 0),
  unique(student_id,effective_month)
);

create table public.student_billing_invoices (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.student_billing_plans(id) on delete restrict,
  reference_month date not null check(extract(day from reference_month)=1),
  kind text not null check(kind in ('monthly','topup')),
  billing_mode text not null check(billing_mode in ('prepaid','postpaid')),
  lesson_quantity integer not null default 0 check(lesson_quantity between 0 and 1000),
  hourly_rate numeric(10,2),
  due_date date not null,
  gross_amount numeric(10,2) not null default 0 check(gross_amount>=0 and gross_amount<>'NaN'::numeric),
  discount_amount numeric(10,2) not null default 0 check(discount_amount>=0 and discount_amount<=gross_amount),
  description text,
  created_at timestamptz not null default now()
);
create unique index billing_one_monthly_invoice on public.student_billing_invoices(student_id,reference_month) where kind='monthly';
create index billing_invoices_plan_idx on public.student_billing_invoices(plan_id);
create index billing_invoices_student_due_idx on public.student_billing_invoices(student_id,due_date);

create table public.student_billing_payments (
  id uuid primary key,
  invoice_id uuid not null references public.student_billing_invoices(id) on delete restrict,
  amount numeric(10,2) not null check(amount>0 and amount<>'NaN'::numeric),
  paid_on date not null,
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null
);
create index billing_payments_invoice_idx on public.student_billing_payments(invoice_id);
create index billing_payments_recorded_by_idx on public.student_billing_payments(recorded_by);
create index billing_payments_voided_by_idx on public.student_billing_payments(voided_by);
create index billing_plans_package_idx on public.student_billing_plans(package_id);
create index billing_plans_created_by_idx on public.student_billing_plans(created_by);

alter table public.student_billing_plans enable row level security;
alter table public.student_billing_invoices enable row level security;
alter table public.student_billing_payments enable row level security;
revoke all on public.student_billing_plans, public.student_billing_invoices, public.student_billing_payments from anon, authenticated;
grant select on public.student_billing_plans, public.student_billing_invoices, public.student_billing_payments to authenticated;
grant all on public.student_billing_plans, public.student_billing_invoices, public.student_billing_payments to service_role;

create policy billing_plan_read on public.student_billing_plans for select to authenticated using (
  student_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin' and p.is_active)
);
create policy billing_invoice_read on public.student_billing_invoices for select to authenticated using (
  student_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin' and p.is_active)
);
create policy billing_payment_read on public.student_billing_payments for select to authenticated using (
  exists(select 1 from public.student_billing_invoices i where i.id=invoice_id)
);

create function private.billing_today() returns date language sql stable set search_path='' as $$
  select (now() at time zone 'America/Bahia')::date;
$$;

create function private.billing_require_admin() returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active) then
    raise exception 'Somente a gestão pode gerenciar cobranças.' using errcode='42501';
  end if;
end;
$$;

create function private.billing_sync(p_student uuid) returns void language plpgsql security definer set search_path='' as $$
declare
  m date; plan public.student_billing_plans%rowtype; invoice public.student_billing_invoices%rowtype;
  due_month date; gross numeric; discount public.student_discounts%rowtype; reduction numeric;
  today date := private.billing_today();
begin
  perform pg_advisory_xact_lock(hashtextextended(p_student::text, 72001));
  for m in select s::date from generate_series(
    (select min(effective_month) from public.student_billing_plans where student_id=p_student),
    date_trunc('month',today::timestamp),interval '1 month') s
  loop
    select * into plan from public.student_billing_plans where student_id=p_student and effective_month<=m order by effective_month desc limit 1;
    if not found then continue; end if;
    due_month := case when plan.billing_mode='postpaid' then (m+interval '1 month')::date else m end;
    insert into public.student_billing_invoices(student_id,plan_id,reference_month,kind,billing_mode,lesson_quantity,hourly_rate,due_date,gross_amount)
    select p_student,plan.id,m,'monthly',plan.billing_mode,plan.monthly_lessons,p.hourly_rate,
      due_month + (least(plan.due_day,extract(day from due_month+interval '1 month - 1 day')::int)-1),
      case when plan.billing_mode='prepaid' then plan.monthly_price else 0 end
    from public.profiles p where p.id=p_student
    on conflict (student_id,reference_month) where kind='monthly' do nothing;
  end loop;

  update public.student_billing_invoices i set hourly_rate=p.hourly_rate from public.profiles p
    where i.student_id=p_student and p.id=p_student and i.billing_mode='postpaid' and i.hourly_rate is null;
  for invoice in select * from public.student_billing_invoices where student_id=p_student and kind='monthly' loop
    if invoice.billing_mode='postpaid' then
      select round(coalesce(sum(extract(epoch from (ends_at-starts_at))/3600 * invoice.hourly_rate),0),2)
      into gross from public.scheduled_lessons
      where student_id=p_student and status='completed'
        and starts_at >= (invoice.reference_month::timestamp at time zone 'America/Bahia')
        and starts_at < ((invoice.reference_month+interval '1 month') at time zone 'America/Bahia');
    else
      gross := invoice.gross_amount;
    end if;
    gross := greatest(coalesce(gross,0),0);
    select * into discount from public.student_discounts d
      where d.student_id=p_student and
        ((d.scope='monthly' and d.effective_month=invoice.reference_month)
          or (d.scope='recurring' and d.effective_month<=invoice.reference_month))
      order by (d.scope='monthly') desc,d.effective_month desc limit 1;
    reduction := case when not found then 0 when discount.kind='percentage' then round(gross*discount.value/100,2) else discount.value end;
    update public.student_billing_invoices set gross_amount=gross,discount_amount=least(gross,reduction) where id=invoice.id;
  end loop;
end;
$$;

create function private.billing_snapshot(p_student uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  today date:=private.billing_today(); month date:=date_trunc('month',today::timestamp)::date;
  plan public.student_billing_plans%rowtype; credits bigint; consumed bigint; overdue boolean; invoices jsonb; payments jsonb;
begin
  select * into plan from public.student_billing_plans where student_id=p_student and effective_month<=month order by effective_month desc limit 1;
  select coalesce(sum(i.lesson_quantity),0) into credits from public.student_billing_invoices i
    where i.student_id=p_student and i.billing_mode='prepaid' and i.reference_month<=month
      and (i.kind='monthly' or coalesce((select sum(amount) from public.student_billing_payments where invoice_id=i.id and voided_at is null),0)>=i.gross_amount-i.discount_amount);
  select count(*) into consumed from public.scheduled_lessons l
    join public.student_billing_invoices i on i.student_id=l.student_id and i.kind='monthly' and i.billing_mode='prepaid'
      and i.reference_month=date_trunc('month',l.starts_at at time zone 'America/Bahia')::date
    where l.student_id=p_student and l.status='completed' and i.reference_month<=month;
  select coalesce(jsonb_agg(x order by x.reference_month desc,x.created_at desc),'[]'::jsonb),coalesce(bool_or(x.kind='monthly' and x.overdue_days>15 and x.outstanding>0 and not x.is_draft),false)
  into invoices,overdue from (
    select i.*,coalesce(p.paid_total,0) paid_total, p.last_paid_on,
      greatest(i.gross_amount-i.discount_amount-coalesce(p.paid_total,0),0) outstanding,
      greatest(today-i.due_date,0) overdue_days,
      (i.kind='monthly' and i.billing_mode='postpaid' and i.reference_month>=month) is_draft,
      (i.billing_mode='postpaid' and i.hourly_rate is null) pricing_missing
    from public.student_billing_invoices i left join lateral (
      select sum(amount) paid_total,max(paid_on) last_paid_on from public.student_billing_payments where invoice_id=i.id and voided_at is null
    ) p on true where i.student_id=p_student
  ) x;
  select coalesce(jsonb_agg(p order by p.recorded_at desc),'[]'::jsonb) into payments from public.student_billing_payments p
    join public.student_billing_invoices i on i.id=p.invoice_id where i.student_id=p_student;
  return jsonb_build_object('plan',case when plan.id is null then null else to_jsonb(plan) end,
    'credits',credits,'consumed',consumed,'remaining',greatest(credits-consumed,0),'overage',greatest(consumed-credits,0),
    'overdue_blocked',overdue,'balance_blocked',plan.billing_mode='prepaid' and credits<=consumed,
    'invoices',invoices,'payments',payments,
    'plans',(select coalesce(jsonb_agg(s order by s.effective_month desc),'[]'::jsonb) from public.student_billing_plans s where s.student_id=p_student));
end;
$$;

create function public.get_student_billing(p_student_id uuid default auth.uid()) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if p_student_id is distinct from auth.uid() or not exists(select 1 from public.profiles where id=auth.uid() and role='student' and is_active) then
    perform private.billing_require_admin();
  end if;
  perform private.billing_sync(p_student_id);
  return private.billing_snapshot(p_student_id);
end;
$$;

create function public.save_student_billing_plan(p_student_id uuid,p_effective_month date,p_mode text,p_due_day integer,
  p_monthly_lessons integer default 0,p_monthly_price numeric default 0,p_package_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform private.billing_require_admin();
  if not exists(select 1 from public.profiles where id=p_student_id and role='student') then raise exception 'Aluno não encontrado.'; end if;
  if p_effective_month < date_trunc('month',private.billing_today()::timestamp)::date then raise exception 'Configure a cobrança a partir do mês atual ou de um mês futuro.'; end if;
  if exists(select 1 from public.student_billing_invoices where student_id=p_student_id and kind='monthly' and reference_month>=p_effective_month) then
    raise exception 'Esta competência já foi gerada. Programe a nova configuração para o próximo mês; ajuste vencimentos e registre recargas nas cobranças existentes.';
  end if;
  if p_package_id is not null and not exists(select 1 from public.commercial_packages where id=p_package_id and is_active) then raise exception 'Pacote inexistente ou inativo.'; end if;
  insert into public.student_billing_plans(student_id,effective_month,billing_mode,due_day,monthly_lessons,monthly_price,package_id,created_by)
  values(p_student_id,p_effective_month,p_mode,p_due_day,case when p_mode='prepaid' then p_monthly_lessons else 0 end,
    case when p_mode='prepaid' then p_monthly_price else 0 end,p_package_id,auth.uid())
  on conflict(student_id,effective_month) do update set billing_mode=excluded.billing_mode,due_day=excluded.due_day,
    monthly_lessons=excluded.monthly_lessons,monthly_price=excluded.monthly_price,package_id=excluded.package_id;
  perform private.billing_sync(p_student_id);
  return private.billing_snapshot(p_student_id);
end;
$$;

create function public.add_student_topup(p_student_id uuid,p_quantity integer,p_amount numeric,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare plan public.student_billing_plans%rowtype;
begin
  perform private.billing_require_admin();
  perform private.billing_sync(p_student_id);
  select * into plan from public.student_billing_plans where student_id=p_student_id and effective_month<=private.billing_today() order by effective_month desc limit 1;
  if not found or plan.billing_mode<>'prepaid' then raise exception 'Configure o aluno como pré-pago antes de registrar uma recarga.'; end if;
  if p_quantity is null or p_quantity<1 or p_quantity>1000 or p_amount is null or p_amount<0 or p_amount='NaN'::numeric then raise exception 'Informe uma quantidade positiva e um valor válido.'; end if;
  insert into public.student_billing_invoices(id,student_id,plan_id,reference_month,kind,billing_mode,lesson_quantity,due_date,gross_amount,description)
  values(p_request_id,p_student_id,plan.id,date_trunc('month',private.billing_today()::timestamp)::date,'topup','prepaid',p_quantity,private.billing_today(),p_amount,'Recarga extra')
  on conflict(id) do nothing;
  return private.billing_snapshot(p_student_id);
end;
$$;

create function public.record_student_payment(p_invoice_id uuid,p_amount numeric,p_paid_on date,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare invoice public.student_billing_invoices%rowtype; paid numeric;
begin
  perform private.billing_require_admin();
  select * into invoice from public.student_billing_invoices where id=p_invoice_id;
  if not found then raise exception 'Cobrança não encontrada.'; end if;
  perform private.billing_sync(invoice.student_id);
  select * into invoice from public.student_billing_invoices where id=p_invoice_id for update;
  if exists(select 1 from public.student_billing_payments where id=p_request_id and invoice_id=p_invoice_id) then return private.billing_snapshot(invoice.student_id); end if;
  if p_paid_on is null or p_paid_on>private.billing_today() then raise exception 'Informe a data real do pagamento, até hoje.'; end if;
  if invoice.billing_mode='postpaid' and invoice.reference_month>=date_trunc('month',private.billing_today()::timestamp)::date then raise exception 'O fechamento do pós-pago ocorre no dia 01 do mês seguinte.'; end if;
  if invoice.billing_mode='postpaid' and invoice.hourly_rate is null then raise exception 'Defina o valor hora/aula antes de receber.'; end if;
  select coalesce(sum(amount),0) into paid from public.student_billing_payments where invoice_id=p_invoice_id and voided_at is null;
  if p_amount is null or p_amount<=0 or p_amount='NaN'::numeric or round(p_amount,2)>invoice.gross_amount-invoice.discount_amount-paid then raise exception 'O valor deve ser positivo e não pode superar o saldo da cobrança.'; end if;
  insert into public.student_billing_payments(id,invoice_id,amount,paid_on,recorded_by) values(p_request_id,p_invoice_id,p_amount,p_paid_on,auth.uid());
  return private.billing_snapshot(invoice.student_id);
end;
$$;

create function public.void_student_payment(p_payment_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare student uuid;
begin
  perform private.billing_require_admin();
  select i.student_id into student from public.student_billing_payments p join public.student_billing_invoices i on i.id=p.invoice_id where p.id=p_payment_id;
  if not found then raise exception 'Pagamento não encontrado.'; end if;
  perform private.billing_sync(student);
  update public.student_billing_payments set voided_at=now(),voided_by=auth.uid() where id=p_payment_id and voided_at is null;
  return private.billing_snapshot(student);
end;
$$;

create function public.change_student_invoice_due_date(p_invoice_id uuid,p_due_date date) returns jsonb language plpgsql security definer set search_path='' as $$
declare student uuid;
begin
  perform private.billing_require_admin();
  if p_due_date is null then raise exception 'Informe o vencimento.'; end if;
  select student_id into student from public.student_billing_invoices where id=p_invoice_id;
  if not found then raise exception 'Cobrança não encontrada.'; end if;
  perform private.billing_sync(student);
  update public.student_billing_invoices set due_date=p_due_date where id=p_invoice_id;
  return private.billing_snapshot(student);
end;
$$;

create function private.billing_check_booking(p_student uuid) returns void language plpgsql security definer set search_path='' as $$
declare snapshot jsonb;
begin
  perform private.billing_sync(p_student);
  snapshot:=private.billing_snapshot(p_student);
  if (snapshot->>'overdue_blocked')::boolean then raise exception 'Novos agendamentos bloqueados: existe cobrança com mais de 15 dias de atraso.'; end if;
  if coalesce((snapshot->>'balance_blocked')::boolean,false) then raise exception 'Saldo de aulas esgotado. Solicite uma recarga à gestão.'; end if;
end;
$$;

create function public.assert_student_can_book(p_student_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin perform private.billing_check_booking(p_student_id); end;
$$;

create function private.billing_booking_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.student_id is not null and new.status='scheduled' then
    if tg_op='INSERT' then perform private.billing_check_booking(new.student_id);
    elsif old.status is distinct from 'scheduled' or old.student_id is distinct from new.student_id then perform private.billing_check_booking(new.student_id);
    end if;
  end if;
  return new;
end;
$$;
create trigger scheduled_lesson_billing_guard before insert or update on public.scheduled_lessons for each row execute function private.billing_booking_guard();

-- The existing self-service profile UPDATE policy must not let students change
-- their role or pricing and thereby bypass the billing administration checks.
create function private.protect_profile_commercial_fields() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_user in ('postgres','supabase_admin','service_role') then return new; end if;
  if row(new.id,new.role,new.is_active,new.hourly_rate,new.pricing_mode,new.pricing_session_track,new.pricing_package_id,new.student_service_scope,new.commercial_assignments)
    is distinct from row(old.id,old.role,old.is_active,old.hourly_rate,old.pricing_mode,old.pricing_session_track,old.pricing_package_id,old.student_service_scope,old.commercial_assignments)
    and not exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active) then
    raise exception 'Somente a gestão pode alterar permissões e condições comerciais do perfil.' using errcode='42501';
  end if;
  return new;
end;
$$;
create trigger profiles_protect_commercial_fields before update on public.profiles for each row execute function private.protect_profile_commercial_fields();
revoke all on function private.protect_profile_commercial_fields() from public,anon,authenticated;

create function private.billing_refresh_all() returns void language plpgsql security definer set search_path='' as $$
declare student uuid;
begin
  for student in select distinct student_id from public.student_billing_plans loop
    perform private.billing_sync(student);
  end loop;
end;
$$;

create function public.get_billing_management(p_due_month date) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform private.billing_require_admin();
  perform private.billing_refresh_all();
  return (select coalesce(jsonb_agg(x order by x.due_date,x.student_name),'[]'::jsonb) from (
    select i.*,s.full_name student_name,coalesce(p.paid_total,0) paid_total,p.last_paid_on,
      greatest(i.gross_amount-i.discount_amount-coalesce(p.paid_total,0),0) outstanding,
      greatest(private.billing_today()-i.due_date,0) overdue_days,
      (i.kind='monthly' and i.billing_mode='postpaid' and i.reference_month>=date_trunc('month',private.billing_today()::timestamp)::date) is_draft,
      (i.billing_mode='postpaid' and i.hourly_rate is null) pricing_missing
    from public.student_billing_invoices i join public.profiles s on s.id=i.student_id
    left join lateral(select sum(amount) paid_total,max(paid_on) last_paid_on from public.student_billing_payments where invoice_id=i.id and voided_at is null) p on true
    where i.due_date>=date_trunc('month',p_due_month::timestamp)::date and i.due_date<date_trunc('month',p_due_month::timestamp)+interval '1 month'
  ) x);
end;
$$;
revoke all on function public.get_billing_management(date) from public,anon,authenticated;
grant execute on function public.get_billing_management(date) to authenticated;

revoke all on function private.billing_today(),private.billing_require_admin(),private.billing_sync(uuid),private.billing_snapshot(uuid),
  private.billing_check_booking(uuid),private.billing_booking_guard(),private.billing_refresh_all() from public,anon,authenticated;
revoke all on function public.get_student_billing(uuid),public.save_student_billing_plan(uuid,date,text,integer,integer,numeric,uuid),
  public.add_student_topup(uuid,integer,numeric,uuid),public.record_student_payment(uuid,numeric,date,uuid),public.void_student_payment(uuid),
  public.change_student_invoice_due_date(uuid,date),public.assert_student_can_book(uuid) from public,anon,authenticated;
grant execute on function public.get_student_billing(uuid),public.save_student_billing_plan(uuid,date,text,integer,integer,numeric,uuid),
  public.add_student_topup(uuid,integer,numeric,uuid),public.record_student_payment(uuid,numeric,date,uuid),public.void_student_payment(uuid),
  public.change_student_invoice_due_date(uuid,date) to authenticated;
grant execute on function public.assert_student_can_book(uuid) to service_role;

create extension if not exists pg_cron;
select cron.schedule('bitaria-billing-renewal','0 3 * * *','select private.billing_refresh_all();');
notify pgrst,'reload schema';
