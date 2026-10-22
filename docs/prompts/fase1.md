# PROMPT PARA CODEX — Implementação do Ambiente de Aprendizagem Bitaria

## 1. Contexto do projeto

Você atuará como desenvolvedor full-stack sênior, arquiteto de software e especialista em plataformas educacionais.

Seu objetivo é implementar o primeiro MVP do **Ambiente de Aprendizagem Bitaria**, evoluindo a aplicação existente sem comprometer suas funcionalidades atuais.

**Repositório:** https://github.com/dejandrea/plataforma-ensino

A Bitaria é uma plataforma de gestão acadêmica e ensino de programação que utiliza:

- React + TypeScript + Vite
- Tailwind CSS
- React Router
- Supabase / PostgreSQL
- Supabase Auth e Row Level Security (RLS)
- Supabase Edge Functions
- Vercel

A aplicação já possui funcionalidades de gestão de usuários, cursos, módulos, submódulos, aulas, agendamentos, Google Meet, avaliações e acompanhamento acadêmico.

**Importante:** antes de implementar, inspecione o código e as migrations atuais. As estruturas mencionadas neste documento são referências, não garantias sobre o estado atual do banco.

## 2. Objetivo principal

Transformar a Bitaria em um ambiente de aprendizagem híbrido, permitindo:

1. Que alunos estudem conteúdos organizados em atividades.
2. Que alunos respondam questionários e entreguem miniprojetos.
3. Que professoras acompanhem aulas online por meio de planos de aula interativos.
4. Que professoras registrem avaliações e correções de projetos.
5. Que a plataforma acompanhe o progresso individual dos estudantes.
6. Que conteúdos didáticos sejam futuramente produzidos pelo ChatGPT Work e importados por JSON.

O MVP deve funcionar sem integração direta com o Google Meet. Os encontros continuarão utilizando links externos.

## 3. Princípios arquiteturais

### 3.1. Reutilizar a estrutura curricular existente

Preservar a hierarquia:

**Curso → Módulo → Submódulo → Aula → Atividades**

As quatro primeiras entidades já existem na aplicação.

Implementar atividades como unidades vinculadas às aulas curriculares.

Exemplo:

**Curso:** HTML

**Módulo:** HTML Básico

**Submódulo:** História e fundamentos

**Aula:** Conhecendo o HTML

Atividades:
- Slides
- Mapa mental
- Questionário

**Submódulo:** Introdução ao HTML

**Aula:** Minha primeira página HTML

Atividades:
- Slides
- Mapa mental
- Questionário
- Aula online
- Miniprojeto
- Avaliação prática

Não transformar slides, questionários ou miniprojetos em aulas independentes.

### 3.2. Separar conteúdo pedagógico de registros de execução

O conteúdo de uma atividade deve ser reutilizável.

O progresso do aluno, a execução de um encontro, a entrega de um projeto e a avaliação devem ser registros individuais.

### 3.3. Usar JSON para conteúdo flexível

Cada atividade pode ter um campo `content_json` do tipo `jsonb`.

Utilizar estruturas tipadas e versionadas, com `schemaVersion`.

Não criar um único JSON gigante para todo o curso.

### 3.4. Preservar funcionalidades existentes

Não remover nem substituir os sistemas atuais de:

- Autenticação e permissões
- Gestão de cursos e módulos
- Agendamento de aulas
- Google Calendar
- Google Meet
- Avaliações acadêmicas
- Progresso curricular
- Gestão financeira e comercial

Adaptar os componentes existentes sempre que possível.

---

# 4. Fase 1 — Análise técnica obrigatória

Antes de escrever código:

1. Inspecione a estrutura do repositório.
2. Identifique as tabelas e relações existentes.
3. Analise as políticas RLS.
4. Verifique o funcionamento da progressão curricular.
5. Identifique como `student_progress` é utilizado.
6. Analise como os agendamentos se relacionam com alunos, professores e cursos.
7. Inspecione o sistema atual de avaliações.
8. Identifique componentes e estilos reutilizáveis.

Arquivos relevantes:

- `src/App.tsx`
- `src/pages/LessonView.tsx`
- `src/pages/LessonRoom.tsx`
- `src/pages/StudentLessons.tsx`
- `src/pages/Dashboard.tsx`
- `src/components/management/TabContent.tsx`
- `src/lib/studentCourses.ts`
- `src/pages/AdminEvaluations.tsx`
- `supabase/migrations/`

Produza um resumo técnico curto das decisões arquiteturais antes de implementar.

Se encontrar incompatibilidades com esta especificação, priorize a preservação da arquitetura existente e explique as adaptações.

---

# 5. Fase 2 — Modelo de dados

Criar migrations versionadas e reversíveis quando possível.

## 5.1. Atividades curriculares

Criar uma estrutura equivalente a `lesson_activities`.

Campos sugeridos:

- `id`
- `lesson_id`
- `title`
- `description`
- `activity_type`
- `order_index`
- `duration_minutes`
- `is_required`
- `is_active`
- `content_json`
- `created_at`
- `updated_at`

Tipos iniciais:

- `slides`
- `mindmap`
- `quiz`
- `online_lesson`
- `project`

A avaliação do projeto pode ser uma funcionalidade vinculada à entrega, sem necessariamente exigir um tipo independente de atividade.

Definir índices, constraints e integridade referencial.

## 5.2. Progresso individual

Criar estrutura equivalente a `student_activity_progress`.

Campos sugeridos:

- `id`
- `student_id`
- `activity_id`
- `status`
- `started_at`
- `completed_at`
- `updated_at`

Estados sugeridos:

- `not_started`
- `in_progress`
- `pending_review`
- `completed`
- `needs_revision`

Não permitir que alunos atribuam diretamente a si mesmos estados que dependam de aprovação da professora.

## 5.3. Questionários

Criar estruturas para tentativas e respostas dos alunos.

Registrar:

- Aluno
- Atividade
- Número da tentativa
- Respostas
- Pontuação
- Resultado
- Data de realização

Permitir configurar nota mínima e número máximo de tentativas.

**Segurança:** respostas corretas, critérios internos de correção e dados exclusivos da professora não devem ser expostos em consultas acessíveis aos alunos antes da submissão.

A correção deve acontecer em uma operação segura no backend, como uma função PostgreSQL ou Supabase Edge Function.

## 5.4. Entregas de projetos

Criar estrutura equivalente a `project_submissions`.

Campos sugeridos:

- `id`
- `student_id`
- `activity_id`
- `submission_url`
- `student_notes`
- `status`
- `submitted_at`
- `reviewed_at`
- `reviewed_by`
- `teacher_feedback`
- `evaluation_json`

Permitir múltiplas versões de uma entrega ou preservar um histórico de revisões.

Estados:

- Enviado
- Em avaliação
- Ajustes necessários
- Aprovado

Não permitir que o aluno aprove sua própria entrega.

## 5.5. Planos de aula da professora

Criar armazenamento protegido para os planos pedagógicos.

Os planos deverão conter:

- Objetivos
- Pré-requisitos
- Preparação da professora
- Duração estimada
- Etapas de desenvolvimento
- Orientações pedagógicas
- Blocos de código
- Onde inserir o código
- Resultado esperado
- Perguntas
- Respostas esperadas
- Explicações detalhadas
- Explicações lúdicas
- Dificuldades comuns
- Desafios
- Critérios de avaliação

Não expor respostas esperadas ou orientações exclusivas da professora na API utilizada pelos alunos.

## 5.6. Execução do plano durante o encontro

Criar estrutura para vincular:

- Agendamento existente
- Aula curricular
- Atividade online
- Plano de aula
- Aluno
- Professora

Registrar por sessão:

- Etapas concluídas
- Etapas pendentes
- Observações
- Data de atualização
- Avaliação pedagógica

A estrutura deve permitir que um plano seja utilizado em mais de um encontro.

Evitar duplicar dados que já existam em `scheduled_lessons`.

## 5.7. RLS

Implementar políticas de acesso consistentes com os papéis existentes:

**Administrador:** gerenciamento do conteúdo e acesso administrativo autorizado.

**Professora:** acesso aos planos pedagógicos, registros e avaliações dos alunos sob sua responsabilidade.

**Aluno:** acesso ao conteúdo publicado e aos próprios registros, respostas, entregas e feedbacks.

Não confiar apenas em validações do frontend.

Revisar também políticas de armazenamento, caso seja utilizado Supabase Storage.

---

# 6. Fase 3 — Experiência do aluno

Implementar uma interface de aprendizagem integrada à estrutura atual.

## 6.1. Página de aula

Evoluir `LessonView.tsx` ou extrair componentes reutilizáveis.

Exibir:

- Título da aula
- Descrição
- Objetivos
- Duração estimada
- Lista ordenada de atividades
- Progresso individual
- Estados das atividades
- Botão para iniciar ou continuar

A interface deve seguir o design system existente da Bitaria.

Não redesenhar toda a aplicação.

## 6.2. Renderização por tipo

Criar componentes reutilizáveis, por exemplo:

- `LessonActivityList`
- `ActivityRenderer`
- `SlidesActivity`
- `MindMapActivity`
- `QuizActivity`
- `OnlineLessonActivity`
- `ProjectActivity`
- `ActivityProgress`

Esses nomes são sugestões. Adaptar à organização real do projeto.

### Slides

Permitir apresentar PDFs ou links externos.

Não criar um editor de apresentações.

### Mapas mentais

Permitir imagem, PDF ou link externo.

Não criar um editor de mapas mentais.

### Questionários

Suportar inicialmente:

- Múltipla escolha
- Uma alternativa correta
- Feedback após submissão
- Pontuação
- Critério mínimo de aprovação

Não implementar inicialmente questões discursivas corrigidas por IA.

### Aula online

Mostrar:

- Título e objetivo do encontro
- Orientações de preparação
- Status da atividade
- Próximo encontro associado, quando existir
- Link do Google Meet, respeitando as regras de acesso atuais

A conclusão da atividade depende de confirmação autorizada da professora.

### Miniprojeto

Exibir:

- Enunciado
- Objetivos
- Requisitos
- Critérios de avaliação
- Materiais de apoio
- Campo para link do projeto
- Campo para reflexão do aluno
- Histórico de entregas
- Feedback da professora

Permitir GitHub, CodePen ou links HTTPS equivalentes.

Não implementar execução de código ou testes automáticos no MVP.

## 6.3. Progresso

Exibir barra de progresso baseada nas atividades obrigatórias concluídas.

Distinguir:

- Não iniciada
- Em andamento
- Aguardando professora
- Precisa de ajustes
- Concluída

Não considerar a simples abertura de um arquivo como comprovação de aprendizagem.

Não permitir que uma atividade seja concluída indevidamente pelo aluno.

---

# 7. Fase 4 — Painel interativo da professora

Evoluir `LessonRoom.tsx` ou criar uma interface complementar integrada ao agendamento existente.

O objetivo é permitir que a professora conduza uma aula no Google Meet enquanto utiliza a Bitaria como roteiro pedagógico.

## 7.1. Cabeçalho

Exibir:

- Nome da aula
- Nome do aluno
- Curso e módulo
- Data e horário do encontro
- Duração prevista
- Link para abrir o Google Meet
- Status do encontro

## 7.2. Plano de aula interativo

Apresentar etapas expansíveis contendo:

- Objetivo
- Tempo estimado
- Orientações da professora
- Código com formatação
- Arquivo onde inserir o código
- Resultado esperado
- Perguntas e respostas
- Explicação detalhada
- Explicação lúdica
- Dificuldades comuns
- Desafio prático

Cada etapa deve ter um checkbox para indicar sua realização.

## 7.3. Barra de progresso

Exibir:

- Quantidade de etapas concluídas
- Total de etapas
- Percentual de execução
- Etapas pendentes

O percentual deve representar a execução do plano, não o domínio do aluno.

Salvar as alterações automaticamente.

Evitar perda de informações em caso de atualização da página.

## 7.4. Avaliação ao final da aula

Permitir registrar:

**Compreensão dos conceitos**
- Precisa de apoio
- Em desenvolvimento
- Realiza com autonomia

**Aplicação prática**
- Precisa de apoio
- Em desenvolvimento
- Realiza com autonomia

**Autonomia**
- Precisa de apoio
- Em desenvolvimento
- Realiza com autonomia

Também incluir:

- Observações da professora
- Dificuldades identificadas
- Recomendações para o próximo encontro
- Etapas que precisam ser retomadas

Verificar se o sistema de avaliações atual pode ser reutilizado.

Evitar criar avaliações duplicadas ou alterar o significado de registros existentes.

## 7.5. Encerramento

Permitir concluir o encontro mesmo que nem todas as etapas tenham sido executadas.

Manter separados:

1. Status administrativo do encontro.
2. Progresso de execução do plano.
3. Avaliação pedagógica.
4. Conclusão curricular do aluno.

---

# 8. Fase 5 — Correção de miniprojetos

Criar uma interface simples para a professora:

- Visualizar entregas pendentes.
- Abrir o link enviado pelo aluno.
- Consultar os critérios de avaliação.
- Registrar feedback.
- Solicitar ajustes.
- Aprovar a entrega.

O aluno deve visualizar o resultado e, quando necessário, enviar uma nova versão.

Preservar o histórico de feedbacks.

---

# 9. Fase 6 — Administração e importação de conteúdo

Evoluir a aba de conteúdo curricular existente em:

`src/components/management/TabContent.tsx`

Adicionar gerenciamento básico das atividades de cada aula.

Funcionalidades mínimas:

- Listar atividades.
- Definir ordem.
- Ativar/desativar.
- Indicar obrigatoriedade.
- Importar conteúdo JSON.
- Validar estrutura antes de salvar.
- Visualizar erros de importação.
- Pré-visualizar conteúdo.
- Publicar conteúdo validado.

A importação deve utilizar um esquema documentado e versionado.

Criar tipos TypeScript para os formatos de atividade.

Implementar validação em runtime, além dos tipos TypeScript.

Não adicionar um editor visual completo neste MVP.

O conteúdo será inicialmente produzido externamente, principalmente pelo ChatGPT Work.

---

# 10. Estrutura de conteúdo para geração por IA

Definir e documentar um contrato JSON oficial da Bitaria.

Exemplo conceitual:

```json
{
  "schemaVersion": 1,
  "lesson": {
    "title": "Minha primeira página HTML",
    "objectives": [
      "Compreender a estrutura básica de um documento HTML"
    ]
  },
  "activities": [
    {
      "key": "introducao-slides",
      "type": "slides",
      "title": "Conhecendo o HTML",
      "required": true,
      "content": {
        "resourceUrl": "https://exemplo.com/slides.pdf"
      }
    },
    {
      "key": "primeiro-projeto",
      "type": "project",
      "title": "Meu primeiro site",
      "required": true,
      "content": {
        "instructions": "Crie uma página HTML.",
        "requirements": [
          "Utilizar html, head e body"
        ]
      }
    }
  ]
}
```

O exemplo é ilustrativo. Desenvolva o esquema definitivo conforme as necessidades reais dos componentes.

Documentar:

- Campos obrigatórios
- Campos opcionais
- Tipos de atividade
- Validações
- Versionamento
- Exemplo completo de importação
- Como adicionar novos tipos futuramente

Preparar a arquitetura para receber conteúdo do Work ou EduForge sem depender diretamente dessas ferramentas.

---

# 11. Regras pedagógicas e de progressão

Implementar regras configuráveis para atividades.

### Estudo individual

Slides e mapas mentais podem ser marcados como estudados pelo aluno.

### Questionários

A conclusão depende do critério de aprovação.

### Aula online

A conclusão depende de registro autorizado da professora.

### Projeto

A conclusão depende de aprovação da entrega.

### Submódulo

A conclusão depende das atividades obrigatórias, respeitando as regras de progressão curricular já existentes.

**Atenção:** verificar como a Bitaria atualmente calcula a conclusão de aulas, módulos e cursos.

Não substituir silenciosamente a lógica atual.

Se necessário, implementar uma estratégia de compatibilidade para aulas antigas que ainda não possuem atividades.

A ordem de apresentação não deve significar necessariamente bloqueio obrigatório.

Permitir configurar pré-requisitos sem tornar toda a jornada rigidamente sequencial.

---

# 12. Requisitos de interface

Manter a identidade visual existente da Bitaria.

Priorizar:

- Design responsivo
- Interfaces claras e acessíveis
- Estados de carregamento
- Tratamento de erros
- Feedback após ações
- Componentes reutilizáveis
- Navegação consistente
- Boa leitura de blocos de código
- Acessibilidade de formulários e checkboxes

Evitar dependências pesadas quando uma solução simples for suficiente.

Não realizar redesign geral.

---

# 13. Testes e qualidade

Implementar testes para os fluxos críticos:

1. Aluno acessa atividades publicadas.
2. Aluno não acessa dados exclusivos da professora.
3. Aluno responde um questionário.
4. Questionário é corrigido com segurança.
5. Aluno envia um projeto.
6. Professora solicita ajustes.
7. Aluno reenvia o projeto.
8. Professora aprova o projeto.
9. Professora marca etapas durante um encontro.
10. O progresso permanece salvo após atualizar a página.
11. Aluno não pode aprovar sua própria atividade.
12. Aulas antigas continuam funcionando.
13. A progressão curricular existente não é quebrada.

Executar os comandos disponíveis de build, lint e testes.

Não declarar sucesso de testes que não foram executados.

---

# 14. O que NÃO implementar agora

Não implementar:

- Integração de vídeo ou áudio com Google Meet
- Geração de vídeos por IA
- Editor de slides
- Editor de mapas mentais
- Editor de código online
- Execução remota de código
- Tutor IA
- Correção automática de projetos por IA
- Gamificação complexa
- Certificados
- Exportação do plano da professora para PDF
- Integração com EduForge
- Editor visual avançado de planos de aula

Essas funcionalidades poderão ser desenvolvidas futuramente.

**Importante:** manter no esquema pedagógico os campos necessários para gerar posteriormente um PDF de preparação da professora.

---

# 15. Estratégia de implementação

Trabalhe de forma incremental.

Ordem recomendada:

**Etapa A — Fundação**
- Análise do código existente
- Modelo de dados
- Migrations
- RLS
- Tipos e validação JSON

**Etapa B — Aprendizagem do aluno**
- Lista de atividades
- Renderizadores
- Questionários
- Progresso

**Etapa C — Encontros online**
- Vinculação curricular
- Plano interativo
- Checklist
- Avaliação da professora

**Etapa D — Projetos**
- Envio
- Correção
- Reenvio
- Aprovação

**Etapa E — Gestão de conteúdo**
- Importação JSON
- Pré-visualização
- Publicação
- Documentação

Faça commits pequenos e organizados quando apropriado ao fluxo do repositório.

Não executar migrations diretamente no banco de produção sem autorização explícita.

Não modificar configurações de produção, credenciais ou dados reais.

---

# 16. Critérios de aceite do MVP

A implementação estará pronta quando for possível:

1. Cadastrar uma aula dentro de um submódulo existente.
2. Adicionar slides, mapas mentais, questionários, aula online e miniprojeto.
3. Acessar essas atividades como aluno.
4. Responder e concluir um questionário.
5. Enviar um miniprojeto para avaliação.
6. Corrigir e aprovar o projeto como professora.
7. Abrir um plano pedagógico associado a um encontro online.
8. Marcar etapas realizadas e visualizar a barra de progresso.
9. Registrar a avaliação do aluno.
10. Retomar registros após atualizar a página.
11. Importar uma aula estruturada em JSON.
12. Preservar o funcionamento das funcionalidades já existentes.

---

# 17. Entregáveis esperados

Ao finalizar, apresente:

- Resumo da arquitetura implementada.
- Lista dos arquivos criados e modificados.
- Migrations adicionadas.
- Políticas RLS criadas ou alteradas.
- Componentes implementados.
- Rotas adicionadas ou modificadas.
- Formato JSON oficial documentado.
- Exemplo de aula importável.
- Instruções de implantação.
- Testes executados e resultados.
- Limitações conhecidas.
- Próximos passos recomendados.

## Orientação final

Priorize a solução mais simples, segura e sustentável.

O objetivo não é construir um LMS completo agora, mas disponibilizar rapidamente uma experiência pedagógica funcional na Bitaria.

**Comece inspecionando o projeto, apresente o plano técnico e implemente por fases. Não reescreva a arquitetura existente sem necessidade.**
