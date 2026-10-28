# Contrato de conteúdo v2 — B1

Novas autorias/importações exigem no mínimo quatro perguntas por questionário, conforme as [regras oficiais de XP v1](regras-xp-v1.md). A política mantém as chaves do contrato e premia a primeira tentativa do quiz pela nota, separando os créditos de envio e avaliação de projetos. As regras de recompensa descritas originalmente para B1 abaixo são anteriores a essa política.

O contrato de autoria está em [learning-content.v2.schema.json](../src/contracts/learning-content.v2.schema.json), com tipos em [learning.ts](../src/types/learning.ts), validação semântica em [learningContent.ts](../src/lib/learningContent.ts) e validação equivalente no banco pela migration [B1](../supabase/migrations/20261021180915_interactive_learning_and_rewards.sql). Consulte o [guia de produção](guia-producao-atividades-interativas.md) e o [exemplo completo](examples/maquinas-interativas.v2.json).

## Versionamento e compatibilidade

A extensão `flashcards` acrescenta cartões nativos com frente/verso, persistência de revisão por cartão e recompensa central `activity_study`. O conteúdo usa `schemaVersion: 2`; a conclusão depende dos versos de todos os cartões, não da confirmação genérica de estudo. Consulte o [contrato definitivo e guia para o Work](cartoes-didaticos.md) e o [exemplo completo](examples/cartoes-didaticos.v2.admin.json). A migration foi autorizada e aplicada em produção em 28/10/2026; isso não importa nem publica materiais reais.

A v2 também aceita `type: "video"`, com `content: {"schemaVersion":2,"type":"video","resourceUrl":"https://drive.google.com/file/d/ARQUIVO/view"}`. Os campos comuns permanecem iguais aos dos materiais de estudo. `required` determina se a conclusão é necessária para finalizar a aula; nenhuma aula precisa conter vídeo. Use `gamification: {"rewardRuleKey":"activity_study","awardOn":"completed","achievementKeys":[]}` para explicitar a regra oficial de 10 XP, sem enviar pontos. A regra também é aplicada quando esse metadado opcional é omitido.

Vídeos aceitam somente arquivos HTTPS do Google Drive (`/file/d/ID`, `/file/u/N/d/ID`, `/open?id=ID`, `/uc?id=ID`). A prévia converte o endereço para `/file/d/ID/preview`, preserva `resourcekey` e `authuser`, e mantém o link original para abrir em nova aba. A confirmação é manual pelo botão **Concluir vídeo**; reprodução ou fim do player não registram conclusão. A prévia administrativa não registra progresso nem XP. Consulte o [exemplo de aula com vídeo](examples/video-html.v2.json) e a [implementação e validação](atividade-video.md). Os identificadores do exemplo são fictícios e devem ser substituídos por um arquivo compartilhado com o aluno.

A raiz v2 mantém `context`, `lesson`, `activities` e `teacherOnly` da v1. Acrescenta `interactive`, `video`, `teacherOnly.interactiveKeys` e a configuração opcional `gamification`. A v1 permanece aceita com seus campos originais, sem aceitar retroativamente os campos v2; novas importações também seguem o mínimo de quatro perguntas. Conteúdos legados, gabarito de quiz e plano docente mantêm `schemaVersion: 1`; vídeos, conteúdos e gabaritos interativos usam 2. Versão de schema é distinta da revisão editorial da atividade.

As validações rejeitam propriedades desconhecidas, referências inconsistentes, IDs duplicados, gabaritos ausentes ou órfãos, associações incompletas e ciclos nos pré-requisitos. Os limites exatos de campos e arrays estão no schema. Recursos externos usam HTTPS. O limite total de importação é 2 MB.

## Conteúdo público e conteúdo restrito

| Estrutura | Campos relevantes | Visibilidade |
|---|---|---|
| `activities[].content`, quiz | `questions` com alternativas `{key,text}`, `passingScore`, `maxAttempts` | Aluno autorizado |
| `activities[].content`, ordering | `schemaVersion:2`, `type:interactive`, `interactionType:ordering`, `instructions`, `items:[{id,label}]`, `passingScore`, `maxAttempts` | Aluno autorizado |
| `activities[].content`, matching | Mesmo cabeçalho, `interactionType:matching`, `leftItems`, `rightItems`, instruções e limites | Aluno autorizado |
| `teacherOnly.quizKeys[]` | `activityKey`, gabarito v1 por chave de pergunta e alternativa | Administração/docência autorizada |
| `teacherOnly.interactiveKeys[]` | `activityKey`, `content` com versão 2, subtipo, `feedback` e `correctOrder` ou `pairs` | Administração/docência autorizada |
| `teacherOnly.lessonPlans[]` | Planos v1 vinculados a atividades de aula ao vivo | Administração/docência autorizada |

`correctOrder` é uma permutação completa dos IDs públicos. `pairs` é uma bijeção completa de `{leftId,rightId}`. Ambos exigem correspondência com o subtipo da atividade. A projeção `toStudentLesson` remove `teacherOnly` integralmente. A importação grava as chaves em `activity_quiz_keys` e os planos em `teacher_lesson_plans`, separadamente do conteúdo público.

## Protocolo de tentativa e correção

`begin_student_assessment(activity_id)` reserva uma sessão e devolve a ordem de apresentação persistida em `activity_attempt_sessions`. Uma sessão pendente é reutilizada; abrir a tela não consome tentativa. O algoritmo Fisher–Yates embaralha IDs, preserva o conteúdo de autoria e evita repetir imediatamente a ordem anterior quando existem dois ou mais itens. A associação embaralha os lados independentemente.

`submit_student_assessment(activity_id, answers, session_id)` recebe somente respostas e a sessão; nota, XP e resultado não são aceitos como autoridade do cliente. Formatos de respostas:

```json
{"pergunta-chave":"alternativa-chave"}
```

```json
{"sequence":["abaco","calculadora","tear","computador"]}
```

```json
{"pairs":{"html":"estrutura","css":"aparencia","javascript":"interacao"}}
```

Quiz usa o percentual de perguntas corretas. Ordenação vale 100 apenas pela sequência completa correta; caso contrário, 0. Associação usa percentual de pares corretos arredondado para duas casas. `score >= passingScore` aprova. Envios estruturalmente inválidos são rejeitados sem consumir tentativa. A submissão válida grava apresentação, respostas, resultado e progresso na mesma transação. O UUID da sessão funciona como chave de idempotência; reenviar devolve o resultado registrado. Limites e pré-requisitos são impostos no backend.

A tabela `quiz_attempts` passa a armazenar também as práticas interativas, preservando o histórico e APIs legadas. Não há outra tabela de respostas ou notas. Tentativas anteriores à B1 não possuem apresentação recuperável; sua visualização histórica usa a ordem de autoria como fallback. Respostas pendentes ficam no armazenamento local, isoladas por aluno e sessão; a ordem fica no servidor. Não há sincronização de rascunhos entre dispositivos.

## Recompensas

`gamification` contém `rewardRuleKey`, `awardOn` e `achievementKeys`. O [guia](guia-producao-atividades-interativas.md) define as combinações permitidas por tipo. Conquistas referenciadas devem existir como personalizadas no catálogo. Os pontos vêm exclusivamente de `xp_reward_rules`; as novas regras começam em zero.

A primeira conclusão elegível gera um recibo imutável no ledger existente `student_xp_events`, com contexto da atividade e configuração usada. A unicidade impede ganhos repetidos. Quiz/prática precisam de tentativa aprovada; projetos precisam de avaliação aprovada da versão vigente; aula ao vivo precisa de confirmação protegida. Mudanças posteriores nas regras não alteram recibos anteriores. Reprocessamentos preservam esses pontos e conquistas junto às missões e maestrias existentes. Níveis continuam usando o catálogo atual; esta etapa não muda seus limiares nem os valores das regras antigas.

## Importação e publicação

`import_learning_lesson` e `publish_learning_activities` exigem administrador ativo. A importação usa um destino existente, compara os títulos da hierarquia, atualiza os metadados da aula e adiciona atividades novas. Colisões são rejeitadas. Conteúdo, gabaritos, planos e pré-requisitos são validados em uma transação; publicar exige que todas as invariantes estejam satisfeitas. A prévia administrativa apresenta somente a projeção pública.

Os subtipos `fill_blank`, `identify` e `prediction` não fazem parte desta versão. Sua inclusão exige evolução explícita de schema, tipos, correção, renderizador e testes.
