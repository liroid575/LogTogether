# Security

## Current status

LogTogether is currently a **family-testing alpha**.

Firebase Authentication, Firestore synchronization, family access controls, group-scoped sharing, Cloud Functions, notifications, and social features are being exercised in a development environment.

The project is not yet presented as a public production service.

Passing automated tests is a release requirement, but those tests should not be interpreted as a formal independent security audit.

## Security principles

### Deny by default

Unknown Firestore collections and unsupported access paths are denied rather than implicitly trusted.

### Server-side authorization

UI controls are not security boundaries.

Firestore Security Rules and server-side Cloud Function checks determine whether an authenticated user may read or modify Cloud data.

Hiding a button or page in the browser is never treated as sufficient authorization.

### Immutable security identity

Ownership and family identity cannot be transferred merely by editing a stored record.

Authorization tests cover attempts to:

- change record ownership;
- change family identity;
- edit another member's records;
- reactivate revoked access;
- promote privileges;
- bypass invitation rules.

### Family membership is not blanket access

Being part of a family does not automatically expose every record.

Shared resources are constrained by:

- family identity;
- active membership;
- visibility;
- group membership where applicable;
- ownership;
- explicit sharing rules.

Revoked members lose access to family-visible resources.

### Sensitive data is separated

Records with different privacy requirements are kept separate rather than combined into one broadly readable document.

Examples include:

- account settings;
- body metrics;
- exact hydration records;
- exact supplement entries;
- private workout records;
- precise hiking route data;
- local media.

Family-facing features use explicitly shared records or bounded aggregate summaries where appropriate.

For example, family progress can expose limited weekly or daily totals without exposing all of the underlying private records used to calculate them.

### Local media and precise route data

Current workout-photo storage and precise GPX route data remain device-local.

Cloud hiking synchronization uses limited metadata rather than automatically uploading the original precise route.

Cloud-hosted private media should not be enabled until its authorization, retention, deletion, and access model have been separately reviewed and tested.

### Browser configuration and secrets

Firebase browser configuration is client-visible by design.

A Firebase web API key or project identifier in browser configuration must not be treated as a secret or authorization mechanism.

The following must never be committed to the repository:

- Firebase service-account credentials;
- private VAPID keys;
- administrative credentials;
- private API tokens;
- personal family-testing data;
- exported authentication credentials;
- other server-side secrets.

Private server material should use the deployment platform's supported secret-management mechanism.

### App Check

Firebase App Check is an abuse-reduction mechanism, not the primary authorization boundary.

Authentication, Firestore Rules, server-side validation, API restrictions, quotas, and monitoring remain necessary even when App Check is enabled.

## Automated tests

The normal build and regression suite is:

```bash
npm test
