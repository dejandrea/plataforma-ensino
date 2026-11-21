# Artefatos de planejamento — NÃO IMPLANTADOS

Estes arquivos pertencem à proposta de Bitaria Lesson Package. Não são um importador, não alteram contratos de runtime e não tornam o envelope aceito pelo painel atual.

- `manifest.proposta.schema.json`: schema candidato, sujeito a aprovação.
- `exemplos/minimo` e `exemplos/completo`: arquivos abertos dos exemplos sintéticos.
- `exemplos/exemplo-minimo.zip` e `exemplo-completo.zip`: os mesmos exemplos em um ZIP único por aula, com ZIPs web internos quando usados.
- `validate-proposal.mjs`: harness de documentação sem rede/banco, que chama validateLessonImport e parsePresentationPackage existentes. Recebe pasta, não ZIP externo.
- `test-proposal.mjs`: dois casos válidos e sete negativos; cria apenas cópias sintéticas em pastas temporárias do computador. Não é teste de produção.
- `casos-invalidos.json`: descrição das mutações e seus erros; não é parte do contrato do pacote.

## Execução local

Usar as dependências já instaladas no repositório, sem novos serviços ou instalação:

```powershell
node docs/propostas/pacote-aula-v1/validate-proposal.mjs docs/propostas/pacote-aula-v1/exemplos/minimo
node docs/propostas/pacote-aula-v1/validate-proposal.mjs docs/propostas/pacote-aula-v1/exemplos/completo
node --test docs/propostas/pacote-aula-v1/test-proposal.mjs
```

Resultado de 12/11/2026: exemplos estruturais válidos e **9/9 testes aprovados**. Sempre permanecem os avisos de que o ZIP externo, destino real e permissões Drive não foram validados, e de que o envelope não é suportado pelo painel hoje.

## Integridade dos exemplos gerados

| Arquivo | Bytes | SHA-256 |
|---|---:|---|
| exemplo-minimo.zip | 1790 | 0e42f640de54f3daa44340c06560e5a09a4b44b9698b1972c51e6647242bc568 |
| exemplo-completo.zip | 18802 | 56e409754980f86cdc335f0f7356211fa38ce94b32b423d8225817e60f89f1b9 |

O mínimo tem uma atividade externa fictícia e nenhum deck. O completo tem nove atividades, cobrindo oito tipos, dois decks mínimos e uma referência docente fictícia. Os exemplos mostram contrato/ligação, não qualidade ou completude pedagógica de uma aula real; example.invalid e links EXEMPLO_NAO_PUBLICAR não são recursos reais.

Não colocar estes artefatos em public/. Não incluir schema, este README, o validador ou relatórios dentro de um pacote de importação.

Ver [contrato candidato](../../contrato-pacote-aula-proposto.md), [guia Work](../../work-pacote-aula-proposto.md) e [arquitetura](../../arquitetura-editorial-e-pacote-unificado.md).
