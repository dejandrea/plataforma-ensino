# Etapa D — Projetos

Implementação da Etapa D de `docs/prompts/fase1.md`, seções 5.4, 8 e 15. Entrega de 22/10/2026. Após autorização explícita “Autorizo”, as sete migrações listadas abaixo foram aplicadas no projeto Supabase `codePlatform`.

## Fluxo entregue

- Aluno envia link HTTPS, descrição, reflexão e até dois links adicionais com descrição. Uma requisição repetida preserva a mesma entrega.
- Professora responsável ou administrador consulta entregas, critérios e requisitos, abre os links, registra nota/devolutiva, solicita ajustes ou aprova.
- Estados apresentados: Enviado, Em avaliação, Ajustes necessários e Aprovado. Filtros permitem separar pendências, ajustes e aprovações.
- Avaliação disponível na sala de aula e em Meus Alunos → Histórico → Projetos do aluno. A correção pelo histórico independe de encontro agendado.
- Reenvio só é liberado após solicitação de ajustes. Gera nova versão; links, descrições, notas e devolutivas anteriores permanecem consultáveis. Versões anteriores são somente leitura; o servidor recusa avaliá-las depois de um reenvio.
- Aprovar conclui a atividade curricular. O aluno não aprova a própria entrega e não acessa os dados de outros alunos. Professora sem vínculo não lista nem avalia entregas desse aluno.
- Reutilizadas as regras oficiais de XP: envio de miniprojeto 50, projeto 100 e nota de avaliação em crédito separado. Reenvios não repetem XP de envio. Mudança de nota ajusta o crédito existente, mantendo auditoria.

## Auditoria e alterações

Envio, avaliação, reenvio, aprovação e proteção de XP já estavam implementados localmente nas entregas anteriores. Foram reutilizados. As lacunas identificadas e corrigidas nesta etapa foram a ausência de critérios/requisitos na tela da professora, de consulta das versões anteriores e do acesso às entregas sem abrir um agendamento.

Arquivos principais:

- `src/components/learning/ProjectSubmissionForm.tsx`: formulário existente reutilizado.
- `src/components/learning/ProjectReviewPanel.tsx`: critérios, requisitos, histórico de versões, status e filtros; acesso por aluno ou encontro.
- `src/pages/StudentHistory.tsx`: acesso às entregas por aluno.
- `supabase/migrations/20261023012714_project_review_history_and_criteria.sql`: RPC autorizada `teacher_student_projects(uuid)` e atualização da RPC de encontro `teacher_project_inbox(uuid)`, compartilhando consulta e histórico. Não altera nem apaga entregas ou avaliações.
- `tests/project-workflow.test.mjs`: ciclo completo e isolamento de dados.
- `tests/official-xp-browser.test.mjs`: homologação com componentes reais, banco local e RPCs, incluindo critérios, versões anteriores, filtros e correção por aluno sem encontro.
- Fixtures de banco e navegador atualizadas para executar a nova migração e a RPC.

## Validação

- `project-workflow.test.mjs` + `improvements.test.mjs`: 15 testes aprovados.
- `project-workflow.test.mjs` + `official-xp.test.mjs`: 12 testes aprovados, incluindo mini-projeto/projeto, alteração de nota e auditoria.
- `official-xp-browser.test.mjs`: aprovado; aluno envia → professora pede ajustes → aluno reenvia → professora consulta a versão anterior e aprova → altera a nota sem acumular XP indevido. Sem erros JavaScript; viewport mobile sem transbordamento horizontal.
- Compilação TypeScript/Vite e ESLint dos componentes de projetos aprovados.
- Evidências locais: `test-results/official-xp-review-desktop.png` e `test-results/official-xp-review-mobile.png`.

Os testes acima são locais. A ativação e as verificações remotas posteriores estão registradas ao final deste documento.

## Dependências de ativação

O projeto remoto consultado anteriormente não possui as estruturas de aprendizagem. Portanto, não basta publicar o frontend ou aplicar apenas a nova RPC da Etapa D. A sequência necessária para o fluxo atual é:

1. `20261021034654_learning_environment_foundation.sql`
2. `20261021041807_student_learning_experience.sql`
3. `20261021180915_interactive_learning_and_rewards.sql`
4. `20261022034112_teacher_learning_workspace.sql`
5. `20261022042042_official_xp_rules_v1.sql`
6. `20261022171228_improvements_content_catalogs.sql` — inclui os campos de descrição/links e a assinatura compatível do envio de projetos.
7. `20261023012714_project_review_history_and_criteria.sql`

## Ativação remota concluída

As dependências e o estado do esquema foram conferidos antes da aplicação. Com autorização específica para o ambiente de aprendizagem, as sete migrações foram aplicadas em sequência no projeto `codePlatform` (`gnyiyhnbpjhdgrhsevbh`). Não foram instaladas por essa autorização as outras mudanças pendentes de agendamento, descontos avulsos ou conquistas recorrentes.

Verificações no servidor, sob a identidade de perfis existentes e com todas as alterações de teste revertidas:

- Importação e publicação das seis atividades do JSON da Aula 1 — Máquinas que Mudaram o Mundo — aprovadas pela RPC real, usando administrador autenticado.
- Importação por aluno recusada; consulta aos gabaritos retorna zero registros para aluno. RLS ativo nas tabelas de aprendizagem/projetos; importação não executável por anônimo.
- Importação de projeto de verificação, envio pelo aluno, recusa de autoaprovação, solicitação de ajustes pela gestão, segunda versão, consulta da versão anterior e aprovação: aprovados.
- Atividade concluída após aprovação e exatamente 130 XP para miniprojeto enviado e avaliado com nota 80 (50 + 80).
- Confirmada a reversão dos registros de teste; nenhuma atividade ficou importada/publicada por essas verificações. O conteúdo definitivo deve ser importado pela interface.

Isso valida funções e políticas do banco remoto. A pessoa usuária deve atualizar a tela e repetir a importação autenticada para concluir seu fluxo na interface. Os avisos de segurança do projeto foram consultados antes e depois da ativação; as tabelas protegidas continuam sujeitas às políticas RLS verificadas.
