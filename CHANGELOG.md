## v0.15.0 — Reliability, Groups & Recording Polish

- Added verified-email-bound pending-invite recovery for browser-to-installed-PWA handoff while keeping opaque QR tokens as the preferred path.
- Added realtime observation of the signed-in user's private Poke wallet without changing the Gold reward ledger/economy.
- Added multi-group membership for ordinary family members with group-intersection authorization and owner-only atomic administration.
- Replaced permanent workout/circuit/routine Up/Down controls with smooth Pointer Events reordering plus a compact accessible position chooser.
- Removed the redundant Water-log calendar dot.
- Unified personal and Family weekly supplement detail rendering.
- Refined manual completed-activity logging so historical values start blank, effort may remain unknown, and existing tracker metrics are optional.
- Re-audited the exact 156 exercise IDs; Warrior I/II now use per-side recording while scoring remains unchanged.
- Added v0.15 unit/security regression coverage and a source-backed research workbook.

## v0.13.0 — Family Comparison & Workout Polish

- Added expandable date/time/amount supplement detail to personal weekly review and enabled family summaries.
- Added expandable recent family workout set, duration, rest, load, effort, note, and circuit detail.
- Reworked saved-routine management around an explicit chooser, compact top actions, and optional bulk deletion.
- Corrected Chosen Activity Days so only one specifically selected supported activity earns progress.
- Moved basic jump rope to Home / Functional and Single/Double Unders to Gym.
- Preserved full history photos and added an enlarged lightbox.
- Reduced iPhone Shake to Undo interruptions during workouts by releasing editable focus and blocking web undo events where supported.
- Added a pre-deployment check for the private Firebase configuration and Google Forms feedback link.
- Added backward-compatible bounded weekly supplement-detail sharing and Firestore rule coverage.

## v0.11.7 — Family Burst & Supplement UI Polish

- Enlarged received-Poke rain particles while preserving the v0.11.6 Web Animations engine.
- Added foreground burst compaction for large family backlogs: Pokes first, Gold/badge summaries when many events arrive together.
- Added owner-only local 15-person family burst regression preview.
- Weekly supplement review defaults closed and preserves open state while filtering.
- Made custom supplement management visually clearer with red management text.
- Hosting-only; backend rules/economy/science unchanged.

## v0.11.6 — Poke Reliability & Supplement Polish

Small family-testing patch focused on foreground social feedback and supplement management.

## Pokes and social events

- Replaced the v0.11.5 CSS-variable Poke-rain path with explicit DOM particles driven by the Web Animations API, with a CSS fallback.
- Poke rain now creates 22 particles in two staggered waves. `prefers-reduced-motion` still intentionally suppresses decorative rain.
- Added a single foreground presentation queue shared by received Pokes, family Gold Day/badge popups, and local Gold Day/water/badge celebrations so effects do not overwrite one another.
- Social inbox events are marked seen only after their foreground presentation finishes. Events already waiting in the queue are de-duplicated by ID.
- If the app is hidden, queued foreground effects wait until the app becomes visible again.
- Incoming Gold Day and badge events now use a dedicated in-app popup instead of competing with the ordinary toast.

## Temporary owner-only effect test harness

- Settings contains a collapsed `Developer · visual/event tests (temporary)` panel for the active Cloud family owner only.
- Local-only preview buttons cover: one received Poke, five queued Pokes, a mixed Gold/Poke/badge queue, family Gold Day popup, family badge popup, own Gold Day animation, water-goal animation, monthly-badge animation, and Gold/water calendar style samples.
- These previews do not spend Pokes, send notifications, write Cloud events, or mutate Gold Day/water/badge progress.
- The harness is isolated behind `DEVELOPER_EFFECT_TESTS_V0116` and a single render/bind block so it can be removed after alpha visual testing.

## Supplements

- The information link now switches between `View more: uses / evidence / side effects` for built-in supplements and `Research this supplement` for custom products.
- `Add a supplement record` and the nested custom-supplement manager retain their open state across edits/renders.
- Supplement, amount and unit draft values are preserved while managing custom products.
- `Manage my supplements` now uses one dropdown. Selecting a custom supplement opens one compact editor with rename/default amount/default unit/research/remove controls.
- Renaming still updates historical display labels while preserving the stable supplement ID. Removing a custom item still leaves historical consumption records intact.

## Backend / data compatibility

- Hosting/front-end only patch: no Firestore rule, index, Cloud Function, VAPID, science scoring, Poke economy, or schema changes.
- Owner Pokes retain the temporary v0.11.x unlimited/no-same-recipient-cooldown test privilege. Recipient mute rules and the five-Pokes-per-hour flood guard are unchanged.

## Verification

- Production TypeScript build succeeds.
- Focused `v0116-social-queue-supplement-polish.test.mjs`: 8/8 pass.
- Older release-specific tests that hard-code historical version numbers/assets are intentionally not used as the v0.11.6 gate.


## v0.11.5 — Activity Logging, Poke Polish & Feedback

- Replaced the Home `Log a hike` shortcut with a broader `Log activity` flow for retrospectively entering activities already tracked by Apple, Garmin, Strava, pool clocks, bike computers or similar tools.
- Retrospective entries reuse the existing exercise definitions, recording profiles, calorie estimation and science analyzer rather than introducing a second scoring system. Activity-specific fields adapt to sets/reps/load, timed rounds, carries, cardio duration/distance, swim laps and other supported metrics.
- Hiking remains a dedicated Hike record with GPX/elevation support. New generic activity logging does not create hike records or hiking badges, and new live-workout selection no longer offers generic `Hiking cardio`. Historical records remain compatible.
- Corrected retrospective timestamps so the chosen date/time represents when the activity ended; start time is reconstructed from the recorded duration rather than creating future completion timestamps.
- Reworked Poke emoji rain with explicit iOS-friendly animation positions/timing/distance, increased the visible rain, added a small sender-side success burst, and added vertical breathing room to the emoji picker to avoid clipped selection cards.
- Added proper My supplements management: edit name/brand and defaults, remove future catalog choices while preserving history, and keep stable custom IDs. Renaming updates prior logged display names and syncs affected days.
- Expanded custom-supplement research links to use the exact user-entered product name plus neutral evidence/safety search terms. LogTogether does not infer ingredients, prescribe use, or generate efficacy claims.
- Added external feedback hooks in Settings and the Quick Guide with privacy guidance and anonymous app-info copy. `feedbackFormUrl` in runtime config accepts Google Forms links; no Firebase feedback backend is added.
- Bumped the PWA shell cache to `logtogether-shell-v0.11.5-activity-feedback`.
- No changes to Firestore rules, Cloud Functions, Poke economy, Gold Day thresholds, family authorization, or science scoring formulas.

## v0.11.4 — Workout Flow & Feedback Polish

- Reworked workout deadline handling into independent work/rest deadline state so target expiry emits the two-beep cue once, while Start/Finish remain single-beep actions.
- Added an explicit iPhone Ring/Silent note beside the timer-audio tester while preserving transient/mixing audio so music and workout videos are not deliberately interrupted.
- Made the Family notification reminder depend on actual device subscription state rather than a previous manual-disable marker; blocked/unsupported states now explain themselves instead of silently hiding the prompt.
- Starts the private social-inbox observer as soon as Cloud membership is established, allowing Poke popup + emoji rain from any app page.
- Added ordered Skip semantics. Only the canonical next set/movement may be skipped; skipped work remains visible in History but is excluded from calories, muscle/training credit, missions, Gold Days, progression and Pokes.
- Added exercise-level Work target controls beside Rest, including defaults in Add Exercise and propagation only to unstarted sets.
- Added an always-visible Discard workout control beneath the workout name for active drafts and circuits.
- Added lightweight once-per-transition celebrations for Gold Day, daily water goal and monthly badges, with reduced-motion support.
- Added a global LogTogether-branded Cloud connection overlay so Google sign-in/access checks are visible instead of appearing to leave the app in Local mode.
- No science-scoring, Firestore-rule, index, Cloud Function, VAPID-key or notification-backend changes.

# v0.11.3 — Timer & Cloud sign-in reliability

- Corrected timer cue semantics: one beep on Start/Finish, two beeps only when configured work/rest targets expire.
- Removed audible near-silent priming; timer audio preparation is now truly silent.
- Switched supported iOS audio-session behavior from exclusive playback to transient/mixing cues so short alerts do not deliberately stop YouTube/music.
- Added timestamp-based deadline recovery when returning from another app.
- Reworked Firebase Auth initialization with IndexedDB/local/session persistence fallbacks.
- Popup sign-in now resolves the returned account/membership explicitly; redirect fallback is completed explicitly on return.
- Changed Firebase authDomain to the same Hosting origin (`YOUR_PROJECT_ID.web.app`) for modern Safari/private-browser redirect compatibility.
- Preserved pending invite codes across redirects and added visible connection/error states.
- Bumped the PWA shell cache to `logtogether-shell-v0.11.3-timer-auth-reliability`.
- Hosting-only deployment; no Firestore/Functions changes.

# v0.11.2 — Notification onboarding & ordered workout flow

- Replaced the primary timer-alert media path with a tiny compressed MP3 while retaining Web Audio, playback-session, vibration-where-supported and visual fallbacks; added a one-tap timer-alert test in Settings.
- Added a bounded private social inbox so Pokes, Gold Days and badges are not lost when a recipient has never registered Web Push.
- Added a playful Family-tab notification onboarding dialog with Enable / Not now / Never show again, silent push-subscription repair, and a reversible reminder preference.
- Added foreground Poke feedback with a sender bubble and gentle four-second emoji rain, respecting reduced-motion preferences.
- Restored mandatory page snapping to the taller Quick Guide.
- Added private custom supplement/product entries with optional default amount/unit while preserving built-in common supplements and historical labels.
- Made workout/circuit Start controls authoritative: only the next valid set/movement in sequence can start.
- Replaced circuit Remove Round two-tap behavior with the shared destructive confirmation dialog.
- Bumped the PWA shell cache to `logtogether-shell-v0.11.2-social-reliability`.

# v0.11.1 — Social reliability & workout polish

- Reworked rest-complete alerts with media audio + Web Audio fallback, playback-session support where available, vibration where supported, and a visual timer flash.
- Added a one-time notification-default migration while preserving later user mute/disable choices.
- Replaced weekly-counter Gold notifications with an idempotent daily Gold Day event so each member can notify/earn at most once per date.
- Improved push titles/bodies and stable notification tags for Pokes, Gold Days, badges and developer tests.
- Increased normal Poke storage from 5 to 7; added server-enforced person/group mutes and a five-Pokes-per-hour recipient flood limit.
- Added temporary owner-only infinite Pokes plus a current-device test notification and owner-only backend activity diagnostics.
- Expanded the Quick Guide to include Pokes, with taller/larger continuous horizontal tutorial pages.
- Reworked Circuit Builder movement separation and moved movement numbering to the top-left.
- Added optional target Work seconds to applicable rep-based sets/routine movements while retaining actual elapsed timing.
- Bumped the PWA shell cache to `logtogether-shell-v0.11.1-social-reliability`.

# v0.11.0 — Family testing, home exercise & social encouragement

- Added a Home & Functional exercise group with accessible home-oriented strength, balance and support-endurance options, including chair sit-to-stand, wall/counter push-ups, resistance-band work, supported calf raises, step-ups, standing hip abduction, Bird Dog, marching in place, supported balance work, Supported Bar Hang and Dead Hang.
- Normalized jump-rope variants to interval/round-based recording so Basic Bounce, Single Unders and Double Unders follow the same recording model.
- Added optional rest-complete audio cues and an optional screen wake lock while a workout is active.
- Simplified Water and Supplements history with a section-level Edit / Done mode instead of persistent edit controls on every entry.
- Added opt-in Web Push notifications for Gold Days, badges and Pokes.
- Added server-validated Poke wallets: one Poke per newly earned Gold Day, maximum balance 5, approved emoji set, group-visibility checks, App Check, active-family checks and a two-hour same-recipient cooldown.
- Push subscriptions are private per-user documents; expired subscriptions are removed automatically after failed delivery.
- Added Firebase Functions (Node 22, asia-east1), Web Push VAPID secrets and the required Firestore rules for notification and Poke server state.
- Bumped the PWA shell cache to `logtogether-shell-v0.11.0-social-home`.

# v0.10.5 — Family profile & workout polish

- Added per-user family-profile sharing controls for biological sex, this week’s supplement summary, recent workouts, and recent hikes.
- Biological sex is removed from the family member document when the user disables sharing; supplement weekly summaries stop publishing while that option is off.
- Moved Personal activity to the end of the ten Weekly Missions and matched the Quick Guide ordering.
- Moved informational science starter/last-time/next-step guidance below workout Notes while keeping safety-critical warnings beside the relevant exercise inputs.
- Added a pencil affordance next to the editable workout name.
- Changed Saved routines to a horizontally scrollable card strip and removed the ten-card display cap.
- Added 4-week Momentum to Family Compare as a secondary consistency context, without ranking or winner labels.
- Bumped the PWA shell cache to `logtogether-shell-v0.10.5-profile-polish`.

# v0.10.4 — Home trend layout polish

- Fixed the Home Estimated Calories pane so its title, Weekly/12 months selector, and chart always render as one full-width vertical block on mobile and desktop.
- Renamed the Weekly Missions help entry to `Quick Guide` and reduced its visual emphasis.
- Kept `4-week momentum` and added a short explanation: weeks with 8+ missions completed.
- Changed the neutral default profile name from `Family member` to `User` while preserving real chosen/display names and treating both old/new placeholders as defaults during invite claiming.
- Bumped the PWA shell cache to `logtogether-shell-v0.10.4-polish`.
- No science scoring, Firestore rules, schema, authorization, or privacy changes.

# v0.10.3 — Science UX polish

- Fixed the Weekly Missions tutorial so each of the five swipe/pages renders its own content.
- Confirmed Weekly Missions remain exactly 10 and integrated the Personal Activity picker into that mission row so it no longer reads like an eleventh mission.
- Reworked Health Guideline Progress spacing and added a concise explanation separate from game scoring.
- Added a Home `Weekly missions | Estimated calories` switch while retaining the nested weekly / 12-month calorie trend controls.
- Renamed Workout Trend to `Estimated calorie trend` and the daily meter to `Gold Day progress`.
- Added three rounded horizontal reference lines to Family Calories and Water comparison charts.
- Removed the extra Gold Day star from History calendar cells; gold fill alone indicates the day.
- Bumped the PWA shell cache to `logtogether-shell-v0.10.3-polish`.

# v0.10.2 — Weekly Missions Onboarding

- Expanded the Weekly Missions quick guide to five pages while keeping the compact swipe-sheet design.
- Added plain-language explanations for all ten Science Alpha missions.
- Renamed the Home meaningful-activity meter to `Today's Gold Day progress` so it clearly connects to Gold Days.
- No science-scoring, schema, privacy, family aggregate, or Firestore-rule changes.
- Bumped the PWA shell cache to `logtogether-shell-v0.10.2-science-ux`.

# v0.10.1 — Science UX & Family Compare

- Added a four-page swipeable Weekly Missions tutorial covering mission balance, Push/Pull/Lower/Core, Gold Days, Momentum, health guidance and calorie semantics.
- Removed redundant Home-page explanatory copy and moved the science/game-rule explanation into the tutorial and existing Calculations settings.
- History now labels the pie view as **Training mix / Estimated muscle training distribution** to distinguish it from mission categories.
- Science-era Gold Days use a fixed semantic gold calendar fill and star marker instead of inheriting the selected accent palette.
- Family Compare now defaults to **Weekly activity** with Gold Days, mission progress, hydration, Push/Pull/Lower/Core credits, cardio/mobility minutes, strength days and training distribution.
- Calories and water remain available as secondary trend tabs; calories are explicitly presented as estimates rather than a competitive score.
- Removed Family-card chevrons to reduce mobile wrapping and horizontal crowding.
- Family weekly profile summary promotes Gold Days instead of exercise calories.
- Bumped the PWA shell cache to `logtogether-shell-v0.10.1-science-ux`.

# v0.10.0 — Science Alpha

- Added activity-appropriate science recording profiles across the exercise library while preserving legacy workout records.
- Added conservative first-use defaults plus recent-session memory and non-automatic progression guidance.
- Replaced normalized muscle-percentage mission scoring with direct/secondary training credits; warm-ups and self-rated effort no longer farm mission points.
- Reworked weekly missions around Push, Pull, Lower, Core, strength frequency, cardio, mobility, Gold Days, personal activity and hydration.
- Gold calendar now uses capped Meaningful Activity after the science cutover while older dates retain legacy behavior.
- Monthly badge target is ~80% of all eligible missions in the month; earned badges are retained with scoring-version metadata.
- Added four-week Momentum and separate informational health-guideline progress.
- Added explicit underwater/aquatic safety exclusions and quality-before-volume flags.
- Expanded Settings → Calculations, game rules & version with formulas, rationale and exercise-science/behavior-psychology sources.
- Kept AppState schema v1 and existing Local/Cloud authorization/storage architecture.
- Bumped the PWA shell cache to `logtogether-shell-v0.10.0-science-alpha`.

# v0.1.7

## 0.1.7 — Final chart/history polish

- Completed weekly missions now use the selected accent color instead of fixed green.
- Weekly difficulty controls moved behind a compact “Hard week? Change difficulty?” disclosure. Preview remains free; only confirmed changes count toward the 3/week limit.
- Home recent activity now shows only activity recorded today.
- Weekly calorie bars are visually thinner.
- Monthly Workout Trend is now a true rolling 12-month calorie line chart. It starts Jan–Dec of the current year and can shift one month earlier/later with arrow controls.
- Completed hikes can now be reopened and edited. Existing photos and GPX route traces are preserved unless explicitly replaced.
- Added regression coverage for the rolling monthly calorie window.
- Bumped PWA shell cache to v1.07. Stored-data schema remains v1.

# v0.1.6

- Restored detailed weekly missions with live `current/target` progress and completed-state styling.
- Weekly difficulty is preview-first; only a second click confirms and consumes one of the three weekly changes.
- Split monthly and hiking badges; hiking badges carry a prototype/no-database warning.
- Added local GPX import for Garmin/compatible tracks, route trace preview, and compact route storage in hike history.
- Added accent-color presets plus a custom color picker.
- No new runtime dependencies; schema remains v1 with additive optional fields.

# Changelog

## 0.1.6 — Weekly missions + GPX polish

- Restored detailed weekly mission progress on Home. Each exercise category now shows current/required completed sets (for example Back 1/3) and turns complete when the target is reached.
- Weekly difficulty modes now use preview-then-confirm. The first tap only shows the preset requirements; tapping the same mode again applies it. Previewing does not consume one of the three weekly changes.
- Split Personal badges into Monthly badges and Hiking badges so hiking achievements cannot crowd out consistency badges.
- Added a quiet warning explaining that hiking badges are currently based on the first unique typed hike name and are not verified against a route/summit database.
- Added Garmin-friendly GPX import UI to Log Hike. GPX can already be parsed locally to preview the route and autofill distance/elevation statistics. FIT/TCX remain future formats.
- Bumped PWA shell cache to v1.06. No stored-data schema migration.

## 0.1.5

See prior release for routine deletion/sync, continuous circuit rest timing, goal difficulty presets, water calendar, Signal-style stories and first-route hiking badges.

## 0.8.3 — Local / Cloud groups + workout polish
- Local-first default with invite-only Cloud access and group-scoped sharing.
- Owner group management, owner multi-group profile sharing, Cloud revocation, Local→Cloud migration.
- Expanded exercise library and workout/circuit UI polish.
- Persistent workout/rest dock and per-set duration display.
- Normal set removal moved to a compact left-side trash control; completed live sets cannot be removed and running workouts require a second click to confirm removal.
- Workout history now shows per-set duration instead of redundant finish times.
- Circuit history is organized by Round 1 / Round 2 / Round 3 rather than by exercise.
- Weekly workout and water views return to the current week when revisiting their tabs.

## v0.8.3.1 — Cloud UI & workout guard polish
- Removed the owner-only Family notice and restored tap-to-edit on the self profile card.
- Owner Family view now groups members by Cloud group.
- Groups settings are collapsible; names save directly on edit without a Rename button.
- Cloud member access rows show avatars and use responsive non-overlapping controls.
- Only one workout set can run at a time.
- Removing a circuit round from a running workout requires a second confirmation click.
- Undo toasts move below the top bar instead of covering workout controls.
- Save routine remains available on mobile workout docks.
- Discarding from Workout Now returns to a fresh workout builder instead of Home.
