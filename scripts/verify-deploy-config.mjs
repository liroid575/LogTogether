import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const privateSource = "config.local.js";
const publicSource = "public/config.js";
const built = "dist/config.js";

if (!existsSync(built)) {
  throw new Error("dist/config.js is missing; run the build first.");
}

const source = existsSync(privateSource)
  ? privateSource
  : publicSource;

if (!existsSync(source)) {
  throw new Error(`Configuration source is missing: ${source}`);
}

if (source === privateSource) {
  try {
    execFileSync(
      "git",
      ["check-ignore", "-q", privateSource],
      { stdio: "ignore" }
    );
  } catch {
    throw new Error(
      "config.local.js exists but is not ignored by Git."
    );
  }
}

const sourceText = readFileSync(source, "utf8");
const builtText = readFileSync(built, "utf8");

if (sourceText !== builtText) {
  throw new Error(
    `dist/config.js does not match ${source}; rebuild before deployment.`
  );
}

console.log(
  `Deployment config verified using ${source}: built configuration matches the intended source.`
);
