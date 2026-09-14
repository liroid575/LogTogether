import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const main = read("src/main.ts");
const client = read("src/services/firebase-client.ts");
const rules = read("firestore.rules");
const types = read("src/core/types.ts");

test("v0.7 adds cloud surfaces for hikes supplements and weekly family summaries", () => {
  for (const name of ["loadCloudHikes","saveCloudHike","deleteCloudHike","saveCloudSupplementDay","saveFamilyWeeklySummary"]) {
    assert.match(client, new RegExp(`export async function ${name}`));
  }
  assert.match(rules, /match \/hikes\/\{hikeId\}/);
  assert.match(rules, /match \/supplements\/\{supplementDayId\}/);
  assert.match(rules, /match \/familyWeekly\/\{weeklyId\}/);
});

test("biological sex syncs privately in body metrics and publicly in active family member presentation", () => {
  assert.match(client, /CloudBodyMetrics[\s\S]*biologicalSex/);
  assert.match(client, /CloudFamilyMember[\s\S]*biologicalSex/);
  assert.match(rules, /memberCanUpdatePresentation[\s\S]*biologicalSex/);
  assert.match(main, /updateMyFamilyDisplayName[\s\S]*biologicalSex/);
});

test("supplement exact entries are own-device cloud data while family receives weekly totals", () => {
  assert.match(rules, /Exact supplement timestamps[\s\S]*owner's devices/);
  assert.match(main, /pushSupplementDayToCloud/);
  assert.match(main, /currentWeekFamilySummary/);
  assert.match(main, /supplementMap/);
});

test("hike deletion has cloud tombstones and route metadata stays local", () => {
  assert.match(types, /deletedHikeIds\?: string\[\]/);
  assert.match(main, /deleteCloudHike/);
  assert.match(client, /delete clone\.routePoints/);
  assert.match(client, /delete clone\.photoId/);
});
