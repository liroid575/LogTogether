import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync("src/services/firebase-client.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");
const store = fs.readFileSync("src/core/store.ts", "utf8");

function between(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.ok(start >= 0, `missing ${startNeedle}`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(end > start, `missing ${endNeedle}`);
  return source.slice(start, end);
}

test("fresh Firebase mode uses an empty local state instead of demo records", () => {
  assert.match(main, /loadStateAsync\(!cloudModeEnabled\(\),/);
  const load = between(store, "export async function loadStateAsync", "function queueIndexedStateWrite");
  assert.match(load, /useDemoDefaults \? demoState\(\) : emptyState\(\)/);
  const empty = between(store, "export function emptyState", "export function demoState");
  assert.match(empty, /workouts: \[\]/);
  assert.match(empty, /hikes: \[\]/);
  assert.match(empty, /weightEntries: \[\]/);
  assert.match(empty, /entries: \[\]/);
});

test("Google identity seeds family name and avatar only once", () => {
  assert.match(client, /export async function seedGoogleMemberIdentity/);
  assert.match(client, /if \(!self \|\| self\.identitySeeded\) return membership/);
  assert.match(client, /displayName = \(user\.displayName/);
  assert.match(client, /if \(user\.photoURL\) patch\.photoURL = user\.photoURL/);
  assert.match(client, /identitySeeded: true/);
  assert.match(main, /this\.authUser\?\.photoURL/);
});

test("family administration lives in Settings instead of the Family page", () => {
  const family = between(main, "private renderFamily(): string", "private weightLineChart(): string");
  const settings = between(main, "private renderFamilyAccessSettings(): string", "private renderSettings(): string");
  assert.doesNotMatch(family, /id="create-invite-form"/);
  assert.doesNotMatch(family, /id="claim-invite-form"/);
  assert.match(settings, /id="create-invite-form"/);
  assert.doesNotMatch(settings, /id="claim-invite-form"/);
  assert.match(settings, /Cloud members & access/);
});

test("owner access changes update access and membership atomically", () => {
  const body = between(client, "export async function setFamilyMemberAccessStatus", "function parseCloudWorkout");
  assert.match(body, /writeBatch\(db\)/);
  assert.match(body, /batch\.update\(accessRef, \{ status \}\)/);
  assert.match(body, /batch\.update\(memberRef, \{ status \}\)/);
  assert.match(body, /await batch\.commit\(\)/);
});

test("v0.7 syncs hike metadata but keeps stories and media out of Firestore", () => {
  assert.match(client, /collection\(db, "workouts"\)/);
  assert.match(client, /collection\(db, "hydration"\)/);
  assert.match(client, /doc\(db, "bodyMetrics"/);
  assert.match(client, /collection\(db, "hikes"\)/);
  assert.match(client, /delete clone\.routePoints/);
  assert.match(client, /delete clone\.photoId/);
  assert.doesNotMatch(client, /doc\(db, "stories"/);
  assert.doesNotMatch(client, /collection\(db, "stories"/);
});
