import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const client = read("src/services/firebase-client.ts");
const main = read("src/main.ts");
const store = read("src/core/store.ts");
const types = read("src/core/types.ts");
const sw = read("public/sw.js");

function between(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.ok(start >= 0, `missing ${startNeedle}`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(end > start, `missing ${endNeedle}`);
  return source.slice(start, end);
}

test("v0.7 syncs workouts and hike metadata while stripping precise local-only hike data", () => {
  assert.match(client, /export async function loadCloudWorkouts/);
  assert.match(client, /export async function saveCloudWorkout/);
  assert.match(client, /export async function deleteCloudWorkout/);
  assert.match(client, /export async function loadCloudHikes/);
  assert.match(client, /export async function saveCloudHike/);
  assert.match(client, /export async function deleteCloudHike/);
  assert.match(client, /delete clone\.photoId/);
  assert.match(client, /delete clone\.routePoints/);
  assert.match(client, /delete clone\.routeSource/);
});

test("workout and hike family queries are constrained so Firestore rules can prove visibility", () => {
  const workoutLoader = between(client, "export async function loadCloudWorkouts", "export async function saveCloudWorkout");
  assert.match(workoutLoader, /where\("ownerId", "==", user\.uid\)/);
  assert.match(workoutLoader, /visibleSharedMemberIds\(user, membership\)/);
  assert.match(workoutLoader, /loadSharedDocsByOwner\("workouts"/);
  assert.match(workoutLoader, /\[\["familyId", "==", membership\.access\.familyId\], \["visibility", "==", "family"\]\]/);
  const hikeLoader = between(client, "export async function loadCloudHikes", "export async function saveCloudHike");
  assert.match(hikeLoader, /where\("ownerId", "==", user\.uid\)/);
  assert.match(hikeLoader, /visibleSharedMemberIds\(user, membership\)/);
  assert.match(hikeLoader, /loadSharedDocsByOwner\("hikes"/);
  assert.match(hikeLoader, /\[\["familyId", "==", membership\.access\.familyId\], \["visibility", "==", "family"\]\]/);
});

test("local browser caches are separated by Firebase UID and guest mode", () => {
  assert.match(store, /SCOPED_STORAGE_PREFIX = "logtogether:state:v1:"/);
  assert.match(main, /const localScope = cloudModeEnabled\(\) \? preferredLocalScope\(\) : ""/);
  assert.match(main, /const targetScope = `uid:\$\{user\.uid\}`/);
  assert.match(main, /rememberLocalScope\(this\.localScope \|\| "guest"\)/);
  assert.match(main, /saveState\(this\.state, this\.localScope \|\| undefined\)/);
});

test("clear-local-data writes to the active account scope", () => {
  assert.match(store, /clearLocalTestState\(current: AppState, scope\?: string\)/);
  assert.match(store, /saveState\(next, scope\)/);
  assert.match(main, /clearLocalTestState\(this\.state, this\.localScope \|\| undefined\)/);
});

test("workout and hike deletion use durable local tombstones", () => {
  assert.match(types, /deletedWorkoutIds\?: string\[\]/);
  assert.match(types, /deletedHikeIds\?: string\[\]/);
  assert.match(main, /new Set\(this\.state\.sync\.deletedWorkoutIds \?\? \[\]\)/);
  assert.match(main, /new Set\(this\.state\.sync\.deletedHikeIds/);
  assert.match(main, /deleteCloudWorkout/);
  assert.match(main, /deleteCloudHike/);
});

test("family comparison uses daily aggregates while family profiles gain weekly summaries", () => {
  assert.match(main, /familyWeeklySeries/);
  assert.match(main, /cloudFamilyDaily/);
  assert.match(main, /cloudFamilyWeekly/);
  assert.match(main, /Weekly achievements/);
});

test("new and explicitly re-saved workouts share to Family while cloud sync preserves stored visibility", () => {
  assert.match(store, /visibility: "family"[\s\S]*selectedViewerIds: \[\][\s\S]*exercises: \[\]/);
  assert.doesNotMatch(main, /id="workout-visibility"/);
  assert.match(main, /workout\.visibility = "family"/);

  const parser = between(
    client,
    "function parseCloudWorkout",
    "function firestoreWorkoutPayload"
  );
  assert.match(parser, /visibility: data\.visibility/);

  const payload = between(
    client,
    "function firestoreWorkoutPayload",
    "export async function loadCloudWorkouts"
  );
  assert.match(payload, /\.\.\.clone/);
  assert.doesNotMatch(payload, /clone\.visibility\s*=\s*"family"/);

  const loader = between(
    client,
    "export async function loadCloudWorkouts",
    "export async function saveCloudWorkout"
  );
  assert.match(loader, /\["visibility", "==", "family"\]/);

  assert.doesNotMatch(main, /Choose Family to include this workout in family comparisons/);
});

test("legacy anonymous local state can be claimed once without leaking between Google accounts", () => {
  assert.match(store, /LEGACY_CLAIM_KEY/);
  assert.match(store, /legacyOwner === uid \|\| legacyOwner === "local_user"/);
  assert.match(store, /localStorage\.setItem\(LEGACY_CLAIM_KEY, uid\)/);
  assert.doesNotMatch(store, /legacyOwner === "demo_user"/);
  assert.match(main, /previousUserId === user\.uid \|\| previousUserId === "local_user"/);
});
