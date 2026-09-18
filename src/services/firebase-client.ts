import type { CustomSupplement, FamilyProfileSharing, GoalConfig, HikeBadgePreference, HikeRecord, HydrationDay, Locale, NotificationPreferences, ProfileData, SupplementDay, SupplementUnit, Theme, WorkoutRecord } from "../core/types.js";

declare global {
  interface Window {
    __LOGTOGETHER_CONFIG__?: {
      mode?: "demo" | "firebase";
      firebase?: Record<string, string> | null;
      appCheckSiteKey?: string | null;
      appCheckProvider?: "recaptcha-enterprise" | "recaptcha-v3";
      pushPublicKey?: string | null;
      feedbackFormUrl?: string | null;
    };
    // Backward-compatible with the prototype config key.
    __FAMILY_EXERCISE_CONFIG__?: {
      mode?: "demo" | "firebase";
      firebase?: Record<string, string> | null;
      appCheckSiteKey?: string | null;
      appCheckProvider?: "recaptcha-enterprise" | "recaptcha-v3";
      pushPublicKey?: string | null;
      feedbackFormUrl?: string | null;
    };
  }
}

const FIREBASE_VERSION = "12.19.0";
const INVITE_LIFETIME_MS = 6 * 24 * 60 * 60 * 1000;
const GOOGLE_REDIRECT_MARKER = "logtogether-google-redirect-pending-v0113";

type FirebaseRuntimeConfig = NonNullable<Window["__LOGTOGETHER_CONFIG__"]>;

export interface FirebaseAuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  photoURL: string | null;
}

export const DEFAULT_GROUP_ID = "default";

export interface CloudAccessRecord {
  schemaVersion: 1;
  familyId: string;
  role: "owner" | "member";
  status: "active" | "revoked";
  inviteId: string;
  groupId: string;
  shareGroupIds: string[];
  legacyGroupModel: boolean;
}

export interface CloudFamilyRecord {
  id: string;
  schemaVersion: 1;
  ownerId: string;
  name: string;
}

export interface CloudFamilyMember {
  uid: string;
  familyId: string;
  role: "owner" | "member";
  status: "active" | "revoked";
  inviteId: string;
  groupId: string;
  shareGroupIds: string[];
  legacyGroupModel: boolean;
  displayName?: string;
  photoURL?: string;
  biologicalSex?: ProfileData["biologicalSex"];
  profileSharing?: FamilyProfileSharing;
  identitySeeded?: boolean;
}

export interface CloudGroup {
  id: string;
  schemaVersion: 1;
  name: string;
}

export interface CloudMembership {
  access: CloudAccessRecord;
  family: CloudFamilyRecord | null;
  members: CloudFamilyMember[];
  groups: CloudGroup[];
}


export interface CloudWorkoutEnvelope {
  workout: WorkoutRecord;
  estimatedCalories: number;
  updatedAtMs: number;
}

export interface CloudWorkoutSnapshot {
  own: CloudWorkoutEnvelope[];
  familyShared: CloudWorkoutEnvelope[];
}

export interface CloudHikeEnvelope {
  hike: HikeRecord;
  updatedAtMs: number;
}

export interface CloudHikeSnapshot {
  own: CloudHikeEnvelope[];
  familyShared: CloudHikeEnvelope[];
}

export interface CloudSupplementDay extends SupplementDay {
  schemaVersion: 1;
  ownerId: string;
  familyId: string;
  clientUpdatedAt: string;
}

export interface CloudWeeklySupplementTotal {
  supplementId: string;
  customLabel?: string;
  amount: number;
  unit?: SupplementUnit;
  entries: number;
  days: number;
  mixedUnits: boolean;
}

export interface CloudFamilyWeeklySummary {
  schemaVersion: 1;
  ownerId: string;
  familyId: string;
  weekStart: string;
  difficulty?: GoalConfig["difficulty"];
  weeklyCalories: number;
  workoutCount: number;
  hikeCount: number;
  hikeKm: number;
  calorieDays: number;
  waterDays: number;
  categoriesHit: number;
  missionScore: number;
  missionMax: number;
  supplements: CloudWeeklySupplementTotal[];
  clientUpdatedAt: string;
}


export interface CloudUserPreferences {
  schemaVersion: 1;
  ownerId: string;
  familyId: string;
  locale: Locale;
  theme: Theme;
  simpleMode: boolean;
  accentColor: string;
  weeklyWorkoutGoal: number;
  goals: GoalConfig;
  hikeBadgePreferences: HikeBadgePreference[];
  profileSharing: FamilyProfileSharing;
  notificationPreferences: NotificationPreferences;
  notificationDefaultsV11_1Applied?: boolean;
  customSupplements?: CustomSupplement[];
  clientUpdatedAt: string;
}

export interface CloudBodyMetrics {
  schemaVersion: 1;
  ownerId: string;
  familyId: string;
  heightCm?: number;
  biologicalSex?: ProfileData["biologicalSex"];
  weightEntries: ProfileData["weightEntries"];
  clientUpdatedAt: string;
}

export interface CloudFamilyDailySummary {
  schemaVersion: 1;
  ownerId: string;
  familyId: string;
  date: string;
  calories: number;
  waterMl: number;
  workoutCount: number;
  goldDay: boolean;
  clientUpdatedAt: string;
}

export interface CloudBadgeRecord {
  id: string;
  schemaVersion: 1;
  ownerId: string;
  familyId: string;
  visibility: "family";
  selectedViewerIds: string[];
  badgeType: "monthly" | "hike";
  title: string;
  subtitle: string;
  earnedAt: string;
  sortOrder?: number;
  sourceHikeId?: string;
}

export interface CloudCompanionSnapshot {
  preferences: CloudUserPreferences | null;
  bodyMetrics: CloudBodyMetrics | null;
  hydration: HydrationDay[];
  supplements: CloudSupplementDay[];
  familyDaily: CloudFamilyDailySummary[];
  familyWeekly: CloudFamilyWeeklySummary[];
  ownBadges: CloudBadgeRecord[];
  familyBadges: CloudBadgeRecord[];
}

export interface SocialInboxEvent {
  id: string;
  kind: "poke" | "gold" | "badge";
  title: string;
  body: string;
  url?: string;
  emoji?: string;
  senderUid?: string;
  senderName?: string;
  createdAtMs: number;
}

export interface CreatedFamilyInvite {
  id: string;
  emailLower: string;
  familyId: string;
  groupId: string;
  expiresAtMs: number;
}

let app: any = null;
let appModule: any = null;
let auth: any = null;
let authModule: any = null;
let firestore: any = null;
let firestoreModule: any = null;
let appCheckModule: any = null;
let appCheck: any = null;
let functions: any = null;
let functionsModule: any = null;
let appCheckState: "not-configured" | "initializing" | "active" | "error" = "not-configured";
let appCheckError: string | null = null;

function runtimeConfig(): FirebaseRuntimeConfig | undefined {
  return window.__LOGTOGETHER_CONFIG__ ?? window.__FAMILY_EXERCISE_CONFIG__;
}

export function cloudModeEnabled(): boolean {
  const config = runtimeConfig();
  return config?.mode === "firebase" && Boolean(config.firebase);
}

export interface AppCheckRuntimeStatus {
  state: "not-configured" | "initializing" | "active" | "error";
  provider: "recaptcha-enterprise" | "recaptcha-v3";
  error?: string;
}

export function appCheckRuntimeStatus(): AppCheckRuntimeStatus {
  const config = runtimeConfig();
  const provider = config?.appCheckProvider === "recaptcha-v3" ? "recaptcha-v3" : "recaptcha-enterprise";
  return {
    state: appCheckState,
    provider,
    ...(appCheckError ? { error: appCheckError } : {})
  };
}

async function ensureAppCheck(firebaseApp: any): Promise<void> {
  const config = runtimeConfig();
  const siteKey = config?.appCheckSiteKey?.trim();
  if (!siteKey) {
    appCheckState = "not-configured";
    appCheckError = null;
    return;
  }
  if (appCheck || appCheckState === "active") return;
  appCheckState = "initializing";
  appCheckError = null;
  try {
    const appCheckUrl = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app-check.js`;
    appCheckModule = await import(appCheckUrl);
    const provider = config?.appCheckProvider === "recaptcha-v3"
      ? new appCheckModule.ReCaptchaV3Provider(siteKey)
      : new appCheckModule.ReCaptchaEnterpriseProvider(siteKey);
    appCheck = appCheckModule.initializeAppCheck(firebaseApp, { provider, isTokenAutoRefreshEnabled: true });
    appCheckState = "active";
  } catch (error) {
    appCheckState = "error";
    appCheckError = error instanceof Error ? error.message : "App Check initialization failed";
    // Monitoring-mode rollout must not make the offline/local app unusable.
    // If enforcement is enabled later, the Settings status makes this failure visible.
    console.warn("Firebase App Check:", error);
  }
}

async function ensureApp(): Promise<any | null> {
  if (!cloudModeEnabled()) return null;
  if (app) return app;

  const config = runtimeConfig()?.firebase;
  if (!config) return null;

  const appUrl = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`;
  appModule = await import(appUrl);
  app = appModule.initializeApp(config);
  await ensureAppCheck(app);
  return app;
}

async function ensureAuth(): Promise<any | null> {
  const firebaseApp = await ensureApp();
  if (!firebaseApp) return null;
  if (auth) return auth;

  const authUrl = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`;
  const loadedAuthModule = await import(authUrl);
  authModule = loadedAuthModule;
  // v0.11.3 uses Firebase's supported persistence fallback chain. Private /
  // restricted browser sessions can fall back instead of silently losing the
  // Google session after a successful account chooser.
  auth = loadedAuthModule.initializeAuth(firebaseApp, {
    persistence: [
      loadedAuthModule.indexedDBLocalPersistence,
      loadedAuthModule.browserLocalPersistence,
      loadedAuthModule.browserSessionPersistence
    ],
    popupRedirectResolver: loadedAuthModule.browserPopupRedirectResolver
  });
  return auth;
}

async function ensureFirestore(): Promise<any | null> {
  const firebaseApp = await ensureApp();
  if (!firebaseApp) return null;
  if (firestore) return firestore;

  const firestoreUrl = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`;
  firestoreModule = await import(firestoreUrl);
  firestore = firestoreModule.getFirestore(firebaseApp);
  return firestore;
}

async function ensureFunctions(): Promise<any | null> {
  const firebaseApp = await ensureApp();
  if (!firebaseApp) return null;
  if (functions) return functions;
  const functionsUrl = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-functions.js`;
  functionsModule = await import(functionsUrl);
  functions = functionsModule.getFunctions(firebaseApp, "asia-east1");
  return functions;
}

function publicUser(user: any): FirebaseAuthUser | null {
  if (!user) return null;
  return {
    uid: String(user.uid),
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    emailVerified: Boolean(user.emailVerified),
    photoURL: user.photoURL ?? null
  };
}

export function normalizeInviteEmail(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function normalizeInviteCode(value: string): string {
  return value.trim();
}

function requireSignedInUser(user: FirebaseAuthUser): void {
  if (!user.uid) throw new Error("A signed-in Firebase user is required.");
}

function normalizedGroupId(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : DEFAULT_GROUP_ID;
}

function normalizedGroupIds(value: unknown, fallback: string[] = [DEFAULT_GROUP_ID]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return [...new Set(value.filter(item => typeof item === "string" && item.trim()).map(item => String(item).trim().slice(0, 80)))].slice(0, 20);
}

function parseAccess(data: Record<string, any>): CloudAccessRecord {
  if (data.schemaVersion !== 1) throw new Error("Unsupported access record schema.");
  if (typeof data.familyId !== "string" || !data.familyId) throw new Error("Invalid family access record.");
  if (data.role !== "owner" && data.role !== "member") throw new Error("Invalid family role.");
  if (data.status !== "active" && data.status !== "revoked") throw new Error("Invalid family access status.");
  if (typeof data.inviteId !== "string") throw new Error("Invalid family invite reference.");
  const legacyGroupModel = typeof data.groupId !== "string";
  const groupId = normalizedGroupId(data.groupId);
  return {
    schemaVersion: 1,
    familyId: data.familyId,
    role: data.role,
    status: data.status,
    inviteId: data.inviteId,
    groupId,
    shareGroupIds: data.role === "owner" ? normalizedGroupIds(data.shareGroupIds, [groupId]) : [groupId],
    legacyGroupModel
  };
}

function parseProfileSharing(value: any): FamilyProfileSharing {
  return {
    biologicalSex: value?.biologicalSex !== false,
    supplements: value?.supplements !== false,
    recentWorkouts: value?.recentWorkouts !== false,
    recentHikes: value?.recentHikes !== false
  };
}

function parseNotificationPreferences(value: any): NotificationPreferences {
  const cleanIds = (items:any) => Array.isArray(items) ? items.filter((item:any)=>typeof item === "string" && item.length > 0).slice(0,100) : [];
  return {
    goldDays: value?.goldDays !== false,
    badges: value?.badges !== false,
    pokes: value?.pokes !== false,
    mutedPokeUids: cleanIds(value?.mutedPokeUids),
    mutedPokeGroupIds: cleanIds(value?.mutedPokeGroupIds)
  };
}

function parseMember(data: Record<string, any>): CloudFamilyMember {
  if (data.schemaVersion !== 1) throw new Error("Unsupported family member schema.");
  if (typeof data.uid !== "string" || typeof data.familyId !== "string") throw new Error("Invalid family member record.");
  if (data.role !== "owner" && data.role !== "member") throw new Error("Invalid family member role.");
  if (data.status !== "active" && data.status !== "revoked") throw new Error("Invalid family member status.");
  if (typeof data.inviteId !== "string") throw new Error("Invalid family member invite reference.");
  const legacyGroupModel = typeof data.groupId !== "string";
  const groupId = normalizedGroupId(data.groupId);
  return {
    uid: data.uid,
    familyId: data.familyId,
    role: data.role,
    status: data.status,
    inviteId: data.inviteId,
    groupId,
    shareGroupIds: data.role === "owner" ? normalizedGroupIds(data.shareGroupIds, [groupId]) : [groupId],
    legacyGroupModel,
    displayName: typeof data.displayName === "string" ? data.displayName : undefined,
    photoURL: typeof data.photoURL === "string" ? data.photoURL : undefined,
    biologicalSex: ["female", "male", "other", "prefer_not"].includes(data.biologicalSex) ? data.biologicalSex : undefined,
    profileSharing: parseProfileSharing(data.profileSharing),
    identitySeeded: data.identitySeeded === true
  };
}

function parseGroup(snapshot: any): CloudGroup {
  const data = snapshot.data() as Record<string, any>;
  if (data.schemaVersion !== 1 || typeof data.name !== "string" || !data.name.trim()) throw new Error("Invalid family group.");
  return { id: snapshot.id, schemaVersion: 1, name: data.name.trim().slice(0, 80) };
}

export async function observeFirebaseAuth(
  callback: (user: FirebaseAuthUser | null) => void
): Promise<() => void> {
  const instance = await ensureAuth();
  if (!instance || !authModule) {
    callback(null);
    return () => undefined;
  }
  return authModule.onAuthStateChanged(instance, (user: any) => callback(publicUser(user)));
}

export type GoogleSignInResult =
  | { mode: "popup"; user: FirebaseAuthUser }
  | { mode: "redirect" };

export function googleSignInRedirectPending(): boolean {
  try { return sessionStorage.getItem(GOOGLE_REDIRECT_MARKER) === "1"; }
  catch { return false; }
}

export async function consumeGoogleRedirectSignIn(): Promise<FirebaseAuthUser | null> {
  if (!googleSignInRedirectPending()) return null;
  const instance = await ensureAuth();
  if (!instance || !authModule) throw new Error("Firebase Authentication is not configured.");
  try {
    const result = await authModule.getRedirectResult(instance);
    return publicUser(result?.user ?? instance.currentUser);
  } finally {
    try { sessionStorage.removeItem(GOOGLE_REDIRECT_MARKER); } catch { /* Session storage can be unavailable in hardened browsers. */ }
  }
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const instance = await ensureAuth();
  if (!instance || !authModule) throw new Error("Firebase Authentication is not configured.");

  const provider = new authModule.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const credential = await authModule.signInWithPopup(instance, provider);
    const user = publicUser(credential?.user ?? instance.currentUser);
    if (!user) throw new Error("Google sign-in completed without a Firebase user.");
    return { mode: "popup", user };
  } catch (error: any) {
    const redirectFallbackCodes = new Set([
      "auth/popup-blocked",
      "auth/operation-not-supported-in-this-environment",
      "auth/web-storage-unsupported"
    ]);
    if (redirectFallbackCodes.has(String(error?.code ?? ""))) {
      try { sessionStorage.setItem(GOOGLE_REDIRECT_MARKER, "1"); } catch { /* Redirect can still proceed. */ }
      await authModule.signInWithRedirect(instance, provider);
      return { mode: "redirect" };
    }
    throw error;
  }
}

export async function signOutFirebase(): Promise<void> {
  const instance = await ensureAuth();
  if (!instance || !authModule) return;
  await authModule.signOut(instance);
}

export async function loadCloudMembership(user: FirebaseAuthUser): Promise<CloudMembership | null> {
  requireSignedInUser(user);
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");

  const accessRef = firestoreModule.doc(db, "access", user.uid);
  const accessSnapshot = await firestoreModule.getDoc(accessRef);
  if (!accessSnapshot.exists()) return null;

  const access = parseAccess(accessSnapshot.data());
  if (access.status !== "active") {
    return { access, family: null, members: [], groups: [] };
  }

  const familyRef = firestoreModule.doc(db, "families", access.familyId);
  const membersRef = firestoreModule.collection(db, "families", access.familyId, "members");
  const groupsRef = firestoreModule.collection(db, "families", access.familyId, "groups");
  const familySnapshot = await firestoreModule.getDoc(familyRef);

  const family = familySnapshot.exists()
    ? {
        id: familySnapshot.id,
        schemaVersion: familySnapshot.data().schemaVersion,
        ownerId: familySnapshot.data().ownerId,
        name: familySnapshot.data().name
      } as CloudFamilyRecord
    : null;

  if (family && (family.schemaVersion !== 1 || typeof family.ownerId !== "string" || typeof family.name !== "string")) {
    throw new Error("Invalid family document.");
  }

  let members: CloudFamilyMember[] = [];
  let groups: CloudGroup[] = [];
  if (access.role === "owner" || access.legacyGroupModel) {
    const [membersSnapshot, groupsSnapshot] = await Promise.all([
      firestoreModule.getDocs(membersRef),
      access.role === "owner" ? firestoreModule.getDocs(groupsRef) : Promise.resolve(null)
    ]);
    members = membersSnapshot.docs.map((snapshot: any) => parseMember(snapshot.data()));
    groups = groupsSnapshot ? groupsSnapshot.docs.map(parseGroup) : [];
  } else {
    const [membersSnapshot, groupSnapshot] = await Promise.all([
      firestoreModule.getDocs(firestoreModule.query(
        membersRef,
        firestoreModule.where("groupId", "==", access.groupId),
        firestoreModule.where("status", "==", "active"),
        firestoreModule.where("role", "==", "member")
      )),
      firestoreModule.getDoc(firestoreModule.doc(db, "families", access.familyId, "groups", access.groupId))
    ]);
    members = membersSnapshot.docs.map((snapshot: any) => parseMember(snapshot.data()));
    groups = groupSnapshot.exists() ? [parseGroup(groupSnapshot)] : [{ id: access.groupId, schemaVersion: 1, name: access.groupId === DEFAULT_GROUP_ID ? "Family" : access.groupId }];
    if (family?.ownerId && !members.some(member => member.uid === family.ownerId)) {
      try {
        const ownerSnapshot = await firestoreModule.getDoc(firestoreModule.doc(db, "families", access.familyId, "members", family.ownerId));
        if (ownerSnapshot.exists()) members.push(parseMember(ownerSnapshot.data()));
      } catch (error: any) {
        // An owner who did not share their profile with this group is intentionally unreadable.
        if (!String(error?.code ?? "").includes("permission-denied")) throw error;
      }
    }
  }

  members = members
    .filter(member => access.role === "owner" || member.status === "active")
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
      return (a.displayName ?? a.uid).localeCompare(b.displayName ?? b.uid);
    });
  groups = groups.sort((a, b) => a.name.localeCompare(b.name));

  return { access, family, members, groups };
}

export async function ensureCloudGroupModel(user: FirebaseAuthUser, membership: CloudMembership): Promise<CloudMembership> {
  requireSignedInUser(user);
  if (membership.access.status !== "active" || membership.access.role !== "owner") return membership;
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  const needsMigration = membership.access.legacyGroupModel
    || membership.members.some(member => member.legacyGroupModel)
    || !membership.groups.some(group => group.id === DEFAULT_GROUP_ID);
  if (!needsMigration) return membership;

  const batch = firestoreModule.writeBatch(db);
  const groupRef = firestoreModule.doc(db, "families", membership.access.familyId, "groups", DEFAULT_GROUP_ID);
  batch.set(groupRef, {
    schemaVersion: 1,
    name: "Family",
    createdAt: firestoreModule.serverTimestamp(),
    updatedAt: firestoreModule.serverTimestamp()
  }, { merge: true });

  for (const member of membership.members) {
    if (!member.legacyGroupModel && !(member.role === "owner" && member.shareGroupIds.length === 0)) continue;
    const groupId = member.groupId || DEFAULT_GROUP_ID;
    const accessRef = firestoreModule.doc(db, "access", member.uid);
    const memberRef = firestoreModule.doc(db, "families", membership.access.familyId, "members", member.uid);
    const patch: Record<string, any> = { groupId };
    if (member.role === "owner") patch.shareGroupIds = member.shareGroupIds.length ? member.shareGroupIds : [DEFAULT_GROUP_ID];
    batch.update(accessRef, patch);
    batch.update(memberRef, patch);
  }
  await batch.commit();
  const refreshed = await loadCloudMembership(user);
  if (!refreshed) throw new Error("Cloud group migration could not be reloaded.");
  return refreshed;
}

export async function createFamilyInvite(
  user: FirebaseAuthUser,
  membership: CloudMembership,
  email: string,
  groupIdValue: string
): Promise<CreatedFamilyInvite> {
  requireSignedInUser(user);
  const emailLower = normalizeInviteEmail(email);
  if (!emailLower || !emailLower.includes("@") || emailLower.length > 320) {
    throw new Error("Enter a valid email address.");
  }
  if (membership.access.status !== "active" || membership.access.role !== "owner") {
    throw new Error("Only the active family owner can invite members.");
  }

  const groupId = normalizedGroupId(groupIdValue);
  if (!membership.groups.some(group => group.id === groupId)) throw new Error("Choose a valid group for this invitation.");

  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");

  const expiresAtMs = Date.now() + INVITE_LIFETIME_MS;
  const inviteRef = firestoreModule.doc(firestoreModule.collection(db, "invites"));
  await firestoreModule.setDoc(inviteRef, {
    schemaVersion: 1,
    familyId: membership.access.familyId,
    groupId,
    emailLower,
    role: "member",
    status: "pending",
    invitedBy: user.uid,
    createdAt: firestoreModule.serverTimestamp(),
    expiresAt: firestoreModule.Timestamp.fromMillis(expiresAtMs)
  });

  return {
    id: inviteRef.id,
    emailLower,
    familyId: membership.access.familyId,
    groupId,
    expiresAtMs
  };
}

export async function claimFamilyInvite(
  user: FirebaseAuthUser,
  inviteCode: string
): Promise<CloudMembership> {
  requireSignedInUser(user);
  if (!user.emailVerified || !user.email) throw new Error("Use a Google account with a verified email address.");

  const code = normalizeInviteCode(inviteCode);
  if (!code || code.includes("/") || code.length > 128) throw new Error("Enter a valid invite code.");

  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");

  const accessRef = firestoreModule.doc(db, "access", user.uid);
  const existingAccess = await firestoreModule.getDoc(accessRef);
  if (existingAccess.exists()) throw new Error("This Google account already has a family access record.");

  const inviteRef = firestoreModule.doc(db, "invites", code);
  let inviteSnapshot: any;
  try {
    inviteSnapshot = await firestoreModule.getDoc(inviteRef);
  } catch (error: any) {
    if (String(error?.code ?? "").includes("permission-denied")) {
      throw new Error("Invite not found or not valid for this signed-in Google account.");
    }
    throw error;
  }
  if (!inviteSnapshot.exists()) throw new Error("Invite not found for this Google account.");

  const invite = inviteSnapshot.data();
  const emailLower = normalizeInviteEmail(user.email);
  if (invite.schemaVersion !== 1 || invite.role !== "member" || invite.status !== "pending") {
    throw new Error("This invite is no longer available.");
  }
  if (invite.emailLower !== emailLower) throw new Error("This invite belongs to a different Google account.");
  if (typeof invite.familyId !== "string" || !invite.familyId) throw new Error("Invite family is invalid.");
  const groupId = normalizedGroupId(invite.groupId);
  if (invite.expiresAt?.toMillis && invite.expiresAt.toMillis() <= Date.now()) throw new Error("This invite has expired.");

  const memberRef = firestoreModule.doc(db, "families", invite.familyId, "members", user.uid);
  const displayName = (user.displayName || user.email.split("@")[0] || "User").slice(0, 80);
  const batch = firestoreModule.writeBatch(db);
  batch.set(accessRef, {
    schemaVersion: 1,
    familyId: invite.familyId,
    role: "member",
    status: "active",
    inviteId: code,
    groupId
  });
  batch.set(memberRef, {
    schemaVersion: 1,
    uid: user.uid,
    familyId: invite.familyId,
    role: "member",
    status: "active",
    inviteId: code,
    groupId,
    displayName,
    ...(user.photoURL ? { photoURL: user.photoURL } : {}),
    identitySeeded: true
  });
  batch.update(inviteRef, {
    status: "claimed",
    claimedBy: user.uid,
    claimedAt: firestoreModule.serverTimestamp()
  });
  await batch.commit();

  const membership = await loadCloudMembership(user);
  if (!membership || membership.access.status !== "active") throw new Error("Invite was claimed, but membership could not be loaded.");
  return membership;
}

export async function seedGoogleMemberIdentity(
  user: FirebaseAuthUser,
  membership: CloudMembership
): Promise<CloudMembership> {
  requireSignedInUser(user);
  if (membership.access.status !== "active") return membership;
  const self = membership.members.find(member => member.uid === user.uid);
  if (!self || self.identitySeeded) return membership;

  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");

  // Legacy/bootstrap members may not have identitySeeded yet. Preserve any
  // name already chosen in LogTogether; Google is only the fallback default.
  const displayName = (self.displayName?.trim() || user.displayName || user.email?.split("@")[0] || "User").slice(0, 80);
  const memberRef = firestoreModule.doc(db, "families", membership.access.familyId, "members", user.uid);
  const patch: Record<string, any> = {
    displayName,
    identitySeeded: true,
    updatedAt: firestoreModule.serverTimestamp()
  };
  if (user.photoURL) patch.photoURL = user.photoURL;
  await firestoreModule.updateDoc(memberRef, patch);

  return {
    ...membership,
    members: membership.members.map(member => member.uid === user.uid
      ? { ...member, displayName, photoURL: user.photoURL || member.photoURL, identitySeeded: true }
      : member)
  };
}

export async function updateMyFamilyDisplayName(
  user: FirebaseAuthUser,
  membership: CloudMembership,
  displayNameValue: string,
  biologicalSex?: ProfileData["biologicalSex"],
  profileSharing?: FamilyProfileSharing
): Promise<CloudMembership> {
  requireSignedInUser(user);
  if (membership.access.status !== "active") throw new Error("Active family access is required.");
  const displayName = displayNameValue.trim().slice(0, 80);
  if (!displayName) throw new Error("Display name cannot be empty.");
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  const normalizedSharing = profileSharing ? parseProfileSharing(profileSharing) : undefined;
  const memberRef = firestoreModule.doc(db, "families", membership.access.familyId, "members", user.uid);
  const patch: Record<string, any> = {
    displayName,
    identitySeeded: true,
    biologicalSex: normalizedSharing?.biologicalSex === false ? firestoreModule.deleteField() : (biologicalSex ?? firestoreModule.deleteField()),
    updatedAt: firestoreModule.serverTimestamp()
  };
  if (normalizedSharing) patch.profileSharing = normalizedSharing;
  await firestoreModule.updateDoc(memberRef, patch);
  return {
    ...membership,
    members: membership.members.map(member => {
      if (member.uid !== user.uid) return member;
      const next: CloudFamilyMember = { ...member, displayName, identitySeeded: true };
      if (normalizedSharing) next.profileSharing = normalizedSharing;
      if (normalizedSharing?.biologicalSex === false || !biologicalSex) delete next.biologicalSex;
      else next.biologicalSex = biologicalSex;
      return next;
    })
  };
}

export async function setFamilyMemberAccessStatus(
  user: FirebaseAuthUser,
  membership: CloudMembership,
  memberUid: string,
  status: "active" | "revoked"
): Promise<CloudMembership> {
  requireSignedInUser(user);
  if (membership.access.status !== "active" || membership.access.role !== "owner") {
    throw new Error("Only the active family owner can manage member access.");
  }
  if (!memberUid || memberUid === user.uid) throw new Error("The family owner cannot revoke their own access here.");
  const target = membership.members.find(member => member.uid === memberUid);
  if (!target || target.role !== "member") throw new Error("Family member not found.");

  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  const accessRef = firestoreModule.doc(db, "access", memberUid);
  const memberRef = firestoreModule.doc(db, "families", membership.access.familyId, "members", memberUid);
  const batch = firestoreModule.writeBatch(db);
  batch.update(accessRef, { status });
  batch.update(memberRef, { status });
  await batch.commit();
  const refreshed = await loadCloudMembership(user);
  if (!refreshed) throw new Error("Family membership could not be reloaded.");
  return refreshed;
}


export async function createFamilyGroup(user: FirebaseAuthUser, membership: CloudMembership, nameValue: string): Promise<CloudMembership> {
  requireSignedInUser(user);
  if (membership.access.status !== "active" || membership.access.role !== "owner") throw new Error("Only the owner can create groups.");
  const name = nameValue.trim().slice(0, 80);
  if (!name) throw new Error("Group name cannot be empty.");
  if (membership.groups.length >= 20) throw new Error("LogTogether supports up to 20 groups in this alpha.");
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  const ref = firestoreModule.doc(firestoreModule.collection(db, "families", membership.access.familyId, "groups"));
  await firestoreModule.setDoc(ref, { schemaVersion: 1, name, createdAt: firestoreModule.serverTimestamp(), updatedAt: firestoreModule.serverTimestamp() });
  return (await loadCloudMembership(user))!;
}

export async function renameFamilyGroup(user: FirebaseAuthUser, membership: CloudMembership, groupId: string, nameValue: string): Promise<CloudMembership> {
  requireSignedInUser(user);
  if (membership.access.status !== "active" || membership.access.role !== "owner") throw new Error("Only the owner can rename groups.");
  const name = nameValue.trim().slice(0, 80);
  if (!name) throw new Error("Group name cannot be empty.");
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  await firestoreModule.updateDoc(firestoreModule.doc(db, "families", membership.access.familyId, "groups", groupId), { name, updatedAt: firestoreModule.serverTimestamp() });
  return (await loadCloudMembership(user))!;
}

export async function deleteFamilyGroup(user: FirebaseAuthUser, membership: CloudMembership, groupId: string): Promise<CloudMembership> {
  requireSignedInUser(user);
  if (membership.access.status !== "active" || membership.access.role !== "owner") throw new Error("Only the owner can delete groups.");
  if (groupId === DEFAULT_GROUP_ID) throw new Error("The default Family group cannot be deleted.");
  if (membership.members.some(member => member.groupId === groupId)) throw new Error("Move members out of this group before deleting it.");
  if (membership.access.shareGroupIds.includes(groupId)) throw new Error("Remove this group from your sharing list before deleting it.");
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  await firestoreModule.deleteDoc(firestoreModule.doc(db, "families", membership.access.familyId, "groups", groupId));
  return (await loadCloudMembership(user))!;
}

export async function setFamilyMemberGroup(user: FirebaseAuthUser, membership: CloudMembership, memberUid: string, groupIdValue: string): Promise<CloudMembership> {
  requireSignedInUser(user);
  if (membership.access.status !== "active" || membership.access.role !== "owner") throw new Error("Only the owner can assign groups.");
  if (!memberUid || memberUid === user.uid) throw new Error("Use owner sharing controls for your own profile.");
  const target = membership.members.find(member => member.uid === memberUid);
  if (!target || target.role !== "member") throw new Error("Cloud member not found.");
  const groupId = normalizedGroupId(groupIdValue);
  if (!membership.groups.some(group => group.id === groupId)) throw new Error("Choose a valid group.");
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  const batch = firestoreModule.writeBatch(db);
  batch.update(firestoreModule.doc(db, "access", memberUid), { groupId });
  batch.update(firestoreModule.doc(db, "families", membership.access.familyId, "members", memberUid), { groupId });
  await batch.commit();
  return (await loadCloudMembership(user))!;
}

export async function setOwnerShareGroups(user: FirebaseAuthUser, membership: CloudMembership, groupIdsValue: string[]): Promise<CloudMembership> {
  requireSignedInUser(user);
  if (membership.access.status !== "active" || membership.access.role !== "owner") throw new Error("Only the owner can change owner group visibility.");
  const valid = new Set(membership.groups.map(group => group.id));
  const shareGroupIds = [...new Set(groupIdsValue.filter(groupId => valid.has(groupId)))].slice(0, 20);
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  const batch = firestoreModule.writeBatch(db);
  batch.update(firestoreModule.doc(db, "access", user.uid), { shareGroupIds });
  batch.update(firestoreModule.doc(db, "families", membership.access.familyId, "members", user.uid), { shareGroupIds });
  await batch.commit();
  return (await loadCloudMembership(user))!;
}

function visibleSharedMemberIds(user: FirebaseAuthUser, membership: CloudMembership): string[] {
  return [...new Set(membership.members.filter(member => member.status === "active" && member.uid !== user.uid).map(member => member.uid))];
}

async function loadSharedDocsByOwner(collectionName: string, ownerIds: string[], extraWhere?: [string, string, any][]): Promise<any[]> {
  if (!firestore || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  const collectionRef = firestoreModule.collection(firestore, collectionName);
  const snapshots = await Promise.all(ownerIds.map(ownerId => {
    const constraints: any[] = [firestoreModule.where("ownerId", "==", ownerId)];
    for (const [field, op, value] of extraWhere ?? []) constraints.push(firestoreModule.where(field, op, value));
    return firestoreModule.getDocs(firestoreModule.query(collectionRef, ...constraints));
  }));
  return snapshots.flatMap(snapshot => snapshot.docs);
}

function parseCloudWorkout(snapshot: any): CloudWorkoutEnvelope {
  const data = snapshot.data() as Record<string, any>;
  if (data.schemaVersion !== 1 || data.activityKind !== "strength") throw new Error("Unsupported cloud workout schema.");
  if (typeof data.id !== "string" || data.id !== snapshot.id) throw new Error("Invalid cloud workout ID.");
  if (typeof data.ownerId !== "string" || typeof data.familyId !== "string") throw new Error("Invalid cloud workout identity.");
  if (typeof data.routineName !== "string" || typeof data.startedAt !== "string") throw new Error("Invalid cloud workout metadata.");
  if (data.completedAt !== null && typeof data.completedAt !== "string") throw new Error("Invalid cloud workout completion time.");
  if (!Array.isArray(data.exercises) || !Array.isArray(data.selectedViewerIds)) throw new Error("Invalid cloud workout contents.");
  if (!["private", "family", "selected"].includes(data.visibility)) throw new Error("Invalid cloud workout visibility.");

  const clientUpdatedAt = typeof data.clientUpdatedAt === "string"
    ? data.clientUpdatedAt
    : (typeof data.completedAt === "string" ? data.completedAt : data.startedAt);
  const workout: WorkoutRecord = {
    schemaVersion: 1,
    id: data.id,
    ownerId: data.ownerId,
    familyId: data.familyId,
    activityKind: "strength",
    routineName: data.routineName,
    startedAt: data.startedAt,
    completedAt: data.completedAt,
    notes: typeof data.notes === "string" ? data.notes : "",
    visibility: data.visibility,
    selectedViewerIds: data.selectedViewerIds.filter((value: unknown) => typeof value === "string"),
    exercises: data.exercises,
    ...(data.routineMode === "standard" || data.routineMode === "circuit" ? { routineMode: data.routineMode } : {}),
    ...(Number.isInteger(data.circuitRounds) ? { circuitRounds: data.circuitRounds } : {}),
    ...(Number.isFinite(data.estimatedCalories) ? { estimatedCalories: Math.max(0, Math.round(data.estimatedCalories)) } : {}),
    ...(typeof data.editedAt === "string" ? { editedAt: data.editedAt } : {}),
    updatedAt: clientUpdatedAt
  };
  const estimatedCalories = Number.isFinite(data.estimatedCalories) ? Math.max(0, Math.round(data.estimatedCalories)) : 0;
  const updatedAtMs = data.updatedAt?.toMillis?.() ?? (Date.parse(clientUpdatedAt) || 0);
  return { workout, estimatedCalories, updatedAtMs };
}

function firestoreWorkoutPayload(workout: WorkoutRecord, estimatedCalories: number): Record<string, any> {
  const clone = JSON.parse(JSON.stringify(workout)) as Record<string, any>;
  // Media remains device-local until the private Storage stage. A local IndexedDB
  // photo ID is meaningless on another device and must never be published as if
  // it were cloud media.
  delete clone.photoId;
  delete clone.cloudSyncedAt;
  clone.updatedAt = workout.updatedAt ?? new Date().toISOString();
  return {
    ...clone,
    estimatedCalories: Math.max(0, Math.round(estimatedCalories || 0)),
    clientUpdatedAt: clone.updatedAt,
    updatedAt: firestoreModule.serverTimestamp()
  };
}

export async function loadCloudWorkouts(
  user: FirebaseAuthUser,
  membership: CloudMembership
): Promise<CloudWorkoutSnapshot> {
  requireSignedInUser(user);
  if (membership.access.status !== "active") throw new Error("Active family access is required for workout sync.");
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");

  const workouts = firestoreModule.collection(db, "workouts");
  // Group visibility is authorization, not a UI filter. Query each visible owner
  // explicitly so Firestore Rules can prove that every returned document belongs
  // to a member this caller may currently see.
  const ownQuery = firestoreModule.query(workouts, firestoreModule.where("ownerId", "==", user.uid));
  const [ownSnapshot, sharedDocs] = await Promise.all([
    firestoreModule.getDocs(ownQuery),
    loadSharedDocsByOwner("workouts", visibleSharedMemberIds(user, membership), [["familyId", "==", membership.access.familyId], ["visibility", "==", "family"]])
  ]);
  return {
    own: ownSnapshot.docs.map(parseCloudWorkout),
    familyShared: sharedDocs.map(parseCloudWorkout)
  };
}

export async function saveCloudWorkout(
  user: FirebaseAuthUser,
  membership: CloudMembership,
  workout: WorkoutRecord,
  estimatedCalories: number
): Promise<CloudWorkoutEnvelope> {
  requireSignedInUser(user);
  if (membership.access.status !== "active") throw new Error("Active family access is required for workout sync.");
  if (workout.ownerId !== user.uid || workout.familyId !== membership.access.familyId) {
    throw new Error("Workout identity does not match the signed-in family account.");
  }
  if (!workout.completedAt) throw new Error("Only completed workouts are synced.");
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  const ref = firestoreModule.doc(db, "workouts", workout.id);
  const localWorkout = { ...workout, updatedAt: workout.updatedAt ?? new Date().toISOString() };
  await firestoreModule.setDoc(ref, firestoreWorkoutPayload(localWorkout, estimatedCalories));
  return { workout: localWorkout, estimatedCalories: Math.max(0, Math.round(estimatedCalories || 0)), updatedAtMs: Date.now() };
}

export async function deleteCloudWorkout(
  user: FirebaseAuthUser,
  membership: CloudMembership,
  workoutId: string
): Promise<void> {
  requireSignedInUser(user);
  if (membership.access.status !== "active") throw new Error("Active family access is required for workout sync.");
  if (!workoutId || workoutId.includes("/")) throw new Error("Invalid workout ID.");
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  await firestoreModule.deleteDoc(firestoreModule.doc(db, "workouts", workoutId));
}

function parseCloudHike(snapshot: any): CloudHikeEnvelope {
  const data = snapshot.data() as Record<string, any>;
  if (data.schemaVersion !== 1 || (data.activityKind !== "hike" && data.activityKind !== "walk")) throw new Error("Unsupported cloud hike schema.");
  if (typeof data.id !== "string" || data.id !== snapshot.id) throw new Error("Invalid cloud hike ID.");
  if (typeof data.ownerId !== "string" || typeof data.familyId !== "string") throw new Error("Invalid cloud hike identity.");
  if (typeof data.name !== "string" || typeof data.date !== "string") throw new Error("Invalid cloud hike metadata.");
  const clientUpdatedAt = typeof data.clientUpdatedAt === "string" ? data.clientUpdatedAt : `${data.date}T12:00:00.000Z`;
  const hike: HikeRecord = {
    schemaVersion: 1,
    id: data.id,
    ownerId: data.ownerId,
    familyId: data.familyId,
    activityKind: data.activityKind,
    name: data.name,
    date: data.date,
    distanceKm: Number(data.distanceKm) || 0,
    movingMinutes: Math.max(0, Math.round(Number(data.movingMinutes) || 0)),
    elapsedMinutes: Math.max(0, Math.round(Number(data.elapsedMinutes) || 0)),
    elevationGainM: Math.max(0, Math.round(Number(data.elevationGainM) || 0)),
    elevationLossM: Math.max(0, Math.round(Number(data.elevationLossM) || 0)),
    ...(Number.isFinite(data.highestPointM) ? { highestPointM: Math.round(data.highestPointM) } : {}),
    difficulty: Math.max(1, Math.min(5, Math.round(Number(data.difficulty) || 3))) as 1 | 2 | 3 | 4 | 5,
    waterMl: Math.max(0, Math.round(Number(data.waterMl) || 0)),
    notes: typeof data.notes === "string" ? data.notes : "",
    ...(typeof data.startedAt === "string" ? { startedAt: data.startedAt } : {}),
    ...(typeof data.editedAt === "string" ? { editedAt: data.editedAt } : {}),
    visibility: "family",
    selectedViewerIds: [],
    updatedAt: clientUpdatedAt
  };
  return { hike, updatedAtMs: data.updatedAt?.toMillis?.() ?? (Date.parse(clientUpdatedAt) || 0) };
}

function firestoreHikePayload(hike: HikeRecord): Record<string, any> {
  const clone = JSON.parse(JSON.stringify(hike)) as Record<string, any>;
  // Exact route traces and photos stay device-local for now. Route points can
  // reveal precise location history and should not become family-visible by accident.
  delete clone.photoId;
  delete clone.routePoints;
  delete clone.routeSource;
  delete clone.cloudSyncedAt;
  clone.visibility = "family";
  clone.selectedViewerIds = [];
  clone.updatedAt = hike.updatedAt ?? new Date().toISOString();
  return { ...clone, clientUpdatedAt: clone.updatedAt, updatedAt: firestoreModule.serverTimestamp() };
}

export async function loadCloudHikes(user: FirebaseAuthUser, membership: CloudMembership): Promise<CloudHikeSnapshot> {
  requireSignedInUser(user);
  if (membership.access.status !== "active") throw new Error("Active family access is required for hike sync.");
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  const hikes = firestoreModule.collection(db, "hikes");
  const ownQuery = firestoreModule.query(hikes, firestoreModule.where("ownerId", "==", user.uid));
  const [ownSnapshot, sharedDocs] = await Promise.all([
    firestoreModule.getDocs(ownQuery),
    loadSharedDocsByOwner("hikes", visibleSharedMemberIds(user, membership), [["familyId", "==", membership.access.familyId], ["visibility", "==", "family"]])
  ]);
  return { own: ownSnapshot.docs.map(parseCloudHike), familyShared: sharedDocs.map(parseCloudHike) };
}

export async function saveCloudHike(user: FirebaseAuthUser, membership: CloudMembership, hike: HikeRecord): Promise<CloudHikeEnvelope> {
  requireSignedInUser(user);
  if (membership.access.status !== "active") throw new Error("Active family access is required for hike sync.");
  if (hike.ownerId !== user.uid || hike.familyId !== membership.access.familyId) throw new Error("Hike identity does not match the signed-in family account.");
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  const localHike = { ...hike, visibility: "family" as const, selectedViewerIds: [], updatedAt: hike.updatedAt ?? new Date().toISOString() };
  await firestoreModule.setDoc(firestoreModule.doc(db, "hikes", hike.id), firestoreHikePayload(localHike));
  return { hike: localHike, updatedAtMs: Date.now() };
}

export async function deleteCloudHike(user: FirebaseAuthUser, membership: CloudMembership, hikeId: string): Promise<void> {
  requireSignedInUser(user);
  if (membership.access.status !== "active") throw new Error("Active family access is required for hike sync.");
  if (!hikeId || hikeId.includes("/")) throw new Error("Invalid hike ID.");
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  await firestoreModule.deleteDoc(firestoreModule.doc(db, "hikes", hikeId));
}

// v0.7 boundary: workouts, core hike metadata, supplements, preferences, hydration and profile fields sync across devices. Family members receive family workouts/hikes plus daily/weekly summaries, badges and explicitly shared profile fields. Exact GPX traces, photos and photo stories remain device-local.


function parseCloudPreferences(snapshot: any): CloudUserPreferences | null {
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Record<string, any>;
  if (data.schemaVersion !== 1 || typeof data.ownerId !== "string" || typeof data.familyId !== "string") throw new Error("Invalid cloud preference document.");
  if ((data.locale !== "en" && data.locale !== "zh-TW") || (data.theme !== "dark" && data.theme !== "light")) throw new Error("Invalid cloud preference values.");
  if (typeof data.simpleMode !== "boolean" || typeof data.accentColor !== "string" || !data.goals || typeof data.goals !== "object") throw new Error("Invalid cloud preference contents.");
  const hikeBadgePreferences: HikeBadgePreference[] = Array.isArray(data.hikeBadgePreferences)
    ? data.hikeBadgePreferences.filter((item: any) => item && typeof item.hikeId === "string").map((item: any) => ({
        hikeId: String(item.hikeId).slice(0, 120),
        ...(typeof item.title === "string" && item.title.trim() ? { title: item.title.slice(0, 100) } : {}),
        ...(item.hidden === true ? { hidden: true } : {}),
        ...(Number.isFinite(item.order) ? { order: Math.max(0, Math.round(item.order)) } : {})
      }))
    : [];
  const customSupplements: CustomSupplement[] = Array.isArray(data.customSupplements)
    ? data.customSupplements.filter((item:any)=>item && typeof item.id === "string" && typeof item.label === "string" && item.label.trim()).slice(0,40).map((item:any)=>({
        id:String(item.id).slice(0,120), label:String(item.label).trim().slice(0,100),
        ...(Number.isFinite(item.defaultAmount) && Number(item.defaultAmount)>0 ? {defaultAmount:Math.min(100000,Number(item.defaultAmount))} : {}),
        ...(["serving","capsule","tablet","mg","mcg","g","IU","scoop","drop"].includes(item.defaultUnit) ? {defaultUnit:item.defaultUnit as SupplementUnit} : {})
      })) : [];
  return {
    schemaVersion: 1, ownerId: data.ownerId, familyId: data.familyId, locale: data.locale, theme: data.theme, simpleMode: data.simpleMode,
    accentColor: data.accentColor, weeklyWorkoutGoal: Number.isFinite(data.weeklyWorkoutGoal) ? Math.max(1, Math.round(data.weeklyWorkoutGoal)) : 3,
    goals: data.goals as GoalConfig, hikeBadgePreferences, profileSharing: parseProfileSharing(data.profileSharing), notificationPreferences: parseNotificationPreferences(data.notificationPreferences), notificationDefaultsV11_1Applied: data.notificationDefaultsV11_1Applied === true, customSupplements, clientUpdatedAt: typeof data.clientUpdatedAt === "string" ? data.clientUpdatedAt : ""
  };
}

function parseCloudBodyMetrics(snapshot: any): CloudBodyMetrics | null {
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Record<string, any>;
  if (data.schemaVersion !== 1 || typeof data.ownerId !== "string" || typeof data.familyId !== "string") throw new Error("Invalid body metrics document.");
  const weightEntries = Array.isArray(data.weightEntries) ? data.weightEntries.filter((entry: any) => entry && typeof entry.id === "string" && typeof entry.date === "string" && Number.isFinite(entry.kg)).map((entry: any) => ({ id: entry.id, date: entry.date, kg: Number(entry.kg) })) : [];
  return { schemaVersion: 1, ownerId: data.ownerId, familyId: data.familyId, ...(Number.isFinite(data.heightCm) ? { heightCm: Number(data.heightCm) } : {}), ...(["female", "male", "other", "prefer_not"].includes(data.biologicalSex) ? { biologicalSex: data.biologicalSex as ProfileData["biologicalSex"] } : {}), weightEntries, clientUpdatedAt: typeof data.clientUpdatedAt === "string" ? data.clientUpdatedAt : "" };
}

function parseCloudHydration(snapshot: any): HydrationDay {
  const data = snapshot.data() as Record<string, any>;
  if (data.schemaVersion !== 1 || typeof data.ownerId !== "string" || typeof data.familyId !== "string" || typeof data.date !== "string") throw new Error("Invalid hydration document.");
  const entries = Array.isArray(data.entries) ? data.entries.filter((entry: any) => entry && typeof entry.id === "string" && typeof entry.at === "string" && Number.isFinite(entry.ml)).map((entry: any) => ({ id: entry.id, at: entry.at, ml: Math.max(0, Math.round(entry.ml)), ...(typeof entry.editedAt === "string" ? { editedAt: entry.editedAt } : {}) })) : [];
  return { schemaVersion: 1, date: data.date, userId: data.ownerId, familyId: data.familyId, targetMl: Math.max(500, Math.round(Number(data.targetMl) || 2000)), totalMl: Math.max(0, Math.round(Number(data.totalMl) || 0)), entries, visibility: "private" };
}

function parseFamilyDaily(snapshot: any): CloudFamilyDailySummary {
  const data = snapshot.data() as Record<string, any>;
  if (data.schemaVersion !== 1 || typeof data.ownerId !== "string" || typeof data.familyId !== "string" || typeof data.date !== "string") throw new Error("Invalid family progress document.");
  return { schemaVersion: 1, ownerId: data.ownerId, familyId: data.familyId, date: data.date, calories: Math.max(0, Math.round(Number(data.calories) || 0)), waterMl: Math.max(0, Math.round(Number(data.waterMl) || 0)), workoutCount: Math.max(0, Math.round(Number(data.workoutCount) || 0)), goldDay: data.goldDay === true, clientUpdatedAt: typeof data.clientUpdatedAt === "string" ? data.clientUpdatedAt : "" };
}

function parseCloudSupplementDay(snapshot: any): CloudSupplementDay {
  const data = snapshot.data() as Record<string, any>;
  if (data.schemaVersion !== 1 || typeof data.ownerId !== "string" || typeof data.familyId !== "string" || typeof data.date !== "string") throw new Error("Invalid supplement document.");
  const units = new Set<SupplementUnit>(["mg", "mcg", "g", "IU", "capsule", "tablet", "serving", "scoop", "drop"]);
  const entries = Array.isArray(data.entries) ? data.entries.filter((entry: any) => entry && typeof entry.id === "string" && typeof entry.at === "string" && typeof entry.supplementId === "string").map((entry: any) => ({
    id: entry.id,
    at: entry.at,
    supplementId: entry.supplementId,
    ...(typeof entry.customLabel === "string" && entry.customLabel.trim() ? { customLabel: entry.customLabel.trim().slice(0,100) } : {}),
    ...(Number.isFinite(entry.amount) ? { amount: Math.max(0, Number(entry.amount)) } : {}),
    ...(units.has(entry.unit) ? { unit: entry.unit as SupplementUnit } : {}),
    ...(typeof entry.editedAt === "string" ? { editedAt: entry.editedAt } : {})
  })) : [];
  return { schemaVersion: 1, ownerId: data.ownerId, familyId: data.familyId, date: data.date, entries, clientUpdatedAt: typeof data.clientUpdatedAt === "string" ? data.clientUpdatedAt : "" };
}

function parseFamilyWeekly(snapshot: any): CloudFamilyWeeklySummary {
  const data = snapshot.data() as Record<string, any>;
  if (data.schemaVersion !== 1 || typeof data.ownerId !== "string" || typeof data.familyId !== "string" || typeof data.weekStart !== "string") throw new Error("Invalid family weekly summary.");
  const validUnits = new Set<SupplementUnit>(["mg", "mcg", "g", "IU", "capsule", "tablet", "serving", "scoop", "drop"]);
  const supplements = Array.isArray(data.supplements) ? data.supplements.slice(0, 50).filter((item: any) => item && typeof item.supplementId === "string").map((item: any) => ({
    supplementId: item.supplementId,
    ...(typeof item.customLabel === "string" && item.customLabel.trim() ? {customLabel:item.customLabel.trim().slice(0,100)} : {}),
    amount: Math.max(0, Number(item.amount) || 0),
    ...(validUnits.has(item.unit) ? { unit: item.unit as SupplementUnit } : {}),
    entries: Math.max(0, Math.round(Number(item.entries) || 0)),
    days: Math.max(0, Math.round(Number(item.days) || 0)),
    mixedUnits: item.mixedUnits === true
  })) : [];
  const calorieDays = Math.max(0, Math.min(7, Math.round(Number(data.calorieDays) || 0)));
  const waterDays = Math.max(0, Math.min(7, Math.round(Number(data.waterDays) || 0)));
  const categoriesHit = Math.max(0, Math.min(8, Math.round(Number(data.categoriesHit) || 0)));
  const rawMissionMax = Math.max(1, Math.round(Number(data.missionMax) || 10));
  const legacyMissionModel = rawMissionMax === 20 || rawMissionMax === 22;
  return {
    schemaVersion: 1,
    ownerId: data.ownerId,
    familyId: data.familyId,
    weekStart: data.weekStart,
    ...(["easy","normal","hard","extreme"].includes(data.difficulty) ? {difficulty:data.difficulty as GoalConfig["difficulty"]} : {}),
    weeklyCalories: Math.max(0, Math.round(Number(data.weeklyCalories) || 0)),
    workoutCount: Math.max(0, Math.round(Number(data.workoutCount) || 0)),
    hikeCount: Math.max(0, Math.round(Number(data.hikeCount) || 0)),
    hikeKm: Math.max(0, Number(data.hikeKm) || 0),
    calorieDays,
    waterDays,
    categoriesHit,
    // v0.7.0/v0.7.1 stored a 20/22-point model. Convert those old summaries
    // to the v0.7.2 ten-mission model until that family member syncs again.
    missionScore: legacyMissionModel
      ? Math.min(10, categoriesHit + (calorieDays >= 5 ? 1 : 0) + (waterDays >= 7 ? 1 : 0))
      : Math.max(0, Math.min(10, Math.round(Number(data.missionScore) || 0))),
    missionMax: 10,
    supplements,
    clientUpdatedAt: typeof data.clientUpdatedAt === "string" ? data.clientUpdatedAt : ""
  };
}

function parseCloudBadge(snapshot: any): CloudBadgeRecord {
  const data = snapshot.data() as Record<string, any>;
  if (data.schemaVersion !== 1 || typeof data.ownerId !== "string" || typeof data.familyId !== "string" || data.visibility !== "family") throw new Error("Invalid badge document.");
  if (data.badgeType !== "monthly" && data.badgeType !== "hike") throw new Error("Invalid badge type.");
  return { id: snapshot.id, schemaVersion: 1, ownerId: data.ownerId, familyId: data.familyId, visibility: "family", selectedViewerIds: [], badgeType: data.badgeType, title: String(data.title ?? "Badge"), subtitle: String(data.subtitle ?? ""), earnedAt: String(data.earnedAt ?? ""), ...(Number.isFinite(data.sortOrder) ? { sortOrder: Math.max(0, Math.round(data.sortOrder)) } : {}), ...(typeof data.sourceHikeId === "string" ? { sourceHikeId: data.sourceHikeId } : {}) };
}

export async function loadCloudCompanionState(user: FirebaseAuthUser, membership: CloudMembership): Promise<CloudCompanionSnapshot> {
  requireSignedInUser(user);
  if (membership.access.status !== "active") throw new Error("Active family access is required for personal sync.");
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  const hydration = firestoreModule.collection(db, "hydration");
  const supplements = firestoreModule.collection(db, "supplements");
  const badges = firestoreModule.collection(db, "badges");
  const sharedIds = visibleSharedMemberIds(user, membership);
  const [preferencesSnapshot, metricsSnapshot, hydrationSnapshot, supplementSnapshot, familyDailyDocs, familyWeeklyDocs, ownBadgeSnapshot, familyBadgeDocs] = await Promise.all([
    firestoreModule.getDoc(firestoreModule.doc(db, "users", user.uid)),
    firestoreModule.getDoc(firestoreModule.doc(db, "bodyMetrics", user.uid)),
    firestoreModule.getDocs(firestoreModule.query(hydration, firestoreModule.where("ownerId", "==", user.uid))),
    firestoreModule.getDocs(firestoreModule.query(supplements, firestoreModule.where("ownerId", "==", user.uid))),
    loadSharedDocsByOwner("familyProgress", [user.uid, ...sharedIds], [["familyId", "==", membership.access.familyId]]),
    loadSharedDocsByOwner("familyWeekly", [user.uid, ...sharedIds], [["familyId", "==", membership.access.familyId]]),
    firestoreModule.getDocs(firestoreModule.query(badges, firestoreModule.where("ownerId", "==", user.uid))),
    loadSharedDocsByOwner("badges", sharedIds, [["familyId", "==", membership.access.familyId], ["visibility", "==", "family"]])
  ]);
  return {
    preferences: parseCloudPreferences(preferencesSnapshot),
    bodyMetrics: parseCloudBodyMetrics(metricsSnapshot),
    hydration: hydrationSnapshot.docs.map(parseCloudHydration),
    supplements: supplementSnapshot.docs.map(parseCloudSupplementDay),
    familyDaily: familyDailyDocs.map(parseFamilyDaily),
    familyWeekly: familyWeeklyDocs.map(parseFamilyWeekly),
    ownBadges: ownBadgeSnapshot.docs.map(parseCloudBadge),
    familyBadges: familyBadgeDocs.map(parseCloudBadge)
  };
}

export async function saveCloudPreferences(user: FirebaseAuthUser, membership: CloudMembership, value: Omit<CloudUserPreferences, "schemaVersion" | "ownerId" | "familyId" | "clientUpdatedAt">): Promise<void> {
  requireSignedInUser(user);
  if (membership.access.status !== "active") throw new Error("Active family access is required for settings sync.");
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  const clientUpdatedAt = new Date().toISOString();
  await firestoreModule.setDoc(firestoreModule.doc(db, "users", user.uid), { schemaVersion: 1, ownerId: user.uid, familyId: membership.access.familyId, ...value, clientUpdatedAt, updatedAt: firestoreModule.serverTimestamp() });
}

export async function saveCloudBodyMetrics(user: FirebaseAuthUser, membership: CloudMembership, profile: ProfileData): Promise<void> {
  requireSignedInUser(user);
  if (membership.access.status !== "active") throw new Error("Active family access is required for body metric sync.");
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  const clientUpdatedAt = new Date().toISOString();
  const payload: Record<string, any> = { schemaVersion: 1, ownerId: user.uid, familyId: membership.access.familyId, weightEntries: profile.weightEntries.map(entry => ({ id: entry.id, date: entry.date, kg: entry.kg })), clientUpdatedAt, updatedAt: firestoreModule.serverTimestamp() };
  if (Number.isFinite(profile.heightCm)) payload.heightCm = profile.heightCm;
  if (profile.biologicalSex) payload.biologicalSex = profile.biologicalSex;
  await firestoreModule.setDoc(firestoreModule.doc(db, "bodyMetrics", user.uid), payload);
}

export async function saveCloudHydrationDay(user: FirebaseAuthUser, membership: CloudMembership, day: HydrationDay): Promise<void> {
  requireSignedInUser(user);
  if (membership.access.status !== "active") throw new Error("Active family access is required for hydration sync.");
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  const id = `${user.uid}_${day.date}`;
  await firestoreModule.setDoc(firestoreModule.doc(db, "hydration", id), { schemaVersion: 1, ownerId: user.uid, familyId: membership.access.familyId, date: day.date, targetMl: day.targetMl, totalMl: day.totalMl, entries: day.entries.map(entry => ({ id: entry.id, at: entry.at, ml: entry.ml, ...(entry.editedAt ? { editedAt: entry.editedAt } : {}) })), visibility: "private", selectedViewerIds: [], updatedAt: firestoreModule.serverTimestamp() });
}

export async function saveFamilyDailySummary(user: FirebaseAuthUser, membership: CloudMembership, summary: Omit<CloudFamilyDailySummary, "schemaVersion" | "ownerId" | "familyId" | "clientUpdatedAt">): Promise<void> {
  requireSignedInUser(user);
  if (membership.access.status !== "active") throw new Error("Active family access is required for family progress sync.");
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  const clientUpdatedAt = new Date().toISOString();
  const id = `${user.uid}_${summary.date}`;
  await firestoreModule.setDoc(firestoreModule.doc(db, "familyProgress", id), { schemaVersion: 1, ownerId: user.uid, familyId: membership.access.familyId, date: summary.date, calories: Math.max(0, Math.round(summary.calories)), waterMl: Math.max(0, Math.round(summary.waterMl)), workoutCount: Math.max(0, Math.round(summary.workoutCount)), goldDay: summary.goldDay === true, clientUpdatedAt, updatedAt: firestoreModule.serverTimestamp() });
}

export async function saveCloudSupplementDay(user: FirebaseAuthUser, membership: CloudMembership, day: SupplementDay): Promise<void> {
  requireSignedInUser(user);
  if (membership.access.status !== "active") throw new Error("Active family access is required for supplement sync.");
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  const clientUpdatedAt = new Date().toISOString();
  const id = `${user.uid}_${day.date}`;
  await firestoreModule.setDoc(firestoreModule.doc(db, "supplements", id), {
    schemaVersion: 1,
    ownerId: user.uid,
    familyId: membership.access.familyId,
    date: day.date,
    entries: day.entries.map(entry => ({ id: entry.id, at: entry.at, supplementId: entry.supplementId, ...(entry.customLabel ? {customLabel:entry.customLabel.slice(0,100)} : {}), ...(Number.isFinite(entry.amount) ? { amount: entry.amount } : {}), ...(entry.unit ? { unit: entry.unit } : {}), ...(entry.editedAt ? { editedAt: entry.editedAt } : {}) })),
    clientUpdatedAt,
    updatedAt: firestoreModule.serverTimestamp()
  });
}

export async function saveFamilyWeeklySummary(user: FirebaseAuthUser, membership: CloudMembership, summary: Omit<CloudFamilyWeeklySummary, "schemaVersion" | "ownerId" | "familyId" | "clientUpdatedAt">): Promise<void> {
  requireSignedInUser(user);
  if (membership.access.status !== "active") throw new Error("Active family access is required for weekly family sync.");
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  const clientUpdatedAt = new Date().toISOString();
  const id = `${user.uid}_${summary.weekStart}`;
  await firestoreModule.setDoc(firestoreModule.doc(db, "familyWeekly", id), {
    schemaVersion: 1,
    ownerId: user.uid,
    familyId: membership.access.familyId,
    ...summary,
    clientUpdatedAt,
    updatedAt: firestoreModule.serverTimestamp()
  });
}

export async function saveCloudBadges(user: FirebaseAuthUser, membership: CloudMembership, badges: Array<Omit<CloudBadgeRecord, "id" | "schemaVersion" | "ownerId" | "familyId" | "visibility" | "selectedViewerIds"> & { id: string }>): Promise<void> {
  requireSignedInUser(user);
  if (membership.access.status !== "active") throw new Error("Active family access is required for badge sync.");
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  const batch = firestoreModule.writeBatch(db);
  for (const badge of badges) {
    const safeId = badge.id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
    const ref = firestoreModule.doc(db, "badges", `${user.uid}_${safeId}`);
    batch.set(ref, { schemaVersion: 1, ownerId: user.uid, familyId: membership.access.familyId, visibility: "family", selectedViewerIds: [], badgeType: badge.badgeType, title: badge.title.slice(0, 100), subtitle: badge.subtitle.slice(0, 120), earnedAt: badge.earnedAt, ...(Number.isFinite(badge.sortOrder) ? { sortOrder: Math.max(0, Math.round(badge.sortOrder!)) } : {}), ...(badge.sourceHikeId ? { sourceHikeId: badge.sourceHikeId.slice(0, 120) } : {}), updatedAt: firestoreModule.serverTimestamp() }, { merge: true });
  }
  await batch.commit();
}

export async function deleteCloudBadge(user: FirebaseAuthUser, membership: CloudMembership, badgeId: string): Promise<void> {
  requireSignedInUser(user);
  if (membership.access.status !== "active") throw new Error("Active family access is required for badge sync.");
  const db = await ensureFirestore();
  if (!db || !firestoreModule) throw new Error("Cloud Firestore is not configured.");
  const safeId = badgeId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  await firestoreModule.deleteDoc(firestoreModule.doc(db, "badges", `${user.uid}_${safeId}`));
}


export interface PushRegistrationStatus {
  supported: boolean;
  configured: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
}

export interface PokeWalletState { balance: number; maxBalance: number; unlimited?: boolean; }

function webPushKey(): string {
  const value=runtimeConfig()?.pushPublicKey?.trim() ?? "";
  return value.startsWith("__LOGTOGETHER_") ? "" : value;
}

function base64UrlToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

async function subscriptionId(endpoint: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
    return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2,"0")).join("").slice(0,48);
  }
  let hash=0; for (const char of endpoint) hash=((hash<<5)-hash+char.charCodeAt(0))|0;
  return `legacy-${Math.abs(hash)}`;
}

export async function observeSocialInbox(
  user: FirebaseAuthUser,
  callback: (events: SocialInboxEvent[]) => void
): Promise<() => void> {
  requireSignedInUser(user);
  const db = await ensureFirestore();
  if (!db || !firestoreModule) { callback([]); return () => undefined; }
  const ref = firestoreModule.collection(db, "users", user.uid, "socialInbox");
  const query = firestoreModule.query(ref, firestoreModule.orderBy("createdAt", "desc"), firestoreModule.limit(24));
  return firestoreModule.onSnapshot(query, (snapshot:any) => {
    const events: SocialInboxEvent[] = snapshot.docs.map((doc:any) => {
      const data = doc.data() ?? {};
      const kind = ["poke","gold","badge"].includes(data.kind) ? data.kind : "poke";
      return {
        id:doc.id, kind, title:String(data.title ?? "LogTogether").slice(0,160), body:String(data.body ?? "").slice(0,300),
        ...(typeof data.url === "string" ? {url:data.url.slice(0,200)} : {}),
        ...(typeof data.emoji === "string" ? {emoji:data.emoji.slice(0,8)} : {}),
        ...(typeof data.senderUid === "string" ? {senderUid:data.senderUid.slice(0,128)} : {}),
        ...(typeof data.senderName === "string" ? {senderName:data.senderName.slice(0,80)} : {}),
        createdAtMs:data.createdAt?.toMillis?.() ?? 0
      } as SocialInboxEvent;
    });
    callback(events);
  }, (error:any) => { console.warn("Social inbox:", error); callback([]); });
}

export async function pushRegistrationStatus(): Promise<PushRegistrationStatus> {
  const supported = typeof Notification !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
  const configured = Boolean(webPushKey());
  if (!supported) return { supported:false, configured, permission:"unsupported", subscribed:false };
  const registration = await navigator.serviceWorker.ready.catch(()=>null);
  const subscription = registration ? await registration.pushManager.getSubscription().catch(()=>null) : null;
  return { supported:true, configured, permission:Notification.permission, subscribed:Boolean(subscription) };
}

export async function enablePushNotifications(user: FirebaseAuthUser, membership: CloudMembership): Promise<PushRegistrationStatus> {
  requireSignedInUser(user);
  if (membership.access.status !== "active") throw new Error("Active family access is required for notifications.");
  const key=webPushKey();
  if (!key) throw new Error("Push notifications are not configured on this deployment.");
  if (typeof Notification === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Push notifications are not supported on this device.");
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:base64UrlToUint8Array(key) });
  }
  const json=subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("The browser returned an incomplete push subscription.");
  const db=await ensureFirestore(); if(!db||!firestoreModule) throw new Error("Cloud Firestore is not configured.");
  const id=await subscriptionId(json.endpoint);
  await firestoreModule.setDoc(firestoreModule.doc(db,"users",user.uid,"pushSubscriptions",id),{
    schemaVersion:1, ownerId:user.uid, familyId:membership.access.familyId, endpoint:json.endpoint,
    keys:{p256dh:json.keys.p256dh,auth:json.keys.auth}, userAgent:navigator.userAgent.slice(0,240),
    clientUpdatedAt:new Date().toISOString(), updatedAt:firestoreModule.serverTimestamp()
  });
  return pushRegistrationStatus();
}

export async function disablePushNotifications(user: FirebaseAuthUser): Promise<PushRegistrationStatus> {
  requireSignedInUser(user);
  if (typeof Notification === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return pushRegistrationStatus();
  const registration=await navigator.serviceWorker.ready.catch(()=>null);
  const subscription=registration ? await registration.pushManager.getSubscription().catch(()=>null) : null;
  if (subscription) {
    const db=await ensureFirestore();
    if(db&&firestoreModule){const id=await subscriptionId(subscription.endpoint); await firestoreModule.deleteDoc(firestoreModule.doc(db,"users",user.uid,"pushSubscriptions",id)).catch(()=>undefined);}
    await subscription.unsubscribe().catch(()=>false);
  }
  return pushRegistrationStatus();
}

export async function loadPokeWallet(user: FirebaseAuthUser): Promise<PokeWalletState> {
  requireSignedInUser(user);
  const db=await ensureFirestore(); if(!db||!firestoreModule) throw new Error("Cloud Firestore is not configured.");
  const snapshot=await firestoreModule.getDoc(firestoreModule.doc(db,"pokeWallets",user.uid));
  const data=snapshot.exists()?snapshot.data():{};
  return {balance:Number.isFinite(data.balance)?Math.max(0,Math.min(7,Math.round(data.balance))):0,maxBalance:7};
}

export async function sendPoke(user: FirebaseAuthUser, recipientUid: string, emoji: string): Promise<PokeWalletState> {
  requireSignedInUser(user);
  if (!recipientUid || recipientUid === user.uid) throw new Error("Choose another family member.");
  const instance=await ensureFunctions(); if(!instance||!functionsModule) throw new Error("Cloud Functions are not configured.");
  const callable=functionsModule.httpsCallable(instance,"sendPoke");
  const result=await callable({recipientUid,emoji});
  const data=result?.data ?? {};
  return {balance:Number.isFinite(data.balance)?Math.max(0,Math.min(7,Math.round(data.balance))):0,maxBalance:7,unlimited:data.unlimited === true};
}

export interface BackendDiagnostics {
  month: string;
  activeMembers: number;
  pushSubscriptions: number;
  pokeCalls: number;
  pokesDelivered: number;
  pokesBlocked: number;
  goldEvents: number;
  badgeEvents: number;
  testNotifications: number;
  pushDeliveries: number;
  pushFailures: number;
  note: string;
}

export async function sendTestNotification(user: FirebaseAuthUser): Promise<void> {
  requireSignedInUser(user);
  if (typeof Notification === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push notifications are not supported on this device.");
  }
  const registration=await navigator.serviceWorker.ready;
  const subscription=await registration.pushManager.getSubscription();
  if (!subscription) throw new Error("Enable notifications on this device before sending a test notification.");
  const id=await subscriptionId(subscription.endpoint);
  const instance=await ensureFunctions(); if(!instance||!functionsModule) throw new Error("Cloud Functions are not configured.");
  const callable=functionsModule.httpsCallable(instance,"sendTestNotification");
  await callable({subscriptionId:id});
}

export async function loadBackendDiagnostics(user: FirebaseAuthUser): Promise<BackendDiagnostics> {
  requireSignedInUser(user);
  const instance=await ensureFunctions(); if(!instance||!functionsModule) throw new Error("Cloud Functions are not configured.");
  const callable=functionsModule.httpsCallable(instance,"getBackendDiagnostics");
  const result=await callable({});
  const data=result?.data ?? {};
  const n=(key:string)=>Math.max(0,Math.round(Number(data[key])||0));
  return {month:String(data.month??""),activeMembers:n("activeMembers"),pushSubscriptions:n("pushSubscriptions"),pokeCalls:n("pokeCalls"),pokesDelivered:n("pokesDelivered"),pokesBlocked:n("pokesBlocked"),goldEvents:n("goldEvents"),badgeEvents:n("badgeEvents"),testNotifications:n("testNotifications"),pushDeliveries:n("pushDeliveries"),pushFailures:n("pushFailures"),note:String(data.note??"")};
}
