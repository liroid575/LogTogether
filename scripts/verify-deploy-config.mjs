import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const source = "config.local.js";
const built = "dist/config.js";
if (!existsSync(source)) throw new Error("config.local.js is missing; stop before deployment.");
if (!existsSync(built)) throw new Error("dist/config.js is missing; run the build first.");

const extract = file => {
  const text = readFileSync(file,"utf8");
  const feedbackMatch = text.match(/feedbackFormUrl\s*:\s*(["'])(.*?)\1/);
  const pushMatch = text.match(/pushPublicKey\s*:\s*(["'])(.*?)\1/);
  if (!feedbackMatch?.[2]) throw new Error(`${file} has no feedbackFormUrl.`);
  if (!pushMatch) throw new Error(`${file} has no pushPublicKey.`);
  return { feedbackFormUrl: feedbackMatch[2], pushPublicKey: pushMatch[2].trim() };
};

const sourceConfig = extract(source);
const builtConfig = extract(built);
const sourceUrl = sourceConfig.feedbackFormUrl;
const builtUrl = builtConfig.feedbackFormUrl;
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
const validVapidPublicKey = value => /^[A-Za-z0-9_-]{80,100}$/.test(value);
if (!validVapidPublicKey(sourceConfig.pushPublicKey)) throw new Error("config.local.js has no valid Web Push public key.");
if (sourceConfig.pushPublicKey !== builtConfig.pushPublicKey) throw new Error("dist/config.js Web Push key does not match config.local.js; rebuild before deployment.");

execFileSync("git",["check-ignore","-q",source],{stdio:"ignore"});
console.log("Deployment config verified: private local config is ignored, feedback is approved, and Web Push is configured in dist.");
