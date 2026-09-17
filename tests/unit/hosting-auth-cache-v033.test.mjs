import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("service worker never intercepts Firebase reserved URLs", () => {
  const sw = read("public/sw.js");
  assert.match(sw, /pathname\.startsWith\(["']\/_\_["']\)/);
});

test("dev hosting bypasses stale HTTP caches", () => {
  const sw = read("public/sw.js");
  const hosting = JSON.parse(read("firebase.json"));
  assert.match(sw, /cache:\s*["']no-store["']/);
  const headers = hosting.hosting.headers.find(entry => entry.source === "**")?.headers ?? [];
  const cacheControl = headers.find(header => header.key.toLowerCase() === "cache-control")?.value ?? "";
  assert.match(cacheControl, /no-store/);
});

test("hosting CSP permits same-origin Firebase helper frames", () => {
  const hosting = JSON.parse(read("firebase.json"));
  const headers = hosting.hosting.headers.find(entry => entry.source === "**")?.headers ?? [];
  const csp = headers.find(header => header.key === "Content-Security-Policy")?.value ?? "";
  assert.match(csp, /frame-src 'self'/);
});
