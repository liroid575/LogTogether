const rawBase = process.env.LOGTOGETHER_DEPLOY_URL?.trim();

if (!rawBase) {
  throw new Error(
    "LOGTOGETHER_DEPLOY_URL is required, for example https://your-site.web.app."
  );
}

const parsedBase = new URL(rawBase);
const local = ["127.0.0.1", "localhost"].includes(parsedBase.hostname);

if (parsedBase.username || parsedBase.password) {
  throw new Error("Deployment URLs must not contain embedded credentials.");
}

if (local) {
  if (!["http:", "https:"].includes(parsedBase.protocol)) {
    throw new Error("Local verification requires HTTP or HTTPS.");
  }
} else if (parsedBase.protocol !== "https:") {
  throw new Error("Remote deployment verification requires HTTPS.");
}

const base = parsedBase.origin;

const fetchText = async path => {
  const response = await fetch(`${base}${path}?verification=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}.`);
  return response.text();
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const fetchUntil = async (path, predicate, label) => {
  let text = "";
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    text = await fetchText(path);
    if (predicate(text)) return text;
    if (attempt < 12) await sleep(1_000);
  }
  throw new Error(`${label} did not reach the expected release within 12 seconds.`);
};

const [config, serviceWorker, main] = await Promise.all([
  fetchText("/config.js"),
  fetchUntil("/sw.js", text => text.includes("logtogether-shell-v0.16.0"), "The deployed service worker"),
  fetchUntil("/assets/main.js", text => text.includes('APP_VERSION = "0.16.0"'), "The deployed application bundle")
]);

const feedbackMatch = config.match(/feedbackFormUrl\s*:\s*(["'])(.*?)\1/);
const feedbackFormUrl = feedbackMatch?.[2]?.trim() ?? "";

if (feedbackFormUrl) {
  const form = new URL(feedbackFormUrl);

  if (
    form.protocol !== "https:" ||
    form.username ||
    form.password
  ) {
    throw new Error(
      "The deployed feedbackFormUrl must be a safe HTTPS URL."
    );
  }
}

const pushMatch = config.match(/pushPublicKey\s*:\s*(["'])(.*?)\1/);
const pushPublicKey = pushMatch?.[2]?.trim() ?? "";

if (
  pushPublicKey &&
  !/^[A-Za-z0-9_-]{80,100}$/.test(pushPublicKey)
) {
  throw new Error(
    "The deployed pushPublicKey is present but is not a valid Web Push public key."
  );
}

if (!serviceWorker.includes("logtogether-shell-v0.16.0")) {
  throw new Error("The deployed service worker is not v0.16.0.");
}
if (!main.includes('APP_VERSION = "0.16.0"')) {
  throw new Error("The deployed application bundle is not v0.16.0.");
}

console.log("Live deployment verified: v0.16.0 shell, app bundle, and deployment configuration are valid.");
