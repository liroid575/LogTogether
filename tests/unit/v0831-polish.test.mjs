import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const main = fs.readFileSync(new URL("../../src/main.ts", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../../public/styles.css", import.meta.url), "utf8");
const sw = fs.readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

test("owner Family view drops the owner notice and groups members by Cloud group", () => {
  assert.equal(main.includes("Cloud owner view"), false);
  assert.match(main, /family-group-block/);
  assert.match(main, /membership!\.groups\.map\(group/);
});

test("group management is collapsible and saves direct name edits without a Rename button", () => {
  assert.match(main, /cloud-groups-fold/);
  assert.match(main, /data-group-name-input/);
  assert.match(main, /requestSubmit\(\)/);
});

test("only one live set can start at once and running circuit round deletion is confirmed", () => {
  assert.match(main, /anotherSetActive/);
  assert.match(main, /pendingCircuitRoundRemovalIndex/);
  assert.match(main, /Finish the active set first/);
});

test("mobile workout dock keeps Save routine and undo toast is moved to the top", () => {
  assert.match(css, /dock-save-routine \{ display: inline-flex; \}/);
  assert.match(css, /\.toast \{[\s\S]*top: calc\(70px/);
});

test("discarding inside Workout Now returns to a fresh workout builder and cache is bumped", () => {
  assert.match(main, /stayInWorkoutBuilder \? createBlankWorkout\(this\.state\) : null/);
  assert.match(sw, /logtogether-shell-v0\.9\.0/);
});
