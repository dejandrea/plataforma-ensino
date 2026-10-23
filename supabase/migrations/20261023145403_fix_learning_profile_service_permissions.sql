begin;

-- Keep this trigger SECURITY INVOKER. SQL boolean expressions do not promise
-- left-to-right evaluation: the former combined condition could check EXECUTE
-- on learning_role() even for a trusted service_role write from the admin API.
-- Separate PL/pgSQL statements prevent that call without granting more access.
create or replace function private.learning_guard_profile_access() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if (new.role, new.is_active, new.student_service_scope) is not distinct from
     (old.role, old.is_active, old.student_service_scope) then
    return new;
  end if;

  if private.learning_role() is distinct from 'admin' then
    raise exception 'Somente administradores podem alterar permissoes do perfil.' using errcode='42501';
  end if;
  return new;
end;
$$;

-- Preserve existing ACLs: no new public API and no EXECUTE grant to service_role.
revoke all on function private.learning_guard_profile_access() from public, anon, authenticated;

commit;
