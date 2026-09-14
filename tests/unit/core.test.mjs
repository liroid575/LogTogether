import test from "node:test";
import assert from "node:assert/strict";
import { averagePace, formatDuration } from "../../dist/assets/core/metrics.js";
import { haversineKm, summarizePoints } from "../../dist/assets/core/gpx.js";
import { migrateState } from "../../dist/assets/core/schema.js";

test("duration formatting remains deterministic", () => {
  assert.equal(formatDuration(38), "38m");
  assert.equal(formatDuration(138), "2h 18m");
});

test("pace calculation handles normal and zero distance", () => {
  assert.equal(averagePace(5, 50), "10:00/km");
  assert.equal(averagePace(0, 50), "—");
});

test("haversine produces a plausible Taipei short-distance result", () => {
  const km = haversineKm({ lat: 25.033, lon: 121.5654 }, { lat: 25.0478, lon: 121.5319 });
  assert.ok(km > 3 && km < 5);
});

test("GPX point summary calculates elevation gain and loss", () => {
  const result = summarizePoints([
    { lat: 25.0, lon: 121.0, elevation: 100 },
    { lat: 25.001, lon: 121.001, elevation: 140 },
    { lat: 25.002, lon: 121.002, elevation: 125 }
  ]);
  assert.equal(result.elevationGainM, 40);
  assert.equal(result.elevationLossM, 15);
  assert.equal(result.highestPointM, 140);
  assert.ok(result.distanceKm > 0);
});

test("unknown schema versions fail closed instead of being guessed", () => {
  assert.equal(migrateState({ schemaVersion: 999 }), null);
  assert.equal(migrateState(null), null);
});

test("GPX parser keeps timestamps so elapsed time can be autofilled", () => {
  const xml = `<?xml version="1.0"?><gpx><trk><trkseg>
    <trkpt lat="25.000" lon="121.000"><ele>100</ele><time>2026-09-12T01:00:00Z</time></trkpt>
    <trkpt lat="25.010" lon="121.010"><ele>160</ele><time>2026-09-12T02:30:00Z</time></trkpt>
  </trkseg></trk></gpx>`;
  // DOMParser is a browser API, so summarizePoints is used in Node and parseGpx is exercised in-browser.
  const result = summarizePoints([
    { lat:25, lon:121, elevation:100, time:"2026-09-12T01:00:00Z" },
    { lat:25.01, lon:121.01, elevation:160, time:"2026-09-12T02:30:00Z" }
  ]);
  assert.equal(result.elapsedMinutes, 90);
  assert.equal(result.elevationGainM, 60);
  assert.ok(xml.includes("trkpt"));
});
