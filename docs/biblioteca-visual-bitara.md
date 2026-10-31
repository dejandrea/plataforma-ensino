# Biblioteca visual da Bitara

Implementação da especificação `docs/prompts/Biblioteca visual da Bitara para apresentações web.md`, na branch `feat/biblioteca-visual-bitara`. Sem alterações de banco, XP, progresso, publicação de conteúdo ou substituição de imagens originais.

## Arquivos e inventário

- [Inventário completo](bitara-inventory.json): ID, caminho original, nome, formato, dimensões, bytes, SHA-256, duplicatas exatas e referências no código.
- [Classificação revisável](bitara-classification.json): categoria, tags, descrição alternativa, finalidade pedagógica, tipo e estado de revisão.
- Catálogo público reutilizável: `public/biblioteca-bitara/catalog.json`.
- Seleção determinística: `public/biblioteca-bitara/select.js`.
- Derivadas locais: `public/biblioteca-bitara/images/*.webp`.
- Visualizador integrado: `public/apresentacoes/viewer.js`, `viewer.css` e `presentation.schema.json`.
- Galeria exclusiva de desenvolvimento: `dev/bitara.html`, `dev/bitara-catalog.js`; rota servida pelo plugin de desenvolvimento em `vite.config.ts`.

O inventário cobre os 64 PNGs da pasta oficial `src/assets/Mascote Bitara`: 53 poses da personagem, 8 objetos e 3 pranchas com várias poses. Os arquivos foram inspecionados em quatro folhas de contato. Todas as 64 entradas têm classificação geral revisada; nenhuma permanece `pendente_revisao` nesta entrega. Pranchas são classificadas como referência, sem tentar atribuir uma única expressão a todas as poses.

Os 61 arquivos individuais medem 200 × 200 px; as três pranchas medem 1536 × 1024 px. Categorias: 7 pensativas, 5 investigadoras, 8 programadoras, 10 comemorando, 13 explicando, 1 surpresa, 6 neutras e 14 outras (incluindo objetos e pranchas).

Não foram encontradas duplicatas exatas por SHA-256. Há poses visualmente relacionadas com enquadramentos diferentes, por exemplo `bitara-020`, `bitara-038` e `bitara-049` (lupa), e `bitara-019` e `bitara-035` (notebook). Não foram deduplicadas ou tratadas como arquivos intercambiáveis. As pranchas também contêm representações de várias poses individuais; continuam como referências.

Uso existente identificado: `mascote 1.png` é importada por `src/lib/lessonReportPdf.ts`. Esse uso permanece intacto. A tela de login usa `src/assets/logo/logo-mascote.png`, um logotipo composto fora da pasta de poses; os logotipos e avatares da plataforma não foram convertidos nem substituídos por esta biblioteca.

## Escolher uma imagem no JSON

O campo opcional `mascot` está disponível nos dez layouts do contrato de apresentações v1. Apresentações anteriores continuam válidas.

Por categoria:

```json
{
  "type": "concept",
  "title": "Vamos investigar?",
  "body": "Observe o problema e procure os detalhes.",
  "mascot": { "category": "investigadora" }
}
```

Por ID:

```json
{
  "type": "highlight",
  "title": "Olhe mais de perto",
  "body": "Um detalhe pode ajudar a entender uma ideia.",
  "mascot": { "id": "bitara-044" }
}
```

Use **categoria ou ID**, um por solicitação. Categorias aceitas: `pensativa`, `investigadora`, `programadora`, `comemorando`, `explicando`, `surpresa`, `neutra`, `outras`. Não há caminhos, HTML ou texto alternativo arbitrário na solicitação; a descrição alternativa vem da imagem selecionada no catálogo.

O seletor escolhe a primeira pose revisada da categoria por ordem lexicográfica do ID estável, independentemente da ordem do catálogo. Por ID, pode selecionar também um objeto ou uma prancha quando isso for intencional. Objetos e pranchas não participam da seleção automática por categoria. `outras` também inclui poses de leitura e anotação, além dos objetos e pranchas.

Um ID inexistente ou categoria sem pose disponível usa `fallbackId` (`bitara-001`, pose neutra). Categorias desconhecidas são rejeitadas pelo contrato antes da exibição. Se a imagem escolhida falhar, o visualizador tenta uma única vez a pose neutra; se ela também faltar, mostra um aviso discreto e mantém o conteúdo e a navegação do slide. Falha no catálogo também não impede a exibição dos textos. Entradas `pendente_revisao` nunca são escolhidas.

As imagens mantêm suas dimensões e proporções originais, com `object-fit: contain`, sem recorte de rosto ou corpo. Os layouts usam uma coluna própria para a mascote em desktop; no celular, a imagem entra no fluxo vertical. A pose só é solicitada quando o slide está visível. O visualizador não pré-carrega as outras 63 imagens.

Uma demonstração separada está em `/apresentacoes/?deck=bitara-demo`. Ela não altera os materiais da Aula 02 nem exige uma migração.

## Galeria de revisão

Execute `npm.cmd run dev` e abra `/__dev/bitara`. É possível filtrar por categoria e pesquisar por nome, ID ou tag. Cada item mostra miniatura, nome original, ID, categoria, tipo, tags, estado de revisão, texto alternativo, finalidade, dimensões e tamanho da derivada. As miniaturas usam carregamento lazy.

A rota é registrada apenas pelo servidor de desenvolvimento do Vite (`apply: 'serve'` e `configureServer`). Os arquivos da galeria ficam fora de `public` e não são entradas de build. `dist` não contém `dev/` ou `__dev/`. A página não é um painel administrativo e não oferece escrita em banco. O catálogo e as imagens são públicos porque o visualizador precisa carregá-los em apresentações; apenas a interface de revisão fica restrita ao desenvolvimento.

## Otimização e preservação

Originais: **11.170.607 bytes**. Derivadas WebP: **8.308.194 bytes**, aproximadamente **26% a menos**. A conversão usa WebP sem perdas, sem redimensionamento, e verifica igualdade de todos os pixels RGBA, inclusive valores de cor em pixels transparentes. Os arquivos originais não foram renomeados, movidos, excluídos ou sobrescritos. As grandes pranchas permanecem disponíveis por ID, mas não são escolhidas automaticamente como poses.

O catálogo não é importado para o bundle React nem carrega todas as imagens na abertura da plataforma. Slides sem `mascot` não consultam o catálogo. A extensão usa recursos locais; não há serviços externos ou imagens geradas.

## Adicionar ou revisar poses

1. Adicione o arquivo oficial em `src/assets/Mascote Bitara`, preservando os arquivos existentes. Os nomes numerados geram IDs `bitara-NNN`. Para um nome não numerado, declare um novo ID imutável no mapa `named` de `scripts/inventory-bitara.py`. Não reutilize IDs removidos.
2. Execute `python scripts/inventory-bitara.py`. O script requer Python com Pillow, atualiza `docs/bitara-inventory.json` e cria folhas de contato em `tmp/bitara-review/` (ignoradas pelo Git). Os originais são apenas lidos.
3. Inspecione visualmente a nova imagem. Registre sua entrada em `docs/bitara-classification.json`, com os campos `category`, `tags`, `alt`, `purpose`, `reviewStatus` e `kind`. Não deduza uma expressão apenas pelo nome.
4. Use `reviewStatus: "revisada"` somente após a inspeção. Para imagens ainda não verificadas, use `pendente_revisao`; o gerador também cria esse estado por padrão quando não há classificação.
5. Execute `python scripts/build-bitara-library.py`. O script confere o hash dos originais, produz as WebP sem perdas e regenera `catalog.json`. Não edite o catálogo gerado diretamente.
6. Revise `/__dev/bitara` e `/apresentacoes/?deck=bitara-demo`. Execute os testes abaixo. A classificação e os arquivos JSON podem crescer sem alterações no código do visualizador.

Para alterar uma classificação existente, edite o arquivo de classificação e regenere o catálogo. `kind` aceita `pose`, `objeto` e `prancha`. O texto alternativo descreve a evidência visual, sem depender do conteúdo do slide. `purpose` descreve um uso pedagógico sugerido e não é uma interpretação da expressão facial.

Ao copiar o template para outra hospedagem, inclua também a pasta `biblioteca-bitara` na raiz pública. A importação do seletor é relativa entre as duas pastas; as URLs de imagens no catálogo partem da raiz da hospedagem.

## Testes

```text
npm.cmd run test:bitara
npm.cmd run test:bitara:browser
npm.cmd run test:presentations
npm.cmd run test:presentations:browser
npm.cmd run build
```

Os testes verificam os 64 caminhos, hashes e dimensões dos originais, os arquivos WebP, a consistência da classificação, IDs únicos, seleção estável, pendências, fallback, contratos anteriores e solicitações inválidas. No navegador: galeria com filtro e busca, carregamento da imagem atual, seleção por categoria e ID, desktop/celular, proporções, texto alternativo e falhas de imagem e catálogo. As capturas de revisão ficam em `test-results/bitara-*.png`.

Também foi corrigida a resolução de `/apresentacoes/` no servidor de desenvolvimento, para abrir o visualizador em vez da rota genérica da plataforma. Em hospedagens com fallback de SPA, a entrada estática explícita é `/apresentacoes/index.html?deck=bitara-demo`.

Resultado local: 5 testes de contrato/inventário e 2 cenários de navegador passaram, incluindo a regressão do template anterior. A mascote foi exercitada nos dez layouts. Build e lint de `vite.config.ts` passaram; foram mantidos os avisos existentes sobre tamanho de bundles e Browserslist. A revisão das capturas confirmou texto legível e imagens sem recortes em desktop e celular.

Relatório de pendências de classificação: **0 imagens**. A associação pedagógica pode ser refinada pela equipe na galeria; nenhuma pose foi gerada para preencher categorias. Antes de disponibilizar em produção, falta autorizar o deploy e escolher quais apresentações receberão a mascote.
