const { reconcileGoldReward } = require("./gold-rewards");
const { onDocumentWritten, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const webpush = require("web-push");

initializeApp();
const db = getFirestore();
const REGION = "asia-east1";
const APP_TIME_ZONE = "Asia/Taipei";
const VAPID_PUBLIC = defineSecret("LOGTOGETHER_VAPID_PUBLIC_KEY");
const VAPID_PRIVATE = defineSecret("LOGTOGETHER_VAPID_PRIVATE_KEY");
const PUSH_SECRETS = [VAPID_PUBLIC, VAPID_PRIVATE];
const POKE_EMOJIS = new Set(["👋","💪","🎉","🔥","🫡"]);
const POKE_MAX = 7;
const POKE_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const RECIPIENT_FLOOD_WINDOW_MS = 60 * 60 * 1000;
const RECIPIENT_FLOOD_MAX = 5;

function groupId(data) {
  return typeof data?.groupId === "string" && data.groupId ? data.groupId : "default";
}
function shareGroups(data) {
  if (Array.isArray(data?.shareGroupIds) && data.shareGroupIds.length) {
    return data.shareGroupIds.filter(value => typeof value === "string" && value);
  }
  return [groupId(data)];
}
function canSeeActor(actor, viewer) {
  if (!actor || !viewer || actor.status !== "active" || viewer.status !== "active") return false;
  if (actor.familyId !== viewer.familyId) return false;
  if (actor.uid === viewer.uid) return true;
  if (actor.role === "owner") return shareGroups(actor).includes(groupId(viewer));
  if (viewer.role === "owner") return shareGroups(viewer).includes(groupId(actor));
  return groupId(actor) === groupId(viewer);
}
function notificationPrefs(data) {
  const value = data?.notificationPreferences ?? {};
  const clean = items => Array.isArray(items) ? items.filter(item => typeof item === "string" && item).slice(0,100) : [];
  return {
    goldDays: value.goldDays !== false,
    badges: value.badges !== false,
    pokes: value.pokes !== false,
    mutedPokeUids: clean(value.mutedPokeUids),
    mutedPokeGroupIds: clean(value.mutedPokeGroupIds)
  };
}
function displayName(data) {
  const value = typeof data?.displayName === "string" ? data.displayName.trim() : "";
  return value.slice(0,80) || "A family member";
}
function datePartsInZone(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const read = type => parts.find(part => part.type === type)?.value ?? "";
  return { date: `${read("year")}-${read("month")}-${read("day")}`, month: `${read("year")}-${read("month")}` };
}
function currentMonth() { return datePartsInZone().month; }
function safeDocPart(value) { return String(value ?? "").replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,120); }
async function activeFamilyMembers(familyId) {
  const snapshot = await db.collection("families").doc(familyId).collection("members").where("status","==","active").get();
  return snapshot.docs.map(doc => ({uid:doc.id,...doc.data()}));
}
function vapidSubject() {
  const environmentProjectId =
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "";

  if (environmentProjectId) {
    return `https://${environmentProjectId}.web.app/`;
  }

  try {
    const firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG || "{}");
    if (typeof firebaseConfig.projectId === "string" && firebaseConfig.projectId.trim()) {
      return `https://${firebaseConfig.projectId.trim()}.web.app/`;
    }
  } catch {}

  // Valid URL fallback for non-Firebase test environments.
  return "https://firebase.google.com/";
}

function configureWebPush() {
  webpush.setVapidDetails(vapidSubject(), VAPID_PUBLIC.value(), VAPID_PRIVATE.value());
}
async function recordUsage(familyId, values) {
  if (!familyId) return;
  const month = currentMonth();
  const payload = {
    schemaVersion:1,
    familyId,
    month,
    updatedAt:FieldValue.serverTimestamp()
  };
  for (const [key,value] of Object.entries(values)) {
    const amount = Math.max(0, Math.round(Number(value) || 0));
    if (amount) payload[key] = FieldValue.increment(amount);
  }
  await db.doc(`developerUsage/${safeDocPart(familyId)}_${month}`).set(payload,{merge:true}).catch(error => {
    console.warn("Usage counter failed", error?.message ?? error);
  });
}
async function storeSocialInboxEvent(uid, kind, payload) {
  if (!["poke","gold","badge"].includes(kind) || !payload?.eventId) return 0;
  const ref = db.doc(`users/${uid}/socialInbox/${safeDocPart(payload.eventId)}`);
  await ref.set({
    schemaVersion:1, ownerId:uid, kind,
    title:String(payload.title ?? "LogTogether").slice(0,160),
    body:String(payload.body ?? "").slice(0,300),
    url:String(payload.url ?? "/#family").slice(0,200),
    ...(typeof payload.emoji === "string" ? {emoji:payload.emoji.slice(0,8)} : {}),
    ...(typeof payload.senderUid === "string" ? {senderUid:payload.senderUid.slice(0,128)} : {}),
    ...(typeof payload.senderName === "string" ? {senderName:payload.senderName.slice(0,80)} : {}),
    createdAt:FieldValue.serverTimestamp()
  },{merge:false});
  // Keep the inbox deliberately small. Push is transport; this is only a short
  // privacy-bounded fallback so missed/unsupported push does not lose the event.
  const snapshot = await db.collection(`users/${uid}/socialInbox`).orderBy("createdAt","desc").limit(32).get().catch(()=>null);
  if (snapshot && snapshot.docs.length > 24) {
    const batch=db.batch();
    snapshot.docs.slice(24).forEach(doc=>batch.delete(doc.ref));
    await batch.commit().catch(()=>undefined);
  }
  return 1;
}

async function sendPushToUser(uid, kind, payload, onlySubscriptionId = "") {
  const userSnap = await db.doc(`users/${uid}`).get();
  if (!userSnap.exists) return {sent:0,failed:0,inbox:0};
  const prefs = notificationPrefs(userSnap.data());
  if ((kind === "gold" && !prefs.goldDays) || (kind === "badge" && !prefs.badges) || (kind === "poke" && !prefs.pokes)) {
    return {sent:0,failed:0,inbox:0};
  }
  const inbox = await storeSocialInboxEvent(uid,kind,payload).catch(error=>{ console.warn("Social inbox write failed",uid,error?.message ?? error); return 0; });
  let subscriptionDocs = [];
  if (onlySubscriptionId) {
    const single = await db.doc(`users/${uid}/pushSubscriptions/${onlySubscriptionId}`).get();
    if (single.exists) subscriptionDocs = [single];
  } else {
    const subscriptions = await db.collection(`users/${uid}/pushSubscriptions`).get();
    subscriptionDocs = subscriptions.docs;
  }
  if (!subscriptionDocs.length) return {sent:0,failed:0,inbox};
  configureWebPush();
  let sent = 0;
  let failed = 0;
  await Promise.all(subscriptionDocs.map(async doc => {
    const data = doc.data();
    if (typeof data.endpoint !== "string" || typeof data.keys?.p256dh !== "string" || typeof data.keys?.auth !== "string") return;
    try {
      await webpush.sendNotification(
        {endpoint:data.endpoint,keys:{p256dh:data.keys.p256dh,auth:data.keys.auth}},
        JSON.stringify(payload),
        {TTL:60*60,urgency:"normal"}
      );
      sent += 1;
    } catch (error) {
      failed += 1;
      const status = Number(error?.statusCode ?? 0);
      if (status === 404 || status === 410) await doc.ref.delete().catch(()=>undefined);
      else console.warn("Push delivery failed", uid, status, error?.message ?? error);
    }
  }));
  return {sent,failed,inbox};
}
async function notifyVisibleFamily(actorUid, familyId, kind, payload) {
  const members = await activeFamilyMembers(familyId);
  const actor = members.find(member => member.uid === actorUid);
  if (!actor) return {sent:0,failed:0};
  const results = await Promise.all(
    members
      .filter(member => member.uid !== actorUid && canSeeActor(actor,member))
      .map(member => sendPushToUser(member.uid,kind,payload))
  );
  return results.reduce((sum,item)=>({sent:sum.sent+item.sent,failed:sum.failed+item.failed,inbox:sum.inbox+(item.inbox||0)}),{sent:0,failed:0,inbox:0});
}
async function claimSocialEvent(eventId, data) {
  const ref = db.doc(`socialEvents/${safeDocPart(eventId)}`);
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (snapshot.exists) return false;
    tx.create(ref,{schemaVersion:1,...data,createdAt:FieldValue.serverTimestamp()});
    return true;
  });
}

// Reconcile the current document rather than trusting trigger arrival order.
// Reward state and wallet move together, including deletion and restoration.
exports.onFamilyDailyChanged = onDocumentWritten({document:"familyProgress/{dailyId}",region:REGION,secrets:PUSH_SECRETS,maxInstances:1}, async event => {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  if (before && after && before.goldDay === after.goldDay) return;
  const identity = after || before;
  if (!identity || typeof identity.ownerId !== "string" || typeof identity.familyId !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(identity.date ?? "")) return;
  if (event.params.dailyId !== `${identity.ownerId}_${identity.date}`) return;
  const eventId = `gold_${identity.ownerId}_${identity.date}`;
  const ledgerRef = db.doc(`socialEvents/${safeDocPart(eventId)}`);
  const walletRef = db.doc(`pokeWallets/${identity.ownerId}`);
  const dailyRef = db.doc(`familyProgress/${event.params.dailyId}`);
  const changed = await db.runTransaction(async tx => {
    const [dailySnap, ledgerSnap, walletSnap, accessSnap] = await Promise.all([
      tx.get(dailyRef), tx.get(ledgerRef), tx.get(walletRef), tx.get(db.doc(`access/${identity.ownerId}`))
    ]);
    const daily = dailySnap.exists ? dailySnap.data() : null;
    const access = accessSnap.exists ? accessSnap.data() : null;
    if (!access || access.status !== "active" || access.familyId !== identity.familyId) return null;
    if (daily && (daily.ownerId !== identity.ownerId || daily.familyId !== identity.familyId || daily.date !== identity.date)) return null;
    const eligible = daily?.goldDay === true;
    // Older dates can be corrected, but never mass-minted on first upgrade.
    if (!ledgerSnap.exists && identity.date !== datePartsInZone().date) return null;
    const result = reconcileGoldReward(ledgerSnap.exists ? ledgerSnap.data() : null, walletSnap.data(), eligible, access.role === "owner");
    if (!result) return null;
    tx.set(ledgerRef,{...result.ledger,kind:"gold",ownerId:identity.ownerId,familyId:identity.familyId,date:identity.date,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    tx.set(walletRef,{schemaVersion:1,ownerId:identity.ownerId,balance:result.balance,correctionDebt:result.correctionDebt,maxBalance:POKE_MAX,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    return result;
  });
  if (!changed?.notify) return;
  const memberSnap = await db.doc(`families/${identity.familyId}/members/${identity.ownerId}`).get();
  const name = displayName(memberSnap.exists ? memberSnap.data() : {});
  const delivery = await notifyVisibleFamily(identity.ownerId,identity.familyId,"gold",{
    kind:"gold",eventId,senderUid:identity.ownerId,senderName:name,
    title:`${name} earned today's Gold Day! ⭐`,body:"Today's activity game goal is complete.",url:"/#family"
  });
  await recordUsage(identity.familyId,{goldEvents:1,pushDeliveries:delivery.sent,pushFailures:delivery.failed});
});

exports.onBadgeCreated = onDocumentCreated({document:"badges/{badgeId}",region:REGION,secrets:PUSH_SECRETS}, async event => {
  const badge = event.data?.data();
  if (!badge || typeof badge.ownerId !== "string" || typeof badge.familyId !== "string") return;
  const earnedAt = Date.parse(String(badge.earnedAt ?? ""));
  if (!Number.isFinite(earnedAt) || Math.abs(Date.now()-earnedAt) > 24*60*60*1000) return; // no historical migration storm
  const eventId = `badge_${event.params.badgeId}`;
  const claimed = await claimSocialEvent(eventId,{kind:"badge",ownerId:badge.ownerId,familyId:badge.familyId,badgeId:event.params.badgeId});
  if (!claimed) return;
  const memberSnap = await db.doc(`families/${badge.familyId}/members/${badge.ownerId}`).get();
  const name = displayName(memberSnap.exists ? memberSnap.data() : {});
  const badgeTitle = String(badge.title ?? "a new badge").trim().slice(0,100) || "a new badge";
  const monthlyTitle = badgeTitle.replace(/\s+badge$/i, "");
  const delivery = await notifyVisibleFamily(badge.ownerId,badge.familyId,"badge",{
    kind:"badge",
    eventId, senderUid:badge.ownerId, senderName:name,
    title:badge.badgeType === "monthly" ? `${name} earned the ${monthlyTitle} badge! 🏅` : `${name} earned ${badgeTitle}! 🏅`,
    body:badge.badgeType === "monthly" ? "A new monthly LogTogether badge was earned." : "A new LogTogether hiking badge was earned.",
    url:"/#family"
  });
  await recordUsage(badge.familyId,{badgeEvents:1,pushDeliveries:delivery.sent,pushFailures:delivery.failed});
});

exports.sendPoke = onCall({region:REGION,secrets:PUSH_SECRETS,enforceAppCheck:true}, async request => {
  const senderUid = request.auth?.uid;
  if (!senderUid) throw new HttpsError("unauthenticated","Sign in to send a Poke.");
  const recipientUid = String(request.data?.recipientUid ?? "").trim();
  const emoji = String(request.data?.emoji ?? "👋");
  if (!recipientUid || recipientUid === senderUid) throw new HttpsError("invalid-argument","Choose another family member.");
  if (!POKE_EMOJIS.has(emoji)) throw new HttpsError("invalid-argument","Choose one of the available Poke emojis.");

  const [senderAccessSnap,recipientAccessSnap] = await Promise.all([
    db.doc(`access/${senderUid}`).get(), db.doc(`access/${recipientUid}`).get()
  ]);
  if (!senderAccessSnap.exists || !recipientAccessSnap.exists) throw new HttpsError("permission-denied","Active family access is required.");
  const senderAccess = {uid:senderUid,...senderAccessSnap.data()};
  const recipientAccess = {uid:recipientUid,...recipientAccessSnap.data()};
  if (senderAccess.status !== "active" || recipientAccess.status !== "active" || senderAccess.familyId !== recipientAccess.familyId) {
    throw new HttpsError("permission-denied","That person is not in your active family.");
  }
  const familyId = senderAccess.familyId;
  const unlimited = senderAccess.role === "owner"; // temporary developer test privilege for v0.11.x
  await recordUsage(familyId,{pokeCalls:1});

  const [senderMemberSnap,recipientMemberSnap,recipientUserSnap] = await Promise.all([
    db.doc(`families/${familyId}/members/${senderUid}`).get(),
    db.doc(`families/${familyId}/members/${recipientUid}`).get(),
    db.doc(`users/${recipientUid}`).get()
  ]);
  if (!senderMemberSnap.exists || !recipientMemberSnap.exists) throw new HttpsError("permission-denied","Family membership is unavailable.");
  const sender = {uid:senderUid,...senderMemberSnap.data()};
  const recipient = {uid:recipientUid,...recipientMemberSnap.data()};
  if (!canSeeActor(sender,recipient) || !canSeeActor(recipient,sender)) throw new HttpsError("permission-denied","Pokes stay within your visible family group.");

  const recipientPrefs = notificationPrefs(recipientUserSnap.exists ? recipientUserSnap.data() : {});
  const senderGroup = groupId(sender);
  if (!recipientPrefs.pokes || recipientPrefs.mutedPokeUids.includes(senderUid) || recipientPrefs.mutedPokeGroupIds.includes(senderGroup)) {
    await recordUsage(familyId,{pokesBlocked:1});
    throw new HttpsError("failed-precondition","Poke unavailable right now.");
  }
  const walletRef = db.doc(`pokeWallets/${senderUid}`);
  const rateRef = db.doc(`pokeRateLimits/${senderUid}_${recipientUid}`);
  const recipientLimitRef = db.doc(`pokeRecipientLimits/${recipientUid}`);
  let result;
  try {
    result = await db.runTransaction(async tx => {
      // Firestore transactions require reads before writes.
      const [walletSnap,rateSnap,limitSnap] = await Promise.all([
        tx.get(walletRef), tx.get(rateRef), tx.get(recipientLimitRef)
      ]);
      const now = Date.now();
      const last = rateSnap.data()?.lastSentAt?.toMillis?.() ?? 0;
      if (!unlimited && last && now-last < POKE_COOLDOWN_MS) {
        throw new HttpsError("resource-exhausted","You can Poke this person again later.");
      }
      const recent = Array.isArray(limitSnap.data()?.recentSentAtMs)
        ? limitSnap.data().recentSentAtMs.filter(value => Number.isFinite(value) && now-Number(value) < RECIPIENT_FLOOD_WINDOW_MS).map(Number)
        : [];
      if (recent.length >= RECIPIENT_FLOOD_MAX) {
        throw new HttpsError("resource-exhausted","This person has received several Pokes recently. Try again later.");
      }
      const current = Math.max(0,Math.min(POKE_MAX,Number(walletSnap.data()?.balance ?? 0)));
      if (!unlimited && current < 1) throw new HttpsError("failed-precondition","Earn a Gold Day to get another Poke.");
      const next = unlimited ? current : current-1;
      if (!unlimited) tx.set(walletRef,{schemaVersion:1,ownerId:senderUid,balance:next,maxBalance:POKE_MAX,updatedAt:FieldValue.serverTimestamp()},{merge:true});
      tx.set(rateRef,{schemaVersion:1,senderUid,recipientUid,familyId,lastSentAt:FieldValue.serverTimestamp()},{merge:true});
      tx.set(recipientLimitRef,{schemaVersion:1,recipientUid,familyId,recentSentAtMs:[...recent,now],updatedAt:FieldValue.serverTimestamp()},{merge:true});
      return {balance:next,unlimited};
    });
  } catch (error) {
    await recordUsage(familyId,{pokesBlocked:1});
    throw error;
  }

  const name = displayName(sender);
  const eventId = `poke_${senderUid}_${recipientUid}_${Date.now()}`;
  const delivery = await sendPushToUser(recipientUid,"poke",{
    kind:"poke",
    eventId, emoji, senderUid, senderName:name,
    title:`${name} sent you ${emoji}`,
    body:"A Poke from your LogTogether group.",
    url:"/#family"
  });
  await recordUsage(familyId,{pokesDelivered:1,pushDeliveries:delivery.sent,pushFailures:delivery.failed});
  return {balance:result.balance,maxBalance:POKE_MAX,unlimited:result.unlimited};
});

exports.sendTestNotification = onCall({region:REGION,secrets:PUSH_SECRETS,enforceAppCheck:true}, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated","Sign in first.");
  const accessSnap = await db.doc(`access/${uid}`).get();
  const access = accessSnap.exists ? accessSnap.data() : null;
  if (!access || access.status !== "active" || access.role !== "owner") throw new HttpsError("permission-denied","Owner developer access is required.");
  const subscriptionId = String(request.data?.subscriptionId ?? "").trim();
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(subscriptionId)) throw new HttpsError("invalid-argument","A valid current-device push subscription is required.");
  const delivery = await sendPushToUser(uid,"test",{
    kind:"test",
    eventId:`test_${uid}_${Date.now()}`,
    title:"LogTogether test notification 🧪",
    body:"Push delivery is working on this device.",
    url:"/#settings"
  },subscriptionId);
  await recordUsage(access.familyId,{testNotifications:1,pushDeliveries:delivery.sent,pushFailures:delivery.failed});
  if (!delivery.sent) throw new HttpsError("failed-precondition","This device does not have an active push subscription.");
  return {sent:delivery.sent};
});

exports.getBackendDiagnostics = onCall({region:REGION,enforceAppCheck:true}, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated","Sign in first.");
  const accessSnap = await db.doc(`access/${uid}`).get();
  const access = accessSnap.exists ? accessSnap.data() : null;
  if (!access || access.status !== "active" || access.role !== "owner") throw new HttpsError("permission-denied","Owner developer access is required.");
  const month = currentMonth();
  const usageSnap = await db.doc(`developerUsage/${safeDocPart(access.familyId)}_${month}`).get();
  const usage = usageSnap.exists ? usageSnap.data() : {};
  const members = await activeFamilyMembers(access.familyId);
  const subscriptionCounts = await Promise.all(members.map(async member => {
    const snapshot = await db.collection(`users/${member.uid}/pushSubscriptions`).get();
    return snapshot.size;
  }));
  const n = key => Math.max(0,Math.round(Number(usage?.[key]) || 0));
  return {
    month,
    activeMembers:members.length,
    pushSubscriptions:subscriptionCounts.reduce((sum,value)=>sum+value,0),
    pokeCalls:n("pokeCalls"),
    pokesDelivered:n("pokesDelivered"),
    pokesBlocked:n("pokesBlocked"),
    goldEvents:n("goldEvents"),
    badgeEvents:n("badgeEvents"),
    testNotifications:n("testNotifications"),
    pushDeliveries:n("pushDeliveries"),
    pushFailures:n("pushFailures"),
    note:"LogTogether event counters only. This is not your official Firebase or Google Cloud bill."
  };
});
