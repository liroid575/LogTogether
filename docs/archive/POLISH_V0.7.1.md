# LogTogether v0.7.1 — calendar and record editing polish

Focused follow-up to v0.7.0. No Firestore rule changes.

## Changes
- History and Water calendars reset to today when their bottom tabs are opened.
- Selected dates use an outline only. Water selection outline is always blue; History follows the chosen accent color.
- Goal-completion fills remain separate: hydration stays blue and calorie-goal days use the selected accent color.
- Weight-entry dates get a small red heart marker in History.
- "Add a supplement record" is collapsed by default and new supplement entries can only be created for today.
- Existing Water and Supplement entries can be edited for amount/date/time and are marked `(edited)` after a change.
- Finished workouts can edit session start/end date and time; saved edits are marked `(edited)`. Recorded nested workout timing is remapped consistently to the edited session window.
- Hikes can record/edit date and start time; saved historical edits are marked `(edited)`.
- Weekly exercise-calorie mission now needs 5 days for completion. Days 6 and 7 remain bonus points, allowing 21/20 and 22/20; bonus scores are gold.
- Service-worker cache bumped to `logtogether-shell-v0.7.1`.

## Validation
`npm test`: 76/76 passing.
