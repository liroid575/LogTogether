import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const text = async path => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("the current release versions the family burst UI shell", async () => {
  const [pkg, main, sw] = await Promise.all([text("package.json"), text("src/main.ts"), text("public/sw.js")]);
  assert.equal(JSON.parse(pkg).version, "0.15.0");
  assert.match(main, /APP_VERSION = "0\.15\.0"/);
  assert.match(sw, /logtogether-shell-v0\.15\.0-drag-cleanup-hotfix8/);
});

test("received Poke rain is substantially larger without changing the animation engine", async () => {
  const [main, css] = await Promise.all([text("src/main.ts"), text("public/styles.css")]);
  assert.match(main, /const size=40 \+ \(i%6\)\*5/);
  assert.match(main, /typeof particle\.animate === "function"/);
  assert.match(main, /Array\.from\(\{length:22\}/);
  assert.match(css, /\.poke-celebration-message \{ z-index:2; \}/);
  assert.match(css, /\.poke-emoji-rain \{ position:absolute; inset:0; z-index:1; \}/);
});

test("large social inbox batches prioritize Pokes and compact overflow", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /enqueueSocialEventBatch\(events: SocialInboxEvent\[\]/);
  assert.match(main, /pokes\.slice\(0,3\)/);
  assert.match(main, /if\(pokes\.length>3\)/);
  assert.match(main, /pushSocialGroup\("badge",badges\)/);
  assert.match(main, /pushSocialGroup\("gold",golds\)/);
});

test("Gold Day and badge bursts summarize at three or more without losing inbox ids", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /if\(items\.length>=3\)/);
  assert.match(main, /family members earned a Gold Day/);
  assert.match(main, /new family badges/);
  assert.match(main, /socialEventIds:idsFor\(items\)/);
  assert.match(main, /markSocialEventsPresented\(next\.socialEventIds\)/);
});

test("temporary owner harness includes a local 15-person family burst test", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /DEVELOPER_EFFECT_TESTS_V0117 = true/);
  assert.match(main, /data-dev-effect="large-family-burst"/);
  assert.match(main, /15-person family burst/);
  assert.match(main, /names\.forEach\(\(name,index\)=>burst\.push/);
  assert.match(main, /this\.enqueueSocialEventBatch\(burst,false\)/);
});

test("weekly supplement review defaults closed but preserves deliberate open state", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /private supplementWeekOpen = false/);
  assert.match(main, /supplement-week-card" \$\{this\.supplementWeekOpen\?"open":""\}/);
  assert.doesNotMatch(main, /supplement-week-card" open/);
  assert.match(main, /this\.supplementWeekOpen=supplementWeekDetails\.open/);
});

test("weekly supplement filter keeps the disclosure open across its own rerender", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /#supplement-week-filter/);
  assert.match(main, /this\.supplementWeekFilter=\(event\.currentTarget as HTMLSelectElement\)\.value \|\| "all"/);
  assert.match(main, /this\.supplementWeekOpen=true;\n      this\.render\(\)/);
});

test("custom supplement management is visually emphasized while destructive removal stays separate", async () => {
  const [main, css] = await Promise.all([text("src/main.ts"), text("public/styles.css")]);
  assert.match(main, /⚙ Manage my supplements/);
  assert.match(main, /custom-supplement-manage-label/);
  assert.match(css, /\.custom-supplement-manage-label/);
  assert.match(css, /var\(--danger\)/);
  assert.match(main, /data-delete-custom-supplement/);
});
