# Revisão dos bloqueios e proposta de release — 31/10/2026

Atualização de backup em 01/11/2026: plano Free confirmado e procedimento econômico proposto em [Backup e recuperação](plano-backup-recuperacao-20261101.md). Nenhuma ferramenta instalada ou dado privado exportado; recuperação continua pendente de autorização e ensaio.

Este é o estado atual, substituindo conclusões temporais contraditórias do relatório anterior. Nenhum push, merge, deploy, migration, importação, restauração ou alteração de produção foi executado nesta revisão.

## Checklist

| Item | Estado |
| --- | --- |
| Acesso Vercel | Resolvido; consultas autenticadas funcionam |
| Destino e commit publicado | Confirmados |
| Regras Git | Main/preview comprovados pelos deployments; switches completos ainda precisam de inspeção no painel |
| Backup recuperável | Pendente; nenhum ponto utilizável comprovado |
| Release isolado | Preparado como proposta local reproduzível |
| Testes do release | 71 testes, 3 cenários de navegador, build e Deno aprovados |
| Implantação | Aguardar backup comprovado, conferência das regras e nova autorização |

## Vercel

Equipe `andrea-francas-projects`, ID `team_alD3VRmLVIi0J3OsRZr7N7sv`. Projeto `plataforma-ensino`, ID `prj_2vX60y3APQN45VaxtdvKHm7c89FT`, Vite, Node configurado `24.x`.

- Domínio: https://plataforma-ensino-chi.vercel.app
- Alias consultado: deployment `dpl_5A8o7uMNwLZmnVPpXnSq7RWPWRrw`, READY, source git, target production, branch `main`, SHA `b01e64be708cf176d9897586d76c3235cc87a5be`.
- Recuperação após release futura: esse deployment atual foi listado como candidato de rollback. Anterior adicional: `dpl_8c1BEH3qLPvvrWBbczFfbh7zxYiK`, SHA `e1c44d2ca2e3d4e7252abb378d1f1c8bc2f674a0`, também candidato. Revalidar imediatamente antes da execução.
- Preview existente: `dpl_E8a2KKV4fBV5epHBRfnuKCwqMgqj`, branch `feat/biblioteca-visual-bitara`, SHA `8f96bf48af0f1115b6fb5cddf52924c548543fad`, READY, target null (preview).
- Preview: https://plataforma-ensino-5g85emhpx-andrea-francas-projects.vercel.app
- Projeto sem proteção de senha, SSO ou IP indicada. HTTP anônimo retornou 200 em produção e preview. Isso comprova acesso ao frontend, não acesso aos dados: Auth/RLS continuam necessários.
- No preview existente, `/apresentacoes/`, `/apresentacoes/index.html`, `/apresentacoes/viewer.js` e `/biblioteca-bitara/catalog.json` responderam corretamente, com os tipos esperados. Nenhum deployment novo foi criado.

Variáveis: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` aparecem apenas com target production. O valor da URL foi comparado sem exposição de segredos e corresponde a `gnyiyhnbpjhdgrhsevbh`. As demais variáveis Supabase/Postgres listadas também são de produção; nenhuma variável preview apareceu na resposta. Não presumir que novo preview funcionará nem copiar credenciais de produção para contornar a ausência. O frontend usa somente variáveis VITE; nunca atribuir esse prefixo a service_role, JWT secret ou senha Postgres.

Limitação: deployments comprovam main usada para produção e feature para preview. O conector resume get_project e não expõe `link.productionBranch` nem todos os switches/overrides de Git deployment e atribuição de domínio. A tentativa de consulta read-only pela CLI falhou por ausência de login local; o consentimento do conector não autentica a CLI. Não falta consentimento de equipe. Falta conferir **Settings → Environments/Production** (branch) e **Settings → Git** (deploy automático, regras por branch e ignored build command) antes do push. Não foi iniciado login nem alterada configuração. Até essa evidência, tratar push na main como potencial publicação imediata.

## Supabase: ponto restaurável e estratégia

Projeto `codePlatform`, ref `gnyiyhnbpjhdgrhsevbh`. Consulta atual: 18 aulas, 14 atividades, migration mais recente `20261028220751`, tabela `public.web_presentations` ausente; Storage contém somente `catalog-icons` público, 7 objetos.

A consulta de backups foi repetida:

```json
{"backups":null,"physical_backup_data":{},"pitr_enabled":false,"region":"us-west-2","walg_enabled":true}
```

Não há ponto utilizável comprovado nessa resposta. WAL-G habilitado não comprova retenção ou recuperação. Arquivos antigos em tmp/backups são recortes, não backup completo atual. A tentativa anterior de dump falhou por ausência de Docker/Podman; pg_dump/psql não estavam disponíveis. Não foi feita restauração em produção nem produzido backup completo nesta revisão.

Estratégia proposta, protegida e verificável:

1. Preparar máquina/runner protegido com PostgreSQL compatível com versão 17, Supabase CLI e destino Supabase isolado. Instalar Docker não prova recuperação. Provisionamento/custos dependem de aprovação.
2. Inventariar versões/extensões, schemas de aplicação public/private, dados necessários de Auth, metadados Storage, migrations, tabelas, funções, triggers, views, índices, sequences, owners, roles, grants/default privileges e RLS. Distinguir componentes gerenciados pela plataforma para restauração compatível. Configurações Auth/OAuth/Edge e referências a segredos ficam em cofre separado; dump não garante senhas de roles nem configuração externa.
3. Exportar dados/schema sob snapshot PostgreSQL consistente, único ou compartilhado entre etapas compatíveis. Roles/globais exigem captura separada e conferência de drift. Não chamar exports independentes em momentos arbitrários de snapshot atômico. Registrar instante, versão de ferramentas e hashes sem expor dados pessoais.
4. Copiar separadamente todos os binários Storage, com bucket/path, versão quando disponível, MIME, tamanho e SHA-256; guardar configuração dos buckets/políticas. Banco e Storage não têm snapshot conjunto: comparar inventário antes/depois, verificar hashes e repetir se houver mudança. Escrita contínua pode exigir janela coordenada aprovada; nenhuma escrita foi bloqueada nesta etapa.
5. Criptografar em trânsito/repouso, restringir acesso, separar chaves, manter cópia fora desta máquina e definir responsável, retenção e expurgo. Não salvar dados/segredos em Git, public, logs ou artifacts abertos.
6. Restaurar somente em destino isolado de versão compatível, com e-mails, webhooks, jobs e integrações externas desativados e sem apontar para produção. Restaurar roles/ACLs, banco e binários Storage na ordem suportada. Nunca sobrescrever indiscriminadamente os componentes internos do Supabase.
7. Comparar contagens exatas, checksums por tabela, integridade referencial, sequences, funções/triggers, owners/grants/default privileges/RLS e hashes de todos os objetos Storage. Testar admin, aluno autorizado, aluno externo, professor, inativo e anônimo, com negativos; conferir XP/progresso/histórico preservados.
8. Emitir evidência sanitizada com snapshot, hashes, destino isolado, resultado, tempo de recuperação medido e perda máxima observada. Só então classificar recuperável. SQL legível, hash e pg_restore --list validam arquivos, não recuperação; RPO/RTO seguem não comprovados até o ensaio.

Alternativa: backup gerenciado/PITR com ponto visível mais ensaio isolado e cópia separada do Storage. Alterar plano/add-on/projeto pode gerar custo e exige autorização; nada disso foi contratado. Fontes oficiais consultadas: [Backups Supabase](https://supabase.com/docs/guides/platform/backups) e [backup/restauração](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Backup SQL não inclui os binários Storage.

## Release preparado e dependências

Checkout: `tmp/release-web-presentations`, detached na base publicada `b01e64be708cf176d9897586d76c3235cc87a5be`. Arquivos selecionados de template/biblioteca/gerenciador foram restaurados nesse checkout, sem cherry-pick/merge. Removida a navegação herdada em studentLearning; ficou somente a integração das apresentações.

Patch binário: `tmp/release-web-presentations.patch`, aplicável sobre essa base, SHA-256 `d2903b2787c59d1cb6c63e25f3768793abb7e1d82c5f652d599134f1208f72a8`. Verificação reversa git apply --check passou. Manifesto: `tmp/release-web-presentations.manifest.json`, com tamanhos/hashes dos 102 arquivos do dist, patch, lockfile e migration.

Escopo: viewer existente, template, biblioteca Bitara completa (64 originais catalogados e derivados), parser ZIP, interface administrativa, rota gerenciada, integração opcional de leitura, Edge Function, migration única, testes e documentação. Sem novo viewer ou nova regra XP.

Excluídos: correção de títulos e sua migration/rollback/teste, navegação para próxima aula, administrativo da Aula 02 e os sete arquivos reais de deck/imagens em public. O pacote de referência A02 existe apenas em fixtures de teste, fora do dist. Verificada a ausência dos sete arquivos em public E dist. Originais não rastreados no workspace principal preservados.

Main local continua `06cac4e`, seis commits à frente da main remota `b01e64b` e inclui alterações fora do escopo. Feature local `2eedce1`, remota `8f96bf4`; template é ancestral da main. git ls-remote foi repetido. Não fazer push indiscriminado da main local como se fosse este release. Após aprovação, criar commit a partir desta proposta/base e decidir integração preservando os commits existentes.

Lockfile idêntico; nenhuma dependência runtime adicionada. node_modules foi reutilizado por junction local e não integra o patch. Nenhum .env/segredo copiado. Build local é validação, não artefato final com configuração de produção; rebuild final precisa das variáveis e Node da Vercel.

Migration única: `20261031105202_managed_web_presentations.sql`. Hash no checkout: `650a1eb98bd2bf50ee4e299ddd38b783ede105b7797ef96a4f83fa1b2d49c765`. Hash anterior F6BB... correspondia ao arquivo CRLF do workspace; igualdade após normalizar CRLF/LF foi confirmada, sem mudança SQL semântica. Revalidar hash e pré-requisitos/ACLs/colisões imediatamente antes de aplicar; não usar db push geral.

| Verificação repetida no checkout | Resultado |
| --- | --- |
| Pacote, migration/handler reais em banco isolado, contrato, Bitara | 10 passaram |
| Regressão: contrato de aprendizagem, operações de aluno, progresso e flashcards | 61 passaram |
| Navegador: Bitara, gerenciador admin/aluno, viewer standalone | 3 cenários passaram |
| npm.cmd run build | Passou |
| npx.cmd deno check supabase/functions/import-web-presentation/index.ts | Passou |
| A02 real ausente em public e dist | Confirmado |
| Manifesto dist | 102 arquivos com hashes/tamanhos |

Auth/Storage nos testes usam transporte simulado e dados sintéticos; não homologam o serviço real. Node local 22.19.0 versus Vercel 24.x: validar o build de staging no runtime de destino. Avisos existentes: Browserslist antigo, bundles >500 kB e whitespace no texto original da licença OFL, preservado. Sem testes reais de produção.

## Riscos e plano exato para futura autorização

Riscos: backup sem prova; visibilidade parcial dos switches Git; preview aberto e sem variáveis preview listadas; diferença Node; bundle Edge importa parser/schema fora de functions; transporte real ainda não homologado; URLs assinadas duram 300 s, podendo continuar válidas até expirar após revogação; falha de limpeza pode deixar órfãos privados. CORS usa * com Bearer, sem cookies: verificar preflight/autorizações sem tratá-lo como controle de acesso.

1. Conferir switches de branch/Git/auto-atribuição no painel e registrar evidência. Manter push bloqueado até isso e backup estarem resolvidos. Não usar preview público com credenciais de produção como staging.
2. Executar backup e ensaio isolado descritos acima, aprovar evidências e definir recuperação. Preparar homologação protegida com dados/contas sintéticos.
3. Finalizar commit a partir do checkout isolado e revisar diff/manifesto. Repetir checks sob Node 24 e configuração staging. Escolher o fluxo antes de enviar refs: Git integration pode gerar preview ao push.
4. Reconsultar inventário/fingerprints de atividades, XP e progresso, definições/ACLs dos helpers e ausência de colisões. Aplicar SOMENTE `20261031105202_managed_web_presentations.sql`, transacional com lock_timeout 5 s, e conferir registro exato. Não reparar timestamps históricos divergentes.
5. Implantar apenas `import-web-presentation` com JWT verificado; conferir bundle, segredos servidor, OPTIONS e bloqueios 401/403.
6. Criar deployment de produção sem domínio (`--prod --skip-domain` ou equivalente confirmado), do commit exato. Não publicar antecipadamente por push automático na main. Validar antes de promover.
7. Homologar pacote sintético: importação, prévias, rascunho, publicação/reversão/concorrência; admin/aluno autorizado e negativos; RLS, Storage privado, objetos fora do manifesto, CORS, assinatura/expiração/renovação. Contas/aula/atividade sintéticas em produção exigem autorização específica. Não vincular atividade real nem confirmar estudo/gerar XP real.
8. Promover o MESMO deployment ao HTTPS; conferir rotas, imagens/Bitara, acesso autorizado e negativos; comparar baseline e registrar URLs/evidências. Só depois decidir atualização das refs Git com publicação automática já controlada.
9. Aula 02 exige aprovação separada: inventariar UUIDs/keys, validar ZIP, apresentar vínculo concreto e aguardar. Não reimportar JSON completo, duplicar atividades ou alterar XP/progresso/histórico.

Recuperação: SQL falhou → conferir rollback transacional, sem marcar migration aplicada. Edge/build/homologação falhou → não promover. Frontend publicado falhou → voltar ao deployment `dpl_5A8o7uMNwLZmnVPpXnSq7RWPWRrw` após revalidar elegibilidade. Preservar tabelas/bucket/auditoria aditivos; não fazer drop de objetos em uso. Versão falhou → troca confirmada de ponteiro ativo. Dados corrompidos → plano específico a partir do backup comprovado, nunca restauração integral indiscriminada sobre dados recentes.

## Autorizações necessárias

- Provisionar ferramentas/runner/destino isolado, custos e proteção/retenção dos dados; coletar backup completo e executar ensaio isolado com dados reais.
- Alterar proteção/envs de preview ou qualquer configuração Vercel/Supabase.
- Integrar/push, aplicar migration, implantar Edge, criar deployment, promover ou efetuar rollback em produção.
- Criar contas/aula/atividade sintéticas no projeto real para homologação, se necessário.
- Publicar/vincular Aula 02, sempre separadamente.

Nenhuma dessas ações foi executada nesta revisão. O backup recuperável continua sendo o bloqueio principal.
