import { workTargetSeconds, completedActiveSeconds, goalsForWeek, rememberWeekPlan } from "./core/training.js";
import { t } from "./core/i18n.js";
import { EXERCISES, EXERCISE_LIBRARY_GROUPS, exerciseById, exerciseDirectSecondaryCategories, exerciseEntryLoggingProfile, exerciseLaterality, exerciseLibraryGroup, exerciseLoggingProfile, exerciseMovementPattern, exerciseProgressionProfile, exerciseSafetyFlags, exerciseScienceLoggingProfile, exerciseSessionMetricFlags, exerciseStarterDefault } from "./core/exercises.js";
import { averagePace, completedSetCount, formatDuration } from "./core/metrics.js";
import { ALL_CATEGORIES, caloriesOnDate, categoryDistributionForDate, currentWeekBounds, dailyCalorieSeries, estimateWorkoutCalories, goalPreset, hydrationByDate, legacyMonthlyGoalScore, localDateKey, meaningfulActivityScoreOnDate, monthlyCalorieSeries, monthlyGoalProgress, monthlyGoalScore, scienceMissionTargets, scienceWeekMetrics, weekKey, weeklyCategorySets, weeklyGoalScore, weeklyHealthGuidelineProgress, weeklyHydrationSeries, workoutDurationMinutes, workoutsInCurrentWeek } from "./core/analytics.js";
import { clearLocalTestState, createBlankWorkout, createLocalBackup, forgetRememberedOfflineAccount, freshWorkoutFromPrevious, loadRememberedOfflineAccount, loadStateAsync, localStructuredStorageBackend, mergeLocalStateForCloud, parseLocalBackup, preferredLocalScope, rememberLocalScope, rememberOfflineAccount, resetState, routineFromWorkout, saveImportRollback, saveState, saveStateVerified, uid, workoutFromRoutine } from "./core/store.js";
import { diagnosticsJson } from "./core/diagnostics.js";
import { familyPrivacySummary } from "./core/privacy.js";
import type { AppState, CustomSupplement, ExerciseCategory, ExerciseDefinition, ExerciseLibraryGroup, FamilyProfileSharing, GoalDifficulty, HikeBadgePreference, HikeRecord, HydrationDay, Locale, NotificationPreferences, PersonalActivityId, ProfileData, SetEntry, SupplementEntry, SupplementUnit, WorkoutExerciseEntry, WorkoutRecord, WorkoutRoutine } from "./core/types.js";
import { appCheckRuntimeStatus, claimFamilyInvite, cloudModeEnabled, createFamilyGroup, createFamilyInvite, DEFAULT_GROUP_ID, deleteCloudBadge, deleteCloudHike, deleteCloudWorkout, deleteFamilyGroup, disablePushNotifications, enablePushNotifications, ensureCloudGroupModel, findRecoverableFamilyInvites, loadCloudCompanionState, loadCloudHikes, loadCloudMembership, loadCloudWorkouts, loadPokeWallet, loadBackendDiagnostics, sendTestNotification, observeFirebaseAuth, observePokeWallet, consumeGoogleRedirectSignIn, googleSignInRedirectPending, clearGoogleRedirectSignInPending, currentFirebaseAuthUser, observeSocialInbox, pushRegistrationStatus, renameFamilyGroup, saveCloudBadges, saveCloudBodyMetrics, saveCloudHike, saveCloudHydrationDay, saveCloudPreferences, saveCloudSupplementDay, saveCloudWorkout, saveFamilyDailySummary, saveFamilyWeeklySummary, seedGoogleMemberIdentity, sendPoke, setFamilyMemberAccessStatus, setFamilyMemberGroups, setOwnerShareGroups, updateMyFamilyDisplayName, signInWithGoogle, signOutFirebase } from "./services/firebase-client.js";
import type { BackendDiagnostics, CloudBadgeRecord, CloudCompanionSnapshot, CloudFamilyDailySummary, CloudFamilyWeeklySummary, CloudHikeEnvelope, CloudMembership, CloudWorkoutEnvelope, CreatedFamilyInvite, FirebaseAuthUser, SocialInboxEvent } from "./services/firebase-client.js";
import { clearPrivateImages, deletePrivateImage, getPrivateImage, savePrivateImage } from "./core/media.js";
import { parseGpx } from "./core/gpx.js";
import { qrSvg } from "./core/qr.js";
import type { GpxPoint, GpxSummary } from "./core/gpx.js";

type Page = "home" | "history" | "water" | "family" | "familyMember" | "profile" | "settings" | "workout" | "activity" | "hike";
type HistoryFilter = "all" | "live" | "logged";
type TrendMode = "weekly" | "monthly";
type ConfirmAction =
  | { kind: "discard-active" }
  | { kind: "remove-exercise"; exerciseIndex: number }
  | { kind: "remove-circuit-round"; roundIndex: number }
  | { kind: "skip-set"; exerciseIndex: number; setIndex: number }
  | { kind: "delete-workout"; id: string }
  | { kind: "delete-hike"; id: string }
  | { kind: "delete-routine"; id: string }
  | { kind: "delete-custom-supplement"; id: string; label: string }
  | { kind: "revoke-member"; uid: string; name: string };
type WeightReminderAction =
  | { kind: "workout" }
  | { kind: "routine"; routineId: string }
  | { kind: "hike" }
  | { kind: "activity" }
  | { kind: "circuit" };

type HistoryActivity =
  | { kind: "workout"; id: string; date: string; workout: WorkoutRecord }
  | { kind: "hike"; id: string; date: string; hike: HikeRecord };

const APP_VERSION = "0.15.0";

// TEMPORARY v0.11.x owner-only visual regression harness.
// Remove this constant + renderDeveloperEffectTests/bind handlers when family-alpha visual testing is complete.
const DEVELOPER_EFFECT_TESTS_V0117 = true;

type VisualPresentation =
  | { kind: "poke"; event: SocialInboxEvent; socialEventIds?: string[] }
  | { kind: "social"; event: SocialInboxEvent; socialEventIds?: string[] }
  | { kind: "milestone"; milestoneKind: "gold" | "water" | "badge"; title: string; emoji: string };

const root = document.querySelector<HTMLDivElement>("#app")!;
if (!root) throw new Error("Missing #app root");

const PENDING_INVITE_SESSION_SLOT = "logtogether-pending-invite-v0117";
const PENDING_INVITE_LOCAL_SLOT = "logtogether-pending-invite-v0140";
const CLOUD_RECONNECT_SLOT = "logtogether-cloud-reconnect-v0150";

function cloudReconnectRequested(): boolean {
  try { return localStorage.getItem(CLOUD_RECONNECT_SLOT) === "1"; }
  catch { return false; }
}

function rememberCloudReconnectRequest(): void {
  try { localStorage.setItem(CLOUD_RECONNECT_SLOT, "1"); }
  catch { /* Best effort: the current session can still continue. */ }
}

function clearCloudReconnectRequest(): void {
  try { localStorage.removeItem(CLOUD_RECONNECT_SLOT); }
  catch { /* Best effort only. */ }
}

function inviteCodeFromLocation(): string | null {
  try {
    const hash = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
    const fromLocation = new URLSearchParams(hash).get("invite")?.trim() ?? "";
    if (fromLocation && !fromLocation.includes("/") && fromLocation.length <= 128) {
      try {
        sessionStorage.setItem(PENDING_INVITE_SESSION_SLOT, fromLocation);
        localStorage.setItem(PENDING_INVITE_LOCAL_SLOT, JSON.stringify({code:fromLocation,savedAt:Date.now()}));
      } catch { /* Storage is optional; the URL still works. */ }
      return fromLocation;
    }
    const remembered = sessionStorage.getItem(PENDING_INVITE_SESSION_SLOT)?.trim() ?? "";
    if (remembered && !remembered.includes("/") && remembered.length <= 128) return remembered;
    const local = JSON.parse(localStorage.getItem(PENDING_INVITE_LOCAL_SLOT) ?? "null") as {code?:unknown;savedAt?:unknown}|null;
    const code = typeof local?.code === "string" ? local.code.trim() : "";
    const savedAt = typeof local?.savedAt === "number" ? local.savedAt : 0;
    if (code && !code.includes("/") && code.length <= 128 && Date.now()-savedAt < 7*24*60*60*1000) return code;
    localStorage.removeItem(PENDING_INVITE_LOCAL_SLOT);
    return null;
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    window.clearTimeout(timer);
  }
}

function formatBytes(bytes: number): string {
  const value = Math.max(0, bytes);
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KiB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(value < 10 * 1024 ** 2 ? 1 : 0)} MiB`;
  return `${(value / 1024 ** 3).toFixed(2)} GiB`;
}

function icon(name: "home" | "history" | "family" | "settings" | "dumbbell" | "mountain" | "drop" | "waterPill" | "back" | "trash" | "plus" | "chevron" | "check" | "pencil"): string {
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
    check: '<path d="m5 12 4 4L19 6"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>'
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
  private manualActivityExerciseId = "run";
  private exerciseLibraryFilter: ExerciseLibraryGroup | "all" = "all";
  private historyFilter: HistoryFilter = "all";
  private expandedHistoryKey: string | null = null;
  private expandedExerciseKey: string | null = null;
  private lightboxPhoto: { id: string; alt: string } | null = null;
  private trendMode: TrendMode = "weekly";
  private homeProgressMode: "missions" | "calories" = "missions";
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
  private weightReminderAction: WeightReminderAction | null = null;
  private toastTimer: number | null = null;
  private mediaUrls: string[] = [];
  private showCircuitBuilder = false;
  private workoutComposerMode: "workout" | "circuit" = "workout";
  private circuitDraftName = "Daily Circuit";
  private circuitDraftRounds = 3;
  private circuitDraftRows: Array<{ exerciseId: string; reps: number; weightKg: number; targetWorkSec: number; durationSec: number; distanceKm: number; minutes: number; restSec: number }> = [
    { exerciseId: "pull_up", reps: 7, weightKg: 0, targetWorkSec: 0, durationSec: 30, distanceKm: 1, minutes: 10, restSec: 45 },
    { exerciseId: "push_up", reps: 25, weightKg: 0, targetWorkSec: 0, durationSec: 30, distanceKm: 1, minutes: 10, restSec: 45 },
    { exerciseId: "bodyweight_squat", reps: 40, weightKg: 0, targetWorkSec: 0, durationSec: 30, distanceKm: 1, minutes: 10, restSec: 45 },
    { exerciseId: "bodyweight_calf_raise", reps: 60, weightKg: 0, targetWorkSec: 0, durationSec: 30, distanceKm: 1, minutes: 10, restSec: 45 }
  ];
  private selectedFamilyMemberUid: string | null = null;
  private previewGoalMode: GoalDifficulty | null = null;
  private pendingHikeGpx: GpxSummary | null = null;
  private editingHikeId: string | null = null;
  private showGoalDifficultyMenu = false;
  private authUser: FirebaseAuthUser | null = null;
  private authReady = true;
  private authError: string | null = null;
  private authInteractiveStatus: "connecting" | "redirecting" | "finishing" | null = null;
  private authInteractiveWatchdog = 0;
  private cloudMembership: CloudMembership | null = null;
  private cloudMembershipReady = true;
  private cloudMembershipRefreshPromise: Promise<void> | null = null;
  private pendingInviteCode: string | null = null;
  private installPrompt: any = null;
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
  private familyComparisonMetric: "activity" | "calories" | "water" = "activity";
  private familyComparisonFocus: "self" | "member" = "member";
  private routineDraft: WorkoutRoutine | null = null;
  private selectedRoutineManagerId = "";
  private routineBulkMode = false;
  private routineDeleteIds = new Set<string>();
  private folds = new Set<string>();
  private logAt = "";
  private customWaterOpen = false;
  private missionTutorialOpen = false;
  private missionTutorialPage = 0;
  private supplementWeekFilter = "all";
  private supplementWeekOpen = false;
  private waterEntriesEditing = false;
  private supplementEntriesEditing = false;
  private editingCustomSupplementId: string | null = null;
  private supplementLogOpen = false;
  private customSupplementManagerOpen = false;
  private supplementDraftId = "";
  private supplementDraftAmount = 1;
  private supplementDraftUnit: SupplementUnit = "serving";
  private developerCalendarPreview: "gold" | "water" | null = null;
  private visualPresentationQueue: VisualPresentation[] = [];
  private visualPresentationActive = false;
  private queuedSocialEventIds = new Set<string>();
  private hikeBadgeEditMode = false;
  private audioContext: AudioContext | null = null;
  private timerAudioSingle: HTMLAudioElement | null = null;
  private timerAudioDouble: HTMLAudioElement | null = null;
  private workDeadlineKey: string | null = null;
  private restDeadlineKey: string | null = null;
  private wakeLock: any = null;
  private pushStatus: { supported:boolean; configured:boolean; permission:NotificationPermission|"unsupported"; subscribed:boolean } | null = null;
  private pushBusy = false;
  private notificationPromptShown = false;
  private familyNotificationPromptOpen = false;
  private socialInboxUnsubscribe: (()=>void) | null = null;
  private socialInboxStarting = false;
  private pokeWalletUnsubscribe: (()=>void) | null = null;
  private pokeWalletStarting = false;
  private pokeBalance = 0;
  private pokeBusy = false;
  private backendDiagnostics: BackendDiagnostics | null = null;
  private backendDiagnosticsBusy = false;

  constructor(initialState: AppState, initialScope: string, offlineAccount: ReturnType<typeof loadRememberedOfflineAccount>, inviteCode: string | null) {
    this.state = initialState;
    this.localScope = initialScope;
    this.offlineAccount = offlineAccount;
    this.pendingInviteCode = inviteCode;
    if (inviteCode) this.page = "settings";
    this.authInteractiveStatus = googleSignInRedirectPending() ? "finishing" : null;
    // A user-initiated reconnect survives a hard reload until active Cloud access
    // is confirmed. This avoids dropping back to anonymous Local mode if the
    // popup succeeds but a Firestore membership check is temporarily delayed.
    this.cloudAccessRequested = Boolean(inviteCode || offlineAccount || this.authInteractiveStatus || cloudReconnectRequested());
    this.ensureExtendedState();
    this.restoreRestFromActiveWorkout();
    this.persist();
    this.applyTheme();
    window.addEventListener("online", () => this.handleConnectivityChange(true));
    window.addEventListener("offline", () => this.handleConnectivityChange(false));
    window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); this.installPrompt=event; this.render(); });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        void this.syncWakeLock();
        // Timers are timestamp-based. If iOS suspended the PWA in another app,
        // immediately recover the correct countdown/overtime state on return
        // and fire any deadline cue that has not already been acknowledged.
        this.updateRestTimerDisplay();
        this.drainVisualPresentationQueue();
        // Some mobile OAuth surfaces return control before the popup Promise
        // settles. Probe Firebase's persisted auth state after the app becomes
        // visible instead of forcing the user to discover a manual refresh.
        if (this.authInteractiveStatus) window.setTimeout(() => { void this.recoverInteractiveGoogleSignIn(false); }, 750);
      }
    });
    // iOS owns the Shake to Undo popup and does not expose its native switch to
    // Home Screen web apps. Keep an undo gesture from changing live workout
    // fields, and release editable focus as soon as physical work starts.
    document.addEventListener("beforeinput", event => {
      const input = event as InputEvent;
      if (this.page === "workout" && ["historyUndo","historyRedo"].includes(input.inputType)) event.preventDefault();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && this.lightboxPhoto) { this.lightboxPhoto = null; this.render(); }
    });
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
    this.state.goals.personalActivityId ??= "none";
    const currentPlan = this.state.goals.weeklyPlans?.[weekKey()];
    if (["any","jump_rope"].includes(this.state.goals.personalActivityId)) this.state.goals.personalActivityId = "none";
    if (currentPlan && ["any","jump_rope"].includes(currentPlan.personalActivityId)) currentPlan.personalActivityId = "none";
    const legacySelections = this.state.goals.personalActivityIds?.length
      ? this.state.goals.personalActivityIds
      : (this.state.goals.personalActivityId === "none" ? [] : [this.state.goals.personalActivityId]);
    this.state.goals.personalActivityIds = legacySelections
      .filter((value, index, all): value is PersonalActivityId => !["none","any","jump_rope"].includes(value) && all.indexOf(value) === index)
      .slice(0,2);
    this.state.goals.personalActivityId = this.state.goals.personalActivityIds[0] ?? "none";
    if (currentPlan) {
      currentPlan.personalActivityIds = (currentPlan.personalActivityIds?.length ? currentPlan.personalActivityIds : (currentPlan.personalActivityId === "none" ? [] : [currentPlan.personalActivityId]))
        .filter((value, index, all): value is PersonalActivityId => !["none","any","jump_rope"].includes(value) && all.indexOf(value) === index)
        .slice(0,2);
      currentPlan.personalActivityId = currentPlan.personalActivityIds[0] ?? "none";
    }
    rememberWeekPlan(this.state.goals, weekKey());
    if (!this.state.science) {
      const effectiveFrom = weekKey();
      const earnedMonthlyBadges = Array.from({length:12},(_,offset)=>{
        const month = new Date(); month.setMonth(month.getMonth()-offset,1);
        if (localDateKey(month).slice(0,7) >= effectiveFrom.slice(0,7)) return null;
        const end = new Date(month.getFullYear(),month.getMonth()+1,0,23,59,59);
        const completed = legacyMonthlyGoalScore(this.state.workouts,this.state.hikes,this.currentWeightKg(),this.state.goals!,this.state.hydration,this.state.hydrationHistory ?? [],end);
        return completed >= 35 ? { month:localDateKey(month).slice(0,7), earnedAt:end.toISOString(), completed, available:40, required:35, scoringVersion:1 as const } : null;
      }).filter((item): item is NonNullable<typeof item> => Boolean(item));
      this.state.science = { scoringVersion:2, exerciseDefaultsVersion:2, effectiveFrom, earnedMonthlyBadges };
    }
    this.state.science.earnedMonthlyBadges ??= [];
    this.state.hydrationHistory ??= [];
    this.state.supplementHistory ??= [];
    this.state.customSupplements ??= [];
    this.state.seenSocialEventIds ??= [];
    this.state.hikeBadgePreferences ??= [];
    const today = localDateKey(new Date());
    if (this.state.hydration.date !== today) {
      if (!this.state.hydrationHistory.some(day => day.date === this.state.hydration.date)) this.state.hydrationHistory.push(structuredClone(this.state.hydration));
      const previousTarget = this.state.hydration.targetMl || 2000;
      this.state.hydration = { schemaVersion: 1, date: today, userId: this.state.user.id, familyId: this.state.user.familyId, targetMl: previousTarget, totalMl: 0, entries: [], visibility: "private" };
    }
    this.state.accentColor ??= "#62d995";
    this.state.workoutPreferences ??= { restTimerSound:true, keepScreenAwake:true };
    this.state.workoutPreferences.restTimerSound ??= true;
    this.state.workoutPreferences.keepScreenAwake ??= true;
    this.state.notificationPreferences ??= { goldDays:true, badges:true, pokes:true, mutedPokeUids:[], mutedPokeGroupIds:[] };
    if (this.state.notificationDefaultsV11_1Applied !== true) {
      this.state.notificationPreferences.goldDays = true;
      this.state.notificationPreferences.badges = true;
      this.state.notificationPreferences.pokes = true;
      this.state.notificationDefaultsV11_1Applied = true;
    }
    this.state.notificationPreferences.mutedPokeUids ??= [];
    this.state.notificationPreferences.mutedPokeGroupIds ??= [];
    this.state.stories ??= [];
    this.state.sync ??= { deletedWorkoutIds: [] };
    this.state.sync.deletedWorkoutIds ??= [];
    const now = Date.now();
    const expired = this.state.stories.filter(story => new Date(story.expiresAt).getTime() <= now);
    this.state.stories = this.state.stories.filter(story => new Date(story.expiresAt).getTime() > now);
    expired.forEach(story => void deletePrivateImage(story.mediaId).catch(() => undefined));
  }

  private async handleObservedAuthState(user: FirebaseAuthUser | null): Promise<void> {
    const previousUid = this.authUser?.uid ?? null;
    const alreadyResolved = Boolean(user && previousUid === user.uid && this.cloudMembership?.access.status === "active");
    if (!user || (previousUid && user.uid !== previousUid)) this.stopPokeWalletObserver();
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
    if (alreadyResolved) { this.render(); return; }
    await this.refreshCloudMembership(user);
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
    const redirectPending = googleSignInRedirectPending();
    if (redirectPending) this.authInteractiveStatus = "finishing";
    this.render();
    try {
      // Attach the persistent auth observer before consuming a redirect result.
      // If WebKit delays getRedirectResult(), an already-persisted Firebase user
      // can still restore Cloud access instead of trapping the UI on Almost there.
      await observeFirebaseAuth(user => { void this.handleObservedAuthState(user); });
      this.authObserverAttached = true;
      if (redirectPending) {
        try {
          const redirectUser = await withTimeout(
            consumeGoogleRedirectSignIn(),
            12_000,
            this.locale === "zh-TW" ? "Google 登入回傳逾時，正在改用已儲存的登入狀態。" : "Google sign-in return timed out; checking the saved sign-in state instead."
          );
          if (redirectUser) await this.handleObservedAuthState(redirectUser);
        } catch (error) {
          clearGoogleRedirectSignInPending();
          const recovered = await withTimeout(currentFirebaseAuthUser(), 5_000, "Firebase auth-state recovery timed out.").catch(() => null);
          if (recovered) await this.handleObservedAuthState(recovered);
          else {
            this.authError = this.googleAuthErrorMessage(error);
            console.warn("Firebase Auth redirect completion:", error);
          }
        } finally {
          this.authInteractiveStatus = null;
        }
      }
    } catch (error) {
      this.authReady = true;
      this.cloudMembershipReady = true;
      this.authInteractiveStatus = null;
      this.authError = this.googleAuthErrorMessage(error);
      console.warn("Firebase Auth:", error);
      this.render();
    } finally {
      this.authInitBusy = false;
      this.render();
    }
  }

  private clearAuthInteractiveWatchdog(): void {
    if (!this.authInteractiveWatchdog) return;
    window.clearTimeout(this.authInteractiveWatchdog);
    this.authInteractiveWatchdog = 0;
  }

  private armAuthInteractiveWatchdog(): void {
    this.clearAuthInteractiveWatchdog();
    this.authInteractiveWatchdog = window.setTimeout(() => {
      this.authInteractiveWatchdog = 0;
      void this.recoverInteractiveGoogleSignIn(true);
    }, 15_000);
  }

  private async recoverInteractiveGoogleSignIn(expired: boolean): Promise<void> {
    if (!this.authInteractiveStatus || !this.cloudAccessRequested || document.visibilityState !== "visible") return;
    const recovered = await withTimeout(currentFirebaseAuthUser(), 5_000, "Firebase auth-state recovery timed out.").catch(() => null);
    if (recovered) {
      this.authInteractiveStatus = "finishing";
      this.render();
      await this.handleObservedAuthState(recovered);
      this.authInteractiveStatus = null;
      this.clearAuthInteractiveWatchdog();
      this.render();
      return;
    }
    if (!expired) return;
    this.authInteractiveStatus = null;
    this.authError = this.locale === "zh-TW"
      ? "Google 登入沒有回到這個 LogTogether 視窗。請再按一次登入；iPhone／iPad 會改用整頁重新導向以避免卡住。"
      : "Google sign-in did not return to this LogTogether window. Try again; iPhone/iPad will use a full-page redirect to avoid getting stuck.";
    this.render();
  }

  private googleAuthErrorMessage(error: unknown): string {
    const code = typeof error === "object" && error && "code" in error ? String((error as any).code ?? "") : "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return this.locale === "zh-TW" ? "Google 登入已取消。" : "Google sign-in was cancelled.";
    if (code === "auth/network-request-failed") return this.locale === "zh-TW" ? "網路連線失敗，請確認網路後再試一次。" : "Network request failed. Check your connection and try again.";
    if (code === "auth/unauthorized-domain") return this.locale === "zh-TW" ? "此網址尚未被 Firebase Auth 授權。" : "This site is not yet authorized for Firebase Authentication.";
    if (code === "auth/web-storage-unsupported") return this.locale === "zh-TW" ? "此瀏覽器限制登入儲存空間，請改用一般分頁或允許網站儲存空間。" : "This browser is blocking the storage required for sign-in. Try a normal tab or allow site storage.";
    return error instanceof Error ? error.message : (this.locale === "zh-TW" ? "Google 登入失敗。" : "Google sign-in failed.");
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
    clearCloudReconnectRequest();
    forgetRememberedOfflineAccount();
    this.offlineAccount = null;
    rememberLocalScope(this.localScope || "guest");
    this.cloudMembership = null;
    this.stopPokeWalletObserver();
    this.clearSharedCloudSnapshots();
    if (message) this.cloudMembershipError = message;
    try { await signOutFirebase(); } catch { /* Access is already fail-closed in rules. */ }
    this.authUser = null;
    if (!this.pendingInviteCode) this.cloudAccessRequested = false;
  }

  private refreshCloudMembership(user: FirebaseAuthUser = this.authUser!): Promise<void> {
    if (!user) return Promise.resolve();
    if (this.cloudMembershipRefreshPromise) return this.cloudMembershipRefreshPromise;
    const promise = this.performCloudMembershipRefresh(user);
    this.cloudMembershipRefreshPromise = promise;
    void promise.finally(() => {
      if (this.cloudMembershipRefreshPromise === promise) this.cloudMembershipRefreshPromise = null;
    });
    return promise;
  }

  private async performCloudMembershipRefresh(user: FirebaseAuthUser): Promise<void> {
    this.cloudMembershipReady = false;
    this.cloudMembershipError = null;
    this.render();
    try {
      let membership = await withTimeout(
        loadCloudMembership(user),
        20_000,
        this.locale === "zh-TW" ? "Cloud 授權檢查逾時。你的本機資料沒有變更；請按「重試 Cloud 連線」。" : "Cloud authorization check timed out. Your Local data was not changed; use Retry Cloud connection."
      );
      let claimedNow = false;
      let recoveredInvite = false;
      if (!membership && this.pendingInviteCode) {
        membership = await claimFamilyInvite(user, this.pendingInviteCode);
        claimedNow = true;
      } else if (!membership && !this.pendingInviteCode && user.emailVerified && user.email) {
        // iOS keeps an installed Home Screen web app in a storage container that
        // is separate from Safari. If the QR token was opened in Safari before
        // installation, recover the pending invite from the verified Google email
        // instead of pretending browser localStorage can cross that boundary.
        const recoverable = await withTimeout(
          findRecoverableFamilyInvites(user),
          20_000,
          this.locale === "zh-TW" ? "Cloud 邀請檢查逾時。請確認網路後再試一次。" : "Cloud invitation lookup timed out. Check the network and try again."
        );
        if (recoverable.length === 1) {
          membership = await claimFamilyInvite(user, recoverable[0]!.id);
          claimedNow = true;
          recoveredInvite = true;
        } else if (recoverable.length > 1) {
          throw new Error(this.locale === "zh-TW"
            ? "找到多個待處理邀請。為避免加入錯誤家庭，請重新掃描你要使用的邀請 QR code。"
            : "More than one pending invitation matches this Google account. Re-scan the invitation QR code you intend to use so LogTogether does not guess the wrong family.");
        }
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
      clearCloudReconnectRequest();
      this.cloudAccessRequested = true;

      if (claimedNow) {
        const localName = this.state.user.displayName.trim();
        if (localName && !["Family member", "User"].includes(localName)) {
          membership = await updateMyFamilyDisplayName(user, membership, localName, this.state.profile?.biologicalSex, this.familyProfileSharing());
        }
        // The invite has been consumed. Remove it from the address bar so a
        // later screenshot/share does not accidentally include the access link.
        this.pendingInviteCode = null;
        try { sessionStorage.removeItem(PENDING_INVITE_SESSION_SLOT); localStorage.removeItem(PENDING_INVITE_LOCAL_SLOT); } catch { /* Best effort. */ }
        history.replaceState(null, "", `${location.pathname}${location.search}`);
      }

      // Cloud authorization is complete at this point. Do not keep the blocking
      // “Almost there…” modal tied to profile seeding or the much larger sync.
      // A slow Firestore collection must never look like a failed Google login.
      this.cloudMembership = membership;
      this.seedLocalIdentity(user, membership);
      this.authInteractiveStatus = null;
      this.clearAuthInteractiveWatchdog();
      this.render();

      try {
        membership = await seedGoogleMemberIdentity(user, membership);
        this.cloudMembership = membership;
        this.seedLocalIdentity(user, membership);
      } catch (error) {
        // Identity decoration is non-critical once active access is proven.
        console.warn("Firebase member identity seed:", error);
      }
      void this.ensurePokeWalletObserver();
      if (recoveredInvite) this.toast(this.locale === "zh-TW" ? "已在安裝版 LogTogether 找回並接受你的 Cloud 邀請" : "Cloud invitation recovered and accepted in the installed LogTogether app");
      // Social events are session-global, not tied to visiting Family/Settings.
      void this.ensureSocialInboxObserver();
      await this.syncCloudWorkouts(user, membership);
      await this.syncCloudHikes(user, membership);
      await this.syncCloudCompanionData(user, membership);
      if (!this.cloudWorkoutError && !this.cloudHikeError && !this.cloudCompanionError) {
        this.state.sync ??= {};
        this.state.sync.lastSuccessfulSyncAt = new Date().toISOString();
        this.persist();
      }
    } catch (error) {
      this.authInteractiveStatus = null;
      this.clearAuthInteractiveWatchdog();
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

  private normalizeFamilyProfileSharing(value?: Partial<FamilyProfileSharing>): FamilyProfileSharing {
    return {
      biologicalSex: value?.biologicalSex !== false,
      supplements: value?.supplements !== false,
      recentWorkouts: value?.recentWorkouts !== false,
      recentHikes: value?.recentHikes !== false
    };
  }

  private familyProfileSharing(): FamilyProfileSharing {
    return this.normalizeFamilyProfileSharing(this.state.profile?.familyProfileSharing);
  }

  private cloudPreferenceValue() {
    return {
      locale: this.state.locale,
      theme: this.state.theme,
      simpleMode: this.state.simpleMode,
      accentColor: normalizeHex(this.state.accentColor),
      weeklyWorkoutGoal: this.state.weeklyWorkoutGoal ?? 3,
      goals: structuredClone(this.state.goals!),
      hikeBadgePreferences: structuredClone(this.state.hikeBadgePreferences ?? []),
      profileSharing: structuredClone(this.familyProfileSharing()),
      notificationPreferences: structuredClone(this.state.notificationPreferences ?? { goldDays:true, badges:true, pokes:true, mutedPokeUids:[], mutedPokeGroupIds:[] }),
      notificationDefaultsV11_1Applied: this.state.notificationDefaultsV11_1Applied === true,
      customSupplements: structuredClone(this.state.customSupplements ?? [])
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
    this.ensureScienceAwards();
    const monthly=(this.state.science?.earnedMonthlyBadges ?? []).map(item=>{
      const [year,month]=item.month.split("-").map(Number);
      const date=new Date(year || new Date().getFullYear(),Math.max(0,(month||1)-1),1);
      return {
        id:`monthly-${item.month}`,
        badgeType:"monthly" as const,
        title:date.toLocaleDateString(this.locale,{month:"short",year:"numeric"}),
        subtitle:item.scoringVersion===2
          ? (this.locale === "zh-TW" ? `月度徽章 · ${item.completed}/${item.available}` : `Monthly badge · ${item.completed}/${item.available}`)
          : (this.locale === "zh-TW" ? "月度徽章 · 舊版規則" : "Monthly badge · legacy rules"),
        earnedAt:item.earnedAt
      };
    });
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

  private markFamilyDate(date: string | null | undefined): void {
    if (!date) return;
    const key = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : localDateKey(date);
    this.state.sync ??= {};
    this.state.sync.familyDirtyDates = [...new Set([...(this.state.sync.familyDirtyDates ?? []),key])];
  }

  private familySummaryForDate(date: string): { date: string; calories: number; waterMl: number; workoutCount: number; goldDay: boolean } {
    const calories = dailyCalorieSeries(this.state.workouts,this.state.hikes,this.currentWeightKg()).find(p=>p.key===date)?.count ?? 0;
    const water = hydrationByDate(this.state.hydration,this.state.hydrationHistory ?? []);
    const workoutCount = this.state.workouts.filter(w=>w.completedAt && localDateKey(w.completedAt)===date).length;
    return {date,calories:Math.max(0,Math.round(calories)),waterMl:Math.max(0,Math.round(water.get(date)?.totalMl??0)),workoutCount,goldDay:meaningfulActivityScoreOnDate(this.state.workouts,this.state.hikes,date)>=1};
  }

  private currentWeekFamilySummaries(): Array<{ date: string; calories: number; waterMl: number; workoutCount: number; goldDay: boolean }> {
    const { start } = currentWeekBounds(new Date());
    const dates = Array.from({length:7},(_,index)=>{const day=new Date(start);day.setDate(start.getDate()+index);return localDateKey(day);});
    return [...new Set([...dates,...(this.state.sync?.familyDirtyDates??[])])].map(date=>this.familySummaryForDate(date));
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
    const supplementMap = new Map<string, { amount: number; unit?: SupplementUnit; customLabel?: string; entries: number; days: Set<string>; mixedUnits: boolean }>();
    for (const day of supplementDays) {
      for (const entry of day.entries) {
        const current = supplementMap.get(entry.supplementId) ?? { amount: 0, unit: entry.unit, ...(entry.customLabel ? {customLabel:entry.customLabel} : {}), entries: 0, days: new Set<string>(), mixedUnits: false };
        current.entries += 1;
        current.days.add(day.date);
        current.amount += Number(entry.amount ?? 0);
        if (!current.unit) current.unit = entry.unit;
        else if (entry.unit && entry.unit !== current.unit) current.mixedUnits = true;
        supplementMap.set(entry.supplementId, current);
      }
    }
    const supplements = this.familyProfileSharing().supplements ? [...supplementMap.entries()].map(([supplementId, item]) => ({
      supplementId,
      amount: Number(item.amount.toFixed(2)),
      ...(item.customLabel ? {customLabel:item.customLabel} : {}),
      ...(item.unit && !item.mixedUnits ? { unit: item.unit } : {}),
      entries: item.entries,
      days: item.days.size,
      mixedUnits: item.mixedUnits
    })).sort((a,b) => a.supplementId.localeCompare(b.supplementId)) : [];
    const supplementEntries = this.familyProfileSharing().supplements ? supplementDays.flatMap(day => day.entries.map(entry => {
      const at = new Date(entry.at);
      const time = Number.isFinite(at.getTime())
        ? `${String(at.getHours()).padStart(2,"0")}:${String(at.getMinutes()).padStart(2,"0")}`
        : "00:00";
      return {
        date: day.date,
        time,
        supplementId: entry.supplementId,
        ...(entry.customLabel ? {customLabel:entry.customLabel.slice(0,100)} : {}),
        ...(Number.isFinite(entry.amount) ? {amount:Math.max(0,Number(entry.amount))} : {}),
        ...(entry.unit ? {unit:entry.unit} : {})
      };
    })).sort((a,b)=>`${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0,100) : [];
    const weekPlan = goalsForWeek(this.state.goals!, startKey);
    return {
      weekStart: startKey,
      difficulty: weekPlan.difficulty ?? "normal",
      weeklyCalories: goal.weeklyCalories,
      workoutCount: workouts.length,
      hikeCount: hikes.length,
      hikeKm: Number(hikes.reduce((sum,hike)=>sum+hike.distanceKm,0).toFixed(1)),
      calorieDays: goal.calorieDays,
      waterDays: goal.waterDays,
      categoriesHit: goal.categories,
      missionScore: goal.score,
      missionMax: 10,
      supplements,
      supplementEntries
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
    const summaries = this.currentWeekFamilySummaries();
    await Promise.all([
      ...summaries.map(summary=>saveFamilyDailySummary(user,membership,summary)),
      saveFamilyWeeklySummary(user,membership,this.currentWeekFamilySummary()),
      saveCloudBadges(user,membership,badges)
    ]);
    const syncedDates = new Set(summaries.filter(item=>JSON.stringify(item)===JSON.stringify(this.familySummaryForDate(item.date))).map(item=>item.date));
    this.state.sync ??= {};
    this.state.sync.familyDirtyDates = (this.state.sync.familyDirtyDates??[]).filter(date=>!syncedDates.has(date));
    this.persist();
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
      ...(biologicalSex ? { biologicalSex } : {}),
      familyProfileSharing: this.normalizeFamilyProfileSharing(local.familyProfileSharing)
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
      let syncedProfileSharing = this.familyProfileSharing();
      if (snapshot.preferences && !this.state.sync.preferencesDirty) {
        syncedProfileSharing = this.normalizeFamilyProfileSharing(snapshot.preferences.profileSharing);
        this.state.locale=snapshot.preferences.locale;
        this.state.theme=snapshot.preferences.theme;
        this.state.simpleMode=snapshot.preferences.simpleMode;
        this.state.accentColor=normalizeHex(snapshot.preferences.accentColor);
        this.state.weeklyWorkoutGoal=snapshot.preferences.weeklyWorkoutGoal;
        this.state.goals=structuredClone(snapshot.preferences.goals);
        this.state.hikeBadgePreferences=structuredClone(snapshot.preferences.hikeBadgePreferences ?? []);
        this.state.customSupplements=structuredClone(snapshot.preferences.customSupplements ?? this.state.customSupplements ?? []);
        this.state.notificationPreferences=structuredClone(snapshot.preferences.notificationPreferences ?? { goldDays:true, badges:true, pokes:true, mutedPokeUids:[], mutedPokeGroupIds:[] });
        if (snapshot.preferences.notificationDefaultsV11_1Applied !== true) {
          this.state.notificationPreferences.goldDays = true;
          this.state.notificationPreferences.badges = true;
          this.state.notificationPreferences.pokes = true;
          this.state.notificationDefaultsV11_1Applied = true;
          this.state.sync.preferencesDirty = true;
          await saveCloudPreferences(user,membership,this.cloudPreferenceValue());
          this.state.sync.preferencesDirty = false;
        } else {
          this.state.notificationDefaultsV11_1Applied = true;
        }
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
        this.state.profile={ heightCm:snapshot.bodyMetrics.heightCm, weightEntries:snapshot.bodyMetrics.weightEntries.map(entry=>({...entry})), ...(photoId?{photoId}:{}), ...(snapshot.bodyMetrics.biologicalSex?{biologicalSex:snapshot.bodyMetrics.biologicalSex}:{}), familyProfileSharing:syncedProfileSharing };
      } else {
        await saveCloudBodyMetrics(user,membership,this.state.profile!);
        this.state.sync.profileDirty=false;
      }
      this.state.profile!.familyProfileSharing = syncedProfileSharing;
      const selfMember = this.cloudMembership?.members.find(member => member.uid === user.uid);
      const expectedSharedSex = syncedProfileSharing.biologicalSex ? this.state.profile?.biologicalSex : undefined;
      const memberSharing = this.normalizeFamilyProfileSharing(selfMember?.profileSharing);
      const sharingMismatch = (Object.keys(syncedProfileSharing) as Array<keyof FamilyProfileSharing>).some(key => memberSharing[key] !== syncedProfileSharing[key]);
      if (this.cloudMembership && (selfMember?.displayName !== this.state.user.displayName || selfMember?.biologicalSex !== expectedSharedSex || sharingMismatch)) {
        this.cloudMembership = await updateMyFamilyDisplayName(user, this.cloudMembership, this.state.user.displayName, this.state.profile?.biologicalSex, syncedProfileSharing);
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
      await this.refreshPushAndPokeState(false);
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
    this.markFamilyDate(day.date);
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
    const displayName = (selfMember?.displayName || user.displayName || user.email?.split("@")[0] || "User").slice(0, 60);

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

  private googleSignInButton(labelEn: string, labelZh: string, primary = false): string {
    const busy = Boolean(this.authInteractiveStatus);
    const busyLabel = this.authInteractiveStatus === "redirecting"
      ? (this.locale === "zh-TW" ? "正在開啟 Google…" : "Opening Google…")
      : this.authInteractiveStatus === "finishing"
        ? (this.locale === "zh-TW" ? "正在完成登入…" : "Finishing sign-in…")
        : (this.locale === "zh-TW" ? "正在連線…" : "Connecting…");
    return `<button class="btn small ${primary ? "primary" : ""}" data-action="google-sign-in" ${busy ? "disabled" : ""}>${escapeHtml(busy ? busyLabel : (this.locale === "zh-TW" ? labelZh : labelEn))}</button>`;
  }

  private authCard(): string {
    if (!cloudModeEnabled()) return `<div><strong>${this.locale === "zh-TW" ? "Local 模式" : "Local mode"}</strong><span>${this.locale === "zh-TW" ? "Firebase 尚未設定；所有資料只留在這台裝置。" : "Firebase is not configured; all data stays on this device."}</span></div>`;
    const activeCloud = Boolean(this.authUser && this.cloudMembership?.access.status === "active");
    const rememberedLabel = this.state.user.displayName || this.offlineAccount?.displayName || this.offlineAccount?.email || "LogTogether";
    if (activeCloud && this.authUser) {
      const label = this.authUser.displayName || this.authUser.email || this.authUser.uid;
      const group = this.cloudMembership?.access.role === "owner"
        ? (this.locale === "zh-TW" ? "Cloud 擁有者" : "Cloud owner")
        : this.groupNames(this.cloudMembership?.access.groupIds ?? [this.cloudMembership?.access.groupId ?? DEFAULT_GROUP_ID]);
      return `<div class="auth-setting"><div class="auth-identity">${this.authUser.photoURL ? `<img class="auth-avatar" src="${escapeHtml(this.authUser.photoURL)}" alt="">` : ""}<div><strong>${escapeHtml(label)}</strong><span>${this.locale === "zh-TW" ? "Cloud 已授權" : "Cloud authorized"} · ${escapeHtml(group)}</span><small>${escapeHtml(this.authUser.email ?? "")}</small></div></div><button class="btn small" data-action="google-sign-out">${this.locale === "zh-TW" ? "切換為 Local" : "Switch to Local"}</button></div>`;
    }
    if (!this.networkOnline && this.offlineAccount?.cloudApproved) {
      return `<div class="auth-setting"><div><strong>${escapeHtml(rememberedLabel)}</strong><span>${this.locale === "zh-TW" ? "Cloud 帳號目前離線；本機資料仍可正常使用，恢復網路後會重新驗證同步。" : "Cloud account is offline. Local data remains usable and will re-verify/sync when connectivity returns."}</span></div></div>`;
    }
    if (this.authInteractiveStatus || !this.authReady || this.authInitBusy) {
      const status = this.authInteractiveStatus === "finishing"
        ? (this.locale === "zh-TW" ? "正在完成 Google 登入並檢查 Cloud 權限…" : "Finishing Google sign-in and checking Cloud access…")
        : this.authInteractiveStatus === "redirecting"
          ? (this.locale === "zh-TW" ? "正在開啟安全的 Google 登入頁面…" : "Opening secure Google sign-in…")
          : (this.locale === "zh-TW" ? "正在檢查授權…" : "Checking authorization…");
      return `<div><strong>${this.locale === "zh-TW" ? "Cloud 存取" : "Cloud access"}</strong><span>${escapeHtml(status)}</span></div>`;
    }
    if (this.authUser && !activeCloud) {
      const label = this.authUser.displayName || this.authUser.email || this.authUser.uid;
      const error = this.cloudMembershipError || this.authError;
      return `<div class="auth-setting"><div class="auth-identity">${this.authUser.photoURL ? `<img class="auth-avatar" src="${escapeHtml(this.authUser.photoURL)}" alt="">` : ""}<div><strong>${escapeHtml(label)}</strong><span>${this.locale === "zh-TW" ? "Google 已登入；Cloud 連線尚未完成。" : "Google is signed in; Cloud connection is not complete yet."}</span>${error ? `<small class="danger-text">${escapeHtml(error)}</small>` : ""}</div></div><div class="auth-retry-actions"><button class="btn small primary" data-action="retry-cloud-auth">${this.locale === "zh-TW" ? "重試 Cloud 連線" : "Retry Cloud connection"}</button><button class="btn small ghost" data-action="google-sign-out">${this.locale === "zh-TW" ? "切換為 Local" : "Switch to Local"}</button></div></div>`;
    }
    if (this.pendingInviteCode) {
      const error = this.authError || this.cloudMembershipError;
      return `<div class="auth-setting"><div><strong>${this.locale === "zh-TW" ? "Cloud 邀請已偵測" : "Cloud invitation detected"}</strong><span>${error ? `<span class="danger-text">${escapeHtml(error)}</span>` : (this.locale === "zh-TW" ? "只有邀請指定的 Google 帳號能啟用 Cloud。你目前的 Local 紀錄會先備份，再安全合併到該帳號。" : "Only the Google account named by this invitation can enable Cloud. Your current Local records are backed up first and safely merged into that account.")}</span></div>${!this.authUser ? this.googleSignInButton("Continue with Google", "使用 Google 接受邀請", true) : ""}</div>`;
    }
    if (this.offlineAccount?.cloudApproved && !this.authUser) {
      return `<div class="auth-setting"><div><strong>${escapeHtml(rememberedLabel)}</strong><span>${this.locale === "zh-TW" ? "這台裝置曾獲得 Cloud 權限，但目前 Google 工作階段已登出。" : "This device previously had Cloud authorization, but its Google session is currently signed out."}</span></div>${this.googleSignInButton("Reconnect Cloud", "重新連線 Cloud")}</div>`;
    }
    return `<div class="auth-setting"><div><strong>${this.locale === "zh-TW" ? "Local 模式" : "Local mode"}</strong><span>${this.locale === "zh-TW" ? "新成員仍需邀請才能取得 Cloud 權限；已經是 Cloud 成員的人可以在任何新瀏覽器重新登入。" : "New members still need an invitation to gain Cloud access. Existing Cloud members can reconnect from any new browser."}</span></div>${this.googleSignInButton("Connect existing Cloud account", "連線既有 Cloud 帳號")}</div>`;
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

  private groupNames(groupIds: string[]): string {
    const names = [...new Set(groupIds)].map(groupId => this.groupName(groupId));
    if (!names.length) return this.groupName(DEFAULT_GROUP_ID);
    if (names.length <= 2) return names.join(" · ");
    return `${names[0]} +${names.length - 1}`;
  }

  private movePositionMenu(dataAttribute: string, index: number, total: number): string {
    if (total <= 1) return "";
    const options = Array.from({length:total},(_,position)=>`<option value="${position}" ${position===index?"selected":""}>${this.locale === "zh-TW" ? `位置 ${position+1}` : `Position ${position+1}`}</option>`).join("");
    return `<details class="reorder-position-menu"><summary aria-label="${this.locale === "zh-TW" ? "移動位置選單" : "Move position menu"}" title="${this.locale === "zh-TW" ? "移動位置" : "Move position"}">⋯</summary><label><span>${this.locale === "zh-TW" ? "移到" : "Move to"}</span><select class="select compact-select" data-${dataAttribute}="${index}">${options}</select></label></details>`;
  }

  private bindSmoothReorder(
    itemSelector: string,
    handleSelector: string,
    commit: (from: number, to: number) => void,
    beforeStart?: () => void
  ): void {
    root.querySelectorAll<HTMLElement>(handleSelector).forEach(handle => handle.addEventListener("pointerdown", event => {
      if (event.button !== 0 || !event.isPrimary) return;
      const source = handle.closest<HTMLElement>(itemSelector);
      const parent = source?.parentElement;
      if (!source || !parent) return;
      const currentItems = () => Array.from(parent.querySelectorAll<HTMLElement>(itemSelector));
      const from = currentItems().indexOf(source);
      if (from < 0) return;
      beforeStart?.();
      event.preventDefault();
      const initialRect = source.getBoundingClientRect();
      const offsetY = event.clientY - initialRect.top;
      const ghost = source.cloneNode(true) as HTMLElement;
      ghost.classList.remove("smooth-reorder-source");
      ghost.classList.add("smooth-reorder-ghost");
      ghost.style.width = `${initialRect.width}px`;
      ghost.style.height = `${initialRect.height}px`;
      ghost.setAttribute("aria-hidden", "true");
      ghost.querySelectorAll<HTMLElement>("button,input,select,textarea,a,summary").forEach(node => node.tabIndex = -1);
      document.body.appendChild(ghost);
      source.classList.add("smooth-reorder-source");
      document.body.classList.add("reorder-active");

      const positionGhost = (clientX:number,clientY:number) => {
        ghost.style.left = `${Math.max(8,Math.min(window.innerWidth-initialRect.width-8,clientX-initialRect.width/2))}px`;
        ghost.style.top = `${clientY-offsetY}px`;
      };
      positionGhost(event.clientX,event.clientY);

      const flipAround = (move:()=>void) => {
        const before = new Map(currentItems().filter(item=>item!==source).map(item=>[item,item.getBoundingClientRect()] as const));
        move();
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        currentItems().filter(item=>item!==source).forEach(item=>{
          const oldRect=before.get(item); if(!oldRect) return;
          const next=item.getBoundingClientRect();
          const dy=oldRect.top-next.top;
          if(Math.abs(dy)<1) return;
          item.style.transition="none"; item.style.transform=`translateY(${dy}px)`;
          requestAnimationFrame(()=>{ item.style.transition="transform 160ms cubic-bezier(.2,.8,.2,1)"; item.style.transform=""; });
        });
      };

      const onMove = (moveEvent:PointerEvent) => {
        positionGhost(moveEvent.clientX,moveEvent.clientY);
        const edge=72;
        if(moveEvent.clientY<edge) window.scrollBy(0,-Math.min(18,Math.ceil((edge-moveEvent.clientY)/4)));
        else if(moveEvent.clientY>window.innerHeight-edge) window.scrollBy(0,Math.min(18,Math.ceil((moveEvent.clientY-(window.innerHeight-edge))/4)));
        const target=document.elementFromPoint(moveEvent.clientX,moveEvent.clientY)?.closest<HTMLElement>(itemSelector);
        if(!target||target===source||target.parentElement!==parent) return;
        const rect=target.getBoundingClientRect();
        const beforeTarget=moveEvent.clientY<rect.top+rect.height/2;
        const reference=beforeTarget?target:target.nextSibling;
        if(reference===source||(!beforeTarget&&source.nextSibling===reference)||(beforeTarget&&source.nextSibling===target)) return;
        flipAround(()=>parent.insertBefore(source,reference));
      };

      const finish = () => {
        window.removeEventListener("pointermove",onMove);
        window.removeEventListener("pointerup",finish);
        window.removeEventListener("pointercancel",finish);
        const to=currentItems().indexOf(source);
        ghost.remove();
        source.classList.remove("smooth-reorder-source");
        document.body.classList.remove("reorder-active");
        currentItems().forEach(item=>{item.style.transition="";item.style.transform="";});
        if(to>=0&&to!==from) commit(from,to);
      };
      window.addEventListener("pointermove",onMove,{passive:true});
      window.addEventListener("pointerup",finish,{once:true});
      window.addEventListener("pointercancel",finish,{once:true});
    }));
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

  private ensureScienceAwards(): string | null {
    if (!this.state.science) return null;
    const now=new Date();
    const month=localDateKey(now).slice(0,7);
    if (this.state.science.earnedMonthlyBadges?.some(item=>item.month===month)) return null;
    const progress=monthlyGoalProgress(this.state.workouts,this.state.hikes,this.currentWeightKg(),this.state.goals!,this.state.hydration,this.state.hydrationHistory ?? [],now,this.state.science.effectiveFrom);
    if (progress.earned) {
      this.state.science.earnedMonthlyBadges!.push({month,earnedAt:now.toISOString(),completed:progress.completed,available:progress.available,required:progress.required,scoringVersion:2});
      return month;
    }
    return null;
  }

  private celebrationStorageKey(kind: string, id: string): string {
    return `logtogether.celebration.v0114.${kind}.${this.effectiveLocalUid()}.${id}`;
  }

  private celebrateOnce(kind: "gold" | "water" | "badge", id: string, title: string, emoji: string): void {
    const key=this.celebrationStorageKey(kind,id);
    try { if(localStorage.getItem(key)==="1") return; localStorage.setItem(key,"1"); } catch {}
    queueMicrotask(()=>this.showMilestoneCelebration(kind,title,emoji));
  }

  private showMilestoneCelebration(kind: "gold" | "water" | "badge", title: string, emoji: string): void {
    this.enqueueVisualPresentation({ kind:"milestone", milestoneKind:kind, title, emoji });
  }

  private showMilestoneCelebrationNow(kind: "gold" | "water" | "badge", title: string, emoji: string, done: () => void): void {
    document.querySelectorAll(".milestone-celebration").forEach(node=>node.remove());
    const wrap=document.createElement("div");
    wrap.className=`milestone-celebration ${kind}`;
    wrap.setAttribute("role","status");
    wrap.innerHTML=`<div class="milestone-wash" aria-hidden="true"></div><div class="milestone-card"><span>${escapeHtml(emoji)}</span><strong>${escapeHtml(title)}</strong>${kind==="badge"?`<div class="milestone-sparkles" aria-hidden="true">✦ ✧ ✦</div>`:""}</div>`;
    document.body.append(wrap);
    const duration=kind==="badge"?3200:1900;
    window.setTimeout(()=>wrap.classList.add("leaving"),duration-450);
    window.setTimeout(()=>{ wrap.remove(); done(); },duration);
  }

  private persist(): void {
    const newBadgeMonth=this.ensureScienceAwards();
    saveState(this.state, this.localScope || undefined);
    if(newBadgeMonth){
      const [year,month]=newBadgeMonth.split("-").map(Number);
      const label=new Date(year||new Date().getFullYear(),Math.max(0,(month||1)-1),1).toLocaleDateString(this.locale,{month:"long"});
      this.celebrateOnce("badge",newBadgeMonth,this.locale==="zh-TW"?`${label}徽章達成！`:`${label} badge earned!`,"🏅");
    }
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

  private isDeveloperOwner(): boolean {
    return Boolean(this.authUser && this.cloudMembership?.access.status === "active" && this.cloudMembership.access.role === "owner");
  }

  private familyNotificationPromptStorageKey(): string {
    return `logtogether.family-notification-prompt-never.v1.${this.authUser?.uid ?? "local"}`;
  }

  private familyNotificationPromptSuppressed(): boolean {
    try { return localStorage.getItem(this.familyNotificationPromptStorageKey()) === "1"; } catch { return false; }
  }

  private setFamilyNotificationPromptSuppressed(value:boolean): void {
    try {
      if(value) localStorage.setItem(this.familyNotificationPromptStorageKey(),"1");
      else localStorage.removeItem(this.familyNotificationPromptStorageKey());
    } catch {}
  }

  private async maybeShowFamilyNotificationPrompt(): Promise<void> {
    if(this.page !== "family" || !this.authUser || this.cloudMembership?.access.status !== "active") return;
    const prefs=this.state.notificationPreferences ?? {goldDays:true,badges:true,pokes:true};
    if(!(prefs.goldDays || prefs.badges || prefs.pokes)) return;
    if(this.familyNotificationPromptSuppressed()) return;
    try {
      let status=this.pushStatus ?? await pushRegistrationStatus();
      // If permission already exists, repair a missing subscription silently.
      if(status.supported && status.configured && status.permission === "granted" && !status.subscribed && !this.pushManuallyDisabled()){
        status=await enablePushNotifications(this.authUser,this.cloudMembership).catch(()=>status);
      }
      this.pushStatus=status;
      if(status.subscribed) return;
      // Deliberately show the Family reminder even when push is blocked,
      // unsupported in this browser context, or manually disabled. The dialog
      // adapts its explanation; only “Never show this reminder again” is a
      // permanent suppression.
      this.familyNotificationPromptOpen=true;
      this.render();
    } catch(error) { console.warn("Family notification prompt:",error); }
  }

  private async ensureSocialInboxObserver(): Promise<void> {
    if(!this.authUser || this.cloudMembership?.access.status !== "active") {
      this.socialInboxUnsubscribe?.(); this.socialInboxUnsubscribe=null; this.socialInboxStarting=false; return;
    }
    if(this.socialInboxUnsubscribe || this.socialInboxStarting) return;
    this.socialInboxStarting=true;
    try {
      this.socialInboxUnsubscribe=await observeSocialInbox(this.authUser,events=>this.handleSocialInbox(events));
    } catch(error) { console.warn("Social inbox observer:",error); }
    finally { this.socialInboxStarting=false; }
  }

  private socialSenderSummary(events: SocialInboxEvent[]): string {
    const names=[...new Set(events.map(event=>event.senderName?.trim()).filter((name): name is string=>Boolean(name)))];
    if(!names.length) return this.locale === "zh-TW" ? "家庭成員" : "Family members";
    const shown=names.slice(0,4);
    const remaining=names.length-shown.length;
    return `${shown.join(this.locale === "zh-TW" ? "、" : ", ")}${remaining>0 ? (this.locale === "zh-TW" ? `，另 ${remaining} 人` : ` +${remaining} more`) : ""}`;
  }

  private socialSummaryEvent(kind: "poke" | "gold" | "badge", events: SocialInboxEvent[]): SocialInboxEvent {
    const count=events.length;
    const names=this.socialSenderSummary(events);
    if(kind === "poke") {
      const emojis=events.map(event=>event.emoji || "👋").slice(0,5).join("");
      return {
        id:`summary-poke-${events.map(event=>event.id).join("-").slice(0,100)}`, kind:"poke",
        title:this.locale === "zh-TW" ? `另外 ${count} 個 Poke！ ${emojis}` : `${count} more Pokes! ${emojis}`,
        body:names, emoji:events[0]?.emoji || "👋", senderName:"", createdAtMs:events[0]?.createdAtMs ?? Date.now()
      };
    }
    if(kind === "gold") return {
      id:`summary-gold-${events.map(event=>event.id).join("-").slice(0,100)}`, kind:"gold",
      title:this.locale === "zh-TW" ? `${count} 位家人達成 Gold Day！` : `${count} family members earned a Gold Day!`,
      body:names, emoji:"⭐", senderName:"", createdAtMs:events[0]?.createdAtMs ?? Date.now()
    };
    return {
      id:`summary-badge-${events.map(event=>event.id).join("-").slice(0,100)}`, kind:"badge",
      title:this.locale === "zh-TW" ? `${count} 個新的家庭徽章！` : `${count} new family badges!`,
      body:names, emoji:"🏅", senderName:"", createdAtMs:events[0]?.createdAtMs ?? Date.now()
    };
  }

  // Present high-volume family bursts without losing any underlying inbox event.
  // Direct Pokes stay highest priority; after three individual Pokes the rest are
  // compacted into one summary. Gold Day/badge bursts of 3+ are summarized.
  private enqueueSocialEventBatch(events: SocialInboxEvent[], trackInboxIds=true): void {
    if(!events.length) return;
    const sorted=[...events].sort((a,b)=>a.createdAtMs-b.createdAtMs);
    if(trackInboxIds) sorted.forEach(event=>this.queuedSocialEventIds.add(event.id));
    const idsFor=(items:SocialInboxEvent[])=>trackInboxIds ? items.map(item=>item.id) : undefined;
    const pokes=sorted.filter(event=>event.kind === "poke");
    const badges=sorted.filter(event=>event.kind === "badge");
    const golds=sorted.filter(event=>event.kind === "gold");

    // Pokes are intentional person-to-person encouragement, so show up to three
    // individually before compacting the remainder. The backend still enforces
    // its recipient flood limit; this only makes the foreground UI sane.
    pokes.slice(0,3).forEach(event=>this.visualPresentationQueue.push({kind:"poke",event,socialEventIds:idsFor([event])}));
    if(pokes.length>3){
      const rest=pokes.slice(3);
      this.visualPresentationQueue.push({kind:"poke",event:this.socialSummaryEvent("poke",rest),socialEventIds:idsFor(rest)});
    }

    const pushSocialGroup=(kind:"gold"|"badge",items:SocialInboxEvent[])=>{
      if(!items.length) return;
      if(items.length>=3) this.visualPresentationQueue.push({kind:"social",event:this.socialSummaryEvent(kind,items),socialEventIds:idsFor(items)});
      else items.forEach(event=>this.visualPresentationQueue.push({kind:"social",event,socialEventIds:idsFor([event])}));
    };
    // Badge events are rarer/more distinctive; show them before ambient Gold Day summaries.
    pushSocialGroup("badge",badges);
    pushSocialGroup("gold",golds);
    this.drainVisualPresentationQueue();
  }

  private handleSocialInbox(events: SocialInboxEvent[]): void {
    const seen=new Set(this.state.seenSocialEventIds ?? []);
    const fresh=events
      .filter(event=>event.id && !seen.has(event.id) && !this.queuedSocialEventIds.has(event.id))
      .sort((a,b)=>a.createdAtMs-b.createdAtMs);
    this.enqueueSocialEventBatch(fresh,true);
  }

  private markSocialEventsPresented(ids: string[] | undefined): void {
    if(!ids?.length) return;
    const seen=new Set(this.state.seenSocialEventIds ?? []);
    ids.forEach(id=>{ if(id){ seen.add(id); this.queuedSocialEventIds.delete(id); } });
    this.state.seenSocialEventIds=[...seen].slice(-80);
    this.persist();
  }

  private enqueueVisualPresentation(item: VisualPresentation): void {
    this.visualPresentationQueue.push(item);
    this.drainVisualPresentationQueue();
  }

  private drainVisualPresentationQueue(): void {
    if(this.visualPresentationActive || document.visibilityState === "hidden") return;
    const next=this.visualPresentationQueue.shift();
    if(!next) return;
    this.visualPresentationActive=true;
    const done=()=>{
      if(next.kind === "poke" || next.kind === "social") this.markSocialEventsPresented(next.socialEventIds);
      this.visualPresentationActive=false;
      window.setTimeout(()=>this.drainVisualPresentationQueue(),140);
    };
    if(next.kind === "poke") this.showPokeCelebrationNow(next.event,done);
    else if(next.kind === "social") this.showSocialEventPresentationNow(next.event,done);
    else this.showMilestoneCelebrationNow(next.milestoneKind,next.title,next.emoji,done);
  }

  private showSocialEventPresentationNow(event: SocialInboxEvent, done: () => void): void {
    const wrap=document.createElement("div");
    const kind=event.kind === "badge" ? "badge" : "gold";
    wrap.className=`social-event-celebration ${kind}`;
    wrap.setAttribute("role","status");
    const emoji=event.emoji || (event.kind === "badge" ? "🏅" : "⭐");
    const title=event.title?.trim() || (event.kind === "badge" ? (this.locale === "zh-TW" ? "家庭成員獲得徽章！" : "A family member earned a badge!") : (this.locale === "zh-TW" ? "家庭成員達成 Gold Day！" : "A family member earned a Gold Day!"));
    wrap.innerHTML=`<div class="social-event-card"><span class="social-event-emoji">${escapeHtml(emoji)}</span><div><strong>${escapeHtml(title)}</strong>${event.body ? `<small>${escapeHtml(event.body)}</small>` : ""}</div></div>`;
    document.body.append(wrap);
    window.setTimeout(()=>wrap.classList.add("leaving"),2350);
    window.setTimeout(()=>{ wrap.remove(); done(); },2800);
  }

  private showPokeCelebration(event: SocialInboxEvent): void {
    this.enqueueVisualPresentation({kind:"poke",event});
  }

  private showPokeCelebrationNow(event: SocialInboxEvent, done: () => void): void {
    const emoji=(event.emoji || "👋").slice(0,8);
    const sender=event.senderName?.trim() || (this.locale === "zh-TW" ? "家人" : "Someone");
    const summary=event.id.startsWith("summary-poke-");
    const message=summary && event.title?.trim() ? event.title.trim() : (this.locale === "zh-TW" ? `${sender} Poke 了你！` : `${sender} poked you!`);
    const wrap=document.createElement("div");
    wrap.className="poke-celebration";
    wrap.setAttribute("role","status");
    wrap.innerHTML=`<div class="poke-celebration-message"><span>${escapeHtml(emoji)}</span><div><strong>${escapeHtml(message)}</strong>${summary && event.body ? `<small>${escapeHtml(event.body)}</small>` : ""}</div></div><div class="poke-emoji-rain" aria-hidden="true"></div>`;
    document.body.append(wrap);

    const reduceMotion=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const rain=wrap.querySelector<HTMLElement>(".poke-emoji-rain");
    const particles: Animation[]=[];
    if(!reduceMotion && rain){
      const viewportHeight=Math.max(520,window.innerHeight || 720);
      Array.from({length:22},(_,i)=>{
        const particle=document.createElement("i");
        particle.textContent=emoji;
        const left=3 + ((i*37)%94);
        const size=40 + (i%6)*5;
        const drift=((i%9)-4)*18;
        const rotation=-18 + (i%7)*11;
        const delay=(i%11)*78 + Math.floor(i/11)*520;
        const duration=2600 + (i%7)*145;
        particle.style.left=`${left}%`;
        particle.style.fontSize=`${size}px`;
        rain.append(particle);
        if(typeof particle.animate === "function") {
          particles.push(particle.animate([
            {opacity:0,transform:`translate3d(0,-36px,0) rotate(${rotation-12}deg) scale(.82)`},
            {opacity:.98,offset:.14},
            {opacity:.94,offset:.76},
            {opacity:0,transform:`translate3d(${drift}px,${viewportHeight+100}px,0) rotate(${rotation+44}deg) scale(1.06)`}
          ],{duration,delay,easing:"cubic-bezier(.18,.75,.28,1)",fill:"forwards"}));
        } else {
          particle.classList.add("poke-fall-fallback");
          particle.style.setProperty("--poke-drift",`${drift}px`);
          particle.style.setProperty("--poke-fall-distance",`${viewportHeight+100}px`);
          particle.style.animationDelay=`${delay}ms`;
          particle.style.animationDuration=`${duration}ms`;
        }
      });
    }
    const totalDuration=reduceMotion?2200:4300;
    window.setTimeout(()=>wrap.classList.add("leaving"),totalDuration-500);
    window.setTimeout(()=>{ particles.forEach(animation=>animation.cancel()); wrap.remove(); done(); },totalDuration);
  }

  private showPokeSentBurst(emojiRaw: string): void {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const emoji=(emojiRaw || "👋").slice(0,8);
    const burst=document.createElement("div");
    burst.className="poke-sent-burst";
    burst.setAttribute("aria-hidden","true");

    Array.from({length:7},(_,i)=>{
      const angle=(Math.PI*2*i)/7;
      const dx=Math.round(Math.cos(angle)*(42+(i%3)*9));
      const dy=Math.round(Math.sin(angle)*(34+(i%2)*9));
      const particle=document.createElement("i");
      particle.textContent=emoji;
      particle.style.setProperty("--poke-burst-x",`${dx}px`);
      particle.style.setProperty("--poke-burst-y",`${dy}px`);
      particle.style.animationDelay=`${i*28}ms`;
      burst.append(particle);
    });

    document.body.append(burst);
    window.setTimeout(()=>burst.remove(),1050);
  }

  private pushDisabledStorageKey(): string {
    return `logtogether.push-manually-disabled.v1.${this.authUser?.uid ?? "local"}`;
  }

  private pushManuallyDisabled(): boolean {
    try { return localStorage.getItem(this.pushDisabledStorageKey()) === "1"; } catch { return false; }
  }

  private setPushManuallyDisabled(value: boolean): void {
    try {
      if (value) localStorage.setItem(this.pushDisabledStorageKey(),"1");
      else localStorage.removeItem(this.pushDisabledStorageKey());
    } catch {}
  }

  private async enablePushForCurrentDevice(showToast = true): Promise<void> {
    if(!this.authUser || this.cloudMembership?.access.status!=="active" || this.pushBusy) return;
    this.pushBusy=true; this.setPushManuallyDisabled(false); this.render();
    try {
      this.pushStatus=await enablePushNotifications(this.authUser,this.cloudMembership);
      if(showToast) this.toast(this.locale === "zh-TW" ? "此裝置已啟用家庭通知" : "Family notifications enabled on this device");
    } catch(error) {
      this.toast(this.cloudErrorMessage(error));
    } finally {
      this.pushBusy=false;
      await this.refreshPushAndPokeState();
    }
  }

  private async disablePushForCurrentDevice(): Promise<void> {
    if(!this.authUser || this.pushBusy) return;
    this.pushBusy=true; this.render();
    try {
      this.pushStatus=await disablePushNotifications(this.authUser);
      this.setPushManuallyDisabled(true);
      this.toast(this.locale === "zh-TW" ? "此裝置已停用家庭通知" : "Family notifications disabled on this device");
    } catch(error) {
      this.toast(this.cloudErrorMessage(error));
    } finally {
      this.pushBusy=false;
      await this.refreshPushAndPokeState();
    }
  }

  private stopPokeWalletObserver(): void {
    this.pokeWalletUnsubscribe?.();
    this.pokeWalletUnsubscribe = null;
    this.pokeWalletStarting = false;
    this.pokeBalance = 0;
  }

  private async ensurePokeWalletObserver(): Promise<void> {
    if (this.pokeWalletUnsubscribe || this.pokeWalletStarting || !this.authUser || this.cloudMembership?.access.status !== "active") return;
    this.pokeWalletStarting = true;
    try {
      this.pokeWalletUnsubscribe = await observePokeWallet(this.authUser, wallet => {
        this.pokeBalance = wallet.balance;
        this.render();
      });
    } catch (error) {
      console.warn("Poke wallet observer:", error);
    } finally {
      this.pokeWalletStarting = false;
    }
  }

  private async refreshPushAndPokeState(renderAfter = true): Promise<void> {
    if (!this.authUser || this.cloudMembership?.access.status !== "active") {
      this.pushStatus = null;
      this.pokeBalance = 0;
      if (renderAfter) this.render();
      return;
    }
    try {
      let [status, wallet] = await Promise.all([pushRegistrationStatus(), loadPokeWallet(this.authUser)]);
      const manuallyDisabled=this.pushManuallyDisabled();
      if (status.supported && status.configured && status.permission === "granted" && !status.subscribed && !manuallyDisabled) {
        status = await enablePushNotifications(this.authUser, this.cloudMembership).catch(()=>status);
      }
      this.pushStatus = status;
      this.pokeBalance = wallet.balance;
      void this.ensurePokeWalletObserver();
      void this.ensureSocialInboxObserver();
    } catch (error) {
      console.warn("Push/Poke state:", error);
      try { this.pushStatus = await pushRegistrationStatus(); } catch { this.pushStatus = null; }
    }
    if (renderAfter) this.render();
  }

  private navigate(page: Page): void {
    if (page === "home" && this.page !== "home") {
      this.workoutTrendWeekOffset = 0;
      this.monthlyTrendStart = new Date(new Date().getFullYear(), 0, 1);
    }
    if (page === "water" && this.page !== "water") { this.waterWeekOffset = 0; this.waterEntriesEditing = false; this.supplementEntriesEditing = false; }
    if (page === "settings" && this.page !== "settings") this.familyAccessEditing = false;
    this.page = page;
    this.missionTutorialOpen = false;
    this.confirmAction = null;
    this.pendingSetRemovalKey = null;
    window.scrollTo({ top: 0, behavior: "instant" });
    this.render();
    if ((page === "settings" || page === "familyMember" || page === "family") && this.authUser && this.cloudMembership?.access.status === "active") void this.refreshPushAndPokeState();
    if(page === "family") void this.maybeShowFamilyNotificationPrompt();
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

  private releaseWorkoutInputFocus(): void {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) active.blur();
  }

  private workoutHasStarted(workout: WorkoutRecord | null = this.state.activeWorkout): boolean {
    return Boolean(workout?.exercises.some(exercise => exercise.sets.some(set => Boolean(set.startedAt) || set.completed || set.skipped)));
  }

  private setResolved(set: SetEntry | undefined): boolean {
    return Boolean(set && (set.completed || set.skipped));
  }

  private nextStartableSet(workout: WorkoutRecord): { exerciseIndex: number; setIndex: number } | null {
    // A currently active item always owns the flow. This also safely handles
    // older/out-of-order records created before v0.11.2.
    for (let exerciseIndex = 0; exerciseIndex < workout.exercises.length; exerciseIndex += 1) {
      const exercise = workout.exercises[exerciseIndex];
      if (!exercise) continue;
      for (let setIndex = 0; setIndex < exercise.sets.length; setIndex += 1) {
        const set = exercise.sets[setIndex];
        if (set?.startedAt && !set.completed && !set.skipped) return { exerciseIndex, setIndex };
      }
    }

    if (workout.routineMode === "circuit") {
      const rounds = Math.max(1, workout.circuitRounds ?? Math.max(...workout.exercises.map(exercise => exercise.sets.length), 1));
      for (let setIndex = 0; setIndex < rounds; setIndex += 1) {
        for (let exerciseIndex = 0; exerciseIndex < workout.exercises.length; exerciseIndex += 1) {
          const set = workout.exercises[exerciseIndex]?.sets[setIndex];
          if (set && !this.setResolved(set)) return { exerciseIndex, setIndex };
        }
      }
      return null;
    }

    for (let exerciseIndex = 0; exerciseIndex < workout.exercises.length; exerciseIndex += 1) {
      const exercise = workout.exercises[exerciseIndex];
      if (!exercise) continue;
      for (let setIndex = 0; setIndex < exercise.sets.length; setIndex += 1) {
        if (!this.setResolved(exercise.sets[setIndex])) return { exerciseIndex, setIndex };
      }
    }
    return null;
  }

  private trainingCreditText(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  private exerciseFocusText(definition: ExerciseDefinition | undefined): string {
    if (!definition) return "";
    const profile = exerciseScienceLoggingProfile(definition);
    if (["cardio_session","conditioning_intervals","sprint_intervals","swim_session","rounds","skill_drill","water_skill"].includes(profile)) {
      return this.locale === "zh-TW" ? "記錄方式：有氧／技能時間" : "Recorded as: cardio / skill time";
    }
    if (profile === "balance_hold") {
      return this.locale === "zh-TW" ? "科學分類：平衡練習" : "Science category: balance practice";
    }
    if (["static_stretch","dynamic_mobility","yoga_flow","mobility_session"].includes(profile)) {
      return this.locale === "zh-TW" ? "記錄方式：活動度時間" : "Recorded as: mobility time";
    }
    const { primary, secondary } = exerciseDirectSecondaryCategories(definition);
    const primaryText = `${this.locale === "zh-TW" ? "直接" : "Direct"}: ${this.exerciseCategoryLabel(primary)}`;
    const secondaryText = secondary.length
      ? `${this.locale === "zh-TW" ? "次要" : "Secondary"}: ${secondary.map(category => this.exerciseCategoryLabel(category)).join(", ")}`
      : "";
    return [primaryText, secondaryText].filter(Boolean).join(" · ");
  }

  private profileRepeats(profile: string): boolean {
    return ["sets","skill_sets","isometric_sets","balance_hold","loaded_carry","conditioning_intervals","sprint_intervals","static_stretch","dynamic_mobility","rounds","water_skill","skill_drill"].includes(profile);
  }

  private profileUsesRest(profile: string): boolean {
    return ["sets","skill_sets","isometric_sets","balance_hold","loaded_carry","conditioning_intervals","sprint_intervals","rounds","water_skill","skill_drill","static_stretch","dynamic_mobility"].includes(profile);
  }

  private profileLabel(profile: string): string {
    const zh: Record<string,string> = {
      sets:"組", skill_sets:"技能組", isometric_sets:"撐持", balance_hold:"平衡", loaded_carry:"負重行走", conditioning_intervals:"間歇",
      sprint_intervals:"衝刺", static_stretch:"伸展", dynamic_mobility:"動態活動度", yoga_flow:"瑜伽", swim_session:"游泳",
      water_skill:"水域技能", rounds:"回合", skill_drill:"技能", cardio_session:"有氧", mobility_session:"活動度"
    };
    const en: Record<string,string> = {
      sets:"Set", skill_sets:"Skill set", isometric_sets:"Hold", balance_hold:"Balance hold", loaded_carry:"Carry", conditioning_intervals:"Interval",
      sprint_intervals:"Sprint", static_stretch:"Stretch", dynamic_mobility:"Mobility", yoga_flow:"Yoga", swim_session:"Swim",
      water_skill:"Water skill", rounds:"Round", skill_drill:"Skill drill", cardio_session:"Cardio", mobility_session:"Mobility"
    };
    return (this.locale === "zh-TW" ? zh : en)[profile] ?? (this.locale === "zh-TW" ? "組" : "Set");
  }

  private workoutAllDone(workout: WorkoutRecord): boolean {
    return workout.exercises.length > 0 && workout.exercises.every(exercise => exercise.sets.length > 0 && exercise.sets.every(set => this.setResolved(set)));
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
      const profile = definition ? exerciseEntryLoggingProfile(exercise, definition) : "sets";
      if (!this.profileUsesRest(profile) || exercise.restSec <= 0) return;
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
    if (set.completed && set.actualDurationSec !== undefined) return this.clockText(set.actualDurationSec);
    if (!set.startedAt) return null;
    const started = new Date(set.startedAt).getTime();
    if (!Number.isFinite(started)) return null;
    const ended = set.completedAt ? new Date(set.completedAt).getTime() : Date.now();
    if (!Number.isFinite(ended) || ended < started) return null;
    return this.clockText((ended - started) / 1000);
  }

  private completedSetDurationText(set: SetEntry): string {
    return set.completed ? this.clockText(completedActiveSeconds(set)) : "—";
  }

  private roundCompleted(workout: WorkoutRecord, roundIndex: number): boolean {
    return workout.exercises.length > 0 && workout.exercises.every(exercise => this.setResolved(exercise.sets[roundIndex]));
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
      const profile = definition && exercise ? exerciseEntryLoggingProfile(exercise, definition) : "sets";
      const label = this.profileLabel(profile);
      const set=exercise?.sets[activeSet.setIndex];
      const elapsed=Math.max(0,Math.floor((Date.now()-activeSet.startedAt)/1000));
      const target=workTargetSeconds(set, profile);
      if(target>0){
        const remaining=target-elapsed;
        return { label: `${label} · ${this.locale === "zh-TW" ? "目標" : "target"}`, value: remaining>=0 ? this.clockText(remaining) : `+${this.clockText(Math.abs(remaining))}`, detail: `${name} · ${target}s` };
      }
      return { label, value: this.clockText(elapsed), detail: name };
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
      : this.page === "activity" ? this.renderActivity()
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
        ${this.renderMissionTutorial()}
        ${this.renderFamilyNotificationPrompt()}
        ${this.renderAuthProgressModal()}
        ${this.renderPhotoLightbox()}
      </div>`;

    this.applyDynamicStyles();
    this.bindGlobalEvents();
    if (this.page === "workout") this.bindWorkoutEvents();
    if (this.page === "hike") this.bindHikeEvents();
    this.ensureWorkoutTicker();
    this.updateRestTimerDisplay();
    void this.syncWakeLock();
    void this.hydrateMediaImages();
  }

  private renderAuthProgressModal(): string {
    const status=this.authInteractiveStatus;
    if(!status) return "";
    const zh=this.locale === "zh-TW";
    const title=status === "connecting"
      ? (zh ? "正在把你連到 LogTogether…" : "Connecting you to LogTogether…")
      : status === "redirecting"
        ? (zh ? "正在開啟 Google 登入…" : "Opening Google sign-in…")
        : (zh ? "快好了…" : "Almost there…");
    const detail=status === "connecting"
      ? (zh ? "準備安全的 Google 登入" : "Preparing secure Google sign-in")
      : status === "redirecting"
        ? (zh ? "完成後會自動回到 LogTogether" : "You’ll return to LogTogether automatically")
        : (zh ? "正在確認 Cloud 權限並載入你的家庭資料" : "Checking Cloud access and loading your family data");
    return `<div class="modal-backdrop auth-progress-backdrop" role="presentation"><section class="auth-progress-card" role="status" aria-live="polite"><div class="auth-together-loader" aria-hidden="true"><span>${icon("dumbbell")}</span><i></i><span>${icon("dumbbell")}</span></div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p><div class="auth-spinner" aria-hidden="true"></div><div class="tiny muted">${zh ? "Local 資料會保持不變，直到 Cloud 權限確認完成。" : "Your Local data stays untouched until Cloud access is confirmed."}</div></section></div>`;
  }

  private renderFamilyNotificationPrompt(): string {
    if(!this.familyNotificationPromptOpen) return "";
    const zh=this.locale === "zh-TW";
    const status=this.pushStatus;
    const blocked=status?.permission === "denied";
    const unsupported=status?.supported === false;
    const unconfigured=status?.configured === false;
    const needsHelp=blocked || unsupported || unconfigured;
    const message=blocked
      ? (zh ? "這台裝置目前封鎖系統通知。開啟後，你才能即時收到家人／朋友的 Poke、Gold Day 和徽章消息。" : "System notifications are currently blocked on this device. Enable them to get Pokes, Gold Days and badge updates from your group in real time.")
      : unsupported
        ? (zh ? "這個瀏覽器目前不能直接接收 LogTogether 推播。你仍會在 App 內看到 Poke；使用支援通知的瀏覽器／主畫面 App 可獲得即時提醒。" : "This browser cannot receive LogTogether push right now. You will still see Pokes inside the app; a supported browser/Home Screen app can receive them instantly.")
        : unconfigured
          ? (zh ? "通知服務目前尚未準備好，但你的家庭互動仍會保留在 App 內。稍後可再試一次。" : "The notification service is not ready on this device yet, but family activity will still be kept in the app. You can try again later.")
          : (zh ? "開啟通知，就能即時收到 👋 Poke、⭐ Gold Day 和 🏅 徽章消息，一起互相鼓勵！" : "Turn on notifications for 👋 Pokes, ⭐ Gold Days and 🏅 badge updates so your group can encourage each other in real time.");
    return `<div class="modal-backdrop notification-onboarding" role="presentation"><section class="notification-onboarding-card" role="dialog" aria-modal="true" aria-labelledby="notification-onboarding-title"><div class="notification-fun-emoji" aria-hidden="true"><span>👋</span><span>⭐</span><span>💪</span><span>🏅</span></div><h2 id="notification-onboarding-title">${zh ? "一起動起來更有趣！" : "LogTogether is more fun together!"}</h2><p>${escapeHtml(message)}</p><div class="notification-onboarding-actions"><button class="btn primary touch" data-action="family-notification-enable">${needsHelp ? (zh ? "如何開啟通知" : "How to enable notifications") : (zh ? "開啟通知" : "Enable notifications")}</button><button class="btn ghost touch" data-action="family-notification-later">${zh ? "下次再說" : "Not now"}</button></div><button class="notification-never" data-action="family-notification-never">${zh ? "永遠不要再顯示這個提醒" : "Never show this reminder again"}</button><div class="tiny muted">${zh ? "你仍可隨時到設定重新開啟或關閉各類通知。" : "You can always change individual notification choices later in Settings."}</div></section></div>`;
  }

  private renderMissionTutorial(): string {
    if (!this.missionTutorialOpen) return "";
    const page = clamp(this.missionTutorialPage, 0, 7);
    const zh = this.locale === "zh-TW";
    const pages = [
      `<article class="mission-tutorial-page"><div class="tutorial-hero-number">10</div><h2>${zh ? "每週任務是什麼？" : "What are Weekly Missions?"}</h2><p>${zh ? "每週有 10 個簡單目標，幫你兼顧力量、有氧、活動度、補水與自己喜歡的活動。完成多少看的是你的習慣，不是和家人競賽。" : "Each week has 10 simple goals covering strength, cardio, mobility, hydration and an activity you enjoy. They guide your own routine rather than creating a family leaderboard."}</p><div class="tutorial-info-lines compact"><span><b>${zh ? "難度" : "Difficulty"}</b>${zh ? "只改變目標數字，不改變安全規則" : "changes targets, never safety rules"}</span><span><b>${zh ? "完成" : "Complete"}</b>${zh ? "每項任務一週最多算 1 個完成" : "each mission is one weekly check-off"}</span></div></article>`,
      `<article class="mission-tutorial-page"><h2>${zh ? "5 個力量任務" : "5 strength missions"}</h2><div class="tutorial-mission-list"><span><b>↗ Push</b><small>${zh ? "推的有效訓練組，例如伏地挺身、胸推" : "working sets that push, like push-ups or presses"}</small></span><span><b>↙ Pull</b><small>${zh ? "拉的有效訓練組，例如划船、引體向上" : "working sets that pull, like rows or pull-ups"}</small></span><span><b>⇵ ${zh ? "下肢" : "Lower body"}</b><small>${zh ? "深蹲、弓步、髖鉸鏈等下肢訓練組" : "lower-body sets such as squats, lunges and hinges"}</small></span><span><b>◎ ${zh ? "核心" : "Core"}</b><small>${zh ? "主要挑戰軀幹穩定或抗阻的有效訓練組" : "working sets mainly challenging trunk control or resistance"}</small></span><span><b>▦ ${zh ? "力量訓練天數" : "Strength days"}</b><small>${zh ? "一天累積至少 4 組有效力量訓練，就算 1 個力量日" : "a day with at least 4 meaningful resistance working sets"}</small></span></div><p class="tutorial-foot">${zh ? "暖身組不會累積這些任務。" : "Warm-up sets do not count toward these missions."}</p></article>`,
      `<article class="mission-tutorial-page"><h2>${zh ? "活動、興趣與補水" : "Activity, choice & hydration"}</h2><div class="tutorial-mission-list four"><span><b>♥ ${zh ? "有氧分鐘" : "Cardio minutes"}</b><small>${zh ? "跑步、單車、游泳、健行等有效活動時間；健行以移動時間計算" : "active cardio time from running, cycling, swimming, hiking and similar activities"}</small></span><span><b>↔ ${zh ? "活動度分鐘" : "Mobility minutes"}</b><small>${zh ? "伸展、動態活動度、瑜伽等有效活動時間" : "active time from stretching, mobility work and yoga"}</small></span><span><b>◉ ${zh ? "飲水達標日" : "Hydration days"}</b><small>${zh ? "當天喝水量達到你自己的每日飲水目標，就算 1 天" : "a day when logged water reaches your own daily target"}</small></span><span><b>☆ ${zh ? "本週自選活動" : "Chosen activity days"}</b><small>${zh ? "完成你選擇的喜愛活動；這個任務放在清單最後方便調整" : "complete the activity you chose; this mission stays last so the choice is easy to change"}</small></span></div></article>`,
      `<article class="mission-tutorial-page"><div class="tutorial-gold-star">★</div><h2>${zh ? "金色活動日" : "Gold Days"}</h2><p>${zh ? "一天累積到足夠的有意義活動就會變成金色；力量、有氧和活動度可以混合累加。一天最多只會獲得一次金色日。" : "A day turns Gold after enough meaningful activity. Strength, cardio and mobility can combine, and a day can earn Gold only once."}</p><div class="tutorial-thresholds"><span><b>4</b>${zh ? "有效力量組" : "strength sets"}</span><span><b>20</b>${zh ? "分鐘有氧" : "cardio min"}</span><span><b>10</b>${zh ? "分鐘活動度" : "mobility min"}</span></div><p class="tutorial-foot">${zh ? "例如 2 組力量 + 10 分鐘有氧也能組合成一個金色日。" : "For example, 2 strength sets + 10 cardio minutes can combine into one Gold Day."}</p></article>`,
      `<article class="mission-tutorial-page"><div class="tutorial-momentum-visual"><i class="done">✓</i><i class="done">✓</i><i class="done">✓</i><i>○</i></div><h2>${zh ? "動量、健康進度與熱量" : "Momentum, health & calories"}</h2><p>${zh ? "四週動量看最近 4 週有幾週完成至少 8 個每週任務，不要求每天連續運動。健康參考 · 不影響任務和遊戲分數分開。" : "4-week Momentum counts how many of your last four weeks completed at least 8 Weekly Missions, without requiring a daily streak. Health guidance stays separate from game scoring."}</p><div class="tutorial-info-lines"><span><b>${zh ? "健康指引" : "Health guide"}</b>${zh ? "每週參考：150 分鐘中等強度等效有氧 + 2 天力量訓練" : "weekly reference: 150 moderate-equivalent aerobic min + 2 strength days"}</span><span><b>${zh ? "熱量" : "Calories"}</b>${zh ? "只用於趨勢估算，不決定任務或金色日" : "trend estimate only; never decides missions or Gold Days"}</span></div></article>`,
      `<article class="mission-tutorial-page"><div class="tutorial-poke-hero">👋</div><h2>${zh ? "Poke 如何運作？" : "How Pokes work"}</h2><p>${zh ? "每次第一次達成當天金色日會獲得 1 個 Poke，最多保留 7 個。選擇 emoji 就能傳送一個簡短鼓勵給同群組成員。" : "The first Gold Day earned each day gives you 1 Poke, with up to 7 stored. Pick an emoji to send a short encouragement to a visible group member."}</p><div class="tutorial-info-lines"><span><b>${zh ? "不是排行榜" : "Not a score"}</b>${zh ? "Poke 是鼓勵，不會增加任務或訓練分數" : "Pokes are encouragement and never increase mission or workout scores"}</span><span><b>${zh ? "防洗版" : "Anti-spam"}</b>${zh ? "同一人之間有冷卻時間，接收者也可以封鎖個人或群組 Poke" : "same-person cooldowns apply, and recipients can mute a person or an entire group"}</span><span><b>${zh ? "通知" : "Notifications"}</b>${zh ? "裝置仍需要允許系統通知；可在設定隨時關閉" : "your device still needs system notification permission, which can be disabled anytime"}</span></div></article>`,
      `<article class="mission-tutorial-page"><h2>${zh?"解鎖月曆邊框":"Unlock calendar borders"}</h2><div class="reward-preview gold-preview">★ ${zh?"月度徽章":"Monthly badge"}</div><p>${zh?"完成當月符合資格週數的 80% 任務，獲得金色月曆邊框。":"Complete 80% of missions across the month’s eligible weeks for a gold calendar border."}</p><div class="reward-preview water-preview">💧 ${zh?"整月飲水紀錄達標":"A full month of water goals"}</div><p>${zh?"每一天達到自己的飲水目標，月底完成後獲得藍色邊框。超過目標不會多得獎勵。":"Meet your own target every day; the blue border unlocks after the month ends. Extra water earns no extra reward."}</p></article>`,
      `<article class="mission-tutorial-page tutorial-feedback-page"><div class="tutorial-feedback-emoji" aria-hidden="true">🐛 💡 🧪</div><h2>${zh ? "一起把 LogTogether 變得更好" : "Help improve LogTogether"}</h2><p>${zh ? "家人和朋友的實際測試最有價值。遇到 Bug、看不懂的地方或有新點子，都可以用外部回饋表單告訴我們。" : "Real testing from family and friends is the most useful feedback. If you find a bug, something confusing, or have an idea, you can send it through the external feedback form."}</p><div class="tutorial-info-lines"><span><b>${zh ? "隱私" : "Privacy"}</b>${zh ? "不要貼帳號 ID、GPS 路線、私人運動內容或其他敏感資料" : "do not paste account IDs, GPS routes, private workout contents or other sensitive data"}</span><span><b>${zh ? "App 資訊" : "App info"}</b>${zh ? "可複製匿名版本／裝置資訊，幫助重現問題" : "copy anonymous version/device info to help reproduce issues"}</span></div><div class="tutorial-feedback-actions">${this.feedbackFormUrl()?`<a class="btn primary" href="${escapeHtml(this.feedbackFormUrl()!)}" target="_blank" rel="noopener noreferrer">${zh?"🐛 回報 Bug／分享想法":"🐛 Report bug / share idea"}</a>`:`<button class="btn" type="button" disabled>${zh?"回饋表單尚未設定":"Feedback form not configured yet"}</button>`}<button class="btn ghost" type="button" data-action="copy-feedback-info">${zh?"複製版本與裝置資訊":"Copy version & device info"}</button></div></article>`
    ];
    return `<div class="mission-tutorial-overlay" role="dialog" aria-modal="true" aria-label="${zh ? "LogTogether 新手指南" : "LogTogether beginner’s guide"}"><button class="mission-tutorial-backdrop" data-action="close-mission-tutorial" aria-label="${zh ? "關閉" : "Close"}"></button><section class="mission-tutorial-sheet" data-mission-tutorial-sheet><div class="mission-tutorial-top"><span>${zh ? "新手指南" : "Beginner’s guide"}</span><button class="icon-btn mini-icon" data-action="close-mission-tutorial" aria-label="${zh ? "關閉" : "Close"}">×</button></div><div class="mission-tutorial-viewport" data-tutorial-page-index="${page}"><div class="mission-tutorial-track">${pages.join("")}</div></div><div class="mission-tutorial-dots">${pages.map((_,index)=>`<button class="${index===page?"active":""}" data-mission-tutorial-page="${index}" aria-label="${zh ? `第 ${index+1} 頁` : `Page ${index+1}`}"></button>`).join("")}</div><div class="mission-tutorial-actions"><button class="btn ghost" data-action="mission-tutorial-prev">${zh ? "上一頁" : "Previous"}</button><button class="btn primary" data-action="mission-tutorial-next">${page===pages.length-1?(zh?"完成":"Done"):(zh?"下一頁":"Next")}</button></div></section></div>`;
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

  private privatePhotoButton(id: string | undefined, className: string, alt = ""): string {
    return id ? `<button class="private-photo-button" type="button" data-photo-view="${escapeHtml(id)}" data-photo-alt="${escapeHtml(alt)}" aria-label="${this.locale === "zh-TW" ? "放大查看完整照片" : "View full photo"}">${this.privateImage(id,className,alt)}</button>` : "";
  }

  private renderPhotoLightbox(): string {
    if (!this.lightboxPhoto) return "";
    return `<div class="photo-lightbox-backdrop" data-photo-close role="presentation"><section class="photo-lightbox" role="dialog" aria-modal="true" aria-label="${this.locale === "zh-TW" ? "完整運動照片" : "Full workout photo"}"><button class="photo-lightbox-close" type="button" data-photo-close aria-label="${this.locale === "zh-TW" ? "關閉" : "Close"}">×</button>${this.privateImage(this.lightboxPhoto.id,"photo-lightbox-image",this.lightboxPhoto.alt)}</section></div>`;
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
      if (!this.state.activeWorkout.exercises.length) this.folds.add("exercise");
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
    if (action.kind === "activity") {
      this.navigate("activity");
      return;
    }
    this.startCircuitFromDraft();
  }

  private startCircuitFromDraft(): void {
    if(this.state.activeWorkout?.exercises.length && !window.confirm(this.locale==="zh-TW"?"建立循環會取代目前的運動草稿。要繼續嗎？":"Creating a circuit replaces the current workout draft. Continue?")) return;
    const routine: WorkoutRoutine = { id: uid("routine"), name: this.circuitDraftName, mode:"circuit", rounds:this.circuitDraftRounds, exercises:this.circuitDraftRows.map(row=>{
      const definition = exerciseById(row.exerciseId);
      const set: WorkoutRoutine["exercises"][number]["sets"][number] = { setType:"normal" };
      const profile = definition ? exerciseScienceLoggingProfile(definition) : "sets";
      const starter=definition ? exerciseStarterDefault(definition) : undefined;
      if (profile === "sets" || profile === "skill_sets") {
        if (definition?.type === "weight_reps") set.weightKg=row.weightKg;
        set.reps=row.reps || starter?.reps;
        if(row.targetWorkSec>0) set.targetWorkSec=row.targetWorkSec;
      } else if (profile === "isometric_sets" || profile === "static_stretch" || profile === "balance_hold") {
        set.durationSec=row.durationSec || starter?.durationSec;
      } else if (profile === "loaded_carry") {
        set.loadPerHandKg=row.weightKg;
        set.distanceKm=row.distanceKm || starter?.distanceKm;
        set.durationSec=row.durationSec || starter?.durationSec;
        set.recoverySec=row.restSec;
      } else if (profile === "conditioning_intervals") {
        if (definition?.id === "jump_squat") set.reps=row.reps || starter?.reps;
        else set.durationSec=row.durationSec || starter?.durationSec;
        set.recoverySec=row.restSec;
      } else if (profile === "sprint_intervals") {
        set.durationSec=row.durationSec || starter?.durationSec;
        if (row.distanceKm>0) set.distanceKm=row.distanceKm;
        set.recoverySec=row.restSec;
      } else if (profile === "dynamic_mobility") {
        set.reps=row.reps || starter?.reps;
        if(row.targetWorkSec>0) set.targetWorkSec=row.targetWorkSec;
        set.side="both";
      } else if (profile === "water_skill") {
        if (definition && ["surface_dive","brick_retrieval"].includes(definition.id)) set.reps=row.reps || starter?.reps;
        else { set.durationSec=row.durationSec || starter?.durationSec; if(row.distanceKm>0) set.distanceKm=row.distanceKm; }
        set.recoverySec=row.restSec;
      } else if (profile === "rounds" || profile === "skill_drill") {
        set.durationSec=row.durationSec || starter?.durationSec;
        set.recoverySec=row.restSec;
      } else {
        set.durationSec=Math.max(60,(row.minutes || starter?.minutes || 20)*60);
        if (row.distanceKm>0) set.distanceKm=row.distanceKm;
      }
      return { exerciseId:row.exerciseId, restSec:row.restSec, sets:[set], ...(definition ? { recordingProfile:profile, recordingProfileVersion:2 as const } : {}), ...(starter?.repMin!==undefined?{targetRepMin:starter.repMin}:{}), ...(starter?.repMax!==undefined?{targetRepMax:starter.repMax}:{}) };
    }) };
    this.endRest(false);
    this.state.activeWorkout = workoutFromRoutine(this.state, routine);
    this.showCircuitBuilder = false;
    this.persist();
    this.navigate("workout");
  }

  private logDate(): Date | null {
    const input=root.querySelector<HTMLInputElement>("#shared-log-at");
    if(input && (!input.value || !input.reportValidity())) return null;
    const date=this.logAt ? new Date(this.logAt) : new Date();
    if(!Number.isFinite(date.getTime()) || date.getTime()>Date.now()){this.toast(this.locale==="zh-TW"?"請選擇有效的過去時間":"Choose a valid date/time, not in the future");return null;}
    return date;
  }
  private logWater(ml:number): void {
    if(!Number.isFinite(ml)||ml<1||ml>6000||!Number.isInteger(ml)) return;
    const now=this.logDate(); if(!now)return;
    const date=localDateKey(now), day=this.ensureHydrationDayForDate(date);
    const wasAtGoal=day.totalMl>=day.targetMl;
    day.entries.push({id:uid("water"),at:now.toISOString(),ml});
    day.totalMl=day.entries.reduce((sum,item)=>sum+item.ml,0);
    this.selectedWaterDate=date;this.waterCalendarMonth=new Date(now.getFullYear(),now.getMonth(),1);
    this.customWaterOpen=false;this.persist();
    if(!wasAtGoal&&day.totalMl>=day.targetMl&&date===localDateKey(new Date()))this.celebrateOnce("water",date,this.locale==="zh-TW"?"今日飲水目標達成！":"Daily water goal reached!","💧");
    this.render();void this.pushHydrationToCloud(structuredClone(day));
  }
  private missionExplanation(key:string):string {
    const text:Record<string,[string,string]>={
      push:["完成推的訓練組，例如伏地挺身、胸推；暖身與略過不計。","Completed pushing sets, such as push-ups or presses. Warm-ups and skipped sets do not count."],
      pull:["完成拉的訓練組，例如划船、引體向上、懸垂。","Completed pulling sets, such as rows, pull-ups or hangs."],
      lower:["完成下肢訓練組，例如深蹲、弓步或髖鉸鏈。","Completed lower-body sets, such as squats, lunges or hinges."],
      core:["完成以核心為主的訓練組。","Completed sets whose main movement category is core."],
      strengthDays:["一天至少 4 組有紀錄的力量組，算 1 天。這是遊戲規則，不代表全身訓練。","Four recorded working sets on one day count as a day. This game rule does not establish whole-body training."],
      cardio:["累加完成的有氧活動時間，健行使用移動時間；休息不計。","Completed active cardio minutes; hikes use moving time. Rest is excluded."],
      mobility:["累加伸展、活動度與瑜伽的活動時間。","Completed active stretching, mobility and yoga time."],
      gold:["4 組力量、20 分鐘有氧、10 分鐘活動度或平衡可達金色，也可混合。每日最多一次，難度不改每日門檻。","Four strength sets, 20 cardio minutes, or 10 mobility/balance minutes earn Gold; mixed activity combines. Once per day; weekly difficulty does not change this daily threshold."],
      hydration:["達到該日期自己的飲水目標算 1 天。超過目標不加分。","Meet that date’s personal water target for one day of credit. Extra water earns no bonus."]
    };return (text[key]??["",""])[this.locale==="zh-TW"?0:1];
  }

  private renderHome(): string {
    const active = this.workoutHasStarted() ? this.state.activeWorkout : null;
    const weightKg = this.currentWeightKg();
    const goals = this.state.goals!;
    const goalScore = weeklyGoalScore(this.state.workouts, this.state.hikes, weightKg, goals, this.state.hydration, this.state.hydrationHistory ?? []);
    const weeklyTrend = dailyCalorieSeries(this.state.workouts, this.state.hikes, weightKg, this.weekReference(this.workoutTrendWeekOffset));
    const monthlyTrend = monthlyCalorieSeries(this.state.workouts, this.state.hikes, weightKg, this.monthlyTrendStart, 12);
    const todayKey = localDateKey(new Date());
    const todayMeaningful = meaningfulActivityScoreOnDate(this.state.workouts,this.state.hikes,todayKey);
    const todayMeaningfulPct = Math.min(100,Math.round(todayMeaningful*100));
    const todayWaterPct = Math.min(100, Math.round(this.state.hydration.totalMl / Math.max(1, this.state.hydration.targetMl) * 100));
    const routines = this.state.routines ?? [];
    const health=weeklyHealthGuidelineProgress(this.state.workouts,this.state.hikes);
    const previewTargets=this.previewGoalMode ? scienceMissionTargets(this.previewGoalMode) : null;
    const missionRows=[
      {key:"push",label:this.locale==="zh-TW"?"推（Push）":"Push",value:goalScore.metrics.movement.push,target:goalScore.targets.push,done:goalScore.missions.push},
      {key:"pull",label:this.locale==="zh-TW"?"拉（Pull）":"Pull",value:goalScore.metrics.movement.pull,target:goalScore.targets.pull,done:goalScore.missions.pull},
      {key:"lower",label:this.locale==="zh-TW"?"下肢":"Lower body",value:goalScore.metrics.movement.lower,target:goalScore.targets.lower,done:goalScore.missions.lower},
      {key:"core",label:this.locale==="zh-TW"?"核心":"Core",value:goalScore.metrics.movement.core,target:goalScore.targets.core,done:goalScore.missions.core},
      {key:"strengthDays",label:this.locale==="zh-TW"?"力量訓練天數":"Strength days",value:goalScore.metrics.strengthDays,target:goalScore.targets.strengthDays,done:goalScore.missions.strengthDays},
      {key:"cardio",label:this.locale==="zh-TW"?"有氧分鐘":"Cardio minutes",value:Math.round(goalScore.metrics.cardioMinutes),target:goalScore.targets.cardioMinutes,done:goalScore.missions.cardio},
      {key:"mobility",label:this.locale==="zh-TW"?"活動度分鐘":"Mobility minutes",value:Math.round(goalScore.metrics.mobilityMinutes),target:goalScore.targets.mobilityMinutes,done:goalScore.missions.mobility},
      {key:"gold",label:this.locale==="zh-TW"?"金色活動日":"Gold Days",value:goalScore.metrics.goldDays,target:goalScore.targets.goldDays,done:goalScore.missions.goldDays},
      {key:"hydration",label:this.locale==="zh-TW"?"飲水達標日":"Hydration days",value:goalScore.metrics.hydrationDays,target:goalScore.targets.hydrationDays,done:goalScore.missions.hydration},
      {key:"personal",label:this.locale==="zh-TW"?"本週自選活動":"Chosen activity days",value:goalScore.metrics.personalSessions,target:goalScore.targets.personalSessions,done:goalScore.missions.personal}
    ];
    const momentum=Array.from({length:4},(_,offset)=>{
      const ref=new Date(); ref.setDate(ref.getDate()-offset*7);
      const score=weeklyGoalScore(this.state.workouts,this.state.hikes,weightKg,goals,this.state.hydration,this.state.hydrationHistory ?? [],ref).score;
      return score>=8;
    }).reverse();
    const momentumCount=momentum.filter(Boolean).length;
    const personalOptions:[PersonalActivityId,string,string][]=[
      ["hiking","Hiking","健行"],["swimming","Swimming","游泳"],["running","Running","跑步"],["cycling","Cycling","騎車"],["kickboxing","Kickboxing / Boxing","踢拳／拳擊"],["gym","Gym strength","健身房力量訓練"]
    ];
    const personalSelections = goals.personalActivityIds ?? [];
    return `
      <h1 class="page-title">${escapeHtml(this.text("goodEvening"))}, ${escapeHtml(this.state.user.displayName)}</h1>
      <p class="page-subtitle">${escapeHtml(this.text("today"))}</p>
      ${!cloudModeEnabled() ? `<div class="banner">${escapeHtml(this.text("demoMode"))}</div>` : ""}
      ${active ? `<div class="card recovery"><div class="row recovery-row"><div><div class="small muted">${escapeHtml(this.text("currentWorkout"))}</div><div class="strong">${escapeHtml(active.routineName)}</div><div class="small muted">${active.exercises.length} ${escapeHtml(this.text("exercises"))} · ${completedSetCount(active)} ${escapeHtml(this.text("completedSets"))}</div></div><div class="quick-buttons"><button class="btn small primary" data-action="continue-workout">${escapeHtml(this.text("continueWorkout"))}</button><button class="btn small ghost danger" data-action="discard-workout">${escapeHtml(this.text("discard"))}</button></div></div></div>` : ""}

      <div class="grid-actions section">
        <button class="action-card primary" data-action="start-workout"><span class="action-icon">${icon("dumbbell")}</span><div class="action-title">${escapeHtml(this.text("startWorkout"))}</div><div class="action-meta">${escapeHtml(this.text("startFresh"))}</div></button>
        <button class="action-card" data-action="log-activity"><span class="action-icon">${icon("history")}</span><div class="action-title">${this.locale === "zh-TW" ? "補登已完成運動" : "Log completed activity"}</div><div class="action-meta">${this.locale === "zh-TW" ? "已經做完？在這裡補登" : "Already finished? Record it here"}</div></button>
      </div>

      <section class="section"><div class="routine-home-heading"><strong>${escapeHtml(this.text("savedRoutines"))}</strong><button class="btn small" type="button" data-action="edit-routines">${this.locale === "zh-TW" ? "編輯" : "Edit"}</button></div><details class="compact-fold routine-home" data-fold="routines" ${this.folds.has("routines")?"open":""}><summary>${this.locale === "zh-TW" ? "快速開始" : "Quick start"} · ${routines.length} ▾</summary>
        <div class="routine-strip">${routines.map(r=>`<div class="card routine-card"><button class="routine-launch" data-start-routine="${escapeHtml(r.id)}"><strong>${escapeHtml(r.name)}</strong><span>${r.mode === "circuit" ? `${r.rounds ?? 3} ${this.locale === "zh-TW" ? "輪" : "rounds"} · ` : ""}${r.exercises.length} ${escapeHtml(this.text("exercises"))}</span></button></div>`).join("")}</div>
      </details></section>

      <section class="section">
        <div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "今日金色日進度" : "Today's Gold Day progress"}</h2><span class="section-value ${todayMeaningful>=1?"gold-text":""}">${todayMeaningful>=1?(this.locale==="zh-TW"?"金色日 ✓":"Gold Day ✓"):`${todayMeaningfulPct}%`}</span></div>
        <div class="card daily-goal-card science-daily-card">
          <div class="daily-goal-row"><div><strong>${this.locale === "zh-TW" ? "金色日進度" : "Gold Day progress"}</strong><span>${this.locale === "zh-TW" ? "力量 · 有氧 · 活動度可混合累加" : "Strength · cardio · mobility can combine"}</span></div><div class="progress-track"><div class="progress-fill science-gold-fill" data-style-width="${todayMeaningfulPct}"></div></div></div>
          <div class="daily-goal-row water"><div><strong>${this.locale === "zh-TW" ? "飲水" : "Water"}</strong><span>${this.state.hydration.totalMl.toLocaleString()} / ${this.state.hydration.targetMl.toLocaleString()} mL</span></div><div class="progress-track"><div class="progress-fill water-fill" data-style-width="${todayWaterPct}"></div></div></div>
        </div>
      </section>

      <section class="section home-progress-section">
        <div class="segmented home-progress-tabs" role="tablist" aria-label="${this.locale === "zh-TW" ? "首頁進度" : "Home progress"}">
          <button data-home-progress-mode="missions" class="${this.homeProgressMode === "missions" ? "active" : ""}">${this.locale === "zh-TW" ? "每週任務" : "Weekly missions"}</button>
          <button data-home-progress-mode="calories" class="${this.homeProgressMode === "calories" ? "active" : ""}">${this.locale === "zh-TW" ? "估算熱量" : "Estimated calories"}</button>
        </div>
        ${this.homeProgressMode === "missions" ? `
          <div class="section-header home-progress-subhead"><h2 class="section-title">${this.locale === "zh-TW" ? "本週任務" : "Weekly missions"}</h2><span class="section-value mission-score">${goalScore.score}/10</span></div>
          <div class="card goals-overview science-goals-overview">
            <details class="compact-fold" data-fold="missions" ${this.folds.has("missions")?"open":""}><summary>${this.locale==="zh-TW"?"查看任務與完成條件":"View missions & criteria"} ▾</summary><div class="weekly-mission-list">${missionRows.map(row=>row.key === "personal"
              ? `<div class="mission-row personal-mission-row ${row.done?"done":""}"><div class="mission-row-main"><span>${escapeHtml(row.label)}</span><strong>${this.trainingCreditText(row.value)}/${row.target}</strong></div><fieldset class="mission-personal-choices"><legend>${this.locale==="zh-TW"?"最多選兩項":"Choose up to two"}</legend>${personalOptions.map(([id,en,zh])=>`<label><input type="checkbox" data-personal-activity="${id}" ${personalSelections.includes(id)?"checked":""}> <span>${escapeHtml(this.locale==="zh-TW"?zh:en)}</span></label>`).join("")}</fieldset><small>${personalSelections.length===0?(this.locale==="zh-TW"?"先選一或兩項活動才會開始累計。":"Choose one or two activities before this mission begins counting."):(this.locale==="zh-TW"?"任一選定活動在一天有有效紀錄就算 1 天；健身房需至少 4 組正式力量組。":"A valid record from either choice counts once per day; Gym requires at least four working strength sets.")}</small></div>`
              : `<details class="mission-detail"><summary class="mission-row ${row.done?"done":""}"><span>${escapeHtml(row.label)} ⓘ</span><strong>${this.trainingCreditText(row.value)}/${row.target}</strong></summary><p class="small muted">${escapeHtml(this.missionExplanation(row.key))}</p></details>`).join("")}</div></details>
            <div class="progress-track"><div class="progress-fill" data-style-width="${Math.min(100,Math.round(goalScore.score/10*100))}"></div></div>
            <div class="science-momentum"><span>${this.locale==="zh-TW"?"四週動量":"4-week momentum"}</span><small class="momentum-explainer">${this.locale==="zh-TW"?"最近四週中，完成 8 個以上任務的週數。":"Weeks with 8+ missions completed."}</small><div class="momentum-dots">${momentum.map(done=>`<i class="${done?"done":""}">${done?"✓":"○"}</i>`).join("")}</div><strong>${momentumCount}/4</strong></div>
            <div class="goal-mode-block collapsed-goal-control">
              <button class="goal-difficulty-toggle" data-action="toggle-goal-difficulty" aria-expanded="${this.showGoalDifficultyMenu}"><span>${this.locale === "zh-TW" ? "本週難度 · 點此調整" : "Weekly difficulty · change"}</span><strong>${escapeHtml(this.goalModeLabel(goals.difficulty ?? "normal"))}</strong><span class="history-chevron ${this.showGoalDifficultyMenu ? "open" : ""}">${icon("chevron")}</span></button>
              ${this.showGoalDifficultyMenu ? `<div class="goal-difficulty-menu"><div class="small muted">${this.locale === "zh-TW" ? "難度只改變鼓勵目標，不會鼓勵危險強度。先點一下預覽，再點同一難度一次確認。每週最多變更 3 次。" : "Difficulty changes motivational targets, never safety limits. Tap once to preview, then again to confirm. Maximum 3 changes per week."}</div><div class="segmented goal-modes">${(["easy","normal","hard","extreme"] as GoalDifficulty[]).map(mode=>`<button data-goal-mode="${mode}" class="${goals.difficulty === mode ? "active" : ""} ${this.previewGoalMode === mode ? "preview" : ""}">${this.goalModeLabel(mode)}</button>`).join("")}</div><div class="tiny muted">${this.locale === "zh-TW" ? `本週剩餘 ${Math.max(0,3-(goals.difficultyChanges ?? 0))} 次變更` : `${Math.max(0,3-(goals.difficultyChanges ?? 0))} changes left this week`}</div>${previewTargets ? `<div class="goal-preview"><div class="row"><strong>${escapeHtml(this.goalModeLabel(this.previewGoalMode!))}</strong><span>${previewTargets.cardioMinutes} ${this.locale==="zh-TW"?"分鐘有氧":"cardio min"} · ${previewTargets.goldDays} ${this.locale==="zh-TW"?"金色日":"Gold Days"}</span></div><div class="goal-preview-grid"><span>Push <b>${previewTargets.push}</b></span><span>Pull <b>${previewTargets.pull}</b></span><span>${this.locale==="zh-TW"?"下肢":"Lower"} <b>${previewTargets.lower}</b></span><span>${this.locale==="zh-TW"?"核心":"Core"} <b>${previewTargets.core}</b></span><span>${this.locale==="zh-TW"?"力量天數":"Strength days"} <b>${previewTargets.strengthDays}</b></span><span>${this.locale==="zh-TW"?"活動度分鐘":"Mobility min"} <b>${previewTargets.mobilityMinutes}</b></span><span>${this.locale==="zh-TW"?"飲水日":"Hydration days"} <b>${previewTargets.hydrationDays}</b></span></div></div>` : ""}</div>` : ""}
            </div>
            <button class="mission-help-button" data-action="open-mission-tutorial"><span>ⓘ</span>${this.locale === "zh-TW" ? "新手指南" : "Beginner’s Guide"}</button>
          </div>
        ` : `
          <div class="home-calorie-panel">
            <div class="home-calorie-toolbar">
              <h2 class="section-title">${this.locale === "zh-TW" ? "估算熱量趨勢" : "Estimated calorie trend"}</h2>
              <div class="segmented home-calorie-range-tabs"><button data-trend="weekly" class="${this.trendMode === "weekly" ? "active" : ""}">${escapeHtml(this.text("weekly"))}</button><button data-trend="monthly" class="${this.trendMode === "monthly" ? "active" : ""}">${this.locale === "zh-TW" ? "12 個月" : "12 months"}</button></div>
            </div>
            <div class="card trend-card home-calorie-card">${this.trendMode === "weekly" ? this.renderWeeklyTrend(weeklyTrend, this.workoutTrendWeekOffset) : this.renderMonthlyTrend(monthlyTrend)}</div>
          </div>
        `}
      </section>

      <section class="section"><div class="section-header"><h2 class="section-title">${this.locale==="zh-TW"?"健康參考 · 不影響任務":"Health reference · no mission points"}</h2></div><p class="section-explainer">${this.locale==="zh-TW"?"一般成人參考。輕鬆活動不算中等強度；力量日不代表已訓練所有肌群。":"General adult reference. Light activity is excluded; recorded strength days do not establish full muscle-group coverage."}</p><div class="card health-guideline-card"><div class="health-guideline-row"><strong>${this.locale==="zh-TW"?"有氧中等強度等效分鐘":"Aerobic moderate-equivalent minutes"}</strong><span>${Math.round(health.aerobicEquivalentMinutes)} / 150 min</span></div><div class="health-guideline-row"><strong>${this.locale==="zh-TW"?"力量訓練天數":"Strength-training days"}</strong><span>${health.strengthDays} / 2</span></div></div></section>

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


  private circuitTargetFields(row: { exerciseId: string; reps: number; weightKg: number; targetWorkSec: number; durationSec: number; distanceKm: number; minutes: number; restSec: number }, index: number): string {
    const definition = exerciseById(row.exerciseId);
    if (!definition) return "";
    const profile = exerciseScienceLoggingProfile(definition);
    const metrics = exerciseSessionMetricFlags(definition);
    const starter = exerciseStarterDefault(definition);
    const mini=(name:string,label:string,value:string|number,attrs="")=>`<label class="mini-field"><span>${escapeHtml(label)}</span><input class="set-input" type="number" name="${name}_${index}" value="${value}" ${attrs}></label>`;
    const rest=mini("rest",this.locale === "zh-TW" ? "休息秒" : "Rest s",row.restSec,'min="0" max="900" step="1"');
    let fields="";

    if (profile === "sets" || profile === "skill_sets") {
      if (definition.type === "weight_reps") fields += mini("weight","kg",row.weightKg,'min="0" step="0.5"');
      fields += mini("reps",this.text("reps"),row.reps || starter.reps || 8,'min="0" max="500" step="1"');
      fields += mini("work",this.locale === "zh-TW" ? "目標秒" : "Work s",row.targetWorkSec || "",'min="0" max="1800" step="1" placeholder="—"');
    } else if (profile === "isometric_sets" || profile === "static_stretch" || profile === "balance_hold") {
      fields += mini("duration",this.text("seconds"),row.durationSec || starter.durationSec || 30,'min="1" max="7200" step="1"');
    } else if (profile === "loaded_carry") {
      fields += mini("weight",this.locale === "zh-TW" ? "每手 kg" : "kg / hand",row.weightKg,'min="0" step="0.5"');
      fields += mini("distanceM",this.locale === "zh-TW" ? "公尺" : "metres",Math.round((row.distanceKm || starter.distanceKm || 0.03)*1000),'min="0" max="5000" step="1"');
      fields += mini("duration",this.text("seconds"),row.durationSec || starter.durationSec || 30,'min="0" max="7200" step="1"');
    } else if (profile === "conditioning_intervals") {
      if (definition.id === "jump_squat") fields += mini("reps",this.text("reps"),row.reps || starter.reps || 5,'min="1" max="100" step="1"');
      else fields += mini("duration",this.text("seconds"),row.durationSec || starter.durationSec || 30,'min="1" max="7200" step="1"');
    } else if (profile === "sprint_intervals") {
      fields += mini("duration",this.locale === "zh-TW" ? "工作秒" : "Work s",row.durationSec || starter.durationSec || 20,'min="1" max="3600" step="1"');
      fields += mini("distanceM",this.locale === "zh-TW" ? "公尺" : "metres",row.distanceKm ? Math.round(row.distanceKm*1000) : "",'min="0" max="10000" step="1"');
    } else if (profile === "dynamic_mobility") {
      fields += mini("reps",this.locale === "zh-TW" ? "每側次數" : "reps / side",row.reps || starter.reps || 8,'min="1" max="100" step="1"');
      fields += mini("work",this.locale === "zh-TW" ? "目標秒" : "Work s",row.targetWorkSec || "",'min="0" max="1800" step="1" placeholder="—"');
    } else if (["rounds","skill_drill"].includes(profile)) {
      fields += mini("duration",this.locale === "zh-TW" ? "每回合秒" : "Round s",row.durationSec || starter.durationSec || 60,'min="10" max="3600" step="1"');
    } else if (profile === "water_skill") {
      if (["surface_dive","brick_retrieval"].includes(definition.id)) fields += mini("reps",this.locale === "zh-TW" ? "技巧次數" : "Skill reps",row.reps || starter.reps || 3,'min="1" max="20" step="1"');
      else {
        fields += mini("duration",this.text("seconds"),row.durationSec || starter.durationSec || 60,'min="10" max="3600" step="1"');
        if (metrics.distance) fields += mini("distance", "km", row.distanceKm || "", 'min="0" max="100" step="0.01"');
      }
    } else {
      fields += mini("minutes",this.text("minutes"),row.minutes || starter.minutes || 20,'min="1" max="1440" step="1"');
      if (metrics.distance) fields += mini("distance","km",row.distanceKm || "",'min="0" max="1000" step="0.01"');
    }
    return `<div class="circuit-target-fields">${fields}${rest}</div>`;
  }

  private renderCircuitBuilder(): string {
    const options = (selected: string) => LIBRARY_GROUP_ORDER.map(group => {
      const items = EXERCISES.filter(exercise => exerciseLibraryGroup(exercise) === group);
      if (!items.length) return "";
      return `<optgroup label="${escapeHtml(this.exerciseLibraryGroupLabel(group))}">${items.map(exercise => `<option value="${escapeHtml(exercise.id)}" ${exercise.id === selected ? "selected" : ""}>${escapeHtml(exercise.names[this.locale])}</option>`).join("")}</optgroup>`;
    }).join("");
    return `<form id="circuit-builder" class="card circuit-builder"><div class="row"><div><strong>${this.locale === "zh-TW" ? "循環訓練" : "Circuit"}</strong><div class="small muted">${this.locale === "zh-TW" ? "設定要重複幾輪，以及每輪依序完成的動作。按住拖曳把手可平順排序；「⋯」可直接選擇目的位置。" : "Choose rounds and movement order. Hold and drag the handle to reorder smoothly; use “⋯” to choose a destination directly."}</div></div></div><div class="form-two"><div class="field"><label>${this.locale === "zh-TW" ? "名稱" : "Name"}</label><input class="input" name="circuitName" maxlength="50" value="${escapeHtml(this.circuitDraftName)}"></div><div class="field"><label>${this.locale === "zh-TW" ? "輪數" : "Rounds"}</label><input class="input" name="circuitRounds" type="number" min="1" max="10" value="${this.circuitDraftRounds}"><small>${this.locale === "zh-TW" ? "1 輪 = 依序完成下方所有動作" : "1 round = complete every movement below in order"}</small></div></div><div class="circuit-rows">${this.circuitDraftRows.map((row,index)=>{ const definition=exerciseById(row.exerciseId); return `<section class="circuit-row" data-circuit-drag="${index}"><div class="circuit-row-header"><button type="button" class="drag-handle-button" data-circuit-drag-handle="${index}" aria-label="${this.locale === "zh-TW" ? "拖曳排序" : "Drag to reorder"}">⠿</button><span class="circuit-order">${index+1}</span><strong>${this.locale === "zh-TW" ? `動作 ${index+1}` : `Movement ${index+1}`}</strong><div class="circuit-order-buttons">${this.movePositionMenu("circuit-position",index,this.circuitDraftRows.length)}<button type="button" class="icon-btn subtle-danger" data-circuit-remove="${index}" ${this.circuitDraftRows.length <= 1 ? "disabled" : ""} aria-label="${this.locale === "zh-TW" ? "刪除動作" : "Remove movement"}">${icon("trash")}</button></div></div><div class="circuit-builder-exercise"><select class="select" name="exercise_${index}" data-circuit-exercise-index="${index}">${options(row.exerciseId)}</select>${definition ? `<div class="exercise-preview-card compact-preview"><span>${escapeHtml(this.exercisePreviewHint(definition))}</span><a class="exercise-example-link" href="${escapeHtml(this.exerciseImageSearchUrl(definition))}" target="_blank" rel="noopener noreferrer">${this.locale === "zh-TW" ? "查看圖片示範" : "View image examples"}</a></div>` : ""}</div>${this.circuitTargetFields(row,index)}</section>`; }).join("")}</div><div class="row"><button type="button" class="btn small" data-action="add-circuit-row">${icon("plus")} ${this.locale === "zh-TW" ? "新增動作" : "Add movement"}</button><button class="btn primary" type="submit">${this.locale === "zh-TW" ? "開始循環" : "Start circuit"}</button></div></form>`;
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

  private workoutRecordingSource(workout: WorkoutRecord): "live" | "logged" {
    if (workout.recordingSource === "manual" || workout.recordingSource === "imported") return "logged";
    if (workout.recordingSource === "live") return "live";
    return workout.exercises.some(exercise => exercise.sets.some(set => Boolean(set.startedAt))) ? "live" : "logged";
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
    const completed = this.state.workouts.filter(w=>w.completedAt);
    const activeDays = new Set([...completed.map(w=>localDateKey(w.completedAt!)),...this.state.hikes.map(h=>h.date)]).size;
    const activeMinutes = completed.reduce((sum,w)=>sum+w.exercises.reduce((n,e)=>n+e.sets.filter(set=>set.completed&&!set.skipped).reduce((m,set)=>m+completedActiveSeconds(set),0),0),0)/60 + this.state.hikes.reduce((sum,h)=>sum+h.movingMinutes,0);
    const activities = this.historyActivities().filter(activity => localDateKey(activity.date) === this.selectedCalendarDate && (
      this.historyFilter === "all"
      || (this.historyFilter === "live" && activity.kind === "workout" && this.workoutRecordingSource(activity.workout) === "live")
      || (this.historyFilter === "logged" && (activity.kind === "hike" || this.workoutRecordingSource(activity.workout) === "logged"))
    ));
    return `<h1 class="page-title">${escapeHtml(this.text("history"))}</h1><p class="page-subtitle">${this.locale === "zh-TW" ? "點日期查看當天的運動；詳細紀錄只在需要時展開。" : "Pick a date to see that day's activity; expand details only when you need them."}</p>
      <p class="small muted">${this.locale==="zh-TW"?"全部紀錄":"All time"}</p><div class="stat-grid"><div class="stat"><div class="stat-value">${activeDays}</div><div class="stat-label">${this.locale==="zh-TW"?"活動天數":"Active days"}</div></div><div class="stat"><div class="stat-value">${completed.length+this.state.hikes.length}</div><div class="stat-label">${this.locale==="zh-TW"?"已完成活動":"Completed sessions"}</div></div><div class="stat"><div class="stat-value">${Math.round(activeMinutes)}</div><div class="stat-label">${this.locale==="zh-TW"?"活動分鐘":"Active minutes"}</div></div></div>
      ${(()=>{ const end=new Date(this.calendarMonth.getFullYear(),this.calendarMonth.getMonth()+1,0,23,59,59); const progress=monthlyGoalProgress(this.state.workouts,this.state.hikes,this.currentWeightKg(),this.state.goals!,this.state.hydration,this.state.hydrationHistory ?? [],end,this.state.science?.effectiveFrom); const month=`${this.calendarMonth.getFullYear()}-${String(this.calendarMonth.getMonth()+1).padStart(2,"0")}`; const stored=this.state.science?.earnedMonthlyBadges?.find(item=>item.month===month); return `<div class="card badge-month-progress"><span>${this.locale === "zh-TW" ? "本月徽章目標" : "Monthly badge goal"}</span><strong>${stored ? "✓ " : ""}${stored ? stored.completed : progress.completed}/${stored ? stored.required : progress.required || 1}</strong></div>`; })()}
      ${this.renderCalendar()}
      <div class="segmented history-filter section" role="group" aria-label="History filter"><button data-history-filter="all" class="${this.historyFilter === "all" ? "active" : ""}">${escapeHtml(this.text("all"))}</button><button data-history-filter="live" class="${this.historyFilter === "live" ? "active" : ""}">${this.locale === "zh-TW" ? "即時運動" : "Live sessions"}</button><button data-history-filter="logged" class="${this.historyFilter === "logged" ? "active" : ""}">${this.locale === "zh-TW" ? "補登活動" : "Logged activities"}</button></div>
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
    const monthKey=`${year}-${String(month+1).padStart(2,"0")}`;
    const monthProgress = monthlyGoalProgress(this.state.workouts, this.state.hikes, this.currentWeightKg(), this.state.goals!, this.state.hydration, this.state.hydrationHistory ?? [], monthEnd, this.state.science?.effectiveFrom);
    const badgeEarned = Boolean(this.state.science?.earnedMonthlyBadges?.some(item=>item.month===monthKey)) || monthProgress.earned;
    const dailyCalorieTarget = this.dailyCalorieTarget();
    const scienceFrom=this.state.science?.effectiveFrom ?? "9999-12-31";
    const palette = this.categoryPalette();
    const cells: string[] = [];
    for (let i = 0; i < mondayOffset; i += 1) cells.push('<div class="calendar-cell blank"></div>');
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      const active = activityDates.has(key);
      const selected = this.selectedCalendarDate === key;
      const scienceGoldDay = key >= scienceFrom && meaningfulActivityScoreOnDate(this.state.workouts,this.state.hikes,key) >= 1;
      const legacyGoalHit = key < scienceFrom && caloriesOnDate(this.state.workouts, this.state.hikes, this.currentWeightKg(), key) >= dailyCalorieTarget;
      const hasWorkout = this.state.workouts.some(workout => workout.completedAt && localDateKey(workout.completedAt) === key);
      const hasHike = this.state.hikes.some(hike => hike.date === key);
      const hasWeight = (this.state.profile?.weightEntries ?? []).some(entry => entry.date === key);
      const today = key === localDateKey(new Date());
      cells.push(`<button class="calendar-cell history-day ${active ? "has-activity" : ""} ${scienceGoldDay ? "gold-day" : ""} ${legacyGoalHit ? "calorie-hit" : ""} ${today ? "today" : ""} ${selected ? "selected" : ""}" data-calendar-day="${key}"><span class="calendar-day-number">${day}</span>${hasWorkout ? `<i class="history-activity-dot" title="${this.locale === "zh-TW" ? "有運動紀錄" : "Workout logged"}"></i>` : ""}${hasWeight ? `<b class="calendar-weight-marker" title="${this.locale === "zh-TW" ? "有體重紀錄" : "Weight recorded"}">♥</b>` : ""}${hasHike ? `<b class="calendar-hike-marker" title="${this.locale === "zh-TW" ? "健行" : "Hike"}">▲</b>` : ""}</button>`);
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
      <div class="card calendar-card ${badgeEarned ? "badge-month" : ""}"><div class="weekday-row">${(this.locale === "zh-TW" ? ["一","二","三","四","五","六","日"] : ["M","T","W","T","F","S","S"]).map(d=>`<span>${d}</span>`).join("")}</div><div class="calendar-grid">${cells.join("")}</div><div class="calendar-marker-help small muted">${this.locale === "zh-TW" ? "圓點 = 運動，♥ = 體重，▲ = 健行，金色底 = 金色活動日。" : "Dot = workout, ♥ = weight, ▲ = hike, gold fill = Gold Day."}</div></div>
      <div class="card exercise-mix-card"><div><div class="strong">${this.locale === "zh-TW" ? "訓練分布" : "Training mix"}</div><div class="small muted">${this.locale === "zh-TW" ? "估算肌群訓練分布" : "Estimated muscle training distribution"} · ${escapeHtml(new Date(`${this.selectedCalendarDate}T12:00:00`).toLocaleDateString(this.locale,{month:"short",day:"numeric",year:"numeric"}))}</div></div><div class="pie-layout"><div class="pie-chart ${total ? "" : "empty-pie"}" data-style-background="${escapeHtml(pieStyle)}" aria-label="${this.locale === "zh-TW" ? "訓練分布" : "Training mix"}"></div><div class="pie-legend">${distribution.map((item,index)=>`<div class="${item.count ? "" : "zero"}"><span class="legend-dot" data-style-background="${escapeHtml(palette[index % palette.length] ?? "")}"></span><span>${escapeHtml(this.exerciseCategoryLabel(item.category))}</span><strong>${this.trainingCreditText(item.count)}</strong></div>`).join("")}</div></div>${!total ? `<div class="empty-mini">${escapeHtml(this.text("noExerciseThatDay"))}</div>` : ""}${photoWorkouts.length ? `<div class="day-photos">${photoWorkouts.map(w=>this.privatePhotoButton(w.photoId,"history-photo-thumb",w.routineName)).join("")}</div>` : ""}</div>
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
          <span class="history-icon">${icon(this.workoutRecordingSource(w) === "logged" ? "history" : "dumbbell")}</span>
          <span class="history-copy"><span class="history-kicker">${escapeHtml(this.text("workout"))} · ${escapeHtml(this.formatDate(activity.date))}</span><span class="history-title">${escapeHtml(w.routineName)}</span><span class="history-meta">${this.formatTime(w.startedAt)}–${this.formatTime(w.completedAt ?? undefined)} · ${durationMinutes ? formatDuration(durationMinutes) : "—"} · ${w.routineMode === "circuit" ? `${w.circuitRounds ?? 1} ${this.locale === "zh-TW" ? "輪" : "rounds"} · ` : ""}${w.exercises.length} ${escapeHtml(this.text("exercises"))}${w.editedAt ? ` · ${escapeHtml(this.editedText(w.editedAt))}` : ""}</span></span>
          <span class="history-chevron ${expanded ? "open" : ""}">${icon("chevron")}</span>
        </button>
        ${expanded ? `<div class="history-details">${w.photoId ? this.privatePhotoButton(w.photoId,"history-photo",w.routineName) : ""}<div class="detail-grid workout-time-grid"><div><span>${escapeHtml(this.text("startTime"))}</span><strong>${escapeHtml(this.formatTime(w.startedAt))}</strong></div><div><span>${escapeHtml(this.text("endTime"))}</span><strong>${escapeHtml(this.formatTime(w.completedAt ?? undefined))}</strong></div><div><span>${escapeHtml(this.text("totalTime"))}</span><strong>${durationMinutes ? formatDuration(durationMinutes) : "—"}</strong></div><div><span>${this.locale === "zh-TW" ? "估算熱量" : "Estimated calories"}</span><strong>~${calories} Cal</strong></div></div><div class="nested-exercises">${w.routineMode === "circuit" ? this.renderSavedCircuitRounds(w) : w.exercises.map((exercise,index) => this.renderSavedExercise(w, exercise, index)).join("")}</div>${w.notes ? `<div class="detail-notes"><span>${escapeHtml(this.text("notes"))}</span>${escapeHtml(w.notes)}</div>` : ""}<div class="history-actions"><button class="btn" data-edit-workout="${escapeHtml(w.id)}">${escapeHtml(this.text("editWorkout"))}</button><button class="btn ghost danger" data-delete-workout="${escapeHtml(w.id)}">${icon("trash")} ${escapeHtml(this.text("deleteRecord"))}</button></div></div>` : ""}
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
      ${expanded ? `<div class="exercise-history-detail"><div class="detail-grid compact-grid"><div><span>${escapeHtml(this.text("startTime"))}</span><strong>${escapeHtml(this.formatTime(exercise.startedAt))}</strong></div><div><span>${escapeHtml(this.text("endTime"))}</span><strong>${escapeHtml(this.formatTime(exercise.completedAt))}</strong></div><div><span>${escapeHtml(this.text("exerciseTime"))}</span><strong>${durationMinutes === null ? "—" : formatDuration(durationMinutes)}</strong></div></div>${!exercise.startedAt ? `<div class="small muted timing-note">${escapeHtml(this.text("olderTiming"))}</div>` : ""}<div class="set-detail-table"><div class="set-detail-head"><span>#</span><span>${escapeHtml(this.text("setDetails"))}</span><span>${escapeHtml(this.text("duration"))}</span><span>${escapeHtml(this.text("restAfter"))}</span></div>${exercise.sets.map((set,index)=>`<div class="set-detail-row ${set.skipped ? "skipped" : ""}"><span>${index+1}</span><strong>${set.skipped ? (this.locale === "zh-TW" ? "已略過" : "Skipped") : escapeHtml(this.setSummary(definition,set,exercise))}</strong><span>${set.skipped ? "—" : escapeHtml(this.completedSetDurationText(set))}</span><span>${set.skipped ? "—" : (set.restAfterSec !== undefined ? `${set.restAfterSec}s` : "—")}</span></div>`).join("")}</div></div>` : ""}
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
        ${expanded ? `<div class="exercise-history-detail"><div class="detail-grid compact-grid"><div><span>${escapeHtml(this.text("startTime"))}</span><strong>${escapeHtml(this.formatTime(startedAt))}</strong></div><div><span>${escapeHtml(this.text("endTime"))}</span><strong>${escapeHtml(this.formatTime(completedAt))}</strong></div><div><span>${escapeHtml(this.text("duration"))}</span><strong>${escapeHtml(duration)}</strong></div></div><div class="set-detail-table circuit-round-detail-table"><div class="set-detail-head"><span>${this.locale === "zh-TW" ? "動作" : "Exercise"}</span><span>${escapeHtml(this.text("setDetails"))}</span><span>${escapeHtml(this.text("duration"))}</span><span>${escapeHtml(this.text("restAfter"))}</span></div>${roundSets.map(({exercise,set})=>{ const definition=exerciseById(exercise.exerciseId); const name=definition?.names[this.locale] ?? exercise.exerciseId; return `<div class="set-detail-row ${set.skipped ? "skipped" : ""}"><span>${escapeHtml(name)}</span><strong>${set.skipped ? (this.locale === "zh-TW" ? "已略過" : "Skipped") : escapeHtml(this.setSummary(definition,set,exercise))}</strong><span>${set.skipped ? "—" : escapeHtml(this.completedSetDurationText(set))}</span><span>${set.skipped ? "—" : (set.restAfterSec !== undefined ? `${set.restAfterSec}s` : "—")}</span></div>`; }).join("")}</div></div>` : ""}
      </div>`;
    }).join("");
  }

  private hydrationDayForDate(date: string): HydrationDay | undefined {
    if (this.state.hydration.date === date) return this.state.hydration;
    return (this.state.hydrationHistory ?? []).find(day => day.date === date);
  }

  private supplementLabel(supplementId: string, customLabel?: string): string {
    const custom=(this.state.customSupplements ?? []).find(item=>item.id===supplementId);
    if(custom?.label) return custom.label;
    if(customLabel?.trim()) return customLabel.trim();
    const item = SUPPLEMENTS.find(supplement => supplement.id === supplementId);
    return item ? (this.locale === "zh-TW" ? item.zh : item.en) : supplementId;
  }

  private supplementOptions(selectedId = ""): string {
    const custom=(this.state.customSupplements ?? []).map(item=>`<option value="${escapeHtml(item.id)}" ${item.id===selectedId?"selected":""}>${escapeHtml(item.label)}</option>`).join("");
    const common=SUPPLEMENTS.map(item=>`<option value="${item.id}" ${item.id===selectedId?"selected":""}>${escapeHtml(this.locale === "zh-TW" ? item.zh : item.en)}</option>`).join("");
    return `${custom ? `<optgroup label="${this.locale === "zh-TW" ? "我的補充品" : "My supplements"}">${custom}</optgroup>` : ""}<optgroup label="${this.locale === "zh-TW" ? "常用補充品" : "Common supplements"}">${common}</optgroup>`;
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
    const custom=(this.state.customSupplements ?? []).some(item=>item.id===supplementId);
    const query=custom
      ? `"${label}" supplement manufacturer ingredients uses evidence side effects interactions risks NIH NCCIH FDA PubMed`
      : `${label} supplement uses evidence side effects interactions risks NIH NCCIH FDA PubMed`;
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }

  private renderCustomSupplementManager(unitOptions: string): string {
    const zh=this.locale === "zh-TW";
    const items=this.state.customSupplements ?? [];
    if(this.editingCustomSupplementId && !items.some(item=>item.id===this.editingCustomSupplementId)) this.editingCustomSupplementId=null;
    const selected=items.find(item=>item.id===this.editingCustomSupplementId);
    const manageOptions=`<option value="">${zh?"選擇要管理的補充品…":"Choose a supplement to manage…"}</option>${items.map(item=>`<option value="${escapeHtml(item.id)}" ${selected?.id===item.id?"selected":""}>${escapeHtml(item.label)}</option>`).join("")}`;
    const editor=selected ? `<div class="custom-supplement-editor" data-custom-supplement-row="${escapeHtml(selected.id)}"><div class="custom-supplement-editor-head"><div><strong>${escapeHtml(selected.label)}</strong><a href="${escapeHtml(this.supplementSearchUrl(selected.id))}" target="_blank" rel="noopener noreferrer">${zh?"研究這個補充品 ↗":"Research this supplement ↗"}</a></div></div><label class="field"><span>${zh?"名稱／品牌":"Name / brand"}</span><input class="input" data-custom-supplement-edit-label="${escapeHtml(selected.id)}" maxlength="100" value="${escapeHtml(selected.label)}"></label><div class="form-two"><label class="field"><span>${zh?"預設數量":"Default amount"}</span><input class="input" data-custom-supplement-edit-amount="${escapeHtml(selected.id)}" type="number" min="0.01" max="100000" step="0.01" value="${selected.defaultAmount ?? ""}"></label><label class="field"><span>${zh?"預設單位":"Default unit"}</span><select class="select" data-custom-supplement-edit-unit="${escapeHtml(selected.id)}">${SUPPLEMENT_UNITS.map(unit=>`<option value="${unit}" ${selected.defaultUnit===unit?"selected":""}>${escapeHtml(this.supplementUnitLabel(unit,1))}</option>`).join("")}</select></label></div><div class="custom-supplement-row-actions"><button class="btn small primary" type="button" data-save-custom-supplement="${escapeHtml(selected.id)}">${zh?"儲存變更":"Save changes"}</button><button class="btn small ghost danger" type="button" data-delete-custom-supplement="${escapeHtml(selected.id)}">${zh?"從清單移除":"Remove from list"}</button></div></div>` : "";
    return `<details class="custom-supplement-maker" ${this.customSupplementManagerOpen?"open":""}><summary>${zh?"＋ 新增補充品／⚙ 管理我的補充品":"＋ Add supplement / ⚙ Manage my supplements"}</summary><div class="custom-supplement-maker-body"><div id="custom-supplement-form" class="custom-supplement-form"><label class="field"><span>${zh?"新增名稱／品牌":"Add name / brand"}</span><input class="input" name="customSupplementLabel" maxlength="100" placeholder="${zh?"例如：NOW Foods Vitamin D3 2000 IU":"e.g. NOW Foods Vitamin D3 2000 IU"}"></label><div class="form-two"><label class="field"><span>${zh?"預設數量（可選）":"Default amount (optional)"}</span><input class="input" name="customSupplementAmount" type="number" min="0.01" max="100000" step="0.01"></label><label class="field"><span>${zh?"預設單位":"Default unit"}</span><select class="select" name="customSupplementUnit">${unitOptions}</select></label></div><button class="btn small" type="button" data-action="add-custom-supplement">${zh?"加入我的清單":"Add to my list"}</button><div class="tiny muted">${zh?"名稱會照你輸入的文字保存，不會自動翻譯或推測成分。":"Saved exactly as written; LogTogether does not translate the product name or infer its ingredients."}</div></div>${items.length?`<div class="custom-supplement-manage-list"><label class="field"><span class="custom-supplement-manage-label">${zh?"⚙ 管理我的補充品":"⚙ Manage my supplements"}</span><select class="select" id="custom-supplement-manage-picker">${manageOptions}</select></label><div class="tiny muted">${zh?"選擇一項後可重新命名、修改預設數量或移除。重新命名會更新舊紀錄顯示名稱；移除不會刪除以前的攝取紀錄。":"Choose one item to rename, change defaults or remove it. Renaming updates historical display labels; removal never deletes old consumption history."}</div>${editor}</div>`:`<div class="tiny muted">${zh?"你還沒有自訂補充品。":"You do not have any custom supplements yet."}</div>`}</div></details>`;
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
    const validSupplementIds=[...(this.state.customSupplements ?? []).map(item=>item.id),...SUPPLEMENTS.map(item=>item.id)];
    if(!validSupplementIds.includes(this.supplementDraftId)) {
      this.supplementDraftId=validSupplementIds[0] ?? "";
      const initialCustom=(this.state.customSupplements ?? []).find(item=>item.id===this.supplementDraftId);
      if(initialCustom?.defaultAmount) this.supplementDraftAmount=initialCustom.defaultAmount;
      if(initialCustom?.defaultUnit) this.supplementDraftUnit=initialCustom.defaultUnit;
    }
    const supplementOptions = this.supplementOptions(this.supplementDraftId);
    const selectedCustom=(this.state.customSupplements ?? []).find(item=>item.id===this.supplementDraftId);
    const unitOptions = SUPPLEMENT_UNITS.map(unit => `<option value="${unit}" ${unit === this.supplementDraftUnit ? "selected" : ""}>${escapeHtml(this.supplementUnitLabel(unit, 1))}</option>`).join("");
    const infoUrl = this.supplementDraftId ? this.supplementSearchUrl(this.supplementDraftId) : "https://www.google.com/search?q=supplements";
    const infoLabel=selectedCustom ? (this.locale === "zh-TW" ? "研究這個補充品 ↗" : "Research this supplement ↗") : (this.locale === "zh-TW" ? "查看更多：用途／證據／副作用" : "View more: uses / evidence / side effects");
    return `<h1 class="page-title">${this.locale === "zh-TW" ? "飲水與補充品" : "Water & supplements"}</h1><p class="page-subtitle">${this.locale === "zh-TW" ? "追蹤每日飲水目標，也可快速記錄常用補充品；月曆會把兩者放在同一天查看。" : "Track your daily water goal and quickly log common supplements; the calendar keeps both together by day."}</p>
      <div class="log-date-bar"><label>${this.locale==="zh-TW"?"記錄日期與時間":"Log date & time"}<input class="input date-input" id="shared-log-at" type="datetime-local" max="${this.toDateTimeLocal(new Date().toISOString())}" value="${this.logAt || this.toDateTimeLocal(new Date().toISOString())}"></label><p class="small muted">${this.locale==="zh-TW"?"預設今天；可在這裡補登，或到月曆修改日期與數量。":"Defaults to today. Backfill here, or edit dates and amounts in the calendar."}</p></div><div class="card water-main"><div class="water-amount">${h.totalMl.toLocaleString()} <span class="medium muted">/ ${h.targetMl.toLocaleString()} mL</span></div><div class="progress-track"><div class="progress-fill" data-style-width="${waterPct}"></div></div><div class="quick-buttons water-quick"><button class="btn touch" data-water="250" aria-label="250 mL">+250</button><button class="btn touch" data-water="500" aria-label="500 mL">+500</button><button class="btn touch" data-water="750" aria-label="750 mL">+750</button><button class="btn touch" data-action="custom-water">${this.locale==="zh-TW"?"自訂":"Custom"}</button></div>${this.customWaterOpen?`<form id="custom-water-form" class="custom-water-form"><label>mL<input class="input" name="ml" type="number" min="1" max="6000" step="1" required inputmode="numeric"></label><button class="btn primary" type="submit">${this.locale==="zh-TW"?"記錄":"Log"}</button></form>`:""}<div class="tiny muted water-default-note">${h.targetMl === 2000 ? (this.locale === "zh-TW" ? "標準每日目標固定為 2,000 mL；如有特殊需求可到設定調整。" : "The standard daily goal is fixed at 2,000 mL. Use Settings → Special needs only if you need a different target.") : (this.locale === "zh-TW" ? `特殊目標：${h.targetMl.toLocaleString()} mL` : `Special target: ${h.targetMl.toLocaleString()} mL`)}</div></div>
      <section class="section"><details class="card supplement-log-card" ${this.supplementLogOpen?"open":""}><summary class="supplement-log-summary"><div><strong>${this.locale === "zh-TW" ? "新增補充品紀錄" : "Add a supplement record"}</strong><span>${this.locale === "zh-TW" ? "使用上方日期；隨時可修改" : "Uses the date above; editable afterward"}</span></div><span class="history-chevron">${icon("chevron")}</span></summary><div class="supplement-log-body"><form id="supplement-form" class="supplement-form"><label class="field supplement-name"><span>${this.locale === "zh-TW" ? "補充品" : "Supplement"}</span><select class="select" name="supplementId" id="supplement-picker">${supplementOptions}</select>${this.renderCustomSupplementManager(unitOptions)}<a class="supplement-more-link" id="supplement-info-link" href="${escapeHtml(infoUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(infoLabel)}</a></label><label class="field supplement-amount"><span>${this.locale === "zh-TW" ? "數量" : "Amount"}</span><input class="input" type="number" min="0.01" max="100000" step="0.01" name="supplementAmount" value="${this.supplementDraftAmount}"></label><label class="field supplement-unit"><span>${this.locale === "zh-TW" ? "單位" : "Unit"}</span><select class="select" name="supplementUnit">${unitOptions}</select></label><button class="btn primary touch supplement-submit" type="submit">${this.locale === "zh-TW" ? "儲存紀錄" : "Save record"}</button></form><div class="tiny muted">${this.locale === "zh-TW" ? "這裡只做攝取紀錄，不提供建議劑量。外部連結只是 Google 搜尋，請自行判斷來源。補登請使用上方日期；月曆也可修改日期與時間。" : "This is a consumption log, not dose guidance. The external link is only a Google search; evaluate sources yourself. Use the date above to backfill; calendar records remain editable."}</div></div></details></section>
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
    const perfect=actualPerfect && new Date(year,month+1,1).getTime()<=now.getTime();
    const cells:string[]=[]; for(let i=0;i<offset;i++)cells.push('<div class="calendar-cell blank"></div>');
    for(let day=1;day<=days;day++){ const key=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`; const d=byDate.get(key); const supplements=supplementByDate.get(key) ?? []; const hit=!!d&&d.totalMl>=d.targetMl; const selected=this.selectedWaterDate===key; const today=key===localDateKey(new Date()); cells.push(`<button class="calendar-cell water-day ${hit?"water-hit":""} ${supplements.length?"has-supplement":""} ${today?"today":""} ${selected?"selected":""}" data-water-day="${key}"><span>${day}</span>${supplements.length?`<b class="supplement-day-dot" title="${supplements.length} ${this.locale === "zh-TW" ? "筆補充品" : "supplement entries"}">●</b>`:""}</button>`); }
    const selected=byDate.get(this.selectedWaterDate);
    const selectedEntries=(selected?.entries ?? []).slice().sort((a,b)=>b.at.localeCompare(a.at));
    const selectedSupplements=this.supplementEntriesForDate(this.selectedWaterDate).slice().sort((a,b)=>b.at.localeCompare(a.at));
    const maxDateTime=this.toDateTimeLocal(new Date().toISOString());
    const waterRows=selectedEntries.length ? selectedEntries.map(entry=>{
      const summary=`<div class="entry-readonly-main"><strong>${entry.ml.toLocaleString()} mL</strong><span>${escapeHtml(this.formatTime(entry.at))} ${entry.editedAt ? `<em>${escapeHtml(this.editedText(entry.editedAt))}</em>` : ""}</span></div>`;
      if(!this.waterEntriesEditing) return `<div class="entry-readonly water-entry">${summary}</div>`;
      return `<details class="entry-editor water-entry"><summary>${summary}<span class="entry-edit-label">${this.locale === "zh-TW" ? "編輯" : "Edit"}</span></summary><div class="entry-edit-grid"><label class="field"><span>${this.locale === "zh-TW" ? "飲水量" : "Amount"}</span><input class="input compact-input" type="number" min="1" max="6000" step="1" value="${entry.ml}" data-water-entry-input="${escapeHtml(entry.id)}"></label><label class="field entry-edit-date"><span>${this.locale === "zh-TW" ? "日期與時間" : "Date & time"}</span><input class="input date-input" type="datetime-local" max="${maxDateTime}" value="${escapeHtml(this.toDateTimeLocal(entry.at))}" data-water-entry-at="${escapeHtml(entry.id)}"></label><div class="entry-edit-actions"><button class="btn small" data-save-water-entry="${escapeHtml(entry.id)}" data-water-entry-date="${escapeHtml(this.selectedWaterDate)}">${this.locale === "zh-TW" ? "儲存" : "Save"}</button><button class="icon-btn subtle-danger mini-icon" data-remove-water="${escapeHtml(entry.id)}" data-water-entry-date="${escapeHtml(this.selectedWaterDate)}" aria-label="${escapeHtml(this.text("removeWater"))}">${icon("trash")}</button></div></div></details>`;
    }).join("") : `<div class="small muted">${this.locale === "zh-TW" ? "這天沒有飲水紀錄。" : "No water entries on this day."}</div>`;
    const supplementRows=selectedSupplements.length ? selectedSupplements.map(entry=>{
      const dose=entry.amount ? `${entry.amount.toLocaleString()} ${this.supplementUnitLabel(entry.unit,entry.amount)}` : "";
      const summary=`<div class="supplement-entry-main"><strong>${escapeHtml(this.supplementLabel(entry.supplementId, entry.customLabel))}</strong><span>${dose ? `${escapeHtml(dose)} · ` : ""}${escapeHtml(this.formatTime(entry.at))} ${entry.editedAt ? `<em>${escapeHtml(this.editedText(entry.editedAt))}</em>` : ""}</span></div>`;
      if(!this.supplementEntriesEditing) return `<div class="entry-readonly supplement-entry">${summary}</div>`;
      const options=this.supplementOptions(entry.supplementId);
      const units=SUPPLEMENT_UNITS.map(unit=>`<option value="${unit}" ${unit===entry.unit?"selected":""}>${escapeHtml(this.supplementUnitLabel(unit,entry.amount ?? 1))}</option>`).join("");
      return `<details class="entry-editor supplement-entry"><summary>${summary}<span class="entry-edit-label">${this.locale === "zh-TW" ? "編輯" : "Edit"}</span></summary><div class="entry-edit-grid supplement-edit-grid"><label class="field entry-edit-wide"><span>${this.locale === "zh-TW" ? "補充品" : "Supplement"}</span><select class="select" data-supplement-entry-name="${escapeHtml(entry.id)}">${options}</select></label><label class="field"><span>${this.locale === "zh-TW" ? "數量" : "Amount"}</span><input class="input" type="number" min="0.01" max="100000" step="0.01" value="${entry.amount ?? 1}" data-supplement-entry-amount="${escapeHtml(entry.id)}"></label><label class="field"><span>${this.locale === "zh-TW" ? "單位" : "Unit"}</span><select class="select" data-supplement-entry-unit="${escapeHtml(entry.id)}">${units}</select></label><label class="field entry-edit-date"><span>${this.locale === "zh-TW" ? "日期與時間" : "Date & time"}</span><input class="input date-input" type="datetime-local" max="${maxDateTime}" value="${escapeHtml(this.toDateTimeLocal(entry.at))}" data-supplement-entry-at="${escapeHtml(entry.id)}"></label><div class="entry-edit-actions"><button class="btn small" data-save-supplement="${escapeHtml(entry.id)}" data-supplement-date="${escapeHtml(this.selectedWaterDate)}">${this.locale === "zh-TW" ? "儲存" : "Save"}</button><button class="icon-btn subtle-danger mini-icon" data-remove-supplement="${escapeHtml(entry.id)}" data-supplement-date="${escapeHtml(this.selectedWaterDate)}" aria-label="${this.locale === "zh-TW" ? "刪除補充品紀錄" : "Delete supplement entry"}">${icon("trash")}</button></div></div></details>`;
    }).join("") : `<div class="small muted">${this.locale === "zh-TW" ? "這天沒有補充品紀錄。" : "No supplement entries on this day."}</div>`;
    const supplementCount=selectedSupplements.length;
    return `<section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "飲水與補充品月曆" : "Water & supplement calendar"}${perfect?` <span class="blue-badge">◆</span>`:""}</h2><div class="calendar-nav"><button class="icon-btn mini-icon" data-water-calendar-nav="prev">‹</button><strong>${escapeHtml(first.toLocaleDateString(this.locale,{month:"long",year:"numeric"}))}</strong><button class="icon-btn mini-icon" data-water-calendar-nav="next">›</button></div></div><div class="card calendar-card water-calendar ${perfect?"perfect-water-month":""}"><div class="weekday-row">${(this.locale === "zh-TW" ? ["一","二","三","四","五","六","日"] : ["M","T","W","T","F","S","S"]).map(d=>`<span>${d}</span>`).join("")}</div><div class="calendar-grid">${cells.join("")}</div></div><p class="calendar-legend small muted">${this.locale==="zh-TW"?"藍底：飲水達標 · 紫點：有補充品紀錄":"Blue fill: target reached · Purple dot: supplement logged"}</p><div class="card water-day-detail selected-water-detail"><div class="water-day-detail-head"><div><strong>${escapeHtml(new Date(`${this.selectedWaterDate}T12:00:00`).toLocaleDateString(this.locale,{weekday:"long",month:"short",day:"numeric",year:"numeric"}))}</strong><span>${selected ? `${selected.totalMl.toLocaleString()} / ${selected.targetMl.toLocaleString()} mL${selected.totalMl>=selected.targetMl ? " ✓" : ""}` : `0 mL`}${supplementCount ? ` · ${supplementCount} ${this.locale === "zh-TW" ? "筆補充品" : supplementCount === 1 ? "supplement" : "supplements"}` : ""}</span></div></div><div class="day-log-section"><div class="day-log-heading"><div class="day-log-title">${icon("drop")}<strong>${this.locale === "zh-TW" ? "飲水" : "Water"}</strong></div>${selectedEntries.length ? `<button class="btn small ghost entry-mode-toggle" data-action="toggle-water-entry-edit">${this.waterEntriesEditing ? (this.locale === "zh-TW" ? "完成" : "Done") : (this.locale === "zh-TW" ? "編輯" : "Edit")}</button>` : ""}</div><div class="water-entry-list">${waterRows}</div></div><div class="day-log-section"><div class="day-log-heading"><div class="day-log-title">${icon("waterPill")}<strong>${this.locale === "zh-TW" ? "補充品" : "Supplements"}</strong></div>${selectedSupplements.length ? `<button class="btn small ghost entry-mode-toggle" data-action="toggle-supplement-entry-edit">${this.supplementEntriesEditing ? (this.locale === "zh-TW" ? "完成" : "Done") : (this.locale === "zh-TW" ? "編輯" : "Edit")}</button>` : ""}</div><div class="supplement-entry-list">${supplementRows}</div></div></div></section>`;
  }

  private renderFamily(): string {
    const score = weeklyGoalScore(this.state.workouts, this.state.hikes, this.currentWeightKg(), this.state.goals!, this.state.hydration, this.state.hydrationHistory ?? []);
    const membership = this.cloudMembership?.access.status === "active" ? this.cloudMembership : null;
    const cloudActive = Boolean(this.authUser && membership);
    const groupName = membership ? this.groupNames(membership.access.groupIds ?? [membership.access.groupId]) : "";
    const members = cloudActive
      ? membership!.members.filter(member => member.status === "active").map(member => ({
          id: member.uid,
          name: member.uid === this.authUser?.uid ? this.state.user.displayName : (member.displayName || "Cloud member"),
          role: member.role,
          isSelf: member.uid === this.authUser?.uid,
          photoURL: member.photoURL,
          groupId: member.groupId,
          groupIds: member.groupIds
        }))
      : [{ id: this.state.user.id, name: this.state.user.displayName, role: "member" as const, isSelf: true, photoURL: undefined as string | undefined, groupId: "local", groupIds: ["local"] }];
    if (!members.some(member => member.isSelf)) members.unshift({ id: this.state.user.id, name: this.state.user.displayName, role: membership?.access.role ?? "member", isSelf: true, photoURL: this.authUser?.photoURL ?? undefined, groupId: membership?.access.groupId ?? "local", groupIds: membership?.access.groupIds ?? [membership?.access.groupId ?? "local"] });

    const notice = cloudActive && membership!.access.role !== "owner"
      ? `<section class="section"><div class="card compact family-access-notice"><div><div class="strong">${this.locale === "zh-TW" ? "群組" : "Group"}: ${escapeHtml(groupName)}</div><div class="small muted">${this.locale === "zh-TW" ? "這裡只顯示你目前群組中可見的 Cloud 成員。" : "Only Cloud members who share at least one of your groups appear here."}</div></div><button class="btn small" data-action="open-family-settings">${this.locale === "zh-TW" ? "Cloud 設定" : "Cloud settings"}</button></div></section>`
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
      const visibleGroupIds = membership!.access.role === "owner"
        ? member.groupIds
        : member.groupIds.filter(groupId => (membership!.access.groupIds ?? [membership!.access.groupId]).includes(groupId));
      return `${this.locale === "zh-TW" ? "群組" : visibleGroupIds.length === 1 ? "Group" : "Groups"}: ${this.groupNames(visibleGroupIds)}`;
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
      if (member.isSelf) return `<button class="card compact family-member-card clickable self-profile-card" data-action="open-profile"><div class="row"><div class="row-start">${avatar}<div><div class="strong">${escapeHtml(member.name)}${this.locale === "zh-TW" ? "（你）" : " (you)"}</div><div class="small muted">${escapeHtml(groupLabel(member))} · ${score.score}/10 ${escapeHtml(this.text("weeklyGoalsDone"))}</div><div class="profile-link-hint">${escapeHtml(hint)}</div></div></div></div></button>`;
      return `<button class="card compact family-member-card clickable" data-family-member-profile="${escapeHtml(member.id)}"><div class="row"><div class="row-start">${avatar}<div><div class="strong">${escapeHtml(member.name)}</div><div class="small muted">${escapeHtml(groupLabel(member))}</div><div class="profile-link-hint">${escapeHtml(hint)}</div></div></div></div></button>`;
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
      <section class="section"><div class="card"><div class="strong">${escapeHtml(this.text("privacy"))}</div><p class="medium muted">${this.locale === "zh-TW" ? "Local 資料只留在裝置。Cloud 成員只可讀取自己群組允許的共用資料；開啟本週補充品分享時會包含每筆日期、時間與數量。身高、體重、逐筆飲水時間、精確 GPX 與照片仍為私人／本機。" : "Local data stays on-device. Cloud members can read only shared data allowed for their group. Sharing this week's supplements includes each entry's date, time and amount. Height, weight, individual drink times, precise GPX and photos remain private/local."}</p></div></section>`;
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
    const source = ownerId === this.authUser?.uid ? this.state.workouts : this.cloudFamilyWorkouts.map(envelope => envelope.workout);
    const workouts = source
      .filter(workout =>
        workout.ownerId === ownerId &&
        Boolean(workout.completedAt) &&
        new Date(workout.completedAt!).getTime() >= start.getTime() &&
        new Date(workout.completedAt!).getTime() < end.getTime()
      );
    const counts = weeklyCategorySets(workouts);
    const hikes = ownerId === this.authUser?.uid ? this.state.hikes : this.cloudFamilyHikes.map(item=>item.hike);
    counts.cardio += hikes.filter(h=>h.ownerId===ownerId && new Date(`${h.date}T12:00:00`)>=start && new Date(`${h.date}T12:00:00`)<end).reduce((sum,h)=>sum+Math.min(2,Math.max(0,h.movingMinutes/20)),0);
    return counts;
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

  private familyScienceMetrics(ownerId: string) {
    const workouts = (ownerId === this.authUser?.uid ? this.state.workouts : this.cloudFamilyWorkouts.map(item => item.workout)).filter(workout => workout.ownerId === ownerId);
    const hikes = (ownerId === this.authUser?.uid ? this.state.hikes : this.cloudFamilyHikes.map(item => item.hike)).filter(hike => hike.ownerId === ownerId);
    return scienceWeekMetrics(workouts, hikes, this.state.goals!, undefined, [], new Date());
  }

  private currentFamilyWeekly(ownerId: string): CloudFamilyWeeklySummary | undefined {
    const key = weekKey(new Date());
    return this.cloudFamilyWeekly.find(item => item.ownerId === ownerId && item.weekStart === key);
  }

  private familyMomentum(ownerId: string): boolean[] {
    return Array.from({ length: 4 }, (_, offset) => {
      const ref = new Date();
      ref.setDate(ref.getDate() - offset * 7);
      const key = weekKey(ref);
      const summary = this.cloudFamilyWeekly.find(item => item.ownerId === ownerId && item.weekStart === key);
      return Boolean(summary && summary.missionScore >= 8);
    }).reverse();
  }

  private renderFamilyActivityComparison(memberUid: string, memberName: string): string {
    const selfUid = this.authUser?.uid ?? "";
    const firstName = memberName.split(/\s+/)[0] || memberName;
    const mine = this.familyScienceMetrics(selfUid);
    const theirs = this.familyScienceMetrics(memberUid);
    const myWeekly = {...this.currentWeekFamilySummary(),schemaVersion:1 as const,ownerId:selfUid,familyId:this.state.user.familyId,clientUpdatedAt:new Date().toISOString()};
    const theirWeekly = this.currentFamilyWeekly(memberUid);
    const myMix = this.familyWeeklyCategoryCounts(selfUid);
    const theirMix = this.familyWeeklyCategoryCounts(memberUid);
    const zh = this.locale === "zh-TW";
    const myMomentum = this.familyMomentum(selfUid);
    const theirMomentum = this.familyMomentum(memberUid);
    const momentumRow = (label: string, values: boolean[]) => `<div class="family-momentum-person"><strong>${escapeHtml(label)}</strong><div class="family-momentum-dots">${values.map(done=>`<i class="${done?"done":""}">${done?"✓":"○"}</i>`).join("")}</div><b>${values.filter(Boolean).length}/4</b></div>`;
    const valueOrDash = (value: number | undefined, suffix = "") => value === undefined ? "—" : `${value}${suffix}`;
    const rows = [
      { label: "Push", mine: this.trainingCreditText(mine.movement.push), theirs: this.trainingCreditText(theirs.movement.push), unit: zh ? "點" : "cr" },
      { label: "Pull", mine: this.trainingCreditText(mine.movement.pull), theirs: this.trainingCreditText(theirs.movement.pull), unit: zh ? "點" : "cr" },
      { label: zh ? "下肢" : "Lower", mine: this.trainingCreditText(mine.movement.lower), theirs: this.trainingCreditText(theirs.movement.lower), unit: zh ? "點" : "cr" },
      { label: zh ? "核心" : "Core", mine: this.trainingCreditText(mine.movement.core), theirs: this.trainingCreditText(theirs.movement.core), unit: zh ? "點" : "cr" },
      { label: zh ? "有氧" : "Cardio", mine: String(Math.round(mine.cardioMinutes)), theirs: String(Math.round(theirs.cardioMinutes)), unit: zh ? "分" : "min" },
      { label: zh ? "活動度" : "Mobility", mine: String(Math.round(mine.mobilityMinutes)), theirs: String(Math.round(theirs.mobilityMinutes)), unit: zh ? "分" : "min" }
    ];
    const balanceRows = rows.map(row => `<div class="family-balance-row"><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(row.mine)} <small>${escapeHtml(row.unit)}</small></strong><strong>${escapeHtml(row.theirs)} <small>${escapeHtml(row.unit)}</small></strong></div>`).join("");
    const personCard = (label: string, weekly: CloudFamilyWeeklySummary | undefined, metrics: ReturnType<typeof scienceWeekMetrics>, css: string) => `<div class="family-activity-person ${css}"><strong>${escapeHtml(label)}</strong><div><span>${zh?"每週難度":"Weekly difficulty"}</span><b>${weekly?.difficulty ? escapeHtml(weekly.difficulty === "easy" ? (zh?"輕鬆":"Easy") : weekly.difficulty === "extreme" ? (zh?"進階":"Extreme") : weekly.difficulty === "hard" ? (zh?"挑戰":"Hard") : (zh?"標準":"Normal")) : `<small>${zh?"需要同步":"Needs sync"}</small>`}</b></div><div><span>★ ${zh ? "金色日" : "Gold Days"}</span><b>${valueOrDash(weekly?.calorieDays ?? metrics.goldDays, "/7")}</b></div><div><span>${zh ? "每週任務" : "Missions"}</span><b>${weekly ? `${weekly.missionScore}/${weekly.missionMax}` : "—"}</b></div><div><span>${zh ? "飲水達標" : "Hydration"}</span><b>${weekly ? `${weekly.waterDays}/7` : "—"}</b></div></div>`;
    return `<div class="family-activity-summary">${personCard(zh ? "你" : "You", myWeekly, mine, "self")}${personCard(firstName, theirWeekly, theirs, "member")}</div>
      <div class="family-momentum-compare"><div class="family-momentum-title"><strong>${zh ? "四週動量" : "4-week momentum"}</strong><span>${zh ? "最近四週中完成 8 個以上任務的週數。" : "Weeks with 8+ missions completed."}</span></div>${momentumRow(zh ? "你" : "You",myMomentum)}${momentumRow(firstName,theirMomentum)}</div>
      <div class="family-balance-card"><div class="family-balance-head"><span>${zh ? "活動平衡" : "Activity balance"}</span><strong>${zh ? "你" : "You"}</strong><strong>${escapeHtml(firstName)}</strong></div>${balanceRows}<div class="family-balance-footer"><span>${zh ? "力量天數" : "Strength days"}</span><strong>${mine.strengthDays}</strong><strong>${theirs.strengthDays}</strong></div></div>
      <div class="comparison-mix-head"><strong>${zh ? "訓練分布" : "Training mix"}</strong><span>${escapeHtml(weekKey())} · ${zh ? "本週比例：你的紀錄／對方共用紀錄" : "This week: your records / their shared records"}</span></div>
      <div class="comparison-mix-grid">${this.categoryDonut(myMix,zh ? "你" : "You")}${this.categoryDonut(theirMix,firstName)}</div>`;
  }

  private renderFamilyTrendComparison(memberUid: string, memberName: string, metric: "calories" | "water"): string {
    const selfUid = this.authUser?.uid ?? "";
    const mine = this.familyWeeklySeries(selfUid, metric);
    const theirs = this.familyWeeklySeries(memberUid, metric);
    const myTotal = mine.reduce((sum, point) => sum + point.count, 0);
    const theirTotal = theirs.reduce((sum, point) => sum + point.count, 0);
    const observedMax = Math.max(0, ...mine.map(point => point.count), ...theirs.map(point => point.count));
    const scaleStep = metric === "water"
      ? Math.max(1000, Math.ceil(Math.max(2000, observedMax) / 2 / 500) * 500)
      : Math.max(100, Math.ceil(Math.max(200, observedMax) / 2 / 100) * 100);
    const max = scaleStep * 2;
    const width = 520, height = 180, left = 46, right = 12, top = 16, bottom = 30;
    const pointString = (series: Array<{ count: number }>) => series.map((point, index) => {
      const x = left + (index / 6) * (width - left - right);
      const y = top + (1 - point.count / max) * (height - top - bottom);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const firstName = memberName.split(/\s+/)[0] || memberName;
    const unit = metric === "water" ? "mL" : "Cal";
    const metricLabel = metric === "water" ? (this.locale === "zh-TW" ? "飲水" : "Water") : (this.locale === "zh-TW" ? "估算熱量" : "Estimated calories");
    const focus = this.familyComparisonFocus;
    const focusClass = focus === "self" ? "focus-self" : "focus-member";
    const note = metric === "water"
      ? (this.locale === "zh-TW" ? "只比較每天共用的飲水總量；逐筆飲水時間仍是私人資料。" : "Compares only shared daily water totals; individual drink timestamps remain private.")
      : (this.locale === "zh-TW" ? "熱量只保留為估算趨勢，不是分數，也不影響每週任務或金色日。" : "Calories are kept as an estimated trend, not a score, and do not affect Missions or Gold Days.");
    const dayValues = mine.map((point,index) => {
      const other = theirs[index]?.count ?? 0;
      const active = focus === "self" ? point.count : other;
      const inactive = focus === "self" ? other : point.count;
      return `<span class="comparison-day-cell"><b>${active.toLocaleString()} <em>${unit}</em></b><small>${inactive.toLocaleString()} <em>${unit}</em></small><span>${escapeHtml(point.label)}</span></span>`;
    }).join("");
    const grid = [0, 0.5, 1].map(fraction => {
      const value = Math.round(max * fraction);
      const y = top + (1 - fraction) * (height - top - bottom);
      const tick = metric === "water" && value >= 1000 ? `${Number((value/1000).toFixed(1))}k` : value.toLocaleString();
      return `<line x1="${left}" y1="${y.toFixed(1)}" x2="${width-right}" y2="${y.toFixed(1)}" class="chart-grid"/><text x="${left-7}" y="${(y+3).toFixed(1)}" text-anchor="end" class="chart-tick">${tick}</text>`;
    }).join("");
    const svgSeries = (series: Array<{ count: number; label: string }>, who: "self" | "member") =>
      `<polyline class="comparison-line ${who}" points="${pointString(series)}"/>${series.map((point,index)=>{ const x=left+(index/6)*(width-left-right); const y=top+(1-point.count/max)*(height-top-bottom); return `<circle class="comparison-dot ${who}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5"><title>${escapeHtml(point.label)}: ${point.count} ${unit}</title></circle>`; }).join("")}`;
    const comparisonSeries = focus === "self"
      ? `${svgSeries(theirs,"member")}${svgSeries(mine,"self")}`
      : `${svgSeries(mine,"self")}${svgSeries(theirs,"member")}`;
    return `<div class="family-comparison-summary ${metric === "water" ? "water-mode" : "calorie-mode"} ${focusClass}"><button class="comparison-summary-self" data-family-comparison-focus="self" aria-pressed="${focus === "self"}"><span>${this.locale === "zh-TW" ? "你" : "You"}</span><strong>${myTotal.toLocaleString()} ${unit}</strong></button><button class="comparison-summary-member" data-family-comparison-focus="member" aria-pressed="${focus === "member"}"><span>${escapeHtml(firstName)}</span><strong>${theirTotal.toLocaleString()} ${unit}</strong></button></div>
      <div class="family-comparison-chart ${metric === "water" ? "water-mode" : "calorie-mode"} ${focusClass}"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(metricLabel)}">${grid}${comparisonSeries}</svg><div class="comparison-day-labels">${dayValues}</div></div>
      <div class="tiny muted family-trend-note">${escapeHtml(note)}</div>`;
  }

  private renderFamilyComparison(memberUid: string, memberName: string): string {
    const metric = this.familyComparisonMetric;
    const tabs = `<div class="comparison-tabs segmented family-compare-tabs"><button data-family-comparison-metric="activity" class="${metric === "activity" ? "active" : ""}">${this.locale === "zh-TW" ? "本週活動" : "Weekly activity"}</button><button data-family-comparison-metric="calories" class="${metric === "calories" ? "active" : ""}">${this.locale === "zh-TW" ? "熱量趨勢" : "Calories"}</button><button data-family-comparison-metric="water" class="${metric === "water" ? "active" : ""}">${this.locale === "zh-TW" ? "飲水趨勢" : "Water"}</button></div>`;
    return `${tabs}${metric === "activity" ? this.renderFamilyActivityComparison(memberUid, memberName) : this.renderFamilyTrendComparison(memberUid, memberName, metric)}`;
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
    const name = member.displayName || (this.locale === "zh-TW" ? "使用者" : "User");
    const initials = name.split(/\s+/).map(part => part[0] ?? "").join("").slice(0,2).toUpperCase();
    const avatar = member.photoURL ? `<img class="family-public-avatar" src="${escapeHtml(member.photoURL)}" referrerpolicy="no-referrer" alt="${escapeHtml(name)}">` : `<div class="family-public-avatar placeholder">${escapeHtml(initials)}</div>`;
    const role = member.role === "owner" ? (this.locale === "zh-TW" ? "擁有者" : "Owner") : (this.locale === "zh-TW" ? "成員" : "Member");
    const sharing = this.normalizeFamilyProfileSharing(member.profileSharing);
    const sex = this.biologicalSexLabel(member.biologicalSex);
    const memberBadges = this.cloudFamilyBadges.filter(badge=>badge.ownerId===member.uid).slice();
    const monthlyBadges = memberBadges.filter(badge => badge.badgeType === "monthly").sort((a,b)=>b.earnedAt.localeCompare(a.earnedAt));
    const hikeBadges = memberBadges.filter(badge => badge.badgeType === "hike").sort((a,b)=>(a.sortOrder ?? 9999)-(b.sortOrder ?? 9999) || a.earnedAt.localeCompare(b.earnedAt));
    const comparison = !this.cloudCompanionReady ? `<div class="small muted">${this.locale === "zh-TW" ? "正在同步家庭進度…" : "Syncing family progress…"}</div>` : this.cloudCompanionError ? `<div class="small danger-text">${escapeHtml(this.cloudCompanionError)}</div>` : this.renderFamilyComparison(member.uid,name);
    const monthlyBadgeGrid = monthlyBadges.length ? `<div class="badge-gallery">${monthlyBadges.map(badge=>`<div class="earned-badge"><span>★</span><strong>${escapeHtml(badge.title)}</strong><small>${escapeHtml(badge.subtitle)}</small></div>`).join("")}</div>` : `<div class="empty-mini">${this.locale === "zh-TW" ? "目前沒有月度徽章。" : "No monthly badges yet."}</div>`;
    const hikeBadgeGrid = hikeBadges.length ? `<div class="badge-gallery hiking-gallery">${hikeBadges.map(badge=>`<div class="earned-badge hike-badge"><span>▲</span><strong>${escapeHtml(badge.title)}</strong><small>${escapeHtml(badge.subtitle)}</small></div>`).join("")}</div>` : `<div class="empty-mini">${this.locale === "zh-TW" ? "目前沒有健行徽章。" : "No hiking badges yet."}</div>`;

    const developerOwner = this.isDeveloperOwner();
    const personPokeMuted = (this.state.notificationPreferences?.mutedPokeUids ?? []).includes(member.uid);
    const pokeBalanceLabel = developerOwner ? "∞" : `${this.pokeBalance}/7`;
    const pokeCard = `<section class="section"><div class="card family-poke-card"><div class="family-poke-copy"><strong>${this.locale === "zh-TW" ? "送個 Poke" : "Send a Poke"}</strong><span>${developerOwner ? (this.locale === "zh-TW" ? "開發者測試：Poke ∞。接收端的靜音與防洪限制仍然有效。" : "Developer test: unlimited Pokes. Recipient mute and flood protections still apply.") : (this.locale === "zh-TW" ? `用 1 個 Poke 傳送簡短鼓勵。你目前有 ${pokeBalanceLabel}。` : `Spend 1 Poke on a quick bit of encouragement. You have ${pokeBalanceLabel}.`)}</span></div><div class="poke-emoji-row">${["👋","💪","🎉","🔥","🫡"].map(emoji=>`<button class="poke-emoji" data-poke-emoji="${emoji}" data-poke-recipient="${escapeHtml(member.uid)}" ${this.pokeBusy || (!developerOwner && this.pokeBalance < 1) ? "disabled" : ""} aria-label="${this.locale === "zh-TW" ? "傳送 Poke" : "Send Poke"} ${emoji}">${emoji}</button>`).join("")}</div><div class="poke-member-controls"><button class="btn small ghost ${personPokeMuted ? "active" : ""}" data-toggle-poke-mute-user="${escapeHtml(member.uid)}">${personPokeMuted ? (this.locale === "zh-TW" ? "取消靜音這個人的 Pokes" : "Unmute Pokes from this person") : (this.locale === "zh-TW" ? "靜音這個人的 Pokes" : "Mute Pokes from this person")}</button></div><div class="tiny muted">${this.locale === "zh-TW" ? "靜音只影響你收到的 Poke；對方不會看到你是否將他靜音。" : "Muting only affects Pokes you receive; the sender is not told whether you muted them."}</div></div></section>`;
    const weekly = this.cloudFamilyWeekly.find(item => item.ownerId === member.uid && item.weekStart === weekKey(new Date()));
    const weeklyCard = weekly ? `<div class="family-weekly-grid">
      <div><span>${this.locale === "zh-TW" ? "本週任務" : "Weekly missions"}</span><strong class="mission-score">${weekly.missionScore}/${weekly.missionMax}</strong></div>
      <div><span>${this.locale === "zh-TW" ? "金色活動日" : "Gold Days"}</span><strong class="gold-text">★ ${weekly.calorieDays}/7</strong></div>
      <div><span>${this.locale === "zh-TW" ? "運動次數" : "Workouts"}</span><strong>${weekly.workoutCount}</strong></div>
      <div><span>${this.locale === "zh-TW" ? "健行" : "Hikes"}</span><strong>${weekly.hikeCount} · ${weekly.hikeKm.toFixed(1)} km</strong></div>
      <div><span>${this.locale === "zh-TW" ? "飲水達標日" : "Hydration days"}</span><strong>${weekly.waterDays}/7</strong></div>
      <div><span>${this.locale === "zh-TW" ? "任務模型" : "Mission model"}</span><strong>${this.locale === "zh-TW" ? "10 項平衡任務" : "10 balanced missions"}</strong></div>
    </div>` : `<div class="empty-mini">${this.locale === "zh-TW" ? "這週還沒有已同步的成就資料。" : "No synced weekly achievement data yet."}</div>`;

    const familySupplementEntries = weekly?.supplementEntries ?? [];
    const familySupplementReview = weekly && familySupplementEntries.length
      ? this.renderWeeklySupplementRows(familySupplementEntries.map(entry=>({date:entry.date,time:entry.time,supplementId:entry.supplementId,...(entry.customLabel?{customLabel:entry.customLabel}:{}),...(entry.amount!==undefined?{amount:entry.amount}:{}),...(entry.unit?{unit:entry.unit}:{} as {unit?:SupplementUnit})})), new Date(`${weekly.weekStart}T12:00:00`))
      : null;
    const supplementRows = familySupplementReview?.rows || (weekly?.supplements.length ? weekly.supplements.map(item=>{
      const quantity=item.mixedUnits||!item.unit
        ? `${item.entries} ${this.locale === "zh-TW" ? "筆" : item.entries===1 ? "entry" : "entries"}`
        : `${item.amount.toLocaleString()} ${this.supplementUnitLabel(item.unit,item.amount)}`;
      return `<div class="supplement-week-row"><div><strong>${escapeHtml(this.supplementLabel(item.supplementId,item.customLabel))}</strong><span>${item.days} ${this.locale === "zh-TW" ? "天" : item.days===1 ? "day" : "days"} · ${item.entries} ${this.locale === "zh-TW" ? "次" : item.entries===1 ? "entry" : "entries"}</span></div><b>${escapeHtml(quantity)}</b></div>`;
    }).join("") : `<div class="empty-mini">${this.locale === "zh-TW" ? "這週沒有已同步的補充品紀錄。" : "No synced supplements this week."}</div>`);

    const memberWorkouts = this.cloudFamilyWorkouts.filter(item => item.workout.ownerId === member.uid && item.workout.visibility === "family").slice().sort((a,b)=>(b.workout.completedAt ?? b.workout.startedAt).localeCompare(a.workout.completedAt ?? a.workout.startedAt)).slice(0,6);
    const workoutRows = memberWorkouts.length ? memberWorkouts.map((item,index) => {
      const workout = item.workout;
      const workoutDate = localDateKey(workout.completedAt ?? workout.startedAt);
      const previousDate = index > 0 ? localDateKey(memberWorkouts[index-1]!.workout.completedAt ?? memberWorkouts[index-1]!.workout.startedAt) : "";
      const dateDivider = workoutDate !== previousDate
        ? `<div class="family-workout-date-divider"><span>${escapeHtml(new Date(`${workoutDate}T12:00:00`).toLocaleDateString(this.locale,{weekday:"short",month:"short",day:"numeric",year:"numeric"}))}</span></div>`
        : "";
      const completedExercises = workout.exercises.filter(exercise => exercise.sets.some(set => set.completed));
      const exerciseSummary = completedExercises.slice(0,4).map(exercise => {
        const definition = exerciseById(exercise.exerciseId);
        const label = definition?.names[this.locale] ?? exercise.exerciseId;
        const sets = exercise.sets.filter(set => set.completed).length;
        return `${label} × ${sets}`;
      }).join(" · ");
      const durationMinutes = workoutDurationMinutes(workout);
      const detail = `<div class="family-workout-detail"><div class="detail-grid workout-time-grid"><div><span>${escapeHtml(this.text("startTime"))}</span><strong>${escapeHtml(this.formatTime(workout.startedAt))}</strong></div><div><span>${escapeHtml(this.text("endTime"))}</span><strong>${escapeHtml(this.formatTime(workout.completedAt ?? undefined))}</strong></div><div><span>${escapeHtml(this.text("totalTime"))}</span><strong>${durationMinutes ? formatDuration(durationMinutes) : "—"}</strong></div><div><span>${this.locale === "zh-TW" ? "估算熱量" : "Estimated calories"}</span><strong>~${item.estimatedCalories.toLocaleString()} Cal</strong></div></div><div class="nested-exercises">${workout.routineMode === "circuit" ? this.renderSavedCircuitRounds(workout) : workout.exercises.map((exercise,index)=>this.renderSavedExercise(workout,exercise,index)).join("")}</div>${workout.notes?`<div class="detail-notes"><span>${escapeHtml(this.text("notes"))}</span>${escapeHtml(workout.notes)}</div>`:""}</div>`;
      return `${dateDivider}<details class="family-workout-row"><summary><span class="history-icon">${icon(workout.recordingSource === "manual" || workout.recordingSource === "imported" ? "history" : "dumbbell")}</span><div><strong>${escapeHtml(workout.routineName)}</strong><span>${escapeHtml(this.formatDate(workout.completedAt ?? workout.startedAt))} · ~${item.estimatedCalories.toLocaleString()} Cal · ${completedSetCount(workout)} ${this.locale === "zh-TW" ? "組" : "sets"}${workout.editedAt ? ` · ${escapeHtml(this.editedText(workout.editedAt))}` : ""}</span>${exerciseSummary ? `<small>${escapeHtml(exerciseSummary)}${completedExercises.length > 4 ? " …" : ""}</small>` : ""}</div><span class="history-chevron">${icon("chevron")}</span></summary>${detail}</details>`;
    }).join("") : `<div class="empty-mini">${this.locale === "zh-TW" ? "目前沒有已分享的運動。" : "No shared workouts yet."}</div>`;

    const memberHikes = this.cloudFamilyHikes.filter(item => item.hike.ownerId === member.uid).slice().sort((a,b)=>b.hike.date.localeCompare(a.hike.date)).slice(0,6);
    const hikeRows = memberHikes.length ? memberHikes.map(item => {
      const hike=item.hike;
      return `<div class="family-hike-row"><span class="history-icon hike">${icon("mountain")}</span><div><strong>${escapeHtml(hike.name)}</strong><span>${escapeHtml(new Date(`${hike.date}T12:00:00`).toLocaleDateString(this.locale,{month:"short",day:"numeric",year:"numeric"}))} · ${hike.startedAt ? `${escapeHtml(this.formatTime(hike.startedAt))} · ` : ""}${hike.distanceKm.toFixed(1)} km · ${formatDuration(hike.movingMinutes)} · +${hike.elevationGainM} m · ${this.locale === "zh-TW" ? "難度" : "difficulty"} ${hike.difficulty}/5${hike.editedAt ? ` · ${escapeHtml(this.editedText(hike.editedAt))}` : ""}</span>${hike.notes ? `<small>${escapeHtml(hike.notes)}</small>` : ""}</div></div>`;
    }).join("") : `<div class="empty-mini">${this.locale === "zh-TW" ? "目前沒有已同步的健行。" : "No synced hikes yet."}</div>`;

    return `<div class="workout-header"><button class="btn ghost touch" data-action="back-family">${icon("back")} ${escapeHtml(this.text("family"))}</button></div>
      <section class="card family-public-hero">${avatar}<div><div class="tiny muted">${escapeHtml(membership.family?.name ?? this.text("family"))}</div><h1>${escapeHtml(name)}</h1><div class="small muted">${escapeHtml(role)}${sharing.biologicalSex ? ` · ${this.locale === "zh-TW" ? "生理性別" : "Biological sex"}: ${escapeHtml(sex)}` : ""}</div></div></section>
      ${pokeCard}
      <section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "本週比較" : "This week"}</h2><span class="section-value">${this.locale === "zh-TW" ? "家庭總量" : "Family totals"}</span></div><div class="card family-comparison-card">${comparison}</div></section>
      <section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "本週成就" : "Weekly achievements"}</h2><span class="section-value mission-score">${weekly ? `${weekly.missionScore}/${weekly.missionMax}` : "—"}</span></div><div class="card">${weeklyCard}</div></section>
      ${sharing.supplements ? `<section class="section family-profile-collapsible"><details class="card family-profile-details"><summary><span>${this.locale === "zh-TW" ? "本週補充品" : "This week's supplements"}</span><span class="section-value">${weekly?.supplements.length ?? 0}</span></summary><div class="family-details-body family-supplement-list">${supplementRows}</div></details></section>` : ""}
      ${sharing.recentWorkouts ? `<section class="section family-profile-collapsible"><details class="card family-profile-details"><summary><span>${this.locale === "zh-TW" ? "最近運動" : "Recent workouts"}</span><span class="section-value">${memberWorkouts.length}</span></summary><div class="family-details-body family-workout-list">${workoutRows}</div></details></section>` : ""}
      ${sharing.recentHikes ? `<section class="section family-profile-collapsible"><details class="card family-profile-details"><summary><span>${this.locale === "zh-TW" ? "最近健行" : "Recent hikes"}</span><span class="section-value">${memberHikes.length}</span></summary><div class="family-details-body family-hike-list">${hikeRows}</div><div class="tiny muted family-hike-privacy family-details-note">${this.locale === "zh-TW" ? "健行名稱、日期、距離、時間、海拔、難度與備註會同步給家庭；精確 GPX 路線與照片目前仍只留在自己的裝置。" : "Hike name, date, distance, time, elevation, difficulty and notes are shared with Family; exact GPX traces and photos remain on your own device for now."}</div></details></section>` : ""}
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
    this.ensureScienceAwards();
    const localMonthlyBadges=(this.state.science?.earnedMonthlyBadges ?? []).slice().sort((a,b)=>b.month.localeCompare(a.month));
    const cloudMonthlyBadges = this.cloudOwnBadges.filter(badge=>badge.badgeType==="monthly").slice().sort((a,b)=>b.earnedAt.localeCompare(a.earnedAt));
    const localHikeBadges = this.hikingBadges();
    const profileSharing = this.familyProfileSharing();
    const canShareProfile = Boolean(this.authUser && this.cloudMembership?.access.status === "active");
    const initials=this.state.user.displayName.split(/\s+/).map(part=>part[0]??"").join("").slice(0,2).toUpperCase();
    return `<div class="workout-header"><button class="btn ghost touch" data-action="back-family">${icon("back")} ${escapeHtml(this.text("family"))}</button></div><h1 class="page-title">${escapeHtml(this.text("personal"))}</h1><p class="page-subtitle">${this.locale === "zh-TW" ? "你的個人資料、體重趨勢與徽章。身高、體重與照片保持私人；你可以選擇家庭成員能在個人頁看到哪些其他內容。" : "Your personal details, weight trend and badges. Height, weight and photos stay private; you can choose which other profile details family members see."}</p>
      ${!recordedThisMonth ? `<div class="banner attention">${escapeHtml(this.text("monthlyWeightPrompt"))}</div>` : ""}
      <section class="profile-hero card"><div class="profile-photo-wrap">${profile.photoId ? this.privateImage(profile.photoId,"profile-photo",this.state.user.displayName) : this.authUser?.photoURL ? `<img class="profile-photo" src="${escapeHtml(this.authUser.photoURL)}" referrerpolicy="no-referrer" alt="${escapeHtml(this.state.user.displayName)}">` : `<div class="profile-photo placeholder">${escapeHtml(initials)}</div>`}<label class="profile-photo-edit">${this.locale === "zh-TW" ? "更換照片" : "Change photo"}<input id="profile-photo-input" type="file" accept="image/*" hidden></label></div><form id="profile-form" class="form-grid profile-fields"><div class="field"><label>${escapeHtml(this.text("name"))}</label><input class="input" name="name" maxlength="60" value="${escapeHtml(this.state.user.displayName)}"></div><div class="field"><label>${this.locale === "zh-TW" ? "生理性別" : "Biological sex"}</label><select class="select" name="biologicalSex"><option value="" ${!profile.biologicalSex ? "selected" : ""}>${this.locale === "zh-TW" ? "未設定" : "Not set"}</option><option value="female" ${profile.biologicalSex === "female" ? "selected" : ""}>${this.locale === "zh-TW" ? "女性" : "Female"}</option><option value="male" ${profile.biologicalSex === "male" ? "selected" : ""}>${this.locale === "zh-TW" ? "男性" : "Male"}</option><option value="other" ${profile.biologicalSex === "other" ? "selected" : ""}>${this.locale === "zh-TW" ? "其他／雙性" : "Other / intersex"}</option><option value="prefer_not" ${profile.biologicalSex === "prefer_not" ? "selected" : ""}>${this.locale === "zh-TW" ? "不提供" : "Prefer not to say"}</option></select></div><div class="form-two"><div class="field"><label>${escapeHtml(this.text("heightCm"))}</label><input class="input" name="height" type="number" min="80" max="250" step="0.1" value="${profile.heightCm ?? ""}"></div><div class="field"><label>${escapeHtml(this.text("currentWeight"))}</label><input class="input" name="weight" type="number" min="20" max="350" step="0.1" value="${latest?.kg ?? ""}"></div></div>${bmi !== null ? `<div class="bmi-readout"><div><span>BMI</span><strong>${bmi.toFixed(1)}</strong><em>${escapeHtml(bmiLabel)}</em></div><p>${this.locale === "zh-TW" ? "成人參考：過輕 <18.5、正常 18.5–<24、過重 24–<27、肥胖 ≥27。成人 BMI 分類不因生理性別改變。" : "Adult reference: underweight <18.5, normal 18.5–<24, overweight 24–<27, obesity ≥27. Adult BMI categories use the same cutoffs regardless of biological sex."}</p></div>` : `<div class="small muted">${this.locale === "zh-TW" ? "填入身高與體重後會自動計算 BMI。" : "Add height and weight to calculate BMI automatically."}</div>`}${canShareProfile ? `<div class="profile-sharing-card"><div class="profile-sharing-head"><strong>${this.locale === "zh-TW" ? "家庭個人頁分享" : "Family profile sharing"}</strong><span>${this.locale === "zh-TW" ? "勾選你願意讓同群組家庭成員在你的個人頁看到的內容。身高、體重、照片與 GPX 路線仍不分享。" : "Choose what members of your family group may see on your profile. Height, weight, photos and GPX traces stay private."}</span></div><label class="profile-sharing-option"><input type="checkbox" name="shareBiologicalSex" ${profileSharing.biologicalSex ? "checked" : ""}><span><b>${this.locale === "zh-TW" ? "生理性別" : "Biological sex"}</b><small>${this.locale === "zh-TW" ? "只顯示你上方選擇的生理性別。" : "Shows only the biological-sex value selected above."}</small></span></label><label class="profile-sharing-option"><input type="checkbox" name="shareSupplements" ${profileSharing.supplements ? "checked" : ""}><span><b>${this.locale === "zh-TW" ? "本週補充品" : "This week's supplements"}</b><small>${this.locale === "zh-TW" ? "分享本週彙總，以及每筆紀錄的日期、時間與數量。" : "Shares weekly totals plus each entry's date, time and amount."}</small></span></label><label class="profile-sharing-option"><input type="checkbox" name="shareRecentWorkouts" ${profileSharing.recentWorkouts ? "checked" : ""}><span><b>${this.locale === "zh-TW" ? "最近運動" : "Recent workouts"}</b><small>${this.locale === "zh-TW" ? "控制家庭個人頁是否顯示近期已分享運動。" : "Controls whether recent already-shared workouts appear on your family profile."}</small></span></label><label class="profile-sharing-option"><input type="checkbox" name="shareRecentHikes" ${profileSharing.recentHikes ? "checked" : ""}><span><b>${this.locale === "zh-TW" ? "最近健行" : "Recent hikes"}</b><small>${this.locale === "zh-TW" ? "控制家庭個人頁是否顯示近期健行摘要。" : "Controls whether recent hike summaries appear on your family profile."}</small></span></label></div>` : ""}<button class="btn primary" type="submit">${escapeHtml(this.text("saveProfile"))}</button></form></section>
      <section class="section"><div class="section-header"><h2 class="section-title">${escapeHtml(this.text("weightTrend"))}</h2><span class="section-value">${latest ? `${latest.kg} kg` : "—"}</span></div><div class="card">${this.weightLineChart()}</div></section>
      <section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "月度徽章" : "Monthly badges"}</h2><span class="section-value">${cloudMonthlyBadges.length || localMonthlyBadges.length} ${this.locale === "zh-TW" ? "枚" : "earned"}</span></div><div class="card"><div class="badge-gallery">${cloudMonthlyBadges.length ? cloudMonthlyBadges.map(badge=>`<div class="earned-badge"><span>★</span><strong>${escapeHtml(badge.title)}</strong><small>${escapeHtml(badge.subtitle)}</small></div>`).join("") : localMonthlyBadges.map(item=>{ const [y,m]=item.month.split("-").map(Number); const d=new Date(y||new Date().getFullYear(),Math.max(0,(m||1)-1),1); return `<div class="earned-badge"><span>★</span><strong>${escapeHtml(d.toLocaleDateString(this.locale,{month:"short",year:"numeric"}))}</strong><small>${item.scoringVersion===2 ? `${item.completed}/${item.available}` : (this.locale === "zh-TW" ? "舊版規則" : "Legacy")}</small></div>`; }).join("")}${!cloudMonthlyBadges.length && !localMonthlyBadges.length ? `<div class="empty-mini">${this.locale === "zh-TW" ? "完成當月可用週任務的約 80% 即可取得月度徽章；一旦取得就不會因後續規則更新而被收回。" : "Complete about 80% of the weekly missions available in the month to earn the badge; once earned, later scoring updates do not revoke it."}</div>` : ""}</div></div></section>
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
        ? `<div class="card cloud-family-card"><div><div class="strong">${this.locale === "zh-TW" ? "Cloud 邀請" : "Cloud invitation"}</div><p class="small muted">${this.locale === "zh-TW" ? "此連結已開啟 Cloud 授權流程。登入必須使用邀請指定的 Google 電子郵件。" : "This link has opened the Cloud authorization flow. Sign in with the Google email named by the invitation."}</p></div>${!this.authUser ? this.googleSignInButton("Continue with Google", "使用 Google 接受邀請", true) : ""}<div class="invite-install-guide"><strong>${this.locale === "zh-TW" ? "建議先安裝到主畫面" : "Install to Home Screen first"}</strong><ol><li>${this.locale === "zh-TW" ? "先在預設瀏覽器開啟此邀請。" : "Open this invitation in the default browser."}</li><li>${this.locale === "zh-TW" ? "iPhone：分享 → 加入主畫面，然後從主畫面開啟 LogTogether。Android／電腦：可使用下方安裝按鈕或瀏覽器選單。" : "iPhone: Share → Add to Home Screen, then open LogTogether from the Home Screen. Android/desktop: use Install below or the browser menu."}</li><li>${this.locale === "zh-TW" ? "在安裝版 LogTogether 用受邀的 Google 電子郵件登入。iPhone 的主畫面 App 與 Safari 使用不同儲存空間，因此需要在安裝版再登入一次；LogTogether 會用已驗證的受邀信箱安全找回尚未接受的邀請。" : "Sign in inside the installed LogTogether app with the invited Google email. On iPhone, the Home Screen app has separate storage from Safari, so you sign in once more there; LogTogether then securely recovers the pending invitation using the verified invited email."}</li></ol>${this.installPrompt ? `<button class="btn small" type="button" data-action="install-app">${this.locale === "zh-TW" ? "安裝 App" : "Install app"}</button>` : ""}</div>${this.cloudMembershipError ? `<div class="small danger-text">${escapeHtml(this.cloudMembershipError)}</div>` : ""}</div>`
        : `<div class="card compact reconnect-cloud-card"><div><div class="strong">${this.locale === "zh-TW" ? "目前：Local" : "Current mode: Local"}</div><div class="small muted">${this.locale === "zh-TW" ? "新成員請使用邀請連結；如果這個 Google 帳號已經有 LogTogether Cloud 權限，可以直接重新連線。" : "New members should use an invitation link. If this Google account already has LogTogether Cloud access, reconnect it directly."}</div></div>${this.googleSignInButton("Connect existing Cloud account", "連線既有 Cloud 帳號")}</div>`;
      return `<section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "Cloud 與群組" : "Cloud & groups"}</h2></div><div class="family-access-stack">${localIntro}${invite}</div></section>`;
    }

    const membership = this.cloudMembership;
    const familyName = membership.family?.name || membership.access.familyId;
    const ownGroups = membership.access.groupIds ?? [membership.access.groupId];
    const ownGroup = this.groupNames(ownGroups);
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
      return `<section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "Cloud 與群組" : "Cloud & groups"}</h2></div><div class="family-access-stack">${summary}<div class="card compact"><div class="strong">${this.locale === "zh-TW" ? "你的群組" : "Your groups"}: ${escapeHtml(ownGroup)}</div><div class="small muted">${this.locale === "zh-TW" ? "你會看到與你至少共用一個群組的成員，以及擁有者分享給其中任一群組的資料。群組指派與 Cloud 權限由擁有者管理。" : "You can see members who share at least one group with you, plus owner data shared with any of those groups. Group assignment and Cloud access are controlled by the owner."}</div></div><div class="card member-access-card read-only-group-members"><div class="strong">${this.locale === "zh-TW" ? "可見群組成員" : "Visible group members"}</div><div class="member-access-list">${groupMemberRows}</div></div></div></section>`;
    }

    const groupOptions = (selected: string) => membership.groups.map(group => `<option value="${escapeHtml(group.id)}" ${group.id === selected ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("");
    const groupRows = membership.groups.map(group => {
      const assigned = membership.members.filter(member => member.role === "member" && member.groupIds.includes(group.id) && member.status === "active").length;
      return `<form class="family-group-row" data-group-rename-form="${escapeHtml(group.id)}"><div class="group-name-editor"><input class="input compact-input" data-group-name-input name="groupName" value="${escapeHtml(group.name)}" maxlength="80" required aria-label="${this.locale === "zh-TW" ? "群組名稱" : "Group name"}"><span class="tiny muted">${assigned} ${this.locale === "zh-TW" ? "位啟用成員" : assigned === 1 ? "active member" : "active members"}</span></div>${group.id !== DEFAULT_GROUP_ID ? `<div class="group-row-actions"><button class="btn small ghost danger" type="button" data-delete-group="${escapeHtml(group.id)}">${this.locale === "zh-TW" ? "刪除" : "Delete"}</button></div>` : ""}</form>`;
    }).join("");
    const ownerSharing = `<form id="owner-sharing-form" class="owner-sharing-inline"><div class="strong">${this.locale === "zh-TW" ? "我的資料分享給哪些群組" : "Groups that can see my owner profile"}</div><div class="small muted member-access-note">${this.locale === "zh-TW" ? "只有勾選的群組能看到你的家庭個人資料與共用進度；身高與體重仍是私人資料。" : "Only selected groups can see your family profile and shared progress; height and weight remain private."}</div><div class="owner-share-groups">${membership.groups.map(group => `<label class="check-row"><input type="checkbox" name="shareGroup" value="${escapeHtml(group.id)}" ${membership.access.shareGroupIds.includes(group.id) ? "checked" : ""}><span>${escapeHtml(group.name)}</span></label>`).join("")}</div><button class="btn small" type="submit">${this.locale === "zh-TW" ? "儲存分享範圍" : "Save visibility"}</button></form>`;
    const groups = `<details class="card settings-fold cloud-groups-fold"><summary><div><strong>${this.locale === "zh-TW" ? "群組" : "Groups"}</strong><span>${membership.groups.length} ${this.locale === "zh-TW" ? "個群組 · 點一下管理" : membership.groups.length === 1 ? "group · tap to manage" : "groups · tap to manage"}</span></div><span class="history-chevron">${icon("chevron")}</span></summary><div class="settings-fold-body"><div class="small muted member-access-note">${this.locale === "zh-TW" ? "一般成員只能看到同群組 Cloud 成員。直接編輯名稱後離開欄位即可儲存。" : "Regular members can discover only Cloud members who overlap at least one of their groups. Edit a name directly and leave the field to save it."}</div><div class="member-access-list group-access-list">${groupRows}</div><form id="create-group-form" class="cloud-family-form"><label>${this.locale === "zh-TW" ? "新增群組" : "New group"}<input class="input" name="groupName" maxlength="80" required placeholder="${this.locale === "zh-TW" ? "例如：朋友" : "e.g. Friends"}"></label><button class="btn" type="submit">${this.locale === "zh-TW" ? "建立群組" : "Create group"}</button></form><div class="settings-inline-divider"></div>${ownerSharing}</div></details>`;

    const memberRows = membership.members.map(member => {
      const name = member.displayName || (member.uid === this.authUser?.uid ? (this.state.user.displayName || this.authUser.displayName || "You") : "Cloud member");
      const isSelf = member.uid === this.authUser?.uid;
      const status = member.status === "active" ? (this.locale === "zh-TW" ? "啟用" : "Active") : (this.locale === "zh-TW" ? "已撤銷" : "Revoked");
      const groupLabel = isSelf ? (this.locale === "zh-TW" ? "擁有者" : "Owner") : this.groupNames(member.groupIds);
      const initials = name.split(/\s+/).map(part => part[0] ?? "").join("").slice(0,2).toUpperCase();
      const localPhoto = isSelf ? this.state.profile?.photoId : undefined;
      const avatar = localPhoto
        ? this.privateImage(localPhoto,"member-access-avatar photo",name)
        : member.photoURL
          ? `<img class="member-access-avatar photo" src="${escapeHtml(member.photoURL)}" referrerpolicy="no-referrer" alt="${escapeHtml(name)}">`
          : `<div class="member-access-avatar">${escapeHtml(initials)}</div>`;
      const identity = `<div class="member-access-identity">${avatar}<div><div class="strong">${escapeHtml(name)}${isSelf ? ` ${this.locale === "zh-TW" ? "（你）" : "(you)"}` : ""}</div><div class="small muted">${escapeHtml(groupLabel)}${isSelf ? "" : ` · ${escapeHtml(status)}`}</div></div></div>`;
      if (isSelf || !this.familyAccessEditing) return `<div class="family-access-member ${member.status === "revoked" ? "revoked" : ""}">${identity}</div>`;
      const memberGroups = member.groupIds.map(groupId => `<span class="member-group-chip">${escapeHtml(this.groupName(groupId))}<button type="button" data-member-remove-group="${escapeHtml(member.uid)}" data-group-id="${escapeHtml(groupId)}" ${member.groupIds.length <= 1 || this.cloudActionBusy ? "disabled" : ""} aria-label="${this.locale === "zh-TW" ? "移除此群組" : "Remove from group"}">×</button></span>`).join("");
      const addableGroups = membership.groups.filter(group => !member.groupIds.includes(group.id));
      const addGroup = addableGroups.length ? `<label class="member-add-group"><span class="tiny muted">${this.locale === "zh-TW" ? "加入群組" : "Add to group"}</span><select class="select compact-select" data-member-add-group="${escapeHtml(member.uid)}" ${this.cloudActionBusy ? "disabled" : ""}><option value="">${this.locale === "zh-TW" ? "選擇群組…" : "Choose group…"}</option>${addableGroups.map(group => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)}</option>`).join("")}</select></label>` : "";
      return `<div class="family-access-member ${member.status === "revoked" ? "revoked" : ""}">${identity}<div class="member-admin-actions"><div class="member-group-editor"><div class="member-group-chips">${memberGroups}</div>${addGroup}</div>${member.status === "active" ? `<button class="btn small ghost danger" data-member-status="revoked" data-member-uid="${escapeHtml(member.uid)}" data-member-name="${escapeHtml(name)}" ${this.cloudActionBusy ? "disabled" : ""}>${this.locale === "zh-TW" ? "撤銷 Cloud" : "Revoke Cloud"}</button>` : `<button class="btn small" data-member-status="active" data-member-uid="${escapeHtml(member.uid)}" data-member-name="${escapeHtml(name)}" ${this.cloudActionBusy ? "disabled" : ""}>${this.locale === "zh-TW" ? "恢復 Cloud" : "Restore Cloud"}</button>`}</div></div>`;
    }).join("");
    const memberAccessCard = `<div class="card member-access-card"><div class="member-access-heading"><div><div class="strong">${this.locale === "zh-TW" ? "Cloud 成員與權限" : "Cloud members & access"}</div><div class="small muted">${this.familyAccessEditing ? (this.locale === "zh-TW" ? "編輯模式：可變更群組或 Cloud 權限" : "Edit mode: add/remove group memberships or change Cloud access") : (this.locale === "zh-TW" ? "一般檢視只顯示成員、群組與狀態" : "Clean view shows member, group and status")}</div></div><button class="btn small ${this.familyAccessEditing ? "primary" : ""}" data-action="toggle-member-access-edit">${this.familyAccessEditing ? (this.locale === "zh-TW" ? "完成" : "Done") : (this.locale === "zh-TW" ? "編輯" : "Edit")}</button></div><div class="member-access-list">${memberRows}</div></div>`;

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
          ? "Cloud 會在你的裝置間同步運動、健行資料、飲水、補充品、偏好、生理性別、身高與體重。群組成員只能看到授權群組中的共用進度與你自行開啟的家庭個人頁內容；生理性別、本週補充品、最近運動與最近健行都可個別關閉。身高、體重、逐筆飲水／補充品時間、GPX 精確路線與照片不會分享。"
          : "Cloud syncs workouts, hike metadata, water, supplements, preferences, biological sex, height and weight across your devices. Group members see authorized shared progress plus only the family-profile sections you enable. This week's supplements include each shared entry's date, time and amount. Height, weight, individual drink times, precise GPX traces and photos are not shared.")
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
    return `<section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "Firebase 容量" : "Firebase capacity"}</h2><span class="section-value">${percentLabel}</span></div><div class="card firebase-capacity-card"><div class="capacity-grid"><div><span>${this.locale === "zh-TW" ? "這個帳號的同步資料估算" : "Estimated synced payload for this account"}</span><strong>${formatBytes(estimated)}</strong></div><div><span>${this.locale === "zh-TW" ? "Firestore 免費儲存額度" : "Firestore no-cost stored-data quota"}</span><strong>1 GiB</strong></div><div><span>${this.locale === "zh-TW" ? "粗略剩餘空間" : "Rough remaining headroom"}</span><strong>${formatBytes(remaining)}</strong></div><div><span>${this.locale === "zh-TW" ? "Hosting 免費儲存額度" : "Hosting no-cost storage"}</span><strong>10 GB</strong></div></div><p class="tiny muted">${this.locale === "zh-TW" ? "這只是 LogTogether 在本機可看見資料的粗略下限估算，不包含 Firestore 索引、中繼資料、其他家庭帳號、舊文件或 Hosting 舊版本。Firebase 主控台的 Usage 才是實際數字。" : "This is only a rough lower-bound estimate from LogTogether data visible to this account. Firestore indexes/metadata, other family accounts, old documents and retained Hosting releases are not included. Firebase Console Usage is authoritative."}</p><div class="capacity-actions"><a class="btn small" href="https://console.firebase.google.com/project/${encodeURIComponent(window.__LOGTOGETHER_CONFIG__?.firebase?.projectId ?? window.__FAMILY_EXERCISE_CONFIG__?.firebase?.projectId ?? "")}/firestore" target="_blank" rel="noreferrer">${this.locale === "zh-TW" ? "開啟 Firestore" : "Open Firestore"}</a><a class="btn small" href="https://console.firebase.google.com/project/${encodeURIComponent(window.__LOGTOGETHER_CONFIG__?.firebase?.projectId ?? window.__FAMILY_EXERCISE_CONFIG__?.firebase?.projectId ?? "")}/hosting" target="_blank" rel="noreferrer">${this.locale === "zh-TW" ? "開啟 Hosting" : "Open Hosting"}</a></div></div></section>`;
  }


  private renderDeveloperEffectTests(): string {
    if(!DEVELOPER_EFFECT_TESTS_V0117 || !this.isDeveloperOwner()) return "";
    const zh=this.locale === "zh-TW";
    const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const calendarPreview=this.developerCalendarPreview === "gold"
      ? `<div class="developer-calendar-preview"><div class="tiny muted">${zh?"Gold Day 月曆樣式預覽（不改資料）":"Gold Day calendar style preview (no data changes)"}</div><div class="card calendar-card badge-month developer-mini-calendar"><div class="weekday-row">${["M","T","W","T","F","S","S"].map(day=>`<span>${day}</span>`).join("")}</div><div class="calendar-grid">${[10,11,12,13,14,15,16].map(day=>`<div class="calendar-cell history-day ${day===13?"gold-day selected":"has-activity"}"><span class="calendar-day-number">${day}</span>${day===12?'<i class="history-activity-dot"></i>':""}</div>`).join("")}</div></div></div>`
      : this.developerCalendarPreview === "water"
        ? `<div class="developer-calendar-preview"><div class="tiny muted">${zh?"飲水月曆樣式預覽（不改資料）":"Water calendar style preview (no data changes)"}</div><div class="card calendar-card water-calendar perfect-water-month developer-mini-calendar"><div class="weekday-row">${["M","T","W","T","F","S","S"].map(day=>`<span>${day}</span>`).join("")}</div><div class="calendar-grid">${[10,11,12,13,14,15,16].map(day=>`<div class="calendar-cell water-day ${day>=12&&day<=15?"water-hit":""} ${day===13?"selected":""}"><span>${day}</span></div>`).join("")}</div></div></div>`
        : "";
    return `<details class="developer-effect-tests"><summary><div><strong>${zh?"開發者 · 視覺／事件測試（暫時）":"Developer · visual/event tests (temporary)"}</strong><span>${zh?"只有 Cloud 擁有者可見 · 不修改真實進度":"Owner only · does not change real progress"}</span></div><span class="history-chevron">${icon("chevron")}</span></summary><div class="settings-fold-body"><p class="tiny muted">${zh?"這些按鈕只在本機模擬動畫與前景事件，不花 Poke、不寫入 Gold Day／飲水／徽章紀錄，也不會傳給家人。之後可整段移除。":"These buttons simulate local animations and foreground events only. They spend no Pokes, write no Gold Day/water/badge data, and send nothing to family members. The whole harness is designed to be removed later."}</p>${reduced?`<div class="status-note warning">${zh?"此裝置已開啟 Reduce Motion；Poke 雨會刻意停用，只顯示訊息。":"Reduce Motion is enabled on this device; Poke rain is intentionally suppressed and only the message appears."}</div>`:""}<div class="developer-effect-grid"><button class="btn small" data-dev-effect="poke-one">👋 ${zh?"Poke 動畫":"Poke animation"}</button><button class="btn small" data-dev-effect="poke-five">💪 ${zh?"排入 5 個 Poke":"Queue 5 Pokes"}</button><button class="btn small" data-dev-effect="mixed-queue">🧪 ${zh?"混合事件佇列":"Mixed event queue"}</button><button class="btn small" data-dev-effect="large-family-burst">👨‍👩‍👧‍👦 ${zh?"15 人家庭壓力測試":"15-person family burst"}</button><button class="btn small" data-dev-effect="social-gold">⭐ ${zh?"家人 Gold Day 彈窗":"Family Gold Day popup"}</button><button class="btn small" data-dev-effect="social-badge">🏅 ${zh?"家人徽章彈窗":"Family badge popup"}</button><button class="btn small" data-dev-effect="local-gold">✨ ${zh?"自己的 Gold Day 動畫":"Own Gold Day animation"}</button><button class="btn small" data-dev-effect="local-water">💧 ${zh?"飲水達標動畫":"Water goal animation"}</button><button class="btn small" data-dev-effect="local-badge">🏅 ${zh?"月度徽章動畫":"Monthly badge animation"}</button><button class="btn small" data-dev-calendar-preview="gold">📅 ${zh?"Gold 月曆樣式":"Gold calendar style"}</button><button class="btn small" data-dev-calendar-preview="water">💧 ${zh?"飲水月曆樣式":"Water calendar style"}</button></div>${calendarPreview}</div></details>`;
  }

  private renderDeveloperCloudDiagnostics(): string {
    if (!this.isDeveloperOwner()) return "";
    const d=this.backendDiagnostics;
    const metrics=d ? `<div class="developer-usage-grid"><div><span>${this.locale === "zh-TW" ? "月份" : "Month"}</span><strong>${escapeHtml(d.month || "—")}</strong></div><div><span>${this.locale === "zh-TW" ? "活躍成員" : "Active members"}</span><strong>${d.activeMembers}</strong></div><div><span>${this.locale === "zh-TW" ? "Push 訂閱" : "Push subscriptions"}</span><strong>${d.pushSubscriptions}</strong></div><div><span>Poke calls</span><strong>${d.pokeCalls}</strong></div><div><span>${this.locale === "zh-TW" ? "Poke 已送達" : "Pokes delivered"}</span><strong>${d.pokesDelivered}</strong></div><div><span>${this.locale === "zh-TW" ? "Poke 被攔截" : "Pokes blocked"}</span><strong>${d.pokesBlocked}</strong></div><div><span>Gold events</span><strong>${d.goldEvents}</strong></div><div><span>Badge events</span><strong>${d.badgeEvents}</strong></div><div><span>${this.locale === "zh-TW" ? "測試通知" : "Test notifications"}</span><strong>${d.testNotifications}</strong></div><div><span>Push deliveries</span><strong>${d.pushDeliveries}</strong></div><div><span>Push failures</span><strong>${d.pushFailures}</strong></div></div>` : `<div class="small muted">${this.locale === "zh-TW" ? "按重新整理以讀取本月由 LogTogether 記錄的後端事件計數。" : "Refresh to load this month's LogTogether backend event counters."}</div>`;
    return `<details class="card developer-cloud-usage"><summary><div><strong>${this.locale === "zh-TW" ? "開發者 · Cloud 用量" : "Developer · Cloud usage"}</strong><span>${this.locale === "zh-TW" ? "只有家庭擁有者看得到 · 非官方帳單" : "Owner only · not the official bill"}</span></div><span class="history-chevron">${icon("chevron")}</span></summary><div class="settings-fold-body">${metrics}<p class="tiny muted">${this.locale === "zh-TW" ? "這些是 LogTogether 自己的事件計數，可協助發現異常呼叫量；它們不等於 Firebase / Google Cloud 的 TWD 費用，也不包含所有底層服務。官方金額仍以 Billing 主控台為準。" : "These are LogTogether's own event counters for spotting unusual backend activity. They are not Firebase/Google Cloud TWD charges and do not cover every underlying service. Billing Console remains authoritative."}</p><div class="developer-usage-actions"><button class="btn small" data-action="refresh-backend-diagnostics" ${this.backendDiagnosticsBusy ? "disabled" : ""}>${this.backendDiagnosticsBusy ? (this.locale === "zh-TW" ? "讀取中…" : "Loading…") : (this.locale === "zh-TW" ? "重新整理" : "Refresh")}</button><button class="btn small" data-action="send-test-notification" ${this.backendDiagnosticsBusy || !this.pushStatus?.subscribed ? "disabled" : ""}>${this.locale === "zh-TW" ? "傳送測試通知" : "Send test notification"}</button><a class="btn small" href="https://console.cloud.google.com/billing?project=${encodeURIComponent(window.__LOGTOGETHER_CONFIG__?.firebase?.projectId ?? window.__FAMILY_EXERCISE_CONFIG__?.firebase?.projectId ?? "")}" target="_blank" rel="noreferrer">${this.locale === "zh-TW" ? "官方 Billing" : "Official billing"}</a></div></div></details>`;
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


  private feedbackFormUrl(): string | null {
    const raw=(window.__LOGTOGETHER_CONFIG__?.feedbackFormUrl ?? window.__FAMILY_EXERCISE_CONFIG__?.feedbackFormUrl ?? "").trim();
    if(!raw) return null;
    try {
      const url=new URL(raw);
      const allowed=url.protocol==="https:" && (url.hostname==="forms.gle" || (url.hostname==="docs.google.com" && url.pathname.startsWith("/forms/")));
      return allowed ? url.toString() : null;
    } catch { return null; }
  }

  private anonymousFeedbackInfo(): string {
    const standalone=window.matchMedia?.("(display-mode: standalone)")?.matches ? "PWA" : "browser";
    const cloud=this.authUser && this.cloudMembership?.access.status === "active" ? "Cloud" : "Local";
    const platform=/iPhone|iPad|iPod/i.test(navigator.userAgent) ? "iOS" : /Android/i.test(navigator.userAgent) ? "Android" : /Windows/i.test(navigator.userAgent) ? "Windows" : /Mac/i.test(navigator.userAgent) ? "macOS" : /Linux/i.test(navigator.userAgent) ? "Linux" : "Other";
    return `LogTogether v${APP_VERSION} · ${platform} ${standalone} · ${cloud}`;
  }

  private renderFeedbackSettings(): string {
    const zh=this.locale === "zh-TW";
    const url=this.feedbackFormUrl();
    return `<section class="section"><div class="section-header"><h2 class="section-title">${zh?"協助測試":"Help improve LogTogether"}</h2></div><div class="card feedback-card"><div class="feedback-card-copy"><div class="feedback-emoji" aria-hidden="true">🐛 💡 🧪</div><strong>${zh?"發現 Bug 或有想法？":"Found a bug or have an idea?"}</strong><p class="small muted">${zh?"外部回饋表單不需要新增 Firebase 後端。請避免貼上私人運動內容、帳號 ID、GPS 路線或其他敏感資料。":"The external feedback form uses no extra Firebase backend. Avoid pasting private workout contents, account IDs, GPS routes or other sensitive data."}</p></div><div class="feedback-actions">${url?`<a class="btn primary" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${zh?"🐛 回報 Bug／分享想法":"🐛 Report bug / share idea"}</a>`:`<button class="btn" type="button" disabled>${zh?"回饋表單尚未設定":"Feedback form not configured yet"}</button>`}<button class="btn ghost" type="button" data-action="copy-feedback-info">${zh?"複製版本與裝置資訊":"Copy version & device info"}</button></div><div class="tiny muted">${escapeHtml(this.anonymousFeedbackInfo())}${!url && this.isDeveloperOwner()?` · ${zh?"擁有者：在 config.local.js 的 feedbackFormUrl 加入 Google Forms 連結後即可啟用。":"Owner: add a Google Forms URL to feedbackFormUrl in config.local.js to enable submissions."}`:""}</div></div></section>`;
  }

  private renderSettings(): string {
    const textScale = clamp(Math.round((this.state.textScale ?? 100) / 10) * 10, 100, 140);
    const waterGoal = this.state.hydration.targetMl;
    const specialGoal = waterGoal !== 2000;
    const interfaceSection = `<section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "介面" : "Interface"}</h2></div><div class="card"><div class="setting-row row"><div><div class="strong">${escapeHtml(this.text("language"))}</div></div><div class="segmented"><button data-locale="en" class="${this.locale === "en" ? "active" : ""}">EN</button><button data-locale="zh-TW" class="${this.locale === "zh-TW" ? "active" : ""}">繁中</button></div></div><div class="setting-row row"><div><div class="strong">${escapeHtml(this.text("appearance"))}</div></div><div class="segmented"><button data-theme="dark" class="${this.state.theme === "dark" ? "active" : ""}">${escapeHtml(this.text("dark"))}</button><button data-theme="light" class="${this.state.theme === "light" ? "active" : ""}">${escapeHtml(this.text("light"))}</button></div></div><div class="setting-row row text-scale-setting"><div><div class="strong">${this.locale === "zh-TW" ? "文字大小" : "Text size"}</div><div class="small muted">${this.locale === "zh-TW" ? "只調整文字大小；卡片與控制項會自動換行。" : "Scales text only; cards and controls reflow automatically."}</div></div><select class="select text-scale-select" id="text-scale-select" aria-label="${this.locale === "zh-TW" ? "文字大小百分比" : "Text size percentage"}">${[100,110,120,130,140].map(value=>`<option value="${value}" ${textScale===value ? "selected" : ""}>${value}%</option>`).join("")}</select></div><div class="setting-row palette-setting"><div><div class="strong">${this.locale === "zh-TW" ? "主題色" : "Accent color"}</div><div class="small muted">${this.locale === "zh-TW" ? "只改介面強調色，不影響資料。" : "Changes UI accents only; it never changes your records."}</div></div><div class="palette-controls">${ACCENT_PRESETS.map(preset=>`<button class="palette-swatch ${normalizeHex(this.state.accentColor)===preset.color ? "active" : ""}" data-accent-color="${preset.color}" title="${preset.label}" data-style-background="${preset.color}" aria-label="${preset.label}"></button>`).join("")}<label class="custom-color" title="${this.locale === "zh-TW" ? "自訂顏色" : "Custom color"}"><input id="custom-accent-input" type="color" value="${normalizeHex(this.state.accentColor)}"><span>${this.locale === "zh-TW" ? "自訂" : "Custom"}</span></label></div></div></div></section>`;
    const workoutPrefs = this.state.workoutPreferences ?? { restTimerSound:true, keepScreenAwake:true };
    const workoutExperienceSection = `<section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "運動體驗" : "Workout experience"}</h2></div><div class="card">
      <div class="setting-row row"><div><div class="strong">${this.locale === "zh-TW" ? "運動計時提示音" : "Workout timer sounds"}</div><div class="small muted">${this.locale === "zh-TW" ? "開始／完成一聲；工作或休息目標時間到時兩聲。" : "One beep on Start/Finish; two beeps when a work or rest target expires."}</div></div><div class="segmented"><button data-workout-pref="restTimerSound" data-pref-value="on" class="${workoutPrefs.restTimerSound ? "active" : ""}">${this.locale === "zh-TW" ? "開" : "On"}</button><button data-workout-pref="restTimerSound" data-pref-value="off" class="${!workoutPrefs.restTimerSound ? "active" : ""}">${this.locale === "zh-TW" ? "關" : "Off"}</button></div></div>
      <div class="setting-row row timer-alert-test-row"><div><div class="strong">${this.locale === "zh-TW" ? "測試計時提示" : "Test timer alert"}</div><div class="small muted">${this.locale === "zh-TW" ? "立即播放兩聲到時提示，方便確認這台裝置是否能與音樂／影片一起出聲。iPhone 的提示音會跟隨響鈴／靜音開關；靜音模式可能讓提示音無聲。" : "Play the two-beep deadline cue so you can verify it mixes correctly with music/video on this device. On iPhone, timer sounds follow the Ring/Silent switch; Silent Mode may suppress them."}</div></div><button class="btn small" data-action="test-timer-alert">${this.locale === "zh-TW" ? "測試" : "Test"}</button></div>
      <div class="setting-row row"><div><div class="strong">${this.locale === "zh-TW" ? "運動時保持螢幕亮起" : "Keep screen awake during workouts"}</div><div class="small muted">${this.locale === "zh-TW" ? "進行中的運動與休息計時會嘗試避免螢幕自動鎖定；裝置不支援時會自動略過。" : "Active workouts and rest timers try to prevent automatic screen lock; unsupported devices simply ignore it."}</div></div><div class="segmented"><button data-workout-pref="keepScreenAwake" data-pref-value="on" class="${workoutPrefs.keepScreenAwake ? "active" : ""}">${this.locale === "zh-TW" ? "開" : "On"}</button><button data-workout-pref="keepScreenAwake" data-pref-value="off" class="${!workoutPrefs.keepScreenAwake ? "active" : ""}">${this.locale === "zh-TW" ? "關" : "Off"}</button></div></div>
      <div class="setting-row"><div><div class="strong">${this.locale === "zh-TW" ? "iPhone 搖動取消輸入" : "iPhone Shake to Undo"}</div><div class="small muted">${this.locale === "zh-TW" ? "開始或完成一組時，LogTogether 會收起輸入焦點並阻止取消輸入改動運動欄位。iOS 的系統彈窗只能在「設定 → 輔助使用 → 觸控 → 搖動取消」完全關閉。" : "When a set starts or finishes, LogTogether releases input focus and blocks undo from changing workout fields. Only iOS Settings → Accessibility → Touch → Shake to Undo can fully disable the system popup."}</div></div></div>
    </div></section>`;
    const notificationPrefs = this.state.notificationPreferences ?? { goldDays:true, badges:true, pokes:true };
    const cloudReady = Boolean(this.authUser && this.cloudMembership?.access.status === "active");
    const notificationStatus = !cloudReady ? "" : !this.pushStatus ? (this.locale === "zh-TW" ? "檢查中…" : "Checking…") : !this.pushStatus.supported ? (this.locale === "zh-TW" ? "此瀏覽器不支援" : "Not supported in this browser") : !this.pushStatus.configured ? (this.locale === "zh-TW" ? "此版本尚未設定 Push" : "Push is not configured on this deployment") : this.pushStatus.subscribed ? (this.locale === "zh-TW" ? "此裝置已啟用" : "Enabled on this device") : this.pushStatus.permission === "denied" ? (this.locale === "zh-TW" ? "瀏覽器已封鎖通知" : "Notifications are blocked by the browser") : (this.locale === "zh-TW" ? "此裝置尚未啟用" : "Not enabled on this device");
    const developerOwner = this.isDeveloperOwner();
    const pokeBalanceText = developerOwner ? "∞" : `${this.pokeBalance}/7`;
    const mutedPokeGroups = this.state.notificationPreferences?.mutedPokeGroupIds ?? [];
    const visiblePokeGroups = (this.cloudMembership?.groups ?? []).filter(group => this.cloudMembership?.access.role === "owner" ? (this.cloudMembership.access.shareGroupIds ?? [this.cloudMembership.access.groupId]).includes(group.id) : (this.cloudMembership?.access.groupIds ?? [this.cloudMembership?.access.groupId ?? DEFAULT_GROUP_ID]).includes(group.id));
    const pokeGroupMuteControls = visiblePokeGroups.length ? `<div class="poke-group-mutes"><div class="small strong">${this.locale === "zh-TW" ? "群組 Poke 靜音" : "Mute Pokes by group"}</div>${visiblePokeGroups.map(group=>`<label><input type="checkbox" data-poke-mute-group="${escapeHtml(group.id)}" ${mutedPokeGroups.includes(group.id) ? "checked" : ""}><span>${this.locale === "zh-TW" ? "靜音來自" : "Mute from"} <b>${escapeHtml(group.name)}</b></span></label>`).join("")}<div class="tiny muted">${this.locale === "zh-TW" ? "伺服器會在扣除 Poke 前檢查靜音與防洪規則。" : "The server checks mute and flood rules before a Poke is spent."}</div></div>` : "";
    const notificationReminderReset = this.familyNotificationPromptSuppressed() ? `<div class="notification-reminder-reset"><button class="btn small ghost" data-action="reset-family-notification-prompt">${this.locale === "zh-TW" ? "再次顯示家庭通知提醒" : "Show Family notification reminder again"}</button></div>` : "";
    const notificationSection = cloudReady ? `<section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "家庭通知與 Poke" : "Family notifications & Pokes"}</h2><span class="section-value">${escapeHtml(notificationStatus)}</span></div><div class="card notification-settings"><div class="notification-enable-row"><div><strong>${this.locale === "zh-TW" ? "系統通知" : "System notifications"}</strong><span>${this.locale === "zh-TW" ? "Gold Day、徽章與 Poke 預設開啟。第一次仍需要你允許瀏覽器／主畫面 App 的系統通知權限。" : "Gold Day, badge and Poke alerts default on. The browser/Home Screen app still needs your permission once on each device."}</span></div>${this.pushStatus?.subscribed ? `<button class="btn small" data-action="disable-push" ${this.pushBusy ? "disabled" : ""}>${this.locale === "zh-TW" ? "停用此裝置" : "Disable on this device"}</button>` : `<button class="btn small primary" data-action="enable-push" ${this.pushBusy || this.pushStatus?.configured === false ? "disabled" : ""}>${this.locale === "zh-TW" ? "啟用通知" : "Enable notifications"}</button>`}</div><div class="notification-pref-grid"><label><input type="checkbox" data-notification-pref="goldDays" ${notificationPrefs.goldDays ? "checked" : ""}><span><b>${this.locale === "zh-TW" ? "金色日" : "Gold Days"}</b><small>${this.locale === "zh-TW" ? "同群組成員當天第一次達成 Gold Day 時；同一天最多通知一次。" : "When a group member first earns a Gold Day that day; at most one alert per person per day."}</small></span></label><label><input type="checkbox" data-notification-pref="badges" ${notificationPrefs.badges ? "checked" : ""}><span><b>${this.locale === "zh-TW" ? "徽章" : "Badges"}</b><small>${this.locale === "zh-TW" ? "有人獲得新的月度或健行徽章時。" : "When a group member earns a new monthly or hiking badge."}</small></span></label><label><input type="checkbox" data-notification-pref="pokes" ${notificationPrefs.pokes ? "checked" : ""}><span><b>Pokes</b><small>${this.locale === "zh-TW" ? "允許可見群組成員傳送短 emoji 鼓勵；可另外靜音個人或群組。" : "Allow visible group members to send short emoji encouragement; people and groups can be muted separately."}</small></span></label></div>${pokeGroupMuteControls}${notificationReminderReset}<div class="tiny muted">${developerOwner ? (this.locale === "zh-TW" ? "開發者測試 Pokes：∞（暫時功能）。一般成員每個新 Gold Day +1，最多保留 7 個。" : "Developer test Pokes: ∞ (temporary). Normal members earn +1 per new Gold Day and can store up to 7.") : (this.locale === "zh-TW" ? `今天的新 Gold Day +1 Poke，最多 7 個。修正紀錄會收回獎勵；已花掉的會由後續獎勵抵銷。目前：${pokeBalanceText}。` : `Each new Gold Day today earns +1 Poke, up to 7 stored. Corrections revoke its token; if spent, future earnings settle it. Current balance: ${pokeBalanceText}.`)}</div></div></section>` : "";
    const securitySection = `<section class="section"><div class="section-header"><h2 class="section-title">${this.locale === "zh-TW" ? "安全性" : "Security"}</h2></div><div class="card security-list">${this.authCard()}<div><strong>${this.locale === "zh-TW" ? "本機資料" : "Local data"}</strong><span>${this.locale === "zh-TW" ? "IndexedDB + 寫入日誌 + 匯出備份" : "IndexedDB + write journal + export backup"}</span></div><div><strong>${this.locale === "zh-TW" ? "Cloud 資料" : "Cloud data"}</strong><span>${this.locale === "zh-TW" ? "第一次取得 Cloud 權限需要邀請；已授權帳號之後可在新裝置重新登入。Cloud 仍由 Firebase Auth、App Check 與 Firestore 規則保護。" : "First-time Cloud access requires an invitation; authorized accounts can reconnect on new devices afterward. Cloud remains protected by Firebase Auth, App Check and Firestore Security Rules."}</span></div></div></section>`;
    const specialNeeds = `<section class="section"><details class="card settings-fold" ${specialGoal ? "open" : ""}><summary><div><strong>${this.locale === "zh-TW" ? "特殊需求？" : "Special needs?"}</strong><span>${this.locale === "zh-TW" ? "一般每日飲水目標固定為 2,000 mL" : "The standard daily water goal is fixed at 2,000 mL"}</span></div><span class="history-chevron">${icon("chevron")}</span></summary><div class="settings-fold-body"><p class="small muted">${this.locale === "zh-TW" ? "大多數使用者不需要調整。若你有自己的專業建議或特殊目標，可在這裡覆寫。未來其他特殊需求設定也會放在這裡。" : "Most people do not need to change this. If you have your own professional guidance or a special target, you can override it here. Future special-needs options can live here too."}</p><form id="water-goal-form" class="special-water-goal"><label class="field"><span>${this.locale === "zh-TW" ? "每日飲水目標" : "Daily water goal"}</span><input class="input" name="waterGoal" type="number" min="500" max="6000" step="100" value="${waterGoal}"><small>${specialGoal ? (this.locale === "zh-TW" ? `目前使用特殊目標 ${waterGoal.toLocaleString()} mL。改回 2,000 即恢復標準值。` : `Currently using a special ${waterGoal.toLocaleString()} mL target. Set it back to 2,000 to restore the standard.`) : (this.locale === "zh-TW" ? "標準：2,000 mL" : "Standard: 2,000 mL")}</small></label><button class="btn small" type="submit">${escapeHtml(this.text("saveChanges"))}</button></form></div></details></section>`;
    const developerEffectsSection = this.isDeveloperOwner() && DEVELOPER_EFFECT_TESTS_V0117 ? `<section class="section">${this.renderDeveloperEffectTests()}</section>` : "";
    const dataTools = `<section class="section"><details class="card settings-fold"><summary><div><strong>${this.locale === "zh-TW" ? "資料、備份與診斷" : "Data, backup & diagnostics"}</strong><span>${this.locale === "zh-TW" ? "較少使用的維護工具" : "Less-frequent maintenance tools"}</span></div><span class="history-chevron">${icon("chevron")}</span></summary><div class="settings-fold-body settings-nested">${this.renderLocalBackupSettings()}${this.renderFirebaseCapacitySettings()}${this.renderDeveloperCloudDiagnostics()}<div class="card compact diagnostic-inline"><div><strong>${this.locale === "zh-TW" ? "隱私安全的診斷檔" : "Privacy-safe diagnostics"}</strong><div class="small muted">${this.locale === "zh-TW" ? "只匯出版本、同步狀態與紀錄數量，不包含運動內容或帳號 ID。" : "Exports version, sync state and record counts without workout contents or account IDs."}</div></div><button class="btn small" data-action="export-diagnostics">${this.locale === "zh-TW" ? "匯出" : "Export"}</button></div><div class="card compact"><div class="row"><div><strong>${cloudModeEnabled() ? (this.locale === "zh-TW" ? "清除本機測試資料" : "Clear local test data") : (this.locale === "zh-TW" ? "重設本機示範資料" : "Reset local demo data")}</strong><div class="small muted">${cloudModeEnabled() ? (this.locale === "zh-TW" ? "只清除此瀏覽器中的本機紀錄；Cloud 權限不會被刪除。" : "Clears local records in this browser only; Cloud authorization is not deleted.") : (this.locale === "zh-TW" ? "將這個瀏覽器還原為示範資料。" : "Restores this browser to the bundled demo dataset.")}</div></div><button class="btn ghost danger" data-action="reset-demo">${cloudModeEnabled() ? (this.locale === "zh-TW" ? "清除" : "Clear") : (this.locale === "zh-TW" ? "重設" : "Reset")}</button></div></div></div></details></section>`;
    const about = `<section class="section"><details class="card settings-fold"><summary><div><strong>${this.locale === "zh-TW" ? "計算方式、遊戲規則與版本" : "Calculations, game rules & version"}</strong><span>${this.locale === "zh-TW" ? "科學化預設、訓練分析、金色日、徽章、健康指引與研究來源" : "Science-informed defaults, training analysis, Gold Days, badges, health guidance and sources"}</span></div><span class="history-chevron">${icon("chevron")}</span></summary><div class="settings-fold-body science-methods">
      <details class="calorie-method-details"><summary>${this.locale === "zh-TW" ? "運動預設與自動記憶" : "Exercise defaults & adaptive memory"}</summary><div class="small muted calorie-method-copy">${this.locale === "zh-TW" ? "第一次加入動作時，LogTogether 會依動作類型給保守的起始建議，例如一般力量訓練約 2–3 組、6–12 次；伸展以短時間重複、衝刺以間歇、游泳與有氧以時間／距離記錄。完成過後，下一次會優先帶入你最近實際使用的設定，而不是一直重設成通用預設。起始值是一般健康成人的介面建議，不是個人化處方。" : "The first time you add an exercise, LogTogether uses a conservative activity-specific starter: for example, typical resistance work uses roughly 2–3 sets in a 6–12-rep range, stretching uses repeated short holds, sprints use intervals, and swimming/cardio use time and distance. After you have history, your recent actual setup is preferred over the generic starter. These are general healthy-adult UI suggestions, not individualized prescriptions."}</div></details>
      <details class="calorie-method-details"><summary>${this.locale === "zh-TW" ? "訓練點數與肌群分析" : "Training credit & muscle analysis"}</summary><div class="small muted calorie-method-copy">${this.locale === "zh-TW" ? "有效力量訓練組：主要／直接肌群約 +1.0 訓練點，明顯的次要／間接肌群約 +0.5；暖身組為 0。這些點數可以正規化成圓餅圖百分比，但百分比是 LogTogether 的訓練分布模型，不是人體肌肉啟動的精密生理量測。複合動作不會因涉及多個肌群而產生額外遊戲點數。" : "For a meaningful resistance working set, the primary/direct category receives about +1.0 training credit and meaningful secondary/indirect categories about +0.5; warm-up sets receive 0. These credits may be normalized into chart percentages, but those percentages are LogTogether training-distribution heuristics, not literal physiological activation measurements. Compound lifts do not create extra global game points just because several muscles are involved."}</div></details>
      <details class="calorie-method-details"><summary>${this.locale === "zh-TW" ? "金色活動日" : "Gold Days"}</summary><div class="small muted calorie-method-copy">${this.locale === "zh-TW" ? "一天的『有意義活動』達到 1.0 即變成金色日：約 4 組有效力量訓練 = 1.0、20 分鐘有氧 = 1.0、10 分鐘活動度 = 1.0，混合活動可相加。金色只是一個是否達標的回饋；運動更多不會讓一天變成『更金』，以避免為了遊戲點數刻意過量。v0.10 啟用前的日期保留舊版日曆判定。" : "A day becomes Gold at 1.0 Meaningful Activity: roughly 4 valid resistance working sets = 1.0, 20 cardio minutes = 1.0, or 10 mobility minutes = 1.0; mixed activity combines. Gold is a completion signal, not an endless score, so doing excessive volume does not make a day 'more gold.' Dates before the v0.10 science cutover retain their legacy calendar interpretation."}</div></details>
      <details class="calorie-method-details"><summary>${this.locale === "zh-TW" ? "每週任務、難度與個人活動" : "Weekly missions, difficulty & personal activity"}</summary><div class="small muted calorie-method-copy">${this.locale === "zh-TW" ? "10 個任務為 Push、Pull、下肢、核心、力量訓練天數、有氧分鐘、活動度分鐘、金色日、本週自選活動與飲水達標日。難度只改變鼓勵目標，不會放寬安全規則；Extreme 也不要求每週 7 天都運動。個人活動必須選擇跑步、游泳、健行、騎車或踢拳其中一項；未選擇時不會取得這項任務進度。體感難度 1–5 會保留在紀錄與趨勢，但不會乘上任務點數。" : "The 10 missions are Push, Pull, Lower body, Core, Strength frequency, Cardio minutes, Mobility minutes, Gold Days, Chosen activity days and Hydration days. Difficulty changes motivational targets only, never safety limits; even Extreme does not require seven exercise days. Chosen activity days requires one specific selection: running, swimming, hiking, cycling or kickboxing. It earns no progress until an activity is chosen. Effort 1–5 remains useful history but never multiplies mission points."}</div></details>
      <details class="calorie-method-details"><summary>${this.locale === "zh-TW" ? "月度徽章與連續性心理" : "Monthly badges & consistency psychology"}</summary><div class="small muted calorie-method-copy">${this.locale === "zh-TW" ? "月度徽章不再固定要求 35 點，而是完成當月可用週任務的約 80%，因此 4 週與 5 週月份較公平。一旦徽章取得就保存下來，不會因未來演算法更新被收回。LogTogether 使用四週 Momentum，而不是會因休息、生病或漏一天就歸零的長期每日 streak。" : "The monthly badge now requires about 80% of the weekly missions available in that month instead of a fixed 35, making 4- and 5-week months comparable. Once earned, a badge is retained rather than revoked by future scoring changes. LogTogether uses 4-week Momentum instead of a punitive long daily streak that resets because of rest, illness or one missed day."}</div></details>
      <details class="calorie-method-details"><summary>${this.locale === "zh-TW" ? "遊戲化為什麼這樣設計" : "Why the gamification is designed this way"}</summary><div class="small muted calorie-method-copy">${this.locale === "zh-TW" ? "遊戲化的目標是幫助規律，而不是把運動變成壓力來源。研究顯示遊戲化對身體活動通常有小到中等的正向效果，但長期效果較小；自我決定理論研究也更支持自主動機、勝任感與支持，而不是外在壓力。因此 LogTogether 用金色日、個人活動選擇、平衡任務與四週 Momentum 來提供回饋，不預設排名榜、不因體感 5/5 給更多點，也不使用一漏一天就歸零的長 streak。競爭與每日 streak 對部分人有幫助，但研究顯示效果差異很大，且 streak 可能讓部分使用者忽略恢復或帶傷運動。" : "The goal of gamification is adherence, not pressure. Research suggests gamified physical-activity interventions usually have small-to-moderate positive effects, with smaller long-term effects; self-determination research also favors autonomous motivation, competence and supportive environments over external pressure. LogTogether therefore uses Gold Days, personal activity choice, balanced missions and four-week Momentum, while avoiding default leaderboards, effort-point bonuses and all-or-nothing daily streaks. Competition and streaks can help some people, but effects are heterogeneous and streaks can encourage some users to exercise through insufficient recovery or injury."}</div></details>
      <details class="calorie-method-details"><summary>${this.locale === "zh-TW" ? "進步建議怎麼產生" : "How progression suggestions work"}</summary><div class="small muted calorie-method-copy">${this.locale === "zh-TW" ? "LogTogether 會查看近期同一動作的實際紀錄。對一般力量訓練，如果連續兩次都完成所有有效組、達到建議次數區間上緣且體感不超過 3/5，才會提示可以考慮 +1 次或小幅加重量；永遠由使用者決定，不會自動更改。若連續很吃力，則建議維持目前設定。活動度強調控制與規律而不是疼痛；有氧只建議一次小幅改變一個變數；水下救生動作不提供憋氣、距離或 PR 進步提示。" : "LogTogether reviews recent records for the same exercise. For ordinary resistance work, a progression prompt appears only after two recent sessions where all meaningful sets were completed at the top of the target rep range with effort no higher than 3/5. It may suggest +1 rep or a small load increase, but the user always decides and nothing changes automatically. Repeated hard sessions favor maintaining the setup. Mobility emphasizes control/consistency rather than pain; cardio suggests changing only one variable modestly; underwater lifesaving drills never generate breath-hold, distance or PR progression prompts."}</div></details>
      <details class="calorie-method-details"><summary>${this.locale === "zh-TW" ? "安全規則" : "Safety rules"}</summary><div class="small muted calorie-method-copy">${this.locale === "zh-TW" ? "水下救生／取物動作不會為更長憋氣、更遠水下距離、PR 或 streak 給額外獎勵；這類項目只記錄技巧參與並顯示水域監督提醒。對練／sparring 不會因更高強度得到更多點數；爆發／高技巧動作會提示品質優先於量。" : "Underwater lifesaving/retrieval drills never award extra credit for longer breath-holds, underwater distance, PRs or streaks; they log technique participation and show an aquatic-supervision reminder. Sparring never earns more points for harder contact, and explosive/high-skill movements emphasize quality before volume."}</div></details>
      <details class="calorie-method-details"><summary>${this.locale === "zh-TW" ? "健康指引與遊戲規則的差別" : "Health guidance vs. game rules"}</summary><div class="small muted calorie-method-copy">${this.locale === "zh-TW" ? "首頁的健康指引卡以一般成人公共健康建議顯示每週至少 150 分鐘中等強度等效有氧與至少 2 天力量訓練的資訊進度。它和每週任務是不同系統：遊戲任務刻意設計得更有鼓勵性，達成遊戲任務不代表已獲得個人醫療或訓練處方。較高強度有氧目前以 2× 分鐘作粗略中等強度等效；App 目前把同一天至少 4 組有效力量訓練當作一個力量訓練日，這只是 LogTogether 的操作定義。" : "The Home health-guideline card shows informational progress toward general-adult public-health guidance of at least 150 moderate-equivalent aerobic minutes and at least 2 strengthening days per week. It is deliberately separate from Weekly Missions: the game is designed to encourage behavior, and completing it is not a personalized medical or training prescription. Vigorous aerobic minutes currently count as a rough 2× moderate-minute equivalent; the app counts a day with at least 4 meaningful resistance working sets as one strength day, which is a LogTogether operational definition rather than a public-health set prescription."}</div></details>
      <details class="calorie-method-details"><summary>${this.locale === "zh-TW" ? "如何計算熱量" : "How we calculate calories"}</summary><div class="small muted calorie-method-copy">${this.locale === "zh-TW" ? "熱量仍是近似分析：Cal = MET × 3.5 × 體重(kg) ÷ 200 × 分鐘。LogTogether 會結合經過時間與已完成動作量估算。因不同活動的 MET 與個體差異很大，熱量只用於個人趨勢與家庭資訊，不再作為任務貨幣。" : "Calories remain approximate analytics: Cal = MET × 3.5 × weight (kg) ÷ 200 × minutes, with LogTogether blending elapsed time and completed work. Because MET values and individuals vary substantially, calories are retained for personal/family trends and are no longer a mission currency."}</div></details>
      <details class="calorie-method-details"><summary>${this.locale === "zh-TW" ? "如何計算 BMI" : "How we calculate BMI"}</summary><div class="small muted calorie-method-copy">${this.locale === "zh-TW" ? "BMI = 體重(kg) ÷ 身高(m)²。LogTogether 目前使用成人分類：過輕 <18.5、正常 18.5–<24、過重 24–<27、肥胖 ≥27。BMI 只作一般參考，不是診斷。" : "BMI = weight (kg) ÷ height (m)². LogTogether currently uses these adult categories: underweight <18.5, normal 18.5–<24, overweight 24–<27, obesity ≥27. BMI is a general reference, not a diagnosis."}</div></details>
      <details class="calorie-method-details"><summary>${this.locale === "zh-TW" ? "研究來源與設計依據" : "Research sources & rationale"}</summary><div class="small muted calorie-method-copy science-source-list"><p>${this.locale === "zh-TW" ? "LogTogether 的預設值與規則是把研究轉成保守的介面起點，不代表研究能為每個動作給出唯一正確數字。主要來源：" : "LogTogether translates research into conservative UI starting points; it does not claim that science provides one uniquely correct prescription for every exercise. Main sources:"}</p><a href="https://pubmed.ncbi.nlm.nih.gov/41843416/" target="_blank" rel="noopener noreferrer">ACSM 2026 resistance-training position stand</a><a href="https://pubmed.ncbi.nlm.nih.gov/41343037/" target="_blank" rel="noopener noreferrer">Resistance dose-response / fractional indirect-set analysis</a><a href="https://www.who.int/europe/news-room/fact-sheets/item/physical-activity" target="_blank" rel="noopener noreferrer">WHO physical activity guidance</a><a href="https://pacompendium.com/adult-compendium/" target="_blank" rel="noopener noreferrer">2024 Adult Compendium of Physical Activities</a><a href="https://pubmed.ncbi.nlm.nih.gov/39614059/" target="_blank" rel="noopener noreferrer">Static stretching dose meta-analysis</a><a href="https://pubmed.ncbi.nlm.nih.gov/38760916/" target="_blank" rel="noopener noreferrer">HIIT umbrella review</a><a href="https://pubmed.ncbi.nlm.nih.gov/36165995/" target="_blank" rel="noopener noreferrer">Sprint interval training meta-analysis</a><a href="https://pubmed.ncbi.nlm.nih.gov/36121177/" target="_blank" rel="noopener noreferrer">Jump-rope systematic review</a><a href="https://www.cdc.gov/drowning/prevention/index.html" target="_blank" rel="noopener noreferrer">CDC drowning / breath-hold safety guidance</a><a href="https://pubmed.ncbi.nlm.nih.gov/34982715/" target="_blank" rel="noopener noreferrer">Physical-activity gamification systematic review & meta-analysis</a><a href="https://pubmed.ncbi.nlm.nih.gov/40383282/" target="_blank" rel="noopener noreferrer">Self-determination theory & physical-activity review</a><a href="https://pubmed.ncbi.nlm.nih.gov/37547027/" target="_blank" rel="noopener noreferrer">Wearable leaderboards / heterogeneous gamification effects</a><a href="https://pubmed.ncbi.nlm.nih.gov/39439910/" target="_blank" rel="noopener noreferrer">Exercise streaks, habit formation & recovery trade-offs</a></div></details>
      <div class="tiny muted settings-version">${escapeHtml(this.text("version"))} ${APP_VERSION} · schema v1 · scoring v2 · exercise defaults v2 · ${cloudModeEnabled() ? "Cloud" : "Local"}</div>
    </div></details></section>`;
    const initials = this.state.user.displayName.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase() ?? "").join("") || "?";
    const profile = this.state.profile!;
    const profileImage = profile.photoId ? this.privateImage(profile.photoId,"settings-profile-photo",this.state.user.displayName) : this.authUser?.photoURL ? `<img class="settings-profile-photo" src="${escapeHtml(this.authUser.photoURL)}" referrerpolicy="no-referrer" alt="${escapeHtml(this.state.user.displayName)}">` : `<div class="settings-profile-photo placeholder">${escapeHtml(initials)}</div>`;
    const profileCard = `<section class="section settings-profile-section"><div class="card settings-profile-card"><div class="settings-profile-identity">${profileImage}<div><strong>${escapeHtml(this.state.user.displayName)}</strong><span>${this.authUser && this.cloudMembership?.access.status === "active" ? "Cloud" : "Local"}</span></div></div><button class="btn small" data-action="open-profile">${this.locale === "zh-TW" ? "編輯個人資料" : "Edit profile"}</button></div></section>`;
    return `<h1 class="page-title">${this.locale === "zh-TW" ? "設定" : "Settings"}</h1><p class="page-subtitle">${this.locale === "zh-TW" ? "常用介面設定放在最前面；較少使用的工具收進可展開區塊。" : "Common interface settings stay up front; less-used tools are tucked into expandable sections."}</p>${profileCard}${interfaceSection}${workoutExperienceSection}${notificationSection}${securitySection}${this.renderWorkoutSyncSettings()}${this.renderFamilyAccessSettings()}${specialNeeds}<section class="section"><details class="card settings-fold"><summary><div><strong>${this.locale === "zh-TW" ? "隱私與 Alpha 保護" : "Privacy & alpha protection"}</strong><span>${this.locale === "zh-TW" ? "App Check、家庭可見內容與未完成功能" : "App Check, family visibility and unfinished features"}</span></div><span class="history-chevron">${icon("chevron")}</span></summary><div class="settings-fold-body settings-nested">${this.renderAlphaReadinessSettings()}</div></details></section>${developerEffectsSection}${this.renderFeedbackSettings()}${dataTools}${about}`;
  }

  private latestExerciseEntry(exerciseId: string): WorkoutExerciseEntry | undefined {
    const sorted = this.state.workouts.filter(w => w.completedAt).slice().sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
    for (const workout of sorted) {
      const found = workout.exercises.find(exercise => exercise.exerciseId === exerciseId);
      if (found) return found;
    }
    return undefined;
  }

  private latestCompatibleExerciseEntry(definition: ExerciseDefinition): WorkoutExerciseEntry | undefined {
    const scienceProfile = exerciseScienceLoggingProfile(definition);
    const sorted = this.state.workouts.filter(w => w.completedAt).slice().sort((a,b)=>(b.completedAt??"").localeCompare(a.completedAt??""));
    for (const workout of sorted) {
      for (const entry of workout.exercises) {
        if (entry.exerciseId !== definition.id || !entry.sets.some(set => set.completed)) continue;
        if (entry.recordingProfileVersion === 2) {
          if (entry.recordingProfile === scienceProfile) return entry;
          continue;
        }
        // Legacy v0.9 values are reused only when their fields mean the same
        // thing in the science profile. Changed-format activities (for example
        // jumping jacks sets -> conditioning intervals) start from the new
        // evidence-informed default instead of copying an incompatible value.
        const legacy = exerciseLoggingProfile(definition);
        if (legacy === scienceProfile) return entry;
        if (legacy === "sets" && ["sets","skill_sets","isometric_sets"].includes(scienceProfile)) return entry;
        if (legacy === "cardio_session" && scienceProfile === "swim_session") return entry;
      }
    }
    return undefined;
  }

  private previousSet(workout: WorkoutRecord, exerciseId: string, index: number): SetEntry | undefined {
    const sorted = this.state.workouts
      .filter(item => item.id !== workout.id && item.completedAt)
      .slice()
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
    for (const item of sorted) {
      const set = item.exercises.find(ex => ex.exerciseId === exerciseId)?.sets[index];
      if (set?.completed) return set;
    }
    return undefined;
  }

  private setSummary(definition: ExerciseDefinition | undefined, set: SetEntry | undefined, exerciseEntry?: WorkoutExerciseEntry): string {
    if (!set) return "—";
    if (definition) {
      const profile = exerciseEntry ? exerciseEntryLoggingProfile(exerciseEntry,definition) : exerciseLoggingProfile(definition);
      const metrics = exerciseSessionMetricFlags(definition);
      const parts:string[]=[];
      if (["cardio_session","swim_session","yoga_flow","mobility_session"].includes(profile)) {
        if (set.durationSec !== undefined) parts.push(`${Math.round(set.durationSec / 60)} ${this.text("minutes")}`);
        if (metrics.distance && set.distanceKm !== undefined) parts.push(`${set.distanceKm} km`);
        if (metrics.speed && set.speedKph !== undefined) parts.push(`${set.speedKph} km/h`);
        if (metrics.incline && set.inclinePct !== undefined) parts.push(`${set.inclinePct}% ${this.locale === "zh-TW" ? "坡度" : "incline"}`);
        if (metrics.resistance && set.resistanceLevel !== undefined) parts.push(`${this.locale === "zh-TW" ? "阻力" : "level"} ${set.resistanceLevel}`);
        if (metrics.laps && set.laps !== undefined) parts.push(`${set.laps} ${this.locale === "zh-TW" ? "趟" : "laps"}`);
        if (metrics.cadence && set.cadenceRpm !== undefined) parts.push(`${set.cadenceRpm} rpm`);
        if (metrics.strokeRate && set.strokeRateSpm !== undefined) parts.push(`${set.strokeRateSpm} spm`);
        if (metrics.pace500 && set.pace500Sec !== undefined) parts.push(`${this.clockText(set.pace500Sec)}/500m`);
        if (metrics.vertical && set.verticalGainM !== undefined) parts.push(`+${set.verticalGainM} m`);
        if (metrics.packWeight && set.packWeightKg !== undefined) parts.push(`${set.packWeightKg} kg ${this.locale === "zh-TW" ? "負重" : "pack"}`);
        return parts.join(" · ") || "—";
      }
      if (profile === "loaded_carry") {
        if (set.loadPerHandKg !== undefined) parts.push(`${set.loadPerHandKg} kg/${this.locale === "zh-TW" ? "手" : "hand"}`);
        if (set.distanceKm !== undefined) parts.push(`${Math.round(set.distanceKm*1000)} m`);
        if (set.durationSec !== undefined) parts.push(`${set.durationSec}s`);
        return parts.join(" · ") || "—";
      }
      if (["rounds","conditioning_intervals","sprint_intervals","water_skill","skill_drill","isometric_sets","balance_hold","static_stretch"].includes(profile)) {
        if (set.reps !== undefined && set.reps>0) parts.push(`${set.reps} ${this.text("reps")}`);
        if (set.durationSec !== undefined && set.durationSec>0) parts.push(`${set.durationSec} ${this.text("seconds")}`);
        if (set.distanceKm !== undefined && set.distanceKm>0) parts.push(`${Math.round(set.distanceKm*1000)} m`);
        if (set.side && set.side!=="both") parts.push(set.side === "left" ? (this.locale==="zh-TW"?"左":"left") : (this.locale==="zh-TW"?"右":"right"));
        return parts.join(" · ") || "—";
      }
      if (profile === "dynamic_mobility") return `${set.reps ?? "—"} ${this.locale === "zh-TW" ? "次／側" : "reps/side"}`;
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
      home_functional: "Home / Functional",
      gym: "Gym",
      calisthenics: "Calisthenics",
      outdoor_cardio: "Outdoor / Cardio",
      mobility_yoga: "Mobility / Yoga / Stretching",
      swimming: "Swimming / Lifesaving",
      kickboxing: "Kickboxing / Boxing",
      sports_other: "Sports / Other"
    };
    const zh: Record<ExerciseLibraryGroup, string> = {
      home_functional: "居家／功能性",
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
    const profile = exerciseScienceLoggingProfile(definition);
    const labels:Record<string,[string,string]>={
      sets:["力量組","Strength sets"], skill_sets:["技巧力量組","Skill-strength sets"], isometric_sets:["等長計時組","Timed isometric sets"], loaded_carry:["負重行走","Loaded carry"],
      conditioning_intervals:["體能間歇","Conditioning intervals"], cardio_session:["有氧單次紀錄","Cardio session"], sprint_intervals:["衝刺間歇","Sprint intervals"],
      static_stretch:["靜態伸展","Static stretch"], dynamic_mobility:["動態活動度","Dynamic mobility"], yoga_flow:["瑜珈／流動","Yoga / flow"], swim_session:["游泳訓練","Swim session"],
      water_skill:["水域技巧","Water skill"], rounds:["回合制","Rounds"], skill_drill:["技巧訓練","Skill drill"], mobility_session:["舊版活動度","Legacy mobility"]
    };
    const pair=labels[profile] ?? [profile,profile];
    return `${this.exerciseLibraryGroupLabel(exerciseLibraryGroup(definition))} · ${this.locale === "zh-TW" ? pair[0] : pair[1]}`;
  }

  private recentExerciseEntries(exerciseId:string, limit=2): WorkoutExerciseEntry[] {
    return this.state.workouts.filter(workout=>workout.completedAt).slice().sort((a,b)=>(b.completedAt??"").localeCompare(a.completedAt??""))
      .flatMap(workout=>workout.exercises.filter(exercise=>exercise.exerciseId===exerciseId && exercise.sets.some(set=>set.completed))).slice(0,limit);
  }

  private progressionHint(definition: ExerciseDefinition): string {
    const flags=exerciseSafetyFlags(definition);
    if(flags.includes("no_progression")) return this.locale === "zh-TW" ? "安全優先：此水下技巧不提供憋氣時間、水下距離或 PR 進步提示。" : "Safety first: this underwater skill never generates breath-hold, underwater-distance or PR progression prompts.";
    const recent=this.recentExerciseEntries(definition.id,2);
    if(!recent.length) return this.locale === "zh-TW" ? "第一次使用會套用科學化起始建議；完成後，LogTogether 會記住你的實際設定。" : "First use starts from a science-informed suggestion; after you train it, LogTogether remembers your actual setup.";
    const progression=exerciseProgressionProfile(definition);
    if(["load_reps","bodyweight_reps","skill_strength"].includes(progression) && recent.length>=2){
      const starter=exerciseStarterDefault(definition);
      const target=recent[0]?.targetRepMax ?? starter.repMax ?? starter.reps ?? 10;
      const comfortable=recent.every(entry=>{ const working=entry.sets.filter(set=>set.completed&&set.setType!=="warmup"); return working.length>0 && working.every(set=>(set.reps??0)>=target) && (entry.difficulty??3)<=3; });
      if(comfortable) return definition.type==="weight_reps"
        ? (this.locale === "zh-TW" ? `準備進步？最近兩次都在體感 ≤3/5 下達到 ${target} 次上緣。可考慮 +1 次或小幅加重量；不會自動更改。` : `Ready to progress? Your last two sessions reached the ${target}-rep upper target at effort ≤3/5. Consider +1 rep or a small load increase; nothing changes automatically.`)
        : (this.locale === "zh-TW" ? `準備進步？最近兩次都在體感 ≤3/5 下達到 ${target} 次上緣。可考慮 +1 次或稍微更難的變化；不會自動更改。` : `Ready to progress? Your last two sessions reached the ${target}-rep upper target at effort ≤3/5. Consider +1 rep or a slightly harder variation; nothing changes automatically.`);
      const hard=recent.every(entry=>(entry.difficulty??3)>=4);
      if(hard) return this.locale === "zh-TW" ? "最近兩次都偏吃力；維持目前設定是合理選擇，不需要為了遊戲點數加重。" : "Your last two sessions felt hard; keeping the current setup is reasonable. There is no game-point reward for increasing difficulty.";
    }
    if(progression==="cardio"||progression==="swimming") return this.locale === "zh-TW" ? "已優先帶入上次設定。若仍舒服，只小幅增加時間、速度／配速、阻力中的一項即可。" : "Your recent setup is preferred. If it still feels comfortable, increase only one variable modestly: duration, pace/speed or resistance.";
    if(progression==="mobility") return this.locale === "zh-TW" ? "活動度進步看規律、控制與舒適活動範圍，不以疼痛或更強拉伸換取點數。" : "Mobility progress means consistency, control and comfortable range—not pain or a harder stretch for points.";
    if(progression==="combat") return this.locale === "zh-TW" ? "優先增加高品質回合或技巧穩定度；對練強度不會增加遊戲點數。" : "Progress through quality rounds and technical consistency; harder sparring never earns extra game points.";
    return this.locale === "zh-TW" ? "已優先帶入最近的實際設定；LogTogether 不會自動增加難度。" : "Your recent setup is preferred; LogTogether never increases difficulty automatically.";
  }

  private exerciseImageSearchUrl(definition: ExerciseDefinition): string {
    return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${definition.names.en} exercise form`)}`;
  }

  private renderWeeklySupplementRows(
    entries: Array<{ date:string; time:string; supplementId:string; customLabel?:string; amount?:number; unit?:SupplementUnit }>,
    weekStart: Date,
    filter = "all"
  ): { rows:string; availableIds:string[]; filtered:Array<{ date:string; time:string; supplementId:string; customLabel?:string; amount?:number; unit?:SupplementUnit }>; breakdown:string } {
    const availableIds = [...new Set(entries.map(item => item.supplementId))]
      .sort((a,b)=>this.supplementLabel(a, entries.find(item=>item.supplementId===a)?.customLabel).localeCompare(this.supplementLabel(b, entries.find(item=>item.supplementId===b)?.customLabel)));
    const filtered = filter === "all" ? entries : entries.filter(item=>item.supplementId===filter);
    const summaryMap = new Map<string,{ amount:number; unit:SupplementUnit|null; customLabel?:string; mixedUnits:boolean; logs:number; days:Set<string> }>();
    for(const entry of filtered){
      const current=summaryMap.get(entry.supplementId) ?? { amount:0, unit:entry.unit??null, ...(entry.customLabel?{customLabel:entry.customLabel}:{}), mixedUnits:false, logs:0, days:new Set<string>() };
      current.logs += 1;
      current.days.add(entry.date);
      current.amount += Number(entry.amount ?? 0);
      if(!current.unit) current.unit=entry.unit??null;
      else if((entry.unit??null)!==current.unit) current.mixedUnits=true;
      summaryMap.set(entry.supplementId,current);
    }
    const rows=[...summaryMap.entries()]
      .sort((a,b)=>this.supplementLabel(a[0],a[1].customLabel).localeCompare(this.supplementLabel(b[0],b[1].customLabel)))
      .map(([supplementId,info])=>{
        const total=info.mixedUnits || !info.unit
          ? `${info.logs} ${this.locale === "zh-TW" ? "筆紀錄" : info.logs===1 ? "log" : "logs"}`
          : `${Number(info.amount.toFixed(2)).toLocaleString()} ${this.supplementUnitLabel(info.unit,info.amount)}`;
        const entryLines=filtered.filter(item=>item.supplementId===supplementId).slice()
          .sort((a,b)=>`${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
          .map(item=>`${escapeHtml(item.date)} · ${escapeHtml(item.time)} · ${escapeHtml(String(item.amount??""))} ${escapeHtml(this.supplementUnitLabel(item.unit,item.amount))}`)
          .join("<br>");
        return `<details class="supplement-review-row"><summary><strong>${escapeHtml(this.supplementLabel(supplementId,info.customLabel))}</strong><span class="supplement-days">${Array.from({length:7},(_,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);const key=localDateKey(d);return `<span title="${key}: ${info.days.has(key)?(this.locale==="zh-TW"?"有紀錄":"Recorded"):(this.locale==="zh-TW"?"無紀錄":"No record")}">${info.days.has(key)?"●":"○"}</span>`;}).join("")}</span></summary><div class="supplement-week-row"><div><strong>${escapeHtml(this.supplementLabel(supplementId,info.customLabel))}</strong><span>${info.days.size} ${this.locale === "zh-TW" ? "天" : info.days.size===1 ? "day" : "days"} · ${info.logs} ${this.locale === "zh-TW" ? "次" : info.logs===1 ? "entry" : "entries"}</span></div><b>${escapeHtml(total)}</b></div>${entryLines?`<p class="small muted supplement-time-lines">${entryLines}</p>`:""}</details>`;
      }).join("");
    const groupedDays=filtered.reduce((map,item)=>{const list=map.get(item.date)??[];list.push(item);map.set(item.date,list);return map;},new Map<string,Array<{ date:string; time:string; supplementId:string; customLabel?:string; amount?:number; unit?:SupplementUnit }>>());
    const breakdown=filter === "all" ? "" : [...groupedDays.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([date,dayEntries])=>`<div class="supplement-week-day"><strong>${escapeHtml(new Date(`${date}T12:00:00`).toLocaleDateString(this.locale,{weekday:"short",month:"short",day:"numeric"}))}</strong><div>${dayEntries.slice().sort((a,b)=>a.time.localeCompare(b.time)).map(entry=>`${escapeHtml(entry.time)} · ${escapeHtml((entry.amount??0).toLocaleString())} ${escapeHtml(this.supplementUnitLabel(entry.unit,entry.amount))}`).join("<br>")}</div></div>`).join("");
    return {rows,availableIds,filtered,breakdown};
  }

  private renderSupplementWeekSummary(): string {
    const {start,end}=currentWeekBounds(new Date(`${this.selectedWaterDate}T12:00:00`));
    const endInclusive=new Date(end.getTime()-1);
    const entries=(this.state.supplementHistory??[])
      .filter(day=>day.date>=localDateKey(start)&&day.date<=localDateKey(endInclusive))
      .flatMap(day=>day.entries.map(entry=>({date:day.date,time:this.formatTime(entry.at),supplementId:entry.supplementId,...(entry.customLabel?{customLabel:entry.customLabel}:{}),...(entry.amount!==undefined?{amount:entry.amount}:{}),...(entry.unit?{unit:entry.unit}:{} as {unit?:SupplementUnit})})));
    const allIds=[...new Set(entries.map(item=>item.supplementId))];
    if(this.supplementWeekFilter!=="all"&&!allIds.includes(this.supplementWeekFilter)) this.supplementWeekFilter="all";
    const review=this.renderWeeklySupplementRows(entries,start,this.supplementWeekFilter);
    const title=this.locale === "zh-TW" ? "本週補充品總覽" : "This week’s supplement summary";
    const label=`${start.toLocaleDateString(this.locale,{month:"short",day:"numeric"})} – ${endInclusive.toLocaleDateString(this.locale,{month:"short",day:"numeric"})}`;
    return `<section class="section"><div class="section-header"><h2 class="section-title">${title}</h2><span class="section-value">${escapeHtml(label)}</span></div><details class="card supplement-week-card" ${this.supplementWeekOpen?"open":""}><summary><div><strong>${entries.length?(this.locale === "zh-TW" ? "查看每週補充品" : "Review weekly supplements"):(this.locale === "zh-TW" ? "本週還沒有補充品" : "No supplements logged this week")}</strong><span>${review.availableIds.length} ${this.locale === "zh-TW" ? "種補充品" : review.availableIds.length===1 ? "supplement" : "supplements"} · ${entries.length} ${this.locale === "zh-TW" ? "筆紀錄" : entries.length===1 ? "entry" : "entries"}</span></div><span class="history-chevron">${icon("chevron")}</span></summary>${entries.length?`<div class="supplement-week-body"><label class="field"><span>${this.locale === "zh-TW" ? "篩選補充品" : "Filter supplement"}</span><select class="select" id="supplement-week-filter"><option value="all" ${this.supplementWeekFilter==="all"?"selected":""}>${this.locale === "zh-TW" ? "全部補充品" : "All supplements"}</option>${review.availableIds.map(id=>{const custom=entries.find(item=>item.supplementId===id)?.customLabel;return `<option value="${escapeHtml(id)}" ${this.supplementWeekFilter===id?"selected":""}>${escapeHtml(this.supplementLabel(id,custom))}</option>`;}).join("")}</select></label><p class="small muted">${this.locale==="zh-TW"?"週一 → 週日 · ● 有紀錄 ○ 無紀錄；不是漏服提醒。":"Mon → Sun · ● recorded ○ no record; not a missed-dose assessment."}</p><div class="supplement-week-list">${review.rows}</div>${review.breakdown?`<div class="supplement-week-breakdown"><div class="tiny muted">${this.locale === "zh-TW" ? "每日明細" : "Daily breakdown"}</div>${review.breakdown}</div>`:""}</div>`:`<div class="supplement-week-empty small muted">${this.locale === "zh-TW" ? "記錄幾次補充品後，這裡會自動幫你整理每週總量與出現天數。" : "Once you log a few supplements, this panel will summarize totals and usage days for the week."}</div>`}</details></section>`;
  }

  private renderExerciseOptions(): string {
    const filtered = EXERCISES.filter(exercise => exercise.id !== "hiking_cardio" && (this.exerciseLibraryFilter === "all" || exerciseLibraryGroup(exercise) === this.exerciseLibraryFilter));
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
    const profile = exerciseScienceLoggingProfile(definition);
    const metrics = exerciseSessionMetricFlags(definition);
    const starter = exerciseStarterDefault(definition);
    const laterality = exerciseLaterality(definition);
    const previousEntry = this.latestCompatibleExerciseEntry(definition);
    const previous = previousEntry?.sets[0];
    const focus = this.exerciseFocusText(definition);
    const safetyFlags=exerciseSafetyFlags(definition);
    const previousCount=previousEntry?.sets.length;
    const count=clamp(previousCount ?? starter.sets,1,12);
    const rest=Math.max(0,previousEntry?.restSec ?? starter.restSec);
    const workTarget=Math.max(0,Math.round(previous?.targetWorkSec ?? 0));
    const side=previous?.side ?? "both";
    const countRest=(countLabel:string,restLabel:string,max=12)=>`<div class="form-two"><div class="field"><label>${countLabel}</label><input class="input" name="sets" type="number" min="1" max="${max}" step="1" inputmode="numeric" value="${count}"></div><div class="field"><label>${restLabel}</label><input class="input" name="rest" type="number" min="0" max="900" step="1" inputmode="numeric" value="${rest}"></div></div>`;
    const sideField=laterality === "none" ? "" : `<div class="field"><label>${this.locale==="zh-TW"?"側別":"Side"}</label><select class="select" name="side"><option value="both" ${side==="both"?"selected":""}>${this.locale==="zh-TW"?"雙側／交替":"Both / alternating"}</option><option value="left" ${side==="left"?"selected":""}>${this.locale==="zh-TW"?"左":"Left"}</option><option value="right" ${side==="right"?"selected":""}>${this.locale==="zh-TW"?"右":"Right"}</option></select></div>`;
    let structureFields="", fields="";

    if(profile==="sets"||profile==="skill_sets"){
      structureFields=`<div class="form-three"><div class="field"><label>${this.locale==="zh-TW"?"組數":"Sets"}</label><input class="input" name="sets" type="number" min="1" max="10" step="1" inputmode="numeric" value="${count}"></div><div class="field"><label>${this.locale==="zh-TW"?"每組目標秒數":"Work per set (sec)"}</label><input class="input" name="targetWork" type="number" min="0" max="1800" step="1" inputmode="numeric" value="${workTarget || ""}" placeholder="—"></div><div class="field"><label>${this.locale==="zh-TW"?"組間休息（秒）":"Rest between sets (sec)"}</label><input class="input" name="rest" type="number" min="0" max="900" step="1" inputmode="numeric" value="${rest}"></div></div>`;
      const defaultReps=previous?.reps ?? starter.reps ?? 8;
      if(definition.type==="weight_reps") fields=`<div class="form-two"><div class="field"><label>${escapeHtml(this.text("defaultWeight"))}</label><input class="input" name="weight" type="number" min="0" step="0.5" inputmode="decimal" value="${previous?.weightKg ?? 0}"></div><div class="field"><label>${escapeHtml(this.text("defaultReps"))}</label><input class="input" name="reps" type="number" min="0" step="1" inputmode="numeric" value="${defaultReps}"></div></div>`;
      else fields=`<div class="field"><label>${escapeHtml(this.text("defaultReps"))}</label><input class="input" name="reps" type="number" min="0" step="1" inputmode="numeric" value="${defaultReps}"></div>`;
    } else if(profile==="isometric_sets"||profile==="balance_hold"){
      structureFields=countRest(profile==="balance_hold" ? (this.locale==="zh-TW"?"平衡組數":"Balance holds") : (this.locale==="zh-TW"?"計時組數":"Timed sets"),this.locale==="zh-TW"?"組間休息（秒）":"Rest between sets (sec)");
      fields=`<div class="field"><label>${profile==="balance_hold" ? (this.locale==="zh-TW"?"每次平衡（秒）":"Balance time per hold (sec)") : (this.locale==="zh-TW"?"每組維持（秒）":"Hold per set (sec)")}</label><input class="input" name="duration" type="number" min="1" max="600" step="1" value="${previous?.durationSec ?? starter.durationSec ?? 30}"></div>`;
    } else if(profile==="loaded_carry"){
      structureFields=countRest(this.locale==="zh-TW"?"趟數":"Carries",this.locale==="zh-TW"?"趟間休息（秒）":"Rest between carries (sec)");
      fields=`<div class="session-field-grid"><div class="field"><label>${this.locale==="zh-TW"?"每手重量（kg）":"Load per hand (kg)"}</label><input class="input" name="loadPerHand" type="number" min="0" step="0.5" value="${previous?.loadPerHandKg ?? ""}"></div><div class="field"><label>${this.locale==="zh-TW"?"距離（m）":"Distance (m)"}</label><input class="input" name="distanceM" type="number" min="0" step="1" value="${previous?.distanceKm!==undefined?Math.round(previous.distanceKm*1000):Math.round((starter.distanceKm??0.03)*1000)}"></div><div class="field"><label>${this.locale==="zh-TW"?"時間（秒，可選）":"Time (sec, optional)"}</label><input class="input" name="duration" type="number" min="0" step="1" value="${previous?.durationSec ?? starter.durationSec ?? 30}"></div></div>`;
    } else if(profile==="conditioning_intervals"||profile==="sprint_intervals"){
      structureFields=countRest(this.locale==="zh-TW"?"間歇次數":"Intervals",this.locale==="zh-TW"?"恢復（秒）":"Recovery (sec)");
      const power=profile==="conditioning_intervals"&&definition.id==="jump_squat";
      const jumpRope=definition.id.startsWith("jump_rope_");
      const pieces=[power?`<div class="field"><label>${this.locale==="zh-TW"?"每輪高品質次數":"Quality reps / interval"}</label><input class="input" name="reps" type="number" min="1" step="1" value="${previous?.reps ?? starter.reps ?? 5}"></div>`:`<div class="field"><label>${this.locale==="zh-TW"?"工作時間（秒）":"Work interval (sec)"}</label><input class="input" name="duration" type="number" min="1" step="1" value="${previous?.durationSec ?? starter.durationSec ?? 30}"></div>`];
      if(jumpRope) pieces.push(`<div class="field"><label>${this.locale==="zh-TW"?"成功跳數（選填）":"Successful jumps (optional)"}</label><input class="input" name="reps" type="number" min="0" step="1" value="${previous?.reps ?? ""}"></div>`);
      if(profile==="sprint_intervals") pieces.push(`<div class="field"><label>${this.locale==="zh-TW"?"每趟距離（m，可選）":"Distance / interval (m, optional)"}</label><input class="input" name="distanceM" type="number" min="0" step="1" value="${previous?.distanceKm!==undefined?Math.round(previous.distanceKm*1000):""}"></div>`);
      fields=`<div class="session-field-grid">${pieces.join("")}</div>`;
    } else if(profile==="static_stretch"){
      structureFields=`<div class="form-three"><div class="field"><label>${this.locale==="zh-TW"?"重複次數":"Repeats"}</label><input class="input" name="sets" type="number" min="1" max="8" value="${count}"></div>${sideField}<div class="field"><label>${this.locale==="zh-TW"?"重複間休息（秒）":"Rest between repeats (sec)"}</label><input class="input" name="rest" type="number" min="0" max="900" step="1" value="${rest}"></div></div>`;
      fields=`<div class="field"><label>${this.locale==="zh-TW"?"每次維持（秒）":"Hold each repeat (sec)"}</label><input class="input" name="duration" type="number" min="5" max="180" step="1" value="${previous?.durationSec ?? starter.durationSec ?? 30}"></div>`;
    } else if(profile==="dynamic_mobility"){
      structureFields=`<div class="form-three"><div class="field"><label>${this.locale==="zh-TW"?"組數":"Sets"}</label><input class="input" name="sets" type="number" min="1" max="6" value="${count}"></div>${sideField}<div class="field"><label>${this.locale==="zh-TW"?"組間休息（秒）":"Rest between sets (sec)"}</label><input class="input" name="rest" type="number" min="0" max="900" step="1" value="${rest}"></div></div>`;
      fields=`<div class="field"><label>${this.locale==="zh-TW"?"每側慢速次數":"Slow reps per side"}</label><input class="input" name="reps" type="number" min="1" max="50" value="${previous?.reps ?? starter.reps ?? 8}"></div>`;
    } else if(profile==="rounds"||profile==="skill_drill"||profile==="water_skill"){
      structureFields=countRest(this.locale==="zh-TW"?"回合／重複":"Rounds / repeats",this.locale==="zh-TW"?"回合間恢復（秒）":"Recovery between rounds (sec)");
      const underwater=safetyFlags.includes("no_progression");
      fields=underwater
        ? `<div class="field"><label>${this.locale==="zh-TW"?"技巧重複次數":"Technique reps"}</label><input class="input" name="reps" type="number" min="1" max="20" value="${previous?.reps ?? starter.reps ?? 3}"></div>`
        : `<div class="field"><label>${this.locale==="zh-TW"?"每回合時間（秒）":"Seconds per round"}</label><input class="input" name="duration" type="number" min="10" max="3600" step="1" value="${previous?.durationSec ?? starter.durationSec ?? 60}"></div>`;
    } else {
      const minutes=previous?.durationSec!==undefined?Math.max(1,Math.round(previous.durationSec/60)):(starter.minutes??20);
      const sessionFields=[`<div class="field"><label>${this.locale==="zh-TW"?"預計時間（分鐘）":"Planned duration (min)"}</label><input class="input" name="minutes" type="number" min="1" max="1440" value="${minutes}"></div>`];
      if(metrics.distance) sessionFields.push(`<div class="field"><label>${this.locale==="zh-TW"?"距離（km）":"Distance (km)"}</label><input class="input" name="distance" type="number" min="0" step="0.01" value="${previous?.distanceKm ?? ""}"></div>`);
      if(metrics.speed) sessionFields.push(`<div class="field"><label>${this.locale==="zh-TW"?"速度（km/h）":"Speed (km/h)"}</label><input class="input" name="speed" type="number" min="0" max="80" step="0.1" value="${previous?.speedKph ?? ""}"></div>`);
      if(metrics.incline) sessionFields.push(`<div class="field"><label>${this.locale==="zh-TW"?"坡度（%）":"Incline (%)"}</label><input class="input" name="incline" type="number" min="-10" max="40" step="0.5" value="${previous?.inclinePct ?? 0}"></div>`);
      if(metrics.resistance) sessionFields.push(`<div class="field"><label>${this.locale==="zh-TW"?"阻力／等級":"Resistance / level"}</label><input class="input" name="resistance" type="number" min="0" max="100" step="1" value="${previous?.resistanceLevel ?? ""}"></div>`);
      if(metrics.laps) sessionFields.push(`<div class="field"><label>${this.locale==="zh-TW"?"趟數":"Laps"}</label><input class="input" name="laps" type="number" min="0" step="1" value="${previous?.laps ?? ""}"></div>`);
      if(metrics.cadence) sessionFields.push(`<div class="field"><label>${this.locale==="zh-TW"?"踏頻（rpm，可選）":"Cadence (rpm, optional)"}</label><input class="input" name="cadence" type="number" min="0" step="1" value="${previous?.cadenceRpm ?? ""}"></div>`);
      if(metrics.strokeRate) sessionFields.push(`<div class="field"><label>${this.locale==="zh-TW"?"划頻（spm，可選）":"Stroke rate (spm, optional)"}</label><input class="input" name="strokeRate" type="number" min="0" step="1" value="${previous?.strokeRateSpm ?? ""}"></div>`);
      if(metrics.pace500) sessionFields.push(`<div class="field"><label>${this.locale==="zh-TW"?"500m 配速（秒，可選）":"500m pace (sec, optional)"}</label><input class="input" name="pace500" type="number" min="0" step="1" value="${previous?.pace500Sec ?? ""}"></div>`);
      if(metrics.vertical) sessionFields.push(`<div class="field"><label>${this.locale==="zh-TW"?"爬升（m，可選）":"Vertical gain (m, optional)"}</label><input class="input" name="vertical" type="number" min="0" step="1" value="${previous?.verticalGainM ?? ""}"></div>`);
      if(metrics.packWeight) sessionFields.push(`<div class="field"><label>${this.locale==="zh-TW"?"背包重量（kg，可選）":"Pack weight (kg, optional)"}</label><input class="input" name="packWeight" type="number" min="0" step="0.5" value="${previous?.packWeightKg ?? ""}"></div>`);
      fields=`<div class="session-field-grid">${sessionFields.join("")}</div>`;
    }

    const safety=safetyFlags.includes("aquatic_supervision") ? `<div class="science-safety-warning"><strong>${this.locale==="zh-TW"?"水域安全":"Aquatic safety"}</strong><span>${this.locale==="zh-TW"?"請在合適監督／同伴制度下訓練。LogTogether 不會獎勵更長憋氣、水下距離或水下 PR。":"Train with appropriate supervision/buddy practices. LogTogether never rewards longer breath-holds, underwater distance or underwater PRs."}</span></div>` : safetyFlags.includes("secure_support") ? `<div class="science-safety-warning subtle"><span>${this.locale==="zh-TW"?"請確認單槓／支撐物穩固。需要時保留腳部支撐；若肩膀疼痛或握力失控就停止。":"Use a secure bar/support. Keep foot support when needed, and stop with shoulder pain or loss of grip."}</span></div>` : safetyFlags.includes("quality_before_volume") ? `<div class="science-safety-warning subtle"><span>${this.locale==="zh-TW"?"品質優先：技術開始明顯下降時停止增加量。":"Quality first: stop adding volume when technique clearly deteriorates."}</span></div>` : "";

    return `<form id="add-exercise-form" class="composer-card science-composer">
      <div class="composer-title-row"><div><div class="section-title">${escapeHtml(this.text("addExercise"))}</div><div class="small muted">${this.locale==="zh-TW"?"v0.10 會依動作選擇合理記錄方式，再記住你的實際設定。":"v0.10 chooses an activity-appropriate recording method, then remembers your real setup."}</div></div></div>
      <div class="field"><label>${this.locale === "zh-TW" ? "運動類型" : "Exercise type"}</label><select class="select" id="exercise-type-filter">${this.renderExerciseTypeOptions()}</select></div>
      <div class="field"><label>${escapeHtml(this.text("chooseExercise"))}</label><select class="select select-large" id="exercise-picker" name="exerciseId">${this.renderExerciseOptions()}</select></div>
      <div class="exercise-preview-card compact-preview"><div><span>${escapeHtml(this.exercisePreviewHint(definition))}</span>${focus ? `<small class="exercise-focus-preview">${escapeHtml(focus)}</small>` : ""}</div><a class="exercise-example-link" href="${escapeHtml(this.exerciseImageSearchUrl(definition))}" target="_blank" rel="noopener noreferrer">${this.locale === "zh-TW" ? "查看圖片示範" : "View image examples"}</a></div>
      ${safety}
      ${structureFields}${fields}
      <button class="btn primary full touch" type="submit">${icon("plus")} ${escapeHtml(this.text("addToWorkout"))}</button>
    </form>`;
  }
  private renderRoutineManager(): string {
    const zh = this.locale === "zh-TW";
    const routines = this.state.routines ?? [];
    const draft = this.routineDraft;
    const selected = routines.find(routine => routine.id === this.selectedRoutineManagerId);
    const fields = (set: WorkoutRoutine["exercises"][number]["sets"][number], exercise: WorkoutRoutine["exercises"][number], ei: number, si: number) => {
      const definition = exerciseById(exercise.exerciseId);
      const profile = exercise.recordingProfile ?? exerciseScienceLoggingProfile(exerciseById(exercise.exerciseId)!);
      const timed = ["isometric_sets","balance_hold","static_stretch","conditioning_intervals","sprint_intervals","loaded_carry","cardio_session","swim_session","mobility_session","yoga_flow","rounds","skill_drill","water_skill"].includes(profile);
      const keys = new Set<string>([...Object.keys(set).filter(k => typeof (set as any)[k] === "number"), ...(timed ? ["durationSec"] : ["reps"])]);
      if (["sets","loaded_carry"].includes(profile)) keys.add("weightKg");
      const names: Record<string,string> = {reps:zh?"次數":"Reps",durationSec:zh?"秒":"Seconds",targetWorkSec:zh?"選填計時秒數":"Optional timer seconds",weightKg:zh?"重量 kg":"Load kg",distanceKm:zh?"距離 km":"Distance km",speedKph:"km/h",inclinePct:zh?"坡度 %":"Incline %",resistanceLevel:zh?"阻力":"Resistance",laps:zh?"趟數":"Laps",recoverySec:zh?"恢復秒數":"Recovery seconds",loadPerHandKg:zh?"每手 kg":"Per hand kg",cadenceRpm:"rpm",strokeRateSpm:"spm",pace500Sec:"s/500 m",verticalGainM:zh?"爬升 m":"Ascent m",packWeightKg:zh?"背包 kg":"Pack kg"};
      const sideField = definition && exerciseLaterality(definition) !== "none" ? `<label class="field"><span class="label">${zh?"側":"Side"}</span><select class="select" data-routine-field="side" data-re="${ei}" data-rs="${si}">${["both","left","right"].map(v=>`<option value="${v}" ${(set.side??"both")===v?"selected":""}>${v==="both"?(zh?"雙側":"Both"):v==="left"?(zh?"左":"Left"):(zh?"右":"Right")}</option>`).join("")}</select></label>` : "";
      return [...keys].filter(k=>names[k]).map(k=>`<label class="field"><span class="label">${names[k]}</span><input class="input" type="number" min="${k === "inclinePct" ? -10 : 0}" step="${["weightKg","distanceKm","speedKph","loadPerHandKg","packWeightKg","inclinePct"].includes(k)?"0.1":"1"}" value="${(set as any)[k] ?? ""}" data-routine-field="${k}" data-re="${ei}" data-rs="${si}"></label>`).join("") + `<label class="field"><span class="label">${zh?"類型":"Type"}</span><select class="select" data-routine-field="setType" data-re="${ei}" data-rs="${si}">${["normal","warmup","drop","failure"].map(v=>`<option value="${v}" ${(set.setType??"normal")===v?"selected":""}>${v==="normal"?(zh?"正式":"Working"):v==="warmup"?(zh?"暖身":"Warm-up"):v==="drop"?(zh?"遞減":"Drop"):(zh?"力竭":"Failure")}</option>`).join("")}</select></label>${sideField}`;
    };
    const routineExerciseOptions = LIBRARY_GROUP_ORDER.map(group => {
      const items = EXERCISES.filter(exercise => exerciseLibraryGroup(exercise) === group);
      return items.length ? `<optgroup label="${escapeHtml(this.exerciseLibraryGroupLabel(group))}">${items.map(exercise=>`<option value="${exercise.id}">${escapeHtml(exercise.names[this.locale])}</option>`).join("")}</optgroup>` : "";
    }).join("");
    const selector = routines.length ? `<label class="field routine-manager-picker"><span>${zh?"選擇已儲存訓練":"Choose a saved routine"}</span><select class="select" id="routine-manager-picker"><option value="">${zh?"請選擇要編輯或刪除的訓練":"Choose a routine to edit or delete"}</option>${routines.map(r=>`<option value="${escapeHtml(r.id)}" ${selected?.id===r.id?"selected":""}>${escapeHtml(r.name)}</option>`).join("")}</select></label>` : `<div class="empty-mini">${zh?"還沒有已儲存訓練。":"No saved routines yet."}</div>`;
    const selectedPanel = selected ? `<div class="routine-manager-selected"><div><strong>${escapeHtml(selected.name)}</strong><span>${selected.mode==="circuit"?`${selected.rounds??1} ${zh?"輪":"rounds"} · `:""}${selected.exercises.length} ${zh?"個動作":"exercises"}</span></div><div class="routine-manager-actions"><button class="btn small primary" type="button" data-action="routine-edit-selected">${zh?"編輯":"Edit"}</button><button class="btn small" type="button" data-action="routine-use-selected">${zh?"載入":"Load"}</button><button class="btn small danger" type="button" data-action="routine-delete-selected-one">${zh?"刪除":"Delete"}</button></div></div>` : "";
    const bulk = routines.length > 1 ? `<button class="btn small ghost routine-bulk-toggle" type="button" data-action="routine-toggle-bulk">${this.routineBulkMode?(zh?"關閉多選刪除":"Close multiple selection"):(zh?"多選刪除":"Select multiple to delete")}</button>${this.routineBulkMode?`<div class="routine-bulk-list">${routines.map(r=>`<label><input type="checkbox" data-routine-select="${escapeHtml(r.id)}" ${this.routineDeleteIds.has(r.id)?"checked":""}> ${escapeHtml(r.name)}</label>`).join("")}<button class="btn danger" type="button" data-action="routine-delete-selected" ${this.routineDeleteIds.size?"":"disabled"}>${zh?"刪除勾選項目":"Delete selected"}</button></div>`:""}` : "";
    return `<details class="card routine-manager" data-fold="routine-manager" ${this.folds.has("routine-manager")?"open":""}><summary>${zh?"管理已儲存訓練":"Manage saved routines"} · ${routines.length}</summary><p class="small muted">${zh?"先選擇一個範本；編輯器只會在你按下編輯後顯示。完成紀錄不會被更改。":"Choose a template first. The full editor appears only after you select Edit; completed records stay unchanged."}</p>${selector}${selectedPanel}${bulk}${draft?`<form id="routine-edit-form" class="routine-editor"><h3>${zh?"編輯範本":"Edit template"}</h3><label class="field"><span class="label">${zh?"名稱":"Name"}</span><input class="input" id="routine-edit-name" required maxlength="100" value="${escapeHtml(draft.name)}"></label>${draft.mode==="circuit"?`<label class="field"><span class="label">${zh?"輪數":"Rounds"}</span><input class="input" id="routine-edit-rounds" type="number" min="1" max="10" step="1" required value="${draft.rounds??3}"></label>`:""}${draft.exercises.map((ex,ei)=>`<fieldset class="routine-editor-exercise" data-routine-drag="${ei}"><legend><span class="drag-handle" data-routine-drag-handle="${ei}" role="button" tabindex="0" aria-label="${zh?"拖曳排序":"Drag to reorder"}">⠿</span> ${ei+1}. ${escapeHtml(exerciseById(ex.exerciseId)?.names[this.locale]??ex.exerciseId)}</legend><div class="routine-order">${this.movePositionMenu("routine-position",ei,draft.exercises.length)}<button class="btn small danger" type="button" data-routine-remove-exercise="${ei}">${zh?"移除動作":"Remove exercise"}</button></div><label class="field"><span class="label">${zh?"組間休息秒數":"Rest between sets (seconds)"}</span><input class="input" type="number" min="0" max="3600" step="1" required value="${ex.restSec}" data-routine-rest="${ei}"></label>${(draft.mode==="circuit"?ex.sets.slice(0,1):ex.sets).map((set,si)=>`<div class="routine-editor-set"><strong>${draft.mode==="circuit"?(zh?"每輪":"Each round"):`${zh?"組":"Set"} ${si+1}`}</strong><div class="routine-fields">${fields(set,ex,ei,si)}</div>${draft.mode!=="circuit"&&ex.sets.length>1?`<button class="btn small danger" type="button" data-routine-remove-set="${ei}" data-rs="${si}">${zh?"移除這組":"Remove set"}</button>`:""}</div>`).join("")}${draft.mode!=="circuit"?`<button class="btn" type="button" data-routine-add-set="${ei}">${zh?"新增一組":"Add set"}</button>`:""}</fieldset>`).join("")}<label class="field"><span class="label">${zh?"新增動作":"Add exercise"}</span><select class="select" id="routine-add-exercise">${routineExerciseOptions}</select></label><button class="btn" type="button" data-action="routine-add-exercise">${zh?"新增動作":"Add exercise"}</button><div class="routine-editor-actions"><button class="btn primary" type="submit">${zh?"儲存變更":"Save changes"}</button><button class="btn" type="button" data-action="routine-edit-cancel">${zh?"取消編輯":"Cancel editing"}</button></div></form>`:""}</details>`;
  }

  private bindRoutineManager(): void {
    const zh = this.locale === "zh-TW";
    root.querySelector<HTMLSelectElement>("#routine-manager-picker")?.addEventListener("change",event=>{
      if(this.routineDraft&&!confirm(zh?"捨棄未儲存的範本編輯？":"Discard unsaved template changes?")){(event.currentTarget as HTMLSelectElement).value=this.selectedRoutineManagerId;return;}
      this.selectedRoutineManagerId=(event.currentTarget as HTMLSelectElement).value;
      this.routineDraft=null;
      this.render();
    });
    root.querySelector('[data-action="routine-edit-selected"]')?.addEventListener("click",()=>{const routine=this.state.routines?.find(item=>item.id===this.selectedRoutineManagerId);if(!routine)return;this.routineDraft=structuredClone(routine);this.folds.add("routine-manager");this.render();});
    root.querySelector('[data-action="routine-use-selected"]')?.addEventListener("click",()=>{const routine=this.state.routines?.find(item=>item.id===this.selectedRoutineManagerId);if(!routine)return;if(this.state.activeWorkout?.exercises.length&&!confirm(zh?"以範本取代目前未完成的運動？":"Replace the current unfinished workout with this template?"))return;this.endRest(false);this.state.activeWorkout=workoutFromRoutine(this.state,routine);this.persist();this.render();});
    root.querySelector('[data-action="routine-delete-selected-one"]')?.addEventListener("click",()=>{if(this.selectedRoutineManagerId){this.confirmAction={kind:"delete-routine",id:this.selectedRoutineManagerId};this.render();}});
    root.querySelector('[data-action="routine-toggle-bulk"]')?.addEventListener("click",()=>{this.routineBulkMode=!this.routineBulkMode;if(!this.routineBulkMode)this.routineDeleteIds.clear();this.render();});
    root.querySelectorAll<HTMLInputElement>("[data-routine-select]").forEach(el=>el.addEventListener("change",()=>{if(el.checked)this.routineDeleteIds.add(el.dataset.routineSelect!);else this.routineDeleteIds.delete(el.dataset.routineSelect!);this.render();}));
    root.querySelector('[data-action="routine-delete-selected"]')?.addEventListener("click",()=>{const count=this.routineDeleteIds.size;if(!count)return;if(!confirm(zh?`刪除 ${count} 個範本？完成紀錄不受影響。`:`Delete ${count} templates? Completed records stay unchanged.`))return;this.state.routines=this.state.routines?.filter(r=>!this.routineDeleteIds.has(r.id));if(this.routineDraft&&this.routineDeleteIds.has(this.routineDraft.id))this.routineDraft=null;if(this.routineDeleteIds.has(this.selectedRoutineManagerId))this.selectedRoutineManagerId="";this.routineDeleteIds.clear();this.routineBulkMode=false;this.persist();this.render();});
    const draft=this.routineDraft;if(!draft)return;
    root.querySelector<HTMLInputElement>("#routine-edit-name")?.addEventListener("input",event=>{draft.name=(event.target as HTMLInputElement).value;});
    root.querySelector<HTMLInputElement>("#routine-edit-rounds")?.addEventListener("input",event=>{const el=event.target as HTMLInputElement;if(el.checkValidity())draft.rounds=Number(el.value);});
    root.querySelectorAll<HTMLInputElement>("[data-routine-rest]").forEach(el=>el.addEventListener("input",()=>{if(el.checkValidity())draft.exercises[Number(el.dataset.routineRest)]!.restSec=Number(el.value);}));
    root.querySelectorAll<HTMLInputElement|HTMLSelectElement>("[data-routine-field]").forEach(el=>el.addEventListener("change",()=>{if(!el.checkValidity())return;const set=draft.exercises[Number(el.dataset.re)]!.sets[Number(el.dataset.rs)]!;const key=el.dataset.routineField!;if(!el.value){delete (set as any)[key];return;}(set as any)[key]=["side","setType"].includes(key)?el.value:Number(el.value);}));
    root.querySelectorAll<HTMLSelectElement>("[data-routine-position]").forEach(select=>select.addEventListener("change",()=>{const from=Number(select.dataset.routinePosition),to=Number(select.value);if(!Number.isInteger(from)||!Number.isInteger(to)||from===to)return;const [moved]=draft.exercises.splice(from,1);if(moved)draft.exercises.splice(to,0,moved);this.render();}));
    this.bindSmoothReorder("[data-routine-drag]","[data-routine-drag-handle]",(from,to)=>{const [moved]=draft.exercises.splice(from,1);if(moved)draft.exercises.splice(to,0,moved);this.render();});
    root.querySelectorAll<HTMLElement>("[data-routine-remove-exercise]").forEach(el=>el.addEventListener("click",()=>{draft.exercises.splice(Number(el.dataset.routineRemoveExercise),1);this.render();}));
    root.querySelectorAll<HTMLElement>("[data-routine-remove-set]").forEach(el=>el.addEventListener("click",()=>{draft.exercises[Number(el.dataset.routineRemoveSet)]!.sets.splice(Number(el.dataset.rs),1);this.render();}));
    root.querySelectorAll<HTMLElement>("[data-routine-add-set]").forEach(el=>el.addEventListener("click",()=>{const ex=draft.exercises[Number(el.dataset.routineAddSet)]!;ex.sets.push(structuredClone(ex.sets.at(-1)??{reps:8}));this.render();}));
    root.querySelector('[data-action="routine-add-exercise"]')?.addEventListener("click",()=>{const id=root.querySelector<HTMLSelectElement>("#routine-add-exercise")?.value;const def=exerciseById(id??"");if(!def)return;const profile=exerciseScienceLoggingProfile(def);const defaults=exerciseStarterDefault(def);const timed=workTargetSeconds({durationSec:1} as SetEntry,profile)>0;draft.exercises.push({exerciseId:def.id,restSec:defaults.restSec??60,recordingProfile:profile,recordingProfileVersion:2,sets:[timed?{durationSec:defaults.durationSec??(defaults.minutes??1)*60}:{reps:defaults.reps??8}]});this.render();});
    root.querySelector('[data-action="routine-edit-cancel"]')?.addEventListener("click",()=>{if(confirm(zh?"捨棄未儲存的變更？":"Discard unsaved changes?")){this.routineDraft=null;this.render();}});
    root.querySelector<HTMLFormElement>("#routine-edit-form")?.addEventListener("submit",event=>{event.preventDefault();if(!draft.name.trim()||!draft.exercises.length){this.toast(zh?"請填寫名稱並保留至少一個動作":"Enter a name and keep at least one exercise");return;}draft.name=draft.name.trim();const i=this.state.routines?.findIndex(r=>r.id===draft.id)??-1;if(i<0)return;this.state.routines![i]=structuredClone(draft);this.routineDraft=null;this.persist();this.render();this.toast(this.text("routineSaved"));});
  }

  private renderWorkoutScienceGuidance(): string {
    const definition = exerciseById(this.pendingExerciseId) ?? EXERCISES[0]!;
    const previousEntry = this.latestCompatibleExerciseEntry(definition);
    const previous = previousEntry?.sets.slice().reverse().find(set => set.completed);
    const starter = !previousEntry ? `<div class="science-starter"><strong>${this.locale==="zh-TW"?"科學化起始建議":"Science-informed starter"}</strong><span>${this.locale==="zh-TW"?"這只是一般健康成人的保守起點；有歷史紀錄後會優先使用你的上次設定。":"A conservative general-adult starting point; once history exists, your recent setup takes priority."}</span></div>` : "";
    const previousHint = previous ? `<div class="composer-previous">${escapeHtml(this.text("previous"))}: <strong>${escapeHtml(this.setSummary(definition, previous, previousEntry))}</strong></div>` : "";
    const progression = this.progressionHint(definition);
    return `<section class="section workout-science-guidance"><div class="science-guidance-label">${this.locale==="zh-TW"?"科學化提示":"Science guidance"} · ${escapeHtml(definition.names[this.locale])}</div>${starter}${previousHint}<div class="science-progression-hint"><strong>${this.locale==="zh-TW"?"下一步":"Next-step guidance"}</strong><span>${escapeHtml(progression)}</span></div></section>`;
  }

  private renderWorkout(): string {
    const workout = this.state.activeWorkout;
    if (!workout) { queueMicrotask(() => this.navigate("home")); return ""; }
    const canRepeat = this.state.workouts.some(item => item.completedAt);
    const editingExisting = this.state.workouts.some(item => item.id === workout.id);

    const isCircuit = workout.routineMode === "circuit";
    const choosingCircuit = !editingExisting && !isCircuit && workout.exercises.length === 0 && this.workoutComposerMode === "circuit";
    const body = choosingCircuit ? "" : workout.exercises.length === 0
      ? `<div class="empty-workout"><div class="empty-icon">${icon("dumbbell")}</div><div class="strong">${escapeHtml(this.text("noExercises"))}</div><div class="medium muted">${escapeHtml(this.text("noExercisesHint"))}</div>${canRepeat ? `<button class="btn" data-action="repeat-last">${escapeHtml(this.text("repeatLast"))}</button>` : ""}</div>`
      : isCircuit ? this.renderCircuitRounds(workout) : workout.exercises.map((exercise, exerciseIndex) => this.renderActiveExercise(workout, exercise, exerciseIndex)).join("");
    return `<div class="workout-header"><button class="btn ghost touch" data-action="back-workout">${icon("back")} ${escapeHtml(this.text("back"))}</button><div class="save-status"><span class="save-dot"></span>${escapeHtml(editingExisting ? this.text("historicalEdit") : this.text("liveWorkout"))}</div></div>
      <div class="workout-title-row"><div class="field workout-name-field"><label>${escapeHtml(this.text("workoutName"))}</label><div class="workout-name-edit-row"><input class="title-input" id="workout-name" maxlength="60" value="${escapeHtml(workout.routineName)}"><button class="icon-btn workout-name-pencil" type="button" data-action="edit-workout-name" aria-label="${this.locale === "zh-TW" ? "編輯運動名稱" : "Edit workout name"}" title="${this.locale === "zh-TW" ? "編輯名稱" : "Edit name"}">${icon("pencil")}</button></div>${!editingExisting ? `<div class="workout-draft-actions"><button class="btn small ghost danger" type="button" data-action="discard-workout">${this.locale === "zh-TW" ? "捨棄這次運動" : "Discard workout"}</button><span class="tiny muted">${this.locale === "zh-TW" ? "清除目前草稿並回到首頁" : "Clear this draft and return Home"}</span></div>` : ""}</div></div>
      ${editingExisting ? `<div class="edit-mode-banner">${escapeHtml(this.text("historicalEdit"))}. ${this.locale === "zh-TW" ? "修改紀錄不會啟動休息計時；儲存後會標示為已編輯。" : "Editing saved records never starts a rest timer; saved changes are marked as edited."}</div><div class="card historical-time-editor"><div class="form-two"><label class="field"><span>${this.locale === "zh-TW" ? "開始日期與時間" : "Start date & time"}</span><input class="input date-input" id="workout-start-at" type="datetime-local" max="${this.toDateTimeLocal(new Date().toISOString())}" value="${escapeHtml(this.toDateTimeLocal(workout.startedAt))}"></label><label class="field"><span>${this.locale === "zh-TW" ? "結束日期與時間" : "End date & time"}</span><input class="input date-input" id="workout-end-at" type="datetime-local" max="${this.toDateTimeLocal(new Date().toISOString())}" value="${escapeHtml(this.toDateTimeLocal(workout.completedAt ?? undefined))}"></label></div>${workout.editedAt ? `<div class="tiny edited-note">${escapeHtml(this.editedText(workout.editedAt))}</div>` : ""}</div>` : ""}
      ${!editingExisting && !isCircuit && workout.exercises.length === 0 ? `<section class="section card workout-kind-card"><label class="field"><span>${this.locale === "zh-TW" ? "開始方式" : "Workout type"}</span><select class="select" id="workout-composer-mode"><option value="workout" ${this.workoutComposerMode === "workout" ? "selected" : ""}>${this.locale === "zh-TW" ? "一般運動" : "Workout"}</option><option value="circuit" ${this.workoutComposerMode === "circuit" ? "selected" : ""}>${this.locale === "zh-TW" ? "循環訓練" : "Circuit"}</option></select></label><p class="small muted">${this.locale === "zh-TW" ? "只顯示你選擇的建立方式，減少畫面干擾。" : "Only the selected builder is shown."}</p></section>` : ""}
      ${isCircuit ? `<div class="circuit-mode-banner"><strong>${this.locale === "zh-TW" ? "循環訓練" : "Circuit"}</strong><span>${workout.circuitRounds ?? 1} ${this.locale === "zh-TW" ? "輪：每輪依序完成所有動作。" : "rounds: complete every movement in order, then repeat."}</span></div>` : ""}
      ${body}
      ${isCircuit || choosingCircuit ? "" : `<section class="section"><details class="compact-fold card" data-fold="exercise" ${this.folds.has("exercise")?"open":""}><summary>${this.locale==="zh-TW"?"新增動作":"Add exercise"} ▾</summary>${this.renderExerciseComposer()}</details></section>`}
      ${choosingCircuit ? `<section class="section circuit-builder-section">${this.renderCircuitBuilder()}</section>`:""}
      ${!editingExisting ? `<section class="section routine-manager-section">${this.renderRoutineManager()}</section>` : ""}
      <section class="section"><div class="card media-upload-card"><div><strong>${this.locale === "zh-TW" ? "運動照片（選填）" : "Workout photo (optional)"}</strong><div class="small muted">${this.locale === "zh-TW" ? "測試版只存在這台裝置；圖片會壓縮並移除相機 EXIF 中繼資料。" : "Demo-only local storage. Images are compressed and re-encoded, stripping camera EXIF metadata."}</div></div>${workout.photoId ? this.privateImage(workout.photoId,"workout-photo-preview",workout.routineName) : ""}<label class="btn small file-button">${workout.photoId ? (this.locale === "zh-TW" ? "更換照片" : "Replace photo") : (this.locale === "zh-TW" ? "選擇照片" : "Choose photo")}<input id="workout-photo-input" type="file" accept="image/*" hidden></label></div></section>
      <div class="field section"><label>${escapeHtml(this.text("notes"))}</label><textarea class="textarea" id="workout-notes" maxlength="600" placeholder="${this.locale === "zh-TW" ? "選填" : "Optional"}">${escapeHtml(workout.notes)}</textarea></div>
      ${!isCircuit && !choosingCircuit ? this.renderWorkoutScienceGuidance() : ""}
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
      const removeRound = !editingExisting && rounds > 1
        ? `<button class="btn small ghost danger" data-remove-circuit-round="${roundIndex}">${this.locale === "zh-TW" ? "刪除這輪" : "Remove round"}</button>`
        : "";
      return `<section class="exercise-card circuit-round"><div class="exercise-head"><div><div class="exercise-name">${this.locale === "zh-TW" ? `第 ${roundIndex+1} 輪` : `Round ${roundIndex+1}`}</div><div class="exercise-rest">${workout.exercises.length} ${escapeHtml(this.text("exercises"))}</div></div>${removeRound}</div><div class="circuit-round-list">${workout.exercises.map((exercise,exerciseIndex)=>this.renderCircuitMovement(workout,exercise,exerciseIndex,roundIndex)).join("")}</div>${roundEffort}</section>`;
    }).join("");
  }

  private renderScienceSetFields(workout: WorkoutRecord, definition: ExerciseDefinition | undefined, exercise: WorkoutExerciseEntry, exerciseIndex: number, setIndex: number, set: SetEntry): string {
    if (!definition) return "";
    if (set.completed && set.actualDurationSec !== undefined) set = {...set, durationSec: set.actualDurationSec};
    const profile = exerciseEntryLoggingProfile(exercise, definition);
    const metrics = exerciseSessionMetricFlags(definition);
    const input = (field: string, label: string, value: number | string | undefined, opts = "") => `<label class="mini-field"><span>${escapeHtml(label)}</span><input class="set-input" type="number" ${opts} value="${value ?? ""}" data-set-field="${field}" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}"></label>`;
    const side = exerciseLaterality(definition) !== "none"
      ? `<label class="mini-field"><span>${this.locale === "zh-TW" ? "側" : "Side"}</span><select class="select mini-select" data-set-side="1" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}"><option value="both" ${(set.side ?? "both") === "both" ? "selected" : ""}>${this.locale === "zh-TW" ? "雙側" : "Both"}</option><option value="left" ${set.side === "left" ? "selected" : ""}>${this.locale === "zh-TW" ? "左" : "Left"}</option><option value="right" ${set.side === "right" ? "selected" : ""}>${this.locale === "zh-TW" ? "右" : "Right"}</option></select></label>`
      : "";

    if (profile === "loaded_carry") {
      return [
        input("loadPerHand", this.locale === "zh-TW" ? "每手 kg" : "kg / hand", set.loadPerHandKg, 'min="0" step="0.5" inputmode="decimal"'),
        input("distanceM", this.locale === "zh-TW" ? "公尺" : "metres", set.distanceKm !== undefined ? Math.round(set.distanceKm * 1000) : undefined, 'min="0" step="1" inputmode="numeric"'),
        input("duration", this.text("seconds"), set.durationSec, 'min="0" step="1" inputmode="numeric"')
      ].join("");
    }
    if (profile === "static_stretch") return input("duration", this.text("seconds"), set.durationSec, 'min="0" step="1" inputmode="numeric"') + side;
    if (profile === "dynamic_mobility") return input("reps", this.text("reps"), set.reps, 'min="0" step="1" inputmode="numeric"') + input("targetWork", this.locale === "zh-TW" ? "目標秒" : "Work s", set.targetWorkSec, 'min="0" max="1800" step="1" inputmode="numeric" placeholder="—"') + side;
    if (profile === "conditioning_intervals" || profile === "sprint_intervals") {
      const pieces: string[] = [];
      if (set.reps !== undefined || definition.id === "jump_squat" || definition.id.startsWith("jump_rope_")) pieces.push(input("reps", definition.id.startsWith("jump_rope_") ? (this.locale === "zh-TW" ? "成功跳數" : "Successful jumps") : this.text("reps"), set.reps, 'min="0" step="1" inputmode="numeric"'));
      if (set.durationSec !== undefined || definition.id !== "jump_squat") pieces.push(input("duration", this.text("seconds"), set.durationSec, 'min="0" step="1" inputmode="numeric"'));
      if (metrics.distance || set.distanceKm !== undefined) pieces.push(input("distanceM", this.locale === "zh-TW" ? "公尺" : "metres", set.distanceKm !== undefined ? Math.round(set.distanceKm * 1000) : undefined, 'min="0" step="1" inputmode="numeric"'));
      return pieces.join("");
    }
    if (profile === "isometric_sets" || profile === "balance_hold") return input("duration", this.text("seconds"), set.durationSec, 'min="0" step="1" inputmode="numeric"');
    if (profile === "rounds" || profile === "skill_drill" || profile === "water_skill") {
      const pieces: string[] = [];
      if (set.durationSec !== undefined || profile !== "water_skill" || !["surface_dive","brick_retrieval"].includes(definition.id)) pieces.push(input("duration", this.text("seconds"), set.durationSec, 'min="0" step="1" inputmode="numeric"'));
      if (set.reps !== undefined || ["surface_dive","brick_retrieval"].includes(definition.id)) pieces.push(input("reps", this.text("reps"), set.reps, 'min="0" step="1" inputmode="numeric"'));
      if (metrics.distance && !["surface_dive","brick_retrieval"].includes(definition.id)) pieces.push(input("distanceM", this.locale === "zh-TW" ? "公尺" : "metres", set.distanceKm !== undefined ? Math.round(set.distanceKm * 1000) : undefined, 'min="0" step="1" inputmode="numeric"'));
      return pieces.join("");
    }
    if (["cardio_session","swim_session","yoga_flow","mobility_session"].includes(profile)) {
      const pieces: string[] = [input("minutes", this.text("minutes"), set.durationSec !== undefined ? Math.round(set.durationSec / 60) : undefined, 'min="0" step="1" inputmode="numeric"')];
      if (metrics.distance) pieces.push(input("distance", "km", set.distanceKm, 'min="0" step="0.01" inputmode="decimal"'));
      if (metrics.speed) pieces.push(input("speed", "km/h", set.speedKph, 'min="0" max="80" step="0.1" inputmode="decimal"'));
      if (metrics.incline) pieces.push(input("incline", this.locale === "zh-TW" ? "坡度 %" : "Incline %", set.inclinePct ?? 0, 'min="-10" max="40" step="0.5" inputmode="decimal"'));
      if (metrics.resistance) pieces.push(input("resistance", this.locale === "zh-TW" ? "阻力" : "Level", set.resistanceLevel, 'min="0" max="100" step="1" inputmode="numeric"'));
      if (metrics.laps) pieces.push(input("laps", this.locale === "zh-TW" ? "趟" : "Laps", set.laps, 'min="0" step="1" inputmode="numeric"'));
      if (metrics.cadence) pieces.push(input("cadence", this.locale === "zh-TW" ? "踏頻 rpm" : "Cadence rpm", set.cadenceRpm, 'min="0" step="1" inputmode="numeric"'));
      if (metrics.strokeRate) pieces.push(input("strokeRate", this.locale === "zh-TW" ? "划頻 /min" : "Stroke rate /min", set.strokeRateSpm, 'min="0" step="1" inputmode="numeric"'));
      if (metrics.pace500) pieces.push(input("pace500", this.locale === "zh-TW" ? "500m 配速（秒）" : "500m pace (sec)", set.pace500Sec, 'min="0" step="1" inputmode="numeric"'));
      if (metrics.vertical) pieces.push(input("vertical", this.locale === "zh-TW" ? "爬升 m" : "Vertical m", set.verticalGainM, 'min="0" step="1" inputmode="numeric"'));
      if (metrics.packWeight) pieces.push(input("packWeight", this.locale === "zh-TW" ? "背包 kg" : "Pack kg", set.packWeightKg, 'min="0" step="0.5" inputmode="decimal"'));
      return pieces.join("");
    }
    if (definition.type === "weight_reps") return input("weight", this.text("weight"), set.weightKg, 'min="0" step="0.5" inputmode="decimal"') + input("reps", this.text("reps"), set.reps, 'min="0" step="1" inputmode="numeric"') + input("targetWork", this.locale === "zh-TW" ? "目標秒" : "Work s", set.targetWorkSec, 'min="0" max="1800" step="1" inputmode="numeric" placeholder="—"');
    if (definition.type === "reps") return input("reps", this.text("reps"), set.reps, 'min="0" step="1" inputmode="numeric"') + input("targetWork", this.locale === "zh-TW" ? "目標秒" : "Work s", set.targetWorkSec, 'min="0" max="1800" step="1" inputmode="numeric" placeholder="—"');
    if (definition.type === "duration") return input("duration", this.text("seconds"), set.durationSec, 'min="0" step="1" inputmode="numeric"');
    return input("distance", "km", set.distanceKm, 'min="0" step="0.1" inputmode="decimal"') + input("minutes", this.text("minutes"), set.durationSec !== undefined ? Math.round(set.durationSec / 60) : undefined, 'min="0" step="1" inputmode="numeric"');
  }

  private renderCircuitMovement(workout: WorkoutRecord, exercise: WorkoutExerciseEntry, exerciseIndex: number, roundIndex: number): string {
    const definition = exerciseById(exercise.exerciseId);
    const set = exercise.sets[roundIndex];
    if (!set) return "";
    const name = definition?.names[this.locale] ?? exercise.exerciseId;
    const durationText = this.setDurationText(set);
    const field = this.renderScienceSetFields(workout, definition, exercise, exerciseIndex, roundIndex, set);
    const editingExisting = this.state.workouts.some(item => item.id === workout.id);
    const locked = !editingExisting && set.completed && this.completedSetIsLocked(workout,set);
    const nextStart = editingExisting ? null : this.nextStartableSet(workout);
    const canStart = Boolean(nextStart && nextStart.exerciseIndex === exerciseIndex && nextStart.setIndex === roundIndex);
    const startHint = canStart ? "" : (this.locale === "zh-TW" ? "請依循環順序完成前一個項目" : "Complete the previous circuit item first");
    const control = editingExisting ? "" : set.skipped
      ? `<span class="set-state-skipped">${this.locale === "zh-TW" ? "已略過" : "Skipped"}</span>`
      : !set.startedAt && !set.completed
        ? (canStart
          ? `<div class="set-flow-actions"><button class="btn small primary set-state-btn start" data-start-set="1" data-exercise-index="${exerciseIndex}" data-set-index="${roundIndex}">${this.locale === "zh-TW" ? "開始" : "Start"}</button><button class="btn small ghost set-skip-btn" data-skip-set="1" data-exercise-index="${exerciseIndex}" data-set-index="${roundIndex}">${this.locale === "zh-TW" ? "略過" : "Skip"}</button></div>`
          : `<button class="btn small primary set-state-btn start" disabled title="${escapeHtml(startHint)}">${this.locale === "zh-TW" ? "開始" : "Start"}</button>`)
        : !set.completed
          ? `<button class="btn small primary set-state-btn" data-toggle-set="1" data-exercise-index="${exerciseIndex}" data-set-index="${roundIndex}">${this.locale === "zh-TW" ? "完成" : "Finish"}</button>`
          : `<button class="btn small set-state-btn done ${locked ? "locked" : ""}" data-toggle-set="1" data-exercise-index="${exerciseIndex}" data-set-index="${roundIndex}" ${locked ? "disabled" : ""} title="${locked ? (this.locale === "zh-TW" ? "後續動作已開始，因此已鎖定" : "Locked because a later set has started") : ""}">${icon("check")} ${this.locale === "zh-TW" ? "完成" : "Done"}</button>`;
    const timingLine = set.startedAt
      ? `<small>${this.locale === "zh-TW" ? "開始" : "Started"} ${escapeHtml(this.formatTime(set.startedAt))}</small>${durationText ? `<small>${escapeHtml(this.text("duration"))} ${escapeHtml(durationText)}</small>` : ""}`
      : (this.previousSet(workout,exercise.exerciseId,roundIndex) ? `<small>${this.locale === "zh-TW" ? "上次" : "Last"}: ${escapeHtml(this.setSummary(definition,this.previousSet(workout,exercise.exerciseId,roundIndex)))}</small>` : "");
    return `<div class="circuit-movement ${set.completed ? "completed" : ""} ${set.skipped ? "skipped" : ""}"><div class="circuit-movement-name"><div class="row-start"><strong>${escapeHtml(name)}</strong>${!editingExisting ? `<button class="icon-btn subtle-danger circuit-remove-movement" data-remove-circuit-movement="${exerciseIndex}" aria-label="${this.locale === "zh-TW" ? "刪除動作" : "Remove movement"}">${icon("trash")}</button>` : ""}</div>${definition ? `<small>${escapeHtml(this.exercisePreviewHint(definition))} · <a class="exercise-example-link" href="${escapeHtml(this.exerciseImageSearchUrl(definition))}" target="_blank" rel="noopener noreferrer">${this.locale === "zh-TW" ? "圖片示範" : "Image examples"}</a></small>` : ""}${timingLine}</div><div class="set-fields">${field}</div>${control}</div>`;
  }

  private renderActiveExercise(workout: WorkoutRecord, exercise: WorkoutExerciseEntry, exerciseIndex: number): string {
    const definition = exerciseById(exercise.exerciseId);
    const name = definition?.names[this.locale] ?? exercise.exerciseId;
    const profile = definition ? exerciseEntryLoggingProfile(exercise, definition) : "sets";
    const focus = this.exerciseFocusText(definition);
    const allCompleted = exercise.sets.length > 0 && exercise.sets.every(set => this.setResolved(set)) && exercise.sets.some(set => set.completed);
    const difficultyLabels = [this.text("veryEasy"), this.text("easy"), this.text("moderate"), this.text("hard"), this.text("veryHard")];
    const editingExisting = this.state.workouts.some(item => item.id === workout.id);
    const canReorder = !editingExisting && !this.workoutHasStarted(workout);
    const workApplicable = profile === "sets" || profile === "skill_sets" || profile === "dynamic_mobility";
    const workTarget = exercise.sets.find(set => !set.completed && !set.skipped)?.targetWorkSec ?? exercise.sets[0]?.targetWorkSec ?? 0;
    const restControl = this.profileUsesRest(profile)
      ? (editingExisting
        ? `<div class="exercise-rest">${workApplicable ? `${this.locale === "zh-TW" ? "工作" : "Work"}: ${workTarget || "—"}s · ` : ""}${escapeHtml(this.text("rest"))}: ${exercise.restSec}s</div>`
        : `<div class="exercise-timing-controls">${workApplicable ? `<label class="inline-rest-control"><span>${this.locale === "zh-TW" ? "工作" : "Work"}</span><input type="number" min="0" max="1800" step="1" value="${workTarget || ""}" data-work-target-sec="${exerciseIndex}" placeholder="—"><small>${this.locale === "zh-TW" ? "秒 · 空白 = 正計時" : "sec · blank = count up"}</small></label>` : ""}<label class="inline-rest-control"><span>${escapeHtml(profile === "rounds" ? (this.locale === "zh-TW" ? "回合間休息" : "Round rest") : this.text("rest"))}</span><input type="number" min="0" max="900" step="1" value="${exercise.restSec}" data-rest-sec="${exerciseIndex}"><small>${this.locale === "zh-TW" ? "秒 · 0 = 不啟動計時" : "sec · 0 = no rest timer"}</small></label></div>`)
      : "";
    const addControl = this.profileRepeats(profile)
      ? `<button class="btn small touch" data-add-set="${exerciseIndex}">${icon("plus")} ${profile === "rounds" ? (this.locale === "zh-TW" ? "新增回合" : "Add round") : escapeHtml(this.text("addSet"))}</button>`
      : "";
    return `<section class="exercise-card regular-workout-card ${profile !== "sets" ? "session-exercise-card" : ""}" ${canReorder ? `data-workout-exercise-drag="${exerciseIndex}"` : ""}>
      <div class="exercise-head"><div class="exercise-head-main"><div class="row-start">${canReorder ? `<button type="button" class="drag-handle-button" data-workout-exercise-drag-handle="${exerciseIndex}" aria-label="${this.locale === "zh-TW" ? "拖曳排序" : "Drag to reorder"}">⠿</button>` : ""}<div class="exercise-name">${exerciseIndex+1}. ${escapeHtml(name)}</div>${canReorder ? this.movePositionMenu("workout-position",exerciseIndex,workout.exercises.length) : ""}${!editingExisting ? `<button class="icon-btn subtle-danger exercise-remove-compact" data-remove-exercise="${exerciseIndex}" aria-label="${escapeHtml(this.text("removeExercise"))}" title="${escapeHtml(this.text("removeExercise"))}">${icon("trash")}</button>` : ""}</div>${definition ? `<div class="exercise-meta-line">${escapeHtml(this.exercisePreviewHint(definition))} · <a class="exercise-example-link" href="${escapeHtml(this.exerciseImageSearchUrl(definition))}" target="_blank" rel="noopener noreferrer">${this.locale === "zh-TW" ? "圖片示範" : "Image examples"}</a></div>${focus ? `<div class="exercise-focus-line">${escapeHtml(focus)}</div>` : ""}` : ""}${restControl}${exercise.startedAt ? `<div class="tiny muted">${this.formatTime(exercise.startedAt)}${exercise.completedAt ? `–${this.formatTime(exercise.completedAt)}` : ""}</div>` : ""}</div>${editingExisting ? `<button class="icon-btn danger" data-remove-exercise="${exerciseIndex}" aria-label="${escapeHtml(this.text("removeExercise"))}" title="${escapeHtml(this.text("removeExercise"))}">${icon("trash")}</button>` : ""}</div>
      <div class="set-list regular-set-list">${exercise.sets.map((set, setIndex) => this.renderSetRow(workout, definition, exerciseIndex, setIndex, set)).join("")}</div>
      ${allCompleted ? `<div class="effort-prompt"><div><strong>${escapeHtml(this.text("effortPrompt"))}</strong><span>${this.locale === "zh-TW" ? "1 = 很輕鬆，5 = 非常吃力" : "1 = very easy, 5 = very hard"}</span></div><div class="effort-scale">${difficultyLabels.map((label,index)=>`<button class="effort-btn ${exercise.difficulty === index+1 ? "selected" : ""}" data-difficulty="${index+1}" data-exercise-index="${exerciseIndex}" title="${escapeHtml(label)}">${index+1}</button>`).join("")}</div>${exercise.difficulty ? `<div class="small muted">${escapeHtml(difficultyLabels[exercise.difficulty-1] ?? "")}</div>` : ""}</div>` : ""}
      ${addControl ? `<div class="exercise-actions">${addControl}</div>` : ""}
    </section>`;
  }

  private renderSetRow(workout: WorkoutRecord, definition: ExerciseDefinition | undefined, exerciseIndex: number, setIndex: number, set: SetEntry): string {
    const exercise = workout.exercises[exerciseIndex];
    if (!exercise) return "";
    const profile = definition ? exerciseEntryLoggingProfile(exercise, definition) : "sets";
    const fields = this.renderScienceSetFields(workout, definition, exercise, exerciseIndex, setIndex, set);
    const previous = this.previousSet(workout, exercise.exerciseId, setIndex);
    const previousText = this.setSummary(definition, previous, exercise);
    const durationText = this.setDurationText(set);
    const editingExisting = this.state.workouts.some(item => item.id === workout.id);
    const locked = !editingExisting && set.completed && this.completedSetIsLocked(workout, set);
    const nextStart = editingExisting ? null : this.nextStartableSet(workout);
    const canStart = Boolean(nextStart && nextStart.exerciseIndex === exerciseIndex && nextStart.setIndex === setIndex);
    const startHint = canStart ? "" : (this.locale === "zh-TW" ? "請先完成前一組／前一個動作" : "Complete the previous set or exercise first");
    const completionControl = editingExisting ? "" : set.skipped
      ? `<span class="set-state-skipped">${this.locale === "zh-TW" ? "已略過" : "Skipped"}</span>`
      : !set.startedAt && !set.completed
        ? (canStart
          ? `<div class="set-flow-actions"><button class="btn small primary set-state-btn start" data-start-set="1" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}">${this.locale === "zh-TW" ? "開始" : "Start"}</button><button class="btn small ghost set-skip-btn" data-skip-set="1" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}">${this.locale === "zh-TW" ? "略過" : "Skip"}</button></div>`
          : `<button class="btn small primary set-state-btn start" disabled title="${escapeHtml(startHint)}">${this.locale === "zh-TW" ? "開始" : "Start"}</button>`)
        : !set.completed
          ? `<button class="btn small primary set-state-btn" data-toggle-set="1" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}">${this.locale === "zh-TW" ? "完成" : "Finish"}</button>`
          : `<button class="btn small set-state-btn done ${locked ? "locked" : ""}" data-toggle-set="1" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}" ${locked ? "disabled" : ""} title="${locked ? (this.locale === "zh-TW" ? "下一組已開始，因此這組已鎖定" : "Locked because a later set has started") : (this.locale === "zh-TW" ? "點一下可改回未完成" : "Tap to mark unfinished")}">${icon("check")} ${this.locale === "zh-TW" ? "完成" : "Done"}</button>`;
    const timing = set.skipped
      ? `<div class="previous-line skipped-line"><span>${this.locale === "zh-TW" ? "略過" : "Skipped"}</span>${set.skippedAt ? ` ${escapeHtml(this.formatTime(set.skippedAt))}` : ""}</div>`
      : set.startedAt
        ? `<div class="previous-line"><span>${this.locale === "zh-TW" ? "開始" : "Started"}</span> ${escapeHtml(this.formatTime(set.startedAt))}</div>${durationText ? `<div class="set-duration-line"><span>${escapeHtml(this.text("duration"))}</span> ${escapeHtml(durationText)}</div>` : ""}`
        : `<div class="previous-line"><span>${escapeHtml(this.text("previous"))}</span> ${escapeHtml(previousText)}</div>`;
    const removalKey = `${exerciseIndex}:${setIndex}`;
    const running = workout.exercises.some(item => item.sets.some(candidate => Boolean(candidate.startedAt)));
    const canRemove = this.profileRepeats(profile) && (editingExisting || !set.completed);
    const removalControl = !canRemove ? `<span class="set-remove-slot" aria-hidden="true"></span>`
      : this.pendingSetRemovalKey === removalKey
        ? `<button class="btn small danger-solid set-remove-confirm" data-remove-set="1" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}">${this.locale === "zh-TW" ? "再按一次" : "Confirm"}</button>`
        : `<button class="icon-btn subtle-danger set-remove-icon" data-remove-set="1" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}" data-running="${running ? "1" : "0"}" aria-label="${this.locale === "zh-TW" ? "移除此項" : "Remove item"}" title="${this.locale === "zh-TW" ? "移除此項" : "Remove item"}">${icon("trash")}</button>`;
    const labelMap: Record<string,string> = { rounds:"R", cardio_session:"C", swim_session:"S", yoga_flow:"Y", mobility_session:"M", static_stretch:"M", dynamic_mobility:"M", loaded_carry:"C", conditioning_intervals:"I", sprint_intervals:"I", water_skill:"W", skill_drill:"D", isometric_sets:"H", skill_sets:"S" };
    const rowLabel = workout.routineMode === "circuit" ? `R${setIndex + 1}` : labelMap[profile] ? `${labelMap[profile]}${this.profileRepeats(profile) ? setIndex + 1 : ""}` : String(setIndex + 1);
    return `<div class="set-row compact-set-row ${profile !== "sets" ? "session-set-row" : ""} ${set.completed ? "completed" : ""} ${set.skipped ? "skipped" : ""} ${editingExisting ? "history-edit-set" : ""}">
      <div class="set-number" title="${escapeHtml(this.profileLabel(profile))}">${rowLabel}</div>
      <div class="set-remove-left">${removalControl}</div>
      <div class="set-content">${timing}<div class="set-fields ${["cardio_session","swim_session","yoga_flow"].includes(profile) ? "session-metric-fields" : ""}">${fields}</div></div>
      ${completionControl}
    </div>`;
  }

  private manualActivityOptions(): string {
    const commonIds = ["run","cycling","walk","trail_running","swim_freestyle","swim_breaststroke","swim_backstroke","jump_rope_basic","rowing_machine","stair_climber"];
    const common = commonIds.map(id=>exerciseById(id)).filter((item): item is ExerciseDefinition => Boolean(item));
    const commonSet = new Set(common.map(item=>item.id));
    const groups = LIBRARY_GROUP_ORDER.map(group=>({ group, items: EXERCISES.filter(exercise=>exercise.id!=="hiking_cardio" && !commonSet.has(exercise.id) && exerciseLibraryGroup(exercise)===group) })).filter(item=>item.items.length);
    const option = (exercise:ExerciseDefinition) => `<option value="${escapeHtml(exercise.id)}" ${exercise.id===this.manualActivityExerciseId?"selected":""}>${escapeHtml(exercise.names[this.locale])}</option>`;
    return `<optgroup label="${this.locale === "zh-TW" ? "專用健行紀錄" : "Dedicated hike record"}"><option value="__hike__" ${this.manualActivityExerciseId==="__hike__"?"selected":""}>${this.locale === "zh-TW" ? "健行／登山（使用健行紀錄）" : "Hiking / trail walk (use hike record)"}</option></optgroup><optgroup label="${this.locale === "zh-TW" ? "常見外部追蹤活動" : "Common externally tracked activities"}">${common.map(option).join("")}</optgroup>${groups.map(({group,items})=>`<optgroup label="${escapeHtml(this.exerciseLibraryGroupLabel(group))}">${items.map(option).join("")}</optgroup>`).join("")}`;
  }

  private renderActivity(): string {
    const zh=this.locale === "zh-TW";
    if(this.manualActivityExerciseId === "__hike__") {
      return `<div class="activity-log-header"><button class="btn ghost touch" data-action="back-home">${icon("back")} ${zh?"返回":"Back"}</button></div><h1 class="page-title">${zh?"補登已完成運動":"Log completed activity"}</h1><p class="page-subtitle">${zh?"已經用 Apple、Garmin、Strava、泳池計時器或其他 App 記錄？把核心數據補進 LogTogether，仍使用相同科學與任務規則。":"Already tracked it with Apple, Garmin, Strava, a pool clock or another app? Add the core data here and LogTogether applies the same science and mission rules."}</p><section class="section"><div class="card activity-log-card"><label class="field"><span>${zh?"活動":"Activity"}</span><select class="select" id="manual-activity-picker">${this.manualActivityOptions()}</select></label><div class="activity-hike-route"><div><strong>🥾 ${zh?"健行保留專用紀錄":"Hiking keeps its dedicated record"}</strong><p class="small muted">${zh?"距離、移動時間、總時間、爬升／下降與 GPX 會保留，健行徽章也只讀真正的健行紀錄。":"Distance, moving/elapsed time, elevation and GPX stay available, and hiking badges continue to use only true hike records."}</p></div><button class="btn primary touch" data-action="log-hike">${zh?"繼續記錄健行":"Continue to hike details"}</button></div></div></section>`;
    }
    const definition=exerciseById(this.manualActivityExerciseId) ?? exerciseById("run")!;
    const profile=exerciseScienceLoggingProfile(definition);
    const metrics=exerciseSessionMetricFlags(definition);
    const laterality=exerciseLaterality(definition);
    const focus=this.exerciseFocusText(definition);
    const isSetBased=["sets","skill_sets","dynamic_mobility"].includes(profile);
    const isTimedSets=["isometric_sets","balance_hold","static_stretch","rounds","skill_drill","water_skill","conditioning_intervals","sprint_intervals"].includes(profile);
    const isCarry=profile==="loaded_carry";
    const isSession=["cardio_session","swim_session","yoga_flow","mobility_session"].includes(profile);
    let fields="";
    if(isSetBased){
      fields=`<div class="form-two"><label class="field"><span>${zh?"實際組數":"Actual sets"}</span><input class="input" name="sets" type="number" min="1" max="30" step="1" inputmode="numeric" placeholder="—" required></label><label class="field"><span>${profile==="dynamic_mobility"?(zh?"實際每側次數":"Actual reps / side"):(zh?"實際每組次數":"Actual reps / set")}</span><input class="input" name="reps" type="number" min="1" max="500" step="1" inputmode="numeric" placeholder="—" required></label></div>${definition.type==="weight_reps"?`<label class="field"><span>${zh?"實際重量（kg，可選）":"Actual load (kg, optional)"}</span><input class="input" name="weight" type="number" min="0" max="1000" step="0.5" placeholder="—"></label>`:""}`;
    } else if(isCarry){
      fields=`<div class="form-three"><label class="field"><span>${zh?"實際趟數":"Actual carries"}</span><input class="input" name="sets" type="number" min="1" max="30" step="1" inputmode="numeric" placeholder="—" required></label><label class="field"><span>${zh?"每趟距離（m）":"Distance / carry (m)"}</span><input class="input" name="distanceM" type="number" min="0" step="1" placeholder="—"></label><label class="field"><span>${zh?"每趟時間（秒）":"Seconds / carry"}</span><input class="input" name="duration" type="number" min="0" max="7200" step="1" placeholder="—"></label></div><label class="field"><span>${zh?"每手重量（kg，可選）":"Load / hand (kg, optional)"}</span><input class="input" name="loadPerHand" type="number" min="0" step="0.5" placeholder="—"></label>`;
    } else if(isTimedSets){
      fields=`<div class="form-two"><label class="field"><span>${zh?"實際回合／組數":"Actual rounds / sets"}</span><input class="input" name="sets" type="number" min="1" max="30" step="1" inputmode="numeric" placeholder="—" required></label><label class="field"><span>${zh?"每次時間（秒）":"Seconds each"}</span><input class="input" name="duration" type="number" min="0" max="7200" step="1" placeholder="—"></label></div>${metrics.distance?`<label class="field"><span>${zh?"每次距離（m，可選）":"Distance each (m, optional)"}</span><input class="input" name="distanceM" type="number" min="0" step="1" placeholder="—"></label>`:""}${["conditioning_intervals","skill_drill","water_skill"].includes(profile)?`<label class="field"><span>${zh?"每次成功次數（可選）":"Successful reps each (optional)"}</span><input class="input" name="reps" type="number" min="0" step="1" placeholder="—"></label>`:""}`;
    } else {
      fields=`<div class="form-two"><label class="field"><span>${zh?"實際活動時間（分鐘）":"Actual active duration (min)"}</span><input class="input" name="minutes" type="number" min="0.1" max="1440" step="0.1" placeholder="—" required></label>${metrics.distance?`<label class="field"><span>${zh?"實際距離（km，可選）":"Actual distance (km, optional)"}</span><input class="input" name="distance" type="number" min="0" max="1000" step="0.01" placeholder="—"></label>`:"<div></div>"}</div>`;
    }
    const sideField=laterality === "none" ? "" : `<label class="field"><span>${zh?"側別":"Side"}</span><select class="select" name="side"><option value="both">${zh?"雙側／交替":"Both / alternating"}</option><option value="left">${zh?"左":"Left"}</option><option value="right">${zh?"右":"Right"}</option></select></label>`;
    const trackerFields=[
      metrics.speed ? `<label class="field"><span>${zh?"平均速度 km/h":"Average speed km/h"}</span><input class="input" name="speed" type="number" min="0" step="0.1" placeholder="—"></label>` : "",
      metrics.incline ? `<label class="field"><span>${zh?"坡度 %":"Incline %"}</span><input class="input" name="incline" type="number" min="0" max="100" step="0.1" placeholder="—"></label>` : "",
      metrics.resistance ? `<label class="field"><span>${zh?"器材阻力等級":"Machine resistance level"}</span><input class="input" name="resistance" type="number" min="0" step="0.1" placeholder="—"></label>` : "",
      metrics.laps ? `<label class="field"><span>${zh?"趟／圈數":"Laps / lengths"}</span><input class="input" name="laps" type="number" min="0" step="1" placeholder="—"></label>` : "",
      metrics.cadence ? `<label class="field"><span>${zh?"踏頻 rpm":"Cadence rpm"}</span><input class="input" name="cadence" type="number" min="0" step="1" placeholder="—"></label>` : "",
      metrics.strokeRate ? `<label class="field"><span>${zh?"划頻 spm":"Stroke rate spm"}</span><input class="input" name="strokeRate" type="number" min="0" step="1" placeholder="—"></label>` : "",
      metrics.pace500 ? `<label class="field"><span>${zh?"500 m 配速（秒）":"500 m split (sec)"}</span><input class="input" name="pace500" type="number" min="0" step="1" placeholder="—"></label>` : "",
      metrics.vertical ? `<label class="field"><span>${zh?"總爬升（m）":"Vertical gain (m)"}</span><input class="input" name="vertical" type="number" min="0" step="1" placeholder="—"></label>` : "",
      metrics.packWeight ? `<label class="field"><span>${zh?"背包重量（kg）":"Pack weight (kg)"}</span><input class="input" name="packWeight" type="number" min="0" step="0.5" placeholder="—"></label>` : ""
    ].filter(Boolean).join("");
    const optionalSession=!isSession ? `<label class="field"><span>${zh?"整次運動時間（分鐘，可選）":"Whole-session duration (min, optional)"}</span><input class="input" name="sessionMinutes" type="number" min="0" max="1440" step="0.1" placeholder="${zh?"不知道就留白":"Leave blank if unknown"}"></label>` : "";
    const details=(optionalSession||trackerFields||!isSession) ? `<details class="activity-extra-metrics"><summary>${zh?"更多紀錄／裝置數據（選填）":"More tracker / device metrics (optional)"}</summary><div class="activity-extra-grid">${optionalSession}${!isSession?`<label class="field"><span>${zh?"實際組間／回合休息（秒，可選）":"Actual rest between sets / rounds (sec, optional)"}</span><input class="input" name="restSec" type="number" min="0" max="1800" step="1" placeholder="—"></label>`:""}${trackerFields}</div><p class="tiny muted">${zh?"只填你真的記錄到的數據。這些欄位不會因數字較高而增加遊戲點數。":"Enter only metrics you actually recorded. Higher values here never grant extra game points."}</p></details>` : "";
    const cardioNote=exerciseMovementPattern(definition)==="cardio" ? `<div class="activity-intensity-note tiny muted">${zh?"有氧強度提示：中等強度通常可以說話但不容易唱歌；較高強度通常只能說幾個字就要換氣。若不知道強度就保持「未記錄」；未知強度不會被當成中等強度健康指引分鐘。":"Cardio intensity guide: moderate activity usually lets you talk but not sing; vigorous activity usually limits you to a few words before a breath. Leave effort as Not recorded if unknown; unknown effort is not counted as moderate guideline minutes."}</div>` : "";
    return `<div class="activity-log-header"><button class="btn ghost touch" data-action="back-home">${icon("back")} ${zh?"返回":"Back"}</button></div><h1 class="page-title">${zh?"補登已完成運動":"Log completed activity"}</h1><p class="page-subtitle">${zh?"這裡記錄已完成的實際數據，所以不會把「起始建議」預填成你做過的內容。準備開始？請回首頁選「開始運動」。":"This records what you actually completed, so starter targets are never prefilled as historical facts. About to exercise? Choose Start workout on Home."}</p><form id="manual-activity-form" class="card activity-log-card"><label class="field"><span>${zh?"活動":"Activity"}</span><select class="select" id="manual-activity-picker" name="exerciseId">${this.manualActivityOptions()}</select></label><div class="exercise-preview-card compact-preview"><div><span>${escapeHtml(this.exercisePreviewHint(definition))}</span>${focus?`<small class="exercise-focus-preview">${escapeHtml(focus)}</small>`:""}</div><a class="exercise-example-link" href="${escapeHtml(this.exerciseImageSearchUrl(definition))}" target="_blank" rel="noopener noreferrer">${zh?"查看圖片示範":"View image examples"}</a></div><div class="form-two"><label class="field"><span>${zh?"日期與結束時間":"Date & end time"}</span><input class="input date-input" name="activityAt" type="datetime-local" max="${this.toDateTimeLocal(new Date().toISOString())}" value="${this.toDateTimeLocal(new Date().toISOString())}"></label><label class="field"><span>${zh?"體感／強度":"Effort / intensity"}</span><select class="select" name="difficulty"><option value="" selected>${zh?"未記錄":"Not recorded"}</option><option value="1">1 · ${zh?"非常輕鬆":"Very easy"}</option><option value="2">2 · ${zh?"輕鬆":"Easy"}</option><option value="3">3 · ${zh?"中等":"Moderate"}</option><option value="4">4 · ${zh?"較高／劇烈":"Hard / vigorous"}</option><option value="5">5 · ${zh?"非常吃力":"Very hard"}</option></select></label></div>${cardioNote}${fields}${sideField}${details}<label class="field"><span>${zh?"備註（可選）":"Notes (optional)"}</span><textarea class="input" name="notes" rows="3" maxlength="500" placeholder="${zh?"例如：Apple Watch、Garmin、Strava 或泳池紀錄":"e.g. Apple Watch, Garmin, Strava or pool record"}"></textarea></label><div class="activity-log-science tiny muted">${zh?"記錄後會進入一般 History，並由原本的動作 metadata 決定有氧、力量、活動度、肌群與 Gold Day 貢獻；不能直接輸入遊戲分數。":"The saved record enters normal History. Existing exercise metadata determines cardio, strength, mobility, training distribution and Gold Day credit; game points cannot be entered manually."}</div><button class="btn primary full touch" type="submit">${zh?"儲存活動":"Save activity"}</button></form>`;
  }

  private saveManualActivity(form: HTMLFormElement): void {
    const data=new FormData(form);
    const exerciseId=String(data.get("exerciseId") ?? this.manualActivityExerciseId);
    if(exerciseId==="__hike__"){ this.requestWeightCheck({kind:"hike"}); return; }
    const definition=exerciseById(exerciseId); if(!definition || definition.id==="hiking_cardio") return;
    const profile=exerciseScienceLoggingProfile(definition);
    const metrics=exerciseSessionMetricFlags(definition);
    const laterality=exerciseLaterality(definition);
    const atRaw=String(data.get("activityAt") ?? "");
    const endDate=atRaw ? new Date(atRaw) : new Date();
    if(!Number.isFinite(endDate.getTime()) || endDate.getTime()>Date.now()+60000){ this.toast(this.locale==="zh-TW"?"活動結束時間不能在未來":"Activity end time cannot be in the future"); return; }
    const difficultyRaw=String(data.get("difficulty")??"").trim();
    const difficulty=difficultyRaw ? clamp(Math.round(Number(difficultyRaw)||0),1,5) as 1|2|3|4|5 : undefined;
    const setsRaw=String(data.get("sets")??"").trim();
    const setsCount=setsRaw ? clamp(Math.round(Number(setsRaw)||0),1,30) : 0;
    const reps=Math.max(0,Math.round(Number(data.get("reps")??0)||0));
    const weight=Math.max(0,Number(data.get("weight")??0)||0);
    const durationEach=Math.max(0,Math.round(Number(data.get("duration")??0)||0));
    const minutes=Math.max(0,Number(data.get("minutes")??0)||0);
    const sessionMinutes=Math.max(0,Number(data.get("sessionMinutes")??0)||0);
    const distanceKm=Math.max(0,Number(data.get("distance")??0)||0);
    const distanceEachM=Math.max(0,Number(data.get("distanceM")??0)||0);
    const loadPerHand=Math.max(0,Number(data.get("loadPerHand")??0)||0);
    const restSec=Math.max(0,Math.round(Number(data.get("restSec")??0)||0));
    const sideRaw=String(data.get("side")??"");
    const side=laterality!=="none" && ["left","right","both"].includes(sideRaw) ? sideRaw as "left"|"right"|"both" : undefined;
    const advanced:Partial<SetEntry>={};
    const assignPositive=(enabled:boolean,key:keyof SetEntry,name:string,round=false)=>{const value=Number(data.get(name)??0);if(enabled&&Number.isFinite(value)&&value>0) (advanced as Record<string,unknown>)[key]=round?Math.round(value):value;};
    assignPositive(metrics.speed,"speedKph","speed");
    assignPositive(metrics.incline,"inclinePct","incline");
    assignPositive(metrics.resistance,"resistanceLevel","resistance");
    assignPositive(metrics.laps,"laps","laps",true);
    assignPositive(metrics.cadence,"cadenceRpm","cadence",true);
    assignPositive(metrics.strokeRate,"strokeRateSpm","strokeRate",true);
    assignPositive(metrics.pace500,"pace500Sec","pace500",true);
    assignPositive(metrics.vertical,"verticalGainM","vertical");
    assignPositive(metrics.packWeight,"packWeightKg","packWeight");
    const sets:SetEntry[]=[];
    const timedSession=["cardio_session","swim_session","yoga_flow","mobility_session"].includes(profile);
    const withCommon=(set:SetEntry,index:number):SetEntry=>({...set,...(side?{side}:{}),...(index===0?advanced:{})});
    if(timedSession){
      if(minutes<=0){ this.toast(this.locale==="zh-TW"?"請輸入實際活動時間":"Enter the actual activity duration"); return; }
      sets.push(withCommon({id:uid("set"),completed:true,setType:"normal",durationSec:Math.round(minutes*60),...(metrics.distance&&distanceKm>0?{distanceKm}:{})},0));
    } else if(profile==="loaded_carry"){
      if(!setsCount){ this.toast(this.locale==="zh-TW"?"請輸入實際趟數":"Enter the actual number of carries"); return; }
      if(distanceEachM<=0&&durationEach<=0){ this.toast(this.locale==="zh-TW"?"請輸入每趟距離或時間":"Enter distance or time for each carry"); return; }
      for(let i=0;i<setsCount;i++) sets.push(withCommon({id:uid("set"),completed:true,setType:"normal",...(distanceEachM>0?{distanceKm:distanceEachM/1000}:{}),...(loadPerHand>0?{loadPerHandKg:loadPerHand}:{}),...(durationEach>0?{durationSec:durationEach}:{}),...(restSec>0&&i<setsCount-1?{restAfterSec:restSec}:{})},i));
    } else if(["isometric_sets","balance_hold","static_stretch","rounds","skill_drill","water_skill","conditioning_intervals","sprint_intervals"].includes(profile)){
      if(!setsCount){ this.toast(this.locale==="zh-TW"?"請輸入實際回合／組數":"Enter the actual rounds / sets"); return; }
      if(durationEach<=0&&reps<=0){ this.toast(this.locale==="zh-TW"?"請輸入實際時間或次數":"Enter actual time or repetitions"); return; }
      for(let i=0;i<setsCount;i++) sets.push(withCommon({id:uid("set"),completed:true,setType:"normal",...(durationEach>0?{durationSec:durationEach}:{}),...(reps>0?{reps}:{}),...(distanceEachM>0?{distanceKm:distanceEachM/1000}:{}),...(restSec>0&&i<setsCount-1?{restAfterSec:restSec}:{})},i));
    } else {
      if(!setsCount||reps<=0){ this.toast(this.locale==="zh-TW"?"請輸入實際組數與每組次數":"Enter actual sets and repetitions"); return; }
      for(let i=0;i<setsCount;i++) sets.push(withCommon({id:uid("set"),completed:true,setType:"normal",reps,...(definition.type==="weight_reps"&&weight>0?{weightKg:weight}:{}),...(restSec>0&&i<setsCount-1?{restAfterSec:restSec}:{})},i));
    }
    const completedAt=endDate;
    const knownSessionMinutes=timedSession ? minutes : sessionMinutes;
    const startedAt=knownSessionMinutes>0 ? new Date(completedAt.getTime()-knownSessionMinutes*60000) : completedAt;
    const workout=createBlankWorkout(this.state);
    workout.recordingSource="manual";
    workout.routineName=`${this.locale==="zh-TW"?"補登":"Logged"}: ${definition.names[this.locale]}`;
    workout.startedAt=startedAt.toISOString(); workout.completedAt=completedAt.toISOString();
    workout.notes=String(data.get("notes")??"").trim().slice(0,500);
    workout.exercises=[{id:uid("exercise"),exerciseId:definition.id,restSec,notes:"",sets,...(difficulty?{difficulty}:{}),recordingProfile:profile,recordingProfileVersion:2}];
    workout.estimatedCalories=estimateWorkoutCalories(workout,this.currentWeightKg());
    this.markFamilyDate(workout.completedAt); this.state.workouts.push(workout);
    this.persist(); void this.pushWorkoutToCloud(workout);
    this.toast(this.locale==="zh-TW"?"活動已記錄":"Activity logged");
    this.navigate("history");
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
    else if (this.confirmAction.kind === "remove-circuit-round") {
      title = this.locale === "zh-TW" ? `移除第 ${this.confirmAction.roundIndex + 1} 輪？` : `Remove Round ${this.confirmAction.roundIndex + 1}?`;
      hint = this.locale === "zh-TW" ? "這會從循環中的每個動作移除這一輪。請確認後再繼續。" : "This removes this round from every movement in the circuit. Confirm before continuing.";
      actionLabel = this.locale === "zh-TW" ? "移除這輪" : "Remove round";
    }
    else if (this.confirmAction.kind === "skip-set") {
      title = this.locale === "zh-TW" ? "略過這一項？" : "Skip this item?";
      hint = this.locale === "zh-TW" ? "它會保留在歷史紀錄中標示為『已略過』，但不會計入肌群、熱量、任務、Gold Day、進步判斷或 Poke。只能略過目前下一個項目。" : "It stays visible in History as Skipped, but contributes nothing to muscles, calories, missions, Gold Days, progression or Pokes. Only the current next item can be skipped.";
      actionLabel = this.locale === "zh-TW" ? "確認略過" : "Confirm skip";
      destructive = false;
    }
    else if (this.confirmAction.kind === "delete-routine") title = this.locale === "zh-TW" ? "刪除這個已儲存訓練？" : "Delete this saved routine?";
    else if (this.confirmAction.kind === "delete-custom-supplement") {
      title = this.locale === "zh-TW" ? `從「我的補充品」移除 ${this.confirmAction.label}？` : `Remove ${this.confirmAction.label} from My supplements?`;
      hint = this.locale === "zh-TW" ? "它之後不會出現在快速下拉選單，但以前的攝取紀錄會保留原本名稱與歷史。" : "It will disappear from future quick choices, but existing consumption history will stay intact with its recorded label.";
      actionLabel = this.locale === "zh-TW" ? "從清單移除" : "Remove from list";
    }
    else if (this.confirmAction.kind === "revoke-member") {
      title = this.locale === "zh-TW" ? `移除 ${this.confirmAction.name} 的家庭權限？` : `Remove ${this.confirmAction.name}'s family access?`;
      hint = this.locale === "zh-TW" ? "對方會立即失去家庭資料存取權。紀錄會保留為已撤銷，因此之後仍可恢復。" : "They will immediately lose access to family data. The authorization record stays revoked so you can restore it later.";
      actionLabel = this.locale === "zh-TW" ? "移除權限" : "Remove access";
    } else title = this.text("confirmRemoveExercise");
    return `<div class="modal-backdrop" role="presentation"><section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><div class="dialog-icon">${icon("trash")}</div><h2 id="confirm-title">${escapeHtml(title)}</h2><p>${escapeHtml(hint)}</p><div class="dialog-actions"><button class="btn touch" data-confirm-cancel>${escapeHtml(this.text("cancel"))}</button><button class="btn ${destructive ? "danger-solid" : "primary"} touch" data-confirm-accept>${escapeHtml(actionLabel)}</button></div></section></div>`;
  }

  private bindGlobalEvents(): void {
    root.querySelectorAll<HTMLElement>("[data-photo-view]").forEach(node=>node.addEventListener("click",()=>{const id=node.dataset.photoView;if(!id)return;this.lightboxPhoto={id,alt:node.dataset.photoAlt??""};this.render();queueMicrotask(()=>root.querySelector<HTMLButtonElement>(".photo-lightbox-close")?.focus());}));
    root.querySelector(".photo-lightbox")?.addEventListener("click",event=>event.stopPropagation());
    root.querySelectorAll<HTMLElement>("[data-photo-close]").forEach(node=>node.addEventListener("click",()=>{this.lightboxPhoto=null;this.render();}));
    root.querySelector('[data-action="family-notification-later"]')?.addEventListener("click",()=>{ this.familyNotificationPromptOpen=false; this.render(); });
    root.querySelector('[data-action="family-notification-never"]')?.addEventListener("click",()=>{ this.setFamilyNotificationPromptSuppressed(true); this.familyNotificationPromptOpen=false; this.render(); });
    root.querySelector('[data-action="reset-family-notification-prompt"]')?.addEventListener("click",()=>{ this.setFamilyNotificationPromptSuppressed(false); this.render(); this.toast(this.locale === "zh-TW" ? "下次開啟家庭頁面時會再次提醒" : "The Family reminder will appear again next time"); });
    root.querySelector('[data-action="family-notification-enable"]')?.addEventListener("click",()=>{
      if(this.pushStatus?.permission === "denied"){
        this.toast(this.locale === "zh-TW" ? "請到 iPhone／瀏覽器的通知設定允許 LogTogether，然後回來再試一次。" : "Allow LogTogether in your iPhone/browser notification settings, then return and try again.");
        return;
      }
      if(this.pushStatus?.supported === false){
        this.toast(this.locale === "zh-TW" ? "這個瀏覽器目前不支援 Web Push；iPhone 請使用加入主畫面的 LogTogether App。" : "This browser does not support Web Push here. On iPhone, use the LogTogether Home Screen app.");
        return;
      }
      if(this.pushStatus?.configured === false){
        this.toast(this.locale === "zh-TW" ? "通知服務尚未設定完成，稍後再試一次。" : "Notification service is not configured yet. Try again later.");
        return;
      }
      this.familyNotificationPromptOpen=false;
      void this.enablePushForCurrentDevice();
    });
    root.querySelector('[data-action="edit-workout-name"]')?.addEventListener("click", () => {
      const input = root.querySelector<HTMLInputElement>("#workout-name");
      input?.focus();
      input?.select();
    });
    root.querySelectorAll<HTMLElement>('[data-action="google-sign-in"]').forEach(node => node.addEventListener("click", async () => {
      if (this.authInteractiveStatus) return;
      rememberCloudReconnectRequest();
      this.cloudAccessRequested = true;
      this.authError = null;
      this.cloudMembershipError = null;
      this.authInteractiveStatus = "connecting";
      this.armAuthInteractiveWatchdog();
      this.render();
      try {
        const result = await signInWithGoogle();
        if (result.mode === "redirect") {
          this.authInteractiveStatus = "redirecting";
          this.render();
          return;
        }
        this.authInteractiveStatus = "finishing";
        this.render();
        await this.handleObservedAuthState(result.user);
        this.authInteractiveStatus = null;
        this.clearAuthInteractiveWatchdog();
        if (this.cloudAccessRequested && !this.authObserverAttached) await this.initializeAuthentication();
      } catch (error) {
        this.authInteractiveStatus = null;
        this.clearAuthInteractiveWatchdog();
        this.authError = this.googleAuthErrorMessage(error);
        this.render();
      }
    }));
    root.querySelector('[data-action="retry-cloud-auth"]')?.addEventListener("click", () => {
      if (!this.authUser || this.authInteractiveStatus) return;
      rememberCloudReconnectRequest();
      this.cloudAccessRequested = true;
      this.cloudMembershipError = null;
      this.authError = null;
      this.authInteractiveStatus = "finishing";
      this.armAuthInteractiveWatchdog();
      this.render();
      void this.refreshCloudMembership(this.authUser).finally(() => {
        this.authInteractiveStatus = null;
        this.clearAuthInteractiveWatchdog();
        this.render();
      });
    });
    root.querySelector('[data-action="google-sign-out"]')?.addEventListener("click", async () => {
      clearCloudReconnectRequest();
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
    root.querySelector('[data-action="install-app"]')?.addEventListener("click", async () => {
      if (!this.installPrompt) return;
      await this.installPrompt.prompt();
      this.installPrompt = null;
      this.render();
    });
    root.querySelector('[data-action="start-workout"]')?.addEventListener("click", () => this.requestWeightCheck({ kind: "workout" }));
    root.querySelector('[data-action="edit-routines"]')?.addEventListener("click", () => {
      if (!this.state.activeWorkout) this.state.activeWorkout = createBlankWorkout(this.state);
      this.selectedRoutineManagerId = "";
      this.routineDraft = null;
      this.folds.add("routine-manager");
      this.persist();
      this.navigate("workout");
    });
    root.querySelectorAll<HTMLElement>("[data-start-routine]").forEach(node => node.addEventListener("click", () => {
      const routineId = node.dataset.startRoutine;
      if (routineId) this.requestWeightCheck({ kind: "routine", routineId });
    }));
    root.querySelectorAll<HTMLElement>("[data-delete-routine]").forEach(node => node.addEventListener("click", event => { event.stopPropagation(); const id=node.dataset.deleteRoutine; if(id){ this.confirmAction={kind:"delete-routine",id}; this.render(); } }));
    root.querySelectorAll<HTMLElement>('[data-action="continue-workout"]').forEach(node => node.addEventListener("click", () => this.navigate("workout")));
    root.querySelectorAll<HTMLElement>('[data-action="discard-workout"]').forEach(node => node.addEventListener("click", () => { this.confirmAction = { kind: "discard-active" }; this.render(); }));
    root.querySelector('[data-action="log-activity"]')?.addEventListener("click", () => this.requestWeightCheck({ kind: "activity" }));
    root.querySelector('[data-action="log-hike"]')?.addEventListener("click", () => this.requestWeightCheck({ kind: "hike" }));
    root.querySelector('[data-action="back-home"]')?.addEventListener("click", () => this.navigate("home"));
    root.querySelector<HTMLSelectElement>("#manual-activity-picker")?.addEventListener("change", event => { this.manualActivityExerciseId=(event.currentTarget as HTMLSelectElement).value; this.render(); });
    root.querySelector<HTMLFormElement>("#manual-activity-form")?.addEventListener("submit", event => { event.preventDefault(); this.saveManualActivity(event.currentTarget as HTMLFormElement); });
    root.querySelector('[data-action="back-history"]')?.addEventListener("click", () => { this.editingHikeId = null; this.pendingHikeGpx = null; this.navigate("history"); });
    root.querySelector('[data-action="toggle-water-entry-edit"]')?.addEventListener("click", () => { this.waterEntriesEditing = !this.waterEntriesEditing; this.render(); });
    root.querySelector('[data-action="toggle-supplement-entry-edit"]')?.addEventListener("click", () => { this.supplementEntriesEditing = !this.supplementEntriesEditing; this.render(); });
    root.querySelector<HTMLInputElement>("#shared-log-at")?.addEventListener("change", event => { this.logAt=(event.currentTarget as HTMLInputElement).value; });
    root.querySelector('[data-action="custom-water"]')?.addEventListener("click",()=>{this.customWaterOpen=!this.customWaterOpen;this.render();});
    root.querySelectorAll<HTMLElement>("[data-water]").forEach(node=>node.addEventListener("click",()=>this.logWater(Number(node.dataset.water))));
    root.querySelector<HTMLFormElement>("#custom-water-form")?.addEventListener("submit",event=>{event.preventDefault(); const form=event.currentTarget as HTMLFormElement; if(form.reportValidity()) this.logWater(Number(new FormData(form).get("ml")));});
    root.querySelectorAll<HTMLDetailsElement>("[data-fold]").forEach(node=>node.addEventListener("toggle",()=>{const key=node.dataset.fold!; if(node.open)this.folds.add(key);else this.folds.delete(key);}));
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
      if (!amountInput.reportValidity() || !atInput.reportValidity() || !amountInput.value || !atInput.value) return;
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
    const supplementWeekDetails=root.querySelector<HTMLDetailsElement>(".supplement-week-card");
    supplementWeekDetails?.addEventListener("toggle",()=>{ this.supplementWeekOpen=supplementWeekDetails.open; });
    root.querySelector<HTMLSelectElement>("#supplement-week-filter")?.addEventListener("change",event=>{
      this.supplementWeekFilter=(event.currentTarget as HTMLSelectElement).value || "all";
      this.supplementWeekOpen=true;
      this.render();
    });
    const supplementForm = root.querySelector<HTMLFormElement>("#supplement-form");
    const supplementPicker = root.querySelector<HTMLSelectElement>("#supplement-picker");
    const supplementInfoLink = root.querySelector<HTMLAnchorElement>("#supplement-info-link");
    const supplementLogDetails=root.querySelector<HTMLDetailsElement>(".supplement-log-card");
    const customManagerDetails=root.querySelector<HTMLDetailsElement>(".custom-supplement-maker");
    const captureSupplementDraft=()=>{
      if(!supplementForm) return;
      this.supplementDraftId=supplementPicker?.value ?? this.supplementDraftId;
      const amount=Number(supplementForm.querySelector<HTMLInputElement>('[name="supplementAmount"]')?.value ?? this.supplementDraftAmount);
      if(Number.isFinite(amount)&&amount>0) this.supplementDraftAmount=Math.min(100000,amount);
      const unit=supplementForm.querySelector<HTMLSelectElement>('[name="supplementUnit"]')?.value as SupplementUnit|undefined;
      if(unit&&SUPPLEMENT_UNITS.includes(unit)) this.supplementDraftUnit=unit;
    };
    supplementLogDetails?.addEventListener("toggle",()=>{ this.supplementLogOpen=supplementLogDetails.open; });
    customManagerDetails?.addEventListener("toggle",()=>{ this.customSupplementManagerOpen=customManagerDetails.open; if(customManagerDetails.open) this.supplementLogOpen=true; });
    supplementPicker?.addEventListener("change", () => {
      this.supplementLogOpen=true; captureSupplementDraft();
      const custom=(this.state.customSupplements ?? []).find(item=>item.id===supplementPicker.value);
      if(custom){
        if(Number.isFinite(custom.defaultAmount)) this.supplementDraftAmount=custom.defaultAmount!;
        if(custom.defaultUnit) this.supplementDraftUnit=custom.defaultUnit;
      }
      if (supplementInfoLink) {
        supplementInfoLink.href = this.supplementSearchUrl(supplementPicker.value);
        supplementInfoLink.textContent=custom ? (this.locale === "zh-TW" ? "研究這個補充品 ↗" : "Research this supplement ↗") : (this.locale === "zh-TW" ? "查看更多：用途／證據／副作用" : "View more: uses / evidence / side effects");
      }
      const amount=supplementForm?.querySelector<HTMLInputElement>('[name="supplementAmount"]');
      const unit=supplementForm?.querySelector<HTMLSelectElement>('[name="supplementUnit"]');
      if(amount) amount.value=String(this.supplementDraftAmount);
      if(unit) unit.value=this.supplementDraftUnit;
    });
    supplementForm?.addEventListener("submit", event => {
      event.preventDefault(); captureSupplementDraft();
      const supplementId = this.supplementDraftId || String(new FormData(supplementForm).get("supplementId") ?? "");
      const custom=(this.state.customSupplements ?? []).find(item=>item.id===supplementId);
      if (!SUPPLEMENTS.some(item => item.id === supplementId) && !custom) return;
      const amount = this.supplementDraftAmount;
      const unit = this.supplementDraftUnit;
      const now = this.logDate(); if(!now) return;
      const date = localDateKey(now);
      const day = this.ensureSupplementDayForDate(date);
      day.entries.push({ id: uid("supplement"), at: now.toISOString(), supplementId, ...(custom ? {customLabel:custom.label} : {}), amount, unit });
      this.selectedWaterDate = date;
      this.waterCalendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      this.supplementLogOpen=true;
      this.persist(); this.render();
      void this.pushSupplementDayToCloud(date);
      this.toast(this.locale === "zh-TW" ? "補充品紀錄已儲存" : "Supplement record saved");
    });
    root.querySelector('[data-action="add-custom-supplement"]')?.addEventListener("click",()=>{
      this.supplementLogOpen=true; this.customSupplementManagerOpen=true; captureSupplementDraft();
      const box=root.querySelector<HTMLElement>("#custom-supplement-form");
      const label=box?.querySelector<HTMLInputElement>('[name="customSupplementLabel"]')?.value.trim().slice(0,100) ?? "";
      if(!label){ this.toast(this.locale === "zh-TW" ? "請輸入補充品名稱" : "Enter a supplement name"); return; }
      if((this.state.customSupplements ?? []).some(item=>item.label.toLocaleLowerCase()===label.toLocaleLowerCase())){ this.toast(this.locale === "zh-TW" ? "這個名稱已經在你的清單中" : "That name is already in your list"); return; }
      if((this.state.customSupplements ?? []).length>=40){ this.toast(this.locale === "zh-TW" ? "自訂補充品最多 40 項" : "You can keep up to 40 custom supplements"); return; }
      const amountRaw=Number(box?.querySelector<HTMLInputElement>('[name="customSupplementAmount"]')?.value ?? "");
      const unitRaw=box?.querySelector<HTMLSelectElement>('[name="customSupplementUnit"]')?.value as SupplementUnit|undefined;
      const item:CustomSupplement={id:`custom_${uid("supp")}`,label,...(Number.isFinite(amountRaw)&&amountRaw>0?{defaultAmount:Math.min(100000,amountRaw)}:{}),...(unitRaw&&SUPPLEMENT_UNITS.includes(unitRaw)?{defaultUnit:unitRaw}:{})};
      this.state.customSupplements ??=[]; this.state.customSupplements.push(item);
      this.editingCustomSupplementId=item.id; this.supplementDraftId=item.id;
      if(item.defaultAmount) this.supplementDraftAmount=item.defaultAmount;
      if(item.defaultUnit) this.supplementDraftUnit=item.defaultUnit;
      this.state.sync ??={}; this.state.sync.preferencesDirty=true;
      this.persist(); this.render(); void this.pushPreferencesToCloud();
      this.toast(this.locale === "zh-TW" ? "已加入你的補充品清單" : "Added to your supplement list");
    });
    root.querySelector<HTMLSelectElement>('#custom-supplement-manage-picker')?.addEventListener("change",event=>{
      this.supplementLogOpen=true; this.customSupplementManagerOpen=true; captureSupplementDraft();
      this.editingCustomSupplementId=(event.currentTarget as HTMLSelectElement).value || null;
      this.render();
    });
    root.querySelectorAll<HTMLElement>('[data-save-custom-supplement]').forEach(node=>node.addEventListener("click",()=>{
      const id=node.dataset.saveCustomSupplement; if(!id) return;
      this.supplementLogOpen=true; this.customSupplementManagerOpen=true; captureSupplementDraft();
      const item=(this.state.customSupplements ?? []).find(candidate=>candidate.id===id); if(!item) return;
      const label=root.querySelector<HTMLInputElement>(`[data-custom-supplement-edit-label="${CSS.escape(id)}"]`)?.value.trim().slice(0,100) ?? "";
      if(!label){ this.toast(this.locale === "zh-TW" ? "請輸入補充品名稱" : "Enter a supplement name"); return; }
      if((this.state.customSupplements ?? []).some(candidate=>candidate.id!==id && candidate.label.toLocaleLowerCase()===label.toLocaleLowerCase())){ this.toast(this.locale === "zh-TW" ? "這個名稱已經在你的清單中" : "That name is already in your list"); return; }
      const amountRaw=Number(root.querySelector<HTMLInputElement>(`[data-custom-supplement-edit-amount="${CSS.escape(id)}"]`)?.value ?? "");
      const unitRaw=root.querySelector<HTMLSelectElement>(`[data-custom-supplement-edit-unit="${CSS.escape(id)}"]`)?.value as SupplementUnit|undefined;
      item.label=label;
      if(Number.isFinite(amountRaw)&&amountRaw>0) item.defaultAmount=Math.min(100000,amountRaw); else delete item.defaultAmount;
      if(unitRaw&&SUPPLEMENT_UNITS.includes(unitRaw)) item.defaultUnit=unitRaw; else delete item.defaultUnit;
      const changedDates:string[]=[];
      for(const day of this.state.supplementHistory ?? []){
        let changed=false;
        day.entries.forEach(entry=>{ if(entry.supplementId===id){ entry.customLabel=label; entry.editedAt=new Date().toISOString(); changed=true; } });
        if(changed) changedDates.push(day.date);
      }
      this.state.sync ??={}; this.state.sync.preferencesDirty=true;
      this.editingCustomSupplementId=id; this.persist(); this.render();
      void this.pushPreferencesToCloud(); changedDates.forEach(date=>void this.pushSupplementDayToCloud(date));
      this.toast(this.locale === "zh-TW" ? "已更新名稱與舊紀錄" : "Supplement and historical labels updated");
    }));
    root.querySelectorAll<HTMLElement>('[data-delete-custom-supplement]').forEach(node=>node.addEventListener("click",()=>{
      const id=node.dataset.deleteCustomSupplement; const item=(this.state.customSupplements ?? []).find(candidate=>candidate.id===id); if(!id||!item) return;
      this.supplementLogOpen=true; this.customSupplementManagerOpen=true; captureSupplementDraft();
      this.confirmAction={kind:"delete-custom-supplement",id,label:item.label}; this.render();
    }));

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
      const chosenCustom=(this.state.customSupplements ?? []).find(item=>item.id===nameInput.value);
      const supplementId = SUPPLEMENTS.some(item => item.id === nameInput.value) || chosenCustom ? nameInput.value : entry.supplementId;
      const rawUnit = unitInput.value as SupplementUnit;
      const unit: SupplementUnit = SUPPLEMENT_UNITS.includes(rawUnit) ? rawUnit : (entry.unit ?? "serving");
      const amount = Math.min(100000, Math.max(0.01, Number(amountInput.value) || entry.amount || 1));
      if (!amountInput.reportValidity() || !atInput.reportValidity() || !amountInput.value || !atInput.value) return;
      const nextAt = this.dateTimeInputToIso(atInput.value, entry.at);
      if (new Date(nextAt).getTime() > Date.now() + 60_000) { this.toast(this.locale === "zh-TW" ? "不能把紀錄設到未來" : "Records cannot be moved into the future"); return; }
      const targetDate = localDateKey(nextAt);
      const nextEntry: SupplementEntry = { ...entry, supplementId, ...(chosenCustom ? {customLabel:chosenCustom.label} : SUPPLEMENTS.some(item=>item.id===supplementId) ? {customLabel:undefined} : {}), amount, unit, at: nextAt, editedAt: new Date().toISOString() };
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

    root.querySelectorAll<HTMLElement>("[data-home-progress-mode]").forEach(node => node.addEventListener("click", () => {
      this.homeProgressMode = node.dataset.homeProgressMode === "calories" ? "calories" : "missions";
      this.render();
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
    root.querySelectorAll<HTMLElement>("[data-water-day]").forEach(node=>node.addEventListener("click",()=>{ if(node.dataset.waterDay) this.selectedWaterDate=node.dataset.waterDay; this.waterEntriesEditing=false; this.supplementEntriesEditing=false; this.render(); }));
    root.querySelectorAll<HTMLElement>("[data-water-calendar-nav]").forEach(node=>node.addEventListener("click",()=>{ const delta=node.dataset.waterCalendarNav==="prev"?-1:1; this.waterCalendarMonth=new Date(this.waterCalendarMonth.getFullYear(),this.waterCalendarMonth.getMonth()+delta,1); const now=new Date(); const showingCurrent=now.getFullYear()===this.waterCalendarMonth.getFullYear() && now.getMonth()===this.waterCalendarMonth.getMonth(); this.selectedWaterDate=showingCurrent ? localDateKey(now) : `${this.waterCalendarMonth.getFullYear()}-${String(this.waterCalendarMonth.getMonth()+1).padStart(2,"0")}-01`; this.waterEntriesEditing=false; this.supplementEntriesEditing=false; this.render(); }));
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
        targetWorkSec:clamp(Math.round(Number(data.get(`work_${index}`) ?? row.targetWorkSec) || 0),0,1800),
        durationSec:clamp(Math.round(Number(data.get(`duration_${index}`) ?? row.durationSec) || row.durationSec),0,7200),
        distanceKm:(()=>{ const metres=String(data.get(`distanceM_${index}`)??"").trim(); if(metres) return clamp((Number(metres)||0)/1000,0,1000); return clamp(Number(data.get(`distance_${index}`) ?? row.distanceKm) || row.distanceKm,0,1000); })(),
        minutes:clamp(Math.round(Number(data.get(`minutes_${index}`) ?? row.minutes) || row.minutes),0,1440),
        restSec:clamp(Math.round(Number(data.get(`rest_${index}`) ?? row.restSec) || 0),0,900)
      }));
    };
    root.querySelectorAll<HTMLSelectElement>("[data-circuit-exercise-index]").forEach(select => select.addEventListener("change", () => {
      captureCircuitDraft();
      const index = Number(select.dataset.circuitExerciseIndex);
      if (Number.isInteger(index) && this.circuitDraftRows[index]) {
        const definition=exerciseById(select.value);
        const starter=definition ? exerciseStarterDefault(definition) : undefined;
        this.circuitDraftRows[index] = {
          exerciseId:select.value,
          reps:starter?.reps ?? 10,
          weightKg:0,
          targetWorkSec:0,
          durationSec:starter?.durationSec ?? 30,
          distanceKm:starter?.distanceKm ?? 0,
          minutes:starter?.minutes ?? 20,
          restSec:starter?.restSec ?? 60
        };
      }
      this.render();
    }));
    root.querySelector('[data-action="add-circuit-row"]')?.addEventListener("click", () => { captureCircuitDraft(); const definition=exerciseById("push_up"); const starter=definition ? exerciseStarterDefault(definition) : undefined; this.circuitDraftRows.push({ exerciseId:"push_up", reps:starter?.reps ?? 10, weightKg:0, targetWorkSec:0, durationSec:starter?.durationSec ?? 30, distanceKm:starter?.distanceKm ?? 0, minutes:starter?.minutes ?? 20, restSec:starter?.restSec ?? 60 }); this.render(); });
    root.querySelectorAll<HTMLElement>("[data-circuit-remove]").forEach(node => node.addEventListener("click", () => { captureCircuitDraft(); const index=Number(node.dataset.circuitRemove); if (this.circuitDraftRows.length>1 && Number.isInteger(index)) this.circuitDraftRows.splice(index,1); this.render(); }));
    root.querySelectorAll<HTMLSelectElement>("[data-circuit-position]").forEach(select => select.addEventListener("change", () => { captureCircuitDraft(); const from=Number(select.dataset.circuitPosition),to=Number(select.value);if(!Number.isInteger(from)||!Number.isInteger(to)||from===to)return;const [moved]=this.circuitDraftRows.splice(from,1);if(moved)this.circuitDraftRows.splice(to,0,moved);this.render(); }));
    this.bindSmoothReorder("[data-circuit-drag]","[data-circuit-drag-handle]",(from,to)=>{const [moved]=this.circuitDraftRows.splice(from,1);if(moved)this.circuitDraftRows.splice(to,0,moved);this.render();},captureCircuitDraft);
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
    root.querySelectorAll<HTMLElement>("[data-family-comparison-metric]").forEach(node=>node.addEventListener("click",()=>{ const metric=node.dataset.familyComparisonMetric; this.familyComparisonMetric=metric === "water" ? "water" : metric === "calories" ? "calories" : "activity"; this.render(); }));
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

    root.querySelector('[data-action="test-timer-alert"]')?.addEventListener("click",()=>{ this.playTimerCue(2, true); });
    root.querySelectorAll<HTMLElement>("[data-workout-pref]").forEach(node => node.addEventListener("click", () => {
      const key=node.dataset.workoutPref;
      const value=node.dataset.prefValue === "on";
      this.state.workoutPreferences ??= {restTimerSound:true,keepScreenAwake:true};
      if(key === "restTimerSound") { this.state.workoutPreferences.restTimerSound=value; if(value) this.prepareTimerAudio(); }
      if(key === "keepScreenAwake") { this.state.workoutPreferences.keepScreenAwake=value; if(!value && this.wakeLock){ void this.wakeLock.release?.().catch?.(()=>undefined); this.wakeLock=null; } else void this.syncWakeLock(); }
      this.persist(); this.render();
    }));
    root.querySelectorAll<HTMLInputElement>("[data-notification-pref]").forEach(node => node.addEventListener("change", () => {
      const key=node.dataset.notificationPref as "goldDays" | "badges" | "pokes" | undefined;
      if(!key) return;
      this.state.notificationPreferences ??= {goldDays:true,badges:true,pokes:true};
      this.state.notificationPreferences[key]=node.checked;
      this.persist(); this.render(); void this.pushPreferencesToCloud();
    }));
    root.querySelector('[data-action="enable-push"]')?.addEventListener("click", () => { void this.enablePushForCurrentDevice(); });
    root.querySelector('[data-action="disable-push"]')?.addEventListener("click", () => { void this.disablePushForCurrentDevice(); });
    root.querySelectorAll<HTMLElement>("[data-poke-emoji]").forEach(node => node.addEventListener("click", async () => {
      if(!this.authUser || this.pokeBusy || (!this.isDeveloperOwner() && this.pokeBalance<1)) return;
      const recipient=node.dataset.pokeRecipient ?? ""; const emoji=node.dataset.pokeEmoji ?? "👋";
      if(!recipient) return;
      this.pokeBusy=true; this.render();
      try { const wallet=await sendPoke(this.authUser,recipient,emoji); this.pokeBalance=wallet.balance; this.showPokeSentBurst(emoji); this.toast(this.locale === "zh-TW" ? `${emoji} Poke 已送出` : `${emoji} Poke sent`); }
      catch(error){ this.toast(this.cloudErrorMessage(error)); }
      finally { this.pokeBusy=false; this.render(); }
    }));
    root.querySelectorAll<HTMLElement>("[data-toggle-poke-mute-user]").forEach(node => node.addEventListener("click", () => {
      const uid=node.dataset.togglePokeMuteUser ?? ""; if(!uid) return;
      this.state.notificationPreferences ??= {goldDays:true,badges:true,pokes:true,mutedPokeUids:[],mutedPokeGroupIds:[]};
      const values=new Set(this.state.notificationPreferences.mutedPokeUids ?? []);
      if(values.has(uid)) values.delete(uid); else values.add(uid);
      this.state.notificationPreferences.mutedPokeUids=[...values];
      this.persist(); this.render(); void this.pushPreferencesToCloud();
    }));
    root.querySelectorAll<HTMLInputElement>("[data-poke-mute-group]").forEach(node => node.addEventListener("change", () => {
      const groupId=node.dataset.pokeMuteGroup ?? ""; if(!groupId) return;
      this.state.notificationPreferences ??= {goldDays:true,badges:true,pokes:true,mutedPokeUids:[],mutedPokeGroupIds:[]};
      const values=new Set(this.state.notificationPreferences.mutedPokeGroupIds ?? []);
      if(node.checked) values.add(groupId); else values.delete(groupId);
      this.state.notificationPreferences.mutedPokeGroupIds=[...values];
      this.persist(); this.render(); void this.pushPreferencesToCloud();
    }));
    root.querySelector('[data-action="refresh-backend-diagnostics"]')?.addEventListener("click", async () => {
      if(!this.authUser || !this.isDeveloperOwner() || this.backendDiagnosticsBusy) return;
      this.backendDiagnosticsBusy=true; this.render();
      try { this.backendDiagnostics=await loadBackendDiagnostics(this.authUser); }
      catch(error){ this.toast(this.cloudErrorMessage(error)); }
      finally { this.backendDiagnosticsBusy=false; this.render(); }
    });
    root.querySelector('[data-action="send-test-notification"]')?.addEventListener("click", async () => {
      if(!this.authUser || !this.isDeveloperOwner() || this.backendDiagnosticsBusy) return;
      this.backendDiagnosticsBusy=true; this.render();
      try { await sendTestNotification(this.authUser); this.toast(this.locale === "zh-TW" ? "測試通知已送出" : "Test notification sent"); this.backendDiagnostics=await loadBackendDiagnostics(this.authUser).catch(()=>this.backendDiagnostics); }
      catch(error){ this.toast(this.cloudErrorMessage(error)); }
      finally { this.backendDiagnosticsBusy=false; this.render(); }
    });

    root.querySelectorAll<HTMLElement>("[data-dev-effect]").forEach(node=>node.addEventListener("click",()=>{
      if(!DEVELOPER_EFFECT_TESTS_V0117 || !this.isDeveloperOwner()) return;
      const action=node.dataset.devEffect;
      const now=Date.now();
      const poke=(index:number,emoji:string):SocialInboxEvent=>({id:`dev-poke-${now}-${index}`,kind:"poke",title:"Developer Poke",body:"",emoji,senderName:this.locale === "zh-TW" ? "測試家人" : "Test family member",createdAtMs:now+index});
      if(action==="poke-one") this.enqueueVisualPresentation({kind:"poke",event:poke(0,"👋")});
      else if(action==="poke-five") ["👋","💪","🔥","🎉","🫡"].forEach((emoji,index)=>this.enqueueVisualPresentation({kind:"poke",event:poke(index,emoji)}));
      else if(action==="large-family-burst") {
        const names=["Dad","Mom","Alex","Bella","Chris","Dana","Evan","Faye","Gabe","Hana","Ivan","June","Kai","Lena"];
        const burst:SocialInboxEvent[]=[];
        // In a 15-person family you have 14 other Gold Day senders. Simulate the
        // recipient flood cap's maximum five Pokes plus all fourteen Gold events.
        names.forEach((name,index)=>burst.push({id:`dev-family-gold-${now}-${index}`,kind:"gold",title:`${name} earned today's Gold Day! ⭐`,body:"",emoji:"⭐",senderName:name,createdAtMs:now+index}));
        ["👋","💪","🔥","🎉","🫡"].forEach((emoji,index)=>burst.push({id:`dev-family-poke-${now}-${index}`,kind:"poke",title:`${names[index]} sent you ${emoji}`,body:"",emoji,senderName:names[index],createdAtMs:now+100+index}));
        this.enqueueSocialEventBatch(burst,false);
      }
      else if(action==="social-gold") this.enqueueVisualPresentation({kind:"social",event:{id:`dev-gold-${now}`,kind:"gold",title:this.locale === "zh-TW" ? "測試家人達成 Gold Day！" : "Test family member earned a Gold Day!",body:this.locale === "zh-TW" ? "這是本機測試，不會傳送通知。" : "Local preview only; no notification was sent.",emoji:"⭐",senderName:"Test",createdAtMs:now}});
      else if(action==="social-badge") this.enqueueVisualPresentation({kind:"social",event:{id:`dev-badge-${now}`,kind:"badge",title:this.locale === "zh-TW" ? "測試家人獲得新徽章！" : "Test family member earned a new badge!",body:this.locale === "zh-TW" ? "這是本機測試，不會改變徽章紀錄。" : "Local preview only; badge records are unchanged.",emoji:"🏅",senderName:"Test",createdAtMs:now}});
      else if(action==="local-gold") this.showMilestoneCelebration("gold",this.locale === "zh-TW" ? "Gold Day 達成！" : "Gold Day!","⭐");
      else if(action==="local-water") this.showMilestoneCelebration("water",this.locale === "zh-TW" ? "今日飲水目標達成！" : "Daily water goal reached!","💧");
      else if(action==="local-badge") this.showMilestoneCelebration("badge",this.locale === "zh-TW" ? "月度徽章達成！" : "Monthly badge earned!","🏅");
      else if(action==="mixed-queue") {
        this.enqueueVisualPresentation({kind:"social",event:{id:`dev-mix-gold-${now}`,kind:"gold",title:this.locale === "zh-TW" ? "爸爸達成 Gold Day！" : "Dad earned a Gold Day!",body:"",emoji:"⭐",senderName:"Dad",createdAtMs:now}});
        this.enqueueVisualPresentation({kind:"poke",event:poke(1,"💪")});
        this.enqueueVisualPresentation({kind:"poke",event:poke(2,"🔥")});
        this.enqueueVisualPresentation({kind:"social",event:{id:`dev-mix-badge-${now}`,kind:"badge",title:this.locale === "zh-TW" ? "家人獲得新徽章！" : "A family member earned a new badge!",body:"",emoji:"🏅",senderName:"Family",createdAtMs:now+3}});
      }
    }));
    root.querySelectorAll<HTMLElement>("[data-dev-calendar-preview]").forEach(node=>node.addEventListener("click",()=>{
      if(!DEVELOPER_EFFECT_TESTS_V0117 || !this.isDeveloperOwner()) return;
      const mode=node.dataset.devCalendarPreview;
      this.developerCalendarPreview=mode === "gold" ? "gold" : mode === "water" ? "water" : null;
      this.render();
    }));


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
      if (value === "all" || value === "live" || value === "logged") this.historyFilter = value;
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
      if (this.authUser && this.cloudMembership?.access.status === "active") {
        this.state.profile!.familyProfileSharing = {
          biologicalSex: data.has("shareBiologicalSex"),
          supplements: data.has("shareSupplements"),
          recentWorkouts: data.has("shareRecentWorkouts"),
          recentHikes: data.has("shareRecentHikes")
        };
      }
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
          this.cloudMembership = await updateMyFamilyDisplayName(this.authUser, this.cloudMembership, this.state.user.displayName, this.state.profile!.biologicalSex, this.familyProfileSharing());
        } catch (error) {
          this.toast(this.cloudErrorMessage(error));
        }
      }
      void this.pushPreferencesToCloud();
      void this.pushProfileToCloud();
      this.render(); this.toast(this.text("profileSaved"));
    });
    root.querySelectorAll<HTMLInputElement>("[data-personal-activity]").forEach(input => input.addEventListener("change", () => {
      const allowed: PersonalActivityId[] = ["hiking","swimming","running","cycling","kickboxing","gym"];
      const value = input.dataset.personalActivity as PersonalActivityId;
      if (!allowed.includes(value)) return;
      const previous = [...(this.state.goals!.personalActivityIds ?? [])];
      let selected = previous.filter(id => id !== value);
      if (input.checked) selected.push(value);
      if (selected.length > 2) {
        input.checked = false;
        this.toast(this.locale === "zh-TW" ? "最多選擇兩項活動" : "Choose no more than two activities");
        return;
      }
      this.state.goals!.personalActivityIds = selected;
      this.state.goals!.personalActivityId = selected[0] ?? "none";
      rememberWeekPlan(this.state.goals!, weekKey());
      this.persist();
      this.render();
      void this.pushPreferencesToCloud();
      void this.refreshFamilyProgress();
    }));
    root.querySelectorAll<HTMLElement>('[data-action="copy-feedback-info"]').forEach(node => node.addEventListener("click", async () => {
      const text=this.anonymousFeedbackInfo();
      try { await navigator.clipboard.writeText(text); this.toast(this.locale === "zh-TW" ? "匿名 App 資訊已複製" : "Anonymous app info copied"); }
      catch { this.toast(text); }
    }));
    root.querySelector('[data-action="open-mission-tutorial"]')?.addEventListener("click", () => { this.missionTutorialOpen = true; this.missionTutorialPage = 0; this.render(); });
    root.querySelectorAll<HTMLElement>('[data-action="close-mission-tutorial"]').forEach(node => node.addEventListener("click", () => { this.missionTutorialOpen = false; this.render(); }));
    const tutorialViewport = root.querySelector<HTMLElement>('.mission-tutorial-viewport');
    const updateTutorialControls = (index:number) => {
      const safe=clamp(index,0,7); this.missionTutorialPage=safe;
      root.querySelectorAll<HTMLElement>('[data-mission-tutorial-page]').forEach(dot=>dot.classList.toggle('active',Number(dot.dataset.missionTutorialPage)===safe));
      const prev=root.querySelector<HTMLButtonElement>('[data-action="mission-tutorial-prev"]');
      const next=root.querySelector<HTMLButtonElement>('[data-action="mission-tutorial-next"]');
      if(prev) prev.disabled=safe===0;
      if(next) next.textContent=safe===7 ? (this.locale === "zh-TW" ? "完成" : "Done") : (this.locale === "zh-TW" ? "下一頁" : "Next");
    };
    const scrollTutorialTo = (index:number) => {
      const safe=clamp(index,0,7); updateTutorialControls(safe);
      tutorialViewport?.scrollTo({left:safe*tutorialViewport.clientWidth,behavior:"smooth"});
    };
    if(tutorialViewport){
      requestAnimationFrame(()=>{ tutorialViewport.scrollLeft=this.missionTutorialPage*tutorialViewport.clientWidth; updateTutorialControls(this.missionTutorialPage); });
      let scrollTimer:number|undefined;
      tutorialViewport.addEventListener('scroll',()=>{
        if(scrollTimer) window.clearTimeout(scrollTimer);
        scrollTimer=window.setTimeout(()=>{
          const index=clamp(Math.round(tutorialViewport.scrollLeft/Math.max(1,tutorialViewport.clientWidth)),0,7);
          updateTutorialControls(index);
        },70);
      },{passive:true});
    }
    root.querySelector('[data-action="mission-tutorial-prev"]')?.addEventListener("click", () => scrollTutorialTo(this.missionTutorialPage - 1));
    root.querySelector('[data-action="mission-tutorial-next"]')?.addEventListener("click", () => { if (this.missionTutorialPage >= 7) { this.missionTutorialOpen=false; this.render(); } else scrollTutorialTo(this.missionTutorialPage + 1); });
    root.querySelectorAll<HTMLElement>('[data-mission-tutorial-page]').forEach(node => node.addEventListener("click", () => scrollTutorialTo(Number(node.dataset.missionTutorialPage ?? 0))));
    root.querySelector('[data-action="toggle-goal-difficulty"]')?.addEventListener("click", () => { this.showGoalDifficultyMenu = !this.showGoalDifficultyMenu; this.previewGoalMode = null; this.render(); });
    root.querySelectorAll<HTMLElement>("[data-goal-mode]").forEach(node=>node.addEventListener("click",()=>{
      const mode=node.dataset.goalMode as GoalDifficulty; if(!["easy","normal","hard","extreme"].includes(mode)) return;
      const goals=this.state.goals!;
      if(this.previewGoalMode !== mode){ this.previewGoalMode = mode; this.showGoalDifficultyMenu = true; this.render(); return; }
      if(goals.difficulty===mode){ this.previewGoalMode = null; this.render(); return; }
      if(goals.difficultyWeek!==weekKey()){ goals.difficultyWeek=weekKey(); goals.difficultyChanges=0; }
      if((goals.difficultyChanges ?? 0)>=3){ this.toast(this.locale === "zh-TW" ? "本週已使用 3 次難度變更" : "You have used all 3 difficulty changes this week"); return; }
      rememberWeekPlan(goals, weekKey()); const preset=goalPreset(mode); goals.weeklyCalories=preset.weeklyCalories; goals.categorySets=preset.categorySets; goals.difficulty=mode; rememberWeekPlan(goals, weekKey()); goals.difficultyChanges=(goals.difficultyChanges ?? 0)+1; this.previewGoalMode=null; this.showGoalDifficultyMenu=false; this.persist(); this.render(); void this.pushPreferencesToCloud(); void this.refreshFamilyProgress();
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

    root.querySelectorAll<HTMLSelectElement>("[data-member-add-group]").forEach(select => select.addEventListener("change", async () => {
      if (!this.authUser || !this.cloudMembership || this.cloudActionBusy) return;
      const uid = select.dataset.memberAddGroup ?? "";
      const groupId = select.value;
      const member = this.cloudMembership.members.find(item => item.uid === uid);
      if (!uid || !groupId || !member || member.groupIds.includes(groupId)) return;
      this.cloudActionBusy = true; this.render();
      try {
        this.cloudMembership = await setFamilyMemberGroups(this.authUser, this.cloudMembership, uid, [...member.groupIds, groupId], member.groupId);
        this.cloudMembershipError = null;
        this.toast(this.locale === "zh-TW" ? "成員群組已更新" : "Member groups updated");
      } catch (error) { this.toast(this.cloudErrorMessage(error)); }
      finally { this.cloudActionBusy = false; this.render(); }
    }));
    root.querySelectorAll<HTMLButtonElement>("[data-member-remove-group]").forEach(button => button.addEventListener("click", async () => {
      if (!this.authUser || !this.cloudMembership || this.cloudActionBusy) return;
      const uid = button.dataset.memberRemoveGroup ?? "";
      const groupId = button.dataset.groupId ?? "";
      const member = this.cloudMembership.members.find(item => item.uid === uid);
      if (!member || member.groupIds.length <= 1 || !member.groupIds.includes(groupId)) return;
      const next = member.groupIds.filter(value => value !== groupId);
      const primary = member.groupId === groupId ? next[0]! : member.groupId;
      this.cloudActionBusy = true; this.render();
      try {
        this.cloudMembership = await setFamilyMemberGroups(this.authUser, this.cloudMembership, uid, next, primary);
        this.cloudMembershipError = null;
        this.toast(this.locale === "zh-TW" ? "成員群組已更新" : "Member groups updated");
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
      this.restSource = null;
      this.workDeadlineKey = null;
      this.restDeadlineKey = null;
      this.pendingSetRemovalKey = null;
      this.state.activeWorkout = null;
      this.persist(); this.navigate("home");
      if (discarded) this.toast(this.locale === "zh-TW" ? "已捨棄未完成運動" : "Unfinished workout discarded", this.text("undo"), () => { this.state.activeWorkout = discarded; this.persist(); this.page = "workout"; this.render(); });
      return;
    }
    if (action.kind === "revoke-member") {
      void this.changeFamilyMemberStatus(action.uid, "revoked");
      return;
    }
    if (action.kind === "skip-set") {
      const workout = this.state.activeWorkout;
      const set = workout?.exercises[action.exerciseIndex]?.sets[action.setIndex];
      if (!workout || !set || this.isEditingActiveWorkout()) { this.render(); return; }
      const next = this.nextStartableSet(workout);
      if (!next || next.exerciseIndex !== action.exerciseIndex || next.setIndex !== action.setIndex || set.startedAt || set.completed || set.skipped) {
        this.toast(this.locale === "zh-TW" ? "只能略過目前下一個項目" : "Only the current next item can be skipped");
        this.render();
        return;
      }
      if (this.restSource) this.endRest(true);
      set.skipped = true;
      set.skippedAt = new Date().toISOString();
      set.completed = false;
      set.completedAt = undefined;
      set.startedAt = undefined;
      const exercise = workout.exercises[action.exerciseIndex];
      if (exercise && exercise.sets.every(candidate => this.setResolved(candidate))) exercise.completedAt ??= set.skippedAt;
      this.persist();
      this.render();
      this.toast(this.locale === "zh-TW" ? "已略過；不會計入訓練進度" : "Skipped; it will not count toward training progress");
      return;
    }
    if (action.kind === "remove-circuit-round") {
      const workout = this.state.activeWorkout;
      if (!workout || workout.routineMode !== "circuit") { this.render(); return; }
      const rounds = Math.max(1, workout.circuitRounds ?? Math.max(...workout.exercises.map(exercise => exercise.sets.length), 1));
      if (rounds <= 1 || action.roundIndex < 0 || action.roundIndex >= rounds) { this.render(); return; }
      if (this.restSource && this.restSource.setIndex >= action.roundIndex) this.endRest(true);
      workout.exercises.forEach(exercise => {
        if (action.roundIndex < exercise.sets.length) exercise.sets.splice(action.roundIndex, 1);
      });
      workout.circuitRounds = rounds - 1;
      this.persist(); this.render();
      this.toast(this.locale === "zh-TW" ? `已移除第 ${action.roundIndex + 1} 輪` : `Round ${action.roundIndex + 1} removed`);
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
      const removed=this.state.routines![index]!; this.state.routines!.splice(index,1); if(this.selectedRoutineManagerId===action.id)this.selectedRoutineManagerId="";if(this.routineDraft?.id===action.id)this.routineDraft=null; this.persist(); this.render();
      this.toast(this.locale === "zh-TW" ? "已刪除已儲存訓練" : "Saved routine deleted", this.text("undo"),()=>{ this.state.routines!.splice(index,0,removed); this.persist(); this.render(); });
      return;
    }
    if (action.kind === "delete-custom-supplement") {
      this.state.customSupplements=(this.state.customSupplements ?? []).filter(item=>item.id!==action.id);
      this.state.sync ??={}; this.state.sync.preferencesDirty=true;
      if(this.editingCustomSupplementId===action.id) this.editingCustomSupplementId=null;
      if(this.supplementDraftId===action.id) this.supplementDraftId=(this.state.customSupplements ?? [])[0]?.id ?? SUPPLEMENTS[0]?.id ?? "";
      this.supplementLogOpen=true; this.customSupplementManagerOpen=true;
      this.persist(); this.render(); void this.pushPreferencesToCloud();
      this.toast(this.locale === "zh-TW" ? "已從我的補充品清單移除；舊紀錄保留" : "Removed from My supplements; old history was kept");
      return;
    }
    if (action.kind === "delete-workout") {
      const index = this.state.workouts.findIndex(item => item.id === action.id);
      if (index < 0) { this.render(); return; }
      const removed = this.state.workouts[index];
      if (!removed) { this.render(); return; }
      this.markFamilyDate(removed.completedAt);
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
        this.markFamilyDate(removed.completedAt);
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
    this.markFamilyDate(removed.date);
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
      this.markFamilyDate(removed.date);
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

  private prepareTimerAudio(): void {
    if (!this.state.workoutPreferences?.restTimerSound) return;
    try {
      const nav = navigator as any;
      // "transient" maps to a mixing/ambient-style session on supported iOS
      // versions, so a short LogTogether cue does not seize the audio session
      // from YouTube / Music. The trade-off is that the OS may still suppress
      // it in Silent mode; visual/vibration deadline feedback remains.
      if (nav.audioSession && "type" in nav.audioSession) nav.audioSession.type = "transient";
      const make = (src: string) => {
        const audio = new Audio(src);
        audio.preload = "auto";
        audio.setAttribute("playsinline", "");
        audio.muted = false;
        audio.volume = 1;
        return audio;
      };
      this.timerAudioSingle ??= make("/timer-cue-single.mp3");
      this.timerAudioDouble ??= make("/timer-cue-double.mp3");
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextCtor) {
        this.audioContext ??= new AudioContextCtor();
        if (this.audioContext.state === "suspended") void this.audioContext.resume();
      }
    } catch { /* Timer cues are best-effort and must never block a workout. */ }
  }

  private playWebAudioCue(count: 1 | 2): void {
    const context = this.audioContext;
    if (!context) return;
    const now = context.currentTime;
    Array.from({ length: count }, (_, index) => index * 0.21).forEach(offset => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 920;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.22, now + offset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.11);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.12);
    });
  }

  private playTimerCue(count: 1 | 2, deadline = false): void {
    if (deadline) {
      document.documentElement.classList.add("rest-alert-flash");
      window.setTimeout(() => document.documentElement.classList.remove("rest-alert-flash"), 900);
      try { if ("vibrate" in navigator) (navigator as any).vibrate([160, 80, 160]); } catch {}
    }
    if (!this.state.workoutPreferences?.restTimerSound) return;
    this.prepareTimerAudio();
    try {
      const nav = navigator as any;
      if (nav.audioSession && "type" in nav.audioSession) nav.audioSession.type = "transient";
      const audio = count === 1 ? this.timerAudioSingle : this.timerAudioDouble;
      if (audio) {
        audio.currentTime = 0;
        void audio.play().catch(() => this.playWebAudioCue(count));
        return;
      }
    } catch { /* Fall through to WebAudio. */ }
    this.playWebAudioCue(count);
  }

  private playRestCompleteBeep(): void {
    this.playTimerCue(2, true);
  }

  private async syncWakeLock(): Promise<void> {
    const shouldHold=Boolean(this.state.workoutPreferences?.keepScreenAwake && this.state.activeWorkout && !this.isEditingActiveWorkout() && this.workoutHasStarted() && !this.workoutAllDone(this.state.activeWorkout));
    if(!shouldHold || document.visibilityState !== "visible"){
      if(this.wakeLock){try{await this.wakeLock.release();}catch{} this.wakeLock=null;}
      return;
    }
    if(this.wakeLock || !("wakeLock" in navigator)) return;
    try {
      this.wakeLock=await (navigator as any).wakeLock.request("screen");
      this.wakeLock.addEventListener?.("release",()=>{this.wakeLock=null;});
    } catch { this.wakeLock=null; }
  }

  private startRest(seconds: number, exerciseIndex: number, setIndex: number): void {
    this.endRest(true);
    this.restSource = { exerciseIndex, setIndex, startedAt: Date.now(), targetSec: Math.max(0, seconds) };
    this.restDeadlineKey = null;
    void this.syncWakeLock();
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
    this.restDeadlineKey = null;
    void this.syncWakeLock();
    this.ensureWorkoutTicker();
    this.updateRestTimerDisplay();
  }

  private processTimerDeadlines(): void {
    const now = Date.now();
    const activeSet = this.latestActiveSet();
    if(activeSet && this.state.activeWorkout){
      const set=this.state.activeWorkout.exercises[activeSet.exerciseIndex]?.sets[activeSet.setIndex];
      const exercise=this.state.activeWorkout.exercises[activeSet.exerciseIndex];
      const definition=exercise ? exerciseById(exercise.exerciseId) : undefined;
      const profile=exercise && definition ? exerciseEntryLoggingProfile(exercise,definition) : "sets";
      const target=workTargetSeconds(set, profile);
      if(target>0){
        const key=`work:${activeSet.exerciseIndex}:${activeSet.setIndex}:${activeSet.startedAt}`;
        if(now-activeSet.startedAt >= target*1000 && this.workDeadlineKey!==key){
          this.workDeadlineKey=key;
          this.playRestCompleteBeep();
        }
      }
    }
    const source=this.restSource;
    if(source && source.targetSec>0){
      const key=`rest:${source.exerciseIndex}:${source.setIndex}:${source.startedAt}`;
      if(now-source.startedAt >= source.targetSec*1000 && this.restDeadlineKey!==key){
        this.restDeadlineKey=key;
        this.playRestCompleteBeep();
      }
    }
  }

  private updateRestTimerDisplay(): void {
    this.processTimerDeadlines();
    const timer = this.workoutTimerSnapshot();
    root.querySelectorAll<HTMLElement>("[data-workout-dock-label]").forEach(node => { if (timer) node.textContent = timer.label; });
    root.querySelectorAll<HTMLElement>("[data-workout-dock-timer]").forEach(node => { if (timer) node.textContent = timer.value; });
    root.querySelectorAll<HTMLElement>("[data-workout-dock-detail]").forEach(node => { if (timer) node.textContent = timer.detail; });
    const box = root.querySelector<HTMLElement>("#rest-timer");
    const value = root.querySelector<HTMLElement>("#rest-timer-value");
    if (!box || !value) { void this.syncWakeLock(); return; }
    const source = this.restSource;
    if (!source) { box.hidden = true; void this.syncWakeLock(); return; }
    box.hidden = false;
    const elapsed = Math.max(0, Math.floor((Date.now() - source.startedAt) / 1000));
    if (source.targetSec <= 0) value.textContent = this.clockText(elapsed);
    else {
      const remaining = source.targetSec - elapsed;
      value.textContent = remaining >= 0 ? this.clockText(remaining) : `+${this.clockText(Math.abs(remaining))}`;
    }
    void this.syncWakeLock();
  }

  private bindWorkoutEvents(): void {
    this.bindRoutineManager();
    const workout = this.state.activeWorkout;
    if (!workout) return;
    const editingExisting = this.state.workouts.some(item => item.id === workout.id);

    root.querySelector<HTMLSelectElement>("#workout-composer-mode")?.addEventListener("change", event => {
      this.workoutComposerMode = (event.currentTarget as HTMLSelectElement).value === "circuit" ? "circuit" : "workout";
      if (this.workoutComposerMode === "workout") this.folds.add("exercise");
      this.render();
    });
    root.querySelectorAll<HTMLSelectElement>("[data-workout-position]").forEach(select=>select.addEventListener("change",()=>{const from=Number(select.dataset.workoutPosition),to=Number(select.value);if(!Number.isInteger(from)||!Number.isInteger(to)||from===to)return;const [moved]=workout.exercises.splice(from,1);if(moved)workout.exercises.splice(to,0,moved);this.persist();this.render();}));
    this.bindSmoothReorder("[data-workout-exercise-drag]","[data-workout-exercise-drag-handle]",(from,to)=>{const [moved]=workout.exercises.splice(from,1);if(moved)workout.exercises.splice(to,0,moved);this.persist();this.render();});

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
      const visible = EXERCISES.filter(exercise => exercise.id !== "hiking_cardio" && (this.exerciseLibraryFilter === "all" || exerciseLibraryGroup(exercise) === this.exerciseLibraryFilter));
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
      const profile = exerciseScienceLoggingProfile(definition);
      const starter=exerciseStarterDefault(definition);
      const metrics = exerciseSessionMetricFlags(definition);
      const repeating=["sets","skill_sets","isometric_sets","balance_hold","loaded_carry","conditioning_intervals","sprint_intervals","static_stretch","dynamic_mobility","rounds","water_skill","skill_drill"].includes(profile);
      const count = repeating ? clamp(Math.round(Number(data.get("sets") ?? starter.sets) || starter.sets),1,12) : 1;
      const numberOrUndefined = (name: string): number | undefined => {
        const raw = String(data.get(name) ?? "").trim();
        if (!raw) return undefined;
        const value = Number(raw);
        return Number.isFinite(value) ? value : undefined;
      };
      const sideRaw=String(data.get("side")??"both");
      const side:SetEntry["side"]=sideRaw==="left"||sideRaw==="right"?sideRaw:"both";
      const restSec=repeating ? clamp(Math.round(numberOrUndefined("rest") ?? starter.restSec),0,900) : 0;
      const sets:SetEntry[]=Array.from({length:count},()=>{
        const entry:SetEntry={id:uid("set"),completed:false,setType:"normal"};
        if(profile==="sets"||profile==="skill_sets"){
          if(definition.type==="weight_reps") entry.weightKg=Math.max(0,numberOrUndefined("weight")??0);
          entry.reps=Math.max(0,Math.round(numberOrUndefined("reps")??starter.reps??0));
          const targetWork=numberOrUndefined("targetWork"); if(targetWork!==undefined && targetWork>0) entry.targetWorkSec=clamp(Math.round(targetWork),1,1800);
        } else if(profile==="isometric_sets"||profile==="balance_hold") entry.durationSec=Math.max(0,Math.round(numberOrUndefined("duration")??starter.durationSec??30));
        else if(profile==="loaded_carry"){
          const load=numberOrUndefined("loadPerHand"); if(load!==undefined) entry.loadPerHandKg=Math.max(0,load);
          const metres=numberOrUndefined("distanceM"); if(metres!==undefined) entry.distanceKm=Math.max(0,metres/1000);
          const duration=numberOrUndefined("duration"); if(duration!==undefined) entry.durationSec=Math.max(0,Math.round(duration));
          entry.recoverySec=restSec;
        } else if(profile==="conditioning_intervals"||profile==="sprint_intervals"){
          const reps=numberOrUndefined("reps"); if(reps!==undefined) entry.reps=Math.max(0,Math.round(reps));
          const duration=numberOrUndefined("duration"); if(duration!==undefined) entry.durationSec=Math.max(0,Math.round(duration));
          const metres=numberOrUndefined("distanceM"); if(metres!==undefined) entry.distanceKm=Math.max(0,metres/1000);
          entry.recoverySec=restSec;
        } else if(profile==="static_stretch"){
          entry.durationSec=Math.max(0,Math.round(numberOrUndefined("duration")??starter.durationSec??30)); entry.side=side;
        } else if(profile==="dynamic_mobility"){
          entry.reps=Math.max(0,Math.round(numberOrUndefined("reps")??starter.reps??8)); entry.side=side;
        } else if(profile==="rounds"||profile==="water_skill"||profile==="skill_drill"){
          const reps=numberOrUndefined("reps"); if(reps!==undefined) entry.reps=Math.max(0,Math.round(reps));
          const duration=numberOrUndefined("duration"); if(duration!==undefined) entry.durationSec=Math.max(0,Math.round(duration));
          entry.recoverySec=restSec;
        } else {
          entry.durationSec=Math.max(0,Math.round((numberOrUndefined("minutes")??starter.minutes??20)*60));
          const distance=numberOrUndefined("distance"); if(metrics.distance&&distance!==undefined) entry.distanceKm=Math.max(0,distance);
          const speed=numberOrUndefined("speed"); if(metrics.speed&&speed!==undefined) entry.speedKph=Math.max(0,speed);
          const incline=numberOrUndefined("incline"); if(metrics.incline&&incline!==undefined) entry.inclinePct=clamp(incline,-10,40);
          const resistance=numberOrUndefined("resistance"); if(metrics.resistance&&resistance!==undefined) entry.resistanceLevel=clamp(resistance,0,100);
          const laps=numberOrUndefined("laps"); if(metrics.laps&&laps!==undefined) entry.laps=Math.max(0,Math.round(laps));
          const cadence=numberOrUndefined("cadence"); if(metrics.cadence&&cadence!==undefined) entry.cadenceRpm=Math.max(0,Math.round(cadence));
          const stroke=numberOrUndefined("strokeRate"); if(metrics.strokeRate&&stroke!==undefined) entry.strokeRateSpm=Math.max(0,Math.round(stroke));
          const pace=numberOrUndefined("pace500"); if(metrics.pace500&&pace!==undefined) entry.pace500Sec=Math.max(0,Math.round(pace));
          const vertical=numberOrUndefined("vertical"); if(metrics.vertical&&vertical!==undefined) entry.verticalGainM=Math.max(0,Math.round(vertical));
          const pack=numberOrUndefined("packWeight"); if(metrics.packWeight&&pack!==undefined) entry.packWeightKg=Math.max(0,pack);
        }
        return entry;
      });
      workout.exercises.push({
        id:uid("exercise"),exerciseId,restSec,notes:"",sets,
        recordingProfile:profile,recordingProfileVersion:2,
        ...(starter.repMin!==undefined?{targetRepMin:starter.repMin}:{}),
        ...(starter.repMax!==undefined?{targetRepMax:starter.repMax}:{})
      });
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
      if (!input.checkValidity()) return;
      const raw = Number(input.value);
      const value = Number.isFinite(raw) ? raw : 0;
      if (input.dataset.setField === "weight") set.weightKg = Math.max(0, value);
      else if (input.dataset.setField === "reps") set.reps = Math.max(0, Math.round(value));
      else if (input.dataset.setField === "targetWork") set.targetWorkSec = input.value.trim() ? clamp(Math.round(value),0,1800) : undefined;
      else if (input.dataset.setField === "duration") set.durationSec = Math.max(0, Math.round(value));
      else if (input.dataset.setField === "distance") set.distanceKm = Math.max(0, value);
      else if (input.dataset.setField === "minutes") set.durationSec = Math.max(0, Math.round(value * 60));
      else if (input.dataset.setField === "speed") set.speedKph = Math.max(0, value);
      else if (input.dataset.setField === "incline") set.inclinePct = clamp(value, -10, 40);
      else if (input.dataset.setField === "resistance") set.resistanceLevel = clamp(value, 0, 100);
      else if (input.dataset.setField === "laps") set.laps = Math.max(0, Math.round(value));
      else if (input.dataset.setField === "loadPerHand") set.loadPerHandKg = Math.max(0, value);
      else if (input.dataset.setField === "distanceM") set.distanceKm = Math.max(0, value / 1000);
      else if (input.dataset.setField === "cadence") set.cadenceRpm = Math.max(0, Math.round(value));
      else if (input.dataset.setField === "strokeRate") set.strokeRateSpm = Math.max(0, Math.round(value));
      else if (input.dataset.setField === "pace500") set.pace500Sec = Math.max(0, Math.round(value));
      else if (input.dataset.setField === "vertical") set.verticalGainM = Math.max(0, Math.round(value));
      else if (input.dataset.setField === "packWeight") set.packWeightKg = Math.max(0, value);
      if (set.completed && ["duration","minutes"].includes(input.dataset.setField ?? "")) set.actualDurationSec = set.durationSec;
      this.persist();
    }));

    root.querySelectorAll<HTMLSelectElement>("[data-set-side]").forEach(select => select.addEventListener("change", () => {
      const exerciseIndex = Number(select.dataset.exerciseIndex);
      const setIndex = Number(select.dataset.setIndex);
      const set = workout.exercises[exerciseIndex]?.sets[setIndex];
      if (!set) return;
      const value = select.value;
      set.side = value === "left" || value === "right" ? value : "both";
      this.persist();
    }));

    root.querySelectorAll<HTMLInputElement>("[data-work-target-sec]").forEach(input => input.addEventListener("change", () => {
      const exerciseIndex = Number(input.dataset.workTargetSec);
      const exercise = workout.exercises[exerciseIndex];
      if (!exercise || editingExisting) return;
      const raw = input.value.trim();
      const seconds = raw ? clamp(Math.round(Number(raw) || 0), 0, 1800) : 0;
      for (const set of exercise.sets) {
        if (!set.startedAt && !set.completed && !set.skipped) set.targetWorkSec = seconds > 0 ? seconds : undefined;
      }
      input.value = seconds > 0 ? String(seconds) : "";
      this.persist();
      this.updateRestTimerDisplay();
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
      this.confirmAction = { kind: "remove-circuit-round", roundIndex };
      this.render();
    }));

    root.querySelectorAll<HTMLButtonElement>("[data-skip-set]").forEach(button => button.addEventListener("click", () => {
      const exerciseIndex = Number(button.dataset.exerciseIndex);
      const setIndex = Number(button.dataset.setIndex);
      const set = workout.exercises[exerciseIndex]?.sets[setIndex];
      const next = this.nextStartableSet(workout);
      if (!set || !next || next.exerciseIndex !== exerciseIndex || next.setIndex !== setIndex || set.startedAt || set.completed || set.skipped) return;
      this.confirmAction = { kind: "skip-set", exerciseIndex, setIndex };
      this.render();
    }));

    root.querySelectorAll<HTMLButtonElement>("[data-start-set]").forEach(button => button.addEventListener("click", () => {
      const exerciseIndex = Number(button.dataset.exerciseIndex);
      const setIndex = Number(button.dataset.setIndex);
      const exercise = workout.exercises[exerciseIndex];
      const set = exercise?.sets[setIndex];
      if (!exercise || !set || editingExisting || set.completed || set.skipped) return;
      const nextStart = this.nextStartableSet(workout);
      if (!nextStart || nextStart.exerciseIndex !== exerciseIndex || nextStart.setIndex !== setIndex) {
        this.toast(this.locale === "zh-TW" ? "請依照訓練順序完成前一項" : "Finish the previous item first");
        return;
      }
      this.releaseWorkoutInputFocus();
      if (this.restSource) this.endRest(true);
      const now = new Date().toISOString();
      const firstStartedSet = !workout.exercises.some(item => item.sets.some(candidate => Boolean(candidate.startedAt)));
      if (firstStartedSet) workout.startedAt = now;
      set.skipped = false;
      set.skippedAt = undefined;
      const definition = exerciseById(exercise.exerciseId);
      set.timerTargetSec = workTargetSeconds(set, definition ? exerciseEntryLoggingProfile(exercise, definition) : "sets");
      set.startedAt = now;
      exercise.startedAt ??= now;
      this.workDeadlineKey = null;
      this.playTimerCue(1, false);
      void this.syncWakeLock();
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
        this.releaseWorkoutInputFocus();
        if (this.restSource) this.endRest(true);
        const now = new Date().toISOString();
        const firstStartedSet = !workout.exercises.some(item => item.sets.some(candidate => Boolean(candidate.startedAt)));
        set.startedAt ??= now;
        if (firstStartedSet) workout.startedAt = set.startedAt;
        set.completedAt = now;
        set.actualDurationSec = Math.max(0, Math.round((Date.parse(now)-Date.parse(set.startedAt))/1000));
        exercise.startedAt ??= set.startedAt;
        this.playTimerCue(1, false);
        this.workDeadlineKey = null;
        void this.syncWakeLock();
      }
      set.skipped = false;
      set.skippedAt = undefined;
      set.completed = completing;
      if (!completing && !editingExisting) {
        set.completedAt = undefined;
        set.actualDurationSec = undefined;
        set.timerTargetSec = undefined;
        set.restAfterSec = undefined;
        exercise.completedAt = undefined;
        exercise.difficulty = undefined;
      }
      const allDone = exercise.sets.length > 0 && exercise.sets.every(item => this.setResolved(item));
      if (allDone && !editingExisting) exercise.completedAt = set.completedAt ?? new Date().toISOString();
      this.persist();
      this.render();
      const workoutDone = this.workoutAllDone(workout);
      const completedDefinition = exerciseById(exercise.exerciseId);
      const completedProfile = completedDefinition ? exerciseEntryLoggingProfile(exercise, completedDefinition) : "sets";
      if (completing && !editingExisting && !workoutDone && exercise.restSec > 0 && this.profileUsesRest(completedProfile)) this.startRest(exercise.restSec, exerciseIndex, setIndex);
    }));

    root.querySelectorAll<HTMLButtonElement>("[data-add-set]").forEach(button => button.addEventListener("click", () => {
      const exerciseIndex = Number(button.dataset.addSet);
      const exercise = workout.exercises[exerciseIndex];
      if (!exercise) return;
      const previous = exercise.sets.at(-1);
      exercise.sets.push({
        id: uid("set"), weightKg: previous?.weightKg, reps: previous?.reps, targetWorkSec: previous?.targetWorkSec, durationSec: previous?.durationSec, distanceKm: previous?.distanceKm,
        speedKph: previous?.speedKph, inclinePct: previous?.inclinePct, resistanceLevel: previous?.resistanceLevel, laps: previous?.laps,
        recoverySec: previous?.recoverySec, loadPerHandKg: previous?.loadPerHandKg, cadenceRpm: previous?.cadenceRpm, strokeRateSpm: previous?.strokeRateSpm,
        pace500Sec: previous?.pace500Sec, verticalGainM: previous?.verticalGainM, packWeightKg: previous?.packWeightKg, side: previous?.side,
        completed: false, setType: previous?.setType ?? "normal"
      });
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
      this.state.routines!.unshift(routine);
      this.persist(); this.toast(this.text("routineSaved"));
    });

    root.querySelector('[data-action="finish-workout"]')?.addEventListener("click", () => {
      if (workout.exercises.length === 0) { this.toast(this.text("workoutEmptyError")); return; }
      if (!editingExisting && !workout.exercises.some(exercise => exercise.sets.some(set => set.completed))) {
        this.toast(this.locale === "zh-TW" ? "所有項目都被略過了；請捨棄這次運動，而不是儲存空紀錄。" : "Everything was skipped. Discard this workout instead of saving an empty record.");
        return;
      }
      const todayKey=localDateKey(new Date());
      const goldBefore=meaningfulActivityScoreOnDate(this.state.workouts,this.state.hikes,todayKey)>=1;
      workout.routineName = workout.routineName.trim() || (this.locale === "zh-TW" ? "運動" : "Workout");
      const existingIndex = this.state.workouts.findIndex(item => item.id === workout.id);
      const nowIso = new Date().toISOString();
      if (existingIndex >= 0) {
        const existing = this.state.workouts[existingIndex]!;
        this.markFamilyDate(existing.completedAt);
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
      this.markFamilyDate(workout.completedAt);
      workout.updatedAt = nowIso;
      workout.estimatedCalories = undefined;
      workout.estimatedCalories = this.workoutCaloriesForSync(workout);
      if (existingIndex >= 0) this.state.workouts[existingIndex] = workout;
      else this.state.workouts.unshift(workout);
      const goldAfter=meaningfulActivityScoreOnDate(this.state.workouts,this.state.hikes,todayKey)>=1;
      this.endRest(true);
      this.state.activeWorkout = null;
      this.persist();
      if(!editingExisting && !goldBefore && goldAfter) this.celebrateOnce("gold",todayKey,this.locale === "zh-TW" ? "今日 Gold Day 達成！" : "Gold Day achieved!","⭐");
      this.navigate("history"); this.toast(existingIndex >= 0 ? this.text("saveChanges") : this.text("workoutSaved"));
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
        recordingSource: existing?.recordingSource ?? (this.pendingHikeGpx ? "imported" : "manual"),
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
      const hikeGoldBefore = meaningfulActivityScoreOnDate(this.state.workouts,this.state.hikes,record.date) >= 1;
      this.markFamilyDate(existing?.date);
      this.markFamilyDate(record.date);
      if (existingIndex >= 0) this.state.hikes[existingIndex] = record;
      else this.state.hikes.unshift(record);
      const hikeGoldAfter = meaningfulActivityScoreOnDate(this.state.workouts,this.state.hikes,record.date) >= 1;
      this.pendingHikeGpx = null;
      this.editingHikeId = null;
      this.selectedCalendarDate = record.date;
      this.calendarMonth = new Date(`${record.date}T12:00:00`);
      this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth(), 1);
      this.persist();
      if(existingIndex < 0 && !hikeGoldBefore && hikeGoldAfter) this.celebrateOnce("gold",record.date,this.locale === "zh-TW" ? "今日 Gold Day 達成！" : "Gold Day achieved!","⭐");
      this.navigate("history"); void this.pushHikeToCloud(record);
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
