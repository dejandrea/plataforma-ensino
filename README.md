# 🎓 Plataforma de Gestão de Aulas

Plataforma web desenvolvida para centralizar e facilitar o gerenciamento de aulas online, alunos, professores e atividades acadêmicas.

O projeto nasceu de uma necessidade real da minha atuação como professora e mentora de programação: reunir em uma única aplicação as ferramentas necessárias para organizar e acompanhar o processo de ensino.

A aplicação está em desenvolvimento e, além de atender ao meu próprio fluxo de trabalho, possui potencial para futuramente ser disponibilizada como solução para outros professores e profissionais que trabalham com aulas particulares e mentorias.

> 🚧 Projeto autoral em desenvolvimento.

---

## 🎯 Objetivo do projeto

Criar uma plataforma que permita organizar o processo de ensino de forma centralizada, reduzindo a necessidade de utilizar diversas ferramentas separadas para acompanhar alunos, aulas e informações acadêmicas.

Além do objetivo de uso real, o projeto também funciona como aplicação prática de conceitos de desenvolvimento Full Stack, arquitetura de aplicações React, autenticação, autorização, banco de dados e organização de projetos de software.

---

## 🚀 Tecnologias

### Front-end

- React
- TypeScript
- React Router
- Tailwind CSS
- Vite

### Back-end / Banco de dados

- Supabase
- PostgreSQL

### Desenvolvimento

- Git
- GitHub
- ESLint
- npm

---

## 🏗️ Arquitetura

A aplicação utiliza uma arquitetura baseada em componentes React e TypeScript.

O Supabase é utilizado como plataforma de back-end, permitindo integrar a aplicação ao banco de dados PostgreSQL e aos serviços necessários para o funcionamento da plataforma.

O React Router é utilizado para gerenciamento das rotas da aplicação.

---

## ✨ Funcionalidades

A plataforma está sendo desenvolvida de forma incremental.

Entre os recursos previstos para o sistema estão:

- 👩‍🏫 Gestão de professores
- 👨‍🎓 Gestão de alunos
- 🔐 Autenticação de usuários
- 👥 Diferentes níveis de acesso
- 📚 Organização das informações acadêmicas
- 📅 Gerenciamento de aulas e agendamentos
- 📊 Acompanhamento dos alunos
- 📝 Avaliações
- 🏆 Certificados
- 🔗 Integração com ferramentas utilizadas nas aulas

> Algumas funcionalidades ainda estão em desenvolvimento e podem sofrer alterações durante a evolução do projeto.

---

## 👥 Perfis de usuário

A arquitetura da plataforma está sendo pensada para trabalhar com diferentes tipos de usuários.

### Administrador

Responsável pelo gerenciamento geral da plataforma.

### Professor

Responsável pelo gerenciamento de seus alunos, aulas e informações acadêmicas.

### Aluno

Acesso às informações e recursos disponibilizados pelo professor.

---

## 📂 Estrutura do projeto

```text
plataforma-ensino/
│
├── public/
│
├── src/
│   ├── components/
│   ├── pages/
│   └── ...
│
├── supabase/
│
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md

```
---

## ⚙️ Executando o projeto

### 1. Clone o repositório

```bash
git clone <URL-DO-REPOSITORIO>
```

### 2. Entre na pasta
```bash
cd plataforma-ensino
```

### 3. Instale as dependências
```bash
npm install
```

### 4. Configure as variáveis de ambiente

Crie o arquivo .env seguindo as configurações necessárias para conexão com o Supabase.

As credenciais e chaves privadas não devem ser versionadas no repositório.

### 5. Execute o projeto
```bash
npm run dev
```
---

## 🧪 Scripts disponíveis
```bash
npm run dev
```
Executa o projeto em ambiente de desenvolvimento.

```bash
npm run build
```
Gera a versão de produção da aplicação.

```bash
npm run lint
```
Executa a análise do código utilizando ESLint.

```bash
npm run preview
```
Executa localmente a versão gerada para produção.

---

## 🗺️ Roadmap

O desenvolvimento é contínuo e novas funcionalidades serão adicionadas conforme a utilização da plataforma.

Entre as evoluções planejadas estão:

- Evolução da gestão de alunos
- Evolução da gestão de professores
- Sistema de avaliações
- Emissão de certificados
- Melhorias no gerenciamento de aulas
- Dashboard com informações relevantes
- Melhorias de experiência do usuário
- Novas integrações
- Preparação da aplicação para utilização por outros professores

---

## 💡 Motivação

Este projeto surgiu de uma necessidade real.

Como professora e mentora de programação, percebi que diversas informações importantes para o acompanhamento dos alunos acabam distribuídas entre diferentes ferramentas.

A proposta da plataforma é transformar essa experiência em uma solução centralizada, inicialmente para uso próprio e, futuramente, com possibilidade de utilização por outros profissionais da educação.

O desenvolvimento também representa a aplicação prática dos conhecimentos que venho aprofundando em desenvolvimento de software, principalmente utilizando React, TypeScript, Supabase e PostgreSQL.

---

## 👩‍💻 Desenvolvedora

Andrea França

Desenvolvedora de Software | React | JavaScript | TypeScript | Python

GitHub: @dejandrea

---

## 📌 Status

#### 🚧 Em desenvolvimento

O projeto está sendo desenvolvido e utilizado como parte de um processo contínuo de evolução e validação da solução.

Funcionalidades, arquitetura e interface podem sofrer alterações conforme novas necessidades forem identificadas.