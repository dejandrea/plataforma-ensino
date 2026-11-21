# Execução autorizada E1a + E2a — 20/11/2026

> **Retomada posterior:** Edge corrigida implantada e validada, mas envio do frontend interrompido por resultado inconclusivo do conector Vercel. Estado atual em [retomada-etapas-5-7-e1a-e2a-20261120.md](retomada-etapas-5-7-e1a-e2a-20261120.md). Não reaplicar migrations.

**Implantação parcial, interrompida na etapa 5 pelo critério de parada aprovado.** A usuária autorizou etapas 1–7; primeiro pacote real permaneceu fora do escopo. Não houve importação, publicação de conteúdo pedagógico, push ou merge.

## Concluído em produção

- Hashes dos 323 arquivos originais e manifesto `9830e458d4d07431b0bf9384f3e82ec9425367cd2141dccf3eb2c0156afff9a0` revalidados.
- Deployment anterior, histórico e hashes das definições dos guards sem divergências. Zero queries ativas dos papéis clientes na amostra prévia; isso não é prova contínua de ausência de usuários.
- **E1a aplicada:** versão efetiva **20261120041756**, nome `editorial_foundation`. Arquivo/hash homologado preservado.
- **E1a verificada:** cinco tabelas com RLS e sem acesso direto dos clientes; quatro RPCs com grants corretos, owner postgres e search_path vazio; três backups de guard coincidentes com o preflight; exceções editoriais presentes; zero permits; contagem UTF-8 ativa em validador/importador; helpers privados sem execução anon/authenticated.
- **E2a aplicada:** versão efetiva **20261120041817**, nome `unified_lesson_packages`. Arquivo/hash homologado preservado.
- **E2a verificada:** cinco tabelas privadas protegidas; sete RPCs com separação authenticated/service_role esperada; quatro triggers de reserva habilitados; zero permits; registro no histórico.

## Falha e estado preservado

`deploy_edge_function(import-lesson-package)` rejeitou o bundle antes da ativação: faltou `src/contracts/lesson-package.v1.schema.json`. O manifesto Edge preparado pelo agente havia omitido essa dependência direta. Não é falha do SQL ou alteração de contrato; é erro de empacotamento.

Consulta posterior confirmou: **nova Edge ausente**, Edge legada `import-web-presentation` **ACTIVE v1 / JWT=true**, mesmo hash de bundle anterior. **Nenhum frontend foi enviado ou implantado.** O domínio continua no deployment **dpl_7G2T5EoP4LQrp3X4v3ABELSsmXA5**, READY, commit base d2acc6f5c7455a62ec1e4ff916273b80df7640a6.

As duas migrations commitadas permanecem instaladas e verificadas. Falha de bundle Edge não desfaz SQL; não foi executada reversão destrutiva nem restauração de backup. Não houve execução de operações editoriais sobre dados reais.

## Correção de preparação concluída localmente

O schema omitido já estava congelado e aprovado no manifesto frontend original. Foi copiado **sem alteração de bytes** para a árvore Edge. SHA-256: **50496ba0300d0b56ceebdee531ac5c4d0d7d555a1d0aec8e11adcfe67137a5bb**. Entry point continua com hash **076c0d9c5c3ba6156152d81b335feaa7c3002e72978e114c2ed18cd2bf2b69ec**.

Pacote Edge corrigido: **14 arquivos**, em `test-results/implantacao-e1a-e2a-20261120/edge-manifest-completo.json`, SHA-256 **740d46bc9def51233a7417b6121eed14bbba9a6a9d12eeb356200632eb5b85e1**. Fechamento das dependências relativas de execução conferido a partir do entrypoint, excluindo imports somente de tipos; não foram repetidas suítes PostgreSQL nem feito novo deploy. `manifest.json` original permanece intacto como registro do que foi inicialmente autorizado/enviado. `complemento-edge.json` registra a inclusão dirigida.

Evidências: `execucao-e1a.json`, `verificacao-remota-e1a.json`, `execucao-e2a.json`, `verificacao-remota-e2a.json`, `execucao-edge.json`, na mesma pasta. O erro retornado pelo serviço foi preservado.

**Retomada mínima:** após liberação para retomar a sequência interrompida, confirmar estado em leitura; não reaplicar E1a/E2a; implantar somente a Edge com os 14 arquivos; verificar JWT e autenticação; então executar frontend isolado e testes administrativos de leitura (etapas 6–7). Conteúdo real/kit/upload/publicação continuam exigindo autorização específica. O risco de ausência de restauração comprovada de backup de produção permanece aceito conforme a autorização anterior, sem garantia nova de RPO/RTO.
