import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const frontendRoot = resolve(import.meta.dirname, "..");
const sourceRoot = resolve(frontendRoot, "..");

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(frontendRoot, relativePath), "utf8"));
}

function readSource(relativePath) {
  return readFileSync(resolve(sourceRoot, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`页面工厂契约失败：${message}`);
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortDeep(value[key])]));
  }
  return value;
}

const standard = readJson("src/page-factory/page-factory-standard.json");
const registry = readJson("src/page-factory/page-registry.json");
const commands = readJson("src/page-factory/page-command-catalog.json");
const snapshot = readJson("src/page-factory/factory-default-snapshot.json");
const inventory = readJson("src/page-factory/page-inventory.json");
const inventoryBaseline = readJson("src/page-factory/page-inventory-baseline.json");
const verification = readJson("src/page-factory/phase-two-verification.json");
const workbench = readSource("frontend/src/components/product-market/PageFactoryWorkbench.tsx");
const mediaOptimizationContract = JSON.parse(readSource("shared/contracts/media-optimization-contract.json"));

assert(standard.schemaVersion === 1 && registry.schemaVersion === 1 && commands.schemaVersion === 1, "JSON schemaVersion 必须为 1");
assert(standard.factoryVersion === registry.factoryVersion && snapshot.factoryVersion === standard.factoryVersion, "工厂、登记表、默认快照版本必须一致");
assert(standard.templates.length === 7, "必须保留七类页面模板");
assert(standard.regions.length === 11 && new Set(standard.regions).size === 11, "必须保留十一类页面区域");
assert(standard.frameOwnershipModes?.join(",") === "factory-shell,existing-workspace", "页面工厂必须区分自有外框与既有共享工作区两种框架归属");
assert(Object.keys(standard.templateRegions).sort().join(",") === [...standard.templates].sort().join(",") && Object.values(standard.templateRegions).every((regions) => regions.includes("top") && regions.includes("body") && regions.includes("title-1") && regions.includes("footer") && regions.every((region) => standard.regions.includes(region))), "七类模板必须声明核心区域和适用的共享区域子集");
assert(standard.requiredCapabilities.length === 6 && new Set(standard.requiredCapabilities).size === 6, "必须保留六项固定能力");
assert(standard.domainContracts?.customerServiceExpert?.contentSource === "current-expert-voice-customization", "页面工厂必须登记当前专家真人朗音自定义唯一事实源");
assert(standard.domainContracts?.customerServiceExpert?.identityFields?.join(",") === "gender,title,animation", "客服专家左列必须固定为性别、头衔、动画");
assert(standard.domainContracts?.customerServiceExpert?.behaviorFields?.join(",") === "customer-service-name,greeting,reminder,voice", "客服专家右列必须固定为名称、招呼、提醒、朗音");
assert(standard.domainContracts?.customerServiceExpert?.capacityPlugin === "shared-service-expert-capacity-v4" && standard.domainContracts?.customerServiceExpert?.minimumCardInlineSize === 222 && standard.domainContracts?.customerServiceExpert?.maximumColumns === null && standard.domainContracts?.customerServiceExpert?.controlEdgeInset === 8 && standard.domainContracts?.customerServiceExpert?.controlGap === 8 && standard.domainContracts?.customerServiceExpert?.selectionCopy === "seven-character-total-shared-behavior-ellipsis-v3" && standard.domainContracts?.customerServiceExpert?.layout === "centered-avatar-eight-gap-fact-columns-v4", "客服专家选择卡必须使用 222px 响应式下限、无列数上限、8px 控件边距与间距、字段名在内七字省略、编号朗音与双列共享摘要布局");
assert(standard.domainContracts?.customerServiceExpert?.projections?.join(",") === "select-expert-card,current-expert-editor,sidebar-expert-dialog,chat-expert-picker,customer-service-chat", "客服专家事实源必须投影到选择、编辑、左栏弹窗、换专家和聊天窗口");
assert(standard.scopes.join(",") === "hq,agency_source,client_source", "必须由总部端、代理源、客户源共同治理");
assert(commands.commands.length === 7 && new Set(commands.commands.map((item) => item.id)).size === 7, "命令目录必须包含七条唯一命令");
assert(commands.commands.find((item) => item.id === "new")?.command.includes("--component <component>"), "新建命令必须显式提供组件路径");

const pageIds = registry.pages.map((page) => page.id);
assert(inventory.schemaVersion === 1 && inventory.phase === "page-factory-phase-2" && inventory.mode === "read-only-census", "Phase-two inventory must be read-only");
assert(inventory.inventoryVersion === standard.factoryVersion, "Inventory and factory versions must match");
assert(inventoryBaseline.schemaVersion === 1 && inventoryBaseline.mode === "code-owned-read-only-baseline" && inventoryBaseline.inventoryVersion === standard.factoryVersion, "Census baseline and factory versions must match");
assert(inventory.baselineDiff.status === "unchanged" && inventory.baselineDiff.baselineVersion === standard.factoryVersion && inventory.baselineDiff.currentFingerprint === inventoryBaseline.fingerprint, "Census difference baseline must be current and unchanged");
assert(inventory.phaseProgress.completedPercent === 100 && inventory.phaseProgress.version === standard.factoryVersion && inventory.phaseProgress.steps.length === 5 && inventory.phaseProgress.steps.every((step) => step.complete), "Phase-two governance progress must be complete and versioned");
assert(verification.schemaVersion === 1 && verification.factoryVersion === standard.factoryVersion && verification.governancePercent === 100 && verification.routeCoveragePercent === 100, "Phase-two verification record must match the completed factory version");
assert(verification.status === "passed" && typeof verification.recordedAt === "string" && verification.recordedAt.length > 0 && verification.checks.length >= 8 && verification.checks.every((check) => check.status === "passed"), "Phase-two verification record must persist only a fully passed final result");
for (const checkId of ["source-lock", "page-factory-catalog", "backend-tests", "typescript", "responsive-contract", "responsive-e2e", "page-factory-e2e", "production-build"]) {
  assert(verification.checks.some((check) => check.id === checkId), `Phase-two verification record is missing ${checkId}`);
}
const productMarketEvidence = verification.latestProductMarketRuntimeVersionConsistencyRetestRevision;
assert(productMarketEvidence && productMarketEvidence.factoryVersion === standard.factoryVersion && productMarketEvidence.completionPercent === 100 && productMarketEvidence.governancePercent === 100 && productMarketEvidence.routeCoveragePercent === 100, "Latest Product Market evidence must be complete and match the Page Factory version");
assert(/^H\d+$/.test(productMarketEvidence.targetHVersion) && Date.parse(productMarketEvidence.recordedAt) > Date.parse(verification.recordedAt), "Latest Product Market evidence must expose a newer H-versioned timestamp");
for (const token of ["data-page-factory-product-market-evidence", "latestProductMarketEvidence.targetHVersion", "latestProductMarketEvidence.validation", "最新一致性证据"]) {
  assert(workbench.includes(token), `07 Page Factory must visibly consume the latest Product Market evidence: ${token}`);
}
const avatarMediaEvidence = verification.latestCustomerServiceAvatarFirstPaintFallbackRevision;
assert(avatarMediaEvidence && avatarMediaEvidence.factoryVersion === standard.factoryVersion && avatarMediaEvidence.completionPercent === 100 && avatarMediaEvidence.governancePercent === 100 && avatarMediaEvidence.routeCoveragePercent === 100, "Latest customer-service avatar media evidence must be complete and match the Page Factory version");
assert(/^H\d+$/.test(avatarMediaEvidence.targetHVersion) && Date.parse(avatarMediaEvidence.recordedAt) > Date.parse(verification.recordedAt), "Latest customer-service avatar media evidence must expose an H-versioned timestamp newer than phase two");
assert(avatarMediaEvidence.mediaContractVersion === mediaOptimizationContract.version, "07 avatar media evidence must identify the current shared media contract version");
assert(avatarMediaEvidence.avatarFirstPaintPolicy === mediaOptimizationContract.delivery.avatarFirstPaint.id && avatarMediaEvidence.avatarFirstPaintScope === mediaOptimizationContract.delivery.avatarFirstPaint.scope, "07 avatar media evidence must identify the shared never-empty first-paint policy and scope");
assert(avatarMediaEvidence.sharedContractEvidence === "developer-shared-contract+quality-center+shared-avatar-renderer", "07 avatar media evidence must bind Developer, Quality Center and the shared renderer");
for (const token of ["verify:media-optimization", "verify:page-factory", "25/25", "1/1", "5/5", "4/4"]) {
  assert(avatarMediaEvidence.validation.includes(token), `07 avatar media evidence is missing validation token ${token}`);
}
assert(inventory.totals.pageFiles >= 100 && inventory.totals.registered <= pageIds.length && inventory.totals.unregistered + inventory.totals.registered === inventory.totals.pageFiles && inventory.routingAudit.registryRouteIdentities === pageIds.length, "Source coverage and registered route-identity totals are incomplete");
assert(inventory.totals.routeEntries >= 80 && inventory.totals.routeEntries + inventory.totals.supportFiles === inventory.totals.pageFiles && inventory.totals.completedRouteEntries <= inventory.totals.registeredRouteEntries && inventory.totals.registeredRouteEntries <= inventory.totals.routeEntries, "Route-entry coverage totals are incomplete");
assert(inventory.totals.routeCoveragePercent === Number((inventory.totals.completedRouteEntries / inventory.totals.routeEntries * 100).toFixed(2)), "Coverage percentage must count only verified complete pages");
assert(Object.values(inventory.totals.routeRisk).reduce((sum, count) => sum + count, 0) === inventory.totals.routeEntries, "Route risk totals must only cover routable entries");
assert(inventory.routingAudit.literalRouteDeclarations > 0 && inventory.routingAudit.mappedRouteDeclarations === inventory.routingAudit.literalRouteDeclarations && inventory.routingAudit.unmappedRouteTargets.length === 0, "Every literal App route must have a source owner");
assert(inventory.routingAudit.expectedRouteIdentities > 0 && inventory.routingAudit.registeredRouteIdentities === inventory.routingAudit.expectedRouteIdentities && inventory.routingAudit.routeIdentityCoveragePercent === 100 && inventory.routingAudit.unregisteredRouteIdentities.length === 0 && inventory.routingAudit.ownershipMismatches.length === 0, "Every source-scoped App route identity must be registered to its real source owner");
assert(inventory.batches.length === 3 && inventory.batches.every((batch) => batch.mode === "review-only"), "Batches must remain review-only");
assert(inventory.planSummary.complete && inventory.planSummary.plannedRouteEntries === inventory.planSummary.eligibleRouteEntries && inventory.planSummary.unplannedPageIds.length === 0 && inventory.planSummary.duplicatePageIds.length === 0, "Every eligible route must appear in exactly one review batch");
assert(inventory.batches.every((batch) => batch.candidateCount === batch.candidatePageIds.length && batch.waves.flatMap((wave) => wave.candidatePageIds).join(",") === batch.candidatePageIds.join(",") && batch.waves.every((wave) => wave.mode === "single-page-authorized" && wave.candidatePageIds.length <= batch.waveSize)), "Batch waves must preserve the complete candidate order and single-page authorization boundary");
assert(inventory.guardrails.some((item) => item.includes("不批量接入")) && inventory.guardrails.some((item) => item.includes("数据库")), "Inventory guardrails are incomplete");
assert(inventory.pages.every((page) => page.analysis && Number.isInteger(page.analysis.lineCount) && page.analysis.lineCount > 0 && Number.isInteger(page.analysis.analyzedLineCount) && page.analysis.analyzedLineCount >= page.analysis.lineCount && Array.isArray(page.analysis.linkedSources) && Number.isInteger(page.analysis.riskScore) && Array.isArray(page.analysis.riskSignals)), "Every source page must include deterministic source-risk evidence");
assert(inventory.pages.some((page) => page.analysis.linkedSources.some((source) => source.includes("ContentLibraryEditor.tsx")) && page.analysis.analyzedLineCount > page.analysis.lineCount), "Thin route entries must inherit direct implementation risk evidence");
assert(pageIds.length >= 1 && new Set(pageIds).size === pageIds.length, "页面 id 必须唯一");
assert(registry.pages.some((page) => page.id === "product-analysis-interest-search" && page.route === "/product-analysis?tab=keyword-planner" && page.status === "pilot-complete"), "兴趣搜索试点必须正式登记");

const canonical = JSON.stringify(sortDeep({ standard, registry, commands }));
const digest = createHash("sha256").update(canonical, "utf8").digest("hex");
assert(snapshot.catalogSha256 === digest, "工厂默认快照指纹已过期，请通过验证后重新生成");
assert(JSON.stringify(snapshot.pageIds) === JSON.stringify(pageIds), "快照页面清单与登记表不一致");
assert(JSON.stringify(snapshot.preserves) === JSON.stringify(standard.factoryRestore.preserves), "快照必须保持受保护数据边界");

const consoleSource = readSource("frontend/src/components/product-market/DevelopmentStandardApplyConsole.tsx");
const developerOptimizationSource = readSource("shared/contracts/developer-optimization-contract.json");
const unifiedFrameWorkbenchSource = readSource("frontend/src/components/developer-platform/UnifiedFrameMigrationWorkbench.tsx");
const workbenchSource = readSource("frontend/src/components/product-market/PageFactoryWorkbench.tsx");
const entrySource = readSource("frontend/src/pages/ProductAnalysis.tsx");
const pilotSource = readSource("frontend/src/components/product-intelligence/ProductIntelligenceWorkspace.tsx");
const factorySource = readSource("frontend/src/page-factory/FactoryPage.tsx");
const overridesSource = readSource("frontend/src/lib/page-layout-overrides.ts");
const globalCssSource = readSource("frontend/src/index.css");
const pageFactoryRuntimeSource = readSource("frontend/src/page-factory/page-factory.ts");
const pageRouteIdentitySource = readSource("frontend/src/lib/page-route-identity.ts");
const pageCompositionManifestSource = readSource("frontend/src/lib/page-composition-manifest.ts");
const pageCompositionIdentitySource = readSource("frontend/src/lib/page-composition-identity.ts");
const developerAdapterRegistrySource = readSource("frontend/src/lib/developer-global-frame-adapter-registry.ts");
const cssSource = readSource("frontend/src/page-factory/page-factory.css");
const pythonSource = readSource("tools/page_factory.py");
const agentRules = readSource("AGENTS.md");
const pageFactoryE2eSource = readSource("frontend/e2e/page-factory.spec.ts");
const responsivePageHostCoreSource = readSource("frontend/src/components/ResponsivePageHost.tsx");
const responsivePageHostRuntimeSource = readSource("frontend/src/components/ResponsivePageHostRuntime.tsx");
const responsivePageHostSource = `${responsivePageHostCoreSource}\n${responsivePageHostRuntimeSource}`;

assert(responsivePageHostSource.includes("factoryIdentityChanged") && responsivePageHostSource.includes("ensureFactoryIdentityProjection();") && responsivePageHostSource.includes('record.attributeName === "data-page-factory-runtime-projection"'), "Lazy route identity hand-off must reconcile synchronously so a runtime projection and authored FactoryPage never expose duplicate page identities");
assert(responsivePageHostCoreSource.includes('const ResponsivePageHostRuntime = lazy(() => import("./ResponsivePageHostRuntime"))') && responsivePageHostCoreSource.includes("schedulePostPaintIdle(() => setRuntimeReady(true))") && responsivePageHostCoreSource.includes('<Fragment key="page-content">{children}</Fragment>'), "Page Factory host must keep content identity stable while deferring non-critical runtime projection until after first paint");

assert(
  consoleSource.includes("<UnifiedFrameMigrationWorkbench")
    && consoleSource.includes('activeTool === "page-factory"')
    && consoleSource.includes("<LazyPageFactoryWorkbench")
    && consoleSource.includes("data-development-standard-page-factory-lifecycle")
    && consoleSource.includes("data-development-standard-navigation-order-migration")
    && consoleSource.includes("const resolvePageFactorySourceRecords = useCallback")
    && consoleSource.includes("setPageFactorySourceRecords(records)")
    && consoleSource.includes("setPageFactorySourceRecordsResolved(true)")
    && consoleSource.includes("readOnly developerRecords={developerRecords} onSourceRecordsResolved={resolvePageFactorySourceRecords} onNavigate={navigate}"),
  "07 页面工厂必须作为独立只读治理栏目，并读取统一记录总账",
);
assert(
  unifiedFrameWorkbenchSource.includes("data-unified-frame-baseline-gate")
    && !unifiedFrameWorkbenchSource.includes("data-unified-frame-page-factory-read-only")
    && !unifiedFrameWorkbenchSource.includes("renderFactoryLifecycle")
    && !unifiedFrameWorkbenchSource.includes("data-global-frame-toggle-page-factory"),
  "01 全局框架器必须移除旧页面工厂嵌套入口，同时保留自身基准门禁",
);
assert(
  pageFactoryE2eSource.includes('data-development-standard-style-nav-item="page-factory"')
    && pageFactoryE2eSource.includes('page.locator("[data-global-frame-toggle-page-factory]")).toHaveCount(0)'),
  "页面工厂浏览器回归必须从独立 07 栏目进入，并确认旧入口不存在",
);
assert(
  consoleSource.includes("data-page-factory-usage-guide")
    && consoleSource.includes("PAGE_FACTORY_USAGE_STEPS")
    && consoleSource.includes("data-page-factory-protected-boundary"),
  "07 页面工厂独立治理视图必须保留使用步骤与受保护边界",
);
assert(
  developerOptimizationSource.includes('"id": "page-factory"')
    && developerOptimizationSource.includes('"id": "page-lock"')
    && consoleSource.includes("data-development-standard-page-lock-tree")
    && consoleSource.includes("renderPageLockWorkspace"),
  "08 页面锁定器必须继续由开发器 Console 独立持有并保持最后一项",
);
for (const token of ["data-page-factory-workbench", "data-page-factory-run-inspection", "data-page-factory-save-default", "data-page-factory-command-preview", "data-page-factory-coverage-center", "data-page-factory-census-mode", "data-page-factory-batch", "data-page-factory-coverage-scope=\"route-entry\"", "data-page-factory-route-audit", "data-page-factory-route-identity-coverage", "data-page-factory-plan-status", "data-page-factory-wave-count", "data-page-factory-phase-progress", "data-page-factory-progress-version", "data-page-factory-baseline-status", "data-page-factory-verification-record", "data-page-factory-verification-status", "data-page-factory-verification-check", "data-page-factory-verification-result", "data-page-factory-developer-record-ledger", "data-page-factory-inventory-browser", "data-page-factory-inventory-filter", "data-page-factory-inventory-item", "data-page-factory-inventory-empty", "data-page-factory-adoption-preview", "data-page-factory-usage-steps"]) {
  assert(workbenchSource.includes(token), `页面工厂工作台缺少 ${token}`);
}
assert(workbenchSource.includes("复制只读计划命令") && workbenchSource.includes("未包含 --apply") && workbenchSource.includes("不会批量改写页面"), "Coverage center must remain plan-first and non-bulk");
assert(entrySource.includes('currentTab !== "keyword-planner"') && entrySource.includes('pageId: "product-analysis-interest-search"') && entrySource.includes('pageId: "client-product-analysis"') && entrySource.includes('pageId: "product-analysis-global-market"'), "产品分析必须保留兴趣搜索试点并为普通页签声明独立身份");
assert(factorySource.includes("data-page-factory-contract") && factorySource.includes('data-page-factory-region="body"'), "FactoryPage 必须声明契约和主体区域");
assert(factorySource.includes("@radix-ui/react-slot") && factorySource.includes("data-page-factory-frame-owner") && factorySource.includes('"existing-workspace"'), "FactoryPage 必须能把语义契约合并到既有共享工作区，且不得新增可见外框");
assert(!factorySource.includes('html.setAttribute("data-tradepro-page-shared-variables", "true")'), "FactoryPage 不得绕过变量完整性检查提前开启共享变量");
assert(overridesSource.includes("findPageFactoryPage(pathname, search)") && overridesSource.includes('factoryPage.status === "complete" || factoryPage.status === "pilot-complete"'), "全部已完成及试点完成普通项目页必须自动接入共享框架默认档案");
assert(
  pageRouteIdentitySource.includes('"capability"')
    && pageFactoryRuntimeSource.includes("normalizePageFrameSearch(pathname, search)")
    && pageCompositionManifestSource.includes("resolvePageCompositionStructuralRoute(pathname, search)")
    && pageCompositionIdentitySource.includes("normalizePageFrameSearch(pathname, search)"),
  "能力子入口必须复用登记页面的框架身份，内容型标签也必须由路径感知的共享归一化器处理",
);
assert(factorySource.includes('"content-only"') && factorySource.includes("pageFactoryGeneratedScrollOwner") && cssSource.includes(":has([data-page-factory-scroll-contract])"), "普通 FactoryPage 必须自动生成唯一内容滚动所有者并冻结外层滚动");
assert(factorySource.includes("const contentBoundaries = Array.from(new Set(contentSurfaces.map") && factorySource.includes("boundary.parentElement === root ? boundary : null"), "深层页签和编辑器内容必须提升到页面直属边界后再绑定唯一滚动所有者");
assert(factorySource.includes('root.querySelectorAll<HTMLElement>("[data-page-layout-footer]")') && factorySource.includes('assignMarker(element, "footer")'), "页面自带尾栏必须由 FactoryPage 在全部视口绑定统一尾栏标注");
assert(pageFactoryE2eSource.includes("capability subview keeps one shared frame"), "页面工厂回归必须覆盖 capability 子入口、主体悬停和唯一滚动条");
assert(factorySource.includes("data-page-factory-fallback-table-header") && factorySource.includes("operations-market-navigation-fallback") && cssSource.includes("Operations Market is the canonical table-header frame"), "普通 FactoryPage 必须以运营市场为表头框架，并在无业务表头时投影当前导航");
assert(pageFactoryE2eSource.includes("factory pages use the Operations Market table-header frame with navigation fallback"), "页面工厂回归必须覆盖真实表头优先与导航回退");
assert(overridesSource.includes("REQUIRED_SHARED_FRAME_VARIABLES") && overridesSource.includes('tradeproPageSharedVariablesIntegrity = "complete"'), "共享变量发布必须登记完整性状态");
assert(globalCssSource.includes("var(--tradepro-shared-title-bg, var(--tradepro-panel-title-bg, #8e2e62))") && globalCssSource.includes("var(--tradepro-shared-title-padding, 0.875rem 1.25rem)"), "共享标题必须在变量暂不可用时保持安全主题回退");
assert(globalCssSource.includes('[data-responsive-generated-title-band="true"]') && globalCssSource.includes('[data-responsive-shared-surface="title-1"] :is(h1, h2'), "旧普通页自动识别标题必须消费同一共享标题几何和文字规则");
for (const region of ["title-2", "table-header"]) {
  assert(entrySource.includes(`data-page-factory-region="${region}"`), `产品分析共享框架缺少 ${region} 区域`);
}
for (const region of ["large-card", "small-card"]) {
  assert(pilotSource.includes(`data-page-factory-region="${region}"`), `兴趣搜索缺少 ${region} 区域`);
}
assert(cssSource.includes("@container page-factory") && cssSource.includes("max-width: 639px"), "共享 CSS 插件必须包含小屏容器适配");
assert(pythonSource.includes("--apply") && pythonSource.includes('"filesystemWrites"') && pythonSource.includes("SOURCE_ROOT = Path(__file__).resolve().parents[1]"), "Python 命令必须可移植且计划优先");
assert(
  pythonSource.includes("social_tab_implementation_path")
    && pythonSource.includes("SOCIAL_TAB_LOADERS_BLOCK")
    && pythonSource.includes('tab = params.get("tab") or "dashboard"')
    && pythonSource.includes('expected_id = "client-social" if "tab" not in params else f"client-social-{tab}"')
    && pythonSource.includes('page.get("regionStrategy") == "runtime-auto"'),
  "Page Factory source inspection must follow each Social page id/route into its lazy tab implementation while preserving runtime-auto regions",
);
assert(pythonSource.includes("refresh_inventory_report") && pythonSource.includes('"inventoryProgress"') && pythonSource.includes("The baseline is deliberately not refreshed"), "Intentional factory mutations must refresh progress without silently accepting a new baseline");
assert(pythonSource.includes('page.get("status") == "adopting"') && pythonSource.includes('page["status"] = "complete"'), "Only a verified factory snapshot may finalize adopting pages");
assert(pythonSource.includes('standard["templateRegions"][args.template]'), "New and adopted pages must inherit the selected template's applicable regions");
const runtimeNonIdentityBlock = pageRouteIdentitySource.match(/PAGE_FRAME_NON_IDENTITY_QUERY_KEYS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\s*as const\)/)?.[1] || "";
const pythonNonIdentityBlock = pythonSource.match(/PAGE_FRAME_NON_IDENTITY_QUERY_KEYS\s*=\s*frozenset\(\{([\s\S]*?)\}\)/)?.[1] || "";
const quotedValues = (block) => [...block.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]).sort();
assert(
  runtimeNonIdentityBlock
    && pythonNonIdentityBlock
    && JSON.stringify(quotedValues(pythonNonIdentityBlock)) === JSON.stringify(quotedValues(runtimeNonIdentityBlock)),
  "Python and runtime page identity normalizers must drop the same non-identity query keys",
);
assert(
  developerAdapterRegistrySource.includes('import { PAGE_FRAME_NON_IDENTITY_QUERY_KEYS } from "@/lib/page-route-identity";')
    && developerAdapterRegistrySource.includes("DEVELOPER_GLOBAL_FRAME_TRANSIENT_QUERY_KEYS = PAGE_FRAME_NON_IDENTITY_QUERY_KEYS")
    && !developerAdapterRegistrySource.includes("DEVELOPER_FLOW_IDENTITY_QUERY_KEYS"),
  "Developer Global Frame must consume the Page Factory route identity contract directly",
);
assert(
  pythonSource.includes("source-scoped routes")
    && pythonSource.includes("normalize_page_frame_search")
    && pythonSource.includes("PAGE_FRAME_NON_IDENTITY_QUERY_KEYS")
    && pythonSource.includes("scoped_normalized_routes")
    && pageFactoryRuntimeSource.includes("resolvePageFactoryScope")
    && pageFactoryRuntimeSource.includes("page.sourceScope === sourceScope"),
  "Factory registration must enforce (sourceScope, normalizedRoute) while allowing the same normalized route in different source shells",
);
assert(!/[A-Za-z]:[\\/]/.test(pythonSource), "Python 页面工厂不得写死盘符路径");
assert(agentRules.includes("## Ordinary page factory") && agentRules.includes("page_factory.py check --all"), "永久开发规则必须写入 AGENTS.md");

console.log(`页面工厂契约通过：版本 ${standard.factoryVersion}，${registry.pages.length} 个登记页面，7 模板 / 11 区域 / 6 能力 / 7 命令 / 2 框架归属模式。`);
