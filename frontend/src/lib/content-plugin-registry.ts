/**
 * Canonical registry for Content Design plugin identifiers.
 *
 * Page plans may keep forward-compatible custom identifiers, but every
 * built-in plugin must be declared here first.  The Layout Developer uses
 * this list for persistence, preview routing and shared interaction styling.
 */
export const CONTENT_PLUGIN_IDS = [
  "hover",
  "compact",
  "split",
  "scroll",
  "responsive",
  "empty",
  "drag",
  "order",
  "move",
  "icon",
  "search",
  "filter",
  "batch",
  "sort",
  "help",
  "actions",
  "pagination",
  "save",
  "sync",
  "close",
  "statusActions",
  "status",
  "loading",
  "toggle",
  "delete",
  "pin",
  "copy",
  "edit",
  "levelBadge",
  "lock",
  "version",
] as const;

export type KnownContentPluginId = (typeof CONTENT_PLUGIN_IDS)[number];
export type ContentPluginGroup = "visual" | "actions" | "status";
export type ContentPluginInteraction = "surface" | "circle" | "badge" | "status-group";
export type ContentPluginPreviewState = "default" | "hover" | "focus" | "active" | "disabled";

export const CONTENT_PLUGIN_PREVIEW_STATE_LABELS = {
  default: "默认",
  hover: "悬停",
  focus: "聚焦",
  active: "启用",
  disabled: "禁用",
} as const satisfies Record<ContentPluginPreviewState, string>;

/**
 * The single source of truth for Content Design plugins.  The Layout
 * Developer, its preview and the new-plugin guide must read this definition
 * instead of keeping their own label, grouping or interaction copies.
 */
export const CONTENT_PLUGIN_DEFINITIONS = [
  { id: "hover", group: "visual", label: "卡片悬浮", detail: "悬停时只高亮真实作用位置，不增加第二层外框。", runtime: "ContentPluginCardSurface", interaction: "surface" },
  { id: "compact", group: "visual", label: "紧凑内容", detail: "统一卡片内边距和行高。", runtime: "ContentPluginDensity", interaction: "surface" },
  { id: "split", group: "visual", label: "双栏内容", detail: "使用左右内容轨道，不改变业务数据顺序。", runtime: "ContentPluginSplitLayout", interaction: "surface" },
  { id: "scroll", group: "visual", label: "滚条对齐", detail: "统一内容区滚条槽与尾栏安全留白。", runtime: "ContentPluginScrollArea", interaction: "surface" },
  { id: "responsive", group: "visual", label: "响应式布局", detail: "按共享断点调整区域与卡片排列，不写入业务字段或素材。", runtime: "ContentPluginResponsiveLayout", interaction: "surface" },
  { id: "empty", group: "visual", label: "空状态", detail: "在页面没有可展示记录时呈现统一空状态，不创建占位业务数据。", runtime: "ContentPluginEmptyState", interaction: "surface" },
  { id: "drag", group: "actions", label: "拖拉", detail: "由共享排序工具栏输出真实拖拉手柄、间距与焦点效果；页面只提供可排序记录。", runtime: "ContentPluginSortToolbar / ContentPluginDragHandle", interaction: "circle" },
  { id: "order", group: "actions", label: "排序号", detail: "由共享排序工具栏显示一级或二级排序号；页面可声明按排放顺序递增或按业务权重倒序。", runtime: "ContentPluginSortToolbar / ContentPluginOrderBadge", interaction: "badge" },
  { id: "move", group: "actions", label: "↑↓", detail: "由共享排序工具栏输出真实上移、下移按钮与圆形悬停高亮；页面只提供移动回调。", runtime: "ContentPluginSortToolbar / ContentPluginMoveButtons", interaction: "circle" },
  { id: "icon", group: "actions", label: "图标设置", detail: "显示独立图标入口，不覆盖同类别项目。", runtime: "ContentPluginIconSetting", interaction: "surface" },
  { id: "search", group: "actions", label: "搜索", detail: "提供页面作用域搜索入口；查询值和搜索结果仍由当前页面拥有。", runtime: "ContentPluginSearch", interaction: "surface" },
  { id: "filter", group: "actions", label: "筛选", detail: "呈现已登记筛选条件；插件只触发页面回调，不保存业务筛选结果。", runtime: "ContentPluginFilter", interaction: "surface" },
  { id: "batch", group: "actions", label: "批量操作", detail: "组合当前页面允许的批量动作，并由页面负责选择状态、权限和写入。", runtime: "ContentPluginBatchActions", interaction: "status-group" },
  { id: "sort", group: "actions", label: "排序", detail: "提供字段排序入口；排序规则和记录顺序由页面数据层处理。", runtime: "ContentPluginSort", interaction: "surface" },
  { id: "help", group: "actions", label: "帮助提示", detail: "在指定区域显示说明、提示或帮助入口，不改变页面内容。", runtime: "ContentPluginHelp", interaction: "surface" },
  { id: "actions", group: "actions", label: "功能键", detail: "承载区域已登记的通用动作槽；每个动作必须由页面提供真实回调和权限。", runtime: "ContentPluginActions", interaction: "status-group" },
  { id: "pagination", group: "actions", label: "分页", detail: "提供页码与翻页控制；总数、页码和数据读取仍由页面负责。", runtime: "ContentPluginPagination", interaction: "surface" },
  { id: "save", group: "actions", label: "保存", detail: "触发当前页面已登记的保存流程，不自行序列化或写入业务数据。", runtime: "ContentPluginSaveAction", interaction: "surface" },
  { id: "sync", group: "actions", label: "同步", detail: "触发经过权限与发布边界校验的同步流程，不绕过模板单向发布规则。", runtime: "ContentPluginSyncAction", interaction: "surface" },
  { id: "delete", group: "actions", label: "删除", detail: "仅显示删除图标及危险状态提示。", runtime: "ContentPluginDeleteAction", interaction: "surface" },
  { id: "levelBadge", group: "actions", label: "级别卡号", detail: "显示层级与排序归属。", runtime: "ContentPluginLevelBadge", interaction: "badge" },
  { id: "statusActions", group: "status", label: "开通/取消/隐藏", detail: "三段状态操作统一间距和状态色；页面只提供状态写入逻辑。", runtime: "ContentPluginStatusActions", interaction: "status-group" },
  { id: "status", group: "status", label: "状态", detail: "显示区域或记录的只读状态摘要；状态来源和变更仍由页面拥有。", runtime: "ContentPluginStatus", interaction: "badge" },
  { id: "loading", group: "status", label: "加载状态", detail: "在页面读取期间显示统一加载反馈，不缓存或复制业务数据。", runtime: "ContentPluginLoadingState", interaction: "surface" },
  { id: "toggle", group: "status", label: "启用开关", detail: "显示当前卡片的启用状态。", runtime: "ContentPluginToggle", interaction: "surface" },
  { id: "pin", group: "status", label: "置顶", detail: "只强调当前项目的置顶动作。", runtime: "ContentPluginPinAction", interaction: "surface" },
  { id: "copy", group: "status", label: "复制", detail: "提供轻量复制反馈。", runtime: "ContentPluginCopyAction", interaction: "surface" },
  { id: "edit", group: "status", label: "编辑", detail: "提供轻量编辑反馈。", runtime: "ContentPluginEditAction", interaction: "surface" },
  { id: "lock", group: "status", label: "锁定", detail: "显示并切换已登记的结构锁定状态，不锁定业务内容或下游新增数据。", runtime: "ContentPluginLockState", interaction: "badge" },
  { id: "version", group: "status", label: "版本", detail: "显示当前方案或发布批次版本，只读取版本元数据。", runtime: "ContentPluginVersionBadge", interaction: "badge" },
  { id: "close", group: "actions", label: "Close", detail: "Closes the current dialog or drawer through the page-owned callback.", runtime: "ContentPluginCloseAction", interaction: "circle" },
] as const satisfies ReadonlyArray<{
  id: KnownContentPluginId;
  group: ContentPluginGroup;
  label: string;
  detail: string;
  runtime: string;
  interaction: ContentPluginInteraction;
}>;

export const CONTENT_PLUGIN_GROUP_IDS = {
  visual: ["hover", "compact", "split", "scroll", "responsive", "empty"],
  actions: ["drag", "order", "move", "icon", "search", "filter", "batch", "sort", "help", "actions", "pagination", "save", "sync", "close", "delete", "levelBadge"],
  status: ["statusActions", "status", "loading", "toggle", "pin", "copy", "edit", "lock", "version"],
} as const satisfies Record<ContentPluginGroup, readonly KnownContentPluginId[]>;

export function getContentPluginDefinition(id: KnownContentPluginId) {
  const definition = CONTENT_PLUGIN_DEFINITIONS.find((item) => item.id === id);
  if (!definition) throw new Error(`Missing Content Design plugin definition: ${id}`);
  return definition;
}

/**
 * States supported by the real runtime primitive. The Visual editor only
 * switches this state marker; the control, typography and interaction CSS are
 * shared with the page itself.
 */
export function listContentPluginPreviewStates(id: KnownContentPluginId): readonly ContentPluginPreviewState[] {
  if (id === "hover") return ["default", "hover"];
  if (id === "drag" || id === "move" || id === "icon") return ["default", "hover", "focus", "disabled"];
  const actionIds: readonly KnownContentPluginId[] = ["search", "filter", "batch", "sort", "help", "actions", "pagination", "save", "sync", "close", "delete", "pin", "copy", "edit"];
  if (actionIds.includes(id)) {
    return ["default", "hover", "focus", "active", "disabled"];
  }
  if (id === "loading" || id === "toggle") return ["default", "disabled"];
  return ["default"];
}

/**
 * A page may bind its own business callbacks, but these primitives are the
 * one visual/runtime implementation that every Content Design page should use.
 * Keeping the mapping in the registry lets the Layout Developer explain the
 * exact control rendered on the real page instead of maintaining look-alikes.
 */
export const CONTENT_PLUGIN_RUNTIME_PRIMITIVES = {
  drag: toRuntimePrimitive("drag"),
  order: toRuntimePrimitive("order"),
  move: toRuntimePrimitive("move"),
  statusActions: toRuntimePrimitive("statusActions"),
} as const satisfies Record<"drag" | "order" | "move" | "statusActions", { component: string; label: string; detail: string }>;

function toRuntimePrimitive(id: KnownContentPluginId) {
  const definition = getContentPluginDefinition(id);
  return { component: definition.runtime, label: definition.label, detail: definition.detail };
}

export function isKnownContentPluginId(value: string): value is KnownContentPluginId {
  return (CONTENT_PLUGIN_IDS as readonly string[]).includes(value);
}
