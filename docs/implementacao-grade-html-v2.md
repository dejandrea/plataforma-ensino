# Grade HTML Básico v2 — implementação

Estado em 26/10/2026: **migrations aplicadas em produção**, no projeto `gnyiyhnbpjhdgrhsevbh`, após autorização explícita do usuário. Nenhuma atividade nova ou recurso foi publicado. Os ajustes de interface ainda estão locais, sem commit/push nesta etapa.

## Aplicação em produção — evidências

- Aplicação direcionada via `supabase db query --linked --file`, primeiro infraestrutura `20261026052759`, depois grade `20261026052822`. Ambas registradas como aplicadas no histórico; nenhuma versão alheia foi reparada.
- Backup de dados de 24 tabelas e definições/ACLs de 138 funções salvo em `tmp/backups/curriculum-before-v2-20261026.json`, ignorado pelo Git. Contém dados privados e não deve ser compartilhado nem commitado. É um backup lógico dos objetos consultados, não um dump integral do banco ou do Auth.
- Grade confirmada: cinco submódulos ativos, 15 aulas numeradas de 0 a 14, sendo duas publicadas e 13 planejadas; oito atividades existentes preservadas; versão atual 2 e um aluno fixado na versão anterior.
- Hashes de 18 tabelas de históricos, atividades, regras, recibos, saldos e vínculos consultados permaneceram iguais antes/depois. A aplicação não executou sincronização de XP.
- RPC oficial e jornada pedagógica testadas com papel authenticated e contexto de administrador, em transação revertida: aluno legado permanece com 2/2 aulas concluídas e módulo concluído, com duas aulas na jornada.
- Advisor posterior apontou somente quatro informações novas de RLS sem políticas nas tabelas privadas desta implementação. São deliberadas: não há grants aos clientes e o acesso é restrito às funções internas. Não criar políticas de leitura pública para suprimir esses informes. [Referência do advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- A consulta inicial da lista de migrations pela conexão Postgres falhou em autenticação; as aplicações via Management API e o registro posterior das duas versões terminaram com sucesso. O histórico foi confirmado também por consulta SQL.
- O usuário autorizou produção após ser informado de que a repetição dos testes de navegador estava pendente. Essa repetição não foi executada nesta etapa e continua pendente; não equivale a publicação dos materiais.

Referências: [auditoria e plano aprovado](auditoria-e-plano-migracao-curricular-html-v2.md), [documento mestre](documento-mestre-curricular.md), [manifesto com os IDs](manifests/html-basic-v2.json).

## Resultado

A estrutura preparada possui cinco submódulos, 14 aulas curriculares e a introdução Aula 00. Os três UUIDs de submódulos existentes são reutilizados e seus nomes passam a seguir o documento mestre. S04/S05 e A02–A14 têm novos UUIDs fixos no manifesto.

Aula 00 e Aula 01 preservam UUID, título, ordem local, recursos, oito atividades publicadas, revisões, gabaritos, progresso e recibos. A introdução continua no S01, identificada como “Introdução”, sem ocupar a numeração das 14 aulas. A ordem do vídeo antes dos slides é preservada.

As 13 aulas novas contêm título, objetivo, duração e número curricular, mas ficam **Em preparação**. Não há URLs fictícias nem atividades de preenchimento. Produzir conteúdos, mini-projetos e planos docentes é outra etapa: o manifesto reserva pedagogicamente dois mini-projetos, um projeto final e quatro encontros, sem criar entregas, agendamentos, calendário ou cobranças.

## Versões e histórico

A infraestrutura acrescenta a lessons os campos curriculum_version, curriculum_number e publication_status (planned/published). A versão existente é 1; a estrutura nova usa a versão 2.

Tabelas privadas com RLS e sem grants aos clientes:

- curriculum_releases: versão vigente por módulo.
- student_curriculum_cohorts: aluno/módulo fixado na versão anterior quando já há evidência de início.
- curriculum_function_backups: definição original das funções adaptadas.
- curriculum_migration_snapshots: estado original de aulas/submódulos e fingerprints das atividades.

A coorte anterior inclui evidência em progresso de aula/atividade, quiz, sessão interativa, projeto, sessão docente, avaliação do módulo ou recibo relacionado. Inclui alunos inativos que já tinham iniciado; eventual reativação não troca a grade silenciosamente. Não se baseia no cadastro histórico student_courses.

O aluno legado continua vendo a versão 1 do módulo. Novos alunos seguem a versão vigente, 2. Não existe promoção automática de alunos legados nem gravação de conclusões sintéticas. Uma futura transferência para v2 exige desenho e ação administrativa específicos.

As aulas planejadas da v2 fazem parte do denominador dos novos alunos, impedindo uma conclusão artificial de módulo enquanto faltam materiais. Aparecem como roteiro, com botão desabilitado. Isso é deliberado: planejada não equivale a concluída nem a conteúdo liberado.

O predicado de versão é usado na consulta oficial de currículo, na política RLS de lessons, na exigência de acesso às atividades e aula, na gravação direta de student_progress, no cálculo de XP de módulo/curso, na central pedagógica e na seleção/vinculação/confirmação de encontros docentes. Assim, o percentual e o desbloqueio da versão anterior não são calculados sobre as aulas novas. Recompensas, valores e regras de primeira tentativa continuam os mesmos.

Nenhum sincronizador de XP é executado pela migration. O teste chama o sincronizador oficial posteriormente no banco isolado e confirma igualdade do ledger, saldo, masterias e conquistas do aluno legado.

Novas aulas adicionadas manualmente a um módulo versionado herdam sua versão atual e entram em preparação. Não podem surgir como aulas vazias publicadas na versão antiga por omissão de campos no formulário administrativo.

## Liberação editorial

Em Gestão → Conteúdo Curricular, selecionar o submódulo e a aula planejada:

1. Produzir e importar o JSON vigente com o título real da aula e o novo nome do submódulo.
2. Validar as atividades, gabaritos privados, critérios e recursos reais. Ordering/matching continuam subtipos de interactive.
3. Conferir a prévia administrativa e publicar as atividades aprovadas pelo fluxo existente.
4. Acionar **Liberar aula para alunos**, com confirmação explícita.

Importar ou publicar atividades não libera a aula automaticamente. A nova RPC publish_curriculum_lesson exige administrador ativo; a liberação é idempotente. O trigger também impede publicar uma aula planejada sem atividades ativas/publicadas, inclusive em atualização direta de tabela. A validação técnica não substitui a revisão pedagógica.

Não é permitido trocar a versão/submódulo de uma aula com atividades ou progresso, nem retirar uma aula publicada com esse histórico para o estado planejado. A Aula 00/01 não é reimportada para atualizar nomes de contexto; os arquivos antigos continuam documentos históricos.

A grade completa fica visível na gestão. O aluno legado e sua jornada pedagógica individual mantêm apenas o currículo a que pertencem. Não interpretar a ausência de A02–A14 para esse aluno como falha de cadastro.

## Migrations e aplicação

Ordem obrigatória:

1. supabase/migrations/20261026052759_curriculum_versions.sql — infraestrutura e funções.
2. supabase/migrations/20261026052822_html_basic_curriculum_v2.sql — grade e captura da coorte anterior.

A primeira preserva ACLs com CREATE OR REPLACE e guarda as definições anteriores. Cada adaptação textual exige uma ocorrência exata e aborta diante de drift. As 12 âncoras foram conferidas em produção somente por leitura e todas encontraram uma correspondência. Nenhuma função foi alterada remotamente.

A segunda bloqueia escritas nas tabelas envolvidas durante a transação, tem timeout de lock de cinco segundos e execução de 30 segundos, confere os IDs/nomes/ordens auditados e o hash completo das oito atividades. IDs reservados em uso ou divergências abortam antes da mudança. Reexecução da grade já aplicada valida o manifesto e não duplica registros. As atividades antigas são comparadas novamente ao final.

Checklist usado para aplicação (manter para futuras reaplicações/ambientes):

- Concluir a repetição dos testes de navegador pendente abaixo.
- Recoletar o SQL de auditoria e conferir que os dados ainda correspondem ao manifesto. Não substituir fingerprints divergentes sem nova revisão.
- Fazer backup externo restrito/restaurável do banco e registrar contagens/hashes completos dos históricos e saldos. As tabelas de snapshots locais à migration não substituem backup.
- Revisar o histórico remoto: existem versões remotas diferentes de versões do checkout. Não usar push geral nem reparar versões alheias como parte deste trabalho.
- Aplicar somente as duas migrations na ordem e registrar somente suas versões. Se a segunda falhar, a infraestrutura da primeira é compatível com a grade antiga: sem releases cadastrados, todas as aulas continuam na versão 1.
- Conferir 5 submódulos, 15 aulas, 8 atividades originais, coortes e igualdade dos históricos/XP. Testar URL direta, aluno novo, legado e professora vinculada; depois disponibilizar a interface.
- Não liberar os materiais planejados como efeito da aplicação estrutural.

## Contenção e reversão

supabase/rollbacks/html_basic_curriculum_v2.sql contém a reversão operacional **antes de uso**:

- Mantém todas as linhas novas e os históricos.
- Restaura nomes/descrições/ordens/estado dos submódulos originais e a numeração anterior das duas aulas.
- Reduz a versão vigente para 1 e inativa os dois submódulos novos.
- Mantém a infraestrutura de versões instalada, pois removê-la exporia as aulas planejadas às regras antigas.

A reversão recusa execução se já houver atividade nova ou uso de um aluno da nova coorte, inclusive nas aulas compartilhadas A00/A01. Depois disso, preservar registros e fazer correção progressiva; não executar exclusões nem apagar tentativas/recibos. Reaplicar a migration estrutural após contenção é recusado por divergência de estado e exige plano de reativação revisado.

## Validação e limites

- 68 testes de banco aprovados: nova grade, escopo/versionamento, bloqueio de aulas vazias, preservação de dados, sincronização posterior de XP, reexecução, drift, contenção, seleção docente e regressões de aprendizado/projetos/central.
- Build de produção aprovado; ESLint aprovado nos componentes novos e componentes tipados alterados que foram verificados. Os avisos já existentes de Browserslist e bundles grandes permanecem.
- Primeira execução de navegador percorreu renderização desktop/celular, roteiro planejado, confirmação administrativa, rejeição de publicação vazia, publicação com conteúdo e conclusão real com 60 XP (10 de estudo e 50 de aula), sem erros JavaScript. A execução terminou com dois asserts incorretos: contagem incluía elementos de details fechados e o teste tentou concluir manualmente uma aula já concluída pelo fluxo automático. Os asserts foram corrigidos.
- **A repetição dos dois testes de navegador ainda está pendente:** a execução solicitada foi rejeitada na autorização da ferramenta. Não reportar a suíte de navegador como aprovada. A fixture de cartões também foi alinhada à ordem curricular após inspeção da captura; as capturas iniciais não são evidência final da sequência no Dashboard.
- Os testes usam somente banco PGlite e dados sintéticos. A fixture troca os fingerprints do manifesto pelos hashes dos seus próprios recursos/timestamps, sem relaxar o SQL de produção. Nenhuma conta real de aluno ou token de produção foi usada no navegador.

Comandos:

~~~powershell
node --test --experimental-test-isolation=none tests/curriculum-v2.test.mjs tests/learning-progress.test.mjs tests/student-learning.test.mjs tests/official-xp.test.mjs tests/project-workflow.test.mjs tests/teacher-learning.test.mjs tests/pedagogy.test.mjs
node --test --test-concurrency=1 tests/curriculum-v2-browser.test.mjs
npm.cmd run build
~~~

O atalho npm.cmd run test:curriculum reúne os testes da grade e de navegador. Não foram criados commits nem efetuado push nesta etapa.
