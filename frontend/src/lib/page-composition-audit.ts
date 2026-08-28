import { buildPageCompositionImpactMap } from "@/lib/page-composition-impact-map";
import { resolvePageCompositionStructuralRoute } from "@/lib/page-composition-identity";
import { buildPageCompositionManifest } from "@/lib/page-composition-manifest";
import { fingerprintDeveloperWorkflowValue } from "@/lib/developer-workflow-run";
import { currentProductMarketConfigKey, writeStoredProductMarketConfig, type ProductMarketScope } from "@/lib/product-market-config";
import { writeSharedVisualContractSettings } from "@/lib/product-market-shared-style";
import {
  captureGlobalLayoutRestorePoint,
  capturePageLayoutRestorePoint,
  hasPageLayoutCssProfile,
  readEffectivePageLayoutCssProfile,
  readGlobalPageLayoutCssProfile,
  readPageCssProfiles,
  removePageLayoutCssProfile,
  restoreGlobalLayoutRestorePointById,
  restorePageLayoutRestorePointById,
  type PageCssProfile,
} from "@/lib/page-layout-overrides";
import {
  isCompletedLayoutLocked,
  isCompletedPageHardLocked,
  isCompletedSourceLocked,
  resolveCompletedLayoutLock,
} from "@/lib/page-layout-lock";
import { useProductMarketStore } from "@/lib/product-market-store";
import { safeSetLocalStorage } from "@/lib/storage-guards";
import {
  VISUAL_CARD_PAGE_REGION_IDS,
  buildVisualCardLayoutScopeKey,
  cloneVisualCardLayout,
  composeVisualCardLayout,
  createDefaultVisualCardLayout,
  deleteVisualCardPageOverride,
  normalizeVisualCardLayout,
  readVisualCardPageOverride,
  resolveVisualCardWorkspaceScope,
  writeVisualCardPageOverride,
  type VisualCardLayoutScope,
  type VisualCardLayoutConfig,
} from "@/lib/visual-card-layout-contract";

const PAGE_COMPOSITION_AUDIT_STORAGE_KEY = "tradepro.page-composition-audit.v1";
const PAGE_COMPOSITION_AUDIT_LIMIT = 12;
export const PAGE_COMPOSITION_AUDIT_RESTORED_EVENT = "tradepro:page-composition-audit-restored";

export type VisualSharedContractSnapshot = {
  visualCardLayout: VisualCardLayoutConfig | null;
  layoutStyle: ReturnType<typeof useProductMarketStore.getState>["layoutStyle"];
  globalFontFamily: string;
  globalFontWeight: string;
  globalLetterSpacing: string;
};

export type PageCompositionAuditActionScope = "page" | "global" | "both";
export type PageCompositionAuditAction = "checkpoint" | "restore-global-inheritance";
export type PageCompositionInheritanceBlockReason =
  | "read-only"
  | "browser-unavailable"
  | "layout-lock"
  | "page-lock"
  | "source-lock";

export type PageCompositionInheritanceDiff = {
  visualCardOverride: {
    exists: boolean;
    changedRegionIds: readonly string[];
    componentStyleRegionIds: readonly string[];
    componentInstanceCount: number;
  };
  pageLayoutCssProfile: {
    exists: boolean;
    changedVariableNames: readonly string[];
    layoutPlugin: PageCssProfile["layoutPlugin"] | null;
    summary: string | null;
  };
};

export type PageCompositionInheritanceResetPreview = {
  actionScope: "page";
  scopeIdentity: string;
  structuralRoute: string;
  allowed: boolean;
  blockedBy: readonly PageCompositionInheritanceBlockReason[];
  willChange: boolean;
  baseFingerprint: string;
  effectiveFingerprint: string;
  diff: PageCompositionInheritanceDiff;
  affectedTargets: readonly ["current-page"];
  excluded: readonly ["business-data", "downstream-custom-data", "downstream-new-data", "uploaded-assets"];
};

export type PageCompositionAuditRecord = {
  id: string;
  createdAt: string;
  route: string;
  workspaceScope: string;
  action: PageCompositionAuditAction;
  actionScope: PageCompositionAuditActionScope;
  scopeIdentities: Readonly<{ page: string; global: string }>;
  baseFingerprint: string;
  effectiveFingerprint: string;
  manifestId: string;
  affectedTargets: readonly string[];
  excluded: readonly ["business-data", "downstream-custom-data", "downstream-new-data", "uploaded-assets"];
  pageRestorePointId: string;
  globalRestorePointId: string;
  /** Null explicitly records that the page had no applied visual composition. */
  visualCardLayout: VisualCardLayoutConfig | null;
  /** Exact route/tenant overlay before the save; null means no page override. */
  visualCardPageOverride?: VisualCardLayoutConfig | null;
  /** Global visual tokens changed by 同步全局, excluding products and business data. */
  visualSharedContract?: VisualSharedContractSnapshot;
  /** Code-owned page CSS only; never includes business data, content or uploaded assets. */
  pageLayoutCssProfile?: PageCssProfile | null;
  inheritanceDiff?: PageCompositionInheritanceDiff;
  productMarketConfigKey?: string;
  siteId?: string;
};

export type RecordPageCompositionAuditOptions = {
  action?: PageCompositionAuditAction;
  actionScope?: PageCompositionAuditActionScope;
};

export type ListPageCompositionAuditOptions = {
  actionScope?: "page" | "global";
};

export type RestoreCurrentPageGlobalInheritanceResult =
  | {
    ok: true;
    audit: PageCompositionAuditRecord;
    preview: PageCompositionInheritanceResetPreview;
  }
  | {
    ok: false;
    code: "blocked" | "no-overrides" | "audit-failed" | "mutation-failed";
    preview: PageCompositionInheritanceResetPreview;
    audit?: PageCompositionAuditRecord;
    rolledBack?: boolean;
  };

function buildVisualScope(pathname: string, search: string): VisualCardLayoutScope {
  return { workspaceScope: resolveVisualCardWorkspaceScope(pathname), pathname, search };
}

export function buildPageCompositionAuditScopeIdentity(pathname: string, search: string, scope: "page" | "global") {
  const workspaceScope = resolveVisualCardWorkspaceScope(pathname);
  if (scope === "global") return `global:${encodeURIComponent(workspaceScope)}`;
  return `page:${buildVisualCardLayoutScopeKey(buildVisualScope(pathname, search))}`;
}

function clonePageCssProfile(profile?: PageCssProfile | null): PageCssProfile | null {
  if (!profile) return null;
  return {
    ...profile,
    variables: { ...(profile.variables || {}) },
    sharedFrame: { ...(profile.sharedFrame || {}) },
  };
}

function semanticPageCssProfile(profile?: PageCssProfile | null) {
  if (!profile) return null;
  return {
    source: profile.source,
    themeBinding: profile.themeBinding || null,
    frameBaseline: profile.frameBaseline || null,
    summary: profile.summary,
    variables: { ...(profile.variables || {}) },
    layoutPlugin: profile.layoutPlugin || null,
    sharedFrame: { ...(profile.sharedFrame || {}) },
  };
}

function semanticVisualCardLayout(layout: VisualCardLayoutConfig) {
  return { ...cloneVisualCardLayout(layout), updatedAt: "semantic" };
}

function visualRegionState(layout: VisualCardLayoutConfig, regionId: string) {
  return {
    nodes: layout.nodes.filter((node) => node.regionId === regionId),
    componentStyle: layout.componentStyles?.[regionId as keyof NonNullable<VisualCardLayoutConfig["componentStyles"]>] || null,
    componentInstances: (layout.componentInstances || []).filter((instance) => instance.regionId === regionId),
  };
}

function buildInheritanceSnapshot(pathname: string, search: string) {
  const visualScope = buildVisualScope(pathname, search);
  const globalVisualCardLayout = cloneVisualCardLayout(
    useProductMarketStore.getState().visualCardLayout || createDefaultVisualCardLayout(),
  );
  const visualCardPageOverride = readVisualCardPageOverride(visualScope);
  const effectiveVisualCardLayout = composeVisualCardLayout(globalVisualCardLayout, visualCardPageOverride);
  const pageLayoutCssProfile = clonePageCssProfile(readPageCssProfiles(pathname, search).layout);
  const globalPageLayoutCssProfile = clonePageCssProfile(readGlobalPageLayoutCssProfile(pathname));
  const effectivePageLayoutCssProfile = clonePageCssProfile(readEffectivePageLayoutCssProfile(pathname, search));
  const baseFingerprint = fingerprintDeveloperWorkflowValue({
    visualCardLayout: semanticVisualCardLayout(globalVisualCardLayout),
    pageLayoutCssProfile: semanticPageCssProfile(globalPageLayoutCssProfile),
  });
  const effectiveFingerprint = fingerprintDeveloperWorkflowValue({
    visualCardLayout: semanticVisualCardLayout(effectiveVisualCardLayout),
    pageLayoutCssProfile: semanticPageCssProfile(effectivePageLayoutCssProfile),
  });
  const changedRegionIds = visualCardPageOverride
    ? VISUAL_CARD_PAGE_REGION_IDS.filter((regionId) => fingerprintDeveloperWorkflowValue(visualRegionState(globalVisualCardLayout, regionId))
      !== fingerprintDeveloperWorkflowValue(visualRegionState(effectiveVisualCardLayout, regionId)))
    : [];
  const componentStyleRegionIds = visualCardPageOverride
    ? VISUAL_CARD_PAGE_REGION_IDS.filter((regionId) => fingerprintDeveloperWorkflowValue(globalVisualCardLayout.componentStyles?.[regionId] || null)
      !== fingerprintDeveloperWorkflowValue(effectiveVisualCardLayout.componentStyles?.[regionId] || null))
    : [];
  const componentInstanceCount = visualCardPageOverride
    ? (visualCardPageOverride.componentInstances || []).filter((instance) => instance.applicationScope === "current-page").length
    : 0;
  const baseVariables = globalPageLayoutCssProfile?.variables || {};
  const effectiveVariables = effectivePageLayoutCssProfile?.variables || {};
  const changedVariableNames = pageLayoutCssProfile
    ? [...new Set([...Object.keys(baseVariables), ...Object.keys(effectiveVariables)])]
      .filter((name) => baseVariables[name] !== effectiveVariables[name])
      .sort()
    : [];
  const diff: PageCompositionInheritanceDiff = {
    visualCardOverride: {
      exists: Boolean(visualCardPageOverride),
      changedRegionIds,
      componentStyleRegionIds,
      componentInstanceCount,
    },
    pageLayoutCssProfile: {
      exists: hasPageLayoutCssProfile(pathname, search),
      changedVariableNames,
      layoutPlugin: pageLayoutCssProfile?.layoutPlugin || null,
      summary: pageLayoutCssProfile?.summary || null,
    },
  };
  return {
    visualScope,
    visualCardPageOverride,
    pageLayoutCssProfile,
    baseFingerprint,
    effectiveFingerprint,
    diff,
  };
}

export function inspectCurrentPageGlobalInheritance(
  pathname: string,
  search = "",
  options: { readOnly?: boolean } = {},
): PageCompositionInheritanceResetPreview {
  const blockedBy: PageCompositionInheritanceBlockReason[] = [];
  if (options.readOnly) blockedBy.push("read-only");
  if (typeof window === "undefined") blockedBy.push("browser-unavailable");
  const lock = resolveCompletedLayoutLock(pathname, search);
  if (lock && isCompletedLayoutLocked(lock)) blockedBy.push("layout-lock");
  if (lock && isCompletedPageHardLocked(lock)) blockedBy.push("page-lock");
  if (lock && isCompletedSourceLocked(lock)) blockedBy.push("source-lock");
  const snapshot = buildInheritanceSnapshot(pathname, search);
  return {
    actionScope: "page",
    scopeIdentity: buildPageCompositionAuditScopeIdentity(pathname, search, "page"),
    structuralRoute: resolvePageCompositionStructuralRoute(pathname, search),
    allowed: blockedBy.length === 0,
    blockedBy,
    willChange: snapshot.diff.visualCardOverride.exists || snapshot.diff.pageLayoutCssProfile.exists,
    baseFingerprint: snapshot.baseFingerprint,
    effectiveFingerprint: snapshot.effectiveFingerprint,
    diff: snapshot.diff,
    affectedTargets: ["current-page"],
    excluded: ["business-data", "downstream-custom-data", "downstream-new-data", "uploaded-assets"],
  };
}

function resolveWritableProductMarketScope(pathname: string): ProductMarketScope | null {
  const scope = resolveVisualCardWorkspaceScope(pathname);
  return scope === "hq" || scope === "agency_source" || scope === "client_source" ? scope : null;
}

function readAuditRecords(): PageCompositionAuditRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(PAGE_COMPOSITION_AUDIT_STORAGE_KEY) || "[]") as unknown;
    return Array.isArray(value) ? value.filter((item): item is PageCompositionAuditRecord => Boolean(item && typeof item === "object" && "id" in item && "route" in item)) : [];
  } catch {
    return [];
  }
}

function writeAuditRecords(records: readonly PageCompositionAuditRecord[]) {
  if (typeof window === "undefined") return false;
  return safeSetLocalStorage(
    PAGE_COMPOSITION_AUDIT_STORAGE_KEY,
    JSON.stringify(records.slice(0, PAGE_COMPOSITION_AUDIT_LIMIT)),
  );
}

/** Creates recovery points before a composition release review, without publishing or changing any page data. */
export function recordPageCompositionAudit(
  pathname: string,
  search = "",
  options: RecordPageCompositionAuditOptions = {},
): PageCompositionAuditRecord {
  const structuralRoute = resolvePageCompositionStructuralRoute(pathname, search);
  const manifest = buildPageCompositionManifest(pathname, search);
  const impactMap = buildPageCompositionImpactMap(pathname, search);
  const pageRestore = capturePageLayoutRestorePoint(pathname, search);
  const globalRestore = captureGlobalLayoutRestorePoint(pathname);
  const visualCardLayout = useProductMarketStore.getState().visualCardLayout;
  const store = useProductMarketStore.getState();
  const inheritanceSnapshot = buildInheritanceSnapshot(pathname, search);
  const siteId = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("siteId")?.trim() || "";
  const productMarketScope = resolveWritableProductMarketScope(pathname);
  const record: PageCompositionAuditRecord = {
    id: `composition-audit-${Date.now()}`,
    createdAt: new Date().toISOString(),
    route: structuralRoute,
    workspaceScope: manifest.workspaceScope,
    action: options.action || "checkpoint",
    actionScope: options.actionScope || "both",
    scopeIdentities: {
      page: buildPageCompositionAuditScopeIdentity(pathname, search, "page"),
      global: buildPageCompositionAuditScopeIdentity(pathname, search, "global"),
    },
    baseFingerprint: inheritanceSnapshot.baseFingerprint,
    effectiveFingerprint: inheritanceSnapshot.effectiveFingerprint,
    manifestId: manifest.id,
    affectedTargets: impactMap.targets.map((target) => target.label),
    excluded: ["business-data", "downstream-custom-data", "downstream-new-data", "uploaded-assets"],
    pageRestorePointId: pageRestore.id,
    globalRestorePointId: globalRestore.id,
    visualCardLayout: visualCardLayout
      ? cloneVisualCardLayout(normalizeVisualCardLayout(visualCardLayout))
      : null,
    visualCardPageOverride: inheritanceSnapshot.visualCardPageOverride,
    visualSharedContract: {
      visualCardLayout: visualCardLayout
        ? cloneVisualCardLayout(normalizeVisualCardLayout(visualCardLayout))
        : null,
      layoutStyle: { ...store.layoutStyle },
      globalFontFamily: store.globalFontFamily,
      globalFontWeight: store.globalFontWeight,
      globalLetterSpacing: store.globalLetterSpacing,
    },
    pageLayoutCssProfile: inheritanceSnapshot.pageLayoutCssProfile,
    inheritanceDiff: inheritanceSnapshot.diff,
    ...(productMarketScope ? { productMarketConfigKey: currentProductMarketConfigKey(productMarketScope, siteId), siteId } : {}),
  };
  writeAuditRecords([record, ...readAuditRecords()]);
  return record;
}

export function listPageCompositionAuditRecords(
  pathname: string,
  search = "",
  options: ListPageCompositionAuditOptions = {},
) {
  const route = resolvePageCompositionStructuralRoute(pathname, search);
  if (!options.actionScope) return readAuditRecords().filter((record) => record.route === route);
  const scope = options.actionScope;
  const identity = buildPageCompositionAuditScopeIdentity(pathname, search, scope);
  return readAuditRecords().filter((record) => {
    const actionScope = record.actionScope as PageCompositionAuditActionScope | undefined;
    if (actionScope && actionScope !== "both" && actionScope !== scope) return false;
    const recordedIdentity = record.scopeIdentities?.[scope];
    return recordedIdentity ? recordedIdentity === identity : record.route === route;
  });
}

/** Restores only the exact audit snapshot selected by the user. */
export function restorePageCompositionAudit(record: PageCompositionAuditRecord, pathname: string, search = "", scope: "page" | "global" = "page") {
  const actionScope = record.actionScope as PageCompositionAuditActionScope | undefined;
  if (actionScope && actionScope !== "both" && actionScope !== scope) return false;
  const recordedIdentity = record.scopeIdentities?.[scope];
  if (recordedIdentity) {
    if (recordedIdentity !== buildPageCompositionAuditScopeIdentity(pathname, search, scope)) return false;
  } else if (record.route !== resolvePageCompositionStructuralRoute(pathname, search)) {
    return false;
  }
  const restored = scope === "page"
    ? restorePageLayoutRestorePointById(record.pageRestorePointId, pathname, search)
    : restoreGlobalLayoutRestorePointById(record.globalRestorePointId, pathname);
  if (!restored) return false;

  const visualScope = buildVisualScope(pathname, search);
  if (scope === "page") {
    if ("visualCardPageOverride" in record) {
      const restoredPageOverride = record.visualCardPageOverride
        ? writeVisualCardPageOverride(visualScope, record.visualCardPageOverride)
        : deleteVisualCardPageOverride(visualScope);
      if (!restoredPageOverride) return false;
    }
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PAGE_COMPOSITION_AUDIT_RESTORED_EVENT, { detail: { recordId: record.id, scope } }));
    return true;
  }

  // Records written before shared visual snapshots were introduced retain the
  // legacy layout-only fallback. New records restore the exact narrow visual
  // contract and persist it to the same tenant/source key captured at save.
  if (record.visualSharedContract || "visualCardLayout" in record) {
    const store = useProductMarketStore.getState();
    const currentConfig = store.exportConfig();
    const snapshot = record.visualSharedContract;
    const nextConfig = {
      ...currentConfig,
      visualCardLayout: (snapshot?.visualCardLayout ?? record.visualCardLayout)
        ? cloneVisualCardLayout(normalizeVisualCardLayout(snapshot?.visualCardLayout ?? record.visualCardLayout))
        : undefined,
      ...(snapshot ? {
        layoutStyle: { ...snapshot.layoutStyle },
        globalFontFamily: snapshot.globalFontFamily,
        globalFontWeight: snapshot.globalFontWeight,
        globalLetterSpacing: snapshot.globalLetterSpacing,
      } : {}),
    };
    store.importConfig(nextConfig);
    if (record.productMarketConfigKey) {
      writeStoredProductMarketConfig(record.productMarketConfigKey, nextConfig);
      writeSharedVisualContractSettings(nextConfig, record.siteId);
    }
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PAGE_COMPOSITION_AUDIT_RESTORED_EVENT, { detail: { recordId: record.id, scope } }));
  return true;
}

/**
 * Removes only the two code-owned current-page composition overlays. The audit
 * record is persisted first; any partial mutation is rolled back from that
 * exact page-scoped snapshot before a failure is returned.
 */
export function restoreCurrentPageGlobalInheritance(
  pathname: string,
  search = "",
  options: { readOnly?: boolean } = {},
): RestoreCurrentPageGlobalInheritanceResult {
  const preview = inspectCurrentPageGlobalInheritance(pathname, search, options);
  if (!preview.allowed) return { ok: false, code: "blocked", preview };
  if (!preview.willChange) return { ok: false, code: "no-overrides", preview };

  let audit: PageCompositionAuditRecord;
  try {
    audit = recordPageCompositionAudit(pathname, search, {
      action: "restore-global-inheritance",
      actionScope: "page",
    });
  } catch {
    return { ok: false, code: "audit-failed", preview };
  }
  if (!readAuditRecords().some((record) => record.id === audit.id)) {
    return { ok: false, code: "audit-failed", preview, audit };
  }

  try {
    if (preview.diff.visualCardOverride.exists && !deleteVisualCardPageOverride(buildVisualScope(pathname, search))) {
      throw new Error("visual-card-page-override-removal-failed");
    }
    if (preview.diff.pageLayoutCssProfile.exists) removePageLayoutCssProfile(pathname, search);
    if (readVisualCardPageOverride(buildVisualScope(pathname, search)) || hasPageLayoutCssProfile(pathname, search)) {
      throw new Error("page-composition-inheritance-verification-failed");
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(PAGE_COMPOSITION_AUDIT_RESTORED_EVENT, {
        detail: { recordId: audit.id, scope: "page", action: "restore-global-inheritance" },
      }));
    }
    return { ok: true, audit, preview };
  } catch {
    const rolledBack = restorePageCompositionAudit(audit, pathname, search, "page");
    return { ok: false, code: "mutation-failed", preview, audit, rolledBack };
  }
}
