import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { build } from "esbuild";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const readJson = (relativePath) => JSON.parse(readFileSync(resolve(repositoryRoot, relativePath), "utf8"));
const readText = (relativePath) => readFileSync(resolve(repositoryRoot, relativePath), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(`Design integration contract failed: ${message}`);
};
const unique = (values) => new Set(values).size === values.length;
const hasEvery = (values, required) => required.every((value) => values.includes(value));

const pageDna = readJson("shared/contracts/page-dna-contract.json");
const design = readJson("shared/contracts/design-integration-contract.json");
const visualEvidence = readJson("shared/contracts/visual-evidence-contract.json");
const developerOptimization = readJson("shared/contracts/developer-optimization-contract.json");
const developerRecordLedger = readJson("shared/contracts/developer-record-ledger-contract.json");
const integrationSource = readText("frontend/src/lib/developer-design-integration.ts");
const workflowRunSource = readText("frontend/src/lib/developer-workflow-run.ts");
const developerConsoleSource = readText("frontend/src/components/product-market/DevelopmentStandardApplyConsole.tsx");
const unifiedFrameWorkbenchSource = readText("frontend/src/components/developer-platform/UnifiedFrameMigrationWorkbench.tsx");
const figmaWorkbenchSource = readText("frontend/src/components/product-market/DeveloperFigmaDesignWorkbench.tsx");
const evidenceWorkbenchSource = readText("frontend/src/components/product-market/DeveloperVisualEvidenceWorkbench.tsx");
const hqVersionSource = readText("frontend/src/lib/software-version.ts");
const hqBumpSource = readText("frontend/scripts/auto-bump-hq-version.mjs");
const hqVerifySource = readText("frontend/scripts/verify-hq-version.mjs");

for (const [name, contract] of Object.entries({ pageDna, design, visualEvidence, developerRecordLedger })) {
  assert(contract.schemaVersion === 1 || name === "design", `${name} must use schema version 1`);
  assert(typeof contract.version === "string" && contract.version.length > 0, `${name} must declare a version`);
  assert(contract.ownership === "shared-first", `${name} must remain shared-first`);
}

assert(design.contractReferences?.developerRecordLedger === "developer-record-ledger-contract.json", "design integration must reference the shared developer record ledger");
assert(developerOptimization.recordLedgerContract === "developer-record-ledger-contract.json", "developer optimization must reference the shared developer record ledger");
assert(developerRecordLedger.ownerComponent === "DevelopmentStandardApplyConsole", "the developer record ledger must have one runtime owner");
const ledgerSurfaces = [
  ...developerRecordLedger.projections.map(({ order, appId, artifactKind }) => [order, appId, artifactKind]),
  [developerRecordLedger.aggregate?.order, developerRecordLedger.aggregate?.hostAppId, developerRecordLedger.aggregate?.artifactKind],
].sort(([left], [right]) => left.localeCompare(right));
assert(JSON.stringify(ledgerSurfaces) === JSON.stringify(design.workflow.map(({ order, appId, artifact }) => [order, appId, artifact])), "record projections plus the Page Factory aggregate must cover all eight developer applications exactly once");
assert(developerRecordLedger.aggregate?.order === "07" && developerRecordLedger.aggregate?.hostAppId === "page-factory" && developerRecordLedger.aggregate?.mode === "read-only", "07 must be the standalone read-only Page Factory aggregate");
assert(developerRecordLedger.ui?.duplicateLedgersForbidden === true && developerRecordLedger.ui?.projectionLatestLimit === 3, "application pages must project the one shared ledger without duplication");
assert(JSON.stringify(developerRecordLedger.authorities.map(({ id }) => id)) === JSON.stringify(["source", "server", "local", "session"]), "record authority levels must remain explicit and ordered");
assert(developerRecordLedger.localReceipts?.formalAudit === false, "local receipts must never be presented as formal audit evidence");
assert(developerRecordLedger.artifactReferencePolicy?.redactAbsoluteLocalPaths === true && developerRecordLedger.artifactReferencePolicy?.redactCredentials === true, "record references must redact local paths and credentials");

const expectedWorkflow = [
  ["01", "visual-frame"],
  ["02", "shared-contract"],
  ["03", "figma-ui"],
  ["04", "visual-evidence"],
  ["05", "performance-experience"],
  ["06", "quality-release"],
  ["07", "page-factory"],
  ["08", "page-lock"],
];
assert(
  JSON.stringify(design.workflow.map(({ order, appId }) => [order, appId])) === JSON.stringify(expectedWorkflow),
  "the eight applications must follow the governed order and page-lock must remain last",
);
assert(unique(design.workflow.map((item) => item.appId)), "workflow application IDs must be unique");
assert(design.workflow.at(-1)?.appId === "page-lock", "page-lock must be the final application");
assert(design.pageDna.artifacts.includes("page-factory-verification"), "Page DNA must expose the standalone Page Factory verification artifact");

const workflowRuntime = design.workflowRuntime;
assert(workflowRuntime?.schemaVersion === 1, "workflow runtime schema version must be 1");
assert(workflowRuntime?.schema === "developer-workflow-run", "workflow runtime schema must be developer-workflow-run");
assert(workflowRuntime?.module === "developer-workflow-run", "workflow runtime module must be developer-workflow-run");
assert(workflowRuntime?.modulePath === "frontend/src/lib/developer-workflow-run.ts", "workflow runtime must use the shared developer-workflow-run module");
assert(existsSync(resolve(repositoryRoot, workflowRuntime.modulePath)), "workflow runtime module path must exist");

const scopeOwner = workflowRuntime.scopeOwner;
assert(scopeOwner?.mode === "single-owner", "workflow scope must have exactly one owner");
assert(scopeOwner?.component === "DevelopmentStandardApplyConsole", "DevelopmentStandardApplyConsole must be the workflow scope owner");
assert(scopeOwner?.modulePath === "frontend/src/components/product-market/DevelopmentStandardApplyConsole.tsx", "workflow scope owner module must remain canonical");
assert(existsSync(resolve(repositoryRoot, scopeOwner.modulePath)), "workflow scope owner module path must exist");
assert(JSON.stringify(scopeOwner.allowedScopes) === JSON.stringify(["global", "page"]), "workflow scope owner must expose exactly global and page scopes");
assert(scopeOwner.childScopeState === "forbidden", "workbenches must not own duplicate scope state");

const globalIdentity = workflowRuntime.identityRules?.global;
assert(globalIdentity?.scopeIdentityFormat === "global:{encodedSourceScope}", "global workflow identity must be stable per source scope");
assert(JSON.stringify(globalIdentity?.requiredFields) === JSON.stringify(["sourceScope"]), "global workflow identity must require only sourceScope");
assert(globalIdentity?.routeIndependent === true, "global workflow identity must not depend on the current route");
assert(globalIdentity?.targetManifestRequired === true, "global workflow identity must carry a target manifest");
const pageIdentity = workflowRuntime.identityRules?.page;
assert(pageIdentity?.scopeIdentityFormat === "page:{encodedSourceScope}:{encodedNormalizedRoute}", "page workflow identity must use sourceScope and normalizedRoute");
assert(JSON.stringify(pageIdentity?.pageIdentityFields) === JSON.stringify(["sourceScope", "normalizedRoute"]), "page identity must remain the canonical sourceScope and normalizedRoute pair");
assert(JSON.stringify(pageIdentity?.requiredFields) === JSON.stringify(["sourceScope", "normalizedRoute"]), "page workflow identity must require sourceScope and normalizedRoute");
assert(pageIdentity?.targetManifestRequired === true, "page workflow identity must carry a target manifest");
assert(pageIdentity?.targetManifestCardinality === 1, "page workflow target manifest must contain exactly one page");

const expectedTypedArtifacts = design.workflow.slice(0, 6).map(({ order, appId, artifact }) => ({
  order,
  appId,
  artifactKind: artifact,
}));
assert(JSON.stringify(workflowRuntime.typedArtifacts) === JSON.stringify(expectedTypedArtifacts), "workflow runtime must type the 01-06 artifacts exactly once and in order");
assert(unique(workflowRuntime.typedArtifacts.map((item) => item.artifactKind)), "workflow runtime artifact kinds must be unique");
const runtimeBundle = await build({
  stdin: {
    contents: 'export { DEVELOPER_WORKFLOW_STAGES } from "./frontend/src/lib/developer-workflow-run.ts";',
    loader: "ts",
    resolveDir: repositoryRoot,
    sourcefile: "developer-workflow-contract-verifier-entry.ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  logLevel: "silent",
});
const runtimeModule = await import(`data:text/javascript;base64,${Buffer.from(runtimeBundle.outputFiles[0].text).toString("base64")}`);
const runtimeTypedArtifacts = runtimeModule.DEVELOPER_WORKFLOW_STAGES.map(({ id, appId, artifactKind }) => ({
  order: id,
  appId,
  artifactKind,
}));
assert(
  JSON.stringify(runtimeTypedArtifacts) === JSON.stringify(workflowRuntime.typedArtifacts),
  "TypeScript workflow stages must match the 01-06 typed artifact contract exactly",
);
assert(workflowRuntime.artifactTypes?.envelope === "DeveloperWorkflowArtifactEnvelope", "workflow artifacts must use the typed envelope");
assert(workflowRuntime.artifactTypes?.payloadByStage === "DeveloperWorkflowArtifactPayloadByStage", "workflow artifacts must use the stage payload map");
assert(workflowRuntime.artifactTypes?.status === "DeveloperWorkflowStatus", "workflow artifacts must use the governed status type");
assert(JSON.stringify(workflowRuntime.artifactTypes?.statusValues) === JSON.stringify(["pending", "passed", "failed", "blocked", "stale"]), "workflow artifact status values must remain exact and ordered");

const nextTransition = workflowRuntime.nextTransition;
assert(nextTransition?.action === "next", "workflow transition action must be Next");
assert(nextTransition?.mode === "fail-closed", "Next must fail closed");
assert(nextTransition?.requiresCurrentArtifact === "fresh-passed", "Next must require a fresh passed current artifact");
assert(JSON.stringify(nextTransition?.blocksOn) === JSON.stringify(["missing", "pending", "failed", "blocked", "stale", "fingerprint-mismatch"]), "Next must block on every incomplete, failed or stale state");

const workflowFreshness = workflowRuntime.freshness;
assert(workflowFreshness?.onUpstreamChange === "mark-all-downstream-stale", "an upstream artifact change must stale every downstream artifact");
assert(JSON.stringify(workflowFreshness?.fingerprintFields) === JSON.stringify(["scopeIdentity", "targetManifestFingerprint", "sourceFingerprint", "contractVersion"]), "workflow freshness must cover scope, target, source and contract identity");
assert(workflowFreshness?.staleBlocksNext === true, "stale workflow evidence must block Next");

const qualityReleaseGate = workflowRuntime.qualityReleaseGate;
assert(qualityReleaseGate?.order === "06" && qualityReleaseGate?.appId === "quality-release", "quality release must remain workflow stage 06");
assert(JSON.stringify(qualityReleaseGate?.consumesFreshArtifactsFrom) === JSON.stringify(["01", "02", "03", "04", "05"]), "quality release must consume fresh evidence from every upstream stage");
assert(JSON.stringify(qualityReleaseGate?.consumesFreshArtifactsFrom) === JSON.stringify(workflowRuntime.typedArtifacts.slice(0, 5).map((item) => item.order)), "quality release dependencies must derive from typed upstream artifacts");
assert(qualityReleaseGate?.requiredStatus === "fresh-passed", "quality release upstream evidence must be fresh and passed");
assert(qualityReleaseGate?.missingOrStaleEvidence === "block-release", "quality release must block on missing or stale upstream evidence");

const workflowRuntimeSource = readText(workflowRuntime.modulePath);
const scopeOwnerSource = readText(scopeOwner.modulePath);
for (const token of [
  "DEVELOPER_WORKFLOW_RUN_SCHEMA_VERSION = 1",
  "DeveloperWorkflowArtifactEnvelope",
  "DeveloperWorkflowArtifactPayloadByStage",
  "DeveloperWorkflowStatus",
  'return `global:${encodeURIComponent(sourceScope)}`',
  'return `page:${encodeURIComponent(sourceScope)}:${encodeURIComponent(route)}`',
]) assert(workflowRuntimeSource.includes(token), `workflow runtime module is missing ${token}`);
assert(scopeOwnerSource.includes("export function DevelopmentStandardApplyConsole"), "the declared workflow scope owner component must exist in its module");
assert(scopeOwnerSource.includes('from "@/lib/developer-workflow-run"'), "the workflow scope owner must consume the declared runtime module");
assert(scopeOwnerSource.includes("workflowPageDna={workflowPageDna}"), "the workflow scope owner must pass its authoritative Page DNA to child applications");
assert(scopeOwnerSource.includes("runtimeTargetPageDna={workflowRuntimeTargetPageDna}"), "the workflow scope owner must pass the current runtime page identity to visual evidence");
for (const [name, source] of [["Figma", figmaWorkbenchSource], ["visual evidence", evidenceWorkbenchSource]]) {
  assert(source.includes("workflowPageDna: DeveloperPageDna"), `${name} must require parent-owned Page DNA`);
  assert(!source.includes("fallbackDesignScope"), `${name} must not own fallback workflow scope state`);
  assert(!source.includes("resolveDeveloperPageDna"), `${name} must not resolve a second workflow Page DNA`);
}
assert(integrationSource.includes("cachedGlobalDeveloperPageDna"), "global Page DNA must use a stable shared cache");
assert(integrationSource.includes("const pageById = new Map(PAGE_FACTORY_PAGES.map"), "global Page DNA must resolve registrations through one page-id index");
assert(integrationSource.includes("const page = resolution?.pageRegistration ?? null;"), "page DNA must reuse the canonical adapter resolution instead of rescanning Page Factory pages");
assert(integrationSource.includes("normalizePageFactoryRoute(pathname, search)") && !integrationSource.includes("function normalizeSearch"), "page DNA must reuse the canonical Page Factory query normalization");
for (const token of [
  "developerVisualEvidenceSampleIndexCache",
  "buildDeveloperVisualEvidenceSampleIndex",
  "samplesByTargetViewport",
  "latestByTargetIdentity",
  "cacheDeveloperVisualEvidenceSampleIndex(samples",
]) assert(integrationSource.includes(token), `visual evidence sample indexing is incomplete: ${token}`);
for (const token of [
  "VISUAL_EVIDENCE_SAMPLE_CACHE_LIMIT = 12",
  "visualEvidenceSampleCache",
  "pendingEvidenceWriteRef",
  "buildDeveloperVisualEvidenceSampleIndex(pageDna, rawEvidenceSamples)",
  "evidenceIndex.latestByTargetIdentity",
  "evidenceIndex.targetCoverage",
]) assert(evidenceWorkbenchSource.includes(token), `visual evidence workbench cache/index is incomplete: ${token}`);
assert(!evidenceWorkbenchSource.includes("evidenceSamples.filter(") && !evidenceWorkbenchSource.includes("evidenceSamples.some("), "visual evidence render path must not rescan every sample for every target and viewport");

const developerWorkflow = developerOptimization.apps.map(({ order, id, label }) => [order, id, label]);
const designWorkflow = design.workflow.map(({ order, appId, label }) => [order, appId, label]);
assert(
  JSON.stringify(developerWorkflow) === JSON.stringify(designWorkflow),
  "developer optimization application order, IDs and labels must match the design workflow",
);

assert(design.contractReferences?.pageDna === "page-dna-contract.json", "design integration must reference page DNA");
assert(design.contractReferences?.visualEvidence === "visual-evidence-contract.json", "design integration must reference visual evidence");
assert(developerOptimization.designContract === "design-integration-contract.json", "developer optimization must reference design integration");
assert(pageDna.contractReferences?.sharedOptimization === "developer-optimization-contract.json", "page DNA must reference shared optimization");
assert(pageDna.contractReferences?.designIntegration === "design-integration-contract.json", "page DNA must reference design integration");
assert(pageDna.contractReferences?.visualEvidence === "visual-evidence-contract.json", "page DNA must reference visual evidence");
assert(visualEvidence.contractReferences?.pageDna === "page-dna-contract.json", "visual evidence must reference page DNA");
assert(visualEvidence.contractReferences?.designIntegration === "design-integration-contract.json", "visual evidence must reference design integration");

assert(
  JSON.stringify(pageDna.identity?.requiredFields) === JSON.stringify(["sourceScope", "normalizedRoute"]),
  "page identity must be exactly sourceScope plus normalizedRoute",
);
assert(pageDna.identity?.keyFormat === "{sourceScope}:{normalizedRoute}", "page DNA must expose one stable identity key");
assert(pageDna.identity?.registry === design.pageDna?.registry, "page DNA and design integration must use one page registry");
assert(pageDna.identity?.normalizedRouteResolver?.includes("#normalizePageFactoryRoute"), "page DNA must reuse the Page Factory route resolver");
assert(pageDna.identity?.sourceScopeResolver?.includes("#resolvePageFactoryScope"), "page DNA must reuse the Page Factory scope resolver");

const expectedLoadIntents = ["critical", "post-paint", "viewport", "interaction", "background"];
assert(
  JSON.stringify(pageDna.loadIntents.map((item) => item.id)) === JSON.stringify(expectedLoadIntents),
  "page DNA must define all five load intents in order",
);
assert(
  JSON.stringify(design.loadPriorities.map((item) => item.id)) === JSON.stringify(expectedLoadIntents),
  "design loading priorities must match page DNA",
);
assert(design.componentMappings.every((item) => expectedLoadIntents.includes(item.defaultLoadPriority)), "all component mappings must use a governed load intent");
assert(pageDna.loadIntents.filter((item) => item.entersStartupWindow).every((item) => ["critical", "post-paint"].includes(item.id)), "only critical and post-paint work may enter the startup window");
assert(pageDna.snapshot?.requiredFields?.includes("loadPlan"), "page DNA must require a resolved load plan");
assert(
  developerOptimization.loadingSpeedLearning?.loadPlanProjection?.schemaVersion === 1
    && developerOptimization.loadingSpeedLearning.loadPlanProjection.pageOverridesOnly === true
    && developerOptimization.loadingSpeedLearning.loadPlanProjection.globalEmbedsPerPageUnits === false,
  "the shared loading-speed contract must own one compact global/page load-plan projection",
);
for (const token of [
  "DeveloperResolvedPageLoadPlan",
  "buildDeveloperResolvedPageLoadPlan",
  "collectDeveloperPageLoadPlanUnits",
  "DEVELOPER_ROUTE_COMPOSITION_CONTRACT",
  "loadPlan: DeveloperResolvedPageLoadPlan",
  "loadPlan: pageDna.loadPlan",
]) assert(integrationSource.includes(token), `runtime Page DNA load plan is incomplete: ${token}`);
for (const token of ["loadPlanPolicyVersion", "loadPlanProfileId", "loadPlanFingerprint"]) {
  assert(workflowRunSource.includes(token), `Stage 01 payload is missing ${token}`);
  assert(developerConsoleSource.includes(`${token}: workflowPageDna.loadPlan.`), `the workflow scope owner must write ${token}`);
}
assert(!developerConsoleSource.includes("onWorkflowArtifact={recordStage01}"), "the console must not delegate Stage 01 evidence ownership to the frame workbench");
assert(!unifiedFrameWorkbenchSource.includes("onWorkflowArtifact") && !unifiedFrameWorkbenchSource.includes("workflowTargetIds"), "01 workbench must keep only internal frame progress and must not submit a second Stage 01 artifact");

assert(design.figma?.syncPolicy?.figmaToContract === "reviewed-proposal-only", "Figma-to-contract sync must require review");
assert(design.figma?.syncPolicy?.figmaToSource === "never-direct", "Figma must never write source directly");
assert(design.figma?.syncPolicy?.sourceMutation === "github-pr-only", "source mutation must remain PR-only");
const storedMetadata = design.figma?.storedMetadata || [];
const forbiddenStorage = design.figma?.forbiddenStorage || [];
assert(!storedMetadata.some((field) => forbiddenStorage.includes(field)), "stored Figma metadata must not contain credentials");

const designSnapshotFields = design.snapshotRequirements?.designSnapshotRequiredFields || [];
const evidenceFingerprintFields = design.snapshotRequirements?.evidenceFingerprintFields || [];
const expectedFingerprintFields = ["identityKey", "pageDnaFingerprint", "designRevision", "sharedContractVersion", "sourceFingerprint", "targetManifestFingerprint", "targetCoverage", "samples"];
const expectedFreshnessFields = ["identityKey", "pageDnaFingerprint", "designRevision", "sharedContractVersion", "sourceFingerprint", "targetManifestFingerprint"];
assert(hasEvery(storedMetadata, ["fileKey", "nodeId", "revision", "capturedAt", "pageDnaFingerprint", "sharedContractVersion"]), "Figma metadata must carry stable design and page DNA identity");
assert(hasEvery(designSnapshotFields, ["fileKey", "nodeId", "revision", "capturedAt", "pageDnaFingerprint", "sharedContractVersion"]), "design snapshots must declare their required identity fields");
assert(JSON.stringify(evidenceFingerprintFields) === JSON.stringify(expectedFingerprintFields), "design evidence fingerprint fields must be complete and ordered");
assert(JSON.stringify(visualEvidence.evidenceRecord?.fingerprint?.requiredInputs) === JSON.stringify(expectedFingerprintFields), "visual evidence fingerprint inputs must match design integration");
assert(JSON.stringify(visualEvidence.freshness?.mustMatch) === JSON.stringify(expectedFreshnessFields), "freshness checks must cover stable page, design, source and target-manifest identity");
assert(pageDna.fingerprint?.algorithm === "sha256", "page DNA fingerprints must use sha256");
assert(visualEvidence.evidenceRecord?.fingerprint?.algorithm === "sha256", "visual evidence fingerprints must use sha256");

const expectedViewports = [["mobile", 390, 844], ["tablet", 768, 1024], ["desktop", 1440, 900]];
assert(
  JSON.stringify(visualEvidence.viewports.map(({ id, width, height }) => [id, width, height])) === JSON.stringify(expectedViewports),
  "visual evidence must cover the canonical phone, tablet and desktop viewports",
);
assert(
  !Object.hasOwn(design, "responsiveViewports")
    && JSON.stringify(Object.keys(design.responsiveViewportLabels || {})) === JSON.stringify(expectedViewports.map(([id]) => id))
    && Object.values(design.responsiveViewportLabels || {}).every((label) => typeof label === "string" && Boolean(label.trim())),
  "design integration must only own labels while visual evidence owns canonical viewport dimensions",
);
for (const token of [
  '@website-style/visual-evidence-contract.json',
  "DEVELOPER_VISUAL_EVIDENCE_VIEWPORTS",
  "visualEvidenceContract.viewports.map",
  "resolveDeveloperVisualEvidenceViewport",
  "sampleSchemaVersion: 3",
  "viewportHeight",
  "Math.abs(sample.viewportHeight - candidate.height) <= 2",
  "visualEvidenceContractVersion",
]) assert(integrationSource.includes(token), `runtime visual evidence viewport ownership is missing ${token}`);
for (const token of [
  'tradepro:developer-visual-evidence-samples:v2',
  "resolveDeveloperVisualEvidenceViewport(sample)",
  "sample.viewportWidth}x${sample.viewportHeight}",
  "{viewport.width}×{viewport.height}",
]) assert(evidenceWorkbenchSource.includes(token), `visual evidence workbench viewport handling is missing ${token}`);
assert(unique(visualEvidence.requiredEvidenceKinds), "visual evidence kinds must be unique");
assert(
  JSON.stringify(visualEvidence.requiredChecks.map((check) => check.id)) === JSON.stringify([
    "sample-binding",
    "semantic-regions",
    "component-mapping",
    "design-snapshot-freshness",
    "geometry-and-overflow",
    "responsive-matrix",
    "target-coverage",
    "media-policy",
    "impact-boundary",
  ]),
  "visual evidence checks must match the runtime sample binding, snapshot freshness and target coverage gates",
);
for (const token of ["pageDna.identityKey", "targetManifestFingerprint", "targetCoverage", "samples"]) {
  assert(integrationSource.includes(token), `runtime visual evidence fingerprint is missing ${token}`);
}
assert(JSON.stringify(visualEvidence.requiredEvidenceKinds) === JSON.stringify(design.visualEvidence), "design and runtime evidence kinds must stay aligned");
assert(hasEvery(visualEvidence.evidenceRecord?.statusValues || [], ["passed", "failed", "stale"]), "evidence records must represent pass, fail and stale states");
assert(visualEvidence.freshness?.onMismatch === "mark-stale-and-block-release", "fingerprint drift must make evidence stale and block release");
assert(visualEvidence.releaseGate?.mode === "fail-closed", "visual evidence release gate must fail closed");
assert(hasEvery(visualEvidence.releaseGate?.blocksOn || [], ["missing", "failed", "stale", "fingerprint-mismatch"]), "release must block on incomplete or stale evidence");
assert(visualEvidence.artifactPolicy?.persistCredentials === false, "visual artifacts must not persist credentials");
assert(visualEvidence.artifactPolicy?.persistBusinessData === false, "visual artifacts must not persist business data");

for (const token of [
  "computeDeveloperPageDnaFingerprint",
  'globalThis.crypto.subtle.digest("SHA-256"',
  "buildDeveloperVisualEvidenceRecord",
  "pageDna.sourceFingerprint",
  "viewportResults",
  "checkResults",
]) assert(integrationSource.includes(token), `runtime evidence implementation is missing ${token}`);
for (const token of [
  "data-page-dna-fingerprint",
  "design-visual-evidence.json",
  "buildDeveloperVisualEvidenceRecord",
  "导出证据 JSON",
]) assert(evidenceWorkbenchSource.includes(token), `visual evidence workbench is missing ${token}`);
assert(hqVersionSource.includes("HQ_SOURCE_FINGERPRINT"), "the lightweight runtime version module must expose the sealed source fingerprint");
assert(hqBumpSource.includes('replaceExport(softwareVersion, "HQ_SOURCE_FINGERPRINT", sourceFingerprint)'), "H finalization must refresh the runtime source fingerprint");
assert(hqVerifySource.includes('HQ_SOURCE_FINGERPRINT = \\"${manifest.sourceFingerprint}\\"'), "H verification must reject a stale runtime source fingerprint");

const forbiddenPagePayloads = pageDna.snapshot?.forbiddenPayloads || [];
assert(hasEvery(forbiddenPagePayloads, ["business-data", "tenant-content", "uploaded-assets", "credentials"]), "page DNA must exclude business, tenant, media and credential payloads");
assert(pageDna.lockBoundary?.receiptRequiredBeforeRelease === true, "page DNA must require a lock receipt");
assert(visualEvidence.releaseGate?.lockReceiptRequiredAfterRelease === true, "release evidence must require locks to be restored");

console.log("Design integration contract verified: eight applications, single page DNA, five load intents, canonical width-and-height viewports and fail-closed evidence fingerprints are aligned.");
