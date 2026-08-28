import { lazy, Suspense, useEffect, useState } from "react";

import { VisualPageEditorTopbarLauncher } from "@/components/product-market/VisualPageEditorLauncher";
import {
  isCompletedSourceLocked,
  isRouteCompletedPageHardLocked,
  PAGE_LAYOUT_LOCK_EVENT,
  resolveCompletedLayoutLock,
} from "@/lib/page-layout-lock";
import { currentProductMarketConfigKey, writeStoredProductMarketConfig } from "@/lib/product-market-config";
import { writeSharedVisualContractSettings } from "@/lib/product-market-shared-style";
import {
  VISUAL_PAGE_EDITOR_OPEN_EVENT,
  type VisualPageEditorInitialApplicationScope,
  type VisualPageEditorOpenDetail,
} from "@/lib/visual-page-editor-events";
import { useProductMarketStore, type ExportableConfig } from "@/lib/product-market-store";
import { recordPageCompositionAudit } from "@/lib/page-composition-audit";
import {
  bindMarketingPlaybookDeveloperMarkerProof,
  captureMarketingPlaybookDeveloperMarkerProof,
} from "@/lib/marketing-playbook-pilot-inspector";
import {
  clearDeveloperGlobalStyleVisualIntent,
  createDeveloperGlobalStyleCanaryAppearance,
  readDeveloperGlobalStyleVisualIntent,
  writeDeveloperGlobalStyleCanaryProfileDraft,
  writeDeveloperGlobalStyleVisualConfirmation,
} from "@/lib/developer-global-style-session";
import {
  VISUAL_CARD_DIRECT_APPLY_EVENT,
  buildVisualCardLayoutScopeKey,
  cloneVisualCardLayout,
  composeVisualCardLayout,
  createDefaultVisualCardLayout,
  mergeVisualCardLayoutForApplicationScope,
  readVisualCardPageOverride,
  resolveVisualCardWorkspaceScope,
  writeVisualCardPageOverride,
  type VisualCardDirectApplyDetail,
  type VisualCardLayoutScope,
} from "@/lib/visual-card-layout-contract";
import type { VisualCardSharedStyleApplyPatch } from "@/lib/visual-card-shared-style-bridge";

type VisualCardProjectApplyDetail = VisualCardDirectApplyDetail & {
  sharedStylePatch?: VisualCardSharedStyleApplyPatch;
};

function isRouteSourceLocked(pathname: string, search: string) {
  const lock = resolveCompletedLayoutLock(pathname, search);
  return lock ? isCompletedSourceLocked(lock) : false;
}

const VisualPageEditorDock = lazy(async () => ({
  default: (await import("@/components/product-market/VisualPageEditorDock")).VisualPageEditorDock,
}));

export function VisualProjectContractHost({
  pathname,
  search,
  sourceLabel,
  readOnly = false,
}: {
  pathname: string;
  search: string;
  sourceLabel: string;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [initialApplicationScope, setInitialApplicationScope] = useState<VisualPageEditorInitialApplicationScope>("current-page");
  const [applicationScopeLock, setApplicationScopeLock] = useState<VisualPageEditorInitialApplicationScope | undefined>();
  const [lockRevision, setLockRevision] = useState(0);
  const hardLocked = isRouteCompletedPageHardLocked(pathname, search);
  const sourceLocked = isRouteSourceLocked(pathname, search);
  const writeLocked = hardLocked || sourceLocked;

  useEffect(() => {
    setOpen(false);
    setInitialApplicationScope("current-page");
    setApplicationScopeLock(undefined);
  }, [pathname, search]);

  useEffect(() => {
    const refreshLock = () => {
      setLockRevision((revision) => revision + 1);
      if (isRouteCompletedPageHardLocked(pathname, search) || isRouteSourceLocked(pathname, search)) setOpen(false);
    };
    window.addEventListener(PAGE_LAYOUT_LOCK_EVENT, refreshLock);
    return () => window.removeEventListener(PAGE_LAYOUT_LOCK_EVENT, refreshLock);
  }, [pathname, search]);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<VisualPageEditorOpenDetail>).detail;
      if (detail?.pathname && detail.pathname !== pathname) return;
      if (detail?.search && detail.search !== search) return;
      if (isRouteCompletedPageHardLocked(pathname, search) || isRouteSourceLocked(pathname, search)) return;
      setInitialApplicationScope(detail?.initialApplicationScope ?? "current-page");
      setApplicationScopeLock(detail?.applicationScopeLock);
      setOpen(true);
    };
    window.addEventListener(VISUAL_PAGE_EDITOR_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(VISUAL_PAGE_EDITOR_OPEN_EVENT, handleOpen);
  }, [pathname, search]);

  useEffect(() => {
    const handleDirectApply = (event: Event) => {
      const detail = (event as CustomEvent<VisualCardProjectApplyDetail>).detail;
      if (!detail?.config || detail.accepted) return;
      const scope: VisualCardLayoutScope = {
        workspaceScope: resolveVisualCardWorkspaceScope(pathname),
        pathname,
        search,
      };
      if (detail.scopeKey !== buildVisualCardLayoutScopeKey(scope)) return;
      const visualIntentRequest = {
        workspaceScope: scope.workspaceScope,
        pathname,
        search,
      };
      if (isRouteCompletedPageHardLocked(pathname, search) || isRouteSourceLocked(pathname, search)) {
        clearDeveloperGlobalStyleVisualIntent(window.sessionStorage, visualIntentRequest);
        detail.error = "当前页面锁或源码锁已启用；可视化、命令和同步均不可修改，请先在源开发器的页面锁定器中手动解锁。";
        return;
      }
      if (readOnly) {
        detail.error = "当前项目页只读取共享契约，不能直接修改源体模板。";
        return;
      }

      const store = useProductMarketStore.getState();
      const currentConfig = store.exportConfig();
      const siteId = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("siteId")?.trim() || "";
      const applicationScope = detail.applicationScope || "global";
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
        const markerCapture = captureMarketingPlaybookDeveloperMarkerProof(document, { pathname, search }, {
          workspaceScope: scope.workspaceScope,
          canaryProfileDraftId,
        });
        if (!markerCapture) {
          detail.error = "五个 canonical 标注未在真实可视化开发态自然显示；未生成试点档案，请保持开发器打开并修复标注后重试。";
          return;
        }
        const audit = recordPageCompositionAudit(pathname, search);
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
          pathname,
          search,
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
          pathname,
          search,
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
        const audit = recordPageCompositionAudit(pathname, search);
        if (!writeVisualCardPageOverride(scope, detail.config)) {
          detail.error = "当前页面样式保存失败，未改动共享模板。";
          return;
        }
        detail.appliedConfig = composeVisualCardLayout(globalLayout, readVisualCardPageOverride(scope));
        detail.accepted = true;
        detail.auditId = audit.id;
        detail.recoveryPointId = audit.pageRestorePointId;
        return;
      }

      const audit = recordPageCompositionAudit(pathname, search);
      const sharedStylePatch = detail.sharedStylePatch;
      const nextConfig: ExportableConfig = {
        ...currentConfig,
        visualCardLayout: cloneVisualCardLayout(globalLayout),
        layoutStructureCustomized: true,
        ...(sharedStylePatch ? {
          layoutCustomized: true,
          layoutStyle: { ...currentConfig.layoutStyle, ...sharedStylePatch.layoutStyle },
          globalFontFamily: sharedStylePatch.globalTypography.globalFontFamily || currentConfig.globalFontFamily,
          globalFontWeight: sharedStylePatch.globalTypography.globalFontWeight || currentConfig.globalFontWeight,
          globalLetterSpacing: sharedStylePatch.globalTypography.globalLetterSpacing || currentConfig.globalLetterSpacing,
        } : {}),
      };
      store.importConfig(nextConfig);
      writeStoredProductMarketConfig(currentProductMarketConfigKey("client_source", siteId), nextConfig);
      writeSharedVisualContractSettings(nextConfig, siteId);
      detail.appliedConfig = composeVisualCardLayout(globalLayout, readVisualCardPageOverride(scope));
      detail.accepted = true;
      detail.auditId = audit.id;
      detail.recoveryPointId = audit.globalRestorePointId;
    };

    window.addEventListener(VISUAL_CARD_DIRECT_APPLY_EVENT, handleDirectApply);
    return () => window.removeEventListener(VISUAL_CARD_DIRECT_APPLY_EVENT, handleDirectApply);
  }, [pathname, readOnly, search]);

  const handleLauncherOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setInitialApplicationScope("current-page");
      setApplicationScopeLock(undefined);
    }
    setOpen(nextOpen);
  };

  return <>
    <VisualPageEditorTopbarLauncher key={`visual-launcher-${lockRevision}`} open={open} onOpenChange={handleLauncherOpenChange} pathname={pathname} locked={writeLocked} />
    {open ? <Suspense fallback={null}><VisualPageEditorDock
      open
      onOpenChange={setOpen}
      pathname={pathname}
      search={search}
      readOnly={readOnly}
      sourceLabel={sourceLabel}
      initialApplicationScope={initialApplicationScope}
      applicationScopeLock={applicationScopeLock}
    /></Suspense> : null}
  </>;
}
