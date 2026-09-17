// Copy this file to config.local.js to enable Cloud mode:
//
//   cp config.example.js config.local.js
//
// Then replace the placeholders with values from YOUR Firebase project.
//
// For Google redirect sign-in, authDomain should normally be your Firebase
// Hosting domain. Make sure the corresponding OAuth client authorizes:
//
//   https://YOUR_AUTH_DOMAIN/__/auth/handler
//
// Firebase Web configuration and the public Web Push key are client-visible;
// never put service-account credentials, private VAPID keys, or other server
// secrets in this file.
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
  appCheckSiteKey: "",
  pushPublicKey: "",
  feedbackFormUrl: ""
};
