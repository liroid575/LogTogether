import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildDiagnostics } from "../../dist/assets/core/diagnostics.js";
import { canMigrateStateVersion, migrateState } from "../../dist/assets/core/schema.js";

const read = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const main = read("src/main.ts");
const firebaseClient = read("src/services/firebase-client.ts");
const config = read("public/config.js");
const firebaseJson = read("firebase.json");
const sw = read("public/sw.js");

const fakeState = {
  schemaVersion: 1,
  user: { id: "SECRET_UID", familyId: "SECRET_FAMILY", displayName: "Secret Name" },
  locale: "en",
  theme: "dark",
  simpleMode: false,
  hydration: { schemaVersion: 1, date: "2026-09-13", userId: "SECRET_UID", familyId: "SECRET_FAMILY", targetMl: 2000, totalMl: 500, entries: [{ id: "w", at: "2026-09-13T01:00:00Z", ml: 500 }], visibility: "private" },
  hydrationHistory: [],
  supplementHistory: [{ date: "2026-09-13", entries: [{ id: "s", at: "2026-09-13T02:00:00Z", supplementId: "SECRET_SUPPLEMENT", amount: 1, unit: "tablet" }] }],
  workouts: [{ schemaVersion: 1, id: "workout", ownerId: "SECRET_UID", familyId: "SECRET_FAMILY", activityKind: "strength", routineName: "SECRET_WORKOUT", startedAt: "2026-09-13T01:00:00Z", completedAt: "2026-09-13T01:30:00Z", notes: "SECRET_NOTE", visibility: "family", selectedViewerIds: [], exercises: [] }],
  hikes: [{ schemaVersion: 1, id: "hike", ownerId: "SECRET_UID", familyId: "SECRET_FAMILY", activityKind: "hike", name: "SECRET_MOUNTAIN", date: "2026-09-13", distanceKm: 3, movingMinutes: 60, elapsedMinutes: 70, elevationGainM: 300, elevationLossM: 300, difficulty: 3, waterMl: 0, notes: "SECRET_HIKE_NOTE", visibility: "family", selectedViewerIds: [], routePoints: [{ lat: 25.123, lon: 121.456 }] }],
  activeWorkout: null,
  family: [],
  familyGoal: { targetActivities: 10, completedActivities: 0 },
  routines: [],
  profile: { weightEntries: [] },
  stories: [],
  sync: { deletedWorkoutIds: [], deletedHikeIds: [] }
};

test("v0.8.2 prepares App Check before Firebase services and keeps enforcement external", () => {
  assert.match(firebaseClient, /firebase-app-check\.js/);
  assert.match(firebaseClient, /ReCaptchaEnterpriseProvider/);
  assert.match(firebaseClient, /isTokenAutoRefreshEnabled:\s*true/);
  assert.match(firebaseClient, /await ensureAppCheck\(app\)/);
  assert.match(config, /appCheckProvider:\s*"recaptcha-enterprise"/);
  assert.match(config, /appCheckSiteKey:\s*"YOUR_APPCHECK_SITE_KEY"/);
  assert.match(firebaseJson, /https:\/\/www\.google\.com/);
  assert.match(firebaseJson, /https:\/\/recaptchaenterprise\.googleapis\.com/);
});

test("family alpha hides unfinished Stories UI while preserving the data model", () => {
  assert.doesNotMatch(main, /id="story-photo-input"/);
  assert.doesNotMatch(main, /data-view-story/);
  assert.match(main, /Features not enabled yet/);
  assert.match(main, /familyPrivacySummary/);
});

test("diagnostic export contains counts and states but no record contents or account identifiers", () => {
  const diagnostic = buildDiagnostics(fakeState, {
    appVersion: "0.8.2",
    storageBackend: "indexeddb",
    cloudMode: true,
    online: true,
    signedIn: true,
    rememberedOfflineAccount: true,
    familyActive: true,
    pendingCloudChanges: 2,
    cloudErrorAreas: ["workouts"],
    appCheckState: "active",
    appCheckProvider: "recaptcha-enterprise"
  });
  const raw = JSON.stringify(diagnostic);
  assert.equal(diagnostic.counts.workouts, 1);
  assert.equal(diagnostic.counts.hikes, 1);
  assert.equal(diagnostic.counts.supplementDays, 1);
  assert.equal(diagnostic.privacy.containsRecordContents, false);
  for (const secret of ["SECRET_UID", "SECRET_FAMILY", "Secret Name", "SECRET_WORKOUT", "SECRET_NOTE", "SECRET_SUPPLEMENT", "SECRET_MOUNTAIN", "25.123", "121.456"]) {
    assert.equal(raw.includes(secret), false, `diagnostics leaked ${secret}`);
  }
});

test("schema loader now has an explicit sequential migration scaffold and still fails closed", () => {
  assert.equal(canMigrateStateVersion(1), true);
  assert.equal(canMigrateStateVersion(2), false);
  assert.equal(migrateState({ schemaVersion: 999 }), null);
  assert.equal(migrateState(fakeState)?.schemaVersion, 1);
});

test("service worker advances to v0.8.2", () => {
  assert.match(sw, /logtogether-shell-v0\.9\.0/);
});
