import test from "node:test";
import assert from "node:assert/strict";
import { EXERCISES } from "../../dist/assets/core/exercises.js";

test("exercise library is broad enough for the exercise picker", () => {
  assert.ok(EXERCISES.length >= 40, `expected at least 40 exercises, got ${EXERCISES.length}`);
});

test("exercise IDs are stable and unique", () => {
  const ids = EXERCISES.map(exercise => exercise.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const exercise of EXERCISES) {
    assert.ok(exercise.names.en.length > 0);
    assert.ok(exercise.names["zh-TW"].length > 0);
  }
});

test("library supports all V1 measurement types", () => {
  const types = new Set(EXERCISES.map(exercise => exercise.type));
  for (const required of ["weight_reps", "reps", "duration", "distance_time"]) {
    assert.ok(types.has(required), `missing ${required}`);
  }
});

test("calisthenics library includes common bodyweight movements", () => {
  const ids = new Set(EXERCISES.map(exercise => exercise.id));
  for (const id of ["push_up","pull_up","chin_up","dips","bodyweight_squat","lying_leg_raise","burpee","handstand_hold"]) {
    assert.ok(ids.has(id), `missing ${id}`);
  }
});
