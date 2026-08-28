import fs from "node:fs";

import { build } from "esbuild";

const read = (path) => fs.readFileSync(path, "utf8");
const requireCondition = (condition, message) => {
  if (!condition) throw new Error(message);
};
const requireTokens = (source, tokens, label) => {
  for (const token of tokens) requireCondition(source.includes(token), `${label}: missing ${token}`);
};
const forbidTokens = (source, tokens, label) => {
  for (const token of tokens) requireCondition(!source.includes(token), `${label}: retired token ${token}`);
};

const workbenchSource = read("src/components/developer-platform/UnifiedFrameMigrationWorkbench.tsx");
const consoleSource = read("src/components/product-market/DevelopmentStandardApplyConsole.tsx");
const launcherSource = read("src/components/ExternalDevtoolsMenu.tsx");
const visualSource = read("src/components/product-market/VisualPageEditorDock.tsx");
const eventsSource = read("src/lib/visual-page-editor-events.ts");
const authoringEvidenceSource = read("src/lib/developer-global-frame-authoring-evidence.ts");
const draftSource = read("src/lib/developer-global-frame-draft.ts");
const coordinatorSource = read("src/lib/developer-global-frame-release-coordinator.ts");
const adapterResolutionSource = read("src/lib/developer-global-frame-adapter-resolution.ts");

requireTokens(workbenchSource, [
  "const WORKFLOW_STEPS",
  'stage: "inspect"',
  'stage: "visual"',
  'stage: "draft"',
  'stage: "preflight"',
  'stage: "sync"',
  'stage: "publish"',
  'stage: "factory-default"',
  "data-unified-frame-migration-workbench",
  'data-unified-frame-release-mode="batch-gated"',
  'data-unified-frame-business-boundary="preserve"',
  "data-global-frame-workflow-steps",
  "data-global-frame-impact-pages",
  "data-global-frame-isolation-list",
  "data-global-frame-recovery-point",
  "data-global-frame-validation-log",
  'applicationScopeLock: "global"',
  'workflowOrigin: "global-frame-workbench"',
  "requestGlobalFrameWorkflowAction",
  '"preflight"',
  '"sync-passed-pages"',
  '"publish-three-end"',
  '"save-factory-default"',
  "inspectDeveloperGlobalFrameAuthoringRuntimeEvidence",
  "inspectLocalRuntimeReadiness",
  "const passed = authoringEvidence.passed",
], "UnifiedFrameMigrationWorkbench");
forbidTokens(workbenchSource, ["GlobalStylerMigrationWizard", 'id: "global-flow"', "data-global-styler", "onApplyBatch", "data-unified-frame-publish-global"], "现行七阶段工作台");
forbidTokens(consoleSource, ["source-registration", "source-eligibility", "DevelopmentStandardApplyConsole Step5", "GLOBAL_STYLER_PREFLIGHT_BLOCKING_CHECK_IDS"], "开发器入口");

requireTokens(eventsSource, [
  "GLOBAL_FRAME_WORKFLOW_ACTION_EVENT",
  "GLOBAL_FRAME_WORKFLOW_STATUS_EVENT",
  "requestGlobalFrameWorkflowAction",
  "reportGlobalFrameWorkflowStatus",
], "workflow event bridge");
requireTokens(launcherSource, ['detail?.workflowOrigin === "global-frame-workbench"'], "developer/visual handoff");
requireTokens(visualSource, [
  'data-global-frame-visual-handoff="draft-only"',
  'data-global-frame-draft-action={globalFrameWorkflow ? "generate"',
  "reportGlobalFrameWorkflowStatus",
  'action: "generate-draft"',
], "visual draft boundary");

requireTokens(authoringEvidenceSource, [
  "DEVELOPER_GLOBAL_FRAME_AUTHORING_EVIDENCE_VERSION",
  "resolveDeveloperGlobalFrameAdapterForRoute",
  '"authoring-responsive-host-v1"',
  '"authoring-content-ready-v1"',
  '"authoring-shared-contracts-v1"',
  '"authoring-workspace-boundary-v1"',
  '"authoring-scroll-owner-v1"',
  '"authoring-subject-hit-area-v1"',
  '"authoring-published-evidence-v1"',
  "data-responsive-content-ready=true",
], "authoring runtime evidence");
requireTokens(draftSource, [
  "buildDeveloperGlobalFramePreparedHandoff",
  "markDeveloperGlobalFrameHandoffSaved",
  "writeDeveloperGlobalFramePreparedHandoff",
  "readDeveloperGlobalFramePreparedHandoff",
  "validateDeveloperGlobalFrameHandoffServerDraft",
  "DEVELOPER_GLOBAL_FRAME_PREPARED_HANDOFF_MAX_AGE_MS",
  "status: \"source-draft-saved\"",
  "write_scope: \"draft-only\"",
  "publish_performed: false",
  "batch_created: false",
], "exact authoring envelope");

requireTokens(coordinatorSource, [
  "mergeDeveloperGlobalFrameDraftWithPreflightEvidence",
  "durablePreflightEvidence",
  "requestPublication",
  "requiredReviewSteps",
  "assertRolloutEvidenceMatchesState",
  "rollout-complete",
  "buildDeveloperGlobalFrameFactoryDefaultReceipt",
  "validateDeveloperGlobalFrameFactoryDefaultReceipt",
  "recordDeveloperGlobalFrameFactoryDefaultReceipt",
  "factory-default receipt requires a reviewed server publication and completed rollout",
], "release coordinator");
requireTokens(adapterResolutionSource, [
  "DEVELOPER_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS",
  "isDeveloperGlobalFrameIntentionalIsolationPageId",
  "DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS",
], "formal target isolation policy");

const executable = await build({
  stdin: {
    contents: [
      'export * from "./src/lib/developer-global-frame-draft.ts";',
      'export * from "./src/lib/developer-global-frame-adapter-resolution.ts";',
      'export * from "./src/lib/developer-global-style-contract.ts";',
    ].join("\n"),
    loader: "ts",
    resolveDir: process.cwd(),
    sourcefile: "developer-global-frame-verifier-entry.ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  logLevel: "silent",
});
const bundled = executable.outputFiles[0]?.text;
requireCondition(bundled, "cannot bundle developer_global_frame contract");
const contract = await import(`data:text/javascript;base64,${Buffer.from(bundled).toString("base64")}`);

const targetCount = contract.DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS.length;
const isolatedIds = [...contract.DEVELOPER_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS];
const compatibleIds = contract.DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS
  .map((entry) => entry.pageFactoryId)
  .filter((pageId) => !isolatedIds.includes(pageId));
requireCondition(targetCount === 201, `target graph must resolve 201 pages, received ${targetCount}`);
requireCondition(compatibleIds.length === 196, `target graph must resolve 196 compatible pages, received ${compatibleIds.length}`);
requireCondition(isolatedIds.length === 5, `target graph must retain 5 intentional isolated routes, received ${isolatedIds.length}`);

const now = new Date().toISOString();
const canaryDraft = {
  contractVersion: contract.DEVELOPER_GLOBAL_STYLE_CONTRACT_VERSION,
  id: "canary-profile-fixture",
  mode: "canary-profile",
  workspaceScope: "client_source",
  pathname: "/zb/client-source/social",
  search: "?tab=marketing-playbook",
  appearance: {
    frameInsets: { top: 12, right: 12, bottom: 60, left: 12 },
    componentStyles: {
      workspace: { annotation: { visibility: "always" }, spacing: { gapPx: 12 } },
      "table-shell": { annotation: { visibility: "always" }, spacing: { padding: { right: 12 } } },
    },
    sharedStylePatch: { layoutStyle: {}, globalTypography: {} },
  },
  visualAuditId: "audit-fixture",
  recoveryPointId: "restore-fixture",
  baselineOnly: true,
  savedAt: now,
};
let section;
try {
  section = contract.buildDeveloperGlobalFrameSection({
    profileVersion: "1.0.0",
    sourceScope: "client_source",
    canaryDraft,
    recoveryDraftId: "draft-fixture",
    pilotVerificationId: "pilot-fixture",
    pilotVerifiedAt: now,
    pilotChecks: contract.DEVELOPER_GLOBAL_STYLE_PILOT_CHECK_IDS,
    compatibleTargetPageIds: compatibleIds,
  });
} catch (error) {
  throw new Error(`section construction failed: ${error instanceof Error ? error.message : String(error)}`);
}
const validation = contract.validateDeveloperGlobalFrameSection(section);
requireCondition(validation.valid, `section validation failed: ${validation.issues.join("; ")}`);
requireCondition(section.adapters.length === 201 && section.target_matrix.length === 201, "section must persist the complete target graph");
requireCondition(section.target_matrix.filter((target) => target.compatibility === "compatible").length === 196, "section must mark 196 pages compatible");
requireCondition(section.target_matrix.filter((target) => target.compatibility === "isolated").length === 5, "section must mark 5 technical routes isolated");
requireCondition(section.scope === "appearance-only", "section must preserve appearance-only ownership");
requireCondition(JSON.stringify(section.regions) === JSON.stringify(contract.DEVELOPER_GLOBAL_FRAME_REGIONS), "canonical regions changed");

const handoff = contract.buildDeveloperGlobalFramePreparedHandoff(section, canaryDraft.id, now);
const savedHandoff = contract.markDeveloperGlobalFrameHandoffSaved(handoff, {
  draft_config_hash: "a".repeat(64),
  preserved_sibling_keys: ["layout", "modules"],
  write_scope: "draft-only",
  publish_performed: false,
  batch_created: false,
}, now);
const values = new Map();
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
requireCondition(contract.writeDeveloperGlobalFramePreparedHandoff(storage, savedHandoff), "exact saved envelope was not persisted");
const restored = contract.readDeveloperGlobalFramePreparedHandoff(storage, "client_source", Date.parse(now) + 1_000);
requireCondition(restored?.id === savedHandoff.id && restored?.draftConfigHash === "a".repeat(64), "exact fresh envelope was not restored");
const serverDraft = {
  template_id: contract.DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
  owner_scope: "client_source",
  draft_config_hash: savedHandoff.draftConfigHash,
  draft_config_json: { developer_global_frame: structuredClone(section), layout: { title: "preserved sibling" } },
};
requireCondition(contract.validateDeveloperGlobalFrameHandoffServerDraft(savedHandoff, serverDraft).valid, "matching atomic server draft was rejected");
requireCondition(!contract.validateDeveloperGlobalFrameHandoffServerDraft(savedHandoff, { ...serverDraft, draft_config_hash: "b".repeat(64) }).valid, "draft hash drift did not fail closed");
const tamperedServerDraft = structuredClone(serverDraft);
tamperedServerDraft.draft_config_json.developer_global_frame.region_tokens.workspace.background_color = "red;display:none";
requireCondition(!contract.validateDeveloperGlobalFrameHandoffServerDraft(savedHandoff, tamperedServerDraft).valid, "section drift did not fail closed");
values.set(contract.buildDeveloperGlobalFramePreparedHandoffStorageKey("client_source"), JSON.stringify({ ...savedHandoff, draftConfigHash: "not-a-sha256" }));
requireCondition(contract.readDeveloperGlobalFramePreparedHandoff(storage, "client_source", Date.parse(now) + 1_000) === null, "tampered envelope did not fail closed");
requireCondition(values.size === 0, "invalid envelope was not removed");

console.log(`developer_global_frame 现行主链契约通过：7 阶段；${targetCount}/201 targets；196 compatible + ${isolatedIds.length} isolated；精确 authoring envelope、原子 hash、二审/rollout/recovery fail-closed。`);
