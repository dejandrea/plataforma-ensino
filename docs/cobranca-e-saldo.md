# Cobrança, pagamentos e saldo de aulas

## Onde gerenciar

- **Financeiro → Cobranças**: lista por mês de vencimento, alunos, cobranças e pagamentos.
- **Gestão → Usuários → Editar aluno** e **Ver aluno**: configuração individual.
- **Financeiro → Resumo financeiro**: atalho para gerenciar a cobrança do aluno. O valor das aulas realizadas nessa tela é um resumo de atividade; a cobrança oficial e os pagamentos ficam em Financeiro.
- **Minha jornada**, **Minhas aulas** e **Meu perfil**: o aluno vê seu tipo de cobrança, saldo, vencimento e último pagamento.

## Configuração inicial

Escolha pré-pago ou pós-pago, o mês inicial e o dia de vencimento. No pré-pago, informe a quantidade mensal e o preço, ou use um pacote cadastrado para preencher esses valores.

Nenhum aluno existente é incluído automaticamente na cobrança. A geração começa no mês configurado. Configurações já faturadas são preservadas; mudanças de plano valem a partir de uma competência futura. Vencimentos de cobranças individuais podem ser alterados pela gestão.

## Pré-pago

- No dia 01, a quantidade mensal é acrescentada ao saldo, mesmo que o vencimento seja em outro dia.
- O saldo não utilizado acumula e não expira.
- Cada aula com status concluída consome uma unidade; agendar não reserva saldo.
- Cancelar uma aula anteriormente concluída devolve a unidade ao saldo.
- Ao zerar, novos agendamentos são bloqueados. Aulas já agendadas podem ser realizadas. Se o consumo ultrapassar os créditos, o sistema sinaliza a quantidade a repor.
- Recargas extras geram uma cobrança própria. Seus créditos são liberados após o pagamento integral.
- Para importar saldo já pago anteriormente, registre a quantidade disponível em uma recarga de valor zero.

## Pós-pago

As aulas concluídas são agrupadas pelo mês de início da aula, no fuso America/Bahia. O valor considera as horas e o preço hora/aula preservado na cobrança. O mês corrente aparece em apuração; o fechamento fica disponível no dia 01 do mês seguinte.

O vencimento ocorre no mês seguinte ao das aulas, no dia configurado. Nos meses sem esse dia, usa-se o último dia do mês.

Os descontos contínuos e mensais cadastrados são aplicados às cobranças mensais. Um desconto mensal substitui o contínuo. Na recarga extra, o valor informado é o valor final combinado.

## Recebimentos e atraso

O gestor registra o valor recebido e a data real do pagamento. Pagamentos parciais são aceitos; a cobrança continua pendente enquanto houver saldo a receber. Um registro incorreto pode ser estornado, preservando seu histórico.

Cobranças mensais com saldo em aberto por **mais de 15 dias** bloqueiam novos agendamentos. Exatamente 15 dias ainda não bloqueiam. A quitação ou a alteração do vencimento recalcula a restrição imediatamente. Conteúdos, histórico e aulas já agendadas continuam disponíveis.

Recargas extras não pagas não concedem saldo e não geram bloqueio adicional por atraso.

Correções nas aulas concluídas ou nos descontos recalculam o valor das cobranças mensais, preservando os pagamentos já registrados. A gestão deve revisar o saldo em aberto após uma correção histórica.

## Renovação e verificação técnica

A rotina `bitaria-billing-renewal` roda diariamente às 03:00 UTC, meia-noite na Bahia. Ela gera competências que estiverem faltando, sem duplicar mensalidades. A consulta do saldo também atualiza a conta, recuperando uma renovação eventualmente não executada pelo agendamento. A restrição de agendamento é validada no servidor e no banco.

Testes de cálculo e autorização:

```sh
node --test tests/billing.test.mjs tests/discounts.test.mjs tests/manual-lesson.test.mjs tests/google-calendar-sync.test.mjs
```

`tests/billing.integration.sql` valida renovação, acúmulo, consumo, cancelamento, pagamento parcial, estorno, fechamento, vencimento e permissões em uma transação com rollback. Execute em um cliente SQL com suporte a múltiplas instruções; nenhum registro de teste é preservado.

Referência do agendador: [Supabase Cron](https://supabase.com/docs/guides/cron).
