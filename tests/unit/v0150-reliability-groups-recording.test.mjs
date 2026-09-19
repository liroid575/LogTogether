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
  assert.match(main, /setPointerCapture\(event\.pointerId\)/);
  assert.match(main, /document\.getSelection\(\)\?\.removeAllRanges\(\)/);
  assert.match(main, /routine-editor-exercise-head/);
  assert.match(main, /compact-reorder-handle/);
  assert.match(main, /Move position menu/);
  assert.match(main, /Position \$\{position\+1\}/);
  assert.doesNotMatch(main, />↑ Up</);
  assert.doesNotMatch(main, />↓ Down</);
  assert.match(styles, /\.smooth-reorder-ghost/);
  assert.match(styles, /-webkit-user-select:none/);
  assert.match(styles, /\.compact-reorder-handle/);
  assert.match(styles, /routine-remove-compact/);
  assert.match(styles, /-webkit-line-clamp:2/);
  assert.match(main, /dragThresholdPx = 7/);
  assert.match(main, /Math\.hypot\(dx,dy\) < dragThresholdPx/);
  assert.match(main, /routine-remove-compact/);
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


await test("notification setup uses declarative push when available and classic service workers as a bounded fallback", async () => {
  const [client, main, sw, fn] = await Promise.all([
    text("src/services/firebase-client.ts"),
    text("src/main.ts"),
    text("public/sw.js"),
    text("functions/index.js")
  ]);
  assert.match(client, /PUSH_SERVICE_WORKER_WAIT_MS = 15_000/);
  assert.match(client, /directWindowPushManager/);
  assert.match(client, /WindowWithPushManager/);
  assert.match(client, /pushManagerForCurrentContext/);
  assert.match(client, /navigator\.serviceWorker\.getRegistration\(window\.location\.href\)/);
  assert.match(client, /navigator\.serviceWorker\.register\("\/sw\.js", \{ scope:"\/" \}\)/);
  assert.doesNotMatch(client, /const registration=await navigator\.serviceWorker\.ready;/);
  assert.match(main, /navigator\.serviceWorker\.register\("\/sw\.js", \{ scope:"\/" \}\)/);
  assert.match(sw, /Promise\.allSettled/);
  assert.match(sw, /SKIP_WAITING/);
  assert.match(sw, /data\?\.web_push === 8030/);
  assert.match(fn, /function declarativePushPayload/);
  assert.match(fn, /web_push:8030/);
  assert.match(fn, /JSON\.stringify\(declarativePushPayload\(payload\)\)/);
  assert.match(main, /const enableRequest=enablePushNotifications\(this\.authUser,this\.cloudMembership\);\n    this\.render\(\);/);
});

await test("declarative Web Push keeps a classic service-worker fallback for older browsers", async () => {
  const [client, sw, fn] = await Promise.all([
    text("src/services/firebase-client.ts"),
    text("public/sw.js"),
    text("functions/index.js")
  ]);
  assert.match(client, /const direct = directWindowPushManager\(\)/);
  assert.match(client, /direct \?\? await pushManagerForCurrentContext/);
  assert.match(sw, /Promise\.allSettled\(SHELL\.map/);
  assert.doesNotMatch(sw, /cache\.addAll\(SHELL\)/);
  assert.match(sw, /const declarative = data\?\.web_push === 8030/);
  assert.match(fn, /navigate:new URL\(path,vapidSubject\(\)\)\.href/);
  assert.match(fn, /silent:false/);
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

await test("touch reordering always tears down stale iOS drag sessions", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /private activeReorderCleanup/);
  assert.match(main, /window\.addEventListener\("pointerup",onPointerUp/);
  assert.match(main, /window\.addEventListener\("pointercancel",onPointerCancel/);
  assert.match(main, /handle\.addEventListener\("lostpointercapture",onLostPointerCapture\)/);
  assert.match(main, /window\.addEventListener\("pagehide",onAbort/);
  assert.match(main, /document\.addEventListener\("visibilitychange",onVisibilityChange/);
  assert.match(main, /window\.setTimeout\(cancelActiveReorder,20_000\)/);
  assert.match(main, /let destinationIndex = from/);
  assert.match(main, /reorder-drop-before/);
  assert.match(main, /reorder-drop-after/);
  assert.doesNotMatch(main, /parent\.insertBefore\(source/);
  assert.match(main, /exercise-separator/);
  assert.match(main, /document\.querySelectorAll\("\.smooth-reorder-ghost"\)/);
  assert.match(main, /document\.addEventListener\("selectstart",preventSelection/);
});

await test("v0.15 version and service-worker cache are explicit", async () => {
  const [pkg, main, sw, verify] = await Promise.all([text("package.json"), text("src/main.ts"), text("public/sw.js"), text("scripts/verify-live-deployment.mjs")]);
  assert.equal(JSON.parse(pkg).version, "0.15.0");
  assert.match(main, /APP_VERSION = "0\.15\.0"/);
  assert.match(sw, /logtogether-shell-v0\.15\.0-reorder-slots-hotfix10/);
  assert.match(verify, /v0\.15\.0/);
  assert.match(verify, /attempt <= 12/);
  assert.match(verify, /await sleep\(1_000\)/);
});
