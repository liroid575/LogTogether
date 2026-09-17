import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { monthlyGoalProgress, scienceMissionTargets, weeklyGoalScore } from "../../dist/assets/core/analytics.js";

const read = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const main = read("src/main.ts");
const client = read("src/services/firebase-client.ts");
const css = read("public/styles.css");
const sw = read("public/sw.js");

test("weekly science model has ten missions and difficulty scales the Gold Day requirement", () => {
  assert.deepEqual(
    ["easy","normal","hard","extreme"].map(mode => scienceMissionTargets(mode).goldDays),
    [3,4,5,6]
  );

  const goals = { weeklyCalories: 1050, categorySets: {}, difficulty: "normal" };
  const result = weeklyGoalScore([], [], 70, goals, undefined, [], new Date("2026-09-13T12:00:00"));

  assert.equal(result.calorieTargetDays, 4);
  assert.equal(Object.keys(result.missions).length, 10);
  assert.ok(result.score >= 0 && result.score <= 10);
});

test("monthly badge target is 80 percent of eligible weekly missions", () => {
  const goals = { weeklyCalories: 1050, categorySets: {}, difficulty: "normal" };

  const fourWeekMonth = monthlyGoalProgress(
    [], [], 70, goals, undefined, [],
    new Date("2026-09-30T12:00:00")
  );
  assert.equal(fourWeekMonth.available, 40);
  assert.equal(fourWeekMonth.required, 32);

  const fiveWeekMonth = monthlyGoalProgress(
    [], [], 70, goals, undefined, [],
    new Date("2026-03-31T12:00:00")
  );
  assert.equal(fiveWeekMonth.available, 50);
  assert.equal(fiveWeekMonth.required, 40);

  assert.match(main, /missionMax:\s*10/);
  assert.match(main, /about 80% of the weekly missions available in that month/);
});

test("hiking badge presentation can be renamed reordered and hidden without deleting the hike", () => {
  assert.match(main, /data-edit-hike-badge/);
  assert.match(main, /data-hike-badge-drag-handle/);
  assert.match(main, /data-remove-hike-badge/);
  assert.match(main, /hikeBadgePreferences/);
  assert.match(client, /sortOrder/);
  assert.match(client, /sourceHikeId/);
  assert.match(client, /deleteCloudBadge/);
});

test("water nav uses the normal-sized drop icon", () => {
  assert.match(main, /item\("water", "drop"/);
  assert.match(css, /\.nav-btn\[data-nav="water"\] svg[\s\S]*width:\s*20px !important;[\s\S]*height:\s*20px !important;/);
});

test("settings expose the bounded Firebase capacity estimate", () => {
  assert.match(main, /estimatedCloudPayloadBytes/);
  assert.match(main, /Firebase capacity/);
  assert.match(main, /Rough remaining headroom/);
});

test("legacy family weekly summaries are converted to the ten-mission model", () => {
  assert.match(client, /legacyMissionModel/);
  assert.match(client, /rawMissionMax === 20 \|\| rawMissionMax === 22/);
  assert.match(client, /missionMax:\s*10/);
});
