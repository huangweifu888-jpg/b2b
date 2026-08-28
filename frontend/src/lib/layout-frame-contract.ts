export type LayoutFrameOwner = "shared" | "page";
export type LayoutFrameStyleOwner = "shared" | "page";

export type ProductMarketDeveloperContractToolId = "page-cleanup" | "code-removal" | "global";

/**
 * The four Product Market pages are the reference set for the developer tools.
 * These lists describe structure and style ownership only; they never authorize
 * deleting business records or publishing over downstream custom data.
 */
export const PRODUCT_MARKET_CLEANLINESS_PAGES = ["运营市场", "栏目配置", "版面风格", "客服音效"] as const;

export const PRODUCT_MARKET_THEME_READABILITY_CONTRACT = {
  paletteSource: "product-market-theme-palettes.json",
  themeKeys: ["rose", "orange", "indigoGreen", "tealRose", "limeTea", "dark", "light"],
  minimumTextContrast: 4.5,
  minimumNonTextContrast: 3,
  propagation: "A 总部端 → 代理源端 → 代理端；B 总部端 → 客户源端 → 客户计划／站点",
  exclusions: ["下游自定义", "新增内容", "业务数据", "素材"],
} as const;

/**
 * The footer exposes the same three independent protections in headquarters,
 * agency source and client source.  Their state is shared with 08 页面锁定器
 * and the visual developer; no terminal may reinterpret one lock as another.
 */
export const THREE_TIER_PAGE_LOCK_CONTRACT = {
  source: {
    label: "源码锁",
    protects: "源码与自动命令",
    blocks: ["源码修改", "自动命令", "迁移写入"],
  },
  page: {
    label: "页面锁",
    protects: "页面样式与可视化",
    blocks: ["可视化", "保存", "同步", "发布"],
  },
  column: {
    label: "栏目锁",
    protects: "一级、二级、三级栏目结构",
    blocks: ["新增", "删除", "改名", "排序", "开关", "图标", "路径"],
  },
} as const;

const PRODUCT_MARKET_THEME_TOOL_CHECKS = {
  "page-cleanup": [
    "七主题可读性：逐一核对七套色板；预设卡、快捷胶囊与四个真实页面必须读取同一主题合同，普通文字对比度不得低于 4.5:1",
    "颜色来源：共享框架文字只能读取语义文字令牌；页面私有硬编码色、透明度弱化或退役主题键只能作为迁移输入，不能作为最终样式",
    "发布链核对：只允许 A 总部端 → 代理源端 → 代理端；B 总部端 → 客户源端 → 客户计划／站点。总部端不得绕过来源端直达运行实例；代理源端与客户源端互不发布；两条分支均禁止反向、横向或越级发布",
  ],
  "code-removal": [
    "旧主题样式清退：删除主题键专属 CSS 中的硬编码文字色、底色、边框色和退役键选择器；保留历史存储迁移映射",
    "重复算法清退：只保留共享 WCAG 对比度计算器、4.5:1 文字门槛与 3:1 边界门槛，页面不得另建低标准算法",
    "删除门禁：删除色值或旧键前必须证明七主题键集合、显示名称、主辅色来源和历史迁移路径均已覆盖",
  ],
  global: [
    "悬浮可读性：任何提示、菜单、确认与状态浮层必须使用不透明高对比底色、清晰文字与边界；普通文字对比度至少 4.5:1，说明必须在弹窗可视边界内自动换行，不得溢出或被裁切",
    "七主题矩阵：工厂主题、预设卡、快捷切换、悬停预览、正式应用与三端运行时共享同一键、名称、主辅色和语义色对",
    "对比度门禁：普通文字至少 4.5:1；边界、焦点环和大号图形至少 3:1；内置色无法解析或低于门槛时构建失败",
    "三端样式边界：同步载荷只含主题令牌和共享框架样式；下游自定义、新增内容、业务数据、素材和页面私有结构不覆盖",
    "单向发布：A 总部端 → 代理源端 → 代理端；B 总部端 → 客户源端 → 客户计划／站点。总部端不得绕过来源端直达运行实例；代理源端与客户源端互不发布；任何来源端与运行端均不得反向发布",
  ],
} as const;

export const PRODUCT_MARKET_PAGE_CLEANER_CHECKS = [
  ...PRODUCT_MARKET_THEME_TOOL_CHECKS["page-cleanup"],
  "唯一框架归属：页面工厂、开发器、可视化和共享契约必须指向同一个 ProductMarketWorkspace；existing-workspace 模式不得再生成外层边框、圆角、内边距或阴影",
  "四页范围：逐页核对运营市场、栏目配置、版面风格、客服音效，不以单页通过代替四页验收",
  "唯一结构：每页只保留一个主体工作区、一个 data-product-market-table-shell 和一个内容滚动源",
  "桥接层归零：路由与 Tabs 桥接层必须透明、无边框、无圆角、无投影，不得形成第二层主体外框",
  "表内结构：表内从表头或交互式表头开始，上角直边、下角读取共享圆角；表头和内容必须位于表内",
  "标注完整：主体、标题、表内、表头、内容、大卡片和小卡片使用对应共享标注，禁止首卡冒充内容区",
  "竖行标注：主体必须使用主体外框左侧预留空白槽，禁止覆盖标题；表内、内容使用左侧竖行上下结构，并核对字体、字号、字重、行高与字距一致，禁止回退为横排胶囊",
  "滚动与节距：滚条轨道、内容边缘、卡片间距、收起态起始间距和尾部安全空间只保留一个来源",
  "差异交接：页面清扫器只输出定位、证据和修复草案，不直接删除页面、业务数据、素材或下游自定义",
] as const;

export const PRODUCT_MARKET_CODE_REMOVER_CHECKS = [
  ...PRODUCT_MARKET_THEME_TOOL_CHECKS["code-removal"],
  "重复页面工厂外壳：产品市场已有 SharedPageWorkspace 时，清退额外 FactoryPage 可见外框，只保留合并到同一节点的语义契约",
  "未命中选择器：删除源码中没有任何结构标记或类名消费方的样式块",
  "失效工具类：删除已被共享契约覆盖的旧 padding、gap、颜色、边框、圆角和阴影 utility",
  "重复级联：同一表内、内容或滚条属性只保留最终共享规则，清退更早的页面私有 !important 覆盖",
  "旧标注桥接：删除首卡内容标记、重复内容语义和没有消费方的 data 属性",
  "竖行契约保护：清理主体侵入标题内容、停在框内或使用右侧旧位的覆盖规则；不得删除主体、表内、内容共用的竖排方向与字体令牌",
  "硬编码旧值：共享框架文字、背景、间距与滚条不得继续读取页面私有固定值",
  "特殊表头保护：版面风格主题表头和客服音效服务表头的专属标记、预览卡、开关卡、圆角与阴影不得误删",
  "迁移兼容保护：仍用于读取历史保存配置并迁移到新默认值的兼容清单不得按名称误判为垃圾代码",
  "删除门禁：删除前必须有精确命中证据、差异报告和恢复点；删除后执行契约、类型、构建与真实页面回归",
] as const;

export const PRODUCT_MARKET_GLOBAL_STYLER_CHECKS = [
  ...PRODUCT_MARKET_THEME_TOOL_CHECKS.global,
  "框架归属模式：普通页由 factory-shell 承担框架；已有共享工作区的复杂页使用 existing-workspace，页面工厂、开发器、可视化和共享契约不得各画一层外框",
  "全局令牌：主体、标题、表内、表头、内容、卡片、尾栏和滚条分别读取自己的共享变量",
  "竖行标注：主体统一读取主体外框左侧预留空白槽且不得覆盖标题，表内、内容读取各自左侧竖行上下结构；三者共用字体、字号、字重、行高与字距令牌，三端页面不得私自改回横排或覆盖字型",
  "唯一表内：四页统一使用 data-product-market-table-shell，上角直边、下角共享圆角，页面不得另画外围",
  "交互式表头：版面风格主题表头与客服音效服务表头保留专属视觉，只共享边界、标注和唯一 12px 起始节距",
  "收起态节距：主题或服务表头收起后只由表内保留一层 12px 起始空间，内容区不得再叠加",
  "卡片节距：列表与卡片间距由共享 gap 控制，页面不得用内层私有 gap 绕开全局设置",
  "字体与宽度：三端经营分组读取内容区字体；运营市场小卡片以 17rem 为标题安全宽度并在窄屏自动单列",
  "滚条与尾部：唯一内容滚动源读取共享轨道、滑块、14px 稳定槽位与 60px 尾部安全空间",
  "发布边界：全局样式只沿 A 总部端 → 代理源端 → 代理端或 B 总部端 → 客户源端 → 客户计划／站点向下发布；总部端不得绕过来源端直达运行实例，代理源端与客户源端互不发布，任何分支均不得反向发布；不覆盖下游自定义、新增内容、业务数据和素材",
] as const;

export const PRODUCT_MARKET_DEVELOPER_TOOL_CONTRACTS = {
  "page-cleanup": PRODUCT_MARKET_PAGE_CLEANER_CHECKS,
  "code-removal": PRODUCT_MARKET_CODE_REMOVER_CHECKS,
  global: PRODUCT_MARKET_GLOBAL_STYLER_CHECKS,
} as const satisfies Record<ProductMarketDeveloperContractToolId, readonly string[]>;

export type LayoutFrameContractItem = {
  id: "topbar" | "workspace" | "title" | "tableShell" | "tableHeader" | "content" | "footer" | "scrollbar";
  label: string;
  /** Owns business structure, records and plugins. */
  owner: LayoutFrameOwner;
  /** Owns colours, spacing, borders and scroll affordances. */
  styleOwner: LayoutFrameStyleOwner;
  /** Makes the visual/data split visible to the development tools. */
  syncBoundary: "full" | "style-only";
  /** Hover marker text. */
  markerLabel: string;
  /** Shared context capsule direction for the visible frame marker. */
  markerMode: "inline" | "vertical";
  tokenScope: string;
  description: string;
};

/**
 * One source of truth for the Layout Developer's visible page anatomy.
 * A section can share its visual tokens while its business structure remains
 * page-owned.  This is essential for table headers and content: source updates
 * keep their appearance aligned, but never overwrite columns, records or plugins.
 */
export const LAYOUT_FRAME_CONTRACT: readonly LayoutFrameContractItem[] = [
  { id: "topbar", label: "顶部", owner: "shared", styleOwner: "shared", syncBoundary: "full", markerLabel: "顶部", markerMode: "inline", tokenScope: "--tradepro-client-topbar-*", description: "客户端顶部栏、入口和顶部文字。" },
  { id: "workspace", label: "主体", owner: "shared", styleOwner: "shared", syncBoundary: "full", markerLabel: "主体", markerMode: "vertical", tokenScope: "--tradepro-shared-workspace-*", description: "标题下方唯一的工作框与主体外框；竖向上下文胶囊停靠在主体外框左侧预留空白槽，不进入标题内容。" },
  { id: "title", label: "标题", owner: "shared", styleOwner: "shared", syncBoundary: "full", markerLabel: "标题", markerMode: "inline", tokenScope: "--tradepro-panel-title-*", description: "路径、说明、标题动作和标题色彩。" },
  { id: "tableShell", label: "表内", owner: "shared", styleOwner: "shared", syncBoundary: "full", markerLabel: "表内", markerMode: "vertical", tokenScope: "--tradepro-client-secondary-page-*", description: "表头和内容共同使用的唯一外壳、工作边距与滚条轨道。" },
  { id: "tableHeader", label: "表头", owner: "page", styleOwner: "shared", syncBoundary: "style-only", markerLabel: "表头", markerMode: "inline", tokenScope: "--tradepro-shared-table-header-*", description: "共享外观；当前页保留栏位、动作和排版结构。" },
  { id: "content", label: "内容", owner: "page", styleOwner: "shared", syncBoundary: "style-only", markerLabel: "内容", markerMode: "vertical", tokenScope: "--tradepro-shared-list-* / --tradepro-panel-card-*", description: "共享外观；使用与主体、表内相同的左侧竖向上下文胶囊；当前页保留列表、卡片、业务字段和内容插件。" },
  { id: "footer", label: "尾栏", owner: "shared", styleOwner: "shared", syncBoundary: "full", markerLabel: "尾栏", markerMode: "inline", tokenScope: "--tradepro-client-footer-*", description: "锁定状态、保存动作和尾栏样式。" },
  { id: "scrollbar", label: "滚条", owner: "shared", styleOwner: "shared", syncBoundary: "full", markerLabel: "滚条", markerMode: "inline", tokenScope: "--tradepro-shared-list-scroll-*", description: "内容区右侧轨道、滑块与尾栏安全留白。" },
] as const;

/**
 * One executable contract for the three vertical context markers.  The
 * Product Market page, the three source developer entries and the CSS gate all
 * consume these section ids and token names instead of maintaining separate
 * workspace/table/content typography rules.
 */
export const VERTICAL_CONTEXT_CAPSULE_CONTRACT = {
  sectionIds: ["workspace", "tableShell", "content"],
  placementBySection: {
    workspace: "left-outer-gutter",
    tableShell: "left-frame-start",
    content: "left-content-start",
  },
  workspaceMarkerPlacement: "body-left-outer-gutter",
  compactWorkspacePolicy: "suppress-hover-only-keep-explicit-always",
  tableShellLeftInsetToken: "--responsive-table-shell-marker-left-inset",
  writingMode: "vertical-rl",
  writingModeToken: "--tradepro-vertical-context-marker-writing-mode",
  textOrientation: "upright",
  textOrientationToken: "--tradepro-vertical-context-marker-text-orientation",
  paddingToken: "--tradepro-vertical-context-marker-padding",
  fontFamilyToken: "--tradepro-vertical-context-marker-font-family",
  fontSizeToken: "--tradepro-vertical-context-marker-font-size",
  fontWeightToken: "--tradepro-vertical-context-marker-font-weight",
  lineHeightToken: "--tradepro-vertical-context-marker-line-height",
  letterSpacingToken: "--tradepro-vertical-context-marker-letter-spacing",
} as const;

/**
 * Versioned geometry reference for pages that adopt an existing workspace as
 * their FactoryPage frame.  Operations Market is the reviewed reference, but
 * consumers never fetch or render that route in the background.  They resolve
 * these selectors and shared-token expressions in their own document; the E2E
 * gate separately compares both real routes at the same viewport.
 *
 * Requiring the FactoryPage frame owner, shared workspace, direct-child
 * regions and the scroll contract is the compatibility boundary.  A page
 * without that complete canonical structure is intentionally not styled by
 * the shared existing-workspace adapter.
 */
export const EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT = {
  version: "1.0.5",
  referencePageId: "product-market:operations",
  referenceRoute: "/zb/client-source/product-market?tab=operations",
  frameOwner: "existing-workspace",
  scrollContract: "table-inner-60",
  rootSelector:
    '[data-page-factory-frame-owner="existing-workspace"][data-shared-page-workspace][data-development-standard-frame-region="body"]',
  regionSelectors: {
    workspace: ":scope",
    title:
      ':scope > [data-shared-layout-section="title"][data-development-standard-frame-region="title"]:not([data-responsive-shared-surface="title-2"])',
    tableShell:
      ':scope > :is([data-page-table-shell], [data-development-standard-frame-region="table-shell"])[data-development-standard-frame-region="table-shell"]',
    tableHeader:
      ':scope > :is([data-page-table-shell], [data-development-standard-frame-region="table-shell"])[data-development-standard-frame-region="table-shell"] > :is([data-page-table-header], [data-development-standard-frame-region="table-header"])[data-development-standard-frame-region="table-header"]',
    content:
      ':scope > :is([data-page-table-shell], [data-development-standard-frame-region="table-shell"])[data-development-standard-frame-region="table-shell"] > [data-shared-scroll-contract="table-inner-60"][data-page-list-scroll-owner][data-development-standard-frame-region="content"]',
  },
  footer: {
    selector:
      '[data-client-page-footer][data-page-layout-footer][data-development-standard-frame-region="footer"]',
    lockControlsSelector: "[data-page-lock-footer-controls]",
    primaryActionsSelector: "[data-footer-primary-actions]",
    visualLauncherSelector: "[data-visual-card-developer-launcher]",
    saveActionSelector: '[data-client-project-action][data-responsive-priority="p0"]',
    inlineStartToken: "--tradepro-shared-existing-workspace-footer-inline-start",
    inlineEndToken: "--tradepro-shared-existing-workspace-footer-inline-end",
    desktopMinWidth: 768,
  },
  marker: {
    activationAttribute: "data-development-standard-marker-visibility",
    activationValue: "always",
    workspacePaintHostSelector: ":is(.app-main, .app-main-roomy)",
    workspacePaintHostAttribute: "data-existing-workspace-body-marker-host",
    workspaceHitAreaAttribute: "data-existing-workspace-body-marker-hit-area",
    workspaceHitAreaValue: "left",
    pseudoElements: ["::after", "::before"],
    labels: {
      workspace: "主体",
      title: "标题",
      tableShell: "表内",
      tableHeader: "表头",
      content: "内容",
    },
  },
  geometry: {
    edgeToleranceCssPixels: 1,
    relationships: [
      ["workspace", "title"],
      ["workspace", "tableShell"],
      ["tableHeader", "content"],
    ],
    tokenBaselines: {
      tableShellPadding:
        "var(--tradepro-shared-table-shell-padding, var(--tradepro-layout-space, 0.75rem))",
      tableHeaderMinHeight:
        "var(--tradepro-shared-table-header-height, 3.25rem)",
      contentPadding:
        "var(--tradepro-shared-list-scroll-top-inset, var(--tradepro-layout-space, 0.75rem)) 0 var(--tradepro-shared-list-scroll-end-space, 3.75rem)",
    },
  },
} as const;

/**
 * Code-owned baseline for the three editable source workspaces.  The visual
 * developer may preview the same frame contract in all three scopes, while a
 * saved release remains source-scoped and follows its own downstream branch.
 * Operations Market is the geometry reference in every scope; Marketing
 * Playbook is the cross-template client-source pilot used to prove that the
 * contract is reusable rather than a Product Market route patch.
 */
export const THREE_SOURCE_GLOBAL_FRAME_CONTRACT = {
  version: "1.0.0",
  sourceScopes: ["hq", "agency_source", "client_source"],
  visualApplicationScope: "global",
  releaseMode: "source-scoped",
  unregisteredPagePolicy: "fail-closed",
  sharedChangeBoundary: [
    "appearance-tokens",
    "frame-geometry",
    "annotations",
    "scroll-policy",
    "responsive-policy",
  ],
  protectedPageOwnership: [
    "structure",
    "content",
    "business-data",
    "assets",
    "plugins",
    "navigation",
  ],
  frameOwner: EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.frameOwner,
  canonicalRootSelector: EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector,
  regionSelectors: EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.regionSelectors,
  scrollOwnerSelector:
    '[data-shared-scroll-contract="table-inner-60"][data-page-list-scroll-owner][data-development-standard-frame-region="content"]',
  footerSelector:
    '[data-page-layout-footer][data-development-standard-frame-region="footer"]',
  visualLauncherSelector: "[data-visual-card-developer-launcher]",
  scrollPolicy: "content-only",
  operationsReferences: [
    {
      sourceScope: "hq",
      pageId: "hq-product-market-operations",
      route: "/zb/product-market?tab=operations",
      shellSelector: '.app-shell[data-platform-frame-scope="hq"]',
      mainSelector: ".app-main-roomy",
    },
    {
      sourceScope: "agency_source",
      pageId: "agency-source-product-market-operations",
      route: "/zb/agency-source/product-market?tab=operations",
      shellSelector: '.app-shell[data-platform-frame-scope="agency-source"]',
      mainSelector: ".app-main-roomy",
    },
    {
      sourceScope: "client_source",
      pageId: "client-source-product-market-operations",
      route: "/zb/client-source/product-market?tab=operations",
      shellSelector: "[data-client-source-shell]",
      mainSelector: ".app-main",
    },
  ],
  comparisonPilot: {
    sourceScope: "client_source",
    pageId: "client-social-marketing-playbook",
    route: "/zb/client-source/social?tab=marketing-playbook",
  },
  releaseBranches: {
    hq: ["agency_source", "client_source"],
    agency_source: ["agency"],
    client_source: ["client"],
  },
  forbiddenReleaseEdges: [
    "hq-to-runtime",
    "agency-source-to-client-source",
    "client-source-to-agency-source",
    "runtime-to-source",
  ],
} as const;

export const EXISTING_WORKSPACE_BODY_MARKER_HOST_ATTRIBUTE =
  EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.workspacePaintHostAttribute;

export const EXISTING_WORKSPACE_BODY_MARKER_HIT_AREA_ATTRIBUTE =
  EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.workspaceHitAreaAttribute;

/**
 * Resolves the one outer page host that paints the canonical workspace marker.
 * The workspace remains the semantic owner; only its visible capsule is moved
 * into the reserved app-main gutter so Title never becomes its positioning
 * context. Multiple canonical roots fail closed instead of sharing a marker.
 */
export function findExistingWorkspaceBodyMarkerHost(workspace: HTMLElement) {
  if (!workspace.matches(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector)) return null;
  const host = workspace.closest<HTMLElement>(
    EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.workspacePaintHostSelector,
  );
  if (!host) return null;
  const canonicalRoots = host.querySelectorAll<HTMLElement>(
    EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector,
  );
  return canonicalRoots.length === 1 && canonicalRoots[0] === workspace ? host : null;
}

/**
 * Finds the single real pointer target occupying the workspace's left outer
 * gutter. The target is a direct child of the paint host, never a negative
 * child of the overflow-clipped workspace and never a semantic page region.
 */
export function findExistingWorkspaceBodyMarkerHitArea(workspace: HTMLElement) {
  const host = findExistingWorkspaceBodyMarkerHost(workspace);
  if (!host) return null;
  const selector = `:scope > [${EXISTING_WORKSPACE_BODY_MARKER_HIT_AREA_ATTRIBUTE}="${EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.workspaceHitAreaValue}"]`;
  const hitAreas = host.querySelectorAll<HTMLElement>(selector);
  return hitAreas.length === 1 ? hitAreas[0] : null;
}

/** The pointer target must cover exactly host-left → workspace-left. */
export function existingWorkspaceBodyMarkerHitAreaMatchesGeometry(
  workspace: HTMLElement,
  tolerance = EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.geometry.edgeToleranceCssPixels,
) {
  const host = findExistingWorkspaceBodyMarkerHost(workspace);
  const hitArea = findExistingWorkspaceBodyMarkerHitArea(workspace);
  if (!host || !hitArea || hitArea.parentElement !== host) return false;
  const hostRect = host.getBoundingClientRect();
  const workspaceRect = workspace.getBoundingClientRect();
  const hitRect = hitArea.getBoundingClientRect();
  return hitRect.width > 0
    && hitRect.height > 0
    && Math.abs(hitRect.left - hostRect.left) <= tolerance
    && Math.abs(hitRect.right - workspaceRect.left) <= tolerance
    && Math.abs(hitRect.top - workspaceRect.top) <= tolerance
    && Math.abs(hitRect.bottom - workspaceRect.bottom) <= tolerance;
}

// Every item owned by Shared Variables must be emitted by a global sync.
// This keeps the outer workspace and right scrollbar from falling back to a
// route-local legacy profile while table headers and content remain page-owned.
export const GLOBAL_FRAME_SECTION_KEYS = ["topbar", "workspace", "title", "footer", "scrollbar"] as const;
// Only these shared sections have selectable visual presets in the current
// Shared Variables editor. Workspace and scrollbar remain global, but are
// emitted through their dedicated token variables rather than page-style
// `sharedFrame` records.
export const GLOBAL_FRAME_STYLE_SECTION_KEYS = ["topbar", "title", "footer"] as const;
export const PAGE_OWNED_FRAME_SECTION_KEYS = ["tableHeader", "content"] as const;
/** All sections that must read the same reusable visual tokens. */
export const SHARED_STYLE_FRAME_SECTION_KEYS = LAYOUT_FRAME_CONTRACT
  .filter((item) => item.styleOwner === "shared")
  .map((item) => item.id);
export const SHARED_FRAME_CONTRACT_ITEMS = LAYOUT_FRAME_CONTRACT.filter((item) => item.owner === "shared");
export const PAGE_FRAME_CONTRACT_ITEMS = LAYOUT_FRAME_CONTRACT.filter((item) => item.owner === "page");
export const VERTICAL_CONTEXT_CAPSULE_FRAME_SECTION_KEYS = LAYOUT_FRAME_CONTRACT
  .filter((item) => item.markerMode === "vertical")
  .map((item) => item.id);

export function getLayoutFrameMarkerLabel(id: LayoutFrameContractItem["id"]) {
  return LAYOUT_FRAME_CONTRACT.find((item) => item.id === id)?.markerLabel || "";
}

/**
 * Visual contract for Shared Variables.  It is intentionally separate from
 * page-owned table/card rules: one route cannot paint a second right-side
 * background or scrollbar track merely because it uses a different content
 * component.  The build guard reviews this map before “同步全局框架” can ship.
 */
export const SHARED_FRAME_STYLE_CONTRACT = [
  {
    id: "workspace",
    label: "主体外框",
    tokens: ["--tradepro-shared-workspace-bg", "--tradepro-shared-workspace-text"],
    invariant: "主体外框只读取共享工作区令牌；路由桥接层必须透明、无边框、无圆角、无投影。",
  },
  {
    id: "title",
    label: "标题边距",
    tokens: ["--tradepro-shared-title-bg", "--tradepro-shared-title-text", "--tradepro-shared-content-gutter"],
    invariant: "路径、说明与标题功能键在同一主体内沿共享左右边缘对齐。",
  },
  {
    id: "scrollbar",
    label: "右侧滚条",
    tokens: ["--tradepro-shared-workspace-scroll-track", "--tradepro-shared-scrollbar-thumb", "--tradepro-shared-list-scrollbar-lane"],
    invariant: "轨道属于主体工作区，页面只保留一个内容滚动容器；滑块跟随全局功能键色，内容卡片不得重设轨道。",
  },
  {
    id: "table-shell-entry-gap",
    label: "表内起始间距",
    tokens: ["--tradepro-layout-space", "--tradepro-shared-list-scroll-top-inset"],
    invariant: "版面风格主题或客服音效服务表头展开时，表内与内容区顶部间距均归零；任一特殊表头收起时仅表内外壳保留一层起始间距，内容滚动区不得再叠加。",
  },
] as const;
