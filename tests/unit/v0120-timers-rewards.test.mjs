import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  completedActiveSeconds,
  goalsForWeek,
  hasRecordedWork,
  rememberWeekPlan,
  workTargetSeconds
} from "../../dist/assets/core/training.js";

const require = createRequire(import.meta.url);
const { reconcileGoldReward } = require("../../functions/gold-rewards.js");

test("timed exercise profiles count down from their configured duration", () => {
  assert.equal(workTargetSeconds({ id:"s", completed:false, durationSec:20 }, "isometric_sets"), 20);
  assert.equal(workTargetSeconds({ id:"s", completed:false, durationSec:60 }, "static_stretch"), 60);
  assert.equal(workTargetSeconds({ id:"s", completed:false, durationSec:60 }, "conditioning_intervals"), 60);
  assert.equal(workTargetSeconds({ id:"s", completed:false, reps:10 }, "sets"), 0);
  assert.equal(workTargetSeconds({ id:"s", completed:false, durationSec:60, targetWorkSec:45 }, "static_stretch"), 45);
});

test("actual elapsed time wins over a planned duration", () => {
  const set = { id:"s", completed:true, durationSec:60, actualDurationSec:22 };
  assert.equal(completedActiveSeconds(set), 22);
  assert.equal(hasRecordedWork(set), true);
  assert.equal(hasRecordedWork({ ...set, actualDurationSec:0 }), false);
});

test("weekly difficulty snapshots keep old weeks stable", () => {
  const goals = { difficulty:"normal", personalActivityId:"any" };
  rememberWeekPlan(goals, "2026-09-14");
  goals.difficulty = "hard";
  goals.personalActivityId = "jump_rope";
  rememberWeekPlan(goals, "2026-09-21");
  assert.equal(goalsForWeek(goals,"2026-09-14").difficulty,"normal");
  assert.equal(goalsForWeek(goals,"2026-09-21").difficulty,"hard");
});

test("Gold reward deletion revokes and restoration reconciles exactly once", () => {
  const earned = reconcileGoldReward(null,{balance:0},true,false);
  assert.deepEqual({balance:earned.balance,debt:earned.correctionDebt,notify:earned.notify},{balance:1,debt:0,notify:true});
  const removed = reconcileGoldReward(earned.ledger,{balance:0},false,false);
  assert.deepEqual({balance:removed.balance,debt:removed.correctionDebt},{balance:0,debt:1});
  const restored = reconcileGoldReward(removed.ledger,{balance:0,correctionDebt:1},true,false);
  assert.deepEqual({balance:restored.balance,debt:restored.correctionDebt,notify:restored.notify},{balance:0,debt:0,notify:false});
  assert.equal(reconcileGoldReward(restored.ledger,{balance:0},true,false),null);
});

test("a full wallet does not create a future revocation debt", () => {
  const earned = reconcileGoldReward(null,{balance:7},true,false);
  assert.equal(earned.balance,7);
  assert.equal(earned.ledger.applied,false);
  const removed = reconcileGoldReward(earned.ledger,{balance:7},false,false);
  assert.deepEqual({balance:removed.balance,debt:removed.correctionDebt},{balance:7,debt:0});
});
