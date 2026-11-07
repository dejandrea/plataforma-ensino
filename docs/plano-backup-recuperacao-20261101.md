# Backup e recuperação antes do deploy — 01/11/2026

Estado: diagnóstico de leitura e procedimento proposto. Não houve instalação, contratação, exportação de dados privados, criação de ambiente, restauração, push, merge, migration ou deploy nesta etapa.

## Recomendação

Manter o plano Free por enquanto. Fazer um backup lógico consistente e criptografado, copiar os arquivos Storage separadamente e comprovar recuperação em Supabase local isolado. Para o tamanho observado, não é necessário contratar PITR nem um novo projeto hospedado para este ensaio. A operação exige tempo de preparação/teste e espaço local, mesmo sem assinatura adicional.

Não classificar a cópia como recuperável até concluir restauração, comparação e testes. Um SQL, manifesto ou hash sozinho não comprova recuperação.

## Diagnóstico confirmado

- Projeto `codePlatform`, ref `gnyiyhnbpjhdgrhsevbh`, organização `zjywawxppskutjqgumbi`.
- `get_organization`: `plan: free`, `tier: tier_free`.
- Projeto saudável, PostgreSQL 17.6.1.063.
- Consulta agregada: banco 18.377.875 bytes (~18,4 MB); tabelas public/private 3.899.392 bytes (~3,9 MB); 18 aulas; 14 atividades.
- Storage: 7 objetos, 156.134 bytes (~156 KB), somados a partir dos metadados de tamanho. Não foram baixados binários nem lidos registros pessoais. Tamanho real/hash de cada arquivo será confirmado somente no backup autorizado.
- Consulta atual `supabase backups list`: backups null, physical_backup_data vazio, PITR false, WAL-G true. Nenhum ponto gerenciado utilizável comprovado; WAL-G true não garante acesso a um ponto restaurável.
- Ferramentas Docker/Podman/pg_dump/psql não encontradas no PATH. A tentativa anterior de dump já havia falhado por falta de runtime. Não foram instaladas nesta etapa. Recursos de virtualização/RAM/disco ainda precisam ser validados antes da instalação; a consulta de disco desta sessão não retornou capacidade utilizável.

## Plano atual, alternativas e custos

| Opção | Disponibilidade / custo consultado | Avaliação para agora |
| --- | --- | --- |
| Free + exportação manual | Plano atual; sem nova mensalidade Supabase | Recomendada com restauração local comprovada e cópia externa protegida |
| Pro com backup diário | A partir de US$25/mês; retenção diária de 7 dias | Simplifica a rotina, mas não é necessário contratar só para este release |
| PITR de 7 dias | Add-on cerca de US$100/mês, além do plano e compute mínimo Small | Custo desproporcional para resolver este bloqueio pontual |

Valores em USD, consultados em 01/11/2026, sujeitos a uso, impostos e alterações. Não são orçamento de contratação. Nenhuma contratação foi feita. Exportação manual usa rede/egress existente; confirmar quota restante antes de exportar. Não afirmar custo operacional zero nem uso gratuito ilimitado. Guardar a cópia criptografada em mídia/cofre já existente evita novo serviço recorrente; eventual aquisição depende de orçamento/autorização.

O Free não fornece os backups diários acessíveis oferecidos aos planos pagos. A documentação recomenda exportação regular e cópia fora do projeto para Free. Backup de banco, inclusive gerenciado, não contém os binários Storage.

Fontes oficiais: [preços Supabase](https://supabase.com/pricing), [backups e PITR](https://supabase.com/docs/guides/platform/backups), [backup/restauração pela CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

## Ferramentas e recursos propostos

- Windows com virtualização/WSL2 compatíveis e espaço para imagens/volumes do stack local (muito maior que o dump do banco).
- Rancher Desktop com engine Moby/dockerd e Kubernetes desativado: alternativa aberta compatível com a CLI, sem contratar licença Desktop paga. Instalação/configuração pode exigir privilégios, WSL2 e reinício; parar para combinar se isso ocorrer.
- Supabase CLI em versão fixada e imagens PostgreSQL/Supabase compatíveis com produção, validadas antes do ensaio. pg_dump/pg_restore/psql podem ser usados dentro dos containers, sem instalar PostgreSQL completo no Windows.
- Ferramenta de criptografia, por exemplo age, em versão verificada, se ainda não existir solução aprovada. Chave privada mantida pela usuária fora dos arquivos de backup; nunca imprimir ou enviar a chave no chat. A instalação também depende de autorização.
- Área de trabalho com acesso restrito e armazenamento criptografado, pois o banco restaurado conterá dados pessoais descriptografados. Definir a mídia/cofre externo existente para a segunda cópia antes de transferir qualquer arquivo.

Docker Desktop é outra opção recomendada pela documentação para Windows, mas gratuidade depende da licença (uso pessoal/educacional ou pequena empresa com menos de 250 pessoas E receita anual inferior a US$10 milhões). Não presumir elegibilidade nem contratar assinatura. Fontes: [runtime local Supabase](https://supabase.com/docs/guides/local-development), [Rancher Desktop](https://rancherdesktop.io/), [licença Docker Desktop](https://docs.docker.com/subscription-billing/desktop-license/).

## Procedimento que aguarda autorização

1. Aprovar ferramentas, destino local criptografado, responsável pela chave, destino externo da segunda cópia e retenção. Proposta inicial: manter o backup pré-deploy e o último backup verificado; revisar após 30 dias. Não executar expurgo sem aprovação.
2. Verificar recursos/virtualização e instalar somente o necessário. Criar diretório/stack próprio fora do release, com identificação inequívoca de destino LOCAL. Não usar o diretório vinculado à produção para comandos de reset. Não vincular um novo projeto hospedado.
3. Fixar versões e iniciar Supabase local ligado somente ao loopback. Desativar envio real de e-mail, cron/jobs, webhooks e integrações externas no destino isolado antes de restaurar dados. Não copiar chaves de produção para o frontend local ou logs.
4. Usar conexão existente segura/TLS, sem resetar senha. Se a conexão direta IPv6 não funcionar, avaliar session pooler suportado, evitando contratar IPv4. Credenciais ficam no ambiente/cofre, não em argumentos impressos, histórico ou arquivos versionados. Se credenciais adicionais forem necessárias, pedir inserção direta pela usuária, nunca pelo chat.
5. Capturar roles/globais sem senhas, owners, ACLs/default privileges, RLS, funções, triggers, sequences, views, extensões e migrations. Exportar schema/dados de aplicação e os dados necessários Auth/Storage em snapshot PostgreSQL consistente. Inventariar objetos gerenciados pela plataforma e restaurar apenas com tratamento compatível; não presumir que o dump padrão da CLI inclua tudo. Não empurrar migrations locais históricas para reconstruir o banco real.
6. Usar um único pg_dump ou snapshot compartilhado entre exports compatíveis; registrar instante. Capturas globais/roles e Storage não compartilham automaticamente esse snapshot: verificar drift antes/depois e repetir se mudarem. Se houver escrita contínua impeditiva, apresentar uma janela coordenada para autorização separada, sem bloquear produção agora.
7. Gerar o backup criptografado sem arquivos SQL/dados pessoais em public/Git/logs. Qualquer pipeline de bytes deve preservar binários (não usar pipe textual do Windows PowerShell para um dump custom). Se temporários em claro forem indispensáveis, somente no volume criptografado restrito, com ciclo de vida aprovado.
8. Baixar os sete arquivos Storage e guardar conteúdo, bucket/path, tipo, tamanho e SHA-256 em arquivo protegido; incluir políticas/configuração dos buckets. Comparar inventário antes/depois. Registrar separadamente configurações de Auth/OAuth/Edge e referências a segredos, que não são garantidos pelo dump. Guardar chaves fora do backup.
9. Restaurar exclusivamente em banco/Storage locais, preservando UUIDs, keys, histórico, progresso e XP. Ajustar componentes gerenciados conforme a documentação. Nenhum restore, reset, drop ou escrita no projeto `gnyiyhnbpjhdgrhsevbh`.
10. Executar as provas abaixo. Guardar a segunda cópia criptografada somente no destino expressamente aprovado. A extração de produção é de leitura, mas exporta dados pessoais/credenciais de Auth e, portanto, exige autorização explícita.

## Critérios de aprovação da recuperação

- Restauração termina sem erro ignorado; versões/extensões necessárias compatíveis.
- Contagens exatas e hashes por tabela comparados ao MESMO snapshot exportado, não a um banco de produção que já pode ter mudado. Conferir FKs e próximo valor de sequences; preservar UUIDs/keys.
- Definições de schema/funções/triggers, owners, GRANT/REVOKE/default privileges e políticas/flags RLS conferidas. Diferenças de componentes gerenciados devem ser explicadas, não ocultadas.
- Todos os sete objetos recuperados com hash, tamanho e MIME corretos; buckets/políticas preservados.
- Contas sintéticas locais exercitam admin, aluno permitido, aluno externo, professor, inativo e anônimo. Não redefinir senhas de pessoas reais. Conferir casos negativos de dados privados e fidelidade de histórico/XP/progresso.
- Abrir uma cópia criptografada com a chave sob controle da usuária e medir tempo de recuperação. Documentar instante protegido, resultados, perdas possíveis e limitações de serviços externos.
- Emitir relatório sanitizado, sem dumps, tokens, dados pessoais ou hashes de senhas. Backup aprovado somente após essas evidências. Esse ensaio local não comprova sozinho o tempo de reconstrução de toda a infraestrutura hospedada.

Rotina econômica posterior: backup verificado antes de toda migration/importação relevante e cópias periódicas conforme a perda de dados aceitável. Como ponto de partida, propor cópia diária automatizada protegida e ensaio periódico, sem implantar agendamento nesta etapa. Um backup pontual não protege alterações posteriores. Se a manutenção manual se tornar onerosa ou for necessário RPO menor, reavaliar Pro/PITR com custo aprovado.

## Vercel e outros bloqueios

O conector continua com acesso ao projeto. Produção conhecida: main, SHA b01e64b, domínio https://plataforma-ensino-chi.vercel.app; o release isolado/testado permanece preservado. Porém a leitura direta de Settings → Git e Settings → Environments/Production não pôde ser concluída: Browser Use retornou `The browser access host is unavailable`; o canal nativo também está indisponível. Não falta novo consentimento de equipe. É necessário disponibilizar uma sessão de navegador conectada ao painel para ler os switches completos; não automatizar login/alterar configurações agora. A CLI também não tem autenticação própria, conforme consulta anterior.

Continuam necessários antes de publicar: comprovar recuperação, conferir switches de publicação automática, validar build sob Node 24/configuração de destino e homologar Auth/Storage/Edge reais. Essas verificações de implantação virão somente após autorização. Aula 02 permanece excluída, sem vínculo/publicação.

## Aprovação solicitada para a próxima etapa

Autorizar instalação/configuração do runtime local e criptografia, criação do Supabase LOCAL isolado e extração criptografada dos dados/schema/permissões/Auth e arquivos Storage para os destinos que a usuária aprovar, seguida de restauração e testes exclusivamente locais. Sem plano pago, novo projeto hospedado, deploy ou alterações de produção. Não iniciar exportação até estarem definidos destino protegido e custódia da chave. Autorizações de implantação seguem separadas.
