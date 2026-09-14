# LogTogether — v0.1.7

Private-first bilingual family exercise PWA prototype. v0.1.7 is the final local UX polish pass before cloud/auth work.


## New in 0.1.7

- Accent-aware completed weekly missions.
- Collapsed weekly difficulty chooser with preview-before-confirm behavior.
- Today-only Home activity feed.
- Thinner seven-day calorie bars.
- Rolling 12-month calorie line chart with one-month navigation.
- Editable completed hikes that preserve existing GPX/photo data unless replaced.

## New in 0.1.6

- Detailed weekly missions show live progress such as `Back 1/3`, with completed missions visually marked.
- Difficulty modes are previewed on first tap and only applied on the second tap, so inspecting a preset never consumes the 3-changes/week allowance.
- Monthly and hiking badges are separate sections. Hiking badges clearly state that the current prototype has no verified route/summit database.
- Hiking can import Garmin-compatible GPX files locally. The browser previews the route and fills distance/elevation values without uploading the file. Garmin Connect and Garmin Explore both support GPX export. FIT/TCX support is deferred to avoid another parser dependency.
- Still no React, Tailwind, analytics, ads, chart framework, router, or runtime npm dependency.

## Run

```bash
python3 -m http.server 4173 -d dist
```

Open `http://localhost:4173`. Use the same origin/port to retain existing demo data.

## Tests

```bash
node --test tests/unit/*.test.mjs
```


## Run

```bash
python3 -m http.server 4173 -d dist
```

Open `http://localhost:4173`.

## Main prototype areas

- Home: start workout/hike, saved routines, circuit builder, weekly goals, 7-day estimated-Cal trend.
- Circuit routines: define a sequence such as 7 pull-ups → 25 push-ups → 40 squats → 60 calf raises, then repeat it for 3–4 rounds.
- History: calendar first, all-category exercise mix, date-scoped activity history, collapsible workout → exercise → set details, optional workout photo.
- Water: independent hydration log, 7-day hydration chart with daily goal line, individually removable entries.
- Family: self-only demo member, invite placeholder, profile entry point, local 24-hour story prototype.
- Profile: profile photo, name, height, monthly weight history and badge gallery.
- Settings: language, appearance and future security controls only.

## Goals and badges

Weekly goal points can come from:

- up to 7 daily exercise-calorie targets;
- up to 8 exercise-category set targets;
- up to 7 daily hydration targets.

The monthly prototype badge threshold is 50 goal points. Months that earned a badge receive a gold treatment in the History calendar.

## Private media prototype

Photos are stored only in this browser using IndexedDB. They are resized and re-encoded as WebP, which strips ordinary camera EXIF metadata. The prototype supports a profile photo, one workout photo, and temporary local stories.

Production media is **not enabled yet**. Family-only cloud rules, expiry cleanup and storage-retention behavior must be tested before real family photos are uploaded.

## Data/update safety

- Application code and user data remain separate.
- Active workouts persist after changes.
- Stable exercise IDs are language-independent.
- Schema remains v1; v0.1.6 adds only optional fields.
- Unknown schema versions fail closed rather than being guessed.
- No analytics, ads, React, Tailwind, router, chart framework, or runtime npm dependency.

## Tests

```bash
npm test
```

Firebase authorization tests remain separate until cloud mode is enabled.


## v0.1.6 notes
Saved routines can now be deleted safely. Goal difficulty is preset-based and can be changed at most three times per Monday-Sunday week. Hiking badges are derived locally from the first recorded completion of each unique route name; production route verification is intentionally deferred.


## v0.1.6 additions
Weekly mission progress, preview/confirm difficulty modes, separate badge galleries, GPX route import/trace, and customizable accent colors. GPX is parsed locally in the demo and no map SDK is required.
