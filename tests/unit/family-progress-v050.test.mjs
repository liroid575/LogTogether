import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const client = read("src/services/firebase-client.ts");
const main = read("src/main.ts");
const rules = read("firestore.rules");
const css = read("public/styles.css");
const sw = read("public/sw.js");

test("personal cloud sync keeps height weight hydration and exact supplements owner-only", () => {
  assert.match(client, /saveCloudPreferences/);
  assert.match(client, /saveCloudBodyMetrics/);
  assert.match(client, /saveCloudSupplementDay/);
  assert.match(client, /collection\(db, "hydration"\)/);
  assert.match(client, /collection\(db, "supplements"\)/);
  assert.match(rules, /match \/bodyMetrics\/\{uid\}[\s\S]*request\.auth\.uid == uid/);
  assert.match(rules, /match \/hydration\/\{hydrationId\}[\s\S]*resource\.data\.ownerId == request\.auth\.uid/);
  assert.match(rules, /match \/supplements\/\{supplementDayId\}[\s\S]*resource\.data\.ownerId == request\.auth\.uid/);
});

test("family sharing has bounded daily and weekly aggregates", () => {
  assert.match(client, /loadSharedDocsByOwner\("familyProgress"/);
  assert.match(client, /loadSharedDocsByOwner\("familyWeekly"/);
  assert.match(client, /doc\(db, "familyProgress", id\)/);
  assert.match(client, /doc\(db, "familyWeekly", id\)/);
  assert.match(client, /weeklyCalories:[\s\S]*hikeKm:[\s\S]*missionScore:[\s\S]*supplements:/);
  assert.match(rules, /match \/familyWeekly\/\{weeklyId\}/);
  assert.doesNotMatch(rules.match(/function validFamilyProgressCreate[\s\S]*?\n    }/)?.[0] ?? "", /weight|entries|exercises/);
});

test("family comparison offers calories and water with switchable focus", () => {
  assert.match(main, /data-family-comparison-metric="calories"/);
  assert.match(main, /data-family-comparison-metric="water"/);
  assert.match(main, /comparison-summary-self/);
  assert.match(main, /comparison-summary-member/);
  assert.match(css, /comparison-line\.self[^}]*var\(--muted\)/s);
  assert.match(css, /calorie-mode[\s\S]*comparison-line\.member[\s\S]*var\(--accent\)/);
  assert.match(css, /water-mode[\s\S]*comparison-line\.member[\s\S]*#4aa3ff/);
});

test("gender badges weekly achievements supplements and hike summaries appear on family profiles", () => {
  assert.match(client, /biologicalSex/);
  assert.match(client, /saveFamilyWeeklySummary/);
  assert.match(client, /saveCloudBadges/);
  assert.match(main, /biologicalSexLabel/);
  assert.match(main, /Weekly achievements/);
  assert.match(main, /This week's supplements/);
  assert.match(main, /Recent workouts/);
  assert.match(main, /Recent hikes/);
  assert.match(main, /cloudFamilyBadges\.filter\(badge=>badge\.ownerId===member\.uid\)/);
});

test("cloud settings cover palette water profile supplements hikes and goals across devices", () => {
  assert.match(main, /pushPreferencesToCloud/);
  assert.match(main, /pushHydrationToCloud/);
  assert.match(main, /pushProfileToCloud/);
  assert.match(main, /pushSupplementDayToCloud/);
  assert.match(main, /pushHikeToCloud/);
  assert.match(client, /accentColor/);
  assert.match(client, /heightCm/);
  assert.match(client, /weightEntries/);
});

test("custom profile names and biological sex survive Google re-login", () => {
  assert.match(main, /selfMember = membership\?\.members\.find/);
  assert.match(main, /selfMember\?\.displayName \|\| user\.displayName/);
  assert.match(main, /selfMember\?\.biologicalSex/);
});

test("precise hike routes and photos remain local while hike metadata syncs", () => {
  assert.match(main, /savePrivateImage\(hikePhoto,id,1280\)/);
  assert.match(client, /delete clone\.routePoints/);
  assert.match(client, /delete clone\.photoId/);
  assert.match(client, /saveCloudHike/);
});

test("first cloud migration merges profile hydration and supplements", () => {
  assert.match(main, /profileCloudMigrated !== true/);
  assert.match(main, /mergeProfileForFirstCloudSync/);
  assert.match(main, /hydrationCloudMigrated !== true/);
  assert.match(main, /mergeHydrationForFirstCloudSync/);
  assert.match(main, /supplementCloudMigrated !== true/);
  assert.match(main, /mergeSupplementForFirstCloudSync/);
});

test("existing LogTogether name remains preferred when seeding Google identity", () => {
  assert.match(client, /self\.displayName\?\.trim\(\) \|\| user\.displayName/);
  assert.match(client, /displayName,[\s\S]*identitySeeded: true/);
});
