# Ambiente de aprendizagem — Etapa B

Evolução posterior: [Etapa B1](ambiente-aprendizagem-etapa-b1.md), com práticas interativas, embaralhamento persistido, importação e recompensas; veja o [guia de produção para o Work](guia-producao-atividades-interativas.md).

Implementa a aprendizagem do aluno prevista em `docs/prompts/fase1.md`, sobre a
[fundação da Etapa A](ambiente-aprendizagem-fundacao.md). A rota existente
`/lesson/:id` passa a apresentar as atividades; não foram criadas rotas adicionais.
Nenhuma migration foi aplicada no Supabase remoto e nenhum dado real foi alterado.

## Comportamento implementado

- Cabeçalho com título, descrição, objetivos e duração; lista ordenada com indicação
  de obrigatoriedade, pré-requisitos e os cinco estados de progresso.
- Slides e mapas mentais com links HTTPS, prévia de imagem/PDF e confirmação explícita
  de estudo. Selecionar ou abrir um recurso não o conclui. PDFs têm link alternativo
  quando a prévia não é suportada pelo navegador.
- Questionários de alternativa única, validação de todas as respostas, nota mínima,
  limite de tentativas, correção no PostgreSQL e feedback individual após envio.
  Histórico, respostas submetidas e resultado persistem ao recarregar a página.
- Ao retornar, a seleção prioriza uma atividade em andamento ou que precisa de
  ajustes; na ausência delas, prioriza uma obrigatória pendente antes das opcionais.
- Aula online mostra objetivo, preparação e próximo encontro explicitamente
  associado. O link abre `/sala/aula/:lessonId`, preservando a liberação do Meet da
  sala atual. Nenhum link Meet de um agendamento é enviado nesse snapshot.
- Miniprojeto mostra instruções, objetivos, requisitos, critérios, materiais e,
  quando existentes, entregas e feedbacks do próprio aluno. Envio/reenvio e revisão
  permanecem para D; esta etapa não expõe botões para aprovar projetos/encontros.
- Aulas sem conteúdo publicado mantêm vídeo, materiais externos e conclusão manual.
  Vídeos reconhecidos de YouTube/Vimeo podem ser incorporados; outros HTTPS ficam
  acessíveis por link. HTML de autoria nunca é executado ou injetado na página.
- Estados de carregamento/erro, repetição de consulta, bloqueio durante gravações,
  formulários com rótulos e grupos de alternativas e progresso acessível por ARIA.

## Arquitetura e regras do servidor

O SDK usa a sessão normal do aluno; não há credencial de serviço no navegador.
O ID do aluno sempre vem de `auth.uid()`. Uma consulta autorizada carrega o snapshot
com conteúdo publicado/ativo, objetivos, progresso, tentativas, histórico e encontros
do próprio aluno. Não inclui planos, respostas esperadas, gabaritos ou notas privadas.
Links curriculares legados de Meet também são omitidos quando a aula tem atividades.

| RPC pública | Entrada | Resultado |
| --- | --- | --- |
| `student_lesson_learning` | `p_lesson_id` | Snapshot exclusivo do aluno autenticado |
| `start_student_activity` | `p_activity_id` | Estado individual em andamento, sem conclusão |
| `complete_student_study` | `p_activity_id` | Confirma somente slides/mapas |
| `submit_student_quiz` | `p_activity_id`, `p_answers`, `p_request_id` | Tentativa corrigida e feedback salvo |
| `complete_student_lesson` | `p_lesson_id` | Data de conclusão verificada pelo servidor |

As RPCs públicas são `SECURITY INVOKER`. As implementações privilegiadas ficam em
`private`, com `search_path=''`, checagem de perfil/aluno ativo, autorização curricular
e EXECUTE somente nas entradas necessárias. Auxiliares internos não têm EXECUTE de
`authenticated`/`anon`. Não foram abertos INSERT/UPDATE diretos nas tabelas de execução.

Mutações serializam primeiro o perfil do aluno e depois leem/bloqueiam a atividade,
mantendo a ordem de locks compatível com o XP existente. Pré-requisitos explícitos
devem estar ativos/publicados e concluídos na revisão correspondente. A posição de
exibição não impõe bloqueio. Não é possível concluir quiz, encontro ou projeto com
a operação de confirmação de estudo.

### Questionários

Cada questão tem o mesmo peso. O servidor calcula `100 × acertos / questões`,
arredonda a porcentagem final para duas casas e compara com `passingScore`.
Rejeita respostas ausentes, alternativas inválidas, campos extras, configurações
inconsistentes, submissões depois da aprovação e tentativas além do limite.
O aluno não envia nota, aprovação, número da tentativa ou ID de outro aluno.

O cliente gera um UUID por envio, mantendo-o em uma repetição com as mesmas respostas.
`quiz_attempts.request_id`, único por aluno/atividade, impede que uma resposta perdida
ou um POST repetido consuma outra tentativa. O servidor devolve a tentativa já salva;
o mesmo UUID com outras respostas é rejeitado. Essa identidade é mantida durante o
formulário atual, não em armazenamento persistente de rascunhos.

`feedback_json` salva somente `{ questionKey, isCorrect, feedback }` após a submissão.
O gabarito permanece na tabela protegida. Tentativa, feedback, progresso e eventual
conclusão curricular/XP são gravados na mesma transação. Um erro desfaz o conjunto.

### Conclusão curricular e compatibilidade

A barra conta somente atividades obrigatórias ativas/publicadas, concluídas na
revisão atual. Ao concluir a última obrigatória, um trigger registra `student_progress`
e reutiliza os triggers de progressão e XP existentes. Repetições preservam a primeira
data e não duplicam conquistas. Aulas só com opcionais podem ser finalizadas
explicitamente, sem exigir que essas atividades sejam concluídas.

Um trigger adicional em `student_progress` impede que o upsert antigo ou uma chamada
direta conclua uma aula com obrigações pendentes. Se todo o conteúdo de uma aula já
publicada for ocultado, ela não retorna automaticamente ao fluxo manual legado.
Rascunhos que nunca foram publicados não mudam a semântica das aulas antigas.

Conclusões acadêmicas anteriores são preservadas quando novo material é publicado:
não se revogam módulos liberados nem se marcam atividades novas artificialmente como
concluídas. Por isso o histórico acadêmico e a barra das atividades podem representar
momentos diferentes de uma aula já estudada. Não há migração retroativa de históricos.

Encontros/projetos obrigatórios continuam impedindo a conclusão até receberem um
registro autorizado. C/D deverão atualizar esse progresso no backend, com autorizações
próprias. Não há uma RPC de aluno para escolher estados de aprovação.

## Arquivos desta etapa

| Arquivo | Alteração |
| --- | --- |
| `src/pages/LessonView.tsx` | Integração do snapshot, seleção, ações, erros e conclusão |
| `src/components/learning/ActivityProgress.tsx` | Barra e rótulos de estado |
| `src/components/learning/LessonActivityList.tsx` | Lista ordenada e dependências |
| `src/components/learning/ActivityRenderer.tsx` | Recursos, encontros e projetos |
| `src/components/learning/QuizActivity.tsx` | Respostas, submissão, feedback e histórico |
| `src/components/learning/LegacyLessonContent.tsx` | Conteúdo de aulas antigas |
| `src/lib/studentLearning.ts` | Cliente das cinco RPCs, sem expor detalhes SQL ao aluno |
| `src/lib/learningProgress.ts` | Progresso, retomada e URLs seguras |
| `src/types/learning.ts` | Tipos de snapshot, encontros, feedback e identidade de tentativa |
| `supabase/migrations/20261021041807_student_learning_experience.sql` | RPCs, colunas e triggers |
| `supabase/rollbacks/student_learning_experience.sql` | Reversão manual da etapa |
| `tests/student-learning.test.mjs` | Segurança, correção, integração curricular/XP e rollback |
| `tests/learning-progress.test.mjs` | Contagem, retomada, URLs e limites do cliente |
| `tests/learning-browser.test.mjs` | Fluxo real no navegador com API/banco locais |
| `tests/fixtures/learning-test-db.mjs` | Banco descartável com migrations reais e dados sintéticos |
| `tests/fixtures/learning-browser-entry.tsx` e `.html` | Entrada exclusiva dos testes visuais |
| `package.json`, `package-lock.json` | Scripts e Playwright 1.56.1 apenas em desenvolvimento |
| `.gitignore` | Exclui screenshots/resultados gerados em `test-results/` |
| `docs/contrato-conteudo-v1.md` | Atualiza o estado da correção implementada, sem alterar o schema v1 |

## Verificação

História verificada: aluno abre `/lesson/:id` → SDK chama a RPC com sua sessão →
PostgreSQL valida acesso/corrige/salva → interface apresenta feedback e progresso.

- Suíte de aprendizagem: contrato v1, fundação, RPCs B e helpers de apresentação.
- Migrations reais de progressão, XP, A e B executadas no PGlite com fixture explícita
  das tabelas iniciais ausentes do histórico do repositório; não é uma cópia de produção.
- Testes incluem isolamento de aluno, perfil inativo, escopo de mentoria, acesso a
  módulo bloqueado, ausência de gabarito no snapshot, DML forjado, número máximo de
  tentativas, repetição de UUID, pontuação fracionária, opcionais, confirmação da
  professora, compatibilidade legada, XP sem duplicação e rollback/reaplicação.
- Navegador Chrome headless em desktop e 390 px: abrir material não conclui;
  confirmação persiste; quiz reprovado mantém feedback após reload; uma resposta HTTP
  perdida gera reenvio seguro; aprovação conclui aula e credita XP uma única vez;
  projeto mobile não gera overflow e aula antiga continua concluível.
- O teste de navegador usa a interface/SDK reais e um adaptador HTTP local para as
  RPCs reais. **Auth e PostgREST remotos não são executados**: a identidade é sintética
  no adaptador. O Vite de teste usa `envFile:false`, URL/chave falsas e bloqueia
  requisições externas; não lê credenciais de produção nem acessa recursos externos.
- Screenshots: `test-results/learning-desktop.png` e `learning-mobile.png`, gerados
  pelo teste e não versionados. Sem erros de execução JavaScript nesse fluxo.

Comandos:

```text
npm ci
npm run test:learning
npm run test:learning:browser
npm run build
```

No Windows, o teste usa Chrome instalado. Em outro sistema, instalar o Chromium do
Playwright ou escolher um navegador instalado com `PLAYWRIGHT_CHANNEL`. Em sandbox
que impede subprocessos, os testes de banco/helpers também podem rodar com
`node --test --experimental-test-isolation=none` e os quatro arquivos de `test:learning`.
O teste de navegador precisa de permissão para executar o navegador e o Vite local.

Resultados finais desta execução:

- **57/57 testes** da suíte de aprendizagem passaram.
- **1/1 teste de navegador** passou, incluindo desktop, mobile e reenvio após resposta perdida.
- Build TypeScript/Vite e ESLint dos arquivos alterados passaram; `git diff --check` sem erros.
- Suíte completa: **94/96 testes passaram**. Permanecem as duas falhas já identificadas
  em `tests/lesson-history-status.test.mjs`, cujos mocks não incluem `student_id`
  exigido pela função existente para concluir aulas. Esses arquivos não foram alterados.
- O build mantém os avisos existentes de tamanho do bundle e base Browserslist antiga.

Continuam necessários em homologação: autenticação e PostgREST reais, schemas/grants
do projeto existente, advisors e concorrência em conexões PostgreSQL independentes.
O PGlite não comprova concorrência entre conexões; os testes confirmam deduplicação e
limites, e o código utiliza lock de perfil para serializar esses casos no PostgreSQL.

## Implantação, reversão e próxima etapa

1. Revisar/aplicar A e depois B em homologação autorizada. Confirmar dependências
   anteriores, incluindo a RPC curricular existente; não enviar todas as migrations
   locais indiscriminadamente. Revisar os advisors de segurança e testar JWTs reais.
2. Aplicar backend **antes** de publicar este frontend. Sem a RPC B, a página mostra
   indisponibilidade e não oferece um fallback que contorne as novas obrigações.
3. Aplicação em produção continua dependendo de autorização explícita e backup.
   Nenhuma implantação foi feita nesta execução. Os exemplos HTML não foram semeados
   no banco real; importação/publicação administrativa segue na etapa E.
4. Rollback manual: revisar `supabase/rollbacks/student_learning_experience.sql`.
   Mantém tentativas, progresso e XP, mas remove UUIDs/feedbacks adicionados por B e
   os novos endpoints/triggers. Reverter o frontend junto para evitar chamadas ausentes.
   Sem `CASCADE`, não remove dependências futuras silenciosamente.

A próxima etapa é **C — Painel interativo da professora**: associar o plano ao
agendamento, conduzir etapas com autosalvamento e retomada, registrar avaliação
pedagógica e confirmar a atividade online com autorização. Preservar separação entre
status administrativo do encontro, execução do roteiro, avaliação e conclusão
curricular. D adicionará envio/revisão/reenvio de projetos; E, gestão e importação.
