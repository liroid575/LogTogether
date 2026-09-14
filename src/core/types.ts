export type Locale = "en" | "zh-TW";
export type Theme = "dark" | "light";
export type Visibility = "private" | "family" | "selected";
export type ActivityKind = "strength" | "hike" | "walk";
export type ExerciseCategory = "chest" | "back" | "shoulders" | "arms" | "legs" | "core" | "cardio" | "mobility";
export type ExerciseLibraryGroup = "gym" | "calisthenics" | "outdoor_cardio" | "mobility_yoga" | "swimming" | "kickboxing" | "sports_other";
export type ExerciseLoggingProfile = "sets" | "cardio_session" | "mobility_session" | "rounds";
export type GoalDifficulty = "easy" | "normal" | "hard" | "extreme";

export interface ExerciseDefinition {
  id: string;
  names: Record<Locale, string>;
  type: "weight_reps" | "reps" | "duration" | "distance_time";
  category: ExerciseCategory;
  group?: ExerciseLibraryGroup;
  loggingProfile?: ExerciseLoggingProfile;
  muscleWeights?: Partial<Record<ExerciseCategory, number>>;
}

export interface SetEntry {
  id: string;
  weightKg?: number;
  reps?: number;
  durationSec?: number;
  distanceKm?: number;
  completed: boolean;
  setType?: "normal" | "warmup" | "drop" | "failure";
  rpe?: number;
  startedAt?: string;
  completedAt?: string;
  restAfterSec?: number;
  speedKph?: number;
  inclinePct?: number;
  resistanceLevel?: number;
  laps?: number;
}

export interface WorkoutExerciseEntry {
  id: string;
  exerciseId: string;
  restSec: number;
  notes: string;
  sets: SetEntry[];
  startedAt?: string;
  completedAt?: string;
  difficulty?: 1 | 2 | 3 | 4 | 5;
}

export interface WorkoutRecord {
  schemaVersion: 1;
  id: string;
  ownerId: string;
  familyId: string;
  activityKind: "strength";
  routineName: string;
  startedAt: string;
  completedAt: string | null;
  notes: string;
  visibility: Visibility;
  selectedViewerIds: string[];
  exercises: WorkoutExerciseEntry[];
  routineMode?: "standard" | "circuit";
  circuitRounds?: number;
  photoId?: string;
  estimatedCalories?: number;
  updatedAt?: string;
  editedAt?: string;
  cloudSyncedAt?: string;
}

export interface WorkoutRoutine {
  id: string;
  name: string;
  mode?: "standard" | "circuit";
  rounds?: number;
  exercises: Array<{ exerciseId: string; restSec: number; sets: Array<Pick<SetEntry, "weightKg" | "reps" | "durationSec" | "distanceKm" | "speedKph" | "inclinePct" | "resistanceLevel" | "laps" | "setType">> }>;
}

export interface RoutePoint { lat: number; lon: number; elevation?: number; }

export interface HikeRecord {
  schemaVersion: 1;
  id: string;
  ownerId: string;
  familyId: string;
  activityKind: "hike" | "walk";
  name: string;
  date: string;
  distanceKm: number;
  movingMinutes: number;
  elapsedMinutes: number;
  elevationGainM: number;
  elevationLossM: number;
  highestPointM?: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  waterMl: number;
  notes: string;
  visibility: Visibility;
  selectedViewerIds: string[];
  photoId?: string;
  routePoints?: RoutePoint[];
  routeSource?: "gpx";
  startedAt?: string;
  updatedAt?: string;
  editedAt?: string;
  cloudSyncedAt?: string;
}

export type SupplementUnit = "mg" | "mcg" | "g" | "IU" | "capsule" | "tablet" | "serving" | "scoop" | "drop";

export interface SupplementEntry { id: string; at: string; supplementId: string; amount?: number; unit?: SupplementUnit; editedAt?: string; }
export interface SupplementDay { date: string; entries: SupplementEntry[]; }

export interface HydrationDay {
  schemaVersion: 1;
  date: string;
  userId: string;
  familyId: string;
  targetMl: number;
  totalMl: number;
  entries: Array<{ id: string; at: string; ml: number; editedAt?: string }>;
  visibility: Visibility;
}

export interface FamilyMemberSummary {
  id: string;
  name: string;
  relationship?: string;
  workoutsThisWeek: number;
  workoutGoal: number;
  hikeKmThisWeek: number;
}

export interface WeightEntry { id: string; date: string; kg: number; }
export interface HikeBadgePreference { hikeId: string; title?: string; hidden?: boolean; order?: number; }
export interface ProfileData {
  heightCm?: number;
  weightEntries: WeightEntry[];
  photoId?: string;
  biologicalSex?: "female" | "male" | "other" | "prefer_not";
}
export interface GoalConfig { weeklyCalories: number; categorySets: Partial<Record<ExerciseCategory, number>>; difficulty?: GoalDifficulty; difficultyWeek?: string; difficultyChanges?: number; }
export interface StoryRecord { id: string; ownerId: string; familyId: string; mediaId: string; createdAt: string; expiresAt: string; caption?: string; }

export interface AppState {
  schemaVersion: 1;
  user: { id: string; familyId: string; displayName: string };
  locale: Locale;
  theme: Theme;
  simpleMode: boolean;
  largeText?: boolean;
  textScale?: number;
  hydration: HydrationDay;
  hydrationHistory?: HydrationDay[];
  supplementHistory?: SupplementDay[];
  workouts: WorkoutRecord[];
  hikes: HikeRecord[];
  activeWorkout: WorkoutRecord | null;
  family: FamilyMemberSummary[];
  familyGoal: { targetActivities: number; completedActivities: number };
  weeklyWorkoutGoal?: number;
  routines?: WorkoutRoutine[];
  profile?: ProfileData;
  goals?: GoalConfig;
  stories?: StoryRecord[];
  accentColor?: string;
  hikeBadgePreferences?: HikeBadgePreference[];
  sync?: {
    deletedWorkoutIds?: string[];
    workoutPrivacyMigrated?: boolean;
    deletedHikeIds?: string[];
    preferencesDirty?: boolean;
    profileDirty?: boolean;
    profileCloudMigrated?: boolean;
    hydrationDirtyDates?: string[];
    hydrationCloudMigrated?: boolean;
    supplementDirtyDates?: string[];
    supplementCloudMigrated?: boolean;
    lastSuccessfulSyncAt?: string;
  };
}
