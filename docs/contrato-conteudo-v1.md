# Contrato JSON de conteúdo Bitaria — versão 1

A v1 continua aceita sem mudanças. Para ordenação, associação e configuração de recompensas, use o [contrato v2](contrato-conteudo-v2.md) e o [guia de produção](guia-producao-atividades-interativas.md).

Fonte normativa: `src/contracts/learning-content.v1.schema.json`, JSON Schema Draft 7,
ID `urn:bitaria:learning-content:1`. Tipos em `src/types/learning.ts`; validação real
em `validateLessonImport(unknown)`, em `src/lib/learningContent.ts`.

Cada arquivo representa **uma aula**, com suas atividades. Os arquivos de exemplo
`docs/examples/html-conhecendo.v1.json` e `html-primeira-pagina.v1.json` pertencem ao
curso HTML, módulo HTML Básico e submódulos diferentes. Não há um JSON único do curso
armazenado no banco. Os links dos materiais são referências externas de demonstração;
o conteúdo não é baixado nem importado automaticamente.

## Envelope obrigatório

| Campo | Regra |
| --- | --- |
| `schemaVersion` | Número inteiro literal `1` |
| `context` | `courseTitle`, `moduleTitle`, `submoduleTitle`; orientação para autoria, sem atribuir permissões |
| `lesson` | `key`, `title`, `description`, `objectives` (lista não vazia), `durationMinutes` |
| `activities` | 1–200 atividades, chaves e posições únicas |
| `teacherOnly` | Objeto obrigatório com listas `quizKeys` e `lessonPlans`, inclusive vazias |

O arquivo completo é **privilegiado**, destinado à importação administrativa. Nunca
enviar esse envelope ao aluno. `toStudentLesson(unknown)` valida, seleciona somente
`schemaVersion/context/lesson/activities` e devolve uma cópia sem `teacherOnly`.
Essa projeção não é autorização: o backend deve aplicar RLS e checar o destinatário.

## Atividades

Todas exigem `key`, `type`, `title`, `orderIndex`, `required`, `prerequisites` e
`content`. Apenas `description` e `durationMinutes` são opcionais. `key` segue
`^[a-z][a-z0-9-]{0,63}$`; `orderIndex` é inteiro 0–100000. Tempos são minutos inteiros
1–1440. `prerequisites` é uma lista de chaves da mesma aula, sem duplicação,
autorreferência ou ciclos. Ordem de exibição não cria dependências implícitas.

Todo `content` exige `schemaVersion: 1` e `type` idêntico ao tipo da atividade.

| Tipo | Campos públicos obrigatórios de `content` |
| --- | --- |
| `slides`, `mindmap` | `resourceUrl`, `format` (`pdf`, `image`, `link`), `altText` |
| `quiz` | `passingScore` inteiro 0–100, `maxAttempts` inteiro 1–100, `questions` (4–100) |
| `online_lesson` | `objective`, `preparation` (lista de textos) |
| `project` | `instructions`, `objectives`, `requirements`, `assessmentCriteria` (listas não vazias), `resources` (lista de `{title,url}`) |

Cada pergunta exige `key`, `prompt` e 2–12 `options` com `key` e `text`. Chaves das
perguntas e das alternativas de cada pergunta são únicas. Não há `isCorrect`,
resposta, feedback de correção ou orientação interna nesse objeto público.

URLs de recursos/projetos devem ser HTTPS absolutas, sem espaços, com até 2048
caracteres. Não há HTML remoto executável ou inserção de HTML bruto nesta fundação;
blocos de código são texto e precisam de renderização escapada nas futuras telas.

## Conteúdo exclusivo da professora

`teacherOnly.quizKeys[]` contém `{activityKey,content}`. `content` exige
`schemaVersion:1` e `answers[]`; cada resposta tem `questionKey`, `optionKey` e
`feedback`. Exatamente um gabarito por quiz e uma alternativa válida para cada
pergunta; gabaritos incompletos, duplicados ou órfãos são rejeitados. Cada alternativa
correta vale a mesma fração da nota. O serviço da [etapa B](ambiente-aprendizagem-etapa-b.md)
calcula a porcentagem e arredonda somente o resultado final para duas casas decimais.
O arquivo não contém resultados de alunos. UUID de submissão e feedback de tentativas
são registros de execução, sem alterar este contrato de autoria v1.

`teacherOnly.lessonPlans[]` contém `{activityKey,content}`, exatamente um por
atividade `online_lesson`. `content` exige `schemaVersion:1`, `objectives`,
`prerequisites`, `preparation`, `durationMinutes`, `assessmentCriteria` e `steps`.
Cada etapa exige:

- `key`, `title`, `objective`, `durationMinutes`, `guidance`;
- `questions[]` com `prompt` e `expectedAnswer`;
- `detailedExplanation`, `playfulExplanation`, `commonDifficulties[]`, `challenge`.

Somente `code` é opcional. Quando presente, exige `language`, `file`, `source` e
`expectedResult`. As chaves de etapas são únicas. O roteiro é reutilizável; as etapas
marcadas e avaliações individuais não pertencem ao JSON de autoria.

Campos não especificados são rejeitados em todos os objetos. Textos têm 1–20000
caracteres. Listas gerais têm até 200 itens; limites particulares constam no schema.
A validação não converte tipos, remove campos extras ou insere valores padrão.
Erros estruturais retornam caminhos JSON; erros semânticos identificam a chave afetada.

## Persistência e futura importação

Nenhum importador ou botão de publicação foi criado nesta etapa. A etapa E deverá:

1. Validar o envelope inteiro com `validateLessonImport` no backend; exigir admin ativo.
2. Receber IDs de destino explicitamente escolhidos e confirmar a hierarquia existente;
   não localizar ou sobrescrever aulas somente pelo título ou confiar em IDs do JSON.
3. Tratar `lesson.key` como chave externa do arquivo; não é UUID nem altera o ID da aula.
   `lesson.title/description/durationMinutes` mapeiam aos campos atuais de `lessons`,
   com confirmação explícita de alterações; `objectives` vão a `lesson_learning_metadata`.
4. Criar atividades em rascunho; persistir `key/type/title/description/orderIndex/required/`
   `durationMinutes` nas colunas correspondentes e **somente `content`** em `content_json`.
   Usar `revision=1` inicialmente. A `schemaVersion` é a versão do formato, não a revisão editorial.
5. Resolver pré-requisitos por `key` e inserir em `activity_prerequisites`; separar
   `quizKeys[].content` em `activity_quiz_keys` e `lessonPlans[].content` em
   `teacher_lesson_plans` com revisão própria. Nunca persistir `teacherOnly` em atividades.
6. Validar tudo, mostrar prévia e publicar em uma transação; um erro deve desfazer
   todas as gravações. Não implementar upsert que sobrescreva atividade já publicada.
   Reimportação com mesma chave deve produzir conflito revisável, sem duplicação silenciosa.

## Evolução

Versões desconhecidas falham de forma explícita. Mudanças incompatíveis exigem novo
schema/validador versionado e conversão explícita; não reinterpretar conteúdo v1 salvo.
Para outro tipo: atualizar união TypeScript, schema, validação semântica, constraints,
regras de publicação/progresso/RLS, testes e o futuro renderizador. Nunca aceitar um
tipo desconhecido por fallback genérico. Work e EduForge são possíveis produtores do
arquivo, sem SDK, chamada externa ou dependência direta dessas ferramentas.
