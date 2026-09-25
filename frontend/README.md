# SportBuddy

SportBuddy é uma aplicação que ajuda pessoas a encontrar companheiros para praticar desporto e a organizar atividades desportivas na sua zona — desde um jogo informal de futebol entre amigos a uma aula de padel organizada por um ginásio parceiro.

A app resolve um problema comum: querer praticar desporto mas não ter com quem, ou não saber que atividades existem perto de nós. O utilizador descobre atividades no mapa ou numa lista filtrável, junta-se a elas (ou entra numa lista de espera, se o organizador exigir aprovação), conversa com os outros participantes, e no final pode avaliar a atividade e votar no MVP. Quem organiza regularmente atividades pode ainda registar-se como conta de **parceiro/organização**, com um painel próprio para gerir pedidos de inscrição.

## Funcionalidades principais

- **Autenticação** — email/password, login com Google, e registo de contas normais ou de organização (nome, NIF, responsável).
- **Atividades** — criar, editar, ver detalhes, participar, sair, lista de espera com aprovação do organizador, cancelar/concluir.
- **Descoberta** — pesquisa por proximidade (mapa e lista), filtros por desporto, categoria, data, distância e organizadores verificados.
- **Mapa** — atividades perto de ti representadas com marcadores por desporto, com detalhe e ação de participar diretamente no mapa.
- **Rede social** — pedidos de amizade, seguir/deixar de seguir, perfis públicos, feed de atividade dos amigos (quem se juntou, criou ou foi MVP).
- **Chat** — conversa de grupo por atividade e conversas diretas entre utilizadores.
- **Gamificação** — badges por participação/MVP/desporto praticado, com barra de progresso até ao próximo nível.
- **Avaliações e MVP** — depois de uma atividade terminar, os participantes avaliam-na (1-5) e votam no MVP.
- **Notificações** — pedidos de amizade, novidades em atividades, badges conquistados, etc.
- **Painel de administração** — gestão de utilizadores (mudar cargo, suspender, banir).
- **Painel de parceiro/organização** — gerir pedidos pendentes de inscrição nas atividades que organiza.
- **Multi-idioma** — interface em Português e Inglês.
- **Multi-plataforma** — a mesma base de código corre em Android (app nativa) e Web (browser desktop e mobile).

## Arquitetura

Este é um monorepo com duas partes independentes:

```
SportBuddyApp/
├── frontend/   # App Expo (React Native + Web), TypeScript
└── backend/    # API REST em Node.js/Express, TypeScript
```

### Frontend (`frontend/`)

- **Expo Router** (React Native) — navegação por ficheiros, com ecrãs partilhados entre Android e Web e algumas variantes específicas de plataforma (sufixo `.web.tsx`) onde a experiência precisa de ser diferente — por exemplo, o mapa usa `react-native-maps` no telemóvel e a API do Google Maps para JavaScript na web, e a navegação principal muda de barra de separadores (mobile) para barra lateral (desktop).
- **Firebase Auth** — autenticação de utilizadores (email/password e Google).
- **Firestore** (via a API backend) — base de dados de utilizadores, atividades, mensagens, etc.
- Publicado como:
  - **Site web estático** (Firebase Hosting) — `https://projeto-adc-teste.web.app`
  - **APK Android** (via EAS Build) — distribuído diretamente aos utilizadores de teste (não está na Play Store)

### Backend (`backend/`)

- **Express + TypeScript**, com rotas para atividades, utilizadores, desportos, amizades, conversas, notificações e badges.
- **Firebase Admin SDK** para aceder ao Firestore com privilégios de servidor (validação, moderação, agregações que o cliente não deve fazer diretamente).
- Protegido com `helmet` (cabeçalhos de segurança) e `express-rate-limit` (limite de pedidos por utilizador).
- Publicado no **Google App Engine** (`https://projeto-adc-teste.oa.r.appspot.com`).

## Como correr o projeto localmente

### Pré-requisitos

- Node.js e npm
- Uma conta Firebase com Firestore e Authentication ativados (as chaves de configuração ficam em `frontend/.env`, não incluído no repositório por segurança)
- Uma chave de API do Google Maps (para o mapa)

### Backend

```bash
cd backend
npm install
npm run dev      # arranca em modo de desenvolvimento, com recarregamento automático
```

Para produção: `npm run build` (compila TypeScript) seguido de `npm start`.

### Frontend

```bash
cd frontend
npm install
npm run web       # corre no browser (http://localhost:8081 por defeito)
```

Para testar em Android, é necessário gerar uma build com o [EAS Build](https://docs.expo.dev/build/introduction/) (`eas build --platform android`), já que a app usa módulos nativos (mapas, notificações, autenticação Google) que não funcionam no Expo Go.

## Deploy

| Parte | Onde | Comando |
|---|---|---|
| Frontend (web) | Firebase Hosting | `npx expo export -p web && firebase deploy --only hosting` |
| Frontend (Android) | EAS Build | `eas build --platform android --profile preview` |
| Backend | Google App Engine | `npm run build && gcloud app deploy` (a partir de `backend/`) |

## Stack tecnológica

**Frontend:** Expo (React Native + React Native Web), TypeScript, Expo Router, Firebase Auth, `react-native-maps` / Google Maps JavaScript API, `expo-auth-session` (login Google nativo).

**Backend:** Node.js, Express, TypeScript, Firebase Admin SDK (Firestore), Helmet, express-rate-limit.

**Infraestrutura:** Firebase Hosting (frontend web), Google App Engine (backend), Firebase Authentication + Firestore (dados e autenticação), EAS Build (compilação da app Android).
