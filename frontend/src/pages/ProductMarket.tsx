import { useState, useMemo, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { lazy, Suspense } from "react";
import { forwardRef } from "react";

import type { CSSProperties, ReactNode } from "react";

import "@/shared-layout-section-editor-capacity.css";

import { toast } from "sonner";

import { useProductMarketStore, CustomerServiceAvatarOverride, ProductStatus, ProductCustomStyle, LayoutCustomStyle, LayoutSectionConfig, CustomerServiceSectionConfig, SidebarStyle, CustomThemeData, ICON_OPTIONS, BUILTIN_THEME_PRESETS, ThemePresetKey, ExportableConfig, ProductItem, getDefaultSidebarStyle, getDefaultProductModuleSecondaryIconName, getFactoryBuiltinThemes, getProductMarketCatalogDefaultPaths, getProductMarketCatalogProducts, ALL_PRODUCTS, PRODUCT_MODULE_CATEGORIES, PRODUCT_MODULE_BASELINE_PATHS, PRODUCT_MODULE_BASELINE_VERSION, SOURCE_WORKSPACE_GROUPS, getProductModuleCategoryByPath, getProductModuleCategoryMarketingGuide, isRetiredFactoryPlatformPrimaryPath, isLegacyFactoryPlatformDefaultLabel, isFactoryPlatformGraduatedPilotPath, DEFAULT_LAYOUT_SECTIONS, DEFAULT_CUSTOMER_SERVICE_SECTIONS, DEFAULT_DESIGN_FONT_STACK, DEFAULT_DESIGN_FONT_WEIGHT, DEFAULT_DESIGN_LETTER_SPACING, CUSTOMER_SERVICE_EXPERT_SEQUENCE_CONTRACT_VERSION, resolveCustomerServiceExpertSequenceMatch, resolveReminderSoundAssetFields, resolveVoicePresetAssetFields, resolveVoicePresetAssetFromOverrides, normalizeSidebarStyle, normalizeProductModuleCategoryOrder, normalizeSourceWorkspaceCategoryOrder, buildProductModuleCategoryDisplayOrderMap, buildSourceWorkspaceCategoryDisplayOrderMap, formatProductModuleCategoryLabel, getCustomerServiceCategoryExperts, CUSTOMER_SERVICE_BUILTIN_AVATARS, CUSTOMER_SERVICE_ANIMATION_OPTIONS, getCustomerServiceAnimationClass } from "@/lib/product-market-store";

import { createProductMarketVersion } from "@/lib/product-market-version";
import {
  PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT,
  projectProductMarketCategoryGroups,
  resolveProductMarketCategoryStatus,
} from "@/lib/product-market-category-contract";
import {
  buildSharedCategoryOwnershipKey,
  buildSharedModuleOwnershipKey,
  useSharedOwnershipHighlightRuntime,
} from "@/lib/shared-ownership-highlight-runtime";

import { playClickSound, playClickSoundWithConfig, SOUND_STYLE_PRESETS } from "@/lib/click-sound";

import { CUSTOMER_SERVICE_REMINDER_SOUND_PRESETS, getCustomerServiceReminderPreset } from "@/lib/customer-service-reminder-sound";

import { invalidateCustomerServiceMedia, isCustomerServiceVideoMimeType, readCustomerServiceMedia, readCustomerServiceMediaPreview, resolveCustomerServiceLocalMaterialReference, saveCustomerServiceMedia, type CustomerServiceLocalMaterialReference } from "@/lib/customer-service-media";

import { CUSTOMER_SERVICE_VOICE_PRESETS, DEFAULT_CUSTOMER_SERVICE_VOICE_RATE, getCustomerServiceVoicePreset } from "@/lib/customer-service-voice";

import { CUSTOMER_SERVICE_EXPERT_AUDIO_ROSTER } from "@/lib/customer-service-audio-roster";

import { Button } from "@/components/ui/button";
import { PageFooterLockControls } from "@/components/PageFooterLockControls";

import { SharedPageWorkspace, type SharedPageWorkspaceProps } from "@/components/SharedPageWorkspace";

import { Badge } from "@/components/ui/badge";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { ScrollArea } from "@/components/ui/scroll-area";

import { Dialog, DraggableDialogContent, DialogTitle } from "@/components/ui/dialog";

import { DeferredUnifiedActionDialog } from "@/components/DeferredShellUtilities";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { Checkbox } from "@/components/ui/checkbox";

import { Slider } from "@/components/ui/slider";

import { Check, X, Eye, EyeOff, RotateCcw, ShoppingBag, CheckSquare, Square, ListChecks, Palette, LayoutPanelTop, Upload, ImageIcon, GripVertical, Sun, Moon, Waves, Plus, Volume2, VolumeX, Package, UserCircle, MessageCircle, Trash, ChevronDown, ChevronUp, Play, Mic2, Headphones, TreePine, Radio, RefreshCw, FolderPlus, Save } from "lucide-react";

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay } from "@dnd-kit/core";

import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import { sanitizeDisplayText } from "@/lib/text-sanitizer";

import { resolveSiteDisplayName } from "@/lib/site-display-name";

import { buildSharedStyleStorageKey, cloneAvatarOverrides, cloneCustomerServiceSections, cloneCustomProducts, cloneLayoutSections, cloneSharedProducts, cloneThemeMap, cloneThemes, detectCustomerServiceCustomizationAgainstShared, detectLayoutCustomizationAgainstShared, detectLayoutStructureCustomizationAgainstShared, PRODUCT_MARKET_SHARED_STYLE_EVENT, readSharedStyleSettings, writeSharedStyleSettings, writeSharedVisualContractSettings } from "@/lib/product-market-shared-style";

import { CLIENT_SOURCE_CONTENT_PROGRAMS, currentProductMarketConfigKey, defaultProductMarketConfigKey, normalizeClientSourceContentContract, normalizeProductMarketConfigForStorage, productMarketConfigSignature, readAgencyTemplateProductMarketConfig, readClientTemplateProductMarketConfig, readHeadquartersProductMarketConfig, readStoredProductMarketConfig, relevantProductMarketStorageKeys, writeStoredProductMarketConfig } from "@/lib/product-market-config";

import {
  createTemplateReleaseBatch,
  fetchProductMarketFactoryDefault,
  fetchInstance,
  fetchTemplate,
  fetchTemplateReleaseBatch,
  listTemplateVersions,
  publishTemplate,
  promoteProductMarketFactoryDefault,
  resumeTemplateReleaseBatch,
  restoreTemplate,
  retryTemplateReleaseBatch,
  syncLatest,
  TemplateSnapshotRequestError,
  upsertInstance,
  upsertTemplate,
  type TemplateReleaseBatchResponse,
} from "@/lib/template-snapshot";
import {
  assertClientPlanRuntimeInstanceBinding,
  resolveClientPlanRuntimeInstanceIdentity,
  resolveLegacyClientPlanRuntimeInstanceIdentity,
  type ClientPlanRuntimeIdentity,
} from "@/lib/template-snapshot/client-plan-runtime-identity";
import {
  PRODUCT_MARKET_TEMPLATE_LIFECYCLE_CONTRACT_VERSION,
  PRODUCT_MARKET_VERIFIED_DRAFT_BASELINE_CONTRACT,
  getProductMarketRestoreCopy,
  resolveProductMarketLifecycleRole,
  summarizeProductMarketConfigChanges,
  type ProductMarketRestoreTarget,
} from "@/lib/product-market-template-lifecycle-contract";
import { SHARED_PROJECT_SYNC_REQUEST_EVENT, type SharedProjectSyncRequestDetail } from "@/lib/shared-project-sync-contract";
import { SHARED_SMALL_CARD_MARKER_POLICY } from "@/lib/shared-window-contract";

import { applyProductMarketTheme, resolveRotatedPlanDefaultsForSite } from "@/lib/product-market-theme-rotation";

import { fetchAllSitesFromBackend, getSiteById, getSiteSequenceMap, getVisibleSitesByScope, resolveCurrentSiteId } from "@/lib/sites";

import { deleteMaterialAsset, listMaterialAssets, recordMaterialAssetApply, replaceMaterialAsset, type MaterialAssetKind, type MaterialAssetItem as StoredMaterialAssetItem, syncMaterialAssetUsage, uploadMaterialAsset } from "@/lib/material-assets";
import { getMediaUploadAccept, MEDIA_OPTIMIZATION_CONTRACT } from "@/lib/media-optimization-contract";
import {
  CUSTOMER_SERVICE_RESERVED_AVATAR_SEQUENCE_END,
  orderUploadedAvatarMaterialsNewestFirst,
  resolveStoredAvatarMaterialSequence,
} from "@/lib/customer-service-avatar-material-order";
import {
  CUSTOMER_SERVICE_NEW_VOICE_SEQUENCE_START,
  orderCustomerServiceVoiceLibrary,
  resolveStoredVoiceMaterialSequence,
} from "@/lib/customer-service-voice-material-order";
import { compareNewestLargeSequenceFirst } from "@/lib/newest-large-sequence-order-contract";

import { copyTextWithFallback } from "@/lib/browser-utils";

import { hasPendingSiteSwitchLoading, startSiteSwitchLoading } from "@/lib/site-switch-loading";

import { isCompletedLayoutLocked, isCompletedSourceLocked, isRouteCompletedPageHardLocked, PAGE_LAYOUT_LOCK_EVENT, resolveCompletedLayoutLock, setCompletedLayoutLocked, setCompletedPageHardLocked, setCompletedSourceLocked, type CompletedLayoutLock } from "@/lib/page-layout-lock";
import { syncSourcePageLock } from "@/lib/source-page-lock";
import {
  GLOBAL_THEME_TOKEN_NAMES,
  LEFT_SELECTED_TEXT_FALLBACK,
  RIGHT_SELECTED_TEXT_FALLBACK,
  normalizeRightSelectedTextPreference,
  resolveGlobalThemeTokens,
} from "@/lib/global-theme-tokens";
import { isProductMarketSubview, resolveProductMarketNavTab } from "@/lib/product-market-navigation";
import {
  decodeModuleCategorySortId,
  encodeModuleCategorySortId,
  type EditableModuleChild,
  type EditableModuleItem,
} from "@/lib/product-market-modules-editor-contract";
import {
  VERTICAL_CONTEXT_CAPSULE_CONTRACT,
  getLayoutFrameMarkerLabel,
} from "@/lib/layout-frame-contract";
import {
  getBestContrastingTextColor as getReadableTextColor,
  parseColorToRgb,
  resolveAccessibleTextColor as resolveReadableTextColor,
} from "@/lib/color-contrast";
import {
  PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP,
  PRODUCT_MARKET_THEME_PALETTES,
} from "@/lib/product-market-theme-palettes";
import { getAIBuilderScope } from "@/lib/ai-builder-route-scope";
import type { FactoryPlatformCategoryKey } from "@/lib/factory-platform-blueprint";
import {
  VISUAL_CARD_DIRECT_APPLY_EVENT,
  buildVisualCardLayoutScopeKey,
  cloneVisualCardLayout,
  composeVisualCardLayout,
  createDefaultVisualCardLayout,
  mergeVisualCardLayoutForApplicationScope,
  readVisualCardPageOverride,
  resolveVisualCardWorkspaceScope,
  takeVisualCardLayoutDraftHandoff,
  writeVisualCardPageOverride,
  type VisualCardDirectApplyDetail,
  type VisualCardLayoutScope,
} from "@/lib/visual-card-layout-contract";
import type { VisualCardSharedStyleApplyPatch } from "@/lib/visual-card-shared-style-bridge";
import { recordPageCompositionAudit } from "@/lib/page-composition-audit";
import {
  clearDeveloperGlobalStyleVisualIntent,
  createDeveloperGlobalStyleCanaryAppearance,
  readDeveloperGlobalStyleVisualIntent,
  writeDeveloperGlobalStyleCanaryProfileDraft,
  writeDeveloperGlobalStyleVisualConfirmation,
} from "@/lib/developer-global-style-session";
import {
  bindMarketingPlaybookDeveloperMarkerProof,
  captureMarketingPlaybookDeveloperMarkerProof,
} from "@/lib/marketing-playbook-pilot-inspector";
import {
  VISUAL_PAGE_EDITOR_OPEN_EVENT,
  type VisualPageEditorInitialApplicationScope,
  type VisualPageEditorOpenDetail,
} from "@/lib/visual-page-editor-events";
import { FactoryPage } from "@/page-factory/FactoryPage";
import type { PageFactoryScope, PageFactoryTemplate } from "@/page-factory/page-factory";
import { ProductMarketCategoryIdentityIcon } from "@/components/product-market/ProductMarketCategoryIdentityIcon";
import { ContentPluginDragHandle, ContentPluginSortToolbar, ContentPluginStatusActions, ContentPluginToggle } from "@/components/content-plugins/ContentPluginControls";
import { ExpertIdentitySummary } from "@/components/customer-service/ExpertIdentitySummary";
import { CustomerServiceAvatarMedia } from "@/components/customer-service/CustomerServiceAvatarMedia";
import { resolveCustomerServiceExpertProfile } from "@/lib/customer-service-expert-contract";
import { buildCustomerServiceDefaultGreeting } from "@/lib/customer-service-default-greeting";
import { formatDisplayOrdinal } from "@/lib/display-number-contract";
import { loadLazyModule } from "@/lib/lazy-module-recovery";
import { usePostPaintReady } from "@/lib/post-paint-lazy";
import {
  loadProductMarketCustomerServiceSection,
  preloadProductMarketCustomerServiceSection,
} from "@/lib/product-market-customer-service-section-loader";
import type {
  AvatarMaterialGender,
  AvatarMaterialGenderFilter,
  AudioMaterialCategory,
  CustomerServiceMaterialPickerEntry as MaterialPickerEntry,
  CustomerServiceMaterialPickerTarget as MaterialPickerTarget,
} from "@/components/product-market/CustomerServiceMaterialPickerDialog";
import type { ProductMarketColorPickerProps } from "@/components/product-market/ProductMarketColorPicker";
import type {
  ProductMarketCustomerServiceSectionProps,
  ProductMarketCustomerServiceResponsiveMode as DefaultDialogResponsiveMode,
} from "@/components/product-market/ProductMarketCustomerServiceSection";

const VisualPageEditorDock = lazy(async () => ({
  default: (await import("@/components/product-market/VisualPageEditorDock")).VisualPageEditorDock,
}));

const VisualPageEditorTopbarLauncher = lazy(async () => ({
  default: (await import("@/components/product-market/VisualPageEditorLauncher")).VisualPageEditorTopbarLauncher,
}));

const CustomerServiceMaterialPickerDialog = lazy(async () => ({
  default: (await import("@/components/product-market/CustomerServiceMaterialPickerDialog")).CustomerServiceMaterialPickerDialog,
}));

const ProductMarketModulesPanel = lazy(async () => ({
  default: (await import("@/components/product-market/ProductMarketModulesPanel")).ProductMarketModulesPanel,
}));

const ProductMarketDevelopmentGuidePanel = lazy(async () => ({
  default: (await import("@/components/product-market/ProductMarketDevelopmentGuidePanel")).ProductMarketDevelopmentGuidePanel,
}));
const FactoryPlatformBlueprint = lazy(async () => ({
  default: (await import("@/components/product-market/FactoryPlatformBlueprint")).FactoryPlatformBlueprint,
}));

type ProductMarketColorPickerModule = typeof import("@/components/product-market/ProductMarketColorPicker");
let productMarketColorPickerPromise: Promise<ProductMarketColorPickerModule> | undefined;

function loadProductMarketColorPicker() {
  if (productMarketColorPickerPromise) return productMarketColorPickerPromise;
  const pending = loadLazyModule(
    () => import("@/components/product-market/ProductMarketColorPicker"),
    "product-market-color-picker",
  ).catch((error) => {
    productMarketColorPickerPromise = undefined;
    throw error;
  });
  productMarketColorPickerPromise = pending;
  return pending;
}

function preloadProductMarketColorPicker() {
  void loadProductMarketColorPicker().catch(() => undefined);
}

const LazyProductMarketColorPicker = lazy(async () => ({
  default: (await loadProductMarketColorPicker()).ProductMarketColorPicker,
}));

function ColorPicker(props: ProductMarketColorPickerProps) {
  return (
    <Suspense fallback={(
      <span
        data-product-market-color-picker-loader="loading"
        aria-label={`${props.label}颜色工具加载中`}
        className={`color-picker-trigger flex items-center rounded-md border border-slate-600 bg-slate-800/50 opacity-75 ${props.compact ? "gap-1 px-1.5 py-1" : "gap-2 px-2 py-1.5"}`}
        style={{
          color: props.textColor || props.value,
          ["--color-picker-value" as string]: props.surfaceColor || props.value,
          ["--color-picker-contrast" as string]: props.textColor || "#F8FAFC",
          ["--color-picker-text" as string]: props.textColor || props.value,
        }}
      >
        <span
          className={props.compact ? "h-4 w-4 rounded border border-slate-500" : "h-5 w-5 rounded border border-slate-500"}
          style={{ backgroundColor: props.value }}
        />
        <span className={`color-picker-label text-slate-300 ${props.compact ? "text-[10px]" : "text-xs"}`}>{props.label}</span>
      </span>
    )}>
      <LazyProductMarketColorPicker {...props} />
    </Suspense>
  );
}

if (
  typeof window !== "undefined"
  && window.location.pathname.replace(/\/+$/, "").toLowerCase().endsWith("/product-market")
  && new URLSearchParams(window.location.search).get("tab")?.toLowerCase() === "service"
) {
  preloadProductMarketCustomerServiceSection();
}

const LazyProductMarketCustomerServiceSection = lazy(async () => ({
  default: (await loadProductMarketCustomerServiceSection()).SortableCustomerServiceSection,
}));
const DeferredViewportMediaGroup = lazy(() => import("@/components/DeferredViewportMediaGroup"));

function SortableCustomerServiceSection(props: ProductMarketCustomerServiceSectionProps) {
  const fallbackMinHeight = props.section.id === "service-avatar-customize"
    ? 360
    : props.section.id === "service-reminder-sound"
      ? 220
      : 180;
  return (
    <Suspense fallback={(
      <div className="template-config-service-section" style={{ order: props.order }}>
        <Card
          data-page-list-item
          data-shared-large-card-surface="true"
          data-development-standard-frame-region="large-card"
          data-development-standard-frame-label="大卡片"
          className="template-config-service-card"
          data-responsive-structure-item="service-section"
          data-shared-sortable-card
          data-sortable-dragging="false"
          aria-busy="true"
        >
          <CardContent className="p-2.5 sm:p-3.5">
            <div
              data-product-market-customer-service-section-loader="loading"
              aria-label={`${props.section.title}加载中`}
              className="rounded-xl border border-dashed opacity-40"
              style={{ minHeight: fallbackMinHeight }}
            />
          </CardContent>
        </Card>
      </div>
    )}>
      <LazyProductMarketCustomerServiceSection {...props} />
    </Suspense>
  );
}

type ProductMarketThemeEditorDialogModule = typeof import("@/components/product-market/ProductMarketThemeEditorDialog");
let productMarketThemeEditorDialogPromise: Promise<ProductMarketThemeEditorDialogModule> | undefined;

function loadProductMarketThemeEditorDialog() {
  if (productMarketThemeEditorDialogPromise) return productMarketThemeEditorDialogPromise;
  const pending = import("@/components/product-market/ProductMarketThemeEditorDialog").catch((error) => {
    productMarketThemeEditorDialogPromise = undefined;
    throw error;
  });
  productMarketThemeEditorDialogPromise = pending;
  return pending;
}

function preloadProductMarketThemeEditorDialog() {
  preloadProductMarketColorPicker();
  void loadProductMarketThemeEditorDialog().catch(() => undefined);
}

const LazyProductMarketThemeEditorDialog = lazy(async () => ({
  default: (await loadProductMarketThemeEditorDialog()).ProductMarketThemeEditorDialog,
}));

function withAlpha(color?: string | null, alpha = 1) {
  const rgb = parseColorToRgb(color);
  if (!rgb) {
    return color || `rgba(15, 23, 42, ${alpha})`;
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

const DEFAULT_PRESET_THEME_COLORS = (() => {
  const builtinThemeMap = new Map(
    getFactoryBuiltinThemes().map((theme) => [theme.key, theme])
  );

  const createPresetThemeColors = (key: ThemePresetKey) => {
    const theme = builtinThemeMap.get(key);
    if (!theme) {
      throw new Error(`Missing built-in preset theme: ${key}`);
    }
    return {
      sidebar: { ...theme.sidebar },
      layout: { ...theme.layout },
      cards: {
        active: { ...theme.cardActive },
        inactive: { ...theme.cardInactive },
        hidden: { ...theme.cardHidden },
      },
    };
  };

  return {
    black: createPresetThemeColors("dark"),
    light: createPresetThemeColors("light"),
    rose: createPresetThemeColors("rose"),
    orange: createPresetThemeColors("orange"),
    indigoGreen: createPresetThemeColors("indigoGreen"),
    tealRose: createPresetThemeColors("tealRose"),
    limeTea: createPresetThemeColors("limeTea"),
  };
})();

const PRESET_THEME_KEY_MAP = {
  black: "dark",
  light: "light",
  rose: "rose",
  orange: "orange",
  indigoGreen: "indigoGreen",
  tealRose: "tealRose",
  limeTea: "limeTea",
} as const;

const PRESET_THEME_DEFAULT_LABELS = {
  black: "墨黑星紫",
  light: "松褐吉粉",
  rose: "玫红天青",
  orange: "暖橘荷青",
  indigoGreen: "因蓝艾绿",
  tealRose: "斯绿玫粉",
  limeTea: "凝白茶青",
} as const;

const PRESET_THEME_LEGACY_LABEL_MAP: Record<string, string> = {
  朱砂天青: PRESET_THEME_DEFAULT_LABELS.rose,
  深蓝甲: PRESET_THEME_DEFAULT_LABELS.rose,
  深蓝: PRESET_THEME_DEFAULT_LABELS.rose,
  蓝色: PRESET_THEME_DEFAULT_LABELS.rose,
  亮青色: PRESET_THEME_DEFAULT_LABELS.rose,
  黑色: PRESET_THEME_DEFAULT_LABELS.black,
  黑深灰: PRESET_THEME_DEFAULT_LABELS.black,
  浅色: PRESET_THEME_DEFAULT_LABELS.light,
  浅粉色: PRESET_THEME_DEFAULT_LABELS.light,
  深海军: PRESET_THEME_DEFAULT_LABELS.light,
  绿色: PRESET_THEME_DEFAULT_LABELS.rose,
  薄荷绿: PRESET_THEME_DEFAULT_LABELS.rose,
  橙色: PRESET_THEME_DEFAULT_LABELS.orange,
  活力橙: PRESET_THEME_DEFAULT_LABELS.orange,
  玫红色: PRESET_THEME_DEFAULT_LABELS.rose,
  玫红: PRESET_THEME_DEFAULT_LABELS.rose,
};

const DEFAULT_DIALOG_SECTION_TITLE_CLASS = "text-[12px] font-semibold leading-tight tracking-[0.01em] sm:text-[13px] xl:text-[14px]";
const DEFAULT_DIALOG_FIELD_TITLE_CLASS = "text-[11px] font-medium leading-tight sm:text-[12px]";
const DEFAULT_DIALOG_FIXED_FUNCTION_TITLE_CLASS = "text-[11px] font-semibold leading-tight tracking-[0.02em] sm:text-[12px] xl:text-[13px]";
const DEFAULT_DIALOG_HELPER_TEXT_CLASS = "text-[10px] leading-[1.25] sm:text-[11px] sm:leading-[1.3]";
const DEFAULT_DIALOG_META_TEXT_CLASS = "text-[10px] leading-[1.25] sm:text-[11px] sm:leading-4";
const DEFAULT_DIALOG_CONTENT_TEXT_CLASS = "text-[10px] leading-tight sm:text-[11px]";
const DEFAULT_DIALOG_CONTENT_INPUT_TEXT_CLASS = "!text-[10px] !leading-tight sm:!text-[11px]";
const MAX_AVATAR_MATERIAL_UPLOAD_BYTES = MEDIA_OPTIMIZATION_CONTRACT.kinds.image.maxUploadBytes;
const MAX_VOICE_MATERIAL_UPLOAD_BYTES = MEDIA_OPTIMIZATION_CONTRACT.kinds.audio.maxUploadBytes;
const AVATAR_MATERIAL_PIXEL_SIZE = MEDIA_OPTIMIZATION_CONTRACT.avatar.width;
const AVATAR_MATERIAL_DIMENSION_LABEL = `${AVATAR_MATERIAL_PIXEL_SIZE} × ${AVATAR_MATERIAL_PIXEL_SIZE}`;
const loadCustomerServiceMaterialNormalizer = () => import("@/lib/customer-service-material-normalizer");

type PresetThemeOptionKey = keyof typeof PRESET_THEME_KEY_MAP;

const BUILTIN_THEME_ICONS: Record<string, typeof Sun> = {
  dark: Moon,
  light: Sun,
  rose: Palette,
  orange: Palette,
  indigoGreen: Palette,
  tealRose: Palette,
  limeTea: Palette,
};

// The title switcher, layout chooser and built-in factory all consume the same
// semantic palette source. Brand swatches remain exact while readable text is
// a separately verified role instead of treating the secondary brand colour
// as text.
export const PRODUCT_MARKET_THEME_SWITCH_STYLES = Object.freeze(
  Object.fromEntries(
    PRODUCT_MARKET_THEME_PALETTES.map((palette) => [
      palette.key,
      Object.freeze({
        label: palette.name,
        backgroundColor: PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP[palette.key].operationsSwitch.background,
        color: PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP[palette.key].operationsSwitch.text,
        secondaryColor: PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP[palette.key].layoutChooser.secondary,
        secondaryTextColor: palette.onSecondary,
        borderColor: PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP[palette.key].operationsSwitch.border,
        actionColor: PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP[palette.key].operationsSwitch.focus,
        actionTextColor: palette.onAction,
        panelColor: PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP[palette.key].operationsSwitch.panel,
        panelTextColor: PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP[palette.key].operationsSwitch.panelText,
      }),
    ])
  )
) as Readonly<
  Record<
    ThemePresetKey,
    {
      label: string;
      backgroundColor: string;
      color: string;
      secondaryColor: string;
      secondaryTextColor: string;
      borderColor: string;
      actionColor: string;
      actionTextColor: string;
      panelColor: string;
      panelTextColor: string;
    }
  >
>;

// Built-in preview colours are factory-owned. Runtime drafts may select a
// palette, but cannot replace any of these first-glance preview values.
const PRESET_THEME_SELECTION_COLORS = Object.freeze({
  rose: PRODUCT_MARKET_THEME_SWITCH_STYLES.rose,
  orange: PRODUCT_MARKET_THEME_SWITCH_STYLES.orange,
  indigoGreen: PRODUCT_MARKET_THEME_SWITCH_STYLES.indigoGreen,
  tealRose: PRODUCT_MARKET_THEME_SWITCH_STYLES.tealRose,
  limeTea: PRODUCT_MARKET_THEME_SWITCH_STYLES.limeTea,
  black: PRODUCT_MARKET_THEME_SWITCH_STYLES.dark,
  light: PRODUCT_MARKET_THEME_SWITCH_STYLES.light,
} as const satisfies Record<PresetThemeOptionKey, (typeof PRODUCT_MARKET_THEME_SWITCH_STYLES)[ThemePresetKey]>);

const FIXED_PRESET_THEME_TEXT_COLORS = Object.freeze({
  black: PRESET_THEME_SELECTION_COLORS.black.color,
  light: PRESET_THEME_SELECTION_COLORS.light.color,
  rose: PRESET_THEME_SELECTION_COLORS.rose.color,
  orange: PRESET_THEME_SELECTION_COLORS.orange.color,
  indigoGreen: PRESET_THEME_SELECTION_COLORS.indigoGreen.color,
  tealRose: PRESET_THEME_SELECTION_COLORS.tealRose.color,
  limeTea: PRESET_THEME_SELECTION_COLORS.limeTea.color,
});

const FIXED_PRESET_THEME_BG_COLORS = Object.freeze({
  black: PRESET_THEME_SELECTION_COLORS.black.backgroundColor,
  light: PRESET_THEME_SELECTION_COLORS.light.backgroundColor,
  rose: PRESET_THEME_SELECTION_COLORS.rose.backgroundColor,
  orange: PRESET_THEME_SELECTION_COLORS.orange.backgroundColor,
  indigoGreen: PRESET_THEME_SELECTION_COLORS.indigoGreen.backgroundColor,
  tealRose: PRESET_THEME_SELECTION_COLORS.tealRose.backgroundColor,
  limeTea: PRESET_THEME_SELECTION_COLORS.limeTea.backgroundColor,
});

const FONT_OPTIONS = [
  { label: "思源黑体字", value: "'Noto Sans SC', sans-serif" },
  { label: "思源宋体字", value: "'Noto Serif SC', serif" },
];

const FONT_WEIGHT_OPTIONS = [
  { label: "细体小字体", value: "300" },
  { label: "中体中字体", value: "400" },
  { label: "粗体粗字体", value: "700" },
] as const;

const LETTER_SPACING_OPTIONS = [
  { label: "紧凑距离字", value: "0em" },
  { label: "标准距离字", value: "0.02em" },
  { label: "舒展距离字", value: "0.04em" },
] as const;

const CS_ANIMATION_OPTIONS = CUSTOMER_SERVICE_ANIMATION_OPTIONS;

const SOUND_STYLE_TEXT: Record<string, { label: string; description: string }> = Object.fromEntries(
  SOUND_STYLE_PRESETS.map((preset) => [preset.key, { label: preset.label, description: preset.description }]),
);

const LEGACY_MATERIAL_FILE_SEQUENCE_MAP: Record<string, number> = {
  qiuyan: 1,
  qiuyang: 1,
  moer: 2,
  ali: 3,
  mengnanali: 3,
  qionyun: 4,
  qiongyun: 4,
  chenhon: 5,
  chenhong: 5,
  kaige: 6,
};

const LEGACY_AVATAR_MATERIAL_GENDER_BY_STEM: Record<string, AvatarMaterialGender> = {
  qiuyang: "female",
  qiuyan: "female",
  moer: "female",
  ali: "male",
  mengnanali: "male",
  qionyun: "female",
  qiongyun: "female",
  chenhong: "female",
  chenhon: "female",
  kaige: "male",
};

function resolveAvatarMaterialGender(
  fileName: string | null | undefined,
  builtinGender?: AvatarMaterialGender,
  fallbackGender: AvatarMaterialGender = "female",
) {
  if (builtinGender) return builtinGender;
  const normalizedStem = sanitizeDisplayText(fileName, "")
    .toLowerCase()
    .replace(/^\d+[.．、_-]?\s*/, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]\d{2,4}$/, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
  return LEGACY_AVATAR_MATERIAL_GENDER_BY_STEM[normalizedStem] || fallbackGender;
}

function normalizeAvatarMaterialStem(fileName?: string | null) {
  return sanitizeDisplayText(fileName, "")
    .toLowerCase()
    .replace(/^\d+[.．、_-]?\s*/, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]\d{2,4}$/, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
}

/**
 * The first six legacy portraits are the fixed 01–06 expert portraits even
 * though their old physical upload prefixes were written in reverse order.
 * New 16+ files always keep their own persistent storage sequence.
 */
function resolveAvatarMaterialDisplaySequence(fileName?: string | null) {
  const storedSequence = resolveStoredAvatarMaterialSequence(fileName);
  const legacySequence = LEGACY_MATERIAL_FILE_SEQUENCE_MAP[normalizeAvatarMaterialStem(fileName)];
  if (legacySequence && (!storedSequence || storedSequence <= 6)) return legacySequence;
  return storedSequence;
}

function resolveAudioMaterialCategory(
  asset: StoredMaterialAssetItem,
  fallbackCategory: Exclude<AudioMaterialCategory, "all">,
): Exclude<AudioMaterialCategory, "all"> {
  if (asset.systemManaged && /reminder/i.test(asset.assetId)) return "reminder-sound";
  const voiceMeta = resolveVoiceMaterialMeta(asset.fileName);
  if (voiceMeta?.gender === "male") return "male-voice";
  if (voiceMeta?.gender === "female") return "female-voice";
  return fallbackCategory;
}

/**
 * Voice covers are stored beside avatars in the shared material store.  Their
 * filename carries a stable category so an unreferenced cover remains reusable
 * without letting ordinary expert portraits leak into a sound library.
 */
function resolveCustomerServiceCoverMaterialCategory(fileName?: string | null): Exclude<AudioMaterialCategory, "all"> | undefined {
  const normalized = sanitizeDisplayText(fileName, "").trim().toLowerCase();
  if (/^customer-service-female-voice-cover[-_]/.test(normalized)) return "female-voice";
  if (/^customer-service-male-voice-cover[-_]/.test(normalized)) return "male-voice";
  if (/^customer-service-reminder-cover[-_]/.test(normalized)) return "reminder-sound";
  return undefined;
}

function findCustomerServiceSystemVoicePreset(asset: Pick<StoredMaterialAssetItem, "assetId" | "fileName">) {
  return CUSTOMER_SERVICE_VOICE_PRESETS.find((preset) => (
    preset.localAsset.assetId === asset.assetId
    || preset.localAsset.fileName === asset.fileName
    || preset.storageFileName === asset.fileName
  ));
}

const VOICE_MATERIAL_META_BY_SEQUENCE: Record<number, { label: string; gender: "female" | "male" }> =
  Object.fromEntries(
    CUSTOMER_SERVICE_VOICE_PRESETS.map((preset, index) => [index + 1, { label: preset.label, gender: preset.gender }]),
  );

type ProductMarketScope = "hq" | "agency" | "client" | "agency_source" | "client_source";

const scopeLabels: Record<ProductMarketScope, string> = {
  hq: "总部端",
  agency_source: "代理源",
  agency: "代理端",
  client_source: "客户源",
  client: "客户端",
};

function formatMaterialAssetSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMaterialAssetDuration(durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return "读取中…";
  if (durationSeconds < 1) return `${durationSeconds.toFixed(1)}秒`;
  return `${Math.round(durationSeconds)}秒`;
}

function formatMaterialAssetTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cloneExportableConfigSnapshot(config: ExportableConfig): ExportableConfig {
  return {
    ...config,
    products: cloneSharedProducts(config.products) as ExportableConfig["products"],
    customDefaultPaths: [...(config.customDefaultPaths || [])],
    layoutStyle: { ...config.layoutStyle },
    visualCardLayout: config.visualCardLayout ? cloneVisualCardLayout(config.visualCardLayout) : undefined,
    layoutSections: cloneLayoutSections(config.layoutSections),
    customerServiceSections: cloneCustomerServiceSections(config.customerServiceSections),
    productOrder: [...(config.productOrder || [])],
    moduleCategoryOrder: [...(config.moduleCategoryOrder || [])],
    moduleCategoryAssignments: { ...(config.moduleCategoryAssignments || {}) },
    moduleCategoryStyles: Object.fromEntries(
      Object.entries(config.moduleCategoryStyles || {}).map(([key, style]) => [key, { ...style }])
    ),
    customThemes: cloneThemes(config.customThemes),
    builtinThemeOverrides: cloneThemeMap(config.builtinThemeOverrides),
    sidebarStyle: config.sidebarStyle ? { ...config.sidebarStyle } : undefined,
    customProducts: cloneCustomProducts(config.customProducts),
    csAvatarOverrides: cloneAvatarOverrides(config.csAvatarOverrides),
  };
}

type CustomerServiceAvatarPreviewDescriptor = readonly (string | null)[];
type CustomerServiceAvatarPreviewPlanEntry = {
  avatarId: string;
  override: CustomerServiceAvatarOverride;
  materialReference?: CustomerServiceLocalMaterialReference | null;
  previewDescriptor: CustomerServiceAvatarPreviewDescriptor;
};

const EMPTY_CUSTOMER_SERVICE_AVATAR_OVERRIDE = Object.freeze({}) as CustomerServiceAvatarOverride;
const customerServiceAvatarPreviewDescriptorCache = new WeakMap<
  CustomerServiceAvatarOverride,
  { portrait: CustomerServiceAvatarPreviewDescriptor; service?: CustomerServiceAvatarPreviewDescriptor }
>();

function appendCustomerServiceStyleAssetDescriptor(
  target: Array<string | null>,
  section: string,
  assets: CustomerServiceAvatarOverride["soundAssetsByStyle"] | CustomerServiceAvatarOverride["voiceAssetsByStyle"]
) {
  const entries = Object.entries(assets || {}).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  target.push(section, String(entries.length));
  entries.forEach(([styleKey, asset]) => {
    target.push(
      styleKey,
      asset ? "asset" : "empty",
      asset?.assetId || null,
      asset?.fileName || null,
      asset?.mimeType || null,
    );
  });
}

function getCustomerServiceAvatarPreviewDescriptor(
  override: CustomerServiceAvatarOverride,
  includeService: boolean,
): CustomerServiceAvatarPreviewDescriptor {
  let cached = customerServiceAvatarPreviewDescriptorCache.get(override);
  if (!cached) {
    cached = {
      portrait: [
        "mediaAssetId", override.mediaAssetId || null,
        "mediaMimeType", override.mediaMimeType || null,
        // Keep the exact legacy string reference for equality without copying
        // a potentially multi-megabyte Data URL into JSON and joined strings.
        "imageDataUrl", override.imageDataUrl || null,
      ],
    };
    customerServiceAvatarPreviewDescriptorCache.set(override, cached);
  }
  if (!includeService) return cached.portrait;
  if (cached.service) return cached.service;

  const service: Array<string | null> = [
    ...cached.portrait,
    "soundStyle", override.soundStyle || null,
    "soundAssetId", override.soundAssetId || null,
    "soundAssetFileName", override.soundAssetFileName || null,
  ];
  appendCustomerServiceStyleAssetDescriptor(service, "soundAssetsByStyle", override.soundAssetsByStyle);
  appendCustomerServiceStyleAssetDescriptor(service, "reminderImageAssetsByStyle", override.reminderImageAssetsByStyle);
  service.push(
    "voiceGender", override.voiceGender || null,
    "voiceStyleKey", override.voiceStyleKey || null,
    "femaleVoiceAssetId", override.femaleVoiceAssetId || null,
    "femaleVoiceAssetFileName", override.femaleVoiceAssetFileName || null,
    "maleVoiceAssetId", override.maleVoiceAssetId || null,
    "maleVoiceAssetFileName", override.maleVoiceAssetFileName || null,
  );
  appendCustomerServiceStyleAssetDescriptor(service, "voiceAssetsByStyle", override.voiceAssetsByStyle);
  appendCustomerServiceStyleAssetDescriptor(service, "voiceImageAssetsByStyle", override.voiceImageAssetsByStyle);
  cached.service = service;
  return service;
}

function areCustomerServiceAvatarPreviewPlansEqual(
  left: readonly CustomerServiceAvatarPreviewPlanEntry[],
  right: readonly CustomerServiceAvatarPreviewPlanEntry[],
) {
  if (left.length !== right.length) return false;
  return left.every((entry, index) => {
    const candidate = right[index];
    if (
      entry.avatarId !== candidate.avatarId
      || entry.materialReference?.materialId !== candidate.materialReference?.materialId
      || entry.materialReference?.localUrl !== candidate.materialReference?.localUrl
      || entry.previewDescriptor.length !== candidate.previewDescriptor.length
    ) return false;
    return entry.previewDescriptor.every((value, descriptorIndex) => value === candidate.previewDescriptor[descriptorIndex]);
  });
}

function parseMaterialFileSequence(fileName?: string | null) {
  const normalized = sanitizeDisplayText(fileName, "").trim().toLowerCase();
  if (!normalized) return Number.POSITIVE_INFINITY;
  const explicitMatch = normalized.match(/^(\d+)[._-]/);
  if (explicitMatch) {
    return Number(explicitMatch[1]);
  }
  const stem = normalized.replace(/\.[^.]+$/, "");
  return LEGACY_MATERIAL_FILE_SEQUENCE_MAP[stem] || Number.POSITIVE_INFINITY;
}

function formatMaterialDisplayFileName(fileName?: string | null) {
  const label = sanitizeDisplayText(fileName, "未命名素材");
  return label.replace(/^(\d)\./, "0$1.");
}

function compareMaterialAssetsForDisplay(a: StoredMaterialAssetItem, b: StoredMaterialAssetItem) {
  // Customer-service material names carry their display sequence (for example
  // "01.蓄势专家").  The picker must show the largest / newest position first;
  // the API intentionally only provides storage records, so keep this UI rule
  // explicit instead of depending on filesystem order.
  const sequenceA = parseMaterialFileSequence(a.fileName);
  const sequenceB = parseMaterialFileSequence(b.fileName);
  // Older unnumbered legacy files must not jump above the new two-digit
  // sequence. They fall back to their creation time after numbered records.
  const sequenceDiff = (Number.isFinite(sequenceB) ? sequenceB : 0) - (Number.isFinite(sequenceA) ? sequenceA : 0);
  if (sequenceDiff !== 0) return sequenceDiff;

  const createdAtDiff = String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  if (createdAtDiff !== 0) return createdAtDiff;

  const fileNameDiff = sanitizeDisplayText(a.fileName, "").localeCompare(
    sanitizeDisplayText(b.fileName, ""),
    "zh-CN",
    { numeric: true, sensitivity: "base" }
  );
  if (fileNameDiff !== 0) return -fileNameDiff;

  return b.assetId.localeCompare(a.assetId, "zh-CN", { numeric: true, sensitivity: "base" });
}

function resolveVoiceMaterialMeta(fileName?: string | null) {
  const sequence = parseMaterialFileSequence(fileName);
  const fixedMeta = Number.isFinite(sequence) ? VOICE_MATERIAL_META_BY_SEQUENCE[sequence] : null;
  const normalized = sanitizeDisplayText(fileName, "").toLowerCase();
  if (/女声|nvsheng|female/.test(normalized)) {
    return fixedMeta?.gender === "female"
      ? fixedMeta
      : { label: normalized.includes("萌妹") ? "萌妹女声" : "女声朗读", gender: "female" as const };
  }
  if (/男声|nansheng|male/.test(normalized)) {
    return fixedMeta?.gender === "male"
      ? fixedMeta
      : { label: "男声朗读", gender: "male" as const };
  }
  if (fixedMeta) return fixedMeta;
  return null;
}

function getMaterialFileExtension(fileName: string) {
  const match = sanitizeDisplayText(fileName, "").trim().match(/(\.[^.]+)$/);
  return match ? match[1].toLowerCase() : "";
}

function getNextMaterialSequence(
  assets: StoredMaterialAssetItem[],
  kinds: MaterialAssetKind[],
  reservedSequenceEnd = 0,
) {
  const highestSequence = assets
    .filter((asset) => kinds.includes(asset.kind))
    .reduce((highest, asset) => Math.max(
      highest,
      Number.isFinite(parseMaterialFileSequence(asset.fileName)) ? parseMaterialFileSequence(asset.fileName) : 0
    ), reservedSequenceEnd);
  return String(highestSequence + 1).padStart(2, "0");
}

function buildNextAvatarMaterialFileName(
  sourceFileName: string,
  mimeType: string,
  assets: StoredMaterialAssetItem[]
) {
  const suffix = getMaterialFileExtension(sourceFileName) || (mimeType.startsWith("video/") ? ".mp4" : ".png");
  const normalizedStem = sanitizeDisplayText(sourceFileName, "素材")
    .replace(/\.[^.]+$/, "")
    .replace(/^\d+[._-]?/, "")
    .trim() || "素材";
  return `${getNextMaterialSequence(
    assets,
    ["image", "video"],
    CUSTOMER_SERVICE_RESERVED_AVATAR_SEQUENCE_END,
  )}.${normalizedStem}${suffix}`;
}

function buildNextVoiceMaterialFileName(
  sourceFileName: string,
  mimeType: string,
  assets: StoredMaterialAssetItem[],
  presetLabel: string
) {
  const suffix = getMaterialFileExtension(sourceFileName) || (mimeType.startsWith("audio/") ? ".mp3" : ".mp3");
  const normalizedLabel = sanitizeDisplayText(presetLabel, "朗读声音")
    .replace(/^\d+[.．、_-]?\s*/, "")
    .trim() || "朗读声音";
  return `${getNextMaterialSequence(
    assets,
    ["audio"],
    CUSTOMER_SERVICE_NEW_VOICE_SEQUENCE_START - 1,
  )}.${normalizedLabel}${suffix}`;
}

function buildCustomerServiceCoverMaterialFileName(
  sourceFileName: string,
  mimeType: string,
  category: Exclude<AudioMaterialCategory, "all">,
) {
  const suffix = getMaterialFileExtension(sourceFileName) || (mimeType.startsWith("image/") ? ".png" : ".png");
  const normalizedStem = sanitizeDisplayText(sourceFileName, "封面")
    .replace(/\.[^.]+$/, "")
    .replace(/^\d+[._-]?/, "")
    .trim() || "封面";
  const categoryLabel = category === "female-voice"
    ? "female-voice-cover"
    : category === "male-voice"
      ? "male-voice-cover"
      : "reminder-cover";
  return `customer-service-${categoryLabel}-${normalizedStem}${suffix}`;
}

function appendMaterialVersion(
  history: CustomerServiceAvatarOverride["materialHistory"],
  asset: { assetId?: string; mimeType?: string; fileName?: string } | undefined,
  kind: "avatar" | "voice" | "reminder"
) {
  if (!asset?.assetId) return history || [];
  return [{ ...asset, kind, savedAt: new Date().toISOString() }, ...(history || []).filter((item) => item.assetId !== asset.assetId)].slice(0, 3);
}

function extractMaterialAssetIdsFromConfig(config: unknown) {
  if (!config || typeof config !== "object") return [] as string[];
  const products = (config as { products?: Array<{ customStyle?: { customIconAssetId?: string }; children?: Array<{ customStyle?: { customIconAssetId?: string } }> }> }).products;
  const overrides = (
    config as {
      csAvatarOverrides?: Record<
        string,
        {
          mediaAssetId?: string;
          soundAssetId?: string;
          femaleVoiceAssetId?: string;
          maleVoiceAssetId?: string;
        }
      >;
    }
  ).csAvatarOverrides;
  const productAssetIds = Array.isArray(products)
    ? products.flatMap((product) => [
        product?.customStyle?.customIconAssetId?.trim(),
        ...(product?.children || []).map((child) => child?.customStyle?.customIconAssetId?.trim()),
      ])
    : [];
  const avatarOverrides = overrides && typeof overrides === "object" ? overrides : {};
  // Every 01–12 Select Expert portrait is represented by the same local
  // material-reference contract. Keep the active local asset referenced until
  // that expert explicitly chooses another one, so a live source is not deletable.
  const defaultExpertAvatarAssetIds = getCustomerServiceCategoryExperts()
    .flatMap((expert) => (
      expert.defaultAvatarAssetId && !avatarOverrides[expert.id]?.mediaAssetId?.trim()
        ? [expert.defaultAvatarAssetId]
        : []
    ));
  return Array.from(
    new Set(
      [
        ...productAssetIds,
        ...defaultExpertAvatarAssetIds,
        ...Object.values(avatarOverrides)
          .flatMap((item) => [
            item?.mediaAssetId?.trim(),
            item?.soundAssetId?.trim(),
            item?.femaleVoiceAssetId?.trim(),
            item?.maleVoiceAssetId?.trim(),
            ...Object.values(item?.soundAssetsByStyle || {}).map((asset) => asset?.assetId?.trim()),
            ...Object.values(item?.reminderImageAssetsByStyle || {}).map((asset) => asset?.assetId?.trim()),
            ...Object.values(item?.voiceAssetsByStyle || {}).map((asset) => asset?.assetId?.trim()),
            ...Object.values(item?.voiceImageAssetsByStyle || {}).map((asset) => asset?.assetId?.trim()),
          ]),
      ]
        .filter((value): value is string => Boolean(value))
    )
  );
}

function buildMaterialSourceLabelFromKey(key: string) {
  if (key === "product-market-config:hq:current") return "总部客户端设置 当前";
  if (key === "product-market-config:hq:default") return "总部客户端设置 默认";
  if (key === "product-market-config:agency_source:current") return "代理源 当前";
  if (key === "product-market-config:agency_source:default") return "代理源 默认";
  if (key === "product-market-config:agency:current") return "代理端设置 当前";
  if (key === "product-market-config:agency:default") return "代理端设置 默认";
  if (key === "product-market-config:client_source:current") return "客户源 当前";
  if (key === "product-market-config:client_source:default") return "客户源 默认";
  if (key === "product-market-config:client:current") return "客户端设置 当前";
  if (key === "product-market-config:client:default") return "客户端设置 默认";
  if (key === "product-market-shared-style:global") return "总部客户端共享默认";
  if (key.startsWith("product-market-config:site:")) {
    const parts = key.split(":");
    const siteId = parts[3] || "site";
    const mode = parts[4] === "default" ? "默认" : "当前";
    return `独立计划 ${siteId} ${mode}`;
  }
  if (key.startsWith("product-market-shared-style:site:")) {
    const siteId = key.split(":")[3] || "site";
    return `独立计划 ${siteId} 共享默认`;
  }
  return key;
}

function formatUploadErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const message = error.message.trim();
    return message || fallback;
  }
  return fallback;
}

function buildMaterialAssetContentUrl(assetId?: string | null) {
  const normalized = assetId?.trim();
  if (!normalized) return undefined;
  return `/api/v1/local-dev/material-assets/${encodeURIComponent(normalized)}/content`;
}

type CustomerServiceAudioPreview = {
  fileName?: string;
  url?: string;
};

type CustomerServiceVoicePreviewMap = Record<
  string,
  {
    default?: CustomerServiceAudioPreview;
    female?: CustomerServiceAudioPreview;
    male?: CustomerServiceAudioPreview;
    byStyle?: Record<string, CustomerServiceAudioPreview>;
  }
>;
type CustomerServiceReminderPreviewMap = Record<
  string,
  {
    default?: CustomerServiceAudioPreview;
    byStyle?: Record<string, CustomerServiceAudioPreview>;
  }
>;

type CustomerServiceUploadTarget = Pick<
  MaterialPickerTarget,
  "type" | "avatarId" | "voiceGender" | "voiceStyleKey" | "soundStyleKey"
>;

function collectMaterialAssetUsageSources() {
  const sources: { sourceKey: string; sourceLabel: string; assetIds: string[] }[] = [];
  try {
    const liveConfig = useProductMarketStore.getState().exportConfig();
    sources.push({
      sourceKey: "product-market-live-store",
      sourceLabel: "当前编辑配置",
      assetIds: extractMaterialAssetIdsFromConfig(liveConfig),
    });
  } catch {
    // Ignore live store snapshot failures and continue scanning persisted sources.
  }
  if (typeof window === "undefined") return sources;
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    if (!key.startsWith("product-market-config:") && !key.startsWith("product-market-shared-style")) {
      continue;
    }
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const assetIds = extractMaterialAssetIdsFromConfig(parsed);
      sources.push({
        sourceKey: key,
        sourceLabel: buildMaterialSourceLabelFromKey(key),
        assetIds,
      });
    } catch {
      // Ignore invalid local cache entries.
    }
  }
  return sources;
}

function defaultProductLabel(path: string) {
  return ALL_PRODUCTS.find((product) => product.path === path)?.label || "未命名功能";
}

function displayProductLabel(product: { path: string; label: string; customLabel?: string | null }) {
  return sanitizeDisplayText(product.customLabel, sanitizeDisplayText(product.label, defaultProductLabel(product.path)));
}

function buildDefaultModuleDescription(label: string, levelLabel = "左侧导航") {
  const cleanLabel = sanitizeDisplayText(label, "未命名栏目");
  return `${levelLabel}：${cleanLabel}，可在栏目配置、左侧导航、右侧栏调用。`;
}

// Content programs own their real editor routes.  Do not create a second
// `/website-content/*` navigation tree: 栏目配置 is the one source read by
// 运营市场、左侧导航与页面锁定器.
const WEBSITE_CONTENT_PROGRAMS = CLIENT_SOURCE_CONTENT_PROGRAMS;

const LEGACY_CONTENT_PROGRAM_LABELS: Record<string, readonly string[]> = Object.fromEntries(
  WEBSITE_CONTENT_PROGRAMS.map((program) => [program.path, program.legacyLabels])
);

const buildProductModuleLabel = (path: string, label: string) => {
  return sanitizeDisplayText(label, "未命名功能");
};

const buildProductModuleCategoryLabel = (label: string) => label;

function buildEditableProducts(
  products: ReturnType<typeof useProductMarketStore.getState>["products"],
): EditableModuleItem[] {
  return products.map((product) => ({
    label: product.label,
    path: product.path,
    status: product.status,
    customLabel: product.customLabel || product.label,
    description: product.description || buildDefaultModuleDescription(product.label),
    customStyle: { ...(product.customStyle || {}) },
    children: (product.children || []).map((child) => ({
      label: child.label,
      path: child.path,
      status: child.status,
      customLabel: child.customLabel || child.label,
      description: child.description || buildDefaultModuleDescription(child.label, "二级栏目"),
      customStyle: { ...(child.customStyle || {}) },
    })),
  }));
}

const SIDEBAR_STYLE_SYNC_VERSION = "client-sidebar-v1";
/**
 * Source workspaces are shared templates, even when their URL retains a
 * `siteId` for navigation context.  Never let that route context turn a
 * source save into a per-site snapshot: the next load correctly prefers the
 * shared template and would otherwise resurrect the old value.
 */
function resolveProductMarketStorageSiteId(scope: ProductMarketScope, siteId?: string | null) {
  return scope === "hq" || scope === "agency_source" || scope === "client_source"
    ? null
    : siteId;
}

const currentConfigKey = (scope: ProductMarketScope, siteId?: string | null) =>
  currentProductMarketConfigKey(scope, resolveProductMarketStorageSiteId(scope, siteId));
const defaultConfigKey = (scope: ProductMarketScope, siteId?: string | null) =>
  defaultProductMarketConfigKey(scope, resolveProductMarketStorageSiteId(scope, siteId));
const readStoredConfig = readStoredProductMarketConfig;
const configSignature = productMarketConfigSignature;

function getScopeFromPath(pathname: string): ProductMarketScope {
  if (pathname.startsWith("/zb/agency-source")) return "agency_source";
  if (pathname.startsWith("/zb/client-source")) return "client_source";
  if (pathname.startsWith("/zb")) return "hq";
  if (pathname.startsWith("/dl")) return "agency";
  return "client";
}

function hasStoredScopedSiteConfig(siteId?: string | null) {
  if (!siteId) return false;
  return Boolean(
    readStoredProductMarketConfig(currentProductMarketConfigKey("client", siteId)) ||
    readStoredProductMarketConfig(defaultProductMarketConfigKey("client", siteId))
  );
}

function getAgencyBaseConfig(siteId?: string | null) {
  return (
    readAgencyTemplateProductMarketConfig() ||
    readStoredProductMarketConfig(defaultProductMarketConfigKey("agency", siteId)) ||
    readStoredProductMarketConfig(currentProductMarketConfigKey("agency", siteId)) ||
    readStoredProductMarketConfig(defaultProductMarketConfigKey("agency")) ||
    readStoredProductMarketConfig(currentProductMarketConfigKey("agency"))
  );
}

function normalizeScopedConfig(scope: ProductMarketScope, config: ExportableConfig | null) {
  if (!config) return null;
  const baseTheme = String(config.activeTheme || "").replace(/__customized$/, "");
  let normalizedConfig: ExportableConfig;
  if (baseTheme !== "green" && baseTheme !== "deep-blue") {
    normalizedConfig = { ...config, sidebarStyleSyncVersion: SIDEBAR_STYLE_SYNC_VERSION };
  } else {
    const roseTheme = getFactoryBuiltinThemes().find((theme) => theme.key === "rose");
    normalizedConfig = roseTheme
      ? {
          ...config,
          activeTheme: "rose",
          layoutStyle: { ...roseTheme.layout },
          sidebarStyle: { ...roseTheme.sidebar },
          builtinThemeOverrides: Object.fromEntries(
            Object.entries(config.builtinThemeOverrides || {}).filter(([key]) => key !== "green" && key !== "deep-blue")
          ),
          customThemes: (config.customThemes || []).filter(
            (theme) => theme.key.replace(/__customized$/, "") !== "green" && theme.key.replace(/__customized$/, "") !== "deep-blue"
          ),
          sidebarStyleSyncVersion: SIDEBAR_STYLE_SYNC_VERSION,
        }
      : { ...config, activeTheme: "rose", sidebarStyleSyncVersion: SIDEBAR_STYLE_SYNC_VERSION };
  }
  const sourceContractConfig = scope === "client_source"
    ? normalizeClientSourceContentContract(normalizedConfig)
    : normalizedConfig;
  // Client plans inherit the factory catalogue, but the client source owns
  // the website-content catalogue itself.  Rebuilding the source against the
  // factory list removes News / Video / Blog and the other real editor routes
  // after the shared contract has correctly restored them.
  return scope === "client"
    ? rebaseFactoryBlueprintConfig(scope, sourceContractConfig)
    : sourceContractConfig;
}

type RuntimeInstanceIdentity = {
  instanceId: string;
  ownerId: string;
  organizationId?: number;
  projectId?: number;
  legacyInstanceId?: string;
  clientPlanIdentity?: ClientPlanRuntimeIdentity;
};

function resolveRuntimeInstanceIdentity(scope: "client" | "agency", siteId: string): RuntimeInstanceIdentity {
  const site = getSiteById(siteId);
  const params = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  if (scope === "client") {
    const planCode = (params.get("plan") || site?.planCode || "").trim().toUpperCase();
    const clientPlanIdentity = resolveClientPlanRuntimeInstanceIdentity({
      planCode,
      clientId: site?.clientId,
      planId: site?.planId,
      allowLegacyPlanCode: true,
    });
    return {
      instanceId: clientPlanIdentity.instanceId,
      ownerId: clientPlanIdentity.planCode,
      organizationId: clientPlanIdentity.clientId ?? undefined,
      projectId: clientPlanIdentity.planId ?? undefined,
      legacyInstanceId: clientPlanIdentity.legacyInstanceId ?? undefined,
      clientPlanIdentity,
    };
  }
  const agencyCode = (params.get("agency") || site?.agencyCode || "").trim().toUpperCase();
  return {
    // This matches the server-created record and the agency release centre.
    instanceId: agencyCode ? `agency-runtime-${agencyCode}` : `agency:${siteId}`,
    ownerId: agencyCode || siteId,
  };
}

function assertRuntimeInstanceBinding(identity: RuntimeInstanceIdentity, instance: unknown) {
  if (!identity.clientPlanIdentity) return;
  const expectedIdentity = identity.instanceId === identity.clientPlanIdentity.instanceId
    ? identity.clientPlanIdentity
    : resolveLegacyClientPlanRuntimeInstanceIdentity(identity.clientPlanIdentity);
  if (!expectedIdentity || expectedIdentity.instanceId !== identity.instanceId) {
    throw new Error("客户端计划运行实例身份与当前保存目标不一致，已阻止读取或写入。");
  }
  assertClientPlanRuntimeInstanceBinding(expectedIdentity, instance);
}

async function resolveExistingRuntimeInstance(identity: RuntimeInstanceIdentity) {
  try {
    const instance = await fetchInstance(identity.instanceId);
    assertRuntimeInstanceBinding(identity, instance);
    return { identity, instance };
  } catch (cause) {
    if (!(cause instanceof TemplateSnapshotRequestError) || cause.status !== 404) throw cause;
  }

  if (!identity.legacyInstanceId || identity.legacyInstanceId === identity.instanceId) return null;
  try {
    const instance = await fetchInstance(identity.legacyInstanceId);
    const legacyIdentity = { ...identity, instanceId: identity.legacyInstanceId };
    assertRuntimeInstanceBinding(legacyIdentity, instance);
    return {
      identity: legacyIdentity,
      instance,
    };
  } catch (cause) {
    if (cause instanceof TemplateSnapshotRequestError && cause.status === 404) return null;
    throw cause;
  }
}

function buildPersistedProductMarketSnapshot(config: ExportableConfig) {
  return normalizeProductMarketConfigForStorage({
    ...config,
    sidebarStyleSyncVersion: SIDEBAR_STYLE_SYNC_VERSION,
  });
}

function writeScopedConfig(
  scope: ProductMarketScope,
  key: string,
  config: ExportableConfig,
  options?: { skipSourceTemplateDraft?: boolean; skipRemoteSnapshot?: boolean; notifyOnLock?: boolean }
) {
  if (typeof window !== "undefined" && isRouteCompletedPageHardLocked(window.location.pathname, window.location.search)) {
    // Configuration recovery also uses this writer while switching routes.
    // A hard lock must stop that passive write, but navigation itself is not
    // an edit attempt and must never show an error toast.
    if (options?.notifyOnLock) {
      toast.error("当前页面已启用二级硬锁：系统同步、发布命令和保存均不可修改。请先在源开发器的页面锁定器中手动解锁。");
    }
    return false;
  }
  const nextConfig = buildPersistedProductMarketSnapshot(config);
  writeStoredProductMarketConfig(key, nextConfig);
  if (key === currentProductMarketConfigKey(scope) || key.startsWith("product-market-config:site:")) {
    createProductMarketVersion(scope, nextConfig);
  }
  const siteMatch = key.match(/^product-market-config:site:([^:]+):(current|default)$/);
  if (siteMatch && siteMatch[2] === "current" && (scope === "client" || scope === "agency")) {
    const siteId = siteMatch[1];
    const identity = resolveRuntimeInstanceIdentity(scope, siteId);
    if (!options?.skipRemoteSnapshot) void upsertInstance(identity.instanceId, {
        instanceId: identity.instanceId,
        instanceType: scope === "client" ? "client-plan" : "agency",
        ownerScope: scope,
        ownerId: identity.ownerId,
        organizationId: identity.organizationId,
        projectId: identity.projectId,
        parentId: null,
        name: identity.instanceId,
        baseTemplateId: scope === "client" ? "client-source-global" : "agency-source-global",
        baseTemplateVersion: undefined,
        snapshotConfigJson: nextConfig as Record<string, unknown>,
        overrideConfigJson: {},
        isDetached: false,
        lastSyncedAt: new Date().toISOString(),
      }).catch(() => undefined);
    return true;
  }
  if (
    key === currentProductMarketConfigKey(scope) &&
    (scope === "client_source" || scope === "agency_source" || scope === "hq")
  ) {
    const templateId =
      scope === "agency_source"
        ? "agency-source-global"
        : scope === "client_source"
          ? "client-source-global"
          : "hq-client-default";
    if (!options?.skipRemoteSnapshot && !options?.skipSourceTemplateDraft) void upsertTemplate(templateId, {
      templateId,
      templateType:
        scope === "agency_source"
          ? "agency-client"
          : scope === "client_source"
            ? "hq-client"
            : scope === "agency"
              ? "agency-client"
              : "hq-client",
      ownerScope: scope,
      ownerId: null,
      name: `${scope} default template`,
      configJson: nextConfig as Record<string, unknown>,
      latestVersion: undefined,
      // Source saves are drafts. Only the explicit publish action can advance
      // the immutable version read by downstream runtimes.
      isPublished: false,
    }).catch(() => undefined);
  }
  return true;
}

function getProductMarketTemplateId(scope: ProductMarketScope) {
  if (scope === "agency_source") return "agency-source-global";
  if (scope === "client_source") return "client-source-global";
  return "hq-client-default";
}

function buildProductMarketTemplateUpsert(scope: "hq" | "agency_source" | "client_source", config: ExportableConfig) {
  const templateId = getProductMarketTemplateId(scope);
  return {
    templateId,
    templateType: scope === "agency_source" ? "agency-client" : "hq-client",
    ownerScope: scope,
    ownerId: null,
    name: `${scope} default template`,
    configJson: config as Record<string, unknown>,
    latestVersion: undefined,
    isPublished: false,
  } as const;
}

async function readRemoteTemplateConfig(
  templateId: string,
  revision: "published" | "draft" | "draft-or-published" = "published",
) {
  try {
    const template = await fetchTemplate(templateId);
    const draft = (template as { draftConfigJson?: ExportableConfig; draft_config_json?: ExportableConfig }).draftConfigJson
      || (template as { draftConfigJson?: ExportableConfig; draft_config_json?: ExportableConfig }).draft_config_json
      || null;
    const published = (template as { configJson?: ExportableConfig; config_json?: ExportableConfig }).configJson
      || (template as { configJson?: ExportableConfig; config_json?: ExportableConfig }).config_json
      || null;
    const isPublished = (template as { isPublished?: boolean; is_published?: boolean }).isPublished === true
      || (template as { isPublished?: boolean; is_published?: boolean }).is_published === true;
    const config = revision === "draft"
      ? draft || (!isPublished ? published : null)
      : revision === "draft-or-published"
        ? draft || published
        : isPublished ? published : null;
    if (!config?.products) return null;
    return config;
  } catch {
    return null;
  }
}

async function readRemoteProductMarketFactoryDefaultConfig(templateId: string) {
  const factoryDefault = await fetchProductMarketFactoryDefault(templateId);
  const config = factoryDefault.factory_default_config_json as ExportableConfig;
  if (!factoryDefault.valid || !config?.products) {
    throw new Error("服务端尚未建立有效的客户源工厂默认；已阻止读取未完成下发的最新版。");
  }
  return config;
}

const PRODUCT_MARKET_RELEASE_TERMINAL_STATUSES = new Set(["completed", "partial_failed", "paused"]);
const PRODUCT_MARKET_RELEASE_POLL_TIMEOUT_MS = 120_000;

async function waitForProductMarketReleaseBatch(
  initial: TemplateReleaseBatchResponse,
  timeoutMs = PRODUCT_MARKET_RELEASE_POLL_TIMEOUT_MS,
) {
  let batch = initial;
  const deadline = Date.now() + timeoutMs;
  while (!PRODUCT_MARKET_RELEASE_TERMINAL_STATUSES.has(batch.status)) {
    if (!new Set(["queued", "running"]).has(batch.status)) {
      throw new Error(`发布批次 ${batch.id} 返回了无法识别的状态，未设置工厂默认。`);
    }
    if (Date.now() >= deadline) {
      throw new Error(`发布批次 ${batch.id} 仍在后台处理中；当前不能确认全部计划完成，也未设置工厂默认。请稍后再次点击“发布新版”继续核验。`);
    }
    const retryDelayMs = Math.min(2_000, Math.max(300, (batch.retry_after_seconds || 1) * 1_000));
    await new Promise((resolve) => globalThis.setTimeout(resolve, retryDelayMs));
    batch = await fetchTemplateReleaseBatch(batch.id);
  }
  return batch;
}

function verifyCompletedProductMarketReleaseBatch(
  batch: TemplateReleaseBatchResponse,
  templateId: string,
  version: string,
) {
  const activeTargets = batch.targets.filter((target) => target.status !== "superseded");
  const failedPlanIds = activeTargets
    .filter((target) => target.status !== "succeeded")
    .map((target) => target.instance_id)
    .slice(0, 3);
  if (batch.template_id !== templateId || batch.template_version !== version) {
    throw new Error(`发布批次 ${batch.id} 与本次模板版本不一致，未设置工厂默认。`);
  }
  if (batch.owner_scope !== "client" || batch.sections.length !== 0) {
    throw new Error(`发布批次 ${batch.id} 的客户端范围或完整配置范围不正确，未设置工厂默认。`);
  }
  if (batch.status !== "completed"
    || batch.succeeded_targets !== batch.total_targets
    || batch.failed_targets !== 0
    || activeTargets.length !== batch.total_targets
    || activeTargets.some((target) => target.status !== "succeeded")) {
    const failedSummary = failedPlanIds.length ? `；未完成计划：${failedPlanIds.join("、")}` : "";
    throw new Error(`全部客户端计划发布未完成：批次 ${batch.id}，成功 ${batch.succeeded_targets}/${batch.total_targets}，失败 ${batch.failed_targets}${failedSummary}。未设置工厂默认。`);
  }
  return batch;
}

function normalizeProductMarketPublishError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "";
  if (/[一-鿿]/u.test(message)) return cause instanceof Error ? cause : new Error(message);
  if (message.includes("No eligible runtime instances")) {
    return new Error("没有找到可发布的客户端计划实例，已阻止空批次并且未设置工厂默认。请先检查客户端计划绑定。");
  }
  if (message.includes("client-plan runtime instances")) {
    return new Error("客户端计划绑定范围不正确，已阻止跨范围发布并且未设置工厂默认。");
  }
  return new Error("发布链路未完成：服务端未接受或未完成本次操作；未设置工厂默认，请检查服务连接和计划绑定后重试。");
}

function extractRemoteInstanceConfig(instance: unknown) {
  if (!instance || typeof instance !== "object") return null;
  const payload = instance as {
    snapshotConfigJson?: ExportableConfig;
    snapshot_config_json?: ExportableConfig;
  };
  const config = payload.snapshotConfigJson || payload.snapshot_config_json || null;
  return config?.products ? config : null;
}

async function readRemoteInstanceConfig(instanceId: string) {
  try {
    const instance = await fetchInstance(instanceId);
    return extractRemoteInstanceConfig(instance);
  } catch {
    return null;
  }
}

async function readRemoteRuntimeInstanceConfig(identity: RuntimeInstanceIdentity) {
  const resolved = await resolveExistingRuntimeInstance(identity);
  return resolved ? extractRemoteInstanceConfig(resolved.instance) : null;
}

function getConfigMismatchPaths(expected: unknown, actual: unknown, path = "", paths: string[] = []): string[] {
  if (paths.length >= 6) return paths;
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual) || expected.length !== actual.length) {
      paths.push(path || "root");
      return paths;
    }
    expected.forEach((value, index) => getConfigMismatchPaths(value, actual[index], `${path}[${index}]`, paths));
    return paths;
  }
  if (expected && actual && typeof expected === "object" && typeof actual === "object") {
    const keys = new Set([...Object.keys(expected as Record<string, unknown>), ...Object.keys(actual as Record<string, unknown>)]);
    [...keys].sort().forEach((key) => getConfigMismatchPaths(
      (expected as Record<string, unknown>)[key],
      (actual as Record<string, unknown>)[key],
      path ? `${path}.${key}` : key,
      paths,
    ));
    return paths;
  }
  if (expected !== actual) paths.push(path || "root");
  return paths;
}

async function persistAndVerifyScopedSnapshot(
  scope: ProductMarketScope,
  siteId: string | null | undefined,
  expectedConfig: ExportableConfig,
) {
  if (typeof window !== "undefined" && isRouteCompletedPageHardLocked(window.location.pathname, window.location.search)) {
    throw new Error("当前页面已锁定：同步、发布与保存必须先在页面锁定器中手动解除勾选。");
  }
  const expected = buildPersistedProductMarketSnapshot(expectedConfig);
  const expectedSignature = productMarketConfigSignature(expected);
  const storageSiteId = resolveProductMarketStorageSiteId(scope, siteId);
  const local = readStoredProductMarketConfig(currentProductMarketConfigKey(scope, storageSiteId));
  if (productMarketConfigSignature(local) !== expectedSignature) {
    throw new Error("本地保存校验失败：回读配置与当前修改不一致。");
  }

  if (scope === "hq" || scope === "agency_source" || scope === "client_source") {
    const templateId = getProductMarketTemplateId(scope);
    await upsertTemplate(templateId, buildProductMarketTemplateUpsert(scope, expected));
    let remote: ExportableConfig | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const saved = await fetchTemplate(templateId) as {
        draftConfigJson?: ExportableConfig | null;
        draft_config_json?: ExportableConfig | null;
        configJson?: ExportableConfig | null;
        config_json?: ExportableConfig | null;
      };
      remote = saved.draftConfigJson || saved.draft_config_json || saved.configJson || saved.config_json || null;
      if (productMarketConfigSignature(remote) === expectedSignature) break;
      if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 180 * (attempt + 1)));
    }
    if (productMarketConfigSignature(remote) !== expectedSignature) {
      const mismatchPaths = getConfigMismatchPaths(
        normalizeProductMarketConfigForStorage(expected),
        remote ? normalizeProductMarketConfigForStorage(remote) : null,
      );
      throw new Error(`源体保存校验失败：服务端草稿回读与当前修改不一致（差异：${mismatchPaths.join("、") || "配置结构"}）。`);
    }
    // The source branch must return the same normalized, signature-verified
    // snapshot as the runtime branch. The developer draft baseline is rebuilt
    // from this value immediately after saving.
    return expected;
  }

  if (!siteId) throw new Error("运行端保存校验失败：缺少当前计划标识。");
  const preferredIdentity = resolveRuntimeInstanceIdentity(scope, siteId);
  const existingRuntime = await resolveExistingRuntimeInstance(preferredIdentity);
  if (!existingRuntime) {
    throw new Error("运行端保存校验失败：当前计划尚未由开通流程建立服务端实例，已阻止浏览器自行创建。");
  }
  const identity = existingRuntime.identity;
  await upsertInstance(identity.instanceId, {
    instanceId: identity.instanceId,
    instanceType: scope === "client" ? "client-plan" : "agency",
    ownerScope: scope,
    ownerId: identity.ownerId,
    organizationId: identity.organizationId,
    projectId: identity.projectId,
    parentId: null,
    name: identity.instanceId,
    baseTemplateId: scope === "client" ? "client-source-global" : "agency-source-global",
    baseTemplateVersion: undefined,
    snapshotConfigJson: expected as Record<string, unknown>,
    overrideConfigJson: {},
    isDetached: false,
    lastSyncedAt: new Date().toISOString(),
  });
  let remote: ExportableConfig | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const saved = await fetchInstance(identity.instanceId) as {
      snapshotConfigJson?: ExportableConfig | null;
      snapshot_config_json?: ExportableConfig | null;
    };
    remote = saved.snapshotConfigJson || saved.snapshot_config_json || null;
    if (productMarketConfigSignature(remote) === expectedSignature) break;
    if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 180 * (attempt + 1)));
  }
  if (productMarketConfigSignature(remote) !== expectedSignature) {
    throw new Error("运行端保存校验失败：服务端快照回读与当前修改不一致。");
  }
  return expected;
}

function getInheritedConfig(scope: ProductMarketScope, siteId?: string | null) {
  const currentKey = currentProductMarketConfigKey(scope, siteId);
  const defaultKey = defaultProductMarketConfigKey(scope, siteId);
  const siteScopedConfig = readStoredProductMarketConfig(currentKey) || readStoredProductMarketConfig(defaultKey);
  if (siteScopedConfig) {
    return normalizeScopedConfig(scope, siteScopedConfig);
  }

  if (scope === "hq") {
    return normalizeScopedConfig(
      scope,
      readHeadquartersProductMarketConfig() ||
        readStoredProductMarketConfig(currentProductMarketConfigKey("hq")) ||
        readStoredProductMarketConfig(defaultProductMarketConfigKey("hq"))
    );
  }
  if (scope === "agency_source") {
    return normalizeScopedConfig(
      scope,
      readAgencyTemplateProductMarketConfig() ||
        readStoredProductMarketConfig(currentProductMarketConfigKey("agency_source")) ||
        readStoredProductMarketConfig(defaultProductMarketConfigKey("agency_source")) ||
        readStoredProductMarketConfig(currentProductMarketConfigKey("hq")) ||
        readStoredProductMarketConfig(defaultProductMarketConfigKey("hq"))
    );
  }
  if (scope === "client_source") {
    return normalizeScopedConfig(
      scope,
      readClientTemplateProductMarketConfig() ||
        readStoredProductMarketConfig(currentProductMarketConfigKey("client_source")) ||
        readStoredProductMarketConfig(defaultProductMarketConfigKey("client_source")) ||
        readStoredProductMarketConfig(currentProductMarketConfigKey("hq")) ||
        readStoredProductMarketConfig(defaultProductMarketConfigKey("hq"))
    );
  }
  if (scope === "agency") {
    return normalizeScopedConfig(
      scope,
      readStoredProductMarketConfig(currentProductMarketConfigKey("agency")) ||
        readStoredProductMarketConfig(defaultProductMarketConfigKey("agency")) ||
        readStoredProductMarketConfig(currentProductMarketConfigKey("agency_source")) ||
        readStoredProductMarketConfig(defaultProductMarketConfigKey("agency_source")) ||
        getAgencyBaseConfig(siteId)
    );
  }
  const clientBaseConfig = normalizeScopedConfig(
    scope,
    readClientTemplateProductMarketConfig()
  );
  if (scope !== "client" || !siteId || !clientBaseConfig) {
    return clientBaseConfig;
  }
  const rotatedDefaults = getRotatedThemeAndAvatarForSite(siteId);
  if (!rotatedDefaults) {
    return clientBaseConfig;
  }
  return normalizeScopedConfig(scope, {
    ...applyProductMarketTheme(clientBaseConfig, rotatedDefaults.themeKey),
    csAvatarId: rotatedDefaults.avatarId,
  });
}

function getInitialRestoreConfig(scope: ProductMarketScope, config: ExportableConfig | null) {
  return normalizeScopedConfig(scope, config) || buildFactoryInitialConfig(scope);
}

/**
 * A source workspace may contain a legacy snapshot written before catalogues
 * were scoped.  Rebase only headquarters and agency source once; client
 * source retains its website catalogue.  This guard also protects the page
 * while a parent layout is still hydrating its local template snapshot.
 */
function ensureWorkspaceCatalog(scope: ProductMarketScope, config: ExportableConfig) {
  if (scope === "client" || scope === "agency") return config;
  if (scope === "client_source") {
    // A first visit may still start from the factory fallback rather than a
    // stored source snapshot.  Run that fallback through the same shared
    // contract so it cannot expose only the old three content entries.
    return normalizeClientSourceContentContract(
      config.catalogScope === "client_source" ? config : { ...config, catalogScope: "client_source" }
    );
  }
  const baseline = buildFactoryInitialConfig(scope);
  const matchesBaseline =
    config.catalogScope === scope &&
    config.products.length === baseline.products.length &&
    config.products.every((product) => baseline.products.some((candidate) => candidate.path === product.path));
  if (matchesBaseline) return config;
  return {
    ...config,
    catalogScope: scope,
    products: baseline.products,
    productOrder: baseline.productOrder,
    customDefaultPaths: baseline.customDefaultPaths,
    customProducts: [],
  };
}

function getRotatedThemeAndAvatarForSite(siteId?: string | null) {
  return resolveRotatedPlanDefaultsForSite(siteId);
}

function normalizeModuleCategoryOrderForScope(
  scope: ProductMarketScope,
  order?: readonly string[] | null
) {
  const sourceCategoryKeys = SOURCE_WORKSPACE_GROUPS[scope]?.map((group) => group.key);
  return sourceCategoryKeys?.length
    ? normalizeSourceWorkspaceCategoryOrder(order, sourceCategoryKeys)
    : normalizeProductModuleCategoryOrder(order);
}

function getScopedNavigationDefaultPaths(scope: ProductMarketScope, products: ProductItem[]) {
  const groups = SOURCE_WORKSPACE_GROUPS[scope];
  if (!groups) {
    const productPaths = products.map((product) => product.path);
    const productPathSet = new Set(productPaths);
    const baselinePathSet = new Set<string>(PRODUCT_MODULE_BASELINE_PATHS);
    return [
      ...PRODUCT_MODULE_BASELINE_PATHS.filter((path) => productPathSet.has(path)),
      ...productPaths.filter((path) => !baselinePathSet.has(path)),
    ];
  }
  const paths = groups.flatMap((group) => group.paths);
  const known = new Set(paths);
  return [...paths.filter((path) => products.some((product) => product.path === path)), ...products.map((product) => product.path).filter((path) => !known.has(path))];
}

/**
 * The single factory baseline for Operations, Modules, Layout and Customer
 * Service. A first-time template chain and every factory restore start here.
 */
function buildFactoryInitialConfig(scope: ProductMarketScope = "client"): ExportableConfig {
  const factoryThemes = getFactoryBuiltinThemes();
  const roseTheme = factoryThemes.find((theme) => theme.key === "rose") || factoryThemes[0];
  const layoutStyle = {
    ...roseTheme.layout,
    siteSwitchLoadingCardBgColor:
      roseTheme.layout.siteSwitchLoadingCardBgColor || "#ffffff",
    siteSwitchLoadingCardTextColor:
      roseTheme.layout.siteSwitchLoadingCardTextColor ||
      roseTheme.layout.themePanelTextColor ||
      "#24111A",
    customerServiceLauncherBgColor:
      roseTheme.layout.customerServiceLauncherBgColor || "#ffffff",
    customerServiceLauncherIconColor:
      roseTheme.layout.customerServiceLauncherIconColor || "#2A0E1D",
    customerServicePanelBgColor:
      roseTheme.layout.customerServicePanelBgColor || "#ffffff",
    customerServicePanelHeaderBgColor:
      roseTheme.layout.customerServicePanelHeaderBgColor || "#A73D76",
    customerServicePanelHeaderTextColor:
      roseTheme.layout.customerServicePanelHeaderTextColor || "#ffffff",
    customerServiceAssistantMsgBgColor:
      roseTheme.layout.customerServiceAssistantMsgBgColor || "#ffffff",
    customerServiceAssistantMsgTextColor:
      roseTheme.layout.customerServiceAssistantMsgTextColor || "#24111A",
    customerServiceUserMsgBgColor:
      roseTheme.layout.customerServiceUserMsgBgColor || "#EA5C98",
    customerServiceUserMsgTextColor:
      roseTheme.layout.customerServiceUserMsgTextColor || "#330F22",
    customerServiceInputBorderColor:
      roseTheme.layout.customerServiceInputBorderColor || "#EA5C98",
    defaultDialogBgColor:
      roseTheme.layout.defaultDialogBgColor || "#FDEBF3",
    defaultDialogHeaderBgColor:
      roseTheme.layout.defaultDialogHeaderBgColor || "#8E2E62",
    defaultDialogPanelBgColor:
      roseTheme.layout.defaultDialogPanelBgColor || roseTheme.layout.defaultDialogBgColor || "#F8D9E7",
    defaultDialogContentBgColor:
      roseTheme.layout.defaultDialogContentBgColor || roseTheme.layout.contentBgColor || "#FFFFFF",
    defaultDialogHeaderTextColor:
      roseTheme.layout.defaultDialogHeaderTextColor || "#FFF9FC",
    defaultDialogButtonColor:
      roseTheme.layout.defaultDialogButtonColor || "#D94A87",
    defaultDialogButtonTextColor:
      roseTheme.layout.defaultDialogButtonTextColor || "#FFF8FC",
  };

  return {
    catalogScope: scope,
    products: getProductMarketCatalogProducts(scope)
      .map((product) => ({
      label: product.label,
      path: product.path,
      status: product.status,
      customLabel: product.customLabel,
      description: product.description,
      customStyle: product.customStyle ? { ...product.customStyle } : undefined,
      children: product.children?.map((child) => ({
        label: child.label,
        path: child.path,
        status: child.status,
        customLabel: child.customLabel,
        description: child.description,
        customStyle: child.customStyle ? { ...child.customStyle } : undefined,
      })),
    })),
    customDefaultPaths: getProductMarketCatalogDefaultPaths(scope),
    layoutStyle,
    layoutSections: DEFAULT_LAYOUT_SECTIONS.map((section) => ({ ...section })),
    customerServiceSections: DEFAULT_CUSTOMER_SERVICE_SECTIONS.map((section) => ({ ...section })),
    moduleActionOrder: ["module-table-toggle", "module-toggle", "restore", "save"],
    layoutActionOrder: ["theme-toggle", "theme-status", "restore", "save"],
    customerServiceActionOrder: ["collapse", "restore", "save"],
    activeTheme: roseTheme.key,
    productOrder: getScopedNavigationDefaultPaths(scope, getProductMarketCatalogProducts(scope)),
    moduleOrderBaselineVersion: PRODUCT_MODULE_BASELINE_VERSION,
    moduleCategoryOrder: PRODUCT_MODULE_CATEGORIES.map((category) => category.key),
    moduleCategoryAssignments: Object.fromEntries(
      PRODUCT_MODULE_CATEGORIES.flatMap((category) => category.paths.map((path) => [path, category.key] as const))
    ) as Record<string, string>,
    customThemes: [],
    builtinThemeOverrides: {},
    sidebarStyle: { ...roseTheme.sidebar },
    globalFontFamily: roseTheme.fontFamily || DEFAULT_DESIGN_FONT_STACK,
    globalFontWeight: roseTheme.layout.globalFontWeight || DEFAULT_DESIGN_FONT_WEIGHT,
    globalLetterSpacing: roseTheme.layout.globalLetterSpacing || DEFAULT_DESIGN_LETTER_SPACING,
    customProducts: [],
    soundEnabled: true,
    soundVolume: 0.5,
    soundStyle: "crisp",
    csAvatarId: "pro-female",
    csEnabled: true,
    csAvatarOverrides: {},
    customerServiceCustomized: false,
    layoutCustomized: false,
    layoutStructureCustomized: false,
    csVoiceEnabled: false,
    csVoiceGender: "female",
    csVoiceRate: DEFAULT_CUSTOMER_SERVICE_VOICE_RATE,
  };
}

function rebaseFactoryBlueprintConfig(scope: "client" | "client_source", config: ExportableConfig): ExportableConfig {
  const baseline = buildFactoryInitialConfig(scope);
  const savedByPath = new Map(config.products.map((product) => [product.path, product] as const));
  const baselinePaths = new Set(baseline.products.map((product) => product.path));
  const isSavedDefaultLabel = (customLabel?: string, savedLabel?: string) => {
    if (!customLabel) return false;
    const comparable = (value: string) => value.replace(/\s+/gu, "").toLocaleLowerCase();
    return Boolean(savedLabel && comparable(customLabel) === comparable(savedLabel))
      || isLegacyFactoryPlatformDefaultLabel(customLabel);
  };
  const shouldGraduatePilots = (config.moduleOrderBaselineVersion ?? 0) < PRODUCT_MODULE_BASELINE_VERSION;
  const products = baseline.products.map((base) => {
    const saved = savedByPath.get(base.path);
    if (!saved) return base;
    const savedChildren = new Map((saved.children || []).map((child) => [child.path, child] as const));
    return {
      ...base,
      status: shouldGraduatePilots && isFactoryPlatformGraduatedPilotPath(base.path) ? "active" : saved.status,
      customLabel: isSavedDefaultLabel(saved.customLabel, saved.label) ? undefined : saved.customLabel,
      description: saved.description || base.description,
      customStyle: saved.customStyle,
      children: base.children?.map((baseChild) => {
        const savedChild = savedChildren.get(baseChild.path);
        if (!savedChild) return baseChild;
        return {
          ...baseChild,
          status: savedChild.status,
          customLabel: isSavedDefaultLabel(savedChild.customLabel, savedChild.label) ? undefined : savedChild.customLabel,
          description: savedChild.description || baseChild.description,
          customStyle: savedChild.customStyle,
        };
      }),
    };
  });
  const customProducts = (config.customProducts || []).filter((product) =>
    !baselinePaths.has(product.path)
    && !isRetiredFactoryPlatformPrimaryPath(product.path)
    && !isLegacyFactoryPlatformDefaultLabel(product.label)
  );
  return {
    ...config,
    catalogScope: scope,
    products,
    productOrder: [...baseline.productOrder, ...customProducts.map((product) => product.path)],
    customProducts,
    customDefaultPaths: (config.customDefaultPaths || []).filter((path) => baselinePaths.has(path)),
    moduleOrderBaselineVersion: PRODUCT_MODULE_BASELINE_VERSION,
    moduleCategoryOrder: baseline.moduleCategoryOrder,
    moduleCategoryAssignments: {
      ...baseline.moduleCategoryAssignments,
      ...Object.fromEntries(
        Object.entries(config.moduleCategoryAssignments || {}).filter(([path]) => !baselinePaths.has(path)),
      ),
    },
  };
}

/* ---- Sortable Product Card with smooth animations ---- */
interface SortableCardProps {
  product: ReturnType<typeof useProductMarketStore.getState>["products"][number];
  isSelected: boolean;
  toggleSelect: (path: string) => void;
  setStatus: (path: string, status: ProductStatus) => void;
  getStatusBadge: (status: ProductStatus, colors: { bg: string; border: string; font: string; button: string; nameFont?: string }) => React.ReactNode;
  statusCardColors: Record<ProductStatus, { bg: string; border: string; font: string; button: string; nameFont?: string }>;
  categoryKey: string;
  showPrimaryIcon: boolean;
}

function getProductMarketStatusControlStyle(colors: { font: string; button: string }): React.CSSProperties {
  return {
    "--product-market-status-bg": colors.button,
    // “状态胶囊字” is an explicit shared-contract setting.  Do not silently
    // replace it with an automatic black/white fallback: the preview, the
    // card label and the operation button must all show the exact same value.
    "--product-market-status-text": colors.font,
    backgroundColor: colors.button,
    borderColor: colors.button,
    color: colors.font,
  } as React.CSSProperties;
}

/**
 * Product-market snapshots are persisted independently for every source and
 * tenant. Older snapshots can contain a retired status value (or omit the
 * field altogether). Rendering must remain available so the operator can
 * review and save the migrated configuration instead of losing the whole
 * workspace to one legacy record.
 */
function normalizeProductCardStatus(status: unknown): ProductStatus {
  return status === "inactive" || status === "hidden" || status === "active"
    ? status
    : "active";
}

function SortableProductCard({
  product,
  isSelected,
  toggleSelect,
  setStatus,
  getStatusBadge,
  statusCardColors,
  categoryKey,
  showPrimaryIcon,
}: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.path });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging
      ? "box-shadow 200ms ease, opacity 150ms ease"
      : transition || "transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 300ms ease, opacity 200ms ease",
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.92 : 1,
  };

  const defaultIconName = getDefaultProductModuleSecondaryIconName(product.path, displayProductLabel(product));
  const Icon = ICON_OPTIONS.find((o) => o.name === (product.customStyle?.iconName || defaultIconName))?.icon || product.icon;
  const customIconUrl = product.customStyle?.customIconUrl;
  const productStatus = normalizeProductCardStatus(product.status);
  const statusFactoryRole = productStatus === "active"
    ? "palette-primary"
    : productStatus === "inactive"
      ? "high-red"
      : "dark-gray";
  const isPlannedProduct = product.deliveryStatus === "planned";
  const statusColors = statusCardColors[productStatus] || statusCardColors.active;
  const displayLabel = displayProductLabel(product);
  // 栏目配置中的说明是运营市场和左侧导航共用的唯一文案来源。不要在
  // 运营卡片里再维护一份摘要，否则保存后的栏目说明会和实际入口脱节。
  const moduleDescription = sanitizeDisplayText(
    product.description,
    buildDefaultModuleDescription(displayLabel),
  );
  const moduleDescriptionTooltip = moduleDescription;
  const cardSurfaceStyle = {
    "--product-market-card-bg": statusColors.bg,
    "--product-market-card-border": statusColors.border,
    "--product-market-card-name-color": statusColors.nameFont || statusColors.font,
    backgroundColor: "var(--product-market-card-bg)",
    borderColor: "var(--product-market-card-border)",
    color: statusColors.nameFont || statusColors.font,
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        data-page-list-item
        data-product-market-card
        data-product-market-module-description={moduleDescription}
        data-product-market-module-description-source="modules"
        data-shared-ownership-key={buildSharedModuleOwnershipKey(product.path)}
        data-shared-category-key={categoryKey}
        data-shared-ownership-source="operations"
        data-shared-status-card={productStatus}
        data-shared-status-card-source="product-card-colors"
        data-shared-status-card-factory-role={statusFactoryRole}
        data-product-market-delivery-status={product.deliveryStatus}
        data-product-market-batch-selected={isSelected ? "true" : "false"}
        data-development-standard-frame-region="small-card"
        data-development-standard-frame-label="小卡片"
        className={`border transition-[background-color,border-color,box-shadow,color,opacity] duration-100 relative ${
          isDragging
            ? "shadow-2xl shadow-blue-500/30 ring-2 ring-blue-400 scale-[1.04] rotate-[1deg]"
            : "hover:shadow-lg hover:shadow-slate-900/40"
        } ${
          isSelected ? "ring-2 ring-[var(--tradepro-shared-selection-outline)] ring-offset-1 ring-offset-[var(--tradepro-panel-frame-bg)]" : ""
        } ${productStatus === "active" ? "" : "opacity-75"}`}
        style={cardSurfaceStyle}
      >
        <CardHeader className="px-4 pb-3 pt-4">
          <CardTitle data-product-market-card-heading className="flex min-h-8 items-center justify-between gap-3 text-sm font-semibold leading-none">
            <div data-product-market-card-heading-controls className="flex min-w-0 flex-1 items-center gap-2">
              <ContentPluginDragHandle
                {...attributes}
                {...listeners}
                data-product-market-card-drag-handle
                className="text-slate-400 hover:text-slate-200 touch-none"
              />
              <div
                data-product-market-card-select
                className="flex h-8 w-4 shrink-0 cursor-pointer items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelect(product.path);
                }}
              >
                <Checkbox
                  checked={isSelected}
                  className="pointer-events-none"
                />
              </div>
              {showPrimaryIcon ? <div
                data-product-market-card-icon
                className="flex h-8 w-8 shrink-0 items-center justify-center"
              >
                {customIconUrl ? (
                  <img src={customIconUrl} alt="" className="w-4 h-4 rounded object-contain" />
                ) : Icon ? (
                  <Icon
                    className="w-4 h-4"
                    style={{
                      color: "var(--tradepro-panel-list-text)",
                    }}
                  />
                ) : null}
              </div> : null}
              <span
                data-product-market-card-name
                data-product-market-card-description-trigger
                className="min-w-0 truncate leading-none"
                title={moduleDescriptionTooltip}
              >
                {displayLabel}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {getStatusBadge(productStatus, statusColors)}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex gap-2">
            <button
              type="button"
              data-product-market-status-control="active"
              data-shared-status-card-source="product-card-colors"
              data-shared-status-card-factory-role="palette-primary"
              data-product-market-maturity={isPlannedProduct ? "planned" : undefined}
              title={isPlannedProduct ? "开通栏目展示；规划标识仍保留，不代表能力已经交付" : "开通并显示在左侧导航"}
              className={`inline-flex items-center justify-center rounded-md text-xs h-9 px-3 flex-1 font-medium
                transition-[background-color,border-color,box-shadow,color,filter,opacity] duration-100
                active:scale-90 active:brightness-110
                hover:brightness-110
                disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:brightness-100
                ${
                  productStatus === "active"
                    ? "ring-2 ring-offset-1 ring-offset-slate-900 shadow-lg scale-[1.03]"
                    : "scale-100"
                }`}
              style={getProductMarketStatusControlStyle(statusCardColors.active)}
              onClick={(event) => {
                event.stopPropagation();
                if (isPlannedProduct) return;
                playClickSound("activate");
                setStatus(product.path, "active");
              }}
            >
              <Check className={`w-3 h-3 mr-1 transition-transform duration-300 ${productStatus === "active" ? "scale-110" : "scale-100"}`} />
              {isPlannedProduct ? "规划中" : "开通"}
            </button>
            <button
              type="button"
              data-product-market-status-control="inactive"
              data-shared-status-card-source="product-card-colors"
              data-shared-status-card-factory-role="high-red"
              className={`inline-flex items-center justify-center rounded-md text-xs h-9 px-3 flex-1 font-medium
                transition-[background-color,border-color,box-shadow,color,filter,opacity] duration-100
                active:scale-90 active:brightness-110
                hover:brightness-110
                ${
                  productStatus === "inactive"
                    ? "ring-2 ring-offset-1 ring-offset-slate-900 shadow-lg scale-[1.03]"
                    : "scale-100"
                }`}
              style={getProductMarketStatusControlStyle(statusCardColors.inactive)}
              onClick={(event) => {
                event.stopPropagation();
                playClickSound("deactivate");
                setStatus(product.path, "inactive");
              }}
            >
              <X className={`w-3 h-3 mr-1 transition-transform duration-300 ${productStatus === "inactive" ? "scale-110" : "scale-100"}`} />
              取消
            </button>
            <button
              type="button"
              data-product-market-status-control="hidden"
              data-shared-status-card-source="product-card-colors"
              data-shared-status-card-factory-role="dark-gray"
              className={`inline-flex items-center justify-center rounded-md text-xs h-9 px-3 flex-1 font-medium
                transition-[background-color,border-color,box-shadow,color,filter,opacity] duration-100
                active:scale-90 active:brightness-110
                hover:brightness-110
                ${
                  productStatus === "hidden"
                    ? "ring-2 ring-offset-1 ring-offset-slate-900 shadow-lg scale-[1.03]"
                    : "scale-100"
                }`}
              style={getProductMarketStatusControlStyle(statusCardColors.hidden)}
              onClick={(event) => {
                event.stopPropagation();
                playClickSound("hide");
                setStatus(product.path, "hidden");
              }}
            >
              <EyeOff className={`w-3 h-3 mr-1 transition-transform duration-300 ${productStatus === "hidden" ? "scale-110" : "scale-100"}`} />
              隐藏
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function markTempThemeAsCustomized(themeKey: ThemePresetKey | string) {
  return `${themeKey}__customized`;
}

function extractBaseThemeKey(themeKey: ThemePresetKey | string) {
  return String(themeKey).replace(/__customized$/, "");
}


function SortableLayoutSectionItem({
  section,
  index,
  total,
  editable,
  onChange,
  onMove,
  order,
  children,
}: {
  section: LayoutSectionConfig;
  index: number;
  total: number;
  editable: boolean;
  onChange: (updater: (current: LayoutSectionConfig) => LayoutSectionConfig) => void;
  onMove: (direction: "up" | "down") => void;
  order?: number;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });
  const displayOrder = order ?? index + 1;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging
      ? "box-shadow 180ms ease, opacity 150ms ease"
      : transition || "transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 220ms ease",
    opacity: isDragging ? 0.92 : 1,
    order,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
    >
      <Card
        data-page-list-item
        data-shared-large-card-surface="true"
        data-development-standard-frame-region="large-card"
        data-development-standard-frame-label="大卡片"
        data-responsive-structure-item="layout-section"
        data-shared-sortable-card
        data-sortable-dragging={isDragging ? "true" : "false"}
        className={`nav-3d-card layout-section-card ${isDragging ? "shadow-xl shadow-cyan-500/20 ring-1 ring-cyan-400/50" : ""}`}
      >
        <CardContent className="space-y-2 p-2.5 sm:space-y-3 sm:p-3">
          <div
            data-responsive-capacity-row="layout-section-editor"
            data-shared-layout-section-editor-capsule="single"
            data-shared-sortable-card-rail
            data-shared-sortable-capsule="single"
            className="adaptive-work-matrix-row layout-section-matrix-row"
          >
            <div data-responsive-capacity-primary data-layout-section-editor-segment="controls" className="adaptive-work-matrix-function layout-section-matrix-function">
              <ContentPluginSortToolbar
                order={displayOrder}
                sequence="ascending"
                canMoveUp={index > 0}
                canMoveDown={index < total - 1}
                onMoveUp={() => onMove("up")}
                onMoveDown={() => onMove("down")}
                dragButtonProps={{ ...attributes, ...listeners }}
              />
            </div>
            <div data-responsive-capacity-content className="adaptive-work-matrix-edit layout-section-matrix-edit">
              <div className="layout-section-matrix-fields">
                <div data-layout-section-editor-segment="title" className="min-w-0">
                  <Input
                    data-shared-large-card-text
                    data-layout-large-card-input="true"
                    aria-label="大卡片标题"
                    value={section.title}
                    readOnly={!editable}
                    onChange={(event) => onChange((current) => ({ ...current, title: event.target.value }))}
                    className={`h-8 sm:h-9 ${editable ? "" : "cursor-not-allowed"}`}
                  />
                </div>
                <div data-layout-section-editor-segment="description" className="min-w-0">
                  <Input
                    data-shared-large-card-text
                    data-layout-large-card-input="true"
                    aria-label="大卡片说明"
                    value={section.description}
                    readOnly={!editable}
                    onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))}
                    className={`h-8 sm:h-9 ${editable ? "" : "cursor-not-allowed"}`}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="layout-section-content">
            {children}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LayoutSectionCard({
  section,
  index,
  total,
  editable,
  onChange,
  onMove,
  order,
  children,
}: {
  section: LayoutSectionConfig;
  index: number;
  total: number;
  editable: boolean;
  onChange: (updater: (current: LayoutSectionConfig) => LayoutSectionConfig) => void;
  onMove: (direction: "up" | "down") => void;
  order?: number;
  children: React.ReactNode;
}) {
  return (
    <SortableLayoutSectionItem
      section={section}
      index={index}
      total={total}
      editable={editable}
      onChange={onChange}
      onMove={onMove}
      order={order}
    >
      {children}
    </SortableLayoutSectionItem>
  );
}

type TemplateHeaderActionId = "restore" | "theme-toggle" | "theme-status" | "collapse" | "module-table-toggle" | "module-toggle" | "save" | "close";

const DEFAULT_MODULE_HEADER_ACTION_ORDER: TemplateHeaderActionId[] = [
  "module-table-toggle",
  "module-toggle",
  "restore",
  "save",
];

const DEFAULT_LAYOUT_HEADER_ACTION_ORDER: TemplateHeaderActionId[] = [
  "theme-toggle",
  "theme-status",
  "restore",
  "save",
];

const DEFAULT_SERVICE_HEADER_ACTION_ORDER: TemplateHeaderActionId[] = [
  "collapse",
  "restore",
  "save",
];

const LEGACY_TEMPLATE_HEADER_ACTION_ORDERS: readonly string[][] = [
  ["restore", "module-toggle", "module-add", "save"],
  ["module-toggle", "module-add", "restore", "save"],
  ["restore", "theme-toggle", "theme-status", "save", "close"],
  ["restore", "collapse", "save", "close"],
];

function normalizeTemplateHeaderActionOrder(
  value: readonly string[] | undefined,
  defaults: readonly TemplateHeaderActionId[]
): TemplateHeaderActionId[] {
  const source = Array.isArray(value) ? value : [];
  const valid = new Set(defaults);
  const incoming = source.filter((id): id is TemplateHeaderActionId => valid.has(id as TemplateHeaderActionId));
  const isLegacyDefault = LEGACY_TEMPLATE_HEADER_ACTION_ORDERS.some(
    (legacyOrder) => source.length === legacyOrder.length && source.every((id, index) => id === legacyOrder[index])
  );
  if (isLegacyDefault) return [...defaults];
  return [...incoming, ...defaults.filter((id) => !incoming.includes(id))];
}

function SortableTemplateHeaderAction({
  id,
  children,
}: {
  id: TemplateHeaderActionId;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  // The save action must remain a reliable primary click target.  Binding the
  // pointer drag listener to its whole wrapper made a quick click compete with
  // DnD, while the footer's identical save flow has no drag listener at all.
  const dragListeners = id === "save" ? undefined : listeners;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...dragListeners}
      className={`template-config-action-item ${isDragging ? "is-dragging" : ""}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition || "transform 180ms ease, opacity 180ms ease",
      }}
      aria-label={id === "save" ? "保存设置" : "可拖拽调整操作顺序"}
    >
      {children}
    </div>
  );
}

/* ---- Main Component ---- */
/**
 * The only outer workspace for every Product Market route.
 *
 * Operations and the three settings routes deliberately share this exact DOM
 * boundary.  Route-specific content must stay inside it, instead of adding a
 * second dialog/workspace bridge that can reintroduce its own shadow, gutter
 * or scrollbar rules over the shared frame variables.
 */
const ProductMarketWorkspace = forwardRef<HTMLElement, SharedPageWorkspaceProps>(function ProductMarketWorkspace(
  { children, className, ...sectionProps },
  ref,
) {
  return (
    <SharedPageWorkspace
      ref={ref}
      {...sectionProps}
      data-product-market-workspace
      data-visual-layout-root="product-market"
      data-development-standard-subject="product-market"
      data-shared-contract-root={PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT.version}
      data-development-standard-frame-region="body"
      data-development-standard-frame-label={getLayoutFrameMarkerLabel("workspace")}
      data-development-standard-marker-placement={VERTICAL_CONTEXT_CAPSULE_CONTRACT.workspaceMarkerPlacement}
      className={className}
    >
      {children}
    </SharedPageWorkspace>
  );
});

type ProductMarketFactoryContract = {
  pageId: string;
  sourceScope: PageFactoryScope;
  template: PageFactoryTemplate;
};

interface ProductMarketSettingsHostProps {
  isRoutePage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locked: boolean;
  subview: string;
  routeClassName: string;
  dialogClassName: string;
  dialogStyle: CSSProperties;
  pageFactoryContract: ProductMarketFactoryContract;
  children: ReactNode;
}

/* The Product Market settings are routes when opened from the left navigation.
   They use ProductMarketWorkspace, the same single outer frame as Operations.
   Keep the real draggable dialog exclusively for the Card/Content sandbox. */
function ProductMarketSettingsHost({
  isRoutePage,
  open,
  onOpenChange,
  locked,
  subview,
  routeClassName,
  dialogClassName,
  dialogStyle,
  pageFactoryContract,
  children,
}: ProductMarketSettingsHostProps) {
  if (isRoutePage) {
    return (
      <FactoryPage
        pageId={pageFactoryContract.pageId}
        template={pageFactoryContract.template}
        sourceScope={pageFactoryContract.sourceScope}
        scrollContract="table-inner-60"
        asChild
        frameOwner="existing-workspace"
      >
        <ProductMarketWorkspace
          data-product-market-settings-route="true"
          data-template-layout-locked={locked ? "true" : "false"}
          data-product-market-subview={subview}
          data-product-market-layout-custom={subview === "layout" ? "true" : undefined}
          data-shared-layout-frame="true"
          className={routeClassName}
          aria-label="产品市场设置页面"
        >
          {children}
        </ProductMarketWorkspace>
      </FactoryPage>
    );
  }

  return (
    <Dialog open={open} modal onOpenChange={onOpenChange}>
      <DraggableDialogContent
        aria-describedby={undefined}
        data-shared-dialog-contract="development-workbench"
        data-shared-window-kind="workbench"
        showCloseButton={false}
        resizable
        minWidth={260}
        minHeight={180}
        className={dialogClassName}
        data-template-layout-locked={locked ? "true" : "false"}
        data-product-market-subview={subview}
        style={dialogStyle}
      >
        {children}
      </DraggableDialogContent>
    </Dialog>
  );
}











const BUILTIN_KEYS = new Set(BUILTIN_THEME_PRESETS.map((theme) => theme.key));
const PRODUCT_MARKET_REMOTE_HYDRATION_TIMEOUT_MS = 5_000;

function resolveProductMarketFactoryContract(pathname: string, search: string): ProductMarketFactoryContract {
  const sourceScope: PageFactoryScope = /^\/(?:zb\/agency-source|dl)(?:\/|$)/.test(pathname)
    ? "agency_source"
    : /^\/(?:zb\/client-source|kh)(?:\/|$)/.test(pathname)
      ? "client_source"
      : pathname.startsWith("/zb")
        ? "hq"
        : "client_source";
  const normalizedPath = pathname.replace(/^\/(?:zb\/agency-source|zb\/client-source|zb|dl|kh)(?=\/|$)/, "") || "/";
  const scopeId = sourceScope === "agency_source" ? "agency-source" : sourceScope === "client_source" ? "client-source" : "hq";
  const aliasIds: Record<string, string> = {
    "/kh-style-settings": "hq-client-style-settings",
    "/material-assets": "hq-material-assets",
    "/client-style-settings": "hq-client-source-style-settings",
    "/dl-style-settings": "hq-agency-style-settings",
    "/agency-style-settings": "hq-agency-source-style-settings",
  };
  const aliasId = aliasIds[normalizedPath];
  if (aliasId) return { pageId: aliasId, sourceScope, template: "reference" };

  const requestedTab = new URLSearchParams(search).get("tab");
  const tabSuffix = isProductMarketSubview(requestedTab) ? `-${requestedTab}` : "";
  // 产品市场是三端共享的源码编辑器，本身已由 SharedPageWorkspace、可视化
  // 契约和专用设置宿主管理内部区域。这里只把页面工厂能力合并到现有工作区，绝不为
  // 了凑普通页的卡片、表格或二级标题标记而伪造区域。
  return { pageId: `${scopeId}-product-market${tabSuffix}`, sourceScope, template: "reference" };
}

export default function ProductMarket() {
  const postPaintApplicationsReady = usePostPaintReady(500);
  useSharedOwnershipHighlightRuntime();
  const location = useLocation();
  const navigate = useNavigate();
  const pageFactoryContract = resolveProductMarketFactoryContract(location.pathname, location.search);
  const processedVisualCardHandoffsRef = useRef(new Set<string>());
  const productMarketSubview = resolveProductMarketNavTab(new URLSearchParams(location.search).get("tab"));
  const isDevelopmentGuide = productMarketSubview === "development";
  const isPlatformBlueprint = productMarketSubview === "blueprint";
  const templateSettingsSubview = productMarketSubview === "operations" || isDevelopmentGuide || isPlatformBlueprint ? null : productMarketSubview;
  const [sitePlanRevision, setSitePlanRevision] = useState(0);
  const scope = useMemo(() => getScopeFromPath(location.pathname), [location.pathname]);
  const isHQClientStyleSettings = location.pathname === "/zb/kh-style-settings";
  const isHQAgencyStyleSettings = location.pathname === "/zb/dl-style-settings";
  const isHQClientSourcePage = location.pathname.startsWith("/zb/client-source");
  const isHQAgencySourcePage = location.pathname.startsWith("/zb/agency-source");
  const isHQMaterialAssetsPage = location.pathname === "/zb/material-assets";
  const configScope = useMemo<ProductMarketScope>(() => {
    if (isHQClientStyleSettings) return "client_source";
    if (isHQAgencyStyleSettings) return "agency_source";
    return scope;
  }, [isHQAgencyStyleSettings, isHQClientStyleSettings, scope]);
  const scopeLabel = scopeLabels[configScope];
  const isCentralStyleSettingsPage = isHQClientStyleSettings || isHQAgencyStyleSettings || isHQClientSourcePage || isHQAgencySourcePage;
  const isRuntimePlanScope = configScope === "client" || configScope === "agency";
  const isSourceScope = configScope === "client_source" || configScope === "agency_source";
  // A source theme edits the shared source draft.  Its factory-default
  // baseline advances only after an immutable publish and full rollout.
  const isGlobalThemeSource = configScope === "hq" || isSourceScope;
  const shouldUseSharedClientStyle = configScope === "client" || configScope === "client_source";
  const shouldWriteSharedClientStyle = isHQClientStyleSettings;
  const shouldTrackClientCustomerServiceOverride = configScope === "client" && !isHQClientStyleSettings;
  const storedSelectedSiteId = useMemo(
    () => (!isCentralStyleSettingsPage && configScope === "client" ? resolveCurrentSiteId("client") : null),
    [configScope, isCentralStyleSettingsPage]
  );
  const currentSiteId = useMemo(
    () => resolveCurrentSiteId(configScope, location.search) || storedSelectedSiteId,
    [configScope, location.search, storedSelectedSiteId]
  );
  const websiteContentScopeId = useMemo(
    () => `${getAIBuilderScope(location.pathname)}:${new URLSearchParams(location.search).get("siteId") || "company-info-draft"}`,
    [location.pathname, location.search]
  );
  // All three source workspaces use the same Operations Market frame as the
  // Client Source. Their catalogues stay separate, but the header controls,
  // live theme preview, shared-frame actions and save/apply behaviour must not
  // drift into three different products.
  const isSourceOperationsWorkspace = configScope === "hq" || isHQAgencySourcePage || isHQClientSourcePage;
  const showSharedStyleControls = shouldUseSharedClientStyle || isSourceOperationsWorkspace;
  const showAgencyInheritanceCard = false;
  const isHQClientTemplateSource = location.pathname === "/zb/client-style-settings" || isHQClientSourcePage;
  const headerTitle = isHQClientStyleSettings
    ? "客户端设置"
    : configScope === "hq"
      ? "总部端开发工具"
    : isHQAgencyStyleSettings || isHQAgencySourcePage
      ? "代理源端开发工具"
    : isHQClientTemplateSource
        ? "客户源端开发工具"
        : configScope === "agency"
          ? "共业市场"
        : "产品市场";
  const headerDescription = isHQClientStyleSettings
    ? "集中管理三端统一生效的网站风格、配色主题、侧栏样式与全局字体。"
    : configScope === "hq"
      ? "维护总部平台应用、运营入口、栏目、版面、服务助手与外置开发工具；只作用于总部端。"
    : isHQAgencyStyleSettings || isHQAgencySourcePage
      ? "维护代理平台应用、运营入口、栏目、版面、服务助手与外置开发工具；发布后仅由代理端同步。"
    : isHQClientTemplateSource
      ? "维护客户网站应用、运营入口、栏目、版面、智能客服与音效；发布后仅由客户端或独立计划同步。"
      : configScope === "agency"
        ? "当前代理端读取代理源已安装版本；请在版本更新中安装总部发布的新版后生效。"
      : configScope === "client"
      ? "当前计划使用独立持久快照，可单独自定义网站风格、配色主题、侧栏样式与全局字体。"
        : "管理产品应用的开通、取消和隐藏状态，拖拽卡片可调整排序。";
  const workspaceTabPrefix = headerTitle === "产品市场" ? "产品市场" : headerTitle;
  // Source pages expose a breadcrumb, not just a generic product-market name.
  // The middle label is the source-specific market name chosen for the left
  // navigation, so the title always tells the operator both where they are and
  // which source they are changing.
  const sourceMarketLabel = configScope === "hq"
    ? "事业市场"
    : isHQAgencySourcePage
      ? "共业市场"
      : null;
  const sourceWorkspacePathPrefix = sourceMarketLabel || workspaceTabPrefix;
  // Product-market tabs are a stable product navigation path, even when the
  // current editor happens to be a source workspace.  Do not reuse the
  // source-developer label here: it makes the same tab read differently from
  // the client page and its configured navigation entry.
  const productMarketPathPrefix = isHQClientSourcePage ? "产品市场" : sourceWorkspacePathPrefix;
  const shouldUseSourceTitlePath = isHQClientSourcePage || configScope === "hq" || isHQAgencySourcePage;
  const shouldMergeProductMarketContext = isSourceOperationsWorkspace && location.pathname.endsWith("/product-market");
  const resolvedSiteScope = isCentralStyleSettingsPage ? "hq" : scope;
  const visibleSites = useMemo(
    () => getVisibleSitesByScope(resolvedSiteScope, currentSiteId),
    [resolvedSiteScope, currentSiteId]
  );
  const activeSite = useMemo(
    () => (currentSiteId && visibleSites.find((site) => site.id === currentSiteId)) || visibleSites[0] || null,
    [currentSiteId, visibleSites]
  );
  // The product-market route can be opened from any site plan.  Prefer the
  // explicit siteId in its URL over the source-page scope's fallback site.
  const selectedSitePlan = useMemo(
    () => (currentSiteId ? getSiteById(currentSiteId) : null) || activeSite,
    [activeSite, currentSiteId, sitePlanRevision]
  );
  const selectedSitePlanLabel = useMemo(() => {
    if (!selectedSitePlan) return "未绑定站点";
    return selectedSitePlan.planName || selectedSitePlan.planCode || resolveSiteDisplayName(
      selectedSitePlan,
      selectedSitePlan.id
    );
  }, [selectedSitePlan]);
  const sourceOperationsDescription = configScope === "hq"
    ? "应用范围：总部端全局应用 · 保存设置后立即生效。"
    : isHQAgencySourcePage
      ? "应用范围：代理源端模板 · 保存草稿并完成回读验证后发布新版，再由代理端同步。"
      : isHQClientSourcePage
        ? "应用范围：客户源端模板 · 保存草稿并回读后发布新版；全部客户端计划成功接收后才设为工厂默认。"
        : `站点计划：${selectedSitePlanLabel}`;
  const effectiveSiteId = isCentralStyleSettingsPage ? null : (activeSite?.id || currentSiteId || null);
  const isRuntimePlanPage = isRuntimePlanScope && !!effectiveSiteId && !isCentralStyleSettingsPage;
  const templateLifecycleRole = resolveProductMarketLifecycleRole(configScope, isRuntimePlanPage);
  const requiresRuntimePlanSelection = isRuntimePlanScope && !isCentralStyleSettingsPage && !effectiveSiteId;
  const runtimePlanSetupPath = configScope === "agency" ? "/dl/sites" : "/kh/projects";
  const showRestoreActions = (isCentralStyleSettingsPage || !isHQAgencyStyleSettings) && !requiresRuntimePlanSelection;
  const shouldPersistRuntimeSnapshotOnly = isRuntimePlanPage;
  const shouldSyncCustomizationFlagsWithSnapshot = showSharedStyleControls && !isCentralStyleSettingsPage;
  const siteSequenceMap = useMemo(
    () => getSiteSequenceMap(resolvedSiteScope, visibleSites),
    [resolvedSiteScope, visibleSites]
  );
  const {
    catalogScope,
    products,
    batchSetStatus,
    customDefaultPaths,
    setProductCustomStyle,
    setProductCustomLabel,
    layoutStyle,
    visualCardLayout,
    layoutSections,
    customerServiceSections,
    layoutActionOrder,
    customerServiceActionOrder,
    moduleActionOrder,
    moduleCategoryOrder,
    moduleCategoryAssignments,
    moduleCategoryStyles,
    moduleIconVisibility,
    setLayoutStyle,
    setLayoutSections,
    setCustomerServiceSections,
    activeTheme,
    applyTheme,
    productOrder,
    moduleOrderBaselineVersion,
    applyProductModuleBaseline,
    exportConfig,
    importConfig,
    customThemes,
    builtinThemeOverrides,
    addCustomTheme,
    updateCustomTheme,
    updateBuiltinTheme,
    getAllThemes,
    sidebarStyle,
    setSidebarStyle,
    globalFontFamily,
    setGlobalFontFamily,
    globalFontWeight,
    globalLetterSpacing,
    setGlobalFontWeight,
    setGlobalLetterSpacing,
    soundEnabled,
    soundVolume,
    soundStyle,
    setSoundEnabled,
    setSoundVolume,
    csVoiceEnabled,
    csVoiceGender,
    csVoiceRate,
    setCsVoiceEnabled,
    setCsVoiceGender,
    addProduct,
    customProducts,
    csAvatarId,
    setCsAvatarId,
    csEnabled,
    setCsEnabled,
    csAvatarOverrides,
    customerServiceCustomized,
    layoutCustomized,
    layoutStructureCustomized,
    setCustomerServiceCustomized,
    setLayoutCustomized,
    setLayoutStructureCustomized,
    setCsAvatarOverride,
    clearCsAvatarOverrideImage,
  } = useProductMarketStore(useShallow((state) => ({
    catalogScope: state.catalogScope,
    products: state.products,
    batchSetStatus: state.batchSetStatus,
    customDefaultPaths: state.customDefaultPaths,
    setProductCustomStyle: state.setProductCustomStyle,
    setProductCustomLabel: state.setProductCustomLabel,
    layoutStyle: state.layoutStyle,
    visualCardLayout: state.visualCardLayout,
    layoutSections: state.layoutSections,
    customerServiceSections: state.customerServiceSections,
    layoutActionOrder: state.layoutActionOrder,
    customerServiceActionOrder: state.customerServiceActionOrder,
    moduleActionOrder: state.moduleActionOrder,
    moduleCategoryOrder: state.moduleCategoryOrder,
    moduleCategoryAssignments: state.moduleCategoryAssignments,
    moduleCategoryStyles: state.moduleCategoryStyles,
    moduleIconVisibility: state.moduleIconVisibility,
    setLayoutStyle: state.setLayoutStyle,
    setLayoutSections: state.setLayoutSections,
    setCustomerServiceSections: state.setCustomerServiceSections,
    activeTheme: state.activeTheme,
    applyTheme: state.applyTheme,
    productOrder: state.productOrder,
    moduleOrderBaselineVersion: state.moduleOrderBaselineVersion,
    applyProductModuleBaseline: state.applyProductModuleBaseline,
    exportConfig: state.exportConfig,
    importConfig: state.importConfig,
    customThemes: state.customThemes,
    builtinThemeOverrides: state.builtinThemeOverrides,
    addCustomTheme: state.addCustomTheme,
    updateCustomTheme: state.updateCustomTheme,
    updateBuiltinTheme: state.updateBuiltinTheme,
    getAllThemes: state.getAllThemes,
    sidebarStyle: state.sidebarStyle,
    setSidebarStyle: state.setSidebarStyle,
    globalFontFamily: state.globalFontFamily,
    setGlobalFontFamily: state.setGlobalFontFamily,
    globalFontWeight: state.globalFontWeight,
    globalLetterSpacing: state.globalLetterSpacing,
    setGlobalFontWeight: state.setGlobalFontWeight,
    setGlobalLetterSpacing: state.setGlobalLetterSpacing,
    soundEnabled: state.soundEnabled,
    soundVolume: state.soundVolume,
    soundStyle: state.soundStyle,
    setSoundEnabled: state.setSoundEnabled,
    setSoundVolume: state.setSoundVolume,
    csVoiceEnabled: state.csVoiceEnabled,
    csVoiceGender: state.csVoiceGender,
    csVoiceRate: state.csVoiceRate,
    setCsVoiceEnabled: state.setCsVoiceEnabled,
    setCsVoiceGender: state.setCsVoiceGender,
    addProduct: state.addProduct,
    customProducts: state.customProducts,
    csAvatarId: state.csAvatarId,
    setCsAvatarId: state.setCsAvatarId,
    csEnabled: state.csEnabled,
    setCsEnabled: state.setCsEnabled,
    csAvatarOverrides: state.csAvatarOverrides,
    customerServiceCustomized: state.customerServiceCustomized,
    layoutCustomized: state.layoutCustomized,
    layoutStructureCustomized: state.layoutStructureCustomized,
    setCustomerServiceCustomized: state.setCustomerServiceCustomized,
    setLayoutCustomized: state.setLayoutCustomized,
    setLayoutStructureCustomized: state.setLayoutStructureCustomized,
    setCsAvatarOverride: state.setCsAvatarOverride,
    clearCsAvatarOverrideImage: state.clearCsAvatarOverrideImage,
  })));

  const [showDefaultDialog, setShowDefaultDialog] = useState(false);
  const [defaultDialogBaselineReady, setDefaultDialogBaselineReady] = useState(false);
  const defaultDialogBaselineReadyRef = useRef(false);
  const [visualPageEditorOpen, setVisualPageEditorOpen] = useState(false);
  const [visualPageEditorInitialApplicationScope, setVisualPageEditorInitialApplicationScope] = useState<VisualPageEditorInitialApplicationScope>("current-page");
  const [visualPageEditorApplicationScopeLock, setVisualPageEditorApplicationScopeLock] = useState<VisualPageEditorInitialApplicationScope | undefined>();
  const [sourceActionDialog, setSourceActionDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    busyLabel: string;
    cancelLabel: string;
    onConfirm: null | (() => Promise<void> | void);
    onCancel: null | (() => Promise<void> | void);
    minimumBusyMs: number;
    showBusyState: boolean;
  }>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "确认执行",
    busyLabel: "执行中...",
    cancelLabel: "取消",
    onConfirm: null,
    onCancel: null,
    minimumBusyMs: 3000,
    showBusyState: true,
  });
  const [defaultDialogViewportWidth, setDefaultDialogViewportWidth] = useState(1380);
  // 二级栏目数量会随配置增长。初次进入保持收起，避免一次挂载全部子项
  // 造成“栏目配置”首屏卡顿；用户仍可逐项或通过表头一次展开。
  const [expandedModulePaths, setExpandedModulePaths] = useState<string[]>([]);
  const [visibleModuleGroupCount, setVisibleModuleGroupCount] = useState(2);
  const [visibleOperationGroupCount, setVisibleOperationGroupCount] = useState(2);
  const [settingsMobileHeaderExpanded, setSettingsMobileHeaderExpanded] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  // Direct second-level routes must start on their own tab.  Beginning every
  // route on “modules” briefly built the module draft before layout/service
  // switched it in a layout effect, which added avoidable work to first paint.
  const initialSettingsTab = templateSettingsSubview === "layout" || templateSettingsSubview === "service" || templateSettingsSubview === "modules"
    ? templateSettingsSubview
    : "modules";
  const [settingsTab, setSettingsTab] = useState(initialSettingsTab);
  const activeSettingsTab = templateSettingsSubview === "layout" || templateSettingsSubview === "service" || templateSettingsSubview === "modules"
    ? templateSettingsSubview
    : settingsTab;
  const [templateLayoutLockRevision, setTemplateLayoutLockRevision] = useState(0);
  const productMarketHardLocked = useMemo(
    () => isRouteCompletedPageHardLocked(location.pathname, location.search),
    [location.pathname, location.search, templateLayoutLockRevision],
  );
  const productMarketSourceLocked = useMemo(() => {
    const routeLock = resolveCompletedLayoutLock(location.pathname, location.search);
    return routeLock ? isCompletedSourceLocked(routeLock) : false;
  }, [location.pathname, location.search, templateLayoutLockRevision]);
  const productMarketWriteLocked = productMarketHardLocked || productMarketSourceLocked;
  const [servicePanelCollapsed, setServicePanelCollapsed] = useState(false);
  const [presetThemeCollapsed, setPresetThemeCollapsed] = useState(false);
  const [moduleTableHeaderCollapsed, setModuleTableHeaderCollapsed] = useState(false);
  const [soundPreviewVolume, setSoundPreviewVolume] = useState<number | null>(null);
  const [avatarPreviewMap, setAvatarPreviewMap] = useState<Record<string, { url: string; kind: "image" | "video" }>>({});
  const [avatarVoicePreview, setAvatarVoicePreview] = useState<CustomerServiceVoicePreviewMap>({});
  const [avatarSoundPreview, setAvatarSoundPreview] = useState<CustomerServiceReminderPreviewMap>({});
  const [materialAssets, setMaterialAssets] = useState<StoredMaterialAssetItem[]>([]);
  const [materialAssetsLoading, setMaterialAssetsLoading] = useState(false);
  const [materialAssetsUploading, setMaterialAssetsUploading] = useState(false);
  const [remoteSnapshotHydrated, setRemoteSnapshotHydrated] = useState(false);
  const productMarketRootRef = useRef<HTMLDivElement>(null);

  const [materialAssetsBusyId, setMaterialAssetsBusyId] = useState<string | null>(null);
  const [materialAssetReplaceTarget, setMaterialAssetReplaceTarget] = useState<StoredMaterialAssetItem | null>(null);
  const confirmedMaterialReplacementRef = useRef<string | null>(null);
  const applyExistingMaterialAssetRef = useRef<(asset: StoredMaterialAssetItem) => Promise<void>>(async () => undefined);
  const [materialAssetDimensions, setMaterialAssetDimensions] = useState<Record<string, string>>({});
  const [materialAssetDurations, setMaterialAssetDurations] = useState<Record<string, string>>({});
  const [materialPickerTarget, setMaterialPickerTarget] = useState<MaterialPickerTarget | null>(null);
  const [avatarMaterialGenderFilter, setAvatarMaterialGenderFilter] = useState<AvatarMaterialGenderFilter>("all");
  const [audioMaterialCategory, setAudioMaterialCategory] = useState<AudioMaterialCategory>("all");

  const activeTemplateLayoutLock = (activeSettingsTab === "layout"
    ? "tool:product-market:layout"
    : activeSettingsTab === "service"
      ? "tool:product-market:service"
      : "tool:product-market:modules") as CompletedLayoutLock;
  const templateLayoutLocked = useMemo(
    () => isCompletedLayoutLocked(activeTemplateLayoutLock),
    [activeTemplateLayoutLock, templateLayoutLockRevision],
  );
  const templateSourceLocked = useMemo(
    () => isCompletedSourceLocked(activeTemplateLayoutLock),
    [activeTemplateLayoutLock, templateLayoutLockRevision],
  );

  useEffect(() => {
    const refreshTemplateLayoutLock = () => {
      setTemplateLayoutLockRevision((revision) => revision + 1);
      const routeLock = resolveCompletedLayoutLock(location.pathname, location.search);
      if (isRouteCompletedPageHardLocked(location.pathname, location.search) || (routeLock && isCompletedSourceLocked(routeLock))) {
        setVisualPageEditorOpen(false);
      }
    };
    window.addEventListener(PAGE_LAYOUT_LOCK_EVENT, refreshTemplateLayoutLock);
    return () => window.removeEventListener(PAGE_LAYOUT_LOCK_EVENT, refreshTemplateLayoutLock);
  }, [location.pathname, location.search]);

  useEffect(() => {
    setVisualPageEditorOpen(false);
    setVisualPageEditorInitialApplicationScope("current-page");
    setVisualPageEditorApplicationScopeLock(undefined);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleVisualPageEditorOpen = (event: Event) => {
      const detail = (event as CustomEvent<VisualPageEditorOpenDetail>).detail;
      if (detail?.pathname && detail.pathname !== location.pathname) return;
      if (detail?.search && detail.search !== location.search) return;
      const routeLock = resolveCompletedLayoutLock(location.pathname, location.search);
      if (isRouteCompletedPageHardLocked(location.pathname, location.search) || (routeLock && isCompletedSourceLocked(routeLock))) return;
      setVisualPageEditorInitialApplicationScope(detail?.initialApplicationScope ?? "current-page");
      setVisualPageEditorApplicationScopeLock(detail?.applicationScopeLock);
      setVisualPageEditorOpen(true);
    };
    window.addEventListener(VISUAL_PAGE_EDITOR_OPEN_EVENT, handleVisualPageEditorOpen);
    return () => window.removeEventListener(VISUAL_PAGE_EDITOR_OPEN_EVENT, handleVisualPageEditorOpen);
  }, [location.pathname, location.search]);

  const toggleTemplateColumnLock = useCallback(() => {
    setCompletedLayoutLocked(activeTemplateLayoutLock, !templateLayoutLocked, "footer");
  }, [activeTemplateLayoutLock, templateLayoutLocked]);

  const toggleTemplatePageLock = useCallback(() => {
    setCompletedPageHardLocked(activeTemplateLayoutLock, !productMarketHardLocked, "footer");
  }, [activeTemplateLayoutLock, productMarketHardLocked]);

  const toggleTemplateSourceLock = useCallback(async () => {
    const nextLocked = !templateSourceLocked;
    try {
      await syncSourcePageLock(activeTemplateLayoutLock, nextLocked);
      setCompletedSourceLocked(activeTemplateLayoutLock, nextLocked, "footer");
    } catch (error) {
      const message = error instanceof Error ? error.message : "源码锁登记失败";
      toast.error(`未改变源码锁：${message}`);
    }
  }, [activeTemplateLayoutLock, templateSourceLocked]);

  const openSourceActionDialog = useCallback((config: {
    title: string;
    description: string;
    confirmLabel: string;
    busyLabel: string;
    onConfirm: () => Promise<void> | void;
    cancelLabel?: string;
    onCancel?: () => Promise<void> | void;
    minimumBusyMs?: number;
    showBusyState?: boolean;
  }) => {
    setSourceActionDialog({
      open: true,
      title: config.title,
      description: config.description,
      confirmLabel: config.confirmLabel,
      busyLabel: config.busyLabel,
      cancelLabel: config.cancelLabel || "取消",
      onConfirm: config.onConfirm,
      onCancel: config.onCancel || null,
      minimumBusyMs: config.minimumBusyMs ?? 3000,
      showBusyState: config.showBusyState ?? true,
    });
  }, []);

  const closeSourceActionDialog = useCallback(() => {
    setSourceActionDialog((current) => ({
      ...current,
      open: false,
      onConfirm: null,
      onCancel: null,
    }));
  }, []);

  // Temp state for editing in dialog
  const [tempProducts, setTempProducts] = useState<EditableModuleItem[]>(() => buildEditableProducts(products));
  const [tempModuleCategoryOrder, setTempModuleCategoryOrder] = useState<string[]>(() => normalizeModuleCategoryOrderForScope(configScope, moduleCategoryOrder));
  const [tempModuleCategoryAssignments, setTempModuleCategoryAssignments] = useState<Record<string, string>>(() => ({ ...moduleCategoryAssignments }));
  const [tempModuleCategoryStyles, setTempModuleCategoryStyles] = useState(() => ({ ...moduleCategoryStyles }));
  // Status buttons are intentionally draft edits until the user saves.  Keep
  // their latest values outside a render closure as well: the confirmation
  // dialog can outlive the render that opened it, and must never serialize an
  // older status back over a newly selected “开通 / 取消 / 隐藏” value.
  const pendingOperationStatusRef = useRef<Record<string, ProductStatus>>({});
  const moduleWorkspaceActive = productMarketSubview === "modules"
    || (!templateSettingsSubview && showDefaultDialog && activeSettingsTab === "modules");
  const operationsCatalogActive = productMarketSubview === "operations" || moduleWorkspaceActive;
  const serviceWorkspaceActive = productMarketSubview === "service"
    || (!templateSettingsSubview && showDefaultDialog && activeSettingsTab === "service");
  const expertAvatarWorkspaceActive = serviceWorkspaceActive || operationsCatalogActive;
  const expandableModulePaths = operationsCatalogActive
    ? tempProducts.filter((product) => product.children.length > 0).map((product) => product.path)
    : [];
  const areAllModuleChildrenExpanded = expandableModulePaths.length > 0 && expandableModulePaths.every((path) => expandedModulePaths.includes(path));
  const groupedModuleProducts = useMemo(() => {
    if (!operationsCatalogActive) return [];
    const sourceGroups = SOURCE_WORKSPACE_GROUPS[configScope];
    if (sourceGroups) {
      const sourcePathSet = new Set(sourceGroups.flatMap((group) => group.paths));
      const sourceCategoryOrder = normalizeSourceWorkspaceCategoryOrder(
        tempModuleCategoryOrder,
        sourceGroups.map((group) => group.key)
      );
      const grouped = [...sourceGroups]
        .sort((left, right) => sourceCategoryOrder.indexOf(left.key) - sourceCategoryOrder.indexOf(right.key))
        .map((group) => ({
        key: group.key,
        label: group.label,
        items: group.paths
          .map((path) => tempProducts.find((product) => product.path === path))
          .filter((product): product is EditableModuleItem => Boolean(product)),
      }));
      const ungrouped = tempProducts.filter((product) => !sourcePathSet.has(product.path));
      return ungrouped.length
        ? [...grouped, { key: "uncategorized", label: "未分类", items: ungrouped }]
        : grouped;
    }
    const orderedCategoryKeys = normalizeProductModuleCategoryOrder(tempModuleCategoryOrder);
    const grouped = orderedCategoryKeys
      .map((key) => {
        const category = PRODUCT_MODULE_CATEGORIES.find((candidate) => candidate.key === key);
        if (!category) return null;
        return {
          key: category.key,
          label: category.label,
          items: [] as EditableModuleItem[],
        };
      })
      .filter(Boolean) as Array<{ key: string; label: string; items: EditableModuleItem[] }>;
    const groupedIndex = new Map(grouped.map((group) => [group.key, group] as const));

    for (const product of tempProducts) {
      const category = getProductModuleCategoryByPath(product.path, tempModuleCategoryAssignments);
      if (category?.key) {
        groupedIndex.get(category.key)?.items.push(product);
      }
    }

    const usedPaths = new Set(grouped.flatMap((group) => group.items.map((product) => product.path)));
    const uncategorized = tempProducts.filter((product) => !usedPaths.has(product.path));

    if (!uncategorized.length) return grouped;

    const existingUncategorizedGroup = grouped.find((group) => group.key === "uncategorized");
    if (existingUncategorizedGroup) {
      existingUncategorizedGroup.items.push(...uncategorized);
      return grouped;
    }

    return [
      ...grouped,
      {
        key: "uncategorized",
        label: "未分类",
        items: uncategorized,
      },
    ];
  }, [configScope, operationsCatalogActive, tempModuleCategoryAssignments, tempModuleCategoryOrder, tempProducts]);

  useEffect(() => {
    if (!moduleWorkspaceActive) {
      setVisibleModuleGroupCount(2);
      return;
    }
    const total = groupedModuleProducts.length;
    setVisibleModuleGroupCount(Math.min(2, total));
  }, [groupedModuleProducts.length, moduleWorkspaceActive]);

  const allowModuleCategoryReorder = configScope === "hq"
    || configScope === "agency_source"
    || configScope === "client_source";
  const categoryItemOrderMap = useMemo(() => new Map<string, EditableModuleItem[]>(groupedModuleProducts.map((group) => [group.key, group.items])), [groupedModuleProducts]);
  const moduleTopLevelDragIds = useMemo(() =>
    groupedModuleProducts.flatMap((group) => [
      ...(allowModuleCategoryReorder ? [encodeModuleCategorySortId(group.key)] : []),
      ...group.items.map((product) => product.path),
    ]),
  [allowModuleCategoryReorder, groupedModuleProducts]);

  const flattenedModuleProductPaths = useMemo(() => groupedModuleProducts.flatMap((group) => group.items.map((product) => product.path)), [groupedModuleProducts]);
  const categoryOrderIndexMap = useMemo(() => {
    const sourceGroups = SOURCE_WORKSPACE_GROUPS[configScope];
    return sourceGroups
      ? buildSourceWorkspaceCategoryDisplayOrderMap(tempModuleCategoryOrder, sourceGroups.map((group) => group.key))
      : buildProductModuleCategoryDisplayOrderMap(tempModuleCategoryOrder);
  }, [configScope, tempModuleCategoryOrder]);
  const pathToCategoryKeyMap = useMemo(() => {
    const mapping = new Map<string, string>();
    for (const product of tempProducts) {
      const category = getProductModuleCategoryByPath(product.path, tempModuleCategoryAssignments);
      if (category?.key) {
        mapping.set(product.path, category.key);
      }
    }
    return mapping;
  }, [tempModuleCategoryAssignments, tempProducts]);
  const moduleRenderOrderByPath = useMemo(() => {
    const mapping = new Map<string, number>();
    let renderIndex = 1;
    groupedModuleProducts.forEach((group) => {
      group.items.forEach((product) => {
        mapping.set(product.path, renderIndex);
        renderIndex += 1;
      });
    });
    return mapping;
  }, [groupedModuleProducts]);
  const [tempLayout, setTempLayout] = useState<LayoutCustomStyle>(layoutStyle);
  const tempLayoutThemeTokens = resolveGlobalThemeTokens(tempLayout, sidebarStyle);
  const [tempLayoutSections, setTempLayoutSections] = useState<LayoutSectionConfig[]>(() => layoutSections.map((section) => ({ ...section })));
  const [tempCustomerServiceSections, setTempCustomerServiceSections] = useState<CustomerServiceSectionConfig[]>(
    () => (customerServiceSections?.length ? customerServiceSections : DEFAULT_CUSTOMER_SERVICE_SECTIONS).map((section) => ({ ...section }))
  );
  const [tempLayoutActionOrder, setTempLayoutActionOrder] = useState<TemplateHeaderActionId[]>(() =>
    normalizeTemplateHeaderActionOrder(layoutActionOrder, DEFAULT_LAYOUT_HEADER_ACTION_ORDER)
  );
  const [tempCustomerServiceActionOrder, setTempCustomerServiceActionOrder] = useState<TemplateHeaderActionId[]>(() =>
    normalizeTemplateHeaderActionOrder(customerServiceActionOrder, DEFAULT_SERVICE_HEADER_ACTION_ORDER)
  );
  const [tempModuleActionOrder, setTempModuleActionOrder] = useState<TemplateHeaderActionId[]>(() =>
    normalizeTemplateHeaderActionOrder(moduleActionOrder, DEFAULT_MODULE_HEADER_ACTION_ORDER)
  );
  const [tempTheme, setTempTheme] = useState<ThemePresetKey | string>(activeTheme);
  const [tempCsAvatarTextOverrides, setTempCsAvatarTextOverrides] = useState<Record<string, { displayName: string; greetingText: string }>>({});
  const defaultDialogConfigSnapshotRef = useRef<ExportableConfig | null>(null);
  const defaultDialogDraftBaselineRef = useRef<ExportableConfig | null>(null);
  const defaultDialogVerifiedSignatureRef = useRef<string | null>(null);
  const defaultDialogProductsBaselineSignatureRef = useRef<string | null>(null);
  const tempProductsSignature = useMemo(() => JSON.stringify(tempProducts), [tempProducts]);
  const saveOperationInFlightRef = useRef(false);

  // Custom theme creation/editing
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [themeEditorVisited, setThemeEditorVisited] = useState(false);
  const [editingThemeKey, setEditingThemeKey] = useState<string | null>(null);
  const [themeForm, setThemeForm] = useState<CustomThemeData>({
    key: "",
    name: "",
    description: "",
    fontFamily: DEFAULT_DESIGN_FONT_STACK,
    layout: {
      headerBgColor: "#0F2A22",
      headerTextColor: "#F4FFF9",
      footerBgColor: "#123328",
      footerTextColor: "#E9FFF5",
      contentBgColor: "#00FFCC",
      contentTextColor: "#102019",
      clientTopbarBgColor: "#173A2E",
      clientTopbarTextColor: "#F4FFF9",
      clientSecondaryPageBgColor: "#F1F8F4",
      clientSecondaryPageTextColor: "#102019",
      clientSecondaryTitleBgColor: "#245A47",
      clientSecondaryTitleTextColor: "#F6FFFA",
      clientSecondaryListBgColor: "#FFFFFF",
      clientSecondaryListTextColor: "#102019",
      themePanelBgColor: "#14b8a6",
      themePanelTextColor: "#F4FFF9",
      themePanelButtonColor: "#38D38E",
      headerButtonTextColor: "#ffffff",
      footerAccentColor: "#38D38E",
      siteSwitchLoadingCardBgColor: "#DDEFE5",
      siteSwitchLoadingCardTextColor: "#102019",
      defaultDialogBgColor: "#EDF6F1",
      defaultDialogHeaderBgColor: "#245A47",
      defaultDialogPanelBgColor: "#D7ECE1",
      defaultDialogContentBgColor: "#FFFFFF",
      defaultDialogHeaderTextColor: "#000000",
      defaultDialogButtonColor: "#2FB977",
      defaultDialogButtonTextColor: "#F8FFFC",
      globalFontWeight: DEFAULT_DESIGN_FONT_WEIGHT,
      globalLetterSpacing: DEFAULT_DESIGN_LETTER_SPACING,
    },
    sidebar: getDefaultSidebarStyle(),
    cardActive: { bg: "rgba(56,211,142,0.26)", border: "#38D38E", font: "#102019", button: "#38D38E", nameFont: "#102019" },
    cardInactive: { bg: "rgba(28,67,54,0.14)", border: "#7ACBA5", font: "#102019", button: "#7ACBA5", nameFont: "#102019" },
    cardHidden: { bg: "rgba(21,54,43,0.10)", border: "#2FB977", font: "#102019", button: "#2FB977", nameFont: "#102019" },
  });

  // Add product dialog state

  // Theme hover preview state
  const [previewTheme, setPreviewTheme] = useState<ThemePresetKey | null>(null);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewRootVariablesRef = useRef<Record<string, string> | null>(null);
  const csAvatarUploadRef = useRef<HTMLInputElement>(null);
  const csFemaleVoiceUploadRef = useRef<HTMLInputElement>(null);
  const csMaleVoiceUploadRef = useRef<HTMLInputElement>(null);
  const csSoundUploadRef = useRef<HTMLInputElement>(null);
  const pendingCustomerServiceUploadTargetRef = useRef<CustomerServiceUploadTarget | null>(null);
  const materialAssetsUploadRef = useRef<HTMLInputElement>(null);
  const materialAssetReplaceUploadRef = useRef<HTMLInputElement>(null);
  const defaultDialogViewportRef = useRef<HTMLDivElement | null>(null);
  const loadedScopeRef = useRef<ProductMarketScope | null>(null);
  const inheritedSignatureRef = useRef("");
  const appliedConfigSignatureRef = useRef("");
  const avatarPreviewLoadSnapshotRef = useRef<{
    plan: CustomerServiceAvatarPreviewPlanEntry[];
    revision: number;
  }>({ plan: [], revision: 0 });
  const skipNextPersistRef = useRef(true);
  const [selectedFemaleVoicePreviewUrl, setSelectedFemaleVoicePreviewUrl] = useState<string | null>(null);
  const [selectedMaleVoicePreviewUrl, setSelectedMaleVoicePreviewUrl] = useState<string | null>(null);
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const materialAssetPreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const reminderSoundChoiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const voicePreviewRequestRevisionRef = useRef(0);
  const voicePreviewIntentKeyRef = useRef<string | null>(null);
  const [activeVoicePreviewKey, setActiveVoicePreviewKey] = useState<string | null>(null);
  const [activeMaterialAssetPreviewId, setActiveMaterialAssetPreviewId] = useState<string | null>(null);

  // Drag state for overlay
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const savedProductByPath = useMemo(
    () => new Map(products.map((product) => [product.path, product] as const)),
    [products]
  );
  const tempProductByPath = useMemo(
    () => new Map(tempProducts.map((product) => [product.path, product] as const)),
    [tempProducts]
  );
  const operationDraftProducts = useMemo(
    () =>
      products.map((product) => {
        const draft = tempProductByPath.get(product.path);
        if (!draft) return product;
        // Operations is intentionally an editable workspace. Its draft is
        // synchronised from the catalogue whenever the catalogue changes,
        // while this priority lets a just-confirmed batch status render in
        // the same frame rather than briefly reverting to the prior value.
        const pendingStatus = pendingOperationStatusRef.current[product.path];
        return {
          ...product,
          status: pendingStatus ?? draft.status ?? product.status,
          customStyle: { ...product.customStyle, ...draft.customStyle },
        };
      }),
    [products, tempProductByPath]
  );
  const allPaths = useMemo(() => operationDraftProducts.map((p) => p.path), [operationDraftProducts]);
  const isAllSelected = selectedPaths.length === operationDraftProducts.length && operationDraftProducts.length > 0;
  const hasSelection = selectedPaths.length > 0;
  const hasActivatableSelection = hasSelection;
  const pendingOperationStatusCount = useMemo(
    () =>
      operationDraftProducts.filter((product) => savedProductByPath.get(product.path)?.status !== product.status).length,
    [operationDraftProducts, savedProductByPath]
  );
  const operationDraftProductByPath = useMemo(() => {
    const map = new Map<string, ReturnType<typeof useProductMarketStore.getState>["products"][number]>();
    for (const product of operationDraftProducts) {
      map.set(product.path, product);
    }
    return map;
  }, [operationDraftProducts]);
  const effectiveModuleGroups = useMemo(
    () => projectProductMarketCategoryGroups(groupedModuleProducts, operationDraftProductByPath),
    [groupedModuleProducts, operationDraftProductByPath],
  );
  const effectiveModuleDragIds = useMemo(
    () => effectiveModuleGroups.flatMap((group) => group.items.map((product) => product.path)),
    [effectiveModuleGroups]
  );
  const renderableOperationGroups = useMemo(
    () => effectiveModuleGroups.filter((group) => group.items.length > 0),
    [effectiveModuleGroups],
  );

  useEffect(() => {
    if (productMarketSubview !== "operations") {
      setVisibleOperationGroupCount(2);
      return;
    }
    const total = renderableOperationGroups.length;
    setVisibleOperationGroupCount(Math.min(2, total));
  }, [productMarketSubview, renderableOperationGroups.length]);

  const selectedPathSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);
  const allThemes = getAllThemes();

  const previewThemePreset = useMemo(
    () => (previewTheme ? allThemes.find((theme) => theme.key === previewTheme) || null : null),
    [allThemes, previewTheme]
  );

  // Compute the effective layout style for preview.
  const effectiveLayoutStyle = useMemo(() => {
    if (previewThemePreset) {
      return {
        ...previewThemePreset.layout,
        siteSwitchLoadingCardTextColor:
          previewThemePreset.layout.siteSwitchLoadingCardTextColor || previewThemePreset.layout.themePanelTextColor || "#0f172a",
      };
    }
    return layoutStyle;
  }, [previewThemePreset, layoutStyle]);
  // Preview is deliberately written as a temporary root-variable overlay.
  // It mirrors the PageCssProfileRuntime token contract, then restores the
  // exact pre-preview values on leave. No store state or template data changes.
  useEffect(() => {
    if (!previewThemePreset || typeof document === "undefined") return;

    const root = document.documentElement;
    const previousVariables = Object.fromEntries(
      GLOBAL_THEME_TOKEN_NAMES.map((name) => [name, root.style.getPropertyValue(name)])
    );
    previewRootVariablesRef.current = previousVariables;
    const previewVariables = resolveGlobalThemeTokens(previewThemePreset.layout, previewThemePreset.sidebar);
    Object.entries(previewVariables).forEach(([name, value]) => root.style.setProperty(name, value));
    root.dataset.tradeproThemePreview = "true";

    return () => {
      const restoreVariables = previewRootVariablesRef.current || previousVariables;
      GLOBAL_THEME_TOKEN_NAMES.forEach((name) => {
        const previousValue = restoreVariables[name];
        if (previousValue) root.style.setProperty(name, previousValue);
        else root.style.removeProperty(name);
      });
      previewRootVariablesRef.current = null;
      delete root.dataset.tradeproThemePreview;
    };
  }, [previewThemePreset]);

  const contentSurfaceTextColor = resolveReadableTextColor(
    effectiveLayoutStyle.contentBgColor,
    effectiveLayoutStyle.contentTextColor,
    "#08111D",
    "#F8FAFC"
  );
  const contentSurfaceMutedTextColor = withAlpha(contentSurfaceTextColor, 0.84);
  const themePanelSurfaceTextColor = resolveReadableTextColor(
    effectiveLayoutStyle.themePanelBgColor,
    effectiveLayoutStyle.themePanelTextColor,
    "#08111D",
    "#F8FAFC"
  );
  const themePanelSurfaceMutedTextColor = withAlpha(themePanelSurfaceTextColor, 0.82);
  const themePanelSurfaceBorderColor = withAlpha(themePanelSurfaceTextColor, 0.18);
  const themePanelActionTextColor = getReadableTextColor(effectiveLayoutStyle.themePanelButtonColor, "#08111D", "#F8FAFC");
  const isDefaultDialogNarrow = defaultDialogViewportWidth < 420;
  const isDefaultDialogCompact = defaultDialogViewportWidth < 620;
  const isDefaultDialogMedium = defaultDialogViewportWidth < 860;
  const defaultDialogResponsiveMode: DefaultDialogResponsiveMode = isDefaultDialogNarrow
    ? "narrow"
    : isDefaultDialogMedium
      ? "compact"
      : "full";
  // Get active theme's card colors for batch buttons
  const activeThemeData = useMemo(() => {
    const t = allThemes.find((t) => t.key === activeTheme);
    return t || BUILTIN_THEME_PRESETS[0];
  }, [activeTheme, allThemes]);
  const tempThemeData = useMemo(() => {
    const t = allThemes.find((theme) => theme.key === extractBaseThemeKey(tempTheme));
    return t || activeThemeData;
  }, [activeThemeData, allThemes, tempTheme]);
  // Product-card colours are a theme-level source. The layout preview and
  // Operations read this one map directly; no card instance may become an
  // accidental source of truth for a whole status group.
  const tempStatusCardColors = useMemo(
    () => ({
      active: { ...tempThemeData.cardActive },
      inactive: { ...tempThemeData.cardInactive },
      hidden: { ...tempThemeData.cardHidden },
    }),
    [tempThemeData]
  );
  const effectiveStatusCardColors = useMemo(
    () =>
      previewThemePreset
        ? {
            active: { ...previewThemePreset.cardActive },
            inactive: { ...previewThemePreset.cardInactive },
            hidden: { ...previewThemePreset.cardHidden },
          }
        : tempStatusCardColors,
    [previewThemePreset, tempStatusCardColors]
  );
  const resolvedTempThemeKey = extractBaseThemeKey(tempTheme);
  const presetThemeOptions = useMemo(
    () =>
      [
        ["rose", PRESET_THEME_DEFAULT_LABELS.rose],
        ["orange", PRESET_THEME_DEFAULT_LABELS.orange],
        ["indigoGreen", PRESET_THEME_DEFAULT_LABELS.indigoGreen],
        ["tealRose", PRESET_THEME_DEFAULT_LABELS.tealRose],
        ["limeTea", PRESET_THEME_DEFAULT_LABELS.limeTea],
        ["black", PRESET_THEME_DEFAULT_LABELS.black],
        ["light", PRESET_THEME_DEFAULT_LABELS.light],
      ] as const,
    []
  );
  const presetThemeLabels = useMemo(
    () => ({
      black: PRESET_THEME_LEGACY_LABEL_MAP[sanitizeDisplayText(tempLayout.presetThemeBlackLabel, PRESET_THEME_DEFAULT_LABELS.black)] || sanitizeDisplayText(tempLayout.presetThemeBlackLabel, PRESET_THEME_DEFAULT_LABELS.black),
      light: PRESET_THEME_LEGACY_LABEL_MAP[sanitizeDisplayText(tempLayout.presetThemeLightLabel, PRESET_THEME_DEFAULT_LABELS.light)] || sanitizeDisplayText(tempLayout.presetThemeLightLabel, PRESET_THEME_DEFAULT_LABELS.light),
      rose: PRESET_THEME_LEGACY_LABEL_MAP[sanitizeDisplayText(tempLayout.presetThemeRoseLabel, PRESET_THEME_DEFAULT_LABELS.rose)] || sanitizeDisplayText(tempLayout.presetThemeRoseLabel, PRESET_THEME_DEFAULT_LABELS.rose),
      orange: PRESET_THEME_LEGACY_LABEL_MAP[sanitizeDisplayText(tempLayout.presetThemeOrangeLabel, PRESET_THEME_DEFAULT_LABELS.orange)] || sanitizeDisplayText(tempLayout.presetThemeOrangeLabel, PRESET_THEME_DEFAULT_LABELS.orange),
      indigoGreen: PRESET_THEME_DEFAULT_LABELS.indigoGreen,
      tealRose: PRESET_THEME_DEFAULT_LABELS.tealRose,
      limeTea: PRESET_THEME_DEFAULT_LABELS.limeTea,
    }),
    [
      tempLayout.presetThemeBlackLabel,
      tempLayout.presetThemeLightLabel,
      tempLayout.presetThemeOrangeLabel,
      tempLayout.presetThemeRoseLabel,
    ]
  );
  const activePresetThemeLabels = useMemo(
    () => ({
      black: PRESET_THEME_LEGACY_LABEL_MAP[sanitizeDisplayText(effectiveLayoutStyle.presetThemeBlackLabel, PRESET_THEME_DEFAULT_LABELS.black)] || sanitizeDisplayText(effectiveLayoutStyle.presetThemeBlackLabel, PRESET_THEME_DEFAULT_LABELS.black),
      light: PRESET_THEME_LEGACY_LABEL_MAP[sanitizeDisplayText(effectiveLayoutStyle.presetThemeLightLabel, PRESET_THEME_DEFAULT_LABELS.light)] || sanitizeDisplayText(effectiveLayoutStyle.presetThemeLightLabel, PRESET_THEME_DEFAULT_LABELS.light),
      rose: PRESET_THEME_LEGACY_LABEL_MAP[sanitizeDisplayText(effectiveLayoutStyle.presetThemeRoseLabel, PRESET_THEME_DEFAULT_LABELS.rose)] || sanitizeDisplayText(effectiveLayoutStyle.presetThemeRoseLabel, PRESET_THEME_DEFAULT_LABELS.rose),
      orange: PRESET_THEME_LEGACY_LABEL_MAP[sanitizeDisplayText(effectiveLayoutStyle.presetThemeOrangeLabel, PRESET_THEME_DEFAULT_LABELS.orange)] || sanitizeDisplayText(effectiveLayoutStyle.presetThemeOrangeLabel, PRESET_THEME_DEFAULT_LABELS.orange),
      indigoGreen: PRESET_THEME_DEFAULT_LABELS.indigoGreen,
      tealRose: PRESET_THEME_DEFAULT_LABELS.tealRose,
      limeTea: PRESET_THEME_DEFAULT_LABELS.limeTea,
    }),
    [
      effectiveLayoutStyle.presetThemeBlackLabel,
      effectiveLayoutStyle.presetThemeLightLabel,
      effectiveLayoutStyle.presetThemeOrangeLabel,
      effectiveLayoutStyle.presetThemeRoseLabel,
    ]
  );
  const getThemeDisplayName = useCallback(
    (themeKey?: ThemePresetKey | string | null, fallbackName?: string | null) => {
      if (!themeKey) {
        return sanitizeDisplayText(fallbackName, "未命名主题");
      }
      const presetOptionKey = Object.entries(PRESET_THEME_KEY_MAP).find(([, builtinKey]) => builtinKey === themeKey)?.[0] as
        | PresetThemeOptionKey
        | undefined;
      if (presetOptionKey) {
        return activePresetThemeLabels[presetOptionKey];
      }
      return PRESET_THEME_LEGACY_LABEL_MAP[sanitizeDisplayText(fallbackName, "未命名主题")] || sanitizeDisplayText(fallbackName, "未命名主题");
    },
    [activePresetThemeLabels]
  );
  const selectedPresetThemeOption = useMemo(() => {
    const baseThemeKey = extractBaseThemeKey(tempTheme);
    const currentPresetKey = (Object.entries(PRESET_THEME_KEY_MAP).find(([, builtinKey]) => builtinKey === baseThemeKey)?.[0] ||
      Object.entries(PRESET_THEME_KEY_MAP).find(([, builtinKey]) => builtinKey === activeTheme)?.[0] ||
      (baseThemeKey in PRESET_THEME_KEY_MAP ? baseThemeKey : null)) as PresetThemeOptionKey | null;
    const isCustomizedTheme = String(tempTheme).endsWith("__customized");
    if (isCustomizedTheme && currentPresetKey) {
      return presetThemeOptions.find(([key]) => key === currentPresetKey) || null;
    }
    if (isCustomizedTheme) {
      return null;
    }
    const fallbackPresetKey =
      currentPresetKey ||
      (presetThemeOptions.find(([key]) => PRESET_THEME_KEY_MAP[key] === "rose")?.[0] as PresetThemeOptionKey | null) ||
      null;
    return fallbackPresetKey ? presetThemeOptions.find(([key]) => key === fallbackPresetKey) || null : null;
  }, [activeTheme, presetThemeOptions, tempTheme]);
  const selectedPresetThemeKey = selectedPresetThemeOption?.[0] || null;
  const selectedPresetThemeLabel = useMemo(() => {
    return selectedPresetThemeOption ? presetThemeLabels[selectedPresetThemeOption[0]] : "自定义";
  }, [presetThemeLabels, selectedPresetThemeOption]);
  const currentThemeDisplayName = useMemo(() => {
    const matchedTheme = allThemes.find((theme) => theme.key === activeTheme);
    if (matchedTheme) {
      return getThemeDisplayName(matchedTheme.key, matchedTheme.name);
    }
    if (activeTheme === "custom") {
      return selectedPresetThemeOption ? presetThemeLabels[selectedPresetThemeOption[0]] : "自定义";
    }
    return getThemeDisplayName(activeTheme, activeTheme);
  }, [activeTheme, allThemes, getThemeDisplayName, presetThemeLabels, selectedPresetThemeOption]);
  const activePresetThemeTextColors = FIXED_PRESET_THEME_TEXT_COLORS;
  const activePresetThemeBgColors = FIXED_PRESET_THEME_BG_COLORS;
  const defaultDialogHeaderBgResolved = tempLayout.defaultDialogHeaderBgColor || "#020617";
  const defaultDialogBgResolved = tempLayout.defaultDialogBgColor || "#0f172a";
  const defaultDialogContentBgResolved = tempLayout.defaultDialogContentBgColor || defaultDialogBgResolved;
  const defaultDialogPanelBgResolved =
    tempLayout.defaultDialogPanelBgColor ||
    defaultDialogBgResolved ||
    `${defaultDialogHeaderBgResolved}24`;
  const defaultDialogHeaderTextColorResolved = resolveReadableTextColor(
    defaultDialogHeaderBgResolved,
    tempLayout.defaultDialogHeaderTextColor,
    "#08111D",
    "#F8FAFC"
  );
  const defaultDialogTextColor = resolveReadableTextColor(
    defaultDialogContentBgResolved,
    tempLayout.contentTextColor || defaultDialogHeaderTextColorResolved,
    "#08111D",
    "#F8FAFC"
  );
  const defaultDialogActionBgResolved = tempLayout.defaultDialogButtonColor
    || tempLayout.themePanelButtonColor
    || defaultDialogHeaderBgResolved;
  const defaultDialogActionTextColorResolved = resolveReadableTextColor(
    defaultDialogActionBgResolved,
    tempLayout.defaultDialogButtonTextColor || tempLayout.headerButtonTextColor,
    "#08111D",
    "#F8FAFC"
  );
  const defaultDialogShellStyle = useMemo(
    () => ({
      backgroundColor: defaultDialogContentBgResolved,
      color: defaultDialogTextColor,
      borderColor: withAlpha(defaultDialogHeaderTextColorResolved, 0.18),
      ["--pm-dialog-header-bg" as string]: defaultDialogHeaderBgResolved,
      ["--pm-dialog-panel-bg" as string]: defaultDialogPanelBgResolved,
      ["--pm-dialog-content-bg" as string]: defaultDialogContentBgResolved,
      ["--pm-dialog-input-bg" as string]: defaultDialogContentBgResolved,
      ["--pm-dialog-title-text" as string]: defaultDialogHeaderTextColorResolved,
      ["--pm-dialog-content-text" as string]: defaultDialogTextColor,
      ["--pm-dialog-muted-text" as string]: withAlpha(defaultDialogTextColor, 0.84),
      ["--pm-dialog-soft-text" as string]: withAlpha(defaultDialogTextColor, 0.72),
      ["--pm-dialog-border" as string]: withAlpha(defaultDialogHeaderTextColorResolved, 0.18),
      ["--pm-dialog-action-bg" as string]: defaultDialogActionBgResolved,
      ["--pm-dialog-action-text" as string]: defaultDialogActionTextColorResolved,
    }),
    [
      defaultDialogContentBgResolved,
      defaultDialogActionBgResolved,
      defaultDialogActionTextColorResolved,
      defaultDialogHeaderBgResolved,
      defaultDialogHeaderTextColorResolved,
      defaultDialogPanelBgResolved,
      defaultDialogTextColor,
    ]
  );
  // The theme editor previews and edits the selected “主题与版色” object. It
  // must not inherit the surrounding settings dialog's palette, because that
  // palette can belong to another, currently applied theme.
  const themeEditorDialogStyle = useMemo(() => {
    const layout = themeForm.layout;
    const headerBg = layout.defaultDialogHeaderBgColor || layout.headerBgColor || defaultDialogHeaderBgResolved;
    const contentBg = layout.defaultDialogContentBgColor || layout.contentBgColor || defaultDialogContentBgResolved;
    const panelBg = layout.defaultDialogPanelBgColor || layout.clientCardBgColor || contentBg;
    const headerText = resolveReadableTextColor(
      headerBg,
      layout.defaultDialogHeaderTextColor || layout.headerTextColor,
      "#08111D",
      "#F8FAFC"
    );
    const contentText = resolveReadableTextColor(
      contentBg,
      layout.contentTextColor || headerText,
      "#08111D",
      "#F8FAFC"
    );
    const actionBg = layout.defaultDialogButtonColor || layout.themePanelButtonColor || headerBg;
    const actionText = resolveReadableTextColor(
      actionBg,
      layout.defaultDialogButtonTextColor || layout.headerButtonTextColor,
      "#08111D",
      "#F8FAFC"
    );
    return {
      backgroundColor: contentBg,
      color: contentText,
      borderColor: withAlpha(headerText, 0.18),
      ["--pm-dialog-header-bg" as string]: headerBg,
      ["--pm-dialog-panel-bg" as string]: panelBg,
      ["--pm-dialog-content-bg" as string]: contentBg,
      ["--pm-dialog-input-bg" as string]: contentBg,
      ["--pm-dialog-title-text" as string]: headerText,
      ["--pm-dialog-content-text" as string]: contentText,
      ["--pm-dialog-muted-text" as string]: withAlpha(contentText, 0.84),
      ["--pm-dialog-soft-text" as string]: withAlpha(contentText, 0.72),
      ["--pm-dialog-border" as string]: withAlpha(headerText, 0.18),
      ["--pm-dialog-action-bg" as string]: actionBg,
      ["--pm-dialog-action-text" as string]: actionText,
    };
  }, [
    defaultDialogContentBgResolved,
    defaultDialogHeaderBgResolved,
    themeForm.layout,
  ]);
  const defaultDialogMutedTextColor = withAlpha(defaultDialogTextColor, 0.84);
  const defaultDialogSoftTextColor = withAlpha(defaultDialogTextColor, 0.72);
  const defaultDialogSoftBorder = withAlpha(defaultDialogHeaderTextColorResolved, 0.18);
  const defaultDialogTabListStyle = {
    backgroundColor: sidebarStyle.bgFrom || tempLayout.clientTopbarBgColor || defaultDialogHeaderBgResolved,
    color: sidebarStyle.textColor || tempLayout.clientTopbarTextColor || defaultDialogHeaderTextColorResolved,
    borderColor: withAlpha(
      sidebarStyle.textColor || tempLayout.clientTopbarTextColor || defaultDialogHeaderTextColorResolved,
      0.2
    ),
  };
  const defaultDialogPanelFill = defaultDialogPanelBgResolved;
  const defaultDialogContentFill = defaultDialogContentBgResolved;
  // Service icons must stay readable on every layout palette. The action icon
  // prefers the shared theme action colour, while the muted end still reads
  // the shared dialog text instead of a fixed slate/blue utility class.
  const serviceVolumeActionColor = resolveReadableTextColor(
    defaultDialogContentFill,
    tempLayout.themePanelButtonColor || tempLayout.defaultDialogButtonColor || defaultDialogTextColor,
    defaultDialogTextColor,
    defaultDialogHeaderTextColorResolved,
    4.5
  );
  const serviceVolumeMutedColor = resolveReadableTextColor(
    defaultDialogContentFill,
    defaultDialogTextColor,
    defaultDialogTextColor,
    defaultDialogHeaderTextColorResolved,
    4.5
  );
  // Font choices follow the sidebar gradient pair: the end colour is idle,
  // and the start colour marks the selected option.  This gives both states a
  // stable, immediately recognisable layout palette.
  const globalFontOptionBgColor = sidebarStyle.bgTo || tempLayout.themePanelBgColor || defaultDialogContentFill;
  const globalFontOptionTextColor = sidebarStyle.textColor
    || tempLayoutThemeTokens["--tradepro-panel-text"]
    || defaultDialogTextColor;
  const globalFontSelectedBgColor = sidebarStyle.bgFrom || tempLayout.themePanelButtonColor || tempLayout.defaultDialogButtonColor;
  const globalFontSelectedTextColor = sidebarStyle.textColor
    || getReadableTextColor(globalFontSelectedBgColor, "#08111D", "#F8FAFC");
  const globalFontSelectedOutlineColor = getReadableTextColor(
    globalFontSelectedBgColor,
    "#08111D",
    "#F8FAFC"
  );
  const livePresetThemes = useMemo(
    () =>
      presetThemeOptions
        .map(([key]) => allThemes.find((theme) => theme.key === PRESET_THEME_KEY_MAP[key]))
        .filter(Boolean) as typeof allThemes,
    [allThemes, presetThemeOptions]
  );
  const visibleAvatarCategoryKeys = useMemo<Set<string> | null>(() => {
    // Service owns the complete expert roster. Operations and Modules only
    // need portraits for category groups that are currently mounted; their
    // progressive sentinels extend this set before the next groups render.
    if (serviceWorkspaceActive) return null;
    const visibleKeys = new Set<string>();
    if (!operationsCatalogActive) return visibleKeys;
    const addVisibleGroups = (groups: ReadonlyArray<{ key: string }>) => {
      groups.forEach((group) => visibleKeys.add(group.key));
    };
    if (productMarketSubview === "operations") {
      addVisibleGroups(renderableOperationGroups.slice(0, visibleOperationGroupCount));
    }
    if (
      productMarketSubview === "modules"
      || (!templateSettingsSubview && showDefaultDialog && activeSettingsTab === "modules")
    ) {
      addVisibleGroups(groupedModuleProducts.slice(0, visibleModuleGroupCount));
    }
    return visibleKeys;
  }, [
    activeSettingsTab,
    groupedModuleProducts,
    operationsCatalogActive,
    productMarketSubview,
    renderableOperationGroups,
    serviceWorkspaceActive,
    showDefaultDialog,
    templateSettingsSubview,
    visibleModuleGroupCount,
    visibleOperationGroupCount,
  ]);
  const orderedCustomerServiceAvatars = useMemo(
    () => serviceWorkspaceActive
      ? getCustomerServiceCategoryExperts(tempModuleCategoryOrder, tempModuleCategoryStyles)
      : [],
    [serviceWorkspaceActive, tempModuleCategoryOrder, tempModuleCategoryStyles]
  );
  const selectedAvatarPreset = orderedCustomerServiceAvatars.find((preset) => preset.id === csAvatarId) || orderedCustomerServiceAvatars[0];
  const selectedAvatarOverride = csAvatarOverrides[csAvatarId];
  const selectedAvatarPreview = avatarPreviewMap[csAvatarId];
  const selectedAvatarHasCustomMaterial = Boolean(
    selectedAvatarOverride?.mediaAssetId || selectedAvatarOverride?.imageDataUrl
  );
  const avatarPreviewLoadSnapshot = useMemo(() => {
    const nextPlan: CustomerServiceAvatarPreviewPlanEntry[] = expertAvatarWorkspaceActive
      ? getCustomerServiceCategoryExperts(tempModuleCategoryOrder, tempModuleCategoryStyles)
        .filter((expert) => visibleAvatarCategoryKeys === null || visibleAvatarCategoryKeys.has(expert.categoryKey))
        .map((expert) => {
          const override = csAvatarOverrides[expert.id] || EMPTY_CUSTOMER_SERVICE_AVATAR_OVERRIDE;
          return {
            avatarId: expert.id,
            override,
            materialReference: resolveCustomerServiceLocalMaterialReference(
              override.mediaAssetId,
            ),
            previewDescriptor: getCustomerServiceAvatarPreviewDescriptor(override, serviceWorkspaceActive),
          };
        })
        .sort((left, right) => left.avatarId.localeCompare(right.avatarId))
      : [];
    const current = avatarPreviewLoadSnapshotRef.current;
    if (areCustomerServiceAvatarPreviewPlansEqual(current.plan, nextPlan)) {
      const stableSnapshot = { plan: nextPlan, revision: current.revision };
      avatarPreviewLoadSnapshotRef.current = stableSnapshot;
      return stableSnapshot;
    }
    const nextSnapshot = { plan: nextPlan, revision: current.revision + 1 };
    avatarPreviewLoadSnapshotRef.current = nextSnapshot;
    return nextSnapshot;
  }, [csAvatarOverrides, expertAvatarWorkspaceActive, serviceWorkspaceActive, tempModuleCategoryOrder, tempModuleCategoryStyles, visibleAvatarCategoryKeys]);
  const avatarPreviewLoadPlan = avatarPreviewLoadSnapshot.plan;
  const avatarPreviewLoadSignature = avatarPreviewLoadSnapshot.revision;
  const selectedAvatarSequenceMatch = resolveCustomerServiceExpertSequenceMatch(csAvatarId, selectedAvatarOverride, {
    reminderStyle: soundStyle,
    voiceGender: csVoiceGender,
    voiceRate: csVoiceRate,
  });
  const selectedAvatarVoicePreset = getCustomerServiceVoicePreset(
    selectedAvatarSequenceMatch.voiceStyleKey,
    selectedAvatarSequenceMatch.voiceGender,
  );
  const selectedAvatarEffectiveVoiceGender = selectedAvatarVoicePreset.gender;
  const selectedAvatarTextDraft = tempCsAvatarTextOverrides[csAvatarId];
  const selectedAvatarCustomDisplayNameDraft = selectedAvatarTextDraft
    ? selectedAvatarTextDraft.displayName
    : selectedAvatarOverride?.displayName;
  const selectedAvatarDisplayNameDraft = selectedAvatarCustomDisplayNameDraft?.trim()
    ? selectedAvatarCustomDisplayNameDraft
    : selectedAvatarPreset?.name || "";
  const selectedAvatarCustomGreetingTextDraft = selectedAvatarTextDraft
    ? selectedAvatarTextDraft.greetingText
    : selectedAvatarOverride?.greetingText;
  const selectedAvatarGreetingTextDraft = selectedAvatarCustomGreetingTextDraft?.trim()
    ? selectedAvatarCustomGreetingTextDraft
    : selectedAvatarPreset
      ? buildCustomerServiceDefaultGreeting(selectedAvatarPreset, selectedAvatarDisplayNameDraft)
      : "";
  const selectedAvatarVoiceEnabled = selectedAvatarOverride?.voiceEnabled ?? csVoiceEnabled;
  const selectedAvatarVoiceGender = selectedAvatarEffectiveVoiceGender;
  const selectedAvatarVoiceRate = selectedAvatarSequenceMatch.voiceRate;
  const selectedAvatarVoicePreview = avatarVoicePreview[csAvatarId];
  const selectedAvatarReminderSoundPreview = avatarSoundPreview[csAvatarId];
  const defaultFemaleVoicePreset = CUSTOMER_SERVICE_VOICE_PRESETS.find((preset) => preset.gender === "female")
    || CUSTOMER_SERVICE_VOICE_PRESETS[0];
  const defaultMaleVoicePreset = CUSTOMER_SERVICE_VOICE_PRESETS.find((preset) => preset.gender === "male")
    || CUSTOMER_SERVICE_VOICE_PRESETS[0];
  const activeFemaleVoicePreset = getCustomerServiceVoicePreset(
    selectedAvatarVoiceGender === "female" ? selectedAvatarVoicePreset.key : defaultFemaleVoicePreset.key,
    "female"
  );
  const activeMaleVoicePreset = getCustomerServiceVoicePreset(
    selectedAvatarVoiceGender === "male" ? selectedAvatarVoicePreset.key : defaultMaleVoicePreset.key,
    "male"
  );
  const selectedFemaleVoiceAsset = resolveVoicePresetAssetFromOverrides(csAvatarOverrides, csAvatarId, activeFemaleVoicePreset.key, "female");
  const selectedMaleVoiceAsset = resolveVoicePresetAssetFromOverrides(csAvatarOverrides, csAvatarId, activeMaleVoicePreset.key, "male");
  const selectedFemaleVoiceOwnAsset = resolveVoicePresetAssetFields(selectedAvatarOverride, activeFemaleVoicePreset.key, "female");
  const selectedMaleVoiceOwnAsset = resolveVoicePresetAssetFields(selectedAvatarOverride, activeMaleVoicePreset.key, "male");
  const selectedReminderSoundStyleKey = selectedAvatarSequenceMatch.reminderStyleKey;
  const selectedReminderSoundAsset = resolveReminderSoundAssetFields(selectedAvatarOverride, selectedReminderSoundStyleKey);
  const selectedReminderSoundPreset = getCustomerServiceReminderPreset(selectedReminderSoundStyleKey);
  const selectedFemaleVoicePreview =
    selectedAvatarVoicePreview?.byStyle?.[activeFemaleVoicePreset.key] || selectedAvatarVoicePreview?.female;
  const selectedMaleVoicePreview =
    selectedAvatarVoicePreview?.byStyle?.[activeMaleVoicePreset.key] || selectedAvatarVoicePreview?.male;
  const selectedFemaleVoiceDirectPreviewUrl =
    selectedFemaleVoicePreview?.url
    || buildMaterialAssetContentUrl(selectedFemaleVoiceAsset.assetId);
  const selectedMaleVoiceDirectPreviewUrl =
    selectedMaleVoicePreview?.url
    || buildMaterialAssetContentUrl(selectedMaleVoiceAsset.assetId);
  const selectedReminderSoundPreviewForStyle =
    selectedAvatarReminderSoundPreview?.byStyle?.[selectedReminderSoundStyleKey || ""]
    || (selectedReminderSoundAsset.assetId
      && selectedReminderSoundAsset.assetId === selectedAvatarOverride?.soundAssetId
      ? selectedAvatarReminderSoundPreview?.default
      : undefined);
  const selectedReminderSoundPlaybackUrl =
    selectedReminderSoundPreviewForStyle?.url || selectedReminderSoundPreset?.localAsset?.url;
  const orderedMaterialAssets = useMemo(
    () => serviceWorkspaceActive ? [...materialAssets].sort(compareMaterialAssetsForDisplay) : [],
    [materialAssets, serviceWorkspaceActive]
  );
  const customerServiceAvatarAssetIds = useMemo(() => {
    if (!serviceWorkspaceActive) return new Set<string>();
    const assetIds = new Set(CUSTOMER_SERVICE_BUILTIN_AVATARS.map((avatar) => avatar.assetId));
    for (const override of Object.values(csAvatarOverrides)) {
      if (override?.mediaAssetId) assetIds.add(override.mediaAssetId);
    }
    return assetIds;
  }, [csAvatarOverrides, serviceWorkspaceActive]);
  const customerServiceMaterialCategoryByAssetId = useMemo(() => {
    const categories = new Map<string, Exclude<AudioMaterialCategory, "all">>();
    if (!serviceWorkspaceActive) return categories;
    for (const override of Object.values(csAvatarOverrides)) {
      for (const [styleKey, asset] of Object.entries(override?.voiceAssetsByStyle || {})) {
        const preset = CUSTOMER_SERVICE_VOICE_PRESETS.find((item) => item.key === styleKey);
        if (asset?.assetId && preset) categories.set(asset.assetId, preset.gender === "male" ? "male-voice" : "female-voice");
      }
      for (const [styleKey, asset] of Object.entries(override?.voiceImageAssetsByStyle || {})) {
        const preset = CUSTOMER_SERVICE_VOICE_PRESETS.find((item) => item.key === styleKey);
        if (asset?.assetId && preset) categories.set(asset.assetId, preset.gender === "male" ? "male-voice" : "female-voice");
      }
      for (const asset of Object.values(override?.soundAssetsByStyle || {})) {
        if (asset?.assetId) categories.set(asset.assetId, "reminder-sound");
      }
      for (const asset of Object.values(override?.reminderImageAssetsByStyle || {})) {
        if (asset?.assetId) categories.set(asset.assetId, "reminder-sound");
      }
      if (override?.femaleVoiceAssetId) categories.set(override.femaleVoiceAssetId, "female-voice");
      if (override?.maleVoiceAssetId) categories.set(override.maleVoiceAssetId, "male-voice");
      if (override?.soundAssetId) categories.set(override.soundAssetId, "reminder-sound");
    }
    return categories;
  }, [csAvatarOverrides, serviceWorkspaceActive]);
  const resolveCustomerServiceMaterialCategory = useCallback((asset: StoredMaterialAssetItem) => {
    // An expert portrait may still have an old voice-cover reference in a
    // legacy draft. The avatar identity always wins, so it can never return
    // to any voice or reminder library through that stale reference.
    if (asset.kind === "image" && customerServiceAvatarAssetIds.has(asset.assetId)) return undefined;
    const assignedCategory = customerServiceMaterialCategoryByAssetId.get(asset.assetId);
    if (assignedCategory) return assignedCategory;
    const coverCategory = resolveCustomerServiceCoverMaterialCategory(asset.fileName);
    if (coverCategory) return coverCategory;
    if (asset.kind !== "audio") return undefined;
    if (asset.systemManaged && /reminder/i.test(asset.assetId)) return "reminder-sound" as const;
    const systemVoicePreset = findCustomerServiceSystemVoicePreset(asset);
    if (systemVoicePreset) return systemVoicePreset.gender === "male" ? "male-voice" as const : "female-voice" as const;
    const voiceMeta = resolveVoiceMaterialMeta(asset.fileName);
    return voiceMeta?.gender === "male" ? "male-voice" as const : voiceMeta?.gender === "female" ? "female-voice" as const : undefined;
  }, [customerServiceAvatarAssetIds, customerServiceMaterialCategoryByAssetId]);
  // 素材库只负责存放可复用的朗音，绝不能因为上传或刷新就擅自写入
  // “默认女声/默认男声”。默认回退必须由用户明确设置；否则它会抢占专家
  // 已选择的自定义朗音，并在下一次素材刷新时再次覆盖该选择。
  const filteredMaterialPickerAssets = useMemo(() => {
    if (!materialPickerTarget) return [] as StoredMaterialAssetItem[];
    const filtered = orderedMaterialAssets.filter((asset) => {
      if (!materialPickerTarget.allowedKinds.includes(asset.kind)) return false;
      if (materialPickerTarget.type === "avatar") return true;
      return Boolean(resolveCustomerServiceMaterialCategory(asset));
    });
    if (materialPickerTarget.type === "avatar") {
      const builtinAvatarAssetIds = new Set(CUSTOMER_SERVICE_BUILTIN_AVATARS.map((avatar) => avatar.assetId));
      return orderUploadedAvatarMaterialsNewestFirst(filtered.filter((asset) => !builtinAvatarAssetIds.has(asset.assetId)));
    }
    if (audioMaterialCategory === "female-voice" || audioMaterialCategory === "male-voice") {
      return orderCustomerServiceVoiceLibrary(filtered.filter((asset) => (
        resolveCustomerServiceMaterialCategory(asset) === audioMaterialCategory
      )));
    }
    if (audioMaterialCategory === "reminder-sound") {
      return orderCustomerServiceVoiceLibrary(filtered.filter((asset) => (
        resolveCustomerServiceMaterialCategory(asset) === "reminder-sound"
      )));
    }
    return orderCustomerServiceVoiceLibrary(filtered);
  }, [audioMaterialCategory, materialPickerTarget, orderedMaterialAssets, resolveCustomerServiceMaterialCategory]);
  const materialPickerEntries = useMemo(() => {
    if (!materialPickerTarget) return [] as MaterialPickerEntry[];
    const storedEntries: MaterialPickerEntry[] = filteredMaterialPickerAssets.map((asset) => {
      const assetAudioCategory = materialPickerTarget?.type !== "avatar"
        ? resolveCustomerServiceMaterialCategory(asset)
        : undefined;
      const systemVoicePreset = assetAudioCategory === "female-voice" || assetAudioCategory === "male-voice"
        ? findCustomerServiceSystemVoicePreset(asset)
        : undefined;
      const systemVoiceSequence = systemVoicePreset
        ? CUSTOMER_SERVICE_VOICE_PRESETS.indexOf(systemVoicePreset) + 1
        : undefined;
      const avatarSequence = materialPickerTarget?.type === "avatar"
        ? resolveAvatarMaterialDisplaySequence(asset.fileName)
        : undefined;
      const avatarExpertProfile = avatarSequence && avatarSequence <= 12
        ? CUSTOMER_SERVICE_EXPERT_AUDIO_ROSTER.find((item) => item.order === avatarSequence)
        : undefined;
      return {
        type: "stored" as const,
        asset,
        avatarSequence,
        avatarDisplayLabel: avatarExpertProfile
          ? `${avatarExpertProfile.orderLabel}.${avatarExpertProfile.expertName}`
          : undefined,
        voiceSequence: assetAudioCategory
          ? systemVoiceSequence || resolveStoredVoiceMaterialSequence(asset.fileName)
          : undefined,
        audioCategory: assetAudioCategory,
        audioDisplayLabel: systemVoicePreset?.label,
        voiceCoverUrl: systemVoicePreset?.gender === "male"
          ? "/assets/customer-service/voice-covers/male-presenter.png"
          : systemVoicePreset?.gender === "female"
            ? "/assets/customer-service/voice-covers/female-explainer.png"
            : undefined,
        builtinAvatar: undefined,
        virtualReminderStyleKey: undefined,
      };
    });
    const systemReminderEntries: MaterialPickerEntry[] = materialPickerTarget?.type !== "avatar"
      && (audioMaterialCategory === "all" || audioMaterialCategory === "reminder-sound")
      ? CUSTOMER_SERVICE_REMINDER_SOUND_PRESETS.flatMap((preset) => {
          if (!preset.localAsset) return [];
          return [{
            type: "stored" as const,
            asset: {
              assetId: `local-reminder:${preset.key}`,
              fileName: preset.localAsset.fileName,
              kind: "audio" as const,
              mimeType: preset.localAsset.mimeType,
              sizeBytes: preset.localAsset.sizeBytes,
              createdAt: preset.localAsset.createdAt,
              publicUrl: preset.localAsset.url,
              storagePath: preset.localAsset.url,
              applyCount: 0,
              usageCount: 0,
              systemManaged: true,
              canReplace: false,
              canDelete: false,
              usageLabels: [],
            },
            audioCategory: "reminder-sound" as const,
            audioDisplayLabel: preset.label,
            voiceSequence: resolveStoredVoiceMaterialSequence(preset.localAsset.fileName),
            virtualReminderStyleKey: preset.key,
            durationLabel: formatMaterialAssetDuration(preset.localAsset.durationSeconds),
            reminderCoverUrl: preset.coverAsset?.url,
            reminderCoverLabel: preset.coverAsset ? `${preset.label}生肖封面` : undefined,
          }];
        })
      : [];
    if (materialPickerTarget?.type !== "avatar") {
      return [...storedEntries, ...systemReminderEntries].sort((left, right) => compareNewestLargeSequenceFirst(
        { sequence: left.voiceSequence, createdAt: left.asset.createdAt, stableId: left.asset.assetId },
        { sequence: right.voiceSequence, createdAt: right.asset.createdAt, stableId: right.asset.assetId },
      ));
    }
    const builtinAvatarEntries = CUSTOMER_SERVICE_BUILTIN_AVATARS.flatMap((avatar) => {
      const asset = orderedMaterialAssets.find((item) => item.assetId === avatar.assetId);
      if (!asset) return [];
      const avatarSequence = avatar.expertOrder || resolveStoredAvatarMaterialSequence(asset.fileName);
      const avatarExpertProfile = avatarSequence && avatarSequence <= 12
        ? CUSTOMER_SERVICE_EXPERT_AUDIO_ROSTER.find((item) => item.order === avatarSequence)
        : undefined;
      return [{
        type: "stored" as const,
        asset,
        avatarSequence,
        avatarDisplayLabel: avatarExpertProfile
          ? `${avatarExpertProfile.orderLabel}.${avatarExpertProfile.expertName}`
          : avatarSequence
            ? `${formatDisplayOrdinal(avatarSequence)}.${avatar.country}专家`
            : undefined,
        voiceSequence: undefined,
        audioCategory: undefined,
        audioDisplayLabel: undefined,
        builtinAvatar: avatar,
        virtualReminderStyleKey: undefined,
      }];
    });
    return [
      ...storedEntries,
      ...builtinAvatarEntries,
    ].sort((left, right) => compareNewestLargeSequenceFirst(
      { sequence: left.avatarSequence, createdAt: left.asset.createdAt, stableId: left.asset.assetId },
      { sequence: right.avatarSequence, createdAt: right.asset.createdAt, stableId: right.asset.assetId },
    ));
  }, [audioMaterialCategory, filteredMaterialPickerAssets, materialPickerTarget, orderedMaterialAssets, resolveCustomerServiceMaterialCategory]);
  const materialPickerAvatarGenderFallback = useMemo<AvatarMaterialGender>(() => {
    if (materialPickerTarget?.type !== "avatar") return selectedAvatarVoiceGender;
    const targetAvatarId = materialPickerTarget.avatarId || csAvatarId;
    return resolveCustomerServiceExpertSequenceMatch(targetAvatarId, csAvatarOverrides[targetAvatarId]).voiceGender;
  }, [csAvatarId, csAvatarOverrides, materialPickerTarget, selectedAvatarVoiceGender]);
  const materialPickerRestoreState = useMemo(() => {
    if (!materialPickerTarget || materialPickerTarget.type === "avatar" || audioMaterialCategory === "all") return null;
    const avatarId = materialPickerTarget.avatarId || csAvatarId;
    const override = csAvatarOverrides[avatarId];
    if (audioMaterialCategory === "reminder-sound") {
      const styleKey = (materialPickerTarget.type === "reminder-sound"
        ? materialPickerTarget.soundStyleKey
        : undefined)
        || resolveCustomerServiceExpertSequenceMatch(avatarId, override, { reminderStyle: soundStyle }).reminderStyleKey;
      return {
        avatarId,
        type: "reminder-sound" as const,
        styleKey,
        canRestore: Boolean(
          override?.soundAssetsByStyle?.[styleKey]?.assetId
          || override?.reminderImageAssetsByStyle?.[styleKey]?.assetId
          || (override?.soundStyle === styleKey && override?.soundAssetId)
        ),
      } as const;
    }
    const gender = audioMaterialCategory === "male-voice" ? "male" : "female";
    const styleKey = (materialPickerTarget.type === `${gender}-voice`
      ? materialPickerTarget.voiceStyleKey
      : undefined)
      || getCustomerServiceVoicePreset(
        resolveCustomerServiceExpertSequenceMatch(avatarId, override).voiceStyleKey,
        gender,
      ).key;
    const voiceAsset = resolveVoicePresetAssetFields(override, styleKey, gender);
    return {
      avatarId,
      type: gender === "male" ? "male-voice" as const : "female-voice" as const,
      styleKey,
      gender,
      canRestore: Boolean(
        voiceAsset.assetId
        || override?.voiceImageAssetsByStyle?.[styleKey]?.assetId
      ),
    } as const;
  }, [audioMaterialCategory, csAvatarId, csAvatarOverrides, materialPickerTarget, soundStyle]);
  const visibleMaterialPickerEntries = useMemo(() => {
    if (materialPickerTarget?.type !== "avatar") {
      if (audioMaterialCategory !== "all") return materialPickerEntries;
      const audioCategoryOrder: Record<Exclude<AudioMaterialCategory, "all">, number> = {
        "female-voice": 0,
        "male-voice": 1,
        "reminder-sound": 2,
      };
      // 「全部声音」不是混排视图：按声音类别形成连续分组，方便用左侧栏式标题和分隔线辨识提醒音。
      return [...materialPickerEntries].sort((left, right) => (
        (audioCategoryOrder[left.audioCategory || "female-voice"] ?? 0)
        - (audioCategoryOrder[right.audioCategory || "female-voice"] ?? 0)
        || compareNewestLargeSequenceFirst(
          { sequence: left.voiceSequence, createdAt: left.asset.createdAt, stableId: left.asset.assetId },
          { sequence: right.voiceSequence, createdAt: right.asset.createdAt, stableId: right.asset.assetId },
        )
      ));
    }
    if (avatarMaterialGenderFilter === "all") {
      return [...materialPickerEntries].sort((left, right) => {
        const leftGender = resolveAvatarMaterialGender(
          left.asset.fileName,
          left.builtinAvatar?.gender,
          materialPickerAvatarGenderFallback,
        );
        const rightGender = resolveAvatarMaterialGender(
          right.asset.fileName,
          right.builtinAvatar?.gender,
          materialPickerAvatarGenderFallback,
        );
        const genderOrder = (leftGender === "female" ? 0 : 1) - (rightGender === "female" ? 0 : 1);
        if (genderOrder !== 0) return genderOrder;
        return compareNewestLargeSequenceFirst(
          { sequence: left.avatarSequence, createdAt: left.asset.createdAt, stableId: left.asset.assetId },
          { sequence: right.avatarSequence, createdAt: right.asset.createdAt, stableId: right.asset.assetId },
        );
      });
    }
    return materialPickerEntries.filter((entry) => (
      resolveAvatarMaterialGender(
        entry.asset.fileName,
        entry.builtinAvatar?.gender,
        materialPickerAvatarGenderFallback,
      ) === avatarMaterialGenderFilter
    ));
  }, [audioMaterialCategory, avatarMaterialGenderFilter, materialPickerAvatarGenderFallback, materialPickerEntries, materialPickerTarget?.type]);
  // The resolved asset includes the shared female fallback.  Keep the status
  // display on the same source as preview playback so a default voice is never
  // incorrectly shown as “未上传”.
  const selectedFemaleVoiceUploaded = Boolean(selectedFemaleVoiceAsset.assetId);
  const selectedMaleVoiceUploaded = Boolean(selectedMaleVoiceAsset.assetId);
  const selectedAnimationLabel =
    CS_ANIMATION_OPTIONS.find((item) => item.value === selectedAvatarSequenceMatch.animationStyle)?.label || "脉冲";
  const selectedAvatarExpertProfile = selectedAvatarPreset
    ? resolveCustomerServiceExpertProfile(selectedAvatarPreset, {
      ...selectedAvatarOverride,
      displayName: selectedAvatarDisplayNameDraft,
      greetingText: selectedAvatarGreetingTextDraft,
    })
    : null;
  const selectedCurrentVoicePreset = selectedAvatarVoicePreset;
  const selectedCurrentVoiceUploaded = selectedAvatarVoiceGender === "male" ? selectedMaleVoiceUploaded : selectedFemaleVoiceUploaded;
  const selectedCurrentVoiceOwnUploaded = Boolean(
    selectedAvatarVoiceGender === "male" ? selectedMaleVoiceOwnAsset.assetId : selectedFemaleVoiceOwnAsset.assetId
  );
  const selectedCurrentVoiceSourceText = selectedCurrentVoiceOwnUploaded
    ? "自定义"
    : selectedCurrentVoiceUploaded
      ? "共享替换"
      : "本地";
  const selectedCurrentVoiceStatusText = `${selectedCurrentVoicePreset.label} · ${selectedCurrentVoiceSourceText}`;
  const selectedCurrentVoicePickerTitle = `选择朗音素材 · ${selectedCurrentVoicePreset.label}`;
  const selectedCurrentVoicePickerDescription =
    `当前只针对 ${selectedCurrentVoicePreset.label} 设置；女声、男声和提醒声音在同一素材库分组展示，每组按最新、大号优先排列，清除后恢复本地样音。`;
  const activeCurrentVoicePreviewKey = `${csAvatarId}:${selectedAvatarVoiceGender}:${selectedCurrentVoicePreset.key}`;
  const selectedVoicePreviewText = selectedAvatarGreetingTextDraft.trim()
    || `您好，我是${selectedAvatarDisplayNameDraft.trim() || selectedAvatarPreset?.name || "当前专家"}，很高兴为您服务。`;
  useEffect(() => {
    let active = true;
    async function resolveFemaleVoicePreviewUrl() {
      if (selectedFemaleVoiceDirectPreviewUrl) {
        if (active) setSelectedFemaleVoicePreviewUrl(selectedFemaleVoiceDirectPreviewUrl);
        return;
      }
      if (active) setSelectedFemaleVoicePreviewUrl(undefined);
    }
    void resolveFemaleVoicePreviewUrl();
    return () => {
      active = false;
    };
  }, [activeFemaleVoicePreset.key, selectedFemaleVoiceDirectPreviewUrl]);

  useEffect(() => {
    let active = true;
    async function resolveMaleVoicePreviewUrl() {
      if (selectedMaleVoiceDirectPreviewUrl) {
        if (active) setSelectedMaleVoicePreviewUrl(selectedMaleVoiceDirectPreviewUrl);
        return;
      }
      if (active) setSelectedMaleVoicePreviewUrl(undefined);
    }
    void resolveMaleVoicePreviewUrl();
    return () => {
      active = false;
    };
  }, [activeMaleVoicePreset.key, selectedMaleVoiceDirectPreviewUrl]);

  const selectedReminderSoundLabel =
    selectedReminderSoundPreviewForStyle?.fileName
      ? `已替换 · ${selectedReminderSoundPreset?.label || "提醒声音"}`
      : (getCustomerServiceReminderPreset(selectedReminderSoundStyleKey)?.label || "默认");
  const layoutSectionOrder = useCallback(
    (id: string) => {
      const index = tempLayoutSections.findIndex((section) => section.id === id);
      return index === -1 ? 999 : index + 1;
    },
    [tempLayoutSections]
  );
  const syncCurrentMaterialAssetUsage = useCallback(async () => {
    try {
      await syncMaterialAssetUsage(collectMaterialAssetUsageSources());
    } catch {
      // Keep materials UI usable even if usage sync fails.
    }
  }, []);

  // Replacement creates a new material and updates the current scope only:
  // source scopes write a draft that still requires a successful full release,
  // while a runtime plan writes only its own snapshot. The previous material is
  // retained for other references.
  const materialSyncTargetLabel = isSourceScope
    ? "源体草稿；需发布新版且全部计划成功后才更新工厂默认"
    : "当前计划";
  const requestCurrentPlanMaterialSync = useCallback(() => {
    if (typeof window === "undefined") return;
    // Wait for React to commit the material state and refresh the save listener.
    // Dispatching in the click stack can otherwise persist the pre-clear avatar.
    const detail = { pathname: location.pathname, search: location.search };
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent("tradepro:client-project-sync-request", { detail }));
      });
    });
  }, [location.pathname, location.search]);

  const loadMaterialAssets = useCallback(async () => {
    setMaterialAssetsLoading(true);
    try {
      await syncCurrentMaterialAssetUsage();
      const response = await listMaterialAssets();
      setMaterialAssets([...(response.items || [])].sort(compareMaterialAssetsForDisplay));
    } catch (error) {
      toast.error(`素材资源加载失败：${formatUploadErrorMessage(error, "请稍后重试")}`);
    } finally {
      setMaterialAssetsLoading(false);
    }
  }, [syncCurrentMaterialAssetUsage]);

  const recordMaterialAssetDimensions = useCallback((assetId: string, width: number, height: number) => {
    if (!assetId || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    const nextValue = `${Math.round(width)} × ${Math.round(height)}`;
    setMaterialAssetDimensions((current) => current[assetId] === nextValue ? current : { ...current, [assetId]: nextValue });
  }, []);
  const recordMaterialAssetDuration = useCallback((assetId: string, durationSeconds: number) => {
    if (!assetId || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return;
    const nextValue = formatMaterialAssetDuration(durationSeconds);
    setMaterialAssetDurations((current) => current[assetId] === nextValue ? current : { ...current, [assetId]: nextValue });
  }, []);

  const openMaterialPicker = useCallback((target: MaterialPickerTarget) => {
    void loadMaterialAssets();
    setAvatarMaterialGenderFilter("all");
    setAudioMaterialCategory(target.type === "avatar" ? "all" : target.type);
    setMaterialPickerTarget(target);
  }, [loadMaterialAssets]);

  const closeMaterialPicker = useCallback(() => {
    setMaterialPickerTarget(null);
    setAvatarMaterialGenderFilter("all");
    setAudioMaterialCategory("all");
    setMaterialAssetReplaceTarget(null);
  }, []);

  const openCustomerServiceLocalUpload = useCallback((target: CustomerServiceUploadTarget) => {
    const input = target.type === "avatar"
      ? csAvatarUploadRef.current
      : target.type === "female-voice"
        ? csFemaleVoiceUploadRef.current
        : target.type === "male-voice"
          ? csMaleVoiceUploadRef.current
          : csSoundUploadRef.current;
    if (!input) {
      toast.error("本地文件选择器暂未就绪，请稍后重试");
      return;
    }
    pendingCustomerServiceUploadTargetRef.current = target;
    // Selecting the same file twice should still run the change handler.
    input.value = "";
    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
      } else {
        input.click();
      }
    } catch {
      // Some embedded browsers reject showPicker(), while click() remains
      // supported when invoked directly from this user click handler.
      input.click();
    }
  }, []);

  const currentMaterialUploadKinds = useMemo<MaterialAssetKind[]>(() => {
    if (materialPickerTarget?.allowedKinds?.length) return materialPickerTarget.allowedKinds;
    return ["image", "video", "audio"];
  }, [materialPickerTarget]);

  const materialAssetsUploadAccept = useMemo(() => {
    return getMediaUploadAccept(currentMaterialUploadKinds);
  }, [currentMaterialUploadKinds]);

  const handleMaterialAssetUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const {
      normalizeAvatarMaterial,
      normalizeCustomerServiceUploadFileType,
      resolveCustomerServiceUploadKind,
    } = await loadCustomerServiceMaterialNormalizer();
    const uploadedKind = resolveCustomerServiceUploadKind(file);
    const matchesAllowedKind = Boolean(uploadedKind && currentMaterialUploadKinds.includes(uploadedKind));
    if (!matchesAllowedKind) {
      const expectedText =
        currentMaterialUploadKinds.length === 1
          ? currentMaterialUploadKinds[0] === "audio"
            ? "音频"
            : currentMaterialUploadKinds[0] === "video"
              ? "视频"
              : "图片"
          : currentMaterialUploadKinds.includes("audio")
            ? "图片、视频或音频"
            : "图片或视频";
      toast.error(`请上传${expectedText}素材`);
      event.target.value = "";
      return;
    }
    const isAudioMaterial = materialPickerTarget?.type === "female-voice"
      || materialPickerTarget?.type === "male-voice"
      || materialPickerTarget?.type === "reminder-sound";
    if (materialPickerTarget?.type === "avatar" && file.size > MAX_AVATAR_MATERIAL_UPLOAD_BYTES) {
      toast.error("专家头像素材不能超过 2MB");
      event.target.value = "";
      return;
    }
    if (isAudioMaterial && file.size > MAX_VOICE_MATERIAL_UPLOAD_BYTES) {
      const audioLabel = materialPickerTarget?.type === "female-voice"
        ? "女性声音"
        : materialPickerTarget?.type === "male-voice"
          ? "男性声音"
          : "提醒声音";
      toast.error(`${audioLabel}素材不能超过 2MB`);
      event.target.value = "";
      return;
    }
    setMaterialAssetsUploading(true);
    try {
      const normalizedFile = normalizeCustomerServiceUploadFileType(file);
      const shouldNormalizeReminderCover = materialPickerTarget?.type === "reminder-sound" && uploadedKind === "image";
      const shouldNormalizeVoiceCover = (materialPickerTarget?.type === "female-voice" || materialPickerTarget?.type === "male-voice") && uploadedKind === "image";
      const avatarMaterial = materialPickerTarget?.type === "avatar" || shouldNormalizeReminderCover || shouldNormalizeVoiceCover
        ? await normalizeAvatarMaterial(normalizedFile)
        : normalizedFile;
      const uploadFile = materialPickerTarget?.type === "avatar"
        ? new File(
          [avatarMaterial],
          buildNextAvatarMaterialFileName(avatarMaterial.name, avatarMaterial.type, materialAssets),
          { type: avatarMaterial.type, lastModified: avatarMaterial.lastModified }
        )
        : avatarMaterial;
      const uploadedAsset = await uploadMaterialAsset(uploadFile);
      await loadMaterialAssets();
      toast.success(uploadedAsset.storagePath
        ? `素材已上传到 ${uploadedAsset.storagePath}`
        : "素材已上传到本地私有素材库，实际路径见素材条目或源码与部署中心");
    } catch (error) {
      toast.error(`素材上传失败：${formatUploadErrorMessage(error, "请重试")}`);
    } finally {
      setMaterialAssetsUploading(false);
      event.target.value = "";
    }
  }, [currentMaterialUploadKinds, loadMaterialAssets, materialAssets, materialPickerTarget]);

  const handleReplaceStoredMaterialAsset = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const target = materialAssetReplaceTarget;
    if (!file || !target) return;
    const {
      normalizeAvatarMaterial,
      normalizeCustomerServiceUploadFileType,
      resolveCustomerServiceUploadKind,
    } = await loadCustomerServiceMaterialNormalizer();
    const nextKind = resolveCustomerServiceUploadKind(file);
    if (!nextKind || nextKind !== target.kind) {
      toast.error(`原素材为${target.kind === "video" ? "视频" : target.kind === "audio" ? "音频" : "图片"}，替换文件必须保持同一类型`);
      event.target.value = "";
      return;
    }
    const isVoiceCover = (materialPickerTarget?.type === "female-voice" || materialPickerTarget?.type === "male-voice") && target.kind === "image";
    if ((materialPickerTarget?.type === "avatar" || (materialPickerTarget?.type === "reminder-sound" && target.kind === "image") || isVoiceCover) && file.size > MAX_AVATAR_MATERIAL_UPLOAD_BYTES) {
      toast.error(isVoiceCover ? "朗音封面图片不能超过 2MB" : materialPickerTarget?.type === "reminder-sound" ? "提醒封面图片不能超过 2MB" : "专家头像素材不能超过 2MB");
      event.target.value = "";
      return;
    }
    if (target.kind === "audio" && file.size > MAX_VOICE_MATERIAL_UPLOAD_BYTES) {
      toast.error("声音素材不能超过 2MB");
      event.target.value = "";
      return;
    }
    setMaterialAssetsBusyId(target.assetId);
    try {
      const normalizedFile = normalizeCustomerServiceUploadFileType(file);
      const replacementFile = materialPickerTarget?.type === "avatar" || (materialPickerTarget?.type === "reminder-sound" && target.kind === "image") || isVoiceCover
        ? await normalizeAvatarMaterial(normalizedFile)
        : normalizedFile;
      const replaced = await replaceMaterialAsset(target.assetId, replacementFile, target.kind);
      invalidateCustomerServiceMedia(target.assetId);
      setMaterialAssets((current) => current.map((asset) => asset.assetId === replaced.assetId ? replaced : asset));
      if (replaced.kind === "image" || replaced.kind === "video") {
        setAvatarPreviewMap((current) => {
          const next = { ...current };
          Object.entries(csAvatarOverrides).forEach(([avatarId, override]) => {
            if (override?.mediaAssetId === replaced.assetId) {
              next[avatarId] = { url: replaced.publicUrl, kind: replaced.kind };
            }
          });
          return next;
        });
      }
      setMaterialAssetDimensions((current) => ({
        ...current,
        [replaced.assetId]: materialPickerTarget?.type === "avatar" || (materialPickerTarget?.type === "reminder-sound" && replaced.kind === "image") || isVoiceCover
          ? AVATAR_MATERIAL_DIMENSION_LABEL
          : (current[replaced.assetId] || "读取中…"),
      }));
      await syncCurrentMaterialAssetUsage();
      toast.success(`原素材已直接替换：${formatMaterialDisplayFileName(replaced.fileName)}；所有引用将读取新文件`);
    } catch (error) {
      toast.error(`原素材替换失败：${formatUploadErrorMessage(error, "请重试")}`);
    } finally {
      setMaterialAssetsBusyId(null);
      setMaterialAssetReplaceTarget(null);
      event.target.value = "";
    }
  }, [csAvatarOverrides, materialAssetReplaceTarget, materialPickerTarget, syncCurrentMaterialAssetUsage]);

  const beginReplaceStoredMaterialAsset = useCallback((asset: StoredMaterialAssetItem) => {
    if (asset.canReplace === false) {
      toast.info("当前素材不支持原位替换");
      return;
    }
    setMaterialAssetReplaceTarget(asset);
    window.setTimeout(() => materialAssetReplaceUploadRef.current?.click(), 0);
  }, []);

  const handleDeleteMaterialAsset = useCallback(async (asset: StoredMaterialAssetItem) => {
    if (!asset.canDelete) {
      const usageText = asset.usageLabels.length > 0
        ? asset.usageLabels.join("、")
        : `${asset.usageCount} 处当前配置`;
      toast.error(`该素材仍被“${usageText}”引用，请先解除引用并同步后再删除`);
      return;
    }
    openSourceActionDialog({
      kind: "restore",
      title: "删除素材",
      description: `确认删除素材“${sanitizeDisplayText(asset.fileName, "未命名素材")}”吗？删除后将无法恢复。`,
      confirmLabel: "确认删除",
      busyLabel: "删除中...",
      onConfirm: async () => {
        setMaterialAssetsBusyId(asset.assetId);
        try {
          await deleteMaterialAsset(asset.assetId);
          await loadMaterialAssets();
          toast.success("素材已删除");
        } catch (error) {
          toast.error(`素材删除失败：${formatUploadErrorMessage(error, "请重试")}`);
        } finally {
          setMaterialAssetsBusyId(null);
        }
      },
    });
  }, [loadMaterialAssets, openSourceActionDialog]);

  const buildConfigFromDialogState = useCallback((): ExportableConfig => {
    const baseConfig = useProductMarketStore.getState().exportConfig();
    const orderedPaths = tempProducts.map((item) => item.path);
    const pendingStatuses = pendingOperationStatusRef.current;
    const nextProducts = tempProducts.map((item) => {
      const savedProduct = baseConfig.products.find((product) => product.path === item.path);
      return {
        label: savedProduct?.label || item.label,
        path: item.path,
        status: pendingStatuses[item.path] ?? item.status,
        customLabel: item.customLabel,
        description: item.description,
        customStyle: item.customStyle,
        children: item.children.map((child) => {
          const savedChild = savedProduct?.children?.find((entry) => entry.path === child.path);
          return {
            label: savedChild?.label || child.label,
            path: child.path,
            status: child.status,
            customLabel: child.customLabel,
            description: child.description,
            customStyle: child.customStyle,
          };
        }),
      };
    });
    const activePaths = nextProducts.filter((item) => item.status === "active").map((item) => item.path);
    const mergedCsAvatarOverrides = Object.fromEntries(
      Object.entries(csAvatarOverrides || {}).map(([avatarId, override]) => {
        const textDraft = tempCsAvatarTextOverrides[avatarId];
        if (!textDraft) {
          return [avatarId, { ...override }];
        }
        const displayName = textDraft.displayName.trim();
        const greetingText = textDraft.greetingText.trim();
        return [
          avatarId,
          {
            ...override,
            displayName: displayName || undefined,
            greetingText: greetingText || undefined,
          },
        ];
      })
    );

    Object.entries(tempCsAvatarTextOverrides).forEach(([avatarId, textDraft]) => {
      if (mergedCsAvatarOverrides[avatarId]) return;
      const displayName = textDraft.displayName.trim();
      const greetingText = textDraft.greetingText.trim();
      if (!displayName && !greetingText) return;
      mergedCsAvatarOverrides[avatarId] = {
        displayName: displayName || undefined,
        greetingText: greetingText || undefined,
      } as CustomerServiceAvatarOverride;
    });

    return {
      ...baseConfig,
      // Keep transport metadata in the editable signature as well as the
      // persisted snapshot. Otherwise a successful readback gains this field
      // while exportConfig() drops it, and navigation is falsely marked dirty.
      sidebarStyleSyncVersion: SIDEBAR_STYLE_SYNC_VERSION,
      products: nextProducts,
      customDefaultPaths: activePaths,
      layoutStyle: { ...tempLayout },
      sidebarStyle: { ...sidebarStyle },
      layoutSections: tempLayoutSections.map((section) => ({ ...section })),
      customerServiceSections: tempCustomerServiceSections.map((section) => ({ ...section })),
      moduleActionOrder: [...tempModuleActionOrder],
      layoutActionOrder: [...tempLayoutActionOrder],
      customerServiceActionOrder: [...tempCustomerServiceActionOrder],
      activeTheme: extractBaseThemeKey(tempTheme),
      productOrder: orderedPaths,
      moduleCategoryOrder: normalizeModuleCategoryOrderForScope(configScope, tempModuleCategoryOrder),
      moduleCategoryAssignments: { ...tempModuleCategoryAssignments },
      moduleCategoryStyles: Object.fromEntries(
        Object.entries(tempModuleCategoryStyles).map(([key, style]) => [key, { ...style }])
      ),
      csAvatarOverrides: mergedCsAvatarOverrides,
      globalFontFamily,
      globalFontWeight,
      globalLetterSpacing,
      layoutCustomized: shouldUseSharedClientStyle && !isCentralStyleSettingsPage ? true : (baseConfig.layoutCustomized ?? false),
      layoutStructureCustomized:
        shouldUseSharedClientStyle && !isCentralStyleSettingsPage
          ? true
          : (baseConfig.layoutStructureCustomized ?? false),
    };
  }, [
    csAvatarOverrides,
    globalFontFamily,
    globalFontWeight,
    globalLetterSpacing,
    configScope,
    isCentralStyleSettingsPage,
    shouldUseSharedClientStyle,
    sidebarStyle,
    tempCsAvatarTextOverrides,
    tempCustomerServiceSections,
    tempCustomerServiceActionOrder,
    tempLayout,
    tempLayoutActionOrder,
    tempLayoutSections,
    tempModuleActionOrder,
    tempProducts,
    tempTheme,
    tempModuleCategoryAssignments,
    tempModuleCategoryOrder,
    tempModuleCategoryStyles,
  ]);

  const markCustomerServiceCustomized = useCallback(() => {
    if (shouldTrackClientCustomerServiceOverride) {
      setCustomerServiceCustomized(true);
    }
  }, [setCustomerServiceCustomized, shouldTrackClientCustomerServiceOverride]);

  const markLayoutCustomized = useCallback(() => {
    if (shouldUseSharedClientStyle && !isCentralStyleSettingsPage) {
      setLayoutCustomized(true);
    }
  }, [isCentralStyleSettingsPage, setLayoutCustomized, shouldUseSharedClientStyle]);

  const markLayoutStructureCustomized = useCallback(() => {
    if (shouldUseSharedClientStyle && !isCentralStyleSettingsPage) {
      setLayoutStructureCustomized(true);
    }
  }, [isCentralStyleSettingsPage, setLayoutStructureCustomized, shouldUseSharedClientStyle]);

  // Remote configuration is only an initial seed.  Keep a monotonically
  // increasing interaction revision so a slow seed request can never put an
  // older value back after a user has already changed a visual setting.
  const localVisualEditRevisionRef = useRef(0);
  const markLocalVisualEdit = useCallback(() => {
    localVisualEditRevisionRef.current += 1;
  }, []);

  const handleGlobalFontFamilyChange = useCallback((font: string) => {
    markLocalVisualEdit();
    markLayoutCustomized();
    setGlobalFontFamily(font);
  }, [markLayoutCustomized, markLocalVisualEdit, setGlobalFontFamily]);

  const handleGlobalFontWeightChange = useCallback((weight: string) => {
    markLocalVisualEdit();
    markLayoutCustomized();
    setGlobalFontWeight(weight);
  }, [markLayoutCustomized, markLocalVisualEdit, setGlobalFontWeight]);

  const handleGlobalLetterSpacingChange = useCallback((spacing: string) => {
    markLocalVisualEdit();
    markLayoutCustomized();
    setGlobalLetterSpacing(spacing);
  }, [markLayoutCustomized, markLocalVisualEdit, setGlobalLetterSpacing]);

  const loadConfigIntoSettingsDraft = useCallback((nextConfig: ExportableConfig) => {
    setTempProducts(buildEditableProducts(nextConfig.products));
    setTempModuleCategoryOrder(normalizeModuleCategoryOrderForScope(configScope, nextConfig.moduleCategoryOrder));
    setTempModuleCategoryAssignments({ ...(nextConfig.moduleCategoryAssignments || {}) });
    setTempModuleCategoryStyles({ ...(nextConfig.moduleCategoryStyles || {}) });
    setTempLayout({ ...nextConfig.layoutStyle });
    setTempLayoutSections((nextConfig.layoutSections?.length ? nextConfig.layoutSections : DEFAULT_LAYOUT_SECTIONS).map((section) => ({ ...section })));
    setTempCustomerServiceSections((nextConfig.customerServiceSections?.length ? nextConfig.customerServiceSections : DEFAULT_CUSTOMER_SERVICE_SECTIONS).map((section) => ({ ...section })));
    setTempLayoutActionOrder(normalizeTemplateHeaderActionOrder(nextConfig.layoutActionOrder, DEFAULT_LAYOUT_HEADER_ACTION_ORDER));
    setTempCustomerServiceActionOrder(normalizeTemplateHeaderActionOrder(nextConfig.customerServiceActionOrder, DEFAULT_SERVICE_HEADER_ACTION_ORDER));
    setTempModuleActionOrder(normalizeTemplateHeaderActionOrder(nextConfig.moduleActionOrder, DEFAULT_MODULE_HEADER_ACTION_ORDER));
    setTempTheme(nextConfig.activeTheme);
    setTempCsAvatarTextOverrides(
      Object.fromEntries(
        Object.entries(nextConfig.csAvatarOverrides || {}).map(([avatarId, override]) => [
          avatarId,
          { displayName: override.displayName || "", greetingText: override.greetingText || "" },
        ])
      )
    );
    pendingOperationStatusRef.current = {};
  }, [configScope]);

  const applyConfigSnapshotToState = useCallback(
    (
      nextConfig: ExportableConfig,
      options?: {
        syncCustomizationFlags?: boolean;
        syncMaterialAssets?: boolean;
      }
    ) => {
      skipNextPersistRef.current = true;
      importConfig(nextConfig);
      setLayoutSections(nextConfig.layoutSections || DEFAULT_LAYOUT_SECTIONS);
      setCustomerServiceSections(nextConfig.customerServiceSections || DEFAULT_CUSTOMER_SERVICE_SECTIONS);
      if (options?.syncCustomizationFlags) {
        setLayoutCustomized(nextConfig.layoutCustomized === true);
        setLayoutStructureCustomized(nextConfig.layoutStructureCustomized === true);
        setCustomerServiceCustomized(nextConfig.customerServiceCustomized === true);
      }
      if (options?.syncMaterialAssets) {
        void syncCurrentMaterialAssetUsage();
      }
    },
    [
      importConfig,
      setCustomerServiceCustomized,
      setCustomerServiceSections,
      setLayoutCustomized,
      setLayoutSections,
      setLayoutStructureCustomized,
      syncCurrentMaterialAssetUsage,
    ]
  );

  const restoreDefaultDialogSnapshot = useCallback(() => {
    const snapshot = defaultDialogConfigSnapshotRef.current;
    if (!snapshot) return;
    applyConfigSnapshotToState(cloneExportableConfigSnapshot(snapshot), {
      syncCustomizationFlags: true,
      syncMaterialAssets: true,
    });
  }, [
    applyConfigSnapshotToState,
  ]);

  const closeDefaultDialog = useCallback((options?: { saved?: boolean }) => {
    const saved = options?.saved === true;
    if (!saved) {
      restoreDefaultDialogSnapshot();
    }
    setShowDefaultDialog(false);
    defaultDialogBaselineReadyRef.current = false;
    setDefaultDialogBaselineReady(false);
    defaultDialogConfigSnapshotRef.current = null;
    defaultDialogDraftBaselineRef.current = null;
    defaultDialogVerifiedSignatureRef.current = null;
    defaultDialogProductsBaselineSignatureRef.current = null;
  }, [restoreDefaultDialogSnapshot]);

  function importAndPersistCurrentScopeSnapshot(
    nextConfig: ExportableConfig,
    options?: {
      includeDefault?: boolean;
      ensureDefaultFallback?: boolean;
      skipRemoteSnapshot?: boolean;
    }
  ) {
    skipNextPersistRef.current = true;
    importConfig(nextConfig);
    persistCurrentScopeConfig(nextConfig, {
      includeDefault: options?.includeDefault,
      ensureDefaultFallback: options?.ensureDefaultFallback,
      skipRemoteSnapshot: options?.skipRemoteSnapshot,
    });
  }

  function persistCurrentScopeLiveConfig(nextConfig: ExportableConfig) {
    // Source current/draft is a saved baseline, not a live-store cache. Only
    // the explicit save transaction may advance it after local + server
    // readback. Otherwise changing tabs exports a reduced store shape and
    // silently overwrites the just-verified catalogue draft.
    if (templateLifecycleRole === "source") return;
    persistCurrentScopeConfig(nextConfig);
    if (shouldWriteSharedClientStyle) {
      writeSharedStyleSettings(nextConfig);
    }
  }

  function getRemoteSnapshotLoader(
    scope: ProductMarketScope
  ):
    | {
        load: () => Promise<ExportableConfig | null>;
        includeDefault?: boolean;
      }
    | undefined {
    if (scope === "client" && effectiveSiteId && !isCentralStyleSettingsPage) {
      const identity = resolveRuntimeInstanceIdentity("client", effectiveSiteId);
      return {
        load: async () =>
          normalizeScopedConfig(
            "client",
            await readRemoteRuntimeInstanceConfig(identity)
          ),
      };
    }
    if (scope === "agency" && effectiveSiteId && !isCentralStyleSettingsPage) {
      const identity = resolveRuntimeInstanceIdentity("agency", effectiveSiteId);
      return {
        load: async () =>
          normalizeScopedConfig(
            "agency",
            await readRemoteRuntimeInstanceConfig(identity)
          ),
      };
    }
    if (scope === "client_source") {
      return {
        load: async () =>
          normalizeScopedConfig(
            "client_source",
            await readRemoteTemplateConfig("client-source-global", "draft-or-published")
          ),
        includeDefault: false,
      };
    }
    if (scope === "agency_source") {
      return {
        load: async () =>
          normalizeScopedConfig(
            "agency_source",
            await readRemoteTemplateConfig("agency-source-global", "draft-or-published")
          ),
        includeDefault: false,
      };
    }
    return undefined;
  }

  const updateOperationDraftStatus = useCallback((paths: string[], status: ProductStatus) => {
    const colors = status === "active"
      ? tempThemeData.cardActive
      : status === "hidden"
        ? tempThemeData.cardHidden
        : tempThemeData.cardInactive;
    const pathSet = new Set(paths);
    paths.forEach((path) => {
      pendingOperationStatusRef.current[path] = status;
    });
    setTempProducts((current) => {
      const existingPaths = new Set(current.map((item) => item.path));
      const next = current.map((item) =>
        pathSet.has(item.path)
          ? {
              ...item,
              status,
              customStyle: {
                ...item.customStyle,
                bgColor: colors.bg,
                borderColor: colors.border,
                fontColor: colors.font,
                buttonColor: colors.button,
                nameFontColor: colors.nameFont || colors.font,
              },
            }
          : item
      );
      // A catalogue baseline migration can add a newly graduated pilot route
      // while the Operations draft is still open. Materialize that route in
      // the draft so its first Open/Cancel/Hide action is not silently lost.
      paths.forEach((path) => {
        if (existingPaths.has(path)) return;
        const base = operationDraftProductByPath.get(path);
        if (!base) return;
        next.push({
          ...base,
          status,
          customStyle: {
            ...base.customStyle,
            bgColor: colors.bg,
            borderColor: colors.border,
            fontColor: colors.font,
            buttonColor: colors.button,
            nameFontColor: colors.nameFont || colors.font,
          },
        });
      });
      return next;
    });
  }, [operationDraftProductByPath, tempThemeData]);

  const handleSetCategoryStatus = useCallback((categoryKey: string, status: ProductStatus) => {
    const targetProducts = categoryItemOrderMap.get(categoryKey) || [];
    if (targetProducts.length === 0) return;
    updateOperationDraftStatus(targetProducts.map((product) => product.path), status);
    markLayoutStructureCustomized();
  }, [categoryItemOrderMap, markLayoutStructureCustomized, updateOperationDraftStatus]);

  const handleSetBlueprintCategoryPlanningVisibility = useCallback((categoryKey: FactoryPlatformCategoryKey, visible: boolean) => {
    setTempModuleCategoryStyles((current) => ({
      ...current,
      [categoryKey]: {
        ...current[categoryKey],
        blueprintVisible: visible,
      },
    }));
    markLayoutStructureCustomized();
  }, [markLayoutStructureCustomized]);

  const handleSetBlueprintCategoryStatus = useCallback(async (categoryKey: FactoryPlatformCategoryKey, status: ProductStatus) => {
    const { getFactoryPlatformCategory } = await import("@/lib/factory-platform-blueprint");
    const category = getFactoryPlatformCategory(categoryKey);
    if (!category) return;
    updateOperationDraftStatus(category.applications.map((application) => application.route), status);
    markLayoutStructureCustomized();
  }, [markLayoutStructureCustomized, updateOperationDraftStatus]);

  const handleSetStatus = useCallback((path: string, status: ProductStatus) => {
    updateOperationDraftStatus([path], status);
  }, [updateOperationDraftStatus]);

  const handleAddProduct = useCallback((product: Parameters<typeof addProduct>[0]) => {
    markLayoutStructureCustomized();
    addProduct(product);
  }, [addProduct, markLayoutStructureCustomized]);

  // The shared source-contract reader performs this migration before the
  // store is imported.  Do not add or reorder programs from this page: doing
  // both here and in the reader creates two writers that can overwrite one
  // another during a source-route refresh.

  // Older source snapshots can still carry a factory default label after the
  // route itself has been retained.  Correct only those registered legacy
  // labels; a name changed by an administrator remains untouched.  This is
  // deliberately label-only and idempotent, so it cannot reintroduce the old
  // add/reorder write loop.
  useEffect(() => {
    if (!isHQClientSourcePage) return;
    WEBSITE_CONTENT_PROGRAMS.forEach((program) => {
      const product = products.find((item) => item.path === program.path);
      if (!product) return;
      const currentLabel = sanitizeDisplayText(product.customLabel || product.label, "");
      const isRegisteredLegacyLabel = !product.customLabel?.trim()
        || (LEGACY_CONTENT_PROGRAM_LABELS[program.path] || []).includes(currentLabel);
      if (isRegisteredLegacyLabel && product.customLabel !== program.label) {
        setProductCustomLabel(program.path, program.label);
      }
    });
  }, [isHQClientSourcePage, products, setProductCustomLabel]);

  // One true source of data: a primary module's saved name/status updates the
  // corresponding navigation item. Sidebar and public-template consumers are
  // already subscribed to this event, so no duplicate navigation tree exists.
  useEffect(() => {
    if (!isHQClientSourcePage) return;
    let cancelled = false;
    void import("@/lib/website-content-store").then(({ getWebsiteContentState, saveWebsiteContentState }) => {
      if (cancelled) return;
      const productByPath = new Map(products.map((product) => [product.path, product] as const));
      const state = getWebsiteContentState(websiteContentScopeId);
      let changed = false;
      const items = state.navigation.items.map((item) => {
        const definition = WEBSITE_CONTENT_PROGRAMS.find((program) => program.sectionKey === item.sectionKey);
        if (!definition) return item;
        const product = productByPath.get(definition.path);
        if (!product) return item;
        const label = sanitizeDisplayText(product.customLabel || product.label, definition.label);
        const visible = product.status === "active";
        const nextLabels = { ...item.labels, zh: label, en: item.labels?.en || label };
        const isSame = item.label === label
          && item.visible === visible
          && item.labels?.zh === nextLabels.zh
          && item.labels?.en === nextLabels.en;
        if (isSame) return item;
        changed = true;
        return { ...item, label, labels: nextLabels, visible };
      });
      if (changed) {
        saveWebsiteContentState({ ...state, navigation: { ...state.navigation, items } }, websiteContentScopeId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isHQClientSourcePage, products, websiteContentScopeId]);

  const normalizeSharedInitialClientConfig = useCallback((config: ExportableConfig): ExportableConfig => ({
    ...config,
    customerServiceCustomized: false,
    layoutCustomized: false,
    layoutStructureCustomized: false,
    sidebarStyle: normalizeSidebarStyle(config.sidebarStyle, config.activeTheme),
  }), []);

  const applyRotatedPlanDefaults = useCallback((config: ExportableConfig, siteId?: string | null): ExportableConfig => {
    const rotatedDefaults = getRotatedThemeAndAvatarForSite(siteId);
    if (!rotatedDefaults) return config;
    return {
      ...applyProductMarketTheme(config, rotatedDefaults.themeKey),
      csAvatarId: rotatedDefaults.avatarId,
    };
  }, []);

  const getSharedInitialClientConfig = useCallback((siteId?: string | null): ExportableConfig => {
    const storedHeadquartersDefault = readClientTemplateProductMarketConfig();
    const sharedInitialConfig = readSharedStyleSettings();
    const baseConfig = getInitialRestoreConfig("client", storedHeadquartersDefault) || buildFactoryInitialConfig();

    if (storedHeadquartersDefault) {
      return normalizeSharedInitialClientConfig(applyRotatedPlanDefaults(baseConfig, siteId));
    }

    if (sharedInitialConfig) {
      const sharedProducts = cloneSharedProducts(sharedInitialConfig.products);
      const activeSharedPaths = sharedProducts
        .filter((product) => product.status === "active")
        .map((product) => product.path);
      const scopedSharedConfig = normalizeScopedConfig("client", {
        ...baseConfig,
        layoutStyle: { ...sharedInitialConfig.layoutStyle },
        layoutSections: cloneLayoutSections(sharedInitialConfig.layoutSections),
        customerServiceSections: cloneCustomerServiceSections(
          sharedInitialConfig.customerServiceSections || DEFAULT_CUSTOMER_SERVICE_SECTIONS
        ),
        activeTheme: sharedInitialConfig.activeTheme,
        customThemes: cloneThemes(sharedInitialConfig.customThemes),
        builtinThemeOverrides: cloneThemeMap(sharedInitialConfig.builtinThemeOverrides),
        sidebarStyle: normalizeSidebarStyle(
          sharedInitialConfig.sidebarStyle || baseConfig.sidebarStyle,
          sharedInitialConfig.activeTheme || baseConfig.activeTheme
        ),
        globalFontFamily: sharedInitialConfig.globalFontFamily || baseConfig.globalFontFamily,
        globalFontWeight: sharedInitialConfig.globalFontWeight || baseConfig.globalFontWeight,
        globalLetterSpacing: sharedInitialConfig.globalLetterSpacing || baseConfig.globalLetterSpacing,
        products: sharedProducts,
        customDefaultPaths: [...(sharedInitialConfig.customDefaultPaths || activeSharedPaths)],
        productOrder: [...(sharedInitialConfig.productOrder || sharedProducts.map((product) => product.path))],
        customProducts: cloneCustomProducts(
          sharedInitialConfig.customProducts || baseConfig.customProducts || []
        ),
        soundEnabled: sharedInitialConfig.soundEnabled ?? baseConfig.soundEnabled,
        soundVolume: sharedInitialConfig.soundVolume ?? baseConfig.soundVolume,
        soundStyle: sharedInitialConfig.soundStyle || baseConfig.soundStyle,
        csAvatarId: sharedInitialConfig.csAvatarId || baseConfig.csAvatarId,
        csEnabled: sharedInitialConfig.csEnabled ?? baseConfig.csEnabled,
        csAvatarOverrides: cloneAvatarOverrides(sharedInitialConfig.csAvatarOverrides),
        csVoiceEnabled: sharedInitialConfig.csVoiceEnabled ?? baseConfig.csVoiceEnabled,
        csVoiceGender: sharedInitialConfig.csVoiceGender || baseConfig.csVoiceGender,
        csVoiceRate: sharedInitialConfig.csVoiceRate ?? baseConfig.csVoiceRate,
      }) || buildFactoryInitialConfig();

      return normalizeSharedInitialClientConfig(
        applyRotatedPlanDefaults(scopedSharedConfig, siteId)
      );
    }

    return normalizeSharedInitialClientConfig(
      applyRotatedPlanDefaults(getInitialRestoreConfig("client", storedHeadquartersDefault), siteId)
    );
  }, [applyRotatedPlanDefaults, normalizeSharedInitialClientConfig]);

  const handleSetCsEnabled = useCallback((enabled: boolean) => {
    markCustomerServiceCustomized();
    setCsEnabled(enabled);
    if (!enabled) {
      setSoundEnabled(false);
      setCsVoiceEnabled(false);
    }
  }, [markCustomerServiceCustomized, setCsEnabled, setCsVoiceEnabled, setSoundEnabled]);

  const handleSetSoundEnabled = useCallback((enabled: boolean) => {
    markCustomerServiceCustomized();
    if (enabled && !csEnabled) {
      setCsEnabled(true);
    }
    setSoundEnabled(enabled);
  }, [csEnabled, markCustomerServiceCustomized, setCsEnabled, setSoundEnabled]);

  const handleSetSoundVolume = useCallback((volume: number) => {
    markCustomerServiceCustomized();
    setSoundVolume(volume);
  }, [markCustomerServiceCustomized, setSoundVolume]);

  const handleSetCsVoiceEnabled = useCallback((enabled: boolean) => {
    markCustomerServiceCustomized();
    if (enabled && !csEnabled) {
      setCsEnabled(true);
    }
    setCsVoiceEnabled(enabled);
  }, [csEnabled, markCustomerServiceCustomized, setCsEnabled, setCsVoiceEnabled]);

  const handleSetCsVoiceGender = useCallback((gender: "female" | "male") => {
    markCustomerServiceCustomized();
    setCsVoiceGender(gender);
  }, [markCustomerServiceCustomized, setCsVoiceGender]);

  const handleSetCsAvatarId = useCallback((id: string) => {
    markCustomerServiceCustomized();
    setCsAvatarId(id);
    const existingOverride = csAvatarOverrides[id];
    if (existingOverride?.expertSequenceContractVersion !== CUSTOMER_SERVICE_EXPERT_SEQUENCE_CONTRACT_VERSION) {
      const match = resolveCustomerServiceExpertSequenceMatch(id, existingOverride, {
        reminderStyle: soundStyle,
        voiceGender: csVoiceGender,
        voiceRate: csVoiceRate,
      });
      setCsAvatarOverride(id, {
        voiceGender: match.voiceGender,
        voiceStyleKey: match.voiceStyleKey,
        voiceRate: match.voiceRate,
        animationStyle: match.animationStyle,
        soundStyle: match.reminderStyleKey,
      });
    }
  }, [csAvatarOverrides, csVoiceGender, csVoiceRate, markCustomerServiceCustomized, setCsAvatarId, setCsAvatarOverride, soundStyle]);

  const handleSetCsAvatarOverride = useCallback((id: string, override: Parameters<typeof setCsAvatarOverride>[1]) => {
    markCustomerServiceCustomized();
    setCsAvatarOverride(id, override);
  }, [markCustomerServiceCustomized, setCsAvatarOverride]);

  const handleSetAvatarVoiceEnabled = useCallback((enabled: boolean) => {
    handleSetCsAvatarOverride(csAvatarId, { voiceEnabled: enabled });
  }, [csAvatarId, handleSetCsAvatarOverride]);

  const handleSetAvatarVoiceGender = useCallback((gender: "female" | "male") => {
    const numberedDefaultStyle = resolveCustomerServiceExpertSequenceMatch(csAvatarId, undefined).voiceStyleKey;
    const numberedDefaultPreset = CUSTOMER_SERVICE_VOICE_PRESETS.find((item) => (
      item.key === numberedDefaultStyle && item.gender === gender
    ));
    const fallbackPreset = numberedDefaultPreset
      || CUSTOMER_SERVICE_VOICE_PRESETS.find((item) => item.gender === gender)
      || CUSTOMER_SERVICE_VOICE_PRESETS[0];
    const currentPreset = CUSTOMER_SERVICE_VOICE_PRESETS.find((item) => item.key === selectedAvatarOverride?.voiceStyleKey);
    const targetPreset = currentPreset?.gender === gender ? currentPreset : fallbackPreset;
    // Store the immediate gender choice as both the current selector and the
    // expert's explicit numbered override. This prevents a legacy numbered
    // default from repainting the control back to its prior gender after HMR
    // or a material-library refresh.
    handleSetCsVoiceGender(gender);
    handleSetCsAvatarOverride(csAvatarId, {
      voiceGender: targetPreset.gender,
      voiceStyleKey: targetPreset.key,
      voiceRate: targetPreset.rate,
    });
  }, [csAvatarId, handleSetCsAvatarOverride, handleSetCsVoiceGender, selectedAvatarOverride?.voiceStyleKey]);

  const handleSetAvatarVoiceRate = useCallback((rate: number) => {
    handleSetCsAvatarOverride(csAvatarId, { voiceRate: rate });
  }, [csAvatarId, handleSetCsAvatarOverride]);

  useEffect(() => {
    if (!currentSiteId || getSiteById(currentSiteId)) return;
    // Source pages may receive a siteId from the plan switcher too, so fetch
    // the plan record whenever it is not available locally.
    void fetchAllSitesFromBackend().finally(() => setSitePlanRevision((value) => value + 1));
  }, [currentSiteId]);

  useEffect(() => {
    const refreshSitePlan = () => setSitePlanRevision((value) => value + 1);
    window.addEventListener("sites-updated", refreshSitePlan);
    return () => window.removeEventListener("sites-updated", refreshSitePlan);
  }, []);

  useLayoutEffect(() => {
    const baseConfig = ensureWorkspaceCatalog(
      configScope,
      getInheritedConfig(configScope, effectiveSiteId) || buildFactoryInitialConfig(configScope)
    );
    const shouldSeedRotatedSiteDefaults =
      configScope === "client" &&
      !!effectiveSiteId &&
      !shouldWriteSharedClientStyle &&
      !hasStoredScopedSiteConfig(effectiveSiteId);
    const inheritedConfig = shouldSeedRotatedSiteDefaults && baseConfig
      ? applyRotatedPlanDefaults(baseConfig, effectiveSiteId)
      : baseConfig;
    const nextSignature = configSignature(inheritedConfig);
    loadedScopeRef.current = configScope;
    inheritedSignatureRef.current = nextSignature;
    appliedConfigSignatureRef.current = nextSignature;
    if (inheritedConfig) {
      skipNextPersistRef.current = true;
      importConfig(inheritedConfig);
      if (shouldSeedRotatedSiteDefaults) {
        setTimeout(() => {
          importAndPersistCurrentScopeSnapshot(inheritedConfig, {
            ensureDefaultFallback: !isRuntimePlanPage,
          });
        }, 0);
      }
    } else {
      setTimeout(() => {
        const nextConfig = useProductMarketStore.getState().exportConfig();
        importAndPersistCurrentScopeSnapshot(nextConfig, {
          ensureDefaultFallback: !isRuntimePlanPage,
        });
      }, 0);
    }
    if (shouldWriteSharedClientStyle && !readSharedStyleSettings()) {
      const seedSource =
        normalizeScopedConfig(
          "client",
          readClientTemplateProductMarketConfig()
        ) ||
        normalizeSharedInitialClientConfig(inheritedConfig || buildFactoryInitialConfig());
      const seedConfig = normalizeSharedInitialClientConfig(seedSource);
      writeSharedStyleSettings(seedConfig);
    }
    setSelectedPaths([]);
    setPreviewTheme(null);
  }, [
    configScope,
    effectiveSiteId,
    importConfig,
    isCentralStyleSettingsPage,
    isRuntimePlanPage,
    normalizeSharedInitialClientConfig,
    shouldWriteSharedClientStyle,
  ]);

  useEffect(() => {
    let active = true;
    let hydrationTimeoutId: number | null = null;
    setRemoteSnapshotHydrated(false);
    // A route can keep the same ProductMarket instance while changing siteId.
    // Rebase the editor immediately on that plan's fast local snapshot and
    // invalidate every dirty-check baseline owned by the previous plan. The
    // verified remote result (when available) establishes the final baseline.
    const localSnapshot = cloneExportableConfigSnapshot(useProductMarketStore.getState().exportConfig());
    loadConfigIntoSettingsDraft(localSnapshot);
    defaultDialogConfigSnapshotRef.current = cloneExportableConfigSnapshot(localSnapshot);
    defaultDialogDraftBaselineRef.current = null;
    defaultDialogVerifiedSignatureRef.current = null;
    defaultDialogProductsBaselineSignatureRef.current = null;
    defaultDialogBaselineReadyRef.current = false;
    setDefaultDialogBaselineReady(false);
    async function hydrateRemoteSnapshot() {
      // The local saved snapshot gives an immediate/offline first paint, but
      // it must not permanently hide a newer verified draft saved by another
      // browser profile. Source saves now await the remote write and normalized
      // readback, so the remote draft-or-published record is authoritative.
      // The interaction revision below still protects edits made while this
      // request is in flight from being replaced by late hydration.
      const hydrationRevision = localVisualEditRevisionRef.current;
      const remoteLoader = getRemoteSnapshotLoader(configScope);
      if (!remoteLoader) return;
      let nextConfig: ExportableConfig | null = null;
      try {
        nextConfig = await Promise.race([
          remoteLoader.load(),
          new Promise<null>((resolve) => {
            hydrationTimeoutId = window.setTimeout(
              () => resolve(null),
              PRODUCT_MARKET_REMOTE_HYDRATION_TIMEOUT_MS,
            );
          }),
        ]);
      } catch {
        // Offline and failed source reads deliberately fall back to the local
        // snapshot. A transport failure must never leave the editor inert.
        return;
      } finally {
        if (hydrationTimeoutId !== null) {
          window.clearTimeout(hydrationTimeoutId);
          hydrationTimeoutId = null;
        }
      }
      if (!active || !nextConfig || localVisualEditRevisionRef.current !== hydrationRevision) return;
      const signature = configSignature(nextConfig);
      if (signature === appliedConfigSignatureRef.current) return;
      importAndPersistCurrentScopeSnapshot(nextConfig, {
        includeDefault: remoteLoader.includeDefault,
        // Hydration mirrors an already-authoritative server snapshot into the
        // local cache. It must never turn a passive page open into a template
        // mutation; only the explicit save transaction may write remotely.
        skipRemoteSnapshot: true,
      });
      // Route-owned settings drafts are created from the fast local snapshot.
      // Advance that whole draft and its cancel baseline with the same verified
      // remote record so a later save cannot mix old browser-local fields with
      // the newly hydrated source configuration.
      loadConfigIntoSettingsDraft(nextConfig);
      defaultDialogConfigSnapshotRef.current = cloneExportableConfigSnapshot(nextConfig);
      inheritedSignatureRef.current = signature;
      appliedConfigSignatureRef.current = signature;
    }
    void hydrateRemoteSnapshot().finally(() => {
      if (active) setRemoteSnapshotHydrated(true);
    });
    return () => {
      active = false;
      if (hydrationTimeoutId !== null) window.clearTimeout(hydrationTimeoutId);
    };
  }, [
    configScope,
    effectiveSiteId,
    loadConfigIntoSettingsDraft,
  ]);

  useLayoutEffect(() => {
    productMarketRootRef.current?.toggleAttribute("inert", !remoteSnapshotHydrated);
  }, [remoteSnapshotHydrated]);

  useEffect(() => {
    if (loadedScopeRef.current !== configScope) return;
    if (saveOperationInFlightRef.current) return;
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    const config = {
      ...buildSharedAwareConfig(exportConfig()),
      sidebarStyleSyncVersion: SIDEBAR_STYLE_SYNC_VERSION,
    };
    const signature = configSignature(config);
    if (signature === inheritedSignatureRef.current || signature === appliedConfigSignatureRef.current) return;
    appliedConfigSignatureRef.current = signature;
    persistCurrentScopeLiveConfig(config);
  }, [
    configScope,
    products,
    customDefaultPaths,
    layoutStyle,
    activeTheme,
    productOrder,
    customThemes,
    sidebarStyle,
    globalFontFamily,
    globalFontWeight,
    globalLetterSpacing,
    soundEnabled,
    soundVolume,
    soundStyle,
    csVoiceEnabled,
    csVoiceGender,
    csVoiceRate,
    customProducts,
    csAvatarId,
    csEnabled,
    csAvatarOverrides,
    customerServiceCustomized,
    layoutCustomized,
    layoutStructureCustomized,
    exportConfig,
  ]);

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];

    // Only Service, Operations and Column Configuration own a live expert
    // projection. All three reuse readCustomerServiceMedia and its shared
    // asset cache; no projection copies avatar data.
    if (!expertAvatarWorkspaceActive || isDevelopmentGuide || isPlatformBlueprint) {
      setAvatarPreviewMap({});
      setAvatarVoicePreview({});
      setAvatarSoundPreview({});
      return () => {
        active = false;
      };
    }

    type AvatarMediaPreview = { url: string; kind: "image" | "video" };
    type AvatarMediaPreviewEntry = readonly [avatarId: string, preview: AvatarMediaPreview];
    type AvatarVoicePreviewEntry = readonly [avatarId: string, preview: CustomerServiceVoicePreviewMap[string]];
    type AvatarSoundPreviewEntry = readonly [avatarId: string, preview: CustomerServiceReminderPreviewMap[string]];

    const assignObjectUrl = (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      if (!active) {
        URL.revokeObjectURL(url);
        return undefined;
      }
      objectUrls.push(url);
      return url;
    };

    const mergeAvatarPreviews = (entries: AvatarMediaPreviewEntry[]) => {
      if (!active || entries.length === 0) return;
      const nextPreviews = Object.fromEntries(entries) as Record<string, AvatarMediaPreview>;
      setAvatarPreviewMap((current) => {
        const changed = Object.entries(nextPreviews).some(([avatarId, preview]) => (
          current[avatarId]?.url !== preview.url || current[avatarId]?.kind !== preview.kind
        ));
        return changed ? { ...current, ...nextPreviews } : current;
      });
    };

    async function loadAvatarMediaPreview(
      avatarId: string,
      override: CustomerServiceAvatarOverride,
      materialReference?: CustomerServiceLocalMaterialReference | null,
    ): Promise<AvatarMediaPreviewEntry | null> {
      if (override.imageDataUrl) {
        return [avatarId, {
          url: override.imageDataUrl,
          kind: isCustomerServiceVideoMimeType(override.mediaMimeType) ? "video" : "image",
        }] as const;
      }
      if (!materialReference) return null;
      try {
        const preview = await readCustomerServiceMediaPreview(materialReference);
        const media = preview?.media;
        if (!active || !preview || !media || (media.kind !== "image" && media.kind !== "video")) return null;
        return [avatarId, { url: preview.url, kind: media.kind }] as const;
      } catch {
        // Leave preview empty when media loading fails.
        return null;
      }
    }

    async function loadAvatarSoundPreviews(
      avatarId: string,
      override: CustomerServiceAvatarOverride
    ): Promise<AvatarSoundPreviewEntry | null> {
      const nextSound: CustomerServiceReminderPreviewMap[string] = {};
      const styledSoundAssets = override.soundAssetsByStyle || {};
      const activeReminderStyle = resolveCustomerServiceExpertSequenceMatch(avatarId, override).reminderStyleKey;
      const legacySoundAssetId = Object.keys(styledSoundAssets).length > 0 ? undefined : override.soundAssetId;
      if (legacySoundAssetId) {
        try {
          const soundMedia = await readCustomerServiceMedia(legacySoundAssetId);
          if (soundMedia && soundMedia.kind === "audio") {
            const url = assignObjectUrl(soundMedia.blob);
            if (url) {
              nextSound.default = {
                fileName: override.soundAssetFileName,
                url,
              };
            }
          }
        } catch {
          // Keep reminder sound preview usable even if loading fails.
        }
      }
      for (const [styleKey, asset] of Object.entries(styledSoundAssets)) {
        if (styleKey !== activeReminderStyle || !asset?.assetId) continue;
        try {
          const soundMedia = await readCustomerServiceMedia(asset.assetId);
          if (soundMedia && soundMedia.kind === "audio") {
            const url = assignObjectUrl(soundMedia.blob);
            if (url) {
              nextSound.byStyle = {
                ...(nextSound.byStyle || {}),
                [styleKey]: {
                  fileName: asset.fileName,
                  url,
                },
              };
            }
          }
        } catch {
          // Keep style reminder sound preview usable even if loading fails.
        }
      }
      if (nextSound.default || nextSound.byStyle) {
        return [avatarId, nextSound] as const;
      }
      return null;
    }

    async function loadAvatarVoicePreviews(
      avatarId: string,
      override: CustomerServiceAvatarOverride
    ): Promise<AvatarVoicePreviewEntry | null> {
      const nextVoice: CustomerServiceVoicePreviewMap[string] = {};
      const hasStyledVoiceAssets = Boolean(override.voiceAssetsByStyle && Object.keys(override.voiceAssetsByStyle).length > 0);
      const activeVoiceStyle = resolveCustomerServiceExpertSequenceMatch(avatarId, override).voiceStyleKey;
      const legacyFemaleAssetId =
        hasStyledVoiceAssets ? undefined : override.femaleVoiceAssetId;
      if (legacyFemaleAssetId) {
        try {
          const voiceMedia = await readCustomerServiceMedia(legacyFemaleAssetId);
          if (voiceMedia && voiceMedia.kind === "audio") {
            const url = assignObjectUrl(voiceMedia.blob);
            if (url) {
              nextVoice.female = {
                fileName: override.femaleVoiceAssetFileName,
                url,
              };
            }
          }
        } catch {
          // Keep panel usable if female voice preview fails.
        }
      }
      const legacyMaleAssetId =
        hasStyledVoiceAssets ? undefined : override.maleVoiceAssetId;
      if (legacyMaleAssetId) {
        try {
          const voiceMedia = await readCustomerServiceMedia(legacyMaleAssetId);
          if (voiceMedia && voiceMedia.kind === "audio") {
            const url = assignObjectUrl(voiceMedia.blob);
            if (url) {
              nextVoice.male = {
                fileName: override.maleVoiceAssetFileName,
                url,
              };
            }
          }
        } catch {
          // Keep panel usable if male voice preview fails.
        }
      }
      for (const [styleKey, asset] of Object.entries(override.voiceAssetsByStyle || {})) {
        if (styleKey !== activeVoiceStyle || !asset?.assetId) continue;
        try {
          const voiceMedia = await readCustomerServiceMedia(asset.assetId);
          if (voiceMedia && voiceMedia.kind === "audio") {
            const url = assignObjectUrl(voiceMedia.blob);
            if (url) {
              nextVoice.byStyle = {
                ...(nextVoice.byStyle || {}),
                [styleKey]: {
                  fileName: asset.fileName,
                  url,
                },
              };
            }
          }
        } catch {
          // Keep style voice preview usable even if loading fails.
        }
      }
      if (nextVoice.default || nextVoice.female || nextVoice.male || nextVoice.byStyle) {
        return [avatarId, nextVoice] as const;
      }
      return null;
    }

    async function loadAvatarPreviews() {
      setAvatarPreviewMap({});
      setAvatarVoicePreview({});
      setAvatarSoundPreview({});
      const includeAudioPreviews = activeSettingsTab === "service" && (Boolean(templateSettingsSubview) || showDefaultDialog);

      const orderedEntries = [...avatarPreviewLoadPlan].sort((left, right) => {
        if (left.avatarId === csAvatarId) return -1;
        if (right.avatarId === csAvatarId) return 1;
        return 0;
      });
      const [selectedEntry, ...remainingEntries] = orderedEntries;

      if (selectedEntry) {
        const selectedPreview = await loadAvatarMediaPreview(
          selectedEntry.avatarId,
          selectedEntry.override,
          selectedEntry.materialReference,
        );
        if (!active) return;
        if (selectedPreview) mergeAvatarPreviews([selectedPreview]);

        // The operations, modules and layout pages only render expert avatars.
        // Voice/reminder blobs belong to the selected expert in Service; settle
        // them together and commit each preview map at most once.
        if (includeAudioPreviews) {
          const [selectedVoice, selectedSound] = await Promise.allSettled([
            loadAvatarVoicePreviews(selectedEntry.avatarId, selectedEntry.override),
            loadAvatarSoundPreviews(selectedEntry.avatarId, selectedEntry.override),
          ]);
          if (!active) return;
          if (selectedVoice.status === "fulfilled" && selectedVoice.value) {
            const [avatarId, preview] = selectedVoice.value;
            setAvatarVoicePreview((current) => ({ ...current, [avatarId]: preview }));
          }
          if (selectedSound.status === "fulfilled" && selectedSound.value) {
            const [avatarId, preview] = selectedSound.value;
            setAvatarSoundPreview((current) => ({ ...current, [avatarId]: preview }));
          }
        }
      }

      const loadRemainingInSmallBatches = async () => {
        for (let index = 0; active && index < remainingEntries.length; index += 3) {
          const settledPreviews = await Promise.allSettled(
            remainingEntries.slice(index, index + 3).map(({ avatarId, override, materialReference }) => (
              loadAvatarMediaPreview(avatarId, override, materialReference)
            )),
          );
          if (!active) return;
          const nextBatchPreviews: AvatarMediaPreviewEntry[] = [];
          settledPreviews.forEach((result) => {
            if (result.status === "fulfilled" && result.value) nextBatchPreviews.push(result.value);
          });
          mergeAvatarPreviews(nextBatchPreviews);
        }
      };
      const idleWindow = window as Window & typeof globalThis & {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      };
      if (idleWindow.requestIdleCallback) {
        idleWindow.requestIdleCallback(() => { void loadRemainingInSmallBatches(); }, { timeout: 1200 });
      } else {
        window.setTimeout(() => { void loadRemainingInSmallBatches(); }, 250);
      }
    }

    void loadAvatarPreviews();
    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [activeSettingsTab, avatarPreviewLoadSignature, csAvatarId, expertAvatarWorkspaceActive, isDevelopmentGuide, isPlatformBlueprint, showDefaultDialog, templateSettingsSubview]);

  useEffect(() => {
    if (!isHQMaterialAssetsPage) return;
    void loadMaterialAssets();
  }, [isHQMaterialAssetsPage, loadMaterialAssets]);

  useEffect(() => {
    if (!showDefaultDialog) return;
    const node = defaultDialogViewportRef.current;
    if (!node) return;
    const syncWidth = () => {
      const width = Math.round(node.getBoundingClientRect().width);
      if (width > 0) setDefaultDialogViewportWidth(width);
    };
    syncWidth();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => syncWidth()) : null;
    observer?.observe(node);
    window.addEventListener("resize", syncWidth);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", syncWidth);
    };
  }, [showDefaultDialog]);

  useEffect(() => {
    if (isCentralStyleSettingsPage) return;

    const refreshInheritedConfig = (event?: Event) => {
      if (event instanceof StorageEvent) {
        if (!event.key) return;
        const relevantKeys = [
          buildSharedStyleStorageKey(),
          buildSharedStyleStorageKey(effectiveSiteId),
          ...relevantProductMarketStorageKeys(effectiveSiteId),
        ];
        if (!relevantKeys.includes(event.key)) return;
      }
      const nextConfig = getInheritedConfig(configScope, effectiveSiteId);
      if (!nextConfig) return;
      const nextSignature = configSignature(nextConfig);
      if (nextSignature === appliedConfigSignatureRef.current) return;
      if (nextSignature === inheritedSignatureRef.current && !previewTheme) return;
      inheritedSignatureRef.current = nextSignature;
      appliedConfigSignatureRef.current = nextSignature;
      skipNextPersistRef.current = true;
      importConfig(nextConfig);
      setPreviewTheme(null);
    };

    window.addEventListener(PRODUCT_MARKET_SHARED_STYLE_EVENT, refreshInheritedConfig);
    window.addEventListener("storage", refreshInheritedConfig);
    return () => {
      window.removeEventListener(PRODUCT_MARKET_SHARED_STYLE_EVENT, refreshInheritedConfig);
      window.removeEventListener("storage", refreshInheritedConfig);
    };
  }, [configScope, effectiveSiteId, importConfig, isCentralStyleSettingsPage, previewTheme]);

  useEffect(() => {
    const liveProducts = buildEditableProducts(products);
    const liveSignature = JSON.stringify(liveProducts);
    setTempProducts((current) => {
      const currentSignature = JSON.stringify(current);
      if (!defaultDialogBaselineReadyRef.current) {
        return currentSignature === liveSignature ? current : liveProducts;
      }
      // Code-owned catalogue migrations may finish after the editor opens.
      // Absorb them only while the user has not changed the product draft;
      // once the signatures diverge, the visible draft remains authoritative.
      const baselineSignature = defaultDialogProductsBaselineSignatureRef.current;
      if (!baselineSignature || currentSignature !== baselineSignature) return current;
      defaultDialogProductsBaselineSignatureRef.current = liveSignature;
      return currentSignature === liveSignature ? current : liveProducts;
    });
  }, [products]);

  // Legacy stored configurations used the former category route. Migrate once
  // to 01.蓄势 → 12.固本, then preserve later drag-and-drop changes.
  useEffect(() => {
    if (moduleOrderBaselineVersion >= PRODUCT_MODULE_BASELINE_VERSION) return;
    applyProductModuleBaseline();
  }, [applyProductModuleBaseline, moduleOrderBaselineVersion]);

  useEffect(() => {
    // 配置异步载入、删除或变更后，只清理已不存在的展开项。
    // 不自动展开新增二级栏目，确保打开栏目配置时的首屏 DOM 保持轻量。
    setExpandedModulePaths((current) => current.filter((path) => expandableModulePaths.includes(path)));
  }, [expandableModulePaths.join("|")]);

  // Compute effective product styles for preview
  const effectiveProducts = useMemo(() => {
    if (!previewTheme) return operationDraftProducts;
    const preset = allThemes.find((t) => t.key === previewTheme);
    if (!preset) return operationDraftProducts;
    return operationDraftProducts.map((p) => {
      const colors = preset[
        p.status === "active" ? "cardActive" : p.status === "hidden" ? "cardHidden" : "cardInactive"
      ];
      return {
        ...p,
        customStyle: {
          ...p.customStyle,
          bgColor: colors.bg,
          borderColor: colors.border,
          fontColor: colors.font,
          buttonColor: colors.button,
          nameFontColor: colors.nameFont || colors.font,
        },
      };
    });
  }, [previewTheme, operationDraftProducts, allThemes]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const toggleSelect = (path: string) => {
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedPaths([]);
    } else {
      setSelectedPaths([...allPaths]);
    }
  };

  const requestBatchStatusAction = useCallback((
    targetPaths: readonly string[],
    status: ProductStatus,
    options?: {
      categoryLabel?: string;
      clearSelectionAfterConfirm?: boolean;
    },
  ) => {
    const targetDraftPaths = [...new Set(targetPaths)];
    if (targetDraftPaths.length === 0) return;
    const statusLabel = status === "active" ? "开通" : status === "inactive" ? "取消" : "隐藏";
      const changedPaths = targetDraftPaths.filter(
        (path) => operationDraftProductByPath.get(path)?.status !== status
      );
      const changedProductLabels = changedPaths.map((path) => {
        const product = operationDraftProductByPath.get(path);
        return product?.customLabel || product?.label || path;
      });
    const statusOutcome = status === "active"
      ? "将在左侧导航显示并恢复可用"
      : status === "inactive"
        ? "将保留入口但显示为不可用"
        : "将从左侧导航隐藏";

    if (changedPaths.length === 0) {
      const targetLabel = options?.categoryLabel
        ? `分类“${options.categoryLabel}”内的 ${targetDraftPaths.length} 个产品`
        : `已选择的 ${targetDraftPaths.length} 个产品`;
      toast.info(`${targetLabel}均已是“${statusLabel}”状态，无需重复修改。`);
      return;
    }

    const categoryScope = options?.categoryLabel ? `分类“${options.categoryLabel}”` : "已选产品";
    openSourceActionDialog({
      title: options?.categoryLabel ? `确认分类批量${statusLabel}` : `确认批量${statusLabel}`,
      description: `${categoryScope}目标 ${changedPaths.length} 项：${changedProductLabels.slice(0, 6).join("、")}${changedProductLabels.length > 6 ? ` 等 ${changedProductLabels.length} 项` : ""}。预计结果：${statusOutcome}。规划应用仍保留“规划”成熟度标识，栏目状态不代表能力已经交付。确认并完成读条后会立即保存到当前模板或当前计划快照。`,
      confirmLabel: `确认批量${statusLabel}`,
      busyLabel: `正在批量${statusLabel}...`,
      minimumBusyMs: 3000,
      onConfirm: async () => {
        playClickSound("batch");
        // Keep the operation draft and the exported snapshot on the same
        // status transaction. `pendingOperationStatusRef` is synchronous,
        // so the snapshot below cannot be rebuilt with a stale active value.
        updateOperationDraftStatus(changedPaths, status);
        // The Sidebar reads the live catalogue rather than the dialog draft.
        // Update it in the same transaction before exporting the snapshot.
        batchSetStatus(changedPaths, status);
        // Export after the catalogue mutation. Reading a component draft here
        // allowed a later rehydration to restore the prior status.
        const liveConfig = useProductMarketStore.getState().exportConfig();
        const changedPathSet = new Set(changedPaths);
        const nextConfig = buildSharedAwareConfig({
          ...liveConfig,
          products: liveConfig.products.map((product) => (
            changedPathSet.has(product.path) ? { ...product, status } : product
          )),
          customDefaultPaths: liveConfig.products
            .filter((product) => changedPathSet.has(product.path) ? status === "active" : product.status === "active")
            .map((product) => product.path),
        }, {
          includeLayoutFlags: true,
        });
        const committed = commitConfigSnapshot(nextConfig, {
          syncCustomizationFlags: shouldSyncCustomizationFlagsWithSnapshot,
          syncMaterialAssets: true,
          runtimeSnapshotOnly: shouldPersistRuntimeSnapshotOnly,
          writeSharedStyle: shouldWriteSharedClientStyle,
          // Source operations must update the same template record used on
          // the next load. A site-only snapshot is lower priority than that
          // source record and was therefore overwritten after refresh.
          useCurrentScopePersist: templateLifecycleRole === "source",
          includeDefault: false,
          skipRemoteSnapshot: true,
        });
        if (!committed) return;
        await persistAndVerifyScopedSnapshot(configScope, effectiveSiteId, nextConfig);
        // A route-level catalogue subscription may run after the remote
        // verification. Re-apply the confirmed status so every reader sees
        // the same value during that handoff.
        batchSetStatus(changedPaths, status);
        // `updateOperationDraftStatus` already updated the rendered draft.
        // Keeping that confirmed status avoids a stale store read repainting
        // 02.布场(内容) before the shared catalogue subscription catches up.
        if (options?.clearSelectionAfterConfirm) setSelectedPaths([]);
        toast.success(`${options?.categoryLabel ? `${options.categoryLabel}已` : "已"}批量${statusLabel}并保存：${changedPaths.length} 个产品已正式生效。`);
      },
    });
  }, [
    configScope,
    effectiveSiteId,
    openSourceActionDialog,
    operationDraftProductByPath,
    shouldPersistRuntimeSnapshotOnly,
    shouldSyncCustomizationFlagsWithSnapshot,
    shouldWriteSharedClientStyle,
    batchSetStatus,
    templateLifecycleRole,
    updateOperationDraftStatus,
  ]);

  const handleBatchAction = useCallback((status: ProductStatus) => {
    requestBatchStatusAction(selectedPaths, status, { clearSelectionAfterConfirm: true });
  }, [requestBatchStatusAction, selectedPaths]);

  const handleCategoryBatchAction = useCallback((
    categoryLabel: string,
    categoryPaths: readonly string[],
    status: ProductStatus,
  ) => {
    requestBatchStatusAction(categoryPaths, status, { categoryLabel });
  }, [requestBatchStatusAction]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = flattenedModuleProductPaths.indexOf(String(active.id));
      const newIndex = flattenedModuleProductPaths.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;
      const orderedProductPaths = [...flattenedModuleProductPaths];
      const orderedPaths = arrayMove(orderedProductPaths, oldIndex, newIndex);
      setTempProducts((current) => {
        const pathToProduct = new Map(current.map((product) => [product.path, product]));
        return orderedPaths
          .map((path) => pathToProduct.get(path))
          .filter(Boolean) as EditableModuleItem[];
      });
    },
    [flattenedModuleProductPaths]
  );

  const getStatusBadge = (status: ProductStatus, colors: { bg: string; border: string; font: string; button: string; nameFont?: string }) => {
    const badgeStyle = getProductMarketStatusControlStyle(colors);
    switch (status) {
      case "active":
        return (
          <Badge
            data-product-market-status-badge={status}
            data-shared-status-card-source="product-card-colors"
            className="inline-flex h-6 shrink-0 items-center whitespace-nowrap border-0 px-2 text-xs font-medium leading-none"
            style={badgeStyle}
          >
            已开通          </Badge>
        );
      case "inactive":
        return (
          <Badge
            data-product-market-status-badge={status}
            data-shared-status-card-source="product-card-colors"
            className="inline-flex h-6 shrink-0 items-center whitespace-nowrap border-0 px-2 text-xs font-medium leading-none"
            style={badgeStyle}
          >
            已取消          </Badge>
        );
      case "hidden":
        return (
          <Badge
            data-product-market-status-badge={status}
            data-shared-status-card-source="product-card-colors"
            className="inline-flex h-6 shrink-0 items-center whitespace-nowrap border-0 px-2 text-xs font-medium leading-none"
            style={badgeStyle}
          >
            已隐藏
          </Badge>
        );
    }
  };

  // Theme hover preview handlers
  const handleThemeHoverEnter = (key: ThemePresetKey | string) => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    previewTimeoutRef.current = setTimeout(() => {
      setPreviewTheme(key as ThemePresetKey);
    }, 150);
  };

  const handleThemeHoverLeave = () => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    setPreviewTheme(null);
  };

  const updateTempProduct = (path: string, updater: (current: EditableModuleItem) => EditableModuleItem) => {
    setTempProducts((current) => current.map((item) => (item.path === path ? updater(item) : item)));
  };

  const moveTempProduct = (path: string, direction: "up" | "down") => {
    setTempProducts((current) => {
      const displayOrder = flattenedModuleProductPaths;
      const index = displayOrder.indexOf(path);
      if (index === -1) return current;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= displayOrder.length) return current;
      const orderedPaths = arrayMove(displayOrder, index, nextIndex);
      const pathToProduct = new Map(current.map((product) => [product.path, product]));
      return orderedPaths
        .map((itemPath) => pathToProduct.get(itemPath))
        .filter(Boolean) as EditableModuleItem[];
    });
  };

  const moveTempCategory = (categoryKey: string, direction: "up" | "down") => {
    if (!allowModuleCategoryReorder) return;
    const orderedCategoryKeys = normalizeModuleCategoryOrderForScope(configScope, tempModuleCategoryOrder);
    const sourceIndex = orderedCategoryKeys.indexOf(categoryKey);
    if (sourceIndex === -1) return;
    const nextIndex = direction === "up" ? sourceIndex - 1 : sourceIndex + 1;
    if (nextIndex < 0 || nextIndex >= orderedCategoryKeys.length) return;
    setTempModuleCategoryOrder((currentOrder) => {
      const sourceCategoryOrder = normalizeModuleCategoryOrderForScope(configScope, currentOrder);
      const reorderSourceIndex = sourceCategoryOrder.indexOf(categoryKey);
      if (reorderSourceIndex === -1) return currentOrder;
      const reorderTargetIndex = direction === "up" ? reorderSourceIndex - 1 : reorderSourceIndex + 1;
      if (reorderTargetIndex < 0 || reorderTargetIndex >= sourceCategoryOrder.length) return currentOrder;
      return arrayMove(sourceCategoryOrder, reorderSourceIndex, reorderTargetIndex);
    });
    markLayoutStructureCustomized();
  };

  const setTempProductCategory = (path: string, targetCategoryKey: string) => {
    setTempModuleCategoryAssignments((current) => {
      if (current[path] === targetCategoryKey) return current;
      return {
        ...current,
        [path]: targetCategoryKey,
      };
    });
  };

  const moveTempChildAcrossCategory = (
    activeChildPath: string,
    activeParentPath: string,
    overParentPath: string,
    overChildPath: string
  ) => {
    setTempProducts((current) => {
      const activeParentIndex = current.findIndex((item) => item.path === activeParentPath);
      const overParentIndex = current.findIndex((item) => item.path === overParentPath);
      if (activeParentIndex === -1 || overParentIndex === -1) return current;
      if (activeParentPath === overParentPath) return current;

      const activeParent = current[activeParentIndex];
      const overParent = current[overParentIndex];
      const activeChildIndex = activeParent.children.findIndex((child) => child.path === activeChildPath);
      if (activeChildIndex === -1) return current;
      const movedChild = activeParent.children[activeChildIndex];
      const movedChilds = [...activeParent.children];
      movedChilds.splice(activeChildIndex, 1);

      const overChildIndex =
        overParent.children.findIndex((child) => child.path === overChildPath);
      const insertIndex = overChildIndex === -1 ? overParent.children.length : overChildIndex;
      const nextOverChildren = [...overParent.children];
      nextOverChildren.splice(insertIndex, 0, movedChild);

      return current.map((item, index) => {
        if (index === activeParentIndex) {
          return {
            ...item,
            children: movedChilds,
          };
        }
        if (index === overParentIndex) {
          return {
            ...item,
            children: nextOverChildren,
          };
        }
        return item;
      });
    });
  };

  const handleModuleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeCategory = decodeModuleCategorySortId(activeId);
    const overCategory = decodeModuleCategorySortId(overId);
    const activeParent = tempProducts.find((product) => product.children.some((child) => child.path === activeId));
    const overParent = tempProducts.find((product) => product.children.some((child) => child.path === overId));

    if (activeCategory) {
      if (!allowModuleCategoryReorder) return;
      if (overCategory) {
        const sourceIndex = normalizeModuleCategoryOrderForScope(configScope, tempModuleCategoryOrder)
          .indexOf(activeCategory);
        const targetIndex = normalizeModuleCategoryOrderForScope(configScope, tempModuleCategoryOrder)
          .indexOf(overCategory);
        if (sourceIndex !== -1 && targetIndex !== -1 && sourceIndex !== targetIndex) {
          setTempModuleCategoryOrder((current) => arrayMove(
            normalizeModuleCategoryOrderForScope(configScope, current),
            sourceIndex,
            targetIndex
          ));
          markLayoutStructureCustomized();
        }
      } else if (pathToCategoryKeyMap.get(overId)) {
        const overProductCategory = pathToCategoryKeyMap.get(overId);
        if (overProductCategory) {
          const sourceIndex = normalizeModuleCategoryOrderForScope(configScope, tempModuleCategoryOrder)
            .indexOf(activeCategory);
          const targetIndex = normalizeModuleCategoryOrderForScope(configScope, tempModuleCategoryOrder)
            .indexOf(overProductCategory);
          if (sourceIndex !== -1 && targetIndex !== -1 && sourceIndex !== targetIndex) {
            setTempModuleCategoryOrder((current) => arrayMove(
              normalizeModuleCategoryOrderForScope(configScope, current),
              sourceIndex,
              targetIndex
            ));
            markLayoutStructureCustomized();
          }
        }
      }
      return;
    }

    if (activeParent && overParent) {
      if (activeParent.path === overParent.path) {
        reorderTempChild(activeParent.path, activeId, overId);
      } else {
        moveTempChildAcrossCategory(activeId, activeParent.path, overParent.path, overId);
        markLayoutStructureCustomized();
      }
      return;
    }

    const displayOrder = flattenedModuleProductPaths;
    const oldIndex = displayOrder.indexOf(activeId);
    if (oldIndex === -1) return;

    let newIndex = displayOrder.indexOf(overId);
    if (newIndex === -1 && overCategory) {
      const targetItems = categoryItemOrderMap.get(overCategory) || [];
      const anchorPath = targetItems[targetItems.length - 1];
      newIndex = anchorPath ? displayOrder.indexOf(anchorPath) + 1 : displayOrder.length;
    }
    if (newIndex === -1) {
      const overProductCategory = pathToCategoryKeyMap.get(overId);
      const targetItems = overProductCategory ? (categoryItemOrderMap.get(overProductCategory) || []) : [];
      const anchorPath = targetItems[targetItems.length - 1];
      newIndex = anchorPath ? displayOrder.indexOf(anchorPath) + 1 : displayOrder.length;
    }

    if (newIndex === -1) return;
    if (newIndex < 0) newIndex = 0;
    if (newIndex > displayOrder.length) newIndex = displayOrder.length;

    const targetCategoryKey = overCategory || pathToCategoryKeyMap.get(overId);
    const activeCategoryKey = pathToCategoryKeyMap.get(activeId);
    if (targetCategoryKey && activeCategoryKey !== targetCategoryKey) {
      setTempProductCategory(activeId, targetCategoryKey);
    }

    if (newIndex !== oldIndex) {
      const orderedPaths = arrayMove(displayOrder, oldIndex, newIndex);
      setTempProducts((current) => {
        const pathToProduct = new Map(current.map((product) => [product.path, product]));
        return orderedPaths
          .map((itemPath) => pathToProduct.get(itemPath))
          .filter(Boolean) as EditableModuleItem[];
      });
      markLayoutStructureCustomized();
    }
  }, [
    allowModuleCategoryReorder,
    categoryItemOrderMap,
    configScope,
    moveTempChildAcrossCategory,
    pathToCategoryKeyMap,
    reorderTempChild,
    markLayoutStructureCustomized,
    setTempProductCategory,
    tempModuleCategoryOrder,
    flattenedModuleProductPaths,
    tempProducts,
  ]);

  const updateTempChild = (
    parentPath: string,
    childPath: string,
    updater: (current: EditableModuleChild) => EditableModuleChild
  ) => {
    setTempProducts((current) =>
      current.map((item) => {
        if (item.path !== parentPath) return item;
        return {
          ...item,
          children: item.children.map((child) => (child.path === childPath ? updater(child) : child)),
        };
      })
    );
  };

  const moveTempChild = (parentPath: string, childPath: string, direction: "up" | "down") => {
    setTempProducts((current) =>
      current.map((item) => {
        if (item.path !== parentPath) return item;
        const index = item.children.findIndex((child) => child.path === childPath);
        if (index === -1) return item;
        const nextIndex = direction === "up" ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= item.children.length) return item;
        return {
          ...item,
          children: arrayMove(item.children, index, nextIndex),
        };
      })
    );
  };

  function reorderTempChild(parentPath: string, activeChildPath: string, overChildPath: string) {
    setTempProducts((current) =>
      current.map((item) => {
        if (item.path !== parentPath) return item;
        const oldIndex = item.children.findIndex((child) => child.path === activeChildPath);
        const newIndex = item.children.findIndex((child) => child.path === overChildPath);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return item;
        return {
          ...item,
          children: arrayMove(item.children, oldIndex, newIndex),
        };
      })
    );
  }

  // Custom theme helpers
  const openNewThemeEditor = () => {
    const neutralCard = (card: CardColors): CardColors => ({
      ...card,
      bg: "#FFFFFF",
      border: "#111111",
      font: "#000000",
      nameFont: "#000000",
      button: "#111111",
    });
    // Start from the current factory palette contract, never from the page's
    // in-progress colours.  This keeps newly created themes aligned with the
    // latest seven external palette cards while giving the editor a neutral,
    // easy-to-read white canvas by default.
    const factoryTheme = getFactoryBuiltinThemes()[0];
    const externalLayoutExtensions = Object.fromEntries(
      Object.entries(tempLayout).filter(([key]) => !(key in factoryTheme.layout))
    );
    const neutralLayout: LayoutCustomStyle = {
      ...factoryTheme.layout,
      ...externalLayoutExtensions,
      headerBgColor: "#FFFFFF",
      headerTextColor: "#000000",
      footerBgColor: "#FFFFFF",
      footerTextColor: "#000000",
      contentBgColor: "#FFFFFF",
      contentTextColor: "#000000",
      clientTopbarBgColor: "#FFFFFF",
      clientTopbarTextColor: "#000000",
      clientTopbarOverrideBgColor: "#FFFFFF",
      clientTopbarOverrideTextColor: "#000000",
      clientFooterOverrideBgColor: "#FFFFFF",
      clientFooterOverrideTextColor: "#000000",
      clientFeatureCardBgColor: "#FFFFFF",
      clientFeatureCardTextColor: "#000000",
      clientCardBgColor: "#FFFFFF",
      clientCardTextColor: "#000000",
      clientSecondaryPageBgColor: "#FFFFFF",
      clientSecondaryPageTextColor: "#000000",
      clientSecondaryTitleBgColor: "#FFFFFF",
      clientSecondaryTitleTextColor: "#000000",
      clientSecondaryListBgColor: "#FFFFFF",
      clientSecondaryListTextColor: "#000000",
      clientSecondaryContentBgColor: "#FFFFFF",
      clientSecondaryContentTextColor: "#000000",
      clientLargeCardBgColor: "#FFFFFF",
      clientLargeCardTextColor: "#000000",
      themePanelBgColor: "#FFFFFF",
      themePanelTextColor: "#000000",
      themePanelButtonColor: "#111111",
      headerButtonTextColor: "#000000",
      footerAccentColor: "#111111",
      siteSwitchLoadingCardBgColor: "#FFFFFF",
      siteSwitchLoadingCardTextColor: "#000000",
      customerServiceLauncherBgColor: "#FFFFFF",
      customerServiceLauncherIconColor: "#000000",
      customerServicePanelBgColor: "#FFFFFF",
      customerServicePanelHeaderBgColor: "#FFFFFF",
      customerServicePanelHeaderTextColor: "#000000",
      customerServiceAssistantMsgBgColor: "#FFFFFF",
      customerServiceAssistantMsgTextColor: "#000000",
      customerServiceUserMsgBgColor: "#FFFFFF",
      customerServiceUserMsgTextColor: "#000000",
      customerServiceInputBorderColor: "#111111",
      defaultDialogBgColor: "#FFFFFF",
      defaultDialogHeaderBgColor: "#FFFFFF",
      defaultDialogPanelBgColor: "#FFFFFF",
      defaultDialogContentBgColor: "#FFFFFF",
      defaultDialogHeaderTextColor: "#000000",
      defaultDialogButtonColor: "#111111",
      defaultDialogButtonTextColor: "#FFFFFF",
    };
    setEditingThemeKey(null);
    setThemeForm({
      key: `custom-${Date.now()}`,
      name: "白底黑字主题",
      description: "从白底黑字的主体与小卡片开始创建；标题、表头、状态和侧边栏可再独立调整。",
      fontFamily: DEFAULT_DESIGN_FONT_STACK,
      layout: neutralLayout,
      sidebar: {
        ...factoryTheme.sidebar,
        bgFrom: "#FFFFFF",
        bgVia: "#FFFFFF",
        bgTo: "#FFFFFF",
        textColor: "#000000",
        activeHighlight: "#111111",
        borderColor: "#111111",
      },
      cardActive: neutralCard(factoryTheme.cardActive),
      cardInactive: neutralCard(factoryTheme.cardInactive),
      cardHidden: neutralCard(factoryTheme.cardHidden),
    });
    setThemeEditorVisited(true);
    setShowThemeEditor(true);
  };

  const saveThemeForm = () => {
    if (!themeForm.name.trim()) return;
    if (editingThemeKey) {
      if (BUILTIN_KEYS.has(editingThemeKey)) {
        updateBuiltinTheme(editingThemeKey, themeForm);
      } else {
        updateCustomTheme(editingThemeKey, themeForm);
      }
      // Re-apply theme if currently active
      if (activeTheme === editingThemeKey) {
        // Delay to let store update
        setTimeout(() => applyTheme(editingThemeKey), 50);
      }
    } else {
      addCustomTheme(themeForm);
    }
    setShowThemeEditor(false);
  };

  const buildThemeLayoutForSwitch = useCallback(
    (
      nextThemeKey: ThemePresetKey | string,
      metadataSource: LayoutCustomStyle
    ): LayoutCustomStyle | null => {
      const nextTheme =
        getFactoryBuiltinThemes().find((theme) => theme.key === nextThemeKey) ||
        allThemes.find((theme) => theme.key === nextThemeKey) ||
        null;
      if (!nextTheme) return null;
      return {
        ...nextTheme.layout,
        siteSwitchLoadingCardTextColor:
          nextTheme.layout.siteSwitchLoadingCardTextColor || nextTheme.layout.themePanelTextColor || "#0f172a",
        presetThemeBlackTextColor: metadataSource.presetThemeBlackTextColor,
        presetThemeLightTextColor: metadataSource.presetThemeLightTextColor,
        presetThemeRoseTextColor: metadataSource.presetThemeRoseTextColor,
        presetThemeOrangeTextColor: metadataSource.presetThemeOrangeTextColor,
        presetThemeBlackBgColor: metadataSource.presetThemeBlackBgColor,
        presetThemeLightBgColor: metadataSource.presetThemeLightBgColor,
        presetThemeRoseBgColor: metadataSource.presetThemeRoseBgColor,
        presetThemeOrangeBgColor: metadataSource.presetThemeOrangeBgColor,
        presetThemeBlackLabel: metadataSource.presetThemeBlackLabel,
        presetThemeLightLabel: metadataSource.presetThemeLightLabel,
        presetThemeRoseLabel: metadataSource.presetThemeRoseLabel,
        presetThemeOrangeLabel: metadataSource.presetThemeOrangeLabel,
        // 圆角、间距和轻量 3D 只由「可视化」维护。切换主题时保留
        // 当前可视化草案，避免主题页与可视化同时写入造成互相覆盖。
        frameCornerRadius: metadataSource.frameCornerRadius,
        tableHeaderCornerRadius: metadataSource.tableHeaderCornerRadius,
        cardCornerRadius: metadataSource.cardCornerRadius,
        frameDensity: metadataSource.frameDensity,
        frameElevation: metadataSource.frameElevation,
      };
    },
    [allThemes]
  );

  const syncTempThemeOverride = useCallback((updates: {
    layout?: Partial<LayoutCustomStyle>;
    sidebar?: Partial<SidebarStyle>;
    cardActive?: Partial<CardColors>;
    cardInactive?: Partial<CardColors>;
    cardHidden?: Partial<CardColors>;
  }, targetThemeKeyOverride?: string) => {
    const targetThemeKey = targetThemeKeyOverride || resolvedTempThemeKey;
    if (!targetThemeKey || targetThemeKey === "custom") return;

    const currentTheme =
      allThemes.find((theme) => theme.key === targetThemeKey) ||
      getFactoryBuiltinThemes().find((theme) => theme.key === targetThemeKey);
    if (!currentTheme) return;

    const themePatch: Partial<CustomThemeData> = {};
    if (updates.layout) {
      themePatch.layout = { ...currentTheme.layout, ...updates.layout };
    }
    if (updates.sidebar) {
      themePatch.sidebar = { ...currentTheme.sidebar, ...updates.sidebar };
    }
    if (updates.cardActive) {
      themePatch.cardActive = { ...currentTheme.cardActive, ...updates.cardActive };
    }
    if (updates.cardInactive) {
      themePatch.cardInactive = { ...currentTheme.cardInactive, ...updates.cardInactive };
    }
    if (updates.cardHidden) {
      themePatch.cardHidden = { ...currentTheme.cardHidden, ...updates.cardHidden };
    }

    if (BUILTIN_KEYS.has(targetThemeKey)) {
      updateBuiltinTheme(targetThemeKey, themePatch);
      return;
    }
    const customTheme = customThemes.find((theme) => theme.key === targetThemeKey);
    if (customTheme) {
      updateCustomTheme(targetThemeKey, themePatch);
    }
  }, [allThemes, customThemes, resolvedTempThemeKey, updateBuiltinTheme, updateCustomTheme]);

  const applyPresetThemeDefaults = (key: PresetThemeOptionKey) => {
    const mappedThemeKey = PRESET_THEME_KEY_MAP[key];
    const preset =
      getFactoryBuiltinThemes().find((theme) => theme.key === mappedThemeKey) ||
      allThemes.find((theme) => theme.key === mappedThemeKey);
    const fallbackPreset = DEFAULT_PRESET_THEME_COLORS[key];
    const switchedLayout = buildThemeLayoutForSwitch(mappedThemeKey, tempLayout);
    if (!preset || !switchedLayout) return;
    const presetCards = {
      active: preset.cardActive || fallbackPreset.cards.active,
      inactive: preset.cardInactive || fallbackPreset.cards.inactive,
      hidden: preset.cardHidden || fallbackPreset.cards.hidden,
    };
    setSidebarStyle({ ...preset.sidebar });
    setLayoutStyle(switchedLayout);
    setGlobalFontFamily(preset.fontFamily || DEFAULT_DESIGN_FONT_STACK);
    setGlobalFontWeight(preset.layout.globalFontWeight || preset.sidebar.fontWeight || DEFAULT_DESIGN_FONT_WEIGHT);
    setGlobalLetterSpacing(preset.layout.globalLetterSpacing || preset.sidebar.letterSpacing || DEFAULT_DESIGN_LETTER_SPACING);
    updateBuiltinTheme(mappedThemeKey, {
      name: preset.name,
      description: preset.description,
      fontFamily: preset.fontFamily,
      layout: { ...preset.layout },
      sidebar: { ...preset.sidebar },
      cardActive: { ...preset.cardActive },
      cardInactive: { ...preset.cardInactive },
      cardHidden: { ...preset.cardHidden },
    });
    setTempLayout(switchedLayout);
    setTempTheme(mappedThemeKey);
    setTempProducts((current) =>
      current.map((item) => ({
        ...item,
        customStyle: {
          ...item.customStyle,
          bgColor: presetCards[item.status === "active" ? "active" : item.status === "hidden" ? "hidden" : "inactive"].bg,
          borderColor: presetCards[item.status === "active" ? "active" : item.status === "hidden" ? "hidden" : "inactive"].border,
          fontColor: presetCards[item.status === "active" ? "active" : item.status === "hidden" ? "hidden" : "inactive"].font,
          buttonColor: presetCards[item.status === "active" ? "active" : item.status === "hidden" ? "hidden" : "inactive"].button,
          nameFontColor:
            presetCards[item.status === "active" ? "active" : item.status === "hidden" ? "hidden" : "inactive"].nameFont ||
            presetCards[item.status === "active" ? "active" : item.status === "hidden" ? "hidden" : "inactive"].font,
        },
      }))
    );
  };

  const markCurrentTempThemeCustomized = useCallback(() => {
    setTempTheme((current) => markTempThemeAsCustomized(extractBaseThemeKey(current)));
  }, []);

  const updateFineLayout = useCallback((patch: Partial<LayoutCustomStyle>) => {
    setTempLayout((current) => ({ ...current, ...patch }));
    syncTempThemeOverride({ layout: patch });
    markCurrentTempThemeCustomized();
  }, [markCurrentTempThemeCustomized, syncTempThemeOverride]);

  const handleClearCsAvatar = useCallback(async (avatarId: string) => {
    markCustomerServiceCustomized();
    // Clearing detaches this scope only; old materials may still be in use by
    // another expert, plan, or the source factory default.
    clearCsAvatarOverrideImage(avatarId);
    setAvatarPreviewMap((current) => {
      if (!current[avatarId]) return current;
      const next = { ...current };
      delete next[avatarId];
      return next;
    });
    requestCurrentPlanMaterialSync();
    await syncCurrentMaterialAssetUsage();
  }, [clearCsAvatarOverrideImage, markCustomerServiceCustomized, requestCurrentPlanMaterialSync, syncCurrentMaterialAssetUsage]);

  const handleClearCsReminderSound = useCallback(async (avatarId: string) => {
    const currentOverride = csAvatarOverrides[avatarId];
    markCustomerServiceCustomized();
    const selectedStyleKey = resolveCustomerServiceExpertSequenceMatch(avatarId, currentOverride, {
      reminderStyle: soundStyle,
    }).reminderStyleKey;
    const nextSoundAssetsByStyle = { ...(currentOverride?.soundAssetsByStyle || {}) };
    if (selectedStyleKey) {
      delete nextSoundAssetsByStyle[selectedStyleKey];
    }
    handleSetCsAvatarOverride(avatarId, {
      soundAssetId: selectedStyleKey === currentOverride?.soundStyle ? undefined : currentOverride?.soundAssetId,
      soundAssetMimeType: selectedStyleKey === currentOverride?.soundStyle ? undefined : currentOverride?.soundAssetMimeType,
      soundAssetFileName: selectedStyleKey === currentOverride?.soundStyle ? undefined : currentOverride?.soundAssetFileName,
      soundAssetsByStyle: nextSoundAssetsByStyle,
    });
    requestCurrentPlanMaterialSync();
    await syncCurrentMaterialAssetUsage();
  }, [csAvatarOverrides, handleSetCsAvatarOverride, markCustomerServiceCustomized, requestCurrentPlanMaterialSync, soundStyle, syncCurrentMaterialAssetUsage]);

  const handleClearReminderSoundPresetAsset = useCallback(async (avatarId: string, styleKey: string) => {
    const currentOverride = csAvatarOverrides[avatarId];
    const normalizedStyleKey = styleKey.trim();
    if (!normalizedStyleKey) return;
    markCustomerServiceCustomized();
    const nextSoundAssetsByStyle = { ...(currentOverride?.soundAssetsByStyle || {}) };
    delete nextSoundAssetsByStyle[normalizedStyleKey];
    const shouldClearLegacyFields = resolveCustomerServiceExpertSequenceMatch(avatarId, currentOverride, {
      reminderStyle: soundStyle,
    }).reminderStyleKey === normalizedStyleKey;
    handleSetCsAvatarOverride(avatarId, {
      soundAssetId: shouldClearLegacyFields ? undefined : currentOverride?.soundAssetId,
      soundAssetMimeType: shouldClearLegacyFields ? undefined : currentOverride?.soundAssetMimeType,
      soundAssetFileName: shouldClearLegacyFields ? undefined : currentOverride?.soundAssetFileName,
      soundAssetsByStyle: nextSoundAssetsByStyle,
    });
    requestCurrentPlanMaterialSync();
    await syncCurrentMaterialAssetUsage();
  }, [csAvatarOverrides, handleSetCsAvatarOverride, markCustomerServiceCustomized, requestCurrentPlanMaterialSync, soundStyle, syncCurrentMaterialAssetUsage]);

  const handleRestoreReminderMaterialPreset = useCallback(async (avatarId: string, styleKey: string) => {
    const normalizedStyleKey = styleKey.trim();
    if (!normalizedStyleKey) return;
    const currentOverride = csAvatarOverrides[avatarId];
    const nextSoundAssetsByStyle = { ...(currentOverride?.soundAssetsByStyle || {}) };
    const nextReminderImageAssetsByStyle = { ...(currentOverride?.reminderImageAssetsByStyle || {}) };
    delete nextSoundAssetsByStyle[normalizedStyleKey];
    delete nextReminderImageAssetsByStyle[normalizedStyleKey];
    const shouldClearLegacyFields = resolveCustomerServiceExpertSequenceMatch(avatarId, currentOverride, {
      reminderStyle: soundStyle,
    }).reminderStyleKey === normalizedStyleKey;
    markCustomerServiceCustomized();
    handleSetCsAvatarOverride(avatarId, {
      soundAssetId: shouldClearLegacyFields ? undefined : currentOverride?.soundAssetId,
      soundAssetMimeType: shouldClearLegacyFields ? undefined : currentOverride?.soundAssetMimeType,
      soundAssetFileName: shouldClearLegacyFields ? undefined : currentOverride?.soundAssetFileName,
      soundAssetsByStyle: nextSoundAssetsByStyle,
      reminderImageAssetsByStyle: nextReminderImageAssetsByStyle,
    });
    requestCurrentPlanMaterialSync();
    await syncCurrentMaterialAssetUsage();
  }, [csAvatarOverrides, handleSetCsAvatarOverride, markCustomerServiceCustomized, requestCurrentPlanMaterialSync, soundStyle, syncCurrentMaterialAssetUsage]);

  const handleClearVoicePresetAsset = useCallback(async (
    avatarId: string,
    presetKey: string,
    gender: "female" | "male"
  ) => {
    const normalizedPresetKey = presetKey.trim();
    if (!normalizedPresetKey) return;
    const currentOverride = csAvatarOverrides[avatarId];
    const sequenceMatch = resolveCustomerServiceExpertSequenceMatch(avatarId, currentOverride);
    const currentPreset = getCustomerServiceVoicePreset(sequenceMatch.voiceStyleKey, gender);
    const nextVoiceAssetsByStyle = { ...(currentOverride?.voiceAssetsByStyle || {}) };
    delete nextVoiceAssetsByStyle[normalizedPresetKey];
    const nextVoiceImageAssetsByStyle = { ...(currentOverride?.voiceImageAssetsByStyle || {}) };
    delete nextVoiceImageAssetsByStyle[normalizedPresetKey];
    const shouldClearLegacyFields = currentPreset.key === normalizedPresetKey;
    markCustomerServiceCustomized();
    handleSetCsAvatarOverride(avatarId, gender === "female"
      ? {
          voiceAssetId: shouldClearLegacyFields ? undefined : currentOverride?.voiceAssetId,
          voiceAssetMimeType: shouldClearLegacyFields ? undefined : currentOverride?.voiceAssetMimeType,
          voiceAssetFileName: shouldClearLegacyFields ? undefined : currentOverride?.voiceAssetFileName,
          femaleVoiceAssetId: shouldClearLegacyFields ? undefined : currentOverride?.femaleVoiceAssetId,
          femaleVoiceAssetMimeType: shouldClearLegacyFields ? undefined : currentOverride?.femaleVoiceAssetMimeType,
          femaleVoiceAssetFileName: shouldClearLegacyFields ? undefined : currentOverride?.femaleVoiceAssetFileName,
          voiceAssetsByStyle: nextVoiceAssetsByStyle,
          voiceImageAssetsByStyle: nextVoiceImageAssetsByStyle,
        }
      : {
          voiceAssetId: shouldClearLegacyFields ? undefined : currentOverride?.voiceAssetId,
          voiceAssetMimeType: shouldClearLegacyFields ? undefined : currentOverride?.voiceAssetMimeType,
          voiceAssetFileName: shouldClearLegacyFields ? undefined : currentOverride?.voiceAssetFileName,
          maleVoiceAssetId: shouldClearLegacyFields ? undefined : currentOverride?.maleVoiceAssetId,
          maleVoiceAssetMimeType: shouldClearLegacyFields ? undefined : currentOverride?.maleVoiceAssetMimeType,
          maleVoiceAssetFileName: shouldClearLegacyFields ? undefined : currentOverride?.maleVoiceAssetFileName,
          voiceAssetsByStyle: nextVoiceAssetsByStyle,
          voiceImageAssetsByStyle: nextVoiceImageAssetsByStyle,
        });
    requestCurrentPlanMaterialSync();
    await syncCurrentMaterialAssetUsage();
  }, [csAvatarOverrides, handleSetCsAvatarOverride, markCustomerServiceCustomized, requestCurrentPlanMaterialSync, syncCurrentMaterialAssetUsage]);

  const handleCsAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const {
      normalizeAvatarMaterial,
      normalizeCustomerServiceUploadFileType,
      resolveCustomerServiceUploadKind,
    } = await loadCustomerServiceMaterialNormalizer();
    const uploadTarget = materialPickerTarget?.type === "avatar"
      ? materialPickerTarget
      : pendingCustomerServiceUploadTargetRef.current?.type === "avatar"
        ? pendingCustomerServiceUploadTargetRef.current
        : null;
    const uploadedKind = resolveCustomerServiceUploadKind(file);
    if (uploadedKind !== "image" && uploadedKind !== "video") {
      toast.error("请上传图片或视频格式的客服头像");
      if (pendingCustomerServiceUploadTargetRef.current?.type === "avatar") {
        pendingCustomerServiceUploadTargetRef.current = null;
      }
      event.target.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_MATERIAL_UPLOAD_BYTES) {
      toast.error("专家头像素材不能超过 2MB");
      if (pendingCustomerServiceUploadTargetRef.current?.type === "avatar") {
        pendingCustomerServiceUploadTargetRef.current = null;
      }
      event.target.value = "";
      return;
    }
    try {
      const targetAvatarId = uploadTarget?.avatarId || csAvatarId;
      markCustomerServiceCustomized();
      const avatarMaterial = await normalizeAvatarMaterial(normalizeCustomerServiceUploadFileType(file));
      const renamedFile = new File([avatarMaterial], buildNextAvatarMaterialFileName(avatarMaterial.name, avatarMaterial.type, materialAssets), {
        type: avatarMaterial.type,
        lastModified: avatarMaterial.lastModified,
      });
      const saved = await saveCustomerServiceMedia(renamedFile);
      handleSetCsAvatarOverride(targetAvatarId, {
        mediaAssetId: saved.assetId,
        mediaKind: saved.mediaKind,
        mediaMimeType: saved.mediaMimeType,
        imageDataUrl: undefined,
        animationStyle: saved.mediaKind === "video"
          ? "spin-slow"
          : resolveCustomerServiceExpertSequenceMatch(targetAvatarId, csAvatarOverrides[targetAvatarId]).animationStyle,
      });
      // Prime the visible roster now; the managed media loader replaces this
      // URL after the persisted store update completes.
      if (saved.publicUrl && (saved.mediaKind === "image" || saved.mediaKind === "video")) {
        setAvatarPreviewMap((current) => ({
          ...current,
          [targetAvatarId]: { url: saved.publicUrl, kind: saved.mediaKind },
        }));
      }
      await syncCurrentMaterialAssetUsage();
      requestCurrentPlanMaterialSync();
      closeMaterialPicker();
      toast.success(saved.mediaKind === "video"
        ? `客服视频头像已替换并同步${materialSyncTargetLabel}`
        : `客服头像已替换并同步${materialSyncTargetLabel}`);
    } catch (error) {
      toast.error(`客服头像保存失败：${formatUploadErrorMessage(error, "请重试")}`);
    } finally {
      if (pendingCustomerServiceUploadTargetRef.current?.type === "avatar") {
        pendingCustomerServiceUploadTargetRef.current = null;
      }
      event.target.value = "";
    }
  };

  const handleCsReminderSoundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const {
      normalizeAvatarMaterial,
      normalizeCustomerServiceUploadFileType,
      resolveCustomerServiceUploadKind,
    } = await loadCustomerServiceMaterialNormalizer();
    const uploadKind = resolveCustomerServiceUploadKind(file);
    if (uploadKind !== "audio" && uploadKind !== "image") {
      toast.error("请上传图片或音频格式的提醒素材");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_VOICE_MATERIAL_UPLOAD_BYTES) {
      toast.error(uploadKind === "image" ? "提醒封面图片不能超过 2MB" : "提醒声音素材不能超过 2MB");
      event.target.value = "";
      return;
    }
    try {
      const targetAvatarId = materialPickerTarget?.type === "reminder-sound"
        ? (materialPickerTarget.avatarId || csAvatarId)
        : csAvatarId;
      const normalizedFile = normalizeCustomerServiceUploadFileType(file);
      markCustomerServiceCustomized();
      const selectedStyleKey = materialPickerTarget?.type === "reminder-sound"
        ? (materialPickerTarget.soundStyleKey || resolveCustomerServiceExpertSequenceMatch(targetAvatarId, csAvatarOverrides[targetAvatarId], { reminderStyle: soundStyle }).reminderStyleKey)
        : resolveCustomerServiceExpertSequenceMatch(targetAvatarId, csAvatarOverrides[targetAvatarId], { reminderStyle: soundStyle }).reminderStyleKey;
      const selectedStylePreset = getCustomerServiceReminderPreset(selectedStyleKey);
      if (uploadKind === "image") {
        const normalizedCover = await normalizeAvatarMaterial(normalizedFile);
        const renamedCover = new File(
          [normalizedCover],
          buildCustomerServiceCoverMaterialFileName(normalizedCover.name, normalizedCover.type, "reminder-sound"),
          { type: normalizedCover.type, lastModified: normalizedCover.lastModified },
        );
        const saved = await saveCustomerServiceMedia(renamedCover);
        if (saved.mediaKind !== "image") {
          throw new Error("当前上传的文件未被识别为图片");
        }
        handleSetCsAvatarOverride(targetAvatarId, {
          soundStyle: selectedStyleKey,
          reminderImageAssetsByStyle: {
            ...(csAvatarOverrides[targetAvatarId]?.reminderImageAssetsByStyle || {}),
            [selectedStyleKey]: {
              assetId: saved.assetId,
              mimeType: saved.mediaMimeType,
              fileName: renamedCover.name,
            },
          },
        });
        await syncCurrentMaterialAssetUsage();
        requestCurrentPlanMaterialSync();
        closeMaterialPicker();
        toast.success(`提醒封面已标准化为 ${AVATAR_MATERIAL_DIMENSION_LABEL} 并同步${materialSyncTargetLabel}`);
        return;
      }
      const renamedFile = new File(
        [normalizedFile],
        buildNextVoiceMaterialFileName(
          normalizedFile.name,
          normalizedFile.type,
          materialAssets,
          selectedStylePreset?.label || "提醒声音",
        ),
        { type: normalizedFile.type, lastModified: normalizedFile.lastModified },
      );
      const saved = await saveCustomerServiceMedia(renamedFile);
      if (saved.mediaKind !== "audio") {
        throw new Error("当前上传的文件未被识别为音频");
      }
      const nextSoundAssetsByStyle = {
        ...(csAvatarOverrides[targetAvatarId]?.soundAssetsByStyle || {}),
        [selectedStyleKey]: {
          assetId: saved.assetId,
          mimeType: saved.mediaMimeType,
          fileName: renamedFile.name,
        },
      };
      handleSetCsAvatarOverride(targetAvatarId, {
        soundStyle: selectedStyleKey,
        soundAssetId: saved.assetId,
        soundAssetMimeType: saved.mediaMimeType,
        soundAssetFileName: renamedFile.name,
        soundAssetsByStyle: nextSoundAssetsByStyle,
      });
      await syncCurrentMaterialAssetUsage();
      requestCurrentPlanMaterialSync();
      closeMaterialPicker();
      toast.success(`客服提醒声音已替换并同步${materialSyncTargetLabel}`);
    } catch (error) {
      toast.error(`提醒素材保存失败：${formatUploadErrorMessage(error, "请重试")}`);
    } finally {
      if (pendingCustomerServiceUploadTargetRef.current?.type === "reminder-sound") {
        pendingCustomerServiceUploadTargetRef.current = null;
      }
      event.target.value = "";
    }
  };

  const handleCsGenderVoiceUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    gender: "female" | "male"
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const {
      normalizeAvatarMaterial,
      normalizeCustomerServiceUploadFileType,
      resolveCustomerServiceUploadKind,
    } = await loadCustomerServiceMaterialNormalizer();
    const uploadTarget = materialPickerTarget?.type === "female-voice" || materialPickerTarget?.type === "male-voice"
      ? materialPickerTarget
      : pendingCustomerServiceUploadTargetRef.current?.type === "female-voice" || pendingCustomerServiceUploadTargetRef.current?.type === "male-voice"
        ? pendingCustomerServiceUploadTargetRef.current
        : null;
    const targetGender = uploadTarget?.type === "female-voice"
      ? "female"
      : uploadTarget?.type === "male-voice"
        ? "male"
        : gender;
    const uploadKind = resolveCustomerServiceUploadKind(file);
    if (uploadKind !== "audio" && uploadKind !== "image") {
      toast.error(`请上传图片或音频格式的${targetGender === "female" ? "女性" : "男性"}声音素材`);
      if (pendingCustomerServiceUploadTargetRef.current?.type === "female-voice" || pendingCustomerServiceUploadTargetRef.current?.type === "male-voice") {
        pendingCustomerServiceUploadTargetRef.current = null;
      }
      event.target.value = "";
      return;
    }
    if (file.size > MAX_VOICE_MATERIAL_UPLOAD_BYTES) {
      toast.error(`${targetGender === "female" ? "女性" : "男性"}${uploadKind === "image" ? "朗音封面图片" : "朗读声音"}不能超过 2MB`);
      if (pendingCustomerServiceUploadTargetRef.current?.type === "female-voice" || pendingCustomerServiceUploadTargetRef.current?.type === "male-voice") {
        pendingCustomerServiceUploadTargetRef.current = null;
      }
      event.target.value = "";
      return;
    }
    try {
      const targetAvatarId = uploadTarget?.avatarId || csAvatarId;
      const normalizedFile = normalizeCustomerServiceUploadFileType(file);
      const remainingBytes = MAX_VOICE_MATERIAL_UPLOAD_BYTES - file.size;
      toast.info(`已选择 ${formatMaterialAssetSize(file.size)} 音频，剩余可上传 ${formatMaterialAssetSize(remainingBytes)}`);
      markCustomerServiceCustomized();
      const currentPreset = getCustomerServiceVoicePreset(
        uploadTarget?.voiceStyleKey || csAvatarOverrides[targetAvatarId]?.voiceStyleKey,
        targetGender
      );
      if (uploadKind === "image") {
        const normalizedCover = await normalizeAvatarMaterial(normalizedFile);
        const renamedCover = new File(
          [normalizedCover],
          buildCustomerServiceCoverMaterialFileName(
            normalizedCover.name,
            normalizedCover.type,
            targetGender === "male" ? "male-voice" : "female-voice",
          ),
          { type: normalizedCover.type, lastModified: normalizedCover.lastModified },
        );
        const saved = await saveCustomerServiceMedia(renamedCover);
        if (saved.mediaKind !== "image") {
          throw new Error("当前上传的文件未被识别为图片");
        }
        handleSetCsAvatarOverride(targetAvatarId, {
          voiceGender: targetGender,
          voiceStyleKey: currentPreset.key,
          voiceImageAssetsByStyle: {
            ...(csAvatarOverrides[targetAvatarId]?.voiceImageAssetsByStyle || {}),
            [currentPreset.key]: {
              assetId: saved.assetId,
              mimeType: saved.mediaMimeType,
              fileName: renamedCover.name,
            },
          },
        });
        await syncCurrentMaterialAssetUsage();
        requestCurrentPlanMaterialSync();
        closeMaterialPicker();
        toast.success(`${targetGender === "female" ? "女性" : "男性"}朗音封面已标准化为 ${AVATAR_MATERIAL_DIMENSION_LABEL} 并同步${materialSyncTargetLabel}`);
        return;
      }
      const renamedFile = new File([normalizedFile], buildNextVoiceMaterialFileName(normalizedFile.name, normalizedFile.type, materialAssets, currentPreset.label), {
        type: normalizedFile.type,
        lastModified: normalizedFile.lastModified,
      });
      const saved = await saveCustomerServiceMedia(renamedFile);
      if (saved.mediaKind !== "audio") {
        throw new Error("当前上传的文件未被识别为音频");
      }
      const nextVoiceAssetsByStyle = {
        ...(csAvatarOverrides[targetAvatarId]?.voiceAssetsByStyle || {}),
        [currentPreset.key]: {
          assetId: saved.assetId,
          mimeType: saved.mediaMimeType,
          fileName: renamedFile.name,
        },
      };
      handleSetCsAvatarOverride(targetAvatarId, targetGender === "female"
        ? {
            voiceGender: targetGender,
            voiceStyleKey: currentPreset.key,
            voiceRate: currentPreset.rate,
            voiceAssetId: undefined,
            voiceAssetMimeType: undefined,
            voiceAssetFileName: undefined,
            femaleVoiceAssetId: undefined,
            femaleVoiceAssetMimeType: undefined,
            femaleVoiceAssetFileName: undefined,
            voiceAssetsByStyle: nextVoiceAssetsByStyle,
          }
        : {
            voiceGender: targetGender,
            voiceStyleKey: currentPreset.key,
            voiceRate: currentPreset.rate,
            voiceAssetId: undefined,
            voiceAssetMimeType: undefined,
            voiceAssetFileName: undefined,
            maleVoiceAssetId: undefined,
            maleVoiceAssetMimeType: undefined,
            maleVoiceAssetFileName: undefined,
            voiceAssetsByStyle: nextVoiceAssetsByStyle,
      });
      await syncCurrentMaterialAssetUsage();
      requestCurrentPlanMaterialSync();
      closeMaterialPicker();
      toast.success(`${targetGender === "female" ? "女声" : "男声"}朗读声音已替换并同步${materialSyncTargetLabel}`);
    } catch (error) {
      toast.error(`${targetGender === "female" ? "女声" : "男声"}朗音素材保存失败：${formatUploadErrorMessage(error, "请重试")}`);
    } finally {
      if (pendingCustomerServiceUploadTargetRef.current?.type === "female-voice" || pendingCustomerServiceUploadTargetRef.current?.type === "male-voice") {
        pendingCustomerServiceUploadTargetRef.current = null;
      }
      event.target.value = "";
    }
  };

  const handleApplyExistingMaterialAsset = useCallback(async (
    asset: StoredMaterialAssetItem,
    virtualReminderStyleKey?: string,
  ) => {
    if (!materialPickerTarget) return;
    const allowed = materialPickerTarget.allowedKinds.includes(asset.kind);
    if (!allowed) {
      toast.error("当前素材类型与此处可用类型不匹配");
      return;
    }
    const targetAvatarId = materialPickerTarget.avatarId || csAvatarId;
    if (virtualReminderStyleKey) {
      const preset = getCustomerServiceReminderPreset(virtualReminderStyleKey);
      if (!preset?.localAsset) {
        toast.error("未找到可用的系统提醒声音");
        return;
      }
      try {
        markCustomerServiceCustomized();
        const nextSoundAssetsByStyle = {
          ...(csAvatarOverrides[targetAvatarId]?.soundAssetsByStyle || {}),
        };
        delete nextSoundAssetsByStyle[preset.key];
        const nextReminderImageAssetsByStyle = {
          ...(csAvatarOverrides[targetAvatarId]?.reminderImageAssetsByStyle || {}),
        };
        delete nextReminderImageAssetsByStyle[preset.key];
        handleSetCsAvatarOverride(targetAvatarId, {
          soundStyle: preset.key,
          soundAssetId: undefined,
          soundAssetMimeType: undefined,
          soundAssetFileName: undefined,
          soundAssetsByStyle: nextSoundAssetsByStyle,
          reminderImageAssetsByStyle: nextReminderImageAssetsByStyle,
        });
        await syncCurrentMaterialAssetUsage();
        requestCurrentPlanMaterialSync();
        closeMaterialPicker();
        toast.success(`已恢复 ${preset.label} 系统提醒声音与生肖封面`);
      } catch (error) {
        toast.error(`恢复系统提醒声音失败：${formatUploadErrorMessage(error, "请重试")}`);
      }
      return;
    }
    const fallbackAudioCategory = materialPickerTarget.type === "male-voice"
      ? "male-voice"
      : materialPickerTarget.type === "reminder-sound"
        ? "reminder-sound"
        : "female-voice";
    const assetTargetType = materialPickerTarget.type === "avatar"
      ? "avatar"
      : audioMaterialCategory === "all"
        ? resolveAudioMaterialCategory(asset, fallbackAudioCategory)
        : audioMaterialCategory;

    let replacedAssetId: string | undefined;
    let replaceScope = isSourceScope ? "源体草稿" : "当前计划设置";
    if (assetTargetType === "avatar") {
      replacedAssetId = csAvatarOverrides[targetAvatarId]?.mediaAssetId;
      replaceScope = isSourceScope ? "源体草稿专家头像" : "当前计划专家头像";
    } else if (assetTargetType === "reminder-sound") {
      const selectedStyleKey = materialPickerTarget.soundStyleKey
        || resolveCustomerServiceExpertSequenceMatch(targetAvatarId, csAvatarOverrides[targetAvatarId], { reminderStyle: soundStyle }).reminderStyleKey;
      replacedAssetId = asset.kind === "image"
        ? csAvatarOverrides[targetAvatarId]?.reminderImageAssetsByStyle?.[selectedStyleKey]?.assetId
        : resolveReminderSoundAssetFields(csAvatarOverrides[targetAvatarId], selectedStyleKey).assetId;
      replaceScope = isSourceScope
        ? `源体草稿专家提醒${asset.kind === "image" ? "封面" : "音"}`
        : `当前计划专家提醒${asset.kind === "image" ? "封面" : "音"}`;
    } else {
      const gender = assetTargetType === "female-voice" ? "female" : "male";
      const matchedVoiceStyle = resolveCustomerServiceExpertSequenceMatch(targetAvatarId, csAvatarOverrides[targetAvatarId]).voiceStyleKey;
      const preset = getCustomerServiceVoicePreset(materialPickerTarget.voiceStyleKey || matchedVoiceStyle, gender);
      replacedAssetId = asset.kind === "image"
        ? csAvatarOverrides[targetAvatarId]?.voiceImageAssetsByStyle?.[preset.key]?.assetId
        : resolveVoicePresetAssetFields(csAvatarOverrides[targetAvatarId], preset.key, gender).assetId;
      replaceScope = isSourceScope
        ? `源体草稿专家${gender === "female" ? "女声" : "男声"}${asset.kind === "image" ? "朗音封面" : "朗音"}`
        : `当前计划专家${gender === "female" ? "女声" : "男声"}${asset.kind === "image" ? "朗音封面" : "朗音"}`;
    }
    const replacedAsset = replacedAssetId ? materialAssets.find((item) => item.assetId === replacedAssetId) : undefined;
    if (
      replacedAsset &&
      replacedAsset.assetId !== asset.assetId &&
      confirmedMaterialReplacementRef.current !== asset.assetId
    ) {
      const impactText = replacedAsset.usageCount > 0
        ? `原素材正在 ${replacedAsset.usageCount} 处使用：${replacedAsset.usageLabels.join("、") || "当前设置"}。`
        : "原素材当前没有其他引用。";
      openSourceActionDialog({
        title: "确认替换素材",
        description: `将把${replaceScope}替换为“${sanitizeDisplayText(asset.fileName, "未命名素材")}”。${impactText}${isSourceScope ? "这只会写入源体草稿；需发布新版且全部计划成功后才更新工厂默认。已有独立覆盖的计划不会被改动。" : "这只写入当前计划，不会改动其他计划。"}`,
        confirmLabel: isSourceScope ? "替换并写入源体草稿" : "仅替换当前计划",
        busyLabel: "替换中...",
        onConfirm: async () => {
          confirmedMaterialReplacementRef.current = asset.assetId;
          await applyExistingMaterialAssetRef.current(asset);
        },
      });
      return;
    }
    confirmedMaterialReplacementRef.current = null;

    try {
      markCustomerServiceCustomized();
      if (assetTargetType === "avatar") {
        handleSetCsAvatarOverride(targetAvatarId, {
          mediaAssetId: asset.assetId,
          mediaKind: asset.kind === "audio" ? undefined : asset.kind,
          mediaMimeType: asset.mimeType,
          imageDataUrl: undefined,
          animationStyle: asset.kind === "video"
            ? "spin-slow"
            : resolveCustomerServiceExpertSequenceMatch(targetAvatarId, csAvatarOverrides[targetAvatarId]).animationStyle,
        });
        if (asset.publicUrl && (asset.kind === "image" || asset.kind === "video")) {
          setAvatarPreviewMap((current) => ({
            ...current,
            [targetAvatarId]: { url: asset.publicUrl, kind: asset.kind },
          }));
        }
        toast.success(asset.kind === "video" ? "已使用现有视频头像" : "已使用现有头像素材");
      } else if (assetTargetType === "reminder-sound") {
        const selectedStyleKey = materialPickerTarget.soundStyleKey
          || resolveCustomerServiceExpertSequenceMatch(targetAvatarId, csAvatarOverrides[targetAvatarId], { reminderStyle: soundStyle }).reminderStyleKey;
        if (asset.kind === "image") {
          handleSetCsAvatarOverride(targetAvatarId, {
            soundStyle: selectedStyleKey,
            reminderImageAssetsByStyle: {
              ...(csAvatarOverrides[targetAvatarId]?.reminderImageAssetsByStyle || {}),
              [selectedStyleKey]: {
                assetId: asset.assetId,
                mimeType: asset.mimeType,
                fileName: asset.fileName,
              },
            },
          });
          toast.success(`已使用现有提醒封面，并标准化为 ${AVATAR_MATERIAL_DIMENSION_LABEL}`);
        } else {
        const nextSoundAssetsByStyle = {
          ...(csAvatarOverrides[targetAvatarId]?.soundAssetsByStyle || {}),
          [selectedStyleKey]: {
            assetId: asset.assetId,
            mimeType: asset.mimeType,
            fileName: asset.fileName,
          },
        };
        handleSetCsAvatarOverride(targetAvatarId, {
          soundStyle: selectedStyleKey,
          soundAssetId: asset.assetId,
          soundAssetMimeType: asset.mimeType,
          soundAssetFileName: asset.fileName,
          soundAssetsByStyle: nextSoundAssetsByStyle,
        });
        toast.success("已使用现有提醒声音素材");
        }
      } else {
        const gender = assetTargetType === "female-voice" ? "female" : "male";
        const matchedVoiceStyle = resolveCustomerServiceExpertSequenceMatch(targetAvatarId, csAvatarOverrides[targetAvatarId]).voiceStyleKey;
        const currentPreset = getCustomerServiceVoicePreset(materialPickerTarget.voiceStyleKey || matchedVoiceStyle, gender);
        if (asset.kind === "image") {
          handleSetCsAvatarOverride(targetAvatarId, {
            voiceGender: gender,
            voiceStyleKey: currentPreset.key,
            voiceImageAssetsByStyle: {
              ...(csAvatarOverrides[targetAvatarId]?.voiceImageAssetsByStyle || {}),
              [currentPreset.key]: {
                assetId: asset.assetId,
                mimeType: asset.mimeType,
                fileName: asset.fileName,
              },
            },
          });
          toast.success(`已使用现有${gender === "female" ? "女性讲解" : "男性演讲"}朗音封面，并标准化为 ${AVATAR_MATERIAL_DIMENSION_LABEL}`);
        } else {
        const previousAsset = resolveVoicePresetAssetFields(csAvatarOverrides[targetAvatarId], currentPreset.key, gender);
        const nextVoiceAssetsByStyle = {
          ...(csAvatarOverrides[targetAvatarId]?.voiceAssetsByStyle || {}),
          [currentPreset.key]: {
            assetId: asset.assetId,
            mimeType: asset.mimeType,
            fileName: asset.fileName,
          },
        };
        handleSetCsAvatarOverride(
          targetAvatarId,
          gender === "female"
            ? {
                voiceGender: gender,
                voiceStyleKey: currentPreset.key,
                voiceRate: currentPreset.rate,
                voiceAssetId: undefined,
                voiceAssetMimeType: undefined,
                voiceAssetFileName: undefined,
                femaleVoiceAssetId: undefined,
                femaleVoiceAssetMimeType: undefined,
                femaleVoiceAssetFileName: undefined,
                voiceAssetsByStyle: nextVoiceAssetsByStyle,
              }
            : {
                voiceGender: gender,
                voiceStyleKey: currentPreset.key,
                voiceRate: currentPreset.rate,
                voiceAssetId: undefined,
                voiceAssetMimeType: undefined,
                voiceAssetFileName: undefined,
                maleVoiceAssetId: undefined,
                maleVoiceAssetMimeType: undefined,
                maleVoiceAssetFileName: undefined,
                voiceAssetsByStyle: nextVoiceAssetsByStyle,
                materialHistory: appendMaterialVersion(csAvatarOverrides[targetAvatarId]?.materialHistory, previousAsset, "voice"),
              }
        );
        toast.success(`已使用现有${gender === "female" ? "女声" : "男声"}朗读素材`);
        }
      }
      await syncCurrentMaterialAssetUsage();
      requestCurrentPlanMaterialSync();
      try {
        const applyResult = await recordMaterialAssetApply(asset.assetId);
        setMaterialAssets((current) => current.map((item) => (
          item.assetId === applyResult.assetId
            ? { ...item, applyCount: applyResult.applyCount }
            : item
        )));
      } catch {
        toast.warning("素材已使用，但应用次数暂未记录；请刷新后重试");
      }
      closeMaterialPicker();
    } catch (error) {
      toast.error(`使用现有素材失败：${formatUploadErrorMessage(error, "请重试")}`);
    }
  }, [
    audioMaterialCategory,
    closeMaterialPicker,
    csAvatarId,
    csAvatarOverrides,
    handleSetCsAvatarOverride,
    isSourceScope,
    markCustomerServiceCustomized,
    materialAssets,
    materialPickerTarget,
    openSourceActionDialog,
    requestCurrentPlanMaterialSync,
    soundStyle,
    syncCurrentMaterialAssetUsage,
  ]);
  applyExistingMaterialAssetRef.current = handleApplyExistingMaterialAsset;

  const stopVoicePreviewPlayback = useCallback(() => {
    voicePreviewRequestRevisionRef.current += 1;
    voicePreviewIntentKeyRef.current = null;
    setActiveVoicePreviewKey(null);
    if (voicePreviewAudioRef.current) {
      try {
        voicePreviewAudioRef.current.pause();
        voicePreviewAudioRef.current.currentTime = 0;
      } catch {
        // Ignore stop failures for inline preview audio.
      }
      voicePreviewAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const stopMaterialAssetPreview = useCallback(() => {
    setActiveMaterialAssetPreviewId(null);
    if (materialAssetPreviewAudioRef.current) {
      try {
        materialAssetPreviewAudioRef.current.pause();
        materialAssetPreviewAudioRef.current.currentTime = 0;
      } catch {
        // Ignore a browser-level pause failure for this optional preview.
      }
      materialAssetPreviewAudioRef.current = null;
    }
  }, []);

  const playReminderSoundChoicePreview = useCallback((presetKey: string, replacementUrl?: string) => {
    if (reminderSoundChoiceAudioRef.current) {
      try {
        reminderSoundChoiceAudioRef.current.pause();
        reminderSoundChoiceAudioRef.current.currentTime = 0;
      } catch {
        // Ignore cleanup failures before starting the newly selected reminder.
      }
      reminderSoundChoiceAudioRef.current = null;
    }
    const playLocalDefault = () => {
      playClickSoundWithConfig("activate", {
        enabled: true,
        style: presetKey,
        volume: soundVolume,
      });
    };
    if (!replacementUrl) {
      playLocalDefault();
      return;
    }
    try {
      const audio = new Audio(replacementUrl);
      reminderSoundChoiceAudioRef.current = audio;
      audio.volume = Math.max(0, Math.min(1, soundVolume));
      let fellBack = false;
      const release = () => {
        if (reminderSoundChoiceAudioRef.current === audio) {
          reminderSoundChoiceAudioRef.current = null;
        }
      };
      const fallback = () => {
        if (fellBack) return;
        fellBack = true;
        release();
        playLocalDefault();
      };
      audio.onended = release;
      audio.onerror = fallback;
      void audio.play().catch(fallback);
    } catch {
      playLocalDefault();
    }
  }, [soundVolume]);

  const toggleMaterialAssetPreview = useCallback(async (asset: StoredMaterialAssetItem) => {
    if (asset.kind !== "audio") return;
    if (activeMaterialAssetPreviewId === asset.assetId) {
      stopMaterialAssetPreview();
      return;
    }
    stopMaterialAssetPreview();
    try {
      const audio = new Audio(asset.publicUrl);
      materialAssetPreviewAudioRef.current = audio;
      audio.onended = () => {
        stopMaterialAssetPreview();
        toast.success("试听完成");
      };
      audio.onerror = stopMaterialAssetPreview;
      setActiveMaterialAssetPreviewId(asset.assetId);
      await audio.play();
    } catch {
      stopMaterialAssetPreview();
      toast.error("试听启动失败，请检查素材格式");
    }
  }, [activeMaterialAssetPreviewId, stopMaterialAssetPreview]);

  const playVoiceRatePreview = useCallback(async (rate: number, previewGender?: "female" | "male", previewStyleKey?: string) => {
    const genderPreview = previewGender || selectedAvatarVoiceGender;
    const styleKeyPreview = previewStyleKey || selectedAvatarVoicePreset.key;
    const presetPreview = getCustomerServiceVoicePreset(styleKeyPreview, genderPreview);
    const previewKey = `${csAvatarId}:${genderPreview}:${presetPreview.key}`;
    if (voicePreviewIntentKeyRef.current === previewKey) {
      stopVoicePreviewPlayback();
      return;
    }
    stopVoicePreviewPlayback();
    const requestRevision = voicePreviewRequestRevisionRef.current;
    voicePreviewIntentKeyRef.current = previewKey;
    setActiveVoicePreviewKey(previewKey);
    const directPreviewUrl = genderPreview === "male" ? selectedMaleVoicePreviewUrl : selectedFemaleVoicePreviewUrl;
    const previewText = selectedVoicePreviewText;
    const localPreviewUrl = previewText === presetPreview.localAsset?.transcript
      ? presetPreview.localAsset.url
      : undefined;
    const requestIsCurrent = () => voicePreviewRequestRevisionRef.current === requestRevision;
    const finishCurrentPreview = () => {
      if (requestIsCurrent()) stopVoicePreviewPlayback();
    };
    const failCurrentPreview = () => {
      if (!requestIsCurrent()) return;
      stopVoicePreviewPlayback();
      toast.error("朗音试听启动失败，请检查本地语音服务");
    };
    try {
      const { startCustomerServiceVoicePreview } = await import("@/lib/customer-service-voice-preview-runtime");
      if (!requestIsCurrent()) return;
      await startCustomerServiceVoicePreview({
        directPreviewUrl,
        localPreviewUrl,
        text: previewText,
        gender: genderPreview,
        styleKey: presetPreview.key,
        rate,
        isCurrent: requestIsCurrent,
        onAudioReady: (audio) => {
          if (requestIsCurrent()) voicePreviewAudioRef.current = audio;
        },
        onAudioRelease: (audio) => {
          if (voicePreviewAudioRef.current === audio) voicePreviewAudioRef.current = null;
        },
        onEnd: finishCurrentPreview,
        onError: failCurrentPreview,
      });
    } catch {
      failCurrentPreview();
    }
  }, [
    csAvatarId,
    selectedAvatarVoiceGender,
    selectedAvatarVoicePreset.key,
    selectedFemaleVoicePreviewUrl,
    selectedMaleVoicePreviewUrl,
    selectedVoicePreviewText,
    stopVoicePreviewPlayback,
  ]);

  useEffect(() => () => {
    stopVoicePreviewPlayback();
  }, [stopVoicePreviewPlayback]);

  useEffect(() => () => {
    stopMaterialAssetPreview();
  }, [stopMaterialAssetPreview]);

  // Open settings dialog
  const openDefaultDialog = (initialTab: "modules" | "layout" | "service" = "modules") => {
    if (isHQAgencyStyleSettings) {
      navigate("/zb/kh-style-settings");
      return;
    }
    defaultDialogConfigSnapshotRef.current = cloneExportableConfigSnapshot(useProductMarketStore.getState().exportConfig());
    defaultDialogDraftBaselineRef.current = null;
    defaultDialogVerifiedSignatureRef.current = null;
    defaultDialogProductsBaselineSignatureRef.current = null;
    defaultDialogBaselineReadyRef.current = false;
    setDefaultDialogBaselineReady(false);
    loadConfigIntoSettingsDraft(useProductMarketStore.getState().exportConfig());
    // 栏目配置默认收起二级栏目，避免多级栏目在打开时集中渲染。
    // 左侧导航数据仍完整同步；用户可按需逐项或通过表头展开。
    if (initialTab === "modules") {
      setExpandedModulePaths([]);
    }
    setSettingsTab(initialTab);
    setShowDefaultDialog(true);
  };

  useEffect(() => {
    if (!showDefaultDialog || defaultDialogBaselineReady || !remoteSnapshotHydrated) return;
    const timer = window.setTimeout(() => {
      const initialDraft = buildSharedAwareConfig(buildConfigFromDialogState(), { includeLayoutFlags: true });
      defaultDialogDraftBaselineRef.current = cloneExportableConfigSnapshot(initialDraft);
      defaultDialogVerifiedSignatureRef.current = productMarketConfigSignature(initialDraft);
      defaultDialogProductsBaselineSignatureRef.current = tempProductsSignature;
      defaultDialogBaselineReadyRef.current = true;
      setDefaultDialogBaselineReady(true);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [buildConfigFromDialogState, defaultDialogBaselineReady, remoteSnapshotHydrated, showDefaultDialog, tempProductsSignature]);

  useEffect(() => {
    const root = document.documentElement;
    if (!templateSettingsSubview) {
      root.removeAttribute("data-tradepro-product-market-settings-page");
      return;
    }
    root.setAttribute("data-tradepro-product-market-settings-page", "true");
    return () => root.removeAttribute("data-tradepro-product-market-settings-page");
  }, [templateSettingsSubview]);

  useLayoutEffect(() => {
    if (templateSettingsSubview) {
      // A route subpage owns the same workspace.  Switching between its
      // second-level tabs must only change the active tab; rebuilding every
      // temporary config tree here used to mount hundreds of module controls
      // again and made “栏目配置” visibly stall.
      if (!showDefaultDialog) openDefaultDialog(templateSettingsSubview);
      return;
    }
    if (showDefaultDialog) closeDefaultDialog();
  // Route subpages deliberately own the template workspace state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateSettingsSubview]);

  const updateTempLayoutSection = useCallback((id: string, updater: (current: LayoutSectionConfig) => LayoutSectionConfig) => {
    setTempLayoutSections((current) =>
      current.map((section) => (section.id === id ? updater(section) : section))
    );
  }, []);

  const moveTempLayoutSection = useCallback((id: string, direction: "up" | "down") => {
    setTempLayoutSections((current) => {
      const index = current.findIndex((section) => section.id === id);
      if (index === -1) return current;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      return arrayMove(current, index, nextIndex);
    });
  }, []);

  const getTempLayoutSection = useCallback(
    (id: string) =>
      tempLayoutSections.find((section) => section.id === id) ||
      DEFAULT_LAYOUT_SECTIONS.find((section) => section.id === id) || {
        id,
        title: "未命名栏目",
        description: "",
      },
    [tempLayoutSections]
  );

  const getTempLayoutSectionIndex = useCallback(
    (id: string) => tempLayoutSections.findIndex((section) => section.id === id),
    [tempLayoutSections]
  );

  const moveTempCustomerServiceSection = useCallback((id: string, direction: "up" | "down") => {
    setTempCustomerServiceSections((current) => {
      const fixedSection = current.find((section) => section.id === "service-switches");
      const movable = current.filter((section) => section.id !== "service-switches");
      const index = movable.findIndex((section) => section.id === id);
      if (index === -1) return current;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= movable.length) return current;
      const reordered = arrayMove(movable, index, nextIndex);
      return fixedSection ? [fixedSection, ...reordered] : reordered;
    });
  }, []);

  const getTempCustomerServiceSection = useCallback(
    (id: string) =>
      tempCustomerServiceSections.find((section) => section.id === id) ||
      DEFAULT_CUSTOMER_SERVICE_SECTIONS.find((section) => section.id === id) || {
        id,
        title: "未命名栏目",
        description: "",
      },
    [tempCustomerServiceSections]
  );

  const customerServiceSectionOrder = useCallback(
    (id: string) => {
      const sortableSections = tempCustomerServiceSections.filter((section) => section.id !== "service-switches");
      const index = sortableSections.findIndex((section) => section.id === id);
      return index === -1 ? 999 : index + 1;
    },
    [tempCustomerServiceSections]
  );

  const sortableCustomerServiceSections = useMemo(
    () => serviceWorkspaceActive
      ? tempCustomerServiceSections.filter((section) => section.id !== "service-switches")
      : [],
    [serviceWorkspaceActive, tempCustomerServiceSections]
  );

  const summarizeSettingsDraftChanges = useCallback((before: ExportableConfig, after: ExportableConfig) => {
    const summary = summarizeProductMarketConfigChanges(before, after);
    const productBaselineSignature = defaultDialogProductsBaselineSignatureRef.current;
    if (!productBaselineSignature || productBaselineSignature !== tempProductsSignature) return summary;
    const groups = summary.groups
      .map((group) => ({ ...group, fields: group.fields.filter((field) => field !== "products") }))
      .filter((group) => group.fields.length > 0);
    return { changed: groups.length > 0, groups, labels: groups.map((group) => group.label) };
  }, [tempProductsSignature]);

  const commitOperationDraft = useCallback(async (
    preparedConfig?: ExportableConfig,
    options?: { successMessage?: string },
  ) => {
    if (saveOperationInFlightRef.current) {
      toast.info("保存正在进行，请等待当前回读校验完成。");
      return false;
    }
    saveOperationInFlightRef.current = true;
    const nextConfig = preparedConfig || buildSharedAwareConfig(buildConfigFromDialogState(), {
      includeLayoutFlags: true,
    });
    try {
      const localCommitOptions = {
        syncCustomizationFlags: shouldSyncCustomizationFlagsWithSnapshot,
        syncMaterialAssets: true,
        runtimeSnapshotOnly: shouldPersistRuntimeSnapshotOnly,
        writeSharedStyle: shouldWriteSharedClientStyle,
        useCurrentScopePersist: templateLifecycleRole === "source",
        // A source save advances only the editable current/draft snapshot.
        // The factory-default baseline is promoted later, and only after the
        // immutable publication and every client-plan rollout have succeeded.
        includeDefault: false,
        skipRemoteSnapshot: true,
        // Keep the visible/live store unchanged until local and server
        // snapshots pass readback. This prevents passive store persistence
        // from racing and overwriting the awaited source PUT.
        applyState: false,
      };
      const committed = commitConfigSnapshot(nextConfig, localCommitOptions);
      if (!committed) return false;
      const verifiedConfig = await persistAndVerifyScopedSnapshot(configScope, effectiveSiteId, nextConfig);
      // The server has accepted the normalized snapshot. The live store and
      // editor draft must now advance together: buildConfigFromDialogState
      // reads both, so updating only the draft leaves a mixed pre/post-save
      // snapshot that the navigation guard correctly (but misleadingly)
      // reports as dirty.
      applyConfigSnapshotToState(verifiedConfig, {
        syncCustomizationFlags: shouldSyncCustomizationFlagsWithSnapshot,
      });
      // importConfig() canonicalizes store-owned defaults, while the settings
      // draft owns catalogue child labels/styles. Rebuild from both sources;
      // exporting the store alone silently discarded those draft-owned fields.
      let finalVerifiedConfig = verifiedConfig;
      let hydratedConfig = buildPersistedProductMarketSnapshot(
        buildSharedAwareConfig(buildConfigFromDialogState(), {
          includeLayoutFlags: true,
        }),
      );
      if (productMarketConfigSignature(hydratedConfig) !== productMarketConfigSignature(verifiedConfig)) {
        // A save is complete only when the post-import editor fixed point is
        // also the server draft. This closes the window where the UI advanced
        // its “saved” baseline but publish still saw an older remote payload.
        const canonicalCommitted = commitConfigSnapshot(hydratedConfig, localCommitOptions);
        if (!canonicalCommitted) return false;
        finalVerifiedConfig = await persistAndVerifyScopedSnapshot(
          configScope,
          effectiveSiteId,
          hydratedConfig,
        );
        applyConfigSnapshotToState(finalVerifiedConfig, {
          syncCustomizationFlags: shouldSyncCustomizationFlagsWithSnapshot,
        });
        hydratedConfig = buildPersistedProductMarketSnapshot(
          buildSharedAwareConfig(buildConfigFromDialogState(), {
            includeLayoutFlags: true,
          }),
        );
        if (productMarketConfigSignature(hydratedConfig)
          !== productMarketConfigSignature(finalVerifiedConfig)) {
          throw new Error("保存未完成：规范化后的编辑配置未能与服务端草稿稳定一致，请刷新后重试。");
        }
      }
      const hydratedSignature = productMarketConfigSignature(hydratedConfig);
      inheritedSignatureRef.current = hydratedSignature;
      appliedConfigSignatureRef.current = hydratedSignature;
      loadConfigIntoSettingsDraft(hydratedConfig);
      toast.success(options?.successMessage || getSaveDefaultsSuccessMessage(shouldPersistRuntimeSnapshotOnly));
      defaultDialogConfigSnapshotRef.current = cloneExportableConfigSnapshot(hydratedConfig);
      defaultDialogDraftBaselineRef.current = cloneExportableConfigSnapshot(hydratedConfig);
      defaultDialogVerifiedSignatureRef.current = hydratedSignature;
      defaultDialogProductsBaselineSignatureRef.current = JSON.stringify(
        buildEditableProducts(hydratedConfig.products)
      );
      defaultDialogBaselineReadyRef.current = true;
      setDefaultDialogBaselineReady(true);
      return true;
    } finally {
      saveOperationInFlightRef.current = false;
    }
  }, [
    buildConfigFromDialogState,
    applyConfigSnapshotToState,
    configScope,
    effectiveSiteId,
    loadConfigIntoSettingsDraft,
    shouldPersistRuntimeSnapshotOnly,
    shouldSyncCustomizationFlagsWithSnapshot,
    shouldWriteSharedClientStyle,
    templateLifecycleRole,
    tempProductsSignature,
  ]);

  const handleApplyLiveTheme = useCallback((key: ThemePresetKey | string) => {
    if (productMarketHardLocked) {
      toast.error("当前页面已锁定：切换并保存网站风格前，请先在源开发器的页面锁定器中手动解除勾选。");
      return;
    }
    const preset = allThemes.find((theme) => theme.key === key);
    if (!preset || activeTheme === key) return;
    if (hasPendingSiteSwitchLoading()) {
      toast.error("当前切换保护仍在进行，系统保持最短 5 秒保护，请稍后再切换主题。");
      return;
    }
    const getThemeSwitchTargetLabel = () => {
      if (configScope === "hq") return "总部端全局框架";
      if (configScope === "agency_source") return "代理源全局模板";
      if (configScope === "client_source") return "客户源全局模板";
      return activeSite && !isCentralStyleSettingsPage
        ? `当前计划“${resolveSiteDisplayName(activeSite, activeSite.planCode || activeSite.id)}”`
        : `${scopeLabel}模板配置`;
    };
    const themeDisplayName = getThemeDisplayName(preset.key, preset.name);
    const targetLabel = getThemeSwitchTargetLabel();
    openSourceActionDialog({
      title: "切换并保存网站风格",
      description: `确认将 ${targetLabel} 的网站风格切换为“${themeDisplayName}”并立即保存吗？`,
      confirmLabel: "确认切换",
      busyLabel: "切换中...",
      minimumBusyMs: 3000,
      showBusyState: false,
      onConfirm: async () => {
        if (!defaultDialogBaselineReadyRef.current || !defaultDialogDraftBaselineRef.current) {
          const liveThemeBaseline = cloneExportableConfigSnapshot(
            useProductMarketStore.getState().exportConfig(),
          );
          const liveThemeBaselineSignature = productMarketConfigSignature(liveThemeBaseline);
          defaultDialogConfigSnapshotRef.current = cloneExportableConfigSnapshot(liveThemeBaseline);
          defaultDialogDraftBaselineRef.current = cloneExportableConfigSnapshot(liveThemeBaseline);
          defaultDialogVerifiedSignatureRef.current = liveThemeBaselineSignature;
          defaultDialogProductsBaselineSignatureRef.current = JSON.stringify(
            buildEditableProducts(liveThemeBaseline.products),
          );
          defaultDialogBaselineReadyRef.current = true;
          setDefaultDialogBaselineReady(true);
        }
        if (shouldUseSharedClientStyle && !isCentralStyleSettingsPage) {
          markLayoutCustomized();
        }
        startSiteSwitchLoading({
          source: "theme-live-switch",
          targetPath: location.pathname,
          targetSiteId: effectiveSiteId || undefined,
          companyName: targetLabel,
          targetThemeKey: String(key),
          themeDisplayName,
        });
        applyTheme(key);
        setPreviewTheme(null);
        // applyTheme updates the shared store synchronously, but React-owned
        // projections settle on the following task. Save that exact visible
        // state through the same local + server readback transaction used by
        // the title and footer save actions; never report success from a
        // fire-and-forget compatibility write.
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        const nextConfig = useProductMarketStore.getState().exportConfig();
        const committed = await commitOperationDraft(nextConfig, {
          successMessage: `${targetLabel} 已切换到“${themeDisplayName}”并保存`,
        });
        if (!committed) {
          throw new Error("网站风格保存未完成：本地与服务端配置尚未通过回读验证，请重试。");
        }
      },
    });
  }, [
    activeTheme,
    activeSite,
    allThemes,
    applyTheme,
    commitOperationDraft,
    configScope,
    effectiveSiteId,
    getThemeDisplayName,
    isCentralStyleSettingsPage,
    location.pathname,
    markLayoutCustomized,
    openSourceActionDialog,
    productMarketHardLocked,
    scopeLabel,
    shouldUseSharedClientStyle,
  ]);

  const saveDefaults = useCallback(() => {
    // Freeze the exact visible draft before the confirmation window opens.
    // The modal intentionally stays open for several seconds; committing the
    // prepared snapshot prevents a later render from substituting an older
    // product list while the user is confirming the save.
    const preparedConfig = buildSharedAwareConfig(buildConfigFromDialogState(), {
      includeLayoutFlags: true,
    });
    const editBaseline = defaultDialogDraftBaselineRef.current || defaultDialogConfigSnapshotRef.current;
    const changeSummary = editBaseline
      ? summarizeSettingsDraftChanges(editBaseline, preparedConfig)
      : null;
    const changedText = !changeSummary
      ? "将保存当前页面配置。"
      : changeSummary.changed
        ? `本次修改：${changeSummary.labels.join("、")}。`
        : "本次没有检测到配置差异。";
    openSourceActionDialog({
      title: shouldPersistRuntimeSnapshotOnly ? "保存当前计划快照" : `保存${scopeLabel}模板配置`,
      description: shouldPersistRuntimeSnapshotOnly
        ? `${changedText} 保存后只会写入当前独立计划快照，不会改动源体，也不会覆盖客户已编制内容。完成后会回读验证本地与服务端结果。`
        : `${changedText} 保存后写入源体草稿，不会自动发布给下游；完成后会回读验证本地与服务端结果。`,
      confirmLabel: "确认保存",
      busyLabel: "保存中...",
      onConfirm: async () => {
        const committed = await commitOperationDraft(preparedConfig);
        if (!committed) throw new Error("保存未完成：配置尚未通过回读验证，请重试。");
      },
    });
  }, [
    buildConfigFromDialogState,
    buildSharedAwareConfig,
    commitOperationDraft,
    openSourceActionDialog,
    scopeLabel,
    shouldPersistRuntimeSnapshotOnly,
    summarizeSettingsDraftChanges,
  ]);

  const dialogDraftChangeSummary = useMemo(() => {
    if (!defaultDialogBaselineReady || !defaultDialogDraftBaselineRef.current) {
      return { changed: false, groups: [], labels: [] };
    }
    const currentDraft = buildSharedAwareConfig(buildConfigFromDialogState(), { includeLayoutFlags: true });
    const verifiedSignature = defaultDialogVerifiedSignatureRef.current;
    if (verifiedSignature && productMarketConfigSignature(currentDraft) === verifiedSignature) {
      return { changed: false, groups: [], labels: [] };
    }
    return summarizeSettingsDraftChanges(
      defaultDialogDraftBaselineRef.current,
      currentDraft,
    );
  }, [
    buildConfigFromDialogState,
    defaultDialogBaselineReady,
    effectiveSiteId,
    isCentralStyleSettingsPage,
    normalizeSharedInitialClientConfig,
    shouldWriteSharedClientStyle,
    showSharedStyleControls,
    summarizeSettingsDraftChanges,
  ]);

  const requestCloseDefaultDialog = useCallback(() => {
    if (!dialogDraftChangeSummary.changed) {
      closeDefaultDialog({ saved: true });
      return;
    }
    const preparedConfig = buildSharedAwareConfig(buildConfigFromDialogState(), {
      includeLayoutFlags: true,
    });
    openSourceActionDialog({
      title: "检测到未保存修改",
      description: `已修改：${dialogDraftChangeSummary.labels.join("、")}。请选择保存并退出、放弃修改，或关闭本提示继续编辑。`,
      confirmLabel: "保存并退出",
      busyLabel: "保存并验证中...",
      cancelLabel: "放弃修改",
      onConfirm: async () => {
        const committed = await commitOperationDraft(preparedConfig);
        if (!committed) throw new Error("保存未完成：配置尚未通过回读验证，请重试。");
        closeDefaultDialog({ saved: true });
      },
      onCancel: () => closeDefaultDialog(),
    });
  }, [
    buildConfigFromDialogState,
    closeDefaultDialog,
    commitOperationDraft,
    dialogDraftChangeSummary,
    openSourceActionDialog,
  ]);

  useEffect(() => {
    if (!dialogDraftChangeSummary.changed) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dialogDraftChangeSummary.changed]);

  useEffect(() => {
    if (!dialogDraftChangeSummary.changed) return;
    const handleInternalNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank") return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const nextPath = `${destination.pathname}${destination.search}${destination.hash}`;
      if (currentPath === nextPath) return;

      event.preventDefault();
      event.stopPropagation();
      const preparedConfig = buildSharedAwareConfig(buildConfigFromDialogState(), {
        includeLayoutFlags: true,
      });
      openSourceActionDialog({
        title: "离开前处理未保存修改",
        description: `已修改：${dialogDraftChangeSummary.labels.join("、")}。保存成功并完成回读校验后再离开，或放弃本次修改。关闭提示可继续编辑。`,
        confirmLabel: "保存并离开",
        busyLabel: "保存并验证中...",
        cancelLabel: "放弃并离开",
        onConfirm: async () => {
          const committed = await commitOperationDraft(preparedConfig);
          if (!committed) throw new Error("保存未完成：配置尚未通过回读验证，请重试。");
          closeDefaultDialog({ saved: true });
          navigate(nextPath);
        },
        onCancel: () => {
          closeDefaultDialog();
          navigate(nextPath);
        },
      });
    };
    document.addEventListener("click", handleInternalNavigation, true);
    return () => document.removeEventListener("click", handleInternalNavigation, true);
  }, [
    buildConfigFromDialogState,
    closeDefaultDialog,
    commitOperationDraft,
    dialogDraftChangeSummary,
    navigate,
    openSourceActionDialog,
  ]);

  useEffect(() => {
    const handleSharedProjectSync = (event: Event) => {
      const detail = (event as CustomEvent<SharedProjectSyncRequestDetail>).detail;
      if (detail?.pathname !== location.pathname || detail.search !== location.search) return;
      const completion = commitOperationDraft();
      if (detail.respondWith) detail.respondWith(completion);
      else {
        void completion.catch(() => {
          toast.error("页面设置保存失败，请检查配置后重试。");
        });
      }
    };

    window.addEventListener(SHARED_PROJECT_SYNC_REQUEST_EVENT, handleSharedProjectSync);
    return () => window.removeEventListener(SHARED_PROJECT_SYNC_REQUEST_EVENT, handleSharedProjectSync);
  }, [commitOperationDraft, location.pathname, location.search]);

  const restoreConfigByTarget = useCallback((
    current: ExportableConfig,
    base: ExportableConfig,
    target: ProductMarketRestoreTarget,
    options?: {
      preserveRuntimeContent?: boolean;
      preserveCustomizedModules?: boolean;
      preserveCustomizedLayout?: boolean;
      preserveCustomizedService?: boolean;
    }
  ): ExportableConfig => {
    const preserveRuntimeContent = options?.preserveRuntimeContent === true;
    const preserveCustomizedModules = options?.preserveCustomizedModules === true;
    const preserveCustomizedLayout = options?.preserveCustomizedLayout === true;
    const preserveCustomizedService = options?.preserveCustomizedService === true;
    type ProductNode = NonNullable<ExportableConfig["products"]>[number];
    type ProductChildNode = NonNullable<ProductNode["children"]>[number];

    const cloneProductChild = (child: ProductChildNode): ProductChildNode => ({
      label: child.label,
      path: child.path,
      status: child.status,
      customLabel: child.customLabel,
      description: child.description,
      customStyle: child.customStyle ? { ...child.customStyle } : undefined,
    });

    const cloneProductNode = (product: ProductNode): ProductNode => ({
      label: product.label,
      path: product.path,
      status: product.status,
      customLabel: product.customLabel,
      description: product.description,
      customStyle: product.customStyle ? { ...product.customStyle } : undefined,
      children: product.children?.map(cloneProductChild),
    });

    const mergeRuntimeProtectedChildren = (
      currentChildren?: ProductChildNode[],
      baseChildren?: ProductChildNode[]
    ) => {
      const currentByPath = new Map((currentChildren || []).map((child) => [child.path, child]));
      const basePathSet = new Set((baseChildren || []).map((child) => child.path));

      const mergedBaseChildren = (baseChildren || []).map((baseChild) => {
        const currentChild = currentByPath.get(baseChild.path);
        if (!currentChild) {
          return cloneProductChild(baseChild);
        }
        return {
          ...currentChild,
          status: baseChild.status,
          customStyle: currentChild.customStyle ? { ...currentChild.customStyle } : undefined,
        };
      });

      const appendedCurrentChildren = (currentChildren || [])
        .filter((child) => !basePathSet.has(child.path))
        .map(cloneProductChild);

      return [...mergedBaseChildren, ...appendedCurrentChildren];
    };

    const mergeRuntimeProtectedProduct = (
      currentProduct: ProductNode | undefined,
      baseProduct: ProductNode
    ): ProductNode => {
      if (!currentProduct) {
        return cloneProductNode(baseProduct);
      }

      return {
        ...currentProduct,
        status: baseProduct.status,
        customStyle: currentProduct.customStyle ? { ...currentProduct.customStyle } : undefined,
        children: mergeRuntimeProtectedChildren(currentProduct.children, baseProduct.children),
      };
    };

    const buildMergedProductOrder = (mergedProducts: ProductNode[]) => {
      const mergedPaths = new Set(mergedProducts.map((product) => product.path));
      const keptOrder = (current.productOrder || []).filter((path) => mergedPaths.has(path));
      const missingOrder = mergedProducts
        .map((product) => product.path)
        .filter((path) => !keptOrder.includes(path));
      return [...keptOrder, ...missingOrder];
    };

    const buildRuntimeProtectedModuleRestore = () => {
      const currentByPath = new Map(current.products.map((product) => [product.path, product]));
      const basePathSet = new Set(base.products.map((product) => product.path));

      const mergedBaseProducts = base.products.map((baseProduct) =>
        mergeRuntimeProtectedProduct(currentByPath.get(baseProduct.path), baseProduct)
      );

      const appendedCurrentProducts = current.products
        .filter((product) => !basePathSet.has(product.path))
        .map(cloneProductNode);

      const mergedProducts = [...mergedBaseProducts, ...appendedCurrentProducts];
      const mergedOrder = buildMergedProductOrder(mergedProducts);
      const activePathSet = new Set(mergedProducts.filter((product) => product.status === "active").map((product) => product.path));

      return {
        ...current,
        products: mergedProducts,
        customDefaultPaths: mergedOrder.filter((path) => activePathSet.has(path)),
        productOrder: mergedOrder,
        customProducts: cloneCustomProducts(current.customProducts),
        layoutStructureCustomized: false,
      };
    };

    const keepRuntimeModulesAsIs = (): ExportableConfig => ({
      ...current,
      products: cloneSharedProducts(current.products),
      customDefaultPaths: [...(current.customDefaultPaths || [])],
      productOrder: [...(current.productOrder || [])],
      customProducts: cloneCustomProducts(current.customProducts),
      layoutStructureCustomized: current.layoutStructureCustomized === true,
    });

    const buildRuntimeProtectedLayoutRestore = (config: ExportableConfig): ExportableConfig => ({
      ...config,
      layoutStyle: { ...base.layoutStyle },
      visualCardLayout: base.visualCardLayout ? cloneVisualCardLayout(base.visualCardLayout) : undefined,
      layoutSections: cloneLayoutSections(base.layoutSections || DEFAULT_LAYOUT_SECTIONS),
      activeTheme: base.activeTheme,
      customThemes: cloneThemes(base.customThemes),
      builtinThemeOverrides: cloneThemeMap(base.builtinThemeOverrides),
      sidebarStyle: base.sidebarStyle ? { ...base.sidebarStyle } : config.sidebarStyle,
      globalFontFamily: base.globalFontFamily,
      globalFontWeight: base.globalFontWeight,
      globalLetterSpacing: base.globalLetterSpacing,
      layoutCustomized: false,
    });

    const keepRuntimeLayoutAsIs = (config: ExportableConfig): ExportableConfig => ({
      ...config,
      layoutStyle: { ...current.layoutStyle },
      visualCardLayout: current.visualCardLayout ? cloneVisualCardLayout(current.visualCardLayout) : undefined,
      layoutSections: cloneLayoutSections(current.layoutSections || DEFAULT_LAYOUT_SECTIONS),
      activeTheme: current.activeTheme,
      customThemes: cloneThemes(current.customThemes),
      builtinThemeOverrides: cloneThemeMap(current.builtinThemeOverrides),
      sidebarStyle: current.sidebarStyle ? { ...current.sidebarStyle } : config.sidebarStyle,
      globalFontFamily: current.globalFontFamily,
      globalFontWeight: current.globalFontWeight,
      globalLetterSpacing: current.globalLetterSpacing,
      layoutCustomized: current.layoutCustomized === true,
    });

    const buildRuntimeProtectedServiceRestore = (config: ExportableConfig): ExportableConfig => ({
      ...config,
      soundEnabled: base.soundEnabled,
      soundVolume: base.soundVolume,
      soundStyle: base.soundStyle,
      csAvatarId: base.csAvatarId,
      csEnabled: base.csEnabled,
      csVoiceEnabled: base.csVoiceEnabled,
      csVoiceGender: base.csVoiceGender,
      csVoiceRate: base.csVoiceRate,
      customerServiceSections: cloneCustomerServiceSections(
        base.customerServiceSections || DEFAULT_CUSTOMER_SERVICE_SECTIONS
      ),
      csAvatarOverrides: cloneAvatarOverrides(current.csAvatarOverrides),
      customerServiceCustomized: false,
    });

    const keepRuntimeServiceAsIs = (config: ExportableConfig): ExportableConfig => ({
      ...config,
      soundEnabled: current.soundEnabled,
      soundVolume: current.soundVolume,
      soundStyle: current.soundStyle,
      csAvatarId: current.csAvatarId,
      csEnabled: current.csEnabled,
      csVoiceEnabled: current.csVoiceEnabled,
      csVoiceGender: current.csVoiceGender,
      csVoiceRate: current.csVoiceRate,
      customerServiceSections: cloneCustomerServiceSections(
        current.customerServiceSections || DEFAULT_CUSTOMER_SERVICE_SECTIONS
      ),
      csAvatarOverrides: cloneAvatarOverrides(current.csAvatarOverrides),
      customerServiceCustomized: current.customerServiceCustomized === true,
    });

    if (preserveRuntimeContent) {
      if (target === "all") {
        const nextModules = preserveCustomizedModules ? keepRuntimeModulesAsIs() : buildRuntimeProtectedModuleRestore();
        const nextLayout = preserveCustomizedLayout ? keepRuntimeLayoutAsIs(nextModules) : buildRuntimeProtectedLayoutRestore(nextModules);
        return preserveCustomizedService ? keepRuntimeServiceAsIs(nextLayout) : buildRuntimeProtectedServiceRestore(nextLayout);
      }
      if (target === "modules") {
        return preserveCustomizedModules ? keepRuntimeModulesAsIs() : buildRuntimeProtectedModuleRestore();
      }
      if (target === "layout") {
        return preserveCustomizedLayout ? keepRuntimeLayoutAsIs(current) : buildRuntimeProtectedLayoutRestore(current);
      }
      return preserveCustomizedService ? keepRuntimeServiceAsIs(current) : buildRuntimeProtectedServiceRestore(current);
    }

    if (target === "all") {
      return {
        ...base,
        customerServiceCustomized: false,
        layoutCustomized: false,
        layoutStructureCustomized: false,
      };
    }
    if (target === "modules") {
      return {
        ...current,
        products: cloneSharedProducts(base.products),
        customDefaultPaths: [...(base.customDefaultPaths || [])],
        productOrder: [...(base.productOrder || [])],
        customProducts: cloneCustomProducts(base.customProducts),
        layoutStructureCustomized: false,
      };
    }
    if (target === "layout") {
      return {
        ...current,
        layoutStyle: { ...base.layoutStyle },
        visualCardLayout: base.visualCardLayout ? cloneVisualCardLayout(base.visualCardLayout) : undefined,
        layoutSections: cloneLayoutSections(base.layoutSections || DEFAULT_LAYOUT_SECTIONS),
        activeTheme: base.activeTheme,
        customThemes: cloneThemes(base.customThemes),
        builtinThemeOverrides: cloneThemeMap(base.builtinThemeOverrides),
        sidebarStyle: base.sidebarStyle ? { ...base.sidebarStyle } : current.sidebarStyle,
        globalFontFamily: base.globalFontFamily,
        globalFontWeight: base.globalFontWeight,
        globalLetterSpacing: base.globalLetterSpacing,
        layoutCustomized: false,
      };
    }
    return {
      ...current,
      soundEnabled: base.soundEnabled,
      soundVolume: base.soundVolume,
      soundStyle: base.soundStyle,
      csAvatarId: base.csAvatarId,
      csEnabled: base.csEnabled,
      csVoiceEnabled: base.csVoiceEnabled,
      csVoiceGender: base.csVoiceGender,
      csVoiceRate: base.csVoiceRate,
      customerServiceSections: cloneCustomerServiceSections(
        base.customerServiceSections || DEFAULT_CUSTOMER_SERVICE_SECTIONS
      ),
      csAvatarOverrides: cloneAvatarOverrides(base.csAvatarOverrides),
      customerServiceCustomized: false,
    };
  }, []);

  function getRestoreButtonLabel(target: ProductMarketRestoreTarget) {
    return getProductMarketRestoreCopy(templateLifecycleRole, target).label;
  }

  function getRestoreButtonTooltip(target: ProductMarketRestoreTarget) {
    return getProductMarketRestoreCopy(templateLifecycleRole, target).description;
  }

  function getTemplateSourceScope(scope: ProductMarketScope) {
    if (scope === "client" || scope === "client_source") return "client_source" as const;
    if (scope === "agency" || scope === "agency_source") return "agency_source" as const;
    return "hq" as const;
  }

  function getTemplateSourceLabel(scope: ProductMarketScope) {
    if (scope === "client" || scope === "client_source") return "客户源";
    if (scope === "agency" || scope === "agency_source") return "代理源";
    return "总部默认";
  }

  function getTemplatePublishTargetLabel(scope: ProductMarketScope) {
    if (scope === "client_source") return "全部客户端计划";
    if (scope === "agency_source") return "代理端";
    return "下游端";
  }

  function shouldWriteRuntimeSnapshotOnly(
    scope: ProductMarketScope,
    siteId: string | null | undefined
  ) {
    return (scope === "client" || scope === "agency") && !!siteId && !isCentralStyleSettingsPage;
  }

  function writeScopedCurrentAndDefaultConfig(
    scope: ProductMarketScope,
    siteId: string | null | undefined,
    nextConfig: ExportableConfig,
    options?: { skipSourceTemplateDraft?: boolean; skipRemoteSnapshot?: boolean }
  ) {
    writeScopedConfig(scope, defaultConfigKey(scope, siteId), nextConfig, options);
    writeScopedConfig(scope, currentConfigKey(scope, siteId), nextConfig, options);
  }

  function persistScopedSnapshot(
    scope: ProductMarketScope,
    siteId: string | null | undefined,
    nextConfig: ExportableConfig,
    options?: { runtimeSnapshotOnly?: boolean; skipSourceTemplateDraft?: boolean; skipRemoteSnapshot?: boolean }
  ) {
    if (shouldWriteRuntimeSnapshotOnly(scope, siteId) || options?.runtimeSnapshotOnly) {
      writeScopedConfig(scope, currentConfigKey(scope, siteId), nextConfig, options);
      return;
    }
    if (scope === "client_source" || scope === "agency_source") {
      writeScopedConfig(scope, currentConfigKey(scope, siteId), nextConfig, options);
      return;
    }
    writeScopedCurrentAndDefaultConfig(scope, siteId, nextConfig, options);
  }

  function writeScopedCurrentConfigWithDefaultFallback(
    scope: ProductMarketScope,
    siteId: string | null | undefined,
    nextConfig: ExportableConfig,
    options?: { skipSourceTemplateDraft?: boolean; skipRemoteSnapshot?: boolean }
  ) {
    writeScopedConfig(scope, currentConfigKey(scope, siteId), nextConfig, options);
    if (!readStoredConfig(defaultConfigKey(scope, siteId))) {
      writeScopedConfig(scope, defaultConfigKey(scope, siteId), nextConfig, options);
    }
  }

  function persistCurrentScopeConfig(
    nextConfig: ExportableConfig,
    options?: {
      includeDefault?: boolean;
      ensureDefaultFallback?: boolean;
      skipSourceTemplateDraft?: boolean;
      skipRemoteSnapshot?: boolean;
    }
  ) {
    if (shouldWriteRuntimeSnapshotOnly(configScope, effectiveSiteId)) {
      writeScopedConfig(configScope, currentConfigKey(configScope, effectiveSiteId), nextConfig, options);
      return;
    }

    if (options?.includeDefault) {
      writeScopedCurrentAndDefaultConfig(configScope, effectiveSiteId, nextConfig, options);
      return;
    }
    if (options?.ensureDefaultFallback) {
      writeScopedCurrentConfigWithDefaultFallback(configScope, effectiveSiteId, nextConfig, options);
      return;
    }
    writeScopedConfig(configScope, currentConfigKey(configScope, effectiveSiteId), nextConfig, options);
  }

  const getScopedRestoreBaseline = useCallback(
    (scope: ProductMarketScope, siteId?: string | null) =>
      getInitialRestoreConfig(
        scope,
        readStoredConfig(defaultConfigKey(scope, siteId)) ||
          readStoredConfig(currentConfigKey(scope, siteId)) ||
          getInheritedConfig(scope, siteId)
      ),
    []
  );

  function getRuntimePlanLabel() {
    return activeSite
      ? resolveSiteDisplayName(activeSite, activeSite.planCode || activeSite.id)
      : "当前独立计划";
  }

  function getScopedPlanLabelSuffix() {
    return activeSite && !isCentralStyleSettingsPage
      ? ` ${resolveSiteDisplayName(activeSite, activeSite.planCode || activeSite.id)}`
      : "";
  }

  function getRestoreTargetSummaryLabel(target: ProductMarketRestoreTarget) {
    return getProductMarketRestoreCopy(templateLifecycleRole, target).targetLabel;
  }

  function withNormalizedSidebarStyle(
    nextConfig: ExportableConfig,
    fallbackConfig?: Partial<ExportableConfig> | null
  ) {
    return {
      ...nextConfig,
      sidebarStyle: normalizeSidebarStyle(
        nextConfig.sidebarStyle || fallbackConfig?.sidebarStyle,
        nextConfig.activeTheme
      ),
    };
  }

  function resolveCurrentScopeRestoreBaseline() {
    const sharedRestoreBaseline = getSharedInitialClientConfig(effectiveSiteId);
    const sourceRestoreBaseline = getScopedRestoreBaseline(
      getTemplateSourceScope(configScope),
      effectiveSiteId
    );
    const scopedRestoreBaseline = getInitialRestoreConfig(
      configScope,
      readStoredConfig(defaultConfigKey(configScope, effectiveSiteId)) ||
        readStoredConfig(currentConfigKey(configScope, effectiveSiteId))
    );

    // A source workspace is the factory source of truth.  Its restore action
    // must return to the last saved/published source baseline (which contains
    // Operations, Modules, Layout and Customer Service together), not to the
    // old code-only seed used only when no source baseline exists yet.
    if (templateLifecycleRole === "source") {
      return scopedRestoreBaseline;
    }
    if (shouldWriteSharedClientStyle) return sharedRestoreBaseline;
    if (isRuntimePlanPage) {
      return sourceRestoreBaseline || sharedRestoreBaseline || scopedRestoreBaseline;
    }
    return scopedRestoreBaseline || sourceRestoreBaseline || sharedRestoreBaseline;
  }

  function getRestoreSuccessMessage(target: ProductMarketRestoreTarget, sourceLabel: string) {
    if (target === "all" && isRuntimePlanPage) {
      return `${getRuntimePlanLabel()} 已恢复到${sourceLabel}模板源链`;
    }
    if (shouldWriteSharedClientStyle && target === "all") {
      return "总部客户端模板配置已恢复为共享模板初始链";
    }
    if (templateLifecycleRole === "source") {
      return `${getRestoreButtonLabel(target)}已载入当前草稿；保存后成为源体草稿，发布后才影响下游`;
    }
    return `${getRestoreButtonLabel(target)}已完成`;
  }

  function getSaveDefaultsSuccessMessage(runtimeSnapshotOnly: boolean) {
    if (shouldWriteSharedClientStyle) {
      return "总部客户端模板配置已保存为共享模板初始链";
    }
    if (templateLifecycleRole === "source") {
      return `${scopeLabel}${getScopedPlanLabelSuffix()} 草稿已保存并完成回读验证，尚未发布`;
    }
    return runtimeSnapshotOnly
      ? `${scopeLabel}${getScopedPlanLabelSuffix()} 当前计划设置已保存`
      : `${scopeLabel}${getScopedPlanLabelSuffix()} 模板配置已保存`;
  }

  function buildSharedAwareConfig(
    baseConfig: ExportableConfig,
    options?: {
      includeLayoutFlags?: boolean;
    }
  ) {
    let nextConfig = shouldWriteSharedClientStyle
      ? normalizeSharedInitialClientConfig(baseConfig)
      : baseConfig;

    if (showSharedStyleControls && !isCentralStyleSettingsPage) {
      nextConfig = {
        ...nextConfig,
        customerServiceCustomized: detectCustomerServiceCustomizationAgainstShared(
          nextConfig,
          effectiveSiteId
        ),
        ...(options?.includeLayoutFlags
          ? {
              layoutCustomized: detectLayoutCustomizationAgainstShared(
                nextConfig,
                effectiveSiteId
              ),
              layoutStructureCustomized:
                nextConfig.layoutStructureCustomized ??
                detectLayoutStructureCustomizationAgainstShared(nextConfig, effectiveSiteId),
            }
          : {}),
      };
    }

    return nextConfig;
  }

  function commitConfigSnapshot(
    nextConfig: ExportableConfig,
    options?: {
      syncCustomizationFlags?: boolean;
      syncMaterialAssets?: boolean;
      runtimeSnapshotOnly?: boolean;
      writeSharedStyle?: boolean;
      writeSharedVisualContract?: boolean;
      useCurrentScopePersist?: boolean;
      includeDefault?: boolean;
      ensureDefaultFallback?: boolean;
      skipSourceTemplateDraft?: boolean;
      skipRemoteSnapshot?: boolean;
      /** The caller has already updated the live Zustand catalogue. */
      applyState?: boolean;
    }
  ) {
    if (productMarketWriteLocked) {
      toast.error(productMarketSourceLocked
        ? "当前源码锁已启用：系统命令、可视化、同步与保存均不可修改。请先在源开发器的页面锁定器中手动解除勾选。"
        : "当前页面已锁定：系统命令、可视化、同步与保存均不可修改。请先在源开发器的页面锁定器中手动解除勾选。");
      return false;
    }
    if (options?.applyState !== false) {
      applyConfigSnapshotToState(nextConfig, {
        syncCustomizationFlags: options?.syncCustomizationFlags,
        syncMaterialAssets: options?.syncMaterialAssets,
      });
    }
    if (options?.useCurrentScopePersist) {
      persistCurrentScopeConfig(nextConfig, {
        includeDefault: options?.includeDefault,
        ensureDefaultFallback: options?.ensureDefaultFallback,
        skipSourceTemplateDraft: options?.skipSourceTemplateDraft,
        skipRemoteSnapshot: options?.skipRemoteSnapshot,
      });
    } else {
      persistScopedSnapshot(configScope, effectiveSiteId, nextConfig, {
        runtimeSnapshotOnly: options?.runtimeSnapshotOnly,
        skipSourceTemplateDraft: options?.skipSourceTemplateDraft,
        skipRemoteSnapshot: options?.skipRemoteSnapshot,
      });
    }
    if (options?.writeSharedVisualContract) {
      writeSharedVisualContractSettings(nextConfig);
    } else if (options?.writeSharedStyle) {
      writeSharedStyleSettings(nextConfig);
    }
    pendingOperationStatusRef.current = {};
    return true;
  }

  useEffect(() => {
    const handleDirectVisualCardApply = (event: Event) => {
      const detail = (event as CustomEvent<VisualCardDirectApplyDetail & {
        sharedStylePatch?: VisualCardSharedStyleApplyPatch;
      }>).detail;
      if (!detail?.config || detail.accepted) return;
      const scope: VisualCardLayoutScope = {
        workspaceScope: resolveVisualCardWorkspaceScope(location.pathname),
        pathname: location.pathname,
        search: location.search,
      };
      if (detail.scopeKey !== buildVisualCardLayoutScopeKey(scope)) return;
      const currentRouteLock = resolveCompletedLayoutLock(location.pathname, location.search);
      if (isRouteCompletedPageHardLocked(location.pathname, location.search)
        || (currentRouteLock && isCompletedSourceLocked(currentRouteLock))) {
        detail.error = "当前页面锁或源码锁已启用；可视化保存已阻断。";
        return;
      }
      if (!isGlobalThemeSource) {
        detail.error = "当前页面不是可写入的总部／源体模板。";
        return;
      }

      const currentConfig = useProductMarketStore.getState().exportConfig();
      const applicationScope = detail.applicationScope || "global";
      const visualIntentRequest = {
        workspaceScope: scope.workspaceScope,
        pathname: location.pathname,
        search: location.search,
      };
      const canaryIntent = readDeveloperGlobalStyleVisualIntent(window.sessionStorage, visualIntentRequest);
      if (canaryIntent && applicationScope !== "canary-profile") {
        detail.error = "全局开发流程试点只允许确认 canary-profile；当前页配置与全局配置均不会写入。";
        return;
      }
      if (applicationScope === "canary-profile") {
        if (!canaryIntent) {
          detail.error = "缺少全局开发流程试点意图，已拒绝独立 canary-profile 保存。";
          return;
        }
        if (!detail.sharedStylePatch) {
          detail.error = "试点档案缺少完整共享外观补丁，未写入任何配置。";
          return;
        }
        const canaryProfileDraftId = `canary-profile-${Date.now()}`;
        const markerCapture = captureMarketingPlaybookDeveloperMarkerProof(document, {
          pathname: location.pathname,
          search: location.search,
        }, {
          workspaceScope: scope.workspaceScope,
          canaryProfileDraftId,
        });
        if (!markerCapture) {
          detail.error = "五个 canonical 标注未在真实可视化开发态自然显示；未生成试点档案，请保持开发器打开并修复标注后重试。";
          return;
        }
        const audit = recordPageCompositionAudit(location.pathname, location.search);
        const developerMarkerProof = bindMarketingPlaybookDeveloperMarkerProof(markerCapture, audit.id);
        if (!developerMarkerProof) {
          detail.error = "开发态标注证据未能绑定真实审计；未生成试点档案。";
          return;
        }
        const savedAt = new Date().toISOString();
        const stored = writeDeveloperGlobalStyleCanaryProfileDraft(window.sessionStorage, {
          id: canaryProfileDraftId,
          mode: "canary-profile",
          workspaceScope: scope.workspaceScope,
          pathname: location.pathname,
          search: location.search,
          appearance: createDeveloperGlobalStyleCanaryAppearance(detail.config, detail.sharedStylePatch),
          visualAuditId: audit.id,
          recoveryPointId: audit.pageRestorePointId,
          baselineOnly: detail.canaryBaselineOnly === true,
          savedAt,
          developerMarkerProof,
        });
        if (!stored) {
          detail.error = "试点共享外观档案未能写入会话，未改动页面或全局配置。";
          return;
        }
        const confirmed = writeDeveloperGlobalStyleVisualConfirmation(window.sessionStorage, {
          scope: "canary-preview",
          workspaceScope: scope.workspaceScope,
          pathname: location.pathname,
          search: location.search,
          auditId: audit.id,
          canaryProfileDraftId,
          appliedAt: savedAt,
        });
        if (!confirmed) {
          detail.error = "试点审计确认未能写入会话；请重试确认档案。";
          return;
        }
        detail.appliedConfig = cloneVisualCardLayout(detail.config);
        detail.accepted = true;
        detail.auditId = audit.id;
        detail.recoveryPointId = audit.pageRestorePointId;
        clearDeveloperGlobalStyleVisualIntent(window.sessionStorage, visualIntentRequest);
        return;
      }
      const persistedGlobalSeed = applicationScope === "global"
        ? detail.config
        : currentConfig.visualCardLayout || createDefaultVisualCardLayout();
      const globalLayout = mergeVisualCardLayoutForApplicationScope(
        createDefaultVisualCardLayout(),
        persistedGlobalSeed,
        "global",
      );

      if (applicationScope === "current-page") {
        const audit = recordPageCompositionAudit(location.pathname, location.search);
        if (!writeVisualCardPageOverride(scope, detail.config)) {
          detail.error = "当前页面布局保存失败，未改动全局模板。";
          return;
        }
        detail.appliedConfig = composeVisualCardLayout(
          globalLayout,
          readVisualCardPageOverride(scope),
        );
        detail.accepted = true;
        detail.auditId = audit.id;
        detail.recoveryPointId = audit.pageRestorePointId;
        return;
      }

      const sharedStylePatch = detail.sharedStylePatch;
      const nextConfig: ExportableConfig = {
        ...currentConfig,
        // A source template carries only the reviewed global projection.
        // Table/content/card choices remain in the route-owned page overlay.
        visualCardLayout: cloneVisualCardLayout(globalLayout),
        layoutStructureCustomized: true,
        ...(sharedStylePatch ? {
          layoutCustomized: true,
          layoutStyle: {
            ...currentConfig.layoutStyle,
            ...sharedStylePatch.layoutStyle,
          },
          globalFontFamily: sharedStylePatch.globalTypography.globalFontFamily || currentConfig.globalFontFamily,
          globalFontWeight: sharedStylePatch.globalTypography.globalFontWeight || currentConfig.globalFontWeight,
          globalLetterSpacing: sharedStylePatch.globalTypography.globalLetterSpacing || currentConfig.globalLetterSpacing,
        } : {}),
      };
      const audit = recordPageCompositionAudit(location.pathname, location.search);
      const committed = commitConfigSnapshot(nextConfig, {
        syncCustomizationFlags: true,
        useCurrentScopePersist: true,
        includeDefault: templateLifecycleRole !== "source",
        writeSharedVisualContract: true,
      });
      if (!committed) {
        detail.error = "当前页面锁或源码锁在保存前发生变化；共享全局草稿未写入。";
        return;
      }
      detail.appliedConfig = composeVisualCardLayout(
        globalLayout,
        readVisualCardPageOverride(scope),
      );
      detail.accepted = true;
      detail.auditId = audit.id;
      detail.recoveryPointId = audit.globalRestorePointId;
    };

    window.addEventListener(VISUAL_CARD_DIRECT_APPLY_EVENT, handleDirectVisualCardApply);
    return () => window.removeEventListener(VISUAL_CARD_DIRECT_APPLY_EVENT, handleDirectVisualCardApply);
  }, [isGlobalThemeSource, location.pathname, location.search, productMarketWriteLocked, templateLifecycleRole]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("developmentApply") !== "current-frame") return;
    const developmentDraftId = params.get("developmentDraft") || "";
    const visualCardHandoffId = params.get("visualCardLayout") || "";

    if (developmentDraftId && processedVisualCardHandoffsRef.current.has(developmentDraftId)) return;

    // Runtime plans stay read-only here.  A frame application can only write
    // the active headquarters/source template; downstream plans receive it
    // later through their explicit release flow and keep local custom data.
    if (!isGlobalThemeSource) {
      params.delete("developmentApply");
      params.delete("developmentDraft");
      params.delete("visualCardLayout");
      navigate(`${location.pathname}${params.toString() ? `?${params.toString()}` : ""}`, { replace: true });
      toast.error("当前页面不是可写入的总部／源体模板，未应用任何样式。");
      return;
    }

    let visualCardLayout = undefined;
    if (visualCardHandoffId) {
      if (!developmentDraftId || visualCardHandoffId !== developmentDraftId) {
        params.delete("developmentApply");
        params.delete("developmentDraft");
        params.delete("visualCardLayout");
        navigate(`${location.pathname}${params.toString() ? `?${params.toString()}` : ""}`, { replace: true });
        toast.error("可视化布局交接标识不一致，未应用任何配置。");
        return;
      }
      const visualCardScope: VisualCardLayoutScope = {
        workspaceScope: resolveVisualCardWorkspaceScope(location.pathname),
        pathname: location.pathname,
        search: location.search,
      };
      visualCardLayout = takeVisualCardLayoutDraftHandoff(visualCardScope, visualCardHandoffId) || undefined;
      if (!visualCardLayout) {
        processedVisualCardHandoffsRef.current.add(developmentDraftId);
        params.delete("developmentApply");
        params.delete("developmentDraft");
        params.delete("visualCardLayout");
        navigate(`${location.pathname}${params.toString() ? `?${params.toString()}` : ""}`, { replace: true });
        toast.error("可视化布局草案已失效、已消费或不属于当前租户，未应用任何配置。");
        return;
      }
    }

    if (developmentDraftId) processedVisualCardHandoffsRef.current.add(developmentDraftId);

    const currentConfig = useProductMarketStore.getState().exportConfig();
    const currentLayout = currentConfig.layoutStyle;
    // Only bridge the reusable frame tokens.  Module content, business data,
    // materials, cards and source-specific additions are intentionally absent.
    const sharedFramePatch: Partial<LayoutCustomStyle> = {
      defaultDialogBgColor: currentLayout.contentBgColor,
      defaultDialogHeaderBgColor: currentLayout.clientSecondaryTitleBgColor || currentLayout.headerBgColor,
      defaultDialogPanelBgColor: currentLayout.clientSecondaryPageBgColor || currentLayout.contentBgColor,
      defaultDialogContentBgColor: currentLayout.clientSecondaryListBgColor || currentLayout.contentBgColor,
      defaultDialogHeaderTextColor: currentLayout.clientSecondaryTitleTextColor || currentLayout.headerTextColor,
      defaultDialogButtonColor: currentLayout.themePanelButtonColor,
      defaultDialogButtonTextColor: currentLayout.headerButtonTextColor,
    };
    const nextConfig: ExportableConfig = {
      ...currentConfig,
      layoutStyle: { ...currentLayout, ...sharedFramePatch },
      visualCardLayout: visualCardLayout ? cloneVisualCardLayout(visualCardLayout) : currentConfig.visualCardLayout,
      layoutStructureCustomized: visualCardLayout ? true : currentConfig.layoutStructureCustomized,
    };

    setTempLayout((current) => ({ ...current, ...sharedFramePatch }));
    commitConfigSnapshot(nextConfig, {
      syncCustomizationFlags: true,
      useCurrentScopePersist: true,
      includeDefault: templateLifecycleRole !== "source",
    });

    params.delete("developmentApply");
    params.delete("developmentDraft");
    params.delete("visualCardLayout");
    navigate(`${location.pathname}${params.toString() ? `?${params.toString()}` : ""}`, { replace: true });
    toast.success(visualCardLayout
      ? "可视化布局组合与共享框架已应用到当前源体；未改动业务内容、素材或下游自定义。"
      : "共享框架已应用到当前页面；仅更新框架令牌，未改动内容、素材或下游自定义。");
  }, [isGlobalThemeSource, location.pathname, location.search, navigate, templateLifecycleRole]);

  const handleSyncFromSource = useCallback((target: ProductMarketRestoreTarget = "all") => {
    if (!isRuntimePlanPage) return;
    if (productMarketHardLocked) {
      toast.error("当前页面已锁定：不能执行同步。请先在源开发器的页面锁定器中手动解除勾选。");
      return;
    }
    const planLabel = getRuntimePlanLabel();
    const targetLabel = getRestoreTargetSummaryLabel(target);
    const sourceScope = getTemplateSourceScope(configScope);
    const sourceLabel = getTemplateSourceLabel(configScope);
    const currentPreview = useProductMarketStore.getState().exportConfig();
    const sourcePreview = getScopedRestoreBaseline(sourceScope, effectiveSiteId);
    const changedSections = sourcePreview
      ? summarizeProductMarketConfigChanges(currentPreview, sourcePreview).labels
      : [];
    openSourceActionDialog({
      title: `手动同步${sourceLabel}模板最新版`,
      description: `同步预览：检测到 ${changedSections.length} 类配置差异${changedSections.length ? `（${changedSections.slice(0, 6).join("、")}）` : ""}。确定将 ${planLabel} 的${targetLabel}手动同步为${sourceLabel}模板最新版吗？只会同步程序功能和结构设置，不会覆盖客户已添加、已填写或已编制的内容数据。`,
      confirmLabel: "确认手动同步",
      busyLabel: "同步模板中...",
      minimumBusyMs: 3000,
      onConfirm: async () => {
        if (!effectiveSiteId) throw new Error("手动同步失败：缺少当前客户端计划标识。");
        if (target !== "all") {
          throw new Error("手动同步仅支持完整模板；分区恢复请使用对应的“恢复”操作。");
        }
        const preferredIdentity = resolveRuntimeInstanceIdentity(configScope as "client" | "agency", effectiveSiteId);
        const existingRuntime = await resolveExistingRuntimeInstance(preferredIdentity);
        if (!existingRuntime) throw new Error("手动同步失败：当前计划尚未由开通流程建立服务端实例。");
        const identity = existingRuntime.identity;
        const syncedInstance = await syncLatest(identity.instanceId, {
          syncMode: "merge",
          createBackup: true,
          operator: "product-market-manual-sync",
        });
        const serverSnapshot = extractRemoteInstanceConfig(syncedInstance)
          || await readRemoteInstanceConfig(identity.instanceId);
        if (!serverSnapshot) {
          throw new Error("手动同步失败：服务端实例已处理，但回读不到有效配置。");
        }
        const syncedConfig = withNormalizedSidebarStyle(serverSnapshot, serverSnapshot);

        commitConfigSnapshot(syncedConfig, {
          syncCustomizationFlags: true,
          syncMaterialAssets: true,
          runtimeSnapshotOnly: shouldPersistRuntimeSnapshotOnly,
          skipRemoteSnapshot: true,
        });
        toast.success(`${planLabel} 已手动同步${sourceLabel}模板最新版`);
      },
    });
  }, [
    configScope,
    effectiveSiteId,
    commitConfigSnapshot,
    getScopedRestoreBaseline,
    getRestoreTargetSummaryLabel,
    getRuntimePlanLabel,
    getTemplateSourceLabel,
    getTemplateSourceScope,
    isRuntimePlanPage,
    openSourceActionDialog,
    productMarketHardLocked,
    shouldPersistRuntimeSnapshotOnly,
    withNormalizedSidebarStyle,
  ]);

  const handlePublishTemplateSource = useCallback(() => {
    if (!isSourceScope) return;
    if (productMarketHardLocked) {
      toast.error("当前页面已锁定：不能执行发布。请先在源开发器的页面锁定器中手动解除勾选。");
      return;
    }
    const sourceLabel = getTemplateSourceLabel(configScope);
    const targetLabel = getTemplatePublishTargetLabel(configScope);
    const automaticClientRollout = configScope === "client_source";
    openSourceActionDialog({
      title: `发布${sourceLabel}模板`,
      description: automaticClientRollout
        ? `将“运营市场、栏目配置、版面风格、客服音效”的已回读草稿发布为不可变新版，并安全合并到全部客户端计划。只有批次全部成功后才会设为工厂默认；客户业务内容、上传素材、新增内容和下游覆盖保持不变。`
        : `将仅发布已回读验证的${sourceLabel}草稿。请先点击“保存草稿”；未保存的当前修改不会被带入本次发布。发布后，${targetLabel}可读取该模板新版。`,
      confirmLabel: "确认发布模板",
      busyLabel: automaticClientRollout ? "发布并下发全部计划中..." : "发布模板中...",
      minimumBusyMs: 3000,
      onConfirm: async () => {
        try {
          const templateId = getProductMarketTemplateId(configScope);
          // Publication owns the server's hashed draft, not a reconstruction
          // of another tab's transient state or a passive local cache. The
          // expected hash makes a concurrent draft replacement fail closed.
          const templateHead = await fetchTemplate(templateId);
          const latestVersion = typeof templateHead.latest_version === "string"
            ? templateHead.latest_version
            : null;
          const expectedDraftConfigHash = typeof templateHead.draft_config_hash === "string"
            ? templateHead.draft_config_hash
            : null;
          const [savedDraft, existingPublished, immutableVersions] = await Promise.all([
            readRemoteTemplateConfig(templateId, "draft"),
            readRemoteTemplateConfig(templateId, "published"),
            listTemplateVersions(templateId),
          ]);
          const latestImmutableVersion = immutableVersions.find((item) => (
            item.version === latestVersion
            && new Set(["published", "archived"]).has(item.reviewStatus || "")
          ));
          const latestVersionHasLifecycleContract = Boolean(
            latestImmutableVersion?.changelog?.includes(
              PRODUCT_MARKET_TEMPLATE_LIFECYCLE_CONTRACT_VERSION,
            ),
          );
          const savedDraftSignature = productMarketConfigSignature(savedDraft);
          const publishedConfigSignature = productMarketConfigSignature(existingPublished);
          const verifiedDraftMatches = Boolean(
            expectedDraftConfigHash
            && savedDraftSignature,
          );
          const publishedVersionMatches = Boolean(
            latestVersion
            && latestVersionHasLifecycleContract
            && publishedConfigSignature,
          );
          if (!verifiedDraftMatches && !publishedVersionMatches) {
            throw new Error("发布前校验失败：服务端没有可验证的已保存草稿，也没有可继续下发的共享契约版本。请先点击“保存草稿”，完成回读校验后再发布新版；当前未保存修改不会被带入发布。");
          }
          // A server draft always wins, even when an older contract version is
          // already published. Reuse is only the crash-recovery path after a
          // successful publish has cleared that draft.
          const canReusePublishedVersion = !verifiedDraftMatches && publishedVersionMatches;
          const nextConfig = (canReusePublishedVersion ? existingPublished : savedDraft) as ExportableConfig;
          const nextConfigSignature = productMarketConfigSignature(nextConfig);
          // Avoid a regex character class here: Tailwind's source scanner can
          // mistake it for an arbitrary CSS declaration during production build.
          const versionStamp = new Date().toISOString()
            .replaceAll("-", "")
            .replaceAll(":", "")
            .replaceAll(".", "")
            .replaceAll("T", "")
            .replaceAll("Z", "")
            .slice(0, 17);
          const version = canReusePublishedVersion ? latestVersion! : `v${versionStamp}`;
          if (!canReusePublishedVersion) {
            const publishedVersion = await publishTemplate(templateId, {
              version,
              changelog: `运营市场、栏目配置、版面风格、客服音效 · 共享契约 ${PRODUCT_MARKET_TEMPLATE_LIFECYCLE_CONTRACT_VERSION}`,
              publishedBy: "product-market-visual-editor",
              expectedDraftConfigHash,
            });
            if (publishedVersion.reviewStatus !== "published") {
              throw new Error(`发布未完成：当前版本状态为 ${publishedVersion.reviewStatus}，尚未成为下游可用版本。`);
            }
            if (productMarketConfigSignature(publishedVersion.configJson) !== nextConfigSignature) {
              throw new Error("发布校验失败：发布接口返回的版本配置与已验证草稿不一致。");
            }
          }

          let publishedConfig: ExportableConfig | null = null;
          for (let attempt = 0; attempt < 3; attempt += 1) {
            publishedConfig = await readRemoteTemplateConfig(templateId, "published");
            if (productMarketConfigSignature(publishedConfig) === nextConfigSignature) break;
            if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 240 * (attempt + 1)));
          }
          if (productMarketConfigSignature(publishedConfig) !== nextConfigSignature) {
            throw new Error("发布校验失败：已发布版本回读与已验证草稿不一致。");
          }

          if (automaticClientRollout) {
            const created = await createTemplateReleaseBatch(templateId, null, undefined, version);
            let batch = await waitForProductMarketReleaseBatch(created.batch);
            if (batch.status === "paused") {
              const resumed = await resumeTemplateReleaseBatch(batch.id);
              batch = await waitForProductMarketReleaseBatch(resumed.batch);
            }
            if (batch.status === "partial_failed" && batch.failed_targets > 0) {
              const retried = await retryTemplateReleaseBatch(batch.id);
              batch = await waitForProductMarketReleaseBatch(retried.batch);
            }
            const completed = verifyCompletedProductMarketReleaseBatch(batch, templateId, version);
            let promoted;
            try {
              promoted = await promoteProductMarketFactoryDefault(
                templateId,
                completed.id,
                PRODUCT_MARKET_TEMPLATE_LIFECYCLE_CONTRACT_VERSION,
              );
            } catch (promotionCause) {
              // Promotion and its audit record are persisted by separate
              // server commits. If the response is interrupted after the
              // pointer commit, reconcile the durable pointer before deciding
              // whether this release actually failed.
              try {
                const reconciled = await fetchProductMarketFactoryDefault(templateId);
                if (reconciled.factory_default_version !== version
                  || reconciled.factory_default_release_batch_id !== completed.id) {
                  throw promotionCause;
                }
                promoted = reconciled;
              } catch {
                throw promotionCause;
              }
            }
            const confirmedFactoryConfig = promoted.factory_default_config_json as ExportableConfig;
            if (!promoted.valid
              || promoted.factory_default_version !== version
              || promoted.factory_default_release_batch_id !== completed.id
              || promoted.factory_default_contract_version !== PRODUCT_MARKET_TEMPLATE_LIFECYCLE_CONTRACT_VERSION
              || promoted.total_targets !== completed.total_targets
              || promoted.succeeded_targets !== completed.succeeded_targets
              || promoted.failed_targets !== 0
              || productMarketConfigSignature(confirmedFactoryConfig) !== nextConfigSignature) {
              throw new Error("服务端工厂默认确认回读与本次完整发布不一致，已阻止成功提示。");
            }
            const factoryKey = defaultConfigKey(configScope, effectiveSiteId);
            // The server-confirmed immutable version is the only authoritative
            // factory default. Persist that readback instead of rebuilding it
            // from mutable editor state after the rollout has completed.
            const factoryWritten = writeScopedConfig(configScope, factoryKey, confirmedFactoryConfig, {
              skipSourceTemplateDraft: true,
              skipRemoteSnapshot: true,
            });
            const expectedFactoryConfig = normalizeProductMarketConfigForStorage({
              ...confirmedFactoryConfig,
              sidebarStyleSyncVersion: SIDEBAR_STYLE_SYNC_VERSION,
            });
            if (!factoryWritten
              || productMarketConfigSignature(readStoredConfig(factoryKey))
                !== productMarketConfigSignature(expectedFactoryConfig)) {
              throw new Error("工厂默认已在服务端确认，但本地回读失败；未显示完成，请刷新后重试核验。");
            }
            toast.success(`${sourceLabel}模板 ${version} 已设为工厂默认，并自动发布到全部客户端计划（${completed.succeeded_targets}/${completed.total_targets}）`);
            return;
          }

          writeScopedConfig(configScope, defaultConfigKey(configScope, effectiveSiteId), nextConfig);
          toast.success(`${sourceLabel}模板 ${version} 已发布并完成回读验证，${targetLabel}可读取新版`);
        } catch (cause) {
          throw normalizeProductMarketPublishError(cause);
        }
      },
    });
  }, [
    commitConfigSnapshot,
    configScope,
    effectiveSiteId,
    getTemplatePublishTargetLabel,
    getTemplateSourceLabel,
    openSourceActionDialog,
    isSourceScope,
    productMarketHardLocked,
  ]);

  const currentSettingsRestoreTarget: ProductMarketRestoreTarget =
    activeSettingsTab === "layout" ? "layout" : activeSettingsTab === "service" ? "service" : "modules";
  const activeSettingsTitle = activeSettingsTab === "layout"
    ? `${productMarketPathPrefix} → 版面风格`
    : activeSettingsTab === "service"
      ? `${productMarketPathPrefix} → 客服音效`
      : `${productMarketPathPrefix} → 栏目配置`;
  const activeSettingsShortTitle = activeSettingsTitle;
  const activeSettingsDescription = activeSettingsTab === "layout"
    ? configScope === "hq"
      ? "设置总部端顶部、侧栏与内容框架；保存后立即更新总部端全局应用。"
      : configScope === "agency_source"
        ? "设置代理源导航与业务工作台样式；发布新版后由代理端同步。"
        : "统一设置各个栏目、切换读条卡片等样式。"
    : activeSettingsTab === "service"
      ? configScope === "hq"
        ? "设置总部端通知、服务助手与提醒音效；保存后立即更新总部端全局应用。"
        : configScope === "agency_source"
          ? "设置代理源服务助手、通知与提醒音效；发布新版后由代理端同步。"
          : "统一设置悬浮客服、提醒声音和语音服务。"
      : configScope === "hq"
        ? "编制总部端导航入口与可见范围；保存后立即更新总部端全局应用。"
        : configScope === "agency_source"
          ? "编制代理源导航入口与团队可见范围；发布新版后由代理端同步。"
          : "统一编制一级栏目和二级栏目，并同步到客户端导航与计划网站。";
  const ProductMarketTitleIcon = ShoppingBag;
  const handleTemplateHeaderActionDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const setOrder = activeSettingsTab === "layout"
      ? setTempLayoutActionOrder
      : activeSettingsTab === "service"
        ? setTempCustomerServiceActionOrder
        : setTempModuleActionOrder;
    setOrder((current) => {
      const oldIndex = current.indexOf(String(active.id) as TemplateHeaderActionId);
      const newIndex = current.indexOf(String(over.id) as TemplateHeaderActionId);
      if (oldIndex === -1 || newIndex === -1) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
  }, [activeSettingsTab]);

  const handleRestoreInitial = useCallback((target: ProductMarketRestoreTarget = "all") => {
    const sourceLabel = getTemplateSourceLabel(configScope);
    const confirmText = isRuntimePlanPage
      ? `确定让当前计划${getRestoreTargetSummaryLabel(target)}恢复到${sourceLabel}模板源吗？这会重新覆盖当前独立快照中的程序功能与结构设置，但不会覆盖客户已添加、已填写或已编制的内容数据。`
      : `确定执行“${getRestoreButtonLabel(target)}”吗？${getProductMarketRestoreCopy(templateLifecycleRole, target).description}`;
    openSourceActionDialog({
      title: getRestoreButtonLabel(target),
      description: confirmText,
      confirmLabel: "确认恢复",
      busyLabel: "恢复中...",
      minimumBusyMs: 3000,
      onConfirm: async () => {
        const currentConfig = useProductMarketStore.getState().exportConfig();
        const restoreSourceScope = getTemplateSourceScope(configScope);
        const restoreTemplateId = getProductMarketTemplateId(restoreSourceScope);
        if (templateLifecycleRole === "runtime") {
          if (!effectiveSiteId) throw new Error("恢复失败：缺少当前客户端计划标识。");
          const preferredIdentity = resolveRuntimeInstanceIdentity(configScope as "client" | "agency", effectiveSiteId);
          const existingRuntime = await resolveExistingRuntimeInstance(preferredIdentity);
          if (!existingRuntime) throw new Error("恢复失败：当前计划尚未由开通流程建立服务端实例。");
          const identity = existingRuntime.identity;
          const restoredInstance = await restoreTemplate(identity.instanceId, {
            target,
            createBackup: true,
            operator: "product-market-restore",
          });
          const serverSnapshot = extractRemoteInstanceConfig(restoredInstance)
            || await readRemoteInstanceConfig(identity.instanceId);
          if (!serverSnapshot) {
            throw new Error("恢复失败：服务端实例已处理，但回读不到有效配置。");
          }
          const restoredConfig = withNormalizedSidebarStyle(serverSnapshot, serverSnapshot);
          commitConfigSnapshot(restoredConfig, {
            syncCustomizationFlags: shouldSyncCustomizationFlagsWithSnapshot,
            syncMaterialAssets: true,
            runtimeSnapshotOnly: true,
            skipRemoteSnapshot: true,
          });
          toast.success(getRestoreSuccessMessage(target, sourceLabel));
          return;
        }
        const remotePublishedSource = templateLifecycleRole === "source"
          ? restoreSourceScope === "client_source"
            ? await readRemoteProductMarketFactoryDefaultConfig(restoreTemplateId)
            : await readRemoteTemplateConfig(restoreTemplateId)
          : null;
        const baseRestoreConfig = remotePublishedSource || resolveCurrentScopeRestoreBaseline();
        const restoreConfigWithSidebar = withNormalizedSidebarStyle(
          restoreConfigByTarget(currentConfig, baseRestoreConfig, target, {
            preserveRuntimeContent: shouldPersistRuntimeSnapshotOnly,
          }),
          baseRestoreConfig
        );

        if (templateLifecycleRole === "source") {
          if (!defaultDialogConfigSnapshotRef.current) {
            defaultDialogConfigSnapshotRef.current = cloneExportableConfigSnapshot(currentConfig);
          }
          if (!defaultDialogDraftBaselineRef.current) {
            defaultDialogDraftBaselineRef.current = cloneExportableConfigSnapshot(currentConfig);
            defaultDialogProductsBaselineSignatureRef.current = tempProductsSignature;
            defaultDialogBaselineReadyRef.current = true;
            setDefaultDialogBaselineReady(true);
          }
          applyConfigSnapshotToState(restoreConfigWithSidebar, {
            syncCustomizationFlags: shouldSyncCustomizationFlagsWithSnapshot,
            syncMaterialAssets: true,
          });
          loadConfigIntoSettingsDraft(restoreConfigWithSidebar);
          if (!showDefaultDialog && !templateSettingsSubview) {
            setSettingsTab(target === "all" ? "modules" : target);
            setShowDefaultDialog(true);
          }
        } else {
          commitConfigSnapshot(restoreConfigWithSidebar, {
            syncCustomizationFlags: shouldSyncCustomizationFlagsWithSnapshot,
            syncMaterialAssets: true,
            runtimeSnapshotOnly: true,
            skipRemoteSnapshot: true,
          });
          await persistAndVerifyScopedSnapshot(configScope, effectiveSiteId, restoreConfigWithSidebar);
        }

        toast.success(getRestoreSuccessMessage(target, sourceLabel));
      },
    });
  }, [
    commitConfigSnapshot,
    configScope,
    effectiveSiteId,
    getRestoreButtonLabel,
    getRestoreSuccessMessage,
    getRestoreTargetSummaryLabel,
    getTemplateSourceLabel,
    isHQClientStyleSettings,
    isRuntimePlanPage,
    loadConfigIntoSettingsDraft,
    openSourceActionDialog,
    applyConfigSnapshotToState,
    restoreConfigByTarget,
    resolveCurrentScopeRestoreBaseline,
    shouldPersistRuntimeSnapshotOnly,
    shouldSyncCustomizationFlagsWithSnapshot,
    shouldWriteSharedClientStyle,
    showDefaultDialog,
    templateSettingsSubview,
    templateLifecycleRole,
    tempProductsSignature,
    withNormalizedSidebarStyle,
  ]);

  const activeTemplateHeaderActionOrder = activeSettingsTab === "modules"
    ? normalizeTemplateHeaderActionOrder(tempModuleActionOrder, DEFAULT_MODULE_HEADER_ACTION_ORDER)
    : activeSettingsTab === "layout"
      ? normalizeTemplateHeaderActionOrder(tempLayoutActionOrder, DEFAULT_LAYOUT_HEADER_ACTION_ORDER)
      : normalizeTemplateHeaderActionOrder(tempCustomerServiceActionOrder, DEFAULT_SERVICE_HEADER_ACTION_ORDER);
  const draggableTemplateHeaderActionOrder = activeTemplateHeaderActionOrder.filter((id) => id !== "close");
  const keepTemplateSettings = () => {
    saveDefaults();
  };

  const renderTemplateHeaderAction = (id: TemplateHeaderActionId) => {
    const commonClassName = "template-config-action-button h-8 min-w-0 whitespace-nowrap px-3 text-xs";
    const commonStyle = {
      backgroundColor: tempLayout.defaultDialogButtonColor || "#2FB977",
      color: tempLayout.defaultDialogButtonTextColor || "#F8FFFC",
    };

    if (id === "restore") {
      const restoreTooltip = getRestoreButtonTooltip(currentSettingsRestoreTarget);
      return (
        <Button
          type="button"
          size="sm"
          title={restoreTooltip}
          aria-label={`${getRestoreButtonLabel(currentSettingsRestoreTarget)}：${restoreTooltip}`}
          onClick={() => handleRestoreInitial(currentSettingsRestoreTarget)}
          className={commonClassName}
          style={commonStyle}
        >
          {currentSettingsRestoreTarget === "layout" ? "恢复版面" : getRestoreButtonLabel(currentSettingsRestoreTarget)}
        </Button>
      );
    }
    if (id === "theme-toggle") {
      const themeToggleKey = selectedPresetThemeKey ? PRESET_THEME_KEY_MAP[selectedPresetThemeKey] : resolvedTempThemeKey;
      const normalizedThemeToggleKey = (
        themeToggleKey in PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP ? themeToggleKey : "rose"
      ) as ThemePresetKey;
      const themeToggleStyle = PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP[normalizedThemeToggleKey].expandedThemeStatus;
      return (
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-shared-theme-palette-key={normalizedThemeToggleKey}
          data-shared-theme-palette-policy="immutable-factory-preview"
          data-shared-theme-palette-appearance="expanded-theme-toggle"
          aria-expanded={!presetThemeCollapsed}
          onClick={() => setPresetThemeCollapsed((current) => !current)}
          className={`${commonClassName} template-config-theme-toggle rounded-r-none`}
          style={{
            backgroundColor: themeToggleStyle.background,
            color: themeToggleStyle.text,
            borderColor: themeToggleStyle.border,
          }}
        >
          {presetThemeCollapsed ? "∨已收起主题" : "∧已展开主题"}
        </Button>
      );
    }
    if (id === "theme-status") {
      const themeStatusKey = selectedPresetThemeKey ? PRESET_THEME_KEY_MAP[selectedPresetThemeKey] : resolvedTempThemeKey;
      const normalizedThemeStatusKey = (
        themeStatusKey in PRODUCT_MARKET_THEME_SWITCH_STYLES ? themeStatusKey : "rose"
      ) as ThemePresetKey;
      // The compact layout-status pill is a view of the same factory palette
      // as Operations → Theme & Colors. It must not inherit the independently
      // configurable dialog action colour, otherwise the selected palette can
      // look different in the two entry points.
      const themeStatusStyle = PRODUCT_MARKET_THEME_SWITCH_STYLES[normalizedThemeStatusKey];
      return (
        <span
          data-layout-theme-status
          data-shared-theme-palette-key={normalizedThemeStatusKey}
          data-shared-theme-palette-policy="immutable-factory-preview"
          data-shared-theme-palette-appearance="operations-theme-switch"
          className="template-config-action-status template-config-theme-status -ml-2 inline-flex h-8 items-center rounded-l-none border px-3 text-xs font-semibold"
          style={{
            "--tradepro-product-market-theme-switch-bg": themeStatusStyle.backgroundColor,
            "--tradepro-product-market-theme-switch-text": themeStatusStyle.color,
            "--tradepro-product-market-theme-switch-border": themeStatusStyle.borderColor,
            backgroundColor: themeStatusStyle.backgroundColor,
            color: themeStatusStyle.color,
            borderColor: themeStatusStyle.borderColor,
          }}
        >
          {selectedPresetThemeLabel || currentThemeDisplayName || "玫红天青"}
        </span>
      );
    }
    if (id === "collapse") {
      const serviceStatusKey = selectedPresetThemeKey ? PRESET_THEME_KEY_MAP[selectedPresetThemeKey] : resolvedTempThemeKey;
      const normalizedServiceStatusKey = (
        serviceStatusKey in PRODUCT_MARKET_THEME_SWITCH_STYLES ? serviceStatusKey : "rose"
      ) as ThemePresetKey;
      const serviceStatusStyle = PRODUCT_MARKET_THEME_SWITCH_STYLES[normalizedServiceStatusKey];
      return (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setServicePanelCollapsed((current) => !current)}
            className={`${commonClassName} template-config-service-toggle rounded-r-none`}
            style={{ ...commonStyle, borderColor: withAlpha(defaultDialogHeaderTextColorResolved, 0.32) }}
          >
            {servicePanelCollapsed ? "∨已收起客音" : "∧已展开客音"}
          </Button>
          <span
            data-service-theme-status
            data-shared-theme-palette-key={normalizedServiceStatusKey}
            data-shared-theme-palette-appearance="operations-theme-switch"
            className="template-config-service-status -ml-2 inline-flex h-8 items-center rounded-l-none border px-3 text-[10px] font-semibold leading-tight"
            style={{
              "--tradepro-product-market-theme-switch-bg": serviceStatusStyle.backgroundColor,
              "--tradepro-product-market-theme-switch-text": serviceStatusStyle.color,
              "--tradepro-product-market-theme-switch-border": serviceStatusStyle.borderColor,
              borderColor: serviceStatusStyle.borderColor,
              backgroundColor: serviceStatusStyle.backgroundColor,
              color: serviceStatusStyle.color,
            }}
            title="开关客音状态"
          >
            客服：{csEnabled ? "开" : "关"} · 音效：{soundEnabled ? "开" : "关"} · 音量：{Math.round(soundVolume * 100)}% · 朗音：{csVoiceEnabled ? "开" : "关"}
          </span>
        </>
      );
    }
    if (id === "module-toggle") {
      return (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setExpandedModulePaths(areAllModuleChildrenExpanded ? [] : expandableModulePaths)}
          className={commonClassName}
          style={{ ...commonStyle, borderColor: withAlpha(defaultDialogHeaderTextColorResolved, 0.32) }}
        >
          {areAllModuleChildrenExpanded ? "收起二级栏目" : "展开二级栏目"}
        </Button>
      );
    }
    if (id === "module-table-toggle") {
      return (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setModuleTableHeaderCollapsed((current) => !current)}
          className={commonClassName}
          style={{ ...commonStyle, borderColor: withAlpha(defaultDialogHeaderTextColorResolved, 0.28) }}
        >
          {moduleTableHeaderCollapsed ? "∨已收起表头" : "∧已展开表头"}
        </Button>
      );
    }
    if (id === "save") {
      return <Button type="button" size="sm" onClick={keepTemplateSettings} className={commonClassName} style={commonStyle}>保存设置</Button>;
    }
    return (
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={() => closeDefaultDialog()}
        className="template-config-action-close h-8 w-8 shrink-0"
        title="关闭窗口"
        aria-label="关闭窗口"
        data-dialog-close
        data-development-standard-close
        data-content-plugin-control="close"
        data-shared-window-close="true"
        data-shared-window-title-action="close"
        style={{ color: tempLayout.defaultDialogButtonTextColor || "#F8FFFC" }}
      >
        <X className="h-4 w-4" />
      </Button>
    );
  };

  // Apply card color changes directly to products (for quick edit panel)
  const applyThemeCardColors = (status: "active" | "inactive" | "hidden", changes: Partial<{ bg: string; border: string; font: string; button: string; nameFont?: string }>) => {
    const statusKey = status === "active" ? "cardActive" : status === "hidden" ? "cardHidden" : "cardInactive";
    const themeTargetKey = extractBaseThemeKey(tempTheme !== "custom" ? tempTheme : activeTheme);
    const nextColors = { ...tempThemeData[statusKey], ...changes };
    // Status colours have one writable source. Update it before projecting the
    // same value to the existing status cards, so the left live preview and
    // Operations never need to infer a global setting from an arbitrary card.
    syncTempThemeOverride(
      status === "active"
        ? { cardActive: nextColors }
        : status === "inactive"
          ? { cardInactive: nextColors }
          : { cardHidden: nextColors },
      themeTargetKey
    );
    const customStylePatch: Partial<ProductCustomStyle> = {
      ...(changes.bg !== undefined ? { bgColor: changes.bg } : {}),
      ...(changes.border !== undefined ? { borderColor: changes.border } : {}),
      ...(changes.font !== undefined ? { fontColor: changes.font } : {}),
      ...(changes.button !== undefined ? { buttonColor: changes.button } : {}),
      ...(changes.nameFont !== undefined ? { nameFontColor: changes.nameFont } : {}),
    };
    setTempProducts((current) =>
      current.map((item) =>
        item.status === status
          ? {
              ...item,
              customStyle: {
                ...item.customStyle,
                ...customStylePatch,
              },
            }
          : item
      )
    );
    // Update all products with this status
    products.forEach((p) => {
      if (p.status === status) {
        setProductCustomStyle(p.path, customStylePatch);
      }
    });
  };

  // Cleanup preview timeout
  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    };
  }, []);

  const draggedProduct = activeDragId ? effectiveProducts.find((p) => p.path === activeDragId) : null;

  if (isHQMaterialAssetsPage) {
    return (
      <FactoryPage pageId={pageFactoryContract.pageId} template={pageFactoryContract.template} sourceScope={pageFactoryContract.sourceScope} autoRegions>
   <div className="space-y-6 p-5">
        <input
          ref={materialAssetsUploadRef}
          type="file"
          accept={materialAssetsUploadAccept}
          className="hidden"
          onChange={handleMaterialAssetUpload}
        />
        <input
          ref={materialAssetReplaceUploadRef}
          type="file"
          accept={getMediaUploadAccept([materialAssetReplaceTarget?.kind || "image"])}
          className="hidden"
          onChange={handleReplaceStoredMaterialAsset}
        />
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-950">
              <ImageIcon className="h-6 w-6 text-cyan-600" />
              素材资源
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              软件端图片、视频和客服媒体统一保存在本地私有素材库，实际路径见素材条目或“源码与部署中心”。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadMaterialAssets()}
              disabled={materialAssetsLoading}
              className="bg-white text-slate-700 hover:bg-slate-100"
            >
              刷新
            </Button>
            <Button
              type="button"
              onClick={() => materialAssetsUploadRef.current?.click()}
              disabled={materialAssetsUploading}
              className="bg-cyan-600 text-white hover:bg-cyan-500"
            >
              <Upload className="mr-1 h-4 w-4" />
              {materialAssetsUploading ? "上传中" : "上传素材"}
            </Button>
          </div>
        </div>

        <Card className="bg-white">
          <CardContent className="p-4">
            {materialAssetsLoading ? (
       <div className="px-4 py-10 text-center text-sm text-slate-500">
                正在读取素材资源...
              </div>
            ) : materialAssets.length === 0 ? (
       <div className="px-4 py-10 text-center text-sm text-slate-500">
                暂无素材，请先上传图片或视频到本地私有素材库；实际路径会显示在素材条目中。
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {orderedMaterialAssets.map((asset) => (
                  <div key={asset.assetId} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex gap-3">
           <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden">
                        {asset.kind === "video" ? (
                          <video
                            src={asset.publicUrl}
                            className="h-full w-full object-cover"
                            preload="metadata"
                            muted
                            playsInline
                          />
                        ) : (
                          <img src={asset.publicUrl} alt={asset.fileName} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-semibold text-slate-900">{formatMaterialDisplayFileName(asset.fileName)}</div>
                          <Badge className="bg-slate-200 text-slate-700">{asset.kind === "video" ? "视频" : "图片"}</Badge>
                          <Badge title={`历史累计应用 ${asset.applyCount} 次；当前有 ${asset.usageCount} 处配置正在使用`} className={asset.usageCount > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}>
                            累计{asset.applyCount}次
                          </Badge>
                        </div>
                        <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                          <div>大小：{formatMaterialAssetSize(asset.sizeBytes)}</div>
                          <div>时间：{formatMaterialAssetTime(asset.createdAt)}</div>
                          <div className="truncate">路径：{asset.storagePath}</div>
                        </div>
                      </div>
                    </div>
                    {asset.usageLabels.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {asset.usageLabels.slice(0, 5).map((label) => (
                          <Badge key={`${asset.assetId}-${label}`} className="bg-white text-[10px] text-slate-600">
                            {sanitizeDisplayText(label, "应用位置")}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] text-emerald-600">当前无应用，可删除</div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 bg-white text-xs text-slate-700"
                        onClick={() => {
                          copyTextWithFallback(asset.storagePath);
                          toast.success("素材路径已复制");
                        }}
                      >
                        复制路径
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 bg-white text-xs text-slate-700"
                        onClick={() => {
                          copyTextWithFallback(asset.assetId);
                          toast.success("素材 ID 已复制");
                        }}
                      >
                        复制ID
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 bg-white text-xs text-slate-700"
                        disabled={asset.canReplace === false || materialAssetsBusyId === asset.assetId}
                        onClick={() => beginReplaceStoredMaterialAsset(asset)}
                        title="保留素材 ID 与全部引用，直接替换存储中的原始文件"
                      >
                        {materialAssetsBusyId === asset.assetId ? "替换中" : "替换"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 bg-white text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                        disabled={!asset.canDelete || materialAssetsBusyId === asset.assetId}
                        title={asset.canDelete
                          ? "当前没有配置引用，可以删除"
                          : `仍被 ${asset.usageLabels.join("、") || `${asset.usageCount} 处配置`} 引用`}
                        onClick={() => void handleDeleteMaterialAsset(asset)}
                      >
                        <Trash className="mr-1 h-3.5 w-3.5" />
                        {materialAssetsBusyId === asset.assetId
                          ? "删除中"
                          : !asset.canDelete
                            ? "引用中"
                            : "删除"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
       </Card>
      </div>
      </FactoryPage>
    );
  }

  const activeThemeSwitchKey = PRODUCT_MARKET_THEME_SWITCH_STYLES[activeTheme]
    ? activeTheme
    : "rose";
  const activeThemeSwitchStyle = PRODUCT_MARKET_THEME_SWITCH_STYLES[activeThemeSwitchKey];
  const inlineTitleThemeControls = showSharedStyleControls && shouldMergeProductMarketContext ? (
    <section
      data-product-market-theme-section
      data-responsive-shared-surface="title-2"
      data-responsive-shared-surface-plugin="large-band-density"
      data-shared-theme-palette-source="operations-and-layout"
      data-shared-theme-palette-key={activeThemeSwitchKey}
      data-shared-theme-palette-policy="immutable-factory-preview"
      data-shared-theme-palette-appearance="title-2-dual-tone"
      data-shared-layout-section="title"
      data-development-standard-frame-region="title"
      data-development-standard-frame-label="标题 2"
      aria-label="主题与版色"
    >
      <div
        data-product-market-inline-style
        data-responsive-capacity-row="theme-actions"
        data-responsive-capacity-flow="wrapped"
        className="flex w-full flex-wrap items-center justify-start gap-2"
      >
        <span
          data-product-market-theme-switch-label
          data-product-market-title-level="2"
          data-product-market-theme-key={activeThemeSwitchKey}
          className="text-xs font-bold"
          style={{ "--tradepro-product-market-theme-switch-text": activeThemeSwitchStyle.panelTextColor } as CSSProperties}
        >
          主题与版色：
        </span>
        {livePresetThemes.filter((preset) => PRODUCT_MARKET_THEME_SWITCH_STYLES[preset.key]).map((preset) => {
          const ThemeIcon = BUILTIN_THEME_ICONS[preset.key] || Palette;
          const isActive = activeTheme === preset.key;
          const fixedStyle = PRODUCT_MARKET_THEME_SWITCH_STYLES[preset.key];
          const presetOptionKey = Object.entries(PRESET_THEME_KEY_MAP).find(([, themeKey]) => themeKey === preset.key)?.[0] as PresetThemeOptionKey | undefined;
          const presetLabel = presetOptionKey ? presetThemeLabels[presetOptionKey] : fixedStyle.label;
          return (
          <button
            key={preset.key}
            type="button"
            data-responsive-shared-action="theme"
            data-responsive-shared-action-plugin="large-action-density"
            data-product-market-theme-key={preset.key}
            data-shared-theme-palette-key={preset.key}
            data-shared-theme-palette-policy="immutable-factory-preview"
            data-shared-theme-palette-appearance="operations-theme-switch"
            data-shared-selection-control="true"
            data-selected={isActive}
            aria-pressed={isActive}
            onClick={() => handleApplyLiveTheme(preset.key)}
              onMouseEnter={() => handleThemeHoverEnter(preset.key)}
              onMouseLeave={handleThemeHoverLeave}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200"
              style={{
                "--tradepro-product-market-theme-switch-bg": fixedStyle.backgroundColor,
                "--tradepro-product-market-theme-switch-text": fixedStyle.color,
                "--tradepro-product-market-theme-switch-border": fixedStyle.borderColor,
                "--tradepro-product-market-theme-switch-panel": fixedStyle.panelColor,
                "--tradepro-product-market-theme-switch-panel-text": fixedStyle.panelTextColor,
                backgroundColor: fixedStyle.backgroundColor,
                color: fixedStyle.color,
                border: `1px solid ${fixedStyle.borderColor}`,
                boxShadow: isActive
                  ? `0 0 0 2px ${fixedStyle.actionColor}66, 0 6px 14px ${fixedStyle.actionColor}55`
                  : `0 3px 8px ${fixedStyle.actionColor}33`,
              } as CSSProperties}
              title={`${presetLabel}：${sanitizeDisplayText(preset.description, "主题说明")}`}
            >
              <ThemeIcon className="h-3.5 w-3.5" />
              {presetLabel}
            </button>
          );
        })}
      </div>
    </section>
  ) : null;

  return (
      <div
        ref={productMarketRootRef}
        data-product-market-layout
        data-product-market-catalog-scope={catalogScope}
        data-product-market-workspace-scope={configScope}
        data-product-market-engine="shared"
        data-product-market-operations-catalog-active={operationsCatalogActive ? "true" : "false"}
        data-product-market-service-workspace-active={serviceWorkspaceActive ? "true" : "false"}
        data-product-market-builtin-theme-override-count={Object.keys(builtinThemeOverrides).length}
        data-product-market-avatar-preview-plan-mode={serviceWorkspaceActive ? "full-service" : operationsCatalogActive ? "visible-groups" : "inactive"}
        data-product-market-avatar-preview-plan-size={avatarPreviewLoadPlan.length}
        data-product-market-expert-first-paint-fallback={PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT.expertFirstPaintFallback}
        data-product-market-hydrated={remoteSnapshotHydrated ? "true" : "false"}
        data-product-market-hydration-interaction={remoteSnapshotHydrated ? "ready" : "blocked"}
        data-product-market-hydration-timeout-ms={PRODUCT_MARKET_REMOTE_HYDRATION_TIMEOUT_MS}
        aria-busy={!remoteSnapshotHydrated}
        data-visual-card-layout-version={visualCardLayout?.schemaVersion}
        data-visual-card-layout-node-count={visualCardLayout?.nodes.length}
        className="flex min-h-0 flex-1 flex-col p-0 transition-colors duration-500"
        style={{ color: contentSurfaceTextColor, pointerEvents: remoteSnapshotHydrated ? undefined : "none" }}
      >
      {!isDevelopmentGuide && postPaintApplicationsReady ? <Suspense fallback={null}><VisualPageEditorTopbarLauncher open={visualPageEditorOpen} onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setVisualPageEditorInitialApplicationScope("current-page");
          setVisualPageEditorApplicationScopeLock(undefined);
        }
        setVisualPageEditorOpen(nextOpen);
      }} pathname={location.pathname} locked={productMarketWriteLocked} /></Suspense> : null}
      {!isDevelopmentGuide && visualPageEditorOpen ? <Suspense fallback={<div data-visual-card-editor-starting className="fixed right-3 top-14 z-[120] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-lg">正在启动右侧可视化沙盘…</div>}><VisualPageEditorDock
        open
        onOpenChange={setVisualPageEditorOpen}
        pathname={location.pathname}
        search={location.search}
        readOnly={!isGlobalThemeSource}
        sourceLabel={sourceWorkspacePathPrefix}
        initialApplicationScope={visualPageEditorInitialApplicationScope}
        applicationScopeLock={visualPageEditorApplicationScopeLock}
      /></Suspense> : null}
      {!templateSettingsSubview ? <FactoryPage
        pageId={pageFactoryContract.pageId}
        template={pageFactoryContract.template}
        sourceScope={pageFactoryContract.sourceScope}
        scrollContract="table-inner-60"
        asChild
        frameOwner="existing-workspace"
      ><ProductMarketWorkspace aria-label="产品市场工作区">
      {isDevelopmentGuide ? (postPaintApplicationsReady ? (
        <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm opacity-70" role="status">开发规范加载中…</div>}>
          <ProductMarketDevelopmentGuidePanel workspaceLabel={sourceWorkspacePathPrefix} pathname={location.pathname} search={location.search} />
        </Suspense>
      ) : <div data-product-market-development-post-paint aria-busy="true" className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm opacity-70"><strong>{sourceWorkspacePathPrefix} → 开发规范</strong><span>优先绘制共享框架，检查工具将在首帧后加载。</span></div>) : isPlatformBlueprint ? (postPaintApplicationsReady ? (
        <div data-product-market-maturity-badge-source="blueprint-only">
          <Suspense fallback={<div data-factory-platform-blueprint-post-paint aria-busy="true" className="flex min-h-[40vh] items-center justify-center text-sm opacity-70">平台蓝图正在后台准备…</div>}>
            <FactoryPlatformBlueprint
              workspaceLabel={sourceWorkspacePathPrefix}
              sourceScope={pageFactoryContract.sourceScope}
              search={location.search}
              products={operationDraftProducts}
              categoryStyles={tempModuleCategoryStyles}
              onCategoryPlanningVisibilityChange={handleSetBlueprintCategoryPlanningVisibility}
              onCategoryStatusChange={handleSetBlueprintCategoryStatus}
              onApplicationStatusChange={handleSetStatus}
            />
          </Suspense>
        </div>
      ) : <div data-factory-platform-blueprint-post-paint aria-busy="true" className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm opacity-70"><strong>{sourceWorkspacePathPrefix} → 平台蓝图</strong><span>优先绘制共享框架，蓝图明细将在首帧后加载。</span></div>) : <>
      {/* Header */}
      <div
        data-product-market-header
        data-responsive-shared-surface="title-1"
        data-responsive-shared-surface-plugin="large-band-density"
        data-page-title={shouldUseSourceTitlePath ? "product-market" : undefined}
        data-shared-layout-section="title"
        data-development-standard-frame-region="title"
        data-development-standard-frame-label="标题"
        className="flex flex-col gap-3"
      >
        <div data-product-market-title-main data-responsive-live-title-layout data-responsive-capacity-row className="flex w-full items-center justify-between gap-4">
        <div data-page-title-content className="min-w-0">
          {shouldUseSourceTitlePath ? (
            <>
              <h1 data-product-market-title-primary data-product-market-title-level="1" data-responsive-live-title-heading className="flex flex-wrap items-center gap-2 font-bold">
                <ProductMarketTitleIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
                <span>{productMarketPathPrefix} → 运营市场</span>
              </h1>
              <p data-shared-title-description className="mt-1 text-xs font-medium opacity-75">
                {sourceOperationsDescription}
              </p>
            </>
          ) : (
            <>
              <h1 data-responsive-live-title-heading className="flex items-center gap-2 text-2xl font-bold" style={{ color: contentSurfaceTextColor }}>
                <ProductMarketTitleIcon className="h-6 w-6" style={{ color: contentSurfaceTextColor }} />
                {headerTitle}
              </h1>
              <p data-shared-title-description className="mt-1 text-sm" style={{ color: contentSurfaceMutedTextColor }}>
                {headerDescription}
              </p>
            </>
          )}
          {showSharedStyleControls && !shouldMergeProductMarketContext ? (
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                站点版本：{activeSite ? `#${formatDisplayOrdinal(siteSequenceMap.get(activeSite.id) || 1)} ${resolveSiteDisplayName(activeSite, activeSite.planCode || activeSite.id)}` : "未绑定站点"}
              </Badge>
            </div>
          ) : null}
        </div>
        <div data-page-title-actions data-responsive-title-action-rail="shared" data-shared-function-actions className="flex shrink-0 flex-wrap justify-end gap-2">
          {requiresRuntimePlanSelection ? (
            <Button
              variant="outline"
              size="sm"
              data-responsive-shared-action="title"
              data-responsive-shared-action-plugin="large-action-density"
              onClick={() => navigate(runtimePlanSetupPath)}
              className="tradepro-shared-function-action"
            >
              <FolderPlus className="mr-1 h-4 w-4" />
              创建或选择计划
            </Button>
          ) : null}
          {(configScope === "client" || configScope === "agency") && effectiveSiteId && !isCentralStyleSettingsPage ? (
            <Button
              variant="outline"
              size="sm"
              data-responsive-shared-action="title"
              data-responsive-shared-action-plugin="large-action-density"
              onClick={() => handleSyncFromSource("all")}
              className="tradepro-shared-function-action"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              手动同步模板最新版
            </Button>
          ) : null}
          {(configScope === "client_source" || configScope === "agency_source") ? (
            <Button
              variant="outline"
              size="sm"
              data-responsive-shared-action="title"
              data-responsive-shared-action-plugin="large-action-density"
              onClick={saveDefaults}
              className="tradepro-shared-function-action"
            >
              <Save className="w-4 h-4 mr-1" />
              保存草稿
            </Button>
          ) : null}
          {(configScope === "client_source" || configScope === "agency_source") ? (
            <Button
              variant="outline"
              size="sm"
              data-responsive-shared-action="title"
              data-responsive-shared-action-plugin="large-action-density"
              onClick={handlePublishTemplateSource}
              className="tradepro-shared-function-action"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              发布新版
            </Button>
          ) : null}
          {showRestoreActions ? (
            <>
              <TooltipProvider delayDuration={180}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      data-responsive-shared-action="title"
                      data-responsive-shared-action-plugin="large-action-density"
                      aria-label={`${getRestoreButtonLabel("all")}：${getRestoreButtonTooltip("all")}`}
                      onClick={() => handleRestoreInitial("all")}
                      className="tradepro-shared-function-action"
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      {getRestoreButtonLabel("all")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent data-responsive-shared-tooltip="true" side="bottom" align="end" className="template-config-restore-tooltip">
                    {getRestoreButtonTooltip("all")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                variant="outline"
                size="sm"
                data-responsive-shared-action="title"
                data-responsive-shared-action-plugin="large-action-density"
                onClick={keepTemplateSettings}
                className="tradepro-shared-function-action"
              >
                保存设置
              </Button>
            </>
          ) : null}
        </div>
        </div>
      </div>
      {inlineTitleThemeControls}

      {requiresRuntimePlanSelection ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-amber-950">请先创建或选择一个独立计划</div>
              <p className="mt-1 text-sm text-amber-800">
                模板同步按计划执行。选择计划后，页面右上角会显示“手动同步模板最新版”，并只更新该计划。
              </p>
            </div>
            <Button type="button" size="sm" onClick={() => navigate(runtimePlanSetupPath)} className="shrink-0 bg-amber-700 hover:bg-amber-800">
              <FolderPlus className="mr-1 h-4 w-4" />
              前往计划管理
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {showAgencyInheritanceCard ? (
        <Card
          className="transition-colors duration-500"
          style={{
            borderColor: themePanelSurfaceBorderColor,
            background: `linear-gradient(90deg, ${effectiveLayoutStyle.themePanelBgColor}, ${withAlpha(effectiveLayoutStyle.themePanelButtonColor, 0.2)}, ${withAlpha(effectiveLayoutStyle.headerBgColor, 0.84)})`,
          }}
        >
          <CardContent className="px-4 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: themePanelSurfaceTextColor }}>
                  <Palette className="h-4 w-4" style={{ color: themePanelActionTextColor }} />
                  代理端样式继承中
                </div>
                <p className="max-w-3xl text-sm leading-6" style={{ color: themePanelSurfaceMutedTextColor }}>
                  代理端产品市场、客户端壳与默认网站风格，当前统一读取总部“客户端设置”中的网站风格方案。代理端保留查看入口，真正的编辑、主题调整与恢复操作统一在总部维护。
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border px-3 py-2" style={{ borderColor: themePanelSurfaceBorderColor, backgroundColor: withAlpha(effectiveLayoutStyle.themePanelButtonColor, 0.18) }}>
                  <p className="text-[11px]" style={{ color: themePanelSurfaceMutedTextColor }}>当前主题</p>
                  <p className="mt-1 text-sm font-medium" style={{ color: themePanelSurfaceTextColor }}>
                    {getThemeDisplayName(activeTheme, allThemes.find((theme) => theme.key === activeTheme)?.name)}
                  </p>
                </div>
                <div className="rounded-lg border px-3 py-2" style={{ borderColor: themePanelSurfaceBorderColor, backgroundColor: withAlpha(effectiveLayoutStyle.themePanelButtonColor, 0.18) }}>
                  <p className="text-[11px]" style={{ color: themePanelSurfaceMutedTextColor }}>全局字体</p>
                  <p className="mt-1 text-sm font-medium" style={{ color: themePanelSurfaceTextColor }}>
                    {FONT_OPTIONS.find((item) => item.value === globalFontFamily)?.label || sanitizeDisplayText(globalFontFamily, "系统默认字体")}
                  </p>
                  <p className="mt-1 text-[11px]" style={{ color: themePanelSurfaceMutedTextColor }}>
                    {FONT_WEIGHT_OPTIONS.find((item) => item.value === globalFontWeight)?.label || "中体"} / {LETTER_SPACING_OPTIONS.find((item) => item.value === globalLetterSpacing)?.label || "标准"}
                  </p>
                </div>
                <div className="rounded-lg border px-3 py-2" style={{ borderColor: themePanelSurfaceBorderColor, backgroundColor: withAlpha(effectiveLayoutStyle.themePanelButtonColor, 0.18) }}>
                  <p className="text-[11px]" style={{ color: themePanelSurfaceMutedTextColor }}>管理方式</p>
                  <p className="mt-1 text-sm font-medium" style={{ color: themePanelSurfaceTextColor }}>总部统一维护</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showSharedStyleControls && !shouldMergeProductMarketContext ? (
        <Card
          data-product-market-theme-section
          data-product-market-style
          className="transition-colors duration-500"
          style={{ backgroundColor: effectiveLayoutStyle.themePanelBgColor, color: themePanelSurfaceTextColor, borderColor: themePanelSurfaceBorderColor }}
        >
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap gap-2">
              {livePresetThemes.map((preset) => {
                  const ThemeIcon = BUILTIN_THEME_ICONS[preset.key] || Palette;
                  const isActive = activeTheme === preset.key;
                  const isPreviewing = previewTheme === preset.key;
                  const presetOptionKey = Object.entries(PRESET_THEME_KEY_MAP).find(([, builtinKey]) => builtinKey === preset.key)?.[0] as PresetThemeOptionKey | undefined;
                  const presetLabelColor = presetOptionKey
                    ? activePresetThemeTextColors[presetOptionKey]
                    : (isActive || isPreviewing ? "#ffffff" : effectiveLayoutStyle.themePanelTextColor);
                  const presetBgColor = presetOptionKey
                    ? activePresetThemeBgColors[presetOptionKey]
                    : preset.layout.themePanelButtonColor;
                  const presetLabel = presetOptionKey
                    ? activePresetThemeLabels[presetOptionKey]
                    : getThemeDisplayName(preset.key, preset.name);
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      data-responsive-shared-action="theme"
                      data-responsive-shared-action-plugin="large-action-density"
                      data-product-market-theme-key={preset.key}
                      data-shared-theme-palette-key={preset.key}
                      data-shared-theme-palette-policy="immutable-factory-preview"
                      data-shared-theme-palette-appearance="standalone-theme-switch"
                      data-shared-selection-control="true"
                      data-selected={isActive}
                      aria-pressed={isActive}
                      onClick={() => handleApplyLiveTheme(preset.key)}
                      onMouseEnter={() => handleThemeHoverEnter(preset.key)}
                      onMouseLeave={handleThemeHoverLeave}
                      className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200"
                      style={{
                        backgroundColor: presetBgColor,
                        color: presetLabelColor,
                        boxShadow: isActive
                          ? `0 10px 24px ${presetBgColor}55`
                          : isPreviewing
                            ? `0 8px 18px ${presetBgColor}33`
                            : `0 4px 14px ${withAlpha(presetBgColor, 0.22)}`,
                        border: `1px solid ${presetBgColor}`,
                      }}
                      title={`${presetLabel}：${sanitizeDisplayText(preset.description, "主题说明")}${!isActive ? " (悬停预览)" : ""}`}
                    >
                      <ThemeIcon className="w-3.5 h-3.5" />
                      {presetLabel}
                      {isPreviewing && !isActive ? (
                        <span
                          className="rounded px-1 text-[9px]"
                          style={{
                            backgroundColor: presetBgColor,
                            color: presetLabelColor,
                          }}
                        >
                          预览中
                        </span>
                      ) : null}
                    </button>
                  );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* 表内：批量表头与可滚动内容只共用这一层外壳。 */}
      <div
        data-product-market-table-shell="true"
        data-product-market-table-header-mode="expanded"
        data-development-standard-spacing-contract="title-2-table-header-content-8"
        data-development-standard-frame-region="table-shell"
        data-development-standard-frame-label={getLayoutFrameMarkerLabel("tableShell")}
        data-development-standard-marker-placement="frame-start"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
      {/* 与栏目配置共用同一结构：表头固定为表内直属区域，滚动容器只承接
          表头下方的栏目内容，因此滚动条从表头下缘开始。 */}
      <section
        data-shared-layout-section="header"
        data-product-market-table-header
        data-responsive-shared-surface="table-header"
        data-responsive-shared-surface-plugin="large-band-density"
        data-development-standard-frame-region="table-header"
        data-development-standard-frame-label="表头"
        aria-label="产品市场表头"
        className="border transition-colors duration-500"
      >
          <div className="px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                data-responsive-shared-action="table-header"
                data-responsive-shared-action-plugin="large-action-density"
                onClick={toggleSelectAll}
                className={`text-xs font-medium transition-colors ${
                  isAllSelected
                    ? "bg-blue-600 border-blue-500 text-white hover:bg-blue-700 hover:text-white"
                    : "border-slate-500 hover:bg-slate-700"
                }`}
              >
                {isAllSelected ? (
                  <CheckSquare className="w-4 h-4 mr-1" />
                ) : (
                  <Square className="w-4 h-4 mr-1" />
                )}
                  {isAllSelected ? "取消全选" : "全选"}
              </Button>
              <div className="flex items-center gap-1.5 text-sm transition-colors duration-500">
                <ListChecks className="w-4 h-4 opacity-70" />
                <span>
                  已选择{" "}
                  <span className="font-bold">{selectedPaths.length}</span> /{" "}
                  {operationDraftProducts.length} 项
                </span>
                {pendingOperationStatusCount > 0 ? (
                  <Badge className="ml-1 border-0 px-2 py-0.5 text-[10px]" style={getProductMarketStatusControlStyle(effectiveStatusCardColors.active)}>
                    待保存 {pendingOperationStatusCount} 项
                  </Badge>
                ) : null}
              </div>
            </div>
            <TooltipProvider delayDuration={120}>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        size="sm"
                        disabled={!hasActivatableSelection}
                        data-product-market-status-control="active"
                        data-product-market-batch-action="active"
                        data-product-market-batch-status-control
                        data-responsive-shared-action="table-header"
                        data-responsive-shared-action-plugin="large-action-density"
                        className="text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                        style={hasActivatableSelection ? getProductMarketStatusControlStyle(effectiveStatusCardColors.active) : undefined}
                        onClick={() => handleBatchAction("active")}
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        批量开通
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    data-responsive-shared-tooltip="true"
                    side="top"
                    style={{ backgroundColor: "#0f172a", borderColor: "rgba(148, 163, 184, 0.55)", color: "#f8fafc" }}
                  >
                    仅已交付能力可开通并在侧边栏使用；规划应用会被自动跳过。
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        size="sm"
                        disabled={!hasSelection}
                        data-product-market-status-control="inactive"
                        data-product-market-batch-action="inactive"
                        data-responsive-shared-action="table-header"
                        data-responsive-shared-action-plugin="large-action-density"
                        className="text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                        style={hasSelection ? getProductMarketStatusControlStyle(effectiveStatusCardColors.inactive) : undefined}
                        onClick={() => handleBatchAction("inactive")}
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        批量取消
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    data-responsive-shared-tooltip="true"
                    side="top"
                    style={{ backgroundColor: "#0f172a", borderColor: "rgba(148, 163, 184, 0.55)", color: "#f8fafc" }}
                  >
                    功能模块显示为灰色，暂不可点击使用。
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        size="sm"
                        disabled={!hasSelection}
                        data-product-market-status-control="hidden"
                        data-product-market-batch-action="hidden"
                        data-responsive-shared-action="table-header"
                        data-responsive-shared-action-plugin="large-action-density"
                        className="text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                        style={hasSelection ? getProductMarketStatusControlStyle(effectiveStatusCardColors.hidden) : undefined}
                        onClick={() => handleBatchAction("hidden")}
                      >
                        <EyeOff className="w-3.5 h-3.5 mr-1" />
                        批量隐藏
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    data-responsive-shared-tooltip="true"
                    side="top"
                    style={{ backgroundColor: "#0f172a", borderColor: "rgba(148, 163, 184, 0.55)", color: "#f8fafc" }}
                  >
                    功能模块从侧边栏中隐藏。
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
          </div>
      </section>

      <section
        data-shared-layout-section="list"
        data-shared-scroll-contract="table-inner-60"
        data-page-list
        data-page-list-scroll-owner
        data-product-market-scroll-list
        data-shared-scroll-content-start="after-table-header"
        data-development-standard-frame-region="content"
        data-development-standard-frame-label={getLayoutFrameMarkerLabel("content")}
        data-development-standard-marker-placement="content-start"
        data-product-market-operations-progressive={visibleOperationGroupCount < renderableOperationGroups.length ? "true" : "false"}
        data-product-market-operations-visible-groups={`${visibleOperationGroupCount}/${renderableOperationGroups.length}`}
        aria-busy={visibleOperationGroupCount === 0}
        aria-label="产品市场列表"
        className="product-market-scroll-list transition-colors duration-500"
      >
      {/* Product Grid with Drag & Drop + smooth animations */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={effectiveModuleDragIds}
            strategy={rectSortingStrategy}
          >
            <div data-page-list-grid role="list">
              {renderableOperationGroups.slice(0, visibleOperationGroupCount).map((group, groupIndex) => {
                const categoryOrder = categoryOrderIndexMap.get(group.key) ?? groupIndex + 1;
                const groupLabel = formatProductModuleCategoryLabel(
                  categoryOrder,
                  buildProductModuleCategoryLabel(group.label)
                );
                const categoryPaths = group.items.map((product) => product.path);
                const categoryStatus = resolveProductMarketCategoryStatus(group.items);
                const marketingGuide = getProductModuleCategoryMarketingGuide(group.key);
                return (
                  <div
                    key={group.key}
                    data-product-market-category-group
                    data-product-market-category-key={group.key}
                    data-shared-product-market-category-contract={PRODUCT_MARKET_SHARED_CATEGORY_CONTRACT.version}
                    data-shared-product-market-category-source="operations"
                    data-shared-product-market-category-key={group.key}
                    data-shared-product-market-category-order={String(categoryOrder).padStart(2, "0")}
                    data-shared-product-market-category-label={groupLabel}
                    data-shared-product-market-category-icon-policy={PRODUCT_MODULE_CATEGORIES.some((category) => category.key === group.key) ? "customer-service-select-expert" : "source-workspace-owned"}
                    data-shared-ownership-key={buildSharedCategoryOwnershipKey(group.key)}
                    data-shared-category-key={group.key}
                    data-shared-ownership-source="operations"
                    data-shared-ownership-category-target
                    data-page-list-item
                    data-shared-large-card-surface="true"
                    data-development-standard-frame-region="large-card"
                    data-development-standard-frame-label="大卡片"
                    data-development-standard-marker-placement="card-center"
                  >
                    <div
                      data-product-market-category-heading
                      data-shared-product-market-category-rail="operations"
                      data-shared-category-capsule="single"
                      className="font-normal"
                    >
                      <div data-product-market-category-status-cluster>
                      <TooltipProvider delayDuration={160}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span data-product-market-category-label data-product-market-category-marketing-guide={marketingGuide ? group.key : undefined} tabIndex={marketingGuide ? 0 : undefined} className={`flex min-w-0 items-center gap-1 tracking-wide${marketingGuide ? " cursor-help" : ""}`}>
                        <ProductMarketCategoryIdentityIcon
                          categoryKey={group.key}
                          categoryLabel={group.label}
                          categoryOrder={tempModuleCategoryOrder}
                          avatarPreviews={avatarPreviewMap}
                          avatarOverrides={csAvatarOverrides}
                          visible={moduleIconVisibility.category}
                          displaySize="category-16"
                        />
                        {group.key === "uncategorized" ? group.label : groupLabel}
                            </span>
                          </TooltipTrigger>
                          {marketingGuide ? <TooltipContent side="bottom" sideOffset={10} collisionPadding={16} align="start" className="!z-[2147483647] max-w-[min(25rem,calc(100vw-2rem))] border px-3 py-2 text-xs leading-5" style={{ backgroundColor: "var(--tradepro-panel-bg, #ffffff)", color: "var(--tradepro-panel-text, #0f172a)", borderColor: "color-mix(in srgb, var(--tradepro-panel-text, #0f172a) 30%, transparent)", pointerEvents: "none" }}><strong className="block text-sm">{marketingGuide.headline}</strong><span className="mt-1 block">痛点：{marketingGuide.pain}</span><span className="block">价值：{marketingGuide.value}</span><span className="block">行动：{marketingGuide.action}</span></TooltipContent> : null}
                        </Tooltip>
                      </TooltipProvider>
                      <div
                        data-product-market-category-status-actions
                        data-product-market-category-key={group.key}
                        data-product-market-category-status={categoryStatus.value}
                        data-product-market-category-status-mixed={categoryStatus.mixed ? "true" : "false"}
                        data-product-market-category-status-total={categoryStatus.total}
                      >
                        <ContentPluginStatusActions
                          value={categoryStatus.value}
                          onChange={(status) => handleCategoryBatchAction(groupLabel, categoryPaths, status)}
                        />
                      </div>
                      </div>
                    </div>
                    <div
                      data-product-market-card-grid
                    >
                      {group.items.map((product) => (
                        <SortableProductCard
                          key={product.path}
                          product={product}
                          isSelected={selectedPathSet.has(product.path)}
                          toggleSelect={toggleSelect}
                          setStatus={handleSetStatus}
                          getStatusBadge={getStatusBadge}
                          statusCardColors={effectiveStatusCardColors}
                          categoryKey={group.key}
                          showPrimaryIcon={moduleIconVisibility.primary}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
              {visibleOperationGroupCount < renderableOperationGroups.length ? (
                <div
                  role="status"
                  aria-live="polite"
                  data-product-market-operations-progressive-sentinel
                  className="product-module-progressive-loading gap-2"
                >
                  <span>已按需显示 {visibleOperationGroupCount}/{renderableOperationGroups.length} 组栏目</span>
                  <button
                    type="button"
                    onClick={() => setVisibleOperationGroupCount((current) => Math.min(renderableOperationGroups.length, current + 2))}
                    className="bg-transparent p-0 font-medium text-current underline underline-offset-2"
                  >
                    加载更多栏目
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibleOperationGroupCount(renderableOperationGroups.length)}
                    className="bg-transparent p-0 font-medium text-current underline underline-offset-2"
                  >
                    显示全部栏目
                  </button>
                </div>
              ) : null}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={{
            duration: 300,
            easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}>
            {draggedProduct ? (
              <Card
                className="shadow-2xl shadow-blue-500/40 scale-105 rotate-[2deg] opacity-90"
                style={{
                  backgroundColor: draggedProduct.customStyle?.bgColor || "rgba(239,68,68,0.1)",
                  width: "280px",
                }}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-blue-400" />
                    <span style={{ color: draggedProduct.customStyle?.fontColor || "#fff" }}>
                      {buildProductModuleLabel(
                        draggedProduct.path,
                        sanitizeDisplayText(draggedProduct.customLabel || draggedProduct.label, "未命名功能"),
                      )}
                    </span>
                  </CardTitle>
                </CardHeader>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      </section>
      </div>

      </>}
      </ProductMarketWorkspace></FactoryPage> : null}

      {/* Route pages use a normal section; only the Card/Content sandbox opens
          the same editor in a real draggable dialog. */}
      <ProductMarketSettingsHost
        isRoutePage={Boolean(templateSettingsSubview)}
        open={isDevelopmentGuide || isPlatformBlueprint ? false : showDefaultDialog}
        onOpenChange={(open) => {
          if (open) {
            setShowDefaultDialog(true);
            return;
          }
          // 二级栏目由 URL（tab=modules/layout/service）决定。内嵌工作区挂载时
          // Radix 可能发出关闭事件；这里绝不能把栏目误跳回“运营市场”。
          if (templateSettingsSubview) return;
          requestCloseDefaultDialog();
        }}
        locked={templateLayoutLocked}
        subview={productMarketSubview}
        routeClassName="product-market-settings-workspace flex h-full min-h-0 w-full flex-col gap-0 overflow-hidden p-0 text-[13px] text-white sm:text-sm"
        dialogClassName="product-market-settings-dialog flex h-[85vh] min-h-[420px] min-w-[min(520px,92vw)] w-[85vw] max-h-[92vh] max-w-[92vw] flex-col gap-0 overflow-hidden p-0 text-[13px] text-white sm:text-sm"
        dialogStyle={{ width: "85vw", height: "85vh", maxWidth: "92vw", maxHeight: "92dvh", backgroundColor: tempLayout.defaultDialogBgColor || "#0f172a" }}
        pageFactoryContract={pageFactoryContract}
      >
          {!templateSettingsSubview ? <DialogTitle className="sr-only">产品市场设置</DialogTitle> : null}
          <div
            ref={defaultDialogViewportRef}
            data-product-market-settings-workspace={templateSettingsSubview ? "true" : undefined}
            data-template-config-workspace={templateSettingsSubview ? undefined : "true"}
            data-template-draft-state={!defaultDialogBaselineReady ? "initializing" : dialogDraftChangeSummary.changed ? "dirty" : "clean"}
            data-template-unsaved-groups={dialogDraftChangeSummary.labels.join(",") || undefined}
            data-template-unsaved-fields={dialogDraftChangeSummary.groups.flatMap((group) => group.fields).join(",") || undefined}
            data-template-draft-baseline-contract={PRODUCT_MARKET_VERIFIED_DRAFT_BASELINE_CONTRACT.version}
            className={`${templateSettingsSubview ? "product-market-settings-content" : "template-config-workspace"} flex min-h-0 flex-1 flex-col`}
          >
            <Tabs value={activeSettingsTab} onValueChange={setSettingsTab} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {!templateSettingsSubview ? <div className="template-config-topbar relative shrink-0">
              <TabsList
                className={`template-config-tabbar product-market-settings-topbar h-12 w-full max-w-full items-center gap-1 border-x-0 border-t-0 p-1 pr-14 ${
                  isDefaultDialogCompact
                    ? `grid w-full ${showSharedStyleControls ? "grid-cols-3" : "grid-cols-2"}`
                    : `grid ${showSharedStyleControls ? "grid-cols-3" : "grid-cols-2"}`
                }`}
                style={defaultDialogTabListStyle}
              >
              <TabsTrigger
                value="modules"
                className={`min-w-0 h-10 font-bold data-[state=active]:bg-white/20 ${isDefaultDialogCompact ? "justify-center px-1.5 text-[12px]" : "px-3 text-[14px]"}`}
                style={{ color: defaultDialogTabListStyle.color }}
              >
                <CheckSquare className={`${isDefaultDialogNarrow ? "hidden" : "mr-1 h-3.5 w-3.5"} shrink-0`} /> <span className="truncate">栏目配置</span>
              </TabsTrigger>
              {showSharedStyleControls ? (
                <TabsTrigger
                  value="layout"
                  onPointerEnter={preloadProductMarketColorPicker}
                  onPointerDown={preloadProductMarketColorPicker}
                  onFocus={preloadProductMarketColorPicker}
                  className={`min-w-0 h-10 font-bold data-[state=active]:bg-white/20 ${isDefaultDialogCompact ? "justify-center px-1.5 text-[12px]" : "px-3 text-[14px]"}`}
                  style={{ color: defaultDialogTabListStyle.color }}
                >
                  <LayoutPanelTop className={`${isDefaultDialogNarrow ? "hidden" : "mr-1 h-3.5 w-3.5"} shrink-0`} /> <span className="truncate">版面风格</span>
                </TabsTrigger>
              ) : null}
              <TabsTrigger
                value="service"
                onPointerEnter={preloadProductMarketCustomerServiceSection}
                onPointerDown={preloadProductMarketCustomerServiceSection}
                onFocus={preloadProductMarketCustomerServiceSection}
                className={`min-w-0 h-10 font-bold data-[state=active]:bg-white/20 ${isDefaultDialogCompact ? "justify-center px-1.5 text-[12px]" : "px-3 text-[14px]"}`}
                style={{ color: defaultDialogTabListStyle.color }}
              >
                <Volume2 className={`${isDefaultDialogNarrow ? "hidden" : "mr-1 h-3.5 w-3.5"} shrink-0`} /> <span className="truncate">客服音效</span>
              </TabsTrigger>
              </TabsList>
            </div> : null}

          {activeSettingsTab !== "modules" ? (
            <div data-drag-handle data-responsive-semantic-band="page-context" data-responsive-shared-surface="title-1" data-responsive-shared-surface-plugin="large-band-density" data-shared-layout-section="title" data-development-standard-frame-region="title" data-development-standard-frame-label="标题" className="nav-3d-header template-config-section-title template-config-panel-header flex shrink-0 flex-wrap items-center justify-between gap-3">
              <button type="button" className="nav-mobile-disclosure" onClick={() => setSettingsMobileHeaderExpanded((current) => !current)} aria-expanded={settingsMobileHeaderExpanded}>
                <span className="flex min-w-0 items-center gap-2"><ProductMarketTitleIcon className="h-4 w-4 shrink-0" /><span className="truncate">{activeSettingsShortTitle}</span></span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${settingsMobileHeaderExpanded ? "rotate-180" : ""}`} />
              </button>
              <div className={`nav-mobile-header-content ${settingsMobileHeaderExpanded ? "is-expanded" : ""}`}>
                <div className="flex w-full flex-wrap items-center justify-between gap-2">
                  <div data-drag-handle className="min-w-0 flex-1 cursor-move">
                    <div data-responsive-live-title-heading className="template-config-title-row flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-[20px] font-semibold leading-tight">
                      <ProductMarketTitleIcon className="h-[22px] w-[22px] shrink-0" />
                      <span className="truncate">{activeSettingsTitle}</span>
                      <span data-responsive-live-title-description className="template-config-title-description text-[11px] font-normal leading-tight opacity-80">{activeSettingsDescription}</span>
                    </div>
                  </div>
                  {templateSettingsSubview ? (
                    <div data-shared-window-title-actions="inline" className="product-module-header-actions template-config-action-strip flex min-w-0 flex-wrap items-center justify-end gap-2 self-center">
                      {activeTemplateHeaderActionOrder.map((actionId) => (
                        <div key={actionId} className="template-config-action-item">
                          {renderTemplateHeaderAction(actionId)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTemplateHeaderActionDragEnd}>
                      <SortableContext items={draggableTemplateHeaderActionOrder} strategy={rectSortingStrategy}>
                        <div data-shared-window-title-actions="inline" className="product-module-header-actions template-config-action-strip flex min-w-0 flex-wrap items-center justify-end gap-2 self-center">
                          {draggableTemplateHeaderActionOrder.map((actionId) => (
                            <SortableTemplateHeaderAction key={actionId} id={actionId}>
                              {renderTemplateHeaderAction(actionId)}
                            </SortableTemplateHeaderAction>
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </div>
            </div>
          ) : null}

            <div className={`${templateSettingsSubview ? "product-market-settings-content-shell" : "template-config-content-shell"} min-h-0 flex-1 overflow-hidden border-x-0 border-b-0`} style={defaultDialogShellStyle}>
            {activeSettingsTab === "modules" ? (
              <Suspense
                fallback={(
                  <div className="flex h-full min-h-0 flex-1 items-center justify-center text-sm opacity-70" role="status">
                    栏目配置加载中…
                  </div>
                )}
              >
                <ProductMarketModulesPanel
                  title={{ full: activeSettingsTitle, short: activeSettingsShortTitle, description: activeSettingsDescription, textColor: defaultDialogHeaderTextColorResolved }}
                  headerActions={templateSettingsSubview ? (
                    <div data-shared-window-title-actions="inline" className="product-module-header-actions template-config-action-strip flex min-w-0 flex-wrap items-center justify-end gap-2 self-center">
                      {activeTemplateHeaderActionOrder.map((actionId) => (
                        <div key={actionId} className="template-config-action-item">
                          {renderTemplateHeaderAction(actionId)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTemplateHeaderActionDragEnd}>
                      <SortableContext items={draggableTemplateHeaderActionOrder} strategy={rectSortingStrategy}>
                        <div data-shared-window-title-actions="inline" className="product-module-header-actions template-config-action-strip flex min-w-0 flex-wrap items-center justify-end gap-2 self-center">
                          {draggableTemplateHeaderActionOrder.map((actionId) => (
                            <SortableTemplateHeaderAction key={actionId} id={actionId}>
                              {renderTemplateHeaderAction(actionId)}
                            </SortableTemplateHeaderAction>
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                  moduleTableHeaderCollapsed={moduleTableHeaderCollapsed}
                  onCollapseTableHeader={() => setModuleTableHeaderCollapsed(true)}
                  tableHeaderBorderColor={withAlpha(defaultDialogHeaderTextColorResolved, 0.32)}
                  actionButtonBackground={tempLayout.defaultDialogButtonColor || "#2FB977"}
                  actionButtonText={tempLayout.defaultDialogButtonTextColor || "#F8FFFC"}
                  groupedModuleProducts={groupedModuleProducts}
                  visibleModuleGroupCount={visibleModuleGroupCount}
                  onLoadMoreGroups={() => setVisibleModuleGroupCount((current) => Math.min(groupedModuleProducts.length, current + 2))}
                  onShowAllGroups={() => setVisibleModuleGroupCount(groupedModuleProducts.length)}
                  sensors={sensors}
                  moduleTopLevelDragIds={moduleTopLevelDragIds}
                  onModuleDragEnd={handleModuleDragEnd}
                  categoryOrderIndexMap={categoryOrderIndexMap}
                  allowModuleCategoryReorder={allowModuleCategoryReorder}
                  tempModuleCategoryOrder={tempModuleCategoryOrder}
                  avatarPreviewMap={avatarPreviewMap}
                  avatarOverrides={csAvatarOverrides}
                  moduleIconVisibility={moduleIconVisibility}
                  moduleRenderOrderByPath={moduleRenderOrderByPath}
                  expandedModulePaths={expandedModulePaths}
                  onToggleExpandedPath={(path) => setExpandedModulePaths((current) => current.includes(path) ? current.filter((currentPath) => currentPath !== path) : [...current, path])}
                  onMoveCategory={moveTempCategory}
                  onSetCategoryStatus={handleSetCategoryStatus}
                  onUpdateProduct={updateTempProduct}
                  onMoveProduct={moveTempProduct}
                  onUpdateChild={updateTempChild}
                  onMoveChild={moveTempChild}
                  onAddProduct={handleAddProduct}
                />
              </Suspense>
            ) : null}

            {activeSettingsTab === "layout" ? (
            <TabsContent value="layout" data-product-market-settings-page-content="true" className="template-config-layout-panel m-0 h-full min-h-0 w-full flex-col overflow-hidden !mt-0 flex">
              {/* 表内：版面风格也必须拥有唯一的共享表内框。主题选择器仍留在滚动内容中，
                  但下方圆角、边界与滚动安全区统一由该外壳负责。 */}
              <div
                data-product-market-table-shell="true"
                data-product-market-table-header-mode={presetThemeCollapsed ? "collapsed" : "expanded"}
                data-development-standard-frame-region="table-shell"
                data-development-standard-frame-label="表内"
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                <ScrollArea
                  data-shared-layout-section="list"
                  data-shared-scroll-contract="table-inner-60"
                  data-page-list
                  data-page-list-scroll-owner
                  data-development-standard-frame-region="content"
                  data-development-standard-frame-label="内容"
                  data-development-standard-marker-placement={presetThemeCollapsed ? "content-start" : "content-delegated"}
                  className="nav-matrix-body min-h-0 w-full flex-1"
                >
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => {
                    const { active, over } = event;
                    if (!over || active.id === over.id) return;
                    const oldIndex = tempLayoutSections.findIndex((section) => section.id === String(active.id));
                    const newIndex = tempLayoutSections.findIndex((section) => section.id === String(over.id));
                    if (oldIndex === -1 || newIndex === -1) return;
                    setTempLayoutSections((current) => arrayMove(current, oldIndex, newIndex));
                  }}
                >
                  <SortableContext items={tempLayoutSections.map((section) => section.id)} strategy={rectSortingStrategy}>
                <div data-template-config-card-list="true" className="w-full flex flex-col">
                  {!presetThemeCollapsed ? (
                    <div
                      data-page-table-header
                      data-responsive-semantic-band="table-header"
                      data-responsive-shared-surface="table-header"
                      data-responsive-shared-surface-plugin="large-band-density"
                      data-template-config-table-palette="true"
                      data-product-market-layout-header-mode="palette"
                      data-shared-layout-section="tableHeader"
                      data-development-standard-frame-region="table-header"
                      data-development-standard-frame-label="表头"
                      className="template-config-layout-theme-title relative border shadow-lg backdrop-blur"
                    >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 data-layout-theme-palette-title className={`flex items-center gap-2 ${DEFAULT_DIALOG_SECTION_TITLE_CLASS}`}>
                            选择色调 · 运营市场「主题与版色」7个色板
                          </h3>
                        </div>
                        <div className={`template-config-layout-theme-description mt-0.5 flex flex-wrap items-center gap-2 ${DEFAULT_DIALOG_META_TEXT_CLASS}`}>
                          <span>与运营市场「主题与版色」使用同一套7个色板；主色、辅色用于品牌识别，导航、正文、边框、状态与功能键分别读取经过对比度校验的专用颜色。</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPresetThemeCollapsed(true)}
                        aria-expanded={!presetThemeCollapsed}
                        className="template-config-action-button h-8 px-3 text-xs hover:opacity-95"
                        style={{
                          borderColor: withAlpha(tempLayout.defaultDialogButtonTextColor || "#F8FFFC", 0.4),
                          backgroundColor: tempLayout.defaultDialogButtonColor || "#2FB977",
                          color: tempLayout.defaultDialogButtonTextColor || "#F8FFFC",
                        }}
                      >
                        <ChevronUp className="mr-1.5 h-3.5 w-3.5" />
                        收起主题
                      </Button>
                    </div>
                    <div className="template-config-layout-theme-preset-grid mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {presetThemeOptions.map(([key]) => {
                          const isActive = selectedPresetThemeKey === key;
                          const isPreviewing = previewTheme === PRESET_THEME_KEY_MAP[key];
                          const fixedPreview = PRODUCT_MARKET_IMMUTABLE_THEME_PREVIEW_MAP[PRESET_THEME_KEY_MAP[key]].layoutChooser;
                          const presetBgColor = fixedPreview.background;
                          const presetCardTextColor = fixedPreview.text;
                          const label = presetThemeLabels[key];
                          const previewCardButton = fixedPreview.action;
                          return (
                            <button
                              key={key}
                              data-product-market-palette-key={PRESET_THEME_KEY_MAP[key]}
                              data-shared-theme-palette-key={PRESET_THEME_KEY_MAP[key]}
                              data-shared-theme-palette-policy="immutable-factory-preview"
                              data-shared-theme-palette-appearance="layout-chooser"
                              data-shared-theme-palette-state={isActive ? "selected" : isPreviewing ? "preview" : "idle"}
                              data-shared-selection-control="true"
                              data-selected={isActive}
                              aria-pressed={isActive}
                              data-development-standard-frame-region="small-card"
                              data-development-standard-frame-label="小卡片"
                              onClick={() => applyPresetThemeDefaults(key)}
                              onMouseEnter={() => handleThemeHoverEnter(PRESET_THEME_KEY_MAP[key])}
                              onMouseLeave={handleThemeHoverLeave}
                              onFocus={() => handleThemeHoverEnter(PRESET_THEME_KEY_MAP[key])}
                              onBlur={handleThemeHoverLeave}
                              title={`${label}：悬停自动预览，移开恢复；点击后正式套用。`}
                              className={`template-config-layout-theme-preset rounded-2xl border p-3 text-left transition-all duration-200 ${
                                isActive || isPreviewing ? "shadow-lg ring-1 ring-white/30" : "hover:-translate-y-0.5"
                              }`}
                              style={{
                                "--tradepro-product-market-palette-card-bg": presetBgColor,
                                "--tradepro-product-market-palette-card-text": presetCardTextColor,
                                "--tradepro-product-market-palette-card-border": fixedPreview.border,
                                "--tradepro-product-market-palette-card-primary": fixedPreview.primary,
                                "--tradepro-product-market-palette-card-primary-text": fixedPreview.primaryText,
                                backgroundColor: presetBgColor,
                                borderColor: fixedPreview.border,
                                color: presetCardTextColor,
                                boxShadow: isActive || isPreviewing
                                  ? `inset 0 4px 0 ${fixedPreview.primary}, 0 0 0 2px ${fixedPreview.focus}66, 0 10px 20px ${fixedPreview.primary}2e`
                                  : `inset 0 4px 0 ${fixedPreview.primary}, 0 4px 10px ${fixedPreview.primary}1f`,
                              } as CSSProperties}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className={DEFAULT_DIALOG_FIELD_TITLE_CLASS} style={{ color: presetCardTextColor }}>{label}</div>
                                  <div className={`mt-1 ${DEFAULT_DIALOG_META_TEXT_CLASS}`} style={{ color: presetCardTextColor }}>选择后右侧设置区与主题底色同步变化</div>
                                </div>
                                <div
                                  data-product-market-palette-primary-indicator
                                  className="flex h-6 w-6 items-center justify-center rounded-full border"
                                  style={{
                                    backgroundColor: isActive || isPreviewing ? fixedPreview.primary : "transparent",
                                    borderColor: fixedPreview.border,
                                    color: isActive || isPreviewing ? fixedPreview.primaryText : presetCardTextColor,
                                  }}
                                >
                                  {isActive ? <Check className="h-3.5 w-3.5" /> : isPreviewing ? <Eye className="h-3.5 w-3.5" /> : null}
                                </div>
                              </div>
                              <div className="mt-3 flex items-center gap-2">
                                <span className="h-3 w-8 rounded-full border border-black/10" style={{ backgroundColor: fixedPreview.primary }} title="品牌主色" />
                                <span className="h-3 w-8 rounded-full border border-black/10" style={{ backgroundColor: fixedPreview.secondary }} title="品牌辅色" />
                                <span className="h-3 w-8 rounded-full border border-black/10" style={{ backgroundColor: previewCardButton }} title="功能动作色" />
                              </div>
                              {isPreviewing && !isActive ? (
                                <div className={`mt-2 ${DEFAULT_DIALOG_META_TEXT_CLASS}`} style={{ color: presetCardTextColor }}>
                                  正在预览，移开后恢复当前版色
                                </div>
                              ) : null}
                            </button>
                            );
                          })}
                        <button
                          data-theme-editor-default-source="neutral-white-black"
                          data-development-standard-frame-region="small-card"
                          data-development-standard-frame-label="小卡片"
                          onPointerEnter={preloadProductMarketThemeEditorDialog}
                          onPointerDown={preloadProductMarketThemeEditorDialog}
                          onFocus={preloadProductMarketThemeEditorDialog}
                          onClick={openNewThemeEditor}
                          className={`template-config-layout-theme-preset ${DEFAULT_DIALOG_FIELD_TITLE_CLASS} rounded-2xl border border-dashed p-3 text-left transition-all hover:-translate-y-0.5`}
                          style={{
                            background: "#FFFFFF",
                            borderColor: "#11111155",
                            color: "#000000",
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            <span>+新增主题</span>
                          </div>
                          <div className={`mt-1 ${DEFAULT_DIALOG_META_TEXT_CLASS}`} style={{ color: `${tempLayout.themePanelTextColor}cc` }}>
                            新建默认主体与小卡片均为白底黑字，保存前可再独立调整。
                          </div>
                        </button>
                    </div>
                  </div>
                  ) : null}

                  <div
                    data-development-standard-frame-region={presetThemeCollapsed ? undefined : "content"}
                    data-development-standard-frame-label={presetThemeCollapsed ? undefined : "内容"}
                    data-development-standard-marker-placement={presetThemeCollapsed ? undefined : "content-card-start"}
                    className="min-w-0"
                  >
                  <LayoutSectionCard
                    section={getTempLayoutSection("global-font")}
                    index={getTempLayoutSectionIndex("global-font")}
                    total={tempLayoutSections.length}
                    editable={isHQClientStyleSettings}
                    onChange={(updater) => updateTempLayoutSection("global-font", updater)}
                    onMove={(direction) => moveTempLayoutSection("global-font", direction)}
                    order={layoutSectionOrder("global-font")}
                  >
                    <div data-layout-unified-settings="global-font" className="layout-section-two-pane">
                      <div
                        className="overflow-hidden rounded-2xl border p-2.5"
                        style={{
                          backgroundColor: tempLayout.clientSecondaryPageBgColor || tempLayout.contentBgColor,
                          color: tempLayout.clientSecondaryPageTextColor || tempLayout.contentTextColor,
                          borderColor: `${tempLayout.clientSecondaryPageTextColor || tempLayout.contentTextColor}33`,
                          fontFamily: globalFontFamily || DEFAULT_DESIGN_FONT_STACK,
                          fontWeight: globalFontWeight || DEFAULT_DESIGN_FONT_WEIGHT,
                          letterSpacing: globalLetterSpacing || DEFAULT_DESIGN_LETTER_SPACING,
                        }}
                      >
                        <div className="rounded-md px-2.5 py-1.5 text-xs font-semibold" style={{ backgroundColor: tempLayout.clientTopbarOverrideBgColor || sidebarStyle.bgFrom, color: tempLayout.clientTopbarOverrideTextColor || sidebarStyle.textColor }}>
                          TradePro · 字体实时预览
                        </div>
                        <div className="mt-2 rounded-md px-2.5 py-1.5 text-xs font-semibold" style={{ backgroundColor: tempLayout.clientSecondaryTitleBgColor || tempLayout.themePanelButtonColor, color: tempLayout.clientSecondaryTitleTextColor || tempLayout.headerButtonTextColor }}>
                          全局与版面风格
                        </div>
                        <div className="mt-2 rounded-md p-2" style={{ backgroundColor: tempLayout.contentBgColor, color: tempLayout.contentTextColor }}>
                          <div className="rounded px-2 py-1 text-[11px]" style={{ backgroundColor: tempLayout.clientSecondaryListBgColor || tempLayout.contentBgColor, color: tempLayout.clientSecondaryListTextColor || tempLayout.contentTextColor }}>
                            表头 · 字体、字重与字间距
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div className="rounded px-2 py-2 text-[11px]" style={{ backgroundColor: tempLayout.clientLargeCardBgColor || tempLayout.clientCardBgColor || tempLayout.contentBgColor, color: tempLayout.clientLargeCardTextColor || tempLayout.clientCardTextColor || tempLayout.contentTextColor }}>
                              大卡片文字
                            </div>
                            <div className="rounded px-2 py-2 text-[11px]" style={{ backgroundColor: tempLayout.clientFeatureCardBgColor || tempLayout.clientCardBgColor || tempLayout.contentBgColor, color: tempLayout.clientFeatureCardTextColor || tempLayout.clientCardTextColor || tempLayout.contentTextColor }}>
                              小卡片文字
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 rounded px-2.5 py-1.5 text-[10px]" style={{ backgroundColor: tempLayout.clientFooterOverrideBgColor || sidebarStyle.bgTo, color: tempLayout.clientFooterOverrideTextColor || sidebarStyle.textColor }}>
                          {FONT_OPTIONS.find((item) => item.value === globalFontFamily)?.label || "系统默认"} · {FONT_WEIGHT_OPTIONS.find((item) => item.value === globalFontWeight)?.label || "中体"} · 字间距 {LETTER_SPACING_OPTIONS.find((item) => item.value === globalLetterSpacing)?.label || "标准"}
                        </div>
                      </div>

                      <div
                        className="layout-global-font-settings"
                        style={{
                          ["--pm-layout-font-choice-selected-bg" as string]: globalFontSelectedBgColor,
                          ["--pm-layout-font-choice-selected-text" as string]: globalFontSelectedTextColor,
                          ["--pm-layout-font-choice-selected-outline" as string]: globalFontSelectedOutlineColor,
                        }}
                      >
                        <div data-responsive-choice-group="font-family" className="layout-global-font-option layout-global-font-option--family">
                          <div className={`mb-2 ${DEFAULT_DIALOG_FIELD_TITLE_CLASS}`}>字体选择</div>
                          <div data-responsive-choice-grid="font-family" className="layout-global-font-buttons">
                            {FONT_OPTIONS.map((font) => (
                              <button
                                type="button"
                                key={font.value}
                                data-layout-global-font-choice="family"
                                data-layout-global-font-value={font.value}
                                data-shared-selection-control="true"
                                data-selected={globalFontFamily === font.value}
                                data-layout-global-font-selected={globalFontFamily === font.value ? "true" : "false"}
                                aria-pressed={globalFontFamily === font.value}
                                onClick={() => handleGlobalFontFamilyChange(font.value)}
                                className="max-w-full truncate rounded px-2 py-1.5 text-[10px] transition-all sm:px-2.5 sm:text-xs"
                                style={{
                                  fontFamily: font.value,
                                  ...(globalFontFamily === font.value
                                    ? {
                                        backgroundColor: globalFontSelectedBgColor,
                                        color: globalFontSelectedTextColor,
                                        boxShadow: `0 0 0 1px ${withAlpha(globalFontSelectedBgColor, 0.3)}`,
                                      }
                                    : {
                                        backgroundColor: globalFontOptionBgColor,
                                        color: globalFontOptionTextColor,
                                        border: `1px solid ${defaultDialogSoftBorder}`,
                                      }),
                                }}
                              >
                                {font.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div data-layout-global-typography-pair="vertical-columns-v2" className="layout-global-typography-pair">
                          <div data-responsive-choice-group="font-weight" data-layout-global-font-column="weight" className="layout-global-font-option layout-global-font-option--weight">
                            <div className={`mb-2 ${DEFAULT_DIALOG_FIELD_TITLE_CLASS}`}>字体细粗</div>
                            <div data-responsive-choice-grid="font-weight" className="layout-global-font-buttons">
                              {FONT_WEIGHT_OPTIONS.map((option) => (
                                <button
                                  type="button"
                                  key={option.value}
                                  data-layout-global-font-choice="weight"
                                  data-layout-global-font-value={option.value}
                                  data-shared-selection-control="true"
                                  data-selected={globalFontWeight === option.value}
                                  data-layout-global-font-selected={globalFontWeight === option.value ? "true" : "false"}
                                  aria-pressed={globalFontWeight === option.value}
                                  onClick={() => handleGlobalFontWeightChange(option.value)}
                                  className="max-w-full truncate rounded px-2 py-1.5 text-[10px] transition-all sm:px-2.5 sm:text-xs"
                                  style={{
                                    fontWeight: option.value,
                                    ...(globalFontWeight === option.value
                                      ? {
                                          backgroundColor: globalFontSelectedBgColor,
                                          color: globalFontSelectedTextColor,
                                          boxShadow: `0 0 0 1px ${withAlpha(globalFontSelectedBgColor, 0.3)}`,
                                        }
                                      : {
                                          backgroundColor: globalFontOptionBgColor,
                                          color: globalFontOptionTextColor,
                                          border: `1px solid ${defaultDialogSoftBorder}`,
                                        }),
                                  }}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div data-responsive-choice-group="letter-spacing" data-layout-global-font-column="spacing" className="layout-global-font-option layout-global-font-option--spacing">
                            <div className={`mb-2 ${DEFAULT_DIALOG_FIELD_TITLE_CLASS}`}>字间距</div>
                            <div data-responsive-choice-grid="letter-spacing" className="layout-global-font-buttons">
                              {LETTER_SPACING_OPTIONS.map((option) => (
                                <button
                                  type="button"
                                  key={option.value}
                                  data-layout-global-font-choice="spacing"
                                  data-layout-global-font-value={option.value}
                                  data-shared-selection-control="true"
                                  data-selected={globalLetterSpacing === option.value}
                                  data-layout-global-font-selected={globalLetterSpacing === option.value ? "true" : "false"}
                                  aria-pressed={globalLetterSpacing === option.value}
                                  onClick={() => handleGlobalLetterSpacingChange(option.value)}
                                  className="max-w-full truncate rounded px-2 py-1.5 text-[10px] transition-all sm:px-2.5 sm:text-xs"
                                  style={{
                                    letterSpacing: option.value,
                                    ...(globalLetterSpacing === option.value
                                      ? {
                                          backgroundColor: globalFontSelectedBgColor,
                                          color: globalFontSelectedTextColor,
                                          boxShadow: `0 0 0 1px ${withAlpha(globalFontSelectedBgColor, 0.3)}`,
                                        }
                                      : {
                                          backgroundColor: globalFontOptionBgColor,
                                          color: globalFontOptionTextColor,
                                          border: `1px solid ${defaultDialogSoftBorder}`,
                                        }),
                                  }}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </LayoutSectionCard>
                  </div>

                  <LayoutSectionCard
                    section={getTempLayoutSection("content-bg")}
                    index={getTempLayoutSectionIndex("content-bg")}
                    total={tempLayoutSections.length}
                    editable={isHQClientStyleSettings}
                    onChange={(updater) => updateTempLayoutSection("content-bg", updater)}
                    onMove={(direction) => moveTempLayoutSection("content-bg", direction)}
                    order={layoutSectionOrder("content-bg")}
                  >
                    <div
                      data-layout-fine-editor
                      data-layout-unified-settings="content-bg"
                      data-layout-fine-editor-contract="two-pane"
                      className="layout-section-two-pane layout-section-two-pane--fine"
                    >
                      <div data-layout-fine-preview data-layout-fine-page-preview className="overflow-hidden border p-3 text-xs" style={{ background: tempLayoutThemeTokens["--tradepro-panel-bg"], color: tempLayoutThemeTokens["--tradepro-panel-text"], borderRadius: tempLayout.frameCornerRadius === "square" ? 0 : tempLayout.frameCornerRadius === "soft" ? "0.75rem" : "1.5rem", boxShadow: tempLayout.frameElevation === "raised" ? "0 10px 24px rgba(15,23,42,.18)" : tempLayout.frameElevation === "soft" ? "0 4px 12px rgba(15,23,42,.12)" : "none" }}>
                        <div className="mb-2 flex items-center justify-between rounded-lg px-3 py-2" style={{ background: tempLayoutThemeTokens["--tradepro-client-topbar-bg"], color: tempLayoutThemeTokens["--tradepro-client-topbar-text"] }}>顶部 <span>功能按键</span></div>
                        <div className="rounded-t-lg px-3 py-3 text-left" style={{ background: tempLayoutThemeTokens["--tradepro-panel-title-bg"], color: tempLayoutThemeTokens["--tradepro-panel-title-text"] }}>标题 1 · 客户源开发工具 → 运营市场</div>
                        <div className="mb-2 rounded-b-lg border-t border-current/20 px-3 py-2 text-left text-[11px]" style={{ background: tempLayoutThemeTokens["--tradepro-panel-title-2-bg"], color: tempLayoutThemeTokens["--tradepro-panel-title-2-text"] }}>标题 2 <span className="ml-2 rounded px-2 py-1" style={{ background: tempLayoutThemeTokens["--tradepro-panel-title-2-primary"], color: tempLayoutThemeTokens["--tradepro-panel-title-2-primary-text"] }}>主题主体色</span></div>
                        <div className="p-2" style={{ background: tempLayoutThemeTokens["--tradepro-panel-frame-bg"], color: tempLayoutThemeTokens["--tradepro-panel-frame-text"], borderRadius: `0 0 ${tempLayout.frameCornerRadius === "square" ? "0px" : tempLayout.frameCornerRadius === "soft" ? "0.75rem" : "1.5rem"} ${tempLayout.frameCornerRadius === "square" ? "0px" : tempLayout.frameCornerRadius === "soft" ? "0.75rem" : "1.5rem"}` }}>
                          <div className="mb-2 rounded-md px-3 py-2" style={{ background: tempLayoutThemeTokens["--tradepro-panel-table-bg"], color: tempLayoutThemeTokens["--tradepro-panel-table-text"] }}>表头 · 批量操作</div>
                          <div className="rounded-md p-2" style={{ background: tempLayoutThemeTokens["--tradepro-product-market-content-bg"], color: tempLayoutThemeTokens["--tradepro-product-market-content-text"] }}>内容<div className="mt-2 rounded-md p-2" style={{ background: tempLayoutThemeTokens["--tradepro-product-market-large-card-bg"], color: tempLayoutThemeTokens["--tradepro-product-market-large-card-text"] }}>大卡片<div className="mt-2 rounded-md px-2 py-2" style={{ background: tempLayoutThemeTokens["--tradepro-panel-card-bg"], color: tempLayoutThemeTokens["--tradepro-panel-card-text"] }}>小卡片</div></div></div>
                        </div>
                        <div className="mt-2 rounded-lg px-3 py-2" style={{ background: tempLayoutThemeTokens["--tradepro-client-footer-bg"], color: tempLayoutThemeTokens["--tradepro-client-footer-text"] }}>尾栏</div>
                      </div>
                      <div data-layout-fine-controls data-layout-settings-pane="true" className="min-w-0">
                        <div data-layout-direct-color-cards="true" className="grid gap-2 sm:grid-cols-2">
                          <section data-layout-fine-color-board="surface" className="min-w-0">
                            <h4 className="mb-2 text-xs font-semibold">背景颜色区</h4>
                            <div className="grid gap-2">
                              <ColorPicker compact value={tempLayout.clientTopbarOverrideBgColor || sidebarStyle.bgFrom} textColor={tempLayout.clientTopbarOverrideTextColor || sidebarStyle.textColor} onChange={(color) => updateFineLayout({ clientTopbarOverrideBgColor: color })} label="顶部背景色" />
                              <ColorPicker compact value={tempLayout.contentBgColor} textColor={tempLayout.contentTextColor} onChange={(color) => updateFineLayout({ contentBgColor: color })} label="主体背景色" />
                              <ColorPicker compact value={tempLayout.clientSecondaryTitleBgColor || "#8e2e62"} textColor={tempLayout.clientSecondaryTitleTextColor || "#ffffff"} onChange={(color) => updateFineLayout({ clientSecondaryTitleBgColor: color })} label="标题背景色" />
                              <ColorPicker compact value={tempLayout.clientSecondaryPageBgColor || tempLayout.contentBgColor} textColor={tempLayout.clientSecondaryPageTextColor || tempLayout.contentTextColor} onChange={(color) => updateFineLayout({ clientSecondaryPageBgColor: color })} label="表内背景色" />
                              <ColorPicker compact value={tempLayout.clientSecondaryListBgColor || "#ffffff"} textColor={tempLayout.clientSecondaryListTextColor || tempLayout.contentTextColor} onChange={(color) => updateFineLayout({ clientSecondaryListBgColor: color })} label="表头背景色" />
                              <ColorPicker compact value={tempLayout.clientSecondaryContentBgColor || tempLayout.clientSecondaryPageBgColor || tempLayout.contentBgColor} textColor={tempLayout.clientSecondaryContentTextColor || tempLayout.clientSecondaryPageTextColor || tempLayout.contentTextColor} onChange={(color) => updateFineLayout({ clientSecondaryContentBgColor: color })} label="内容背景色" />
                              <ColorPicker compact value={tempLayout.clientLargeCardBgColor || tempLayout.clientCardBgColor || "#ffffff"} textColor={tempLayout.clientLargeCardTextColor || tempLayout.clientCardTextColor || tempLayout.contentTextColor} onChange={(color) => updateFineLayout({ clientLargeCardBgColor: color })} label="大卡片底色" />
                              <ColorPicker compact value={tempLayout.clientFeatureCardBgColor || tempLayout.clientCardBgColor || "#ffffff"} textColor={tempLayout.clientFeatureCardTextColor || tempLayout.clientCardTextColor || tempLayout.contentTextColor} onChange={(color) => updateFineLayout({ clientFeatureCardBgColor: color })} label="小卡片底色" />
                              <ColorPicker compact value={tempLayout.clientFooterOverrideBgColor || sidebarStyle.bgTo} textColor={tempLayout.clientFooterOverrideTextColor || sidebarStyle.textColor} onChange={(color) => updateFineLayout({ clientFooterOverrideBgColor: color })} label="尾栏背景色" />
                              <ColorPicker compact value={tempLayout.themePanelButtonColor || "#d94a87"} textColor={tempLayout.headerButtonTextColor || "#ffffff"} onChange={(color) => updateFineLayout({ themePanelButtonColor: color })} label="功能键底色" />
                              <ColorPicker compact value={tempLayout.rightSelectedFrameColor || sidebarStyle.borderColor || tempLayout.themePanelButtonColor || "#d94a87"} textColor={resolveReadableTextColor(tempLayout.rightSelectedFrameColor || sidebarStyle.borderColor || tempLayout.themePanelButtonColor || "#d94a87", normalizeRightSelectedTextPreference(tempLayout.rightSelectedTextColor) || sidebarStyle.activeHighlight || tempLayout.headerButtonTextColor || "#ffffff", "#000000", RIGHT_SELECTED_TEXT_FALLBACK)} onChange={(color) => updateFineLayout({ rightSelectedFrameColor: color })} label="右侧选中框" />
                            </div>
                          </section>
                          <section data-layout-fine-color-board="text" className="min-w-0">
                            <h4 className="mb-2 text-xs font-semibold">字体颜色区</h4>
                            <div className="grid gap-2">
                              <ColorPicker compact value={tempLayout.clientTopbarOverrideTextColor || sidebarStyle.textColor} surfaceColor={tempLayout.clientTopbarOverrideBgColor || sidebarStyle.bgFrom} onChange={(color) => updateFineLayout({ clientTopbarOverrideTextColor: color })} label="顶部文字色" />
                              <ColorPicker compact value={tempLayout.contentTextColor} surfaceColor={tempLayout.contentBgColor} onChange={(color) => updateFineLayout({ contentTextColor: color })} label="主体文字色" />
                              <ColorPicker compact value={tempLayout.clientSecondaryTitleTextColor || "#ffffff"} surfaceColor={tempLayout.clientSecondaryTitleBgColor || "#8e2e62"} onChange={(color) => updateFineLayout({ clientSecondaryTitleTextColor: color })} label="标题文字色" />
                              <ColorPicker compact value={tempLayout.clientSecondaryPageTextColor || tempLayout.contentTextColor} surfaceColor={tempLayout.clientSecondaryPageBgColor || tempLayout.contentBgColor} onChange={(color) => updateFineLayout({ clientSecondaryPageTextColor: color })} label="表内文字色" />
                              <ColorPicker compact value={tempLayout.clientSecondaryListTextColor || tempLayout.contentTextColor} surfaceColor={tempLayout.clientSecondaryListBgColor || "#ffffff"} onChange={(color) => updateFineLayout({ clientSecondaryListTextColor: color })} label="表头文字色" />
                              <ColorPicker compact value={tempLayout.clientSecondaryContentTextColor || tempLayout.clientSecondaryPageTextColor || tempLayout.contentTextColor} surfaceColor={tempLayout.clientSecondaryContentBgColor || tempLayout.clientSecondaryPageBgColor || tempLayout.contentBgColor} onChange={(color) => updateFineLayout({ clientSecondaryContentTextColor: color })} label="内容文字色" />
                              <ColorPicker compact value={tempLayout.clientLargeCardTextColor || tempLayout.clientCardTextColor || tempLayout.contentTextColor} surfaceColor={tempLayout.clientLargeCardBgColor || tempLayout.clientCardBgColor || "#ffffff"} onChange={(color) => updateFineLayout({ clientLargeCardTextColor: color })} label="大卡片字色" />
                              <ColorPicker compact value={tempLayout.clientFeatureCardTextColor || tempLayout.clientCardTextColor || tempLayout.contentTextColor} surfaceColor={tempLayout.clientFeatureCardBgColor || tempLayout.clientCardBgColor || "#ffffff"} onChange={(color) => updateFineLayout({ clientFeatureCardTextColor: color })} label="小卡片字色" />
                              <ColorPicker compact value={tempLayout.clientFooterOverrideTextColor || sidebarStyle.textColor} surfaceColor={tempLayout.clientFooterOverrideBgColor || sidebarStyle.bgTo} onChange={(color) => updateFineLayout({ clientFooterOverrideTextColor: color })} label="尾栏文字色" />
                              <ColorPicker compact value={tempLayout.headerButtonTextColor || "#ffffff"} surfaceColor={tempLayout.themePanelButtonColor || "#d94a87"} onChange={(color) => updateFineLayout({ headerButtonTextColor: color })} label="功能键字色" />
                              <ColorPicker compact value={normalizeRightSelectedTextPreference(tempLayout.rightSelectedTextColor) || sidebarStyle.activeHighlight || tempLayout.headerButtonTextColor || RIGHT_SELECTED_TEXT_FALLBACK} textColor={resolveReadableTextColor(tempLayout.rightSelectedFrameColor || sidebarStyle.borderColor || tempLayout.themePanelButtonColor || "#d94a87", normalizeRightSelectedTextPreference(tempLayout.rightSelectedTextColor) || sidebarStyle.activeHighlight || tempLayout.headerButtonTextColor || RIGHT_SELECTED_TEXT_FALLBACK, "#000000", RIGHT_SELECTED_TEXT_FALLBACK)} surfaceColor={tempLayout.rightSelectedFrameColor || sidebarStyle.borderColor || tempLayout.themePanelButtonColor || "#d94a87"} onChange={(color) => updateFineLayout({ rightSelectedTextColor: color })} label="右侧选中字" />
                            </div>
                          </section>
                        </div>
                      </div>
                    </div>
                  </LayoutSectionCard>

                  <LayoutSectionCard
                    section={getTempLayoutSection("sidebar-style")}
                    index={getTempLayoutSectionIndex("sidebar-style")}
                    total={tempLayoutSections.length}
                    editable={isHQClientStyleSettings}
                    onChange={(updater) => updateTempLayoutSection("sidebar-style", updater)}
                    onMove={(direction) => moveTempLayoutSection("sidebar-style", direction)}
                    order={layoutSectionOrder("sidebar-style")}
                  >
                    {(() => {
                      const hlColor = sidebarStyle.activeHighlight || "#0ea5e9";
                      const activeSurfaceColor = sidebarStyle.borderColor || "#e2e8f0";
                      const activeTextColor = resolveReadableTextColor(activeSurfaceColor, hlColor, "#000000", LEFT_SELECTED_TEXT_FALLBACK);
                      const previewItems = [
                        { label: "服务概览", state: "normal" as const },
                        {
                          label: "AI 智能",
                          state: "active" as const,
                          children: [
                            { label: "AI 建站", state: "normal" as const },
                            { label: "智能客服", state: "selected" as const },
                          ],
                        },
                        { label: "产品管理", state: "hover" as const },
                        { label: "SEO 优化", state: "normal" as const },
                      ];
                      return (
                        <div data-layout-unified-settings="sidebar-style" className="layout-section-two-pane">
                          <div
                            className="overflow-hidden rounded-lg text-xs"
                            style={{
                              background: `linear-gradient(to bottom, ${sidebarStyle.bgFrom}, ${sidebarStyle.bgVia}, ${sidebarStyle.bgTo})`,
                              border: `1px solid ${sidebarStyle.borderColor}40`,
                            }}
                          >
                          <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${sidebarStyle.borderColor}30` }}>
                            <div className="flex h-5 w-5 items-center justify-center rounded" style={{ backgroundColor: activeSurfaceColor }}>
                              <span className="text-[8px] font-bold text-white">T</span>
                            </div>
                            <span className={DEFAULT_DIALOG_FIELD_TITLE_CLASS + " text-white"}>侧边栏实时预览</span>
                          </div>
                          <div className="space-y-0.5 px-1.5 py-1.5">
                            {previewItems.map((item, index) => {
                              const isActive = item.state === "active";
                              const isHover = item.state === "hover";
                              return (
                                <div key={index}>
                                  <div
                                    className="flex items-center justify-between rounded-md px-2.5 py-1.5 transition-all"
                                    style={
                                          isActive
                                            ? {
                                            backgroundColor: activeSurfaceColor,
                                            color: activeTextColor,
                                            borderLeft: `2px solid ${hlColor}`,
                                            fontWeight: 500,
                                          }
                                        : isHover
                                          ? {
                                              color: sidebarStyle.textColor,
                                              backgroundColor: `${sidebarStyle.textColor}10`,
                                              transform: "scale(1.03) translateX(2px)",
                                            }
                                          : { color: `${sidebarStyle.textColor}e6` }
                                    }
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: isActive ? hlColor : `${sidebarStyle.textColor}60`, opacity: 0.7 }} />
                                      <span>{item.label}</span>
                                    </div>
                                    {item.children ? <span className="text-[8px]">▾</span> : null}
                                  </div>
                                  {item.children ? (
                                    <div className="ml-5 mt-0.5 space-y-0.5 pl-2" style={{ borderLeft: `1.5px solid ${sidebarStyle.borderColor}30` }}>
                                      {item.children.map((child, childIndex) => {
                                        const isSelected = child.state === "selected";
                                        return (
                                          <div
                                            key={childIndex}
                                            className="rounded px-2 py-1 text-xs"
                                            style={
                                              isSelected
                                                ? {
                                                    color: activeTextColor,
                                                    backgroundColor: activeSurfaceColor,
                                                    borderLeft: `2px solid ${hlColor}`,
                                                    marginLeft: "-2px",
                                                    paddingLeft: "10px",
                                                    fontWeight: 500,
                                                  }
                                                : { color: `${sidebarStyle.textColor}b3` }
                                            }
                                          >
                                            {child.label}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                          </div>
                          <div className="layout-color-picker-grid content-start">
                            <ColorPicker value={sidebarStyle.bgFrom} textColor={sidebarStyle.textColor} onChange={(color) => { setSidebarStyle({ bgFrom: color }); syncTempThemeOverride({ sidebar: { bgFrom: color } }); markCurrentTempThemeCustomized(); }} label="渐变起始色" />
                            <ColorPicker value={sidebarStyle.bgVia} textColor={sidebarStyle.textColor} onChange={(color) => { setSidebarStyle({ bgVia: color }); syncTempThemeOverride({ sidebar: { bgVia: color } }); markCurrentTempThemeCustomized(); }} label="渐变中间色" />
                            <ColorPicker value={sidebarStyle.bgTo} textColor={sidebarStyle.textColor} onChange={(color) => { setSidebarStyle({ bgTo: color }); syncTempThemeOverride({ sidebar: { bgTo: color } }); markCurrentTempThemeCustomized(); }} label="渐变结束色" />
                            <ColorPicker value={sidebarStyle.textColor} textColor={sidebarStyle.textColor} surfaceColor={sidebarStyle.bgFrom} onChange={(color) => { setSidebarStyle({ textColor: color }); syncTempThemeOverride({ sidebar: { textColor: color } }); markCurrentTempThemeCustomized(); }} label="左侧栏字体" />
                            <ColorPicker value={sidebarStyle.borderColor} textColor={activeTextColor} onChange={(color) => { setSidebarStyle({ borderColor: color }); syncTempThemeOverride({ sidebar: { borderColor: color } }); markCurrentTempThemeCustomized(); }} label="左侧选中框" />
                            <ColorPicker value={sidebarStyle.activeHighlight} textColor={activeTextColor} surfaceColor={sidebarStyle.borderColor} onChange={(color) => { setSidebarStyle({ activeHighlight: color }); syncTempThemeOverride({ sidebar: { activeHighlight: color } }); markCurrentTempThemeCustomized(); }} label="左侧选中字" />
                          </div>
                        </div>
                      );
                    })()}
                  </LayoutSectionCard>

                  <LayoutSectionCard
                    section={getTempLayoutSection("product-card-colors")}
                    index={getTempLayoutSectionIndex("product-card-colors")}
                    total={tempLayoutSections.length}
                    editable={isHQClientStyleSettings}
                    onChange={(updater) => updateTempLayoutSection("product-card-colors", updater)}
                    onMove={(direction) => moveTempLayoutSection("product-card-colors", direction)}
                    order={layoutSectionOrder("product-card-colors")}
                  >
                    <div
                      data-layout-unified-settings="product-card-colors"
                      data-layout-status-settings
                      data-shared-status-card-source="product-card-colors"
                      className="layout-section-product-status-list"
                    >
                      {([
                        ["开通状态", "开通", tempStatusCardColors.active, "active", "palette-primary"],
                        ["取消状态", "取消", tempStatusCardColors.inactive, "inactive", "high-red"],
                        ["隐藏状态", "隐藏", tempStatusCardColors.hidden, "hidden", "dark-gray"],
                      ] as const).map(([title, label, style, statusKey, factoryRole]) => (
                        <div key={statusKey} className="layout-section-two-pane layout-section-two-pane-reverse layout-section-product-status-row">
                          <div data-layout-status-settings-pane="true">
                            <Label data-shared-large-card-text className={`mb-2 block ${DEFAULT_DIALOG_FIELD_TITLE_CLASS}`}>{title}设置</Label>
                            <div className="layout-color-picker-grid">
                              <ColorPicker value={style.bg} textColor={style.nameFont || style.font} onChange={(color) => { applyThemeCardColors(statusKey, { bg: color }); markCurrentTempThemeCustomized(); }} label="小卡片底色" />
                              <ColorPicker value={style.nameFont || style.font} textColor={style.nameFont || style.font} surfaceColor={style.bg} onChange={(color) => { applyThemeCardColors(statusKey, { nameFont: color }); markCurrentTempThemeCustomized(); }} label="小卡片字体" />
                              <ColorPicker value={style.button} textColor={style.font} onChange={(color) => { applyThemeCardColors(statusKey, { button: color }); markCurrentTempThemeCustomized(); }} label="状态胶囊色" />
                              <ColorPicker value={style.font} textColor={style.font} surfaceColor={style.button} onChange={(color) => { applyThemeCardColors(statusKey, { font: color }); markCurrentTempThemeCustomized(); }} label="状态胶囊字" />
                            </div>
                          </div>
                          <div className="flex flex-col justify-center">
                            <div
                              data-shared-status-card={statusKey}
                              data-shared-status-card-source="product-card-colors"
                              data-shared-status-card-factory-role={factoryRole}
                              className="rounded-lg border p-1.5 transition-all duration-200 sm:p-2"
                              style={{ background: style.bg, borderColor: style.border }}
                            >
                              <div className="mb-1 flex items-center gap-1.5">
                                <div className="flex h-4 w-4 items-center justify-center rounded bg-white/10">
                                  <Package className="h-2.5 w-2.5" style={{ color: style.font }} />
                                </div>
                                <span className="truncate text-[9px] font-bold" style={{ color: style.nameFont || style.font }}>
                                  产品名称
                                </span>
                              </div>
                              <div className="rounded py-0.5 text-center text-[8px] font-medium" style={getProductMarketStatusControlStyle(style)}>
                                {label}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </LayoutSectionCard>

                  <LayoutSectionCard
                    section={getTempLayoutSection("customer-service-style")}
                    index={getTempLayoutSectionIndex("customer-service-style")}
                    total={tempLayoutSections.length}
                    editable={isHQClientStyleSettings}
                    onChange={(updater) => updateTempLayoutSection("customer-service-style", updater)}
                    onMove={(direction) => moveTempLayoutSection("customer-service-style", direction)}
                    order={layoutSectionOrder("customer-service-style")}
                  >
                    <div data-layout-unified-settings="customer-service-style" className="layout-section-two-pane layout-section-two-pane-reverse">
                      <div className="layout-customer-service-settings layout-color-picker-grid">
                        <ColorPicker
                          value={tempLayout.customerServiceLauncherBgColor || "#ffffff"}
                          textColor={tempLayout.customerServiceLauncherIconColor || "#3b82f6"}
                          onChange={(color) => {
                            setTempLayout((current) => ({ ...current, customerServiceLauncherBgColor: color }));
                            syncTempThemeOverride({ layout: { customerServiceLauncherBgColor: color } });
                            markCurrentTempThemeCustomized();
                          }}
                          label="悬浮入口色"
                        />
                        <ColorPicker
                          value={tempLayout.customerServiceLauncherIconColor || "#3b82f6"}
                          textColor={tempLayout.customerServiceLauncherIconColor || "#3b82f6"}
                          surfaceColor={tempLayout.customerServiceLauncherBgColor || "#ffffff"}
                          onChange={(color) => {
                            setTempLayout((current) => ({ ...current, customerServiceLauncherIconColor: color }));
                            syncTempThemeOverride({ layout: { customerServiceLauncherIconColor: color } });
                            markCurrentTempThemeCustomized();
                          }}
                          label="悬浮入口标"
                        />
                        <ColorPicker
                          value={tempLayout.customerServicePanelBgColor || "#ffffff"}
                          textColor={tempLayout.contentTextColor}
                          onChange={(color) => {
                            setTempLayout((current) => ({ ...current, customerServicePanelBgColor: color }));
                            syncTempThemeOverride({ layout: { customerServicePanelBgColor: color } });
                            markCurrentTempThemeCustomized();
                          }}
                          label="聊天窗口色"
                        />
                        <ColorPicker
                          value={tempLayout.customerServicePanelHeaderBgColor || "#3b82f6"}
                          textColor={tempLayout.customerServicePanelHeaderTextColor || "#ffffff"}
                          onChange={(color) => {
                            setTempLayout((current) => ({ ...current, customerServicePanelHeaderBgColor: color }));
                            syncTempThemeOverride({ layout: { customerServicePanelHeaderBgColor: color } });
                            markCurrentTempThemeCustomized();
                          }}
                          label="窗口头部色"
                        />
                        <ColorPicker
                          value={tempLayout.customerServicePanelHeaderTextColor || "#ffffff"}
                          textColor={tempLayout.customerServicePanelHeaderTextColor || "#ffffff"}
                          surfaceColor={tempLayout.customerServicePanelHeaderBgColor || "#3b82f6"}
                          onChange={(color) => {
                            setTempLayout((current) => ({ ...current, customerServicePanelHeaderTextColor: color }));
                            syncTempThemeOverride({ layout: { customerServicePanelHeaderTextColor: color } });
                            markCurrentTempThemeCustomized();
                          }}
                          label="窗口头部字"
                        />
                        <ColorPicker
                          value={tempLayout.customerServiceInputBorderColor || "#93c5fd"}
                          textColor={tempLayout.contentTextColor}
                          onChange={(color) => {
                            setTempLayout((current) => ({ ...current, customerServiceInputBorderColor: color }));
                            syncTempThemeOverride({ layout: { customerServiceInputBorderColor: color } });
                            markCurrentTempThemeCustomized();
                          }}
                          label="输入框边框"
                        />
                        <ColorPicker
                          value={tempLayout.customerServiceAssistantMsgBgColor || "#ffffff"}
                          textColor={tempLayout.customerServiceAssistantMsgTextColor || "#334155"}
                          onChange={(color) => {
                            setTempLayout((current) => ({ ...current, customerServiceAssistantMsgBgColor: color }));
                            syncTempThemeOverride({ layout: { customerServiceAssistantMsgBgColor: color } });
                            markCurrentTempThemeCustomized();
                          }}
                          label="客服消息色"
                        />
                        <ColorPicker
                          value={tempLayout.customerServiceAssistantMsgTextColor || "#334155"}
                          textColor={tempLayout.customerServiceAssistantMsgTextColor || "#334155"}
                          surfaceColor={tempLayout.customerServiceAssistantMsgBgColor || "#ffffff"}
                          onChange={(color) => {
                            setTempLayout((current) => ({ ...current, customerServiceAssistantMsgTextColor: color }));
                            syncTempThemeOverride({ layout: { customerServiceAssistantMsgTextColor: color } });
                            markCurrentTempThemeCustomized();
                          }}
                          label="客服消息字"
                        />
                        <ColorPicker
                          value={tempLayout.customerServiceUserMsgBgColor || "#2563eb"}
                          textColor={tempLayout.customerServiceUserMsgTextColor || "#ffffff"}
                          onChange={(color) => {
                            setTempLayout((current) => ({ ...current, customerServiceUserMsgBgColor: color }));
                            syncTempThemeOverride({ layout: { customerServiceUserMsgBgColor: color } });
                            markCurrentTempThemeCustomized();
                          }}
                          label="访客消息色"
                        />
                        <ColorPicker
                          value={tempLayout.customerServiceUserMsgTextColor || "#ffffff"}
                          textColor={tempLayout.customerServiceUserMsgTextColor || "#ffffff"}
                          surfaceColor={tempLayout.customerServiceUserMsgBgColor || "#2563eb"}
                          onChange={(color) => {
                            setTempLayout((current) => ({ ...current, customerServiceUserMsgTextColor: color }));
                            syncTempThemeOverride({ layout: { customerServiceUserMsgTextColor: color } });
                            markCurrentTempThemeCustomized();
                          }}
                          label="访客消息字"
                        />
                      </div>
                      <div
                        className="rounded-3xl border border-slate-700/60 p-4 shadow-lg"
                        style={{ backgroundColor: tempLayout.customerServicePanelBgColor || "#ffffff" }}
                      >
                        <div
                          className="flex items-center justify-between rounded-2xl px-3 py-2"
                          style={{
                            backgroundColor: tempLayout.customerServicePanelHeaderBgColor || "#3b82f6",
                            color: tempLayout.customerServicePanelHeaderTextColor || "#ffffff",
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-full"
                              style={{
                                backgroundColor: tempLayout.customerServiceLauncherBgColor || "#ffffff",
                                color: tempLayout.customerServiceLauncherIconColor || "#3b82f6",
                              }}
                            >
                              <MessageCircle className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className={DEFAULT_DIALOG_FIELD_TITLE_CLASS}>悬浮客服预览</div>
                              <div className="text-xs opacity-80">前台入口与聊天窗口同步这里的配色</div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          <div
                            className="mr-8 rounded-2xl px-3 py-2 text-sm"
                            style={{
                              backgroundColor: tempLayout.customerServiceAssistantMsgBgColor || "#ffffff",
                              color: tempLayout.customerServiceAssistantMsgTextColor || "#334155",
                            }}
                          >
                            您好，欢迎来到当前计划站点。
                          </div>
                          <div
                            className="ml-10 rounded-2xl px-3 py-2 text-sm"
                            style={{
                              backgroundColor: tempLayout.customerServiceUserMsgBgColor || "#2563eb",
                              color: tempLayout.customerServiceUserMsgTextColor || "#ffffff",
                            }}
                          >
                            我想先看看产品方案。
                          </div>
                          <div
                            className="mt-2 rounded-2xl border px-3 py-2 text-xs"
                            style={{
                              borderColor: tempLayout.customerServiceInputBorderColor || "#93c5fd",
                              color: tempLayout.customerServiceAssistantMsgTextColor || "#334155",
                            }}
                          >
                            输入框预览
                          </div>
                        </div>
                      </div>
                    </div>
                  </LayoutSectionCard>

                </div>
                  </SortableContext>
                </DndContext>
                </ScrollArea>
              </div>
            </TabsContent>
            ) : null}

            {/* Tab 4: Sound + Customer Service */}
            {activeSettingsTab === "service" ? (
            <TabsContent value="service" data-product-market-settings-page-content="true" className="template-config-service-panel m-0 h-full min-h-0 w-full flex-col overflow-hidden !mt-0 flex">
              {/* 客服音效与运营市场共用唯一表内壳，统一承接边界、底部圆角和滚动安全区。 */}
              <div
                data-product-market-table-shell="true"
                data-product-market-table-header-mode={servicePanelCollapsed ? "collapsed" : "expanded"}
                data-development-standard-frame-region="table-shell"
                data-development-standard-frame-label="表内"
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              >
              <ScrollArea
                data-shared-layout-section="list"
                data-shared-scroll-contract="table-inner-60"
                data-page-list
                data-page-list-scroll-owner
                data-development-standard-frame-region="content"
                data-development-standard-frame-label="内容"
                data-development-standard-marker-placement={servicePanelCollapsed ? "content-start" : "content-delegated"}
                className="nav-matrix-body min-h-0 w-full flex-1"
              >
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => {
                    const { active, over } = event;
                    if (!over || active.id === over.id) return;
                    const oldIndex = sortableCustomerServiceSections.findIndex((section) => section.id === String(active.id));
                    const newIndex = sortableCustomerServiceSections.findIndex((section) => section.id === String(over.id));
                    if (oldIndex === -1 || newIndex === -1) return;
                    setTempCustomerServiceSections((current) => {
                      const fixedSection = current.find((section) => section.id === "service-switches");
                      const movable = current.filter((section) => section.id !== "service-switches");
                      const reordered = arrayMove(movable, oldIndex, newIndex);
                      return fixedSection ? [fixedSection, ...reordered] : reordered;
                    });
                  }}
                >
                  <SortableContext items={sortableCustomerServiceSections.map((section) => section.id)} strategy={rectSortingStrategy}>
                <div data-template-config-card-list="true" className="flex w-full flex-col">
                    <input
                      ref={csAvatarUploadRef}
                      type="file"
                      accept={getMediaUploadAccept(["image", "video"])}
                      className="hidden"
                      onChange={handleCsAvatarUpload}
                    />
                    <input
                      ref={csFemaleVoiceUploadRef}
                      type="file"
                      accept={getMediaUploadAccept(["audio", "image"])}
                      className="hidden"
                      onChange={(event) => void handleCsGenderVoiceUpload(event, "female")}
                    />
                    <input
                      ref={csMaleVoiceUploadRef}
                      type="file"
                      accept={getMediaUploadAccept(["audio", "image"])}
                      className="hidden"
                      onChange={(event) => void handleCsGenderVoiceUpload(event, "male")}
                    />
                    <input
                      ref={csSoundUploadRef}
                      type="file"
                      accept={getMediaUploadAccept(["audio", "image"])}
                      className="hidden"
                      onChange={handleCsReminderSoundUpload}
                    />

                    {!servicePanelCollapsed ? (
                      <div
                        data-service-shared-color-contract="true"
                        data-shared-layout-section="header"
                        data-page-table-header
                        data-responsive-semantic-band="table-header"
                        data-responsive-shared-surface="table-header"
                        data-responsive-shared-surface-plugin="large-band-density"
                        data-template-config-service-header="true"
                        data-product-market-service-header-mode="audio"
                        data-development-standard-small-card-marker-policy={SHARED_SMALL_CARD_MARKER_POLICY}
                        data-development-standard-frame-region="table-header"
                        data-development-standard-frame-label="表头"
                        className="template-config-service-switches sticky top-0 z-20 border shadow-lg backdrop-blur"
                      >
                        <div data-responsive-capacity-row="service-header" className="mb-2 items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h3 className={`flex items-center gap-2 ${DEFAULT_DIALOG_SECTION_TITLE_CLASS}`}>
                                {soundEnabled
                                  ? <Volume2 data-service-sound-icon="action" className="h-4 w-4" style={{ color: serviceVolumeActionColor }} />
                                  : <VolumeX data-service-sound-icon="muted" className="h-4 w-4" style={{ color: serviceVolumeMutedColor }} />}
                                开关客音
                              </h3>
                              <span data-responsive-capacity-secondary-copy className={DEFAULT_DIALOG_META_TEXT_CLASS}>顶部这一栏固定显示基础开关，只控制共享模板初始链或当前计划的基础状态。</span>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setServicePanelCollapsed(true)}
                            className="h-8 px-3 text-xs hover:opacity-95"
                            style={{
                              borderColor: "color-mix(in srgb, var(--tradepro-panel-action-text) 42%, transparent)",
                              backgroundColor: "var(--tradepro-panel-action-bg)",
                              color: "var(--tradepro-panel-action-text)",
                            }}
                          >
                            <ChevronUp className="mr-1.5 h-3.5 w-3.5" />
                            收起客音
                          </Button>
                        </div>

                          <div data-customer-service-shared-track="true" data-responsive-capacity-grid="service-controls" className="grid gap-2">
                            {[
                              {
                                title: "启用客服",
                                desc: "控制计划右下角客服是否显示。",
                                enabled: csEnabled,
                                onToggle: () => handleSetCsEnabled(!csEnabled),
                              },
                              {
                                title: "启用客服出现声音",
                                desc: "客服出现消息发送时播放声音。",
                                enabled: soundEnabled,
                                onToggle: () => handleSetSoundEnabled(!soundEnabled),
                              },
                            ].map((item) => (
                              <div
                                key={item.title}
                                data-template-config-service-control="true"
                                data-shared-small-card-surface="true"
                                data-shared-small-card-text
                                data-development-standard-frame-region="small-card"
                                data-development-standard-frame-label="小卡片"
                                className="rounded-xl border px-2.5 py-2.5"
                                style={{
                                  backgroundColor: "var(--tradepro-shared-list-bg, var(--tradepro-panel-list-bg))",
                                  color: "var(--tradepro-shared-list-text, var(--tradepro-panel-list-text))",
                                  borderColor: "var(--tradepro-shared-list-border, var(--tradepro-shell-border))",
                                }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <Label className={DEFAULT_DIALOG_FIELD_TITLE_CLASS} style={{ color: "var(--tradepro-shared-list-text, var(--tradepro-panel-list-text))" }}>{item.title}</Label>
                                    <p className={`mt-1 ${DEFAULT_DIALOG_HELPER_TEXT_CLASS}`} style={{ color: "color-mix(in srgb, var(--tradepro-shared-list-text, var(--tradepro-panel-list-text)) 78%, transparent)" }}>{item.desc}</p>
                                  </div>
                                  <ContentPluginToggle label={item.title} checked={item.enabled} onCheckedChange={item.onToggle} className="mt-0.5" />
                                </div>
                              </div>
                            ))}

                            <div
                              data-template-config-service-control="true"
                              data-shared-small-card-surface="true"
                              data-shared-small-card-text
                              data-development-standard-frame-region="small-card"
                              data-development-standard-frame-label="小卡片"
                              className={`rounded-xl border px-2.5 py-2.5 transition-opacity duration-200 ${
                                soundEnabled ? "opacity-100" : "pointer-events-none opacity-40"
                              }`}
                              style={{
                                backgroundColor: "var(--tradepro-shared-list-bg, var(--tradepro-panel-list-bg))",
                                color: "var(--tradepro-shared-list-text, var(--tradepro-panel-list-text))",
                                borderColor: "var(--tradepro-shared-list-border, var(--tradepro-shell-border))",
                              }}
                            >
                              <Label className={DEFAULT_DIALOG_FIELD_TITLE_CLASS} style={{ color: "var(--tradepro-shared-list-text, var(--tradepro-panel-list-text))" }}>客服出现音量</Label>
                              <div data-service-volume-control="true" className="mt-2 flex items-center gap-2">
                                <VolumeX data-service-volume-icon="muted" className="h-3.5 w-3.5 flex-shrink-0" style={{ color: serviceVolumeMutedColor }} />
                                <Slider
                                  data-customer-service-shared-slider="volume"
                                  value={[soundVolume]}
                                  onValueChange={(val) => {
                                    const nextVolume = val[0];
                                    handleSetSoundVolume(nextVolume);
                                    setSoundPreviewVolume(nextVolume);
                                    playClickSoundWithConfig("click", {
                                      enabled: true,
                                      style: selectedReminderSoundStyleKey,
                                      volume: nextVolume,
                                    });
                                    window.clearTimeout((window as typeof window & { __pmSoundPreviewTimer?: number }).__pmSoundPreviewTimer);
                                    (window as typeof window & { __pmSoundPreviewTimer?: number }).__pmSoundPreviewTimer = window.setTimeout(() => {
                                      setSoundPreviewVolume(null);
                                    }, 240);
                                  }}
                                  min={0}
                                  max={1}
                                  step={0.05}
                                  className="flex-1"
                                />
                                <Volume2 data-service-volume-icon="action" className="h-3.5 w-3.5 flex-shrink-0" style={{ color: serviceVolumeActionColor }} />
                                <span className="w-10 text-right font-mono text-xs" style={{ color: "var(--tradepro-shared-list-text, var(--tradepro-panel-list-text))" }}>
                                  {Math.round((soundPreviewVolume ?? soundVolume) * 100)}%
                                </span>
                              </div>
                            </div>

                            <div
                              data-template-config-service-control="true"
                              data-shared-small-card-surface="true"
                              data-shared-small-card-text
                              data-development-standard-frame-region="small-card"
                              data-development-standard-frame-label="小卡片"
                              className="rounded-xl border px-2.5 py-2.5"
                              style={{
                                backgroundColor: "var(--tradepro-shared-list-bg, var(--tradepro-panel-list-bg))",
                                color: "var(--tradepro-shared-list-text, var(--tradepro-panel-list-text))",
                                borderColor: "var(--tradepro-shared-list-border, var(--tradepro-shell-border))",
                              }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <Label className={DEFAULT_DIALOG_FIELD_TITLE_CLASS} style={{ color: "var(--tradepro-shared-list-text, var(--tradepro-panel-list-text))" }}>启用真人朗音</Label>
                                  <p className={`mt-1 ${DEFAULT_DIALOG_HELPER_TEXT_CLASS}`} style={{ color: "color-mix(in srgb, var(--tradepro-shared-list-text, var(--tradepro-panel-list-text)) 78%, transparent)" }}>客服回复浏览器本地语音朗读。</p>
                                </div>
                                <ContentPluginToggle label="启用真人朗音" checked={csVoiceEnabled} onCheckedChange={handleSetCsVoiceEnabled} className="mt-0.5" />
                              </div>
                            </div>
                          </div>
                      </div>
                    ) : null}

                    <div
                      data-development-standard-frame-region={servicePanelCollapsed ? undefined : "content"}
                      data-development-standard-frame-label={servicePanelCollapsed ? undefined : "内容"}
                      data-development-standard-marker-placement={servicePanelCollapsed ? undefined : "content-card-start"}
                      className="min-w-0"
                    >
                    <SortableCustomerServiceSection
                      section={getTempCustomerServiceSection("service-select-avatar")}
                      index={Math.max(customerServiceSectionOrder("service-select-avatar") - 1, 0)}
                      total={sortableCustomerServiceSections.length}
                      onMove={moveTempCustomerServiceSection}
                      order={customerServiceSectionOrder("service-select-avatar")}
                      responsiveMode={defaultDialogResponsiveMode}
                    >
                      <div
                        data-customer-service-shared-track="true"
                        className={`template-config-service-workspace template-config-service-avatar-workspace transition-opacity duration-200 ${
                          csEnabled ? "opacity-100" : "pointer-events-none opacity-40"
                        }`}
                      >
                        {!csEnabled ? <div className="mb-2 text-xs text-amber-300">请启用客服</div> : null}
                        <div data-responsive-capacity-grid="service-experts" data-responsive-mobile-collection="record-list" className="grid gap-3">
                          {orderedCustomerServiceAvatars.map((preset) => {
                            const textDraft = tempCsAvatarTextOverrides[preset.id];
                            const previewOverride = textDraft
                              ? { ...csAvatarOverrides[preset.id], ...textDraft }
                              : csAvatarOverrides[preset.id];
                            const expertProfile = resolveCustomerServiceExpertProfile(preset, previewOverride);
                            const avatarPreview = avatarPreviewMap[preset.id];
                            const sequenceMatch = resolveCustomerServiceExpertSequenceMatch(
                              preset.id,
                              csAvatarOverrides[preset.id],
                              { reminderStyle: soundStyle },
                            );
                            const voicePreset = getCustomerServiceVoicePreset(
                              sequenceMatch.voiceStyleKey,
                              sequenceMatch.voiceGender,
                            );
                            return (
                            <button
                              key={preset.id}
                              data-customer-service-expert-card="true"
                              data-customer-service-expert-order={String(preset.order || 0).padStart(2, "0")}
                              data-customer-service-expert-voice-style={sequenceMatch.voiceStyleKey}
                              data-customer-service-expert-voice-gender={sequenceMatch.voiceGender}
                              data-customer-service-expert-animation-style={sequenceMatch.animationStyle}
                              data-customer-service-expert-reminder-style={sequenceMatch.reminderStyleKey}
                              data-responsive-capacity-card="expert-summary"
                              data-responsive-structure-item="expert"
                              data-shared-small-card-surface="true"
                              data-shared-small-card-text
                              data-shared-selection-control="true"
                              aria-pressed={csAvatarId === preset.id}
                              data-selected={csAvatarId === preset.id}
                              data-development-standard-frame-region="small-card"
                              data-development-standard-frame-label="小卡片"
                              onClick={() => handleSetCsAvatarId(preset.id)}
                              title={`${String(preset.order || 0).padStart(2, "0")}.${preset.name}：用于 ${PRODUCT_MODULE_CATEGORIES.find((item) => item.key === preset.categoryKey)?.label || "分类"} 的客服悬浮入口、聊天窗口与音效设置。`}
                              className={`rounded-xl border p-2.5 text-left transition-all duration-200 ${
                                csAvatarId === preset.id
                                  ? "shadow-sm"
                                  : "hover:brightness-[1.03]"
                              }`}
                              style={{
                                backgroundColor: csAvatarId === preset.id
                                  ? "var(--tradepro-shared-selection-bg)"
                                  : "var(--tradepro-panel-card-bg)",
                                borderColor: csAvatarId === preset.id
                                  ? "var(--tradepro-shared-selection-outline)"
                                  : "var(--tradepro-surface-border)",
                                color: csAvatarId === preset.id
                                  ? "var(--tradepro-shared-selection-text)"
                                  : "var(--tradepro-panel-card-text)",
                              }}
                            >
                              <ExpertIdentitySummary
                                variant="small"
                                expertId={preset.id}
                                projection="select-expert-card"
                                data={{
                                  name: expertProfile.assignmentLabel,
                                  customerServiceName: expertProfile.customerServiceName,
                                  title: expertProfile.title,
                                  gender: sequenceMatch.voiceGender === "male" ? "男声" : "女声",
                                  animation: CS_ANIMATION_OPTIONS.find((item) => item.value === sequenceMatch.animationStyle)?.label || "脉冲",
                                  reminder: getCustomerServiceReminderPreset(
                                    sequenceMatch.reminderStyleKey,
                                  )?.label || "默认",
                                  voice: voicePreset.label || "未设置",
                                  greeting: expertProfile.greetingDisplay,
                                }}
                                  avatar={
                                  <div className="shared-expert-identity-avatar-media">
                                    <CustomerServiceAvatarMedia
                                      sourceUrl={avatarPreview?.url}
                                      sourceKind={avatarPreview?.kind}
                                      fallbackUrl={preset.defaultAvatarUrl}
                                      alt={`${preset.name}头像`}
                                      fallback={<UserCircle className="h-6 w-6" style={{ color: preset.color }} />}
                                    />
                                  </div>
                                }
                              />
                            </button>
                            );
                          })}
                        </div>
                      </div>
                    </SortableCustomerServiceSection>
                    </div>

                    <SortableCustomerServiceSection
                      section={getTempCustomerServiceSection("service-avatar-customize")}
                      index={Math.max(customerServiceSectionOrder("service-avatar-customize") - 1, 0)}
                      total={sortableCustomerServiceSections.length}
                      onMove={moveTempCustomerServiceSection}
                      order={customerServiceSectionOrder("service-avatar-customize")}
                      responsiveMode={defaultDialogResponsiveMode}
                    >
                      <div
                        data-shared-expert-control-edge-contract="eight-pixel-inline-v1"
                        data-customer-service-shared-track="true"
                        className={`template-config-service-workspace template-config-service-voice-workspace transition-opacity duration-200 ${
                          csVoiceEnabled ? "opacity-100" : "pointer-events-none opacity-40"
                        }`}
                      >
                        {!csVoiceEnabled ? <div className="mb-2 text-xs text-amber-300">请启用真人朗音</div> : null}

                        <div className="space-y-1.5">
                              <div
                                data-current-expert-voice-layout
                                data-current-expert-capacity-contract="selection-card-auto-fit-v1"
                                data-current-expert-card-marker-scope="avatar-preview-first"
                                className="grid gap-2.5 sm:grid-cols-[minmax(184px,208px)_minmax(0,1fr)] xl:grid-cols-[minmax(224px,240px)_minmax(0,1fr)]"
                              >
                                <div
                                  data-current-expert-avatar-preview="true"
                                  data-development-standard-frame-region="small-card"
                                  data-development-standard-frame-label="小卡片"
                                  data-development-standard-marker-placement="card-left-top"
                                  data-shared-small-card-surface="true"
                                  className="template-config-service-avatar-preview rounded-xl border p-2"
                                  style={{
                                    backgroundColor: "var(--tradepro-panel-card-bg)",
                                    color: "var(--tradepro-panel-card-text)",
                                    borderColor: "color-mix(in srgb, var(--tradepro-panel-card-text) 22%, transparent)",
                                  }}
                                >
                                  <ExpertIdentitySummary
                                    variant="editor"
                                    compactCopy
                                    expertId={selectedAvatarPreset?.id}
                                    projection="current-expert-editor"
                                    data={{
                                      name: selectedAvatarExpertProfile?.assignmentLabel || "00.专家",
                                      customerServiceName: selectedAvatarExpertProfile?.customerServiceName || "专家",
                                      title: selectedAvatarExpertProfile?.title || "专业",
                                      gender: selectedAvatarVoiceGender === "male" ? "男声" : "女声",
                                      animation: selectedAnimationLabel,
                                      reminder: selectedReminderSoundLabel,
                                      voice: selectedAvatarVoiceEnabled ? selectedAvatarVoicePreset.label : "关闭",
                                      greeting: selectedAvatarExpertProfile?.greetingDisplay || "未设置",
                                    }}
                                    avatar={
                                      <div className={`shared-expert-identity-avatar-media ${getCustomerServiceAnimationClass(selectedAvatarSequenceMatch.animationStyle)}`}>
                                        <CustomerServiceAvatarMedia
                                          sourceUrl={selectedAvatarPreview?.url}
                                          sourceKind={selectedAvatarPreview?.kind}
                                          fallbackUrl={selectedAvatarPreset?.defaultAvatarUrl}
                                          alt={`${selectedAvatarPreset?.name || "当前客服"}头像`}
                                          fallback={<UserCircle className="h-12 w-12" style={{ color: selectedAvatarPreset?.color || tempLayout.themePanelButtonColor }} />}
                                        />
                                      </div>
                                    }
                                  />
                                </div>

                            <div
                              data-shared-expert-settings-stack="true"
                              data-current-expert-settings-panel="true"
                              className="grid gap-2.5"
                            >
                              <div data-responsive-capacity-grid="service-fields" className="template-config-service-field-pair template-config-service-primary-field-pair grid gap-2.5">
                                <div
                                  data-development-standard-frame-region="small-card"
                                  data-development-standard-frame-label="小卡片"
                                  data-page-card-size="small"
                                  data-shared-small-card-surface="true"
                                  data-shared-small-card-text
                                  className="template-config-service-voice-field template-config-service-primary-field-shell rounded-md border px-2.5 py-2"
                                  style={{ backgroundColor: defaultDialogPanelFill, borderColor: defaultDialogSoftBorder }}
                                >
                                  <div data-shared-expert-control-gap="true" className="flex flex-wrap items-center gap-1.5">
                                    <div className={`template-config-service-field-label template-config-service-primary-field-label self-start flex h-8 shrink-0 items-center justify-center px-1.5 text-center sm:h-9 ${DEFAULT_DIALOG_FIXED_FUNCTION_TITLE_CLASS}`} style={{ color: "var(--tradepro-panel-card-text)" }}>
                                      头像
                                    </div>
                                    <button
                                      type="button"
                                      data-customer-service-small-card-choice="true"
                                      onClick={() => openMaterialPicker({
                                        type: "avatar",
                                        avatarId: csAvatarId,
                                        title: "专家头像素材",
                                        description: "图片和动态上传后标准化为250X250；默认专家固定01–12，备用头像固定13–15，新上传专家从16顺延编号，也可直接替换专家，支持大小(≤2MB)。",
                                        allowedKinds: ["image", "video"],
                                        emptyText: `头像素材库始终保留内置头像；也可点击“上传女性新专家”或“上传男性新专家”添加自定义素材。`,
                                      })}
                                      className={`template-config-service-avatar-upload template-config-service-primary-field-control flex h-8 shrink-0 items-center justify-start rounded-md border px-2.5 text-left ${DEFAULT_DIALOG_CONTENT_TEXT_CLASS} transition-all hover:brightness-105 sm:h-9 sm:px-3 ${
                                        selectedAvatarHasCustomMaterial
                                          ? "border-red-700/70 bg-red-500/15 text-red-300"
                                          : "text-slate-100"
                                      }`}
                                      style={
                                        selectedAvatarHasCustomMaterial
                                          ? undefined
                                          : {
                                              borderColor: "color-mix(in srgb, var(--tradepro-panel-card-text) 22%, transparent)",
                                              backgroundColor: "var(--tradepro-panel-card-bg)",
                                              color: "var(--tradepro-panel-card-text)",
                                            }
                                      }
                                    >
                                      {selectedAvatarHasCustomMaterial ? "替换头像" : "上传:≤2M"}
                                    </button>
                                    <button
                                      type="button"
                                      data-shared-expert-control-edge="true"
                                      aria-label="清除自定义头像"
                                      title={selectedAvatarHasCustomMaterial ? "清除自定义头像并恢复默认头像" : "当前为默认头像，无可清除的自定义素材"}
                                      disabled={!selectedAvatarHasCustomMaterial}
                                      onClick={() => void handleClearCsAvatar(csAvatarId)}
                                      className={`flex h-8 shrink-0 items-center justify-center rounded-md border px-2 ${DEFAULT_DIALOG_CONTENT_TEXT_CLASS} disabled:cursor-not-allowed disabled:opacity-45 sm:h-9`}
                                      style={{
                                        borderColor: "color-mix(in srgb, var(--tradepro-panel-card-text) 22%, transparent)",
                                        backgroundColor: "var(--tradepro-panel-card-bg)",
                                        color: "var(--tradepro-panel-card-text)",
                                      }}
                                    >
                                      清除
                                    </button>
                                  </div>
                                </div>
                                <div
                                  data-development-standard-frame-region="small-card"
                                  data-development-standard-frame-label="小卡片"
                                  data-page-card-size="small"
                                  data-customer-service-voice-field="true"
                                  data-shared-small-card-surface="true"
                                  data-shared-small-card-text
                                  className="template-config-service-voice-field rounded-md border px-2.5 py-2 xl:col-span-2"
                                  style={{ backgroundColor: defaultDialogPanelFill, borderColor: defaultDialogSoftBorder }}
                                >
                                  <div className="template-config-service-inline-control flex items-center gap-1.5">
                                    <div className={`template-config-service-field-label flex h-8 min-w-[3rem] shrink-0 items-center justify-center px-1 text-center sm:h-9 ${DEFAULT_DIALOG_FIXED_FUNCTION_TITLE_CLASS}`} style={{ color: "var(--tradepro-panel-card-text)" }}>
                                      客音
                                    </div>
                                    <div
                                      className={`template-config-service-voice-options flex h-8 min-w-0 flex-1 flex-nowrap items-center gap-2 transition-opacity sm:gap-2.5 ${
                                        selectedAvatarVoiceEnabled
                                          ? ""
                                          : "opacity-60"
                                      }`}
                                    >
                                      <div data-shared-expert-control-edge="true" className="flex h-8 shrink-0 items-center gap-1 rounded-md border px-1.5" style={{ borderColor: "color-mix(in srgb, var(--tradepro-panel-card-text) 42%, transparent)", backgroundColor: "var(--tradepro-panel-card-bg)" }}>
                                        <span className={DEFAULT_DIALOG_CONTENT_TEXT_CLASS + " shrink-0"} style={{ color: defaultDialogSoftTextColor }}>开关</span>
                                        <ContentPluginToggle
                                          data-customer-service-shared-toggle="true"
                                          label="客音"
                                          checked={selectedAvatarVoiceEnabled}
                                          onCheckedChange={handleSetAvatarVoiceEnabled}
                                        />
                                      </div>
                                      <div data-shared-expert-control-edge="true" className="template-config-service-voice-rate-control flex h-8 min-w-[8rem] items-center gap-1.5 rounded-md border px-1.5" style={{ borderColor: "color-mix(in srgb, var(--tradepro-panel-card-text) 42%, transparent)", backgroundColor: "var(--tradepro-panel-card-bg)" }}>
                                        <span className={DEFAULT_DIALOG_CONTENT_TEXT_CLASS + " shrink-0"} style={{ color: defaultDialogSoftTextColor }}>语速</span>
                                        <Slider
                                          data-customer-service-shared-slider="voice-rate"
                                          value={[selectedAvatarVoiceRate]}
                                          onValueChange={(val) => {
                                            handleSetAvatarVoiceRate(val[0]);
                                          }}
                                          onValueCommit={(val) => {
                                            void playVoiceRatePreview(val[0]);
                                          }}
                                          disabled={!selectedAvatarVoiceEnabled}
                                          min={0.75}
                                          max={1.5}
                                          step={0.05}
                                          className="flex-1"
                                        />
                                        <span className={`${DEFAULT_DIALOG_CONTENT_TEXT_CLASS} w-10 text-right font-mono sm:w-12`} style={{ color: selectedAvatarVoiceEnabled ? defaultDialogMutedTextColor : defaultDialogSoftTextColor }}>
                                          {selectedAvatarVoiceRate.toFixed(2)}x
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div data-responsive-capacity-grid="service-fields" className="template-config-service-field-pair template-config-service-primary-field-pair grid gap-2.5">
                                <div
                                  data-development-standard-frame-region="small-card"
                                  data-development-standard-frame-label="小卡片"
                                  data-page-card-size="small"
                                  data-shared-small-card-surface="true"
                                  data-shared-small-card-text
                                  className="template-config-service-voice-field template-config-service-primary-field-shell flex min-h-[54px] items-center rounded-md border px-2.5 py-2"
                                  style={{ backgroundColor: defaultDialogPanelFill, borderColor: defaultDialogSoftBorder }}
                                >
                                  <div data-shared-expert-control-gap="true" className="flex flex-wrap items-center gap-1.5">
                                    <div className={`template-config-service-field-label template-config-service-primary-field-label self-start flex h-8 shrink-0 items-center justify-center px-1.5 text-center sm:h-9 ${DEFAULT_DIALOG_FIXED_FUNCTION_TITLE_CLASS}`} style={{ color: "var(--tradepro-panel-card-text)" }}>
                                      名称
                                    </div>
                                    <Input
                                      value={selectedAvatarDisplayNameDraft}
                                      onChange={(event) => {
                                        const nextValue = event.target.value;
                                        setTempCsAvatarTextOverrides((current) => ({
                                          ...current,
                                          [csAvatarId]: {
                                            displayName: nextValue,
                                            greetingText: current[csAvatarId]?.greetingText ?? selectedAvatarOverride?.greetingText ?? "",
                                          },
                                        }));
                                      }}
                                      placeholder="例如：猛男客服阿力"
                                      className={`h-8 min-w-0 flex-1 ${DEFAULT_DIALOG_CONTENT_INPUT_TEXT_CLASS} sm:h-9`}
                                      style={{ borderColor: defaultDialogSoftBorder, backgroundColor: defaultDialogContentFill, color: defaultDialogTextColor }}
                                    />
                                  </div>
                                </div>
                                <div
                                  data-development-standard-frame-region="small-card"
                                  data-development-standard-frame-label="小卡片"
                                  data-page-card-size="small"
                                  data-shared-small-card-surface="true"
                                  data-shared-small-card-text
                                  className="template-config-service-voice-field rounded-md border px-2.5 py-2 xl:col-span-2"
                                  style={{ backgroundColor: defaultDialogPanelFill, borderColor: defaultDialogSoftBorder }}
                                >
                                  <div data-shared-expert-control-gap="true" className="flex flex-wrap items-center gap-1.5">
                                    <div className={`template-config-service-field-label self-start flex h-8 min-w-[3rem] shrink-0 items-center justify-center px-1 text-center sm:h-9 ${DEFAULT_DIALOG_FIXED_FUNCTION_TITLE_CLASS}`} style={{ color: "var(--tradepro-panel-card-text)" }}>
                                      招呼
                                    </div>
                                    <Input
                                      value={selectedAvatarGreetingTextDraft}
                                      onChange={(event) => {
                                        const nextValue = event.target.value;
                                        setTempCsAvatarTextOverrides((current) => ({
                                          ...current,
                                          [csAvatarId]: {
                                            displayName: current[csAvatarId]?.displayName ?? selectedAvatarOverride?.displayName ?? "",
                                            greetingText: nextValue,
                                          },
                                        }));
                                      }}
                                      placeholder="例如：您好，我来协助您了解产品与合作方案。"
                                      className={`h-8 min-w-0 flex-1 ${DEFAULT_DIALOG_CONTENT_INPUT_TEXT_CLASS} sm:h-9`}
                                      style={{ borderColor: defaultDialogSoftBorder, backgroundColor: defaultDialogContentFill, color: defaultDialogTextColor }}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div data-responsive-capacity-grid="service-fields" className="template-config-service-field-pair template-config-service-primary-field-pair grid gap-2.5">
                                <div
                                  data-development-standard-frame-region="small-card"
                                  data-development-standard-frame-label="小卡片"
                                  data-page-card-size="small"
                                  data-shared-small-card-surface="true"
                                  data-shared-small-card-text
                                  className="template-config-service-voice-field template-config-service-primary-field-shell rounded-md border px-2.5 py-2"
                                  style={{ backgroundColor: defaultDialogPanelFill, borderColor: defaultDialogSoftBorder }}
                                >
                                    <div className="template-config-service-inline-control flex w-full translate-y-px items-center gap-1.5">
                                      <div className={`template-config-service-field-label template-config-service-primary-field-label self-start flex h-8 shrink-0 items-center justify-center px-1.5 text-center sm:self-auto ${DEFAULT_DIALOG_FIXED_FUNCTION_TITLE_CLASS}`} style={{ color: "var(--tradepro-panel-card-text)" }}>
                                        朗音
                                      </div>
                                      <button
                                        type="button"
                                        data-customer-service-small-card-choice="true"
                                        data-customer-service-voice-replace="true"
                                        title={`直达${selectedAvatarVoiceGender === "male" ? "男性" : "女性"}声音分类`}
                                        onClick={() => openMaterialPicker({
                                          type: selectedAvatarVoiceGender === "male" ? "male-voice" : "female-voice",
                                          avatarId: csAvatarId,
                                          voiceGender: selectedAvatarVoiceGender,
                                          voiceStyleKey: selectedCurrentVoicePreset.key,
                                          title: selectedCurrentVoicePickerTitle,
                                          description: `${selectedCurrentVoicePickerDescription} 可上传或复用 250 × 250 朗音封面图片、音频进行替换，均不超过 2MB。`,
                                          allowedKinds: ["image", "audio"],
                                          emptyText: "暂无朗音素材；请上传朗音封面图片或朗读声音。",
                                        })}
                                        className={`template-config-service-voice-upload template-config-service-primary-field-control flex min-h-[34px] shrink-0 items-center rounded-md border px-2 py-1 text-left transition-all hover:brightness-105 ${DEFAULT_DIALOG_CONTENT_TEXT_CLASS} ${
                                          selectedCurrentVoiceOwnUploaded
                                            ? "border-red-700/70 bg-red-500/15 text-red-300 hover:bg-red-500/20"
                                            : ""
                                        }`}
                                        style={
                                          selectedCurrentVoiceOwnUploaded
                                            ? undefined
                                            : {
                                              borderColor: "color-mix(in srgb, var(--tradepro-panel-card-text) 22%, transparent)",
                                              backgroundColor: "var(--tradepro-panel-card-bg)",
                                              color: "var(--tradepro-panel-card-text)",
                                              }
                                        }
                                      >
                                        <div className="min-w-0 flex-1 text-left">
                                          <div className={`truncate font-medium ${DEFAULT_DIALOG_CONTENT_TEXT_CLASS}`} style={{ color: selectedCurrentVoiceOwnUploaded ? undefined : defaultDialogTextColor }}>
                                            {selectedCurrentVoiceOwnUploaded ? "管理朗音" : "替换朗音"}
                                          </div>
                                        </div>
                                      </button>
                                      <button
                                        type="button"
                                        data-customer-service-voice-clear="true"
                                        aria-label="清除自定义朗音"
                                        title={selectedCurrentVoiceOwnUploaded ? "清除当前音色的自定义朗音并恢复默认朗音" : "当前音色未使用自定义朗音"}
                                        disabled={!selectedCurrentVoiceOwnUploaded}
                                        onClick={() => void handleClearVoicePresetAsset(
                                          csAvatarId,
                                          selectedCurrentVoicePreset.key,
                                          selectedAvatarVoiceGender,
                                        )}
                                        className={`flex h-8 shrink-0 items-center justify-center rounded-md border px-2 ${DEFAULT_DIALOG_CONTENT_TEXT_CLASS} disabled:cursor-not-allowed disabled:opacity-45`}
                                        style={{
                                          borderColor: "color-mix(in srgb, var(--tradepro-panel-card-text) 22%, transparent)",
                                          backgroundColor: "var(--tradepro-panel-card-bg)",
                                          color: "var(--tradepro-panel-card-text)",
                                        }}
                                      >
                                        清除
                                      </button>
                                    </div>
                                  </div>
                                  <div
                                    data-development-standard-frame-region="small-card"
                                    data-development-standard-frame-label="小卡片"
                                    data-page-card-size="small"
                                    data-shared-small-card-surface="true"
                                    data-shared-small-card-text
                                    className="template-config-service-voice-field min-h-[54px] space-y-2 rounded-md border px-2.5 py-2 xl:col-span-2"
                                    style={{ backgroundColor: defaultDialogPanelFill, borderColor: defaultDialogSoftBorder }}
                                  >
                                    <div
                                      data-customer-service-gender-choices="true"
                                      data-shared-small-card-surface="true"
                                      data-shared-small-card-text
                                      className="template-config-service-voice-options flex w-full min-w-0 items-center"
                                      >
                                        <div data-shared-expert-control-gap="true" className="flex w-full flex-wrap items-center gap-1 sm:flex-nowrap sm:gap-1.5">
                                          <button
                                            type="button"
                                            data-customer-service-small-card-choice="true"
                                            data-shared-selection-control="true"
                                            data-selected={selectedAvatarVoiceGender === "female"}
                                            aria-pressed={selectedAvatarVoiceGender === "female"}
                                            title="选择女性声音；替换朗音会直达女性声音分类"
                                            onClick={() => handleSetAvatarVoiceGender("female")}
                                            className={`flex h-8 min-w-[58px] shrink-0 items-center justify-center whitespace-nowrap rounded-md border px-2 text-center font-medium leading-tight transition-all sm:min-w-[60px] sm:px-2.5 ${DEFAULT_DIALOG_CONTENT_TEXT_CLASS}`}
                                            style={
                                              selectedAvatarVoiceGender === "female"
                                                ? {
                                                    borderColor: "var(--tradepro-shared-selection-bg)",
                                                    backgroundColor: "var(--tradepro-shared-selection-bg)",
                                                    color: "var(--tradepro-shared-selection-text)",
                                                    boxShadow: "0 0 0 1px var(--tradepro-shared-selection-outline)",
                                                  }
                                                : { borderColor: "color-mix(in srgb, var(--tradepro-panel-card-text) 22%, transparent)", backgroundColor: "var(--tradepro-panel-card-bg)", color: "var(--tradepro-panel-card-text)" }
                                            }
                                          >
                                            女性
                                          </button>
                                          <button
                                            type="button"
                                            data-customer-service-small-card-choice="true"
                                            data-shared-selection-control="true"
                                            data-selected={selectedAvatarVoiceGender === "male"}
                                            aria-pressed={selectedAvatarVoiceGender === "male"}
                                            title="选择男性声音；替换朗音会直达男性声音分类"
                                            onClick={() => handleSetAvatarVoiceGender("male")}
                                            className={`flex h-8 min-w-[58px] shrink-0 items-center justify-center whitespace-nowrap rounded-md border px-2 text-center font-medium leading-tight transition-all sm:min-w-[60px] sm:px-2.5 ${DEFAULT_DIALOG_CONTENT_TEXT_CLASS}`}
                                            style={
                                              selectedAvatarVoiceGender === "male"
                                                ? {
                                                    borderColor: "var(--tradepro-shared-selection-bg)",
                                                    backgroundColor: "var(--tradepro-shared-selection-bg)",
                                                    color: "var(--tradepro-shared-selection-text)",
                                                    boxShadow: "0 0 0 1px var(--tradepro-shared-selection-outline)",
                                                  }
                                                : { borderColor: "color-mix(in srgb, var(--tradepro-panel-card-text) 22%, transparent)", backgroundColor: "var(--tradepro-panel-card-bg)", color: "var(--tradepro-panel-card-text)" }
                                            }
                                          >
                                            男性
                                          </button>
                                          <div
                                            className={`template-config-service-voice-status flex h-8 min-w-0 flex-1 items-center rounded-md border px-2 py-1 ${DEFAULT_DIALOG_CONTENT_TEXT_CLASS}`}
                                            data-selected={selectedCurrentVoiceUploaded}
                                            data-customer-service-voice-style={selectedCurrentVoicePreset.key}
                                            data-customer-service-voice-local-file={selectedCurrentVoicePreset.localAsset?.fileName}
                                            data-customer-service-voice-source={selectedCurrentVoiceOwnUploaded ? "replacement" : selectedCurrentVoiceUploaded ? "shared-replacement" : "local"}
                                            style={{
                                              borderColor: selectedCurrentVoiceUploaded ? tempLayout.themePanelButtonColor : "color-mix(in srgb, var(--tradepro-panel-card-text) 42%, transparent)",
                                              backgroundColor: selectedCurrentVoiceUploaded
                                                ? withAlpha(tempLayout.themePanelButtonColor, 0.18)
                                                : "var(--tradepro-panel-card-bg)",
                                              color: defaultDialogTextColor,
                                              boxShadow: selectedCurrentVoiceUploaded
                                                ? `0 0 0 1px ${withAlpha(tempLayout.themePanelButtonColor, 0.18)}`
                                                : "none",
                                            }}
                                            title={selectedCurrentVoiceStatusText}
                                          >
                                            <span className="truncate font-medium">{selectedCurrentVoiceStatusText}</span>
                                          </div>
                                          <button
                                            type="button"
                                            data-shared-expert-control-edge="play"
                                            data-customer-service-voice-preview="true"
                                            aria-label={
                                              activeVoicePreviewKey === activeCurrentVoicePreviewKey
                                                ? `暂停${selectedAvatarVoiceGender === "male" ? "男声" : "女声"}试听`
                                                : `播放${selectedAvatarVoiceGender === "male" ? "男声" : "女声"}试听`
                                            }
                                            onClick={() => {
                                              void playVoiceRatePreview(selectedCurrentVoicePreset.rate, selectedAvatarVoiceGender, selectedCurrentVoicePreset.key);
                                            }}
                                            className="flex h-8 w-[46px] shrink-0 items-center justify-center rounded-md border px-0 transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55 sm:w-[52px]"
                                            style={{
                                              borderColor:
                                                activeVoicePreviewKey === activeCurrentVoicePreviewKey
                                                  ? tempLayout.themePanelButtonColor
                                                  : "color-mix(in srgb, var(--tradepro-panel-card-text) 42%, transparent)",
                                              backgroundColor:
                                                activeVoicePreviewKey === activeCurrentVoicePreviewKey
                                                  ? withAlpha(tempLayout.themePanelButtonColor, 0.18)
                                                  : "var(--tradepro-panel-card-bg)",
                                              color: defaultDialogTextColor,
                                              boxShadow:
                                                activeVoicePreviewKey === activeCurrentVoicePreviewKey
                                                  ? `0 0 0 1px ${withAlpha(tempLayout.themePanelButtonColor, 0.18)}`
                                                  : "none",
                                            }}
                                            disabled={!selectedVoicePreviewText}
                                          >
                                            {activeVoicePreviewKey === activeCurrentVoicePreviewKey ? (
                                              <Square className="h-3 w-3 fill-current" />
                                            ) : (
                                              <Play className="h-3.5 w-3.5" />
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                              </div>
                                  <div
                                    data-development-standard-frame-region="small-card"
                                    data-development-standard-frame-label="小卡片"
                                    data-page-card-size="small"
                                    data-shared-small-card-surface="true"
                                data-shared-small-card-text
                                className="template-config-service-voice-field rounded-md border px-2.5 py-2"
                                style={{ backgroundColor: defaultDialogPanelFill, borderColor: defaultDialogSoftBorder }}
                              >
                                <div className="template-config-service-inline-control flex flex-col gap-1.5 sm:flex-row sm:items-center">
                                  <div className={`template-config-service-field-label self-start flex h-8 min-w-[3rem] shrink-0 items-center justify-center px-1 text-center sm:h-9 ${DEFAULT_DIALOG_FIXED_FUNCTION_TITLE_CLASS}`} style={{ color: "var(--tradepro-panel-card-text)" }}>
                                    效果
                                  </div>
                                  <div
                                    data-customer-service-animation-options="true"
                                    data-shared-small-card-surface="true"
                                    data-shared-small-card-text
                                    className="template-config-service-voice-options min-w-0 flex-1"
                                  >
                                    <div data-shared-responsive-wrap="service-animation-options" className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                                      {CS_ANIMATION_OPTIONS.map((option) => (
                                        <button
                                          key={option.value}
                                          data-customer-service-animation-option={option.value}
                                          data-customer-service-small-card-choice="true"
                                          data-shared-selection-control="true"
                                          data-selected={selectedAvatarSequenceMatch.animationStyle === option.value}
                                          aria-pressed={selectedAvatarSequenceMatch.animationStyle === option.value}
                                          onClick={() => handleSetCsAvatarOverride(csAvatarId, { animationStyle: option.value })}
                                          className={`shrink-0 rounded-full border px-2 py-0.5 transition-all sm:px-2.5 ${DEFAULT_DIALOG_CONTENT_TEXT_CLASS}`}
                                          style={
                                            selectedAvatarSequenceMatch.animationStyle === option.value
                                              ? {
                                                  borderColor: "var(--tradepro-shared-selection-bg)",
                                                  backgroundColor: "var(--tradepro-shared-selection-bg)",
                                                  color: "var(--tradepro-shared-selection-text)",
                                                  boxShadow: "0 0 0 1px var(--tradepro-shared-selection-outline)",
                                                }
                                              : { borderColor: "color-mix(in srgb, var(--tradepro-panel-card-text) 22%, transparent)", backgroundColor: "var(--tradepro-panel-card-bg)", color: "var(--tradepro-panel-card-text)" }
                                          }
                                        >
                                          {option.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </SortableCustomerServiceSection>

                    <SortableCustomerServiceSection
                      section={getTempCustomerServiceSection("service-reminder-sound")}
                      index={Math.max(customerServiceSectionOrder("service-reminder-sound") - 1, 0)}
                      total={sortableCustomerServiceSections.length}
                      onMove={moveTempCustomerServiceSection}
                      order={customerServiceSectionOrder("service-reminder-sound")}
                      responsiveMode={defaultDialogResponsiveMode}
                    >
                          <div
                            data-customer-service-shared-track="true"
                            data-customer-service-reminder-marker-scope="first-sound-card-left-top"
                            className={`template-config-service-workspace template-config-service-sound-workspace transition-opacity duration-200 ${
                              soundEnabled ? "opacity-100" : "pointer-events-none opacity-40"
                            }`}
                          >
                            <div className="space-y-3">
                              <div
                                data-customer-service-reminder-toolbar="true"
                                data-shared-small-card-surface="true"
                                data-shared-small-card-text
                                className="template-config-service-reminder-toolbar flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5"
                                style={{
                                  backgroundColor: "var(--tradepro-panel-card-bg)",
                                  color: "var(--tradepro-panel-card-text)",
                                  borderColor: "color-mix(in srgb, var(--tradepro-panel-card-text) 22%, transparent)",
                                }}
                              >
                                <Badge
                                  data-customer-service-small-card-choice="true"
                                  className="border"
                                  style={{
                                    backgroundColor: "var(--tradepro-panel-card-bg)",
                                    borderColor: "color-mix(in srgb, var(--tradepro-panel-card-text) 22%, transparent)",
                                    color: "var(--tradepro-panel-card-text)",
                                  }}
                                >
                                  {selectedReminderSoundLabel}
                                </Badge>
                                <button
                                  data-customer-service-small-card-choice="true"
                                  data-customer-service-reminder-replace="true"
                                  data-development-standard-frame-region="small-card"
                                  data-development-standard-frame-label="小卡片"
                                  data-page-card-size="small"
                                  title="直达提醒声音分类"
                                  onClick={() =>
                                    openMaterialPicker({
                                      type: "reminder-sound",
                                      avatarId: csAvatarId,
                                      soundStyleKey: selectedReminderSoundStyleKey,
                                      title: "选择提醒声音素材",
                                      description: "当前编号已配生肖默认声音与封面；可上传或复用 250 × 250 图片、音频进行替换，均不超过 2MB；清除后恢复本地默认。",
                                      allowedKinds: ["image", "audio"],
                                      emptyText: "暂无提醒素材，请先上传提醒封面图片或提醒声音。",
                                    })
                                  }
                                  className="template-config-service-reminder-edit h-8 rounded-md border px-3 text-sm transition-all hover:brightness-105"
                                  style={{ borderColor: "color-mix(in srgb, var(--tradepro-panel-card-text) 22%, transparent)", backgroundColor: "var(--tradepro-panel-card-bg)", color: "var(--tradepro-panel-card-text)" }}
                                >
                                  <Mic2 className="mr-1 inline h-3.5 w-3.5" />
                                  修改提醒音
                                </button>
                                {selectedReminderSoundPlaybackUrl ? (
                                  <audio
                                    controls
                                    data-customer-service-reminder-preview="true"
                                    preload="none"
                                    src={selectedReminderSoundPlaybackUrl}
                                    className="h-8 min-w-0 max-w-full flex-[1_1_12rem]"
                                  />
                                ) : null}
                                {!soundEnabled ? <span className="text-xs text-amber-300">请启用客服出现声音</span> : null}
                                {selectedReminderSoundPreviewForStyle?.url || selectedReminderSoundAsset.fileName ? (
                                  <button
                                    onClick={() => void handleClearCsReminderSound(csAvatarId)}
                                    className="h-8 rounded-md border border-red-700/70 px-3 text-sm text-red-300 hover:bg-red-900/20"
                                  >
                                    清除声音
                                  </button>
                                ) : null}
                              </div>
                              <DeferredViewportMediaGroup
                                data-responsive-capacity-grid="service-sounds"
                                className="template-config-service-sound-grid grid gap-2"
                              >
                                {(reminderCoversEnabled) => SOUND_STYLE_PRESETS.map((preset, soundIndex) => {
                                  const selected = selectedReminderSoundStyleKey === preset.key;
                                  const presetAsset = resolveReminderSoundAssetFields(selectedAvatarOverride, preset.key);
                                  const presetPreview = selectedAvatarReminderSoundPreview?.byStyle?.[preset.key];
                                  const hasUpload = Boolean(presetPreview?.url || presetAsset.fileName);
                                  const zodiacCover = preset.coverAsset;
                                  const selectAndPreview = () => {
                                    handleSetCsAvatarOverride(csAvatarId, { soundStyle: preset.key });
                                    playReminderSoundChoicePreview(preset.key, presetPreview?.url);
                                  };
                                  return (
                                    <div
                                      key={preset.key}
                                      role="button"
                                      tabIndex={0}
                                      aria-pressed={selected}
                                      data-development-standard-frame-region="small-card"
                                      data-development-standard-frame-label="小卡片"
                                      data-development-standard-marker-placement={soundIndex === 0 ? "card-left-top" : undefined}
                                      data-page-card-size="small"
                                      data-shared-small-card-surface="true"
                                      data-shared-small-card-text
                                      data-shared-selection-control="true"
                                      data-selected={selected}
                                      data-customer-service-reminder-style={preset.key}
                                      data-customer-service-reminder-marker-anchor={soundIndex === 0 ? "first-sound-card-left-top" : undefined}
                                      data-customer-service-reminder-local-file={preset.localAsset?.fileName}
                                      data-customer-service-reminder-source={hasUpload ? "replacement" : "local"}
                                      onClick={selectAndPreview}
                                      onKeyDown={(event) => {
                                        if (event.target !== event.currentTarget) return;
                                        if (event.key !== "Enter" && event.key !== " ") return;
                                        event.preventDefault();
                                        selectAndPreview();
                                      }}
                                      className="template-config-service-sound-choice cursor-pointer rounded-md border px-3 py-2 text-left transition-all duration-200 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                                      style={{
                                        borderColor: selected ? "var(--tradepro-shared-selection-outline)" : defaultDialogSoftBorder,
                                        backgroundColor: selected ? "var(--tradepro-shared-selection-bg)" : defaultDialogContentFill,
                                        color: selected ? "var(--tradepro-shared-selection-text)" : defaultDialogTextColor,
                                        boxShadow: selected ? "inset 0 0 0 1px var(--tradepro-shared-selection-outline)" : "none",
                                      }}
                                    >
                                      <div className="flex items-center gap-2">
                                        {preset.key === "bubble" ? (
                                          <Waves className="h-4 w-4" style={{ color: selected ? "var(--tradepro-shared-selection-text)" : defaultDialogMutedTextColor }} />
                                        ) : preset.key === "wooden" ? (
                                          <TreePine className="h-4 w-4" style={{ color: selected ? "var(--tradepro-shared-selection-text)" : defaultDialogMutedTextColor }} />
                                        ) : preset.key === "tech" ? (
                                          <Radio className="h-4 w-4" style={{ color: selected ? "var(--tradepro-shared-selection-text)" : defaultDialogMutedTextColor }} />
                                        ) : preset.key === "crisp" ? (
                                          <Mic2 className="h-4 w-4" style={{ color: selected ? "var(--tradepro-shared-selection-text)" : defaultDialogMutedTextColor }} />
                                        ) : preset.key === "soft" ? (
                                          <Headphones className="h-4 w-4" style={{ color: selected ? "var(--tradepro-shared-selection-text)" : defaultDialogMutedTextColor }} />
                                        ) : preset.key === "electronic" ? (
                                          <Radio className="h-4 w-4" style={{ color: selected ? "var(--tradepro-shared-selection-text)" : defaultDialogMutedTextColor }} />
                                        ) : zodiacCover ? (
                                          <span
                                            role="img"
                                            aria-label={`${preset.label}生肖封面`}
                                            data-customer-service-reminder-cover={preset.key}
                                            data-customer-service-reminder-cover-state={reminderCoversEnabled ? "requested" : "deferred"}
                                            className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-sm text-xs"
                                          >
                                            <span aria-hidden="true">{preset.icon}</span>
                                            {reminderCoversEnabled ? (
                                              <img
                                                src={zodiacCover.url}
                                                alt=""
                                                title={`${preset.label}生肖封面`}
                                                loading="lazy"
                                                decoding="async"
                                                fetchPriority="low"
                                                className="absolute inset-0 h-full w-full object-cover"
                                              />
                                            ) : null}
                                          </span>
                                        ) : (
                                          <span className="text-sm" style={{ color: selected ? "var(--tradepro-shared-selection-text)" : defaultDialogMutedTextColor }}>{preset.icon}</span>
                                        )}
                                        <div className={DEFAULT_DIALOG_FIELD_TITLE_CLASS} style={{ color: selected ? "var(--tradepro-shared-selection-text)" : "var(--tradepro-panel-card-text)" }}>
                                          {SOUND_STYLE_TEXT[preset.key]?.label || preset.key}
                                        </div>
                                        <span className="ml-auto text-[10px]" style={{ color: selected ? "var(--tradepro-shared-selection-text)" : defaultDialogMutedTextColor }}>
                                          {hasUpload ? "已替换" : "本地"}
                                        </span>
                                        {hasUpload ? (
                                          <button
                                            type="button"
                                            aria-label={`删除${SOUND_STYLE_TEXT[preset.key]?.label || preset.key}自定义提醒声音`}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              void handleClearReminderSoundPresetAsset(csAvatarId, preset.key);
                                            }}
                                            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-red-500/60 bg-red-500/15 text-red-300 transition-all hover:bg-red-500/25"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        ) : null}
                                      </div>
                                      <p className={`mt-1 ${DEFAULT_DIALOG_META_TEXT_CLASS}`} style={{ color: selected ? "color-mix(in srgb, var(--tradepro-shared-selection-text) 82%, transparent)" : "color-mix(in srgb, var(--tradepro-panel-card-text) 78%, transparent)" }}>
                                        {SOUND_STYLE_TEXT[preset.key]?.description || sanitizeDisplayText(preset.description, "客服提醒声音说明")}
                                      </p>
                                    </div>
                                  );
                                })}
                              </DeferredViewportMediaGroup>
                              <div
                                data-development-standard-frame-region="small-card"
                                data-development-standard-frame-label="小卡片"
                                data-page-card-size="small"
                                data-shared-small-card-surface="true"
                                data-shared-small-card-text
                                className="template-config-service-sound-note rounded-xl border px-3 py-2 text-xs"
                                style={{ borderColor: defaultDialogSoftBorder, backgroundColor: defaultDialogContentFill, color: "var(--tradepro-panel-card-text)" }}
                              >
                                {selectedReminderSoundPreviewForStyle?.fileName || selectedReminderSoundAsset.fileName
                                  ? `已上传专属提醒声音：${sanitizeDisplayText(selectedReminderSoundPreviewForStyle?.fileName || selectedReminderSoundAsset.fileName, "提醒声音")}`
                                  : `当前本地文件：${selectedReminderSoundPreset?.localAsset?.fileName || "默认合成音"}；点击“修改提醒音”可替换当前编号。`}
                              </div>
                            </div>
                          </div>
                    </SortableCustomerServiceSection>
                </div>
                  </SortableContext>
                </DndContext>
                </ScrollArea>
              </div>
            </TabsContent>
            ) : null}

            </div>
            {!templateSettingsSubview ? (
              <div
                className="template-config-footer flex h-12 shrink-0 items-center justify-between gap-2 border-t px-4 pr-14 sm:px-6 sm:pr-14"
                style={{
                  backgroundColor: defaultDialogTabListStyle.backgroundColor,
                  borderColor: defaultDialogTabListStyle.borderColor,
                }}
              >
                <PageFooterLockControls
                  compact
                  sourceLocked={templateSourceLocked}
                  pageLocked={productMarketHardLocked}
                  columnLocked={templateLayoutLocked}
                  onToggleSource={() => { void toggleTemplateSourceLock(); }}
                  onTogglePage={toggleTemplatePageLock}
                  onToggleColumn={toggleTemplateColumnLock}
                />
                <Button
                  type="button"
                  onClick={saveDefaults}
                  title="保存当前暂存的设置，并同步写入当前可用的模板配置。"
                  className="template-config-footer-save h-8 min-w-[112px] px-4 text-xs font-semibold sm:text-sm"
                  style={{
                    backgroundColor: tempLayout.defaultDialogButtonColor || "#2FB977",
                    color: tempLayout.defaultDialogButtonTextColor || "#F8FFFC",
                  }}
                >
                  保存并同步
                </Button>
              </div>
            ) : null}
          </Tabs>
          </div>
      </ProductMarketSettingsHost>

      {materialPickerTarget ? (
        <Suspense
          fallback={
            <div
              data-customer-service-material-picker-loading
              className="fixed left-1/2 top-1/2 z-[160] -translate-x-1/2 -translate-y-1/2 rounded-lg border px-4 py-3 text-sm font-medium shadow-xl"
              style={{ ...defaultDialogShellStyle, color: defaultDialogTextColor }}
            >
              正在启动素材库…
            </div>
          }
        >
          <CustomerServiceMaterialPickerDialog
            target={materialPickerTarget}
            entries={visibleMaterialPickerEntries}
            loading={materialAssetsLoading}
            avatarGenderFilter={avatarMaterialGenderFilter}
            audioCategory={audioMaterialCategory}
            avatarGenderFallback={materialPickerAvatarGenderFallback}
            restoreAvailable={Boolean(materialPickerRestoreState?.canRestore)}
            busyAssetId={materialAssetsBusyId}
            activePreviewAssetId={activeMaterialAssetPreviewId}
            durations={materialAssetDurations}
            dimensions={materialAssetDimensions}
            uploadAccept={materialAssetsUploadAccept}
            uploadRef={materialAssetsUploadRef}
            replaceRef={materialAssetReplaceUploadRef}
            replaceKind={materialAssetReplaceTarget?.kind}
            colors={{
              shellStyle: defaultDialogShellStyle,
              headerBg: tempLayout.defaultDialogHeaderBgColor || "#020617",
              headerText: tempLayout.defaultDialogHeaderTextColor || "#ffffff",
              softBorder: defaultDialogSoftBorder,
              contentFill: defaultDialogContentFill,
              panelFill: defaultDialogPanelFill,
              text: defaultDialogTextColor,
              mutedText: defaultDialogMutedTextColor,
              buttonBg: tempLayout.defaultDialogButtonColor || tempLayout.themePanelButtonColor,
              buttonText: tempLayout.defaultDialogButtonTextColor || "#ffffff",
              previewActiveBg: withAlpha(tempLayout.themePanelButtonColor, 0.18),
            }}
            sourceLocked={templateSourceLocked}
            pageLocked={productMarketHardLocked}
            columnLocked={templateLayoutLocked}
            onClose={closeMaterialPicker}
            onUploadChange={handleMaterialAssetUpload}
            onReplaceChange={handleReplaceStoredMaterialAsset}
            onAvatarGenderFilterChange={setAvatarMaterialGenderFilter}
            onAudioCategoryChange={(category) => {
              if (category === "all") {
                setAudioMaterialCategory("all");
                return;
              }
              const targetAvatarId = materialPickerTarget.avatarId || csAvatarId;
              if (category === "reminder-sound") {
                const reminderStyleKey = resolveCustomerServiceExpertSequenceMatch(
                  targetAvatarId,
                  csAvatarOverrides[targetAvatarId],
                  { reminderStyle: soundStyle },
                ).reminderStyleKey;
                openMaterialPicker({
                  type: "reminder-sound",
                  avatarId: targetAvatarId,
                  soundStyleKey: reminderStyleKey,
                  title: "选择提醒声音素材",
                  description: "提醒素材库可管理生肖封面与消息提示音；封面自动标准化为 250 × 250，均不超过 2MB。",
                  allowedKinds: ["image", "audio"],
                  emptyText: "暂无提醒素材，请上传封面图片或第一条提醒声音。",
                });
                return;
              }
              const gender = category === "male-voice" ? "male" : "female";
              const preset = getCustomerServiceVoicePreset(
                resolveCustomerServiceExpertSequenceMatch(targetAvatarId, csAvatarOverrides[targetAvatarId]).voiceStyleKey,
                gender,
              );
              openMaterialPicker({
                type: category,
                avatarId: targetAvatarId,
                voiceGender: gender,
                voiceStyleKey: preset.key,
                title: gender === "male" ? "选择男性声音素材" : "选择女性声音素材",
                description: gender === "male"
                  ? "男性声音库显示男声编号朗音、男性演讲默认封面和可复用素材；封面自动标准化为 250 × 250，均不超过 2MB。"
                  : "女性声音库显示女声编号朗音、女性讲解默认封面和可复用素材；封面自动标准化为 250 × 250，均不超过 2MB。",
                allowedKinds: ["image", "audio"],
                emptyText: gender === "male"
                  ? "暂无男性声音素材，请上传男性演讲封面或第一条男声朗音。"
                  : "暂无女性声音素材，请上传女性讲解封面或第一条女声朗音。",
              });
            }}
            onUpload={() => openCustomerServiceLocalUpload(materialPickerTarget)}
            onRefresh={loadMaterialAssets}
            onRestore={async () => {
              if (!materialPickerRestoreState) return;
              if (materialPickerRestoreState.type === "reminder-sound") {
                await handleRestoreReminderMaterialPreset(materialPickerRestoreState.avatarId, materialPickerRestoreState.styleKey);
              } else {
                await handleClearVoicePresetAsset(
                  materialPickerRestoreState.avatarId,
                  materialPickerRestoreState.styleKey,
                  materialPickerRestoreState.gender,
                );
              }
              closeMaterialPicker();
              toast.success("已恢复当前编号的本地默认素材");
            }}
            onRecordDimensions={recordMaterialAssetDimensions}
            onRecordDuration={recordMaterialAssetDuration}
            onApply={handleApplyExistingMaterialAsset}
            onReplace={beginReplaceStoredMaterialAsset}
            onPreview={toggleMaterialAssetPreview}
            onDelete={handleDeleteMaterialAsset}
            onToggleSource={() => { void toggleTemplateSourceLock(); }}
            onTogglePage={toggleTemplatePageLock}
            onToggleColumn={toggleTemplateColumnLock}
            resolveAvatarGender={(entry) => resolveAvatarMaterialGender(
              entry.asset.fileName,
              entry.builtinAvatar?.gender,
              materialPickerAvatarGenderFallback,
            )}
          />
        </Suspense>
      ) : null}

      <DeferredUnifiedActionDialog
        open={sourceActionDialog.open}
        title={sourceActionDialog.title}
        description={sourceActionDialog.description}
        confirmLabel={sourceActionDialog.confirmLabel}
        busyLabel={sourceActionDialog.busyLabel}
        cancelLabel={sourceActionDialog.cancelLabel}
        onOpenChange={(open) => (!open ? closeSourceActionDialog() : null)}
        onConfirm={sourceActionDialog.onConfirm}
        onCancel={sourceActionDialog.onCancel}
        minimumBusyMs={sourceActionDialog.minimumBusyMs}
        showBusyState={sourceActionDialog.showBusyState}
      />


      {themeEditorVisited ? (
        <Suspense fallback={null}>
          <LazyProductMarketThemeEditorDialog
            open={showThemeEditor}
            onOpenChange={setShowThemeEditor}
            editingThemeKey={editingThemeKey}
            themeForm={themeForm}
            setThemeForm={setThemeForm}
            layoutSectionOrder={layoutSectionOrder}
            visualCornerRadius={
              themeForm.layout.frameCornerRadius === "square"
                ? "0px"
                : themeForm.layout.frameCornerRadius === "soft"
                  ? "12px"
                  : "24px"
            }
            dialogStyle={themeEditorDialogStyle}
            onSave={saveThemeForm}
            colorPicker={ColorPicker}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
