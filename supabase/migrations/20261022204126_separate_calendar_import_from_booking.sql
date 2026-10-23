begin;
create or replace function private.billing_booking_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Only the service-only import RPC can enable this transaction-local context.
  if current_setting('role',true)='service_role' and current_setting('bitaria.calendar_import',true)='on' then return new;end if;
  if new.student_id is not null and new.status='scheduled' then
    if tg_op='INSERT' then perform private.billing_check_booking(new.student_id);
    elsif old.status is distinct from 'scheduled' or old.student_id is distinct from new.student_id then perform private.billing_check_booking(new.student_id);
    end if;
  end if;
  return new;
end;
$$;

create function public.import_google_calendar_lessons(p_teacher_id uuid,p_lessons jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare previous_context text:=current_setting('bitaria.calendar_import',true);
begin
  if not exists(select 1 from public.profiles where id=p_teacher_id and role in ('admin','professor') and is_active) then raise exception 'Professora indisponivel.' using errcode='42501';end if;
  if jsonb_typeof(p_lessons) is distinct from 'array' then raise exception 'Eventos invalidos.' using errcode='22023';end if;
  if jsonb_array_length(p_lessons)>10000 then raise exception 'Quantidade de eventos excedida.' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(p_lessons) item where
    item->>'teacher_id' is distinct from p_teacher_id::text or item->>'created_by' is distinct from p_teacher_id::text
    or item->>'calendar_provider' is distinct from 'google_calendar' or coalesce(item->>'calendar_event_id','')=''
    or coalesce(item->>'calendar_calendar_id','')='' or coalesce(item->>'status','') not in ('available','scheduled','completed')) then
    raise exception 'Evento fora do escopo da importacao.' using errcode='22023';
  end if;
  perform set_config('bitaria.calendar_import','on',true);
  insert into public.scheduled_lessons(teacher_id,student_id,created_by,title,description,session_track,status,starts_at,ends_at,meet_link,calendar_provider,calendar_calendar_id,calendar_event_id,booked_at,updated_at)
  select teacher_id,student_id,created_by,title,description,session_track,status,starts_at,ends_at,meet_link,calendar_provider,calendar_calendar_id,calendar_event_id,booked_at,coalesce(updated_at,now())
  from jsonb_populate_recordset(null::public.scheduled_lessons,p_lessons)
  on conflict(teacher_id,calendar_provider,calendar_event_id) do update set
   student_id=excluded.student_id,created_by=excluded.created_by,title=excluded.title,description=excluded.description,
   session_track=excluded.session_track,status=excluded.status,starts_at=excluded.starts_at,ends_at=excluded.ends_at,
   meet_link=excluded.meet_link,calendar_calendar_id=excluded.calendar_calendar_id,booked_at=excluded.booked_at,updated_at=excluded.updated_at;
  perform set_config('bitaria.calendar_import',coalesce(previous_context,''),true);
exception when others then
  perform set_config('bitaria.calendar_import',coalesce(previous_context,''),true);
  raise;
end;
$$;
revoke all on function public.import_google_calendar_lessons(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.import_google_calendar_lessons(uuid,jsonb) to service_role;
commit;
