// Safe default runtime configuration for source checkouts.
//
// This file is tracked and intentionally starts LogTogether in Local mode.
// To use Cloud features, create config.local.js from config.example.js and
// configure your own Firebase development project.
//
// scripts/build.sh uses config.local.js as dist/config.js when the local
// override exists. config.local.js is ignored by Git.
window.__LOGTOGETHER_CONFIG__ = {
  mode: "demo",
  firebase: null,
  appCheckProvider: "recaptcha-enterprise",
  appCheckSiteKey: "",
  pushPublicKey: "",
  feedbackFormUrl: ""
};
