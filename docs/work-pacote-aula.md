# Work → Bitaria: uma aula, um ZIP

Guia operacional da E2a local — 16/11/2026. **Funcionalidade implementada e testada localmente, ainda não implantada na plataforma de produção.** Não enviar o pacote unificado ao antigo importador de ZIP de apresentações.

## Para a administradora

1. Em Gestão → Conteúdo, selecionar uma aula curricular vazia e abrir **Pacote completo / Kit Work**.
2. Conferir a origem HTTPS da plataforma e clicar **Exportar kit para o Work**. O servidor reserva identidades estáveis; não é necessário consultar tabelas ou código.
3. Enviar o kit ao Work e pedir que siga `LEIA-ME-Work.md`, `identidade.json` e os schemas fornecidos. O kit é material de produção; **não é o ZIP final de importação**.
4. Receber um único ZIP, selecionar **Pacote ZIP completo**, revisar atividades, referências e apresentações. A validação do servidor será repetida ao salvar.
5. Confirmar **Salvar pacote em rascunho**. Isso prepara versões privadas e vínculos pretendidos, sem publicar atividades ou apresentações.
6. Reabrir/recuperar a operação para conferir o rascunho e as apresentações. Não há importação nem vínculo manual por apresentação.
7. Após revisão, confirmar **Publicar conjunto revisado**. Uma RPC publica atividades, ativa versões e cria vínculos na mesma transação. O status curricular da aula permanece separado.

Enquanto há pacote pendente, a aula fica reservada: os importadores/editor/publicação web independentes não podem publicar partes do conjunto. Em falha de preparação, reenviar o mesmo ZIP para retomar. Conflito com estado alterado por outra operação exige revisão; não será sobrescrito automaticamente.

## Conteúdo do kit

`identidade.json` contém UUID/key da aula, contexto curricular e seus IDs, origem, inventário e slots com UUIDs de apresentações fornecidos pelo servidor. Não contém identificador da conta administrativa. Inclui schemas reais de aula v1/v2, manifesto v1 e apresentação v1, instruções e um pacote sintético válido adaptado ao alvo.

Se não existia key editorial, o servidor cria uma key determinística baseada no UUID; ela não é inferida do título nem deve ser renomeada pelo Work. Os slots disponíveis são `principal`, `revisao` e `complementar`. Usar de zero a três, sem inventar seus UUIDs. Cada slot usado corresponde a uma atividade slides.

As instruções canônicas incorporadas ao ZIP estão em [src/contracts/work-lesson-package.md](../src/contracts/work-lesson-package.md). Elas prevalecem sobre os antigos textos candidatos. O [schema operacional](../src/contracts/lesson-package.v1.schema.json) preserva a estrutura aprovada; somente título e URI de identificação deixaram de ser de proposta.

## ZIP final

```text
bitaria-{lesson.key}-{productionId}.zip
├── manifest.json
├── aula.json
└── apresentacoes/          # opcional, até três ZIPs
    ├── principal.zip
    ├── revisao.zip
    └── complementar.zip
```

Manifesto v1: `packageVersion`, `productionId`, `targetLessonId`, `platformOrigin`, `files`; opcionalmente `presentations` e `teacherResources`. `files` declara aula.json e os ZIPs internos com bytes exatos e SHA-256 dos arquivos finais. Não incluir manifest.json no próprio inventário. Cada apresentação declara key, activityKey, presentationId e path conforme o kit.

Na atividade slides correspondente:

```json
{"schemaVersion":1,"type":"slides","format":"link","resourceUrl":"{platformOrigin}/apresentacoes/gerenciada/{presentationId}","altText":"Descrição acessível da apresentação"}
```

Substituir os marcadores pelos valores do kit. ZIP interno é exatamente o contrato atual: apresentacao.json ou decks/nome.json, imagens referidas por `./images/...` e créditos recomendados. Não produzir HTML/JS, outro viewer ou novas poses da Bitara. Quizzes avaliativos, atividades, flashcards e planos usam o JSON de aula existente; perguntas em slides não geram tentativas ou XP.

Limites iniciais: externo 25 MiB; expansão externa 32 MiB; efetiva 50 MiB; manifesto 64 KiB; aula.json 2.000.000 bytes; até 200 atividades; até três apresentações, cada ZIP até 10 MiB, além dos limites próprios do importador web. Esses tetos precisam de homologação integrada de recursos antes de produção; não são garantia de desempenho em Edge hospedada.

## Recursos e privacidade

Manter materiais no Google Drive. Não adicionar PDFs/vídeos/binários ao pacote externo ou criar buckets. O inventário separa URLs gerenciadas, Drive e referências externas, inclusive as privadas. Permissão de acesso e licença precisam ser revistas manualmente; não há API Drive nem promessa de verificar compartilhamento.

Gabaritos e planos ficam em teacherOnly; referências docentes adicionais ficam em teacherResources. O estado de autoria e as operações são privados e administrativos. A prévia de aluno usa a projeção existente sem teacherOnly. Os professores preservam sua política anterior de leitura de gabaritos publicados, sem ganhar acesso a rascunhos editoriais.

## Elegibilidade e limites desta entrega

Somente aula existente, curricular e sem histórico, atividades, materiais legados ou apresentações anteriores fora da operação. Rascunho editorial alheio também bloqueia. Nada é apagado para tornar a aula elegível. A E2a não atualiza aulas preenchidas, não migra coortes, não altera créditos históricos e não oferece editor visual completo.

Reimportação idêntica recupera a operação, inclusive após publicação. Recompactar os mesmos conteúdos não cria novas versões. Depois de preparada, formatação/chaves de objeto do JSON equivalente também não alteram a identidade semântica. productionId com conteúdo diferente é conflito. Durante preparação interrompida, preservar os bytes dos arquivos originais para retomar; não corrigir/reformatar o pacote silenciosamente. Cancelamento e limpeza administrativa de operações não fazem parte da UI inicial.

## Demonstração sintética

- [Pacote completo](examples/unified-lesson-package/pacote-sintetico-completo.zip): nove atividades, oito tipos, duas apresentações e referências fictícias.
- [Kit Work sintético](examples/unified-lesson-package/kit-work-sintetico.zip).
- [Identidades da fixture](examples/unified-lesson-package/identidade-sintetica.json).

Esses arquivos correspondem somente à fixture local `tests/fixtures/lesson-package-db.mjs`. Para outra aula, **usar o kit e o botão Baixar pacote sintético do painel**, que fornecem os UUIDs reais daquele ambiente. Não editar UUIDs à mão para adaptar o exemplo e não importar a demonstração como conteúdo de aula real.

Reproduzir o fluxo local automatizado: `npm.cmd run test:lesson-package:browser`. Regenerar apenas os exemplos: `npm.cmd run example:lesson-package`. Esse comando não acessa banco nem rede. Testes SQL/Edge simulados: `npm.cmd run test:lesson-package`.
