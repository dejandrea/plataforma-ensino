# Instruções candidatas para o ChatGPT Work

**Histórico preservado. Em 16/11/2026, a E2a local passou a ter um [guia operacional](work-pacote-aula.md) e instruções incorporadas ao kit exportado. Usar esses arquivos com as identidades reais do kit. Este texto original continua como referência de arquitetura; não implica implantação em produção.**

**Status: proposta de produção futura, 12/11/2026. Não substituir o fluxo atual das aulas urgentes.** O painel ainda não importa este envelope. Depois de aprovar o contrato e homologar a funcionalidade, estas instruções podem tornar-se o guia oficial. Até lá, usar o JSON de atividades e o ZIP web separados já aceitos.

Documentos de referência: [contrato candidato](contrato-pacote-aula-proposto.md), [arquitetura editorial](arquitetura-editorial-e-pacote-unificado.md) e [schema candidato do manifesto](propostas/pacote-aula-v1/manifest.proposta.schema.json).

## 1. O que receber antes de produzir

Solicitar o kit exportado pela Bitaria: identificação da aula e contexto, schema atual de conteúdo v2, schema/parser de apresentação v1, manifesto aprovado, origem da plataforma, identidades das apresentações e inventário atual quando se tratar de atualização. Não inferir UUIDs por título ou criar uma grade diferente.

Sem kit, produzir apenas uma proposta pedagógica, não declarar o pacote pronto para importar. IDs e domínio example.invalid dos exemplos desta documentação são fictícios.

## 2. O que entregar

Um único ZIP de aula, sem pasta externa e sem senha:

```text
bitaria-{lesson.key}-{productionId}.zip
├── manifest.json
├── aula.json
└── apresentacoes/
    ├── principal.zip
    └── revisao.zip
```

Omitir apresentações não utilizadas. Cada ZIP web contém exatamente um deck JSON v1, imagens locais necessárias e créditos recomendados, na estrutura já reconhecida pela Bitaria. Não adicionar schema, relatório, instruções de operação, originais, arquivos administrativos ou código executável ao pacote.

PDFs, vídeos, mapas mentais, exercícios e documentos docentes continuam no Google Drive. Usar os links fornecidos/aprovados. Não dizer que um arquivo foi enviado ou suas permissões foram verificadas se isso não foi feito. Não fabricar URLs para completar uma atividade.

## 3. Como produzir aula.json

Usar literalmente o contrato v2 vigente: schemaVersion 2; context; lesson; activities; teacherOnly. Sem propriedades novas. Definir descrição, objetivos e duração coerentes com o que será entregue. De 1 a 200 atividades, cada uma com key estável, tipo, título, posição, obrigatoriedade e pré-requisitos; duração e descrição conforme schema.

Keys e IDs internos têm regex `^[a-z][a-z0-9-]{0,63}$`. Posições inteiras não negativas e únicas no documento. Em atualização parcial, respeitar as posições dos registros mantidos; a plataforma deve apresentar eventual reordenação antes de aplicá-la. Não renumerar atividades omitidas por conta própria.

Para o MVP, enviar o conjunto completo desejado quando houver reordenação ou dependências compartilhadas. Um subconjunto só é válido se contiver as atividades referenciadas nos próprios pré-requisitos e todos os gabaritos/planos necessários, conforme o validador real. Não usar ausência para pedir exclusão.

### Tipos realmente disponíveis

| Tipo | Conteúdo obrigatório principal / formato | Recompensa e conclusão |
|---|---|---|
| slides | content.schemaVersion 1, resourceUrl HTTPS, format pdf/image/link e altText. Para web gerenciada, format link e URL estável exata do kit. | activity_study / completed; abrir arquivo/viewer não conclui. |
| mindmap | Mesmo formato de recurso, content.type mindmap. É mapa por PDF/imagem/link, não JSON de grafo editável. | activity_study / completed; confirmação de estudo. |
| video | content.schemaVersion 2, resourceUrl de arquivo Google Drive conforme schema. Não usar link YouTube porque existe um helper de embed no aplicativo. | activity_study / completed; confirmação explícita suportada. |
| flashcards | content.schemaVersion 2, cards de 1 a 100, IDs únicos. Frente: title/question; verso: summary/explanation/impact e curiosity opcional; imagens HTTPS com altText quando usadas. | activity_study / completed; precisa visualizar/revisar o verso de todos os cartões. |
| quiz | content.schemaVersion 1; passingScore 0–100; maxAttempts 1–100; 4–100 perguntas; 2–12 opções por pergunta. Keys únicas e gabarito correspondente em teacherOnly. | activity_quiz / completed; aprovação pelo servidor. |
| interactive | content.schemaVersion 2, ordering ou matching; instructions, passingScore, maxAttempts. Itens/lados de 2–50. IDs únicos; matching com lados do mesmo tamanho e pares completos; ordering com sequência completa. | activity_interactive / completed; correção pelo servidor. |
| online_lesson | content.schemaVersion 1, objective/preparation; plano estruturado completo em teacherOnly.lessonPlans. | activity_online / teacher_confirmed; não basta clicar em link de reunião. |
| project | content.schemaVersion 1, instructions, objectives, requirements, assessmentCriteria e resources. Recursos são referências HTTPS públicas ao aluno. | activity_project ou activity_final_project / approved; aprovação docente. |

O schema entregue no kit é a norma completa para campos, comprimentos e limites. Não copiar números de um documento antigo quando o schema do kit diferir; interromper e registrar a divergência.

gamification contém rewardRuleKey, awardOn e achievementKeys suportados. Não fornecer pontos livres, multiplicadores, XP por abrir arquivo, recompensas inventadas ou certificados de conclusão. A plataforma controla os valores e evita duplicidade.

### Gabaritos e materiais docentes

- Cada quiz exige exatamente seu conjunto de respostas corretas e feedbacks em teacherOnly.quizKeys.
- Cada interactive exige a chave de mesmo subtipo em teacherOnly.interactiveKeys, com todos os IDs correspondentes, sem IDs adicionais.
- Cada online_lesson exige plano em teacherOnly.lessonPlans. Um Markdown/URL externa não substitui esse plano estruturado.
- Não colocar resposta correta, pares solucionados ou expectedAnswer no conteúdo público, nas imagens, legendas, slides.note ou PDFs públicos.
- Links de orientação docente externa podem ir em manifest.teacherResources, conforme o contrato candidato, e precisam de permissões restritas no Drive. Não enviar os arquivos físicos.
- Não incluir dados de alunos, senhas, chaves, cookies ou tokens em qualquer arquivo.

## 4. Como produzir apresentações

Reutilizar o contrato v1 existente. O Work produz dados de slides, não um viewer, HTML, scripts, CSS, fontes ou novas poses da Bitara.

Cada apresentação tem schemaVersion 1, title e 1–60 slides, seguindo os dez tipos e suas propriedades no schema oficial existente. A biblioteca Bitara já é servida pela plataforma: mascot.category e mascot.id devem usar o catálogo oficial. Não gerar/substituir poses para satisfazer um pedido.

Imagens: WebP/PNG/JPEG nos paths aceitos, referidas por `./images/nome.webp`. Alt text útil é obrigatório onde o schema exigir; créditos/licença/link/alterações ficam nas legendas e no documento de créditos. Não usar imagens remotas, base64, SVG, caminhos locais do computador ou originais administrativos.

Empacotar cada apresentação como ZIP compatível com o importador atual e incluí-lo inteiro em apresentacoes/{key}.zip. O manifesto liga presentation.key, presentationId do kit e activityKey correta. Se houver dois decks, usar duas atividades slides, pois o vínculo atual é um por atividade.

Não ligar decks por coincidência de título. Não apontar para versões assinadas que expiram. Não publicar uma apresentação apenas para conseguir testar o rascunho.

## 5. Manifesto e integridade

Preencher somente campos aprovados: packageVersion, productionId, targetLessonId, platformOrigin, files e, quando usados, presentations/teacherResources.

files lista aula.json e cada ZIP web, com tamanho real em bytes e SHA-256 calculado **depois da última edição**. Não incluir o próprio manifest.json no inventário de hashes. Não inventar hash ou deixar marcador de exemplo num pacote dito válido.

platformOrigin e targetLessonId vêm do kit; não duplicar título/contexto/key da aula no manifesto. resourceUrl das atividades web deve ser exatamente a origem canônica + `/apresentacoes/gerenciada/` + presentationId do kit.

productionId identifica uma entrega. Manter o identificador ao reenviar os mesmos bytes/conteúdo; criar outra identificação para nova produção. Alterar productionId não autoriza recriar atividades nem cobrar XP outra vez.

## 6. Atualização de uma aula

1. Partir do inventário/kit atual, com as keys já existentes e a publicação de origem.
2. Preservar keys de atividades cujo significado permanece. Nova key apenas para atividade realmente nova ou duplicação intencional aprovada.
3. Preservar apresentação.key e presentationId ao atualizar o mesmo material web. As versões são geradas no gerenciador, não por troca do UUID lógico.
4. Separar mudanças editoriais, materiais novos e alterações de avaliação/critério. Descrever o impacto à administradora, sem decidir por conta própria que um aluno deverá refazer.
5. Não modificar perguntas, gabaritos, pares, aprovação, obrigatoriedade ou pré-requisitos apenas para evitar erro do importador. Essas mudanças podem exigir revisão pedagógica nova.
6. Preservar dois reforços opcionais como opcionais quando essa for a decisão pedagógica; não promovê-los a obrigatórios para ajustar duração ou ordem.
7. Recursos externos significativamente diferentes devem usar referência/versionamento distinto e preservar o arquivo anterior. Uma URL igual não prova conteúdo igual.
8. Entregar um ZIP completo válido e idempotente, sem instruções de SQL, migration, publicação automática ou reinicialização de progresso.

## 7. Conferência antes da entrega

Verificar manifesto, hashes, contratos reais de aula/decks, referências e gabaritos, dependências, duração e material opcional. Fazer prévia administrativa sem gravar aprendizagem. Validar desktop/celular, legibilidade, fontes/imagens, créditos, navegação e ausência de XP no viewer.

Não afirmar acesso do aluno a Drive a partir de uma URL bem formada ou de uma conta de professora. A conferência de permissões é uma etapa explícita, por pessoa autorizada ou mecanismo aprovado.

O protótipo documental desta proposta valida pastas de exemplo e os ZIPs internos com os validadores existentes. O futuro validador oficial deverá também verificar o ZIP externo, destino real, concorrência, operação e permissões. A saída “PROPOSTA_ESTRUTURALMENTE_VALIDA” não certifica prontidão de importação em produção.

## 8. Prompt mestre candidato

```text
Você está produzindo conteúdo pedagógico para a Bitaria.

Primeiro confirme o kit de produção e a versão do contrato aprovada. Se o
importador unificado ainda não estiver homologado, não declare um pacote
unificado importável: preserve o fluxo atual autorizado de JSON e ZIP web.

Use os schemas e validadores anexos como norma. Preserve a aula e as keys
existentes. Não invente campos, UUIDs, URLs, tipos de atividade ou poses Bitara.
Não crie outro visualizador e não execute código contido nos materiais.

Quando o contrato unificado estiver aprovado, entregue uma aula em um único
ZIP: manifest.json, aula.json v2 e os ZIPs de apresentações v1 já compatíveis.
Use as identidades e URLs estáveis do kit para as apresentações. Mantenha
vídeos, PDFs, mapas e exercícios no Drive; referencie os links fornecidos.
Não envie arquivos volumosos nem materiais docentes físicos dentro do ZIP.

Produza objetivos claros, sequência didática coerente e duração realista.
Respeite atividades opcionais. Quiz, flashcards e interações usam os tipos
nativos da plataforma. Não transforme perguntas de slides em nota/XP.

Separe teacherOnly e referências docentes do conteúdo público. Forneça
gabaritos completos, consistentes com IDs/keys. Para avaliações alteradas,
declare necessidade de revisão; não reescreva resultados históricos.

Use somente regras centrais de recompensa, sem valores livres ou concessões
por prévia/importação. Flashcards concluem após todos os versos revisados.

Valide o documento sem alterá-lo silenciosamente, cada apresentação, os
paths, as referências e a integridade dos arquivos. Calcule bytes e SHA-256
após finalizar os arquivos. Não inclua relatórios ou schemas no ZIP.

Se faltar link, identidade, licença, material ou decisão pedagógica, informe
a pendência; não fabrique um recurso nem classifique o pacote como pronto.
Salvar rascunho e publicar são ações da administradora, não do pacote.
```

## 9. Como usar os exemplos desta proposta

Mínimo e completo são dados sintéticos de especificação. O completo cobre os oito tipos com nove atividades e dois decks mínimos; não é produção pedagógica da Aula 02 ou 03. Não enviar example.invalid ou os links EXEMPLO_NAO_PUBLICAR à plataforma real.

Usar o validador documental no repositório e ler seus avisos. Depois da aprovação, substituir kit/contexto e materiais por conteúdo realmente aprovado e revalidar. Não editar uma pequena parte de um exemplo e assumir que as referências/gabaritos restantes pertencem à aula real.
