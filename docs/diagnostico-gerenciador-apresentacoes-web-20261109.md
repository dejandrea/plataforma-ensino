# Gerenciador de apresentações web: diagnóstico e plano de ativação

Data: 09/11/2026, America/Bahia. Escopo: leitura do ambiente real, revisão do código existente e testes locais isolados. **Nenhuma migration, implantação, push, merge, importação ou alteração de dados de produção foi executada.** Nenhum outro importador foi desenvolvido.

## 1. Causa comprovada

A interface publicada está correta e conectada ao projeto correto, mas o backend específico do gerenciador não foi instalado.

Em `src/lib/webPresentations.ts`, `fetchPresentationState()` chama `web_presentation_state(p_lesson_id)`. `readError()` traduz qualquer erro `PGRST202`, `42883` ou `42P01` para a mensagem informada pela usuária. Essa condição não verifica a Edge Function e, isoladamente, não distinguiria função SQL ausente de cache desatualizado ou tabela interna ausente.

A verificação atual foi além da mensagem:

- A RPC publicada respondeu **HTTP 404 / PGRST202**, função `public.web_presentation_state(p_lesson_id)` não encontrada no cache.
- A consulta direta ao catálogo PostgreSQL confirmou que essa função e todas as demais funções do gerenciador estão ausentes. Não é apenas cache.
- As três tabelas públicas, a tabela de auditoria privada, os índices/sequência correspondentes e as políticas do gerenciador não existem.
- A migration não consta do histórico aplicado, nem pelo nome `managed_web_presentations`, nem pela versão `20261031105202`.
- O bucket `web-presentations` não existe.
- `import-web-presentation` não consta da lista de Edge Functions; seu preflight HTTP respondeu 404. O `Access-Control-Allow-Origin: *` dessa resposta de gateway não comprova funcionamento do handler.

Portanto, a causa é a **ausência confirmada da migration e da Edge Function**, com seus objetos associados. Não há evidência de URL Supabase incorreta ou de falha de permissão como origem dessa mensagem específica.

## 2. Ambiente e frontend realmente utilizados

| Item | Evidência atual |
| --- | --- |
| Domínio | `https://plataforma-ensino-chi.vercel.app` |
| Vercel | Projeto `plataforma-ensino`, `prj_2vX60y3APQN45VaxtdvKHm7c89FT`, equipe `andrea-francas-projects` |
| Deployment publicado | `dpl_5NJw19qDcp3CBnMK6gRVkCKCxBcx`, READY, production, origem Git |
| Commit/branch | `617a6dbbf990c325793c57f712cacf2308056246`, `main` |
| JavaScript servido | `/assets/index-Cy-Ww4AC.js`, HTTP 200 |
| Supabase compilado nesse JavaScript | `https://gnyiyhnbpjhdgrhsevbh.supabase.co` |
| Projeto correspondente | `codePlatform`, ref `gnyiyhnbpjhdgrhsevbh`, ACTIVE_HEALTHY, região `us-west-2`, PostgreSQL 17.6 |

A URL de destino foi extraída do bundle efetivamente servido, em vez de presumida a partir do `.env` local. A credencial pública `anon` foi utilizada somente em memória para testar a RPC de leitura, sem imprimi-la ou gravá-la. Não foram utilizadas credenciais de alunos.

Também responderam HTTP 200, com tipos coerentes:

- `/apresentacoes/package.js` e `/apresentacoes/viewer.js`: JavaScript.
- `/apresentacoes/presentation.schema.json` e `/biblioteca-bitara/catalog.json`: JSON.
- `/apresentacoes/gerenciada/00000000-0000-4000-8000-000000000001`: HTML da SPA. O código compilado contém a rota `/apresentacoes/gerenciada/:id`; HTTP 200 sozinho não comprovaria a autorização da rota.

No código, `TabContent` abre o gerenciador para a aula selecionada; `App.tsx` protege a rota gerenciada para admin/aluno. O viewer existente é reutilizado por iframe com conferência de origem, janela e nonce.

**Não é necessário publicar outro frontend para remover o bloqueio atual.** O painel já está em produção. As alterações locais pendentes de agenda, avaliação e relatórios não devem ser enviadas junto com esta ativação.

## 3. Migration única e dependências

Arquivo: `supabase/migrations/20261031105202_managed_web_presentations.sql`.

SHA-256 atual: `650a1eb98bd2bf50ee4e299ddd38b783ede105b7797ef96a4f83fa1b2d49c765`.

Ela é aditiva, transacional (`BEGIN`/`COMMIT`), possui `lock_timeout='5s'` e cria:

| Objeto | Situação atual / função |
| --- | --- |
| `public.web_presentations` | Ausente; apresentação e ponteiro da versão ativa |
| `public.web_presentation_versions` | Ausente; versões e manifestos imutáveis |
| `public.web_presentation_links` | Ausente; vínculo auxiliar com atividade existente |
| `private.web_presentation_events` | Ausente; auditoria imutável |
| RPCs de estado, registro, publicação, vínculo, resolução e overlay | Ausentes |
| Bucket e política de leitura privada | Ausentes |

Pré-requisitos **comprovados no catálogo atual**, com assinaturas compatíveis:

```text
private.learning_role()
private.learning_reject_history_change()
private.learning_require_student_lesson(uuid)
private.learning_can_read_activity(uuid)
private.learning_prerequisites_complete(uuid,uuid)
```

Também existem `private`, `auth.uid()`, `gen_random_uuid()`, as colunas exigidas de `profiles`, `lessons`, `lesson_activities` e `storage.objects` (incluindo `metadata jsonb`). Os papéis `authenticated` e `service_role` têm o uso necessário dos schemas; `service_role` tem bypass de RLS, esperado exclusivamente no servidor. Não há colisões com os nomes dos novos objetos/funções.

**A migration pode ser aplicada isoladamente do ponto de vista técnico.** Não precisa de migrations pendentes de disponibilidade semanal ou de outros trabalhos. O ensaio local aplicou as definições atuais dos cinco helpers ao banco sintético antes de executar somente a migration do gerenciador.

Não usar `db push`, `migration up` geral, `--include-all` ou repair de migrations antigas. Se a ferramenta de aplicação atribuir timestamp novo, registrar o mapeamento entre esse arquivo/hash e a versão retornada, e alinhar o arquivo do release antes de qualquer envio futuro. Não inserir registros manualmente no histórico nem presumir que o timestamp histórico será preservado pelo conector.

## 4. Segurança revisada

- **Administração:** `private.learning_role()` consulta `profiles.role` e `is_active`; não usa metadata editável do JWT. As RPCs administrativas exigem admin ativo e `auth.uid()`. O registro é exclusivo de `service_role` e revalida o administrador informado pelo handler autenticado.
- **SQL privilegiado:** wrappers públicos são `SECURITY INVOKER`; implementações privadas privilegiadas fixam `search_path=''`, qualificam os objetos e fazem a autorização. Os novos privilégios PUBLIC/anon são revogados. Não há INSERT/UPDATE/DELETE direto do cliente nas tabelas do gerenciador.
- **RLS:** ativada nas quatro tabelas. Inventário e versões são legíveis apenas pelo administrador; alunos resolvem somente versão ativa vinculada a slides publicados, com acesso à aula, atividade e pré-requisitos satisfeitos. Conta inativa, professor, aluno externo e anônimo não recebem acesso ao rascunho.
- **Storage:** novo bucket privado, separado de `catalog-icons`, com limite de 5 MB por objeto e MIME permitido. As políticas atuais do Storage foram consultadas integralmente: leitura pública e upload administrativo existentes estão restritos a `catalog-icons`; não abrem o novo bucket por uma política genérica. Não será criada política de upload, alteração ou exclusão para clientes no novo bucket.
- **Manifesto:** leitura somente de caminhos efetivamente registrados na versão; sem autorização por prefixo genérico. Upload imutável (`upsert:false`) pelo servidor após validação do ZIP; publicação e vínculo não acontecem no upload.
- **Versões:** FKs compostas impedem ativar versão de outra apresentação; hash/pacote e número de versão têm unicidade; publicação, reversão e vínculo verificam o ponteiro esperado para detectar concorrência. O histórico é imutável.
- **Atividades/XP:** vínculo em tabela auxiliar, sem reimportar JSON nem atualizar `lesson_activities`, revisão, UUID, key, obrigatoriedade, status da aula, progresso ou recibos XP. A confirmação de estudo continua na aula com a regra existente `activity_study`.
- **Auth/Edge:** handler usa `auth.getUser()`, verifica admin ativo antes de consumir o ZIP e valida aula/apresentação. Implantar com verificação JWT habilitada. Chaves de serviço permanecem no ambiente da função; não devem ser copiadas para o cliente.
- **CORS:** POST/OPTIONS e headers de identificação explicitados, origem `*` com Bearer, sem autenticação por cookies. CORS não é mecanismo de autorização. Testar preflight, 401/403 e negativos reais após instalação.
- **Assinaturas:** arquivos recebem URLs assinadas por 300 segundos. A rota gerenciada renova a resolução a cada 120 segundos. URLs já emitidas podem continuar válidas até expirar após revogação; novas emissões devem ser negadas imediatamente. A prévia administrativa salva pode precisar ser reaberta após expiração.

O advisor consultado também apontou avisos preexistentes fora deste recurso, como search_path de `handle_new_user`, descoberta de objetos no GraphQL e proteção de senha vazada desabilitada. Não foram classificados como vazamento comprovado nem como causa do erro do gerenciador; não foram alterados nesta tarefa. Referências: [search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [objetos GraphQL](https://supabase.com/docs/guides/database/database-linter?lint=0026_pg_graphql_anon_table_exposed), [proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## 5. Recuperação: comprovado e pendente

Consulta atual, somente leitura:

```text
npx.cmd --yes supabase@2.122.0 backups list --project-ref gnyiyhnbpjhdgrhsevbh -o json
```

Resposta: `backups:null`, `physical_backup_data:{}`, `pitr_enabled:false`, `walg_enabled:true`. **Não há ponto de restauração utilizável comprovado nessa resposta. WAL-G habilitado não prova retenção acessível ou restauração possível.**

O plano anterior em `plano-backup-recuperacao-20261101.md` não contém um ensaio concluído de restauração de produção. Não foi retomada a configuração de backup/infraestrutura, não houve exportação e nenhum dado real foi restaurado nesta auditoria. Backups do banco também não substituem os binários do Storage, conforme a [documentação oficial](https://supabase.com/docs/guides/platform/backups).

Recuperação limitada desta extensão, ensaiada localmente:

1. **Antes do commit SQL:** executar a migration e ROLLBACK no PostgreSQL isolado. O fingerprint de objetos, funções, buckets, atividades, progresso e XP sintéticos voltou exatamente ao baseline. Isso comprova a reversão transacional do ensaio, não um backup de produção.
2. **Após instalar, sem importar/vincular:** se a Edge Function ou homologação falhar, interromper a ativação. Desabilitar/remover somente a nova função, se autorizado, ou manter o gerenciador sem uso. Preservar tabelas/bucket novos; o frontend já publicado e as atividades antigas continuam funcionando sem vínculos.
3. **Após rascunho:** manter arquivos/versionamento privados, sem publicar nem vincular. Uma falha de upload tenta limpar os objetos criados, mas falhas de limpeza podem deixar órfãos privados; qualquer limpeza deverá ser inventariada e autorizada.
4. **Depois de publicação autorizada:** usar a reversão explícita da versão ativa, preservando histórico e vínculos. Não remover tabelas/bucket em uso. Para o primeiro vínculo real, apresentar e guardar a referência anterior e o procedimento concreto de retorno antes de confirmar; não há operação pública de desvinculação implementada no contrato atual. Essa limitação não impede salvar rascunhos, mas deve ser resolvida no plano de recuperação antes do primeiro vínculo real.
5. **Corrupção fora do escopo aditivo:** interromper operações e preparar recuperação específica a partir de backup comprovado; nunca restaurar indiscriminadamente o banco inteiro sobre alterações recentes.

**A compatibilidade técnica está comprovada, mas a recuperação integral de produção continua pendente. Não classificar a ativação como plenamente pronta para execução enquanto essa proteção não estiver comprovada/aprovada.** O ensaio de rollback e um arquivo SQL não substituem essa evidência.

## 6. Plano de ativação para autorização posterior

### A. Gates antes de escrever em produção

1. Aprovar/comprovar recuperação adequada e revalidar o inventário imediatamente antes da mudança.
2. Confirmar projeto `gnyiyhnbpjhdgrhsevbh`, ausência de colisões, hash do SQL e autorização explícita para a migration e a função. Registrar baseline sem exportar dados privados: nesta leitura havia 18 aulas, 14 atividades, 8 registros de progresso, 59 eventos XP e 7 objetos Storage.
3. Não enviar a `main` ou publicar o frontend: já contém o gerenciador e o checkout possui outros trabalhos pendentes fora deste escopo.

### B. Instalação mínima

1. Operação de migration: `apply_migration`, projeto `gnyiyhnbpjhdgrhsevbh`, nome `managed_web_presentations`, SQL lido exclusivamente do arquivo/hash auditado. Conferir o registro retornado e os objetos criados. O SQL inclui reload do cache PostgREST.
2. Implantar **somente** `import-web-presentation`, com JWT verificado. Alternativa CLI a confirmar por `functions deploy --help` antes do uso:

```text
npx.cmd supabase functions deploy import-web-presentation --project-ref gnyiyhnbpjhdgrhsevbh
```

3. Conferir o bundle: entrypoint, `supabase/functions/_shared/supabase.ts`, `public/apresentacoes/package.js`, `public/apresentacoes/validate.js` e `public/apresentacoes/presentation.schema.json`, além do lock efetivamente utilizado. Os imports fora de `functions/` precisam integrar o pacote. Não copiar decks reais ou toda a biblioteca para o código da Edge Function. Não implantar outras funções.
4. Verificar presença de variáveis padrão de servidor por funcionamento, sem exibir os valores: URL Supabase, chave pública/anon e chave de serviço/secret. Conferir metadata do deploy, autenticação, CORS e log sanitizado.

### C. Homologação

1. **Ambiente isolado:** executar o fluxo completo de admin ativo, upload mínimo, prévia, rascunho, publicação, nova versão, reversão e vínculo a atividade sintética existente. Testar aluno autorizado, externo, inativo, professor, anônimo, módulo bloqueado, versão antiga e objeto fora do manifesto. Não confirmar estudo em produção.
2. **Transporte real:** homologar Auth/Storage/Edge e renovação/expiração das assinaturas num ambiente isolado apropriado. Provisionamento de ambiente/contas, se necessário, exige autorização própria; não contratar serviços ou criar currículo sintético em produção para contornar a restrição.
3. **Produção, após autorização:** `web_presentation_state` com admin ativo deve retornar lista/atividades, sem erro de preparação; usuário sem permissão deve ser negado. Conferir bucket privado e ausência de leitura/upload indevidos.
4. Importar ZIP mínimo somente como rascunho privado na aula de teste existente que for expressamente aprovada. Sem aula de teste autorizada, não criar uma atividade real: manter esse caso no ambiente isolado.
5. Para a Aula 02, validar novamente o hash do ZIP aprovado e, se houver autorização para esse upload, salvar e abrir a prévia **como rascunho privado**. Não publicar versão, alterar o status da aula ou vincular atividade automaticamente.
6. A publicação e o vínculo real da Aula 02 permanecem uma autorização separada, após apresentar apresentação/versão e atividade UUID/key de destino. A validação do fluxo completo de publicação/vínculo neste plano usa o ambiente isolado; não depende de modificar currículo real.
7. Conferir baseline e registrar evidências de autenticação, RLS, Storage, URLs assinadas, manutenção de UUIDs/keys e ausência de mudanças de XP/progresso. Nenhum importador novo ou reimportação integral da aula.

## 7. Aula 02 e pacotes

Leitura atual da aula `b17a2000-0000-4000-8000-000000001002`, “Grandes Nomes da Tecnologia”: status **planned**, seis atividades ativas/publicadas, revisão 1. A aula não foi liberada nesta tarefa.

Existem **duas** atividades `slides`; não escolher silenciosamente uma delas:

| Key | UUID |
| --- | --- |
| `a02-v2-arquivos-secretos` | `10be647a-1b53-4d99-8d3e-cdb0cc95dda0` |
| `a02-v2-novas-pistas` | `d475a78e-b5c1-4e56-84d9-75a189b0aa70` |

Os outros tipos são dois `interactive`, um `mindmap` e um `quiz`. Não foram encontrados vídeo ou flashcards nessa aula; não criá-los para adequar o pacote. Permanecem as pendências editoriais já descritas no contrato Work sobre referências a páginas do material antigo e menções a flashcards. Validade técnica do ZIP não equivale a aprovação do vínculo pedagógico.

Pacotes validados novamente com o parser existente, sem upload:

| Pacote local | Resultado | Hash canônico do pacote |
| --- | --- | --- |
| `docs/examples/work-bitaria-minimo.zip` | Válido, 1 slide, 2 arquivos, nenhum aviso | `68f307ff879949b226f7ad2ac3e26b7f43f34243a844346db54aae3088bd024a` |
| `tmp/work-bitaria-contract/html-m01-s01-a02-importacao.zip` | Válido, 15 slides, 8 arquivos, seis imagens, nenhum aviso | `01f753f997ec50de3e49fe4274302af0c026a64716e6739afa3699e0e946b5b5` |

## 8. Testes e evidências desta auditoria

| Verificação executada | Resultado |
| --- | --- |
| `npm.cmd run test:presentation-manager` | 5 testes aprovados |
| `npm.cmd run test:presentation-manager:browser` | 1 cenário aprovado; prévia, rascunho, publicação, atualização, reversão, vínculo e acesso de aluno sem XP automático |
| Dois ZIPs reais pelo validador local | Ambos válidos |
| Deno check do importador, parser e schema | Aprovado; configuração temporária independente |
| Migration isolada com cinco helpers atuais | Aplicação bem-sucedida, quatro tabelas, RPC e bucket privado |
| ROLLBACK da mesma migration em banco sintético | Fingerprint do baseline restaurado |
| HTTP publicado + catálogo remoto + lista de funções | Backend ausente comprovado; frontend/URL corretos |

Os testes usam migration/handler reais com Auth e transporte Storage simulados e dados sintéticos. Eles não comprovam, sozinhos, o transporte HTTP real do Supabase. A checagem de tipos não equivale a bundle implantado.

Evidências temporárias sanitizadas em `tmp/manager-audit-20261109/`: `runtime.json`, `migration-rehearsal.json`, definições dos cinco helpers (sem dados pessoais), configuração Deno e script do ensaio. Nenhum ZIP real foi enviado ao Supabase e nenhuma credencial privada foi exposta; a RPC de diagnóstico usou apenas a chave pública anon já presente no frontend. Não foi necessário alterar arquivos da aplicação nem reexecutar build: esta etapa é uma auditoria, e o bundle publicado foi consultado diretamente.

**Conclusão:** plano técnico mínimo pronto e migration isolada compatível. Continuam pendentes a comprovação de recuperação, a homologação do transporte real em ambiente apropriado e as autorizações explícitas de instalação/importação. Não há autorização presumida para publicar ou vincular a Aula 02.
