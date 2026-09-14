# LogTogether authorization model — v0.2

This milestone hardens authorization before any real Firebase project is created.

## Roles

- `owner`: manages family metadata, invitations, and member active/revoked status.
- `member`: normal family participant.
- Ownership **does not** grant access to another person's private records.

## Membership index

`access/{uid}` is a minimal authorization index containing only:

- `schemaVersion`
- `familyId`
- `role`
- `status`
- `inviteId`

A mirrored `families/{familyId}/members/{uid}` document powers the family UI.
Status changes must update both documents in one atomic batch.

## Bootstrap

V1 deliberately does not allow arbitrary client-side family creation or owner creation.
The first owner/family is bootstrapped out-of-band once. All later members join through invites.

## Invite claim

An owner creates a pending invite for a lowercase email. The invite expires in at most 7 days.

A claim is one atomic transaction/batch that:

1. creates `access/{uid}`;
2. creates `families/{familyId}/members/{uid}`;
3. changes the invite from `pending` to `claimed` with the same authenticated UID.

Rules verify a Google/Firebase-authenticated email is verified and matches the invited email.
Partial claims, expired invites, wrong emails, and reuse are denied.

## Private data

The following are owner-only in V1:

- `users/{uid}` account/settings
- `hydration/*`
- `bodyMetrics/*` (height/weight)
- `personalGoals/*`

Family ownership does not override this.

## Shareable data

Workouts, hikes, routines and badges support:

- `private`
- `family`
- `selected`

Selected viewers must still be active members of the same family, so adding an outsider UID to
`selectedViewerIds` does not grant that outsider access.

## Stories

Story documents contain metadata only. They are readable by active family members only while
`expiresAt > request.time`. New stories may be at most 24 hours long.

Media storage and actual deletion are intentionally deferred to the private-media milestone.

## Revocation

The owner can change an ordinary member between `active` and `revoked`, but the mirrored access
and membership documents must change atomically. Members cannot reactivate or promote themselves.

A revoked member cannot create/modify family resources or read family-visible records. They may
still authenticate and access/delete their own existing private data; disabling a compromised
Google/Firebase account is a separate authentication-level action.

## Default deny

Any collection that does not have an explicit rule is inaccessible. New features must add both an
authorization policy and emulator tests before use.
