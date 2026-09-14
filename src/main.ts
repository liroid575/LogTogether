import { t } from "./core/i18n.js";
import { EXERCISES, EXERCISE_LIBRARY_GROUPS, exerciseById, exerciseLibraryGroup, exerciseLoggingProfile, exerciseMuscleWeights, exerciseSessionMetricFlags } from "./core/exercises.js";
import { averagePace, completedSetCount, formatDuration } from "./core/metrics.js";
import { ALL_CATEGORIES, calorieMissionTargetDays, caloriesOnDate, categoryDistributionForDate, currentWeekBounds, dailyCalorieSeries, estimateWorkoutCalories, goalPreset, hydrationByDate, localDateKey, monthlyCalorieSeries, monthlyGoalScore, weekKey, weeklyCategorySets, weeklyGoalScore, weeklyHydrationSeries, workoutDurationMinutes, workoutsInCurrentWeek } from "./core/analytics.js";
import { clearLocalTestState, createBlankWorkout, createLocalBackup, forgetRememberedOfflineAccount, freshWorkoutFromPrevious, loadRememberedOfflineAccount, loadStateAsync, localStructuredStorageBackend, mergeLocalStateForCloud, parseLocalBackup, preferredLocalScope, rememberLocalScope, rememberOfflineAccount, resetState, routineFromWorkout, saveImportRollback, saveState, saveStateVerified, uid, workoutFromRoutine } from "./core/store.js";
import { diagnosticsJson } from "./core/diagnostics.js";
import { familyPrivacySummary } from "./core/privacy.js";
import type { AppState, ExerciseCategory, ExerciseDefinition, ExerciseLibraryGroup, GoalDifficulty, HikeBadgePreference, HikeRecord, HydrationDay, Locale, ProfileData, SetEntry, SupplementEntry, SupplementUnit, WorkoutExerciseEntry, WorkoutRecord, WorkoutRoutine } from "./core/types.js";
import { appCheckRuntimeStatus, claimFamilyInvite, cloudModeEnabled, createFamilyGroup, createFamilyInvite, DEFAULT_GROUP_ID, deleteCloudBadge, deleteCloudHike, deleteCloudWorkout, deleteFamilyGroup, ensureCloudGroupModel, loadCloudCompanionState, loadCloudHikes, loadCloudMembership, loadCloudWorkouts, observeFirebaseAuth, renameFamilyGroup, saveCloudBadges, saveCloudBodyMetrics, saveCloudHike, saveCloudHydrationDay, saveCloudPreferences, saveCloudSupplementDay, saveCloudWorkout, saveFamilyDailySummary, saveFamilyWeeklySummary, seedGoogleMemberIdentity, setFamilyMemberAccessStatus, setFamilyMemberGroup, setOwnerShareGroups, updateMyFamilyDisplayName, signInWithGoogle, signOutFirebase } from "./services/firebase-client.js";
import type { CloudBadgeRecord, CloudCompanionSnapshot, CloudFamilyDailySummary, CloudFamilyWeeklySummary, CloudHikeEnvelope, CloudMembership, CloudWorkoutEnvelope, CreatedFamilyInvite, FirebaseAuthUser } from "./services/firebase-client.js";
import { clearPrivateImages, deletePrivateImage, getPrivateImage, savePrivateImage } from "./core/media.js";
import { parseGpx } from "./core/gpx.js";
import { qrSvg } from "./core/qr.js";
import type { GpxPoint, GpxSummary } from "./core/gpx.js";

type Page = "home" | "history" | "water" | "family" | "familyMember" | "profile" | "settings" | "workout" | "hike";
type HistoryFilter = "all" | "workout" | "hike";
type TrendMode = "weekly" | "monthly";
type ConfirmAction =
  | { kind: "discard-active" }
  | { kind: "remove-exercise"; exerciseIndex: number }
  | { kind: "delete-workout"; id: string }
  | { kind: "delete-hike"; id: string }
  | { kind: "delete-routine"; id: string }
  | { kind: "revoke-member"; uid: string; name: string };
type WeightReminderAction =
  | { kind: "workout" }
  | { kind: "routine"; routineId: string }
  | { kind: "hike" }
  | { kind: "circuit" };

type HistoryActivity =
  | { kind: "workout"; id: string; date: string; workout: WorkoutRecord }
  | { kind: "hike"; id: string; date: string; hike: HikeRecord };

const APP_VERSION = "0.9.0";

const root = document.querySelector<HTMLDivElement>("#app")!;
if (!root) throw new Error("Missing #app root");

function inviteCodeFromLocation(): string | null {
  try {
    const hash = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
    const value = new URLSearchParams(hash).get("invite")?.trim() ?? "";
    return value && !value.includes("/") && value.length <= 128 ? value : null;
  } catch {
    return null;
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatBytes(bytes: number): string {
  const value = Math.max(0, bytes);
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KiB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(value < 10 * 1024 ** 2 ? 1 : 0)} MiB`;
  return `${(value / 1024 ** 3).toFixed(2)} GiB`;
}

function icon(name: "home" | "history" | "family" | "settings" | "dumbbell" | "mountain" | "drop" | "waterPill" | "back" | "trash" | "plus" | "chevron" | "check"): string {
  const common = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const paths: Record<string, string> = {
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/>',
    family: '<path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 20v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.1.36.31.7.6 1 .29.3.69.45 1.1.4h.1v4h-.1c-.41-.05-.81.1-1.1.4-.29.3-.5.64-.6 1Z"/>',
    dumbbell: '<path d="M6 7v10M18 7v10M3.5 9v6M20.5 9v6M6 12h12"/>',
    mountain: '<path d="m3 19 6-10 4 6 2-3 6 7H3Z"/><path d="m7.5 11.5 1.5 1.5 1.5-1.5"/>',
    drop: '<path d="M12 2s6 6.2 6 12a6 6 0 0 1-12 0c0-5.8 6-12 6-12Z"/>',
    waterPill: '<path d="M7.5 3S4 7 4 10.2a3.5 3.5 0 0 0 7 0C11 7 7.5 3 7.5 3Z"/><path d="M13.4 9.1a3 3 0 0 1 4.2 0l2.3 2.3a3 3 0 0 1-4.2 4.2l-2.3-2.3a3 3 0 0 1 0-4.2Z"/><path d="m14.5 14.4 4.2-4.2"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    check: '<path d="m5 12 4 4L19 6"/>'
  };
  return `<svg ${common}>${paths[name]}</svg>`;
}

const LIBRARY_GROUP_ORDER: ExerciseLibraryGroup[] = [...EXERCISE_LIBRARY_GROUPS];

const ACCENT_PRESETS = [
  { id: "mint", label: "Mint", color: "#62d995" },
  { id: "pink", label: "Pink", color: "#f47eb4" },
  { id: "purple", label: "Purple", color: "#a98af5" },
  { id: "orange", label: "Orange", color: "#f2a65a" }
] as const;

const SUPPLEMENTS = [
  { id: "multivitamin", en: "Multivitamin", zh: "綜合維他命" },
  { id: "vitamin_a", en: "Vitamin A", zh: "維生素 A" },
  { id: "vitamin_b1", en: "Vitamin B1 (Thiamine)", zh: "維生素 B1（硫胺素）" },
  { id: "vitamin_b2", en: "Vitamin B2 (Riboflavin)", zh: "維生素 B2（核黃素）" },
  { id: "vitamin_b3", en: "Vitamin B3 (Niacin)", zh: "維生素 B3（菸鹼酸）" },
  { id: "vitamin_b5", en: "Vitamin B5", zh: "維生素 B5" },
  { id: "vitamin_b6", en: "Vitamin B6", zh: "維生素 B6" },
  { id: "vitamin_b7", en: "Vitamin B7 (Biotin)", zh: "維生素 B7（生物素）" },
  { id: "vitamin_b9", en: "Vitamin B9 (Folate)", zh: "維生素 B9（葉酸）" },
  { id: "vitamin_b12", en: "Vitamin B12", zh: "維生素 B12" },
  { id: "vitamin_c", en: "Vitamin C", zh: "維生素 C" },
  { id: "vitamin_d3", en: "Vitamin D3", zh: "維生素 D3" },
  { id: "vitamin_e", en: "Vitamin E", zh: "維生素 E" },
  { id: "vitamin_k2", en: "Vitamin K2", zh: "維生素 K2" },
  { id: "calcium", en: "Calcium", zh: "鈣" },
  { id: "magnesium", en: "Magnesium", zh: "鎂" },
  { id: "zinc", en: "Zinc", zh: "鋅" },
  { id: "iron", en: "Iron", zh: "鐵" },
  { id: "selenium", en: "Selenium", zh: "硒" },
  { id: "copper", en: "Copper", zh: "銅" },
  { id: "iodine", en: "Iodine", zh: "碘" },
  { id: "potassium", en: "Potassium", zh: "鉀" },
  { id: "chromium", en: "Chromium", zh: "鉻" },
  { id: "manganese", en: "Manganese", zh: "錳" },
  { id: "omega_3", en: "Omega-3 / Fish oil", zh: "Omega-3／魚油" },
  { id: "creatine", en: "Creatine monohydrate", zh: "一水肌酸" },
  { id: "whey_protein", en: "Whey protein", zh: "乳清蛋白" },
  { id: "plant_protein", en: "Plant protein", zh: "植物蛋白" },
  { id: "collagen", en: "Collagen", zh: "膠原蛋白" },
  { id: "probiotic", en: "Probiotic", zh: "益生菌" },
  { id: "prebiotic", en: "Prebiotic", zh: "益生元" },
  { id: "psyllium", en: "Psyllium / Fiber", zh: "洋車前子／纖維" },
  { id: "electrolytes", en: "Electrolytes", zh: "電解質" },
  { id: "coq10", en: "CoQ10", zh: "輔酶 Q10" },
  { id: "glucosamine", en: "Glucosamine", zh: "葡萄糖胺" },
  { id: "chondroitin", en: "Chondroitin", zh: "軟骨素" },
  { id: "msm", en: "MSM", zh: "MSM（甲基硫醯基甲烷）" },
  { id: "curcumin", en: "Turmeric / Curcumin", zh: "薑黃／薑黃素" },
  { id: "ashwagandha", en: "Ashwagandha", zh: "南非醉茄" },
  { id: "ginseng", en: "Ginseng", zh: "人參" },
  { id: "melatonin", en: "Melatonin", zh: "褪黑激素" },
  { id: "caffeine", en: "Caffeine", zh: "咖啡因" },
  { id: "beta_alanine", en: "Beta-alanine", zh: "β-丙胺酸" },
  { id: "citrulline", en: "Citrulline / Citrulline malate", zh: "瓜胺酸／蘋果酸瓜胺酸" },
  { id: "bcaa", en: "BCAA", zh: "BCAA 支鏈胺基酸" },
  { id: "eaa", en: "EAA", zh: "EAA 必需胺基酸" },
  { id: "l_carnitine", en: "L-Carnitine", zh: "左旋肉鹼" },
  { id: "nac", en: "NAC", zh: "NAC（N-乙醯半胱胺酸）" },
  { id: "alpha_lipoic_acid", en: "Alpha-lipoic acid", zh: "α-硫辛酸" },
  { id: "lutein_zeaxanthin", en: "Lutein + Zeaxanthin", zh: "葉黃素＋玉米黃素" }
] as const;

const SUPPLEMENT_UNITS: SupplementUnit[] = ["serving","capsule","tablet","mg","mcg","g","IU","scoop","drop"];

function normalizeHex(value: string | undefined): string {
  return /^#[0-9a-fA-F]{6}$/.test(value ?? "") ? value! : "#62d995";
}

function contrastForHex(hex: string): string {
  const value = normalizeHex(hex).slice(1);
  const r = parseInt(value.slice(0,2),16), g = parseInt(value.slice(2,4),16), b = parseInt(value.slice(4,6),16);
  const luminance = (0.299*r + 0.587*g + 0.114*b) / 255;
  return luminance > 0.62 ? "#102018" : "#ffffff";
}

class FamilyExerciseApp {
  private offlineAccount: ReturnType<typeof loadRememberedOfflineAccount>;
  private localScope: string;
  private state: AppState;
  private networkOnline = navigator.onLine;
  private authObserverAttached = false;
  private authInitBusy = false;
  private page: Page = "home";
  private timerId: number | null = null;
  private pendingExerciseId = EXERCISES[0]?.id ?? "barbell_bench_press";
  private exerciseLibraryFilter: ExerciseLibraryGroup | "all" = "all";
  private historyFilter: HistoryFilter = "all";
  private expandedHistoryKey: string | null = null;
  private expandedExerciseKey: string | null = null;
  private trendMode: TrendMode = "weekly";
  private monthlyTrendStart = new Date(new Date().getFullYear(), 0, 1);
  private workoutTrendWeekOffset = 0;
  private waterWeekOffset = 0;
  private calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  private selectedCalendarDate = localDateKey(new Date());
  private waterCalendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  private selectedWaterDate = localDateKey(new Date());
  private restSource: { exerciseIndex: number; setIndex: number; startedAt: number; targetSec: number } | null = null;
  private confirmAction: ConfirmAction | null = null;
  private pendingSetRemovalKey: string | null = null;
  private pendingCircuitRoundRemovalIndex: number | null = null;
  private weightReminderAction: WeightReminderAction | null = null;
  private toastTimer: number | null = null;
  private mediaUrls: string[] = [];
  private showCircuitBuilder = false;
  private circuitDraftName = "Daily Circuit";
  private circuitDraftRounds = 3;
  private circuitDraftRows: Array<{ exerciseId: string; reps: number; weightKg: number; durationSec: number; distanceKm: number; minutes: number; restSec: number }> = [
    { exerciseId: "pull_up", reps: 7, weightKg: 0, durationSec: 30, distanceKm: 1, minutes: 10, restSec: 45 },
    { exerciseId: "push_up", reps: 25, weightKg: 0, durationSec: 30, distanceKm: 1, minutes: 10, restSec: 45 },
    { exerciseId: "bodyweight_squat", reps: 40, weightKg: 0, durationSec: 30, distanceKm: 1, minutes: 10, restSec: 45 },
    { exerciseId: "bodyweight_calf_raise", reps: 60, weightKg: 0, durationSec: 30, distanceKm: 1, minutes: 10, restSec: 45 }
  ];
  private selectedFamilyMemberUid: string | null = null;
  private previewGoalMode: GoalDifficulty | null = null;
  private pendingHikeGpx: GpxSummary | null = null;
  private editingHikeId: string | null = null;
  private showGoalDifficultyMenu = false;
  private authUser: FirebaseAuthUser | null = null;
  private authReady = true;
  private authError: string | null = null;
  private cloudMembership: CloudMembership | null = null;
  private cloudMembershipReady = true;
  private pendingInviteCode: string | null = null;
  private cloudAccessRequested = false;
  private cloudMembershipError: string | null = null;
  private createdInvite: CreatedFamilyInvite | null = null;
  private cloudActionBusy = false;
  private familyAccessEditing = false;
  private cloudWorkoutReady = !cloudModeEnabled();
  private cloudWorkoutBusy = false;
  private cloudWorkoutError: string | null = null;
  private cloudHikeError: string | null = null;
  private cloudFamilyWorkouts: CloudWorkoutEnvelope[] = [];
  private cloudFamilyHikes: CloudHikeEnvelope[] = [];
  private cloudFamilyDaily: CloudFamilyDailySummary[] = [];
  private cloudFamilyWeekly: CloudFamilyWeeklySummary[] = [];
  private cloudFamilyBadges: CloudBadgeRecord[] = [];
  private cloudOwnBadges: CloudBadgeRecord[] = [];
  private cloudCompanionReady = !cloudModeEnabled();
  private cloudCompanionBusy = false;
  private cloudCompanionError: string | null = null;
  private familyComparisonMetric: "calories" | "water" = "calories";
  private familyComparisonFocus: "self" | "member" = "member";
  private supplementWeekFilter = "all";
  private hikeBadgeEditMode = false;

  constructor(initialState: AppState, initialScope: string, offlineAccount: ReturnType<typeof loadRememberedOfflineAccount>, inviteCode: string | null) {
    this.state = initialState;
    this.localScope = initialScope;
    this.offlineAccount = offlineAccount;
    this.pendingInviteCode = inviteCode;
    this.cloudAccessRequested = Boolean(inviteCode || offlineAccount);
    this.ensureExtendedState();
    this.restoreRestFromActiveWorkout();
    this.persist();
    this.applyTheme();
    window.addEventListener("online", () => this.handleConnectivityChange(true));
    window.addEventListener("offline", () => this.handleConnectivityChange(false));
    this.render();
    if (this.cloudAccessRequested) void this.initializeAuthentication();
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("/sw.js").catch(error => console.warn("Service worker:", error));
    }
  }

  private handleConnectivityChange(online: boolean): void {
    this.networkOnline = online;
    this.render();
    if (!online || !cloudModeEnabled() || !this.cloudAccessRequested) return;
    if (this.authUser) {
      void this.refreshCloudMembership(this.authUser);
      return;
    }
    if (!this.authObserverAttached && !this.authInitBusy) void this.initializeAuthentication();
  }

  private ensureExtendedState(): void {
    // Existing saved routines are preserved, but an intentionally empty state
    // must stay empty. Demo defaults live in demoState() instead.
    this.state.routines ??= [];
    this.state.profile ??= { weightEntries: [] };
    this.state.largeText ??= false;
    this.state.textScale ??= this.state.largeText ? 125 : 100;
    this.state.textScale = clamp(Math.round(this.state.textScale / 10) * 10, 100, 140);
    this.state.goals ??= { weeklyCalories: 1050, categorySets: { chest:2, back:2, shoulders:1, arms:2, legs:2, core:2, cardio:1, mobility:1 }, difficulty: "normal", difficultyWeek: weekKey(), difficultyChanges: 0 };
    if (!this.state.goals.difficulty) {
      const preset = goalPreset("normal");
      this.state.goals = { ...this.state.goals, ...preset, difficulty: "normal", difficultyWeek: weekKey(), difficultyChanges: 0 };
    }
    if (this.state.goals.difficultyWeek !== weekKey()) { this.state.goals.difficultyWeek = weekKey(); this.state.goals.difficultyChanges = 0; }
    this.state.hydrationHistory ??= [];
    this.state.supplementHistory ??= [];
    this.state.hikeBadgePreferences ??= [];
    const today = localDateKey(new Date());
    if (this.state.hydration.date !== today) {
      if (!this.state.hydrationHistory.some(day => day.date === this.state.hydration.date)) this.state.hydrationHistory.push(structuredClone(this.state.hydration));
      const previousTarget = this.state.hydration.targetMl || 2000;
      this.state.hydration = { schemaVersion: 1, date: today, userId: this.state.user.id, familyId: this.state.user.familyId, targetMl: previousTarget, totalMl: 0, entries: [], visibility: "private" };
    }
    this.state.accentColor ??= "#62d995";
    this.state.stories ??= [];
    this.state.sync ??= { deletedWorkoutIds: [] };
    this.state.sync.deletedWorkoutIds ??= [];
    const now = Date.now();
    const expired = this.state.stories.filter(story => new Date(story.expiresAt).getTime() <= now);
    this.state.stories = this.state.stories.filter(story => new Date(story.expiresAt).getTime() > now);
    expired.forEach(story => void deletePrivateImage(story.mediaId).catch(() => undefined));
  }

  private async handleObservedAuthState(user: FirebaseAuthUser | null): Promise<void> {
    this.authUser = user;
    this.authReady = true;
    this.authError = null;
    this.createdInvite = null;
    if (!user) {
      // Local mode deliberately does not initialize Firebase. A previously
      // approved Cloud account may keep using its UID-scoped local cache while
      // offline; an online signed-out device simply stays Local until the owner
      // access link (or an approved reconnect marker) is used again.
      this.cloudMembershipReady = true;
      if (!this.networkOnline && this.offlineAccount?.cloudApproved) {
        this.render();
        return;
      }
      if (!this.pendingInviteCode && !this.offlineAccount?.cloudApproved) {
        this.cloudMembership = null;
        this.clearSharedCloudSnapshots();
      }
      this.render();
      return;
    }
    void this.refreshCloudMembership(user);
  }

  private clearSharedCloudSnapshots(): void {
    this.cloudWorkoutReady = true;
    this.cloudWorkoutBusy = false;
    this.cloudWorkoutError = null;
    this.cloudHikeError = null;
    this.cloudFamilyWorkouts = [];
    this.cloudFamilyHikes = [];
    this.cloudCompanionReady = true;
    this.cloudCompanionBusy = false;
    this.cloudCompanionError = null;
    this.cloudFamilyDaily = [];
    this.cloudFamilyWeekly = [];
    this.cloudFamilyBadges = [];
    this.cloudOwnBadges = [];
  }

  private async initializeAuthentication(): Promise<void> {
    if (!cloudModeEnabled() || !this.cloudAccessRequested) {
      this.authReady = true;
      this.cloudMembershipReady = true;
      return;
    }
    if (this.authObserverAttached || this.authInitBusy) return;
    this.authInitBusy = true;
    this.authReady = false;
    this.cloudMembershipReady = false;
    this.render();
    try {
      await observeFirebaseAuth(user => { void this.handleObservedAuthState(user); });
      this.authObserverAttached = true;
    } catch (error) {
      this.authReady = true;
      this.cloudMembershipReady = true;
      this.authError = error instanceof Error ? error.message : "Authentication failed";
      console.warn("Firebase Auth:", error);
      this.render();
    } finally {
      this.authInitBusy = false;
    }
  }

  private async promoteLocalDataToCloud(user: FirebaseAuthUser, membership: CloudMembership): Promise<void> {
    const targetScope = `uid:${user.uid}`;
    if (this.localScope === targetScope && this.state.user.id === user.uid && this.state.user.familyId === membership.access.familyId) {
      rememberLocalScope(targetScope);
      return;
    }
    const sourceState = structuredClone(this.state);
    saveImportRollback(sourceState, this.localScope || "guest");
    const existingTarget = await loadStateAsync(false, targetScope);
    const merged = mergeLocalStateForCloud(sourceState, existingTarget, user.uid, membership.access.familyId);
    await saveStateVerified(merged, targetScope);
    this.localScope = targetScope;
    rememberLocalScope(targetScope);
    this.state = merged;
    this.ensureExtendedState();
    this.applyTheme();
  }

  private async detachCloudSession(message?: string): Promise<void> {
    forgetRememberedOfflineAccount();
    this.offlineAccount = null;
    rememberLocalScope(this.localScope || "guest");
    this.cloudMembership = null;
    this.clearSharedCloudSnapshots();
    if (message) this.cloudMembershipError = message;
    try { await signOutFirebase(); } catch { /* Access is already fail-closed in rules. */ }
    this.authUser = null;
    if (!this.pendingInviteCode) this.cloudAccessRequested = false;
  }

  private async refreshCloudMembership(user: FirebaseAuthUser = this.authUser!): Promise<void> {
    if (!user) return;
    this.cloudMembershipReady = false;
    this.cloudMembershipError = null;
    this.render();
    try {
      let membership = await loadCloudMembership(user);
      let claimedNow = false;
      if (!membership && this.pendingInviteCode) {
        membership = await claimFamilyInvite(user, this.pendingInviteCode);
        claimedNow = true;
      }

      if (!membership || membership.access.status !== "active") {
        const revoked = membership?.access.status === "revoked";
        const message = revoked
          ? (this.locale === "zh-TW" ? "Cloud 權限已被擁有者撤銷；此裝置已回到 Local，個人本機紀錄仍保留。" : "Cloud access was revoked by the owner. This device is Local again and your personal on-device records remain available.")
          : (this.pendingInviteCode
              ? (this.locale === "zh-TW" ? "此 Google 帳號沒有可用的 Cloud 邀請。" : "This Google account does not have usable Cloud access for this invitation.")
              : (this.locale === "zh-TW" ? "這個舊 Google 登入沒有 Cloud 權限，已自動回到 Local。" : "This older Google sign-in has no Cloud authorization and was returned to Local automatically."));
        await this.detachCloudSession(message);
        return;
      }

      if (membership.access.role === "owner") membership = await ensureCloudGroupModel(user, membership);
      await this.promoteLocalDataToCloud(user, membership);

      // A successful active access check is the only place that marks a Google
      // identity as approved for future Cloud/offline boot. Random public users
      // therefore never leave a Firebase-auth marker behind.
      this.offlineAccount = rememberOfflineAccount(user, true);
      this.cloudAccessRequested = true;

      if (claimedNow) {
        const localName = this.state.user.displayName.trim();
        if (localName && localName !== "Family member") {
          membership = await updateMyFamilyDisplayName(user, membership, localName, this.state.profile?.biologicalSex);
        }
        // The invite has been consumed. Remove it from the address bar so a
        // later screenshot/share does not accidentally include the access link.
        this.pendingInviteCode = null;
        history.replaceState(null, "", `${location.pathname}${location.search}`);
      }

      membership = await seedGoogleMemberIdentity(user, membership);
      this.cloudMembership = membership;
      this.seedLocalIdentity(user, membership);
      await this.syncCloudWorkouts(user, membership);
      await this.syncCloudHikes(user, membership);
      await this.syncCloudCompanionData(user, membership);
      if (!this.cloudWorkoutError && !this.cloudHikeError && !this.cloudCompanionError) {
        this.state.sync ??= {};
        this.state.sync.lastSuccessfulSyncAt = new Date().toISOString();
        this.persist();
      }
    } catch (error) {
      this.cloudMembershipError = this.cloudErrorMessage(error);
      console.warn("Firebase family membership:", error);
      // A failed invite attempt should not leave a random Google account signed
      // into the public tracker. Keep the invite URL available for another try.
      if (this.pendingInviteCode && this.authUser) {
        try { await signOutFirebase(); } catch { /* Best effort. */ }
        this.authUser = null;
      }
    } finally {
      this.cloudMembershipReady = true;
      this.render();
    }
  }

  private async switchLocalScope(scope: string): Promise<void> {
    const nextState = await loadStateAsync(false, scope);
    this.localScope = rememberLocalScope(scope);
    this.state = nextState;
    this.ensureExtendedState();
    this.applyTheme();
  }

  private workoutStamp(workout: WorkoutRecord): string {
    return workout.updatedAt ?? workout.completedAt ?? workout.startedAt;
  }

  private hikeStamp(hike: HikeRecord): string {
    return hike.updatedAt ?? `${hike.date}T12:00:00.000Z`;
  }

  private effectiveLocalUid(): string {
    return this.authUser?.uid ?? this.offlineAccount?.uid ?? this.state.user.id;
  }

  private pendingCloudChangesCount(): number {
    const uid = this.effectiveLocalUid();
    const sync = this.state.sync ?? {};
    let pending = 0;
    for (const workout of this.state.workouts) {
      if (!workout.completedAt || workout.ownerId !== uid) continue;
      if (!workout.cloudSyncedAt || this.workoutStamp(workout) > workout.cloudSyncedAt) pending += 1;
    }
    for (const hike of this.state.hikes) {
      if (hike.ownerId !== uid) continue;
      if (!hike.cloudSyncedAt || this.hikeStamp(hike) > hike.cloudSyncedAt) pending += 1;
    }
    pending += (sync.deletedWorkoutIds ?? []).length;
    pending += (sync.deletedHikeIds ?? []).length;
    pending += (sync.hydrationDirtyDates ?? []).length;
    pending += (sync.supplementDirtyDates ?? []).length;
    if (sync.preferencesDirty) pending += 1;
    if (sync.profileDirty) pending += 1;
    return pending;
  }

  private localStructuredRecordCount(): number {
    return this.state.workouts.length
      + this.state.hikes.length
      + this.allHydrationDays().reduce((sum, day) => sum + day.entries.length, 0)
      + this.allSupplementDays().reduce((sum, day) => sum + day.entries.length, 0)
      + (this.state.profile?.weightEntries ?? []).length;
  }

  private lastSyncLabel(): string {
    const raw = this.state.sync?.lastSuccessfulSyncAt;
    if (!raw) return this.locale === "zh-TW" ? "尚未完成雲端同步" : "No completed cloud sync yet";
    const date = new Date(raw);
    if (!Number.isFinite(date.getTime())) return this.locale === "zh-TW" ? "尚未完成雲端同步" : "No completed cloud sync yet";
    return this.locale === "zh-TW"
      ? `上次同步 ${date.toLocaleString("zh-TW", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" })}`
      : `Last synced ${date.toLocaleString(undefined, { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" })}`;
  }

  private workoutCaloriesForSync(workout: WorkoutRecord): number {
    if (Number.isFinite(workout.estimatedCalories) && (workout.estimatedCalories ?? 0) > 0) {
      return Math.max(1, Math.round(workout.estimatedCalories ?? 0));
    }
    const withoutSnapshot = { ...workout, estimatedCalories: undefined };
    return estimateWorkoutCalories(withoutSnapshot, this.currentWeightKg());
  }

  private async syncCloudWorkouts(user: FirebaseAuthUser, membership: CloudMembership): Promise<void> {
    if (membership.access.status !== "active" || this.cloudWorkoutBusy) return;
    this.cloudWorkoutBusy = true;
    this.cloudWorkoutReady = false;
    this.cloudWorkoutError = null;
    this.render();
    try {
      this.state.sync ??= {};
      if (this.state.sync.workoutPrivacyMigrated !== true) {
        // v0.7 removes the sharing selector for new workouts. Preserve any
        // already-saved legacy private records rather than silently publishing
        // old history; new and re-saved workouts are always family-visible.
        for (const workout of this.state.workouts) {
          if (workout.ownerId !== user.uid || workout.cloudSyncedAt) continue;
          workout.familyId = membership.access.familyId;
          // Keep any legacy private/selected visibility exactly as the user had it.
          // Editing and re-saving the workout later upgrades it to Family sharing.
          workout.updatedAt ??= workout.completedAt ?? workout.startedAt;
        }
        this.state.sync.workoutPrivacyMigrated = true;
        this.persist();
      }
      const tombstones = new Set(this.state.sync.deletedWorkoutIds ?? []);
      for (const id of [...tombstones]) {
        try {
          await deleteCloudWorkout(user, membership, id);
          tombstones.delete(id);
        } catch {
          // Keep the tombstone so a temporary network failure can be retried
          // without resurrecting a deleted workout from Firestore.
        }
      }
      this.state.sync.deletedWorkoutIds = [...tombstones];

      const snapshot = await loadCloudWorkouts(user, membership);
      const cloudOwn = new Map(snapshot.own.map(item => [item.workout.id, item]));
      const localById = new Map(this.state.workouts.map(item => [item.id, item]));
      const uploaded: CloudWorkoutEnvelope[] = [];

      for (const local of this.state.workouts) {
        if (!local.completedAt || local.ownerId !== user.uid || local.familyId !== membership.access.familyId) continue;
        if (tombstones.has(local.id)) continue;
        const cloud = cloudOwn.get(local.id);
        if (!cloud) {
          if (local.cloudSyncedAt) {
            // This record existed in the cloud before and is now absent there.
            // Treat the cloud deletion as authoritative rather than resurrecting it.
            continue;
          }
          local.updatedAt ??= local.completedAt;
          local.estimatedCalories = this.workoutCaloriesForSync(local);
          const saved = await saveCloudWorkout(user, membership, local, local.estimatedCalories);
          local.cloudSyncedAt = new Date().toISOString();
          uploaded.push({ ...saved, workout: { ...saved.workout, cloudSyncedAt: local.cloudSyncedAt } });
          cloudOwn.set(local.id, uploaded.at(-1)!);
          continue;
        }
        if (this.workoutStamp(local) > this.workoutStamp(cloud.workout)) {
          local.estimatedCalories = this.workoutCaloriesForSync(local);
          const saved = await saveCloudWorkout(user, membership, local, local.estimatedCalories);
          local.cloudSyncedAt = new Date().toISOString();
          const envelope = { ...saved, workout: { ...saved.workout, cloudSyncedAt: local.cloudSyncedAt } };
          uploaded.push(envelope);
          cloudOwn.set(local.id, envelope);
        }
      }

      const merged: WorkoutRecord[] = [];
      const cloudIds = new Set<string>();
      for (const envelope of cloudOwn.values()) {
        cloudIds.add(envelope.workout.id);
        if (tombstones.has(envelope.workout.id)) continue;
        const local = localById.get(envelope.workout.id);
        if (local && this.workoutStamp(local) > this.workoutStamp(envelope.workout)) {
          merged.push(local);
        } else {
          merged.push({
            ...envelope.workout,
            ...(local?.photoId ? { photoId: local.photoId } : {}),
            estimatedCalories: envelope.estimatedCalories,
            cloudSyncedAt: new Date().toISOString()
          });
        }
      }
      for (const local of this.state.workouts) {
        if (cloudIds.has(local.id) || tombstones.has(local.id)) continue;
        if (local.ownerId === user.uid && local.familyId === membership.access.familyId && local.cloudSyncedAt) continue;
        merged.push(local);
      }
      this.state.workouts = merged.sort((a,b) => (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt));

      const familyMap = new Map(snapshot.familyShared.map(item => [item.workout.id, item]));
      for (const item of uploaded) if (item.workout.visibility === "family") familyMap.set(item.workout.id, item);
      this.cloudFamilyWorkouts = [...familyMap.values()].filter(item => !tombstones.has(item.workout.id));
      this.persist();
    } catch (error) {
      this.cloudWorkoutError = this.cloudErrorMessage(error);
      console.warn("Firebase workout sync:", error);
    } finally {
      this.cloudWorkoutBusy = false;
      this.cloudWorkoutReady = true;
      this.render();
    }
  }

  private async syncCloudHikes(user: FirebaseAuthUser, membership: CloudMembership): Promise<void> {
    if (membership.access.status !== "active") return;
    try {
      this.state.sync ??= {};
      this.state.sync.deletedHikeIds ??= [];
      const tombstones = new Set(this.state.sync.deletedHikeIds);
      for (const id of [...tombstones]) {
        try {
          await deleteCloudHike(user, membership, id);
          tombstones.delete(id);
        } catch {
          // Keep the tombstone for retry so a temporary failure cannot resurrect a deleted hike.
        }
      }
      this.state.sync.deletedHikeIds = [...tombstones];

      const snapshot = await loadCloudHikes(user, membership);
      const cloudOwn = new Map(snapshot.own.map(item => [item.hike.id, item]));
      const localById = new Map(this.state.hikes.map(item => [item.id, item]));
      const uploaded: CloudHikeEnvelope[] = [];

      for (const local of this.state.hikes) {
        if (local.ownerId !== user.uid || local.familyId !== membership.access.familyId || tombstones.has(local.id)) continue;
        // v0.7 makes hike metadata family-visible by design. Exact GPX traces and photos remain local.
        local.visibility = "family";
        local.selectedViewerIds = [];
        local.updatedAt ??= `${local.date}T12:00:00.000Z`;
        const cloud = cloudOwn.get(local.id);
        if (!cloud) {
          if (local.cloudSyncedAt) continue;
          const saved = await saveCloudHike(user, membership, local);
          local.cloudSyncedAt = new Date().toISOString();
          const envelope = { ...saved, hike: { ...saved.hike, cloudSyncedAt: local.cloudSyncedAt, ...(local.photoId ? { photoId: local.photoId } : {}), ...(local.routePoints ? { routePoints: local.routePoints, routeSource: local.routeSource } : {}) } };
          uploaded.push(envelope);
          cloudOwn.set(local.id, envelope);
          continue;
        }
        if (this.hikeStamp(local) > this.hikeStamp(cloud.hike)) {
          const saved = await saveCloudHike(user, membership, local);
          local.cloudSyncedAt = new Date().toISOString();
          const envelope = { ...saved, hike: { ...saved.hike, cloudSyncedAt: local.cloudSyncedAt, ...(local.photoId ? { photoId: local.photoId } : {}), ...(local.routePoints ? { routePoints: local.routePoints, routeSource: local.routeSource } : {}) } };
          uploaded.push(envelope);
          cloudOwn.set(local.id, envelope);
        }
      }

      const merged: HikeRecord[] = [];
      const cloudIds = new Set<string>();
      for (const envelope of cloudOwn.values()) {
        cloudIds.add(envelope.hike.id);
        if (tombstones.has(envelope.hike.id)) continue;
        const local = localById.get(envelope.hike.id);
        if (local && this.hikeStamp(local) > this.hikeStamp(envelope.hike)) {
          merged.push(local);
        } else {
          merged.push({
            ...envelope.hike,
            ...(local?.photoId ? { photoId: local.photoId } : {}),
            ...(local?.routePoints ? { routePoints: local.routePoints, routeSource: local.routeSource } : {}),
            cloudSyncedAt: new Date().toISOString()
          });
        }
      }
      for (const local of this.state.hikes) {
        if (cloudIds.has(local.id) || tombstones.has(local.id)) continue;
        if (local.ownerId === user.uid && local.familyId === membership.access.familyId && local.cloudSyncedAt) continue;
        merged.push(local);
      }
      this.state.hikes = merged.sort((a,b) => b.date.localeCompare(a.date));

      const familyMap = new Map(snapshot.familyShared.map(item => [item.hike.id, item]));
      for (const item of uploaded) familyMap.set(item.hike.id, item);
      this.cloudFamilyHikes = [...familyMap.values()].filter(item => !tombstones.has(item.hike.id));
      this.cloudHikeError = null;
      this.persist();
    } catch (error) {
      this.cloudHikeError = this.cloudErrorMessage(error);
      console.warn("Firebase hike sync:", error);
    }
  }

  private allHydrationDays(): HydrationDay[] {
    const byDate = new Map<string, HydrationDay>();
    for (const day of this.state.hydrationHistory ?? []) byDate.set(day.date, day);
    byDate.set(this.state.hydration.date, this.state.hydration);
    return [...byDate.values()].sort((a,b) => a.date.localeCompare(b.date));
  }

  private allSupplementDays() {
    return (this.state.supplementHistory ?? []).slice().sort((a,b) => a.date.localeCompare(b.date));
  }

  private mergeSupplementForFirstCloudSync(local: { date: string; entries: SupplementEntry[] }, cloud?: { date: string; entries: SupplementEntry[] }) {
    if (!cloud) return structuredClone(local);
    const entries = new Map(cloud.entries.map(entry => [entry.id, { ...entry }]));
    for (const entry of local.entries) entries.set(entry.id, { ...entry });
    return { date: local.date, entries: [...entries.values()].sort((a,b) => a.at.localeCompare(b.at)) };
  }

  private applyCloudSupplements(days: Array<{ date: string; entries: SupplementEntry[] }>): void {
    this.state.supplementHistory = days
      .filter(day => day.entries.length > 0)
      .map(day => ({ date: day.date, entries: day.entries.map(entry => ({ ...entry })) }))
      .sort((a,b) => a.date.localeCompare(b.date));
  }

  private cloudPreferenceValue() {
    return {
      locale: this.state.locale,
      theme: this.state.theme,
      simpleMode: this.state.simpleMode,
      accentColor: normalizeHex(this.state.accentColor),
      weeklyWorkoutGoal: this.state.weeklyWorkoutGoal ?? 3,
      goals: structuredClone(this.state.goals!),
      hikeBadgePreferences: structuredClone(this.state.hikeBadgePreferences ?? [])
    };
  }

  private hikeBadgePreference(hikeId: string): HikeBadgePreference | undefined {
    return (this.state.hikeBadgePreferences ?? []).find(item => item.hikeId === hikeId);
  }

  private setHikeBadgePreference(hikeId: string, patch: Partial<HikeBadgePreference>): void {
    this.state.hikeBadgePreferences ??= [];
    const index = this.state.hikeBadgePreferences.findIndex(item => item.hikeId === hikeId);
    const current = index >= 0 ? this.state.hikeBadgePreferences[index]! : { hikeId };
    const next: HikeBadgePreference = { ...current, ...patch, hikeId };
    if (!next.title) delete next.title;
    if (!next.hidden) delete next.hidden;
    if (!Number.isFinite(next.order)) delete next.order;
    if (index >= 0) this.state.hikeBadgePreferences[index] = next;
    else this.state.hikeBadgePreferences.push(next);
  }

  private hikeBadgeTitle(hike: HikeRecord): string {
    return this.hikeBadgePreference(hike.id)?.title?.trim() || hike.name;
  }

  private async pushBadgePresentationToCloud(deleteBadgeId?: string): Promise<void> {
    await this.pushPreferencesToCloud();
    if (!this.authUser || this.cloudMembership?.access.status !== "active") return;
    try {
      if (deleteBadgeId) await deleteCloudBadge(this.authUser, this.cloudMembership, deleteBadgeId);
      const badges = this.shareableBadges();
      await this.pruneStaleCloudHikeBadges(this.authUser, this.cloudMembership, badges);
      await saveCloudBadges(this.authUser, this.cloudMembership, badges);
      if (deleteBadgeId) {
        const cloudId = `${this.authUser.uid}_${deleteBadgeId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0,120)}`;
        this.cloudOwnBadges = this.cloudOwnBadges.filter(badge => badge.id !== cloudId);
        this.cloudFamilyBadges = this.cloudFamilyBadges.filter(badge => badge.id !== cloudId);
      }
    } catch (error) {
      this.cloudCompanionError = this.cloudErrorMessage(error);
      this.render();
    }
  }

  private shareableBadges(): Array<{ id: string; badgeType: "monthly" | "hike"; title: string; subtitle: string; earnedAt: string; sortOrder?: number; sourceHikeId?: string }> {
    const monthly = Array.from({length:12},(_,offset)=>{
      const d=new Date(); d.setMonth(d.getMonth()-offset,1);
      const end=new Date(d.getFullYear(),d.getMonth()+1,0,23,59,59);
      const score=monthlyGoalScore(this.state.workouts,this.state.hikes,this.currentWeightKg(),this.state.goals!,this.state.hydration,this.state.hydrationHistory ?? [],end);
      return { d, score };
    }).filter(item=>item.score>=35).map(item=>({
      id:`monthly-${item.d.getFullYear()}-${String(item.d.getMonth()+1).padStart(2,"0")}`,
      badgeType:"monthly" as const,
      title:item.d.toLocaleDateString(this.locale,{month:"short",year:"numeric"}),
      subtitle:this.locale === "zh-TW" ? "月度徽章" : "Monthly badge",
      earnedAt:new Date(item.d.getFullYear(),item.d.getMonth()+1,0,12,0,0).toISOString()
    }));
    const hikes=this.hikingBadges().map((hike,index)=>({
      id:`hike-${hike.id}`,
      badgeType:"hike" as const,
      title:this.hikeBadgeTitle(hike).slice(0,100),
      subtitle:this.locale === "zh-TW" ? "健行徽章" : "Hiking badge",
      earnedAt:new Date(`${hike.date}T12:00:00`).toISOString(),
      sortOrder:index,
      sourceHikeId:hike.id
    }));
    return [...monthly,...hikes];
  }

  private currentWeekFamilySummaries(): Array<{ date: string; calories: number; waterMl: number; workoutCount: number }> {
    const { start } = currentWeekBounds(new Date());
    const calories = new Map(dailyCalorieSeries(this.state.workouts,this.state.hikes,this.currentWeightKg()).map(point=>[point.key,point.count]));
    const water = hydrationByDate(this.state.hydration,this.state.hydrationHistory ?? []);
    return Array.from({length:7},(_,index)=>{
      const day=new Date(start); day.setDate(start.getDate()+index);
      const date=localDateKey(day);
      const workoutCount=this.state.workouts.filter(workout=>workout.completedAt && localDateKey(workout.completedAt)===date).length;
      return { date, calories:Math.max(0,Math.round(calories.get(date) ?? 0)), waterMl:Math.max(0,Math.round(water.get(date)?.totalMl ?? 0)), workoutCount };
    });
  }

  private currentWeekFamilySummary(): Omit<CloudFamilyWeeklySummary, "schemaVersion" | "ownerId" | "familyId" | "clientUpdatedAt"> {
    const now = new Date();
    const { start, end } = currentWeekBounds(now);
    const goal = weeklyGoalScore(this.state.workouts, this.state.hikes, this.currentWeightKg(), this.state.goals!, this.state.hydration, this.state.hydrationHistory ?? [], now);
    const workouts = this.state.workouts.filter(workout => workout.completedAt && new Date(workout.completedAt) >= start && new Date(workout.completedAt) < end);
    const hikes = this.state.hikes.filter(hike => {
      const when = new Date(`${hike.date}T12:00:00`);
      return when >= start && when < end;
    });
    const startKey = localDateKey(start);
    const endKey = localDateKey(new Date(end.getTime() - 1));
    const supplementDays = (this.state.supplementHistory ?? []).filter(day => day.date >= startKey && day.date <= endKey);
    const supplementMap = new Map<string, { amount: number; unit?: SupplementUnit; entries: number; days: Set<string>; mixedUnits: boolean }>();
    for (const day of supplementDays) {
      for (const entry of day.entries) {
        const current = supplementMap.get(entry.supplementId) ?? { amount: 0, unit: entry.unit, entries: 0, days: new Set<string>(), mixedUnits: false };
        current.entries += 1;
        current.days.add(day.date);
        current.amount += Number(entry.amount ?? 0);
        if (!current.unit) current.unit = entry.unit;
        else if (entry.unit && entry.unit !== current.unit) current.mixedUnits = true;
        supplementMap.set(entry.supplementId, current);
      }
    }
    const supplements = [...supplementMap.entries()].map(([supplementId, item]) => ({
      supplementId,
      amount: Number(item.amount.toFixed(2)),
      ...(item.unit && !item.mixedUnits ? { unit: item.unit } : {}),
      entries: item.entries,
      days: item.days.size,
      mixedUnits: item.mixedUnits
    })).sort((a,b) => a.supplementId.localeCompare(b.supplementId));
    return {
      weekStart: startKey,
      weeklyCalories: goal.weeklyCalories,
      workoutCount: workouts.length,
      hikeCount: hikes.length,
      hikeKm: Number(hikes.reduce((sum,hike)=>sum+hike.distanceKm,0).toFixed(1)),
      calorieDays: goal.calorieDays,
      waterDays: goal.waterDays,
      categoriesHit: goal.categories,
      missionScore: goal.score,
      missionMax: 10,
      supplements
    };
  }

  private async pruneStaleCloudHikeBadges(user: FirebaseAuthUser, membership: CloudMembership, desiredBadges = this.shareableBadges()): Promise<void> {
    const prefix = `${user.uid}_`;
    const desiredCloudIds = new Set(
      desiredBadges
        .filter(badge => badge.badgeType === "hike")
        .map(badge => `${prefix}${badge.id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0,120)}`)
    );
    const stale = this.cloudOwnBadges.filter(badge => badge.badgeType === "hike" && !desiredCloudIds.has(badge.id));
    if (!stale.length) return;
    for (const badge of stale) {
      const badgeId = badge.id.startsWith(prefix) ? badge.id.slice(prefix.length) : badge.id;
      await deleteCloudBadge(user, membership, badgeId);
    }
    const staleIds = new Set(stale.map(badge => badge.id));
    this.cloudOwnBadges = this.cloudOwnBadges.filter(badge => !staleIds.has(badge.id));
    this.cloudFamilyBadges = this.cloudFamilyBadges.filter(badge => !staleIds.has(badge.id));
  }

  private async publishFamilyProgressAndBadges(user: FirebaseAuthUser, membership: CloudMembership): Promise<void> {
    const badges = this.shareableBadges();
    // Badge writes are additive in Firestore, so explicitly prune hiking badges
    // whose source hike was deleted or whose badge was hidden. This prevents
    // another family member from seeing stale test badges forever.
    await this.pruneStaleCloudHikeBadges(user, membership, badges);
    await Promise.all([
      ...this.currentWeekFamilySummaries().map(summary=>saveFamilyDailySummary(user,membership,summary)),
      saveFamilyWeeklySummary(user,membership,this.currentWeekFamilySummary()),
      saveCloudBadges(user,membership,badges)
    ]);
  }

  private applyCloudHydration(days: HydrationDay[]): void {
    if (!days.length) return;
    const today=localDateKey(new Date());
    const map=new Map(days.map(day=>[day.date,day]));
    const current=map.get(today);
    if (current) this.state.hydration={...current,userId:this.state.user.id,familyId:this.state.user.familyId,visibility:"private"};
    this.state.hydrationHistory=[...map.values()].filter(day=>day.date!==today).sort((a,b)=>a.date.localeCompare(b.date)).map(day=>({...day,userId:this.state.user.id,familyId:this.state.user.familyId,visibility:"private"}));
  }

  private mergeProfileForFirstCloudSync(cloud: CloudCompanionSnapshot["bodyMetrics"]): ProfileData {
    const local = this.state.profile!;
    if (!cloud) return structuredClone(local);
    const byMonth = new Map<string, ProfileData["weightEntries"][number]>();
    for (const entry of cloud.weightEntries) byMonth.set(entry.date.slice(0,7), { ...entry });
    for (const entry of local.weightEntries) {
      const month = entry.date.slice(0,7);
      const existing = byMonth.get(month);
      if (!existing || entry.date >= existing.date) byMonth.set(month, { ...entry });
    }
    const photoId = local.photoId;
    const biologicalSex = local.biologicalSex ?? cloud.biologicalSex;
    return {
      heightCm: local.heightCm ?? cloud.heightCm,
      weightEntries: [...byMonth.values()].sort((a,b)=>a.date.localeCompare(b.date)),
      ...(photoId ? { photoId } : {}),
      ...(biologicalSex ? { biologicalSex } : {})
    };
  }

  private mergeHydrationForFirstCloudSync(local: HydrationDay, cloud?: HydrationDay): HydrationDay {
    if (!cloud) return structuredClone(local);
    const entries = new Map(cloud.entries.map(entry => [entry.id, { ...entry }]));
    for (const entry of local.entries) entries.set(entry.id, { ...entry });
    const mergedEntries = [...entries.values()].sort((a,b)=>a.at.localeCompare(b.at));
    return {
      schemaVersion: 1,
      date: local.date,
      userId: this.state.user.id,
      familyId: this.state.user.familyId,
      targetMl: local.targetMl !== 2000 ? local.targetMl : cloud.targetMl,
      totalMl: mergedEntries.reduce((sum,entry)=>sum+entry.ml,0),
      entries: mergedEntries,
      visibility: "private"
    };
  }

  private async syncCloudCompanionData(user: FirebaseAuthUser, membership: CloudMembership): Promise<void> {
    if (membership.access.status !== "active" || this.cloudCompanionBusy) return;
    this.cloudCompanionBusy=true; this.cloudCompanionReady=false; this.cloudCompanionError=null; this.render();
    try {
      this.state.sync ??= {};
      this.state.sync.hydrationDirtyDates ??= [];
      this.state.sync.supplementDirtyDates ??= [];
      const snapshot=await loadCloudCompanionState(user,membership);
      // Keep the just-loaded badge documents available before publishing so
      // v0.7.3 can remove stale hiking badges left behind by older additive sync.
      this.cloudOwnBadges = snapshot.ownBadges;
      this.cloudFamilyBadges = snapshot.familyBadges;
      if (snapshot.preferences && !this.state.sync.preferencesDirty) {
        this.state.locale=snapshot.preferences.locale;
        this.state.theme=snapshot.preferences.theme;
        this.state.simpleMode=snapshot.preferences.simpleMode;
        this.state.accentColor=normalizeHex(snapshot.preferences.accentColor);
        this.state.weeklyWorkoutGoal=snapshot.preferences.weeklyWorkoutGoal;
        this.state.goals=structuredClone(snapshot.preferences.goals);
        this.state.hikeBadgePreferences=structuredClone(snapshot.preferences.hikeBadgePreferences ?? []);
        this.applyTheme();
      } else {
        await saveCloudPreferences(user,membership,this.cloudPreferenceValue());
        this.state.sync.preferencesDirty=false;
      }
      if (this.state.sync.profileCloudMigrated !== true) {
        this.state.profile=this.mergeProfileForFirstCloudSync(snapshot.bodyMetrics);
        await saveCloudBodyMetrics(user,membership,this.state.profile!);
        this.state.sync.profileDirty=false;
        this.state.sync.profileCloudMigrated=true;
      } else if (snapshot.bodyMetrics && !this.state.sync.profileDirty) {
        const photoId=this.state.profile?.photoId;
        this.state.profile={ heightCm:snapshot.bodyMetrics.heightCm, weightEntries:snapshot.bodyMetrics.weightEntries.map(entry=>({...entry})), ...(photoId?{photoId}:{}), ...(snapshot.bodyMetrics.biologicalSex?{biologicalSex:snapshot.bodyMetrics.biologicalSex}:{}) };
      } else {
        await saveCloudBodyMetrics(user,membership,this.state.profile!);
        this.state.sync.profileDirty=false;
      }
      const selfMember = this.cloudMembership?.members.find(member => member.uid === user.uid);
      if (this.cloudMembership && (selfMember?.displayName !== this.state.user.displayName || selfMember?.biologicalSex !== this.state.profile?.biologicalSex)) {
        this.cloudMembership = await updateMyFamilyDisplayName(user, this.cloudMembership, this.state.user.displayName, this.state.profile?.biologicalSex);
      }

      const localDays=new Map(this.allHydrationDays().map(day=>[day.date,day]));
      const cloudDays=new Map(snapshot.hydration.map(day=>[day.date,day]));
      const dirty=new Set(this.state.sync.hydrationDirtyDates ?? []);
      if (this.state.sync.hydrationCloudMigrated !== true) {
        for (const [date,localDay] of localDays) {
          const merged=this.mergeHydrationForFirstCloudSync(localDay,cloudDays.get(date));
          await saveCloudHydrationDay(user,membership,merged);
          cloudDays.set(date,merged);
          dirty.delete(date);
        }
        this.state.sync.hydrationCloudMigrated=true;
      } else {
        for (const date of [...dirty]) {
          const day=localDays.get(date);
          if (!day) continue;
          await saveCloudHydrationDay(user,membership,day);
          cloudDays.set(date,day);
          dirty.delete(date);
        }
      }
      this.state.sync.hydrationDirtyDates=[...dirty];
      this.applyCloudHydration([...cloudDays.values()]);

      const localSupplementDays = new Map(this.allSupplementDays().map(day => [day.date, day]));
      const cloudSupplementDays = new Map(snapshot.supplements.map(day => [day.date, { date: day.date, entries: day.entries }]));
      const supplementDirty = new Set(this.state.sync.supplementDirtyDates ?? []);
      if (this.state.sync.supplementCloudMigrated !== true) {
        for (const [date, localDay] of localSupplementDays) {
          const merged = this.mergeSupplementForFirstCloudSync(localDay, cloudSupplementDays.get(date));
          await saveCloudSupplementDay(user, membership, merged);
          cloudSupplementDays.set(date, merged);
          supplementDirty.delete(date);
        }
        this.state.sync.supplementCloudMigrated = true;
      } else {
        for (const date of [...supplementDirty]) {
          const day = localSupplementDays.get(date) ?? { date, entries: [] };
          await saveCloudSupplementDay(user, membership, day);
          cloudSupplementDays.set(date, day);
          supplementDirty.delete(date);
        }
      }
      this.state.sync.supplementDirtyDates = [...supplementDirty];
      this.applyCloudSupplements([...cloudSupplementDays.values()]);

      await this.publishFamilyProgressAndBadges(user,membership);
      const refreshed=await loadCloudCompanionState(user,membership);
      this.cloudFamilyDaily=refreshed.familyDaily;
      this.cloudFamilyWeekly=refreshed.familyWeekly;
      this.cloudFamilyBadges=refreshed.familyBadges;
      this.cloudOwnBadges=refreshed.ownBadges;
      this.persist();
    } catch(error) {
      this.cloudCompanionError=this.cloudErrorMessage(error);
      console.warn("Firebase companion sync:",error);
    } finally {
      this.cloudCompanionBusy=false; this.cloudCompanionReady=true; this.render();
    }
  }

  private async pushPreferencesToCloud(): Promise<void> {
    this.state.sync ??= {}; this.state.sync.preferencesDirty=true; this.persist();
    if (!this.authUser || this.cloudMembership?.access.status!=="active") return;
    try { await saveCloudPreferences(this.authUser,this.cloudMembership,this.cloudPreferenceValue()); this.state.sync.preferencesDirty=false; this.cloudCompanionError=null; this.persist(); }
    catch(error){ this.cloudCompanionError=this.cloudErrorMessage(error); this.persist(); }
  }

  private async pushProfileToCloud(): Promise<void> {
    this.state.sync ??= {}; this.state.sync.profileDirty=true; this.persist();
    if (!this.authUser || this.cloudMembership?.access.status!=="active") return;
    try { await saveCloudBodyMetrics(this.authUser,this.cloudMembership,this.state.profile!); this.state.sync.profileDirty=false; await this.publishFamilyProgressAndBadges(this.authUser,this.cloudMembership); this.cloudCompanionError=null; this.persist(); }
    catch(error){ this.cloudCompanionError=this.cloudErrorMessage(error); this.persist(); }
  }

  private async pushHydrationToCloud(day: HydrationDay): Promise<void> {
    this.state.sync ??= {}; this.state.sync.hydrationDirtyDates ??= [];
    if(!this.state.sync.hydrationDirtyDates.includes(day.date)) this.state.sync.hydrationDirtyDates.push(day.date);
    this.persist();
    if (!this.authUser || this.cloudMembership?.access.status!=="active") return;
    try { await saveCloudHydrationDay(this.authUser,this.cloudMembership,day); this.state.sync.hydrationDirtyDates=this.state.sync.hydrationDirtyDates.filter(date=>date!==day.date); await this.publishFamilyProgressAndBadges(this.authUser,this.cloudMembership); const refreshed=await loadCloudCompanionState(this.authUser,this.cloudMembership); this.cloudFamilyDaily=refreshed.familyDaily; this.cloudFamilyWeekly=refreshed.familyWeekly; this.cloudFamilyBadges=refreshed.familyBadges; this.cloudOwnBadges=refreshed.ownBadges; this.cloudCompanionError=null; this.persist(); this.render(); }
    catch(error){ this.cloudCompanionError=this.cloudErrorMessage(error); this.persist(); }
  }

  private async pushSupplementDayToCloud(date: string): Promise<void> {
    this.state.sync ??= {};
    this.state.sync.supplementDirtyDates ??= [];
    if (!this.state.sync.supplementDirtyDates.includes(date)) this.state.sync.supplementDirtyDates.push(date);
    this.persist();
    if (!this.authUser || this.cloudMembership?.access.status !== "active") return;
    const day = (this.state.supplementHistory ?? []).find(item => item.date === date) ?? { date, entries: [] };
    try {
      await saveCloudSupplementDay(this.authUser, this.cloudMembership, day);
      this.state.sync.supplementDirtyDates = this.state.sync.supplementDirtyDates.filter(item => item !== date);
      await this.publishFamilyProgressAndBadges(this.authUser, this.cloudMembership);
      const refreshed = await loadCloudCompanionState(this.authUser, this.cloudMembership);
      this.cloudFamilyDaily = refreshed.familyDaily;
      this.cloudFamilyWeekly = refreshed.familyWeekly;
      this.cloudFamilyBadges = refreshed.familyBadges;
      this.cloudOwnBadges = refreshed.ownBadges;
      this.cloudCompanionError = null;
      this.persist();
      this.render();
    } catch (error) {
      this.cloudCompanionError = this.cloudErrorMessage(error);
      this.persist();
    }
  }

  private async refreshFamilyProgress(): Promise<void> {
    if (!this.authUser || this.cloudMembership?.access.status!=="active") return;
    try { await this.publishFamilyProgressAndBadges(this.authUser,this.cloudMembership); const refreshed=await loadCloudCompanionState(this.authUser,this.cloudMembership); this.cloudFamilyDaily=refreshed.familyDaily; this.cloudFamilyWeekly=refreshed.familyWeekly; this.cloudFamilyBadges=refreshed.familyBadges; this.cloudOwnBadges=refreshed.ownBadges; this.cloudCompanionError=null; this.render(); }
    catch(error){ this.cloudCompanionError=this.cloudErrorMessage(error); }
  }

  private async pushWorkoutToCloud(workout: WorkoutRecord): Promise<void> {
    if (!this.authUser || this.cloudMembership?.access.status !== "active") return;
    if (workout.ownerId !== this.authUser.uid || workout.familyId !== this.cloudMembership.access.familyId) return;
    try {
      workout.estimatedCalories = this.workoutCaloriesForSync(workout);
      const saved = await saveCloudWorkout(this.authUser, this.cloudMembership, workout, workout.estimatedCalories);
      workout.cloudSyncedAt = new Date().toISOString();
      const envelope = { ...saved, workout: { ...saved.workout, cloudSyncedAt: workout.cloudSyncedAt } };
      if (workout.visibility === "family") {
        const index = this.cloudFamilyWorkouts.findIndex(item => item.workout.id === workout.id);
        if (index >= 0) this.cloudFamilyWorkouts[index] = envelope;
        else this.cloudFamilyWorkouts.unshift(envelope);
      } else {
        this.cloudFamilyWorkouts = this.cloudFamilyWorkouts.filter(item => item.workout.id !== workout.id);
      }
      this.cloudWorkoutError = null;
      this.persist();
      await this.refreshFamilyProgress();
      this.render();
    } catch (error) {
      this.cloudWorkoutError = this.cloudErrorMessage(error);
      this.toast(this.locale === "zh-TW" ? "已儲存在本機；雲端同步失敗，稍後會再試。" : "Saved locally; cloud sync failed and will retry later.");
    }
  }

  private async pushHikeToCloud(hike: HikeRecord): Promise<void> {
    if (!this.authUser || this.cloudMembership?.access.status !== "active") return;
    if (hike.ownerId !== this.authUser.uid || hike.familyId !== this.cloudMembership.access.familyId) return;
    try {
      hike.visibility = "family";
      hike.selectedViewerIds = [];
      hike.updatedAt ??= new Date().toISOString();
      const saved = await saveCloudHike(this.authUser, this.cloudMembership, hike);
      hike.cloudSyncedAt = new Date().toISOString();
      const envelope: CloudHikeEnvelope = { ...saved, hike: { ...saved.hike, cloudSyncedAt: hike.cloudSyncedAt, ...(hike.photoId ? { photoId: hike.photoId } : {}), ...(hike.routePoints ? { routePoints: hike.routePoints, routeSource: hike.routeSource } : {}) } };
      const index = this.cloudFamilyHikes.findIndex(item => item.hike.id === hike.id);
      if (index >= 0) this.cloudFamilyHikes[index] = envelope;
      else this.cloudFamilyHikes.unshift(envelope);
      this.cloudHikeError = null;
      this.persist();
      await this.refreshFamilyProgress();
      this.render();
    } catch (error) {
      this.cloudHikeError = this.cloudErrorMessage(error);
      this.toast(this.locale === "zh-TW" ? "健行已儲存在本機；雲端同步失敗，稍後會再試。" : "Hike saved locally; cloud sync failed and will retry later.");
    }
  }

  private localStateIsEmpty(): boolean {
    return this.state.workouts.length === 0
      && this.state.hikes.length === 0
      && !this.state.activeWorkout
      && (this.state.routines ?? []).length === 0
      && (this.state.stories ?? []).length === 0
      && (this.state.profile?.weightEntries ?? []).length === 0
      && this.state.hydration.entries.length === 0
      && (this.state.hydrationHistory ?? []).every(day => day.entries.length === 0)
      && (this.state.supplementHistory ?? []).every(day => day.entries.length === 0);
  }

  private seedLocalIdentity(user: FirebaseAuthUser, membership: CloudMembership | null): void {
    const previousUserId = this.state.user.id;
    const canAdoptLocalState = previousUserId === user.uid || previousUserId === "local_user" || this.localStateIsEmpty();
    if (!canAdoptLocalState) return;
    const familyId = membership?.access.status === "active" ? membership.access.familyId : this.state.user.familyId;
    const selfMember = membership?.members.find(member => member.uid === user.uid);
    const displayName = (selfMember?.displayName || user.displayName || user.email?.split("@")[0] || "Family member").slice(0, 60);

    this.state.user = { id: user.uid, familyId, displayName };
    this.state.profile ??= { weightEntries: [] };
    if (selfMember?.biologicalSex && !this.state.profile.biologicalSex) this.state.profile.biologicalSex = selfMember.biologicalSex;
    this.state.hydration.userId = user.uid;
    this.state.hydration.familyId = familyId;

    // Adopt only unsynced records that belonged to the anonymous/local account
    // being upgraded on this browser. Never rewrite records from another UID.
    for (const workout of this.state.workouts) {
      if (workout.cloudSyncedAt) continue;
      if (workout.ownerId === previousUserId || workout.ownerId === "local_user") {
        workout.ownerId = user.uid;
        workout.familyId = familyId;
      }
    }
    for (const hike of this.state.hikes) {
      if (hike.ownerId === previousUserId || hike.ownerId === "local_user") {
        hike.ownerId = user.uid;
        hike.familyId = familyId;
      }
    }
    for (const story of this.state.stories ?? []) {
      if (story.ownerId === previousUserId || story.ownerId === "local_user") {
        story.ownerId = user.uid;
        story.familyId = familyId;
      }
    }
    this.state.family = [{
      id: user.uid,
      name: displayName,
      workoutsThisWeek: 0,
      workoutGoal: this.state.weeklyWorkoutGoal ?? 3,
      hikeKmThisWeek: 0
    }];
    this.persist();
  }

  private async changeFamilyMemberStatus(memberUid: string, status: "active" | "revoked"): Promise<void> {
    if (!this.authUser || !this.cloudMembership || this.cloudActionBusy) return;
    this.cloudActionBusy = true;
    this.render();
    try {
      this.cloudMembership = await setFamilyMemberAccessStatus(this.authUser, this.cloudMembership, memberUid, status);
      this.cloudMembershipError = null;
      this.toast(status === "revoked"
        ? (this.locale === "zh-TW" ? "家庭權限已移除" : "Family access removed")
        : (this.locale === "zh-TW" ? "家庭權限已恢復" : "Family access restored"));
    } catch (error) {
      this.toast(this.cloudErrorMessage(error));
    } finally {
      this.cloudActionBusy = false;
      this.render();
    }
  }

  private cloudErrorMessage(error: unknown): string {
    const value = error as { code?: string; message?: string } | null;
    const code = value?.code ?? "";
    if (code.includes("permission-denied")) return this.locale === "zh-TW" ? "Firestore 權限被拒絕。請確認登入帳號與家庭權限。" : "Firestore permission denied. Check the signed-in account and family access.";
    if (code.includes("unavailable")) return this.locale === "zh-TW" ? "目前無法連線到 Firestore，請稍後再試。" : "Firestore is temporarily unavailable. Try again shortly.";
    return value?.message || (this.locale === "zh-TW" ? "家庭雲端操作失敗" : "Family cloud operation failed");
  }

  private authCard(): string {
    if (!cloudModeEnabled()) return `<div><strong>${this.locale === "zh-TW" ? "Local 模式" : "Local mode"}</strong><span>${this.locale === "zh-TW" ? "Firebase 尚未設定；所有資料只留在這台裝置。" : "Firebase is not configured; all data stays on this device."}</span></div>`;
    const activeCloud = Boolean(this.authUser && this.cloudMembership?.access.status === "active");
    const rememberedLabel = this.state.user.displayName || this.offlineAccount?.displayName || this.offlineAccount?.email || "LogTogether";
    if (activeCloud && this.authUser) {
      const label = this.authUser.displayName || this.authUser.email || this.authUser.uid;
      const group = this.cloudMembership?.access.role === "owner"
        ? (this.locale === "zh-TW" ? "Cloud 擁有者" : "Cloud owner")
        : this.groupName(this.cloudMembership?.access.groupId);
      return `<div class="auth-setting"><div class="auth-identity">${this.authUser.photoURL ? `<img class="auth-avatar" src="${escapeHtml(this.authUser.photoURL)}" alt="">` : ""}<div><strong>${escapeHtml(label)}</strong><span>${this.locale === "zh-TW" ? "Cloud 已授權" : "Cloud authorized"} · ${escapeHtml(group)}</span><small>${escapeHtml(this.authUser.email ?? "")}</small></div></div><button class="btn small" data-action="google-sign-out">${this.locale === "zh-TW" ? "切換為 Local" : "Switch to Local"}</button></div>`;
    }
    if (!this.networkOnline && this.offlineAccount?.cloudApproved) {
      return `<div class="auth-setting"><div><strong>${escapeHtml(rememberedLabel)}</strong><span>${this.locale === "zh-TW" ? "Cloud 帳號目前離線；本機資料仍可正常使用，恢復網路後會重新驗證同步。" : "Cloud account is offline. Local data remains usable and will re-verify/sync when connectivity returns."}</span></div></div>`;
    }
    if (!this.authReady || this.authInitBusy) return `<div><strong>${this.locale === "zh-TW" ? "Cloud 存取" : "Cloud access"}</strong><span>${this.locale === "zh-TW" ? "正在檢查授權…" : "Checking authorization…"}</span></div>`;
    if (this.pendingInviteCode) {
      const error = this.authError || this.cloudMembershipError;
      return `<div class="auth-setting"><div><strong>${this.locale === "zh-TW" ? "Cloud 邀請已偵測" : "Cloud invitation detected"}</strong><span>${error ? `<span class="danger-text">${escapeHtml(error)}</span>` : (this.locale === "zh-TW" ? "只有邀請指定的 Google 帳號能啟用 Cloud。你目前的 Local 紀錄會先備份，再安全合併到該帳號。" : "Only the Google account named by this invitation can enable Cloud. Your current Local records are backed up first and safely merged into that account.")}</span></div>${!this.authUser ? `<button class="btn small primary" data-action="google-sign-in">${this.locale === "zh-TW" ? "使用 Google 接受邀請" : "Continue with Google"}</button>` : ""}</div>`;
    }
    if (this.offlineAccount?.cloudApproved && !this.authUser) {
      return `<div class="auth-setting"><div><strong>${escapeHtml(rememberedLabel)}</strong><span>${this.locale === "zh-TW" ? "這台裝置曾獲得 Cloud 權限，但目前 Google 工作階段已登出。" : "This device previously had Cloud authorization, but its Google session is currently signed out."}</span></div><button class="btn small" data-action="google-sign-in">${this.locale === "zh-TW" ? "重新連線 Cloud" : "Reconnect Cloud"}</button></div>`;
    }
    return `<div class="auth-setting"><div><strong>${this.locale === "zh-TW" ? "Local 模式" : "Local mode"}</strong><span>${this.locale === "zh-TW" ? "新成員仍需邀請才能取得 Cloud 權限；已經是 Cloud 成員的人可以在任何新瀏覽器重新登入。" : "New members still need an invitation to gain Cloud access. Existing Cloud members can reconnect from any new browser."}</span></div><button class="btn small" data-action="google-sign-in">${this.locale === "zh-TW" ? "連線既有 Cloud 帳號" : "Connect existing Cloud account"}</button></div>`;
  }

  private get locale(): Locale { return this.state.locale; }
  private text(key: Parameters<typeof t>[1]): string { return t(this.locale, key); }

  private groupName(groupId?: string): string {
    const id = groupId || DEFAULT_GROUP_ID;
    const match = this.cloudMembership?.groups.find(group => group.id === id);
    if (match?.name) return match.name;
    if (id === DEFAULT_GROUP_ID) return this.locale === "zh-TW" ? "家庭" : "Family";
    return id;
  }

  private applyTheme(): void {
    document.documentElement.dataset.theme = this.state.theme;
    document.documentElement.lang = this.state.locale;
    document.documentElement.removeAttribute("data-text-size");
    const textScale = clamp(Math.round((this.state.textScale ?? 100) / 10) * 10, 100, 140);
    const factor = textScale / 100;
    this.state.textScale = textScale;
    this.state.largeText = textScale > 100; // backward compatibility with v0.6.0 state
    document.documentElement.dataset.textScale = String(textScale);
    const fontVars: Record<string, number> = {
      "--font-body": 16, "--font-page-subtitle": 14, "--font-section-title": 14, "--font-section-value": 13,
      "--font-small": 12, "--font-tiny": 10, "--font-control": 14, "--font-field-label": 11,
      "--font-nav": 9, "--font-status": 12, "--font-meta": 10
    };
    for (const [name, px] of Object.entries(fontVars)) document.documentElement.style.setProperty(name, `${(px * factor).toFixed(1)}px`);
    const accent = normalizeHex(this.state.accentColor);
    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.style.setProperty("--accent-strong", accent);
    document.documentElement.style.setProperty("--accent-soft", `color-mix(in srgb, ${accent} 14%, transparent)`);
    document.documentElement.style.setProperty("--accent-contrast", contrastForHex(accent));
  }

  private persist(): void {
    saveState(this.state, this.localScope || undefined);
  }

  private toast(message: string, actionLabel?: string, action?: () => void): void {
    document.querySelector(".toast")?.remove();
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    const node = document.createElement("div");
    node.className = "toast";
    const label = document.createElement("span");
    label.textContent = message;
    node.append(label);
    if (actionLabel && action) {
      const button = document.createElement("button");
      button.className = "toast-action";
      button.textContent = actionLabel;
      button.addEventListener("click", () => {
        action();
        node.remove();
        if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
        this.toastTimer = null;
      });
      node.append(button);
    }
    document.body.append(node);
    this.toastTimer = window.setTimeout(() => { node.remove(); this.toastTimer = null; }, action ? 6500 : 2200);
  }

  private navigate(page: Page): void {
    if (page === "home" && this.page !== "home") {
      this.workoutTrendWeekOffset = 0;
      this.monthlyTrendStart = new Date(new Date().getFullYear(), 0, 1);
    }
    if (page === "water" && this.page !== "water") this.waterWeekOffset = 0;
    if (page === "settings" && this.page !== "settings") this.familyAccessEditing = false;
    this.page = page;
    this.confirmAction = null;
    this.pendingSetRemovalKey = null;
    this.pendingCircuitRoundRemovalIndex = null;
    window.scrollTo({ top: 0, behavior: "instant" });
    this.render();
  }

  private weekReference(offset: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + offset * 7);
    return date;
  }

  private isEditingActiveWorkout(): boolean {
    const workout = this.state.activeWorkout;
    return Boolean(workout && this.state.workouts.some(item => item.id === workout.id));
  }

  private workoutHasStarted(workout: WorkoutRecord | null = this.state.activeWorkout): boolean {
    return Boolean(workout?.exercises.some(exercise => exercise.sets.some(set => Boolean(set.startedAt) || set.completed)));
  }

  private trainingCreditText(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  private exerciseFocusText(definition: ExerciseDefinition | undefined): string {
    if (!definition) return "";
    const profile = exerciseLoggingProfile(definition);
    if (profile === "cardio_session" || profile === "rounds") return this.locale === "zh-TW" ? "任務計分：有氧" : "Mission credit: Cardio";
    if (profile === "mobility_session") return this.locale === "zh-TW" ? "任務計分：活動度" : "Mission credit: Mobility";
    const weights = exerciseMuscleWeights(definition);
    return ALL_CATEGORIES
      .map(category => ({ category, weight: weights[category] ?? 0 }))
      .filter(item => item.weight >= 0.05)
      .sort((a,b) => b.weight - a.weight)
      .map(item => `${this.exerciseCategoryLabel(item.category)} ${Math.round(item.weight * 100)}%`)
      .join(" · ");
  }

  private workoutAllDone(workout: WorkoutRecord): boolean {
    return workout.exercises.length > 0 && workout.exercises.every(exercise => exercise.sets.length > 0 && exercise.sets.every(set => set.completed));
  }

  private completedSetIsLocked(workout: WorkoutRecord, set: SetEntry): boolean {
    if (!set.completedAt) return false;
    const completedAt = new Date(set.completedAt).getTime();
    if (!Number.isFinite(completedAt)) return false;
    return workout.exercises.some(exercise => exercise.sets.some(candidate => {
      if (!candidate.startedAt || candidate.id === set.id) return false;
      const startedAt = new Date(candidate.startedAt).getTime();
      return Number.isFinite(startedAt) && startedAt > completedAt;
    }));
  }

  private restoreRestFromActiveWorkout(): void {
    const workout = this.state.activeWorkout;
    if (!workout || this.isEditingActiveWorkout() || this.workoutAllDone(workout) || this.restSource) return;
    const activeSetStartedAt = workout.exercises.flatMap(exercise => exercise.sets)
      .filter(set => set.startedAt && !set.completed)
      .map(set => new Date(set.startedAt!).getTime())
      .filter(Number.isFinite)
      .sort((a,b)=>b-a)[0];
    let best: { exerciseIndex: number; setIndex: number; completedAt: number; targetSec: number } | null = null;
    workout.exercises.forEach((exercise, exerciseIndex) => exercise.sets.forEach((set, setIndex) => {
      const definition = exerciseById(exercise.exerciseId);
      const profile = definition ? exerciseLoggingProfile(definition) : "sets";
      if (profile !== "sets" && profile !== "rounds") return;
      if (!set.completedAt || set.restAfterSec !== undefined) return;
      const completedAt = new Date(set.completedAt).getTime();
      if (!Number.isFinite(completedAt) || (activeSetStartedAt !== undefined && activeSetStartedAt > completedAt)) return;
      if (!best || completedAt > best.completedAt) best = { exerciseIndex, setIndex, completedAt, targetSec: Math.max(0, exercise.restSec) };
    }));
    const candidate = best as { exerciseIndex: number; setIndex: number; completedAt: number; targetSec: number } | null;
    if (candidate) this.restSource = { exerciseIndex: candidate.exerciseIndex, setIndex: candidate.setIndex, startedAt: candidate.completedAt, targetSec: candidate.targetSec };
  }

  private latestActiveSet(): { exerciseIndex: number; setIndex: number; startedAt: number } | null {
    const workout = this.state.activeWorkout;
    if (!workout) return null;
    let latest: { exerciseIndex: number; setIndex: number; startedAt: number } | null = null;
    workout.exercises.forEach((exercise, exerciseIndex) => exercise.sets.forEach((set, setIndex) => {
      if (!set.startedAt || set.completed) return;
      const startedAt = new Date(set.startedAt).getTime();
      if (!Number.isFinite(startedAt)) return;
      if (!latest || startedAt > latest.startedAt) latest = { exerciseIndex, setIndex, startedAt };
    }));
    return latest;
  }

  private clockText(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));
    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
  }

  private setDurationText(set: SetEntry): string | null {
    if (!set.startedAt) return null;
    const started = new Date(set.startedAt).getTime();
    if (!Number.isFinite(started)) return null;
    const ended = set.completedAt ? new Date(set.completedAt).getTime() : Date.now();
    if (!Number.isFinite(ended) || ended < started) return null;
    return this.clockText((ended - started) / 1000);
  }

  private completedSetDurationText(set: SetEntry): string {
    if (!set.startedAt || !set.completedAt) return "—";
    const started = new Date(set.startedAt).getTime();
    const completed = new Date(set.completedAt).getTime();
    if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) return "—";
    return this.clockText((completed - started) / 1000);
  }

  private roundCompleted(workout: WorkoutRecord, roundIndex: number): boolean {
    return workout.exercises.length > 0 && workout.exercises.every(exercise => Boolean(exercise.sets[roundIndex]?.completed));
  }

  private roundEffort(workout: WorkoutRecord, roundIndex: number): number | undefined {
    for (const exercise of workout.exercises) {
      const rpe = exercise.sets[roundIndex]?.rpe;
      if (rpe !== undefined) return rpe;
    }
    return undefined;
  }

  private workoutTimerSnapshot(): { label: string; value: string; detail: string } | null {
    const workout = this.state.activeWorkout;
    if (!workout || this.isEditingActiveWorkout()) return null;
    const activeSet = this.latestActiveSet();
    if (activeSet) {
      const exercise = workout.exercises[activeSet.exerciseIndex];
      const definition = exerciseById(exercise?.exerciseId ?? "");
      const name = definition?.names[this.locale] ?? (this.locale === "zh-TW" ? "目前運動" : "Current exercise");
      const profile = definition ? exerciseLoggingProfile(definition) : "sets";
      const label = profile === "cardio_session" ? (this.locale === "zh-TW" ? "有氧" : "Cardio")
        : profile === "mobility_session" ? (this.locale === "zh-TW" ? "活動度" : "Mobility")
        : profile === "rounds" ? (this.locale === "zh-TW" ? "回合" : "Round")
        : (this.locale === "zh-TW" ? "目前組" : "Set");
      return { label, value: this.clockText((Date.now() - activeSet.startedAt) / 1000), detail: name };
    }
    if (this.restSource) {
      const elapsed = Math.max(0, Math.floor((Date.now() - this.restSource.startedAt) / 1000));
      if (this.restSource.targetSec <= 0) return { label: this.locale === "zh-TW" ? "休息（正計時）" : "Rest · count up", value: this.clockText(elapsed), detail: this.locale === "zh-TW" ? "沒有設定上限" : "No target" };
      const remaining = this.restSource.targetSec - elapsed;
      return {
        label: this.locale === "zh-TW" ? "休息" : "Rest",
        value: remaining >= 0 ? this.clockText(remaining) : `+${this.clockText(Math.abs(remaining))}`,
        detail: `${this.restSource.targetSec}s ${this.locale === "zh-TW" ? "目標" : "target"}`
      };
    }
    const hasStarted = workout.exercises.some(exercise => exercise.sets.some(set => Boolean(set.startedAt)));
    if (!hasStarted) return { label: this.locale === "zh-TW" ? "準備" : "Ready", value: "—", detail: workout.routineName };
    const started = new Date(workout.startedAt).getTime();
    return { label: this.locale === "zh-TW" ? "運動時間" : "Workout", value: this.clockText((Date.now() - started) / 1000), detail: workout.routineName };
  }

  private renderWorkoutDock(): string {
    const workout = this.state.activeWorkout;
    if (!workout || this.isEditingActiveWorkout() || workout.exercises.length === 0 || !this.workoutHasStarted(workout)) return "";
    const timer = this.workoutTimerSnapshot();
    if (!timer) return "";
    const onWorkoutPage = this.page === "workout";
    const done = this.workoutAllDone(workout);
    const actions = onWorkoutPage
      ? `${workout.exercises.length ? `<button class="btn small ghost dock-save-routine" data-action="save-routine">${escapeHtml(this.text("saveRoutine"))}</button>` : ""}${done ? `<button class="btn small primary" data-action="finish-workout">${escapeHtml(this.text("finishWorkout"))}</button>` : `<button class="btn small ghost danger" data-action="discard-workout">${this.locale === "zh-TW" ? "捨棄運動" : "Discard workout"}</button>`}`
      : `<button class="btn small primary" data-action="continue-workout">${this.locale === "zh-TW" ? "回到運動" : "Workout"}</button><button class="btn small ghost danger" data-action="discard-workout">${this.locale === "zh-TW" ? "捨棄運動" : "Discard"}</button>`;
    return `<aside class="active-workout-dock" aria-live="polite"><div class="workout-dock-timer"><span data-workout-dock-label>${escapeHtml(timer.label)}</span><strong data-workout-dock-timer>${escapeHtml(timer.value)}</strong><small data-workout-dock-detail>${escapeHtml(timer.detail)}</small></div><div class="workout-dock-actions">${actions}</div></aside>`;
  }

  private ensureWorkoutTicker(): void {
    const active = this.workoutHasStarted() ? this.state.activeWorkout : null;
    const hasStarted = Boolean(active?.exercises.some(exercise => exercise.sets.some(set => Boolean(set.startedAt))));
    const needsTicker = Boolean(active && !this.isEditingActiveWorkout() && (hasStarted || this.restSource));
    if (!needsTicker) {
      if (this.timerId !== null) window.clearInterval(this.timerId);
      this.timerId = null;
      return;
    }
    if (this.timerId === null) this.timerId = window.setInterval(() => this.updateRestTimerDisplay(), 1000);
  }

  private render(): void {
    const main = this.page === "home" ? this.renderHome()
      : this.page === "history" ? this.renderHistory()
      : this.page === "water" ? this.renderWater()
      : this.page === "family" ? this.renderFamily()
      : this.page === "familyMember" ? this.renderFamilyMemberProfile()
      : this.page === "profile" ? this.renderProfile()
      : this.page === "settings" ? this.renderSettings()
      : this.page === "workout" ? this.renderWorkout()
      : this.renderHike();

    this.clearMediaUrls();
    const cloudIdentity = Boolean(
      (this.authUser && this.cloudMembership?.access.status === "active")
      || (!this.networkOnline && this.offlineAccount?.cloudApproved)
    );
    const topbarStatus = cloudIdentity ? "Cloud" : "Local";
    root.innerHTML = `
      <div class="app-shell ${this.state.activeWorkout && !this.isEditingActiveWorkout() && this.workoutHasStarted() ? "has-workout-dock" : ""}">
        <header class="topbar">
          <button class="brand brand-home" data-action="go-home" aria-label="${this.locale === "zh-TW" ? "回到首頁" : "Go home"}"><span class="brand-mark">${icon("dumbbell")}</span><span>${escapeHtml(this.text("appName"))}</span></button>
          <div class="topbar-actions"><span class="status-pill">${escapeHtml(topbarStatus)}</span></div>
        </header>
        <main class="main">${main}</main>
        ${this.renderWorkoutDock()}
        ${this.page === "hike" ? "" : this.renderNav()}
        ${this.renderConfirmation()}
        ${this.renderWeightReminder()}
      </div>`;

    this.applyDynamicStyles();
    this.bindGlobalEvents();
    if (this.page === "workout") this.bindWorkoutEvents();
    if (this.page === "hike") this.bindHikeEvents();
    this.ensureWorkoutTicker();
    this.updateRestTimerDisplay();
    void this.hydrateMediaImages();
  }

  private renderNav(): string {
    const item = (page: Page, iconName: Parameters<typeof icon>[0], label: string) => {
      const active = this.page === page || (page === "family" && this.page === "familyMember");
      return `<button class="nav-btn ${active ? "active" : ""}" data-nav="${page}">${icon(iconName)}<span>${escapeHtml(label)}</span></button>`;
    };
    return `<nav class="bottom-nav five">${item("home", "home", this.text("home"))}${item("history", "history", this.text("history"))}${item("water", "drop", this.text("water"))}${item("family", "family", this.text("family"))}${item("settings", "settings", this.locale === "zh-TW" ? "設定" : "Settings")}</nav>`;
  }

  private applyDynamicStyles(): void {
    root.querySelectorAll<HTMLElement>("[data-style-width]").forEach(node => {
      node.style.width = `${clamp(Number(node.dataset.styleWidth ?? 0), 0, 100)}%`;
    });
    root.querySelectorAll<HTMLElement>("[data-style-height]").forEach(node => {
      node.style.height = `${clamp(Number(node.dataset.styleHeight ?? 0), 0, 100)}%`;
    });
    root.querySelectorAll<HTMLElement>("[data-style-top]").forEach(node => {
      node.style.top = `${clamp(Number(node.dataset.styleTop ?? 0), 0, 100)}%`;
    });
    root.querySelectorAll<HTMLElement>("[data-style-background]").forEach(node => {
      const value = node.dataset.styleBackground;
      if (value) node.style.background = value;
    });
  }

  private clearMediaUrls(): void {
    this.mediaUrls.forEach(url => URL.revokeObjectURL(url));
    this.mediaUrls = [];
  }

  private async hydrateMediaImages(): Promise<void> {
    const images = Array.from(root.querySelectorAll<HTMLImageElement>("img[data-private-media]"));
    await Promise.all(images.map(async image => {
      const id = image.dataset.privateMedia;
      if (!id) return;
      try {
        const blob = await getPrivateImage(id);
        if (!blob || !image.isConnected) return;
        const url = URL.createObjectURL(blob);
        this.mediaUrls.push(url);
        image.src = url;
      } catch { /* Missing local media should never break the record UI. */ }
    }));
  }

  private privateImage(id: string | undefined, className: string, alt = ""): string {
    return id ? `<img class="${escapeHtml(className)}" data-private-media="${escapeHtml(id)}" alt="${escapeHtml(alt)}">` : "";
  }

  private latestWeightEntry() {
    const entries = this.state.profile?.weightEntries ?? [];
    return entries.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];
  }

  private currentWeightKg(): number {
    return this.latestWeightEntry()?.kg ?? 70;
  }

  private weightReviewKey(): string {
    return `logtogether:weight-review:v1:${this.localScope || "guest"}`;
  }

  private currentMonthKey(): string {
    return localDateKey(new Date()).slice(0, 7);
  }

  private weightReminderNeeded(): boolean {
    const latest = this.latestWeightEntry();
    if (!latest) return true;
    const month = this.currentMonthKey();
    if (latest.date.startsWith(month)) return false;
    try { return localStorage.getItem(this.weightReviewKey()) !== month; }
    catch { return true; }
  }

  private markWeightReviewedThisMonth(): void {
    try { localStorage.setItem(this.weightReviewKey(), this.currentMonthKey()); }
    catch { /* The reminder is advisory; storage denial must not block an activity. */ }
  }

  private confirmCurrentWeight(): void {
    const latest = this.latestWeightEntry();
    if (!latest) return;
    const today = localDateKey(new Date());
    const existing = this.state.profile?.weightEntries.find(entry => entry.date.startsWith(today.slice(0, 7)));
    if (existing) { existing.kg = latest.kg; existing.date = today; }
    else this.state.profile?.weightEntries.push({ id: uid("weight"), date: today, kg: latest.kg });
    this.markWeightReviewedThisMonth();
    this.persist();
    void this.pushProfileToCloud();
  }

  private requestWeightCheck(action: WeightReminderAction): void {
    if (!this.weightReminderNeeded()) { this.performWeightAction(action); return; }
    this.weightReminderAction = action;
    this.render();
  }

  private performWeightAction(action: WeightReminderAction): void {
    if (action.kind === "workout") {
      if (!this.state.activeWorkout) this.state.activeWorkout = createBlankWorkout(this.state);
      this.persist();
      this.navigate("workout");
      return;
    }
    if (action.kind === "routine") {
      const routine = this.state.routines?.find(item => item.id === action.routineId);
      if (!routine) return;
      this.state.activeWorkout = workoutFromRoutine(this.state, routine);
      this.persist();
      this.navigate("workout");
      return;
    }
    if (action.kind === "hike") {
      this.pendingHikeGpx = null;
      this.editingHikeId = null;
      this.navigate("hike");
      return;
    }
    this.startCircuitFromDraft();
  }

  private startCircuitFromDraft(): void {
    const routine: WorkoutRoutine = { id: uid("routine"), name: this.circuitDraftName, mode:"circuit", rounds:this.circuitDraftRounds, exercises:this.circuitDraftRows.map(row=>{
      const definition = exerciseById(row.exerciseId);
      const set: Pick<SetEntry, "weightKg" | "reps" | "durationSec" | "distanceKm" | "setType"> = { setType:"normal" };
      if (definition?.type === "weight_reps") { set.weightKg=row.weightKg; set.reps=row.reps; }
      else if (definition?.type === "duration") set.durationSec=row.durationSec;
      else if (definition?.type === "distance_time") { set.distanceKm=row.distanceKm; set.durationSec=row.minutes*60; }
      else set.reps=row.reps;
      return { exerciseId:row.exerciseId, restSec:row.restSec, sets:[set] };
    }) };
    this.endRest(false);
    this.state.activeWorkout = workoutFromRoutine(this.state, routine);
    this.showCircuitBuilder = false;
    this.persist();
    this.navigate("workout");
  }

  private renderHome(): string {
    const active = this.workoutHasStarted() ? this.state.activeWorkout : null;
    const weightKg = this.currentWeightKg();
    const goals = this.state.goals!;
    const goalScore = weeklyGoalScore(this.state.workouts, this.state.hikes, weightKg, goals, this.state.hydration, this.state.hydrationHistory ?? []);
    const currentWeeklyTrend = dailyCalorieSeries(this.state.workouts, this.state.hikes, weightKg);
    const weeklyTrend = dailyCalorieSeries(this.state.workouts, this.state.hikes, weightKg, this.weekReference(this.workoutTrendWeekOffset));
    const monthlyTrend = monthlyCalorieSeries(this.state.workouts, this.state.hikes, weightKg, this.monthlyTrendStart, 12);
    const todayKey = localDateKey(new Date());
    const todayCalories = currentWeeklyTrend.find(point => point.key === todayKey)?.count ?? 0;
    const dailyCalorieTarget = this.dailyCalorieTarget();
    const todayCaloriePct = Math.min(100, Math.round(todayCalories / dailyCalorieTarget * 100));
    const todayWaterPct = Math.min(100, Math.round(this.state.hydration.totalMl / Math.max(1, this.state.hydration.targetMl) * 100));
    const caloriePct = Math.min(100, Math.round(goalScore.weeklyCalories / Math.max(1, goals.weeklyCalories) * 100));
    const categorySets = weeklyCategorySets(this.state.workouts);
    const previewPreset = this.previewGoalMode ? goalPreset(this.previewGoalMode) : null;
    const routines = this.state.routines ?? [];
    return `
      <h1 class="page-title">${escapeHtml(this.text("goodEvening"))}, ${escapeHtml(this.state.user.displayName)}</h1>
      <p class="page-subtitle">${escapeHtml(this.text("today"))}</p>
      ${!cloudModeEnabled() ? `<div class="banner">${escapeHtml(this.text("demoMode"))}</div>` : ""}
      ${active ? `<div class="card recovery"><div class="row recovery-row"><div><div class="small muted">${escapeHtml(this.text("currentWorkout"))}</div><div class="strong">${escapeHtml(active.routineName)}</div><div class="small muted">${active.exercises.length} ${escapeHtml(this.text("exercises"))} · ${completedSetCount(active)} ${escapeHtml(this.text("completedSets"))}</div></div><div class="quick-buttons"><button class="btn small primary" data-action="continue-workout">${escapeHtml(this.text("continueWorkout"))}</button><button class="btn small ghost danger" data-action="discard-workout">${escapeHtml(this.text("discard"))}</button></div></div></div>` : ""}

      <div class="grid-actions section">
        <button class="action-card primary" data-action="start-workout"><span class="action-icon">${icon("dumbbell")}</span><div class="action-title">${escapeHtml(this.text("startWorkout"))}</div><div class="action-meta">${escapeHtml(this.text("startFresh"))}</div></button>
        <button class="action-card" data-action="log-hike"><span class="action-icon">${icon("mountain")}</span><div class="action-title">${escapeHtml(this.text("logHike"))}</div><div class="action-meta">Hike / walk</div></button>
      </div>

      <section class="section">
        <div class="section-header"><h2 class="section-title">${escapeHtml(this.text("savedRoutines"))}</h2><button class="btn small" data-action="new-circuit">${icon("plus")} ${this.locale === "zh-TW" ? "新增循環訓練" : "New circuit"}</button></div>
        ${routines.length ? `<div class="routine-strip">${routines.slice(0,10).map(r=>`<div class="card routine-card"><button class="routine-launch" data-start-routine="${escapeHtml(r.id)}"><strong>${escapeHtml(r.name)}</strong><span>${r.mode === "circuit" ? `${r.rounds ?? 3} ${this.locale === "zh-TW" ? "輪" : "rounds"} · ` : ""}${r.exercises.length} ${escapeHtml(this.text("exercises"))}</span></button><button class="icon-btn subtle-danger mini-icon routine-delete" data-delete-routine="${escapeHtml(r.id)}" aria-label="${this.locale === "zh-TW" ? "刪除已儲存訓練" : "Delete saved routine"}">${icon("trash")}</button></div>`).join("")}</div>` : ""}
        ${this.showCircuitBuilder ? this.renderCircuitBuilder() : ""}
      </section>

      <section class="section">
        <div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "今日目標" : "Daily goal"}</h2><span class="section-value">${todayCalories} / ${dailyCalorieTarget} Cal</span></div>
        <div class="card daily-goal-card">
          <div class="daily-goal-row"><div><strong>${this.locale === "zh-TW" ? "運動熱量" : "Exercise calories"}</strong><span>${todayCalories} / ${dailyCalorieTarget} Cal</span></div><div class="progress-track"><div class="progress-fill" data-style-width="${todayCaloriePct}"></div></div></div>
          <div class="daily-goal-row water"><div><strong>${this.locale === "zh-TW" ? "飲水" : "Water"}</strong><span>${this.state.hydration.totalMl.toLocaleString()} / ${this.state.hydration.targetMl.toLocaleString()} mL</span></div><div class="progress-track"><div class="progress-fill water-fill" data-style-width="${todayWaterPct}"></div></div></div>
        </div>
      </section>

      <section class="section">
        <div class="section-header"><h2 class="section-title">${escapeHtml(this.text("weeklyCalories"))}</h2><span class="section-value">~${goalScore.weeklyCalories} / ${goals.weeklyCalories} Cal</span></div>
        <div class="card"><div class="progress-track"><div class="progress-fill" data-style-width="${caloriePct}"></div></div><div class="small muted calorie-formula-note">${this.locale === "zh-TW" ? "熱量是估算值，適合看趨勢；完整計算方式已移到設定頁。" : "Calories are estimates for trend tracking; the full formula now lives in Settings."}</div>${(this.state.profile?.weightEntries.length ?? 0) === 0 ? `<div class="small calorie-warning">${this.locale === "zh-TW" ? "請在個人頁記錄體重，估算會更合理。" : "Add your weight in Personal for a better estimate."}</div>` : ""}</div>
      </section>

      <section class="section">
        <div class="section-header"><h2 class="section-title">${escapeHtml(this.text("workoutTrend"))}</h2><div class="segmented"><button data-trend="weekly" class="${this.trendMode === "weekly" ? "active" : ""}">${escapeHtml(this.text("weekly"))}</button><button data-trend="monthly" class="${this.trendMode === "monthly" ? "active" : ""}">${escapeHtml(this.text("monthly"))}</button></div></div>
        <div class="card trend-card">${this.trendMode === "weekly" ? this.renderWeeklyTrend(weeklyTrend, this.workoutTrendWeekOffset) : this.renderMonthlyTrend(monthlyTrend)}</div>
      </section>

      <section class="section">
        <div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "本週任務" : "Weekly missions"}</h2><span class="section-value mission-score">${goalScore.score}/10</span></div>
        <div class="card goals-overview">
          <div class="weekly-mission-list">
            <div class="mission-row ${goalScore.calorieMissionDone ? "done" : ""}"><span>${this.locale === "zh-TW" ? "達成每日運動熱量" : "Hit daily exercise calories"}</span><strong>${goalScore.calorieDays}/${goalScore.calorieTargetDays}</strong></div>
            <div class="mission-row ${goalScore.waterMissionDone ? "done" : ""}"><span>${this.locale === "zh-TW" ? "達成每日飲水目標" : "Hit daily hydration goal"}</span><strong>${goalScore.waterDays}/7</strong></div>
            ${ALL_CATEGORIES.map(category => {
              const current = categorySets[category] ?? 0;
              const target = Math.max(1, goals.categorySets[category] ?? 1);
              return `<div class="mission-row ${current >= target ? "done" : ""}"><span>${escapeHtml(this.exerciseCategoryLabel(category))}</span><strong>${this.trainingCreditText(Math.min(current,target))}/${target}</strong></div>`;
            }).join("")}
          </div>
          <div class="tiny muted training-credit-note">${this.locale === "zh-TW" ? "複合動作會依主要肌群比例分配訓練點數；有氧與活動度使用時間點數，因此不會拿散步取代胸、背或腿部力量任務。" : "Compound exercises split training credit across the muscles they train. Cardio and mobility use separate time-based credit, so an easy walk cannot replace chest, back, or leg strength missions."}</div>
          <div class="progress-track"><div class="progress-fill" data-style-width="${Math.min(100,Math.round(goalScore.score/10*100))}"></div></div>
          <div class="goal-mode-block collapsed-goal-control">
            <button class="goal-difficulty-toggle" data-action="toggle-goal-difficulty" aria-expanded="${this.showGoalDifficultyMenu}"><span>${this.locale === "zh-TW" ? "這週比較累？調整難度？" : "Hard week? Change difficulty?"}</span><strong>${escapeHtml(this.goalModeLabel(goals.difficulty ?? "normal"))} · ${goals.weeklyCalories} Cal</strong><span class="history-chevron ${this.showGoalDifficultyMenu ? "open" : ""}">${icon("chevron")}</span></button>
            ${this.showGoalDifficultyMenu ? `<div class="goal-difficulty-menu"><div class="small muted">${this.locale === "zh-TW" ? "先點一下預覽需求，再點同一難度一次確認。每週最多變更 3 次。" : "Tap once to preview requirements, then tap the same difficulty again to confirm. Maximum 3 changes per week."}</div><div class="segmented goal-modes">${(["easy","normal","hard","extreme"] as GoalDifficulty[]).map(mode=>`<button data-goal-mode="${mode}" class="${goals.difficulty === mode ? "active" : ""} ${this.previewGoalMode === mode ? "preview" : ""}">${this.goalModeLabel(mode)}</button>`).join("")}</div><div class="tiny muted">${this.locale === "zh-TW" ? `本週剩餘 ${Math.max(0,3-(goals.difficultyChanges ?? 0))} 次變更` : `${Math.max(0,3-(goals.difficultyChanges ?? 0))} changes left this week`}</div>${previewPreset ? `<div class="goal-preview"><div class="row"><strong>${escapeHtml(this.goalModeLabel(this.previewGoalMode!))}</strong><span>${previewPreset.weeklyCalories} Cal/week · ${calorieMissionTargetDays(this.previewGoalMode!)} ${this.locale === "zh-TW" ? "天熱量任務" : "calorie days"}</span></div><div class="goal-preview-grid">${ALL_CATEGORIES.map(category=>`<span>${escapeHtml(this.exerciseCategoryLabel(category))} <b>${Math.max(1,previewPreset.categorySets[category] ?? 1)}</b></span>`).join("")}</div><div class="tiny muted">${this.locale === "zh-TW" ? (this.previewGoalMode === goals.difficulty ? "這是目前模式；再按一次關閉預覽。" : `再按一次「${this.goalModeLabel(this.previewGoalMode!)}」才會套用並計入變更次數。`) : (this.previewGoalMode === goals.difficulty ? "This is your current mode; tap again to close the preview." : `Tap ${this.goalModeLabel(this.previewGoalMode!)} again to apply it and use one change.`)}</div></div>` : ""}</div>` : ""}
          </div>
        </div>
      </section>

      <section class="section">${this.renderRecent(3)}</section>`;
  }

  private renderWeeklyTrend(trend: Array<{ key: string; label: string; count: number; sublabel?: string }>, offset = 0): string {
    const width=640, height=230, left=34, right=12, top=26, bottom=46;
    const plotW=width-left-right, plotH=height-top-bottom;
    const max=Math.max(100,...trend.map(point=>point.count*1.12));
    const barW=Math.max(22,Math.min(52,plotW/11));
    const points=trend.map((point,index)=>{
      const x=left+(index+.5)*plotW/7;
      const y=top+plotH-(point.count/max)*plotH;
      return {point,x,y};
    });
    const grid=[0,.5,1].map(f=>{ const y=top+plotH-f*plotH; return `<line x1="${left}" y1="${y.toFixed(1)}" x2="${width-right}" y2="${y.toFixed(1)}" class="chart-grid"/><text x="${left-6}" y="${(y+3).toFixed(1)}" text-anchor="end" class="chart-tick">${Math.round(max*f)}</text>`; }).join("");
    const start = trend[0] ? new Date(`${trend[0].key}T12:00:00`) : this.weekReference(offset);
    const end = trend[6] ? new Date(`${trend[6].key}T12:00:00`) : start;
    const range = offset === 0
      ? (this.locale === "zh-TW" ? "本週" : "This week")
      : `${start.toLocaleDateString(this.locale,{month:"short",day:"numeric"})} – ${end.toLocaleDateString(this.locale,{month:"short",day:"numeric"})}`;
    return `<div class="weekly-combo-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(this.text("workoutTrend"))}">${grid}${points.map(({point,x,y})=>{ const barHeight=top+plotH-y; return `<rect x="${(x-barW/2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1,barHeight).toFixed(1)}" rx="7" class="weekly-trend-bar"><title>${escapeHtml(point.label)}: ${point.count} Cal</title></rect>`; }).join("")}<polyline points="${points.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}" class="weekly-trend-line"/>${points.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" class="weekly-trend-dot"/><text x="${p.x.toFixed(1)}" y="${height-24}" text-anchor="middle" class="chart-label">${escapeHtml(p.point.label)}</text><text x="${p.x.toFixed(1)}" y="${height-10}" text-anchor="middle" class="chart-sublabel">${escapeHtml(p.point.sublabel ?? "")}</text>`).join("")}</svg><div class="small muted chart-unit">Cal (${escapeHtml(this.text("estimated"))})</div><div class="week-shift-nav"><button class="icon-btn mini-icon" data-weekly-trend-nav="prev" aria-label="${this.locale === "zh-TW" ? "上一週" : "Previous week"}">‹</button><span>${escapeHtml(range)}</span><button class="icon-btn mini-icon" data-weekly-trend-nav="next" ${offset >= 0 ? "disabled" : ""} aria-label="${this.locale === "zh-TW" ? "下一週" : "Next week"}">›</button></div></div>`;
  }

  private renderMonthlyTrend(trend: Array<{ key: string; label: string; count: number; sublabel?: string }>): string {
    const width=720, height=240, left=44, right=12, top=24, bottom=42;
    const plotW=width-left-right, plotH=height-top-bottom;
    const rawMax=Math.max(100,...trend.map(point=>point.count));
    const step=Math.max(50,Math.ceil(rawMax/4/50)*50);
    const max=step*4;
    const points=trend.map((point,index)=>({point,x:left+(trend.length<=1?plotW/2:index*plotW/(trend.length-1)),y:top+plotH-(point.count/max)*plotH}));
    const grid=Array.from({length:5},(_,index)=>{ const value=step*index; const y=top+plotH-(value/max)*plotH; return `<line x1="${left}" y1="${y.toFixed(1)}" x2="${width-right}" y2="${y.toFixed(1)}" class="chart-grid"/><text x="${left-7}" y="${(y+3).toFixed(1)}" text-anchor="end" class="chart-tick">${value}</text>`; }).join("");
    const total=trend.reduce((sum,point)=>sum+point.count,0);
    const start=new Date(this.monthlyTrendStart.getFullYear(),this.monthlyTrendStart.getMonth(),1);
    const end=new Date(start.getFullYear(),start.getMonth()+11,1);
    const range=`${start.toLocaleDateString(this.locale,{month:"short",year:"numeric"})} – ${end.toLocaleDateString(this.locale,{month:"short",year:"numeric"})}`;
    return `<div class="monthly-line-chart"><div class="chart-summary"><span>${this.locale === "zh-TW" ? "12 個月總計" : "12-month total"}</span><strong>~${total.toLocaleString()} Cal</strong></div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${this.locale === "zh-TW" ? "每月估算運動熱量" : "Monthly estimated exercise calories"}">${grid}<polyline points="${points.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}" class="monthly-trend-line"/>${points.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" class="monthly-trend-dot"><title>${escapeHtml(p.point.label)} ${escapeHtml(p.point.sublabel ?? "")}: ${p.point.count} Cal</title></circle><text x="${p.x.toFixed(1)}" y="${height-14}" text-anchor="middle" class="month-label">${escapeHtml(p.point.label)}</text>`).join("")}</svg><div class="monthly-trend-nav"><button class="icon-btn mini-icon" data-monthly-trend-nav="prev" aria-label="${this.locale === "zh-TW" ? "往前一個月" : "Shift one month earlier"}">‹</button><span>${escapeHtml(range)} · Cal</span><button class="icon-btn mini-icon" data-monthly-trend-nav="next" aria-label="${this.locale === "zh-TW" ? "往後一個月" : "Shift one month later"}">›</button></div></div>`;
  }

  private goalModeLabel(mode: GoalDifficulty): string {
    const labels = this.locale === "zh-TW"
      ? { easy:"輕鬆", normal:"一般", hard:"困難", extreme:"極限" }
      : { easy:"Easy", normal:"Normal", hard:"Hard", extreme:"Extreme" };
    return labels[mode];
  }


  private circuitTargetFields(row: { exerciseId: string; reps: number; weightKg: number; durationSec: number; distanceKm: number; minutes: number; restSec: number }, index: number): string {
    const definition = exerciseById(row.exerciseId);
    let fields = "";
    if (definition?.type === "weight_reps") fields = `<label class="mini-field"><span>kg</span><input class="set-input" type="number" min="0" step="0.5" name="weight_${index}" value="${row.weightKg}"></label><label class="mini-field"><span>${escapeHtml(this.text("reps"))}</span><input class="set-input" type="number" min="0" max="500" step="1" name="reps_${index}" value="${row.reps}"></label>`;
    else if (definition?.type === "duration") fields = `<label class="mini-field"><span>${escapeHtml(this.text("seconds"))}</span><input class="set-input" type="number" min="0" max="7200" step="5" name="duration_${index}" value="${row.durationSec}"></label>`;
    else if (definition?.type === "distance_time") fields = `<label class="mini-field"><span>km</span><input class="set-input" type="number" min="0" max="1000" step="0.1" name="distance_${index}" value="${row.distanceKm}"></label><label class="mini-field"><span>${escapeHtml(this.text("minutes"))}</span><input class="set-input" type="number" min="0" max="1440" step="1" name="minutes_${index}" value="${row.minutes}"></label>`;
    else fields = `<label class="mini-field"><span>${escapeHtml(this.text("reps"))}</span><input class="set-input" type="number" min="0" max="500" step="1" name="reps_${index}" value="${row.reps}"></label>`;
    return `<div class="circuit-target-fields">${fields}<label class="mini-field"><span>${this.locale === "zh-TW" ? "休息秒" : "Rest s"}</span><input class="set-input" type="number" min="0" max="900" step="5" name="rest_${index}" value="${row.restSec}" title="${this.locale === "zh-TW" ? "0 = 正計時" : "0 = count up"}"></label></div>`;
  }

  private renderCircuitBuilder(): string {
    const options = (selected: string) => LIBRARY_GROUP_ORDER.map(group => {
      const items = EXERCISES.filter(exercise => exerciseLibraryGroup(exercise) === group);
      if (!items.length) return "";
      return `<optgroup label="${escapeHtml(this.exerciseLibraryGroupLabel(group))}">${items.map(exercise => `<option value="${escapeHtml(exercise.id)}" ${exercise.id === selected ? "selected" : ""}>${escapeHtml(exercise.names[this.locale])}</option>`).join("")}</optgroup>`;
    }).join("");
    return `<form id="circuit-builder" class="card circuit-builder"><div class="row"><div><strong>${this.locale === "zh-TW" ? "循環訓練" : "Circuit"}</strong><div class="small muted">${this.locale === "zh-TW" ? "設定輪數與每個動作，開始後可再從運動畫面儲存為訓練模板。" : "Set the rounds and movements. After starting, you can save it as a routine from Workout now."}</div></div><button type="button" class="icon-btn" data-action="close-circuit">×</button></div><div class="form-two"><div class="field"><label>${this.locale === "zh-TW" ? "名稱" : "Name"}</label><input class="input" name="circuitName" maxlength="50" value="${escapeHtml(this.circuitDraftName)}"></div><div class="field"><label>${this.locale === "zh-TW" ? "輪數" : "Rounds"}</label><input class="input" name="circuitRounds" type="number" min="1" max="10" value="${this.circuitDraftRounds}"></div></div><div class="circuit-rows">${this.circuitDraftRows.map((row,index)=>{ const definition=exerciseById(row.exerciseId); return `<div class="circuit-row"><span class="circuit-order">${index+1}</span><div class="circuit-builder-exercise"><select class="select" name="exercise_${index}" data-circuit-exercise-index="${index}">${options(row.exerciseId)}</select>${definition ? `<div class="exercise-preview-card compact-preview"><span>${escapeHtml(this.exercisePreviewHint(definition))}</span><a class="exercise-example-link" href="${escapeHtml(this.exerciseImageSearchUrl(definition))}" target="_blank" rel="noopener noreferrer">${this.locale === "zh-TW" ? "查看圖片示範" : "View image examples"}</a></div>` : ""}</div>${this.circuitTargetFields(row,index)}<button type="button" class="icon-btn subtle-danger" data-circuit-remove="${index}" ${this.circuitDraftRows.length <= 1 ? "disabled" : ""} aria-label="${this.locale === "zh-TW" ? "刪除動作" : "Remove movement"}">${icon("trash")}</button></div>`; }).join("")}</div><div class="row"><button type="button" class="btn small" data-action="add-circuit-row">${icon("plus")} ${this.locale === "zh-TW" ? "新增動作" : "Add movement"}</button><button class="btn primary" type="submit">${this.locale === "zh-TW" ? "開始循環" : "Start circuit"}</button></div></form>`;
  }

  private renderRecent(limit = 8): string {
    const today = localDateKey(new Date());
    const activities = this.historyActivities().filter(activity => localDateKey(activity.date) === today).slice(0, limit);
    return `<div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "今天的活動" : "Today's activity"}</h2></div>
      ${activities.length === 0 ? `<div class="card muted">${escapeHtml(this.text("noActivities"))}</div>` : activities.map(activity => {
        if (activity.kind === "workout") {
          return `<div class="card compact"><div class="row"><div class="row-start"><span class="activity-dot"></span><div><div class="strong medium">${escapeHtml(activity.workout.routineName)}</div><div class="small muted">${activity.workout.exercises.length} ${escapeHtml(this.text("exercises"))} · ${completedSetCount(activity.workout)} ${escapeHtml(this.text("completedSets"))}</div></div></div><div class="small muted">${escapeHtml(this.formatDate(activity.date))}</div></div></div>`;
        }
        return `<div class="card compact"><div class="row"><div class="row-start"><span class="activity-dot hike"></span><div><div class="strong medium">${escapeHtml(activity.hike.name)}</div><div class="small muted">${activity.hike.distanceKm.toFixed(1)} km · +${activity.hike.elevationGainM} m</div></div></div><div class="small muted">${escapeHtml(this.formatDate(activity.date))}</div></div></div>`;
      }).join("")}`;
  }

  private historyActivities(): HistoryActivity[] {
    return [
      ...this.state.workouts.filter(w => w.completedAt).map(w => ({ kind: "workout" as const, id: w.id, date: w.completedAt ?? w.startedAt, workout: w })),
      ...this.state.hikes.map(h => ({ kind: "hike" as const, id: h.id, date: h.startedAt ?? `${h.date}T12:00:00`, hike: h }))
    ].sort((a, b) => b.date.localeCompare(a.date));
  }

  private formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(this.locale, { month: "short", day: "numeric", year: "numeric" });
  }

  private formatTime(iso: string | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString(this.locale, { hour: "2-digit", minute: "2-digit" });
  }

  private toDateTimeLocal(iso: string | undefined): string {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private dateTimeInputToIso(value: string, fallback: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
  }

  private editedText(editedAt: string | undefined): string {
    return editedAt ? (this.locale === "zh-TW" ? "（已編輯）" : "(edited)") : "";
  }

  private ensureHydrationDayForDate(date: string): HydrationDay {
    const existing = this.hydrationDayForDate(date);
    if (existing) return existing;
    const day: HydrationDay = {
      schemaVersion: 1,
      date,
      userId: this.state.user.id,
      familyId: this.state.user.familyId,
      targetMl: this.state.hydration.targetMl || 2000,
      totalMl: 0,
      entries: [],
      visibility: "private"
    };
    if (date === localDateKey(new Date())) this.state.hydration = day;
    else { this.state.hydrationHistory ??= []; this.state.hydrationHistory.push(day); }
    return day;
  }

  private ensureSupplementDayForDate(date: string): { date: string; entries: SupplementEntry[] } {
    this.state.supplementHistory ??= [];
    let day = this.state.supplementHistory.find(item => item.date === date);
    if (!day) { day = { date, entries: [] }; this.state.supplementHistory.push(day); }
    return day;
  }

  private renderHistory(): string {
    const hikeKm = this.state.hikes.reduce((sum, h) => sum + h.distanceKm, 0);
    const activities = this.historyActivities().filter(activity => localDateKey(activity.date) === this.selectedCalendarDate && (this.historyFilter === "all" || activity.kind === this.historyFilter));
    return `<h1 class="page-title">${escapeHtml(this.text("history"))}</h1><p class="page-subtitle">${this.locale === "zh-TW" ? "點日期查看當天的運動；詳細紀錄只在需要時展開。" : "Pick a date to see that day's activity; expand details only when you need them."}</p>
      <div class="stat-grid"><div class="stat"><div class="stat-value">${this.state.workouts.length}</div><div class="stat-label">${escapeHtml(this.text("workouts"))}</div></div><div class="stat"><div class="stat-value">${this.state.hikes.length}</div><div class="stat-label">${escapeHtml(this.text("hikes"))}</div></div><div class="stat"><div class="stat-value">${hikeKm.toFixed(1)}</div><div class="stat-label">${escapeHtml(this.text("kmHiking"))}</div></div></div>
      <div class="card badge-month-progress"><span>${this.locale === "zh-TW" ? "本月徽章目標" : "Monthly badge goal"}</span><strong>${Math.min(monthlyGoalScore(this.state.workouts,this.state.hikes,this.currentWeightKg(),this.state.goals!,this.state.hydration,this.state.hydrationHistory ?? [],new Date(this.calendarMonth.getFullYear(),this.calendarMonth.getMonth()+1,0,23,59,59)),35)}/35</strong></div>
      ${this.renderCalendar()}
      <div class="segmented history-filter section" role="group" aria-label="History filter"><button data-history-filter="all" class="${this.historyFilter === "all" ? "active" : ""}">${escapeHtml(this.text("all"))}</button><button data-history-filter="workout" class="${this.historyFilter === "workout" ? "active" : ""}">${escapeHtml(this.text("workoutsOnly"))}</button><button data-history-filter="hike" class="${this.historyFilter === "hike" ? "active" : ""}">${escapeHtml(this.text("hikesOnly"))}</button></div>
      <section class="history-list section"><div class="section-header"><h2 class="section-title">${escapeHtml(new Date(`${this.selectedCalendarDate}T12:00:00`).toLocaleDateString(this.locale,{weekday:"long",month:"short",day:"numeric"}))}</h2><span class="section-value">${activities.length ? activities.length : ""}</span></div>${activities.length ? activities.map(activity => this.renderHistoryCard(activity)).join("") : `<div class="empty-mini">${this.locale === "zh-TW" ? "這天沒有紀錄" : "No activity recorded on this date."}</div>`}</section>`;
  }

  private renderCalendar(): string {
    const year = this.calendarMonth.getFullYear();
    const month = this.calendarMonth.getMonth();
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const mondayOffset = (first.getDay() + 6) % 7;
    const activityDates = new Set<string>();
    this.state.workouts.forEach(w => { if (w.completedAt) activityDates.add(localDateKey(w.completedAt)); });
    this.state.hikes.forEach(h => activityDates.add(h.date));
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
    const monthScore = monthlyGoalScore(this.state.workouts, this.state.hikes, this.currentWeightKg(), this.state.goals!, this.state.hydration, this.state.hydrationHistory ?? [], monthEnd);
    const badgeEarned = monthScore >= 35;
    const dailyCalorieTarget = this.dailyCalorieTarget();
    const palette = this.categoryPalette();
    const cells: string[] = [];
    for (let i = 0; i < mondayOffset; i += 1) cells.push('<div class="calendar-cell blank"></div>');
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      const active = activityDates.has(key);
      const selected = this.selectedCalendarDate === key;
      const calorieHit = caloriesOnDate(this.state.workouts, this.state.hikes, this.currentWeightKg(), key) >= dailyCalorieTarget;
      const hasWorkout = this.state.workouts.some(workout => workout.completedAt && localDateKey(workout.completedAt) === key);
      const hasHike = this.state.hikes.some(hike => hike.date === key);
      const hasWeight = (this.state.profile?.weightEntries ?? []).some(entry => entry.date === key);
      const today = key === localDateKey(new Date());
      cells.push(`<button class="calendar-cell history-day ${active ? "has-activity" : ""} ${calorieHit ? "calorie-hit" : ""} ${today ? "today" : ""} ${selected ? "selected" : ""}" data-calendar-day="${key}"><span class="calendar-day-number">${day}</span>${hasWorkout ? `<i class="history-activity-dot" title="${this.locale === "zh-TW" ? "有運動紀錄" : "Workout logged"}"></i>` : ""}${hasWeight ? `<b class="calendar-weight-marker" title="${this.locale === "zh-TW" ? "有體重紀錄" : "Weight recorded"}">♥</b>` : ""}${hasHike ? `<b class="calendar-hike-marker" title="${this.locale === "zh-TW" ? "健行" : "Hike"}">▲</b>` : ""}</button>`);
    }
    const distribution = categoryDistributionForDate(this.state.workouts, this.state.hikes, this.selectedCalendarDate);
    const total = distribution.reduce((sum, item) => sum + item.count, 0);
    let cursor = 0;
    const slices: string[] = [];
    distribution.forEach((item, index) => { if (!item.count || !total) return; const start = cursor; cursor += item.count / total * 100; slices.push(`${palette[index % palette.length]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`); });
    const pieStyle = slices.length ? `conic-gradient(${slices.join(",")})` : "";
    const photoWorkouts = this.state.workouts.filter(w => w.completedAt && localDateKey(w.completedAt) === this.selectedCalendarDate && w.photoId);
    return `<section class="section calendar-section">
      <div class="section-header"><h2 class="section-title">${escapeHtml(this.text("calendar"))}${badgeEarned ? ` <span class="gold-badge" title="${this.locale === "zh-TW" ? "本月徽章" : "Monthly badge"}">★</span>` : ""}</h2><div class="calendar-nav"><button class="icon-btn mini-icon" data-calendar-nav="prev" aria-label="Previous month">‹</button><strong>${escapeHtml(first.toLocaleDateString(this.locale,{month:"long",year:"numeric"}))}</strong><button class="icon-btn mini-icon" data-calendar-nav="next" aria-label="Next month">›</button></div></div>
      <div class="card calendar-card ${badgeEarned ? "badge-month" : ""}"><div class="weekday-row">${(this.locale === "zh-TW" ? ["一","二","三","四","五","六","日"] : ["M","T","W","T","F","S","S"]).map(d=>`<span>${d}</span>`).join("")}</div><div class="calendar-grid">${cells.join("")}</div><div class="calendar-marker-help small muted">${this.locale === "zh-TW" ? "圓點 = 當天有運動紀錄，♥ = 體重紀錄，▲ = 健行，主題色底 = 當日熱量目標達成。" : "Dot = workout logged, ♥ = weight recorded, ▲ = hike, accent-colored day = daily calorie goal hit."}</div></div>
      <div class="card exercise-mix-card"><div><div class="strong">${escapeHtml(this.text("exerciseMix"))}</div><div class="small muted">${escapeHtml(new Date(`${this.selectedCalendarDate}T12:00:00`).toLocaleDateString(this.locale,{month:"short",day:"numeric",year:"numeric"}))}</div></div><div class="pie-layout"><div class="pie-chart ${total ? "" : "empty-pie"}" data-style-background="${escapeHtml(pieStyle)}" aria-label="${escapeHtml(this.text("exerciseMix"))}"></div><div class="pie-legend">${distribution.map((item,index)=>`<div class="${item.count ? "" : "zero"}"><span class="legend-dot" data-style-background="${escapeHtml(palette[index % palette.length] ?? "")}"></span><span>${escapeHtml(this.exerciseCategoryLabel(item.category))}</span><strong>${this.trainingCreditText(item.count)}</strong></div>`).join("")}</div></div>${!total ? `<div class="empty-mini">${escapeHtml(this.text("noExerciseThatDay"))}</div>` : ""}${photoWorkouts.length ? `<div class="day-photos">${photoWorkouts.map(w=>this.privateImage(w.photoId,"history-photo-thumb",w.routineName)).join("")}</div>` : ""}</div>
    </section>`;
  }

  private routeTrace(points: Array<Pick<GpxPoint, "lat" | "lon">>, className = "route-trace"): string {
    if (points.length < 2) return "";
    const lats = points.map(point => point.lat);
    const lons = points.map(point => point.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const latRange = Math.max(0.000001, maxLat - minLat), lonRange = Math.max(0.000001, maxLon - minLon);
    const coords = points.map(point => `${(8 + ((point.lon-minLon)/lonRange)*304).toFixed(1)},${(132 - ((point.lat-minLat)/latRange)*116).toFixed(1)}`).join(" ");
    return `<div class="${escapeHtml(className)}"><svg viewBox="0 0 320 140" role="img" aria-label="${this.locale === "zh-TW" ? "GPS 路線軌跡" : "GPS route trace"}"><polyline points="${coords}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${coords.split(" ")[0]?.split(",")[0]}" cy="${coords.split(" ")[0]?.split(",")[1]}" r="5" fill="currentColor"/><circle cx="${coords.split(" ").at(-1)?.split(",")[0]}" cy="${coords.split(" ").at(-1)?.split(",")[1]}" r="5" fill="currentColor"/></svg></div>`;
  }

  private renderHistoryCard(activity: HistoryActivity): string {
    const key = `${activity.kind}:${activity.id}`;
    const expanded = this.expandedHistoryKey === key;
    if (activity.kind === "workout") {
      const w = activity.workout;
      const durationMinutes = workoutDurationMinutes(w);
      const calories = estimateWorkoutCalories(w, this.currentWeightKg());
      return `<article class="history-card">
        <button class="history-summary" data-history-toggle="${escapeHtml(key)}" aria-expanded="${expanded}">
          <span class="history-icon">${icon("dumbbell")}</span>
          <span class="history-copy"><span class="history-kicker">${escapeHtml(this.text("workout"))} · ${escapeHtml(this.formatDate(activity.date))}</span><span class="history-title">${escapeHtml(w.routineName)}</span><span class="history-meta">${this.formatTime(w.startedAt)}–${this.formatTime(w.completedAt ?? undefined)} · ${durationMinutes ? formatDuration(durationMinutes) : "—"} · ${w.routineMode === "circuit" ? `${w.circuitRounds ?? 1} ${this.locale === "zh-TW" ? "輪" : "rounds"} · ` : ""}${w.exercises.length} ${escapeHtml(this.text("exercises"))}${w.editedAt ? ` · ${escapeHtml(this.editedText(w.editedAt))}` : ""}</span></span>
          <span class="history-chevron ${expanded ? "open" : ""}">${icon("chevron")}</span>
        </button>
        ${expanded ? `<div class="history-details">${w.photoId ? this.privateImage(w.photoId,"history-photo",w.routineName) : ""}<div class="detail-grid workout-time-grid"><div><span>${escapeHtml(this.text("startTime"))}</span><strong>${escapeHtml(this.formatTime(w.startedAt))}</strong></div><div><span>${escapeHtml(this.text("endTime"))}</span><strong>${escapeHtml(this.formatTime(w.completedAt ?? undefined))}</strong></div><div><span>${escapeHtml(this.text("totalTime"))}</span><strong>${durationMinutes ? formatDuration(durationMinutes) : "—"}</strong></div><div><span>${this.locale === "zh-TW" ? "估算熱量" : "Estimated calories"}</span><strong>~${calories} Cal</strong></div></div><div class="nested-exercises">${w.routineMode === "circuit" ? this.renderSavedCircuitRounds(w) : w.exercises.map((exercise,index) => this.renderSavedExercise(w, exercise, index)).join("")}</div>${w.notes ? `<div class="detail-notes"><span>${escapeHtml(this.text("notes"))}</span>${escapeHtml(w.notes)}</div>` : ""}<div class="history-actions"><button class="btn" data-edit-workout="${escapeHtml(w.id)}">${escapeHtml(this.text("editWorkout"))}</button><button class="btn ghost danger" data-delete-workout="${escapeHtml(w.id)}">${icon("trash")} ${escapeHtml(this.text("deleteRecord"))}</button></div></div>` : ""}
      </article>`;
    }
    const h = activity.hike;
    return `<article class="history-card">
      <button class="history-summary" data-history-toggle="${escapeHtml(key)}" aria-expanded="${expanded}">
        <span class="history-icon hike">${icon("mountain")}</span>
        <span class="history-copy"><span class="history-kicker">${escapeHtml(this.text("hike"))} · ${escapeHtml(this.formatDate(activity.date))}</span><span class="history-title">${escapeHtml(h.name)}</span><span class="history-meta">${h.startedAt ? `${escapeHtml(this.formatTime(h.startedAt))} · ` : ""}${h.distanceKm.toFixed(1)} km · ${formatDuration(h.movingMinutes)} · +${h.elevationGainM} m${h.editedAt ? ` · ${escapeHtml(this.editedText(h.editedAt))}` : ""}</span></span>
        <span class="history-chevron ${expanded ? "open" : ""}">${icon("chevron")}</span>
      </button>
      ${expanded ? `<div class="history-details">${h.routePoints?.length ? this.routeTrace(h.routePoints,"history-route") : ""}<div class="detail-grid"><div><span>${escapeHtml(this.text("distance"))}</span><strong>${h.distanceKm.toFixed(1)} km</strong></div><div><span>${escapeHtml(this.text("movingTime"))}</span><strong>${formatDuration(h.movingMinutes)}</strong></div><div><span>${escapeHtml(this.text("elapsedTime"))}</span><strong>${formatDuration(h.elapsedMinutes)}</strong></div><div><span>${escapeHtml(this.text("elevationGain"))}</span><strong>+${h.elevationGainM} m</strong></div><div><span>${escapeHtml(this.text("difficulty"))}</span><strong>${h.difficulty}/5</strong></div></div>${h.notes ? `<div class="detail-notes"><span>${escapeHtml(this.text("notes"))}</span>${escapeHtml(h.notes)}</div>` : ""}<div class="history-actions"><button class="btn" data-edit-hike="${escapeHtml(h.id)}">${this.locale === "zh-TW" ? "編輯健行" : "Edit hike"}</button><button class="btn ghost danger" data-delete-hike="${escapeHtml(h.id)}">${icon("trash")} ${escapeHtml(this.text("deleteRecord"))}</button></div></div>` : ""}
    </article>`;
  }

  private renderSavedExercise(workout: WorkoutRecord, exercise: WorkoutExerciseEntry, exerciseIndex: number): string {
    const definition = exerciseById(exercise.exerciseId);
    const name = definition?.names[this.locale] ?? exercise.exerciseId;
    const key = `${workout.id}:${exerciseIndex}`;
    const expanded = this.expandedExerciseKey === key;
    const durationMinutes = exercise.startedAt && exercise.completedAt ? Math.max(0, Math.round((new Date(exercise.completedAt).getTime()-new Date(exercise.startedAt).getTime())/60000)) : null;
    return `<div class="saved-exercise nested">
      <button class="exercise-history-summary" data-exercise-toggle="${escapeHtml(key)}"><span><strong>${escapeHtml(name)}</strong><small>${exercise.sets.length} ${escapeHtml(this.text("sets"))}${exercise.difficulty ? ` · ${escapeHtml(this.text("effort"))} ${exercise.difficulty}/5` : ""}</small></span><span class="history-chevron ${expanded ? "open" : ""}">${icon("chevron")}</span></button>
      ${expanded ? `<div class="exercise-history-detail"><div class="detail-grid compact-grid"><div><span>${escapeHtml(this.text("startTime"))}</span><strong>${escapeHtml(this.formatTime(exercise.startedAt))}</strong></div><div><span>${escapeHtml(this.text("endTime"))}</span><strong>${escapeHtml(this.formatTime(exercise.completedAt))}</strong></div><div><span>${escapeHtml(this.text("exerciseTime"))}</span><strong>${durationMinutes === null ? "—" : formatDuration(durationMinutes)}</strong></div></div>${!exercise.startedAt ? `<div class="small muted timing-note">${escapeHtml(this.text("olderTiming"))}</div>` : ""}<div class="set-detail-table"><div class="set-detail-head"><span>#</span><span>${escapeHtml(this.text("setDetails"))}</span><span>${escapeHtml(this.text("duration"))}</span><span>${escapeHtml(this.text("restAfter"))}</span></div>${exercise.sets.map((set,index)=>`<div class="set-detail-row"><span>${index+1}</span><strong>${escapeHtml(this.setSummary(definition,set))}</strong><span>${escapeHtml(this.completedSetDurationText(set))}</span><span>${set.restAfterSec !== undefined ? `${set.restAfterSec}s` : "—"}</span></div>`).join("")}</div></div>` : ""}
    </div>`;
  }

  private renderSavedCircuitRounds(workout: WorkoutRecord): string {
    const rounds = Math.max(1, workout.circuitRounds ?? Math.max(...workout.exercises.map(exercise => exercise.sets.length), 1));
    return Array.from({ length: rounds }, (_, roundIndex) => {
      const key = `${workout.id}:round:${roundIndex}`;
      const expanded = this.expandedExerciseKey === key;
      const roundSets = workout.exercises.flatMap(exercise => {
        const set = exercise.sets[roundIndex];
        return set ? [{ exercise, set }] : [];
      });
      const startedTimes = roundSets.map(item => item.set.startedAt ? new Date(item.set.startedAt).getTime() : NaN).filter(Number.isFinite);
      const completedTimes = roundSets.map(item => item.set.completedAt ? new Date(item.set.completedAt).getTime() : NaN).filter(Number.isFinite);
      const startedAt = startedTimes.length ? new Date(Math.min(...startedTimes)).toISOString() : undefined;
      const completedAt = completedTimes.length ? new Date(Math.max(...completedTimes)).toISOString() : undefined;
      const duration = startedAt && completedAt ? this.clockText((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000) : "—";
      const effort = this.roundEffort(workout, roundIndex);
      return `<div class="saved-exercise nested circuit-history-round">
        <button class="exercise-history-summary" data-exercise-toggle="${escapeHtml(key)}"><span><strong>${this.locale === "zh-TW" ? `第 ${roundIndex + 1} 輪` : `Round ${roundIndex + 1}`}</strong><small>${roundSets.length} ${escapeHtml(this.text("exercises"))}${effort ? ` · ${escapeHtml(this.text("effort"))} ${effort}/5` : ""}</small></span><span class="history-chevron ${expanded ? "open" : ""}">${icon("chevron")}</span></button>
        ${expanded ? `<div class="exercise-history-detail"><div class="detail-grid compact-grid"><div><span>${escapeHtml(this.text("startTime"))}</span><strong>${escapeHtml(this.formatTime(startedAt))}</strong></div><div><span>${escapeHtml(this.text("endTime"))}</span><strong>${escapeHtml(this.formatTime(completedAt))}</strong></div><div><span>${escapeHtml(this.text("duration"))}</span><strong>${escapeHtml(duration)}</strong></div></div><div class="set-detail-table circuit-round-detail-table"><div class="set-detail-head"><span>${this.locale === "zh-TW" ? "動作" : "Exercise"}</span><span>${escapeHtml(this.text("setDetails"))}</span><span>${escapeHtml(this.text("duration"))}</span><span>${escapeHtml(this.text("restAfter"))}</span></div>${roundSets.map(({exercise,set})=>{ const definition=exerciseById(exercise.exerciseId); const name=definition?.names[this.locale] ?? exercise.exerciseId; return `<div class="set-detail-row"><span>${escapeHtml(name)}</span><strong>${escapeHtml(this.setSummary(definition,set))}</strong><span>${escapeHtml(this.completedSetDurationText(set))}</span><span>${set.restAfterSec !== undefined ? `${set.restAfterSec}s` : "—"}</span></div>`; }).join("")}</div></div>` : ""}
      </div>`;
    }).join("");
  }

  private hydrationDayForDate(date: string): HydrationDay | undefined {
    if (this.state.hydration.date === date) return this.state.hydration;
    return (this.state.hydrationHistory ?? []).find(day => day.date === date);
  }

  private supplementLabel(supplementId: string): string {
    const item = SUPPLEMENTS.find(supplement => supplement.id === supplementId);
    return item ? (this.locale === "zh-TW" ? item.zh : item.en) : supplementId;
  }

  private supplementUnitLabel(unit: SupplementUnit | undefined, amount?: number): string {
    if (!unit) return "";
    const zh: Record<SupplementUnit,string> = { mg:"mg", mcg:"µg", g:"g", IU:"IU", capsule:"顆膠囊", tablet:"錠", serving:"份", scoop:"匙", drop:"滴" };
    const en: Record<SupplementUnit,string> = { mg:"mg", mcg:"µg", g:"g", IU:"IU", capsule: amount === 1 ? "capsule" : "capsules", tablet: amount === 1 ? "tablet" : "tablets", serving: amount === 1 ? "serving" : "servings", scoop: amount === 1 ? "scoop" : "scoops", drop: amount === 1 ? "drop" : "drops" };
    return this.locale === "zh-TW" ? zh[unit] : en[unit];
  }

  private supplementEntriesForDate(date: string): SupplementEntry[] {
    return (this.state.supplementHistory ?? []).find(day => day.date === date)?.entries ?? [];
  }

  private supplementSearchUrl(supplementId: string): string {
    const label = this.supplementLabel(supplementId);
    return `https://www.google.com/search?q=${encodeURIComponent(`${label} supplement what is it uses evidence side effects interactions risks`)}`;
  }

  private renderWater(): string {
    const h = this.state.hydration;
    const waterPct = Math.min(100, Math.round(h.totalMl / Math.max(1, h.targetMl) * 100));
    const weekRef = this.weekReference(this.waterWeekOffset);
    const series = weeklyHydrationSeries(h, this.state.hydrationHistory ?? [], weekRef);
    const chartMax = Math.max(h.targetMl * 1.2, ...series.map(point => point.count * 1.08), 500);
    const goalTop = 100 - Math.min(100, h.targetMl / chartMax * 100);
    const goalDays = series.filter(point => point.count >= h.targetMl).length;
    const weekStart = series[0] ? new Date(`${series[0].key}T12:00:00`) : weekRef;
    const weekEnd = series[6] ? new Date(`${series[6].key}T12:00:00`) : weekRef;
    const weekLabel = this.waterWeekOffset === 0
      ? (this.locale === "zh-TW" ? "本週" : "This week")
      : `${weekStart.toLocaleDateString(this.locale,{month:"short",day:"numeric"})} – ${weekEnd.toLocaleDateString(this.locale,{month:"short",day:"numeric"})}`;
    const supplementOptions = SUPPLEMENTS.map(item => `<option value="${item.id}">${escapeHtml(this.locale === "zh-TW" ? item.zh : item.en)}</option>`).join("");
    const unitOptions = SUPPLEMENT_UNITS.map(unit => `<option value="${unit}" ${unit === "serving" ? "selected" : ""}>${escapeHtml(this.supplementUnitLabel(unit, 1))}</option>`).join("");
    const firstSupplement = SUPPLEMENTS[0];
    const infoUrl = firstSupplement ? this.supplementSearchUrl(firstSupplement.id) : "https://www.google.com/search?q=supplements";
    return `<h1 class="page-title">${this.locale === "zh-TW" ? "飲水與補充品" : "Water & supplements"}</h1><p class="page-subtitle">${this.locale === "zh-TW" ? "追蹤每日飲水目標，也可快速記錄常用補充品；月曆會把兩者放在同一天查看。" : "Track your daily water goal and quickly log common supplements; the calendar keeps both together by day."}</p>
      <div class="card water-main"><div class="water-amount">${h.totalMl.toLocaleString()} <span class="medium muted">/ ${h.targetMl.toLocaleString()} mL</span></div><div class="progress-track"><div class="progress-fill" data-style-width="${waterPct}"></div></div><div class="quick-buttons"><button class="btn touch" data-water="250">+250 mL</button><button class="btn touch" data-water="500">+500 mL</button><button class="btn touch" data-water="750">+750 mL</button></div><div class="tiny muted water-default-note">${h.targetMl === 2000 ? (this.locale === "zh-TW" ? "標準每日目標固定為 2,000 mL；如有特殊需求可到設定調整。" : "The standard daily goal is fixed at 2,000 mL. Use Settings → Special needs only if you need a different target.") : (this.locale === "zh-TW" ? `特殊目標：${h.targetMl.toLocaleString()} mL` : `Special target: ${h.targetMl.toLocaleString()} mL`)}</div></div>
      <section class="section"><details class="card supplement-log-card"><summary class="supplement-log-summary"><div><strong>${this.locale === "zh-TW" ? "新增補充品紀錄" : "Add a supplement record"}</strong><span>${this.locale === "zh-TW" ? "新紀錄只會加到今天" : "New entries are always added to today"}</span></div><span class="history-chevron">${icon("chevron")}</span></summary><div class="supplement-log-body"><form id="supplement-form" class="supplement-form"><label class="field supplement-name"><span>${this.locale === "zh-TW" ? "補充品" : "Supplement"}</span><select class="select" name="supplementId" id="supplement-picker">${supplementOptions}</select><a class="supplement-more-link" id="supplement-info-link" href="${escapeHtml(infoUrl)}" target="_blank" rel="noopener noreferrer">${this.locale === "zh-TW" ? "查看更多：用途／證據／副作用" : "View more: uses / evidence / side effects"}</a></label><label class="field supplement-amount"><span>${this.locale === "zh-TW" ? "數量" : "Amount"}</span><input class="input" type="number" min="0.01" max="100000" step="0.01" name="supplementAmount" value="1"></label><label class="field supplement-unit"><span>${this.locale === "zh-TW" ? "單位" : "Unit"}</span><select class="select" name="supplementUnit">${unitOptions}</select></label><button class="btn primary touch supplement-submit" type="submit">${this.locale === "zh-TW" ? "記錄今天" : "Log for today"}</button></form><div class="tiny muted">${this.locale === "zh-TW" ? "這裡只做攝取紀錄，不提供建議劑量。外部連結只是 Google 搜尋，請自行判斷來源。若補登漏記，可在月曆中的既有紀錄按「編輯」修正日期與時間。" : "This is a consumption log, not dose guidance. The external link is only a Google search; evaluate sources yourself. To backfill a missed entry, edit an existing calendar record and correct its date/time."}</div></div></details></section>
      <section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "每週飲水" : "Weekly water"}</h2><span class="section-value">${goalDays}/7 ${this.locale === "zh-TW" ? "天達標" : "days reached"}</span></div><div class="card water-chart-card"><div class="water-chart-goal"><span>${this.locale === "zh-TW" ? "每日目標" : "Daily goal"}</span><strong>${h.targetMl.toLocaleString()} mL</strong></div><div class="water-plot"><div class="goal-line" data-style-top="${goalTop}" aria-hidden="true"></div><div class="water-track-grid">${series.map(point=>`<div class="water-bar-track"><div class="bar-fill ${point.count >= h.targetMl ? "goal-hit" : ""}" data-style-height="${Math.max(point.count ? 4 : 1,Math.round(point.count/chartMax*100))}"></div></div>`).join("")}</div></div><div class="water-meta-grid">${series.map(point=>`<div class="water-meta"><strong>${point.count.toLocaleString()}</strong><span>${escapeHtml(point.label)}</span><small>${escapeHtml(point.sublabel ?? "")}</small></div>`).join("")}</div><div class="week-shift-nav"><button class="icon-btn mini-icon" data-water-week-nav="prev" aria-label="${this.locale === "zh-TW" ? "上一週" : "Previous week"}">‹</button><span>${escapeHtml(weekLabel)}</span><button class="icon-btn mini-icon" data-water-week-nav="next" ${this.waterWeekOffset >= 0 ? "disabled" : ""} aria-label="${this.locale === "zh-TW" ? "下一週" : "Next week"}">›</button></div></div></section>
      ${this.renderSupplementWeekSummary()}
      ${this.renderWaterCalendar()}`;
  }

  private renderWaterCalendar(): string {
    const year=this.waterCalendarMonth.getFullYear(), month=this.waterCalendarMonth.getMonth();
    const first=new Date(year,month,1), days=new Date(year,month+1,0).getDate(), offset=(first.getDay()+6)%7;
    const byDate=hydrationByDate(this.state.hydration,this.state.hydrationHistory ?? []);
    const supplementByDate=new Map((this.state.supplementHistory ?? []).map(day=>[day.date,day.entries]));
    const now=new Date(); const currentMonth=now.getFullYear()===year && now.getMonth()===month; const assessDays=currentMonth ? now.getDate() : days;
    const actualPerfect=assessDays>0 && Array.from({length:assessDays},(_,i)=>{ const key=`${year}-${String(month+1).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`; const d=byDate.get(key); return !!d && d.totalMl>=d.targetMl; }).every(Boolean);
    const perfect=actualPerfect;
    const cells:string[]=[]; for(let i=0;i<offset;i++)cells.push('<div class="calendar-cell blank"></div>');
    for(let day=1;day<=days;day++){ const key=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`; const d=byDate.get(key); const supplements=supplementByDate.get(key) ?? []; const hit=!!d&&d.totalMl>=d.targetMl; const selected=this.selectedWaterDate===key; const today=key===localDateKey(new Date()); cells.push(`<button class="calendar-cell water-day ${hit?"water-hit":""} ${supplements.length?"has-supplement":""} ${today?"today":""} ${selected?"selected":""}" data-water-day="${key}"><span>${day}</span>${d?.entries.length ? `<i class="water-day-dot"></i>`:""}${supplements.length?`<b class="supplement-day-dot" title="${supplements.length} ${this.locale === "zh-TW" ? "筆補充品" : "supplement entries"}">●</b>`:""}</button>`); }
    const selected=byDate.get(this.selectedWaterDate);
    const selectedEntries=(selected?.entries ?? []).slice().sort((a,b)=>b.at.localeCompare(a.at));
    const selectedSupplements=this.supplementEntriesForDate(this.selectedWaterDate).slice().sort((a,b)=>b.at.localeCompare(a.at));
    const maxDateTime=this.toDateTimeLocal(new Date().toISOString());
    const waterRows=selectedEntries.length ? selectedEntries.map(entry=>`<details class="entry-editor water-entry"><summary><div><strong>${entry.ml.toLocaleString()} mL</strong><span>${escapeHtml(this.formatTime(entry.at))} ${entry.editedAt ? `<em>${escapeHtml(this.editedText(entry.editedAt))}</em>` : ""}</span></div><span class="entry-edit-label">${this.locale === "zh-TW" ? "編輯" : "Edit"}</span></summary><div class="entry-edit-grid"><label class="field"><span>${this.locale === "zh-TW" ? "飲水量" : "Amount"}</span><input class="input compact-input" type="number" min="1" max="6000" step="10" value="${entry.ml}" data-water-entry-input="${escapeHtml(entry.id)}"></label><label class="field entry-edit-date"><span>${this.locale === "zh-TW" ? "日期與時間" : "Date & time"}</span><input class="input date-input" type="datetime-local" max="${maxDateTime}" value="${escapeHtml(this.toDateTimeLocal(entry.at))}" data-water-entry-at="${escapeHtml(entry.id)}"></label><div class="entry-edit-actions"><button class="btn small" data-save-water-entry="${escapeHtml(entry.id)}" data-water-entry-date="${escapeHtml(this.selectedWaterDate)}">${this.locale === "zh-TW" ? "儲存" : "Save"}</button><button class="icon-btn subtle-danger mini-icon" data-remove-water="${escapeHtml(entry.id)}" data-water-entry-date="${escapeHtml(this.selectedWaterDate)}" aria-label="${escapeHtml(this.text("removeWater"))}">${icon("trash")}</button></div></div></details>`).join("") : `<div class="small muted">${this.locale === "zh-TW" ? "這天沒有飲水紀錄。" : "No water entries on this day."}</div>`;
    const supplementRows=selectedSupplements.length ? selectedSupplements.map(entry=>{ const dose=entry.amount ? `${entry.amount.toLocaleString()} ${this.supplementUnitLabel(entry.unit,entry.amount)}` : ""; const options=SUPPLEMENTS.map(item=>`<option value="${item.id}" ${item.id===entry.supplementId?"selected":""}>${escapeHtml(this.locale === "zh-TW" ? item.zh : item.en)}</option>`).join(""); const units=SUPPLEMENT_UNITS.map(unit=>`<option value="${unit}" ${unit===entry.unit?"selected":""}>${escapeHtml(this.supplementUnitLabel(unit,entry.amount ?? 1))}</option>`).join(""); return `<details class="entry-editor supplement-entry"><summary><div class="supplement-entry-main"><strong>${escapeHtml(this.supplementLabel(entry.supplementId))}</strong><span>${dose ? `${escapeHtml(dose)} · ` : ""}${escapeHtml(this.formatTime(entry.at))} ${entry.editedAt ? `<em>${escapeHtml(this.editedText(entry.editedAt))}</em>` : ""}</span></div><span class="entry-edit-label">${this.locale === "zh-TW" ? "編輯" : "Edit"}</span></summary><div class="entry-edit-grid supplement-edit-grid"><label class="field entry-edit-wide"><span>${this.locale === "zh-TW" ? "補充品" : "Supplement"}</span><select class="select" data-supplement-entry-name="${escapeHtml(entry.id)}">${options}</select></label><label class="field"><span>${this.locale === "zh-TW" ? "數量" : "Amount"}</span><input class="input" type="number" min="0.01" max="100000" step="0.01" value="${entry.amount ?? 1}" data-supplement-entry-amount="${escapeHtml(entry.id)}"></label><label class="field"><span>${this.locale === "zh-TW" ? "單位" : "Unit"}</span><select class="select" data-supplement-entry-unit="${escapeHtml(entry.id)}">${units}</select></label><label class="field entry-edit-date"><span>${this.locale === "zh-TW" ? "日期與時間" : "Date & time"}</span><input class="input date-input" type="datetime-local" max="${maxDateTime}" value="${escapeHtml(this.toDateTimeLocal(entry.at))}" data-supplement-entry-at="${escapeHtml(entry.id)}"></label><div class="entry-edit-actions"><button class="btn small" data-save-supplement="${escapeHtml(entry.id)}" data-supplement-date="${escapeHtml(this.selectedWaterDate)}">${this.locale === "zh-TW" ? "儲存" : "Save"}</button><button class="icon-btn subtle-danger mini-icon" data-remove-supplement="${escapeHtml(entry.id)}" data-supplement-date="${escapeHtml(this.selectedWaterDate)}" aria-label="${this.locale === "zh-TW" ? "刪除補充品紀錄" : "Delete supplement entry"}">${icon("trash")}</button></div></div></details>`; }).join("") : `<div class="small muted">${this.locale === "zh-TW" ? "這天沒有補充品紀錄。" : "No supplement entries on this day."}</div>`;
    const supplementCount=selectedSupplements.length;
    return `<section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "飲水與補充品月曆" : "Water & supplement calendar"}${perfect?` <span class="blue-badge">◆</span>`:""}</h2><div class="calendar-nav"><button class="icon-btn mini-icon" data-water-calendar-nav="prev">‹</button><strong>${escapeHtml(first.toLocaleDateString(this.locale,{month:"long",year:"numeric"}))}</strong><button class="icon-btn mini-icon" data-water-calendar-nav="next">›</button></div></div><div class="card calendar-card water-calendar ${perfect?"perfect-water-month":""}"><div class="weekday-row">${(this.locale === "zh-TW" ? ["一","二","三","四","五","六","日"] : ["M","T","W","T","F","S","S"]).map(d=>`<span>${d}</span>`).join("")}</div><div class="calendar-grid">${cells.join("")}</div></div><div class="card water-day-detail selected-water-detail"><div class="water-day-detail-head"><div><strong>${escapeHtml(new Date(`${this.selectedWaterDate}T12:00:00`).toLocaleDateString(this.locale,{weekday:"long",month:"short",day:"numeric",year:"numeric"}))}</strong><span>${selected ? `${selected.totalMl.toLocaleString()} / ${selected.targetMl.toLocaleString()} mL${selected.totalMl>=selected.targetMl ? " ✓" : ""}` : `0 mL`}${supplementCount ? ` · ${supplementCount} ${this.locale === "zh-TW" ? "筆補充品" : supplementCount === 1 ? "supplement" : "supplements"}` : ""}</span></div></div><div class="day-log-section"><div class="day-log-heading">${icon("drop")}<strong>${this.locale === "zh-TW" ? "飲水" : "Water"}</strong></div><div class="water-entry-list">${waterRows}</div></div><div class="day-log-section"><div class="day-log-heading">${icon("waterPill")}<strong>${this.locale === "zh-TW" ? "補充品" : "Supplements"}</strong></div><div class="supplement-entry-list">${supplementRows}</div></div></div></section>`;
  }

  private renderFamily(): string {
    const score = weeklyGoalScore(this.state.workouts, this.state.hikes, this.currentWeightKg(), this.state.goals!, this.state.hydration, this.state.hydrationHistory ?? []);
    const membership = this.cloudMembership?.access.status === "active" ? this.cloudMembership : null;
    const cloudActive = Boolean(this.authUser && membership);
    const groupName = membership ? this.groupName(membership.access.groupId) : "";
    const members = cloudActive
      ? membership!.members.filter(member => member.status === "active").map(member => ({
          id: member.uid,
          name: member.uid === this.authUser?.uid ? this.state.user.displayName : (member.displayName || "Cloud member"),
          role: member.role,
          isSelf: member.uid === this.authUser?.uid,
          photoURL: member.photoURL,
          groupId: member.groupId
        }))
      : [{ id: this.state.user.id, name: this.state.user.displayName, role: "member" as const, isSelf: true, photoURL: undefined as string | undefined, groupId: "local" }];
    if (!members.some(member => member.isSelf)) members.unshift({ id: this.state.user.id, name: this.state.user.displayName, role: membership?.access.role ?? "member", isSelf: true, photoURL: this.authUser?.photoURL ?? undefined, groupId: membership?.access.groupId ?? "local" });

    const notice = cloudActive && membership!.access.role !== "owner"
      ? `<section class="section"><div class="card compact family-access-notice"><div><div class="strong">${this.locale === "zh-TW" ? "群組" : "Group"}: ${escapeHtml(groupName)}</div><div class="small muted">${this.locale === "zh-TW" ? "這裡只顯示你目前群組中可見的 Cloud 成員。" : "Only Cloud members visible to your current group appear here."}</div></div><button class="btn small" data-action="open-family-settings">${this.locale === "zh-TW" ? "Cloud 設定" : "Cloud settings"}</button></div></section>`
      : !cloudActive
        ? `<section class="section"><div class="card compact family-access-notice"><div><div class="strong">${this.locale === "zh-TW" ? "Local 個人模式" : "Local personal mode"}</div><div class="small muted">${this.locale === "zh-TW" ? "不需要 Google 帳號；運動、飲水與個人資料只儲存在這台裝置。收到擁有者邀請後，可以把現有 Local 資料合併到 Cloud。" : "No Google account is required. Workouts, water and profile data stay on this device. If an owner later invites you, existing Local data can be merged into Cloud."}</div></div></div></section>`
        : "";

    const groupLabel = (member: typeof members[number]) => {
      if (!cloudActive) return this.locale === "zh-TW" ? "Local 個人資料" : "Local profile";
      if (member.role === "owner") {
        const count = membership!.access.role === "owner" ? membership!.access.shareGroupIds.length : 0;
        return membership!.access.role === "owner"
          ? `${this.locale === "zh-TW" ? "擁有者" : "Owner"} · ${count} ${this.locale === "zh-TW" ? "個分享群組" : "shared groups"}`
          : (this.locale === "zh-TW" ? "擁有者" : "Owner");
      }
      return `${this.locale === "zh-TW" ? "群組" : "Group"}: ${this.groupName(member.groupId)}`;
    };

    const renderMemberCard = (member: typeof members[number]): string => {
      const initials = member.name.split(/\s+/).map(part => part[0] ?? "").join("").slice(0,2).toUpperCase();
      const localPhoto = member.isSelf ? this.state.profile?.photoId : undefined;
      const avatar = localPhoto
        ? this.privateImage(localPhoto,"member-avatar photo",member.name)
        : member.photoURL
          ? `<img class="member-avatar photo" src="${escapeHtml(member.photoURL)}" referrerpolicy="no-referrer" alt="${escapeHtml(member.name)}">`
          : `<div class="member-avatar">${escapeHtml(initials)}</div>`;
      const hint = member.isSelf ? (this.locale === "zh-TW" ? "點一下編輯個人資料" : "Tap to edit your profile") : (this.locale === "zh-TW" ? "查看群組共用進度" : "View group-shared progress");
      if (member.isSelf) return `<button class="card compact family-member-card clickable self-profile-card" data-action="open-profile"><div class="row"><div class="row-start">${avatar}<div><div class="strong">${escapeHtml(member.name)}${this.locale === "zh-TW" ? "（你）" : " (you)"}</div><div class="small muted">${escapeHtml(groupLabel(member))} · ${score.score}/10 ${escapeHtml(this.text("weeklyGoalsDone"))}</div><div class="profile-link-hint">${escapeHtml(hint)}</div></div></div><span class="history-chevron">${icon("chevron")}</span></div></button>`;
      return `<button class="card compact family-member-card clickable" data-family-member-profile="${escapeHtml(member.id)}"><div class="row"><div class="row-start">${avatar}<div><div class="strong">${escapeHtml(member.name)}</div><div class="small muted">${escapeHtml(groupLabel(member))}</div><div class="profile-link-hint">${escapeHtml(hint)}</div></div></div><span class="history-chevron">${icon("chevron")}</span></div></button>`;
    };

    let memberList = members.map(renderMemberCard).join("");
    if (cloudActive && membership!.access.role === "owner") {
      const self = members.find(member => member.isSelf);
      const groupSections = membership!.groups.map(group => {
        const groupMembers = members.filter(member => !member.isSelf && member.role !== "owner" && member.groupId === group.id);
        return `<div class="family-group-block"><div class="family-group-heading"><strong>${escapeHtml(group.name)}</strong><span>${groupMembers.length}</span></div>${groupMembers.length ? `<div class="stack">${groupMembers.map(renderMemberCard).join("")}</div>` : `<div class="small muted family-group-empty">${this.locale === "zh-TW" ? "這個群組目前沒有成員。" : "No members in this group yet."}</div>`}</div>`;
      }).join("");
      memberList = `${self ? `<div class="family-owner-self">${renderMemberCard(self)}</div>` : ""}${groupSections}`;
    }

    return `<h1 class="page-title">${escapeHtml(this.text("family"))}</h1><p class="page-subtitle">${this.locale === "zh-TW" ? "Local 先行；Cloud 由邀請與群組控制可見範圍。" : "Local first; Cloud invitations and groups control who can see whom."}</p>
      ${notice}
      <section class="section"><div class="section-header"><h2 class="section-title">${cloudActive && membership?.family ? escapeHtml(membership.family.name) : (this.locale === "zh-TW" ? "個人資料" : "Profile")}</h2>${cloudActive ? `<button class="btn small" data-action="refresh-family-cloud">${this.locale === "zh-TW" ? "重新整理" : "Refresh"}</button>` : ""}</div><div class="family-member-groups">${memberList}</div></section>
      <section class="section"><div class="card"><div class="strong">${escapeHtml(this.text("privacy"))}</div><p class="medium muted">${this.locale === "zh-TW" ? "Local 資料只留在裝置。Cloud 成員只可讀取自己群組允許的共用資料；身高、體重、逐筆飲水／補充品時間、精確 GPX 與照片仍為私人／本機。" : "Local data stays on-device. Cloud members can read only shared data allowed for their group; height, weight, individual drink/supplement times, precise GPX and photos remain private/local."}</p></div></section>`;
  }

  private familyWeeklySeries(uid: string, metric: "calories" | "water"): Array<{ key: string; label: string; count: number }> {
    const { start } = currentWeekBounds(new Date());
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start); day.setDate(start.getDate() + index);
      const key = localDateKey(day);
      const entry = this.cloudFamilyDaily.find(item => item.ownerId === uid && item.date === key);
      return { key, label: day.toLocaleDateString(this.locale, { weekday: "short" }), count: metric === "water" ? (entry?.waterMl ?? 0) : (entry?.calories ?? 0) };
    });
  }

  private familyWeeklyCategoryCounts(ownerId: string): Partial<Record<ExerciseCategory, number>> {
    const { start, end } = currentWeekBounds(new Date());
    const workouts = this.cloudFamilyWorkouts
      .map(envelope => envelope.workout)
      .filter(workout =>
        workout.ownerId === ownerId &&
        workout.visibility === "family" &&
        Boolean(workout.completedAt) &&
        new Date(workout.completedAt!).getTime() >= start.getTime() &&
        new Date(workout.completedAt!).getTime() < end.getTime()
      );
    return weeklyCategorySets(workouts);
  }

  private categoryDonut(counts: Partial<Record<ExerciseCategory, number>>, label: string): string {
    const palette = ["var(--cat-1)","var(--cat-2)","var(--cat-3)","var(--cat-4)","var(--cat-5)","var(--cat-6)","var(--cat-7)","var(--cat-8)"];
    const total = ALL_CATEGORIES.reduce((sum, category) => sum + (counts[category] ?? 0), 0);
    let cursor = 0;
    const slices: string[] = [];
    ALL_CATEGORIES.forEach((category,index) => {
      const count = counts[category] ?? 0;
      if (!count || !total) return;
      const start = cursor;
      cursor += count / total * 100;
      slices.push(`${palette[index]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`);
    });
    const background = total ? `conic-gradient(${slices.join(",")})` : "";
    const legend = ALL_CATEGORIES.map((category,index) => {
      const count = counts[category] ?? 0;
      return `<span class="${count ? "" : "zero"}"><i data-style-background="${escapeHtml(palette[index] ?? "")}"></i><span>${escapeHtml(this.exerciseCategoryLabel(category))}</span><b>${this.trainingCreditText(count)}</b></span>`;
    }).join("");
    return `<div class="comparison-mix-person"><div class="comparison-mix-title"><strong>${escapeHtml(label)}</strong><span>${this.trainingCreditText(total)} ${this.locale === "zh-TW" ? "訓練點數" : "credits"}</span></div><div class="comparison-donut ${total ? "" : "empty"}" data-style-background="${escapeHtml(background)}"><span>${this.trainingCreditText(total)}</span></div><div class="comparison-mix-legend">${legend}</div></div>`;
  }

  private renderFamilyComparison(memberUid: string, memberName: string): string {
    const selfUid = this.authUser?.uid ?? "";
    const metric = this.familyComparisonMetric;
    const mine = this.familyWeeklySeries(selfUid, metric);
    const theirs = this.familyWeeklySeries(memberUid, metric);
    const myTotal = mine.reduce((sum, point) => sum + point.count, 0);
    const theirTotal = theirs.reduce((sum, point) => sum + point.count, 0);
    const max = Math.max(metric === "water" ? 2000 : 100, ...mine.map(point => point.count), ...theirs.map(point => point.count));
    const width = 520, height = 180, left = 24, right = 12, top = 16, bottom = 30;
    const pointString = (series: Array<{ count: number }>) => series.map((point, index) => {
      const x = left + (index / 6) * (width - left - right);
      const y = top + (1 - point.count / max) * (height - top - bottom);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const firstName = memberName.split(/\s+/)[0] || memberName;
    const unit = metric === "water" ? "mL" : "Cal";
    const metricLabel = metric === "water" ? (this.locale === "zh-TW" ? "飲水" : "Water") : (this.locale === "zh-TW" ? "熱量" : "Calories");
    const focus = this.familyComparisonFocus;
    const focusClass = focus === "self" ? "focus-self" : "focus-member";
    const note = metric === "water"
      ? (this.locale === "zh-TW" ? "家庭只看到每天的飲水總量；喝水時間與每筆紀錄仍只有你自己能讀取。" : "Family sees only each day's water total; drink timestamps and individual entries stay private to you.")
      : (this.locale === "zh-TW" ? "家庭會看到每天的總消耗熱量；v0.7 起新紀錄與重新儲存的運動會直接分享給家庭。舊版已存在的私人運動不會被偷偷公開。" : "Family sees daily calorie totals. From v0.7, new and re-saved workouts are shared with Family automatically; existing legacy private workouts are not silently published.");
    const myMix = this.familyWeeklyCategoryCounts(selfUid);
    const theirMix = this.familyWeeklyCategoryCounts(memberUid);
    const dayValues = mine.map((point,index) => {
      const other = theirs[index]?.count ?? 0;
      const active = focus === "self" ? point.count : other;
      const inactive = focus === "self" ? other : point.count;
      return `<span class="comparison-day-cell"><b>${active.toLocaleString()} <em>${unit}</em></b><small>${inactive.toLocaleString()} <em>${unit}</em></small><span>${escapeHtml(point.label)}</span></span>`;
    }).join("");
    const svgSeries = (series: Array<{ count: number; label: string }>, who: "self" | "member") =>
      `<polyline class="comparison-line ${who}" points="${pointString(series)}"/>${series.map((point,index)=>{ const x=left+(index/6)*(width-left-right); const y=top+(1-point.count/max)*(height-top-bottom); return `<circle class="comparison-dot ${who}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5"><title>${escapeHtml(point.label)}: ${point.count} ${unit}</title></circle>`; }).join("")}`;
    // Draw the inactive series first so the selected line stays visible where values overlap.
    const comparisonSeries = focus === "self"
      ? `${svgSeries(theirs,"member")}${svgSeries(mine,"self")}`
      : `${svgSeries(mine,"self")}${svgSeries(theirs,"member")}`;
    return `<div class="comparison-tabs segmented"><button data-family-comparison-metric="calories" class="${metric === "calories" ? "active" : ""}">${this.locale === "zh-TW" ? "熱量" : "Calories"}</button><button data-family-comparison-metric="water" class="${metric === "water" ? "active" : ""}">${this.locale === "zh-TW" ? "飲水" : "Water"}</button></div>
      <div class="family-comparison-summary ${metric === "water" ? "water-mode" : "calorie-mode"} ${focusClass}"><button class="comparison-summary-self" data-family-comparison-focus="self" aria-pressed="${focus === "self"}"><span>${this.locale === "zh-TW" ? "你" : "You"}</span><strong>${myTotal.toLocaleString()} ${unit}</strong></button><button class="comparison-summary-member" data-family-comparison-focus="member" aria-pressed="${focus === "member"}"><span>${escapeHtml(firstName)}</span><strong>${theirTotal.toLocaleString()} ${unit}</strong></button></div>
      <div class="family-comparison-chart ${metric === "water" ? "water-mode" : "calorie-mode"} ${focusClass}"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(metricLabel)}">${comparisonSeries}</svg><div class="comparison-day-labels">${dayValues}</div></div>
      <div class="tiny muted">${escapeHtml(note)}</div>
      <div class="comparison-mix-head"><strong>${this.locale === "zh-TW" ? "本週運動類型" : "This week's exercise mix"}</strong><span>${this.locale === "zh-TW" ? "v0.7 新運動會自動分享給家庭" : "New v0.7 workouts share with Family automatically"}</span></div>
      <div class="comparison-mix-grid">${this.categoryDonut(myMix,this.locale === "zh-TW" ? "你" : "You")}${this.categoryDonut(theirMix,firstName)}</div>`;
  }

  private biologicalSexLabel(value?: ProfileData["biologicalSex"]): string {
    if (!value) return this.locale === "zh-TW" ? "未設定" : "Not set";
    const labels: Record<NonNullable<ProfileData["biologicalSex"]>, [string,string]> = {
      female: ["女性", "Female"],
      male: ["男性", "Male"],
      other: ["其他／雙性", "Other / intersex"],
      prefer_not: ["不提供", "Prefer not to say"]
    };
    return labels[value]?.[this.locale === "zh-TW" ? 0 : 1] ?? value;
  }

  private renderFamilyMemberProfile(): string {
    const membership = this.cloudMembership;
    const member = membership?.members.find(item => item.uid === this.selectedFamilyMemberUid && item.status === "active");
    if (!cloudModeEnabled() || !this.authUser || membership?.access.status !== "active" || !member) {
      return `<div class="workout-header"><button class="btn ghost touch" data-action="back-family">${icon("back")} ${escapeHtml(this.text("family"))}</button></div><h1 class="page-title">${this.locale === "zh-TW" ? "家庭資料" : "Family profile"}</h1><div class="card"><div class="strong">${this.locale === "zh-TW" ? "找不到這位家庭成員" : "Family member unavailable"}</div><p class="small muted">${this.locale === "zh-TW" ? "成員可能已被移除，或家庭資料尚未重新整理。" : "They may have been removed, or your family data may need to be refreshed."}</p></div>`;
    }
    if (member.uid === this.authUser.uid) { queueMicrotask(() => this.navigate("profile")); return ""; }
    const name = member.displayName || (this.locale === "zh-TW" ? "家庭成員" : "Family member");
    const initials = name.split(/\s+/).map(part => part[0] ?? "").join("").slice(0,2).toUpperCase();
    const avatar = member.photoURL ? `<img class="family-public-avatar" src="${escapeHtml(member.photoURL)}" referrerpolicy="no-referrer" alt="${escapeHtml(name)}">` : `<div class="family-public-avatar placeholder">${escapeHtml(initials)}</div>`;
    const role = member.role === "owner" ? (this.locale === "zh-TW" ? "擁有者" : "Owner") : (this.locale === "zh-TW" ? "成員" : "Member");
    const sex = this.biologicalSexLabel(member.biologicalSex);
    const memberBadges = this.cloudFamilyBadges.filter(badge=>badge.ownerId===member.uid).slice();
    const monthlyBadges = memberBadges.filter(badge => badge.badgeType === "monthly").sort((a,b)=>b.earnedAt.localeCompare(a.earnedAt));
    const hikeBadges = memberBadges.filter(badge => badge.badgeType === "hike").sort((a,b)=>(a.sortOrder ?? 9999)-(b.sortOrder ?? 9999) || a.earnedAt.localeCompare(b.earnedAt));
    const comparison = !this.cloudCompanionReady ? `<div class="small muted">${this.locale === "zh-TW" ? "正在同步家庭進度…" : "Syncing family progress…"}</div>` : this.cloudCompanionError ? `<div class="small danger-text">${escapeHtml(this.cloudCompanionError)}</div>` : this.renderFamilyComparison(member.uid,name);
    const monthlyBadgeGrid = monthlyBadges.length ? `<div class="badge-gallery">${monthlyBadges.map(badge=>`<div class="earned-badge"><span>★</span><strong>${escapeHtml(badge.title)}</strong><small>${escapeHtml(badge.subtitle)}</small></div>`).join("")}</div>` : `<div class="empty-mini">${this.locale === "zh-TW" ? "目前沒有月度徽章。" : "No monthly badges yet."}</div>`;
    const hikeBadgeGrid = hikeBadges.length ? `<div class="badge-gallery hiking-gallery">${hikeBadges.map(badge=>`<div class="earned-badge hike-badge"><span>▲</span><strong>${escapeHtml(badge.title)}</strong><small>${escapeHtml(badge.subtitle)}</small></div>`).join("")}</div>` : `<div class="empty-mini">${this.locale === "zh-TW" ? "目前沒有健行徽章。" : "No hiking badges yet."}</div>`;

    const weekly = this.cloudFamilyWeekly.find(item => item.ownerId === member.uid && item.weekStart === weekKey(new Date()));
    const weeklyCard = weekly ? `<div class="family-weekly-grid">
      <div><span>${this.locale === "zh-TW" ? "本週任務" : "Weekly missions"}</span><strong class="mission-score">${weekly.missionScore}/${weekly.missionMax}</strong></div>
      <div><span>${this.locale === "zh-TW" ? "運動熱量" : "Exercise calories"}</span><strong>${weekly.weeklyCalories.toLocaleString()} Cal</strong></div>
      <div><span>${this.locale === "zh-TW" ? "運動次數" : "Workouts"}</span><strong>${weekly.workoutCount}</strong></div>
      <div><span>${this.locale === "zh-TW" ? "健行" : "Hikes"}</span><strong>${weekly.hikeCount} · ${weekly.hikeKm.toFixed(1)} km</strong></div>
      <div><span>${this.locale === "zh-TW" ? "熱量達標日" : "Calorie-goal days"}</span><strong>${weekly.calorieDays} ${this.locale === "zh-TW" ? "天" : "days"}</strong></div>
      <div><span>${this.locale === "zh-TW" ? "飲水達標日" : "Water-goal days"}</span><strong>${weekly.waterDays}/7</strong></div>
      <div><span>${this.locale === "zh-TW" ? "運動類型達標" : "Categories reached"}</span><strong>${weekly.categoriesHit}/8</strong></div>
    </div>` : `<div class="empty-mini">${this.locale === "zh-TW" ? "這週還沒有已同步的成就資料。" : "No synced weekly achievement data yet."}</div>`;

    const supplementRows = weekly?.supplements.length ? weekly.supplements.map(item => {
      const quantity = item.mixedUnits || !item.unit
        ? `${item.entries} ${this.locale === "zh-TW" ? "筆" : item.entries === 1 ? "entry" : "entries"}`
        : `${item.amount.toLocaleString()} ${this.supplementUnitLabel(item.unit,item.amount)}`;
      return `<div class="family-supplement-row"><div><strong>${escapeHtml(this.supplementLabel(item.supplementId))}</strong><span>${item.days} ${this.locale === "zh-TW" ? "天" : item.days === 1 ? "day" : "days"} · ${item.entries} ${this.locale === "zh-TW" ? "次" : item.entries === 1 ? "entry" : "entries"}</span></div><b>${escapeHtml(quantity)}</b></div>`;
    }).join("") : `<div class="empty-mini">${this.locale === "zh-TW" ? "這週沒有已同步的補充品紀錄。" : "No synced supplements this week."}</div>`;

    const memberWorkouts = this.cloudFamilyWorkouts.filter(item => item.workout.ownerId === member.uid && item.workout.visibility === "family").slice().sort((a,b)=>(b.workout.completedAt ?? b.workout.startedAt).localeCompare(a.workout.completedAt ?? a.workout.startedAt)).slice(0,6);
    const workoutRows = memberWorkouts.length ? memberWorkouts.map(item => {
      const workout = item.workout;
      const exerciseSummary = workout.exercises.slice(0,4).map(exercise => {
        const definition = exerciseById(exercise.exerciseId);
        const label = definition?.names[this.locale] ?? exercise.exerciseId;
        const sets = exercise.sets.filter(set => set.completed).length || exercise.sets.length;
        return `${label} × ${sets}`;
      }).join(" · ");
      return `<div class="family-workout-row"><span class="history-icon">${icon("dumbbell")}</span><div><strong>${escapeHtml(workout.routineName)}</strong><span>${escapeHtml(this.formatDate(workout.completedAt ?? workout.startedAt))} · ~${item.estimatedCalories.toLocaleString()} Cal · ${completedSetCount(workout)} ${this.locale === "zh-TW" ? "組" : "sets"}${workout.editedAt ? ` · ${escapeHtml(this.editedText(workout.editedAt))}` : ""}</span>${exerciseSummary ? `<small>${escapeHtml(exerciseSummary)}${workout.exercises.length > 4 ? " …" : ""}</small>` : ""}</div></div>`;
    }).join("") : `<div class="empty-mini">${this.locale === "zh-TW" ? "目前沒有已分享的運動。" : "No shared workouts yet."}</div>`;

    const memberHikes = this.cloudFamilyHikes.filter(item => item.hike.ownerId === member.uid).slice().sort((a,b)=>b.hike.date.localeCompare(a.hike.date)).slice(0,6);
    const hikeRows = memberHikes.length ? memberHikes.map(item => {
      const hike=item.hike;
      return `<div class="family-hike-row"><span class="history-icon hike">${icon("mountain")}</span><div><strong>${escapeHtml(hike.name)}</strong><span>${escapeHtml(new Date(`${hike.date}T12:00:00`).toLocaleDateString(this.locale,{month:"short",day:"numeric",year:"numeric"}))} · ${hike.startedAt ? `${escapeHtml(this.formatTime(hike.startedAt))} · ` : ""}${hike.distanceKm.toFixed(1)} km · ${formatDuration(hike.movingMinutes)} · +${hike.elevationGainM} m · ${this.locale === "zh-TW" ? "難度" : "difficulty"} ${hike.difficulty}/5${hike.editedAt ? ` · ${escapeHtml(this.editedText(hike.editedAt))}` : ""}</span>${hike.notes ? `<small>${escapeHtml(hike.notes)}</small>` : ""}</div></div>`;
    }).join("") : `<div class="empty-mini">${this.locale === "zh-TW" ? "目前沒有已同步的健行。" : "No synced hikes yet."}</div>`;

    return `<div class="workout-header"><button class="btn ghost touch" data-action="back-family">${icon("back")} ${escapeHtml(this.text("family"))}</button></div>
      <section class="card family-public-hero">${avatar}<div><div class="tiny muted">${escapeHtml(membership.family?.name ?? this.text("family"))}</div><h1>${escapeHtml(name)}</h1><div class="small muted">${escapeHtml(role)} · ${this.locale === "zh-TW" ? "生理性別" : "Biological sex"}: ${escapeHtml(sex)}</div></div></section>
      <section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "本週比較" : "This week"}</h2><span class="section-value">${this.locale === "zh-TW" ? "家庭總量" : "Family totals"}</span></div><div class="card family-comparison-card">${comparison}</div></section>
      <section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "本週成就" : "Weekly achievements"}</h2><span class="section-value mission-score">${weekly ? `${weekly.missionScore}/${weekly.missionMax}` : "—"}</span></div><div class="card">${weeklyCard}</div></section>
      <section class="section family-profile-collapsible"><details class="card family-profile-details"><summary><span>${this.locale === "zh-TW" ? "本週補充品" : "This week's supplements"}</span><span class="section-value">${weekly?.supplements.length ?? 0}</span></summary><div class="family-details-body family-supplement-list">${supplementRows}</div></details></section>
      <section class="section family-profile-collapsible"><details class="card family-profile-details"><summary><span>${this.locale === "zh-TW" ? "最近運動" : "Recent workouts"}</span><span class="section-value">${memberWorkouts.length}</span></summary><div class="family-details-body family-workout-list">${workoutRows}</div></details></section>
      <section class="section family-profile-collapsible"><details class="card family-profile-details"><summary><span>${this.locale === "zh-TW" ? "最近健行" : "Recent hikes"}</span><span class="section-value">${memberHikes.length}</span></summary><div class="family-details-body family-hike-list">${hikeRows}</div><div class="tiny muted family-hike-privacy family-details-note">${this.locale === "zh-TW" ? "健行名稱、日期、距離、時間、海拔、難度與備註會同步給家庭；精確 GPX 路線與照片目前仍只留在自己的裝置。" : "Hike name, date, distance, time, elevation, difficulty and notes are shared with Family; exact GPX traces and photos remain on your own device for now."}</div></details></section>
      <section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "月度徽章" : "Monthly badges"}</h2><span class="section-value">${monthlyBadges.length}</span></div><div class="card">${monthlyBadgeGrid}</div></section>
      <section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "健行徽章" : "Hiking badges"}</h2><span class="section-value">${hikeBadges.length}</span></div><div class="card">${hikeBadgeGrid}</div></section>`;
  }

  private weightLineChart(): string {
    const entries=(this.state.profile?.weightEntries ?? []).slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(-12);
    if (entries.length < 2) return `<div class="empty-mini">${escapeHtml(this.text("needMoreWeight"))}</div>`;
    const values=entries.map(e=>e.kg); const min=Math.min(...values)-1; const max=Math.max(...values)+1; const range=Math.max(1,max-min);
    const width=520, height=150, pad=18;
    const points=entries.map((e,i)=>{ const x=pad+(i/(entries.length-1))*(width-pad*2); const y=height-pad-((e.kg-min)/range)*(height-pad*2); return {x,y,e}; });
    return `<div class="weight-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(this.text("weightTrend"))}"><polyline points="${points.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${points.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="4" fill="currentColor"><title>${escapeHtml(p.e.date)}: ${p.e.kg} kg</title></circle>`).join("")}</svg><div class="weight-labels">${entries.map(e=>`<span>${escapeHtml(new Date(`${e.date}T12:00:00`).toLocaleDateString(this.locale,{month:"short"}))}</span>`).join("")}</div></div>`;
  }

  private renderProfile(): string {
    const profile=this.state.profile!;
    const latest=profile.weightEntries.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];
    const bmi = profile.heightCm && latest?.kg ? latest.kg / ((profile.heightCm / 100) ** 2) : null;
    const bmiLabel = bmi === null ? "" : bmi < 18.5
      ? (this.locale === "zh-TW" ? "過輕" : "Underweight")
      : bmi < 24
        ? (this.locale === "zh-TW" ? "正常" : "Normal")
        : bmi < 27
          ? (this.locale === "zh-TW" ? "過重" : "Overweight")
          : (this.locale === "zh-TW" ? "肥胖" : "Obesity");
    const monthKey=new Date().toISOString().slice(0,7);
    const recordedThisMonth=profile.weightEntries.some(e=>e.date.startsWith(monthKey));
    const currentScore=monthlyGoalScore(this.state.workouts,this.state.hikes,this.currentWeightKg(),this.state.goals!,this.state.hydration,this.state.hydrationHistory ?? []);
    const localMonthlyBadges = Array.from({length:12},(_,offset)=>{ const d=new Date(); d.setMonth(d.getMonth()-offset,1); const end=new Date(d.getFullYear(),d.getMonth()+1,0,23,59,59); const score=monthlyGoalScore(this.state.workouts,this.state.hikes,this.currentWeightKg(),this.state.goals!,this.state.hydration,this.state.hydrationHistory ?? [],end); return { date:d, score, earned:score>=35 }; }).filter(item=>item.earned);
    const cloudMonthlyBadges = this.cloudOwnBadges.filter(badge=>badge.badgeType==="monthly").slice().sort((a,b)=>b.earnedAt.localeCompare(a.earnedAt));
    const localHikeBadges = this.hikingBadges();
    const initials=this.state.user.displayName.split(/\s+/).map(part=>part[0]??"").join("").slice(0,2).toUpperCase();
    return `<div class="workout-header"><button class="btn ghost touch" data-action="back-family">${icon("back")} ${escapeHtml(this.text("family"))}</button></div><h1 class="page-title">${escapeHtml(this.text("personal"))}</h1><p class="page-subtitle">${this.locale === "zh-TW" ? "你的個人資料、體重趨勢與徽章。身高、體重與照片保持私人；生理性別、家庭成就與徽章會同步給目前的家庭成員。" : "Your personal details, weight trend and badges. Height, weight and photos stay private; biological sex, family achievements and badges sync to active family members."}</p>
      ${!recordedThisMonth ? `<div class="banner attention">${escapeHtml(this.text("monthlyWeightPrompt"))}</div>` : ""}
      <section class="profile-hero card"><div class="profile-photo-wrap">${profile.photoId ? this.privateImage(profile.photoId,"profile-photo",this.state.user.displayName) : this.authUser?.photoURL ? `<img class="profile-photo" src="${escapeHtml(this.authUser.photoURL)}" referrerpolicy="no-referrer" alt="${escapeHtml(this.state.user.displayName)}">` : `<div class="profile-photo placeholder">${escapeHtml(initials)}</div>`}<label class="profile-photo-edit">${this.locale === "zh-TW" ? "更換照片" : "Change photo"}<input id="profile-photo-input" type="file" accept="image/*" hidden></label></div><form id="profile-form" class="form-grid profile-fields"><div class="field"><label>${escapeHtml(this.text("name"))}</label><input class="input" name="name" maxlength="60" value="${escapeHtml(this.state.user.displayName)}"></div><div class="field"><label>${this.locale === "zh-TW" ? "生理性別" : "Biological sex"}</label><select class="select" name="biologicalSex"><option value="" ${!profile.biologicalSex ? "selected" : ""}>${this.locale === "zh-TW" ? "未設定" : "Not set"}</option><option value="female" ${profile.biologicalSex === "female" ? "selected" : ""}>${this.locale === "zh-TW" ? "女性" : "Female"}</option><option value="male" ${profile.biologicalSex === "male" ? "selected" : ""}>${this.locale === "zh-TW" ? "男性" : "Male"}</option><option value="other" ${profile.biologicalSex === "other" ? "selected" : ""}>${this.locale === "zh-TW" ? "其他／雙性" : "Other / intersex"}</option><option value="prefer_not" ${profile.biologicalSex === "prefer_not" ? "selected" : ""}>${this.locale === "zh-TW" ? "不提供" : "Prefer not to say"}</option></select></div><div class="form-two"><div class="field"><label>${escapeHtml(this.text("heightCm"))}</label><input class="input" name="height" type="number" min="80" max="250" step="0.1" value="${profile.heightCm ?? ""}"></div><div class="field"><label>${escapeHtml(this.text("currentWeight"))}</label><input class="input" name="weight" type="number" min="20" max="350" step="0.1" value="${latest?.kg ?? ""}"></div></div>${bmi !== null ? `<div class="bmi-readout"><div><span>BMI</span><strong>${bmi.toFixed(1)}</strong><em>${escapeHtml(bmiLabel)}</em></div><p>${this.locale === "zh-TW" ? "成人參考：過輕 <18.5、正常 18.5–<24、過重 24–<27、肥胖 ≥27。成人 BMI 分類不因生理性別改變。" : "Adult reference: underweight <18.5, normal 18.5–<24, overweight 24–<27, obesity ≥27. Adult BMI categories use the same cutoffs regardless of biological sex."}</p></div>` : `<div class="small muted">${this.locale === "zh-TW" ? "填入身高與體重後會自動計算 BMI。" : "Add height and weight to calculate BMI automatically."}</div>`}<button class="btn primary" type="submit">${escapeHtml(this.text("saveProfile"))}</button></form></section>
      <section class="section"><div class="section-header"><h2 class="section-title">${escapeHtml(this.text("weightTrend"))}</h2><span class="section-value">${latest ? `${latest.kg} kg` : "—"}</span></div><div class="card">${this.weightLineChart()}</div></section>
      <section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "月度徽章" : "Monthly badges"}</h2><span class="section-value">${cloudMonthlyBadges.length || localMonthlyBadges.length} ${this.locale === "zh-TW" ? "枚" : "earned"}</span></div><div class="card"><div class="badge-gallery">${cloudMonthlyBadges.length ? cloudMonthlyBadges.map(badge=>`<div class="earned-badge"><span>★</span><strong>${escapeHtml(badge.title)}</strong><small>${escapeHtml(badge.subtitle)}</small></div>`).join("") : localMonthlyBadges.map(item=>`<div class="earned-badge"><span>★</span><strong>${escapeHtml(item.date.toLocaleDateString(this.locale,{month:"short",year:"numeric"}))}</strong><small>${this.locale === "zh-TW" ? "月度" : "Monthly"}</small></div>`).join("")}${!cloudMonthlyBadges.length && !localMonthlyBadges.length ? `<div class="empty-mini">${this.locale === "zh-TW" ? "每月累積 35 個完成任務即可取得月度徽章。" : "Complete 35 weekly missions within the month to earn a monthly badge."}</div>` : ""}</div></div></section>
      <section class="section"><div class="section-header badge-section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "健行徽章" : "Hiking badges"}</h2><div class="badge-section-actions"><span class="section-value">${localHikeBadges.length} ${this.locale === "zh-TW" ? "枚" : "earned"}</span>${localHikeBadges.length ? `<button class="btn small ghost badge-manage-toggle" data-action="toggle-hike-badge-edit" type="button">${this.hikeBadgeEditMode ? (this.locale === "zh-TW" ? "完成" : "Done") : (this.locale === "zh-TW" ? "編輯" : "Edit")}</button>` : ""}</div></div><div class="card">${this.hikeBadgeEditMode ? `<p class="tiny muted badge-warning">${this.locale === "zh-TW" ? "拖曳 ⋮⋮ 重新排序。可重新命名或移除誤產生的徽章；健行紀錄本身不會被刪除。" : "Drag ⋮⋮ to reorder. You can also rename or remove accidental badges; the hike record itself is not deleted."}</p>` : ""}<div class="badge-gallery hiking-gallery editable-badge-gallery ${this.hikeBadgeEditMode ? "badge-edit-mode" : ""}" data-hike-badge-list>${localHikeBadges.map(hike=>`<div class="earned-badge hike-badge editable-hike-badge" data-hike-badge-id="${escapeHtml(hike.id)}">${this.hikeBadgeEditMode ? `<button class="badge-drag-handle" data-hike-badge-drag-handle="${escapeHtml(hike.id)}" type="button" aria-label="${this.locale === "zh-TW" ? "拖曳排序" : "Drag to reorder"}" title="${this.locale === "zh-TW" ? "拖曳排序" : "Drag to reorder"}">⋮⋮</button><button class="badge-remove-corner" data-remove-hike-badge="${escapeHtml(hike.id)}" type="button" aria-label="${this.locale === "zh-TW" ? "移除徽章" : "Remove badge"}">×</button>` : ""}${hike.photoId ? this.privateImage(hike.photoId,"badge-photo",this.hikeBadgeTitle(hike)) : `<span>▲</span>`}<strong>${escapeHtml(this.hikeBadgeTitle(hike))}</strong><small>${escapeHtml(new Date(`${hike.date}T12:00:00`).toLocaleDateString(this.locale,{month:"short",day:"numeric",year:"numeric"}))}</small>${this.hikeBadgeEditMode ? `<button class="badge-rename-link" data-edit-hike-badge="${escapeHtml(hike.id)}" type="button">${this.locale === "zh-TW" ? "重新命名" : "Rename"}</button>` : ""}</div>`).join("")}${!localHikeBadges.length ? `<div class="empty-mini">${this.locale === "zh-TW" ? "第一次紀錄新的健行名稱後會顯示在這裡。" : "Your first record of a new hike name will appear here."}</div>` : ""}</div></div></section>`;
  }

  private hikingBadges(): HikeRecord[] {
    const seen=new Set<string>(); const badges:HikeRecord[]=[];
    for(const hike of this.state.hikes.slice().sort((a,b)=>a.date.localeCompare(b.date))){
      const key=hike.name.trim().toLocaleLowerCase();
      if(!key||seen.has(key)) continue;
      seen.add(key);
      if(this.hikeBadgePreference(hike.id)?.hidden) continue;
      badges.push(hike);
    }
    const fallbackOrder=new Map(badges.map((hike,index)=>[hike.id,index]));
    return badges.sort((a,b)=>{
      const aOrder=this.hikeBadgePreference(a.id)?.order;
      const bOrder=this.hikeBadgePreference(b.id)?.order;
      return (aOrder ?? fallbackOrder.get(a.id) ?? 0) - (bOrder ?? fallbackOrder.get(b.id) ?? 0);
    });
  }

  private renderFamilyAccessSettings(): string {
    if (!cloudModeEnabled()) return "";
    const localIntro = `<div class="card cloud-family-card"><div><div class="strong">${this.locale === "zh-TW" ? "Local / Cloud" : "Local / Cloud"}</div><p class="small muted">${this.locale === "zh-TW" ? "公開網址預設為 Local。第一次取得 Cloud 權限仍需擁有者邀請；已經加入過的 Cloud 成員可直接在新裝置或無痕視窗重新登入。" : "The public URL defaults to Local. First-time Cloud access still requires an owner invitation; existing Cloud members can reconnect directly on a new device or incognito session."}</p></div></div>`;

    if (!this.authUser || !this.cloudMembership || this.cloudMembership.access.status !== "active") {
      const invite = this.pendingInviteCode
        ? `<div class="card cloud-family-card"><div><div class="strong">${this.locale === "zh-TW" ? "Cloud 邀請" : "Cloud invitation"}</div><p class="small muted">${this.locale === "zh-TW" ? "此連結已開啟 Cloud 授權流程。登入必須使用邀請指定的 Google 電子郵件。" : "This link has opened the Cloud authorization flow. Sign in with the Google email named by the invitation."}</p></div>${!this.authUser ? `<button class="btn primary" data-action="google-sign-in">${this.locale === "zh-TW" ? "使用 Google 接受邀請" : "Continue with Google"}</button>` : ""}${this.cloudMembershipError ? `<div class="small danger-text">${escapeHtml(this.cloudMembershipError)}</div>` : ""}</div>`
        : `<div class="card compact reconnect-cloud-card"><div><div class="strong">${this.locale === "zh-TW" ? "目前：Local" : "Current mode: Local"}</div><div class="small muted">${this.locale === "zh-TW" ? "新成員請使用邀請連結；如果這個 Google 帳號已經有 LogTogether Cloud 權限，可以直接重新連線。" : "New members should use an invitation link. If this Google account already has LogTogether Cloud access, reconnect it directly."}</div></div><button class="btn small" data-action="google-sign-in">${this.locale === "zh-TW" ? "連線既有 Cloud 帳號" : "Connect existing Cloud account"}</button></div>`;
      return `<section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "Cloud 與群組" : "Cloud & groups"}</h2></div><div class="family-access-stack">${localIntro}${invite}</div></section>`;
    }

    const membership = this.cloudMembership;
    const familyName = membership.family?.name || membership.access.familyId;
    const ownGroup = this.groupName(membership.access.groupId);
    const summary = `<div class="card family-access-summary"><div><div class="strong">${escapeHtml(familyName)}</div><div class="small muted">Cloud · ${membership.access.role === "owner" ? (this.locale === "zh-TW" ? "擁有者" : "Owner") : `${this.locale === "zh-TW" ? "群組" : "Group"}: ${escapeHtml(ownGroup)}`}</div></div><button class="btn small" data-action="refresh-family-cloud">${this.locale === "zh-TW" ? "重新整理" : "Refresh"}</button></div>`;

    if (membership.access.role !== "owner") {
      const groupMemberRows = membership.members.filter(member => member.status === "active").map(member => {
        const isSelf = member.uid === this.authUser?.uid;
        const name = member.displayName || (isSelf ? (this.state.user.displayName || this.authUser?.displayName || "You") : (this.locale === "zh-TW" ? "群組成員" : "Group member"));
        const initials = name.split(/\s+/).map(part => part[0] ?? "").join("").slice(0,2).toUpperCase();
        const avatar = isSelf && this.state.profile?.photoId
          ? this.privateImage(this.state.profile.photoId,"member-access-avatar photo",name)
          : member.photoURL
            ? `<img class="member-access-avatar photo" src="${escapeHtml(member.photoURL)}" referrerpolicy="no-referrer" alt="${escapeHtml(name)}">`
            : `<div class="member-access-avatar">${escapeHtml(initials)}</div>`;
        const role = member.role === "owner" ? (this.locale === "zh-TW" ? "擁有者" : "Owner") : (this.locale === "zh-TW" ? "群組成員" : "Group member");
        return `<div class="family-access-member read-only-member"><div class="member-access-identity">${avatar}<div><div class="strong">${escapeHtml(name)}${isSelf ? ` ${this.locale === "zh-TW" ? "（你）" : "(you)"}` : ""}</div><div class="small muted">${escapeHtml(role)}</div></div></div></div>`;
      }).join("");
      return `<section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "Cloud 與群組" : "Cloud & groups"}</h2></div><div class="family-access-stack">${summary}<div class="card compact"><div class="strong">${this.locale === "zh-TW" ? "你的群組" : "Your group"}: ${escapeHtml(ownGroup)}</div><div class="small muted">${this.locale === "zh-TW" ? "你只會看到這個群組的成員，以及擁有者選擇分享給此群組的資料。群組指派與 Cloud 權限由擁有者管理。" : "You can see only members of this group plus owner data shared with it. Group assignment and Cloud access are controlled by the owner."}</div></div><div class="card member-access-card read-only-group-members"><div class="strong">${this.locale === "zh-TW" ? "群組成員" : "Group members"}</div><div class="member-access-list">${groupMemberRows}</div></div></div></section>`;
    }

    const groupOptions = (selected: string) => membership.groups.map(group => `<option value="${escapeHtml(group.id)}" ${group.id === selected ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("");
    const groupRows = membership.groups.map(group => {
      const assigned = membership.members.filter(member => member.role === "member" && member.groupId === group.id && member.status === "active").length;
      return `<form class="family-group-row" data-group-rename-form="${escapeHtml(group.id)}"><div class="group-name-editor"><input class="input compact-input" data-group-name-input name="groupName" value="${escapeHtml(group.name)}" maxlength="80" required aria-label="${this.locale === "zh-TW" ? "群組名稱" : "Group name"}"><span class="tiny muted">${assigned} ${this.locale === "zh-TW" ? "位啟用成員" : assigned === 1 ? "active member" : "active members"}</span></div>${group.id !== DEFAULT_GROUP_ID ? `<div class="group-row-actions"><button class="btn small ghost danger" type="button" data-delete-group="${escapeHtml(group.id)}">${this.locale === "zh-TW" ? "刪除" : "Delete"}</button></div>` : ""}</form>`;
    }).join("");
    const ownerSharing = `<form id="owner-sharing-form" class="owner-sharing-inline"><div class="strong">${this.locale === "zh-TW" ? "我的資料分享給哪些群組" : "Groups that can see my owner profile"}</div><div class="small muted member-access-note">${this.locale === "zh-TW" ? "只有勾選的群組能看到你的家庭個人資料與共用進度；身高與體重仍是私人資料。" : "Only selected groups can see your family profile and shared progress; height and weight remain private."}</div><div class="owner-share-groups">${membership.groups.map(group => `<label class="check-row"><input type="checkbox" name="shareGroup" value="${escapeHtml(group.id)}" ${membership.access.shareGroupIds.includes(group.id) ? "checked" : ""}><span>${escapeHtml(group.name)}</span></label>`).join("")}</div><button class="btn small" type="submit">${this.locale === "zh-TW" ? "儲存分享範圍" : "Save visibility"}</button></form>`;
    const groups = `<details class="card settings-fold cloud-groups-fold"><summary><div><strong>${this.locale === "zh-TW" ? "群組" : "Groups"}</strong><span>${membership.groups.length} ${this.locale === "zh-TW" ? "個群組 · 點一下管理" : membership.groups.length === 1 ? "group · tap to manage" : "groups · tap to manage"}</span></div><span class="history-chevron">${icon("chevron")}</span></summary><div class="settings-fold-body"><div class="small muted member-access-note">${this.locale === "zh-TW" ? "一般成員只能看到同群組 Cloud 成員。直接編輯名稱後離開欄位即可儲存。" : "Regular members can discover only Cloud members in their own group. Edit a name directly and leave the field to save it."}</div><div class="member-access-list group-access-list">${groupRows}</div><form id="create-group-form" class="cloud-family-form"><label>${this.locale === "zh-TW" ? "新增群組" : "New group"}<input class="input" name="groupName" maxlength="80" required placeholder="${this.locale === "zh-TW" ? "例如：朋友" : "e.g. Friends"}"></label><button class="btn" type="submit">${this.locale === "zh-TW" ? "建立群組" : "Create group"}</button></form><div class="settings-inline-divider"></div>${ownerSharing}</div></details>`;

    const memberRows = membership.members.map(member => {
      const name = member.displayName || (member.uid === this.authUser?.uid ? (this.state.user.displayName || this.authUser.displayName || "You") : "Cloud member");
      const isSelf = member.uid === this.authUser?.uid;
      const status = member.status === "active" ? (this.locale === "zh-TW" ? "啟用" : "Active") : (this.locale === "zh-TW" ? "已撤銷" : "Revoked");
      const groupLabel = isSelf ? (this.locale === "zh-TW" ? "擁有者" : "Owner") : this.groupName(member.groupId);
      const initials = name.split(/\s+/).map(part => part[0] ?? "").join("").slice(0,2).toUpperCase();
      const localPhoto = isSelf ? this.state.profile?.photoId : undefined;
      const avatar = localPhoto
        ? this.privateImage(localPhoto,"member-access-avatar photo",name)
        : member.photoURL
          ? `<img class="member-access-avatar photo" src="${escapeHtml(member.photoURL)}" referrerpolicy="no-referrer" alt="${escapeHtml(name)}">`
          : `<div class="member-access-avatar">${escapeHtml(initials)}</div>`;
      const identity = `<div class="member-access-identity">${avatar}<div><div class="strong">${escapeHtml(name)}${isSelf ? ` ${this.locale === "zh-TW" ? "（你）" : "(you)"}` : ""}</div><div class="small muted">${escapeHtml(groupLabel)}${isSelf ? "" : ` · ${escapeHtml(status)}`}</div></div></div>`;
      if (isSelf || !this.familyAccessEditing) return `<div class="family-access-member ${member.status === "revoked" ? "revoked" : ""}">${identity}</div>`;
      return `<div class="family-access-member ${member.status === "revoked" ? "revoked" : ""}">${identity}<div class="member-admin-actions"><select class="select compact-select" data-member-group="${escapeHtml(member.uid)}" ${this.cloudActionBusy ? "disabled" : ""}>${groupOptions(member.groupId)}</select>${member.status === "active" ? `<button class="btn small ghost danger" data-member-status="revoked" data-member-uid="${escapeHtml(member.uid)}" data-member-name="${escapeHtml(name)}" ${this.cloudActionBusy ? "disabled" : ""}>${this.locale === "zh-TW" ? "撤銷 Cloud" : "Revoke Cloud"}</button>` : `<button class="btn small" data-member-status="active" data-member-uid="${escapeHtml(member.uid)}" data-member-name="${escapeHtml(name)}" ${this.cloudActionBusy ? "disabled" : ""}>${this.locale === "zh-TW" ? "恢復 Cloud" : "Restore Cloud"}</button>`}</div></div>`;
    }).join("");
    const memberAccessCard = `<div class="card member-access-card"><div class="member-access-heading"><div><div class="strong">${this.locale === "zh-TW" ? "Cloud 成員與權限" : "Cloud members & access"}</div><div class="small muted">${this.familyAccessEditing ? (this.locale === "zh-TW" ? "編輯模式：可變更群組或 Cloud 權限" : "Edit mode: change groups or Cloud access") : (this.locale === "zh-TW" ? "一般檢視只顯示成員、群組與狀態" : "Clean view shows member, group and status")}</div></div><button class="btn small ${this.familyAccessEditing ? "primary" : ""}" data-action="toggle-member-access-edit">${this.familyAccessEditing ? (this.locale === "zh-TW" ? "完成" : "Done") : (this.locale === "zh-TW" ? "編輯" : "Edit")}</button></div><div class="member-access-list">${memberRows}</div></div>`;

    const defaultGroup = membership.groups[0]?.id ?? DEFAULT_GROUP_ID;
    const inviteLink = this.createdInvite ? `${location.origin}${location.pathname}#invite=${encodeURIComponent(this.createdInvite.id)}` : "";
    const invite = `<div class="card cloud-family-card invite-cloud-card"><div><div class="strong">${this.locale === "zh-TW" ? "邀請 Cloud 成員" : "Invite a Cloud member"}</div><p class="small muted">${this.locale === "zh-TW" ? "邀請綁定指定 Google 電子郵件與群組。可直接傳送連結，或讓對方掃描本機產生的 QR code。" : "The invitation is bound to one Google email and one group. Send the link directly or let them scan the QR code generated locally in this browser."}</p></div><form id="create-invite-form" class="cloud-family-form"><label>${this.locale === "zh-TW" ? "Google 電子郵件" : "Google email"}<input class="input" name="inviteEmail" type="email" maxlength="320" required placeholder="friend@example.com"></label><label>${this.locale === "zh-TW" ? "群組" : "Group"}<select class="select" name="inviteGroup">${groupOptions(defaultGroup)}</select></label><button class="btn primary" type="submit" ${this.cloudActionBusy ? "disabled" : ""}>${this.locale === "zh-TW" ? "建立邀請" : "Create invite"}</button></form>${this.createdInvite ? `<div class="invite-result invite-result-with-qr"><div class="invite-result-copy"><span class="tiny muted">${this.locale === "zh-TW" ? "給" : "For"} ${escapeHtml(this.createdInvite.emailLower)} · ${escapeHtml(this.groupName(this.createdInvite.groupId))}</span><strong class="invite-code invite-link">${escapeHtml(inviteLink)}</strong><span class="tiny muted">${this.locale === "zh-TW" ? "只有指定 Google 帳號可使用。QR code 完全在瀏覽器內產生，不會把邀請連結傳給第三方。" : "Only the specified Google account can use it. The QR code is generated entirely in the browser, so the invitation link is not sent to a third party."}</span><button class="btn small invite-copy-button" data-copy-invite="${escapeHtml(inviteLink)}">${this.locale === "zh-TW" ? "複製連結" : "Copy link"}</button></div><div class="invite-qr-wrap"><span>${this.locale === "zh-TW" ? "掃描加入" : "Scan to join"}</span>${qrSvg(inviteLink)}</div></div>` : ""}</div>`;

    const note = `<div class="card compact"><div class="strong">${this.locale === "zh-TW" ? "舊 Google 登入" : "Historical Google sign-ins"}</div><div class="small muted">${this.locale === "zh-TW" ? "v0.8.3 會在舊登入裝置下次開啟時檢查一次：沒有啟用 Cloud access 的帳號會自動登出並回到 Local。此清單顯示 LogTogether Cloud 授權成員，不是假裝成 Firebase 的即時在線名單。若要清理從未加入家庭、也不再開啟網站的舊 Auth 使用者，可在 Firebase Authentication 主控台手動刪除。" : "v0.8.3 validates older sign-ins once on their next launch: accounts without active Cloud access are automatically signed out and returned to Local. This list represents LogTogether Cloud authorization, not a fake real-time Firebase online roster. Old Auth-only users who never joined Cloud and never reopen the site can be deleted manually in Firebase Authentication if you want a one-time cleanup."}</div></div>`;

    return `<section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "Cloud 與群組" : "Cloud & groups"}</h2></div><div class="family-access-stack">${summary}${groups}${memberAccessCard}${invite}${note}</div></section>`;
  }

  private renderWorkoutSyncSettings(): string {
    if (!cloudModeEnabled()) return "";
    const localCount = this.localStructuredRecordCount();
    const activeCloud = Boolean(this.authUser && this.cloudMembership?.access.status === "active");
    const offlineCloud = Boolean(!this.networkOnline && this.offlineAccount?.cloudApproved);
    const pending = activeCloud || offlineCloud ? this.pendingCloudChangesCount() : 0;
    let status = this.locale === "zh-TW" ? "Local · 不使用 Firebase" : "Local · no Firebase backend";
    let detail = this.locale === "zh-TW"
      ? `${localCount} 筆結構化紀錄只儲存在這台裝置。一般 Local 使用不會初始化 Google Auth、App Check 或 Firestore。`
      : `${localCount} structured record${localCount === 1 ? "" : "s"} stay on this device. Normal Local use does not initialize Google Auth, App Check or Firestore.`;

    if (offlineCloud) {
      status = this.locale === "zh-TW" ? "Cloud · 離線" : "Cloud · offline";
      detail = pending > 0
        ? (this.locale === "zh-TW" ? `${pending} 項變更正在本機等待同步；恢復網路後會重新驗證 Cloud 權限並自動重試。` : `${pending} change${pending === 1 ? "" : "s"} are waiting locally. Cloud authorization is re-verified and sync retries when connectivity returns.`)
        : (this.locale === "zh-TW" ? "這台裝置正使用上次核准的 Cloud 帳號本機資料；恢復網路後會重新驗證權限。" : "This device is using the local cache for its last approved Cloud account and will re-verify access when connectivity returns.");
    } else if (activeCloud) {
      if (this.cloudWorkoutBusy || this.cloudCompanionBusy || !this.cloudWorkoutReady || !this.cloudCompanionReady) {
        status = this.locale === "zh-TW" ? "Cloud · 同步中…" : "Cloud · syncing…";
        detail = pending > 0
          ? (this.locale === "zh-TW" ? `正在處理 ${pending} 項本機變更。` : `Processing ${pending} local change${pending === 1 ? "" : "s"}.`)
          : (this.locale === "zh-TW" ? "正在核對這台裝置與 Cloud 資料。" : "Reconciling this device with Cloud data.");
      } else if (this.cloudWorkoutError || this.cloudHikeError || this.cloudCompanionError || this.cloudMembershipError) {
        status = this.locale === "zh-TW" ? "Cloud · 已存本機，等待重試" : "Cloud · saved locally, retry pending";
        detail = pending > 0
          ? (this.locale === "zh-TW" ? `${pending} 項變更仍安全保存在這台裝置。` : `${pending} change${pending === 1 ? "" : "s"} remain safely stored on this device.`)
          : (this.cloudWorkoutError || this.cloudHikeError || this.cloudCompanionError || this.cloudMembershipError || "");
      } else if (pending > 0) {
        status = this.locale === "zh-TW" ? `Cloud · ${pending} 項等待同步` : `Cloud · ${pending} waiting to sync`;
        detail = this.locale === "zh-TW" ? "本機儲存已完成；Cloud 同步會自動繼續。" : "Local save is complete; Cloud sync will continue automatically.";
      } else {
        status = this.locale === "zh-TW" ? "Cloud · 已同步" : "Cloud · up to date";
        detail = this.locale === "zh-TW" ? "這台裝置的變更已備份；可見的群組共用資料也已更新。" : "Changes from this device are backed up and visible group-shared data is current.";
      }
    }

    const canRefresh = Boolean(activeCloud && this.networkOnline && !this.cloudWorkoutBusy && !this.cloudCompanionBusy);
    const storageBackend = localStructuredStorageBackend(this.localScope || undefined);
    const storageLabel = storageBackend === "indexeddb"
      ? (this.locale === "zh-TW" ? "本機資料庫：IndexedDB ✓" : "Local database: IndexedDB ✓")
      : (this.locale === "zh-TW" ? "本機資料庫：localStorage 備援模式" : "Local database: localStorage fallback");
    const modeValue = activeCloud || offlineCloud
      ? (pending > 0 ? `${pending} ${this.locale === "zh-TW" ? "待同步" : "pending"}` : "Cloud")
      : "Local";
    const privacy = activeCloud || offlineCloud
      ? (this.locale === "zh-TW"
          ? "Cloud 會在你的裝置間同步運動、健行資料、飲水、補充品、偏好、生理性別、身高與體重。群組成員只能看到授權群組中的共用運動、健行摘要、生理性別、每日熱量／飲水、本週成就、補充品週總覽與徽章；身高、體重、逐筆飲水／補充品時間、GPX 精確路線與照片不會分享。"
          : "Cloud syncs workouts, hike metadata, water, supplements, preferences, biological sex, height and weight across your devices. Group members can see shared workouts, hike summaries, biological sex, daily calorie/water totals, weekly achievements, weekly supplement summaries and badges only within authorized groups; height, weight, individual drink/supplement times, precise GPX traces and photos are not shared.")
      : (this.locale === "zh-TW"
          ? "Local 模式不會使用 Firebase Auth、App Check 或 Firestore。若之後接受 Cloud 邀請，LogTogether 會先保留回復備份，再把現有 Local 資料安全合併到該 Google 帳號。"
          : "Local mode does not use Firebase Auth, App Check or Firestore. If you later accept a Cloud invitation, LogTogether keeps a rollback backup before safely merging this Local history into that Google account.");
    return `<section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "Local / Cloud" : "Local / Cloud"}</h2><span class="section-value">${escapeHtml(modeValue)}</span></div><div class="card sync-status-card"><div class="row"><div><div class="strong">${escapeHtml(status)}</div><div class="small muted">${escapeHtml(detail)}</div><div class="tiny muted sync-last-success">${activeCloud || offlineCloud ? escapeHtml(this.lastSyncLabel()) : ""}</div><div class="tiny muted">${escapeHtml(storageLabel)}</div><div class="tiny muted sync-privacy-note">${escapeHtml(privacy)}</div></div>${canRefresh ? `<button class="btn small" data-action="refresh-workout-cloud">${this.locale === "zh-TW" ? "立即同步" : "Sync now"}</button>` : ""}</div></div></section>`;
  }

  private renderLocalBackupSettings(): string {
    const scopeLabel = this.localScope.startsWith("uid:")
      ? (this.offlineAccount?.displayName || this.authUser?.displayName || this.state.user.displayName)
      : (this.locale === "zh-TW" ? "訪客／本機" : "Guest/local");
    return `<section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "本機備份" : "Local backup"}</h2></div><div class="card backup-card"><div><div class="strong">${this.locale === "zh-TW" ? "匯出／匯入 LogTogether 資料" : "Export / import LogTogether data"}</div><div class="small muted">${this.locale === "zh-TW" ? `目前帳號：${escapeHtml(scopeLabel)}。備份包含運動、飲水、補充品、健行與 GPX 路線、目標和設定；本機照片檔本身暫時不包含在 JSON 內。` : `Current account: ${escapeHtml(scopeLabel)}. The backup includes workouts, water, supplements, hikes and GPX routes, goals and settings. Local image bytes are not yet included in the JSON file.`}</div></div><div class="backup-actions"><button class="btn small" data-action="export-local-backup">${this.locale === "zh-TW" ? "匯出 JSON" : "Export JSON"}</button><label class="btn small file-button">${this.locale === "zh-TW" ? "匯入 JSON" : "Import JSON"}<input id="local-backup-import" type="file" accept="application/json,.json" hidden></label></div><div class="tiny muted">${this.locale === "zh-TW" ? "匯入會取代這台裝置目前帳號的結構化資料；LogTogether 會先在瀏覽器內保留一份回復副本。不同 Google 帳號的備份不能互相匯入。" : "Import replaces the structured data for the current account on this device. LogTogether keeps an internal rollback copy first. Backups from a different Google account are rejected."}</div></div></section>`;
  }

  private estimatedCloudPayloadBytes(): number {
    const workouts=this.state.workouts.map(({photoId,...workout})=>workout);
    const hikes=this.state.hikes.map(({photoId,routePoints,...hike})=>hike);
    const profile=this.state.profile ? { heightCm:this.state.profile.heightCm, biologicalSex:this.state.profile.biologicalSex, weightEntries:this.state.profile.weightEntries } : null;
    const payload={ workouts,hikes,hydration:this.state.hydration,hydrationHistory:this.state.hydrationHistory ?? [],supplements:this.state.supplementHistory ?? [],preferences:this.cloudPreferenceValue(),profile,badges:this.shareableBadges(),familyWeekly:this.currentWeekFamilySummary() };
    return new TextEncoder().encode(JSON.stringify(payload)).length;
  }

  private renderFirebaseCapacitySettings(): string {
    if(!cloudModeEnabled()) return "";
    const estimated=this.estimatedCloudPayloadBytes();
    const firestoreFree=1024**3;
    const remaining=Math.max(0,firestoreFree-estimated);
    const percent=estimated/firestoreFree*100;
    const percentLabel=percent<0.01 ? "<0.01%" : `${percent.toFixed(2)}%`;
    return `<section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "Firebase 容量" : "Firebase capacity"}</h2><span class="section-value">${percentLabel}</span></div><div class="card firebase-capacity-card"><div class="capacity-grid"><div><span>${this.locale === "zh-TW" ? "這個帳號的同步資料估算" : "Estimated synced payload for this account"}</span><strong>${formatBytes(estimated)}</strong></div><div><span>${this.locale === "zh-TW" ? "Firestore 免費儲存額度" : "Firestore no-cost stored-data quota"}</span><strong>1 GiB</strong></div><div><span>${this.locale === "zh-TW" ? "粗略剩餘空間" : "Rough remaining headroom"}</span><strong>${formatBytes(remaining)}</strong></div><div><span>${this.locale === "zh-TW" ? "Hosting 免費儲存額度" : "Hosting no-cost storage"}</span><strong>10 GB</strong></div></div><p class="tiny muted">${this.locale === "zh-TW" ? "這只是 LogTogether 在本機可看見資料的粗略下限估算，不包含 Firestore 索引、中繼資料、其他家庭帳號、舊文件或 Hosting 舊版本。Firebase 主控台的 Usage 才是實際數字。" : "This is only a rough lower-bound estimate from LogTogether data visible to this account. Firestore indexes/metadata, other family accounts, old documents and retained Hosting releases are not included. Firebase Console Usage is authoritative."}</p><div class="capacity-actions"><a class="btn small" href="https://console.firebase.google.com/project/YOUR_PROJECT_ID/firestore" target="_blank" rel="noreferrer">${this.locale === "zh-TW" ? "開啟 Firestore" : "Open Firestore"}</a><a class="btn small" href="https://console.firebase.google.com/project/YOUR_PROJECT_ID/hosting" target="_blank" rel="noreferrer">${this.locale === "zh-TW" ? "開啟 Hosting" : "Open Hosting"}</a></div></div></section>`;
  }


  private renderAlphaReadinessSettings(): string {
    const privacy = familyPrivacySummary(this.locale);
    const appCheck = appCheckRuntimeStatus();
    const appCheckLabel = appCheck.state === "active"
      ? (this.locale === "zh-TW" ? "已啟用 · 監控中" : "Active · monitoring")
      : appCheck.state === "initializing"
        ? (this.locale === "zh-TW" ? "正在初始化…" : "Initializing…")
        : appCheck.state === "error"
          ? (this.locale === "zh-TW" ? "初始化失敗" : "Initialization error")
          : (this.locale === "zh-TW" ? "尚未設定" : "Not configured yet");
    const appCheckDetail = appCheck.state === "active"
      ? (this.locale === "zh-TW" ? "客戶端已附帶 App Check 權杖。家庭測試期間先看 Firebase 指標，不要急著開啟強制執行。" : "The client is attaching App Check tokens. During family alpha, monitor Firebase metrics before enabling enforcement.")
      : appCheck.state === "error"
        ? (this.locale === "zh-TW" ? "App Check 沒有成功啟動；目前不要在 Firebase 主控台開啟強制執行。" : "App Check did not start successfully. Do not enable Firebase enforcement while this status remains.")
        : (this.locale === "zh-TW" ? "v0.8.2 已準備好 reCAPTCHA Enterprise App Check；填入公開 site key 後即可先以監控模式測試。" : "v0.8.2 is ready for reCAPTCHA Enterprise App Check. Add the public site key, then monitor it before enforcement.");
    const list = (items: string[]) => `<ul class="privacy-list">${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    return `<section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "家庭 Alpha 準備" : "Family alpha readiness"}</h2><span class="section-value">v${APP_VERSION}</span></div><div class="alpha-readiness-stack">
      <div class="card app-check-card"><div class="row"><div><div class="strong">Firebase App Check</div><div class="small muted">${escapeHtml(appCheckDetail)}</div></div><span class="status-pill ${appCheck.state === "active" ? "good" : appCheck.state === "error" ? "danger" : "neutral"}">${escapeHtml(appCheckLabel)}</span></div></div>
      <details class="card privacy-details"><summary><span>${this.locale === "zh-TW" ? "我的家庭可以看到什麼？" : "What can my family see?"}</span><span class="tiny muted">${this.locale === "zh-TW" ? "隱私摘要" : "Privacy summary"}</span></summary><div class="privacy-grid"><div><strong>${this.locale === "zh-TW" ? "家庭可看到" : "Shared with family"}</strong>${list(privacy.shared)}</div><div><strong>${this.locale === "zh-TW" ? "只在你的帳號同步" : "Private to your account"}</strong>${list(privacy.privateToAccount)}</div><div><strong>${this.locale === "zh-TW" ? "目前只在這台裝置" : "Currently device-local"}</strong>${list(privacy.localOnly)}</div></div></details>
      <details class="card privacy-details"><summary><span>${this.locale === "zh-TW" ? "尚未啟用的功能" : "Features not enabled yet"}</span><span class="tiny muted">Alpha</span></summary><div class="family-details-body">${list(privacy.unfinished)}<p class="tiny muted">${this.locale === "zh-TW" ? "這些功能在家庭測試版中會先隱藏或保持本機，避免讓家人誤以為它們已經可以跨裝置／家庭使用。" : "These stay hidden or local during the family alpha so nobody mistakes them for finished cross-device/family features."}</p></div></details>
      <div class="card diagnostic-card"><div class="row"><div><div class="strong">${this.locale === "zh-TW" ? "隱私安全的診斷檔" : "Privacy-safe diagnostics"}</div><div class="small muted">${this.locale === "zh-TW" ? "匯出版本、同步狀態與紀錄數量；不包含姓名、帳號 ID、運動內容、備註、補充品名稱或 GPS 點。" : "Exports version, sync state and record counts. It excludes names, account IDs, workout contents, notes, supplement names and GPS points."}</div></div><button class="btn small" data-action="export-diagnostics">${this.locale === "zh-TW" ? "匯出診斷" : "Export diagnostics"}</button></div></div>
    </div></section>`;
  }

  private renderSettings(): string {
    const textScale = clamp(Math.round((this.state.textScale ?? 100) / 10) * 10, 100, 140);
    const waterGoal = this.state.hydration.targetMl;
    const specialGoal = waterGoal !== 2000;
    const interfaceSection = `<section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "介面" : "Interface"}</h2></div><div class="card"><div class="setting-row row"><div><div class="strong">${escapeHtml(this.text("language"))}</div></div><div class="segmented"><button data-locale="en" class="${this.locale === "en" ? "active" : ""}">EN</button><button data-locale="zh-TW" class="${this.locale === "zh-TW" ? "active" : ""}">繁中</button></div></div><div class="setting-row row"><div><div class="strong">${escapeHtml(this.text("appearance"))}</div></div><div class="segmented"><button data-theme="dark" class="${this.state.theme === "dark" ? "active" : ""}">${escapeHtml(this.text("dark"))}</button><button data-theme="light" class="${this.state.theme === "light" ? "active" : ""}">${escapeHtml(this.text("light"))}</button></div></div><div class="setting-row row text-scale-setting"><div><div class="strong">${this.locale === "zh-TW" ? "文字大小" : "Text size"}</div><div class="small muted">${this.locale === "zh-TW" ? "只調整文字大小；卡片與控制項會自動換行。" : "Scales text only; cards and controls reflow automatically."}</div></div><select class="select text-scale-select" id="text-scale-select" aria-label="${this.locale === "zh-TW" ? "文字大小百分比" : "Text size percentage"}">${[100,110,120,130,140].map(value=>`<option value="${value}" ${textScale===value ? "selected" : ""}>${value}%</option>`).join("")}</select></div><div class="setting-row palette-setting"><div><div class="strong">${this.locale === "zh-TW" ? "主題色" : "Accent color"}</div><div class="small muted">${this.locale === "zh-TW" ? "只改介面強調色，不影響資料。" : "Changes UI accents only; it never changes your records."}</div></div><div class="palette-controls">${ACCENT_PRESETS.map(preset=>`<button class="palette-swatch ${normalizeHex(this.state.accentColor)===preset.color ? "active" : ""}" data-accent-color="${preset.color}" title="${preset.label}" data-style-background="${preset.color}" aria-label="${preset.label}"></button>`).join("")}<label class="custom-color" title="${this.locale === "zh-TW" ? "自訂顏色" : "Custom color"}"><input id="custom-accent-input" type="color" value="${normalizeHex(this.state.accentColor)}"><span>${this.locale === "zh-TW" ? "自訂" : "Custom"}</span></label></div></div></div></section>`;
    const securitySection = `<section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "安全性" : "Security"}</h2></div><div class="card security-list">${this.authCard()}<div><strong>${this.locale === "zh-TW" ? "本機資料" : "Local data"}</strong><span>${this.locale === "zh-TW" ? "IndexedDB + 寫入日誌 + 匯出備份" : "IndexedDB + write journal + export backup"}</span></div><div><strong>${this.locale === "zh-TW" ? "Cloud 資料" : "Cloud data"}</strong><span>${this.locale === "zh-TW" ? "第一次取得 Cloud 權限需要邀請；已授權帳號之後可在新裝置重新登入。Cloud 仍由 Firebase Auth、App Check 與 Firestore 規則保護。" : "First-time Cloud access requires an invitation; authorized accounts can reconnect on new devices afterward. Cloud remains protected by Firebase Auth, App Check and Firestore Security Rules."}</span></div></div></section>`;
    const specialNeeds = `<section class="section"><details class="card settings-fold" ${specialGoal ? "open" : ""}><summary><div><strong>${this.locale === "zh-TW" ? "特殊需求？" : "Special needs?"}</strong><span>${this.locale === "zh-TW" ? "一般每日飲水目標固定為 2,000 mL" : "The standard daily water goal is fixed at 2,000 mL"}</span></div><span class="history-chevron">${icon("chevron")}</span></summary><div class="settings-fold-body"><p class="small muted">${this.locale === "zh-TW" ? "大多數使用者不需要調整。若你有自己的專業建議或特殊目標，可在這裡覆寫。未來其他特殊需求設定也會放在這裡。" : "Most people do not need to change this. If you have your own professional guidance or a special target, you can override it here. Future special-needs options can live here too."}</p><form id="water-goal-form" class="special-water-goal"><label class="field"><span>${this.locale === "zh-TW" ? "每日飲水目標" : "Daily water goal"}</span><input class="input" name="waterGoal" type="number" min="500" max="6000" step="100" value="${waterGoal}"><small>${specialGoal ? (this.locale === "zh-TW" ? `目前使用特殊目標 ${waterGoal.toLocaleString()} mL。改回 2,000 即恢復標準值。` : `Currently using a special ${waterGoal.toLocaleString()} mL target. Set it back to 2,000 to restore the standard.`) : (this.locale === "zh-TW" ? "標準：2,000 mL" : "Standard: 2,000 mL")}</small></label><button class="btn small" type="submit">${escapeHtml(this.text("saveChanges"))}</button></form></div></details></section>`;
    const dataTools = `<section class="section"><details class="card settings-fold"><summary><div><strong>${this.locale === "zh-TW" ? "資料、備份與診斷" : "Data, backup & diagnostics"}</strong><span>${this.locale === "zh-TW" ? "較少使用的維護工具" : "Less-frequent maintenance tools"}</span></div><span class="history-chevron">${icon("chevron")}</span></summary><div class="settings-fold-body settings-nested">${this.renderLocalBackupSettings()}${this.renderFirebaseCapacitySettings()}<div class="card compact diagnostic-inline"><div><strong>${this.locale === "zh-TW" ? "隱私安全的診斷檔" : "Privacy-safe diagnostics"}</strong><div class="small muted">${this.locale === "zh-TW" ? "只匯出版本、同步狀態與紀錄數量，不包含運動內容或帳號 ID。" : "Exports version, sync state and record counts without workout contents or account IDs."}</div></div><button class="btn small" data-action="export-diagnostics">${this.locale === "zh-TW" ? "匯出" : "Export"}</button></div><div class="card compact"><div class="row"><div><strong>${cloudModeEnabled() ? (this.locale === "zh-TW" ? "清除本機測試資料" : "Clear local test data") : (this.locale === "zh-TW" ? "重設本機示範資料" : "Reset local demo data")}</strong><div class="small muted">${cloudModeEnabled() ? (this.locale === "zh-TW" ? "只清除此瀏覽器中的本機紀錄；Cloud 權限不會被刪除。" : "Clears local records in this browser only; Cloud authorization is not deleted.") : (this.locale === "zh-TW" ? "將這個瀏覽器還原為示範資料。" : "Restores this browser to the bundled demo dataset.")}</div></div><button class="btn ghost danger" data-action="reset-demo">${cloudModeEnabled() ? (this.locale === "zh-TW" ? "清除" : "Clear") : (this.locale === "zh-TW" ? "重設" : "Reset")}</button></div></div></div></details></section>`;
    const about = `<section class="section"><details class="card settings-fold"><summary><div><strong>${this.locale === "zh-TW" ? "計算方式與版本" : "Calculations & version"}</strong><span>${this.locale === "zh-TW" ? "熱量、BMI、訓練點數、限制與版本資訊" : "Calories, BMI, training credit, limitations and version information"}</span></div><span class="history-chevron">${icon("chevron")}</span></summary><div class="settings-fold-body"><details class="calorie-method-details"><summary>${this.locale === "zh-TW" ? "如何計算熱量" : "How we calculate calories"}</summary><div class="small muted calorie-method-copy">${this.locale === "zh-TW" ? "熱量估算：Cal = MET × 3.5 × 體重(kg) ÷ 200 × 分鐘。難度 1–5 對應約 3.0／4.5／6.0／8.0／10.0 MET。程式會取『實際經過時間』與『已完成組數估算』兩者較高值；次數型動作以約 3 秒／次（每組至少 15 秒、最多 180 秒）估算，已記錄的組間休息以 1.8 MET 計。適合看趨勢，不是醫療或實驗級量測。" : "Calorie estimate: Cal = MET × 3.5 × weight (kg) ÷ 200 × minutes. Difficulty 1–5 maps to about 3.0 / 4.5 / 6.0 / 8.0 / 10.0 MET. LogTogether uses the higher of elapsed-time and completed-set estimates; rep sets assume about 3 sec/rep (15–180 sec per set), and logged rest between sets uses 1.8 MET. It is useful for trends, not precise lab-grade measurement."}</div></details><details class="calorie-method-details"><summary>${this.locale === "zh-TW" ? "如何計算 BMI" : "How we calculate BMI"}</summary><div class="small muted calorie-method-copy">${this.locale === "zh-TW" ? "BMI = 體重(kg) ÷ 身高(m)²。LogTogether 目前使用成人分類：過輕 <18.5、正常 18.5–<24、過重 24–<27、肥胖 ≥27。成人 BMI 分類不因生理性別改變；BMI 只作一般參考，不是診斷。" : "BMI = weight (kg) ÷ height (m)². LogTogether currently uses these adult categories: underweight <18.5, normal 18.5–<24, overweight 24–<27, and obesity ≥27. The adult cutoffs do not change by biological sex; BMI is a general reference, not a diagnosis."}</div></details><details class="calorie-method-details"><summary>${this.locale === "zh-TW" ? "如何計算訓練點數" : "How training credit works"}</summary><div class="small muted calorie-method-copy">${this.locale === "zh-TW" ? "力量訓練：每個完成的組數約為 1 點，再依動作涉及的肌群比例分配，例如臥推會把同一點拆分到胸、手臂與肩部，不會重複算三點。有氧：依實際完成時間計入有氧點數並設上限；活動度／伸展使用獨立的時間點數。體感難度 1–5 只做小幅修正（約 0.85×–1.10×），避免自評難度主導任務。這代表步行／跑步不會直接完成胸、背或腿部力量任務。" : "Strength: each completed set is roughly 1 credit, then split across the muscles involved. A bench press set, for example, shares that one credit between chest, arms and shoulders instead of counting as three full sets. Cardio earns capped cardio credit from actual completed time; mobility/stretching earns separate time-based credit. Effort 1–5 only makes a small adjustment (about 0.85×–1.10×), so self-rated difficulty does not dominate missions. Walking or running therefore cannot directly complete chest, back or leg strength missions."}</div></details><div class="tiny muted settings-version">${escapeHtml(this.text("version"))} ${APP_VERSION} · schema v1 · ${cloudModeEnabled() ? "Cloud-ready preview" : "Local preview"}</div></div></details></section>`;
    const initials = this.state.user.displayName.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase() ?? "").join("") || "?";
    const profile = this.state.profile!;
    const profileImage = profile.photoId ? this.privateImage(profile.photoId,"settings-profile-photo",this.state.user.displayName) : this.authUser?.photoURL ? `<img class="settings-profile-photo" src="${escapeHtml(this.authUser.photoURL)}" referrerpolicy="no-referrer" alt="${escapeHtml(this.state.user.displayName)}">` : `<div class="settings-profile-photo placeholder">${escapeHtml(initials)}</div>`;
    const profileCard = `<section class="section settings-profile-section"><div class="card settings-profile-card"><div class="settings-profile-identity">${profileImage}<div><strong>${escapeHtml(this.state.user.displayName)}</strong><span>${this.authUser && this.cloudMembership?.access.status === "active" ? "Cloud" : "Local"}</span></div></div><button class="btn small" data-action="open-profile">${this.locale === "zh-TW" ? "編輯個人資料" : "Edit profile"}</button></div></section>`;
    return `<h1 class="page-title">${this.locale === "zh-TW" ? "設定" : "Settings"}</h1><p class="page-subtitle">${this.locale === "zh-TW" ? "常用介面設定放在最前面；較少使用的工具收進可展開區塊。" : "Common interface settings stay up front; less-used tools are tucked into expandable sections."}</p>${profileCard}${interfaceSection}${securitySection}${this.renderWorkoutSyncSettings()}${this.renderFamilyAccessSettings()}${specialNeeds}<section class="section"><details class="card settings-fold"><summary><div><strong>${this.locale === "zh-TW" ? "隱私與 Alpha 保護" : "Privacy & alpha protection"}</strong><span>${this.locale === "zh-TW" ? "App Check、家庭可見內容與未完成功能" : "App Check, family visibility and unfinished features"}</span></div><span class="history-chevron">${icon("chevron")}</span></summary><div class="settings-fold-body settings-nested">${this.renderAlphaReadinessSettings()}</div></details></section>${dataTools}${about}`;
  }

  private latestExerciseEntry(exerciseId: string): WorkoutExerciseEntry | undefined {
    const sorted = this.state.workouts.filter(w => w.completedAt).slice().sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
    for (const workout of sorted) {
      const found = workout.exercises.find(exercise => exercise.exerciseId === exerciseId);
      if (found) return found;
    }
    return undefined;
  }

  private previousSet(workout: WorkoutRecord, exerciseId: string, index: number): SetEntry | undefined {
    return this.state.workouts
      .filter(item => item.id !== workout.id && item.completedAt)
      .slice()
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
      .find(item => item.exercises.some(ex => ex.exerciseId === exerciseId))
      ?.exercises.find(ex => ex.exerciseId === exerciseId)?.sets[index];
  }

  private setSummary(definition: ExerciseDefinition | undefined, set: SetEntry | undefined): string {
    if (!set) return "—";
    if (definition) {
      const profile = exerciseLoggingProfile(definition);
      if (profile === "cardio_session") {
        const metrics = exerciseSessionMetricFlags(definition);
        const parts: string[] = [];
        if (set.durationSec !== undefined) parts.push(`${Math.round(set.durationSec / 60)} ${this.text("minutes")}`);
        if (metrics.distance && set.distanceKm !== undefined) parts.push(`${set.distanceKm} km`);
        if (metrics.speed && set.speedKph !== undefined) parts.push(`${set.speedKph} km/h`);
        if (metrics.incline && set.inclinePct !== undefined) parts.push(`${set.inclinePct}% ${this.locale === "zh-TW" ? "坡度" : "incline"}`);
        if (metrics.resistance && set.resistanceLevel !== undefined) parts.push(`${this.locale === "zh-TW" ? "阻力" : "level"} ${set.resistanceLevel}`);
        if (metrics.laps && set.laps !== undefined) parts.push(`${set.laps} ${this.locale === "zh-TW" ? "趟" : "laps"}`);
        return parts.join(" · ") || "—";
      }
      if (profile === "mobility_session") return set.durationSec !== undefined ? `${Math.round(set.durationSec / 60)} ${this.text("minutes")}` : "—";
      if (profile === "rounds") return set.durationSec !== undefined ? `${set.durationSec} ${this.text("seconds")}` : "—";
    }
    switch (definition?.type) {
      case "reps": return `${set.reps ?? "—"} ${this.text("reps")}`;
      case "duration": return `${set.durationSec ?? "—"} ${this.text("seconds")}`;
      case "distance_time": {
        const mins = set.durationSec !== undefined ? Math.round(set.durationSec / 60) : "—";
        return `${set.distanceKm ?? "—"} km · ${mins} ${this.text("minutes")}`;
      }
      default: return `${set.weightKg ?? "—"} kg × ${set.reps ?? "—"}`;
    }
  }

  private exerciseCategoryLabel(category: ExerciseDefinition["category"]): string {
    const en: Record<ExerciseDefinition["category"], string> = { chest: "Chest", back: "Back", shoulders: "Shoulders", arms: "Arms", legs: "Legs", core: "Core", cardio: "Cardio", mobility: "Mobility" };
    const zh: Record<ExerciseDefinition["category"], string> = { chest: "胸部", back: "背部", shoulders: "肩部", arms: "手臂", legs: "腿部", core: "核心", cardio: "有氧", mobility: "活動度／伸展" };
    return this.locale === "zh-TW" ? zh[category] : en[category];
  }

  private exerciseLibraryGroupLabel(group: ExerciseLibraryGroup): string {
    const en: Record<ExerciseLibraryGroup, string> = {
      gym: "Gym",
      calisthenics: "Calisthenics",
      outdoor_cardio: "Outdoor / Cardio",
      mobility_yoga: "Mobility / Yoga / Stretching",
      swimming: "Swimming / Lifesaving",
      kickboxing: "Kickboxing / Boxing",
      sports_other: "Sports / Other"
    };
    const zh: Record<ExerciseLibraryGroup, string> = {
      gym: "健身房",
      calisthenics: "徒手訓練",
      outdoor_cardio: "戶外／有氧",
      mobility_yoga: "活動度／瑜珈／伸展",
      swimming: "游泳／救生",
      kickboxing: "踢拳／拳擊",
      sports_other: "運動／其他"
    };
    return this.locale === "zh-TW" ? zh[group] : en[group];
  }

  private dailyCalorieTarget(): number {
    return Math.max(1, Math.round((this.state.goals?.weeklyCalories ?? 1050) / 7));
  }

  private categoryPalette(): string[] {
    return ["var(--cat-1)","var(--cat-2)","var(--cat-3)","var(--cat-4)","var(--cat-5)","var(--cat-6)","var(--cat-7)","var(--cat-8)"];
  }

  private exercisePreviewHint(definition: ExerciseDefinition | undefined): string {
    if (!definition) return this.locale === "zh-TW" ? "選擇動作後會顯示提示" : "Choose an exercise to see a quick visual hint";
    const profile = exerciseLoggingProfile(definition);
    const profileLabel = profile === "cardio_session"
      ? (this.locale === "zh-TW" ? "單次有氧紀錄" : "Cardio session")
      : profile === "mobility_session"
        ? (this.locale === "zh-TW" ? "單次活動度紀錄" : "Mobility session")
        : profile === "rounds"
          ? (this.locale === "zh-TW" ? "回合制" : "Rounds")
          : definition.type === "weight_reps"
            ? (this.locale === "zh-TW" ? "重量＋次數" : "Weight + reps")
            : definition.type === "reps"
              ? (this.locale === "zh-TW" ? "次數組" : "Rep sets")
              : definition.type === "duration"
                ? (this.locale === "zh-TW" ? "計時組" : "Timed sets")
                : (this.locale === "zh-TW" ? "距離＋時間組" : "Distance + time sets");
    return `${this.exerciseLibraryGroupLabel(exerciseLibraryGroup(definition))} · ${profileLabel}`;
  }

  private exerciseImageSearchUrl(definition: ExerciseDefinition): string {
    return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${definition.names.en} exercise form`)}`;
  }

  private renderSupplementWeekSummary(): string {
    const { start, end } = currentWeekBounds(new Date(`${this.selectedWaterDate}T12:00:00`));
    const endInclusive = new Date(end.getTime() - 1);
    const entries = (this.state.supplementHistory ?? [])
      .filter(day => day.date >= localDateKey(start) && day.date <= localDateKey(endInclusive))
      .flatMap(day => day.entries.map(entry => ({ date: day.date, entry })));
    const availableIds = [...new Set(entries.map(item => item.entry.supplementId))].sort((a, b) => this.supplementLabel(a).localeCompare(this.supplementLabel(b)));
    if (this.supplementWeekFilter !== "all" && !availableIds.includes(this.supplementWeekFilter)) this.supplementWeekFilter = "all";
    const filtered = this.supplementWeekFilter === "all" ? entries : entries.filter(item => item.entry.supplementId === this.supplementWeekFilter);
    const summaryMap = new Map<string, { amount: number; unit: SupplementUnit | null; mixedUnits: boolean; logs: number; days: Set<string> }>();
    for (const item of filtered) {
      const current = summaryMap.get(item.entry.supplementId) ?? { amount: 0, unit: item.entry.unit ?? null, mixedUnits: false, logs: 0, days: new Set<string>() };
      current.logs += 1;
      current.days.add(item.date);
      current.amount += Number(item.entry.amount ?? 0);
      if (!current.unit) current.unit = item.entry.unit ?? null;
      else if ((item.entry.unit ?? null) !== current.unit) current.mixedUnits = true;
      summaryMap.set(item.entry.supplementId, current);
    }
    const summaryRows = [...summaryMap.entries()]
      .sort((a, b) => this.supplementLabel(a[0]).localeCompare(this.supplementLabel(b[0])))
      .map(([supplementId, info]) => {
        const total = info.mixedUnits
          ? `${info.logs} ${this.locale === "zh-TW" ? "筆紀錄" : info.logs === 1 ? "log" : "logs"}`
          : `${Number(info.amount.toFixed(2)).toLocaleString()} ${this.supplementUnitLabel(info.unit ?? undefined, info.amount)}`;
        return `<div class="supplement-week-row"><div><strong>${escapeHtml(this.supplementLabel(supplementId))}</strong><span>${info.days.size} ${this.locale === "zh-TW" ? "天" : info.days.size === 1 ? "day" : "days"} · ${info.logs} ${this.locale === "zh-TW" ? "次" : info.logs === 1 ? "entry" : "entries"}</span></div><b>${escapeHtml(total)}</b></div>`;
      }).join("");
    const groupedDays = filtered.reduce((map, item) => {
      const list = map.get(item.date) ?? [];
      list.push(item.entry);
      map.set(item.date, list);
      return map;
    }, new Map<string, SupplementEntry[]>());
    const breakdown = this.supplementWeekFilter === "all" ? "" : [...groupedDays.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, dayEntries]) => `<div class="supplement-week-day"><strong>${escapeHtml(new Date(`${date}T12:00:00`).toLocaleDateString(this.locale, { weekday: "short", month: "short", day: "numeric" }))}</strong><div>${dayEntries.map(entry => `${escapeHtml((entry.amount ?? 0).toLocaleString())} ${escapeHtml(this.supplementUnitLabel(entry.unit, entry.amount))}`).join(" · ")}</div></div>`).join("");
    const title = this.locale === "zh-TW" ? "本週補充品總覽" : "This week’s supplement summary";
    const label = `${start.toLocaleDateString(this.locale, { month: "short", day: "numeric" })} – ${endInclusive.toLocaleDateString(this.locale, { month: "short", day: "numeric" })}`;
    return `<section class="section"><div class="section-header"><h2 class="section-title">${title}</h2><span class="section-value">${escapeHtml(label)}</span></div><details class="card supplement-week-card" open><summary><div><strong>${entries.length ? (this.locale === "zh-TW" ? "查看每週補充品" : "Review weekly supplements") : (this.locale === "zh-TW" ? "本週還沒有補充品" : "No supplements logged this week")}</strong><span>${availableIds.length} ${this.locale === "zh-TW" ? "種補充品" : availableIds.length === 1 ? "supplement" : "supplements"} · ${entries.length} ${this.locale === "zh-TW" ? "筆紀錄" : entries.length === 1 ? "entry" : "entries"}</span></div><span class="history-chevron">${icon("chevron")}</span></summary>${entries.length ? `<div class="supplement-week-body"><label class="field"><span>${this.locale === "zh-TW" ? "篩選補充品" : "Filter supplement"}</span><select class="select" id="supplement-week-filter"><option value="all" ${this.supplementWeekFilter === "all" ? "selected" : ""}>${this.locale === "zh-TW" ? "全部補充品" : "All supplements"}</option>${availableIds.map(id => `<option value="${escapeHtml(id)}" ${this.supplementWeekFilter === id ? "selected" : ""}>${escapeHtml(this.supplementLabel(id))}</option>`).join("")}</select></label><div class="supplement-week-list">${summaryRows}</div>${breakdown ? `<div class="supplement-week-breakdown"><div class="tiny muted">${this.locale === "zh-TW" ? "每日明細" : "Daily breakdown"}</div>${breakdown}</div>` : ``}</div>` : `<div class="supplement-week-empty small muted">${this.locale === "zh-TW" ? "記錄幾次補充品後，這裡會自動幫你整理每週總量與出現天數。" : "Once you log a few supplements, this panel will summarize totals and usage days for the week."}</div>`}</details></section>`;
  }

  private renderExerciseOptions(): string {
    const filtered = EXERCISES.filter(exercise => this.exerciseLibraryFilter === "all" || exerciseLibraryGroup(exercise) === this.exerciseLibraryFilter);
    return ALL_CATEGORIES.map(category => {
      const exercises = filtered.filter(exercise => exercise.category === category);
      if (!exercises.length) return "";
      return `<optgroup label="${escapeHtml(this.exerciseCategoryLabel(category))}">${exercises.map(exercise => `<option value="${escapeHtml(exercise.id)}" ${exercise.id === this.pendingExerciseId ? "selected" : ""}>${escapeHtml(exercise.names[this.locale])}</option>`).join("")}</optgroup>`;
    }).join("");
  }

  private renderExerciseTypeOptions(): string {
    return [`<option value="all" ${this.exerciseLibraryFilter === "all" ? "selected" : ""}>${this.locale === "zh-TW" ? "全部" : "All"}</option>`, ...LIBRARY_GROUP_ORDER.map(group => `<option value="${group}" ${this.exerciseLibraryFilter === group ? "selected" : ""}>${escapeHtml(this.exerciseLibraryGroupLabel(group))}</option>`)].join("");
  }

  private renderExerciseComposer(): string {
    const definition = exerciseById(this.pendingExerciseId) ?? EXERCISES[0];
    if (!definition) return "";
    const profile = exerciseLoggingProfile(definition);
    const metrics = exerciseSessionMetricFlags(definition);
    const previousEntry = this.latestExerciseEntry(definition.id);
    const previous = previousEntry?.sets[0];
    const previousHint = previous ? `<div class="composer-previous">${escapeHtml(this.text("previous"))}: <strong>${escapeHtml(this.setSummary(definition, previous))}</strong></div>` : "";
    const focus = this.exerciseFocusText(definition);
    let structureFields = "";
    let fields = "";

    if (profile === "sets") {
      const setCount = clamp(previousEntry?.sets.length ?? 3, 1, 10);
      const restSec = Math.max(0, previousEntry?.restSec ?? (definition.type === "weight_reps" || definition.type === "reps" ? 90 : 30));
      structureFields = `<div class="form-two"><div class="field"><label>${escapeHtml(this.text("setCount"))}</label><input class="input" name="sets" type="number" min="1" max="10" step="1" inputmode="numeric" value="${setCount}"></div><div class="field"><label>${this.locale === "zh-TW" ? "組間休息（秒）" : "Rest between sets (sec)"}</label><input class="input" name="rest" type="number" min="0" max="900" step="5" inputmode="numeric" value="${restSec}"><div class="tiny muted">${this.locale === "zh-TW" ? "設為 0 = 正計時，不設上限" : "0 = count up with no target"}</div></div></div>`;
      if (definition.type === "weight_reps") fields = `<div class="form-two"><div class="field"><label>${escapeHtml(this.text("defaultWeight"))}</label><input class="input" name="weight" type="number" min="0" step="0.5" inputmode="decimal" value="${previous?.weightKg ?? 0}"></div><div class="field"><label>${escapeHtml(this.text("defaultReps"))}</label><input class="input" name="reps" type="number" min="0" step="1" inputmode="numeric" value="${previous?.reps ?? 10}"></div></div>`;
      else if (definition.type === "reps") fields = `<div class="field"><label>${escapeHtml(this.text("defaultReps"))}</label><input class="input" name="reps" type="number" min="0" step="1" inputmode="numeric" value="${previous?.reps ?? 10}"></div>`;
      else if (definition.type === "duration") fields = `<div class="field"><label>${escapeHtml(this.text("defaultDuration"))}</label><input class="input" name="duration" type="number" min="0" step="5" inputmode="numeric" value="${previous?.durationSec ?? 30}"></div>`;
      else fields = `<div class="form-two"><div class="field"><label>${escapeHtml(this.text("defaultDistance"))}</label><input class="input" name="distance" type="number" min="0" step="0.1" inputmode="decimal" value="${previous?.distanceKm ?? 1}"></div><div class="field"><label>${escapeHtml(this.text("defaultTime"))}</label><input class="input" name="minutes" type="number" min="0" step="1" inputmode="numeric" value="${previous?.durationSec !== undefined ? Math.round(previous.durationSec / 60) : 10}"></div></div>`;
    } else if (profile === "rounds") {
      const rounds = clamp(previousEntry?.sets.length ?? 3, 1, 12);
      const restSec = Math.max(0, previousEntry?.restSec ?? 60);
      structureFields = `<div class="form-two"><div class="field"><label>${this.locale === "zh-TW" ? "回合數" : "Rounds"}</label><input class="input" name="sets" type="number" min="1" max="12" step="1" inputmode="numeric" value="${rounds}"></div><div class="field"><label>${this.locale === "zh-TW" ? "回合間休息（秒）" : "Rest between rounds (sec)"}</label><input class="input" name="rest" type="number" min="0" max="900" step="5" inputmode="numeric" value="${restSec}"></div></div>`;
      fields = `<div class="field"><label>${this.locale === "zh-TW" ? "每回合時間（秒）" : "Seconds per round"}</label><input class="input" name="duration" type="number" min="10" max="3600" step="5" inputmode="numeric" value="${previous?.durationSec ?? 180}"></div>`;
    } else if (profile === "mobility_session") {
      fields = `<div class="field"><label>${this.locale === "zh-TW" ? "預計時間（分鐘）" : "Planned duration (min)"}</label><input class="input" name="minutes" type="number" min="1" max="240" step="1" inputmode="numeric" value="${previous?.durationSec !== undefined ? Math.max(1, Math.round(previous.durationSec / 60)) : 10}"></div>`;
    } else {
      const sessionFields: string[] = [
        `<div class="field"><label>${this.locale === "zh-TW" ? "預計時間（分鐘）" : "Planned duration (min)"}</label><input class="input" name="minutes" type="number" min="1" max="1440" step="1" inputmode="numeric" value="${previous?.durationSec !== undefined ? Math.max(1, Math.round(previous.durationSec / 60)) : 30}"></div>`
      ];
      if (metrics.distance) sessionFields.push(`<div class="field"><label>${this.locale === "zh-TW" ? "距離（km）" : "Distance (km)"}</label><input class="input" name="distance" type="number" min="0" step="0.01" inputmode="decimal" value="${previous?.distanceKm ?? ""}"></div>`);
      if (metrics.speed) sessionFields.push(`<div class="field"><label>${this.locale === "zh-TW" ? "速度（km/h）" : "Speed (km/h)"}</label><input class="input" name="speed" type="number" min="0" max="80" step="0.1" inputmode="decimal" value="${previous?.speedKph ?? ""}"></div>`);
      if (metrics.incline) sessionFields.push(`<div class="field"><label>${this.locale === "zh-TW" ? "坡度（%）" : "Incline (%)"}</label><input class="input" name="incline" type="number" min="-10" max="40" step="0.5" inputmode="decimal" value="${previous?.inclinePct ?? 0}"></div>`);
      if (metrics.resistance) sessionFields.push(`<div class="field"><label>${this.locale === "zh-TW" ? "阻力／等級" : "Resistance / level"}</label><input class="input" name="resistance" type="number" min="0" max="100" step="1" inputmode="numeric" value="${previous?.resistanceLevel ?? ""}"></div>`);
      if (metrics.laps) sessionFields.push(`<div class="field"><label>${this.locale === "zh-TW" ? "趟數（選填）" : "Laps (optional)"}</label><input class="input" name="laps" type="number" min="0" max="10000" step="1" inputmode="numeric" value="${previous?.laps ?? ""}"></div>`);
      fields = `<div class="session-field-grid">${sessionFields.join("")}</div>`;
    }

    return `<form id="add-exercise-form" class="composer-card">
      <div class="composer-title-row"><div><div class="section-title">${escapeHtml(this.text("addExercise"))}</div><div class="small muted">${escapeHtml(this.text("addExerciseHint"))}</div></div></div>
      <div class="field"><label>${this.locale === "zh-TW" ? "運動類型" : "Exercise type"}</label><select class="select" id="exercise-type-filter">${this.renderExerciseTypeOptions()}</select></div>
      <div class="field"><label>${escapeHtml(this.text("chooseExercise"))}</label><select class="select select-large" id="exercise-picker" name="exerciseId">${this.renderExerciseOptions()}</select></div>
      <div class="exercise-preview-card compact-preview"><div><span>${escapeHtml(this.exercisePreviewHint(definition))}</span>${focus ? `<small class="exercise-focus-preview">${escapeHtml(focus)}</small>` : ""}</div><a class="exercise-example-link" href="${escapeHtml(this.exerciseImageSearchUrl(definition))}" target="_blank" rel="noopener noreferrer">${this.locale === "zh-TW" ? "查看圖片示範" : "View image examples"}</a></div>
      ${previousHint}
      ${structureFields}
      ${fields}
      <button class="btn primary full touch" type="submit">${icon("plus")} ${escapeHtml(this.text("addToWorkout"))}</button>
    </form>`;
  }

  private renderWorkout(): string {
    const workout = this.state.activeWorkout;
    if (!workout) { queueMicrotask(() => this.navigate("home")); return ""; }
    const canRepeat = this.state.workouts.some(item => item.completedAt);
    const editingExisting = this.state.workouts.some(item => item.id === workout.id);
    const isCircuit = workout.routineMode === "circuit";
    const body = workout.exercises.length === 0
      ? `<div class="empty-workout"><div class="empty-icon">${icon("dumbbell")}</div><div class="strong">${escapeHtml(this.text("noExercises"))}</div><div class="medium muted">${escapeHtml(this.text("noExercisesHint"))}</div>${canRepeat ? `<button class="btn" data-action="repeat-last">${escapeHtml(this.text("repeatLast"))}</button>` : ""}</div>`
      : isCircuit ? this.renderCircuitRounds(workout) : workout.exercises.map((exercise, exerciseIndex) => this.renderActiveExercise(workout, exercise, exerciseIndex)).join("");
    return `<div class="workout-header"><button class="btn ghost touch" data-action="back-workout">${icon("back")} ${escapeHtml(this.text("back"))}</button><div class="save-status"><span class="save-dot"></span>${escapeHtml(editingExisting ? this.text("historicalEdit") : this.text("liveWorkout"))}</div></div>
      <div class="workout-title-row"><div class="field workout-name-field"><label>${escapeHtml(this.text("workoutName"))}</label><input class="title-input" id="workout-name" maxlength="60" value="${escapeHtml(workout.routineName)}"></div></div>
      ${editingExisting ? `<div class="edit-mode-banner">${escapeHtml(this.text("historicalEdit"))}. ${this.locale === "zh-TW" ? "修改紀錄不會啟動休息計時；儲存後會標示為已編輯。" : "Editing saved records never starts a rest timer; saved changes are marked as edited."}</div><div class="card historical-time-editor"><div class="form-two"><label class="field"><span>${this.locale === "zh-TW" ? "開始日期與時間" : "Start date & time"}</span><input class="input date-input" id="workout-start-at" type="datetime-local" max="${this.toDateTimeLocal(new Date().toISOString())}" value="${escapeHtml(this.toDateTimeLocal(workout.startedAt))}"></label><label class="field"><span>${this.locale === "zh-TW" ? "結束日期與時間" : "End date & time"}</span><input class="input date-input" id="workout-end-at" type="datetime-local" max="${this.toDateTimeLocal(new Date().toISOString())}" value="${escapeHtml(this.toDateTimeLocal(workout.completedAt ?? undefined))}"></label></div>${workout.editedAt ? `<div class="tiny edited-note">${escapeHtml(this.editedText(workout.editedAt))}</div>` : ""}</div>` : ""}
      ${isCircuit ? `<div class="circuit-mode-banner"><strong>${this.locale === "zh-TW" ? "循環訓練" : "Circuit"}</strong><span>${workout.circuitRounds ?? 1} ${this.locale === "zh-TW" ? "輪：每輪依序完成所有動作。" : "rounds: complete every movement in order, then repeat."}</span></div>` : ""}
      ${!editingExisting && (this.state.routines?.length ?? 0) ? `<div class="card routine-loader"><div><strong>${escapeHtml(this.text("savedRoutines"))}</strong><div class="small muted">${escapeHtml(this.text("routineHint"))}</div></div><div class="routine-load-row"><select class="select" id="routine-picker">${this.state.routines!.map(r=>`<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}${r.mode === "circuit" ? ` · ${r.rounds ?? 3} rounds` : ""}</option>`).join("")}</select><button class="btn" data-action="load-routine">${escapeHtml(this.text("loadRoutine"))}</button><button class="icon-btn subtle-danger" data-action="delete-picked-routine" aria-label="${this.locale === "zh-TW" ? "刪除此訓練" : "Delete this routine"}">${icon("trash")}</button></div></div>` : ""}
      ${body}
      ${isCircuit ? "" : `<section class="section">${this.renderExerciseComposer()}</section>`}
      <section class="section"><div class="card media-upload-card"><div><strong>${this.locale === "zh-TW" ? "運動照片（選填）" : "Workout photo (optional)"}</strong><div class="small muted">${this.locale === "zh-TW" ? "測試版只存在這台裝置；圖片會壓縮並移除相機 EXIF 中繼資料。" : "Demo-only local storage. Images are compressed and re-encoded, stripping camera EXIF metadata."}</div></div>${workout.photoId ? this.privateImage(workout.photoId,"workout-photo-preview",workout.routineName) : ""}<label class="btn small file-button">${workout.photoId ? (this.locale === "zh-TW" ? "更換照片" : "Replace photo") : (this.locale === "zh-TW" ? "選擇照片" : "Choose photo")}<input id="workout-photo-input" type="file" accept="image/*" hidden></label></div></section>
      <div class="field section"><label>${escapeHtml(this.text("notes"))}</label><textarea class="textarea" id="workout-notes" maxlength="600" placeholder="${this.locale === "zh-TW" ? "選填" : "Optional"}">${escapeHtml(workout.notes)}</textarea></div>
      ${editingExisting ? `<div class="finish-bar"><div><div class="strong">${workout.exercises.length} ${escapeHtml(this.text("exercises"))}</div><div class="small muted">${completedSetCount(workout)} ${escapeHtml(this.text("completedSets"))}</div></div><div class="finish-actions"><button class="btn primary touch" data-action="finish-workout">${escapeHtml(this.text("saveChanges"))}</button></div></div>` : ""}`;
  }

  private renderCircuitRounds(workout: WorkoutRecord): string {
    const rounds = Math.max(1, workout.circuitRounds ?? Math.max(...workout.exercises.map(ex => ex.sets.length), 1));
    const editingExisting = this.state.workouts.some(item => item.id === workout.id);
    const difficultyLabels = [this.text("veryEasy"), this.text("easy"), this.text("moderate"), this.text("hard"), this.text("veryHard")];
    return Array.from({length: rounds},(_,roundIndex)=>{
      const roundDone = this.roundCompleted(workout, roundIndex);
      const roundRpe = this.roundEffort(workout, roundIndex);
      const roundEffort = roundDone ? `<div class="circuit-round-rpe"><div><strong>${this.locale === "zh-TW" ? `第 ${roundIndex+1} 輪體感強度` : `Round ${roundIndex+1} effort`}</strong><span>${this.locale === "zh-TW" ? "整輪完成後再評分一次即可。1 = 很輕鬆，5 = 非常吃力" : "Set one rating for the whole round. 1 = very easy, 5 = very hard"}</span></div><div class="effort-scale">${difficultyLabels.map((label,index)=>`<button class="effort-btn ${roundRpe === index+1 ? "selected" : ""}" data-round-rpe="${index+1}" data-round-index="${roundIndex}" title="${escapeHtml(label)}">${index+1}</button>`).join("")}</div>${roundRpe ? `<div class="small muted">${escapeHtml(difficultyLabels[roundRpe-1] ?? "")}</div>` : ""}</div>` : "";
      const running = workout.exercises.some(exercise => exercise.sets.some(set => Boolean(set.startedAt)));
      const removeRound = !editingExisting && rounds > 1
        ? this.pendingCircuitRoundRemovalIndex === roundIndex
          ? `<button class="btn small danger-solid" data-remove-circuit-round="${roundIndex}">${this.locale === "zh-TW" ? "再按一次" : "Confirm"}</button>`
          : `<button class="btn small ghost danger" data-remove-circuit-round="${roundIndex}" data-running="${running ? "1" : "0"}">${this.locale === "zh-TW" ? "刪除這輪" : "Remove round"}</button>`
        : "";
      return `<section class="exercise-card circuit-round"><div class="exercise-head"><div><div class="exercise-name">${this.locale === "zh-TW" ? `第 ${roundIndex+1} 輪` : `Round ${roundIndex+1}`}</div><div class="exercise-rest">${workout.exercises.length} ${escapeHtml(this.text("exercises"))}</div></div>${removeRound}</div><div class="circuit-round-list">${workout.exercises.map((exercise,exerciseIndex)=>this.renderCircuitMovement(workout,exercise,exerciseIndex,roundIndex)).join("")}</div>${roundEffort}</section>`;
    }).join("");
  }

  private renderCircuitMovement(workout: WorkoutRecord, exercise: WorkoutExerciseEntry, exerciseIndex: number, roundIndex: number): string {
    const definition = exerciseById(exercise.exerciseId);
    const set = exercise.sets[roundIndex];
    if (!set) return "";
    const name = definition?.names[this.locale] ?? exercise.exerciseId;
    const durationText = this.setDurationText(set);
    let field = "";
    if (definition?.type === "reps") field = `<label class="mini-field"><span>${escapeHtml(this.text("reps"))}</span><input class="set-input" inputmode="numeric" type="number" min="0" step="1" value="${set.reps ?? ""}" data-set-field="reps" data-exercise-index="${exerciseIndex}" data-set-index="${roundIndex}"></label>`;
    else if (definition?.type === "duration") field = `<label class="mini-field"><span>${escapeHtml(this.text("seconds"))}</span><input class="set-input" type="number" min="0" step="5" value="${set.durationSec ?? ""}" data-set-field="duration" data-exercise-index="${exerciseIndex}" data-set-index="${roundIndex}"></label>`;
    else if (definition?.type === "weight_reps") field = `<label class="mini-field"><span>kg</span><input class="set-input" type="number" min="0" step="0.5" value="${set.weightKg ?? ""}" data-set-field="weight" data-exercise-index="${exerciseIndex}" data-set-index="${roundIndex}"></label><label class="mini-field"><span>${escapeHtml(this.text("reps"))}</span><input class="set-input" type="number" min="0" step="1" value="${set.reps ?? ""}" data-set-field="reps" data-exercise-index="${exerciseIndex}" data-set-index="${roundIndex}"></label>`;
    else field = `<label class="mini-field"><span>km</span><input class="set-input" type="number" min="0" step="0.1" value="${set.distanceKm ?? ""}" data-set-field="distance" data-exercise-index="${exerciseIndex}" data-set-index="${roundIndex}"></label><label class="mini-field"><span>${escapeHtml(this.text("minutes"))}</span><input class="set-input" type="number" min="0" step="1" value="${set.durationSec !== undefined ? Math.round(set.durationSec / 60) : ""}" data-set-field="minutes" data-exercise-index="${exerciseIndex}" data-set-index="${roundIndex}"></label>`;
    const editingExisting = this.state.workouts.some(item => item.id === workout.id);
    const locked = !editingExisting && set.completed && this.completedSetIsLocked(workout,set);
    const anotherSetActive = !editingExisting && workout.exercises.some(item => item.sets.some(candidate => candidate.id !== set.id && Boolean(candidate.startedAt) && !candidate.completed));
    const control = editingExisting ? "" : !set.startedAt && !set.completed
      ? `<button class="btn small primary set-state-btn start" data-start-set="1" data-exercise-index="${exerciseIndex}" data-set-index="${roundIndex}" ${anotherSetActive ? "disabled" : ""} title="${anotherSetActive ? (this.locale === "zh-TW" ? "請先完成目前進行中的一組" : "Finish the active set first") : ""}">${this.locale === "zh-TW" ? "開始" : "Start"}</button>`
      : !set.completed
        ? `<button class="btn small primary set-state-btn" data-toggle-set="1" data-exercise-index="${exerciseIndex}" data-set-index="${roundIndex}">${this.locale === "zh-TW" ? "完成" : "Finish"}</button>`
        : `<button class="btn small set-state-btn done ${locked ? "locked" : ""}" data-toggle-set="1" data-exercise-index="${exerciseIndex}" data-set-index="${roundIndex}" ${locked ? "disabled" : ""} title="${locked ? (this.locale === "zh-TW" ? "後續動作已開始，因此已鎖定" : "Locked because a later set has started") : ""}">${icon("check")} ${this.locale === "zh-TW" ? "完成" : "Done"}</button>`;
    const timingLine = set.startedAt
      ? `<small>${this.locale === "zh-TW" ? "開始" : "Started"} ${escapeHtml(this.formatTime(set.startedAt))}</small>${durationText ? `<small>${escapeHtml(this.text("duration"))} ${escapeHtml(durationText)}</small>` : ""}`
      : (this.previousSet(workout,exercise.exerciseId,roundIndex) ? `<small>${this.locale === "zh-TW" ? "上次" : "Last"}: ${escapeHtml(this.setSummary(definition,this.previousSet(workout,exercise.exerciseId,roundIndex)))}</small>` : "");
    return `<div class="circuit-movement ${set.completed ? "completed" : ""}"><div class="circuit-movement-name"><div class="row-start"><strong>${escapeHtml(name)}</strong>${!editingExisting ? `<button class="icon-btn subtle-danger circuit-remove-movement" data-remove-circuit-movement="${exerciseIndex}" aria-label="${this.locale === "zh-TW" ? "刪除動作" : "Remove movement"}">${icon("trash")}</button>` : ""}</div>${definition ? `<small>${escapeHtml(this.exercisePreviewHint(definition))} · <a class="exercise-example-link" href="${escapeHtml(this.exerciseImageSearchUrl(definition))}" target="_blank" rel="noopener noreferrer">${this.locale === "zh-TW" ? "圖片示範" : "Image examples"}</a></small>` : ""}${timingLine}</div><div class="set-fields">${field}</div>${control}</div>`;
  }

  private renderActiveExercise(workout: WorkoutRecord, exercise: WorkoutExerciseEntry, exerciseIndex: number): string {
    const definition = exerciseById(exercise.exerciseId);
    const name = definition?.names[this.locale] ?? exercise.exerciseId;
    const profile = definition ? exerciseLoggingProfile(definition) : "sets";
    const focus = this.exerciseFocusText(definition);
    const allCompleted = exercise.sets.length > 0 && exercise.sets.every(set => set.completed);
    const difficultyLabels = [this.text("veryEasy"), this.text("easy"), this.text("moderate"), this.text("hard"), this.text("veryHard")];
    const editingExisting = this.state.workouts.some(item => item.id === workout.id);
    const restControl = profile === "sets" || profile === "rounds"
      ? (editingExisting
        ? `<div class="exercise-rest">${escapeHtml(this.text("rest"))}: ${exercise.restSec}s</div>`
        : `<label class="inline-rest-control"><span>${escapeHtml(profile === "rounds" ? (this.locale === "zh-TW" ? "回合間休息" : "Round rest") : this.text("rest"))}</span><input type="number" min="0" max="900" step="5" value="${exercise.restSec}" data-rest-sec="${exerciseIndex}"><small>${this.locale === "zh-TW" ? "秒 · 0 = 正計時" : "sec · 0 = count up"}</small></label>`)
      : "";
    const addControl = profile === "sets"
      ? `<button class="btn small touch" data-add-set="${exerciseIndex}">${icon("plus")} ${escapeHtml(this.text("addSet"))}</button>`
      : profile === "rounds"
        ? `<button class="btn small touch" data-add-set="${exerciseIndex}">${icon("plus")} ${this.locale === "zh-TW" ? "新增回合" : "Add round"}</button>`
        : "";
    return `<section class="exercise-card regular-workout-card ${profile !== "sets" ? "session-exercise-card" : ""}">
      <div class="exercise-head"><div class="exercise-head-main"><div class="row-start"><div class="exercise-name">${escapeHtml(name)}</div>${!editingExisting ? `<button class="icon-btn subtle-danger exercise-remove-compact" data-remove-exercise="${exerciseIndex}" aria-label="${escapeHtml(this.text("removeExercise"))}" title="${escapeHtml(this.text("removeExercise"))}">${icon("trash")}</button>` : ""}</div>${definition ? `<div class="exercise-meta-line">${escapeHtml(this.exercisePreviewHint(definition))} · <a class="exercise-example-link" href="${escapeHtml(this.exerciseImageSearchUrl(definition))}" target="_blank" rel="noopener noreferrer">${this.locale === "zh-TW" ? "圖片示範" : "Image examples"}</a></div>${focus ? `<div class="exercise-focus-line">${escapeHtml(focus)}</div>` : ""}` : ""}${restControl}${exercise.startedAt ? `<div class="tiny muted">${this.formatTime(exercise.startedAt)}${exercise.completedAt ? `–${this.formatTime(exercise.completedAt)}` : ""}</div>` : ""}</div>${editingExisting ? `<button class="icon-btn danger" data-remove-exercise="${exerciseIndex}" aria-label="${escapeHtml(this.text("removeExercise"))}" title="${escapeHtml(this.text("removeExercise"))}">${icon("trash")}</button>` : ""}</div>
      <div class="set-list regular-set-list">${exercise.sets.map((set, setIndex) => this.renderSetRow(workout, definition, exerciseIndex, setIndex, set)).join("")}</div>
      ${allCompleted ? `<div class="effort-prompt"><div><strong>${escapeHtml(this.text("effortPrompt"))}</strong><span>${this.locale === "zh-TW" ? "1 = 很輕鬆，5 = 非常吃力" : "1 = very easy, 5 = very hard"}</span></div><div class="effort-scale">${difficultyLabels.map((label,index)=>`<button class="effort-btn ${exercise.difficulty === index+1 ? "selected" : ""}" data-difficulty="${index+1}" data-exercise-index="${exerciseIndex}" title="${escapeHtml(label)}">${index+1}</button>`).join("")}</div>${exercise.difficulty ? `<div class="small muted">${escapeHtml(difficultyLabels[exercise.difficulty-1] ?? "")}</div>` : ""}</div>` : ""}
      ${addControl ? `<div class="exercise-actions">${addControl}</div>` : ""}
    </section>`;
  }

  private renderSetRow(workout: WorkoutRecord, definition: ExerciseDefinition | undefined, exerciseIndex: number, setIndex: number, set: SetEntry): string {
    const exercise = workout.exercises[exerciseIndex];
    if (!exercise) return "";
    const profile = definition ? exerciseLoggingProfile(definition) : "sets";
    const metrics = definition ? exerciseSessionMetricFlags(definition) : { distance:false, speed:false, incline:false, resistance:false, laps:false };
    const previous = this.previousSet(workout, exercise.exerciseId, setIndex);
    const previousText = this.setSummary(definition, previous);
    const durationText = this.setDurationText(set);
    let fields = "";
    if (profile === "cardio_session") {
      const pieces = [`<label class="mini-field"><span>${escapeHtml(this.text("minutes"))}</span><input class="set-input" inputmode="numeric" type="number" min="0" step="1" value="${set.durationSec !== undefined ? Math.round(set.durationSec / 60) : ""}" data-set-field="minutes" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}"></label>`];
      if (metrics.distance) pieces.push(`<label class="mini-field"><span>km</span><input class="set-input" inputmode="decimal" type="number" min="0" step="0.01" value="${set.distanceKm ?? ""}" data-set-field="distance" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}"></label>`);
      if (metrics.speed) pieces.push(`<label class="mini-field"><span>km/h</span><input class="set-input" inputmode="decimal" type="number" min="0" max="80" step="0.1" value="${set.speedKph ?? ""}" data-set-field="speed" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}"></label>`);
      if (metrics.incline) pieces.push(`<label class="mini-field"><span>${this.locale === "zh-TW" ? "坡度 %" : "Incline %"}</span><input class="set-input" inputmode="decimal" type="number" min="-10" max="40" step="0.5" value="${set.inclinePct ?? 0}" data-set-field="incline" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}"></label>`);
      if (metrics.resistance) pieces.push(`<label class="mini-field"><span>${this.locale === "zh-TW" ? "阻力" : "Level"}</span><input class="set-input" inputmode="numeric" type="number" min="0" max="100" step="1" value="${set.resistanceLevel ?? ""}" data-set-field="resistance" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}"></label>`);
      if (metrics.laps) pieces.push(`<label class="mini-field"><span>${this.locale === "zh-TW" ? "趟" : "Laps"}</span><input class="set-input" inputmode="numeric" type="number" min="0" step="1" value="${set.laps ?? ""}" data-set-field="laps" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}"></label>`);
      fields = pieces.join("");
    } else if (profile === "mobility_session") {
      fields = `<label class="mini-field"><span>${escapeHtml(this.text("minutes"))}</span><input class="set-input" inputmode="numeric" type="number" min="0" step="1" value="${set.durationSec !== undefined ? Math.round(set.durationSec / 60) : ""}" data-set-field="minutes" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}"></label>`;
    } else if (profile === "rounds") {
      fields = `<label class="mini-field"><span>${escapeHtml(this.text("seconds"))}</span><input class="set-input" inputmode="numeric" type="number" min="0" step="5" value="${set.durationSec ?? ""}" data-set-field="duration" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}"></label>`;
    } else if (definition?.type === "reps") fields = `<label class="mini-field"><span>${escapeHtml(this.text("reps"))}</span><input class="set-input" inputmode="numeric" type="number" min="0" step="1" value="${set.reps ?? ""}" data-set-field="reps" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}"></label>`;
    else if (definition?.type === "duration") fields = `<label class="mini-field"><span>${escapeHtml(this.text("seconds"))}</span><input class="set-input" inputmode="numeric" type="number" min="0" step="5" value="${set.durationSec ?? ""}" data-set-field="duration" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}"></label>`;
    else if (definition?.type === "distance_time") fields = `<label class="mini-field"><span>km</span><input class="set-input" inputmode="decimal" type="number" min="0" step="0.1" value="${set.distanceKm ?? ""}" data-set-field="distance" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}"></label><label class="mini-field"><span>${escapeHtml(this.text("minutes"))}</span><input class="set-input" inputmode="numeric" type="number" min="0" step="1" value="${set.durationSec !== undefined ? Math.round(set.durationSec / 60) : ""}" data-set-field="minutes" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}"></label>`;
    else fields = `<label class="mini-field"><span>${escapeHtml(this.text("weight"))}</span><input class="set-input" inputmode="decimal" type="number" min="0" step="0.5" value="${set.weightKg ?? ""}" data-set-field="weight" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}"></label><label class="mini-field"><span>${escapeHtml(this.text("reps"))}</span><input class="set-input" inputmode="numeric" type="number" min="0" step="1" value="${set.reps ?? ""}" data-set-field="reps" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}"></label>`;
    const editingExisting = this.state.workouts.some(item => item.id === workout.id);
    const locked = !editingExisting && set.completed && this.completedSetIsLocked(workout, set);
    const anotherSetActive = !editingExisting && workout.exercises.some(item => item.sets.some(candidate => candidate.id !== set.id && Boolean(candidate.startedAt) && !candidate.completed));
    const completionControl = editingExisting ? "" : !set.startedAt && !set.completed
      ? `<button class="btn small primary set-state-btn start" data-start-set="1" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}" ${anotherSetActive ? "disabled" : ""} title="${anotherSetActive ? (this.locale === "zh-TW" ? "請先完成目前進行中的一組" : "Finish the active set first") : ""}">${this.locale === "zh-TW" ? "開始" : "Start"}</button>`
      : !set.completed
        ? `<button class="btn small primary set-state-btn" data-toggle-set="1" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}">${this.locale === "zh-TW" ? "完成" : "Finish"}</button>`
        : `<button class="btn small set-state-btn done ${locked ? "locked" : ""}" data-toggle-set="1" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}" ${locked ? "disabled" : ""} title="${locked ? (this.locale === "zh-TW" ? "下一組已開始，因此這組已鎖定" : "Locked because a later set has started") : (this.locale === "zh-TW" ? "點一下可改回未完成" : "Tap to mark unfinished")}">${icon("check")} ${this.locale === "zh-TW" ? "完成" : "Done"}</button>`;
    const timing = set.startedAt
      ? `<div class="previous-line"><span>${this.locale === "zh-TW" ? "開始" : "Started"}</span> ${escapeHtml(this.formatTime(set.startedAt))}</div>${durationText ? `<div class="set-duration-line"><span>${escapeHtml(this.text("duration"))}</span> ${escapeHtml(durationText)}</div>` : ""}`
      : `<div class="previous-line"><span>${escapeHtml(this.text("previous"))}</span> ${escapeHtml(previousText)}</div>`;
    const removalKey = `${exerciseIndex}:${setIndex}`;
    const running = workout.exercises.some(item => item.sets.some(candidate => Boolean(candidate.startedAt)));
    const removableProfile = profile === "sets" || profile === "rounds";
    const canRemove = removableProfile && (editingExisting || !set.completed);
    const removalControl = !canRemove ? `<span class="set-remove-slot" aria-hidden="true"></span>`
      : this.pendingSetRemovalKey === removalKey
        ? `<button class="btn small danger-solid set-remove-confirm" data-remove-set="1" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}">${this.locale === "zh-TW" ? "再按一次" : "Confirm"}</button>`
        : `<button class="icon-btn subtle-danger set-remove-icon" data-remove-set="1" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}" data-running="${running ? "1" : "0"}" aria-label="${this.locale === "zh-TW" ? (profile === "rounds" ? "移除回合" : "移除這組") : (profile === "rounds" ? "Remove round" : "Remove set")}" title="${this.locale === "zh-TW" ? (profile === "rounds" ? "移除回合" : "移除這組") : (profile === "rounds" ? "Remove round" : "Remove set")}">${icon("trash")}</button>`;
    const rowLabel = profile === "rounds" ? `R${setIndex + 1}` : profile === "cardio_session" ? "C" : profile === "mobility_session" ? "M" : workout.routineMode === "circuit" ? `R${setIndex + 1}` : String(setIndex + 1);
    return `<div class="set-row compact-set-row ${profile !== "sets" ? "session-set-row" : ""} ${set.completed ? "completed" : ""} ${editingExisting ? "history-edit-set" : ""}">
      <div class="set-number" title="${profile === "cardio_session" ? (this.locale === "zh-TW" ? "有氧" : "Cardio session") : profile === "mobility_session" ? (this.locale === "zh-TW" ? "活動度" : "Mobility session") : ""}">${rowLabel}</div>
      <div class="set-remove-left">${removalControl}</div>
      <div class="set-content">${timing}<div class="set-fields ${profile === "cardio_session" ? "session-metric-fields" : ""}">${fields}</div></div>
      ${completionControl}
    </div>`;
  }

  private renderHike(): string {
    const existing = this.editingHikeId ? this.state.hikes.find(item => item.id === this.editingHikeId) : undefined;
    const today = existing?.date ?? new Date().toISOString().slice(0, 10);
    const routePreview = existing?.routePoints?.length ? `<div id="gpx-preview" class="gpx-preview">${this.routeTrace(existing.routePoints,"route-preview-trace")}<div class="tiny muted">${this.locale === "zh-TW" ? "目前已保存 GPS 路線；重新選擇 GPX 會取代這條路線。" : "A GPS route is already saved. Choosing another GPX will replace it."}</div></div>` : `<div id="gpx-preview" class="gpx-preview" hidden></div>`;
    return `<div class="workout-header"><button class="btn ghost touch" data-action="${existing ? "back-history" : "back-home"}">${icon("back")} ${escapeHtml(this.text("back"))}</button></div>
      <h1 class="page-title">${existing ? (this.locale === "zh-TW" ? "編輯健行" : "Edit hike") : escapeHtml(this.text("logHike"))}</h1><p class="page-subtitle">${this.locale === "zh-TW" ? "這裡用來保存健行紀錄；登山導航仍建議使用專門的導航 App。" : "Keep the hike record here; use a dedicated navigation app on the trail."}</p><p class="tiny muted badge-warning">${this.locale === "zh-TW" ? "健行徽章目前沒有山峰／路線資料庫，只會依你輸入的路線名稱判斷第一次紀錄。" : "Hiking badges do not use a summit/route database yet; first completion is currently based on the route name you type."}</p>
      <form id="hike-form" class="card form-grid">
        <div class="gpx-import-box"><div><strong>${this.locale === "zh-TW" ? "匯入 GPS 路線（選填）" : "Import GPS route (optional)"}</strong><div class="tiny muted">${this.locale === "zh-TW" ? "支援 Garmin Connect／Garmin Explore 匯出的 GPX。測試版會讀取路線、距離與海拔；FIT／TCX 之後再支援。" : "Supports GPX exported from Garmin Connect / Garmin Explore. The prototype reads the route, distance and elevation; FIT/TCX can come later."}</div></div><label class="btn small">${this.locale === "zh-TW" ? "選擇 GPX" : "Choose GPX"}<input id="gpx-input" type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" hidden></label></div>
        ${routePreview}
        <div class="field"><label>${escapeHtml(this.text("hikeName"))}</label><input class="input" name="name" required maxlength="80" placeholder="Elephant Mountain / 象山" value="${escapeHtml(existing?.name ?? "")}"></div>
        <div class="form-two"><div class="field"><label>${escapeHtml(this.text("date"))}</label><input class="input date-input" name="date" type="date" max="${localDateKey(new Date())}" value="${escapeHtml(today)}" required></div><div class="field"><label>${this.locale === "zh-TW" ? "開始時間" : "Start time"}</label><input class="input date-input" name="startTime" type="time" value="${escapeHtml(existing?.startedAt ? this.toDateTimeLocal(existing.startedAt).slice(11,16) : this.toDateTimeLocal(new Date().toISOString()).slice(11,16))}"></div></div>${existing?.editedAt ? `<div class="tiny edited-note">${escapeHtml(this.editedText(existing.editedAt))}</div>` : ""}
        <div class="field"><label>${escapeHtml(this.text("distance"))}</label><input class="input" name="distance" type="number" min="0" step="0.01" required value="${existing?.distanceKm ?? ""}"></div>
        <div class="form-two"><div class="field"><label>${escapeHtml(this.text("movingTime"))}</label><input class="input" name="moving" type="number" min="0" step="1" required value="${existing?.movingMinutes ?? ""}"></div><div class="field"><label>${escapeHtml(this.text("elapsedTime"))}</label><input class="input" name="elapsed" type="number" min="0" step="1" required value="${existing?.elapsedMinutes ?? ""}"></div></div>
        <div class="form-two"><div class="field"><label>${escapeHtml(this.text("elevationGain"))}</label><input class="input" name="gain" type="number" min="0" step="1" value="${existing?.elevationGainM ?? 0}"></div><div class="field"><label>${escapeHtml(this.text("elevationLoss"))}</label><input class="input" name="loss" type="number" min="0" step="1" value="${existing?.elevationLossM ?? 0}"></div></div>
        <div class="field"><label>${this.locale === "zh-TW" ? "最高點（公尺，選填）" : "Highest point (m, optional)"}</label><input class="input" name="highest" type="number" step="1" value="${existing?.highestPointM ?? ""}"></div>
        <div class="field"><label>${escapeHtml(this.text("difficulty"))}</label><select class="select" name="difficulty">${[1,2,3,4,5].map(value=>`<option value="${value}" ${value === (existing?.difficulty ?? 3) ? "selected" : ""}>${value}${value===1 ? " — Easy" : value===3 ? " — Moderate" : value===5 ? " — Hard" : ""}</option>`).join("")}</select></div>
        <div class="field"><label>${escapeHtml(this.text("notes"))}</label><textarea class="textarea" name="notes" maxlength="600">${escapeHtml(existing?.notes ?? "")}</textarea></div>
        <div class="field"><label>${this.locale === "zh-TW" ? "登頂／路線照片（選填）" : "Summit / route photo (optional)"}</label>${existing?.photoId ? `<div class="tiny muted">${this.locale === "zh-TW" ? "已有照片；選擇新照片會取代它。" : "A photo is already saved; choosing a new one will replace it."}</div>` : ""}<input class="input" id="hike-photo-input" type="file" accept="image/*"></div>
        <button class="btn primary touch" type="submit">${existing ? escapeHtml(this.text("saveChanges")) : escapeHtml(this.text("saveHike"))}</button>
      </form>`;
  }

  private renderWeightReminder(): string {
    const action = this.weightReminderAction;
    if (!action) return "";
    const latest = this.latestWeightEntry();
    const title = this.locale === "zh-TW" ? "快速確認體重" : "Quick weight check";
    const body = latest
      ? (this.locale === "zh-TW" ? `你上次記錄是 ${latest.kg} kg。每月確認一次可讓熱量估算更合理。` : `Your last recorded weight is ${latest.kg} kg. A quick monthly check keeps calorie estimates more useful.`)
      : (this.locale === "zh-TW" ? "LogTogether 需要體重才能較合理地估算運動熱量。你目前還沒有體重紀錄。" : "LogTogether uses your weight to make exercise-calorie estimates more useful. You do not have a weight recorded yet.");
    return `<div class="modal-backdrop" role="presentation"><section class="confirm-dialog weight-reminder-dialog" role="dialog" aria-modal="true" aria-labelledby="weight-check-title"><div class="dialog-icon">${icon("dumbbell")}</div><h2 id="weight-check-title">${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p><div class="dialog-actions weight-dialog-actions"><button class="btn touch" data-weight-update>${this.locale === "zh-TW" ? "更新體重" : "Update weight"}</button>${latest ? `<button class="btn primary touch" data-weight-confirm>${this.locale === "zh-TW" ? `仍是 ${latest.kg} kg` : `Still ${latest.kg} kg`}</button>` : `<button class="btn ghost touch" data-weight-skip>${this.locale === "zh-TW" ? "暫時略過" : "Continue without weight"}</button>`}</div>${latest ? `<button class="btn ghost small weight-skip-link" data-weight-skip>${this.locale === "zh-TW" ? "這次先略過" : "Skip for now"}</button>` : ""}</section></div>`;
  }

  private renderConfirmation(): string {
    if (!this.confirmAction) return "";
    let title = "";
    let hint = this.text("destructiveHint");
    let actionLabel = this.text("delete");
    let destructive = true;
    if (this.confirmAction.kind === "delete-workout") title = this.text("confirmDeleteWorkout");
    else if (this.confirmAction.kind === "delete-hike") title = this.text("confirmDeleteHike");
    else if (this.confirmAction.kind === "discard-active") title = this.text("confirmDiscard");
    else if (this.confirmAction.kind === "delete-routine") title = this.locale === "zh-TW" ? "刪除這個已儲存訓練？" : "Delete this saved routine?";
    else if (this.confirmAction.kind === "revoke-member") {
      title = this.locale === "zh-TW" ? `移除 ${this.confirmAction.name} 的家庭權限？` : `Remove ${this.confirmAction.name}'s family access?`;
      hint = this.locale === "zh-TW" ? "對方會立即失去家庭資料存取權。紀錄會保留為已撤銷，因此之後仍可恢復。" : "They will immediately lose access to family data. The authorization record stays revoked so you can restore it later.";
      actionLabel = this.locale === "zh-TW" ? "移除權限" : "Remove access";
    } else title = this.text("confirmRemoveExercise");
    return `<div class="modal-backdrop" role="presentation"><section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><div class="dialog-icon">${icon("trash")}</div><h2 id="confirm-title">${escapeHtml(title)}</h2><p>${escapeHtml(hint)}</p><div class="dialog-actions"><button class="btn touch" data-confirm-cancel>${escapeHtml(this.text("cancel"))}</button><button class="btn ${destructive ? "danger-solid" : "primary"} touch" data-confirm-accept>${escapeHtml(actionLabel)}</button></div></section></div>`;
  }

  private bindGlobalEvents(): void {
    root.querySelectorAll<HTMLElement>('[data-action="google-sign-in"]').forEach(node => node.addEventListener("click", async () => {
      this.cloudAccessRequested = true;
      try {
        await this.initializeAuthentication();
        await signInWithGoogle();
      }
      catch (error) { this.authError = error instanceof Error ? error.message : "Google sign-in failed"; this.render(); }
    }));
    root.querySelector('[data-action="google-sign-out"]')?.addEventListener("click", async () => {
      forgetRememberedOfflineAccount();
      this.offlineAccount = null;
      rememberLocalScope(this.localScope || "guest");
      this.cloudMembership = null;
      this.clearSharedCloudSnapshots();
      this.cloudMembershipError = null;
      this.cloudAccessRequested = Boolean(this.pendingInviteCode);
      try { await signOutFirebase(); }
      catch (error) { this.toast(error instanceof Error ? error.message : "Sign out failed"); }
      this.authUser = null;
      this.render();
    });
    root.querySelector('[data-action="export-local-backup"]')?.addEventListener("click", () => {
      try {
        const payload = createLocalBackup(this.state, this.localScope || "local");
        const blob = new Blob([payload], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `logtogether-backup-${localDateKey(new Date())}.json`;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        this.toast(this.locale === "zh-TW" ? "本機備份已匯出" : "Local backup exported");
      } catch (error) {
        this.toast(error instanceof Error ? error.message : "Backup export failed");
      }
    });
    root.querySelector('[data-action="export-diagnostics"]')?.addEventListener("click", () => {
      try {
        const appCheck = appCheckRuntimeStatus();
        const errorAreas = [
          this.authError ? "auth" : "",
          this.cloudMembershipError ? "membership" : "",
          this.cloudWorkoutError ? "workouts" : "",
          this.cloudHikeError ? "hikes" : "",
          this.cloudCompanionError ? "companion" : ""
        ].filter(Boolean);
        const payload = diagnosticsJson(this.state, {
          appVersion: APP_VERSION,
          storageBackend: localStructuredStorageBackend(this.localScope || undefined),
          cloudMode: cloudModeEnabled(),
          online: this.networkOnline,
          signedIn: Boolean(this.authUser),
          rememberedOfflineAccount: Boolean(this.offlineAccount),
          familyActive: this.cloudMembership?.access.status === "active",
          pendingCloudChanges: this.pendingCloudChangesCount(),
          cloudErrorAreas: errorAreas,
          appCheckState: appCheck.state,
          appCheckProvider: appCheck.provider
        });
        const blob = new Blob([payload], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `logtogether-diagnostics-${localDateKey(new Date())}.json`;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        this.toast(this.locale === "zh-TW" ? "診斷檔已匯出" : "Diagnostics exported");
      } catch (error) {
        this.toast(error instanceof Error ? error.message : "Diagnostics export failed");
      }
    });
    root.querySelector<HTMLInputElement>("#local-backup-import")?.addEventListener("change", async event => {
      const input = event.currentTarget as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      const confirmed = window.confirm(this.locale === "zh-TW"
        ? "匯入會取代這台裝置目前帳號的結構化資料。要繼續嗎？"
        : "Import will replace the structured data for the current account on this device. Continue?");
      if (!confirmed) { input.value = ""; return; }
      try {
        const expectedUid = this.localScope.startsWith("uid:") ? this.localScope.slice(4) : undefined;
        const imported = parseLocalBackup(await file.text(), expectedUid);
        saveImportRollback(this.state, this.localScope || "guest");
        this.state = imported;
        this.ensureExtendedState();
        this.persist();
        this.applyTheme();
        this.render();
        this.toast(this.locale === "zh-TW" ? "備份已匯入這台裝置" : "Backup imported to this device");
      } catch (error) {
        this.toast(error instanceof Error ? error.message : "Backup import failed");
      } finally {
        input.value = "";
      }
    });
    root.querySelectorAll<HTMLElement>("[data-nav]").forEach(node => node.addEventListener("click", () => {
      const page = node.dataset.nav as Page;
      if (page === "history") { const now = new Date(); this.selectedCalendarDate = localDateKey(now); this.calendarMonth = new Date(now.getFullYear(), now.getMonth(), 1); }
      if (page === "home") this.workoutTrendWeekOffset = 0;
      if (page === "water") { const now = new Date(); this.selectedWaterDate = localDateKey(now); this.waterCalendarMonth = new Date(now.getFullYear(), now.getMonth(), 1); this.waterWeekOffset = 0; }
      this.navigate(page);
    }));
    root.querySelector('[data-action="go-home"]')?.addEventListener("click", () => this.navigate("home"));
    root.querySelectorAll<HTMLElement>("[data-weekly-trend-nav]").forEach(node => node.addEventListener("click", () => {
      const delta = node.dataset.weeklyTrendNav === "prev" ? -1 : 1;
      this.workoutTrendWeekOffset = Math.min(0, this.workoutTrendWeekOffset + delta);
      this.render();
    }));
    root.querySelectorAll<HTMLElement>("[data-water-week-nav]").forEach(node => node.addEventListener("click", () => {
      const delta = node.dataset.waterWeekNav === "prev" ? -1 : 1;
      this.waterWeekOffset = Math.min(0, this.waterWeekOffset + delta);
      this.render();
    }));
    root.querySelector<HTMLSelectElement>("#text-scale-select")?.addEventListener("change", event => {
      const value = clamp(Math.round(Number((event.currentTarget as HTMLSelectElement).value) / 10) * 10, 100, 140);
      this.state.textScale = value;
      this.state.largeText = value > 100;
      this.applyTheme(); this.persist(); this.render();
    });
    root.querySelector('[data-action="open-family-settings"]')?.addEventListener("click", () => this.navigate("settings"));
    root.querySelector('[data-action="start-workout"]')?.addEventListener("click", () => this.requestWeightCheck({ kind: "workout" }));
    root.querySelectorAll<HTMLElement>("[data-start-routine]").forEach(node => node.addEventListener("click", () => {
      const routineId = node.dataset.startRoutine;
      if (routineId) this.requestWeightCheck({ kind: "routine", routineId });
    }));
    root.querySelectorAll<HTMLElement>("[data-delete-routine]").forEach(node => node.addEventListener("click", event => { event.stopPropagation(); const id=node.dataset.deleteRoutine; if(id){ this.confirmAction={kind:"delete-routine",id}; this.render(); } }));
    root.querySelectorAll<HTMLElement>('[data-action="continue-workout"]').forEach(node => node.addEventListener("click", () => this.navigate("workout")));
    root.querySelectorAll<HTMLElement>('[data-action="discard-workout"]').forEach(node => node.addEventListener("click", () => { this.confirmAction = { kind: "discard-active" }; this.render(); }));
    root.querySelector('[data-action="log-hike"]')?.addEventListener("click", () => this.requestWeightCheck({ kind: "hike" }));
    root.querySelector('[data-action="back-home"]')?.addEventListener("click", () => this.navigate("home"));
    root.querySelector('[data-action="back-history"]')?.addEventListener("click", () => { this.editingHikeId = null; this.pendingHikeGpx = null; this.navigate("history"); });
    root.querySelectorAll<HTMLElement>("[data-water]").forEach(node => node.addEventListener("click", () => {
      const ml = Number(node.dataset.water ?? 0);
      const now = new Date();
      this.state.hydration.entries.push({ id: uid("water"), at: now.toISOString(), ml });
      this.state.hydration.totalMl = this.state.hydration.entries.reduce((sum, item) => sum + item.ml, 0);
      this.selectedWaterDate = localDateKey(now);
      this.waterCalendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      this.persist(); this.render(); void this.pushHydrationToCloud(structuredClone(this.state.hydration));
    }));
    root.querySelectorAll<HTMLElement>("[data-remove-water]").forEach(node => node.addEventListener("click", () => {
      const id = node.dataset.removeWater;
      const date = node.dataset.waterEntryDate ?? this.selectedWaterDate;
      const day = this.hydrationDayForDate(date);
      if (!id || !day) return;
      day.entries = day.entries.filter(item => item.id !== id);
      day.totalMl = day.entries.reduce((sum, item) => sum + item.ml, 0);
      this.persist(); this.render(); void this.pushHydrationToCloud(structuredClone(day));
    }));
    root.querySelectorAll<HTMLElement>("[data-save-water-entry]").forEach(node => node.addEventListener("click", () => {
      const id = node.dataset.saveWaterEntry;
      const sourceDate = node.dataset.waterEntryDate ?? this.selectedWaterDate;
      const sourceDay = this.hydrationDayForDate(sourceDate);
      const amountInput = id ? root.querySelector<HTMLInputElement>(`[data-water-entry-input="${CSS.escape(id)}"]`) : null;
      const atInput = id ? root.querySelector<HTMLInputElement>(`[data-water-entry-at="${CSS.escape(id)}"]`) : null;
      const entry = sourceDay?.entries.find(item => item.id === id);
      if (!sourceDay || !entry || !amountInput || !atInput) return;
      const nextAt = this.dateTimeInputToIso(atInput.value, entry.at);
      if (new Date(nextAt).getTime() > Date.now() + 60_000) { this.toast(this.locale === "zh-TW" ? "不能把紀錄設到未來" : "Records cannot be moved into the future"); return; }
      const targetDate = localDateKey(nextAt);
      const editedAt = new Date().toISOString();
      const nextEntry = { ...entry, ml: clamp(Math.round(Number(amountInput.value) || 0), 1, 6000), at: nextAt, editedAt };
      sourceDay.entries = sourceDay.entries.filter(item => item.id !== id);
      sourceDay.totalMl = sourceDay.entries.reduce((sum, item) => sum + item.ml, 0);
      const targetDay = targetDate === sourceDate ? sourceDay : this.ensureHydrationDayForDate(targetDate);
      if (targetDate === sourceDate) targetDay.entries.push(nextEntry);
      else { targetDay.entries.push(nextEntry); targetDay.totalMl = targetDay.entries.reduce((sum, item) => sum + item.ml, 0); }
      targetDay.totalMl = targetDay.entries.reduce((sum, item) => sum + item.ml, 0);
      this.selectedWaterDate = targetDate;
      const parsed = new Date(`${targetDate}T12:00:00`); this.waterCalendarMonth = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
      this.persist(); this.render();
      void this.pushHydrationToCloud(structuredClone(sourceDay));
      if (targetDate !== sourceDate) void this.pushHydrationToCloud(structuredClone(targetDay));
    }));
    const supplementForm = root.querySelector<HTMLFormElement>("#supplement-form");
    const supplementPicker = root.querySelector<HTMLSelectElement>("#supplement-picker");
    const supplementInfoLink = root.querySelector<HTMLAnchorElement>("#supplement-info-link");
    supplementPicker?.addEventListener("change", () => {
      if (supplementInfoLink) supplementInfoLink.href = this.supplementSearchUrl(supplementPicker.value);
    });
    supplementForm?.addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(supplementForm);
      const supplementId = String(data.get("supplementId") ?? "");
      if (!SUPPLEMENTS.some(item => item.id === supplementId)) return;
      const rawAmount = Number(data.get("supplementAmount") ?? 1);
      const amount = Number.isFinite(rawAmount) && rawAmount > 0 ? Math.min(100000, rawAmount) : 1;
      const rawUnit = String(data.get("supplementUnit") ?? "serving") as SupplementUnit;
      const unit: SupplementUnit = SUPPLEMENT_UNITS.includes(rawUnit) ? rawUnit : "serving";
      const now = new Date();
      const date = localDateKey(now);
      const day = this.ensureSupplementDayForDate(date);
      day.entries.push({ id: uid("supplement"), at: now.toISOString(), supplementId, amount, unit });
      this.selectedWaterDate = date;
      this.waterCalendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      this.persist(); this.render();
      void this.pushSupplementDayToCloud(date);
      this.toast(this.locale === "zh-TW" ? "已記錄今天的補充品" : "Supplement logged for today");
    });
    root.querySelectorAll<HTMLElement>("[data-save-supplement]").forEach(node => node.addEventListener("click", () => {
      const id = node.dataset.saveSupplement;
      const sourceDate = node.dataset.supplementDate ?? this.selectedWaterDate;
      const sourceDay = (this.state.supplementHistory ?? []).find(item => item.date === sourceDate);
      const entry = sourceDay?.entries.find(item => item.id === id);
      if (!id || !sourceDay || !entry) return;
      const nameInput = root.querySelector<HTMLSelectElement>(`[data-supplement-entry-name="${CSS.escape(id)}"]`);
      const amountInput = root.querySelector<HTMLInputElement>(`[data-supplement-entry-amount="${CSS.escape(id)}"]`);
      const unitInput = root.querySelector<HTMLSelectElement>(`[data-supplement-entry-unit="${CSS.escape(id)}"]`);
      const atInput = root.querySelector<HTMLInputElement>(`[data-supplement-entry-at="${CSS.escape(id)}"]`);
      if (!nameInput || !amountInput || !unitInput || !atInput) return;
      const supplementId = SUPPLEMENTS.some(item => item.id === nameInput.value) ? nameInput.value : entry.supplementId;
      const rawUnit = unitInput.value as SupplementUnit;
      const unit: SupplementUnit = SUPPLEMENT_UNITS.includes(rawUnit) ? rawUnit : (entry.unit ?? "serving");
      const amount = Math.min(100000, Math.max(0.01, Number(amountInput.value) || entry.amount || 1));
      const nextAt = this.dateTimeInputToIso(atInput.value, entry.at);
      if (new Date(nextAt).getTime() > Date.now() + 60_000) { this.toast(this.locale === "zh-TW" ? "不能把紀錄設到未來" : "Records cannot be moved into the future"); return; }
      const targetDate = localDateKey(nextAt);
      const nextEntry: SupplementEntry = { ...entry, supplementId, amount, unit, at: nextAt, editedAt: new Date().toISOString() };
      sourceDay.entries = sourceDay.entries.filter(item => item.id !== id);
      const targetDay = targetDate === sourceDate ? sourceDay : this.ensureSupplementDayForDate(targetDate);
      targetDay.entries.push(nextEntry);
      this.state.supplementHistory = (this.state.supplementHistory ?? []).filter(item => item.entries.length > 0 || item.date === targetDate);
      this.selectedWaterDate = targetDate;
      const parsed = new Date(`${targetDate}T12:00:00`); this.waterCalendarMonth = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
      this.persist(); this.render();
      void this.pushSupplementDayToCloud(sourceDate);
      if (targetDate !== sourceDate) void this.pushSupplementDayToCloud(targetDate);
    }));
    root.querySelectorAll<HTMLElement>("[data-remove-supplement]").forEach(node => node.addEventListener("click", () => {
      const id = node.dataset.removeSupplement;
      const date = node.dataset.supplementDate ?? this.selectedWaterDate;
      if (!id) return;
      const day = (this.state.supplementHistory ?? []).find(item => item.date === date);
      if (!day) return;
      day.entries = day.entries.filter(entry => entry.id !== id);
      this.state.supplementHistory = (this.state.supplementHistory ?? []).filter(item => item.entries.length > 0);
      this.persist(); this.render();
      void this.pushSupplementDayToCloud(date);
    }));

    root.querySelectorAll<HTMLElement>("[data-trend]").forEach(node => node.addEventListener("click", () => {
      this.trendMode = node.dataset.trend === "monthly" ? "monthly" : "weekly";
      this.render();
    }));
    root.querySelectorAll<HTMLElement>("[data-monthly-trend-nav]").forEach(node => node.addEventListener("click", () => {
      const delta = node.dataset.monthlyTrendNav === "prev" ? -1 : 1;
      this.monthlyTrendStart = new Date(this.monthlyTrendStart.getFullYear(), this.monthlyTrendStart.getMonth() + delta, 1);
      this.render();
    }));
    root.querySelectorAll<HTMLElement>("[data-calendar-day]").forEach(node => node.addEventListener("click", () => {
      const day = node.dataset.calendarDay;
      if (day) this.selectedCalendarDate = day;
      this.render();
    }));
    root.querySelectorAll<HTMLElement>("[data-calendar-nav]").forEach(node => node.addEventListener("click", () => {
      const delta = node.dataset.calendarNav === "prev" ? -1 : 1;
      this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + delta, 1);
      this.selectedCalendarDate = `${this.calendarMonth.getFullYear()}-${String(this.calendarMonth.getMonth()+1).padStart(2,"0")}-01`;
      this.render();
    }));
    root.querySelectorAll<HTMLElement>("[data-water-day]").forEach(node=>node.addEventListener("click",()=>{ if(node.dataset.waterDay) this.selectedWaterDate=node.dataset.waterDay; this.render(); }));
    root.querySelectorAll<HTMLElement>("[data-water-calendar-nav]").forEach(node=>node.addEventListener("click",()=>{ const delta=node.dataset.waterCalendarNav==="prev"?-1:1; this.waterCalendarMonth=new Date(this.waterCalendarMonth.getFullYear(),this.waterCalendarMonth.getMonth()+delta,1); const now=new Date(); const showingCurrent=now.getFullYear()===this.waterCalendarMonth.getFullYear() && now.getMonth()===this.waterCalendarMonth.getMonth(); this.selectedWaterDate=showingCurrent ? localDateKey(now) : `${this.waterCalendarMonth.getFullYear()}-${String(this.waterCalendarMonth.getMonth()+1).padStart(2,"0")}-01`; this.render(); }));
    root.querySelector('[data-action="new-circuit"]')?.addEventListener("click", () => { this.showCircuitBuilder = !this.showCircuitBuilder; this.render(); });
    root.querySelector('[data-action="close-circuit"]')?.addEventListener("click", () => { this.showCircuitBuilder = false; this.render(); });
    const circuitForm = root.querySelector<HTMLFormElement>("#circuit-builder");
    const captureCircuitDraft = () => {
      if (!circuitForm) return;
      const data = new FormData(circuitForm);
      this.circuitDraftName = String(data.get("circuitName") ?? "Daily Circuit").trim().slice(0,50) || "Daily Circuit";
      this.circuitDraftRounds = clamp(Math.round(Number(data.get("circuitRounds") ?? 3) || 3),1,10);
      this.circuitDraftRows = this.circuitDraftRows.map((row,index)=>({
        exerciseId:String(data.get(`exercise_${index}`) ?? row.exerciseId),
        reps:clamp(Math.round(Number(data.get(`reps_${index}`) ?? row.reps) || row.reps),0,500),
        weightKg:clamp(Number(data.get(`weight_${index}`) ?? row.weightKg) || 0,0,1000),
        durationSec:clamp(Math.round(Number(data.get(`duration_${index}`) ?? row.durationSec) || row.durationSec),0,7200),
        distanceKm:clamp(Number(data.get(`distance_${index}`) ?? row.distanceKm) || row.distanceKm,0,1000),
        minutes:clamp(Math.round(Number(data.get(`minutes_${index}`) ?? row.minutes) || row.minutes),0,1440),
        restSec:clamp(Math.round(Number(data.get(`rest_${index}`) ?? row.restSec) || 0),0,900)
      }));
    };
    root.querySelectorAll<HTMLSelectElement>("[data-circuit-exercise-index]").forEach(select => select.addEventListener("change", () => {
      captureCircuitDraft();
      const index = Number(select.dataset.circuitExerciseIndex);
      if (Number.isInteger(index) && this.circuitDraftRows[index]) this.circuitDraftRows[index]!.exerciseId = select.value;
      this.render();
    }));
    root.querySelector('[data-action="add-circuit-row"]')?.addEventListener("click", () => { captureCircuitDraft(); this.circuitDraftRows.push({ exerciseId:"push_up", reps:10, weightKg:0, durationSec:30, distanceKm:1, minutes:10, restSec:45 }); this.render(); });
    root.querySelectorAll<HTMLElement>("[data-circuit-remove]").forEach(node => node.addEventListener("click", () => { captureCircuitDraft(); const index=Number(node.dataset.circuitRemove); if (this.circuitDraftRows.length>1 && Number.isInteger(index)) this.circuitDraftRows.splice(index,1); this.render(); }));
    circuitForm?.addEventListener("submit", event => {
      event.preventDefault();
      captureCircuitDraft();
      this.requestWeightCheck({ kind: "circuit" });
    });

    root.querySelector('[data-action="open-profile"]')?.addEventListener("click", () => this.navigate("profile"));
    root.querySelectorAll<HTMLElement>("[data-family-member-profile]").forEach(node => node.addEventListener("click", () => {
      this.selectedFamilyMemberUid = node.dataset.familyMemberProfile ?? null;
      this.navigate("familyMember");
    }));
    root.querySelector('[data-action="back-family"]')?.addEventListener("click", () => this.navigate("family"));
    root.querySelectorAll<HTMLElement>("[data-family-comparison-metric]").forEach(node=>node.addEventListener("click",()=>{ this.familyComparisonMetric=node.dataset.familyComparisonMetric === "water" ? "water" : "calories"; this.render(); }));
    root.querySelectorAll<HTMLElement>("[data-family-comparison-focus]").forEach(node=>node.addEventListener("click",()=>{ this.familyComparisonFocus=node.dataset.familyComparisonFocus === "self" ? "self" : "member"; this.render(); }));

    root.querySelector('[data-action="toggle-hike-badge-edit"]')?.addEventListener("click",()=>{
      this.hikeBadgeEditMode=!this.hikeBadgeEditMode;
      this.render();
    });

    root.querySelectorAll<HTMLElement>("[data-edit-hike-badge]").forEach(node=>node.addEventListener("click",()=>{
      const hikeId=node.dataset.editHikeBadge;
      const hike=hikeId ? this.state.hikes.find(item=>item.id===hikeId) : undefined;
      if(!hike) return;
      const next=window.prompt(this.locale === "zh-TW" ? "健行徽章名稱" : "Hiking badge name",this.hikeBadgeTitle(hike));
      if(next===null) return;
      const title=next.trim().slice(0,100);
      this.setHikeBadgePreference(hike.id,{ title:title && title!==hike.name ? title : undefined });
      this.persist(); this.render(); void this.pushBadgePresentationToCloud();
    }));
    const badgeList=root.querySelector<HTMLElement>("[data-hike-badge-list]");
    root.querySelectorAll<HTMLElement>("[data-hike-badge-drag-handle]").forEach(handle=>{
      handle.addEventListener("pointerdown",event=>{
        const hikeId=handle.dataset.hikeBadgeDragHandle;
        const card=hikeId ? root.querySelector<HTMLElement>(`[data-hike-badge-id="${CSS.escape(hikeId)}"]`) : null;
        if(!badgeList || !hikeId || !card) return;
        event.preventDefault();
        handle.setPointerCapture(event.pointerId);
        card.classList.add("badge-dragging");
        badgeList.classList.add("badge-list-dragging");

        const move=(pointer:PointerEvent)=>{
          const target=document.elementFromPoint(pointer.clientX,pointer.clientY)?.closest<HTMLElement>("[data-hike-badge-id]");
          if(!target || target===card || target.parentElement!==badgeList) return;
          const rect=target.getBoundingClientRect();
          const verticalDistance=Math.abs(pointer.clientY-(rect.top+rect.height/2));
          const sameRow=verticalDistance < rect.height*.55;
          const after=sameRow ? pointer.clientX > rect.left+rect.width/2 : pointer.clientY > rect.top+rect.height/2;
          badgeList.insertBefore(card,after ? target.nextSibling : target);
        };
        const finish=()=>{
          handle.removeEventListener("pointermove",move);
          handle.removeEventListener("pointerup",finish);
          handle.removeEventListener("pointercancel",finish);
          card.classList.remove("badge-dragging");
          badgeList.classList.remove("badge-list-dragging");
          Array.from(badgeList.querySelectorAll<HTMLElement>("[data-hike-badge-id]")).forEach((item,order)=>{
            const id=item.dataset.hikeBadgeId;
            if(id) this.setHikeBadgePreference(id,{order});
          });
          this.persist();
          this.render();
          void this.pushBadgePresentationToCloud();
        };
        handle.addEventListener("pointermove",move);
        handle.addEventListener("pointerup",finish,{once:true});
        handle.addEventListener("pointercancel",finish,{once:true});
      });
    });
    root.querySelectorAll<HTMLElement>("[data-remove-hike-badge]").forEach(node=>node.addEventListener("click",()=>{
      const hikeId=node.dataset.removeHikeBadge;
      const hike=hikeId ? this.state.hikes.find(item=>item.id===hikeId) : undefined;
      if(!hike) return;
      const confirmed=window.confirm(this.locale === "zh-TW" ? `移除「${this.hikeBadgeTitle(hike)}」徽章？健行紀錄本身不會刪除。` : `Remove the “${this.hikeBadgeTitle(hike)}” badge? The hike record itself will stay.`);
      if(!confirmed) return;
      this.setHikeBadgePreference(hike.id,{hidden:true});
      this.persist(); this.render(); void this.pushBadgePresentationToCloud(`hike-${hike.id}`);
    }));

    const waterGoalForm = root.querySelector<HTMLFormElement>("#water-goal-form");
    waterGoalForm?.addEventListener("submit", event => { event.preventDefault(); const data=new FormData(waterGoalForm); this.state.hydration.targetMl=clamp(Math.round(Number(data.get("waterGoal") ?? 2000) || 2000),500,6000); this.persist(); this.render(); void this.pushHydrationToCloud(structuredClone(this.state.hydration)); });

    const profilePhotoInput = root.querySelector<HTMLInputElement>("#profile-photo-input");
    profilePhotoInput?.addEventListener("change", async () => {
      const file=profilePhotoInput.files?.[0]; if (!file) return;
      try { const id=`profile_${this.state.user.id}`; await savePrivateImage(file,id,512); this.state.profile!.photoId=id; this.persist(); this.render(); this.toast(this.locale === "zh-TW" ? "個人照片已儲存於本機" : "Profile photo saved locally"); } catch (error) { this.toast(error instanceof Error ? error.message : "Photo failed"); }
    });

    root.querySelectorAll<HTMLElement>("[data-locale]").forEach(node => node.addEventListener("click", () => {
      this.state.locale = node.dataset.locale as Locale; this.applyTheme(); this.persist(); this.render(); void this.pushPreferencesToCloud();
    }));
    root.querySelectorAll<HTMLElement>("[data-theme]").forEach(node => node.addEventListener("click", () => {
      this.state.theme = node.dataset.theme === "light" ? "light" : "dark"; this.applyTheme(); this.persist(); this.render(); void this.pushPreferencesToCloud();
    }));
    root.querySelectorAll<HTMLElement>("[data-accent-color]").forEach(node => node.addEventListener("click", () => {
      this.state.accentColor = normalizeHex(node.dataset.accentColor); this.applyTheme(); this.persist(); this.render(); void this.pushPreferencesToCloud();
    }));
    root.querySelector<HTMLInputElement>("#custom-accent-input")?.addEventListener("input", event => {
      const value = normalizeHex((event.currentTarget as HTMLInputElement).value); this.state.accentColor = value; this.applyTheme(); this.persist();
    });
    root.querySelector<HTMLInputElement>("#custom-accent-input")?.addEventListener("change", () => { this.render(); void this.pushPreferencesToCloud(); });
    root.querySelector('[data-action="toggle-simple"]')?.addEventListener("click", () => { this.state.simpleMode = !this.state.simpleMode; this.persist(); this.render(); void this.pushPreferencesToCloud(); });
    root.querySelector('[data-action="reset-demo"]')?.addEventListener("click", async () => {
      await clearPrivateImages().catch(() => undefined);
      this.state = cloudModeEnabled() ? clearLocalTestState(this.state, this.localScope || undefined) : resetState();
      this.ensureExtendedState();
      this.applyTheme();
      this.render();
      this.toast(cloudModeEnabled() ? (this.locale === "zh-TW" ? "本機測試資料已清除" : "Local test data cleared") : (this.locale === "zh-TW" ? "示範資料已重設" : "Demo data reset"));
    });

    root.querySelectorAll<HTMLElement>("[data-history-filter]").forEach(node => node.addEventListener("click", () => {
      const value = node.dataset.historyFilter;
      if (value === "all" || value === "workout" || value === "hike") this.historyFilter = value;
      this.expandedHistoryKey = null;
      this.render();
    }));
    root.querySelectorAll<HTMLElement>("[data-history-toggle]").forEach(node => node.addEventListener("click", () => {
      const key = node.dataset.historyToggle ?? null;
      this.expandedHistoryKey = this.expandedHistoryKey === key ? null : key;
      this.expandedExerciseKey = null;
      this.render();
    }));
    root.querySelectorAll<HTMLElement>("[data-exercise-toggle]").forEach(node => node.addEventListener("click", () => {
      const key = node.dataset.exerciseToggle ?? null;
      this.expandedExerciseKey = this.expandedExerciseKey === key ? null : key;
      this.render();
    }));
    root.querySelectorAll<HTMLElement>("[data-edit-workout]").forEach(node => node.addEventListener("click", () => {
      const id = node.dataset.editWorkout;
      const record = id ? this.state.workouts.find(item => item.id === id) : undefined;
      if (!record) return;
      this.endRest(false);
      this.state.activeWorkout = structuredClone(record);
      this.persist();
      this.navigate("workout");
    }));
    root.querySelectorAll<HTMLElement>("[data-delete-workout]").forEach(node => node.addEventListener("click", () => {
      const id = node.dataset.deleteWorkout;
      if (id) { this.confirmAction = { kind: "delete-workout", id }; this.render(); }
    }));
    root.querySelectorAll<HTMLElement>("[data-edit-hike]").forEach(node => node.addEventListener("click", () => {
      const id = node.dataset.editHike;
      const record = id ? this.state.hikes.find(item => item.id === id) : undefined;
      if (!record) return;
      this.editingHikeId = record.id;
      this.pendingHikeGpx = null;
      this.navigate("hike");
    }));
    root.querySelectorAll<HTMLElement>("[data-delete-hike]").forEach(node => node.addEventListener("click", () => {
      const id = node.dataset.deleteHike;
      if (id) { this.confirmAction = { kind: "delete-hike", id }; this.render(); }
    }));
    const profileForm = root.querySelector<HTMLFormElement>("#profile-form");
    profileForm?.addEventListener("submit", async event => {
      event.preventDefault();
      const data = new FormData(profileForm);
      this.state.user.displayName = String(data.get("name") ?? "").trim().slice(0,60) || this.state.user.displayName;
      this.state.profile!.heightCm = clamp(Number(data.get("height") ?? 0) || 0, 0, 250) || undefined;
      const biologicalSex = String(data.get("biologicalSex") ?? "");
      this.state.profile!.biologicalSex = ["female","male","other","prefer_not"].includes(biologicalSex)
        ? biologicalSex as ProfileData["biologicalSex"]
        : undefined;
      const weight = Number(data.get("weight") ?? 0);
      if (weight > 0) {
        const today = localDateKey(new Date());
        const month = today.slice(0,7);
        const existing = this.state.profile!.weightEntries.find(entry => entry.date.startsWith(month));
        if (existing) { existing.kg = weight; existing.date = today; }
        else this.state.profile!.weightEntries.push({ id: uid("weight"), date: today, kg: weight });
        this.markWeightReviewedThisMonth();
      }
      const self = this.state.family.find(member => member.id === this.state.user.id); if (self) self.name = this.state.user.displayName;
      this.persist();
      if (this.authUser && this.cloudMembership?.access.status === "active") {
        try {
          this.cloudMembership = await updateMyFamilyDisplayName(this.authUser, this.cloudMembership, this.state.user.displayName, this.state.profile!.biologicalSex);
        } catch (error) {
          this.toast(this.cloudErrorMessage(error));
        }
      }
      void this.pushProfileToCloud();
      this.render(); this.toast(this.text("profileSaved"));
    });
    root.querySelector('[data-action="toggle-goal-difficulty"]')?.addEventListener("click", () => { this.showGoalDifficultyMenu = !this.showGoalDifficultyMenu; this.previewGoalMode = null; this.render(); });
    root.querySelectorAll<HTMLElement>("[data-goal-mode]").forEach(node=>node.addEventListener("click",()=>{
      const mode=node.dataset.goalMode as GoalDifficulty; if(!["easy","normal","hard","extreme"].includes(mode)) return;
      const goals=this.state.goals!;
      if(this.previewGoalMode !== mode){ this.previewGoalMode = mode; this.showGoalDifficultyMenu = true; this.render(); return; }
      if(goals.difficulty===mode){ this.previewGoalMode = null; this.render(); return; }
      if(goals.difficultyWeek!==weekKey()){ goals.difficultyWeek=weekKey(); goals.difficultyChanges=0; }
      if((goals.difficultyChanges ?? 0)>=3){ this.toast(this.locale === "zh-TW" ? "本週已使用 3 次難度變更" : "You have used all 3 difficulty changes this week"); return; }
      const preset=goalPreset(mode); goals.weeklyCalories=preset.weeklyCalories; goals.categorySets=preset.categorySets; goals.difficulty=mode; goals.difficultyChanges=(goals.difficultyChanges ?? 0)+1; this.previewGoalMode=null; this.showGoalDifficultyMenu=false; this.persist(); this.render(); void this.pushPreferencesToCloud(); void this.refreshFamilyProgress();
    }));
    root.querySelector('[data-action="refresh-family-cloud"]')?.addEventListener("click", () => { if (this.authUser) void this.refreshCloudMembership(this.authUser); });
    root.querySelector('[data-action="toggle-member-access-edit"]')?.addEventListener("click", () => { this.familyAccessEditing = !this.familyAccessEditing; this.render(); });
    root.querySelector('[data-action="refresh-workout-cloud"]')?.addEventListener("click", () => {
      if (this.authUser && this.cloudMembership?.access.status === "active") void this.refreshCloudMembership(this.authUser);
    });
    root.querySelectorAll<HTMLElement>("[data-member-status]").forEach(node => node.addEventListener("click", () => {
      const uid = node.dataset.memberUid ?? "";
      const name = node.dataset.memberName ?? (this.locale === "zh-TW" ? "此成員" : "this member");
      const status = node.dataset.memberStatus === "active" ? "active" : "revoked";
      if (!uid) return;
      if (status === "revoked") {
        this.confirmAction = { kind: "revoke-member", uid, name };
        this.render();
      } else {
        void this.changeFamilyMemberStatus(uid, "active");
      }
    }));

    const createGroupForm = root.querySelector<HTMLFormElement>("#create-group-form");
    createGroupForm?.addEventListener("submit", async event => {
      event.preventDefault();
      if (!this.authUser || !this.cloudMembership || this.cloudActionBusy) return;
      const name = String(new FormData(createGroupForm).get("groupName") ?? "");
      this.cloudActionBusy = true; this.render();
      try {
        this.cloudMembership = await createFamilyGroup(this.authUser, this.cloudMembership, name);
        this.cloudMembershipError = null;
        this.toast(this.locale === "zh-TW" ? "群組已建立" : "Group created");
      } catch (error) { this.toast(this.cloudErrorMessage(error)); }
      finally { this.cloudActionBusy = false; this.render(); }
    });

    root.querySelectorAll<HTMLInputElement>("[data-group-name-input]").forEach(input => input.addEventListener("change", () => {
      input.closest<HTMLFormElement>("[data-group-rename-form]")?.requestSubmit();
    }));
    root.querySelectorAll<HTMLFormElement>("[data-group-rename-form]").forEach(form => form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!this.authUser || !this.cloudMembership || this.cloudActionBusy) return;
      const groupId = form.dataset.groupRenameForm ?? "";
      const name = String(new FormData(form).get("groupName") ?? "");
      if (!groupId) return;
      this.cloudActionBusy = true; this.render();
      try {
        this.cloudMembership = await renameFamilyGroup(this.authUser, this.cloudMembership, groupId, name);
        this.cloudMembershipError = null;
        this.toast(this.locale === "zh-TW" ? "群組名稱已更新" : "Group renamed");
      } catch (error) { this.toast(this.cloudErrorMessage(error)); }
      finally { this.cloudActionBusy = false; this.render(); }
    }));

    root.querySelectorAll<HTMLElement>("[data-delete-group]").forEach(node => node.addEventListener("click", async () => {
      if (!this.authUser || !this.cloudMembership || this.cloudActionBusy) return;
      const groupId = node.dataset.deleteGroup ?? "";
      const name = this.groupName(groupId);
      if (!groupId || !window.confirm(this.locale === "zh-TW" ? `刪除群組「${name}」？` : `Delete the “${name}” group?`)) return;
      this.cloudActionBusy = true; this.render();
      try {
        this.cloudMembership = await deleteFamilyGroup(this.authUser, this.cloudMembership, groupId);
        this.cloudMembershipError = null;
        this.toast(this.locale === "zh-TW" ? "群組已刪除" : "Group deleted");
      } catch (error) { this.toast(this.cloudErrorMessage(error)); }
      finally { this.cloudActionBusy = false; this.render(); }
    }));

    const ownerSharingForm = root.querySelector<HTMLFormElement>("#owner-sharing-form");
    ownerSharingForm?.addEventListener("submit", async event => {
      event.preventDefault();
      if (!this.authUser || !this.cloudMembership || this.cloudActionBusy) return;
      const groups = new FormData(ownerSharingForm).getAll("shareGroup").map(String);
      this.cloudActionBusy = true; this.render();
      try {
        this.cloudMembership = await setOwnerShareGroups(this.authUser, this.cloudMembership, groups);
        this.cloudMembershipError = null;
        this.toast(this.locale === "zh-TW" ? "你的群組分享設定已儲存" : "Your group sharing settings were saved");
      } catch (error) { this.toast(this.cloudErrorMessage(error)); }
      finally { this.cloudActionBusy = false; this.render(); }
    });

    root.querySelectorAll<HTMLSelectElement>("[data-member-group]").forEach(select => select.addEventListener("change", async () => {
      if (!this.authUser || !this.cloudMembership || this.cloudActionBusy) return;
      const uid = select.dataset.memberGroup ?? "";
      const groupId = select.value;
      if (!uid || !groupId) return;
      this.cloudActionBusy = true; this.render();
      try {
        this.cloudMembership = await setFamilyMemberGroup(this.authUser, this.cloudMembership, uid, groupId);
        this.cloudMembershipError = null;
        this.toast(this.locale === "zh-TW" ? "成員群組已更新" : "Member group updated");
      } catch (error) { this.toast(this.cloudErrorMessage(error)); }
      finally { this.cloudActionBusy = false; this.render(); }
    }));

    const createInviteForm = root.querySelector<HTMLFormElement>("#create-invite-form");
    createInviteForm?.addEventListener("submit", async event => {
      event.preventDefault();
      if (!this.authUser || !this.cloudMembership || this.cloudActionBusy) return;
      const data = new FormData(createInviteForm);
      const email = String(data.get("inviteEmail") ?? "");
      const groupId = String(data.get("inviteGroup") ?? DEFAULT_GROUP_ID);
      this.cloudActionBusy = true; this.createdInvite = null; this.render();
      try {
        this.createdInvite = await createFamilyInvite(this.authUser, this.cloudMembership, email, groupId);
        this.toast(this.locale === "zh-TW" ? "Cloud 邀請已建立" : "Cloud invite created");
      } catch (error) {
        this.toast(this.cloudErrorMessage(error));
      } finally {
        this.cloudActionBusy = false; this.render();
      }
    });

    root.querySelectorAll<HTMLElement>("[data-copy-invite]").forEach(node => node.addEventListener("click", async () => {
      const link = node.dataset.copyInvite ?? "";
      try {
        await navigator.clipboard.writeText(link);
        this.toast(this.locale === "zh-TW" ? "Cloud 邀請連結已複製" : "Cloud invite link copied");
      } catch {
        this.toast(this.locale === "zh-TW" ? `邀請連結：${link}` : `Invite link: ${link}`);
      }
    }));

    root.querySelector("[data-weight-update]")?.addEventListener("click", () => { this.weightReminderAction = null; this.navigate("profile"); });
    root.querySelector("[data-weight-confirm]")?.addEventListener("click", () => {
      const action = this.weightReminderAction;
      this.weightReminderAction = null;
      this.confirmCurrentWeight();
      if (action) this.performWeightAction(action);
    });
    root.querySelectorAll<HTMLElement>("[data-weight-skip]").forEach(node => node.addEventListener("click", () => {
      const action = this.weightReminderAction;
      const hasWeight = Boolean(this.latestWeightEntry());
      this.weightReminderAction = null;
      if (hasWeight) this.markWeightReviewedThisMonth();
      if (action) this.performWeightAction(action);
    }));

    root.querySelector("[data-confirm-cancel]")?.addEventListener("click", () => { this.confirmAction = null; this.render(); });
    root.querySelector("[data-confirm-accept]")?.addEventListener("click", () => this.acceptConfirmation());
  }

  private acceptConfirmation(): void {
    const action = this.confirmAction;
    this.confirmAction = null;
    if (!action) return;
    if (action.kind === "discard-active") {
      const discarded = this.state.activeWorkout ? structuredClone(this.state.activeWorkout) : null;
      const stayInWorkoutBuilder = this.page === "workout";
      this.restSource = null;
      this.pendingSetRemovalKey = null;
      this.pendingCircuitRoundRemovalIndex = null;
      this.state.activeWorkout = stayInWorkoutBuilder ? createBlankWorkout(this.state) : null;
      this.persist(); this.navigate(stayInWorkoutBuilder ? "workout" : "home");
      if (discarded) this.toast(this.locale === "zh-TW" ? "已捨棄未完成運動" : "Unfinished workout discarded", this.text("undo"), () => { this.state.activeWorkout = discarded; this.persist(); if (stayInWorkoutBuilder) this.page = "workout"; this.render(); });
      return;
    }
    if (action.kind === "revoke-member") {
      void this.changeFamilyMemberStatus(action.uid, "revoked");
      return;
    }
    if (action.kind === "remove-exercise") {
      const workout = this.state.activeWorkout;
      const removed = workout?.exercises[action.exerciseIndex];
      if (!workout || !removed) { this.render(); return; }
      if (this.restSource?.exerciseIndex === action.exerciseIndex) this.endRest(true);
      workout.exercises.splice(action.exerciseIndex, 1);
      this.persist(); this.render();
      this.toast(this.locale === "zh-TW" ? "已移除動作" : "Exercise removed", this.text("undo"), () => { workout.exercises.splice(action.exerciseIndex, 0, removed); this.persist(); this.render(); });
      return;
    }
    if (action.kind === "delete-routine") {
      const index=this.state.routines?.findIndex(item=>item.id===action.id) ?? -1; if(index<0){ this.render(); return; }
      const removed=this.state.routines![index]!; this.state.routines!.splice(index,1); this.persist(); this.render();
      this.toast(this.locale === "zh-TW" ? "已刪除已儲存訓練" : "Saved routine deleted", this.text("undo"),()=>{ this.state.routines!.splice(index,0,removed); this.persist(); this.render(); });
      return;
    }
    if (action.kind === "delete-workout") {
      const index = this.state.workouts.findIndex(item => item.id === action.id);
      if (index < 0) { this.render(); return; }
      const removed = this.state.workouts[index];
      if (!removed) { this.render(); return; }
      this.state.workouts.splice(index, 1);
      this.state.sync ??= { deletedWorkoutIds: [] };
      this.state.sync.deletedWorkoutIds ??= [];
      const shouldDeleteCloud = Boolean(removed.cloudSyncedAt && removed.ownerId === this.effectiveLocalUid());
      if (shouldDeleteCloud && !this.state.sync.deletedWorkoutIds.includes(removed.id)) this.state.sync.deletedWorkoutIds.push(removed.id);
      this.expandedHistoryKey = null;
      this.cloudFamilyWorkouts = this.cloudFamilyWorkouts.filter(item => item.workout.id !== removed.id);
      this.persist(); this.render();
      void this.refreshFamilyProgress();
      this.toast(this.text("deleted"), this.text("undo"), () => {
        this.state.workouts.splice(index, 0, removed);
        if (this.state.sync?.deletedWorkoutIds) this.state.sync.deletedWorkoutIds = this.state.sync.deletedWorkoutIds.filter(id => id !== removed.id);
        this.persist(); this.render(); void this.refreshFamilyProgress();
      });
      window.setTimeout(() => {
        if (this.state.workouts.some(item => item.id === removed.id)) return;
        if (removed.photoId) void deletePrivateImage(removed.photoId).catch(() => undefined);
        if (shouldDeleteCloud && this.authUser && this.cloudMembership?.access.status === "active" && removed.ownerId === this.authUser.uid) {
          void deleteCloudWorkout(this.authUser, this.cloudMembership, removed.id).then(() => {
            if (this.state.sync?.deletedWorkoutIds) this.state.sync.deletedWorkoutIds = this.state.sync.deletedWorkoutIds.filter(id => id !== removed.id);
            this.persist();
            void this.refreshFamilyProgress();
          }).catch(error => {
            this.cloudWorkoutError = this.cloudErrorMessage(error);
            this.persist();
          });
        }
      }, 7000);
      return;
    }
    const index = this.state.hikes.findIndex(item => item.id === action.id);
    if (index < 0) { this.render(); return; }
    const removed = this.state.hikes[index];
    if (!removed) { this.render(); return; }
    this.state.hikes.splice(index, 1);
    this.state.sync ??= {};
    this.state.sync.deletedHikeIds ??= [];
    const shouldDeleteCloud = Boolean(removed.cloudSyncedAt && removed.ownerId === this.effectiveLocalUid());
    if (shouldDeleteCloud && !this.state.sync.deletedHikeIds.includes(removed.id)) this.state.sync.deletedHikeIds.push(removed.id);
    this.expandedHistoryKey = null;
    this.cloudFamilyHikes = this.cloudFamilyHikes.filter(item => item.hike.id !== removed.id);
    this.persist(); this.render();
    void this.refreshFamilyProgress();
    this.toast(this.text("deleted"), this.text("undo"), () => {
      this.state.hikes.splice(index, 0, removed);
      if (this.state.sync?.deletedHikeIds) this.state.sync.deletedHikeIds = this.state.sync.deletedHikeIds.filter(id => id !== removed.id);
      this.persist(); this.render(); void this.refreshFamilyProgress();
    });
    window.setTimeout(() => {
      if (this.state.hikes.some(item => item.id === removed.id)) return;
      if (removed.photoId) void deletePrivateImage(removed.photoId).catch(() => undefined);
      if (shouldDeleteCloud && this.authUser && this.cloudMembership?.access.status === "active" && removed.ownerId === this.authUser.uid) {
        void deleteCloudHike(this.authUser, this.cloudMembership, removed.id).then(() => {
          if (this.state.sync?.deletedHikeIds) this.state.sync.deletedHikeIds = this.state.sync.deletedHikeIds.filter(id => id !== removed.id);
          this.persist();
          void this.refreshFamilyProgress();
        }).catch(error => {
          this.cloudHikeError = this.cloudErrorMessage(error);
          this.persist();
        });
      }
    }, 7000);
  }

  private startRest(seconds: number, exerciseIndex: number, setIndex: number): void {
    this.endRest(true);
    this.restSource = { exerciseIndex, setIndex, startedAt: Date.now(), targetSec: Math.max(0, seconds) };
    this.ensureWorkoutTicker();
    this.updateRestTimerDisplay();
  }

  private endRest(record = true): void {
    const source = this.restSource;
    if (record && source && this.state.activeWorkout) {
      const set = this.state.activeWorkout.exercises[source.exerciseIndex]?.sets[source.setIndex];
      if (set) set.restAfterSec = Math.max(0, Math.round((Date.now() - source.startedAt) / 1000));
      this.persist();
    }
    this.restSource = null;
    this.ensureWorkoutTicker();
    this.updateRestTimerDisplay();
  }

  private updateRestTimerDisplay(): void {
    const timer = this.workoutTimerSnapshot();
    root.querySelectorAll<HTMLElement>("[data-workout-dock-label]").forEach(node => { if (timer) node.textContent = timer.label; });
    root.querySelectorAll<HTMLElement>("[data-workout-dock-timer]").forEach(node => { if (timer) node.textContent = timer.value; });
    root.querySelectorAll<HTMLElement>("[data-workout-dock-detail]").forEach(node => { if (timer) node.textContent = timer.detail; });
    const box = root.querySelector<HTMLElement>("#rest-timer");
    const value = root.querySelector<HTMLElement>("#rest-timer-value");
    if (!box || !value) return;
    const source = this.restSource;
    if (!source) { box.hidden = true; return; }
    box.hidden = false;
    const elapsed = Math.max(0, Math.floor((Date.now() - source.startedAt) / 1000));
    if (source.targetSec <= 0) value.textContent = this.clockText(elapsed);
    else {
      const remaining = source.targetSec - elapsed;
      value.textContent = remaining >= 0 ? this.clockText(remaining) : `+${this.clockText(Math.abs(remaining))}`;
    }
  }

  private bindWorkoutEvents(): void {
    const workout = this.state.activeWorkout;
    if (!workout) return;
    const editingExisting = this.state.workouts.some(item => item.id === workout.id);

    root.querySelector('[data-action="end-rest"]')?.addEventListener("click", () => { this.endRest(true); this.render(); });

    root.querySelector('[data-action="back-workout"]')?.addEventListener("click", () => {
      this.endRest(true);
      if (editingExisting) {
        this.state.activeWorkout = null;
        this.persist();
        this.navigate("history");
      } else {
        this.navigate("home");
      }
    });

    const name = root.querySelector<HTMLInputElement>("#workout-name");
    name?.addEventListener("input", () => { workout.routineName = name.value.slice(0, 60); this.persist(); });

    const typeFilter = root.querySelector<HTMLSelectElement>("#exercise-type-filter");
    typeFilter?.addEventListener("change", () => {
      const value = typeFilter.value;
      this.exerciseLibraryFilter = value === "all" || LIBRARY_GROUP_ORDER.includes(value as ExerciseLibraryGroup) ? value as ExerciseLibraryGroup | "all" : "all";
      const visible = EXERCISES.filter(exercise => this.exerciseLibraryFilter === "all" || exerciseLibraryGroup(exercise) === this.exerciseLibraryFilter);
      if (!visible.some(exercise => exercise.id === this.pendingExerciseId)) this.pendingExerciseId = visible[0]?.id ?? EXERCISES[0]?.id ?? this.pendingExerciseId;
      this.render();
    });
    const picker = root.querySelector<HTMLSelectElement>("#exercise-picker");
    picker?.addEventListener("change", () => { this.pendingExerciseId = picker.value; this.render(); });

    const addForm = root.querySelector<HTMLFormElement>("#add-exercise-form");
    addForm?.addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(addForm);
      const exerciseId = String(data.get("exerciseId") ?? this.pendingExerciseId);
      const definition = exerciseById(exerciseId);
      if (!definition) return;
      const profile = exerciseLoggingProfile(definition);
      const metrics = exerciseSessionMetricFlags(definition);
      const count = profile === "sets"
        ? clamp(Math.round(Number(data.get("sets") ?? 1) || 1), 1, 10)
        : profile === "rounds"
          ? clamp(Math.round(Number(data.get("sets") ?? 1) || 1), 1, 12)
          : 1;
      const numberOrUndefined = (name: string): number | undefined => {
        const raw = String(data.get(name) ?? "").trim();
        if (!raw) return undefined;
        const value = Number(raw);
        return Number.isFinite(value) ? value : undefined;
      };
      const sets: SetEntry[] = Array.from({ length: count }, () => {
        const entry: SetEntry = { id: uid("set"), completed: false, setType: "normal" };
        if (profile === "cardio_session") {
          entry.durationSec = Math.max(0, Math.round((numberOrUndefined("minutes") ?? 0) * 60));
          const distance = numberOrUndefined("distance");
          const speed = numberOrUndefined("speed");
          const incline = numberOrUndefined("incline");
          const resistance = numberOrUndefined("resistance");
          const laps = numberOrUndefined("laps");
          if (metrics.distance && distance !== undefined) entry.distanceKm = Math.max(0, distance);
          if (metrics.speed && speed !== undefined) entry.speedKph = Math.max(0, speed);
          if (metrics.incline && incline !== undefined) entry.inclinePct = clamp(incline, -10, 40);
          if (metrics.resistance && resistance !== undefined) entry.resistanceLevel = clamp(resistance, 0, 100);
          if (metrics.laps && laps !== undefined) entry.laps = Math.max(0, Math.round(laps));
        } else if (profile === "mobility_session") {
          entry.durationSec = Math.max(0, Math.round((numberOrUndefined("minutes") ?? 0) * 60));
        } else if (profile === "rounds") {
          entry.durationSec = Math.max(0, Math.round(numberOrUndefined("duration") ?? 180));
        } else if (definition.type === "weight_reps") {
          entry.weightKg = Math.max(0, numberOrUndefined("weight") ?? 0);
          entry.reps = Math.max(0, Math.round(numberOrUndefined("reps") ?? 0));
        } else if (definition.type === "reps") {
          entry.reps = Math.max(0, Math.round(numberOrUndefined("reps") ?? 0));
        } else if (definition.type === "duration") {
          entry.durationSec = Math.max(0, Math.round(numberOrUndefined("duration") ?? 0));
        } else {
          entry.distanceKm = Math.max(0, numberOrUndefined("distance") ?? 0);
          entry.durationSec = Math.max(0, Math.round((numberOrUndefined("minutes") ?? 0) * 60));
        }
        return entry;
      });
      const defaultRest = profile === "sets" ? (definition.type === "weight_reps" || definition.type === "reps" ? 90 : 30) : profile === "rounds" ? 60 : 0;
      const restSec = profile === "sets" || profile === "rounds"
        ? clamp(Math.round(Number(data.get("rest") ?? defaultRest) || 0), 0, 900)
        : 0;
      workout.exercises.push({ id: uid("exercise"), exerciseId, restSec, notes: "", sets });
      this.persist(); this.render();
      window.setTimeout(() => document.querySelectorAll(".exercise-card").item(workout.exercises.length - 1)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
    });

    root.querySelector('[data-action="load-routine"]')?.addEventListener("click", () => {
      const id = root.querySelector<HTMLSelectElement>("#routine-picker")?.value;
      const routine = this.state.routines?.find(item => item.id === id);
      if (!routine) return;
      this.endRest(false);
      this.state.activeWorkout = workoutFromRoutine(this.state, routine);
      this.persist(); this.render();
    });
    root.querySelector('[data-action="delete-picked-routine"]')?.addEventListener("click",()=>{ const id=root.querySelector<HTMLSelectElement>("#routine-picker")?.value; if(id){ this.confirmAction={kind:"delete-routine",id}; this.render(); } });

    root.querySelector('[data-action="repeat-last"]')?.addEventListener("click", () => {
      this.state.activeWorkout = freshWorkoutFromPrevious(this.state);
      this.persist(); this.render();
    });

    root.querySelectorAll<HTMLInputElement>("[data-set-field]").forEach(input => input.addEventListener("input", () => {
      const exerciseIndex = Number(input.dataset.exerciseIndex);
      const setIndex = Number(input.dataset.setIndex);
      const set = workout.exercises[exerciseIndex]?.sets[setIndex];
      if (!set) return;
      const raw = Number(input.value);
      const value = Number.isFinite(raw) ? raw : 0;
      if (input.dataset.setField === "weight") set.weightKg = Math.max(0, value);
      else if (input.dataset.setField === "reps") set.reps = Math.max(0, Math.round(value));
      else if (input.dataset.setField === "duration") set.durationSec = Math.max(0, Math.round(value));
      else if (input.dataset.setField === "distance") set.distanceKm = Math.max(0, value);
      else if (input.dataset.setField === "minutes") set.durationSec = Math.max(0, Math.round(value * 60));
      else if (input.dataset.setField === "speed") set.speedKph = Math.max(0, value);
      else if (input.dataset.setField === "incline") set.inclinePct = clamp(value, -10, 40);
      else if (input.dataset.setField === "resistance") set.resistanceLevel = clamp(value, 0, 100);
      else if (input.dataset.setField === "laps") set.laps = Math.max(0, Math.round(value));
      this.persist();
    }));

    root.querySelectorAll<HTMLInputElement>("[data-rest-sec]").forEach(input => input.addEventListener("change", () => {
      const exerciseIndex = Number(input.dataset.restSec);
      const exercise = workout.exercises[exerciseIndex];
      if (!exercise || editingExisting) return;
      const seconds = clamp(Math.round(Number(input.value) || 0), 0, 900);
      exercise.restSec = seconds;
      input.value = String(seconds);
      if (this.restSource?.exerciseIndex === exerciseIndex) this.restSource.targetSec = seconds;
      this.persist();
      this.updateRestTimerDisplay();
    }));

    root.querySelectorAll<HTMLButtonElement>("[data-round-rpe]").forEach(button => button.addEventListener("click", () => {
      const roundIndex = Number(button.dataset.roundIndex);
      const rpe = clamp(Number(button.dataset.roundRpe ?? 3), 1, 5);
      if (!Number.isInteger(roundIndex) || roundIndex < 0) return;
      workout.exercises.forEach(exercise => {
        const set = exercise.sets[roundIndex];
        if (set?.completed) set.rpe = rpe;
      });
      this.persist();
      this.render();
    }));

    root.querySelectorAll<HTMLButtonElement>("[data-remove-circuit-movement]").forEach(button => button.addEventListener("click", () => {
      const exerciseIndex = Number(button.dataset.removeCircuitMovement);
      if (!Number.isInteger(exerciseIndex) || !workout.exercises[exerciseIndex] || editingExisting) return;
      this.confirmAction = { kind: "remove-exercise", exerciseIndex };
      this.render();
    }));

    root.querySelectorAll<HTMLButtonElement>("[data-remove-circuit-round]").forEach(button => button.addEventListener("click", () => {
      const roundIndex = Number(button.dataset.removeCircuitRound);
      const rounds = Math.max(1, workout.circuitRounds ?? Math.max(...workout.exercises.map(ex => ex.sets.length), 1));
      if (editingExisting || !Number.isInteger(roundIndex) || roundIndex < 0 || roundIndex >= rounds || rounds <= 1) return;
      const running = workout.exercises.some(exercise => exercise.sets.some(set => Boolean(set.startedAt)));
      if (running && this.pendingCircuitRoundRemovalIndex !== roundIndex) {
        this.pendingCircuitRoundRemovalIndex = roundIndex;
        this.render();
        return;
      }
      this.pendingCircuitRoundRemovalIndex = null;
      if (this.restSource?.setIndex === roundIndex) this.endRest(true);
      workout.exercises.forEach(exercise => { if (roundIndex < exercise.sets.length) exercise.sets.splice(roundIndex, 1); });
      workout.circuitRounds = rounds - 1;
      this.persist();
      this.render();
    }));

    root.querySelectorAll<HTMLButtonElement>("[data-start-set]").forEach(button => button.addEventListener("click", () => {
      const exerciseIndex = Number(button.dataset.exerciseIndex);
      const setIndex = Number(button.dataset.setIndex);
      const exercise = workout.exercises[exerciseIndex];
      const set = exercise?.sets[setIndex];
      if (!exercise || !set || editingExisting || set.completed) return;
      const anotherSetActive = workout.exercises.some(item => item.sets.some(candidate => candidate.id !== set.id && Boolean(candidate.startedAt) && !candidate.completed));
      if (anotherSetActive) return;
      if (this.restSource) this.endRest(true);
      const now = new Date().toISOString();
      const firstStartedSet = !workout.exercises.some(item => item.sets.some(candidate => Boolean(candidate.startedAt)));
      if (firstStartedSet) workout.startedAt = now;
      set.startedAt = now;
      exercise.startedAt ??= now;
      this.persist();
      this.render();
    }));

    root.querySelectorAll<HTMLButtonElement>("[data-toggle-set]").forEach(button => button.addEventListener("click", () => {
      const exerciseIndex = Number(button.dataset.exerciseIndex);
      const setIndex = Number(button.dataset.setIndex);
      const exercise = workout.exercises[exerciseIndex];
      const set = exercise?.sets[setIndex];
      if (!exercise || !set) return;
      if (!editingExisting && set.completed && this.completedSetIsLocked(workout, set)) return;
      const completing = !set.completed;
      if (completing && !editingExisting) {
        if (this.restSource) this.endRest(true);
        const now = new Date().toISOString();
        const firstStartedSet = !workout.exercises.some(item => item.sets.some(candidate => Boolean(candidate.startedAt)));
        set.startedAt ??= now;
        if (firstStartedSet) workout.startedAt = set.startedAt;
        set.completedAt = now;
        exercise.startedAt ??= set.startedAt;
      }
      set.completed = completing;
      if (!completing && !editingExisting) {
        set.completedAt = undefined;
        set.restAfterSec = undefined;
        exercise.completedAt = undefined;
        exercise.difficulty = undefined;
      }
      const allDone = exercise.sets.length > 0 && exercise.sets.every(item => item.completed);
      if (allDone && !editingExisting) exercise.completedAt = set.completedAt ?? new Date().toISOString();
      this.persist();
      this.render();
      const workoutDone = workout.exercises.length > 0 && workout.exercises.every(item => item.sets.length > 0 && item.sets.every(candidate => candidate.completed));
      const completedDefinition = exerciseById(exercise.exerciseId);
      const completedProfile = completedDefinition ? exerciseLoggingProfile(completedDefinition) : "sets";
      if (completing && !editingExisting && !workoutDone && (completedProfile === "sets" || completedProfile === "rounds")) this.startRest(exercise.restSec, exerciseIndex, setIndex);
    }));

    root.querySelectorAll<HTMLButtonElement>("[data-add-set]").forEach(button => button.addEventListener("click", () => {
      const exerciseIndex = Number(button.dataset.addSet);
      const exercise = workout.exercises[exerciseIndex];
      if (!exercise) return;
      const previous = exercise.sets.at(-1);
      exercise.sets.push({ id: uid("set"), weightKg: previous?.weightKg, reps: previous?.reps, durationSec: previous?.durationSec, distanceKm: previous?.distanceKm, speedKph: previous?.speedKph, inclinePct: previous?.inclinePct, resistanceLevel: previous?.resistanceLevel, laps: previous?.laps, completed: false, setType: previous?.setType ?? "normal" });
      this.persist(); this.render();
    }));

    root.querySelectorAll<HTMLButtonElement>("[data-remove-set]").forEach(button => button.addEventListener("click", () => {
      const exerciseIndex = Number(button.dataset.exerciseIndex);
      const setIndex = Number(button.dataset.setIndex);
      const exercise = workout.exercises[exerciseIndex];
      const removed = exercise?.sets[setIndex];
      if (!exercise || !removed) return;
      const editingExisting = this.state.workouts.some(item => item.id === workout.id);
      if (!editingExisting && removed.completed) return;
      const removalKey = `${exerciseIndex}:${setIndex}`;
      const running = workout.exercises.some(item => item.sets.some(candidate => Boolean(candidate.startedAt)));
      if (!editingExisting && running && this.pendingSetRemovalKey !== removalKey) {
        this.pendingSetRemovalKey = removalKey;
        this.render();
        return;
      }
      this.pendingSetRemovalKey = null;
      if (this.restSource?.exerciseIndex === exerciseIndex && this.restSource.setIndex === setIndex) this.endRest(true);
      exercise.sets.splice(setIndex, 1);
      this.persist(); this.render();
      this.toast(this.locale === "zh-TW" ? "已刪除這一組" : "Set removed", this.text("undo"), () => { exercise.sets.splice(setIndex, 0, removed); this.persist(); this.render(); });
    }));

    root.querySelectorAll<HTMLButtonElement>("[data-remove-exercise]").forEach(button => button.addEventListener("click", () => {
      const exerciseIndex = Number(button.dataset.removeExercise);
      this.confirmAction = { kind: "remove-exercise", exerciseIndex };
      this.render();
    }));

    root.querySelectorAll<HTMLButtonElement>("[data-difficulty]").forEach(button => button.addEventListener("click", () => {
      const exerciseIndex = Number(button.dataset.exerciseIndex);
      const difficulty = clamp(Number(button.dataset.difficulty ?? 3), 1, 5) as 1 | 2 | 3 | 4 | 5;
      const exercise = workout.exercises[exerciseIndex];
      if (!exercise) return;
      exercise.difficulty = difficulty;
      if (!editingExisting) exercise.completedAt ??= new Date().toISOString();
      this.persist(); this.render();
    }));

    const workoutPhotoInput = root.querySelector<HTMLInputElement>("#workout-photo-input");
    workoutPhotoInput?.addEventListener("change", async () => {
      const file=workoutPhotoInput.files?.[0]; if (!file) return;
      try { const id=`workout_${workout.id}`; await savePrivateImage(file,id,1280); workout.photoId=id; this.persist(); this.render(); this.toast(this.locale === "zh-TW" ? "運動照片已儲存於本機" : "Workout photo saved locally"); } catch (error) { this.toast(error instanceof Error ? error.message : "Photo failed"); }
    });

    const notes = root.querySelector<HTMLTextAreaElement>("#workout-notes");
    notes?.addEventListener("input", () => { workout.notes = notes.value; this.persist(); });


    root.querySelector('[data-action="save-routine"]')?.addEventListener("click", () => {
      workout.routineName = workout.routineName.trim() || (this.locale === "zh-TW" ? "運動" : "Workout");
      const routine = routineFromWorkout(workout);
      const existingIndex = this.state.routines?.findIndex(item => item.name.toLowerCase() === routine.name.toLowerCase()) ?? -1;
      if (existingIndex >= 0) { routine.id = this.state.routines![existingIndex]!.id; this.state.routines![existingIndex] = routine; }
      else this.state.routines!.unshift(routine);
      this.persist(); this.toast(this.text("routineSaved"));
    });

    root.querySelector('[data-action="finish-workout"]')?.addEventListener("click", () => {
      if (workout.exercises.length === 0) { this.toast(this.text("workoutEmptyError")); return; }
      workout.routineName = workout.routineName.trim() || (this.locale === "zh-TW" ? "運動" : "Workout");
      const existingIndex = this.state.workouts.findIndex(item => item.id === workout.id);
      const nowIso = new Date().toISOString();
      if (existingIndex >= 0) {
        const existing = this.state.workouts[existingIndex]!;
        const startValue = root.querySelector<HTMLInputElement>("#workout-start-at")?.value ?? this.toDateTimeLocal(existing.startedAt);
        const endValue = root.querySelector<HTMLInputElement>("#workout-end-at")?.value ?? this.toDateTimeLocal(existing.completedAt ?? undefined);
        const newStart = this.dateTimeInputToIso(startValue, existing.startedAt);
        const newEnd = this.dateTimeInputToIso(endValue, existing.completedAt ?? nowIso);
        if (new Date(newEnd).getTime() < new Date(newStart).getTime()) { this.toast(this.locale === "zh-TW" ? "結束時間不能早於開始時間" : "End time cannot be earlier than start time"); return; }
        if (new Date(newEnd).getTime() > Date.now() + 60_000) { this.toast(this.locale === "zh-TW" ? "紀錄不能設到未來" : "Records cannot be moved into the future"); return; }
        const oldStartMs = new Date(existing.startedAt).getTime();
        const oldEndMs = new Date(existing.completedAt ?? existing.startedAt).getTime();
        const newStartMs = new Date(newStart).getTime();
        const newEndMs = new Date(newEnd).getTime();
        const remap = (value: string | undefined): string | undefined => {
          if (!value) return value;
          const ms = new Date(value).getTime();
          if (!Number.isFinite(ms)) return value;
          if (oldEndMs > oldStartMs) {
            const ratio = clamp((ms - oldStartMs) / (oldEndMs - oldStartMs), 0, 1);
            return new Date(newStartMs + ratio * (newEndMs - newStartMs)).toISOString();
          }
          return new Date(ms + (newStartMs - oldStartMs)).toISOString();
        };
        for (const exercise of workout.exercises) {
          exercise.startedAt = remap(exercise.startedAt);
          exercise.completedAt = remap(exercise.completedAt);
          for (const set of exercise.sets) { set.startedAt = remap(set.startedAt); set.completedAt = remap(set.completedAt); }
        }
        workout.startedAt = newStart;
        workout.completedAt = newEnd;
        workout.editedAt = nowIso;
      } else {
        workout.completedAt = nowIso;
      }
      if (this.authUser && this.cloudMembership?.access.status === "active" && existingIndex < 0) {
        workout.ownerId = this.authUser.uid;
        workout.familyId = this.cloudMembership.access.familyId;
      }
      workout.visibility = "family";
      workout.selectedViewerIds = [];
      workout.updatedAt = nowIso;
      workout.estimatedCalories = undefined;
      workout.estimatedCalories = this.workoutCaloriesForSync(workout);
      if (existingIndex >= 0) this.state.workouts[existingIndex] = workout;
      else this.state.workouts.unshift(workout);
      this.endRest(true);
      this.state.activeWorkout = null;
      this.persist(); this.navigate("history"); this.toast(existingIndex >= 0 ? this.text("saveChanges") : this.text("workoutSaved"));
      void this.pushWorkoutToCloud(workout);
    });
  }

  private bindHikeEvents(): void {
    const form = root.querySelector<HTMLFormElement>("#hike-form");
    const gpxInput = root.querySelector<HTMLInputElement>("#gpx-input");
    gpxInput?.addEventListener("change", async () => {
      const file = gpxInput.files?.[0];
      if (!file || !form) return;
      const preview = root.querySelector<HTMLDivElement>("#gpx-preview");
      try {
        if (file.size > 8 * 1024 * 1024) throw new Error(this.locale === "zh-TW" ? "GPX 檔案過大（上限 8 MB）" : "GPX file is too large (8 MB max)");
        const summary = parseGpx(await file.text());
        this.pendingHikeGpx = summary;
        const setValue = (name: string, value: number | undefined) => {
          const input = form.elements.namedItem(name) as HTMLInputElement | null;
          if (input && value !== undefined) input.value = String(value);
        };
        setValue("distance", summary.distanceKm);
        setValue("gain", summary.elevationGainM);
        setValue("loss", summary.elevationLossM);
        setValue("highest", summary.highestPointM);
        if (summary.elapsedMinutes) setValue("elapsed", summary.elapsedMinutes);
        if (preview) {
          const sample = summary.points.filter((_, index) => index % Math.max(1, Math.floor(summary.points.length / 120)) === 0).slice(0, 140);
          const lats = sample.map(point => point.lat), lons = sample.map(point => point.lon);
          const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
          const latRange = Math.max(0.000001, maxLat - minLat), lonRange = Math.max(0.000001, maxLon - minLon);
          const points = sample.map(point => `${10 + ((point.lon-minLon)/lonRange)*280},${110-((point.lat-minLat)/latRange)*100}`).join(" ");
          preview.hidden = false;
          preview.innerHTML = `<div class="gpx-preview-head"><strong>${escapeHtml(file.name)}</strong><span>${summary.distanceKm.toFixed(2)} km · +${summary.elevationGainM} m</span></div><svg viewBox="0 0 300 120" role="img" aria-label="GPS route preview"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="tiny muted">${this.locale === "zh-TW" ? "測試版會在本機解析 GPX，並保存精簡後的路線軌跡，之後可在歷史紀錄中查看。" : "GPX is parsed locally in this demo. A compact route trace will be kept with this hike so it can appear in History."}</div>`;
        }
      } catch (error) {
        this.pendingHikeGpx = null;
        if (preview) { preview.hidden = false; preview.textContent = this.locale === "zh-TW" ? "無法讀取這個 GPX 檔案。" : "Could not read this GPX file."; }
      }
    });
    form?.addEventListener("submit", async event => {
      event.preventDefault();
      const data = new FormData(form);
      const moving = Number(data.get("moving") ?? 0);
      const elapsed = Math.max(moving, Number(data.get("elapsed") ?? moving));
      const existingIndex = this.editingHikeId ? this.state.hikes.findIndex(item => item.id === this.editingHikeId) : -1;
      const existing = existingIndex >= 0 ? this.state.hikes[existingIndex] : undefined;
      const recordDate = String(data.get("date") ?? "");
      const startTime = String(data.get("startTime") ?? "");
      const startedAt = recordDate && /^\d{2}:\d{2}$/.test(startTime) ? new Date(`${recordDate}T${startTime}:00`).toISOString() : existing?.startedAt;
      if (startedAt && new Date(startedAt).getTime() > Date.now() + 60_000) { this.toast(this.locale === "zh-TW" ? "健行時間不能設到未來" : "Hike time cannot be in the future"); return; }
      const record: HikeRecord = {
        schemaVersion: 1,
        id: existing?.id ?? uid("hike"), ownerId: existing?.ownerId ?? this.state.user.id, familyId: existing?.familyId ?? this.state.user.familyId, activityKind: existing?.activityKind ?? "hike",
        name: String(data.get("name") ?? "").trim(), date: recordDate,
        distanceKm: Math.max(0, Number(data.get("distance") ?? 0)), movingMinutes: moving, elapsedMinutes: elapsed,
        elevationGainM: Math.max(0, Number(data.get("gain") ?? 0)), elevationLossM: Math.max(0, Number(data.get("loss") ?? 0)),
        highestPointM: Number(data.get("highest") ?? 0) || undefined,
        difficulty: clamp(Number(data.get("difficulty") ?? 3), 1, 5) as 1 | 2 | 3 | 4 | 5,
        waterMl: existing?.waterMl ?? 0, notes: String(data.get("notes") ?? "").trim(),
        visibility: "family", selectedViewerIds: [],
        photoId: existing?.photoId, routePoints: existing?.routePoints, routeSource: existing?.routeSource,
        ...(startedAt ? { startedAt } : {}), ...(existingIndex >= 0 ? { editedAt: new Date().toISOString() } : {}),
        updatedAt: new Date().toISOString(), cloudSyncedAt: existing?.cloudSyncedAt
      };
      if (!record.name || !record.date || record.distanceKm <= 0) return;
      if (this.pendingHikeGpx) {
        const raw = this.pendingHikeGpx.points; const step = Math.max(1, Math.ceil(raw.length / 220));
        record.routePoints = raw.filter((_,index)=>index % step === 0 || index === raw.length-1).map(point=>({lat:point.lat,lon:point.lon,elevation:point.elevation}));
        record.routeSource = "gpx";
      }
      const hikePhoto=root.querySelector<HTMLInputElement>("#hike-photo-input")?.files?.[0];
      if(hikePhoto){ try{ const id=`hike_${record.id}`; await savePrivateImage(hikePhoto,id,1280); record.photoId=id; } catch(error){ this.toast(error instanceof Error ? error.message : "Photo failed"); } }
      if (existingIndex >= 0) this.state.hikes[existingIndex] = record;
      else this.state.hikes.unshift(record);
      this.pendingHikeGpx = null;
      this.editingHikeId = null;
      this.selectedCalendarDate = record.date;
      this.calendarMonth = new Date(`${record.date}T12:00:00`);
      this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth(), 1);
      this.persist(); this.navigate("history"); void this.pushHikeToCloud(record);
      this.toast(existingIndex >= 0 ? (this.locale === "zh-TW" ? "健行紀錄已更新" : "Hike updated") : `${record.name} · ${record.distanceKm.toFixed(1)} km · ${averagePace(record.distanceKm, record.movingMinutes)}`);
    });
  }
}

async function bootstrapLogTogether(): Promise<void> {
  const inviteCode = cloudModeEnabled() ? inviteCodeFromLocation() : null;
  const offlineAccount = cloudModeEnabled() ? loadRememberedOfflineAccount() : null;
  const localScope = cloudModeEnabled() ? preferredLocalScope() : "";
  const state = await loadStateAsync(!cloudModeEnabled(), localScope || undefined);
  new FamilyExerciseApp(state, localScope, offlineAccount, inviteCode);
}

void bootstrapLogTogether().catch(error => {
  console.error("LogTogether bootstrap:", error);
  root.innerHTML = `<main class="page"><section class="section"><div class="card"><strong>LogTogether could not open its local database.</strong><p class="small muted">Reload the app. Your existing local backup data has not been intentionally deleted.</p></div></section></main>`;
});
