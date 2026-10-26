# Auditoria e plano de migração curricular — HTML Básico v2.0

Data: 26/10/2026 · America/Bahia. Estado: auditoria concluída; plano aprovado e migrations estruturais aplicadas em produção após autorização específica. Materiais novos permanecem em preparação. Ver evidências em [implementação](implementacao-grade-html-v2.md).
Referências: [solicitação](prompts/auditoria-e-plano-de-migracao-curricular.md), [documento mestre v2.0](documento-mestre-curricular.md).
Evidência: [snapshot sem dados pessoais nem gabaritos](auditoria-curricular-html-v2.snapshot.json).
Coleta reproduzível: [SQL de auditoria](queries/auditoria-curricular-html-v2.sql), protegido por transação READ ONLY/REPEATABLE READ e encerrado com ROLLBACK. Não é uma migration.

## Escopo e método

Inspeção somente de leitura do projeto Supabase `gnyiyhnbpjhdgrhsevbh`: estrutura, chaves estrangeiras, funções e triggers atuais, atividades e contagens agregadas de dependências. Nenhuma RPC de conclusão, avaliação ou sincronização foi executada. Nenhuma migration, importação, publicação, alteração de XP ou dado de aluno foi realizada. Foram criados apenas documentos locais.

O snapshot representa as consultas desta auditoria, feitas em momentos próximos, não um backup transacional. Repetir a coleta antes de qualquer intervenção. UUIDs abaixo são identificadores reais de conteúdo; não foram inferidos de títulos. Recursos legados foram verificados pela presença dos campos, sem testar permissões externas dos arquivos do Drive.

## 1. Inventário real

Curso HTML: `6fada12b-4073-40ce-9bfb-e5ecfc2c453d`, ativo.

| Módulo | ID | Ordem | Estado |
| --- | --- | ---: | --- |
| HTML Básico | 253477d3-e90d-42b8-88d8-a4a512418cf5 | 1 | Ativo; alvo |
| HTML I | 76c52064-81dc-48e9-9c79-7dedae6477cd | 2 | Ativo, sem submódulos |
| HTML II | 97322dd7-fbf8-419c-a84b-88d4515e0a95 | 3 | Ativo, sem submódulos |
| Excluído | 23e40d35-dba1-4903-88ba-4867c9995efe | 3 | Inativo; preservar fora do alvo |

HTML Básico possui **três submódulos, duas aulas e oito atividades**. Não foram encontradas outras aulas HTML sem submódulo ou com módulo direto divergente do módulo do submódulo.

| Submódulo atual | ID | Ordem | Aulas |
| --- | --- | ---: | --- |
| História dos computadores | 7ba3b0f4-7078-47df-aaa4-a7ee460b3f3e | 1 | Aula 00 e Máquinas que Mudaram o Mundo |
| Clients e Servers | 627f2b9e-dd2d-4b9d-8897-1ebb7079ed1f | 2 | Nenhuma |
| Linguagens | 046e5535-6fe8-4507-9e86-557feeb92c8b | 3 | Nenhuma |

Todos os três estão ativos.

| Aula atual | ID | Ordem atual no submódulo | Duração |
| --- | --- | ---: | ---: |
| Aula 00 — Bem-vindo ao HTML | 4d16131a-e2a7-40d2-9228-ee014bff701e | 1 | 5 min |
| Máquinas que Mudaram o Mundo | 10972956-955b-4199-a062-4317ee2ee70c | 2 | 24 min |

Ambas têm `module_id` consistente e campos legados de slides/vídeo preenchidos. Isso não significa atividades duplicadas: o renderizador usa o fluxo de atividades e tem fallback legado. Não apagar esses campos nesta migração.

### Conteúdo já importado: preservar integralmente

Todas as oito atividades estão ativas, publicadas, na revisão 1. Há metadados de objetivos para ambas as aulas; `lesson_learning_metadata.schema_version=1` nas duas. Esse valor não prova a versão do arquivo importado: a Aula 01 contém interações nativas do contrato v2.

| Aula | Ordem | Tipo | Key | UUID |
| --- | ---: | --- | --- | --- |
| 00 | 0 | video | a00-v2-video-boas-vindas | edf52b7d-3b97-4aa6-a220-30c1002ab123 |
| 00 | 1 | slides | a00-v2-boas-vindas | 53c5fdec-da42-4843-b8b7-f0856dad9f1e |
| 01 | 0 | slides | a01-v2-estudo-origens | 111d3ae2-0ec0-4b58-9e4e-1b47d0798528 |
| 01 | 1 | interactive / ordering | a01-v2-linha-do-tempo | 2b0e7617-4fa8-4df7-ba77-0a7740761ed2 |
| 01 | 2 | slides | a01-v2-estudo-evolucao | b47f62f4-fbf8-48be-aad8-8e7cf4093080 |
| 01 | 3 | interactive / matching | a01-v2-maquinas-e-pistas | 0e266fd8-94f7-407a-8a37-6277b7eb6e56 |
| 01 | 4 | mindmap | a01-v2-mapa-sintese | a3c98437-d1d6-4f6e-abaa-d10c7399e1c0 |
| 01 | 5 | quiz | a01-v2-desafio-final | c4d1676c-4396-4cf5-a1fd-b678f19dd56c |

Somente a associação extra da Aula 01 é opcional; as demais atividades são obrigatórias. O quiz tem cinco perguntas, atendendo ao mínimo de quatro. A Aula 00 não tem quiz nem projeto e mantém o vídeo antes dos slides. Nenhuma dependência explícita em `activity_prerequisites` envolve essas atividades.

## 2. Grade antiga → nova

**Não é possível certificar uma equivalência de dez aulas antigas:** o banco contém somente uma aula curricular além da introdução; os arquivos consultados não apresentam uma lista completa e identificada das dez aulas antigas. Os exemplos `docs/examples/html-primeira-pagina.v1.json` e `html-conhecendo.v1.json` são exemplos de autoria, não comprovantes de registros reais nem de equivalência.

Não criar dez registros “antigos” para preencher essa lacuna. Não inventar IDs ou transformar semelhança de título em equivalência. Solicitar a grade anterior completa, com conteúdos/objetivos, se for necessário certificar o mapeamento editorial das dez aulas; isso não impede apresentar a diferença entre a produção real e o alvo.

| Alvo v2 | Origem verificada | Ação proposta |
| --- | --- | --- |
| Aula 00 — Bem-vindo ao HTML | ID existente acima | Preservar; introdução sem renumerar as curriculares |
| S01 A01 — Máquinas que Mudaram o Mundo | ID existente acima; atividades compatíveis | Preservar IDs, atividades e histórico |
| S01 A02 — Grandes Nomes da Tecnologia | Não cadastrada | Criar depois de aprovação e produção |
| S02 A03 — Como Surgiram a Internet e a Web | Não cadastrada | Criar |
| S02 A04 — Clientes e Servidores: Quem Conversa com Quem? | Apenas submódulo vazio relacionado ao tema | Criar aula; não tratar submódulo como aula antiga |
| S02 A05 — A Viagem de um Site | Não cadastrada | Criar |
| S03 A06 — Como Conversamos com os Computadores? | Apenas submódulo Linguagens vazio | Criar aula |
| S03 A07 — HTML: O Esqueleto de uma Página | Não cadastrada | Criar |
| S03 A08 — Preparando Nossa Oficina | Não cadastrada | Criar |
| S04 A09 — A Anatomia de uma Página | Não cadastrada | Criar |
| S04 A10 — Textos que Contam Histórias | Não cadastrada | Criar; mini-projeto 01/encontro 01 após esta aula |
| S04 A11 — Organizando Informações | Não cadastrada | Criar |
| S04 A12 — Imagens e Caminhos pela Web | Não cadastrada | Criar; mini-projeto 02/encontro 02 |
| S05 A13 — Planejando Meu Primeiro Site | Não cadastrada | Criar; encontro 03 |
| S05 A14 — Meu Site Está Pronto para o Mundo | Não cadastrada | Criar; entrega final/encontro 04 |

Diferença concreta: **13 aulas curriculares novas**, além da Aula 01 preservada e da Aula 00 independente na numeração. Não são apenas quatro aulas adicionais, porque as dez da grade anterior não estão materializadas na produção auditada.

## 3. Dependências e impactos

Contagens do HTML Básico no instante da auditoria:

| Dependência | Quantidade |
| --- | ---: |
| Matrículas históricas em student_courses para HTML | 0 |
| Alunos ativos com escopo course/both (elegíveis à grade ativa) | 1 |
| Registros student_progress / concluídos | 2 / 2 |
| student_activity_progress | 8 |
| Tentativas de quiz | 4 |
| Sessões de tentativa interativa | 4 |
| Envios / avaliações de projeto | 0 / 0 |
| Planos docentes / sessões vinculadas às atividades | 0 / 0 |
| Avaliações em module_evaluations deste módulo | 1 |

`student_achievements` tem zero registros no banco inteiro; não é uma contagem exclusiva de HTML. O plano ainda deve preservar conquistas concedidas entre esta coleta e a execução.

### Acesso e progresso

A definição atual de `private.student_curriculum_status` foi lida diretamente do banco: acesso depende de perfil ativo `course/both` e currículo ativo, **não de student_courses**. Zero matrículas históricas não significa ausência de alunos impactados.

A conclusão considera todas as aulas sob submódulos ativos, usando `student_progress.completed_at`. A Aula 00 atualmente entra no denominador: a produção tem duas aulas concluídas de duas. “Independente da numeração” não significa automaticamente excluída da conclusão. Recomenda-se mantê-la contabilizada inicialmente, com rótulo introdutório; excluí-la exigiria outra decisão e revisão de todas as consultas de progresso.

Ao ativar as 13 aulas novas, a mesma conclusão poderia passar de **2/2 para 2/15 (13,33%)**. A aula histórica continua concluída, mas o módulo deixa de estar completo. Módulos posteriores podem voltar a ficar bloqueados, pois o desbloqueio é por conclusão dos módulos anteriores. HTML I/II estão ativos e vazios: módulo vazio não é concluído pela função oficial e pode bloquear o seguinte. Não corrigir esses módulos incidentalmente nesta migração.

A avaliação de módulo existente deve permanecer intacta. A regra atual de gravação de avaliações curriculares exige curso concluído, não apenas módulo; a expansão pode impedir futuras edições/novas avaliações pelo fluxo comum. Avaliações mensais de mentoria têm caminho separado e não devem ser alteradas.

### XP e conquistas

Recibos vinculados ao alvo somam **320 XP em dez eventos**, conforme snapshot: sete eventos de atividades (170 XP), dois de aulas (100 XP) e um de módulo (50 XP). Esses números somam os recibos consultados, não o saldo total do perfil. O vídeo da Aula 00 ainda não tem recibo no conjunto coletado; não conceder retroativamente nem inferir inconsistência por existir conclusão histórica de aula.

Regras atuais conferidas: estudo 10, interativo 15, quiz percentual até 100, envio mini-projeto 50, envio final 100, avaliação de projeto até 100, aula 50, módulo 50; conclusão de submódulo está em **0**. Não modificar essas regras. A Aula 00 permite 70 XP pelos seus eventos, sem conceder automaticamente o crédito ausente.

A cadeia atual `sync_student_xp → sync_student_before_official_xp → ... → sync_student_base_xp` reavalia recibos de módulo/curso. A função base desativa eventos e reativa os que ainda satisfazem a estrutura atual. Portanto, preservar linhas e IDs **não basta** para preservar o saldo: uma sincronização posterior à expansão pode desativar o recibo existente de módulo de 50 XP. Masterias/conquistas também são sincronizadas nessa cadeia. Não chamar essas funções durante a auditoria ou usar recálculo como “correção”.

### Atividades, quizzes e projetos

Preservar UUID, key, revisão, conteúdo, status, ordem, obrigatoriedade, gabaritos privados e regras das atividades 00/01. A revisão participa de chaves estrangeiras de progresso, tentativas e envios; não incrementá-la para uma mudança meramente organizacional.

O importador adiciona atividades; não faz atualização geral por key. Colisões de keys/posições são rejeitadas. Valida também os títulos de contexto e da aula: renomear submódulos exige alinhar futuros arquivos de autoria, sem reimportar os oito registros existentes.

`ordering` e `matching` são subtipos de `interactive`, não tipos superiores do JSON. Mini-projeto e projeto final reutilizam `project` e as regras oficiais correspondentes. Quatro encontros devem usar `online_lesson` e planos docentes existentes; agendamentos reais são registros de agenda separados. Não criar sessões de agenda, cobranças ou eventos de calendário como efeito da migração.

Há FKs com DELETE CASCADE em aulas/submódulos/módulos e student_progress; atividades/tentativas/projetos têm RESTRICT. Não excluir nem recriar registros como atalho. O ledger usa source_id e exige auditoria semântica, além das FKs.

## 4. Plano incremental e reversível proposto

### Fase 0 — Decisões e proteção de históricos

Aprovar o mapa real e a abordagem de transição **antes de escrever a migration executável**. Recomendação: manter currículo legado dos alunos já iniciados até existir mecanismo explícito de versão/coorte e conclusão histórica reconhecida. O modelo atual não tem esse mecanismo.

O desenho dessa compatibilidade precisa abranger seleção de currículo, progresso, desbloqueio, avaliação docente e sincronização de XP, mantendo os valores oficiais. Uma simples coluna de versão na interface não resolve as funções atuais. Não atribuir conclusões das aulas novas a alunos antigos nem simular recibos.

Se a decisão for migrar todos os alunos para a grade expandida, aprovar explicitamente o efeito na conclusão e implementar proteção dos recibos históricos antes da ativação. Bloquear a execução até testes demonstrarem que créditos/conquistas existentes não são retirados em sincronizações futuras. Essa proteção não autoriza mudar os valores das recompensas.

Definir também: a introdução permanece no S01 com apresentação visual separada (recomendação inicial, mantém cinco submódulos), ou terá suporte próprio de seção introdutória. Não criar um sexto submódulo silenciosamente nem deixar Aula 00 sem submodule_id, o que a removeria da navegação atual.

### Fase 1 — Preparação sem exposição

1. Recoletar inventário, hashes e contagens; registrar versão/hash de cada função em produção e histórico remoto de migrations.
2. Backup restrito e restaurável dos registros envolvidos, inclusive antes/depois de campos organizacionais, atividades e objetos privados, ledger completo dos alunos afetados, saldo, masterias e conquistas. Snapshot desta auditoria não substitui esse backup.
3. Em banco isolado, manter os três UUIDs de submódulos e propor renomes: História dos computadores → As Origens da Tecnologia; Clients e Servers → Desvendando a Internet e a Web; Linguagens → A Linguagem da Web.
4. Planejar S04 Construindo com HTML e S05 Minha Primeira Criação com IDs novos, previamente registrados em manifesto.
5. Não criar aulas vazias sob submódulos ativos: lessons não tem flag is_active/publication_status; rascunho de atividade não esconde a aula nem impede que ela afete o denominador. Até existir versão/coorte, manter o manifesto fora da grade ativa. Submódulos novos podem ser preparados inativos apenas em etapa autorizada; isso não resolve a publicação parcial de S01–S03, já ativos.

### Fase 2 — Conteúdo em homologação

Produzir A02 e depois A03–A14 na sequência do mestre. Validar contrato vigente, chaves de regras, perguntas mínimas, recursos reais e acessíveis, gabaritos exclusivamente privados e ausência de colisões. Vincular atividades novas somente às aulas novas previstas no manifesto.

Planejar duas entregas de mini-projeto (A10/A12) e uma final (A14, desenvolvimento em A13), evitando dois projetos finais independentes. Quatro atividades online com planos docentes após A10, A12, A13 e A14; critérios e posição exatos dependem de revisão editorial. Não prometer número total de atividades por aula antes da produção.

### Fase 3 — Migração estrutural autorizada

Transação com bloqueios dos registros-alvo e janela sem edição/importação concorrente. Abortar se UUIDs, parent IDs, títulos, revisão, publicação, ordem ou hashes divergirem do manifesto aprovado. Usar IDs exatos, nunca WHERE por título, para atualizar existentes.

Atualizar somente nomes/descrições/ordens aprovados dos três submódulos; criar os dois restantes e 13 aulas conforme estratégia de visibilidade/versionamento aprovada. Manter module_id e submodule_id coerentes em cada aula. Ordem pedagógica proposta no S01: Aula 00, A01, A02; identificação curricular A01…A14 não deve ser confundida com order_index local. Não renumerar as atividades de A00/A01.

Nova execução deve detectar manifesto já aplicado e não criar duplicatas. Validação pós-transação deve comparar hashes de todos os históricos, saldos e recibos. Sem diferenças não autorizadas; não executar sync como parte da migração.

### Fase 4 — Liberação incremental autorizada

Liberar por submódulo somente quando conteúdo e transição histórica estiverem homologados. Publicação exige autorização própria. Conferir aluno novo, aluno já iniciado e aluno com módulo concluído, administrador e professora vinculada/não vinculada. Validar URL direta e cache/refetch, além da navegação.

### Reversão

Antes da liberação, restaurar campos organizacionais pelo manifesto e retirar visibilidade da estrutura nova pelo mecanismo aprovado, sem excluir aulas/atividades. Durante homologação isolada, restaurar o backup integral é possível.

Depois de qualquer uso real, não executar rollback destrutivo nem apagar registros novos: podem existir tentativas, progresso, XP e projetos. Conter novas publicações, restaurar a seleção da versão anterior sem retirar o acesso aos históricos e aplicar correção progressiva auditada. Inativar submódulos por conta própria também altera progresso; deve passar pela mesma estratégia de transição. Reversibilidade de metadados não equivale a desfazer aprendizagens já registradas.

## 5. Manifesto de alterações previstas

| Conjunto | Preservar | Atualizar, se aprovado | Criar, se aprovado |
| --- | --- | --- | --- |
| Curso e módulos | Todos os IDs, estado e históricos; HTML I/II e Excluído fora do alvo | Nada nesta proposta | Nenhum módulo/curso |
| Submódulos existentes | Três UUIDs, módulo e relações | Três nomes/descrições; ordens 1–3 mantidas | S04 e S05 |
| Aulas | A00/A01 e todos os campos de conteúdo/histórico | Somente apresentação introdutória se aprovada; sem renome necessário | A02–A14: 13 registros |
| Atividades | Oito UUIDs/keys/revisões e gabaritos | Nenhuma das oito | Conforme conteúdos aprovados; 2 mini-projetos, 1 final e 4 encontros previstos |
| Objetivos/metadados | Dois registros existentes | Nenhum necessário | Metadados das 13 aulas novas |
| Matrículas/vínculos/perfis | Todos, inclusive escopos e vínculo professora–aluno | Nenhum nesta etapa | Somente eventual mecanismo de versão após desenho aprovado |
| Progresso, tentativas, sessões | Todos os registros históricos e IDs | Nenhum | Somente ações futuras reais dos alunos |
| Projetos e avaliações | Todos, inclusive avaliação de módulo existente | Nenhum | Somente entregas/avaliações futuras pelos fluxos oficiais |
| XP/regras/masterias/conquistas | Todos os recibos, valores e créditos históricos | Proteção de compatibilidade a desenhar, sem mudar recompensas | Nenhum crédito sintético |
| Agenda/calendário/financeiro | Todos | Nenhum | Nenhum agendamento automático |

## 6. Testes para autorização de execução

Estes testes são o plano de validação da mudança futura; **não foram apresentados como testes de uma migração já implementada**.

1. Inventário: cinco submódulos alvo; 14 aulas curriculares mais A00; oito atividades originais com mesmos hashes/UUIDs/keys/revisões/ordens.
2. Integridade: nenhuma aula órfã, duplicação por reexecução, colisão de key/posição, divergência module_id/submodule_id ou dependência cíclica.
3. Histórico: mesmas duas conclusões originais, oito progressos, quatro tentativas de quiz, quatro sessões interativas e avaliação existente; novas contagens legítimas devem ser identificadas por período.
4. XP: comparar ledger completo (inclusive active/points/earned_at), saldo e conquistas antes/depois; exercitar sincronizações oficiais no banco isolado depois da expansão para provar que o crédito histórico do módulo permanece. Confirmar primeira tentativa determina XP e reenvios/reavaliações não duplicam crédito.
5. Progressão: aluno novo, iniciado e concluinte legado; não retirar desbloqueios/conclusões históricos; aulas novas sem auto-conclusão; regra de Aula 00 explícita e igual no aluno, professora e central.
6. Projetos: envio mini 50/final 100 e avaliação 0–100 pelos fluxos atuais; histórico de versões, nota substituída e request_id repetido; nenhuma criação de entrega durante migração.
7. Recursos e contrato: importação incremental, colisões, prévia sem mutação, mínimo de quatro perguntas, gabaritos privados, vídeo antes dos slides em A00; permissões reais dos links verificadas com conta de aluno.
8. Escopo: aluno sem curso, inativo, professora fora do vínculo, admin e anon; testar URL/RPC direta sem ampliar permissões.
9. Encontros: planos docentes e confirmação existentes; nenhum evento de calendário, cobrança ou agendamento criado pela migração.
10. Concorrência e reversão: abortar com drift, bloquear importação simultânea, reexecução idempotente, reversão antes de uso e contenção depois de uso.
11. Navegador desktop/celular: Dashboard, LessonView, seleção de matérias/avaliação docente e Acompanhamento Pedagógico coerentes.
12. Regressão no ambiente isolado: learning-progress, student-learning, official-xp, project-workflow, teacher-learning e pedagogy, mais fluxos de navegador correspondentes. Build/lint somente quando houver alteração de aplicação.

Fontes de código: `src/pages/Dashboard.tsx`, `src/pages/LessonView.tsx`, `src/components/pedagogy/PedagogyJourney.tsx`, `src/lib/learningContent.ts`, `src/components/learning/LessonContentImporter.tsx`; migrations de currículo/progresso/XP como histórico, confrontadas com as definições atuais em produção.

## 7. Aprovação necessária

Atualização: o usuário aprovou a implementação da grade após esta auditoria. A implementação e suas condições de aplicação estão em [Grade HTML v2 — implementação](implementacao-grade-html-v2.md). Os itens abaixo registram as decisões apresentadas na auditoria original.

A auditoria solicitada está concluída. Antes de implementar a sincronização, aprovar:

- O inventário real como base: 13 aulas novas, preservando A00/A01; fornecer a lista antiga de dez aulas caso seja exigida equivalência editorial completa.
- Reuso dos três submódulos com renomes e criação de S04/S05.
- Introdução no S01, sem ocupar numeração curricular e inicialmente sem alterar seu papel na conclusão.
- Desenho de versão/coorte e proteção de conclusão/desbloqueio/XP de alunos legados antes da expansão ativa.

Aprovar este plano não deve ser confundido com publicar conteúdo ou aplicar migration em produção; essas ações continuam dependendo de autorização explícita.
