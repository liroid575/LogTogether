# Security model

## Principles

1. **Deny by default.** Unknown Firestore paths are explicitly denied.
2. **Server-side authorization.** UI hiding is never treated as a security boundary.
3. **Ownership is immutable.** A record owner cannot be changed by editing a document.
4. **Family membership is not blanket access.** Records are `private`, `family`, or `selected`.
5. **Sensitive categories are separated.** Hydration/body/diet data must not share a document with a family-visible activity summary because Firestore authorizes whole documents.
6. **No analytics or ad SDKs.** None are installed.
7. **No admin credentials in the browser.** Firebase service-account keys must never enter this repository or `config.js`.
8. **Cloud writes stay disabled until access bootstrap/invitation tests pass.** This is intentional in milestone 0.1.

## Current milestone

The UI runs in local demo mode. `firestore.rules` and emulator tests define the intended authorization boundary, but production Google sign-in/invitation claiming is not enabled yet.

## Before production

- Run `npm run test:security` and require all tests to pass.
- Implement and test the invitation claim flow.
- Enable Google Authentication only.
- Enable Firebase App Check with reCAPTCHA Enterprise after observing metrics, then enforce it.
- Use a separate Firebase development project and production project.
- Review CSP after Google sign-in is enabled; do not weaken it with `unsafe-eval`.
- Test account removal/export and backup restore.
- Never deploy rules containing `allow read, write: if true` or broad `request.auth != null` access.
