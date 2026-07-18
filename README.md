# Machine Reading Tracker

Expo Router + TypeScript app for store machine meter readings, runs, percentage splits, PDF reports, and history. Built with a **swappable backend** — runs fully local on an in-memory mock now, and switches to Firebase for production by flipping one env flag.

## Stack

- Expo Router (file-based navigation, tabs)
- TypeScript
- In-memory mock backend (local mode) / Firebase (production, stubbed)
- expo-print + expo-sharing (PDF)
- expo-image-picker (machine photos)
- @expo/vector-icons (Ionicons)

## Run locally

```bash
npm install
npm start        # then press w (web), i (iOS), a (Android), or scan QR in Expo Go
```

Works on **web, Expo Go, and iOS/Android simulators**. No Firebase setup needed in local mode.

### Host the web build locally (no watcher / no watchman needed)

If `expo start` crashes with `EMFILE: too many open files` (common on macOS when the
project sits under a large git root and `watchman` isn't installed), use the one-shot
static export instead — it bundles once with no file watcher:

```bash
npm run host:web      # builds to dist/ and serves at http://localhost:8083
# or separately:
npm run build:web     # expo export --platform web  -> dist/
npm run serve:web     # serve dist/ on :8083
```

This has no live reload — re-run `npm run build:web` after code changes. For live
reload, install watchman (`brew install watchman`) and use `npm start`.

## Demo accounts (local mode)

Data is seeded in memory and resets on a full reload.

| Role     | Email          | Password  |
|----------|----------------|-----------|
| Owner    | owner@demo.com | owner123  |
| Employee | john@demo.com  | john123   |
| Employee | sara@demo.com  | sara123   |

Tap any row on the login screen to autofill.

## App structure

```
app/
  (auth)/employee-login.tsx      Login (role-based redirect)
  (employee)/                    Tabs: STORES | HISTORY
    stores.tsx, history.tsx
  (admin)/                       Tabs: STORES | HISTORY | ADMIN
    stores.tsx, history.tsx, admin.tsx
  stores/[storeId].tsx           Store detail / RUN
  runs/[runId].tsx               Run results + submit + PDF
  admin/manage-stores.tsx        Store & machine CRUD
  admin/manage-employees.tsx     Employee accounts
  admin/manage-runs.tsx          All runs (unlock / delete)
src/
  backend/                       Swappable backend (local | firebase)
  components/ui/                 Design-system components
  constants/theme.ts             Dark Gold design tokens
  context/SessionContext.tsx     Auth session
  screens/                       Shared screens (store list, history)
  utils/                         format, asyncStorage, generatePdf
```

## Switching to Firebase (production)

1. `npm install firebase`
2. Copy `.env.example` to `.env`, fill `EXPO_PUBLIC_FIREBASE_*`, set `EXPO_PUBLIC_BACKEND=firebase`
3. Implement the methods in `src/backend/firebaseAdapter.ts` (interface already matches the local adapter)
4. Deploy `firestore.rules` and `firestore.indexes.json` via the Firebase CLI
5. No screen code changes required

The original single-file prototype is preserved as `App.js.bak`.
