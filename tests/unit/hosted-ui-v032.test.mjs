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

test("hosted Firebase Auth CSP permits Google's gapi loader without unsafe-inline", () => {
  assert.match(firebase, /script-src[^;]*https:\/\/apis\.google\.com/);
  assert.match(firebase, /connect-src[^;]*https:\/\/apis\.google\.com/);
  assert.doesNotMatch(firebase, /'unsafe-inline'/);
  assert.match(config, /authDomain:\s*["\']YOUR_PROJECT_ID\.firebaseapp\.com["\']/);
});

test("strict style CSP no longer breaks dynamic accent and chart geometry", () => {
  assert.doesNotMatch(main, /style="/);
  assert.match(main, /data-style-background/);
  assert.match(main, /node\.style\.background = value/);
  assert.match(main, /data-style-height/);
  assert.match(main, /data-style-top/);
});

test("circuit builder exposes every exercise type instead of reps only", () => {
  const builder = between(main, "private renderCircuitBuilder(): string", "private renderRecent");
  assert.doesNotMatch(builder, /EXERCISES\.filter\(exercise => exercise\.type === "reps"\)/);
  assert.match(builder, /EXERCISES\.filter\(exercise => exerciseLibraryGroup\(exercise\) === group\)/);
  const targetFields = between(main, "private circuitTargetFields", "private renderCircuitBuilder");
  assert.match(targetFields, /weight_reps/);
  assert.match(targetFields, /duration/);
  assert.match(targetFields, /distance_time/);
  assert.match(targetFields, /minutes_/);
});

test("water goal line lives inside a dedicated plot instead of overlapping labels", () => {
  const water = between(main, "private renderWater(): string", "private renderWaterCalendar");
  assert.match(water, /class="water-chart-goal"/);
  assert.match(water, /class="water-plot"/);
  assert.match(water, /class="water-track-grid"/);
  assert.match(water, /class="water-meta-grid"/);
  assert.match(css, /\.water-plot \{[^}]*height:132px/);
});

test("other family members open a shared profile with aggregate calories water and badges", () => {
  assert.match(main, /data-family-member-profile/);
  assert.match(main, /private renderFamilyMemberProfile\(\): string/);
  assert.match(main, /private renderFamilyComparison/);
  assert.match(main, /Family sees daily calorie totals/);
  assert.match(main, /Family sees only each day's water total/);
  assert.match(main, /cloudFamilyBadges/);
});
