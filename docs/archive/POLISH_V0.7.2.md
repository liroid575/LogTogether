# LogTogether v0.7.2 — badges, missions and dev tools

Focused polish/dev-tools checkpoint on top of v0.7.1.

## Changes

### Water navigation icon
- Bottom Water tab now uses only the water-drop icon.
- Its size is reset to the same 20 px treatment as the other bottom navigation icons.

### Editable hiking badges
On your own Profile → Hiking badges you can now:
- Rename a hiking badge.
- Move it earlier/later in the badge order.
- Remove an accidental/bugged badge without deleting the underlying hike record.
- Existing local hike photos still appear on your own badge card when available.

Badge name/order/removal preferences sync through the account and the resulting family-visible badge records are updated.

Family-clickable badge photos are intentionally not added in this checkpoint. Existing photos are local-only; sharing them correctly needs a private media/Cloud Storage layer rather than placing image data in Firestore.

### Firebase capacity panel
Settings now shows a small Firebase capacity panel:
- Approximate serialized LogTogether sync payload visible to this account.
- Firestore no-cost stored-data quota reference: 1 GiB.
- Rough remaining headroom against that quota.
- Hosting no-cost storage reference: 10 GB.
- Links to the Firebase console.

The estimate is deliberately labelled as approximate. Firestore index/metadata overhead, other family members' documents, old documents and retained Hosting releases are not measurable accurately from the normal browser client.

### Temporary calendar completion previews
Settings → Temporary test tools now has two session-only preview toggles:
- History calendar: preview the completed-month gold treatment.
- Water calendar: preview the perfect-month blue treatment.

These do not write records, award badges, or sync anything. Reloading the app turns them off.

### Weekly mission model
Weekly missions are now always **10 missions**:
1. Hit daily exercise-calorie target on enough days for the selected difficulty.
2. Hit the hydration target on all 7 days.
3–10. Reach the target for each of the 8 exercise categories.

Calorie-day requirement by difficulty:
- Easy: 3 days
- Normal: 5 days
- Hard: 6 days
- Extreme: 7 days

The visible weekly score is always `/10`.

Older v0.7.0/v0.7.1 family weekly summaries using the former 20/22-point model are converted to the new 10-mission presentation until that family member syncs again.

### Monthly badge
- Monthly badge target is now **35 completed weekly missions**.
- History monthly progress is shown as `/35`.

## Cloud/security
- No Firestore Security Rules change in v0.7.2.
- Hiking badge presentation preferences are stored in the existing owner-only preferences document.
- Family-visible badge title/order uses the existing family-visible badge collection.

## Validation
- Full reconstructed application/unit suite: **83/83 passed**.
- No Firestore emulator/security suite rerun because `firestore.rules` is unchanged.
