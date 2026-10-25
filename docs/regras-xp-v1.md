# Regras oficiais de XP v1

Implementação de `docs/prompts/regras XP.md`, executada primeiro em PostgreSQL temporário (PGlite), sem aplicação remota.

## Regras

| Ação | XP |
|---|---:|
| Confirmar estudo de slides | 10 por atividade |
| Concluir vídeo do Drive | 10 por atividade |
| Confirmar estudo de mapa mental | 10 por atividade |
| Primeira tentativa enviada do questionário | Percentual de acerto arredondado para inteiro (0–100) |
| Envio válido de miniprojeto | 50, uma vez por aluno/atividade |
| Envio válido de projeto | 100, uma vez por aluno/atividade |
| Nota de miniprojeto ou projeto | Nota atual arredondada para inteiro (0–100), em crédito separado |
| Concluir ordering/matching | 15 por atividade aprovada |
| Confirmar atividade online pela professora | 15 por atividade |
| Concluir aula curricular | 50, uma vez por aluno/aula, inclusive na última aula do curso |

O arredondamento usa `round(numeric)` do PostgreSQL: nota 65,50 gera 66 XP. A pontuação do quiz é calculada pelo gabarito no servidor, armazenada com duas casas e arredondada para o crédito inteiro. O navegador não calcula XP.

Uma primeira tentativa com 25% concede 25 XP mesmo sem aprovação. Uma segunda tentativa pode aprovar a atividade, sem alterar o crédito. A primeira tentativa de 0% cria um recibo de zero pontos. Sessões abertas sem envio e respostas inválidas não consomem essa recompensa.

As conquistas personalizadas de conclusão continuam exigindo aprovação. Uma tentativa reprovada pode conceder XP sem liberar essa medalha; a aprovação posterior libera a medalha, sem outro crédito de quiz.

As regras extras existentes (boas-vindas, encontro administrativo, módulo, curso, avaliações acadêmicas e missões) permanecem independentes. A última aula concede 50 XP e pode habilitar os bônus existentes de módulo/curso. Os níveis e seus limiares não foram alterados.

## Arquitetura e alterações

Já existiam saldo central em `profiles.xp_points`, regras em `xp_reward_rules`, recibos únicos em `student_xp_events`, proteção do saldo, correção segura de quizzes, progressão curricular e integração com níveis/maestrias.

Foi necessário substituir o prêmio fixo do quiz aprovado pelo crédito da primeira tentativa, fixar os valores oficiais, separar envio e nota de projetos, permitir ajustes auditados de nota, exigir quatro perguntas para novas definições e disponibilizar envio/avaliação na interface.

`student_xp_events` continua sendo a única fonte do saldo. Estudos, práticas e quizzes reutilizam `learning_activity`; envio e nota usam os tipos internos `project_submission` e `project_evaluation`, com origem na atividade e unicidade por aluno/tipo/origem. São tipos internos, não novas chaves do JSON. O crédito da nota é atualizado, enquanto cada correção fica em uma nova linha de `project_submission_reviews`. `xp_event_audit` preserva pontos anteriores/atuais, origem, autora, horário e referência da avaliação. Seu histórico é imutável, com RLS para o próprio aluno ou administrador ativo.

## Contrato e classificação

Atividades `video` do contrato v2 usam a regra oficial `activity_study`: **10 XP** pela conclusão manual, uma única vez por aluno e atividade. Reabrir, assistir novamente, recarregar ou repetir a confirmação não gera outro recibo. `complete_student_study` recebe somente o ID da atividade; o backend verifica acesso, publicação e pré-requisitos e determina os pontos. A inclusão de vídeo não recalcula créditos existentes. Veja [atividade de vídeo](atividade-video.md).

Não há mudança de versão ou campos numéricos de XP no JSON v2. O Work continua enviando `rewardRuleKey`, `awardOn` e `achievementKeys`.

| Metadado autorizado | Classificação no backend |
|---|---|
| `activity_project` | Miniprojeto |
| `activity_final_project` | Projeto, incluindo projeto final |
| Projeto v1 sem gamification | Miniprojeto, por compatibilidade |

Os metadados são importados apenas por administrador e ficam imutáveis após publicação. Títulos e textos não determinam a classe. Para projetos, `awardOn: approved` continua aceito como intenção de conclusão curricular: a política central determina os créditos separados de envio/nota, sem inventar novas chaves do contrato.

Os schemas de autoria v1/v2 e suas cópias no banco exigem 4–100 perguntas. Exemplos oficiais foram atualizados. Testes das migrations anteriores usam cópias congeladas em `tests/fixtures/legacy-content` para preservar a cobertura histórica.

## Fluxos e segurança

O aluno envia link HTTPS e reflexão na atividade de projeto. O envio não conclui o currículo. Só é permitido reenviar após solicitação de ajustes; chamadas idempotentes retornam a mesma entrega e reenvios não duplicam XP.

A sala de curso da professora apresenta os projetos do aluno. A avaliação registra situação, devolutiva e nota entre 0 e 100, com até duas casas. Aprovar exige nota. Uma solicitação de ajustes pode ter nota e receber XP sem aprovar o currículo. Registro sem nota preserva o crédito anterior; uma nota menor reduz apenas o crédito da avaliação. A aprovação reutiliza o progresso existente para liberar avanço. Uma revisão posterior não apaga conclusões acadêmicas já registradas em `student_progress`.

RPCs: `submit_student_project(activity_id, submission_url, student_notes, request_id)`, `review_student_project(submission_id, status, grade, feedback, request_id)` e `teacher_project_inbox(scheduled_lesson_id)`. Aluno e autora são derivados no servidor. Só administradores ativos ou professoras ativas vinculadas ao aluno podem avaliar. A lista da sala também exige responsabilidade pelo encontro. Não se avalia versão anterior após reenvio.

## Migration e implantação

Migration criada pelo CLI: `supabase/migrations/20261022042042_official_xp_rules_v1.sql`, posterior a A/B/B1/C. Adiciona política privada, flags/fórmulas nas regras existentes, nota e identificadores idempotentes nas entregas/correções, auditoria, índices, RLS e proteção de recibos. As funções usam `SECURITY DEFINER`, `search_path=''`, autorização explícita e grants mínimos. Clientes não escrevem diretamente em saldo, recibos, notas ou auditoria. Valores oficiais ficam protegidos inclusive contra edição pela administração da aplicação; outros bônus continuam configuráveis.

A mudança é prospectiva: saldos e recibos anteriores não são recalculados. Uma tentativa enviada antes da política não recebe XP por tentativa posterior. Um projeto com recibo legado de aprovação não acumula os novos créditos. Uma entrega histórica sem prêmio de envio não recebe esse prêmio por um reenvio; novas notas podem gerar o crédito de avaliação se não houver prêmio legado.

Questionários curtos já publicados continuam utilizáveis com seu histórico. Novas definições, importações e publicação de rascunhos curtos são rejeitadas. Para atualizar um questionário publicado, criar atividade revisada com nova chave e ao menos quatro perguntas.

Revisar e aplicar o backend em homologação autorizada antes de disponibilizar o frontend. Produção não foi acessada. O rollback manual `supabase/rollbacks/official_xp_rules_v1.sql` restaura valores anteriores e o mínimo antigo dos schemas somente antes do uso: recusa execução se houver créditos auditados ou novas entregas/correções.

## Verificação

Cobertura: slides/mapa; quizzes 0/25/60/80/100 e nota fracionária; quatro perguntas; duplicidade/tentativas; ordering/matching; confirmação online; ambos os tipos de projeto; notas e revisões; permissões; auditoria/saldo; avanço/última aula; legado e rollback/reaplicação. O navegador testa os formulários reais e o crédito da primeira tentativa sem aprovação.

Resultados locais em 22/10/2026:

| Verificação | Resultado |
|---|---|
| Suíte de aprendizagem A/B/B1/C + regras oficiais + unitários de XP, com `node --test --experimental-test-isolation=none` | 114 aprovados, 0 falhas |
| Testes direcionados da política oficial após a revisão final do SQL | 11 aprovados, 0 falhas |
| `npm run test:learning:browser` | 4 aprovados, 0 falhas, sem erros JavaScript capturados |
| `npm run build` | Aprovado |
| ESLint nos componentes/biblioteca/páginas alterados | Aprovado |
| `git diff --check` | Aprovado |

Capturas revisadas em desktop e celular: `test-results/official-xp-review-desktop.png` e `test-results/official-xp-review-mobile.png`. Permanecem os avisos anteriores de tamanho de bundle e base Browserslist antiga. O lint foi direcionado ao escopo alterado, sem alegar validação global do repositório.

Limites: banco/identidades sintéticos, transporte adaptado e Chrome local. Não se declara homologação com Auth/PostgREST remotos ou conexões PostgreSQL independentes. O link HTTPS valida o formato da entrega; conteúdo e acessibilidade do projeto externo são avaliados pela professora.
