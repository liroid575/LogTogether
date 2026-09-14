# LogTogether v0.3.1 — Family management cleanup

This checkpoint keeps health/activity data local-only. Firestore is still limited to authorization, family membership, invitations, and presentation metadata.

## Changes

- Moves **Join family**, **Invite family member**, and **Members & access** from the Family tab to **Settings → Family & access**.
- Adds owner-only **Remove access** and **Restore access**. Both `access/{uid}` and `families/{familyId}/members/{uid}` are changed in one Firestore batch.
- Fresh Firebase-mode browsers start empty instead of receiving the old demo workout/water/weight/hike dataset.
- Seeds each member's default family name from Firebase/Google `displayName` and default avatar from Firebase/Google `photoURL` once.
- Existing v0.3 members are migrated lazily by their own account the next time they load the app. `identitySeeded` prevents Google defaults from overwriting later custom names.
- The personal profile falls back to the Google avatar until a local custom photo is selected.
- Editing your profile name also updates your family presentation name in Firestore.
- Tightens invite-claim rules to exact authorization/member document shapes and adds one-time Google identity-seed constraints.
- Custom profile photos remain local-only until private cloud media storage is implemented. Other family members see the Google avatar for now.

## Security boundary

Still no Firestore client code for:

- workouts
- hydration
- body metrics / weight
- hikes
- routines
- stories
- photos/media

## Required order

1. Apply patch.
2. Run `npm test` — expected **31/31**.
3. Run `mise exec -- npm run test:security` — expected **27/27**.
4. Deploy rules only: `npx firebase deploy --only firestore:rules --project YOUR_PROJECT_ID`.
5. Rebuild/start the app and hard refresh.
6. Reload each Google account once so its own Google display name/avatar can seed safely.
7. Use Settings → Family & access to test revoke/restore with the alt account.

Do not serve the patched app against the old rules before step 4, because v0.3.1 adds the one-time `identitySeeded`/`photoURL` presentation fields.
