# Preparação final do importador de apresentações — 09/11/2026

Referência: [diagnóstico do gerenciador](diagnostico-gerenciador-apresentacoes-web-20261109.md). Esta preparação não executou migration, deploy, upload de ZIP, exportação de dados reais, restauração, publicação, vínculo, push ou merge. Não alterou o frontend nem retomou configuração de Rancher, discos, AWS ou outra infraestrutura.

## Checklist de decisão

| Item | Estado atual |
| --- | --- |
| Projeto e versão de banco | Confirmados: `codePlatform`, `gnyiyhnbpjhdgrhsevbh`, PostgreSQL 17.6 |
| Backup gerenciado restaurável | **Não comprovado**: API/CLI não apresenta ponto utilizável |
| Cópia manual recuperável | **Pendente**: nenhuma exportação nesta etapa; não há `.age` nos dois destinos combinados |
| Proteção e custódia para dados reais | **Pendentes de comprovação** no fluxo preparado: volume privado e recipient definitivo não confirmados |
| Restauração isolada dos dados reais | **Não executada**, portanto não comprovada |
| Migration do gerenciador | **Idêntica ao arquivo auditado**, hash conferido |
| Bundle da função | **Preparado isoladamente**, imports completos e Deno check aprovado |
| ZIP mínimo e Aula 02 | **Válidos** pelo parser do pacote isolado, sem upload |
| Backend do gerenciador em produção | Ainda ausente; essa é a instalação pretendida, não uma falha do frontend |
| Execução da instalação | **Aguardar prova de recuperação e autorização explícita** |

Conclusão: **pacote e sequência técnica estão prontos; a instalação em produção ainda não está pronta para execução. O impedimento específico é não existir uma cópia real cuja restauração tenha sido comprovada em destino isolado e protegido.** Não é necessário desenvolver outro importador ou refazer o frontend.

## 1. Proteção efetivamente disponível

Consulta atual, somente leitura:

```text
npx.cmd --yes supabase@2.122.0 backups list --project-ref gnyiyhnbpjhdgrhsevbh -o json
```

Resultado:

```json
{"backups":null,"physical_backup_data":{},"pitr_enabled":false,"region":"us-west-2","walg_enabled":true}
```

Não foi apresentado um backup gerenciado restaurável. `walg_enabled:true` indica um mecanismo interno habilitado, mas não comprova um ponto de recuperação acessível, retenção ou restauração disponível à usuária. Não presumir PITR. Não alterar plano nem contratar add-ons.

Inventário atual sem leitura de registros pessoais:

- Banco: 18.345.107 bytes, aproximadamente 18 MB. Esse tamanho físico não é o tamanho garantido do dump.
- Storage: bucket `catalog-icons`, sete objetos, 156.134 bytes de conteúdo segundo os metadados.
- Objetos e migration do gerenciador: ausentes. `import-web-presentation` não está implantada.
- Migration mais recente aplicada: `20261109194229`, de disponibilidade semanal; ela não instala o gerenciador e não deve ser reaplicada.

A exportação lógica manual é a alternativa disponível para preparar a proteção sem custo recorrente adicional de serviço. A documentação oficial recomenda exportações para projetos sem backup gerenciado acessível e exige transferência separada dos binários Storage: [backups Supabase](https://supabase.com/docs/guides/platform/backups).

### Estado local relevante

- Existem scripts anteriores de exportação por stream criptografado, guardas de origem/destino e cópia de Storage. São uma base de preparação, não uma prova de recuperação.
- `age` portátil está presente no diretório privado preparado. Não foi lida nem exibida chave privada.
- `pg_dump`, `pg_restore` e `psql` não foram encontrados no PATH; também não foi encontrado `pg_dump.exe` na pasta padrão `C:\Program Files\PostgreSQL\17\bin`. Isso não prova ausência em qualquer outro local. É necessário disponibilizar clientes PG17 confiáveis ou confirmar clientes compatíveis no runtime já existente, sem iniciar/reconfigurar esse runtime nesta etapa.
- A configuração privada de aprovação permanece com `approved=false`, confirmação de volume criptografado falsa, restauração não aprovada e recipient não configurado. Essas flags não foram alteradas.
- Os dois diretórios combinados existem, mas nenhum arquivo `.age` foi encontrado neles. Não foi pesquisado nem lido conteúdo de backups em locais desconhecidos.
- Os quatro testes sintéticos dos guardas passaram: impedem exportação sem aprovação, rejeitam restauração remota/overrides de conexão, exigem origem esperada/TLS e recusam Storage remoto como destino de restauração. Eles **não** comprovam exportação/decifragem/restauração reais.

## 2. Alternativa recomendada, limitada ao necessário

Preparar **um conjunto lógico pontual criptografado antes da migration**, incluindo banco, permissões e os sete binários Storage, e comprovar sua recuperação no ambiente local isolado já planejado. Não contratar servidor, não implantar agendamento de backup e não mudar DNS, firewall, Rancher ou discos nesta preparação.

O conjunto deve conter:

1. Schema e dados de aplicação, Auth, metadados Storage e histórico de migrations, com owners, ACLs, RLS, funções, triggers, sequências e definições necessárias de extensões. Inventariar os schemas antes de fechar a seleção; não presumir que `public` sozinho seja suficiente.
2. Roles e memberships sem senhas, com diferenças de roles gerenciadas explicitadas. Credenciais/configurações externas necessárias à recuperação ficam sob custódia protegida, separadas do relatório; um dump não reconstrói sozinho OAuth, SMTP ou secrets Edge.
3. Todos os arquivos Storage, mais configuração dos buckets e manifesto criptografado de caminhos, MIME, tamanho e SHA-256. Não basta copiar `storage.objects`.
4. Manifesto de integridade criptografado com instante/snapshot, versões e hashes; cópia do código/manifestos de configuração necessários. Só recibos sanitizados entram no repositório.

### Captura consistente e proteção

- Usar cliente PostgreSQL **17**. Origem limitada ao projeto confirmado, conexão direta ou session pooler, TLS `verify-full`; credenciais somente por mecanismo local protegido, sem senha em argumento, histórico, log ou chat. Não redefinir senha de produção para executar esta preparação.
- Abrir uma sessão persistente `REPEATABLE READ READ ONLY`, exportar o snapshot e manter a sessão aberta durante a captura/conferência. Um único arquivo custom do `pg_dump` deve reunir schema/dados/ACL do banco selecionado sob esse snapshot. Capturar roles/globais separadamente e verificar drift, pois não compartilham automaticamente o snapshot.
- Transmitir os bytes de `pg_dump` diretamente ao `age` com recipient público, em pipeline binário gerenciado por Node, sem pipe textual do Windows PowerShell. Não produzir SQL/dump em claro em Downloads, Git ou pastas públicas. Arquivo incompleto não é backup aprovado.
- Comparar Storage antes/depois e verificar os hashes dos binários baixados. Banco e Storage não oferecem snapshot conjunto por esse procedimento. Se houver drift, repetir a captura ou propor uma pequena janela coordenada de escrita para autorização separada; não bloquear produção automaticamente.
- Criptografar qualquer metadado que revele dados pessoais ou paths privados. Logs contêm somente status, contagens e identificadores sanitizados.
- O local de restauração também precisa estar protegido: a decifragem por stream evita um dump em claro, mas os dados persistidos pelo PostgreSQL/Storage, temporários e volumes/VHDX precisam ter proteção efetiva. Não restaurar dados reais no Rancher apenas porque o arquivo de backup está cifrado.

### Compatibilidade da restauração Supabase

Os scripts anteriores usam um arquivo custom com schemas `auth` e `storage`. **Não executar seu `restore-db` cegamente sobre um Supabase local já inicializado.** A documentação oficial alerta que dumps brutos incluem objetos internos e podem gerar conflitos/permissões durante a restauração. O procedimento oficial de migração usa filtragem específica do Supabase: [restauração para ambiente próprio](https://supabase.com/docs/guides/self-hosting/restore-from-platform) e [backup/restauração por CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

Portanto, antes de qualquer restore, preparar um plano revisado a partir do TOC do arquivo e do inventário real: versões PG/Auth/Storage/extensões, base local de destino, objetos que pertencem à plataforma, roles/owners e dados a restaurar. Usar a receita compatível do Supabase para os componentes gerenciados ou mapear explicitamente as entradas do arquivo custom ao alvo. Não descartar tabelas/linhas silenciosamente para fazer o comando terminar sem erro. Não mascarar falhas com `--no-owner`, `--disable-triggers` ou `--clean` indiscriminados. Qualquer tratamento de triggers na carga precisa ser restrito ao alvo isolado, justificado e revertido/verificado ao fim.

Esse plano de restore específico e o ensaio são **pendentes**. Não chamar os scripts anteriores de solução já homologada.

### Destinos e custódia já discutidos

- Principal: `D:\Documentos\Bitaria\Backup`.
- Pasta de segunda cópia: `D:\Documentos\My projects  and programs\Backup-copia`.
- Custódia da chave: usuária. Retenção combinada: 30 dias, preservando a cópia pré-migration e a última verificada até revisão.
- As duas pastas ficam em D e não comprovam independência física. O upload automático ao Drive foi planejado pela usuária, mas não foi verificado nesta etapa. Considerar segunda cópia independente apenas após confirmar o envio dos arquivos já cifrados, sua integridade e a possibilidade de recuperação; não enviar a identidade privada junto.
- Confirmar a proteção do destino de trabalho/restauração e o recipient público antes da exportação. Não solicitar senha ou chave privada por chat. Não gerar identidade definitiva sem autorização própria.

Custos de serviço: **nenhuma contratação ou mensalidade adicional é proposta**. Pode ser necessário espaço local e disponibilizar ferramentas PG17; qualquer instalação, configuração de volume ou outro recurso depende de aprovação, não foi feita agora.

## 3. Como comprovar a cópia e a recuperação

Ordem do ensaio, sempre fora de produção:

1. Confirmar local protegido, recipient/custódia, versões dos clientes e plano do alvo. Antes de exportar, executar os guardas sintéticos e conferir que os destinos estão fora do repositório e da pasta pública.
2. Capturar snapshot e conjunto cifrado descritos acima; guardar contagens e fingerprints vinculados ao **mesmo snapshot**. Conferir exit codes de dump e criptografia, tamanho, hashes, TOC e existência de todos os arquivos. Essa etapa sozinha ainda não prova recuperação.
3. Preparar alvo vazio/separado com PG17 e componentes Supabase compatíveis. Validar identidade do container/serviço, banco e porta locais; bind apenas loopback e ausência de túnel para produção. Os guardas de hostname não bastam para comprovar isso.
4. Desabilitar antes da carga e-mails, Google/OAuth de produção, cron, webhooks, pg_net e outras saídas. Usar chaves exclusivamente locais. Não reutilizar secrets de produção para habilitar integrações no ensaio.
5. Restaurar roles/objetos/dados pela ordem do plano revisado, com erros fatais e sem apagar o banco remoto. Recuperar Storage pela API **local**, preservando bucket/path/MIME e reconciliando os metadados; conferir cada binário após leitura.
6. Comparar contagens e fingerprints de todos os dados selecionados, FKs, índices, funções, triggers, owners/grants/default privileges e RLS com a captura. Conferir que as sequências podem gerar IDs acima dos valores restaurados; seu estado não deve ser presumido como uma linha MVCC comum do snapshot.
7. Comparar os sete arquivos Storage byte a byte por SHA-256, tamanho e MIME, e as políticas/configurações dos buckets. Qualquer ausência ou diferença impede a aprovação do conjunto.
8. Testar permissões com contas sintéticas **somente locais**, incluindo admin ativo, professor, aluno autorizado, externo, inativo e anônimo. Comparar os dados antes de inserir esses usuários de teste para não confundir as contagens. Não redefinir a senha de pessoas reais.
9. Abrir também a segunda cópia cifrada, medir tempo da restauração e emitir recibo sanitizado: instante protegido, artefatos, hashes, versões, resultados, limitações e perda de dados possível desde a captura.
10. Revalidar a atualidade da cópia antes da migration. Se banco/Storage mudaram durante o ensaio, obter uma captura pré-migration suficientemente recente e conferir o conjunto; não prometer que um backup pontual protege escritas futuras.

Só marcar **recuperável comprovado** quando essa sequência concluir sem erro ignorado. O ensaio anterior de ROLLBACK da migration em PGlite comprova reversão transacional com dados sintéticos; não substitui esse teste.

## 4. Migration permanece idêntica

Arquivo: `supabase/migrations/20261031105202_managed_web_presentations.sql`.

```text
SHA-256: 650a1eb98bd2bf50ee4e299ddd38b783ede105b7797ef96a4f83fa1b2d49c765
```

Comparação efetuada entre o arquivo atual e os bytes copiados para o pacote isolado: iguais ao hash auditado. Nenhuma edição desse SQL foi feita nesta preparação. Seus pré-requisitos já conferidos no diagnóstico continuam sendo os cinco helpers privados de aprendizagem e as tabelas/colunas existentes; a migration de disponibilidade aplicada depois é independente.

## 5. Empacotamento da Edge Function

Pacote local: `tmp/manager-finalprep-20261109/`. Manifesto de integridade: `verified-manifest.json`.

Arquivos que devem ser enviados na implantação da função, preservando esses caminhos relativos:

```text
supabase/functions/import-web-presentation/index.ts
supabase/functions/_shared/supabase.ts
public/apresentacoes/package.js
public/apresentacoes/validate.js
public/apresentacoes/presentation.schema.json
deno.json
deno.lock
```

O SQL auditado foi copiado separadamente para o pacote como referência, mas **não integra a lista de arquivos da Edge Function**. Os manifestos de preparação e os ZIPs reais também não integram essa lista.

- O entrypoint importa o helper de Auth/serviço, o parser e o schema. `package.js` importa `validate.js`; o grafo relativo foi conferido integralmente.
- O validador usa o mesmo schema/parser existentes; não foi criado outro importador.
- A configuração Deno do pacote é independente das configurações de testes/agenda, usa cache sem node_modules local e lockfile próprio. Resolve `npm:@supabase/supabase-js@2` para **2.119.0**, com integridades no lockfile. Não atualiza o SDK do frontend nem outras Edge Functions.
- `deno check` foi executado sobre o entrypoint **copiado no pacote**, com seu `deno.json`, e passou.
- Foram conferidos hashes de todos os cinco arquivos-fonte do pacote contra os originais. Nenhum arquivo de aplicação foi alterado.
- Não há `.env`, tokens, imagens, decks, teacherOnly ou dados reais no pacote da função. Variáveis de servidor serão verificadas por presença/funcionamento, sem exibir valores.
- A checagem local confirma o grafo e os tipos; o bundle da plataforma e o transporte HTTP ainda precisam de homologação após implantação autorizada.

## 6. Sequência exata de ativação — não executada

### Gate obrigatório

Comprovar a recuperação acima e obter autorização explícita para instalar o backend. Reconsultar projeto, inventário e colisões. Confirmar a ausência da migration/objetos para não reaplicar SQL não idempotente. Nenhum `db push`, `migration up` geral, repair ou aplicação de migrations pendentes de outros recursos.

### Operação 1: somente a migration

1. Recalcular o SHA-256 e compará-lo ao valor acima.
2. Aplicar com a operação `apply_migration`:

```text
project_id: gnyiyhnbpjhdgrhsevbh
name: managed_web_presentations
query: bytes/texto do único arquivo auditado
```

3. Registrar a versão realmente retornada pelo servidor e o vínculo com esse hash. Se o conector atribuir novo timestamp, alinhar o arquivo do release à versão aplicada sem repair ou inserção manual no ledger. O SQL contém transação, lock_timeout e reload do schema PostgREST.
4. Conferir quatro tabelas, RLS, privilégios, RPCs, triggers imutáveis, bucket privado, MIME/tamanho e a política de leitura. As políticas já existentes do Storage não podem abrir genericamente o novo bucket.

### Operação 2: somente a função

Implantar com `deploy_edge_function` e **somente os sete arquivos da lista acima**, usando:

```text
project_id: gnyiyhnbpjhdgrhsevbh
name: import-web-presentation
entrypoint_path: supabase/functions/import-web-presentation/index.ts
verify_jwt: true
```

A CLI 2.122.0 também teve seu help conferido. Alternativa, somente após confirmar a configuração/raiz do pacote:

```text
npx.cmd --yes supabase@2.122.0 functions deploy import-web-presentation --project-ref gnyiyhnbpjhdgrhsevbh --use-api
```

O nome da função é obrigatório: omiti-lo publica todas as funções. **Não usar `--prune` nem `--no-verify-jwt`.** Conferir o JWT habilitado na metadata retornada, inclusive se optar pela CLI. Não publicar `google-calendar-*` ou outro recurso.

Não é necessário deploy de frontend, push ou merge para desbloquear o gerenciador já publicado.

## 7. Testes mínimos e critério de liberação

### Backend instalado, antes de importar qualquer pacote real

- Admin ativo consulta `web_presentation_state` pela API real sem erro de preparação. Professor, aluno e inativo não recebem acesso administrativo; anônimo é negado.
- OPTIONS responde com métodos/headers necessários; chamada sem usuário autenticado é negada. `auth.getUser()` e verificação de admin ativo funcionam no handler. CORS `*` não é autorização.
- Bucket `web-presentations` é privado. Cliente comum não pode listar/ler rascunhos, emitir assinatura de objeto alheio nem gravar/alterar/excluir arquivos. Validar versão antiga e caminho fora do manifesto.
- Acessos autorizados recebem URLs do projeto correto, com expiração de 300 s; a rota gerenciada renova em 120 s. Confirmar negação de novas emissões após revogação; uma URL já emitida pode funcionar até expirar.
- ZIP mínimo: prévia local, upload e rascunho privado validado no servidor, sem active_version e sem vínculo. Usar a aula de homologação existente expressamente aprovada; não criar currículo/atividades reais para improvisar o teste.
- Publicação, atualização, rollback e vínculo completo devem ser exercitados em ambiente isolado com atividade sintética; não são necessários para salvar a Aula 02 como rascunho. A recuperação do primeiro vínculo real deve ser aprovada antes desse vínculo, pois o contrato atual não tem operação pública de desvinculação.
- Confirmar que importação/prévia não alteraram currículo, atividades, revisões, perfis, progresso ou XP. Falha de upload não publica e não deixa uma versão registrada como válida; órfãos privados, se ocorrerem, exigem inventário/limpeza separadamente autorizados.

### Aula 02: somente rascunho privado

1. Revalidar o ZIP aprovado, seu hash, 15 slides, seis imagens e oito arquivos. Parser/schema válidos não equivalem à aprovação editorial do vínculo.
2. Confirmar aula `b17a2000-0000-4000-8000-000000001002`, “Grandes Nomes da Tecnologia”, e capturar seu status/atividades antes da operação. Não mudar seu status.
3. Após autorização explícita para esse upload, usar o importador existente para **Salvar rascunho validado**. Não clicar em publicar nem vincular.
4. Conferir versão salva, manifesto, imagens, Bitara e créditos na prévia; `active_version_id` deve permanecer NULL para a nova apresentação e nenhum link deve ser criado. Se o pacote já existir, revisar a versão existente, sem duplicar importações.
5. Admin pode resolver a versão de rascunho; aluno, professor, inativo e anônimo não podem acessá-la. Verificar tanto a RPC quanto a emissão/leitura dos objetos Storage.
6. Confirmar status da aula, seis atividades, UUIDs/keys/revisões, progresso e XP sem alterações. Nenhuma confirmação de estudo durante essa homologação de produção.

As duas atividades slides existentes continuam sem escolha automática de destino. Publicação e vínculo, quando desejados, exigirão outra autorização concreta.

## 8. Verificações locais e riscos restantes

Executadas nesta preparação:

- Hash da migration conferido e cópia byte a byte validada.
- Cinco arquivos-fonte do bundle comparados aos originais, imports relativos completos e Deno check do pacote isolado aprovado.
- Parser do pacote isolado: mínimo válido (1 slide, 2 arquivos), Aula 02 válida (15 slides, 8 arquivos), ambos sem avisos. Hashes canônicos preservados: mínimo `68f307ff879949b226f7ad2ac3e26b7f43f34243a844346db54aae3088bd024a`; Aula 02 `01f753f997ec50de3e49fe4274302af0c026a64716e6739afa3699e0e946b5b5`.
- Quatro testes dos guardas de recuperação aprovados, exclusivamente sintéticos.
- Consulta atual de backups e inventário, sem exportação de registros pessoais.

Os cinco testes de pacote/servidor, o cenário de navegador e o rollback da migration com helpers atuais foram aprovados no diagnóstico de 09/11/2026. Não foram apresentados aqui como restauração de dados reais nem como homologação do Storage hospedado.

Riscos pendentes: não há cópia recuperável comprovada; falta alvo protegido de restauração e plano efetivamente ensaiado para componentes internos Supabase; a segunda cópia externa não foi verificada; o transporte real Auth/Storage/Edge ainda não foi homologado. Nenhum desses itens exige refazer o importador.

## 9. Autorizações necessárias, separadas

1. **Proteção e recuperação:** autorizar a etapa restrita de disponibilizar as ferramentas necessárias, confirmar/fornecer área criptografada de trabalho e restauração, configurar a identidade definitiva sob custódia da usuária e exportar os dados/schema/ACL/Auth e Storage para os destinos aprovados; depois testar exclusivamente no alvo isolado. Não gerar chaves ou instalar/alterar sistema sem a confirmação correspondente. Não pedir segredos pelo chat.
2. **Instalação:** somente após as evidências de recuperação, autorizar a migration única e `import-web-presentation`, com os hashes e a sequência descritos. Não há autorização inferida de publicação do frontend.
3. **Upload real:** autorizar o pacote da Aula 02 apenas como rascunho privado, depois dos testes mínimos. Não publicar nem vincular automaticamente.

Enquanto a primeira etapa não produzir uma cópia efetivamente restaurada e verificada, **o impedimento permanece a recuperação não comprovada**, e não código ou empacotamento do importador.
