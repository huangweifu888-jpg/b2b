import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const packageJson = read("package.json");
const assert = (condition, message) => {
  if (!condition) throw new Error(`产品市场性能契约失败：${message}`);
};

const lazyWidget = read("src/components/LazyAIServiceWidget.tsx");
const aiServiceWidget = read("src/components/AIServiceWidget.tsx");
const customerServiceMedia = read("src/lib/customer-service-media.ts");
const templateSnapshotApi = read("src/lib/template-snapshot/api.ts");
const operationsPerformanceBenchmark = read("scripts/measure-product-market-operations-performance.mjs");
const modulesPerformanceBenchmark = read("scripts/measure-product-market-modules-performance.mjs");
const layoutPerformanceBenchmark = read("scripts/measure-product-market-layout-performance.mjs");
const layoutQuickPerformanceBenchmark = read("scripts/measure-product-market-layout-performance-quick.mjs");
const servicePerformanceBenchmark = read("scripts/measure-product-market-service-performance.mjs");
const serviceQuickPerformanceBenchmark = read("scripts/measure-product-market-service-performance-quick.mjs");
const reminderCoverOptimizer = read("scripts/optimize-customer-service-reminder-covers.mjs");
const productMarketSource = read("src/pages/ProductMarket.tsx");
const deferredViewportMediaGroup = read("src/components/DeferredViewportMediaGroup.tsx");
const modulesEditorContract = read("src/lib/product-market-modules-editor-contract.ts");
const mediaSingleFlightStart = customerServiceMedia.indexOf("function readCustomerServiceMediaSingleFlight");
const mediaSingleFlightEnd = customerServiceMedia.indexOf("\nexport async function readCustomerServiceMedia", mediaSingleFlightStart);
const mediaSingleFlightSource = customerServiceMedia.slice(mediaSingleFlightStart, mediaSingleFlightEnd);
const previewReadStart = customerServiceMedia.indexOf("export async function readCustomerServiceMediaPreview");
const previewReadEnd = customerServiceMedia.indexOf("\nfunction revokeCustomerServiceMediaPreview", previewReadStart);
const previewReadSource = customerServiceMedia.slice(previewReadStart, previewReadEnd);
const mediaContract = JSON.parse(read("../shared/contracts/media-optimization-contract.json"));
assert(lazyWidget.includes('lazy(() => import("./AIServiceWidget"))'), "客服悬浮组件必须独立分包");
assert(lazyWidget.includes("INITIAL_WIDGET_DELAY_MS = 2400") && lazyWidget.includes("requestIdleCallback") && lazyWidget.includes("timeout: 2500"), "客服悬浮组件必须在首屏稳定后有界加载");
assert(aiServiceWidget.includes('observe(document.body, { childList: true })') && !aiServiceWidget.includes('observe(document.body, { childList: true, subtree: true })'), "客服悬浮组件不得监听整棵页面 DOM");
assert(aiServiceWidget.includes('addEventListener("tradepro:workspace-marker-layout"') && aiServiceWidget.includes('removeEventListener("tradepro:workspace-marker-layout"'), "客服安全区刷新事件必须成对清理");

assert(
  mediaSingleFlightStart >= 0
    && mediaSingleFlightEnd > mediaSingleFlightStart
    && mediaSingleFlightSource.includes("materialMediaReadInFlight.get(assetId)")
    && mediaSingleFlightSource.includes("materialMediaReadInFlight.set(assetId, pendingRead)")
    && mediaSingleFlightSource.includes("materialMediaReadInFlight.delete(assetId)"),
  "Customer-service material reads must stay single-flight and release pending state",
);
assert(
  templateSnapshotApi.includes("templateFetchInFlight.get(templateId)")
    && templateSnapshotApi.includes("templateFetchInFlight.set(templateId, request)")
    && templateSnapshotApi.includes("templateFetchInFlight.delete(templateId)"),
  "Concurrent readers of one template revision must share one network request without retaining a stale response cache",
);
assert(
  operationsPerformanceBenchmark.includes('artifactPrefix: "product-market-operations-performance"')
    && operationsPerformanceBenchmark.includes('`../release/local-performance/artifacts/${benchmarkTarget.artifactPrefix}-${runId}.json`')
    && !operationsPerformanceBenchmark.includes("`test-results/product-market-operations-performance-"),
  "Performance evidence must survive Playwright test-results cleanup",
);
assert(
  operationsPerformanceBenchmark.includes('pageFactoryId: "client-source-product-market-modules"')
    && operationsPerformanceBenchmark.includes('route: "/product-market?tab=modules"')
    && operationsPerformanceBenchmark.includes('firstCardSelector: \'[data-responsive-structure-item="module"]\'')
    && operationsPerformanceBenchmark.includes('artifactPrefix: "product-market-modules-performance"')
    && modulesPerformanceBenchmark.includes('B2B_PERF_PRODUCT_MARKET_TAB = "modules"')
    && modulesPerformanceBenchmark.includes('import("./measure-product-market-operations-performance.mjs")'),
  "栏目配置必须复用同一性能协议并形成独立、可持久比较的页面证据",
);
assert(
  operationsPerformanceBenchmark.includes('pageFactoryId: "client-source-product-market-layout"')
    && operationsPerformanceBenchmark.includes('route: "/product-market?tab=layout"')
    && operationsPerformanceBenchmark.includes('firstCardSelector: "[data-layout-unified-settings]"')
    && operationsPerformanceBenchmark.includes('artifactPrefix: "product-market-layout-performance"')
    && operationsPerformanceBenchmark.includes('${benchmarkTarget.artifactPrefix}-${runId}.json')
    && operationsPerformanceBenchmark.includes("samplingMode")
    && layoutPerformanceBenchmark.includes('B2B_PERF_PRODUCT_MARKET_TAB = "layout"')
    && layoutPerformanceBenchmark.includes('B2B_PERF_FAST = "false"')
    && layoutPerformanceBenchmark.includes('B2B_PERF_SAMPLES = "7"')
    && layoutQuickPerformanceBenchmark.includes('B2B_PERF_PRODUCT_MARKET_TAB = "layout"')
    && layoutQuickPerformanceBenchmark.includes('B2B_PERF_FAST = "true"')
    && layoutQuickPerformanceBenchmark.includes('B2B_PERF_SAMPLES = "2"'),
  "版面风格必须有独立生产性能证据和更快的本地预检入口",
);
assert(
  operationsPerformanceBenchmark.includes('pageFactoryId: "client-source-product-market-service"')
    && operationsPerformanceBenchmark.includes('route: "/product-market?tab=service"')
    && operationsPerformanceBenchmark.includes('firstCardSelector: \'[data-responsive-structure-item="service-section"]:not([aria-busy])\'')
    && operationsPerformanceBenchmark.includes('renderedCardSelector: "[data-customer-service-expert-card], [data-customer-service-reminder-style]"')
    && operationsPerformanceBenchmark.includes('visibleGroupsSelector: \'[data-responsive-structure-item="service-section"]\'')
    && operationsPerformanceBenchmark.includes('artifactPrefix: "product-market-service-performance"')
    && operationsPerformanceBenchmark.includes("preflightVisit: true")
    && operationsPerformanceBenchmark.includes('"reminderToneResourceCount"')
    && operationsPerformanceBenchmark.includes('"reminderToneEncodedBytes"')
    && operationsPerformanceBenchmark.includes('"reminderCoverResourceCount"')
    && operationsPerformanceBenchmark.includes('"reminderCoverEncodedBytes"')
    && operationsPerformanceBenchmark.includes('entry.name.includes("/customer-service/reminder-covers/")')
    && operationsPerformanceBenchmark.includes('entry.name.includes("/customer-service/reminder-tones/")')
    && operationsPerformanceBenchmark.includes("function fallbackSignature(sample)")
    && operationsPerformanceBenchmark.includes("const signatures = new Set")
    && operationsPerformanceBenchmark.includes("`${failure.method} ${url.origin}${url.pathname} ${failure.errorText}`")
    && operationsPerformanceBenchmark.includes("fallbackRequestSignature: fallbackSignature(sample || {})")
    && operationsPerformanceBenchmark.includes("after.fallbackRequestSignature !== before.fallbackRequestSignature")
    && operationsPerformanceBenchmark.includes('"frontend/src/index.css"')
    && operationsPerformanceBenchmark.includes('"frontend/src/lib/product-market-customer-service-section-loader.ts"')
    && servicePerformanceBenchmark.includes('B2B_PERF_PRODUCT_MARKET_TAB = "service"')
    && servicePerformanceBenchmark.includes('B2B_PERF_FAST = "false"')
    && servicePerformanceBenchmark.includes('B2B_PERF_SAMPLES = "7"')
    && serviceQuickPerformanceBenchmark.includes('B2B_PERF_PRODUCT_MARKET_TAB = "service"')
    && serviceQuickPerformanceBenchmark.includes('B2B_PERF_FAST = "true"')
    && serviceQuickPerformanceBenchmark.includes('B2B_PERF_SAMPLES = "2"')
    && packageJson.includes('"test:product-market-service-performance": "node scripts/measure-product-market-service-performance.mjs"')
    && packageJson.includes('"test:product-market-service-performance:quick": "node scripts/measure-product-market-service-performance-quick.mjs"')
    && packageJson.includes('"media:optimize:customer-service-reminder-covers": "node scripts/optimize-customer-service-reminder-covers.mjs --write"')
    && packageJson.includes('"verify:customer-service-reminder-covers": "node scripts/optimize-customer-service-reminder-covers.mjs"')
    && reminderCoverOptimizer.includes('B2B_REMINDER_COVER_WEBP_QUALITY || "1"')
    && reminderCoverOptimizer.includes("pngNames.length !== 12")
    && reminderCoverOptimizer.includes("minimumPsnrDb")
    && reminderCoverOptimizer.includes("maxAlphaDelta")
    && deferredViewportMediaGroup.includes('rootMargin = "120px 0px"')
    && deferredViewportMediaGroup.includes("export default function DeferredViewportMediaGroup")
    && deferredViewportMediaGroup.includes("new IntersectionObserver")
    && deferredViewportMediaGroup.includes("schedulePostPaintIdle")
    && deferredViewportMediaGroup.includes("data-deferred-viewport-media")
    && productMarketSource.includes('lazy(() => import("@/components/DeferredViewportMediaGroup"))')
    && !productMarketSource.includes('import { DeferredViewportMediaGroup } from "@/components/DeferredViewportMediaGroup"')
    && productMarketSource.includes("<DeferredViewportMediaGroup")
    && productMarketSource.includes("(reminderCoversEnabled) => SOUND_STYLE_PRESETS.map")
    && productMarketSource.includes("data-customer-service-reminder-cover-state")
    && productMarketSource.includes('fetchPriority="low"'),
  "客服音效必须复用同一性能协议，并保持独立的快检、发布级证据与页面报告命名",
);
const reminderPreviewStart = productMarketSource.indexOf('data-customer-service-reminder-preview="true"');
assert(
  reminderPreviewStart >= 0
    && productMarketSource.slice(reminderPreviewStart, reminderPreviewStart + 240).includes('preload="none"'),
  "Customer-service reminder previews must fetch audio only after user playback intent",
);
assert(
  previewReadStart >= 0
    && previewReadEnd > previewReadStart
    && customerServiceMedia.includes("readCustomerServiceMediaSingleFlight(assetId, async () =>")
    && previewReadSource.includes("readCustomerServiceMediaSingleFlight(materialId, async () =>"),
  "Customer-service preview reads must share one material-id single-flight boundary",
);
assert(
  aiServiceWidget.includes("if (!expertPickerMediaRequested) return")
    && aiServiceWidget.includes(".filter((expert) => expert.id !== avatar.id)")
    && aiServiceWidget.includes("onPointerEnter={requestExpertPickerMedia}")
    && aiServiceWidget.includes("onFocus={requestExpertPickerMedia}"),
  "Closed customer-service expert pickers must not fetch the full avatar roster",
);

const app = read("src/App.tsx");
const appRuntime = read("src/components/AppProductMarketRuntime.tsx");
const performanceLearning = read("src/lib/performance-experience-learning.ts");
const routeLoadingPerformance = read("src/lib/route-loading-performance.ts");
const lazyModuleRecovery = read("src/lib/lazy-module-recovery.ts");
const performanceWorkbench = read("src/components/product-market/PerformanceExperienceWorkbench.tsx");
assert(app.includes('if (!location.pathname.endsWith("/product-market")) return routeTarget') && app.includes('params.delete("tab")'), "产品市场四栏目切换不得因 tab 参数重挂整页");
assert(app.includes('key={`${routeRemountTarget}:${retryNonce}`}'), "页面异常隔离器必须使用稳定的重挂标识");
assert(app.includes("function layoutPage(element: ReactNode, layoutIdentity: string)") && app.includes('stableRemountKey={`layout:${layoutIdentity}`}'), "父级布局必须使用稳定边界，子页面切换不得重挂侧栏与外壳");
assert((app.match(/element=\{layoutPage\(/g) || []).length >= 7, "总部、代理、源体与客户端父布局必须统一使用稳定边界");
assert(!app.includes("sidebar-skeleton-") && app.includes("setShowRecovery(true), 8_000"), "路由等待态必须保持轻量，并保留超时后的手动恢复");
assert(app.includes('lazyPage(() => import("./components/AppProductMarketRuntime"))'), "产品市场全局运行层必须从主入口分包");
assert(!app.includes('from "@/lib/product-market-store"'), "应用主入口不得直接打包大型产品市场状态库");
assert(appRuntime.includes("requestIdleCallback") && appRuntime.includes("bootstrapProductMarketVersionBackups") && appRuntime.includes("10_000"), "版本备份必须延迟到首轮交互后的后台阶段");
assert(app.includes("startRouteFallbackObservation(routeTarget, routeVisitKey)") && app.includes("finishRouteFallbackObservation(fallbackToken)"), "路由等待必须读取真实 Suspense 回退窗口");
assert(routeLoadingPerformance.includes("Math.max(entry.transferSize, entry.encodedBodySize, entry.decodedBodySize)"), "路由脚本体积必须兼容传输、缓存与解析体积");
assert(performanceLearning.includes("maxLongTaskMs") && performanceLearning.includes('PerformanceObserver.supportedEntryTypes.includes("layout-shift")'), "主线程与布局偏移必须进入自动学习");
assert(
  performanceLearning.includes('id: "portal-fallback-zero-layout"')
    && performanceLearning.includes("冷启动 CLS 中位数 0.066 降至 0.005")
    && performanceLearning.includes("已拒绝并回退"),
  "Portal 零布局回退及失败候选必须进入共享性能学习",
);
assert(
  operationsPerformanceBenchmark.includes('"frontend/src/components/DeferredShellUtilities.tsx"')
    && operationsPerformanceBenchmark.includes('"frontend/src/lib/product-market-modules-editor-contract.ts"')
    && operationsPerformanceBenchmark.includes('"frontend/src/lib/product-market-order-contract.ts"'),
  "栏目配置性能指纹必须覆盖延迟骨架与新共享契约",
);
assert(performanceLearning.includes("largestLocalStorageEntryBytes") && performanceLearning.includes("storageMetricsTtlMs: 15_000"), "本地存储必须统计最大单项并缓存审计结果");
assert(performanceLearning.includes("oversizedDecodedImages") && performanceLearning.includes("media.autoplay"), "图片解码浪费与离屏自动播放必须可检测");
assert(
  performanceLearning.includes("lastAutomaticAuditAtByIdentity")
    && performanceLearning.includes("maxAuditEntriesPerIdentity: 5")
    && performanceLearning.includes("getAuditIdentity(audit.scope, audit.route) === identity")
    && performanceWorkbench.includes("snapshot.auditTrend.slice(-3).reverse()"),
  "性能审计必须按 scope + route 限频并稀疏保留最近趋势",
);
assert(
  lazyModuleRecovery.includes('export const PAGE_LOAD_RECOVERY_EVENT_NAME = "tradepro:page-load-recovery"')
    && performanceLearning.includes("window.addEventListener(PAGE_LOAD_RECOVERY_EVENT_NAME, onPageLoadRecovery)")
    && performanceLearning.includes("window.removeEventListener(PAGE_LOAD_RECOVERY_EVENT_NAME, onPageLoadRecovery)")
    && performanceLearning.includes("MAX_ROUTE_RECOVERY_METRICS = 80")
    && !performanceLearning.includes("detail.message"),
  "懒加载恢复学习必须有界、成对监听且不得保存错误文本",
);
assert(
  performanceLearning.includes("entries.some((entry) => !entry.hadRecentInput && entry.value > 0)")
    && performanceLearning.includes("duplicateRequestExcess = resourceRequestCounts.reduce")
    && performanceLearning.includes("metrics.duplicateRequestExcess > thresholds.duplicateRequestExcess"),
  "布局偏移必须触发限频复审，重复请求必须按额外次数识别",
);
assert(!performanceLearning.includes("EventTarget.prototype") && !performanceLearning.includes(".pause("), "性能学习不得劫持监听器或改变媒体播放状态");
assert(!/(?:window|globalThis)\.fetch\s*=/.test(performanceLearning) && !performanceLearning.includes("location.reload"), "性能学习不得劫持请求或触发自动重载");

for (const layout of ["AdminLayout", "AgencySourceLayout", "ClientSourceLayout", "HQLayout"]) {
  const source = read(`src/components/${layout}.tsx`);
  assert(source.includes('import LazyAIServiceWidget from "./LazyAIServiceWidget"'), `${layout} 必须消费共享懒加载入口`);
  assert(!source.includes('import AIServiceWidget from "./AIServiceWidget"'), `${layout} 不得把客服组件打回首屏`);
  assert(source.includes("<LazyAIServiceWidget />"), `${layout} 必须保留客服能力`);
}

for (const layout of ["AdminLayout", "AgencySourceLayout", "ClientSourceLayout", "HQLayout", "Sidebar"]) {
  const source = read(`src/components/${layout}.tsx`);
  assert(source.includes('from "zustand/react/shallow"') && source.includes("useProductMarketStore(useShallow"), `${layout} 必须只订阅实际使用的产品市场状态`);
}

const routePreload = read("src/lib/route-preload.ts");
const productMarket = read("src/pages/ProductMarket.tsx");
const voicePreviewRuntime = read("src/lib/customer-service-voice-preview-runtime.ts");
const productMarketStore = read("src/lib/product-market-store.ts");
const productMarketModules = read("src/components/product-market/ProductMarketModulesPanel.tsx");
assert(
  modulesEditorContract.includes("export function encodeModuleCategorySortId")
    && modulesEditorContract.includes("export function decodeModuleCategorySortId")
    && modulesEditorContract.includes("export type EditableModuleItem")
    && !productMarketModules.includes("MODULE_CATEGORY_SORT_ID_PREFIX")
    && !productMarket.includes("MODULE_CATEGORY_SORT_ID_PREFIX"),
  "栏目配置排序协议与编辑 DTO 必须只由共享契约持有",
);
const productMarketDevelopmentGuide = read("src/components/product-market/ProductMarketDevelopmentGuidePanel.tsx");
const productMarketThemeEditor = read("src/components/product-market/ProductMarketThemeEditorDialog.tsx");
const productAnalysis = read("src/pages/ProductAnalysis.tsx");
const socialMedia = read("src/pages/SocialMedia.tsx");
const socialCustomerRoadmap = read("src/components/social/SocialCustomerRoadmapTab.tsx");
const voicePreviewStart = productMarket.indexOf("const playVoiceRatePreview = useCallback");
const voicePreviewEnd = productMarket.indexOf("\n  useEffect(() => () => {", voicePreviewStart);
const voicePreviewSource = productMarket.slice(voicePreviewStart, voicePreviewEnd);
assert(voicePreviewStart >= 0 && voicePreviewEnd > voicePreviewStart, "Voice preview must remain an independently auditable interaction boundary");
assert(
  !productMarket.includes('from "@/lib/ai-provider-api"')
    && !productMarket.includes('from "@/lib/customer-service-browser-voice"'),
  "Remote TTS and browser speech fallbacks must not be statically bundled into every Product Market route",
);
assert(
  (productMarket.match(/import\("@\/lib\/customer-service-voice-preview-runtime"\)/g) || []).length === 1
    && voicePreviewSource.includes('await import("@/lib/customer-service-voice-preview-runtime")')
    && !productMarket.includes('import("@/lib/ai-provider-api")')
    && !productMarket.includes('import("@/lib/customer-service-browser-voice")'),
  "Product Market must load one shared voice runtime only after an explicit preview intent",
);
assert(
  (voicePreviewRuntime.match(/import\("\.\/ai-provider-api"\)/g) || []).length === 1
    && (voicePreviewRuntime.match(/import\("\.\/customer-service-browser-voice"\)/g) || []).length === 1
    && voicePreviewRuntime.includes("if (browserFallbackPromise) return browserFallbackPromise")
    && voicePreviewRuntime.includes("audio.onerror = () =>")
    && voicePreviewRuntime.includes("void fallbackToBrowserVoice()"),
  "Shared voice playback must keep remote TTS nested and coalesce every browser-speech fallback",
);
assert(
  productMarket.includes("voicePreviewRequestRevisionRef.current += 1")
    && voicePreviewSource.includes("voicePreviewRequestRevisionRef.current === requestRevision")
    && voicePreviewRuntime.includes("if (!options.isCurrent()) return")
    && productMarket.includes("window.speechSynthesis.cancel()"),
  "Voice preview cancellation must invalidate stale async work without loading the browser speech chunk",
);
const voiceRateSliderStart = productMarket.indexOf('data-customer-service-shared-slider="voice-rate"');
const voiceRateSliderSource = productMarket.slice(voiceRateSliderStart, voiceRateSliderStart + 900);
assert(
  voiceRateSliderStart >= 0
    && /onValueChange=\{\(val\) => \{[\s\S]*handleSetAvatarVoiceRate\(val\[0\]\);[\s\S]*onValueCommit=\{\(val\) => \{[\s\S]*playVoiceRatePreview\(val\[0\]\)/u.test(voiceRateSliderSource),
  "Voice-rate dragging must update local state continuously but start audio only once on commit",
);
assert(
  socialMedia.includes('import("@/components/social/SocialCustomerRoadmapTab")')
    && !socialMedia.includes("function CustomerRoadmapTab(")
    && socialCustomerRoadmap.includes("function SocialCustomerRoadmapTab(")
    && socialCustomerRoadmap.includes('data-social-roadmap-truth-scope="local-development-and-manual-review"'),
  "社交媒体隐藏客户路线必须保留在独立分包并维持真值边界",
);
assert(
  routePreload.includes('import("@/components/social/SocialCustomerRoadmapTab")')
    && routePreload.includes('get("tab")?.toLowerCase() === "customer-roadmap"'),
  "社交媒体客户路线分包必须在 tab=customer-roadmap 导航意图时精准预热",
);
assert(
  productMarket.includes('import("@/components/product-market/ProductMarketDevelopmentGuidePanel")')
    && !productMarket.includes("function ProductMarketDevelopmentGuide(")
    && !productMarket.includes('from "@/lib/page-composition-manifest"')
    && productMarketDevelopmentGuide.includes("function ProductMarketDevelopmentGuidePanel(")
    && productMarketDevelopmentGuide.includes("<DevelopmentStandardWorkbench />"),
  "开发规范入口与专属组合逻辑必须保留在独立分包",
);
assert(
  routePreload.includes('import("@/components/product-market/ProductMarketDevelopmentGuidePanel")')
    && routePreload.includes('get("tab")?.toLowerCase() === "development"'),
  "开发规范分包必须在 tab=development 导航意图时精准预热",
);
assert(
  routePreload.includes('import("@/components/product-market/ProductMarketModulesPanel")')
    && routePreload.includes('get("tab")?.toLowerCase() === "modules"'),
  "栏目配置分包必须在 tab=modules 导航意图时精准预热",
);
assert(
  productMarket.includes('import("@/components/product-market/ProductMarketThemeEditorDialog")')
    && productMarket.includes("productMarketThemeEditorDialogPromise")
    && productMarket.includes("productMarketThemeEditorDialogPromise = undefined")
    && productMarket.includes("onPointerEnter={preloadProductMarketThemeEditorDialog}")
    && productMarket.includes("onFocus={preloadProductMarketThemeEditorDialog}"),
  "Theme editor must stay in an intent-preloaded single-flight chunk and release failed speculative loads",
);
assert(
  productMarket.includes("themeEditorVisited ? (")
    && productMarket.includes("setThemeEditorVisited(true)")
    && !productMarket.includes("data-theme-editor-dialog")
    && productMarketThemeEditor.includes("data-theme-editor-dialog")
    && productMarketThemeEditor.includes("<DraggableDialogContent")
    && productMarketThemeEditor.includes('data-shared-dialog-contract="theme-editor"')
    && !productMarketThemeEditor.includes("data-shared-window-contract="),
  "Closed theme editor must not mount its UI before first use, and the loaded dialog must consume the shared window contract through the Dialog primitive",
);
assert(
  !productMarketModules.includes("buildProductModuleCategoryLabel(")
    && productMarketModules.includes("categoryOrderIndexMap.get(group.key) ?? groupIndex + 1,\n                        group.label"),
  "栏目配置分包不得引用拆分前主文件的局部标签函数",
);
assert(routePreload.includes("routePreloads.get(key)") && routePreload.includes("routePreloads.delete(key)"), "路由意图预热必须单飞并在失败后释放");
assert(productAnalysis.includes('lazy(async () => ({') && !productAnalysis.includes('import { MarketRadarWorkspace }') && !productAnalysis.includes('import { CompetitivePricingWorkspace }'), "产品分析非默认工作区必须按栏目分包");
assert(routePreload.includes("preloadProductAnalysisPanel") && routePreload.includes('analysisTab === "market-finder"') && routePreload.includes('analysisTab === "global-market"'), "产品分析重工具必须随导航意图并行预热");
const sidebar = read("src/components/Sidebar.tsx");
assert(
  productMarket.includes("skipRemoteSnapshot: true,\n      });")
    && productMarket.includes("Hydration mirrors an already-authoritative server snapshot"),
  "Passive Product Market hydration must only refresh local state and never write the remote template",
);
assert(
  !productMarket.includes("override.mediaAssetId || expert.defaultAvatarAssetId")
    && !sidebar.includes("runtimeAvatarOverrides[expert.id]?.mediaAssetId || expert.defaultAvatarAssetId")
    && productMarket.includes("resolveCustomerServiceLocalMaterialReference(\n              override.mediaAssetId,")
    && sidebar.includes("resolveCustomerServiceLocalMaterialReference(\n          runtimeAvatarOverrides[expert.id]?.mediaAssetId,"),
  "Bundled expert portraits must render through the shared fallback URL; only custom material IDs may enter the blob preview loader",
);
assert(sidebar.includes("onPointerDown={hasChildren ? undefined : () => preloadSidebarWorkspaceRoute(item.path)}"), "只负责展开的父栏目不得触发无效页面预热");
assert(sidebar.includes("onPointerDown={() => preloadSidebarWorkspaceRoute(getProductMarketPath(tab))}"), "产品市场真实栏目入口必须在触屏按下时精准预热");
for (const routeKey of ["productMarket", "companyInfo", "productAnalysis", "socialMedia", "smartAds", "aiChat", "aiCustomerService", "templates", "projects", "seo", "geoCenter"]) {
  assert(routePreload.includes(`${routeKey}: () => import(`), `常用重页面 ${routeKey} 必须支持按导航意图预热`);
}

const clientSourceLayout = read("src/components/ClientSourceLayout.tsx");
assert(clientSourceLayout.includes('params.delete("tab")') && clientSourceLayout.includes("requestIdleCallback(refreshRouteContract"), "客户源壳不得在产品市场 tab 或项目切换关键路径同步解析整份源体配置");
const productMarketConfig = read("src/lib/product-market-config.ts");
assert(
  productMarketConfig.includes("storedProductMarketConfigCache.get(key)")
    && productMarketConfig.includes("cached?.raw === raw")
    && productMarketConfig.includes("syncStoredProductMarketConfigCache(key, normalizedRaw, normalized)"),
  "产品市场配置必须按原始存储值复用规范化快照，并在写入与迁移后同步缓存",
);
assert(
  productMarketConfig.includes("return cloneProductMarketConfig(cached.config)")
    && productMarketConfig.includes("config: cloneProductMarketConfig(config)"),
  "配置缓存不得把内部规范化对象直接暴露给调用方",
);
assert(
  sidebar.includes("resolveCustomerServiceRuntimeScope(location.pathname)")
    && sidebar.includes("[currentSiteId, customerServiceRuntimePathname, customerServiceRuntimeRevision, liveCustomerServiceConfig]")
    && sidebar.includes("}, [sidebarScrollMemoryKey]);"),
  "稳定侧栏必须按运行域复用客服配置，并且只在真实侧栏边界变化时恢复滚动位置",
);
const sites = read("src/lib/sites.ts");
assert(sites.includes("cachedSitesStorageValue") && sites.includes("raw === cachedSitesStorageValue"), "活动计划站点读取必须复用存储签名缓存");
assert(sites.includes("sitesFetchInFlight") && sites.includes("if (sitesFetchInFlight) return sitesFetchInFlight") && sites.includes("sitesFetchInFlight = null"), "活动计划站点同步必须合并并发请求并释放单飞状态");
const styles = read("src/index.css");
assert(styles.includes("[data-customer-service-expert-card]") && styles.includes("[data-customer-service-reminder-style]") && styles.includes("content-visibility: auto"), "客服专家与提醒卡片必须跳过离屏绘制并保留完整 DOM");

const materialPicker = read("src/components/product-market/CustomerServiceMaterialPickerDialog.tsx");
const main = read("src/main.tsx");
assert(productMarketModules.includes('import "@/shared-module-editor-capacity.css"') && productMarket.includes('import "@/shared-layout-section-editor-capacity.css"'), "产品市场容量 CSS 必须随相应分包加载");
assert(!main.includes("shared-module-editor-capacity.css") && !main.includes("shared-layout-section-editor-capacity.css"), "产品市场专用 CSS 不得回到全局首包");
assert(
  productMarket.includes('import("@/components/product-market/ProductMarketModulesPanel")')
    && !productMarket.includes("function SortableDefaultItem(")
    && productMarketModules.includes("function SortableDefaultItem(")
    && productMarketModules.includes('data-shared-ownership-source="modules"'),
  "栏目配置视图、局部排序组件与共享标记必须保留在独立分包",
);
assert(productMarket.includes('const activeSettingsTab = templateSettingsSubview === "layout"') && !productMarket.includes('else if (settingsTab !== templateSettingsSubview) setSettingsTab(templateSettingsSubview)'), "产品市场路由栏目必须直接派生活动页签");
assert(productMarket.includes('import("@/components/product-market/CustomerServiceMaterialPickerDialog")'), "客服素材库必须保持按需分包");
assert(!productMarket.includes('data-shared-dialog-contract="material-picker"'), "客服素材库完整弹窗不得重新内联到 ProductMarket 主包");
assert(materialPicker.includes('data-shared-dialog-contract="material-picker"') && materialPicker.includes('data-shared-window-region="footer"'), "按需素材库必须继续使用弹窗共享契约");
assert(productMarket.includes('import("@/lib/customer-service-material-normalizer")'), "头像与声音上传标准化逻辑必须只在选择文件后加载");
assert(!productMarket.includes("async function normalizeAvatarVideoMaterial"), "视频头像转换器不得重新打回 ProductMarket 主包");
assert(productMarket.includes('const operationsCatalogActive = productMarketSubview === "operations"'), "非运营栏目页面不得继续构建栏目分组");
assert(productMarket.includes('const serviceWorkspaceActive = productMarketSubview === "service"'), "客服专家计算必须绑定活动客服栏目");
assert(productMarket.includes('if (!materialPickerTarget) return [] as MaterialPickerEntry[]'), "素材弹窗关闭时不得预构造系统提醒声音条目");
assert(productMarket.includes('data-product-market-operations-catalog-active={operationsCatalogActive ? "true" : "false"}'), "产品市场必须暴露运营活动计算边界");
assert(productMarket.includes('data-product-market-service-workspace-active={serviceWorkspaceActive ? "true" : "false"}'), "产品市场必须暴露客服活动计算边界");
assert(
  productMarket.includes("if (serviceWorkspaceActive) return null")
    && productMarket.includes("renderableOperationGroups.slice(0, visibleOperationGroupCount)")
    && productMarket.includes("groupedModuleProducts.slice(0, visibleModuleGroupCount)")
    && productMarket.includes("visibleAvatarCategoryKeys === null || visibleAvatarCategoryKeys.has(expert.categoryKey)")
    && productMarket.includes('data-product-market-avatar-preview-plan-mode={serviceWorkspaceActive ? "full-service" : operationsCatalogActive ? "visible-groups" : "inactive"}')
    && productMarket.includes("data-product-market-avatar-preview-plan-size={avatarPreviewLoadPlan.length}"),
  "运营/栏目头像媒体计划必须只覆盖已挂载分组，客服页仍保留完整专家序列",
);
assert(
  productMarket.includes("getCustomerServiceAvatarPreviewDescriptor(override, serviceWorkspaceActive)")
    && productMarket.includes("if (!includeService) return cached.portrait")
    && productMarket.includes('appendCustomerServiceStyleAssetDescriptor(service, "soundAssetsByStyle"')
    && productMarket.includes('appendCustomerServiceStyleAssetDescriptor(service, "reminderImageAssetsByStyle"')
    && productMarket.includes('appendCustomerServiceStyleAssetDescriptor(service, "voiceAssetsByStyle"')
    && productMarket.includes('appendCustomerServiceStyleAssetDescriptor(service, "voiceImageAssetsByStyle"')
    && productMarket.includes("[csAvatarOverrides, expertAvatarWorkspaceActive, serviceWorkspaceActive, tempModuleCategoryOrder, tempModuleCategoryStyles, visibleAvatarCategoryKeys]"),
  "非客服栏目不得构造女性/男性朗音与提醒声音描述符，客服页必须保留完整音频描述符",
);
assert(productMarket.includes('from "zustand/react/shallow"') && productMarket.includes("useProductMarketStore(useShallow"), "产品市场工作区必须按字段浅比较订阅");
assert(
  productMarket.includes("builtinThemeOverrides: state.builtinThemeOverrides")
    && productMarket.includes("const allThemes = getAllThemes();")
    && productMarket.includes("data-product-market-builtin-theme-override-count={Object.keys(builtinThemeOverrides).length}")
    && productMarketStore.includes("allThemesCache?.builtinThemeOverrides === state.builtinThemeOverrides")
    && productMarketStore.includes("allThemesCache.customThemes === state.customThemes")
    && productMarketStore.includes("return allThemesCache.themes")
    && productMarketStore.includes("allThemesCache = {"),
  "主题列表必须按内置覆盖与自定义主题引用共享缓存，且内置主题变化必须触发工作区刷新",
);
assert(productMarketDevelopmentGuide.includes('import("@/components/product-market/DevelopmentStandardPanels")') && productMarket.includes('import("@/components/product-market/FactoryPlatformBlueprint")'), "低频开发工具必须保持按需分包");
assert(!productMarket.includes('from "@/components/product-market/DevelopmentStandardPanels"') && !productMarketDevelopmentGuide.includes('from "@/components/product-market/DevelopmentStandardPanels"') && !productMarket.includes('from "@/components/product-market/FactoryPlatformBlueprint"'), "低频开发工具不得恢复为首屏静态依赖");
assert(productMarket.includes('import type { FactoryPlatformCategoryKey } from "@/lib/factory-platform-blueprint"') && productMarket.includes('await import("@/lib/factory-platform-blueprint")'), "平台蓝图大数据必须只在交互时加载");
assert(productMarket.includes("saveOperationInFlightRef.current"), "保存必须具备单飞并发保护");
assert((productMarket.match(/for \(let attempt = 0; attempt < 3; attempt \+= 1\)/g) || []).length >= 3, "草稿、运行端和发布回读必须具备短暂一致性重试");
assert(productMarket.includes('preload="metadata"'), "动态素材列表必须使用轻量元数据预载");
assert(materialPicker.includes("function DeferredAudioMetadata") && materialPicker.includes("IntersectionObserver"), "声音时长元数据必须按接近视口加载");
assert(productMarket.includes("styleKey !== activeVoiceStyle") && productMarket.includes("styleKey !== activeReminderStyle"), "当前专家只允许读取正在使用的朗音和提醒变体");
assert(productMarket.includes('if (!expertAvatarWorkspaceActive || isDevelopmentGuide || isPlatformBlueprint)'), "无专家界面的版面、开发规范和平台蓝图不得初始化客服媒体库");
assert(productMarket.includes("remainingEntries.slice(index, index + 3)"), "其余专家媒体必须在空闲阶段小批量加载");
assert(
  !productMarket.includes("moduleProgressiveLoadRef")
    && productMarket.includes("setVisibleModuleGroupCount(Math.min(2, total))")
    && productMarketModules.includes("加载更多栏目")
    && productMarketModules.includes("显示全部栏目"),
  "栏目配置必须稳定从两组开始，并且只能由用户显式加载更多或显示全部",
);
assert(
  productMarket.includes("renderableOperationGroups.slice(0, visibleOperationGroupCount)")
    && !productMarket.includes("operationsProgressiveLoadRef")
    && productMarket.includes("setVisibleOperationGroupCount(Math.min(2, total))")
    && productMarket.includes("加载更多栏目")
    && productMarket.includes("显示全部栏目")
    && productMarket.includes("aria-busy={visibleOperationGroupCount === 0}")
    && productMarket.includes('data-product-market-operations-visible-groups={`${visibleOperationGroupCount}/${renderableOperationGroups.length}`}'),
  "运营市场必须复用可见区域与显式加载边界，禁止一次挂满全部栏目",
);
assert(
  productMarket.includes("items={effectiveModuleDragIds}")
    && productMarket.includes("onDragStart={handleDragStart}")
    && productMarket.includes("onDragEnd={handleDragEnd}")
    && productMarket.includes('onClick={() => handleBatchAction("active")}')
    && productMarket.includes("saveOperationInFlightRef.current"),
  "运营市场渐进挂载不得削弱拖拽、批量状态或保存单飞语义",
);
assert(!productMarket.includes("requestIdleCallback(mountNextBatch"), "栏目配置不得恢复空闲批量挂满整页 DOM");
assert(!productMarket.includes("resetToFactory();\n    const baseConfig = ensureWorkspaceCatalog"), "产品市场挂载不得先重置再导入，避免重复整树持久化");

const visualLauncher = read("src/components/product-market/VisualPageEditorLauncher.tsx");
assert(visualLauncher.includes("onPointerDown") && visualLauncher.includes("onPointerEnter") && visualLauncher.includes("onFocus"), "可视化重工具必须仅按真实交互意图预热");
assert(!visualLauncher.includes("requestIdleCallback") && !visualLauncher.includes("setTimeout(() => { void preloadVisualPageEditorDock"), "可视化工具不得在每个页面空闲时无条件预载");
assert(
  productMarket.includes("postPaintApplicationsReady ? <Suspense fallback={null}><VisualPageEditorTopbarLauncher")
    && !productMarket.includes("data-visual-editor-launcher-post-paint"),
  "Portal 型可视化入口的延迟占位不得进入主内容普通流并制造布局偏移",
);

const backend = read("../backend/routers/local_dev.py");
assert(Object.values(mediaContract.kinds).every((rule) => rule.warningBytes <= rule.deliveryBudgetBytes && rule.deliveryBudgetBytes <= rule.maxUploadBytes), "共享媒体契约必须保持警戒、交付与上传上限的单向边界");
assert(backend.includes("_read_material_asset_upload(file, int(rule[\"maxUploadBytes\"]))"), "上传与替换必须从共享媒体契约分块读取并限制大小");
assert(backend.includes("if total > max_upload_bytes:") && backend.includes("status_code=413"), "超限素材必须在完整读入内存前返回 413");

console.log("产品市场性能契约通过：稳定布局、意图预热、可见区挂载、轻量工具与媒体/保存边界均已锁定。");
