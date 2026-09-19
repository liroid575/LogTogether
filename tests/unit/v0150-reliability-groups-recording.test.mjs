import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  EXERCISES,
  exerciseById,
  exerciseLaterality,
  exerciseScienceLoggingProfile
} from "../../dist/assets/core/exercises.js";

const text = async path => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

await test("v0.15 keeps the exact 156-exercise catalogue and all exercises resolve to a science profile", () => {
  assert.equal(EXERCISES.length, 156);
  assert.equal(new Set(EXERCISES.map(item=>item.id)).size, 156);
  for (const exercise of EXERCISES) assert.ok(exerciseScienceLoggingProfile(exercise));
  assert.equal(exerciseLaterality(exerciseById("downward_dog")), "none");
  assert.equal(exerciseLaterality(exerciseById("warrior_one")), "per_side");
  assert.equal(exerciseLaterality(exerciseById("warrior_two")), "per_side");
});

await test("multi-group membership is additive, bounded and keeps owner sharing separate", async () => {
  const [client, rules] = await Promise.all([text("src/services/firebase-client.ts"), text("firestore.rules")]);
  assert.match(client, /groupIds: string\[\]/);
  assert.match(client, /array-contains-any/);
  assert.match(client, /where\("role", "==", "member"\)/);
  assert.match(client, /setFamilyMemberGroups/);
  assert.match(client, /groupIds\.length\) throw new Error\("A Cloud member must belong to at least one group/);
  assert.match(rules, /groupIdsFor\(get\(accessPath\(uid\)\)\.data\)\.hasAny\(groupIdsFor\(myAccess\(\)\.data\)\)/);
  assert.match(rules, /groupIdsFor\(data\)\.size\(\) <= 20/);
  assert.match(client, /shareGroupIds/);
});

await test("installed-PWA invite recovery is verified-email bound and query limited", async () => {
  const [client, rules, main] = await Promise.all([text("src/services/firebase-client.ts"), text("firestore.rules"), text("src/main.ts")]);
  assert.match(client, /findRecoverableFamilyInvites/);
  assert.match(client, /where\("emailLower", "==", emailLower\)/);
  assert.match(client, /where\("status", "==", "pending"\)/);
  assert.match(client, /limit\(3\)/);
  assert.match(rules, /request\.query\.limit <= 3/);
  assert.match(rules, /resource\.data\.emailLower == request\.auth\.token\.email\.lower\(\)/);
  assert.match(main, /recover the pending invite from the verified Google email/);
});

await test("Poke balance observes the private wallet instead of relying on one race-prone read", async () => {
  const [client, main, fn] = await Promise.all([text("src/services/firebase-client.ts"), text("src/main.ts"), text("functions/gold-rewards.js")]);
  assert.match(client, /export async function observePokeWallet/);
  assert.match(client, /onSnapshot/);
  assert.match(main, /ensurePokeWalletObserver/);
  assert.match(main, /stopPokeWalletObserver/);
  assert.match(fn, /correctionDebt/);
  assert.match(fn, /credited/);
});

await test("reordering removes permanent Up Down buttons while keeping drag and a non-drag position menu", async () => {
  const [main, styles] = await Promise.all([text("src/main.ts"), text("public/styles.css")]);
  assert.match(main, /bindSmoothReorder/);
  assert.match(main, /pointerdown/);
  assert.match(main, /Move position menu/);
  assert.match(main, /Position \$\{position\+1\}/);
  assert.doesNotMatch(main, />↑ Up</);
  assert.doesNotMatch(main, />↓ Down</);
  assert.match(styles, /\.smooth-reorder-ghost/);
  assert.match(styles, /prefers-reduced-motion/);
});

await test("water calendar removes the redundant water-log dot while preserving target and supplement states", async () => {
  const [main, styles] = await Promise.all([text("src/main.ts"), text("public/styles.css")]);
  assert.doesNotMatch(main, /water-day-dot/);
  assert.doesNotMatch(styles, /water-day-dot/);
  assert.match(main, /Blue fill: target reached · Purple dot: supplement logged/);
  assert.match(main, /supplement-day-dot/);
  assert.match(main, /water-hit/);
});

await test("personal and family weekly supplement details use the same review-row renderer", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /private renderWeeklySupplementRows/);
  assert.match(main, /this\.renderWeeklySupplementRows\(entries,start,this\.supplementWeekFilter\)/);
  assert.match(main, /familySupplementReview = weekly && familySupplementEntries\.length/);
  assert.match(main, /this\.renderWeeklySupplementRows\(familySupplementEntries/);
});

await test("completed-activity logging starts from actual blank values and exposes only existing non-sensitive tracker metrics", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /starter targets are never prefilled as historical facts/);
  assert.match(main, /Not recorded/);
  assert.match(main, /More tracker \/ device metrics \(optional\)/);
  assert.match(main, /name="sessionMinutes"/);
  assert.match(main, /name="speed"/);
  assert.match(main, /name="incline"/);
  assert.match(main, /name="resistance"/);
  assert.match(main, /name="pace500"/);
  assert.doesNotMatch(main, /name="vo2max"/i);
  assert.doesNotMatch(main, /name="hrv"/i);
  assert.match(main, /knownSessionMinutes>0 \? new Date\(completedAt\.getTime\(\)-knownSessionMinutes\*60000\) : completedAt/);
});


await test("Cloud reconnect survives hard reloads and never blocks sign-in on full sync", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /CLOUD_RECONNECT_SLOT/);
  assert.match(main, /cloudReconnectRequested\(\)/);
  assert.match(main, /rememberCloudReconnectRequest\(\)/);
  assert.match(main, /clearCloudReconnectRequest\(\)/);
  assert.match(main, /cloudMembershipRefreshPromise/);
  assert.match(main, /withTimeout/);
  assert.match(main, /20_000/);
  assert.match(main, /Cloud authorization is complete at this point/);
  assert.match(main, /this\.authInteractiveStatus = null;\n      this\.clearAuthInteractiveWatchdog\(\);\n      this\.render\(\);/);
  assert.match(main, /data-action="retry-cloud-auth"/);
});


await test("iPhone and iPad auth uses redirect-first handoff with persisted-state recovery instead of an infinite popup wait", async () => {
  const [client, main] = await Promise.all([text("src/services/firebase-client.ts"), text("src/main.ts")]);
  assert.match(client, /appleMobileWebContext/);
  assert.match(client, /iPad\|iPhone\|iPod/);
  assert.match(client, /if \(appleMobileWebContext\(\)\)/);
  assert.match(client, /signInWithRedirect/);
  assert.match(client, /GOOGLE_REDIRECT_LOCAL_MARKER/);
  assert.match(client, /GOOGLE_REDIRECT_MAX_AGE_MS/);
  assert.match(client, /currentFirebaseAuthUser/);
  assert.match(main, /Attach the persistent auth observer before consuming a redirect result/);
  assert.ok(main.indexOf("await observeFirebaseAuth") < main.indexOf("consumeGoogleRedirectSignIn(),"));
  assert.match(main, /recoverInteractiveGoogleSignIn/);
  assert.match(main, /15_000/);
  assert.match(main, /visibilityState === "visible"/);
});


await test("notification onboarding and push setup cannot hang on service-worker readiness", async () => {
  const [client, main] = await Promise.all([text("src/services/firebase-client.ts"), text("src/main.ts")]);
  assert.match(client, /PUSH_SERVICE_WORKER_WAIT_MS = 6_000/);
  assert.match(client, /activePushServiceWorkerRegistration/);
  assert.match(client, /navigator\.serviceWorker\.getRegistration/);
  assert.match(client, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(client, /Promise\.race/);
  assert.match(client, /activePushServiceWorkerRegistration\(2_500\)/);
  assert.doesNotMatch(client, /const registration = await navigator\.serviceWorker\.ready;/);
  assert.match(main, /const enableRequest=enablePushNotifications\(this\.authUser,this\.cloudMembership\);\n    this\.render\(\);/);
  assert.match(main, /void this\.maybeShowFamilyNotificationPrompt\(\)/);
});

await test("Family Compare never waits indefinitely for full private companion reconciliation", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /Cloud family data took too long to load/);
  assert.match(main, /Family comparison is read-only UI and must not wait for migrations/);
  assert.match(main, /this\.cloudFamilyDaily=snapshot\.familyDaily;[\s\S]*this\.cloudCompanionReady=true;[\s\S]*this\.render\(\);/);
  assert.match(main, /Family progress update timed out; local data is still safe/);
  assert.match(main, /Refreshing family data in the background; showing the latest available snapshot/);
  assert.match(main, /void this\.refreshPushAndPokeState\(false\)/);
  assert.match(main, /older weekly summary with totals only/);
});

await test("v0.15 version and service-worker cache are explicit", async () => {
  const [pkg, main, sw, verify] = await Promise.all([text("package.json"), text("src/main.ts"), text("public/sw.js"), text("scripts/verify-live-deployment.mjs")]);
  assert.equal(JSON.parse(pkg).version, "0.15.0");
  assert.match(main, /APP_VERSION = "0\.15\.0"/);
  assert.match(sw, /logtogether-shell-v0\.15\.0-notify-hotfix4/);
  assert.match(verify, /v0\.15\.0/);
});
