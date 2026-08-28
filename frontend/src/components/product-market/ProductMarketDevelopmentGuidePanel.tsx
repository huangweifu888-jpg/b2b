import { lazy, Suspense, useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeferredViewportSection } from "@/components/DeferredViewportSection";
import { Input } from "@/components/ui/input";
import { buildPageCompositionManifest, canPublishPageComposition } from "@/lib/page-composition-manifest";
import { buildPageCompositionImpactMap, type CompositionImpactSurface } from "@/lib/page-composition-impact-map";
import { getPageCompositionEditModeContract, type PageCompositionEditMode } from "@/lib/page-composition-edit-mode";
import { buildNewContentPluginGuide } from "@/lib/new-content-plugin-guide";
import { buildNewPageLayoutGuide } from "@/lib/new-page-layout-guide";
import { registerPageLayoutContract } from "@/lib/page-layout-contract";
import { getDevelopmentStandardCatalogItem } from "@/lib/development-standard-catalog";
import { getFactoryPlatformCategory } from "@/lib/factory-platform-blueprint";
import { FACTORY_PLATFORM_DEVELOPMENT_PHASES } from "@/lib/factory-platform-development-phases";

const DevelopmentStandardWorkbench = lazy(async () => ({
  default: (await import("@/components/product-market/DevelopmentStandardWorkbench")).DevelopmentStandardWorkbench,
}));
const DevelopmentStandardGovernancePanel = lazy(async () => ({
  default: (await import("@/components/product-market/DevelopmentStandardPanels")).DevelopmentStandardGovernancePanel,
}));
const DevelopmentStandardOperationsPanel = lazy(async () => ({
  default: (await import("@/components/product-market/DevelopmentStandardPanels")).DevelopmentStandardOperationsPanel,
}));
const PageCompositionAuditAndRecoveryPanel = lazy(async () => ({
  default: (await import("@/components/product-market/DevelopmentStandardPanels")).PageCompositionAuditAndRecoveryPanel,
}));
const PageCompositionMigrationPanel = lazy(async () => ({
  default: (await import("@/components/product-market/DevelopmentStandardPanels")).PageCompositionMigrationPanel,
}));
const SharedVisualParityContractPanel = lazy(async () => ({
  default: (await import("@/components/product-market/DevelopmentStandardPanels")).SharedVisualParityContractPanel,
}));
const ScreenshotRegressionBaselinePanel = lazy(async () => ({
  default: (await import("@/components/product-market/DevelopmentStandardPanels")).ScreenshotRegressionBaselinePanel,
}));

const PRODUCT_MARKET_DEVELOPMENT_STAGES = [
  {
    order: "01",
    title: "清扫页面",
    goal: "保留业务数据、路由与接口，移除旧弹窗桥接、重复外框、私有滚条和页面私有框架样式。",
    acceptance: "页面只保留一个主体工作区；不存在第二层阴影、间距或滚条来源。",
  },
  {
    order: "02",
    title: "选择全局板块",
    goal: "从共享变量读取顶部、主体、标题、表内、表头、内容、尾栏、字体、颜色、标注和统一间距。",
    acceptance: "所有可见框架共用视觉令牌；表头栏目、内容数据和插件仍由业务页保留。",
  },
  {
    order: "03",
    title: "组合表头板块",
    goal: "选择表头结构、操作区、列宽与滚条轨道；滚条跟随表头和内容工作区，而非卡片。",
    acceptance: "表头左右边缘与内容卡片对齐，内容从表头下方开始滚动。",
  },
  {
    order: "04",
    title: "组合内容板块",
    goal: "选择卡片、列表、表格、表单、素材或层级栏目内容结构；只保存本页的结构选择。",
    acceptance: "内容结构可替换，不改变全局颜色、字体、框架和滚条令牌。",
  },
  {
    order: "05",
    title: "勾选内容插件",
    goal: "从插件中心组合拖拉、上下移、开关、排号、图标、置顶、复制、编辑与删除等真实控件。",
    acceptance: "控件使用同一注册组件和共享 CSS；悬停高亮、尺寸、间距与可访问名称一致。",
  },
  {
    order: "06",
    title: "保存方案规划",
    goal: "记录“全局 + 表头 + 内容 + 插件 + 数据来源”的组合和适用页面，形成可恢复方案。",
    acceptance: "方案只引用已有板块与插件；不复制样式代码，不覆盖本页自定义数据。",
  },
  {
    order: "07",
    title: "按模板链同步",
    goal: "A 总部端 → 代理源端 → 代理端；B 总部端 → 客户源端 → 客户计划／站点。两条分支独立、单向并按权限发布。",
    acceptance: "下游不能回写模板源；下游自定义修改和新增数据不会被同步覆盖。",
  },
  {
    order: "08",
    title: "质量验收后发布",
    goal: "用实际页面检查加载、标注、对齐、滚条、控件悬停、窄屏和恢复点，再生成版本记录。",
    acceptance: "类型检查、生产构建和实际页面验证通过；异常与修复结论记录到质量中心。",
  },
] as const;

const PRODUCT_MARKET_DEVELOPMENT_NOTES = [
  ["01", "板块注册", "新增全局、表头、内容和插件必须先注册，再在页面方案中引用；禁止复制一份页面 CSS。"],
  ["02", "页面契约", "每页共用顶部、主体、标题、表内、表头、内容、滚条和尾栏的视觉令牌；仅数据、栏目结构和插件保留页面归属。"],
  ["03", "按需加载", "只加载当前二级栏和可见内容；素材预览、音频、复杂编辑器在用户打开后再挂载。"],
  ["04", "长列表保护", "大列表默认收起二级项、分段渲染并记住滚动位置，避免首次进入一次创建全部控件。"],
  ["05", "配置缓存", "同一模板版本只解析一次；路由切换复用已验证的共享变量和页面组合。"],
  ["06", "异常隔离", "页面错误只隔离当前工作区并提供手动重试，不自动循环刷新或影响其他页面。"],
  ["07", "基线对比", "每次同步后对比标题、表头、内容、滚条、尾栏与控件悬停；发现差异先定位覆盖来源。"],
  ["08", "可恢复发布", "发布前保存版本与恢复点，记录影响范围；只向下游同步框架，不覆盖下游自定义内容。"],
  ["09", "轻量框架", "固定“顶部、主体、标题、表内、表头、内容、大卡片、小卡片、尾栏”九个标注；只用语义变量、单滚动源和轻量静态阴影。"],
] as const;

const PRODUCT_MARKET_LIGHTWEIGHT_FRAME = [
  ["topbar", "顶部", "共享顶部变量", "高度、字体、功能按键与顶部底色；不承载页面业务结构。"],
  ["workspace", "主体", "共享主体变量", "唯一主体外框；左侧边缘以竖排标注主体，且不得再叠加第二个白底、阴影或滚动容器。"],
  ["title", "标题", "共享标题变量", "路径、说明、标题文字与标题操作；独立于表头和内容。"],
  ["table-shell", "表内", "共享工作区变量", "表头与内容的共同外壳，上角固定直角以连续承接标题区；左侧竖排标注，负责空隙与滚条轨道，不能当作右侧栏。"],
  ["table-header", "表头", "共享外观／页面结构", "表头颜色、边界、间距来自共享契约；当前页面保留操作、统计与列说明，下接内容区零间距。"],
  ["content", "内容", "共享外观／页面数据", "滚动源、边界和留白来自共享契约；当前页面保留列表、模块、表格、业务字段和插件，底部保留 60px 滚动空间。"],
  ["large-card", "大卡片", "内容卡片变量", "承载主要模块；沿用栏目配置的单层 12px 左右边缘与 12px 分类间距，并使用轻量边框、12px 圆角和统一内边距。"],
  ["small-card", "小卡片", "内容卡片变量", "承载胶囊、状态与次级信息；沿用栏目配置 space-y-2 的纵向 8px 节距，横向列距为 12px，不额外创建滚动或主题外壳。"],
  ["footer", "尾栏", "共享尾栏变量", "固定保存、应用与状态反馈；不承载内容区结构。"],
] as const;

const PRODUCT_MARKET_SOURCE_CHAIN_RULES = [
  ["A 代理分支", "总部端 → 代理源端 → 代理端", "总部端不得绕过代理源端直达代理端；代理端只接收代理源端已验证的框架、表头、内容方案与插件版本。"],
  ["B 客户分支", "总部端 → 客户源端 → 客户计划／站点", "总部端不得绕过客户源端直达客户计划或站点；客户计划／站点只接收客户源端已验证的版本。"],
  ["隔离与回流", "代理源端与客户源端互不发布", "任何来源端与运行端均不得反向发布，两条分支不得横向、跨分支或越级发布。"],
  ["共同底座", "三端共用组件、令牌、板块契约与插件注册表", "共用实现，不共用可写快照；每个源端保存本端作用域配置与发布记录。"],
  ["修改权限", "结构、样式、表头和插件只在开发工具修改", "普通业务页只维护业务数据与已批准方案选择，不允许新增私有结构或页面私有 CSS。"],
] as const;

const PRODUCT_MARKET_LONG_TERM_PROTECTIONS = [
  ["页面组合清单", "新页面必须先登记页面契约，再引用“全局 + 表头 + 内容 + 插件 + 数据源”；未登记页面不可进入全局同步。", "页面契约已登记，组合来源可追溯"],
  ["板块版本锁", "方案引用固定的全局、表头、内容和插件版本；更新方案先创建恢复点，避免静默改变已上线页面。", "方案版本、恢复点和影响范围齐全"],
  ["同步预演", "发布前先读取模板差异，确认只包含框架与方案变动；业务数据、下游自定义和新增数据必须排除。", "差异报告已确认，允许向下游发布"],
  ["结构守卫", "代码删除器只处理历史结构样式；普通页面禁止新增私有外框、私有滚条和跨页 CSS。", "页面只剩一个共享主体工作区"],
  ["性能基线", "以首页大图和长列表为基线，检查首屏、切换、滚动和素材预览；超过阈值改为按需加载或分段渲染。", "质量中心记录性能结果和复测结论"],
] as const;

const PRODUCT_MARKET_DEVELOPMENT_UPGRADES = [
  ["01", "页面组合清单", "登记页面契约", "先登记全局、表头、内容、插件和数据源的组合，再允许页面进入同步范围。", "未登记的页面不能执行全局同步。"],
  ["02", "插件能力边界", "声明插件能力", "为每个插件声明可用于卡片、列表、表格或表单的范围，以及依赖的状态和数据字段。", "不兼容的插件不能被方案选择。"],
  ["03", "双模式编辑", "区分配置与预览", "配置模式只编辑方案；预览模式只渲染实际结果，禁止预览层反向写入共享样式。", "切换模式不改变业务数据或已发布方案。"],
  ["04", "新页面向导", "按合同建页", "按“选全局 → 选表头 → 选内容 → 选插件 → 绑数据 → 验收”生成新页，不从旧页面复制代码。", "生成页只有一个主体工作区并已登记方案。"],
  ["05", "影响地图", "先看同步影响", "每次调整共享变量、表头、内容或插件前，列出会影响的页面、版本与下游端。", "发布前已确认影响范围和不覆盖项。"],
  ["06", "截图回归", "保留视觉基线", "对首页大图、长列表和市场四页保留基线截图，对比标题、表头、滚条、卡片和尾栏。", "视觉差异通过或附有已确认说明。"],
  ["07", "配置迁移", "升级旧方案", "板块或插件版本升级时提供迁移规则与恢复点；无法迁移时保留旧方案并标记待处理。", "升级不会静默改变已上线页面。"],
  ["08", "审计与恢复", "记录并可回退", "记录谁在何时发布了哪些板块、影响哪些下游；恢复只针对所选方案或所选端。", "可定位发布记录，并能独立恢复不影响其他引用。"],
] as const;

function NewPageCompositionWizard({ pathname, readOnly }: { pathname: string; readOnly: boolean }) {
  const [route, setRoute] = useState(pathname);
  const [revision, setRevision] = useState(0);
  const sourceWorkspace = pathname.startsWith("/zb")
    && !pathname.startsWith("/zb/agency/")
    && !pathname.startsWith("/zb/client/");
  const guide = useMemo(() => buildNewPageLayoutGuide(route), [route, revision]);
  const manifest = buildPageCompositionManifest(route);
  const canRegister = !readOnly && sourceWorkspace && guide.registration === "needs-registration" && route.startsWith("/");

  const register = () => {
    if (!canRegister) return;
    registerPageLayoutContract(route);
    setRevision((value) => value + 1);
  };

  return (
    <section data-new-page-composition-wizard className="border-t border-current/15 p-3">
      <div className="mb-1 text-sm font-semibold">新页面向导</div>
      <p className="mb-2 text-xs opacity-80">输入新路由后只登记固定框架合同；表头内容、业务数据和下游自定义数据始终不写入全局同步。</p>
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          data-new-page-route
          value={route}
          onChange={(event) => setRoute(event.target.value.trimStart())}
          disabled={readOnly}
          aria-label="新页面路由"
          placeholder="/zb/client-source/example"
        />
        <Button data-new-page-register type="button" onClick={register} disabled={!canRegister} variant="outline">
          {readOnly ? "预览只读" : guide.registration === "registered" ? "已登记" : sourceWorkspace ? "登记框架" : "运行端只读"}
        </Button>
      </div>
      <div className="mt-2 grid gap-2 text-xs leading-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-current/20 px-3 py-2"><b>全局</b><p className="opacity-80">{manifest.global.profile}</p></div>
        <div className="rounded-lg border border-current/20 px-3 py-2"><b>表头</b><p className="opacity-80">{manifest.header.profile} · {manifest.header.scrollOwner}</p></div>
        <div className="rounded-lg border border-current/20 px-3 py-2"><b>内容</b><p className="opacity-80">{manifest.content.profile} · {manifest.content.owner}</p></div>
        <div className="rounded-lg border border-current/20 px-3 py-2"><b>同步</b><p className="opacity-80">{manifest.sync.eligible ? "已发布模板资格" : "登记后仍需来源发布审核"}</p></div>
      </div>
    </section>
  );
}

function PageCompositionImpactMap({ pathname, search, readOnly }: { pathname: string; search: string; readOnly: boolean }) {
  const [surface, setSurface] = useState<CompositionImpactSurface>("global");
  const impactMap = buildPageCompositionImpactMap(pathname, search, surface);

  return (
    <section data-page-composition-impact-map className="border-t border-current/15 p-3">
      <div className="mb-1 text-sm font-semibold">同步影响地图</div>
      <p className="mb-2 text-xs opacity-80">发布前只预览影响范围；无论选择哪一项，业务数据、下游自定义、新增数据和上传素材都不会进入同步载荷。</p>
      <div className="mb-2 flex flex-wrap gap-2">
        {(["global", "header", "content", "plugins"] as const).map((item) => (
          <Button
            key={item}
            data-composition-impact-surface={item}
            type="button"
            size="sm"
            variant={surface === item ? "default" : "outline"}
            onClick={() => setSurface(item)}
            disabled={readOnly}
          >
            {{ global: "全局", header: "表头／滚条", content: "内容", plugins: "插件" }[item]}
          </Button>
        ))}
      </div>
      <div className="grid gap-2 text-xs leading-5 md:grid-cols-2 xl:grid-cols-3">
        {impactMap.targets.map((target) => (
          <article key={`${target.scope}-${target.label}`} data-composition-impact-target className="rounded-lg border border-current/20 px-3 py-2">
            <h2 className="font-semibold">{target.label}</h2>
            <p className="mt-1 opacity-80">{target.effect}</p>
          </article>
        ))}
      </div>
      <p className="mt-2 text-xs font-medium">发布规则：{impactMap.releaseRule === "runtime-pages-cannot-publish" ? "运行端只读，不能发布" : "仅来源端审核发布后，才按模板链向下游传播"}。</p>
    </section>
  );
}

function PluginCapabilityBoundary() {
  const plugins = buildNewContentPluginGuide();

  return (
    <section data-plugin-capability-boundary className="border-t border-current/15 p-3">
      <div className="mb-1 text-sm font-semibold">插件能力边界</div>
      <p className="mb-2 text-xs opacity-80">插件只由开发规范登记能力、共享样式和预览位置。页面只提供自己的业务回调；插件不会自行写入内容、排序或下游数据。</p>
      <div className="grid gap-2 text-xs leading-5 md:grid-cols-2 xl:grid-cols-3">
        {plugins.map((plugin) => (
          <article key={plugin.id} data-plugin-capability-item={plugin.id} className="rounded-lg border border-current/20 px-3 py-2">
            <h2 className="font-semibold">{plugin.id} · {plugin.group}</h2>
            <p className="mt-1 opacity-80">适用：{plugin.supports.join(" / ")}</p>
            <p className="opacity-80">依赖：{plugin.requires.join("、")}</p>
            <p className="mt-1 font-medium">保护：仅草案，确认应用与构建验证后才可进入页面方案。</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ProductMarketDevelopmentGuidePanel({ workspaceLabel, pathname, search }: { workspaceLabel: string; pathname: string; search: string }) {
  const manifest = buildPageCompositionManifest(pathname, search);
  const publishEligible = canPublishPageComposition(manifest);
  const [mode, setMode] = useState<PageCompositionEditMode>("configure");
  const modeContract = getPageCompositionEditModeContract(mode);
  const selectedStandard = getDevelopmentStandardCatalogItem(new URLSearchParams(search).get("standard"));
  const selectedFactoryCategory = getFactoryPlatformCategory(selectedStandard.id);
  const selectedFactoryPhases = selectedFactoryCategory
    ? FACTORY_PLATFORM_DEVELOPMENT_PHASES.filter((phase) => (
      selectedFactoryCategory.applications.some((application) => application.phase === phase.id)
    ))
    : [];

  return (
    <>
      <div
        data-product-market-header
        data-page-title="product-market"
        data-shared-layout-section="title"
        className="flex flex-col gap-2"
      >
        <div data-product-market-title-main data-responsive-live-title-layout className="flex w-full items-start justify-between gap-4">
          <div data-page-title-content className="min-w-0">
            <h1 data-responsive-live-title-heading className="flex items-center gap-2 text-2xl font-bold">
              <ShoppingBag className="h-6 w-6 shrink-0" aria-hidden="true" />
              <span>{workspaceLabel} → {selectedStandard.id === "market" ? "开发规范" : selectedStandard.title}</span>
            </h1>
            <p data-shared-title-description className="mt-1 text-sm">
              {selectedStandard.description}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 px-3 py-1 text-xs">基础 08 步 · 进阶 08 项</Badge>
        </div>
      </div>

      <section data-page-composition-edit-mode data-mode={mode} className="border-t border-current/15 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">双模式编辑</div>
            <p className="text-xs opacity-80">{mode === "configure" ? "配置模式只登记草案组合与查看影响，不写业务数据。" : "预览模式只读取已登记组合；所有写入控件均已锁定。"}</p>
          </div>
          <div className="flex gap-2">
            {(["configure", "preview"] as const).map((item) => (
              <Button
                key={item}
                data-page-composition-mode-switch={item}
                type="button"
                size="sm"
                variant={mode === item ? "default" : "outline"}
                onClick={() => setMode(item)}
              >
                {item === "configure" ? "配置" : "预览"}
              </Button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs font-medium">当前允许：{modeContract.allows.join("、")}；固定禁止：业务数据、下游数据及预览层写入共享样式。</p>
      </section>

      <section
        data-page-list
        data-page-list-scroll-owner
        data-shared-layout-section="list"
        data-product-market-development-list
        className="product-market-scroll-list min-h-0 flex-1 overflow-y-auto"
      >
        <details data-product-market-development-reference className="mx-3 mt-3 rounded-lg border border-current/20 px-3 py-2 text-xs">
          <summary className="cursor-pointer font-semibold">生成顺序 · 模板链（按需展开）</summary>
          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div>
              <div className="mb-2 font-semibold">生成顺序</div>
              <div className="flex flex-wrap items-center gap-2 font-medium">
                {PRODUCT_MARKET_DEVELOPMENT_STAGES.map((stage, index) => (
                  <span key={stage.order} className="inline-flex items-center gap-2">
                    <span className="rounded-full border px-2 py-1">{stage.order} {stage.title}</span>
                    {index < PRODUCT_MARKET_DEVELOPMENT_STAGES.length - 1 ? <span aria-hidden="true">→</span> : null}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid gap-2 leading-5">
              <div className="font-semibold">模板链</div>
              {PRODUCT_MARKET_SOURCE_CHAIN_RULES.map(([label, chain, rule]) => (
                <div key={label} className="grid gap-1 border-b border-current/10 pb-2 last:border-0 last:pb-0">
                  <div className="font-semibold">{label}：{chain}</div>
                  <div className="opacity-80">{rule}</div>
                </div>
              ))}
            </div>
          </div>
        </details>
        {selectedStandard.id !== "market" ? (
          <section data-development-standard-current-module={selectedStandard.id} className="mx-3 mt-3 rounded-lg border border-current/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">{selectedStandard.title}</div>
              <span className="rounded-full border border-current/20 px-2 py-1 text-xs font-medium">{selectedStandard.state === "planned" ? "待沉淀经营流程" : "已对接页面"}</span>
            </div>
            <p className="mt-2 text-xs opacity-80">{selectedStandard.description} 后续在此模块持续记录验证过的开发流程、经营经验、痛点和验收要点；未形成证据前不自动写入模板或下游端。</p>
            {selectedFactoryCategory ? (
              <div data-development-standard-factory-platform-category={selectedFactoryCategory.key} className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {selectedFactoryCategory.applications.map((application) => (
                  <article key={application.id} data-development-standard-factory-platform-application={application.id} data-delivery-status={application.deliveryStatus} className="rounded-lg border border-current/15 px-3 py-2 text-xs leading-5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold">{application.label}</h3>
                      <div className="flex shrink-0 gap-1">
                        <span className="rounded-full border border-current/20 px-2 py-0.5 font-medium">P{(FACTORY_PLATFORM_DEVELOPMENT_PHASES.find((phase) => phase.id === application.phase)?.sequence || 1) - 1}</span>
                      </div>
                    </div>
                    <p className="mt-1 opacity-80">{application.value}</p>
                    <p className="mt-1 font-medium">验收：{application.metrics.join("、")}</p>
                  </article>
                ))}
                <p className="md:col-span-2 xl:col-span-3 rounded-md border border-current/15 px-3 py-2 text-xs font-medium">
                  本类覆盖阶段：{selectedFactoryPhases.map((phase) => `P${phase.sequence - 1} · ${phase.title}`).join("、") || "按蓝图排期"}；交付成熟度统一在“平台蓝图”查看。
                </p>
              </div>
            ) : null}
          </section>
        ) : null}
        <Suspense fallback={<div data-development-standard-workbench-loading className="mx-3 my-3 min-h-20 rounded-lg border border-dashed border-current/20" />}>
          <DevelopmentStandardWorkbench />
        </Suspense>
        <section data-development-standard-lightweight-frame className="border-t border-current/15 p-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">轻量共享页面框架</div>
              <p className="text-xs opacity-80">全局与版面风格只调整变量；页面只组合区域。悬停下列区域可查看后期命令应指向的标注名称。</p>
            </div>
            <span className="rounded-full border border-current/20 px-2 py-1 text-xs font-medium">单主体 · 单表内 · 单滚动源</span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {PRODUCT_MARKET_LIGHTWEIGHT_FRAME.map(([id, label, source, description]) => (
              <article key={id} data-development-standard-frame-region={id} data-development-standard-frame-label={label} title={`标注：${label}；来源：${source}`} className="rounded-lg border border-current/20 px-3 py-2 text-xs leading-5">
                <h2 className="font-semibold">{label}</h2>
                <p className="mt-1 opacity-80">来源：{source}</p>
                <p className="mt-1">{description}</p>
              </article>
            ))}
          </div>
          <p className="mt-3 rounded-md border border-current/15 px-2 py-1 text-xs font-medium">轻量 3D 规则：只允许细边框、内侧 1px 高光和一层静态柔影；禁止滤镜、Canvas、多重阴影、持续动画及额外外壳。</p>
        </section>
        <div className="grid gap-3 p-3 lg:grid-cols-2">
          {PRODUCT_MARKET_DEVELOPMENT_STAGES.map((stage) => (
            <Card key={stage.order} data-product-market-development-stage className="border-current/20 bg-transparent shadow-none">
              <CardHeader className="gap-2 px-4 py-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-1 text-xs">{stage.order}</span>
                  {stage.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4 text-sm">
                <p><span className="font-semibold">规则：</span>{stage.goal}</p>
                <p className="opacity-80"><span className="font-semibold">验收：</span>{stage.acceptance}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="border-t border-current/15 p-3">
          <div className="mb-2 text-sm font-semibold">快速开发与加载优化注意点</div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {PRODUCT_MARKET_DEVELOPMENT_NOTES.map(([order, title, description]) => (
              <div key={order} className="rounded-lg border border-current/20 px-3 py-2 text-xs leading-5">
                <span className="mr-1 font-semibold">{order} {title}</span>
                <span className="opacity-80">{description}</span>
              </div>
            ))}
          </div>
        </div>
        <div data-product-market-long-term-protection className="border-t border-current/15 p-3">
          <div className="mb-2 text-sm font-semibold">长期保护点</div>
          <div className="grid gap-2 lg:grid-cols-5">
            {PRODUCT_MARKET_LONG_TERM_PROTECTIONS.map(([title, rule, signal]) => (
              <article key={title} className="rounded-lg border border-current/20 px-3 py-2 text-xs leading-5">
                <h2 className="font-semibold">{title}</h2>
                <p className="mt-1 opacity-80">{rule}</p>
                <p className="mt-2 font-medium">验收信号：{signal}</p>
              </article>
            ))}
          </div>
        </div>
        <div data-product-market-development-upgrades className="border-t border-current/15 p-3">
          <div className="mb-1 text-sm font-semibold">进阶开发流程（08 项）</div>
          <p className="mb-2 text-xs opacity-80">基础 08 步完成后，按以下顺序完善开发工具；所有变更仍只在开发工具完成，不在单独业务页写结构或共享样式。</p>
          <div className="grid gap-2 lg:grid-cols-2">
            {PRODUCT_MARKET_DEVELOPMENT_UPGRADES.map(([order, title, action, rule, acceptance]) => (
              <article key={order} data-product-market-development-upgrade className="rounded-lg border border-current/20 px-3 py-2 text-xs leading-5">
                <h2 className="font-semibold">{order} {title} · {action}</h2>
                <p className="mt-1 opacity-80">流程：{rule}</p>
                <p className="mt-2 font-medium">完成条件：{acceptance}</p>
              </article>
            ))}
          </div>
        </div>
        <DeferredViewportSection label="development-governance">
          <>
            <DevelopmentStandardGovernancePanel />
            <DevelopmentStandardOperationsPanel />
          </>
        </DeferredViewportSection>
        <div data-product-market-composition-manifest className="border-t border-current/15 p-3">
          <div className="mb-1 text-sm font-semibold">当前页面组合清单</div>
          <p className="mb-2 text-xs opacity-80">这是开发规范自身的可验证样例：它只登记组合引用，不保存业务数据，也不会写入下游自定义内容。</p>
          <div className="grid gap-2 text-xs leading-5 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-lg border border-current/20 px-3 py-2"><b>全局</b><p className="opacity-80">{manifest.global.profile} · {manifest.global.owner}</p></article>
            <article className="rounded-lg border border-current/20 px-3 py-2"><b>表头／滚条</b><p className="opacity-80">{manifest.header.profile} · {manifest.header.scrollOwner}</p></article>
            <article className="rounded-lg border border-current/20 px-3 py-2"><b>内容／插件</b><p className="opacity-80">{manifest.content.profile} · {manifest.plugins.join(" / ")}</p></article>
            <article className="rounded-lg border border-current/20 px-3 py-2"><b>发布资格</b><p className="opacity-80">{publishEligible ? "已登记模板源，可向下游发布" : "未登记或非模板源，不可发布"}</p></article>
          </div>
        </div>
        <NewPageCompositionWizard pathname={pathname} readOnly={mode === "preview"} />
        <PageCompositionImpactMap pathname={pathname} search={search} readOnly={mode === "preview"} />
        <PluginCapabilityBoundary />
        <DeferredViewportSection label="development-audit-recovery">
          <>
            <ScreenshotRegressionBaselinePanel />
            <SharedVisualParityContractPanel />
            <PageCompositionMigrationPanel pathname={pathname} search={search} />
            <PageCompositionAuditAndRecoveryPanel pathname={pathname} search={search} readOnly={mode === "preview"} />
          </>
        </DeferredViewportSection>
      </section>
    </>
  );
}

export default ProductMarketDevelopmentGuidePanel;
