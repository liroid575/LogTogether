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

test("supplement day documents stay owner-only while enabled family sharing publishes bounded weekly details", () => {
  assert.match(rules, /match \/supplements\/\{supplementDayId\}[\s\S]*allow get, list: if signedIn\(\) && resource\.data\.ownerId == request\.auth\.uid/);
  assert.match(rules, /supplementEntries\.size\(\) <= 100/);
  assert.match(client, /export interface CloudWeeklySupplementEntry/);
  assert.match(main, /pushSupplementDayToCloud/);
  assert.match(main, /currentWeekFamilySummary/);
  assert.match(main, /supplementEntries/);
});

test("hike deletion has cloud tombstones and route metadata stays local", () => {
  assert.match(types, /deletedHikeIds\?: string\[\]/);
  assert.match(main, /deleteCloudHike/);
  assert.match(client, /delete clone\.routePoints/);
  assert.match(client, /delete clone\.photoId/);
});
