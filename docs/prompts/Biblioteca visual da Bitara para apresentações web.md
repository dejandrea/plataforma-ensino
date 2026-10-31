# CODEX — Biblioteca visual da Bitara para apresentações web

## Contexto

Estamos criando apresentações web para substituir os PDFs das aulas da Bitaria.

O projeto já possui uma pasta com imagens oficiais da mascote Bitara, em diferentes poses e expressões.

Precisamos aproveitar esses arquivos nas apresentações de forma organizada, reutilizável e automatizada.

## Objetivo

Criar um catálogo de imagens oficiais da Bitara, classificadas por expressão, pose e finalidade pedagógica.

A biblioteca será utilizada inicialmente pelo template de apresentações web, mas deve poder ser reaproveitada em outros componentes da plataforma.

## Etapa 1 — Inventário

1. Localize as imagens da Bitara existentes no repositório.
2. Identifique formatos, dimensões, tamanhos e possíveis duplicatas.
3. Não exclua, mova ou renomeie os arquivos originais.
4. Gere um inventário com caminho, nome, dimensões e tamanho de cada imagem.
5. Identifique quais imagens já estão sendo utilizadas pela plataforma.

## Etapa 2 — Classificação

Organize logicamente as imagens nas categorias:

- pensativa
- investigadora
- programadora
- comemorando
- explicando
- surpresa
- neutra
- outras

Adicione tags descritivas para facilitar a seleção.

Classifique apenas quando houver evidência visual suficiente. Não deduza a expressão exclusivamente pelo nome do arquivo.

Caso não consiga analisar visualmente alguma imagem, marque-a como `pendente_revisao`.

## Etapa 3 — Catálogo

Crie um catálogo JSON com:

- ID estável.
- Caminho da imagem.
- Categoria.
- Tags.
- Texto alternativo.
- Dimensões.
- Estado de revisão.

Valide que todos os caminhos apontam para arquivos existentes.

## Etapa 4 — Integração com slides

Permita que o conteúdo de uma apresentação solicite uma pose da Bitara por categoria.

Exemplo:

{
  "mascot": {
    "category": "investigadora"
  }
}

O sistema deve selecionar uma imagem existente nessa categoria.

Requisitos:

- Permitir selecionar uma imagem específica por ID.
- Ter fallback quando a categoria estiver vazia.
- Não utilizar seleção aleatória instável.
- Manter proporções originais.
- Evitar cortes no rosto ou no corpo da personagem.
- Respeitar texto alternativo.
- Não bloquear o carregamento do slide caso uma imagem esteja ausente.

## Etapa 5 — Otimização

Avalie a criação de versões WebP para imagens grandes.

Não sobrescreva os originais.

Não aplique compressão excessiva.

Evite carregar imagens que não estejam sendo exibidas.

## Etapa 6 — Página de catálogo

Crie uma página interna simples, disponível apenas em ambiente de desenvolvimento, que mostre:

- Miniatura de cada imagem.
- Nome e ID.
- Categoria.
- Tags.
- Dimensões.

Essa página permitirá revisar visualmente a classificação.

Não criar um painel administrativo completo nesta fase.

## Entregáveis

1. Inventário das imagens.
2. Catálogo JSON validado.
3. Integração com o template de slides.
4. Página de visualização do catálogo.
5. Documentação de como adicionar novas poses.
6. Relatório das imagens pendentes de classificação.

## Restrições

- Trabalhar em branch isolada.
- Não alterar os arquivos originais.
- Não substituir imagens oficiais por imagens geradas.
- Não modificar banco de dados.
- Não alterar XP ou progresso.
- Não publicar em produção automaticamente.
- Priorizar simplicidade e velocidade de implementação.

## Critério de sucesso

Deve ser possível utilizar uma imagem oficial da Bitara em um slide informando apenas sua categoria ou seu ID.

A classificação deve ser fácil de revisar e ampliar, sem exigir alterações no código do visualizador.