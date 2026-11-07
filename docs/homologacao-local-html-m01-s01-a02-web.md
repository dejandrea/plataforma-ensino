# Aula 02 — validação local da apresentação web

Estado: integração técnica local, sem deploy, sem URL HTTPS final e sem importação da candidata. A aprovação editorial da usuária e a autorização de publicação continuam pendentes.

## Origem e arquivos

Pacote obtido pela conexão Google Drive, na [pasta entregue](https://drive.google.com/drive/folders/1w7tnnyBAeV3or-wHrekyY8hBcc3vRFJe), subpasta `apresentacao-web`. O ZIP `HTML-M01-S01-A02-pacote-web.zip` contém o JSON, seis WebP e um documento de créditos. Os sete arquivos de conteúdo conferem, byte a byte por SHA-256 e tamanho, com o manifesto recebido.

Copiados para a área pública apenas:

- `public/apresentacoes/decks/html-m01-s01-a02.json` — 15 slides, sem alterações no conteúdo recebido.
- `public/apresentacoes/images/ada-lovelace.webp`.
- `public/apresentacoes/images/charles-babbage.webp`.
- `public/apresentacoes/images/alan-turing.webp`.
- `public/apresentacoes/images/grace-hopper.webp`.
- `public/apresentacoes/images/katherine-johnson.webp`.
- `public/apresentacoes/images/tim-berners-lee.webp`.

Os hashes, a proveniência fornecida e as pendências estão no [manifesto local](manifests/html-m01-s01-a02.web.local.json). `publishedPresentationUrl` permanece `null`. Os documentos administrativos, o manifesto original, o ZIP e os créditos recebidos ficam em `tmp/a02-integration/`, pasta ignorada pelo Git. Nenhum original fotográfico foi baixado ou colocado em `public`.

A biblioteca oficial `public/biblioteca-bitara` foi mantida integralmente. Os pedidos `mascot.category` continuam passando pelo seletor existente; não houve geração, troca ou recorte de poses.

## Visualizador e créditos

Foi reutilizado o viewer existente. O único ajuste funcional em `viewer.js` permite abrir URLs HTTPS de `sources` como links seguros e coloca o link da licença Creative Commons junto à legenda da imagem, sempre visível. Não aceita protocolos executáveis, credenciais ou portas externas não padrão. Textos que não são URLs HTTPS continuam sendo texto simples. Os links abrem em outra aba com `noopener noreferrer`.

A legenda do slide de Tim Berners-Lee conserva **Paul Clarke**, o nome da obra, **CC BY 2.0** e a indicação de conversão para WebP e redução de resolução. O link visível aponta para `https://creativecommons.org/licenses/by/2.0/`. As referências adicionais também ficam disponíveis em “Fontes e referências”. Os textos e arquivos de imagem recebidos não foram reescritos.

Abrir localmente:

`http://localhost:5173/apresentacoes/?deck=html-m01-s01-a02`

“Abrir JSON” carrega o mesmo documento do computador; as imagens continuam sendo carregadas da pasta pública do servidor. O teste utiliza o servidor existente na porta 5173 somente após conferir que ele serve exatamente o JSON atual. Não encerra esse servidor; quando não existe, cria e encerra apenas o próprio servidor de teste.

## Progresso, XP e retorno à aula

O viewer não importa conteúdo, não invoca RPCs, não grava progresso e não concede XP. O teste de navegação e chegada ao último slide verifica ausência de chamadas à API e de métodos de escrita.

O retorno foi exercitado com o componente real `ActivityRenderer` em uma fixture sintética: `slides`, `format: link`, URL HTTPS interceptada inteiramente para o servidor local e nenhuma sessão ou registro real. A apresentação abre em outra aba; ao fechá-la, a aula permanece aberta e **Confirmar estudo** continua disponível. Chegar ao slide 15 não aciona a confirmação. A confirmação da fixture só muda quando o botão da aula é acionado deliberadamente; essa fixture não grava no banco.

Não foram alteradas regras `activity_study`, XP, progresso, componentes de confirmação ou contratos administrativos. Nenhuma atividade existente, UUID ou key foi atualizado no banco. Vídeo e flashcards permanecem sem escrita ou reimportação nesta etapa.

## Candidata administrativa

A candidata original foi lida e reavaliada, sem alteração, pelo `validateLessonImport` real, que usa o schema v2. Ela contém oito keys, com seis atividades obrigatórias e dois reforços opcionais. **O campo `/activities/1/content/resourceUrl` está ausente**, intencionalmente. A validação rejeita o documento, incluindo o diagnóstico de campo obrigatório; os múltiplos diagnósticos de `oneOf` não significam oito novas atividades ou autorização de importação.

Não foi inserida URL local, provisória ou inventada. O resultado é **não pronto para importar**. A validação completa após preenchimento e a projeção oficial `toStudentLesson` ainda precisam ser executadas sobre o documento final, somente depois do deploy autorizado e da confirmação de sua URL HTTPS. O JSON público da apresentação já foi validado no contrato próprio e não contém envelope administrativo nem `teacherOnly`.

As duas atividades de reforço permanecem `required: false` na candidata original. A correspondência das oito keys com o inventário atual do banco não foi homologada aqui, pois não houve consulta ou alteração no banco. Antes de qualquer escrita futura, consultar inventário e backup, reconciliar as oito keys (em especial vídeo e flashcards), apresentar as alterações concretas e obter aprovação. Não repetir a importação integral da Aula 02.

## Evidências locais

Resultado: 5 testes de apresentações, 3 testes de catálogo da Bitara, 2 cenários de navegador das apresentações e 1 cenário da biblioteca passaram. Build de produção local e lint da fixture passaram. As 30 capturas foram inspecionadas, incluindo os créditos e o link de licença de Paul Clarke. O build mantém os avisos existentes de Browserslist e tamanho de bundles.

- Contrato da apresentação: schema v1 e `validatePresentation`, 15 slides, seis caminhos locais, hashes e tamanhos da origem, alt text, legendas e poses oficiais.
- Navegador: desktop 1366 × 900 e celular 390 × 844, todos os 15 slides; imagens decodificadas, `object-fit: contain`, ausência de rolagem horizontal, legendas, link de licença, setas, Home/End, botões e toque.
- Retorno pela aba da aula com confirmação manual preservada; nenhuma escrita do viewer.
- Capturas: `test-results/a02-web/1366-01.png` a `1366-15.png` e `390-01.png` a `390-15.png`, ignoradas pelo Git.
- Regressões do template e da biblioteca oficial Bitara; build de produção local. Build não é deploy.

Comandos de validação:

```text
npm.cmd run test:presentations
npm.cmd run test:presentations:browser
node --test --experimental-test-isolation=none tests/bitara-library.test.mjs
npm.cmd run test:bitara:browser
npm.cmd run build
```

## Pendências de implantação

1. Aprovação da usuária para publicação e deploy.
2. Confirmar a URL HTTPS real da apresentação, acesso sem autenticação indevida e carregamento de imagens e mascote no ambiente publicado.
3. Só então preencher o campo pendente da candidata, mantendo `format: link`, `activity_study` e confirmação de estudo.
4. Executar novamente schema v2, `validateLessonImport` e projeção pública sem `teacherOnly`; atualizar o manifesto com URL real e evidências de produção.
5. Antes de qualquer alteração no banco, reconciliar inventário/backup e obter aprovação das mudanças concretas.

Nenhuma etapa de publicação ou importação está autorizada por esta validação local.
