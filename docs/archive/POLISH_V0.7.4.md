# LogTogether v0.7.4 — final profile polish

Small frontend-only cleanup on top of v0.7.3.

## Changes

- Removed the temporary History/Water completed-month preview controls from Settings.
- Family-member profile now keeps these sections collapsed by default:
  - This week's supplements
  - Recent workouts
  - Recent hikes
- Personal hiking badges return to a clean normal display.
- One Edit / Done button in the Hiking badges section enables management mode.
- In management mode:
  - drag the small `⋮⋮` handle to reorder badges,
  - rename a badge,
  - remove an accidental badge without deleting its hike record.
- Badge presentation changes continue to sync to Family through the existing v0.7 cloud path.
- Service-worker shell cache bumped to `logtogether-shell-v0.7.4`.

## Backend / security

No Firestore rules, indexes, collections, or permissions changed.

## Validation

- TypeScript/build: passed.
- Unit/application suite: 90/90 passed.
- Firebase security emulator not required because Firestore rules are unchanged.
