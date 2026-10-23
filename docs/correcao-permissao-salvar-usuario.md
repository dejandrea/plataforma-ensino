# Erro ao salvar usuário: learning_role

## Causa

O cadastro chama a Edge Function `update-platform-user`, que verifica a conta administrativa e grava perfis pelo cliente de serviço. A função de trigger `private.learning_guard_profile_access()` é `SECURITY INVOKER`. Sua condição anterior combinava a verificação do papel SQL com uma chamada a `private.learning_role()` em uma única expressão booleana.

O PostgreSQL não garante avaliação booleana da esquerda para a direita. No fluxo do servidor, a verificação de execução da função auxiliar ocorria apesar da condição de papel. O papel `service_role` não tem EXECUTE nessa função, causando `permission denied for function learning_role`.

## Correção

A migration `20261023145403_fix_learning_profile_service_permissions.sql` separa as condições em comandos PL/pgSQL. Contextos de servidor já autorizados pela regra anterior retornam antes da consulta ao papel do usuário. Para clientes, a mudança de papel, ativação ou escopo continua exigindo administrador ativo.

Não concede EXECUTE adicional, não transforma o trigger em SECURITY DEFINER, não modifica políticas RLS nem altera registros existentes.

## Verificação

`node --test --experimental-test-isolation=none tests/profile-service-permissions.test.mjs tests/learning-foundation.test.mjs`

Dez verificações passaram. O teste reproduz primeiro o erro original e depois confirma atualização pelo serviço, bloqueio de autopromoção de aluno/professor, bloqueio de reativação própria, manutenção da edição de dados comuns e preservação das ACLs. A migration também foi aplicada duas vezes no banco isolado para verificar repetibilidade.

## Aplicação

Aplicada em 23/10/2026 no projeto conectado, após autorização explícita do usuário. Uma atualização pelo papel `service_role` foi executada em transação e revertida para validar o fluxo sem persistir alterações em dados reais. Confirmados o retorno antecipado do contexto de servidor, a manutenção de SECURITY INVOKER e a ausência de novas permissões para serviço ou acesso anônimo.
