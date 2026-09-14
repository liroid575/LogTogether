import type { AppState } from "./types.js";

export const CURRENT_SCHEMA_VERSION = 1 as const;
export const MIN_SUPPORTED_SCHEMA_VERSION = 1 as const;

type VersionedObject = Record<string, unknown> & { schemaVersion: number };
type StateMigration = (state: VersionedObject) => VersionedObject;

// Future schema upgrades are registered by their SOURCE version. Example:
//   1: state => ({ ...state, schemaVersion: 2, newField: ... })
// migrateState() will then run 1 -> 2 -> 3 sequentially, which lets a device
// safely skip several LogTogether releases without losing its local history.
const STATE_MIGRATIONS: Partial<Record<number, StateMigration>> = {};

function isVersionedObject(raw: unknown): raw is VersionedObject {
  if (!raw || typeof raw !== "object") return false;
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  return Number.isInteger(version) && Number(version) >= MIN_SUPPORTED_SCHEMA_VERSION;
}

export function canMigrateStateVersion(version: number): boolean {
  if (!Number.isInteger(version) || version < MIN_SUPPORTED_SCHEMA_VERSION || version > CURRENT_SCHEMA_VERSION) return false;
  let current = version;
  while (current < CURRENT_SCHEMA_VERSION) {
    const migration = STATE_MIGRATIONS[current];
    if (!migration) return false;
    current += 1;
  }
  return true;
}

export function migrateState(raw: unknown): AppState | null {
  if (!isVersionedObject(raw)) return null;
  if (!canMigrateStateVersion(raw.schemaVersion)) return null;

  let candidate: VersionedObject = raw;
  while (candidate.schemaVersion < CURRENT_SCHEMA_VERSION) {
    const migration = STATE_MIGRATIONS[candidate.schemaVersion];
    if (!migration) return null;
    const next = migration(candidate);
    if (!isVersionedObject(next) || next.schemaVersion !== candidate.schemaVersion + 1) return null;
    candidate = next;
  }

  return candidate as unknown as AppState;
}
