# Upgrade policy

The app code and user data are deliberately independent.

## Data rules

- Every durable record has `schemaVersion`.
- Current schema: **1**.
- New releases should prefer additive fields.
- Never rename/delete stored fields in the same release that introduces the replacement.
- Unknown schema versions fail closed rather than being guessed.
- Database migrations require a backup first.

## Release procedure

1. Create a Git branch.
2. Make the smallest reasonable change.
3. Run `npm test`.
4. Run `npm run test:security` for any data/rule/auth change.
5. Test English and Traditional Chinese manually.
6. Build and use a Firebase Hosting preview channel.
7. Test an existing schema-v1 dataset in the preview.
8. Export/backup before any migration.
9. Deploy the exact tested revision.
10. Verify production reads/writes.
11. Tag a version such as `v0.1.1`.

Firebase Hosting supports rollback of site releases, but a code rollback is **not** a database rollback. Avoid destructive migrations.

## 0.1.1 note

This patch is UI/interaction-only from the data-model perspective: `schemaVersion` remains 1 and the existing localStorage key is retained. The service-worker cache key was bumped so browsers do not remain stuck on the 0.1.0 shell.

## 0.1.2 note

0.1.2 is an additive schema-v1 update. Existing workout records are not rewritten. New optional timing, rest, difficulty, and personal-goal fields may be added as the user creates/edits records. Analytics are computed from canonical workout/hike records rather than duplicated counters, which reduces migration and consistency risk.
