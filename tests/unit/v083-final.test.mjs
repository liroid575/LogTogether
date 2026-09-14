import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const main = fs.readFileSync("src/main.ts", "utf8");
const css = fs.readFileSync("public/styles.css", "utf8");
const sw = fs.readFileSync("public/sw.js", "utf8");

test("regular live sets use a left compact trash control and lock deletion after completion", () => {
  assert.match(main, /class="icon-btn subtle-danger set-remove-icon"/);
  assert.match(main, /if \(!editingExisting && removed\.completed\) return/);
  assert.match(css, /\.set-remove-left/);
});

test("removing a set from an already-running workout requires the same removal control twice", () => {
  assert.match(main, /pendingSetRemovalKey/);
  assert.match(main, /running && this\.pendingSetRemovalKey !== removalKey/);
  assert.match(main, /set-remove-confirm/);
});

test("history uses per-set duration instead of redundant finish time", () => {
  assert.match(main, /completedSetDurationText/);
  assert.match(main, /this\.text\("duration"\)/);
  assert.doesNotMatch(main.slice(main.indexOf("private renderSavedExercise"), main.indexOf("private renderSavedCircuitRounds")), /this\.text\("finishedAt"\)/);
});

test("circuit history is organized by rounds", () => {
  assert.match(main, /renderSavedCircuitRounds/);
  assert.match(main, /Round \$\{roundIndex \+ 1\}/);
  assert.match(main, /circuit-history-round/);
});

test("week navigation resets when returning to Home or Water", () => {
  assert.match(main, /page === "home"[\s\S]*workoutTrendWeekOffset = 0/);
  assert.match(main, /page === "water"[\s\S]*waterWeekOffset = 0/);
});

test("deployment service worker cache is v0.8.3", () => {
  assert.match(sw, /logtogether-shell-v0\.9\.0/);
});
