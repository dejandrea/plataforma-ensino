# Etapa B1 — práticas interativas e integração de recompensas

Implementação local da especificação [fase 1 — ETAPA B.1](prompts/fase%201%20-%20ETAPA%20B.1.md). Esta entrega sucede A/B e antecede C. Não aplica migrations nem publica código em produção.

## Resultado e arquitetura

Quiz agora apresenta alternativas embaralhadas por tentativa. Ordenação e associação têm conteúdo v2, correção no banco, histórico, limites, aprovação e integração com progresso. A aula pode ser inteiramente autônoma. Os componentes compartilham o ciclo de tentativa; a ordenação usa botões acessíveis e a associação usa seletores nativos.

Foi acrescentada apenas uma tabela de estado estudantil, `activity_attempt_sessions`, para reservar e persistir a apresentação antes do envio. As respostas continuam em `quiz_attempts`; progresso continua em `student_activity_progress`. Gabaritos permanecem separados em `activity_quiz_keys`, protegidos por RLS. O aluno lê apenas sessões próprias autorizadas e não escreve diretamente em tentativas, sessões, resultados ou recompensas. RPCs verificam identidade, vínculo, publicação e pré-requisitos; o bloqueio do perfil mantém a ordem de serialização usada na B.

Uma sessão pendente conserva a ordem após recarregar. O UUID identifica submissões idempotentes; a próxima tentativa permitida recebe nova apresentação. O conteúdo original não é alterado. Respostas ainda não enviadas são um rascunho local por aluno/sessão; dependem do armazenamento do navegador e não atravessam dispositivos. As notas são calculadas pelos IDs originais, nunca pela posição exibida.

O importador administrativo aceita v1/v2, valida no frontend e no banco, mostra uma prévia sem gabaritos e permite rascunho/publicação. Adiciona atividades a uma aula existente, com correspondência exata dos títulos da hierarquia; atualiza descrição, duração e objetivos, mas não cria cursos nem sobrescreve atividades. Publicação e importação são atômicas.

## XP, níveis e conquistas

A implementação reutiliza `xp_reward_rules`, `student_xp_events`, `achievement_definitions`, `student_achievements` e o catálogo atual de níveis. Não cria saldo paralelo, altera limiares ou muda os valores das regras existentes. As seis regras `activity_*` e `submodule_completion` iniciam em zero para permitir configuração deliberada antes de premiar alunos.

Uma recompensa elegível gera recibo único e imutável, incluindo os pontos e o contexto usados. Novas configurações não recalculam o passado. Os recálculos existentes de XP e maestrias preservam os recibos e conquistas personalizados da B1. Maestrias por tecnologia continuam seguindo o modelo de missões existente. A interface reutiliza o cartão de nível e informa discretamente novos pontos/conquistas.

Quiz e prática premiam aprovação; projeto e projeto final premiam a avaliação aprovada da versão vigente; aula ao vivo depende de confirmação protegida. A B1 fornece essas garantias no backend, mas as telas docentes de confirmação e avaliação continuam nas etapas C/D. O marco de submódulo é opcional, sem retroatividade para conclusões anteriores.

## Arquivos da B1

| Área | Arquivos |
|---|---|
| Banco | `supabase/migrations/20261021180915_interactive_learning_and_rewards.sql`; `supabase/rollbacks/interactive_learning_and_rewards.sql` |
| Contrato e domínio | `src/contracts/learning-content.v2.schema.json`; `src/types/learning.ts`; `src/lib/learningContent.ts`; `src/lib/assessmentDraft.ts`; `src/lib/studentLearning.ts`; `src/lib/xp.ts` |
| Experiência do aluno | `src/components/learning/QuizActivity.tsx`; `InteractiveActivity.tsx`; `AssessmentFeedback.tsx`; `useAssessmentAttempt.ts`; `ActivityRenderer.tsx`; `LessonActivityList.tsx`; `src/pages/LessonView.tsx` |
| Importação | `src/components/learning/LessonContentImporter.tsx`; `src/components/management/TabContent.tsx` |
| Exemplo e documentação | `docs/examples/maquinas-interativas.v2.json`; `docs/contrato-conteudo-v2.md`; `docs/guia-producao-atividades-interativas.md`; este relatório; links nos documentos B/v1 |
| Testes | `tests/interactive-learning.test.mjs`; `tests/interactive-contract.test.mjs`; `tests/interactive-browser.test.mjs`; ajustes em `tests/learning-browser.test.mjs`, `tests/learning-content.test.mjs`, `tests/fixtures/learning-test-db.mjs`, `learning-browser-entry.tsx`; novos `tests/fixtures/learning-browser-harness.mjs` e `interactive-content.mjs`; scripts em `package.json` |

Os demais arquivos já modificados no workspace pertencem às entregas anteriores ou a alterações locais preexistentes; não foram descartados.

## Validação

Os testes de contrato cobrem versões 1/2, projeção pública, chaves, bijeções, referências, ciclos e combinações de recompensa, tanto no frontend quanto no banco. Os testes PostgreSQL locais usam PGlite com as migrations reais, identidades sintéticas e papéis com RLS. Cobrem isolamento, correção, limite de tentativas, reenvio idempotente, preservação da apresentação, progresso, XP, conquistas, projetos, confirmação protegida, importação e rollback.

Os testes de navegador usam a interface React real e RPCs executadas nesse banco local por um adaptador. Cobrem importação/publicação, teclado, rascunhos e ordem após recarregar, erro/reenvio, novos sorteios, aprovação, recompensas e telas desktop/mobile. Não acessam Supabase remoto. Esse ambiente não substitui uma homologação com Auth/PostgREST reais nem comprova concorrência entre conexões independentes; os testes concorrentes locais compartilham a conexão do harness.

Resultados finais locais em 21/10/2026:

| Verificação | Resultado |
|---|---|
| Todos os testes `.test.mjs` sem navegador, com `node --test --experimental-test-isolation=none` | 126 aprovados de 128; duas falhas preexistentes |
| `npm run test:learning:browser` | 2/2 aprovados, sem erros JavaScript; desktop e mobile revisados visualmente |
| `npm run build` | Aprovado, incluindo TypeScript; avisos de tamanho de bundle e base Browserslist antiga |
| ESLint em `src/components/learning`, `LessonView.tsx`, bibliotecas B1 e tipos | Aprovado |
| `git diff --check` | Aprovado |

As duas falhas gerais estão em `tests/lesson-history-status.test.mjs`, nos cenários de correção pelo professor e pelo administrador. Os mocks omitem `student_id`, que o handler existente exige, resultando em HTTP 400 em vez de 200. São externas à B1 e já haviam sido observadas antes desta entrega. Todos os novos testes de contrato, banco e navegador passaram. Não foi declarado lint global do repositório; a validação foi direcionada aos arquivos de aprendizagem alterados.

## Aplicação e reversão

Antes da B1, o ambiente precisa das migrations existentes de XP, níveis/maestrias e catálogo, além de A e B. A ordem cronológica dos arquivos atende a essa dependência. Revisar e homologar o SQL, configurar as novas regras centrais e aplicar o backend antes de disponibilizar o frontend correspondente. A aplicação em produção continua dependendo de autorização explícita do responsável.

O rollback é testado em banco vazio da B1 e restaura as funções anteriores. Ele recusa execução quando já existem sessões, conteúdo/configuração B1 ou recompensas que seriam perdidas, e quando novas regras já receberam valores. Depois do início de uso, a reversão exige um plano explícito de preservação/migração dos dados; não se deve remover o guard para forçar rollback.

## Próxima etapa

A implementação local seguinte está documentada em [Etapa C — encontros online](ambiente-aprendizagem-etapa-c.md).

A etapa C deve implementar a experiência docente de aula: plano restrito, execução dos passos, anotações, avaliação pedagógica e confirmação protegida, usando as estruturas existentes. A etapa D deve completar submissão/revisão de projetos e a experiência de devolutiva. `fill_blank`, `identify` e `prediction`, editor visual, IA, execução de código e geração de PDF não foram implementados nesta B1.
