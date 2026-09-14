# LogTogether v0.3.2 — hosted/mobile fixes

This checkpoint fixes issues revealed by the first Firebase Hosting + iPhone PWA test.

## Changes

- Firebase Hosting CSP now permits Google's `apis.google.com` loader used by Firebase federated auth.
- On the stable `YOUR_AUTH_DOMAIN` origin, Firebase Auth uses that same Hosting domain as `authDomain`; localhost retains the existing `firebaseapp.com` auth domain.
- No `unsafe-inline` is added to CSP.
- Dynamic UI geometry/colors no longer depend on HTML `style="..."` attributes. The app applies specific CSS properties after render instead, preserving strict CSP.
- Accent preset circles render their colors again.
- Weekly water chart gets a dedicated plot area so the goal line no longer overlaps bar labels/values.
- Circuit builder now exposes the entire exercise library, including duration, weighted, distance/time, and mobility exercises, with appropriate target fields.
- All active family-member cards are clickable. Non-self members open a shared-profile shell for future badges and 7-day calorie comparison.
- The shared-profile shell deliberately does not invent progress data while workout/badge cloud sync is still disabled.
- Service-worker cache bumped to `logtogether-shell-v0.3.2`.

## Security boundary

This patch does not modify Firestore rules, the authorization schema, or enable workout/health synchronization. `firestore.rules` and the security tests are byte-for-byte unchanged from v0.3.1.

Signed-out/local activity remains browser-local only (localStorage/IndexedDB). It is not uploaded to Firestore. Cloud family data remains protected by Firebase Authentication and Firestore Security Rules.
