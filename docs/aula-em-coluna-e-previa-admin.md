# Aula em coluna e visualização administrativa

As atividades da aula são exibidas em uma única coluna. Cada cabeçalho abre ou recolhe seu conteúdo, com indicação acessível do estado. A barra de progresso fica fixa na parte inferior, com espaço reservado ao final da página. Os pré-requisitos e os registros de progresso continuam seguindo as regras existentes.

Em Gestão de conteúdo, cada aula oferece **Visualizar aula**, para consultar atividades ativas salvas, incluindo rascunhos. A leitura usa as permissões existentes de `lesson_activities`, sem consultar gabaritos.

Na importação, após validar o JSON, **Visualizar resultado como aluno** apresenta os materiais e enunciados antes ou depois de importar. PDFs e imagens usam o mesmo visualizador do aluno. Questionários permitem selecionar alternativas na prévia, sem correção; práticas mostram os enunciados e itens. Entregas, tentativas, progresso e XP não são registrados na prévia.

Não há alteração de banco ou implantação remota neste ajuste.

Verificação: build, lint dos componentes alterados e testes de navegador de importação, prévia administrativa, progresso persistido, avaliações e visualização de recursos, incluindo largura e barra fixa em celular.
