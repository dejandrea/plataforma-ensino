# CODEX — Implementação de cartões didáticos e evolução das aulas multimídia da Bitaria

## Contexto

A Bitaria é uma plataforma gamificada de ensino de programação para crianças e adolescentes.

Stack atual:
- React 19.
- TypeScript.
- Vite.
- Tailwind CSS.
- Supabase Auth, PostgreSQL e RLS.
- Contrato administrativo de conteúdo JSON v2.
- Sistema de atividades, progresso, avaliações e recompensas XP.

Queremos implementar um novo recurso pedagógico: **cartões didáticos interativos (flashcards)**.

O recurso deve ser nativo, reutilizável em diferentes cursos e integrado ao ambiente de aprendizagem existente.

## 1. Objetivo

Permitir que o aluno estude cartões com duas faces:

**Frente**
- Título ou nome.
- Imagem opcional.
- Pergunta de recuperação ativa.

**Verso**
- Explicação.
- Contribuição ou conceito principal.
- Aplicação prática ou impacto atual.
- Curiosidade ou informação complementar.
- Imagem opcional.

O primeiro uso será na Aula 02 — Grandes Nomes da Tecnologia.

Entretanto, o componente deverá funcionar também para:
- Vocabulário HTML.
- Propriedades CSS.
- Conceitos de JavaScript.
- História da computação.
- Redes e internet.
- Outros conteúdos teóricos.

## 2. Experiência do aluno

Criar uma interface responsiva de cartões com:

1. Exibição de um cartão por vez.
2. Animação de virar o cartão.
3. Interação por clique ou toque.
4. Botões de próximo e anterior.
5. Indicador de progresso, por exemplo, 2 de 6.
6. Possibilidade de embaralhar a ordem.
7. Botão para reiniciar a sessão.
8. Indicador de cartões já revisados.
9. Tela de conclusão da atividade.

### Acessibilidade

Garantir:
- Navegação por teclado.
- Rótulos acessíveis.
- Foco visível.
- Compatibilidade com leitores de tela.
- Suporte a preferência por movimento reduzido.
- Alternativa à animação 3D quando necessário.
- Não depender exclusivamente de cores.

A animação deve ser agradável, mas não prejudicar a leitura.

## 3. Modelo de conteúdo

Investigar o contrato JSON v2 existente e propor uma extensão compatível.

Sugestão conceitual de conteúdo:

- `type`: `flashcards`.
- `schemaVersion`.
- `cards`.
- `front`.
- `back`.
- `title`.
- `question`.
- `summary`.
- `impact`.
- `curiosity`.
- `imageUrl`, opcional.
- `altText`, quando houver imagem.

Esses nomes são apenas uma proposta.

**Não adotar campos sem verificar as convenções, validações e contratos existentes.**

Definir:
- Schema do conteúdo.
- Validação.
- Tipos TypeScript.
- Tratamento de erros.
- Regras de renderização.
- Compatibilidade com o importador.

Evitar colocar lógica de apresentação dentro dos dados.

## 4. Integração com a plataforma

O novo recurso deve funcionar como uma atividade do ambiente de aprendizagem.

Integrar com:
- Listagem de atividades da aula.
- Abertura da atividade.
- Estado de conclusão.
- Persistência de progresso.
- Regras de pré-requisitos.
- Sistema de XP.
- Acompanhamento pedagógico.

Não alterar o funcionamento das atividades já existentes.

Não expor dados privados do professor.

## 5. Critério de conclusão

Proposta inicial:

A atividade será concluída quando o aluno tiver visualizado o verso de todos os cartões pelo menos uma vez.

Opcionalmente, permitir que o aluno marque:
- Já sei.
- Preciso revisar.

Essas marcações servem para orientar o estudo e não devem funcionar como uma avaliação de acerto automático.

Persistir o estado de forma que recarregar a página não cause concessão duplicada de XP.

O aluno poderá rever os cartões após concluir a atividade.

Não exigir que todos sejam marcados como "Já sei".

## 6. Gamificação

Utilizar exclusivamente o sistema central de recompensas da Bitaria.

Avaliar se a atividade deve utilizar a regra existente de estudo ou se precisa de uma regra específica.

Não inserir valores de XP fixos no frontend.

Não conceder XP repetido ao reiniciar a sessão ou rever cartões.

Documentar a decisão adotada.

## 7. Identidade visual

Criar o componente seguindo o design system Bitaria.

Referências:
- Estética gamer futurista.
- Fundo roxo-escuro.
- Destaques ciano e magenta.
- Bordas luminosas.
- Painéis HUD.
- Transições suaves.
- Interface apropriada para crianças e adolescentes.

O cartão deve parecer parte da experiência Bitaria, não um widget externo genérico.

Priorizar leitura, responsividade e acessibilidade.

## 8. Integração com a Aula 02

Após a implementação do componente, preparar a compatibilidade com a nova sequência pedagógica:

1. Vídeo.
2. Slides complementares.
3. Cartões didáticos.
4. Associação interativa.
5. Mapa mental.
6. Quiz final.
7. Desafio opcional.

A atividade de vídeo deve continuar utilizando o mecanismo de recurso por URL já suportado pela plataforma.

Não inserir URL fictícia.

Não alterar os materiais existentes até receber os novos arquivos aprovados pelo Work.

## 9. Cuidados com o importador

O importador existente pode acrescentar atividades à aula.

Antes de atualizar a Aula 02:

- Identificar o registro existente.
- Identificar as atividades existentes.
- Verificar os identificadores e as chaves.
- Planejar a substituição ou reorganização sem duplicações.
- Preservar tentativas, progresso e eventos de XP.
- Definir o comportamento para alunos que já tenham iniciado a aula.

Não apagar atividades históricas indiscriminadamente.

## 10. Testes

Implementar ou atualizar testes para:

- Renderização de frente e verso.
- Navegação.
- Embaralhamento.
- Persistência de progresso.
- Conclusão da atividade.
- Concessão única de XP.
- Compatibilidade com o importador.
- Validação de JSON.
- Acessibilidade básica.
- Funcionamento em dispositivos móveis.
- Regressão dos tipos de atividade existentes.

## 11. Etapas de execução

### Etapa A — Auditoria técnica

Inspecionar:
- Contratos atuais.
- Tipos de atividade.
- Componentes de aprendizagem.
- Estrutura de progresso.
- Regras de XP.
- Importador administrativo.
- RLS e RPCs relevantes.

Apresentar um plano com arquivos, migrações e riscos.

### Etapa B — Implementação

Após aprovação do plano:

- Implementar o componente.
- Implementar o contrato.
- Integrar ao fluxo de aprendizagem.
- Adicionar testes.
- Documentar o formato de produção para o Work.

### Etapa C — Homologação

Utilizar os seis cartões da Aula 02 como conjunto de teste.

Não importar ou publicar conteúdo real sem autorização.

## 12. Entregas

Fornecer:

1. Plano técnico.
2. Contrato definitivo dos cartões.
3. Componente implementado.
4. Integração com progresso e XP.
5. Exemplo JSON válido.
6. Testes executados e resultados.
7. Documentação para o Work produzir novos cartões.
8. Relatório de eventuais migrações necessárias.

**Comece pela auditoria técnica e pelo plano de implementação. Não aplique alterações no banco antes da aprovação.**