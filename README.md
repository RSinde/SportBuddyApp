# SportBuddy

SportBuddy is an app that helps people find sports partners and organize sports activities in their area — from a casual game of football between friends to a padel class organized by a partner gym.

It solves a common problem: wanting to play sports but having no one to play with, or not knowing what activities are happening nearby. Users discover activities on a map or in a filterable list, join them (or enter a waitlist if the organizer requires approval), chat with the other participants, and afterwards rate the activity and vote for its MVP. People who regularly organize activities can register a **partner/organization account**, with its own dashboard to manage sign-up requests.

## Key features

- **Authentication** — email/password, Google sign-in, and registration for regular accounts or organization accounts (org name, tax ID, responsible person).
- **Activities** — create, edit, view details, join, leave, waitlist with organizer approval, cancel/complete.
- **Discovery** — proximity search (map and list), filters by sport, category, date, distance, and verified organizers.
- **Map** — nearby activities shown as markers by sport, with details and a join action directly from the map.
- **Social** — friend requests, follow/unfollow, public profiles, friends' activity feed (who joined, created, or was MVP).
- **Chat** — group chat per activity and direct messages between users.
- **Gamification** — badges for participation/MVP/sport played, with a progress bar toward the next tier.
- **Ratings and MVP** — once an activity ends, participants rate it (1-5) and vote for the MVP.
- **Notifications** — friend requests, activity updates, badges earned, etc.
- **Admin panel** — user management (change role, suspend, ban).
- **Partner/organization dashboard** — manage pending sign-up requests for the activities they organize.
- **Multi-language** — interface available in Portuguese and English.
- **Cross-platform** — the same codebase runs on Android (native app) and Web (desktop and mobile browser).

## Architecture

This is a monorepo with two independent parts:

```
SportBuddyApp/
├── frontend/   # Expo app (React Native + Web), TypeScript
└── backend/    # REST API in Node.js/Express, TypeScript
```

### Frontend (`frontend/`)

- **Expo Router** (React Native) — file-based navigation, with screens shared between Android and Web and a few platform-specific variants (`.web.tsx` suffix) where the experience needs to differ — for example, the map uses `react-native-maps` on mobile and the Google Maps JavaScript API on web, and the main navigation switches from a bottom tab bar (mobile) to a sidebar (desktop).
- **Firebase Auth** — user authentication (email/password and Google).
- **Firestore** (via the backend API) — database for users, activities, messages, etc.
- Published as:
  - **Static web app** (Firebase Hosting) — `https://projeto-adc-teste.web.app`
  - **Android APK** (via EAS Build) — distributed directly to test users (not on the Play Store)

### Backend (`backend/`)

- **Express + TypeScript**, with routes for activities, users, sports, friends, conversations, notifications, and badges.
- **Firebase Admin SDK** to access Firestore with server-side privileges (validation, moderation, aggregations the client shouldn't perform directly).
- Protected with `helmet` (security headers) and `express-rate-limit` (per-user request limiting).
- Deployed on **Google App Engine** (`https://projeto-adc-teste.oa.r.appspot.com`).

## Running the project locally

### Prerequisites

- Node.js and npm
- A Firebase project with Firestore and Authentication enabled (config keys live in `frontend/.env`, not included in the repository for security reasons)
- A Google Maps API key (for the map)

### Backend

```bash
cd backend
npm install
npm run dev      # starts in development mode, with auto-reload
```

For production: `npm run build` (compiles TypeScript) followed by `npm start`.

### Frontend

```bash
cd frontend
npm install
npm run web       # runs in the browser (http://localhost:8081 by default)
```

To test on Android, a build must be generated with [EAS Build](https://docs.expo.dev/build/introduction/) (`eas build --platform android`), since the app uses native modules (maps, notifications, Google sign-in) that don't work in Expo Go.

## Deployment

| Part | Where | Command |
|---|---|---|
| Frontend (web) | Firebase Hosting | `npx expo export -p web && firebase deploy --only hosting` |
| Frontend (Android) | EAS Build | `eas build --platform android --profile preview` |
| Backend | Google App Engine | `npm run build && gcloud app deploy` (from `backend/`) |

## Tech stack

**Frontend:** Expo (React Native + React Native Web), TypeScript, Expo Router, Firebase Auth, `react-native-maps` / Google Maps JavaScript API, `@react-native-google-signin/google-signin` (native Google login on Android).

**Backend:** Node.js, Express, TypeScript, Firebase Admin SDK (Firestore), Helmet, express-rate-limit.

**Infrastructure:** Firebase Hosting (web frontend), Google App Engine (backend), Firebase Authentication + Firestore (data and auth), EAS Build (Android app builds).
