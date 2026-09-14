import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync("src/services/firebase-client.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");

test("family invite flow remains present while v0.7 adds family cloud sync", () => {
  assert.match(client, /collection\(db, "invites"\)/);
  assert.match(client, /doc\(db, "access", user\.uid\)/);
  assert.match(client, /"families", invite\.familyId, "members", user\.uid/);
  assert.match(client, /doc\(db, "workouts"/);
  assert.match(client, /doc\(db, "hydration"/);
  assert.match(client, /doc\(db, "bodyMetrics"/);
  assert.match(client, /doc\(db, "hikes"/);
  assert.doesNotMatch(client, /doc\(db, "stories"/);
});

test("invite claim is a single Firestore batch across access, member and invite", () => {
  const start = client.indexOf("export async function claimFamilyInvite");
  assert.ok(start >= 0);
  const body = client.slice(start, client.indexOf("export async function seedGoogleMemberIdentity", start));
  assert.match(body, /writeBatch\(db\)/);
  assert.match(body, /batch\.set\(accessRef/);
  assert.match(body, /batch\.set\(memberRef/);
  assert.match(body, /batch\.update\(inviteRef/);
  assert.match(body, /await batch\.commit\(\)/);
});

test("family UI exposes owner invite links and automatic recipient claim", () => {
  assert.match(main, /id="create-invite-form"/);
  assert.doesNotMatch(main, /id="claim-invite-form"/);
  assert.match(main, /claimFamilyInvite\(user, this\.pendingInviteCode\)/);
  assert.match(main, /Connect existing Cloud account/);
});
