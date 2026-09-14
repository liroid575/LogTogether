# LogTogether v0.7.0 — Family Cloud Sync

This release expands LogTogether's Firebase sync from the v0.5 daily-progress model into the data needed for normal multi-device family use.

## Now synced across the signed-in user's devices

- Workouts and calculated calorie snapshots
- Hike metadata: name, date, distance, moving/elapsed time, elevation, difficulty and notes
- Hydration
- Supplement logs, including exact local timestamps for the account owner
- Biological sex
- Height and weight
- Preferences / goals / palette
- Monthly and hiking badges

## Now visible to active members of the same family

- New and re-saved workouts, with recent workout details visible on family profiles
- Daily calorie and water totals
- Biological sex
- Hike metadata
- Weekly mission/achievement summary
- Weekly workout/hike/calorie progress
- Weekly supplement summary: supplement name, total amount when units are compatible, entry count and number of days
- Monthly and hiking badges

## Still deliberately private / local

- Height and weight remain owner-only in Firestore.
- Individual hydration entries/timestamps remain owner-only.
- Exact supplement entries/timestamps are owner-only; family sees only the weekly summary.
- Exact GPX route points and hike/workout/profile photos are not uploaded by this release. Hike metadata still syncs, but precise route history and image storage should use a separate private media/location design rather than making them family-readable by accident.
- Photo stories remain local.

## Workout sharing simplification

The workout sharing dropdown is removed. New workouts and any old workout that is opened and re-saved are stored as `family` visibility automatically.

Existing historical records that were already marked `private` or `selected` are **not silently republished during migration**. They remain as they were until the user explicitly edits/re-saves them.

## Firestore additions

- `supplements/{uid_YYYY-MM-DD}` — owner-only exact supplement day logs.
- `familyWeekly/{uid_YYYY-MM-DD}` — bounded family-readable weekly achievement and supplement summary.
- Existing `hikes` documents are now actively synced by the client.
- `families/{familyId}/members/{uid}` presentation data can contain `biologicalSex`.

## Validation performed while building this patch

- TypeScript strict compile/check passed for the modified app sources.
- Full unit/static suite in the reconstructed v0.6.3 project: **76/76 passed**.
- Firestore emulator security tests were expanded for v0.7 but could not be executed in the build container because Firebase CLI / `@firebase/rules-unit-testing` are not installed there. Run `npm run test:security` on the normal LogTogether development machine before deployment.
