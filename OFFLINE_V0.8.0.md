# LogTogether v0.8.0 — Offline reliability checkpoint

This is the first v0.8 reliability checkpoint. It does not change Firestore rules.

## What changed

- A successful Google sign-in remembers the account UID locally on that device.
- On a cold launch without Firebase/network access, LogTogether opens that UID-scoped local data instead of falling back to an empty guest bucket.
- Explicit Google sign-out clears the remembered offline-account pointer; the UID-scoped data itself is not silently deleted.
- Network `online` / `offline` events update status and automatically retry account/family sync after connectivity returns.
- Settings now reports local/offline/cloud sync state, pending change count, and last successful sync time.
- Offline edits to preferences, profile/body metrics, water and supplements are queued locally before any Firebase availability check.
- Deleting a previously cloud-synced workout or hike while offline now creates a durable tombstone so the cloud copy cannot resurrect after reconnect.
- Offline profile-name changes are reconciled to the family member presentation on the next sync.
- Settings now provides account-bound JSON export/import for structured data. Import keeps an internal local rollback copy first and rejects backups belonging to another signed-in UID.
- JSON backups include structured LogTogether state, including GPX route data stored in state, but do not yet include IndexedDB image bytes.
- Service worker cache advances to `logtogether-shell-v0.8.0`.

## Storage model in this checkpoint

Structured state remains in the existing UID-scoped `localStorage` store. Local photos remain in IndexedDB. v0.8.0 intentionally does not combine the offline identity/outbox change with a storage-engine migration. A later v0.8 checkpoint can migrate structured state to IndexedDB with a verified one-time compatibility bridge.

## Validation

`npm test`: 97/97 passing.

Firestore rules are unchanged, so no rules deployment is required for this checkpoint.
