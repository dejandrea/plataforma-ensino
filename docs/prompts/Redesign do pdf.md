# BITARIA — Redesign do PDF de Relatório de Aulas

## Objetivo

Reformular completamente o design visual do PDF de relatório de aulas gerado pela plataforma Bitaria.

Atualmente, o relatório é muito simples, com aparência de documento administrativo genérico. Quero transformá-lo em um documento profissional, bonito, moderno e com a identidade visual da Bitaria.

Foram fornecidos dois PDFs de referência:

1. **Relatório atual:** gerado automaticamente pela plataforma.
2. **Modelo Canva:** referência visual criada manualmente, que representa a direção de design desejada.

**Utilize o segundo PDF como principal referência visual.**

Não reproduza literalmente os dados ou valores do Canva. O documento final deve utilizar exclusivamente os dados reais do relatório gerado pelo sistema.

---

## 1. Inspeção inicial

Antes de implementar:

- Localize a funcionalidade responsável pela geração do relatório de aulas.
- Identifique a biblioteca de geração de PDF utilizada.
- Verifique como os dados de aulas, duração, valores e descontos são obtidos.
- Localize a logo oficial da Bitaria e as imagens da mascote Bitara.
- Consulte o design system existente, seus tokens, tipografia, cores e componentes.
- Preserve a integração com o módulo financeiro e com os registros de aulas.

Não crie outro gerador paralelo se for possível modernizar o existente.

## 2. Direção visual

Quero um documento que transmita a identidade da Bitaria: uma plataforma moderna de ensino de programação, com linguagem visual gamer e tecnológica, mas com acabamento profissional.

A referência do Canva apresenta:

- Cabeçalho roxo com logo centralizada.
- Slogan "Aprenda. Crie. Evolua."
- Título e identificação do aluno.
- Ilustração da Bitara.
- Lista de aulas em cartões arredondados roxos com detalhes em rosa.
- Indicadores financeiros em cartões escuros.
- Total destacado.
- Logo no rodapé.

Manter essa composição como inspiração, melhorando espaçamentos, alinhamentos, legibilidade e proporções.

Utilizar as cores e fontes oficiais do design system. Não inventar uma identidade visual diferente.

## 3. Estrutura do documento

### A. Cabeçalho

Criar um cabeçalho visual com:

- Logo oficial da Bitaria.
- Slogan "Aprenda. Crie. Evolua."
- Fundo ou elementos decorativos alinhados ao design system.

Evitar um cabeçalho excessivamente alto que prejudique o espaço disponível para o conteúdo.

### B. Identificação do relatório

Exibir:

**Relatório de aulas realizadas**

Abaixo:

- Nome do aluno.
- Período de referência.
- Modalidade, quando disponível e pertinente.

Adicionar uma imagem oficial da Bitara ao lado, de forma equilibrada.

A mascote deve complementar o layout sem competir com as informações principais.

### C. Lista de aulas

Substituir a lista numerada simples por cartões horizontais.

Cada cartão deverá apresentar:

- Data da aula.
- Horário.
- Modalidade.
- Título ou assunto.
- Duração, quando disponível.

Sugestão de organização:

**22/10/2026 · 18h00**  
Mentoria — Introdução ao Figma  
Duração: 1h

Usar cartões com:

- Cantos arredondados.
- Fundo roxo ou superfície equivalente.
- Detalhes discretos em magenta.
- Textos com contraste adequado.
- Hierarquia clara entre data, título e informações secundárias.
- Espaçamento consistente.

Evitar textos muito pequenos, truncamentos e descrições sobrepostas.

As aulas deverão ser ordenadas cronologicamente de forma consistente, preferencialmente da mais recente para a mais antiga.

Não criar registros duplicados nem alterar datas e títulos provenientes do banco.

### D. Resumo financeiro

Na parte inferior do relatório, criar uma área de indicadores, semelhante ao modelo do Canva.

Exibir:

- Aulas no período.
- Carga horária total.
- Valor da hora/aula.
- Valor bruto.
- Descontos.
- Total final.

Utilizar cartões com fundo escuro, bordas arredondadas e valores destacados.

O **total final** deve receber maior destaque visual que os demais indicadores.

Exemplo de estrutura:

AULAS NO PERÍODO: 7  
CARGA HORÁRIA: 7h  
HORA/AULA: R$ 50,00  
VALOR BRUTO: R$ 350,00  
DESCONTOS: R$ 201,25  

**TOTAL: R$ 148,75**

Esses valores são apenas ilustrativos. O relatório deverá utilizar os valores reais fornecidos pelo sistema.

Não alterar fórmulas, descontos, valores de cobrança ou regras financeiras.

### E. Rodapé

Criar um rodapé discreto com:

- Logo oficial da Bitaria.
- Identidade visual consistente.
- Numeração de páginas, quando houver mais de uma.

Não incluir informações jurídicas, contatos ou identificadores não existentes sem necessidade.

---

## 4. Paginação inteligente

O documento precisa funcionar para alunos com poucas ou muitas aulas no mês.

### Relatórios curtos

Quando houver poucas aulas, produzir um layout equilibrado, sem espaços vazios exagerados.

### Relatórios longos

Quando a quantidade de aulas ultrapassar uma página:

- Quebrar automaticamente em páginas adicionais.
- Não cortar cartões de aulas.
- Repetir uma identificação compacta do relatório nas páginas seguintes, se necessário.
- Manter o resumo financeiro no final do documento.
- Não sobrepor o resumo financeiro à lista de aulas.
- Preservar margens e rodapés.

Não comprimir todos os elementos em uma página a ponto de prejudicar a leitura.

---

## 5. Qualidade visual e técnica

Garantir:

- Formato A4 vertical.
- Boa leitura em tela e impressão.
- Fontes legíveis.
- Contraste adequado.
- Textos e valores monetários formatados em português brasileiro.
- Datas em formato brasileiro.
- Alinhamento consistente.
- Espaçamento equilibrado.
- Imagens com proporção preservada.
- Ausência de imagens pixeladas.
- Nenhum texto cortado ou sobreposto.

Preferir textos vetoriais e pesquisáveis no PDF, em vez de renderizar o relatório inteiro como imagem.

Se houver limitações na biblioteca atual, avalie a alternativa mais adequada, justificando qualquer mudança de dependência.

## 6. Uso de imagens e assets

Os arquivos oficiais já estão disponíveis no repositório.

Localize e reutilize:

- Logo principal.
- Logo para fundo claro/escuro, se existir.
- Imagem da Bitara adequada para documentos.
- Fontes e tokens do design system.

Não usar imagens genéricas, emojis como substitutos da mascote nem assets buscados na internet.

Não redesenhar a logo.

## 7. Preservação das regras de negócio

**Esta tarefa é exclusivamente de apresentação visual do relatório.**

Não modificar:

- Cálculos financeiros.
- Quantidade de aulas.
- Duração registrada.
- Descontos.
- Valores finais.
- Regras de faturamento.
- Permissões de acesso.
- Registros de aulas.

Caso encontre inconsistências nos dados, registre-as separadamente e não altere os valores para coincidir com o modelo Canva.

## 8. Testes e validação visual

Gerar relatórios de teste para os seguintes cenários:

1. Aluno com uma aula.
2. Aluno com sete aulas.
3. Aluno com vinte ou mais aulas.
4. Aula com título muito longo.
5. Relatório com desconto.
6. Relatório sem desconto.
7. Dados com acentos e caracteres especiais.

Renderizar os PDFs e inspecionar visualmente todas as páginas.

Verificar:

- Cabeçalho.
- Mascote.
- Legibilidade dos cartões.
- Quebras de página.
- Resumo financeiro.
- Rodapé.
- Ausência de sobreposições.
- Consistência dos valores com os dados de origem.

Se possível, gerar imagens PNG das páginas para facilitar a revisão.

## 9. Entregáveis

Ao finalizar, apresentar:

1. Resumo da implementação.
2. Arquivos alterados.
3. Componentes ou funções criados.
4. Bibliotecas utilizadas.
5. PDF de exemplo gerado pela nova implementação.
6. Captura ou renderização visual do resultado.
7. Testes executados.
8. Eventuais limitações.

## 10. Critério de sucesso

O relatório final deverá parecer um documento oficial da Bitaria, e não um PDF genérico.

Quero que o aluno ou responsável receba um documento visualmente agradável, com a personalidade da plataforma, semelhante ao modelo Canva, mas com acabamento superior, melhor legibilidade e geração totalmente automática.

**Implemente a melhoria no gerador existente e valide visualmente o PDF antes de considerar a tarefa concluída.**

Não alterar banco de dados ou regras financeiras para realizar esta melhoria.