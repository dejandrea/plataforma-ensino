drop policy if exists teacher_student_relations_teacher_select on public.teacher_student_relations;
create policy teacher_student_relations_teacher_select
  on public.teacher_student_relations
  for select
  to authenticated
  using (teacher_id = auth.uid());

drop policy if exists teacher_student_relations_student_select on public.teacher_student_relations;
create policy teacher_student_relations_student_select
  on public.teacher_student_relations
  for select
  to authenticated
  using (student_id = auth.uid());

drop policy if exists teacher_student_relations_teacher_delete on public.teacher_student_relations;
create policy teacher_student_relations_teacher_delete
  on public.teacher_student_relations
  for delete
  to authenticated
  using (teacher_id = auth.uid());
