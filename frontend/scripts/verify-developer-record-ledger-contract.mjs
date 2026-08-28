import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { build } from "esbuild";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const readJson = (relativePath) => JSON.parse(readFileSync(resolve(repositoryRoot, relativePath), "utf8"));
const readText = (relativePath) => readFileSync(resolve(repositoryRoot, relativePath), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(`Developer record ledger contract failed: ${message}`);
};

const contract = readJson("shared/contracts/developer-record-ledger-contract.json");
const optimizationContract = readJson("shared/contracts/developer-optimization-contract.json");
const verification = readJson("frontend/src/page-factory/phase-two-verification.json");
const consoleSource = readText("frontend/src/components/product-market/DevelopmentStandardApplyConsole.tsx");
const panelSource = readText("frontend/src/components/product-market/DeveloperRecordPanel.tsx");
const factorySource = readText("frontend/src/components/product-market/PageFactoryWorkbench.tsx");
const sourceLockSource = readText("frontend/src/lib/source-page-lock.ts");
const sourceLockReadbackSource = readText("frontend/src/lib/developer-source-page-lock-readback.ts");

assert(contract.schemaVersion === 1 && contract.version === "2026.08.28.4" && contract.ownership === "shared-first", "the ledger must remain a versioned shared-first contract");
assert(JSON.stringify(contract.projections.map(({ order }) => order)) === JSON.stringify(["01", "02", "03", "04", "05", "06", "08"]), "the ledger must project 01-06 and 08 exactly once");
assert(contract.projections.at(-1)?.artifactKind === "lock-receipt", "08 must own the lock receipt projection");
assert(contract.aggregate?.order === "07" && contract.aggregate?.hostAppId === "page-factory" && contract.aggregate?.mode === "read-only", "07 must own the standalone read-only aggregate ledger");
assert(contract.ui?.duplicateLedgersForbidden === true && contract.ui?.projectionLatestLimit === 3, "application projections must reuse one ledger and show at most three recent entries");
assert(contract.localReceipts?.formalAudit === false && contract.localReceipts?.maximumRecordsPerScope === 120, "local receipts must stay bounded and must not claim formal audit authority");
assert(contract.artifactReferencePolicy?.redactAbsoluteLocalPaths === true && contract.artifactReferencePolicy?.redactCredentials === true, "ledger references must redact local paths and credentials");
assert(contract.legacyEvidence?.preferExplicitAppIdentity === true && !contract.legacyEvidence.classificationFields.includes("validation") && !contract.legacyEvidence.classificationFields.includes("risks"), "legacy classification must prefer explicit app identity and ignore generic verification boilerplate");
const aliasCompatibility = contract.compatibilityRules?.navigationOrderAlias;
assert(aliasCompatibility?.effectiveContractVersionSource === "developer-optimization-contract.json#navigationOrderMigration.effectiveContractVersion", "navigation aliases must read the shared migration contract version");
assert(aliasCompatibility?.missingContractVersionMode === "legacy-previous-order" && aliasCompatibility?.beforeEffectiveVersion === "previous-order-alias" && aliasCompatibility?.atOrAfterEffectiveVersion === "current-order", "navigation alias compatibility must distinguish historical and current display orders");
const workflowPerformanceCompatibility = contract.compatibilityRules?.workflowPerformanceRevision;
assert(workflowPerformanceCompatibility?.sourceKeyPattern === "WorkflowPerformanceRevision$", "workflow-performance source records must use one governed matcher");
assert(JSON.stringify(workflowPerformanceCompatibility?.stageOrders) === JSON.stringify(["01", "02", "03", "04", "05", "06"]), "workflow-performance records must relate every execution stage");
assert(workflowPerformanceCompatibility?.primaryAppId === "performance-experience" && workflowPerformanceCompatibility?.artifactKind === "performance-evidence", "workflow-performance records must remain owned by 05 performance evidence");
assert(JSON.stringify(workflowPerformanceCompatibility?.pageIdentityObjectFields) === JSON.stringify(["sourceScope", "normalizedRoute"]), "legacy page identity objects must map source scope and normalized route");
assert(workflowPerformanceCompatibility?.externalPendingMapsTo === "pending" && JSON.stringify(workflowPerformanceCompatibility?.statusPriority) === JSON.stringify(["failed", "blocked", "stale", "pending", "passed"]), "workflow status compatibility must fail closed around external evidence");

for (const token of [
  "adaptDeveloperWorkflowArtifacts",
  "listLocalDeveloperRecords",
  "DeveloperRecordPanel",
  "appendPageLockReceipt",
  "applyPageLockOperation",
  'activeTool === "page-factory"',
  "data-development-standard-page-factory-lifecycle",
  "data-development-standard-application-record-projection",
]) {
  assert(consoleSource.includes(token), `DevelopmentStandardApplyConsole is missing ${token}`);
}
assert(!consoleSource.includes("factoryOpenRequest") && !consoleSource.includes("renderFactoryLifecycle"), "the legacy Page Factory expansion bridge must be removed");
for (const token of ["data-developer-record-panel=\"projection\"", "data-developer-record-panel=\"ledger\"", "DEVELOPER_RECORD_LOCAL_DISCLAIMER"]) {
  assert(panelSource.includes(token), `shared record panel is missing ${token}`);
}
assert(factorySource.includes("adaptPhaseTwoVerificationRecords")
  && factorySource.includes("pageFactoryAuditSourceRecords")
  && factorySource.includes('import("@/page-factory/page-factory-audit")')
  && factorySource.includes("data-page-factory-developer-record-ledger")
  && factorySource.includes("mode=\"ledger\""), "07 Page Factory must lazily load, cache, adapt and render the shared aggregate ledger");
assert(sourceLockSource.includes("syncSourcePageLock") && sourceLockReadbackSource.includes("readSourcePageLocks") && sourceLockReadbackSource.includes("syncSourcePageLockWithReadback"), "source lock changes must support deferred server readback without increasing ordinary route startup cost");

const runtimeBundle = await build({
  entryPoints: [resolve(repositoryRoot, "frontend/src/lib/developer-record-ledger.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  logLevel: "silent",
});
const runtime = await import(`data:text/javascript;base64,${Buffer.from(runtimeBundle.outputFiles[0].text).toString("base64")}`);
const legacyKeys = Object.keys(verification).filter((key) => (
  /^latest.*Revision$/u.test(key)
  || contract.legacyEvidence.auditKeys.includes(key)
  || contract.legacyEvidence.repairKeys.includes(key)
));
const records = runtime.adaptPhaseTwoVerificationRecords(verification);
assert(records.length === legacyKeys.length + 1, "the adapter must expose every legacy record plus the current 07 verification summary");
assert(records.filter((record) => record.artifactKind === "page-factory-verification").length === 1, "the aggregate must contain exactly one current verification summary");
assert(records.every((record) => record.relatedAppIds.includes("page-factory")), "every source record must remain discoverable from 07");
const legacyRecords = records.filter((record) => record.artifactKind !== "page-factory-verification");
assert(new Set(legacyRecords.map((record) => record.appId)).size >= 5, "legacy evidence must remain distributed across developer applications");
assert(legacyRecords.filter((record) => record.appId === "page-lock").length < legacyRecords.length / 2, "generic source-lock validation text must not collapse the ledger into 08");
const consolidation = records.find((record) => record.sourceKey === "latestDeveloperRecordLedgerConsolidationRevision");
assert(consolidation?.appId === "visual-frame" && consolidation?.contractVersion === "2026.08.28.2" && consolidation?.hVersion === "H38684", "the historical 09 consolidation must remain readable without rewriting it");
const migration = records.find((record) => record.sourceKey === "latestDeveloperNavigationOrderMigrationRevision");
assert(migration?.appId === "page-factory" && migration?.contractVersion === optimizationContract.navigationOrderMigration.effectiveContractVersion && /^H\d+$/u.test(migration?.hVersion || ""), "07 must retain the current navigation migration record and planned H version");
assert(migration.relatedAppIds.length === 8 && runtime.DEVELOPER_RECORD_APPS.every(({ appId }) => migration.relatedAppIds.includes(appId)), "the navigation migration record must cover all eight stable app identities");
const workflowPerformanceRecords = [
  ["latestProductMarketOperationsWorkflowPerformanceRevision", "/product-market?tab=operations"],
  ["latestProductMarketModulesWorkflowPerformanceRevision", "/product-market?tab=modules"],
  ["latestProductMarketLayoutWorkflowPerformanceRevision", "/product-market?tab=layout"],
  ["latestProductMarketServiceWorkflowPerformanceRevision", "/product-market?tab=service"],
];
const expectedWorkflowAppIds = runtime.DEVELOPER_RECORD_APPS
  .filter(({ id }) => ["01", "02", "03", "04", "05", "06", "07"].includes(id))
  .map(({ appId }) => appId)
  .sort();
for (const [sourceKey, normalizedRoute] of workflowPerformanceRecords) {
  const record = records.find((candidate) => candidate.sourceKey === sourceKey);
  assert(record?.appId === "performance-experience" && record?.artifactKind === "performance-evidence", `${sourceKey} must remain 05 performance evidence`);
  assert(record?.status === "pending", `${sourceKey} must preserve external pending release evidence`);
  assert(record?.scope === "page" && record?.sourceScope === "client_source", `${sourceKey} must retain client-source page scope`);
  assert(record?.pageIdentity === `client_source:${normalizedRoute}` && record?.scopeIdentity === `page:client_source:${encodeURIComponent(normalizedRoute)}`, `${sourceKey} must normalize its object page identity`);
  assert(JSON.stringify([...record.relatedAppIds].sort()) === JSON.stringify(expectedWorkflowAppIds), `${sourceKey} must relate 01-06 and the 07 aggregate exactly once`);
}
const currentOrderRecord = runtime.adaptPhaseTwoVerificationRecords({
  latestCurrentDisplayOrderRevision: {
    recordedAt: "2026-08-28T13:00:00+08:00",
    contractVersion: optimizationContract.navigationOrderMigration.effectiveContractVersion,
    appId: "page-factory",
    result: "current navigation order",
    stageEvidence: { "07": { result: "current Page Factory" } },
  },
})[0];
assert(currentOrderRecord?.relatedAppIds.includes("page-factory") && !currentOrderRecord?.relatedAppIds.includes("page-lock"), "current-contract bare 07 stage evidence must resolve to Page Factory rather than the legacy lock alias");
const currentPageFactoryRevision = verification.latestDeveloperApplicationChainPerformanceRevision;
assert(currentPageFactoryRevision.sourceRecordCount === records.length, "the current 07 record source count must match the adapter output");
assert(currentPageFactoryRevision.legacyEvidenceCount === legacyKeys.length, "the current 07 record legacy count must match the governed evidence keys");
assert(currentPageFactoryRevision.revisionCount === legacyKeys.filter((key) => /^latest.*Revision$/u.test(key)).length, "the current 07 record revision count must match the governed revision keys");
assert(runtime.DEVELOPER_RECORD_APPS.map(({ id }) => id).join(",") === "01,02,03,04,05,06,07,08", "runtime record applications must match the shared contract");
assert(runtime.sanitizeDeveloperRecordArtifactRefs(["G:\\private\\report.json", "frontend/report.json"]).join(",") === "frontend/report.json", "runtime record references must remove absolute local paths");

console.log(`Developer record ledger contract verified: ${records.length} source records, 8 display surfaces.`);
