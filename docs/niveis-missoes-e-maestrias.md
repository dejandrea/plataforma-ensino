# Níveis, missões e maestrias

## Administração

Em **Gestão → Conquistas, XP e ranking**, **Cadastro de missões** permite criar e editar título, instruções, XP, categoria (prática, depuração, lógica ou projeto), tecnologias, disponibilidade, indicação de projeto final e conquistas personalizadas. Cada missão começa com 10 XP. O administrador pode criar medalhas próprias e vinculá-las a uma ou mais missões.

As regras de maestria são configuráveis na mesma tela. Os requisitos iniciais são:

| Medalha | XP na tecnologia | Missões | Projeto final |
| --- | ---: | ---: | --- |
| Bronze | 50 | 3 | Não |
| Prata | 200 | 8 | Não |
| Ouro | 500 | 15 | Sim |

Os requisitos são cumulativos: todos devem ser cumpridos. Mudar uma regra recalcula as medalhas dos alunos.

## Aluno e conclusão automática

O aluno encontra **Minhas missões**, **Minhas Maestrias**, a vitrine de conquistas e a classificação individual em **Meu perfil**. A jornada e Minhas aulas mostram o nível, a próxima meta e um link para o perfil.

Ao registrar um link HTTP/HTTPS da entrega, a missão é concluída automaticamente no backend, sem aprovação da professora. Isso registra a conclusão declarada pelo aluno; não verifica o conteúdo de um repositório ou executa testes no projeto enviado. O aluno não escolhe XP, tecnologias, data ou medalhas na requisição.

Cada aluno recebe XP uma única vez por missão. Reenviar a mesma conclusão retorna o registro existente. O backend preserva o XP, a categoria, as tecnologias, as conquistas e a indicação de projeto final da primeira conclusão, mesmo se o cadastro for editado depois.

O XP geral recebe o valor integral da missão uma vez. Para a maestria, esse valor é dividido igualmente entre as tecnologias, sem arredondamento que crie ou perca pontos. Uma missão de 101 XP em HTML e CSS rende 101 XP gerais, 50,5 em HTML e 50,5 em CSS. Cada tecnologia recebe uma missão concluída.

## Níveis e conquistas

Os dez níveis seguem as faixas aprovadas: 0, 100, 250, 450, 700, 1.000, 1.400, 1.900, 2.500 e 3.200 XP. Com 50 XP de boas-vindas o aluno está no nível 1. `profiles.level` é derivado do XP pelo banco e não pode ser escolhido pelo aluno.

As conquistas de comportamento não geram XP extra: Primeiro Código (primeira missão), Caça-Bugs (5 de depuração), Em Chamas (3 dias consecutivos), Mente Lógica (10 de lógica), Criador (primeiro projeto) e Lenda Bitaria (nível 10). Os dias de prática usam o fuso America/Bahia e a data real da conclusão, definida no servidor.

O catálogo inclui HTML, CSS, JavaScript, React, Python, SQL, Git, IA, Scratch e Node.js, com os nomes de Bronze/Prata/Ouro dos prints. Não se convertem automaticamente aulas antigas em missões sem mapeamento de tecnologia; o XP das aulas e avaliações existentes continua contando para o nível geral.

O ranking é geral e individual, com empate por XP, apenas alunos ativos, sem e-mails ou dados de contato. Não há ranking por turma. A listagem mostra até 100 alunos.

## Banco e testes

`technologies`, `student_technology_progress` e `student_achievements` armazenam catálogo, progresso e medalhas com data de desbloqueio. `missions`, `mission_submissions`, `mastery_rules`, `achievement_definitions` e `player_levels` complementam a configuração. Tabelas de progresso e medalhas não aceitam escrita do cliente. A RPC `complete_mission` usa o aluno autenticado e processa a conclusão em uma transação.

Os testes de integração validam conclusão automática, repetição, snapshots, divisão de XP, limites de medalhas, sequência de prática, conquistas, nível máximo, ranking e permissões. O teste deve ser executado em transação e terminar com o marcador `XP_PREFLIGHT_OK` dos testes de XP, que reverte todas as fixtures.
