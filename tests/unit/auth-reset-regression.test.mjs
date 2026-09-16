import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("firebase auth initialization keeps popup/redirect resolver with persistence fallbacks", () => {
  const source = fs.readFileSync("src/services/firebase-client.ts", "utf8");
  assert.match(source, /loadedAuthModule\.initializeAuth\(firebaseApp/);
  assert.match(source, /indexedDBLocalPersistence/);
  assert.match(source, /browserLocalPersistence/);
  assert.match(source, /browserSessionPersistence/);
  assert.match(source, /popupRedirectResolver: loadedAuthModule\.browserPopupRedirectResolver/);
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
