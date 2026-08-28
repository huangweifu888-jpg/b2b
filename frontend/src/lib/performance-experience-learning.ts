import { ROUTE_LOADING_OBSERVED_EVENT_NAME, readRouteLoadingObservation } from "@/lib/route-loading-performance";
import {
  DEVELOPER_LOADING_SPEED_LEARNING_CONTRACT,
  getRequiredSharedOptimizationBudget,
} from "@/lib/developer-optimization-contract";
import { MEDIA_OPTIMIZATION_CONTRACT } from "@/lib/media-optimization-contract";
import type { PageFactoryRuntimeScope } from "@/page-factory/page-factory";
import {
  PAGE_LOAD_RECOVERY_EVENT_NAME,
  type PageLoadRecoveryDetail,
} from "@/lib/lazy-module-recovery";

export type PerformanceExperienceScope = PageFactoryRuntimeScope;

export type PerformanceExperiencePatternId =
  | "route-state-stability"
  | "heavy-tool-lazy-load"
  | "portal-fallback-zero-layout"
  | "network-single-flight"
  | "storage-signature-cache"
  | "offscreen-render-skipping"
  | "media-lightweight-loading"
  | "component-render-boundary"
  | "observer-feedback-control"
  | "visibility-aware-background-work"
  | "event-backed-transient-polling"
  | "batch-async-state-commit"
  | "route-owned-data-boundary"
  | "route-owned-deferred-css"
  | "deferred-widget-owned-css"
  | "tab-exclusive-control-boundary"
  | "tiered-performance-evidence";

export type PerformanceExperienceIssueId =
  | "slow-route-stabilization"
  | "slow-route-fallback"
  | "large-route-script"
  | "long-main-thread-task"
  | "layout-instability"
  | "large-dom-tree"
  | "eager-offscreen-media"
  | "oversized-image-decode"
  | "lazy-load-recovery"
  | "duplicate-resource-request"
  | "large-resource-transfer"
  | "storage-capacity-pressure"
  | "oversized-storage-entry";

export type PerformanceExperienceLearningSource = "automatic" | "manual" | "historical-verified";

export type PerformanceExperienceCleanupStepId =
  | "remove-visual-shells"
  | "inherit-surface-colors"
  | "flatten-light-actions"
  | "defer-non-first-screen"
  | "remove-retired-implementations"
  | "internalize-deferred-props"
  | "prune-imports-and-helpers"
  | "verify-preserved-capabilities";

export type PerformanceExperiencePreservedCapabilityId =
  | "drag-sort"
  | "tree-crud"
  | "icon-upload"
  | "horizontal-scroll-sync"
  | "business-state";

export interface PerformanceExperienceCleanupStep {
  id: PerformanceExperienceCleanupStepId;
  order: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  title: string;
  instruction: string;
  sourceReview: string;
  mode: "advisory-source-review";
}

export interface PerformanceExperiencePreservedCapability {
  id: PerformanceExperiencePreservedCapabilityId;
  label: string;
  guard: string;
}

export interface PerformanceExperiencePattern {
  id: PerformanceExperiencePatternId;
  title: string;
  summary: string;
  quickApply: string;
  evidence: string;
  source: "historical-verified";
}

export interface PerformanceExperienceMetrics {
  routeStabilizationMs: number;
  routeFallbackMs: number;
  routeScriptBytes: number;
  largestRouteScriptBytes: number;
  longTaskCount: number;
  longTaskTotalMs: number;
  maxLongTaskMs: number;
  layoutShiftScore: number;
  domNodes: number;
  eagerOffscreenMedia: number;
  offscreenAutoplayMedia: number;
  oversizedDecodedImages: number;
  lazyLoadRetryCount: number;
  lazyLoadRecoveryCount: number;
  lazyLoadFailureCount: number;
  duplicateResourceRequests: number;
  duplicateRequestExcess: number;
  largeResourceTransfers: number;
  localStorageBytes: number;
  localStorageEntries: number;
  largestLocalStorageEntryBytes: number;
}

export interface PerformanceExperienceLearningEntry {
  id: string;
  issue: PerformanceExperienceIssueId;
  patternId: PerformanceExperiencePatternId;
  scope: PerformanceExperienceScope;
  route: string;
  evidence: string;
  recommendation: string;
  firstSeenAt: string;
  lastSeenAt: string;
  count: number;
  source: "automatic" | "manual";
}

export interface PerformanceExperienceAudit {
  contractVersion: string;
  scope: PerformanceExperienceScope;
  route: string;
  source: "automatic" | "manual";
  measuredAt: string;
  metrics: PerformanceExperienceMetrics;
  issues: PerformanceExperienceIssueId[];
  learned: PerformanceExperienceLearningEntry[];
}

export interface PerformanceExperienceSnapshot {
  contractVersion: string;
  automaticLearning: true;
  applicationLearning: typeof DEVELOPER_LOADING_SPEED_LEARNING_CONTRACT;
  scope: PerformanceExperienceScope;
  route: string;
  patterns: readonly PerformanceExperiencePattern[];
  cleanupPlaybook: readonly PerformanceExperienceCleanupStep[];
  preservedCapabilities: readonly PerformanceExperiencePreservedCapability[];
  learned: PerformanceExperienceLearningEntry[];
  appliedRoutes: string[];
  latestAudit: PerformanceExperienceAudit | null;
  auditTrend: PerformanceExperienceAudit[];
}

export const PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT = {
  version: "2026.08.28.15",
  applicationLearningVersion: DEVELOPER_LOADING_SPEED_LEARNING_CONTRACT.version,
  storageKey: "tradepro.performance-experience-learning.v2",
  auditStorageKey: "tradepro.performance-experience-audits.v2",
  catalogStorageKey: "tradepro.performance-experience-catalog.v2",
  appliedRoutesStorageKey: "tradepro.performance-experience-applied-routes.v2",
  eventName: "tradepro:performance-experience-learning",
  autoLearning: true,
  sourceReviewMode: "advisory" as const,
  automaticSourceRewrite: false,
  cleanupPlaybookSteps: 8,
  maxLearningEntries: 120,
  maxAuditEntries: 40,
  maxAuditEntriesPerIdentity: 5,
  automaticAuditCooldownMs: 15_000,
  storageMetricsTtlMs: 15_000,
  thresholds: {
    routeStabilizationMs: 2500,
    routeFallbackMs: getRequiredSharedOptimizationBudget("route-fallback").warning,
    routeScriptBytes: getRequiredSharedOptimizationBudget("route-script").limit * 1024,
    largestRouteScriptBytes: getRequiredSharedOptimizationBudget("largest-chunk").limit * 1024,
    longTaskCount: 2,
    longTaskTotalMs: 200,
    maxLongTaskMs: getRequiredSharedOptimizationBudget("long-task").warning,
    layoutShiftScore: getRequiredSharedOptimizationBudget("layout-shift").warning,
    domNodes: 1800,
    eagerOffscreenMedia: 3,
    oversizedDecodedImages: 0,
    duplicateRequestExcess: 2,
    largeResourceTransferBytes: MEDIA_OPTIMIZATION_CONTRACT.kinds.image.deliveryBudgetBytes,
    largeResourceTransfers: 2,
    localStorageBytes: 4 * 1024 * 1024,
    largestLocalStorageEntryBytes: 512 * 1024,
  },
} as const;

export const PERFORMANCE_EXPERIENCE_HISTORICAL_PATTERNS = [
  {
    id: "route-state-stability",
    title: "路由切换保留页面实例",
    summary: "外观页签切换不重挂载整页，保留当前编辑与展开状态。",
    quickApply: "复用稳定路由键，只让真实页面身份变化触发重挂载。",
    evidence: "产品市场四页签切换已验证状态保留并减少重复初始化。",
    source: "historical-verified",
  },
  {
    id: "heavy-tool-lazy-load",
    title: "重型工具按需加载",
    summary: "素材库、可视化和弹窗只在打开时加载，不进入首屏主包；真实点击意图出现时再提前预热。",
    quickApply: "将非首屏弹窗和工具拆成 lazy + Suspense 独立分包；用 pointer、focus 与打开动作共享一个可失败释放的 single-flight loader，避免空闲期盲目下载。",
    evidence: "客服素材库与媒体标准化器拆包后通过生产构建和弹窗回归；开发器应用控制台约 91,377 bytes raw / 27,524 bytes gzip、平台蓝图约 71,004 bytes raw / 18,327 bytes gzip 均保持懒边界，并由悬浮、按下、键盘聚焦或选择意图精确预热，失败后释放 Promise 允许重试。",
    source: "historical-verified",
  },
  {
    id: "portal-fallback-zero-layout",
    title: "Portal 延迟入口零布局占位",
    summary: "最终通过 Portal 渲染的懒加载入口不得在普通文档流中预留高度，避免入口加载完成时把真实工作区整体推移。",
    quickApply: "识别最终返回 createPortal 或 null 的入口，将 Suspense fallback 设为 null 或绝对定位的零尺寸占位；只有真实替换可见内容的流内组件才使用等尺寸骨架。",
    evidence: "产品市场栏目配置生产模式各 7 次冷启动与重复访问：冷启动 CLS 中位数 0.066 降至 0.005（-92.4%），重复访问 0.199 降至 0.005（-97.5%），主要速度指标保持容差内且功能等价。等高侧栏骨架候选仅把 CLS 0.005 降至 0.004，却在有效复测中造成 9.7% 至 50.1% 的关键加载回归，已拒绝并回退。",
    source: "historical-verified",
  },
  {
    id: "network-single-flight",
    title: "请求单飞与失败释放",
    summary: "同一数据的并发刷新合并为一次请求，结束后允许再次获取新数据。",
    quickApply: "为共享刷新入口增加 in-flight Promise，并在 finally 中释放。",
    evidence: "活动计划与站点同步已消除多个工作区同时发起的重复请求。",
    source: "historical-verified",
  },
  {
    id: "storage-signature-cache",
    title: "本地存储签名缓存",
    summary: "存储原文或不可变比较基线未变化时复用已解析快照与字段签名，避免同一编辑反复 JSON 解析和序列化。",
    quickApply: "缓存原始字符串签名与不可变快照；同一界面 revision 的大型状态投影只读取一次并 memo 继承结果；草稿比较只缓存 baseline 一侧，live draft 仍逐次精确计算；事务内同一目标签名只计算一次。",
    evidence: "页面锁五类本地记录已改为原文签名缓存；08 的 318 个锁节点进一步共用四记录只读快照，单次活动刷新由实测 6,678 次 localStorage.getItem 降至固定 4 次（约减少 99.94%），直接锁、继承锁、循环保护和写后新 revision 语义保持。产品市场 37 字段不可变草稿 baseline 由每次重复序列化改为按对象身份复用，后续摘要由最多 76 次 JSON.stringify 降至约 37 次；保存 expected 与发布 nextConfig 均从每个回读分支重复计算收敛为事务内 1 次。",
    source: "historical-verified",
  },
  {
    id: "offscreen-render-skipping",
    title: "离屏内容跳过绘制",
    summary: "长列表保留完整可访问 DOM，同时跳过视口外卡片的布局和绘制。",
    quickApply: "为稳定卡片容器应用 content-visibility，并提供 intrinsic-size。",
    evidence: "客服专家与提醒卡片长列表已通过大小屏和完整 DOM 验证。",
    source: "historical-verified",
  },
  {
    id: "media-lightweight-loading",
    title: "图片音频轻量加载",
    summary: "视口外图片不仅延迟解码，还应在接近视口前不赋真实地址；代码内置图片使用现代格式，预览音视频按用户意图加载。",
    quickApply: "长页先用分组级 IntersectionObserver 和固定尺寸占位保留完整语义 DOM，到视口 0–120px 再赋图片 src，并保留 lazy/async/low priority；无观察器时 post-paint 兜底。再以尺寸、PSNR、像素误差和透明度门槛转换 WebP/AVIF；预览音视频默认 none，仅需首帧信息时才 metadata，播放时再取完整资源。",
    evidence: "客服头像、朗音和提醒素材已通过资源与播放共享契约。客服音效正式分阶段 7+7 本地受控测量中：预览铃声由首屏 1 次/29,484 B 降为 0；12 张代码内置生肖封面由 PNG 2,400,422 B 转为质量 1 WebP 1,402,686 B（-41.6%）；随后共享 DeferredViewportMediaGroup 把首屏封面请求由 12 次/1,402,686 B 降为 0，并以客服页专属动态块避免其他页签承担观察器代码。最新同协议对比 verdict=improved，复访 FCP 284→248ms（-12.7%）、长任务 15→14、最大长任务 387→354ms；24 卡片、3 区域、三档响应式、CLS 0.012 与零写请求保持。201 条路由、319 个脚本块和 59 个公开媒体均通过共享预算，最重栏目配置路由为 522,823/524,288 B。运行时回归还验证滚动接近提醒区后 12 张 WebP 均只请求一次并成功解码为 250×250。原 PNG 暂留作历史 URL 兼容，不进入当前页面请求。",
    source: "historical-verified",
  },
  {
    id: "component-render-boundary",
    title: "大型页面缩小渲染边界",
    summary: "只让当前页签和当前工作区参与派生计算，避免隐藏页面重复渲染。",
    quickApply: "先由路由和可见栏目派生活动视图，再对大列表、媒体计划和深签名建立稳定边界；非所属页签不构造不可见数据。",
    evidence: "产品市场渐进页面的头像媒体计划由 12 项降至可见栏最多 2 项，深签名与读取约减少 83%；非客服页签不再为首批 2 位专家构造朗音、提醒、声音和图片 4 组深签名，少 8 组 Object.entries/sort/map。主题派生结果现按内置覆盖与自定义主题引用缓存，每次无关状态提交少重建 7+N 个主题对象，并保持 8 个下游 memo/callback 边界稳定。",
    source: "historical-verified",
  },
  {
    id: "observer-feedback-control",
    title: "观察器反馈冷却",
    summary: "观察器、视口和媒体查询统一合并调度，避免重复测量与诊断工具制造自身负载。",
    quickApply: "现代浏览器使用事件与观察器；仅在两类尺寸 API 都缺失时启用可见页低频兜底。",
    evidence: "响应式共享契约已取消现代浏览器 250ms 常驻轮询，全部尺寸信号合并为单次更新；旧环境仅可见页每秒兜底。",
    source: "historical-verified",
  },
  {
    id: "visibility-aware-background-work",
    title: "后台页暂停周期唤醒",
    summary: "共享轮询和恢复重查只在页面可见且仍有消费者时排队；隐藏页取消计时器，回到前台再按失败状态与数据新鲜度补查。",
    quickApply: "把常驻 interval 改为可见期 one-shot timeout，记录最近完成时间，并用一个共享 visibilitychange 监听统一暂停、恢复和去重。",
    evidence: "本地环境状态的 3 个消费者共用 300000ms 检查周期；旧实现隐藏 24 小时最坏仍唤醒并请求 288 次，新实现后台周期唤醒为 0，前台仍保持 5 分钟刷新、10 秒故障重查和单飞请求。",
    source: "historical-verified",
  },
  {
    id: "event-backed-transient-polling",
    title: "短时读条由事件维护快照",
    summary: "短时进度只用一个可见期节拍刷新时间派生值；业务状态由同标签事件和跨标签 storage 事件更新，不在每个节拍重复读取并解析本地存储。",
    quickApply: "把状态同步与进度 tick 分开：事件负责替换内存快照，一个 one-shot timeout 负责进度与就绪检查，隐藏页停表并在回前台同步一次。",
    evidence: "站点切换最短 5000ms 保护期原有 200ms 与 250ms 两个 interval，至少 45 次回调且约 25 次 localStorage JSON 解析；合并后最多 25 次回调，稳定切换约 1 次解析，分别减少 44% 与 96%，隐藏页周期唤醒为 0。",
    source: "historical-verified",
  },
  {
    id: "batch-async-state-commit",
    title: "并发素材批量提交状态",
    summary: "同一视图的一组独立异步素材继续并发读取并逐项隔离失败；素材计划变化时先条件清除旧预览，全部结算后再把当前成功结果整体替换为一次状态提交，避免旧素材残留和逐项重渲染。",
    quickApply: "素材计划变化时先用一次条件 setter 清除非空旧快照，再用 Promise.allSettled 并发读取；结算后检查取消标记、过滤失败项、比较完整 ID 与 url/kind 快照，并用一个函数式 setter 原子替换。",
    evidence: "Sidebar 的 01–12 专家头像原先每个成功预览各提交一次状态，最坏 12 次大侧栏重渲染；正常初次加载仍最多 1 次批量提交，素材替换场景最多增加 1 次条件清旧，提交上限为 2 次，至少减少 10 次、约 83%，并确保移除、替换或读取失败的旧素材不会残留。ProductMarket 客服页继续保持当前专家优先；其余 11 位按每批最多 3 项 allSettled 后一次合并，头像提交上限从约 12 次降为最多 5 次，朗音和提醒音各最多 1 次提交；单项失败、素材缓存、替换失效和 effect 取消语义保持不变，对象 URL 清理同样保留。",
    source: "historical-verified",
  },
  {
    id: "route-owned-data-boundary",
    title: "路由审计数据退出核心依赖",
    summary: "只被审计或治理工作台消费的大型静态数据留在路由边界内，不进入共享核心依赖和普通页面的解析链。",
    quickApply: "把审计清单、治理矩阵、快照和报告从轻量核心模块拆到惰性路由数据模块，入口只在打开对应工作台时读取，核心不得值重导出。",
    evidence: "Page Factory 两份审计 JSON 拆出后，核心依赖 raw 401118→193570（-207548），minified 300532→127978（-172554），gzip9 44173→8886（-35287）。平台蓝图又将 55,465 bytes 治理数据移入四个已审查的懒消费者，轻量核心 118,223→62,758 bytes；新治理模块 55,940 bytes raw / 16,860 bytes gzip，拆分净源码开销仅 475 bytes，并由禁止核心值重导出的专项门禁约束。",
    source: "historical-verified",
  },
  {
    id: "route-owned-deferred-css",
    title: "页面专属 CSS 延迟归属路由",
    summary: "只服务单一路由的选择器不常驻全局样式，由页面边界按需加载，同时保留该路由的完整视觉规则。",
    quickApply: "先按选择器作用域审计，再把页面专属规则迁入路由 CSS；分别核对全局体积、路由增量和规则数量。",
    evidence: "SiteSettings 迁出 38 条、12950 bytes 专属 CSS，index.css 625969→613019，全局 gzip9 减少 1119 bytes，路由 gzip 增加 807 bytes；其 shared-frame 再归属 38 条、12691 bytes、gzip9 1644 bytes。CompanyInfoDeferredPanels 归属 51 条、14289 bytes、gzip9 3218 bytes，SocialMedia 归属 15 条、8008 bytes、gzip9 1712 bytes。栏目配置安全迁出 40 条、12535 bytes 非 @layer 独占 CSS，index.css 602572→589729；31 条 Tailwind layered、11 条 mixed/shared 与 6 条共享适配规则继续留在全局。后续又把 SocialMedia 19 条与 SiteSettings 15 条严格单页规则归还各自懒加载样式，index.css 589729→575127（-14602，-2.48%），gzip9 再减少 1984 bytes；混合、共享、结构 carrier 与全部 @layer 规则保持全局，避免改变级联语义。",
    source: "historical-verified",
  },
  {
    id: "deferred-widget-owned-css",
    title: "延迟组件携带专属 CSS",
    summary: "只由延迟组件消费的样式跟随组件分包加载，不让普通页面提前下载和解析；跨页面共享规则仍留在全局契约。",
    quickApply: "先用根选择器反查唯一组件所有权，再由 lazy 组件直接导入专属样式；逐条核对移动端、窗口、头像和尾栏等共享规则不得迁出。",
    evidence: "客服浮窗迁出 20 条、10446 bytes 专属 CSS，index.css 613019→602572；组件仍在首屏稳定后的 2400ms + idle 边界加载，专项契约、PostCSS、类型与 ESLint 验证通过。",
    source: "historical-verified",
  },
  {
    id: "tab-exclusive-control-boundary",
    title: "页签专用控件与交互壳退出主包",
    summary: "只在单一页签出现的重交互控件或无业务状态的交互外壳独立分包，普通页签不下载、不解析，也不创建该控件的状态和副作用。",
    quickApply: "保留受控接口与业务状态所有权，把实现、专用常量或纯交互壳移入 lazy 模块；在页签 pointer、focus 和打开意图时预热，用无状态 Suspense 占位保持布局稳定，并接入共享内联重试和恢复诊断。",
    evidence: "产品市场调色器与专属预设迁入 5177 bytes 独立源体；客服大卡片排序壳迁入 5894 bytes Service 专属源体，父层继续持有 DnD、排序、保存、回读、上传和锁状态。侧栏进入客服音效会与页面 lazy 共享 single-flight Promise，直接目标路由在 ProductMarket 求值时提前预热；普通页签不触发对应导入，失败预热可释放并走共享恢复。",
    source: "historical-verified",
  },
  {
    id: "tiered-performance-evidence",
    title: "性能证据分快检与发布级全检",
    summary: "日常迭代先用小样本验证冷启动、缓存复访和三档响应式边界；只有候选方案通过后才运行完整分布采样，避免把缓慢的发布级检查误用为每一次编辑的阻塞步骤。",
    quickApply: "共享同一页面身份、就绪条件、功能等价和资源异常规则；快检固定为每种访问状态两次采样并覆盖桌面、平板、手机，完整证据固定为每种访问状态七次采样。快检结果只能决定是否继续优化，不能代替最终发布结论。",
    evidence: "客户源产品市场→版面风格已复用统一性能采集器：快检实测约 20 秒完成，并由入口强制验证 2 次冷启动、2 次复访和 3 个视口；完整入口强制 7 次冷启动 + 7 次复访与相同功能/响应式门槛，两者均不继承外部残留采样模式。默认报告按页面目标命名。基线未发现非预期写请求、额外重复请求或布局抖动，因此不以高风险重构交换微小的测量波动。",
    source: "historical-verified",
  },
] as const satisfies readonly PerformanceExperiencePattern[];

export const PERFORMANCE_EXPERIENCE_CLEANUP_PLAYBOOK = [
  {
    id: "remove-visual-shells",
    order: 1,
    title: "第一轮清壳",
    instruction: "删除只做装饰的标题壳、表头壳、右侧状态壳、重复背景、边框、胶囊和填充层，只保留文字与功能本体。",
    sourceReview: "先确认容器不持有布局、滚动、焦点、拖拽或状态职责，再由开发者审阅后删除。",
    mode: "advisory-source-review",
  },
  {
    id: "inherit-surface-colors",
    order: 2,
    title: "第二轮清颜色",
    instruction: "移除输入框和名称、语言、链接等局部重复填充、下划线与色值覆盖，让内容继承主体版面颜色。",
    sourceReview: "保留选中、警告、禁用和可访问焦点等有语义的状态色，避免为了轻量破坏辨识度。",
    mode: "advisory-source-review",
  },
  {
    id: "flatten-light-actions",
    order: 3,
    title: "第三轮扁平交互",
    instruction: "将图标操作、上下移、删除、加级别和收起展开等轻操作改为语义化原生 button，去掉重型控件包装。",
    sourceReview: "迁移时逐项保留事件、键盘操作、aria 标签、禁用态、焦点态与权限判断。",
    mode: "advisory-source-review",
  },
  {
    id: "defer-non-first-screen",
    order: 4,
    title: "第四轮拆非首屏",
    instruction: "先区分首屏必须加载与切换页签才加载的内容，再把非首屏面板、弹窗和可视化工具拆为 lazy + Suspense 分包。",
    sourceReview: "主文件只保留路由参数、页面状态读取、保存逻辑、当前首屏面板和懒加载入口。",
    mode: "advisory-source-review",
  },
  {
    id: "remove-retired-implementations",
    order: 5,
    title: "第五轮删旧实现",
    instruction: "确认分包接管并通过回归后，删除已迁移的旧编辑器、旧面板和停用分支，不把历史实现留在主包。",
    sourceReview: "先核对真实入口、保存回读和引用关系，禁止仅凭文件体积删除仍在使用的业务实现。",
    mode: "advisory-source-review",
  },
  {
    id: "internalize-deferred-props",
    order: 6,
    title: "第六轮收紧边界",
    instruction: "让分包内部消化自己的样式、子组件和派生值，减少主文件向非首屏面板传递的大型 props。",
    sourceReview: "业务状态所有权与保存边界保持原位，只收回纯展示依赖和可在分包内稳定派生的数据。",
    mode: "advisory-source-review",
  },
  {
    id: "prune-imports-and-helpers",
    order: 7,
    title: "第七轮清依赖",
    instruction: "清理迁移遗留的无用导入、类型、组件引用、无效排序函数、单次样式常量和无意义 helper。",
    sourceReview: "只内联简单且无复用价值的结构；存在语义、测试接口或多处复用的命名继续保留。",
    mode: "advisory-source-review",
  },
  {
    id: "verify-preserved-capabilities",
    order: 8,
    title: "第八轮验证交付",
    instruction: "每轮通过源码锁、契约静态验证、TypeScript、Vite 构建及大小屏、切页、保存与刷新回读验证后再继续。",
    sourceReview: "拖拽排序、树级增删、图标上传、横向滚动同步和全部业务状态必须逐项回归，不以轻量化为由删减。",
    mode: "advisory-source-review",
  },
] as const satisfies readonly PerformanceExperienceCleanupStep[];

export const PERFORMANCE_EXPERIENCE_PRESERVED_CAPABILITIES = [
  { id: "drag-sort", label: "拖拽排序", guard: "保留拖拽手柄、排序事件、持久化顺序与键盘替代操作。" },
  { id: "tree-crud", label: "树级增删", guard: "保留层级新增、删除、展开收起与父子关系校验。" },
  { id: "icon-upload", label: "图标素材上传", guard: "保留素材选择、上传、替换、尺寸限制与回读。" },
  { id: "horizontal-scroll-sync", label: "横向滚动同步", guard: "保留表头、内容区与滚动条之间的双向同步。" },
  { id: "business-state", label: "业务状态", guard: "保留路由参数、编辑状态、保存流程、权限和业务数据。" },
] as const satisfies readonly PerformanceExperiencePreservedCapability[];

const ISSUE_PATTERN_MAP: Record<PerformanceExperienceIssueId, PerformanceExperiencePatternId> = {
  "slow-route-stabilization": "route-state-stability",
  "slow-route-fallback": "route-state-stability",
  "large-route-script": "heavy-tool-lazy-load",
  "long-main-thread-task": "component-render-boundary",
  "layout-instability": "component-render-boundary",
  "large-dom-tree": "offscreen-render-skipping",
  "eager-offscreen-media": "media-lightweight-loading",
  "oversized-image-decode": "media-lightweight-loading",
  "lazy-load-recovery": "heavy-tool-lazy-load",
  "duplicate-resource-request": "network-single-flight",
  "large-resource-transfer": "heavy-tool-lazy-load",
  "storage-capacity-pressure": "storage-signature-cache",
  "oversized-storage-entry": "storage-signature-cache",
};

const ISSUE_LABELS: Record<PerformanceExperienceIssueId, string> = {
  "slow-route-stabilization": "页面稳定时间偏长",
  "slow-route-fallback": "路由真实等待偏长",
  "large-route-script": "路由脚本体积偏大",
  "long-main-thread-task": "主线程长任务偏多",
  "layout-instability": "页面布局偏移偏高",
  "large-dom-tree": "页面 DOM 规模偏大",
  "eager-offscreen-media": "视口外媒体提前加载",
  "oversized-image-decode": "图片解码尺寸浪费",
  "lazy-load-recovery": "页面懒加载恢复异常",
  "duplicate-resource-request": "相同资源重复请求",
  "large-resource-transfer": "大资源传输偏多",
  "storage-capacity-pressure": "本地存储容量压力",
  "oversized-storage-entry": "本地存储单项过大",
};

interface LayoutShiftPerformanceEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface LocalStorageMetrics {
  totalBytes: number;
  entries: number;
  largestEntryBytes: number;
}

interface RouteRecoveryMetrics {
  visitKey: string;
  retrying: number;
  recovered: number;
  failed: number;
}

const MAX_ROUTE_RECOVERY_METRICS = 80;
const MAX_ROUTE_RECOVERY_PHASE_COUNT = 99;

const routeFirstSeenAt = new Map<string, number>();
const routeStabilizationByRoute = new Map<string, number>();
const routeVisitKeyByRoute = new Map<string, string>();
const lastAutomaticAuditAtByIdentity = new Map<string, number>();
const scheduledAudits = new Map<string, number>();
const routeRecoveryMetricsByRoute = new Map<string, RouteRecoveryMetrics>();
const recentLongTasks: PerformanceEntry[] = [];
const recentLayoutShifts: LayoutShiftPerformanceEntry[] = [];
let longTaskObserver: PerformanceObserver | null = null;
let layoutShiftObserver: PerformanceObserver | null = null;
let mediaLoadingObserver: MutationObserver | null = null;
let learningRuntimeUsers = 0;
let localStorageMetricsCache: { expiresAt: number; metrics: LocalStorageMetrics } | null = null;

function getRoute() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

function getAuditScheduleKey(scope: PerformanceExperienceScope, route: string) {
  return `${scope}|${route}`;
}

function getAuditIdentity(scope: PerformanceExperienceScope, route: string) {
  return getAuditScheduleKey(scope, route);
}

function getRecoveryRoute(target: string) {
  return target.split("::", 1)[0]?.split("#", 1)[0] || "/";
}

function recordRouteRecoveryPhase(route: string, visitKey: string, phase: PageLoadRecoveryDetail["phase"]) {
  const existing = routeRecoveryMetricsByRoute.get(route);
  const current = existing?.visitKey === visitKey
    ? existing
    : { visitKey, retrying: 0, recovered: 0, failed: 0 };
  const next = {
    ...current,
    [phase]: Math.min(MAX_ROUTE_RECOVERY_PHASE_COUNT, current[phase] + 1),
  };
  routeRecoveryMetricsByRoute.delete(route);
  routeRecoveryMetricsByRoute.set(route, next);
  while (routeRecoveryMetricsByRoute.size > MAX_ROUTE_RECOVERY_METRICS) {
    const oldestRoute = routeRecoveryMetricsByRoute.keys().next().value as string | undefined;
    if (!oldestRoute) break;
    routeRecoveryMetricsByRoute.delete(oldestRoute);
  }
}

function readRouteRecoveryMetrics(route: string, visitKey: string): RouteRecoveryMetrics {
  const current = routeRecoveryMetricsByRoute.get(route);
  if (current?.visitKey === visitKey) return current;
  return { visitKey, retrying: 0, recovered: 0, failed: 0 };
}

function readStorageArray<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Performance learning is advisory and never blocks the page.
  }
}

function bootstrapHistoricalPatterns() {
  try {
    const current = JSON.parse(window.localStorage.getItem(PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.catalogStorageKey) || "null") as { contractVersion?: string; applicationLearningVersion?: string } | null;
    if (current?.contractVersion === PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.version
      && current.applicationLearningVersion === PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.applicationLearningVersion) return;
  } catch {
    // Rewrite an unreadable advisory cache from the code-owned catalog.
  }
  writeStorage(PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.catalogStorageKey, {
    contractVersion: PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.version,
    applicationLearningVersion: PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.applicationLearningVersion,
    automaticLearning: true,
    learnedAt: new Date().toISOString(),
    applicationLearning: DEVELOPER_LOADING_SPEED_LEARNING_CONTRACT,
    patterns: PERFORMANCE_EXPERIENCE_HISTORICAL_PATTERNS,
    cleanupPlaybook: PERFORMANCE_EXPERIENCE_CLEANUP_PLAYBOOK,
    preservedCapabilities: PERFORMANCE_EXPERIENCE_PRESERVED_CAPABILITIES,
  });
}

function collectLocalStorageMetrics(): LocalStorageMetrics {
  const currentTime = Date.now();
  if (localStorageMetricsCache && localStorageMetricsCache.expiresAt > currentTime) return localStorageMetricsCache.metrics;
  try {
    let characters = 0;
    let entries = 0;
    let largestEntryBytes = 0;
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index) || "";
      const value = window.localStorage.getItem(key) || "";
      const entryCharacters = key.length + value.length;
      characters += entryCharacters;
      entries += 1;
      largestEntryBytes = Math.max(largestEntryBytes, entryCharacters * 2);
    }
    const metrics = { totalBytes: characters * 2, entries, largestEntryBytes };
    localStorageMetricsCache = {
      expiresAt: currentTime + PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.storageMetricsTtlMs,
      metrics,
    };
    return metrics;
  } catch {
    return { totalBytes: 0, entries: 0, largestEntryBytes: 0 };
  }
}

function collectMetrics(route: string): PerformanceExperienceMetrics {
  const now = performance.now();
  const routeLoading = readRouteLoadingObservation(route);
  if (routeLoading.visitKey && routeVisitKeyByRoute.get(route) !== routeLoading.visitKey) {
    routeVisitKeyByRoute.set(route, routeLoading.visitKey);
    routeFirstSeenAt.set(route, routeLoading.visitStartedAt || now);
    routeStabilizationByRoute.delete(route);
  }
  const routeStart = routeFirstSeenAt.get(route) ?? (routeLoading.visitStartedAt || now);
  routeFirstSeenAt.set(route, routeStart);
  const routeStabilizationMs = routeStabilizationByRoute.get(route) ?? Math.max(0, Math.round(now - routeStart));
  routeStabilizationByRoute.set(route, routeStabilizationMs);
  const longTaskWindowStart = Math.max(routeStart, now - 30_000);
  const longTasks = recentLongTasks.filter((entry) => entry.startTime >= longTaskWindowStart);
  const layoutShiftScore = recentLayoutShifts
    .filter((entry) => entry.startTime >= routeStart && !entry.hadRecentInput)
    .reduce((total, entry) => total + entry.value, 0);
  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const routeResources = resources.filter((entry) => entry.startTime >= routeStart);
  const resourceCounts = new Map<string, number>();
  routeResources.forEach((entry) => resourceCounts.set(entry.name, (resourceCounts.get(entry.name) || 0) + 1));
  const resourceRequestCounts = Array.from(resourceCounts.values());
  const duplicateResourceRequests = resourceRequestCounts.filter((count) => count > 1).length;
  const duplicateRequestExcess = resourceRequestCounts.reduce((total, count) => total + Math.max(0, count - 1), 0);
  const largeResourceTransfers = routeResources.filter((entry) => entry.transferSize >= PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.thresholds.largeResourceTransferBytes).length;
  let oversizedDecodedImages = 0;
  const eagerOffscreenImages = Array.from(document.images).filter((image) => {
    const rect = image.getBoundingClientRect();
    const naturalPixels = image.naturalWidth * image.naturalHeight;
    const renderedPixels = rect.width * rect.height * Math.max(1, window.devicePixelRatio ** 2);
    if (naturalPixels >= 1_000_000 && renderedPixels > 0 && naturalPixels > renderedPixels * 4) oversizedDecodedImages += 1;
    return image.loading !== "lazy" && isEffectivelyOffscreen(image, true);
  }).length;
  let offscreenAutoplayMedia = 0;
  const eagerOffscreenMedia = Array.from(document.querySelectorAll<HTMLMediaElement>("audio,video")).filter((media) => {
    if (!isEffectivelyOffscreen(media, media instanceof HTMLVideoElement)) return false;
    if (media.autoplay) offscreenAutoplayMedia += 1;
    return media.preload === "auto" || media.autoplay;
  }).length;
  const eagerOffscreenFrames = Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe")).filter((frame) => frame.loading !== "lazy" && isEffectivelyOffscreen(frame, true)).length;
  const storage = collectLocalStorageMetrics();
  const routeRecovery = readRouteRecoveryMetrics(route, routeLoading.visitKey);
  return {
    routeStabilizationMs,
    routeFallbackMs: routeLoading.fallbackMs,
    routeScriptBytes: routeLoading.scriptBytes,
    largestRouteScriptBytes: routeLoading.largestScriptBytes,
    longTaskCount: longTasks.length,
    longTaskTotalMs: Math.round(longTasks.reduce((total, entry) => total + entry.duration, 0)),
    maxLongTaskMs: Math.round(longTasks.reduce((longest, entry) => Math.max(longest, entry.duration), 0)),
    layoutShiftScore: Number(layoutShiftScore.toFixed(3)),
    domNodes: document.getElementsByTagName("*").length,
    eagerOffscreenMedia: eagerOffscreenImages + eagerOffscreenMedia + eagerOffscreenFrames,
    offscreenAutoplayMedia,
    oversizedDecodedImages,
    lazyLoadRetryCount: routeRecovery.retrying,
    lazyLoadRecoveryCount: routeRecovery.recovered,
    lazyLoadFailureCount: routeRecovery.failed,
    duplicateResourceRequests,
    duplicateRequestExcess,
    largeResourceTransfers,
    localStorageBytes: storage.totalBytes,
    localStorageEntries: storage.entries,
    largestLocalStorageEntryBytes: storage.largestEntryBytes,
  };
}

function resolveIssues(metrics: PerformanceExperienceMetrics) {
  const issues: PerformanceExperienceIssueId[] = [];
  const thresholds = PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.thresholds;
  if (metrics.routeStabilizationMs > thresholds.routeStabilizationMs) issues.push("slow-route-stabilization");
  if (metrics.routeFallbackMs > thresholds.routeFallbackMs) issues.push("slow-route-fallback");
  if (metrics.routeScriptBytes > thresholds.routeScriptBytes || metrics.largestRouteScriptBytes > thresholds.largestRouteScriptBytes) issues.push("large-route-script");
  if (metrics.longTaskCount > thresholds.longTaskCount || metrics.longTaskTotalMs > thresholds.longTaskTotalMs || metrics.maxLongTaskMs > thresholds.maxLongTaskMs) issues.push("long-main-thread-task");
  if (metrics.layoutShiftScore > thresholds.layoutShiftScore) issues.push("layout-instability");
  if (metrics.domNodes > thresholds.domNodes) issues.push("large-dom-tree");
  if (metrics.eagerOffscreenMedia > thresholds.eagerOffscreenMedia || metrics.offscreenAutoplayMedia > 0) issues.push("eager-offscreen-media");
  if (metrics.oversizedDecodedImages > thresholds.oversizedDecodedImages) issues.push("oversized-image-decode");
  if (metrics.lazyLoadFailureCount > 0 || metrics.lazyLoadRetryCount > 1) issues.push("lazy-load-recovery");
  if (metrics.duplicateRequestExcess > thresholds.duplicateRequestExcess) issues.push("duplicate-resource-request");
  if (metrics.largeResourceTransfers > thresholds.largeResourceTransfers) issues.push("large-resource-transfer");
  if (metrics.localStorageBytes > thresholds.localStorageBytes) issues.push("storage-capacity-pressure");
  if (metrics.largestLocalStorageEntryBytes > thresholds.largestLocalStorageEntryBytes) issues.push("oversized-storage-entry");
  return issues;
}

function evidenceForIssue(issue: PerformanceExperienceIssueId, metrics: PerformanceExperienceMetrics) {
  if (issue === "slow-route-stabilization") return `${metrics.routeStabilizationMs}ms`;
  if (issue === "slow-route-fallback") return `路由回退实际显示 ${metrics.routeFallbackMs}ms`;
  if (issue === "large-route-script") return `路由脚本共 ${Math.round(metrics.routeScriptBytes / 1024)}KB，最大单包 ${Math.round(metrics.largestRouteScriptBytes / 1024)}KB`;
  if (issue === "long-main-thread-task") return `${metrics.longTaskCount} 个长任务，共 ${metrics.longTaskTotalMs}ms，最长 ${metrics.maxLongTaskMs}ms`;
  if (issue === "layout-instability") return `布局偏移分数 ${metrics.layoutShiftScore.toFixed(3)}`;
  if (issue === "large-dom-tree") return `${metrics.domNodes} 个 DOM 节点`;
  if (issue === "eager-offscreen-media") return `${metrics.eagerOffscreenMedia} 个视口外媒体，其中 ${metrics.offscreenAutoplayMedia} 个自动播放`;
  if (issue === "oversized-image-decode") return `${metrics.oversizedDecodedImages} 张图片解码尺寸明显大于显示尺寸`;
  if (issue === "lazy-load-recovery") return `重试 ${metrics.lazyLoadRetryCount} 次，恢复 ${metrics.lazyLoadRecoveryCount} 次，失败 ${metrics.lazyLoadFailureCount} 次`;
  if (issue === "duplicate-resource-request") return `${metrics.duplicateResourceRequests} 组重复资源，额外请求 ${metrics.duplicateRequestExcess} 次`;
  if (issue === "large-resource-transfer") return `${metrics.largeResourceTransfers} 个大资源`;
  if (issue === "storage-capacity-pressure") return `${metrics.localStorageEntries} 项，共 ${Math.round(metrics.localStorageBytes / 1024)}KB 本地存储`;
  return `最大本地存储单项 ${Math.round(metrics.largestLocalStorageEntryBytes / 1024)}KB`;
}

function learnIssues(
  scope: PerformanceExperienceScope,
  route: string,
  source: "automatic" | "manual",
  issues: PerformanceExperienceIssueId[],
  metrics: PerformanceExperienceMetrics,
) {
  const records = readStorageArray<PerformanceExperienceLearningEntry>(PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.storageKey);
  const now = new Date().toISOString();
  const learned: PerformanceExperienceLearningEntry[] = [];
  issues.forEach((issue) => {
    const patternId = ISSUE_PATTERN_MAP[issue];
    const pattern = PERFORMANCE_EXPERIENCE_HISTORICAL_PATTERNS.find((item) => item.id === patternId)!;
    const id = `${scope}|${route}|${issue}`;
    const existing = records.find((item) => item.id === id);
    const next: PerformanceExperienceLearningEntry = {
      id,
      issue,
      patternId,
      scope,
      route,
      evidence: evidenceForIssue(issue, metrics),
      recommendation: pattern.quickApply,
      firstSeenAt: existing?.firstSeenAt || now,
      lastSeenAt: now,
      count: (existing?.count || 0) + 1,
      source,
    };
    const existingIndex = records.findIndex((item) => item.id === id);
    if (existingIndex >= 0) records.splice(existingIndex, 1);
    records.push(next);
    learned.push(next);
  });
  writeStorage(PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.storageKey, records.slice(-PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.maxLearningEntries));
  return learned;
}

function getMetricTrendBand(value: number, threshold: number) {
  if (threshold <= 0) return value > 0 ? 1 : 0;
  if (value > threshold * 2) return 2;
  return value > threshold ? 1 : 0;
}

function getAuditTrendSignature(audit: PerformanceExperienceAudit) {
  const metrics = audit.metrics;
  const thresholds = PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.thresholds;
  return [
    audit.issues.join(","),
    getMetricTrendBand(metrics.routeFallbackMs, thresholds.routeFallbackMs),
    getMetricTrendBand(metrics.routeScriptBytes, thresholds.routeScriptBytes),
    getMetricTrendBand(metrics.maxLongTaskMs, thresholds.maxLongTaskMs),
    getMetricTrendBand(metrics.layoutShiftScore, thresholds.layoutShiftScore),
    getMetricTrendBand(metrics.domNodes, thresholds.domNodes),
    getMetricTrendBand(metrics.eagerOffscreenMedia, thresholds.eagerOffscreenMedia),
    getMetricTrendBand(metrics.oversizedDecodedImages, thresholds.oversizedDecodedImages),
    Math.min(2, metrics.lazyLoadRetryCount),
    Math.min(2, metrics.lazyLoadFailureCount),
    getMetricTrendBand(metrics.duplicateRequestExcess, thresholds.duplicateRequestExcess),
    getMetricTrendBand(metrics.largeResourceTransfers, thresholds.largeResourceTransfers),
    getMetricTrendBand(metrics.localStorageBytes, thresholds.localStorageBytes),
    getMetricTrendBand(metrics.largestLocalStorageEntryBytes, thresholds.largestLocalStorageEntryBytes),
  ].join("|");
}

function limitAuditHistory(audits: PerformanceExperienceAudit[]) {
  const identityCounts = new Map<string, number>();
  const kept: PerformanceExperienceAudit[] = [];
  for (let index = audits.length - 1; index >= 0; index -= 1) {
    const audit = audits[index];
    const identity = getAuditIdentity(audit.scope, audit.route);
    const identityCount = identityCounts.get(identity) || 0;
    if (identityCount >= PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.maxAuditEntriesPerIdentity) continue;
    identityCounts.set(identity, identityCount + 1);
    kept.push(audit);
  }
  return kept.reverse().slice(-PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.maxAuditEntries);
}

export function runPerformanceExperienceAudit(
  scope: PerformanceExperienceScope,
  source: "automatic" | "manual" = "manual",
): PerformanceExperienceAudit {
  bootstrapHistoricalPatterns();
  const route = getRoute();
  const auditIdentity = getAuditIdentity(scope, route);
  lastAutomaticAuditAtByIdentity.set(auditIdentity, Date.now());
  if (!routeFirstSeenAt.has(route)) routeFirstSeenAt.set(route, performance.now());
  const metrics = collectMetrics(route);
  const issues = resolveIssues(metrics);
  const learned = learnIssues(scope, route, source, issues, metrics);
  const audit: PerformanceExperienceAudit = {
    contractVersion: PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.version,
    scope,
    route,
    source,
    measuredAt: new Date().toISOString(),
    metrics,
    issues,
    learned,
  };
  const audits = readStorageArray<PerformanceExperienceAudit>(PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.auditStorageKey);
  let previousIdentityIndex = -1;
  for (let index = audits.length - 1; index >= 0; index -= 1) {
    const candidate = audits[index];
    if (candidate.contractVersion === PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.version
      && getAuditIdentity(candidate.scope, candidate.route) === auditIdentity) {
      previousIdentityIndex = index;
      break;
    }
  }
  const previous = previousIdentityIndex >= 0 ? audits[previousIdentityIndex] : null;
  if (previous && getAuditTrendSignature(previous) === getAuditTrendSignature(audit)) {
    audits[previousIdentityIndex] = audit;
  } else {
    audits.push(audit);
  }
  writeStorage(PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.auditStorageKey, limitAuditHistory(audits));
  document.documentElement.dataset.performanceExperienceLearning = issues.length ? "learned" : "healthy";
  document.documentElement.dataset.performanceExperienceIssues = issues.join(",");
  window.dispatchEvent(new CustomEvent(PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.eventName, { detail: audit }));
  return audit;
}

export function schedulePerformanceExperienceAudit(scope: PerformanceExperienceScope) {
  if (typeof window === "undefined") return;
  const route = getRoute();
  const auditKey = getAuditScheduleKey(scope, route);
  if (!routeFirstSeenAt.has(route)) routeFirstSeenAt.set(route, performance.now());
  if (scheduledAudits.has(auditKey)) return;
  const timer = window.setTimeout(() => {
    scheduledAudits.delete(auditKey);
    if (getRoute() !== route) return;
    const now = Date.now();
    const lastAuditAt = lastAutomaticAuditAtByIdentity.get(auditKey) || 0;
    if (now - lastAuditAt < PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.automaticAuditCooldownMs) return;
    lastAutomaticAuditAtByIdentity.set(auditKey, now);
    const appliedRoutes = readStorageArray<string>(PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.appliedRoutesStorageKey);
    if (appliedRoutes.includes(route)) applySafeMediaLoading();
    runPerformanceExperienceAudit(scope, "automatic");
  }, 900);
  scheduledAudits.set(auditKey, timer);
}

function isEffectivelyOffscreen(element: HTMLElement, zeroSizeIsHidden: boolean) {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const hiddenByContract = element.hidden
    || element.closest("[hidden],[aria-hidden='true'],[inert]") !== null
    || style.display === "none"
    || style.visibility === "hidden"
    || style.contentVisibility === "hidden";
  if (hiddenByContract || (zeroSizeIsHidden && (rect.width <= 1 || rect.height <= 1))) return true;
  return rect.bottom < -120
    || rect.top > window.innerHeight + 120
    || rect.right < -120
    || rect.left > window.innerWidth + 120;
}

function applySafeMediaLoading() {
  let changed = 0;
  Array.from(document.images).forEach((image) => {
    if (!isEffectivelyOffscreen(image, true)) return;
    if (image.loading !== "lazy") { image.loading = "lazy"; changed += 1; }
    if (image.decoding !== "async") image.decoding = "async";
  });
  document.querySelectorAll<HTMLMediaElement>("audio,video").forEach((media) => {
    if (!isEffectivelyOffscreen(media, media instanceof HTMLVideoElement)) return;
    if (media.preload === "auto") { media.preload = "metadata"; changed += 1; }
  });
  document.querySelectorAll<HTMLIFrameElement>("iframe").forEach((frame) => {
    if (!isEffectivelyOffscreen(frame, true) || frame.loading === "lazy") return;
    frame.loading = "lazy";
    changed += 1;
  });
  return changed;
}

export function startPerformanceExperienceLearning(scope: PerformanceExperienceScope) {
  if (typeof window === "undefined") return () => undefined;
  learningRuntimeUsers += 1;
  bootstrapHistoricalPatterns();
  document.documentElement.dataset.performanceExperienceAutoLearning = "true";
  const onRouteLoadingObserved = (event: Event) => {
    const observedRoute = (event as CustomEvent<{ route?: string }>).detail?.route;
    const route = getRoute();
    if (observedRoute !== route) return;
    lastAutomaticAuditAtByIdentity.delete(getAuditIdentity(scope, route));
    schedulePerformanceExperienceAudit(scope);
  };
  const onPageLoadRecovery = (event: Event) => {
    const detail = (event as CustomEvent<PageLoadRecoveryDetail>).detail;
    if (!detail || typeof detail.target !== "string"
      || !["retrying", "recovered", "failed"].includes(detail.phase)) return;
    const route = getRecoveryRoute(detail.target);
    if (route !== getRoute()) return;
    const visitKey = readRouteLoadingObservation(route).visitKey;
    recordRouteRecoveryPhase(route, visitKey, detail.phase);
    lastAutomaticAuditAtByIdentity.delete(getAuditIdentity(scope, route));
    schedulePerformanceExperienceAudit(scope);
  };
  window.addEventListener(ROUTE_LOADING_OBSERVED_EVENT_NAME, onRouteLoadingObserved);
  window.addEventListener(PAGE_LOAD_RECOVERY_EVENT_NAME, onPageLoadRecovery);
  if (!longTaskObserver && typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes.includes("longtask")) {
    longTaskObserver = new PerformanceObserver((list) => {
      recentLongTasks.push(...list.getEntries());
      while (recentLongTasks.length > 80) recentLongTasks.shift();
      schedulePerformanceExperienceAudit(scope);
    });
    longTaskObserver.observe({ entryTypes: ["longtask"] });
  }
  if (!layoutShiftObserver && typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes.includes("layout-shift")) {
    layoutShiftObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries() as LayoutShiftPerformanceEntry[];
      recentLayoutShifts.push(...entries);
      while (recentLayoutShifts.length > 160) recentLayoutShifts.shift();
      if (entries.some((entry) => !entry.hadRecentInput && entry.value > 0)) {
        schedulePerformanceExperienceAudit(scope);
      }
    });
    layoutShiftObserver.observe({ type: "layout-shift", buffered: true });
  }
  if (!mediaLoadingObserver && typeof MutationObserver !== "undefined" && document.body) {
    mediaLoadingObserver = new MutationObserver((records) => {
      if (!records.some((record) => Array.from(record.addedNodes).some((node) => node instanceof Element && (node.matches("img,video,audio,iframe") || node.querySelector("img,video,audio,iframe"))))) return;
      const route = getRoute();
      if (!readStorageArray<string>(PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.appliedRoutesStorageKey).includes(route)) return;
      applySafeMediaLoading();
      schedulePerformanceExperienceAudit(scope);
    });
    mediaLoadingObserver.observe(document.body, { childList: true, subtree: true });
  }
  schedulePerformanceExperienceAudit(scope);
  return () => {
    learningRuntimeUsers = Math.max(0, learningRuntimeUsers - 1);
    window.removeEventListener(ROUTE_LOADING_OBSERVED_EVENT_NAME, onRouteLoadingObserved);
    window.removeEventListener(PAGE_LOAD_RECOVERY_EVENT_NAME, onPageLoadRecovery);
    const auditKeyPrefix = `${scope}|`;
    scheduledAudits.forEach((timer, auditKey) => {
      if (!auditKey.startsWith(auditKeyPrefix)) return;
      window.clearTimeout(timer);
      scheduledAudits.delete(auditKey);
    });
    if (!learningRuntimeUsers) {
      longTaskObserver?.disconnect();
      longTaskObserver = null;
      layoutShiftObserver?.disconnect();
      layoutShiftObserver = null;
      mediaLoadingObserver?.disconnect();
      mediaLoadingObserver = null;
      recentLongTasks.length = 0;
      recentLayoutShifts.length = 0;
      routeRecoveryMetricsByRoute.clear();
      delete document.documentElement.dataset.performanceExperienceAutoLearning;
    }
  };
}

export function applyPerformanceExperiencePlanToCurrentRoute(scope: PerformanceExperienceScope) {
  const route = getRoute();
  const appliedRoutes = new Set(readStorageArray<string>(PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.appliedRoutesStorageKey));
  appliedRoutes.add(route);
  writeStorage(PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.appliedRoutesStorageKey, Array.from(appliedRoutes));
  const changed = applySafeMediaLoading();
  document.documentElement.dataset.performanceExperienceApplied = route;
  const audit = runPerformanceExperienceAudit(scope, "manual");
  return { route, changed, audit };
}

export function getPerformanceExperienceSnapshot(scope: PerformanceExperienceScope): PerformanceExperienceSnapshot {
  bootstrapHistoricalPatterns();
  const route = getRoute();
  const identity = getAuditIdentity(scope, route);
  const audits = readStorageArray<PerformanceExperienceAudit>(PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.auditStorageKey);
  const auditTrend = audits.filter((audit) => audit.contractVersion === PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.version
    && getAuditIdentity(audit.scope, audit.route) === identity).slice(-PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.maxAuditEntriesPerIdentity);
  return {
    contractVersion: PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.version,
    automaticLearning: true,
    applicationLearning: DEVELOPER_LOADING_SPEED_LEARNING_CONTRACT,
    scope,
    route,
    patterns: PERFORMANCE_EXPERIENCE_HISTORICAL_PATTERNS,
    cleanupPlaybook: PERFORMANCE_EXPERIENCE_CLEANUP_PLAYBOOK,
    preservedCapabilities: PERFORMANCE_EXPERIENCE_PRESERVED_CAPABILITIES,
    learned: readStorageArray<PerformanceExperienceLearningEntry>(PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.storageKey).reverse(),
    appliedRoutes: readStorageArray<string>(PERFORMANCE_EXPERIENCE_LEARNING_CONTRACT.appliedRoutesStorageKey),
    latestAudit: auditTrend.at(-1) || null,
    auditTrend,
  };
}

export function getPerformanceExperienceIssueLabel(issue: PerformanceExperienceIssueId) {
  return ISSUE_LABELS[issue];
}
