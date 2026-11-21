# Homologação técnica da Fundação Editorial E1a

> **Resultado vigente — 20/11/2026:** homologação E1a + E2a concluída em PostgreSQL 17.12 real, com 19 cenários/verificações aprovados e encerramento controlado. **Apta com ressalvas locais e condições de implantação**, detalhadas na [decisão atualizada](decisao-implantacao-e1a-e2a-20261120.md). Os registros abaixo são históricos; a falta de RAM, a ausência de testes nativos e a inconsistência UTF-8 foram superadas. Hash final E1a: `8bab8c53d0f7b1f6648193fe318b2378b4c0c94c00b17a2af47ceac0c3da3fdf`.

**Atualização de 15/11/2026:** a proposta portátil foi autorizada, e os binários 17.12 foram baixados, verificados e preparados. O servidor continua sem inicialização por RAM insuficiente. O resultado permanece **não apta para implantação**, pois os testes PostgreSQL reais ainda não ocorreram. As seções 1–14 abaixo preservam o diagnóstico de 13/11; a seção 15 registra esta continuação.

13/11/2026. **Resultado desta rodada: NÃO APTA para implantação — homologação PostgreSQL real bloqueada por ambiente.** Não é uma reprovação funcional do código aprovado. Os testes PGlite anteriores não atendem ao requisito de concorrência real e não foram apresentados como tal.

## 1. Resumo executivo

Checkout, branch, base e hash conferem. Não houve mudança na migration, no frontend ou nas regras de locks. Preservadas as alterações locais e evidências anteriores. A máquina tem cerca de 0,75 GiB de RAM livre; Rancher/WSL está parado e não foi encontrado PostgreSQL nativo nos locais verificados. Nenhum servidor foi iniciado e nada foi instalado.

A usuária escolheu receber uma proposta de PostgreSQL portátil antes de autorizar sua instalação. O procedimento está em [proposta-postgresql-portatil-e1a.md](proposta-postgresql-portatil-e1a.md). O próximo passo depende dessa autorização e de recursos livres suficientes.

## 2. Checkout e integridade

| Item | Resultado observado |
|---|---|
| Diretório | `tmp/editorial-e1a-20261112` |
| Branch | `feature/editorial-e1a` |
| HEAD/base | `d2acc6f5c7455a62ec1e4ff916273b80df7640a6` |
| Implementação E1a | Alterações locais staged; ainda sem commit |
| Diferenças unstaged antes desta rodada | Nenhuma encontrada |
| `git diff --cached --check` inicial | Passou |
| Árvore principal | Não modificada; pendências de outros trabalhos não foram incorporadas |
| Evidências anteriores | Arquivos e capturas mantidos; não sobrescritos por nova rodada PGlite/browser |

O inventário inicial contém os 28 caminhos da entrega anterior, incluindo `.gitattributes`, documentação/artefatos aprovados, migration, serviço/editor, integração de menu, scripts e testes. Isso corresponde ao relatório anterior. Esta rodada acrescenta apenas os dois documentos de homologação/proposta; não registra commit, push, merge ou deploy.

## 3. Ambiente disponível

| Recurso | Observação real |
|---|---|
| RAM física | 8.215.604 KiB ≈ 7,84 GiB |
| RAM livre na medição | 783.616 KiB ≈ 0,75 GiB |
| C livre | 87.349.678.080 bytes ≈ 81,35 GiB |
| D livre | 429.184.610.304 bytes ≈ 399,71 GiB |
| Docker cliente | `29.6.2-rd`, já instalado |
| Docker servidor | API indisponível em `npipe:////./pipe/docker_engine` |
| Contextos Docker | Somente `default` encontrado |
| `rdctl` | Cliente `v1.24.0`, já instalado |
| WSL | `rancher-desktop` e `rancher-desktop-data`, WSL2, ambos `Stopped` |
| PostgreSQL nativo | `postgres`, `pg_ctl`, `psql` não encontrados no PATH; sem serviço correspondente nos filtros consultados e sem instalação nos caminhos usuais verificados |
| Ferramentas do projeto | Node/testes existentes, PGlite, Chromium e fixtures; não substituem PostgreSQL com conexões reais |
| PostgreSQL utilizado nesta rodada | **Nenhum: não iniciado** |

Não se conclui que seja impossível existir algum binário fora dos locais consultados. O que se comprovou é a ausência de um endpoint/instalação reutilizável identificado nessa sessão. Não foi feita varredura indiscriminada de pastas privadas. A consulta de recursos inicialmente bloqueada pelo sandbox foi repetida, com autorização, exclusivamente para leitura.

## 4. Testes realmente executados nesta rodada

Executados: leitura do estado Git, hash do arquivo, whitespace do diff staged, comandos de inventário/versão Docker e `rdctl`, estado WSL, consulta de RAM/disco e inspeção estática dirigida da migration e contratos.

**Não executados:** publicação SQL, conexões PostgreSQL, testes A–F, benchmark de volume, ensaio de recuperação, testes de papéis em PostgreSQL real, build, lint ou regressões de runtime. Não foi iniciado PGlite novamente para tentar suprir o requisito ausente ou consumir a pouca RAM livre.

Os resultados anteriores — 20 testes SQL PGlite, 1 browser, 74 na rodada de regressão, build aprovado e lint com 168 erros/8 avisos preexistentes — são evidências históricas preservadas, não novos resultados de homologação desta rodada.

## 5. Concorrência A–F e métricas

| Cenário exigido | Teste a executar em PostgreSQL real | Resultado/tempos desta rodada |
|---|---|---|
| A. Publicação sem concorrência | Medir requisição total, transação, espera e retenção dos locks, sem pausas artificiais | Não executado / não medidos |
| B. Leitura de outra aula | Sobrepor leitura real à publicação; observar bloqueio, duração, timeout e conclusão | Não executado / não medidos |
| C. Aluno na mesma aula | Aluno primeiro: histórico confirma e publicação deve bloquear. Publicação primeiro: início aguarda e usa o conteúdo final. Registrar IDs/revisões/hash de conteúdo e ambas as ordens | Não executado / não medidos |
| D. Sessão docente | Leitura da atividade/plano e criação de sessão no fluxo existente, nas duas ordens; não reduzir locks | Não executado / não medidos |
| E. Dois administradores | Salvar/publicar simultaneamente em sessões com atores diferentes; stale token/versão rejeitados; repetição idempotente e ausência de efeitos parciais/permissões residuais | Não executado / não medidos |
| F. Contenção e timeout | Transação bloqueadora controlada; SQLSTATE, espera por cada aquisição, espera total, rollback e retomada validada | Não executado / não medidos |

A automação deverá usar processos/conexões independentes, registrar `pg_backend_pid()` distintos e sincronizar por barreiras observáveis. O observador consultará `pg_locks`, bloqueadores e `wait_event_type`, sem ler conteúdo sensível. Relógio monotônico no cliente mede duração total. A retenção medida por amostragem deve informar intervalo/precisão; não chamar esse valor de timestamp exato de aquisição.

Barreiras/pause de teste, se necessárias para provocar sobreposição, devem existir apenas nas fixtures sintéticas. Medições com retenção artificial serão separadas da publicação natural do cenário A. O `lock_timeout=5s` pode ser aplicado em aquisições sucessivas; cinco segundos não é promessa de limite total da transação. Também observar deadlocks e erro completo, sem ocultar falhas com repetição automática.

O `ACCESS EXCLUSIVE` atual é de tabela inteira e pode bloquear leituras de outras aulas. A documentação PostgreSQL confirma esse comportamento; não foi medido seu impacto neste computador. [Referência oficial PostgreSQL 17](https://www.postgresql.org/docs/17/explicit-locking.html).

## 6. Volume e limites

| Perfil planejado | Condição | Resultado real |
|---|---|---|
| Pequeno | Aula sintética semelhante às atuais | Não medido |
| Representativo Work | Oito tipos e teacherOnly válidos; recursos externos fictícios | Não medido |
| Próximo ao limite | Até 200 atividades válidas, dentro do contrato e do limite de documento | Não medido |

Coletar separadamente tamanho UTF-8 do arquivo e do JSON normalizado, tempos de validação/comparação/salvar/publicar, retenção de locks, `pg_total_relation_size` das tabelas/índices editoriais e tamanho lógico dos patches após atualizações sucessivas. Usar o mesmo processo sem carga e sob concorrência, registrando versão/configuração/RAM. Não inferir garantias para Supabase hospedado.

**Achado estático para resolver na homologação:** a migration limita `length(p_document::text)` a 2.000.000 (caracteres), enquanto upload usa `file.size` (bytes) e a textarea usa comprimento de string JavaScript. Isso já ocorre no fluxo existente, mas não representa um limite uniforme de 2 MB UTF-8. Incluir textos acentuados/Unicode nos testes; decidir ajuste comum de validação ou restrição operacional antes de liberar. Nenhum limite foi alterado silenciosamente e o hash da migration foi preservado.

Se o perfil máximo prolongar bloqueios de leitura, propor teto operacional menor com base nas medições, ou otimização revisável. Não retirar os locks para fabricar desempenho aceitável e não contratar infraestrutura.

## 7. Segurança

Inspeção estática reencontrou: quatro RPCs públicas com checagem administrativa; helpers privados revogados; `search_path` vazio; tabelas privadas com RLS e privilégios revogados; permissões transitórias restritas por transação e antes/depois exatos; evento editorial imutável; reaproveitamento da validação versionada pelo importador legado.

Isso **não é revalidação em PostgreSQL real**. Permanecem pendentes: admin ativo permitido; aluno, professor, anônimo e admin inativo negados; ACLs efetivas de funções/tabelas/sequências; tentativa de forjar permissões; proteção de teacherOnly; owner de SECURITY DEFINER; objetos auxiliares não expostos; eventos não editáveis. Verificar também PUBLIC e `service_role`, sem confiar apenas nos grants explícitos do papel authenticated.

Manter a política existente de leitura docente de gabaritos publicados. Professores não recebem operações editoriais nem acesso aos rascunhos privados. Comparar os testes negativos do importador legado antes/depois da extração de `learning_validate_document` em servidor real; não basta conferir o nome do helper.

## 8. Compatibilidade e regressão

Nenhum código foi ajustado. Não se executou nova rodada de regressões com a memória atual. Após preparar o ambiente, reexecutar aprendizagem v1/v2, A02, web/ZIP, XP oficial, progresso, sessão docente, tentativas, flashcards, projetos e currículo/coortes. Comparar recibos/perfis/eventos antes/depois usando apenas fixtures.

Não corrigir a dívida geral de lint nesta tarefa. Rodar build/lint após qualquer alteração necessária e demonstrar ausência de diagnósticos novos. Manter a distinção entre lint preexistente e falha introduzida.

## 9. Ajustes e hash final

Migration e aplicação **inalteradas**. Hash conferido repetidamente:

```text
a990cf305c7d19cec5e8fc23dd7b21545bfd80d3f45ead8aa5fc54c1f3c5c301
```

Novos documentos: este relatório e a proposta portátil. Não se alteraram regras de XP, currículo, coortes, contratos ou dados. Se a homologação exigir alteração da migration ainda não aplicada, registrar diff/justificativa, repetir testes e substituir explicitamente o hash de aprovação.

## 10. Preflight de produção

**Pendente; não executado.** A tarefa o determina após a homologação local, que está bloqueada. Não foram consultadas contas, respostas ou dados de alunos nem invocadas RPCs remotas. O projeto esperado continua `gnyiyhnbpjhdgrhsevbh`, sem confirmação remota nova nesta rodada.

Depois do aceite local: leitura de projeto/versão, migrations aplicadas, schemas e definições de guards, ACL/RLS, agregados/contagens e tamanhos das tabelas; metadata do deployment Vercel, commit, branch e regras de publicação automática. Não ler valores secretos de ambiente ou respostas de alunos. Marcar como pendente qualquer configuração indisponível ao conector; não presumir proteção de preview ou branch correta. Nenhum push para descobrir comportamento de deploy.

Executar SQL remoto estritamente de leitura, preferindo transação READ ONLY e consultas de metadata/agregados. Não usar `EXPLAIN ANALYZE` em função de escrita, migration geral ou teste de publicação real. Esta etapa não autoriza alterações, mesmo que os testes locais futuros passem.

## 11. Recuperação específica

**Proposta, não executada nem ensaiada em PostgreSQL real.** Não equivale a backup de produção.

1. Antes de instalar, capturar definições e ACLs dos três guards e do importador legado, além do inventário esperado. A migration guarda as três definições de guard internamente, mas uma cópia técnica externa protegida facilita conferir a instalação.
2. Falha antes do COMMIT, executando o arquivo integral em uma transação: DDL, substituições de funções e inserts de metadata devem ser revertidos pelo PostgreSQL. Confirmar isso em teste com falha deliberada antes de autorizar produção.
3. Perda de conexão após envio do COMMIT deixa resultado incerto: verificar objetos, definições/ACLs e histórico de migrations. Não reaplicar cegamente. Não assumir que o executor remoto registra histórico e DDL na mesma transação; testar o mecanismo de aplicação escolhido.
4. Detectar instalação parcial comparando cinco tabelas, quatro RPCs e assinaturas de helpers, os três guards, RLS/grants, backups de guard e versão registrada. Objetos presentes sem histórico, ou histórico com objetos ausentes, são divergência bloqueante. Não corrigir com `DROP`/reaplicação geral.
5. Para desativar após instalação autorizada, revogar EXECUTE das quatro RPCs de authenticated/PUBLIC, com nomes e assinaturas exatas, em operação revisada. Revogar API e retornar o frontend são ações independentes. A revogação não cancela automaticamente uma chamada já em andamento: conferir sessões administrativas antes de encerrar a manutenção.
6. Retornar frontend ao release anterior identificado/validado. Isso remove o acesso ao editor, **não restaura banco**.
7. Restaurar os três guards a partir de definições anteriores verificadas em `private.editorial_guard_backups` ou da cópia técnica prévia. Preservar a exceção A02 original. Manter helpers/tabelas privados e eventos/rascunhos. Não executar DROP CASCADE.
8. Manter `learning_validate_document`: o importador legado refatorado depende dele. Se for necessário restaurar o importador anterior, usar definição/ACL auditadas do preflight e testar inclusão v1/v2; não apagar o helper por suposição.
9. Falha dentro de salvar/publicar deve desfazer a transação inteira e preservar o rascunho anterior. Publicação concluída e depois utilizada por alunos **não pode ser revertida cegamente**. Patches não substituem versionamento pedagógico nem recuperam dados apagados em desastre.

Ensaio local proposto separadamente: em um cluster sintético, aplicar com falha antes do COMMIT e conferir ausência de efeitos parciais; depois aplicar normalmente, salvar rascunho, desativar RPCs/restaurar guards e provar que inclusão legada ainda funciona e que rascunhos/eventos permanecem. Não há ensaio sobre produção nem restauração de backup real nesta proposta.

## 12. Limitações e recomendação

**Não apta para implantação nesta data.** Bloqueios objetivos: servidor PostgreSQL real ainda indisponível; RAM livre insuficiente; autorização de preparação portátil pendente; concorrência/volume/segurança real ainda não executados; preflight remoto posterior pendente; ausência de recuperação de produção comprovada.

Menor ação: aprovar a proposta portátil e liberar recursos para o teste nativo. Não é necessário contratar infraestrutura ou iniciar Supabase completo. A dívida antiga de lint, por si só, não fundamenta este bloqueio; a falta da homologação real fundamenta.

## 13. Preparação E2a

O bloqueio de edição em atividade com apresentação vinculada permanece. Ajustes indispensáveis ao futuro coordenador:

1. Exportar kit com UUID/contexto/key, contrato existente e estado de origem; nunca inventar identidade ou URL final.
2. Validar com segurança o ZIP externo e manifesto, reutilizar `validateLessonImport`/validação SQL e o parser atual dos ZIPs web. Manter materiais Drive externos.
3. Preparar versões/imagens privadas pelo pipeline web existente, fora de locks SQL de publicação. Upload Storage não participa do rollback PostgreSQL.
4. Persistir operação, digests/idempotência e intenções de vínculo privadas, com estados retomáveis e confirmação dos arquivos preparados.
5. Salvar rascunho comum só com conjunto consistente. O snapshot atual inclui apresentações/vínculos: preparação intencional de versões pode invalidar o token. O coordenador terá de revalidar/reconciliar essa mudança controlada, sem ignorar alterações concorrentes na aula.
6. Separar preparo de commit. Evoluir a função interna de publicação para validar intenções e compor ativação de versões, vínculos e atividades numa única transação PostgreSQL autorizada. Chamar os botões/RPCs atuais sequencialmente pelo cliente não oferece atomicidade desse conjunto.
7. Não remover o bloqueio geral de vínculos. Abrir apenas o caminho coordenado, com correspondência exata de atividade/apresentação/versões esperadas, permissão administrativa e ausência de histórico.
8. Falha antes do commit mantém publicado anterior; recursos preparados seguem privados e recuperáveis. Mesma produção/hash retorna operação existente; productionId com conteúdo diferente é conflito. Limpeza não apaga publicados, histórico ou objetos sem prova de pertencimento.

Nenhuma dessas funcionalidades E2a foi implementada nesta rodada. A fundação não precisa receber um coordenador parcial antes de medir seus locks e homologar sua operação atual.

## 14. Checklist de implantação futura

- [ ] Preparação portátil autorizada e RAM suficiente.
- [ ] PostgreSQL 17 real, conexões independentes e evidência A–F.
- [ ] Três perfis de volume, crescimento de auditoria e limite Unicode/bytes esclarecido.
- [ ] Segurança real, admin inativo incluído, e regressões sem efeitos em histórico/XP.
- [ ] Ensaio local de instalação interrompida/desativação/retomada.
- [ ] Build aprovado e nenhum diagnóstico novo de lint.
- [ ] Preflight remoto somente leitura concluído; release/divergências/regras Vercel verificadas.
- [ ] Plano de recuperação vigente e risco aprovados especificamente para E1a.
- [ ] Hash final aprovado; instalar somente a migration necessária e registrar versão efetiva.
- [ ] Nova autorização explícita para migration, frontend e eventuais operações remotas.

Nenhum item pendente é considerado atendido pelo simples fato de os testes PGlite anteriores terem passado. Não houve migração, instalação, recuperação, alteração de produção, push, merge ou deploy nesta rodada.

## 15. Continuação autorizada — 15/11/2026

Executado apenas o preparo portátil. Windows identificado: **Windows 11 Home Single Language, 64 bits**. Conferidos novamente checkout e hash da migration E1a; nenhum código ou SQL foi alterado. A autorização não foi interpretada como autorização de produção.

O ZIP oficial EDB, file ID `1260667`, contém PostgreSQL **17.12**. São 386.263.884 bytes; SHA-256 `a2cd8a774389347b70be7748ac4a37ef43cb6ee539c5fc3e85ae264b15e4a04c`, comparado e coincidente com o checksum obtido diretamente do fornecedor por HTTPS. Somente `bin`, `lib` e `share` foram extraídos: 143.281.796 bytes, 1.600 entradas, na pasta dedicada fora do Git. As consultas de versão de `postgres`, `pg_ctl`, `psql` e `initdb` passaram sem instalar dependências de sistema.

A pasta de preparação tem ACL restrita à conta atual e SYSTEM. Templates de configuração de loopback/SCRAM e orçamento conservador foram gravados como evidência, **não aplicados a cluster**. O registro completo de preparação está em `D:\Documentos\Bitaria\HomologacaoEditorial\evidencias\preparacao-20261115.json`. Não há senha criada nem dados reais.

RAM livre medida nesta continuação: **0,76 GiB** inicialmente, **0,84 GiB** depois da extração e **0,95 GiB** na última leitura registrada. O requisito autorizado é **2 GiB livres** para iniciar. Portanto, `initdb`, `pg_ctl start`, conexões SQL, aplicação das fixtures/migration local, cenários A–F, benchmarks, testes de recuperação e preflight remoto **não foram executados**. Não houve encerramento de aplicativos, alteração de swap, WSL, rede ou configurações globais.

Os testes efetivamente executados nesta continuação foram integridade/procedência do pacote, validação de caminhos de extração, quatro consultas de versão e verificação da ACL local. Não são testes de homologação do servidor PostgreSQL e não alteram a recomendação de implantação.

Próxima ação mínima: liberar RAM e repetir a medição. A autorização de preparo/inicialização/testes sintéticos já existe; não precisa ser solicitada novamente. Se ainda faltar memória, permanecer parado. Migrations, push, merge e deploy em produção seguem sem autorização.

## 16. Redirecionamento de prioridade — E2a, 15–16/11/2026

A usuária adiou a homologação PostgreSQL real para uma rodada integrada **depois da implementação local E2a**. A base local E1a está aprovada para esse desenvolvimento, sem ser declarada homologada em produção. O PostgreSQL portátil não foi iniciado na tarefa E2a e sua preparação não foi retomada.

O relatório funcional está em [importador-unificado-e2a.md](importador-unificado-e2a.md). Consolidar a matriz A–F com as novas reservas, retomada e publicação coordenada, limites de ZIPs aninhados, memória da Edge, RLS/Storage, crescimento de operações e recuperação de falhas. Executar somente quando houver recursos suficientes e autorização aplicável. A nova decisão não autoriza migrations, deploy, push, merge ou importação de conteúdos reais.
