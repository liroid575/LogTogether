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
