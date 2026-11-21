# Decisão de implantação E1a + E2a — 20/11/2026

**Apta com ressalvas na homologação local integrada. Implantação em produção ainda condicionada aos itens abaixo; nenhuma implantação foi executada ou autorizada nesta rodada.** Este documento substitui a decisão técnica de 17/11 para os pontos de homologação local, memória e UTF-8. O preflight remoto daquela data permanece apenas histórico.

## Resultado comprovado

PostgreSQL portátil **17.12**, reutilizado de `D:\Documentos\Bitaria\HomologacaoEditorial`, sem download, instalação, Docker, Rancher ou WSL. Dados exclusivamente sintéticos, listener `127.0.0.1:55439`, autenticação SCRAM e configuração econômica: shared_buffers 32 MB, work_mem 1 MB, maintenance_work_mem 32 MB, até 12 conexões; fsync/full_page_writes/synchronous_commit mantidos. A autorização posterior flexibilizou os 2 GiB. A execução final começou com 1,57 GiB livres; o menor valor registrado nas barreiras foi 1,47 GiB (não é medição contínua do mínimo). Nenhuma configuração global do Windows ou aplicativo do usuário foi alterado.

**17 cenários principais e 2 verificações finais aprovados**, com 16 PIDs distintos nas sessões de concorrência. Nenhuma suíte PGlite foi repetida. O adaptador executou as migrations e RPCs reais por conexões psql independentes.

| Verificação | Resultado |
|---|---|
| Migrations E1a/E2a e falha tardia de DDL E1a | Aplicação integrada e rollback aprovados |
| ZIP completo sintético | 12.382 bytes; 9 atividades, 8 tipos, 2 apresentações; recursos Drive fictícios |
| Interrupção de upload e retomada | Operação privada persistida; mesmo ZIP retomado até ready |
| Falha tardia na publicação | Sem atividades parciais, vínculos parciais ou permits residuais |
| Publicação natural do pacote | **260,85 ms** na execução final; reenvio/publicação idempotentes |
| Leitura de outra aula durante publicação | Espera de lock observada, leitura retomada após COMMIT |
| Aluno antes/depois da publicação | Histórico confirmado impede publicação; início posterior aguarda e utiliza estado final |
| Sessão docente antes/depois da publicação | Histórico protegido; sessão posterior fixa revisão final |
| Dois administradores | Rascunho obsoleto recusado; publicação concorrente idempotente, sem duplicação |
| Timeout real | SQLSTATE 55P03 após **5.015,97 ms**; rollback e retomada aprovados |
| Segurança | Aluno/professor/anônimo/inativo recusados; rascunhos e permits privados; falsificação negada; gabaritos não expostos ao aluno |
| ACLs e auditoria | 7 RPCs conferidas, anon sem EXECUTE, authenticated autorizado; owner/search_path registrados; RLS e privilégios privados conferidos; admin inativo negado; eventos imutáveis |
| Conexão realmente interrompida | Backend sintético encerrado durante transação; alteração revertida e locks liberados |
| Compatibilidade | Reconciliação A02, importador JSON v1, importador ZIP web, publicação e vínculo legados aprovados |
| Histórico | Comparação dos eventos XP, progresso e tentativas anteriores permaneceu igual |
| UTF-8 | Contagem JS = octet_length(jsonb::text) para Unicode/escapes e 1.999.999 / 2.000.000 / 2.000.001 bytes; excedente recusado pelo SQL |
| Build e lint dirigido | `npm run build` aprovado; ESLint de learningContent.ts e EditorialLessonEditor.tsx aprovado |

## Capacidade e impacto dos locks

Documento válido com **200 atividades**, **1.664.210 bytes no arquivo / 1.668.836 bytes normalizados**, texto acentuado. Validação cliente: **28,54 ms**; comparação: **21.080,46 ms**; salvar: **19.598,51 ms**; publicar: **19.936,06 ms**. As atividades foram publicadas corretamente.

Isso comprova capacidade funcional local desse perfil, não latência aceitável para publicação durante uso pedagógico. E1a mantém ACCESS EXCLUSIVE em tabelas inteiras; leitores de outras aulas podem aguardar. Os tempos acima são duração de chamada, não timestamps exatos de retenção de cada lock. A concorrência foi provocada com barreiras e waits observados; esses períodos artificiais não foram usados como benchmark de publicação natural. O lock_timeout de cinco segundos limita cada aquisição, não a execução total.

**Ressalva operacional obrigatória:** publicar em janela sem alunos/sessões docentes e sem outras operações editoriais concorrentes. Para o perfil grande testado, não prometer interrupção máxima de cinco segundos. Não há novo teto de bytes ou atividades, nem flexibilização de locks/XP/histórico. O ZIP funcional contém decks pequenos sem imagens: não comprova o máximo de memória de ZIPs com imagens nem do runtime Edge hospedado. A capacidade de 200 atividades é do documento editorial, não de um ZIP de 200 atividades.

## Correção UTF-8 e hashes finais

A correção já preparada em 17/11 foi validada agora: cliente usa bytes da representação normalizada e servidor usa `octet_length`, preservando o teto de **2.000.000 bytes**. Nesta rodada não se alteraram código de produção ou migrations; os ajustes adicionais foram somente nas fixtures/automação de homologação. Contratos, histórico, XP e proteções de concorrência preservados.

| Migration | SHA-256 final conferido |
|---|---|
| `20261112220958_editorial_foundation.sql` | `8bab8c53d0f7b1f6648193fe318b2378b4c0c94c00b17a2af47ceac0c3da3fdf` |
| `20261115234003_unified_lesson_packages.sql` | `12c05d50527f36099b8a11cb5e3048d5d1100f70e9dd1f98bc960bf586bfff64` |

O hash E1a antigo `a990cf…` está superado e não deve ser usado em autorização futura.

## Condições reais que restam para implantação

1. **Janela de publicação definida e compatível com os locks globais**, sobretudo para documentos grandes. A publicação concorrente é segura nos cenários testados, mas pode bloquear o uso de outras aulas.
2. **Preflight do destino e da entrega:** confirmar Git/Production Vercel, ambiente Supabase do frontend e mecanismo de release isolado; revalidar metadata/migrations/ACLs imediatamente antes de qualquer escrita autorizada. As lacunas documentadas em 17/11 não foram verificadas remotamente nesta rodada local. O transporte real Auth/Storage e o runtime Edge hospedado não foram homologados por estes testes locais; fixtures substituem esses transportes.
3. **Recuperação da implantação em produção definida e aceita especificamente para E1a/E2a.** Rollback SQL, perda de conexão e retomada de pacote estão comprovados localmente; isso não é restauração de backup real nem validação do executor de migrations em produção. Preservar rascunhos, eventos, arquivos privados, reservas e definições anteriores dos guards; retorno de frontend não desfaz COMMIT de banco.

Memória, concorrência local e inconsistência UTF-8 deixaram de ser bloqueios desta homologação. Não restou defeito funcional comprovado que exija nova etapa de desenvolvimento. Build emite avisos de tamanho de chunks/Browserslist, sem erro de compilação; não foram ampliados para refatoração fora do escopo.

## Evidências e encerramento

Pasta preservada: `D:\Documentos\Bitaria\HomologacaoEditorial\evidencias`.

- `preparacao-20261115.json`: procedência e preparo reutilizados.
- `homologacao-integrada-2026-11-20T03-39-17-607Z.json`: 17 cenários, tempos, waits, PIDs e encerramento controlado.
- `verificacoes-finais-20261120.json`: ACLs e perda real de conexão; encerramento controlado.
- As tentativas anteriores e seus erros também permanecem preservados; não substituem a execução final aprovada.

As primeiras tentativas identificaram defeitos apenas na automação ainda não executada: terminadores SQL, papéis globais reutilizados entre bancos, ordenação de snapshot XP, cenário que tentava editar apresentação vinculada, limpeza de conexão fechada e cálculo da amostra UTF-8. Corrigidos nas fixtures, sem remover a proteção que recusou a edição vinculada. Uma tentativa ficou com processo Node residual; o processo específico da nossa automação foi encerrado após identificação por PID/comando/horário. Nenhum aplicativo do usuário foi encerrado.

**PostgreSQL encerrado de forma controlada nas execuções finais; consulta do Windows confirmou ausência de postgres.exe.** RAM final: 7,84 GiB totais / 2,81 GiB disponíveis. Arquivos, bancos sintéticos, logs e evidências preservados. Sem migrations em produção, consultas de dados reais de alunos, commit, push, merge ou deploy. Homologação indispensável encerrada; nenhuma nova etapa de desenvolvimento iniciada.
