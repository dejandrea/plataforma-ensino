# Implantação controlada da reconciliação da Aula 02 — 12/11/2026

**Backend e frontend implantados. Nenhuma reconciliação de conteúdo foi salva.** A usuária aceitou expressamente o risco de recuperação após receber o relatório de pré-implantação.

## Migration

- Projeto: codePlatform, `gnyiyhnbpjhdgrhsevbh`.
- Aplicado exclusivamente o SQL auditado originalmente em `20261110220614_reconcile_a02_learning_content.sql`.
- SHA-256 confirmado: `1e33e990f6e8151cbb2b427a542626e793abfbf92bf07847dfc0ebcac1b39641`.
- Nome: reconcile_a02_learning_content. **Versão registrada: 20261112035823**.
- O arquivo do release e o arquivo local foram alinhados à versão real: `supabase/migrations/20261112035823_reconcile_a02_learning_content.sql`, sem alterar o conteúdo SQL. Não reaplicar a versão original.
- Não foram executados db push, migration up geral, repair ou alterações em Edge Functions. A migration do gerenciador não foi reaplicada.

RPCs públicas `plan_a02_reconciliation` e `apply_a02_reconciliation` presentes, sem EXECUTE anônimo, com verificação interna de admin ativo e search_path vazio. Auditoria e permissões transitórias privadas com RLS, sem INSERT direto de clientes; ambas vazias ao final. O guard compartilhado continua rejeitando edição direta de conteúdo publicado, exceto pelo par exato autorizado internamente durante a transação de reconciliação. A instalação foi verificada por catálogo; não foi tentada atualização de atividade real para testar esse guard.

## Release do frontend

- Base publicada preservada: `617a6dbbf990c325793c57f712cacf2308056246`.
- Commit isolado: **`d2acc6f5c7455a62ec1e4ff916273b80df7640a6`**.
- Branch: `release/a02-reconciliation-20261112`.
- [Commit no GitHub](https://github.com/dejandrea/plataforma-ensino/commit/d2acc6f5c7455a62ec1e4ff916273b80df7640a6).
- Somente 13 arquivos de aplicação/migration/documentação/testes desta alteração. Agenda, relatórios, avaliações, package.json e lockfiles pendentes não foram incluídos.
- A branch main e a árvore principal com os outros trabalhos foram preservadas. O commit foi criado num clone local separado e enviado apenas para a branch de release. Antes de um futuro deploy automático da main, incorporar esse commit para não perder o frontend desta funcionalidade; nenhum merge foi feito nesta autorização.
- A prévia automática dessa branch foi construída; depois foi criado um **novo build com target production**, a partir daquele mesmo commit, usando o projeto Vercel já conectado. Não foi presumida proteção da prévia.
- Deployment de produção: **`dpl_7G2T5EoP4LQrp3X4v3ABELSsmXA5`**, READY, sem erro de alias.
- URL principal: https://plataforma-ensino-chi.vercel.app
- URL do deployment: https://plataforma-ensino-bw5gbwayt-andrea-francas-projects.vercel.app
- [Deployment na Vercel](https://vercel.com/andrea-francas-projects/plataforma-ensino/7G2T5EoP4LQrp3X4v3ABELSsmXA5).

## Verificações anteriores e posteriores

1. Projeto/UUID/hash revalidados, seis atividades encontradas, histórico e vínculos conflitantes ausentes. Gabaritos conferidos na preparação anterior.
2. Comparação administrativa executada **em transação read-only** no banco de produção: sucesso, seis updates propostos e duas inserções propostas. Foram mostrados os UUIDs existentes, posições finais 0–7, seis obrigatórias e dois reforços opcionais. A RPC apply não foi chamada.
3. Negativas usando contextos reais de aluno e professor: acesso ao plano negado. Não foi encontrado perfil inativo para testar esse cenário em produção; o cenário passou no banco isolado, sem criar contas reais.
4. REST anônimo da RPC nova: HTTP 401 / SQLSTATE 42501, comprovando exposição da rota com bloqueio de acesso, sem erro de função inexistente.
5. Domínio HTTPS: HTML e JavaScript principal HTTP 200. Bundle aponta para o projeto Supabase correto; chunk do importador inclui as duas RPCs e o UUID da Aula 02. Chunk da prévia inclui o botão Atualizar atividades salvas.
6. Os hashes e contagens de **11 tabelas** permaneceram idênticos entre o início e o fim: lessons, lesson_activities, student_progress, student_technology_progress, student_activity_progress, student_xp_events, xp_event_audit, xp_reward_rules, activity_quiz_keys, web_presentation_links e web_presentations.
7. Estado final da Aula 02: **seis atividades**, zero vínculos web, status da aula **published**, já existente antes desta implantação. Auditoria e permissões transitórias: zero registros. Vídeo e flashcards não foram inseridos.
8. No release isolado, antes da publicação: **31 testes aprovados, zero falhas, build aprovado**, incluindo o fluxo em desktop/celular, bloqueios por histórico/gabaritos/vínculos, idempotência, rollback, prévia administrativa e regressões do gerenciador.

## Limitação de homologação visual

A conexão com os aplicativos/navegador da usuária estava indisponível (native pipe e browser access host indisponíveis). Não foi possível abrir uma sessão administrativa autenticada na interface publicada para clicar em Comparar ou Atualizar atividades salvas. Não foi extraído token nem solicitado segredo.

Portanto, **a comparação passou no banco de produção e os componentes foram confirmados no domínio publicado**, enquanto a conferência visual autenticada desses botões no ambiente publicado permanece pendente. O teste de navegador completo passou apenas no ambiente isolado; não foi apresentado como teste visual de produção.

## Como revisar e salvar pelo painel

1. Abrir https://plataforma-ensino-chi.vercel.app e recarregar a página; entrar como administradora.
2. Gestão do sistema → Conteúdo → Aula 02 — Grandes Nomes da Tecnologia → Importar atividades JSON.
3. Manter marcada a opção Atualizar a Aula 02 com comparação e preservação dos registros existentes.
4. Selecionar o JSON completo fornecido e clicar em **Comparar com as atividades existentes**. Isso não salva.
5. Revisar contexto, UUIDs, materiais, ordem e obrigatoriedade. O esperado é atualizar as seis atividades conhecidas, inserir vídeo na posição 0 e flashcards na posição 2, e deixar associação-parte1 e novas-pistas opcionais nas posições 6 e 7.
6. Para conferir os registros atualmente salvos, usar Visualizar aula → Atualizar atividades salvas.
7. Somente quando decidir aprovar a mudança real, marcar a confirmação e clicar em Salvar atualização revisada. Esse salvamento não foi feito pelo agente. As duas atividades novas ficarão em rascunho; publicá-las será outra ação explícita.
8. Não publicar nem vincular a apresentação web para contornar qualquer bloqueio. Se surgir histórico, gabarito divergente, mudança concorrente ou vínculo conflitante, interromper e revisar.

## Recuperação e pendências

Permanece sem backup de produção com restauração comprovada, risco aceito para esta instalação. O deployment anterior `dpl_5NJw19qDcp3CBnMK6gRVkCKCxBcx` é candidato de recuperação do frontend; não restaura schema ou dados. Nenhuma reversão destrutiva foi executada.

Pendências: conferência visual autenticada pela usuária; futura integração do commit isolado na main antes de novos deploys dessa branch; eventual revisão e salvamento do JSON pela própria usuária. Nenhuma dessas pendências autoriza publicação automática de atividades ou apresentação.
