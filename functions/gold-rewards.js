"use strict";
// Pure ledger arithmetic. Called only inside the Firestore transaction.
// correctionDebt remembers a revoked token that was already spent.
function reconcileGoldReward(previous, wallet = {}, eligible, unlimited = false) {
  let balance = Math.max(0, Math.min(7, Math.trunc(Number(wallet.balance) || 0)));
  let correctionDebt = Math.max(0, Math.trunc(Number(wallet.correctionDebt) || 0));
  if (previous && previous.schemaVersion !== 2) return null; // No attribution for legacy awards.
  if (previous?.eligible === eligible || (!previous && !eligible)) return null;
  const first = !previous;
  const credited = previous ? previous.credited === true : !unlimited && (balance < 7 || correctionDebt > 0);
  const applied = eligible && credited && (balance < 7 || correctionDebt > 0);
  if (eligible ? applied : previous?.applied === true) {
    if (eligible) {
      if (correctionDebt > 0) correctionDebt -= 1;
      else balance = Math.min(7, balance + 1);
    } else if (balance > 0) balance -= 1;
    else correctionDebt += 1;
  }
  return { balance, correctionDebt, ledger: {schemaVersion:2, eligible, credited, applied}, notify:first && eligible };
}
module.exports = { reconcileGoldReward };
