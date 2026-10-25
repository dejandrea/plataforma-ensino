# Central de Acompanhamento Pedagógico

## Auditoria inicial

- Navegação: `StaffNavbar` atende administradores e professoras; `App.tsx` controla papéis e atividade do perfil. `TeacherDashboard` lista alunos vinculados, mas não reúne progresso curricular.
- Escopo: `private.learning_role()` valida conta ativa; `private.learning_manages_student()` autoriza administrador ou professora vinculada em `teacher_student_relations`. A central reutiliza ambas. Não há vínculo independente professora–curso nem cadastro de turma no modelo de aprendizagem.
- Currículo: cursos → módulos → submódulos → aulas → `lesson_activities`. A fonte oficial é `student_curriculum_status(student_id)`: acesso por `student_service_scope` (`course`/`both`), cursos/módulos/submódulos ativos, conclusão em `student_progress` e desbloqueio por módulos anteriores. `student_courses` existe como cadastro histórico, mas não governa o acesso na RPC oficial; a central não muda essa regra nem inventa matrículas.
- Atividades: `student_activity_progress` por aluno/atividade/revisão; pré-requisitos em `activity_prerequisites`; tentativas em `quiz_attempts`, sem necessidade de ler `activity_quiz_keys`. Publicações antigas e conclusões acadêmicas são preservadas.
- Projetos: `project_submissions`, `project_submission_reviews`; Etapa D e melhorias posteriores já oferecem `teacher_student_projects`, `teacher_project_inbox` e `review_student_project`. A última RPC é idempotente por avaliadora/request_id, exige vínculo e versão vigente, valida nota e preserva cada revisão. O componente `ProjectReviewPanel` já contém o formulário reutilizável.
- XP: ledger existente `student_xp_events`. Crédito de envio e de avaliação são independentes. Reavaliações ajustam o mesmo crédito via mecanismo oficial e deixam histórico em `xp_event_audit`. A central somente consulta o ledger e envia nota/situação/feedback à RPC existente; não calcula nem recebe pontos do cliente.
- Inspeção de produção foi somente de metadados de tabelas/colunas. Desenvolvimento e homologação usam banco isolado; nenhuma migration desta central foi aplicada em produção.

## Implementação

- Entrada no menu de administradores e professoras: **Acompanhamento Pedagógico**, rota `/acompanhamento-pedagogico`. A jornada individual fica em `/acompanhamento-pedagogico/alunos/:studentId`.
- Visão geral com cinco indicadores, busca por aluno, filtros por curso/professora/status/período e paginação. Cada linha representa aluno e curso; alunos sem acesso curricular aparecem sem curso. “Cursos concluídos” conta jornadas concluídas, não pessoas distintas.
- Jornada expansível por curso, módulo, submódulo, aula e atividade. Exibe conclusão oficial, atividades obrigatórias, bloqueio, revisão, datas, XP e tentativas de quiz. As atividades são buscadas ao abrir a aula; o histórico de tentativas também é carregado sob demanda.
- Projetos com filtros de situação, entregas atuais, links, versões anteriores, nota de 0 a 100, feedback e histórico. O formulário exportado de `ProjectReviewPanel` continua usando `review_student_project`; não há uma segunda regra de avaliação ou concessão de XP.
- Implementação em `src/pages/PedagogicalMonitoring.tsx`, `src/components/pedagogy/`, `src/types/pedagogy.ts` e `src/lib/pedagogy.ts`. O hook de consulta descarta respostas atrasadas e oculta resultados de filtros anteriores durante a atualização.

## Banco e segurança

Migration: `supabase/migrations/20261025054636_pedagogical_monitoring_center.sql`. Rollback: `supabase/rollbacks/pedagogical_monitoring_center.sql`.

As seis RPCs públicas de leitura são:

| RPC | Finalidade |
| --- | --- |
| `pedagogy_dashboard` | Indicadores, opções de filtro e jornadas paginadas; busca, curso, professora, status e período |
| `pedagogy_student_journey` | Aluno e currículo oficial do curso selecionado |
| `pedagogy_lesson_detail` | Atividades publicadas da aula, paginadas |
| `pedagogy_activity_attempts` | Histórico paginado de resultados de quiz |
| `pedagogy_projects` | Entregas atuais paginadas, filtradas por aluno/curso/professora/situação |
| `pedagogy_project_detail` | Uma entrega atual com dados do fluxo de avaliação existente |

Os wrappers públicos são invoker e chamam leitores privados estáveis com `search_path` vazio. O backend exige perfil ativo de administração/professora e valida o vínculo com cada aluno. Filtros não ampliam esse escopo. Alunos, contas inativas e usuários anônimos não podem consultar a central. DTOs de acompanhamento não retornam gabaritos nem respostas de quiz. Leituras não alteram progresso, avaliações ou XP.

A interface pagina jornadas/projetos em 10, atividades em 20 e tentativas em 10. O backend limita páginas a 50 itens. O período padrão é de 30 dias; datas da interface usam America/Bahia e o intervalo final é exclusivo do dia seguinte. A contagem de atividades usa o estado de conclusão vigente, não um log histórico de todas as revisões.

XP exibido por curso vem dos eventos existentes relacionados ao currículo; créditos globais de boas-vindas/mentoria não são atribuídos a cursos. Conclusões antigas registradas em `student_progress` continuam válidas, inclusive quando há atividades opcionais incompletas.

Não há filtro de turma porque o modelo atual não possui esse cadastro. A árvore estrutural carrega um curso por vez; cursos excepcionalmente grandes podem exigir paginação adicional dessa estrutura. O detalhe de projeto reaproveita `teacher_student_projects`, que internamente monta o histórico dos projetos daquele aluno antes de selecionar a entrega solicitada; esse histórico não tem paginação própria.

## Verificação local

- Banco isolado: 32 testes aprovados, incluindo a central e regressões de projetos, XP oficial e acompanhamento docente. Cobrem escopo, acesso direto, ausência de gabaritos, paginação, conclusão oficial, leituras sem efeitos, reavaliação, idempotência, reenvio, migration e rollback.
- Navegador: três cenários aprovados (o de avaliação foi repetido após corrigir a atualização dos filtros). Cobrem visão geral, paginação, busca, jornada, tentativas, avaliação/reavaliação de mini-projeto e projeto final, recuperação de erro, estado vazio e bloqueio de acesso fora do escopo. Durante a atualização das opções, o formulário de filtros fica desabilitado para impedir que uma seleção seja perdida no recarregamento.
- Build de produção e ESLint dos componentes novos e formulário reutilizado aprovados. O build mantém os avisos de tamanho dos bundles existentes.
- Capturas com dados fictícios em `test-results/pedagogy-{overview,journey,review}-{desktop,mobile}.png`, inspecionadas em desktop e celular. O diretório de evidências é ignorado pelo Git.

## Homologação em ambiente conectado

A migration desta central foi aplicada em produção em **25/10/2026**, no projeto `gnyiyhnbpjhdgrhsevbh`, após autorização explícita do usuário. Como há divergências históricas entre o checkout e o remoto, foi executado somente o arquivo desta migration via `supabase db query --linked --file`, e somente a versão `20261025054636` foi registrada como aplicada com `migration repair`. O arquivo também notifica a atualização do cache do PostgREST.

Verificação após aplicação: 16 funções criadas, seis wrappers públicos, todas estáveis e sem permissão de execução anônima. `pedagogy_dashboard` e `pedagogy_projects` responderam com objetos JSON sob papel `authenticated` e contexto de administrador, em transação revertida. O advisor de segurança não apontou as funções novas; os avisos anteriores de outros objetos permanecem fora desta alteração.

Após aplicar em ambiente autorizado:

1. Entrar como administrador e professora; confirmar menu, filtros e paginação.
2. Conferir um aluno vinculado e tentar acessar diretamente um aluno não vinculado como professora.
3. Comparar uma jornada com o progresso oficial do aluno, inclusive conclusões antigas e atividades opcionais.
4. Avaliar uma entrega de teste, alterar a nota e conferir o histórico e o ajuste do crédito existente sem duplicação do XP de envio.
5. Abrir a central como aluno e confirmar bloqueio; conferir desktop e celular.

O rollback remove somente as funções novas da central, preservando dados, avaliações, regras oficiais e funções anteriores. A interface deve ser retirada junto com o rollback para evitar chamadas a RPCs removidas.
