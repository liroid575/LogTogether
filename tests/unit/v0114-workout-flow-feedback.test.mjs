import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const text = async path => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("work and rest deadlines have independent once-only two-beep acknowledgement", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /private workDeadlineKey: string \| null = null/);
  assert.match(main, /private restDeadlineKey: string \| null = null/);
  assert.match(main, /private processTimerDeadlines\(\): void/);
  assert.match(main, /this\.workDeadlineKey!==key[\s\S]*this\.playRestCompleteBeep\(\)/);
  assert.match(main, /this\.restDeadlineKey!==key[\s\S]*this\.playRestCompleteBeep\(\)/);
  assert.ok((main.match(/this\.playTimerCue\(1, false\)/g) ?? []).length >= 2);
});

test("Family notification reminder is only permanently suppressed by the explicit never choice", async () => {
  const main = await text("src/main.ts");
  const fn = main.slice(main.indexOf("private async maybeShowFamilyNotificationPrompt"), main.indexOf("private async ensureSocialInboxObserver"));
  assert.match(fn, /familyNotificationPromptSuppressed\(\)/);
  assert.match(fn, /this\.familyNotificationPromptOpen=true/);
  assert.doesNotMatch(fn, /pushManuallyDisabled\(\).*return/);
  assert.match(main, /Never show this reminder again/);
});

test("social inbox starts with valid Cloud membership and Pokes can celebrate globally", async () => {
  const main = await text("src/main.ts");
  const membership = main.slice(main.indexOf("this.cloudMembership = membership"), main.indexOf("await this.syncCloudWorkouts"));
  assert.match(membership, /ensureSocialInboxObserver\(\)/);
  assert.match(main, /showPokeCelebration/);
  assert.match(main, /poke-emoji-rain/);
});

test("Skip is ordered, confirmed, persisted as skipped, and does not count as completion", async () => {
  const [main, types, analytics] = await Promise.all([text("src/main.ts"), text("src/core/types.ts"), text("src/core/analytics.ts")]);
  assert.match(types, /skipped\?: boolean/);
  assert.match(types, /skippedAt\?: string/);
  assert.match(main, /kind: "skip-set"/);
  assert.match(main, /Only the current next item can be skipped/);
  assert.match(main, /set\.skipped = true/);
  assert.match(main, /set\.completed = false/);
  assert.match(main, /Everything was skipped\. Discard this workout/);
  assert.match(analytics, /filter\(set => set\.completed/);
});

test("exercise-level Work target sits beside Rest and only propagates to future sets", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /Work per set \(sec\)/);
  assert.match(main, /exercise-timing-controls/);
  assert.match(main, /data-work-target-sec/);
  assert.match(main, /if \(!set\.startedAt && !set\.completed && !set\.skipped\) set\.targetWorkSec/);
});

test("drafts expose discard immediately and auth uses a global connection overlay", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /workout-draft-actions/);
  assert.match(main, /Clear this draft and return Home/);
  assert.match(main, /renderAuthProgressModal\(\)/);
  assert.match(main, /Connecting you to LogTogether/);
  assert.match(main, /Your Local data stays untouched until Cloud access is confirmed/);
});

test("Gold Day, water goal and badge celebrations are once-per-transition and motion aware", async () => {
  const [main, css] = await Promise.all([text("src/main.ts"), text("public/styles.css")]);
  assert.match(main, /celebrateOnce\("gold"/);
  assert.match(main, /celebrateOnce\("water"/);
  assert.match(main, /celebrateOnce\("badge"/);
  assert.match(main, /logtogether\.celebration\.v0114/);
  assert.match(css, /\.milestone-celebration/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
