-- Structural HTML v2 release. Does NOT import/publish activities or issue XP.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table public.profiles,public.lessons,public.lesson_activities,public.submodules,
 public.student_progress,public.student_activity_progress,public.quiz_attempts,
 public.activity_attempt_sessions,public.project_submissions,public.module_evaluations,
 public.student_xp_events,public.scheduled_lessons,public.lesson_plan_sessions,
 public.teacher_lesson_plans,public.activity_quiz_keys,public.project_submission_reviews in share row exclusive mode;
create table if not exists private.curriculum_migration_snapshots(
 key text primary key,created_at timestamptz not null default now(),before_state jsonb not null,
 activity_hashes jsonb not null
);
alter table private.curriculum_migration_snapshots enable row level security;
revoke all on private.curriculum_migration_snapshots from public,anon,authenticated;

do $release$
declare target constant uuid:='253477d3-e90d-42b8-88d8-a4a512418cf5'; expected jsonb:='[{"id":"0e266fd8-94f7-407a-8a37-6277b7eb6e56","row_hash":"12f4c4ac926dab1f643e76454fe26f8b"},{"id":"111d3ae2-0ec0-4b58-9e4e-1b47d0798528","row_hash":"67fdf369b73743544c89895445f0ddc0"},{"id":"2b0e7617-4fa8-4df7-ba77-0a7740761ed2","row_hash":"ddb723676487246b1d96d945d32011ea"},{"id":"53c5fdec-da42-4843-b8b7-f0856dad9f1e","row_hash":"896de0cf3b2b51a46b05de07e711c901"},{"id":"a3c98437-d1d6-4f6e-abaa-d10c7399e1c0","row_hash":"98c623707d34995bd246f1c44e7bd669"},{"id":"b47f62f4-fbf8-48be-aad8-8e7cf4093080","row_hash":"10ad796892b37f23fd6e46b2bf77e6b0"},{"id":"c4d1676c-4396-4cf5-a1fd-b678f19dd56c","row_hash":"06ad62ae7ac1f4b8b7c62760134084bf"},{"id":"edf52b7d-3b97-4aa6-a220-30c1002ab123","row_hash":"b5586a953951c93d526caf0777dc9033"}]'::jsonb;
 actual jsonb; source record; plan jsonb:='{"key":"html-basic-v2","version":2,"courseId":"6fada12b-4073-40ce-9bfb-e5ecfc2c453d","moduleId":"253477d3-e90d-42b8-88d8-a4a512418cf5","existingLessons":[{"id":"4d16131a-e2a7-40d2-9228-ee014bff701e","number":0,"order":1,"title":"Aula 00 — Bem-vindo ao HTML"},{"id":"10972956-955b-4199-a062-4317ee2ee70c","number":1,"order":2,"title":"Máquinas que Mudaram o Mundo"}],"activityHashes":[{"id":"0e266fd8-94f7-407a-8a37-6277b7eb6e56","row_hash":"12f4c4ac926dab1f643e76454fe26f8b"},{"id":"111d3ae2-0ec0-4b58-9e4e-1b47d0798528","row_hash":"67fdf369b73743544c89895445f0ddc0"},{"id":"2b0e7617-4fa8-4df7-ba77-0a7740761ed2","row_hash":"ddb723676487246b1d96d945d32011ea"},{"id":"53c5fdec-da42-4843-b8b7-f0856dad9f1e","row_hash":"896de0cf3b2b51a46b05de07e711c901"},{"id":"a3c98437-d1d6-4f6e-abaa-d10c7399e1c0","row_hash":"98c623707d34995bd246f1c44e7bd669"},{"id":"b47f62f4-fbf8-48be-aad8-8e7cf4093080","row_hash":"10ad796892b37f23fd6e46b2bf77e6b0"},{"id":"c4d1676c-4396-4cf5-a1fd-b678f19dd56c","row_hash":"06ad62ae7ac1f4b8b7c62760134084bf"},{"id":"edf52b7d-3b97-4aa6-a220-30c1002ab123","row_hash":"b5586a953951c93d526caf0777dc9033"}],"submodules":[{"id":"7ba3b0f4-7078-47df-aaa4-a7ee460b3f3e","order":1,"previousTitle":"História dos computadores","title":"As Origens da Tecnologia","description":"Compreender a evolução da computação e reconhecer pessoas que transformaram a tecnologia."},{"id":"627f2b9e-dd2d-4b9d-8897-1ebb7079ed1f","order":2,"previousTitle":"Clients e Servers","title":"Desvendando a Internet e a Web","description":"Compreender como a internet conecta dispositivos e como páginas chegam ao navegador."},{"id":"046e5535-6fe8-4507-9e86-557feeb92c8b","order":3,"previousTitle":"Linguagens","title":"A Linguagem da Web","description":"Conhecer as tecnologias da web e preparar o ambiente de desenvolvimento."},{"id":"b17a2000-0000-4000-8000-000000000004","order":4,"title":"Construindo com HTML","description":"Criar páginas com estrutura, textos, listas, imagens e links."},{"id":"b17a2000-0000-4000-8000-000000000005","order":5,"title":"Minha Primeira Criação","description":"Planejar, construir, revisar e apresentar um site autoral."}],"lessons":[{"id":"b17a2000-0000-4000-8000-000000001002","number":2,"submoduleId":"7ba3b0f4-7078-47df-aaa4-a7ee460b3f3e","order":3,"title":"Grandes Nomes da Tecnologia","duration":25,"objective":"Reconhecer contribuições de Babbage, Lovelace, Turing, Hopper, Johnson e Berners-Lee."},{"id":"b17a2000-0000-4000-8000-000000001003","number":3,"submoduleId":"627f2b9e-dd2d-4b9d-8897-1ebb7079ed1f","order":1,"title":"Como Surgiram a Internet e a Web","duration":25,"objective":"Diferenciar internet e web e reconhecer a importância dos hiperlinks."},{"id":"b17a2000-0000-4000-8000-000000001004","number":4,"submoduleId":"627f2b9e-dd2d-4b9d-8897-1ebb7079ed1f","order":2,"title":"Clientes e Servidores: Quem Conversa com Quem?","duration":25,"objective":"Distinguir hardware e software e identificar os papéis de cliente e servidor."},{"id":"b17a2000-0000-4000-8000-000000001005","number":5,"submoduleId":"627f2b9e-dd2d-4b9d-8897-1ebb7079ed1f","order":3,"title":"A Viagem de um Site","duration":25,"objective":"Explicar o caminho de acesso a um site e as funções de domínio, DNS e hospedagem."},{"id":"b17a2000-0000-4000-8000-000000001006","number":6,"submoduleId":"046e5535-6fe8-4507-9e86-557feeb92c8b","order":1,"title":"Como Conversamos com os Computadores?","duration":20,"objective":"Distinguir linguagens de programação e marcação e reconhecer execução no cliente e servidor."},{"id":"b17a2000-0000-4000-8000-000000001007","number":7,"submoduleId":"046e5535-6fe8-4507-9e86-557feeb92c8b","order":2,"title":"HTML: O Esqueleto de uma Página","duration":20,"objective":"Diferenciar estrutura, apresentação e comportamento: HTML, CSS e JavaScript."},{"id":"b17a2000-0000-4000-8000-000000001008","number":8,"submoduleId":"046e5535-6fe8-4507-9e86-557feeb92c8b","order":3,"title":"Preparando Nossa Oficina","duration":30,"objective":"Organizar pastas, preparar o VS Code e abrir index.html no navegador."},{"id":"b17a2000-0000-4000-8000-000000001009","number":9,"submoduleId":"b17a2000-0000-4000-8000-000000000004","order":1,"title":"A Anatomia de uma Página","duration":25,"objective":"Criar um documento HTML com doctype, html, head, body, title, charset e lang."},{"id":"b17a2000-0000-4000-8000-000000001010","number":10,"submoduleId":"b17a2000-0000-4000-8000-000000000004","order":2,"title":"Textos que Contam Histórias","duration":25,"objective":"Organizar títulos e parágrafos e usar ênfase semântica."},{"id":"b17a2000-0000-4000-8000-000000001011","number":11,"submoduleId":"b17a2000-0000-4000-8000-000000000004","order":3,"title":"Organizando Informações","duration":25,"objective":"Criar listas ordenadas e não ordenadas e organizar seções."},{"id":"b17a2000-0000-4000-8000-000000001012","number":12,"submoduleId":"b17a2000-0000-4000-8000-000000000004","order":4,"title":"Imagens e Caminhos pela Web","duration":30,"objective":"Inserir imagens acessíveis, links e caminhos relativos funcionais."},{"id":"b17a2000-0000-4000-8000-000000001013","number":13,"submoduleId":"b17a2000-0000-4000-8000-000000000005","order":1,"title":"Planejando Meu Primeiro Site","duration":25,"objective":"Definir tema, público, conteúdo, wireframe e estrutura de arquivos do site."},{"id":"b17a2000-0000-4000-8000-000000001014","number":14,"submoduleId":"b17a2000-0000-4000-8000-000000000005","order":2,"title":"Meu Site Está Pronto para o Mundo","duration":25,"objective":"Revisar HTML, imagens e links; publicar com orientação e apresentar o projeto."}],"plannedEvents":[{"lessonNumber":10,"type":"mini_project"},{"lessonNumber":12,"type":"mini_project"},{"lessonNumber":14,"type":"final_project"},{"lessonNumber":10,"type":"online_lesson"},{"lessonNumber":12,"type":"online_lesson"},{"lessonNumber":13,"type":"online_lesson"},{"lessonNumber":14,"type":"online_lesson"}]}'::jsonb;
begin
 -- Reapplication is a no-op only for a release still matching its manifest.
 if exists(select 1 from private.curriculum_migration_snapshots where key='html-basic-v2') then
  if not exists(select 1 from private.curriculum_releases where module_id=target and current_version=2)
  or (select count(*) from public.lessons where module_id=target)<>15
  or exists(select 1 from jsonb_array_elements(plan->'lessons') e left join public.lessons l on l.id=(e->>'id')::uuid
   where l.id is null or l.title<>e->>'title' or l.submodule_id<>(e->>'submoduleId')::uuid or l.curriculum_number<>(e->>'number')::int)
  then raise exception 'HTML v2 já registrado, mas a estrutura divergiu do manifesto.' using errcode='23514';end if;
  return;
 end if;
 if not exists(select 1 from public.modules where id=target and course_id='6fada12b-4073-40ce-9bfb-e5ecfc2c453d' and title='HTML Básico' and order_index=1 and is_active)
 or not exists(select 1 from public.courses where id='6fada12b-4073-40ce-9bfb-e5ecfc2c453d' and title='HTML' and is_active)
 or (select count(*) from public.submodules where module_id=target)<>3
 or (select count(*) from public.lessons where module_id=target)<>2
 or exists(select 1 from jsonb_array_elements(plan->'existingLessons') e left join public.lessons l on l.id=(e->>'id')::uuid
 where l.id is null or l.title<>e->>'title' or l.module_id<>target or l.submodule_id<>'7ba3b0f4-7078-47df-aaa4-a7ee460b3f3e'::uuid
 or l.order_index<>(e->>'order')::int or l.curriculum_version<>1 or l.publication_status<>'published')
 or exists(select 1 from jsonb_array_elements(plan->'submodules') e left join public.submodules s on s.id=(e->>'id')::uuid
 where e ? 'previousTitle' and (s.id is null or s.module_id<>target or s.title<>e->>'previousTitle' or not s.is_active or s.order_index<>(e->>'order')::int))
 then raise exception 'A grade existente mudou desde a auditoria. Refaça a conferência.' using errcode='23514';end if;

 select jsonb_agg(jsonb_build_object('id',a.id,'row_hash',md5(to_jsonb(a)::text)) order by a.id) into actual
 from public.lesson_activities a join public.lessons l on l.id=a.lesson_id where l.module_id=target;
 if actual is distinct from expected then raise exception 'As atividades existentes mudaram desde a auditoria. Nada foi alterado.' using errcode='23514';end if;
 if exists(select 1 from jsonb_array_elements(plan->'lessons') e join public.lessons l on l.id=(e->>'id')::uuid)
 or exists(select 1 from jsonb_array_elements(plan->'submodules') e join public.submodules s on s.id=(e->>'id')::uuid where not(e ? 'previousTitle'))
 then raise exception 'ID reservado para a nova grade já está em uso.' using errcode='23514';end if;

 insert into private.curriculum_migration_snapshots(key,before_state,activity_hashes)
 select 'html-basic-v2',jsonb_build_object(
 'submodules',(select jsonb_agg(to_jsonb(s)) from public.submodules s where s.module_id=target),
 'lessons',(select jsonb_agg(to_jsonb(l)) from public.lessons l where l.module_id=target)),actual;

 insert into private.curriculum_releases(module_id,current_version,label) values(target,2,'HTML Básico v2.0');
 -- Pin any learner with evidence of having started this module. No student
 -- identity, progress, receipt, achievement or completion timestamp is rewritten.
 insert into private.student_curriculum_cohorts(student_id,module_id,version)
 select p.id,target,1 from public.profiles p where p.role='student' and (
 exists(select 1 from public.student_progress sp join public.lessons l on l.id=sp.lesson_id where sp.student_id=p.id and l.module_id=target)
 or exists(select 1 from public.student_activity_progress sp join public.lesson_activities a on a.id=sp.activity_id join public.lessons l on l.id=a.lesson_id where sp.student_id=p.id and l.module_id=target)
 or exists(select 1 from public.quiz_attempts x join public.lesson_activities a on a.id=x.activity_id join public.lessons l on l.id=a.lesson_id where x.student_id=p.id and l.module_id=target)
 or exists(select 1 from public.activity_attempt_sessions x join public.lesson_activities a on a.id=x.activity_id join public.lessons l on l.id=a.lesson_id where x.student_id=p.id and l.module_id=target)
 or exists(select 1 from public.project_submissions x join public.lesson_activities a on a.id=x.activity_id join public.lessons l on l.id=a.lesson_id where x.student_id=p.id and l.module_id=target)
 or exists(select 1 from public.lesson_plan_sessions x join public.scheduled_lessons meeting on meeting.id=x.scheduled_lesson_id join public.lesson_activities a on a.id=x.activity_id join public.lessons l on l.id=a.lesson_id where meeting.student_id=p.id and l.module_id=target)
 or exists(select 1 from public.module_evaluations e where e.student_id=p.id and e.module_id=target)
 or exists(select 1 from public.student_xp_events x where x.student_id=p.id and x.source_id in(
 select target union select l.id from public.lessons l where l.module_id=target
 union select a.id from public.lesson_activities a join public.lessons l on l.id=a.lesson_id where l.module_id=target))
 );

 for source in select value as e from jsonb_array_elements(plan->'submodules') loop
  if source.e ? 'previousTitle' then
   update public.submodules set title=source.e->>'title',description=source.e->>'description'
   where id=(source.e->>'id')::uuid;
  else
   insert into public.submodules(id,module_id,title,description,order_index,is_active)
   values((source.e->>'id')::uuid,target,source.e->>'title',source.e->>'description',(source.e->>'order')::int,true);
  end if;
 end loop;
 for source in select value as e from jsonb_array_elements(plan->'existingLessons') loop
  update public.lessons set curriculum_number=(source.e->>'number')::int where id=(source.e->>'id')::uuid;
 end loop;
 for source in select value as e from jsonb_array_elements(plan->'lessons') loop
  insert into public.lessons(id,module_id,submodule_id,title,description,order_index,duration_minutes,curriculum_version,curriculum_number,publication_status)
  values((source.e->>'id')::uuid,target,(source.e->>'submoduleId')::uuid,source.e->>'title',source.e->>'objective',
   (source.e->>'order')::int,(source.e->>'duration')::int,2,(source.e->>'number')::int,'planned');
  insert into public.lesson_learning_metadata(lesson_id,schema_version,objectives)
  values((source.e->>'id')::uuid,1,array[source.e->>'objective']);
 end loop;
 if (select jsonb_agg(jsonb_build_object('id',a.id,'row_hash',md5(to_jsonb(a)::text)) order by a.id)
 from public.lesson_activities a join public.lessons l on l.id=a.lesson_id where l.module_id=target) is distinct from actual
 then raise exception 'Conteúdo existente sofreu alteração inesperada.';end if;
end $release$;
notify pgrst,'reload schema';
commit;
