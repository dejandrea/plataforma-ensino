begin;
alter table public.scheduled_lessons add column scheduling_request_id uuid;
create unique index scheduled_request_occurrence on public.scheduled_lessons(teacher_id,scheduling_request_id,recurrence_index) where scheduling_request_id is not null;
create function private.guard_new_schedule_overlap() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.scheduling_request_id is null or new.status='cancelled' then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.teacher_id::text,0));
 if exists(select 1 from public.scheduled_lessons s where s.teacher_id=new.teacher_id and s.id<>new.id and s.status<>'cancelled'
  and s.starts_at<new.ends_at and s.ends_at>new.starts_at and (s.status<>'available' or (new.status='available' and s.starts_at=new.starts_at and s.ends_at=new.ends_at))) then
  raise exception 'O horario ja possui um encontro.' using errcode='23514';end if;
 return new;
end $$;
revoke all on function private.guard_new_schedule_overlap() from public,anon,authenticated;
create trigger protect_new_schedule_overlap before insert or update of starts_at,ends_at,status on public.scheduled_lessons for each row execute function private.guard_new_schedule_overlap();
create or replace function public.start_scheduled_lesson_session(p_lesson_id uuid) returns public.scheduled_lessons
language plpgsql security definer set search_path='' as $$
declare result public.scheduled_lessons;
begin
 if auth.uid() is null or private.learning_role() is null then raise exception 'Conta ativa obrigatoria.' using errcode='42501';end if;
 update public.scheduled_lessons s set started_at=coalesce(s.started_at,now()),
 student_joined_at=case when s.student_id=auth.uid() then coalesce(s.student_joined_at,now()) else s.student_joined_at end,
 teacher_joined_at=case when s.teacher_id=auth.uid() then coalesce(s.teacher_joined_at,now()) else s.teacher_joined_at end,updated_at=now()
 where s.id=p_lesson_id and s.status='scheduled' and now()>=s.starts_at-interval '5 minutes'
 and ((s.student_id=auth.uid() and private.learning_role()='student' and now()<=s.starts_at+interval '15 minutes')
 or (s.teacher_id=auth.uid() and private.learning_role() in ('professor','admin')))
 returning * into result;
 if not found then raise exception 'Acesso fora do horario permitido ou encontro indisponivel.' using errcode='42501';end if;
 return result;
end $$;
revoke all on function public.start_scheduled_lesson_session(uuid) from public,anon;
grant execute on function public.start_scheduled_lesson_session(uuid) to authenticated;
commit;
