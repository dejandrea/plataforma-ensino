# Correção da persistência do título/assunto das aulas

Verificação concluída em 29/10/2026. Correção aplicada em produção no projeto gnyiyhnbpjhdgrhsevbh; migration 20261028220751 registrada como aplicada.

## Problema reproduzido

O editor de Relatórios → aulas concluídas grava title em scheduled_lessons com UPDATE condicionado a status=completed e confirma a linha retornada. A gravação estava correta. Na sincronização seguinte, a RPC de importação do Google executava title=excluded.title e substituía o assunto salvo pelo nome do evento.

O teste isolado reproduz primeiro a perda do título na função anterior e depois aplica a correção e repete a mesma sequência. Não houve alteração no formulário ou necessidade de deploy de frontend para esta correção.

## Alteração

- Coluna scheduled_lessons.title_customized, booleana, padrão false.
- Trigger privado marca true quando um usuário authenticated altera o título de uma aula já concluída. As políticas existentes continuam limitando a edição a administradores e à professora responsável.
- A importação preserva o título se a aula já estiver concluída ou tiver a marca de personalização. A marca continua válida se o evento mudar de status ou for reagendado posteriormente.
- Eventos futuros sem personalização continuam recebendo o título do Google.
- A importação continua restrita a service_role, sem novos grants. Validações de escopo, contexto de faturamento e demais campos de sincronização foram preservados.
- Nenhum título antigo foi reescrito pela migration. Títulos sobrescritos antes da correção não podem ser reconstruídos por esta alteração e precisam ser editados novamente.

## Arquivos

- supabase/migrations/20261028220751_preserve_completed_lesson_titles.sql
- supabase/rollbacks/preserve_completed_lesson_titles.sql
- tests/completed-lesson-title-persistence.test.mjs

O rollback anterior a uso restaura a expressão original e remove a infraestrutura nova; se já houver assuntos personalizados protegidos, recusa a remoção para não perder essa proteção. Após uso, realizar correção progressiva.

## Verificação

Dez testes aprovados, cobrindo reprodução da falha, edição autenticada, duas sincronizações, reagendamento, assunto histórico anterior à marca, atualização de evento futuro, permissões de outros usuários, ACL da RPC, rollback antes/depois de uso, faturamento e correções de status.

Comando:

~~~powershell
node --test --experimental-test-isolation=none tests/completed-lesson-title-persistence.test.mjs tests/calendar-import-billing.test.mjs tests/google-calendar-sync.test.mjs tests/lesson-history-status.test.mjs
~~~

Após aplicação em produção, conferidos coluna, trigger ativo, proteção na RPC, bloqueio de chamada por authenticated e permissão de service_role. Hashes de scheduled_lessons (excluindo somente a coluna adicionada), student_xp_events e profiles permaneceram idênticos ao estado anterior. O advisor não apontou o trigger ou a função alterada.

Backup técnico da definição/ACL anterior e hashes em tmp/backups/completed-title-before-20261028.json, ignorado pelo Git. Não contém uma cópia integral do banco.
