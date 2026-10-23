begin;
alter table public.student_billing_invoices add column discount_override jsonb;
create table public.invoice_discount_audit(
 id uuid primary key,invoice_id uuid not null references public.student_billing_invoices(id) on delete restrict,
 previous_override jsonb,next_override jsonb not null,applied_by uuid not null references public.profiles(id),applied_at timestamptz not null default now());
alter table public.invoice_discount_audit enable row level security;
revoke all on public.invoice_discount_audit from public,anon,authenticated;
grant select on public.invoice_discount_audit to authenticated;
create policy invoice_discount_audit_admin on public.invoice_discount_audit for select to authenticated
using(exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active));

alter function private.billing_sync(uuid) rename to billing_sync_before_invoice_discounts;
create function private.billing_sync(p_student uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.billing_sync_before_invoice_discounts(p_student);
 update public.student_billing_invoices i set discount_amount=least(
  greatest(i.gross_amount-coalesce((select sum(amount) from public.student_billing_payments where invoice_id=i.id and voided_at is null),0),0),
  case when i.discount_override->>'kind'='percentage' then round(i.gross_amount*(i.discount_override->>'value')::numeric/100,2) else (i.discount_override->>'value')::numeric end)
 where i.student_id=p_student and i.discount_override is not null;
end;
$$;
revoke all on function private.billing_sync(uuid),private.billing_sync_before_invoice_discounts(uuid) from public,anon,authenticated;

create function public.apply_invoice_discount(p_invoice_id uuid,p_discount_id uuid,p_amount numeric,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare invoice public.student_billing_invoices;template public.commercial_discounts;next_value jsonb;reduction numeric;paid numeric;receipt public.invoice_discount_audit;
begin
 perform private.billing_require_admin();
 if p_request_id is null then raise exception 'Identificacao obrigatoria.' using errcode='22023';end if;
 select * into invoice from public.student_billing_invoices where id=p_invoice_id;
 if not found then raise exception 'Cobranca nao encontrada.' using errcode='22023';end if;
 perform private.billing_sync(invoice.student_id);
 select * into invoice from public.student_billing_invoices where id=p_invoice_id for update;
 if p_discount_id is not null then
  if p_amount is not null then raise exception 'Escolha desconto cadastrado ou avulso.' using errcode='22023';end if;
  select * into template from public.commercial_discounts where id=p_discount_id and is_active;
  if not found then raise exception 'Desconto inexistente ou inativo.' using errcode='22023';end if;
  next_value:=jsonb_build_object('name',template.name,'kind',template.kind,'value',template.value,'discountId',template.id);
 else
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<0 or p_amount>99999999.99 or p_amount<>round(p_amount,2) then raise exception 'Informe valor em reais, nao negativo e com ate duas casas decimais.' using errcode='22023';end if;
  next_value:=jsonb_build_object('name',case when p_amount=0 then 'Sem desconto nesta cobrança' else 'Desconto avulso' end,'kind','fixed','value',p_amount,'discountId',null);
 end if;
 select * into receipt from public.invoice_discount_audit where id=p_request_id;
 if found then
  if receipt.invoice_id is distinct from p_invoice_id or receipt.next_override is distinct from next_value then raise exception 'Identificacao ja utilizada em outra alteracao.' using errcode='22023';end if;
  return private.billing_snapshot(invoice.student_id);
 end if;
 if invoice.billing_mode='postpaid' and invoice.hourly_rate is null then raise exception 'Defina a hora/aula antes do desconto.' using errcode='22023';end if;
 reduction:=case when next_value->>'kind'='percentage' then round(invoice.gross_amount*(next_value->>'value')::numeric/100,2) else (next_value->>'value')::numeric end;
 select coalesce(sum(amount),0) into paid from public.student_billing_payments where invoice_id=p_invoice_id and voided_at is null;
 if reduction>greatest(invoice.gross_amount-paid,0) then raise exception 'O desconto nao pode superar o valor bruto menos os pagamentos registrados.' using errcode='22023';end if;
 insert into public.invoice_discount_audit values(p_request_id,invoice.id,invoice.discount_override,next_value,auth.uid(),now());
 update public.student_billing_invoices set discount_override=next_value,discount_amount=reduction where id=invoice.id;
 return private.billing_snapshot(invoice.student_id);
end;
$$;
revoke all on function public.apply_invoice_discount(uuid,uuid,numeric,uuid) from public,anon;
grant execute on function public.apply_invoice_discount(uuid,uuid,numeric,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
