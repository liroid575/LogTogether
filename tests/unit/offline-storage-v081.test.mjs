import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const main = read("src/main.ts");
const store = read("src/core/store.ts");
const sw = read("public/sw.js");

test("v0.8.1 moves structured account state into an IndexedDB account store", () => {
  assert.match(store, /STRUCTURED_DB_NAME = "logtogether-structured-v1"/);
  assert.match(store, /STRUCTURED_STORE = "accountStates"/);
  assert.match(store, /indexedDB\.open\(STRUCTURED_DB_NAME, STRUCTURED_DB_VERSION\)/);
  assert.match(store, /createObjectStore\(STRUCTURED_STORE, \{ keyPath: "scope" \}\)/);
});

test("legacy localStorage state is backed up, written and verified before removal", () => {
  const migration = store.slice(store.indexOf("async function migrateLegacyStateToIndexedDb"), store.indexOf("export async function loadStateAsync"));
  const backup = migration.indexOf("localStorage.setItem(backupKey, raw)");
  const write = migration.indexOf("await writeIndexedStateRaw(scope, raw)");
  const verify = migration.indexOf("const verified = await readIndexedStateRaw(scope)");
  const remove = migration.indexOf("localStorage.removeItem(scopedStorageKey(scope))");
  assert.ok(backup >= 0 && write > backup && verify > write && remove > verify);
  assert.match(migration, /if \(verified !== raw\) throw new Error\("IndexedDB migration verification failed\."\)/);
});

test("migration rollback is temporary and removed after a later verified IndexedDB boot", () => {
  assert.match(store, /one-time migration survived a restart/);
  assert.match(store, /localStorage\.removeItem\(migrationBackupKey\(scope\)\)/);
  assert.match(store, /During the first post-migration session keep the rollback copy current/);
});

test("every save journals synchronously before the asynchronous IndexedDB write", () => {
  const save = store.slice(store.indexOf("export function saveState"), store.indexOf("export function resetState"));
  assert.ok(save.indexOf("localStorage.setItem(stateJournalKey(scope), raw)") < save.indexOf("queueIndexedStateWrite(raw, scope)"));
  assert.match(store, /app\/browser was killed mid-write/);
  assert.match(store, /if \(localStorage\.getItem\(journalKey\) === journal\) localStorage\.removeItem\(journalKey\)/);
});

test("IndexedDB failure can recover from the v0.8 localStorage path or migration backup", () => {
  assert.match(store, /readLegacyStateRaw\(scope\) \?\? localStorage\.getItem\(migrationBackupKey\(scope\)\)/);
  assert.match(store, /markStorageBackend\(scope, "localstorage"\);\n    return loadState\(useDemoDefaults, scope\)/);
  assert.match(main, /Local database: localStorage fallback/);
});

test("application bootstrap and account switching await the asynchronous local database", () => {
  assert.match(main, /const state = await loadStateAsync\(!cloudModeEnabled\(\), localScope \|\| undefined\)/);
  assert.match(main, /private async switchLocalScope\(scope: string\): Promise<void>/);
  assert.match(main, /const nextState = await loadStateAsync\(false, scope\)/);
  assert.match(main, /await this\.promoteLocalDataToCloud\(user, membership\)/);
  assert.match(main, /await saveStateVerified\(merged, targetScope\)/);
});

test("settings expose the active local structured-storage backend", () => {
  assert.match(main, /localStructuredStorageBackend\(this\.localScope \|\| undefined\)/);
  assert.match(main, /Local database: IndexedDB ✓/);
  assert.match(main, /Local database: localStorage fallback/);
});

test("service worker advances to v0.8.1", () => {
  assert.match(sw, /logtogether-shell-v0\.9\.0/);
});
