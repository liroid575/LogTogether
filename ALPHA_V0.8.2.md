# LogTogether v0.8.2 — Family Alpha Hardening

This checkpoint prepares the existing v0.8.1 offline/sync foundation for use by real family members without adding new health-tracking features.

## Changes

- Family page no longer exposes the unfinished local-only Stories composer. Existing local story data is preserved and can expire/clean normally.
- Settings now includes a Family alpha readiness section:
  - clear "What can my family see?" privacy summary;
  - explicit list of unfinished features;
  - privacy-safe diagnostics export.
- Diagnostics include only app/storage/sync state and record counts. They deliberately exclude names, account/family IDs, workout/hike content, notes, supplement identities and GPS points.
- Firebase App Check client support is ready for a reCAPTCHA Enterprise rollout. It remains inactive until `public/config.js` receives the public site key. Do not enable Firebase enforcement before the Settings status reports App Check active and legitimate traffic has been observed in Firebase metrics.
- Hosting CSP is expanded only for the Google/reCAPTCHA endpoints required by App Check.
- `src/core/schema.ts` now uses an explicit sequential migration registry scaffold. Current state remains schema v1; no user-data migration is performed by this release.
- New alpha features live in small modules (`privacy.ts`, `diagnostics.ts`) instead of expanding `main.ts` further.
- Package metadata is aligned to `logtogether@0.8.2`.
- `npm run clean:legacy` removes obsolete early-development `.pre-*` / `.bak-*` source snapshots. Run only after making the normal release backup.

## App Check rollout

The code defaults to `recaptcha-enterprise`, but `appCheckSiteKey` remains null in the shipped config. This is intentional so deploying v0.8.2 cannot accidentally lock out existing family users.

Recommended rollout:

1. Deploy v0.8.2 with the key still null and verify normal auth/sync.
2. Create/register the LogTogether web app for Firebase App Check with reCAPTCHA Enterprise.
3. Put the public site key into `public/config.js`.
4. Build/deploy Hosting again.
5. Verify Settings reports `Firebase App Check — Active · monitoring` on desktop and iPhone.
6. Observe Firebase App Check metrics during family alpha.
7. Only then consider enabling enforcement for Firestore.

## Validation

- TypeScript build passes.
- Unit/application suite: 110/110 passing.
- Firestore rules are unchanged, so this checkpoint does not require a new rules deployment.
