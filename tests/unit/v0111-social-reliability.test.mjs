import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const text = async path => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

await test("rest completion uses current timer audio with WebAudio vibration and visual fallbacks", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /make\("\/timer-cue-double\.mp3"\)/);
  assert.match(main, /audioSession.*type = "transient"/);
  assert.match(main, /private playWebAudioCue/);
  assert.match(main, /vibrate\(/);
  assert.match(main, /rest-alert-flash/);
});

await test("notification defaults migrate on once and explicit device disable is remembered", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /notificationDefaultsV11_1Applied !== true/);
  assert.match(main, /notificationDefaultsV11_1Applied = true/);
  assert.match(main, /push-manually-disabled\.v1/);
  assert.match(main, /permission === "granted" && !status\.subscribed && !manuallyDisabled/);
});

await test("Gold Days use one reconcilable daily social event instead of the v0.11 weekly trigger", async () => {
  const fn = await text("functions/index.js");
  assert.match(fn, /exports\.onFamilyDailyChanged/);
  assert.doesNotMatch(fn, /exports\.onFamilyWeeklyChanged/);
  assert.match(fn, /`gold_\$\{identity\.ownerId\}_\$\{identity\.date\}`/);
  assert.match(fn, /reconcileGoldReward\(ledgerSnap/);
});

await test("Pokes cap at seven and enforce server-side mute plus recipient flood control", async () => {
  const fn = await text("functions/index.js");
  assert.match(fn, /const POKE_MAX = 7/);
  assert.match(fn, /const RECIPIENT_FLOOD_MAX = 5/);
  assert.match(fn, /mutedPokeUids\.includes\(senderUid\)/);
  assert.match(fn, /mutedPokeGroupIds\.includes\(senderGroup\)/);
  assert.match(fn, /pokeRecipientLimits/);
  assert.match(fn, /const unlimited = senderAccess\.role === "owner"/);
});

await test("owner test notification targets the current browser subscription", async () => {
  const [client, fn] = await Promise.all([text("src/services/firebase-client.ts"), text("functions/index.js")]);
  assert.match(client, /getSubscription\(\)/);
  assert.match(client, /callable\(\{subscriptionId:id\}\)/);
  assert.match(fn, /request\.data\?\.subscriptionId/);
  assert.match(fn, /sendPushToUser\(uid,"test",[\s\S]*subscriptionId\)/);
});

await test("Quick Guide uses a scrolling track and includes Poke education", async () => {
  const [main, css] = await Promise.all([text("src/main.ts"), text("public/styles.css")]);
  assert.match(main, /mission-tutorial-track/);
  assert.match(main, /How Pokes work/);
  assert.match(main, /up to 7 stored/);
  assert.match(css, /\.mission-tutorial-track\s*\{\s*display:flex/);
  assert.match(css, /overflow-x:auto/);
});

await test("circuit movements and rep sets support optional target work seconds", async () => {
  const [main, types] = await Promise.all([text("src/main.ts"), text("src/core/types.ts")]);
  assert.match(main, /Movement \$\{index\+1\}/);
  assert.match(main, /1 round = complete every movement below in order/);
  assert.match(main, /targetWorkSec/);
  assert.match(types, /targetWorkSec\?: number/);
});
