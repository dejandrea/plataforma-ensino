# Bitaria Lesson Package — contrato candidato v1

12/11/2026. **Proposta para aprovação, não contrato oficial implantado.** O painel atual aceita JSON de aula ou ZIP de apresentação separadamente. Não enviar os ZIPs deste documento ao importador atual de apresentações.

Este documento complementa [a arquitetura editorial](arquitetura-editorial-e-pacote-unificado.md). A decisão vigente mantém materiais volumosos e docentes no Drive e apresentações no gerenciador web já instalado. Não há bucket novo, integração Drive obrigatória ou serviço pago.

## 1. Escolha de envelope

```text
bitaria-html-m01-s01-a03-r01.zip
├── manifest.json
├── aula.json
└── apresentacoes/
    ├── principal.zip
    └── revisao.zip
```

Cada ZIP interno é **exatamente o pacote de apresentação v1 já aceito**:

```text
principal.zip
├── apresentacao.json
├── images/imagem.webp             # apenas se usada
└── creditos-imagens.md            # recomendado, não obrigatório ao parser
```

Imagens são referidas no deck por `./images/imagem.webp`. Não alterar seus paths para o ZIP externo. Decks sem imagens não precisam da pasta. Ausência de apresentação significa omitir apresentacoes/; não criar arquivos ou pastas vazias.

Por que ZIP interno: o parser atual recebe bytes ZIP, aplica segurança/integridade e normaliza o deck. Usar os mesmos bytes evita outro parser de apresentações e reduz a adaptação da Edge. A alternativa com diretórios abertos `apresentacoes/chave/...` é possível, mas exigiria extrair a validação semântica do parser para uma API compartilhada e re-homologar ambos os caminhos; não é necessária ao MVP.

É permitida **apenas essa aninhagem de um nível**. O leitor externo só entrega aos validadores os arquivos ZIP declarados; os leitores internos atuais não aceitam outros ZIPs. A contagem/limite efetivo de descompressão é global, não reinicia para cada nível. Isso não transforma o importador web atual em um importador recursivo.

Não incluir PDF, vídeo, áudio, apostila, executável, HTML/CSS/JS, pasta professor, credencial, relatório, schema ou arquivo de origem no ZIP. Materiais externos ficam nas URLs dos campos já aceitos; links privados docentes ficam somente no manifesto administrativo e nunca na projeção ao aluno.

## 2. Contratos existentes preservados

| Parte | Norma atual | O que a proposta faz |
|---|---|---|
| aula.json | `src/contracts/learning-content.v2.schema.json` + validateLessonImport | Usa o envelope inteiro sem campos novos. O pacote candidato exige v2; o importador legado continua aceitando v1/v2. |
| Apresentação | `public/apresentacoes/presentation.schema.json`, schemaVersion 1 | Usa sem alterações. |
| ZIP web | `public/apresentacoes/package.js` | Mesmo parser, extensões, imagens, hashes, avisos e limites por apresentação. |
| Recompensas | Gamification do v2 + configuração central do banco | Preserva rewardRuleKey/awardOn; não aceita pontos livres no manifesto. |
| Gabaritos | teacherOnly.quizKeys / interactiveKeys / lessonPlans | Continua no JSON administrativo e em tabelas protegidas; jamais no deck/notes visíveis ao aluno. |

Não criar `resourceRef`, `assetId`, `presentationKey` ou campos semelhantes dentro de content de atividade: seriam rejeitados pelos schemas atuais. O manifesto coordena ligações externamente.

## 3. Identificação e kit de produção

O futuro botão **Exportar kit para o Work** entrega os schemas atuais, contexto/keys existentes, UUID da aula selecionada e identidades das apresentações necessárias. A administradora não digita UUIDs nem monta URLs manualmente.

Uma apresentação nova precisa de identidade conhecida antes de produzir aula.json, porque slides.resourceUrl já é obrigatório e não admite uma referência abstrata. O kit aloca um UUID lógico, sem criar/publicar conteúdo, associado à key estável proposta. Para atualizar apresentação existente, reutiliza seu UUID. A confirmação no servidor resolve/reserva o mapeamento sob lock: dois kits concorrentes com identidades divergentes geram conflito explícito, não duplicação silenciosa.

No aula.json, a atividade web é slides, format link e resourceUrl HTTPS estável do kit:

```json
{
  "schemaVersion": 1,
  "type": "slides",
  "format": "link",
  "resourceUrl": "https://example.invalid/apresentacoes/gerenciada/00000000-0000-4000-8000-000000008101",
  "altText": "Descrição da apresentação"
}
```

`example.invalid` e os UUIDs acima são **somente exemplos sintéticos**, não destinos de importação real. O servidor exige a origem canônica do ambiente e aula/mapeamentos reais correspondentes. Não fabricar um endpoint temporário, URL assinada, token ou URL pública de Storage para satisfazer o schema.

No pacote salvo como rascunho, a rota padrão ainda pode não abrir ao aluno por ausência de versão ativa. A prévia administrativa precisa resolver o bundle local ou o version_id explícito usando PresentationFrame, não tentar publicar para conseguir pré-visualizar.

Limitação assumida do MVP: exige kit da aula existente, ou um resourceUrl externo real como fallback e sem vínculo web nesse pacote. Criação de aula curricular, curso, módulo ou submódulo não é autorizada pelo manifesto.

## 4. Manifesto candidato

Schema legível por máquina: [manifest.proposta.schema.json](propostas/pacote-aula-v1/manifest.proposta.schema.json), draft-07, ID `urn:bitaria:lesson-package:proposal:1`. Só será oficial após aprovação, implementação e homologação.

| Campo | Obrigatoriedade e regra |
|---|---|
| packageVersion | Obrigatório, inteiro 1. Não confundir com schemaVersion de aula/deck. |
| productionId | Obrigatório, identificador de produção de até 100 caracteres, minúsculas/números/ponto/hífen/underscore. Serve para rastrear entrega, não autoriza sobrescrita e não garante idempotência sozinho. |
| targetLessonId | Obrigatório, UUID da aula exportado no kit. A key/título/contexto continuam em aula.json, sem duplicá-los aqui. |
| platformOrigin | Obrigatório, origem HTTPS canônica sem barra final, credenciais ou path, exportada no kit. Comparar com o ambiente de destino; não confiar em domínio recebido. |
| files | Obrigatório, 1–4 registros. aula.json exatamente uma vez; cada ZIP de apresentação exatamente uma vez. Não incluir manifest.json para evitar hash recursivo. |
| files[].path | aula.json ou apresentacoes/key.zip. Relativo, ASCII, sem .., barra invertida, espaços, encoding de caminho ou diretório externo. |
| files[].bytes | Inteiro positivo, tamanho real dos bytes. Aplicam-se os limites por tipo abaixo. |
| files[].sha256 | SHA-256 dos bytes exatos, 64 hexadecimais minúsculos. Recalcular após qualquer edição/recompactação. Não é assinatura de autoria. |
| presentations | Opcional, 0–3 referências, uma para cada ZIP interno. |
| presentations[].key | Key estável da apresentação; não é necessariamente a key da atividade. Mesma regra de slug das atividades. |
| presentations[].activityKey | Key de uma atividade slides contida no documento. Não resolver por título. |
| presentations[].presentationId | UUID lógico do kit; reutilizar ao atualizar. Bloquear UUID de outra aula. |
| presentations[].path | Exatamente apresentacoes/{key}.zip e declarado em files. |
| teacherResources | Opcional, até 50 referências externas privadas. Não são novos tipos de atividade. |
| teacherResources[].key/title/url/kind | Todos obrigatórios. key única; título até 200 caracteres; HTTPS sem credenciais, até 2048 caracteres; kind lesson_plan/notes/exercise/other. |

Raiz e objetos rejeitam propriedades desconhecidas. Nenhum campo `publish`, `overwrite`, `role`, `xp`, `serviceRole` ou criação de currículo é aceito.

Validações semânticas adicionais ao JSON Schema: keys/UUIDs/paths de apresentações únicos; uma apresentação por activityKey; cada ZIP declarado e usado; aula.json existente e conforme v2; referências cruzadas corretas; domínio do kit correto no servidor. O schema sozinho não certifica essas condições.

Exemplo de cabeçalho e ligação, com hashes gerados nos exemplos completos, sem valores fictícios de hash para copiar:

```text
packageVersion = 1
productionId = exemplo-completo-r01
targetLessonId = UUID da aula do kit
platformOrigin = origem do kit
files = aula.json + apresentacoes/principal.zip, com bytes/SHA-256 reais
presentations = key principal → activityKey da atividade slides → presentationId do kit
```

## 5. Referências externas e professor

Não repetir URLs de vídeo/PDF/mapa no manifesto: já pertencem às atividades. A prévia faz um inventário derivado desses campos e dos recursos de project/online_lesson efetivamente suportados. Flashcard images continuam HTTPS no próprio content; não podem apontar para imagens locais dentro do ZIP web, pois o contrato de flashcards não resolve esses paths.

teacherResources é uma proposta de metadado administrativo, armazenado no rascunho privado. Não inserir seus links em lesson.description, slides.note, quiz.feedback público, project.resources ou conteúdo do aluno. Planos estruturados teacherOnly.lessonPlans continuam no campo atual; uma referência docente externa não o substitui quando o tipo online_lesson exige plano completo.

Validação sem rede: HTTPS, host exato do Drive para video, padrão de arquivo reconhecido pelo mecanismo atual, ausência de credenciais/portas indevidas, uso do campo correto e existência das referências no JSON. A prévia rotula **Acesso não verificado** e oferece Abrir no Drive / Conferi o acesso como aluno. Login Google e falha de iframe não são prova de arquivo ausente.

Não emitir HEAD/GET a URLs arbitrárias no backend. Se uma checagem automática vier a ser aprovada, restringir hosts/endpoints públicos oficiais, bloquear IPs locais/privados e redirecionamentos para eles, limitar DNS, tempo/tamanho e não reenviar cookies/tokens; requisição anon pode continuar inconclusiva. Não é requisito do MVP nem depende de API Drive.

Um link compartilhado com qualquer pessoa pode funcionar fora da Bitaria. A autorização da plataforma não revoga esse link. Materiais docentes exigem compartilhamento restrito no Drive; PDFs públicos não podem conter gabaritos. Trocar o conteúdo no mesmo ID do Drive pode invalidar a reprodução histórica: para mudança relevante, usar outro arquivo/ID, preservar o anterior e registrar versão/autoria. A Bitaria não promete imutabilidade de bytes externos que não controla.

## 6. Limites propostos e limites existentes

Os limites do envelope são **candidatos**, não configuração vigente da plataforma. Validar memória/CPU/tempo na Edge antes da implementação final; não reutilizar automaticamente os 10 MiB do ZIP web como limite global.

| Limite | Candidato do envelope / comportamento |
|---|---|
| ZIP de aula comprimido | 25 MiB. Sem vídeos/PDFs físicos. Se ultrapassar, otimizar imagens e material, não assumir aumento de infraestrutura. |
| manifest.json | 64 KiB UTF-8. |
| aula.json | 2.000.000 bytes; o limite por caracteres do cliente legado não substitui contagem de bytes no servidor. |
| ZIPs internos | Até 3, cada um no máximo 10 MiB, exatamente os pacotes atuais. |
| Expansão do nível externo | Até 32 MiB somando manifesto, aula e bytes dos ZIPs internos. |
| Expansão efetiva global | Até 50 MiB para manifesto+aula+arquivos descomprimidos de todos os decks. Contabilizar também bytes intermediários para orçamento de memória, sem supor que só 50 MiB serão alocados. |
| Entradas externas | Até 8 incluindo diretórios opcionais; apenas arquivos declarados e diretorio apresentacoes/. |
| Compressão externa | Store/Deflate apenas; razão máxima 200 e orçamento real de saída com leitura limitada, não confiar no cabeçalho. Sem ZIP64, criptografia, links simbólicos, sobreposição ou pacote dividido. |
| Paths | Max 160 caracteres; comparação de duplicação case-insensitive; referência exata case-sensitive. Sem paths absolutos, .., drive letters, NUL ou escapes alternativos. |

Permanecem em cada ZIP web, por parser atual: 25 MiB expandidos, 80 entradas, deck JSON 512.000 bytes, créditos 102.400 bytes, imagem 5 MiB / 16 milhões de pixels, proporção 200, 1–60 slides. Imagens WebP/PNG/JPEG; SVG e WebP animado não aceitos. Não exigir que o Work envie a biblioteca oficial Bitara; usar as categorias/poses oficiais no deck.

Processar decks sequencialmente e liberar buffers entre etapas. Não usar base64 para o ZIP inteiro em JSON/DB. Um ensaio que ultrapasse memória/timeout implica reduzir limites do candidato ou otimizar fluxo, não contratar recursos automaticamente.

## 7. Fluxo futuro e publicação

1. Receber o arquivo externo e validar sua estrutura com whitelist/orçamentos antes de extrair. Reutilizar internamente a mecânica segura do leitor ZIP existente, parametrizada por política, sem afrouxar a política do importador web.
2. Validar manifesto, inventário/hashes, aula com validateLessonImport e cada deck com parsePresentationPackage. Revalidar no servidor, não confiar na prévia do cliente.
3. Resolver aula/contexto/keys/mapeamentos, gerar diff pela camada editorial comum e detectar bloqueios/seleções inconsistentes. Verificar a fronteira teacherOnly antes de qualquer projeção pública.
4. Mostrar prévia completa, com material externo identificado como não verificado e apresentações locais via PresentationFrame. Nenhum início/conclusão/tentativa/XP.
5. Confirmar salvamento: registrar operação durável e enviar decks ao pipeline existente de upload/registro privado. Extrair uma rotina interna compartilhada de import-web-presentation, mantendo seu endpoint atual; não fazer uma cadeia de chamadas HTTP fingindo identidade do usuário ou entregar service_role ao browser.
6. Commitar rascunho somente quando todas as versões referenciadas estiverem válidas. Guardar version_id e vínculos pretendidos no plano privado, pois bind atual exige versão ativa. Ainda não chamar publish/bind.
7. Publicação separada, com nova comparação: em transação SQL única, ativar versões web aprovadas, vincular as atividades corretas, publicar as atividades e o conjunto editorial. Alterar status da aula somente se solicitado. No MVP, manter bloqueio se houver histórico surgido desde o plano.
8. Relatório final distingue Salvo em rascunho / Publicado / Bloqueado / Sem alterações. Reabrir a aula recupera esse estado do banco.

Não usar a RPC atual import_learning_lesson como uma transação distribuída: ela pode atualizar descrição/objetivos e inserir atividades enquanto outro serviço ainda falha. A camada comum precisa separar preparação e commit. Para aulas vazias, pode reutilizar a validação/trechos de inserção numa função interna preparada; não copiar toda a regra para a Edge.

## 8. Idempotência e recuperação

Manter digest bruto do ZIP para transporte e digest semântico normalizado para conteúdo: JSON com chaves de objetos ordenadas, arrays em sua ordem significativa, conteúdo privado incluído no hash e hashes de recursos/decks. O modo, alvo e seleção compõem a chave da operação. Não ignorar gabarito ou mudança de obrigatoriedade no digest.

productionId repetido com conteúdo diferente é conflito; conteúdo idêntico com outro nome/recompactação deve resultar em no-op, quando hashes semânticos puderem ser comprovados. As versões atuais identificam pacote pelo SHA-256 do ZIP bruto: repacotar pode mudar esse hash. O coordenador precisa de fingerprint semântico em sidecar/cache, não prometer essa capacidade como existente.

Para versões antigas sem fingerprint, computar sob autorização administrativa a partir do JSON/manifesto privado existente, sem reescrever a linha imutável. Sem prova de equivalência, apresentar conflito/revisão manual, não afirmar deduplicação por título.

Não duplicar imagens repetidas dentro de um mesmo pacote. Entre versões novas com conteúdo realmente diferente, os prefixos atuais podem repetir arquivos; isso é custo conhecido e limitado, não um novo armazenamento global deduplicado.

Falha parcial: publicado permanece anterior; recursos preparados ficam privados, vinculados à operação, e podem ser retomados. Remover apenas objetos órfãos comprovadamente pertencentes à operação, depois de carência e nova conferência de referências; nunca apagar versão anterior para resolver erro. Não chamar limpeza bem-sucedida só porque remove() foi invocado. Verificar resultado e registrar pendência.

## 9. Exemplos e validação documental

Exemplos sintéticos, sem alvo real e sem permissão de importação de produção:

- [ZIP mínimo candidato](propostas/pacote-aula-v1/exemplos/exemplo-minimo.zip): 1 atividade slides com referência externa fictícia, sem deck.
- [ZIP completo candidato](propostas/pacote-aula-v1/exemplos/exemplo-completo.zip): 9 atividades cobrindo os 8 tipos, 2 apresentações e 1 referência docente fictícia. Duas apresentações correspondem a duas atividades slides, pois o vínculo atual permite uma apresentação por atividade.
- As pastas minimo/completo contêm os arquivos abertos para inspeção. Os decks mínimos de demonstração não constituem aula pedagógica pronta nem comprovam licença/acesso a materiais reais.

Ferramenta local de documentação: [validate-proposal.mjs](propostas/pacote-aula-v1/validate-proposal.mjs). Usa o validador real TypeScript/schema da aula e o parser real dos ZIPs web, sem parser concorrente de atividades. Não faz HTTP, consulta SQL, upload ou publicação.

```powershell
node docs/propostas/pacote-aula-v1/validate-proposal.mjs docs/propostas/pacote-aula-v1/exemplos/minimo
node docs/propostas/pacote-aula-v1/validate-proposal.mjs docs/propostas/pacote-aula-v1/exemplos/completo
```

Essa ferramenta recebe **pastas locais**, não implementa o leitor seguro do ZIP externo. Ela verifica schema, inventário, bytes/hashes, referências, aula/decks e projeção sem teacherOnly; não prova quotas, proteção da Edge, identidade real da aula, acesso Drive ou integridade estrutural do ZIP externo. Esta limitação evita apresentar protótipo documental como importador pronto.

Para conferir os exemplos válidos e as mutações inválidas sintéticas:

```powershell
node --test docs/propostas/pacote-aula-v1/test-proposal.mjs
```

Resultado nesta preparação: **9 testes aprovados**, incluindo vazamento de link docente para conteúdo público. Os casos e mensagens também estão descritos em [casos-invalidos.json](propostas/pacote-aula-v1/casos-invalidos.json).

Validade estrutural dos exemplos não significa que poderão ser usados no painel de hoje. O validador exibe explicitamente esses avisos. O comando não instala dependências: utiliza as já presentes no repositório.

## 10. Exemplos inválidos e mensagens previstas

| Entrada | Resultado |
|---|---|
| Manifesto com publish:true ou versão desconhecida | MANIFEST_INVALID; não interpretar como autorização. |
| aula.json alterado sem atualizar hash/tamanho | FILE_INTEGRITY. |
| Duas keys/posições iguais ou gabarito ausente | LESSON_INVALID, vindo do validateLessonImport real. |
| presentation.activityKey inexistente ou do tipo quiz | BINDING_INVALID. |
| URL estável do deck aponta outro UUID/domínio | BINDING_INVALID; origem também é conferida no servidor. |
| ZIP web truncado/arquivo interno não permitido | PRESENTATION_INVALID, proveniente do parser existente. |
| Pasta professor/gabarito ou arquivo não declarado | PATH_INVALID / FILE_INVENTORY; não enviar material administrativo ao Storage web. |
| Link Drive estruturalmente válido, mas sem acesso | Aviso de acesso não verificado; não alegar 404 ou autorização ao aluno sem conferência. |
| Aluno tentando importar | 401/403 no serviço futuro; schema válido não dá permissão. |
| Nova comparação necessária após alteração concorrente | Bloqueio de publicação, não sobrescrita do conteúdo novo. |

## 11. O que ainda depende de implementação/aprovação

O manifesto, seus limites e os exemplos são candidatos, não uma alteração nos schemas v1/v2 atuais. Aprovar identidade/kit, formato de envelope, política pedagógica e limites; depois implementar leitor externo seguro, camada editorial comum, operações duráveis, fingerprints, rascunhos/vínculos pendentes e publicação coordenada.

O contrato atual do Work continua sendo usado para apresentações individuais das próximas aulas. O prompt complementar está marcado como futuro; não pedir ao Work para produzir apenas o envelope novo para uma aula urgente antes da funcionalidade existir.
