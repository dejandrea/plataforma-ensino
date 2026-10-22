# CODEX — ETAPA B.1: ATIVIDADES INTERATIVAS E RANDOMIZAÇÃO

## Contexto

Estamos desenvolvendo a Bitaria, uma plataforma de ensino de programação para crianças e adolescentes.

Repositório:
https://github.com/dejandrea/plataforma-ensino

As Etapas A (fundação pedagógica) e B (experiência do aluno) foram implementadas.

Antes de iniciar a Etapa C (painel interativo da professora), precisamos complementar a experiência do aluno com atividades práticas interativas e embaralhamento automático das respostas.

**Objetivo:** permitir que os materiais produzidos pelo ChatGPT Work sejam importados em JSON e apresentados diretamente em componentes React, sem necessidade de PDFs para questionários ou atividades práticas.

## 1. Análise inicial obrigatória

Antes de modificar o código:

1. Inspecione as implementações das Etapas A e B.
2. Localize o contrato JSON v1, os schemas e os validadores.
3. Analise o renderizador de atividades.
4. Inspecione a correção de questionários no backend.
5. Verifique como tentativas e progresso são armazenados.
6. Analise as políticas RLS existentes.
7. Verifique o tratamento de atividades obrigatórias e opcionais.

Preserve a arquitetura atual, reutilizando componentes, serviços e funções existentes.

Não recrie funcionalidades que já estão implementadas.

## 2. Randomização obrigatória de alternativas

Implementar embaralhamento automático em todos os questionários de múltipla escolha.

### Regras

- As alternativas devem aparecer em ordem aleatória.
- Uma nova tentativa deve gerar uma nova ordem.
- A ordem deve permanecer estável durante a mesma tentativa, mesmo após re-renderizações.
- Recarregar a página durante uma tentativa não deve alterar a ordem das alternativas já apresentadas.
- O embaralhamento não pode modificar o gabarito.
- A correção deve utilizar identificadores estáveis das alternativas, nunca a posição visual.
- Não alterar o conteúdo original do JSON.
- Evitar padrões previsíveis, como a alternativa correta aparecer sempre na mesma posição.
- Não garantir que duas tentativas consecutivas terão ordens diferentes se isso comprometer a simplicidade ou a segurança; quando possível, evitar repetições imediatas.
- Registrar ou reconstruir de forma confiável a ordem apresentada para permitir revisão posterior.

Utilize Fisher–Yates ou algoritmo equivalente, com uma fonte de aleatoriedade adequada ao ambiente.

### Segurança

Não enviar ao navegador o gabarito de questionários ainda não corrigidos.

A validação das respostas deve continuar no backend.

Não aceitar índices visuais como respostas definitivas.

### Critério de aceite

Um questionário com quatro alternativas deve apresentar diferentes ordens ao longo de várias tentativas, mantendo a correção consistente.

## 3. Criar o tipo `interactive`

Adicionar ao contrato de conteúdo um novo tipo de atividade:

`interactive`

Criar uma evolução versionada do contrato, preferencialmente v2, preservando compatibilidade com conteúdos v1.

Não alterar silenciosamente o significado do schema existente.

### Subtipos iniciais

Implementar:

- `ordering`: ordenar itens.
- `matching`: associar elementos.
- `fill_blank`: completar lacunas.
- `identify`: identificar um elemento ou conceito.
- `prediction`: prever o resultado de um código ou situação.

Priorizar os dois primeiros subtipos, mas estruturar a arquitetura para permitir os demais sem grandes alterações.

Se a implementação de todos os subtipos comprometer a qualidade ou o prazo, entregar `ordering` e `matching` completos e documentar os demais como futuros.

## 4. Atividade de ordenação (`ordering`)

Permitir que o aluno organize itens na sequência correta.

Exemplo:

**Missão:** coloque as invenções em ordem histórica.

Itens:
- Ábaco
- Calculadora mecânica
- Tear controlado por cartões perfurados
- Computador eletrônico

### Interface

- Cards interativos.
- Controles para mover itens para cima e para baixo.
- Suporte a mouse, teclado e dispositivos móveis.
- Botão para verificar resposta.
- Feedback claro e amigável.

Não depender exclusivamente de arrastar e soltar.

### Randomização

A ordem inicial dos itens deve ser embaralhada a cada nova tentativa.

Não iniciar sempre na sequência correta.

Manter a ordem estável durante a tentativa.

### Correção

A sequência correta deve permanecer protegida no backend.

Comparar os IDs dos itens na ordem enviada pelo aluno.

## 5. Atividade de associação (`matching`)

Permitir relacionar conceitos com suas definições.

Exemplo:

- HTML → Estrutura da página.
- CSS → Aparência visual.
- JavaScript → Interatividade.

### Interface

Criar uma experiência simples e responsiva.

O aluno poderá selecionar um conceito e associá-lo à definição correspondente.

### Randomização

Embaralhar independentemente:

- A ordem dos conceitos.
- A ordem das definições.

Não preservar alinhamentos que revelem as respostas.

### Correção

Utilizar identificadores estáveis.

O gabarito deve permanecer no backend.

Exibir feedback após a submissão.

## 6. Atividades futuras

Preparar o modelo para:

### `fill_blank`

Completar uma palavra, conceito, tag ou trecho de código.

### `identify`

Identificar partes de uma estrutura, URL ou documento HTML.

### `prediction`

Analisar um código ou situação e prever seu resultado.

Quando esses formatos utilizarem alternativas, elas também deverão ser embaralhadas.

Não forçar randomização em elementos cuja ordem faça parte do enunciado, como código-fonte ou sequências que o aluno precisa analisar.

## 7. Estrutura JSON

Definir um contrato tipado e validado em runtime.

Exemplo conceitual de atividade:

```json
{
  "key": "historia-ordenacao",
  "type": "interactive",
  "title": "A linha do tempo",
  "required": true,
  "content": {
    "interactionType": "ordering",
    "instructions": "Organize as invenções do mais antigo ao mais recente.",
    "items": [
      { "id": "abaco", "label": "Ábaco" },
      { "id": "calculadora", "label": "Calculadora mecânica" },
      { "id": "tear", "label": "Tear com cartões perfurados" },
      { "id": "computador", "label": "Computador eletrônico" }
    ]
  }
}
```

O exemplo é conceitual. Ajuste os campos ao contrato oficial.

O gabarito não deve estar dentro de `content` acessível ao aluno.

Armazene as respostas corretas em uma estrutura protegida, conforme a arquitetura existente.

## 8. Tentativas e progresso

Integrar as atividades interativas ao sistema de progresso da Etapa B.

Registrar:

- Aluno.
- Atividade.
- Tentativa.
- Respostas enviadas.
- Pontuação.
- Resultado.
- Data da submissão.

Permitir configurar:

- Quantidade máxima de tentativas.
- Nota mínima.
- Feedback após correção.
- Obrigatoriedade da atividade.

As tentativas devem seguir as mesmas garantias de segurança e consistência dos questionários existentes.

Evitar duplicar tabelas ou lógica de correção quando for possível reutilizar o sistema atual.

## 9. Conclusão das atividades

Uma atividade interativa obrigatória deve ser concluída quando o aluno atingir o critério configurado.

Atividades opcionais não devem bloquear o progresso curricular.

Não exigir aprovação da professora para atividades interativas autocorrigíveis.

Manter projetos que exigem avaliação manual separados das práticas interativas.

Isso é especialmente importante para a Aula 01 — Máquinas que mudaram o mundo, que deverá ser totalmente autônoma.

## 10. Componentes React

Criar ou adaptar componentes reutilizáveis, seguindo o padrão visual atual da Bitaria.

Sugestões:

- `InteractiveActivity`
- `OrderingActivity`
- `MatchingActivity`
- `InteractiveFeedback`
- `ActivityAttemptStatus`

Manter boa experiência em desktop e mobile.

Implementar estados de carregamento, erro, tentativa esgotada e atividade concluída.

Considerar acessibilidade, navegação por teclado e feedback compreensível.

## 11. Importação e validação

Atualizar:

- Tipos TypeScript.
- Schema JSON.
- Validadores.
- Importador.
- Pré-visualização administrativa.
- Renderizador de atividades.
- Documentação do contrato.

Garantir que arquivos v1 continuem funcionando.

Não permitir importação de atividades com IDs duplicados, gabaritos inconsistentes ou configurações inválidas.

Produzir exemplos válidos para `ordering` e `matching`.

## 12. Testes obrigatórios

Criar testes automatizados para:

1. Embaralhamento de alternativas de quiz.
2. Persistência da ordem durante a tentativa.
3. Nova randomização em nova tentativa.
4. Correção independente da posição visual.
5. Ausência de gabaritos na resposta pública.
6. Ordenação com resposta correta.
7. Ordenação com resposta incorreta.
8. Associação correta.
9. Associação incorreta.
10. Limites de tentativas.
11. Critérios de aprovação.
12. Integração com progresso curricular.
13. Compatibilidade com JSON v1.
14. Permissões e RLS.
15. Funcionamento responsivo e acessível.

Se necessário, criar testes de integração para os fluxos completos.

## 13. Restrições

Não implementar agora:

- Editor visual de atividades.
- Jogos complexos.
- Gamificação.
- Correção por inteligência artificial.
- Execução de código no navegador.
- Integração com Google Meet.
- Geração de PDFs.
- Painel da professora da Etapa C.

Não modificar dados reais ou aplicar migrations em produção sem autorização.

## 14. Entregáveis

Ao finalizar, apresentar:

- Resumo da implementação.
- Arquivos modificados.
- Migrations criadas.
- Atualizações de RLS.
- Contrato JSON atualizado.
- Exemplos de atividades interativas.
- Testes executados.
- Limitações.
- Instruções de implantação.

Também produzir um documento curto chamado:

`guia-producao-atividades-interativas.md`

Esse documento será utilizado pelo ChatGPT Work para gerar atividades compatíveis com a Bitaria.

## 15. Critérios de aceite

A Etapa B.1 estará concluída quando:

1. Questionários exibirem alternativas embaralhadas.
2. A ordem permanecer estável durante a tentativa.
3. A correção funcionar independentemente da posição.
4. Atividades `ordering` e `matching` funcionarem em React.
5. As atividades forem corrigidas com segurança.
6. O progresso for registrado corretamente.
7. Atividades autônomas não dependerem de avaliação da professora.
8. O contrato JSON estiver documentado e validado.
9. Os conteúdos v1 continuarem funcionando.
10. Os testes relevantes forem aprovados.

## Orientação final

Implemente a Etapa B.1 antes de iniciar a Etapa C.

Preserve as funcionalidades existentes, priorize código reutilizável e não introduza complexidade desnecessária.

Ao concluir, forneça os arquivos de documentação necessários para atualizar os prompts de produção pedagógica do ChatGPT Work.


# ADENDO À ETAPA B.1 — GAMIFICAÇÃO, XP E CONQUISTAS

Antes de iniciar a implementação da Etapa B.1, inclua a integração com o sistema de gamificação já existente na Bitaria.

## 1. Análise obrigatória

Inspecione o repositório e identifique:

- Tabelas de XP, níveis e conquistas existentes.
- Serviços, funções e componentes de gamificação.
- Regras atuais de concessão de XP.
- Como conquistas são desbloqueadas.
- Como recompensas são apresentadas ao aluno.

Não recrie o sistema de gamificação nem duplique tabelas existentes.

## 2. Integração com atividades

Após a conclusão válida de uma atividade, o backend deverá verificar se existe uma recompensa configurada.

Permitir recompensas por:

- Conclusão de questionário.
- Conclusão de atividade interativa.
- Conclusão de estudo autônomo.
- Confirmação de aula online pela professora.
- Aprovação de miniprojeto.
- Aprovação de projeto final.
- Conclusão de submódulo, quando compatível com as regras existentes.

## 3. Contrato JSON

Avalie a inclusão de um campo opcional `gamification` no contrato versionado.

Campos conceituais:

- `xpReward`
- `awardOn`
- `achievementKeys`

Antes de implementar, verifique se o sistema atual já possui uma tabela ou configuração centralizada de recompensas.

Se já houver, prefira referenciar regras cadastradas por identificadores estáveis, em vez de duplicar valores de XP no JSON.

O JSON é uma declaração de configuração pedagógica, não uma autorização para conceder recompensas.

## 4. Segurança e consistência

- Conceder XP exclusivamente no backend.
- Nunca confiar em valores de XP enviados pelo navegador.
- Não conceder a mesma recompensa de conclusão mais de uma vez.
- Garantir idempotência mesmo com requisições repetidas ou concorrentes.
- Não conceder XP quando a atividade exigir aprovação ainda pendente.
- Manter histórico auditável das recompensas.
- Preservar XP já acumulado por alunos existentes.
- Não permitir que alterações posteriores no JSON concedam recompensas retroativas indevidas sem uma regra explícita.

## 5. Experiência do aluno

Ao concluir uma atividade, apresentar:

- XP recebido.
- Conquista desbloqueada, quando houver.
- Progresso de nível, se o sistema já oferecer essa funcionalidade.

Criar uma apresentação discreta e agradável, sem interromper excessivamente a aprendizagem.

## 6. Testes

Verificar:

1. XP concedido após conclusão válida.
2. XP não concedido em tentativa reprovada.
3. XP não duplicado em novas tentativas.
4. XP não duplicado em requisições concorrentes.
5. Projeto só concede recompensa após aprovação.
6. Conquista desbloqueada uma única vez.
7. Usuário não consegue alterar seu próprio XP.
8. Compatibilidade com os registros de gamificação existentes.

## 7. Documentação

Atualize o contrato JSON e o guia de produção do ChatGPT Work para explicar como configurar recompensas.

Documente quais regras pertencem ao conteúdo pedagógico e quais são controladas centralmente pela Bitaria.

Não altere os valores globais de XP ou as regras de níveis existentes sem apresentar previamente o impacto.