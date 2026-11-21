# Produzir uma aula para a Bitaria — pacote v1

Leia primeiro identidade.json e os schemas deste kit. O kit NÃO é o ZIP de importação.
Use exatamente lesson_id, lesson_key, contexto, origem HTTPS e identidades de apresentações fornecidos. Não invente UUIDs ou URLs gerenciadas. A primeira entrega aceita somente aula curricular existente, vazia e sem histórico.

Entregue um único ZIP com manifest.json, aula.json e zero a três ZIPs em apresentacoes/{key}.zip. Arquivos na raiz, sem pasta envolvente. Não inclua este README, schemas, originais, relatórios ou arquivos administrativos no ZIP final. Use schemas/lesson-package.v1.schema.json para o manifesto e learning-content.v2.schema.json para aula.json. O exemplo ZIP é sintético; substitua seu conteúdo antes de qualquer uso pedagógico real.

O manifesto declara packageVersion:1, productionId estável para essa produção, targetLessonId e platformOrigin do kit. files contém aula.json e os ZIPs internos com tamanho EXATO em bytes e SHA-256 hexadecimal minúsculo dos bytes finais. Não inclua manifest.json no seu próprio inventário. Alterar um arquivo exige recalcular tamanho/hash. Uma productionId não pode ser reutilizada com conteúdo diferente.

Use somente slots de apresentações fornecidos: principal, revisao e complementar. Pode utilizar nenhum, um, dois ou três. Cada entrada presentations informa key, activityKey de uma atividade slides, presentationId fornecido e path apresentacoes/{key}.zip. A atividade deve manter format:link e resourceUrl exatamente {platformOrigin}/apresentacoes/gerenciada/{presentationId}. Não invente URL definitiva nem um viewer novo.

Cada ZIP interno segue o importador web existente: apresentacao.json OU decks/nome.json; images/ com os arquivos referidos por ./images/nome.webp/png/jpg/jpeg; creditos-imagens.md recomendado. JSON no contrato apresentações v1. Arquivos de imagem verdadeiros, texto alternativo e atribuições/licenças. Use o catálogo oficial da Bitara para mascot.category, sem criar ou substituir poses. Nada de HTML, JS, SVG, executáveis, atalhos ou caminhos relativos ascendentes.

Limites: ZIP externo 25 MiB; conteúdo externo expandido 32 MiB; conteúdo efetivo expandido 50 MiB; manifesto 64 KiB; aula.json 2.000.000 bytes; até 200 atividades. Máximo três apresentações e 10 MiB por ZIP interno, respeitando também seus limites próprios de arquivos/imagens. Não preencher artificialmente os limites.

Atividades: reutilize video, slides, flashcards, interactive, mindmap, quiz, online_lesson e project nos contratos existentes. Os slides web não concedem XP por si mesmos. Perguntas de uma apresentação são pausas de estudo; quizzes avaliativos pertencem às atividades quiz/interactive, com gabaritos exclusivamente em teacherOnly. Plano docente fica em teacherOnly.lessonPlans. Referências docentes externas podem ser declaradas em teacherResources; não repita esses URLs no conteúdo público.

Vídeos, PDFs, mapas e materiais permanecem no Google Drive. Use referências HTTPS sem credenciais e configure o compartilhamento correto; não envie os arquivos binários desses materiais. Referências de pesquisa externas legítimas continuam possíveis no contrato. Não é necessário acesso à API Drive. O validador não comprova permissão nem licença dos links: sinalize pendências para revisão humana.

Use a regra central de recompensa apropriada; não coloque valores fixos de XP. Flashcards concluem somente após todos os versos revisados. Inclusão, prévia e publicação não concedem XP. Não crie atividades opcionais como obrigatórias por conveniência.

A administradora importa o ZIP, revisa, confirma salvar rascunho privado e depois confirma publicar o conjunto. Não marque a produção como publicada, não reimporte o JSON administrativo de outra aula e não presuma atualização de aulas com histórico. Uma importação interrompida é retomada reenviando o mesmo pacote. A publicação curricular da aula continua separada.
