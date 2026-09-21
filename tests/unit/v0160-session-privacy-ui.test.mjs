import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EXERCISES } from "../../dist/assets/core/exercises.js";
import { elapsedSeconds, hmsToSeconds, secondsToHms, sanitizePerformanceMetrics, sessionMetricAvailability } from "../../dist/assets/core/session-metrics.js";

const text = async path => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("v0.16 keeps the stable catalogue and derives activity-specific tracker fields", () => {
  assert.equal(EXERCISES.length, 156);
  const byId=id=>EXERCISES.find(item=>item.id===id);
  assert.equal(sessionMetricAvailability(byId("cycling")).averagePower,true);
  assert.equal(sessionMetricAvailability(byId("swim_freestyle")).poolLength,true);
  assert.equal(sessionMetricAvailability(byId("rowing_machine")).strokeRate,true);
  assert.equal(sessionMetricAvailability(byId("barbell_bench_press")).distance,false);
});

test("session time helpers preserve whole-second precision and reject invalid intervals", () => {
  assert.equal(hmsToSeconds(1,25,36),5136);
  assert.deepEqual(secondsToHms(5136),{hours:1,minutes:25,seconds:36});
  assert.equal(hmsToSeconds(0,60,0),undefined);
  assert.equal(elapsedSeconds("2026-09-20T01:00:00Z","2026-09-20T02:25:36Z"),5136);
  assert.equal(elapsedSeconds("2026-09-20T02:00:00Z","2026-09-20T01:00:00Z"),undefined);
});

test("performance metrics are bounded and contain no heart-rate field", () => {
  const metrics=sanitizePerformanceMetrics({distanceKm:31.42,averagePowerWatts:174,maximumSpeedKph:999});
  assert.deepEqual(metrics,{distanceKm:31.42,maximumSpeedKph:500,averagePowerWatts:174});
  assert.equal("averageHeartRateBpm" in (metrics ?? {}),false);
});

test("heart rate has an owner-only document, rules and diagnostics boundary", async () => {
  const [main,client,rules,diagnostics]=await Promise.all([text("src/main.ts"),text("src/services/firebase-client.ts"),text("firestore.rules"),text("src/core/diagnostics.ts")]);
  assert.match(client,/collection\(db, "privateWorkoutMetrics"\)/);
  assert.match(client,/saveCloudPrivateWorkoutMetrics/);
  assert.match(rules,/match \/privateWorkoutMetrics\/\{metricsId\}/);
  assert.match(rules,/resource\.data\.ownerId == request\.auth\.uid/);
  assert.match(main,/this\.renderWorkoutPerformance\(workout,false\)/);
  assert.match(diagnostics,/containsHealthMetrics: false/);
});

test("family activity, nested disclosures, chronology and fresh discard behavior are explicit", async () => {
  const main=await text("src/main.ts");
  assert.match(main,/Recent activity/);
  assert.match(main,/recentActivities[\s\S]*sort\(\(a,b\)=>b\.at\.localeCompare\(a\.at\)\)/);
  assert.match(main,/family-workout-date-divider/);
  assert.match(main,/data-exercise-detail/);
  assert.match(main,/detail\.hidden=expanded/);
  assert.match(main,/stayInComposer/);
  assert.match(main,/createBlankWorkout\(/);
  assert.match(main,/\.sort\(\(a,b\)=>a\.at\.localeCompare\(b\.at\)\)/);
});

test("momentum, shared pickers and release markers are present", async () => {
  const [main,css,pkg,sw]=await Promise.all([text("src/main.ts"),text("public/styles.css"),text("package.json"),text("public/sw.js")]);
  assert.equal(JSON.parse(pkg).version,"0.16.0");
  assert.match(main,/APP_VERSION = "0\.16\.0"/);
  assert.match(sw,/logtogether-shell-v0\.16\.0/);
  assert.match(main,/renderMomentumTrack/);
  assert.match(main,/data-dev-momentum="\$\{value\}"/);
  assert.match(main,/Gold \+ Momentum queue/);
  assert.match(css,/\.momentum-track/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(main,/renderExerciseOptions\(filter/);
  assert.doesNotMatch(main,/v0\.10 chooses/);
});
