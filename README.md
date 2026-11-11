# Overload

A personal workout generator and lifting tracker. It runs as an installable web app on a phone, is hosted free on GitHub Pages, keeps its data in a private GitHub repo, and uses an optional free Gemini API key for AI features. Nothing here costs money or needs a server.

The full spec is in `BRIEF.md` and the approved mockups are in `design/`.

**Status:** Phase 7 of 8 done. With a Gemini key in Settings, Generate asks Gemini to choose the exercises (from your history, the note and the library); the engine still sets every weight and fits the time. Without a key, or if Gemini fails, the rule based generator takes over and says so.

Phase 6: Settings is in (reach it from the gear on Home): GitHub sync to a private repo, export and import, rest and increment defaults, exercise settings, and About. See "One time setup" below.

Phase 5: The generator builds a session from your focus, time and note: it prefers exercises you have logged, adds at most one new one, puts compound lifts first, fits the time budget, and suggests a weight for every lift. Rows can be swapped (with a "not available at my gym" switch), reordered, resized or removed, and it learns from what you log, swap away from and mark unavailable. It works with no AI key; Phase 7 adds the AI path.

Phase 4: Home (this week, muscle balance, recent records), Progress (estimated 1RM, weekly volume, forecast, records) and a workout history list with read only detail all run on your logged data.

Phase 3: The engine suggests a weight for every exercise from what was logged last time (double progression), writes the coaching line under the sets, marks personal records, and computes estimated one rep max, volume and muscle balance.

Phase 2: You can build a workout by hand, log it live (sets, weight, reps, rest timer), leave and resume it, and see a summary. It all saves to the phone's database (IndexedDB), so it works with no signal. Home's week, muscle balance and records, the Progress screen and the generator's plan are still sample data from the mockups until their phases. The weight engine, sync, Settings and AI come later.

## Run locally

```sh
npm install
npm run dev        # dev server with hot reload
npm run build      # typecheck and production build into dist/
npm run preview    # serve the production build (the service worker only runs here)
npm test           # unit tests for the engine (progression rules, estimates, records, balance)
```

Open the dev server on your phone by running `npm run dev -- --host` and visiting the address it prints. Use the browser's device toolbar at 390 × 844 and 360 px wide to check layouts.

`npm run icons` re-renders the PWA icons in `public/` from `scripts/make-icons.mjs`.

## How deploy works

Every push to `main` runs `.github/workflows/deploy.yml`, which builds the app and publishes `dist/` to GitHub Pages at `https://<user>.github.io/<repo>/`. Vite's `base` is `./` and routing is hash based, so no rewrite rules are needed.

One time, in the repo on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The next push (or **Actions → Deploy to GitHub Pages → Run workflow**) publishes the site.

When a new version is deployed, the installed app shows an "Update available" prompt with a Reload button.

## Install on your phone

Open the site in Safari (iPhone) or Chrome (Android), then **Share → Add to Home Screen** (iPhone) or **Install app** (Android). After the first visit it opens with no signal.

## One time setup in the app's Settings

Open Settings from the gear at the top of Home.

**Sync** keeps a durable copy of your data as one JSON file in a private GitHub repo you own, and lets a second device (or a fresh install) pick everything up.

1. On GitHub, create a **private** repo, for example `app-data`. It can be empty.
2. Create a **fine grained personal access token** (GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens): pick that one repo under *Repository access*, and under *Repository permissions* give **Contents: Read and write**. Nothing else. Set an expiry you are happy to renew.
3. In the app's Settings → Sync, enter your GitHub username as the owner, the repo name, the file path (default `gym-app/data.json`), and the token. Tap **Test connection**, then **Sync now**.

After that the app syncs on open and when it comes back to the foreground, and pushes a few seconds after you finish a workout or change something outside a live session. It merges per record (newest wins), so two devices can both log. The status shows in Settings and as a word after the date on Home. If the token expires, Settings says so in plain words.

**AI (optional):** get a free key at Google AI Studio and paste it into Settings → AI, then tap **Test**. The model defaults to `gemini-3.5-flash-lite` (free tier) and can be changed. Only training data is sent: the exercise library, what you have logged and how recently, swaps, sets per muscle and your last three sessions. Never the key or token. Without a key the app is complete and generates workouts by rules.

**Data:** Export downloads the same JSON the repo holds. Import merges a file back in.

Tokens and keys are stored only in this device's `localStorage`. They are never written to the repo, the synced data file, or any log or error message.
