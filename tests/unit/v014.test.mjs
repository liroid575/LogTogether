import test from "node:test";
import assert from "node:assert/strict";
import { hydrationGoalDaysThisWeek, weeklyHydrationSeries, weeklyGoalScore } from "../../dist/assets/core/analytics.js";
import { workoutFromRoutine } from "../../dist/assets/core/store.js";

function water(date, totalMl, targetMl=2000) {
  return { schemaVersion:1, date, userId:"u", familyId:"f", targetMl, totalMl, entries:[], visibility:"private" };
}

function state() {
  return {
    schemaVersion:1,
    user:{id:"u",familyId:"f",displayName:"Me"}, locale:"en", theme:"dark", simpleMode:true,
    hydration:water("2026-09-12",2200), workouts:[], hikes:[], activeWorkout:null, family:[],
    familyGoal:{targetActivities:0,completedActivities:0}
  };
}

test("circuit routine expands one movement into each configured round", () => {
  const routine = {
    id:"r", name:"Daily Circuit", mode:"circuit", rounds:4,
    exercises:[
      {exerciseId:"pull_up",restSec:30,sets:[{reps:7}]},
      {exerciseId:"push_up",restSec:30,sets:[{reps:25}]},
      {exerciseId:"bodyweight_squat",restSec:30,sets:[{reps:40}]}
    ]
  };
  const workout = workoutFromRoutine(state(), routine);
  assert.equal(workout.routineMode, "circuit");
  assert.equal(workout.circuitRounds, 4);
  assert.deepEqual(workout.exercises.map(e => e.sets.length), [4,4,4]);
  assert.deepEqual(workout.exercises.map(e => e.sets[0].reps), [7,25,40]);
});

test("weekly hydration keeps seven calendar days and goal hits", () => {
  const current = water("2026-09-12",2200);
  const history = [water("2026-09-07",2100),water("2026-09-08",1500),water("2026-09-09",2500),water("2026-09-10",0),water("2026-09-11",2050)];
  const now = new Date("2026-09-12T12:00:00");
  const series = weeklyHydrationSeries(current, history, now);
  assert.equal(series.length, 7);
  assert.deepEqual(series.map(p=>p.count), [2100,1500,2500,0,2050,2200,0]);
  assert.equal(hydrationGoalDaysThisWeek(current, history, now), 4);
});

test("hydration is one of ten weekly missions and completes at seven goal days", () => {
  const current = water("2026-09-13",2200);
  const history = [
    water("2026-09-07",2100), water("2026-09-08",2200), water("2026-09-09",2500),
    water("2026-09-10",2000), water("2026-09-11",2050), water("2026-09-12",2300)
  ];
  const goals = { weeklyCalories:3500, categorySets:{} };
  const result = weeklyGoalScore([],[],70,goals,current,history,new Date("2026-09-13T12:00:00"));
  assert.equal(result.waterDays,7);
  assert.equal(result.waterMissionDone,true);
  assert.equal(result.score,1);
});
