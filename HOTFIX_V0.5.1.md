# LogTogether v0.5.1 hotfix

Fixes three regressions found during v0.5 testing:

- calorie estimates now use exact elapsed time and repair legacy zero-calorie snapshots;
- first companion sync can read a missing UID-addressed `bodyMetrics/{uid}` document instead of failing permission checks;
- Google identity seeding preserves an existing LogTogether display name, and profile edits mark identity seeding complete.

Firestore rules changed and must be tested/deployed before Hosting.
