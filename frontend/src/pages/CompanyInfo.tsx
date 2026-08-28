import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Suspense, lazy } from "react";

import type, { CSSProperties } from "react";

import type, { DeferredCompanyInfoTabKey } from "./CompanyInfoDeferredPanels";

import { useLocation, useSearchParams } from "react-router-dom";

import { Blocks, Building2, Calendar, ChevronDown, ChevronUp, Factory, Globe2, HelpCircle, Image, ImageIcon, Lock, MessageCircle, Navigation, Package, Unlock, Upload, Plus, ShieldCheck, Trash2, Truck } from "lucide-react";

import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";

import { SortableContext, arrayMove, horizontalListSortingStrategy, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import UnifiedActionDialog from "@/components/UnifiedActionDialog";
import { FactoryPage } from "@/page-factory/FactoryPage";

import { Input } from "@/components/ui/input";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { ScrollArea } from "@/components/ui/scroll-area";

import { ContentPluginActionButton, ContentPluginDragHandle, ContentPluginMoveButtons, ContentPluginToggle, formatContentPluginOrder } from "@/components/content-plugins/ContentPluginControls";

import { HomepageDesignGovernance } from "@/components/HomepageDesignGovernance";

import { navItems } from "@/components/Sidebar";

import { isCompletedLayoutLocked, setCompletedLayoutLocked } from "@/lib/page-layout-lock";

import { toast } from "@/hooks/use-toast";

import { getAIBuilderScope } from "@/lib/ai-builder-scope";

import { buildSiteHtml, normalizeBuilderState } from "@/lib/ai-site-builder";

import { loadLazyModule } from "@/lib/lazy-module-recovery";

import { copyTextWithFallback } from "@/lib/browser-utils";
import { usePostPaintReady } from "@/lib/post-paint-lazy";

import { listMaterialAssets, recordMaterialAssetApply, syncMaterialAssetUsage, type MaterialAssetItem, uploadMaterialAsset } from "@/lib/material-assets";
import { getMediaUploadAccept } from "@/lib/media-optimization-contract";

import { platformApi } from "@/lib/platform-api";

import { buildConfiguredProductNavItems, isNavPathMatch } from "@/lib/product-navigation";

import { ICON_OPTIONS, useProductMarketStore } from "@/lib/product-market-store";

import { getSiteById, saveSite, syncSiteToBackend } from "@/lib/sites";

import { getWebsiteTemplatePresetById } from "@website-style/website-template-presets";

import { createWebsiteNavigationTemplate, getWebsiteContentState, saveWebsiteContentState, WEBSITE_NAVIGATION_TEMPLATES, type WebsiteContentState, type WebsiteNavigationItem, type WebsiteNavigationTemplateId } from "@/lib/website-content-store";
import { SHARED_PROJECT_SYNC_REQUEST_EVENT, type SharedProjectSyncRequestDetail } from "@/lib/shared-project-sync-contract";

type TabKey =
  | "navigation"
  | "profile"
  | "banner"
  | "recommend"
  | "about"
  | "faq"
  | "factory"
  | "gallery"
  | "exhibition"
  | "service"
  | "logistics"
  | "im"
  | "modules";

const NAVIGATION_DESCRIPTION = "网站导航结构，同步影响网站预览。";
const NAVIGATION_TITLE_ACTION_ORDER_KEY = "tradepro.navigation-title-action-order.v1";
const NAVIGATION_TITLE_ACTION_IDS = ["add", "save"] as const;
type NavigationTitleActionId = (typeof NAVIGATION_TITLE_ACTION_IDS)[number];

function readNavigationTitleActionOrder(): NavigationTitleActionId[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(NAVIGATION_TITLE_ACTION_ORDER_KEY) || "[]");
    const valid = Array.isArray(stored)
      ? stored.filter((value): value is NavigationTitleActionId => NAVIGATION_TITLE_ACTION_IDS.includes(value))
      : [];
    return [...valid, ...NAVIGATION_TITLE_ACTION_IDS.filter((value) => !valid.includes(value))];
  } catch {
    return [...NAVIGATION_TITLE_ACTION_IDS];
  }
}

const TABS: Array<{ key: TabKey; label: string; icon: typeof Building2 }> = [
  { key: "navigation", label: "导航自定义", icon: Navigation },
  { key: "profile", label: "基本资料", icon: Building2 },
  { key: "banner", label: "首页 Banner", icon: Image },
  { key: "recommend", label: "产品推荐", icon: Blocks },
  { key: "about", label: "公司介绍", icon: Building2 },
  { key: "faq", label: "FAQ", icon: HelpCircle },
  { key: "factory", label: "工厂生产", icon: Factory },
  { key: "gallery", label: "公司风采", icon: Image },
  { key: "exhibition", label: "展会活动", icon: Calendar },
  { key: "service", label: "服务保障", icon: ShieldCheck },
  { key: "logistics", label: "物流货运", icon: Truck },
  { key: "im", label: "IM 客服 / SNS", icon: MessageCircle },
  { key: "modules", label: "自定义模块", icon: Blocks },
];

const DeferredCompanyInfoPanels = lazy(() => loadLazyModule(
  () => import("./CompanyInfoDeferredPanels"),
  "company-info-deferred-panels",
));
type DeferredTabKey = Exclude<TabKey, "navigation">;

function DeferredCompanyInfoPanelsPlaceholder() {
  return (
    <div
      aria-hidden="true"
      data-company-info-deferred-panels-placeholder
      className="min-h-[360px] rounded-xl border border-slate-200 bg-slate-50"
    />
  );
}

function resolveCompanyInfoTitles(activeTab: TabKey, products: ReturnType<typeof useProductMarketStore.getState>["products"], customProducts: ReturnType<typeof useProductMarketStore.getState>["customProducts"], productOrder: ReturnType<typeof useProductMarketStore.getState>["productOrder"]) {
  const configuredSidebarItems = buildConfiguredProductNavItems(navItems, products, customProducts, productOrder);
  const targetPath = `/company-info?tab=${activeTab}`;
  const [targetPathname, targetRawSearch] = targetPath.split("?");
  const targetSearch = targetRawSearch ? `?${targetRawSearch}` : "";

  const matchedTopLevel = configuredSidebarItems.find((item) => {
    if (isNavPathMatch(item.path, targetPathname, targetSearch)) return true;
    return item.children?.some((child) => isNavPathMatch(child.path, targetPathname, targetSearch));
  });
  const matchedSecondary = matchedTopLevel?.children?.find((child) => isNavPathMatch(child.path, targetPathname, targetSearch));

  return {
    primaryLabel: matchedTopLevel?.label || "企业资料",
    primaryIcon: matchedTopLevel?.icon || Building2,
    secondaryLabel:
      (matchedSecondary?.label && matchedSecondary.label !== matchedTopLevel?.label
        ? matchedSecondary.label
        : undefined) ||
      TABS.find((item) => item.key === activeTab)?.label ||
      "导航自定义",
    secondaryIcon: TABS.find((item) => item.key === activeTab)?.icon || Navigation,
  };
}

function withAlpha(color: string, alpha: number) {
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    const value = trimmed.replace("#", "");
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const match = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (match) return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
  return color;
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeNavigationToken(value: string) {
  return value
    .trim()
    .replace(/^[/#]+/, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const NAVIGATION_LEVEL_NAMES = ["\u4e00\u7ea7", "\u4e8c\u7ea7", "\u4e09\u7ea7", "\u56db\u7ea7", "\u4e94\u7ea7"] as const;

function getNavigationLevelName(level: number) {
  return NAVIGATION_LEVEL_NAMES[level] || `${level + 1}\u7ea7`;
}

function createNavigationDraft(level = 0): WebsiteNavigationItem {
  const sectionKey = `section-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id: uid("nav"),
    label: `\u65b0${getNavigationLevelName(level)}\u5bfc\u822a`,
    sectionKey,
    href: `/${sectionKey}`,
    visible: true,
    children: level < 4 ? [] : undefined,
  };
}

function updateNavigationTree(
  items: WebsiteNavigationItem[],
  targetId: string,
  updater: (item: WebsiteNavigationItem) => WebsiteNavigationItem
): WebsiteNavigationItem[] {
  let changed = false;
  const nextItems = items.map((item) => {
    if (item.id === targetId) {
      const nextItem = updater(item);
      changed = changed || nextItem !== item;
      return nextItem;
    }
    if (!item.children?.length) return item;
    const nextChildren = updateNavigationTree(item.children, targetId, updater);
    if (nextChildren === item.children) return item;
    changed = true;
    return { ...item, children: nextChildren };
  });
  return changed ? nextItems : items;
}

function removeNavigationTree(items: WebsiteNavigationItem[], targetId: string): WebsiteNavigationItem[] {
  return items
    .filter((item) => item.id !== targetId)
    .map((item) => (item.children?.length ? { ...item, children: removeNavigationTree(item.children, targetId) } : item));
}

const NAVIGATION_ICON_OPTIONS: Array<{ key: string; label: string; icon: typeof Building2 }> = [
  { key: "Navigation", label: "导航", icon: Navigation },
  { key: "Globe2", label: "网站", icon: Globe2 },
  { key: "Building2", label: "企业", icon: Building2 },
  { key: "Package", label: "产品", icon: Package },
  { key: "Blocks", label: "模块", icon: Blocks },
  { key: "Image", label: "图片", icon: Image },
  { key: "Calendar", label: "活动", icon: Calendar },
  { key: "Factory", label: "工厂", icon: Factory },
  { key: "HelpCircle", label: "帮助", icon: HelpCircle },
  { key: "ShieldCheck", label: "服务", icon: ShieldCheck },
  { key: "Truck", label: "物流", icon: Truck },
  { key: "MessageCircle", label: "客服", icon: MessageCircle },
];

const NAVIGATION_ICON_MAP = Object.fromEntries(NAVIGATION_ICON_OPTIONS.map((option) => [option.key, option.icon])) as Record<
  string,
  typeof Building2
>;
ICON_OPTIONS.forEach((option) => {
  NAVIGATION_ICON_MAP[option.name] = option.icon as typeof Building2;
});

function getNavigationIcon(name?: string) {
  return NAVIGATION_ICON_MAP[name || "Navigation"] || Navigation;
}

const NAVIGATION_PICKER_OPTIONS = [
  ...NAVIGATION_ICON_OPTIONS.map((option) => ({ key: option.key, label: option.label, icon: option.icon })),
  ...ICON_OPTIONS.filter((option) => !NAVIGATION_ICON_OPTIONS.some((item) => item.key === option.name)).map((option) => ({
    key: option.name,
    label: option.name,
    icon: option.icon,
  })),
];

const DEFAULT_TOP_LEVEL_NAV_ICON: Record<string, string> = {
  "/company-info?tab=about": "Building2",
  "/company-info?tab=service": "ShieldCheck",
  "/company-info?tab=im": "MessageCircle",
};

// This track is calculated from the shared content-plugin hit areas.  The
// switch is 44px wide (not the old 40px placeholder), so the delete control
// never spills into the first level pill after Global Sync.
const NAVIGATION_OPERATION_COLUMN_WIDTH = "calc(var(--tradepro-shared-plugin-control-size, 2rem) * 4 + var(--tradepro-shared-plugin-toggle-width, 2.75rem) + var(--tradepro-shared-plugin-icon-width, 5.625rem) + var(--tradepro-shared-plugin-gap, 0.5rem) * 5)";
const NAVIGATION_SORT_COLUMN_WIDTH = "214px";
// The operation grid requires 302px and the level column 214px, plus their
// shared 16px separator.  Keep the parent track at least 534px so neither
// side can collapse into the other at common desktop widths.
const NAVIGATION_FUNCTION_COLUMN_WIDTH = "clamp(534px, 48vw, 560px)";
const NAVIGATION_MATRIX_COLUMN_VARS = {
  ["--awm-function-width" as string]: NAVIGATION_FUNCTION_COLUMN_WIDTH,
  ["--awm-operation-width" as string]: NAVIGATION_OPERATION_COLUMN_WIDTH,
  ["--awm-sort-width" as string]: NAVIGATION_SORT_COLUMN_WIDTH,
  ["--awm-section-gap" as string]: "24px",
  ["--awm-function-gap" as string]: "var(--tradepro-shared-plugin-section-gap, 1rem)",
} as Record<string, string>;
const NAVIGATION_MATRIX_PILL_HEIGHT = "40px";

function buildNavigationSortCode(indexPath: number[]) {
  return indexPath.map((item) => formatContentPluginOrder(item)).join(".");
}

function formatMaterialAssetSize(sizeBytes: number) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return "0 B";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(sizeBytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(sizeBytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function formatMaterialAssetTime(value?: string) {
  if (!value) return "未知时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function collectNavigationIconAssetIds(items: WebsiteNavigationItem[]): string[] {
  return items.flatMap((item) => {
    const currentIds = item.customIconAssetId?.trim() ? [item.customIconAssetId.trim()] : [];
    return currentIds.concat(item.children?.length ? collectNavigationIconAssetIds(item.children) : []);
  });
}

function reorderNavigationSiblings(
  items: WebsiteNavigationItem[],
  activeId: string,
  overId: string
): { changed: boolean; items: WebsiteNavigationItem[] } {
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const overIndex = items.findIndex((item) => item.id === overId);
  if (activeIndex !== -1 && overIndex !== -1) {
    return { changed: true, items: arrayMove(items, activeIndex, overIndex) };
  }

  let changed = false;
  const nextItems = items.map((item) => {
    if (!item.children?.length) return item;
    const result = reorderNavigationSiblings(item.children, activeId, overId);
    if (!result.changed) return item;
    changed = true;
    return { ...item, children: result.items };
  });
  return { changed, items: nextItems };
}

function moveNavigationSibling(
  items: WebsiteNavigationItem[],
  targetId: string,
  direction: -1 | 1
): { changed: boolean; items: WebsiteNavigationItem[] } {
  const currentIndex = items.findIndex((item) => item.id === targetId);
  if (currentIndex !== -1) {
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= items.length) {
      return { changed: false, items };
    }
    return { changed: true, items: arrayMove(items, currentIndex, nextIndex) };
  }

  let changed = false;
  const nextItems = items.map((item) => {
    if (!item.children?.length) return item;
    const result = moveNavigationSibling(item.children, targetId, direction);
    if (!result.changed) return item;
    changed = true;
    return { ...item, children: result.items };
  });
  return { changed, items: nextItems };
}

async function persistWebsiteContent(
  state: WebsiteContentState,
  contentScopeId: string,
  builderScope: "client" | "agency" | "hq",
  siteId: string | null
) {
  const nextCompanyName = state.profile.companyName?.trim() || "";
  saveWebsiteContentState(state, contentScopeId);
  if (siteId) {
    saveWebsiteContentState(state, siteId);
  }
  const navigationIconAssetIds = Array.from(new Set(collectNavigationIconAssetIds(state.navigation.items)));

  try {
    await syncMaterialAssetUsage(
      [
        {
          sourceKey: siteId || contentScopeId,
          sourceLabel: `${nextCompanyName || "缃戠珯"}瀵艰埅鍥炬爣`,
          assetIds: navigationIconAssetIds,
        },
      ],
      "website-content"
    );
  } catch {
    // Keep content persistence resilient even if local material usage sync is temporarily unavailable.
  }

  if (!siteId) {
    toast({ title: "\u5df2\u4fdd\u5b58", description: "\u4f01\u4e1a\u8d44\u6599\u5df2\u4fdd\u5b58\u5230\u672c\u5730\u5185\u5bb9\u4e2d\u5fc3\u3002" });
    return;
  }

  const site = getSiteById(siteId);
  if (!site || (site.scope || "client") !== builderScope) {
    toast({ title: "\u5df2\u4fdd\u5b58", description: "\u672c\u6b21\u4ec5\u4fdd\u5b58\u5230\u5185\u5bb9\u4e2d\u5fc3\uff0c\u672a\u627e\u5230\u5bf9\u5e94\u7f51\u7ad9\u8ba1\u5212\u3002" });
    return;
  }

  const builderSource = site.builderState && typeof site.builderState === "object" ? site.builderState : {};
  const templateId =
    typeof (builderSource as Record<string, unknown>).templateId === "string"
      ? ((builderSource as Record<string, unknown>).templateId as string)
      : "";

  const nextBuilderState = normalizeBuilderState(
    {
      ...builderSource,
      companyName: nextCompanyName || site.planName || site.name,
      siteName: nextCompanyName || site.planName || site.name,
      brandName:
        nextCompanyName ||
        (typeof (builderSource as Record<string, unknown>).brandName === "string"
          ? ((builderSource as Record<string, unknown>).brandName as string)
          : site.planName || site.name),
    },
    templateId ? getWebsiteTemplatePresetById(templateId) : undefined,
    state
  );
  nextBuilderState.siteName = nextCompanyName || site.planName || site.name;

  const nextSite = {
    ...site,
    name: nextCompanyName || site.planName || site.name,
    planName: nextCompanyName || site.planName || site.name,
    builderState: nextBuilderState,
    html: buildSiteHtml(nextBuilderState),
  };
  saveSite(nextSite);
  if (typeof site.planId === "number" && Number.isFinite(site.planId) && site.planId > 0) {
    try {
      await platformApi.updateProject(site.planId, { name: nextSite.planName || nextSite.name });
    } catch {
      // Keep the local/site metadata saved even if project name sync is temporarily unavailable.
    }
  }
  await syncSiteToBackend(nextSite);
  toast({ title: "\u5df2\u540c\u6b65", description: "\u4f01\u4e1a\u8d44\u6599\u5df2\u540c\u6b65\u5230\u603b\u90e8\u3001\u4ee3\u7406\u3001\u5ba2\u6237\u7aef\u548c\u7f51\u7ad9\u9884\u89c8\u3002" });
}

function NavigationIconPicker({
  value,
  customIconUrl,
  onOpenMaterialPicker,
  onChange,
  popoverStyle,
  popoverPanelStyle,
  compact = false,
}: {
  value?: string;
  customIconUrl?: string;
  onOpenMaterialPicker: () => void;
  onChange: (name: string) => void;
  popoverStyle?: CSSProperties;
  popoverPanelStyle?: CSSProperties;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const PreviewIcon = getNavigationIcon(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-content-plugin-control="icon"
          title="图标设置"
          className={`content-plugin-icon-trigger nav-icon-setting flex items-center justify-start gap-1 bg-transparent text-left text-slate-900 ${compact ? "h-8 w-[5.625rem] min-w-[5.625rem] px-1 text-[14px] sm:px-1.5" : "h-8 w-full px-1 text-[14px]"}`}
        >
          {customIconUrl ? (
            <img src={customIconUrl} alt="icon" className="h-4 w-4 object-contain" />
          ) : (
            <PreviewIcon className="h-4 w-4" />
          )}
          <span className="truncate">图标设置</span>
        </button>
      </PopoverTrigger>
      {open ? (
        <PopoverContent className="w-72 space-y-2 rounded-xl border p-3 text-slate-900 shadow-lg" style={popoverStyle} align="start">
          <div className="text-xs font-semibold">选择图标</div>
          <button
            type="button"
            className="flex h-8 w-full items-center justify-start gap-1 rounded-lg border px-2 text-sm shadow-none"
            style={popoverPanelStyle}
            onClick={onOpenMaterialPicker}
          >
            <Upload className="h-3.5 w-3.5" />
            上传或使用素材
          </button>
          {customIconUrl ? (
            <div className="flex items-center gap-2 rounded-lg border px-2 py-1 text-xs" style={popoverPanelStyle}>
              <img src={customIconUrl} alt="uploaded" className="h-6 w-6 object-contain" />
              <span className="flex min-w-0 items-center gap-1 truncate">
                <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                已上传自定义图标
              </span>
            </div>
          ) : null}
          <div className="text-[11px] opacity-75">或选择默认图标</div>
          <div className="grid grid-cols-5 gap-1 rounded-lg border p-2" style={popoverPanelStyle}>
            {NAVIGATION_PICKER_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = !customIconUrl && (value || "Navigation") === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onChange(option.key)}
                  className={`flex h-9 w-9 items-center justify-center border-0 bg-transparent p-0 text-slate-900 ${isActive ? "opacity-100" : "opacity-65"}`}
                  title={option.label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </PopoverContent>
      ) : null}
    </Popover>
  );
}

function NavigationMatrixEditorV2({
  items,
  onChange,
  onApplyTemplate,
  onSave,
  description,
  pageTitle,
  PageIcon,
}: {
  items: WebsiteNavigationItem[];
  onChange: (items: WebsiteNavigationItem[]) => void;
  onApplyTemplate: (templateId: WebsiteNavigationTemplateId) => void;
  onSave: () => Promise<void> | void;
  description: string;
  pageTitle: string;
  PageIcon: typeof Building2;
}) {
  const { layoutStyle, sidebarStyle } = useProductMarketStore();
  const [collapsedIds, setCollapsedIds] = useState<string[]>([]);
  const [navigationLayoutLocked, setNavigationLayoutLocked] = useState(() => isCompletedLayoutLocked("navigation-customization"));
  const [titleActionOrder, setTitleActionOrder] = useState<NavigationTitleActionId[]>(readNavigationTitleActionOrder);
  const [mobileHeaderExpanded, setMobileHeaderExpanded] = useState(false);
  const [mobileTableHeaderExpanded, setMobileTableHeaderExpanded] = useState(false);
  const [iconPickerTarget, setIconPickerTarget] = useState<{ itemId: string } | null>(null);
  const iconMaterialDialogOpen = Boolean(iconPickerTarget);
  const [materialAssets, setMaterialAssets] = useState<MaterialAssetItem[]>([]);
  const [materialAssetsLoading, setMaterialAssetsLoading] = useState(false);
  const [materialAssetsUploading, setMaterialAssetsUploading] = useState(false);
  const materialAssetsUploadRef = useRef<HTMLInputElement>(null);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    busyLabel: string;
    onConfirm: null | (() => Promise<void> | void);
  }>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "确认执行",
    busyLabel: "执行中...",
    onConfirm: null,
  });
  const activeNavigationInputRef = useRef<{
    itemId: string;
    field: "label" | "sectionKey" | "href";
    selectionStart: number | null;
    selectionEnd: number | null;
  } | null>(null);
  const panelStyle = useMemo(
    () => ({
      // The navigation editor's outer frame is the client right-panel surface,
      // not an old dialog surface.  This keeps it in sync with the shared
      // “客户端右侧栏底色 → 右侧栏底色” control.
      backgroundColor: layoutStyle.contentBgColor || "#ffffff",
      borderColor: withAlpha(sidebarStyle.borderColor || "#94a3b8", 0.34),
      color: layoutStyle.contentTextColor || "#0f172a",
    }),
    [
      layoutStyle.contentBgColor,
      layoutStyle.contentTextColor,
      sidebarStyle.borderColor,
    ]
  );
  const rowStyle = useMemo(
    () => ({
      backgroundColor:
        layoutStyle.clientFeatureCardBgColor ||
        layoutStyle.clientCardBgColor ||
        layoutStyle.defaultDialogContentBgColor ||
        layoutStyle.defaultDialogBgColor ||
        "#ffffff",
      borderColor: withAlpha(sidebarStyle.borderColor || "#94a3b8", 0.28),
      color:
        layoutStyle.clientFeatureCardTextColor ||
        layoutStyle.clientCardTextColor ||
        layoutStyle.contentTextColor ||
        layoutStyle.themePanelTextColor ||
        "#0f172a",
    }),
    [
      layoutStyle.clientFeatureCardBgColor,
      layoutStyle.clientCardBgColor,
      layoutStyle.clientFeatureCardTextColor,
      layoutStyle.clientCardTextColor,
      layoutStyle.contentTextColor,
      layoutStyle.defaultDialogBgColor,
      layoutStyle.defaultDialogContentBgColor,
      layoutStyle.themePanelTextColor,
      sidebarStyle.borderColor,
    ]
  );
  const navigationRootCardStyle = useMemo(
    () => ({
      backgroundColor: rowStyle.backgroundColor as string,
      borderColor: withAlpha((rowStyle.color as string) || "#0f172a", 0.28),
      color: rowStyle.color as string,
    }),
    [rowStyle]
  );
  const headerSurfaceStyle = useMemo(
    () => ({
      backgroundColor:
        layoutStyle.clientSecondaryTitleBgColor ||
        "#155e4b",
      color:
        layoutStyle.clientSecondaryTitleTextColor ||
        "#ffffff",
      borderColor: withAlpha(sidebarStyle.borderColor || "#94a3b8", 0.34),
    }),
    [
      layoutStyle.clientSecondaryTitleBgColor,
      layoutStyle.clientSecondaryTitleTextColor,
      sidebarStyle.borderColor,
    ]
  );
  const subnavSurfaceStyle = useMemo(
    () => ({
      backgroundColor: "var(--tradepro-panel-table-bg)",
      color: "var(--tradepro-panel-table-text)",
      borderColor: "color-mix(in srgb, var(--tradepro-panel-table-text) 34%, transparent)",
    }),
    []
  );
  const primaryActionStyle = useMemo(
    () => ({
      backgroundColor: "var(--tradepro-panel-action-bg)",
      color: "var(--tradepro-panel-action-text)",
      borderColor: "var(--tradepro-panel-action-bg)",
    }),
    []
  );
  const footerSurfaceStyle = useMemo(
    () => ({
      background: layoutStyle.clientFooterOverrideBgColor || sidebarStyle.bgTo || "var(--tradepro-shell-to)",
      backgroundColor: layoutStyle.clientFooterOverrideBgColor || sidebarStyle.bgTo || "var(--tradepro-shell-to)",
      color: layoutStyle.clientFooterOverrideTextColor || sidebarStyle.textColor || "var(--tradepro-shell-text)",
      borderColor: "var(--tradepro-shell-border)",
    }),
    [layoutStyle.clientFooterOverrideBgColor, layoutStyle.clientFooterOverrideTextColor, sidebarStyle.bgTo, sidebarStyle.textColor]
  );
  const primaryActionClassName = "tradepro-panel-action inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium leading-none shadow-sm";
  const lockNavigationLayout = () => {
    setCompletedLayoutLocked("navigation-customization", true);
    setNavigationLayoutLocked(true);
  };
  const loadMaterialAssets = useCallback(async () => {
    setMaterialAssetsLoading(true);
    try {
      const response = await listMaterialAssets();
      setMaterialAssets(response.items || []);
    } catch {
      toast({ title: "\u7d20\u6750\u8bfb\u53d6\u5931\u8d25", description: "\u8bf7\u7a0d\u540e\u91cd\u8bd5\u6216\u68c0\u67e5\u672c\u5730\u7d20\u6750\u670d\u52a1\u3002" });
    } finally {
      setMaterialAssetsLoading(false);
    }
  }, []);
  const orderedMaterialAssets = useMemo(() => {
    if (!iconMaterialDialogOpen) return [];
    return [...materialAssets].sort((a, b) => {
      const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (Number.isFinite(timeDiff) && timeDiff !== 0) return timeDiff;
      return a.fileName.localeCompare(b.fileName, "zh-CN");
    });
  }, [iconMaterialDialogOpen, materialAssets]);
  const imageMaterialAssets = useMemo(
    () => orderedMaterialAssets.filter((asset) => asset.kind === "image"),
    [orderedMaterialAssets]
  );
  useEffect(() => {
    document.querySelector("main.app-main")?.scrollTo({ top: 0, left: 0 });
  }, []);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const rememberNavigationInput = useCallback((
    itemId: string,
    field: "label" | "sectionKey" | "href",
    input: HTMLInputElement
  ) => {
    activeNavigationInputRef.current = {
      itemId,
      field,
      selectionStart: input.selectionStart,
      selectionEnd: input.selectionEnd,
    };
  }, []);

  useEffect(() => {
    const activeInput = activeNavigationInputRef.current;
    if (!activeInput) return;

    const input = Array.from(document.querySelectorAll<HTMLInputElement>("input[data-nav-item-id]")).find(
      (element) =>
        element.dataset.navItemId === activeInput.itemId &&
        element.dataset.navField === activeInput.field
    );
    if (!input) return;

    if (document.activeElement !== input) {
      input.focus({ preventScroll: true });
    }

    const valueLength = input.value.length;
    const start = Math.min(activeInput.selectionStart ?? valueLength, valueLength);
    const end = Math.min(activeInput.selectionEnd ?? start, valueLength);
    input.setSelectionRange(start, end);
  }, [items]);

  const updateItem = useCallback((targetId: string, updater: (item: WebsiteNavigationItem) => WebsiteNavigationItem) => {
    onChange(updateNavigationTree(items, targetId, updater));
  }, [items, onChange]);

  const appendDraft = (draftId: string) => {
    window.setTimeout(() => {
      const row = document.getElementById(`nav-row-${draftId}`);
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
      const input = row?.querySelector("input[data-nav-name='true']") as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }, 80);
  };

  const addRoot = () => {
    const draft = { ...createNavigationDraft(0), iconName: "Navigation" };
    onChange([...items, draft]);
    setCollapsedIds([]);
    appendDraft(draft.id);
  };

  const addChild = (targetId: string, level: number) => {
    if (level >= 4) return;
    const draft = { ...createNavigationDraft(level + 1), iconName: "Navigation" };
    updateItem(targetId, (item) => ({
      ...item,
      children: [...(item.children || []), draft],
    }));
    setCollapsedIds((current) => current.filter((id) => id !== targetId));
    appendDraft(draft.id);
  };

  const removeItem = (targetId: string) => onChange(removeNavigationTree(items, targetId));
  const toggleCollapsed = (targetId: string) =>
    setCollapsedIds((current) => (current.includes(targetId) ? current.filter((id) => id !== targetId) : [...current, targetId]));
  const moveItem = (targetId: string, direction: -1 | 1) => {
    const result = moveNavigationSibling(items, targetId, direction);
    if (result.changed) onChange(result.items);
  };
  const openIconMaterialPicker = useCallback((itemId: string) => {
    if (!materialAssets.length && !materialAssetsLoading) {
      void loadMaterialAssets();
    }
    setIconPickerTarget({ itemId });
  }, [loadMaterialAssets, materialAssets.length, materialAssetsLoading]);
  const closeIconMaterialPicker = useCallback(() => {
    setIconPickerTarget(null);
  }, []);
  const handleMaterialAssetUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "\u8bf7\u4e0a\u4f20\u56fe\u7247\u7d20\u6750", description: "\u5bfc\u822a\u56fe\u6807\u53ea\u652f\u6301\u56fe\u7247\u683c\u5f0f\u3002" });
      event.target.value = "";
      return;
    }
    setMaterialAssetsUploading(true);
    try {
      const asset = await uploadMaterialAsset(file, "image");
      await loadMaterialAssets();
      if (iconPickerTarget) {
        updateItem(iconPickerTarget.itemId, (current) => ({
          ...current,
          iconName: undefined,
          customIconUrl: asset.publicUrl,
          customIconAssetId: asset.assetId,
        }));
        closeIconMaterialPicker();
      }
      toast({
        title: "\u7d20\u6750\u5df2\u4e0a\u4f20",
        description: asset.storagePath
          ? `\u56fe\u6807\u7d20\u6750\u5df2\u4fdd\u5b58\u5230 ${asset.storagePath}\u3002`
          : "\u56fe\u6807\u7d20\u6750\u5df2\u4fdd\u5b58\u5230\u672c\u5730\u79c1\u6709\u7d20\u6750\u5e93\uff0c\u5b9e\u9645\u8def\u5f84\u89c1\u7d20\u6750\u6761\u76ee\u6216\u6e90\u7801\u4e0e\u90e8\u7f72\u4e2d\u5fc3\u3002",
      });
    } catch {
      toast({ title: "\u4e0a\u4f20\u5931\u8d25", description: "\u56fe\u6807\u7d20\u6750\u4e0a\u4f20\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002" });
    } finally {
      setMaterialAssetsUploading(false);
      event.target.value = "";
    }
  }, [closeIconMaterialPicker, iconPickerTarget, loadMaterialAssets, updateItem]);
  const handleApplyExistingIconMaterialAsset = useCallback(async (asset: MaterialAssetItem) => {
    if (!iconPickerTarget) return;
    if (asset.kind !== "image") {
      toast({ title: "\u7d20\u6750\u7c7b\u578b\u4e0d\u5339\u914d", description: "\u5bfc\u822a\u56fe\u6807\u4ec5\u652f\u6301\u56fe\u7247\u7d20\u6750\u3002" });
      return;
    }
    updateItem(iconPickerTarget.itemId, (current) => ({
      ...current,
      iconName: undefined,
      customIconUrl: asset.publicUrl,
      customIconAssetId: asset.assetId,
    }));
    try {
      const applyResult = await recordMaterialAssetApply(asset.assetId);
      setMaterialAssets((current) => current.map((item) => (
        item.assetId === applyResult.assetId
          ? { ...item, applyCount: applyResult.applyCount }
          : item
      )));
    } catch {
      // Applying the chosen icon still succeeds if its optional history counter cannot be recorded.
    }
    closeIconMaterialPicker();
    toast({ title: "\u5df2\u4f7f\u7528\u73b0\u6709\u7d20\u6750", description: "\u5bfc\u822a\u56fe\u6807\u5df2\u5207\u6362\u4e3a\u6240\u9009\u7d20\u6750\u3002" });
  }, [closeIconMaterialPicker, iconPickerTarget, updateItem]);
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const result = reorderNavigationSiblings(items, String(active.id), String(over.id));
    if (result.changed) onChange(result.items);
  };
  const openActionDialog = useCallback((config: {
    title: string;
    description: string;
    confirmLabel: string;
    busyLabel: string;
    onConfirm: () => Promise<void> | void;
  }) => {
    setActionDialog({
      open: true,
      title: config.title,
      description: config.description,
      confirmLabel: config.confirmLabel,
      busyLabel: config.busyLabel,
      onConfirm: config.onConfirm,
    });
  }, []);
  const closeActionDialog = useCallback(() => {
    setActionDialog((current) => ({ ...current, open: false, onConfirm: null }));
  }, []);
  const handleSaveNavigation = useCallback(() => {
    openActionDialog({
      title: "保存并同步导航栏自定义",
      description: "确定保存当前导航栏自定义并立即同步吗？系统会先执行保存，再保持最少 3 秒稳定读条。",
      confirmLabel: "确认保存",
      busyLabel: "保存同步中...",
      onConfirm: async () => {
        await onSave();
      },
    });
  }, [onSave, openActionDialog]);
  const handleTitleActionDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setTitleActionOrder((current) => {
      const oldIndex = current.indexOf(active.id as NavigationTitleActionId);
      const nextIndex = current.indexOf(over.id as NavigationTitleActionId);
      if (oldIndex === -1 || nextIndex === -1) return current;
      const next = arrayMove(current, oldIndex, nextIndex);
      window.localStorage.setItem(NAVIGATION_TITLE_ACTION_ORDER_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  function NavigationSortableRow({
    item,
    level,
    indexPath,
  }: {
    item: WebsiteNavigationItem;
    level: number;
    indexPath: number[];
  }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const sortCode = buildNavigationSortCode(indexPath);
    const levelLabel = getNavigationLevelName(level);
    const sortBadgeLabel = `${sortCode}栏`;
    const isCollapsed = collapsedIds.includes(item.id);
    const hasChildren = Boolean(item.children?.length);
    const nextLevelLabel = level < 4 ? `+${getNavigationLevelName(level + 1)}` : null;
    const rowTypographyClassName =
      level === 0
        ? "text-[14px] font-semibold"
        : "text-[14px] font-normal";
    const detailInputClassName =
      `adaptive-work-matrix-input h-8 min-w-0 border-0 px-2 text-left ${rowTypographyClassName} text-current shadow-none outline-none placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0`;
    const iconButtonClassName = `nav-action-icon ${rowTypographyClassName} text-current shadow-none`;
    const renderedChildren =
      hasChildren && !isCollapsed ? (
        <div className="navigation-card-children">
          <NavigationGroup items={item.children || []} level={level + 1} parentPath={indexPath} />
        </div>
      ) : null;

    return (
      <div
        ref={setNodeRef}
        id={`nav-row-${item.id}`}
        data-development-standard-frame-region={level === 0 ? "large-card" : "small-card"}
        data-development-standard-frame-label={level === 0 ? "大卡片" : "小卡片"}
        data-page-card-size={level === 0 ? "large" : "small"}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          ...(level === 0 ? navigationRootCardStyle : {}),
        }}
        className={level === 0 ? `nav-3d-card rounded-xl border px-2 py-2 ${isDragging ? "opacity-85" : ""}` : `nav-level-secondary ${isDragging ? "opacity-85" : ""}`}
      >
        {level === 0 ? (
          <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-1.5 px-1 text-[12px] font-semibold leading-5 opacity-80">
            <span className="shrink-0">一级归属</span>
            <span className="shrink-0">{sortBadgeLabel}</span>
            <span className="min-w-0 truncate">{item.label?.trim() || "未命名一级"}</span>
          </div>
        ) : null}
        <div className="navigation-card-content">
            <div className={`adaptive-work-matrix-row ${isDragging ? "opacity-85" : ""}`} style={NAVIGATION_MATRIX_COLUMN_VARS}>
            <div className="adaptive-work-matrix-function tradepro-list-operation-panel">
              <div className="adaptive-work-matrix-function-grid">
                <div className="adaptive-work-matrix-operation-grid tradepro-list-actions">
                  <ContentPluginDragHandle {...attributes} {...listeners} className="tradepro-list-action" />
                  <ContentPluginMoveButtons
                    className="tradepro-list-action"
                    onMoveUp={() => moveItem(item.id, -1)}
                    onMoveDown={() => moveItem(item.id, 1)}
                  />
                  <ContentPluginToggle
                    label="导航栏目"
                    checked={item.visible}
                    onCheckedChange={(checked) => updateItem(item.id, (current) => ({ ...current, visible: checked }))}
                    className="tradepro-list-action"
                  />
                  <div className="tradepro-list-action min-w-0">
                    <NavigationIconPicker
                      compact
                      value={item.iconName || "Navigation"}
                      customIconUrl={item.customIconUrl}
                      popoverStyle={panelStyle}
                      popoverPanelStyle={rowStyle}
                      onOpenMaterialPicker={() => openIconMaterialPicker(item.id)}
                      onChange={(iconName) =>
                        updateItem(item.id, (current) => ({
                          ...current,
                          iconName,
                          customIconUrl: undefined,
                          customIconAssetId: undefined,
                        }))
                      }
                    />
                  </div>
                  <ContentPluginActionButton control="delete" className="tradepro-list-action nav-delete-button adaptive-work-matrix-danger shrink-0" onClick={() => removeItem(item.id)}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">删除</span>
                  </ContentPluginActionButton>
                </div>

                <div className={`adaptive-work-matrix-sort-cell tradepro-list-pills ${rowTypographyClassName}`} title={sortBadgeLabel}>
                  <span className="adaptive-work-matrix-pill" style={rowStyle}>{levelLabel}</span>
                  <span className="adaptive-work-matrix-pill" style={rowStyle}>{sortBadgeLabel}</span>
                  {nextLevelLabel ? (
                    <button
                      type="button"
                      className="adaptive-work-matrix-pill"
                      style={rowStyle}
                      onClick={() => addChild(item.id, level)}
                      title={`新增${getNavigationLevelName(level + 1)}`}
                    >
                      {nextLevelLabel}
                    </button>
                  ) : null}
                  {hasChildren ? (
                    <button
                      type="button"
                      className="adaptive-work-matrix-pill px-1.5"
                      style={rowStyle}
                      onClick={() => toggleCollapsed(item.id)}
                      title={isCollapsed ? "展开子级" : "收起子级"}
                    >
                      {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            <div
              className="adaptive-work-matrix-edit tradepro-list-edit-panel"
              style={{
                marginLeft: level > 0 ? `${Math.min(level * 8, 24)}px` : undefined,
              }}
            >
              <div
                className="min-w-0 h-full w-full"
                style={{ minHeight: NAVIGATION_MATRIX_PILL_HEIGHT }}
              >
                <div className="nav-detail-grid grid min-w-0 items-stretch gap-1">
                  <div className="h-8 w-full p-0">
                    <Input
                      data-nav-name="true"
                      data-nav-item-id={item.id}
                      data-nav-field="label"
                      value={item.label}
                      onFocus={(event) => rememberNavigationInput(item.id, "label", event.currentTarget)}
                      onChange={(event) => {
                        rememberNavigationInput(item.id, "label", event.currentTarget);
                        updateItem(item.id, (current) => ({
                          ...current,
                          label: event.target.value,
                          labels: { ...(current.labels || {}), zh: event.target.value },
                        }));
                      }}
                      placeholder="名称"
                      className={detailInputClassName}
                    />
                  </div>

                  <div className="h-8 w-full p-0">
                    <Input
                      data-nav-item-id={item.id}
                      data-nav-field="label-en"
                      value={item.labels?.en || ""}
                      onFocus={(event) => rememberNavigationInput(item.id, "label-en", event.currentTarget)}
                      onChange={(event) => {
                        rememberNavigationInput(item.id, "label-en", event.currentTarget);
                        updateItem(item.id, (current) => ({
                          ...current,
                          labels: { ...(current.labels || {}), zh: current.labels?.zh || current.label, en: event.target.value },
                        }));
                      }}
                      placeholder="English"
                      className={detailInputClassName}
                    />
                  </div>

                  <div className="h-8 w-full p-0">
                    <Input
                      data-nav-item-id={item.id}
                      data-nav-field="sectionKey"
                      value={item.sectionKey || ""}
                      onFocus={(event) => rememberNavigationInput(item.id, "sectionKey", event.currentTarget)}
                      onChange={(event) => {
                        rememberNavigationInput(item.id, "sectionKey", event.currentTarget);
                        updateItem(item.id, (current) => {
                          const nextKey = normalizeNavigationToken(event.target.value);
                          const currentKey = normalizeNavigationToken(current.sectionKey || "");
                          const currentHref = (current.href || "").trim();
                          const shouldSyncHref = !currentHref || currentHref === `/${currentKey}` || currentHref === `#${currentKey}`;
                          return {
                            ...current,
                            sectionKey: nextKey,
                            href: shouldSyncHref ? `/${nextKey || "section"}` : current.href,
                          };
                        })
                      }}
                      placeholder="hero"
                      className={detailInputClassName}
                    />
                  </div>

                  <div className="h-8 w-full p-0">
                    <Input
                      data-nav-item-id={item.id}
                      data-nav-field="href"
                      value={item.href}
                      onFocus={(event) => rememberNavigationInput(item.id, "href", event.currentTarget)}
                      onChange={(event) => {
                        rememberNavigationInput(item.id, "href", event.currentTarget);
                        updateItem(item.id, (current) => ({ ...current, href: event.target.value }));
                      }}
                      placeholder="/hero"
                      className={detailInputClassName}
                    />
                  </div>
                </div>
              </div>
            </div>
            </div>
            {level === 0 ? renderedChildren : null}

          {level !== 0 ? renderedChildren : null}
        </div>
      </div>
    );
  }

  function NavigationGroup({
    items: groupItems,
    level,
    parentPath,
  }: {
    items: WebsiteNavigationItem[];
    level: number;
    parentPath: number[];
  }) {
    return (
      <SortableContext items={groupItems.map((entry) => entry.id)} strategy={rectSortingStrategy}>
        <div className={level === 0 ? "navigation-root-list" : "navigation-group-list"}>
          {groupItems.map((item, index) => (
            <NavigationSortableRow key={item.id} item={item} level={level} indexPath={[...parentPath, index + 1]} />
          ))}
        </div>
      </SortableContext>
    );
  }

  function NavigationTitleSortableAction({ id }: { id: NavigationTitleActionId }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const action = {
      add: {
        label: "增加新一级",
        onClick: addRoot,
        icon: Plus,
      },
      save: {
        label: "保存设置",
        onClick: handleSaveNavigation,
      },
    }[id];
    const ActionIcon = action.icon;
    return (
      <button
        ref={setNodeRef}
        type="button"
        className={`${primaryActionClassName} nav-title-sortable-action ${isDragging ? "is-dragging" : ""}`}
        data-shared-title-save-action={id === "save" ? "true" : undefined}
        style={{ ...primaryActionStyle, transform: CSS.Transform.toString(transform), transition }}
        onClick={action.onClick}
        title="拖拉移动按键顺序"
        {...attributes}
        {...listeners}
      >
        {ActionIcon ? <ActionIcon className="mr-1 h-3.5 w-3.5" /> : null}
        {action.label}
      </button>
    );
  }

  return (
    <>
      <div
        className="navigation-customization-panel flex min-h-0 flex-1 flex-col overflow-hidden p-0 text-slate-900 transition-colors duration-500"
        data-company-info-navigation-workspace
        data-development-standard-frame-region="table-shell"
        data-development-standard-frame-label="表内"
        data-navigation-layout-locked={navigationLayoutLocked ? "true" : "false"}
        style={panelStyle}
      >
        <div
          data-page-title
          data-page-factory-region="title-2"
          data-shared-layout-section="title"
          data-development-standard-frame-region="title"
          data-development-standard-frame-label="标题"
          className="nav-3d-header flex min-h-[76px] shrink-0 flex-wrap items-center justify-between gap-3 rounded-t-[23px] px-4 py-4 sm:px-5"
          style={headerSurfaceStyle}
        >
          <button
            type="button"
            className="nav-mobile-disclosure"
            onClick={() => setMobileHeaderExpanded((current) => !current)}
            aria-expanded={mobileHeaderExpanded}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <PageIcon className="h-5 w-5 shrink-0" />
              <span className="truncate">{pageTitle}</span>
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${mobileHeaderExpanded ? "rotate-180" : ""}`} />
          </button>
          <div className={`nav-mobile-header-content ${mobileHeaderExpanded ? "is-expanded" : ""}`}>
          <div className="min-w-0">
            <div data-shared-title-heading className="flex min-w-0 items-center gap-2.5 text-[20px] font-semibold leading-tight">
               <PageIcon className="h-[22px] w-[22px] shrink-0" />
               <span>{pageTitle}</span>
            </div>
            <div data-shared-title-description className="mt-2.5 text-[12px] leading-5 opacity-80">
              {description}
            </div>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTitleActionDragEnd}>
            <SortableContext items={titleActionOrder} strategy={horizontalListSortingStrategy}>
              <div className="nav-title-action-sortable-list flex min-w-0 self-stretch flex-wrap items-center justify-end gap-2">
                {titleActionOrder.map((id) => <NavigationTitleSortableAction key={id} id={id} />)}
              </div>
            </SortableContext>
          </DndContext>
          </div>
        </div>
        <div className="mx-3 mt-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs" style={rowStyle} data-website-navigation-templates>
          <span className="font-semibold">导航模板：</span>
          {WEBSITE_NAVIGATION_TEMPLATES.map((template) => (
            <Button
              key={template.id}
              type="button"
              size="sm"
              variant="outline"
              title={`${template.description}。套用后仍可在下方逐项修改，保存后才会同步。`}
              onClick={() => onApplyTemplate(template.id)}
            >
              {template.label}
            </Button>
          ))}
          <span className="opacity-75">“素材本地”保留为后台素材来源，不作为访客导航。</span>
        </div>
        <div
          data-page-table-header
          data-shared-layout-section="tableHeader"
          data-development-standard-frame-region="table-header"
          data-development-standard-frame-label="表头"
          className="nav-3d-subnav-frame nav-table-header adaptive-work-matrix-frame mx-3 mt-3 mb-0"
          style={subnavSurfaceStyle}
        >
          <button
            type="button"
            className="nav-mobile-disclosure nav-mobile-table-disclosure"
            onClick={() => setMobileTableHeaderExpanded((current) => !current)}
            aria-expanded={mobileTableHeaderExpanded}
          >
            <span>导航字段</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${mobileTableHeaderExpanded ? "rotate-180" : ""}`} />
          </button>
          <div className={`nav-table-header-content ${mobileTableHeaderExpanded ? "is-expanded" : ""}`}>
          <div className="adaptive-work-matrix-function" style={NAVIGATION_MATRIX_COLUMN_VARS}>
            <div className="adaptive-work-matrix-function-grid">
              <div className="min-w-0">
                <div className="adaptive-work-matrix-section-title">功能设置</div>
                <div className="adaptive-work-matrix-subhead">站点导航设置</div>
              </div>
              <div className="min-w-0">
                <div className="adaptive-work-matrix-section-title">排序控制</div>
                <div className="adaptive-work-matrix-subhead">排号</div>
              </div>
            </div>
          </div>
          <div className="adaptive-work-matrix-edit">
            <div className="w-full min-w-0">
              <div className="adaptive-work-matrix-section-title">编制内容</div>
              <div className="nav-detail-grid grid min-w-0 items-center gap-1">
              <div>中文名称</div>
              <div>English</div>
              <div>栏目键</div>
              <div>链接</div>
            </div>
            </div>
          </div>
          </div>
        </div>
        <div
          data-page-list-scroll-owner
          data-page-list
          data-shared-layout-section="list"
          data-development-standard-frame-region="content"
          data-development-standard-frame-label="内容"
          className="nav-matrix-body min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pt-3 pb-0"
        >
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            {items.length ? (
              <NavigationGroup items={items} level={0} parentPath={[]} />
            ) : (
              <div className="min-w-0 border border-dashed px-4 py-8 text-center text-sm" style={rowStyle}>
                还没有导航项，点击下方“增加新一级”开始配置。
              </div>
            )}
          </DndContext>
          <div className="navigation-add-root-row flex justify-start">
            <button
              type="button"
              className={primaryActionClassName}
              style={primaryActionStyle}
              onClick={addRoot}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              增加新一级
            </button>
          </div>
        </div>
      </div>
      <Dialog open={iconMaterialDialogOpen} onOpenChange={(open) => { if (!open) closeIconMaterialPicker(); }}>
        {iconMaterialDialogOpen ? (
          <DialogContent
            className="max-w-5xl border p-0"
            style={{
              borderColor: panelStyle.borderColor as string,
              backgroundColor: panelStyle.backgroundColor as string,
            }}
          >
            <input
              ref={materialAssetsUploadRef}
              type="file"
              accept={getMediaUploadAccept(["image"])}
              className="hidden"
              onChange={handleMaterialAssetUpload}
            />
            <DialogHeader
              className="space-y-1 border-b px-5 py-4"
              style={{
                backgroundColor: layoutStyle.defaultDialogHeaderBgColor || layoutStyle.headerBgColor || "#0f172a",
                color: layoutStyle.defaultDialogHeaderTextColor || "#ffffff",
                borderColor: withAlpha(sidebarStyle.borderColor || "#94a3b8", 0.34),
              }}
            >
              <DialogTitle className="text-sm font-semibold">选择导航图标素材</DialogTitle>
              <DialogDescription
                className="text-xs leading-5"
                style={{ color: withAlpha(layoutStyle.defaultDialogHeaderTextColor || "#ffffff", 0.82) }}
              >
                可直接上传，或从本地私有素材库复用导航图标；实际路径见素材条目或“源码与部署中心”。
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-5 py-4" style={rowStyle}>
              <div className="flex flex-wrap gap-2">
                <Button type="button" className="h-9" onClick={() => materialAssetsUploadRef.current?.click()}>
                  <Upload className="mr-1.5 h-4 w-4" />
                  {materialAssetsUploading ? "上传中..." : "本地上传"}
                </Button>
                <Button type="button" variant="outline" className="h-9" onClick={() => void loadMaterialAssets()} disabled={materialAssetsLoading}>
                  刷新素材
                </Button>
              </div>

              {materialAssetsLoading ? (
                <div className="rounded-xl border px-4 py-10 text-center text-sm" style={rowStyle}>
                  正在读取素材资源...
                </div>
              ) : imageMaterialAssets.length === 0 ? (
                <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm" style={rowStyle}>
                  暂无图片素材，请先本地上传自定义图标。
                </div>
              ) : (
                <ScrollArea className="h-[56vh] pr-2">
                  <div className="grid gap-3 md:grid-cols-2">
                    {imageMaterialAssets.map((asset) => (
                      <div key={asset.assetId} className="rounded-2xl border p-3" style={panelStyle}>
                        <div className="flex gap-3">
                          <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border" style={rowStyle}>
                            <img src={asset.publicUrl} alt={asset.fileName} className="h-full w-full object-cover" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-sm font-semibold">{asset.fileName || "未命名素材"}</div>
                              <Badge variant="outline">图片</Badge>
                              <Badge variant="outline" title={`当前有 ${asset.usageCount} 处配置正在使用`}>应用{asset.applyCount}次</Badge>
                            </div>
                            <div className="mt-2 space-y-1 text-xs opacity-80">
                              <div>大小：{formatMaterialAssetSize(asset.sizeBytes)}</div>
                              <div>时间：{formatMaterialAssetTime(asset.createdAt)}</div>
                              <div className="truncate">路径：{asset.storagePath}</div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button type="button" className="h-8" onClick={() => handleApplyExistingIconMaterialAsset(asset)}>
                            使用现有素材
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8"
                            onClick={() => {
                              void copyTextWithFallback(asset.assetId);
                              toast({ title: "\u7d20\u6750 ID \u5df2\u590d\u5236" });
                            }}
                          >
                            复制 ID
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      <div
        className="nav-tailbar-wrap fixed bottom-0 right-0 z-40 transition-[left] duration-300 ease-out"
        style={{ left: "var(--app-sidebar-visible-width, 15rem)" }}
      >
        <div
          className="nav-tailbar flex h-12 items-center justify-between gap-3 border-t px-3"
          style={footerSurfaceStyle}
          data-nav-tailbar
        >
          <div className="nav-tailbar-lock-slot flex items-center">
            <button
              type="button"
              className={`${primaryActionClassName} nav-tailbar-layout-lock`}
              style={primaryActionStyle}
              onClick={navigationLayoutLocked ? undefined : lockNavigationLayout}
              disabled={navigationLayoutLocked}
              data-nav-layout-lock
              data-layout-lock-control
              data-state={navigationLayoutLocked ? "locked" : "unlocked"}
              title={navigationLayoutLocked ? "请在“开发规范”登记新的页面方案后再发布" : "点击锁定，避免框架样式被覆盖。"}
            >
              {navigationLayoutLocked ? <Lock className="mr-1 h-3.5 w-3.5" /> : <Unlock className="mr-1 h-3.5 w-3.5" />}
              {navigationLayoutLocked ? "版面已锁定" : "版面已解锁"}
            </button>
          </div>
          <div className="nav-tailbar-actions flex items-center gap-3">
            <button type="button" className={primaryActionClassName} style={primaryActionStyle} onClick={handleSaveNavigation}>
              保存并同步
            </button>
          </div>
        </div>
      </div>
      <UnifiedActionDialog
        open={actionDialog.open}
        title={actionDialog.title}
        description={actionDialog.description}
        confirmLabel={actionDialog.confirmLabel}
        busyLabel={actionDialog.busyLabel}
        onOpenChange={(open) => {
          if (!open) closeActionDialog();
        }}
        onConfirm={actionDialog.onConfirm}
        minimumBusyMs={3000}
      />
    </>
  );
}

export default function CompanyInfo() {
  const location = useLocation();
  const [params] = useSearchParams();
  const deferredPanelsReady = usePostPaintReady(700);
  const builderScope = getAIBuilderScope(location.pathname);
  const { layoutStyle, sidebarStyle, globalFontFamily, globalFontWeight, globalLetterSpacing, products, customProducts, productOrder } = useProductMarketStore();
  const siteId = params.get("siteId");
  const contentScopeId = useMemo(() => `${builderScope}:${siteId || "company-info-draft"}`, [builderScope, siteId]);
  const [state, setState] = useState<WebsiteContentState>(() => getWebsiteContentState(contentScopeId));

  useEffect(() => {
    setState(getWebsiteContentState(contentScopeId));
  }, [contentScopeId]);

  const rawTab = (params.get("tab") || "navigation") as TabKey;
  const activeTab = TABS.some((item) => item.key === rawTab) ? rawTab : "navigation";
  const currentNavigationMeta = useMemo(
    () => resolveCompanyInfoTitles(activeTab, products, customProducts, productOrder),
    [activeTab, customProducts, productOrder, products]
  );
  // Navigation Customization has one shared title description.  Do not read
  // a legacy product-tree description here, otherwise old project data can
  // overwrite the compact heading copy after a page reload.
  const navigationDescription = NAVIGATION_DESCRIPTION;
  const contentTextStyle = useMemo(
    () => ({
      color:
        layoutStyle.contentTextColor ||
        sidebarStyle.textColor ||
        layoutStyle.themePanelTextColor ||
        "#0f172a",
      fontFamily: globalFontFamily || sidebarStyle.fontFamily || "system-ui, sans-serif",
      fontWeight: globalFontWeight || sidebarStyle.fontWeight || "400",
      letterSpacing: globalLetterSpacing || sidebarStyle.letterSpacing || "0.02em",
    }),
    [
      globalFontFamily,
      globalFontWeight,
      globalLetterSpacing,
      layoutStyle.contentTextColor,
      layoutStyle.themePanelTextColor,
      sidebarStyle.textColor,
      sidebarStyle.fontFamily,
      sidebarStyle.fontWeight,
      sidebarStyle.letterSpacing,
    ]
  );

  const updateState = (updater: (draft: WebsiteContentState) => void) => {
    setState((prev) => {
      const draft = structuredClone(prev);
      updater(draft);
      return draft;
    });
  };

  // Navigation edits occur on every keystroke. Preserve untouched state
  // branches so the editor avoids cloning the full website content tree.
  const updateNavigationItems = useCallback((items: WebsiteNavigationItem[]) => {
    setState((previous) => ({
      ...previous,
      navigation: {
        ...previous.navigation,
        items,
      },
    }));
  }, []);

  const applyNavigationTemplate = useCallback((templateId: WebsiteNavigationTemplateId) => {
    const template = WEBSITE_NAVIGATION_TEMPLATES.find((entry) => entry.id === templateId);
    if (!template) return;
    setState((previous) => ({
      ...previous,
      navigation: {
        ...previous.navigation,
        items: createWebsiteNavigationTemplate(templateId),
      },
    }));
    toast({ title: `已套用${template.label}导航模板`, description: "当前为草稿，请检查栏目与链接后点击“保存并同步”。" });
  }, []);

  const handleSave = useCallback(
    () => persistWebsiteContent(state, contentScopeId, builderScope, siteId),
    [builderScope, contentScopeId, siteId, state]
  );

  useEffect(() => {
    const handleSharedProjectSync = (event: Event) => {
      const detail = (event as CustomEvent<SharedProjectSyncRequestDetail>).detail;
      if (activeTab === "navigation") return;
      if (detail?.pathname !== location.pathname || detail.search !== location.search) return;
      const completion = Promise.resolve(handleSave()).then(() => true);
      if (detail.respondWith) detail.respondWith(completion);
      else void completion;
    };

    window.addEventListener(SHARED_PROJECT_SYNC_REQUEST_EVENT, handleSharedProjectSync);
    return () => window.removeEventListener(SHARED_PROJECT_SYNC_REQUEST_EVENT, handleSharedProjectSync);
  }, [activeTab, handleSave, location.pathname, location.search]);

  const renderPanel = () => {
    if (activeTab === "navigation") {
      return (
        <div data-company-info-navigation-content className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
          <NavigationMatrixEditorV2
            items={state.navigation.items}
            onChange={updateNavigationItems}
            onApplyTemplate={applyNavigationTemplate}
            onSave={handleSave}
            description={navigationDescription}
            pageTitle={`${currentNavigationMeta.primaryLabel} → ${currentNavigationMeta.secondaryLabel}`}
            PageIcon={currentNavigationMeta.primaryIcon}
          />
          <HomepageDesignGovernance compositionManifest={{ navigation: state.navigation, banner: state.banner, recommend: state.recommend }} />
        </div>
      );
    }

    if (!deferredPanelsReady) {
      return <DeferredCompanyInfoPanelsPlaceholder />;
    }

    return (
      <Suspense fallback={<DeferredCompanyInfoPanelsPlaceholder />}>
        <DeferredCompanyInfoPanels
          activeTab={activeTab as DeferredTabKey as DeferredCompanyInfoTabKey}
          currentNavigationMeta={currentNavigationMeta}
          state={state}
          onSave={handleSave}
          updateState={updateState}
        />
      </Suspense>
    );
  };

  const usesSharedCompanyWorkspace = activeTab === "navigation" || activeTab === "banner" || activeTab === "recommend" || activeTab === "modules";

  return (
    <FactoryPage pageId="client-company-info" template="editor" sourceScope="client_source" autoRegions>
    <div
      data-page-layout-surface
      data-company-info-tab={activeTab}
      data-company-info-shared-workspace={usesSharedCompanyWorkspace ? "true" : undefined}
      className={usesSharedCompanyWorkspace ? "flex min-h-0 flex-1 flex-col" : "space-y-3"}
      style={contentTextStyle}
    >
      {renderPanel()}
    </div>
    </FactoryPage>
  );
}
