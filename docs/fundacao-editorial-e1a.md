# Fundação editorial E1a — implementação local

12–13/11/2026. Implementada e testada **somente localmente**, com dados sintéticos. Nenhuma migration remota, alteração de conteúdo real, Edge Function, push, merge ou deploy foi executado. E2a, E1b/E2b e E3 continuam posteriores.

## Isolamento e base

- Checkout: `tmp/editorial-e1a-20261112`, branch local `feature/editorial-e1a`.
- Base: release `release/a02-reconciliation-20261112`, commit `d2acc6f5c7455a62ec1e4ff916273b80df7640a6`, identificado anteriormente como publicado.
- A `main` local estava em `617a6dbbf990c325793c57f712cacf2308056246`. A diferença até esse release é de 13 arquivos da reconciliação A02, 1.011 inserções e 5 remoções.
- As alterações pendentes de agenda, relatórios, avaliações e outros trabalhos da árvore principal não foram copiadas. A árvore principal e sua branch não foram modificadas por E1a.
- Esta entrega não reaudita o commit hospedado na Vercel nem o inventário atual de produção. Isso deve ser repetido no preflight de implantação.

## Implementado

Identidade da aula pelo UUID selecionado no painel, com adoção explícita de uma key estável, única por curso. Não se deduz identidade apenas pelo título. Atividades correspondem por `(lesson_id, key)`, mantendo UUID, key e revisão existentes. Novas atividades recebem UUID do banco.

O documento usa os contratos v1/v2 existentes. No cliente, a interface chama `validateLessonImport`; a prévia usa `toStudentLesson` e `AdminLessonPreview`. No banco, a validação semântica do importador de inclusão foi extraída para `private.learning_validate_document`, usada pelo próprio importador e pela fundação editorial. Mantêm-se o schema versionado, `learning_json_matches`, validadores de conteúdo/recompensa, gabaritos e IDs de flashcards. Nenhum schema ou parser alternativo de atividades foi criado.

A comparação apresenta conteúdo novo, inalterado, editorial, recurso, estrutural, pedagógico, incompatível e conflitante. Inclui metadados, conteúdo público, alterações privadas de gabaritos/planos e estado de publicação das atividades. Posições e dependências são validadas novamente no conjunto final, incluindo atividades omitidas. Colisões e dependências inválidas geram erro bloqueante.

O rascunho é privado e persistente, com versão e token do estado de origem. Reabrir a aula recupera o rascunho. Salvar não insere nem atualiza atividades públicas. Publicar é outra RPC, com confirmação própria, nova validação, checagem de histórico e concorrência, e uma única transação. A publicação curricular da aula não é alterada. As atividades incluídas no documento são publicadas explicitamente por essa ação; as omitidas mantêm estado e conteúdo.

Regras de XP existentes não podem mudar. Importação, comparação, prévia, salvamento e publicação não chamam operações de aprendizagem ou concessão de XP. Os testes comparam perfis, XP, conclusões e tentativas antes/depois.

Qualquer registro em progresso da aula/atividade, tentativas/sessões avaliativas, submissões de projeto, sessões de plano docente, revisão de flashcards ou eventos de XP associados bloqueia salvar/publicar. Inclusive registros ainda não concluídos. A comparação continua disponível para explicar o bloqueio. Não há edição com histórico em E1a.

## Arquivos

| Arquivo | Alteração |
|---|---|
| `supabase/migrations/20261112220958_editorial_foundation.sql` | Migration preparada, **não aplicada** |
| `src/lib/editorialLessons.ts` | Tipos, quatro chamadas RPC e comparação JSON independente da ordem das propriedades |
| `src/components/learning/EditorialLessonEditor.tsx` | Interface mínima por JSON, comparação, prévia, recuperação e publicação |
| `src/components/management/TabContent.tsx` | Botão e carregamento sob demanda do editor |
| `tests/editorial-foundation.test.mjs` | Testes SQL reais sobre PGlite com fixtures sintéticas |
| `tests/editorial-browser.test.mjs` | Chromium → transporte HTTP local → RPCs reais → banco isolado |
| `tests/fixtures/editorial.html`, `editorial.tsx` | Entrada local do fluxo administrativo |
| `tests/fixtures/learning-browser-harness.mjs` | Mapeamento das quatro RPCs novas |
| `package.json` | Scripts `test:editorial` e `test:editorial:browser`; nenhuma dependência nova |
| `.gitattributes` | Preserva bytes da migration auditável e hashes dos pacotes sintéticos entre checkouts |
| `docs/arquitetura-editorial-e-pacote-unificado.md` | Roadmap atualizado e estado da aprovação |
| Esta documentação e documentos/artefatos de proposta anteriores | Mantidos fora de `public/`, para revisão e continuidade; não habilitam ZIP unificado |

## Migration e RPCs

SHA-256 da migration preparada:

```text
a990cf305c7d19cec5e8fc23dd7b21545bfd80d3f45ead8aa5fc54c1f3c5c301
```

Quatro RPCs públicas, todas verificando administração ativa no servidor:

```text
admin_editorial_lesson(p_lesson_id uuid)
plan_editorial_lesson(p_lesson_id uuid, p_document jsonb)
save_editorial_draft(p_lesson_id uuid, p_document jsonb,
  p_expected_source text, p_expected_version integer, p_confirm_identity boolean)
publish_editorial_draft(p_lesson_id uuid, p_expected_source text,
  p_expected_version integer, p_confirmed boolean)
```

As RPCs só têm `EXECUTE` para `authenticated`, com verificação adicional da função administrativa. Anônimo, professor e aluno não recebem gerenciamento editorial. `service_role` também não recebe essas RPCs públicas. Os helpers ficam privados e sem acesso direto dos clientes; `search_path` é vazio.

Tabelas novas em `private`, com RLS e sem permissões diretas para clientes: `editorial_lessons`, `editorial_drafts`, `editorial_events`, `editorial_permits`, `editorial_guard_backups`. Eventos são imutáveis. A auditoria guarda ator, operação, versão, identidade e patches com caminhos/valores diferentes, incluindo mudanças privadas; não repete documentos completos inalterados a cada salvamento. Existe somente um rascunho corrente por aula.

A migration é aditiva em dados e tabelas. Também refatora o importador e acrescenta permissões transitórias exatas aos três guards existentes: atividade, gabarito e pré-requisito. Cada permissão exige transação atual, administração e correspondência integral de antes/depois. Não é uma flag de sessão controlável pelo cliente. As permissões são apagadas antes de retornar, ou desfeitas com a transação. A exceção A02 permanece separada e não é ampliada. Definições anteriores dos três guards são guardadas uma vez; a instalação aborta se os trechos esperados divergirem.

Pré-requisitos: aprendizagem v1/v2, interativos/recompensas, ambiente docente, XP oficial, vídeo, currículo, flashcards, gerenciador web e reconciliação A02 já instalados, com schemas/guards compatíveis. Não se deve aplicar a migration em um ambiente que não tenha sido inventariado.

## Concorrência e impacto

O token compara o estado da aula, metadados, atividades, gabaritos, planos, dependências e vínculos/apresentações; não é uma credencial. A versão do rascunho evita sobreposição por outra operação administrativa. Histórico e estado são rechecados ao publicar. Repetir a publicação da mesma versão já concluída retorna o recibo anterior.

Salvar usa locks curtos de escrita para capturar um estado consistente. **Publicar primeiro drena leitores e obtém `ACCESS EXCLUSIVE` em `lessons` e `lesson_activities`**, seguido dos locks das tabelas relacionadas. Isso fecha a janela do fluxo docente existente que lê atividade/plano antes de criar uma sessão sem `FOR SHARE`. Não foi necessário reescrever RPCs de aprendizagem. Durante essa transação, leituras e escritas nessas tabelas podem aguardar. Há `lock_timeout` de cinco segundos por espera; contenção ou deadlock abortam a operação sem publicar parcialmente. Não há HTTP, ZIP ou interação humana sob locks.

Esse é um custo conservador da fase inicial. Testes locais de interleaving e transações passaram, mas PGlite não comprova contenção de múltiplas conexões PostgreSQL. **Homologar locks, simultaneidade real e duração no limite do contrato antes de produção.** Não reduzir o lock sem oferecer serialização equivalente a todos os caminhos existentes.

Impacto: cinco tabelas pequenas e índices privados, um rascunho por aula e crescimento proporcional de auditoria. O limite de documento continua em 2 MB no fluxo existente, com até 200 atividades no contrato. Não há novos buckets, arquivos migrados, coortes, FKs históricas reescritas, serviços pagos ou dependências npm. O consumo real deve ser medido com os documentos esperados; os exemplos pequenos não comprovam capacidade no limite.

## Testes executados

- Suíte editorial final: **20 testes SQL registrados pelo Node (18 subcasos + 2 grupos), todos passaram**.
- Browser editorial: **1 passou**, desktop e viewport de 390 × 844, sem rolagem horizontal e sem erro de página. Rascunho recuperado após recarga; confirmação separada; prévia sem chamadas de aprendizagem. Capturas em `test-results/editorial-desktop.png` e `editorial-mobile.png`.
- Rodada de regressão: **74 passaram**, incluindo E1a, A02 SQL/browser, contratos de aprendizagem/interativos, importação ZIP e gerenciador web. Depois dos últimos ajustes, E1a foi reexecutada. Não somar as rodadas como testes únicos.
- Build: `npm.cmd run build` passou; avisos existentes sobre Browserslist e tamanho dos bundles.
- Lint geral: **168 erros e 8 avisos**, os mesmos da base `d2acc6f`. Comparação por arquivo/regra/mensagem, desconsiderando números de linha deslocados, não encontrou novos diagnósticos. Novos arquivos TS/TSX passaram na checagem direcionada. O lint global continua pendente na aplicação preexistente.
- `git diff --check` passou.
- Os nove testes dos exemplos documentais copiados também passaram. Isso preserva os artefatos aprovados; não implementa o importador ZIP unificado.

Cobertura das exigências:

| Cenário | Evidência local |
|---|---|
| 1. Aula existente vazia | Compara, salva privado e publica duas etapas |
| 2. Atividades sem histórico | Atualização e inserção, oito tipos |
| 3. Aula com histórico | Comparação bloqueante e negação de salvar/publicar |
| 4. Metadados | Título, descrição e objetivos pelo contrato |
| 5. UUID/key preservados | Igualdade de IDs, keys, revisão e `published_at` |
| 6. Atividade nova | UUID novo e publicação somente explícita |
| 7. Omitidas | Linha inteira preservada |
| 8. Posição/key | Duplicação interna e colisão com omitida rejeitadas; identidade de aula divergente rejeitada |
| 9. Dependências | Referência ausente e ciclo rejeitados; troca válida de dependências publicadas |
| 10. Rascunho | Releitura por RPC e recarga do navegador |
| 11. Publicação separada | Sem confirmação rejeita; salvar não cria atividade pública |
| 12. Concorrência administrativa | Segunda operação com versão/token antigos rejeitada |
| 13. Histórico após comparação | Inserção sintética antes de publicar bloqueia a publicação |
| 14. Falha tardia | Trigger sintético aborta; conteúdo e rascunho anteriores intactos, sem permissões residuais |
| 15. Zero XP | Perfis, eventos XP, conclusões e tentativas equivalentes |
| 16. Conteúdo privado | Aluno não lê gabaritos; rascunhos privados não podem ser lidos diretamente |
| 17. Papéis | Admin permitido; aluno/professor/anônimo sem operações editoriais; permissão transitória não pode ser forjada |
| 18. Compatibilidade | A02 funciona com os novos guards; v1 e oito tipos; pipeline web e ZIP preservados |

A política preexistente permite leitura de gabaritos publicados a professores. E1a não amplia essa política: professores continuam sem acesso ao rascunho editorial, comparação ou publicação. Gabaritos propostos permanecem privados até a publicação explícita.

## Fluxo para homologação administrativa

Em ambiente isolado com a migration instalada: Gestão → Conteúdo → aula curricular → **Editar conteúdo e rascunho**. Abrir/colar JSON → Comparar sem salvar → revisar metadados, tipos de mudanças, gabaritos, omitidas e publicação → confirmar identidade na primeira adoção → Salvar rascunho privado. Fechar/reabrir deve recuperar o documento. A publicação exige outra confirmação e o botão **Publicar rascunho salvo**. Documento alterado depois de salvar não pode publicar como se já estivesse salvo.

O botão de importação original e a reconciliação A02 continuam disponíveis, separados. O editor especializado dos oito tipos não é pré-requisito para esse fluxo.

## Limitações e pendências

- Não há edição de aulas com histórico, renomeação de keys, troca de tipo, arquivamento ou exclusão. Atividades inativas exigem revisão. Mudanças em atividades com apresentação vinculada são bloqueadas conservadoramente; não há desvinculação automática.
- O contrato existente exige fechamento dos pré-requisitos no documento enviado. Para referenciar uma atividade existente, inclua-a também; o conjunto final ainda é revalidado com as omitidas.
- Documento v1 não representa interativos/vídeo/flashcards; para preservar esses tipos, usar v2. Omitir recompensa explícita já existente também não a remove: a mudança é bloqueada.
- Aulas legadas com documento atual incompleto precisam receber JSON válido antes de salvar; o sistema não inventa objetivos, keys ou gabaritos.
- Histórico editorial detalhado usa patches privados; a UI mostra um resumo de operações. Limpeza/retomada de versões anteriores por interface avançada fica para evolução posterior.
- Ainda não foram testados: transporte hospedado, RLS no projeto real após instalação, múltiplas conexões PostgreSQL com contenção real, documentos no limite de memória/tempo e recuperação do banco de produção.
- E2a pendente: kit Work, leitura segura do ZIP externo e manifesto, validação dos ZIPs internos, inventário Drive, coordenação idempotente, intenções de vínculo persistentes e recuperação de falhas distribuídas. Reutilizar esta fundação e o pipeline web atual; sem outro parser/viewer.

## Recuperação

Falha dentro de salvar/publicar: a própria transação desfaz todas as escritas. O teste de falha tardia comprovou a manutenção do conteúdo anterior e do rascunho salvo.

Se for necessário desativar a funcionalidade após futura implantação: revogar `EXECUTE` das quatro RPCs para `authenticated`; voltar o frontend ao release anterior; revisar e restaurar as três definições de guard de `private.editorial_guard_backups`. Manter as tabelas privadas, os eventos e o helper compartilhado do importador. Não fazer `DROP ... CASCADE`, não apagar atividades e não executar uma migration down indiscriminada.

Se uma publicação tiver sido concluída, reverter conteúdo exige inventário novo e verificação de histórico; os patches ajudam a preparar uma proposta concreta, mas não autorizam desfazer conteúdo já utilizado. O rollback do frontend não desfaz conteúdo publicado. Isso não substitui backup recuperável do banco.

**A Bitaria continua sem restauração de produção comprovada.** Nenhuma aceitação anterior desse risco autoriza instalar E1a. A implantação precisa de nova aprovação e decisão explícita sobre recuperação.

## Checklist de futura implantação — não executado

1. Reconfirmar projeto `gnyiyhnbpjhdgrhsevbh`, release hospedado, regras de publicação Vercel, inventário e migrations aplicadas; separar quaisquer novos trabalhos locais.
2. Verificar backup/recuperação e obter autorização específica para o risco vigente.
3. Conferir hash, schemas, guards e todos os pré-requisitos. Ensaiar a migration exata em PostgreSQL isolado, com múltiplas conexões, inclusive início de atividade/plano docente durante publicação; medir locks no limite esperado.
4. Aplicar **somente** o SQL desta migration por operação de migration controlada, após aprovação. Registrar a versão efetivamente retornada pelo Supabase. Nunca usar `db push` ou aplicar pendências gerais.
5. Verificar quatro RPCs, ACLs/RLS, guards, tabelas privadas e negação para aluno/professor/anônimo. Não executar reconciliação de aula real como teste.
6. Publicar somente o frontend deste checkout/release, após aprovação de commit/push/deploy. Nenhuma Edge Function precisa mudar.
7. Homologar com aula sintética: comparação, rascunho recuperado, publicação separada, concorrência, histórico tardio, rollback e ausência de XP. Rever segurança do ambiente de prévia.
8. Só então considerar E1a homologada e iniciar E2a. Não importar/publicar A02 ou outros materiais reais automaticamente.

Referências técnicas consultadas: [funções e permissões no Supabase](https://supabase.com/docs/guides/database/functions), [changelog oficial](https://supabase.com/changelog). CLI v2.122.0 foi usada apenas para criar o arquivo local da migration, sem operação remota.
