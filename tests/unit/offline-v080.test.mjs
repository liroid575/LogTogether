import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const main = read("src/main.ts");
const store = read("src/core/store.ts");
const types = read("src/core/types.ts");
const sw = read("public/sw.js");

test("v0.8 remembers the last authenticated UID for cold offline launch", () => {
  assert.match(store, /OFFLINE_ACCOUNT_KEY = "logtogether:offline-account:v1"/);
  assert.match(store, /export function preferredCloudScope/);
  assert.match(main, /const offlineAccount = cloudModeEnabled\(\) \? loadRememberedOfflineAccount\(\) : null/);
  assert.match(main, /const localScope = cloudModeEnabled\(\) \? preferredLocalScope\(\) : ""/);
  assert.match(main, /rememberOfflineAccount\(user, true\)/);
  assert.match(main, /approved Cloud account may keep using its UID-scoped local cache while/);
});

test("explicit sign out stops automatic local-account reopening", () => {
  assert.match(main, /google-sign-out/);
  assert.match(main, /forgetRememberedOfflineAccount\(\)/);
  assert.match(main, /rememberLocalScope\(this\.localScope \|\| "guest"\)/);
  assert.match(main, /this\.cloudAccessRequested = Boolean\(this\.pendingInviteCode\)/);
});

test("offline companion changes are queued before cloud availability checks", () => {
  const pref = main.indexOf("private async pushPreferencesToCloud");
  const profile = main.indexOf("private async pushProfileToCloud");
  const hydration = main.indexOf("private async pushHydrationToCloud");
  const supplement = main.indexOf("private async pushSupplementDayToCloud");
  assert.ok(pref >= 0 && profile > pref && hydration > profile && supplement > hydration);
  const prefBlock = main.slice(pref, profile);
  const profileBlock = main.slice(profile, hydration);
  const hydrationBlock = main.slice(hydration, supplement);
  const supplementBlock = main.slice(supplement, main.indexOf("private async refreshFamilyProgress", supplement));
  assert.ok(prefBlock.indexOf("preferencesDirty=true") < prefBlock.indexOf("if (!this.authUser"));
  assert.ok(profileBlock.indexOf("profileDirty=true") < profileBlock.indexOf("if (!this.authUser"));
  assert.ok(hydrationBlock.indexOf("hydrationDirtyDates") < hydrationBlock.indexOf("if (!this.authUser"));
  assert.ok(supplementBlock.indexOf("supplementDirtyDates") < supplementBlock.indexOf("if (!this.authUser"));
});

test("offline deletion keeps tombstones even without a live Firebase user", () => {
  assert.match(main, /removed\.cloudSyncedAt && removed\.ownerId === this\.effectiveLocalUid\(\)/);
  assert.match(main, /deletedWorkoutIds\.push\(removed\.id\)/);
  assert.match(main, /deletedHikeIds\.push\(removed\.id\)/);
});

test("sync status exposes pending changes and reconnect retry", () => {
  assert.match(types, /lastSuccessfulSyncAt\?: string/);
  assert.match(main, /pendingCloudChangesCount/);
  assert.match(main, /window\.addEventListener\("online"/);
  assert.match(main, /refreshCloudMembership\(this\.authUser\)/);
  assert.match(main, /Saved locally; cloud sync failed and will retry later/);
  assert.match(main, /Reconnect Cloud/);
});

test("v0.8 provides account-bound JSON backup and import rollback", () => {
  assert.match(store, /format: "logtogether-backup"/);
  assert.match(store, /createLocalBackup/);
  assert.match(store, /parseLocalBackup/);
  assert.match(store, /This backup belongs to a different LogTogether account/);
  assert.match(store, /saveImportRollback/);
  assert.match(main, /data-action="export-local-backup"/);
  assert.match(main, /id="local-backup-import"/);
});

test("service worker advances to v0.8.0", () => {
  assert.match(sw, /logtogether-shell-v0\.9\.0/);
});
