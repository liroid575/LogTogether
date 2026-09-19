import { createHash } from "node:crypto";

const base = (process.env.LOGTOGETHER_DEPLOY_URL ?? "https://example.invalid").replace(/\/$/,"");
const parsedBase = new URL(base);
const local = ["127.0.0.1","localhost"].includes(parsedBase.hostname);
if ((!local && (parsedBase.protocol !== "https:" || parsedBase.hostname !== "example.invalid")) || (local && parsedBase.protocol !== "http:")) {
  throw new Error("Refusing to verify an unexpected deployment host.");
}

const fetchText = async path => {
  const response = await fetch(`${base}${path}?verification=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}.`);
  return response.text();
};

const [config, serviceWorker, main] = await Promise.all([
  fetchText("/config.js"),
  fetchText("/sw.js"),
  fetchText("/assets/main.js")
]);

const feedbackMatch = config.match(/feedbackFormUrl\s*:\s*(["'])(.*?)\1/);
if (!feedbackMatch?.[2]) throw new Error("The deployed config has no feedbackFormUrl.");
const form = new URL(feedbackMatch[2]);
const canonicalFormUrl = `${form.origin}${form.pathname.replace(/\/$/,"")}`;
const expectedFormHash = "cce128118fb897605224d241c7630f79ad399ffc0e17d9e34903769695f904c1";
if (createHash("sha256").update(canonicalFormUrl).digest("hex") !== expectedFormHash) {
  throw new Error("The deployed feedback link is not the approved LogTogether form.");
}
const pushMatch = config.match(/pushPublicKey\s*:\s*(["'])(.*?)\1/);
const pushPublicKey = pushMatch?.[2]?.trim() ?? "";
if (!/^[A-Za-z0-9_-]{80,100}$/.test(pushPublicKey)) {
  throw new Error("The deployed config has no valid Web Push public key.");
}
if (!serviceWorker.includes("logtogether-shell-v0.15.0-notify-hotfix4")) {
  throw new Error("The deployed service worker is not v0.15.0.");
}
if (!main.includes('APP_VERSION = "0.15.0"')) {
  throw new Error("The deployed application bundle is not v0.15.0.");
}

console.log("Live deployment verified: v0.15.0 shell, app bundle, approved feedback form, and Web Push configuration are present.");
