# BITARIA — Implementar Central de Acompanhamento Pedagógico

## Objetivo

Criar uma área administrativa e docente para acompanhar o progresso dos alunos dentro dos cursos e realizar avaliações de projetos.

A plataforma já possui mecanismos de progresso, atividades, questionários, XP e avaliação de projetos. O objetivo é reunir essas informações em uma interface de acompanhamento, sem duplicar regras de negócio.

## 1. Auditoria inicial obrigatória

Antes de implementar:

- Inspecione os componentes administrativos e docentes existentes.
- Localize as tabelas, views, RPCs e políticas RLS de matrícula, progresso, atividades, questionários, projetos e avaliações.
- Verifique quais mecanismos da Etapa D já permitem avaliar projetos.
- Identifique os relacionamentos entre alunos, professoras, cursos, módulos, submódulos, aulas e atividades.
- Reutilize as funções existentes sempre que possível.
- Não modificar o sistema de XP para criar esta interface.

## 2. Menu e permissões

Adicionar ao menu administrativo e docente:

**Acompanhamento Pedagógico**

Administradores poderão consultar os alunos dentro do escopo de suas permissões.

Professoras poderão consultar os alunos e cursos vinculados à sua atuação, conforme os relacionamentos e políticas já existentes.

Não permitir que uma professora visualize ou avalie dados de alunos fora do seu escopo autorizado.

## 3. Dashboard geral

Criar indicadores:

- Total de alunos ativos.
- Alunos com cursos em andamento.
- Cursos concluídos.
- Projetos aguardando avaliação.
- Atividades concluídas no período, quando houver dados disponíveis.

Adicionar uma listagem de alunos com:

- Nome e identificação.
- Curso.
- Percentual de progresso.
- Status do curso.
- Última atividade registrada.
- Quantidade de projetos pendentes.
- Ação para visualizar a jornada.

Filtros por aluno, curso, turma, professora e status, conforme os relacionamentos disponíveis.

Adicionar paginação ou carregamento incremental para evitar consultar todos os registros de uma vez.

## 4. Jornada individual

Ao selecionar um aluno, apresentar seus cursos.

Para cada curso, exibir:

- Progresso geral.
- Módulos concluídos e pendentes.
- Submódulos concluídos e pendentes.
- Aulas concluídas, em andamento ou não iniciadas.
- Quantidade de atividades obrigatórias concluídas.
- XP obtido.
- Última atividade realizada.

Utilizar navegação expansível:

Curso → Módulo → Submódulo → Aula → Atividades.

A conclusão deve ser calculada com base nas regras oficiais de progresso, não apenas na quantidade de páginas visitadas.

Evitar marcar um curso como concluído somente porque todas as atividades visíveis foram abertas.

## 5. Detalhamento de atividades

Dentro de cada aula, exibir:

- Nome da atividade.
- Tipo: vídeo, slides, mapa mental, quiz, ordering, matching, projeto ou outro tipo existente.
- Obrigatoriedade.
- Status.
- Data da conclusão, quando disponível.
- XP recebido.
- Tentativas, quando aplicável.

Para questionários, exibir:

- Quantidade de perguntas.
- Percentual de acerto.
- Resultado de aprovação.
- Histórico de tentativas.
- Datas das tentativas.
- Situação de bloqueio ou revisão, se aplicável.

Não revelar gabaritos privados em telas ou APIs acessíveis aos alunos.

## 6. Central de projetos

Criar uma aba ou seção chamada:

**Projetos para avaliar**

Exibir:

- Aluno.
- Curso, módulo e aula.
- Nome do projeto.
- Tipo: mini-projeto ou projeto.
- Data de envio.
- Status da avaliação.
- Link principal e descrição.
- Até dois links adicionais com suas descrições.

Permitir filtrar por:

- Aguardando avaliação.
- Avaliados.
- Devolvidos para revisão, caso o status exista.
- Aluno.
- Curso.
- Professora responsável.

## 7. Avaliação de projetos

Permitir abrir um envio e realizar a avaliação diretamente na central.

A interface deverá incluir:

- Dados do aluno e do projeto.
- Link principal.
- Links complementares.
- Descrições enviadas.
- Nota de 0 a 100.
- Campo de feedback.
- Histórico de avaliações, quando disponível.
- Ação para registrar a avaliação.

Reutilizar as RPCs e validações da Etapa D.

Respeitar as regras oficiais de XP:

- Mini-projeto: 50 XP pelo envio + nota da professora.
- Projeto: 100 XP pelo envio + nota da professora.

O envio já recompensado não poderá receber XP novamente ao ser avaliado.

Se a professora alterar a nota, ajustar a recompensa de avaliação conforme a regra oficial, sem acumular avaliações antigas.

Não aceitar cálculo de XP fornecido pelo frontend.

## 8. Experiência visual

Seguir o design system oficial da Bitaria.

Utilizar:

- Cores roxas e magenta da marca.
- Componentes reutilizáveis.
- Barras de progresso.
- Indicadores de status.
- Ícones consistentes.
- Layout responsivo.
- Estados de carregamento, erro e ausência de dados.

Priorizar clareza pedagógica, evitando excesso de cartões decorativos.

No celular, usar cartões ou painéis expansíveis em vez de tabelas largas com rolagem horizontal.

## 9. Segurança

Implementar ou ajustar RPCs e consultas somente quando necessário.

Requisitos:

- Autorização no backend.
- RLS consistente.
- Isolamento por professora e aluno.
- Nenhuma exposição de gabaritos privados.
- Nenhuma alteração de progresso por simples consulta.
- Nenhuma concessão de XP por visualizar o dashboard.
- Proteção contra avaliações duplicadas.
- Histórico de avaliações preservado.

## 10. Testes

Testar:

1. Administrador visualizando alunos autorizados.
2. Professora visualizando seus alunos.
3. Professora impedida de visualizar alunos de outra professora.
4. Progresso correto de curso, módulo, submódulo e aula.
5. Atividades obrigatórias e opcionais.
6. Histórico de tentativas de quiz.
7. Listagem de projetos pendentes.
8. Avaliação de mini-projeto.
9. Avaliação de projeto.
10. Alteração posterior de nota.
11. XP sem duplicação.
12. Interface desktop e mobile.
13. Paginação e filtros.
14. Ausência de alterações de progresso em consultas de leitura.

## 11. Entrega

Apresentar:

- Arquivos alterados.
- Novas rotas e componentes.
- RPCs ou migrations necessárias.
- Testes executados.
- Capturas de tela desktop e mobile.
- Limitações identificadas.
- Instruções de homologação.

Não aplicar migrations em produção sem autorização explícita.

## Primeira ação

Faça a auditoria da estrutura existente e implemente a Central de Acompanhamento Pedagógico reutilizando os mecanismos de progresso e avaliação já presentes na plataforma.

Não criar uma segunda estrutura de progresso ou um segundo sistema de correção de projetos.