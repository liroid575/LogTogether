import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { exerciseById, exerciseLoggingProfile, exerciseMuscleWeights, exerciseSessionMetricFlags } from "../../dist/assets/core/exercises.js";
import { weeklyCategorySets, categoryDistributionForDate } from "../../dist/assets/core/analytics.js";

const mainSource = fs.readFileSync(new URL("../../src/main.ts", import.meta.url), "utf8");
const swSource = fs.readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

function record(exerciseId, sets, difficulty = 3) {
  return {
    schemaVersion: 1,
    id: `w-${exerciseId}`,
    ownerId: "u",
    familyId: "f",
    activityKind: "strength",
    routineName: "Test",
    startedAt: "2026-09-14T09:00:00.000Z",
    completedAt: "2026-09-14T10:00:00.000Z",
    notes: "",
    visibility: "private",
    selectedViewerIds: [],
    exercises: [{ id: `e-${exerciseId}`, exerciseId, restSec: 90, notes: "", difficulty, sets }]
  };
}

test("activity-aware profiles give machines, mobility and boxing suitable logging modes", () => {
  assert.equal(exerciseLoggingProfile(exerciseById("treadmill")), "cardio_session");
  assert.equal(exerciseLoggingProfile(exerciseById("stationary_bike")), "cardio_session");
  assert.equal(exerciseLoggingProfile(exerciseById("hamstring_stretch")), "mobility_session");
  assert.equal(exerciseLoggingProfile(exerciseById("kickboxing_rounds")), "rounds");
  assert.equal(exerciseLoggingProfile(exerciseById("barbell_bench_press")), "sets");
  const treadmill = exerciseSessionMetricFlags(exerciseById("treadmill"));
  assert.equal(treadmill.distance, true);
  assert.equal(treadmill.speed, true);
  assert.equal(treadmill.incline, true);
  assert.equal(treadmill.resistance, false);
  assert.equal(treadmill.laps, false);
});

test("normalized muscle display weights remain separate from mission training credits", () => {
  const weights = exerciseMuscleWeights(exerciseById("barbell_bench_press"));
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);

  assert.ok(Math.abs(total - 1) < 1e-9);
  assert.ok(weights.chest > weights.arms);
  assert.ok(weights.arms > weights.shoulders);

  const workout = record("barbell_bench_press", [
    { id: "s1", completed: true, reps: 10 },
    { id: "s2", completed: true, reps: 10 },
    { id: "s3", completed: true, reps: 10 }
  ]);

  const credit = weeklyCategorySets(
    [workout],
    new Date("2026-09-14T12:00:00.000Z")
  );

  assert.equal(credit.chest, 3);
  assert.equal(credit.arms, 1.5);
  assert.equal(credit.shoulders, 1.5);
});

test("cardio and mobility credit stay separate from strength muscles", () => {
  const treadmill = record("treadmill", [{
    id: "run", completed: true, durationSec: 3600,
    startedAt: "2026-09-14T09:00:00.000Z", completedAt: "2026-09-14T09:20:00.000Z"
  }]);
  const credit = weeklyCategorySets([treadmill], new Date("2026-09-14T12:00:00.000Z"));
  assert.equal(credit.cardio, 1);
  for (const category of ["chest","back","shoulders","arms","legs","core"]) assert.equal(credit[category], 0);
});

test("calendar exercise mix uses the same weighted contribution model", () => {
  const workout = record("push_up", [{ id: "s", completed: true, reps: 10 }]);
  const mix = Object.fromEntries(categoryDistributionForDate([workout], [], "2026-09-14").map(item => [item.category, item.count]));
  assert.ok(mix.chest > mix.arms);
  assert.ok(mix.arms > 0);
  assert.ok(mix.shoulders > 0);
  assert.ok(mix.core > 0);
});

test("persistent workout UI is tied to started state and owner access defaults to clean view", () => {
  assert.match(mainSource, /!this\.workoutHasStarted\(workout\)/);
  assert.match(mainSource, /const active = this\.workoutHasStarted\(\) \? this\.state\.activeWorkout : null/);
  assert.match(mainSource, /data-action="continue-workout"/);
  assert.match(mainSource, /data-action="discard-workout"/);
  assert.match(mainSource, /familyAccessEditing = false/);
  assert.match(mainSource, /toggle-member-access-edit/);
});
