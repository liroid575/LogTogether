import fs from "node:fs";
import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";

const projectId = "demo-logtogether";
let env;

const future = (hours = 24) => Timestamp.fromMillis(Date.now() + hours * 60 * 60 * 1000);
const past = (hours = 1) => Timestamp.fromMillis(Date.now() - hours * 60 * 60 * 1000);
const nowTs = () => Timestamp.now();

function auth(uid, email = `${uid}@example.com`, emailVerified = true) {
  return env.authenticatedContext(uid, { email, email_verified: emailVerified }).firestore();
}

async function seed() {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();

    await setDoc(doc(db, "access/alice"), {
      schemaVersion: 1, familyId: "family-a", role: "owner", status: "active", inviteId: "bootstrap"
    });
    await setDoc(doc(db, "access/bob"), {
      schemaVersion: 1, familyId: "family-a", role: "member", status: "active", inviteId: "seed-bob"
    });
    await setDoc(doc(db, "access/charlie"), {
      schemaVersion: 1, familyId: "family-a", role: "member", status: "active", inviteId: "seed-charlie"
    });
    await setDoc(doc(db, "access/eve"), {
      schemaVersion: 1, familyId: "family-a", role: "member", status: "revoked", inviteId: "seed-eve"
    });
    await setDoc(doc(db, "access/mallory"), {
      schemaVersion: 1, familyId: "family-b", role: "owner", status: "active", inviteId: "bootstrap"
    });

    await setDoc(doc(db, "families/family-a"), {
      schemaVersion: 1, ownerId: "alice", name: "A Family"
    });
    await setDoc(doc(db, "families/family-b"), {
      schemaVersion: 1, ownerId: "mallory", name: "B Family"
    });

    for (const member of [
      ["family-a", "alice", "owner", "active", "bootstrap"],
      ["family-a", "bob", "member", "active", "seed-bob"],
      ["family-a", "charlie", "member", "active", "seed-charlie"],
      ["family-a", "eve", "member", "revoked", "seed-eve"],
      ["family-b", "mallory", "owner", "active", "bootstrap"]
    ]) {
      const [familyId, uid, role, status, inviteId] = member;
      await setDoc(doc(db, `families/${familyId}/members/${uid}`), {
        schemaVersion: 1, familyId, uid, role, status, inviteId, displayName: uid
      });
    }

    await setDoc(doc(db, "users/alice"), { locale: "en", theme: "dark", privateNote: "Alice only" });
    await setDoc(doc(db, "users/bob"), { locale: "zh-TW", theme: "dark", privateNote: "Bob only" });

    const sharedBase = {
      schemaVersion: 1,
      familyId: "family-a",
      selectedViewerIds: []
    };

    await setDoc(doc(db, "workouts/w1"), {
      ...sharedBase, ownerId: "alice", activityKind: "strength", visibility: "family", routineName: "A"
    });
    await setDoc(doc(db, "workouts/private-w"), {
      ...sharedBase, ownerId: "alice", activityKind: "strength", visibility: "private", routineName: "Private"
    });
    await setDoc(doc(db, "workouts/bob-private"), {
      ...sharedBase, ownerId: "bob", activityKind: "strength", visibility: "private", routineName: "Bob Private"
    });
    await setDoc(doc(db, "workouts/selected-w"), {
      ...sharedBase, ownerId: "alice", activityKind: "strength", visibility: "selected",
      selectedViewerIds: ["bob"], routineName: "Selected"
    });
    await setDoc(doc(db, "hydration/h1"), {
      ...sharedBase, ownerId: "alice", visibility: "private", totalMl: 1000
    });
    await setDoc(doc(db, "hikes/hike-a"), {
      ...sharedBase, ownerId: "alice", activityKind: "hike", visibility: "family",
      id: "hike-a", name: "Elephant Mountain", date: "2026-09-12", distanceKm: 3.2,
      movingMinutes: 70, elapsedMinutes: 90, elevationGainM: 250, elevationLossM: 250,
      difficulty: 3, waterMl: 0, notes: "sunset", clientUpdatedAt: "2026-09-12T12:00:00.000Z", updatedAt: nowTs()
    });
    await setDoc(doc(db, "supplements/alice_2026-09-13"), {
      schemaVersion: 1, ownerId: "alice", familyId: "family-a", date: "2026-09-13",
      entries: [{ id: "s1", at: "2026-09-13T01:00:00.000Z", supplementId: "multivitamin", amount: 1, unit: "serving" }],
      clientUpdatedAt: "2026-09-13T01:00:00.000Z", updatedAt: nowTs()
    });
    await setDoc(doc(db, "familyWeekly/alice_2026-09-08"), {
      schemaVersion: 1, ownerId: "alice", familyId: "family-a", weekStart: "2026-09-08",
      weeklyCalories: 420, workoutCount: 2, hikeCount: 1, hikeKm: 3.2,
      calorieDays: 2, waterDays: 3, categoriesHit: 4, missionScore: 9, missionMax: 22,
      supplements: [{ supplementId: "multivitamin", amount: 3, unit: "serving", entries: 3, days: 3, mixedUnits: false }],
      supplementEntries: [
        { date: "2026-09-13", time: "09:00", supplementId: "multivitamin", amount: 1, unit: "serving" }
      ],
      clientUpdatedAt: "2026-09-13T01:00:00.000Z", updatedAt: nowTs()
    });
    await setDoc(doc(db, "bodyMetrics/m1"), {
      schemaVersion: 1, ownerId: "alice", familyId: "family-a", weightKg: 70
    });
    await setDoc(doc(db, "familyProgress/alice_2026-09-13"), {
      schemaVersion: 1, ownerId: "alice", familyId: "family-a", date: "2026-09-13",
      calories: 420, waterMl: 1800, workoutCount: 1, goldDay: true, clientUpdatedAt: "2026-09-13T00:00:00.000Z", updatedAt: nowTs()
    });
    await setDoc(doc(db, "familyProgress/mallory_2026-09-13"), {
      schemaVersion: 1, ownerId: "mallory", familyId: "family-b", date: "2026-09-13",
      calories: 900, waterMl: 2500, workoutCount: 2, goldDay: true, clientUpdatedAt: "2026-09-13T00:00:00.000Z", updatedAt: nowTs()
    });
    await setDoc(doc(db, "routines/r-family"), {
      ...sharedBase, ownerId: "alice", visibility: "family", name: "Family Routine"
    });
    await setDoc(doc(db, "routines/r-private"), {
      ...sharedBase, ownerId: "alice", visibility: "private", name: "Private Routine"
    });

    await setDoc(doc(db, "stories/live-story"), {
      schemaVersion: 1, ownerId: "alice", familyId: "family-a",
      createdAt: nowTs(), expiresAt: future(12), caption: "live"
    });
    await setDoc(doc(db, "stories/expired-story"), {
      schemaVersion: 1, ownerId: "alice", familyId: "family-a",
      createdAt: past(25), expiresAt: past(1), caption: "expired"
    });

    await setDoc(doc(db, "invites/invite-dana"), {
      schemaVersion: 1,
      familyId: "family-a",
      emailLower: "dana@example.com",
      role: "member",
      status: "pending",
      invitedBy: "alice",
      createdAt: nowTs(),
      expiresAt: future(48)
    });
    await setDoc(doc(db, "invites/invite-expired"), {
      schemaVersion: 1,
      familyId: "family-a",
      emailLower: "old@example.com",
      role: "member",
      status: "pending",
      invitedBy: "alice",
      createdAt: past(48),
      expiresAt: past(1)
    });
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: fs.readFileSync("firestore.rules", "utf8") }
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

after(async () => { await env?.cleanup(); });

test("unauthenticated users cannot read family workouts", async () => {
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "workouts/w1")));
});

test("same-family members can read family-visible workouts", async () => {
  await assertSucceeds(getDoc(doc(auth("bob"), "workouts/w1")));
});

test("workout sync owner query can list only the signed-in user's workouts", async () => {
  const db = auth("bob");
  const snapshot = await assertSucceeds(getDocs(query(
    collection(db, "workouts"),
    where("ownerId", "==", "bob")
  )));
  assert.deepEqual(snapshot.docs.map(item => item.id).sort(), ["bob-private"]);
});

test("family comparison query can list family-visible workouts for an authorized owner", async () => {
  const db = auth("bob");
  const snapshot = await assertSucceeds(getDocs(query(
    collection(db, "workouts"),
    where("ownerId", "==", "alice"),
    where("familyId", "==", "family-a"),
    where("visibility", "==", "family")
  )));
  assert.deepEqual(snapshot.docs.map(item => item.id).sort(), ["w1"]);
});

test("different families cannot read family-visible workouts", async () => {
  await assertFails(getDoc(doc(auth("mallory"), "workouts/w1")));
});

test("private resources remain private even from the family owner", async () => {
  await assertSucceeds(getDoc(doc(auth("bob"), "workouts/bob-private")));
  await assertFails(getDoc(doc(auth("alice"), "workouts/bob-private")));
  await assertFails(getDoc(doc(auth("bob"), "workouts/private-w")));
});

test("selected sharing permits only listed active family members", async () => {
  await assertSucceeds(getDoc(doc(auth("bob"), "workouts/selected-w")));
  await assertFails(getDoc(doc(auth("charlie"), "workouts/selected-w")));
  await assertFails(getDoc(doc(auth("mallory"), "workouts/selected-w")));
});

test("revoked members lose access to family-visible data", async () => {
  await assertFails(getDoc(doc(auth("eve"), "workouts/w1")));
});

test("family member cannot edit another member's workout", async () => {
  await assertFails(updateDoc(doc(auth("bob"), "workouts/w1"), { routineName: "tampered" }));
});

test("resource owner cannot transfer ownership or family identity", async () => {
  await assertFails(updateDoc(doc(auth("alice"), "workouts/w1"), { ownerId: "bob" }));
  await assertFails(updateDoc(doc(auth("alice"), "workouts/w1"), { familyId: "family-b" }));
});

test("active owner can update their own resource without changing security identity", async () => {
  await assertSucceeds(updateDoc(doc(auth("alice"), "workouts/w1"), { routineName: "Updated" }));
  const snapshot = await getDoc(doc(auth("alice"), "workouts/w1"));
  assert.equal(snapshot.data()?.routineName, "Updated");
});

test("account settings and body metrics are private", async () => {
  await assertSucceeds(getDoc(doc(auth("alice"), "users/alice")));
  await assertFails(getDoc(doc(auth("bob"), "users/alice")));
  await assertFails(getDoc(doc(auth("bob"), "bodyMetrics/m1")));
});

test("owner can read their UID body metrics path before the document exists", async () => {
  const missing = await assertSucceeds(getDoc(doc(auth("bob"), "bodyMetrics/bob")));
  assert.equal(missing.exists(), false);
  await assertFails(getDoc(doc(auth("alice"), "bodyMetrics/bob")));
});

test("hydration is owner-only in V1", async () => {
  await assertSucceeds(getDoc(doc(auth("alice"), "hydration/h1")));
  await assertFails(getDoc(doc(auth("bob"), "hydration/h1")));
});


test("family-visible hike metadata is readable only inside the active family", async () => {
  await assertSucceeds(getDoc(doc(auth("alice"), "hikes/hike-a")));
  const snapshot = await assertSucceeds(getDoc(doc(auth("bob"), "hikes/hike-a")));
  assert.equal(snapshot.data()?.name, "Elephant Mountain");
  await assertFails(getDoc(doc(auth("mallory"), "hikes/hike-a")));
  await assertFails(getDoc(doc(auth("eve"), "hikes/hike-a")));
});

test("exact supplement entries are owner-only", async () => {
  const own = await assertSucceeds(getDoc(doc(auth("alice"), "supplements/alice_2026-09-13")));
  assert.equal(own.data()?.entries?.[0]?.supplementId, "multivitamin");
  await assertFails(getDoc(doc(auth("bob"), "supplements/alice_2026-09-13")));
});

test("owner can create and update only their own supplement day", async () => {
  const db = auth("bob");
  const ref = doc(db, "supplements/bob_2026-09-13");
  await assertSucceeds(setDoc(ref, {
    schemaVersion: 1, ownerId: "bob", familyId: "family-a", date: "2026-09-13",
    entries: [{ id: "b1", at: "2026-09-13T02:00:00.000Z", supplementId: "vitamin_d", amount: 1, unit: "capsule" }],
    clientUpdatedAt: "2026-09-13T02:00:00.000Z", updatedAt: nowTs()
  }));
  await assertSucceeds(updateDoc(ref, {
    entries: [], clientUpdatedAt: "2026-09-13T03:00:00.000Z", updatedAt: nowTs()
  }));
  await assertFails(updateDoc(doc(db, "supplements/alice_2026-09-13"), { entries: [] }));
});

test("same-family members can read enabled weekly supplement details but not owner-only day documents", async () => {
  const snapshot = await assertSucceeds(getDoc(doc(auth("bob"), "familyWeekly/alice_2026-09-08")));
  assert.equal(snapshot.data()?.missionScore, 9);
  assert.equal(snapshot.data()?.hikeKm, 3.2);
  assert.equal(snapshot.data()?.supplements?.[0]?.supplementId, "multivitamin");
  assert.equal(snapshot.data()?.supplementEntries?.[0]?.time, "09:00");
  await assertFails(getDoc(doc(auth("bob"), "supplements/alice_2026-09-13")));
  await assertFails(getDoc(doc(auth("mallory"), "familyWeekly/alice_2026-09-08")));
});

test("member can publish their own bounded weekly summary but not another member's", async () => {
  const db = auth("bob");
  const ref = doc(db, "familyWeekly/bob_2026-09-08");
  await assertSucceeds(setDoc(ref, {
    schemaVersion: 1, ownerId: "bob", familyId: "family-a", weekStart: "2026-09-08",
    difficulty: "normal",
    weeklyCalories: 180, workoutCount: 1, hikeCount: 0, hikeKm: 0,
    calorieDays: 1, waterDays: 2, categoriesHit: 2, missionScore: 5, missionMax: 22,
    supplements: [], supplementEntries: [], clientUpdatedAt: "2026-09-13T04:00:00.000Z", updatedAt: nowTs()
  }));
  await assertSucceeds(updateDoc(ref, {
    difficulty: "hard", weeklyCalories: 220, missionScore: 6,
    clientUpdatedAt: "2026-09-13T05:00:00.000Z", updatedAt: nowTs()
  }));
  await assertFails(updateDoc(ref, { difficulty: "unsafe" }));
  await assertFails(updateDoc(ref, { supplementEntries: Array.from({ length: 101 }, () => ({ date: "2026-09-13", time: "09:00", supplementId: "vitamin_d" })) }));
  await assertFails(updateDoc(doc(db, "familyWeekly/alice_2026-09-08"), { missionScore: 22 }));
});

test("same-family members can read only the minimal family progress aggregate", async () => {
  const snapshot = await assertSucceeds(getDoc(doc(auth("bob"), "familyProgress/alice_2026-09-13")));
  assert.equal(snapshot.data()?.calories, 420);
  assert.equal(snapshot.data()?.waterMl, 1800);
  assert.equal(snapshot.data()?.workoutCount, 1);
  assert.equal(snapshot.data()?.entries, undefined);
  assert.equal(snapshot.data()?.weightKg, undefined);
});

test("family progress query is constrained to an authorized owner in the active family", async () => {
  const db = auth("bob");
  const snapshot = await assertSucceeds(getDocs(query(
    collection(db, "familyProgress"),
    where("ownerId", "==", "alice"),
    where("familyId", "==", "family-a")
  )));
  assert.deepEqual(snapshot.docs.map(item => item.id).sort(), ["alice_2026-09-13"]);
  await assertFails(getDoc(doc(db, "familyProgress/mallory_2026-09-13")));
});

test("member can publish and update only their own bounded family progress", async () => {
  const db = auth("bob");
  const ref = doc(db, "familyProgress/bob_2026-09-13");
  await assertSucceeds(setDoc(ref, {
    schemaVersion: 1, ownerId: "bob", familyId: "family-a", date: "2026-09-13",
    calories: 120, waterMl: 750, workoutCount: 1, goldDay: false, clientUpdatedAt: "2026-09-13T01:00:00.000Z", updatedAt: nowTs()
  }));
  await assertSucceeds(updateDoc(ref, { calories: 150, waterMl: 1000, clientUpdatedAt: "2026-09-13T02:00:00.000Z", updatedAt: nowTs() }));
  await assertFails(updateDoc(doc(db, "familyProgress/alice_2026-09-13"), { calories: 999 }));
});

test("family progress cannot smuggle raw health or workout fields", async () => {
  const db = auth("bob");
  await assertFails(setDoc(doc(db, "familyProgress/bob_bad"), {
    schemaVersion: 1, ownerId: "bob", familyId: "family-a", date: "2026-09-13",
    calories: 120, waterMl: 750, workoutCount: 1, goldDay: false, clientUpdatedAt: "2026-09-13T01:00:00.000Z", updatedAt: nowTs(),
    weightKg: 70, entries: [{ ml: 250 }], exercises: [{ id: "secret" }]
  }));
});

test("saved routines obey private and family visibility", async () => {
  await assertSucceeds(getDoc(doc(auth("bob"), "routines/r-family")));
  await assertFails(getDoc(doc(auth("bob"), "routines/r-private")));
});

test("family owner can create a bounded pending invite", async () => {
  await assertSucceeds(setDoc(doc(auth("alice", "alice@example.com"), "invites/new-invite"), {
    schemaVersion: 1,
    familyId: "family-a",
    emailLower: "new@example.com",
    role: "member",
    status: "pending",
    invitedBy: "alice",
    createdAt: nowTs(),
    expiresAt: future(24)
  }));
});

test("ordinary family members cannot create invitations", async () => {
  await assertFails(setDoc(doc(auth("bob", "bob@example.com"), "invites/bad-invite"), {
    schemaVersion: 1,
    familyId: "family-a",
    emailLower: "new@example.com",
    role: "member",
    status: "pending",
    invitedBy: "bob",
    createdAt: nowTs(),
    expiresAt: future(24)
  }));
});

test("matching verified invitee can read their pending invite", async () => {
  await assertSucceeds(getDoc(doc(auth("dana", "DANA@example.com", true), "invites/invite-dana")));
  await assertFails(getDoc(doc(auth("dana", "wrong@example.com", true), "invites/invite-dana")));
  await assertFails(getDoc(doc(auth("dana", "dana@example.com", false), "invites/invite-dana")));
});

async function claimInvite(uid, email, inviteId = "invite-dana") {
  const db = auth(uid, email, true);
  const batch = writeBatch(db);
  batch.set(doc(db, `access/${uid}`), {
    schemaVersion: 1,
    familyId: "family-a",
    role: "member",
    status: "active",
    inviteId
  });
  batch.set(doc(db, `families/family-a/members/${uid}`), {
    schemaVersion: 1,
    familyId: "family-a",
    uid,
    role: "member",
    status: "active",
    inviteId,
    displayName: uid,
    identitySeeded: true
  });
  batch.update(doc(db, `invites/${inviteId}`), {
    status: "claimed",
    claimedBy: uid,
    claimedAt: nowTs()
  });
  return batch.commit();
}

test("verified matching user can atomically claim an invitation", async () => {
  await assertSucceeds(claimInvite("dana", "dana@example.com"));
  await assertSucceeds(getDoc(doc(auth("dana", "dana@example.com"), "workouts/w1")));
});

test("wrong or unverified email cannot claim an invitation", async () => {
  await assertFails(claimInvite("dana", "wrong@example.com"));

  const db = auth("dana", "dana@example.com", false);
  const batch = writeBatch(db);
  batch.set(doc(db, "access/dana"), {
    schemaVersion: 1, familyId: "family-a", role: "member", status: "active", inviteId: "invite-dana"
  });
  batch.set(doc(db, "families/family-a/members/dana"), {
    schemaVersion: 1, familyId: "family-a", uid: "dana", role: "member", status: "active",
    inviteId: "invite-dana", displayName: "Dana", identitySeeded: true
  });
  batch.update(doc(db, "invites/invite-dana"), {
    status: "claimed", claimedBy: "dana", claimedAt: nowTs()
  });
  await assertFails(batch.commit());
});

test("invite claim fails if the access/member/invite writes are not atomic", async () => {
  const db = auth("dana", "dana@example.com", true);
  const batch = writeBatch(db);
  batch.set(doc(db, "access/dana"), {
    schemaVersion: 1, familyId: "family-a", role: "member", status: "active", inviteId: "invite-dana"
  });
  batch.update(doc(db, "invites/invite-dana"), {
    status: "claimed", claimedBy: "dana", claimedAt: nowTs()
  });
  await assertFails(batch.commit());
});

test("expired invitation cannot be claimed", async () => {
  const db = auth("old", "old@example.com", true);
  const batch = writeBatch(db);
  batch.set(doc(db, "access/old"), {
    schemaVersion: 1, familyId: "family-a", role: "member", status: "active", inviteId: "invite-expired"
  });
  batch.set(doc(db, "families/family-a/members/old"), {
    schemaVersion: 1, familyId: "family-a", uid: "old", role: "member", status: "active",
    inviteId: "invite-expired", displayName: "Old", identitySeeded: true
  });
  batch.update(doc(db, "invites/invite-expired"), {
    status: "claimed", claimedBy: "old", claimedAt: nowTs()
  });
  await assertFails(batch.commit());
});

test("claimed invitation cannot be reused by another account", async () => {
  await assertSucceeds(claimInvite("dana", "dana@example.com"));

  const db = auth("oscar", "dana@example.com", true);
  const batch = writeBatch(db);
  batch.set(doc(db, "access/oscar"), {
    schemaVersion: 1, familyId: "family-a", role: "member", status: "active", inviteId: "invite-dana"
  });
  batch.set(doc(db, "families/family-a/members/oscar"), {
    schemaVersion: 1, familyId: "family-a", uid: "oscar", role: "member", status: "active",
    inviteId: "invite-dana", displayName: "Oscar", identitySeeded: true
  });
  batch.update(doc(db, "invites/invite-dana"), {
    status: "claimed", claimedBy: "oscar", claimedAt: nowTs()
  });
  await assertFails(batch.commit());
});

test("owner must revoke member access and membership atomically", async () => {
  const db = auth("alice", "alice@example.com", true);
  await assertFails(updateDoc(doc(db, "access/bob"), { status: "revoked" }));

  const batch = writeBatch(db);
  batch.update(doc(db, "access/bob"), { status: "revoked" });
  batch.update(doc(db, "families/family-a/members/bob"), { status: "revoked" });
  await assertSucceeds(batch.commit());

  await assertFails(getDoc(doc(auth("bob"), "workouts/w1")));
});

test("member cannot reactivate or promote themselves", async () => {
  await assertFails(updateDoc(doc(auth("eve"), "access/eve"), { status: "active" }));
  await assertFails(updateDoc(doc(auth("bob"), "families/family-a/members/bob"), { role: "owner" }));
});

test("member can edit family profile presentation fields only", async () => {
  const db = auth("bob");
  await assertSucceeds(updateDoc(doc(db, "families/family-a/members/bob"), {
    displayName: "Bobby",
    photoURL: "https://example.com/avatar.jpg",
    identitySeeded: true,
    updatedAt: nowTs()
  }));
  await assertSucceeds(updateDoc(doc(db, "families/family-a/members/bob"), { displayName: "Robert" }));
  await assertSucceeds(updateDoc(doc(db, "families/family-a/members/bob"), { biologicalSex: "male", updatedAt: nowTs() }));
  await assertSucceeds(updateDoc(doc(db, "families/family-a/members/bob"), {
    profileSharing: { biologicalSex: false, supplements: true, recentWorkouts: false, recentHikes: true },
    updatedAt: nowTs()
  }));
  await assertFails(updateDoc(doc(db, "families/family-a/members/bob"), {
    profileSharing: { biologicalSex: false, supplements: true, recentWorkouts: false, recentHikes: true, extra: true },
    updatedAt: nowTs()
  }));
  const familyView = await assertSucceeds(getDoc(doc(auth("alice"), "families/family-a/members/bob")));
  assert.equal(familyView.data()?.biologicalSex, "male");
  await assertFails(updateDoc(doc(db, "families/family-a/members/bob"), { biologicalSex: "invalid", updatedAt: nowTs() }));
  await assertFails(updateDoc(doc(db, "families/family-a/members/bob"), { photoURL: "https://tracker.example/pixel.jpg" }));
  await assertFails(updateDoc(doc(db, "families/family-a/members/bob"), { familyId: "family-b" }));
});

test("family owner can restore revoked member access atomically", async () => {
  const db = auth("alice", "alice@example.com", true);
  const batch = writeBatch(db);
  batch.update(doc(db, "access/eve"), { status: "active" });
  batch.update(doc(db, "families/family-a/members/eve"), { status: "active" });
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(auth("eve"), "workouts/w1")));
});

test("live stories are family-readable but expired stories and outsiders are denied", async () => {
  await assertSucceeds(getDoc(doc(auth("bob"), "stories/live-story")));
  await assertFails(getDoc(doc(auth("bob"), "stories/expired-story")));
  await assertFails(getDoc(doc(auth("mallory"), "stories/live-story")));
});

test("story creation is limited to 24 hours", async () => {
  const db = auth("bob");
  await assertSucceeds(setDoc(doc(db, "stories/ok"), {
    schemaVersion: 1, ownerId: "bob", familyId: "family-a",
    createdAt: nowTs(), expiresAt: future(23), caption: "ok"
  }));
  await assertFails(setDoc(doc(db, "stories/too-long"), {
    schemaVersion: 1, ownerId: "bob", familyId: "family-a",
    createdAt: nowTs(), expiresAt: future(48), caption: "no"
  }));
});

test("unknown collections remain denied by default", async () => {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), "surprise/data"), { secret: true });
  });
  await assertFails(getDoc(doc(auth("alice"), "surprise/data")));
  await assertFails(setDoc(doc(auth("alice"), "surprise/new"), { anything: true }));
});

test("v0.8.3 groups isolate members while owner can administer every group", async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, "families/family-a/groups/default"), { schemaVersion: 1, name: "Family", createdAt: nowTs(), updatedAt: nowTs() });
    await setDoc(doc(db, "families/family-a/groups/friends"), { schemaVersion: 1, name: "Friends", createdAt: nowTs(), updatedAt: nowTs() });
    await updateDoc(doc(db, "access/alice"), { groupId: "default", shareGroupIds: ["default"] });
    await updateDoc(doc(db, "families/family-a/members/alice"), { groupId: "default", shareGroupIds: ["default"] });
    await updateDoc(doc(db, "access/bob"), { groupId: "default" });
    await updateDoc(doc(db, "families/family-a/members/bob"), { groupId: "default" });
    await updateDoc(doc(db, "access/charlie"), { groupId: "friends" });
    await updateDoc(doc(db, "families/family-a/members/charlie"), { groupId: "friends" });
    await setDoc(doc(db, "workouts/charlie-family"), {
      schemaVersion: 1, familyId: "family-a", ownerId: "charlie", activityKind: "strength",
      visibility: "family", selectedViewerIds: [], routineName: "Charlie workout"
    });
  });

  await assertSucceeds(getDoc(doc(auth("bob"), "workouts/w1")));
  await assertFails(getDoc(doc(auth("charlie"), "workouts/w1")));
  await assertFails(getDoc(doc(auth("bob"), "workouts/charlie-family")));
  await assertSucceeds(getDoc(doc(auth("alice"), "workouts/charlie-family")));
});

test("owner can choose multiple groups that may see owner shared data", async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, "families/family-a/groups/default"), { schemaVersion: 1, name: "Family", createdAt: nowTs(), updatedAt: nowTs() });
    await setDoc(doc(db, "families/family-a/groups/friends"), { schemaVersion: 1, name: "Friends", createdAt: nowTs(), updatedAt: nowTs() });
    await updateDoc(doc(db, "access/alice"), { groupId: "default", shareGroupIds: ["default", "friends"] });
    await updateDoc(doc(db, "families/family-a/members/alice"), { groupId: "default", shareGroupIds: ["default", "friends"] });
    await updateDoc(doc(db, "access/charlie"), { groupId: "friends" });
    await updateDoc(doc(db, "families/family-a/members/charlie"), { groupId: "friends" });
  });

  await assertSucceeds(getDoc(doc(auth("charlie"), "workouts/w1")));
  await assertSucceeds(getDoc(doc(auth("charlie"), "families/family-a/members/alice")));
});

test("members cannot move themselves between groups, but owner can move them atomically", async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, "families/family-a/groups/default"), { schemaVersion: 1, name: "Family", createdAt: nowTs(), updatedAt: nowTs() });
    await setDoc(doc(db, "families/family-a/groups/friends"), { schemaVersion: 1, name: "Friends", createdAt: nowTs(), updatedAt: nowTs() });
    await updateDoc(doc(db, "access/bob"), { groupId: "default" });
    await updateDoc(doc(db, "families/family-a/members/bob"), { groupId: "default" });
  });

  await assertFails(updateDoc(doc(auth("bob"), "access/bob"), { groupId: "friends" }));

  const ownerDb = auth("alice");
  const batch = writeBatch(ownerDb);
  batch.update(doc(ownerDb, "access/bob"), { groupId: "friends" });
  batch.update(doc(ownerDb, "families/family-a/members/bob"), { groupId: "friends" });
  await assertSucceeds(batch.commit());
});


test("verified invited email can recover only its own bounded pending invite query", async () => {
  const dana = auth("dana", "dana@example.com", true);
  const snapshot = await assertSucceeds(getDocs(query(
    collection(dana, "invites"),
    where("emailLower", "==", "dana@example.com"),
    where("status", "==", "pending"),
    limit(3)
  )));
  assert.deepEqual(snapshot.docs.map(item=>item.id), ["invite-dana"]);

  const unverified = auth("dana-unverified", "dana@example.com", false);
  await assertFails(getDocs(query(
    collection(unverified, "invites"),
    where("emailLower", "==", "dana@example.com"),
    where("status", "==", "pending"),
    limit(3)
  )));

  await assertFails(getDocs(query(
    collection(dana, "invites"),
    where("status", "==", "pending"),
    limit(3)
  )));
  await assertFails(getDocs(query(
    collection(dana, "invites"),
    where("emailLower", "==", "old@example.com"),
    where("status", "==", "pending"),
    limit(3)
  )));
  await assertFails(getDocs(query(
    collection(dana, "invites"),
    where("emailLower", "==", "dana@example.com"),
    where("status", "==", "pending"),
    limit(4)
  )));
});

test("v0.15 normal members can share more than one group without leaking to non-overlapping members", async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db=context.firestore();
    await setDoc(doc(db,"families/family-a/groups/default"),{schemaVersion:1,name:"Family",createdAt:nowTs(),updatedAt:nowTs()});
    await setDoc(doc(db,"families/family-a/groups/friends"),{schemaVersion:1,name:"Friends",createdAt:nowTs(),updatedAt:nowTs()});
    await setDoc(doc(db,"families/family-a/groups/other"),{schemaVersion:1,name:"Other",createdAt:nowTs(),updatedAt:nowTs()});
    await updateDoc(doc(db,"access/alice"),{groupId:"default",groupIds:["default"],shareGroupIds:["default"]});
    await updateDoc(doc(db,"families/family-a/members/alice"),{groupId:"default",groupIds:["default"],shareGroupIds:["default"]});
    await updateDoc(doc(db,"access/bob"),{groupId:"default",groupIds:["default","friends"]});
    await updateDoc(doc(db,"families/family-a/members/bob"),{groupId:"default",groupIds:["default","friends"]});
    await updateDoc(doc(db,"access/charlie"),{groupId:"friends",groupIds:["friends"]});
    await updateDoc(doc(db,"families/family-a/members/charlie"),{groupId:"friends",groupIds:["friends"]});
    await setDoc(doc(db,"access/frank"),{schemaVersion:1,familyId:"family-a",role:"member",status:"active",inviteId:"seed-frank",groupId:"other",groupIds:["other"]});
    await setDoc(doc(db,"families/family-a/members/frank"),{schemaVersion:1,familyId:"family-a",uid:"frank",role:"member",status:"active",inviteId:"seed-frank",displayName:"frank",groupId:"other",groupIds:["other"]});
    await setDoc(doc(db,"workouts/charlie-multi"),{schemaVersion:1,familyId:"family-a",ownerId:"charlie",activityKind:"strength",visibility:"family",selectedViewerIds:[],routineName:"Charlie multi"});
  });
  await assertSucceeds(getDoc(doc(auth("bob"),"workouts/charlie-multi")));
  await assertFails(getDoc(doc(auth("frank"),"workouts/charlie-multi")));
});

test("v0.15 grouped member list query is rule-complete and excludes owner documents", async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db=context.firestore();
    await setDoc(doc(db,"families/family-a/groups/default"),{schemaVersion:1,name:"Family",createdAt:nowTs(),updatedAt:nowTs()});
    await setDoc(doc(db,"families/family-a/groups/friends"),{schemaVersion:1,name:"Friends",createdAt:nowTs(),updatedAt:nowTs()});
    await updateDoc(doc(db,"access/alice"),{groupId:"default",groupIds:["default"],shareGroupIds:["default"]});
    await updateDoc(doc(db,"families/family-a/members/alice"),{groupId:"default",groupIds:["default"],shareGroupIds:["default"]});
    await updateDoc(doc(db,"access/bob"),{groupId:"default",groupIds:["default","friends"]});
    await updateDoc(doc(db,"families/family-a/members/bob"),{groupId:"default",groupIds:["default","friends"]});
    await updateDoc(doc(db,"access/charlie"),{groupId:"friends",groupIds:["friends"]});
    await updateDoc(doc(db,"families/family-a/members/charlie"),{groupId:"friends",groupIds:["friends"]});
  });

  const bob = auth("bob");
  const snapshot = await assertSucceeds(getDocs(query(
    collection(bob,"families/family-a/members"),
    where("groupIds","array-contains-any",["default","friends"]),
    where("status","==","active"),
    where("role","==","member")
  )));
  const ids = snapshot.docs.map(item=>item.id).sort();
  assert.deepEqual(ids,["bob","charlie"]);
});

test("members cannot self-add a secondary group and owner must mirror group arrays atomically", async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db=context.firestore();
    await setDoc(doc(db,"families/family-a/groups/default"),{schemaVersion:1,name:"Family",createdAt:nowTs(),updatedAt:nowTs()});
    await setDoc(doc(db,"families/family-a/groups/friends"),{schemaVersion:1,name:"Friends",createdAt:nowTs(),updatedAt:nowTs()});
    await updateDoc(doc(db,"access/bob"),{groupId:"default",groupIds:["default"]});
    await updateDoc(doc(db,"families/family-a/members/bob"),{groupId:"default",groupIds:["default"]});
  });
  await assertFails(updateDoc(doc(auth("bob"),"access/bob"),{groupIds:["default","friends"]}));

  const ownerDb=auth("alice");
  await assertFails(updateDoc(doc(ownerDb,"access/bob"),{groupIds:["default","friends"]}));
  const batch=writeBatch(ownerDb);
  batch.update(doc(ownerDb,"access/bob"),{groupId:"default",groupIds:["default","friends"]});
  batch.update(doc(ownerDb,"families/family-a/members/bob"),{groupId:"default",groupIds:["default","friends"]});
  await assertSucceeds(batch.commit());
});
