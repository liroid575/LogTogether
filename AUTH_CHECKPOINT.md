# LogTogether v0.2.1 — Google Auth checkpoint

This checkpoint enables Firebase Authentication only.

It deliberately does **not** initialize Cloud Firestore and does not upload workouts,
hikes, hydration, weight, photos, routines, goals, or stories.

Expected test flow:

1. Enable Google provider in Firebase Authentication.
2. Add `localhost` under Authentication → Settings → Authorized domains.
3. Build and serve LogTogether at `http://localhost:4173`.
4. Settings → Continue with Google.
5. Confirm the signed-in Google name/email/UID appears.
6. Refresh the page and confirm the session persists.
7. Sign out and confirm it returns to the signed-out state.

If Google reports `auth/unauthorized-domain`, verify `localhost` is authorized in the
`YOUR_PROJECT_ID` Firebase project.
