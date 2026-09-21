import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const readJson = path =>
  JSON.parse(readFileSync(path, "utf8"));

const rootPackage = readJson("package.json");
const rootLock = readJson("package-lock.json");
const functionsPackage = readJson("functions/package.json");
const functionsLock = readJson("functions/package-lock.json");

const version = rootPackage.version;

const versions = [
  ["package.json", rootPackage.version],
  ["package-lock.json", rootLock.version],
  ["package-lock root package", rootLock.packages?.[""]?.version],
  ["functions/package.json", functionsPackage.version],
  ["functions/package-lock.json", functionsLock.version],
  ["functions lock root package", functionsLock.packages?.[""]?.version],
];

for (const [name, value] of versions) {
  if (value !== version) {
    throw new Error(
      `${name} reports ${value ?? "no version"}; expected ${version}.`
    );
  }
}

if (rootPackage.private !== true) {
  throw new Error(
    'package.json must keep "private": true to prevent accidental npm publication.'
  );
}

if (
  rootPackage.dependencies &&
  Object.keys(rootPackage.dependencies).length > 0
) {
  throw new Error(
    "Unexpected browser runtime npm dependencies are present."
  );
}

const expectedAppVersion =
  `APP_VERSION = "${version}"`;

const mainSource =
  readFileSync("src/main.ts", "utf8");

if (!mainSource.includes(expectedAppVersion)) {
  throw new Error(
    `src/main.ts does not contain ${expectedAppVersion}.`
  );
}

const expectedShell =
  `logtogether-shell-v${version}`;

const serviceWorker =
  readFileSync("public/sw.js", "utf8");

if (!serviceWorker.includes(expectedShell)) {
  throw new Error(
    `public/sw.js does not contain ${expectedShell}.`
  );
}

const requiredFiles = [
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "SELF_HOSTING.md",
  "docs/guides/UPGRADE.md",
  `docs/releases/V${version}.md`,
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    throw new Error(
      `Required release file is missing: ${file}`
    );
  }
}

const git = (...args) => {
  const result = spawnSync("git", args, {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed:\n${result.stderr}`
    );
  }

  return result.stdout;
};

const trackedFiles = git("ls-files", "-z")
  .split("\0")
  .filter(Boolean);

const forbiddenTrackedFiles = [
  "config.local.js",
  ".firebaserc",
  ".env",
  ".env.local",
];

for (const file of forbiddenTrackedFiles) {
  if (trackedFiles.includes(file)) {
    throw new Error(
      `Private machine file is tracked: ${file}`
    );
  }
}

const forbiddenStrings = [
  "logtogether" + "-dev.web.app",
  "research_and_" + "recording_audit",
];

for (const needle of forbiddenStrings) {
  const result = spawnSync(
    "git",
    ["grep", "-l", "-I", "-F", needle, "--", "."],
    { encoding: "utf8" }
  );

  if (result.status === 0 && result.stdout.trim()) {
    throw new Error(
      `Tracked source still contains "${needle}":\n${result.stdout.trim()}`
    );
  }

  if (![0, 1].includes(result.status)) {
    throw new Error(
      `git grep failed while checking "${needle}".`
    );
  }
}

console.log(
  `Release verification passed for v${version}.`
);

console.log(
  "Versions, release files, privacy boundaries, and runtime dependency footprint are consistent."
);
