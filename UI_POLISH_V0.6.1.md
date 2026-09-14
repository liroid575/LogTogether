# LogTogether v0.6.1 — focused UI polish + supplement log

This patch is intended to be copied **over an already-applied v0.6.0 tree**.

## Changes

- Family comparison now truly mutes the non-selected Calories/Water line and draws the selected line on top when the two overlap.
- Comparison charts show both users' daily `Cal` / `mL` values above each weekday.
- Exercise-mix comparison always shows all eight exercise categories with `0` values when unused; the empty “No family-shared sets this week” message is removed.
- Text size control lives only in Settings and now supports 100%, 110%, 120%, 130%, and 140%. The top-bar text-size button is removed.
- Live workout sets use one state button: **Start → Finish → Done**, instead of a Start button plus a separate checkbox.
- Weekly calorie goal explains the actual estimator formula, difficulty-to-MET mapping, rep timing approximation, rest estimate, and that the result is only an estimate.
- Blue was removed from the preset accent palette. Water goal/progress bars and Water family comparison remain blue regardless of accent choice.
- Water is expanded to **Water & supplements**, including a combined drop/pill nav icon, 50 common supplement choices, amount/unit/date logging, and supplement entries on the Water calendar.
- PWA shell cache advanced to `logtogether-shell-v0.6.1`.

## Supplement privacy in this patch

Supplement entries are deliberately **local-only in v0.6.1**. They use the existing account-scoped local state and are not uploaded to Firestore or exposed to Family. This keeps this release frontend-only and avoids changing Firestore rules or the privacy model. A later release can add private cross-device supplement sync if desired.

The supplement feature is a consumption log only; it does not recommend doses.

## Validation

A focused strict TypeScript compile of `src/main.ts`, `src/core/*.ts`, and `src/services/firebase-client.ts` passes. No Firestore rules or backend files are changed, so the long Firebase emulator/security suite was intentionally not rerun for this small patch.
