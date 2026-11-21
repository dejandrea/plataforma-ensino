# Decisão de implantação E1a + E2a

> **Atualização de 20/11/2026:** homologação local integrada concluída, **apta com ressalvas**. A decisão vigente, os resultados PostgreSQL reais e hashes finais estão em [decisao-implantacao-e1a-e2a-20261120.md](decisao-implantacao-e1a-e2a-20261120.md). O conteúdo abaixo é histórico; seus bloqueios de RAM/homologação/UTF-8 foram superados e seu hash E1a antigo não deve ser utilizado.

17/11/2026 — **Não apta para implantação nesta rodada.** Código local preservado; nenhuma escrita remota, inicialização PostgreSQL, instalação, commit, push, merge ou deploy.

**Retomada após reinicialização:** primeira leitura WMI: 7,84 GiB totais / 2,29 GiB disponíveis e nenhum processo PostgreSQL. O registro `evidencias/preparacao-20261115.json` foi lido, sem novo download. Porém, no preflight imediatamente anterior à inicialização, restavam somente 573.997.056 bytes (0,53 GiB). A automação recusou iniciar; não criou cluster, não executou migrations locais nem testes SQL e não precisou desligar servidor. A tentativa anterior de executar o script PowerShell foi bloqueada pela ExecutionPolicy; nenhuma política foi alterada. Interrompido sem novas tentativas e sem encerrar aplicativos.

Evidência preservada fora do Git: `D:\Documentos\Bitaria\HomologacaoEditorial\evidencias\homologacao-integrada-2026-11-17T21-08-16-032Z.json`. A automação local em `scripts/editorial-native-homologation.mjs` e seu adaptador de conexões psql estão preparados, **ainda não homologados**; não são evidência de aprovação dos cenários A–F.

Correção local restrita ao limite UTF-8: editor conta bytes, validador compartilhado mede representação normalizada com separadores JSONB, e os dois limites SQL E1a usam `octet_length`, mantendo o valor de 2.000.000. **Ainda não validada em PostgreSQL ou build após essa alteração**, devido à interrupção por memória. Novo SHA-256 E1a: `8bab8c53d0f7b1f6648193fe318b2378b4c0c94c00b17a2af47ceac0c3da3fdf`. E2a inalterada: `12c05d50527f36099b8a11cb5e3048d5d1100f70e9dd1f98bc960bf586bfff64`. Os hashes e a descrição anteriores abaixo são o registro do preflight antes dessa correção, não os hashes para uma futura implantação. Nenhuma autorização de implantação deve usar o hash E1a antigo.

## Preflight realizado

- Supabase `codePlatform`, `gnyiyhnbpjhdgrhsevbh`, ACTIVE_HEALTHY, PostgreSQL `17.6.1.063`.
- Histórico remoto termina em `20261112035823_reconcile_a02_learning_content`. E1a/E2a ausentes, sem tabelas editoriais/de operações encontradas.
- Vercel acessível pelo conector: projeto `prj_2vX60y3APQN45VaxtdvKHm7c89FT`, equipe `andrea-francas-projects`. Produção READY: `dpl_7G2T5EoP4LQrp3X4v3ABELSsmXA5`; domínio https://plataforma-ensino-chi.vercel.app.
- Commit publicado `d2acc6f5c7455a62ec1e4ff916273b80df7640a6`, branch de origem `release/a02-reconciliation-20261112`: coincide com a base do checkout E1a/E2a. Isso não comprova a branch configurada para deploy automático.
- Conector não retornou regras Git/Production nem valores/configuração de ambiente Supabase do frontend. Tentativa GET pela CLI Vercel encontrou ausência de credenciais. Não foi feito login, não foram recuperados segredos, não se presume que push seja inofensivo. Branch automática e destino do frontend continuam pendentes de confirmação.
- Bucket `web-presentations` privado, limite de arquivo 5.242.880 bytes; política SELECT para authenticated condicionada a `private.can_read_web_object(name)`. Tabelas públicas de apresentações, aulas, atividades e gabaritos consultadas com RLS habilitada.
- Edge legada `import-web-presentation` ACTIVE, versão 1, `verify_jwt=true`. Nova `import-lesson-package` não implantada; configuração local exige JWT. Não foi alterada a função legada.
- Os 17 objetos relacionais consultados (currículo, atividades, gabaritos, planos, histórico, flashcards e apresentações) existem. Helpers `private.learning_role()`, `private.web_presentation_admin()`, validação de recompensas/interações e exceção A02 existem. Os três marcadores exatos que a E1a substitui nos guards estão presentes nas definições remotas. Isso é conferência dirigida, não homologação completa das dependências/ACLs.
- Inspeção restrita a catálogos, definições, permissões e metadados; nenhuma resposta, identificação pessoal ou conteúdo de aluno foi consultado.
- Checkout `tmp/editorial-e1a-20261112`, branch `feature/editorial-e1a`, conserva mudanças staged/unstaged e arquivos novos ainda sem commit. Árvore principal tem pendências de agenda/relatórios/avaliações e não foi modificada. Whitespace dos diffs staged e unstaged passou.

## Bloqueios reais e menor ação

1. **RAM disponível: 0,78 GiB de 7,84 GiB.** Não iniciar PostgreSQL nem repetir tentativas. Liberar memória fechando aplicativos manualmente, medir novamente e reutilizar os binários portáteis existentes. Não é necessária nova instalação/contratação. Aplicar o preflight do procedimento portátil antes de iniciar.
2. **Homologação real pendente:** concorrência A–F, ACLs efetivas e permissões transitórias em conexões independentes, fluxo integrado e capacidade representativa no runtime aplicável. Não há tempos naturais de publicação ou de retenção de locks medidos. Os 144 testes integrados, 26 E2a e teste de navegador anteriores são evidências locais reutilizadas; não foram repetidos nem declarados equivalentes a PostgreSQL real/Supabase Edge.
3. **Bytes UTF-8 ainda inconsistentes:** E1a SQL usa `length(jsonb::text)`, editor usa comprimento JavaScript e upload/ZIP usa bytes. Antes da liberação, implementar/verificar uma regra comum de bytes, incluindo JSON normalizado e Unicode, em cliente/servidor. Se necessário, adotar teto operacional menor após medir o pacote representativo. Nesta rodada não se alterou limite ou hash silenciosamente. Não há teto máximo de capacidade comprovado.
4. **Git/Production Vercel e ambiente frontend:** confirmar em Settings → Git e Environments/Production ou autenticar a CLI localmente (sem enviar token pelo chat). A sessão do conector funciona; a CLI tem autenticação independente. Não fazer push para descobrir o comportamento.
5. **Recuperação de produção não comprovada.** Não se interpreta aceitação anterior como autorização para E1a/E2a.

Não houve correção de código nesta rodada: com a homologação bloqueada por recursos, não se iniciou uma nova rodada exploratória. Tampouco se conclui compatibilidade integral a partir apenas dos marcadores dos guards.

## Migrations preservadas

| Ordem | Arquivo | SHA-256 |
|---|---|---|
| 1 | `20261112220958_editorial_foundation.sql` | `a990cf305c7d19cec5e8fc23dd7b21545bfd80d3f45ead8aa5fc54c1f3c5c301` |
| 2 | `20261115234003_unified_lesson_packages.sql` | `12c05d50527f36099b8a11cb5e3048d5d1100f70e9dd1f98bc960bf586bfff64` |

Ambas contêm BEGIN/COMMIT e lock_timeout de cinco segundos. Criam objetos sem excluir conteúdos, mas **não são exclusivamente aditivas no comportamento**: E1a substitui `private.learning_import_lesson` e acrescenta exceções restritas aos três guards existentes, preservando suas definições em tabela privada. E2a acrescenta triggers de reserva em atividades, rascunhos e apresentações. Ensaiar falha transacional e preservação dos fluxos antigos antes de liberar. Correção futura dos bytes exigirá novo hash e revisão antes da autorização.

## Sequência após resolver os bloqueios e obter autorização específica

1. Homologar localmente E1a+E2a juntas, com dados sintéticos, conexões independentes e pacote representativo; ajustar somente os bloqueios comprovados, registrando hashes finais.
2. Confirmar Git/Production, destino Supabase do frontend e revisar release isolado; repetir preflight de leitura imediatamente antes de escrever.
3. Apresentar decisão técnica atualizada e solicitar autorização com risco de recuperação explícito.
4. Aplicar somente E1a transacionalmente; verificar objetos/ACLs/guards/RLS e versão registrada. Interromper em falha.
5. Aplicar somente E2a transacionalmente; verificar reservas/ACLs/RPCs e versão registrada. Não usar db push/migration up geral.
6. Implantar somente `import-lesson-package`, JWT habilitado, com dependências empacotadas. Preservar a Edge web legada.
7. Publicar frontend isolado E1a/E2a pelo mecanismo aprovado, após confirmar regras automáticas. Não incluir pendências da árvore principal.
8. Testar administração/autorização, rascunho privado, retomada e importadores antigos; usar publicação sintética somente em ambiente isolado. Uso pedagógico real exige revisão administrativa explícita.

## Impacto e recuperação

E1a publica sob ACCESS EXCLUSIVE nas tabelas lessons/lesson_activities: pode bloquear leitura de outras aulas e início de aprendizagem. Cinco segundos é timeout por aquisição, não estimativa de indisponibilidade total. Sem medição real, não há prazo confiável; programar janela controlada após medir. Não diminuir locks para obter aprovação.

Falha dentro da transação SQL deve reverter o conjunto daquela transação; comprovação real ainda pendente. Após COMMIT, retornar o frontend não desfaz alterações de banco. Para desativação, bloquear novas entradas, drenar chamadas e revogar RPCs editoriais/de pacotes e acesso da Edge nova em operação revisada. Preservar tabelas, eventos, rascunhos, intenções, arquivos privados e definições anteriores dos guards. Não apagar conteúdo/histórico nem remover triggers para contornar reservas.

Pacote interrompido: recuperar operação persistida, reenviar o mesmo ZIP, verificar hashes/intenções e retomar preparação privada. Falha na publicação deve deixar versões privadas e reverter atividades/vínculos/ativações da transação; não prometer rollback de arquivos externos. Operação pendente com reserva exige revisão individual; rollback do frontend não libera essa reserva. Procedimento detalhado permanece em `importador-unificado-e2a.md` e `homologacao-editorial-e1a.md`.

**Próximo passo mínimo:** liberar RAM e confirmar Git/Production da Vercel. Não há autorização de implantação solicitada agora, pois os critérios técnicos exigidos continuam pendentes.
