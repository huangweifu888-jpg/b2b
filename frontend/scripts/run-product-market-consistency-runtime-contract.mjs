import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const playwrightCli = require.resolve("@playwright/test/cli");

function runPlaywright(args, label) {
  const result = spawnSync(process.execPath, [playwrightCli, "test", ...args], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
  console.log(`${label} passed.`);
}

runPlaywright([
  "e2e/product-market-save-navigation.spec.ts",
  "e2e/product-market-four-tab-contract.spec.ts",
  "e2e/product-market-runtime-identity.spec.ts",
  "--workers=1",
], "Product Market save, four-tab and tenant-safe runtime identity contract");

runPlaywright([
  "e2e/shared-visual-parity.spec.ts",
  "--grep",
  "product-market-",
], "Product Market shared visual parity contract");

console.log("Product Market end-to-end consistency contract passed.");
