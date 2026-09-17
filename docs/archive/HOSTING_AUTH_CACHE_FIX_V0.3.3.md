# LogTogether v0.3.3 — Hosting Auth + iOS Cache Fix

This patch fixes two hosting-only regressions found during iPhone/PWA testing.

## Auth

v0.3.2 changed `authDomain` to `YOUR_AUTH_DOMAIN` without also registering
`https://YOUR_AUTH_DOMAIN/__/auth/handler` in the Google OAuth client.
Google therefore rejected the popup with `redirect_uri_mismatch`.

v0.3.3 keeps the existing `signInWithPopup()` flow and uses Firebase's provisioned
`YOUR_AUTH_DOMAIN` auth domain, whose redirect handler is already wired
for the Firebase project. This avoids adding another OAuth configuration surface while
we are still on the development Hosting domain.

## PWA cache

- Bumps the shell cache to `logtogether-shell-v0.3.3`.
- Network requests bypass the browser HTTP cache (`cache: no-store`) before falling back
  to the offline Cache API.
- Development Hosting sends `Cache-Control: no-store, max-age=0, must-revalidate`.
- The service worker explicitly ignores Firebase Hosting's reserved `/__/` namespace.
- CSP permits same-origin Firebase helper frames without adding `unsafe-inline`.

The Firestore rules and application data model are unchanged.
