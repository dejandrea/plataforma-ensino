# BITARIA — Implementar regras oficiais de XP v1

Precisamos configurar e, quando necessário, complementar o sistema centralizado de gamificação da Bitaria.

Antes de alterar código ou banco, inspecione as tabelas, migrations, RPCs e regras existentes de XP, especialmente as implementadas nas Etapas A, B e B.1.

Não criar um segundo sistema de recompensas. Reutilizar a arquitetura atual, preservando compatibilidade com o contrato de conteúdo JSON v2.

## Regras oficiais

1. Conclusão de slides: 10 XP por atividade.
2. Conclusão de mapa mental: 10 XP por atividade.
3. Questionário: XP equivalente ao percentual de acerto, de 0 a 100.
4. Todo questionário deve conter no mínimo 4 perguntas.
5. Envio válido de mini-projeto: 50 XP.
6. Avaliação de mini-projeto: XP igual à nota atribuída pela professora, de 0 a 100.
7. Envio válido de projeto: 100 XP.
8. Avaliação de projeto: XP igual à nota atribuída pela professora, de 0 a 100.
9. Conclusão de outras atividades, incluindo ordering e matching: 15 XP.
10. Conclusão da aula e liberação do avanço: 50 XP.

## Regras de segurança e consistência

- Calcular XP exclusivamente no backend.
- Não aceitar valores de XP enviados pelo cliente.
- Validar a autorização da professora antes de registrar avaliações.
- Impedir duplicação de XP por recarregamento, repetição de chamadas, reenvios ou múltiplas tentativas.
- Para questionários, considerar a primeira tentativa concluída para fins de XP; tentativas posteriores podem melhorar a aprovação, mas não gerar XP adicional.
- Conceder XP de questionário conforme a porcentagem de acertos, mesmo que a tentativa não atinja a nota mínima.
- Usar arredondamento consistente para resultados fracionários.
- Diferenciar mini-projetos de projetos comuns por metadados confiáveis do backend, não por textos ou títulos.
- Para projetos, separar recompensa pelo envio e recompensa pela avaliação.
- Em caso de alteração de nota, ajustar o XP da avaliação para refletir a nota definitiva, sem somar recompensas repetidas.
- Conceder XP de conclusão da aula uma única vez, inclusive na última aula de um curso.
- Preservar histórico auditável de eventos e alterações.

## Integração com o conteúdo

O Work continuará produzindo JSON v2 com `rewardRuleKey` e `awardOn`, sem valores numéricos de XP.

Adapte o mapeamento das regras existentes para distinguir slides, mapas, questionários, atividades interativas, mini-projetos, projetos e conclusão de aula.

Não inventar chaves incompatíveis com o contrato atual. Caso o contrato precise evoluir para distinguir mini-projeto e projeto, propor a alteração mínima e documentar a compatibilidade.

## Testes obrigatórios

Criar testes automatizados para:

- Conclusão de slides e mapa mental.
- Quiz com 0%, 25%, 60%, 80% e 100% de acerto.
- Rejeição de questionários com menos de quatro perguntas.
- Repetição de tentativas e chamadas duplicadas.
- Envio de mini-projeto e projeto.
- Avaliação pela professora e alteração posterior da nota.
- Conclusão da aula e avanço.
- Isolamento de permissões entre alunos e professores.
- Consistência do saldo e do histórico de XP.

## Entrega

Informar quais regras já eram suportadas, quais mudanças foram necessárias, migrations criadas, testes executados e eventuais riscos de migração.

Executar primeiro em ambiente local isolado. Não aplicar migrations em produção sem autorização explícita.