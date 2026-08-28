import { readFileSync } from "node:fs";

import { build } from "esbuild";

const read = (path) => readFileSync(path, "utf8");
const requireCondition = (condition, message) => {
  if (!condition) throw new Error(message);
};
const consoleSource = read("src/components/product-market/DevelopmentStandardApplyConsole.tsx");
const developerOptimizationSource = read("../shared/contracts/developer-optimization-contract.json");
const workbenchSource = read("src/components/developer-platform/UnifiedFrameMigrationWorkbench.tsx");
const workflowSessionSource = read("src/lib/unified-frame-workflow-session.ts");
const contractSource = read("src/lib/unified-page-frame-contract.ts");
const visualSource = read("src/components/product-market/VisualPageEditorDock.tsx");
const launcherSource = read("src/components/ExternalDevtoolsMenu.tsx");
const eventSource = read("src/lib/visual-page-editor-events.ts");
const authoringEvidenceSource = read("src/lib/developer-global-frame-authoring-evidence.ts");

const requireToken = (source, token, label) => {
  if (!source.includes(token)) throw new Error(`${label}：${token}`);
};

const developerEntrySource = `${consoleSource}\n${developerOptimizationSource}`;
for (const token of [
  '"id": "visual-frame"',
  '"id": "page-factory"',
  '"id": "page-lock"',
  "<UnifiedFrameMigrationWorkbench",
  "workflowScopeIdentity={workflowScopeIdentity}",
  "data-development-standard-page-factory-lifecycle",
  "data-developer-active-footer-summary",
  "data-development-standard-page-lock-tree",
  '"label": "全局框架器"',
]) requireToken(developerEntrySource, token, "统一开发器入口缺失");

for (const retired of ["GlobalStylerMigrationWizard", 'id: "global-flow"', "renderPreflightAdvanced"]) {
  if (consoleSource.includes(retired)) throw new Error(`旧全局开发流程仍在开发器运行路径中：${retired}`);
}

for (const token of [
  "data-unified-frame-migration-workbench",
  'data-unified-frame-release-mode={workflowScope === "global" ? "batch-gated" : "current-page-only"}',
  'data-unified-frame-business-boundary="preserve"',
  "data-unified-frame-baseline-gate",
  "data-unified-frame-batch-plan",
  "data-unified-frame-next-step",
  "data-global-frame-workbench",
  "data-global-frame-workflow-steps",
  "data-global-frame-impact-pages",
  "data-global-frame-isolation-list",
  "data-global-frame-recovery-point",
  "data-global-frame-validation-log",
  'initialApplicationScope: workflowScope === "global" ? "global" : "current-page"',
  'applicationScopeLock: workflowScope === "global" ? "global" : "current-page"',
  'workflowOrigin: workflowScope === "global" ? "global-frame-workbench" : undefined',
  "requestGlobalFrameWorkflowAction",
  "consumeGlobalFrameWorkflowStatusHandoff",
  "applyWorkflowStatus",
  '"preflight"',
  '"sync-passed-pages"',
  '"publish-three-end"',
  '"save-factory-default"',
  "inspectSharedContractHealth",
  "inspectDeveloperGlobalFrameAuthoringRuntimeEvidence",
  "inspectLocalRuntimeReadiness",
  "const passed = authoringEvidence.passed",
  "兼容诊断（不替代新版运行时门禁）",
]) requireToken(workbenchSource, token, "全局框架器工作台契约缺失");

for (const retired of ["factoryOpenRequest", "renderFactoryLifecycle", "data-global-frame-toggle-page-factory", "data-unified-frame-page-factory-read-only"]) {
  if (workbenchSource.includes(retired)) throw new Error(`01 全局框架器仍保留旧页面工厂嵌套入口：${retired}`);
}

for (const token of [
  "readUnifiedFrameWorkflow(window.sessionStorage, currentRoute, workflowScope, workflowScopeIdentity)",
  "getUnifiedFrameWorkflowStorageKey(workflowScopeIdentity, workflowScope)",
  "isUnifiedFrameWorkflowScopeState(workflow, workflowScopeIdentity, workflowScope)",
  'if (workflowScope !== "global") return;',
  'isUnifiedFrameWorkflowScopeState(current, workflowScopeIdentity, "global")',
]) requireToken(workbenchSource, token, "global/page scope isolation guard missing");

for (const token of [
  "PAGE_WORKFLOW_STEPS",
  "GLOBAL_WORKFLOW_STEPS",
  'stage: workflowScope === "global" ? "draft" : "visual"',
  'workflowScope === "global" ? <DeveloperGlobalFrameWorkflowCoordinatorBridge',
  'data-current-page-frame-boundary',
  'workflowScope === "global" ? <section data-global-frame-status-panels',
]) requireToken(workbenchSource, token, "current-page workflow boundary missing");

for (const token of [
  "scope: DeveloperWorkflowScope",
  "scopeIdentity: string",
  "tradepro:global-frame-workbench:v3",
  "parsed.scope !== scope",
  "parsed.scopeIdentity !== initial.scopeIdentity",
  "workflow.scopeIdentity === scopeIdentity.trim() && workflow.scope === scope",
  "UNIFIED_FRAME_PAGE_WORKFLOW_STAGES",
]) requireToken(workflowSessionSource, token, "global/page workflow session contract missing");

if (["v1", "v2"].some((version) => workbenchSource.includes(`tradepro:global-frame-workbench:${version}`)
  || workflowSessionSource.includes(`tradepro:global-frame-workbench:${version}`))) {
  throw new Error("Retired workflow session keys must not be read or migrated.");
}

if (workbenchSource.includes("const passed = structural.passed")) {
  throw new Error("当前页验收仍被旧的文档级静态检查永久阻塞");
}

for (const token of [
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
  "server-draft-config-hash",
]) requireToken(authoringEvidenceSource, token, "当前页新版运行时证据门禁缺失");

for (const forbidden of ["data-global-styler", "onApplyBatch", "data-unified-frame-publish-global"]) {
  if (workbenchSource.includes(forbidden)) throw new Error(`全局框架器工作台不得绕过唯一协调器直接发布：${forbidden}`);
}

for (const token of [
  "GLOBAL_FRAME_WORKFLOW_ACTION_EVENT",
  "GLOBAL_FRAME_WORKFLOW_STATUS_EVENT",
  "requestGlobalFrameWorkflowAction",
  "reportGlobalFrameWorkflowStatus",
  "GLOBAL_FRAME_WORKFLOW_STATUS_HANDOFF_SCHEMA_VERSION",
  "writeGlobalFrameWorkflowStatusHandoff",
  "consumeGlobalFrameWorkflowStatusHandoff",
]) requireToken(eventSource, token, "全局框架器与协调器的窄事件桥缺失");

for (const token of [
  'detail?.workflowOrigin === "global-frame-workbench"',
]) requireToken(launcherSource, token, "全局框架器打开可视化时必须保持开发器工作流挂载");

for (const token of [
  'data-global-frame-visual-handoff="draft-only"',
  "reportGlobalFrameWorkflowStatus",
  'action: "generate-draft"',
  "生成全局草稿",
  "尚未审核、发布或下发",
]) requireToken(visualSource, token, "可视化没有保持只生成待审全局草稿的边界");

const executable = await build({
  stdin: {
    contents: 'export * from "./src/lib/unified-frame-workflow-session.ts";',
    loader: "ts",
    resolveDir: process.cwd(),
    sourcefile: "unified-frame-workflow-session-verifier-entry.ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  logLevel: "silent",
});
const bundled = executable.outputFiles[0]?.text;
requireCondition(bundled, "cannot bundle unified frame workflow session contract");
const workflowSession = await import(`data:text/javascript;base64,${Buffer.from(bundled).toString("base64")}`);
const sessionValues = new Map();
const memoryStorage = {
  getItem: (key) => sessionValues.get(key) ?? null,
  setItem: (key, value) => sessionValues.set(key, value),
  removeItem: (key) => sessionValues.delete(key),
};
const route = "/zb/client-source/product-market?tab=operations";
const secondRoute = "/zb/client-source/social?tab=marketing-playbook";
const globalScopeIdentity = "global:global";
const pageScopeIdentity = "page:client_source:%2Fproduct-market%3Ftab%3Doperations";
const secondPageScopeIdentity = "page:client_source:%2Fsocial%3Ftab%3Dmarketing-playbook";
const globalKey = workflowSession.getUnifiedFrameWorkflowStorageKey(globalScopeIdentity, "global");
const pageKey = workflowSession.getUnifiedFrameWorkflowStorageKey(pageScopeIdentity, "page");
const secondPageKey = workflowSession.getUnifiedFrameWorkflowStorageKey(secondPageScopeIdentity, "page");
requireCondition(globalKey !== pageKey, "global/page workflow storage keys collided");
requireCondition(pageKey !== secondPageKey, "different page workflow identities collided");
const globalState = {
  ...workflowSession.createInitialUnifiedFrameWorkflow(route, "global", globalScopeIdentity),
  stage: "preflight",
  status: "passed",
  draftId: "global-draft-fixture",
};
const pageState = {
  ...workflowSession.createInitialUnifiedFrameWorkflow(route, "page", pageScopeIdentity),
  stage: "visual",
  status: "passed",
};
memoryStorage.setItem(globalKey, JSON.stringify(globalState));
memoryStorage.setItem(pageKey, JSON.stringify(pageState));
const restoredGlobal = workflowSession.readUnifiedFrameWorkflow(memoryStorage, secondRoute, "global", globalScopeIdentity);
const restoredPage = workflowSession.readUnifiedFrameWorkflow(memoryStorage, route, "page", pageScopeIdentity);
requireCondition(
  restoredGlobal.scope === "global"
    && restoredGlobal.scopeIdentity === globalScopeIdentity
    && restoredGlobal.route === secondRoute
    && restoredGlobal.stage === "preflight"
    && restoredGlobal.draftId === "global-draft-fixture",
  "global workflow state was not restored across current-page routes from its authoritative identity",
);
requireCondition(
  restoredPage.scope === "page"
    && restoredPage.stage === "visual"
    && !restoredPage.draftId,
  "page workflow state was contaminated by global state",
);
requireCondition(
  !workflowSession.isUnifiedFrameWorkflowScopeState(globalState, pageScopeIdentity, "page")
    && workflowSession.isUnifiedFrameWorkflowScopeState(globalState, globalScopeIdentity, "global"),
  "scope-switch persistence guard accepted stale state",
);
const freshSecondPage = workflowSession.readUnifiedFrameWorkflow(memoryStorage, secondRoute, "page", secondPageScopeIdentity);
requireCondition(
  freshSecondPage.scopeIdentity === secondPageScopeIdentity && freshSecondPage.stage === "inspect",
  "a page workflow leaked into a different canonical page identity",
);
memoryStorage.setItem(
  `tradepro:global-frame-workbench:v2:global:${encodeURIComponent(secondRoute)}`,
  JSON.stringify({ ...globalState, route: secondRoute }),
);
const restoredLegacy = workflowSession.readUnifiedFrameWorkflow(memoryStorage, secondRoute, "page", secondPageScopeIdentity);
requireCondition(
  restoredLegacy.scope === "page" && restoredLegacy.stage === "inspect" && !restoredLegacy.draftId,
  "legacy v2 route-scoped workflow state leaked into an identity-scoped session",
);
memoryStorage.setItem(globalKey, JSON.stringify({ ...globalState, scope: "page" }));
const rejectedCrossScope = workflowSession.readUnifiedFrameWorkflow(memoryStorage, route, "global", globalScopeIdentity);
requireCondition(
  rejectedCrossScope.scope === "global" && rejectedCrossScope.stage === "inspect" && !rejectedCrossScope.draftId,
  "tampered cross-scope workflow state did not fail closed",
);
memoryStorage.setItem(pageKey, JSON.stringify({
  ...workflowSession.createInitialUnifiedFrameWorkflow(route, "page", pageScopeIdentity),
  stage: "draft",
  status: "passed",
  draftId: "leaked-global-draft",
  releaseVersion: "H-leaked",
  recoveryPointId: "leaked-recovery",
  targets: { total: 201, passed: 201, isolated: 0 },
}));
const rejectedPageGlobalStage = workflowSession.readUnifiedFrameWorkflow(memoryStorage, route, "page", pageScopeIdentity);
requireCondition(
  rejectedPageGlobalStage.stage === "inspect"
    && rejectedPageGlobalStage.status === "idle"
    && !rejectedPageGlobalStage.draftId
    && !rejectedPageGlobalStage.releaseVersion
    && !rejectedPageGlobalStage.recoveryPointId
    && rejectedPageGlobalStage.targets.total === 0,
  "page workflow accepted a global-only stage or release metadata",
);
memoryStorage.setItem(pageKey, JSON.stringify({
  ...workflowSession.createInitialUnifiedFrameWorkflow(route, "page", pageScopeIdentity),
  stage: "visual",
  status: "waiting",
  draftId: "leaked-visual-draft",
}));
const sanitizedPageVisual = workflowSession.readUnifiedFrameWorkflow(memoryStorage, route, "page", pageScopeIdentity);
requireCondition(
  sanitizedPageVisual.stage === "visual"
    && sanitizedPageVisual.status === "idle"
    && !sanitizedPageVisual.draftId,
  "page visual session kept a global waiting state or draft metadata",
);

for (const token of [
  'UNIFIED_PAGE_FRAME_CONTRACT_VERSION = "2026.08.23.1"',
  'regionStrategy: "explicit"',
  "pageVerticalOwners: 1",
  "geometryToleranceCssPixels: 1",
  'horizontalMarkerPlacement: "left-frame-start"',
  "horizontalMarkerInsetCssPixels: 8",
  "compactContentIsOnlyPageScrollOwner: true",
  'mode: "batch-gated"',
  "globalButton: false",
  'failedPagePolicy: "isolate-and-keep-current-adapter"',
  'id: "operations"',
  'id: "modules"',
  'id: "layout"',
  'id: "service"',
  'id: "marketing-playbook"',
]) requireToken(contractSource, token, "统一页面框架契约缺失");

console.log("统一页面框架迁移工作台验证通过。");
