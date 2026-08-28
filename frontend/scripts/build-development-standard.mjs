import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const run = (label, args) => {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 1}.`);
  }
};

// Keep the build runner as a Node script instead of a long cmd.exe chain.
// Windows silently truncates overlong package commands, which previously made
// lint look like a successful production build while later checks never ran.
// Lint is intentionally run by the verification workflow before this build:
// the local ESLint launcher terminates its inherited Windows process group,
// so chaining it here can prevent Vite from ever receiving control.
run("source page lock", ["scripts/guard-source-page-locks.mjs"]);
run("development-standard gates", ["scripts/run-development-standard-gates.mjs"]);
run("vite build", [resolve("node_modules/vite/bin/vite.js"), "build"]);
run("bundle budgets", ["scripts/verify-bundle-budgets.mjs"]);

console.log("Production build completed through the Development Specification and bundle-budget gates.");
