# Atualização segura da Aula 02

Implementação para a aula `b17a2000-0000-4000-8000-000000001002`. Backend instalado em 12/11/2026, após aceitação explícita do risco de recuperação. Este release contém o frontend para homologação sem salvamento. O importador original continua sendo de inclusão; não foi convertido em um sobrescritor geral.

## Comportamento

Em Importar atividades JSON, a Aula 02 inicia no modo de atualização com comparação. O documento é validado pelo contrato v2 existente. “Comparar com as atividades existentes” consulta o estado atual e mostra UUIDs, ações, posições, obrigatoriedade, campos alterados e antes/depois. Também mostra os nomes de contexto do arquivo e do banco: a confirmação aceita o destino identificado pelo UUID sem renomear curso, módulo ou submódulo, nem modificar o arquivo original.

Após confirmação, “Salvar atualização revisada” atualiza somente diferenças aprovadas e insere somente keys ausentes. Novos vídeo/cartões ficam em rascunho. Publicar esses novos registros exige o botão separado de publicação existente; ele recebe somente os UUIDs recém-inseridos. A publicação da aula e os vínculos de apresentações não são alterados.

O botão “Atualizar atividades salvas”, em Visualizar aula, permite recarregar o inventário sem reabrir a aplicação. A prévia continua sem gravar estudo, tentativas ou XP.

## Escopo e proteções

- Apenas as oito keys conhecidas da Aula 02, tipos correspondentes e posições únicas de 0 a 7; seis atividades originais precisam existir, nenhuma é apagada.
- Admin ativo obrigatório nas duas RPCs. Anônimo não recebe EXECUTE. Helpers, permissões transitórias e auditoria ficam em private, com RLS e sem acesso direto para clientes ou service_role.
- Bloqueia se houver progresso da aula/atividades, tentativas, sessões de avaliação, entregas, sessões pedagógicas, revisões de flashcards ou XP com origem na aula/atividades. Não tenta migrar esse histórico nem zerá-lo. Se surgir uso real, será necessário outro desenho de versionamento.
- Bloqueia dependências de atividades, registros inesperados/inativos e alterações de avaliações ou gabaritos. As perguntas, pares, respostas e feedbacks existentes devem continuar iguais.
- Bloqueia alteração de atividade já vinculada a apresentação web. Não remove nem substitui vínculos para contornar isso. Apresentações privadas não vinculadas são preservadas.
- Exige nova comparação se documento, contexto, metadados, atividades, gabaritos, inventário de apresentações ou vínculos mudarem. O token é de concorrência otimista, não de autenticação.
- Confirmação explícita é obrigatória; modificar o texto do JSON descarta a aprovação na interface.
- Bloqueios de tabela breves serializam alterações de inventário e histórico durante a escrita, com lock_timeout de 5 segundos. Eles podem causar espera temporária em escritas de outras aulas; timeout implica rollback, não repetição automática.
- Exceção à imutabilidade restrita a pares exatos antes/depois, UUID da atividade e transação atual, autorizados internamente pela RPC. Não usa flags de sessão editáveis pelo cliente, não desabilita triggers e mantém as demais validações do guard.
- Preserva id, key, revisão e publicação das atividades existentes, além do status da aula. Como não pode existir histórico, não invalida conclusões anteriores. Não aumenta artificialmente a revisão nem cria UUIDs substitutos.
- Falhas desfazem a operação inteira. Auditoria imutável guarda documento e estado anterior/posterior, incluindo conteúdo administrativo, apenas no schema privado; não é backup externo nem prova de recuperação.

As atividades novas reutilizam a função de importação existente, recebendo um envelope interno limitado a vídeo/cartões e o contexto de destino explicitamente revisado. Não há segundo parser nem alteração no contrato. A projeção pública continua excluindo teacherOnly.

## Arquivos

- `supabase/migrations/20261112035823_reconcile_a02_learning_content.sql`: permissões transitórias, auditoria, ajuste restrito do guard e RPCs `plan_a02_reconciliation` / `apply_a02_reconciliation`.
- `src/lib/a02Reconciliation.ts`: chamadas tipadas e mensagem de instalação pendente.
- `src/components/learning/A02Reconciliation.tsx`: comparação, confirmação e salvamento.
- `src/components/learning/LessonContentImporter.tsx`: integração do modo seguro da Aula 02.
- `src/components/learning/AdminLessonPreview.tsx`: recarga do inventário salvo.
- Testes de banco e navegador em `tests/a02-reconciliation*.test.mjs`, com fixtures isoladas em `tests/fixtures/a02-reconciliation*` e duas RPCs adicionadas ao harness local.

## Validação local

```powershell
node --test --test-concurrency=1 tests/a02-reconciliation.test.mjs tests/a02-reconciliation-browser.test.mjs tests/admin-lesson-preview.test.mjs tests/learning-content.test.mjs tests/managed-presentations.test.mjs
npm.cmd run build
```

A suíte integrada passou com 31 testes. Inclui migração e funções reais em PGlite, recusa de perfis não administrativos, escrita direta ainda bloqueada, conteúdo/gabarito divergente, posições duplicadas, histórico após comparação, token antigo, falha tardia com rollback, proteção de vínculo, repetição sem duplicação, preservação de UUIDs/revisões/publicação/XP e revisão no navegador em desktop e celular sem overflow horizontal. Não substitui homologação do transporte hospedado.

## Implantação proposta — exige autorização separada

1. Revisar esta migration e o diff do frontend; não incluir mudanças locais de outros trabalhos.
2. Reconsultar inventário/histórico da Aula 02 e conferir a definição atual do guard. A migration aborta se não encontrar exatamente uma ocorrência da condição de imutabilidade esperada. Confirmar a proteção/recuperação disponível e os riscos da alteração antes da execução.
3. Aplicar somente esta migration e publicar somente o frontend revisado. Não usar db push ou migration up geral, nem alterar Edge Functions. A migration depende das estruturas de aprendizagem v2, flashcards e gerenciador de apresentações já instaladas; não instala nem reimporta conteúdo.
4. Homologar permissões e comparação sem salvar. A execução real da reconciliação exige revisão do JSON efetivamente selecionado e aprovação do antes/depois pelo administrador.
5. Após salvar, conferir os seis UUIDs/revisões originais, oito posições distintas, dois novos rascunhos, gabaritos e vínculos preservados, status da aula e ausência de alteração de progresso/XP.
6. Revisar materiais na prévia. Publicar as duas atividades novas, publicar a apresentação web e vinculá-la são decisões separadas; não fazê-las automaticamente.

A migration foi registrada em produção como 20261112035823_reconcile_a02_learning_content, com o mesmo SQL auditado (SHA-256 1e33e990f6e8151cbb2b427a542626e793abfbf92bf07847dfc0ebcac1b39641). A execução real da reconciliação e a publicação das novas atividades não fazem parte da homologação deste release. Em caso de problema futuro, interromper escritas e analisar a auditoria; não apagar registros nem prometer restauração automática de produção.
