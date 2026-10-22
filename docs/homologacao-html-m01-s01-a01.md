# Homologação — HTML M01 S01 A01

Resultado: aprovado no ambiente local isolado de testes, em 22/10/2026.

Origem: https://drive.google.com/file/d/1WXFhARQt-I4TzJnqnXsRfgBcArJcs9Iu/view

Arquivo: HTML-M01-S01-A01-aula.v2.admin.json. Aula: Máquinas que Mudaram o Mundo.

Ambiente: interface React real em Vite, Chrome headless e PostgreSQL temporário via PGlite, com as migrations do projeto. O adaptador HTTP local substitui o transporte e a identidade de autenticação; as operações executam as funções SQL reais. Não houve alteração em produção ou em banco remoto.

## Verificações aprovadas

- JSON aceito pelo validador real do contrato v2.
- Prévia administrativa, importação como rascunho e publicação pela interface.
- Links dos dois estudos em slides e do mapa mental preservados.
- Confirmação dos três materiais de estudo.
- Ordenação histórica respondida e aprovada com 100/100.
- Questionário de cinco perguntas respondido com o gabarito fornecido.
- Conclusão das cinco atividades obrigatórias sem realizar a associação opcional.
- Conclusão preservada após recarregar a página.
- Associação opcional respondida e aprovada com 100/100 em viewport de 390 × 844.
- Ausência de rolagem horizontal no cenário móvel e de erros JavaScript capturados.

Comando: `node --test tests/html-lesson-homologation.test.mjs`.
Resultado final: 1 teste aprovado, 0 falhas; duração total de aproximadamente 41 segundos.

Evidências: `test-results/html-lesson-desktop.png` e `test-results/html-lesson-mobile.png`.

## Limites

Os recursos externos são simulados pelo harness: a disponibilidade pública e o conteúdo visual dos PDFs no Drive não foram homologados. A sessão real do Supabase, o transporte PostgREST remoto e um deploy de staging não foram testados. Os valores de XP exibidos usam a configuração da fixture e não representam uma conferência da configuração de produção.

As primeiras execuções identificaram ajustes necessários na preparação do teste (título da aula de destino e seletor do link do mapa mental). A execução final passou sem alterações no código da aplicação ou no JSON original.
