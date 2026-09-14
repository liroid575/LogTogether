# LogTogether v0.8.3 UI polish preview 2

Localhost-only follow-up on the previous v0.8.3 UI/workout preview. No Firestore rules, indexes, or Firebase service code were changed.

## Small fixes in this preview

- Active-workout dock buttons work from Home as well as the other tabs.
- Workout timer stays idle while choosing exercises and starts from the first set Start/Finish action.
- Normal set removal uses a less distracting text action instead of a trash icon beside Start/Finish.
- Starting a workout, saved routine, hike, or circuit performs a monthly weight check. Missing weight prompts every time; an existing weight only needs review once per calendar month.
- Supplement information search is neutral: uses/evidence/side effects/interactions/risks.
- Today has a neutral grey calendar fill in History and Water until a goal-completion style overrides it.
- Settings starts with the user's profile/photo and an Edit profile button.
- Exercise picker now has an Exercise type filter while preserving the original eight body/activity category optgroups.
- Exercise types: All, Gym, Calisthenics, Outdoor / Cardio, Mobility / Yoga / Stretching, Swimming / Lifesaving, Kickboxing / Boxing, Sports / Other.
- Swimming/lifesaving and kickboxing/boxing have their own exercise-type filters.
- Basketball, badminton and tennis were removed because they do not fit the current set/rest recording model cleanly.

## Validation

- TypeScript/build completed successfully.
- Focused exercise/analytics/circuit tests: 16/16 passed.

This remains a localhost UX preview. Do not deploy it over the working v0.8.2 family alpha yet; the v0.8.3 Cloud/groups authorization migration still needs its security validation before deployment.
