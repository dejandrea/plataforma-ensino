# Conquistas e XP

Em **Gestão → Conquistas, XP e ranking**, a tabela **Pontuação das conquistas** fica disponível apenas para administradores. O aluno acompanha seu saldo e os últimos 20 registros em **Minhas conquistas**, na jornada e em Minhas aulas.

| Evento | XP inicial |
| --- | ---: |
| Boas-vindas, uma vez por aluno | 50 |
| Aula do curso concluída | 10 |
| Aula com a professora concluída | 10 |
| Módulo concluído | 10 |
| Curso concluído | 10 |
| Avaliação recebida | 20 |
| Cada estrela nas oito áreas | 2 |

Uma avaliação completa rende `20 + 2 × soma das estrelas`: de 36 a 100 XP. O extrato do aluno soma o bônus e as estrelas em um único registro de **Avaliação recebida**. Os valores continuam separados no banco para manter a configuração e o controle dos créditos. Aulas do curso, módulos e cursos são cumulativos: concluir a última aula pode gerar os três créditos.

O histórico existente é incluído na migração. Um saldo anterior é preservado em um lançamento separado. Todo aluno já cadastrado também recebe o crédito único de boas-vindas.

Os lançamentos têm uma chave única por aluno, tipo e origem. Repetições de conclusão e sincronizações do calendário não duplicam XP. Aulas canceladas perdem o crédito; restaurar a conclusão reativa o valor original. Excluir avaliações ou desfazer progresso também retira os respectivos créditos. Módulos e cursos precisam ter aulas e estar inteiramente concluídos; a composição considera o currículo ativo, como na jornada.

Alterar uma regra vale para novas conquistas. Os lançamentos existentes preservam o valor recebido. O campo `profiles.xp_points` é atualizado apenas pelo banco, a partir dos lançamentos ativos de `student_xp_events`. Os alunos podem ler o próprio extrato; apenas administradores ativos podem editar `xp_reward_rules`.

O teste `tests/xp.integration.sql` valida os créditos, duplicidade, cancelamento, preservação de valores e permissões. Deve rodar em transação: o marcador `XP_PREFLIGHT_OK` é uma exceção intencional para reverter todas as alterações de teste.
