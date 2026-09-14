# LogTogether Auth/Reset Fix v0.2.2

This patch changes only the Auth checkpoint and local reset behavior.

- Fixes Google popup/redirect initialization by using Firebase `getAuth()` and explicit browser-local persistence.
- In Firebase development mode, **Clear local test data** now creates an empty local record set instead of reseeding demo workouts/water/weight/hikes.
- Google Auth session is not cleared by this action.
- Demo mode still retains the intentional demo reset behavior.
- Removes automatic insertion of a routine into intentionally empty states.
- Bumps the service-worker cache key so browsers pick up the corrected Auth client.
- Firestore remains uninitialized and receives zero workout/health writes at this checkpoint.
