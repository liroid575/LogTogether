import type { AppState } from "./types.js";

export interface DiagnosticsContext {
  appVersion: string;
  storageBackend: "indexeddb" | "localstorage";
  cloudMode: boolean;
  online: boolean;
  signedIn: boolean;
  rememberedOfflineAccount: boolean;
  familyActive: boolean;
  pendingCloudChanges: number;
  cloudErrorAreas: string[];
  appCheckState: "not-configured" | "initializing" | "active" | "error";
  appCheckProvider?: "recaptcha-enterprise" | "recaptcha-v3";
}

export interface LogTogetherDiagnosticsV1 {
  format: "logtogether-diagnostics";
  version: 1;
  generatedAt: string;
  app: {
    version: string;
    schemaVersion: number;
    cloudMode: boolean;
    online: boolean;
    storageBackend: "indexeddb" | "localstorage";
  };
  account: {
    signedIn: boolean;
    rememberedOfflineAccount: boolean;
    familyActive: boolean;
  };
  sync: {
    pendingCloudChanges: number;
    errorAreas: string[];
    hasSuccessfulSync: boolean;
  };
  appCheck: {
    state: DiagnosticsContext["appCheckState"];
    provider?: DiagnosticsContext["appCheckProvider"];
  };
  counts: {
    workouts: number;
    hikes: number;
    hydrationDays: number;
    supplementDays: number;
    weightEntries: number;
    routines: number;
    localStories: number;
    deletedWorkoutTombstones: number;
    deletedHikeTombstones: number;
  };
  privacy: {
    containsRecordContents: false;
    containsNames: false;
    containsAccountIds: false;
    containsGpsPoints: false;
    containsHealthMetrics: false;
  };
}

export function buildDiagnostics(state: AppState, context: DiagnosticsContext): LogTogetherDiagnosticsV1 {
  const hydrationDates = new Set<string>([
    state.hydration.date,
    ...(state.hydrationHistory ?? []).map(day => day.date)
  ]);
  return {
    format: "logtogether-diagnostics",
    version: 1,
    generatedAt: new Date().toISOString(),
    app: {
      version: context.appVersion,
      schemaVersion: state.schemaVersion,
      cloudMode: context.cloudMode,
      online: context.online,
      storageBackend: context.storageBackend
    },
    account: {
      signedIn: context.signedIn,
      rememberedOfflineAccount: context.rememberedOfflineAccount,
      familyActive: context.familyActive
    },
    sync: {
      pendingCloudChanges: Math.max(0, Math.round(context.pendingCloudChanges)),
      errorAreas: [...new Set(context.cloudErrorAreas)].sort(),
      hasSuccessfulSync: Boolean(state.sync?.lastSuccessfulSyncAt)
    },
    appCheck: {
      state: context.appCheckState,
      ...(context.appCheckProvider ? { provider: context.appCheckProvider } : {})
    },
    counts: {
      workouts: state.workouts.length,
      hikes: state.hikes.length,
      hydrationDays: hydrationDates.size,
      supplementDays: (state.supplementHistory ?? []).length,
      weightEntries: state.profile?.weightEntries.length ?? 0,
      routines: state.routines?.length ?? 0,
      localStories: state.stories?.length ?? 0,
      deletedWorkoutTombstones: state.sync?.deletedWorkoutIds?.length ?? 0,
      deletedHikeTombstones: state.sync?.deletedHikeIds?.length ?? 0
    },
    privacy: {
      containsRecordContents: false,
      containsNames: false,
      containsAccountIds: false,
      containsGpsPoints: false,
      containsHealthMetrics: false
    }
  };
}

export function diagnosticsJson(state: AppState, context: DiagnosticsContext): string {
  return JSON.stringify(buildDiagnostics(state, context), null, 2);
}
