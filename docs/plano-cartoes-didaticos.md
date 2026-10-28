# Cartões didáticos — auditoria técnica e plano de implementação

Data: 28/10/2026 · America/Bahia. Etapa A concluída; plano aprovado explicitamente pelo usuário e Etapa B implementada. A migration foi posteriormente autorizada e aplicada em produção; conteúdos reais da Aula 02 permanecem inalterados. Ver [contrato definitivo, arquivos e resultados](cartoes-didaticos.md).
Escopo solicitado: [Implementação de cartões didáticos e evolução das aulas multimídia](<prompts/Implementação de cartões didáticos e evolução das aulas multimídia.md>).

## 1. Resultado da auditoria

O novo recurso exige extensão de contrato, persistência por cartão e integração com as rotinas oficiais. Não basta adicionar uma animação no frontend.

Código conferido:

| Área | Fonte atual | Conclusão |
| --- | --- | --- |
| Contratos | src/contracts/learning-content.v1.schema.json e learning-content.v2.schema.json | v2 usa oneOf, additionalProperties=false e chaves estáveis; flashcards ainda é rejeitado |
| Tipos | src/types/learning.ts | ActivityType/ActivityContent/ActivityDefinition não incluem flashcards; recurso de estudo usa resourceUrl/altText |
| Validação | src/lib/learningContent.ts | AJV e validações adicionais de IDs, relações e gamificação; estender apenas v2 |
| Interface | ActivityRenderer, LessonActivityList, AdminLessonPreview | Renderização discriminada por tipo; prévia deve ser interativa sem gravação |
| Página do aluno | src/pages/LessonView.tsx | Abertura chama start_student_activity; gravações atualizam snapshot e mostram XP pela resposta do servidor |
| Progresso | student_activity_progress | Uma linha por aluno/atividade, revisão, status e datas; não há estado individual dos cartões |
| Conclusão | private.learning_sync_lesson e learning_lesson_ready | Conclusão das atividades obrigatórias pode concluir a aula automaticamente |
| XP | private.learning_award_activity e trigger homônimo | Ledger já protege crédito único por aluno/tipo de evento/atividade; flashcards precisa entrar explicitamente no mapeamento de estudo |
| Importador | LessonContentImporter e private.learning_import_lesson | Adiciona atividades; valida contexto, key, ordem e dependências; não é substituição geral |
| Segurança | RPCs e guards de currículo, RLS de atividades/progresso | Não há escrita direta de progresso para authenticated/anon; preservar esse desenho |
| Central | src/components/pedagogy/PedagogyJourney.tsx e RPC pedagogy_lesson_detail | Precisa reconhecer o tipo e exibir quantidade revisada, sem mudar o cálculo oficial de progresso |
| Versões curriculares | migrations de 26/10/2026 | Aula planejada e versão curricular continuam impedindo acesso mesmo que suas atividades estejam publicadas |

A regra activity_study em produção tem 10 XP, cálculo fixed e proteção oficial. A recomendação é reutilizá-la: cartões são estudo com recuperação ativa, não avaliação automática de acerto. Esse valor será sempre lido no backend, nunca inserido como pontuação no cliente.

### Situação real da Aula 02

Consulta somente de leitura ao projeto gnyiyhnbpjhdgrhsevbh em 28/10/2026:

- Aula: Grandes Nomes da Tecnologia, ID b17a2000-0000-4000-8000-000000001002.
- Curso HTML; módulo HTML Básico, ID 253477d3-e90d-42b8-88d8-a4a512418cf5.
- Submódulo As Origens da Tecnologia, ID 7ba3b0f4-7078-47df-aaa4-a7ee460b3f3e.
- Versão curricular 2, número curricular 2, publication_status=planned.
- Seis atividades ativas, publicadas, revisão 1; sem dependências explícitas.
- Zero progressos de atividade, zero conclusões da aula, zero tentativas e zero recibos ligados à aula/atividades no instante consultado.
- Quiz final com seis perguntas.
- Não há vídeo nem flashcards cadastrados nessa aula.

| Ordem | Tipo | Key | ID existente |
| --- | --- | --- | --- |
| 0 | slides | a02-v2-arquivos-secretos | 10be647a-1b53-4d99-8d3e-cdb0cc95dda0 |
| 1 | interactive | a02-v2-associacao-parte1 | 1a502595-720b-4fba-8b19-3d2c9e085c5a |
| 2 | slides | a02-v2-novas-pistas | d475a78e-b5c1-4e56-84d9-75a189b0aa70 |
| 3 | interactive | a02-v2-seis-descobertas | 461f30d1-dbd8-4eac-91d8-99b8f25ad7d3 |
| 4 | mindmap | a02-v2-mapa-grandes-ideias | 5382ace9-9067-4b2f-9c93-48fd25434f9f |
| 5 | quiz | a02-v2-detetive-tecnologia | e2e2fc55-ef4b-4444-97a9-45ddddaa4563 |

A consulta não alterou conteúdo, publicação, ordem, progresso ou XP. Não foram consultados gabaritos ou dados pessoais de alunos.

Não presumir que essas seis atividades equivalem aos seis cartões pedidos para homologação. O texto final dos cartões e seus arquivos de imagem aprovados pelo Work não foram fornecidos no repositório consultado.

## 2. Decisões propostas para aprovação

1. Novo tipo superior flashcards no contrato administrativo v2; conteúdo também usa schemaVersion=2. v1 permanece intacto. Não usar interactive/matching como disfarce para o novo recurso.
2. Usar activity_study com awardOn=completed e o pipeline existente de XP.
3. Concluir somente depois de registrar o verso de todos os IDs do conjunto vigente no backend.
4. Persistir cartões revisados separadamente do status agregado existente. Uma atividade pode estar em andamento com parte dos versos revisados.
5. Reiniciar/embaralhar reorganiza apenas a sessão de apresentação. Não apaga revisões persistidas, conclusão, timestamps ou XP.
6. Prévia administrativa permite virar/navegar/embaralhar com estado efêmero e indicador “Prévia”; não chama RPCs do aluno.
7. Nesta primeira implementação, não incluir as marcações opcionais “Já sei/Preciso revisar”. Elas não são necessárias para a conclusão e podem ser acrescentadas depois com semântica própria de autoavaliação.
8. Não mudar a Aula 02 nesta etapa de desenvolvimento. Preparar compatibilidade e homologar em banco isolado; importação real, reorganização e liberação exigem autorização posterior.

## 3. Contrato proposto

Forma proposta para content, ainda não aceita pelo schema atual:

~~~json
{
  "schemaVersion": 2,
  "type": "flashcards",
  "cards": [
    {
      "id": "conceito-exemplo",
      "front": {
        "title": "Nome ou conceito",
        "question": "O que você lembra sobre este conceito?"
      },
      "back": {
        "summary": "Conceito ou contribuição principal.",
        "explanation": "Explicação acessível ao aluno.",
        "impact": "Aplicação prática ou impacto atual.",
        "curiosity": "Informação complementar opcional."
      }
    }
  ]
}
~~~

Este trecho é uma proposta de formato, não um arquivo de importação validado nem material aprovado para produção.

Regras previstas:

- cards: 1 a 100 cartões; IDs únicos e estáveis, com o mesmo padrão restrito de chaves adotado no contrato.
- front: title e question obrigatórios.
- back: summary, explanation e impact obrigatórios; curiosity opcional.
- Imagem opcional em cada face, como image: { resourceUrl, altText }, reutilizando as convenções de recursos da plataforma. Ambos os campos obrigatórios quando image existir.
- Limites: título até 200 caracteres, pergunta até 1.000, summary até 1.000, explanation/impact/curiosity até 4.000 cada; campos de texto não vazios. URL até 2.048 e texto alternativo até 500.
- Texto simples; quebras de linha preservadas. Sem HTML executável, scripts, CSS, JSX, classes de apresentação ou callbacks nos dados.
- Imagem somente por HTTPS válido, sem credenciais na URL. Não aceitar data:, javascript:, blob: ou SVG/HTML inline. Falha de carregamento mantém texto e mensagem acessível.
- Uma URL do visualizador do Drive não equivale a arquivo de imagem. O Work deve fornecer um recurso de imagem diretamente carregável; não gerar conversões fictícias de links ou criar URLs.
- envelope da atividade mantém key, title, orderIndex, required, prerequisites e gamification existentes.
- Gamificação recomendada: rewardRuleKey=activity_study, awardOn=completed, achievementKeys=[].
- Cartões são conteúdo didático público para o aluno autorizado. O verso não é gabarito privado; não deve conter notas docentes, dados administrativos ou teacherOnly.

A validação deve ocorrer no AJV, na checagem semântica de IDs/imagens e no backend. Os mesmos exemplos positivos/negativos serão exercitados nos dois ambientes para evitar divergência.

## 4. Persistência, RPCs e conclusão

Modelo recomendado: private.flashcard_review_progress, com chave composta por student_id, activity_id, activity_revision e card_id. Campos de data de primeira revisão e última revisão; FKs para perfil e identidade/revisão da atividade. RLS habilitada e nenhum grant direto de leitura/escrita ao cliente.

Não criar um segundo sistema de status ou de XP. A tabela guarda somente os eventos mínimos de estudo por cartão; student_activity_progress continua sendo a autoridade de conclusão da atividade.

Duas RPCs públicas propostas, com wrappers invoker e implementação privada definer, search_path vazio e verificações explícitas:

| RPC | Parâmetros do cliente | Finalidade |
| --- | --- | --- |
| student_flashcard_progress | p_activity_id | Ler IDs revisados e contagem da revisão vigente; somente do próprio aluno |
| review_student_flashcard | p_activity_id, p_card_id | Registrar idempotentemente a visualização do verso e devolver estado agregado |

A RPC de gravação deve:

1. Exigir perfil ativo de aluno e serializar pelo mesmo lock de perfil das operações existentes.
2. Buscar atividade ativa/publicada e exigir tipo flashcards, aula disponível na versão do aluno e pré-requisitos concluídos.
3. Validar card_id contra content_json.cards; não confiar em total, revisão, identidade de aluno, status, pontos ou lista de “vistos” enviados pelo cliente.
4. Registrar o cartão uma vez, preservando first_reviewed_at em repetição.
5. Marcar/atualizar o progresso agregado em andamento; completar apenas se todos os IDs válidos tiverem registro persistido para a revisão.
6. Deixar o trigger oficial de progresso chamar learning_award_activity e learning_sync_lesson. Estender o mapeamento de recompensa para flashcards → activity_study.
7. Não permitir concluir flashcards por complete_student_study. Essa rotina deve continuar exclusiva dos recursos simples que já suporta; isso evita pular o critério de todos os cartões.

O endpoint registra uma interação válida do aplicativo; não comprova atenção, leitura humana ou memorização. Por isso não calcula nota nem exige “Já sei”.

Persistência monotônica: falhas de rede deixam o cartão como pendente de sincronização, com tentativa novamente, sem mensagem de conclusão salva. Duas abas e resposta perdida repetem a mesma operação idempotente. Uma resposta atrasada de outra atividade/revisão não altera a sessão atual.

Não usar localStorage como fonte oficial. A ordem embaralhada e a posição corrente podem ser estado local da sessão; não precisam sobreviver ao recarregamento para satisfazer a persistência das revisões.

A central deve usar a autorização existente de professora vinculada/admin. Acrescentar ao detalhe da atividade apenas reviewed_count/total para o aluno consultado; o aluno não poderá informar outro student_id nas RPCs novas. Contagem por cartão não vira percentual de acerto.

## 5. Experiência e acessibilidade

FlashcardsActivity será reutilizável por conteúdo, sem condicionais sobre HTML, pessoas históricas ou números de aula.

- Um cartão por vez; frente com pergunta e título, verso com conteúdo hierarquizado e imagem opcional.
- Botão nativo e foco visível para “Ver explicação”/“Ver pergunta”; Enter/Espaço e toque. Nada de div clicável sem semântica.
- Botões Anterior/Próximo, posição “2 de 6”, contagem “4 de 6 revisados” e texto/ícone de revisão, sem depender só de cor.
- Frente e verso separados semanticamente: face oculta fora da árvore de acessibilidade; região de conteúdo com texto legível e atualizações curtas em aria-live.
- Efeito de giro curto e opcional; prefers-reduced-motion usa troca direta, sem rotação 3D. O texto do verso não fica invertido ou sobreposto.
- Embaralhar usa Fisher–Yates sem modificar a ordem do conteúdo original; IDs permanecem estáveis e revisões salvas são preservadas.
- Reiniciar volta à frente do primeiro cartão da sessão e mantém o total revisado. Texto do botão explica que não apaga o histórico.
- Navegação não fica bloqueada por já ter concluído; o aluno pode rever e embaralhar após a tela de conclusão.
- Frases longas, zoom e telas estreitas não usam altura fixa que corte texto. Controles acessíveis no celular e sem rolagem horizontal.
- Nenhuma biblioteca externa de flashcards ou imagens geradas é necessária. Reutilizar Tailwind, tokens roxo/ciano/magenta e estilos Bitaria.

Ao abrir o verso no modo aluno, registrar o cartão no backend. A tela de conclusão definitiva depende da confirmação do servidor. No modo prévia, simular somente a sessão local e deixar isso explícito.

## 6. Arquivos previstos

| Arquivos | Mudança |
| --- | --- |
| src/contracts/learning-content.v2.schema.json | Variante flashcards e schema das faces/imagens |
| src/types/learning.ts | Flashcard, FlashcardContent, tipo de atividade e DTO de progresso |
| src/lib/learningContent.ts | IDs únicos, URLs/imagens e regra compatível; v1 preservado |
| src/lib/studentLearning.ts | Adaptadores das duas RPCs e mensagens de erro existentes |
| src/lib/flashcards.ts | Utilitários puros de sessão/embaralhamento, se necessário |
| src/components/learning/FlashcardsActivity.tsx | Componente e estados de carregamento/sincronização/erro/conclusão |
| src/components/learning/ActivityRenderer.tsx | Integração, props de persistência e prévia sem escrita |
| src/pages/LessonView.tsx | Atualização do snapshot/XP após o registro, sem recriar a sessão a cada verso |
| src/components/learning/LessonActivityList.tsx | Rótulo “Cartões didáticos” |
| src/components/learning/AdminLessonPreview.tsx | Prévia funcional sem gravar |
| src/components/learning/LessonContentImporter.tsx | Prévia descritiva adequada ao novo formato, sem lógica especial para Aula 02 |
| src/components/pedagogy/PedagogyJourney.tsx e src/types/pedagogy.ts | Tipo/rótulo e contagens de revisão autorizadas |
| src/index.css | Somente estilos de giro/reduced-motion se Tailwind não bastar |
| supabase/migrations/<CLI>_flashcards_learning_activity.sql | Contrato armazenado v2, CHECK de tipo, validação semântica necessária, tabela privada, RPCs, leitura docente e mapeamento de XP |
| supabase/rollbacks/flashcards_learning_activity.sql | Contenção reversível antes de uso; recusa apagar progresso após uso |
| tests/flashcards*.test.mjs e fixtures/harness existentes | Testes de contrato, DB, navegador e regressão |
| docs/cartoes-didaticos.md e docs/examples/ | Guia para Work e exemplo completo validado após implementação |
| package.json | Atalho da suíte de cartões |

O nome/timestamp da migration será gerado com a CLI somente depois da aprovação. Não é necessário alterar regras ou valores em xp_reward_rules, versões curriculares, tabelas de quiz/projetos, calendário ou autenticação.

## 7. Aula 02 e materiais do Work

A nova sequência desejada (vídeo → slides → cartões → associação → mapa → quiz → desafio opcional) ainda não corresponde aos seis registros atuais. A sequência futura exige um manifesto específico de preservação e posicionamento.

O guard atual protege campos de atividades já publicadas; não presumir que order_index pode ser alterado livremente. Não desabilitar esse guard para fazer uma reordenação incidental nesta entrega.

Quando os materiais revisados forem aprovados:

- Reconsultar atividades, keys, ordens, pré-requisitos e históricos; zero uso hoje não garante zero uso no momento da importação.
- Identificar quais slides e interações atuais serão reutilizados e se algum item ficará opcional. Não inferir equivalências pelo título.
- Escolher IDs/keys novos somente para o vídeo e os cartões realmente novos. Não reenviar o pacote completo atual ao importador.
- Preparar uma atualização organizacional autorizada que preserve conteúdo/revisão/IDs e históricos; não duplicar os seis registros para contornar imutabilidade.
- Se houver alunos com aula iniciada ou concluída, não invalidar a conclusão histórica nem exigir repetição para preservar XP; a adição de uma atividade obrigatória exige decisão explícita de transição.
- Manter a aula planned até a publicação dos materiais e liberação da aula serem autorizadas separadamente.
- Homologar com seis cartões aprovados pelo Work. Na ausência do conjunto aprovado, usar fixture isolada claramente identificada como exemplo, sem publicar conteúdo real nem inventar imagens.

O guia para o Work indicará limites, IDs estáveis, campos públicos, texto alternativo, autoria por conceito e o envelope v2 completo. Os exemplos sem imagem são válidos; nenhuma URL fictícia será usada para simular material aprovado.

## 8. Testes previstos e critérios de aceite

1. Contrato: v1 e v2 anteriores continuam válidos; flashcards somente em v2; vazio, excesso de cartões, IDs duplicados, campos extras, textos vazios, imagem sem alt e URL insegura rejeitados no cliente e no backend.
2. Importação: mesmo tipo renderiza em JSON de arquivo, prévia antes de importar e prévia salva; colisões de key/ordem continuam falhando; nenhuma escrita ao virar no modo prévia.
3. Interação: frente/verso, anterior/próximo, extremos, reinício, embaralhamento preservando IDs e conjunto completo, sem mutação do conteúdo.
4. Persistência: cartão revisado reaparece após reload; abrir somente a frente não conta; repetir verso, duas abas e retry por resposta perdida não duplicam revisão.
5. Conclusão: nenhum atalho por complete_student_study; só completa com todos os IDs válidos; total/IDs forjados ou revisão incompatível rejeitados.
6. XP: zero com revisão parcial, um único evento de estudo ao concluir, nenhuma repetição por reinício/revisão/reload e valores exclusivamente da configuração central. A conclusão da aula segue as atividades obrigatórias.
7. Segurança: anônimo/inativo/mentoria, aluno sem acesso curricular, aula planejada e pré-requisito incompleto bloqueados; outro aluno não lê/grava o progresso; professora fora do vínculo não consulta detalhe.
8. Central: tipo, status, revisados/total, data e XP coerentes com o snapshot oficial.
9. Regressão: estudo simples/vídeo, quizzes, ordering/matching, projetos, revisão docente, currículo v1/v2, XP e avaliações inalterados.
10. Acessibilidade/navegador: teclado, foco, leitores por atributos/estrutura, reduced-motion, face escondida não lida, erro de imagem, textos longos, 390 px e desktop sem overflow.
11. Migração: aplicar/reverter antes de uso em banco isolado; preservar ACLs e search_path; não retroagir progressos/recibos; depois de uso, contenção e correção progressiva sem excluir cartões revisados.
12. Execução: registrar resultados reais de banco/contrato/navegador, build/lint e capturas. Não marcar a suíte como aprovada se a execução de ferramenta não for autorizada.

A auditoria não executou testes de um componente ainda inexistente. Nesta Etapa A, foram inspecionados os arquivos e feitas somente consultas de leitura.

## 9. Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Permitir conclusão por chamada genérica de estudo | Manter flashcards fora de complete_student_study e concluir só via RPC validada de cartão |
| Validadores frontend/backend divergirem | Fixtures compartilhadas positivas/negativas e atualização do schema privado na mesma migration |
| Respostas atrasadas/reset de sessão a cada gravação | Componentes por atividade/revisão, cancelamento de leitura e atualização incremental de progresso |
| XP duplicado por duas abas/retries | Lock de perfil, registro idempotente por cartão e ledger existente |
| Corpo do verso confundido com gabarito privado | Conteúdo didático público; nenhum teacherOnly em DTOs ou prévias públicas |
| Imagem inválida bloquear estudo | Texto sempre funcional, URL validada e fallback acessível |
| Novos obrigatórios alterarem aula já concluída | Não mexer em A02 automaticamente; recolher histórico e aprovar transição específica |
| Quebra de ordenação histórica/importação | Preservar as seis keys/UUIDs; manifesto de reorganização separado |
| Remover migration após uso apagar progresso | Rollback condicionado/contensão, sem DELETE de históricos |
| Acessibilidade prejudicada por giro 3D | Troca sem animação em reduced-motion e só uma face acessível por vez |

## 10. Aprovação e limite desta etapa

Este plano cobre a implementação nativa e reutilizável dos cartões, incluindo contrato, persistência, XP, interface, prévia, central e testes. Não altera banco nem conteúdo nesta etapa.

A solicitação estabelece: **“Após aprovação do plano”** para a Etapa B e **“Não aplique alterações no banco antes da aprovação.”**

Após aprovar este plano, implementar e testar localmente. Aplicação da migration em produção, importação dos materiais reais da Aula 02 e sua publicação/liberação precisam de autorização explícita e serão apresentadas com os resultados e arquivos concretos.

Referências técnicas oficiais consultadas: [RLS do Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security) e [changelog](https://supabase.com/changelog). São referências de infraestrutura; as decisões pedagógicas e o inventário acima vêm dos requisitos e da inspeção do próprio projeto.
