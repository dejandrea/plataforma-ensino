# E1a + E2a publicada — 20/11/2026

**Etapas 1–6 concluídas. Etapa 7: verificações remotas de leitura/autenticação aprovadas; confirmação manual da interface administrativa solicitada e ainda pendente.** Não declarar a etapa 7 integralmente concluída sem esse retorno.

## Versão efetivamente publicada

- Domínio: **https://plataforma-ensino-chi.vercel.app**.
- Deployment frontend: **dpl_FUJ4esvXUevvPbJ4Tj4P4nsZGAeL**, **READY**, production, projeto `prj_2vX60y3APQN45VaxtdvKHm7c89FT`, time `andrea-francas-projects`.
- Manifesto frontend corrigido de **311 arquivos**: **979ba2347d245a87402dd6f268a31bde465f4bf57a2d23f2ad581af3455bd373**. Todos os arquivos da árvore remota correspondem aos arquivos locais por hash; árvore remota completa (311/311), sem divergências.
- Base de código: commit **d2acc6f5c7455a62ec1e4ff916273b80df7640a6** + alterações E1a/E2a do manifesto. Não existe commit novo desta entrega; sua identidade exata é o deployment/manifesto. Nenhum push/merge realizado.
- Bundle servido: `/assets/index-BCCsvWxq.js`, SHA-256 **7d0d2bcb8ea50f6f8e5b144765320761c1a70684ec929be9de45be0f2dfc1d28**, idêntico ao build isolado de produção. Módulos EditorialLessonEditor e UnifiedLessonImporter disponíveis com HTTP 200.
- Supabase utilizado pelo bundle publicado: **gnyiyhnbpjhdgrhsevbh**; nenhum valor de chave impresso.
- E1a: **20261120041756 / editorial_foundation**; E2a: **20261120041817 / unified_lesson_packages**, histórico reconfirmado por leitura, **sem reaplicação**.
- Nova Edge `import-lesson-package`: **ACTIVE v1 / JWT=true**, bundle **2862310a5ab9dd5ec32b99ba6b70897a8b2d49935fd50c6b7abd65defeabfd97**, sem reimplantação nesta rodada.
- Edge legada `import-web-presentation`: **ACTIVE v1 / JWT=true**, bundle preservado **7255e12697530fd1c1f8f4621fafdff58f4067a6400a4e47f65150591f7efe25**.
- Deployment anterior **dpl_7G2T5EoP4LQrp3X4v3ABELSsmXA5** preservado e confirmado READY para eventual rollback de aplicação. Não houve rollback.

## Build e envio do pacote corrigido

Incluídos somente os três arquivos autorizados, sem alteração de bytes: `src/lib/editorialLessons.ts`, `src/components/learning/EditorialLessonEditor.tsx`, `supabase/functions/_shared/meet-link.ts`. Nenhum arquivo adicional de produto foi incluído.

`npm ci` executado e aprovado **na própria pasta frontend isolada**. Verificação de hashes e de completude: 311 arquivos / 440 imports e recursos resolvidos / zero dependências ausentes. O verificador auxiliar normalizou caminhos Windows; não houve correção nos fontes. O carregador auxiliar foi substituído, com autorização, pelo parser nativo `node:util.parseEnv`.

Configuração production obtida sem mostrar valores. Apenas os dois parâmetros públicos VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY foram passados ao processo do build. `npm run build` isolado de produção aprovado; Node local 22.19.0, build remoto Node 24.x conforme projeto Vercel. Saída compilada local preservada em `frontend-build-producao-311`, fora da pasta enviada. `.vercel` e node_modules não foram publicados; a árvore remota comprova os 311 arquivos de fonte exatos. O build remoto também aprovou TypeScript/Vite, recebeu 311 arquivos e atribuiu o domínio de produção.

Avisos preservados: Browserslist antigo e chunks grandes não impediram o build. O audit automático de npm ci reportou 24 vulnerabilidades (2 low / 9 moderate / 13 high); não houve alteração de dependências ou audit fix fora do escopo. Isso não é declaração de segurança integral da base de dependências.

## Verificações da etapa 7

- HTTP 200 no domínio e nos módulos novos; bundle servido idêntico ao build aprovado, host Supabase correto.
- RPCs somente leitura `admin_editorial_lesson` e `lesson_package_state` recusaram papel anon com **401**; alvo da consulta era UUID sintético, sem dados reais.
- Nova Edge recusou chamada anônima com **401**. Nas etapas anteriores, chamadas sem credenciais e com token inválido também receberam 401. Nenhum ZIP foi enviado.
- Positivo administrativo: solicitado à usuária abrir, com sua sessão, “Editar conteúdo e rascunho” e “Pacote completo / Kit Work”, apenas leitura; sem exportar kit, selecionar ZIP, salvar ou publicar. **Aguardando confirmação.**

## Evidências e limites

Em `test-results/implantacao-e1a-e2a-20261120/`: `frontend-manifest-311.json`, `fechamento-frontend-311.json`, `build-producao-311-aprovado.json`, `verificacao-frontend-publicado-311.json`, `verificacao-acesso-anon-311.json` e `resultado-publicacao-frontend-311.json`. Os relatórios anteriores permanecem históricos e são superados por este quanto ao estado do frontend.

Nenhuma migration reaplicada, Edge reimplantada, kit criado, ZIP importado, rascunho salvo, aula publicada ou dado pedagógico/aluno modificado nesta rodada. Não foram repetidos testes PostgreSQL nem iniciada nova funcionalidade. A primeira produção/importação real continua exigindo autorização específica de pacote/aula.

Ressalvas continuam: locks globais em publicações editoriais; não realizar publicação grande durante uso pedagógico. Restauração de backup de produção não comprovada; voltar frontend não reverte SQL ou arquivos Storage. Esse risco não foi eliminado pelo deploy.
