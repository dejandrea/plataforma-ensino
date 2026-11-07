# Auditoria pré-implantação — 31/10/2026

> **Estado atual consolidado:** consulte [Revisão dos bloqueios e proposta de release](revisao-bloqueios-release-apresentacoes-web-20261031.md). As seções abaixo registram etapas anteriores e contêm afirmações temporais superadas (como acesso Vercel bloqueado e gerenciador sem commit). A revisão mais recente não autoriza alterações de produção e prevalece para decisões de implantação.

## Atualização — acesso Vercel confirmado

Após o consentimento da equipe, foi confirmado o domínio HTTPS `https://plataforma-ensino-chi.vercel.app`, atualmente apontando para o deployment de produção `dpl_5A8o7uMNwLZmnVPpXnSq7RWPWRrw`, estado READY, fonte Git, branch `main`, SHA `b01e64be708cf176d9897586d76c3235cc87a5be`. Esse deployment foi listado como candidato de rollback. O projeto não indica proteção SSO/senha/IP. As variáveis VITE de produção estão presentes; o valor de `VITE_SUPABASE_URL` foi comparado sem expor segredos e corresponde ao ref `gnyiyhnbpjhdgrhsevbh`.

Consulta CLI `supabase backups list --project-ref gnyiyhnbpjhdgrhsevbh --output json`: `backups: null`, `physical_backup_data: {}`, `pitr_enabled: false`, `walg_enabled: true`. O indicador WAL-G não comprova um ponto recuperável disponível. Tentativa de exportação de schema com `supabase db dump --linked --file tmp/backups/pre-managed-presentations-schema-20261031.sql` falhou: Docker/Podman ausentes. `pg_dump`/`psql` não encontrados no PATH nem nas instalações PostgreSQL consultadas. Nenhum backup completo foi produzido; não tratar eventual arquivo parcial como backup.

Condição de parada mantida: comprovar um backup atual restaurável (incluindo estratégia separada para binários Storage) antes da primeira migration e do push à main que pode disparar deploy automático. Nenhuma migration, importação, publicação, vínculo ou push executado. A autorização da usuária para o plano e merge continua válida; falta cumprir esse pré-requisito técnico.

Validação após integração local: build passou; dez testes de pacote, gerenciador, banco, contrato e biblioteca passaram. Navegador: biblioteca e viewer passaram; gerenciador apresentou timeout de carregamento Vite no grupo, mas passou na repetição isolada sem isolamento por subprocessos. Não há testes reais de produção executados.

Estado: implantação NÃO autorizada nem executada. Consultas de produção somente de leitura. Este relatório é preliminar até confirmar o ambiente Vercel e a recuperabilidade do backup.

Atualização após autorização da usuária: preparação e merge autorizados. Commit do gerenciador `2eedce1` integrado por fast-forward à `main` local, incluindo os commits anteriores de biblioteca, template, navegação e correção de títulos. A branch `feat/template-apresentacoes-web` já é ancestral da main. Push e implantação permanecem pendentes da confirmação do destino Vercel e do backup recuperável; nenhuma escrita em produção foi executada.

Os testes do gerenciador agora carregam o pacote de referência de `tests/fixtures/a02-package/`, fora da pasta pública. Os sete arquivos reais em `public/apresentacoes/` continuam locais e não rastreados, excluídos do commit. O build do workspace local ainda pode copiá-los para `dist`: não usar esse diretório para deploy; gerar o artefato exclusivamente de checkout limpo do commit aprovado. Os scripts gerais de apresentações não dependem mais dos testes locais específicos da Aula 02.

## Repositório e escopo

- Origin: `dejandrea/plataforma-ensino` no GitHub.
- Branch atual e remota: `feat/biblioteca-visual-bitara`, commit `8f96bf48af0f1115b6fb5cddf52924c548543fad`.
- `main` local/remota: `b01e64be708cf176d9897586d76c3235cc87a5be`.
- Consulta remota por `git ls-remote` confirmou os hashes. O gerenciador está em alterações locais, ainda sem commit; portanto não está integrado em uma versão de release. A branch correta de produção ainda depende da consulta Vercel.
- Há também deck real da Aula 02 e seis imagens não rastreados em `public/apresentacoes/`. Um deploy do workspace inteiro publicaria esses arquivos. Preparar uma cópia/checkout de release que exclua esses sete arquivos e seus testes específicos, preservando os originais locais. Ajustar os scripts de teste desse checkout para não depender de arquivos retidos. Manter biblioteca oficial, viewer, schema e parser completos.
- Não fazer push/merge antes de identificar as regras de deploy automático e revisar o diff do commit de release.

## Destinos e inventário consultado

Supabase: projeto `codePlatform`, ref `gnyiyhnbpjhdgrhsevbh`, região `us-west-2`, estado `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.063. Confere com `supabase/.temp/project-ref`.

Vercel: projeto `plataforma-ensino`, ID `prj_2vX60y3APQN45VaxtdvKHm7c89FT`, equipe `team_alD3VRmLVIi0J3OsRZr7N7sv` (`andrea-francas-projects`), encontrado pelo repositório. Não há `.vercel/project.json` local. Consultas de detalhes e deployments retornaram 403 por falta de concessão à equipe. Domínio HTTPS, branch de produção, SHA em uso, variáveis por ambiente e deployment de recuperação NÃO foram confirmados. Foi solicitado consentimento de acesso à equipe; isso não autoriza deploy.

Banco: 18 aulas, 14 atividades; apenas bucket `catalog-icons` público, limite 2 MiB, e 7 objetos Storage. As duas políticas existentes de Storage limitam leitura/upload ao bucket `catalog-icons`. Não há tabelas/relações ou funções com nomes contendo `web_presentation`, nem bucket `web-presentations`.

Fingerprint de inventário de atividades, para referência temporal (MD5 da concatenação ordenada de row_to_json): `219ee95f6cf2a68b82f08264e8eb45da`. Recalcular imediatamente antes/depois da implantação; alterações legítimas concorrentes devem ser investigadas, não revertidas automaticamente. Contagens estatísticas de progresso/XP não substituem snapshot consistente.

Histórico remoto termina em `20261028220751_preserve_completed_lesson_titles`; inclui flashcards e currículo v2. Existem divergências históricas entre timestamps locais/remotos, por exemplo mensal de avaliações e foundation. A migration nova não consta como aplicada. Não reparar/aplicar migrations antigas só para igualar os nomes.

## Migration e pré-requisitos

Arquivo único proposto: `supabase/migrations/20261031105202_managed_web_presentations.sql`.

SHA-256 dos bytes locais auditados: `F6BB155D365ECC76706F3D33118E7B1F8F89D0414C985CB6ADB8AB7D7DF16380`. Conferir novamente no artefato de release, inclusive eventual normalização de fim de linha.

Confirmados no banco: `auth.uid()`, `gen_random_uuid()`, colunas necessárias de `profiles`, `lessons`, `lesson_activities` e `storage.objects` (`bucket_id`, `name`, `metadata`), além dos helpers:

- `private.learning_role()`;
- `private.learning_reject_history_change()`;
- `private.learning_require_student_lesson(uuid)`;
- `private.learning_can_read_activity(uuid)`;
- `private.learning_prerequisites_complete(uuid,uuid)`.

Os helpers têm search_path vazio. Não há colisões de nomes dos novos objetos encontradas nas consultas. Não foi identificada necessidade de migration adicional; confirmar novamente catálogo, grants, definições dos helpers e histórico antes de executar. A presença das assinaturas não é comprovação de igualdade byte a byte com todas as definições locais.

A migration é aditiva e transacional, com lock_timeout de 5 s; cria três tabelas públicas e auditoria privada, RLS, RPCs, bucket privado e política de leitura por manifesto/autorização. Não reescreve atividades, XP ou progresso. Registro exige service_role; publicação e vínculo exigem administrador ativo e confirmação. Versões/eventos são imutáveis. Colisão ou timeout deve interromper a execução para diagnóstico.

## Backup e riscos ainda abertos

Os arquivos ignorados em `tmp/backups/` são recortes anteriores: curriculum-before-v2 (26/10), flashcards-before e completed-title-before (28/10). Não são um backup completo atual com restauração comprovada. Disponibilidade, retenção e último ponto restaurável de backup/PITR do Supabase não foram confirmados pelos conectores disponíveis. Isso é condição de parada, não uma garantia de recuperação.

Antes da execução autorizada: confirmar backup gerenciado restaurável ou produzir exportação consistente protegida com schema/dados/ACLs e evidência de restauração isolada; registrar separadamente inventário/backup de arquivos Storage, pois dump SQL não contém os binários. Não versionar dados privados ou credenciais.

Outros riscos: publicação involuntária da Aula 02; branch de release ainda não confirmada; rewrite SPA genérico em `vercel.json` precisa ser exercitado no hosting real; bundle da Edge importa parser/schema fora da pasta da função e precisa ser validado no deploy; transporte real Auth/Storage ainda não homologado. CORS atual permite `*` com token Bearer e não usa cookies: conferir preflight e rejeição sem token/sem papel, sem tratar CORS como autorização. URLs assinadas duram 300 s e podem continuar válidas até expirar mesmo após mudança de permissão; conferir renovação de 120 s e revogação de novas emissões. Rascunho nunca pode ser acessível por política pública.

## Plano técnico proposto — aguarda autorização explícita

1. Completar acesso Vercel, confirmar domínio/branch/SHA, variáveis apontando ao Supabase correto, proteção de preview e comportamento de deploy automático. Registrar deployment anterior elegível à recuperação. Confirmar backup restaurável.
2. Preparar release revisável só do gerenciador e dependências, sem deck/imagens reais da Aula 02. Executar testes do gerenciador, apresentações, Bitara, navegador e build; revisar diff. Commit/integração/push apenas no fluxo de release confirmado, evitando promoção automática antecipada.
3. Reconsultar inventário e baseline consistente das atividades, progresso e XP. Aplicar somente o SQL auditado usando ferramenta de migration com nome/versionamento exato; conferir registro e catálogo após aplicação. Não usar db push geral nem repair de versões antigas.
4. Implantar apenas `import-web-presentation` com JWT verificado, preservando as demais funções. Conferir bundle, segredos padrão do servidor, resposta a OPTIONS e bloqueios 401/403 antes de importar.
5. Gerar deployment de produção sem atribuição de domínio, se suportado pelo projeto, e homologar o artefato. Depois promover esse mesmo deployment ao domínio real conforme autorização. Conferir rota gerenciada React, viewer estático, imagens/Bitara e cabeçalhos HTTPS.
6. Usar pacote sintético sem conteúdo real em espaço de homologação isolado. Para testar aluno autorizado, a regra exige vínculo a slides publicado: provisionar/usar somente aula, atividade e contas sintéticas restritas, com autorização incluída no plano. Não vincular atividade real. Sem esse espaço autorizado, executar esse caso em staging, mantendo a verificação em produção pendente.
7. Testar admin ativo, professor, aluno autorizado/não matriculado, inativo e anônimo; rascunho/versão antiga/objeto fora do manifesto; bucket privado sem leitura pública; emissão/expiração/renovação de assinaturas; preflight; upload parcial/duplicado; publicação/rollback/concorrência. Nenhuma conclusão de estudo durante homologação de produção; confirmar ausência de alterações nos registros reais de XP/progresso/atividades.
8. Registrar URLs reais e evidências sanitizadas. Somente então iniciar inventário da Aula 02, identificar UUID/key exatos de slides, validar ZIP aprovado, apresentar proposta concreta e aguardar autorização SEPARADA para publicar/vincular. Não reimportar JSON administrativo.

## Recuperação

- Migration falhou: a transação deve reverter; conferir ausência de objetos/registro parcial antes de repetir. Não marcar versão como aplicada se o SQL falhou.
- Edge falhou: não promover frontend; corrigir/reimplantar somente essa função. Não registrar versão após upload incompleto; conferir órfãos privados antes de qualquer limpeza aprovada.
- Frontend/homologação falhou: não promover ou voltar ao deployment anterior identificado na Vercel. Preservar infraestrutura aditiva e auditoria; o frontend anterior não depende dela. Não remover bucket/tabelas com registros.
- Versão de apresentação falhou: reativar versão anterior mediante confirmação; não apagar histórico. Aula 02 continua intocada durante esta etapa.
- Corrupção não prevista: suspender operação e preparar recuperação específica a partir do backup validado. Não restaurar o banco inteiro indiscriminadamente sobre alterações legítimas recentes.

## Evidência local desta auditoria

Reexecutados os 5 testes de pacote/gerenciador: 5 passaram, 0 falhas. Aplicam a migration e o handler reais em PostgreSQL isolado com transporte simulado de Auth/Storage. Os testes de navegador/build/Deno documentados em `docs/importador-apresentacoes-web.md` são da implementação anterior; não foram reexecutados nesta auditoria. Nenhum teste de produção, deploy, importação, vínculo, push ou alteração de banco foi executado nesta etapa.
