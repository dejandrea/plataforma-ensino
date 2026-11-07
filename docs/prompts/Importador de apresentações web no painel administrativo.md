# BITARIA — Importador de apresentações web no painel administrativo

## Contexto

Estamos desenvolvendo a plataforma educacional Bitaria, utilizando React, TypeScript, Vite, Tailwind CSS e Supabase.

Já existe um visualizador de apresentações web que utiliza arquivos JSON v1 e imagens locais.

Também existe uma biblioteca oficial da mascote Bitara, com seleção por categoria ou ID.

A Aula 02 — Grandes Nomes da Tecnologia já foi integrada e homologada localmente:

- Deck: `public/apresentacoes/decks/html-m01-s01-a02.json`
- 15 slides.
- Seis imagens históricas em WebP.
- Navegação desktop e mobile validada.
- Créditos e licenças exibidos.
- Nenhuma alteração nas regras de XP ou progresso.

A apresentação foi aprovada editorialmente.

Atualmente, cada nova apresentação exige copiar arquivos para `public/apresentacoes`, modificar o repositório e realizar um novo deploy.

Queremos eliminar essa dependência.

## Objetivo

Implementar no painel administrativo da Bitaria um **gerenciador de apresentações web**, permitindo que um administrador importe, valide, visualize e publique apresentações sem precisar modificar o código ou realizar um deploy para cada aula.

A primeira versão deve funcionar com upload de um pacote ZIP.

Não implementar integração direta com Google Drive nesta etapa.

## 1. Inspeção obrigatória

Antes de modificar qualquer arquivo:

1. Examine a arquitetura atual do projeto.
2. Localize o painel administrativo e o gerenciamento de aulas e atividades.
3. Localize o visualizador web de apresentações.
4. Leia `public/apresentacoes/presentation.schema.json`.
5. Leia a documentação e os testes existentes.
6. Examine a estrutura do Supabase, políticas RLS e buckets existentes.
7. Verifique como as atividades `slides` são armazenadas e vinculadas às aulas.
8. Verifique como o progresso e o XP são concedidos.

Reutilize os contratos e componentes existentes.

Não crie um segundo visualizador.

## 2. Interface administrativa

Adicionar uma seção de gerenciamento de apresentações dentro do fluxo administrativo da aula.

A interface deve permitir:

- Importar um pacote ZIP.
- Visualizar os arquivos encontrados.
- Validar a apresentação.
- Exibir erros e avisos.
- Pré-visualizar os slides.
- Publicar uma apresentação aprovada.
- Visualizar sua URL pública.
- Atualizar uma apresentação existente.
- Consultar o status da publicação.

Utilize a identidade visual existente da Bitaria.

A interface deve funcionar em desktop e mobile.

## 3. Estrutura do pacote

O importador deve aceitar um ZIP contendo, no mínimo:

```text
apresentacao.json
images/
  ada-lovelace.webp
  alan-turing.webp
  grace-hopper.webp
creditos-imagens.md
```

A pasta de imagens e o documento de créditos podem variar conforme a apresentação.

O JSON deve respeitar integralmente o schema v1 existente.

Não exigir que todos os slides tenham imagens.

## 4. Validação e segurança

Implementar validação antes de qualquer publicação.

Verificar:

- Schema JSON v1.
- Quantidade de slides.
- Tipos de slide permitidos.
- Campos obrigatórios.
- Referências de imagens.
- Existência dos arquivos referenciados.
- Formatos de imagem permitidos.
- Tamanho máximo do pacote e dos arquivos.
- Integridade dos arquivos.
- Nomes e caminhos seguros.
- Ausência de arquivos executáveis.

Proteger contra:

- ZIP Slip e path traversal.
- Arquivos com extensão falsa.
- Arquivos excessivamente grandes.
- Bombas de descompressão.
- Duplicação ou sobrescrita acidental.
- Publicação por usuários sem autorização.

Não executar código recebido no pacote.

O JSON deve continuar sendo tratado exclusivamente como dados.

## 5. Armazenamento

Utilizar Supabase Storage, preferencialmente em um bucket dedicado às apresentações.

Planejar uma estrutura como:

```text
presentations/
  html-m01-s01-a02/
    versions/
      v1/
        apresentacao.json
        images/
          ada-lovelace.webp
          alan-turing.webp
```

Os caminhos finais devem ser definidos conforme a arquitetura real.

Implementar políticas de acesso adequadas:

- Somente administradores autorizados podem importar ou publicar.
- Alunos podem ler apenas apresentações publicadas e permitidas.
- Arquivos em rascunho não devem ficar acessíveis publicamente.
- Não expor chaves administrativas no frontend.

Preferir versões imutáveis e publicação por referência à versão ativa, evitando sobrescrever arquivos que já estão sendo utilizados.

## 6. Compatibilidade com o visualizador

Adaptar o visualizador existente para carregar apresentações publicadas pelo novo sistema.

Preservar:

- Layouts existentes.
- Navegação por teclado.
- Navegação por toque.
- Responsividade.
- Acessibilidade.
- Créditos e fontes.
- Seleção da Bitara.
- Segurança na renderização.

Manter compatibilidade com as apresentações estáticas já existentes.

Não quebrar URLs atuais como:

`/apresentacoes/?deck=html-m01-s01-a02`

Definir uma estratégia clara de identificação das apresentações armazenadas no Supabase.

Não permitir URLs arbitrárias ou acesso a arquivos privados por manipulação de parâmetros.

## 7. Integração com a aula

Depois de publicada, uma apresentação deve poder ser vinculada à atividade `slides` da aula.

O sistema deve:

1. Identificar a aula e a atividade existentes.
2. Verificar se já existe uma atividade `slides`.
3. Atualizar a referência dessa atividade quando autorizado.
4. Evitar atividades duplicadas.
5. Preservar identificadores e progresso.
6. Manter a confirmação manual de estudo.
7. Manter as regras atuais de XP.

A visualização dos slides não deve conceder XP automaticamente.

A apresentação continua sendo um recurso de estudo; a confirmação acontece na aula.

Não reimportar o JSON administrativo inteiro para vincular uma apresentação.

## 8. Atualização de versões

Permitir substituir o conteúdo de uma apresentação já publicada.

A atualização deve:

- Criar uma nova versão.
- Preservar versões anteriores.
- Permitir pré-visualização antes da publicação.
- Manter a URL estável da apresentação.
- Evitar perda de progresso.
- Permitir reversão para a versão anterior.

A versão ativa deve ser alterada somente após validação e confirmação administrativa.

## 9. Aula 02 como caso de teste

Utilizar a Aula 02 — Grandes Nomes da Tecnologia como referência.

Arquivos locais existentes:

- `public/apresentacoes/decks/html-m01-s01-a02.json`
- Seis imagens históricas em `public/apresentacoes/images/`
- Manifesto de homologação local.

O relatório de homologação identifica que o JSON administrativo candidato ainda não possui a URL HTTPS definitiva e não está pronto para importação.

Não preencher URLs fictícias.

Não alterar atividades existentes no banco sem consultar o inventário real e apresentar as mudanças propostas.

O objetivo inicial é comprovar que o novo importador consegue receber e validar o pacote da Aula 02.

## 10. Testes obrigatórios

Criar testes automatizados para:

- ZIP válido.
- ZIP inválido.
- JSON incompatível com o schema.
- Imagem ausente.
- Caminho inseguro.
- Arquivo proibido.
- Usuário sem permissão.
- Pré-visualização.
- Publicação.
- Atualização de versão.
- Reversão.
- Vinculação à atividade existente.
- Preservação de progresso e XP.
- Compatibilidade com decks estáticos.

Executar testes de navegador em desktop e mobile.

Executar build de produção.

Não remover testes existentes.

## 11. Limites desta tarefa

Você pode implementar código, componentes, testes e migrações necessárias no repositório.

Entretanto:

- Não executar migrações no Supabase de produção sem autorização.
- Não realizar deploy de produção sem autorização.
- Não publicar automaticamente a Aula 02.
- Não alterar atividades reais sem aprovação.
- Não modificar regras de XP.
- Não criar novos contratos pedagógicos sem necessidade.

Se a implementação exigir mudanças estruturais importantes, apresente a proposta antes de executá-las.

## 12. Entrega

Ao finalizar, apresente:

1. Arquivos criados e modificados.
2. Arquitetura implementada.
3. Interface administrativa criada.
4. Estratégia de armazenamento.
5. Migrações necessárias.
6. Políticas de segurança.
7. Testes executados e resultados.
8. Como importar uma apresentação.
9. Como publicar e atualizar versões.
10. Como vincular uma apresentação à aula.
11. Pendências para produção.
12. Riscos identificados.

Priorize uma solução reutilizável, segura e de manutenção simples.

**Comece inspecionando o projeto. Depois implemente e valide localmente, sem executar ações irreversíveis em produção.**