# CODEX — BITARIA: Template de apresentações web para as aulas

## Contexto

Estamos desenvolvendo a Bitaria, uma plataforma gamificada de ensino de programação para crianças e adolescentes.

Precisamos substituir apresentações PDF por apresentações web bonitas, responsivas e de rápida produção.

A prioridade é colocar o Módulo 01 do curso HTML Básico no ar.

Neste momento, NÃO queremos construir um motor completo de slides interativos nem alterar profundamente a arquitetura da plataforma.

## Objetivo

Criar um template reutilizável de apresentações web para a Bitaria, usando preferencialmente Reveal.js, HTML, CSS e JavaScript.

O template deve permitir criar novas apresentações com rapidez, sem precisar redesenhar os slides de cada aula.

## Antes de implementar

1. Inspecione o repositório e a arquitetura atual.
2. Identifique como os recursos de slides são cadastrados e exibidos.
3. Verifique as regras existentes de conclusão, progresso e XP.
4. Identifique as opções de integração com menor impacto.
5. Não altere banco de dados nem contratos existentes sem necessidade.
6. Se Reveal.js for incompatível com a arquitetura, proponha uma alternativa simples e justifique.

## Identidade visual

Seguir o universo visual da Bitaria:

- Fundo: #070820
- Painéis: #291A45
- Ciano: #28DCEB
- Magenta: #E248D2
- Texto: #F5F3FC

Estética gamer futurista, amigável, adequada para crianças e adolescentes.

Usar layouts variados, com boa tipografia, bastante espaço visual e elementos gráficos coerentes.

Não utilizar templates genéricos de apresentações corporativas.

## Tipos de slides necessários

Criar layouts reutilizáveis para:

1. Capa da aula.
2. Apresentação de conceito.
3. Conceito com imagem.
4. Comparação entre dois conceitos.
5. Linha do tempo.
6. Sequência de etapas.
7. Curiosidade ou destaque.
8. Exemplo prático.
9. Resumo visual.
10. Encerramento da missão.

Cada layout deve aceitar conteúdo diferente sem precisar alterar seu código estrutural.

## Requisitos

- Navegação por setas e botões.
- Suporte a toque no celular.
- Layout responsivo.
- Tela cheia quando disponível.
- Indicador de progresso da apresentação.
- Boa legibilidade em notebook, tablet e celular.
- Acessibilidade básica e navegação por teclado.
- Transições discretas.
- Sem dependência de serviços externos para carregar os slides.
- Sem exigir que o professor edite manualmente HTML para cada nova apresentação.

## Formato de conteúdo

Definir um contrato JSON simples para as apresentações.

Exemplo conceitual:

{
  "title": "Grandes Nomes da Tecnologia",
  "slides": [
    {
      "type": "cover",
      "title": "Pessoas que mudaram a tecnologia",
      "subtitle": "Uma viagem pela história da computação"
    },
    {
      "type": "concept",
      "title": "O que é um algoritmo?",
      "body": "Uma sequência de instruções para realizar uma tarefa."
    }
  ]
}

O formato definitivo deve ser documentado e validado.

## Projeto-piloto

Criar uma apresentação de demonstração para:

HTML Básico — Módulo 01 — Submódulo 01 — Aula 02: Grandes Nomes da Tecnologia.

Utilizar o conteúdo pedagógico existente quando estiver disponível no repositório.

Não inventar materiais oficiais ausentes.

A apresentação deve servir para validar a qualidade visual e a facilidade de produção.

## Integração

Verificar como o template pode ser exibido na plataforma atual.

Priorizar a integração mais simples e segura.

Não alterar a pontuação de XP, as regras de conclusão nem os registros de progresso.

Se a integração exigir mudanças relevantes, apresentar primeiro um plano de implementação.

## Entregáveis

1. Template funcional.
2. Apresentação de demonstração da Aula 02.
3. Contrato JSON documentado.
4. Instruções para criar novas apresentações.
5. Testes básicos.
6. Relatório de compatibilidade com a plataforma.

## Restrições

- Trabalhar em branch isolada.
- Não publicar em produção automaticamente.
- Não executar migrações de banco de dados.
- Não refatorar componentes fora do escopo.
- Não criar um sistema de autoria complexo.
- Não adicionar interações avaliativas nesta fase.

## Critério de sucesso

Deve ser possível produzir uma nova apresentação da Bitaria preenchendo um JSON, sem precisar editar o layout de cada slide.

A apresentação deve ser bonita, consistente, responsiva e simples de integrar à plataforma existente.

Priorize velocidade, estabilidade e reutilização.