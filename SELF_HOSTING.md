# Self-hosting LogTogether

LogTogether can run in two modes:

- **Local mode** — no Firebase project is required.
- **Cloud mode** — uses a Firebase project owned by the person hosting it.

A self-hosted installation should never use another family's Firebase backend.

## Local mode

Local mode requires Node.js 22.x, npm, and Git.

Clone the repository:

    git clone https://github.com/liroid575/LogTogether.git
    cd LogTogether

Install the locked development dependencies:

    npm ci

Build and serve the application:

    npm run build
    npm run serve

Then open http://localhost:4173.

Local mode does not require Firebase Authentication, Firestore, Cloud Functions,
or Firebase Hosting.

Application data remains in the browser unless Cloud mode is configured.

## Cloud mode

Cloud mode adds features such as Google authentication, cross-device sync,
family sharing, Cloud-backed authorization, Cloud Functions, Pokes, and
Web Push notifications.

Each self-hosted Cloud installation should use its **own Firebase project**.

### Firebase setup

Create a Firebase project under your own Firebase/Google account and configure
the services required by the features you intend to use.

These may include:

- Firebase Authentication
- Cloud Firestore
- Firebase Hosting
- Cloud Functions
- App Check
- Web Push

For Google Authentication, enable the Google sign-in provider and configure
only the authorized domains you actually use.

### Local configuration

Copy the example configuration:

    cp config.example.js config.local.js

Then edit config.local.js with the Firebase Web App configuration for your own
Firebase project.

config.local.js is intentionally ignored by Git.

Firebase browser configuration is client-visible by design. It identifies the
Firebase project but is not an administrative credential or authorization
mechanism.

Do not place server-side secrets in browser configuration.

### Cloud Functions

Install the Functions dependencies:

    npm --prefix functions ci

Private server-side values such as private VAPID material should use the
deployment platform's secret-management features rather than source control.

### Testing

Before deployment, run the repository's application tests, Firestore
authorization tests, release consistency checks, and dependency audits.

### Deployment

Always specify the Firebase project explicitly when deploying.

Example:

    PROJECT_ID="your-firebase-project-id"
    ./node_modules/.bin/firebase deploy --project "$PROJECT_ID" \
      --only hosting,firestore:rules,firestore:indexes,functions

Using an explicit project ID reduces the chance of deploying to the wrong
Firebase project.

### Live verification

After deployment, the repository's live verifier can check a site that is
explicitly provided to it.

Example:

    LOGTOGETHER_DEPLOY_URL="https://your-site.web.app" npm run verify:live

The verifier is read-only. It does not deploy or modify the site.

## Keeping installations separate

Cloning LogTogether does not grant access to:

- the maintainer's Firebase project
- the maintainer's family data
- deployment credentials
- private configuration
- the canonical repository's write access

Each Cloud installation is expected to use its own Firebase project and its
own configuration.

The maintainer's family deployment is not a public demo backend.

## Secrets and private data

Do not commit:

- config.local.js
- Firebase service-account credentials
- private VAPID keys
- private API tokens
- administrative credentials
- private keys
- authentication exports
- real family data exports
- precise private route data

Use synthetic data in public examples, screenshots, issues, and tests.

## Updating

See docs/guides/UPGRADE.md for release-update and rollback guidance.

## Security

Read SECURITY.md before exposing a Cloud installation to other users.
