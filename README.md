# 🎓 Plataforma de Gestão de Aulas

Aplicação Full Stack desenvolvida para centralizar o gerenciamento de aulas online, alunos, professores, avaliações, agendamentos e acompanhamento acadêmico.

O projeto nasceu de uma necessidade real da minha atuação como professora e mentora de programação e está sendo desenvolvido inicialmente para uso próprio, com possibilidade futura de disponibilização como produto para outros professores.

A aplicação utiliza React + TypeScript no front-end e Supabase/PostgreSQL no back-end, incluindo autenticação, controle de acesso, Edge Functions, migrations e integração com Google Calendar.

> 🚧 Projeto autoral em desenvolvimento ativo.

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

A plataforma já possui diferentes fluxos voltados para professores, alunos e administração, incluindo:

- Autenticação e rotas protegidas
- Gestão e vinculação de alunos
- Dashboard e recursos para professores
- Gerenciamento e visualização de aulas
- Agendamento, confirmação, cancelamento e reagendamento de aulas
- Integração e sincronização com Google Calendar
- Sincronização de disponibilidade para agendamentos
- Avaliações e feedbacks
- Histórico e relatórios dos alunos
- Gerenciamento de perfil
- Recuperação/redefinição de senha
- Área de gerenciamento do sistema
- Recursos de gestão comercial
- Banco de dados PostgreSQL com migrations versionadas
- Edge Functions no Supabase para operações de back-end

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
│   ├── assets/
│   ├── components/
│   ├── lib/
│   ├── pages/
│   ├── App.tsx
│   └── main.tsx
│
├── supabase/
│   ├── functions/
│   └── migrations/
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