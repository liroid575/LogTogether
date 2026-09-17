# LogTogether v0.7.3 polish

Focused cleanup after v0.7.2.

## Fixed

### Stale hiking badges in Family
Older badge sync was additive: saving the current badges updated/created documents but did not remove a cloud hiking badge when its source hike had already disappeared locally. This could leave deleted test badges visible on another family member's account.

v0.7.3 reconciles the signed-in user's cloud **hiking** badge set against the current local badge set during companion sync. Cloud hiking badges that no longer correspond to a current visible hiking badge are deleted. Monthly badges are not pruned by this cleanup.

After deployment, open/sync the account that owns the stale badges once. Then refresh/sync the other family account.

### Completed Water month appearance
The Water calendar's completed-month state now matches the History calendar treatment:
- blue border
- subtle blue fade into the card background

It no longer looks like a border-only test state.

## Temporary test controls
The v0.7.2 temporary calendar preview controls are intentionally still present in v0.7.3 so this visual can be verified. They can be removed in the next feature update as planned.

## Backend/security
- No Firestore rules changes.
- No schema changes.
- Existing badge delete permissions are reused.

## Validation
- `npm test`: 86/86 passed.
