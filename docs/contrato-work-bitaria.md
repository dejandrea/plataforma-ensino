# Contrato real de entrega — ChatGPT Work → Bitaria

Verificado em **02/11/2026**, no código local da branch main, commit-base `06cac4e`. Documento de autoria e operação; não altera o contrato e não autoriza publicação. O gerenciador está implementado, mas ainda não implantado em produção.

## 1. O que o Work deve entregar

Produza uma apresentação completa em **JSON de apresentações v1**, suas imagens e, preferencialmente, créditos. Entregue um ZIP tradicional, sem senha, com os arquivos na estrutura abaixo. A Bitaria já possui visualizador, estilos, fontes, navegação e biblioteca oficial Bitara: não produza outro aplicativo, HTML ou scripts.

**Este contrato não é o JSON administrativo de aulas v2.** O `schemaVersion` desta apresentação é o número inteiro **1**. Não incluir `activities`, `lessonId`, UUIDs, keys de atividades, `teacherOnly`, recompensas, gabaritos, manifesto ou configurações de publicação no JSON.

Fonte normativa exata: [presentation.schema.json](../public/apresentacoes/presentation.schema.json), JSON Schema draft-07, título “Apresentação web Bitaria v1”. SHA-256 conferido: `ab169577d23263cf959819f09409384c2ff7dff8c6e9c71954f4e239b19b89f0`. Forneça esse arquivo ao Work junto deste documento; não invente uma versão alternativa.

O pacote só passa quando atende **simultaneamente** ao schema e às restrições adicionais do [parser ZIP](../public/apresentacoes/package.js). O schema permite alguns caminhos de imagens de decks estáticos que o upload não aceita; as regras mais restritivas de ZIP descritas aqui prevalecem para o pacote.

## 2. Estrutura do ZIP

Forma canônica recomendada:

```text
nome-da-aula.zip
├── apresentacao.json
├── images/
│   ├── uma-imagem.webp
│   └── outra-imagem.png
└── creditos-imagens.md
```

- **Exatamente um JSON:** `apresentacao.json` na raiz. É aceito alternativamente um único `decks/nome-seguro.json`; nunca incluir os dois.
- `images/` é opcional se nenhum slide referencia imagem. Quando houver referência, o arquivo correspondente é obrigatório.
- `creditos-imagens.md` é opcional para o parser, mas recomendado para revisão editorial. Se fornecido, deve ser UTF-8 e não vazio. Não é um arquivo de código nem uma autorização automática de licença.
- Compactar os arquivos **dentro** da pasta de trabalho, sem uma pasta externa envolvendo o pacote. `minha-aula/apresentacao.json` é rejeitado.
- O ZIP aceita entradas de diretório vazias somente `images/` e `decks/`; elas não são necessárias e contam no limite de entradas. Não incluir subpastas nas imagens.
- Não incluir `.DS_Store`, `__MACOSX`, `Thumbs.db`, README, schema, fontes, biblioteca Bitara, arquivos originais, JSON administrativo, respostas privadas, PDF, vídeo, áudio, PPTX, ZIP interno, HTML, CSS ou JavaScript. Esses nomes/extensões não fazem parte da lista permitida.
- Guardar schema, instruções, relatórios e outros entregáveis **fora** do ZIP de importação.

### Nomes e referências de imagem

Nome permitido no ZIP:

```text
images/[a-z0-9][a-z0-9_-]{0,99}.(webp|png|jpg|jpeg)
```

Isso significa nome-base de 1–100 caracteres ASCII, começando por letra minúscula ou número, continuando com minúsculas, números, hífen ou underscore; extensão minúscula. Sem espaços, acentos, pontos extras, subpastas, barras invertidas ou caminhos absolutos.

No JSON, referencie assim:

```json
"image": {
  "src": "./images/uma-imagem.webp",
  "alt": "Descrição útil do conteúdo visual",
  "caption": "Autor, obra e data. Licença. Alterações realizadas."
}
```

A correspondência é exata e diferencia maiúsculas/minúsculas. O parser remove somente `./` para localizar `images/uma-imagem.webp`. Mesmo na variante `decks/nome.json`, usar `./images/...`, não `../images/...`: o vínculo é lógico na raiz do pacote, não relativo à pasta decks. Uma imagem pode ser reutilizada em vários slides e deve aparecer uma só vez no ZIP.

Não usar imagens remotas HTTP/HTTPS, URLs Drive, `data:`, base64, `blob:`, SVG ou caminhos de biblioteca em `image.src`. O schema geral aceita SVG e maiúsculas em alguns caminhos estáticos, mas **o importador ZIP os rejeita**. A vinculação local usa URLs Blob criadas pela plataforma; a versão salva usa URLs assinadas de Storage. O Work não gera essas URLs e não altera os caminhos após importar.

## 3. JSON: raiz e regras comuns

Raiz com somente estes três campos, todos obrigatórios:

| Campo | Tipo / limite |
|---|---|
| `schemaVersion` | Inteiro, exatamente `1`. Não usar string nem `2`. |
| `title` | Texto não vazio, 1–160 caracteres. |
| `slides` | Lista com 1–60 objetos de slide. A ordem da lista é a ordem de exibição. |

Não há campo opcional na raiz. Propriedades desconhecidas são rejeitadas na raiz, nos slides e nos objetos internos. Strings fornecidas não podem ser vazias nem conter somente espaços. Omitir opcionais sem conteúdo; não enviar `null`, `""` ou listas vazias. Limites são de comprimento dos textos; tamanhos de arquivos são medidos em bytes UTF-8.

Todos os dez tipos de slide aceitam estes campos comuns:

| Campo | Obrigatório? | Limite / comportamento |
|---|---|---|
| `type` | Sim | Um dos dez valores da próxima tabela. |
| `title` | Sim | Texto 1–140; título visível. |
| `eyebrow` | Não | Texto 1–80; chamada curta acima do título. |
| `subtitle` | Não | Texto 1–240. |
| `note` | Não | Texto 1–500; **visível ao aluno**, não é anotação privada da professora. |
| `sources` | Não | Lista de 1–6 textos, cada um com 1–500 caracteres. |
| `mascot` | Não | Objeto com somente `category` **ou** somente `id`; nunca os dois. |

O conteúdo é texto simples. `body`, `note` e `code` não executam HTML, JavaScript ou Markdown. Um exemplo HTML em `code` é exibido como código, não como aplicação executável.

### Tipos de slide e campos específicos

Além dos campos comuns, **somente** os específicos abaixo são permitidos em cada tipo:

| `type` | Campos específicos obrigatórios | Campos específicos opcionais | Limites |
|---|---|---|---|
| `cover` | Nenhum | `body` | body: 1–500. Não é obrigatório começar por capa. |
| `concept` | `body` | Nenhum | body: 1–1200. |
| `image` | `body`, `image` | Nenhum | body: 1–800; objeto image descrito abaixo. |
| `comparison` | `columns` | Nenhum | Exatamente 2 colunas; não aceita body de slide. |
| `timeline` | `items` | Nenhum | 2–6 itens; não aceita body de slide. |
| `steps` | `items` | Nenhum | 2–6 itens; não aceita body de slide. |
| `highlight` | `body` | Nenhum | body: 1–650. |
| `example` | `body`, `code` | Nenhum | body: 1–500; code: 1–1800. |
| `summary` | `items` | Nenhum | 2–6 itens; não aceita body de slide. |
| `closing` | `body` | Nenhum | body: 1–650. Não é obrigatório terminar por encerramento. |

`type` e `title` são obrigatórios em todas as linhas. Não incluir `image` em concept/cover ou `code` em outro tipo: campos fora do layout são rejeitados. Não existem IDs de slide, estilos livres, tamanho de fonte, cores, fundos, posições, bullets de strings, animações ou layouts customizados neste contrato.

**Objeto `image`** (somente slide image): `src` e `alt` obrigatórios; `caption` opcional. `src`: 1–160 caracteres, padrão geral `^\./images/[a-zA-Z0-9_-]+\.(svg|png|jpg|jpeg|webp)$`, sujeito à regra ZIP mais restrita da seção 2. `alt`: 1–300. `caption`: 1–300. Não aceita width, height ou campos adicionais.

**Objeto de coluna** (comparison): somente `title` e `body`, ambos obrigatórios; title 1–100 e body 1–700. Não usar objetos image dentro das colunas.

**Objeto de item** (timeline, steps e summary): `title` obrigatório, 1–100; `label` opcional, 1–24; `body` opcional, 1–500. Não há campos `date`, `year`, `text`, `children` ou resposta. Sem label, o viewer numera o item visualmente.

### Mascote oficial Bitara

Usar, por exemplo:

```json
"mascot": { "category": "explicando" }
```

Categorias exatas: `pensativa`, `investigadora`, `programadora`, `comemorando`, `explicando`, `surpresa`, `neutra`, `outras`.

Alternativamente, `{"id":"bitara-..."}` com ID real fornecido pelo catálogo oficial. O campo id aceita 1–80 caracteres e padrão `^bitara-[a-z0-9-]+$`. Não inventar IDs, não enviar ambos os campos e não incluir arquivos de poses no ZIP.

O schema valida formato/enum, não garante a existência de um ID específico no catálogo. O seletor usa somente imagens revisadas, busca ID/categoria e depois fallback; portanto um ID sintaticamente válido pode mostrar fallback. Preferir category e revisar o resultado. O ambiente implantado deve manter a biblioteca oficial completa em `/biblioteca-bitara/`.

## 4. Créditos e fontes

Para cada imagem de terceiros, registrar autor, obra, data quando conhecida, licença, URL da licença/origem e alterações. Usar `image.caption` para a atribuição visível e `sources` para URLs completas. Incluir os detalhes extensos em `creditos-imagens.md`, respeitando o limite de 300 caracteres da legenda.

O viewer transforma em links apenas strings de URL HTTPS válidas, sem usuário/senha e sem porta diferente de 443. Uma string como `NASA — https://...` fica como texto: preferir a URL sozinha em uma entrada de sources. URLs Creative Commons em sources são exibidas também como link de licença na legenda do slide de imagem. Não há campo `licenseUrl` ou `author` separado no schema.

O Markdown de créditos é armazenado como arquivo, mas **não é automaticamente renderizado como slide ou legenda**. Não deixar toda a atribuição somente nesse arquivo. Validar a estrutura não comprova direitos autorais ou precisão histórica; a revisão editorial continua humana.

## 5. Limites e validações adicionais do pacote

Valores exatos do código, evitando a ambiguidade de MB/KB:

| Recurso | Limite |
|---|---|
| ZIP comprimido | 10.485.760 bytes (10 MiB). |
| Soma expandida de arquivos | 26.214.400 bytes (25 MiB). |
| Entradas ZIP | 1–80, incluindo diretórios explícitos. |
| JSON | 512.000 bytes (500 KiB). |
| Cada imagem | 5.242.880 bytes (5 MiB). |
| Créditos | 102.400 bytes (100 KiB). |
| Dimensões de imagem | Largura/altura positivas, produto até 16.000.000 pixels. |
| Nome de entrada | Até 160 caracteres, além do padrão restrito de cada caminho. |
| Expansão por entrada | Tamanho expandido não pode superar `max(1024, tamanhoComprimido × 200)`. |

Métodos ZIP aceitos: stored (0) e deflate (8). Sem criptografia/senha, ZIP64 ou múltiplos volumes. Rejeitam-se entradas vazias de arquivos, caminhos inseguros, nomes duplicados inclusive com mudança de caixa, symlinks, sobreposição de entradas, divergências entre cabeçalhos/diretório, CRC32 ou tamanho incorretos e excesso real de descompressão. O pacote não é extraído em diretórios nem executado pelo servidor.

JSON: UTF-8, com BOM inicial tolerado. Créditos: UTF-8. Imagens: PNG, JPEG (`jpg`/`jpeg`) ou WebP com assinatura/container e dimensões verificadas; o parser rejeita a flag de animação WebP no cabeçalho VP8X. Não interpretar a checagem de cabeçalho como prova completa de decodificação: abrir cada imagem na prévia continua necessário. Por orientação de autoria, usar imagens estáticas.

SHA-256 é calculado por arquivo e pelo ZIP. O parser verifica schema e existência de todas as imagens referenciadas. A Edge Function repete a validação, e o registro no banco confere manifesto e metadados dos objetos enviados. Extensão e tamanho declarados pelo cliente não bastam.

**Avisos, não erros bloqueantes:** créditos ausentes; imagem de slide sem caption; imagem enviada mas não usada. Não há exigência automática de licença ou fonte preenchida: o administrador deve conferir antes de publicar.

## 6. O que efetivamente é suportado

| Recurso | Suporte real |
|---|---|
| Slides e imagens | Sim, nos dez layouts e limites descritos. |
| Código HTML como exemplo | Sim, texto em slide example; não executa. |
| Pergunta para discussão em sala | Sim, como texto de um layout válido, sem coleta/correção. |
| Quiz com alternativas, gabarito, nota ou tentativas | **Não** neste ZIP. Não há tipo quiz. Atividade quiz da plataforma usa outro contrato/fluxo. |
| Associação/ordenação interativa | **Não**. timeline/steps são listas visuais, não exercícios avaliados. |
| Flashcards com verso e persistência | **Não**. Não inserir cards/answers neste JSON. |
| Mapa mental | Pode ser **imagem estática** em slide image, ou síntese textual em summary. Não cria atividade mindmap, grafo interativo ou nós/arestas. Não enviar PDF. |
| Vídeo/áudio incorporado | Não. Uma URL em sources é referência, não player. |
| Atividades e aula novas | Não cria, importa nem publica a aula; precisa de aula existente. |
| XP e progresso | Não concede, não redefine e não importa. Ver todos os slides não conclui estudo. |
| Versões, prévia, publicação/reversão | Implementados no gerenciador, dependentes da implantação. |
| Exportação automática do Work para API | Não há conexão automática Work → Bitaria nem monitoramento de Drive. O administrador seleciona o ZIP. |
| PDF/PPTX para slides automaticamente | Não. O Work precisa produzir o JSON e as imagens aceitos. |

Não ocultar gabaritos em note: esse texto é visível ao aluno. Quando a aula precisar de quizzes, projetos, flashcards ou mapa como atividade separada, produzir material separado sob o contrato apropriado e encaminhar a um fluxo explicitamente autorizado; não misturar arquivos administrativos neste ZIP.

## 7. Relação com aula e atividade existentes

1. O administrador abre **Gestão do sistema → Conteúdo → aula → Apresentações web**. A aula é escolhida na plataforma, não descoberta pelo título ou nome do ZIP.
2. Seleciona Nova apresentação ou uma apresentação da mesma aula para criar outra versão. A API recebe o UUID da aula em `x-lesson-id` e, opcionalmente, o UUID da apresentação em `x-presentation-id`; isso é contexto do painel, **não campo do JSON do Work**.
3. Seleciona ZIP: validação e prévia local no navegador, sem upload. Imagens são associadas aos caminhos do JSON com Blob URLs temporárias.
4. Salvar rascunho validado: usuário autenticado, perfil admin ativo, aula existente, validação repetida no servidor, uploads privados e registro de versão. A versão é imutável e começa sem ativação automática. Mesmo ZIP na mesma aula é rejeitado; a deduplicação usa bytes/hash do ZIP, não equivalência semântica do texto.
5. Abre a prévia da versão salva, confirma revisão de textos/imagens/créditos e publica aquela versão. Publicar ativa `active_version_id`; **não publica a aula**.
6. Escolhe uma atividade `slides` existente e ativa **da mesma aula**, revisa UUID/key/recurso original e confirma o vínculo separadamente. O servidor exige apresentação com versão ativa e rejeita referência anterior desatualizada.
7. O vínculo é auxiliar em `web_presentation_links`. Não reescreve `lesson_activities.content_json`, UUID, key, revisão, obrigatoriedade, pré-requisitos ou histórico. Não usa o importador administrativo completo.
8. Aluno precisa estar autorizado à aula e à atividade, cumprir os pré-requisitos aplicáveis, e acessar uma versão ativa vinculada a slides publicados. Aula planned, versão sem vínculo ou rascunho não se torna pública pelo endereço.

O vínculo é por atividade, não por faixa de slides: **não há seleção de páginas/slides por vínculo**. Se duas atividades usarem a mesma apresentação, ambas abrem o deck completo. Revisar as instruções existentes antes de propor substituição de materiais segmentados.

URL gerenciada estável: `/apresentacoes/gerenciada/<presentation_uuid>`, no domínio real do ambiente. Exige autorização; não é um link público universal. Storage privado `web-presentations`, prefixo `presentations/<presentation_uuid>/versions/<version_uuid>/`; JSON normalizado no armazenamento para `apresentacao.json`, sem reescrever seus bytes. As imagens mantêm `images/nome.ext`. Downloads usam URLs assinadas de 300 segundos; a página do aluno renova autorização a cada dois minutos. URLs já emitidas podem funcionar até expirar após revogação. O Work nunca deve embutir URLs assinadas ou localhost no material final.

Confirmar estudo continua na aula e usa a regra central **activity_study** e a RPC já existentes. Viewer, importação, ativação, vínculo e reversão não concedem XP automaticamente. Não prometer quantidade fixa de XP no pacote.

## 8. Exemplo mínimo válido e como testar

Arquivos entregues:

- [ZIP mínimo](examples/work-bitaria-minimo.zip): dois arquivos na raiz, sem imagem, **591 bytes**.
- [JSON](examples/work-bitaria-minimo/apresentacao.json).
- [Créditos](examples/work-bitaria-minimo/creditos-imagens.md).
- [Validador local de apoio](examples/validar-pacote-work.mjs), que chama o parser existente sem rede/upload.

O mínimo estrutural seria somente o JSON abaixo; os créditos foram incluídos no exemplo entregue para evitar o aviso de ausência. O validador não exige três slides, capa ou imagem.

```json
{
  "schemaVersion": 1,
  "title": "Exemplo mínimo — Bitaria",
  "slides": [
    {
      "type": "concept",
      "title": "Uma página conecta ideias",
      "body": "HTML organiza o conteúdo de uma página. Este material é apenas uma apresentação de homologação."
    }
  ]
}
```

No ambiente Node já instalado no repositório, sem instalar pacotes:

```text
node docs/examples/validar-pacote-work.mjs docs/examples/work-bitaria-minimo.zip
npm.cmd run test:presentation-manager
npm.cmd run test:presentation-manager:browser
```

O primeiro comando lê apenas arquivos locais e retorna valid/slides/files/warnings/hash. Não executa SQL nem upload. As duas suítes usam dados sintéticos e banco isolado; o transporte de Auth/Storage é simulado. Não são comandos de implantação. O parser usa APIs Web, incluindo DecompressionStream deflate-raw; foi executado no Node 22.19.0 disponível. Não instalar/atualizar ferramentas apenas para seguir estas instruções sem necessidade.

Resultados desta verificação: **5 testes de pacote/servidor e 1 cenário de navegador passaram**. O cenário cobre prévia, salvamento, publicação, atualização, reversão, vínculo e aluno sem XP automático. Exemplo mínimo: válido, 1 slide, 2 arquivos, nenhum aviso. A primeira execução da suíte foi impedida pelo sandbox (`spawn EPERM`); a repetição autorizada passou. Permanece aviso de Browserslist desatualizado. Nenhum build foi reexecutado porque não houve alteração de aplicação.

## 9. Aula 02 — compatibilidade e preservação

**Sim: o pacote de apresentações da Aula 02 já é aceito na variante `decks/html-m01-s01-a02.json`; não precisa mudar o conteúdo.** Nesta tarefa foi validado o material real em `tmp/a02-integration/package`, além da fixture usada na suíte.

Foi gerada também uma cópia canônica de importação, somente mudando o nome da entrada ZIP do JSON para `apresentacao.json`. Os bytes do JSON, das seis WebP e dos créditos foram preservados e comparados por SHA-256, antes/depois. O JSON coincide também com o deck público local `public/apresentacoes/decks/html-m01-s01-a02.json`.

- [Pacote canônico local da Aula 02](../tmp/work-bitaria-contract/html-m01-s01-a02-importacao.zip): **570.518 bytes**, 15 slides, 8 arquivos, seis imagens, nenhum aviso.
- [Evidência de validação local](../tmp/work-bitaria-contract/validation.json).
- JSON schema SHA-256: conforme seção 1. Hash do ZIP canônico: `01f753f997ec50de3e49fe4274302af0c026a64716e6739afa3699e0e946b5b5`.

Essa preservação é do **conteúdo do pacote de apresentação**, não de toda a aula ou de suas atividades. Fontes, legendas, Paul Clarke/CC BY 2.0, link de licença e indicação de alterações permanecem no deck. As poses continuam sendo selecionadas pelo catálogo já instalado, não copiadas para dentro do ZIP.

Pendências pedagógicas já identificadas: A02 tem duas atividades de estudo com referências a páginas do PDF, e o deck web tem 15 slides com organização diferente; vínculo não realiza conversão das instruções. O deck menciona flashcards ausentes no inventário atual da A02. Na leitura de 02/11 a aula está planned, com seis atividades publicadas. Não alterar silenciosamente para “corrigir” a compatibilidade. Revisão editorial e vínculo concreto continuam sujeitos a aprovação; o pacote não foi enviado/importado/publicado.

## 10. Instrução pronta para fornecer ao ChatGPT Work

> Produza a apresentação solicitada para a Bitaria seguindo estritamente o contrato de apresentações v1 e o arquivo presentation.schema.json anexado. Entregue um ZIP tradicional sem senha, com exatamente um apresentacao.json UTF-8 na raiz, imagens estáticas WebP/PNG/JPEG em images/ e creditos-imagens.md. Use somente os dez tipos de slide e os campos definidos neste documento; não crie HTML, scripts, schema alternativo ou aplicativo. As imagens devem usar ./images/nome.ext, nomes minúsculos seguros, alt text e atribuição/licença visível em caption e sources. Use apenas mascot.category oficial ou ID real fornecido; não gere poses. Não inclua JSON administrativo de aula, quizzes avaliados, gabaritos, teacherOnly, atividades, XP, IDs de banco ou URLs assinadas. Perguntas para discussão podem ser texto de slides válidos; mapas podem ser imagens estáticas ou sínteses, sem prometer atividade interativa. Preserve a sequência e objetivos pedagógicos fornecidos. Não anuncie recursos de outra atividade que não esteja confirmada. Revise conteúdo, contraste, tamanho de texto, imagens e créditos em desktop/celular. Entregue o ZIP baixável, sem pasta externa e sem arquivos extras; mantenha relatório e instruções de uso fora do ZIP. Se não puder gerar algum arquivo ou validar o ZIP, declare a pendência, sem afirmar que foi homologado. Não publique nem altere a plataforma.

Checklist de entrega do Work: JSON válido; 1–60 slides; layout/campos corretos; imagens presentes e decodificáveis; nomes/caminhos exatos; créditos; respeito a bytes/entradas; ausência de arquivos privados/executáveis; nenhuma promessa de quiz/XP; ZIP selecionável no painel. A revisão do administrador é uma etapa posterior obrigatória para ativação.

## 11. Pendências para colocar o gerenciador em funcionamento

1. Retomar a autorização de implantação em etapa própria, com auditoria/recuperação aprovada. A pendência de recuperação não foi resolvida por este contrato; backup e AWS não foram retomados.
2. Confirmar branch/commit/equipe/ambiente e um release isolado; não publicar indiscriminadamente o checkout atual nem conteúdos reais junto do gerenciador.
3. Conferir pré-requisitos e inventário para aplicar somente a migration necessária `20261031105202_managed_web_presentations.sql`, sem push geral de migrations. Instalar bucket privado, tabelas/RPCs/políticas e auditoria que essa implementação exige, somente após autorização.
4. Implantar `import-web-presentation`, verificar empacotamento do parser/schema compartilhados e autenticação. O código depende de clientes de servidor; nunca copiar credenciais para o Work ou o ZIP.
5. Publicar o frontend autorizado, preservando viewer e biblioteca oficial; conferir a rota HTTPS real. Os nomes de rota neste documento não são URLs públicas já homologadas.
6. Homologar o pacote mínimo em aula sintética, transporte HTTP real, Auth, RLS, Storage privado, CORS, limites e URLs assinadas; validar admin/aluno e negar anônimo, inativo, rascunho e aluno não autorizado. CORS `*` no handler não substitui autorização.
7. Validar concorrência, rollback de versão e limpeza de upload parcial. Não há exclusão automática de versões; falha de limpeza pode deixar objetos órfãos privados, exigindo procedimento operacional.
8. Só depois apresentar a proposta concreta da Aula 02: aula/atividade/UUID/key/referência atual e proposta. Aguardar aprovação para publicar/vincular. Não reimportar a aula inteira, não duplicar atividades e não mudar obrigatoriedade, XP ou histórico.

Nenhuma migration, deploy, push, merge, importação remota ou alteração de produção foi executada nesta tarefa. Nenhum novo importador foi desenvolvido e nenhum schema/código da aplicação foi modificado.

## 12. Mapa de implementação e testes inspecionados

| Arquivo | Responsabilidade |
|---|---|
| [schema](../public/apresentacoes/presentation.schema.json) / [validate.js](../public/apresentacoes/validate.js) | Contrato exato e validador compartilhado. |
| [package.js](../public/apresentacoes/package.js) | Estrutura ZIP, limites, imagens, integridade e referências. |
| [WebPresentationManager.tsx](../src/components/management/WebPresentationManager.tsx) | Seleção de aula/apresentação, prévia, versões, confirmação e vínculo. |
| [webPresentations.ts](../src/lib/webPresentations.ts) | Parser local, Blob URLs, API, URLs assinadas e vínculo em execução. |
| [handler](../supabase/functions/import-web-presentation/index.ts) | Autorização, validação repetida, upload privado e registro. |
| [migration](../supabase/migrations/20261031105202_managed_web_presentations.sql) | Tabelas, RLS, versões, auditoria, ativação e vínculo auxiliar. |
| [PresentationFrame.tsx](../src/components/learning/PresentationFrame.tsx) / [viewer.js](../public/apresentacoes/viewer.js) | Reuso do visualizador existente e mensagens verificadas por origem/janela/nonce. |
| [presentation-package.test.mjs](../tests/presentation-package.test.mjs) | A02/raiz válidos, esquema, caminhos, extensões falsas, CRC e bombas ZIP. |
| [managed-presentations.test.mjs](../tests/managed-presentations.test.mjs) | Pipeline/migration reais isolados, permissões, versões, vínculo e preservação de atividades/XP. |
| [managed-presentations-browser.test.mjs](../tests/managed-presentations-browser.test.mjs) | Fluxo administrativo e aluno, imagem privada/Bitara e ausência de XP automático. |
