"use strict";

// Pure policy shared by the callable function and unit tests. Roles are
// deliberately absent: owners and members spend from the same bounded wallet.
function assessPokeSpend({balance, lastSentAtMs = 0, nowMs, cooldownMs}) {
  const current = Math.max(0, Math.min(7, Math.trunc(Number(balance) || 0)));
  if (lastSentAtMs && nowMs - lastSentAtMs < cooldownMs) {
    return {allowed:false, reason:"cooldown", current, next:current};
  }
  if (current < 1) return {allowed:false, reason:"balance", current, next:current};
  return {allowed:true, reason:null, current, next:current - 1};
}

module.exports = { assessPokeSpend };
