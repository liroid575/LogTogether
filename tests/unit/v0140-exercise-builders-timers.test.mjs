import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  EXERCISE_LIBRARY_GROUPS,
  exerciseById,
  exerciseLaterality,
  exerciseStarterDefault
} from "../../dist/assets/core/exercises.js";
import { scienceWeekMetrics } from "../../dist/assets/core/analytics.js";

const main = await readFile(new URL("../../src/main.ts", import.meta.url), "utf8");
const styles = await readFile(new URL("../../public/styles.css", import.meta.url), "utf8");

function completedWorkout(id, completedAt, exerciseId, setCount) {
  return {
    schemaVersion: 1,
    id,
    ownerId: "u",
    familyId: "f",
    activityKind: "strength",
    routineName: id,
    startedAt: completedAt,
    completedAt,
    notes: "",
    visibility: "family",
    selectedViewerIds: [],
    exercises: [{
      id: `${id}-exercise`,
      exerciseId,
      restSec: 60,
      notes: "",
      recordingProfile: "sets",
      recordingProfileVersion: 2,
      sets: Array.from({length:setCount},(_,index)=>({id:`${id}-${index}`,completed:true,reps:8,setType:"normal"}))
    }]
  };
}

test("empty Sports / Other is not exposed and stretch schema is consistent", () => {
  assert.equal(EXERCISE_LIBRARY_GROUPS.includes("sports_other"), false);
  assert.equal(exerciseLaterality(exerciseById("downward_dog")), "none");
  assert.equal(exerciseLaterality(exerciseById("hamstring_stretch")), "per_side");
  assert.deepEqual(
    {sets:exerciseStarterDefault(exerciseById("downward_dog")).sets,durationSec:exerciseStarterDefault(exerciseById("downward_dog")).durationSec,restSec:exerciseStarterDefault(exerciseById("downward_dog")).restSec},
    {sets:2,durationSec:30,restSec:15}
  );
});

test("two chosen activities count distinct days and Gym requires four working sets", () => {
  const now = new Date("2026-09-17T12:00:00+08:00");
  const fourGymSets = completedWorkout("gym", "2026-09-15T10:00:00+08:00", "barbell_bench_press", 4);
  const threeGymSets = completedWorkout("short", "2026-09-16T10:00:00+08:00", "barbell_bench_press", 3);
  const cycling = completedWorkout("ride", "2026-09-17T10:00:00+08:00", "cycling", 1);
  cycling.exercises[0].recordingProfile = "cardio_session";
  cycling.exercises[0].sets[0].durationSec = 1200;
  cycling.exercises[0].sets[0].reps = undefined;
  const goals = {weeklyCalories:0,categorySets:{},difficulty:"hard",personalActivityId:"gym",personalActivityIds:["gym","cycling"]};
  assert.equal(scienceWeekMetrics([fourGymSets,threeGymSets,cycling],[],goals,undefined,[],now).personalSessions,2);
});

test("builders, History, family dates and zero-rest behavior remain visible in source", () => {
  assert.match(main, /id="workout-composer-mode"/);
  assert.match(main, /data-routine-drag/);
  assert.match(main, /data-circuit-drag/);
  assert.match(main, /exercise\.restSec > 0 && this\.profileUsesRest/);
  assert.match(main, /data-history-filter="live"/);
  assert.match(main, /data-history-filter="logged"/);
  assert.match(main, /family-workout-date-divider/);
  assert.match(styles, /\.family-workout-date-divider/);
});
