import test from "node:test";
import assert from "node:assert/strict";
import { workoutsInCurrentWeek, weeklyWorkoutSeries, categoryDistributionForDate, estimateWorkoutCalories, monthlyCalorieSeries } from "../../dist/assets/core/analytics.js";

function workout(id, completedAt, exerciseId = "barbell_bench_press") {
  return {
    schemaVersion: 1, id, ownerId: "u", familyId: "f", activityKind: "strength", routineName: "Test",
    startedAt: new Date(new Date(completedAt).getTime() - 30 * 60000).toISOString(), completedAt,
    notes: "", visibility: "private", selectedViewerIds: [],
    exercises: [{ id: `e-${id}`, exerciseId, restSec: 90, notes: "", sets: [{ id: `s-${id}`, completed: true, reps: 10 }] }]
  };
}

test("weekly count is derived from records so deletion changes it immediately", () => {
  const now = new Date("2026-09-12T12:00:00");
  const records = [workout("a", "2026-09-10T10:00:00"), workout("b", "2026-09-11T10:00:00")];
  assert.equal(workoutsInCurrentWeek(records, now), 2);
  assert.equal(workoutsInCurrentWeek(records.filter(w => w.id !== "a"), now), 1);
});

test("weekly series reflects stored workouts only", () => {
  const now = new Date("2026-09-12T12:00:00");
  const records = [workout("a", "2026-09-10T10:00:00"), workout("b", "2026-09-02T10:00:00")];
  const series = weeklyWorkoutSeries(records, 2, now);
  assert.deepEqual(series.map(p => p.count), [1, 1]);
});

test("calendar distribution uses primary and secondary training credits", () => {
  const records = [workout("a", "2026-09-10T10:00:00", "barbell_bench_press")];
  const slices = categoryDistributionForDate(records, [], "2026-09-10");
  const counts = Object.fromEntries(slices.map(slice => [slice.category, slice.count]));
  assert.equal(counts.chest, 1);
  assert.equal(counts.arms, 0.5);
  assert.equal(counts.shoulders, 0.5);
});

test("calendar distribution always includes all eight categories, including zeroes", () => {
  const slices = categoryDistributionForDate([], [], "2026-09-10");
  assert.equal(slices.length, 8);
  assert.ok(slices.every(slice => slice.count === 0));
});


test("calorie estimate scales with body weight and recorded difficulty", () => {
  const moderate = workout("cal", "2026-09-10T11:00:00");
  moderate.startedAt = "2026-09-10T10:00:00";
  moderate.exercises[0].difficulty = 3;
  const hard = structuredClone(moderate);
  hard.estimatedCalories = undefined;
  hard.exercises[0].difficulty = 5;
  assert.ok(estimateWorkoutCalories(moderate, 80) > estimateWorkoutCalories(moderate, 70));
  assert.ok(estimateWorkoutCalories(hard, 70) > estimateWorkoutCalories(moderate, 70));
});

test("short high-effort resistance volume contributes calories even when wall-clock time is tiny", () => {
  const record = workout("volume", "2026-09-10T10:00:20.000Z");
  record.startedAt = "2026-09-10T10:00:00.000Z";
  record.exercises[0].difficulty = 5;
  record.exercises[0].sets = Array.from({length:3},(_,index)=>({
    id:`set-${index}`, completed:true, reps:10,
    startedAt:`2026-09-10T10:00:${String(index*5).padStart(2,"0")}.000Z`,
    completedAt:`2026-09-10T10:00:${String(index*5+4).padStart(2,"0")}.000Z`
  }));
  assert.ok(estimateWorkoutCalories(record, 70) >= 10);
});


test("monthly calorie series is a true 12-month window and shifts by month", () => {
  const records = [workout("jan", "2026-01-15T10:00:00"), workout("feb", "2026-02-15T10:00:00")];
  const janWindow = monthlyCalorieSeries(records, [], 70, new Date(2026, 0, 1), 12);
  assert.equal(janWindow.length, 12);
  assert.equal(janWindow[0]?.key, "2026-01");
  assert.equal(janWindow[11]?.key, "2026-12");
  assert.ok((janWindow[0]?.count ?? 0) > 0);
  const febWindow = monthlyCalorieSeries(records, [], 70, new Date(2026, 1, 1), 12);
  assert.equal(febWindow[0]?.key, "2026-02");
  assert.equal(febWindow[11]?.key, "2027-01");
});


test("short completed workouts use exact elapsed time instead of rounding to zero minutes", () => {
  const record = workout("short", "2026-09-10T10:00:20.000Z");
  record.startedAt = "2026-09-10T10:00:00.000Z";
  record.exercises[0].difficulty = 3;
  assert.ok(estimateWorkoutCalories(record, 70) >= 1);
});

test("legacy zero calorie snapshots are repaired instead of remaining stuck at zero", () => {
  const record = workout("repair", "2026-09-10T10:02:00.000Z");
  record.startedAt = "2026-09-10T10:00:00.000Z";
  record.estimatedCalories = 0;
  record.exercises[0].difficulty = 3;
  assert.ok(estimateWorkoutCalories(record, 70) > 0);
});
