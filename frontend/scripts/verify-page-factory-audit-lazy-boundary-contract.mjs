import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { join, relative } from "node:path";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));
const collectSourceFiles = (directory) => readdirSync(directory).flatMap((entry) => {
  const absolutePath = join(directory, entry);
  return statSync(absolutePath).isDirectory() ? collectSourceFiles(absolutePath) : [absolutePath];
});

const core = read("src/page-factory/page-factory.ts");
const audit = read("src/page-factory/page-factory-audit.ts");
const workbench = read("src/components/product-market/PageFactoryWorkbench.tsx");
const consoleSource = read("src/components/product-market/DevelopmentStandardApplyConsole.tsx");
const standardRaw = read("src/page-factory/page-factory-standard.json");
const registryRaw = read("src/page-factory/page-registry.json");
const commandsRaw = read("src/page-factory/page-command-catalog.json");
const inventoryRaw = read("src/page-factory/page-inventory.json");
const verificationRaw = read("src/page-factory/phase-two-verification.json");

for (const token of [
  'import standardData from "./page-factory-standard.json";',
  'import registryData from "./page-registry.json";',
  'import commandData from "./page-command-catalog.json";',
]) {
  assert.ok(core.includes(token), `Page factory core lost a runtime dependency: ${token}`);
}
for (const token of [
  "page-inventory.json",
  "phase-two-verification.json",
  "PAGE_FACTORY_INVENTORY =",
  "PAGE_FACTORY_VERIFICATION =",
]) {
  assert.ok(!core.includes(token), `Page factory core still pulls audit-only data: ${token}`);
}

for (const token of [
  'import inventoryData from "./page-inventory.json";',
  'import verificationData from "./phase-two-verification.json";',
  "export const PAGE_FACTORY_INVENTORY",
  "export const PAGE_FACTORY_VERIFICATION",
]) {
  assert.ok(audit.includes(token), `Audit module is missing its owned dependency or export: ${token}`);
}
assert.match(
  audit,
  /import type \{ PageFactoryInventory, PageFactoryVerification \} from "\.\/page-factory";/u,
  "The audit module may depend on core types only, not create a runtime cycle.",
);

assert.doesNotMatch(
  workbench,
  /^import .*@\/page-factory\/page-factory-audit.*;$/mu,
  "PageFactoryWorkbench must not synchronously evaluate the audit JSON on first interaction.",
);
assert.match(
  workbench,
  /\(\) => import\("@\/page-factory\/page-factory-audit"\)/u,
  "PageFactoryWorkbench must load audit data through its nested dynamic boundary.",
);
for (const token of [
  "schedulePostPaintIdle",
  "loadPageFactoryAuditModule",
  '"developer-application:page-factory-audit"',
  "data-page-factory-audit-load-state",
  "onSourceRecordsResolved?.(pageFactorySourceRecords)",
]) {
  assert.ok(workbench.includes(token), `Page Factory nested audit loading lost ${token}`);
}
assert.doesNotMatch(
  workbench,
  /PAGE_FACTORY_(?:INVENTORY|VERIFICATION),[\s\S]*?from "@\/page-factory\/page-factory"/u,
  "PageFactoryWorkbench must not recover audit exports from the ordinary-page core.",
);
assert.match(
  consoleSource,
  /const loadPageFactoryWorkbench = \(\) => loadDeveloperApplicationModule\("page-factory", async \(\) => \{[\s\S]*?import\("@\/components\/product-market\/PageFactoryWorkbench"\)[\s\S]*?const LazyPageFactoryWorkbench = lazy\(loadPageFactoryWorkbench\)/u,
  "The audit consumer must remain behind the shared single-flight lazy workbench boundary.",
);

const sourceFiles = collectSourceFiles(sourceRoot)
  .filter((path) => /\.[cm]?[jt]sx?$/u.test(path));
assert.deepEqual(
  sourceFiles
    .filter((path) => readFileSync(path, "utf8").includes("@/page-factory/page-factory-audit"))
    .map((path) => relative(sourceRoot, path).replaceAll("\\", "/")),
  ["components/product-market/PageFactoryWorkbench.tsx"],
  "Only PageFactoryWorkbench may statically import the audit module.",
);
assert.deepEqual(
  sourceFiles
    .filter((path) => readFileSync(path, "utf8").includes("@/components/product-market/PageFactoryWorkbench"))
    .map((path) => relative(sourceRoot, path).replaceAll("\\", "/")),
  ["components/product-market/DevelopmentStandardApplyConsole.tsx"],
  "Only the lazy developer console boundary may import PageFactoryWorkbench.",
);

const auditRawBytes = Buffer.byteLength(inventoryRaw) + Buffer.byteLength(verificationRaw);
const inventoryMinified = JSON.stringify(JSON.parse(inventoryRaw));
const verificationMinified = JSON.stringify(JSON.parse(verificationRaw));
const auditMinifiedBytes = Buffer.byteLength(inventoryMinified) + Buffer.byteLength(verificationMinified);
const auditGzipBytes = gzipSync(inventoryMinified, { level: 9 }).byteLength
  + gzipSync(verificationMinified, { level: 9 }).byteLength;
const coreRuntimeRaw = [standardRaw, registryRaw, commandsRaw];
const coreRuntimeMinified = coreRuntimeRaw.map((value) => JSON.stringify(JSON.parse(value)));
const coreRuntimeRawBytes = coreRuntimeRaw.reduce((total, value) => total + Buffer.byteLength(value), 0);
const coreRuntimeMinifiedBytes = coreRuntimeMinified.reduce((total, value) => total + Buffer.byteLength(value), 0);
const coreRuntimeGzipBytes = coreRuntimeMinified.reduce(
  (total, value) => total + gzipSync(value, { level: 9 }).byteLength,
  0,
);
assert.ok(auditRawBytes >= 200 * 1024, "The split must keep at least 200 KiB of raw audit JSON off the ordinary-page core path.");
assert.ok(auditMinifiedBytes >= 160 * 1024, "The split must keep a meaningful minified audit payload behind the lazy boundary.");
assert.ok(auditGzipBytes >= 30 * 1024, "The split must keep a meaningful compressed audit payload behind the lazy boundary.");

console.log(
  `Page factory nested post-paint audit contract verified: core JSON raw ${coreRuntimeRawBytes + auditRawBytes} -> ${coreRuntimeRawBytes}, minified ${coreRuntimeMinifiedBytes + auditMinifiedBytes} -> ${coreRuntimeMinifiedBytes}, gzip ${coreRuntimeGzipBytes + auditGzipBytes} -> ${coreRuntimeGzipBytes}; ${auditRawBytes} raw audit bytes deferred beyond the 07 shell.`,
);
