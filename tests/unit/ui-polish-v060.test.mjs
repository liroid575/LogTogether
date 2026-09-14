import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const main = read("src/main.ts");
const store = read("src/core/store.ts");
const types = read("src/core/types.ts");
const analytics = read("src/core/analytics.ts");
const css = read("public/styles.css");
const sw = read("public/sw.js");

test("text scaling lives in Settings with percentage choices", () => {
  assert.match(main, /id="text-scale-select"/);
  assert.match(main, /\[100,110,120,130,140\]/);
  assert.match(types, /textScale\?: number/);
  assert.match(css, /text-scale-setting/);
});

test("family comparison lines cannot become filled triangles and focus can switch", () => {
  assert.match(css, /\.comparison-line \{ fill:none !important/);
  assert.match(main, /data-family-comparison-focus="self"/);
  assert.match(main, /data-family-comparison-focus="member"/);
  assert.match(main, /familyComparisonFocus/);
});

test("family comparison includes paired weekly exercise mix donuts", () => {
  assert.match(main, /familyWeeklyCategoryCounts/);
  assert.match(main, /comparison-mix-grid/);
  assert.match(main, /categoryDonut\(myMix/);
  assert.match(main, /categoryDonut\(theirMix/);
});

test("new workouts default to family sharing with no per-workout selector", () => {
  assert.match(store, /createBlankWorkout[\s\S]*visibility: "family"/);
  assert.match(store, /freshWorkoutFromPrevious[\s\S]*visibility: "family"/);
  assert.doesNotMatch(main, /id="workout-visibility"/);
});

test("set timing has an explicit Start set control and history editing hides it", () => {
  assert.match(types, /startedAt\?: string;[\s\S]*completedAt\?: string/);
  assert.match(main, /data-start-set="1"/);
  assert.match(main, /editingExisting \? "" : !set\.startedAt/);
  assert.match(main, /set\.startedAt \?\?= now/);
});

test("calorie estimator uses difficulty plus completed set volume", () => {
  assert.match(analytics, /metForDifficulty/);
  assert.match(analytics, /completedSets/);
  assert.match(analytics, /set\.reps/);
  assert.match(analytics, /set\.durationSec/);
});

test("home prioritizes daily goal and responsive trend charts", () => {
  assert.match(main, /Daily goal/);
  assert.match(main, /renderWeeklyTrend/);
  assert.match(main, /12-month total/);
  assert.match(css, /\.trend-card \{ overflow:hidden/);
});

test("water calendar owns editable selected-day entries and hike water input is gone", () => {
  assert.match(main, /data-save-water-entry/);
  assert.match(main, /hydrationDayForDate/);
  assert.doesNotMatch(main, /name="water" type="number"/);
});

test("profile adds biological sex and automatic adult BMI display", () => {
  assert.match(types, /biologicalSex\?:/);
  assert.match(main, /name="biologicalSex"/);
  assert.match(main, /BMI/);
  assert.match(main, /18\.5/);
  assert.match(main, /27/);
});

test("v0.6 service worker cache is versioned", () => {
  assert.match(sw, /logtogether-shell-v0\.9\.0/);
});
