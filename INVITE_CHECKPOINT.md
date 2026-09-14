# LogTogether v0.3.0-dev invite checkpoint

## Security boundary
Firestore is initialized only after a signed-in user needs family authorization.
The client code touches only `access`, `families`, `members`, and `invites`.
Health/activity data remains browser-local.

## Owner flow
1. Signed-in bootstrapped owner loads `access/{uid}`.
2. Family page loads family metadata and active members.
3. Owner enters the exact Google email of the intended member.
4. Client creates a pending invite with a six-day expiry.
5. Security rules require the caller to be the active family owner.

## Member claim flow
1. Intended recipient signs in with Google.
2. Recipient enters the invite document ID/code.
3. Client validates verified email and invite basics.
4. One Firestore WriteBatch creates `access/{uid}`, creates the family member
   document, and changes the invite from pending to claimed.
5. Deployed rules use `getAfter()` to require that bundle atomically.

Wrong email, unverified email, expired/revoked/reused invite, or incomplete
membership writes remain blocked by the deployed v0.2 rule set.
