# Atividade de vídeo no contrato v2

Implementação local de `video` com arquivo do Google Drive. As aulas existentes e o contrato v1 permanecem válidos. A inclusão de vídeo é opcional; quando presente, o campo `required` decide se a atividade participa dos requisitos de conclusão da aula.

## Autoria e visualização

O [exemplo de JSON](examples/video-html.v2.json) contém vídeo obrigatório e slides opcionais. Os IDs e a chave de acesso são fictícios: substitua a URL por um arquivo de vídeo compartilhado com o aluno. Os títulos da hierarquia e da aula devem corresponder ao destino da importação.

O conteúdo de vídeo tem `schemaVersion: 2`, `type: "video"` e `resourceUrl`. Usa os mesmos campos comuns das outras atividades, incluindo título, descrição, duração, ordem, pré-requisitos, obrigatoriedade e gamificação opcional. Não admite HTML, pontos, flags de conclusão automática nem propriedades desconhecidas.

São aceitos arquivos HTTPS de `drive.google.com` nos formatos `/file/d/ID`, `/file/u/N/d/ID`, `/open?id=ID` e `/uc?id=ID`. A prévia reutiliza `resourcePreview`, normaliza para `/file/d/ID/preview` e preserva `resourcekey` e `authuser`. Somente esse visualizador recebe `allow-scripts allow-same-origin` e permissão de tela cheia; não há autoplay nem domínios arbitrários de iframe.

O aluno vê título, descrição e duração no painel da atividade, o vídeo em proporção 16:9, o link original para abrir em nova aba e a ação de recarregar. Links inválidos não geram iframe nem link externo. Falhas de iframe que o navegador sinaliza apresentam uma mensagem com recuperação. O navegador não permite inspecionar os erros internos do player do Drive: por isso a orientação sobre acesso e o link externo permanecem disponíveis mesmo quando um erro do player não gera `onError`. O componente não detecta fim de reprodução.

O botão **Concluir vídeo** chama a RPC existente `complete_student_study` apenas com o ID da atividade. O backend verifica aluno ativo, acesso curricular, publicação e pré-requisitos, grava o progresso e reutiliza os gatilhos atuais de conclusão e gamificação. A regra oficial `activity_study` fornece 10 XP; a unicidade do ledger mantém um único recibo por aluno e atividade. A regra vale também sem metadados explícitos de gamificação.

A prévia administrativa usa o mesmo renderizador com confirmação desabilitada. Abrir, reproduzir ou recarregar um vídeo na prévia não chama RPCs de aluno nem grava progresso ou XP.

## Arquivos

| Área | Arquivos |
|---|---|
| Contrato e validação | `src/contracts/learning-content.v2.schema.json`, `src/types/learning.ts`, `src/lib/learningContent.ts` |
| URL e player | `src/lib/learningProgress.ts`, `src/components/learning/VideoActivity.tsx`, `ActivityRenderer.tsx` |
| Lista e administração | `LessonActivityList.tsx`, `LessonContentImporter.tsx`, `AdminLessonPreview.tsx` |
| Banco | `supabase/migrations/20261023224551_video_learning_activity.sql` |
| Testes | `tests/video-learning.test.mjs`, `tests/video-learning-browser.test.mjs`, `tests/fixtures/video-content.mjs`, harness de navegador e comparação histórica em `tests/official-xp.test.mjs` |
| Autoria | `docs/contrato-conteudo-v2.md`, `docs/guia-producao-atividades-interativas.md`, `docs/regras-xp-v1.md`, exemplo JSON |

## Migration e implantação

A migration foi criada pela CLI e testada em PostgreSQL isolado via PGlite, incluindo reaplicação e integração com as migrations atuais de catálogos, conquistas, avaliações de projetos e permissões de perfil. Acrescenta apenas a variante de vídeo ao schema v2 armazenado e ao CHECK dos tipos; estende as funções existentes de validação de recompensa, estudo e crédito de XP. Não cria RPCs, tabelas, políticas, grants ou outra regra de pontos. `CREATE OR REPLACE` preserva ACLs, modos de segurança e `search_path`, verificados por consulta no teste. Não altera dados de aulas existentes nem recalcula recibos.

Aplicada em produção em 25/10/2026 no projeto `gnyiyhnbpjhdgrhsevbh`, após autorização explícita do usuário. A execução direcionada usou a transação do arquivo e registrou somente a versão `20261023224551` no histórico. O push geral foi interrompido na simulação por divergências históricas de outras migrations, que foram preservadas.

Após a aplicação, consultas de leitura no banco confirmaram que `HTML-M01-A00-aula.v2.admin.revisao.json` passa no contrato v2, seus conteúdos e recompensas são válidos, o CHECK aceita `video` e `activity_study` continua em 10 XP. ACLs, modos de segurança e `search_path` das três funções permaneceram iguais; a comparação dos advisors não encontrou novos avisos de segurança. Nenhuma aula foi importada e nenhum progresso ou recibo de aluno foi alterado pela aplicação.

Uma reversão após uso precisa preservar o conteúdo e o histórico de vídeo; não remover o tipo enquanto houver atividades que o utilizem.

## Verificação reproduzível

Resultados locais: build de produção concluído; ESLint dos oito arquivos TypeScript/TSX alterados sem erros; 13 verificações de vídeo em contrato/banco, 104 de regressão e quatro testes de navegador passaram. Foram verificadas as ACLs antes/depois da migration e sua reaplicação. O fluxo de navegador cobre importação/publicação, desktop e celular, falha de acesso ao Drive, erro ao salvar e nova tentativa, confirmação pelo teclado, revisão após recarga e ausência de XP duplicado. As prévias salvas e os materiais de estudo existentes têm cobertura separada.

- `npm run test:video`: contrato, importação real, progresso, XP e navegador.
- Regressão de banco/contrato: `node --test --experimental-test-isolation=none tests/video-learning.test.mjs tests/learning-content.test.mjs tests/learning-progress.test.mjs tests/interactive-contract.test.mjs tests/official-xp.test.mjs tests/student-learning.test.mjs tests/interactive-learning.test.mjs tests/teacher-learning.test.mjs`.
- Regressão de prévia e materiais: `node --test --test-concurrency=1 tests/video-learning-browser.test.mjs tests/student-resource-browser.test.mjs tests/admin-lesson-preview.test.mjs`.
- `npm run build` e ESLint dos componentes, bibliotecas e tipos alterados.

Os testes verificam vídeos obrigatórios/opcionais, aulas sem vídeo, URLs e chaves de acesso, bloqueio de domínios e payloads inválidos, pré-requisitos, importação em rascunho e publicação, conclusão via teclado, erro recuperável ao salvar, 10 XP, reenvio, reabertura, recarga, permissões e ausência de efeitos na prévia. O banco executa as funções reais sob os papéis autenticados; no navegador somente o transporte PostgREST/autenticação e os recursos externos são simulados.

Evidências visuais geradas em `test-results/`:

- `video-admin-preview.png`
- `video-student-desktop.png`
- `video-student-mobile.png`

O visualizador do Drive nas imagens é uma simulação identificada como tal. Os testes validam URL, permissões do iframe, layout e integração local; não comprovam a reprodução de um arquivo real nem suas permissões de compartilhamento no Google Drive.
