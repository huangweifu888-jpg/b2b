import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const frontendRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(frontendRoot, "..");
const readFrontend = (path) => readFileSync(resolve(frontendRoot, path), "utf8");
const readRepository = (path) => readFileSync(resolve(repositoryRoot, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(`性能治理工作台契约失败：${message}`);
};

const sharedContractSource = readRepository("shared/contracts/developer-optimization-contract.json");
const sharedContract = JSON.parse(sharedContractSource);
const mediaContract = JSON.parse(readRepository("shared/contracts/media-optimization-contract.json"));
const consoleSource = readFrontend("src/components/product-market/DevelopmentStandardApplyConsole.tsx");
const pageLayoutLockSource = readFrontend("src/lib/page-layout-lock.ts");
const pageFooterLockControlsSource = readFrontend("src/components/PageFooterLockControls.tsx");
const visualPageEditorEventsSource = readFrontend("src/lib/visual-page-editor-events.ts");
const globalFrameCoordinatorBridgeSource = readFrontend("src/components/developer-platform/DeveloperGlobalFrameWorkflowCoordinatorBridge.tsx");
const unifiedFrameWorkbenchSource = readFrontend("src/components/developer-platform/UnifiedFrameMigrationWorkbench.tsx");
const contractAdapterSource = readFrontend("src/lib/developer-optimization-contract.ts");
const runtimeSource = readFrontend("src/components/product-market/PerformanceExperienceWorkbench.tsx");
const performanceLearningSource = readFrontend("src/lib/performance-experience-learning.ts");
const sharedWorkbenchSource = readFrontend("src/components/product-market/DeveloperSharedContractWorkbench.tsx");
const sharedContractHealthSource = readFrontend("src/lib/shared-contract-health.ts");
const qualityWorkbenchSource = readFrontend("src/components/product-market/PerformanceQualityReleaseWorkbench.tsx");
const figmaWorkbenchSource = readFrontend("src/components/product-market/DeveloperFigmaDesignWorkbench.tsx");
const visualEvidenceWorkbenchSource = readFrontend("src/components/product-market/DeveloperVisualEvidenceWorkbench.tsx");
const developerDesignIntegrationSource = readFrontend("src/lib/developer-design-integration.ts");
const developerWorkflowRunSource = readFrontend("src/lib/developer-workflow-run.ts");
const developerWorkflowRunTestSource = readFrontend("src/lib/developer-workflow-run.test.ts");
const operationsStage05SummarySource = readFrontend("scripts/build-product-market-operations-stage05-summary.mjs");
const operationsStage05SummaryTestSource = readFrontend("scripts/build-product-market-operations-stage05-summary.test.mjs");
const developerGlobalWorkflowEvidenceSource = readFrontend("src/lib/developer-global-workflow-evidence.ts");
const developerPrEvidenceSource = readFrontend("src/lib/developer-pr-evidence.ts");
const developerTargetManifestSource = readFrontend("src/lib/developer-workflow-target-manifest.mjs");
const targetManifestExporterSource = readFrontend("scripts/export-developer-target-manifest.mjs");
const targetManifestParityLauncherSource = readFrontend("scripts/verify-developer-target-manifest-parity.mjs");
const targetManifestParityVerifierSource = readRepository("tools/verify_developer_target_manifest_parity.py");
const deferredShellSource = readFrontend("src/components/DeferredShellUtilities.tsx");
const postPaintSource = readFrontend("src/lib/post-paint-lazy.ts");
const dashboardSource = readFrontend("src/pages/Index.tsx");
const accountSource = readFrontend("src/pages/Account.tsx");
const seoSource = readFrontend("src/pages/SEO.tsx");
const companyInfoSource = readFrontend("src/pages/CompanyInfo.tsx");
const reportsSource = readFrontend("src/pages/Reports.tsx");
const productAnalysisSource = readFrontend("src/pages/ProductAnalysis.tsx");
const socialMediaSource = readFrontend("src/pages/SocialMedia.tsx");
const productMarketSource = readFrontend("src/pages/ProductMarket.tsx");
const aiBuilderRouteScopeSource = readFrontend("src/lib/ai-builder-route-scope.ts");
const aiBuilderScopeSource = readFrontend("src/lib/ai-builder-scope.ts");
const developmentGuideSource = readFrontend("src/components/product-market/ProductMarketDevelopmentGuidePanel.tsx");
const auditClientSource = readFrontend("src/lib/performance-code-audit.ts");
const pageFactorySource = readFrontend("src/page-factory/page-factory.ts");
const bundleBudgetSource = readFrontend("scripts/verify-bundle-budgets.mjs");
const productionBuildSource = readFrontend("scripts/build-development-standard.mjs");
const developmentStandardGateSource = readFrontend("scripts/run-development-standard-gates.mjs");
const responsiveLearningSource = readFrontend("src/lib/responsive-shell-learning.ts");
const sharedVisualParitySource = readFrontend("src/lib/shared-visual-parity-contract.ts");
const globalCssSource = readFrontend("src/index.css");
const registeredResponsiveAuditTargetsSource = readFrontend("e2e/registered-responsive-audit-targets.mjs");
const globalResponsivePagesSource = readFrontend("e2e/global-responsive-pages.spec.ts");
const sharedVisualParityE2eSource = readFrontend("e2e/shared-visual-parity.spec.ts");
const globalResponsiveVerifierSource = readFrontend("scripts/verify-global-responsive-page-contract.mjs");
const sharedVisualParityVerifierSource = readFrontend("scripts/verify-shared-visual-parity-contract.mjs");
const backendSource = readRepository("backend/routers/local_dev.py");
const viteSource = readFrontend("vite.config.ts");
const packageJson = JSON.parse(readFrontend("package.json"));
const knipConfig = JSON.parse(readFrontend("knip.json"));
const workflowSource = readRepository(".github/workflows/verify.yml");
const sourceLockManifest = JSON.parse(readRepository("shared/contracts/developer-governance-source-lock-manifest.json"));

const expectedSourceLockGroups = [
  "contracts",
  "applicationWorkbenches",
  "runtimeAdapters",
  "qualityAndReleaseEvidence",
  "sourceLockInfrastructure",
];
assert(sourceLockManifest.schemaVersion === 1, "01-06 source-lock manifest must use schema version 1");
assert(JSON.stringify(Object.keys(sourceLockManifest.groups || {})) === JSON.stringify(expectedSourceLockGroups), "01-06 source-lock manifest groups must remain complete and ordered");
const developerGovernancePaths = Object.values(sourceLockManifest.groups).flat();
assert(new Set(developerGovernancePaths).size === developerGovernancePaths.length, "01-06 source-lock manifest paths must be unique");
for (const path of developerGovernancePaths) {
  assert(typeof path === "string" && existsSync(resolve(repositoryRoot, path)), `01-06 source-lock target is missing: ${path}`);
}
for (const path of [
  "shared/contracts/developer-optimization-contract.json",
  "shared/contracts/design-integration-contract.json",
  "shared/contracts/page-dna-contract.json",
  "shared/contracts/visual-evidence-contract.json",
  "shared/contracts/media-optimization-contract.json",
  "frontend/src/components/product-market/DeveloperSharedContractWorkbench.tsx",
  "frontend/src/components/product-market/PerformanceExperienceWorkbench.tsx",
  "frontend/src/components/product-market/PerformanceQualityReleaseWorkbench.tsx",
  "frontend/src/lib/developer-workflow-run.ts",
  "frontend/src/lib/developer-workflow-run.test.ts",
  "frontend/src/lib/developer-workflow-target-manifest.mjs",
  "frontend/src/lib/developer-global-workflow-evidence.ts",
  "frontend/src/lib/developer-global-workflow-evidence.test.ts",
  "frontend/src/lib/developer-pr-evidence.ts",
  "frontend/src/lib/developer-pr-evidence.test.ts",
  "frontend/src/lib/performance-code-audit.ts",
  "frontend/src/lib/performance-code-audit.test.ts",
  "frontend/src/lib/unified-frame-workflow-session.ts",
  "frontend/src/components/ResponsivePageHostRuntime.tsx",
  "frontend/src/components/ResponsiveSemanticPageTools.tsx",
  "frontend/src/components/SharedPageWorkspace.tsx",
  "frontend/src/components/VisualResponsiveContract.tsx",
  "frontend/src/lib/responsive-shell-learning.ts",
  "frontend/src/lib/shared-card-region-contract.ts",
  "frontend/src/lib/shared-visual-parity-contract.ts",
  "frontend/src/index.css",
  "frontend/scripts/verify-developer-workflow-run.mjs",
  "frontend/scripts/export-developer-target-manifest.mjs",
  "frontend/scripts/verify-developer-target-manifest-parity.mjs",
  "frontend/scripts/verify-unified-frame-migration-workbench.mjs",
  "frontend/scripts/verify-bundle-budgets.mjs",
  "frontend/scripts/verify-global-responsive-page-contract.mjs",
  "frontend/scripts/verify-shared-visual-parity-contract.mjs",
  "frontend/e2e/registered-responsive-audit-targets.mjs",
  "frontend/e2e/global-responsive-pages.spec.ts",
  "frontend/e2e/shared-visual-parity.spec.ts",
  "backend/routers/local_dev.py",
  "backend/tests/test_local_dev_performance_audit.py",
  "tools/verify_developer_target_manifest_parity.py",
]) assert(developerGovernancePaths.includes(path), `01-06 source-lock manifest is missing ${path}`);
assert(developerGovernancePaths.includes("shared/contracts/developer-governance-source-lock-manifest.json"), "the 01-06 source-lock manifest must protect itself");
for (const token of [
  "ELIGIBLE_PAGE_STATUSES",
  "RESPONSIVE_AUDIT_INTENTIONAL_ISOLATION_PAGE_IDS",
  "registeredResponsiveSourceTemplateKey",
  "selectRegisteredResponsiveAuditPages",
  "selectRegisteredResponsiveSemanticPages",
]) assert(registeredResponsiveAuditTargetsSource.includes(token), `registry-driven responsive audit target selection is missing ${token}`);
for (const token of [
  "../e2e/registered-responsive-audit-targets.mjs",
  "src/page-factory/page-registry.json",
  "expectedCombinationKeys",
  "selectRegisteredResponsiveSemanticPages",
]) assert(globalResponsiveVerifierSource.includes(token), `global responsive verification is missing registry-derived coverage ${token}`);
for (const token of [
  "./registered-responsive-audit-targets.mjs",
  "representativePages",
  "semanticPages",
]) assert(globalResponsivePagesSource.includes(token), `global responsive browser evidence is missing ${token}`);
for (const token of [
  "findExistingWorkspaceBodyMarkerHost",
  "availableToolTriggerIds.has(id)",
  "visualCardAnnotationVisibility",
  "developerGlobalFrameAnnotationVisible",
]) assert(responsiveLearningSource.includes(token), `responsive learning governance is missing ${token}`);
for (const token of [
  "resolveVisibleTableHeaderEdgeCells",
  "tableHeaderEdges.first",
  "tableHeaderEdges.last",
]) assert(sharedVisualParitySource.includes(token), `shared native table-header parity is missing ${token}`);
assert(globalCssSource.includes('thead[data-responsive-shared-surface="table-header"]'), "shared native table-header CSS must style the visible edge cells");
for (const token of [
  "visibleTableHeaderEdgeCells",
  "table-header visible edge cells missing",
  "table-header outer corners",
]) assert(sharedVisualParityE2eSource.includes(token), `shared native table-header browser evidence is missing ${token}`);
for (const token of [
  "resolveVisibleTableHeaderEdgeCells",
  "Native table-header edge-cell CSS",
  "Native table-header edge-cell regression",
]) assert(sharedVisualParityVerifierSource.includes(token), `shared visual parity verifier is missing ${token}`);
for (const token of [
  "SOURCE_PAGE_LOCK_DEVELOPER_GOVERNANCE_MANIFEST_PATH",
  "_load_source_page_lock_developer_governance_paths",
  "*SOURCE_PAGE_LOCK_DEVELOPER_GOVERNANCE_PATHS",
]) assert(backendSource.includes(token), `backend source-lock derivation is missing ${token}`);

const sourceLockCoreMatch = backendSource.match(
  /SOURCE_PAGE_LOCK_CORE_PATHS = \[([\s\S]*?)\r?\n\]/,
);
assert(sourceLockCoreMatch, "SOURCE_PAGE_LOCK_CORE_PATHS must remain a separately auditable lock manifest");
const sourceLockCoreSource = sourceLockCoreMatch[1];
for (const token of [
  '"frontend/src/pages/ProductMarket.tsx"',
  '"frontend/src/index.css"',
]) {
  assert(sourceLockCoreSource.includes(token), `Product Market core source-lock manifest is missing ${token}`);
}

const sourceLockPathsMatch = backendSource.match(/SOURCE_PAGE_LOCK_PATHS = \{([\s\S]*?)\r?\n\}/);
assert(sourceLockPathsMatch, "SOURCE_PAGE_LOCK_PATHS must remain a separately auditable lock mapping");
const sourceLockProductMarketPathsMatch = backendSource.match(/SOURCE_PAGE_LOCK_PRODUCT_MARKET_PATHS = _unique_source_page_lock_paths\(\[([\s\S]*?)\]\)/);
assert(sourceLockProductMarketPathsMatch, "Product Market source-lock paths must use the shared ordered-deduplication boundary");
assert(
  sourceLockProductMarketPathsMatch[1].includes("*SOURCE_PAGE_LOCK_CORE_PATHS")
    && sourceLockProductMarketPathsMatch[1].includes("*SOURCE_PAGE_LOCK_SHARED_DEPENDENCIES")
    && sourceLockPathsMatch[1].includes('"tool:product-market:group": SOURCE_PAGE_LOCK_PRODUCT_MARKET_PATHS,'),
  "The Product Market group lock must cover both core paths and shared lock dependencies",
);

const expectedAppIds = [
  "visual-frame",
  "shared-contract",
  "figma-ui",
  "visual-evidence",
  "performance-experience",
  "quality-release",
  "page-factory",
  "page-lock",
];
assert(JSON.stringify(sharedContract.apps.map((item) => item.id)) === JSON.stringify(expectedAppIds), "八个应用必须按统一顺序排列，页面工厂为 07、页面锁定器必须最后");
assert(sharedContract.apps.find((item) => item.id === "page-factory")?.order === "07", "页面工厂必须位于 06 后并使用 07 序号");
assert(sharedContract.apps.at(-1)?.id === "page-lock" && sharedContract.apps.at(-1)?.order === "08", "页面锁定器必须位于最后并使用 08 序号");
assert(sharedContract.version === "2026.08.28.7", "开发器优化契约必须记录 08 单次锁快照、批量单次提交与唯一悬浮说明入口");
const loadingSpeedLearning = sharedContract.loadingSpeedLearning;
const loadingSpeedRuleIds = loadingSpeedLearning?.rules?.map((rule) => rule.id) || [];
const loadingSpeedApplicationPlans = loadingSpeedLearning?.applicationPlans || [];
assert(
  loadingSpeedLearning?.version === "2026.08.28.2"
    && loadingSpeedLearning?.singleSource === true
    && loadingSpeedLearning?.automaticSourceRewrite === false
    && loadingSpeedLearning?.owner === "performance-experience-learning",
  "加载速度学习必须由 05 拥有一份只读规则源，禁止自动重写源码",
);
assert(loadingSpeedRuleIds.length === 10 && new Set(loadingSpeedRuleIds).size === loadingSpeedRuleIds.length, "加载速度共享规则必须完整且 ID 唯一");
assert(JSON.stringify(loadingSpeedApplicationPlans.map((plan) => plan.appId)) === JSON.stringify(expectedAppIds), "加载速度学习必须按 01–08 应用顺序完整投影");
for (const plan of loadingSpeedApplicationPlans) {
  assert(plan.ruleIds.length > 0 && plan.ruleIds.every((ruleId) => loadingSpeedRuleIds.includes(ruleId)), `${plan.appId} 引用了不存在的加载速度规则`);
  assert(plan.checks.length >= 3 && plan.output.trim() && plan.boundary.trim() && plan.responsibility.trim(), `${plan.appId} 缺少责任、检查、产出或保护边界`);
}
for (const rule of loadingSpeedLearning.rules) {
  for (const patternId of rule.evidencePatternIds) {
    assert(performanceLearningSource.includes(`id: "${patternId}"`), `加载速度规则 ${rule.id} 引用了不存在的历史证据模式 ${patternId}`);
  }
}
assert(
  loadingSpeedLearning.comparisonProtocol?.quick?.coldRuns === 2
    && loadingSpeedLearning.comparisonProtocol?.quick?.repeatRuns === 2
    && JSON.stringify(loadingSpeedLearning.comparisonProtocol?.quick?.viewports) === JSON.stringify([390, 768, 1440])
    && loadingSpeedLearning.comparisonProtocol?.quick?.releaseEvidence === false
    && loadingSpeedLearning.comparisonProtocol?.release?.coldRuns === 7
    && loadingSpeedLearning.comparisonProtocol?.release?.repeatRuns === 7
    && loadingSpeedLearning.comparisonProtocol?.release?.releaseEvidence === true
    && loadingSpeedLearning.comparisonProtocol?.requireSamePageDna === true
    && loadingSpeedLearning.comparisonProtocol?.requireFunctionalParity === true,
  "加载速度学习必须固定快检 2+2、发布级 7+7、三视口与功能等价协议",
);
assert(
  sharedContract.pageLockRuntime?.stateProjection === "single-readonly-snapshot-per-revision"
    && JSON.stringify(sharedContract.pageLockRuntime.storageRecordsPerSnapshot) === JSON.stringify(["structure", "page", "source", "parents"])
    && sharedContract.pageLockRuntime.maxStorageReadsPerRevision === 4
    && sharedContract.pageLockRuntime.memoizeInheritedResolution === true
    && sharedContract.pageLockRuntime.hoverGuideOwner === "title-source-page-column-actions-only"
    && sharedContract.pageLockRuntime.duplicateTreeAndFooterHoverGuides === false
    && sharedContract.pageLockRuntime.duplicateSelectionAndCustomLockGuides === false
    && sharedContract.pageLockRuntime.batchStateCommit === "single-lock-tree-and-registry-refresh-after-operation"
    && sharedContract.pageLockRuntime.writeAndServerRegistrySemantics === "unchanged",
  "08 页面锁必须按 revision 共用四记录只读快照、批量操作后单次提交状态，且锁说明只归标题三把锁按钮",
);
for (const token of ["readCompletedLayoutLockSnapshot", "structureEffectiveCache", "pageEffectiveCache", "sourceEffectiveCache"]) {
  assert(pageLayoutLockSource.includes(token), `08 页面锁单次快照实现缺少 ${token}`);
}
assert(consoleSource.includes('data-development-standard-lock-guide-owner="title"') && consoleSource.includes("title={rule.guide}"), "标题源码锁／页面锁／栏目锁缺少唯一悬浮说明");
assert(!consoleSource.includes("data-development-standard-lock-action-guide") && !consoleSource.includes("data-lock-guide="), "页面锁定器仍保留重复悬浮说明状态或浮层");
assert(!consoleSource.includes('title={`表头：') && consoleSource.includes("data-development-standard-custom-lock-kind={rule.kind}") && !consoleSource.includes("<span className=\"ml-1 text-slate-300\">{rule.description}</span>"), "应用选中胶囊或自定义锁种仍重复显示锁说明");
for (const token of ["pendingLockRefreshRef", "flushPendingLockTreeRefresh();", "let latestSourceRegistry", "setSourceLockRegistry(latestSourceRegistry)"]) {
  assert(consoleSource.includes(token), `08 批量锁状态未合并为操作后单次提交：${token}`);
}
assert(!pageFooterLockControlsSource.includes("title={locked"), "尾栏锁按钮仍重复显示锁说明");
assert(sharedContract.ownership === "shared-first" && sharedContract.automaticSourceRewrite === false, "优化必须共享优先且禁止自动重写源码");
assert(new Set(sharedContract.budgets.map((item) => item.id)).size === sharedContract.budgets.length, "共享预算 ID 必须唯一");
assert(sharedContract.budgets.every((item) => Number.isFinite(item.warning) && item.warning >= 0 && Number.isFinite(item.limit) && item.warning < item.limit && typeof item.unit === "string" && item.unit.trim()), "每项共享预算必须拥有有效单位，且警戒值必须小于上限");
assert(sharedContract.budgets.some((item) => item.id === "post-paint-script"), "首帧后自动加载必须拥有独立脚本预算");
assert(!sharedContract.budgets.some((item) => ["image-transfer", "video-transfer", "audio-transfer"].includes(item.id)), "媒体体积预算不得在开发优化合同中重复定义");
assert(sharedContract.mediaContract === "media-optimization-contract.json" && mediaContract.ownership === "shared-first", "媒体优化必须由共享合同统一拥有");
assert(sharedContract.gates.includes("media-policy") && sharedContract.gates.includes("responsive"), "统一质量门禁必须包含媒体和响应式");
assert(
  JSON.stringify(sharedContract.githubPrEvidence?.requiredChecks) === JSON.stringify(["source-lock", "backend-contracts", "frontend-types"])
    && sharedContract.githubPrEvidence?.requiredCheckBindings?.length === 3
    && sharedContract.githubPrEvidence.requiredCheckBindings.every((binding) => (
      sharedContract.githubPrEvidence.requiredChecks.includes(binding.name)
      && binding.appSlug === "github-actions"
      && binding.workflowName === "B2B verification"
      && binding.workflowPath === ".github/workflows/verify.yml"
      && binding.event === "pull_request"
    ))
    && JSON.stringify(sharedContract.githubPrEvidence?.acceptedReviewDecisions) === JSON.stringify(["approved"])
    && sharedContract.githubPrEvidence?.requireExactWorkflowBinding === true
    && sharedContract.githubPrEvidence?.ttlSeconds === 600
    && sharedContract.githubPrEvidence?.repositoryBinding === "git-origin"
    && sharedContract.githubPrEvidence?.requireCleanWorktree === true
    && sharedContract.githubPrEvidence?.requireHeadShaMatch === true
    && sharedContract.githubPrEvidence?.requireCurrentSourceFingerprint === true
    && sharedContract.githubPrEvidence?.requireCurrentTargetManifest === true
    && sharedContract.githubPrEvidence?.requireHqFingerprintVerification === true
    && sharedContract.githubPrEvidence?.requireTrustedCheckProvenance === true
    && sharedContract.githubPrEvidence?.requireOneTimeConsumption === true
    && sharedContract.githubPrEvidence?.consumeRevalidatesAuthoritativeState === true,
  "GitHub PR 证据必须由共享契约固定完整 CI 检查、批准审查和精确工作流绑定",
);

for (const token of [
  "DEVELOPER_TOP_LEVEL_APPS",
  "data-development-standard-top-level-count={DEVELOPER_TOP_LEVEL_APPS.length}",
  'data-development-standard-runtime-tools={DEVELOPER_TOP_LEVEL_APPS.map((item) => item.id).join(",")}',
  'import("@/components/product-market/DeveloperSharedContractWorkbench")',
  'import("@/components/product-market/DeveloperFigmaDesignWorkbench")',
  'import("@/components/product-market/DeveloperVisualEvidenceWorkbench")',
  'import("@/components/product-market/PerformanceExperienceWorkbench")',
  'import("@/components/product-market/PerformanceQualityReleaseWorkbench")',
  'import("@/components/product-market/PageFactoryWorkbench")',
  "loadLazyModule",
  "DeveloperApplicationLoading",
  'aria-live="polite"',
  'activeTool === "shared-contract"',
  'activeTool === "figma-ui"',
  'activeTool === "visual-evidence"',
  'activeTool === "quality-release"',
  'activeTool === "page-factory"',
  "data-development-standard-page-factory-lifecycle",
  "renderActiveWorkbench",
]) assert(consoleSource.includes(token), `开发器八栏接线缺少 ${token}`);
assert(!consoleSource.includes("DEVELOPER_TOP_LEVEL_TOOLS"), "开发器不得保留旧三栏本地常量");
assert(contractAdapterSource.includes('@website-style/developer-optimization-contract.json'), "前端必须读取共享 JSON 契约");
assert(contractAdapterSource.includes('"figma-ui"') && contractAdapterSource.includes('"visual-evidence"'), "前端应用 ID 类型必须覆盖 Figma UI 与可视化验证台");
for (const token of [
  "DEVELOPER_LOADING_SPEED_LEARNING_CONTRACT",
  "getDeveloperLoadingSpeedApplicationPlan",
  "getDeveloperLoadingSpeedRulesForApp",
]) assert(contractAdapterSource.includes(token), `加载速度规则前端适配缺少 ${token}`);
for (const token of [
  "DeveloperLoadingSpeedLearningPlan",
  "data-developer-loading-speed-learning",
  "data-developer-loading-speed-learning-version",
  "data-developer-loading-speed-rule-ids",
]) assert(consoleSource.includes(token), `01–08 加载速度学习投影缺少 ${token}`);
for (const token of [
  "applicationLearningVersion",
  "applicationLearning: DEVELOPER_LOADING_SPEED_LEARNING_CONTRACT",
]) assert(performanceLearningSource.includes(token), `05 自动学习目录缺少 ${token}`);
assert(runtimeSource.includes("data-performance-experience-application-learning") && runtimeSource.includes("01–08 规则已映射"), "05 工作台必须显示八应用规则学习状态");
assert(figmaWorkbenchSource.includes("data-developer-figma-design-workbench"), "Figma 插件 UI 必须暴露稳定工作台根选择器");
assert(visualEvidenceWorkbenchSource.includes("data-developer-visual-evidence-workbench"), "可视化验证台必须暴露稳定工作台根选择器");

const initialLazyEntries = sharedContract.routeComposition?.initialLazyEntriesByPageId || {};
const deferredLazyEntries = sharedContract.routeComposition?.deferredLazyEntriesByPageId || {};
assert(JSON.stringify(sharedContract.routeComposition?.lightweightRouteUtilities?.aiBuilderScope) === JSON.stringify({
  entry: "src/lib/ai-builder-route-scope.ts",
  heavySource: "src/lib/ai-builder-scope.ts",
  consumer: "src/pages/ProductMarket.tsx",
  rule: "路由作用域判定不得让产品市场首屏加载语言目录。",
}), "产品市场路由作用域必须登记轻量工具边界");
assert(productMarketSource.includes('getAIBuilderScope } from "@/lib/ai-builder-route-scope"'), "产品市场必须从轻量路由工具读取作用域");
assert(!productMarketSource.includes('getAIBuilderScope } from "@/lib/ai-builder-scope"'), "产品市场首屏不得因作用域判定加载语言目录");
assert(aiBuilderRouteScopeSource.includes("export function getAIBuilderScope") && !aiBuilderRouteScopeSource.includes("SUPPORTED_LANGUAGES"), "轻量路由工具只能承载作用域判定");
assert(aiBuilderScopeSource.includes('export { getAIBuilderScope } from "./ai-builder-route-scope"'), "原 AI builder API 必须继续兼容重导出作用域判定");
assert(JSON.stringify(sharedContract.routeComposition?.developerApplicationEntries) === JSON.stringify({
  "shared-contract": "src/components/product-market/DeveloperSharedContractWorkbench.tsx",
  "figma-ui": "src/components/product-market/DeveloperFigmaDesignWorkbench.tsx",
  "visual-evidence": "src/components/product-market/DeveloperVisualEvidenceWorkbench.tsx",
  "performance-experience": "src/components/product-market/PerformanceExperienceWorkbench.tsx",
  "quality-release": "src/components/product-market/PerformanceQualityReleaseWorkbench.tsx",
  "page-factory": "src/components/product-market/PageFactoryWorkbench.tsx",
}), "02 至 07 的六个按需工作台必须全部登记为开发器应用入口并进入独立构建预算");
assert(JSON.stringify(sharedContract.routeComposition?.developerApplicationDeferredEntries) === JSON.stringify({
  "page-factory": ["src/page-factory/page-factory-audit.ts"],
}), "07 治理 JSON 必须登记为页面工厂首帧后的独立预算入口");
assert(sharedContract.routeComposition?.developerShellEntry === "src/components/product-market/DevelopmentStandardApplyConsole.tsx", "开发器应用增量预算必须登记已加载的控制台壳入口");
assert(JSON.stringify(sharedContract.routeComposition?.developerApplicationPreload) === JSON.stringify({
  mode: "single-next-step",
  schedule: "post-paint-idle",
  directIntentEvents: ["hover-120ms", "pointerdown", "focus"],
  singleFlight: true,
  failurePolicy: "one-retry-then-release",
}), "开发器应用必须遵守单一下一步预热与直接意图加载契约");
assert(JSON.stringify(sharedContract.releaseCoordinatorGate?.requiredFreshStages) === JSON.stringify(["02", "03", "04", "05", "06"]), "发布协调器必须消费完整 02–06 新鲜证据");
assert(JSON.stringify(sharedContract.releaseCoordinatorGate?.guardedActions) === JSON.stringify(["sync-passed-pages", "publish-three-end", "save-factory-default"]), "同步、发布和工厂默认必须共用一套发布门");
assert(sharedContract.releaseCoordinatorGate?.authorizationMode === "short-lived-single-action-one-time-request"
  && sharedContract.releaseCoordinatorGate?.eventPayload === "opaque-request-id"
  && sharedContract.releaseCoordinatorGate?.failureMode === "fail-closed", "发布门必须使用短时、单动作、一次性 opaque request 并失败关闭");
for (const token of [
  "verifyGlobalReleaseLockGate",
  "GLOBAL_FRAME_RELEASE_AUTHORIZATION_MAX_AGE_MS",
  "lock-snapshot:",
  "globalFrameReleaseAuthorization",
  "downgradeExpiredDeveloperWorkflowReleaseEvidence",
]) assert(consoleSource.includes(token), `开发器统一发布门缺少 ${token}`);
for (const token of [
  "pendingGlobalFrameReleaseAuthorizations",
  "releaseAuthorizationRequestId",
  "consumeGlobalFrameReleaseAuthorization",
  "pendingGlobalFrameReleaseAuthorizations.delete(requestId)",
]) assert(visualPageEditorEventsSource.includes(token), `一次性发布授权传输缺少 ${token}`);
assert(globalFrameCoordinatorBridgeSource.includes("consumeGlobalFrameReleaseAuthorization")
  && globalFrameCoordinatorBridgeSource.includes('detail.action !== "preflight"'), "唯一协调器必须在任何写动作前消费一次性发布授权");
assert(unifiedFrameWorkbenchSource.includes("requiresReleaseAuthorization")
  && unifiedFrameWorkbenchSource.includes("releaseAuthorizationRequestId") === false
  && unifiedFrameWorkbenchSource.includes("releaseAuthorization={releaseAuthorization}"), "01 工作台必须只传真实授权对象，由事件适配器隐藏为 requestId");
for (const token of [
  "developerApplicationModulePromises",
  "schedulePostPaintIdle(() => preloadDeveloperApplication(nextApplication.id), 1_000)",
  "scheduleDeveloperApplicationHoverPreload(item.id)",
  "onPointerDown={() => preloadDeveloperApplication(item.id)}",
  "onFocus={() => preloadDeveloperApplication(item.id)}",
]) {
  assert(consoleSource.includes(token), `开发器顺序预热缺少 ${token}`);
}
assert(sharedContract.navigationOrderMigration?.effectiveContractVersion === "2026.08.28.3", "旧 07/09 展示编号兼容必须固定迁移生效契约版本");
const expectedProductMarketPrefixes = ["hq", "agency-source", "client-source"];
for (const prefix of expectedProductMarketPrefixes) {
  assert(JSON.stringify(initialLazyEntries[`${prefix}-product-market-modules`]) === JSON.stringify([
    "src/components/product-market/ProductMarketModulesPanel.tsx",
  ]), `${prefix} 栏目配置必须把立即挂载面板计入首屏预算`);
  assert(JSON.stringify(initialLazyEntries[`${prefix}-product-market-service`]) === JSON.stringify([
    "src/components/product-market/ProductMarketCustomerServiceSection.tsx",
  ]), `${prefix} 客服音效必须把立即挂载面板计入首屏预算`);
  assert(!initialLazyEntries[`${prefix}-product-market-development`], `${prefix} 开发规范不应在首次绘制同步请求重型工具`);
  assert(deferredLazyEntries[`${prefix}-product-market-development`]?.includes("src/components/product-market/ProductMarketDevelopmentGuidePanel.tsx"), `${prefix} 开发规范主面板必须登记为首帧后入口`);
  assert(deferredLazyEntries[`${prefix}-product-market-development`]?.includes("src/components/product-market/DevelopmentStandardWorkbench.tsx"), `${prefix} 开发规范工作台必须登记为首帧后入口`);
  assert(deferredLazyEntries[`${prefix}-product-market-development`]?.includes("src/components/product-market/DevelopmentStandardPanels.tsx"), `${prefix} 开发规范的深层面板必须登记为视口延迟入口`);
  assert(deferredLazyEntries[`${prefix}-product-market-blueprint`]?.includes("src/components/product-market/FactoryPlatformBlueprint.tsx"), `${prefix} 平台蓝图必须登记为首帧后入口`);
}
assert(JSON.stringify(initialLazyEntries["product-analysis-market-finder"]) === JSON.stringify([
  "src/components/market-radar/MarketRadarWorkspace.tsx",
]), "产品分析全球商机的立即挂载市场雷达必须计入首屏预算");
assert(JSON.stringify(initialLazyEntries["product-analysis-global-market"]) === JSON.stringify([
  "src/components/competitive-pricing/CompetitivePricingWorkspace.tsx",
]), "产品分析市场调查的立即挂载竞价工作台必须计入首屏预算");
assert(JSON.stringify(initialLazyEntries["client-social-customer-roadmap"]) === JSON.stringify([
  "src/components/social/SocialCustomerRoadmapTab.tsx",
]), "社交痛点路线的立即挂载面板必须计入首屏预算");
assert(deferredLazyEntries["client-dashboard"]?.includes("src/components/charts/ClientDashboardCharts.tsx"), "客户工作台图表必须登记为首帧后入口");
assert(deferredLazyEntries["client-account"]?.includes("src/components/charts/AccountCreditsChart.tsx"), "账户积分图表必须登记为首帧后入口");
assert(deferredLazyEntries["client-seo"]?.includes("src/components/charts/SeoRankingChart.tsx"), "SEO 排名图表必须登记为首帧后入口");
assert(deferredLazyEntries["client-company-info"]?.includes("src/pages/CompanyInfoDeferredPanels.tsx"), "企业资料深层面板必须登记为首帧后入口");
assert(deferredLazyEntries["client-reports"]?.includes("src/components/reports/ReportChart.tsx"), "报表图表必须登记为首帧后入口");

for (const token of ["PostPaintBoundary", "usePostPaintReady", "hasPendingSiteSwitchLoading", "if (!props.open) return null"]) {
  assert(deferredShellSource.includes(token), `共享壳层延迟加载缺少 ${token}`);
}
assert(postPaintSource.includes("requestAnimationFrame") && postPaintSource.includes("requestIdleCallback"), "首帧后调度必须先经过绘制再进入空闲窗口");
for (const [source, marker, label] of [
  [dashboardSource, "data-client-dashboard-chart-post-paint", "客户工作台图表"],
  [accountSource, "data-account-credits-chart-post-paint", "账户积分图表"],
  [seoSource, "data-seo-ranking-chart-post-paint", "SEO 排名图表"],
]) {
  assert(source.includes("usePostPaintReady(700)") && source.includes(marker), `${label}不得在首次提交同步请求图表包`);
}
assert(companyInfoSource.includes("usePostPaintReady(700)") && companyInfoSource.includes("data-company-info-deferred-panels-placeholder") && companyInfoSource.includes("if (!deferredPanelsReady)"), "企业资料深层面板不得在直接查询首次提交时同步请求");
assert(reportsSource.includes("usePostPaintReady(700)") && reportsSource.includes("data-report-chart-post-paint"), "报表图表不得在首次提交同步请求图表包");
assert(productAnalysisSource.includes('import("@/components/market-radar/MarketRadarWorkspace")') && productAnalysisSource.includes('import("@/components/competitive-pricing/CompetitivePricingWorkspace")'), "产品分析首屏登记必须对应真实动态入口");
assert(socialMediaSource.includes('import("@/components/social/SocialCustomerRoadmapTab")') && socialMediaSource.includes('tab === "customer-roadmap"'), "社交痛点路线首屏登记必须对应真实动态入口");
assert(productMarketSource.includes("postPaintApplicationsReady") && productMarketSource.includes("data-factory-platform-blueprint-post-paint") && productMarketSource.includes("data-product-market-development-post-paint"), "产品市场蓝图、开发规范与可视化入口必须在首帧后挂载");
assert(developmentGuideSource.includes('<DeferredViewportSection label="development-governance">') && developmentGuideSource.includes('<DeferredViewportSection label="development-audit-recovery">'), "开发规范深层治理与审计面板必须按视口挂载");
for (const token of ["deferredLazyEntriesBySourceScope", "deferredLazyEntriesByPageId", "deferredGzipBytes", "postPaintBudget", "deferred-loaded-initially", "developerApplicationEntries", "developerApplicationDeferredEntries", "developerShellEntry", "developerShellFileSet", "incrementalGzipBytes", "interactionApplications", "developer-application-not-dynamic", "developer-application-deferred-loaded-initially"]) {
  assert(bundleBudgetSource.includes(token), `构建预算必须区分首屏与首帧后脚本：缺少 ${token}`);
}
assert(bundleBudgetSource.includes("const incrementalFiles = files.filter((file) => !developerShellFileSet.has(file))"), "开发器应用新增包体必须扣除已加载的开发器壳闭包");
assert(bundleBudgetSource.includes("const loadedBeforeDeferredFileSet = new Set([...developerShellFiles, ...files])"), "开发器首帧后包体必须继续扣除壳层与应用入口已加载文件");
assert(qualityWorkbenchSource.includes("data-bundle-interaction-applications") && qualityWorkbenchSource.includes("data-bundle-interaction-application"), "质量中心必须可视化 Figma UI 与视觉证据台的首次交互包体");
assert(qualityWorkbenchSource.includes("data-bundle-developer-shell") && qualityWorkbenchSource.includes("首次打开新增") && qualityWorkbenchSource.includes("完整闭包"), "质量中心必须以已加载开发器壳为基线，分别显示首次打开新增与完整闭包");
assert(qualityWorkbenchSource.includes('application.incrementalGzipBytes + deferredBytes') && qualityWorkbenchSource.includes('formatBytes(application.closureGzipBytes)'), "首次打开新增必须使用 incremental + deferred，完整闭包必须独立使用 closureGzipBytes");

for (const token of [
  "data-performance-experience-workbench",
  "data-shared-optimization-contract",
  "data-performance-experience-cleanup-playbook",
  "data-performance-experience-route-trend",
  "data-performance-experience-native-action",
  'status: globalRepresentativeOnly ? "pending" : pageBlocked ? "blocked" : "passed"',
  'coverageMode: globalRepresentativeOnly ? "representative-route" : "current-page"',
  "不能用单页样本冒充全局通过",
  "buildGlobalPerformanceWorkflowArtifact",
  "evaluateGlobalPerformanceAuditCoverage",
  'runPerformanceCodeAudit({ scope: "global", runBuild: true })',
  "initialReport?: PerformanceCodeAuditReport | null",
  "reusableInitialReport",
  "setGlobalAuditReport(reusableInitialReport)",
]) assert(runtimeSource.includes(token), `运行时体验工作台缺少 ${token}`);
assert(consoleSource.includes('initialReport={workflowScope === "global" ? activeGlobalAuditReport : null}'), "Stage 05 必须复用统一 04-05 全局报告");
assert(consoleSource.includes("resolvePageFactoryRuntimeScope(pathname)") && !consoleSource.includes("function resolvePerformanceExperienceScope"), "01-06 source scope must reuse the Page Factory resolver");
assert(pageFactorySource.includes("PAGE_FACTORY_RUNTIME_SCOPE_BY_SOURCE") && pageFactorySource.includes("resolvePageFactoryRuntimeScope"), "Page Factory must own the shared source/runtime scope mapping");
assert(auditClientSource.includes("toPageFactorySourceScope(scope)") && auditClientSource.includes("normalizePageFactoryRoute(pathname, search)"), "Performance audit must reuse Page Factory source and route identity");
assert(qualityWorkbenchSource.includes("resolvePerformanceAuditRoute(pathname, search)"), "Current-page quality audit must pass pathname and search through the canonical route resolver");
assert(consoleSource.includes("THREE_TIER_PAGE_LOCK_CONTRACT") && !consoleSource.includes("PAGE_LOCK_GUIDANCE"), "Page-lock actions must project the shared three-tier lock contract");
for (const token of [
  "inspectSharedContractHealth",
  "inspectGlobalSharedContractHealth",
  "inspectLocalRuntimeReadiness",
  "data-shared-contract-health-report",
  "data-shared-contract-global-target-coverage",
  "SHARED_OPTIMIZATION_CONTRACT.budgets",
  "MEDIA_TRANSFER_BUDGETS",
  "data-shared-performance-budget-owner",
  "workflowScopeIdentity",
  "workflowTargetManifestFingerprint",
  "requestSequenceRef",
  "inspectionContextRef",
  "useLayoutEffect",
]) assert(sharedWorkbenchSource.includes(token), `共享契约器缺少 ${token}`);
for (const token of [
  'getRequiredSharedOptimizationBudget("route-fallback").warning',
  'getRequiredSharedOptimizationBudget("route-script").limit',
  'getRequiredSharedOptimizationBudget("largest-chunk").limit',
  'getRequiredSharedOptimizationBudget("long-task").warning',
  'getRequiredSharedOptimizationBudget("layout-shift").warning',
  "MEDIA_OPTIMIZATION_CONTRACT.kinds.image.deliveryBudgetBytes",
]) assert(performanceLearningSource.includes(token), `运行时体验预算没有读取唯一共享来源：${token}`);
assert(!performanceLearningSource.includes("sharedBudgetValue") && !performanceLearningSource.includes('getSharedOptimizationBudget("image-transfer")'), "运行时体验预算不得保留静默数字回退或旧媒体预算来源");
assert(auditClientSource.includes("构建包预算证据缺少完整有效的共享预算"), "审计客户端必须在构建报告预算缺失时 fail closed");
for (const token of [
  "bundle.contractVersion !== SHARED_OPTIMIZATION_CONTRACT.version",
  "bundle.mediaContractVersion !== MEDIA_OPTIMIZATION_CONTRACT.version",
  "budget.warning !== expected.warning",
  "budget.limit !== expected.limit",
  "_validate_performance_audit_bundle_report",
  "PERFORMANCE_AUDIT_BUNDLE_BUDGET_KEYS",
]) assert(`${auditClientSource}\n${backendSource}`.includes(token), `构建预算严格校验缺少 ${token}`);
assert(qualityWorkbenchSource.includes("budgets.postPaintScript.limit") && !qualityWorkbenchSource.includes("postPaintScript?.limit || 256"), "质量中心不得为首帧后预算静默回退");
assert(!sharedWorkbenchSource.includes("resolveDeveloperPageDna"), "02 共享契约器必须复用父层目标清单，不得自行重复解析");
for (const [stage, source] of [["03", figmaWorkbenchSource], ["04", visualEvidenceWorkbenchSource]]) {
  assert(source.includes("workflowPageDna: DeveloperPageDna"), `${stage} 必须接收父层唯一 Page DNA`);
  assert(!source.includes("fallbackDesignScope"), `${stage} 不得保留子级作用域状态`);
  assert(!source.includes("resolveDeveloperPageDna"), `${stage} 不得重复解析工作流 Page DNA`);
}
assert(consoleSource.includes("workflowPageDna={workflowPageDna}"), "父层必须向 03/04 下发唯一 Page DNA");
assert(consoleSource.includes("runtimeTargetPageDna={workflowRuntimeTargetPageDna}"), "父层必须向 04 下发当前运行页面 DNA");
assert(developerDesignIntegrationSource.includes("cachedGlobalDeveloperPageDna") && developerDesignIntegrationSource.includes("const pageById = new Map(PAGE_FACTORY_PAGES.map"), "全局 Page DNA 必须通过稳定缓存和 page-id 索引生成");
for (const token of [
  "DeveloperWorkflowExecutionContext",
  "expectedContext?: DeveloperWorkflowExecutionContext",
  "developerWorkflowExecutionContextMatches(normalizedRun, input.expectedContext)",
  "context mismatch",
]) assert(developerWorkflowRunSource.includes(token), `01-06 原子上下文写入缺少 ${token}`);
for (const stage of ["01", "02", "03", "04", "05"]) {
  assert(consoleSource.includes(`recordWorkflowArtifact("${stage}", input, workflowExecutionContext)`), `Stage ${stage} 写回必须绑定创建时上下文`);
}
assert(consoleSource.includes('recordWorkflowArtifact("06", input, expected)'), "Stage 06 写回必须复用同一上下文绑定");
assert(consoleSource.includes('activeTool !== "page-lock"') && consoleSource.includes("pageLockStateSnapshot, pageLockTree"), "隐藏页面锁树与统计必须延迟到页面锁定器激活后计算，并共用当前 revision 快照");
for (const token of [
  "DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS",
  "global-target-identity",
  "global-target-registration",
  "global-target-resolution",
  "global-target-source-entry",
]) assert(sharedContractHealthSource.includes(token), `全局共享契约证据缺少 ${token}`);
for (const token of [
  "targetManifestFingerprint",
  "targetIdentityKey",
  "data-visual-evidence-covered-targets",
  "当前页仅作为代表样本",
]) assert(visualEvidenceWorkbenchSource.includes(token), `全局视觉证据台缺少 ${token}`);
for (const token of [
  "sampleSchemaVersion: 3",
  "viewportHeight",
  "resolveDeveloperVisualEvidenceViewport",
  "sample-binding",
  "target-coverage",
  "completeTargetCount",
  "fingerprintDeveloperDesignTargetManifest",
]) assert(developerDesignIntegrationSource.includes(token), `目标级视觉证据模型缺少 ${token}`);
for (const token of [
  "GLOBAL_VISUAL_AUDIT_REQUIRED_COMMANDS",
  "DEVELOPER_VISUAL_EVIDENCE_VIEWPORTS",
  "GLOBAL_VISUAL_AUDIT_VIEWPORT_IDS",
  '"registered-visual-scan"',
  '"responsive-runtime-matrix"',
  'coverageMode: "registered-targets+runtime-representatives"',
  "registered-target-count-mismatch",
  "analyzed-target-count-mismatch",
]) assert(developerGlobalWorkflowEvidenceSource.includes(token), `全局 04 视觉批检证据缺少 ${token}`);
assert(!developerGlobalWorkflowEvidenceSource.includes('viewportIds: ["mobile", "tablet", "desktop"]'), "全局 04 不得复制视觉视口 ID");
for (const token of [
  "runGlobalWorkflowBatch",
  'runPerformanceCodeAudit({ scope: "global", runBuild: true })',
  "evaluateGlobalVisualAuditCoverage",
  "buildGlobalPerformanceWorkflowArtifact",
  "workflowContextRef",
  "const performanceArtifact = buildGlobalPerformanceWorkflowArtifact(",
  "recordStage05(performanceArtifact)",
  'if (performanceArtifact.status === "passed")',
  "setWorkflowNotice(performanceArtifact.message)",
  "暂不能进入 06",
]) assert(consoleSource.includes(token), `统一 04–05 全局批检入口缺少 ${token}`);
for (const token of [
  'useState<OptimizationAuditScope>("page")',
  'setAuditScope("global")',
  "定位当前页",
  "runPerformanceCodeAudit",
  "data-performance-quality-gates",
  'gate === "github-pr"',
  "GitHub PR 为外部最终门",
  "data-github-pr-evidence-verify",
  "verifyDeveloperPrEvidenceWithGithub",
  'id: "page-target-identity"',
  "auditContextKey",
  "workflowTargetManifestFingerprint",
  "workflowSourceFingerprint",
  "verificationExpiresAt",
  "workflowRunId",
  "useLayoutEffect",
  '"media-policy": ["media-policy"]',
  'responsive: ["responsive-runtime-matrix", "responsive-contract"]',
  "data-media-optimization-policy",
  "data-responsive-verification-matrix",
  'if (auditScope === "global")',
  "setReport(reusableInitialReport)",
]) assert(qualityWorkbenchSource.includes(token), `质量与发布中心缺少 ${token}`);
for (const token of [
  "SHARED_OPTIMIZATION_CONTRACT.githubPrEvidence.requiredChecks",
  "review-not-approved",
  "missing-required-check:",
  "source-fingerprint-mismatch",
  "target-manifest-fingerprint-mismatch",
  "evidence-fingerprint-mismatch",
  "workflow-run-mismatch",
  "contract-version-mismatch",
  "evidence-expired",
  "invalid-evidence-ttl",
  "invalid-verification-id",
  "verification-not-consumed",
  "untrusted-check-provenance:",
  '"/api/v1/local-dev/performance-audit/github-pr-evidence/consume"',
  'verifiedBy: "github-cli"',
  "verifyDeveloperPrEvidenceWithGithub",
]) assert(developerPrEvidenceSource.includes(token), `GitHub PR 严格证据适配器缺少 ${token}`);
for (const token of ["/performance-audit/catalog", "/performance-audit/run"]) {
  assert(auditClientSource.includes(token), `前端审计 API 缺少 ${token}`);
}

for (const token of [
  'DEVELOPER_OPTIMIZATION_CONTRACT_PATH = PROJECT_ROOT / "shared" / "contracts" / "developer-optimization-contract.json"',
  'if PERFORMANCE_AUDIT_SOURCE_ROOT not in candidate.parents',
  'raise HTTPException(status_code=400, detail="Global audits do not accept a target path")',
  'raise HTTPException(status_code=400, detail="Page audits cannot request a global production build")',
  '"shell": False',
  'PERFORMANCE_AUDIT_BUILD_TIMEOUT_SECONDS = 900',
  'timeout=PERFORMANCE_AUDIT_BUILD_TIMEOUT_SECONDS',
  'subprocess.Popen(',
  '"/PID", str(process.pid), "/T", "/F"',
  'source_lock_passed = commands[0]["status"] == "passed"',
  '"typescript"',
  '"knip-production"',
  '"shared-contract"',
  '"page-factory"',
  '"media-policy"',
  '"registered-visual-scan"',
  '"responsive-runtime-matrix"',
  '"responsive-contract"',
  'PERFORMANCE_AUDIT_GLOBAL_BUILD_LOCK.acquire(blocking=False)',
  '"source-stability"',
  '"sourceFingerprintStart": source_fingerprint_start',
  '"sourceFingerprintEnd": source_fingerprint_end',
  '"/performance-audit/github-pr-evidence/verify"',
  "_run_authenticated_gh_pr_view",
  '"verifiedBy": "github-cli"',
  "_read_local_git_pr_binding",
  '"--ignore-submodules=none"',
  "_read_current_hq_source_fingerprint",
  "_read_current_developer_workflow_contract_version",
  "_current_developer_target_manifest",
  'binding_issues.append("repository-origin-mismatch")',
  'binding_issues.append("head-sha-mismatch")',
  'binding_issues.append("worktree-not-clean")',
  'binding_issues.append("contract-version-mismatch")',
  '"expiresAt": expires_at',
  "_verify_current_hq_source_fingerprint",
  "_github_pr_trusted_check_evidence",
  '"appSlug": binding["appSlug"]',
  '"event": binding["event"]',
  '"/performance-audit/github-pr-evidence/consume"',
  "_take_github_pr_verification",
  "consume_github_pr_evidence",
]) assert(backendSource.includes(token), `后端固定审计边界缺少 ${token}`);
for (const token of [
  'for source_key in ("component", "entryComponent"):',
  'entries, matched_pages = _performance_audit_page_entries(normalized_target, target_path)',
  '"mode": "registered-page-dependency-closure" if matched_pages else "target-dependency-closure"',
  'classifications = ["closure"]',
  'classifications.append("lazy")',
  'classifications.append("shared")',
]) assert(backendSource.includes(token), `页面依赖闭包缺少 component+entry 或 closure/lazy/shared 证据：${token}`);
for (const token of [
  "PERFORMANCE_AUDIT_ESLINT_BATCH_SIZE = 96",
  "for start in range(0, len(targets), PERFORMANCE_AUDIT_ESLINT_BATCH_SIZE):",
  "_run_performance_audit_eslint_closure(npx_command, eslint_targets)",
  '"batchCount": len(results)',
  '"targetCount": len(targets)',
]) assert(backendSource.includes(token), `页面依赖闭包的分批 ESLint 门禁缺少 ${token}`);
for (const token of [
  '"source": "dependency-closure"',
  "_performance_audit_page_media_assets(page_media_paths, page_literal_values)",
]) assert(backendSource.includes(token), `页面媒体审计必须消费完整依赖闭包：${token}`);
assert(
  !backendSource.includes('"eslint", target_path.relative_to(PATHS.frontend_root).as_posix()'),
  "页面 ESLint 不得退回只检查单个 target_path",
);
assert(backendSource.includes('def run_performance_audit(payload: PerformanceAuditRequest):'), "阻塞审计必须由 FastAPI 线程池执行");
assert(!backendSource.includes('async def run_performance_audit(payload: PerformanceAuditRequest):'), "审计不得阻塞异步事件循环");

assert(!/^import .*rollup-plugin-visualizer/m.test(viteSource), "开发服务器不得静态加载构建分析插件");
assert(viteSource.includes("await import('rollup-plugin-visualizer')") && viteSource.includes("process.env.ANALYZE === '1'"), "构建分析插件必须只在显式分析构建时加载");
assert(packageJson.devDependencies.knip && packageJson.devDependencies["rollup-plugin-visualizer"], "Knip 与构建包可视化依赖必须固定在开发依赖");
assert([
  "DEVELOPER_WORKFLOW_TARGET_MANIFEST_SCHEMA_VERSION",
  "compareDeveloperWorkflowCodeUnits",
  "buildDeveloperWorkflowRouteTarget",
  "fingerprintDeveloperWorkflowTargetManifest",
  "normalizeDeveloperWorkflowTargetIds",
].every((token) => developerTargetManifestSource.includes(token)), "shared target-manifest helper must own schema, normalization, ordering and fingerprints");
assert([
  "buildDeveloperWorkflowRouteTarget",
  "buildDeveloperWorkflowTargetManifestPayload",
  "fingerprintDeveloperWorkflowTargetManifest",
  '["complete", "pilot-complete"]',
].every((token) => targetManifestExporterSource.includes(token)), "frontend target-manifest exporter must derive the live eligible registry manifest through the shared helper");
assert([
  "PYTHON_EXECUTABLE",
  "verify_developer_target_manifest_parity.py",
  'shell: false',
].every((token) => targetManifestParityLauncherSource.includes(token)), "target-manifest parity launcher must select Python explicitly without a shell");
assert([
  '_current_developer_target_manifest("global:global")',
  '("schemaVersion", "targets", "fingerprint")',
  'shell=False',
].every((token) => targetManifestParityVerifierSource.includes(token)), "cross-runtime parity verifier must compare the live schema, targets and fingerprint without a shell");
assert([
  "targetManifestFingerprint",
  "targetIdentities",
  "uniqueWorkflowTargets",
  "totalRegisteredPages",
  "totalAnalyzedRoutes",
].every((token) => bundleBudgetSource.includes(token)), "bundle evidence must preserve eligible and total target-manifest identities");
assert([
  "downgradeExpiredDeveloperWorkflowReleaseEvidence(next)",
  "expireReleaseEvidence",
  "setWorkflowPrEvidenceCache(null)",
  "workflowContractVersion",
  "workflowTargetManifestFingerprint",
].every((token) => consoleSource.includes(token)), "06 evidence must expire from the parent chain even while the 06 workbench is unmounted");

for (const script of ["analyze", "audit:dead-code", "lint:report", "verify:performance-governance", "verify:developer-target-manifest-parity", "verify:media-optimization", "verify:bundle-budgets"]) {
  assert(packageJson.scripts[script], `package.json 缺少 ${script} 脚本`);
}
assert(packageJson.scripts["audit:dead-code"].includes("--include files,dependencies"), "阻断式 Knip 必须聚焦新增未引用文件与未使用依赖");
assert(packageJson.scripts["audit:dead-code:full"], "必须保留完整 Knip 导出审计供人工清债");
assert(productionBuildSource.includes('run("bundle budgets", ["scripts/verify-bundle-budgets.mjs"])'), "生产构建必须在产物生成后执行包预算门禁");
assert(productionBuildSource.indexOf('run("vite build"') < productionBuildSource.indexOf('run("bundle budgets"'), "包预算必须读取本次 Vite 构建产物，不能复用旧报告");
assert(knipConfig.ignore.length > 1 && knipConfig.ignoreDependencies.length > 0, "Knip 历史债务必须登记为显式可审计基线");
assert(packageJson.scripts["verify:developer-workflow-run"] === "node scripts/verify-developer-workflow-run.mjs", "package.json must expose the single DeveloperRun workflow verifier");
assert(packageJson.scripts["verify:developer-optimization-evidence"] === "node scripts/verify-developer-optimization-evidence.mjs", "package.json must expose the optimization evidence verifier");
assert(packageJson.scripts["verify:developer-target-manifest-parity"] === "node scripts/verify-developer-target-manifest-parity.mjs", "package.json must expose the cross-runtime target manifest verifier");
assert(packageJson.scripts["verify:development-standard"] === "node scripts/run-development-standard-gates.mjs", "development standards must keep one gate entry point");
assert(developmentStandardGateSource.includes('"verify-developer-workflow-run.mjs"'), "the single development-standard gate must include the DeveloperRun workflow verifier");
assert(developmentStandardGateSource.split('"verify-developer-workflow-run.mjs"').length === 2, "the single development-standard gate must run the DeveloperRun workflow verifier exactly once");
assert(developmentStandardGateSource.split('"verify-developer-optimization-evidence.mjs"').length === 2, "the development-standard gate must run the optimization evidence verifier exactly once");
assert(developmentStandardGateSource.split('"verify-developer-target-manifest-parity.mjs"').length === 2, "the development-standard gate must run the cross-runtime target manifest verifier exactly once");
assert(developmentStandardGateSource.split('"verify-global-responsive-page-contract.mjs"').length === 2, "the development-standard gate must run the registry-driven global responsive verifier exactly once");
assert(developmentStandardGateSource.split('"verify-shared-visual-parity-contract.mjs"').length === 2, "the development-standard gate must run the shared visual parity verifier exactly once");
const playwrightInstallToken = "npx playwright install --with-deps chromium";
const analyzeToken = "npm run analyze";
const browserSmokeToken = "npm run test:e2e";
assert(workflowSource.indexOf(playwrightInstallToken) >= 0, "GitHub PR workflow is missing Playwright Chromium installation");
assert(workflowSource.indexOf(playwrightInstallToken) < workflowSource.indexOf(analyzeToken), "Playwright Chromium must be installed before the analyze browser gates");
assert(workflowSource.indexOf(analyzeToken) < workflowSource.indexOf(browserSmokeToken), "Bundle analysis must run before the standalone browser regression suite");
assert(workflowSource.split(playwrightInstallToken).length === 2, "Playwright Chromium must not be installed more than once");
assert(workflowSource.includes("npm run hq:verify"), "GitHub PR workflow must reject a stale HQ source fingerprint before release checks");
assert(workflowSource.includes("python tools/verify_developer_target_manifest_parity.py"), "GitHub PR workflow must compare the live frontend and backend target manifests");

for (const token of [
  "DEVELOPER_WORKFLOW_PERFORMANCE_BENCHMARK_METRIC_IDS",
  "DeveloperWorkflowPerformanceBenchmarkSummary",
  "DeveloperWorkflowPerformanceEvidenceQuality",
  "normalizeDeveloperWorkflowPerformanceBenchmarkSummary",
  "benchmarkSummary?: DeveloperWorkflowPerformanceBenchmarkSummary | null",
  "normalizeArtifactPayload(stage, input.payload)",
]) assert(developerWorkflowRunSource.includes(token), `Stage 05 benchmark contract is missing ${token}`);
for (const token of [
  "data-performance-benchmark-comparison",
  "data-performance-benchmark-outcome",
  "data-performance-benchmark-phase={id}",
  "data-performance-benchmark-metric={metricId}",
  "data-performance-benchmark-functional-parity",
  "data-performance-benchmark-evidence-quality",
  "data-performance-benchmark-confidence",
  "data-performance-benchmark-evidence-notes",
  "benchmarkSummary?.artifactRefs",
]) assert(runtimeSource.includes(token), `performance workbench benchmark evidence is missing ${token}`);
for (const token of [
  "workflowStage05BenchmarkSummary",
  "normalizeDeveloperWorkflowPerformanceBenchmarkSummary",
  "benchmarkSummary={workflowStage05BenchmarkSummary}",
]) assert(consoleSource.includes(token), `developer workflow benchmark wiring is missing ${token}`);
const benchmarkSemanticTestStart = developerWorkflowRunTestSource.indexOf(
  'test("stage 05 benchmark summary stays compact and semantic changes stale stage 06"',
);
const benchmarkSemanticTestEnd = developerWorkflowRunTestSource.indexOf(
  'test("localStorage helpers round-trip safely and remain SSR-safe"',
  benchmarkSemanticTestStart,
);
const benchmarkSemanticTest = developerWorkflowRunTestSource.slice(benchmarkSemanticTestStart, benchmarkSemanticTestEnd);
assert(benchmarkSemanticTestStart >= 0 && benchmarkSemanticTestEnd > benchmarkSemanticTestStart, "Stage 05 benchmark semantic-staleness test is missing");
assert(benchmarkSemanticTest.includes('assert.equal(replayed.artifacts["06"]?.status, "passed")'), "identical Stage 05 benchmark evidence must keep Stage 06 fresh");
assert(benchmarkSemanticTest.includes('assert.equal(changed.artifacts["06"]?.status, "stale")'), "changed Stage 05 benchmark evidence must stale Stage 06");
assert(developerWorkflowRunTestSource.includes("stage 05 evidence quality is v1-compatible, bounded, idempotent and semantic"), "Stage 05 evidenceQuality compatibility and semantic test is missing");
for (const metricId of [
  "visualReadyMs",
  "editReadyMs",
  "interactiveReadyMs",
  "domContentLoadedMs",
  "firstContentfulPaintMs",
  "largestContentfulPaintMs",
  "scriptEncodedBytes",
  "totalEncodedBytes",
  "resourceCount",
  "duplicateRequestExcess",
]) {
  assert(developerWorkflowRunSource.includes(`"${metricId}"`), `Stage 05 canonical metrics are missing ${metricId}`);
  assert(operationsStage05SummarySource.includes(`"${metricId}"`), `Stage 05 summary CLI metrics are missing ${metricId}`);
}
for (const token of [
  'PRODUCT_MARKET_OPERATIONS_PAGE_IDENTITY = "client_source:/product-market?tab=operations"',
  'PRODUCT_MARKET_OPERATIONS_PERFORMANCE_PROTOCOL = "page-dna-cold-repeat-median-p75-functional-parity"',
  'resolve(repositoryRoot, "release/local-performance/artifacts")',
  'argument === "--baseline" || argument === "--candidate"',
  "assertCohortPurity(baselineEntries",
  "comparison.candidateRunId === report.runId",
  "distributionAnalysis",
  "conservativeOutcome",
  "outcome: meanOutcome",
  'aggregation: "mean"',
  'confidence = notes.length ? "mixed" : "stable"',
]) assert(operationsStage05SummarySource.includes(token), `Stage 05 summary CLI is missing ${token}`);
assert(!operationsStage05SummarySource.includes("outcome: conservativeOutcome,"), "mean Stage 05 benchmarkSummary must not publish the conservative distribution outcome");
for (const token of [
  "all samples feed mean Stage 05 evidence while distribution conflict stays visible",
  "reordered.evidenceFingerprint",
  "protocol, environment, fingerprint and functional parity mismatches fail closed",
  "baseline reports mix target-source fingerprints",
]) assert(operationsStage05SummaryTestSource.includes(token), `Stage 05 summary CLI tests are missing ${token}`);
assert(packageJson.scripts["build:product-market-operations-stage05-summary"] === "node scripts/build-product-market-operations-stage05-summary.mjs", "package.json must expose the Stage 05 summary builder");
assert(packageJson.scripts["verify:product-market-operations-stage05-summary"] === "node --test scripts/build-product-market-operations-stage05-summary.test.mjs", "package.json must expose the Stage 05 summary verifier");
const bundleUploadBlock = workflowSource.slice(
  workflowSource.indexOf("- name: Upload frontend bundle analysis"),
  workflowSource.indexOf("- name: Run browser regression smoke tests"),
);
assert(bundleUploadBlock.includes("if: always()"), "Bundle analysis evidence must still be uploaded after an upstream failure");
assert(bundleUploadBlock.includes("if-no-files-found: warn"), "Missing bundle evidence must not hide the original workflow failure");

for (const token of ["Verify performance governance", "Generate Knip advisory report", "Build and visualize frontend bundle", "frontend-bundle-analysis"]) {
  assert(workflowSource.includes(token), `GitHub PR 工作流缺少 ${token}`);
}

console.log("性能治理工作台契约通过：八栏顺序、共享预算、按需加载、本地审计边界与 GitHub PR 证据链均已锁定。");
