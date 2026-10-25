# BITARIA — Implementar atividade do tipo VIDEO no contrato JSON v2

## Objetivo

Adicionar suporte a atividades de vídeo na plataforma de aprendizagem da Bitaria, reutilizando a arquitetura atual de atividades, progresso e gamificação.

O vídeo será um novo tipo de atividade (`video`), com arquivo hospedado no Google Drive.

A presença de vídeo em uma aula é opcional. Nenhuma aula existente deverá passar a exigir vídeo.

## 1. Contrato JSON v2

Adicionar `video` aos tipos de atividade aceitos pelo contrato JSON v2.

A estrutura deve incluir:

- `key`
- `type: "video"`
- `title`
- `description`
- `orderIndex`
- `durationMinutes`
- `required`
- `prerequisites`
- `content`
- `gamification`

O conteúdo deve armazenar a URL do vídeo no Google Drive.

Manter a estrutura consistente com as atividades de slides e mapa mental.

Atualizar:

- Schema JSON v2.
- Validação semântica.
- Tipagens TypeScript.
- Importador administrativo.
- Prévia administrativa.
- Documentação e exemplos do contrato.

Não modificar o formato das atividades existentes.

## 2. Visualização do vídeo

Criar um componente de visualização para atividades do tipo `video`.

Requisitos:

- Incorporar o vídeo do Google Drive.
- Reutilizar a lógica segura de URLs `/preview` já implementada para materiais do Drive.
- Preservar parâmetros de acesso, incluindo `resourcekey` quando houver.
- Não liberar permissões de iframe para domínios arbitrários.
- Manter um link para abrir o vídeo em outra aba.
- Exibir título, descrição e duração.
- Layout responsivo, adequado para desktop e celular.
- Tratar erros de carregamento e links inválidos.
- Preservar acessibilidade e navegação por teclado.

Não utilizar APIs de vídeo externas nesta primeira versão.

## 3. Conclusão da atividade

O vídeo deverá seguir o mesmo comportamento de conclusão manual dos slides.

Após assistir, o aluno poderá clicar em:

**Concluir vídeo**

A confirmação registra o progresso da atividade.

Não tentar detectar automaticamente o fim da reprodução pelo player do Google Drive.

A atividade poderá ser marcada como obrigatória ou opcional pelo campo `required`.

Se for obrigatória, deverá participar normalmente das regras de conclusão da aula.

## 4. Gamificação

Conceder **10 XP** pela conclusão do vídeo.

Reutilizar a regra oficial de estudo `activity_study`, caso ela suporte essa classificação.

Não criar um sistema paralelo de XP.

Requisitos:

- Recompensa concedida uma única vez por aluno e atividade.
- Recarregar a página não duplica XP.
- Assistir novamente não duplica XP.
- O cliente não informa a quantidade de pontos.
- O backend valida a conclusão e registra o evento.

## 5. Compatibilidade

- Aulas sem vídeo continuam funcionando.
- JSONs v2 existentes continuam válidos.
- Slides e mapas mentais não são afetados.
- Questionários, projetos e atividades interativas mantêm seu comportamento.
- O importador deve aceitar aulas contendo atividades de vídeo.
- A prévia administrativa deve exibir o vídeo sem registrar progresso ou XP.

## 6. Testes

Criar testes para:

1. Validação de atividade `video`.
2. Importação do JSON v2.
3. Aula sem vídeo.
4. Aula com vídeo opcional.
5. Aula com vídeo obrigatório.
6. Visualização no desktop.
7. Visualização no celular.
8. URL do Google Drive.
9. Preservação de `resourcekey`.
10. Conclusão manual.
11. Concessão de 10 XP.
12. Proteção contra XP duplicado.
13. Prévia administrativa sem alteração de progresso.
14. Regressão das atividades já existentes.

## 7. Entrega

Apresentar:

- Arquivos alterados.
- Eventuais migrations.
- Atualização do contrato v2.
- Exemplo de JSON com vídeo.
- Evidências visuais.
- Resultados dos testes.

Não aplicar migrations em produção sem autorização explícita.

**Resultado esperado:** a Bitaria deverá permitir que o Work produza aulas com vídeos hospedados no Google Drive, sem exigir vídeos em todas as aulas e concedendo 10 XP por vídeo concluído.