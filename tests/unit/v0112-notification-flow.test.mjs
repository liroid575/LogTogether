import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const text = async path => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

await test("v0.11.2 versions the app and ships a compressed timer alert", async () => {
  const [pkg, main, sw, audioStat] = await Promise.all([
    text("package.json"), text("src/main.ts"), text("public/sw.js"), stat(new URL("../../public/rest-alert.mp3", import.meta.url))
  ]);
  assert.equal(JSON.parse(pkg).version, "0.11.2");
  assert.match(main, /APP_VERSION = "0\.11\.2"/);
  assert.match(sw, /logtogether-shell-v0\.11\.2-social-reliability/);
  assert.match(sw, /\/rest-alert\.mp3/);
  assert.ok(audioStat.size > 1000 && audioStat.size < 100_000);
  assert.match(main, /data-action="test-timer-alert"/);
});

await test("Family notification onboarding is playful, repeatable, and dismissible forever", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /👋<\/span><span>⭐<\/span><span>💪<\/span><span>🏅/);
  assert.match(main, /family-notification-enable/);
  assert.match(main, /family-notification-later/);
  assert.match(main, /family-notification-never/);
  assert.match(main, /reset-family-notification-prompt/);
  assert.match(main, /if\(page === "family"\) void this\.maybeShowFamilyNotificationPrompt\(\)/);
});

await test("social events fall back to a private bounded inbox when push is unavailable", async () => {
  const [fn, rules, client] = await Promise.all([text("functions/index.js"), text("firestore.rules"), text("src/services/firebase-client.ts")]);
  assert.match(fn, /storeSocialInboxEvent/);
  assert.match(fn, /if \(!subscriptionDocs\.length\) return \{sent:0,failed:0,inbox\}/);
  assert.match(fn, /limit\(32\)/);
  assert.match(rules, /match \/socialInbox\/\{eventId\}/);
  assert.match(rules, /allow get, list, delete: if signedIn\(\) && request\.auth\.uid == uid/);
  assert.match(client, /observeSocialInbox/);
});

await test("foreground Pokes show a bounded playful celebration with reduced-motion support", async () => {
  const [main, css] = await Promise.all([text("src/main.ts"), text("public/styles.css")]);
  assert.match(main, /poked you!/);
  assert.match(main, /Array\.from\(\{length:10\}/);
  assert.match(main, /3600/);
  assert.match(main, /4200/);
  assert.match(css, /\.poke-emoji-rain/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

await test("Quick Guide drags naturally but stops on complete pages", async () => {
  const css = await text("public/styles.css");
  assert.match(css, /scroll-snap-type:x mandatory/);
  assert.match(css, /scroll-snap-align:start/);
  assert.match(css, /scroll-snap-stop:always/);
});

await test("custom supplements sync privately and historical entries retain literal labels", async () => {
  const [main, types, client] = await Promise.all([text("src/main.ts"), text("src/core/types.ts"), text("src/services/firebase-client.ts")]);
  assert.match(types, /interface CustomSupplement/);
  assert.match(types, /customLabel\?: string/);
  assert.match(main, /Add my own supplement \/ brand/);
  assert.match(main, /Saved exactly as written/);
  assert.match(client, /customSupplements\?: CustomSupplement\[\]/);
  assert.match(client, /customLabel/);
});

await test("only the canonical next set or circuit movement can start", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /private nextStartableSet\(/);
  assert.match(main, /if \(workout\.routineMode === "circuit"\)/);
  assert.match(main, /Complete the previous circuit item first/);
  assert.match(main, /Finish the previous item first/);
});

await test("circuit round removal always uses the shared confirmation dialog", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /kind: "remove-circuit-round"/);
  assert.match(main, /Remove Round \$\{this\.confirmAction\.roundIndex \+ 1\}/);
  assert.match(main, /This removes this round from every movement in the circuit/);
  assert.doesNotMatch(main, /pendingCircuitRoundRemovalIndex/);
});
