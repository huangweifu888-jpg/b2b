import {
  PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP,
  PRODUCT_MARKET_THEME_PALETTES,
  PRODUCT_MARKET_THEME_PALETTE_MAP,
  buildProductMarketSidebarGradient,
  isProductMarketSidebarGradientDeepToLight,
  type ProductMarketThemePaletteKey,
} from "./product-market-theme-palettes";
import {
  RESPONSIVE_SHELL_FUNCTION_KEY_SELECTOR,
  RESPONSIVE_SHELL_FACTORY_DEFAULT,
  resolveResponsiveShellStage,
  resolveServiceExpertColumnCount,
  resolveResponsiveVerticalStage,
} from "./responsive-shell-contract";
import { GLOBAL_RESPONSIVE_PAGE_FACTORY_DEFAULT, GLOBAL_RESPONSIVE_PAGE_TEMPLATE_IDS } from "./global-responsive-page-contract";
import { ADAPTIVE_STRUCTURE_FACTORY_DEFAULT } from "./adaptive-structure-contract";
import { SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT } from "./shared-adaptive-surface-contract";
import {
  EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT,
  existingWorkspaceBodyMarkerHitAreaMatchesGeometry,
  findExistingWorkspaceBodyMarkerHitArea,
  findExistingWorkspaceBodyMarkerHost,
} from "./layout-frame-contract";
import { CUSTOMER_SERVICE_EXPERT_CONTENT_CONTRACT } from "./customer-service-expert-contract";
import {
  hasSharedSelectionSurfaceStateParity,
  isSharedSelectionSurfaceActive,
  SHARED_SELECTION_SURFACE_CONTRACT,
} from "./global-theme-tokens";
import {
  collectSharedSmallCardMarkerCandidates,
  findSharedSmallCardMarkerScope,
  isSharedSmallCardMarkerCandidate,
  resolveSharedSmallCardMarkerRepresentative,
  isSharedWindowRegistryBindingValid,
  SHARED_CENTER_SYMMETRIC_RESIZE_CONTRACT,
  SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE,
  SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE,
  SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE,
  SHARED_SMALL_CARD_AUTOMATIC_SCOPE,
  SHARED_SMALL_CARD_ADAPTER_SCOPE,
  SHARED_SMALL_CARD_DECLARED_SCOPE,
  SHARED_SMALL_CARD_MARKER_ADAPTER_SCOPE_SELECTOR,
  SHARED_SMALL_CARD_MARKER_AUTOMATIC_SCOPE_SELECTOR,
  SHARED_SMALL_CARD_MARKER_DECLARED_SCOPE_SELECTOR,
  SHARED_SMALL_CARD_MARKER_SCOPE_SELECTOR,
  SHARED_WINDOW_CONTRACT_VERSION,
  SHARED_WINDOW_FACTORY_DEFAULT,
  SHARED_WINDOW_REGION_IDS,
  SHARED_WINDOW_THEME_PROJECTIONS,
} from "./shared-window-contract";

export const SHARED_FLOATING_SERVICE_SAFE_RIGHT_TOKEN = "--tradepro-shared-floating-service-safe-right";

export type SharedVisualParityFactorId =
  | "floating-service-safe-inset"
  | "shared-gates"
  | "semantic-regions"
  | "single-scroll-owner"
  | "table-shell-corners"
  | "table-header-boundary"
  | "card-radius"
  | "card-elevation"
  | "shared-typography"
  | "plugin-geometry"
  | "hierarchy-pill-geometry"
  | "module-editor-capsules"
  | "module-editor-capacity"
  | "module-category-capacity"
  | "product-market-shared-categories"
  | "layout-section-editor-capsule"
  | "service-expert-capacity"
  | "service-expert-content-root"
  | "large-card-typography"
  | "small-card-typography"
  | "status-card-source"
  | "sidebar-gradient-order"
  | "font-choice-selection"
  | "theme-palette-dual-tone"
  | "context-markers"
  | "responsive-scroll-containment"
  | "responsive-navigation-continuity"
  | "responsive-sidebar-route-disclosure"
  | "responsive-drawer-integrity"
  | "responsive-topbar-integrity"
  | "responsive-page-tools-integrity"
  | "responsive-function-key-consistency"
  | "responsive-footer-capacity"
  | "responsive-visual-launcher-safety"
  | "responsive-priority-ladder"
  | "responsive-vertical-budget"
  | "responsive-learning-governance"
  | "responsive-title-action-capacity"
  | "responsive-global-page-host"
  | "responsive-shared-live-surfaces";

export type SharedVisualParityFactor = {
  id: SharedVisualParityFactorId;
  label: string;
  owner: "shared-visual-contract";
  expected: string;
  scan: "every-registered-page";
};

/**
 * These factors are the executable part of the shared visual contract. They
 * describe appearance and geometry only; business fields, records, card
 * composition and enabled plugin capabilities remain page-owned.
 */
export const SHARED_VISUAL_PARITY_FACTORS: readonly SharedVisualParityFactor[] = [
  { id: "responsive-title-action-capacity", label: "标题功能按键容量", owner: "shared-visual-contract", expected: "总部端、代理源、客户源在 640px 及以上始终保持标题右侧功能按键内在宽度单行；轨道确实不足时只允许栏内横向滚动，手机小屏才可把完整操作栏移到标题下方，禁止出现三行按键、零宽、逐字换行或越出页面。", scan: "every-registered-page" },
  { id: "responsive-global-page-host", label: "全页面响应宿主", owner: "shared-visual-contract", expected: "总部端、代理源、客户源每条普通页面路由均由同一个容器优先页面宿主管理，并按参考、仪表盘、列表、表单、详情、编辑器、流程模板重排；业务数据和页面字段保持页面所有。", scan: "every-registered-page" },
  { id: "responsive-shared-live-surfaces", label: "大屏唯一真实表面", owner: "shared-visual-contract", expected: "顶部、标题1、标题2、表头、内容和尾栏只存在一份大屏真实组件；小屏仅移动、缩密和重排同一 DOM，禁止复制业务控件或状态。", scan: "every-registered-page" },
  { id: "responsive-vertical-budget", label: "纵向内容预算", owner: "shared-visual-contract", expected: "短屏先压缩框架和辅助说明，再把次级标题变为单行工具带；滚动专注时只保留表头，内容区不少于约定比例。", scan: "every-registered-page" },
  { id: "responsive-learning-governance", label: "响应式学习治理", owner: "shared-visual-contract", expected: "运行时压力只进入学习记录；经多尺寸验证、批准和版本升级后才能写入恢复工厂默认。", scan: "every-registered-page" },
  { id: "responsive-priority-ladder", label: "缩放精简换行收纳", owner: "shared-visual-contract", expected: "P0-P3 优先级驱动流体缩放、辅助说明精简、业务顺序换行和极窄屏收纳。", scan: "every-registered-page" },
  { id: "responsive-topbar-integrity", label: "三端顶部完整性", owner: "shared-visual-contract", expected: "窄屏顶部工具保持固定顶部高度，使用视口内锚定悬浮面板和内部滚动；不得挤压正文，并避开固定可视化入口。", scan: "every-registered-page" },
  { id: "responsive-page-tools-integrity", label: "极限屏独立工具栏", owner: "shared-visual-contract", expected: "外层先完整显示左栏、顶部、标题1、标题2、表头的文字与图标；只有实测文字行放不下才收为同一按钮的纯图标，完整图标行仍放不下才出现更多；下拉直接读取大屏真实表面插件，仅改变紧凑密度与位置。", scan: "every-registered-page" },
  { id: "responsive-function-key-consistency", label: "六个共享功能键插件", owner: "shared-visual-contract", expected: "左栏、顶部、标题1、标题2、表头与可视化统一读取恢复工厂的 36px 功能键插件；真实按钮只绘制一层边框，外层插槽无框，任何高度偏差不得超过 1px。", scan: "every-registered-page" },
  { id: "responsive-footer-capacity", label: "尾栏容量与紧凑间距", owner: "shared-visual-contract", expected: "三项锁统一使用源码解／页面解／栏目解与源码锁／页面锁／栏目锁；保存并同步入口显示为保存；空间足够时显示文字，只有实测无法容纳时才收为图标，图标文字间距统一为 4px。", scan: "every-registered-page" },
  { id: "responsive-visual-launcher-safety", label: "可视化入口固定尾栏", owner: "shared-visual-contract", expected: "可视化入口固定在尾栏“保存并同步”之前，不支持拖动、方向键移动或保存位置，并与尾栏功能键保持同高同序。", scan: "every-registered-page" },
  { id: "responsive-drawer-integrity", label: "抽屉单侧栏", owner: "shared-visual-contract", expected: "导航抽屉不能继承普通弹窗宽度；它必须只有一个满宽侧栏和一个内容滚动所有者。", scan: "every-registered-page" },
  { id: "responsive-navigation-continuity", label: "三端连续导航", owner: "shared-visual-contract", expected: "1024px 以下固定左栏隐藏时，抽屉导航入口必须可见；该规则来自代码工厂默认。", scan: "every-registered-page" },
  { id: "responsive-sidebar-route-disclosure", label: "三端活动项目分支", owner: "shared-visual-contract", expected: "总部端、代理源、客户源以当前路由为唯一展开来源：二级切换保持当前项目展开，切换项目关闭前一分支并展开当前分支，页面重挂载后从网址首帧恢复。", scan: "every-registered-page" },
  { id: "floating-service-safe-inset", label: "Floating expert safe inset", owner: "shared-visual-contract", expected: "Expert avatar and chat window retain the shared right clearance and reserve a 72px mobile footer-safe bottom area; every resize remains centre-symmetric across all four sides.", scan: "every-registered-page" },
  { id: "responsive-scroll-containment", label: "小屏滚动容器", owner: "shared-visual-contract", expected: "小屏下表内和列表不得横向溢出，胶囊自动换行。", scan: "every-registered-page" },
  { id: "shared-gates", label: "共享契约入口", owner: "shared-visual-contract", expected: "共享变量、响应式和页面框架必须启用", scan: "every-registered-page" },
  { id: "semantic-regions", label: "语义区域登记", owner: "shared-visual-contract", expected: "主体、标题、内容以及存在时的表内和表头必须可发现", scan: "every-registered-page" },
  { id: "single-scroll-owner", label: "唯一滚动所有者", owner: "shared-visual-contract", expected: "需要纵向滚动时必须且只能有一个已登记所有者", scan: "every-registered-page" },
  { id: "table-shell-corners", label: "表内连续圆角", owner: "shared-visual-contract", expected: "表内上角为直角，底角跟随主体圆角", scan: "every-registered-page" },
  { id: "table-header-boundary", label: "表头四角与悬停稳定", owner: "shared-visual-contract", expected: "表头四个外角读取表头圆角，阴影读取轻量 3D，禁止白色 inset 和悬停位移", scan: "every-registered-page" },
  { id: "card-radius", label: "卡片圆角", owner: "shared-visual-contract", expected: "表格行和卡片都读取统一卡片圆角", scan: "every-registered-page" },
  { id: "card-elevation", label: "卡片轻量 3D", owner: "shared-visual-contract", expected: "所有卡片读取统一阴影；禁止旧白色 inset 高光和私有 shadow", scan: "every-registered-page" },
  { id: "shared-typography", label: "共享字体", owner: "shared-visual-contract", expected: "卡片与插件读取全局字体、字重和字距", scan: "every-registered-page" },
  { id: "plugin-geometry", label: "插件几何", owner: "shared-visual-contract", expected: "图标插件读取统一尺寸，文字插件只共享高度和字体", scan: "every-registered-page" },
  { id: "hierarchy-pill-geometry", label: "层级文字分段几何", owner: "shared-visual-contract", expected: "栏目配置的一级、二级层级／排号／新增层级使用 24px 无框文字分段和共享分隔线；不得伪装成胶囊按钮", scan: "every-registered-page" },
  { id: "module-editor-capsules", label: "栏目单卡片边界", owner: "shared-visual-contract", expected: "一级和二级只由真实栏目卡片绘制一层边界；左右承载器透明无框，图标设置、状态与展开箭头保留真实点击边界", scan: "every-registered-page" },
  { id: "module-editor-capacity", label: "栏目编辑容量分级", owner: "shared-visual-contract", expected: "栏目卡片复用同一大屏 DOM：480px 起操作／状态／层级紧凑同行且双字段同行；1024px 起栏目状态设置、栏目排号、栏目名称、栏目说明四列必须与共享表头对齐，图标设置不得独占整行；352–479px 整组分行，351px 以下状态组三等分占满一行", scan: "every-registered-page" },
  { id: "module-category-capacity", label: "分类名称容量与普通文档流", owner: "shared-visual-contract", expected: "分类栏复用同一大屏 DOM，分类名称与状态在容量足够时靠左紧凑排列，内部承载区始终占满卡片宽度；所有尺寸均保持普通文档流并随内容滚动，不得吸顶、固定或遮挡后续栏目；容量不足时整组换行但名称不得脱离分类栏。", scan: "every-registered-page" },
  { id: "product-market-shared-categories", label: "产品市场分类同源与批量状态", owner: "shared-visual-contract", expected: "栏目配置是分类键、顺序和名称的唯一来源；运营市场只把同一分类投影为实时卡片，并在每个分类标题复用开通、取消、隐藏三个真实状态按钮。按钮只批量作用于本分类，经过确认后写入同一共享快照；不得生成第二份分类 DOM 或并行状态模型。", scan: "every-registered-page" },
  { id: "layout-section-editor-capsule", label: "版面风格单栏目胶囊", owner: "shared-visual-contract", expected: "栏目配置、版面风格与客服音效共用单栏目承载语法：每条大卡片只能由一个外层胶囊绘制边框；拖拉／上下移／排号、标题、说明通过统一内边距和间距分清，直接内容承载器及输入框不得再绘制边框或圆角壳。", scan: "every-registered-page" },
  { id: "shared-sortable-ownership", label: "共享排序栏与归属高亮", owner: "shared-visual-contract", expected: "栏目配置分类栏、版面风格与客服音效复用 112×32 拖拉／上下移插件、152×32 含排号工具栏及桌面 50px 外层、6px 内边距、36px 内容的单胶囊。默认按版面色加深 12%，整卡悬停或聚焦加深至 28%；稳定归属键以跨区 8%、分类 10% 联动运营市场和左侧导航，不导航、不滚动、不持久化。", scan: "every-registered-page" },
  { id: "service-expert-capacity", label: "客服专家容量分级", owner: "shared-visual-contract", expected: "选择专家与当前专家头像名片共用内容容器驱动的 auto-fit 轨道：单卡最小可读宽 222px，容器有多少空间就自动填充多少等宽卡片，不设列数上限，空间不足时逐张减少直到单列。当前专家卡使用内容固有高度，不被右侧设置区拉伸；头像始终读取共享启动头像尺寸并保持正方形 cover。小卡片左右边距、头像到左边和两组说明之间均为 8px；选择卡文字使用共享省略规则，完整值保留 title 与当前专家编辑区。", scan: "every-registered-page" },
  { id: "service-expert-content-root", label: "客服专家事实单根", owner: "shared-visual-contract", expected: "当前专家真人朗音自定义是唯一事实源；选择专家、当前专家预览、左栏专家弹窗、换专家和客服聊天只做投影。头像统一按已存素材、内联覆盖、工厂默认、插画回退的优先级解析；摘要固定为左列编号、性别、头衔、动画，右列名称、招呼、提醒、朗音，长文本保留 title 并单行省略。", scan: "every-registered-page" },
  { id: "large-card-typography", label: "大卡片正文", owner: "shared-visual-contract", expected: "名称、状态和链接读取统一字号与字重，不得继承页面私有列表放大值", scan: "every-registered-page" },
  { id: "small-card-typography", label: "小卡片正文", owner: "shared-visual-contract", expected: "小卡片正文读取客户端右侧栏卡片字体颜色、统一 12px 字号和全局字重；状态胶囊仍可保留自身状态色", scan: "every-registered-page" },
  { id: "status-card-source", label: "状态卡片单一来源", owner: "shared-visual-contract", expected: "版面风格左侧预览与运营市场的开通、取消、隐藏状态卡片均读取产品卡片颜色共享源", scan: "every-registered-page" },
  { id: "sidebar-gradient-order", label: "侧栏渐变层次", owner: "shared-visual-contract", expected: "七个工厂版色的侧栏渐变必须严格为起始深色、中间色、结束浅色，三色不可相同", scan: "every-registered-page" },
  { id: "font-choice-selection", label: "全局字体选择态", owner: "shared-visual-contract", expected: "版面风格的字体、字重、字间距选择按钮未选中读取设置区底色文字，选中读取统一功能键底色和文字色", scan: "every-registered-page" },
  { id: "theme-palette-dual-tone", label: "三入口工厂只读版色", owner: "shared-visual-contract", expected: "运营市场主题按钮与已展开主题固定读取各自色板的 primary/onPrimary/border；版面风格七张色卡固定读取 panel/text 并展示 primary/secondary/action。全局样式、草案、悬浮学习和发布同步只可选择色板，不得覆盖预览颜色。", scan: "every-registered-page" },
  { id: "context-markers", label: "六类作用域标注", owner: "shared-visual-contract", expected: "主体、表内、内容、表头、大卡片、尾栏必须可发现；主体在主体外框左侧预留空白槽且不得覆盖标题，表内读取共享左偏移令牌并停靠在表壳空白槽起点，内容在左侧内容起点，大卡片横向居中、读取共享顶部空白带令牌并位于内部粘性标题和插件之上；639px 及以下隐藏非主动常显的主体诊断标注，同一大卡片内的同类小卡片只由第一张显示代表标注，其余实例保留语义和编辑能力但不重复绘制；当前专家真人朗音自定义固定由左侧专家头像预览作为首张代表卡，专家提醒声音固定由左上第一张声音卡作为代表，两者标注都锚定在卡片左上角", scan: "every-registered-page" },
] as const;

export const SHARED_VISUAL_ALLOWED_DIFFERENCES = [
  { id: "content-model", banner: "五列业务表格", operations: "分类卡片网格", reason: "内容结构和业务数据由页面拥有" },
  { id: "item-count", banner: "Banner 记录数量", operations: "产品目录数量", reason: "记录数量不进入共享契约" },
  { id: "header-columns", banner: "功能、排序、名称、语言、链接", operations: "批量状态与目录统计", reason: "表头栏目由页面拥有" },
  { id: "plugin-capabilities", banner: "拖拽、移动、开关、置顶、复制、编辑、删除", operations: "目录卡片允许的真实插件集合", reason: "共享契约统一外观和状态，不改写能力边界" },
  { id: "item-height", banner: "紧凑表格行", operations: "包含说明与状态的卡片", reason: "内容高度由真实业务内容决定" },
] as const;

export const SHARED_VISUAL_REFERENCE_DIFFERENCES = [
  { id: "frame", label: "主体、标题、尾栏", banner: "项目页面框架", operations: "产品市场工作区", classification: "shared", action: "共用共享变量" },
  { id: "table-shell", label: "表内", banner: "table 内容栈", operations: "独立表内壳", classification: "shared", action: "上角直角、底角跟随主体" },
  { id: "scroll", label: "内容滚动", banner: "表格列表所有者", operations: "卡片列表所有者", classification: "shared", action: "唯一滚动源与稳定滚条" },
  { id: "elevation", label: "卡片轻量 3D", banner: "旧白色 inset 高光", operations: "本地 shadow-sm", classification: "defect", action: "统一读取 --tradepro-layout-shadow" },
  { id: "content", label: "内容模型", banner: "业务表格", operations: "卡片网格", classification: "page-owned", action: "保留真实业务差异" },
] as const;

export type SharedVisualParityIssue = {
  factorId: SharedVisualParityFactorId;
  label: string;
  detail: string;
  selector?: string;
};

export type SharedVisualParityReport = {
  checkedAt: string;
  route: string;
  checkedFactors: number;
  issues: readonly SharedVisualParityIssue[];
  passed: boolean;
};

const selectors = {
  workspace: `${EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector}, [data-product-market-workspace], [data-client-project-frame], [data-client-project-shell], [data-page-layout-surface], [data-company-info-navigation-workspace]`,
  title: "[data-product-market-header], [data-page-title], [data-client-project-context], [data-shared-layout-section='title']",
  tableShell: "[data-product-market-table-shell='true'], [data-page-content-stack='table']",
  tableHeader: "[data-product-market-table-header], [data-page-table-header], [data-template-config-service-header]",
  content: "[data-product-market-scroll-list], [data-page-list-scroll-owner], [data-page-list]",
  cards: "[data-product-market-card], [data-page-list-item]",
  plugins: "button[data-content-plugin-control]:not([data-content-plugin-control^='status-'])",
  largeCardText: "[data-shared-large-card-text]",
  largeCardInput: "input[data-layout-large-card-input='true']",
  smallCardText: "[data-shared-small-card-text]",
  themePalette: "[data-shared-theme-palette-key]",
  markers: "[data-development-standard-frame-region]",
} as const;

function isVisibleElement(element: HTMLElement) {
  if (element.closest("[data-development-standard-apply-dialog], [data-visual-page-editor-dock], [data-visual-card-editor-dock]")) return false;
  const style = getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

function visibleElements(root: ParentNode, selector: string) {
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(isVisibleElement);
}

function resolveVisibleTableHeaderEdgeCells(header: HTMLElement) {
  if (header.tagName !== "THEAD") return null;
  const cells = Array.from(header.querySelectorAll<HTMLElement>(":scope > tr > :is(th, td)"))
    .filter((cell) => {
      if (!isVisibleElement(cell)) return false;
      const rect = cell.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  if (cells.length === 0) return null;
  return { first: cells[0], last: cells[cells.length - 1] };
}

function normalizeCss(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function cssPixelsMatch(value: string, expected: number, tolerance = 0.75) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && Math.abs(parsed - expected) <= tolerance;
}

function resolveSharedCssValue(documentRoot: Document, property: "backgroundColor" | "borderColor" | "boxShadow" | "borderRadius" | "color" | "fontFamily" | "fontSize" | "fontWeight" | "height", value: string) {
  const probe = documentRoot.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "position:fixed;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none";
  probe.style[property] = value;
  documentRoot.body.appendChild(probe);
  const resolved = getComputedStyle(probe)[property];
  probe.remove();
  return resolved;
}

function resolveScopedCssValue(scope: HTMLElement, property: "backgroundColor" | "borderColor" | "color", value: string) {
  const probe = scope.ownerDocument.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "position:fixed;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none";
  probe.style[property] = value;
  scope.appendChild(probe);
  const resolved = getComputedStyle(probe)[property];
  probe.remove();
  return resolved;
}

function addIssue(issues: SharedVisualParityIssue[], factorId: SharedVisualParityFactorId, detail: string, selector?: string) {
  const factor = SHARED_VISUAL_PARITY_FACTORS.find((item) => item.id === factorId)!;
  issues.push({ factorId, label: factor.label, detail, selector });
}

/** Runtime scanner used by the quality center for every registered page. */
export function inspectSharedVisualParity(root: ParentNode = document): SharedVisualParityReport {
  const documentRoot = root instanceof Document ? root : root.ownerDocument || document;
  const html = documentRoot.documentElement;
  const issues: SharedVisualParityIssue[] = [];
  const route = `${documentRoot.location?.pathname || ""}${documentRoot.location?.search || ""}`;
  const expectedWindowBackground = normalizeCss(resolveSharedCssValue(documentRoot, "backgroundColor", "var(--tradepro-panel-bg, #ffffff)"));
  const expectedWindowColor = normalizeCss(resolveSharedCssValue(documentRoot, "color", "var(--tradepro-panel-text, #0f172a)"));
  const expectedWindowFont = normalizeCss(resolveSharedCssValue(documentRoot, "fontFamily", "var(--tradepro-global-font-family, system-ui, sans-serif)"));
  const expectedEditorControlBackground = normalizeCss(resolveSharedCssValue(documentRoot, "backgroundColor", "var(--tradepro-panel-card-bg, var(--tradepro-panel-bg, #ffffff))"));
  const expectedEditorControlColor = normalizeCss(resolveSharedCssValue(documentRoot, "color", "var(--tradepro-panel-card-text, var(--tradepro-panel-text, #0f172a))"));
  const sharedWindowCandidates = visibleElements(root, ":is([role='dialog'], [role='alertdialog'], [aria-modal='true'], [data-shared-window-contract][data-shared-window-region='frame'])");
  for (const sharedWindow of sharedWindowCandidates) {
    if (sharedWindow.dataset.sharedWindowRegion !== "frame") {
      addIssue(issues, "shared-gates", "Visible dialog is not registered as a shared window frame.", "[role='dialog'], [role='alertdialog'], [aria-modal='true']");
      break;
    }
    if (sharedWindow.dataset.sharedWindowContract !== SHARED_WINDOW_CONTRACT_VERSION) {
      addIssue(issues, "shared-gates", "Shared window is using a stale contract version.", "[data-shared-window-contract]");
      break;
    }
    if (sharedWindow.dataset.sharedWindowFactoryDefault !== SHARED_WINDOW_FACTORY_DEFAULT.id) {
      addIssue(issues, "shared-gates", "Shared window is not bound to the factory default.", "[data-shared-window-region='frame']");
      break;
    }
    const projection = sharedWindow.dataset.sharedWindowThemeProjection;
    if (!SHARED_WINDOW_THEME_PROJECTIONS.some((candidate) => candidate === projection)) {
      addIssue(issues, "shared-gates", "Shared window is missing a registered theme projection.", "[data-shared-window-theme-projection]");
      break;
    }
    const registryId = sharedWindow.dataset.sharedDialogContract;
    if (!registryId || !isSharedWindowRegistryBindingValid(registryId, sharedWindow.dataset.sharedWindowKind)) {
      addIssue(issues, "shared-gates", "Shared window registry id and kind do not match the central contract.", "[data-shared-dialog-contract]");
      break;
    }
    const ownedSharedCloseControls = Array.from(sharedWindow.querySelectorAll<HTMLElement>(
      '[data-shared-window-close="true"][data-dialog-close][data-content-plugin-control="close"]',
    )).filter((control) => control.closest<HTMLElement>('[data-shared-window-region="frame"]') === sharedWindow);
    if (sharedWindow.dataset.sharedWindowKind !== "loading" && ownedSharedCloseControls.length !== 1) {
      addIssue(issues, "shared-gates", "Shared window must own exactly one top-right shared close plugin.", "[data-shared-window-close='true']");
      break;
    }
    const allowedRegionIds = new Set<string>(["frame", "resize", ...SHARED_WINDOW_REGION_IDS]);
    const invalidRegion = Array.from(sharedWindow.querySelectorAll<HTMLElement>("[data-shared-window-region]"))
      .find((region) => !allowedRegionIds.has(region.dataset.sharedWindowRegion || ""));
    if (invalidRegion) {
      addIssue(issues, "shared-gates", `Shared window uses an unregistered region: ${invalidRegion.dataset.sharedWindowRegion || "missing"}.`, "[data-shared-window-region]");
      break;
    }
    const style = getComputedStyle(sharedWindow);
    if (
      normalizeCss(style.backgroundColor) !== expectedWindowBackground
      || normalizeCss(style.color) !== expectedWindowColor
      || normalizeCss(style.fontFamily) !== expectedWindowFont
    ) {
      addIssue(issues, "shared-gates", "Shared window does not read the active page background, text or font tokens.", "[data-shared-window-theme-projection='active-page']");
      break;
    }
    if (registryId === "generic-editor") {
      const neutralCopy = visibleElements(sharedWindow, 'label, legend, p[class*="text-slate-"], span[class*="text-slate-"], p[class*="text-gray-"], span[class*="text-gray-"]')
        .filter((element) => !element.closest('[data-shared-window-region="title"], [data-shared-window-region="footer"]'));
      if (neutralCopy.some((element) => normalizeCss(getComputedStyle(element).color) !== expectedWindowColor)) {
        addIssue(issues, "shared-gates", "Generic editor neutral copy does not read the active page text token.", '[data-shared-dialog-contract="generic-editor"] label');
        break;
      }
      const formControls = visibleElements(sharedWindow, "input, textarea, select");
      if (formControls.some((element) => {
        const controlStyle = getComputedStyle(element);
        return normalizeCss(controlStyle.backgroundColor) !== expectedEditorControlBackground
          || normalizeCss(controlStyle.color) !== expectedEditorControlColor
          || normalizeCss(controlStyle.fontFamily) !== expectedWindowFont;
      })) {
        addIssue(issues, "shared-gates", "Generic editor form controls do not read the active page card background, text or font tokens.", '[data-shared-dialog-contract="generic-editor"] input');
        break;
      }
    }
  }
  for (const selectionControl of visibleElements(root, '[data-shared-selection-control="true"]')) {
    if (!hasSharedSelectionSurfaceStateParity(selectionControl)) {
      addIssue(issues, "shared-gates", "Shared selection control does not synchronize data-selected with aria-pressed.", '[data-shared-selection-control="true"]');
      break;
    }
  }
  for (const expertDialog of visibleElements(root, "[data-shared-sidebar-expert-dialog='true']")) {
    if (expertDialog.dataset.sharedExpertPopupResponsive !== "true") {
      addIssue(issues, "small-card-typography", "Sidebar expert dialog is missing the shared responsive expert-popup contract.", "[data-shared-sidebar-expert-dialog]");
      break;
    }
    if (!getComputedStyle(expertDialog).containerType.includes("inline-size")) {
      addIssue(issues, "plugin-geometry", "Sidebar expert dialog lacks the shared inline-size container, so its avatar cannot scale with the window.", "[data-shared-sidebar-expert-dialog]");
      break;
    }
    const requiredRegions = ["small-card"];
    if (requiredRegions.some((region) => !expertDialog.querySelector(`[data-development-standard-frame-region='${region}']`))) {
      addIssue(issues, "context-markers", "Sidebar expert dialog is missing its shared expert identity marker.", "[data-shared-sidebar-expert-dialog]");
      break;
    }
    if (!expertDialog.querySelector('[data-content-plugin-control="close"]')) {
      addIssue(issues, "plugin-geometry", "Sidebar expert dialog close action does not use the registered shared close plugin.", "[data-shared-sidebar-expert-dialog]");
      break;
    }
    if (!expertDialog.querySelector('[data-shared-expert-identity-summary="editor"]')) {
      addIssue(issues, "small-card-typography", "Sidebar expert popup is not using the Current Expert shared 4+4 identity editor summary.", "[data-shared-sidebar-expert-dialog]");
      break;
    }
  }
  for (const resizableDialog of visibleElements(root, "[data-shared-resizable-window-contract='true'][role='dialog']")) {
    if (resizableDialog.dataset.sharedResizeBehavior !== SHARED_CENTER_SYMMETRIC_RESIZE_CONTRACT) {
      addIssue(issues, "plugin-geometry", "Resizable dialog does not declare the shared centre-symmetric four-side resize behaviour.", "[data-shared-resizable-window-contract]");
      break;
    }
    if (!resizableDialog.querySelector("[data-shared-resize-handle='true']")) {
      addIssue(issues, "plugin-geometry", "Resizable dialog is missing the shared lower-right resize handle.", "[data-shared-resizable-window-contract]");
      break;
    }
    if (resizableDialog.querySelectorAll("[data-window-resize-edge]").length < 7) {
      addIssue(issues, "plugin-geometry", "Resizable dialog is missing one or more shared four-side resize targets.", "[data-shared-resizable-window-contract]");
      break;
    }
    if (resizableDialog.querySelector("[data-shared-dialog-contract='material-picker']") || resizableDialog.dataset.sharedDialogContract === "material-picker") {
      if (!resizableDialog.querySelector("[data-content-plugin-control='close']")) {
        addIssue(issues, "plugin-geometry", "Material picker is missing the registered shared close plugin.", "[data-shared-dialog-contract='material-picker']");
        break;
      }
    }
  }
  const floatingServiceWindows = visibleElements(root, "[data-shared-floating-service-window='true']");
  for (const floatingWindow of floatingServiceWindows) {
    const expectedInset = window.innerWidth <= 520 ? 64 : 72;
    const style = getComputedStyle(floatingWindow);
    if (Number.parseFloat(style.right) + 0.5 < expectedInset) {
      addIssue(issues, "floating-service-safe-inset", "Floating expert avatar or chat window is missing the right scrollbar safety inset.", "[data-shared-floating-service-window]");
      break;
    }
    const expectedBottom = RESPONSIVE_SHELL_FACTORY_DEFAULT.floatingService.minimumFooterSafeBottom;
    const floatingRect = floatingWindow.getBoundingClientRect();
    const overlapsFooter = visibleElements(root, "[data-page-layout-footer]").some((footer) => {
      const footerRect = footer.getBoundingClientRect();
      return floatingRect.left < footerRect.right
        && floatingRect.right > footerRect.left
        && floatingRect.top < footerRect.bottom
        && floatingRect.bottom > footerRect.top;
    });
    if (Number.parseFloat(style.bottom) + 0.5 < expectedBottom || overlapsFooter) {
      addIssue(issues, "floating-service-safe-inset", "Floating expert avatar or chat window overlaps the protected shared footer safe area.", "[data-shared-floating-service-window]");
      break;
    }
    if (!floatingWindow.querySelector("[data-shared-resize-handle='true']") || floatingWindow.querySelectorAll("[data-window-resize-edge]").length < 7) {
      addIssue(issues, "plugin-geometry", "Floating expert chat does not use the shared four-side resize window contract.", "[data-shared-floating-service-window]");
      break;
    }
    if (!floatingWindow.querySelector("[data-shared-window-close='true'][data-dialog-close]")) {
      addIssue(issues, "plugin-geometry", "Floating expert chat close action does not use the Client Source shared window-close plugin contract.", "[data-shared-floating-service-window]");
      break;
    }
    if (floatingWindow.dataset.sharedResizableWindowContract === "true" && floatingWindow.dataset.sharedResizeBehavior !== SHARED_CENTER_SYMMETRIC_RESIZE_CONTRACT) {
      addIssue(issues, "plugin-geometry", "Floating expert chat does not declare the shared centre-symmetric four-side resize behaviour.", "[data-shared-floating-service-window]");
      break;
    }
  }

  if (PRODUCT_MARKET_THEME_PALETTES.some((palette) => !isProductMarketSidebarGradientDeepToLight(buildProductMarketSidebarGradient(palette)))) {
    addIssue(issues, "sidebar-gradient-order", "七色工厂版色中存在侧栏渐变首尾相同或未按深→中→浅递进的组合。", "buildProductMarketSidebarGradient");
  }

  const globalFontSettings = root.querySelector<HTMLElement>(".layout-global-font-settings");
  if (globalFontSettings) {
    const selectedBackground = normalizeCss(resolveScopedCssValue(globalFontSettings, "backgroundColor", "var(--pm-layout-font-choice-selected-bg)"));
    const selectedText = normalizeCss(resolveScopedCssValue(globalFontSettings, "color", "var(--pm-layout-font-choice-selected-text)"));
    const fontChoices = visibleElements(globalFontSettings, "button[data-layout-global-font-choice]");
    const selectedChoices = fontChoices.filter((choice) => choice.dataset.layoutGlobalFontSelected === "true");
    if (
      selectedChoices.length !== 3
      || selectedChoices.some((choice) => {
        const style = getComputedStyle(choice);
        return choice.dataset.sharedSelectionControl !== "true"
          || choice.dataset.selected !== choice.dataset.layoutGlobalFontSelected
          || choice.getAttribute("aria-pressed") !== choice.dataset.selected
          || normalizeCss(style.backgroundColor) !== selectedBackground
          || normalizeCss(style.color) !== selectedText;
      })
    ) {
      addIssue(issues, "font-choice-selection", "全局字体的已选按钮没有读取统一功能键底色或文字色。", "button[data-layout-global-font-choice]");
    }
  }

  if (html.dataset.tradeproPageLayout !== "active" || html.dataset.tradeproPageSharedVariables !== "true" || html.dataset.visualResponsiveContract !== "true") {
    addIssue(issues, "shared-gates", "页面未同时启用共享变量、页面框架与三端响应式契约。", "html");
  }

  if (html.dataset.responsiveShellContract !== RESPONSIVE_SHELL_FACTORY_DEFAULT.version) {
    addIssue(issues, "responsive-navigation-continuity", "页面没有读取当前三端响应式工厂契约。", "html");
  }

  if (html.dataset.responsiveSidebarNavigationPolicy !== RESPONSIVE_SHELL_FACTORY_DEFAULT.sidebarNavigation.strategy) {
    addIssue(issues, "responsive-sidebar-route-disclosure", "页面没有读取三端活动项目单分支展开策略。", "html[data-responsive-sidebar-navigation-policy]");
  }
  const visibleSidebar = visibleElements(root, "[data-shared-sidebar-disclosure-contract]")[0];
  if (visibleSidebar
    && visibleSidebar.dataset.sharedSidebarDisclosureContract !== RESPONSIVE_SHELL_FACTORY_DEFAULT.sidebarNavigation.strategy) {
    addIssue(issues, "responsive-sidebar-route-disclosure", "当前可见侧栏没有登记路由拥有的单分支契约。", "[data-shared-sidebar-disclosure-contract]");
  }

  const responsivePageHost = visibleElements(root, "[data-responsive-page-host]")[0];
  if (
    html.dataset.globalResponsivePageContract !== GLOBAL_RESPONSIVE_PAGE_FACTORY_DEFAULT.version
    || html.dataset.responsivePageHostPolicy !== GLOBAL_RESPONSIVE_PAGE_FACTORY_DEFAULT.strategy
    || !responsivePageHost
    || responsivePageHost.dataset.responsiveCapacityLayout !== RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.plugin
    || html.dataset.responsiveCapacityLayoutPolicy !== RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.strategy
    || !GLOBAL_RESPONSIVE_PAGE_TEMPLATE_IDS.includes(responsivePageHost.dataset.responsivePageTemplate as typeof GLOBAL_RESPONSIVE_PAGE_TEMPLATE_IDS[number])
  ) {
    addIssue(issues, "responsive-global-page-host", "当前页面没有接入全局容器优先响应宿主，或页面模板未登记。", "[data-responsive-page-host]");
  } else if (responsivePageHost.scrollWidth > responsivePageHost.clientWidth + 1) {
    addIssue(issues, "responsive-global-page-host", "当前普通页面内容突破了全局页面宿主的横向边界。", "[data-responsive-page-host]");
  }

  const openLiveSurfaces = visibleElements(root, "[data-responsive-live-surface-open='true']");
  const visibleTitleOneSurfaces = Array.from(new Set([
    ...visibleElements(responsivePageHost || root, "[data-responsive-shared-surface='title-1']"),
    ...visibleElements(responsivePageHost || root, "[data-responsive-semantic-band='page-context'], [data-responsive-semantic-band='title-1']"),
    ...visibleElements(responsivePageHost || root, "[data-page-factory-region='title-1']"),
    ...visibleElements(responsivePageHost || root, "[data-client-project-context][data-page-title]"),
  ])).filter((surface) => {
    const rect = surface.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  if (html.dataset.sharedAdaptiveSurfaceContract !== SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.version
    || html.dataset.sharedAdaptiveSurfaceStrategy !== SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.strategy
    || openLiveSurfaces.length > 1
    || openLiveSurfaces.some((surface) => surface.dataset.responsiveLiveSurfaceSource !== SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.sourceViewport)) {
    addIssue(issues, "responsive-shared-live-surfaces", "当前页面未按大屏唯一真实表面契约运行，或同时显示了多份业务表面。", "[data-responsive-live-surface]");
  }
  if (visibleTitleOneSurfaces.length > 1) {
    addIssue(
      issues,
      "responsive-shared-live-surfaces",
      "当前页面同时显示了多份标题1；页面自有标题1存在时不得再生成工作台补位标题。",
      "[data-responsive-shared-surface='title-1'], [data-page-factory-region='title-1']",
    );
  }

  const capacityLayouts = visibleElements(responsivePageHost || root, "[data-responsive-capacity-row], [data-responsive-capacity-grid]");
  if (capacityLayouts.some((layout) => layout.scrollWidth > layout.clientWidth + 1)) {
    addIssue(issues, "responsive-global-page-host", "共享容量布局出现横向溢出。", "[data-responsive-capacity-row], [data-responsive-capacity-grid]");
  }

  if (html.dataset.responsiveTopbarDisclosurePolicy !== RESPONSIVE_SHELL_FACTORY_DEFAULT.topbarDisclosure.strategy) {
    addIssue(issues, "responsive-topbar-integrity", "页面没有读取当前顶部工具悬浮策略。", "html[data-responsive-topbar-disclosure-policy]");
  }

  if (html.dataset.responsivePageToolsPolicy !== RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.strategy) {
    addIssue(issues, "responsive-page-tools-integrity", "页面没有读取当前极限屏独立工具栏策略。", "html[data-responsive-page-tools-policy]");
  }

  if (html.dataset.responsiveThemePalettePolicy !== RESPONSIVE_SHELL_FACTORY_DEFAULT.themePalette.strategy) {
    addIssue(issues, "theme-palette-dual-tone", "页面没有读取当前标题2与版面色卡双层版色策略。", "html[data-responsive-theme-palette-policy]");
  }

  if (html.dataset.responsivePageToolsCapacityPolicy !== RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.capacityPolicy) {
    addIssue(issues, "responsive-page-tools-integrity", "页面没有读取优先全部显示、实测拥挤后才收纳的容量策略。", "html[data-responsive-page-tools-capacity-policy]");
  }

  if (html.dataset.responsiveToolbarOrderPolicy !== RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.triggerOrder.join(">")) {
    addIssue(issues, "responsive-page-tools-integrity", "页面没有读取当前独立工具业务顺序。", "html[data-responsive-toolbar-order-policy]");
  }

  if (html.dataset.responsiveFunctionKeyPolicy !== RESPONSIVE_SHELL_FACTORY_DEFAULT.functionKeys.strategy) {
    addIssue(issues, "responsive-function-key-consistency", "页面没有读取共享功能键高度策略。", "html[data-responsive-function-key-policy]");
  }

  if (html.dataset.responsiveSharedSurfacePolicy !== RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedSurfaces.strategy
    || html.dataset.responsiveSharedActionPolicy !== RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedActions.strategy
    || html.dataset.responsiveSharedInteractionPolicy !== RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedInteractions.strategy) {
    addIssue(issues, "responsive-page-tools-integrity", "页面没有读取大屏与小屏同源的表面、动作和交互插件策略。", "html[data-responsive-shared-surface-policy]");
  }

  if (html.dataset.responsiveVisualLauncherPolicy !== RESPONSIVE_SHELL_FACTORY_DEFAULT.visualLauncher.strategy) {
    addIssue(issues, "responsive-visual-launcher-safety", "页面没有读取当前可视化入口安全停靠策略。", "html[data-responsive-visual-launcher-policy]");
  }

  if (html.dataset.responsiveVisualLauncherDefaultDock !== RESPONSIVE_SHELL_FACTORY_DEFAULT.visualLauncher.defaultDock
    || html.dataset.responsiveFooterActionOrder !== RESPONSIVE_SHELL_FACTORY_DEFAULT.footerActions.order.join(">")) {
    addIssue(issues, "responsive-visual-launcher-safety", "页面没有读取可视化入口位于尾栏保存前的工厂顺序。", "html[data-responsive-visual-launcher-default-dock]");
  }

  if (html.dataset.responsiveFooterLabelPolicy !== RESPONSIVE_SHELL_FACTORY_DEFAULT.footerActions.labelPolicy) {
    addIssue(issues, "responsive-footer-capacity", "页面没有读取尾栏实测容量后才收起文字的策略。", "html[data-responsive-footer-label-policy]");
  }

  if (html.dataset.visualResponsiveStage !== resolveResponsiveShellStage(window.innerWidth)) {
    addIssue(issues, "responsive-priority-ladder", "页面当前压力阶段与共享工厂的缩放、精简、换行、收纳顺序不一致。", "html[data-visual-responsive-stage]");
  }

  const expectedVerticalStage = resolveResponsiveVerticalStage(window.innerHeight);
  if (html.dataset.visualResponsiveVerticalStage !== expectedVerticalStage) {
    addIssue(issues, "responsive-vertical-budget", "页面当前纵向压力阶段与共享工厂的高度顺序不一致。", "html[data-visual-responsive-vertical-stage]");
  }

  if (expectedVerticalStage !== "comfortable") {
    const viewportHeight = Math.max(RESPONSIVE_SHELL_FACTORY_DEFAULT.minimumSupportedHeight, window.innerHeight);
    const responsiveShell = visibleElements(root, "[data-responsive-shell]")[0];
    const workspace = visibleElements(responsiveShell || root, selectors.workspace)[0];
    const topbar = visibleElements(responsiveShell || root, "[data-responsive-topbar]")[0];
    const titleBand = visibleElements(workspace || responsiveShell || root, "[data-product-market-header], [data-page-title], [data-shared-layout-section='title']")[0];
    const secondaryTitleBand = visibleElements(workspace || responsiveShell || root, "[data-product-market-theme-section]")[0];
    const tableHeaderBand = visibleElements(workspace || responsiveShell || root, selectors.tableHeader)[0];
    const chromeBands = new Set([topbar, titleBand, secondaryTitleBand, tableHeaderBand].filter((band): band is HTMLElement => Boolean(band)));
    const chromeRatio = Array.from(chromeBands).reduce((total, band) => total + band.getBoundingClientRect().height, 0) / viewportHeight;
    if (chromeRatio > RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBudget.maximumChromeRatio + 0.01) {
      addIssue(issues, "responsive-vertical-budget", `顶部与标题层占用 ${(chromeRatio * 100).toFixed(0)}%，超过短屏工厂预算。`, "[data-responsive-topbar], [data-shared-layout-section='title'], [data-page-table-header]");
    }
    const contentOwner = visibleElements(workspace || responsiveShell || root, "[data-page-list-scroll-owner], [data-product-market-scroll-list]")[0];
    if (contentOwner) {
      const contentRatio = contentOwner.getBoundingClientRect().height / viewportHeight;
      const minimumRatio = expectedVerticalStage === "minimal"
        ? (html.dataset.responsiveVerticalFocus === "true"
            ? RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBudget.minimalFocusedContentRatio
            : RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBudget.minimalContentRatio)
        : (html.dataset.responsiveVerticalFocus === "true"
            ? RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBudget.focusedContentRatio
            : RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBudget.minimumContentRatio);
      if (contentRatio + 0.01 < minimumRatio) {
        addIssue(issues, "responsive-vertical-budget", `内容区仅占 ${(contentRatio * 100).toFixed(0)}%，低于当前纵向阶段预算。`, "[data-page-list-scroll-owner]");
      }
    }
    const persistentBands = [titleBand, secondaryTitleBand, tableHeaderBand].filter((band): band is HTMLElement => Boolean(band)).filter((band) => {
      const position = getComputedStyle(band).position;
      return position === "sticky" || position === "fixed";
    });
    if (persistentBands.length > 1) {
      addIssue(issues, "responsive-vertical-budget", "短屏存在多个固定标题层；滚动专注只允许一个表头保持可见。", selectors.tableHeader);
    }
  }

  if (!html.dataset.responsiveLearningStatus) {
    addIssue(issues, "responsive-learning-governance", "页面没有登记响应式运行时学习状态。", "html[data-responsive-learning-status]");
  }

  try {
    const snapshot = JSON.parse(window.localStorage.getItem(RESPONSIVE_SHELL_FACTORY_DEFAULT.learning.factorySnapshotKey) || "null") as {
      contract?: { version?: string };
      pageContract?: { version?: string };
      structureContract?: { version?: string };
      surfaceContract?: { version?: string };
    } | null;
    if (snapshot?.contract?.version !== RESPONSIVE_SHELL_FACTORY_DEFAULT.version
      || snapshot?.pageContract?.version !== GLOBAL_RESPONSIVE_PAGE_FACTORY_DEFAULT.version
      || snapshot?.structureContract?.version !== ADAPTIVE_STRUCTURE_FACTORY_DEFAULT.version
      || snapshot?.surfaceContract?.version !== SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.version) {
      addIssue(issues, "responsive-learning-governance", "恢复工厂快照没有保存当前响应式契约版本。", "html[data-responsive-shell-contract]");
    }
  } catch {
    addIssue(issues, "responsive-learning-governance", "恢复工厂快照无法读取。", "html[data-responsive-shell-contract]");
  }

  for (const shell of Array.from(root.querySelectorAll<HTMLElement>("[data-responsive-shell]"))) {
    const desktopNav = shell.querySelector<HTMLElement>("[data-responsive-desktop-nav]");
    const triggers = Array.from(shell.querySelectorAll<HTMLElement>("[data-responsive-nav-trigger], [data-responsive-page-tools-nav]"));
    if (!desktopNav || !triggers.length) {
      addIssue(issues, "responsive-navigation-continuity", "三端壳层缺少固定导航或抽屉导航入口登记。", "[data-responsive-shell]");
      break;
    }
    if (window.innerWidth <= RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.drawerMax
      && getComputedStyle(desktopNav).display === "none"
      && !triggers.some((trigger) => getComputedStyle(trigger).display !== "none" && trigger.getBoundingClientRect().width > 0)) {
      addIssue(issues, "responsive-navigation-continuity", "当前窄屏已隐藏固定左栏，但抽屉导航入口也不可见。", "[data-responsive-nav-trigger]");
      break;
    }
  }

  for (const topbar of Array.from(root.querySelectorAll<HTMLElement>("[data-responsive-topbar]"))) {
    const priorities = new Set(Array.from(topbar.querySelectorAll<HTMLElement>("[data-responsive-priority]")).map((element) => element.dataset.responsivePriority));
    if (!priorities.has("p0") || !priorities.has("p1")) {
      addIssue(issues, "responsive-priority-ladder", "三端顶部没有完整登记 P0 主操作和 P1 次要操作优先级。", "[data-responsive-topbar]");
      break;
    }
    const orderedActions = topbar.querySelector<HTMLElement>("[data-source-topbar-actions]");
    if (orderedActions?.dataset.responsiveSequence !== "business-order") {
      addIssue(issues, "responsive-priority-ladder", "顶部操作没有声明业务顺序与键盘顺序共享。", "[data-source-topbar-actions]");
      break;
    }
    const topbarRect = topbar.getBoundingClientRect();
    const expandedContent = topbar.querySelector<HTMLElement>(".client-source-topbar-content.is-expanded");
    const contentRect = expandedContent?.getBoundingClientRect();
    if (expandedContent && contentRect) {
      const isPopover = expandedContent.matches("[data-responsive-topbar-popover='anchored']");
      if (isPopover) {
        const style = getComputedStyle(expandedContent);
        const rootStyle = getComputedStyle(html);
        const expectedChromeHeight = Number.parseFloat(rootStyle.getPropertyValue("--responsive-vertical-topbar-height"));
        const trigger = topbar.querySelector<HTMLElement>("[data-responsive-topbar-toggle]");
        const controlsTarget = trigger?.getAttribute("aria-controls");
        const isControlled = Boolean(controlsTarget && expandedContent.id === controlsTarget && trigger?.getAttribute("aria-expanded") === "true");
        const chromeHeightMatches = !Number.isFinite(expectedChromeHeight) || Math.abs(topbarRect.height - expectedChromeHeight) <= 1;
        const isAnchored = style.position === "absolute" && contentRect.top >= topbarRect.bottom - 1;
        const isViewportContained = contentRect.left >= -1
          && contentRect.right <= window.innerWidth + 1
          && contentRect.bottom <= window.innerHeight + 1;
        const ownsOverflow = expandedContent.scrollHeight <= expandedContent.clientHeight + 1 || ["auto", "scroll"].includes(style.overflowY);
        if (!isControlled || !chromeHeightMatches || !isAnchored || !isViewportContained || !ownsOverflow) {
          addIssue(issues, "responsive-topbar-integrity", "窄屏顶部工具没有形成受控、定高且位于视口内的锚定悬浮面板。", "[data-responsive-topbar-popover]");
          break;
        }
      } else if (contentRect.bottom > topbarRect.bottom + 1) {
        addIssue(issues, "responsive-topbar-integrity", "窄屏已展开顶部工具，但既没有撑开顶部，也没有登记为安全悬浮面板。", "[data-responsive-topbar]");
        break;
      }
    }
    const pageToolsPressureActive = window.innerWidth <= RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.activationMax
      || window.innerHeight <= RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBreakpoints.focusMax;
    if (window.innerWidth <= RESPONSIVE_SHELL_FACTORY_DEFAULT.breakpoints.drawerMax) {
      const sourceActions = topbar.querySelector<HTMLElement>("[data-source-topbar-actions]");
      if (sourceActions && !pageToolsPressureActive) {
        const actionStyle = getComputedStyle(sourceActions);
        if (actionStyle.display !== "flex" || actionStyle.flexWrap === "nowrap") {
          addIssue(issues, "responsive-topbar-integrity", "窄屏顶部工具没有按业务顺序连续换行，控件会被拆散到左右两侧。", "[data-source-topbar-actions]");
          break;
        }
      }
      const visualLauncher = document.querySelector<HTMLElement>("[data-responsive-visual-launcher]");
      const trigger = visibleElements(topbar, "[data-responsive-toolbar-trigger], [data-responsive-topbar-toggle]")[0];
      if (visualLauncher && trigger) {
        const launcherRect = visualLauncher.getBoundingClientRect();
        const triggerRect = trigger.getBoundingClientRect();
        if (launcherRect.top < triggerRect.bottom && launcherRect.bottom > triggerRect.top && launcherRect.left < triggerRect.right && launcherRect.right > triggerRect.left) {
          addIssue(issues, "responsive-topbar-integrity", "固定可视化入口覆盖了窄屏顶部工具栏的可点击区域。", "[data-responsive-topbar-toggle]");
          break;
        }
      }
    }
  }

  const pageToolsPressureActive = window.innerWidth <= RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.activationMax
    || window.innerHeight <= RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalBreakpoints.focusMax;
  const pageToolsAdapter = root.querySelector<HTMLElement>("[data-responsive-semantic-tools][data-responsive-single-live-source='true']");
  if (root.querySelector("[data-responsive-page-tools-projection], [data-responsive-page-tools-section]")) {
    addIssue(issues, "responsive-page-tools-integrity", "页面仍挂载了重复的小屏投影，而不是大屏唯一真实表面。", "[data-responsive-page-tools-projection]");
  }
  for (const compactBatchControl of Array.from(root.querySelectorAll<HTMLElement>("[data-responsive-live-surface-open='true'] [data-responsive-batch-action-parity='large-table-header']:not(:disabled)"))) {
    const style = getComputedStyle(compactBatchControl);
    if (style.backgroundColor !== compactBatchControl.style.backgroundColor
      || style.color !== compactBatchControl.style.color
      || Math.abs(compactBatchControl.getBoundingClientRect().height - 32) > 1
      || Number.parseFloat(style.fontSize) !== 12
      || style.fontWeight !== "600") {
      addIssue(issues, "responsive-page-tools-integrity", "小屏表头批量按键没有保持大屏状态颜色和操作尺寸。", "[data-responsive-batch-action-parity='large-table-header']");
      break;
    }
  }
  for (const surface of visibleElements(document, "[data-responsive-shared-surface]")) {
    const identity = surface.dataset.responsiveSharedSurface;
    const style = getComputedStyle(surface);
    const radius = (value: string) => Number.parseFloat(value) || 0;
    const pluginMatches = surface.dataset.responsiveSharedSurfacePlugin === RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedSurfaces.plugin;
    const tableHeaderEdges = identity === "table-header" ? resolveVisibleTableHeaderEdgeCells(surface) : null;
    const geometryMatches = identity === "title-1"
      ? radius(style.borderTopLeftRadius) > 1 && radius(style.borderTopRightRadius) > 1 && radius(style.borderBottomLeftRadius) <= 1 && radius(style.borderBottomRightRadius) <= 1
      : identity === "top" || identity === "title-2"
        ? [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomLeftRadius, style.borderBottomRightRadius].every((value) => radius(value) <= 1)
        : identity === "table-header"
          ? tableHeaderEdges
            ? radius(getComputedStyle(tableHeaderEdges.first).borderTopLeftRadius) > 1
              && radius(getComputedStyle(tableHeaderEdges.first).borderBottomLeftRadius) > 1
              && radius(getComputedStyle(tableHeaderEdges.last).borderTopRightRadius) > 1
              && radius(getComputedStyle(tableHeaderEdges.last).borderBottomRightRadius) > 1
            : surface.tagName === "THEAD"
              ? false
              : radius(style.borderTopLeftRadius) > 1 && radius(style.borderBottomLeftRadius) > 1
          : false;
    if (!pluginMatches || !geometryMatches) {
      addIssue(issues, "responsive-page-tools-integrity", "顶部、标题1、标题2或表头没有复用同一个大屏表面插件。", "[data-responsive-shared-surface]");
      break;
    }
  }
  for (const action of visibleElements(document, "[data-responsive-shared-action]")) {
    const rect = action.getBoundingClientRect();
    const icon = action.querySelector<HTMLElement>("svg");
    if (action.dataset.responsiveSharedActionPlugin !== RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedActions.plugin
      || Math.abs(rect.height - RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedActions.height) > 1
      || Boolean(icon && Math.abs(icon.getBoundingClientRect().width - RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedActions.iconSize) > 1)
      || Math.abs((Number.parseFloat(getComputedStyle(action).columnGap) || 0) - RESPONSIVE_SHELL_FACTORY_DEFAULT.sharedActions.contentGap) > 0.75) {
      addIssue(issues, "responsive-page-tools-integrity", "功能按键没有复用统一的大屏动作高度和图标插件。", "[data-responsive-shared-action]");
      break;
    }
  }
  if (pageToolsPressureActive && pageToolsAdapter) {
    const independentTools = visibleElements(root, "[data-responsive-independent-tools]")[0];
    const toolsOverflowed = independentTools?.dataset.responsiveToolsOverflowed === "true";
    const availableSections = new Set(Array.from(root.querySelectorAll<HTMLElement>("[data-responsive-semantic-band-active]"))
      .map((band) => band.dataset.responsiveSemanticBandActive || ""));
    const expectedOrder = toolsOverflowed
      ? RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.alwaysVisibleAtOverflow.filter((id) =>
        id !== "visual" && (id === "navigation" || id === "client-tools" || id === "overflow" || availableSections.has(id))
      )
      : RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.triggerOrder.filter((id) => id === "navigation" || id === "client-tools" || availableSections.has(id));
    const actualOrder = visibleElements(root, "[data-responsive-toolbar-trigger]:not([data-responsive-toolbar-trigger='visual'])")
      .map((trigger) => trigger.dataset.responsiveToolbarTrigger || "");
    if (!independentTools || !expectedOrder.every((id, index) => actualOrder[index] === id)) {
      addIssue(issues, "responsive-page-tools-integrity", "极限屏独立工具入口缺失或没有按左栏、顶部、标题1、标题2、表头的业务顺序排列。", "[data-responsive-independent-tools]");
    }
    if (independentTools) {
      const labelMode = independentTools.dataset.responsiveToolsLabelMode;
      const available = Number.parseFloat(independentTools.dataset.responsiveToolsAvailableWidth || "");
      const labelledRequired = Number.parseFloat(independentTools.dataset.responsiveToolsLabelledRequiredWidth || "");
      const iconRequired = Number.parseFloat(independentTools.dataset.responsiveToolsIconRequiredWidth || "");
      const directLabels = Array.from(independentTools.querySelectorAll<HTMLElement>(
        "[data-responsive-toolbar-trigger]:not([data-responsive-toolbar-trigger='overflow']) [data-responsive-tool-label]",
      ));
      const allLabelsVisible = directLabels.length > 0 && directLabels.every((label) => getComputedStyle(label).display !== "none");
      const allLabelsHidden = directLabels.length > 0 && directLabels.every((label) => getComputedStyle(label).display === "none");
      const overflowTrigger = independentTools.querySelector<HTMLElement>("[data-responsive-toolbar-trigger='overflow']");
      const tolerance = RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.capacityTolerance;
      const hysteresis = RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.capacityRevealHysteresis;
      const measurementsReady = Number.isFinite(available) && available > 0 && Number.isFinite(labelledRequired) && labelledRequired > 0;
      const capacityMismatch = measurementsReady && (
        (toolsOverflowed && (
          labelMode !== "icon-only"
          || !allLabelsHidden
          || !overflowTrigger
          || !visibleElements(independentTools, "[data-responsive-toolbar-trigger='overflow']").length
          || !Number.isFinite(iconRequired)
          || (available >= iconRequired + hysteresis
            && independentTools.scrollWidth <= independentTools.clientWidth + tolerance)
        ))
        || (!toolsOverflowed && labelMode === "labelled" && (!allLabelsVisible || labelledRequired > available + tolerance))
        || (!toolsOverflowed && labelMode === "icon-only" && (
          !allLabelsHidden
          || !Number.isFinite(iconRequired)
          || iconRequired > available + tolerance
          || available >= labelledRequired + hysteresis
        ))
        || (!toolsOverflowed && labelMode !== "labelled" && labelMode !== "icon-only")
      );
      if (capacityMismatch) {
        addIssue(issues, "responsive-page-tools-integrity", "工具栏没有遵守文字、图标、更多的实测三级容量顺序。", "[data-responsive-independent-tools]");
      }
    }
    const expandedPanels = visibleElements(root, ".client-source-topbar-content.is-expanded, [data-responsive-page-tools-popover].is-expanded, [data-responsive-topbar][data-responsive-shell-tools-expanded='true'] > [data-responsive-topbar-content]");
    if (expandedPanels.length > 1) {
      addIssue(issues, "responsive-page-tools-integrity", "独立工具面板没有保持单面板互斥。", "[data-responsive-independent-tools]");
    }
    const expandedPageTools = expandedPanels[0];
    if (expandedPageTools) {
      const rect = expandedPageTools.getBoundingClientRect();
      const footer = visibleElements(root, "[data-page-layout-footer]")[0];
      const footerTop = footer?.getBoundingClientRect().top ?? window.innerHeight;
      const style = getComputedStyle(expandedPageTools);
      const ownsOverflow = expandedPageTools.scrollHeight <= expandedPageTools.clientHeight + 1 || ["auto", "scroll"].includes(style.overflowY);
      if (rect.left < -1 || rect.right > window.innerWidth + 1 || rect.top < -1 || rect.bottom > footerTop + 1 || !ownsOverflow) {
        addIssue(issues, "responsive-page-tools-integrity", "页面工具面板没有完整限制在顶部与尾栏之间的安全视口内。", "[data-responsive-live-surface-open='true']");
      }
    }
  }

  const functionKeys = visibleElements(document, RESPONSIVE_SHELL_FUNCTION_KEY_SELECTOR);
  if (functionKeys.length) {
    const expectedHeight = RESPONSIVE_SHELL_FACTORY_DEFAULT.functionKeys.height;
    const tolerance = RESPONSIVE_SHELL_FACTORY_DEFAULT.functionKeys.measurementTolerance;
    const heights = functionKeys.map((key) => key.getBoundingClientRect().height);
    const heightDrift = Math.max(...heights) - Math.min(...heights);
    if (heightDrift > tolerance || heights.some((keyHeight) => Math.abs(keyHeight - expectedHeight) > tolerance)) {
      addIssue(issues, "responsive-function-key-consistency", `共享功能键实测高度未统一到 ${expectedHeight}px。`, RESPONSIVE_SHELL_FUNCTION_KEY_SELECTOR);
    }
    if (functionKeys.some((key) => key.dataset.responsiveFunctionKeyPlugin !== "shared")) {
      addIssue(issues, "responsive-function-key-consistency", "可见功能键没有统一读取共享插件样式。", RESPONSIVE_SHELL_FUNCTION_KEY_SELECTOR);
    }
    if (functionKeys.some((key) => Math.abs((Number.parseFloat(getComputedStyle(key).columnGap) || 0) - RESPONSIVE_SHELL_FACTORY_DEFAULT.functionKeys.contentGap) > 0.75)) {
      addIssue(issues, "responsive-function-key-consistency", "共享功能键的图标与文字没有统一为最小 4px 间距。", RESPONSIVE_SHELL_FUNCTION_KEY_SELECTOR);
    }
  }


  for (const footerLocks of visibleElements(root, "[data-page-lock-footer-controls]")) {
    const density = footerLocks.dataset.responsiveFooterLockDensity;
    const available = Number.parseFloat(footerLocks.dataset.responsiveFooterLockAvailableWidth || "");
    const required = Number.parseFloat(footerLocks.dataset.responsiveFooterLockRequiredWidth || "");
    const tolerance = RESPONSIVE_SHELL_FACTORY_DEFAULT.footerActions.labelCollapseTolerance;
    const buttons = visibleElements(footerLocks, "[data-responsive-footer-lock-control]");
    const gapMismatch = buttons.some((button) => Math.abs((Number.parseFloat(getComputedStyle(button).columnGap) || 0) - RESPONSIVE_SHELL_FACTORY_DEFAULT.footerActions.controlContentGap) > 0.75);
    const labelsVisible = buttons.every((button) => {
      const label = button.querySelector<HTMLElement>("[data-page-lock-label]");
      return Boolean(label && getComputedStyle(label).display !== "none");
    });
    const labelledOverflow = footerLocks.dataset.responsiveFooterLockLabelledOverflow === "true";
    const prematureCollapse = density === "icon-only" && Number.isFinite(available) && Number.isFinite(required) && required <= available + tolerance && !labelledOverflow;
    const labelledCapacityOverflow = density === "labelled" && Number.isFinite(available) && Number.isFinite(required) && required > available + tolerance;
    if (gapMismatch || prematureCollapse || labelledCapacityOverflow || (density === "labelled" && !labelsVisible)) {
      addIssue(issues, "responsive-footer-capacity", "尾栏锁控件过早隐藏文字、完整文字溢出或图标文字间距偏离共享 4px 契约。", "[data-page-lock-footer-controls]");
      break;
    }
  }

  const visualLauncher = visibleElements(document, "[data-responsive-visual-launcher]")[0];
  if (visualLauncher) {
    const launcherStyle = getComputedStyle(visualLauncher);
    if (Number.parseFloat(launcherStyle.borderTopWidth) > 0 || launcherStyle.boxShadow !== "none") {
      addIssue(issues, "responsive-function-key-consistency", "可视化外层插槽重复绘制了边框或阴影。", "[data-responsive-visual-launcher]");
    }
    const launcherRect = visualLauncher.getBoundingClientRect();
    const footerSlot = visibleElements(root, "[data-responsive-visual-launcher-slot]")[0];
    const saveAction = visibleElements(root, "[data-source-project-action], [data-client-project-action]")[0];
    const slotRect = footerSlot?.getBoundingClientRect();
    const slotPrecedesSave = Boolean(footerSlot && saveAction && (footerSlot.compareDocumentPosition(saveAction) & Node.DOCUMENT_POSITION_FOLLOWING));
    const fixedInsideSlot = Boolean(footerSlot && footerSlot.contains(visualLauncher));
    const alignedToSlot = Boolean(slotRect
      && launcherRect.width > 0
      && launcherRect.height > 0
      && launcherRect.width <= slotRect.width + 2
      && launcherRect.height <= slotRect.height + 2
      && Math.abs((launcherRect.left + launcherRect.right) / 2 - (slotRect.left + slotRect.right) / 2) <= 2
      && Math.abs((launcherRect.top + launcherRect.bottom) / 2 - (slotRect.top + slotRect.bottom) / 2) <= 2);
    if (!slotPrecedesSave || !fixedInsideSlot || !alignedToSlot) {
      addIssue(issues, "responsive-visual-launcher-safety", "可视化入口没有固定在尾栏的保存并同步之前。", "[data-responsive-visual-launcher-slot]");
    }
    const protectedSelector = "[data-responsive-toolbar-trigger]:not([data-responsive-toolbar-trigger='visual']), [data-responsive-topbar-toggle], [data-responsive-page-tools-toggle], [data-responsive-page-tools-nav]";
    const protectedTargets = visibleElements(root, protectedSelector);
    const overlaps = protectedTargets.some((target) => {
      const rect = target.getBoundingClientRect();
      return launcherRect.left < rect.right && launcherRect.right > rect.left && launcherRect.top < rect.bottom && launcherRect.bottom > rect.top;
    });
    if (overlaps) {
      addIssue(issues, "responsive-visual-launcher-safety", "可视化入口覆盖了导航、页面工具或尾栏的可点击区域。", "[data-responsive-visual-launcher]");
    }
  }

  for (const saveAction of visibleElements(root, "[data-source-project-action], [data-client-project-action]")) {
    const rect = saveAction.getBoundingClientRect();
    if (rect.left < -1 || rect.right > window.innerWidth + 1 || rect.top < -1 || rect.bottom > window.innerHeight + 1) {
      addIssue(issues, "responsive-priority-ladder", "极窄屏把保存并同步操作推到了视口外。", "[data-source-project-action], [data-client-project-action]");
      break;
    }
  }

  for (const drawer of Array.from(root.querySelectorAll<HTMLElement>("[data-responsive-drawer]"))) {
    const drawerBody = drawer.querySelector<HTMLElement>(".app-mobile-sheet-body");
    const drawerSidebar = drawerBody?.querySelector<HTMLElement>("aside");
    if (!drawerBody || !drawerSidebar) {
      addIssue(issues, "responsive-drawer-integrity", "抽屉缺少内容滚动区或完整侧栏。", "[data-responsive-drawer]");
      break;
    }
    const bodyRect = drawerBody.getBoundingClientRect();
    const sidebarRect = drawerSidebar.getBoundingClientRect();
    if (getComputedStyle(drawer).overflowY !== "hidden"
      || getComputedStyle(drawerBody).overflowY === "visible"
      || sidebarRect.width + 1 < drawerBody.clientWidth) {
      addIssue(issues, "responsive-drawer-integrity", "抽屉存在双滚动或侧栏右侧空白，未满足单侧栏工厂契约。", "[data-responsive-drawer]");
      break;
    }
  }

  for (const [region, selector] of Object.entries({ workspace: selectors.workspace, title: selectors.title, content: selectors.content })) {
    if (!visibleElements(root, selector).length) addIssue(issues, "semantic-regions", `缺少可发现的${region}区域。`, selector);
  }
  const hasTable = Boolean(root.querySelector("[data-page-table], [data-product-market-table-shell='true']"));
  if (hasTable && !visibleElements(root, selectors.tableHeader).length) addIssue(issues, "semantic-regions", "表格页面缺少共享表头区域登记。", selectors.tableHeader);

  // 栏目配置的一级／二级图标必须使用同一份共享图标插件；否则状态组会落入
  // 旧图标占位列，既看不到图标设置，也容易把“开启”误认为未生效。
  if (root.querySelector(".product-module-root-card") && !visibleElements(root, "[data-content-plugin-icon-setting-variant='compact']").length) {
    addIssue(issues, "plugin-geometry", "栏目配置缺少一级或二级共享图标设置插件。", "[data-content-plugin-icon-setting-variant='compact']");
  }

  const sharedThemePaletteKeys = ["rose", "orange", "indigoGreen", "tealRose", "limeTea", "dark", "light"];
  const hasSharedThemePaletteKeys = (keys: string[]) =>
    keys.length === sharedThemePaletteKeys.length && sharedThemePaletteKeys.every((key) => keys.includes(key));
  const layoutPaletteKeys = visibleElements(root, "[data-product-market-palette-key]")
    .map((element) => element.dataset.productMarketPaletteKey || "");
  if (layoutPaletteKeys.length && !hasSharedThemePaletteKeys(layoutPaletteKeys)) {
    addIssue(issues, "semantic-regions", "Layout palette does not use the shared seven-theme source.", "[data-product-market-palette-key]");
  }
  const operationsPaletteKeys = visibleElements(root, "[data-product-market-theme-section] [data-shared-theme-palette-key]")
    .map((element) => element.dataset.sharedThemePaletteKey || "");
  if (operationsPaletteKeys.length && !hasSharedThemePaletteKeys(operationsPaletteKeys)) {
    addIssue(issues, "semantic-regions", "Operations palette does not use the shared seven-theme source.", selectors.themePalette);
  }
  for (const button of visibleElements(root, "[data-product-market-theme-section] button[data-shared-theme-palette-key]")) {
    const key = button.dataset.sharedThemePaletteKey as ProductMarketThemePaletteKey;
    const preview = PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP[key]?.operationsSwitch;
    if (!preview) continue;
    const style = getComputedStyle(button);
    if (
      button.dataset.sharedThemePalettePolicy !== "immutable-factory-preview"
      || normalizeCss(style.backgroundColor) !== normalizeCss(resolveScopedCssValue(button, "backgroundColor", preview.background))
      || normalizeCss(style.color) !== normalizeCss(resolveScopedCssValue(button, "color", preview.text))
      || normalizeCss(style.borderTopColor) !== normalizeCss(resolveScopedCssValue(button, "borderColor", preview.border))
    ) {
      addIssue(issues, "theme-palette-dual-tone", `${PRODUCT_MARKET_THEME_PALETTE_MAP[key].name} 运营市场色块被运行时样式覆盖。`, `[data-product-market-theme-key='${key}']`);
      break;
    }
  }
  const title2Surface = visibleElements(root, "[data-product-market-theme-section][data-shared-theme-palette-appearance='title-2-dual-tone']")[0];
  if (title2Surface) {
    const rootStyle = getComputedStyle(documentRoot.documentElement);
    const expectedBg = normalizeCss(resolveSharedCssValue(documentRoot, "backgroundColor", rootStyle.getPropertyValue("--tradepro-panel-title-2-bg")));
    const expectedText = normalizeCss(resolveSharedCssValue(documentRoot, "color", rootStyle.getPropertyValue("--tradepro-panel-title-2-text")));
    const actual = getComputedStyle(title2Surface);
    if (!expectedBg || !expectedText || normalizeCss(actual.backgroundColor) !== expectedBg || normalizeCss(actual.color) !== expectedText) {
      addIssue(issues, "theme-palette-dual-tone", "标题2没有读取当前主题的浅底色与可读文字色。", "[data-product-market-theme-section]");
    }
  }
  for (const card of visibleElements(root, "[data-product-market-palette-key]")) {
    const key = card.dataset.productMarketPaletteKey as ProductMarketThemePaletteKey;
    const palette = PRODUCT_MARKET_THEME_PALETTE_MAP[key];
    const preview = PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP[key]?.layoutChooser;
    if (!palette || !preview) continue;
    const style = getComputedStyle(card);
    const expectedBg = normalizeCss(resolveScopedCssValue(card, "backgroundColor", preview.background));
    const expectedText = normalizeCss(resolveScopedCssValue(card, "color", preview.text));
    const expectedBorder = normalizeCss(resolveScopedCssValue(card, "borderColor", preview.border));
    const primary = card.style.getPropertyValue("--tradepro-product-market-palette-card-primary").trim().toLowerCase();
    if (
      card.dataset.sharedThemePalettePolicy !== "immutable-factory-preview"
      || normalizeCss(style.backgroundColor) !== expectedBg
      || normalizeCss(style.color) !== expectedText
      || normalizeCss(style.borderTopColor) !== expectedBorder
      || primary !== preview.primary.toLowerCase()
    ) {
      addIssue(issues, "theme-palette-dual-tone", `${palette.name} 色卡没有读取工厂只读的 panel/text/primary 预览色。`, `[data-product-market-palette-key='${key}']`);
      break;
    }
  }
  const layoutThemeStatus = root.querySelector<HTMLElement>("[data-layout-theme-status]");
  if (layoutThemeStatus) {
    const key = layoutThemeStatus.dataset.sharedThemePaletteKey as ProductMarketThemePaletteKey;
    const preview = PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP[key]?.expandedThemeStatus;
    const style = getComputedStyle(layoutThemeStatus);
    if (
      layoutThemeStatus.dataset.sharedThemePaletteAppearance !== "operations-theme-switch"
      || layoutThemeStatus.dataset.sharedThemePalettePolicy !== "immutable-factory-preview"
      || !preview
      || normalizeCss(style.backgroundColor) !== normalizeCss(resolveScopedCssValue(layoutThemeStatus, "backgroundColor", preview.background))
      || normalizeCss(style.color) !== normalizeCss(resolveScopedCssValue(layoutThemeStatus, "color", preview.text))
    ) {
      addIssue(issues, "theme-palette-dual-tone", "已展开主题没有读取工厂只读的 primary/onPrimary 预览色。", "[data-layout-theme-status]");
    }
  }
  const expandedThemeToggle = root.querySelector<HTMLElement>("[data-shared-theme-palette-appearance='expanded-theme-toggle']");
  if (expandedThemeToggle) {
    const key = expandedThemeToggle.dataset.sharedThemePaletteKey as ProductMarketThemePaletteKey;
    const preview = PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP[key]?.expandedThemeStatus;
    const style = getComputedStyle(expandedThemeToggle);
    if (
      expandedThemeToggle.dataset.sharedThemePalettePolicy !== "immutable-factory-preview"
      || !preview
      || normalizeCss(style.backgroundColor) !== normalizeCss(resolveScopedCssValue(expandedThemeToggle, "backgroundColor", preview.background))
      || normalizeCss(style.color) !== normalizeCss(resolveScopedCssValue(expandedThemeToggle, "color", preview.text))
    ) {
      addIssue(issues, "theme-palette-dual-tone", "主题展开按钮没有读取工厂只读的当前版面颜色。", "[data-shared-theme-palette-appearance='expanded-theme-toggle']");
    }
  }
  const serviceThemeStatus = root.querySelector<HTMLElement>("[data-service-theme-status]");
  if (serviceThemeStatus && serviceThemeStatus.dataset.sharedThemePaletteAppearance !== "operations-theme-switch") {
    addIssue(issues, "semantic-regions", "Service theme-status does not use the Operations theme-switch palette surface.", "[data-service-theme-status]");
  }
  const serviceControls = visibleElements(root, "[data-service-shared-color-contract='true'] [data-template-config-service-control='true']");
  if (root.querySelector("[data-service-shared-color-contract='true']") && !serviceControls.length) {
    addIssue(issues, "semantic-regions", "Service header is missing shared-colour service controls.", "[data-service-shared-color-contract]");
  }
  if (serviceControls.length) {
    const expectedServiceControlBg = normalizeCss(resolveSharedCssValue(documentRoot, "backgroundColor", "var(--tradepro-shared-list-bg, var(--tradepro-panel-list-bg))"));
    const expectedServiceControlText = normalizeCss(resolveSharedCssValue(documentRoot, "color", "var(--tradepro-shared-list-text, var(--tradepro-panel-list-text))"));
    const expectedServiceControlBorder = normalizeCss(resolveSharedCssValue(documentRoot, "borderColor", "var(--tradepro-shared-list-border, var(--tradepro-shell-border))"));
    if (serviceControls.some((control) => {
      const style = getComputedStyle(control);
      return normalizeCss(style.backgroundColor) !== expectedServiceControlBg
        || normalizeCss(style.color) !== expectedServiceControlText
        || normalizeCss(style.borderColor) !== expectedServiceControlBorder;
    })) {
      addIssue(issues, "semantic-regions", "Service controls do not read the shared list colour contract.", "[data-template-config-service-control]");
    }
  }
  const sharedStatusKeys = ["active", "inactive", "hidden"];
  const hasAllSharedStatusKeys = (keys: string[]) => sharedStatusKeys.every((key) => keys.includes(key));
  const expectedStatusFactoryRoles: Record<string, string> = { active: "palette-primary", inactive: "high-red", hidden: "dark-gray" };
  const layoutStatusCardElements = visibleElements(root, "[data-layout-status-settings] [data-shared-status-card-source='product-card-colors']");
  const layoutStatusCards = layoutStatusCardElements.map((element) => element.dataset.sharedStatusCard || "");
  if (root.querySelector("[data-layout-status-settings]") && !hasAllSharedStatusKeys(layoutStatusCards)) {
    addIssue(issues, "status-card-source", "Layout status previews do not register active, inactive and hidden from the shared source.", "[data-layout-status-settings]");
  }
  if (layoutStatusCardElements.some((element) => expectedStatusFactoryRoles[element.dataset.sharedStatusCard || ""] !== element.dataset.sharedStatusCardFactoryRole)) {
    addIssue(issues, "status-card-source", "Layout status preview factory roles must be palette-primary, high-red and dark-gray.", "[data-layout-status-settings]");
  }
  const operationStatusControlElements = visibleElements(root, "[data-product-market-status-control][data-shared-status-card-source='product-card-colors']");
  const operationStatusControls = operationStatusControlElements.map((element) => element.dataset.productMarketStatusControl || "");
  if (root.querySelector("[data-product-market-card]") && !hasAllSharedStatusKeys(operationStatusControls)) {
    addIssue(issues, "status-card-source", "Operations status controls do not expose all three shared status cards.", "[data-product-market-status-control]");
  }
  if (operationStatusControlElements.some((element) => expectedStatusFactoryRoles[element.dataset.productMarketStatusControl || ""] !== element.dataset.sharedStatusCardFactoryRole)) {
    addIssue(issues, "status-card-source", "Operations status controls do not use the factory status roles.", "[data-product-market-status-control]");
  }
  for (const card of visibleElements(root, "[data-product-market-card][data-shared-status-card-source='product-card-colors']")) {
    const cardStyle = getComputedStyle(card);
    const expectedCardBackground = normalizeCss(resolveScopedCssValue(card, "backgroundColor", "var(--product-market-card-bg)"));
    const expectedCardBorder = normalizeCss(resolveScopedCssValue(card, "borderColor", "var(--product-market-card-border)"));
    const expectedCardText = normalizeCss(resolveScopedCssValue(card, "color", "var(--product-market-card-name-color)"));
    const status = card.dataset.sharedStatusCard || "";
    const selectedControl = card.querySelector<HTMLElement>(`[data-product-market-status-control="${status}"]`);
    const statusBadge = card.querySelector<HTMLElement>(`[data-product-market-status-badge="${status}"]`);
    const controlStyle = selectedControl ? getComputedStyle(selectedControl) : null;
    const badgeStyle = statusBadge ? getComputedStyle(statusBadge) : null;
    if (
      !expectedCardBackground
      || !expectedCardBorder
      || !expectedCardText
      || normalizeCss(cardStyle.backgroundColor) !== expectedCardBackground
      || normalizeCss(cardStyle.borderTopColor) !== expectedCardBorder
      || normalizeCss(cardStyle.color) !== expectedCardText
      || !controlStyle
      || !selectedControl
      || normalizeCss(controlStyle.backgroundColor) !== normalizeCss(resolveScopedCssValue(selectedControl, "backgroundColor", "var(--product-market-status-bg)"))
      || normalizeCss(controlStyle.color) !== normalizeCss(resolveScopedCssValue(selectedControl, "color", "var(--product-market-status-text)"))
      || !badgeStyle
      || !statusBadge
      || normalizeCss(badgeStyle.backgroundColor) !== normalizeCss(resolveScopedCssValue(statusBadge, "backgroundColor", "var(--product-market-status-bg)"))
      || normalizeCss(badgeStyle.color) !== normalizeCss(resolveScopedCssValue(statusBadge, "color", "var(--product-market-status-text)"))
    ) {
      addIssue(issues, "status-card-source", "运营市场状态切换没有将小卡片底色／字体、顶部状态标签及当前状态胶囊的底色／字体投射为最终样式。", "[data-product-market-card]");
      break;
    }
  }
  if (layoutPaletteKeys.length && root.querySelector("[data-theme-editor-default-source]")?.getAttribute("data-theme-editor-default-source") !== "neutral-white-black") {
    addIssue(issues, "semantic-regions", "New theme does not use the neutral white/black source.", "[data-theme-editor-default-source]");
  }

  const scrollOwners = visibleElements(root, "[data-product-market-scroll-list], [data-page-list-scroll-owner]");
  const overflowingContents = visibleElements(root, selectors.content).filter((element) => {
    const overflowY = getComputedStyle(element).overflowY;
    return (overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight + 1;
  });
  if (scrollOwners.length > 1) addIssue(issues, "single-scroll-owner", `检测到 ${scrollOwners.length} 个内容滚动所有者，应最多为 1 个。`, "[data-product-market-scroll-list], [data-page-list-scroll-owner]");
  else if (!scrollOwners.length && overflowingContents.length) addIssue(issues, "single-scroll-owner", "内容已经滚动，但没有登记滚动所有者。", selectors.content);
  if (scrollOwners.some((owner) => owner.scrollWidth > owner.clientWidth + 1)) {
    addIssue(issues, "responsive-scroll-containment", "当前宽度下表内滚动容器出现横向溢出。", "[data-page-list-scroll-owner]");
  }
  if (scrollOwners.length === 1) {
    const owner = scrollOwners[0];
    const style = getComputedStyle(owner);
    const sharedWorkspace = owner.closest<HTMLElement>("[data-shared-page-workspace]");
    const clientProjectFrame = owner.closest<HTMLElement>("[data-client-project-frame]");
    const factoryRoot = owner.closest<HTMLElement>("[data-page-factory-contract]");
    const boundary = sharedWorkspace ?? clientProjectFrame ?? factoryRoot;
    if (boundary) {
      const ownerRect = owner.getBoundingClientRect();
      const boundaryRect = boundary.getBoundingClientRect();
      const leftInset = ownerRect.left - boundaryRect.left;
      const rightInset = boundaryRect.right - ownerRect.right;
      if (Math.min(leftInset, rightInset) < 10 || Math.abs(leftInset - rightInset) > 1.5) {
        addIssue(
          issues,
          "single-scroll-owner",
          `唯一滚动条没有落在共享对称轨道：左 ${leftInset.toFixed(1)}px / 右 ${rightInset.toFixed(1)}px。`,
          "[data-page-list-scroll-owner]",
        );
      }
    }
    const scrollbarReserve = owner.offsetWidth - owner.clientWidth;
    if (
      !style.scrollbarGutter.includes("stable")
      || scrollbarReserve < 13.5
      || scrollbarReserve > 16.5
      || Number.parseFloat(style.paddingLeft) > 0.5
      || Number.parseFloat(style.paddingRight) > 0.5
    ) {
      addIssue(
        issues,
        "single-scroll-owner",
        `滚动条槽或内容间距未使用共享契约：预留 ${scrollbarReserve}px，左右内边距 ${style.paddingLeft}/${style.paddingRight}。`,
        "[data-page-list-scroll-owner]",
      );
    }
    let ancestor = owner.parentElement;
    const main = owner.closest<HTMLElement>(".app-main, .app-main-roomy");
    while (ancestor && ancestor !== main) {
      const ancestorStyle = getComputedStyle(ancestor);
      const ancestorReserve = ancestor.offsetWidth - ancestor.clientWidth;
      if (
        ancestorStyle.scrollbarGutter.includes("stable")
        && !/^(auto|scroll)$/u.test(ancestorStyle.overflowY)
        && ancestorReserve > 1
      ) {
        addIssue(
          issues,
          "single-scroll-owner",
          `非滚动外层仍预留 ${ancestorReserve}px 稳定槽，会和内容滚动条形成双重间距。`,
          "[data-page-list-scroll-owner]",
        );
        break;
      }
      ancestor = ancestor.parentElement;
    }
  }
  const tableScrollOwners = visibleElements(root, "[data-product-market-table-shell] > [data-shared-scroll-contract='table-inner-60']");
  for (const owner of tableScrollOwners) {
    const style = getComputedStyle(owner);
    const shellStyle = owner.parentElement ? getComputedStyle(owner.parentElement) : null;
    const ownerHasZeroFlexBasis = Number.parseFloat(style.flexBasis) === 0;
    const shellHasZeroFlexBasis = shellStyle ? Number.parseFloat(shellStyle.flexBasis) === 0 : false;
    if (
      style.paddingBottom !== "60px"
      || style.scrollPaddingBottom !== "60px"
      || !ownerHasZeroFlexBasis
      || !shellHasZeroFlexBasis
      || owner.parentElement?.dataset.productMarketTableShell !== "true"
    ) {
      addIssue(issues, "single-scroll-owner", "运营市场、栏目配置、版面风格与客服音效必须只保留一个受限表内滚动区：表内框和滚动区均使用零弹性基准，60px 缓冲只存在于滚动区内部。", "[data-product-market-table-shell] > [data-shared-scroll-contract='table-inner-60']");
      break;
    }
  }

  for (const shell of visibleElements(root, selectors.tableShell)) {
    const style = getComputedStyle(shell);
    if (parseFloat(style.borderTopLeftRadius) > 0 || parseFloat(style.borderTopRightRadius) > 0) {
      addIssue(issues, "table-shell-corners", "表内上角没有保持直角。", selectors.tableShell);
      break;
    }
  }

  const expectedRadius = normalizeCss(resolveSharedCssValue(documentRoot, "borderRadius", "var(--tradepro-layout-card-radius, 0.75rem)"));
  const expectedShadow = normalizeCss(resolveSharedCssValue(documentRoot, "boxShadow", "var(--tradepro-layout-shadow, none)"));
  const expectedHeaderRadius = normalizeCss(resolveSharedCssValue(documentRoot, "borderRadius", "var(--tradepro-layout-table-header-radius, 0.75rem)"));
  const expectedFont = normalizeCss(resolveSharedCssValue(documentRoot, "fontFamily", "var(--tradepro-global-font-family, system-ui, sans-serif)"));
  for (const header of visibleElements(root, selectors.tableHeader)) {
    const style = getComputedStyle(header);
    const shadow = normalizeCss(style.boxShadow);
    if (shadow.includes("inset") || shadow !== expectedShadow) {
      addIssue(issues, "table-header-boundary", `表头阴影未读取共享轻量 3D：${style.boxShadow || "none"}。`, selectors.tableHeader);
      break;
    }
    if (style.transform !== "none" || /(^|,\s*)(all|transform)(,|$)/.test(style.transitionProperty)) {
      addIssue(issues, "table-header-boundary", "表头仍允许几何属性或 transform 参与悬停过渡，可能造成位移。", selectors.tableHeader);
      break;
    }
    if (header.tagName === "THEAD") {
      const edgeCells = resolveVisibleTableHeaderEdgeCells(header);
      if (!edgeCells) {
        addIssue(issues, "table-header-boundary", "原生表头没有可见的边缘单元格。", selectors.tableHeader);
        break;
      }
      const firstStyle = getComputedStyle(edgeCells.first);
      const lastStyle = getComputedStyle(edgeCells.last);
      if (
        normalizeCss(firstStyle.borderTopLeftRadius) !== expectedHeaderRadius
        || normalizeCss(firstStyle.borderBottomLeftRadius) !== expectedHeaderRadius
        || normalizeCss(lastStyle.borderTopRightRadius) !== expectedHeaderRadius
        || normalizeCss(lastStyle.borderBottomRightRadius) !== expectedHeaderRadius
      ) {
        addIssue(issues, "table-header-boundary", `表头四个外角没有统一读取 ${expectedHeaderRadius}。`, selectors.tableHeader);
        break;
      }
    } else if (
      normalizeCss(style.borderTopLeftRadius) !== expectedHeaderRadius
      || normalizeCss(style.borderTopRightRadius) !== expectedHeaderRadius
      || normalizeCss(style.borderBottomLeftRadius) !== expectedHeaderRadius
      || normalizeCss(style.borderBottomRightRadius) !== expectedHeaderRadius
    ) {
      addIssue(issues, "table-header-boundary", `表头四角没有统一读取 ${expectedHeaderRadius}。`, selectors.tableHeader);
      break;
    }
  }
  const cards = visibleElements(root, selectors.cards);
  for (const card of cards) {
    const style = getComputedStyle(card);
    const shadow = normalizeCss(style.boxShadow);
    if (shadow.includes("inset") || shadow !== expectedShadow) {
      addIssue(issues, "card-elevation", `卡片阴影未读取共享轻量 3D：${style.boxShadow || "none"}。`, selectors.cards);
      break;
    }
    const radiusTarget = card.tagName === "TR" ? card.firstElementChild as HTMLElement | null : card;
    if (radiusTarget && normalizeCss(getComputedStyle(radiusTarget).borderTopLeftRadius) !== expectedRadius) {
      addIssue(issues, "card-radius", `卡片圆角未读取共享值 ${expectedRadius}。`, selectors.cards);
      break;
    }
    if (normalizeCss(style.fontFamily) !== expectedFont) {
      addIssue(issues, "shared-typography", "卡片字体未读取全局共享字体。", selectors.cards);
      break;
    }
  }

  const expectedPluginHeight = normalizeCss(resolveSharedCssValue(documentRoot, "height", "var(--tradepro-shared-plugin-control-size, 2rem)"));
  for (const plugin of visibleElements(root, selectors.plugins)) {
    const style = getComputedStyle(plugin);
    if (normalizeCss(style.height) !== expectedPluginHeight) {
      addIssue(issues, "plugin-geometry", `插件高度 ${style.height} 与共享尺寸 ${expectedPluginHeight} 不一致。`, selectors.plugins);
      break;
    }
    if (normalizeCss(style.fontFamily) !== expectedFont) {
      addIssue(issues, "shared-typography", "插件字体未读取全局共享字体。", selectors.plugins);
      break;
    }
  }

  const expectedHierarchyTextHeight = normalizeCss(resolveSharedCssValue(documentRoot, "height", "1.5rem"));
  const expectedHierarchyTextFontSize = normalizeCss(resolveSharedCssValue(documentRoot, "fontSize", "var(--tradepro-shared-plugin-font-size, 0.75rem)"));
  const expectedHierarchyTextFontWeight = normalizeCss(resolveSharedCssValue(documentRoot, "fontWeight", "var(--tradepro-global-font-weight, 400)"));
  for (const hierarchyText of visibleElements(root, "[data-shared-module-hierarchy-rail='flat'] > .product-module-hierarchy-text")) {
    const style = getComputedStyle(hierarchyText);
    if (
      normalizeCss(style.height) !== expectedHierarchyTextHeight
      || normalizeCss(style.fontSize) !== expectedHierarchyTextFontSize
      || normalizeCss(style.fontWeight) !== expectedHierarchyTextFontWeight
      || style.borderTopWidth !== "0px"
      || style.borderRightWidth !== "0px"
      || style.borderBottomWidth !== "0px"
      || style.borderLeftWidth !== "0px"
      || normalizeCss(style.backgroundColor) !== "rgba(0, 0, 0, 0)"
      || Number.parseFloat(style.borderRadius) !== 0
    ) {
      addIssue(issues, "hierarchy-pill-geometry", `栏目层级文字 ${style.height}/${style.fontSize}/${style.fontWeight} 仍带胶囊外壳或没有读取统一几何。`, "[data-shared-module-hierarchy-rail='flat'] > .product-module-hierarchy-text");
      break;
    }
  }

  for (const row of visibleElements(root, ".product-module-root-card [data-template-module-split], .product-module-child-card [data-template-module-split]")) {
    const settingsCarrier = row.querySelector<HTMLElement>(":scope > .adaptive-work-matrix-function");
    const editorCarrier = row.querySelector<HTMLElement>(":scope > .adaptive-work-matrix-edit");
    const hierarchyRail = row.querySelector<HTMLElement>("[data-shared-module-hierarchy-rail='flat']");
    const hierarchyTexts = hierarchyRail ? visibleElements(hierarchyRail, ":scope > .product-module-hierarchy-text") : [];
    const compactIconCarrier = row.querySelector<HTMLElement>("[data-content-plugin-icon-setting-variant='compact']");
    const compactIconTrigger = compactIconCarrier?.querySelector<HTMLElement>("[data-content-plugin-control='icon']");
    const settingsStyle = settingsCarrier ? getComputedStyle(settingsCarrier) : null;
    const editorStyle = editorCarrier ? getComputedStyle(editorCarrier) : null;
    const iconCarrierStyle = compactIconCarrier ? getComputedStyle(compactIconCarrier) : null;
    const iconTriggerStyle = compactIconTrigger ? getComputedStyle(compactIconTrigger) : null;
    if (
      !settingsStyle
      || !editorStyle
      || !hierarchyRail
      || hierarchyTexts.length < 3
      || !iconCarrierStyle
      || !iconTriggerStyle
      || settingsStyle.borderTopWidth !== "0px"
      || normalizeCss(settingsStyle.backgroundColor) !== "rgba(0, 0, 0, 0)"
      || Number.parseFloat(settingsStyle.borderRadius) !== 0
      || editorStyle.borderTopWidth !== "0px"
      || normalizeCss(editorStyle.backgroundColor) !== "rgba(0, 0, 0, 0)"
      || Number.parseFloat(editorStyle.paddingLeft) !== 0
      || Number.parseFloat(editorStyle.paddingRight) !== 0
      || iconCarrierStyle.borderTopWidth !== "0px"
      || normalizeCss(iconCarrierStyle.backgroundColor) !== "rgba(0, 0, 0, 0)"
      || iconTriggerStyle.borderTopWidth === "0px"
    ) {
      addIssue(issues, "module-editor-capsules", "栏目一级或二级没有保持单卡片边界、无框层级文字，或图标设置失去真实点击边界。", ".product-module-child-card [data-template-module-split]");
      break;
    }
  }

  const moduleEditorPolicy = RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.moduleEditor;
  for (const moduleEditorRow of visibleElements(root, "[data-responsive-capacity-row='module-editor']")) {
    const moduleEditor = moduleEditorRow.closest<HTMLElement>("[data-responsive-structure-item='module']");
    if (!moduleEditor) continue;
    const moduleWidth = moduleEditor.getBoundingClientRect().width;
    const operation = moduleEditorRow.querySelector<HTMLElement>(".adaptive-work-matrix-operation-grid");
    const status = moduleEditorRow.querySelector<HTMLElement>("[data-content-plugin-actions='status']");
    const hierarchy = moduleEditorRow.querySelector<HTMLElement>(".adaptive-work-matrix-sort-cell");
    const fields = visibleElements(moduleEditorRow, ".product-module-detail-grid input");
    if (!operation || !status || !hierarchy || moduleEditorRow.scrollWidth > moduleEditorRow.clientWidth + 1) {
      addIssue(issues, "module-editor-capacity", "栏目编辑器缺少共享功能组或产生横向溢出。", "[data-responsive-structure-item='module']");
      break;
    }
    const operationRect = operation.getBoundingClientRect();
    const statusRect = status.getBoundingClientRect();
    const statusDisplay = getComputedStyle(status).display;
    const compactStatusGroup = ["flex", "inline-flex"].includes(statusDisplay)
      && statusRect.width < operationRect.width - 2;
    const operationChildRects = visibleElements(operation, ":scope > *").map((child) => child.getBoundingClientRect());
    const operationSingleLine = operationChildRects.length > 0
      && Math.max(...operationChildRects.map((rect) => rect.top)) - Math.min(...operationChildRects.map((rect) => rect.top)) <= 2;
    if (moduleWidth >= moduleEditorPolicy.mediumInlineMinimum
      && (Math.abs(operationRect.top - hierarchy.getBoundingClientRect().top) > 2 || !compactStatusGroup || !operationSingleLine)) {
      addIssue(issues, "module-editor-capacity", "栏目卡片在容量足够时没有保持操作、状态和层级功能组单行紧凑排列。", "[data-responsive-structure-item='module']");
      break;
    }
    if (moduleWidth >= moduleEditorPolicy.twoFieldMinimum && fields.length >= 2) {
      const firstField = fields[0].getBoundingClientRect();
      const secondField = fields[1].getBoundingClientRect();
      if (Math.abs(firstField.top - secondField.top) > 2 || Math.abs(firstField.left - secondField.left) < 2) {
        addIssue(issues, "module-editor-capacity", "栏目名称与说明在容量足够时没有保持双字段同行。", ".product-module-detail-grid");
        break;
      }
    }
    if (moduleWidth > moduleEditorPolicy.extremeStackMaximum && moduleWidth < moduleEditorPolicy.mediumInlineMinimum
      && !compactStatusGroup) {
      addIssue(issues, "module-editor-capacity", "小屏尚有空间时状态组被过早拉满整行。", "[data-content-plugin-actions='status']");
      break;
    }
    if (moduleWidth <= moduleEditorPolicy.extremeStackMaximum) {
      const buttonWidths = visibleElements(status, "button").map((button) => button.getBoundingClientRect().width);
      if (statusRect.width < operationRect.width - 2 || buttonWidths.length !== 3 || Math.max(...buttonWidths) - Math.min(...buttonWidths) > 1) {
        addIssue(issues, "module-editor-capacity", "极窄屏状态组没有使用整行三等分布局。", "[data-content-plugin-actions='status']");
        break;
      }
    }
  }

  const sortableOwnershipPolicy = RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.sortableOwnership;
  for (const card of visibleElements(root, "[data-shared-sortable-card]")) {
    const rail = card.querySelector<HTMLElement>("[data-shared-sortable-card-rail]");
    const moveRail = card.querySelector<HTMLElement>("[data-shared-sort-move-rail]");
    const drag = moveRail?.querySelector<HTMLElement>("[data-content-plugin-control='drag']");
    const moveUp = moveRail?.querySelector<HTMLElement>("[data-content-plugin-control='move-up']");
    const moveDown = moveRail?.querySelector<HTMLElement>("[data-content-plugin-control='move-down']");
    const sectionCard = card.matches("[data-responsive-structure-item='layout-section'], [data-responsive-structure-item='service-section']");
    const serviceCard = card.matches("[data-responsive-structure-item='service-section']");
    const categoryCard = card.matches("[data-product-market-category-group][data-shared-product-market-category-source='modules']");
    const railRect = rail?.getBoundingClientRect();
    const moveRailRect = moveRail?.getBoundingClientRect();
    const railStyle = rail ? getComputedStyle(rail) : null;
    const categoryContent = categoryCard
      ? card.querySelector<HTMLElement>(":scope > [data-responsive-mobile-collection]")
      : null;
    const categoryOperationCarrier = categoryCard
      ? rail?.querySelector<HTMLElement>(".product-module-category-operation-grid")
      : null;
    const categoryOperationStyle = categoryOperationCarrier ? getComputedStyle(categoryOperationCarrier) : null;
    const directRailChildren = rail
      ? Array.from(rail.children).filter((child): child is HTMLElement => child instanceof HTMLElement && isVisibleElement(child))
      : [];
    const serviceCapsuleCopy = serviceCard && rail
      ? Array.from(rail.querySelectorAll<HTMLElement>("[data-shared-sortable-capsule-title], [data-shared-sortable-capsule-description]")).filter(isVisibleElement)
      : [];
    const hasSharedDesktopRhythm = window.innerWidth < 1024 || (!sectionCard && !categoryCard) || (
      Math.abs((railRect?.height ?? 0) - sortableOwnershipPolicy.settingsHeaderMinimum) <= 1
      && directRailChildren.length > 0
      && directRailChildren.every((child) => Math.abs(child.getBoundingClientRect().height - sortableOwnershipPolicy.settingsHeaderInnerHeight) <= 1)
      && Math.abs(Number.parseFloat(railStyle?.fontSize || "0") - sortableOwnershipPolicy.settingsFontSize) <= 0.5
      && Math.abs(Number.parseFloat(railStyle?.lineHeight || "0") - sortableOwnershipPolicy.settingsLineHeight) <= 0.5
      && (!serviceCard || (serviceCapsuleCopy.length > 0 && serviceCapsuleCopy.every((node) => {
        const style = getComputedStyle(node);
        return Math.abs(Number.parseFloat(style.fontSize) - sortableOwnershipPolicy.settingsFontSize) <= 0.5
          && Math.abs(Number.parseFloat(style.lineHeight) - sortableOwnershipPolicy.settingsLineHeight) <= 0.5;
      })))
    );
    const hasSingleOuterFrame = rail?.dataset.sharedSortableCapsule === "single"
      && Math.abs((Number.parseFloat(railStyle?.paddingTop || "0")) - sortableOwnershipPolicy.settingsHeaderPadding) <= 0.5
      && Math.abs((Number.parseFloat(railStyle?.borderTopWidth || "0")) - 1) <= 0.5
      && Math.abs((Number.parseFloat(railStyle?.borderTopLeftRadius || "0")) - 12) <= 0.5
      && directRailChildren.every((child) => {
        const childStyle = getComputedStyle(child);
        const semanticLayoutControl = child.matches("[data-layout-section-editor-segment='controls']");
        const semanticDividerCount = [childStyle.borderRightWidth, childStyle.borderBottomWidth]
          .filter((width) => Number.parseFloat(width) > 0).length;
        return Number.parseFloat(childStyle.borderTopWidth) === 0
          && Number.parseFloat(childStyle.borderLeftWidth) === 0
          && Number.parseFloat(childStyle.borderTopLeftRadius) === 0
          && (semanticLayoutControl
            ? semanticDividerCount === 1
            : Number.parseFloat(childStyle.borderRightWidth) === 0
              && Number.parseFloat(childStyle.borderBottomWidth) === 0);
      });
    const hasModuleCategoryContentRhythm = window.innerWidth < 1024 || !categoryCard || (
      Boolean(categoryContent && railRect)
      && Math.abs((categoryContent?.getBoundingClientRect().top ?? 0) - (railRect?.bottom ?? 0) - sortableOwnershipPolicy.settingsContentGap) <= 1
      && categoryOperationStyle?.backgroundColor === "rgba(0, 0, 0, 0)"
      && Number.parseFloat(categoryOperationStyle?.borderTopWidth || "0") === 0
      && Number.parseFloat(categoryOperationStyle?.borderTopLeftRadius || "0") === 0
    );
    if (
      !rail || !moveRail || !drag || !moveUp || !moveDown
      || !hasSharedDesktopRhythm
      || !hasSingleOuterFrame
      || !hasModuleCategoryContentRhythm
      || (sectionCard && (
        Math.abs((moveRailRect?.width ?? 0) - sortableOwnershipPolicy.moveRailWidth) > 1
        || Math.abs((moveRailRect?.height ?? 0) - sortableOwnershipPolicy.controlSize) > 1
      ))
    ) {
      addIssue(issues, "shared-sortable-ownership", "栏目配置、版面风格或客服音效没有读取统一拖拉／上下移尺寸与整卡高亮控制栏。", "[data-shared-sortable-card]");
      break;
    }
  }

  for (const rail of visibleElements(root, "[data-product-market-category-group][data-shared-product-market-category-source='operations'] > [data-shared-category-capsule='single']")) {
    const group = rail.parentElement;
    const content = group?.querySelector<HTMLElement>(":scope > [data-product-market-card-grid]");
    const railRect = rail.getBoundingClientRect();
    const railStyle = getComputedStyle(rail);
    const directRailChildren = Array.from(rail.children).filter((child): child is HTMLElement => child instanceof HTMLElement && isVisibleElement(child));
    const hasOperationsProjectionRhythm = window.innerWidth < 1024 || (
      Math.abs(railRect.height - sortableOwnershipPolicy.settingsHeaderMinimum) <= 1
      && Math.abs(Number.parseFloat(railStyle.paddingTop) - sortableOwnershipPolicy.settingsHeaderPadding) <= 0.5
      && Math.abs(Number.parseFloat(railStyle.borderTopWidth) - 1) <= 0.5
      && Math.abs(Number.parseFloat(railStyle.borderTopLeftRadius) - 12) <= 0.5
      && Math.abs(Number.parseFloat(railStyle.fontSize) - sortableOwnershipPolicy.settingsFontSize) <= 0.5
      && Math.abs(Number.parseFloat(railStyle.lineHeight) - sortableOwnershipPolicy.settingsLineHeight) <= 0.5
      && directRailChildren.length > 0
      && directRailChildren.every((child) => Math.abs(child.getBoundingClientRect().height - sortableOwnershipPolicy.settingsHeaderInnerHeight) <= 1)
      && Boolean(content)
      && Math.abs((content?.getBoundingClientRect().top ?? 0) - railRect.bottom - sortableOwnershipPolicy.settingsContentGap) <= 1
    );
    if (!hasOperationsProjectionRhythm) {
      addIssue(issues, "shared-sortable-ownership", "运营市场分类投影没有读取统一胶囊高度、字体、下间距或整类高亮。", "[data-shared-category-capsule='single']");
      break;
    }
  }

  const moduleCategoryPolicy = RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.moduleCategory;
  for (const moduleCategoryRow of visibleElements(root, "[data-responsive-capacity-row='module-category']")) {
    const shell = moduleCategoryRow.closest<HTMLElement>(".product-module-category-header-shell");
    const content = shell?.querySelector<HTMLElement>(":scope > .product-module-category-header-card > .product-module-card-content");
    const operation = moduleCategoryRow.querySelector<HTMLElement>(".product-module-category-operation-grid");
    const sortRail = moduleCategoryRow.querySelector<HTMLElement>("[data-shared-product-market-category-sort-rail]");
    const moveRail = moduleCategoryRow.querySelector<HTMLElement>("[data-shared-sort-move-rail]");
    const drag = moduleCategoryRow.querySelector<HTMLElement>("[data-content-plugin-control='drag']");
    const moveUp = moduleCategoryRow.querySelector<HTMLElement>("[data-content-plugin-control='move-up']");
    const moveDown = moduleCategoryRow.querySelector<HTMLElement>("[data-content-plugin-control='move-down']");
    const orderSegment = moduleCategoryRow.querySelector<HTMLElement>("[data-shared-product-market-category-order-segment]");
    const title = moduleCategoryRow.querySelector<HTMLElement>("[data-product-market-module-category-heading]");
    const name = title?.querySelector<HTMLElement>("[data-shared-product-market-category-name]");
    const status = moduleCategoryRow.querySelector<HTMLElement>("[data-content-plugin-actions='status']");
    if (!shell || !content || !operation || !sortRail || !orderSegment || !title || !name || !status) {
      addIssue(issues, "module-category-capacity", "分类栏缺少共享排序、两位排号、名称或状态功能组。", "[data-responsive-capacity-row='module-category']");
      break;
    }
    const shellRect = shell.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const operationRect = operation.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const statusRect = status.getBoundingClientRect();
    const fixed = operation.classList.contains("product-module-category-operation-grid-fixed");
    const directChildren = Array.from(sortRail.children);
    const chainNodes = fixed
      ? [orderSegment, title, status]
      : [moveRail, orderSegment, title, status];
    const chainIndexes = chainNodes.map((node) => directChildren.indexOf(node as Element));
    const chainOrdered = chainIndexes.every((index, position) => index >= 0 && (position === 0 || index > chainIndexes[position - 1]));
    const categoryContractRoot = shell.querySelector<HTMLElement>("[data-shared-product-market-category-order]");
    const categoryRailRect = categoryContractRoot?.getBoundingClientRect();
    const categoryRailStyle = categoryContractRoot ? getComputedStyle(categoryContractRoot) : null;
    const expectedCategoryContentWidth = categoryRailRect
      ? categoryRailRect.width
        - Number.parseFloat(categoryRailStyle?.paddingLeft || "0")
        - Number.parseFloat(categoryRailStyle?.paddingRight || "0")
        - Number.parseFloat(categoryRailStyle?.borderLeftWidth || "0")
        - Number.parseFloat(categoryRailStyle?.borderRightWidth || "0")
      : 0;
    const sharedOrder = categoryContractRoot?.dataset.sharedProductMarketCategoryOrder || "";
    const sharedLabel = categoryContractRoot?.dataset.sharedProductMarketCategoryLabel || "";
    const inlineMinimum = fixed ? moduleCategoryPolicy.inlineFixedMinimum : moduleCategoryPolicy.inlineReorderMinimum;
    const shellPosition = getComputedStyle(shell).position;
    const titleJustification = getComputedStyle(title).justifyContent;
    const operationJustification = getComputedStyle(operation).justifyContent;
    const firstSegmentRect = (fixed ? orderSegment : drag)?.getBoundingClientRect();
    const leftClustered = Boolean(firstSegmentRect)
      && Math.abs((firstSegmentRect?.left ?? 0) - operationRect.left) <= 2
      && statusRect.left >= titleRect.right - 1
      && (!fixed || statusRect.left - titleRect.right <= 12)
      && ["flex-start", "start"].includes(titleJustification)
      && ["flex-start", "start"].includes(operationJustification);
    if (
      shellRect.width <= 0
      || expectedCategoryContentWidth <= 0
      || Math.abs(contentRect.width - expectedCategoryContentWidth) > 2
      || moduleCategoryRow.scrollWidth > moduleCategoryRow.clientWidth + 1
      || operationRect.bottom > shellRect.bottom + 1
      || operationRect.top < shellRect.top - 1
      || titleRect.width <= 0
      || titleRect.height <= 0
      || !chainOrdered
      || (!fixed && (!moveRail || !drag || !moveUp || !moveDown))
      || orderSegment.textContent?.trim() !== sharedOrder
      || sharedLabel !== `${sharedOrder}.${name.textContent?.trim() || ""}`
    ) {
      addIssue(issues, "module-category-capacity", "分类共享控制链顺序不完整，或名称承载区发生宽度塌缩、越界和高度裁切。", ".product-module-category-header-shell");
      break;
    }
    if (["sticky", "fixed"].includes(shellPosition)) {
      addIssue(issues, "module-category-capacity", "栏目配置分类栏仍在吸顶或固定，滚动时会遮挡后续内容。", ".product-module-category-header-shell");
      break;
    }
    if (shellRect.width >= inlineMinimum && (Math.abs(titleRect.top - statusRect.top) > 2 || !leftClustered)) {
      addIssue(issues, "module-category-capacity", "分类栏有足够容量时名称与状态没有靠左紧凑同行。", ".product-module-category-operation-grid");
      break;
    }
  }

  const productMarketCategoryPolicy = RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.productMarketCategories;
  for (const category of visibleElements(root, "[data-product-market-category-group][data-shared-product-market-category-contract]")) {
    const key = category.dataset.sharedProductMarketCategoryKey;
    const order = category.dataset.sharedProductMarketCategoryOrder || "";
    const label = category.dataset.sharedProductMarketCategoryLabel || "";
    const source = category.dataset.sharedProductMarketCategorySource;
    const iconPolicy = category.dataset.sharedProductMarketCategoryIconPolicy;
    const ownershipKey = category.dataset.sharedOwnershipKey;
    const categoryIcons = Array.from(category.querySelectorAll<HTMLElement>("[data-shared-product-market-category-icon]"));
    if (
      category.dataset.sharedProductMarketCategoryContract !== productMarketCategoryPolicy.plugin
      || !key
      || key !== category.dataset.productMarketCategoryKey
      || !/^\d{2}$/u.test(order)
      || (key !== "uncategorized" && !label.startsWith(`${order}.`))
      || ownershipKey !== `category:${key}`
      || !category.hasAttribute("data-shared-ownership-category-target")
      || (iconPolicy === "customer-service-select-expert" && (
        categoryIcons.length !== 1
        || categoryIcons[0].dataset.sharedProductMarketCategoryIcon !== key
        || categoryIcons[0].dataset.sharedProductMarketCategoryIconSource !== "customer-service-select-expert"
      ))
    ) {
      addIssue(issues, "product-market-shared-categories", "产品市场分类缺少与栏目配置一致的键、两位顺序、名称或共享契约版本。", "[data-shared-product-market-category-contract]");
      break;
    }
    if (source !== "operations") continue;
    const rail = category.querySelector<HTMLElement>("[data-shared-product-market-category-rail='operations']");
    const statusCluster = rail?.querySelector<HTMLElement>("[data-product-market-category-status-cluster]");
    const categoryLabel = statusCluster?.querySelector<HTMLElement>("[data-product-market-category-label]");
    const statusActions = rail?.querySelector<HTMLElement>("[data-product-market-category-status-actions]");
    const statusGroup = statusActions?.querySelector<HTMLElement>("[data-content-plugin-actions='status']");
    const statusButtons = Array.from(statusGroup?.querySelectorAll<HTMLElement>("button[data-status]") || []);
    const cards = visibleElements(category, "[data-product-market-card]");
    const ownershipCardsValid = cards.every((card) => card.dataset.sharedOwnershipKey?.startsWith("module:") && card.dataset.sharedCategoryKey === key);
    const cardStatuses = cards.map((card) => card.dataset.sharedStatusCard || "");
    const uniformStatus = cardStatuses.length > 0 && cardStatuses.every((status) => status === cardStatuses[0])
      ? cardStatuses[0]
      : "";
    const expectedMixed = cards.length > 0 && !uniformStatus;
    const displayedStatus = statusActions?.dataset.productMarketCategoryStatus || "";
    const activeButton = statusButtons.find((button) => button.classList.contains("is-active"));
    if (
      !rail
      || !ownershipCardsValid
      || !statusCluster
      || !categoryLabel
      || !statusActions
      || !statusGroup
      || statusButtons.map((button) => button.dataset.status).join(",") !== "active,inactive,hidden"
      || Number(statusActions.dataset.productMarketCategoryStatusTotal ?? -1) !== cards.length
      || statusActions.dataset.productMarketCategoryStatusMixed !== String(expectedMixed)
      || displayedStatus !== (expectedMixed ? "inactive" : uniformStatus)
      || activeButton?.dataset.status !== displayedStatus
      || categoryLabel.nextElementSibling !== statusActions
      || rail.querySelector("[data-product-market-category-select-all]")
      || rail.scrollWidth > rail.clientWidth + productMarketCategoryPolicy.measurementTolerance
    ) {
      addIssue(issues, "product-market-shared-categories", "运营市场分类状态行未复用开通、取消、隐藏三个真实按钮，未映射本分类卡片状态，或出现横向溢出。", "[data-product-market-category-status-actions]");
      break;
    }
  }

  const layoutSectionEditorPolicy = RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.layoutSectionEditor;
  for (const row of visibleElements(root, "[data-shared-layout-section-editor-capsule='single']")) {
    const card = row.closest<HTMLElement>("[data-responsive-structure-item='layout-section']");
    const controls = row.querySelector<HTMLElement>("[data-layout-section-editor-segment='controls']");
    const title = row.querySelector<HTMLElement>("[data-layout-section-editor-segment='title']");
    const description = row.querySelector<HTMLElement>("[data-layout-section-editor-segment='description']");
    const inputs = visibleElements(row, "input[data-layout-large-card-input='true']") as HTMLInputElement[];
    if (!card || !controls || !title || !description || inputs.length !== 2) {
      addIssue(issues, "layout-section-editor-capsule", "版面风格栏目缺少操作、标题或说明语义分段。", "[data-shared-layout-section-editor-capsule]");
      break;
    }
    const rowStyle = getComputedStyle(row);
    const controlsStyle = getComputedStyle(controls);
    const inputStyles = inputs.map((input) => getComputedStyle(input));
    const segmentRects = [controls, title, description].map((segment) => segment.getBoundingClientRect());
    const controlsDividerCount = [controlsStyle.borderRightWidth, controlsStyle.borderBottomWidth]
      .filter((width) => Number.parseFloat(width) > 0).length;
    const ownsSingleOuterCapsule = Number.parseFloat(rowStyle.borderTopWidth) > 0
      && Number.parseFloat(rowStyle.borderTopLeftRadius) > 0
      && controlsStyle.borderTopWidth === "0px"
      && controlsStyle.borderLeftWidth === "0px"
      && controlsStyle.borderTopLeftRadius === "0px"
      && controlsDividerCount === 1
      && inputStyles.every((style) => style.borderTopWidth === "0px" && style.borderTopLeftRadius === "0px" && style.backgroundColor === "rgba(0, 0, 0, 0)");
    const segmentsInline = Math.max(...segmentRects.map((rect) => rect.top)) - Math.min(...segmentRects.map((rect) => rect.top)) <= 2;
    if (
      !ownsSingleOuterCapsule
      || row.scrollWidth > row.clientWidth + 1
      || segmentRects.some((rect) => rect.width <= 0 || rect.height <= 0)
      || (card.getBoundingClientRect().width >= layoutSectionEditorPolicy.inlineMinimum && !segmentsInline)
    ) {
      addIssue(issues, "layout-section-editor-capsule", "版面风格没有保持单一外层栏目胶囊，或三个内容分段发生粘连／溢出。", "[data-shared-layout-section-editor-capsule]");
      break;
    }
  }

  const serviceExpertPolicy = RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.serviceExperts;
  for (const grid of visibleElements(root, "[data-responsive-capacity-grid='service-experts']")) {
    const cards = visibleElements(grid, ":scope > [data-responsive-structure-item='expert']");
    if (cards.length === 0) continue;
    const gridRect = grid.getBoundingClientRect();
    const cardRects = cards.map((card) => card.getBoundingClientRect());
    const columnLefts: number[] = [];
    for (const cardRect of cardRects) {
      if (!columnLefts.some((left) => Math.abs(left - cardRect.left) <= 2)) columnLefts.push(cardRect.left);
    }
    const expectedColumns = resolveServiceExpertColumnCount(gridRect.width, cards.length);
    const firstRow = cardRects.filter((cardRect) => Math.abs(cardRect.top - cardRects[0].top) <= 2);
    const equalFirstRowWidths = firstRow.length < 2 || Math.max(...firstRow.map((cardRect) => cardRect.width)) - Math.min(...firstRow.map((cardRect) => cardRect.width)) <= 1;
    if (
      grid.scrollWidth > grid.clientWidth + 1
      || columnLefts.length !== expectedColumns
      || !equalFirstRowWidths
    ) {
      addIssue(issues, "service-expert-capacity", "客服专家列表没有按内容容量保持不设上限的等宽自动卡片。", "[data-responsive-capacity-grid='service-experts']");
      break;
    }
    const currentLayout = root.querySelector<HTMLElement>("[data-current-expert-voice-layout]");
    const currentCard = root.querySelector<HTMLElement>('[data-current-expert-avatar-preview="true"]');
    if (currentLayout && currentCard && isVisible(currentLayout) && isVisible(currentCard)) {
      const currentCardRect = currentCard.getBoundingClientRect();
      const selectionMedia = cards[0].querySelector<HTMLElement>(".shared-expert-identity-avatar-media");
      const selectionMediaRect = selectionMedia?.getBoundingClientRect();
      const selectionMediaContent = selectionMedia?.querySelector<HTMLElement>("img, video");
      const currentMedia = currentCard.querySelector<HTMLElement>(".shared-expert-identity-avatar-media");
      const currentMediaRect = currentMedia?.getBoundingClientRect();
      const currentMediaContent = currentMedia?.querySelector<HTMLElement>("img, video");
      const currentColumnCount = getComputedStyle(currentLayout).gridTemplateColumns.split(/\s+/u).filter(Boolean).length;
      const currentCardStyle = getComputedStyle(currentCard);
      const ownsCurrentCapacity = currentLayout.dataset.currentExpertCapacityContract === "selection-card-auto-fit-v1";
      const currentCardMatchesSelection = Math.abs(currentCardRect.width - cardRects[0].width) <= 1
        && Math.abs(currentCardRect.height - cardRects[0].height) <= 4;
      const selectionAvatarIsSquare = Boolean(selectionMediaRect && Math.abs(selectionMediaRect.width - selectionMediaRect.height) <= 1);
      const currentAvatarIsSquare = Boolean(currentMediaRect && Math.abs(currentMediaRect.width - currentMediaRect.height) <= 1);
      const avatarsShareSize = Boolean(selectionMediaRect && currentMediaRect && Math.abs(selectionMediaRect.width - currentMediaRect.width) <= 1);
      const selectionMediaUsesCover = !selectionMediaContent || getComputedStyle(selectionMediaContent).objectFit === "cover";
      const currentMediaUsesCover = !currentMediaContent || getComputedStyle(currentMediaContent).objectFit === "cover";
      if (
        !ownsCurrentCapacity
        || currentColumnCount !== columnLefts.length
        || !currentCardMatchesSelection
        || currentCardStyle.alignSelf !== "start"
        || currentCard.scrollWidth > currentCard.clientWidth + 1
        || !selectionAvatarIsSquare
        || !currentAvatarIsSquare
        || !avatarsShareSize
        || !selectionMediaUsesCover
        || !currentMediaUsesCover
      ) {
        addIssue(issues, "service-expert-capacity", "当前专家头像名片没有与选择专家共用 auto-fit 列宽、固有高度和正方形 cover 头像规则。", '[data-current-expert-capacity-contract="selection-card-auto-fit-v1"]');
        break;
      }
    }
  }

  const expectedLargeCardFontSize = normalizeCss(resolveSharedCssValue(documentRoot, "fontSize", "var(--tradepro-shared-large-card-font-size, 0.875rem)"));
  const expectedLargeCardFontWeight = normalizeCss(resolveSharedCssValue(documentRoot, "fontWeight", "var(--tradepro-shared-large-card-font-weight, 400)"));
  const expectedLargeCardBackground = normalizeCss(resolveSharedCssValue(documentRoot, "backgroundColor", "var(--tradepro-product-market-large-card-bg, #ffffff)"));
  const expectedLargeCardColor = normalizeCss(resolveSharedCssValue(documentRoot, "color", "var(--tradepro-product-market-large-card-text, #0f172a)"));
  const largeCardTexts = visibleElements(root, selectors.largeCardText);
  if (root.querySelector('[data-layout-fine-editor]')) {
    for (const card of visibleElements(root, '.layout-section-card[data-development-standard-frame-region="large-card"]')) {
      const style = getComputedStyle(card);
      if (
        normalizeCss(style.backgroundColor) !== expectedLargeCardBackground
        || normalizeCss(style.color) !== expectedLargeCardColor
        || normalizeCss(style.fontFamily) !== expectedFont
        || normalizeCss(style.fontSize) !== expectedLargeCardFontSize
        || normalizeCss(style.fontWeight) !== expectedLargeCardFontWeight
      ) {
        addIssue(issues, "large-card-typography", "版面风格大卡片没有读取大卡片专属底色、字体色或字号。", '.layout-section-card[data-development-standard-frame-region="large-card"]');
        break;
      }
      if (card.querySelectorAll(selectors.largeCardText).length < 2) {
        addIssue(issues, "large-card-typography", "版面风格大卡片没有登记标题和说明的共享字体作用域。", selectors.largeCardText);
        break;
      }
      const inputs = Array.from(card.querySelectorAll<HTMLInputElement>(selectors.largeCardInput));
      if (inputs.length < 2) {
        addIssue(issues, "large-card-typography", "版面风格大卡片没有登记标题和说明输入框的共享对比色。", selectors.largeCardInput);
        break;
      }
      for (const input of inputs) {
        const inputStyle = getComputedStyle(input);
        const expectedInputColor = normalizeCss(resolveScopedCssValue(input, "color", "var(--tradepro-product-market-large-card-text, #0f172a)"));
        if (
          normalizeCss(inputStyle.color) !== expectedInputColor
          || Number.parseFloat(inputStyle.opacity) < 1
          || normalizeCss(inputStyle.backgroundColor) === "rgb(255, 255, 255)"
        ) {
          addIssue(issues, "large-card-typography", "版面风格大卡片输入文字没有读取大卡片字体色，或仍使用低对比白底。", selectors.largeCardInput);
          break;
        }
      }
    }
  }
  if (root.querySelector('[data-page-content-kind="banner"]')) {
    for (const card of root.querySelectorAll<HTMLElement>('[data-page-content-kind="banner"] [data-development-standard-frame-region="large-card"]')) {
      if (card.querySelectorAll('[data-shared-large-card-text]').length < 3) {
        addIssue(issues, "large-card-typography", "首页大图的大卡片没有完整登记名称、状态和链接文字。", selectors.largeCardText);
        break;
      }
    }
  }
  const expectedLargeCardBorder = normalizeCss(resolveSharedCssValue(documentRoot, "borderColor", "color-mix(in srgb, var(--tradepro-product-market-large-card-text, #0f172a) 18%, transparent)"));
  const largeCardSurfaces = visibleElements(root, "[data-shared-large-card-surface='true']");
  if (root.querySelector("[data-product-market-workspace]") && !largeCardSurfaces.length) {
    addIssue(issues, "large-card-typography", "当前页面没有登记完整的大卡片表面。", "[data-shared-large-card-surface]");
  }
  for (const surface of largeCardSurfaces) {
    const style = getComputedStyle(surface);
    const ownsLayoutStyleCardTokens = surface.dataset.sharedCardTokenSource === "layout-style";
    const scopedLargeCardBackground = normalizeCss(resolveScopedCssValue(surface, "backgroundColor", "var(--tradepro-product-market-large-card-bg, #ffffff)"));
    const scopedLargeCardColor = normalizeCss(resolveScopedCssValue(surface, "color", "var(--tradepro-product-market-large-card-text, #0f172a)"));
    const scopedLargeCardBorder = normalizeCss(resolveScopedCssValue(surface, "borderColor", "color-mix(in srgb, var(--tradepro-product-market-large-card-text, #0f172a) 18%, transparent)"));
    if (
      normalizeCss(style.backgroundColor) !== scopedLargeCardBackground
      || normalizeCss(style.color) !== scopedLargeCardColor
      || normalizeCss(style.borderColor) !== scopedLargeCardBorder
      || (ownsLayoutStyleCardTokens && (
        normalizeCss(style.fontFamily) !== expectedFont
        || normalizeCss(style.fontSize) !== expectedLargeCardFontSize
        || normalizeCss(style.fontWeight) !== expectedLargeCardFontWeight
      ))
    ) {
      addIssue(issues, "large-card-typography", "大卡片完整容器没有读取大卡片的底色、字体或边框契约。", "[data-shared-large-card-surface]");
      break;
    }
  }
  const layoutSortableCarriers = visibleElements(root, ".layout-section-card .layout-section-matrix-function");
  for (const carrier of layoutSortableCarriers) {
    const style = getComputedStyle(carrier);
    const dividerWidths = [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth]
      .map((width) => Number.parseFloat(width));
    const hasSingleSemanticDivider = dividerWidths.filter((width) => Math.abs(width - 1) <= 0.01).length === 1
      && dividerWidths.every((width) => Math.abs(width) <= 0.01 || Math.abs(width - 1) <= 0.01);
    if (
      normalizeCss(style.backgroundColor) !== "rgba(0, 0, 0, 0)"
      || !hasSingleSemanticDivider
      || Number.parseFloat(style.borderRadius) !== 0
      || normalizeCss(style.boxShadow) !== "none"
    ) {
      addIssue(issues, "large-card-typography", "版面风格的排序外壳直系 carrier 没有保持透明、无边框、无阴影。", ".layout-section-matrix-function");
      break;
    }
  }
  const serviceLargeCardRails = visibleElements(root, "[data-shared-service-section-large-card='true']");
  for (const rail of serviceLargeCardRails) {
    const interactiveOwner = rail.closest<HTMLElement>("[data-shared-sortable-card]");
    if (interactiveOwner?.matches(":hover, :focus-within")) continue;
    const style = getComputedStyle(rail);
    if (
      normalizeCss(style.backgroundColor) !== expectedLargeCardBackground
      || normalizeCss(style.color) !== expectedLargeCardColor
      || normalizeCss(style.borderColor) !== expectedLargeCardBorder
    ) {
      addIssue(issues, "large-card-typography", "客服音效大卡片轨道的静止态没有读取大卡片底色、字体或边框契约。", "[data-shared-service-section-large-card]");
      break;
    }
  }
  for (const orderSelector of [
    ".layout-section-card .content-plugin-sort-toolbar [data-content-plugin-control='order']",
    ".template-config-service-section .content-plugin-sort-toolbar [data-content-plugin-control='order']",
  ]) {
    const orderBadges = visibleElements(root, orderSelector);
    if (!orderBadges.length) continue;
    const isAscending = orderBadges.every((badge, index) =>
      badge.dataset.contentPluginOrderSequence === "ascending"
      && badge.textContent?.trim() === String(index + 1).padStart(2, "0")
    );
    if (!isAscending) {
      addIssue(issues, "plugin-geometry", "版面风格与客服音效的排号必须从 01 起按页面顺序递增。", orderSelector);
      break;
    }
  }
  // 分类栏是大卡片内的紧凑导航轨道：默认无外框，悬停时才显示辅助底色。
  // 因此只校验它继承大卡片字体，而不把它误判为第二张大卡片。
  for (const rail of visibleElements(root, "[data-shared-category-rail='true']")) {
    if (normalizeCss(getComputedStyle(rail).color) !== expectedLargeCardColor) {
      addIssue(issues, "large-card-typography", "栏目配置分类轨道没有读取大卡片字体契约。", "[data-shared-category-rail]");
      break;
    }
  }
  for (const text of largeCardTexts) {
    const style = getComputedStyle(text);
    if (normalizeCss(style.fontFamily) !== expectedFont || normalizeCss(style.fontSize) !== expectedLargeCardFontSize || normalizeCss(style.fontWeight) !== expectedLargeCardFontWeight) {
      addIssue(issues, "large-card-typography", `大卡片正文 ${style.fontSize}/${style.fontWeight} 没有读取共享值 ${expectedLargeCardFontSize}/${expectedLargeCardFontWeight}。`, selectors.largeCardText);
      break;
    }
  }

  const expectedSmallCardBackground = normalizeCss(resolveSharedCssValue(documentRoot, "backgroundColor", "var(--tradepro-panel-card-bg, #ffffff)"));
  const expectedSmallCardColor = normalizeCss(resolveSharedCssValue(documentRoot, "color", "var(--tradepro-panel-card-text, #0f172a)"));
  const expectedSelectedSmallCardBackground = normalizeCss(resolveSharedCssValue(documentRoot, "backgroundColor", `var(${SHARED_SELECTION_SURFACE_CONTRACT.backgroundToken})`));
  const expectedSelectedSmallCardColor = normalizeCss(resolveSharedCssValue(documentRoot, "color", `var(${SHARED_SELECTION_SURFACE_CONTRACT.textToken})`));
  const expectedSelectedSmallCardOutline = normalizeCss(resolveSharedCssValue(documentRoot, "borderColor", `var(${SHARED_SELECTION_SURFACE_CONTRACT.outlineToken})`));
  const expectedSmallCardFontSize = normalizeCss(resolveSharedCssValue(documentRoot, "fontSize", "var(--tradepro-shared-small-card-font-size, 0.75rem)"));
  const expectedSmallCardFontWeight = normalizeCss(resolveSharedCssValue(documentRoot, "fontWeight", "var(--tradepro-shared-small-card-font-weight, 400)"));
  const effectiveSmallCardSurfaceSelector = `:is([data-shared-card-token-source="layout-style"][data-shared-small-card-surface="true"], [${SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE}="true"])`;
  for (const surface of visibleElements(root, effectiveSmallCardSurfaceSelector)) {
    if (surface.dataset.sharedLargeCardSurface === "true") {
      addIssue(issues, "small-card-typography", "同一个组件不能同时登记为大卡片和有效小卡片。", `[${SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE}="true"]`);
      break;
    }
    const style = getComputedStyle(surface);
    const isSelected = isSharedSelectionSurfaceActive(surface);
    const usesStatusCardSource = surface.dataset.sharedStatusCardSource === "product-card-colors";
    if (surface.dataset.selected === "true" && surface.dataset.sharedSelectionControl !== "true") {
      addIssue(issues, "small-card-typography", "选中小卡片缺少共享选中态语义，开发器与无障碍状态无法同步。", `[${SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE}="true"][data-selected="true"]`);
      break;
    }
    if (
      (!usesStatusCardSource && (
        normalizeCss(style.backgroundColor) !== (isSelected ? expectedSelectedSmallCardBackground : expectedSmallCardBackground)
        || normalizeCss(style.color) !== (isSelected ? expectedSelectedSmallCardColor : expectedSmallCardColor)
        || (isSelected && normalizeCss(style.borderColor) !== expectedSelectedSmallCardOutline)
      ))
      || normalizeCss(style.fontFamily) !== expectedFont
      || normalizeCss(style.fontSize) !== expectedSmallCardFontSize
      || normalizeCss(style.fontWeight) !== expectedSmallCardFontWeight
    ) {
      addIssue(issues, "small-card-typography", "共享小卡片没有按选中状态读取版面风格的底色、字体色、边框或字号。", '[data-shared-card-token-source="layout-style"][data-shared-small-card-surface="true"]');
      break;
    }
  }
  const smallCardTexts = visibleElements(root, selectors.smallCardText);
  if (root.querySelector('[data-template-module-table-header="true"]')) {
    for (const card of visibleElements(root, '[data-development-standard-frame-region="small-card"]')) {
      if (!card.querySelector(selectors.smallCardText)) {
        addIssue(issues, "small-card-typography", "栏目配置的小卡片没有登记共享字体作用域。", selectors.smallCardText);
        break;
      }
    }
  }
  if (root.querySelector('[data-layout-fine-editor]')) {
    const editor = root.querySelector<HTMLElement>('[data-layout-fine-editor-contract="two-pane"]');
    const preview = editor?.querySelector<HTMLElement>('[data-layout-fine-preview]');
    const controls = editor?.querySelector<HTMLElement>('[data-layout-fine-controls][data-layout-settings-pane="true"]');
    if (!editor || !preview || !controls) {
      addIssue(issues, "semantic-regions", "版面风格缺少共享的预览／设置双栏契约。", '[data-layout-fine-editor-contract="two-pane"]');
    } else {
      const controlsStyle = getComputedStyle(controls);
      const dividerStyle = getComputedStyle(editor, "::before");
      const previewRect = preview.getBoundingClientRect();
      const controlsRect = controls.getBoundingClientRect();
      if (controlsStyle.borderTopWidth !== "0px" || controlsStyle.borderRadius !== "0px" || controlsStyle.backgroundColor !== "rgba(0, 0, 0, 0)") {
        addIssue(issues, "semantic-regions", "版面风格右侧设置栏仍绘制了独立外框。", '[data-layout-fine-controls]');
      }
      if (dividerStyle.display === "none" || Number.parseFloat(dividerStyle.width) < 1) {
        addIssue(issues, "semantic-regions", "版面风格预览与设置栏之间缺少共享中线。", '[data-layout-fine-editor-contract="two-pane"]');
      }
      if (Math.abs(previewRect.top - controlsRect.top) > 1 || Math.abs(previewRect.bottom - controlsRect.bottom) > 1) {
        addIssue(issues, "semantic-regions", "版面风格预览与右侧设置栏没有对齐。", '[data-layout-fine-editor-contract="two-pane"]');
      }
    }
  }
  for (const text of smallCardTexts) {
    const style = getComputedStyle(text);
    const selectionOwner = text.closest<HTMLElement>(`[${SHARED_SELECTION_SURFACE_CONTRACT.controlAttribute}="true"]`);
    const expectedTextColor = selectionOwner && isSharedSelectionSurfaceActive(selectionOwner)
      ? expectedSelectedSmallCardColor
      : expectedSmallCardColor;
    if (
      normalizeCss(style.color) !== expectedTextColor
      || normalizeCss(style.fontFamily) !== expectedFont
      || normalizeCss(style.fontSize) !== expectedSmallCardFontSize
      || normalizeCss(style.fontWeight) !== expectedSmallCardFontWeight
    ) {
      addIssue(issues, "small-card-typography", `小卡片正文 ${style.color}/${style.fontSize}/${style.fontWeight} 没有读取共享值 ${expectedTextColor}/${expectedSmallCardFontSize}/${expectedSmallCardFontWeight}。`, selectors.smallCardText);
      break;
    }
  }
  for (const serviceControl of visibleElements(root, '[data-template-config-service-control="true"][data-shared-small-card-surface="true"]')) {
    const style = getComputedStyle(serviceControl);
    if (
      normalizeCss(style.backgroundColor) !== expectedSmallCardBackground
      || normalizeCss(style.color) !== expectedSmallCardColor
    ) {
      addIssue(issues, "small-card-typography", "客服音效顶部控制卡没有读取版面风格的小卡片底色与字体。", '[data-template-config-service-control][data-shared-small-card-surface]');
      break;
    }
  }
  for (const status of visibleElements(root, '[data-customer-service-avatar-status]')) {
    const style = getComputedStyle(status);
    if (
      normalizeCss(style.backgroundColor) !== expectedSmallCardBackground
      || normalizeCss(style.color) !== expectedSmallCardColor
    ) {
      addIssue(issues, "small-card-typography", "客服音效的动画／朗读状态没有读取小卡片底色与正文色。", '[data-customer-service-avatar-status]');
      break;
    }
  }
  for (const preview of visibleElements(root, '[data-shared-small-card-surface="true"].template-config-service-avatar-preview')) {
    const style = getComputedStyle(preview);
    if (
      normalizeCss(style.backgroundColor) !== expectedSmallCardBackground
      || normalizeCss(style.color) !== expectedSmallCardColor
    ) {
      addIssue(issues, "small-card-typography", "客服音效当前专家预览没有读取小卡片底色与正文色。", '[data-shared-small-card-surface].template-config-service-avatar-preview');
      break;
    }
  }
  for (const summary of visibleElements(root, '[data-shared-expert-identity-summary="editor"]')) {
    const style = getComputedStyle(summary);
    if (normalizeCss(style.color) !== expectedSmallCardColor || !summary.querySelector('.shared-expert-identity-behavior')) {
      addIssue(issues, "small-card-typography", "Customer Service expert identity summary is missing its shared small-card text contract.", '[data-shared-expert-identity-summary="editor"]');
      break;
    }
  }
  for (const summary of visibleElements(root, '[data-shared-expert-identity-summary]')) {
    const nameNodes = Array.from(summary.querySelectorAll<HTMLElement>("[data-shared-expert-text-name]"));
    const valueNodes = Array.from(summary.querySelectorAll<HTMLElement>("[data-shared-expert-text-value]"));
    const textNodes = [...nameNodes, ...valueNodes];
    const ownsEllipsisContract = summary.dataset.sharedExpertTextOverflowContract === "single-line-ellipsis-v1";
    const ownsSelectionCopyContract = summary.dataset.sharedExpertIdentitySummary !== "small"
      || summary.dataset.sharedExpertSmallCopyContract === CUSTOMER_SERVICE_EXPERT_CONTENT_CONTRACT.selectionCopy;
    const usesCompactCopy = summary.dataset.sharedExpertCompactCopy === "true";
    const compactCopyIsCompact = !usesCompactCopy
      || (nameNodes.every((node) => Array.from(node.textContent || "").length <= 7)
        && valueNodes.every((node) => {
          const field = node.closest<HTMLElement>("[data-shared-expert-field]")?.dataset.sharedExpertField;
          const characterLimit = field === "voice" ? 7 : 4;
          return Array.from(node.textContent || "").length <= characterLimit;
        }));
    const textStylesAreSafe = textNodes.length > 0 && textNodes.every((node) => {
      const style = getComputedStyle(node);
      return style.overflow === "hidden" && style.textOverflow === "ellipsis" && style.whiteSpace === "nowrap";
    });
    const identityFields = Array.from(summary.querySelectorAll<HTMLElement>(".shared-expert-identity-core > [data-shared-expert-field]"))
      .map((node) => node.dataset.sharedExpertField || "");
    const ownsContentRoot = summary.dataset.sharedCustomerServiceExpertContentSource === CUSTOMER_SERVICE_EXPERT_CONTENT_CONTRACT.source;
    const ownsIdentityOrder = identityFields.join("|") === CUSTOMER_SERVICE_EXPERT_CONTENT_CONTRACT.identityFields.join("|");
    const ownsLayoutContract = summary.dataset.sharedExpertLayoutContract === CUSTOMER_SERVICE_EXPERT_CONTENT_CONTRACT.layout;
    if (!ownsContentRoot || !ownsIdentityOrder || !ownsLayoutContract) {
      addIssue(issues, "service-expert-content-root", "客服专家摘要没有读取当前专家真人朗音自定义单根，或左列性别、头衔、动画顺序发生漂移。", '[data-shared-customer-service-expert-content-source="current-expert-voice-customization"]');
      break;
    }
    if (summary.dataset.sharedExpertIdentitySummary === "editor") {
      const avatar = summary.querySelector<HTMLElement>(".shared-expert-identity-avatar");
      const facts = summary.querySelector<HTMLElement>(".shared-expert-identity-core");
      const summaryRect = summary.getBoundingClientRect();
      const avatarRect = avatar?.getBoundingClientRect();
      const factsRect = facts?.getBoundingClientRect();
      const behaviorRect = summary.querySelector<HTMLElement>(".shared-expert-identity-behavior")?.getBoundingClientRect();
      const avatarCentreOffset = avatarRect
        ? Math.abs((avatarRect.left + avatarRect.width / 2) - (summaryRect.left + summaryRect.width / 2))
        : Number.POSITIVE_INFINITY;
      const factsGap = avatarRect && factsRect ? factsRect.top - avatarRect.bottom : Number.NEGATIVE_INFINITY;
      const factColumnsGap = factsRect && behaviorRect ? behaviorRect.left - factsRect.right : Number.NEGATIVE_INFINITY;
      const factRowsAreAligned = factsRect && behaviorRect ? Math.abs(factsRect.top - behaviorRect.top) <= 1 : false;
      const isCurrentExpertPreview = Boolean(summary.closest(".template-config-service-avatar-preview"));
      if (avatarCentreOffset > 1 || (isCurrentExpertPreview && (factsGap < 7 || factsGap > 9 || factColumnsGap < 7 || factColumnsGap > 9 || !factRowsAreAligned))) {
        addIssue(issues, "service-expert-content-root", "Current Expert editor must centre its avatar and keep its two four-row fact columns aligned with 8px gaps.", '[data-shared-expert-identity-summary="editor"]');
        break;
      }
    }
    if (!ownsEllipsisContract || !textStylesAreSafe || summary.scrollWidth - summary.clientWidth > 1) {
      addIssue(issues, "small-card-typography", "客服名称与招呼词没有读取共享单行省略契约，长文本可能撑宽专家卡片或弹窗。", '[data-shared-expert-text-overflow-contract="single-line-ellipsis-v1"]');
      break;
    }
    if (!ownsSelectionCopyContract || !compactCopyIsCompact) {
      addIssue(issues, "service-expert-capacity", "Expert compact copy is missing the seven-character and numbered-voice ellipsis contract.", '[data-shared-expert-identity-summary]');
      break;
    }
  }
  for (const projection of visibleElements(root, "[data-shared-customer-service-expert-projection]")) {
    if (projection.dataset.sharedCustomerServiceExpertContentSource !== CUSTOMER_SERVICE_EXPERT_CONTENT_CONTRACT.source) {
      addIssue(issues, "service-expert-content-root", "客服专家投影创建了第二份内容源。", "[data-shared-customer-service-expert-projection]");
      break;
    }
  }
  for (const expertCard of visibleElements(root, '[data-customer-service-expert-card="true"][data-shared-small-card-surface="true"]')) {
    const style = getComputedStyle(expertCard);
    const isSelected = isSharedSelectionSurfaceActive(expertCard);
    if (
      expertCard.dataset.sharedSelectionControl !== "true"
      || expertCard.getAttribute("aria-pressed") !== expertCard.dataset.selected
      || normalizeCss(style.backgroundColor) !== (isSelected ? expectedSelectedSmallCardBackground : expectedSmallCardBackground)
      || normalizeCss(style.color) !== (isSelected ? expectedSelectedSmallCardColor : expectedSmallCardColor)
      || (isSelected && normalizeCss(style.borderColor) !== expectedSelectedSmallCardOutline)
    ) {
      addIssue(issues, "small-card-typography", "客服音效的专家卡没有同步共享选中语义、底色、正文色与边框。", '[data-customer-service-expert-card][data-shared-small-card-surface]');
      break;
    }
  }
  for (const workspace of visibleElements(root, '[data-shared-expert-control-edge-contract="eight-pixel-inline-v1"]')) {
    const workspaceStyle = getComputedStyle(workspace);
    const edgeInset = workspaceStyle.getPropertyValue("--tradepro-shared-expert-control-edge-inset");
    const controlGap = workspaceStyle.getPropertyValue("--tradepro-shared-expert-control-gap");
    const serviceCardContent = workspace.closest<HTMLElement>(".template-config-service-card")?.querySelector<HTMLElement>(":scope > .space-y-2");
    const fields = visibleElements(workspace, ".template-config-service-voice-field");
    const controls = visibleElements(workspace, [
      '[data-customer-service-small-card-choice="true"]',
      '[data-customer-service-voice-clear="true"]',
      "[data-shared-expert-control-edge]",
      ".template-config-service-voice-status",
      'input:not([type="range"])',
    ].join(","));
    const gapOwners = visibleElements(workspace, [
      "[data-current-expert-voice-layout]",
      '[data-shared-expert-settings-stack="true"]',
      '[data-shared-expert-control-gap="true"]',
      ".template-config-service-field-pair",
      ".template-config-service-inline-control",
      ".template-config-service-voice-options",
      '[data-shared-responsive-wrap="service-animation-options"]',
    ].join(","));
    const unframedWrappers = visibleElements(workspace, [
      '[data-customer-service-gender-choices="true"] > div',
      '[data-customer-service-animation-options="true"] > div',
    ].join(","));
    const fieldsOwnEightPixelEdges = fields.every((field) => {
      const style = getComputedStyle(field);
      return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft]
        .every((value) => cssPixelsMatch(value, 8));
    });
    const controlsOwnEightPixelInlineEdges = controls.every((control) => {
      const style = getComputedStyle(control);
      return cssPixelsMatch(style.paddingLeft, 8) && cssPixelsMatch(style.paddingRight, 8);
    });
    const gapsOwnEightPixels = gapOwners.every((owner) => {
      const style = getComputedStyle(owner);
      return cssPixelsMatch(style.columnGap, 8) && cssPixelsMatch(style.rowGap, 8);
    });
    const wrappersDoNotDoubleInset = unframedWrappers.every((wrapper) => {
      const style = getComputedStyle(wrapper);
      return cssPixelsMatch(style.paddingLeft, 0) && cssPixelsMatch(style.paddingRight, 0);
    });
    const cardOwnsEightPixelInlineEdges = !serviceCardContent || (
      cssPixelsMatch(getComputedStyle(serviceCardContent).paddingLeft, 8)
      && cssPixelsMatch(getComputedStyle(serviceCardContent).paddingRight, 8)
    );
    if (
      !cssPixelsMatch(edgeInset, 8)
      || !cssPixelsMatch(controlGap, 8)
      || !fieldsOwnEightPixelEdges
      || !controlsOwnEightPixelInlineEdges
      || !gapsOwnEightPixels
      || !wrappersDoNotDoubleInset
      || !cardOwnsEightPixelInlineEdges
    ) {
      addIssue(issues, "service-expert-capacity", "Current Expert controls must share exact 8px field edges, inline control insets and gaps without an unframed double inset.", '[data-shared-expert-control-edge-contract="eight-pixel-inline-v1"]');
      break;
    }
  }
  for (const choice of visibleElements(root, '[data-customer-service-small-card-choice="true"]')) {
    const style = getComputedStyle(choice);
    if (
      normalizeCss(style.backgroundColor) !== expectedSmallCardBackground
      || normalizeCss(style.color) !== expectedSmallCardColor
    ) {
      addIssue(issues, "small-card-typography", "客服音效的性别与提醒声选择没有读取小卡片底色与正文色。", '[data-customer-service-small-card-choice]');
      break;
    }
  }
  for (const animationOptions of visibleElements(root, '[data-customer-service-animation-options="true"]')) {
    const style = getComputedStyle(animationOptions);
    if (
      normalizeCss(style.backgroundColor) !== expectedSmallCardBackground
      || normalizeCss(style.color) !== expectedSmallCardColor
    ) {
      addIssue(issues, "small-card-typography", "客服音效的动画效果容器没有读取小卡片底色与正文色。", '[data-customer-service-animation-options]');
      break;
    }
  }
  for (const toggleTrack of visibleElements(root, '[data-customer-service-shared-toggle="true"][data-state="enabled"] [data-content-plugin-toggle-track]')) {
    if (normalizeCss(getComputedStyle(toggleTrack).backgroundColor) !== "rgb(37, 99, 235)") {
      addIssue(issues, "plugin-state", "客服音效的开启开关没有读取共享蓝色状态。", '[data-customer-service-shared-toggle]');
      break;
    }
  }
  for (const serviceSlider of visibleElements(root, '[data-customer-service-shared-slider]')) {
    const track = serviceSlider.querySelector<HTMLElement>('[data-shared-slider-track="true"]');
    const range = serviceSlider.querySelector<HTMLElement>('[data-shared-slider-range="true"]');
    const thumb = serviceSlider.querySelector<HTMLElement>('[data-shared-slider-thumb="true"]');
    if (
      !track
      || !range
      || !thumb
      || normalizeCss(getComputedStyle(track).backgroundColor) !== "rgb(148, 163, 184)"
      || normalizeCss(getComputedStyle(range).backgroundColor) !== "rgb(37, 99, 235)"
      || normalizeCss(getComputedStyle(thumb).borderColor) !== "rgb(37, 99, 235)"
    ) {
      addIssue(issues, "plugin-state", "客服音效的音量或语速滑杆没有读取共享灰蓝轨道与蓝色开启状态。", '[data-customer-service-shared-slider]');
      break;
    }
  }
  const expectedExpertAvatarFrameColor = normalizeCss(resolveSharedCssValue(
    documentRoot,
    "borderColor",
    "var(--tradepro-shared-expert-avatar-frame-color)",
  ));
  for (const avatarFrame of visibleElements(root, [
    '[data-shared-expert-avatar-frame-contract="floating-service-v1"] .shared-expert-identity-avatar-media',
    '.ai-service-launcher[data-shared-expert-avatar-frame-contract="floating-service-v1"]',
    '[data-ai-service-avatar-greeting][data-shared-expert-avatar-frame-contract="floating-service-v1"]',
  ].join(", "))) {
    const style = getComputedStyle(avatarFrame);
    if (
      normalizeCss(style.borderColor) !== expectedExpertAvatarFrameColor
      || normalizeCss(style.borderWidth) !== "4px"
    ) {
      addIssue(issues, "small-card-typography", "当前专家、悬浮客服或聊天标题头像没有读取共享四像素头像框颜色。", '[data-shared-expert-avatar-frame-contract="floating-service-v1"]');
      break;
    }
  }
  for (const serviceCard of visibleElements(root, ':is(.template-config-service-voice-field, .template-config-service-sound-choice, .template-config-service-sound-note)[data-shared-small-card-surface="true"]')) {
    const style = getComputedStyle(serviceCard);
    const isSelected = isSharedSelectionSurfaceActive(serviceCard);
    if (
      normalizeCss(style.backgroundColor) !== (isSelected ? expectedSelectedSmallCardBackground : expectedSmallCardBackground)
      || normalizeCss(style.color) !== (isSelected ? expectedSelectedSmallCardColor : expectedSmallCardColor)
      || (isSelected && normalizeCss(style.borderColor) !== expectedSelectedSmallCardOutline)
    ) {
      addIssue(issues, "small-card-typography", "客服音效的真人朗音字段或提醒声音选项没有按共享选中态读取小卡片底色、正文色与边框。", '[data-shared-small-card-surface].template-config-service-voice-field');
      break;
    }
  }

  for (const reminderSoundTrack of Array.from(root.querySelectorAll<HTMLElement>(
    '[data-customer-service-reminder-marker-scope="first-sound-card-left-top"]',
  ))) {
    const reminderSoundCards = visibleElements(reminderSoundTrack, '[data-customer-service-reminder-style][data-shared-small-card-surface="true"]');
    if (!reminderSoundCards.length) continue;
    const [representative, ...silentCards] = reminderSoundCards;
    const runtimeScope = findSharedSmallCardMarkerScope(representative);
    const runtimeCandidates = runtimeScope ? collectSharedSmallCardMarkerCandidates(runtimeScope) : [];
    const effectiveRepresentatives = runtimeCandidates.filter((card) => (
      card.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE) === "representative"
    ));
    const replaceAction = reminderSoundTrack.querySelector<HTMLElement>('[data-customer-service-reminder-replace="true"]');
    const markerStyle = getComputedStyle(representative, "::after");
    const markerTop = Number.parseFloat(markerStyle.top);
    const markerLeft = Number.parseFloat(markerStyle.left);
    if (
      representative.dataset.customerServiceReminderMarkerAnchor !== "first-sound-card-left-top"
      || representative.dataset.developmentStandardFrameRegion !== "small-card"
      || representative.dataset.developmentStandardMarkerPlacement !== "card-left-top"
      || markerStyle.position !== "absolute"
      || !Number.isFinite(markerTop)
      || !Number.isFinite(markerLeft)
      || markerTop < 0
      || markerTop > 8
      || markerLeft < 0
      || markerLeft > 8
      || normalizeCss(markerStyle.transform) !== "none"
      || !markerStyle.content.includes("小卡片")
      || silentCards.some((card) =>
        card.dataset.developmentStandardFrameRegion !== "small-card"
        || card.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE) !== "silent"
      )
      || replaceAction?.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE) !== "silent"
      || representative.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE) !== "representative"
      || effectiveRepresentatives.length !== 1
      || effectiveRepresentatives[0] !== representative
      || runtimeCandidates.some((card) => card !== representative && card.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE) !== "silent")
      || runtimeScope?.dataset.developmentStandardFrameRegion !== "large-card"
      || runtimeScope?.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE) !== SHARED_SMALL_CARD_AUTOMATIC_SCOPE
    ) {
      addIssue(issues, "context-markers", "专家出现消息发送时提醒声音没有把左上第一张声音卡登记为唯一代表小卡片，或标注没有停靠在该卡片左上角。", '[data-customer-service-reminder-marker-anchor="first-sound-card-left-top"]');
    }
  }

  for (const currentExpertLayout of Array.from(root.querySelectorAll<HTMLElement>('[data-current-expert-voice-layout]'))) {
    const currentExpertSmallCards = visibleElements(currentExpertLayout, '[data-development-standard-frame-region="small-card"][data-shared-small-card-surface="true"]');
    if (!currentExpertSmallCards.length) continue;
    const [representative, ...silentCards] = currentExpertSmallCards;
    const runtimeScope = findSharedSmallCardMarkerScope(representative);
    const runtimeCandidates = runtimeScope ? collectSharedSmallCardMarkerCandidates(runtimeScope) : [];
    const effectiveRepresentatives = runtimeCandidates.filter((card) => (
      card.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE) === "representative"
    ));
    const markerStyle = getComputedStyle(representative, "::after");
    const markerTop = Number.parseFloat(markerStyle.top);
    const markerLeft = Number.parseFloat(markerStyle.left);
    if (
      representative.dataset.currentExpertAvatarPreview !== "true"
      || representative.dataset.developmentStandardFrameRegion !== "small-card"
      || representative.dataset.developmentStandardMarkerPlacement !== "card-left-top"
      || markerStyle.position !== "absolute"
      || !Number.isFinite(markerTop)
      || !Number.isFinite(markerLeft)
      || markerTop < 0
      || markerTop > 8
      || markerLeft < 0
      || markerLeft > 8
      || normalizeCss(markerStyle.transform) !== "none"
      || !markerStyle.content.includes("小卡片")
      || silentCards.some((card) =>
        card.dataset.developmentStandardFrameRegion !== "small-card"
        || card.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE) !== "silent"
      )
      || representative.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE) !== "representative"
      || effectiveRepresentatives.length !== 1
      || effectiveRepresentatives[0] !== representative
      || runtimeCandidates.some((card) => card !== representative && card.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE) !== "silent")
      || runtimeScope?.dataset.developmentStandardFrameRegion !== "large-card"
      || runtimeScope?.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE) !== SHARED_SMALL_CARD_AUTOMATIC_SCOPE
      || currentExpertLayout.dataset.currentExpertCardMarkerScope !== "avatar-preview-first"
    ) {
      addIssue(issues, "context-markers", "当前专家真人朗音自定义没有把左侧专家头像预览登记为首张代表小卡片，或标注没有停靠在该卡片左上角。", '[data-current-expert-avatar-preview="true"]');
    }
  }

  const isSharedSmallCardMarkerRepresentative = (element: HTMLElement) => {
    const effectiveMarker = element.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE);
    if (effectiveMarker) return effectiveMarker === "representative";
    if (isSharedSmallCardMarkerCandidate(element)) {
      const scope = findSharedSmallCardMarkerScope(element);
      if (scope) return resolveSharedSmallCardMarkerRepresentative(scope) === element;
    }
    return element.dataset.developmentStandardMarker !== "silent";
  };
  const markerRegions = visibleElements(root, selectors.markers)
    .filter(isSharedSmallCardMarkerRepresentative);

  for (const markerScope of Array.from(root.querySelectorAll<HTMLElement>(SHARED_SMALL_CARD_MARKER_SCOPE_SELECTOR))) {
    const smallCards = collectSharedSmallCardMarkerCandidates(markerScope);
    if (!smallCards.length) continue;
    const expectedScopeMode = markerScope.matches(SHARED_SMALL_CARD_MARKER_AUTOMATIC_SCOPE_SELECTOR)
      ? SHARED_SMALL_CARD_AUTOMATIC_SCOPE
      : markerScope.matches(SHARED_SMALL_CARD_MARKER_DECLARED_SCOPE_SELECTOR)
        ? SHARED_SMALL_CARD_DECLARED_SCOPE
        : markerScope.matches(SHARED_SMALL_CARD_MARKER_ADAPTER_SCOPE_SELECTOR)
          ? SHARED_SMALL_CARD_ADAPTER_SCOPE
          : null;
    const expectedRepresentative = resolveSharedSmallCardMarkerRepresentative(markerScope);
    const effectiveRepresentatives = smallCards.filter((card) => (
      card.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE) === "representative"
    ));
    const effectiveSilentCards = smallCards.filter((card) => (
      card.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE) === "silent"
    ));
    if (
      !expectedRepresentative
      || !expectedScopeMode
      || markerScope.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE) !== expectedScopeMode
      || effectiveRepresentatives.length !== 1
      || effectiveRepresentatives[0] !== expectedRepresentative
      || effectiveSilentCards.length !== smallCards.length - 1
    ) {
      addIssue(issues, "context-markers", "共享契约没有把每个大卡片或适配分组的第一张真实小卡片同步为唯一可见标注。", '[data-shared-small-card-marker-scope-effective]');
      break;
    }
  }
  for (const group of Array.from(root.querySelectorAll<HTMLElement>(
    '[data-product-market-category-group][data-shared-product-market-category-source="modules"]',
  ))) {
    const rootCards = Array.from(group.querySelectorAll<HTMLElement>(
      '.product-module-root-card[data-development-standard-frame-region="small-card"]',
    ));
    if (!rootCards.length) continue;
    const representatives = rootCards.filter((card) => (
      card.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE) === "representative"
    ));
    if (
      representatives.length !== 1
      || representatives[0] !== rootCards[0]
      || rootCards.slice(1).some((card) => card.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE) !== "silent")
    ) {
      addIssue(issues, "context-markers", "栏目配置没有按共享运行结果把每个大卡片的第一张一级小卡片设为唯一代表标注。", '[data-shared-small-card-marker-scope-effective="automatic-large-card"]');
      break;
    }
  }
  for (const expandedShell of Array.from(root.querySelectorAll<HTMLElement>('[data-product-market-table-shell][data-product-market-table-header-mode="expanded"]'))) {
    if (!expandedShell.querySelector('[data-template-config-table-palette], [data-template-config-service-header]')) continue;
    const delegatedContent = expandedShell.querySelector<HTMLElement>('[data-page-list-scroll-owner][data-development-standard-frame-region="content"]');
    const firstCardContent = expandedShell.querySelector<HTMLElement>('[data-development-standard-frame-region="content"][data-development-standard-marker-placement="content-card-start"]');
    if (
      delegatedContent?.dataset.developmentStandardMarkerPlacement !== "content-delegated"
      || !firstCardContent
      || !firstCardContent.querySelector('[data-shared-large-card-surface="true"]')
    ) {
      addIssue(issues, "context-markers", "展开表头时，内容标注没有改为从首个大卡片开始。", '[data-development-standard-marker-placement="content-card-start"]');
      break;
    }
  }
  for (const scrollOwner of Array.from(root.querySelectorAll<HTMLElement>(
    '[data-product-market-scroll-list][data-development-standard-frame-region="content"]',
  ))) {
    const tableShell = scrollOwner.closest<HTMLElement>('[data-product-market-table-shell]');
    const tableHeader = tableShell?.querySelector<HTMLElement>(':scope > [data-product-market-table-header]') ?? null;
    const markerStyle = getComputedStyle(scrollOwner, "::after");
    const markerTop = Number.parseFloat(markerStyle.top);
    const tolerance = RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.measurementTolerance;
    const expectedGap = 8;
    const title2 = tableShell?.previousElementSibling?.matches('[data-product-market-theme-section]')
      ? tableShell.previousElementSibling as HTMLElement
      : null;
    const shellStyle = tableShell ? getComputedStyle(tableShell) : null;
    const scrollStyle = getComputedStyle(scrollOwner);
    const headerStyle = tableHeader ? getComputedStyle(tableHeader) : null;
    const title2ToHeaderGap = title2 && tableHeader
      ? tableHeader.getBoundingClientRect().top - title2.getBoundingClientRect().bottom
      : Number.NaN;
    const scrollStartAfterHeader = tableHeader
      ? scrollOwner.getBoundingClientRect().top - tableHeader.getBoundingClientRect().bottom
      : Number.NaN;
    if (
      scrollOwner.dataset.sharedScrollContentStart !== "after-table-header"
      || scrollOwner.dataset.developmentStandardMarkerPlacement !== "content-start"
      || tableShell?.dataset.developmentStandardSpacingContract !== "title-2-table-header-content-8"
      || !shellStyle
      || !tableHeader
      || tableHeader.parentElement !== tableShell
      || scrollOwner.parentElement !== tableShell
      || !headerStyle
      || !title2
      || Math.abs(Number.parseFloat(shellStyle.marginTop) - expectedGap) > tolerance
      || Number.parseFloat(shellStyle.paddingTop) > tolerance
      || Number.parseFloat(scrollStyle.rowGap) > tolerance
      || Math.abs(Number.parseFloat(scrollStyle.paddingTop) - expectedGap) > tolerance
      || Number.parseFloat(headerStyle.marginBottom) > tolerance
      || !Number.isFinite(markerTop)
      || Math.abs(markerTop - expectedGap) > tolerance
      || !Number.isFinite(title2ToHeaderGap)
      || Math.abs(title2ToHeaderGap - expectedGap) > tolerance
      || !Number.isFinite(scrollStartAfterHeader)
      || Math.abs(scrollStartAfterHeader) > tolerance
    ) {
      addIssue(
        issues,
        "context-markers",
        "运营市场必须与栏目配置一致：表头和滚动内容是表内框的直属兄弟区域，滚动条从表头下缘开始，首个内容保留 8px 共享节距。",
        '[data-product-market-scroll-list][data-shared-scroll-content-start="after-table-header"]',
      );
      break;
    }
  }
  const layoutStatusMarkerCards = visibleElements(root, '[data-layout-status-settings] [data-shared-status-card][data-shared-status-card-source="product-card-colors"]');
  if (layoutStatusMarkerCards.length && (
    layoutStatusMarkerCards[0].getAttribute(SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE) !== "representative"
    || layoutStatusMarkerCards.slice(1).some((card) => card.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE) !== "silent")
  )) {
    addIssue(issues, "context-markers", "版面风格的第一张状态预览卡没有成为唯一小卡片标注。", '[data-shared-status-card-source="product-card-colors"]');
  }
  if (root.querySelector('[data-page-content-kind="banner"]')) {
    const requiredGroups = [
      { label: "主体", regions: ["body", "workspace"] },
      { label: "表内", regions: ["table-shell"] },
      { label: "内容", regions: ["content"] },
      { label: "表头", regions: ["table-header"] },
      { label: "大卡片", regions: ["large-card"] },
      { label: "尾栏", regions: ["footer"] },
    ] as const;
    for (const requirement of requiredGroups) {
      if (!markerRegions.some((element) => requirement.regions.some((region) => region === element.dataset.developmentStandardFrameRegion))) {
        addIssue(issues, "context-markers", `缺少“${requirement.label}”作用域标注登记。`, selectors.markers);
      }
    }
    const requiredPlacements = [
      { region: "table-shell", placement: "frame-start", label: "表内" },
      { region: "content", placement: "content-start", label: "内容" },
      { region: "large-card", placement: "card-center", label: "大卡片" },
    ] as const;
    for (const requirement of requiredPlacements) {
      const marker = markerRegions.find((element) => element.dataset.developmentStandardFrameRegion === requirement.region);
      if (marker?.dataset.developmentStandardMarkerPlacement !== requirement.placement) {
        addIssue(issues, "context-markers", `${requirement.label}标注没有登记正确的真实定位。`, selectors.markers);
      }
    }
  }

  const expectedMarkerFont = normalizeCss(resolveSharedCssValue(documentRoot, "fontFamily", "var(--tradepro-context-marker-font-family, system-ui, sans-serif)"));
  const expectedMarkerSize = normalizeCss(resolveSharedCssValue(documentRoot, "fontSize", "var(--tradepro-context-marker-font-size, 0.625rem)"));
  const expectedMarkerWeight = normalizeCss(resolveSharedCssValue(documentRoot, "fontWeight", "var(--tradepro-context-marker-font-weight, 700)"));
  for (const marker of markerRegions) {
    const region = marker.dataset.developmentStandardFrameRegion || "";
    const label = marker.dataset.developmentStandardFrameLabel || "";
    const workspaceBody = marker.matches(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector);
    const pseudoTarget = workspaceBody
      ? findExistingWorkspaceBodyMarkerHost(marker)
      : marker.tagName === "THEAD"
        ? marker.querySelector<HTMLElement>("tr > th:first-child")
        : marker.tagName === "TR" && region === "large-card"
          ? marker.querySelector<HTMLElement>("td:first-child")
          : marker;
    if (!pseudoTarget) {
      addIssue(issues, "context-markers", `${label || region}标注没有可用的真实定位元素。`, selectors.markers);
      continue;
    }
    const style = getComputedStyle(pseudoTarget, "::after");
    if (!label || !style.content.includes(label)) {
      addIssue(issues, "context-markers", `${label || region}标注内容没有连接语义登记。`, selectors.markers);
      continue;
    }
    if (marker.dataset.developmentStandardMarkerVisibility === "always" && (style.display === "none" || style.visibility === "hidden" || Number.parseFloat(style.opacity) === 0)) {
      addIssue(issues, "context-markers", `${label}标注已登记为常显，但当前没有可见。`, selectors.markers);
      continue;
    }
    if (workspaceBody) {
      const markerHitArea = findExistingWorkspaceBodyMarkerHitArea(marker);
      const markerHitAreaStyle = markerHitArea ? getComputedStyle(markerHitArea) : null;
      const markerLeft = Number.parseFloat(style.left);
      const hostGutter = marker.getBoundingClientRect().left - pseudoTarget.getBoundingClientRect().left;
      const hostGutterRequired = window.innerWidth > RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.compactMaximum
        || marker.dataset.developmentStandardMarkerVisibility === "always";
      if (
        marker.dataset.developmentStandardMarkerPlacement !== RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.workspacePlacement
        || !markerHitArea
        || !markerHitAreaStyle
        || (hostGutterRequired && !existingWorkspaceBodyMarkerHitAreaMatchesGeometry(marker))
        || !Number.isFinite(markerLeft)
        || markerLeft < 0
        || (hostGutterRequired
          ? markerHitAreaStyle.pointerEvents === "none" || markerHitAreaStyle.visibility === "hidden"
          : markerHitAreaStyle.pointerEvents !== "none" || markerHitAreaStyle.visibility !== "hidden")
        || (hostGutterRequired
          && hostGutter + RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.measurementTolerance
            < RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.minimumHostGutter)
      ) {
        addIssue(issues, "context-markers", "主体标注没有停靠在主体外框左侧预留空白槽，或仍可能覆盖标题。", EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector);
        continue;
      }
      if (
        window.innerWidth <= RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.compactMaximum
        && marker.dataset.developmentStandardMarkerVisibility !== "always"
        && style.display !== "none"
      ) {
        addIssue(issues, "context-markers", "小屏仍显示仅由悬停／聚焦触发的主体标注，可能遮挡业务内容。", EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector);
        continue;
      }
    }
    if (region === "table-shell") {
      const markerLeft = Number.parseFloat(style.left);
      const expectedLeft = RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.tableShellInset;
      const tolerance = RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.measurementTolerance;
      if (!Number.isFinite(markerLeft) || Math.abs(markerLeft - expectedLeft) > tolerance) {
        addIssue(issues, "context-markers", `表内标注没有读取共享左偏移令牌：${style.left || "未设置"}。`, selectors.markers);
      }
    }
    if (
      normalizeCss(style.fontFamily) !== expectedMarkerFont
      || normalizeCss(style.fontSize) !== expectedMarkerSize
      || normalizeCss(style.fontWeight) !== expectedMarkerWeight
    ) {
      addIssue(issues, "context-markers", `${label}标注没有读取统一字体契约。`, selectors.markers);
      continue;
    }
    const vertical = ["body", "workspace", "table-shell", "content"].includes(region);
    if ((vertical && (style.writingMode !== "vertical-rl" || style.textOrientation !== "upright")) || (!vertical && style.writingMode !== "horizontal-tb")) {
      addIssue(issues, "context-markers", `${label}标注的横竖排方向与作用域不一致。`, selectors.markers);
    }
    const isSecondaryTitle = region === "title-2" || marker.dataset.responsiveSharedSurface === "title-2";
    if (isSecondaryTitle && marker.closest(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector)) {
      const markerLeft = Number.parseFloat(style.left);
      const expectedLeft = RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.secondaryTitleInset;
      const tolerance = RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.measurementTolerance;
      if (
        !Number.isFinite(markerLeft)
        || Math.abs(markerLeft - expectedLeft) > tolerance
      ) {
        addIssue(issues, "context-markers", "标题2标注没有停靠在共享框架左侧起点。", selectors.markers);
      }
    }
    if (region === "large-card") {
      const markerTop = Number.parseFloat(style.top);
      const expectedTop = RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.largeCardTopInset;
      const tolerance = RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.measurementTolerance;
      const markerLayer = Number.parseInt(style.zIndex, 10) || 0;
      const highestChildLayer = Array.from(marker.querySelectorAll<HTMLElement>("*"))
        .reduce((highest, child) => Math.max(highest, Number.parseInt(getComputedStyle(child).zIndex, 10) || 0), 0);
      if (!Number.isFinite(markerTop) || Math.abs(markerTop - expectedTop) > tolerance) {
        addIssue(issues, "context-markers", `大卡片标注没有读取共享顶部空白带令牌：${style.top || "未设置"}。`, selectors.markers);
      } else if (markerLayer <= highestChildLayer) {
        addIssue(issues, "context-markers", `大卡片标注层级 ${markerLayer} 没有高于内部层级 ${highestChildLayer}。`, selectors.markers);
      }
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    route,
    checkedFactors: SHARED_VISUAL_PARITY_FACTORS.length,
    issues,
    passed: issues.length === 0,
  };
}
