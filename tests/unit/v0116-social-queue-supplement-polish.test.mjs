import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const text = async path => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Poke rain uses Web Animations API with explicit positions and a fallback", async () => {
  const [main, css] = await Promise.all([text("src/main.ts"), text("public/styles.css")]);
  assert.match(main, /Array\.from\(\{length:22\}/);
  assert.match(main, /typeof particle\.animate === "function"/);
  assert.match(main, /particle\.animate\(\[/);
  assert.match(main, /particle\.style\.left=`\$\{left\}%`/);
  assert.match(main, /poke-fall-fallback/);
  assert.match(css, /\.poke-emoji-rain i\.poke-fall-fallback/);
});

test("social events are queued in order and marked seen only after presentation", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /visualPresentationQueue: VisualPresentation\[\]/);
  assert.match(main, /queuedSocialEventIds = new Set<string>/);
  assert.match(main, /sort\(\(a,b\)=>a\.createdAtMs-b\.createdAtMs\)/);
  assert.match(main, /markSocialEventsPresented\(next\.socialEventIds\)/);
  assert.match(main, /window\.setTimeout\(\(\)=>this\.drainVisualPresentationQueue\(\),140\)/);
  assert.match(main, /document\.visibilityState === "hidden"/);
});

test("Gold Day and badge foreground events share the queue instead of replacing Pokes", async () => {
  const [main, css] = await Promise.all([text("src/main.ts"), text("public/styles.css")]);
  assert.match(main, /showSocialEventPresentationNow/);
  assert.match(main, /event\.kind === "badge" \? "badge" : "gold"/);
  assert.match(main, /kind:"social"/);
  assert.match(css, /\.social-event-celebration\.gold/);
  assert.match(css, /\.social-event-celebration\.badge/);
});

test("temporary visual regression harness remains owner-only and local-only", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /DEVELOPER_EFFECT_TESTS_V0117 = true/);
  assert.match(main, /if\(!DEVELOPER_EFFECT_TESTS_V0117 \|\| !this\.isDeveloperOwner\(\)\) return ""/);
  assert.match(main, /data-dev-effect="large-family-burst"/);
  assert.match(main, /this\.enqueueSocialEventBatch\(burst,false\)/);
});

test("custom supplement selection controls research wording and persistent draft state", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /selectedCustom \? .*Research this supplement/);
  assert.match(main, /supplementLogOpen/);
  assert.match(main, /customSupplementManagerOpen/);
  assert.match(main, /supplementDraftId/);
  assert.match(main, /supplementDraftAmount/);
  assert.match(main, /supplementDraftUnit/);
});

test("custom supplement manager uses one dropdown editor without closing the logger", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /id="custom-supplement-manage-picker"/);
  assert.match(main, /Choose a supplement to manage/);
  assert.match(main, /this\.supplementLogOpen=true; this\.customSupplementManagerOpen=true/);
  assert.match(main, /Save changes/);
  assert.match(main, /Remove from list/);
  assert.match(main, /entry\.customLabel=label/);
});

test("owner Pokes use the same wallet, cooldown and flood protection as every member", async () => {
  const [fn,policy] = await Promise.all([text("functions/index.js"),text("functions/poke-policy.js")]);
  assert.doesNotMatch(fn, /const unlimited = senderAccess\.role === "owner"/);
  assert.match(fn, /assessPokeSpend/);
  assert.match(policy, /nowMs - lastSentAtMs < cooldownMs/);
  assert.match(fn, /tx\.set\(walletRef/);
  assert.match(fn, /RECIPIENT_FLOOD_MAX = 5/);
  assert.match(fn, /if \(recent\.length >= RECIPIENT_FLOOD_MAX\)/);
});
