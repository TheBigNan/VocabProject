# Nanwang's Vocabulary Website

A website for learning vocabulary from popular books, built with React + TypeScript (client), Express + TypeScript (server), and Firebase (Firestore + Storage).

## Project structure

```
VocabProject/
  client/    React app (Vite) — Home, View Materials, Study Tools, About Me, Login, and an admin-only Stats page
  server/    Express API — talks to Firebase Admin SDK (Firestore for metadata/stats/users, Storage for PDFs/images)
```

There's no public "submit a list" page — real lists are added by you with the `yarn add-list` script (see "Adding a real list" below). The API only exposes read endpoints for lists (`GET /api/lists`, `GET /api/lists/preview`, `GET /api/lists/:id/download`, `GET /api/stats`, `POST /api/stats/visit`).

**The vocabulary library requires logging in.** `GET /api/lists` (the full library) and downloading any list both require a valid Firebase login — logged-out visitors on the View Materials page instead see one sample list (`GET /api/lists/preview`, which stays public) plus a "Log In / Sign Up" prompt. See "Set up Authentication" below.

**View Materials** (`/materials`) shows both PDF vocabulary lists and premade flashcard sets side by side. Flashcard sets are created and managed by admins only (see "Creating premade flashcard sets" below) but studyable by any logged-in member, at `/materials/sets/:id` — word on one side, a definition or picture on the other, with Previous/Next navigation (same viewer as the personal flashcards on Study Tools, just read-only for non-admins).

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
- `FIREBASE_STORAGE_BUCKET` — leave this **blank** for now. Without it, PDFs you add go to `server/uploads/` on local disk and are served from there — viewing, downloading, and stats all work exactly the same. Once you upgrade to Blaze and enable Storage, fill this in and restart the server to switch to Firebase Storage automatically.
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

## 6. Adding, editing, and removing lists

The easiest way: once you're an admin, go to **View Materials** (`/materials`) and use the "+ Add List" button at the top of the Vocabulary Lists section — fill in a name, creator, genre, a **Section**, date, and the PDF. (The "name" is the display title shown on the card — separate from the PDF's own filename. The "Section" is which top-level group the list appears under — "Vocab from Popular Books" or "SAT Vocab" — see "Sections" in Notes below.) It's created as a **draft**, visible only to admins, so you can double-check it before anyone else sees it; hit **Publish** on the card when it's ready (and **Unpublish** any time to pull it back). Each list card also has an **Edit List** link (change the name/creator/genre/section/date, and optionally swap in a new PDF — leave the file field blank to keep the current one) and **Delete List** (removes both the Firestore entry and the PDF file itself). All of this is enforced server-side (`requireAdmin` on every write route in `server/src/routes/lists.ts`), not just hidden in the UI.

There's also a CLI script for bulk or scripted adds, which — unlike the web form — publishes immediately:

```
cd server
yarn add-list <path-to-pdf> --creator "Name" --genre "Genre" [--title "Name"] [--category popular-books|sat-vocab] [--date YYYY-MM-DD]
```

Example:
```
yarn add-list ~/Downloads/wonder-vocab.pdf --creator "Mr. Alvarez" --genre "Realistic Fiction" --title "Wonder Vocabulary List"
```

- `--title` is optional — if omitted, it's derived from the PDF's filename (e.g. `wonder-vocab.pdf` → "wonder vocab").
- `--category` is optional and defaults to `popular-books`; the only other valid value is `sat-vocab` (see `server/src/categories.ts`).
- `--date` is optional and defaults to today.
- `--genre` can be anything, but stick to one of `Fantasy`, `Adventure / Mystery`, `Science Fiction`, `Realistic Fiction`, `Historical Fiction`, `Nonfiction`, `Other` (see `client/src/genres.ts`) so it groups with the existing sections on the View Materials page instead of getting its own.

## 7. Granting admin access

Every account is a **member** by default. Members can use the site normally but can't see the Stats page. To make someone an **admin**:

1. Have them log in or sign up at least once (this creates their `users/{uid}` document in Firestore automatically, with `role: "member"`).
2. In the [Firebase console](https://console.firebase.google.com/) → Firestore Database → `users` collection, find their document (you can match it by the `email` field) and change `role` from `"member"` to `"admin"`.
3. Have them reload the site. The "Stats" link appears in the nav once their role is picked up, and `/stats` shows live visit/download counts.

There's no in-app way to grant admin — it's deliberately database-only, so nobody can self-promote.

## 8. Creating premade flashcard sets

Once you're an admin, go to **View Materials** (`/materials`) and scroll to the "Flashcard Sets" section — you'll see a "+ New Flashcard Set" button that members don't get. Give it a title, genre, and **Section** ("Vocab from Popular Books" or "SAT Vocab" — see "Sections" in Notes below); it's created as a **draft**, invisible to everyone but admins (so you can build it out without members seeing a blank or half-finished set). Click "Preview Set" to open its page and start adding cards — word + definition, word + picture, or picture + picture.

When it's ready, hit **Publish** (next to the set on View Materials, or at the top of the set's own page) to make it visible to every member. You can **Unpublish** it again any time — e.g. to fix something — and it instantly disappears from members' view again without losing any of its cards. Only admins can add, edit, or delete cards, or delete the set entirely.

## Notes / things you can adjust later

- **Genres**: the View Materials page uses a fixed genre list defined in `client/src/genres.ts` (`GENRES` constant) to order sections, for both lists and flashcard sets. Edit that array to add/remove genres.
- **Sections**: separate from genre, every list and flashcard set also has a `category` field — either `popular-books` ("Vocab from Popular Books") or `sat-vocab` ("SAT Vocab") — defined in `client/src/categories.ts` and `server/src/categories.ts` (`CATEGORIES` constant, kept in sync by hand since the client and server are separate TypeScript projects). View Materials has two big toggle buttons near the top, one per section, that filter both the Vocabulary Lists and Flashcard Sets areas at once — clicking a button shows only that section's lists (still grouped by genre underneath) and sets (flat grid), hiding the other section entirely until you switch back. The server rejects any value outside the two on create/edit (`POST`/`PUT` in `routes/lists.ts` and `POST` in `routes/flashcardSets.ts`). To add a third section, add an entry to both `CATEGORIES` constants and the server will start accepting it.
- **Lists**: every `lists` Firestore document has a `published` field, same pattern as flashcard sets — new lists (via the web form) start as drafts, visible only to admins, until published; the CLI script (`yarn add-list`) publishes immediately. Reads, edits, and the publish toggle are all admin-gated server-side (`server/src/routes/lists.ts`) the same way flashcard sets are, including the download route itself (a draft list's PDF can't be fetched by a non-admin even with a direct link).
- **Flashcard sets**: stored as two Firestore collections — `flashcardSets` (one doc per set: title, genre, cardCount, published) and `flashcardSetCards` (one doc per card, with a `setId` field pointing back to its set). See `server/src/routes/flashcardSets.ts`. Reads are open to any logged-in user for published sets; unpublished (draft) sets are only readable by admins, enforced server-side on both the set list and the cards list — not just hidden in the UI. Writes (create/edit/delete set or card, publish/unpublish) require `requireAdmin`, same as the Stats page.
- **Card types**: every flashcard (personal or in a set) is `"definition"` (word front, definition back), `"picture"` (word front, picture back), or `"picture-picture"` (picture front, picture back — no word). Shared validation and image-upload/cleanup logic lives in `server/src/cardFields.ts`, used by both `server/src/routes/flashcards.ts` (personal) and `flashcardSets.ts` (premade). On the client, the same form and flip-card components (`client/src/components/FlashcardForm.tsx`, `FlashcardTile.tsx`) back both Study Tools and the flashcard-set admin/viewer page.
- **Statistics**: "site visits" increment once per browser session (tracked via `sessionStorage`) when the app loads. "Downloads" increment each time someone downloads a list PDF, via the `/api/lists/:id/download` endpoint, which redirects to the actual file (local disk or Firebase Storage, whichever is active). Tracking always runs regardless of who's visiting; only *viewing* the numbers (the Stats page, `GET /api/stats`) is restricted to admins.
- **Roles**: every signup gets a `users/{uid}` Firestore document with `role: "member"`, created automatically on first login by `GET /api/users/me` (see `server/src/routes/users.ts`). The server checks this field — never anything sent by the client — before allowing `GET /api/stats`, via the `requireAdmin` middleware in `server/src/middleware/auth.ts`. See "Granting admin access" above to promote someone.
- **PDF storage**: handled by `server/src/storage.ts`. It automatically uses Firebase Storage if `FIREBASE_STORAGE_BUCKET` is set, otherwise falls back to local disk (`server/uploads/`, gitignored). The server logs which one is active on startup. Note that local storage doesn't survive a redeploy to most hosting platforms — it's meant for local development until you're on Blaze.
- **Firestore security rules**: for a fast start, everything currently goes through the Express server using the Admin SDK, which bypasses Firestore/Storage security rules. If you later want the client to talk to Firebase directly, you'll need to write proper security rules.
- **Auth model**: the client gets a Firebase ID token after login (`user.getIdToken()`) and sends it to the server as `Authorization: Bearer <token>` (for `GET /api/lists`) or as a `?token=` query param (for downloads, since those are plain browser navigations, not `fetch` calls — see `server/src/middleware/auth.ts` and the download route in `server/src/routes/lists.ts`). The server verifies it with the Admin SDK (`admin.auth().verifyIdToken`) on every protected request; nothing is cached or trusted client-side.
- **Preview list**: exactly one Firestore `lists` document has `isPreview: true` at a time (set by `yarn seed:preview`). It's the only list that `GET /api/lists/preview` and unauthenticated downloads will serve.
- **About Me page**: content can be extended later — see `client/src/pages/About.tsx`.
