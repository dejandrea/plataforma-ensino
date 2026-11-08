# Meet fixo, avaliação individual e impressão de aulas

> Atualização de 08/11/2026: as pendências técnicas de banco e Edge foram aplicadas após autorização. Consulte o [registro de implantação](implantacao-agendamento-impressao-20261108.md). O texto abaixo documenta a entrega local de 07/11; as referências de arquivos SQL foram alinhadas aos identificadores efetivamente registrados pelo Supabase.

Entrega local de 07/11/2026, para revisão e homologação. Nenhum dado real foi lido ou modificado para os testes. Não houve migration remota, deploy, push, merge ou commit nesta tarefa.

## Diagnóstico dos fluxos existentes

- Agenda: `TeacherScheduling.tsx` confirma horários pela função `confirm-platform-lesson`; `book-platform-lesson` atende reservas do aluno; `create-platform-lesson` cria aulas; `reschedule-platform-lesson` move encontros. Todas reutilizam `_shared/google-calendar.ts`. A criação automática de uma conferência por evento tinha precedência sobre o link manual. Dados: `scheduled_lessons`, `teacher_student_relations` e `teacher_calendar_settings`.
- Avaliação: `module_evaluations` já fornece oito critérios, feedback por área, comentário geral/professora, data e módulo ou mês de mentoria. Telas: `AdminEvaluations`, `StudentReport` e `StudentHistory`; detalhes em `EvaluationDetails`. Foram preservados os filtros/RLS existentes e a imutabilidade de avaliações salvas.
- Relatório financeiro individual: o botão Baixar PDF em `StudentHistory` já chama `lessonReportPdf.ts`/`lessonReportPdfDocument.ts`. O cálculo vem de `discounts.ts` e do agrupamento de aulas concluídas. Mantivemos esse gerador e `pdf-lib`; não foram alteradas fórmulas, arredondamentos, descontos ou valores históricos.

## 1. Link fixo do Meet

### Comportamento implementado

O padrão pertence ao **vínculo professora–aluno**, em `teacher_student_relations.default_meet_link`. Isso permite salas distintas quando um aluno tem mais de uma professora, sem cadastro paralelo ou cópias do padrão em múltiplas preferências.

- No formulário de agendamento, escolher o aluno consulta o padrão e preenche o link das novas aulas. A opção “Usar link fixo do Google Meet para este aluno” permite selecioná-lo explicitamente.
- “Salvar link padrão” persiste a preferência; campo vazio e salvamento desativam o padrão. Trocar o padrão não atualiza nenhuma aula cadastrada.
- Um link preenchido como exceção no novo agendamento não muda o padrão. Sem padrão/link específico, permanece a geração automática anterior, conforme a configuração do Calendar.
- Uma sala já informada no horário é preservada; para substituir por outra no formulário é exigida confirmação explícita. Reagendamento usa o link da aula, não o padrão atual.
- O painel do histórico do aluno também permite gerenciar os padrões. O administrador pode escolher o vínculo/professora; a professora vê os vínculos permitidos pelas políticas existentes.
- A ação “Alterar Meet desta aula” está nos detalhes/cartões de aulas futuras agendadas. Modifica somente a aula escolhida; não muda a série inteira nem o padrão. Aulas concluídas/canceladas/passadas não são editadas por essa ação.
- O link resultante continua em `scheduled_lessons.meet_link`, consumido pelos detalhes/sala existentes; não foi criado outro mecanismo de entrada.

Validação de novos links/padrões: HTTPS, host exato `meet.google.com`, código `abc-defg-hij`; espaços externos são removidos e barra final é normalizada. Credenciais, query strings, host falso, redirecionadores e protocolos diferentes são rejeitados. Não é teste de existência/validade da sala no Google.

### Google Calendar e confirmação externa

Com link fixo, o evento recebe a URL em `location` e em `extendedProperties.private.bitariaMeetLink`. **Não se envia conferenceData.createRequest** e não se aguarda outra conferência. A sincronização passa a reconhecer a preferência explícita do evento. Sem link fixo, o fluxo anterior de geração/polling permanece. No Google o link é informado como localização/URL; isso não promete a criação do botão nativo de uma nova conferência. Uma tentativa idempotente que encontra evento existente com outra sala é rejeitada para exigir sincronização, em vez de sobrescrever o evento silenciosamente.

Ao alterar uma aula já sincronizada, o usuário precisa confirmar a substituição da sala desse evento e a notificação dos convidados. O PATCH modifica somente sala/metadados; usa ETag/If-Match quando disponível, remove a conferência anterior do evento explicitamente e preserva horário, título, convidados e outros metadados. O código não copia conferenceData de outros eventos nem cria uma conferência duplicada. A documentação do Google alerta para riscos de copiar dados de conferência entre eventos; a solução informa um link existente e mantém o controle de acesso/validade com o Google: [Events: insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert).

**Limitação operacional:** Google e Postgres não participam de uma transação única. Se o Google atualizar e a gravação local falhar/concorrer, a ação informa o erro e exige atualizar/sincronizar antes de tentar de novo. Não prometer atomicidade distribuída. O Calendar real e notificações precisam de homologação em uma conta/agenda de teste autorizada; os testes desta entrega substituem o transporte externo.

### Migration proposta, não aplicada em produção

[20261108210555_student_meet_preferences.sql](../supabase/migrations/20261108210555_student_meet_preferences.sql), criada pela CLI local, contém o SQL completo para revisão:

1. Adiciona somente `default_meet_link` nullable ao vínculo, com CHECK de formato; sem backfill e sem UPDATE em `scheduled_lessons`.
2. Adiciona leitura para administrador ativo, preservando as políticas anteriores do vínculo.
3. Cria RPC `set_student_meet_link` com implementação privada, search_path fechado e verificação de usuário ativo, papel e professora do vínculo. A RPC altera somente esse campo. Não adiciona uma política genérica de UPDATE da relação, evitando ampliar acesso a teacher_id/student_id.

Pré-requisitos: tabelas profiles/teacher_student_relations, auth.uid(), papéis anon/authenticated e schema privado conforme a arquitetura existente. Conferir objetos/políticas no destino antes de aplicar somente esta migration, após autorização. Não executar db push indiscriminado. A migration foi aplicada exclusivamente no PGlite sintético do teste.

## 2. Impressão da avaliação

“Imprimir avaliação” foi acrescentado à avaliação administrativa, ao boletim do próprio aluno e às avaliações do histórico. Usa a avaliação que a tela já obteve sob as regras de acesso atuais; não consulta avaliação arbitrária por uma URL pública nem acrescenta permissões de leitura.

O documento inclui nome já cadastrado, data registrada, mês/módulo e modalidade, oito critérios com os resultados existentes, feedback por área, avaliação geral e comentário da professora quando diferente do geral. Curso aparece quando a relação carregada contém seu título. Campos ausentes são indicados como não registrados; não se calculam notas novas ou indicadores. Pontos fortes/recomendações presentes nos comentários são mantidos integralmente, sem extrair ou inventar novas classificações.

O visual usa logo oficial para fundo claro, texto escuro em papel branco, destaques discretos e A4 com margens de 15/16 mm. Os critérios evitam quebra interna; comentários extensos fluem com controle de linhas órfãs/viúvas e sem truncamento. A avaliação comum ficou em uma página; o caso excepcional de 35 comentários longos ficou em quatro páginas, preservando o marcador final e os 35 itens. O rodapé foi conferido visualmente para evitar uma página final contendo somente essa identificação.

A impressão usa iframe temporário em memória (`about:blank`), sem dados pessoais na URL e sem novo endpoint de dados. Imagem e fontes são aguardadas antes de chamar print(). Botões, menus e controles administrativos ficam fora do documento. O iframe é removido após imprimir/cancelar, com limpeza de segurança após cinco minutos. O navegador permite escolher impressora ou Salvar como PDF. Cancelamento/diálogo real variam entre navegadores; a automação intercepta somente a chamada ao diálogo e gera o PDF pelo Chrome com o mesmo documento/CSS.

## 3. Relatório de aulas em A4

Foi mantida a ação Baixar PDF e o gerador existente, para abrir/imprimir o arquivo no leitor de PDF do navegador. Não foi acrescentada biblioteca.

- Cabeçalho menor com logo oficial, aluno e período.
- Tabela clara com data/hora, duração, assunto/modalidade e situação realizada. O fluxo de origem fornece somente aulas concluídas.
- Resumo na mesma página com quantidade, horas, hora/aula, bruto, descontos e total recebidos do cálculo existente.
- Textos em 10 pt na tabela e 11 pt nos valores; não se usa transform:scale nem fontes minúsculas para reduzir a página inteira. Legendas/cabeçalhos auxiliares usam 8,5–9 pt.
- Até dez linhas por página, com altura adaptada ao texto. Descrições muito extensas continuam em outras páginas; o resumo não é cortado. Títulos continuam sendo ordenados pela data decrescente como antes.
- Valores não foram recalculados pelo gerador. Não havia preço por aula no contrato de entrada desse PDF; portanto não foi inventada uma distribuição de descontos por linha.
- O PDF não carrega mais a imagem decorativa da mascote, que deixou de ser usada pelo layout compacto. A identidade oficial foi preservada.

## 4. Evidências e testes

Todos os documentos abaixo são **sintéticos**, sem dados reais. Artefatos em `output/pdf` são locais/ignorados pelo Git.

| Verificação | Resultado |
|---|---|
| Meet: handlers reais com transporte simulado + migration/RPC/RLS em PGlite | 6 testes passaram. Sem padrão, múltiplas reservas, exceção, troca do padrão, reagendamento, permissões, histórico e concorrência/confirmação externa. |
| Regressões Calendar | 4 testes passaram. |
| Regressões avaliação/revisão | 4 testes passaram. |
| PDFs de aulas | 13 testes passaram: 1, 5, 7, 8, 10, 11 e 24 aulas; desconto/sem desconto, valores altos, acentos, títulos longos e título excepcional multipágina. Objetos de entrada não são modificados. |
| Componentes reais no navegador | 1 cenário passou: seleção/salvamento do padrão, exceção sem alterar padrão, troca de aluno e avaliações esparsa/completa/longa; sem requisições externas ou erros JavaScript. |
| Download do PDF no navegador | 1 cenário passou, incluindo falha de recurso e nova tentativa. |
| Build TypeScript/Vite | Passou; avisos preexistentes de Browserslist/bundles grandes. |
| Lint focal dos novos componentes e gerador | Passou. |

Total: **27 testes funcionais/documentais e 2 cenários de navegador**. Os cenários são complementares; não representam teste do Google real ou impressão em todas as impressoras.

Também foi exercitada a política real de leitura da professora vinculada de `module_evaluations`: professora vinculada lê o registro correspondente, professora não vinculada/inativa não lê. A política e as consultas existentes não foram alteradas para permitir impressão. Homologar também os papéis admin/aluno no ambiente de teste integrado antes da publicação.

### PDFs e capturas

- [Relatório com dez aulas — uma página](../output/pdf/relatorio-10-aulas.pdf).
- [Dez aulas com valores altos e desconto — uma página](../output/pdf/relatorio-10-aulas-valores-altos.pdf).
- [Relatório com onze aulas — duas páginas](../output/pdf/relatorio-11-aulas.pdf).
- [Avaliação com poucos dados](../output/pdf/avaliacao-sparse.pdf).
- [Avaliação completa](../output/pdf/avaliacao-complete.pdf).
- [Avaliação com comentários extensos](../output/pdf/avaliacao-long.pdf).
- [Captura da página A4 com dez aulas](../output/pdf/relatorio-10-aulas-pagina-1.png).
- [Captura da avaliação completa](../output/pdf/avaliacao-complete-pagina-1.png).
- [Medições de A4/páginas e texto dentro do papel](../output/pdf/validacao-impressao.json).

As medições conferem dimensões A4, ausência de texto fora do papel, dez assuntos/valores no caso principal e preservação integral dos comentários longos. A revisão visual das páginas é complementar à extração de texto, não substituída por compilação de CSS.

Comandos locais:

```text
npm.cmd run test:scheduling-print
npm.cmd run test:scheduling-print:browser
npm.cmd run build
```

Na preparação dos testes foram corrigidos o mock inicial da fixture, seletores ambíguos e a limpeza do iframe; as execuções finais passaram. Deno não estava no PATH nesta sessão; a checagem Deno do pacote Edge completo permanece uma etapa de preparação do release. Os handlers alterados foram executados/transpilados nos testes locais; o build TypeScript cobre o frontend.

## 5. Arquivos criados/alterados

| Área | Arquivos |
|---|---|
| Agendamento e padrão | `src/components/MeetSchedulingFields.tsx`, `src/pages/TeacherScheduling.tsx`, `src/pages/StudentHistory.tsx`, `supabase/functions/_shared/meet-link.ts` |
| Calendar e persistência de agendamentos | `supabase/functions/_shared/google-calendar.ts`, `create-platform-lesson/index.ts`, `confirm-platform-lesson/index.ts`, `book-platform-lesson/index.ts`, `reschedule-platform-lesson/index.ts` (todos em supabase/functions) |
| Edição individual da sala | `supabase/functions/update-lesson-meet/index.ts` |
| Migration local | `supabase/migrations/20261108210555_student_meet_preferences.sql` |
| Avaliação impressa | `src/components/EvaluationPrintDocument.tsx`, `src/components/PrintEvaluationButton.tsx`, `src/lib/printEvaluation.tsx`, `src/components/EvaluationDetails.tsx`, `src/pages/AdminEvaluations.tsx`, `src/pages/StudentReport.tsx`; ação também em StudentHistory |
| Relatório de aulas | `src/lib/lessonReportPdfDocument.ts`, `src/lib/lessonReportPdf.ts` |
| Testes/fixtures | `tests/meet-scheduling.test.mjs`, `tests/scheduling-print-browser.test.mjs`, `tests/fixtures/scheduling-print.html`, `tests/fixtures/scheduling-print.tsx`, `tests/lesson-report-pdf.test.mjs` |
| Comandos/documentação | `package.json`, este relatório |

O marcador `supabase/.temp/cli-latest` já estava alterado antes da tarefa; não faz parte da implementação. Não foi introduzida dependência npm nova. Artefatos de teste e scripts de inspeção temporários não são arquivos da aplicação.

## 6. Homologação antes da publicação

1. Revisar o SQL acima e conferir schema/permissões reais, sem dados pessoais nos logs. Após autorização, aplicar somente a migration necessária em ambiente isolado com os pré-requisitos da plataforma.
2. Preparar o bundle Edge e executar Deno check com a ferramenta disponível/aprovada. Não usar uma implantação do frontend sem preparar as RPCs/funções de que ele depende.
3. Em uma agenda de teste e alunos sintéticos, homologar preferência, ausência de preferência, recorrência, exceção em uma aula, reagendamento, alteração de padrão sem histórico e troca de sala externa com confirmação. Verificar convites e ausência de conferência nova quando há link fixo.
4. O release deve incluir `google-calendar-sync` recompilada com o helper compartilhado, além de `create-platform-lesson`, `confirm-platform-lesson`, `book-platform-lesson`, `reschedule-platform-lesson` e `update-lesson-meet`. A sincronização antiga não reconhece os metadados do link fixo. Em implantação autorizada: migration aditiva → sincronização/leitor atualizado → demais funções → frontend.
5. Com papéis admin, professora vinculada, professora não vinculada, aluno e conta inativa, conferir acesso e impressão. Cancelar e imprimir novamente; abrir avaliação anterior e outro aluno para conferir a identificação correta. Confirmar que nenhum comentário está truncado.
6. No PDF de aulas, conferir 1/5/8/10/11+, valores/descontos e títulos excepcionalmente longos. No Chrome/Edge, abrir PDF e usar Imprimir/Salvar como PDF em A4, escala 100%, sem ajuste artificial de página.
7. Recuperação: reverter o frontend/funções autorizados se necessário; manter a coluna aditiva e preferências enquanto houver código que as utiliza. Não apagar aulas, relações, avaliações, cobranças ou valores históricos. Falhas parciais Google/banco exigem reconciliação do evento específico, não reimportação indiscriminada.

**Próxima autorização:** homologação/implantação em ambiente definido e, separadamente, eventual aplicação em produção. Esta entrega não autoriza commit/push/merge/deploy nem alterações reais de alunos. XP, progresso e currículo não foram modificados.
