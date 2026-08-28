import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `export { CUSTOMER_SERVICE_RUNTIME_CONFIG_CONTRACT, reconcileCustomerServiceRuntimeExpertSelection } from "./src/lib/customer-service-runtime-config.ts";`,
    resolveDir: process.cwd(),
    sourcefile: "customer-service-runtime-selection-entry.ts",
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  logLevel: "silent",
});

const encoded = Buffer.from(bundle.outputFiles[0].text).toString("base64");
const runtimeContract = await import(`data:text/javascript;base64,${encoded}`);

assert.equal(runtimeContract.CUSTOMER_SERVICE_RUNTIME_CONFIG_CONTRACT.plugin, "shared-customer-service-runtime-config-v2");
assert.match(runtimeContract.CUSTOMER_SERVICE_RUNTIME_CONFIG_CONTRACT.policy, /saved-default-expert-resets-stale-chat-preference/u);

assert.deepEqual(
  runtimeContract.reconcileCustomerServiceRuntimeExpertSelection({
    previousRuntimeAvatarId: "expert-01",
    nextRuntimeAvatarId: "expert-01",
    activeExpertId: "expert-07",
  }),
  { activeExpertId: "expert-07", clearRememberedExpert: false },
  "A same-default runtime refresh must retain an in-chat expert switch.",
);
assert.deepEqual(
  runtimeContract.reconcileCustomerServiceRuntimeExpertSelection({
    previousRuntimeAvatarId: "expert-01",
    nextRuntimeAvatarId: "expert-05",
    activeExpertId: "expert-07",
  }),
  { activeExpertId: null, clearRememberedExpert: true },
  "A saved Select Expert default must clear the stale in-chat expert preference.",
);
assert.deepEqual(
  runtimeContract.reconcileCustomerServiceRuntimeExpertSelection({
    previousRuntimeAvatarId: null,
    nextRuntimeAvatarId: "expert-05",
    activeExpertId: "expert-07",
  }),
  { activeExpertId: "expert-07", clearRememberedExpert: false },
  "Initial hydration must not erase a valid local preference before a save changes the default.",
);

const [widgetSource, packageJson, gatesSource] = await Promise.all([
  readFile("src/components/AIServiceWidget.tsx", "utf8"),
  readFile("package.json", "utf8"),
  readFile("scripts/run-development-standard-gates.mjs", "utf8"),
]);
assert.match(widgetSource, /PRODUCT_MARKET_CONFIG_EVENT/u, "The floating widget must refresh after a saved Product Market configuration event.");
assert.match(widgetSource, /reconcileCustomerServiceRuntimeExpertSelection/u, "The floating widget must use the shared saved-default reconciliation contract.");
assert.match(widgetSource, /window\.localStorage\.removeItem\(expertPreferenceStorageKey\)/u, "A saved Select Expert default must remove the stale remembered chat expert.");
assert.match(widgetSource, /setPendingExpertId\(null\)/u, "A saved Select Expert default must close any stale pending chat selection.");
assert.equal(JSON.parse(packageJson).scripts["verify:customer-service-runtime-selection"], "node scripts/verify-customer-service-runtime-selection-contract.mjs");
assert.match(gatesSource, /verify-customer-service-runtime-selection-contract\.mjs/u, "The runtime selection contract must run in the development-standard gate suite.");

console.log("Customer-service saved Select Expert runtime synchronization contract passed.");
