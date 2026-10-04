# Nanwang's Vocabulary Website

A website for learning vocabulary from popular books, built with React + TypeScript (client), Express + TypeScript (server), and Firebase (Firestore + Storage).

## Project structure

```
VocabProject/
  client/    React app (Vite) — the 4 pages: Home, About Me, View Lists, Statistics
  server/    Express API — talks to Firebase Admin SDK (Firestore for metadata/stats, Storage for PDFs)
```

There's no public "submit a list" page — lists are added directly by you, either with the seed script (`yarn seed` in `server/`, see `server/src/seed.ts`) or by writing to Firestore/Storage directly. The API only exposes read endpoints (`GET /api/lists`, `GET /api/lists/preview`, `GET /api/lists/:id/download`, `GET /api/stats`, `POST /api/stats/visit`).

**The vocabulary library requires logging in.** `GET /api/lists` (the full library) and downloading any list both require a valid Firebase login — logged-out visitors on the View Lists page instead see one sample list (`GET /api/lists/preview`, which stays public) plus a "Log In / Sign Up" prompt. See "Set up Authentication" below.

## 1. Set up Firebase

You need a Firebase project (free "Spark" plan is fine to start — Storage requires the paid "Blaze" plan, but that's optional, see below).

1. Go to the [Firebase console](https://console.firebase.google.com/) and create a project.
2. Enable **Firestore Database** (production mode is fine). This is free on the Spark plan and is all you need to run the site.
3. Go to Project Settings → Service Accounts → "Generate new private key". This downloads a JSON file — keep it secret, do not commit it.
4. **Storage is optional for now.** If you haven't upgraded to the Blaze plan yet, skip it — PDFs will be saved to disk on the server instead (see below). Once you do upgrade, enable Storage and note your **Storage bucket** name from Project Settings → General (looks like `your-project.appspot.com` or `your-project.firebasestorage.app`).

## 2. Configure the server

```
cd server
cp .env.example .env
```

Edit `server/.env`:
- `FIREBASE_SERVICE_ACCOUNT` — paste the **entire contents** of the service account JSON file as a single line.
- `FIREBASE_STORAGE_BUCKET` — leave this **blank** for now. Without it, PDFs saved via the seed script go to `server/uploads/` on local disk and are served from there — viewing, downloading, and stats all work exactly the same. Once you upgrade to Blaze and enable Storage, fill this in and restart the server to switch to Firebase Storage automatically.
- `PORT` — defaults to 5050.

Install and run:
```
cd server
yarn install
yarn dev
```

## 3. Set up Authentication

The login/signup forms talk to Firebase Authentication directly from the browser (the Express server never sees passwords — it only verifies the ID token the client hands it).

1. In the [Firebase console](https://console.firebase.google.com/), go to **Authentication** → Sign-in method → enable **Email/Password**.
2. Go to Project Settings → General → "Your apps" → add a **Web app** (the `</>` icon) if you don't have one yet. Give it any nickname; you don't need Firebase Hosting.
3. Copy the `firebaseConfig` values it shows you (`apiKey`, `authDomain`, `projectId`, `appId`).

## 4. Configure and run the client

```
cd client
cp .env.example .env
```

Edit `client/.env` and fill in `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID` with the values from step 3 above. `VITE_API_URL` already defaults to `http://localhost:5050`.

```
yarn install
yarn dev
```

Open the printed local URL (usually `http://localhost:5173`).

## 5. Create the public preview list

Logged-out visitors see one sample list so they know what the library looks like. Create it once:

```
cd server
yarn seed:preview
```

This is safe to re-run any time (e.g. to replace the sample content) — it replaces whichever list was previously flagged as the preview.

## Notes / things you can adjust later

- **Genres**: the view-lists page uses a fixed genre list defined in `client/src/genres.ts` (`GENRES` constant) to order sections. Edit that array to add/remove genres.
- **Statistics**: "site visits" increment once per browser session (tracked via `sessionStorage`) when the app loads. "Downloads" increment each time someone downloads a list PDF, via the `/api/lists/:id/download` endpoint, which redirects to the actual file (local disk or Firebase Storage, whichever is active).
- **PDF storage**: handled by `server/src/storage.ts`. It automatically uses Firebase Storage if `FIREBASE_STORAGE_BUCKET` is set, otherwise falls back to local disk (`server/uploads/`, gitignored). The server logs which one is active on startup. Note that local storage doesn't survive a redeploy to most hosting platforms — it's meant for local development until you're on Blaze.
- **Firestore security rules**: for a fast start, everything currently goes through the Express server using the Admin SDK, which bypasses Firestore/Storage security rules. If you later want the client to talk to Firebase directly, you'll need to write proper security rules.
- **Auth model**: the client gets a Firebase ID token after login (`user.getIdToken()`) and sends it to the server as `Authorization: Bearer <token>` (for `GET /api/lists`) or as a `?token=` query param (for downloads, since those are plain browser navigations, not `fetch` calls — see `server/src/middleware/auth.ts` and the download route in `server/src/routes/lists.ts`). The server verifies it with the Admin SDK (`admin.auth().verifyIdToken`) on every protected request; nothing is cached or trusted client-side.
- **Preview list**: exactly one Firestore `lists` document has `isPreview: true` at a time (set by `yarn seed:preview`). It's the only list that `GET /api/lists/preview` and unauthenticated downloads will serve.
- **About Me page**: content can be extended later — see `client/src/pages/About.tsx`.
