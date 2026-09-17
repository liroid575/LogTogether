import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const text = async path => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("single and double timer cue assets remain present and bounded", async () => {
  const [single, double] = await Promise.all([
    stat(new URL("../../public/timer-cue-single.mp3", import.meta.url)),
    stat(new URL("../../public/timer-cue-double.mp3", import.meta.url))
  ]);
  assert.ok(single.size > 500 && single.size < 20_000);
  assert.ok(double.size > single.size && double.size < 20_000);
});

test("timer audio mixes instead of claiming playback and priming is silent", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /audioSession.*type = "transient"/);
  assert.doesNotMatch(main, /audioSession.*type = "playback"/);
  assert.match(main, /private prepareTimerAudio\(\): void/);
  const prepare = main.slice(main.indexOf("private prepareTimerAudio"), main.indexOf("private playWebAudioCue"));
  assert.doesNotMatch(prepare, /\.play\(/);
});

test("timer semantics use one cue for manual actions and once-only double cues at deadlines", async () => {
  const main = await text("src/main.ts");
  assert.ok((main.match(/this\.playTimerCue\(1, false\)/g) ?? []).length >= 2);
  assert.match(main, /private playRestCompleteBeep\(\): void \{\s*this\.playTimerCue\(2, true\)/s);
  assert.match(main, /private processTimerDeadlines\(\): void/);
  assert.match(main, /now-activeSet\.startedAt >= target\*1000 && this\.workDeadlineKey!==key/);
  assert.match(main, /now-source\.startedAt >= source\.targetSec\*1000 && this\.restDeadlineKey!==key/);
});

test("returning from another app immediately reconciles timer deadlines", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /document\.addEventListener\("visibilitychange"/);
  assert.match(main, /document\.visibilityState === "visible"[\s\S]*this\.updateRestTimerDisplay\(\)/);
});

test("Firebase Auth uses persistence fallbacks and explicit popup results", async () => {
  const client = await text("src/services/firebase-client.ts");
  assert.match(client, /initializeAuth\(firebaseApp/);
  assert.match(client, /indexedDBLocalPersistence/);
  assert.match(client, /browserLocalPersistence/);
  assert.match(client, /browserSessionPersistence/);
  assert.match(client, /const credential = await authModule\.signInWithPopup/);
  assert.match(client, /return \{ mode: "popup", user \}/);
});

test("redirect fallback is persisted and consumed explicitly", async () => {
  const [client, main] = await Promise.all([text("src/services/firebase-client.ts"), text("src/main.ts")]);
  assert.match(client, /GOOGLE_REDIRECT_MARKER/);
  assert.match(client, /signInWithRedirect/);
  assert.match(client, /getRedirectResult/);
  assert.match(main, /consumeGoogleRedirectSignIn/);
  assert.match(main, /Finishing Google sign-in and checking Cloud access/);
  assert.match(main, /PENDING_INVITE_SESSION_KEY/);
});

test("tracked config does not hardcode a Firebase Hosting origin", async () => {
  const config = await text("public/config.js");
  assert.match(config, /mode:\s*"demo"/);
  assert.match(config, /firebase:\s*null/);
  assert.doesNotMatch(config, /[a-z0-9-]+\.(?:web\.app|firebaseapp\.com)/i);

  const exampleConfig = fs.readFileSync(
    new URL("../../config.example.js", import.meta.url),
    "utf8"
  );
  assert.match(exampleConfig, /authDomain:\s*"YOUR_AUTH_DOMAIN"/);
  assert.match(exampleConfig, /https:\/\/YOUR_AUTH_DOMAIN\/__\/auth\/handler/);
});
