import { existsSync, readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");
const productMarket = read("src/pages/ProductMarket.tsx");
const productMarketModules = read("src/components/product-market/ProductMarketModulesPanel.tsx");
const productMarketModulesStyles = read("src/components/product-market/ProductMarketModulesPanel.css");
const productMarketCustomerServiceSection = read("src/components/product-market/ProductMarketCustomerServiceSection.tsx");
const productMarketDevelopmentGuide = read("src/components/product-market/ProductMarketDevelopmentGuidePanel.tsx");
const developmentPanels = read("src/components/product-market/DevelopmentStandardPanels.tsx");
const developmentGovernance = read("src/lib/development-standard-governance.ts");
const developmentWorkbench = read("src/components/product-market/DevelopmentStandardWorkbench.tsx");
const developmentApplyConsole = read("src/components/product-market/DevelopmentStandardApplyConsole.tsx");
const developerOptimizationContract = read("../shared/contracts/developer-optimization-contract.json");
const performanceExperienceWorkbench = read("src/components/product-market/PerformanceExperienceWorkbench.tsx");
const figmaDesignWorkbench = read("src/components/product-market/DeveloperFigmaDesignWorkbench.tsx");
const visualEvidenceWorkbench = read("src/components/product-market/DeveloperVisualEvidenceWorkbench.tsx");
const performanceExperienceLearning = read("src/lib/performance-experience-learning.ts");
const routeLoadingPerformance = read("src/lib/route-loading-performance.ts");
const lazyModuleRecovery = read("src/lib/lazy-module-recovery.ts");
const app = read("src/App.tsx");
const visualResponsiveContract = read("src/components/VisualResponsiveContract.tsx");
const sharedWindowContract = read("src/lib/shared-window-contract.ts");
const visualProjectContractHost = read("src/components/product-market/VisualProjectContractHost.tsx");
const aiServiceWidget = read("src/components/AIServiceWidget.tsx");
const unifiedFrameWorkbench = read("src/components/developer-platform/UnifiedFrameMigrationWorkbench.tsx");
const unifiedFrameContract = read("src/lib/unified-page-frame-contract.ts");
const developmentCatalog = read("src/lib/development-standard-catalog.ts");
const layoutFrameContract = read("src/lib/layout-frame-contract.ts");
const externalDevtoolsMenu = read("src/components/ExternalDevtoolsMenu.tsx");
const sharedDialog = read("src/components/ui/dialog.tsx");
const customers = read("src/pages/Customers.tsx");
const socialMedia = read("src/pages/SocialMedia.tsx");
const productMarketNavigation = read("src/lib/product-market-navigation.ts");
const clientSidebar = read("src/components/Sidebar.tsx");
const agencySourceSidebar = read("src/components/AgencySourceSidebar.tsx");
const hqSidebar = read("src/components/HQSidebar.tsx");
const styles = read("src/index.css");
const sharedCardStyles = read("src/shared-layout-style-card.css");
const main = read("src/main.tsx");
const overrides = read("src/lib/page-layout-overrides.ts");
const lock = read("src/lib/page-layout-lock.ts");

for (const file of [
  "src/lib/page-composition-manifest.ts",
  "src/lib/new-content-plugin-guide.ts",
  "src/lib/page-composition-edit-mode.ts",
  "src/lib/page-composition-impact-map.ts",
  "src/lib/layout-screenshot-regressions.ts",
  "src/lib/layout-migration-assistant.ts",
  "src/lib/page-composition-audit.ts",
]) {
  if (!existsSync(file)) throw new Error(`开发规范缺少核心模块：${file}`);
}

for (const token of [
  "data-product-market-composition-manifest",
  "data-new-page-composition-wizard",
  "data-plugin-capability-boundary",
  "data-page-composition-impact-map",
  "data-page-composition-edit-mode",
  "data-screenshot-regression-baseline",
  "data-page-composition-migration",
  "data-page-composition-audit",
  "data-development-standard-governance",
  "data-development-standard-workbench",
  "data-development-standard-operations",
]) {
  if (!`${productMarket}\n${productMarketDevelopmentGuide}\n${developmentPanels}\n${developmentWorkbench}`.includes(token)) throw new Error(`开发规范页面缺少：${token}`);
}

for (const token of ["data-page-table-header", "data-development-standard-add-module", "data-development-standard-header-module", "data-development-standard-workbench-module", "痛点路线", "总体完成"]) {
  if (!developmentWorkbench.includes(token)) throw new Error(`开发规范样板缺少：${token}`);
}

for (const token of ["data-development-standard-apply-console", "flex min-h-0 flex-1 flex-col overflow-hidden", "data-shared-page-workspace", "data-development-standard-style-nav", "data-drag-handle", "data-development-standard-style-nav-item", "data-development-standard-title-header", "data-shared-layout-section=\"title\"", "data-development-standard-current-path", "data-development-standard-explanation", "data-development-standard-region-label=\"topbar\"", "data-development-standard-region-label=\"title\"", "data-development-standard-content-frame", "DEVELOPER_TOP_LEVEL_APPS", "resolveDevelopmentProjectPageName", "UnifiedFrameMigrationWorkbench", "data-development-standard-page-factory-lifecycle", "data-development-standard-page-lock-tree", "data-development-standard-lock-rule-panel", "PAGE_LOCK_RULES", "自定义锁定规则", "lockOperationRunningRef", "aria-busy={lockOperationRunning}", "sourceRecordsResolved={pageFactorySourceRecordsResolved}", "data-development-standard-application-footer", "shrink-0 flex-wrap items-center", "data-development-standard-fullwidth-footer", "setCompletedLayoutLocked", "effectiveWriteLocked", "LazyPageFactoryWorkbench", "DeveloperLoadingSpeedLearningPlan", "data-developer-loading-speed-learning", "data-developer-loading-speed-rule-ids"]) {
  if (!`${developmentApplyConsole}\n${layoutFrameContract}`.includes(token)) throw new Error(`Development Standard application console is incomplete: ${token}`);
}
for (const token of [
  "SHARED_WINDOW_TITLE_ACTION_ALIGNMENT_CONTRACT",
  "shared-title-action-band-center-v3",
  "data-shared-title-action-alignment-contract",
  "SHARED_WINDOW_TITLE_ACTION_RAIL_CONTRACT",
  "shared-window-title-action-rail-v2",
  "SHARED_WINDOW_TITLE_ACTION_INLINE_MODE",
  "SHARED_WINDOW_TITLE_ACTION_STACKED_EXCEPTION",
  "data-shared-window-title-action",
  'data-shared-window-title-actions="inline"',
  "data-shared-window-title-copy-stack",
  '--tradepro-shared-dialog-title-padding-block',
  "--tradepro-shared-action-line-height",
]) {
  if (!`${developmentApplyConsole}\n${sharedWindowContract}\n${styles}`.includes(token)) throw new Error(`弹窗标题操作对齐共享契约缺少：${token}`);
}
const developerInlineTitleRails = developmentApplyConsole.match(/data-shared-window-title-actions="inline"/gu) ?? [];
if (developerInlineTitleRails.length !== 3) throw new Error(`开发器应有 3 条共享 inline 标题操作轨（常规流程、07 页面工厂、08 页面锁定器），实际 ${developerInlineTitleRails.length} 条。`);
const productMarketInlineTitleRails = productMarket.match(/data-shared-window-title-actions="inline"/gu) ?? [];
if (productMarketInlineTitleRails.length < 4) throw new Error(`产品市场旧设置弹窗应至少登记 4 条共享 inline 标题操作轨，实际 ${productMarketInlineTitleRails.length} 条。`);
for (const token of [
  'data-shared-dialog-contract="customer-service-chat"',
  'data-shared-window-kind="chat"',
  'data-shared-window-title-actions="stacked"',
]) {
  if (!aiServiceWidget.includes(token)) throw new Error(`客服聊天弹窗的 stacked 例外缺少：${token}`);
}
for (const token of [
  ':not([data-shared-window-kind="chat"])',
  '[data-shared-window-title-actions="inline"]',
  '[data-shared-dialog-contract="customer-service-chat"][data-shared-window-kind="chat"]',
  '[data-shared-window-title-actions="stacked"]',
]) {
  if (!styles.includes(token)) throw new Error(`弹窗标题操作轨全局样式或客服例外缺少：${token}`);
}
for (const token of [
  'data-development-standard-application-scope-options="separate-capsules"',
  'data-shared-selection-group="right-side"',
  'data-development-standard-application-scope-capsule="current-page"',
  'data-development-standard-application-scope-capsule="global"',
  'data-shared-selection-control="true"',
  "--tradepro-shared-selection-outline",
  "--tradepro-shared-selection-bg",
  "--tradepro-shared-selection-text",
]) {
  if (!`${developmentApplyConsole}\n${styles}`.includes(token)) throw new Error(`开发器当前页／全局独立胶囊缺少右侧选中共享契约：${token}`);
}
for (const token of [
  "DEVELOPER_WORKFLOW_OUT_OF_ORDER_NOTICE_PATTERN",
  "resolveVisibleDeveloperWorkflowNotice",
  "setWorkflowNotice(resolveVisibleDeveloperWorkflowNotice(error))",
]) {
  if (!developmentApplyConsole.includes(token)) throw new Error(`开发器流程顺序英文错误隐藏规则缺少：${token}`);
}
if (developmentApplyConsole.includes("setWorkflowNotice(error instanceof Error ? error.message")) {
  throw new Error("开发器仍在向界面直接透传流程内部错误文字。");
}
for (const token of [
  "data-development-standard-top-level-count={DEVELOPER_TOP_LEVEL_APPS.length}",
  "LazySharedContractWorkbench",
  "LazyDeveloperFigmaDesignWorkbench",
  "LazyDeveloperVisualEvidenceWorkbench",
  "LazyPerformanceExperienceWorkbench",
  "LazyPerformanceQualityReleaseWorkbench",
  "DeveloperRecordPanel",
  "data-development-standard-application-record-projection",
  "appendPageLockReceipt",
  "applyPageLockOperation",
  "data-developer-active-footer-summary",
]) {
  if (!developmentApplyConsole.includes(token)) throw new Error(`开发器缺少优化加载体验入口：${token}`);
}
for (const token of [
  '"id": "visual-frame"',
  '"id": "shared-contract"',
  '"id": "figma-ui"',
  '"id": "visual-evidence"',
  '"id": "performance-experience"',
  '"id": "quality-release"',
  '"id": "page-factory"',
  '"id": "page-lock"',
  '"label": "全局框架器"',
  '"label": "共享契约器"',
  '"label": "Figma 插件 UI"',
  '"label": "可视化验证台"',
  '"label": "优化加载体验"',
  '"label": "质量与发布中心"',
  '"label": "页面工厂"',
  '"label": "页面锁定器"',
]) {
  if (!developerOptimizationContract.includes(token)) throw new Error(`开发器统一应用契约缺少：${token}`);
}
for (const [source, token, label] of [
  [figmaDesignWorkbench, "data-developer-figma-design-workbench", "Figma 插件 UI"],
  [visualEvidenceWorkbench, "data-developer-visual-evidence-workbench", "可视化验证台"],
]) {
  if (!source.includes(token)) throw new Error(`${label}缺少稳定工作台根选择器：${token}`);
}
for (const token of [
  "data-performance-experience-workbench",
  'data-performance-experience-auto-learning="true"',
  'data-performance-experience-ui="flat"',
  "自动学习：已启用",
  "立即检测",
  "应用安全加载",
  "data-performance-experience-cleanup-playbook",
  'data-performance-experience-source-review="advisory"',
  "data-performance-experience-cleanup-step",
  "data-performance-experience-cleanup-order",
  "data-performance-experience-preserve-boundary",
  "data-performance-experience-native-action",
  "data-performance-experience-metric-group",
  "data-performance-experience-route-trend",
  "路由与脚本",
  "主线程与渲染",
  "存储与媒体",
  "data-performance-experience-historical-patterns",
  "data-performance-experience-learned-issues",
]) {
  if (!performanceExperienceWorkbench.includes(token)) throw new Error(`优化加载体验工作台不完整：${token}`);
}
if (performanceExperienceWorkbench.includes('@/components/ui/button')) {
  throw new Error("优化加载体验的轻操作仍依赖重型 Button 包装。");
}
for (const token of [
  "PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT",
  "DEVELOPER_LOADING_SPEED_LEARNING_CONTRACT",
  "PERFORMANCE_EXPERIENCE_HISTORICAL_PATTERNS",
  "PERFORMANCE_EXPERIENCE_CLEANUP_PLAYBOOK",
  "PERFORMANCE_EXPERIENCE_PRESERVED_CAPABILITIES",
  'autoLearning: true',
  'sourceReviewMode: "advisory"',
  "automaticSourceRewrite: false",
  "cleanupPlaybook: PERFORMANCE_EXPERIENCE_CLEANUP_PLAYBOOK",
  "preservedCapabilities: PERFORMANCE_EXPERIENCE_PRESERVED_CAPABILITIES",
  "applicationLearning: DEVELOPER_LOADING_SPEED_LEARNING_CONTRACT",
  'storageKey: "tradepro.performance-experience-learning.v2"',
  'auditStorageKey: "tradepro.performance-experience-audits.v2"',
  'maxAuditEntriesPerIdentity: 5',
  'storageMetricsTtlMs: 15_000',
  '"slow-route-fallback"',
  '"large-route-script"',
  '"layout-instability"',
  '"oversized-image-decode"',
  '"oversized-storage-entry"',
  "maxLongTaskMs",
  "layoutShiftScore",
  "localStorageEntries",
  "largestLocalStorageEntryBytes",
  "oversizedDecodedImages",
  "offscreenAutoplayMedia",
  "lazyLoadRetryCount",
  "lazyLoadRecoveryCount",
  "lazyLoadFailureCount",
  "duplicateRequestExcess",
  "PerformanceObserver.supportedEntryTypes.includes(\"layout-shift\")",
  'layoutShiftObserver.observe({ type: "layout-shift", buffered: true })',
  "layoutShiftObserver?.disconnect()",
  "media.autoplay",
  '"network-single-flight"',
  '"heavy-tool-lazy-load"',
  '"deferred-widget-owned-css"',
  '"tab-exclusive-control-boundary"',
  '| "deferred-widget-owned-css"',
  '| "tab-exclusive-control-boundary"',
  "栏目配置安全迁出 40 条、12535 bytes",
  "其余 11 位按每批最多 3 项",
  "客服大卡片排序壳迁入 5894 bytes",
  '"storage-signature-cache"',
  '"offscreen-render-skipping"',
  '"observer-feedback-control"',
  "automaticAuditCooldownMs",
  "startPerformanceExperienceLearning",
  "schedulePerformanceExperienceAudit",
  "runPerformanceExperienceAudit",
  "applyPerformanceExperiencePlanToCurrentRoute",
  "tradepro:performance-experience-learning",
]) {
  if (!performanceExperienceLearning.includes(token)) throw new Error(`性能体验自动学习共享契约不完整：${token}`);
}
for (const token of [
  "beginRouteLoadingObservation(routeTarget, location.key)",
  "startRouteFallbackObservation(routeTarget, routeVisitKey)",
  "finishRouteFallbackObservation(fallbackToken)",
  "routeVisitKey={location.key}",
]) {
  if (!app.includes(token)) throw new Error(`路由真实等待观测未接入共享页面边界：${token}`);
}
for (const token of [
  "routeLoadingObservations.delete(route)",
  "entry.initiatorType === \"script\"",
  "Math.max(entry.transferSize, entry.encodedBodySize, entry.decodedBodySize)",
  "fallbackMs",
  "scriptBytes",
  "largestScriptBytes",
  "ROUTE_LOADING_OBSERVED_EVENT_NAME",
]) {
  if (!routeLoadingPerformance.includes(token)) throw new Error(`路由回退与脚本体积观测不完整：${token}`);
}
if (`${performanceExperienceLearning}\n${routeLoadingPerformance}`.includes("EventTarget.prototype")) {
  throw new Error("性能体验学习不得劫持 EventTarget 全局监听器。");
}
if (!performanceExperienceLearning.includes("window.addEventListener(ROUTE_LOADING_OBSERVED_EVENT_NAME, onRouteLoadingObserved)")
  || !performanceExperienceLearning.includes("window.removeEventListener(ROUTE_LOADING_OBSERVED_EVENT_NAME, onRouteLoadingObserved)")) {
  throw new Error("路由回退完成后的复审监听必须成对注册和释放。");
}
if (!performanceExperienceLearning.includes("window.addEventListener(PAGE_LOAD_RECOVERY_EVENT_NAME, onPageLoadRecovery)")
  || !performanceExperienceLearning.includes("window.removeEventListener(PAGE_LOAD_RECOVERY_EVENT_NAME, onPageLoadRecovery)")) {
  throw new Error("懒加载恢复信号必须成对监听和释放。");
}
for (const token of [
  'export const PAGE_LOAD_RECOVERY_EVENT_NAME = "tradepro:page-load-recovery"',
  "new CustomEvent(PAGE_LOAD_RECOVERY_EVENT_NAME",
]) {
  if (!lazyModuleRecovery.includes(token)) throw new Error(`懒加载恢复事件契约不完整：${token}`);
}
for (const token of [
  "MAX_ROUTE_RECOVERY_METRICS = 80",
  "MAX_ROUTE_RECOVERY_PHASE_COUNT = 99",
  "recordRouteRecoveryPhase(route, visitKey, detail.phase)",
  "entries.some((entry) => !entry.hadRecentInput && entry.value > 0)",
  "duplicateRequestExcess = resourceRequestCounts.reduce",
  "metrics.duplicateRequestExcess > thresholds.duplicateRequestExcess",
]) {
  if (!performanceExperienceLearning.includes(token)) throw new Error(`性能恢复与重复请求学习不完整：${token}`);
}
if (performanceExperienceLearning.includes("detail.message")) {
  throw new Error("性能学习不得持久化懒加载错误文本。");
}
if (performanceExperienceLearning.includes(".pause()") || performanceExperienceLearning.includes(".pause(")) {
  throw new Error("离屏自动播放只允许检测，不得改变媒体播放状态。");
}
const cleanupStepIds = [
  "remove-visual-shells",
  "inherit-surface-colors",
  "flatten-light-actions",
  "defer-non-first-screen",
  "remove-retired-implementations",
  "internalize-deferred-props",
  "prune-imports-and-helpers",
  "verify-preserved-capabilities",
];
let previousCleanupStepPosition = -1;
cleanupStepIds.forEach((id, index) => {
  const position = performanceExperienceLearning.indexOf(`id: "${id}"`);
  if (position <= previousCleanupStepPosition) throw new Error(`八步轻量化源码复核顺序或稳定 ID 错误：${id}`);
  const stepSource = performanceExperienceLearning.slice(position, position + 900);
  if (!stepSource.includes(`order: ${index + 1},`) || !stepSource.includes('mode: "advisory-source-review"')) {
    throw new Error(`八步轻量化源码复核缺少顺序或 advisory 模式：${id}`);
  }
  previousCleanupStepPosition = position;
});
for (const id of ["drag-sort", "tree-crud", "icon-upload", "horizontal-scroll-sync", "business-state"]) {
  if (!performanceExperienceLearning.includes(`id: "${id}"`)) throw new Error(`轻量化保护边界缺少：${id}`);
}
if ((performanceExperienceLearning.match(/cleanupPlaybook: PERFORMANCE_EXPERIENCE_CLEANUP_PLAYBOOK/g) || []).length !== 2
  || (performanceExperienceLearning.match(/preservedCapabilities: PERFORMANCE_EXPERIENCE_PRESERVED_CAPABILITIES/g) || []).length !== 2) {
  throw new Error("八步轻量化源码复核与保护边界必须同时进入代码目录和工作台快照。");
}
for (const token of [
  "getAuditScheduleKey(scope, route)",
  "getAuditIdentity(scope, route)",
  "lastAutomaticAuditAtByIdentity",
  "scheduledAudits.has(auditKey)",
  "scheduledAudits.set(auditKey, timer)",
  "scheduledAudits.delete(auditKey)",
]) {
  if (!performanceExperienceLearning.includes(token)) throw new Error(`快速切路由审计调度仍未按 scope + route 隔离：${token}`);
}
for (const token of [
  "getAuditTrendSignature",
  "limitAuditHistory",
  "maxAuditEntriesPerIdentity",
  "getPerformanceExperienceSnapshot(scope",
  "getAuditIdentity(audit.scope, audit.route) === identity",
  "snapshot.latestAudit.scope === scope",
  "entry.scope === scope && entry.route === snapshot.route",
  "snapshot.auditTrend.slice(-3).reverse()",
]) {
  if (!`${performanceExperienceLearning}\n${performanceExperienceWorkbench}`.includes(token)) throw new Error(`性能趋势未按 scope + route 稀疏保留：${token}`);
}
if (/EventTarget\.prototype|(?:window|globalThis)\.fetch\s*=/.test(`${performanceExperienceLearning}\n${routeLoadingPerformance}`)
  || performanceExperienceLearning.includes("location.reload")) {
  throw new Error("性能学习不得劫持全局监听/请求或触发页面自动重载。");
}
for (const token of ["startPerformanceExperienceLearning(scope)", "schedulePerformanceExperienceAudit(scope)", "stopPerformanceExperienceLearning()"] ) {
  if (!visualResponsiveContract.includes(token)) throw new Error(`三端运行时未接入性能体验自动学习：${token}`);
}
const canaryAuditStart = visualProjectContractHost.indexOf('if (applicationScope === "canary-profile")');
const canaryAuditEnd = visualProjectContractHost.indexOf("const persistedGlobalSeed", canaryAuditStart);
if (canaryAuditStart < 0 || canaryAuditEnd <= canaryAuditStart
  || !visualProjectContractHost.slice(canaryAuditStart, canaryAuditEnd).includes("recordPageCompositionAudit")) {
  throw new Error("独立 canary-profile 未在真实页面 Host 建立页面组合审计。");
}
if (/源码一|源码二|页面一|页面二|栏目一|栏目二/.test(developmentApplyConsole)) {
  throw new Error("页面锁定器仍保留重复的一级／二级锁按钮。");
}
for (const token of [
  "data-development-standard-vertical-marker-contract",
  "VERTICAL_CONTEXT_CAPSULE_CONTRACT",
  "竖行标注：主体必须使用主体外框左侧预留空白槽，禁止覆盖标题；表内、内容使用左侧竖行上下结构",
  "竖行契约保护：清理主体侵入标题内容、停在框内或使用右侧旧位的覆盖规则",
  "竖行标注：主体统一读取主体外框左侧预留空白槽且不得覆盖标题，表内、内容读取各自左侧竖行上下结构",
]) {
  if (!`${developmentApplyConsole}\n${layoutFrameContract}`.includes(token)) throw new Error(`三端开发器竖行标注契约缺失：${token}`);
}
for (const token of [
  "UNIFIED_PAGE_FRAME_REGIONS",
  'regionStrategy: "explicit"',
  "pageVerticalOwners: 1",
  'mode: "batch-gated"',
  "globalButton: false",
]) {
  if (!unifiedFrameContract.includes(token)) throw new Error(`统一页面框架治理契约缺失：${token}`);
}
for (const token of [
  "data-unified-frame-migration-workbench",
  'data-unified-frame-release-mode={workflowScope === "global" ? "batch-gated" : "current-page-only"}',
  'data-unified-frame-business-boundary="preserve"',
  "data-unified-frame-baseline-gate",
  "data-unified-frame-batch-plan",
]) {
  if (!unifiedFrameWorkbench.includes(token)) throw new Error(`可视化框架迁移工作台缺失：${token}`);
}
if (!overrides.includes('const removedLegacyProductMarketCardWidth = variables["--tradepro-shared-product-market-card-min-width"] === "14rem"')) {
  throw new Error("开发器未学习小卡片旧宽度覆盖清理契约。");
}

for (const token of ["development-standard-marker-bg", "development-standard-marker-text", "[data-development-standard-style-nav]::after { content: \"顶部\"; }", "[data-development-standard-title-header]::after { content: \"标题\"; }", "[data-development-standard-application-footer]::after { content: \"尾栏\"; }", "data-development-standard-apply-dialog] [data-development-standard-content-frame", "development-standard-content-inset", "data-development-standard-settings-panel] button:not([data-development-standard-plugin])"]) {
  if (!styles.includes(token)) throw new Error(`Development Standard application hover marker is incomplete: ${token}`);
}

const standardModuleCount = (developmentCatalog.match(/\{ id: "/g) || []).length;
if (standardModuleCount !== 13) throw new Error(`Development Standard requires the market standard plus 12 business standards, found ${standardModuleCount}.`);
for (const token of ["data-development-standard-quick-switch", "data-development-standard-quick-item", "data-development-application-launcher", "data-development-standard-apply-dialog", "DraggableDialogContent", "resizable", "minWidth={320}", "minHeight={420}", "showCloseButton", "getDevelopmentStandardRoute", "customer-roadmap"]) {
  if (!externalDevtoolsMenu.includes(token)) throw new Error(`Development Standard source entry is incomplete: ${token}`);
}
for (const token of ["data-dialog-close", "data-development-standard-close", "data-content-plugin-control=\"close\""]) {
  if (!sharedDialog.includes(token)) throw new Error(`Shared dialog close contract is incomplete: ${token}`);
}

for (const token of [
  "data-crm-development-standard",
  'data-development-standard-hidden-route="crm"',
  'currentTab === "development"',
  "CRM 管理 · B2B 工厂客户开发规范",
  "模板只同步结构与规则",
]) {
  if (!customers.includes(token)) throw new Error(`CRM development standard is incomplete: ${token}`);
}
const crmSecondaryNavigation = customers.slice(customers.indexOf("<TabsList data-client-project-subnav"), customers.indexOf("</TabsList>"));
if (crmSecondaryNavigation.includes('value="development"')) {
  throw new Error("CRM development standard must not appear in the CRM secondary navigation.");
}
const productMarketVisibleNavigation = productMarketNavigation.slice(productMarketNavigation.indexOf("PRODUCT_MARKET_NAV_ITEMS"), productMarketNavigation.indexOf("] as const;"));
if (productMarketVisibleNavigation.includes('tab: "development"')) {
  throw new Error("Product Market development standard must not appear in the Product Market secondary navigation.");
}
if (!productMarketNavigation.includes('return value === "development" || isProductMarketNavTab(value);')) {
  throw new Error("Product Market hidden development route is no longer resolvable.");
}
const socialVisibleNavigation = socialMedia.slice(socialMedia.indexOf("const TABS = ["), socialMedia.indexOf("] as const;", socialMedia.indexOf("const TABS = [")));
if (socialVisibleNavigation.includes('key: "customer-roadmap"')) {
  throw new Error("Social Media pain-point roadmap must not appear in the Social Media secondary navigation.");
}
for (const token of ['data-development-standard-quick-item="crm"', "/customers?tab=development", "/social?tab=customer-roadmap"]) {
  if (!externalDevtoolsMenu.includes(token)) throw new Error(`Hidden development-standard route is missing from specification entry: ${token}`);
}

for (const token of ["data-development-standard-responsive-frame", "data-development-standard-content-frame"]) {
  if (!developmentApplyConsole.includes(token)) throw new Error(`Development Standard responsive application is incomplete: ${token}`);
}

for (const token of [
  'hq: "/zb/product-market?tab=development"',
  'agency_source: "/zb/agency-source/product-market?tab=development"',
  'client_source: "/zb/client-source/product-market?tab=development"',
  "<DevelopmentStandardApplyConsole pathname={location.pathname} search={location.search} readOnly={!guideRoute} sourceLabel={sourceLabel} />",
]) {
  if (!externalDevtoolsMenu.includes(token)) throw new Error(`总部、代理源、客户源未共享同一开发器应用契约：${token}`);
}
for (const token of [
  'sourceScopes: ["hq", "agency_source", "client_source"]',
  'failedPagePolicy: "isolate-and-keep-current-adapter"',
  '"business-data"',
  '"page-content"',
  '"plugins"',
  '"formal-backups"',
]) {
  if (!unifiedFrameContract.includes(token)) throw new Error(`统一页面框架三端与数据保护边界缺失：${token}`);
}
if (unifiedFrameWorkbench.includes("data-unified-frame-publish-global") || unifiedFrameWorkbench.includes("data-global-styler")) {
  throw new Error("可视化框架不得保留旧全局发布入口。");
}

const settingsWorkspaceRules = styles.match(/\[data-product-market-workspace\]\[data-product-market-settings-route="true"\]\s*\{[\s\S]{0,520}?\}/g) || [];
const canonicalSettingsWorkspaceRule = settingsWorkspaceRules.find(
  (rule) => rule.includes("border: 0 !important;") && rule.includes("background: transparent !important;")
);
if (!canonicalSettingsWorkspaceRule) {
  throw new Error("设置页工作区必须读取透明、无边框的共享外壳契约。");
}

for (const token of [
  "#root [data-product-market-table-shell] {",
  "padding: var(--tradepro-shared-table-shell-padding, var(--tradepro-layout-space, 0.75rem));",
  "表内框直属表头只负责外框边界",
  "> [data-shared-layout-section=\"header\"]",
  "--tradepro-shared-workspace-bg: transparent;",
  "--tradepro-shared-list-scroll-end-space: 3.75rem;",
  "--tradepro-shared-workspace-scroll-track: transparent;",
  "scroll-padding-bottom: var(--tradepro-shared-list-scroll-end-space, 3.75rem);",
  "交互式主题／服务表头自己拥有标题到表头的唯一 12px 节距",
  "padding-top: 0 !important;",
]) {
  if (!styles.includes(token)) throw new Error(`栏目配置未读取运营市场共享表内框契约：${token}`);
}
if (!styles.includes("background: transparent;")) {
  throw new Error("产品市场内容滚动层的 60px 底部操作空间必须保持透明。");
}
for (const token of [
  "data-product-market-category-heading",
  "data-product-market-category-divider",
  "data-product-market-module-category-heading",
  "--tradepro-product-market-content-text",
  "经营分组标题属于内容导航",
]) {
  if (!`${productMarket}\n${styles}\n${productMarketModulesStyles}`.includes(token)) throw new Error(`运营市场经营分组标题未读取内容区字体共享契约：${token}`);
}
if (productMarket.includes('data-product-market-category-heading\n                      className="flex items-center gap-2 px-1 pb-1 text-[11px] font-medium text-slate-300"')) {
  throw new Error("运营市场经营分组标题仍保留固定弱化文字颜色。");
}
for (const token of ["data-source-nav-category-label", "data-source-nav-category-divider"]) {
  if (!`${clientSidebar}\n${agencySourceSidebar}\n${hqSidebar}\n${styles}`.includes(token)) {
    throw new Error(`三端左侧导航未共享经营分组内容区字体契约：${token}`);
  }
}
if (clientSidebar.includes("tracking-wide text-slate-300")) {
  throw new Error("客户源左侧导航经营分组仍保留固定弱化文字颜色。");
}
if (styles.includes('[data-product-market-settings-route="true"]\n  [data-product-market-table-shell="true"]')) {
  throw new Error("栏目配置仍保留表内框的私有高优先级覆盖。");
}
const productMarketModuleContractSource = `${productMarket}\n${productMarketModules}`;
if (!productMarketModuleContractSource.includes('data-product-market-table-shell="true"') || !productMarketModuleContractSource.includes('data-shared-layout-section="header"\n                  data-product-market-table-header')) {
  throw new Error("栏目配置表头仍未作为共享表内框的直接子节点。");
}
for (const retiredPrivateHeaderGeometry of [
  "margin-left: var(--tradepro-shared-content-gutter, 0.75rem) !important;",
  "margin: var(--tradepro-template-card-edge-inset) var(--tradepro-template-card-right-inset) 0 var(--tradepro-template-card-edge-inset) !important;",
]) {
  if (styles.includes(retiredPrivateHeaderGeometry)) throw new Error(`栏目配置仍保留私有表头几何规则：${retiredPrivateHeaderGeometry}`);
}
for (const token of [
  'data-product-market-layout-header-mode="palette"',
  'data-template-config-table-palette="true"',
  'data-shared-layout-section="tableHeader"',
  'data-product-market-table-shell="true"',
  'data-development-standard-frame-label="表内"',
]) {
  if (!productMarket.includes(token)) throw new Error(`Layout Style theme-header exception contract is incomplete: ${token}`);
}
const layoutPanelStart = productMarket.indexOf('{activeSettingsTab === "layout" ? (');
const layoutPanelEnd = productMarket.indexOf('{/* Tab 4: Sound + Customer Service */}', layoutPanelStart);
const layoutPanel = productMarket.slice(layoutPanelStart, layoutPanelEnd);
if (!layoutPanel.includes('data-product-market-table-shell="true"') || !layoutPanel.includes('data-development-standard-frame-label="表内"') || !layoutPanel.includes('data-shared-layout-section="list"')) {
  throw new Error("版面风格缺少唯一表内框、滚动内容与下方圆角的共享结构契约。");
}
for (const retiredLayoutUtility of [
  "template-config-layout-panel m-0 h-full min-h-0 w-full flex-col overflow-hidden !mt-0 flex\">\n              <ScrollArea\n                data-shared-layout-section=\"list\"\n                data-page-list-scroll-owner\n                className=\"nav-matrix-body min-h-0 w-full flex-1 px-3 pb-28 pt-3",
  "w-full flex flex-col gap-5 pb-1",
]) {
  if (productMarket.includes(retiredLayoutUtility)) throw new Error(`Layout Style retains overridden utility geometry: ${retiredLayoutUtility}`);
}
for (const token of [
  "交互式主题表头：展开时必须保留主题自己的底色",
  "background: var(--tradepro-panel-table-bg) !important;",
  "--tradepro-hover-capsule-bg: var(--tradepro-panel-table-bg) !important;",
]) {
  if (!styles.includes(token)) throw new Error(`Layout Style theme-header exception is incomplete: ${token}`);
}
for (const token of [
  'data-product-market-service-header-mode="audio"',
  'data-template-config-service-header="true"',
  "--tradepro-shared-table-header-bg",
  "--tradepro-shared-table-header-text",
]) {
  if (!`${productMarket}\n${styles}`.includes(token)) throw new Error(`Customer Service audio-header exception is incomplete: ${token}`);
}
const servicePanelStart = productMarket.indexOf('{activeSettingsTab === "service" ? (');
const servicePanelEnd = productMarket.indexOf('{/* Tab 4: Sound + Customer Service */}', servicePanelStart + 1);
const servicePanel = productMarket.slice(servicePanelStart, servicePanelEnd < 0 ? undefined : servicePanelEnd);
for (const token of [
  'data-product-market-table-shell="true"',
  'data-development-standard-frame-label="表内"',
  'data-shared-layout-section="list"',
  'data-development-standard-frame-label="内容"',
  'data-development-standard-frame-label="表头"',
]) {
  if (!servicePanel.includes(token)) throw new Error(`Customer Service shared-frame contract is incomplete: ${token}`);
}
const customerServiceCardSource = `${productMarket}\n${productMarketCustomerServiceSection}`;
for (const token of [
  'data-development-standard-frame-region="large-card"',
  'data-shared-large-card-surface="true"',
  'data-development-standard-frame-label="大卡片"',
  'className={`template-config-service-card',
]) {
  if (!customerServiceCardSource.includes(token)) throw new Error(`Customer Service expert cards must remain attached to the shared large-card marker: ${token}`);
}
for (const token of [
  'data-current-expert-avatar-preview="true"',
  'data-customer-service-reminder-marker-anchor={soundIndex === 0 ? "first-sound-card-left-top" : undefined}',
  'data-development-standard-marker-placement="card-left-top"',
]) {
  if (!productMarket.includes(token)) throw new Error(`Customer Service left-top small-card marker contract is incomplete: ${token}`);
}
if (!sharedCardStyles.includes('[data-development-standard-marker-placement="card-left-top"]::after')) {
  throw new Error("Customer Service left-top small-card marker CSS is missing.");
}
for (const token of [
  "#root [data-product-market-table-shell] > [data-shared-scroll-contract=\"table-inner-60\"]",
  "#root [data-product-market-table-shell] [data-product-market-table-header]",
  "--tradepro-shared-scrollbar-thumb",
  "[data-template-module-table-header=\"true\"] [data-template-module-split]",
  "padding: var(--tradepro-shared-table-header-padding, 0.5rem 0.75rem) !important;",
]) {
  if (!styles.includes(token)) throw new Error(`栏目配置未从旧设置页覆盖中隔离并读取共享结构：${token}`);
}
for (const token of [
  'SHARED_SMALL_CARD_MARKER_AUTOMATIC_SCOPE_SELECTOR',
  'SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE',
  'SHARED_SMALL_CARD_MARKER_RESOLUTION',
  'smallCardMarkerSourceDeclarations: "central-effective-result-is-the-only-marker-ownership-truth"',
]) {
  if (!sharedWindowContract.includes(token)) throw new Error(`全局小卡片代表标注契约不完整：${token}`);
}
for (const token of [
  "--responsive-large-card-marker-top-inset",
  'data-development-standard-marker="silent"',
]) {
  if (!styles.includes(token)) throw new Error(`大／小卡片共享标注样式不完整：${token}`);
}

for (const token of ["flex min-h-0 flex-1 flex-col overflow-hidden", "min-h-0 flex-1 overflow-y-auto", "data-page-list-scroll-owner"]) {
  if (!unifiedFrameWorkbench.includes(token)) throw new Error(`可视化框架响应式与唯一滚动容器缺失：${token}`);
}

const developmentListStart = productMarketDevelopmentGuide.indexOf("data-product-market-development-list");
const workbenchEntry = productMarketDevelopmentGuide.indexOf("<DevelopmentStandardWorkbench />");
if (developmentListStart < 0 || workbenchEntry < developmentListStart) {
  throw new Error("Development Standard workbench must remain inside its sole scroll owner.");
}

for (const stage of ["立项与责任划分", "来源基线与方案设计", "开发、验证与验收", "预演、审批与单向发布", "运行审计与定向恢复"]) {
  if (!developmentGovernance.includes(stage)) throw new Error(`开发规范统一治理缺少：${stage}`);
}

for (const operation of ["页面入口与历史清扫", "中文编码与规范闸门", "面板分工维护", "审计、备份与定向恢复", "真实截图回归", "发布前模拟与差异确认"]) {
  if (!developmentPanels.includes(operation)) throw new Error(`开发规范后续运作流程缺少：${operation}`);
}

for (const retired of ["AutoLayoutDeveloper", "PageCleanupQuickAction", "auto-layout-card-content.css"]) {
  if (main.includes(retired)) throw new Error(`运行入口仍依赖已退役实现：${retired}`);
}
if (overrides.includes("page-cleaner") || overrides.includes("layout-developer")) {
  throw new Error("页面样式配置仍保留旧工具兼容来源。");
}
if (lock.includes("tool:layout-developer") || lock.includes("tool:page-cleaner")) {
  throw new Error("页面锁定仍登记旧工具入口。");
}

console.log("开发规范主链已验证：新组合、插件边界、双模式、迁移、审计与恢复均为唯一入口。");
