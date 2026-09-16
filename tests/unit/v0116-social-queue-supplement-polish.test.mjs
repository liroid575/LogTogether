import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const text = async path => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("v0.11.6 versions the social/supplement polish shell", async () => {
  const [pkg, main, sw] = await Promise.all([text("package.json"), text("src/main.ts"), text("public/sw.js")]);
  assert.equal(JSON.parse(pkg).version, "0.11.6");
  assert.match(main, /APP_VERSION = "0\.11\.6"/);
  assert.match(sw, /logtogether-shell-v0\.11\.6-social-queue-supplement-polish/);
});

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
  assert.match(main, /markSocialEventPresented\(next\.socialEventId\)/);
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

test("temporary visual regression harness is owner-only and local-only", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /DEVELOPER_EFFECT_TESTS_V0116 = true/);
  assert.match(main, /if\(!DEVELOPER_EFFECT_TESTS_V0116 \|\| !this\.isDeveloperOwner\(\)\) return ""/);
  assert.match(main, /data-dev-effect="poke-five"/);
  assert.match(main, /data-dev-effect="mixed-queue"/);
  assert.match(main, /data-dev-effect="social-gold"/);
  assert.match(main, /data-dev-effect="local-water"/);
  assert.match(main, /data-dev-calendar-preview="gold"/);
  assert.match(main, /data-dev-calendar-preview="water"/);
  assert.match(main, /send nothing to family members/);
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

test("owner Poke backend privilege remains temporary while recipient flood protection remains", async () => {
  const fn = await text("functions/index.js");
  assert.match(fn, /const unlimited = senderAccess\.role === "owner"; \/\/ temporary developer test privilege for v0\.11\.x/);
  assert.match(fn, /if \(!unlimited && last && now-last < POKE_COOLDOWN_MS\)/);
  assert.match(fn, /RECIPIENT_FLOOD_MAX = 5/);
  assert.match(fn, /if \(recent\.length >= RECIPIENT_FLOOD_MAX\)/);
});
