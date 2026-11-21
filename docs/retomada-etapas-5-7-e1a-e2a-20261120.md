# Retomada autorizada das etapas 5–7 — 20/11/2026

> **Continuação posterior autorizada:** CLI autenticada e upload concluído; build remoto falhou por três arquivos omitidos do pacote. O frontend anterior continua publicado. Estado e correção mínima proposta em [resultado-frontend-cli-e1a-e2a-20261120.md](resultado-frontend-cli-e1a-e2a-20261120.md). Aguardar autorização antes de corrigir ou repetir.

**Etapa 5 concluída. Etapa 6 interrompida no envio; etapa 7 não iniciada.** Nova falha do transporte Vercel requer autorização antes de mudar o método. Não houve criação de deployment, troca de domínio, reexecução de migration, kit, importação ZIP, rascunho, publicação de aula, push ou merge.

## Estado efetivamente publicado

- E1a `editorial_foundation`: **20261120041756**; E2a `unified_lesson_packages`: **20261120041817**. Histórico remoto reconfirmado por leitura antes da retomada. Nenhuma migration reaplicada.
- Nova Edge `import-lesson-package`: **ACTIVE v1**, **JWT=true**, import map ativo, bundle SHA-256 **2862310a5ab9dd5ec32b99ba6b70897a8b2d49935fd50c6b7abd65defeabfd97**. Implantada somente com os 14 arquivos do manifesto corrigido **740d46bc9def51233a7417b6121eed14bbba9a6a9d12eeb356200632eb5b85e1**.
- Requisições POST vazias sem credenciais e com JWT inválido recusadas com **401**. Nenhum ZIP ou dado foi enviado à Edge. A sessão administrativa positiva na interface continua pendente; esses testes negativos não a substituem.
- Edge legada `import-web-presentation`: preservada, **ACTIVE v1 / JWT=true**, hash **7255e12697530fd1c1f8f4621fafdff58f4067a6400a4e47f65150591f7efe25**.
- Frontend servido na Bitaria: **dpl_7G2T5EoP4LQrp3X4v3ABELSsmXA5**, READY/production, commit **d2acc6f5c7455a62ec1e4ff916273b80df7640a6**, origem `release/a02-reconciliation-20261112`. A interface E1a/E2a **ainda não está publicada**. O deployment anterior continua disponível para rollback.

## Falha de transporte e interrupção

Dos 308 arquivos congelados do frontend, 301 tiveram retorno de envio sem erro. O envio de `src/assets/6.png` (3.732.756 bytes, SHA1 **77715aad5e82fd08c5f2edb3081d254bf9dbb793**) retornou `POST /v2/files: outcome unknown` pelo conector Vercel. Não é evidência de falha do build ou do código, e não se afirma que o arquivo não chegou ao armazenamento.

Após a instrução da usuária “continue”, foi reconfirmado que o domínio ainda servia o deployment anterior. A consulta de leitura ao endereço de armazenamento não resolveu a incerteza (403). Um reenvio do mesmo arquivo pelo mesmo SHA1 recebeu novamente resultado inconclusivo. A sequência foi então interrompida sem nova correção nem criação de deployment. Não se interpretou o resultado como autorização para mudar para Git, publicar outra árvore, reduzir imagens ou modificar o produto.

Faltam confirmação desse arquivo e envio/confirmação de outros seis recursos. Lista, referências dos 301 arquivos e respostas preservadas em `test-results/implantacao-e1a-e2a-20261120/resultado-retomada-etapas-5-7.json`; cópia dos envios confirmados em `frontend-upload-confirmados.json`. Os fontes congelados permanecem intactos, com manifesto **9830e458d4d07431b0bf9384f3e82ec9425367cd2141dccf3eb2c0156afff9a0**.

## Retomada proposta, ainda não executada

Solicitar autorização para trocar **somente o transporte de publicação do frontend para CLI Vercel autenticada**, usando exclusivamente a pasta congelada `test-results/implantacao-e1a-e2a-20261120/frontend`, mesmo projeto/time e ambiente production, sem push/merge. A CLI estava sem autenticação na preparação; a usuária precisará concluir `vercel login` localmente, sem compartilhar token ou senha. Conferir o alvo explicitamente antes de publicar; não iniciar vinculação a projeto novo ou alterar variáveis automaticamente.

Depois da confirmação do frontend publicado, concluir somente a leitura administrativa das telas combinadas com a usuária. Não reaplicar SQL, reimplantar Edge legada ou criar conteúdo. Os riscos de locks globais e ausência de restauração de backup de produção comprovada continuam conforme o plano autorizado.
