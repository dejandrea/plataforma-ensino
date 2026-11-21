# Implantação controlada E1a + E2a — pronta para autorização

> **Execução posterior autorizada:** E1a e E2a aplicadas e verificadas em produção. A Edge falhou no empacotamento por uma dependência omitida e a sequência foi interrompida antes do frontend. Estado, versões e correção local do pacote estão em [execucao-implantacao-e1a-e2a-20261120.md](execucao-implantacao-e1a-e2a-20261120.md). Não reaplicar as migrations na retomada.

20/11/2026. Preparação com operações remotas exclusivamente de leitura. Nenhum teste PostgreSQL repetido, alteração de código de produto, migration aplicada, push, merge ou deploy. A homologação de 20/11 permanece apta com ressalvas.

## Destino e estado confirmados

- Vercel: `plataforma-ensino`, projeto `prj_2vX60y3APQN45VaxtdvKHm7c89FT`, time `team_alD3VRmLVIi0J3OsRZr7N7sv` / `andrea-francas-projects`, Vite, Node 24.x.
- **Production Branch: `main`, confirmada pela usuária nesta conversa.** O conector omitiu o campo e a CLI está sem credenciais; não se atribui essa informação a uma leitura automática do painel. Não houve mudança de configuração.
- Domínio: `https://plataforma-ensino-chi.vercel.app`. Deployment servido e alvo de rollback: **`dpl_7G2T5EoP4LQrp3X4v3ABELSsmXA5`**, READY/production. Fonte publicada: branch `release/a02-reconciliation-20261112`, commit **`d2acc6f5c7455a62ec1e4ff916273b80df7640a6`**. Branch de origem do artefato e branch automática configurada são informações distintas.
- Frontend servido: extraído somente o host Supabase do asset público `assets/index-BuTsh51u.js`: **`https://gnyiyhnbpjhdgrhsevbh.supabase.co`**. Nenhuma chave impressa. Metadados Vercel confirmam `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para production, sem descriptografar valores.
- Supabase: **`codePlatform` / `gnyiyhnbpjhdgrhsevbh`**, ACTIVE_HEALTHY, us-west-2, PostgreSQL 17.6 (`17.6.1.063` na plataforma). Histórico: 52 migrations; última **`20261112035823_reconcile_a02_learning_content`**. E1a/E2a ausentes tanto no histórico quanto nos objetos dirigidos.
- `import-web-presentation` permanece ACTIVE v1 / JWT=true. `import-lesson-package` ausente. Bucket `web-presentations` privado, limite por objeto 5.242.880 bytes. Não se pretende recriar bucket, alterar políticas ou publicar arquivos.

Evidências locais em `test-results/implantacao-e1a-e2a-20261120/`: `preflight-remoto.json`, `funcoes-anteriores.json`, `manifest.json` e `manifest.sha256`. O snapshot contém somente definições/ACLs/owner/configuração dos três guards e do importador anterior, sem dados pessoais; **não é backup do banco**.

## Artefatos exatos e isolamento

Todos os caminhos abaixo são relativos ao checkout `tmp/editorial-e1a-20261112`. Cópias congeladas estão em `test-results/implantacao-e1a-e2a-20261120/{sql,edge,frontend}`.

| Arquivo | SHA-256 |
|---|---|
| `supabase/migrations/20261112220958_editorial_foundation.sql` | `8bab8c53d0f7b1f6648193fe318b2378b4c0c94c00b17a2af47ceac0c3da3fdf` |
| `supabase/migrations/20261115234003_unified_lesson_packages.sql` | `12c05d50527f36099b8a11cb5e3048d5d1100f70e9dd1f98bc960bf586bfff64` |
| `supabase/functions/import-lesson-package/index.ts` | `076c0d9c5c3ba6156152d81b335feaa7c3002e72978e114c2ed18cd2bf2b69ec` |
| `test-results/implantacao-e1a-e2a-20261120/manifest.json` | `9830e458d4d07431b0bf9384f3e82ec9425367cd2141dccf3eb2c0156afff9a0` |

O manifesto registra SHA-256 e tamanho de **308 arquivos frontend**, **13 arquivos Edge** e **2 migrations**. Frontend: base do commit publicado + seis arquivos modificados e sete adicionados, explicitamente relacionados no manifesto. Não inclui `.git`, `.env`, node_modules, testes, relatórios ou mudanças da árvore principal de agenda/avaliações. O código novo ainda não tem commit próprio: o commit acima identifica a base, e o hash do manifesto identifica a entrega exata. Não rotular a entrega modificada como se fosse o mesmo commit sem alterações.

**Entrega escolhida: API/conector Vercel autenticado, a partir dos arquivos congelados.** Após autorização, upload somente dos arquivos listados em `manifest.frontend` por SHA1/tamanho; `create_deployment` com `project`/`teamId` explícitos, `target=production`, sem `gitSource`, build `npm run build`, install `npm ci`, output `dist`, framework vite, Node 24.x; preservar o `vercel.json` congelado. Metadados: baseCommit, manifesto SHA-256 e `dirty=true`. Isso não usa push/merge/main nem busca HEAD remoto para montar a entrega. Rebuild remoto usa as variáveis production já existentes; o `dist` local sem configuração production não será enviado como artefato de produção.

Esse é um deploy direto de produção, não um preview promovido: ao ficar READY, a Vercel pode atribuir os domínios. A autorização solicitada inclui essa troca. Acompanhar o estado e confirmar alias/host Supabase imediatamente. Se o conector rejeitar o alvo, a lista de arquivos ou o build, interromper; não trocar para push, criar projeto ou alterar ambiente automaticamente. A ausência de login CLI não bloqueia a rota escolhida pelo conector.

## Dependências da nova Edge

Enviar os 13 arquivos listados em `manifest.edge`, preservando seus caminhos relativos: entrypoint e `deno.json`; `_shared/supabase.ts` e `_shared/prepare-web-presentation.ts`; parsers `lesson-package.js`, `package.js`, `zip.js`, `validate.js` e schema de apresentações; `learningContent.ts`, schemas learning v1/v2 e `src/types/learning.ts`.

Import map: `ajv` → `npm:ajv@6.14.0`. Helper existente usa `npm:@supabase/supabase-js@2`; não se fará upgrade/refatoração nesta implantação. `verify_jwt=true`, entrypoint `supabase/functions/import-lesson-package/index.ts`, import_map_path `supabase/functions/import-lesson-package/deno.json`. Dependências externas são resolvidas no bundle Edge, cujo resultado/versionamento será registrado. Não há lock Deno específico na função; não se afirma identidade byte a byte do SDK resolvido com a biblioteca instalada nos testes offline.

Usar somente variáveis padrão do runtime Supabase (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, ou os fallbacks existentes `SUPABASE_PUBLISHABLE_KEYS`/`SUPABASE_SECRET_KEYS`). Não criar, recuperar ou exibir segredos; nenhuma credencial service_role será enviada ao frontend. Dependências SQL: E1a/E2a, RPCs web legadas e bucket privado existente. **Implantar somente `import-lesson-package`; não reimplantar a Edge legada**, mesmo que exista extração compartilhada local.

## Sequência exata após autorização

Antes da etapa 1: janela sem alunos/sessões docentes e sem outras operações editoriais. Reconfirmar em leitura deployment, histórico remoto, definições dos guards e todos os hashes do manifesto. Divergência exige parada. Preservar o alvo de rollback e registrar o início. Não é nova homologação local.

1. **E1a:** `supabase.apply_migration`, projeto explícito `gnyiyhnbpjhdgrhsevbh`, nome `editorial_foundation`, query = conteúdo integral da cópia SQL com hash acima. Arquivo tem BEGIN/COMMIT e lock_timeout=5s. Uma migration por chamada, sem `db push`, `migration up` ou aplicação geral de pendências.
2. **Verificar E1a:** executar somente leitura de `verificar-e1a.sql`. Exigir cinco tabelas privadas com RLS e sem acesso anon/authenticated, quatro RPCs com owner/search_path esperados e EXECUTE apenas authenticated entre os papéis clientes; três backups de guards; zero permits. Confirmar guards/validador, ausência de efeitos parciais e registro efetivo no histórico. Registrar a versão que o executor realmente atribuir; não presumir que o timestamp do nome do arquivo será a versão gerada pelo conector.
3. **E2a:** mesma operação isolada, nome `unified_lesson_packages`, arquivo e hash acima. Nunca executar E2a se E1a ou sua verificação falhar.
4. **Verificar E2a:** leitura de `verificar-e2a.sql`. Exigir cinco tabelas privadas protegidas, três RPCs administrativas para authenticated e quatro RPCs de preparação para service_role, sem EXECUTE anon; triggers `lesson_package_%` habilitados; zero permits; histórico coerente. Conferir que a Edge e os importadores legados permanecem na versão anterior até a próxima etapa.
5. **Nova Edge:** `deploy_edge_function` com name `import-lesson-package`, projeto explícito, JWT=true e somente `manifest.edge`. Conferir status ACTIVE, nome, versão, entrypoint/import map e JWT; uma requisição sem credenciais deve ser recusada. Falha impede frontend. Não importar ZIP nesta etapa.
6. **Frontend isolado:** upload/deploy pelo conector conforme a seção de artefatos. Confirmar projeto/time/production, READY e aliases; verificar que o frontend servido aponta para o mesmo projeto Supabase e contém os novos módulos. Preservar o deployment anterior para rollback imediato. Nenhum commit/push/merge é necessário para essa rota.
7. **Leitura/autenticação administrativa:** usando sessão da administradora, abrir gestão/editor/importador e consultar estado, sem salvar, criar kit ou publicar; confirmar que anônimo e perfil sem privilégio não obtêm acesso editorial. Não coletar respostas ou dados reais de alunos. Login manual pode ser necessário se não houver sessão disponível.
8. **Primeiro pacote controlado:** verificar arquivo local, contrato e destino; escolher aula vazia e pacote explicitamente aprovados. **Parar antes de criar kit, preparar rascunho, enviar ZIP ou publicar em conteúdo real até autorização específica de aula/pacote.** `create_lesson_package_kit` já grava metadados, portanto não pertence ao smoke test de leitura. Publicação pedagógica exige revisão/confirmação específica, além do deploy técnico.

## Recuperação objetiva

| Falha | Ação dirigida |
|---|---|
| Migration antes de COMMIT | Interromper; erro deve reverter a transação daquela migration. Consultar objetos e histórico antes de repetir. E1a concluída não é revertida automaticamente por falha da E2a. |
| Conexão perdida ou resultado de COMMIT incerto | Não reaplicar cegamente. Conferir objetos, definições/ACLs e histórico. DDL e registro do executor podem ter comportamento próprio; não prometer atomicidade entre ambos sem comprovação. Objeto sem histórico, histórico sem objeto ou hash divergente bloqueiam a sequência. |
| Edge nova falha | Manter frontend anterior; migrations já commitadas permanecem. Não tocar na Edge web legada. Se a nova estiver ativa com problema, drenar chamadas e aplicar desativação dirigida abaixo antes de tentar correção/redeploy. |
| Frontend falha | Se build falhar, conferir que alias anterior continua servido. Se novo deployment ficou ativo com erro, `request_rollback` para `dpl_7G2T5EoP4LQrp3X4v3ABELSsmXA5`, mesmo projeto/time; confirmar domínio. Isso retorna aplicação, **não reverte SQL** nem apaga rascunhos/reservas. Conferir estado de autoassignment depois de rollback; não alterar Git automaticamente. |
| Importação interrompida | Preservar operationId, mesmo ZIP, productionId, hashes, arquivos privados e intents. Consultar `lesson_package_state`; retomar o mesmo ZIP em preparing, revisar ready, conferir receipt em published. Não usar productionId diferente para contornar conflitos. Não apagar reservas/arquivos nem forjar permits. Publicação SQL que falha deve reverter atividades/vínculos; uploads Storage ficam privados e fora dessa transação. |
| Desativar E2a após implantação | Drenar chamadas; executar **somente se necessário e autorizado** `desativar-pacotes.sql`. Revoga criação/publicação e as quatro RPCs de preparação; mantém consulta de estado e todas as tabelas, triggers, reservas e arquivos. Voltar frontend anterior se necessário. Revogação não cancela chamada que já começou; não prometer bloqueio instantâneo de uploads em andamento. Não remover guards para liberar aula reservada. |

Se for necessário desativar também E1a, revogar EXECUTE das RPCs de escrita `save_editorial_draft(uuid,jsonb,text,integer,boolean)` e `publish_editorial_draft(uuid,text,integer,boolean)` dos papéis clientes, preservando as leituras e a auditoria. Restauração dos três guards e do importador anterior só a partir das definições/ACLs capturadas, após drenar escrita e conferir dependências. Manter helpers/tabelas E1a/E2a e histórico; **sem DROP CASCADE**, sem remoção de eventos, sem reversão cega de conteúdo publicado que já tenha uso. Esse procedimento é desativação dirigida, não uma down migration automática.

**Três mecanismos distintos:** rollback de aplicação troca frontend/Edge; reversão transacional desfaz SQL ainda não commitado; restauração de banco recupera backup/PITR do conjunto e exige planejamento próprio. Nenhum dos dois primeiros comprova o terceiro.

**Risco residual aceito deve ser explícito:** não existe restauração de backup de produção comprovada nesta preparação. Depois de COMMIT não há garantia demonstrada de recuperação integral, RPO/RTO ou ausência de perda. Uma restauração ampla pode perder alterações legítimas de alunos posteriores ao ponto recuperado e não sincroniza automaticamente arquivos Storage. O snapshot de quatro funções não recupera dados, histórico pedagógico ou objetos externos. Os testes locais de rollback e retomada não eliminam esse risco.

## Critério de parada e pedido final

Parar imediatamente em hash/destino/versão divergente, lock timeout/deadlock, erro de migration, ACL/RLS/guard inesperado, registro de migration incoerente, JWT desabilitado, Edge inativa, build/deploy com falha, alias incorreto, autenticação administrativa falhando ou qualquer alteração inesperada fora do escopo. Não seguir para o próximo passo nem ampliar escopo para contornar. Preservar evidências; executar somente a recuperação dirigida aplicável à fase já concluída.

Ressalva de disponibilidade: publicação do documento de 200 atividades levou 19,94s localmente, com locks globais; cinco segundos de lock_timeout não são limite de duração da operação. Publicações futuras devem ocorrer na janela acordada.

**Solicitar autorização explícita para executar as etapas 1–7 com estes destinos/artefatos, incluindo troca do domínio para o novo frontend e recuperação dirigida se houver falha.** A autorização não inclui importar/publicar conteúdo real na etapa 8, modificar dados de alunos, push/merge ou aplicar outras migrations. Até recebê-la, nenhuma operação remota de escrita será realizada.
