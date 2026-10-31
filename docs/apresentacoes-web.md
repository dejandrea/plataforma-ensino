# Apresentações web Bitaria

Template independente em `public/apresentacoes/`, implementado conforme `docs/prompts/Template de apresentações web para as aulas.md`. Sem migrations, novas regras de XP, importação de conteúdo real ou publicação da Aula 02.

## Abrir e produzir

1. Execute `npm.cmd run dev` e abra `/apresentacoes/` no endereço local exibido pelo Vite.
2. A demonstração da Aula 02 abre por padrão. Para começar do zero, copie `public/apresentacoes/decks/template.json`.
3. Preencha o JSON e use **Abrir JSON** para validar e visualizar. O arquivo permanece no navegador; não há upload, salvamento em banco nem transmissão do conteúdo.
4. Para disponibilizar uma apresentação futuramente, salve o JSON revisado em `public/apresentacoes/decks/nome-da-aula.json`. A URL será `/apresentacoes/?deck=nome-da-aula`.
5. Execute `npm.cmd run test:presentations` e `npm.cmd run test:presentations:browser` antes de entregar alterações no template.

Todos os recursos de execução são locais, inclusive fonte, contrato e imagem da demonstração. O template é servido por HTTP(S), pelo Vite ou por uma hospedagem estática; abrir `index.html` diretamente por `file://` não carrega os JSONs. Copiar a pasta completa preserva seus caminhos relativos. As referências históricas aparecem como texto, sem carregar páginas ou serviços externos.

O template também aceita a [biblioteca visual oficial da Bitara](biblioteca-visual-bitara.md): adicione `"mascot": {"category": "investigadora"}` ou `"mascot": {"id": "bitara-044"}` a qualquer slide. Ao copiar o pacote, inclua `public/biblioteca-bitara` na raiz pública junto com `apresentacoes`. A demonstração está em `/apresentacoes/?deck=bitara-demo`; a galeria de revisão, apenas em desenvolvimento, em `/__dev/bitara`.

## Contrato definitivo v1

Contrato independente do contrato de atividades JSON v2. Schema executável: [presentation.schema.json](../public/apresentacoes/presentation.schema.json). Exemplo completo com dez layouts: [aula-02-demo.json](../public/apresentacoes/decks/aula-02-demo.json).

```json
{
  "schemaVersion": 1,
  "title": "Título da aula",
  "slides": [
    {"type": "cover", "title": "Título da missão", "subtitle": "Convite à descoberta"},
    {"type": "concept", "title": "Uma ideia", "body": "Explicação breve."},
    {"type": "closing", "title": "Continue sua jornada", "body": "Volte para a aula."}
  ]
}
```

Raiz: apenas `schemaVersion: 1`, `title` (1–160 caracteres) e `slides` (1–60 slides). Cada slide exige `type` e `title` (1–140 caracteres). Campos comuns opcionais: `eyebrow` (80), `subtitle` (240), `note` (500) e `sources` (1–6 textos de até 500 caracteres cada). Textos devem conter caracteres além de espaços. Campos desconhecidos são rejeitados.

| Tipo | Campos específicos | Uso |
| --- | --- | --- |
| `cover` | `body` opcional, até 500 caracteres | Capa com símbolo gráfico |
| `concept` | `body`, até 1.200 | Explicação de conceito |
| `image` | `body`, até 800; `image` | Texto e imagem |
| `comparison` | `columns`, exatamente 2 objetos `{title, body}` | Comparação lado a lado |
| `timeline` | `items`, de 2 a 6 | Linha do tempo vertical |
| `steps` | `items`, de 2 a 6 | Etapas numeradas |
| `highlight` | `body`, até 650 | Curiosidade ou destaque |
| `example` | `body`, até 500; `code`, até 1.800 | Exemplo de código sem execução |
| `summary` | `items`, de 2 a 6 | Resumo visual |
| `closing` | `body`, até 650 | Encerramento |

`columns`: título até 100 e corpo até 700 caracteres. Cada item de `items` contém `title` obrigatório (100), `body` opcional (500) e `label` opcional (24), útil para datas. Sem `label`, o visualizador usa números. O schema contém todos os limites.

`image`: `src` e `alt` obrigatórios; `caption` opcional. `src` deve apontar para `./images/nome.svg`, `.png`, `.jpg`, `.jpeg` ou `.webp`, sem caminhos externos, barras adicionais ou parâmetros. Guarde as imagens na pasta `images/`; SVGs são arquivos locais revisados, nunca HTML/SVG fornecido no JSON. Use texto alternativo que explique a imagem e o que ela ensina. Falhas de imagem exibem a descrição e mantêm o texto do slide.

O visualizador implementa o subconjunto de JSON Schema utilizado por este contrato. Os testes verificam os exemplos válidos e entradas inválidas também com Ajv. Não acrescente palavras-chave ao schema sem implementar e testar seu suporte em `validate.js`.

## Orientação para o Work

Produza somente um documento que respeite `presentation.schema.json`. Use `template.json` como ponto de partida e `aula-02-demo.json` como catálogo de layouts. Uma ideia por slide; distribua explicações extensas em vários slides. Preserve o conteúdo pedagógico aprovado e cite as fontes em `sources` quando necessário. Não invente materiais oficiais ausentes. Não adicione HTML, scripts, CSS, gabaritos, notas ou regras de XP. Código de exemplo é texto e não será executado.

Para imagens, use somente arquivos disponíveis e revisados no pacote, com caminhos locais válidos. Abrir um JSON do computador resolve as imagens em relação ao visualizador, não em relação à pasta do arquivo escolhido. O limite de abertura local é 500 KB por JSON; imagens ficam em arquivos separados.

## Navegação e acessibilidade

Botões Anterior/Próximo, setas do teclado, Home/End e deslize horizontal no slide. Campos e controles mantêm seu comportamento normal de teclado. A troca move o foco para o slide e anuncia sua posição; a barra de progresso tem rótulo acessível. Não há avanço automático. A preferência por movimento reduzido desativa as transições. A tela cheia aparece quando suportada e tem recuperação em caso de recusa do navegador.

Em telas menores, colunas viram uma sequência vertical. Slides longos podem exigir rolagem vertical para preservar a legibilidade. A apresentação não usa dimensões fixas que cortem o texto.

## Compatibilidade e integração

O tipo existente `slides` aceita `content.format: "link"`. A integração de menor impacto consiste em cadastrar a URL HTTPS final da apresentação como `resourceUrl`, mantendo os demais campos da atividade e a regra central `activity_study`.

Trecho ilustrativo de `content` de uma atividade `slides` existente:

```json
{
  "schemaVersion": 1,
  "type": "slides",
  "format": "link",
  "resourceUrl": "https://DOMINIO-DA-PLATAFORMA/apresentacoes/?deck=nome-da-aula",
  "altText": "Apresentação web da aula"
}
```

Substitua o domínio e o nome pela URL publicada e validada antes de usar. Não foi realizado cadastro ou importação nesta etapa. O componente `ResourceActivity` já oferece **Abrir material de estudo em nova aba** para links; a prévia administrativa conserva esse comportamento. O aluno retorna à aba da aula e usa **Confirmar estudo**, como hoje. Ver ou chegar ao final da apresentação não conclui atividades, não grava progresso e não concede XP. Os slides web não fazem chamadas a Supabase nem à API da plataforma.

Não foi adicionado iframe automático nem um novo tipo de atividade. Assim, PDFs, vídeos, cartões didáticos e demais recursos continuam com os contratos existentes. Uma futura incorporação interna pode ser tratada separadamente, caso desejada.

Optou-se por HTML/CSS/JS em vez de Reveal.js porque esta fase precisa apenas de layouts, navegação e JSON, com conteúdo fluido em celular. A alternativa evita dependência adicional, transformação de Markdown e redimensionamento de um palco fixo; não há motor de avaliação nem sistema de autoria. A implementação permanece independente do React, e o Vite copia a pasta sem alterações ao build.

## Piloto e implantação

A demonstração segue os nomes e objetivos de `documento-mestre-curricular.md`, Aula 02. As explicações históricas breves são material demonstrativo para revisão, com referências ao Computer History Museum, King’s College Cambridge, NASA e CERN nos slides. Não substituem uma versão pedagógica homologada. O diagrama é didático, local e não representa uma imagem histórica.

Branch: `feat/template-apresentacoes-web`. Antes de disponibilizar o piloto aos alunos, revisar a redação pedagógica e autorizar publicação e vinculação. Os arquivos em `public/` serão públicos quando houver deploy; este pacote contém apenas demonstração, template e recursos locais, sem dados de alunos ou material reservado. A Aula 02 no banco permanece inalterada e não foi liberada.

## Verificação

Resultado local: os dois testes de contrato, o cenário completo de navegador e o build de produção passaram. A revisão visual cobriu os 11 slides da demonstração, com capturas de desktop e celular. O build mantém os avisos existentes de tamanho de bundles e atualização de Browserslist.

- Contrato: dez layouts, limites, campos desconhecidos, versões, estruturas inválidas e caminhos de imagem proibidos.
- Navegador: todos os slides em 1366, 768 e 390 px, sem rolagem horizontal; navegação, limites, teclado, toque, abertura local, JSON inválido, erros de carregamento e renderização segura de HTML como texto.
- Ausência de requisições externas, chamadas de progresso e XP no cenário de teste.
- Capturas para revisão em `test-results/presentation-*.png` (pasta ignorada pelo Git).

Comandos:

```text
npm.cmd run test:presentations
npm.cmd run test:presentations:browser
npm.cmd run build
```
