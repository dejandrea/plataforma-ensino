# Ambiente de aprendizagem — Etapa C

Implementação local de encontros online, seguindo `docs/prompts/fase1.md` e a fundação A/B/B1. Nenhuma migration foi aplicada remotamente e nenhum dado de produção foi alterado.

## Experiência entregue

O painel pedagógico aparece na sala existente (`LessonRoom`) para professora/administradora, em encontros de curso com aluno vinculado. O cabeçalho, horários, participantes, Meet e encerramento administrativo continuam na sala. Não há nova rota.

A professora pode vincular uma atividade online publicada do currículo liberado para o aluno. A sessão fixa o plano e sua revisão; vincular novamente a mesma atividade não duplica o registro nem troca o plano. Uma atividade pode ser conduzida em vários encontros, com registros individuais. O painel exibe curso, módulo, submódulo e aula curricular.

O plano inclui objetivos, preparação, pré-requisitos, critérios de avaliação e etapas expansíveis com objetivo, duração, orientações, código/arquivo/resultado, perguntas e respostas esperadas, explicações detalhada e lúdica, dificuldades comuns e desafio. O código é exibido como texto; não é executado.

O checklist mostra quantidade, percentual de execução e pendências. A avaliação do encontro registra compreensão, aplicação prática e autonomia nos três níveis previstos, observações, dificuldades, recomendações e etapas a retomar. Esses registros ficam em `lesson_plan_sessions`, separados de `module_evaluations` e do histórico acadêmico.

As alterações são salvas automaticamente após 500 ms de pausa. O cliente serializa suas gravações, conserva alterações feitas durante uma requisição, informa erros e permite tentar novamente. Um número de versão impede sobrescrita silenciosa entre abas: em conflito, o servidor recusa a gravação e a interface orienta copiar as anotações antes de recarregar. Enquanto há alterações não salvas, a página solicita proteção de saída pelo mecanismo `beforeunload` do navegador. Não se grava conteúdo pedagógico privado em localStorage.

## Quatro registros distintos

1. O encerramento administrativo continua sendo feito pela ação existente da sala.
2. O checklist registra a execução do roteiro e admite etapas pendentes.
3. A avaliação pedagógica registra o acompanhamento do encontro, sem criar avaliação acadêmica duplicada.
4. A atividade curricular só é concluída pela ação explícita **Confirmar atividade curricular do aluno**, após o encontro estar encerrado.

A confirmação aceita etapas pendentes, verifica atividade publicada/ativa, currículo liberado e pré-requisitos. Registra autora e data, grava o progresso do aluno e reutiliza os mecanismos existentes de conclusão de aula e recompensas. A operação é transacional e idempotente; a configuração central controla o XP e o recibo existente impede pagamento duplicado. Encerrar o encontro ou completar checkboxes não confirma automaticamente o currículo.

## Banco, permissões e integridade

Migration: `supabase/migrations/20261022034112_teacher_learning_workspace.sql`, criada com o CLI. Acrescenta `version`, `confirmed_at`, `confirmed_by`, uma restrição de consistência entre os campos de confirmação e índice para a referência da autora. Não cria tabelas nem novas políticas RLS.

As políticas de leitura existentes continuam válidas. O grant de INSERT/UPDATE direto de `lesson_plan_sessions` para `authenticated` é revogado; as gravações do navegador passam por RPCs:

| RPC | Responsabilidade |
|---|---|
| `teacher_learning_workspace` | Plano restrito, sessões e atividades online elegíveis |
| `link_teacher_learning_activity` | Vincular uma atividade e fixar sua revisão de plano |
| `save_teacher_learning_session` | Validar e salvar checklist, notas e avaliação com controle de versão |
| `confirm_teacher_learning_activity` | Confirmar explicitamente a conclusão curricular, com autoria e data |

As funções usam `SECURITY DEFINER`, `search_path=''` e autorização pelo perfil ativo, vínculo professora/aluno e encontro responsável. Administradores ativos podem gerenciar encontros de alunos ativos. Alunos, contas inativas, professoras sem responsabilidade pelo encontro e acesso anônimo são recusados. Encontros cancelados permanecem consultáveis pela equipe autorizada, mas recusam novas vinculações e gravações. Planos e observações não são incluídos na resposta do aluno.

A confirmação adquire o lock do perfil antes do encontro/sessão/atividade, seguindo a ordem usada pelo progresso e XP. Checklist, campos e referências de retomada são validados no servidor; o navegador não envia aluno, status de progresso, pontuação ou valor de recompensa.

## Arquivos

- `src/components/learning/TeacherLearningPanel.tsx`: painel, roteiro, autosave, avaliação e confirmação.
- `src/lib/teacherLearning.ts`: contratos da resposta docente e acesso às RPCs.
- `src/pages/LessonRoom.tsx`: integração, tipagem explícita dos dados da sala e ajuste do carregamento assíncrono.
- Migration indicada acima e `supabase/rollbacks/teacher_learning_workspace.sql`.
- `tests/teacher-learning.test.mjs` e `tests/teacher-learning-browser.test.mjs`.
- `tests/fixtures/learning-browser-harness.mjs` e `learning-browser-entry.tsx`: suporte local ao painel/RPCs docentes.
- `package.json`: inclusão dos testes C nos scripts de aprendizagem.

## Validação local

Os testes de banco usam PGlite, migrations reais e identidades sintéticas. Os testes de navegador usam Chrome headless e componentes React reais, conectados às mesmas funções SQL por adaptador HTTP local. As telas desktop e móvel (390 × 844) foram revisadas pelas capturas `test-results/teacher-learning-desktop.png` e `teacher-learning-mobile.png`.

Cobertura C: isolamento por papel/encontro, impossibilidade de escrita direta, vínculo idempotente, persistência da avaliação/checklist, recusa de versões antigas e campos inválidos, cancelamento, separação de encerramento e confirmação, pré-requisitos, XP único, privacidade perante aluno, rollback/reaplicação, autosave, recuperação de falha de rede e recarga da página.

Resultados locais em 22/10/2026:

| Verificação | Resultado |
|---|---|
| Suíte de aprendizagem (A/B/B1/C), com `node --test --experimental-test-isolation=none` e os arquivos do script `test:learning` | 99 testes aprovados, 0 falhas |
| `npm run test:learning:browser` | 3 testes aprovados, 0 falhas, sem erros JavaScript capturados |
| `npm run build` | Aprovado (TypeScript e Vite) |
| ESLint no painel, biblioteca docente e `LessonRoom.tsx` | Aprovado |
| `git diff --check` | Aprovado |

O build mantém os avisos existentes sobre tamanho do bundle e base Browserslist antiga. O lint foi direcionado aos arquivos da etapa C; não se declara lint global do repositório. As demais alterações locais preexistentes foram preservadas.

## Implantação e reversão

Revisar e homologar o SQL com as migrations A/B/B1 e suas dependências antes de disponibilizar o frontend. Aplicar a migration C no ambiente alvo somente com autorização correspondente; a execução desta etapa ficou restrita ao banco temporário dos testes.

O rollback manual preserva planos, checklist, notas e avaliações nas estruturas anteriores, remove as RPCs/colunas C e restaura os grants anteriores sob RLS. Ele recusa execução se já houver confirmação curricular, para preservar sua autoria e data. Nesse caso é necessário um plano de migração dos dados, sem remover o guard para forçar reversão.

## Limites e próxima etapa

Auth/PostgREST remotos e conexões PostgreSQL independentes não foram homologados. O adaptador local troca transporte e identidade, sem exercitar uma sessão real do Supabase. Não há colaboração em tempo real nem fusão automática de registros entre abas. O rascunho não é um armazenamento offline; deve-se aguardar a indicação de registro salvo antes de navegar internamente.

Não há integração de áudio/vídeo, execução de código, IA ou exportação de plano em PDF. Encontros de mentoria mantêm a experiência existente. A etapa D permanece responsável pelo envio, revisão, reenvio, aprovação e devolutiva dos projetos.
