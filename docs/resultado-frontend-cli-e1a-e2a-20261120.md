# Resultado da publicação por CLI — 20/11/2026

> **Superado pela retomada autorizada:** pacote de 311 arquivos validado e frontend E1a/E2a publicado READY. Estado vigente em [implantacao-e1a-e2a-publicada-20261120.md](implantacao-e1a-e2a-publicada-20261120.md). O erro e o procedimento abaixo permanecem como histórico.

**Etapa 6 interrompida no build remoto. Nenhuma nova tentativa ou correção realizada.** Etapa 5 permanece concluída; etapa 7 ainda não iniciada.

A CLI foi autenticada pela usuária e o projeto/time conferido: `prj_2vX60y3APQN45VaxtdvKHm7c89FT`, `andrea-francas-projects`. Os 308 arquivos presentes no manifesto frontend tiveram os hashes revalidados; o upload concluiu pela CLI. Essa conferência de hashes não detectou arquivos omitidos do próprio manifesto.

Deployment tentado: **dpl_AWs9QJTNsnX4CMZTmsN7LZkZbdAF**, URL `plataforma-ensino-lk06ea62x-andrea-francas-projects.vercel.app`, estado **ERROR**, erro `module_not_found` durante `npm run build`/TypeScript. A consulta posterior confirmou que o domínio Bitaria continua no deployment anterior **dpl_7G2T5EoP4LQrp3X4v3ABELSsmXA5**, READY, commit **d2acc6f5c7455a62ec1e4ff916273b80df7640a6**. Não foi necessário rollback, pois o frontend novo não entrou em produção.

## Causa comprovada no pacote preparado

A lista usada pelo agente para congelar os arquivos copiou fontes presentes em HEAD e uma lista de arquivos novos. Dois arquivos editoriais novos, já staged e homologados, foram classificados na lista de modificados mas não incluídos na lista efetiva de cópia. Por isso não constam em `manifest.frontend` nem na pasta enviada, embora apareçam em `frontendChanges.modified`:

- `src/lib/editorialLessons.ts` — SHA-256 atual do arquivo existente: **82005ce4e0633fde5f17a80b1f09876c7db4eec6d043ae8534af5907a1ce5bf0**.
- `src/components/learning/EditorialLessonEditor.tsx` — SHA-256 atual: **d2591fff16e4fbb2121e76dd739ceb84989d7681e5da5fc84f202745cf6e5e59**.

Além disso, a seleção por pastas excluiu uma dependência frontend já existente fora de src/public:

- `supabase/functions/_shared/meet-link.ts` — SHA-256 atual: **79b0998bc059747af67468c0de18f7941e458ab260f890287b9e17c64915e268**. É importada por MeetSchedulingFields e TeacherScheduling; incluir esse arquivo no build **não é implantar uma Edge Function nem alterar a agenda**.

Assim, a falha é de preparação do artefato entregue pelo agente. Não foi comprovado defeito nos módulos do produto. O build anteriormente aprovado no checkout completo não validava a completude desta pasta isolada; não deve ser apresentado como validação desse pacote de 308 arquivos.

## Estado e retomada mínima proposta

- Migrations E1a/E2a permanecem nas versões **20261120041756 / 20261120041817**, sem reaplicação.
- Edge nova permanece **ACTIVE v1 / JWT=true**, já verificada na etapa 5; nenhuma Edge foi reimplantada nesta tentativa CLI.
- Não houve kit, importação, rascunho, publicação de aula, modificação de dados de alunos, push ou merge.
- Evidência estruturada: `test-results/implantacao-e1a-e2a-20261120/resultado-cli-frontend.json`. A árvore remota consultada da tentativa confirmou a ausência desses módulos.

**Aguardar nova autorização**, conforme a regra de interrupção: incluir somente os três arquivos existentes acima, gerar manifesto corrigido de 311 arquivos, conferir fechamento das dependências e validar o build da própria pasta isolada; depois repetir apenas o deploy frontend pela CLI e a verificação administrativa de leitura. Não reaplicar migrations, não reimplantar Edge e não iniciar outro desenvolvimento. Nenhuma dessas correções ou novo deploy foi executado nesta rodada.
