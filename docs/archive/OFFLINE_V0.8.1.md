# LogTogether v0.8.1 — IndexedDB local database migration

This is the second v0.8 reliability checkpoint. It changes the **local structured-data storage engine**, not the Firebase sharing model.

## What changed

- Structured LogTogether state now uses IndexedDB database `logtogether-structured-v1`, object store `accountStates`.
- Each Google UID scope and the guest/local scope remain isolated from each other.
- Existing v0.8.0 localStorage data is migrated automatically on first launch.
- The migration is fail-safe:
  1. keep/read the existing scoped localStorage state;
  2. create a temporary rollback copy when space allows;
  3. write the exact state into IndexedDB;
  4. read it back and verify the bytes;
  5. only then retire the active v0.8 localStorage state.
- The temporary migration rollback is kept current during the first post-migration session and is removed after a later verified IndexedDB load, preventing stale old records from living in localStorage forever.
- Every normal save writes a short-lived synchronous localStorage **crash journal** before scheduling the IndexedDB transaction. The journal is removed only after the IndexedDB write completes. If the app/browser is killed mid-write, the journal is replayed on next launch.
- IndexedDB writes are queued per account scope so rapid saves do not intentionally reorder within the same app instance.
- If IndexedDB is unavailable or fails, LogTogether can fall back to the v0.8 localStorage path instead of refusing to open.
- Settings → Offline & cloud sync now reports `Local database: IndexedDB ✓` or `localStorage fallback`.
- App bootstrap and account switching now await the asynchronous local database before using that account's state.
- Service-worker cache: `logtogether-shell-v0.8.1`.

## What did not change

- Firestore collections/rules and family sharing permissions are unchanged.
- Firebase sync/outbox behavior from v0.8.0 is unchanged.
- Local image bytes remain in their existing separate IndexedDB media database (`family-exercise-media-v1`).
- JSON export/import remains available as an independent manual backup path.
- App schema is still v1; this is a storage-engine migration rather than an AppState schema migration.

## Validation

- TypeScript/build + application unit suite: **105/105 passed**.
- A runtime IndexedDB mock exercised: legacy migration → verified IDB record → queued save → temporary rollback cleanup → crash-journal replay. Passed.
- No Firestore rules changed, so no security emulator/rules deployment is required for this checkpoint.

## Suggested device test

1. Open v0.8.1 online once on the already-used account.
2. Check Settings → Offline & cloud sync. It should say `Local database: IndexedDB ✓`.
3. Confirm all existing v0.8.0 workouts, hikes, water, supplements and profile data are still present.
4. Add a small record, then fully close the PWA.
5. Disable internet and cold-launch it again. Confirm the record is still present and add another offline record.
6. Fully close/reopen once more while offline.
7. Restore internet and confirm pending changes sync normally.
8. Export one JSON backup once after the test as an independent recovery copy.
