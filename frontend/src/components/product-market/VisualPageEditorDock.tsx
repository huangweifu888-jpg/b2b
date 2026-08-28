import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Eye, EyeOff, GripVertical, LoaderCircle, Maximize2, MoreHorizontal, Package, PanelRightClose, Plus, RotateCcw, Settings2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { ContentPluginActionButton, ContentPluginCloseButton, ContentPluginDragHandle, ContentPluginIconTrigger, ContentPluginMoveButtons, ContentPluginOrderBadge, ContentPluginStatusActions, ContentPluginTextBadge, ContentPluginToggle } from "@/components/content-plugins/ContentPluginControls";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CONTENT_PLUGIN_PREVIEW_STATE_LABELS,
  getContentPluginDefinition,
  listContentPluginPreviewStates,
  type ContentPluginGroup,
  type ContentPluginPreviewState,
  type KnownContentPluginId,
} from "@/lib/content-plugin-registry";
import { GLOBAL_THEME_TOKEN_NAMES, resolveGlobalThemeTokens } from "@/lib/global-theme-tokens";
import {
  createDeveloperGlobalStyleCanaryAppearance,
  readDeveloperGlobalStyleVisualIntent,
  writeDeveloperGlobalFrameVisualDraft,
} from "@/lib/developer-global-style-session";
import {
  EXISTING_WORKSPACE_BODY_MARKER_HOST_ATTRIBUTE,
  findExistingWorkspaceBodyMarkerHost,
} from "@/lib/layout-frame-contract";
import { RESPONSIVE_SHELL_FACTORY_DEFAULT } from "@/lib/responsive-shell-contract";
import { GLOBAL_RESPONSIVE_PAGE_CONTRACT_VERSION } from "@/lib/global-responsive-page-version";
import { ADAPTIVE_STRUCTURE_FACTORY_DEFAULT } from "@/lib/adaptive-structure-contract";
import { CUSTOMER_SERVICE_EXPERT_CONTENT_CONTRACT } from "@/lib/customer-service-expert-contract";
import { formatDisplayOrdinal } from "@/lib/display-number-contract";
import { SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT } from "@/lib/shared-adaptive-surface-contract";
import {
  findSharedSmallCardMarkerScope,
  isSharedSmallCardMarkerCandidate,
  resolveCenteredWindowResize,
  resolveSharedSmallCardMarkerRepresentative,
  SHARED_CENTER_SYMMETRIC_RESIZE_CONTRACT,
  SHARED_DEVELOPER_LIVE_PREVIEW_DOCUMENT_THEME_MUTATION_ATTRIBUTES,
  SHARED_DEVELOPER_LIVE_PREVIEW_MUTATION_ATTRIBUTES,
  SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE,
  SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE,
  SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE,
  SHARED_SMALL_CARD_DISCOVERY_MUTATION_ATTRIBUTES,
  SHARED_SMALL_CARD_MARKER_CONTRACT_VERSION,
  SHARED_SMALL_CARD_MARKER_POLICY,
  SHARED_SMALL_CARD_MARKER_RESOLUTION,
  SHARED_WINDOW_CONTRACT_VERSION,
  SHARED_WINDOW_FACTORY_DEFAULT,
  SHARED_WINDOW_TITLE_ACTION_RAIL_CONTRACT,
  type SharedWindowResizeEdge,
} from "@/lib/shared-window-contract";
import {
  inspectCurrentPageGlobalInheritance,
  listPageCompositionAuditRecords,
  restoreCurrentPageGlobalInheritance,
  restorePageCompositionAudit,
  type PageCompositionAuditRecord,
} from "@/lib/page-composition-audit";
import { buildPageCompositionImpactMap } from "@/lib/page-composition-impact-map";
import { DEVELOPER_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS } from "@/lib/developer-global-frame-adapter-resolution";
import { PAGE_CSS_PROFILE_EVENT } from "@/lib/page-layout-overrides";
import { PAGE_LAYOUT_LOCK_EVENT } from "@/lib/page-layout-lock";
import { useProductMarketStore, type LayoutCustomStyle } from "@/lib/product-market-store";
import { PAGE_FACTORY_PAGES } from "@/page-factory/page-factory";
import {
  applyVisualCardComponentStyleRuntime,
  clearVisualCardComponentStyleRuntime,
} from "@/lib/visual-card-component-style-runtime";
import {
  applyVisualCardPluginRuntime,
  clearVisualCardPluginRuntime,
  inspectVisualCardPluginRuntime,
  type VisualCardPluginRuntimeReport,
} from "@/lib/visual-card-plugin-runtime";
import {
  VISUAL_CARD_SAFE_FONT_FAMILIES,
  VISUAL_CARD_SAFE_FONT_WEIGHTS,
  VISUAL_CARD_SAFE_LETTER_SPACINGS,
  buildVisualCardSharedStylePatch,
  createDefaultVisualCardSharedStyleApplyPatch,
  normalizeVisualCardSharedColor,
  resolveVisualCardSharedRegionStyle,
  type VisualCardGlobalTypography,
  type VisualCardSharedStyleApplyPatch,
  type VisualCardSharedStyleEdit,
} from "@/lib/visual-card-shared-style-bridge";
import {
  VISUAL_CARD_DIRECT_APPLY_EVENT,
  VISUAL_CARD_EDITABLE_REGION_IDS,
  buildVisualCardLayoutScopeKey,
  cloneVisualCardLayout,
  composeVisualCardLayout,
  createDefaultVisualCardLayout,
  getVisualCardRegionContract,
  mergeVisualCardLayoutForApplicationScope,
  normalizeVisualCardLayout,
  readVisualCardPageOverride,
  resolveVisualCardWorkspaceScope,
  writeVisualCardEditorLayout,
  type VisualCardDirectApplyDetail,
  type VisualCardApplicationScope,
  type VisualCardEditorApplicationScope,
  type VisualCardComponentStyleOverrides,
  type VisualCardComponentInstance,
  type VisualCardEditableRegionId,
  type VisualCardLayoutConfig,
  type VisualCardLayoutNode,
  type VisualCardLayoutScope,
  type VisualCardPlacement,
  type VisualCardRegionId,
} from "@/lib/visual-card-layout-contract";
import {
  createVisualPageComponentInstance,
  getVisualPageComponentContract,
  getVisualPageComponentDefinition,
  listVisualPageComponentContracts,
  listVisualPageComponentDefinitions,
  resolveVisualComponentInheritance,
  VISUAL_COMPONENT_CONTRACT_INHERITANCE,
  VISUAL_COMPONENT_INHERITANCE_STATUS_LABELS,
  type VisualComponentRuntimeState,
  type VisualPageComponentDefinition,
} from "@/lib/visual-page-component-library";
import {
  collectVisualPageRegionTargetsForRegion,
  collectVisualPageRegionTargets,
  findVisualPageLayoutRoot,
  formatVisualContractAnnotation,
} from "@/lib/visual-page-region-registry";
import { cn } from "@/lib/utils";
import {
  reportGlobalFrameWorkflowStatus,
  requestDevelopmentConsoleReopen,
} from "@/lib/visual-page-editor-events";

const STYLE_PRESETS = [
  { id: "standard", label: "共享标准", detail: "沿用当前共享契约" },
  { id: "accent", label: "重点强调", detail: "主色描边与浅色底" },
  { id: "soft", label: "柔和卡片", detail: "降低对比并增加层次" },
  { id: "contrast", label: "高对比", detail: "强化边界与阴影" },
] as const;

const PLACEMENT_LABELS: Record<VisualCardPlacement, string> = {
  flow: "正常流动",
  "sticky-start": "固定顶部",
  "sticky-end": "固定底部",
};

const REGION_DESCRIPTIONS: Record<VisualCardRegionId, string> = {
  "total-frame": "页面唯一总框架及其四边尺寸。",
  topbar: "全局搜索、身份、帮助与顶部插件区域。",
  workspace: "当前页面的唯一主体工作区。",
  title: "页面名称、说明与右侧功能键。",
  "table-shell": "表头和内容共同使用的唯一表内框。",
  "table-header": "批量操作、筛选、排序等固定表头能力。",
  content: "当前页面唯一滚动内容区。",
  "large-card": "栏目、分组等大范围内容卡片。",
  "small-card": "具体模块、记录或功能小卡片。",
  footer: "版本、保存、同步和状态尾栏。",
};

const VISUAL_CARD_APPLICATION_SCOPE_META: Record<VisualCardEditorApplicationScope, { label: string; detail: string }> = {
  global: { label: "共享全局", detail: "编辑固定框架和共享契约；这里只保存来源全局草稿，不代表审核或发布。" },
  "current-page": { label: "当前页面", detail: "仅保存本机浏览器当前路由草稿/覆盖，不写全局模板、不进入发布链。" },
  "canary-profile": { label: "试点档案", detail: "编辑共享区域并只在当前真实页面临时预览；确认后仅保存外观档案与审计。" },
};

const VISUAL_CARD_SCOPE_SELECTION_IDS = {
  global: ["total-frame", "topbar", "workspace", "footer", "title", "table-shell"],
  "current-page": ["table-header", "content", "large-card", "small-card"],
  "canary-profile": ["workspace", "title", "table-shell", "topbar", "footer", "total-frame"],
} as const satisfies Record<VisualCardEditorApplicationScope, readonly VisualCardRegionId[]>;

const VISUAL_COMPONENT_DRAG_MIME = "application/x-tradepro-visual-component";
const SHOW_LEGACY_COMPONENT_LIBRARY = false;
const GLOBAL_FRAME_ISOLATED_TARGET_COUNT = DEVELOPER_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS.length;
const GLOBAL_FRAME_COMPATIBLE_TARGET_COUNT = PAGE_FACTORY_PAGES.length - GLOBAL_FRAME_ISOLATED_TARGET_COUNT;
const GLOBAL_FRAME_ISOLATED_TARGET_LABEL = DEVELOPER_GLOBAL_FRAME_INTENTIONAL_ISOLATION_PAGE_IDS.join("、");

const VISUAL_COMPONENT_COLLECTIONS = [
  { id: "live", label: "当前组件" },
  { id: "shared", label: "共享样式" },
] as const;

const VISUAL_COMPONENT_STATE_LABELS: Record<VisualComponentRuntimeState, string> = {
  default: "默认",
  hover: "悬停",
  focus: "焦点",
  active: "选中",
  disabled: "禁用",
  loading: "加载",
  empty: "空状态",
};

const VISUAL_PLUGIN_GROUP_META: Record<ContentPluginGroup, { label: string; detail: string }> = {
  visual: { label: "视觉", detail: "悬停、紧凑、响应式等展示能力" },
  actions: { label: "操作", detail: "拖拉、排序、编辑等动作入口" },
  status: { label: "状态", detail: "状态、开关、加载等反馈能力" },
};

const FRAME_INSET_ROWS = [
  ["top", "上", "上边距"],
  ["right", "右", "右边距"],
  ["bottom", "下", "下边距"],
  ["left", "左", "左边距"],
] as const;

const VISUAL_CARD_PARAMETER_SECTIONS = [
  { id: "basic", label: "基础" },
  { id: "components", label: "组件" },
  { id: "responsive", label: "自适应" },
  { id: "spacing", label: "间距" },
  { id: "annotation", label: "标注" },
  { id: "surface", label: "色彩" },
  { id: "typography", label: "字体" },
  { id: "border", label: "边框" },
  { id: "plugins", label: "插件" },
] as const;

const SHARED_CORNER_OPTIONS = [
  { value: "square", label: "直角 0px" },
  { value: "soft", label: "柔角 12px" },
  { value: "round", label: "圆角 24px" },
] as const;

const SHARED_DENSITY_OPTIONS = [
  { value: "compact", label: "紧凑 8px" },
  { value: "standard", label: "标准 12px" },
  { value: "relaxed", label: "舒展 16px" },
] as const;

const SHARED_ELEVATION_OPTIONS = [
  { value: "flat", label: "平面" },
  { value: "soft", label: "轻 3D" },
  { value: "raised", label: "强调 3D" },
] as const;

type VisualCardParameterSection = typeof VISUAL_CARD_PARAMETER_SECTIONS[number]["id"];
type VisualComponentCollection = typeof VISUAL_COMPONENT_COLLECTIONS[number]["id"];
type VisualCardSharedGeometryPatch = Partial<Pick<LayoutCustomStyle,
  "frameCornerRadius" | "tableHeaderCornerRadius" | "cardCornerRadius" | "frameDensity" | "frameElevation"
>>;
type VisualCardComponentSpacing = NonNullable<VisualCardComponentStyleOverrides["spacing"]>;
type VisualCardComponentAnnotation = NonNullable<VisualCardComponentStyleOverrides["annotation"]>;
type VisualCardComponentSurface = NonNullable<VisualCardComponentStyleOverrides["surface"]>;
type VisualCardComponentTypography = NonNullable<VisualCardComponentStyleOverrides["typography"]>;
type VisualCardComponentBorder = NonNullable<VisualCardComponentStyleOverrides["border"]>;
type VisualCardRegionPluginRuntime = {
  active: VisualCardPluginRuntimeReport;
  capability: VisualCardPluginRuntimeReport;
  targetCount: number;
};
type VisualCardPluginRuntimeByRegion = Partial<Record<VisualCardRegionId, VisualCardRegionPluginRuntime>>;
type VisualPageRegionPreviewSnapshot = {
  key: string;
  regionId: VisualCardRegionId;
  index: number;
  annotation: string;
  primaryText: string;
  secondaryText: string;
  surfaceStyle: CSSProperties;
  textStyle: CSSProperties;
};
type VisualPageRegionPreviewByRegion = Partial<Record<VisualCardRegionId, VisualPageRegionPreviewSnapshot[]>>;
type VisualCardDirectApplyWithSharedStyleDetail = VisualCardDirectApplyDetail & {
  sharedStylePatch?: VisualCardSharedStyleApplyPatch;
};

const GLOBAL_TYPOGRAPHY_PROPERTIES = [
  "--tradepro-global-font-family",
  "--tradepro-global-font-weight",
  "--tradepro-global-letter-spacing",
] as const;

const SHARED_STYLE_OWNER_LABELS = {
  layoutStyle: "统一版面风格",
  sidebarStyle: "侧栏契约",
  globalTypography: "全局字体",
  "factory-default": "出厂默认",
} as const;

const SHARED_FONT_FAMILY_LABELS: Record<string, string> = {
  "'Noto Sans SC', sans-serif": "思源黑体",
  "'Noto Serif SC', serif": "思源宋体",
};

function optionalNumber(value: string) {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalChoice<T extends string>(value: string) {
  return value ? value as T : undefined;
}

function compactVisualPreviewText(value: string | null | undefined, fallback: string) {
  const normalized = (value || "").replace(/\s+/gu, " ").trim();
  if (!normalized) return fallback;
  return normalized.length > 32 ? `${normalized.slice(0, 31)}…` : normalized;
}

function collectVisualPreviewText(target: HTMLElement, fallback: string) {
  const candidates = Array.from(target.querySelectorAll<HTMLElement>(
    "h1, h2, h3, h4, [data-page-title], [data-visual-preview-title], strong, p",
  ))
    .filter((element) => !element.closest("button, [role='button'], [data-content-plugin-actions]"))
    .map((element) => compactVisualPreviewText(element.textContent, ""))
    .filter(Boolean);
  const primaryText = candidates[0]
    || compactVisualPreviewText(target.getAttribute("aria-label"), "")
    || compactVisualPreviewText(target.textContent, fallback);
  const secondaryText = candidates.find((text) => text !== primaryText) || "共享契约样式";
  return { primaryText, secondaryText };
}

function createVisualRegionPreviewSnapshot(
  target: HTMLElement,
  regionId: VisualCardRegionId,
  index: number,
  count: number,
): VisualPageRegionPreviewSnapshot {
  const computed = getComputedStyle(target);
  const textTarget = target.querySelector<HTMLElement>("h1, h2, h3, h4, [data-page-title], strong") || target;
  const textComputed = getComputedStyle(textTarget);
  const annotation = regionId === "total-frame"
    ? "总框架"
    : formatVisualContractAnnotation(regionId, index, count);
  const copy = collectVisualPreviewText(target, annotation);
  const safeBackgroundImage = computed.backgroundImage.includes("gradient(") ? computed.backgroundImage : "none";
  return {
    key: `${regionId}:${index}:${annotation}`,
    regionId,
    index,
    annotation,
    ...copy,
    surfaceStyle: {
      backgroundColor: computed.backgroundColor === "rgba(0, 0, 0, 0)" ? "var(--tradepro-panel-card-bg, #ffffff)" : computed.backgroundColor,
      backgroundImage: safeBackgroundImage,
      color: computed.color,
      borderColor: computed.borderColor,
      borderStyle: computed.borderStyle,
      borderWidth: computed.borderWidth,
      borderRadius: computed.borderRadius,
      boxShadow: computed.boxShadow === "none" ? undefined : computed.boxShadow,
      padding: computed.padding,
      gap: computed.gap,
    },
    textStyle: {
      color: textComputed.color,
      fontFamily: textComputed.fontFamily,
      fontSize: textComputed.fontSize,
      fontWeight: textComputed.fontWeight,
      lineHeight: textComputed.lineHeight,
      letterSpacing: textComputed.letterSpacing,
    },
  };
}

function getVisualRegionPreviewStyleSignature(snapshot: VisualPageRegionPreviewSnapshot) {
  return JSON.stringify({
    surfaceStyle: snapshot.surfaceStyle,
    textStyle: snapshot.textStyle,
  });
}

function deduplicateVisualRegionPreviews(snapshots: VisualPageRegionPreviewSnapshot[]) {
  const seenStyleSignatures = new Set<string>();
  return snapshots.filter((snapshot) => {
    const signature = getVisualRegionPreviewStyleSignature(snapshot);
    if (seenStyleSignatures.has(signature)) return false;
    seenStyleSignatures.add(signature);
    return true;
  });
}

function VisualRegionCompactPreview({
  snapshot,
  fallbackLabel,
  stylePresetId,
}: {
  snapshot?: VisualPageRegionPreviewSnapshot;
  fallbackLabel: string;
  stylePresetId?: string;
}) {
  return <div data-visual-component-preview-viewport className="relative h-12 min-w-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
    <div
      data-visual-component-preview-canvas
      data-visual-card-runtime-style={stylePresetId}
      style={snapshot?.surfaceStyle}
      className="absolute left-0 top-0 box-border flex min-h-24 w-[200%] origin-top-left scale-50 flex-col justify-center overflow-hidden px-5 py-3"
    >
      <strong style={snapshot?.textStyle} className="block truncate">{snapshot?.primaryText || fallbackLabel}</strong>
      <span className="mt-1 block truncate text-[12px] opacity-65">{snapshot?.secondaryText || "共享契约样式预览"}</span>
    </div>
    {snapshot ? <span data-visual-component-preview-annotation className="absolute bottom-1 right-1 max-w-[70%] truncate rounded-full bg-slate-950/75 px-1.5 py-0.5 text-[8px] font-semibold text-white">{snapshot.annotation}</span> : null}
  </div>;
}

function VisualPluginRuntimeEffectPreview({ pluginId }: { pluginId: KnownContentPluginId }) {
  const previewRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const target = previewRef.current;
    if (!target) return;
    applyVisualCardPluginRuntime(target, [pluginId], { observe: false });
    return () => clearVisualCardPluginRuntime(target);
  }, [pluginId]);

  return <span ref={previewRef} data-visual-plugin-runtime-effect data-page-list-scroll-owner={pluginId === "scroll" ? "true" : undefined} className="grid h-7 w-[5.625rem] grid-cols-2 items-center gap-1 rounded-md border border-slate-300 bg-slate-50 p-1">
    <span className="h-3 rounded-sm bg-slate-300" />
    <span className="h-3 rounded-sm bg-blue-200" />
  </span>;
}

function VisualPluginCompactPreview({
  pluginId,
  label,
  enabled,
  previewState = "default",
}: {
  pluginId: KnownContentPluginId;
  label: string;
  enabled: boolean;
  previewState?: ContentPluginPreviewState;
}) {
  const control = (() => {
    if (pluginId === "hover" || pluginId === "compact" || pluginId === "split" || pluginId === "scroll" || pluginId === "responsive") return <VisualPluginRuntimeEffectPreview pluginId={pluginId} />;
    if (pluginId === "empty") return <ContentPluginTextBadge control="status">空状态</ContentPluginTextBadge>;
    if (pluginId === "drag") return <ContentPluginDragHandle tabIndex={-1} title={label} />;
    if (pluginId === "order") return <ContentPluginOrderBadge order={1} suffix="栏" sequence="ascending" />;
    if (pluginId === "move") return <ContentPluginMoveButtons canMoveUp canMoveDown onMoveUp={() => undefined} onMoveDown={() => undefined} />;
    if (pluginId === "icon") return <ContentPluginIconTrigger preview={<Package className="h-4 w-4" />} tabIndex={-1} />;
    if (pluginId === "statusActions") return <ContentPluginStatusActions value="active" onChange={() => undefined} className="whitespace-nowrap" />;
    if (pluginId === "toggle") return <ContentPluginToggle label={label} checked={enabled} onCheckedChange={() => undefined} tabIndex={-1} />;
    if (pluginId === "close") return <ContentPluginCloseButton tabIndex={-1} title={label}><X className="h-4 w-4" /></ContentPluginCloseButton>;
    if (pluginId === "delete") return <ContentPluginActionButton control="delete" tabIndex={-1}><Trash2 className="h-4 w-4" /></ContentPluginActionButton>;
    if (pluginId === "levelBadge") return <ContentPluginTextBadge control="level-badge">一级</ContentPluginTextBadge>;
    if (pluginId === "status") return <ContentPluginTextBadge control="status">状态</ContentPluginTextBadge>;
    if (pluginId === "lock") return <ContentPluginTextBadge control="lock">锁定</ContentPluginTextBadge>;
    if (pluginId === "version") return <ContentPluginTextBadge control="version">V1</ContentPluginTextBadge>;
    if (pluginId === "loading") return <ContentPluginActionButton control="edit" tabIndex={-1} title={label}><LoaderCircle className="h-4 w-4 animate-spin" /></ContentPluginActionButton>;

    const textActionIds: readonly KnownContentPluginId[] = ["search", "filter", "batch", "sort", "help", "actions", "pagination", "save", "sync", "pin", "copy", "edit"];
    if (textActionIds.includes(pluginId)) {
      const actionControl = pluginId === "pin" ? "pin" : pluginId === "copy" ? "copy" : "edit";
      return <ContentPluginActionButton control={actionControl} tabIndex={-1} title={label}>{label}</ContentPluginActionButton>;
    }

    return <ContentPluginActionButton control="edit" tabIndex={-1} title={label}><Eye className="h-4 w-4" /></ContentPluginActionButton>;
  })();

  return <span
    data-visual-plugin-preview
    data-visual-plugin-preview-shared-runtime
    data-visual-plugin-preview-id={pluginId}
    data-visual-plugin-preview-enabled={enabled ? "true" : "false"}
    data-visual-plugin-preview-state={previewState}
    className="flex min-h-8 min-w-0 flex-1 items-center justify-center overflow-visible px-1 text-slate-600"
  >
    <span data-visual-plugin-real-control data-visual-plugin-drag-handle={pluginId === "drag" ? "true" : undefined} className="flex min-w-0 items-center justify-center">{control}</span>
  </span>;
}

function compactSharedStyleDraft(
  layoutStyle: LayoutCustomStyle,
  globalTypography: VisualCardGlobalTypography,
  baselineLayoutStyle: LayoutCustomStyle,
  baselineTypography: VisualCardGlobalTypography,
): VisualCardSharedStyleApplyPatch {
  const layoutPatch: Partial<LayoutCustomStyle> = {};
  (Object.keys(layoutStyle) as (keyof LayoutCustomStyle)[]).forEach((key) => {
    if (layoutStyle[key] === baselineLayoutStyle[key]) return;
    (layoutPatch as Record<keyof LayoutCustomStyle, LayoutCustomStyle[keyof LayoutCustomStyle]>)[key] = layoutStyle[key];
  });
  const typographyPatch: Partial<VisualCardGlobalTypography> = {};
  (Object.keys(globalTypography) as (keyof VisualCardGlobalTypography)[]).forEach((key) => {
    if (globalTypography[key] === baselineTypography[key]) return;
    typographyPatch[key] = globalTypography[key];
  });
  return { layoutStyle: layoutPatch, globalTypography: typographyPatch };
}

function mergeVisualCardPluginReports(
  reports: readonly VisualCardPluginRuntimeReport[],
  pluginIds: readonly KnownContentPluginId[],
): VisualCardPluginRuntimeReport {
  const results = pluginIds.map((pluginId) => {
    const matches = reports.flatMap((report) => report.results.filter((item) => item.pluginId === pluginId));
    const representative = matches[0];
    const effectiveCount = matches.filter((item) => item.effective).length;
    const matchedElementCount = matches.reduce((total, item) => total + item.matchedElementCount, 0);
    const status = effectiveCount > 0
      ? matches.some((item) => item.status === "applied") ? "applied" as const : "bound" as const
      : "unavailable" as const;
    return {
      pluginId,
      label: representative?.label || getContentPluginDefinition(pluginId).label,
      kind: representative?.kind || "business-capability" as const,
      status,
      effective: effectiveCount > 0,
      matchedElementCount,
      message: effectiveCount === reports.length && reports.length > 0
        ? `已连接 ${reports.length} 个真实页面区域。`
        : effectiveCount > 0
          ? `已连接 ${effectiveCount}/${reports.length} 个真实页面区域；其余区域没有对应承载。`
          : representative?.message || "当前页面没有对应的真实控件或业务能力。",
    };
  });
  return {
    requestedPluginIds: [...pluginIds],
    effectivePluginIds: results.filter((item) => item.effective).map((item) => item.pluginId),
    unavailablePluginIds: results.filter((item) => !item.effective).map((item) => item.pluginId),
    results,
  };
}

const VISUAL_CARD_EDITOR_VIEWPORT_MARGIN = 8;
const VISUAL_CARD_EDITOR_EXPANDED_SIDEBAR_WIDTH = 240;
const VISUAL_CARD_EDITOR_SIDEBAR_WIDTH_GAP = 24;
const VISUAL_CARD_EDITOR_DEFAULT_WIDTH = VISUAL_CARD_EDITOR_EXPANDED_SIDEBAR_WIDTH - VISUAL_CARD_EDITOR_SIDEBAR_WIDTH_GAP;
const VISUAL_CARD_EDITOR_DEFAULT_LEFT = Math.max(VISUAL_CARD_EDITOR_VIEWPORT_MARGIN, VISUAL_CARD_EDITOR_SIDEBAR_WIDTH_GAP / 2);
const VISUAL_CARD_EDITOR_DEFAULT_HEIGHT = (viewportHeight: number) => Math.max(1, viewportHeight - VISUAL_CARD_EDITOR_VIEWPORT_MARGIN * 2);
const VISUAL_CARD_EDITOR_MIN_WIDTH = 200;
const VISUAL_CARD_EDITOR_MIN_HEIGHT = 320;
const VISUAL_CARD_EDITOR_RESIZE_EDGES = [
  "north",
  "south",
  "east",
  "west",
  "north-east",
  "north-west",
  "south-east",
  "south-west",
] as const satisfies readonly SharedWindowResizeEdge[];

type VisualCardEditorWindowRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type VisualCardEditorWindowInteraction = {
  mode: "drag" | "resize";
  edge?: SharedWindowResizeEdge;
  pointerId: number;
  startX: number;
  startY: number;
  startRect: VisualCardEditorWindowRect;
};

function getVisualCardEditorWindowInteractionName(interaction: VisualCardEditorWindowInteraction | null) {
  if (!interaction) return "idle";
  return interaction.mode === "resize" && interaction.edge
    ? `resize-${interaction.edge}`
    : interaction.mode;
}

function clampVisualCardEditorWindowRect(
  rect: VisualCardEditorWindowRect,
  viewportWidth: number,
  viewportHeight: number,
): VisualCardEditorWindowRect {
  const availableWidth = Math.max(1, viewportWidth - VISUAL_CARD_EDITOR_VIEWPORT_MARGIN * 2);
  const availableHeight = Math.max(1, viewportHeight - VISUAL_CARD_EDITOR_VIEWPORT_MARGIN * 2);
  const minWidth = Math.min(VISUAL_CARD_EDITOR_MIN_WIDTH, availableWidth);
  const minHeight = Math.min(VISUAL_CARD_EDITOR_MIN_HEIGHT, availableHeight);
  const width = Math.min(availableWidth, Math.max(minWidth, Math.round(rect.width)));
  const height = Math.min(availableHeight, Math.max(minHeight, Math.round(rect.height)));
  const maxLeft = Math.max(VISUAL_CARD_EDITOR_VIEWPORT_MARGIN, viewportWidth - VISUAL_CARD_EDITOR_VIEWPORT_MARGIN - width);
  const maxTop = Math.max(VISUAL_CARD_EDITOR_VIEWPORT_MARGIN, viewportHeight - VISUAL_CARD_EDITOR_VIEWPORT_MARGIN - height);
  return {
    left: Math.min(maxLeft, Math.max(VISUAL_CARD_EDITOR_VIEWPORT_MARGIN, Math.round(rect.left))),
    top: Math.min(maxTop, Math.max(VISUAL_CARD_EDITOR_VIEWPORT_MARGIN, Math.round(rect.top))),
    width,
    height,
  };
}

function createDefaultVisualCardEditorWindowRect(viewportWidth: number, viewportHeight: number) {
  const width = Math.min(VISUAL_CARD_EDITOR_DEFAULT_WIDTH, Math.max(1, viewportWidth - VISUAL_CARD_EDITOR_VIEWPORT_MARGIN * 2));
  const height = VISUAL_CARD_EDITOR_DEFAULT_HEIGHT(viewportHeight);
  return clampVisualCardEditorWindowRect({
    left: VISUAL_CARD_EDITOR_DEFAULT_LEFT,
    top: VISUAL_CARD_EDITOR_VIEWPORT_MARGIN,
    width,
    height,
  }, viewportWidth, viewportHeight);
}

const RUNTIME_ATTRIBUTES = [
  "data-visual-card-runtime-region",
  "data-visual-card-runtime-style",
  "data-visual-card-runtime-placement",
  "data-visual-card-runtime-collapsed",
  "data-visual-card-runtime-plugins",
  "data-visual-card-editor-selected",
  "data-visual-contract-region",
  "data-visual-contract-label",
  "data-visual-contract-index",
  "data-visual-contract-page",
  "data-visual-contract-annotation",
  EXISTING_WORKSPACE_BODY_MARKER_HOST_ATTRIBUTE,
] as const;

function isVisibleElement(element: Element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.closest("[data-development-standard-apply-console], [data-visual-card-editor-dock]")) return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
}

function isVisualAnnotationTarget(element: HTMLElement) {
  const effectiveMarker = element.getAttribute(SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE);
  if (effectiveMarker) return effectiveMarker === "representative";
  if (isSharedSmallCardMarkerCandidate(element)) {
    const scope = findSharedSmallCardMarkerScope(element);
    if (scope) return resolveSharedSmallCardMarkerRepresentative(scope) === element;
  }
  return element.dataset.developmentStandardMarker !== "silent";
}

function clearRuntimeElements(elements: Iterable<HTMLElement>) {
  for (const element of elements) {
    clearVisualCardPluginRuntime(element);
    RUNTIME_ATTRIBUTES.forEach((attribute) => element.removeAttribute(attribute));
    clearVisualCardComponentStyleRuntime(element);
    element.style.removeProperty("--visual-card-frame-top");
    element.style.removeProperty("--visual-card-frame-right");
    element.style.removeProperty("--visual-card-frame-bottom");
    element.style.removeProperty("--visual-card-frame-left");
  }
}

function isVisualComponentInstanceMutation(record: MutationRecord) {
  const changedNodes = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)];
  return changedNodes.length > 0 && changedNodes.every((node) => (
    node instanceof HTMLElement && node.matches("[data-visual-component-instance-host]")
  ));
}

function createVisualComponentInstanceElement(
  instance: VisualCardComponentInstance,
  definition: VisualPageComponentDefinition,
  sourceTarget?: HTMLElement,
) {
  const isCard = instance.regionId === "large-card" || instance.regionId === "small-card";
  const element = document.createElement(isCard ? "article" : "section");
  element.setAttribute("data-visual-component-instance-host", instance.id);
  element.setAttribute("data-development-standard-frame-region", instance.regionId);
  element.setAttribute("data-development-standard-frame-label", definition.label);
  element.setAttribute("data-visual-component-definition", definition.id);
  element.setAttribute("aria-label", definition.label);
  element.className = `visual-component-instance visual-component-instance-${instance.regionId}`;

  const copy = document.createElement("div");
  copy.setAttribute("data-visual-component-instance-copy", "true");
  const heading = document.createElement(instance.regionId === "title" ? "h2" : "strong");
  const sourceHeading = sourceTarget?.querySelector<HTMLElement>("h1, h2, h3, [data-shared-title-heading]")?.textContent?.trim();
  heading.textContent = sourceHeading || definition.label;
  copy.appendChild(heading);
  const detail = document.createElement("span");
  const sourceDetail = sourceTarget?.querySelector<HTMLElement>("p, [data-shared-title-description]")?.textContent?.trim();
  detail.textContent = sourceDetail || definition.detail;
  copy.appendChild(detail);
  element.appendChild(copy);
  return element;
}

function getRegionNode(config: VisualCardLayoutConfig, regionId: VisualCardRegionId) {
  return config.nodes.find((node) => node.regionId === regionId);
}

function updateRegionNodes(
  config: VisualCardLayoutConfig,
  regionId: VisualCardRegionId,
  update: (node: VisualCardLayoutNode) => VisualCardLayoutNode,
) {
  let matched = false;
  const nodes = config.nodes.map((node) => {
    if (node.regionId !== regionId) return node;
    matched = true;
    return update(node);
  });
  if (!matched) {
    const fallback = createDefaultVisualCardLayout().nodes.find((node) => node.regionId === regionId);
    if (fallback) nodes.push(update(fallback));
  }
  return normalizeVisualCardLayout({ ...config, nodes, updatedAt: new Date().toISOString() });
}

function comparableLayout(config: VisualCardLayoutConfig) {
  const normalized = cloneVisualCardLayout(config);
  return JSON.stringify({
    frameInsets: normalized.frameInsets,
    nodes: normalized.nodes,
    componentInstances: normalized.componentInstances || [],
    componentStyles: normalized.componentStyles || {},
  });
}

function comparableLayoutForApplicationScope(
  config: VisualCardLayoutConfig,
  applicationScope: VisualCardApplicationScope,
) {
  return comparableLayout(mergeVisualCardLayoutForApplicationScope(
    createDefaultVisualCardLayout(),
    config,
    applicationScope,
  ));
}

function RuntimeLayoutBridge({
  config,
  editorOpen,
  selectedRegionId,
  deferNonSelected,
  onPluginRuntimeChange,
  onRegionPreviewChange,
}: {
  config: VisualCardLayoutConfig | null;
  editorOpen: boolean;
  selectedRegionId: VisualCardRegionId;
  /** First paint only binds the active region; the remaining page is scanned after the dock is visible. */
  deferNonSelected: boolean;
  onPluginRuntimeChange: (runtime: VisualCardPluginRuntimeByRegion) => void;
  onRegionPreviewChange: (previews: VisualPageRegionPreviewByRegion) => void;
}) {
  const touchedRef = useRef<Set<HTMLElement>>(new Set());
  const insertedRef = useRef<Set<HTMLElement>>(new Set());
  const [domRevision, setDomRevision] = useState(0);

  useEffect(() => {
    const root = findVisualPageLayoutRoot();
    if (!root || typeof MutationObserver === "undefined") return;
    let animationFrame = 0;
    const refreshLivePreview = (records: MutationRecord[]) => {
      if (!records.some((record) => (
        record.type === "attributes"
        || (record.type === "childList"
          && (record.addedNodes.length || record.removedNodes.length)
          && !isVisualComponentInstanceMutation(record))
      ))) return;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => setDomRevision((current) => current + 1));
    };
    // Structural discovery keeps its original narrow contract so the shared
    // marker synchronizer and the Developer continue to react in lockstep.
    const discoveryObserver = new MutationObserver(refreshLivePreview);
    discoveryObserver.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [...SHARED_SMALL_CARD_DISCOVERY_MUTATION_ATTRIBUTES],
    });
    // Semantic state and root theme projections do not necessarily alter the
    // card tree, but they do change the computed live-preview snapshot.
    const livePreviewObserver = new MutationObserver(refreshLivePreview);
    livePreviewObserver.observe(root, {
      subtree: true,
      attributes: true,
      attributeFilter: [...SHARED_DEVELOPER_LIVE_PREVIEW_MUTATION_ATTRIBUTES],
    });
    livePreviewObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [...SHARED_DEVELOPER_LIVE_PREVIEW_DOCUMENT_THEME_MUTATION_ATTRIBUTES],
    });
    return () => {
      discoveryObserver.disconnect();
      livePreviewObserver.disconnect();
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    const touched = touchedRef.current;
    const inserted = insertedRef.current;
    clearRuntimeElements(touched);
    touched.clear();
    inserted.forEach((element) => element.remove());
    inserted.clear();
    document.documentElement.toggleAttribute("data-visual-card-editor-open", editorOpen);
    if (!config) {
      onPluginRuntimeChange({});
      onRegionPreviewChange({});
      return;
    }

    const activeReports = new Map<VisualCardRegionId, VisualCardPluginRuntimeReport[]>();
    const capabilityReports = new Map<VisualCardRegionId, VisualCardPluginRuntimeReport[]>();
    const targetsByRegion = new Map<VisualCardRegionId, HTMLElement[]>();
    const bindPluginRuntime = (
      target: HTMLElement,
      regionId: VisualCardRegionId,
      pluginIds: readonly KnownContentPluginId[],
    ) => {
      const active = applyVisualCardPluginRuntime(target, pluginIds, { observe: false });
      if (!editorOpen || regionId !== selectedRegionId) return;
      const capability = inspectVisualCardPluginRuntime(
        target,
        getVisualCardRegionContract(regionId).allowedPlugins,
      );
      activeReports.set(regionId, [...(activeReports.get(regionId) || []), active]);
      capabilityReports.set(regionId, [...(capabilityReports.get(regionId) || []), capability]);
    };

    const root = findVisualPageLayoutRoot();
    const activeRegionIds = deferNonSelected
      ? (selectedRegionId === "total-frame" ? [] : [selectedRegionId])
      : [...VISUAL_CARD_EDITABLE_REGION_IDS];
    if (root) {
      const initialTargets = deferNonSelected
        ? new Map(activeRegionIds.map((regionId) => [
          regionId,
          collectVisualPageRegionTargetsForRegion(root, regionId),
        ]))
        : collectVisualPageRegionTargets(root);
      const lastInsertedByRegion = new Map<VisualCardRegionId, HTMLElement>();
      for (const instance of config.componentInstances || []) {
        if (deferNonSelected && instance.regionId !== selectedRegionId) continue;
        const definition = getVisualPageComponentDefinition(instance.definitionId);
        if (!definition || definition.regionId !== instance.regionId) continue;
        const sourceTargets = initialTargets.get(instance.regionId as VisualCardEditableRegionId) || [];
        const sourceTarget = sourceTargets[0];
        const anchor = lastInsertedByRegion.get(instance.regionId) || sourceTargets[sourceTargets.length - 1];
        const element = createVisualComponentInstanceElement(instance, definition, sourceTarget);
        if (anchor?.parentElement) anchor.after(element);
        else root.appendChild(element);
        inserted.add(element);
        lastInsertedByRegion.set(instance.regionId, element);
      }
    }
    const discoveredTargets = root
      ? deferNonSelected
        ? new Map(activeRegionIds.map((regionId) => [
          regionId,
          collectVisualPageRegionTargetsForRegion(root, regionId),
        ]))
        : collectVisualPageRegionTargets(root)
      : new Map<VisualCardEditableRegionId, HTMLElement[]>();
    if (root) {
      const frameNode = getRegionNode(config, "total-frame");
      touched.add(root);
      targetsByRegion.set("total-frame", [root]);
      root.setAttribute("data-visual-card-runtime-region", "total-frame");
      root.style.setProperty("--visual-card-frame-top", `${config.frameInsets.top}px`);
      root.style.setProperty("--visual-card-frame-right", `${config.frameInsets.right}px`);
      root.style.setProperty("--visual-card-frame-bottom", `${config.frameInsets.bottom}px`);
      root.style.setProperty("--visual-card-frame-left", `${config.frameInsets.left}px`);
      if (frameNode) {
        root.setAttribute("data-visual-card-runtime-style", frameNode.stylePresetId);
        root.setAttribute("data-visual-card-runtime-placement", frameNode.placement);
        root.setAttribute("data-visual-card-runtime-collapsed", String(frameNode.collapsed));
        root.setAttribute("data-visual-card-runtime-plugins", frameNode.pluginIds.join(" "));
      }
      applyVisualCardComponentStyleRuntime(root, "total-frame", config.componentStyles?.["total-frame"]);
      if (editorOpen && selectedRegionId === "total-frame") root.setAttribute("data-visual-card-editor-selected", "true");
    }

    for (const regionId of activeRegionIds) {
      const node = getRegionNode(config, regionId);
      if (!node) continue;
      const targets = (discoveredTargets.get(regionId) || []).filter(isVisibleElement);
      const annotationTargets = targets.filter(isVisualAnnotationTarget);
      const annotationIndexes = new Map(annotationTargets.map((target, index) => [target, index] as const));
      targetsByRegion.set(regionId, targets);
      for (const [index, target] of targets.entries()) {
        touched.add(target);
        target.setAttribute("data-visual-card-runtime-region", regionId);
        target.setAttribute("data-visual-card-runtime-style", node.stylePresetId);
        target.setAttribute("data-visual-card-runtime-placement", node.placement);
        target.setAttribute("data-visual-card-runtime-collapsed", String(node.collapsed));
        target.setAttribute("data-visual-card-runtime-plugins", node.pluginIds.join(" "));
        target.setAttribute("data-visual-contract-region", regionId);
        target.setAttribute("data-visual-contract-label", getVisualCardRegionContract(regionId).label);
        target.setAttribute("data-visual-contract-index", String(index + 1));
        target.setAttribute("data-visual-contract-page", `${window.location.pathname}${window.location.search}`);
        const annotationIndex = annotationIndexes.get(target);
        if (annotationIndex !== undefined) {
          target.setAttribute("data-visual-contract-annotation", formatVisualContractAnnotation(regionId, annotationIndex, annotationTargets.length));
        }
        applyVisualCardComponentStyleRuntime(target, regionId, config.componentStyles?.[regionId]);
        if (regionId === "workspace") {
          const bodyMarkerHost = findExistingWorkspaceBodyMarkerHost(target);
          if (bodyMarkerHost) {
            touched.add(bodyMarkerHost);
            bodyMarkerHost.setAttribute(EXISTING_WORKSPACE_BODY_MARKER_HOST_ATTRIBUTE, "true");
            bodyMarkerHost.setAttribute("data-visual-contract-annotation", target.getAttribute("data-visual-contract-annotation") || "主体");
            const annotation = config.componentStyles?.workspace?.annotation;
            applyVisualCardComponentStyleRuntime(
              bodyMarkerHost,
              "workspace",
              annotation ? { annotation } : undefined,
            );
          }
        }
        const instanceId = target.getAttribute("data-visual-component-instance-host");
        const instance = instanceId ? config.componentInstances?.find((item) => item.id === instanceId) : undefined;
        const definition = instance ? getVisualPageComponentDefinition(instance.definitionId) : undefined;
        if (definition) target.setAttribute("data-visual-card-runtime-style", definition.stylePresetId);
        if (editorOpen && regionId === selectedRegionId) target.setAttribute("data-visual-card-editor-selected", "true");
      }
    }

    // All region owners are marked before capability lookup. This prevents a
    // parent content/table/card region from claiming controls owned by a
    // nested child card.
    if (root) {
      bindPluginRuntime(root, "total-frame", getRegionNode(config, "total-frame")?.pluginIds || []);
    }
    for (const regionId of activeRegionIds) {
      const pluginIds = getRegionNode(config, regionId)?.pluginIds || [];
      for (const target of targetsByRegion.get(regionId) || []) {
        bindPluginRuntime(target, regionId, pluginIds);
      }
    }

    const nextPluginRuntime: VisualCardPluginRuntimeByRegion = {};
    if (editorOpen) {
      const contract = getVisualCardRegionContract(selectedRegionId);
      const reports = capabilityReports.get(selectedRegionId) || [];
      nextPluginRuntime[selectedRegionId] = {
        active: mergeVisualCardPluginReports(
          activeReports.get(selectedRegionId) || [],
          getRegionNode(config, selectedRegionId)?.pluginIds || [],
        ),
        capability: mergeVisualCardPluginReports(reports, contract.allowedPlugins),
        targetCount: targetsByRegion.get(selectedRegionId)?.length || 0,
      };
    }
    onPluginRuntimeChange(nextPluginRuntime);

    const nextRegionPreviews: VisualPageRegionPreviewByRegion = {};
    if (editorOpen) {
      const targets = targetsByRegion.get(selectedRegionId) || [];
      nextRegionPreviews[selectedRegionId] = targets.map((target, index) => createVisualRegionPreviewSnapshot(
        target,
        selectedRegionId,
        index,
        targets.length,
      ));
    }
    onRegionPreviewChange(nextRegionPreviews);

    return () => {
      clearRuntimeElements(touched);
      touched.clear();
      inserted.forEach((element) => element.remove());
      inserted.clear();
    };
  }, [config, deferNonSelected, domRevision, editorOpen, onPluginRuntimeChange, onRegionPreviewChange, selectedRegionId]);

  useEffect(() => () => document.documentElement.removeAttribute("data-visual-card-editor-open"), []);
  return null;
}

export function VisualPageEditorDock({
  open,
  onOpenChange,
  pathname,
  search,
  readOnly,
  sourceLabel,
  initialApplicationScope = "current-page",
  applicationScopeLock,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
  search: string;
  readOnly: boolean;
  sourceLabel: string;
  initialApplicationScope?: VisualCardEditorApplicationScope;
  applicationScopeLock?: VisualCardEditorApplicationScope;
}) {
  const appliedLayout = useProductMarketStore((state) => state.visualCardLayout);
  const layoutStyle = useProductMarketStore((state) => state.layoutStyle);
  const sidebarStyle = useProductMarketStore((state) => state.sidebarStyle);
  const globalFontFamily = useProductMarketStore((state) => state.globalFontFamily);
  const globalFontWeight = useProductMarketStore((state) => state.globalFontWeight);
  const globalLetterSpacing = useProductMarketStore((state) => state.globalLetterSpacing);
  const scope = useMemo<VisualCardLayoutScope>(() => ({
    workspaceScope: resolveVisualCardWorkspaceScope(pathname),
    pathname,
    search,
  }), [pathname, search]);
  const canaryIntent = useMemo(() => typeof window === "undefined" ? null : readDeveloperGlobalStyleVisualIntent(
    window.sessionStorage,
    {
      workspaceScope: scope.workspaceScope,
      pathname,
      search,
    },
  ), [pathname, scope.workspaceScope, search]);
  const scopeKey = useMemo(() => buildVisualCardLayoutScopeKey(scope), [scope]);
  const requestedInitialApplicationScope: VisualCardEditorApplicationScope = canaryIntent
    ? "canary-profile"
    : initialApplicationScope === "canary-profile" ? "current-page" : initialApplicationScope;
  const resolvedApplicationScopeLock: VisualCardEditorApplicationScope | undefined = canaryIntent
    ? "canary-profile"
    : applicationScopeLock === "canary-profile" ? "current-page" : applicationScopeLock;
  const resolvedInitialApplicationScope = resolvedApplicationScopeLock ?? requestedInitialApplicationScope;
  const globalFrameWorkflow = resolvedApplicationScopeLock === "global";
  const [pageOverride, setPageOverride] = useState<VisualCardLayoutConfig | null>(() => readVisualCardPageOverride(scope));
  const [latestAuditRecord, setLatestAuditRecord] = useState<PageCompositionAuditRecord | null>(
    () => listPageCompositionAuditRecords(pathname, search, {
      actionScope: resolvedInitialApplicationScope === "global" ? "global" : "page",
    })[0] || null,
  );
  const [inheritanceResetConfirmationOpen, setInheritanceResetConfirmationOpen] = useState(false);
  const [inheritancePreviewRevision, setInheritancePreviewRevision] = useState(0);
  const effectiveAppliedLayout = useMemo(() => {
    if (!appliedLayout && !pageOverride) return null;
    return composeVisualCardLayout(appliedLayout || createDefaultVisualCardLayout(), pageOverride);
  }, [appliedLayout, pageOverride]);
  const initialLayout = useMemo(
    () => effectiveAppliedLayout ? cloneVisualCardLayout(effectiveAppliedLayout) : createDefaultVisualCardLayout(),
    [effectiveAppliedLayout],
  );
  const [baseline, setBaseline] = useState<VisualCardLayoutConfig>(() => initialLayout);
  const [draft, setDraft] = useState<VisualCardLayoutConfig>(() => initialLayout);
  const [activeApplicationScope, setActiveApplicationScope] = useState<VisualCardEditorApplicationScope>(
    () => resolvedInitialApplicationScope,
  );
  const [selectedRegionId, setSelectedRegionId] = useState<VisualCardRegionId>(
    () => resolvedInitialApplicationScope === "canary-profile"
      ? "workspace"
      : resolvedInitialApplicationScope === "current-page" ? "table-header" : "total-frame",
  );
  const [activeParameterSection, setActiveParameterSection] = useState<VisualCardParameterSection>("basic");
  const [pluginRuntimeByRegion, setPluginRuntimeByRegion] = useState<VisualCardPluginRuntimeByRegion>({});
  const [regionPreviewByRegion, setRegionPreviewByRegion] = useState<VisualPageRegionPreviewByRegion>({});
  const [activeComponentCollection, setActiveComponentCollection] = useState<VisualComponentCollection>("live");
  const [selectedLivePreviewKey, setSelectedLivePreviewKey] = useState<string | null>(null);
  const [selectedSharedDefinitionId, setSelectedSharedDefinitionId] = useState<string | null>(null);
  const [expandedComponentInstanceId, setExpandedComponentInstanceId] = useState<string | null>(null);
  const [expandedPluginGroup, setExpandedPluginGroup] = useState<ContentPluginGroup | null>("actions");
  const [selectedPluginId, setSelectedPluginId] = useState<KnownContentPluginId | null>(null);
  const [pluginPreviewState, setPluginPreviewState] = useState<ContentPluginPreviewState>("default");
  const [sharedStyleDraft, setSharedStyleDraft] = useState<VisualCardSharedStyleApplyPatch>({
    layoutStyle: {},
    globalTypography: {},
  });
  const [lastSelectedRegionByScope, setLastSelectedRegionByScope] = useState<Record<VisualCardEditorApplicationScope, VisualCardRegionId>>({
    global: "total-frame",
    "current-page": "table-header",
    "canary-profile": "workspace",
  });
  const [windowRect, setWindowRect] = useState<VisualCardEditorWindowRect>(() => createDefaultVisualCardEditorWindowRect(
    typeof window === "undefined" ? 1280 : window.innerWidth,
    typeof window === "undefined" ? 800 : window.innerHeight,
  ));
  const [windowInteraction, setWindowInteraction] = useState<VisualCardEditorWindowInteraction | null>(null);
  const [draggingDefinitionId, setDraggingDefinitionId] = useState<string | null>(null);
  const [runtimeFullPassReady, setRuntimeFullPassReady] = useState(false);
  const previousScopeKeyRef = useRef(scopeKey);

  const baselineGlobalTypography = useMemo<VisualCardGlobalTypography>(() => ({
    globalFontFamily,
    globalFontWeight,
    globalLetterSpacing,
  }), [globalFontFamily, globalFontWeight, globalLetterSpacing]);
  const effectiveSharedLayoutStyle = useMemo<LayoutCustomStyle>(() => ({
    ...layoutStyle,
    ...sharedStyleDraft.layoutStyle,
  }), [layoutStyle, sharedStyleDraft.layoutStyle]);
  const effectiveGlobalTypography = useMemo<VisualCardGlobalTypography>(() => ({
    ...baselineGlobalTypography,
    ...sharedStyleDraft.globalTypography,
  }), [baselineGlobalTypography, sharedStyleDraft.globalTypography]);

  useEffect(() => {
    if (previousScopeKeyRef.current === scopeKey) return;
    const nextPageOverride = readVisualCardPageOverride(scope);
    const nextAppliedLayout = composeVisualCardLayout(
      appliedLayout || createDefaultVisualCardLayout(),
      nextPageOverride,
    );
    previousScopeKeyRef.current = scopeKey;
    setPageOverride(nextPageOverride);
    setBaseline(nextAppliedLayout);
    setDraft(nextAppliedLayout);
  }, [appliedLayout, pathname, scope, scopeKey, search]);

  useEffect(() => {
    const auditScope = activeApplicationScope === "global" ? "global" : "page";
    setLatestAuditRecord(listPageCompositionAuditRecords(pathname, search, { actionScope: auditScope })[0] || null);
    setInheritanceResetConfirmationOpen(false);
  }, [activeApplicationScope, pathname, search]);

  useEffect(() => {
    const refreshInheritancePreview = () => setInheritancePreviewRevision((current) => current + 1);
    window.addEventListener(PAGE_CSS_PROFILE_EVENT, refreshInheritancePreview);
    window.addEventListener(PAGE_LAYOUT_LOCK_EVENT, refreshInheritancePreview);
    return () => {
      window.removeEventListener(PAGE_CSS_PROFILE_EVENT, refreshInheritancePreview);
      window.removeEventListener(PAGE_LAYOUT_LOCK_EVENT, refreshInheritancePreview);
    };
  }, []);

  useEffect(() => {
    if (open) return;
    setBaseline(initialLayout);
    setDraft(initialLayout);
    setSharedStyleDraft({ layoutStyle: {}, globalTypography: {} });
  }, [initialLayout, open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const hasSharedPreview = Object.keys(sharedStyleDraft.layoutStyle).length > 0
      || Object.keys(sharedStyleDraft.globalTypography).length > 0;
    if (!hasSharedPreview) return;
    const pageRoot = findVisualPageLayoutRoot();
    const roots = Array.from(new Set<HTMLElement>([
      document.documentElement,
      ...(pageRoot?.closest<HTMLElement>(".app-shell") ? [pageRoot.closest<HTMLElement>(".app-shell")!] : []),
      ...(pageRoot ? [pageRoot] : []),
    ]));
    const propertyNames = [...GLOBAL_THEME_TOKEN_NAMES, ...GLOBAL_TYPOGRAPHY_PROPERTIES];
    const previous = new Map(roots.map((root) => [
      root,
      new Map(propertyNames.map((property) => [property, root.style.getPropertyValue(property)])),
    ]));
    const tokens = resolveGlobalThemeTokens(effectiveSharedLayoutStyle, sidebarStyle);
    roots.forEach((root) => {
      GLOBAL_THEME_TOKEN_NAMES.forEach((property) => root.style.setProperty(property, tokens[property]));
      root.style.setProperty("--tradepro-global-font-family", effectiveGlobalTypography.globalFontFamily || "inherit");
      root.style.setProperty("--tradepro-global-font-weight", effectiveGlobalTypography.globalFontWeight || "400");
      root.style.setProperty("--tradepro-global-letter-spacing", effectiveGlobalTypography.globalLetterSpacing || "0em");
    });
    document.documentElement.setAttribute("data-visual-card-shared-style-preview", "true");
    return () => {
      const latest = useProductMarketStore.getState();
      const sharedSourceChanged = latest.layoutStyle !== layoutStyle
        || latest.sidebarStyle !== sidebarStyle
        || latest.globalFontFamily !== globalFontFamily
        || latest.globalFontWeight !== globalFontWeight
        || latest.globalLetterSpacing !== globalLetterSpacing;
      if (sharedSourceChanged) {
        const latestTokens = resolveGlobalThemeTokens(latest.layoutStyle, latest.sidebarStyle);
        roots.forEach((root) => {
          GLOBAL_THEME_TOKEN_NAMES.forEach((property) => root.style.setProperty(property, latestTokens[property]));
          root.style.setProperty("--tradepro-global-font-family", latest.globalFontFamily || "inherit");
          root.style.setProperty("--tradepro-global-font-weight", latest.globalFontWeight || "400");
          root.style.setProperty("--tradepro-global-letter-spacing", latest.globalLetterSpacing || "0em");
        });
      } else {
        previous.forEach((properties, root) => {
          properties.forEach((value, property) => {
            if (value) root.style.setProperty(property, value);
            else root.style.removeProperty(property);
          });
        });
      }
      document.documentElement.removeAttribute("data-visual-card-shared-style-preview");
    };
  }, [effectiveGlobalTypography, effectiveSharedLayoutStyle, globalFontFamily, globalFontWeight, globalLetterSpacing, layoutStyle, open, sharedStyleDraft, sidebarStyle]);

  useEffect(() => {
    if (!open || canaryIntent) return;
    writeVisualCardEditorLayout(scope, draft);
  }, [canaryIntent, draft, open, scope]);

  useEffect(() => {
    if (!open) {
      setWindowInteraction(null);
      return;
    }
    setWindowRect(createDefaultVisualCardEditorWindowRect(window.innerWidth, window.innerHeight));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setRuntimeFullPassReady(false);
      return;
    }
    // Give the shell and active editor region one paint first.  The full page
    // marker scan is still performed immediately after that first frame.
    setRuntimeFullPassReady(false);
    const timer = window.setTimeout(() => setRuntimeFullPassReady(true), 120);
    return () => window.clearTimeout(timer);
  }, [open, pathname, search]);

  useEffect(() => {
    if (!open) return;
    const clampToViewport = () => setWindowRect((current) => clampVisualCardEditorWindowRect(current, window.innerWidth, window.innerHeight));
    window.addEventListener("resize", clampToViewport);
    return () => window.removeEventListener("resize", clampToViewport);
  }, [open]);

  useEffect(() => {
    if (!windowInteraction) return;
    document.documentElement.setAttribute(
      "data-visual-card-window-interaction",
      getVisualCardEditorWindowInteractionName(windowInteraction),
    );

    const finishInteraction = () => setWindowInteraction(null);
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== windowInteraction.pointerId) return;
      if ((event.buttons & 1) === 0) {
        finishInteraction();
        return;
      }
      event.preventDefault();
      const deltaX = event.clientX - windowInteraction.startX;
      const deltaY = event.clientY - windowInteraction.startY;
      if (windowInteraction.mode === "drag") {
        setWindowRect(clampVisualCardEditorWindowRect({
          ...windowInteraction.startRect,
          left: windowInteraction.startRect.left + deltaX,
          top: windowInteraction.startRect.top + deltaY,
        }, window.innerWidth, window.innerHeight));
        return;
      }

      if (!windowInteraction.edge) return;
      setWindowRect(clampVisualCardEditorWindowRect(resolveCenteredWindowResize({
        start: windowInteraction.startRect,
        edge: windowInteraction.edge,
        deltaX,
        deltaY,
        minWidth: VISUAL_CARD_EDITOR_MIN_WIDTH,
        minHeight: VISUAL_CARD_EDITOR_MIN_HEIGHT,
        bounds: {
          left: VISUAL_CARD_EDITOR_VIEWPORT_MARGIN,
          top: VISUAL_CARD_EDITOR_VIEWPORT_MARGIN,
          right: window.innerWidth - VISUAL_CARD_EDITOR_VIEWPORT_MARGIN,
          bottom: window.innerHeight - VISUAL_CARD_EDITOR_VIEWPORT_MARGIN,
        },
      }), window.innerWidth, window.innerHeight));
    };
    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId === windowInteraction.pointerId) finishInteraction();
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    window.addEventListener("blur", finishInteraction);
    return () => {
      document.documentElement.removeAttribute("data-visual-card-window-interaction");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      window.removeEventListener("blur", finishInteraction);
    };
  }, [windowInteraction]);

  const selectedContract = getVisualCardRegionContract(selectedRegionId);
  const isSharedProfileScope = activeApplicationScope === "global" || activeApplicationScope === "canary-profile";
  const persistedApplicationScope: VisualCardApplicationScope = isSharedProfileScope ? "global" : "current-page";
  const visibleRegionIds: readonly VisualCardRegionId[] = VISUAL_CARD_SCOPE_SELECTION_IDS[activeApplicationScope];
  const componentDefinitions = useMemo(
    () => listVisualPageComponentDefinitions([selectedRegionId]),
    [selectedRegionId],
  );
  const componentContracts = useMemo(
    () => listVisualPageComponentContracts([selectedRegionId]),
    [selectedRegionId],
  );
  const compositionImpact = useMemo(
    () => buildPageCompositionImpactMap(
      pathname,
      search,
      isSharedProfileScope ? "global" : "content",
    ),
    [isSharedProfileScope, pathname, search],
  );
  const compositionImpactTargets = isSharedProfileScope
    ? compositionImpact.targets.map((target) => activeApplicationScope === "canary-profile"
      ? { ...target, effect: `${target.effect}（当前仅临时预览并写入试点档案）` }
      : target)
    : [{ label: "当前页面", effect: "只保存本机浏览器当前路由与查询范围的页面展示草稿/覆盖，不是服务端项目版本。" }];
  const compositionImpactTargetSummary = isSharedProfileScope
    ? `${GLOBAL_FRAME_COMPATIBLE_TARGET_COUNT} 个兼容目标 · ${GLOBAL_FRAME_ISOLATED_TARGET_COUNT} 个明确隔离`
    : `${compositionImpactTargets.length} 个目标`;
  const inheritancePreviewCacheKey = `${scopeKey}:${readOnly ? "read-only" : "writable"}:${appliedLayout?.updatedAt || "no-global"}:${pageOverride?.updatedAt || "no-page"}:${inheritancePreviewRevision}`;
  const currentPageInheritancePreview = useMemo(() => {
    void inheritancePreviewCacheKey;
    return inspectCurrentPageGlobalInheritance(pathname, search, { readOnly });
  }, [inheritancePreviewCacheKey, pathname, readOnly, search]);
  const visibleComponentInstances = (draft.componentInstances || [])
    .filter((instance) => instance.applicationScope === persistedApplicationScope && instance.regionId === selectedRegionId);
  const selectedNode = getRegionNode(draft, selectedRegionId) || getRegionNode(createDefaultVisualCardLayout(), selectedRegionId)!;
  const selectedComponentStyle = draft.componentStyles?.[selectedRegionId] || {};
  const selectedSharedStyle = resolveVisualCardSharedRegionStyle(
    selectedRegionId,
    effectiveSharedLayoutStyle,
    sidebarStyle,
    effectiveGlobalTypography,
  );
  const selectedPluginRuntime = pluginRuntimeByRegion[selectedRegionId];
  const selectedRegionPreviews = regionPreviewByRegion[selectedRegionId] || [];
  const uniqueSelectedRegionPreviews = deduplicateVisualRegionPreviews(selectedRegionPreviews);
  const pluginDefinitions = selectedContract.allowedPlugins.map((pluginId) => getContentPluginDefinition(pluginId));
  const availablePluginGroups = (["visual", "actions", "status"] as const)
    .filter((groupId) => pluginDefinitions.some((plugin) => plugin.group === groupId));
  const selectedSharedDefinition = selectedSharedDefinitionId
    ? componentDefinitions.find((definition) => definition.id === selectedSharedDefinitionId)
    : undefined;
  const selectedSharedContract = selectedSharedDefinition
    ? getVisualPageComponentContract(selectedSharedDefinition.id)
    : undefined;
  const selectedInheritance = selectedSharedContract
    ? resolveVisualComponentInheritance(selectedSharedContract, {
      workspaceScope: scope.workspaceScope,
      hasGlobalContract: Boolean(appliedLayout),
      hasPageOverride: Boolean(pageOverride),
      hasInstanceOverride: visibleComponentInstances.some((instance) => instance.definitionId === selectedSharedContract.definitionId),
    })
    : [];
  const selectedLivePreview = selectedLivePreviewKey
    ? uniqueSelectedRegionPreviews.find((preview) => preview.key === selectedLivePreviewKey)
    : undefined;
  const selectedPluginDefinition = selectedPluginId
    ? pluginDefinitions.find((plugin) => plugin.id === selectedPluginId)
    : undefined;
  const selectedPluginPreviewStates = selectedPluginDefinition
    ? listContentPluginPreviewStates(selectedPluginDefinition.id)
    : [];
  const resolvePluginPresentation = (pluginId: KnownContentPluginId) => {
    const enabled = selectedNode.pluginIds.includes(pluginId);
    const capability = selectedPluginRuntime?.capability.results.find((item) => item.pluginId === pluginId);
    const activeResult = selectedPluginRuntime?.active.results.find((item) => item.pluginId === pluginId);
    const unavailable = capability ? !capability.effective : false;
    const hasRegionTarget = (selectedPluginRuntime?.targetCount || 0) > 0;
    const runtimeLabel = enabled
      ? activeResult?.effective
        ? activeResult.status === "bound" ? "已连接" : "已生效"
        : hasRegionTarget ? "需接入" : "无承载"
      : unavailable ? hasRegionTarget ? "需接入" : "无承载" : "可启用";
    return { enabled, capability, activeResult, unavailable, runtimeLabel };
  };
  const sharedStyleDirty = Object.keys(sharedStyleDraft.layoutStyle).length > 0
    || Object.keys(sharedStyleDraft.globalTypography).length > 0;
  const globalDirty = comparableLayoutForApplicationScope(draft, "global")
    !== comparableLayoutForApplicationScope(baseline, "global")
    || sharedStyleDirty;
  const currentPageDirty = comparableLayoutForApplicationScope(draft, "current-page")
    !== comparableLayoutForApplicationScope(baseline, "current-page");
  const dirty = isSharedProfileScope ? globalDirty : currentPageDirty;
  const isTotalFrame = selectedRegionId === "total-frame";
  const canEditSharedStyle = (field: keyof VisualCardSharedStyleEdit) => selectedSharedStyle.editableFields.includes(field);
  const runtimeLayout = useMemo(
    () => open ? draft : effectiveAppliedLayout,
    [draft, effectiveAppliedLayout, open],
  );

  const updateSelected = (update: (node: VisualCardLayoutNode) => VisualCardLayoutNode) => {
    setDraft((current) => updateRegionNodes(current, selectedRegionId, update));
  };

  const updateSelectedComponentStyle = (
    update: (current: VisualCardComponentStyleOverrides) => VisualCardComponentStyleOverrides,
  ) => {
    setDraft((current) => normalizeVisualCardLayout({
      ...current,
      componentStyles: {
        ...(current.componentStyles || {}),
        [selectedRegionId]: update(current.componentStyles?.[selectedRegionId] || {}),
      },
      updatedAt: new Date().toISOString(),
    }));
  };

  const updateSelectedSharedStyle = (edit: VisualCardSharedStyleEdit) => {
    if (!isSharedProfileScope) return;
    setSharedStyleDraft((current) => {
      const currentLayoutStyle = { ...layoutStyle, ...current.layoutStyle };
      const currentTypography = { ...baselineGlobalTypography, ...current.globalTypography };
      const patch = buildVisualCardSharedStylePatch(
        selectedRegionId,
        edit,
        currentLayoutStyle,
        sidebarStyle,
        currentTypography,
      );
      if (patch.boundary !== "global-layout-style") return current;
      return compactSharedStyleDraft(
        { ...currentLayoutStyle, ...patch.layoutStyle },
        { ...currentTypography, ...patch.globalTypography },
        layoutStyle,
        baselineGlobalTypography,
      );
    });
  };

  const updateSharedGeometry = (patch: VisualCardSharedGeometryPatch) => {
    if (!isSharedProfileScope) return;
    setSharedStyleDraft((current) => {
      const currentLayoutStyle = { ...layoutStyle, ...current.layoutStyle, ...patch };
      const currentTypography = { ...baselineGlobalTypography, ...current.globalTypography };
      return compactSharedStyleDraft(
        currentLayoutStyle,
        currentTypography,
        layoutStyle,
        baselineGlobalTypography,
      );
    });
  };

  const commitSelectedSharedColor = (
    field: "backgroundColor" | "textColor",
    value: string,
  ) => {
    const normalized = normalizeVisualCardSharedColor(value);
    if (!normalized) {
      toast.error("颜色格式无效，请输入 #RRGGBB。");
      return undefined;
    }
    updateSelectedSharedStyle({ [field]: normalized });
    return normalized;
  };

  const resetSelectedComponentStyle = () => {
    setDraft((current) => {
      const componentStyles = { ...(current.componentStyles || {}) };
      delete componentStyles[selectedRegionId];
      return normalizeVisualCardLayout({
        ...current,
        componentStyles,
        updatedAt: new Date().toISOString(),
      });
    });
  };

  const selectRegion = (regionId: VisualCardRegionId, parameterSection: VisualCardParameterSection = "basic") => {
    setSelectedRegionId(regionId);
    setActiveParameterSection(parameterSection);
    setActiveComponentCollection("live");
    setSelectedLivePreviewKey(null);
    setSelectedSharedDefinitionId(null);
    setExpandedComponentInstanceId(null);
    setSelectedPluginId(null);
    setLastSelectedRegionByScope((current) => ({ ...current, [activeApplicationScope]: regionId }));
  };

  const replaceRegionWithDefinition = (definition: VisualPageComponentDefinition) => {
    if (!visibleRegionIds.includes(definition.regionId)) {
      toast.info(`请先切换到包含“${getVisualCardRegionContract(definition.regionId).label}”的编辑范围。`);
      return;
    }
    setDraft((current) => updateRegionNodes(current, definition.regionId, (node) => ({
      ...node,
      stylePresetId: definition.stylePresetId,
    })));
    selectRegion(definition.regionId, "components");
    setActiveComponentCollection("shared");
    setSelectedSharedDefinitionId(definition.id);
    toast.success(`${definition.label}已替换当前区域样式，业务功能保持不变。`);
  };

  const addComponentDefinition = (definition: VisualPageComponentDefinition) => {
    if (readOnly) return;
    setDraft((current) => {
      const existing = current.componentInstances || [];
      if (existing.length >= 40) {
        toast.error("当前契约最多允许 40 个新增展示组件。");
        return current;
      }
      const instance = createVisualPageComponentInstance(definition, existing, persistedApplicationScope);
      return normalizeVisualCardLayout({
        ...current,
        componentInstances: [...existing, instance],
        updatedAt: new Date().toISOString(),
      });
    });
    toast.success(`${definition.label}已增加，并自动带上区域标注。`);
  };

  const duplicateComponentInstance = (instance: VisualCardComponentInstance) => {
    const definition = getVisualPageComponentDefinition(instance.definitionId);
    if (definition) addComponentDefinition(definition);
  };

  const deleteComponentInstance = (instanceId: string) => {
    setDraft((current) => normalizeVisualCardLayout({
      ...current,
      componentInstances: (current.componentInstances || []).filter((instance) => instance.id !== instanceId),
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleComponentDragStart = (event: ReactDragEvent<HTMLElement>, definition: VisualPageComponentDefinition) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(VISUAL_COMPONENT_DRAG_MIME, definition.id);
    setDraggingDefinitionId(definition.id);
  };

  const readDraggedDefinition = (event: ReactDragEvent<HTMLElement>) => {
    const id = event.dataTransfer.getData(VISUAL_COMPONENT_DRAG_MIME) || draggingDefinitionId || "";
    return getVisualPageComponentDefinition(id);
  };

  const dropToReplaceRegion = (event: ReactDragEvent<HTMLElement>, regionId: VisualCardRegionId) => {
    event.preventDefault();
    setDraggingDefinitionId(null);
    const definition = readDraggedDefinition(event);
    if (!definition) return;
    if (definition.regionId !== regionId) {
      toast.error(`“${definition.label}”只能投放到${getVisualCardRegionContract(definition.regionId).label}区域。`);
      return;
    }
    replaceRegionWithDefinition(definition);
  };

  const dropToAddComponent = (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    setDraggingDefinitionId(null);
    const definition = readDraggedDefinition(event);
    if (definition) addComponentDefinition(definition);
  };

  const selectApplicationScope = (nextScope: VisualCardEditorApplicationScope) => {
    if (resolvedApplicationScopeLock && nextScope !== resolvedApplicationScopeLock) {
      toast.info(resolvedApplicationScopeLock === "canary-profile"
        ? "全局开发流程试点固定使用试点档案；不会写当前页覆盖或全局配置。"
        : resolvedApplicationScopeLock === "current-page"
          ? "当前页面流程已锁定 current-page；如需自由切换，请关闭后从顶部可视化入口手动打开。"
          : "共享全局流程已锁定 global；不能绕过全局治理边界切换到当前页。");
      return;
    }
    const nextRegionId = lastSelectedRegionByScope[nextScope];
    setActiveApplicationScope(nextScope);
    setSelectedRegionId(nextRegionId);
    setActiveParameterSection("basic");
    setActiveComponentCollection("live");
    setSelectedLivePreviewKey(null);
    setSelectedSharedDefinitionId(null);
    setExpandedComponentInstanceId(null);
    setSelectedPluginId(null);
  };

  const startWindowDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, input, select, textarea, a, [role='button']")) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Window listeners remain the fallback when pointer capture is unavailable.
    }
    setWindowInteraction({
      mode: "drag",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRect: windowRect,
    });
  };

  const startWindowResize = (edge: SharedWindowResizeEdge) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Window listeners remain the fallback when pointer capture is unavailable.
    }
    setWindowInteraction({
      mode: "resize",
      edge,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRect: windowRect,
    });
  };


  const togglePlugin = (pluginId: KnownContentPluginId) => {
    updateSelected((node) => ({
      ...node,
      pluginIds: node.pluginIds.includes(pluginId)
        ? node.pluginIds.filter((item) => item !== pluginId)
        : [...node.pluginIds, pluginId],
    }));
  };

  const updateInset = (side: keyof VisualCardLayoutConfig["frameInsets"], value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    setDraft((current) => normalizeVisualCardLayout({
      ...current,
      frameInsets: { ...current.frameInsets, [side]: Math.max(0, Math.min(160, Math.round(parsed))) },
      updatedAt: new Date().toISOString(),
    }));
  };

  const applyApplicationScope = (applicationScope: VisualCardEditorApplicationScope) => {
    if (readOnly) {
      toast.error("当前端只读取已发布规范，不能直接修改模板。");
      return;
    }
    const config = cloneVisualCardLayout({ ...draft, updatedAt: new Date().toISOString() });
    const canaryProfile = applicationScope === "canary-profile";
    const effectiveCanarySharedStylePatch: VisualCardSharedStyleApplyPatch = {
      layoutStyle: { ...layoutStyle, ...sharedStyleDraft.layoutStyle },
      globalTypography: { ...baselineGlobalTypography, ...sharedStyleDraft.globalTypography },
    };
    const detail: VisualCardDirectApplyWithSharedStyleDetail = {
      scopeKey,
      config,
      applicationScope,
      ...(canaryProfile
        ? { sharedStylePatch: effectiveCanarySharedStylePatch, canaryBaselineOnly: !globalDirty }
        : applicationScope === "global" && sharedStyleDirty
          ? { sharedStylePatch: sharedStyleDraft }
        : {}),
      accepted: false,
    };
    window.dispatchEvent(new CustomEvent<VisualCardDirectApplyDetail>(VISUAL_CARD_DIRECT_APPLY_EVENT, { detail }));
    if (!detail.accepted) {
      toast.error(detail.error || "当前真实页面尚未接入可视化保存，未写入任何配置。");
      return;
    }
    const appliedConfig = cloneVisualCardLayout(detail.appliedConfig || config);
    if (canaryProfile) {
      setBaseline(appliedConfig);
      setDraft(appliedConfig);
      setLatestAuditRecord(listPageCompositionAuditRecords(pathname, search, { actionScope: "page" })[0] || null);
      toast.success(`${globalDirty ? "共享外观试点档案" : "已一致基线确认"}已记录；未写入当前页或全局配置${detail.auditId ? "，并已关联恢复点" : ""}。`);
      onOpenChange(false);
      window.setTimeout(() => {
        requestDevelopmentConsoleReopen({
          pathname,
          search,
          workspaceScope: scope.workspaceScope,
          applicationScope: "canary-profile",
          reason: "canary-confirmed",
        });
      }, 0);
      return;
    }
    const otherScope: VisualCardApplicationScope = applicationScope === "global" ? "current-page" : "global";
    const nextDraft = mergeVisualCardLayoutForApplicationScope(appliedConfig, draft, otherScope);
    setBaseline(appliedConfig);
    setDraft(nextDraft);
    setPageOverride(readVisualCardPageOverride(scope));
    writeVisualCardEditorLayout(scope, nextDraft);
    setLatestAuditRecord(listPageCompositionAuditRecords(pathname, search, {
      actionScope: applicationScope === "global" ? "global" : "page",
    })[0] || null);
    if (applicationScope === "global") {
      setSharedStyleDraft({ layoutStyle: {}, globalTypography: {} });
      toast.success(`已生成来源全局草稿${detail.auditId ? "，并自动建立恢复点" : ""}；尚未审核、发布或下发。`);
      if (globalFrameWorkflow) {
        const visualDraftId = detail.auditId;
        const recoveryPointId = detail.recoveryPointId;
        const exactGlobalLayout = mergeVisualCardLayoutForApplicationScope(
          createDefaultVisualCardLayout(),
          appliedConfig,
          "global",
        );
        const visualDraftStored = Boolean(visualDraftId && recoveryPointId) && writeDeveloperGlobalFrameVisualDraft(
          window.sessionStorage,
          {
            id: visualDraftId!,
            workspaceScope: scope.workspaceScope,
            pathname,
            search,
            appearance: createDeveloperGlobalStyleCanaryAppearance(exactGlobalLayout, effectiveCanarySharedStylePatch),
            visualAuditId: visualDraftId!,
            recoveryPointId: recoveryPointId!,
            savedAt: new Date().toISOString(),
          },
        );
        if (!visualDraftStored) {
          reportGlobalFrameWorkflowStatus({
            pathname,
            search,
            action: "generate-draft",
            status: "blocked",
            message: "全局草稿未能绑定精确 draftId、路由、恢复点与外观快照；未进入发布链。",
            draftId: visualDraftId,
            recoveryPointId,
          });
          toast.error("全局草稿冻结失败，请重新生成。");
          return;
        }
        reportGlobalFrameWorkflowStatus({
          pathname,
          search,
          action: "generate-draft",
          status: "passed",
          message: "可视化全局草稿已生成；下一步由唯一发布协调器执行三端全局预检。",
          draftId: visualDraftId,
          recoveryPointId,
          validationEntries: ["本次操作只生成来源草稿，没有审核、发布或下发三端。"],
        });
        onOpenChange(false);
      }
    } else {
      toast.success(`本机当前页草稿已保存，不改动全局模板、不进入发布链${detail.auditId ? "，并自动建立本机恢复点" : ""}。`);
    }
  };

  const closeEditor = () => {
    setDraft(baseline);
    setSharedStyleDraft({ layoutStyle: {}, globalTypography: {} });
    onOpenChange(false);
  };

  const restoreCurrentApplicationScope = () => {
    setDraft((current) => mergeVisualCardLayoutForApplicationScope(current, baseline, activeApplicationScope));
    if (isSharedProfileScope) {
      setSharedStyleDraft({ layoutStyle: {}, globalTypography: {} });
    }
  };

  const resetCurrentApplicationScope = () => {
    setDraft((current) => mergeVisualCardLayoutForApplicationScope(current, createDefaultVisualCardLayout(), activeApplicationScope));
    if (isSharedProfileScope) {
      const defaults = createDefaultVisualCardSharedStyleApplyPatch();
      setSharedStyleDraft(compactSharedStyleDraft(
        { ...layoutStyle, ...defaults.layoutStyle },
        { ...baselineGlobalTypography, ...defaults.globalTypography },
        layoutStyle,
        baselineGlobalTypography,
      ));
    }
  };

  const undoCurrentApplicationScope = () => {
    if (!dirty) {
      toast.info("当前选中范围没有可撤销的修改。");
      return;
    }
    restoreCurrentApplicationScope();
  };

  const saveCurrentPageStyle = () => {
    if (!currentPageDirty) {
      toast.info("当前页面样式没有修改，无需重复保存。");
      return;
    }
    applyApplicationScope("current-page");
  };

  const saveCanaryProfile = () => {
    if (!canaryIntent) return;
    applyApplicationScope("canary-profile");
  };

  const syncGlobalStyle = () => {
    if (canaryIntent) {
      toast.info("试点阶段禁止同步全局；请先确认共享外观试点档案并完成营销作战验收。");
      return;
    }
    if (!globalDirty && !globalFrameWorkflow) {
      toast.info("全局样式没有修改，无需重复保存草稿。");
      return;
    }
    applyApplicationScope("global");
  };

  const restoreLatestApplicationScope = () => {
    if (!latestAuditRecord || readOnly || canaryIntent) return;
    const restoreScope = activeApplicationScope === "global" ? "global" : "page";
    setSharedStyleDraft({ layoutStyle: {}, globalTypography: {} });
    const restored = restorePageCompositionAudit(latestAuditRecord, pathname, search, restoreScope);
    if (!restored) {
      toast.error("恢复失败：恢复点不可用，或当前页面结构已锁定。");
      return;
    }
    const restoredPageOverride = readVisualCardPageOverride(scope);
    const restoredGlobalLayout = useProductMarketStore.getState().visualCardLayout || createDefaultVisualCardLayout();
    const restoredLayout = composeVisualCardLayout(restoredGlobalLayout, restoredPageOverride);
    setPageOverride(restoredPageOverride);
    setBaseline(restoredLayout);
    setDraft(restoredLayout);
    writeVisualCardEditorLayout(scope, restoredLayout);
    setLatestAuditRecord(listPageCompositionAuditRecords(pathname, search, { actionScope: restoreScope })[0] || null);
    toast.success(restoreScope === "global" ? "已恢复上次来源端全局草稿；没有触发审核或发布。" : "已恢复上次当前页面组件覆盖。");
  };

  const confirmRestoreCurrentPageGlobalInheritance = () => {
    if (activeApplicationScope !== "current-page" || canaryIntent) return;
    if (readOnly) {
      toast.error("当前端为只读状态，不能移除页面覆盖。");
      return;
    }
    const result = restoreCurrentPageGlobalInheritance(pathname, search, { readOnly });
    if (!result.ok) {
      if (result.code === "blocked") {
        const reason = result.preview.blockedBy.map((item) => ({
          "read-only": "只读",
          "browser-unavailable": "浏览器存储不可用",
          "layout-lock": "栏目结构锁",
          "page-lock": "页面锁",
          "source-lock": "源码锁",
        }[item])).join("、");
        toast.error(`无法恢复全局继承：${reason || "当前页面已锁定"}。`);
      } else if (result.code === "no-overrides") {
        toast.info("当前页面已经完全继承全局，没有可移除的页面覆盖。");
      } else if (result.code === "audit-failed") {
        toast.error("审计快照未能安全保存，未执行任何删除。");
      } else {
        toast.error(result.rolledBack
          ? "恢复未完成，已从审计快照回滚到操作前状态。"
          : "恢复失败且自动回滚未完成，请使用最近本页恢复点检查状态。");
      }
      setInheritancePreviewRevision((current) => current + 1);
      return;
    }

    const inheritedPageOverride = readVisualCardPageOverride(scope);
    const inheritedGlobalLayout = useProductMarketStore.getState().visualCardLayout || createDefaultVisualCardLayout();
    const inheritedLayout = composeVisualCardLayout(inheritedGlobalLayout, inheritedPageOverride);
    setPageOverride(inheritedPageOverride);
    setBaseline(inheritedLayout);
    setDraft(inheritedLayout);
    setSharedStyleDraft({ layoutStyle: {}, globalTypography: {} });
    writeVisualCardEditorLayout(scope, inheritedLayout);
    setLatestAuditRecord(result.audit);
    setInheritanceResetConfirmationOpen(false);
    setInheritancePreviewRevision((current) => current + 1);
    toast.success("已移除当前页视觉卡片覆盖和版面 CSS 配置，页面现已恢复全局继承；审计快照可随时恢复。");
  };

  const dock = open && typeof document !== "undefined" ? createPortal(
    <TooltipProvider delayDuration={160}>
      <aside
        data-visual-card-editor-dock
        data-shared-dialog-contract="visual-workbench"
        data-shared-resizable-window-contract="true"
        data-shared-resize-behavior={SHARED_CENTER_SYMMETRIC_RESIZE_CONTRACT}
        data-shared-window-contract={SHARED_WINDOW_CONTRACT_VERSION}
        data-shared-window-factory-default={SHARED_WINDOW_FACTORY_DEFAULT.id}
        data-shared-window-kind="workbench"
        data-shared-window-region="frame"
        data-shared-window-content="explicit"
        data-shared-window-theme-projection="active-page"
        data-shared-window-title-action-contract={SHARED_WINDOW_TITLE_ACTION_RAIL_CONTRACT}
        data-shared-window-small-card-marker-policy={SHARED_SMALL_CARD_MARKER_POLICY}
        data-shared-window-small-card-marker-contract={SHARED_SMALL_CARD_MARKER_CONTRACT_VERSION}
        data-shared-window-small-card-marker-scope-attribute={SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE}
        data-shared-window-small-card-marker-resolution={SHARED_SMALL_CARD_MARKER_RESOLUTION}
        data-shared-window-small-card-marker-runtime-attribute={SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE}
        data-shared-window-small-card-surface-runtime-attribute={SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE}
        data-visual-card-scope-key={scopeKey}
        data-visual-card-window-state={getVisualCardEditorWindowInteractionName(windowInteraction)}
        data-visual-card-runtime-phase={runtimeFullPassReady ? "complete" : "active-region"}
        aria-label="可视化开发器"
        className={cn("fixed z-[120] flex flex-col overflow-hidden border shadow-2xl", windowInteraction && "select-none")}
        style={{
          left: windowRect.left,
          top: windowRect.top,
          width: windowRect.width,
          height: windowRect.height,
          ["--tradepro-shared-runtime-window-width" as string]: `${windowRect.width}px`,
          ["--tradepro-shared-runtime-window-height" as string]: `${windowRect.height}px`,
          ["--tradepro-shared-dialog-title-min-height" as string]: "40px",
        }}
      >
        <header
          data-drag-handle
          data-shared-window-region="topbar"
          data-visual-card-window-drag-handle
          onPointerDown={startWindowDrag}
          className="flex shrink-0 touch-none cursor-move items-center justify-between gap-3 border-b border-slate-200 bg-slate-950 px-3 py-2.5 text-white"
          title={`${sourceLabel} · 按住顶部可移动窗口；修改会直接预览在真实页面`}
        >
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold"><Settings2 className="h-4 w-4" /><span className="truncate">可视化</span></div>
          <button type="button" data-visual-card-editor-close data-dialog-close data-development-standard-close data-content-plugin-control="close" data-shared-window-close="true" data-shared-window-title-action="close" onClick={closeEditor} className="content-plugin-action-button is-icon rounded-md border border-white/20 p-1.5 hover:bg-white/10" aria-label="关闭可视化"><PanelRightClose className="h-4 w-4" /></button>
        </header>

        <div data-shared-window-region="content" className="min-h-0 flex-1 overflow-y-auto p-2.5">
          {globalFrameWorkflow ? <p
            data-global-frame-visual-handoff="draft-only"
            className="mb-2 rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-2 text-[10px] font-medium leading-4 text-blue-900"
          >全局框架器 · 可视化草稿：修改会在真实页面预览；确认后只生成待审全局草稿，并返回原工作流继续三端预检，不会直接发布或下发。</p> : null}
          {canaryIntent ? <p
            data-global-style-canary-preview="canary-profile"
            className="mb-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-[10px] font-medium leading-4 text-amber-900"
          >全局开发流程试点：共享区域可在当前真实页临时预览；确认只生成 appearance-only 档案与审计，不写当前页覆盖或全局配置。营销作战通过后才进入来源草稿保存。</p> : null}
          {resolvedApplicationScopeLock ? <p data-visual-card-application-scope-lock={resolvedApplicationScopeLock} className="mb-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] leading-4 text-blue-900">流程范围已锁定为 {VISUAL_CARD_APPLICATION_SCOPE_META[resolvedApplicationScopeLock].label}；关闭后从顶部手动打开可视化，才可自由切换范围。</p> : null}
          <div data-visual-card-scope-columns role="group" aria-label="可视化编辑范围" className={cn("grid gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1", canaryIntent ? "grid-cols-3" : "grid-cols-2")}>
            {(canaryIntent ? ["canary-profile", "current-page", "global"] as const : ["current-page", "global"] as const).map((applicationScope) => {
              const active = activeApplicationScope === applicationScope;
              const meta = VISUAL_CARD_APPLICATION_SCOPE_META[applicationScope];
              return <Tooltip key={applicationScope}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-visual-card-application-scope={applicationScope}
                    data-visual-card-global-scope={applicationScope === "global" ? "true" : undefined}
                    data-visual-card-page-scope={applicationScope === "current-page" ? "true" : undefined}
                    data-visual-card-canary-profile-scope={applicationScope === "canary-profile" ? "true" : undefined}
                    aria-pressed={active}
                    disabled={Boolean(resolvedApplicationScopeLock && applicationScope !== resolvedApplicationScopeLock)}
                    data-global-style-canary-global-disabled={canaryIntent && applicationScope === "global" ? "true" : undefined}
                    onClick={() => selectApplicationScope(applicationScope)}
                    className={cn("h-8 truncate rounded-md px-1.5 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:text-slate-400", active ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-white")}
                  >
                    {meta.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="z-[140] max-w-64 text-xs leading-5">{meta.detail}</TooltipContent>
              </Tooltip>;
            })}
          </div>

          {SHOW_LEGACY_COMPONENT_LIBRARY ? <section data-visual-component-library-legacy hidden aria-hidden="true" className="hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-2.5 py-2">
              <div>
                <strong className="block text-[11px] text-slate-800">组件库</strong>
                <span className="block text-[9px] text-slate-500">拖到区域上替换；拖到新增区增加。</span>
              </div>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] text-slate-600">{componentDefinitions.length} 个样式</span>
            </div>
            <div className="grid grid-cols-1 gap-1 p-1.5">
              {componentDefinitions.map((definition) => {
                const replaceAvailable = visibleRegionIds.includes(definition.regionId);
                return <div
                  key={definition.id}
                  draggable={!readOnly}
                  data-visual-component-library-item={definition.id}
                  data-visual-component-region={definition.regionId}
                  onDragStart={(event) => handleComponentDragStart(event, definition)}
                  onDragEnd={() => setDraggingDefinitionId(null)}
                  className={cn(
                    "flex min-h-9 cursor-grab items-center gap-1.5 rounded-md border border-slate-200 bg-white px-1.5 py-1 active:cursor-grabbing",
                    draggingDefinitionId === definition.id && "border-blue-500 bg-blue-50 opacity-70",
                  )}
                  title={definition.detail}
                >
                  <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-slate-700">{definition.label}</span>
                  <button
                    type="button"
                    data-visual-component-replace={definition.id}
                    disabled={readOnly || !replaceAvailable}
                    onClick={() => replaceRegionWithDefinition(definition)}
                    className="h-6 rounded border border-slate-200 px-1.5 text-[9px] text-slate-600 hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                    title={replaceAvailable ? `替换${getVisualCardRegionContract(definition.regionId).label}样式` : "请切换编辑范围后替换"}
                  >替换</button>
                  <button
                    type="button"
                    data-visual-component-add={definition.id}
                    disabled={readOnly}
                    onClick={() => addComponentDefinition(definition)}
                    className="flex h-6 items-center gap-0.5 rounded border border-blue-200 bg-blue-50 px-1.5 text-[9px] font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                  ><Plus className="h-3 w-3" aria-hidden="true" />新增</button>
                </div>;
              })}
            </div>
            <div
              data-visual-component-add-dropzone
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
              onDrop={dropToAddComponent}
              className={cn(
                "m-1.5 mt-0 flex min-h-10 items-center justify-center rounded-md border border-dashed px-2 text-center text-[10px] transition",
                draggingDefinitionId ? "border-blue-500 bg-blue-50 font-semibold text-blue-700" : "border-slate-300 bg-slate-50 text-slate-500",
              )}
            >拖到这里增加到{isSharedProfileScope ? (activeApplicationScope === "canary-profile" ? "试点档案" : "全局共享") : "当前页面"}</div>
            {visibleComponentInstances.length ? <div data-visual-component-instance-list className="border-t border-slate-200 p-1.5">
              <div className="mb-1 text-[9px] font-semibold text-slate-500">已新增组件 {visibleComponentInstances.length}</div>
              {visibleComponentInstances.map((instance) => {
                const definition = getVisualPageComponentDefinition(instance.definitionId);
                return <div key={instance.id} data-visual-component-instance-item={instance.id} className="flex h-8 items-center gap-1 border-b border-slate-100 last:border-b-0">
                  <span className="min-w-0 flex-1 truncate text-[10px] text-slate-700">{definition?.label || instance.definitionId}</span>
                  <button type="button" data-visual-component-duplicate={instance.id} onClick={() => duplicateComponentInstance(instance)} className="rounded p-1 text-slate-500 hover:bg-blue-50 hover:text-blue-700" aria-label={`复制${definition?.label || "组件"}`}><Copy className="h-3.5 w-3.5" /></button>
                  <button type="button" data-visual-component-delete={instance.id} onClick={() => deleteComponentInstance(instance.id)} className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label={`删除${definition?.label || "组件"}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>;
              })}
            </div> : null}
          </section> : null}

          <nav data-visual-card-region-navigation data-visual-card-compact-button-grid aria-label="组件选择" className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {visibleRegionIds.map((regionId) => {
              const contract = getVisualCardRegionContract(regionId);
              const selected = selectedRegionId === regionId;
              const index = regionId === "total-frame" ? 0 : VISUAL_CARD_EDITABLE_REGION_IDS.indexOf(regionId) + 1;
              return <Tooltip key={regionId}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-visual-card-region-item-select={regionId}
                    data-visual-card-total-frame-select={regionId === "total-frame" ? "true" : undefined}
                    aria-pressed={selected}
                    onClick={() => selectRegion(regionId)}
                    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
                    onDrop={(event) => dropToReplaceRegion(event, regionId)}
                    className={cn("flex h-7 min-w-0 items-center justify-center gap-1 rounded-md border px-1.5 text-[10px] transition", selected ? "border-blue-600 bg-blue-600 font-semibold text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50", draggingDefinitionId && "ring-1 ring-blue-300")}
                  >
                    {regionId === "total-frame" ? <span className="truncate">总框架</span> : <><span className={cn("shrink-0 text-[9px] tabular-nums", selected ? "text-blue-100" : "text-slate-400")}>{String(index).padStart(2, "0")}</span><span className="truncate">{contract.label}</span></>}
                  </button>
                </TooltipTrigger>
                <TooltipContent data-visual-card-region-explanation={regionId} side="right" sideOffset={8} className="z-[140] max-w-64 text-xs leading-5">{REGION_DESCRIPTIONS[regionId]} 点击后在下方显示对应设置，并高亮真实页面区域。</TooltipContent>
              </Tooltip>;
            })}
          </nav>

          <section data-visual-card-region-settings data-visual-card-selected-region={selectedRegionId} className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div data-visual-card-selected-setting-title className="flex h-7 items-center justify-between border-b border-slate-200 bg-slate-50 px-2.5 text-[10px]"><span className="text-slate-500">当前设置</span><strong className="truncate text-slate-800">{selectedContract.label}</strong></div>
            <nav data-visual-card-parameter-sections aria-label="统一参数类别" className="grid grid-cols-2 gap-1 border-b border-slate-200 bg-slate-50 p-1.5">
              {VISUAL_CARD_PARAMETER_SECTIONS.map((section) => {
                const active = activeParameterSection === section.id;
                return <button
                  key={section.id}
                  type="button"
                  data-visual-card-parameter-section={section.id}
                  aria-pressed={active}
                  onClick={() => setActiveParameterSection(section.id)}
                  className={cn("h-7 truncate rounded-md border px-1.5 text-[10px] font-medium transition", active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50")}
                >{section.label}</button>;
              })}
            </nav>

            <div data-visual-card-parameter-panel={activeParameterSection}>
              {activeParameterSection === "components" ? <section data-visual-component-library data-visual-component-library-region={selectedRegionId} className="overflow-hidden bg-white">
                <div className="flex h-8 items-center justify-between border-b border-slate-200 bg-blue-50 px-2">
                  <strong className="truncate text-[10px] text-blue-950">{selectedContract.label}组件</strong>
                  <span data-visual-component-contract-count={componentContracts.length} className="shrink-0 text-[9px] text-blue-700" title={`${selectedRegionPreviews.length} 个真实样式，${componentContracts.length} 个共享契约`}>{selectedRegionPreviews.length} 实际 · {componentContracts.length} 契约</span>
                </div>
                <nav data-visual-component-collection-tabs aria-label="组件来源" className="grid grid-cols-2 gap-1 border-b border-slate-200 bg-slate-50 p-1">
                  {VISUAL_COMPONENT_COLLECTIONS.map((collection) => {
                    const active = activeComponentCollection === collection.id;
                    const count = collection.id === "live" ? uniqueSelectedRegionPreviews.length : componentDefinitions.length;
                    return <button key={collection.id} type="button" data-visual-component-collection={collection.id} aria-pressed={active} onClick={() => setActiveComponentCollection(collection.id)} className={cn("flex h-7 min-w-0 items-center justify-center gap-1 rounded-full border px-1 text-[9px] font-semibold transition", active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300")}><span className="truncate">{collection.label}</span><span className={cn("rounded-full px-1 tabular-nums", active ? "bg-white/20" : "bg-slate-100")}>{count}</span></button>;
                  })}
                </nav>

                {activeComponentCollection === "live" ? <div data-visual-component-live-preview-list className="bg-slate-50/70 p-1.5">
                  {uniqueSelectedRegionPreviews.length ? <div className="grid max-h-44 grid-cols-2 gap-1.5 overflow-y-auto pr-0.5">
                    {uniqueSelectedRegionPreviews.map((snapshot) => {
                      const selected = selectedLivePreviewKey === snapshot.key;
                      return <article key={snapshot.key} data-visual-component-live-preview data-visual-component-preview-region={snapshot.regionId} data-visual-component-preview-source-index={snapshot.index + 1} className={cn("group relative min-w-0 rounded-md bg-white p-1 ring-1 transition", selected ? "ring-2 ring-blue-500" : "ring-slate-200 hover:ring-blue-300")} title={`${snapshot.annotation} · 读取真实页面展示属性，不复制业务数据或操作`}>
                        <button type="button" data-visual-component-live-preview-style-only data-visual-component-live-preview-select={snapshot.key} aria-pressed={selected} onClick={() => setSelectedLivePreviewKey(selected ? null : snapshot.key)} className="block w-full min-w-0 text-left">
                          <VisualRegionCompactPreview snapshot={snapshot} fallbackLabel={snapshot.annotation} />
                        </button>
                        <button type="button" data-visual-component-hover-settings aria-label={`设置${snapshot.annotation}`} onClick={() => { setSelectedLivePreviewKey(snapshot.key); setActiveParameterSection("surface"); }} className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950/75 text-white opacity-0 shadow transition group-hover:opacity-100 group-focus-within:opacity-100"><Settings2 className="h-3 w-3" /></button>
                      </article>;
                    })}
                  </div> : <div data-visual-component-live-preview-empty className="px-2 py-4 text-center text-[9px] text-slate-400">当前页面没有可见的{selectedContract.label}组件</div>}
                  {selectedLivePreview ? <div data-visual-component-selection-actions="live" className="mt-1.5 flex items-center gap-1 rounded-md border border-blue-100 bg-white p-1">
                    <span className="min-w-0 flex-1 truncate px-1 text-[9px] font-semibold text-slate-700">{selectedLivePreview.annotation}</span>
                    <button type="button" onClick={() => setActiveParameterSection("surface")} className="flex h-6 items-center gap-1 rounded border border-blue-200 bg-blue-50 px-1.5 text-[9px] font-semibold text-blue-700"><Settings2 className="h-3 w-3" />调整区域</button>
                  </div> : null}
                </div> : <div data-visual-component-shared-style-list className="bg-slate-50/70 p-1.5">
                  {componentDefinitions.length ? <div className="grid max-h-44 grid-cols-2 gap-1.5 overflow-y-auto pr-0.5">
                    {componentDefinitions.map((definition, definitionIndex) => {
                      const selected = selectedSharedDefinitionId === definition.id;
                      return <article key={definition.id} draggable={!readOnly} data-visual-component-library-item={definition.id} data-visual-component-region={definition.regionId} data-visual-component-style-preview={definition.stylePresetId} onDragStart={(event) => handleComponentDragStart(event, definition)} onDragEnd={() => setDraggingDefinitionId(null)} className={cn("group relative min-w-0 cursor-grab rounded-md bg-white p-1 ring-1 transition active:cursor-grabbing", selected ? "ring-2 ring-blue-500" : "ring-slate-200 hover:ring-blue-300", draggingDefinitionId === definition.id && "bg-blue-50 opacity-70")} title={definition.detail}>
                        <button type="button" data-visual-component-shared-preview-select={definition.id} aria-pressed={selected} onClick={() => setSelectedSharedDefinitionId(selected ? null : definition.id)} className="block w-full min-w-0 text-left">
                          <VisualRegionCompactPreview snapshot={selectedRegionPreviews[definitionIndex % Math.max(1, selectedRegionPreviews.length)]} fallbackLabel={definition.label} stylePresetId={definition.stylePresetId} />
                          <span className="mt-1 block truncate px-0.5 text-[8px] font-semibold text-slate-600">{definition.label}</span>
                        </button>
                        <div data-visual-component-hover-actions className="absolute left-1.5 top-1.5 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                          <span data-visual-component-six-dot-handle className="grid h-5 w-5 grid-cols-2 place-content-center gap-[2px] rounded-full bg-slate-950/75 text-white shadow">{Array.from({ length: 6 }, (_, index) => <span key={index} className="h-0.5 w-0.5 rounded-full bg-current" />)}</span>
                          <button type="button" data-visual-component-replace={definition.id} disabled={readOnly} onClick={() => replaceRegionWithDefinition(definition)} className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[8px] font-bold text-blue-700 shadow disabled:opacity-40" aria-label={`替换为${definition.label}`}>替</button>
                          <button type="button" data-visual-component-add={definition.id} disabled={readOnly} onClick={() => addComponentDefinition(definition)} className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white shadow disabled:opacity-40" aria-label={`新增${definition.label}`}><Plus className="h-3 w-3" /></button>
                        </div>
                      </article>;
                    })}
                  </div> : <div data-visual-component-empty className="px-2 py-4 text-center text-[9px] text-slate-400">当前区域为固定框架，没有可替换样式</div>}
                  {selectedSharedDefinition ? <div data-visual-component-selection-actions="shared" className="mt-1.5 grid grid-cols-3 gap-1 rounded-md border border-blue-100 bg-white p-1">
                    <button type="button" disabled={readOnly} onClick={() => replaceRegionWithDefinition(selectedSharedDefinition)} className="h-6 rounded border border-slate-200 text-[9px] font-semibold text-slate-600 disabled:opacity-40">替换</button>
                    <button type="button" disabled={readOnly} onClick={() => addComponentDefinition(selectedSharedDefinition)} className="h-6 rounded border border-blue-200 bg-blue-50 text-[9px] font-semibold text-blue-700 disabled:opacity-40">新增</button>
                    <button type="button" onClick={() => setActiveParameterSection("surface")} className="h-6 rounded border border-slate-200 text-[9px] font-semibold text-slate-600">更多设置</button>
                  </div> : null}
                  {selectedSharedContract ? <details data-visual-component-contract={selectedSharedContract.id} className="mt-1.5 overflow-hidden rounded-md border border-emerald-200 bg-white text-[9px] text-slate-600">
                    <summary className="flex h-7 cursor-pointer list-none items-center justify-between gap-2 bg-emerald-50 px-2 font-semibold text-emerald-900"><span>共享契约 v{selectedSharedContract.schemaVersion}</span><span className="font-normal text-emerald-700">三端同源</span></summary>
                    <div className="grid gap-1.5 p-2">
                      <div className="flex items-start justify-between gap-2"><span className="shrink-0 text-slate-400">来源</span><strong className="text-right font-medium text-slate-700">真实页面组件 · 单一来源</strong></div>
                      <div className="flex items-start justify-between gap-2"><span className="shrink-0 text-slate-400">状态</span><span className="text-right">{selectedSharedContract.states.map((state) => VISUAL_COMPONENT_STATE_LABELS[state]).join(" · ")}</span></div>
                      <div className="flex items-start justify-between gap-2"><span className="shrink-0 text-slate-400">继承</span><span className="text-right">{VISUAL_COMPONENT_CONTRACT_INHERITANCE.map((layer) => layer.label).join(" → ")}</span></div>
                      <div data-visual-component-inheritance-resolution className="grid gap-1 border-t border-slate-100 pt-1">
                        {selectedInheritance.map((layer) => <div key={layer.layerId} data-visual-component-inheritance-layer={layer.layerId} data-visual-component-inheritance-status={layer.status} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate" title={layer.source}>{layer.label}</span><span className={cn("shrink-0 rounded-full px-1.5 py-0.5", layer.status === "active" ? "bg-emerald-100 text-emerald-700" : layer.status === "available" ? "bg-blue-50 text-blue-700" : layer.status === "read-only" ? "bg-slate-200 text-slate-600" : "bg-amber-50 text-amber-700")}>{VISUAL_COMPONENT_INHERITANCE_STATUS_LABELS[layer.status]}</span></div>)}
                      </div>
                      <div className="flex items-start justify-between gap-2"><span className="shrink-0 text-slate-400">令牌</span><span className="text-right">{selectedSharedContract.tokenIds.length} 项自动同步</span></div>
                    </div>
                  </details> : null}
                  {componentDefinitions.length ? <div data-visual-component-dropzones className="sticky bottom-0 mt-1.5 grid grid-cols-2 gap-1 bg-slate-50/95 pt-1">
                    <div data-visual-component-replace-dropzone onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={(event) => dropToReplaceRegion(event, selectedRegionId)} className={cn("flex min-h-8 items-center justify-center rounded-md border border-dashed px-1 text-center text-[8px] transition", draggingDefinitionId ? "border-blue-500 bg-blue-50 font-semibold text-blue-700" : "border-slate-300 bg-white text-slate-500")}>拖到这里替换</div>
                    <div data-visual-component-add-dropzone onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={dropToAddComponent} className={cn("flex min-h-8 items-center justify-center rounded-md border border-dashed px-1 text-center text-[8px] transition", draggingDefinitionId ? "border-blue-500 bg-blue-50 font-semibold text-blue-700" : "border-slate-300 bg-white text-slate-500")}>拖到这里新增</div>
                  </div> : null}
                </div>}
                {visibleComponentInstances.length ? <div data-visual-component-instance-list className="border-t border-slate-200 p-1.5">
                  <div className="mb-1 text-[9px] font-semibold text-slate-500">已新增组件 {visibleComponentInstances.length}</div>
                  {visibleComponentInstances.map((instance) => {
                    const definition = getVisualPageComponentDefinition(instance.definitionId);
                    const actionsOpen = expandedComponentInstanceId === instance.id;
                    return <div key={instance.id} data-visual-component-instance-item={instance.id} className="flex min-h-8 flex-wrap items-center gap-1 border-b border-slate-100 py-1 last:border-b-0">
                      <span className="min-w-24 flex-1 truncate text-[10px] text-slate-700">{definition?.label || instance.definitionId}</span>
                      {actionsOpen ? <><button type="button" data-visual-component-duplicate={instance.id} onClick={() => duplicateComponentInstance(instance)} className="rounded p-1 text-slate-500 hover:bg-blue-50 hover:text-blue-700" aria-label={`复制${definition?.label || "组件"}`}><Copy className="h-3.5 w-3.5" /></button><button type="button" data-visual-component-delete={instance.id} onClick={() => deleteComponentInstance(instance.id)} className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label={`删除${definition?.label || "组件"}`}><Trash2 className="h-3.5 w-3.5" /></button></> : null}
                      <button type="button" data-visual-component-instance-more={instance.id} aria-expanded={actionsOpen} onClick={() => setExpandedComponentInstanceId(actionsOpen ? null : instance.id)} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label={`${definition?.label || "组件"}更多操作`}><MoreHorizontal className="h-3.5 w-3.5" /></button>
                    </div>;
                  })}
                </div> : null}
              </section> : null}

              {activeParameterSection === "responsive" ? <section data-visual-card-responsive-contract data-visual-card-responsive-factory-default={RESPONSIVE_SHELL_FACTORY_DEFAULT.version} data-visual-card-responsive-region={selectedRegionId} className="divide-y divide-slate-100">
                <div data-visual-global-page-responsive-contract={GLOBAL_RESPONSIVE_PAGE_CONTRACT_VERSION} className="border-b border-teal-100 bg-teal-50 px-2.5 py-2 text-[9px] leading-4 text-teal-900"><strong>全页面共享宿主</strong><span className="mt-0.5 block">总部端、代理源、客户源所有普通页面均按内容容器宽度套用参考、仪表盘、列表、表单、详情、编辑器、流程七类模板；只重排版面，不覆盖字段、业务数据、素材和插件能力。</span></div>
                <div data-visual-responsive-factory-summary className="border-b border-emerald-100 bg-emerald-50 px-2.5 py-2 text-[9px] leading-4 text-emerald-800">工厂规则 {RESPONSIVE_SHELL_FACTORY_DEFAULT.version}：以大屏真实组件为唯一来源。顶部、标题1、标题2、表头、内容和尾栏在三端及普通页面只保留一份 DOM 与业务状态；小屏只移动同一真实表面并改变密度、网格与换行，不再重建按钮、批量操作、悬浮、弹窗或选中状态。640px 及以上完整保留大屏布局；640px 以下按“流体缩小→精简→真实表面工具→自动网格→最终单列”适配，尾栏继续使用同一个容量网格。</div>
                <div className="bg-emerald-50 px-2.5 py-2 text-[10px] text-emerald-900"><strong>三端自适应已启用</strong><span data-visual-responsive-description className="mt-0.5 block text-[9px] text-emerald-700">响应式学习已启用；总部、代理源、客户源、弹窗和恢复工厂使用同一版本化契约。640px 及以上的标题右侧功能按键固定单行，空间不足时栏内横向滚动；主体标注停靠主体外框左侧预留空白槽且不覆盖标题，表内／内容标注保留各自左侧。手机小屏才移动完整操作栏，并隐藏非主动常显的主体诊断标注；三行按键、零宽、越界或标注遮挡都会进入学习异常。运行时压力必须经过验证、批准和版本升级才能进入工厂默认。</span></div>
                <div data-responsive-learning-summary className="flex items-center justify-between gap-2 bg-sky-50 px-2.5 py-2 text-[9px] text-sky-800"><span>当前学习状态</span><strong>{typeof document !== "undefined" && document.documentElement.dataset.responsiveLearningStatus === "review" ? "发现压力，待审查" : "健康／等待检测"}</strong></div>
                <div data-responsive-topbar-disclosure-policy className="flex items-center justify-between gap-2 bg-violet-50 px-2.5 py-2 text-[9px] text-violet-800"><span>顶部工具策略</span><strong>{RESPONSIVE_SHELL_FACTORY_DEFAULT.topbarDisclosure.strategy}</strong></div>
                <div data-responsive-page-tools-policy className="flex items-center justify-between gap-2 bg-amber-50 px-2.5 py-2 text-[9px] text-amber-800"><span>极限屏页面工具</span><strong>{RESPONSIVE_SHELL_FACTORY_DEFAULT.pageTools.strategy}</strong></div>
                <div data-responsive-sidebar-navigation-policy className="flex items-center justify-between gap-2 bg-emerald-50 px-2.5 py-2 text-[9px] text-emerald-800"><span>活动项目分支</span><strong>{RESPONSIVE_SHELL_FACTORY_DEFAULT.sidebarNavigation.strategy}</strong></div>
                <div data-responsive-function-key-policy className="flex items-center justify-between gap-2 bg-cyan-50 px-2.5 py-2 text-[9px] text-cyan-800"><span>共享功能键高度</span><strong>{RESPONSIVE_SHELL_FACTORY_DEFAULT.functionKeys.height}px</strong></div>
                <div data-responsive-visual-launcher-policy className="flex items-center justify-between gap-2 bg-blue-50 px-2.5 py-2 text-[9px] text-blue-800"><span>可视化入口</span><strong>{RESPONSIVE_SHELL_FACTORY_DEFAULT.visualLauncher.strategy}</strong></div>
                <div data-responsive-capacity-layout-policy className="flex items-center justify-between gap-2 bg-lime-50 px-2.5 py-2 text-[9px] text-lime-800"><span>容器容量布局</span><strong>{RESPONSIVE_SHELL_FACTORY_DEFAULT.capacityLayout.strategy}</strong></div>
                <div data-responsive-service-expert-capacity-policy className="flex items-center justify-between gap-2 bg-cyan-50 px-2.5 py-2 text-[9px] text-cyan-800"><span>客服专家容量</span><strong>1–4 列 · 840/1264/1688px</strong></div>
                <div data-responsive-service-expert-content-source className="flex items-center justify-between gap-2 bg-rose-50 px-2.5 py-2 text-[9px] text-rose-800"><span>客服内容事实源</span><strong>{CUSTOMER_SERVICE_EXPERT_CONTENT_CONTRACT.sourceLabel}</strong></div>
                <div data-responsive-context-marker-policy className="flex items-center justify-between gap-2 bg-indigo-50 px-2.5 py-2 text-[9px] text-indigo-800"><span>主体标注安全位</span><strong>{RESPONSIVE_SHELL_FACTORY_DEFAULT.contextMarkers.workspacePlacement}</strong></div>
                <div data-responsive-adaptive-structure-policy className="flex items-center justify-between gap-2 bg-fuchsia-50 px-2.5 py-2 text-[9px] text-fuchsia-800"><span>共享结构规范</span><strong>{ADAPTIVE_STRUCTURE_FACTORY_DEFAULT.id}</strong></div>
                <div data-responsive-shared-live-surface-policy className="flex items-center justify-between gap-2 bg-teal-50 px-2.5 py-2 text-[9px] text-teal-800"><span>大屏唯一基准</span><strong>{SHARED_ADAPTIVE_SURFACE_FACTORY_DEFAULT.id}</strong></div>
                <div data-responsive-mobile-application-policy className="flex items-center justify-between gap-2 bg-rose-50 px-2.5 py-2 text-[9px] text-rose-800"><span>手机应用框架</span><strong>{ADAPTIVE_STRUCTURE_FACTORY_DEFAULT.mobileApplication.plugin}</strong></div>
                <div data-responsive-complex-editor-policy className="flex items-center justify-between gap-2 bg-orange-50 px-2.5 py-2 text-[9px] text-orange-800"><span>复杂编辑卡</span><strong>479px 以下单列</strong></div>
                <div data-responsive-stage-sequence className="grid grid-cols-5 gap-1 px-2.5 py-2">
                  {RESPONSIVE_SHELL_FACTORY_DEFAULT.stages.map((stage, index) => <div key={stage.id} title={stage.behavior} className="rounded border border-slate-200 bg-white px-1 py-1 text-center text-[8px] text-slate-600"><strong className="block text-slate-800">{formatDisplayOrdinal(index + 1)}</strong>{stage.id}</div>)}
                </div>
                <div data-responsive-vertical-stage-sequence className="grid grid-cols-4 gap-1 px-2.5 py-2">
                  {RESPONSIVE_SHELL_FACTORY_DEFAULT.verticalStages.map((stage, index) => <div key={stage.id} title={stage.behavior} className="rounded border border-sky-200 bg-sky-50 px-1 py-1 text-center text-[8px] text-sky-700"><strong className="block text-sky-900">H{formatDisplayOrdinal(index + 1)}</strong>{stage.id}</div>)}
                </div>
                <div data-responsive-priority-policy className="grid grid-cols-4 gap-1 px-2.5 py-2">
                  {Object.entries(RESPONSIVE_SHELL_FACTORY_DEFAULT.priorityPolicy).map(([priority, detail]) => <div key={priority} title={detail} className="rounded border border-slate-200 px-1 py-1 text-center text-[8px]"><strong>{priority.toUpperCase()}</strong></div>)}
                </div>
                <div data-responsive-verification-widths className="flex flex-wrap gap-1 px-2.5 py-2">{RESPONSIVE_SHELL_FACTORY_DEFAULT.verificationWidths.map((width) => <span key={width} className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[8px] text-slate-600">{width}</span>)}</div>
                <div data-responsive-verification-heights className="flex flex-wrap gap-1 px-2.5 py-2">{RESPONSIVE_SHELL_FACTORY_DEFAULT.verificationHeights.map((height) => <span key={height} className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[8px] text-sky-700">H{height}</span>)}</div>
                {[
                  ["流体缩放", "中屏同步缩小字号、间距、圆角和内边距，不整体缩放页面"],
                  ["优先精简", "先去除 P1/P2 辅助说明，P0 操作和最小点击尺寸不变"],
                  ["顺序换行", "胶囊、设置按钮和操作图标按业务与键盘顺序连续换行"],
                  ["极窄收纳", "P3 非操作工具先隐藏，P1/P2 保留功能图标"],
                  ["工具悬浮", "短屏顶栏保持 44/50px；展开工具在视口内独立滚动，并支持按钮、外部点击、Escape、路由切换和桌面切换收起"],
                  ["纵向预算", "常规短屏保留 55%/专注 60%；360px 极限屏保留 40%/专注 50%"],
                  ["独立工具", "极限屏顶部按左栏、顶部、标题1、标题2、表头排序，各入口独立展开"],
                  ["容量型更多", "先显示五个纯功能图标；只有实测空间不足才把标题1与标题2收入更多"],
                  ["统一功能键", `左栏、顶部、标题1、标题2、表头、可视化统一为 ${RESPONSIVE_SHELL_FACTORY_DEFAULT.functionKeys.height}px 高`],
                  ["尾栏容量", "源码解／页面解／栏目解优先显示，锁定后为源码锁／页面锁／栏目锁；只有实测剩余宽度不足才收为图标，保存并同步入口显示为“保存”"],
                  ["同源表面", "顶部／标题1／标题2／表头大小屏共用同一真实插件，只切换密度与位置"],
                  ["唯一真实组件", "顶部、标题、表头、内容、尾栏以大屏真实实例为唯一来源；小屏禁止重新生成业务操作与状态"],
                  ["双层版色", "标题2与版面风格色卡共用每套主题的浅底色／主体色语义，悬浮、应用、工厂恢复一致"],
                  ["同源交互", "按钮悬浮、聚焦、按下、禁用、弹窗、下拉与提示共用一个交互状态插件"],
                  ["固定可视化", "可视化固定在尾栏保存并同步之前，不支持拖动；恢复工厂默认保持同序同高"],
                  ["列表保护", "左右操作栏最小宽度归零，不允许挤出列表框"],
                  ["单层边界", "每个业务项目只绘制一个卡片边界，内部操作栏与资料区是透明结构，不再卡片套卡片"],
                  ["渐进收纳", "保持同一组件树；先压缩弹性间距和选项网格，再收纳次要资料，最后才切换单列"],
                  ["弹窗适配", "弹窗限制在视口内，表单列自动变成单列"],
                ].map(([label, detail]) => <div key={label} data-visual-responsive-rule className="flex min-h-10 items-center justify-between gap-2 px-2.5 py-1.5"><span className="shrink-0 text-[10px] font-semibold text-slate-700">{label}</span><span data-visual-responsive-description className="text-right text-[9px] leading-4 text-slate-500">{detail}</span><Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" /></div>)}
              </section> : null}

              {activeParameterSection === "basic" ? <>
                {selectedRegionId === "total-frame" ? <div data-visual-card-frame-settings-parent="total-frame">
                  <div data-visual-card-frame-settings>
                    {FRAME_INSET_ROWS.map(([side, shortLabel, fullLabel]) => <label key={side} data-visual-card-setting-row title={`${fullLabel}：设置总框架与页面边缘的距离，范围 0–160px。`} className="flex h-9 min-w-0 items-center justify-between gap-3 border-b border-slate-100 px-2.5 text-[11px]"><span className="truncate font-medium">{shortLabel}边距</span><input aria-label={fullLabel} data-visual-card-frame-inset={side} type="number" min={0} max={160} value={draft.frameInsets[side]} onChange={(event) => updateInset(side, event.target.value)} className="h-7 w-16 rounded border border-slate-300 bg-white px-1.5 text-right text-[10px] text-slate-900" /></label>)}
                  </div>
                </div> : <>
                  <div data-visual-card-setting-row className="flex h-9 items-center justify-between gap-3 border-b border-slate-100 px-2.5">
                    <Tooltip><TooltipTrigger asChild><span tabIndex={0} className="cursor-help truncate text-[11px] font-medium">显示状态</span></TooltipTrigger><TooltipContent side="right" sideOffset={8} className="z-[140] max-w-64 text-xs leading-5">控制“{selectedContract.label}”是否完整显示，修改会立即投影到真实页面。</TooltipContent></Tooltip>
                    {selectedContract.collapsible ? <Button data-visual-card-collapse type="button" size="sm" variant="outline" className="h-7 shrink-0 px-2 text-[10px]" onClick={() => updateSelected((node) => ({ ...node, collapsed: !node.collapsed }))}>{selectedNode.collapsed ? <Eye className="mr-1 h-3.5 w-3.5" /> : <EyeOff className="mr-1 h-3.5 w-3.5" />}{selectedNode.collapsed ? "展开" : "收起"}</Button> : <span className="text-[10px] text-slate-400">固定显示</span>}
                  </div>
                  <label data-visual-card-setting-row title="选择该区域跟随页面流动，或固定在页面顶部、底部。" className="flex h-9 items-center justify-between gap-3 border-b border-slate-100 px-2.5">
                    <span className="truncate text-[11px] font-medium">固定位置</span>
                    <select data-visual-card-placement={selectedNode.placement} value={selectedNode.placement} onChange={(event) => updateSelected((node) => ({ ...node, placement: event.target.value as VisualCardPlacement }))} className="h-7 min-w-0 max-w-32 rounded border border-slate-300 bg-white px-2 text-[10px]">
                      {selectedContract.allowedPlacements.map((placement) => <option key={placement} value={placement}>{PLACEMENT_LABELS[placement]}</option>)}
                    </select>
                  </label>
                </>}
                {!isTotalFrame ? <label data-visual-card-setting-row title="共享标准会继承统一版面风格；其他选项只增加安全的强调效果。" className="flex h-9 items-center justify-between gap-3 border-b border-slate-100 px-2.5">
                  <span className="truncate text-[11px] font-medium">区域风格</span>
                  <select data-visual-card-style-preset={selectedNode.stylePresetId} value={selectedNode.stylePresetId} onChange={(event) => updateSelected((node) => ({ ...node, stylePresetId: event.target.value }))} className="h-7 min-w-0 max-w-32 rounded border border-slate-300 bg-white px-2 text-[10px]">
                    {STYLE_PRESETS.map((preset) => <option key={preset.id} value={preset.id} title={preset.detail}>{preset.label}</option>)}
                  </select>
                </label> : null}
              </> : null}

              {activeParameterSection === "spacing" ? <>
                {isSharedProfileScope && isTotalFrame ? <label data-visual-card-setting-row data-visual-card-shared-contract="frame-density" title={`真实共享来源：${SHARED_STYLE_OWNER_LABELS[selectedSharedStyle.source.density.owner]} · frameDensity`} className="flex h-9 items-center justify-between gap-3 border-b border-blue-100 bg-blue-50/60 px-2.5">
                  <span className="truncate text-[11px] font-semibold text-blue-900">统一间距</span>
                  <select aria-label="统一间距" value={effectiveSharedLayoutStyle.frameDensity || "standard"} onChange={(event) => updateSharedGeometry({ frameDensity: event.target.value as NonNullable<LayoutCustomStyle["frameDensity"]> })} disabled={readOnly} className="h-7 min-w-0 max-w-32 rounded border border-blue-200 bg-white px-2 text-[10px]">{SHARED_DENSITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                </label> : null}
                {!isTotalFrame ? FRAME_INSET_ROWS.map(([side, shortLabel]) => <label key={side} data-visual-card-setting-row title={`留空即继承统一版面风格；${shortLabel}内边距范围 0–96px。`} className="flex h-9 items-center justify-between gap-3 border-b border-slate-100 px-2.5">
                  <span className="truncate text-[11px] font-medium">{shortLabel}内边距</span>
                  <input
                    data-visual-card-spacing-padding={side}
                    aria-label={`${shortLabel}内边距`}
                    type="number"
                    min={0}
                    max={96}
                    placeholder="继承"
                    value={selectedComponentStyle.spacing?.padding?.[side] ?? ""}
                    onChange={(event) => updateSelectedComponentStyle((current) => ({
                      ...current,
                      spacing: {
                        ...current.spacing,
                        padding: { ...current.spacing?.padding, [side]: optionalNumber(event.target.value) },
                      },
                    }))}
                    className="h-7 w-16 rounded border border-slate-300 bg-white px-1.5 text-right text-[10px]"
                  />
                </label>) : null}
                {!isTotalFrame ? <label data-visual-card-setting-row title="留空即继承统一版面风格；组件内部间距范围 0–64px。" className="flex h-9 items-center justify-between gap-3 border-b border-slate-100 px-2.5">
                  <span className="truncate text-[11px] font-medium">组件间距</span>
                  <input data-visual-card-spacing-gap aria-label="组件间距" type="number" min={0} max={64} placeholder="继承" value={selectedComponentStyle.spacing?.gapPx ?? ""} onChange={(event) => updateSelectedComponentStyle((current) => ({ ...current, spacing: { ...current.spacing, gapPx: optionalNumber(event.target.value) } }))} className="h-7 w-16 rounded border border-slate-300 bg-white px-1.5 text-right text-[10px]" />
                </label> : null}
              </> : null}

              {activeParameterSection === "annotation" ? selectedRegionId === "total-frame" ? <div data-visual-card-annotation-unavailable="total-frame" className="border-b border-slate-100 px-2.5 py-3 text-[10px] leading-5 text-slate-500">总框架不使用区域标注</div> : <>
                <label data-visual-card-setting-row title="控制主体、表内、内容等区域标注的显示时机；继承时读取共享契约。主体默认在主体外框左侧预留空白槽，小屏不显示仅由悬停触发的主体标注。" className="flex h-9 items-center justify-between gap-3 border-b border-slate-100 px-2.5">
                  <span className="truncate text-[11px] font-medium">显示方式</span>
                  <select data-visual-card-annotation-visibility value={selectedComponentStyle.annotation?.visibility || ""} onChange={(event) => updateSelectedComponentStyle((current) => ({ ...current, annotation: { ...current.annotation, visibility: optionalChoice<VisualCardComponentAnnotation["visibility"]>(event.target.value) } }))} className="h-7 min-w-0 max-w-32 rounded border border-slate-300 bg-white px-2 text-[10px]">
                    <option value="">继承共享契约</option><option value="hover">悬停显示</option><option value="always">始终显示</option><option value="hidden">隐藏标注</option>
                  </select>
                </label>
                <label data-visual-card-setting-row title="竖向胶囊共用同一字体契约；主体在主体外框左侧预留空白槽，表内与内容在各自左侧语义起点。" className="flex h-9 items-center justify-between gap-3 border-b border-slate-100 px-2.5">
                  <span className="truncate text-[11px] font-medium">标注方向</span>
                  <select data-visual-card-annotation-mode value={selectedComponentStyle.annotation?.mode || ""} onChange={(event) => updateSelectedComponentStyle((current) => ({ ...current, annotation: { ...current.annotation, mode: optionalChoice<VisualCardComponentAnnotation["mode"]>(event.target.value) } }))} className="h-7 min-w-0 max-w-32 rounded border border-slate-300 bg-white px-2 text-[10px]">
                    <option value="">继承共享契约</option><option value="vertical">竖向上下文</option><option value="inline">横向单行</option>
                  </select>
                </label>
              </> : null}

              {activeParameterSection === "surface" ? <>
                {isSharedProfileScope ? <>
                  {canEditSharedStyle("backgroundColor") ? <label data-visual-card-setting-row data-visual-card-shared-style="background" title={`真实共享来源：${SHARED_STYLE_OWNER_LABELS[selectedSharedStyle.source.background.owner]} · ${selectedSharedStyle.source.background.field} · ${selectedSharedStyle.source.background.token}`} className="flex h-9 items-center justify-between gap-3 border-b border-blue-100 bg-blue-50/60 px-2.5">
                    <span className="truncate text-[11px] font-semibold text-blue-900">共享底色</span>
                    <span className="flex items-center gap-1"><span aria-hidden="true" className="h-5 w-5 shrink-0 rounded border border-blue-200" style={{ backgroundColor: selectedSharedStyle.backgroundColor }} /><input key={selectedSharedStyle.backgroundColor} data-visual-card-shared-background type="text" inputMode="text" maxLength={7} aria-label="共享底色" defaultValue={selectedSharedStyle.backgroundColor} disabled={readOnly} onBlur={(event) => { event.currentTarget.value = commitSelectedSharedColor("backgroundColor", event.currentTarget.value) || selectedSharedStyle.backgroundColor; }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="h-7 w-[4.65rem] rounded border border-blue-200 bg-white px-1 text-center font-mono text-[9px] uppercase" /></span>
                  </label> : null}
                  {canEditSharedStyle("textColor") ? <label data-visual-card-setting-row data-visual-card-shared-style="text" title={`真实共享来源：${SHARED_STYLE_OWNER_LABELS[selectedSharedStyle.source.text.owner]} · ${selectedSharedStyle.source.text.field} · ${selectedSharedStyle.source.text.token}；保存时自动校验文字对比度。`} className="flex h-9 items-center justify-between gap-3 border-b border-blue-100 bg-blue-50/60 px-2.5">
                    <span className="truncate text-[11px] font-semibold text-blue-900">共享字体色</span>
                    <span className="flex items-center gap-1"><span aria-hidden="true" className="h-5 w-5 shrink-0 rounded border border-blue-200" style={{ backgroundColor: selectedSharedStyle.textColor }} /><input key={selectedSharedStyle.textColor} data-visual-card-shared-text type="text" inputMode="text" maxLength={7} aria-label="共享字体色" defaultValue={selectedSharedStyle.textColor} disabled={readOnly} onBlur={(event) => { event.currentTarget.value = commitSelectedSharedColor("textColor", event.currentTarget.value) || selectedSharedStyle.textColor; }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="h-7 w-[4.65rem] rounded border border-blue-200 bg-white px-1 text-center font-mono text-[9px] uppercase" /></span>
                  </label> : null}
                  {!canEditSharedStyle("backgroundColor") && !canEditSharedStyle("textColor") ? <div data-visual-card-shared-surface-owner="workspace" className="border-b border-slate-100 bg-slate-50 px-2.5 py-3 text-[10px] leading-5 text-slate-500">总框架不再控制内容表面；共享底色和字体色请在“02 主体”修改。</div> : null}
                </> : <div data-visual-card-shared-style-inherited className="border-b border-slate-100 bg-slate-50 px-2.5 py-2 text-[9px] leading-4 text-slate-500">当前页继承 {SHARED_STYLE_OWNER_LABELS[selectedSharedStyle.source.background.owner]}：{selectedSharedStyle.backgroundColor} / {selectedSharedStyle.textColor}；下面只叠加本页语义色位。</div>}
                {!isTotalFrame ? <label data-visual-card-setting-row title="只选择语义色位，实际底色始终读取当前统一版面风格。" className="flex h-9 items-center justify-between gap-3 border-b border-slate-100 px-2.5">
                  <span className="truncate text-[11px] font-medium">组件底色</span>
                  <select data-visual-card-surface-background value={selectedComponentStyle.surface?.backgroundRole || ""} onChange={(event) => updateSelectedComponentStyle((current) => ({ ...current, surface: { ...current.surface, backgroundRole: optionalChoice<VisualCardComponentSurface["backgroundRole"]>(event.target.value) } }))} className="h-7 min-w-0 max-w-32 rounded border border-slate-300 bg-white px-2 text-[10px]">
                    <option value="">继承版面底色</option><option value="surface">组件底色</option><option value="muted">弱化底色</option><option value="primary">主色</option><option value="secondary">辅色</option><option value="transparent">透明</option>
                  </select>
                </label> : null}
                {!isTotalFrame ? <label data-visual-card-setting-row title="只选择语义字体色，实际颜色始终读取当前统一版面风格。" className="flex h-9 items-center justify-between gap-3 border-b border-slate-100 px-2.5">
                  <span className="truncate text-[11px] font-medium">组件字体</span>
                  <select data-visual-card-surface-text value={selectedComponentStyle.surface?.textRole || ""} onChange={(event) => updateSelectedComponentStyle((current) => ({ ...current, surface: { ...current.surface, textRole: optionalChoice<VisualCardComponentSurface["textRole"]>(event.target.value) } }))} className="h-7 min-w-0 max-w-32 rounded border border-slate-300 bg-white px-2 text-[10px]">
                    <option value="">继承版面字体</option><option value="default">组件字体</option><option value="muted">弱化字体</option><option value="on-primary">主色对比字</option><option value="on-secondary">辅色对比字</option>
                  </select>
                </label> : null}
              </> : null}

              {activeParameterSection === "typography" ? <>
                {isSharedProfileScope ? <>
                  {canEditSharedStyle("fontFamily") ? <label data-visual-card-setting-row data-visual-card-shared-style="font-family" title={`真实共享来源：${SHARED_STYLE_OWNER_LABELS[selectedSharedStyle.source.fontFamily.owner]} · ${selectedSharedStyle.source.fontFamily.field}`} className="flex h-9 items-center justify-between gap-3 border-b border-blue-100 bg-blue-50/60 px-2.5">
                    <span className="truncate text-[11px] font-semibold text-blue-900">共享字体</span>
                    <select data-shared-choice-selected="true" value={selectedSharedStyle.fontFamily} disabled={readOnly} onChange={(event) => updateSelectedSharedStyle({ fontFamily: event.target.value as NonNullable<VisualCardSharedStyleEdit["fontFamily"]> })} className="visual-shared-choice-select h-7 min-w-0 max-w-32 rounded border border-blue-200 bg-white px-2 text-[10px]">{VISUAL_CARD_SAFE_FONT_FAMILIES.map((font, index) => <option key={font} value={font}>{SHARED_FONT_FAMILY_LABELS[font] || (index === 0 ? "共享设计字体" : font)}</option>)}</select>
                  </label> : null}
                  {canEditSharedStyle("fontWeight") ? <label data-visual-card-setting-row data-visual-card-shared-style="font-weight" title={`真实共享来源：${SHARED_STYLE_OWNER_LABELS[selectedSharedStyle.source.fontWeight.owner]} · ${selectedSharedStyle.source.fontWeight.field}`} className="flex h-9 items-center justify-between gap-3 border-b border-blue-100 bg-blue-50/60 px-2.5"><span className="truncate text-[11px] font-semibold text-blue-900">共享字重</span><select data-shared-choice-selected="true" value={selectedSharedStyle.fontWeight} disabled={readOnly} onChange={(event) => updateSelectedSharedStyle({ fontWeight: event.target.value as NonNullable<VisualCardSharedStyleEdit["fontWeight"]> })} className="visual-shared-choice-select h-7 min-w-0 max-w-32 rounded border border-blue-200 bg-white px-2 text-[10px]">{VISUAL_CARD_SAFE_FONT_WEIGHTS.map((weight) => <option key={weight} value={weight}>{weight}</option>)}</select></label> : null}
                  {canEditSharedStyle("letterSpacing") ? <label data-visual-card-setting-row data-visual-card-shared-style="letter-spacing" title={`真实共享来源：${SHARED_STYLE_OWNER_LABELS[selectedSharedStyle.source.letterSpacing.owner]} · ${selectedSharedStyle.source.letterSpacing.field}`} className="flex h-9 items-center justify-between gap-3 border-b border-blue-100 bg-blue-50/60 px-2.5"><span className="truncate text-[11px] font-semibold text-blue-900">共享字距</span><select data-shared-choice-selected="true" value={selectedSharedStyle.letterSpacing} disabled={readOnly} onChange={(event) => updateSelectedSharedStyle({ letterSpacing: event.target.value as NonNullable<VisualCardSharedStyleEdit["letterSpacing"]> })} className="visual-shared-choice-select h-7 min-w-0 max-w-32 rounded border border-blue-200 bg-white px-2 text-[10px]">{VISUAL_CARD_SAFE_LETTER_SPACINGS.map((spacing) => <option key={spacing} value={spacing}>{spacing}</option>)}</select></label> : null}
                  {!canEditSharedStyle("fontFamily") && isTotalFrame ? <div data-visual-card-shared-typography-owner="workspace" className="border-b border-slate-100 bg-slate-50 px-2.5 py-3 text-[10px] leading-5 text-slate-500">全局字体已归入“02 主体”，总框架只保留结构参数。</div> : null}
                </> : null}
                {!isTotalFrame ? <><label data-visual-card-setting-row title="继承会继续读取全局正文或标题字体。" className="flex h-9 items-center justify-between gap-3 border-b border-slate-100 px-2.5">
                  <span className="truncate text-[11px] font-medium">字体类别</span>
                  <select data-visual-card-typography-family value={selectedComponentStyle.typography?.familyRole || ""} onChange={(event) => updateSelectedComponentStyle((current) => ({ ...current, typography: { ...current.typography, familyRole: optionalChoice<VisualCardComponentTypography["familyRole"]>(event.target.value) } }))} className="h-7 min-w-0 max-w-32 rounded border border-slate-300 bg-white px-2 text-[10px]">
                    <option value="">继承版面字体</option><option value="body">正文字体</option><option value="heading">标题字体</option><option value="mono">等宽字体</option>
                  </select>
                </label>
                <label data-visual-card-setting-row title="留空即继承，范围 8–64px。" className="flex h-9 items-center justify-between gap-3 border-b border-slate-100 px-2.5"><span className="truncate text-[11px] font-medium">字号</span><input data-visual-card-typography-size aria-label="字号" type="number" min={8} max={64} placeholder="继承" value={selectedComponentStyle.typography?.sizePx ?? ""} onChange={(event) => updateSelectedComponentStyle((current) => ({ ...current, typography: { ...current.typography, sizePx: optionalNumber(event.target.value) } }))} className="h-7 w-16 rounded border border-slate-300 bg-white px-1.5 text-right text-[10px]" /></label>
                <label data-visual-card-setting-row title="继承时沿用统一版面风格的字重。" className="flex h-9 items-center justify-between gap-3 border-b border-slate-100 px-2.5">
                  <span className="truncate text-[11px] font-medium">字重</span>
                  <select data-visual-card-typography-weight value={selectedComponentStyle.typography?.weight ?? ""} onChange={(event) => updateSelectedComponentStyle((current) => ({ ...current, typography: { ...current.typography, weight: optionalNumber(event.target.value) as VisualCardComponentTypography["weight"] } }))} className="h-7 min-w-0 max-w-32 rounded border border-slate-300 bg-white px-2 text-[10px]"><option value="">继承</option><option value="400">400 常规</option><option value="500">500 中等</option><option value="600">600 半粗</option><option value="700">700 粗体</option></select>
                </label>
                <label data-visual-card-setting-row title="留空即继承，范围 1–2。" className="flex h-9 items-center justify-between gap-3 border-b border-slate-100 px-2.5"><span className="truncate text-[11px] font-medium">行高</span><input data-visual-card-typography-line-height aria-label="行高" type="number" min={1} max={2} step={0.05} placeholder="继承" value={selectedComponentStyle.typography?.lineHeight ?? ""} onChange={(event) => updateSelectedComponentStyle((current) => ({ ...current, typography: { ...current.typography, lineHeight: optionalNumber(event.target.value) } }))} className="h-7 w-16 rounded border border-slate-300 bg-white px-1.5 text-right text-[10px]" /></label>
                <label data-visual-card-setting-row title="留空即继承，范围 -0.05–0.2em。" className="flex h-9 items-center justify-between gap-3 border-b border-slate-100 px-2.5"><span className="truncate text-[11px] font-medium">字间距</span><input data-visual-card-typography-letter-spacing aria-label="字间距" type="number" min={-0.05} max={0.2} step={0.01} placeholder="继承" value={selectedComponentStyle.typography?.letterSpacingEm ?? ""} onChange={(event) => updateSelectedComponentStyle((current) => ({ ...current, typography: { ...current.typography, letterSpacingEm: optionalNumber(event.target.value) } }))} className="h-7 w-16 rounded border border-slate-300 bg-white px-1.5 text-right text-[10px]" /></label></> : null}
              </> : null}

              {activeParameterSection === "border" ? <>
                {isSharedProfileScope && isTotalFrame ? <>
                  <div data-visual-card-shared-contract="table-shell-top-corners" className="border-b border-blue-100 bg-blue-50/60 px-2.5 py-2 text-[10px] leading-4 text-blue-900">表内上角固定为直角，与标题区连续；表内底角跟随主体圆角。</div>
                  {([
                    ["frameCornerRadius", "主体圆角", effectiveSharedLayoutStyle.frameCornerRadius || "round"],
                    ["tableHeaderCornerRadius", "表头圆角", effectiveSharedLayoutStyle.tableHeaderCornerRadius || "soft"],
                    ["cardCornerRadius", "卡片圆角", effectiveSharedLayoutStyle.cardCornerRadius || "soft"],
                  ] as const).map(([field, label, value]) => <label key={field} data-visual-card-setting-row data-visual-card-shared-contract={field} title={`真实共享来源：统一版面风格 · ${field}`} className="flex h-9 items-center justify-between gap-3 border-b border-blue-100 bg-blue-50/60 px-2.5"><span className="truncate text-[11px] font-semibold text-blue-900">{label}</span><select aria-label={label} value={value} disabled={readOnly} onChange={(event) => updateSharedGeometry({ [field]: event.target.value as NonNullable<LayoutCustomStyle[typeof field]> })} className="h-7 min-w-0 max-w-32 rounded border border-blue-200 bg-white px-2 text-[10px]">{SHARED_CORNER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}
                  <label data-visual-card-setting-row data-visual-card-shared-contract="frame-elevation" title="真实共享来源：统一版面风格 · frameElevation" className="flex h-9 items-center justify-between gap-3 border-b border-blue-100 bg-blue-50/60 px-2.5"><span className="truncate text-[11px] font-semibold text-blue-900">轻量 3D</span><select aria-label="轻量 3D" value={effectiveSharedLayoutStyle.frameElevation || "flat"} disabled={readOnly} onChange={(event) => updateSharedGeometry({ frameElevation: event.target.value as NonNullable<LayoutCustomStyle["frameElevation"]> })} className="h-7 min-w-0 max-w-32 rounded border border-blue-200 bg-white px-2 text-[10px]">{SHARED_ELEVATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                </> : null}
                {!isTotalFrame ? <><label data-visual-card-setting-row title="继承时沿用统一版面风格边框。" className="flex h-9 items-center justify-between gap-3 border-b border-slate-100 px-2.5"><span className="truncate text-[11px] font-medium">边框样式</span><select data-visual-card-border-style value={selectedComponentStyle.border?.style || ""} onChange={(event) => updateSelectedComponentStyle((current) => ({ ...current, border: { ...current.border, style: optionalChoice<VisualCardComponentBorder["style"]>(event.target.value) } }))} className="h-7 min-w-0 max-w-32 rounded border border-slate-300 bg-white px-2 text-[10px]"><option value="">继承</option><option value="none">无边框</option><option value="solid">实线</option><option value="dashed">虚线</option></select></label>
                <label data-visual-card-setting-row title="留空即继承，范围 0–8px。" className="flex h-9 items-center justify-between gap-3 border-b border-slate-100 px-2.5"><span className="truncate text-[11px] font-medium">边框宽度</span><input data-visual-card-border-width aria-label="边框宽度" type="number" min={0} max={8} placeholder="继承" value={selectedComponentStyle.border?.widthPx ?? ""} onChange={(event) => updateSelectedComponentStyle((current) => ({ ...current, border: { ...current.border, widthPx: optionalNumber(event.target.value) } }))} className="h-7 w-16 rounded border border-slate-300 bg-white px-1.5 text-right text-[10px]" /></label>
                <label data-visual-card-setting-row title="语义色位始终读取当前统一版面风格。" className="flex h-9 items-center justify-between gap-3 border-b border-slate-100 px-2.5"><span className="truncate text-[11px] font-medium">边框颜色</span><select data-visual-card-border-color value={selectedComponentStyle.border?.colorRole || ""} onChange={(event) => updateSelectedComponentStyle((current) => ({ ...current, border: { ...current.border, colorRole: optionalChoice<VisualCardComponentBorder["colorRole"]>(event.target.value) } }))} className="h-7 min-w-0 max-w-32 rounded border border-slate-300 bg-white px-2 text-[10px]"><option value="">继承</option><option value="default">默认边界</option><option value="muted">弱化边界</option><option value="primary">主色</option><option value="secondary">辅色</option></select></label>
                <label data-visual-card-setting-row title="留空即继承，范围 0–64px。" className="flex h-9 items-center justify-between gap-3 border-b border-slate-100 px-2.5"><span className="truncate text-[11px] font-medium">圆角</span><input data-visual-card-border-radius aria-label="圆角" type="number" min={0} max={64} placeholder="继承" value={selectedComponentStyle.border?.radiusPx ?? ""} onChange={(event) => updateSelectedComponentStyle((current) => ({ ...current, border: { ...current.border, radiusPx: optionalNumber(event.target.value) } }))} className="h-7 w-16 rounded border border-slate-300 bg-white px-1.5 text-right text-[10px]" /></label>
                <label data-visual-card-setting-row title="继承时沿用统一版面风格阴影。" className="flex h-9 items-center justify-between gap-3 border-b border-slate-100 px-2.5"><span className="truncate text-[11px] font-medium">阴影</span><select data-visual-card-border-shadow value={selectedComponentStyle.border?.shadow || ""} onChange={(event) => updateSelectedComponentStyle((current) => ({ ...current, border: { ...current.border, shadow: optionalChoice<VisualCardComponentBorder["shadow"]>(event.target.value) } }))} className="h-7 min-w-0 max-w-32 rounded border border-slate-300 bg-white px-2 text-[10px]"><option value="">继承</option><option value="none">无阴影</option><option value="sm">小阴影</option><option value="md">中阴影</option><option value="lg">大阴影</option></select></label></> : null}
              </> : null}

              {activeParameterSection === "plugins" ? <>
                <div data-visual-plugin-compact-header className="flex h-8 items-center justify-between border-b border-slate-200 bg-blue-50 px-2">
                  <strong className="truncate text-[10px] text-blue-950">{selectedContract.label}插件</strong>
                  <span className="shrink-0 text-[9px] text-blue-700">已启用 {selectedNode.pluginIds.length}</span>
                </div>
                <div data-visual-plugin-group-list className="divide-y divide-slate-200">
                  {availablePluginGroups.map((groupId) => {
                    const groupMeta = VISUAL_PLUGIN_GROUP_META[groupId];
                    const groupPlugins = pluginDefinitions.filter((plugin) => plugin.group === groupId);
                    const enabledCount = groupPlugins.filter((plugin) => selectedNode.pluginIds.includes(plugin.id)).length;
                    const groupOpen = expandedPluginGroup === groupId;
                    return <section key={groupId} data-visual-plugin-group={groupId}>
                      <button type="button" data-visual-plugin-group-toggle={groupId} aria-expanded={groupOpen} onClick={() => { setExpandedPluginGroup(groupOpen ? null : groupId); setSelectedPluginId(null); setPluginPreviewState("default"); }} className={cn("flex h-8 w-full items-center gap-1.5 px-2 text-left transition", groupOpen ? "bg-slate-100 text-slate-900" : "bg-white text-slate-600 hover:bg-slate-50")} title={groupMeta.detail}>
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", enabledCount ? "bg-blue-600" : "bg-slate-300")} />
                        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold">{groupMeta.label}</span>
                        <span className="text-[8px] tabular-nums text-slate-400">{enabledCount}/{groupPlugins.length}</span>
                        <span className={cn("text-[9px] transition", groupOpen && "rotate-90")}>›</span>
                      </button>
                      {groupOpen ? <div data-visual-plugin-group-panel={groupId} className="bg-slate-50/70 p-1">
                        <div data-visual-plugin-column-guides className="grid grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-1 px-1 pb-0.5 text-[8px] font-semibold text-slate-400"><span className="text-center">实际效果</span><span className="text-center">启用</span></div>
                        {groupPlugins.map((plugin) => {
                          const { enabled, capability, activeResult, unavailable } = resolvePluginPresentation(plugin.id);
                          const selected = selectedPluginId === plugin.id;
                          const toggleDisabled = readOnly || (!enabled && unavailable);
                          const selectPlugin = () => {
                            setSelectedPluginId(selected ? null : plugin.id);
                            setPluginPreviewState("default");
                          };
                          return <div key={plugin.id} data-visual-card-plugin={plugin.id} data-visual-card-plugin-runtime-status={activeResult?.status || capability?.status || "pending"} data-visual-plugin-select={plugin.id} role="button" tabIndex={0} aria-pressed={selected} onClick={selectPlugin} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); selectPlugin(); } }} className={cn("group flex min-h-10 items-center gap-1 px-1 transition", selected ? "bg-blue-50/60" : "hover:bg-white/70")} title={plugin.detail}>
                            <VisualPluginCompactPreview pluginId={plugin.id} label={plugin.label} enabled={enabled} previewState={selected ? pluginPreviewState : "default"} />
                            <span className="shrink-0" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                              <ContentPluginToggle data-visual-plugin-toggle={plugin.id} label={plugin.label} checked={enabled} disabled={toggleDisabled} onCheckedChange={() => togglePlugin(plugin.id)} className="disabled:cursor-not-allowed disabled:opacity-40" />
                            </span>
                          </div>;
                        })}
                      </div> : null}
                    </section>;
                  })}
                </div>
                {selectedPluginDefinition ? (() => {
                  const { enabled, capability, activeResult, runtimeLabel } = resolvePluginPresentation(selectedPluginDefinition.id);
                  return <div data-visual-plugin-detail={selectedPluginDefinition.id} className="border-t border-blue-100 bg-blue-50/60 p-2 text-[9px] leading-4 text-slate-600">
                    <div className="flex items-center justify-between gap-2"><strong className="truncate text-blue-900">{selectedPluginDefinition.label}</strong><span className={cn("shrink-0 rounded-full px-1.5 py-0.5", enabled && activeResult?.effective ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-500")}>{runtimeLabel}</span></div>
                    {selectedPluginPreviewStates.length > 1 ? <div data-visual-plugin-state-lab={selectedPluginDefinition.id} className="mt-1.5 flex flex-wrap gap-1" aria-label={`${selectedPluginDefinition.label}真实状态预览`}>
                      {selectedPluginPreviewStates.map((state) => <button key={state} type="button" data-visual-plugin-state={state} aria-pressed={pluginPreviewState === state} onClick={() => setPluginPreviewState(state)} className={cn("h-5 rounded-full border px-1.5 text-[8px] font-medium transition", pluginPreviewState === state ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-700")}>{CONTENT_PLUGIN_PREVIEW_STATE_LABELS[state]}</button>)}
                    </div> : null}
                    <p data-visual-responsive-description className="mt-1">{selectedPluginDefinition.detail}</p>
                    <p className="mt-1 font-medium text-slate-500">{enabled ? activeResult?.message : capability?.message || "正在检查当前页面的真实承载。"}</p>
                  </div>;
                })() : null}
              </> : null}
            </div>

            <button
              type="button"
              data-visual-card-component-style-reset
              data-visual-card-setting-row
              onClick={resetSelectedComponentStyle}
              disabled={!draft.componentStyles?.[selectedRegionId]}
              title="删除当前组件的统一参数覆盖，恢复读取共享版面风格。"
              className="flex h-9 w-full items-center gap-2 border-t border-slate-200 px-2.5 text-left text-[10px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            ><RotateCcw className="h-3.5 w-3.5" />恢复组件参数继承</button>
          </section>
        </div>

        <footer data-visual-card-action-footer data-shared-window-region="footer" className="shrink-0 border-t border-slate-200 bg-slate-50 py-2.5 pl-2.5 pr-10">
          <details
            data-visual-card-impact-preview
            data-visual-card-impact-scope={activeApplicationScope}
            data-visual-card-impact-compatible-targets={isSharedProfileScope ? GLOBAL_FRAME_COMPATIBLE_TARGET_COUNT : compositionImpactTargets.length}
            data-visual-card-impact-isolated-targets={isSharedProfileScope ? GLOBAL_FRAME_ISOLATED_TARGET_COUNT : 0}
            className="mb-1.5 overflow-hidden rounded-md border border-slate-200 bg-white text-[9px] text-slate-600"
          >
            <summary className="flex h-6 cursor-pointer list-none items-center justify-between gap-2 px-2 font-semibold text-slate-700"><span>影响预览</span><span className="font-normal text-slate-500">{compositionImpactTargetSummary}{latestAuditRecord ? " · 可恢复" : ""}</span></summary>
            <div className="border-t border-slate-100 px-2 py-1.5">
              <div data-visual-card-permission={readOnly ? "read-only" : compositionImpact.sourceScope} className="mb-1 flex min-h-5 items-start gap-1"><Check className="mt-0.5 h-3 w-3 shrink-0 text-blue-600" /><span><strong className="font-medium text-slate-700">权限</strong>：{readOnly ? "运行端只读，不可反向写入来源模板。" : compositionImpact.releaseRule === "preview-only-until-a-source-release-is-approved" ? "来源端可配置；下游仅在发布审核后接收。" : "当前范围只允许预览。"}</span></div>
              {compositionImpactTargets.map((target) => <div key={target.label} data-visual-card-impact-target={target.label} className="flex min-h-5 items-start gap-1"><Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" /><span><strong className="font-medium text-slate-700">{target.label}</strong>：{target.effect}</span></div>)}
              {isSharedProfileScope ? <div data-visual-card-impact-isolated-list className="flex min-h-5 items-start gap-1"><EyeOff className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" /><span><strong className="font-medium text-slate-700">明确隔离</strong>：{GLOBAL_FRAME_ISOLATED_TARGET_LABEL}；保留原技术流程，不应用后台业务页面框架。</span></div> : null}
              <p className="mt-1 text-slate-400">不会覆盖业务数据、下游新增内容或上传素材。</p>
              {activeApplicationScope === "current-page" && !canaryIntent ? <div data-visual-card-global-inheritance-action className="mt-1.5 rounded border border-blue-100 bg-blue-50/50 p-1.5">
                <button
                  data-visual-card-restore-global-inheritance
                  type="button"
                  disabled={readOnly || !currentPageInheritancePreview.allowed || !currentPageInheritancePreview.willChange}
                  onClick={() => setInheritanceResetConfirmationOpen(true)}
                  className="flex h-7 w-full items-center justify-center gap-1 rounded border border-blue-200 bg-white px-2 font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-45"
                  title={currentPageInheritancePreview.willChange ? "先预览差异并确认，再移除两类当前页覆盖" : "当前页面已经完全继承全局"}
                ><RotateCcw className="h-3 w-3" />恢复全局继承</button>
                {!currentPageInheritancePreview.allowed ? <p data-visual-card-inheritance-blocked className="mt-1 text-amber-700">已受只读、栏目、页面或源码锁保护，不能执行。</p> : null}
                {!currentPageInheritancePreview.willChange ? <p data-visual-card-inheritance-clean className="mt-1 text-emerald-700">当前页没有独立视觉或版面覆盖。</p> : null}
                {inheritanceResetConfirmationOpen ? <div data-visual-card-inheritance-confirmation className="mt-1.5 rounded border border-amber-200 bg-amber-50 p-2 text-[9px] leading-4 text-slate-700">
                  <p className="font-semibold text-amber-900">确认恢复当前页的全局继承？</p>
                  <div data-visual-card-inheritance-diff="visual-card" className="mt-1">视觉卡片覆盖：{currentPageInheritancePreview.diff.visualCardOverride.exists ? `将删除；当前差异区域 ${currentPageInheritancePreview.diff.visualCardOverride.changedRegionIds.length} 个${currentPageInheritancePreview.diff.visualCardOverride.changedRegionIds.length ? `（${currentPageInheritancePreview.diff.visualCardOverride.changedRegionIds.join("、")}）` : "（当前值虽一致，仍会恢复未来继承）"}，新增实例 ${currentPageInheritancePreview.diff.visualCardOverride.componentInstanceCount} 个。` : "无。"}</div>
                  <div data-visual-card-inheritance-diff="page-layout-css">版面 CSS 配置：{currentPageInheritancePreview.diff.pageLayoutCssProfile.exists ? `将删除；差异变量 ${currentPageInheritancePreview.diff.pageLayoutCssProfile.changedVariableNames.length} 个${currentPageInheritancePreview.diff.pageLayoutCssProfile.layoutPlugin ? `，插件 ${currentPageInheritancePreview.diff.pageLayoutCssProfile.layoutPlugin}` : ""}。` : "无。"}</div>
                  <div data-visual-card-inheritance-impact className="mt-1">影响范围：仅当前页面身份；不会改业务数据、下游新增内容和上传素材。</div>
                  <div data-visual-card-inheritance-fingerprints className="mt-1 font-mono text-[8px] text-slate-500">base {currentPageInheritancePreview.baseFingerprint.slice(0, 12)} · effective {currentPageInheritancePreview.effectiveFingerprint.slice(0, 12)}</div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1">
                    <button type="button" data-visual-card-inheritance-cancel onClick={() => setInheritanceResetConfirmationOpen(false)} className="h-7 rounded border border-slate-200 bg-white font-semibold text-slate-600">取消</button>
                    <button type="button" data-visual-card-inheritance-confirm onClick={confirmRestoreCurrentPageGlobalInheritance} disabled={readOnly || !currentPageInheritancePreview.allowed || !currentPageInheritancePreview.willChange} className="h-7 rounded border border-amber-300 bg-amber-600 font-semibold text-white disabled:opacity-45">确认移除覆盖</button>
                  </div>
                </div> : null}
              </div> : null}
              {latestAuditRecord && !readOnly && !canaryIntent ? <button data-visual-card-restore-latest={activeApplicationScope} type="button" onClick={restoreLatestApplicationScope} className="mt-1.5 flex h-6 w-full items-center justify-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 font-semibold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700" title={`恢复 ${new Date(latestAuditRecord.createdAt).toLocaleString("zh-CN")} 建立的视觉契约快照`}><RotateCcw className="h-3 w-3" />{activeApplicationScope === "global" ? "恢复上次全局草稿" : "恢复上次本页保存"}</button> : null}
            </div>
          </details>
          <div className="mb-1.5 flex h-6 items-center justify-between gap-2 text-[9px] text-slate-500">
            <span data-visual-card-global-dirty={globalDirty ? "true" : "false"} className={globalDirty ? "font-semibold text-amber-700" : undefined}>{canaryIntent ? "试点档案" : globalFrameWorkflow ? "全局草稿" : "全局"}{globalDirty ? (canaryIntent ? "待确认" : globalFrameWorkflow ? "待生成" : "待保存") : (canaryIntent ? "可确认基线" : globalFrameWorkflow ? "可生成基线" : "已保存")}</span>
            <span data-visual-card-page-dirty={currentPageDirty ? "true" : "false"} className={currentPageDirty ? "font-semibold text-amber-700" : undefined}>本页{currentPageDirty ? "待保存" : "已保存"}</span>
          </div>
          <div data-visual-card-action-grid data-visual-card-primary-action-scope={activeApplicationScope} className="grid grid-cols-3 gap-1.5">
            <Button data-visual-card-undo data-visual-card-setting-row type="button" size="sm" variant="outline" className="h-8 min-w-0 justify-center px-2 text-[10px]" onClick={undoCurrentApplicationScope} disabled={readOnly} title="撤销当前选中栏尚未保存或同步的修改">撤销修改</Button>
            <Button data-visual-card-reset-default data-visual-card-setting-row type="button" size="sm" variant="outline" className="h-8 min-w-0 justify-center px-2 text-[10px]" onClick={resetCurrentApplicationScope} disabled={readOnly} title="把当前选中栏恢复为共享契约出厂默认；确认保存或同步前不会正式写入">恢复默认</Button>
            {activeApplicationScope === "canary-profile" ? (
              <Button data-visual-card-save-style data-visual-card-primary-action="canary-profile" data-visual-card-apply-direct="canary-profile" data-visual-card-setting-row type="button" size="sm" className="h-8 min-w-0 justify-center px-2 text-[10px]" onClick={saveCanaryProfile} disabled={readOnly} title="确认共享外观试点档案与审计；零修改时生成基线确认，不写配置">确认试点</Button>
            ) : activeApplicationScope === "current-page" ? (
              <Button data-visual-card-save-style data-visual-card-primary-action="current-page" data-visual-card-apply-direct="current-page" data-visual-card-setting-row type="button" size="sm" className="h-8 min-w-0 justify-center px-2 text-[10px]" onClick={saveCurrentPageStyle} disabled={readOnly} title="保存本机浏览器当前路由草稿/覆盖；不修改全局模板，不进入发布链，也不是跨设备项目版本">保存当前页面</Button>
            ) : (
              <Button data-visual-card-sync-global data-visual-card-primary-action="global" data-visual-card-apply-direct="global" data-global-frame-draft-action={globalFrameWorkflow ? "generate" : undefined} data-visual-card-setting-row type="button" size="sm" className="h-8 min-w-0 justify-center px-2 text-[10px]" onClick={syncGlobalStyle} disabled={readOnly} title="生成总框架、全局区域和共享样式的待审来源草稿；不会审核、发布或下发">{globalFrameWorkflow ? "生成全局草稿" : "保存全局草稿"}</Button>
            )}
          </div>
        </footer>
        {VISUAL_CARD_EDITOR_RESIZE_EDGES.filter((edge) => edge !== "south-east").map((edge) => (
          <button
            key={edge}
            type="button"
            data-resize-handle
            data-window-resize-edge={edge}
            aria-label={`从 ${edge} 方向调整可视化窗口大小`}
            onPointerDown={startWindowResize(edge)}
            className="dialog-window-resize-edge"
            tabIndex={-1}
          />
        ))}
        <button
          type="button"
          data-resize-handle
          data-visual-card-window-resize-handle
          data-window-resize-edge="south-east"
          data-shared-resize-handle="true"
          data-shared-window-region="resize"
          aria-label="调整可视化窗口大小"
          title="按住右下角拖动调整窗口大小"
          onPointerDown={startWindowResize("south-east")}
          className="absolute bottom-0 right-0 z-30 flex h-9 w-9 touch-none cursor-se-resize items-center justify-center rounded-tl-md border-l border-t border-white/20 bg-slate-950/65 text-slate-100 transition hover:bg-slate-950 hover:text-white"
        >
          <Maximize2 className="pointer-events-none h-3.5 w-3.5" />
        </button>
      </aside>
    </TooltipProvider>,
    document.body,
  ) : null;

  return <>
    <RuntimeLayoutBridge
      config={runtimeLayout}
      editorOpen={open}
      selectedRegionId={selectedRegionId}
      deferNonSelected={!runtimeFullPassReady}
      onPluginRuntimeChange={setPluginRuntimeByRegion}
      onRegionPreviewChange={setRegionPreviewByRegion}
    />
    <style>{`
      html[data-visual-card-launcher-visible] [data-source-topbar-actions] { margin-right: 6rem !important; }
      [data-product-market-layout][data-visual-card-runtime-region="total-frame"] [data-product-market-workspace] {
        padding: var(--visual-card-frame-top, 12px) var(--visual-card-frame-right, 12px) var(--visual-card-frame-bottom, 60px) var(--visual-card-frame-left, 12px) !important;
      }
      [data-visual-layout-root][data-visual-card-runtime-region="total-frame"] [data-client-project-frame] {
        padding: var(--visual-card-frame-top, 12px) var(--visual-card-frame-right, 12px) var(--visual-card-frame-bottom, 60px) var(--visual-card-frame-left, 12px);
      }
      [data-visual-card-runtime-style="accent"] { outline: 2px solid var(--tradepro-shared-action-bg, var(--tradepro-panel-action-bg, #2563eb)); outline-offset: -2px; background-color: color-mix(in srgb, var(--tradepro-shared-action-bg, var(--tradepro-panel-action-bg, #2563eb)) 12%, var(--tradepro-panel-card-bg, transparent)) !important; }
      [data-visual-card-runtime-style="soft"] { border-radius: var(--tradepro-layout-card-radius, 0.75rem); background-color: color-mix(in srgb, var(--tradepro-panel-card-bg, #fff) 92%, var(--tradepro-shared-action-bg, var(--tradepro-panel-action-bg, #2563eb))) !important; box-shadow: var(--tradepro-layout-shadow, none); }
      [data-visual-card-runtime-style="contrast"] { outline: 2px solid var(--tradepro-panel-frame-text, currentColor); outline-offset: -2px; background-color: var(--tradepro-panel-frame-bg, transparent) !important; color: var(--tradepro-panel-frame-text, currentColor) !important; box-shadow: var(--tradepro-layout-shadow, none); }
      #root .visual-component-instance {
        box-sizing: border-box;
        display: flex;
        min-width: 0;
        align-items: center;
        border: 1px solid var(--tradepro-panel-card-border, var(--tradepro-panel-frame-border, #dbe3ee));
        background: var(--tradepro-panel-card-bg, #ffffff);
        color: var(--tradepro-panel-card-text, var(--tradepro-panel-frame-text, #0f172a));
        padding: var(--tradepro-layout-density, 12px);
      }
      #root .visual-component-instance-title { width: 100%; min-height: 4.5rem; margin-top: var(--tradepro-layout-density, 12px); }
      #root .visual-component-instance-table-header { width: 100%; min-height: 3.25rem; }
      :is(#root, [data-visual-card-editor-dock]) .visual-component-instance-large-card {
        width: 100%;
        min-height: 5rem;
        margin-top: var(--tradepro-layout-density, 12px);
        background: var(--tradepro-product-market-large-card-bg, var(--tradepro-panel-card-bg, #ffffff));
        color: var(--tradepro-product-market-large-card-text, var(--tradepro-panel-card-text, #0f172a));
        font-size: var(--tradepro-shared-large-card-font-size, 0.875rem);
        font-weight: var(--tradepro-shared-large-card-font-weight, var(--tradepro-global-font-weight, 400));
      }
      :is(#root, [data-visual-card-editor-dock]) .visual-component-instance-small-card {
        min-height: 3.5rem;
        margin-top: var(--tradepro-layout-density, 12px);
        background: var(--tradepro-panel-card-bg, #ffffff);
        color: var(--tradepro-panel-card-text, var(--tradepro-panel-frame-text, #0f172a));
        font-size: var(--tradepro-shared-small-card-font-size, 0.75rem);
        font-weight: var(--tradepro-shared-small-card-font-weight, var(--tradepro-global-font-weight, 400));
      }
      #root [data-visual-component-instance-copy="true"] { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 0.25rem; }
      #root [data-visual-component-instance-copy="true"] :where(h2, strong) { margin: 0; font-size: 0.95rem; font-weight: 700; }
      #root [data-visual-component-instance-copy="true"] span { font-size: 0.75rem; color: var(--tradepro-panel-muted-text, #64748b); }
      :is(#root, [data-visual-card-editor-dock]) [data-visual-contract-region="small-card"] [data-visual-component-instance-copy="true"] :where(h2, strong, span) {
        color: var(--tradepro-panel-card-text, var(--tradepro-panel-frame-text, #0f172a));
        font-size: var(--tradepro-shared-small-card-font-size, 0.75rem);
        font-weight: var(--tradepro-shared-small-card-font-weight, var(--tradepro-global-font-weight, 400));
      }
      #root [data-visual-card-runtime-component-style="true"] { box-sizing: border-box; }
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-background] { background: var(--visual-card-component-background) !important; }
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-text] { color: var(--visual-card-component-text) !important; }
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-padding-top] { padding-top: var(--visual-card-component-padding-top) !important; }
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-padding-right] { padding-right: var(--visual-card-component-padding-right) !important; }
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-padding-bottom] { padding-bottom: var(--visual-card-component-padding-bottom) !important; }
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-padding-left] { padding-left: var(--visual-card-component-padding-left) !important; }
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-gap] { gap: var(--visual-card-component-gap) !important; }
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-font-family],
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-font-family] :where(h1, h2, h3, h4, p, span, label, button, input, select, textarea) { font-family: var(--visual-card-component-font-family) !important; }
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-font-size],
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-font-size] :where(h1, h2, h3, h4, p, span, label, button, input, select, textarea) { font-size: var(--visual-card-component-font-size) !important; }
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-font-weight],
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-font-weight] :where(h1, h2, h3, h4, p, span, label, button) { font-weight: var(--visual-card-component-font-weight) !important; }
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-line-height],
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-line-height] :where(h1, h2, h3, h4, p, span, label, button, input, select, textarea) { line-height: var(--visual-card-component-line-height) !important; }
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-letter-spacing],
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-letter-spacing] :where(h1, h2, h3, h4, p, span, label, button, input, select, textarea) { letter-spacing: var(--visual-card-component-letter-spacing) !important; }
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-border-style] { border-style: var(--visual-card-component-border-style) !important; }
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-border-width] { border-width: var(--visual-card-component-border-width) !important; }
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-border-color] { border-color: var(--visual-card-component-border-color) !important; }
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-radius] { border-radius: var(--visual-card-component-radius) !important; }
      #root [data-visual-card-runtime-component-style="true"][data-visual-card-runtime-shadow] { box-shadow: var(--visual-card-component-shadow) !important; }
      #root [data-visual-contract-annotation] { position: relative; }
      #root [data-visual-contract-annotation]::after {
        content: attr(data-visual-contract-annotation);
        position: absolute;
        z-index: var(--tradepro-context-marker-z-index, 90);
        top: 0.375rem;
        right: 0.5rem;
        width: max-content;
        display: none;
        border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
        border-radius: 999px;
        padding: 0.125rem 0.375rem;
        background: var(--tradepro-shared-action-bg, var(--tradepro-panel-action-bg, #2563eb));
        color: var(--tradepro-shared-action-text, var(--tradepro-panel-action-text, #ffffff));
        font-size: 0.625rem;
        font-weight: 600;
        line-height: 1;
        pointer-events: none;
      }
      #root [data-visual-contract-annotation]:not([data-existing-workspace-body-marker-host]):is(:hover, :focus-within)::after { display: inline-flex; }
      #root :is([data-visual-contract-region="body"], [data-existing-workspace-body-marker-host])::after { left: var(--responsive-workspace-marker-left-inset, 0.25rem); right: auto; writing-mode: vertical-rl; text-orientation: upright; }
      #root [data-visual-contract-region="table-shell"]::after { left: var(--responsive-table-shell-marker-left-inset, 0px); right: auto; writing-mode: vertical-rl; text-orientation: upright; }
      #root [data-visual-contract-region="content"]::after { left: 0.25rem; right: auto; writing-mode: vertical-rl; text-orientation: upright; }
      #root [data-visual-contract-region="large-card"]::after { top: var(--responsive-large-card-marker-top-inset, 2px); left: 50%; right: auto; z-index: var(--tradepro-large-card-marker-z-index, 120); transform: translateX(-50%); }
      #root [data-visual-contract-region="small-card"]::after { left: 0.5rem; right: auto; }
      #root [data-visual-contract-annotation][data-visual-card-annotation-visibility="always"]:not([data-shared-small-card-marker-effective="silent"]):not([data-development-standard-marker="silent"]:not([data-shared-small-card-marker-effective="representative"]))::after { display: inline-flex !important; opacity: 1 !important; visibility: visible !important; }
      #root [data-visual-card-annotation-visibility="hidden"]::after { display: none !important; }
      #root [data-visual-card-annotation-visibility="hover"]::after { opacity: 0 !important; visibility: hidden !important; }
      #root [data-visual-contract-annotation][data-visual-card-annotation-visibility="hover"]:not([data-shared-small-card-marker-effective="silent"]):not([data-development-standard-marker="silent"]:not([data-shared-small-card-marker-effective="representative"])):not([data-existing-workspace-body-marker-host]):hover::after { display: inline-flex !important; opacity: 1 !important; visibility: visible !important; }
      #root [data-visual-card-annotation-mode="vertical"]::after { writing-mode: vertical-rl !important; text-orientation: upright !important; }
      #root [data-visual-card-annotation-mode="inline"]::after { writing-mode: horizontal-tb !important; text-orientation: mixed !important; }
      @media (max-width: 639px) {
        #root :is([data-visual-contract-region="body"], [data-existing-workspace-body-marker-host]):not([data-visual-card-annotation-visibility="always"])::after { display: none !important; }
      }
      [data-visual-card-runtime-placement="sticky-start"] { position: sticky !important; top: 0; z-index: 45; }
      [data-visual-card-runtime-placement="sticky-end"] { position: sticky !important; bottom: 0; z-index: 45; }
      [data-visual-card-runtime-collapsed="true"] { max-height: 2.25rem !important; min-height: 0 !important; overflow: hidden !important; opacity: 0.55; }
      html[data-visual-card-editor-open] [data-visual-card-editor-selected="true"] { outline: 3px solid #2563eb !important; outline-offset: 2px; box-shadow: 0 0 0 6px rgb(37 99 235 / 18%) !important; }
      [data-visual-plugin-preview] {
        color: var(--tradepro-panel-list-text, var(--tradepro-panel-card-text, #475569));
        transition: color 160ms ease;
      }
      [data-visual-plugin-preview][data-visual-plugin-preview-enabled="true"] {
        color: var(--tradepro-shared-plugin-accent, var(--tradepro-panel-action-bg, #2563eb));
      }
      html[data-visual-card-window-interaction="drag"] * { cursor: move !important; user-select: none !important; }
      html[data-visual-card-window-interaction^="resize-"] * { user-select: none !important; }
      html[data-visual-card-window-interaction="resize-north"] * { cursor: n-resize !important; }
      html[data-visual-card-window-interaction="resize-south"] * { cursor: s-resize !important; }
      html[data-visual-card-window-interaction="resize-east"] * { cursor: e-resize !important; }
      html[data-visual-card-window-interaction="resize-west"] * { cursor: w-resize !important; }
      html[data-visual-card-window-interaction="resize-north-east"] * { cursor: ne-resize !important; }
      html[data-visual-card-window-interaction="resize-north-west"] * { cursor: nw-resize !important; }
      html[data-visual-card-window-interaction="resize-south-east"] * { cursor: se-resize !important; }
      html[data-visual-card-window-interaction="resize-south-west"] * { cursor: sw-resize !important; }
      @media (max-width: 900px) {
        html[data-visual-card-launcher-visible] [data-source-topbar-actions] { margin-right: 3.25rem !important; }
        [data-visual-card-control-strip] { right: 0.5rem; top: 0.5rem; }
        [data-visual-card-developer-launcher] { width: 2.5rem; padding-left: 0.4375rem; padding-right: 0.4375rem; }
        [data-visual-card-developer-launcher] > span:last-child { display: none; }
      }
    `}</style>
    {dock}
  </>;
}
