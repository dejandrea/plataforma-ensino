# Disponibilidade por dia da semana

Implementação local em 09/11/2026, seguida de autorização explícita da usuária para ativar somente o banco e a função de disponibilidade. A migration foi aplicada e a função publicada; não houve push, merge ou publicação do frontend nesta ativação.

## Ativação autorizada em produção

- Projeto `codePlatform`, ref `gnyiyhnbpjhdgrhsevbh`.
- Migration aplicada: `20261109194229_weekly_availability_intervals.sql`. O arquivo local inicialmente preparado como `20261109191348` foi alinhado ao timestamp registrado pelo servidor, sem repair de histórico.
- Coluna `availability_weekly_intervals jsonb` nullable e constraint validadas. Cache PostgREST atualizado; consulta HTTP da coluna respondeu 200.
- `google-calendar-sync-availability` atualizada de v6 para **v7**, ACTIVE, `verify_jwt=true`.
- OPTIONS respondeu 200; POST sem autenticação respondeu 401. Não foi disparada sincronização de uma agenda real durante a verificação.
- As duas configurações existentes permaneceram iguais em seus campos anteriores; a nova coluna ficou NULL, preservando o legado. Fingerprint dos 747 registros de agenda permaneceu igual. RLS e suas cinco políticas foram preservadas.
- Código anterior da função guardado localmente em `tmp/weekly-deploy-20261109-previous-function.json`, ignorado pelo Git. É cópia de código para recuperação, não backup do banco.
- Não foram aplicadas migrations nem implantadas funções do gerenciador de apresentações web ou de outros recursos.

Próxima verificação operacional: atualizar a tela e salvar as faixas desejadas com a conta da professora. O salvamento poderá acionar a sincronização normal já existente da plataforma; essa ação não foi simulada com credenciais reais pela auditoria.

## Uso

Em **Configurar Disponibilidade**, definir primeiro a janela geral, a duração das aulas e o horizonte. Em seguida, ajustar as faixas de cada dia:

- `+ Adicionar`: ativa o dia ou acrescenta outra faixa livre, sem criar intervalos sobrepostos automaticamente.
- `×`: remove a faixa. Um dia sem faixas fica indisponível.
- `Copiar`: permite escolher os dias de destino e confirmar a substituição das suas faixas. Nada é aplicado a outros dias sem essa escolha.
- `Salvar disponibilidade`: valida, salva e usa a sincronização automática já existente, quando o Google estiver conectado.

Exemplo: janela **07:00–20:00**, segunda a sexta **14:00–20:00**, sábado **07:00–09:00** e **14:00–19:00**, domingo indisponível. A manhã do sábado não libera as manhãs dos dias úteis.

Alterar a janela geral não sobrescreve silenciosamente as faixas. Se a nova janela excluir alguma faixa existente, a interface solicita sua correção antes de salvar. Cada faixa deve comportar pelo menos uma aula completa; sobra inferior à duração não gera horário adicional.

## Persistência e compatibilidade

Migration: `supabase/migrations/20261109194229_weekly_availability_intervals.sql`.

Nova coluna nullable `teacher_calendar_settings.availability_weekly_intervals`, tipo JSONB. Exemplo:

```json
{
  "1": [{"start": "14:00", "end": "20:00"}],
  "2": [{"start": "14:00", "end": "20:00"}],
  "3": [{"start": "14:00", "end": "20:00"}],
  "4": [{"start": "14:00", "end": "20:00"}],
  "5": [{"start": "14:00", "end": "20:00"}],
  "6": [{"start": "07:00", "end": "09:00"}, {"start": "14:00", "end": "19:00"}],
  "7": []
}
```

Dias ISO: 1 = segunda; 7 = domingo. Horários locais `HH:mm`, no fuso cadastrado. Chaves omitidas e arrays vazios significam dia fechado; um objeto vazio fecha a semana inteira. `NULL` preserva exatamente a configuração antiga de dias e janela, sem backfill. O formulário salva os sete dias explicitamente e atualiza a lista legada de dias ativos para compatibilidade.

O banco exige objeto JSON e mantém as permissões/RLS existentes. A validação compartilhada, usada pela tela e pela função, rejeita dias/formato inválidos, mais de 24 faixas por dia, sobreposições, duração insuficiente e horários fora da janela. Configuração nova inválida nunca é reinterpretada silenciosamente como janela antiga.

Janelas noturnas continuam suportadas. Quando o fim é menor ou igual ao início, a janela termina no dia seguinte. Por exemplo: segunda 23:00–02:00 pertence à janela iniciada na segunda e pode gerar a parte de terça de madrugada. O gerador também considera essa parte se a sincronização ocorrer após meia-noite.

## Geração e proteção

`google-calendar-sync-availability` usa as faixas do dia, o fuso, a duração e o horizonte. Mantém o limite mínimo de cinco minutos no futuro, os conflitos do Google e das aulas confirmadas/concluídas. Uma aula precisa caber por inteiro numa faixa; intervalos para almoço não são atravessados.

A consulta de conflitos da plataforma passou a considerar aulas que começaram antes do início do dia e ainda não terminaram. Falha geral ou parcial do Google, conflito inválido ou configuração inválida interrompe o processamento antes de remover/inserir horários.

Somente horários `available` com provedor `google_calendar_availability` são regenerados. Aulas confirmadas, concluídas, canceladas e horários manuais são preservados. O controle existente de professora/admin e vínculo do aluno permanece. Não há mudança de XP, progresso, avaliação ou financeiro.

## Arquivos

- `src/pages/TeacherScheduling.tsx`: leitura, validação, salvamento, editor e ajuste das abas no celular.
- `src/components/WeeklyAvailabilityEditor.tsx`: faixas, inclusão/remoção, cópia explícita e mensagens acessíveis.
- `supabase/functions/_shared/weekly-availability.ts`: contrato, compatibilidade e validação compartilhados.
- `supabase/functions/google-calendar-sync-availability/index.ts`: geração por faixas e validação antes da escrita.
- Migration citada acima, aplicada após autorização conforme registro de ativação.
- `tests/weekly-availability.test.mjs`: regras e PostgreSQL/RLS isolados.
- `tests/weekly-availability-edge.test.ts`: função real executada com banco e Google simulados, usando Luxon real.
- `tests/weekly-availability-browser.test.mjs`, `tests/fixtures/weekly-availability.html` e `.tsx`: formulário real, gravação simulada, reabertura e celular.
- `tests/deno-availability.json` e `deno.lock`: ambiente isolado e versões das dependências Edge já utilizadas; sem mudança de dependências do frontend.
- `package.json`: comandos de teste.

## Verificações

```text
npm.cmd run test:availability
npm.cmd run test:availability:browser
deno test --config tests/deno-availability.json --allow-read --no-check tests/weekly-availability-edge.test.ts
deno check --config tests/deno-availability.json supabase/functions/google-calendar-sync-availability/index.ts
npm.cmd run build
```

Testes cobrem o exemplo solicitado, semana fechada, legado, horários adjacentes/sobrepostos, virada de dia, transição real de fuso, falhas do Google, vínculo do aluno e preservação de aulas e horários manuais. A migration foi aplicada somente a um PostgreSQL PGlite vazio com dados sintéticos, verificando a política de proprietário já existente.

Resultados: seis testes de regras/migration/RLS e seis testes da função aprovados; fluxo de navegador aprovado em desktop e celular, incluindo salvar/reabrir a configuração e cópia explícita. Build e checagem Deno aprovados, assim como o lint do editor e do validador compartilhado. Permanecem os avisos preexistentes de Browserslist e tamanho dos bundles.

Capturas locais: `output/availability/horarios-semana-desktop.png`, `horarios-semana-celular.png` e `agenda-celular.png`. A prévia móvel isola o editor na mesma largura real do modal para mostrar os sete dias sem o recorte da rolagem. A página e o editor foram verificados com largura de 390 pixels e sem transbordamento horizontal. Os arquivos não são publicados no Git.

## Plano de ativação original e cuidados de recuperação

As etapas de banco e função abaixo foram concluídas conforme o registro no início deste documento. Não houve publicação do frontend nesta ativação; a tela com o editor já estava sendo utilizada pela usuária.

1. Rever o inventário remoto e as migrations aplicadas, sem push indiscriminado.
2. Aplicar somente a migration indicada, após confirmar seus pré-requisitos e a estratégia de recuperação.
3. Publicar a função `google-calendar-sync-availability` e verificar autenticação e execução com uma professora de homologação.
4. Publicar o frontend e testar salvar/reabrir com Google conectado e calendário de teste, sem alterar agendas reais de alunos.

A função nova precisa estar disponível **antes** de liberar o editor: a função antiga desconhece faixas semanais e usa apenas a janela geral. Para reverter o frontend, manter a função nova compatível com configurações legadas. Não remover a coluna nem voltar à função antiga enquanto houver configurações semanais personalizadas, pois isso ampliaria indevidamente os horários publicados.

Não é uma alteração nas regras de disponibilidade do próprio Google Agenda: o visual é semelhante, mas as faixas são salvas na Bitaria e o Google continua sendo consultado para conflitos. Permanece pendente a homologação conectada ao Google antes da ativação em produção.

Referência consultada: [JSONB no Supabase](https://supabase.com/docs/guides/database/json).
