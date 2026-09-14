LogTogether v0.5.1 hotfix

Fixes:
- completed workouts being stuck at 0 Cal due to whole-minute rounding and persisted zero snapshots;
- companion/family comparison sync failing PERMISSION_DENIED when bodyMetrics/<uid> did not exist yet;
- legacy Google identity seeding overwriting an existing LogTogether display name.

Rules changed. Run unit + security tests, deploy Firestore rules, then deploy Hosting.
