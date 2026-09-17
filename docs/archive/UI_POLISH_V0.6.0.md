# LogTogether v0.6.0 — UI & workout polish

This checkpoint intentionally changes only frontend/local application code and unit tests. It does **not** change `firestore.rules`, Firebase configuration, or the Firestore data model.

## Changes

- Accessibility: A+ large-text toggle designed to reflow cards/controls rather than zooming the whole page.
- Family comparison: fixes the SVG filled-triangle bug; clicking either summary card selects the highlighted person; Calories uses the active accent, Water uses blue; adds two weekly exercise-category donut charts using Family-shared workouts only.
- Workout timing: explicit **Start set** button before completion; history editing hides live start/completion controls.
- Calorie estimate: uses exact elapsed time plus difficulty (1–5) and completed set/repetition/duration volume, instead of relying almost entirely on wall-clock minutes.
- New workouts default to **Family** sharing. Existing workouts keep their saved sharing setting.
- Sharing card is responsive and no longer lets the selector overlap explanatory text.
- Home: adds a daily calorie/water goal card; places Weekly calories and Workout trend before Weekly missions.
- Trend charts: weekly bars now include a line overlay; monthly chart adds total calories, horizontal reference lines/ticks, and responsive sizing without required horizontal scrolling.
- Water: calendar selection controls which day's entries are shown; selected-day entries can be edited or deleted; current month defaults to today.
- Hiking: removes the redundant hike-water input/display while preserving legacy stored values for compatibility.
- History: expanded workouts show estimated total calories.
- Profile: adds a local biological-sex selector and automatic adult BMI readout. Taiwan adult BMI cutoffs are used (underweight <18.5, normal 18.5–<24, overweight 24–<27, obesity >=27); these BMI category thresholds are not sex-specific.
- PWA cache key bumped to `logtogether-shell-v0.6.0`.

## Privacy / sync notes

- No backend or Firestore rule changes.
- Biological sex and large-text preference are local in this checkpoint; height/weight continue using the existing v0.5.x private sync behavior.
- Weekly exercise-category donut charts can only use raw workouts explicitly shared with Family. Private workouts still contribute only to the existing minimal family calorie aggregate, not exercise-category details.
- Existing positive calorie snapshots are preserved. Editing/saving an older workout recalculates its snapshot with the current estimator.

## Verification

The reconstructed v0.5.1 tree used to build this patch passes 70/70 local unit tests after applying v0.6.0. The user's full tree can contain additional prior regression tests, so the important condition is `fail 0` rather than an exact count.
