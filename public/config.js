// LogTogether development runtime configuration.
// Firebase Web config is public client configuration, not an admin secret.
// Authorization is enforced by Firebase Auth + Security Rules. App Check is initialized when a site key is configured.
//
// v0.11.3+ uses the Firebase Hosting origin as authDomain so redirect fallback
// remains same-origin in Safari/private browsers. The Google OAuth client must
// authorize https://YOUR_AUTH_DOMAIN/__/auth/handler once.
window.__LOGTOGETHER_CONFIG__ = {
  mode: "firebase",
  firebase: {
    projectId: "YOUR_PROJECT_ID",
    appId: "YOUR_APP_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    apiKey: "YOUR_FIREBASE_WEB_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID"
  },
  appCheckProvider: "recaptcha-enterprise",
  appCheckSiteKey: "YOUR_APPCHECK_SITE_KEY",
  // Replaced by deploy.sh with the deployment's public Web Push VAPID key.
  pushPublicKey: "YOUR_PUBLIC_VAPID_KEY",
  // Optional external feedback form (Google Forms / forms.gle recommended).
  // Leave blank until the owner creates the form; no Firebase resources are used.
  feedbackFormUrl: ""
};
