# Ativação controlada do importador — 10/11/2026

## Autorização e escopo

A usuária autorizou expressamente somente a migration auditada e `import-web-presentation`, aceitando o risco de não existir backup com restauração comprovada. Nenhum backup foi gerado nesta etapa. Não houve importação, publicação, vínculo, alteração de frontend, push ou merge.

Destino confirmado: **codePlatform**, `gnyiyhnbpjhdgrhsevbh`, ACTIVE_HEALTHY, PostgreSQL 17.6.1.063.

## Operações concluídas

1. Confirmadas ausência prévia da migration, das quatro tabelas e do bucket; função também ausente. Os cinco helpers privados exigidos estavam presentes.
2. Revalidado o arquivo `supabase/migrations/20261031105202_managed_web_presentations.sql`: SHA-256 `650a1eb98bd2bf50ee4e299ddd38b783ede105b7797ef96a4f83fa1b2d49c765`.
3. Revalidado o pacote isolado `tmp/manager-finalprep-20261109/`: cinco fontes originais inalterados, imports relativos completos, deno.json e lockfile próprios, SDK 2.119.0. ZIPs apenas analisados localmente, nunca enviados.
4. Aplicado exclusivamente o SQL auditado via `apply_migration`, nome `managed_web_presentations`. Resultado: sucesso. Versão registrada pelo servidor: **20261110132305**.
5. Implantados somente os sete arquivos autorizados da função, preservando os caminhos. Resultado: **ACTIVE**, versão **1**, `verify_jwt: true`.

Identificador da função: `750b44a2-c766-4410-998f-af76fc069244`.

Hash do bundle retornado pela plataforma: `7255e12697530fd1c1f8f4621fafdff58f4067a6400a4e47f65150591f7efe25`.

Endpoint: https://gnyiyhnbpjhdgrhsevbh.supabase.co/functions/v1/import-web-presentation

O timestamp do arquivo auditado foi preservado, assim como seu conteúdo. O ledger registra a versão atribuída pelo conector. **Antes de qualquer futura sincronização geral de migrations, reconciliar esse mapeamento no release**, sem reaplicar o arquivo original nem fazer repair indiscriminado. Não foi executado db push ou migration up.

## Verificações aprovadas

- Quatro tabelas presentes: public.web_presentations, public.web_presentation_versions, public.web_presentation_links e private.web_presentation_events; todas com RLS habilitada.
- Sem SELECT anônimo nas tabelas novas e sem INSERT direto para authenticated. Políticas administrativas de leitura presentes.
- RPCs de estado, listagem, resolução, publicação e vínculo com EXECUTE autenticado e sem EXECUTE anônimo. Registro de versão restrito a service_role.
- Bucket `web-presentations` privado, limite de 5 MiB por arquivo e tipos MIME previstos. Sem política de escrita direta por cliente; leitura exige autorização da versão e caminho do manifesto. As políticas anteriores de catalog-icons continuam limitadas àquele bucket.
- Consulta `web_presentation_state` com contexto de administrador ativo e role authenticated: sucesso, apresentações vazias e atividades slides existentes preservadas. O erro de função ausente deixou de existir no banco.
- Consulta administrativa com identidade de aluno: acesso negado. Em transação read-only e role authenticated, aluno não recebe apresentações e `can_read_web_object` nega caminho sem autorização. Nenhum perfil foi criado ou modificado.
- HTTP OPTIONS da Edge: 200, CORS presente.
- HTTP POST sem autenticação: 401.
- HTTP POST com JWT inválido: 401.
- HTTP POST com chave anônima, sem usuário: 401. Essa chamada também exercitou o handler e seu acesso ao Auth, sem consumir ZIP.
- RPC por REST com chave anônima: 401 / SQLSTATE 42501, em vez do erro anterior de RPC inexistente.
- Leitura pelo endpoint público de Storage: negada, resposta 400/NoSuchBucket. Em conjunto com a configuração e as políticas, confirma que o bucket não foi publicado; não é ensaio de objeto real, pois não há arquivos nele.
- Demais funções mantiveram versões e hashes. Só `import-web-presentation` foi adicionada.
- Histórico tem uma única nova migration, `20261110132305_managed_web_presentations`; a anterior continua sendo `20261109194229_weekly_availability_intervals`.

## Preservação de dados

Contagens e fingerprints agregados de linhas completas foram comparados antes e depois: **idênticos nas oito tabelas monitoradas**. Não foram exportadas linhas nem credenciais.

| Tabela | Linhas antes/depois |
|---|---:|
| lessons | 18 |
| lesson_activities | 14 |
| student_progress | 7 |
| student_technology_progress | 0 |
| student_activity_progress | 8 |
| student_xp_events | 59 |
| xp_event_audit | 10 |
| xp_reward_rules | 15 |

Após as verificações: zero apresentações, versões, vínculos, eventos e arquivos no novo bucket. Não houve alteração inesperada detectada nessas verificações.

## Pendências e limites dos testes

- Conferência visual na sessão administrativa real: pendente, pois a automação do computador retornou conexão nativa indisponível. Não foi solicitado acesso a senhas ou tokens. O backend consumido pela tela foi verificado por consulta autenticada no banco, mas isso não equivale a login de navegador ou JWT real de administrador no HTTP.
- Não havia perfis de professor ativo ou inativo para verificar essas negativas sem criar/modificar contas. A guarda administrativa e os privilégios foram inspecionados; esses dois cenários permanecem pendentes.
- Upload, prévia de versão armazenada, emissão de URLs assinadas e negativa de acesso a rascunho real permanecem pendentes: importar ZIPs estava expressamente proibido nesta etapa.
- O advisor sinaliza RLS sem política em private.web_presentation_events: esperado pelo modelo auditado, que revoga acesso direto e permite registro pela função privilegiada. A descoberta GraphQL das três tabelas públicas autenticadas decorre do SELECT concedido; RLS administrativa permanece ativa. Não foram abertas permissões adicionais para silenciar avisos.
- Outros avisos do projeto, incluindo search_path de handle_new_user, exposição de metadados GraphQL e proteção de senhas vazadas desativada, não foram corrigidos nesta autorização restrita. Referências: [RLS sem política](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [descoberta GraphQL autenticada](https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed).
- Continua sem restauração de backup comprovada, risco aceito expressamente para esta instalação.

## Uso e próxima etapa

Plataforma: https://plataforma-ensino-chi.vercel.app

Recarregar a página e abrir Gestão do sistema → Conteúdo → Aula → Apresentações web. A instalação do backend está concluída e o painel pode ser usado para iniciar a importação assistida da Aula 02. Se a mensagem anterior persistir, registrar o erro atual antes de qualquer correção; não aplicar outras migrations.

O primeiro upload ainda será a homologação real do caminho completo. Usar somente **Salvar rascunho validado**, conferir a prévia, imagens, créditos e ausência de versão ativa/vínculo. Não publicar, vincular ou alterar o status da aula. Nenhum ZIP foi importado automaticamente por esta execução; qualquer upload pelo agente requer nova autorização.

## Recuperação em caso de problema

Nenhum rollback destrutivo foi executado ou prometido como seguro. Se surgir erro, interromper importações e recolher evidências sem modificar dados. Não apagar tabelas, bucket ou migration, nem substituir funções adicionais. Uma reversão estrutural exige análise concreta e autorização própria; o ensaio sintético anterior não substitui backup real.
