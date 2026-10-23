begin;
create function public.teacher_student_projects(p_student_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare student uuid:=p_student_id;
begin
 if not coalesce(private.learning_manages_student(student),false) then raise exception 'Aluno indisponivel para esta conta.' using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object(
  'title',a.title,'project_kind',private.official_project_kind(a.id),
  'assessment_criteria',coalesce(a.content_json->'assessmentCriteria','[]'::jsonb),
  'requirements',coalesce(a.content_json->'requirements','[]'::jsonb),
  'reviews',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at,r.id) from public.project_submission_reviews r where r.submission_id=s.id),'[]'::jsonb),
  'previous_versions',coalesce((select jsonb_agg(to_jsonb(prior)||jsonb_build_object('reviews',coalesce((
    select jsonb_agg(to_jsonb(r) order by r.created_at,r.id) from public.project_submission_reviews r where r.submission_id=prior.id),'[]'::jsonb)) order by prior.version desc)
   from public.project_submissions prior where prior.student_id=s.student_id and prior.activity_id=s.activity_id and prior.version<s.version),'[]'::jsonb)) order by s.submitted_at desc)
 from public.project_submissions s join public.lesson_activities a on a.id=s.activity_id where s.student_id=student
 and s.version=(select max(version) from public.project_submissions where student_id=student and activity_id=s.activity_id)),'[]'::jsonb);
end;
$$;
create or replace function public.teacher_project_inbox(p_scheduled_lesson_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare student uuid;
begin
 perform private.learning_require_teacher_meeting(p_scheduled_lesson_id);
 select student_id into student from public.scheduled_lessons where id=p_scheduled_lesson_id;
 return public.teacher_student_projects(student);
end;
$$;
revoke all on function public.teacher_student_projects(uuid) from public,anon;
grant execute on function public.teacher_student_projects(uuid) to authenticated;
revoke all on function public.teacher_project_inbox(uuid) from public,anon;
grant execute on function public.teacher_project_inbox(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
