# Entrega do pacote de correções e melhorias

Referência: `docs/prompts/Pacote de correçoes e melhorias.md`, versão 2. Implementação local em 22/10/2026, incluindo upload e links de ícones solicitados posteriormente.

## Fase 1 — Agendamento e financeiro

- Recorrência por múltiplos dias, contagem total de encontros, data final opcional e calendário no fuso da professora. Mantido o modo de um dia por semana. Pedidos têm identificador estável; ocorrências têm índice único e proteção de sobreposição no banco. Eventos Google usam identificador determinístico para repetição segura.
- Aluno pode entrar de cinco minutos antes até quinze minutos depois do início. O servidor verifica a mesma janela. O relógio da interface atualiza a disponibilidade; passado o prazo, o registro continua no histórico, sem concluir ou cancelar a aula automaticamente.
- Pacotes mostram a modalidade cadastrada (`Curso` ou `Mentoria`) antes do nome, mantendo seus IDs.
- Selecionar desconto mostra valor original, regra, desconto e valor previsto, sem gravar. O botão Aplicar mantém a confirmação explícita; as regras financeiras existentes no servidor continuam responsáveis pelo cálculo final.

Arquivos principais: `TeacherScheduling.tsx`, `StudentLessons.tsx`, `LessonRoom.tsx`, `lessonAccess.ts`, `useLessonClock.ts`, `StudentBillingPanel.tsx`, `StudentDiscountPanel.tsx`, `TeacherReports.tsx`, funções `create-platform-lesson`, `confirm-platform-lesson`, `_shared/recurrence.ts` e `_shared/google-calendar.ts`.

Migração: `20261022170836_improvements_scheduling.sql`.

## Fase 2 — Menus, catálogos e dashboards

- Nova rota administrativa `/conquistas` com quatro abas: Conquistas, Tecnologias, Missões e Maestrias.
- Manutenção de conquistas existentes sem cadastro arbitrário pela interface; inserção direta de definições também bloqueada para clientes autenticados. Tecnologias geram suas três medalhas controladas, preservando identificadores e desbloqueios.
- Seletor compartilhado com emojis, link HTTPS e upload de PNG/JPEG/WebP de até 2 MB. Prévia e exibição das imagens nos catálogos e nas medalhas do aluno; falha de imagem tem substituto. URLs não são interpretadas como HTML. O envio bloqueia o salvamento até terminar e só altera o cadastro após confirmação.
- Bucket público `catalog-icons`: leitura das imagens, envio somente por administrador ativo em pasta própria, nomes UUID e sem sobrescrita. Imagens já enviadas não são apagadas ao cancelar uma edição, para evitar remoção de referências existentes; eventual limpeza de arquivos sem referência exige operação própria.
- Ranking administrativo em Meus Alunos; ranking do aluno ao fim de Minha Jornada. Saudação antes de Minhas Conquistas. Nova rota `/minhas-maestrias` reúne maestrias e missões retiradas do perfil. Texto NÍVEL DO DEV sem mudança na fórmula.

Arquivos principais: `App.tsx`, navbars, `TabGamification.tsx`, `AchievementCatalog.tsx`, `TechnologyCatalog.tsx`, `MissionCenter.tsx`, `IconPicker.tsx`, `CatalogIcon.tsx`, `MasteryShowcase.tsx`, `MyMasteries.tsx`, `AchievementsManagement.tsx`, `Dashboard.tsx`, `TeacherDashboard.tsx`, `SystemManagement.tsx`, `ProfilePage.tsx`, `StudentAchievements.tsx` e `PlayerLevelCard.tsx`.

Migrações: `20261022171228_improvements_content_catalogs.sql` e `20261022202537_catalog_icon_images.sql`.

## Fase 3 — Conteúdo e projetos

- Novos questionários exigem pelo menos quatro perguntas no contrato e no backend. Conteúdos históricos permanecem legíveis.
- Percentual e aprovação são calculados no servidor; `passingScore` do conteúdo é preservado. Teste específico confirma 60% reprovado e 70% aprovado quando o limite configurado é 70. Gabaritos continuam privados.
- Projeto recebe link principal, descrição obrigatória e até dois links adicionais com descrição. URLs HTTPS, limites e formato são validados no servidor. Aluno e professora visualizam os metadados, mantidos em versões imutáveis durante avaliações. Chamadas antigas de quatro argumentos permanecem compatíveis; descrições antigas podem estar vazias.
- Reenvio não repete XP; alteração de nota ajusta o crédito de avaliação, preservando auditoria.

Arquivos principais: contratos JSON v1/v2, `ProjectSubmissionForm.tsx`, `ProjectReviewPanel.tsx`, `ActivityRenderer.tsx` e `types/learning.ts`. RPC `submit_student_project` mantém quatro argumentos originais e acrescenta dois opcionais.

**Lacuna curricular documentada:** a auditoria do repositório não encontrou um fluxo legado de questionário por submódulo com espera de 24 horas, reset após segunda reprovação e revisão antes da terceira tentativa. Os questionários existentes pertencem a atividades de aula, com `passingScore`, `maxAttempts` e histórico. Conforme a seção 14 da especificação, não foi inventada essa política nem alterado arbitrariamente o JSON v2 homologado. Os testes de espera/reset do legado não se aplicam a um fluxo inexistente. Sua criação depende de especificação curricular própria, inclusive de quais materiais devem ser revisados e de como comprovar a revisão.

## Fase 4 — Recompensas oficiais

- Reutilizado o livro de eventos de XP. Regras oficiais e política da primeira tentativa estão descritas em `docs/regras-xp-v1.md`; recibos históricos mantêm os valores concedidos.
- Perfil Exemplar: 30 XP; GitHub e LinkedIn: 30 XP; Instagram: 10 XP, uma única vez. Campos obrigatórios atuais: `full_name`, conforme cadastro existente. A lista fica na configuração privada `achievement_settings`; não foram inventadas novas exigências pessoais.
- Conquistas de envio, avaliação e tentativa concluída de quiz reconhecem o evento sem XP adicional. A aprovação curricular é independente da conquista de conclusão da tentativa.
- Logins efetivos são capturados na inserção de `auth.sessions`. Atualização da sessão, refresh e chamadas internas não criam eventos. Alunos não escrevem contadores, períodos ou recibos. Contas conhecidas de funcionários e inativas são ignoradas.
- Dedicação Total: oito logins/mês, 50 XP por mês fechado; bônus de 120 a cada bloco de 12 meses elegíveis. Super Engajado: dois logins/semana, 20 XP por semana fechada; bônus de 50 a cada bloco de 12 semanas elegíveis. Blocos não exigem consecutividade.
- Fuso America/Bahia; semana de domingo a sábado. Jobs aos domingos e no primeiro dia do mês, 00h05 local (03h05 UTC). Ambos recuperam períodos fechados pendentes; recibos e provas por período impedem duplicações mesmo em reexecução.
- Não se inferem logins anteriores à instalação: a captura começa com a migração.

Migrações: `20261022042042_official_xp_rules_v1.sql` e `20261022171552_improvements_official_achievements.sql`. Agenda: `supabase/schedules/official_achievements.sql`.

## Validação e limites

Resultado final: **163 testes automatizados de regressão aprovados**, incluindo banco, financeiro, calendário, histórico, contratos, XP e as novas regras do pacote. **Quatro testes de navegador aprovados** na bateria do pacote: Aula 01, catálogos/ícones (link e upload), prévia financeira/modalidades e envio/avaliação/reenvio de projetos. Também passaram os três fluxos existentes de navegador de aprendizagem, atividades interativas e ambiente da professora. Compilação TypeScript/Vite e ESLint dos componentes novos e dos catálogos alterados aprovados. Evidências mobile inspecionadas visualmente.

Os testes de período verificam a virada do mês e do domingo em America/Bahia, impedindo concessão antecipada. Testes de Storage verificam pasta própria, perfil ativo administrativo, formatos e limite configurados; o navegador verifica rejeição de SVG, upload de PNG, link externo, prévia e persistência no cadastro.

Comandos reproduzíveis:

```powershell
npm.cmd run build
npm.cmd run test:learning
npm.cmd run test:improvements
npm.cmd run test:improvements:browser
```

Testes SQL executam as migrações e RPCs em PostgreSQL local via PGlite, com identidades e RLS. Auth sessions, Storage e registro de cron possuem estruturas simuladas: validam captura, políticas e idempotência, mas não substituem a integração com os serviços remotos. Navegador usa componentes reais, RPCs locais para aprendizagem/projetos e adaptadores HTTP controlados para catálogos, upload e financeiro. Não usa credenciais de produção. Testes de calendário validam planejamento/fuso, unicidade e regras de acesso; chamadas externas ao Google não são feitas.

Evidências locais em `test-results/`: `improvements-icon-upload.png`, `improvements-catalog-mobile.png`, `improvements-finance-mobile.png`, `official-xp-review-desktop.png` e `official-xp-review-mobile.png`.

## Ativação e compatibilidade

O pacote completo ainda não foi publicado. As ativações isoladas dos ícones e da correção de sincronização da agenda foram posteriormente autorizadas e aplicadas no `codePlatform`, conforme registros abaixo. Para as demais mudanças, aplicar primeiro em um projeto de teste autorizado, preservando a ordem dos arquivos. Banco e Edge Functions precisam estar atualizados antes do frontend usar os novos campos. Publicar as funções de criação/confirmação com o helper de recorrência.

Se `pg_cron` estiver habilitado, a migração registra os dois jobs por nome; se não estiver, emite aviso. Após habilitar Cron no ambiente escolhido, executar `supabase/schedules/official_achievements.sql` e verificar `cron.job` e `cron.job_run_details`. Conferir também login real, upload real e Google Calendar nesse projeto de teste antes de promover. A captura em `auth.sessions` e a criação dos jobs exigem privilégios administrativos de migração.

Migrações são aditivas e preservam dados e recibos. Não executar reversão destrutiva após novas entregas/recompensas: manter frontend anterior compatível quando necessário e aplicar correção adiante. O suporte antigo de envio de projeto mantém os quatro argumentos; clientes novos exigem a migração de seis argumentos.

Referências usadas na auditoria: [sessões Supabase](https://supabase.com/docs/guides/auth/sessions) e [agendamentos Supabase Cron](https://supabase.com/docs/guides/cron/quickstart).

## Diagnóstico do upload no projeto configurado

Consulta somente de leitura ao projeto `codePlatform` (`gnyiyhnbpjhdgrhsevbh`) confirmou bucket `catalog-icons`, coluna `technologies.icon` e função `private.learning_role()` ausentes. Portanto, o teste local com adaptador HTTP aprovado anteriormente não representava uma ativação remota do upload.

Preparado `supabase/setup/activate_catalog_icons.sql` para ativar apenas os ícones: colunas em tecnologias/missões, permissões de edição para administrador ativo, bucket e políticas de upload/leitura. Não instala XP, Auth ou Cron. Testado duas vezes consecutivas para garantir repetibilidade, com envio administrativo permitido e envio/alteração por aluno bloqueados. A migração completa de catálogos foi ajustada para aceitar as colunas previamente criadas pelo script.

**Ativação concluída em 22/10/2026**, após autorização explícita “sim, pode criar e aplicar”. Script aplicado via migração `activate_catalog_icons` no projeto `codePlatform`. Bucket público confirmado com PNG/JPEG/WebP e limite de 2 MB; colunas e políticas confirmadas. Incluídas permissões dos campos que o editor envia junto com o ícone, tanto em tecnologias como em conquistas. Verificação transacional remota confirmou INSERT de objeto por administrador, UPDATE dos campos de tecnologia e conquista e recusa de envio/edição por aluno; todos os registros dessa verificação foram revertidos. Isso verifica a configuração e as políticas do servidor, sem representar envio de um arquivo real pelo navegador da pessoa usuária. Outras ativações pendentes não foram autorizadas nem executadas por essa aprovação.

A interface agora distingue bucket ausente de falta de permissão, aceita arquivos PNG/JPEG/WebP cujo sistema não informou MIME e mantém o ícone anterior se o envio falhar. A tabela de tecnologias alinha imagem/emoji e nome lado a lado, com emoji padrão para registros antigos. Compilação, 14 testes de banco/helpers e o fluxo de navegador de ícones aprovados após a correção.

## Correção do bloqueio financeiro na sincronização do Google

O trigger remoto `private.billing_booking_guard()` foi inspecionado em consulta de leitura: aplicava a verificação de saldo a qualquer inserção de aula agendada com aluno, inclusive a importação de eventos já existentes no Google. Isso explica a mensagem financeira exibida ao administrador durante a sincronização, sem significar que o administrador precisa comprar créditos.

Migração preparada: `20261022204126_separate_calendar_import_from_booking.sql`. Nova RPC `import_google_calendar_lessons(uuid,jsonb)`, executável somente por `service_role`, valida professora e origem dos registros e habilita uma exceção transacional apenas durante a importação. O contexto é restaurado após sucesso ou erro. O trigger mantém a verificação de saldo para reservas normais, inclusive quando um cliente autenticado tenta forjar o contexto. A função `google-calendar-sync` passa a usar essa RPC em vez de upsert direto.

Validação: oito testes aprovados em `calendar-import-billing.test.mjs`, `google-calendar-sync.test.mjs` e `billing.test.mjs`: importação sem crédito, repetição idempotente, preservação das restrições de reserva, acesso indevido recusado, manutenção de alunos vinculados e cancelamentos. Não é necessário instalar o restante do pacote para essa correção.

**Publicação autorizada e concluída em 22/10/2026:** migração `separate_calendar_import_from_booking` aplicada; `google-calendar-sync` publicada na versão 10, ativa, com verificação de JWT preservada. A publicação partiu dos arquivos da versão remota 9, alterando apenas a chamada de importação, para preservar os demais comportamentos implantados. Confirmados privilégio de execução exclusivo do serviço e uso da nova RPC pela função. Teste transacional no banco remoto confirmou importação, repetição sem duplicação e restauração do contexto; os registros de teste foram revertidos. Não havia aluno ativo com saldo bloqueado no snapshot remoto naquele momento; o cenário de saldo zero foi validado nos testes locais. A sincronização completa com a conta Google exige nova tentativa autenticada na interface; o erro anterior permanece registrado até uma sincronização bem-sucedida. Nenhuma alteração remota foi realizada sem autorização.

## Desconto avulso em Financeiro → Cobranças

Cada cobrança agora oferece “Aplicar desconto nesta cobrança”, com descontos cadastrados, desconto avulso em reais ou sem desconto. O valor avulso não exige criar um item no catálogo. A prévia mostra bruto, desconto, líquido e saldo após pagamentos; somente o botão Aplicar grava. A escolha substitui o desconto daquela cobrança, sem acumular com descontos mensais/contínuos e sem alterar outras competências.

Arquivos: `InvoiceDiscountForm.tsx`, `StudentBillingPanel.tsx`, `lib/billing.ts`; migração `20261022205021_invoice_ad_hoc_discounts.sql`. A RPC `apply_invoice_discount` exige administrador ativo, valida casas decimais, valores finitos e limite bruto menos pagamentos, copia os valores do catálogo no servidor e registra histórico de alterações com identificador idempotente. Nenhum cálculo enviado pelo cliente é aceito como total final. O recálculo financeiro preserva a escolha da cobrança; alterações futuras no catálogo não modificam o desconto já aplicado. Regras de crédito e pagamento existentes são reutilizadas.

Teste de banco `tests/invoice-discounts.test.mjs` executa as migrações financeiras reais localmente e verifica desconto avulso/cadastrado, persistência após atualização, repetição, auditoria, limites de pagamentos e bloqueio de alunos. A compilação completa foi aprovada. Teste de interface em `tests/improvements-browser.test.mjs` cobre prévia sem gravação, validação de limite, confirmação e responsividade. Ativação no banco remoto depende da autorização ainda pendente; não foi aplicada nenhuma migração remota.
