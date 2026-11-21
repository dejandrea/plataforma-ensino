# Evolução editorial e pacote unificado da Bitaria

Arquitetura aprovada — 12/11/2026, atualizada em 16/11/2026. **E1a e E2a implementadas somente no checkout local isolado; não implantadas em produção.** A decisão de manter materiais no Google Drive prevalece. O estado efetivo está em [fundacao-editorial-e1a.md](fundacao-editorial-e1a.md) e [importador-unificado-e2a.md](importador-unificado-e2a.md). Por decisão da usuária, a homologação PostgreSQL real foi adiada para uma rodada integrada E1a/E2a, sem impedir o desenvolvimento local; continua obrigatória antes de implantação. Demais modelos e etapas permanecem planejados.

## 1. Recomendação e menor entrega

Criar uma camada editorial comum aos formulários e à importação, sobre as identidades de aula/atividade existentes. Começar com edição em rascunho e publicação de aulas **sem qualquer histórico de aprendizagem**, para qualquer aula, sem listas fixas de UUIDs ou keys. Depois, coordenar essa mesma camada com o gerenciador web existente por um ZIP único.

Não ampliar a exceção específica da Aula 02 para permitir sobrescrita de conteúdo usado por alunos. Não criar outro ambiente de aprendizagem, outro visualizador ou outro parser de atividades. A política editorial deve ser a mesma para edição visual, JSON e ZIP.

Primeiro valor independente: administradora edita título/descrição/objetivos/duração, reorganiza e complementa atividades de uma aula sem histórico, vê comparação e salva um rascunho recuperável. Uma segunda ação publica o conjunto aprovado. Isso elimina soluções por aula antes de implementar versionamento de execuções com alunos reais.

Primeiro pacote único: aula curricular já existente, inicialmente vazia, com atividades v2, apresentações v1 e referências externas Drive; validação, prévia e salvamento em rascunho por uma operação. Atualização de uma aula sem histórico vem em seguida usando a mesma camada, não um segundo importador.

## 2. Base auditada e limites da evidência

Foram lidos código, schemas, migrations, testes e metadados de produção, sem linhas de respostas de alunos. O frontend publicado de referência é o release `d2acc6f5c7455a62ec1e4ff916273b80df7640a6`; a árvore principal local ainda tem outros trabalhos pendentes. Não tomar uma futura implantação da main como equivalente a esse release isolado.

Consulta de produção nesta auditoria: 16 atividades (5 slides, 2 mapas, 2 quizzes, 4 interativas, 2 vídeos e 1 flashcards), 3 apresentações/3 versões e 3 registros de reconciliação A02. Os números são um retrato, não autorização para alterá-los. O contrato suporta também online_lesson e project, embora não apareçam no agregado atual de atividades.

Não foi criada migration, alterado código da aplicação, invocado salvamento/publicação, executado deploy ou alterada coorte nesta tarefa. A movimentação anterior da conta de teste não é política aprovada para alunos reais.

Os schemas locais v1 e v2 foram comparados por conteúdo JSON com private.learning_content_schemas em produção: equivalentes. A comparação ignora apenas ordem das propriedades/indentação, não regras ou valores.

### Fontes locais normativas

| Assunto | Fontes auditadas e reutilização |
|---|---|
| Hierarquia | `src/components/management/TabContent.tsx`; tabelas courses → modules → submodules → lessons. Metadados atuais e seletores continuam. |
| Contratos | `src/contracts/learning-content.v1.schema.json`, `learning-content.v2.schema.json`, `src/types/learning.ts`, `src/lib/learningContent.ts`. Reutilizar validateLessonImport e projeção toStudentLesson. |
| Inclusão | `src/lib/studentLearning.ts`; `20261021180915_interactive_learning_and_rewards.sql`, learning_import_lesson / publish_learning_activities. Preservar modo legado. |
| Execução | `20261021034654_learning_environment_foundation.sql`, `20261021041807_student_learning_experience.sql`; progresso, tentativas, entregas, planos e guards. |
| Avaliações e XP | `20261022042042_official_xp_rules_v1.sql`, `20261023012714_project_review_history_and_criteria.sql`; manter regras centrais e auditoria append-only. |
| Flashcards | `20261028192918_flashcards_learning_activity.sql`, FlashcardsActivity. Versos revisados são persistidos por atividade/revisão/card_id. |
| Currículo | `20261026052759_curriculum_versions.sql`; versões/coortes são acesso curricular, não revisões editoriais. |
| Web | `public/apresentacoes/package.js`, `validate.js`, `presentation.schema.json`; `src/lib/webPresentations.ts`, WebPresentationManager, PresentationFrame e Edge import-web-presentation. |
| A02 | `20261112035823_reconcile_a02_learning_content.sql`, A02Reconciliation, `docs/reconciliacao-aula-02.md`. Referência de comparação, token, autorização e rollback, não modelo de exceção geral. |

O documento anterior `contrato-work-bitaria.md` descreve o ZIP de apresentação; sua nota inicial de implantação é histórica. O envelope unificado proposto aqui **não é aceito por esse importador atual**.

## 3. O que existe e o que falta

### Contratos e renderização

- v1: slides, mindmap, quiz, online_lesson e project. v2 acrescenta interactive, video e flashcards e configuração de recompensa. A quantidade de atividades é de 1 a 200; o envelope administrativo tem schemaVersion/context/lesson/activities/teacherOnly.
- Slides/mapas: resourceUrl HTTPS, format pdf/image/link, altText. Mapas são recursos, não um editor de grafos. Vídeo nativo exige arquivo Google Drive; a existência de helpers de embed de outros serviços não torna YouTube/Vimeo válidos no contrato video v2.
- Flashcards, quiz e interactive são dados estruturados nativos. Áudio, arquivo de exercício e exemplo de código não são novos activity_type. Na fase atual podem ser links em campos já permitidos, como recursos públicos de project, ou referências administrativas; não inventar content.type audio/code/download.
- Prévia e componentes de execução já existem. Texto/código em slides não autoriza executar HTML/JS. Prévia deve continuar sem RPCs de início, submissão, conclusão ou XP.

### Imutabilidade não equivale a versionamento completo

lesson_activities possui uma linha por UUID, revision e UNIQUE(lesson_id,key). Várias FKs históricas apontam para `(id, revision)` **nessa mesma linha**. Não há uma coleção independente de todas as revisões pedagógicas da atividade. Incrementar revision diretamente pode violar FKs; substituir conteúdo nessa linha pode reescrever o passado.

student_activity_progress tem UNIQUE(student_id,activity_id), não várias execuções/revisões paralelas. quiz_attempts usa sequência de tentativas por aluno/atividade e idempotência por request_id; activity_attempt_sessions registra a revisão e a apresentação aleatória. A correção ainda busca conteúdo/gabarito da atividade atual. A imutabilidade atual é o que torna isso seguro, não um mecanismo de recuperação de enunciados antigos.

Gabaritos estão em activity_quiz_keys, separados por atividade, com acesso protegido e guard de imutabilidade. Planos docentes têm revisões próprias, usadas por lesson_plan_sessions. Entregas e correções append-only não devem ser convertidas em campos mutáveis do editor.

As limitações relevantes para versões históricas são FKs de student_activity_progress, quiz_attempts, project_submissions, activity_attempt_sessions e flashcard_review_progress, além do armazenamento de gabaritos por atividade. Uma tabela nova de revisões isolada não resolve tudo sem adaptar essas leituras e referências.

### Publicação, apresentação e persistência

Salvar rascunho não publica a aula. Atividades têm draft/published e is_active; aulas têm planned/published. Não adicionar archived a esses enums em uma proposta sem migration. No MVP, arquivamento é uma ação editorial separada e só pode desativar atividade sem histórico/dependências; com histórico, aguardar releases versionados.

O gerenciador web já tem identidade estável, versões imutáveis, arquivo/hash, ativo apontado por active_version_id, auditoria, publicação/rollback e vínculo auxiliar por activity_id. As URLs assinadas duram 300 s; o viewer renova em 120 s. A assinatura é autorização temporária, não uma URL para persistir em JSON.

Hoje bind_web_presentation exige apresentação com versão ativa. Portanto, importar tudo em rascunho e chamar bind imediatamente **não funciona**. O MVP guardará intenções de vínculo no rascunho e usará a prévia local/versão explícita; os vínculos efetivos só entram na publicação controlada.

### Identidades e importação

lesson.key existe no envelope, mas a tabela lessons consultada não tem uma coluna de key. O importador atual valida UUID de destino mais títulos exatos de curso/módulo/submódulo/aula; os títulos são mutáveis e não bastam como identidade editorial.

O importador atual adiciona, não faz upsert. Rejeita key existente; ausência no JSON não exclui nada. order_index não tem UNIQUE por aula no banco atual: conflitos de posições precisam ser verificados no conjunto resultante, incluindo atividades não selecionadas.

Subconjuntos funcionam apenas se forem envelopes completos válidos e fechados sobre seus próprios pré-requisitos/gabaritos. O validador atual não resolve dependências externas ao documento. Não prometer patch arbitrário com apenas uma key e um campo.

### Aprendizagem e XP

XP usa identidade de origem `(student_id,event_type,source_id)` e regras centrais; a revisão não faz parte dessa chave. Há eventos/auditoria de política oficial e proteção de regras. Não renomear key/UUID ou trocar event_type para gerar nova recompensa. Importação e publicação não chamam sincronizadores ou concedem XP.

Coortes de currículo influenciam visibilidade, denominadores de conclusão, desbloqueio e recálculo de prêmios de módulo/curso. Uma atualização editorial **não muda coortes**. A preservação de crédito de conclusão/desbloqueio de alunos reais é um gate próprio, não é resolvida mantendo apenas student_progress sem alterações físicas.

## 4. Arquitetura comum proposta

Fluxo comum: documento validado → resolução de identidade → plano de alterações → rascunho → revisão → publicação atômica dos ponteiros/dados aprovados.

Entradas: formulário visual, envelope JSON e coordenador de ZIP. Todas chamam a mesma classificação e as mesmas operações editoriais. O coordenador ZIP cuida de transporte/recursos, não reimplementa recompensa, gabarito, conclusão ou correção.

Componentes existentes permanecem: TabContent seleciona a aula; LessonContentImporter oferece inclusão ou atualização; AdminLessonPreview e ActivityRenderer fazem a prévia, com PresentationFrame para decks locais e versões privadas. WebPresentationManager continua sendo editor e histórico especializado de apresentações.

Não usar títulos para escolher atividade ou apresentação. A seleção administrativa fornece lesson_id; atividade é `(lesson_id,key)`; apresentação ganha mapeamento estável `(lesson_id,presentation_key) → presentation_id`. Uma duplicação intencional recebe nova key/UUID com confirmação de que é outra atividade; nunca é estratégia de atualização.

## 5. Modelo de dados incremental proposto

Os nomes abaixo são conceituais. Dimensionar em migrations independentes depois da aprovação.

| Estrutura | Quando | Dados e restrições essenciais |
|---|---|---|
| private.editorial_lesson_state | MVP editorial | lesson_id PK; lesson_key verificada; contexto por UUID; sequência editorial/etag; baseline único de adoção. Unicidade da key dentro do curso, validada pelo serviço. Não inferir keys históricas apenas do título. |
| private.editorial_drafts | MVP editorial | Um rascunho corrente por aula; documento administrativo validado, recursos docentes externos e vínculos pretendidos; autor, etag de origem, número do rascunho, hash. Nenhuma cópia em tabela pública. |
| private.editorial_events | MVP editorial | Append-only, ator, data, ação, classificação, revisão editorial, patches antes/depois dos campos alterados e hashes. Baseline inicial único + deltas permitem reconstrução; snapshots completos só quando necessários. |
| private.lesson_import_operations | MVP ZIP | operation_id, alvo, actor, modo, digest bruto/semântico, seleção, etag, estado, etapas, refs de versões/arquivos e erro sanitizado. Sem guardar o ZIP inteiro no banco. |
| private.editorial_presentation_identities | MVP ZIP | lesson_id + key única → presentation_id único para aquele contexto. Mapeamento verificado; kits de produção reservam identidade lógica sem publicar conteúdo. |
| private.presentation_content_fingerprints | MVP ZIP | version_id + hash semântico, cache pequeno para reuso de versões imutáveis; não alterar retroativamente linhas de versões para preencher hash. |
| public.activity_content_revisions + private.activity_revision_keys | Fase com histórico | PK activity_id + revision; conteúdo público imutável por revisão, gabaritos/planos correspondentes privados; não criar nova identidade de atividade a cada revisão. |
| lesson_publications + publication_activities | Fase com histórico | Metadados da aula e composição imutável: ordem, obrigatoriedade, dependências, activity_revision e web_version_id. Conjuntos referenciam conteúdo, não copiam binários/JSON inteiro repetidamente. Exposição via RPC, não SELECT indiscriminado. |
| student_lesson_assignments | Fase com histórico | Aluno → publicação da aula escolhida na primeira interação efetiva; cria somente quando necessário. Não atribuir todas as aulas a todos os alunos antecipadamente. |
| learning_executions, se reexecução aprovada | Posterior | Representa nova execução voluntária sem substituir progresso anterior. Ajustar unicidades/FKs em migração gradual; não habilitar apenas removendo constraints. |

Metadados/editorial_events podem ficar inteiramente em private. Conteúdo público versionado só terá leitura quando a publicação estiver autorizada ao aluno. Registros antigos continuam na fonte atual até o backfill validado; não fazer duas fontes de verdade editáveis.

### Ponte de compatibilidade para versões

1. Materializar revisão histórica inicial das atividades e seus gabaritos existentes; conferir hashes, tipos e chaves. O backfill não incrementa revisão nem atribui conclusões.
2. Criar FKs para `(activity_id, revision)` na coleção de revisões, validá-las e só então retirar as FKs equivalentes para a linha única atual. Manter os UUIDs das tentativas/progressos/entregas.
3. Atualizar início/submissão de quiz e matching para ler **revisão da execução/sessão**, não o ponteiro atual. Retentativa usa a mesma apresentação/gabarito e o mesmo request_id quando aplicável.
4. Resolvedor de aprendizagem entrega à interface a revisão atribuída ao aluno; não mudar activity_revision do progresso para fazê-lo coincidir com a versão nova. Enquanto houver clientes antigos, manter adapters com o mesmo contrato de resposta.
5. Apresentações históricas exigem autorização por versão referenciada na publicação: can_read_web_version hoje restringe alunos à versão ativa global. Adaptar essa regra de forma restrita, não conceder acesso geral a versões inativas.
6. A reconciliação A02 permanece bloqueada para histórico; a nova camada só assume aulas com histórico quando essa ponte e as políticas de crédito estiverem homologadas.

## 6. Classificação de alterações

Uma mudança pode receber mais de um rótulo; a classificação final é a de maior impacto. Automação sugere, mas não prova equivalência pedagógica de texto.

| Alteração | Revisão editorial | Revisão pedagógica / efeito proposto |
|---|---|---|
| Título, descrição pública, duração estimada | Novo evento/seq editorial; mesma revisão de aprendizagem quando não altera critérios | Corrigir em rascunho; aprovação simples. Descrição que muda tarefa/objetivo exige revisão pedagógica. |
| Instrução de atividade | Sempre registrar | Conservadoramente nova revisão; só classificar correção textual sem impacto após política explícita. |
| Texto de pergunta, opções, resposta, pares, passingScore/maxAttempts | Novo evento | Nova revisão avaliativa, mesmo em correção de redação enquanto não houver snapshots completos. Tentativas antigas mantêm fonte. |
| Troca de URL por erro de permissão/arquivo equivalente | Histórico do recurso | Mesma conclusão se equivalência revisada; não apagar receipt. MVP com histórico bloqueia mesmo essa edição até resolvedor seguro. |
| Novo vídeo/PDF/mapa com conteúdo significativo | Histórico do recurso e conteúdo | Nova revisão; antigos concluintes não precisam refazer por padrão. Preservar referência anterior. |
| Nova versão web | Reutilizar web_presentation_versions | Só editorial se equivalente. Se pedagógica, nova composição aponta versão específica; publicação web global não deve reescrever experiência em andamento. |
| Ordem | Nova composição | Mudança estrutural. Validar posições do conjunto completo e dependências; não muda recompensa. |
| Obrigatoriedade, dependências, objetivos significativos | Nova composição/publicação | Afeta critérios; novos alunos usam novo conjunto; iniciados/concluintes retêm anterior por padrão. |
| Adicionar atividade | Nova identidade + composição | Não entra retroativamente como pendência em aula já concluída. |
| Arquivar | Nova composição, sem DELETE histórico | Impedir novas iniciações no conjunto novo; manter resolução para execução/resultado antigo. |
| Duplicar intencionalmente | Nova identidade, rascunho | Alerta de nova origem de XP; não usar para contornar idempotência/imutabilidade. |
| Trocar tipo ou significado da key | Conflito | Não converter quiz em slides no mesmo UUID. Criar outra identidade deliberada e planejar transição. |
| Mudar política/valor de XP | Fora da operação editorial | Exige política própria; não é campo livre no pacote. |

Na fase sem histórico, campos aceitos podem manter revision=1, com histórico editorial e origem anterior. Havendo qualquer uso, a publicação conservadora é bloqueada até a fase versionada; nenhuma exceção baseada em ausência apenas de conclusão.

## 7. Política pedagógica proposta para aprovação

| Cenário | Comportamento recomendado |
|---|---|
| 1. Aula vazia, sem histórico | Inserir em rascunho; publicar só após revisão. |
| 2. Publicada, não iniciada por ninguém | Atualizar por transação controlada após nova checagem de uso e concorrência; preservar IDs/keys. |
| 3. Iniciada por alguns alunos | Fixar publicação antiga para quem iniciou; novos alunos recebem a nova. Não mover execução automaticamente. |
| 4. Concluída por alguns alunos | Manter conclusão/XP da versão concluída. Versão atual pode ser consultada em revisão sem recompensar/obrigar refazer. |
| 5. Tentativa em andamento | Enunciado, pares, embaralhamento, critério e gabarito fixados à revisão da sessão; expiração/reinício deve ser explícito. |
| 6. Tentativa concluída | Resultado e feedback históricos imutáveis; correção editorial não recalcula nota passada. Reavaliação excepcional exige política separada. |
| 7. Nova atividade obrigatória | Obrigatória para nova publicação; não invalida aula anterior concluída. Para iniciados, política padrão mantém a composição antiga. |
| 8. Atividade deixa de ser obrigatória | Opcional no conjunto novo; progresso já obtido não some, e XP não é retirado pela alteração editorial. |
| 9. Atividade arquivada | Oculta para novos inícios; histórico acessível por autorização. Se houver sessão aberta, manter revisão até sua conclusão/expiração planejada. |
| 10. Quiz muda perguntas/gabarito | Nova revisão; sem migração automática de respostas e sem recompensa duplicada. |

XP de atividade continua único por aluno/tipo de evento/UUID de origem. Não incluir revision na chave da recompensa para permitir pagamento novo. Em reexecução voluntária, nova tentativa pode ser registrada sem novo prêmio por padrão. Mudança de categoria de recompensa de uma atividade usada é conflito.

Créditos de aula/submódulo/módulo/curso e desbloqueios históricos precisam ser protegidos antes de publicar novas exigências para alunos reais. Não basta conferir que o saldo ficou igual imediatamente: testar sincronizações futuras, remoção/inativação de eventos e mudança dos denominadores. A solução de crédito histórico deve registrar fatos anteriores verificáveis, sem criar student_progress para aulas nunca estudadas.

## 8. Fluxos administrativos

### Edição visual

Conteúdo → aula → abas Visão da aula / Atividades / Materiais / Histórico. Estado publicado sempre visível; ações Salvar rascunho, Comparar, Publicar conjunto e Arquivar ficam distintas. Não pedir UUID/SQL à administradora.

Editor da atividade oferece formulário por tipo, duração/obrigatoriedade e seletor de pré-requisitos por título. Ordenação por mover acima/abaixo acessível; drag-and-drop é melhoria opcional, não único controle. Duplicar exige nome/key nova gerada e confirmação. Arquivar informa dependências e mantém histórico.

Editor de quiz/matching separa questões públicas e respostas privadas; nunca mistura gabarito na prévia de aluno. Recursos externos mostram link, tipo, última conferência manual e aviso de acesso não verificado. Materiais docentes têm indicação Restrito, sem link em componente de aluno.

### JSON inteligente

1. Selecionar inclusão ou atualização. Inclusão conserva o comportamento atual de não sobrescrever.
2. Validar com validateLessonImport; resolver UUID do contexto selecionado e a key estável; títulos divergentes são aviso de revisão, não reatribuição silenciosa.
3. Construir o conjunto final, incluindo atividades omitidas no documento. Não excluir por ausência.
4. Mostrar Nova / Sem alterações / Editorial / Recurso / Estrutural / Nova revisão / Conflito / Incompatível. Conflitos impedem confirmação.
5. Seleção parcial gera outro plano; recalcular dependências, posições e gabaritos. Incluir closure de dependências obrigatórias ou bloquear, sem selecionar mudanças escondidas. Se uma posição colide com atividade mantida, oferecer plano explícito de reordenação ou rejeitar.
6. Salvar rascunho recuperável. Reabrir painel recupera rascunhos e pendências de publicação do banco, não só do estado React da sessão.
7. Publicar somente o conjunto aprovado; uso que surgiu desde a comparação invalida a operação.

### ZIP único

Mesmo fluxo, com inventário de apresentações e links Drive, usando o contrato proposto no documento complementar. Uma operação administrativa pode ter várias etapas internas; a administradora não precisa desmontar o pacote ou fazer imports individuais.

Reimportação idêntica deve retornar Sem alterações / Operação já concluída, sem exigir refazer a importação só para recuperar botões de publicação. Publicação é ação persistida separada, disponível depois de reabrir a aula.

## 9. Segurança e RLS

- Planejar/publicar/importar exige admin ativo verificado no servidor; JWT obrigatório na Edge e auth.getUser, com role do perfil atual. Não confiar em claims editáveis de user_metadata nem em role enviado pelo cliente.
- Funções privilegiadas ficam em private, search_path vazio e EXECUTE revogado de PUBLIC/anon; wrappers mínimos verificam autorização. Adoção de SECURITY DEFINER só para operações necessárias, nunca para esconder falha de RLS.
- Rascunhos, manifestos administrativos, teacherOnly, eventos e URLs docentes são privados. Professor não ganha automaticamente acesso ao editor/admin; eventual leitura pedagógica segue escopo existente e precisa de aprovação explícita.
- Leitura de publicação ao aluno verifica papel ativo, acesso à aula/módulo/coorte e vínculo/revisão atribuído. Rascunho e versão histórica alheia continuam negados mesmo com UUID conhecido.
- Bucket web-presentations continua privado. Cliente não faz upload direto. Não criar buckets para PDF/vídeo/docente; não mover arquivos Drive.
- RPCs de publicação não aceitam SQL, caminhos Storage arbitrários ou permissões sugeridas pelo pacote. O servidor resolve referências e recalcula os hashes/diffs.
- Tokens de concorrência/sha256 são integridade, não autorização. Idempotência inclui alvo e seleção, sem reutilizar operação de outra aula.
- Rejeitar alteração parcial de conjunto de avaliação, referências fora da aula, dependência circular ou dependência arquivada não resolvida.
- Retestes de RLS incluem REST/GraphQL e funções privadas, não apenas componentes escondidos na interface. Não eliminar guards para passar testes.

## 10. Consistência, concorrência e falhas

Validação e prévia são de leitura. Ao confirmar salvamento, criar operação durável, enviar apenas apresentações para prefixos privados imutáveis, verificar integridade e então anexar os recursos ao rascunho. Não publicar a aula durante upload.

Estados propostos: validated → staging → draft_ready → publication_pending → committed; falhas retryable/blocked/abandoned. validated pode existir apenas em memória antes de confirmar; nenhum progresso ou receipt é criado para prévia.

Não existe transação única de Storage + SQL. O commit SQL do rascunho referencia somente versões já válidas. Se uma etapa falha, manter publicado anterior, guardar resultado parcial privado e retomar pelo operation_id; não recomeçar duplicando tudo.

Na publicação, uma única transação SQL bloqueia identidades afetadas, confere etag/histórico, ativa versões web necessárias, cria vínculos, publica as atividades e atualiza o ponteiro editorial aprovado. A aula só muda planned → published se a administradora tiver solicitado isso expressamente. Se qualquer passo falha, todos os ponteiros ficam anteriores.

No MVP sem histórico, serializar checagem de ausência de uso e escrita como na referência A02, com timeout e locks breves; avaliar contenção. Não trocar isso por advisory lock se os RPCs de aprendizagem não participarem dele. Na fase avançada, padronizar ordem de locks e fixação de revisão nos leitores/escritores para evitar corrida com início de tentativas. Nenhuma chamada de rede fica dentro do lock SQL.

Limpeza só alcança objetos da operação abandonada, sem referências por versão, rascunho, execução ou publicação; revalidar referências sob lock e aplicar carência. A primeira implementação pode apenas listar órfãos para limpeza administrativa, sem Cron novo ou exclusão automática. O catch atual da Edge não é garantia de compensação para crash/morte do processo.

## 11. Armazenamento, custos e volume

Drive: PDFs, mapas, vídeos, exercícios, código para baixar e materiais docentes. Banco: conteúdo estruturado e metadados. Storage existente: apresentações e imagens. Nenhum serviço pago ou upgrade obrigatório é proposto; quotas atuais e uso precisam ser medidos antes de ampliar.

Consulta atual: banco ~19,19 MB (19.188.883 bytes), Storage com 28 objetos e ~1,40 MB (1.395.576 bytes). O tamanho físico do banco não é o tamanho de um dump nem capacidade disponível; o agregado não identifica permissões ou preço do plano.

Estimativa de planejamento: para 14 aulas com JSON administrativo médio de 40 KiB, uma base por aula ~560 KiB; um rascunho por aula +560 KiB; 20 eventos de 2 KiB por aula ~560 KiB. Total lógico ilustrativo ~1,64 MiB, **antes de índices, TOAST, WAL, versões de linha e overhead**. Não gravar snapshots completos de 2 MB a cada clique.

Se cada aula tiver 6 imagens de 150 KiB e deck de 30 KiB, a primeira versão de 14 decks soma ~12,7 MiB de payload. Cinco versões completas ~63,6 MiB. O prefixo atual por versão pode repetir imagens inalteradas entre revisões; a proposta evita versões sem mudança, mas não promete deduplicação global de binários sem alterar autorização/caminhos.

Possíveis custos são consumo das quotas existentes de armazenamento, banco, egress, invocações/builds e espaço no Drive; nenhum valor de cobrança foi contratado ou presumido. Definir alertas e parar antes de exigir plano pago. Não expor manifestos/gabaritos para economizar consultas.

Histórico editorial não é backup. A ausência de recuperação comprovada continua gate de implantação ou aceitação explícita de risco, não é motivo para criar snapshots redundantes como substituto.

## 12. Migração incremental e A02

Manter A02 temporariamente, sem expandir UUIDs hardcoded. Depois que a camada comum reproduzir e superar seus testes, retirar a entrada especial da interface e desabilitar o wrapper de reconciliação de forma planejada. Não apagar sua auditoria.

A exceção no learning_guard_activity deve passar de permissão A02 a um mecanismo comum estritamente transacional que valide alvo/antes/depois, autorização e ausência de histórico. Fazer essa troca somente na entrega correspondente; não deixar dois bypasses ativos como padrão. Uso real em A02 deve impedir reaplicar a exceção antiga.

Alunos/coortes, versões de currículo e grades não são migrados por importação. Um eventual programa de transição de alunos reais tem aprovação e testes próprios; conta de teste não certifica preservação histórica em produção.

## 13. Roadmap em entregas independentes

| Etapa | Objetivo e componentes | Dependências | Aceite | Risco e complexidade | Migration / deploy / compatibilidade |
|---|---|---|---|---|---|
| P0 — esta entrega | Auditoria, política e contrato candidato | Código/metadata atuais | Decisões identificadas, limites e exemplos candidatos claros | Baixa; contrato ainda não aprovado | Nenhuma migration/deploy; fluxos atuais mantidos |
| E1a — fundação editorial | JSON v1/v2 existente, identidade, comparação, rascunho privado persistente, publicação separada, UI mínima | Política e identidade aprovadas | Aulas elegíveis sem histórico, oito tipos, UUID/key/recompensas preservados, concorrência/rollback, zero XP | Média/alta: guard e corrida com aprendizagem | Implementada localmente; migration aditiva e quatro RPCs, sem aplicar. Inclusão legada, web e A02 mantidos |
| E2a — importação unificada inicial | Kit Work, ZIP externo, aula v2 e ZIPs web v1, inventário Drive, intenções persistentes e publicação coordenada | Base E1a aprovada para desenvolvimento; homologação PostgreSQL integrada antes da implantação | Implementada localmente para aula existente vazia e sem histórico; rascunho recuperável, idempotência e publicação única de atividades/versões/vínculos | Alta: falhas distribuídas e permissões | Migration E2a e nova Edge preparadas, sem aplicar/deploy; pipeline web e validadores reutilizados |
| E1b + E2b — editor completo e atualização por pacote | Formulários dos oito tipos, metadados/ordenação/links, seleção de mudanças e atualização ZIP, histórico e arquivamento controlado sem uso | E1a homologada + E2a | Reusar a mesma fundação, fechamento de dependências, preservação de omitidas, publicação consistente | Média/alta | Planejada; adaptar RPC/Edge/frontend sem novo parser |
| E3a — versões pedagógicas | Coleção de revisões/gabaritos, composição de publicação, leitura compatível | Backfill e matriz pedagógica aprovados | Conteúdo histórico reproduzível no que está sob controle da Bitaria; FKs validadas; clientes antigos compatíveis | Muito alta: nota, progresso e XP | Migrations graduais + RPCs de aprendizagem + frontend; ponte de leitura obrigatória |
| E3b — alunos em andamento/concluintes | Fixação de publicação, crédito histórico/desbloqueios, sessão avaliativa versionada | E3a + aprovação de política | Todos os dez cenários da seção 7; sem perda de crédito nem pagamento duplicado em ressincronização | Muito alta; liberar por piloto autorizado, não por coorte automática | Migrações/serviços/frontend; A02 pode ser aposentada após prova de equivalência |
| E4 — manutenção/editor avançado | Arquivamento com histórico, restauração como nova revisão e reexecução opcional | E3b | Sem deletes históricos, retomada de sessão, referência correta de recurso | Alta; escopo separável | Deploy e eventual migration específica; nenhuma contratação obrigatória |

**Etapa removida:** armazenamento gerenciado de materiais complementares. **Postergados:** upload de vídeo/PDF/áudio, bucket docente, migração de Drive e deduplicação global de arquivos. Isso reduz o coordenador a metadados + apresentações existentes.

Ordem aprovada: **E1a → E2a → E1b/E2b → E3a/E3b**. E2a não exige concluir os formulários especializados de E1b. A edição com histórico continua bloqueada até E3 comprovar preservação dos créditos e execuções. Aulas 02/03 podem continuar pelos fluxos atuais, sujeitos às proteções existentes.

## 14. Plano de testes e liberação

| Área | Casos obrigatórios |
|---|---|
| Contrato | v1/v2 atuais, oito tipos, propriedades desconhecidas, keys/posições duplicadas, gabaritos, dependências, URLs, limites; cliente e servidor concordam. |
| Editor | Alteração simples, nova atividade, material novo, seleção parcial fechada, omissão preservada, duplicação intencional, arquivamento com dependentes, nenhum uso e uso surgindo entre comparação/publicação. |
| Concorrência | Dois administradores, aluno iniciando enquanto publica, retomada após timeout, retry de mesma operação, mesma productionId com digest diferente. |
| Histórico | Tentativa pendente com publicação concorrente; resposta antiga corrigida por gabarito antigo; flashcards por revisão; plano de sessão antigo; entrega/correção preservada; conclusão anterior e nova exigência. |
| XP | Sem evento em import/prévia/publicação; repetir pacote e revisar conteúdo não paga novamente; recalcular saldo e módulos depois de nova composição sem retirar crédito protegido. |
| Distribuição | Falha antes/depois de cada upload, após registro de versão, antes/depois de commit SQL, resposta perdida, processo encerrado, órfão privado e cleanup concorrente. |
| Segurança | Admin/professor/aluno/inativo/anônimo; UUID de outra aula, versões antigas não atribuídas, RLS/GraphQL, signed URL vencida, teacherOnly e links docentes ausentes na projeção pública/logs. |
| Web | Deck atual reutilizado, novo deck draft, múltiplos decks/keys iguais em aulas diferentes, vínculo só na publicação, zero XP no viewer, Bitara oficial preservada. |
| UI | Desktop/celular, teclado, mover acima/abaixo, before/after legível, erro persistente e compreensível, rascunho recuperável ao reabrir, publicação separada sem botão dependente só da sessão. |

Para cada migration: ensaio isolado, avaliação de locks/FKs, hash do SQL, inventário/recuperação e aprovação antes de produção. Testes de dados sintéticos não comprovam restauração do banco real. Antes de publicar com alunos reais, executar os cenários de histórico em ambiente isolado e homologar transporte/autorização hospedados.

Nesta entrega documental, os dois exemplos estruturais foram verificados pelos validadores existentes e a suíte do candidato passou com **9 testes: 2 exemplos válidos e 7 negativos**. Isso valida os artefatos da proposta, não implementa/testa a arquitetura futura. Não foi necessário rebuild da aplicação, que não foi alterada.

## 15. Decisões aprovadas e autorizações futuras

1. Aprovada a política da seção 7: manter publicação antiga para iniciados/concluintes e não impor refazer por padrão; liberação depende de E3.
2. Autorizada a implementação **local de E1a**, restrita a aulas sem histórico, com JSON, rascunhos persistentes e publicação separada. Formulários completos ficam em E1b.
3. Aprovados o envelope com ZIPs web internos, os limites iniciais e o kit para o Work; implementação de E2a continua posterior à homologação de E1a.
4. A administração revisa as mudanças e é a única autorizada ao gerenciamento editorial nesta fase. Nenhuma ampliação de permissão de professor.
5. Aprovar a proteção de créditos históricos de módulos/XP antes da fase E3b; não extrapolar o tratamento da conta de teste.
6. Definir retenção de rascunhos/operações abandonadas e processo manual de limpeza, preservando publicados/histórico.
7. Aprovar migrations/deploys individualmente e o risco/estratégia de recuperação vigente. Esta documentação não autoriza nenhuma dessas ações.

Documentos complementares: [contrato candidato e fluxo Work](contrato-pacote-aula-proposto.md), [instruções candidatas de produção](work-pacote-aula-proposto.md). Materiais de proposta ficam em `docs/propostas/pacote-aula-v1/`, fora de public/. O contrato atual continua valendo até a implementação e homologação do envelope novo.
