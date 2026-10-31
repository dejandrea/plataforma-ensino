# Gerenciador de apresentações web

Implementado no fluxo **Gestão do sistema → Conteúdo → aula → Apresentações web**. O gerenciador valida um ZIP, permite prévia local, salva versões privadas, publica a versão escolhida, reverte para versões anteriores e vincula uma apresentação a uma atividade `slides` existente. Nenhuma dessas ações foi executada em produção nesta entrega.

## Arquitetura

O JSON pedagógico continua no contrato de apresentações v1. Não existe um segundo visualizador: `PresentationFrame` incorpora o mesmo `public/apresentacoes/index.html`, com uma sessão de mensagens limitada por origem, janela e nonce. O viewer valida novamente os dados e recebe apenas o deck e o mapa de imagens autorizado. Não recebe código do ZIP.

Há três etapas distintas:

1. **Validar e pré-visualizar localmente.** O pacote permanece no navegador; imagens usam URLs Blob temporárias. Não há upload, publicação ou gravação de progresso.
2. **Salvar rascunho validado.** A Edge Function `import-web-presentation` autentica a conta, verifica o perfil administrativo ativo, repete toda a validação e envia os arquivos a um bucket privado. A versão só é registrada depois de completar os uploads.
3. **Publicar e vincular.** O administrador abre a versão salva, confirma sua revisão e altera a versão ativa. A vinculação a uma atividade exige uma confirmação separada, mostrando título, key, UUID, referência original e vínculo proposto.

Os estados de publicação dependem da referência `active_version_id`. Uma versão registrada é validada e imutável; quando não está ativa, fica disponível apenas para a prévia administrativa. A publicação não publica a aula nem cria atividades.

### Preservação das atividades

A inspeção identificou que atividades publicadas são imutáveis (`private.learning_guard_activity`). Essa proteção foi mantida integralmente. O vínculo usa `web_presentation_links`, sem atualizar `lesson_activities`.

O carregamento da aula e sua prévia consultam um vínculo opcional e acrescentam `web_presentation_id` somente à representação de execução da atividade. `ActivityRenderer` abre a rota gerenciada quando esse vínculo está presente. Isso não muda o contrato de autoria, `content_json`, UUID, key, revisão, obrigatoriedade, pré-requisitos ou registros históricos. O importador administrativo completo não é invocado.

O botão **Confirmar estudo** continua na aula, com a RPC e a regra central `activity_study` existentes. A apresentação não chama RPCs de progresso ou recompensa. Atualizar ou reverter o material não apaga conclusões nem concede XP novamente.

## Armazenamento e versões

Bucket dedicado **`web-presentations`**, privado. Estrutura:

```text
presentations/<presentation_uuid>/versions/<version_uuid>/
  apresentacao.json
  images/<nome-seguro>.webp
  creditos-imagens.md  (opcional)
```

Os números exibidos na interface são sequenciais; os caminhos usam UUIDs imutáveis. Upload usa `upsert: false`. Não há operações de sobrescrita ou exclusão de versões pela interface. O mesmo ZIP não pode ser cadastrado duas vezes na mesma aula; a interface orienta a selecionar a versão existente.

Tabelas adicionadas:

| Tabela | Função |
| --- | --- |
| `public.web_presentations` | Aula, título e referência à versão ativa |
| `public.web_presentation_versions` | Versões imutáveis, arquivos, SHA-256, avisos e quantidade de slides |
| `public.web_presentation_links` | Referência auxiliar por UUID da atividade existente |
| `private.web_presentation_events` | Histórico imutável de importação, publicação, reversão e vínculo |

Não são adicionados conteúdos curriculares, alunos, atividades ou recompensas por essa migration.

### URLs

A URL estável é **`/apresentacoes/gerenciada/<presentation_uuid>`**. A referência permanece igual ao publicar uma atualização ou reverter. A rota exige uma conta administrativa ou de aluno autorizada; não se trata de uma pasta pública de rascunhos. O endereço final usa o domínio real do ambiente onde a aplicação está instalada.

As URLs estáticas existentes, como `/apresentacoes/?deck=html-m01-s01-a02`, continuam válidas. Os parâmetros não aceitam uma URL arbitrária de JSON. O servidor resolve apenas um UUID conhecido e aplica as permissões antes de autorizar o download.

## Segurança e permissões

- Perfis administrativos **ativos**, verificados no servidor, podem importar, publicar, reverter e vincular. Não se usam claims editáveis em `user_metadata` para autorizar.
- O frontend usa somente as credenciais públicas já existentes. A chave de serviço permanece na Edge Function.
- O bucket não é público e não possui políticas de INSERT/UPDATE/DELETE para clientes, inclusive administradores. Apenas o pipeline validado no servidor escreve os arquivos.
- RLS limita a leitura do Storage aos caminhos exatos do manifesto. Administradores podem abrir versões salvas. Alunos só podem ler a versão ativa, vinculada a uma atividade `slides` ativa/publicada, da aula liberada e com os pré-requisitos atendidos.
- Alunos não podem listar versões ou obter acesso a rascunhos pela manipulação do UUID/versão. Contas anônimas, inativas e professoras sem papel administrativo não gerenciam apresentações.
- A RPC de registro é exclusiva de `service_role`; revalida o administrador, confere o manifesto e a existência/tamanho/MIME dos arquivos no Storage.
- A troca da versão ativa e o vínculo usam locks e conferência da referência anterior. Uma tela desatualizada é rejeitada, exigindo atualização e nova confirmação.
- Versões e eventos têm proteção contra UPDATE/DELETE. Não foi criada exceção à imutabilidade pedagógica existente.

A aplicação emite URLs de download assinadas de cinco minutos. A página do aluno renova a autorização a cada dois minutos; se a versão ativa mudar, o viewer recebe a nova versão. Renovar URLs da mesma versão preserva o slide atual. Links assinados já emitidos podem continuar funcionando até expirarem, mesmo após mudança de versão ou permissão. A prévia administrativa pode ser reaberta para renovar suas URLs.

## Pacote aceito

```text
apresentacao.json
images/
  uma-imagem.webp
  outra-imagem.png
creditos-imagens.md
```

Também é aceito o pacote já existente da Aula 02, com **um único JSON em `decks/nome-seguro.json`**. O JSON é armazenado como `apresentacao.json`, sem reescrever seu conteúdo. `images/` e os créditos são opcionais quando o conteúdo não os exige; todas as imagens referenciadas precisam existir.

Regras desta versão:

Os nomes das imagens usam ASCII minúsculo, números, hífen ou underscore, começando por letra/número e com até 100 caracteres no nome-base. As referências continuam usando `./images/nome.ext`, conforme o contrato. O diretório `images/` não é renomeado pelo importador.

| Limite | Valor |
| --- | --- |
| ZIP recebido | 10 MB |
| Conteúdo expandido total | 25 MB |
| Entradas no ZIP | 80 |
| JSON | 500 KB |
| Imagem individual | 5 MB / 16 milhões de pixels |
| Créditos em UTF-8 | 100 KB |
| Slides | 1 a 60, conforme schema v1 |

São aceitos arquivos ZIP tradicionais com métodos **stored** ou **deflate**. O importador rejeita ZIP64, arquivos criptografados, múltiplos volumes, links simbólicos, caminhos absolutos/relativos inseguros, barras invertidas, nomes duplicados e entradas sobrepostas ou inconsistentes. Aplica limites declarados antes de descomprimir e limites reais durante a leitura, incluindo proteção por taxa de compressão. Confere tamanho, CRC32 e SHA-256.

Imagens aceitas: WebP não animado, PNG e JPEG, com assinatura/container e dimensões compatíveis. SVG permanece disponível nos decks estáticos confiáveis, mas não é aceito em ZIPs enviados por usuários. Arquivos executáveis, HTML, scripts, pastas de originais, JSONs administrativos e documentos não previstos são rejeitados. O ZIP não é extraído no filesystem do servidor e nunca é executado.

Avisos sinalizam créditos ausentes, imagens sem legenda e imagens não usadas. A autoria e as licenças continuam exigindo revisão humana antes da confirmação de publicação; validação estrutural não é revisão editorial. O viewer preserva alt text, legendas, fontes e os links de licença. Pedidos `mascot.category`/`mascot.id` usam a biblioteca Bitara já instalada.

## Como usar

1. Abra **Apresentações web** na aula correta.
2. Escolha **Nova apresentação** ou uma apresentação existente para criar uma nova versão.
3. Selecione o ZIP. Confira título, slides, arquivos, erros e avisos.
4. Use **Pré-visualizar pacote** para revisar os slides sem upload.
5. Use **Salvar rascunho validado**. O servidor repete as verificações; o rascunho continua privado.
6. Escolha a versão salva e clique em **Visualizar versão salva**.
7. Após conferir textos, imagens, créditos e licenças, marque a confirmação e clique em **Publicar versão N**.
8. Copie ou abra a URL estável apresentada. O acesso do aluno depende também do vínculo e da liberação da aula.
9. Escolha explicitamente uma atividade `slides` existente, abra **Revisar vínculo proposto**, confira UUID/key e confirme. Nenhuma atividade é criada por esse fluxo.

Para atualizar, selecione a apresentação existente e importe outro ZIP. Para reverter, escolha uma versão anterior, abra a prévia, confirme a revisão e use **Reverter para versão N**. A versão antes ativa permanece salva.

## Arquivos de implementação

| Arquivo | Mudança |
| --- | --- |
| `src/components/management/WebPresentationManager.tsx` | Interface de importação, versões, publicação, reversão e vínculo |
| `src/components/management/TabContent.tsx` | Entrada no fluxo administrativo da aula |
| `src/lib/webPresentations.ts` | API, validação local, prévia, URLs assinadas e vínculo opcional |
| `src/types/presentations.ts` | Tipos de transporte e estado do gerenciador |
| `src/components/learning/PresentationFrame.tsx` | Incorporação segura do viewer existente |
| `src/pages/ManagedPresentation.tsx` e `src/App.tsx` | Rota estável e renovação de autorização |
| `public/apresentacoes/package.js` | Validador ZIP compartilhado entre navegador e servidor |
| `public/apresentacoes/viewer.js` e `viewer.css` | Modo incorporado, mapa de imagens e altura responsiva |
| `src/types/learning.ts` | Referência opcional de execução, fora do JSON pedagógico |
| `src/lib/studentLearning.ts`, `ActivityRenderer.tsx`, `AdminLessonPreview.tsx` | Resolução do vínculo sem alterar atividade/revisão |
| `supabase/functions/import-web-presentation/index.ts` | Importação autenticada e validada no servidor |
| `supabase/migrations/20261031105202_managed_web_presentations.sql` | Metadados, RLS, bucket privado, RPCs e auditoria |
| `tests/presentation-package.test.mjs` | Pacotes válidos e casos maliciosos |
| `tests/managed-presentations.test.mjs` | Migration e handler reais no PostgreSQL isolado |
| `tests/managed-presentations-browser.test.mjs` | Fluxo administrativo e leitura do aluno em desktop/mobile |
| `tests/fixtures/presentation-package.mjs`, `presentations-db.mjs` e harness existente | Dados sintéticos e transporte local de Auth/Storage |

O parser não adiciona dependência ZIP. Usa APIs Web padrão com leitura limitada. O schema continua sendo `public/apresentacoes/presentation.schema.json` e a validação de slides é a mesma do viewer.

## Validação local

O teste de banco aplica a migration real em PGlite com RLS e papéis PostgreSQL. O handler real da Edge Function é executado substituindo somente o transporte de Auth e Storage. O navegador usa React, o viewer e RPCs reais desse banco isolado. Não há conexão de escrita com o ambiente real; as pessoas e os registros são sintéticos, e o vínculo é feito com uma atividade de teste, não com a Aula 02 existente.

Foram exercitados: pacote válido da Aula 02, JSON inválido/schema incompatível, imagem ausente, extensão falsa, arquivo proibido, ZIP Slip, symlink, CRC, tamanhos e bomba de descompressão; usuários sem permissão; upload parcial e limpeza; deduplicação; prévia local/salva; publicação, nova versão, reversão, concorrência de referência e vínculo; bloqueio de módulo; leitura privada; preservação exata de atividades, perfis, progresso e recibos de XP; confirmação manual idempotente.

Resultados: os 5 testes do gerenciador/pacote passaram; a suíte ampliada de aprendizagem, contratos e cartões passou com 65 testes; os 6 cenários de regressão de navegador passaram, incluindo o gerenciador em desktop/celular. O cenário do gerenciador foi repetido após os ajustes finais de segurança, verificando também a imagem privada e a Bitara na leitura do aluno. Build e verificação Deno passaram. O lint dos novos módulos e dos componentes de aprendizagem alterados passou. Permanecem os avisos já existentes de Browserslist e tamanho dos bundles.

Comandos:

```text
npm.cmd run test:presentation-manager
npm.cmd run test:presentation-manager:browser
npm.cmd run test:presentations
npm.cmd run test:presentations:browser
npm.cmd run test:bitara
npm.cmd run test:bitara:browser
npm.cmd run build
npx.cmd deno check supabase/functions/import-web-presentation/index.ts
```

As capturas de revisão ficam em `test-results/presentation-manager-desktop.png`, `presentation-manager-mobile.png` e `presentation-managed-student.png` (ignoradas pelo Git). O teste de regressão também mantém os decks estáticos, os cartões didáticos e a prévia administrativa funcionando.

## Pendências e riscos antes de produção

1. **Aprovação explícita** para instalar a migration, implantar a Edge Function e publicar o frontend. Nada foi aplicado ou implantado em produção nesta entrega.
2. Revisar inventário e backup no ambiente de destino. O inventário de Storage consultado era composto somente pelo bucket público `catalog-icons`, com políticas limitadas a esse bucket. A nova migration cria um bucket separado, privado.
3. Aplicar somente `20261031105202_managed_web_presentations.sql`, depois de conferir seus pré-requisitos e a ausência de objetos com os mesmos nomes. Não usar um push indiscriminado das migrations históricas divergentes. Registrar a versão exata após aplicação autorizada.
4. Implantar `import-web-presentation` com a configuração autenticada padrão e as credenciais de servidor já usadas pelo projeto. A função importa o parser e o schema existentes; seu grafo foi verificado com Deno.
5. Verificar num ambiente de homologação o Storage HTTP real, CORS, tamanho de upload, geração de links assinados, RLS e o acesso de admin/aluno. Nos testes locais, somente esse transporte foi simulado; as regras de banco e o handler foram executados.
6. Validar a rota gerenciada no domínio HTTPS definitivo e a renovação de URLs. Não gravar um endereço de localhost em material real.
7. A Aula 02 foi usada apenas como pacote de referência em uma aula sintética. Antes de vincular qualquer atividade real, consultar seu inventário atual, apresentar o vínculo concreto e obter aprovação. Não importar o JSON administrativo inteiro nem converter os reforços opcionais em obrigatórios.

Os objetos de versões são preservados e consomem armazenamento. Se a limpeza de um upload incompleto falhar por indisponibilidade do Storage, podem restar objetos órfãos privados; sem manifesto registrado eles não recebem leitura por RLS. A limpeza operacional deve identificar esse estado e preservar versões válidas. Não há exclusão automática de versões nesta primeira entrega.

Um rollback de conteúdo é a troca autorizada da versão ativa. Desfazer a migration depois de haver versões/vínculos em uso exigiria uma migração de recuperação específica, preservando metadados e URLs; não se deve remover essas tabelas ou o bucket em uso.

Sem as instalações autorizadas, o painel mostra que o gerenciador ainda não foi preparado. As atividades antigas continuam disponíveis: a ausência da RPC opcional de vínculo conserva seu comportamento anterior.
