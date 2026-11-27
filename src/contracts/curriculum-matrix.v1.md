# Matriz curricular Bitaria v1

Na Gestão Curricular, selecione o curso e clique em **Exportar matriz curricular**.
Para editar descrições e objetivos no ChatGPT ou ChatGPT Work, anexe o JSON exportado
e o [JSON Schema oficial](curriculum-matrix.v1.schema.json). Peça um único arquivo
JSON UTF-8, com os mesmos UUIDs e hierarquia, e solicite as mudanças de conteúdo nos
campos permitidos. Use [o modelo sintético](examples/curriculum-matrix.v1.json) para
criar um curso do zero.

## Estrutura e campos

O objeto raiz exige `schemaVersion: 1` e `course`. Cada registro exige
`title` como texto com até 300 caracteres e pelo menos um caractere visível.
Cada nível pode conter sua lista de filhos, na sequência `modules`,
`submodules`, `lessons`. A lista pode ser omitida ou vazia.

| Campo opcional | Nível | Valor |
| --- | --- | --- |
| `id` | Todos | UUID exportado pela Bitaria |
| `description` | Todos | Texto com até 20.000 caracteres |
| `totalHours` | Curso | Inteiro entre 0 e 100.000 |
| `orderIndex` | Módulo, submódulo, aula | Número entre −1.000.000 e 1.000.000, inteiro na aula |
| `durationMinutes` | Módulo, submódulo, aula | Inteiro entre 0 e 1.440 |
| `lessonKey` | Aula | Chave editorial já existente, usada para identificar uma aula |
| `curriculumNumber` | Aula | Inteiro entre 0 e 999 |
| `objectives` | Aula | Até 100 textos distintos, de até 2.000 caracteres, cada um com pelo menos um caractere visível |

O número curricular é um metadado existente e pode se repetir entre versões.
A correspondência usa UUIDs, chaves editoriais e títulos exatos, nessa ordem. Subtítulos e objetivos formais dos níveis
superiores não têm campos próprios nesse fluxo. Use as descrições para registrar
o contexto pedagógico desses níveis.

## Como importar

- **Criar novo curso** gera os UUIDs e inclui a hierarquia. Omita os UUIDs no
  modelo e omita também `lessonKey`. Cursos com o mesmo título, considerando maiúsculas e espaços externos,
  são bloqueados. As aulas começam em preparação.
- **Complementar curso existente** preenche lacunas e inclui novos registros após
  confirmação. Uma duração ou carga horária igual a zero é tratada como não
  cadastrada neste modo, seguindo o formulário manual.
- **Atualizar curso existente** propõe a troca de valores informados e a criação
  de novos registros, com comparação de antes e depois. Use os UUIDs exportados
  para renomear elementos existentes.
- Em cursos existentes, cada UUID deve pertencer ao nível e ao pai informados.
  Sem UUID, `lessonKey` identifica uma aula com chave já registrada no mesmo submódulo.
  Sem os dois, o sistema propõe a correspondência por título exato entre filhos do
  mesmo pai. Títulos ambíguos exigem UUID. No curso selecionado, use o título
  exato ou o UUID exportado.
- Campos opcionais ausentes, nulos, strings vazias ou em branco e listas de
  objetivos vazias preservam os dados atuais. Para novos registros, a ausência
  de ordem usa a posição do registro na lista, começando em 1. A ausência de
  duração ou carga horária usa zero. Registros omitidos são preservados.
- Revise a prévia, autorize as operações exibidas e confirme. Mudanças no curso
  entre a prévia e a confirmação exigem uma nova prévia. Conflitos editoriais
  aparecem por registro. Inclusões que mudariam a contagem de aulas ou módulos
  de um curso com alunos vinculados ou progresso exigem revisão da versão
  curricular. Resolva-os pelo fluxo editorial ou retire da matriz
  os valores que causam conflito.
- Limites de 1 MB e 1.000 registros no total, incluindo o curso. O arquivo
  contém somente metadados curriculares. Atividades, materiais, aulas publicadas,
  matrículas e progresso são administrados pelos fluxos próprios da Bitaria.

## Exemplos

Uma alteração pontual pode conter somente os pais e a aula desejada, com UUIDs
copiados da exportação. O objeto mínimo válido é
`{"schemaVersion":1,"course":{"title":"Curso sintético"}}`.

Erros comuns incluem `"schemaVersion":"1"`, `"durationMinutes":"30"`,
`"objectives":"Interpretar instruções"`, UUID de outro curso, UUID repetido,
duas aulas novas com o mesmo título no mesmo submódulo e `"publicationStatus":"published"`.
Para alterar o pai de uma aula existente, use a gestão curricular conforme as
restrições de identidade e histórico da plataforma.

## Kits Work

Após confirmar a matriz, abra uma aula elegível e exporte seu Kit Work. O arquivo
`identidade.json` traz títulos em `context`, descrições dos níveis superiores
e UUIDs em `curriculum`, título, descrição e duração em `lesson` e objetivos em
`metadata.objectives`. Use o objeto `context` original ao produzir o pacote de aula.

## Publicação

Aplique a migration `20261127120000_curriculum_matrix.sql` em homologação após as
migrations de currículo, editorial e pacotes unificados. Com um administrador
ativo, valide os três modos com o modelo sintético e confira o Kit Work de uma
aula elegível. Para publicação autorizada, aplique a migration antes de disponibilizar
o build do frontend e confira as permissões e os tempos de confirmação em homologação.
A confirmação usa os bloqueios transacionais do fluxo editorial, com espera de até
cinco segundos por bloqueio. Matrizes com dados legados fora dos limites do
contrato exigem correção cadastral antes da exportação.
A migration adiciona RPCs e estende a resposta do Kit Work. O contrato do pacote
de aula continua na versão existente.
