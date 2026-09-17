import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const main = fs.readFileSync(new URL("../../src/main.ts", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../../public/styles.css", import.meta.url), "utf8");

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

test("mobile workout dock keeps Save routine and undo toast is moved to the top", () => {
  assert.match(css, /dock-save-routine \{ display: inline-flex; \}/);
  assert.match(css, /\.toast \{[\s\S]*top: calc\(70px/);
});

test("discarding Workout Now clears the draft, returns Home and preserves Undo", () => {
  assert.match(main, /const discarded = this\.state\.activeWorkout \? structuredClone\(this\.state\.activeWorkout\) : null/);
  assert.match(main, /this\.state\.activeWorkout = null/);
  assert.match(main, /this\.persist\(\); this\.navigate\("home"\)/);
  assert.match(main, /this\.state\.activeWorkout = discarded/);
});
