# Prévia de materiais do Google Drive para o aluno

Correção de 23/10/2026 em `ActivityRenderer.tsx` e `learningProgress.ts`.

O PDF da Aula 1 e o mapa mental estavam configurados com links `drive.google.com/file/d/.../view`. O componente usava esse endereço diretamente em um iframe com `sandbox=""`, impedindo os scripts e a origem necessários ao visualizador do Google.

A renderização agora transforma os links reconhecidos do Drive em `/preview` e preserva a chave `resourcekey` quando presente. Apenas o visualizador do domínio exato `drive.google.com` recebe `allow-scripts allow-same-origin`. PDFs de outros domínios mantêm o sandbox restrito. O link para outra aba preserva o endereço original; o estudo continua exigindo confirmação explícita pelo aluno. Não precisa reimportar o JSON nem modificar os registros do conteúdo.

Metadados consultados pelo conector Google Drive confirmaram `anyone/reader` nos PDFs `HTML-M01-S01-A01-slides.pdf` e `HTML-M01-S01-A01-mapa-mental.pdf`. Nenhuma permissão de compartilhamento foi alterada. O acesso à conta da plataforma não concede acesso automático a materiais privados do Google; o arquivo deve estar compartilhado de forma apropriada para os alunos.

Validação local: nove testes em `learning-progress.test.mjs`, teste de navegador `student-resource-browser.test.mjs` com visualizador controlado (execução de script somente no visualizador permitido, URL de prévia, link original e nenhuma conclusão automática), TypeScript/Vite e ESLint aprovados. O teste externo opcional pode ser executado com `TEST_LIVE_GOOGLE_PREVIEW=1`; depende de acesso de rede ao Google e não é parte da bateria determinística.

Verificação externa também aprovada: Chrome em contexto novo, identidade de aluno na aplicação local e sem login no Google, carregou o arquivo real `HTML-M01-S01-A01-slides.pdf` dentro do iframe e identificou suas nove páginas. Sem mensagem de solicitação de acesso e sem erros JavaScript. A prévia real foi inspecionada visualmente em `test-results/student-drive-viewer-live.png`; a tela completa está em `test-results/student-drive-preview-live.png`.

Referências: [chaves de recursos do Google Drive](https://developers.google.com/workspace/drive/api/guides/resource-keys) e [orientações do Google para conteúdo incorporado](https://workspaceupdates.googleblog.com/2023/10/upcoming-changes-to-third-party-cookies-in-google-drive.html).
