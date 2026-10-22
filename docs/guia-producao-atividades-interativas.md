# Guia de produção de atividades interativas

Use este guia no Work para produzir JSON importável. O exemplo completo e validado está em [maquinas-interativas.v2.json](examples/maquinas-interativas.v2.json); a referência normativa é o [contrato v2](contrato-conteudo-v2.md) e o schema executável está em [learning-content.v2.schema.json](../src/contracts/learning-content.v2.schema.json).

## Instrução para o Work

Produza um único objeto JSON, sem comentários, seguindo o contrato v2 e o exemplo. Use `schemaVersion: 2` na raiz e informe `context`, `lesson`, `activities` e `teacherOnly`. Os títulos de curso, módulo, submódulo e aula precisam corresponder exatamente ao destino já existente na plataforma. Não crie campos extras, HTML executável, scripts ou valores de XP.

Defina objetivos claros, instruções suficientes para estudo autônomo, textos acessíveis e feedback útil. Práticas de ordenação e associação são executadas na página; não as transforme em PDF. Slides e mapas podem continuar usando os recursos existentes. Uma aula não precisa depender de encontro ao vivo.

## Organização e identificadores

- `lesson` contém `key`, `title`, `description`, `objectives` e `durationMinutes`.
- Cada atividade contém `key`, `type`, `title`, `orderIndex`, `required`, `prerequisites` e `content`. `description` e `durationMinutes` são opcionais.
- Use chaves e IDs ASCII estáveis, como `linha-do-tempo`, `abaco` e `estrutura`. Os textos exibidos podem ter acentos. Nunca use posição ou texto como gabarito.
- `orderIndex` precisa ser único na aula. `prerequisites` referencia chaves de atividades da mesma importação, sem autorreferência ou ciclos. Use `[]` para uma atividade independente.
- `required: true` condiciona a conclusão da aula; uma atividade opcional não bloqueia essa conclusão.
- Não reutilize uma chave já importada para tentar editar conteúdo: o importador adiciona atividades e rejeita colisões.

## Ordenação

Use `type: "interactive"` e `content` com `schemaVersion: 2`, `type: "interactive"`, `interactionType: "ordering"`, `instructions`, `items`, `passingScore` e `maxAttempts`. Cada item possui somente `id` e `label`.

Em `teacherOnly.interactiveKeys`, inclua `{ "activityKey": "linha-do-tempo", "content": { "schemaVersion": 2, "interactionType": "ordering", "correctOrder": ["abaco", "calculadora", "tear", "computador"], "feedback": "Compare a função e o período de cada invenção." } }`. `correctOrder` deve conter todos os IDs, uma única vez. A ordem no array público não define a resposta: a apresentação será embaralhada.

A correção é integral: sequência completa correta vale 100; qualquer outra sequência vale 0. Para exigir acerto, use `passingScore: 100`. O aluno pode mover itens com botões e teclado.

## Associação

Use os mesmos campos gerais, com `interactionType: "matching"`, `leftItems` e `rightItems` em lugar de `items`. Os dois conjuntos devem ter a mesma quantidade de itens, IDs únicos e relações um para um.

No gabarito privado, use `content` com `schemaVersion: 2`, `interactionType: "matching"`, `pairs: [{ "leftId": "html", "rightId": "estrutura" }, ...]` e `feedback`. Cada ID de ambos os lados aparece exatamente uma vez nos pares. Os dois lados são embaralhados independentemente.

A nota é a porcentagem de pares corretos, arredondada para duas casas. `passingScore` determina a aprovação; use 100 para exigir todos os pares. O aluno usa seletores acessíveis, sem depender de arrastar elementos.

## Quiz e separação dos gabaritos

Quiz continua com `content.schemaVersion: 1`, perguntas com `key`, `prompt` e alternativas `{key,text}`. O gabarito fica somente em `teacherOnly.quizKeys`, com a estrutura v1 do exemplo. Todas as alternativas são embaralhadas; a correção usa suas chaves originais.

Mesmo na raiz v2, slides, mapas, quizzes, projetos e planos de aula conservam seus conteúdos v1. `teacherOnly` contém obrigatoriamente os arrays `quizKeys`, `interactiveKeys` e `lessonPlans`, usando `[]` quando não se aplicarem. Não coloque resposta correta, sequência, pares, plano docente ou explicação que entregue o gabarito dentro de `activities`. A prévia pública omite `teacherOnly`; o arquivo de autoria completo deve ser tratado como material restrito.

## Tentativas e recompensas

Use os limites de quantidade, tamanho e tentativas do schema; `passingScore` fica entre 0 e 100. A apresentação é preservada na tentativa, inclusive após recarregar. Uma nova tentativa após reprovação gera outra ordem. Respostas ainda não enviadas são recuperadas localmente no mesmo navegador, quando o armazenamento está disponível.

`gamification` é opcional e referencia regras centrais; não define pontos diretamente:

| Tipo | `rewardRuleKey` | `awardOn` |
|---|---|---|
| Quiz | `activity_quiz` | `completed` |
| Ordenação ou associação | `activity_interactive` | `completed` |
| Slides ou mapa | `activity_study` | `completed` |
| Aula ao vivo | `activity_online` | `teacher_confirmed` |
| Projeto | `activity_project` ou `activity_final_project` | `approved` |

Inclua `achievementKeys: []`. Para conceder uma conquista, use apenas códigos personalizados já cadastrados no catálogo central; não invente códigos nem use os de missões. Exemplo: `{ "rewardRuleKey": "activity_interactive", "awardOn": "completed", "achievementKeys": [] }`.

As novas regras começam com zero XP. A administração deve definir os valores antes de publicar conteúdo com recompensas; o JSON não pode alterá-los. Quiz e prática exigem aprovação; aula ao vivo exige confirmação protegida; projeto e projeto final exigem avaliação aprovada. Repetir envio, recarregar ou editar valores futuros não duplica nem recalcula uma recompensa já registrada. O marco de conclusão de submódulo também usa configuração central, inicialmente zero.

## Revisão e importação

1. Abra a gestão do conteúdo e, na aula de destino, selecione **Importar atividades JSON**.
2. Carregue o arquivo ou cole o JSON. Corrija erros e confira a prévia pública. A validação também é executada no banco, com permissão de administrador.
3. Confira títulos do destino e a alteração de descrição, duração e objetivos da aula. A importação não cria a hierarquia nem sobrescreve atividades existentes.
4. Importe como rascunho para revisão; use **Publicar atividades importadas** quando estiver pronto. Também é possível marcar publicação na própria importação.
5. Verifique a aula como aluno, incluindo aprovação, reprovação, nova tentativa, acessibilidade e requisitos obrigatórios.

O arquivo tem limite de 2 MB. Rascunhos e gabaritos não ficam disponíveis ao aluno. Publicação valida o conjunto e falha atomicamente em caso de erro.

## Limites desta etapa

Somente `ordering` e `matching` estão disponíveis como práticas interativas. `fill_blank`, `identify` e `prediction` são possibilidades futuras e são rejeitados pelo contrato atual. A B1 não inclui editor visual, correção por IA, execução de código, painel docente da etapa C nem telas de revisão de projetos da etapa D. Não crie JSON para esses subtipos antes de uma nova versão do contrato.
