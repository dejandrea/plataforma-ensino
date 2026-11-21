# Proposta — PostgreSQL portátil para homologar E1a

Proposta de 13/11/2026, **autorizada pela usuária em 15/11/2026**. Download, verificação e extração concluídos; inicialização/testes reais continuam condicionados a pelo menos 2 GiB de RAM livre. Sem produção, dados reais ou retomada da infraestrutura de backup.

## Alternativa recomendada

Usar binários Windows x64 do **PostgreSQL 17**, em diretório dedicado, iniciados manualmente por `pg_ctl`. Usar `psql` do mesmo pacote para múltiplas conexões independentes. Não requer Rancher, WSL, pilha Supabase completa, pgAdmin, driver npm novo ou serviço Windows.

A página oficial do PostgreSQL oferece a alternativa ZIP sem instalador, hospedada pela EDB. Na consulta de 13/11, a EDB listava binários 17.12. Conferir versão, plataforma, procedência e disponibilidade novamente antes de baixar. Não substituir por um instalador ou outra distribuição silenciosamente.

Fontes: [PostgreSQL para Windows](https://www.postgresql.org/download/windows/) e [binários EDB](https://www.enterprisedb.com/download-postgresql-binaries). O suporte ao Windows deste computador e às DLLs será verificado antes da inicialização; a lista de plataformas testadas pelo fornecedor não equivale a uma garantia para qualquer edição desktop.

## Escopo concreto proposto

```text
D:\Documentos\Bitaria\HomologacaoEditorial\
  downloads\       ZIP e registro de procedência/hash
  pg17\            binários extraídos, sem instalador
  data\            cluster exclusivo de dados sintéticos
  secrets\         credenciais descartáveis locais, acesso restrito
  logs\            diagnóstico local sem senhas
  evidencias\      versões, medições e resultados
```

Esse diretório fica fora do Git e das duas pastas de backup. Não contém cópia de produção, dados pessoais reais ou credenciais Supabase. O volume D está disponível, mas não está comprovadamente criptografado; portanto, **não usar esse cluster para dados reais ou restauração de backup**.

1. Após autorização, conferir RAM, versão/arquitetura do Windows, espaço, ACLs da pasta e disponibilidade da porta proposta `55439`.
2. Identificar o ZIP Windows x64 na fonte oficial, verificar tamanho informado antes da transferência e registrar URL/versão/hash. Usar checksum/assinatura do fornecedor se disponíveis; hash calculado localmente sozinho não prova procedência.
3. Baixar e extrair no diretório acima. Executar apenas a verificação de versão dos binários. Se faltar runtime, houver UAC ou necessidade de instalação de sistema, parar e apresentar essa dependência antes de continuar.
4. Criar cluster vazio com `initdb`, credencial aleatória descartável e autenticação SCRAM. Senha fica em arquivo local temporário protegido; não em argumentos, chat, Git, `.env` da plataforma ou logs.
5. Configurar **somente o `postgresql.conf` e o `pg_hba.conf` desse cluster**: `listen_addresses='127.0.0.1'`, porta `55439`, sem regras remotas. Não alterar PATH global, serviços, Registro, firewall, certificados, VPN, DNS, swap ou WSL. Não executar `pg_ctl register`.
6. Iniciar manualmente com `pg_ctl`, log local, caminho absoluto e identificação inequívoca `bitaria_editorial_homolog_local`. Confirmar pelo sistema que a escuta está apenas no loopback e pela conexão que o diretório/versão/banco são os esperados.
7. Aplicar **somente no banco sintético** a base estrutural de fixtures e as migrations necessárias para reproduzir o estado anterior à E1a, depois a migration E1a auditada. Não conectar à URL de produção, não executar CLI Supabase vinculada e não carregar `.env.local` da aplicação.
8. Usar os binários `psql` para sessões reais independentes, registrar `pg_backend_pid()` de cada conexão e executar a matriz A–F do relatório. Modelar os papéis Auth/Storage por fixtures; não confundir isso com homologação do serviço Auth ou do transporte hospedado.
9. Encerrar pelo `pg_ctl` com desligamento controlado. Preservar dados/evidências sintéticos para retomada. Não apagar diretórios ou registrar início automático.

## Recursos e custos

- **Contratação: nenhuma.** Não criar projeto remoto ou contratar serviço. Se o download exigir cadastro/condições inesperadas, interromper; não criar conta nem aceitar contratação.
- RAM observada: 7,84 GiB totais e **0,75 GiB livres**, insuficiente para iniciar os testes com uma reserva prudente.
- Proponho iniciar essa alternativa somente com **pelo menos 2 GiB livres**, usando orçamento inicial de até 512 MiB para servidor/clientes e observação contínua. Essa é uma política conservadora proposta, não um consumo medido nem requisito oficial. O limite anterior de 4 GiB para a pilha Supabase/Rancher completa não é reduzido por esta proposta.
- Parâmetros locais iniciais para avaliação: `shared_buffers=32MB`, `work_mem=1MB`, `maintenance_work_mem=32MB`, `max_connections=12`. Manter controles de segurança e durabilidade; não desabilitar `fsync`, WAL ou autenticação para obter números melhores.
- Espaço D observado: cerca de 399,71 GiB livres. Reservar inicialmente 2 GiB para pacote/extração/cluster/evidências, conferindo o tamanho real do arquivo antes do download e medindo o crescimento; não é estimativa garantida do fornecedor.
- Interromper de forma controlada se houver pressão de memória ou reserva insuficiente. Não forçar por swap e não encerrar aplicativos da usuária.

## Recuperação e reversibilidade

Nenhum serviço ou configuração global será criado. A desativação é o encerramento controlado do cluster pelo seu caminho absoluto. Os binários e o cluster permanecem em pasta dedicada. Remoção posterior exige autorização e conferência dos caminhos; não faz parte desta autorização proposta.

Esse ambiente comprovará comportamento de PostgreSQL real com múltiplas conexões. Windows local e fixtures não representam latência, hardware, Auth, pooler ou Storage do Supabase hospedado. Também não constituem backup nem prova de restauração de produção.

## Autorização recebida e condição pendente

A usuária autorizou **baixar/extrair os binários PostgreSQL 17 x64, preparar e iniciar temporariamente o cluster local acima e executar testes exclusivamente sintéticos**, após liberar RAM suficiente e confirmar o preflight. Não é necessário pedir novamente essa mesma autorização. Não inclui instaladores com privilégios administrativos, instalação de runtimes, mudança de segurança/sistema ou qualquer ação em produção. Essas situações exigem nova confirmação específica.

## Preparação executada — 15/11/2026

- ZIP selecionado pela página oficial EDB: file ID `1260667`, redirecionado por HTTPS para `postgresql-17.12-1-windows-x64-binaries.zip`.
- Tamanho: 386.263.884 bytes. SHA-256 **igual ao sidecar oficial `.zip.sha256`**: `a2cd8a774389347b70be7748ac4a37ef43cb6ee539c5fc3e85ae264b15e4a04c`.
- Extraídas somente as árvores `bin`, `lib` e `share`: 1.600 entradas, 143.281.796 bytes. pgAdmin e demais componentes não foram extraídos.
- `postgres`, `pg_ctl`, `psql` e `initdb` responderam `--version` com **17.12**, sem instalar runtime ou alterar PATH.
- Raiz e diretórios de trabalho preparados em `D:\Documentos\Bitaria\HomologacaoEditorial`, com ACL restrita à conta atual e SYSTEM. Nenhuma credencial de produção foi consultada ou copiada.
- Registro: `evidencias/preparacao-20261115.json`. Modelos não aplicados: `evidencias/postgresql.template.conf` e `evidencias/pg_hba.template.conf`.
- Não há cluster inicializado, servidor iniciado, serviço Windows ou senha gerada. Os modelos ainda não são configuração de um servidor em execução.
- RAM livre: 798.804 KiB no início; 884.456 KiB após extrair; 999.040 KiB na última medição registrada (**0,95 GiB**). Todas abaixo dos 2.097.152 KiB exigidos. Não houve inicialização por essa razão.

Próximo passo: a usuária liberar memória e avisar para nova medição. Com recursos suficientes, continuar usando a autorização já recebida; não iniciar se o limite continuar descumprido.
