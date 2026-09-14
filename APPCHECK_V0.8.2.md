# LogTogether v0.8.2 — App Check activation

This micro-patch activates the reCAPTCHA Enterprise App Check integration already present in v0.8.2 by setting the public site key in `public/config.js`.

It does **not** enable Firebase App Check enforcement and does not change Firestore Security Rules.

After deploying Hosting, reopen LogTogether online and check Settings → Family alpha readiness. Firebase App Check should report `Active · monitoring`.

Test normal sign-in, sync, a write, and family reads on both desktop and iPhone before considering enforcement in Firebase Console.
