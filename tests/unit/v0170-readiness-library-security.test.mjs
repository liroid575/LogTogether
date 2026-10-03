import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import {
  EXERCISES,
  exerciseById,
  exerciseScienceLoggingProfile,
  exerciseStarterDefault
} from "../../dist/assets/core/exercises.js";

const text = async path => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const require = createRequire(import.meta.url);
const { assessPokeSpend } = require("../../functions/poke-policy.js");

test("v0.17 adds bounded dance, mind-body, mobility and conditioning entries without duplicate IDs", () => {
  assert.equal(EXERCISES.length, 169);
  assert.equal(new Set(EXERCISES.map(item=>item.id)).size, EXERCISES.length);
  const originalIdDigest=createHash("sha256").update(EXERCISES.slice(0,156).map(item=>item.id).join("\n")).digest("hex");
  assert.equal(originalIdDigest,"0456530a1d69a70764b5f043adf15c58144194be0d6ff5d0cc08c555e6ccccfc");
  for (const id of [
    "kpop_pop_dance","dance_cardio","barre_ballet_fitness","mat_pilates","vr_combat_fitness",
    "standing_cross_body_knee_drive","front_back_leg_swing","lateral_leg_swing","hip_90_90_switch",
    "adductor_rock_back","cossack_squat_mobility","frog_adductor_stretch","deep_squat_hold"
  ]) assert.ok(exerciseById(id), `missing ${id}`);
  assert.equal(exerciseScienceLoggingProfile(exerciseById("mat_pilates")),"mind_body_session");
  assert.equal(exerciseStarterDefault(exerciseById("mat_pilates")).minutes,20);
  assert.deepEqual(exerciseById("vr_combat_fitness").metabolicEquivalentRange,[5,9]);
  assert.deepEqual(exerciseStarterDefault(exerciseById("standing_cross_body_knee_drive")),{
    sets:2,reps:20,durationSec:45,restSec:45,recoverySec:45
  });
});

test("pre-start countdown is deadline-based, cancelable and recovers after background throttling", async () => {
  const [main,types,css]=await Promise.all([text("src/main.ts"),text("src/core/types.ts"),text("public/styles.css")]);
  assert.match(types,/startCountdownSec: 0 \| 3 \| 5 \| 10/);
  assert.match(main,/startCountdownSec:5/);
  assert.match(main,/private beginStartCountdown/);
  assert.match(main,/private commitStartedSet/);
  assert.match(main,/deadlineMs:Date\.now\(\)\+seconds\*1000/);
  assert.match(main,/private reconcileStartCountdown/);
  assert.match(main,/Date\.now\(\)<current\.deadlineMs/);
  assert.match(main,/new Date\(current\.deadlineMs\)\.toISOString\(\)/);
  assert.doesNotMatch(main,/visibilityState!=="visible"[\s\S]{0,100}cancelStartCountdown/);
  assert.match(main,/data-action="cancel-start-countdown"/);
  assert.match(css,/prefers-reduced-motion: reduce/);
});

test("owners no longer bypass Poke wallet or cooldown rules", async () => {
  const [main,fn]=await Promise.all([text("src/main.ts"),text("functions/index.js")]);
  assert.doesNotMatch(fn,/unlimited/);
  const common={nowMs:100_000,cooldownMs:60_000,role:"owner"};
  assert.deepEqual(assessPokeSpend({...common,balance:0}),{allowed:false,reason:"balance",current:0,next:0});
  assert.deepEqual(assessPokeSpend({...common,balance:2}),{allowed:true,reason:null,current:2,next:1});
  assert.deepEqual(assessPokeSpend({...common,balance:2,lastSentAtMs:50_000}),{allowed:false,reason:"cooldown",current:2,next:2});
  assert.match(fn,/assessPokeSpend/);
  assert.doesNotMatch(main,/Poke ∞|unlimited Pokes/);
});

test("quick logging uses now while calendar editors retain correction support", async () => {
  const main=await text("src/main.ts");
  assert.doesNotMatch(main,/shared-log-at|private logDate|private logAt/);
  assert.match(main,/private logWater\(ml:number\)[\s\S]*const now=new Date\(\)/);
  assert.match(main,/New entries use the current time/);
  assert.match(main,/water-entry-edit/);
  assert.match(main,/supplement-entry-edit/);
});

test("history and Family Recent Activity keep newest dates first and oldest times first within a date", async () => {
  const main=await text("src/main.ts");
  assert.match(main,/localDateKey\(b\.date\)\.localeCompare\(localDateKey\(a\.date\)\)[\s\S]*a\.date\.localeCompare\(b\.date\)/);
  assert.match(main,/localDateKey\(b\.at\)\.localeCompare\(localDateKey\(a\.at\)\)[\s\S]*a\.at\.localeCompare\(b\.at\)/);
});

test("the guide asks for notification permission only from an explicit user button", async () => {
  const main=await text("src/main.ts");
  assert.match(main,/Already enabled ✓/);
  assert.match(main,/Finish enabling/);
  assert.match(main,/data-action="enable-push"/);
  assert.match(main,/never requests permission automatically/);
});
