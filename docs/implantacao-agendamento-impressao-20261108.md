# Implantação controlada — agendamento e impressão

Data: **08/11/2026**, America/Bahia. Escopo autorizado: commits, integração/push e aplicação das pendências das melhorias de Meet fixo, avaliação individual e relatório de aulas. O gerenciador de apresentações, backup e AWS não fazem parte desta implantação.

## Código e destino

- Implementação registrada no commit `67ff94e`: preferência de Meet no vínculo professora–aluno, exceção por aula, impressão de avaliações e PDF compacto.
- Branch: `main`; as branches de apresentações já são ancestrais dela, sem necessidade de outro merge.
- Supabase: **codePlatform**, ref `gnyiyhnbpjhdgrhsevbh`.
- Vercel: equipe `andrea-francas-projects`, projeto `plataforma-ensino` (`prj_2vX60y3APQN45VaxtdvKHm7c89FT`).
- Domínio de produção: https://plataforma-ensino-chi.vercel.app . O push da main é o mecanismo de publicação do frontend; seu resultado deve ser conferido pelo SHA e estado READY depois do envio.
- Deployment anterior confirmado como candidato de recuperação: `dpl_HvaDa2w3JxtET6CWYLu7hw8VtiWJ`, SHA `cad40b863402c18982851c151afb96c0c621fdb2`.

## Conferência antes da aplicação

Foram consultados schema, políticas, grants, triggers, índices, migrations e versões de funções. O destino tinha 6 perfis, 5 avaliações, 5 vínculos e 482 aulas agendadas/históricas. Só foram obtidas contagens e fingerprints agregados para preservação, sem exportar registros pessoais.

A coluna `default_meet_link` e a RPC do padrão ainda não existiam. Também faltava `scheduled_lessons.scheduling_request_id`, já referenciada nas funções locais integradas à main. Aplicar o frontend e essas funções sem esse pré-requisito causaria falha no agendamento.

A migration histórica `20261022170836_improvements_scheduling.sql` contém outras alterações, incluindo acesso à sala e proteção adicional de conflito. Ela **não foi aplicada integralmente**: foi criado um pré-requisito restrito à coluna de idempotência e ao índice. Não houve push geral de migrations nem alteração das regras de presença, XP ou cobrança.

## Migrations aplicadas

| Versão registrada no Supabase | Arquivo local definitivo | Aplicação |
|---|---|---|
| `20261108210544` | [scheduling_request_prerequisite](../supabase/migrations/20261108210544_scheduling_request_prerequisite.sql) | Coluna UUID nullable e índice único por professora/request/ocorrência, somente para requests não nulos. |
| `20261108210555` | [student_meet_preferences](../supabase/migrations/20261108210555_student_meet_preferences.sql) | Campo nullable no vínculo, RPC restrita e leitura administrativa; nenhum backfill. |

O conector atribuiu os timestamps ao executar cada migration. Os arquivos inicialmente preparados como `20261108210159_scheduling_request_prerequisite.sql` e `20261107135452_student_meet_preferences.sql` foram renomeados para esses identificadores, mantendo o SQL aplicado e atualizando os testes/referências. Não se alterou artificialmente o histórico remoto.

Verificação posterior: contagens e fingerprints de perfis, avaliações, aulas e vínculos permaneceram **iguais**, desconsiderando apenas as colunas nullable recém-adicionadas. Todos os padrões/request IDs existentes continuaram nulos. A RPC existe; `anon` não possui EXECUTE e `authenticated` possui, sujeito à verificação de usuário ativo e vínculo implementada no servidor.

## Funções implantadas

Todas estão **ACTIVE** e mantêm `verify_jwt=true`.

| Função | Versão anterior | Versão implantada |
|---|---:|---:|
| `google-calendar-sync` | 10 | 11 |
| `create-platform-lesson` | 9 | 10 |
| `confirm-platform-lesson` | 11 | 12 |
| `book-platform-lesson` | 10 | 11 |
| `reschedule-platform-lesson` | 6 | 7 |
| `update-lesson-meet` | Ausente | 1 |

A sincronização foi implantada primeiro para reconhecer `bitariaMeetLink`. Depois vieram criação, confirmação, reserva, reagendamento e edição individual. O pacote enviado incluiu os helpers relativos e o lockfile Deno, sem credenciais no código.

Foi preservada uma cópia **de código** das versões anteriores em `tmp/release-20261108/previous-edge-code.json`, ignorada pelo Git. Isso é material de recuperação do código, não backup de dados ou comprovação de restauração do banco.

## Validação

- Deno **2.9.6**: check das seis funções passou. Foi corrigida uma declaração duplicada de `meetLink` no tipo de entrada da criação; nenhuma alteração de comportamento adicional foi necessária para esse erro de tipos.
- `npm.cmd run test:scheduling-print`: **28 testes passaram**, incluindo o pré-requisito adicional, os handlers de agendamento, migração/RPC/RLS isolados, regressões Calendar/avaliação e PDFs.
- Após alinhar os nomes das migrations ao histórico remoto, os **7 testes de agendamento** passaram novamente.
- Os **2 cenários de navegador** da entrega local de 07/11 passaram: seleção do padrão, impressão privada e download de PDF. O frontend não recebeu alteração funcional desde essa homologação.
- Build TypeScript/Vite passou. Permanecem avisos preexistentes de Browserslist e bundles grandes.
- PDFs sintéticos: 10 aulas, resumo e valores em uma página A4; avaliação comum em uma página, comentário excepcional integral em quatro páginas.
- Verificação HTTP no destino real com chave pública anônima: as seis funções recusaram a chamada sem usuário (400, após verificação de autenticação); a RPC recusou com 401. Nenhuma chamada criou aula ou acessou o Google Calendar.

As evidências locais adicionais ficam em `tmp/release-20261108/anonymous-checks.json` e nos PDFs descritos no [relatório da implementação](agendamento-avaliacao-impressao-20261107.md). Resultados locais e respostas anônimas não são apresentados como homologação positiva de uma conta real no Google.

## Publicação e verificação posterior ao push

1. Enviar somente os commits revisados à main, excluindo o marcador temporário `supabase/.temp/cli-latest` e os artefatos locais.
2. Confirmar deployment READY com o SHA do push e o domínio HTTPS real. Conferir HTML e assets correspondentes ao build, evitando confundir a versão anterior em cache com a nova.
3. Manter o gerenciador de apresentações e suas migrations fora do escopo; não fazer importação curricular ou edição de atividades reais.

## Única homologação operacional ainda necessária

O ciclo positivo com OAuth/Google Calendar real deve ser feito em **agenda exclusiva de teste e com identidades sintéticas**, escolhidas pelo responsável. Nesta operação não foram criados alunos fictícios em produção, eventos ou convites reais, nem alterados links históricos. A preferência real continua vazia até ser configurada por um usuário autorizado.

Nesse teste, conferir criação com/sem padrão, recorrência, exceção, mudança do padrão, reagendamento, alteração individual com confirmação, convites e permissões Google. A sala fixa é informada como localização/URL; não se promete um novo botão nativo de conferência. A validade/acesso ao Meet continuam sob controle do Google.

## Recuperação

Se o frontend apresentar problema, usar o deployment anterior indicado, revalidando sua elegibilidade. Se uma função apresentar problema, reimplantar seu código anterior preservado, com JWT obrigatório. Manter as colunas aditivas e as preferências enquanto houver código que as utilize; não remover relações, avaliações ou aulas. Falha parcial entre Google e banco exige reconciliação do evento específico, sem reimportação indiscriminada.

Nenhuma contratação, exportação pessoal, alteração de XP/progresso/currículo ou instalação do gerenciador de apresentações foi executada. A autorização atual não foi estendida a essas operações.
