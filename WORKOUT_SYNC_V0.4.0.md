# LogTogether v0.4.0 — Workout cloud sync checkpoint

This checkpoint adds Firestore sync for completed **strength workouts only**.

## Privacy boundary

- New workouts default to **Only me**.
- Private workouts still sync across the signed-in user's devices, but family members cannot read them.
- A workout appears in family comparisons only when the user explicitly changes Sharing to **Family**.
- Before the first v0.4 upload, pre-v0.4 unsynced workouts are downgraded to private so an upgrade cannot silently publish historical activity.
- Workout photos stay local in IndexedDB and are stripped from Firestore payloads.
- Hydration, body weight/height, hikes, routines, stories, custom profile photos and other media remain local-only.

## Account-local browser storage

The local cache is now separated by identity:

- `logtogether:state:v1:guest`
- `logtogether:state:v1:uid:<firebase uid>`

A legacy anonymous `local_user` state can be claimed once by the first signed-in account. Bundled `demo_user` state is never imported into an account cache.

## Sync behavior

- Completed own workouts upload to `workouts/<workoutId>`.
- Own cloud workouts download on sign-in / manual sync.
- Local/cloud edits use the local `updatedAt` marker for simple last-edit reconciliation.
- Deletes use a local tombstone until Firestore confirms the delete, preventing a temporarily offline deletion from being resurrected.
- Family profile comparison queries only documents with the same `familyId` and `visibility == "family"`.

## Tests

The supplied source passes the local app suite with **49/49** tests in the build environment.

Two Firestore emulator query tests were added on top of the existing 27-rule suite. Run `mise exec -- npm run test:security` in the real project and require **29/29** before deploying Hosting.

`firestore.rules` itself is unchanged in this checkpoint; the new tests verify that the actual owner and family-visible queries are permitted by the already-deployed rules.
