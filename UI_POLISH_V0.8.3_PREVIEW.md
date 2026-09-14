# LogTogether v0.8.3 UI/workout polish preview

This preview layers a UI/workout polish pass on top of the v0.8.3 Local/Cloud groups development branch. It is intended for localhost UX testing before the v0.8.3 authorization model is deployed.

## Included polish

- LogTogether brand button always returns Home.
- Settings reordered around common interface controls, security, Local/Cloud, groups, and expandable low-frequency tools.
- Standard water target is 2,000 mL; overrides live under **Special needs?**.
- Own Family card has a direct **Edit profile** action.
- Workout trend and weekly water can move one full week backward/forward.
- Exercise picker is grouped into Gym, Calisthenics, Outdoor/Cardio, Mobility/Yoga/Stretching, and Sports/Other.
- Exercise library expanded with additional gym/calisthenics/mobility/cardio movements plus swimming strokes, lifesaving drills, jump-rope work, kickboxing and sports.
- Exercise metadata + Google image examples use one compact row rather than duplicating the exercise name.
- Rest targets are editable; `0` means count-up.
- Active workout timer/rest timer is persistent in a floating dock across app tabs.
- Completed sets lock after later work has started.
- Unfinished workout dock says **Discard workout** and uses confirmation; **Finish workout** appears after all sets are complete.
- Circuit builder now starts a workout directly, supports removing movements/rounds, shares image-example treatment, and records per-set effort 1–5 while rest continues.
- Supplements have a **View more** Google-search link.

## Validation performed

- TypeScript/build completed successfully.
- Focused exercise/analytics unit tests: 13/13 passed.
- No Firestore emulator/security suite was run for this UI preview.

## Important

The v0.8.3 Local/Cloud group authorization work remains a development branch. Use this archive for localhost UI/workout testing. Do not deploy it over the working v0.8.2 family alpha until the group authorization migration and Firestore rules have been fully validated.
