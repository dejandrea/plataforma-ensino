do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Usuarios podem atualizar o proprio perfil'
  ) then
    create policy "Usuarios podem atualizar o proprio perfil"
      on public.profiles
      for update
      to authenticated
      using (id = auth.uid())
      with check (id = auth.uid());
  end if;
end
$$;
