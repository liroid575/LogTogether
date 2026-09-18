export type Locale = "en" | "zh-TW";
export type Theme = "dark" | "light";
export type Visibility = "private" | "family" | "selected";
export type ActivityKind = "strength" | "hike" | "walk";
export type ExerciseCategory = "chest" | "back" | "shoulders" | "arms" | "legs" | "core" | "cardio" | "mobility";
export type ExerciseLibraryGroup = "home_functional" | "gym" | "calisthenics" | "outdoor_cardio" | "mobility_yoga" | "swimming" | "kickboxing" | "sports_other";
export type ExerciseLoggingProfile =
  | "sets"
  | "skill_sets"
  | "isometric_sets"
  | "balance_hold"
  | "loaded_carry"
  | "conditioning_intervals"
  | "cardio_session"
  | "mobility_session" // legacy v0.9 compatibility only
  | "sprint_intervals"
  | "static_stretch"
  | "dynamic_mobility"
  | "yoga_flow"
  | "swim_session"
  | "water_skill"
  | "rounds"
  | "skill_drill";
export type ExerciseMovementPattern = "push" | "pull" | "lower" | "core" | "cardio" | "mobility" | "skill";
export type ExerciseProgressionProfile = "load_reps" | "bodyweight_reps" | "skill_strength" | "isometric" | "cardio" | "mobility" | "swimming" | "combat" | "skill" | "none";
export type ExerciseSafetyFlag = "no_intensity_bonus" | "no_pr" | "no_progression" | "quality_before_volume" | "aquatic_supervision" | "secure_support";
export type ExerciseScienceTag = "balance" | "functional" | "home_friendly";
export type GoalDifficulty = "easy" | "normal" | "hard" | "extreme";
export type PersonalActivityId = "none" | "any" | "hiking" | "swimming" | "running" | "cycling" | "kickboxing" | "gym" | "jump_rope";
export type RecordingSource = "live" | "manual" | "imported";

export interface ExerciseDefinition {
  id: string;
  names: Record<Locale, string>;
  type: "weight_reps" | "reps" | "duration" | "distance_time";
  category: ExerciseCategory;
  group?: ExerciseLibraryGroup;
  loggingProfile?: ExerciseLoggingProfile;
  muscleWeights?: Partial<Record<ExerciseCategory, number>>;
  movementPattern?: ExerciseMovementPattern;
  progressionProfile?: ExerciseProgressionProfile;
  safetyFlags?: ExerciseSafetyFlag[];
  scienceTags?: ExerciseScienceTag[];
}

export interface SetEntry {
  id: string;
  weightKg?: number;
  reps?: number;
  durationSec?: number;
  targetWorkSec?: number;
  actualDurationSec?: number;
  timerTargetSec?: number;
  distanceKm?: number;
  completed: boolean;
  skipped?: boolean;
  skippedAt?: string;
  setType?: "normal" | "warmup" | "drop" | "failure";
  rpe?: number;
  startedAt?: string;
  completedAt?: string;
  restAfterSec?: number;
  speedKph?: number;
  inclinePct?: number;
  resistanceLevel?: number;
  laps?: number;
  recoverySec?: number;
  loadPerHandKg?: number;
  cadenceRpm?: number;
  strokeRateSpm?: number;
  pace500Sec?: number;
  verticalGainM?: number;
  packWeightKg?: number;
  side?: "left" | "right" | "both";
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
  recordingProfile?: ExerciseLoggingProfile;
  recordingProfileVersion?: 2;
  targetRepMin?: number;
  targetRepMax?: number;
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
  recordingSource?: RecordingSource;
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
  exercises: Array<{
    exerciseId: string;
    restSec: number;
    recordingProfile?: ExerciseLoggingProfile;
    recordingProfileVersion?: 2;
    targetRepMin?: number;
    targetRepMax?: number;
    sets: Array<Pick<SetEntry,
      "weightKg" | "reps" | "durationSec" | "targetWorkSec" | "distanceKm" | "speedKph" | "inclinePct" |
      "resistanceLevel" | "laps" | "setType" | "recoverySec" | "loadPerHandKg" |
      "cadenceRpm" | "strokeRateSpm" | "pace500Sec" | "verticalGainM" | "packWeightKg" | "side"
    >>
  }>;
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
  recordingSource?: RecordingSource;
  photoId?: string;
  routePoints?: RoutePoint[];
  routeSource?: "gpx";
  startedAt?: string;
  updatedAt?: string;
  editedAt?: string;
  cloudSyncedAt?: string;
}

export type SupplementUnit = "mg" | "mcg" | "g" | "IU" | "capsule" | "tablet" | "serving" | "scoop" | "drop";

export interface SupplementEntry { id: string; at: string; supplementId: string; customLabel?: string; amount?: number; unit?: SupplementUnit; editedAt?: string; }
export interface CustomSupplement { id: string; label: string; defaultAmount?: number; defaultUnit?: SupplementUnit; }
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
export interface FamilyProfileSharing {
  biologicalSex: boolean;
  supplements: boolean;
  recentWorkouts: boolean;
  recentHikes: boolean;
}
export interface ProfileData {
  heightCm?: number;
  weightEntries: WeightEntry[];
  photoId?: string;
  biologicalSex?: "female" | "male" | "other" | "prefer_not";
  familyProfileSharing?: FamilyProfileSharing;
}
export interface GoalConfig {
  weeklyCalories: number;
  categorySets: Partial<Record<ExerciseCategory, number>>;
  difficulty?: GoalDifficulty;
  difficultyWeek?: string;
  difficultyChanges?: number;
  weeklyPlans?: Record<string, { difficulty: GoalDifficulty; personalActivityId: PersonalActivityId; personalActivityIds?: PersonalActivityId[] }>;
  legacyPlan?: { difficulty: GoalDifficulty; personalActivityId: PersonalActivityId; personalActivityIds?: PersonalActivityId[] };
  // `any` and `jump_rope` remain readable for v0.12 backups and historical
  // weekly plans. v0.13 migrates either value to `none` for the current week.
  personalActivityId?: PersonalActivityId;
  personalActivityIds?: PersonalActivityId[];
}
export interface StoryRecord { id: string; ownerId: string; familyId: string; mediaId: string; createdAt: string; expiresAt: string; caption?: string; }

export interface EarnedMonthlyBadge {
  month: string;
  earnedAt: string;
  completed: number;
  available: number;
  required: number;
  scoringVersion: 1 | 2;
}

export interface ScienceState {
  scoringVersion: 2;
  exerciseDefaultsVersion: 2;
  effectiveFrom: string;
  earnedMonthlyBadges?: EarnedMonthlyBadge[];
}

export interface WorkoutPreferences {
  restTimerSound: boolean;
  keepScreenAwake: boolean;
}
export interface NotificationPreferences {
  goldDays: boolean;
  badges: boolean;
  pokes: boolean;
  mutedPokeUids?: string[];
  mutedPokeGroupIds?: string[];
}

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
  customSupplements?: CustomSupplement[];
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
  workoutPreferences?: WorkoutPreferences;
  notificationPreferences?: NotificationPreferences;
  notificationDefaultsV11_1Applied?: boolean;
  seenSocialEventIds?: string[];
  hikeBadgePreferences?: HikeBadgePreference[];
  science?: ScienceState;
  sync?: {
    deletedWorkoutIds?: string[];
    workoutPrivacyMigrated?: boolean;
    deletedHikeIds?: string[];
    preferencesDirty?: boolean;
    profileDirty?: boolean;
    profileCloudMigrated?: boolean;
    hydrationDirtyDates?: string[];
    familyDirtyDates?: string[];
    hydrationCloudMigrated?: boolean;
    supplementDirtyDates?: string[];
    supplementCloudMigrated?: boolean;
    lastSuccessfulSyncAt?: string;
  };
}
