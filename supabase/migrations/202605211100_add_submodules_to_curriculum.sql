create table if not exists public.submodules (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  title text not null,
  description text,
  order_index double precision,
  duration_minutes integer,
  is_active boolean not null default true,
  created_at timestamp with time zone default now()
);

create index if not exists idx_submodules_module_id
  on public.submodules (module_id);

create index if not exists idx_submodules_module_order
  on public.submodules (module_id, order_index);

alter table public.submodules enable row level security;

drop policy if exists submodules_admin_all on public.submodules;
create policy submodules_admin_all
  on public.submodules
  for all
  to authenticated
  using (
    (
      select profiles.role
      from public.profiles
      where profiles.id = auth.uid()
    ) = 'admin'
  )
  with check (
    (
      select profiles.role
      from public.profiles
      where profiles.id = auth.uid()
    ) = 'admin'
  );

drop policy if exists submodules_authenticated_select on public.submodules;
create policy submodules_authenticated_select
  on public.submodules
  for select
  to authenticated
  using (true);

drop policy if exists submodules_public_select on public.submodules;
create policy submodules_public_select
  on public.submodules
  for select
  to public
  using (true);

alter table public.lessons
  add column if not exists submodule_id uuid references public.submodules (id) on delete cascade;

create index if not exists idx_lessons_submodule_id
  on public.lessons (submodule_id);

insert into public.submodules (
  module_id,
  title,
  description,
  order_index,
  duration_minutes,
  is_active
)
select
  m.id,
  'Conteudo principal',
  'Submodulo criado automaticamente para organizar as aulas ja existentes.',
  1,
  coalesce(m.duration_minutes, 0),
  coalesce(m.is_active, true)
from public.modules m
where exists (
  select 1
  from public.lessons l
  where l.module_id = m.id
)
and not exists (
  select 1
  from public.submodules s
  where s.module_id = m.id
);

with first_submodule_per_module as (
  select distinct on (module_id)
    module_id,
    id
  from public.submodules
  order by module_id, order_index nulls last, created_at, id
)
update public.lessons l
set submodule_id = s.id
from first_submodule_per_module s
where l.submodule_id is null
  and l.module_id = s.module_id;

alter table public.lessons
  alter column submodule_id set not null;
