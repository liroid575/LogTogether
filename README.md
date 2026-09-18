# LogTogether

**A privacy-conscious bilingual family fitness PWA.**

LogTogether began as a small exercise tracker for my family. As we started using it, new needs kept appearing: different ways of recording exercise, clearer progress, family sharing without exposing everything, offline reliability, and lightweight encouragement.

The project gradually grew into a bilingual family fitness PWA with structured workout logging, hydration and activity tracking, family progress, optional Firebase synchronization, offline storage, and lightweight social features such as Pokes.

## Status

LogTogether is currently a **family-testing alpha**.

The current application version is **v0.13.0**. It is actively used for family-oriented testing, but it is not yet presented as a public production service.

The project favors:

- clear privacy boundaries;
- reliable behavior;
- offline resilience;
- stable data compatibility;
- small dependency footprint;
- server-enforced authorization for Cloud data;
- regression tests for behavior that should not accidentally change.

## Features

### Exercise and workout tracking

- Strength workouts with sets, reps, weight, timing, rest periods, and notes.
- Circuit routines with configurable rounds.
- Saved routines with detailed editing and multi-select deletion.
- Retrospective **Log completed activity** flow, clearly separated from starting a workout.
- Activity-aware recording for strength, machines, cardio, mobility, boxing, carries, intervals, and other exercise types.
- Per-set Start, Finish, Skip, removal, duration, and work/rest timing.
- Workout history with editable completed records.

### Exercise science and progress

- Exercise-specific logging profiles.
- Primary and secondary training-credit model.
- Separate cardio and mobility credit instead of treating every activity as strength training.
- Weekly ten-mission model.
- Gold Days.
- Difficulty presets.
- Health-guideline progress.
- Monthly badge progress based on roughly 80% of the available weekly missions for the month.
- Four-week Momentum rather than a punitive daily streak.
- Calorie estimates used as informational progress rather than the sole measure of exercise quality.

### Hydration and supplements

- Daily water logging with compact presets and a custom amount.
- Seven-day hydration trends.
- Configurable water goals.
- Historical hydration editing.
- Supplement logging.
- Custom supplements and brands.
- Weekly supplement review with a Monday-to-Sunday recorded-day view and exact entry details.
- Exact supplement documents remain owner-only. When weekly supplement sharing is enabled, family members receive bounded date, local-time and amount details without internal entry IDs or full ISO timestamps.

### Hiking

- Hiking activity history.
- Local GPX parsing.
- Distance and elevation summaries.
- Hiking badges.
- Precise GPX route data remains local to the device.

### Family features

- Google-authenticated Cloud accounts.
- Family membership.
- Editable family groups.
- Group-scoped visibility.
- Family progress and weekly achievements.
- Family profile comparisons.
- Monthly and hiking badges.
- Access revocation.
- Owner administration.
- Bounded family-facing aggregates rather than exposing raw private records.

### Pokes and notifications

- Short emoji Pokes for lightweight encouragement.
- Web Push notifications.
- In-app social-event fallback when push is unavailable.
- Per-person and per-group muting.
- Flood protection.
- Poke balance limits for normal users.
- Foreground Poke animations and family activity celebrations.
- Large-family burst aggregation so many events do not overwhelm the UI.

### Offline and local data

- IndexedDB-backed structured state.
- Account-separated local storage.
- Synchronous write journal before IndexedDB persistence.
- Offline startup support.
- Service-worker caching.
- Pending synchronization after reconnect.
- JSON backup and import.
- Migration rollback protection.
- Unknown schema versions fail closed rather than being guessed.

### Privacy-aware media

Profile and workout media currently remain local to the browser.

Workout photos are resized and re-encoded before storage, which removes ordinary camera EXIF metadata.

Precise hiking routes and local media are intentionally kept separate from family-visible Cloud records until a properly reviewed private Cloud-media model is implemented.

## Local and Cloud modes

LogTogether supports two main usage modes.

### Local mode

Local mode does **not** require Firebase authentication or a Firebase project.

Application data is stored in the browser and separated by local account scope. This is enough to explore the application, record local activity, test the interface, and work on most client-side features.

### Cloud mode

Cloud mode adds:

- Google authentication;
- cross-device synchronization;
- family membership;
- family groups;
- family-visible progress;
- Cloud-backed access control;
- Pokes;
- notifications.

Cloud authorization is enforced by Firestore Security Rules and server-side checks rather than by simply hiding UI controls.

A developer cloning LogTogether should configure their **own Firebase development environment** before using Cloud features. A clone should not depend on another family's testing backend.

## Privacy model

LogTogether deliberately separates records according to who should be able to access them.

Personal body metrics, owner-only supplement documents, hydration details, account settings, local media, and other sensitive records are not treated as ordinary family-visible data.

Family features instead use explicitly shared records or bounded aggregate documents where appropriate.

Examples include:

- workout sharing that respects visibility and family membership;
- family progress summaries without raw private workout data;
- hydration totals without exposing individual drink timestamps;
- bounded weekly supplement totals plus shared date/local-time/amount details, without exposing owner-only entry documents;
- hiking metadata without automatically uploading precise GPX routes.

Firebase browser configuration is client-visible by design and is **not** an authorization mechanism.

Administrative credentials, Firebase service-account keys, private VAPID material, private API credentials, and other server secrets must never be committed to the repository.

See [SECURITY.md](SECURITY.md) for the current security model.

## Architecture

| Area | Implementation |
| --- | --- |
| Client | TypeScript, HTML, CSS, browser APIs |
| Local persistence | IndexedDB, write journal, JSON backup/import |
| Offline support | Service Worker / PWA caching |
| Authentication | Firebase Authentication |
| Cloud data | Cloud Firestore |
| Server-side features | Firebase Cloud Functions |
| Notifications | Web Push with in-app fallback |
| Hosting | Firebase Hosting |
| Unit/regression tests | Node.js built-in test runner |
| Authorization tests | Firebase Firestore Emulator |
| Build output | Static `dist/` directory |

The browser application intentionally avoids a large frontend framework.

There is no React, Tailwind, client-side router, analytics SDK, advertising SDK, or chart framework.

npm packages in this repository are used for development, compilation, testing, Firebase tooling, and emulation. The generated application itself is deployed as static browser assets plus Firebase backend services.

## Running locally

A basic local run requires **Node.js 22.x** and npm. `.node-version` declares
the same Node major used by CI and the Firebase Functions runtime. Select it
with your preferred version manager; changing your system-wide Node version
is not required.

Install the locked development dependencies:

```bash
npm ci
```

Build the project:

```bash
npm run build
```

This generates the static application in:

```text
dist/
```

To temporarily serve that build on your own computer:

```bash
npm run serve
```

Then open:

```text
http://localhost:4173
```

Port `4173` has no special production meaning. It is simply the local development port configured by this repository.

This local server is useful for quickly checking a fresh build in a browser. It is separate from Firebase Hosting and does not replace the deployed family-testing app.

**Firebase setup is not required for the basic local build.**

Cloud and family features require a separately configured Firebase development environment.

## Tests

Run the build and unit/regression suite:

```bash
npm test
```

A regression test protects behavior that is supposed to keep working after future changes.

If a later update accidentally changes an existing behavior, the relevant test should fail. If the product intentionally changes, that test should be updated to describe the new intended behavior. Important new behavior should normally receive new tests.

The test suite is therefore expected to evolve with the application rather than permanently freezing old implementation details.

Run the Firestore authorization suite with:

```bash
npm run test:security
```

The authorization tests use the Firebase Firestore Emulator and require **Java 21**.
The test command explicitly selects `demo-logtogether`, matching the test fixtures.
It does not require Firebase login, a real Firebase project, or billing.

If Java 21 is installed alongside another default version, select it for this
command only. For example, on Arch Linux:

```bash
JAVA_HOME=/usr/lib/jvm/java-21-openjdk \
PATH="/usr/lib/jvm/java-21-openjdk/bin:$PATH" npm run test:security
```

Some tests deliberately attempt forbidden operations. `PERMISSION_DENIED` output is therefore expected when those negative tests pass.

The current suites provide useful regression and authorization coverage, but passing them should not be interpreted as a formal independent security audit.

## Continuous integration

Once this repository is hosted on GitHub with Actions enabled,
[the test workflow](.github/workflows/test.yml) runs on pushes to `main`, pull
requests, and manual dispatch. One Linux job installs the locked dependencies,
builds the Local-mode app, runs the unit/regression suite, and runs the Firestore
authorization suite with Node 22 and Java 21.

The workflow needs no Firebase credentials or `config.local.js` and does not
deploy the application. Actions are pinned to full commit IDs, checkout does
not retain credentials, and the workflow has read-only repository permission.
A 15-minute timeout and cancellation of superseded runs limit wasted runner
time. No build artifacts or dependency caches are uploaded by this workflow.

GitHub Actions usage is separate from Firebase billing; check the repository's
Actions allowance and spending controls before enabling it for a private repository.

## Repository structure

```text
LogTogether/
├── src/                  Application TypeScript
├── public/               Static assets, styles and PWA files
├── functions/            Firebase Cloud Functions
├── tests/
│   ├── unit/             Unit and regression tests
│   └── security/         Firestore authorization tests
├── scripts/              Build and maintenance scripts
├── docs/
│   ├── design/           Architecture and product design notes
│   ├── guides/           Setup and operational guides
│   ├── releases/         Version-specific release notes
│   └── archive/          Historical development records
├── firestore.rules       Firestore authorization rules
├── firestore.indexes.json
├── firebase.json
├── CHANGELOG.md
├── SECURITY.md
└── README.md
```

Generated directories such as `dist/` and `node_modules/` are intentionally not committed.

## Selected release history

This section highlights major milestones rather than every individual change.

Detailed release notes are preserved in [`docs/releases/`](docs/releases/) and [`CHANGELOG.md`](CHANGELOG.md).

### v0.4.0 — first workout Cloud synchronization

LogTogether began synchronizing completed strength workouts through Firestore.

This stage introduced:

- per-account Cloud workout synchronization;
- separation between local browser data and Cloud records;
- workout ownership and family identity;
- private versus family-visible workouts;
- UID-separated local state;
- exclusion of local workout photos from Cloud workout documents.

The rest of the application was still substantially local-first at this stage.

### v0.6.1 — active workout flow, hydration and supplements

The workout flow gained clearer **Start → Finish → Done** timing behavior.

Hydration and supplement logging expanded significantly, including:

- water tracking;
- supplement choices;
- amount, unit and date recording;
- local supplement history;
- exercise calorie estimation.

### v0.6.2–v0.6.3 — mobile and tracking polish

These releases refined the tracking interface with:

- mobile date-layout fixes;
- weekly supplement summaries;
- calorie-goal coloring;
- hiking indicators;
- calorie-formula explanations;
- exercise previews;
- separate Monthly and Hiking badge presentation;
- simplified History calendar markers.

### v0.7.1 — editable historical records

History and calendar workflows became more practical.

Changes included:

- calendar reset-to-today behavior;
- clearer selected-date styling;
- weight-history markers;
- collapsed supplement entry;
- editing existing water entries;
- editing supplement records;
- editing workouts;
- editing hikes;
- revised exercise-calorie mission scoring.

### v0.8.x — offline storage and family authorization foundations

The application moved toward stronger account isolation and offline reliability.

The v0.8 generation introduced work around:

- IndexedDB structured storage;
- migration from older localStorage state;
- write journaling;
- account-separated offline data;
- reconnect synchronization;
- JSON backup/import;
- family groups;
- owner administration;
- group isolation;
- safer workout and circuit editing.

By v0.8.3, workout polish also included improved set removal, clearer History duration display, circuit-round history, and week-navigation reset behavior.

### v0.9.0 — activity-aware exercise model

v0.9.0 substantially expanded exercise recording and progress calculations.

Major changes included:

- shared Workout Now lifecycle;
- activity-specific logging;
- machine, mobility, boxing and other non-standard recording modes;
- weighted muscle-display contributions;
- primary/secondary training-credit missions;
- separate cardio and mobility credit;
- effort-aware calculations;
- clearer documentation of exercise calculations.

This became the foundation for the later Science Alpha work.

### v0.10.0 — Science Alpha

v0.10.0 reorganized the exercise-science and motivation model.

It introduced or formalized:

- profile-specific activity defaults;
- backward-compatible history and routines;
- exercise progression memory;
- primary and secondary movement credit;
- balanced weekly missions;
- percentage-based monthly badges instead of a fixed point threshold;
- four-week Momentum;
- health-guideline progress;
- safety exclusions for activities that should not be gamified;
- scoring-version metadata.

Calories became one informational signal rather than the sole definition of successful exercise.

### v0.10.1–v0.10.3 — mission education and progress UX

These releases focused on making the newer science model understandable.

They added and refined:

- Weekly Missions education;
- Training Mix terminology;
- Gold Day presentation;
- family comparisons centered more on activity balance and missions;
- tutorial pages explaining the ten missions;
- Today's Gold Day progress;
- health-guideline explanations;
- chart reference lines;
- switchable Home mission/calorie views;
- calorie-trend naming and visual cleanup.

Later v0.10.x refinements are documented in the version-specific release notes.

### v0.11.0 — notifications, Pokes and broader activities

v0.11.0 expanded LogTogether beyond its earlier workout-only social model.

Changes included:

- more Home/Functional exercise support;
- jump-rope logging normalization;
- rest-completion alerts;
- wake-lock support during active workouts;
- clearer Edit → Done flows for water and supplements;
- Web Push notifications;
- Gold Day and badge notifications;
- Pokes with selectable emoji;
- mute and cooldown behavior;
- server-side privacy checks for social features.

### v0.11.1 — notification and workout reliability

v0.11.1 strengthened the new notification system and active-workout experience.

Changes included:

- timer alert fallback through audio, vibration and visual feedback;
- migration of notification defaults;
- exactly-once daily Gold Day social events;
- Poke earning tied to Gold Days;
- increased normal Poke storage capacity;
- person and group mutes;
- recipient flood protection;
- owner-only unlimited Poke testing;
- notification diagnostics;
- expanded Quick Guide content;
- circuit blocks;
- configurable Work-second targets.

### v0.11.2 — social fallback and custom supplements

v0.11.2 improved behavior when browsers or devices could not reliably deliver push notifications.

It added or refined:

- foreground Poke celebrations;
- Poke emoji rain;
- an in-app social-event inbox fallback;
- snapped Quick Guide pages;
- custom supplements and brands;
- authoritative workout ordering;
- circuit-round removal confirmation;
- Family-tab notification onboarding.

### v0.11.3 — timer and Cloud sign-in reliability

v0.11.3 focused on two areas that had become especially sensitive during real use.

Timer behavior was clarified so that:

- manual Start and Finish actions use a single cue;
- configured Work and Rest deadlines use a once-only double cue;
- overtime continues after a missed deadline;
- returning from another app reconciles timer deadlines;
- timer audio mixes rather than intentionally interrupting other media.

Cloud sign-in was strengthened with:

- direct popup-result handling;
- Firebase persistence fallbacks;
- explicit redirect completion;
- invitation persistence through redirect flows;
- clearer Connecting and error states;
- protection against merging local data before a valid Firebase identity and active LogTogether membership are established.

### v0.11.4 — active-workout and notification polish

v0.11.4 continued reliability work around active workouts and foreground events.

Changes included:

- further timer-state fixes;
- global Poke presentation;
- notification prompting;
- explicit Skip behavior;
- clearer Work and Rest controls;
- immediate draft discard controls;
- transition-based Gold Day, water and badge celebrations;
- a global authentication connection overlay.

### v0.11.5 — activity logging, feedback and supplement management

v0.11.5 broadened the application beyond starting a formal workout.

Major changes included:

- **Log activity** from Home;
- retrospective activity using the same exercise recording/science model;
- dedicated hiking remaining separate from general activity logging;
- further Poke presentation polish;
- expanded custom-supplement management;
- supplement research guidance;
- an optional external feedback-form hook;
- privacy guidance for feedback submissions;
- continued shared scoring and family-progress refinement.

### v0.11.6 — queued social presentation

v0.11.6 improved how multiple social events are presented.

Changes included:

- Web Animations-based Poke rain;
- a chronological foreground social-event queue;
- Gold Day and badge events sharing the same presentation queue rather than replacing Pokes;
- owner-only visual-regression tools for family testing;
- supplement-management polish.

### v0.11.7 — large-family social polish

v0.11.7 was the previous family-testing release.

It focuses mainly on presentation and large-family behavior:

- substantially larger received-Poke particles;
- compact presentation of large social-event batches;
- Poke priority within mixed event bursts;
- grouped Gold Day and badge bursts without losing underlying inbox event IDs;
- an owner-only local 15-person family-burst test;
- weekly supplement review collapsed by default;
- preservation of intentionally opened supplement-review state;
- clearer emphasis on custom-supplement management.

The release does not intentionally change the core Firestore authorization model or exercise-science model introduced in earlier versions.

### v0.13.0 — family comparison and workout polish

v0.13.0 adds expandable family workout and supplement details, a cleaner choose-first saved-routine manager, corrected Chosen Activity mission semantics, practical jump-rope placement, full-image history viewing, and an iPhone workout-input mitigation for Shake to Undo. It also adds a deployment check that preserves the configured Google Forms responder link. See [`docs/releases/V0.13.0.md`](docs/releases/V0.13.0.md) for the full behavior, privacy boundaries, compatibility notes, and verification record.

### v0.12.0 — family-test reliability and clarity

v0.12.0 fixes timed exercise countdowns, separates planned and actual duration, improves routine editing and backdated logging, clarifies missions and rewards, repairs the user's own family comparison, and makes Gold Day Poke rewards reversible when qualifying activity is corrected. See [`docs/releases/V0.12.0.md`](docs/releases/V0.12.0.md) for the detailed behavior, scientific interpretation, and verification record.

## Documentation

The documentation index is available at [`docs/README.md`](docs/README.md).

Current design and technical documentation includes:

- [Architecture](docs/design/ARCHITECTURE.md)
- [Authorization model](docs/design/AUTHORIZATION_V0.2.md)
- [Family management](docs/design/FAMILY_MANAGEMENT_V0.3.1.md)
- [Family progress](docs/design/FAMILY_PROGRESS_V0.5.0.md)
- [UX research](docs/design/UX_RESEARCH.md)

Operational guides include:

- [Authentication setup](docs/guides/AUTH_SETUP_V0.11.3.md)
- [Firebase App Check](docs/guides/APPCHECK_V0.8.2.md)
- [Feedback form setup](docs/guides/FEEDBACK_FORM_SETUP_V0.11.5.md)
- [Upgrade notes](docs/guides/UPGRADE.md)

Older implementation notes are preserved in [`docs/archive/`](docs/archive/) for project history and should not automatically be treated as current implementation guidance.

## Development principles

LogTogether favors stable identifiers, explicit privacy boundaries, offline resilience, dependency restraint, and behavior-focused regression testing.

Stable exercise IDs should not be renamed simply for presentation purposes.

Security-sensitive decisions are enforced outside the UI.

Tests should protect intended behavior rather than old implementation details. When behavior intentionally changes, tests should be updated to describe the new behavior instead of forcing the application to reproduce obsolete behavior.

The project is still an alpha. It is tested and actively used in a family-oriented development environment, but it should not yet be treated as a finished public production service.
