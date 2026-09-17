import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const main = fs.readFileSync(new URL("../../src/main.ts", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../../public/styles.css", import.meta.url), "utf8");
const sw = fs.readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

test("temporary calendar preview controls are removed", () => {
  assert.doesNotMatch(main, /Temporary test tools/);
  assert.doesNotMatch(main, /data-debug-preview/);
  assert.doesNotMatch(main, /debugPreviewMonthlyBadge|debugPreviewPerfectWaterMonth/);
});

test("family profile supplemental and recent activity sections start collapsed", () => {
  assert.match(main, /family-profile-details/);
  assert.match(main, /This week's supplements/);
  assert.match(main, /Recent workouts/);
  assert.match(main, /Recent hikes/);
  assert.doesNotMatch(main, /<details class="card family-profile-details" open/);
  assert.match(css, /\.family-profile-details > summary/);
});

test("hiking badge editing is hidden behind one edit toggle and uses drag reordering", () => {
  assert.match(main, /toggle-hike-badge-edit/);
  assert.match(main, /hikeBadgeEditMode/);
  assert.match(main, /data-hike-badge-drag-handle/);
  assert.match(main, /pointerdown/);
  assert.match(main, /badgeList\.insertBefore/);
  assert.doesNotMatch(main, /data-move-hike-badge/);
  assert.match(css, /touch-action:\s*none/);
});
