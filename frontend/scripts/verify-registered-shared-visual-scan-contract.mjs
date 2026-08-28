import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFile(resolve(root, file), "utf8");

const [registrySource, runtimeRoute, runtimeScan, panel, e2e, adapterResolution, packageSource, gateRunner] = await Promise.all([
  read("src/page-factory/page-registry.json"),
  read("src/lib/page-factory-runtime-route.ts"),
  read("src/lib/layout-screenshot-regressions.ts"),
  read("src/components/product-market/DevelopmentStandardPanels.tsx"),
  read("e2e/three-source-global-frame-parity.spec.ts"),
  read("src/lib/developer-global-frame-adapter-resolution.ts"),
  read("package.json"),
  read("scripts/run-development-standard-gates.mjs"),
]);

const registry = JSON.parse(registrySource);
const pages = registry.pages ?? [];
if (!pages.length) throw new Error("Registered shared-visual scan has no Page Factory source of truth.");

for (const token of [
  'hq: "/zb"',
  'agency_source: "/zb/agency-source"',
  'client_source: "/zb/client-source"',
  "PAGE_FACTORY_RUNTIME_DYNAMIC_SEGMENT_VALUE",
  "buildPageFactoryRuntimeRoute",
]) {
  if (!runtimeRoute.includes(token)) throw new Error(`Central Page Factory runtime-route token is missing: ${token}`);
}
for (const token of [
  "PAGE_FACTORY_PAGES.map",
  "buildRegisteredLayoutScanRoute",
  "REGISTERED_LAYOUT_SCAN_TARGETS",
  "factoryIdentity",
  "data-page-factory-page-id",
]) {
  if (!runtimeScan.includes(token)) throw new Error(`Registry-derived runtime scan token is missing: ${token}`);
}
for (const token of [
  "inspectRegisteredLayoutPages(REGISTERED_LAYOUT_SCAN_TARGETS",
  "REGISTERED_LAYOUT_SCAN_TARGETS.length",
]) {
  if (!panel.includes(token)) throw new Error(`Development Specification does not scan registry truth: ${token}`);
}
if (panel.includes("inspectRegisteredLayoutPages(LAYOUT_SCREENSHOT_REGRESSIONS.map")) {
  throw new Error("Development Specification still scans the hand-written screenshot sample list.");
}

const isolationBlock = adapterResolution.match(
  /DEVELOPER_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\s*as const\)/u,
);
if (!isolationBlock) throw new Error("Developer intentional-isolation registry cannot be inspected.");
const isolationIds = new Set([...isolationBlock[1].matchAll(/"([^"]+)"/gu)].map((match) => match[1]));

const representativeBlock = e2e.match(
  /REGISTERED_RUNTIME_REPRESENTATIVE_PAGE_IDS\s*=\s*\[([\s\S]*?)\]\s*as const/u,
);
if (!representativeBlock) throw new Error("Three-source runtime representative registry is missing.");
const representativeIds = [...representativeBlock[1].matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
const pageById = new Map(pages.map((page) => [page.id, page]));
const representedCombinations = new Set();
for (const pageId of representativeIds) {
  const page = pageById.get(pageId);
  if (!page) throw new Error(`Three-source runtime representative is not registered: ${pageId}`);
  if (page.status !== "complete" && page.status !== "pilot-complete") {
    throw new Error(`Three-source runtime representative is not eligible: ${pageId}`);
  }
  representedCombinations.add(`${page.sourceScope}:${page.template}`);
}
const eligibleCombinations = new Set(pages
  .filter((page) => (page.status === "complete" || page.status === "pilot-complete") && !isolationIds.has(page.id))
  .map((page) => `${page.sourceScope}:${page.template}`));
const represented = [...representedCombinations].sort();
const eligible = [...eligibleCombinations].sort();
if (JSON.stringify(represented) !== JSON.stringify(eligible)) {
  throw new Error(`Three-source runtime representative matrix drifted. Expected ${eligible.join(", ")}; received ${represented.join(", ")}.`);
}
for (const isolationId of isolationIds) {
  if (!e2e.includes(`"${isolationId}"`)) throw new Error(`Three-source E2E isolation mirror is missing: ${isolationId}`);
}

for (const token of [
  "data-developer-global-frame-resolved-page-id",
  "data-developer-global-frame-resolved-adapter",
  "data-developer-global-frame-resolved-strategy",
  "data-shared-window-contract",
  "data-shared-window-factory-default",
  "data-page-factory-page-id",
  "data-page-factory-template",
]) {
  if (!e2e.includes(token)) throw new Error(`Three-source real-DOM assertion is missing: ${token}`);
}

const packageJson = JSON.parse(packageSource);
if (!packageJson.scripts?.["test:three-source-global-frame-contract"]?.includes("three-source-global-frame-parity.spec.ts")) {
  throw new Error("Three-source real-DOM contract has no package gate.");
}
for (const gate of [
  "verify-alert-dialog-shared-window-contract.mjs",
  "verify-registered-shared-visual-scan-contract.mjs",
  "run-three-source-global-frame-runtime-contract.mjs",
]) {
  if (!gateRunner.includes(gate)) throw new Error(`Development Standard does not run required global gate: ${gate}`);
}

console.log(`Registered shared-visual scan contract passed: ${pages.length} pages and ${eligible.length} populated source/template combinations are gated.`);
