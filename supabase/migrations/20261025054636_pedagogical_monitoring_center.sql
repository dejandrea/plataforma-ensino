-- Read-only pedagogical projections. No new progress, grading or XP rules.
begin;

create function private.pedagogy_require_staff() returns void
language plpgsql stable security invoker set search_path='' as $$
begin
 if private.learning_role() is distinct from 'admin' and private.learning_role() is distinct from 'professor' then
   raise exception 'Acompanhamento disponível somente para a equipe ativa.' using errcode='42501';
 end if;
end $$;
revoke all on function private.pedagogy_require_staff() from public,anon,authenticated;

create function private.pedagogy_course_summary(p_student_id uuid)
returns table(course_id uuid,course_title text,total_lessons bigint,completed_lessons bigint,percent integer,status text,last_activity_at timestamptz,xp bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.pedagogy_require_staff();
 if not coalesce(private.learning_manages_student(p_student_id),false) then raise exception 'Aluno indisponível para esta conta.' using errcode='42501';end if;
 return query
 with curriculum as materialized(select * from private.student_curriculum_status(p_student_id)),
 courses as(select m.course_id,m.course_title,sum(m.total_lessons)::bigint total,sum(m.completed_lessons)::bigint completed,bool_and(m.course_completed) done from curriculum m group by m.course_id,m.course_title)
 select c.course_id,c.course_title,c.total,c.completed,case when c.total>0 then round(100.0*c.completed/c.total)::int else 0 end,
   case when c.done then 'completed' when c.completed>0 or dates.last_at is not null then 'in_progress' else 'not_started' end,
   dates.last_at,
   (select coalesce(sum(e.points),0)::bigint from public.student_xp_events e where e.student_id=p_student_id and e.active and (
     (e.event_type='course' and e.source_id=c.course_id) or
     (e.event_type='module' and exists(select 1 from public.modules m where m.id=e.source_id and m.course_id=c.course_id)) or
     (e.event_type='learning_submodule' and exists(select 1 from public.submodules sm join public.modules m on m.id=sm.module_id where sm.id=e.source_id and m.course_id=c.course_id)) or
     (e.event_type='lesson' and exists(select 1 from public.lessons l join public.submodules sm on sm.id=l.submodule_id join public.modules m on m.id=sm.module_id where l.id=e.source_id and m.course_id=c.course_id)) or
     (e.event_type in ('learning_activity','project_submission','project_evaluation') and exists(select 1 from public.lesson_activities a join public.lessons l on l.id=a.lesson_id join public.submodules sm on sm.id=l.submodule_id join public.modules m on m.id=sm.module_id where a.id=e.source_id and m.course_id=c.course_id))
   ))
 from courses c left join lateral(
   select max(t.at) last_at from (
     select p.updated_at at from public.student_activity_progress p join public.lesson_activities a on a.id=p.activity_id join public.lessons l on l.id=a.lesson_id join public.submodules sm on sm.id=l.submodule_id join public.modules m on m.id=sm.module_id where p.student_id=p_student_id and m.course_id=c.course_id
     union all select p.completed_at from public.student_progress p join public.lessons l on l.id=p.lesson_id join public.submodules sm on sm.id=l.submodule_id join public.modules m on m.id=sm.module_id where p.student_id=p_student_id and m.course_id=c.course_id and p.completed_at is not null
   ) t
 ) dates on true order by c.course_title,c.course_id;
end $$;
revoke all on function private.pedagogy_course_summary(uuid) from public,anon,authenticated;

-- Latest submission and latest review only; execution history stays in source tables.
create function private.pedagogy_project_rows()
returns table(submission_id uuid,student_id uuid,student_name text,activity_id uuid,title text,course_id uuid,course_title text,module_title text,lesson_title text,project_kind text,submitted_at timestamptz,status text,grade numeric)
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.pedagogy_require_staff();
 return query
 select s.id,s.student_id,coalesce(p.full_name,p.nickname,'Aluno'),a.id,a.title,c.id,c.title,m.title,l.title,private.official_project_kind(a.id),s.submitted_at,coalesce(r.status,'submitted'),r.grade
 from public.project_submissions s join public.profiles p on p.id=s.student_id
 join public.lesson_activities a on a.id=s.activity_id join public.lessons l on l.id=a.lesson_id
 join public.submodules sm on sm.id=l.submodule_id join public.modules m on m.id=sm.module_id join public.courses c on c.id=m.course_id
 left join lateral(select review.status,review.grade from public.project_submission_reviews review where review.submission_id=s.id order by review.created_at desc,review.id desc limit 1) r on true
 where private.learning_manages_student(s.student_id)
 and not exists(select 1 from public.project_submissions newer where newer.student_id=s.student_id and newer.activity_id=s.activity_id and newer.version>s.version);
end $$;
revoke all on function private.pedagogy_project_rows() from public,anon,authenticated;

create function private.pedagogy_dashboard(p_search text,p_course_id uuid,p_teacher_id uuid,p_status text,p_page integer,p_page_size integer,p_since timestamptz,p_until timestamptz) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.pedagogy_require_staff();
 if p_page is null or p_page<1 or p_page>100000 or p_page_size is null or p_page_size not between 1 and 50
   or p_status is null or p_status not in ('all','not_started','in_progress','completed','no_course') or length(coalesce(p_search,''))>200
   or p_since is null or p_until is null or p_since>=p_until then raise exception 'Filtros ou paginação inválidos.' using errcode='22023';end if;
 with students as materialized(
   select p.id,p.full_name,p.nickname from public.profiles p where p.role='student' and p.is_active and private.learning_manages_student(p.id)
   and (nullif(trim(p_search),'') is null or coalesce(p.full_name,'') ilike '%'||trim(p_search)||'%' or coalesce(p.nickname,'') ilike '%'||trim(p_search)||'%' or p.id::text=trim(p_search))
   and (p_teacher_id is null or exists(select 1 from public.teacher_student_relations r join public.profiles t on t.id=r.teacher_id and t.role='professor' and t.is_active where r.student_id=p.id and r.teacher_id=p_teacher_id))
 ), projects as materialized(select * from private.pedagogy_project_rows()), rows as materialized(
   select s.id student_id,coalesce(s.full_name,s.nickname,'Aluno') student_name,s.nickname,c.*,
     (select count(*) from projects pr where pr.student_id=s.id and (c.course_id is null or pr.course_id=c.course_id) and pr.status in ('submitted','in_review')) pending_projects
   from students s left join lateral private.pedagogy_course_summary(s.id) c on true
 ), matching as materialized(
   select * from rows where (p_course_id is null or course_id=p_course_id) and (p_status='all' or coalesce(status,'no_course')=p_status)
 ), page as(select * from matching order by lower(student_name),student_id,course_title,course_id nulls last limit p_page_size offset (p_page::bigint-1)*p_page_size)
 select jsonb_build_object(
   'summary',jsonb_build_object('active_students',(select count(distinct student_id) from matching),'students_in_progress',(select count(distinct student_id) from matching where status='in_progress'),'completed_courses',(select count(*) from matching where status='completed'),
     'pending_projects',(select count(*) from projects pr where pr.status in ('submitted','in_review') and exists(select 1 from matching x where x.student_id=pr.student_id and (x.course_id is null or x.course_id=pr.course_id))),
     'completed_activities',(select count(*) from public.student_activity_progress progress join public.lesson_activities a on a.id=progress.activity_id and a.revision=progress.activity_revision and a.is_active and a.publication_status='published' join public.lessons l on l.id=a.lesson_id join public.submodules sm on sm.id=l.submodule_id join public.modules m on m.id=sm.module_id where progress.status='completed' and progress.completed_at>=p_since and progress.completed_at<p_until and exists(select 1 from matching x where x.student_id=progress.student_id and x.course_id=m.course_id))),
   'items',coalesce((select jsonb_agg(to_jsonb(page)||jsonb_build_object('status',coalesce(page.status,'no_course')) order by lower(page.student_name),page.student_id,page.course_title) from page),'[]'::jsonb),
   'total',(select count(*) from matching),'page',p_page,'page_size',p_page_size,
   'courses',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title) order by c.title,c.id) from public.courses c where c.is_active),'[]'::jsonb),
   'teachers',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(p.full_name,p.nickname,'Professora')) order by p.full_name,p.id) from public.profiles p where p.is_active and p.role='professor' and (private.learning_role()='admin' or p.id=auth.uid())),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function private.pedagogy_dashboard(text,uuid,uuid,text,integer,integer,timestamptz,timestamptz) from public,anon,authenticated;

create function public.pedagogy_dashboard(p_search text default '',p_course_id uuid default null,p_teacher_id uuid default null,p_status text default 'all',p_page integer default 1,p_page_size integer default 20,p_since timestamptz default now()-interval '30 days',p_until timestamptz default now()) returns jsonb
language sql stable security invoker set search_path='' as $$select private.pedagogy_dashboard(p_search,p_course_id,p_teacher_id,p_status,p_page,p_page_size,p_since,p_until);$$;
revoke all on function public.pedagogy_dashboard(text,uuid,uuid,text,integer,integer,timestamptz,timestamptz) from public,anon;
grant execute on function public.pedagogy_dashboard(text,uuid,uuid,text,integer,integer,timestamptz,timestamptz),private.pedagogy_dashboard(text,uuid,uuid,text,integer,integer,timestamptz,timestamptz) to authenticated;

create function private.pedagogy_student_journey(p_student_id uuid,p_course_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;selected_course uuid;
begin
 perform private.pedagogy_require_staff();
 if not coalesce(private.learning_manages_student(p_student_id),false) then raise exception 'Aluno indisponível para esta conta.' using errcode='42501';end if;
 if p_course_id is null then select c.course_id into selected_course from private.pedagogy_course_summary(p_student_id) c limit 1;
 else selected_course:=p_course_id;if not exists(select 1 from private.pedagogy_course_summary(p_student_id) c where c.course_id=selected_course) then raise exception 'Curso indisponível para este aluno.' using errcode='42501';end if;end if;
 with curriculum as materialized(select * from private.student_curriculum_status(p_student_id) where course_id=selected_course),
 lessons as materialized(
   select l.id,l.title,l.submodule_id,coalesce((to_jsonb(l)->>'order_index')::double precision,0) order_index,p.completed_at,
     case when p.completed_at is not null then 'completed' when exists(select 1 from public.student_activity_progress sp join public.lesson_activities a on a.id=sp.activity_id where sp.student_id=p_student_id and a.lesson_id=l.id and sp.activity_revision=a.revision and sp.status<>'not_started') then 'in_progress' else 'not_started' end status,
     (select count(*) from public.lesson_activities a where a.lesson_id=l.id and a.is_active and a.publication_status='published' and a.is_required) required_total,
     (select count(*) from public.lesson_activities a join public.student_activity_progress sp on sp.activity_id=a.id and sp.activity_revision=a.revision and sp.student_id=p_student_id and sp.status='completed' where a.lesson_id=l.id and a.is_active and a.publication_status='published' and a.is_required) required_completed,
     (select max(sp.updated_at) from public.student_activity_progress sp join public.lesson_activities a on a.id=sp.activity_id where sp.student_id=p_student_id and a.lesson_id=l.id) last_activity_at
   from public.lessons l join public.submodules sm on sm.id=l.submodule_id and sm.is_active join curriculum m on m.id=sm.module_id
   left join public.student_progress p on p.lesson_id=l.id and p.student_id=p_student_id
 ), submodules as(
   select sm.id,sm.title,sm.module_id,coalesce((to_jsonb(sm)->>'order_index')::double precision,0) order_index,count(l.id) total_lessons,count(l.id) filter(where l.completed_at is not null) completed_lessons
   from public.submodules sm join curriculum m on m.id=sm.module_id left join lessons l on l.submodule_id=sm.id where sm.is_active group by sm.id
 ) select jsonb_build_object(
   'student',(select jsonb_build_object('id',p.id,'name',coalesce(p.full_name,p.nickname,'Aluno'),'nickname',p.nickname) from public.profiles p where p.id=p_student_id),
   'courses',coalesce((select jsonb_agg(to_jsonb(c) order by c.course_title,c.course_id) from private.pedagogy_course_summary(p_student_id) c),'[]'::jsonb),'selected_course_id',selected_course,
   'modules',coalesce((select jsonb_agg(to_jsonb(m) order by m.order_index,m.id) from curriculum m),'[]'::jsonb),
   'submodules',coalesce((select jsonb_agg(to_jsonb(sm) order by sm.order_index,sm.id) from submodules sm),'[]'::jsonb),
   'lessons',coalesce((select jsonb_agg(to_jsonb(l) order by l.order_index,l.id) from lessons l),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function private.pedagogy_student_journey(uuid,uuid) from public,anon;
grant execute on function private.pedagogy_student_journey(uuid,uuid) to authenticated;
create function public.pedagogy_student_journey(p_student_id uuid,p_course_id uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$select private.pedagogy_student_journey(p_student_id,p_course_id);$$;
revoke all on function public.pedagogy_student_journey(uuid,uuid) from public,anon;
grant execute on function public.pedagogy_student_journey(uuid,uuid) to authenticated;

create function private.pedagogy_require_lesson(p_student_id uuid,p_lesson_id uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.pedagogy_require_staff();
 if not coalesce(private.learning_manages_student(p_student_id),false) then raise exception 'Aluno indisponível para esta conta.' using errcode='42501';end if;
 if not exists(select 1 from public.lessons l join public.submodules sm on sm.id=l.submodule_id and sm.is_active join private.student_curriculum_status(p_student_id) m on m.id=sm.module_id where l.id=p_lesson_id) then raise exception 'Aula indisponível para este aluno.' using errcode='42501';end if;
end $$;
revoke all on function private.pedagogy_require_lesson(uuid,uuid) from public,anon,authenticated;

create function private.pedagogy_lesson_detail(p_student_id uuid,p_lesson_id uuid,p_page integer,p_page_size integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.pedagogy_require_lesson(p_student_id,p_lesson_id);
 if p_page is null or p_page<1 or p_page>100000 or p_page_size is null or p_page_size not between 1 and 50 then raise exception 'Paginação inválida.' using errcode='22023';end if;
 with activities as materialized(select a.* from public.lesson_activities a where a.lesson_id=p_lesson_id and a.is_active and a.publication_status='published'),
 page as(select * from activities order by order_index,id limit p_page_size offset (p_page::bigint-1)*p_page_size),
 details as(select a.id,a.title,a.activity_type,a.content_json->>'interactionType' interaction_type,a.is_required,a.revision,a.order_index,
   coalesce(p.status,'not_started') status,p.completed_at,p.updated_at,
   private.learning_prerequisites_complete(p_student_id,a.id) and exists(select 1 from public.lessons l join public.submodules sm on sm.id=l.submodule_id join private.student_curriculum_status(p_student_id) m on m.id=sm.module_id where l.id=p_lesson_id and m.is_unlocked) is_unlocked,
   (select coalesce(sum(e.points),0) from public.student_xp_events e where e.student_id=p_student_id and e.source_id=a.id and e.active and e.event_type in ('learning_activity','project_submission','project_evaluation')) xp,
   case when a.activity_type='quiz' then jsonb_array_length(a.content_json->'questions') end question_count,
   case when a.activity_type in ('quiz','interactive') then (a.content_json->>'maxAttempts')::int end max_attempts,
   (select count(*) from public.quiz_attempts q where q.student_id=p_student_id and q.activity_id=a.id and q.activity_revision=a.revision) attempts_total,
   (select jsonb_build_object('score',q.score,'passed',q.passed,'submitted_at',q.submitted_at) from public.quiz_attempts q where q.student_id=p_student_id and q.activity_id=a.id and q.activity_revision=a.revision order by q.attempt_number desc limit 1) latest_attempt
 from page a left join public.student_activity_progress p on p.activity_id=a.id and p.student_id=p_student_id and p.activity_revision=a.revision)
 select jsonb_build_object('lesson_id',p_lesson_id,'items',coalesce((select jsonb_agg(to_jsonb(d) order by d.order_index,d.id) from details d),'[]'::jsonb),'total',(select count(*) from activities),'page',p_page,'page_size',p_page_size) into result;
 return result;
end $$;
revoke all on function private.pedagogy_lesson_detail(uuid,uuid,integer,integer) from public,anon;
grant execute on function private.pedagogy_lesson_detail(uuid,uuid,integer,integer) to authenticated;
create function public.pedagogy_lesson_detail(p_student_id uuid,p_lesson_id uuid,p_page integer default 1,p_page_size integer default 20) returns jsonb
language sql stable security invoker set search_path='' as $$select private.pedagogy_lesson_detail(p_student_id,p_lesson_id,p_page,p_page_size);$$;
revoke all on function public.pedagogy_lesson_detail(uuid,uuid,integer,integer) from public,anon;
grant execute on function public.pedagogy_lesson_detail(uuid,uuid,integer,integer) to authenticated;

create function private.pedagogy_activity_attempts(p_student_id uuid,p_activity_id uuid,p_page integer,p_page_size integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare lesson uuid;result jsonb;
begin
 select lesson_id into lesson from public.lesson_activities where id=p_activity_id and is_active and publication_status='published';
 perform private.pedagogy_require_lesson(p_student_id,lesson);
 if p_page is null or p_page<1 or p_page>100000 or p_page_size is null or p_page_size not between 1 and 50 then raise exception 'Paginação inválida.' using errcode='22023';end if;
 with attempts as materialized(select q.id,q.attempt_number,q.score,q.passed,q.submitted_at,q.activity_revision from public.quiz_attempts q where q.student_id=p_student_id and q.activity_id=p_activity_id),
 page as(select * from attempts order by submitted_at desc,attempt_number desc limit p_page_size offset (p_page::bigint-1)*p_page_size)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.submitted_at desc,p.attempt_number desc) from page p),'[]'::jsonb),'total',(select count(*) from attempts),'page',p_page,'page_size',p_page_size) into result;
 return result;
end $$;
revoke all on function private.pedagogy_activity_attempts(uuid,uuid,integer,integer) from public,anon;
grant execute on function private.pedagogy_activity_attempts(uuid,uuid,integer,integer) to authenticated;
create function public.pedagogy_activity_attempts(p_student_id uuid,p_activity_id uuid,p_page integer default 1,p_page_size integer default 10) returns jsonb
language sql stable security invoker set search_path='' as $$select private.pedagogy_activity_attempts(p_student_id,p_activity_id,p_page,p_page_size);$$;
revoke all on function public.pedagogy_activity_attempts(uuid,uuid,integer,integer) from public,anon;
grant execute on function public.pedagogy_activity_attempts(uuid,uuid,integer,integer) to authenticated;

create function private.pedagogy_projects(p_search text,p_course_id uuid,p_teacher_id uuid,p_status text,p_page integer,p_page_size integer,p_student_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.pedagogy_require_staff();
 if p_page is null or p_page<1 or p_page>100000 or p_page_size is null or p_page_size not between 1 and 50
   or p_status is null or p_status not in ('all','pending','reviewed','needs_revision','approved') or length(coalesce(p_search,''))>200 then raise exception 'Filtros ou paginação inválidos.' using errcode='22023';end if;
 if p_student_id is not null and not coalesce(private.learning_manages_student(p_student_id),false) then raise exception 'Aluno indisponível para esta conta.' using errcode='42501';end if;
 with matching as materialized(select pr.* from private.pedagogy_project_rows() pr
   where (p_student_id is null or pr.student_id=p_student_id) and (p_course_id is null or pr.course_id=p_course_id)
   and (nullif(trim(p_search),'') is null or pr.student_name ilike '%'||trim(p_search)||'%' or pr.student_id::text=trim(p_search))
   and (p_teacher_id is null or exists(select 1 from public.teacher_student_relations r join public.profiles t on t.id=r.teacher_id and t.role='professor' and t.is_active where r.student_id=pr.student_id and r.teacher_id=p_teacher_id))
   and (p_status='all' or (p_status='pending' and pr.status in ('submitted','in_review')) or (p_status='reviewed' and pr.status in ('approved','needs_revision')) or pr.status=p_status)),
 page as(select * from matching order by submitted_at desc,submission_id limit p_page_size offset (p_page::bigint-1)*p_page_size)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.submitted_at desc,p.submission_id) from page p),'[]'::jsonb),'total',(select count(*) from matching),'page',p_page,'page_size',p_page_size) into result;
 return result;
end $$;
revoke all on function private.pedagogy_projects(text,uuid,uuid,text,integer,integer,uuid) from public,anon;
grant execute on function private.pedagogy_projects(text,uuid,uuid,text,integer,integer,uuid) to authenticated;
create function public.pedagogy_projects(p_search text default '',p_course_id uuid default null,p_teacher_id uuid default null,p_status text default 'pending',p_page integer default 1,p_page_size integer default 20,p_student_id uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$select private.pedagogy_projects(p_search,p_course_id,p_teacher_id,p_status,p_page,p_page_size,p_student_id);$$;
revoke all on function public.pedagogy_projects(text,uuid,uuid,text,integer,integer,uuid) from public,anon;
grant execute on function public.pedagogy_projects(text,uuid,uuid,text,integer,integer,uuid) to authenticated;

create function private.pedagogy_project_detail(p_submission_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare student uuid;result jsonb;
begin
 perform private.pedagogy_require_staff();
 select student_id into student from public.project_submissions where id=p_submission_id;
 if student is null or not coalesce(private.learning_manages_student(student),false) then raise exception 'Entrega indisponível para esta conta.' using errcode='42501';end if;
 -- Reuse the Etapa D projection (criteria, links, reviews and previous versions).
 select item into result from jsonb_array_elements(public.teacher_student_projects(student)) item where item->>'id'=p_submission_id::text;
 if result is null then raise exception 'Abra a versão mais recente do projeto.' using errcode='23514';end if;
 return result;
end $$;
revoke all on function private.pedagogy_project_detail(uuid) from public,anon;
grant execute on function private.pedagogy_project_detail(uuid) to authenticated;
create function public.pedagogy_project_detail(p_submission_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select private.pedagogy_project_detail(p_submission_id);$$;
revoke all on function public.pedagogy_project_detail(uuid) from public,anon;
grant execute on function public.pedagogy_project_detail(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
