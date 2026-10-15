create table public.commercial_discounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  kind text not null check (kind in ('percentage', 'fixed')),
  value numeric(10,2) not null check (value > 0 and value <> 'NaN'::numeric and (kind <> 'percentage' or value <= 100)),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.student_discounts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null check (scope in ('recurring', 'monthly')),
  effective_month date not null check (extract(day from effective_month) = 1),
  discount_id uuid references public.commercial_discounts(id) on delete restrict,
  name text not null,
  kind text not null check (kind in ('percentage', 'fixed')),
  value numeric(10,2) not null check (value >= 0 and value <> 'NaN'::numeric and (kind <> 'percentage' or value <= 100)),
  applied_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(student_id, scope, effective_month)
);
create index student_discounts_discount_id_idx on public.student_discounts(discount_id);
create index student_discounts_applied_by_idx on public.student_discounts(applied_by);

alter table public.commercial_discounts enable row level security;
alter table public.student_discounts enable row level security;
revoke all on public.commercial_discounts, public.student_discounts from anon;
grant select, insert, update, delete on public.commercial_discounts, public.student_discounts to authenticated, service_role;

create policy discounts_admin_all on public.commercial_discounts for all to authenticated
using (exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active))
with check (exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active));

create policy student_discounts_admin_all on public.student_discounts for all to authenticated
using (exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active))
with check (exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active));

create policy student_discounts_teacher_read on public.student_discounts for select to authenticated
using (
  exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'professor' and p.is_active)
  and exists(select 1 from public.teacher_student_relations r where r.student_id = student_discounts.student_id and r.teacher_id = (select auth.uid()))
);

create function public.snapshot_student_discount() returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  template public.commercial_discounts%rowtype;
begin
  if not exists (select 1 from public.profiles p where p.id = new.student_id and p.role = 'student') then
    raise exception 'O desconto deve ser vinculado a um aluno.';
  end if;
  if new.discount_id is null then
    new.name := 'Sem desconto';
    new.kind := 'percentage';
    new.value := 0;
  else
    select * into template from public.commercial_discounts where id = new.discount_id and is_active;
    if not found then raise exception 'Desconto inexistente ou inativo.'; end if;
    new.name := template.name;
    new.kind := template.kind;
    new.value := template.value;
  end if;
  new.applied_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.snapshot_student_discount() from public, anon;
grant execute on function public.snapshot_student_discount() to authenticated, service_role;
create trigger student_discount_snapshot before insert or update on public.student_discounts
for each row execute function public.snapshot_student_discount();

notify pgrst, 'reload schema';
