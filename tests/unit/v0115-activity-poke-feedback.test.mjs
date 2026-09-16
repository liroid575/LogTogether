import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const text = async path => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("v0.11.5 versions the retrospective activity shell", async () => {
  const [pkg, main, sw] = await Promise.all([text("package.json"), text("src/main.ts"), text("public/sw.js")]);
  assert.equal(JSON.parse(pkg).version, "0.11.5");
  assert.match(main, /APP_VERSION = "0\.11\.5"/);
  assert.match(sw, /logtogether-shell-v0\.11\.5-activity-feedback/);
});

test("Home exposes Log activity while hiking keeps a dedicated route", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /data-action="log-activity"/);
  assert.match(main, /Log activity/);
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
  assert.match(main, /const startedAt=new Date\(completedAt\.getTime\(\)-totalSeconds\*1000\)/);
  assert.match(main, /game points cannot be entered manually/);
});

test("Poke rain uses explicit iOS-safe animation values and the emoji chooser has breathing room", async () => {
  const [main, css] = await Promise.all([text("src/main.ts"), text("public/styles.css")]);
  assert.match(main, /Array\.from\(\{length:16\}/);
  assert.match(main, /--poke-fall-distance:\$\{fallDistance\}px/);
  assert.match(main, /showPokeSentBurst/);
  assert.match(css, /var\(--poke-fall-distance,520px\)/);
  assert.match(css, /\.poke-emoji-row[^}]*padding:10px 4px 12px/);
});

test("custom supplements can be edited, renamed through history, researched and removed without deleting history", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /data-edit-custom-supplement/);
  assert.match(main, /data-save-custom-supplement/);
  assert.match(main, /delete-custom-supplement/);
  assert.match(main, /entry\.customLabel=label/);
  assert.match(main, /Research this supplement/);
  assert.match(main, /old consumption history remains/);
  assert.match(main, /manufacturer ingredients uses evidence side effects interactions risks NIH NCCIH FDA PubMed/);
});

test("feedback uses an external optional Google Forms hook with privacy guidance", async () => {
  const [main, config] = await Promise.all([text("src/main.ts"), text("public/config.js")]);
  assert.match(config, /feedbackFormUrl:\s*""/);
  assert.match(main, /Help improve LogTogether/);
  assert.match(main, /Report bug \/ share idea/);
  assert.match(main, /Copy anonymous app info/);
  assert.match(main, /Avoid pasting private workout contents, account IDs, GPS routes or other sensitive data/);
  assert.match(main, /tutorial-feedback-page/);
});

test("Quick Guide includes the feedback page and keeps seven snapped pages", async () => {
  const main = await text("src/main.ts");
  assert.match(main, /clamp\(this\.missionTutorialPage, 0, 6\)/);
  assert.match(main, /this\.missionTutorialPage >= 6/);
  assert.match(main, /safe===6/);
});
