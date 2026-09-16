# v0.11.3 one-time Google Auth setup

v0.11.3 changes Firebase Auth to the same origin as the deployed app so redirect fallback works reliably in Safari/private browsing.

Before testing Google sign-in, verify these two settings once:

1. Firebase Console -> Authentication -> Settings -> Authorized domains
   - `YOUR_AUTH_DOMAIN` must be present.

2. Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client IDs -> the Web client used by Firebase Authentication
   - Add this exact Authorized redirect URI:

     `https://YOUR_AUTH_DOMAIN/__/auth/handler`

Keep the existing `firebaseapp.com` redirect URI as well. Do not remove it.

This is a provider configuration change, not a new secret and not a recurring deployment step.
