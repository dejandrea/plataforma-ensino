# Ambiente de aprendizagem — Etapa A

Evolução posterior: [Etapa B — aprendizagem do aluno](ambiente-aprendizagem-etapa-b.md).
Este documento registra as decisões e os resultados da execução da fundação.

Implementação de `docs/prompts/fase1.md`, limitada à fundação. Nenhuma interface,
rota, agendamento, avaliação existente, credencial ou dado de produção foi alterado.
A migration foi criada pelo CLI e executada apenas no PostgreSQL em memória dos testes.

## Análise do repositório e decisões

- React 19, TypeScript, Vite, Tailwind, React Router e Supabase. O cliente atual
  não possui tipos de banco gerados; os novos tipos são contratos explícitos,
  sem alegar que foram gerados a partir do banco real.
- `TabContent.tsx` já organiza `courses → modules → submodules → lessons`.
  A migration de submódulos torna `lessons.submodule_id` obrigatório; o vínculo
  antigo `lessons.module_id` não é usado como fonte para as novas entidades.
- `LessonView.tsx` lê materiais e conclui aulas com upsert em `student_progress`.
  `Dashboard.tsx` consulta esse histórico. A RPC `student_curriculum_status`,
  consumida em `studentCourses.ts`, libera módulos sequencialmente e considera
  cursos ativos, submódulos ativos e alunos ativos com escopo `course`/`both`.
  As novas atividades respeitam essa RPC em suas políticas de leitura.
- Não há matrícula por curso nesse mecanismo: o acesso existente depende do
  escopo do perfil e da progressão. Esta etapa não inventa matrículas nem muda
  regras comerciais. A ordem das atividades é apenas apresentação.
- `scheduled_lessons` armazena professora, aluno, horários, status e link Meet.
  `StudentLessons.tsx` usa os agendamentos; `LessonRoom.tsx` usa a mesma entidade,
  controla abertura do Meet e encerramento administrativo. `lesson_plan_sessions`
  referencia o agendamento e o plano: aluno, professora, aula curricular e Meet
  são obtidos por joins, sem copiar seus dados. Sessões exigem encontro `course`
  com aluno vinculado à professora responsável; o mesmo plano pode ser usado
  em vários agendamentos, inclusive para retomar etapas em outro encontro.
- `AdminEvaluations`, `EvaluationForm` e `module_evaluations` representam
  avaliações de matéria concluída ou mentoria mensal, com bloqueio de edição.
  Não servem para avaliar uma única execução: os registros pedagógicos locais
  ficam em `lesson_plan_sessions.evaluation_json`, sem gerar avaliação acadêmica.
- Futuras interfaces podem reutilizar `LessonView`, `LessonRoom`, `LessonCard`,
  `BackLink`, navegação, `tokens.css` e as superfícies/cores existentes.
- As primeiras tabelas do projeto não têm migrations de criação no histórico
  disponível. Não foi realizado introspection de produção. Os testes usam uma
  fixture estrutural explícita e a migration real de progressão de 06/10/2026;
  validar divergências do schema real em homologação antes de implantar.

## Modelo e integridade

| Entidade nova | Responsabilidade |
| --- | --- |
| `lesson_learning_metadata` | Objetivos versionados da aula; demais dados continuam em `lessons` |
| `lesson_activities` | Conteúdo público por atividade, ordem, obrigatoriedade, duração, revisão, rascunho/publicação |
| `activity_prerequisites` | Dependências explícitas na mesma aula, sem ciclos; não há bloqueio por posição |
| `activity_quiz_keys` | Gabarito e feedback de correção, acessíveis apenas à equipe pedagógica |
| `teacher_lesson_plans` | Planos imutáveis, com revisão incremental por atividade online |
| `student_activity_progress` | Estado individual, independente de `student_progress` |
| `quiz_attempts` | Respostas, pontuação 0–100, resultado, número da tentativa e revisão da atividade |
| `project_submissions` | Link HTTPS, reflexão e versão da entrega; reenvio cria nova linha |
| `project_submission_reviews` | Correções sucessivas com autora, data, status, feedback e avaliação compartilhável |
| `lesson_plan_sessions` | Etapas concluídas, notas privadas e avaliação pedagógica por encontro/plano |

FKs compostas impedem vincular gabarito a slides, projeto a quiz ou sessão a plano
de outra atividade/revisão. Há índices para consultas e FKs, unicidade de chaves
por aula, de tentativa/versão por aluno/atividade e de sessão por encontro/atividade.

Uma atividade publicada não pode ter conteúdo, identidade, ordem ou obrigatoriedade
reescritos, mesmo após despublicação. Pode ser desativada/despublicada; uma alteração
pedagógica exige outra atividade com nova `key` e revisão. Gabaritos publicados e
pré-requisitos publicados também ficam protegidos. Planos, tentativas, entregas e
correções não permitem UPDATE/DELETE, inclusive pelo backend: grava-se nova versão.
Atividades com histórico não podem ser excluídas. Não há atualização automática de
históricos para um conteúdo novo. A publicação de quiz exige gabarito consistente;
a publicação de encontro exige um plano. Isso evita publicar conteúdo incompleto.

Progresso: `not_started`, `in_progress`, `pending_review`, `completed`,
`needs_revision`. `completed` exige data de conclusão e início coerentes.
Uma entrega recém-criada está implicitamente `submitted`; seu estado corrente vem
da última correção, ordenada por `created_at, id`. A tabela de correções aceita
`in_review`, `needs_revision`, `approved`; todas as correções anteriores permanecem.
Feedback e `evaluation_json` de uma correção são compartilháveis com o aluno;
notas internas devem ficar no registro privado do encontro, nunca nessa tabela.

## Permissões e limites desta etapa

Todas as dez tabelas têm RLS e grants explícitos. `anon` não recebe acesso.

| Papel ativo | Conteúdo | Gabaritos e planos | Registros individuais | Sessões privadas |
| --- | --- | --- | --- | --- |
| Administrador | Gerencia atividades/metadados/pré-requisitos/gabaritos; adiciona planos | Lê | Lê | Lê/cria/atualiza para alunos ativos |
| Professora | Lê, inclusive rascunhos | Lê material pedagógico reutilizável | Lê apenas alunos vinculados | Lê/cria/atualiza apenas seus encontros de alunos vinculados |
| Aluno | Lê atividades ativas/publicadas em módulos liberados e respectivos objetivos | Sem acesso | Lê somente seus dados e feedbacks | Sem acesso |

Os auxiliares `SECURITY DEFINER` ficam em `private`, com `search_path=''`, sem
EXECUTE público, identificando o chamador por `auth.uid()` e perfil ativo.
As funções de validação e triggers têm privilégios mínimos. Uma proteção adicional
em `profiles` impede que o UPDATE do próprio perfil altere `role`, `is_active` ou
`student_service_scope`. Operações de backend e RPCs privilegiadas existentes
continuam responsáveis por autorizar alterações administrativas e convites.

Nesta etapa **ninguém no cliente grava progresso, tentativas, entregas ou correções**.
Somente o backend com credencial de serviço pode inserir esses registros. Isso é
deliberado: ainda não existem os serviços autenticados de submissão/correção.
Os campos de resultado não podem ser enviados diretamente pelo aluno. Não foi
criada uma RPC genérica para alterar status, nem uma função de correção incompleta.

Os triggers limitam a estrutura pública do JSON, em especial impedindo propriedades
extras em perguntas/alternativas. A validação completa do contrato é feita em runtime
com Ajv e validações semânticas, antes de qualquer futura importação. Só administradores
gravam conteúdo, e devem continuar revisando o texto antes de publicar.

Não há Storage nem uploads nesta etapa; os recursos usam HTTPS externo. Não há
políticas de Storage a alterar, cópia de links Meet para JSON ou execução de HTML.

## Arquivos e validação

- `supabase/migrations/20261021034654_learning_environment_foundation.sql`: modelo, grants, RLS e triggers.
- `supabase/rollbacks/learning_environment_foundation.sql`: reversão manual, transacional e destrutiva; sem `CASCADE`.
- `src/types/learning.ts`: conteúdo, planos e linhas das dez tabelas.
- `src/contracts/learning-content.v1.schema.json`: JSON Schema Draft 7 oficial.
- `src/lib/learningContent.ts`: validação estrutural/semântica e projeção pública.
- `docs/contrato-conteudo-v1.md`: regras de autoria e mapeamento de persistência.
- `docs/examples/html-conhecendo.v1.json` e `html-primeira-pagina.v1.json`: exemplo HTML, por aula.
- `tests/learning-content.test.mjs`: contrato, referências, URLs e remoção dos dados privados.
- `tests/learning-foundation.test.mjs` e `tests/fixtures/learning-baseline.sql`: migration,
  RLS com papéis reais, integridade, rollback/reaplicação e regressão da progressão.
- `package.json`/lock: Ajv 6.14.0, já usado transitivamente no projeto, agora direto;
  PGlite 0.3.14 somente para testes; script `test:learning`.
- `tsconfig.app.json`: importação do schema JSON habilitada.

Executar `npm ci`, `npm run test:learning` e `npm run build`. Os testes não leem
`.env`, não acessam Supabase remoto e descartam o banco em memória. PGlite testa
SQL/PLpgSQL/RLS, mas não substitui homologação do PostgREST/Auth, concorrência em
conexões independentes e revisão dos grants/policies reais de produção.

Resultados desta execução: **35 testes da fundação passaram**, incluindo reversão e
reaplicação; build TypeScript/Vite e ESLint dos arquivos novos passaram. Na suíte
completa, **71 de 73 testes passaram**. As duas falhas são em
`tests/lesson-history-status.test.mjs`: o mock não fornece `student_id`, exigido pela
Edge Function existente ao concluir uma aula. Esses arquivos não foram alterados
nesta etapa. O build mantém avisos de bundle grande e base Browserslist antiga.

## Implantação e reversão

1. Revisar diferenças entre o schema real e as migrations, especialmente tabelas
   iniciais, políticas de perfil e RPCs administrativas; provisionar homologação.
2. Após autorização, executar a migration em homologação, testar com sessões reais
   dos três papéis e executar os advisors de segurança do Supabase.
3. Confirmar que `private` não está entre os schemas expostos e que a credencial de
   serviço continua exclusivamente no backend. Revisar dependências pendentes no
   histórico local; não executar um `db push` indiscriminado.
4. Publicação em produção depende de autorização explícita, backup e janela de mudança.
   Os exemplos são arquivos de autoria, não seeds executados na migration.
5. Para reverter em ambiente autorizado, revisar e executar o arquivo em `rollbacks`
   **somente após backup**: ele apaga o conteúdo e histórico novos. Sem `CASCADE`,
   dependências de etapas futuras impedem a reversão em vez de serem removidas.
   Não apaga o schema compartilhado `private` nem mexe em `student_progress`.

## Próxima etapa — B

Criar lista/renderizadores de atividades em `LessonView`, progresso e estados.
Antes de habilitar ações do aluno, implementar operações autenticadas e transacionais
de estudo e quiz: derivar o aluno da sessão, validar publicação/liberação e
pré-requisitos, serializar número/limite de tentativas, corrigir usando gabarito
privado, retornar feedback só após submissão e persistir o resultado no servidor.
Abrir um recurso não comprova conclusão; slides/mapas exigem confirmação de estudo.

Integrar atividades obrigatórias à conclusão da aula no backend, fechando o upsert
direto de `student_progress` para aulas com atividades e preservando a compatibilidade
das aulas antigas. Só então recalcular conclusão curricular/XP usando o fluxo existente.
Esta etapa A não muda a semântica do botão atual nem conclui aulas automaticamente.

Etapas posteriores: C conecta roteiro/autosalvamento/avaliação à sala existente;
D adiciona envio, revisão, reenvio e aprovação com autorização e histórico;
E cria importação atômica, pré-visualização e publicação administrativas. Manter
status administrativo do encontro, execução do plano, avaliação e aprendizagem separados.
