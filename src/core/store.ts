import type { AppState, HikeRecord, HydrationDay, SupplementDay, WeightEntry, WorkoutExerciseEntry, WorkoutRecord, WorkoutRoutine } from "./types.js";
import { migrateState } from "./schema.js";

const STORAGE_KEY = "family-exercise:state:v1";
const SCOPED_STORAGE_PREFIX = "logtogether:state:v1:";
const INCOMPATIBLE_PREFIX = "family-exercise:incompatible-backup:";
const LEGACY_CLAIM_KEY = "logtogether:legacy-state-claimed-by:v1";
const OFFLINE_ACCOUNT_KEY = "logtogether:offline-account:v1";
const CURRENT_LOCAL_SCOPE_KEY = "logtogether:local-scope:v1";
const IMPORT_ROLLBACK_PREFIX = "logtogether:pre-import-backup:v1:";
const STRUCTURED_DB_NAME = "logtogether-structured-v1";
const STRUCTURED_DB_VERSION = 1;
const STRUCTURED_STORE = "accountStates";
const STRUCTURED_JOURNAL_PREFIX = "logtogether:state-journal:v1:";
const INDEXEDDB_MIGRATION_BACKUP_PREFIX = "logtogether:indexeddb-migration-backup:v1:";

export interface RememberedOfflineAccount {
  schemaVersion: 1;
  uid: string;
  displayName?: string;
  email?: string;
  rememberedAt: string;
  /** Added in v0.8.3. Missing means this is a legacy pre-invite-only login that must be validated once. */
  cloudApproved?: boolean;
}

export interface LogTogetherBackupV1 {
  format: "logtogether-backup";
  version: 1;
  exportedAt: string;
  scope: string;
  state: AppState;
}

export function loadRememberedOfflineAccount(): RememberedOfflineAccount | null {
  try {
    const raw = localStorage.getItem(OFFLINE_ACCOUNT_KEY);
    if (!raw) return null;
    const candidate = JSON.parse(raw) as Partial<RememberedOfflineAccount>;
    if (candidate.schemaVersion !== 1 || typeof candidate.uid !== "string" || !candidate.uid) return null;
    return {
      schemaVersion: 1,
      uid: candidate.uid,
      displayName: typeof candidate.displayName === "string" ? candidate.displayName : undefined,
      email: typeof candidate.email === "string" ? candidate.email : undefined,
      rememberedAt: typeof candidate.rememberedAt === "string" ? candidate.rememberedAt : new Date(0).toISOString(),
      cloudApproved: candidate.cloudApproved === true ? true : undefined
    };
  } catch {
    return null;
  }
}

export function rememberOfflineAccount(
  account: { uid: string; displayName?: string | null; email?: string | null },
  cloudApproved = true
): RememberedOfflineAccount {
  const value: RememberedOfflineAccount = {
    schemaVersion: 1,
    uid: account.uid,
    displayName: account.displayName || undefined,
    email: account.email || undefined,
    rememberedAt: new Date().toISOString(),
    ...(cloudApproved ? { cloudApproved: true } : {})
  };
  localStorage.setItem(OFFLINE_ACCOUNT_KEY, JSON.stringify(value));
  rememberLocalScope(`uid:${account.uid}`);
  return value;
}

export function forgetRememberedOfflineAccount(): void {
  localStorage.removeItem(OFFLINE_ACCOUNT_KEY);
}

export function rememberLocalScope(scope: string): string {
  const normalized = scope === "guest" || /^uid:[^/\s]+$/.test(scope) ? scope : "guest";
  try { localStorage.setItem(CURRENT_LOCAL_SCOPE_KEY, normalized); } catch { /* Best effort only. */ }
  return normalized;
}

export function preferredLocalScope(): string {
  try {
    const saved = localStorage.getItem(CURRENT_LOCAL_SCOPE_KEY);
    if (saved === "guest" || (saved && /^uid:[^/\s]+$/.test(saved))) return saved;
  } catch { /* Fall through to the compatibility pointer. */ }
  const remembered = loadRememberedOfflineAccount();
  return remembered ? `uid:${remembered.uid}` : "guest";
}

/** Backward-compatible export used by older call sites/tests. */
export function preferredCloudScope(): string {
  return preferredLocalScope();
}

export function createLocalBackup(state: AppState, scope = "guest"): string {
  const backup: LogTogetherBackupV1 = {
    format: "logtogether-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    scope,
    state: structuredClone(state)
  };
  return JSON.stringify(backup, null, 2);
}

export function parseLocalBackup(raw: string, expectedUid?: string): AppState {
  const parsed = JSON.parse(raw) as Partial<LogTogetherBackupV1>;
  if (parsed.format !== "logtogether-backup" || parsed.version !== 1 || !parsed.state) {
    throw new Error("Unsupported LogTogether backup file.");
  }
  const migrated = migrateState(parsed.state);
  if (!migrated) throw new Error("The backup uses an unsupported data schema.");
  if (expectedUid && migrated.user.id !== expectedUid) {
    throw new Error("This backup belongs to a different LogTogether account.");
  }
  return structuredClone(migrated);
}

export function saveImportRollback(state: AppState, scope = "guest"): void {
  try {
    localStorage.setItem(`${IMPORT_ROLLBACK_PREFIX}${Date.now()}`, JSON.stringify({ scope, state }));
  } catch {
    // Import can still proceed if the browser is too full to keep a rollback copy.
  }
}

function scopedStorageKey(scope?: string): string {
  return scope ? `${SCOPED_STORAGE_PREFIX}${scope}` : STORAGE_KEY;
}

type StructuredStorageBackend = "indexeddb" | "localstorage";

interface StructuredStateRecord {
  scope: string;
  raw: string;
  updatedAt: string;
}

let structuredDbPromise: Promise<IDBDatabase> | null = null;
const structuredWriteQueues = new Map<string, Promise<void>>();
const structuredStorageBackends = new Map<string, StructuredStorageBackend>();

function databaseScope(scope?: string): string {
  return scope || "legacy";
}

function stateJournalKey(scope?: string): string {
  return `${STRUCTURED_JOURNAL_PREFIX}${databaseScope(scope)}`;
}

function migrationBackupKey(scope?: string): string {
  return `${INDEXEDDB_MIGRATION_BACKUP_PREFIX}${databaseScope(scope)}`;
}

function parseStoredState(raw: string): AppState | null {
  try {
    return migrateState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function preserveIncompatibleState(raw: string): void {
  try { localStorage.setItem(`${INCOMPATIBLE_PREFIX}${Date.now()}`, raw); }
  catch { /* Preserve the original source when localStorage itself is full. */ }
}

function readLegacyStateRaw(scope?: string): string | null {
  const key = scopedStorageKey(scope);
  let saved = localStorage.getItem(key);

  // One-time compatibility bridge for the account that already owned the
  // pre-v0.4 unscoped state. Never expose that legacy state to guest mode or
  // to a different Google account.
  if (!saved && scope?.startsWith("uid:")) {
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy) {
      const migratedLegacy = parseStoredState(legacy);
      const uid = scope.slice(4);
      const claimedBy = localStorage.getItem(LEGACY_CLAIM_KEY);
      const legacyOwner = migratedLegacy?.user.id;
      const claimable = legacyOwner === uid || legacyOwner === "local_user";
      if (migratedLegacy && claimable && (!claimedBy || claimedBy === uid)) {
        saved = legacy;
        try {
          localStorage.setItem(key, legacy);
          localStorage.setItem(LEGACY_CLAIM_KEY, uid);
        } catch {
          // The unscoped copy is still intact, so a quota failure here is safe.
        }
      }
    }
  }
  return saved;
}

function openStructuredDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is unavailable."));
  if (structuredDbPromise) return structuredDbPromise;
  structuredDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(STRUCTURED_DB_NAME, STRUCTURED_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STRUCTURED_STORE)) db.createObjectStore(STRUCTURED_STORE, { keyPath: "scope" });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); structuredDbPromise = null; };
      resolve(db);
    };
    request.onerror = () => { structuredDbPromise = null; reject(request.error ?? new Error("Could not open IndexedDB.")); };
    request.onblocked = () => { structuredDbPromise = null; reject(new Error("IndexedDB upgrade was blocked.")); };
  });
  return structuredDbPromise;
}

async function readIndexedStateRaw(scope?: string): Promise<string | null> {
  const db = await openStructuredDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STRUCTURED_STORE, "readonly");
    const request = tx.objectStore(STRUCTURED_STORE).get(databaseScope(scope));
    request.onsuccess = () => resolve((request.result as StructuredStateRecord | undefined)?.raw ?? null);
    request.onerror = () => reject(request.error ?? new Error("Could not read local database."));
    tx.onabort = () => reject(tx.error ?? new Error("Local database read was aborted."));
  });
}

async function writeIndexedStateRaw(scope: string | undefined, raw: string): Promise<void> {
  const db = await openStructuredDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STRUCTURED_STORE, "readwrite");
    tx.objectStore(STRUCTURED_STORE).put({ scope: databaseScope(scope), raw, updatedAt: new Date().toISOString() } satisfies StructuredStateRecord);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not write local database."));
    tx.onabort = () => reject(tx.error ?? new Error("Local database write was aborted."));
  });
}

async function deleteIndexedState(scope?: string): Promise<void> {
  const db = await openStructuredDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STRUCTURED_STORE, "readwrite");
    tx.objectStore(STRUCTURED_STORE).delete(databaseScope(scope));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not clean incompatible local data."));
    tx.onabort = () => reject(tx.error ?? new Error("Local database cleanup was aborted."));
  });
}

function markStorageBackend(scope: string | undefined, backend: StructuredStorageBackend): void {
  structuredStorageBackends.set(databaseScope(scope), backend);
}

export function localStructuredStorageBackend(scope?: string): StructuredStorageBackend {
  return structuredStorageBackends.get(databaseScope(scope)) ?? (typeof indexedDB === "undefined" ? "localstorage" : "indexeddb");
}

async function migrateLegacyStateToIndexedDb(raw: string, scope?: string): Promise<void> {
  const backupKey = migrationBackupKey(scope);
  let backupReady = Boolean(localStorage.getItem(backupKey));
  if (!backupReady) {
    try { localStorage.setItem(backupKey, raw); backupReady = true; }
    catch { /* Keep the original active localStorage record if a backup cannot fit. */ }
  }

  await writeIndexedStateRaw(scope, raw);
  const verified = await readIndexedStateRaw(scope);
  if (verified !== raw) throw new Error("IndexedDB migration verification failed.");

  if (backupReady) localStorage.removeItem(scopedStorageKey(scope));
  localStorage.removeItem(stateJournalKey(scope));
  markStorageBackend(scope, "indexeddb");
}

export async function loadStateAsync(useDemoDefaults = true, scope?: string): Promise<AppState> {
  const fallback = () => useDemoDefaults ? demoState() : emptyState();
  const journalKey = stateJournalKey(scope);

  // A journal is written synchronously before every IndexedDB write. If the
  // app/browser was killed mid-write, the journal is the newest authoritative
  // copy and is replayed before reading the database.
  const journal = localStorage.getItem(journalKey);
  if (journal) {
    const journalState = parseStoredState(journal);
    if (journalState) {
      try {
        await writeIndexedStateRaw(scope, journal);
        if (localStorage.getItem(journalKey) === journal) localStorage.removeItem(journalKey);
        markStorageBackend(scope, "indexeddb");
        return journalState;
      } catch {
        markStorageBackend(scope, "localstorage");
        return journalState;
      }
    }
    preserveIncompatibleState(journal);
    localStorage.removeItem(journalKey);
  }

  try {
    const indexedRaw = await readIndexedStateRaw(scope);
    if (indexedRaw) {
      const indexedState = parseStoredState(indexedRaw);
      if (indexedState) {
        // Reaching a valid IndexedDB record on a later cold launch proves the
        // one-time migration survived a restart. The temporary rollback copy
        // can now be removed so old localStorage data cannot resurrect later.
        try {
          localStorage.removeItem(migrationBackupKey(scope));
          localStorage.removeItem(scopedStorageKey(scope));
        } catch { /* Cleanup is optional; IndexedDB remains authoritative. */ }
        markStorageBackend(scope, "indexeddb");
        return indexedState;
      }
      preserveIncompatibleState(indexedRaw);
      await deleteIndexedState(scope);
    }

    const legacyRaw = readLegacyStateRaw(scope) ?? localStorage.getItem(migrationBackupKey(scope));
    if (!legacyRaw) {
      markStorageBackend(scope, "indexeddb");
      return fallback();
    }
    const legacyState = parseStoredState(legacyRaw);
    if (!legacyState) {
      preserveIncompatibleState(legacyRaw);
      localStorage.removeItem(scopedStorageKey(scope));
      return fallback();
    }

    await migrateLegacyStateToIndexedDb(legacyRaw, scope);
    return legacyState;
  } catch {
    // Safari private mode, storage denial, quota errors, or a damaged IDB must
    // never prevent LogTogether from opening. The v0.8 localStorage format is
    // retained as the emergency fallback.
    markStorageBackend(scope, "localstorage");
    return loadState(useDemoDefaults, scope);
  }
}

function queueIndexedStateWrite(raw: string, scope?: string): void {
  const scopeKey = databaseScope(scope);
  const journalKey = stateJournalKey(scope);
  const previous = structuredWriteQueues.get(scopeKey) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(async () => {
    await writeIndexedStateRaw(scope, raw);
    if (localStorage.getItem(journalKey) === raw) localStorage.removeItem(journalKey);

    // Remove only redundant active v0.8 storage. If the one-time migration
    // backup could not be created and the active key still contains the older
    // pre-migration bytes, leave it untouched as the safety copy.
    const activeKey = scopedStorageKey(scope);
    const backupKey = migrationBackupKey(scope);
    const activeRaw = localStorage.getItem(activeKey);
    if (localStorage.getItem(backupKey)) {
      // During the first post-migration session keep the rollback copy current.
      // A later successful cold launch removes it entirely.
      try { localStorage.setItem(backupKey, raw); } catch { /* Best effort only. */ }
      localStorage.removeItem(activeKey);
    } else if (activeRaw === raw) {
      localStorage.removeItem(activeKey);
    }
    markStorageBackend(scope, "indexeddb");
  }).catch(() => {
    markStorageBackend(scope, "localstorage");
    try { localStorage.setItem(scopedStorageKey(scope), raw); }
    catch { /* The synchronous journal is still the final recovery copy. */ }
  });
  structuredWriteQueues.set(scopeKey, next);
  void next.finally(() => { if (structuredWriteQueues.get(scopeKey) === next) structuredWriteQueues.delete(scopeKey); });
}

function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function uid(prefix = "id"): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function hydrationSeed(): HydrationDay {
  return {
    schemaVersion: 1,
    date: isoDate(),
    userId: "demo_user",
    familyId: "demo_family",
    targetMl: 2000,
    totalMl: 1250,
    entries: [
      { id: uid("water"), at: new Date(Date.now() - 6 * 3600_000).toISOString(), ml: 500 },
      { id: uid("water"), at: new Date(Date.now() - 3 * 3600_000).toISOString(), ml: 500 },
      { id: uid("water"), at: new Date(Date.now() - 1 * 3600_000).toISOString(), ml: 250 }
    ],
    visibility: "private"
  };
}


export function emptyState(): AppState {
  const today = isoDate();
  return {
    schemaVersion: 1,
    user: { id: "local_user", familyId: "local_family", displayName: "User" },
    locale: "en",
    theme: "dark",
    simpleMode: true,
    hydration: {
      schemaVersion: 1,
      date: today,
      userId: "local_user",
      familyId: "local_family",
      targetMl: 2000,
      totalMl: 0,
      entries: [],
      visibility: "private"
    },
    hydrationHistory: [],
    supplementHistory: [],
    workouts: [],
    hikes: [],
    activeWorkout: null,
    family: [{ id: "local_user", name: "User", workoutsThisWeek: 0, workoutGoal: 3, hikeKmThisWeek: 0 }],
    familyGoal: { targetActivities: 12, completedActivities: 0 },
    weeklyWorkoutGoal: 3,
    routines: [],
    profile: { weightEntries: [] },
    stories: [],
    accentColor: "#62d995"
  };
}

export function demoState(): AppState {
  const completedAt = new Date(Date.now() - 2 * 86400_000).toISOString();
  const previousWorkout: WorkoutRecord = {
    schemaVersion: 1,
    id: uid("workout"),
    ownerId: "demo_user",
    familyId: "demo_family",
    activityKind: "strength",
    routineName: "Full Body A",
    startedAt: new Date(Date.now() - 2 * 86400_000 - 55 * 60_000).toISOString(),
    completedAt,
    notes: "Felt good. Keep the same squat weight next time.",
    visibility: "family",
    selectedViewerIds: [],
    exercises: [
      {
        id: uid("exercise"), exerciseId: "barbell_bench_press", restSec: 120, notes: "",
        sets: [
          { id: uid("set"), weightKg: 60, reps: 8, completed: true, setType: "normal" },
          { id: uid("set"), weightKg: 60, reps: 8, completed: true, setType: "normal" },
          { id: uid("set"), weightKg: 60, reps: 7, completed: true, setType: "normal" }
        ]
      },
      {
        id: uid("exercise"), exerciseId: "lat_pulldown", restSec: 90, notes: "",
        sets: [
          { id: uid("set"), weightKg: 45, reps: 10, completed: true, setType: "normal" },
          { id: uid("set"), weightKg: 45, reps: 10, completed: true, setType: "normal" },
          { id: uid("set"), weightKg: 45, reps: 9, completed: true, setType: "normal" }
        ]
      },
      {
        id: uid("exercise"), exerciseId: "leg_press", restSec: 120, notes: "",
        sets: [
          { id: uid("set"), weightKg: 80, reps: 10, completed: true, setType: "normal" },
          { id: uid("set"), weightKg: 80, reps: 10, completed: true, setType: "normal" },
          { id: uid("set"), weightKg: 80, reps: 10, completed: true, setType: "normal" }
        ]
      }
    ]
  };

  const makeDemoWorkout = (daysAgo: number, name: string, exerciseId: string, weightKg: number): WorkoutRecord => {
    const start = new Date(Date.now() - daysAgo * 86400_000 - 48 * 60_000);
    const set1 = new Date(start.getTime() + 6 * 60_000);
    const set2 = new Date(start.getTime() + 10 * 60_000);
    const set3 = new Date(start.getTime() + 14 * 60_000);
    const end = new Date(start.getTime() + 42 * 60_000);
    return {
      schemaVersion: 1, id: uid("workout"), ownerId: "demo_user", familyId: "demo_family", activityKind: "strength",
      routineName: name, startedAt: start.toISOString(), completedAt: end.toISOString(), notes: "", visibility: "family", selectedViewerIds: [],
      exercises: [{
        id: uid("exercise"), exerciseId, restSec: 90, notes: "", startedAt: set1.toISOString(), completedAt: set3.toISOString(), difficulty: 3,
        sets: [
          { id: uid("set"), weightKg, reps: 10, completed: true, setType: "normal", completedAt: set1.toISOString(), restAfterSec: 86 },
          { id: uid("set"), weightKg, reps: 10, completed: true, setType: "normal", completedAt: set2.toISOString(), restAfterSec: 94 },
          { id: uid("set"), weightKg, reps: 9, completed: true, setType: "normal", completedAt: set3.toISOString() }
        ]
      }]
    };
  };

  const demoWorkouts = [
    previousWorkout,
    makeDemoWorkout(8, "Upper Body", "lat_pulldown", 42.5),
    makeDemoWorkout(12, "Lower Body", "leg_press", 75),
    makeDemoWorkout(20, "Upper Body", "barbell_bench_press", 57.5),
    makeDemoWorkout(34, "Full Body", "goblet_squat", 22.5),
    makeDemoWorkout(36, "Upper Body", "lat_pulldown", 40)
  ];

  return {
    schemaVersion: 1,
    user: { id: "demo_user", familyId: "demo_family", displayName: "Chi-Wei" },
    locale: "en",
    theme: "dark",
    simpleMode: true,
    hydration: hydrationSeed(),
    hydrationHistory: Array.from({ length: 6 }, (_, index) => {
      const date = isoDate(-(index + 1));
      const total = [2100, 1800, 2350, 1600, 2050, 2250][index] ?? 2000;
      return { schemaVersion: 1 as const, date, userId: "demo_user", familyId: "demo_family", targetMl: 2000, totalMl: total, entries: [{ id: uid("water"), at: `${date}T12:00:00`, ml: total }], visibility: "private" as const };
    }),
    supplementHistory: [],
    workouts: demoWorkouts,
    hikes: [
      {
        schemaVersion: 1,
        id: uid("hike"),
        ownerId: "demo_user",
        familyId: "demo_family",
        activityKind: "hike",
        name: "Elephant Mountain",
        date: isoDate(-5),
        distanceKm: 6.8,
        movingMinutes: 132,
        elapsedMinutes: 154,
        elevationGainM: 412,
        elevationLossM: 408,
        highestPointM: 375,
        difficulty: 3,
        waterMl: 750,
        notes: "Clear weather and an easy pace.",
        visibility: "family",
        selectedViewerIds: []
      }
    ],
    activeWorkout: null,
    family: [
      { id: "demo_user", name: "Chi-Wei", workoutsThisWeek: 0, workoutGoal: 3, hikeKmThisWeek: 0 }
    ],
    familyGoal: { targetActivities: 12, completedActivities: 8 },
    weeklyWorkoutGoal: 3,
    routines: [{
      id: "routine_daily", name: "Daily Circuit", mode: "circuit", rounds: 3,
      exercises: [
        { exerciseId: "pull_up", reps: 7 },
        { exerciseId: "push_up", reps: 25 },
        { exerciseId: "bodyweight_squat", reps: 40 },
        { exerciseId: "lying_leg_raise", reps: 15 },
        { exerciseId: "bodyweight_calf_raise", reps: 60 }
      ].map(item => ({ exerciseId: item.exerciseId, restSec: 45, sets: [{ reps: item.reps, setType: "normal" as const }] }))
    }],
    profile: { heightCm: 175, weightEntries: [{ id: uid("weight"), date: isoDate(-32), kg: 70.8 }, { id: uid("weight"), date: isoDate(), kg: 70.2 }] },
    goals: {
      weeklyCalories: 2100,
      categorySets: { chest: 3, back: 3, shoulders: 3, arms: 3, legs: 3, core: 3, cardio: 1, mobility: 1 }
    },
    stories: []
  };
}

export function loadState(useDemoDefaults = true, scope?: string): AppState {
  try {
    const saved = readLegacyStateRaw(scope) ?? localStorage.getItem(migrationBackupKey(scope));
    if (!saved) return useDemoDefaults ? demoState() : emptyState();
    const migrated = parseStoredState(saved);
    if (migrated) return migrated;
    preserveIncompatibleState(saved);
    localStorage.removeItem(scopedStorageKey(scope));
    return useDemoDefaults ? demoState() : emptyState();
  } catch {
    return useDemoDefaults ? demoState() : emptyState();
  }
}

export function saveState(state: AppState, scope?: string): void {
  const raw = JSON.stringify(state);
  try {
    // localStorage is now a tiny crash journal, not the primary database. The
    // write is synchronous so an immediate process kill cannot lose the newest
    // state while the IndexedDB transaction is still being scheduled.
    localStorage.setItem(stateJournalKey(scope), raw);
  } catch {
    // If the synchronous journal is unavailable, still attempt IndexedDB. A
    // best-effort v0.8 localStorage copy is kept when the browser allows it.
    try { localStorage.setItem(scopedStorageKey(scope), raw); } catch { /* IndexedDB may still succeed. */ }
    markStorageBackend(scope, "localstorage");
  }
  queueIndexedStateWrite(raw, scope);
}

export function resetState(): AppState {
  const next = demoState();
  saveState(next);
  return next;
}

export function clearLocalTestState(current: AppState, scope?: string): AppState {
  try { localStorage.removeItem(migrationBackupKey(scope)); } catch { /* Best effort. */ }
  const today = isoDate();
  const next: AppState = {
    schemaVersion: 1,
    user: { ...current.user },
    locale: current.locale,
    theme: current.theme,
    simpleMode: current.simpleMode,
    largeText: current.largeText,
    textScale: current.textScale,
    hydration: {
      schemaVersion: 1,
      date: today,
      userId: current.user.id,
      familyId: current.user.familyId,
      targetMl: current.hydration?.targetMl || 2000,
      totalMl: 0,
      entries: [],
      visibility: "private"
    },
    hydrationHistory: [],
    supplementHistory: [],
    workouts: [],
    hikes: [],
    activeWorkout: null,
    family: [{
      id: current.user.id,
      name: current.user.displayName,
      workoutsThisWeek: 0,
      workoutGoal: current.weeklyWorkoutGoal ?? 3,
      hikeKmThisWeek: 0
    }],
    familyGoal: { targetActivities: current.familyGoal?.targetActivities ?? 12, completedActivities: 0 },
    weeklyWorkoutGoal: current.weeklyWorkoutGoal ?? 3,
    routines: [],
    profile: { weightEntries: [], ...(current.profile?.biologicalSex ? { biologicalSex: current.profile.biologicalSex } : {}) },
    goals: current.goals ? structuredClone(current.goals) : undefined,
    stories: [],
    accentColor: current.accentColor
  };
  saveState(next, scope);
  return next;
}


function newestIso(a?: string | null, b?: string | null): string {
  return (a ?? "") >= (b ?? "") ? (a ?? "") : (b ?? "");
}

function mergeById<T extends { id: string }>(primary: T[], secondary: T[], stamp?: (value: T) => string): T[] {
  const merged = new Map<string, T>();
  for (const value of secondary) merged.set(value.id, structuredClone(value));
  for (const value of primary) {
    const previous = merged.get(value.id);
    if (!previous || !stamp || stamp(value) >= stamp(previous)) merged.set(value.id, structuredClone(value));
  }
  return [...merged.values()];
}

function mergeHydrationDays(primary: HydrationDay[], secondary: HydrationDay[]): HydrationDay[] {
  const byDate = new Map<string, HydrationDay>();
  for (const day of [...secondary, ...primary]) {
    const previous = byDate.get(day.date);
    if (!previous) {
      byDate.set(day.date, structuredClone(day));
      continue;
    }
    const entries = mergeById(day.entries, previous.entries, entry => newestIso(entry.editedAt, entry.at));
    byDate.set(day.date, {
      ...previous,
      ...day,
      entries,
      totalMl: entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.ml) || 0), 0),
      targetMl: day.targetMl || previous.targetMl || 2000
    });
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function mergeSupplementDays(primary: SupplementDay[], secondary: SupplementDay[]): SupplementDay[] {
  const byDate = new Map<string, SupplementDay>();
  for (const day of [...secondary, ...primary]) {
    const previous = byDate.get(day.date);
    const entries = previous
      ? mergeById(day.entries, previous.entries, entry => newestIso(entry.editedAt, entry.at))
      : structuredClone(day.entries);
    byDate.set(day.date, { date: day.date, entries });
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function mergeWeightEntries(primary: WeightEntry[], secondary: WeightEntry[]): WeightEntry[] {
  const values = mergeById(primary, secondary, entry => entry.date);
  return values.sort((a, b) => a.date.localeCompare(b.date));
}

function bindStateIdentity(state: AppState, uidValue: string, familyId: string): AppState {
  const next = structuredClone(state);
  const previousOwnerIds = new Set([next.user.id, "local_user"]);
  next.user.id = uidValue;
  next.user.familyId = familyId;
  next.hydration.userId = uidValue;
  next.hydration.familyId = familyId;
  for (const day of next.hydrationHistory ?? []) { day.userId = uidValue; day.familyId = familyId; }
  for (const workout of next.workouts) {
    if (previousOwnerIds.has(workout.ownerId)) workout.ownerId = uidValue;
    if (workout.ownerId === uidValue) workout.familyId = familyId;
  }
  for (const hike of next.hikes) {
    if (previousOwnerIds.has(hike.ownerId)) hike.ownerId = uidValue;
    if (hike.ownerId === uidValue) hike.familyId = familyId;
  }
  if (next.activeWorkout) {
    if (previousOwnerIds.has(next.activeWorkout.ownerId)) next.activeWorkout.ownerId = uidValue;
    if (next.activeWorkout.ownerId === uidValue) next.activeWorkout.familyId = familyId;
  }
  next.family = [{
    id: uidValue,
    name: next.user.displayName,
    workoutsThisWeek: 0,
    workoutGoal: next.weeklyWorkoutGoal ?? 3,
    hikeKmThisWeek: 0
  }];
  return next;
}

/**
 * Merge a device-local profile into a Google UID bucket when an invite is accepted.
 * The current/local profile wins presentation/preferences conflicts; history is unioned.
 * Existing private/selected visibility is preserved, so joining Cloud never silently
 * publishes older local-only workouts that were explicitly private.
 */
export function mergeLocalStateForCloud(
  localState: AppState,
  existingCloudScopeState: AppState,
  uidValue: string,
  familyId: string
): AppState {
  const local = bindStateIdentity(localState, uidValue, familyId);
  const existing = bindStateIdentity(existingCloudScopeState, uidValue, familyId);
  const localHydration = [local.hydration, ...(local.hydrationHistory ?? [])];
  const existingHydration = [existing.hydration, ...(existing.hydrationHistory ?? [])];
  const hydration = mergeHydrationDays(localHydration, existingHydration);
  const today = new Date().toISOString().slice(0, 10);
  const current = hydration.find(day => day.date === today) ?? local.hydration;
  const history = hydration.filter(day => day.date !== current.date);
  const profile = {
    ...(existing.profile ?? { weightEntries: [] }),
    ...(local.profile ?? { weightEntries: [] }),
    weightEntries: mergeWeightEntries(local.profile?.weightEntries ?? [], existing.profile?.weightEntries ?? [])
  };
  const merged: AppState = {
    ...existing,
    ...local,
    user: { ...local.user, id: uidValue, familyId },
    hydration: { ...current, userId: uidValue, familyId },
    hydrationHistory: history.map(day => ({ ...day, userId: uidValue, familyId })),
    supplementHistory: mergeSupplementDays(local.supplementHistory ?? [], existing.supplementHistory ?? []),
    workouts: mergeById(local.workouts, existing.workouts, workout => workout.updatedAt ?? workout.completedAt ?? workout.startedAt)
      .map(workout => ({ ...workout, ownerId: workout.ownerId === uidValue ? uidValue : workout.ownerId, familyId: workout.ownerId === uidValue ? familyId : workout.familyId })),
    hikes: mergeById(local.hikes, existing.hikes, hike => hike.updatedAt ?? `${hike.date}T12:00:00.000Z`)
      .map(hike => ({ ...hike, ownerId: hike.ownerId === uidValue ? uidValue : hike.ownerId, familyId: hike.ownerId === uidValue ? familyId : hike.familyId })),
    routines: mergeById(local.routines ?? [], existing.routines ?? []),
    profile,
    family: [{ id: uidValue, name: local.user.displayName, workoutsThisWeek: 0, workoutGoal: local.weeklyWorkoutGoal ?? 3, hikeKmThisWeek: 0 }]
  };
  merged.sync = {
    ...(existing.sync ?? {}),
    ...(local.sync ?? {}),
    preferencesDirty: true,
    profileDirty: true,
    hydrationDirtyDates: [...new Set(hydration.map(day => day.date))],
    supplementDirtyDates: [...new Set((merged.supplementHistory ?? []).map(day => day.date))]
  };
  for (const workout of merged.workouts) if (workout.ownerId === uidValue) workout.cloudSyncedAt = undefined;
  for (const hike of merged.hikes) if (hike.ownerId === uidValue) hike.cloudSyncedAt = undefined;
  return merged;
}

export async function saveStateVerified(state: AppState, scope?: string): Promise<void> {
  const raw = JSON.stringify(state);
  const journalKey = stateJournalKey(scope);
  try { localStorage.setItem(journalKey, raw); } catch { /* IndexedDB may still succeed. */ }
  try {
    await writeIndexedStateRaw(scope, raw);
    const verified = await readIndexedStateRaw(scope);
    if (verified !== raw) throw new Error("Local database verification failed.");
    if (localStorage.getItem(journalKey) === raw) localStorage.removeItem(journalKey);
    markStorageBackend(scope, "indexeddb");
  } catch (error) {
    try { localStorage.setItem(scopedStorageKey(scope), raw); } catch { /* Journal is the remaining recovery copy. */ }
    markStorageBackend(scope, "localstorage");
    if (!parseStoredState(raw)) throw error;
  }
}


export function createBlankWorkout(state: AppState): WorkoutRecord {
  return {
    schemaVersion: 1,
    id: uid("workout"),
    ownerId: state.user.id,
    familyId: state.user.familyId,
    activityKind: "strength",
    routineName: state.locale === "zh-TW" ? "自由訓練" : "Workout",
    startedAt: new Date().toISOString(),
    completedAt: null,
    notes: "",
    visibility: "family",
    selectedViewerIds: [],
    recordingSource: "live",
    exercises: []
  };
}

export function freshWorkoutFromPrevious(state: AppState): WorkoutRecord {
  const previous = state.workouts
    .filter(workout => workout.completedAt)
    .slice()
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0];
  const fallbackExercises: WorkoutExerciseEntry[] = ["barbell_bench_press", "lat_pulldown", "leg_press"].map(exerciseId => ({
    id: uid("exercise"), exerciseId, restSec: 90, notes: "", sets: []
  }));

  return {
    schemaVersion: 1,
    id: uid("workout"),
    ownerId: state.user.id,
    familyId: state.user.familyId,
    activityKind: "strength",
    routineName: previous?.routineName ?? (state.locale === "zh-TW" ? "自由訓練" : "Workout"),
    startedAt: new Date().toISOString(),
    completedAt: null,
    notes: "",
    visibility: "family",
    selectedViewerIds: [],
    exercises: (previous?.exercises ?? fallbackExercises).map(exercise => ({
      id: uid("exercise"),
      exerciseId: exercise.exerciseId,
      restSec: exercise.restSec,
      notes: "",
      recordingProfile: exercise.recordingProfile,
      recordingProfileVersion: exercise.recordingProfileVersion,
      targetRepMin: exercise.targetRepMin,
      targetRepMax: exercise.targetRepMax,
      sets: (exercise.sets.length ? exercise.sets : [
        { id: uid("set"), weightKg: 0, reps: 0, completed: false }
      ]).map(set => ({
        id: uid("set"),
        weightKg: set.weightKg,
        reps: set.reps,
        durationSec: set.durationSec,
        targetWorkSec: set.targetWorkSec,
        distanceKm: set.distanceKm,
        speedKph: set.speedKph,
        inclinePct: set.inclinePct,
        resistanceLevel: set.resistanceLevel,
        laps: set.laps,
        recoverySec: set.recoverySec,
        loadPerHandKg: set.loadPerHandKg,
        cadenceRpm: set.cadenceRpm,
        strokeRateSpm: set.strokeRateSpm,
        pace500Sec: set.pace500Sec,
        verticalGainM: set.verticalGainM,
        packWeightKg: set.packWeightKg,
        side: set.side,
        completed: false,
        setType: set.setType ?? "normal"
      }))
    }))
  };
}


export function workoutFromRoutine(state: AppState, routine: WorkoutRoutine): WorkoutRecord {
  const rounds = routine.mode === "circuit" ? Math.max(1, Math.min(10, routine.rounds ?? 3)) : 1;
  return {
    ...createBlankWorkout(state),
    routineName: routine.name,
    routineMode: routine.mode ?? "standard",
    circuitRounds: routine.mode === "circuit" ? rounds : undefined,
    exercises: routine.exercises.map(template => {
      const templateSets = template.sets.length ? template.sets : [{ reps: 10, setType: "normal" as const }];
      const sets = routine.mode === "circuit"
        ? Array.from({ length: rounds }, () => ({ id: uid("set"), ...templateSets[0], completed: false, setType: templateSets[0]?.setType ?? "normal" }))
        : templateSets.map(set => ({ id: uid("set"), ...set, completed: false, setType: set.setType ?? "normal" }));
      return {
        id: uid("exercise"), exerciseId: template.exerciseId, restSec: template.restSec, notes: "", sets,
        recordingProfile: template.recordingProfile,
        recordingProfileVersion: template.recordingProfileVersion,
        targetRepMin: template.targetRepMin,
        targetRepMax: template.targetRepMax
      };
    })
  };
}

export function routineFromWorkout(workout: WorkoutRecord): WorkoutRoutine {
  return {
    id: uid("routine"),
    name: workout.routineName.trim() || "Workout",
    mode: workout.routineMode ?? "standard",
    rounds: workout.routineMode === "circuit" ? workout.circuitRounds : undefined,
    exercises: workout.exercises.map(exercise => ({
      exerciseId: exercise.exerciseId, restSec: exercise.restSec,
      recordingProfile: exercise.recordingProfile,
      recordingProfileVersion: exercise.recordingProfileVersion,
      targetRepMin: exercise.targetRepMin,
      targetRepMax: exercise.targetRepMax,
      sets: exercise.sets.map(set => ({
        weightKg: set.weightKg, reps: set.reps, targetWorkSec: set.targetWorkSec, durationSec: set.durationSec, distanceKm: set.distanceKm,
        speedKph: set.speedKph, inclinePct: set.inclinePct, resistanceLevel: set.resistanceLevel, laps: set.laps,
        recoverySec: set.recoverySec, loadPerHandKg: set.loadPerHandKg, cadenceRpm: set.cadenceRpm,
        strokeRateSpm: set.strokeRateSpm, pace500Sec: set.pace500Sec, verticalGainM: set.verticalGainM,
        packWeightKg: set.packWeightKg, side: set.side, setType: set.setType ?? "normal"
      }))
    }))
  };
}
