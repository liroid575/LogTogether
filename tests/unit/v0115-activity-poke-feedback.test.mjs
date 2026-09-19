import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const text = async path => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Home exposes Log activity while hiking keeps a dedicated route", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /data-action="log-activity"/);
  assert.match(main, /Log completed activity/);
  assert.match(main, /Hiking keeps its dedicated record/);
  assert.match(main, /exercise\.id!=="hiking_cardio"/);
  assert.match(main, /if\(exerciseId==="__hike__"\)/);
});

test("retrospective activity reuses exercise recording profiles and normal workout science", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /exerciseScienceLoggingProfile\(definition\)/);
  assert.match(main, /exerciseSessionMetricFlags\(definition\)/);
  assert.match(main, /estimateWorkoutCalories\(workout,this\.currentWeightKg\(\)\)/);
  assert.match(main, /this\.state\.workouts\.push\(workout\)/);
  assert.match(main, /Date & end time/);
  assert.match(main, /starter targets are never prefilled as historical facts/);
  assert.match(main, /<option value="" selected>\$\{zh\?"未記錄":"Not recorded"\}/);
  assert.match(main, /const knownSessionMinutes=timedSession \? minutes : sessionMinutes/);
  assert.match(main, /knownSessionMinutes>0 \? new Date\(completedAt\.getTime\(\)-knownSessionMinutes\*60000\) : completedAt/);
  assert.match(main, /game points cannot be entered manually/);
});

test("feedback uses an external optional Google Forms hook with privacy guidance", async () => {
  const [main, config] = await Promise.all([text("src/main.ts"), text("public/config.js")]);
  assert.match(config, /feedbackFormUrl:\s*""/);
  assert.match(main, /Help improve LogTogether/);
  assert.match(main, /Report bug \/ share idea/);
  assert.match(main, /Copy version & device info/);
  assert.match(main, /Avoid pasting private workout contents, account IDs, GPS routes or other sensitive data/);
  assert.match(main, /tutorial-feedback-page/);
});

test("Quick Guide includes the feedback page and keeps eight snapped pages", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /clamp\(this\.missionTutorialPage, 0, 7\)/);
  assert.match(main, /this\.missionTutorialPage >= 7/);
  assert.match(main, /safe===7/);
});
