# Upgrading LogTogether

LogTogether releases are identified by Git tags such as `v0.16.0`.

Self-hosted installations should normally upgrade between tagged releases
rather than arbitrary historical commits.

## Before upgrading

Before changing versions:

1. Read the release notes in `docs/releases/`.
2. Back up important application data.
3. Preserve your ignored `config.local.js`.
4. Confirm the Firebase project ID used by the installation.
5. Do not copy another installation's Firebase configuration.

## Fetch available releases

    git fetch --tags --prune

List versions:

    git tag --sort=-version:refname

## Select a release

For example:

    git switch --detach v0.16.0

The ignored `config.local.js` remains machine-local and is not supplied by
the public repository.

## Reinstall locked tooling

    npm ci
    npm --prefix functions ci

Using the lockfiles ensures the release is tested with the dependency
versions recorded for that version.

## Validate before deployment

Run the release consistency check, application tests, Firestore authorization
tests, and dependency audits before deploying a new version.

The exact maintained commands are listed in `package.json` and the repository
CI workflow.

## Build

    npm run build
    npm run verify:deploy-config

## Deploy

Always specify the intended Firebase project explicitly.

Example:

    PROJECT_ID="your-firebase-project-id"
    ./node_modules/.bin/firebase deploy --project "$PROJECT_ID" \
      --only hosting,firestore:rules,firestore:indexes,functions

Using an explicit project ID reduces the chance of deploying to the wrong
Firebase environment.

## Verify the live installation

Provide the deployed site explicitly:

    LOGTOGETHER_DEPLOY_URL="https://your-site.web.app" npm run verify:live

The live verifier is read-only.

## Rollback

If a new release has a regression, check out the previous known-good tag,
reinstall its locked dependencies, rebuild it, and deploy that version to the
same Firebase project.

Before rolling back across a release that changes stored data, read the release
notes for both versions. A newer data migration may not always be safely
interpreted by substantially older application code.

## Maintainer release flow

The canonical repository uses:

    main
        stable release history

    vX.Y.Z-dev
        active development for the next release

A development branch is tested first. Once accepted, it is promoted to `main`,
tagged, and verified.

Normal release development should not rewrite or force-push `main`.
