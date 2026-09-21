# Security

LogTogether is a family-oriented, self-hostable application that handles data
with different privacy requirements.

The project uses automated authorization and regression tests, but those tests
should not be interpreted as a formal independent security audit.

## Supported versions

Security fixes are normally made against the latest release and the current
development branch.

Older historical releases may remain available for reference but should not be
assumed to receive security updates.

## Security model

### Server-side authorization

UI controls are not security boundaries.

Cloud access is enforced through Firestore Security Rules and server-side
Cloud Function checks. Hiding a button or page in the browser is never treated
as sufficient authorization.

### Deny by default

Unknown Firestore collections and unsupported access paths are denied rather
than implicitly trusted.

### Family membership is not blanket access

Being a member of a family does not automatically make every record readable.

Access may depend on ownership, active membership, family identity, group
membership, visibility, and explicit sharing rules.

Revoked members lose access to family-visible Cloud data.

### Sensitive data is separated

Records with different privacy requirements are kept separate where possible.

Examples include account settings, body metrics, hydration details, exact
supplement records, heart-rate data, private workout records, precise hiking
routes, and local media.

Family-facing features use explicitly shared records or bounded summaries
instead of exposing all underlying private records.

### Local media and precise routes

Workout media and precise GPX route data currently remain device-local.

Cloud hiking synchronization uses limited metadata rather than automatically
uploading the original precise route.

### Browser configuration and secrets

Firebase browser configuration is client-visible by design and must not be
treated as an authorization mechanism or administrative secret.

Never commit:

- Firebase service-account credentials
- private VAPID keys
- administrative credentials
- private API tokens
- exported authentication credentials
- private keys
- real family-testing exports
- other server-side secrets

Server-side secrets should use the deployment platform's supported secret
management.

### App Check

Firebase App Check is an abuse-reduction mechanism, not the primary
authorization boundary.

Authentication, Firestore Security Rules, server-side validation, API
restrictions, quotas, and monitoring remain necessary.

## Reporting a vulnerability

Do not publish suspected vulnerabilities, credentials, authentication tokens,
invitation codes, health records, family data, or precise location data in a
public issue.

Use the repository's private security reporting channel when available.

Use synthetic or redacted data when demonstrating a problem.

## Automated checks

The repository includes:

- application and regression tests
- Firestore authorization tests
- release consistency checks
- dependency audits

The main test commands are documented in the repository and CI configuration.

Passing automated checks reduces regression risk but does not prove that the
application is vulnerability-free.

## Self-hosting responsibility

Each self-hosted installation is responsible for its own Firebase project,
authentication configuration, authorized domains, App Check configuration,
API restrictions, quotas, billing controls, secrets, backups, and user access.

A clone of LogTogether should never depend on the maintainer's family Firebase
project.
