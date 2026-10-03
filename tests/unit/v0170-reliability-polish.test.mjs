import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const text = path => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("dev v2 keeps lifecycle-sensitive timers and hydration timestamp based", async () => {
  const main=await text("src/main.ts");
  assert.match(main,/deadlineMs:Date\.now\(\)\+seconds\*1000/);
  assert.match(main,/reconcileStartCountdown\(\)/);
  assert.match(main,/new Date\(current\.deadlineMs\)\.toISOString\(\)/);
  assert.match(main,/ensureCurrentDay\(true\)/);
  assert.match(main,/window\.setInterval\([\s\S]*60_000/);
  assert.match(main,/data-action="refresh-water"/);
  assert.doesNotMatch(main,/pagehide[\s\S]{0,120}cancelStartCountdown/);
});

test("screen behavior has bounded choices and keeps zoom restrictions workout scoped", async () => {
  const [main,types,css,manifest]=await Promise.all([text("src/main.ts"),text("src/core/types.ts"),text("public/styles.css"),text("public/manifest.webmanifest")]);
  assert.match(types,/wakeLockMode: "off" \| "workout" \| "open"/);
  assert.match(types,/orientationPreference: "portrait" \| "device"/);
  assert.match(types,/stableWorkoutView: boolean/);
  assert.match(main,/wakeLockRetryAfter=Date\.now\(\)\+15_000/);
  assert.match(main,/orientation\.lock\?\.\("portrait"\)/);
  assert.doesNotMatch(css,/\.stable-workout-view \.main \{ touch-action:pan-y; \}/);
  assert.match(css,/stable-workout-view input.*font-size:max\(16px,1em\)/);
  assert.doesNotMatch(manifest,/"orientation"/);
  assert.doesNotMatch(manifest,/user-scalable/);
});

test("photos remain in the local private media pipeline for manual and edited workouts", async () => {
  const [main,media]=await Promise.all([text("src/main.ts"),text("src/core/media.ts")]);
  assert.match(main,/id="manual-activity-photo"/);
  assert.match(main,/savePrivateImage\(photo,id,1280\)/);
  assert.match(main,/data-action="remove-workout-photo"/);
  assert.match(main,/deletePrivateImage\(id\)/);
  assert.match(media,/createImageBitmap\(file\)/);
  assert.match(media,/canvas\.toBlob/);
  assert.match(media,/indexedDB\.open/);
});

test("home, dock, supplement and family summaries expose the dev v2 polish", async () => {
  const main=await text("src/main.ts");
  assert.match(main,/Recently used/);
  assert.match(main,/Last logged/);
  assert.match(main,/data-action="continue-workout"/);
  assert.match(main,/Return to workout/);
  assert.match(main,/data-action="dock-save-routine"/);
  assert.match(main,/data-dock-start-set/);
  assert.match(main,/data-dock-toggle-set/);
  assert.match(main,/data-action="dock-finish-workout"/);
  assert.match(main,/closest<HTMLElement>\("\.set-row, \.circuit-movement"\)/);

  assert.match(main,/profileSupportsOptionalWorkTarget/);
  assert.match(main,/keys\.add\("targetWorkSec"\)/);
  assert.match(main,/data-dev-effect="momentum-popup"/);
  assert.match(main,/rebuildTimerAudio/);
  assert.match(main,/focusDefinition\?\.names\[this\.locale\]/);
  assert.match(main,/Offline · showing last synced family data/);
  assert.match(main,/this\.goalModeLabel\(weekly\.difficulty\)/);
  assert.match(main,/family members logged.*Gold Days/);
  assert.match(main,/Great week! Momentum/);
});
