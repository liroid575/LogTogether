import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { scienceWeekMetrics } from "../../dist/assets/core/analytics.js";
import { exerciseById } from "../../dist/assets/core/exercises.js";

const completedWorkout = (exerciseId, completedAt) => ({
  schemaVersion: 1,
  id: `${exerciseId}-${completedAt}`,
  ownerId: "owner",
  familyId: "family",
  activityKind: "strength",
  routineName: "Test",
  startedAt: new Date(Date.parse(completedAt) - 20 * 60_000).toISOString(),
  completedAt,
  notes: "",
  visibility: "private",
  selectedViewerIds: [],
  exercises: [{
    id: `entry-${exerciseId}`,
    exerciseId,
    restSec: 0,
    notes: "",
    sets: [{ id: "set-1", completed: true, durationSec: 20 * 60 }]
  }]
});

const goals = personalActivityId => ({
  weeklyCalories: 0,
  categorySets: {},
  difficulty: "normal",
  personalActivityId
});

test("chosen-activity progress requires one supported specific activity", () => {
  const now = new Date("2026-09-17T12:00:00+08:00");
  const workouts = [
    completedWorkout("cycling", "2026-09-15T10:00:00+08:00"),
    completedWorkout("run", "2026-09-16T10:00:00+08:00"),
    completedWorkout("jump_rope_basic", "2026-09-17T10:00:00+08:00")
  ];

  assert.equal(scienceWeekMetrics(workouts, [], goals("cycling"), undefined, [], now).personalSessions, 1);
  assert.equal(scienceWeekMetrics(workouts, [], goals("running"), undefined, [], now).personalSessions, 1);
  assert.equal(scienceWeekMetrics(workouts, [], goals("none"), undefined, [], now).personalSessions, 0);
  assert.equal(scienceWeekMetrics(workouts, [], goals("any"), undefined, [], now).personalSessions, 0);
  assert.equal(scienceWeekMetrics(workouts, [], goals("jump_rope"), undefined, [], now).personalSessions, 0);
});

test("jump-rope exercises appear in the intended practical library groups", () => {
  assert.equal(exerciseById("jump_rope_basic")?.group, "home_functional");
  assert.equal(exerciseById("jump_rope_single_unders")?.group, "gym");
  assert.equal(exerciseById("jump_rope_double_unders")?.group, "gym");
});

test("v0.13 family detail, routine, photo and iPhone safeguards remain wired", () => {
  const main = fs.readFileSync(new URL("../../src/main.ts", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../../public/styles.css", import.meta.url), "utf8");
  const client = fs.readFileSync(new URL("../../src/services/firebase-client.ts", import.meta.url), "utf8");

  assert.match(main, /supplementEntries/);
  assert.match(client, /CloudWeeklySupplementEntry/);
  assert.match(main, /Choose a saved routine/);
  assert.match(main, /historyUndo/);
  assert.match(main, /releaseWorkoutInputFocus/);
  assert.match(main, /renderPhotoLightbox/);
  assert.match(css, /object-fit:\s*contain/);
});
