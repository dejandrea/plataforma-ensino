# Aula 02 — verificação anterior à implantação, 12/11/2026

**Resultado: preparado para aprovação dos riscos, ainda não implantado.** Esta etapa realizou consultas de leitura, revisão de código, preparação local do release e testes isolados. Não executou migration remota, salvamento de reconciliação, publicação, push, merge ou deploy.

## Destinos confirmados

- Supabase: codePlatform, `gnyiyhnbpjhdgrhsevbh`, ACTIVE_HEALTHY, PostgreSQL 17.6.1.063.
- Aula: Grandes Nomes da Tecnologia, UUID `b17a2000-0000-4000-8000-000000001002`, key documental `html-m01-s01-a02`.
- A aula já está **published**. Nenhuma ação desta etapa a publicou; esse status será preservado.
- Vercel: projeto `prj_2vX60y3APQN45VaxtdvKHm7c89FT`, equipe `team_alD3VRmLVIi0J3OsRZr7N7sv` / andrea-francas-projects.
- Domínio de produção: https://plataforma-ensino-chi.vercel.app
- Deployment de produção consultado: `dpl_5NJw19qDcp3CBnMK6gRVkCKCxBcx`, READY, commit `617a6dbbf990c325793c57f712cacf2308056246`, ref main. O registro está disponível como candidato a rollback do frontend; isso não recupera o banco.

## Inventário atual

Todas as atividades abaixo estão ativas, publicadas e na revisão 1.

| Posição | Key | UUID | Tipo |
|---:|---|---|---|
| 0 | a02-v2-arquivos-secretos | 10be647a-1b53-4d99-8d3e-cdb0cc95dda0 | slides |
| 1 | a02-v2-associacao-parte1 | 1a502595-720b-4fba-8b19-3d2c9e085c5a | interactive |
| 2 | a02-v2-novas-pistas | d475a78e-b5c1-4e56-84d9-75a189b0aa70 | slides |
| 3 | a02-v2-seis-descobertas | 461f30d1-dbd8-4eac-91d8-99b8f25ad7d3 | interactive |
| 4 | a02-v2-mapa-grandes-ideias | 5382ace9-9067-4b2f-9c93-48fd25434f9f | mindmap |
| 5 | a02-v2-detetive-tecnologia | e2e2fc55-ef4b-4444-97a9-45ddddaa4563 | quiz |

Resultados das consultas: zero registros de progresso da aula, progresso de atividade, tentativas de quiz, sessões de avaliação, entregas, sessões pedagógicas, revisões de flashcards e eventos de XP originados na aula/atividades. Zero vínculos de apresentação nas atividades e zero pré-requisitos entrando ou saindo delas.

Os três gabaritos (quiz e duas associações), incluindo feedbacks e pares, foram comparados por conteúdo JSON com a referência do documento fornecido: **idênticos**. Não foram modificados nem divulgados no frontend.

## Compatibilidade e revisão

- Migration de reconciliação ausente do ledger; objetos privados de reconciliação também ausentes.
- Contrato v2 instalado, com suporte aos seis tipos usados: video, slides, flashcards, interactive, mindmap e quiz.
- Presentes os helpers de importação, validação de conteúdo/recompensa, IDs de flashcards, autorização administrativa e imutabilidade de histórico. Estruturas de apresentações e bucket privado também presentes.
- A definição atual de learning_guard_activity foi consultada: sua condição de imutabilidade corresponde ao ponto alterado pela migration. A migration exige exatamente uma ocorrência desse ponto, mantém as demais validações e não desabilita triggers.
- Comparação não escreve: a RPC de plano usa consultas e devolve diferenças/token. O salvamento é outra RPC e não será chamado durante a homologação de produção.
- Permissões transitórias dependem da transação e do par exato antes/depois; clientes não podem criá-las. Auditoria fica privada, com RLS e proteção contra alteração/exclusão.
- Inventário, gabarito, histórico ou vínculo divergente bloqueiam a operação. Não se trata de um importador genérico.

Migration revisada: `supabase/migrations/20261110220614_reconcile_a02_learning_content.sql`.

SHA-256: `1e33e990f6e8151cbb2b427a542626e793abfbf92bf07847dfc0ebcac1b39641`.

## Release isolado

Preparado em `tmp/release-a02-20261112`, a partir de um git archive do mesmo commit publicado. Somente 13 arquivos diferem da base: quatro fontes de aplicação, uma migration, documentação, dois testes e cinco arquivos de suporte de teste. O manifesto `tmp/release-a02-manifest-20261112.json` registra caminhos e SHA-256; todos foram conferidos após os testes.

As mudanças locais de agenda, relatórios, avaliações, package.json, lockfiles e outras migrations não foram copiadas. O package.json do release é o da base publicada. Arquivos .env e credenciais não foram copiados; o build recebeu apenas as duas configurações públicas do cliente Supabase, com conferência do hostname de destino e sem exibir os valores.

O release ainda não tem commit novo: não foi feito push, merge ou deployment. Após autorização, o commit deverá ser criado em checkout isolado, com allowlist desses arquivos, e seu SHA registrado no relatório de implantação. Não publicar a partir da árvore principal suja.

## Testes reexecutados no release

Comando: `node --test --test-concurrency=1 tests/a02-reconciliation.test.mjs tests/a02-reconciliation-browser.test.mjs tests/admin-lesson-preview.test.mjs tests/learning-content.test.mjs tests/managed-presentations.test.mjs`.

**31 aprovados, zero falhas.** Inclui fluxo real das funções/migration em PGlite, UUIDs preservados, duas inclusões em rascunho, rollback após falha tardia, bloqueios por histórico/gabarito/vínculo, idempotência, permissões, prévia e revisão em desktop/celular. São testes locais, sem dados reais de alunos.

Build no mesmo release: **aprovado**, `tsc -b && vite build`. Avisos de Browserslist desatualizado e chunks grandes não impediram a compilação. Não houve instalação de dependências novas nem alteração de política de execução do Windows.

Homologação do ambiente publicado, RPCs hospedadas e botão de recarga: **pendentes da implantação autorizada**. Testes locais não foram classificados como publicação.

## Recuperação e riscos que exigem confirmação

A consulta atual dos metadados de backup retornou `backups: null`, `pitr_enabled: false`, `physical_backup_data: {}` e `walg_enabled: true`. O último campo não comprova um ponto restaurável disponível. Continua **sem backup de produção com restauração comprovada**; nenhuma exportação ou restauração foi executada.

A implantação modifica schema e a função de proteção compartilhada de atividades, embora a exceção seja restrita à Aula 02. Há risco residual de defeito ou indisponibilidade. O salvamento futuro usa locks breves em tabelas compartilhadas, com timeout de 5 segundos, podendo causar espera de escritas de outras aulas. A instalação não salva conteúdo por si só.

Em caso de falha da migration, interromper; não executar correções destrutivas nem outras migrations. Se a migration concluir e a publicação falhar, manter o frontend anterior e investigar; não executar salvamento. O deployment anterior é uma opção de recuperação do frontend, não do schema/dados. Qualquer reversão estrutural exige revisão e autorização específica.

## Sequência proposta após confirmação explícita

1. Revalidar hash, destino e ausência de impedimentos imediatamente antes da alteração remota.
2. Aplicar somente o SQL acima via apply_migration, nome reconcile_a02_learning_content, e registrar a versão atribuída pelo servidor. Não usar db push, migration up geral ou reaplicar o gerenciador.
3. Conferir RLS, privilégios, RPCs, auditoria e proteção de escrita direta. Não atualizar uma atividade real apenas para testar o trigger: usar inspeção do catálogo e negativas que não possam escrever.
4. Publicar somente o release isolado do frontend e registrar o commit/deployment. Nenhuma Edge Function será alterada.
5. No domínio HTTPS, abrir a Aula 02, carregar o JSON e chamar somente Comparar com as atividades existentes. Conferir seis atividades existentes, duas novas e as diferenças propostas. Não marcar confirmação nem clicar em Salvar atualização revisada.
6. Verificar recarga da prévia e negativas de acesso administrativo, sem criar alunos ou obter segredos pelo chat. Comparar inventário e fingerprints antes/depois da homologação. Se uma sessão autenticada de navegador não estiver disponível, registrar essa pendência sem declarar sucesso visual.
7. Entregar evidências e instruções. O salvamento da reconciliação ficará exclusivamente para a revisão e aprovação da usuária pelo painel.

## Instruções após a futura disponibilização

Gestão do sistema → Conteúdo → Aula 02 → Importar atividades JSON. Manter o modo de atualização segura marcado, selecionar o JSON completo e clicar em Comparar com as atividades existentes. Revisar contexto, seis UUIDs, vídeo/cartões novos, ordem 0–7, materiais e obrigatoriedade. Conferir os dois reforços opcionais. Somente após sua própria aprovação, marcar a confirmação e salvar. As duas novas atividades devem continuar em rascunho até publicação separada; apresentação web e vínculo também são ações separadas.
