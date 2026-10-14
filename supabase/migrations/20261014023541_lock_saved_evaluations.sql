-- Evaluations are inserted only after teacher review and cannot be edited afterward.
revoke update on public.module_evaluations from authenticated, anon;
drop policy if exists "Professores podem atualizar avaliações" on public.module_evaluations;
