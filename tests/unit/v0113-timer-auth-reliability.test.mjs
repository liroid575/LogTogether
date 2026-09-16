import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const text = async path => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("v0.11.3 versions the app and ships separate single/double timer cues", async () => {
  const [pkg, main, sw, single, double] = await Promise.all([
    text("package.json"), text("src/main.ts"), text("public/sw.js"),
    stat(new URL("../../public/timer-cue-single.mp3", import.meta.url)),
    stat(new URL("../../public/timer-cue-double.mp3", import.meta.url))
  ]);
  assert.equal(JSON.parse(pkg).version, "0.11.3");
  assert.match(main, /APP_VERSION = "0\.11\.3"/);
  assert.match(sw, /logtogether-shell-v0\.11\.3-timer-auth-reliability/);
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

test("timer semantics use one cue on Start Finish and two only at deadlines", async () => {
  const main = await text("src/main.ts");
  assert.ok((main.match(/this\.playTimerCue\(1, false\)/g) ?? []).length >= 2);
  assert.match(main, /private playRestCompleteBeep\(\): void \{\s*this\.playTimerCue\(2, true\)/s);
  assert.match(main, /if\(target>0 && Math\.floor\(\(Date\.now\(\)-activeSet\.startedAt\)\/1000\)>=target\)/);
  assert.match(main, /if \(remaining <= 0\)/);
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

test("redirect fallback uses the Firebase Hosting origin", async () => {
  const config = await text("public/config.js");
  assert.match(config, /authDomain: "YOUR_PROJECT_ID\.web\.app"/);
  assert.match(config, /https:\/\/YOUR_PROJECT_ID\.web\.app\/__\/auth\/handler/);
});
