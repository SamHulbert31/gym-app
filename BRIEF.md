# Gym App: build brief

You are building a personal workout generator and lifting tracker for one user (Sam). It runs as an installable web app on his phone, is hosted free on GitHub Pages, stores its data in a private GitHub repo he owns, and uses a free Gemini API key for its AI features. Nothing in this project may cost money or need a server.

Read this whole brief and every file in `design/` before writing code. Work through the phases at the end in order and commit after each one. Only stop to ask Sam a question if you are truly blocked.

## 1. What the app does

- Generates a workout from three inputs: what to train, how long he has, and an optional note.
- Lets him build a workout by hand instead, every session if he wants.
- Logs sets, weight and reps live in the gym, with a rest timer.
- Lets him swap any suggested exercise on the spot, or change equipment.
- Learns from what he logs: which exercises and equipment he actually uses, and what weight to suggest next, down to the set.
- Shows progress: estimated one rep max, volume, personal records, muscle balance, and simple forecasts.

Context about Sam: he trains at a typical commercial gym, has no fixed split, and aims for two to three sessions a week but this varies. Never assume a schedule or nag about missed days. Units are kilograms. Running is out of scope for now.

## 2. Design: match the mockups exactly

The four files in `design/` are the approved mockups. Sam has signed them off and wants the real app to look the same.

- `design/home.html` is the home dashboard
- `design/generate.html` is the workout generator with the generated plan
- `design/session.html` is live logging during a workout
- `design/progress.html` is the progress screen

How to read them: each file is reference markup with inline styles. `{{name}}` holes and `<sc-for>` loops are a template syntax; the sample values they loop over are in the script block at the bottom of each file. Ignore the `support.js` line and the template runtime. Take the layout, spacing, sizes, colours, type and copy style from them. All lifts and numbers in them are placeholder data.

The mockup frames are 390 px wide with a fixed height. In the real app each screen scrolls vertically. The tab bar (Home, Train, Progress) stays fixed at the bottom on the main screens. The generator and live session screens are full screen flows with a back arrow and no tab bar.

### Tokens

Colours:

| Token | Hex | Use |
|---|---|---|
| bg | #0E0F11 | page background |
| card | #17191C | cards, inputs |
| nav | #121316 | tab bar |
| border | #26292E | card borders, bar tracks, dividers |
| border-strong | #3A3E45 | outlined buttons, inputs, unselected chips |
| text | #F2F3F5 | primary text |
| text-2 | #D5D8DC | secondary text |
| muted | #A0A6AE | labels, captions |
| accent | #C8F03C | the one accent: primary buttons, selected states, done sets, chart line |
| on-accent | #0E0F11 | text on accent |
| on-accent-soft | #2F3A0C | caption on accent |
| accent-tint | #1D2014 | active set row, estimate card background |
| accent-tint-border | #3F4A1A | estimate card border |
| warn | #F2A65A | lagging muscle bars, "Finish early" |
| bar-neutral | #5B6470 | non highlighted chart bars |

Type: Space Grotesk (weight 700) for headings, big numbers, timers and primary button labels. Inter (400, 500, 600) for everything else. Self host both with `@fontsource` packages so the app works offline. Do not load fonts from a CDN.

Shape: cards radius 16, primary buttons radius 14 to 16 and 52 px tall, outlined buttons radius 12 and 48 px tall, inputs radius 10 to 12 and 48 px tall, focus chips radius 22 and 44 px tall. Screen side padding 20, gap between sections 14.

Keep it minimal. One accent colour only. No gradients, no shadows, no decorative icons.

### Screens not in the mockups

Design these in the same visual language, reusing the same components:

- Manual workout builder (search and add exercises, set targets, reorder)
- Swap sheet (alternatives for the same muscle group, search all, "not available at my gym" toggle)
- Exercise picker with search and muscle group filter, plus "create custom exercise"
- Workout summary after finishing (duration, volume, sets, records hit)
- History list of past workouts and a read only workout detail, reached from Progress
- Settings (sync, AI key, rest timer default, weight increments, export, import)
- Empty states for a brand new user with no history

## 3. Mobile requirements (must haves)

This app is used one handed in a gym. Treat these as acceptance criteria:

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- Respect safe areas with `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`. The fixed tab bar and any bottom pinned button add the bottom inset to their padding. The top of each screen clears the notch or status bar.
- Use `100dvh`, never `100vh`, for full height layouts.
- Every tappable control is at least 44 by 44 px. Set row inputs and the done button are 48 px.
- All inputs use a font size of 16 px or more so iOS does not zoom on focus. Weight fields use `inputmode="decimal"`, rep fields use `inputmode="numeric"`. Focusing a field selects its contents so one tap replaces the value.
- `touch-action: manipulation` on controls, no reliance on hover, no horizontal scrolling at any width from 360 to 430 px.
- On screens wider than 480 px, centre the app in a 480 px column on a matching background.
- Installable PWA: web manifest (name, short name, `display: standalone`, theme and background colour #0E0F11, icons at 192 and 512 plus a maskable icon), `apple-touch-icon` at 180, `apple-mobile-web-app-capable` and a dark status bar style.
- Service worker that caches the app shell so the app opens with no signal (use `vite-plugin-pwa`). Show an "update available" prompt when a new version is deployed.
- During a live session, request a screen Wake Lock where supported and re request it when the app returns to the foreground.
- A live session survives the phone locking, the app being closed, or a reload. Save every change immediately and offer "Resume workout" on reopen. Timers are computed from stored timestamps, not from running intervals.
- The keyboard must not hide the field being typed in.
- Test in a 390 by 844 viewport and at 360 px wide before calling a phase done.

## 4. Tech stack

- Vite, React, TypeScript. Hash based routing so GitHub Pages needs no rewrite rules.
- Set Vite `base` to `./` so the app works under `https://<user>.github.io/<repo>/`.
- Styling with plain CSS variables and CSS modules (or one stylesheet). No UI kit.
- Charts are hand built with SVG or flex bars to match the mockups. No chart library.
- IndexedDB through Dexie for on device storage.
- Deploy with a GitHub Actions workflow that builds and publishes to GitHub Pages on every push to `main`.
- Keep dependencies few.

## 5. Data model

All records carry `id` (uuid), `createdAt`, `updatedAt` (ISO strings) and an optional `deletedAt` tombstone.

```ts
type Muscle = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core';
type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'other';

interface Exercise {
  id: string;
  name: string;
  primary: Muscle;
  secondary: Muscle[];
  equipment: Equipment;
  isCustom: boolean;
  increment?: number;       // kg step for progression, overrides the default
  unavailable?: boolean;    // Sam marked it as not available at his gym
  createdAt: string; updatedAt: string; deletedAt?: string;
}

interface SetLog { weight?: number; reps?: number; done: boolean; doneAt?: string; }

interface WorkoutExercise {
  exerciseId: string;
  order: number;
  target: { sets: number; repsLow: number; repsHigh: number; weight?: number };
  sets: SetLog[];
  swappedFromExerciseId?: string;
  note?: string;            // the coaching line shown under the sets
}

interface Workout {
  id: string;
  source: 'generated' | 'manual';
  status: 'planned' | 'active' | 'done';
  focus: Muscle[] | ['full'];
  plannedMinutes?: number;
  userNote?: string;
  startedAt?: string; endedAt?: string;
  exercises: WorkoutExercise[];
  createdAt: string; updatedAt: string; deletedAt?: string;
}
```

Ship a seed library of roughly 120 common commercial gym exercises with name, primary and secondary muscles, and equipment. Sam can add custom ones.

Also store a small `meta` record: schema version, settings that should sync (rest default, increments), and last sync time.

## 6. Storage and sync

Data must survive for years, so there are two layers.

1. IndexedDB on the device is what the app reads and writes. The app is fully usable offline, which matters in a gym with poor signal.
2. A private GitHub repo is the durable copy. The app syncs one JSON file to it through the GitHub REST contents API.

Settings Sam enters once: GitHub owner, repo name (default `app-data`), file path (default `gym-app/data.json`), and a fine grained personal access token with Contents read and write on that repo only.

Sync rules:

- On app open and on returning to the foreground: fetch the remote file, merge, then push if the merge changed anything.
- After a workout is finished and after edits outside a live session: push, debounced by about 5 seconds. Do not push on every set during a live session; push when the session ends.
- Merge per record by `id`, newest `updatedAt` wins, tombstones win over older edits.
- Use the file `sha` on every PUT. On a 409 or sha mismatch, refetch, merge and retry.
- Commit message such as `gym-app sync 2026-11-12T18:40`.
- If the file does not exist yet, create it.
- Show sync status in Settings and a subtle indicator elsewhere: synced, syncing, offline, error. Errors must say what is wrong in plain words.
- Base64 encode and decode with full Unicode support.

Also provide manual Export (download the JSON) and Import (load a JSON file) in Settings.

Secrets (GitHub token, Gemini key) live only in `localStorage` on the device. Never write them into the repo, the synced data file, logs, or error messages.

## 7. The engine (plain maths, no AI)

All numbers come from code in the app so they are consistent and work offline. The AI never decides a weight.

Estimated one rep max: Epley, `weight × (1 + reps / 30)`, using sets of 12 reps or fewer. An exercise's estimate for a session is the best set that day.

Weight suggestion for the next session of an exercise (double progression):

- No history: suggest no weight. Sam enters what he lifts and the app learns from it.
- Last session, every set reached the top of the rep range: go up one increment.
- Last session, sets landed inside the range: keep the weight.
- Two sessions in a row with a set under the bottom of the range: drop about 5 to 10 percent, rounded to the increment.
- More than four weeks since the exercise was last done: suggest about 10 percent less than last time.
- Default increments: barbell 2.5 kg, dumbbell 2 kg per hand, machine and cable 5 kg, with a per exercise override in the exercise's settings. Round suggestions to the increment.
- Prefill each set row with the suggested weight and show "Last time 160 kg × 10, 10, 10, 9" as in the mockup.

Write the coaching line under the sets from these rules (for example why the weight went up, and what happens next time), as in `design/session.html`.

Volume: sum of `weight × reps` over done sets. Bodyweight sets count as sets but add no volume.

Muscle balance: done sets per primary muscle over the last 14 days. Flag a muscle as lagging when it has under half the sets of the median muscle.

Personal records per exercise: best estimated one rep max, heaviest weight, and most reps at a given weight. Detect them when a set is marked done and list the latest on Home.

Forecast on Progress: linear fit over the last 12 weeks of estimated one rep max for the chosen exercise. State the weekly rate and the projected date for the next round number milestone. Hide the forecast when there are fewer than four data points or the trend is flat or falling; say that plainly instead.

Time budget: estimate each set at its work time plus rest (default rest 90 seconds, 120 for heavy compound lifts), plus two minutes of setup per exercise. A generated plan must fit the chosen duration.

## 8. Generating a workout

Inputs (`design/generate.html`): focus chips (Legs, Core, Chest, Back, Shoulders, Arms, Full body; multi select), duration (30, 45, 60, 75 minutes), and an optional free text note such as "squat racks are busy tonight". Preselect the lagging muscles from the muscle balance.

With an AI key:

- Send the focus, duration, note, and a compact history summary: exercises Sam has logged with how often and how recently, exercises he swapped away from or marked unavailable, sets per muscle in the last 14 days, and what he trained in his last three sessions.
- Ask for JSON only: an ordered list of exercises chosen by `id` from the app's library (allow a new exercise by name if nothing fits), each with sets and a rep range.
- Validate the response. Then the engine assigns weights and trims or extends the plan to fit the time budget.
- Prefer exercises Sam has logged before, since those are known to exist at his gym. Introduce at most one unfamiliar exercise per session. Never use exercises marked unavailable. Put compound lifts first.

Without an AI key, or if the call fails: use a rule based generator that picks from his most used exercises for the chosen muscles, compound lifts first, and fits the time budget. The result must still be a good session.

After generating: show the plan as in the mockup. Each row has a swap button. Sam can remove, reorder or add exercises, then "Start session". "Generate" again produces a different plan.

Swap: the sheet lists alternatives for the same primary muscle, exercises he has logged first. One tap swaps. A toggle "not available at my gym" marks the original as unavailable so it is not suggested again. The swap is recorded on the workout.

## 9. Screen behaviour

Home (`design/home.html`):
- Date and heading. "Generate a workout" and "Build one manually". If a session is active, show "Resume workout" first.
- This week: seven day strip with trained days filled, session count and total volume. No targets, no streak pressure.
- Muscle balance bars for the last 14 days with the lagging ones in the warn colour and one plain sentence about it.
- Recent records (latest three).

Live session (`design/session.html`):
- Header: back arrow, "Exercise 1 of 5", elapsed time. Segmented progress bar.
- Exercise name, target, last time.
- Set rows: set number, weight, reps, done. Marking a set done starts the rest timer and moves focus to the next row. Reps left empty fill with the target when marked done. Done sets can be edited or unmarked.
- Rest card with countdown, progress bar and Skip. Vibrate briefly at zero where supported.
- "Add a set" and "Swap exercise". Swiping or "Next exercise" moves on; he can also jump to any exercise from a list.
- Coaching line from the engine.
- "Next: ..." preview and "Finish early". The last exercise shows "Finish workout".
- Finishing opens the summary, saves, and syncs.

Progress (`design/progress.html`):
- Exercise selector (defaults to his most logged exercise).
- Tiles: estimated one rep max, change over 12 weeks, best set.
- Estimated one rep max line chart for 12 weeks.
- Weekly volume for all lifts, last eight weeks, current week highlighted.
- Estimate card with the forecast.
- Below the mockup content: a records list for the chosen exercise and a link to full workout history.

## 10. AI

Build a small provider layer: `generate(prompt, jsonSchema?) => Promise<result>`, with a Gemini implementation that calls the Generative Language REST API directly from the browser using the key from Settings. Look up the current Gemini API docs for the endpoint and for a model that is on the free tier; do not assume a model name from memory. Make the model name editable in Settings. Structure the layer so another provider (for example Anthropic) can be added later without touching the features.

Rules:

- Every AI feature is optional. With no key the app is complete.
- Ask for JSON, validate it, and fall back to the rule based path on any failure.
- Handle 429 and quota errors with a friendly message and no retry loops.
- AI is called only when Sam taps Generate (and optionally for a short weekly insight on Progress, cached and refreshed at most once a day). It is never called during a live session.
- Send only training data. Never send the tokens.

## 11. Settings screen

- Sync: owner, repo, path, token, "Test connection", "Sync now", last synced time.
- AI: Gemini key, model name, "Test".
- Training: default rest time, default increments per equipment type.
- Exercises: manage custom exercises and the unavailable list.
- Data: Export JSON, Import JSON.
- About: app version and build date.

## 12. Phases

1. Scaffold: Vite, React, TypeScript, routing, tokens, fonts, tab bar, PWA manifest and service worker, GitHub Actions deploy. Empty screens that already look right on a phone.
2. Data layer, seed exercise library, manual workout builder, live session logging with rest timer, resume and wake lock, summary.
3. Engine: weight suggestions, estimated one rep max, records, volume, muscle balance, with unit tests for the progression rules.
4. Home and Progress with real data, history.
5. Generator: rule based first, then swap sheet and equipment learning.
6. GitHub sync, export and import, Settings.
7. AI layer and AI assisted generation.
8. Polish: empty states, safe areas, offline behaviour, a final pass comparing every screen against `design/` at 390 px wide.

Write a short `README.md` covering how to run locally, how deploy works, and the one time setup Sam does in the app's Settings.

## 13. Done means

- Each of the four mocked screens matches its file in `design/` when filled with similar data.
- The app installs to a phone home screen, opens with no signal, and nothing is hidden by the notch, home indicator or keyboard.
- A full workout can be generated, edited, logged and finished one handed, and it survives the phone locking mid session.
- The next time an exercise appears, its suggested weight follows the progression rules from what was logged.
- Data written on the phone appears in the private repo, and a fresh install restores everything after entering the same settings.
- With no AI key, generation still works through the rule based path.
- No secrets in the repo.
