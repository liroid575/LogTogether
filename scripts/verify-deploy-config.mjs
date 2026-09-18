import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const source = "config.local.js";
const built = "dist/config.js";
if (!existsSync(source)) throw new Error("config.local.js is missing; stop before deployment.");
if (!existsSync(built)) throw new Error("dist/config.js is missing; run the build first.");

const extract = file => {
  const text = readFileSync(file,"utf8");
  const match = text.match(/feedbackFormUrl\s*:\s*(["'])(.*?)\1/);
  if (!match?.[2]) throw new Error(`${file} has no feedbackFormUrl.`);
  return match[2];
};

const sourceUrl = extract(source);
const builtUrl = extract(built);
const parsed = new URL(sourceUrl);
if (parsed.protocol !== "https:" || parsed.hostname !== "docs.google.com" || !/^\/forms\/d\/e\/[^/]+\/viewform\/?$/.test(parsed.pathname)) {
  throw new Error("feedbackFormUrl is not an approved Google Forms responder URL.");
}
const canonicalFormUrl = `${parsed.origin}${parsed.pathname.replace(/\/$/,"")}`;
const expectedFormHash = "cce128118fb897605224d241c7630f79ad399ffc0e17d9e34903769695f904c1";
if (createHash("sha256").update(canonicalFormUrl).digest("hex") !== expectedFormHash) {
  throw new Error("feedbackFormUrl does not point to the approved LogTogether feedback form.");
}
if (sourceUrl !== builtUrl) throw new Error("dist/config.js does not match config.local.js; rebuild before deployment.");

execFileSync("git",["check-ignore","-q",source],{stdio:"ignore"});
console.log("Deployment config verified: private local config is ignored and the feedback form is present in dist.");
