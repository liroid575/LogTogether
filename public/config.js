// LogTogether development runtime configuration.
// Firebase Web config is public client configuration, not an admin secret.
// Authorization is enforced by Firebase Auth + Security Rules. App Check is initialized when a site key is configured.
//
// Keep the Firebase-provisioned auth domain while using signInWithPopup().
// The previous v0.3.2 web.app authDomain required a matching OAuth redirect URI
// and caused redirect_uri_mismatch before that provider-side configuration existed.
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
  appCheckSiteKey: "YOUR_APPCHECK_SITE_KEY"
};
