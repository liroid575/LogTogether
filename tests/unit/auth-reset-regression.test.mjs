import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("firebase auth initialization keeps browser popup resolver through getAuth", () => {
  const source = fs.readFileSync("src/services/firebase-client.ts", "utf8");
  assert.match(source, /loadedAuthModule\.getAuth\(app\)/);
  assert.match(source, /setPersistence\(auth, loadedAuthModule\.browserLocalPersistence\)/);
});

test("firebase-mode clear path does not reseed demo records", () => {
  const source = fs.readFileSync("src/core/store.ts", "utf8");
  const start = source.indexOf("export function clearLocalTestState");
  assert.ok(start >= 0);
  const body = source.slice(start, source.indexOf("export function createBlankWorkout", start));
  assert.match(body, /workouts: \[\]/);
  assert.match(body, /hikes: \[\]/);
  assert.match(body, /hydrationHistory: \[\]/);
  assert.match(body, /routines: \[\]/);
  assert.match(body, /weightEntries: \[\]/);
  assert.doesNotMatch(body, /demoState\(/);
});
