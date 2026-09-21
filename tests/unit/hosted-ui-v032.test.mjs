import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const css = fs.readFileSync("public/styles.css", "utf8");
const config = fs.readFileSync("public/config.js", "utf8");
const firebase = fs.readFileSync("firebase.json", "utf8");

function between(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.ok(start >= 0, `missing ${startNeedle}`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(end > start, `missing ${endNeedle}`);
  return source.slice(start, end);
}

test("hosted CSP permits Google Auth loaders without unsafe-inline", () => {
  assert.match(firebase, /script-src[^;]*https:\/\/apis\.google\.com/);
  assert.match(firebase, /connect-src[^;]*https:\/\/apis\.google\.com/);
  assert.doesNotMatch(firebase, /'unsafe-inline'/);
});

test("strict style CSP no longer breaks dynamic accent and chart geometry", () => {
  assert.doesNotMatch(main, /style="/);
  assert.match(main, /data-style-background/);
  assert.match(main, /node\.style\.background = value/);
  assert.match(main, /data-style-height/);
  assert.match(main, /data-style-top/);
});

test("circuit builder uses profile-aware exercise logging", () => {
  const builder = between(main, "private renderCircuitBuilder(): string", "private renderRecent");
  assert.doesNotMatch(builder, /EXERCISES\.filter\(exercise => exercise\.type === "reps"\)/);
  assert.match(builder, /this\.renderExerciseOptions\(this\.circuitLibraryFilter,selected\)/);

  const targetFields = between(main, "private circuitTargetFields", "private renderCircuitBuilder");
  assert.match(targetFields, /exerciseScienceLoggingProfile\(definition\)/);
  assert.match(targetFields, /exerciseSessionMetricFlags\(definition\)/);
  assert.match(targetFields, /definition\.type === "weight_reps"/);
  assert.match(targetFields, /profile === "loaded_carry"/);
  assert.match(targetFields, /profile === "sprint_intervals"/);
  assert.match(targetFields, /metrics\.distance/);
  assert.match(targetFields, /mini\("minutes"/);
});

test("water goal line lives inside a dedicated plot instead of overlapping labels", () => {
  const water = between(main, "private renderWater(): string", "private renderWaterCalendar");
  assert.match(water, /class="water-chart-goal"/);
  assert.match(water, /class="water-plot"/);
  assert.match(water, /class="water-track-grid"/);
  assert.match(water, /class="water-meta-grid"/);
  assert.match(css, /\.water-plot \{[^}]*height:132px/);
});

test("other family members open privacy-aware shared profiles with comparisons and badges", () => {
  assert.match(main, /data-family-member-profile/);
  assert.match(main, /private renderFamilyMemberProfile\(\): string/);
  assert.match(main, /private renderFamilyComparison/);
  assert.match(main, /private renderFamilyTrendComparison/);
  assert.match(main, /familyWeeklySeries\(selfUid, metric\)/);
  assert.match(main, /familyWeeklySeries\(memberUid, metric\)/);
  assert.match(main, /shared daily water totals/);
  assert.match(main, /individual drink timestamps remain private/);
  assert.match(main, /cloudFamilyBadges/);
});
