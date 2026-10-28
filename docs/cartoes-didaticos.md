# Cartões didáticos nativos — Bitaria

Etapa B implementada em 28/10/2026 e migration aplicada em produção na mesma data após autorização específica do usuário. Nenhum material real foi importado e o conteúdo/liberação da Aula 02 não foi modificado. As alterações de frontend integram esta entrega no repositório; sua disponibilização depende do deploy da aplicação.

## Aplicação do backend em produção

Projeto gnyiyhnbpjhdgrhsevbh. Aplicação direcionada do arquivo 20261028192918_flashcards_learning_activity.sql via CLI e registro apenas da versão 20261028192918 como aplicada no histórico. Nenhuma outra migration foi reparada.

Backup técnico do schema v2, definições/ACLs das três funções adaptadas e constraints de atividades salvo em tmp/backups/flashcards-before-20261028.json, ignorado pelo Git. Não substitui um dump integral do banco.

Verificação posterior: hashes de 18 tabelas de conteúdo, históricos, saldos e regras de recompensa idênticos antes/depois; tipo flashcards presente no schema; duas RPCs públicas criadas; execução anônima bloqueada; tabelas privadas com RLS e sem grants de leitura/escrita para authenticated. Nenhuma atividade flashcards ou revisão foi criada em produção.

Validação somente de leitura do conteúdo do exemplo, IDs únicos e regra activity_study retornou true no banco conectado. O exemplo não foi importado. Advisors apontaram somente dois informes novos de RLS sem políticas nas tabelas privadas desta implementação, deliberadamente sem acesso direto dos clientes. [Referência do informe](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Contrato definitivo para o Work

O envelope administrativo continua schemaVersion=2. A atividade usa type=flashcards, com content.schemaVersion=2 e content.type=flashcards. V1 continua aceitando somente seus tipos originais.

- [Exemplo completo válido com seis cartões](examples/cartoes-didaticos.v2.admin.json).
- [Schema do conteúdo de cartões](examples/flashcards-content.v2.schema.json).
- Schema administrativo completo: src/contracts/learning-content.v2.schema.json.
- [Plano aprovado e inventário da Aula 02](plano-cartoes-didaticos.md).

O exemplo é material de demonstração sobre vocabulário web, não os cartões históricos aprovados da Aula 02. Seus nomes de curso/módulo/submódulo são contextos ilustrativos. Substituir pelos títulos reais de destino antes de importar; não há URLs fictícias, imagens ou pontuações numéricas no exemplo.

~~~json
{
  "key": "web-vocabulary-cards",
  "type": "flashcards",
  "title": "Cartões para relembrar",
  "orderIndex": 0,
  "required": true,
  "prerequisites": [],
  "gamification": {
    "rewardRuleKey": "activity_study",
    "awardOn": "completed",
    "achievementKeys": []
  },
  "content": {
    "schemaVersion": 2,
    "type": "flashcards",
    "cards": [{
      "id": "html",
      "front": {
        "title": "HTML",
        "question": "Qual é o papel do HTML?"
      },
      "back": {
        "summary": "Estrutura e conteúdo.",
        "explanation": "HTML organiza os elementos de uma página.",
        "impact": "Ajuda a criar páginas compreensíveis."
      }
    }]
  }
}
~~~

Esse trecho é uma atividade, não o envelope completo de importação. O arquivo de exemplo contém context, lesson, activities e teacherOnly com as três listas existentes. Cartões não usam gabaritos privados.

| Campo | Regra |
| --- | --- |
| cards | 1–100 cartões |
| cards[].id | Único no conjunto, estável; padrão ^[a-z][a-z0-9-]{0,63}$ |
| front.title | Obrigatório, até 200 caracteres |
| front.question | Obrigatório, até 1.000 caracteres |
| back.summary | Obrigatório, até 1.000 caracteres |
| back.explanation | Obrigatório, até 4.000 caracteres |
| back.impact | Obrigatório, até 4.000 caracteres |
| back.curiosity | Opcional, até 4.000 caracteres |
| front.image / back.image | Objeto opcional com resourceUrl e altText obrigatórios |
| image.resourceUrl | HTTPS, até 2.048 caracteres, host sem credenciais e porta padrão/443; caminho opcional |
| image.altText | Não vazio, até 500 caracteres |

Textos obrigatórios/opcionais presentes não podem ser só espaços. Campos desconhecidos são rejeitados. IDs duplicados são rejeitados semanticamente no cliente e no banco, mesmo quando os textos dos cartões diferem.

Imagem opcional:

~~~json
{
  "image": {
    "resourceUrl": "URL HTTPS real do arquivo de imagem aprovado",
    "altText": "Descrição útil da informação visual"
  }
}
~~~

O trecho de imagem acima explica os campos e não é uma URL válida para importação. O Work deve inserir uma URL real e diretamente carregável. Links de página de visualização do Drive não são automaticamente imagens. Não inventar URLs nem adicionar scripts, HTML, SVG inline, CSS ou lógica de apresentação. Texto é renderizado como texto simples; quebras de linha dos textos explicativos são preservadas. A falha da imagem mantém o conteúdo textual e um aviso com a descrição.

## Experiência de estudo

Um cartão por vez, frente e verso com conteúdo separado. O aluno usa Ver explicação/Ver pergunta, Anterior/Próximo, Embaralhar cartões e Reiniciar sessão. A posição atual e a contagem de revisados são indicadores distintos.

- Virar para o verso registra sua revisão no servidor; somente a frente não conta.
- Todos os IDs do conjunto vigente precisam estar revisados para concluir.
- O aluno pode continuar revendo depois de concluir.
- Reiniciar volta ao primeiro cartão da ordem da sessão e mantém histórico/conclusão.
- Embaralhar usa Fisher–Yates em uma cópia dos IDs; não modifica o conteúdo ou o conjunto revisado.
- Não existem notas de acerto nem exigência de marcar “Já sei”.
- Botões nativos, teclado, foco visível, somente uma face no DOM e contador aria-live.
- prefers-reduced-motion desativa a animação de giro.
- Não há altura fixa que corte textos; imagem e controles se adaptam a telas estreitas.

Na prévia administrativa, virar/navegar/embaralhar funciona com estado local e uma mensagem explícita de prévia. Nenhuma RPC de revisão ou progresso do aluno é chamada.

## Persistência e XP

Tabela interna private.flashcard_review_progress:

- Chave: student_id, activity_id, activity_revision, card_id.
- first_reviewed_at é preservado em repetição; last_reviewed_at registra nova revisão.
- FK para a revisão da atividade e perfil; índice por atividade/aluno.
- RLS habilitada, sem grants diretos aos clientes.

student_activity_progress continua sendo a autoridade do status agregado. A tabela de cartões não cria outro sistema de XP.

| RPC pública | Parâmetros |
| --- | --- |
| student_flashcard_progress | p_activity_id |
| review_student_flashcard | p_activity_id, p_card_id |

Ambas retornam activity_id, activity_revision, reviewed_card_ids, reviewed_count, total e completed. Não aceitam student_id, score, status, revisão declarada, pontos ou total fornecido pelo navegador.

Os wrappers públicos usam SECURITY INVOKER; implementações privilegiadas privadas têm search_path vazio e validam perfil ativo de aluno, tipo/publicação da atividade, disponibilidade da aula na versão curricular e pré-requisitos. A gravação serializa pelo lock de perfil existente e confere cada card_id no conteúdo real. Repetições e duas abas preservam a primeira revisão e o crédito único.

Ao revisar o último cartão, a gravação atualiza o progresso agregado. Os triggers existentes concedem a recompensa e sincronizam a conclusão da aula quando cabível. O mapeamento novo é flashcards → activity_study; nenhum valor em xp_reward_rules é alterado. No ambiente testado a regra de estudo concede 10 XP; o frontend lê o saldo atualizado e não contém esse valor fixo.

complete_student_study continua recusando flashcards, pois sua confirmação genérica não comprova o conjunto revisado. Não é possível concluir com IDs inexistentes nem reaproveitar progresso de outro aluno/atividade/revisão.

O registro confirma uma interação válida do aplicativo, não atenção humana, memorização ou avaliação de acerto. Não há pontuação pedagógica associada a cada face.

Falha de rede mostra que a revisão não foi confirmada e permite tentar novamente. A interface só incrementa o contador quando recebe o estado do servidor. Ao recarregar, lê novamente as revisões salvas. Não usa localStorage como fonte de verdade.

Na central pedagógica, o detalhe autorizado da atividade exibe revisados/total, status, data e XP. O escopo de professora vinculada/admin permanece o existente; nenhum gabarito é acrescentado à resposta.

## Arquivos de implementação

- src/contracts/learning-content.v2.schema.json e src/types/learning.ts: contrato e tipos.
- src/lib/learningContent.ts: validação semântica.
- src/lib/studentLearning.ts e src/lib/flashcards.ts: RPCs e utilitário de embaralhamento.
- src/components/learning/FlashcardsActivity.tsx: componente, imagens, estado e persistência.
- src/components/learning/ActivityRenderer.tsx: integração e prévia.
- src/components/learning/LessonActivityList.tsx e LessonContentImporter.tsx: rótulos e resumo administrativo.
- src/components/pedagogy/PedagogyJourney.tsx e src/types/pedagogy.ts: contagens docentes.
- src/index.css: giro e reduced-motion.
- tests/flashcards.test.mjs, tests/flashcards-browser.test.mjs e tests/fixtures/flashcards-db.mjs: testes e dados exclusivamente isolados.
- tests/fixtures/learning-browser-harness.mjs: adaptador HTTP das RPCs reais no banco isolado.
- tests/video-learning.test.mjs e tests/official-xp.test.mjs: comparação do schema de cada migration histórica com sua própria época, sem incluir variantes posteriores.
- package.json: atalho test:flashcards.

LessonView e AdminLessonPreview reutilizam sua estrutura atual de atualização/renderização, sem criar outra página de aprendizagem.

## Migration e rollback

Migration criada pela CLI: supabase/migrations/20261028192918_flashcards_learning_activity.sql.

Requer as migrations atuais de vídeo, central pedagógica e versionamento curricular. Acrescenta a variante ao schema v2 armazenado e ao CHECK de tipos, uma restrição de IDs únicos, a tabela privada de revisões, helpers/RPCs e campos de contagem no detalhe pedagógico. Atualiza somente o mapeamento de validação/recompensa para o tipo novo. Não amplia a conclusão genérica de estudo.

As definições originais das três funções adaptadas e o schema anterior são guardados em private.flashcards_installation_backup, sem acesso do cliente. Adaptações exigem uma ocorrência exata nas funções e abortam diante de drift. CREATE OR REPLACE preserva ACLs e modos de segurança; isso é testado.

Rollback: supabase/rollbacks/flashcards_learning_activity.sql. Antes de qualquer cadastro de flashcards, restaura schema e funções e remove apenas a infraestrutura adicionada. Recusa rollback se houver atividade flashcards ou revisão persistida, mesmo que o conteúdo não tenha sido publicado. Após uso, preservar histórico e realizar correção progressiva.

A migration foi executada em produção após autorização; o rollback não foi executado. Não há importação, publicação ou alteração de conteúdo no SQL da migration.

## Homologação e implantação futura

1. Conferir os resultados finais das suítes abaixo, inclusive navegador.
2. Revisar a migration e executar advisors no ambiente autorizado.
3. Obter autorização específica para produção, conferir histórico remoto e fazer backup restrito.
4. Aplicar o backend antes de disponibilizar a interface com importações do tipo novo.
5. Homologar com os seis cartões reais aprovados do Work em ambiente autorizado.
6. Planejar um manifesto específico para a Aula 02. Ela já possui seis atividades; não reenviar o conjunto inteiro ao importador nem renumerar campos protegidos de registros publicados.
7. Recolher novamente progressos/tentativas/XP antes de qualquer adição obrigatória ou reorganização. Preservar UUIDs/keys/históricos e exigir aprovação própria para importação e liberação da aula.

A fixture desta entrega usa seis conceitos de vocabulário web em outra aula de teste; não substitui a aprovação editorial dos seis cartões históricos da Aula 02.

## Resultados de verificação

Resultados locais: **123 testes de banco/contrato/regressão aprovados**, incluindo currículo, quizzes, interações, vídeo, projetos, XP e acompanhamento pedagógico. Os dois cenários de navegador foram aprovados (a prévia/importação/central na execução completa e o fluxo do aluno repetido após ajustar a simulação de resposta perdida). Build de produção e ESLint dos arquivos de implementação alterados aprovados; permanecem os avisos anteriores de Browserslist desatualizado e bundles grandes.

Navegador verificado com teclado, reduced-motion, frente oculta fora do DOM, reload, dois retries para a mesma revisão, erro explícito recuperável, embaralhamento/reinício após conclusão e viewport de 390 px sem overflow. A prévia revisou os seis cartões sem nenhuma chamada RPC antes da importação; a importação criou somente rascunho no banco isolado e a professora viu 1/6 revisados. Capturas inspecionadas: test-results/flashcards-desktop.png e test-results/flashcards-mobile.png (diretório ignorado pelo Git). A primeira inicialização do Chrome falhou transitoriamente; a repetição executou o cenário com sucesso, sem erros JavaScript.

Comandos:

~~~powershell
node --test --experimental-test-isolation=none tests/flashcards.test.mjs
node --test --test-concurrency=1 tests/flashcards-browser.test.mjs
npm.cmd run build
npm.cmd run test:flashcards
~~~

O último atalho reúne a suíte de banco/contrato e navegador. Nenhuma credencial real de aluno é utilizada nos testes de navegador.
