# Importador unificado E2a — entrega local

16/11/2026. **Implementado localmente, sem implantação.** Base E1a preservada no checkout `tmp/editorial-e1a-20261112`, branch `feature/editorial-e1a`, HEAD/base `d2acc6f5c7455a62ec1e4ff916273b80df7640a6`. Nenhum trabalho de agenda, relatórios ou avaliações da árvore principal foi incorporado.

O PostgreSQL portátil permanece parado. A homologação PostgreSQL real foi adiada pela usuária para uma rodada integrada E1a/E2a. Testes PGlite e de navegador não a substituem. Não houve migration remota, importação real, alteração de Edge implantada, push, merge ou deploy.

## Fluxo funcional entregue

**Selecionar aula vazia → exportar kit Work → selecionar um ZIP → validar/comparar/pré-visualizar → confirmar rascunho privado → recuperar/conferir → confirmar publicação coordenada.**

O painel está em Gestão → Conteúdo → **Pacote completo / Kit Work**. Não exige importar nem vincular cada deck manualmente. Kit e exemplo podem ser baixados pelo próprio painel. A prévia usa os renderizadores existentes; não registra aprendizagem nem XP. A publicação de atividades/apresentações não muda automaticamente o status curricular da aula.

O kit traz UUID/key/contexto reais do alvo, IDs curriculares, slots com UUIDs de apresentações, inventário, schemas e instruções de produção. A exportação não inclui UUID da conta administrativa. Quando não há key editorial, usa uma identidade determinística a partir do UUID, sem inferir pelo título. Os slots persistentes `principal`, `revisao` e `complementar` permitem zero a três apresentações. As atividades novas recebem UUID no banco ao publicar.

## Contratos e validação

Mantida a estrutura aprovada: manifest.json, aula.json v2, ZIPs internos em apresentacoes/{key}.zip. O schema operacional está em `src/contracts/lesson-package.v1.schema.json`; a única mudança relativa ao candidato é a identificação/título oficiais, sem mudança de campos, limites ou validações estruturais.

O motor ZIP limitado do importador web foi extraído para `public/apresentacoes/zip.js` e é compartilhado pelos dois formatos. Mantém verificações de diretórios central/local, intervalos sobrepostos, tamanhos, CRC, nomes/case duplicados, flags/métodos, links simbólicos, expansão e razão de compressão. Não extrai arquivos no disco do servidor. A camada de envelope só permite manifesto, aula e ZIPs declarados, valida SHA-256/tamanho exato, identidade, referências, inventário e limites cumulativos dos ZIPs aninhados.

Atividades continuam em `validateLessonImport` e schemas existentes; a mesma função TypeScript é importada pela Edge nova. Somente imports JSON/tipos foram explicitados para compatibilidade entre runtimes. Apresentações continuam em `parsePresentationPackage`/schema v1 existentes, incluindo validação de imagens, dimensões, textos e créditos. Não há parser alternativo de atividades nem outro viewer. A comparação do painel chama a E1a antes de permitir salvar; o servidor repete validação sem confiar no resultado do cliente.

Limites iniciais: externo 25 MiB, expansão externa 32 MiB, efetiva 50 MiB, manifesto 64 KiB, aula.json 2.000.000 bytes, até 200 atividades e três ZIPs internos de até 10 MiB. A entrada unificada verifica bytes UTF-8; não alterou o limite por caracteres já existente na E1a/importador legado. Capacidade/performance máxima em Edge hospedada permanece pendente da homologação integrada.

Inventário distingue URLs gerenciadas, Drive, referências externas e referências privadas. teacherOnly e teacherResources ficam em operações administrativas privadas. URLs docentes não podem ser repetidas literalmente na projeção pública. Permissões/licenças e equivalência de URLs Drive precisam de revisão humana; nenhuma chamada à API Drive é feita. Não há novo bucket ou migração de PDFs/vídeos.

## Coordenação, idempotência e recuperação

Estados persistentes: `preparing` → `ready` → `published`. A operação guarda documento privado, manifesto, fingerprint, origem, erro limitado e recibo. Intenções guardam atividade/key, apresentação, versão reservada e arquivos esperados.

1. A Edge valida o pacote completo antes de criar operação.
2. A reserva do alvo/identidades é transacional. productionId divergente com outro conteúdo é conflito. Identidade semântica considera documento público/privado, decks normalizados e hashes de recursos; mudar somente compressão ou formatação equivalente não cria uma publicação nova.
3. A preparação usa o mesmo helper de upload/registro do importador web. Arquivos ficam no bucket privado existente. Em falha, o coordenador retém arquivos privados da operação; reenvio reutiliza IDs e confere os hashes antes de aceitar um objeto existente. Não sobrescreve bytes divergentes.
4. A conclusão verifica versões e objetos Storage, ausência de histórico/atividade/conflito e então salva o rascunho pela E1a. O token inclui o estado real após preparação, sem ignorar alterações externas na aula. Os recursos próprios são excluídos somente da comparação de preparação; a publicação ainda confere o snapshot E1a completo.
5. **Uma única RPC** publica o conjunto numa transação: E1a aplica atividades/metadados, o gerenciador web ativa versões e cria vínculos. Falha posterior desfaz também os passos anteriores. Upload Storage ocorre fora dessa transação e continua privado se a publicação abortar.
6. A aula fica reservada durante a operação. Triggers impedem publicação/alteração independente de atividades, finalização de rascunho E1a, ativação web ou versão diferente da reservada. Só o coordenador cria uma permissão privada da transação, vinculada à operação, aula, versão e origem. O cliente não consegue forjá-la. Essa permissão é removida antes de retornar ou desfeita no rollback.
7. Reimportar uma operação concluída retorna seu estado/recibo sem novas atividades, versões, vínculos ou XP. Repetir a publicação da mesma versão também retorna o recibo. Recibo descreve a operação histórica; não reaplica conteúdo que tenha sido alterado posteriormente por fluxo autorizado.

Durante uma preparação interrompida, reenviar os arquivos originais. Recompactar os mesmos arquivos pode ser retomado; reformatar/corrigir arquivos cujo hash já foi reservado exige revisão, em vez de sobrescrever objetos. Não há cancelamento/limpeza automática ou botão de substituição de operação pendente nesta versão. Se outra operação alterar o alvo/rascunho, o coordenador bloqueia e preserva ambos para revisão.

## Elegibilidade e proteção dos dados existentes

Somente aula curricular existente e sem qualquer histórico da matriz E1a. Recusa atividades existentes, mesmo inativas, materiais em campos legados, apresentações anteriores fora da operação e rascunhos editoriais alheios. Não apaga nada para tornar a aula elegível.

Os importadores antigos permanecem utilizáveis fora de uma reserva E2a. Durante a reserva, o impedimento de publicar partes por outros caminhos é deliberado. Foram testados inclusão v1, reconciliação A02 e gerenciador web com as duas migrations editoriais instaladas no mesmo banco sintético.

Nenhum registro real de aluno foi utilizado. Não se alteram coortes, versões curriculares, notas, tentativas, progresso, regras de XP ou recibos históricos. Nenhuma migração de FK histórica foi antecipada.

## Arquivos e interfaces

| Grupo | Arquivos |
|---|---|
| Backend | `supabase/migrations/20261115234003_unified_lesson_packages.sql`; `functions/import-lesson-package/index.ts` e `deno.json`; `functions/_shared/prepare-web-presentation.ts` |
| Compatibilidade web | `supabase/functions/import-web-presentation/index.ts` passa a usar o helper compartilhado no código local; `public/apresentacoes/package.js` delega o ZIP comum preservando sua saída anterior |
| Parser/envelope | `public/apresentacoes/zip.js`, `lesson-package.js`, `src/contracts/lesson-package.v1.schema.json` |
| Interface | `src/lib/lessonPackages.ts`, `src/components/learning/UnifiedLessonImporter.tsx`, integração mínima em `management/TabContent.tsx` |
| Reuso de autoria | Imports compatíveis em `src/lib/learningContent.ts`; schemas de aula existentes inalterados |
| Kit/exemplo | `src/contracts/work-lesson-package.md`, `src/contracts/examples/lesson-package.v2.json`, `scripts/generate-lesson-package-demo.mjs`, artefatos em `docs/examples/unified-lesson-package/` |
| Testes | `lesson-package.test.mjs`, `lesson-package-integration.test.mjs`, `lesson-package-browser.test.mjs`, `edge-package-typecheck.mjs`, fixtures e adaptadores de transporte locais |
| Configuração | Scripts npm; `supabase/config.toml` com `verify_jwt=true` para a função nova; `.gitattributes` preserva bytes da migration |
| Documentação | Este relatório, guia Work, roadmap e notas nos documentos anteriores; homologação integrada registrada no relatório E1a |

Migration nova aditiva: cinco tabelas privadas (`lesson_package_kits`, `lesson_package_operations`, `lesson_package_productions`, `lesson_package_intents`, `lesson_package_commit_permits`), índices e quatro triggers de reserva. RLS habilitada, acesso direto revogado inclusive de service_role. Não altera a migration E1a nem amplia a exceção A02.

RPCs administrativas: `create_lesson_package_kit`, `lesson_package_state`, `publish_lesson_package`. RPCs apenas de serviço: `begin_lesson_package`, `prepared_lesson_package_version`, `finish_lesson_package`, `record_lesson_package_failure`; verificam o ator administrativo ativo. Helpers privados têm execução revogada e `search_path` vazio. A Edge exige usuário autenticado/administrador ativo e confirmação explícita antes de preparar.

SHA-256 E1a, **preservado**:

```text
a990cf305c7d19cec5e8fc23dd7b21545bfd80d3f45ead8aa5fc54c1f3c5c301
```

SHA-256 E2a preparada, **não aplicada**:

```text
12c05d50527f36099b8a11cb5e3048d5d1100f70e9dd1f98bc960bf586bfff64
```

## Evidências locais

- Rodada integrada: **144 testes passaram**, cobrindo E2a, E1a, A02, contratos, web/ZIP, XP oficial, flashcards, projetos, sessões docentes e currículo. Não repetir essa rodada só para aumentar a contagem.
- Suíte E2a final: **26 passaram**, com pacote entregue, zero/um/dois/três decks, destinos/keys/origem inválidos, falta de arquivo, integridade, caminhos inseguros, conteúdo incompatível, referências, normalização semântica, preparação interrompida, retomada, idempotência, histórico tardio, concorrência por versão, bloqueio de publicação isolada e rollback tardio.
- Browser E2a final: **1 passou**, fluxo do kit à publicação com fixture que reserva as identidades do exemplo entregue. Inclui recarga/recuperação, prévia privada por URL assinada, vínculos automáticos, viewport 390 × 844 sem rolagem horizontal, zero erros de página e zero chamadas de aprendizagem. Capturas: `test-results/lesson-package-desktop.png` e `lesson-package-mobile.png`.
- Rodada focada de compatibilidade: **31 passaram**, incluindo testes novos de coexistência com E1a/E2a instaladas e pipeline web legado.
- Tipagem de Edge: checagem TypeScript estrita offline passou, usando os tipos do SDK instalado. O handler real foi executado nos testes, com substituição somente de Auth/transporte Storage e chamadas HTTP pelo banco local.

As rodadas se sobrepõem; não somar como testes únicos. PGlite executa as funções SQL reais, mas não comprova contenção de múltiplas conexões PostgreSQL. Auth/JWT hospedado, gateway, CORS real e Storage cloud ainda precisam de homologação. O executável Deno não estava disponível nesta sessão; não foi instalado para ampliar o escopo. A checagem offline não equivale a `deno check` ou deploy.

Verificação final: `npm.cmd run build` aprovado; tipagem offline da Edge aprovada; os 15 testes de parser/kit foram reexecutados após centralizar a exportação dos schemas e passaram. O build mantém avisos sobre Browserslist desatualizado e chunks grandes. Comparação completa de lint: base e implementação com 168 erros e oito avisos, sem diagnósticos novos. Nenhuma falha antiga de lint foi corrigida fora do escopo. Revisão React: carregamento sob demanda, limpeza das URLs de prévia, bloqueio de ações concorrentes, rótulos e estados acessíveis conferidos.

## Pacote de demonstração

[Pacote completo sintético](examples/unified-lesson-package/pacote-sintetico-completo.zip), 12.382 bytes; nove atividades dos oito tipos e duas apresentações. SHA-256:

```text
34d426f38484b5c995b7970b1e49e62a37f0fc3ed4534540c3f2517982309d76
```

[Kit Work sintético](examples/unified-lesson-package/kit-work-sintetico.zip), 66.484 bytes; SHA-256:

```text
ba71e364eca44559ef7f2a88d9ec3a33e20316fa20eda4068ccde9d6cbe9737f
```

As identidades correspondem somente à fixture de demonstração; o teste importa esse próprio ZIP, não uma cópia com IDs substituídos. Em outra aula, o botão do painel gera o exemplo alinhado às identidades reais do kit. URLs Drive sintéticas não contêm conteúdo pedagógico real nem comprovam compartilhamento. Não importar a demonstração em produção.

## Homologação integrada e futura implantação

Consolidar numa única etapa futura: PostgreSQL real A–F com E1a e E2a, reservas e duas operações concorrentes, papéis/ACLs/Storage, tokens e histórico tardio; pacote pequeno/representativo/limite de 200 atividades e ZIPs aninhados; memória/tempo da Edge; crescimento de operações e auditoria; interrupção de preparação/publicação, ausência de permissões residuais e recuperação.

Preservar os locks E1a; não diminuir para simular desempenho. A reserva acrescenta operações de catálogo/privadas e Storage à análise. Nenhum desses testes pendentes foi declarado aprovado nesta entrega.

Antes de produção: preflight estritamente de leitura de Supabase/Vercel, histórico/compatibilidade das duas migrations, hash, permissões e Storage, commit/branch/deploy automático; solução de recuperação ou decisão explícita atual sobre risco. A Bitaria continua sem backup de produção com restauração comprovada. Aceitações antigas não autorizam instalar E1a/E2a.

Uma futura implantação exige aprovação própria: E1a e depois E2a, somente SQL auditado; nova função `import-lesson-package` com JWT habilitado e dependências incluídas; frontend isolado. A função web legada implantada não foi alterada e sua refatoração local não exige redeploy para ativar E2a. Não usar db push/migrations gerais.

Recuperação específica: desabilitar primeiro a entrada de novas operações, drenar execuções, revogar as RPCs públicas da E2a e suas RPCs de serviço e retornar frontend. **Não simplesmente revogar o botão de publicação:** operações pendentes conservam reservas para impedir publicação parcial por outro importador. Preservar operações, intenções, arquivos privados e rascunhos; resolver cada reserva por procedimento revisado. Não remover os triggers para forçar publicação, não apagar objetos publicados/históricos e não tratar rollback do frontend como restauração de banco. Erro de publicação dentro da transação desfaz ativações, vínculos e atividades, mantendo o rascunho pronto para revisão/retomada.

Próximos desenvolvimentos depois da homologação: E1b/E2b para formulários/seleção de alterações/atualização de aulas sem histórico e gerenciamento de operações; E3 para versionamento de aprendizagem. Nenhuma dessas etapas foi antecipada.
