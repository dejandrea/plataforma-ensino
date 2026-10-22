# BITARIA — Pacote de Correções e Melhorias
## Especificação técnica consolidada para o Codex — Versão 2

**Projeto:** Plataforma Bitaria  
**Tecnologias:** React, TypeScript, Vite, Supabase/PostgreSQL  
**Objetivo:** implementar correções, reorganizações e melhorias sem regredir funcionalidades existentes.

---

# 1. DIRETRIZES GERAIS

Antes de iniciar:

1. Inspecione a arquitetura atual do projeto.
2. Identifique componentes, serviços, tabelas, migrations, RPCs e políticas RLS relacionados às funcionalidades solicitadas.
3. Verifique o que já existe antes de implementar algo novo.
4. Preserve as funcionalidades e os dados existentes.
5. Não recrie sistemas paralelos de conquistas, XP, avaliações ou agendamentos.
6. Considere que a Etapa C, referente ao ambiente da professora, está em desenvolvimento.
7. Não sobrescreva alterações em andamento.
8. Execute testes automatizados e testes de interface sempre que possível.
9. Não aplique migrations em produção sem autorização.

**Regra fundamental:** as regras oficiais de XP apresentadas na seção 2 prevalecem sobre quaisquer valores antigos existentes na plataforma ou mencionados em especificações anteriores.

---

# 2. REGRAS OFICIAIS DE XP — FONTE ÚNICA DE VERDADE

| Evento | XP |
|---|---|
| Concluir slides | 10 |
| Concluir mapa mental | 10 |
| Questionário | Percentual de acerto, de 0 a 100 |
| Enviar mini-projeto | 50 |
| Avaliação de mini-projeto | Nota da professora, de 0 a 100 |
| Enviar projeto | 100 |
| Avaliação de projeto | Nota da professora, de 0 a 100 |
| Concluir outras atividades | 15 |
| Concluir aula | 50 |

### Exemplos

Mini-projeto enviado e avaliado com nota 80:

50 XP pelo envio + 80 XP pela avaliação = **130 XP**.

Projeto enviado e avaliado com nota 80:

100 XP pelo envio + 80 XP pela avaliação = **180 XP**.

Questionário com 80% de acerto:

**80 XP**.

### Regras de implementação

- Todo questionário deverá conter no mínimo quatro perguntas.
- O XP do questionário deverá ser calculado pelo percentual de acerto.
- O cálculo deverá ser realizado no backend.
- O aluno não poderá informar ou manipular a quantidade de XP.
- Cada evento recompensável deverá possuir proteção contra duplicação.
- Reenvios e chamadas repetidas não poderão gerar XP adicional indevido.
- O XP por envio de projeto será concedido separadamente do XP pela avaliação.
- Alterações posteriores da nota deverão ajustar a recompensa de avaliação, sem acumular notas anteriores.
- A conclusão da aula concederá 50 XP uma única vez, inclusive na última aula do curso.
- Reutilizar as estruturas existentes de regras, eventos de XP e conquistas.

### Política de tentativas de questionário

Manter a regra oficial definida anteriormente: **a primeira tentativa concluída determina o XP do questionário**.

Tentativas posteriores podem melhorar o resultado de aprendizagem e a aprovação, mas não concedem novamente o XP.

Não permitir acumulação de XP por repetição de tentativas.

### Compatibilidade

Os conteúdos JSON v2 continuarão utilizando referências como `rewardRuleKey`, sem valores numéricos de XP.

Se as regras antigas estiverem configuradas com valores diferentes, adequá-las ao modelo oficial, preservando o histórico de recompensas já concedidas.

---

# 3. AGENDAMENTO DE AULAS

## 3.1. Recorrência em múltiplos dias

Permitir que o usuário selecione mais de um dia da semana em agendamentos recorrentes.

**Exemplo:**

Aulas recorrentes toda terça-feira e quinta-feira, às 19h.

### Requisitos

- Seleção de múltiplos dias da semana.
- Compatibilidade com recorrência em apenas um dia.
- Respeito ao período de início e término da recorrência.
- Respeito ao fuso horário.
- Prevenção de eventos duplicados.
- Preservação de vínculos com alunos, professoras e turmas.
- Edição e cancelamento conforme os recursos existentes.

### Critérios de aceite

Um agendamento recorrente para terça e quinta deverá gerar corretamente as duas ocorrências semanais.

## 3.2. Tolerância de acesso

**Problema atual:** a aula desaparece da plataforma ao atingir o horário de início.

**Correção:** permitir que o aluno acesse a aula até 15 minutos após o horário de início.

Exemplo:

- Início: 19h.
- Acesso permitido até: 19h15.

A aula não deverá desaparecer do histórico.

Separar as regras de visibilidade, acesso e encerramento do evento.

Não remover registros ou alterar indevidamente o status da aula.

---

# 4. MENU ADMINISTRATIVO — CONQUISTAS

Criar uma opção no menu principal administrativo chamada:

**Conquistas**

Dentro dela, implementar quatro abas.

## 4.1. Conquistas

Manutenção das conquistas existentes.

**Remover a opção de cadastrar novas conquistas pela interface.**

As conquistas oficiais serão gerenciadas por configuração controlada no sistema.

## 4.2. Tecnologias

- Cadastro.
- Edição.
- Manutenção.
- Seleção de ícones.

## 4.3. Missões

- Cadastro.
- Edição.
- Manutenção.
- Seleção de ícones.

## 4.4. Maestrias

- Cadastro.
- Edição.
- Manutenção.
- Seleção de ícones.

## 4.5. Ícones

Todas as áreas administrativas relacionadas a conquistas deverão oferecer suporte a ícones.

Preferir um seletor reutilizável com pré-visualização.

Preservar os ícones existentes.

---

# 5. CONQUISTAS OFICIAIS

Implementar as seguintes conquistas e condições de desbloqueio.

| Conquista | Condição |
|---|---|
| Perfil Exemplar | Completar os dados obrigatórios do perfil |
| Mestre do Networking | Preencher GitHub e LinkedIn |
| Instagrameiro | Preencher Instagram |
| Envio de Projetos | Enviar projeto válido |
| Conclusão do Projeto | Receber avaliação da professora |
| Conclusão do Questionário | Concluir questionário |
| Dedicação Total | Pelo menos 8 logins no mês |
| Super Engajado | Pelo menos 2 logins na semana |

## 5.1. Conquistas de perfil

Recompensas:

- Perfil Exemplar: 30 XP.
- Mestre do Networking: 30 XP.
- Instagrameiro: 10 XP.

Cada conquista deverá ser concedida apenas uma vez por aluno.

A atualização repetida do perfil não poderá gerar XP adicional.

## 5.2. Conquistas relacionadas a projetos

As conquistas Envio de Projetos e Conclusão do Projeto deverão acompanhar os eventos oficiais de projeto.

**Não conceder XP extra apenas por desbloquear essas conquistas.**

Utilizar as regras oficiais:

- Mini-projeto: 50 XP pelo envio + nota da professora.
- Projeto: 100 XP pelo envio + nota da professora.

A conquista representa o reconhecimento da ação, enquanto o XP é concedido pelo evento correspondente.

Evitar qualquer dupla contabilização.

## 5.3. Conclusão do Questionário

Desbloquear a conquista conforme o evento de conclusão do questionário.

O XP deverá seguir exclusivamente a regra oficial de percentual de acerto.

Não criar bônus adicional de XP por essa conquista.

## 5.4. Dedicação Total

Condição: pelo menos oito logins durante o mês.

Processar no primeiro dia do mês seguinte, considerando o mês anterior.

Recompensa: **50 XP por período elegível**.

A cada 12 conquistas Dedicação Total, conceder bônus adicional de **120 XP**.

Registrar o mês de referência e impedir duplicações.

## 5.5. Super Engajado

Condição: pelo menos dois logins na semana.

Processar aos domingos, considerando a semana correspondente.

Recompensa: **20 XP por período elegível**.

A cada 12 conquistas Super Engajado, conceder bônus adicional de **50 XP**.

Registrar a semana de referência e impedir duplicações.

## 5.6. Controle de autenticações

Contabilizar logins efetivos.

Não contabilizar como novos logins:

- Atualizações de página.
- Renovações automáticas de sessão.
- Requisições internas de autenticação.

Implementar processamento periódico idempotente.

Não conceder novamente recompensas de períodos já processados.

---

# 6. GESTÃO > CONTEÚDO CURRICULAR

## 6.1. Questionários de submódulos

Auditar o fluxo existente de questionários, preservando a regra de aprovação curricular de 70%, quando aplicável.

Verificar a implementação histórica das seguintes funcionalidades:

### Primeira tentativa

- Aprovação com 70% ou mais.
- Resultado inferior a 70% permite nova tentativa após 24 horas.

### Segunda tentativa

- Aprovação com 70% ou mais.
- Resultado inferior a 70% faz o conteúdo do submódulo voltar ao estado não concluído para aquele aluno.
- O aluno deverá revisar novamente o conteúdo antes da terceira tentativa.

### Terceira tentativa

- Permitir a tentativa após a revisão exigida.
- Registrar a porcentagem obtida.
- Preservar o histórico das tentativas.

**Importante:** essas regras são referentes ao fluxo curricular legado e não substituem a política oficial de XP.

Em qualquer tentativa, o XP não deverá ser acumulado repetidamente.

A primeira tentativa concluída define o XP do questionário, conforme a seção 2.

Não implementar automaticamente aprovação abaixo de 70% na terceira tentativa, nem inventar novas tentativas. Caso o comportamento atual não esteja definido, documentar a lacuna para decisão.

### Requisitos

- Mínimo de quatro perguntas por questionário.
- Cálculo de porcentagem no backend.
- Registro de tentativas.
- Bloqueio temporal quando aplicável.
- Proteção dos gabaritos.
- Preservação do histórico.
- Compatibilidade com os questionários JSON v2 e com o fluxo de aprendizagem já homologado.

**Não reimplementar o fluxo inteiro se ele já existir.** Corrigir apenas as divergências identificadas.

## 6.2. Envio de projetos

Modificar o formulário de envio de projetos.

### Campos obrigatórios

**Link principal do projeto**
- URL.
- Breve descrição do que o aluno desenvolveu.

### Campos opcionais

Permitir até dois links adicionais, cada um com descrição.

Exemplos:

- Repositório GitHub.
- Protótipo Figma.
- Demonstração complementar.

### Requisitos

- Validar URLs.
- Preservar os dados durante avaliações.
- Exibir links e descrições para a professora.
- Respeitar permissões.
- Manter compatibilidade com envios antigos.
- Evitar recompensas duplicadas por edição ou reenvio.

---

# 7. FINANCEIRO

## 7.1. Cobranças > Gerenciar > Programar nova configuração

Na seleção de pacotes, exibir a modalidade antes do nome.

Exemplos:

- Curso — HTML Básico.
- Mentoria — Desenvolvimento Web.

Utilizar a modalidade registrada no banco de dados.

Não alterar o identificador do pacote nem as regras de cobrança.

## 7.2. Resumo Financeiro > Aplicar Desconto

Ao selecionar um desconto, exibir imediatamente a previsão do valor final.

Mostrar:

- Valor original.
- Desconto selecionado.
- Valor descontado.
- Valor final previsto.

Exemplo:

Valor original: R$ 300,00  
Desconto: 10%  
Valor descontado: R$ 30,00  
Valor final previsto: R$ 270,00

A prévia não deve confirmar nem alterar a cobrança automaticamente.

O cálculo final deverá ser validado no backend.

---

# 8. DASHBOARD ADMINISTRATIVO — MEUS ALUNOS

Mover a classificação geral do ranking para a tela inicial de **Meus Alunos**.

Reutilizar os dados e componentes existentes.

Preservar:

- Posição dos alunos.
- Pontuação.
- Critérios de ordenação.
- Permissões.
- Atualização dos dados.

Não criar um segundo ranking independente.

---

# 9. DASHBOARD DO ALUNO

## 9.1. Minhas Maestrias

Criar uma nova opção no menu principal:

**Minhas Maestrias**

Mover para essa página todo o conteúdo de maestrias atualmente localizado no perfil.

Reutilizar os componentes e serviços existentes.

Evitar conteúdo duplicado no perfil.

## 9.2. Minha Jornada — Ranking

Mover a classificação geral do ranking para a tela inicial Minha Jornada.

Posicionar o ranking ao final da página, abaixo dos demais componentes.

## 9.3. Minha Jornada — Saudação

Mover a saudação para o início da página.

A seção Minhas Conquistas deverá ficar abaixo da saudação.

Preservar os demais componentes em uma sequência coerente.

## 9.4. Alteração de nomenclatura

Na seção Minhas Conquistas, substituir:

**PERFIL DO JOGADOR**

por:

**NÍVEL DO DEV**

Não alterar o cálculo do nível.

---

# 10. SEGURANÇA E INTEGRIDADE

Validar:

- Autorização de professoras e administradores.
- Isolamento dos dados dos alunos.
- Políticas RLS.
- Cálculos de XP exclusivamente no backend.
- Eventos de XP idempotentes.
- Histórico de avaliações e alterações de notas.
- Histórico de questionários.
- Processamento seguro das conquistas recorrentes.
- Compatibilidade com dados e migrations anteriores.

Evitar alterações destrutivas.

---

# 11. PLANO DE EXECUÇÃO

## Fase 1 — Agendamento e financeiro

- Corrigir tolerância de 15 minutos.
- Implementar recorrência em múltiplos dias.
- Exibir modalidade nos pacotes.
- Exibir prévia dos descontos.

## Fase 2 — Menus e dashboards

- Criar área administrativa de Conquistas.
- Reorganizar as quatro abas.
- Implementar seleção de ícones.
- Mover ranking administrativo.
- Criar Minhas Maestrias.
- Reorganizar Minha Jornada.
- Alterar o texto para NÍVEL DO DEV.

## Fase 3 — Conteúdo curricular

- Auditar e corrigir regras de questionários.
- Garantir mínimo de quatro perguntas.
- Preservar aprovação curricular e histórico.
- Implementar links e descrições de projetos.
- Testar compatibilidade com o fluxo JSON v2.

## Fase 4 — Gamificação

- Auditar regras existentes.
- Aplicar a tabela oficial de XP.
- Implementar conquistas oficiais.
- Implementar processamento semanal e mensal.
- Implementar bônus a cada 12 conquistas.
- Impedir duplicação de recompensas.
- Validar XP de projetos, avaliações, atividades e questionários.

---

# 12. TESTES OBRIGATÓRIOS

Criar ou atualizar testes para:

1. Agendamento recorrente em dois dias da semana.
2. Acesso à aula durante a tolerância.
3. Preservação do histórico de aulas.
4. Cadastro e manutenção de tecnologias, missões e maestrias.
5. Ícones nos registros.
6. Conquistas de perfil.
7. Contagem de logins semanais e mensais.
8. Bônus após 12 conquistas elegíveis.
9. Questionários com quatro ou mais perguntas.
10. Aprovação curricular com 70%.
11. Bloqueio de 24 horas, quando aplicável.
12. Segunda reprovação e revisão do submódulo.
13. XP de questionário sem duplicação.
14. Envio de mini-projeto e projeto.
15. Avaliação e alteração de nota.
16. Envio de links adicionais.
17. Prévia de descontos.
18. Exibição de modalidade nos pacotes.
19. Reorganização dos dashboards.
20. Responsividade e permissões.

Executar também os testes de regressão existentes, especialmente os relacionados à Aula 01 — Máquinas que Mudaram o Mundo.

---

# 13. RELATÓRIO DE ENTREGA

Ao concluir cada fase, informar:

- Funcionalidades implementadas.
- Arquivos alterados.
- Migrations criadas.
- Alterações nas regras de negócio.
- Testes executados.
- Resultado dos testes.
- Pendências.
- Riscos de compatibilidade.
- Evidências visuais, quando disponíveis.

Não considerar uma funcionalidade concluída sem validação.

---

# 14. PRIMEIRA AÇÃO

Faça uma auditoria do código atual e apresente um plano de implementação.

Verifique especialmente:

- A existência das regras oficiais de XP.
- As regras legadas de questionários.
- O estado atual da Etapa C.
- A estrutura de conquistas e maestrias.
- As dependências entre as fases.

Em seguida, implemente as fases de maneira incremental, preservando o funcionamento da plataforma.

**Não solicite novamente decisões sobre os valores de XP de projetos e questionários: eles estão definidos na seção 2.**

Caso encontre uma regra curricular ambígua que não esteja coberta pelas decisões oficiais, documente-a sem modificar arbitrariamente o comportamento existente.

Não executar migrations em produção sem autorização explícita.