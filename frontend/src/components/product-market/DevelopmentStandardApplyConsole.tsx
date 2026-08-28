import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { UnifiedFrameMigrationWorkbench } from "@/components/developer-platform/UnifiedFrameMigrationWorkbench";
import { PageFooterLockControls } from "@/components/PageFooterLockControls";
import DeveloperRecordPanel from "@/components/product-market/DeveloperRecordPanel";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getFactoryPlatformCategory } from "@/lib/factory-platform-blueprint";
import {
  getCompletedLayoutLockOverride,
  getCompletedPageHardLockOverride,
  getCompletedSourceLockOverride,
  getFactoryPlatformApplicationLayoutLockId,
  getFactoryPlatformCategoryLayoutLockId,
  isCompletedLayoutLocked,
  isCompletedPageHardLocked,
  isCompletedSourceLocked,
  PAGE_LAYOUT_LOCK_EVENT,
  readCompletedLayoutLockSnapshot,
  resolveCompletedLayoutLock,
  setCompletedLayoutLocked,
  setCompletedPageHardLocked,
  setCompletedSourceLocked,
  type CompletedLayoutLock,
} from "@/lib/page-layout-lock";
import { PRODUCT_MARKET_LOCK_GROUP_ID, PRODUCT_MARKET_NAV_ITEMS } from "@/lib/product-market-navigation";
import {
  PRODUCT_MODULE_CATEGORIES,
  formatProductModuleCategoryLabel,
  getProductModuleCategoryByPath,
  normalizeProductModuleCategoryOrder,
  useProductMarketStore,
  type ProductChildItem,
  type ProductItem,
} from "@/lib/product-market-store";
import {
  isSourcePageLockRegistered,
  readSourcePageLocks,
  syncSourcePageLockWithReadback,
  type SourcePageLockRegistryResponse,
} from "@/lib/developer-source-page-lock-readback";
import { supportsSourcePageLock } from "@/lib/source-page-lock";
import {
  THREE_TIER_PAGE_LOCK_CONTRACT,
  VERTICAL_CONTEXT_CAPSULE_CONTRACT,
} from "@/lib/layout-frame-contract";
import { SHARED_WINDOW_TITLE_ACTION_ALIGNMENT_CONTRACT } from "@/lib/shared-window-contract";
import { loadLazyModule } from "@/lib/lazy-module-recovery";
import { schedulePostPaintIdle } from "@/lib/post-paint-lazy";
import {
  DEVELOPER_LOADING_SPEED_LEARNING_CONTRACT,
  DEVELOPER_NAVIGATION_ORDER_ALIASES,
  DEVELOPER_TOP_LEVEL_APPS,
  getDeveloperLoadingSpeedApplicationPlan,
  getDeveloperLoadingSpeedRulesForApp,
  getDeveloperTopLevelApp,
  getNextDeveloperTopLevelApp,
  type DeveloperTopLevelAppId,
} from "@/lib/developer-optimization-contract";
import {
  DEVELOPER_DESIGN_INTEGRATION_CONTRACT,
  resolveDeveloperPageDna,
} from "@/lib/developer-design-integration";
import {
  DEVELOPER_WORKFLOW_STAGES,
  buildDeveloperWorkflowScopeIdentity,
  createDeveloperWorkflowRun,
  downgradeExpiredDeveloperWorkflowReleaseEvidence,
  evaluateDeveloperWorkflowNextStep,
  fingerprintDeveloperWorkflowValue,
  fingerprintDeveloperWorkflowTargetManifest,
  loadDeveloperWorkflowRun,
  normalizeDeveloperWorkflowPerformanceBenchmarkSummary,
  saveDeveloperWorkflowRun,
  updateDeveloperWorkflowArtifact,
  type DeveloperWorkflowRun,
  type DeveloperWorkflowExecutionContext,
  type DeveloperWorkflowScope,
  type DeveloperWorkflowStageId,
  type UpdateDeveloperWorkflowArtifactInput,
} from "@/lib/developer-workflow-run";
import {
  GLOBAL_FRAME_RELEASE_AUTHORIZATION_MAX_AGE_MS,
  GLOBAL_FRAME_RELEASE_AUTHORIZATION_SCHEMA_VERSION,
  type GlobalFrameReleaseAuthorization,
} from "@/lib/visual-page-editor-events";
import {
  adaptDeveloperWorkflowArtifacts,
  appendLocalDeveloperRecord,
  createDeveloperLockReceipt,
  listLocalDeveloperRecords,
  sortDeveloperRecords,
  type DeveloperRecordEntry,
} from "@/lib/developer-record-ledger";
import type { PerformanceCodeAuditReport } from "@/lib/performance-code-audit";
import type { DeveloperPrEvidence } from "@/lib/developer-pr-evidence";
import { resolvePageFactoryRuntimeScope } from "@/page-factory/page-factory";

const developerApplicationModulePromises = new Map<DeveloperTopLevelAppId, Promise<unknown>>();
const RELEASE_GATE_WORKFLOW_STAGES = ["02", "03", "04", "05", "06"] as const;
const RELEASE_GATE_WORKFLOW_REF_PREFIX = "developer-workflow-run:";
const RELEASE_GATE_QUALITY_REF_PREFIX = "quality-evidence:";

function splitNormalizedRoute(normalizedRoute: string) {
  const queryIndex = normalizedRoute.indexOf("?");
  return queryIndex < 0
    ? { pathname: normalizedRoute, search: "" }
    : { pathname: normalizedRoute.slice(0, queryIndex), search: normalizedRoute.slice(queryIndex) };
}

function resolveWorkflowTargetLockIds(targets: DeveloperWorkflowRun["targets"]) {
  const unresolvedTargetIds: string[] = [];
  const locks = new Map<CompletedLayoutLock, string[]>();
  for (const target of targets) {
    if (!target.normalizedRoute) {
      unresolvedTargetIds.push(target.id);
      continue;
    }
    const route = splitNormalizedRoute(target.normalizedRoute);
    const lock = resolveCompletedLayoutLock(route.pathname, route.search);
    if (!lock) {
      unresolvedTargetIds.push(target.id);
      continue;
    }
    locks.set(lock, [...(locks.get(lock) || []), target.id]);
  }
  return { locks, unresolvedTargetIds };
}

function loadDeveloperApplicationModule<T>(
  appId: DeveloperTopLevelAppId,
  loader: () => Promise<T>,
) {
  const existing = developerApplicationModulePromises.get(appId) as Promise<T> | undefined;
  if (existing) return existing;
  const pending = loadLazyModule(loader, `developer-application:${appId}`);
  developerApplicationModulePromises.set(appId, pending);
  void pending.catch(() => {
    if (developerApplicationModulePromises.get(appId) === pending) {
      developerApplicationModulePromises.delete(appId);
    }
  });
  return pending;
}

const loadPageFactoryWorkbench = () => loadDeveloperApplicationModule("page-factory", async () => {
  const module = await import("@/components/product-market/PageFactoryWorkbench");
  return { default: module.PageFactoryWorkbench };
});
const loadPerformanceExperienceWorkbench = () => loadDeveloperApplicationModule(
  "performance-experience",
  () => import("@/components/product-market/PerformanceExperienceWorkbench"),
);
const loadSharedContractWorkbench = () => loadDeveloperApplicationModule(
  "shared-contract",
  () => import("@/components/product-market/DeveloperSharedContractWorkbench"),
);
const loadPerformanceQualityReleaseWorkbench = () => loadDeveloperApplicationModule(
  "quality-release",
  () => import("@/components/product-market/PerformanceQualityReleaseWorkbench"),
);
const loadDeveloperFigmaDesignWorkbench = () => loadDeveloperApplicationModule(
  "figma-ui",
  () => import("@/components/product-market/DeveloperFigmaDesignWorkbench"),
);
const loadDeveloperVisualEvidenceWorkbench = () => loadDeveloperApplicationModule(
  "visual-evidence",
  () => import("@/components/product-market/DeveloperVisualEvidenceWorkbench"),
);

const DEVELOPER_APPLICATION_PRELOADERS: Partial<Record<DeveloperTopLevelAppId, () => Promise<unknown>>> = {
  "shared-contract": loadSharedContractWorkbench,
  "figma-ui": loadDeveloperFigmaDesignWorkbench,
  "visual-evidence": loadDeveloperVisualEvidenceWorkbench,
  "performance-experience": loadPerformanceExperienceWorkbench,
  "quality-release": loadPerformanceQualityReleaseWorkbench,
  "page-factory": loadPageFactoryWorkbench,
};

function preloadDeveloperApplication(appId: DeveloperTopLevelAppId) {
  void DEVELOPER_APPLICATION_PRELOADERS[appId]?.().catch(() => undefined);
}

const LazyPageFactoryWorkbench = lazy(loadPageFactoryWorkbench);
const LazyPerformanceExperienceWorkbench = lazy(loadPerformanceExperienceWorkbench);
const LazySharedContractWorkbench = lazy(loadSharedContractWorkbench);
const LazyPerformanceQualityReleaseWorkbench = lazy(loadPerformanceQualityReleaseWorkbench);
const LazyDeveloperFigmaDesignWorkbench = lazy(loadDeveloperFigmaDesignWorkbench);
const LazyDeveloperVisualEvidenceWorkbench = lazy(loadDeveloperVisualEvidenceWorkbench);

function DeveloperApplicationLoading({ label }: { label: string }) {
  return (
    <div
      data-development-standard-application-loading={label}
      role="status"
      aria-live="polite"
      className="grid h-full w-full place-items-center text-xs opacity-60"
    >
      {label}
    </div>
  );
}

function DeveloperLoadingSpeedLearningPlan({
  appId,
  loadPlan,
  scope,
}: {
  appId: DeveloperTopLevelAppId;
  loadPlan: { fingerprint: string; policyVersion: string; profileId: string };
  scope: DeveloperWorkflowScope;
}) {
  const application = getDeveloperTopLevelApp(appId);
  const plan = getDeveloperLoadingSpeedApplicationPlan(appId);
  const rules = getDeveloperLoadingSpeedRulesForApp(appId);
  return (
    <details
      data-developer-loading-speed-learning={appId}
      data-developer-loading-speed-learning-version={DEVELOPER_LOADING_SPEED_LEARNING_CONTRACT.version}
      data-developer-loading-speed-load-plan={loadPlan.fingerprint}
      data-developer-loading-speed-load-plan-profile={loadPlan.profileId}
      data-developer-loading-speed-scope={scope}
      data-developer-loading-speed-rule-ids={rules.map((rule) => rule.id).join(",")}
      className="w-full rounded-md border border-current/15 px-2 py-1 text-[10px] leading-4"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2">
        <strong className="shrink-0">加载速度学习 · {application.order}</strong>
        <span className="min-w-0 flex-1 truncate opacity-75" title={plan.responsibility}>{plan.responsibility}</span>
        <span className="shrink-0 opacity-60">{rules.length} 条共享规则 · {scope === "global" ? "全局" : "当前页"} · 计划 {loadPlan.fingerprint.slice(0, 8)}</span>
      </summary>
      <div className="mt-2 grid gap-2 border-t border-current/10 pt-2 sm:grid-cols-2 xl:grid-cols-4">
        <div><strong>适用规则</strong><p className="mt-1 opacity-70">{rules.map((rule) => rule.label).join(" · ")}</p></div>
        <div><strong>本应用检查</strong><p className="mt-1 opacity-70">{plan.checks.join("；")}</p></div>
        <div><strong>标准产出</strong><p className="mt-1 opacity-70">{plan.output} 策略 {loadPlan.policyVersion} · Profile {loadPlan.profileId}</p></div>
        <div><strong>保护边界</strong><p className="mt-1 opacity-70">{plan.boundary}</p></div>
      </div>
    </details>
  );
}

const DEVELOPER_WORKFLOW_OUT_OF_ORDER_NOTICE_PATTERN =
  /^developer workflow stage \d{2} is out of order; expected (?:\d{2}|complete)$/u;

function resolveVisibleDeveloperWorkflowNotice(error: unknown) {
  if (!(error instanceof Error)) return "执行证据暂未进入统一流程。 ";
  return DEVELOPER_WORKFLOW_OUT_OF_ORDER_NOTICE_PATTERN.test(error.message) ? "" : error.message;
}

type PageLockTreeItem = {
  id: CompletedLayoutLock;
  label: string;
  description: string;
  level: 0 | 1 | 2 | 3;
  columnCode?: string;
  selectionKey?: string;
  projection?: "scope-catalog" | "client-source-governance";
  runtimeSourceScope?: "client_source";
  children: PageLockTreeItem[];
};

function getRouteLockId(path: string): CompletedLayoutLock | null {
  const [pathname, search = ""] = path.split("?");
  return resolveCompletedLayoutLock(pathname, search ? `?${search}` : "");
}

function buildColumnLockTree(
  items: Array<ProductItem | ProductChildItem>,
  level: 1 | 2 | 3 = 1,
  parentColumnCode?: string,
  parentLockId?: CompletedLayoutLock,
): PageLockTreeItem[] {
  return items.flatMap((item, index) => {
    const id = getRouteLockId(item.path);
    if (!id) return [];
    if (id === parentLockId) {
      return Array.isArray(item.children)
        ? buildColumnLockTree(item.children, level, parentColumnCode, parentLockId)
        : [];
    }
    const columnCode = parentColumnCode
      ? `${parentColumnCode}.${String(index + 1).padStart(2, "0")}`
      : String(index + 1).padStart(2, "0");
    const nextLevel = Math.min(3, level + 1) as 1 | 2 | 3;
    return [{
      id,
      label: (item.customLabel || item.label || "未命名栏目").trim(),
      description: item.description || `${level === 1 ? "一级" : level === 2 ? "二级" : "三级"}栏目`,
      level,
      columnCode,
      children: Array.isArray(item.children)
        ? buildColumnLockTree(item.children, nextLevel, columnCode, id)
        : [],
    }];
  });
}

const SHARED_SOCIAL_GOVERNANCE_SELECTION_KEY = "shared-governance:deepen";

function buildSharedSocialGovernanceLockTree(): PageLockTreeItem[] {
  const category = getFactoryPlatformCategory("deepen");
  if (!category) return [];
  return [{
    id: getFactoryPlatformCategoryLayoutLockId(category.key),
    label: `${category.order}.${category.label}`,
    description: "共享 05 治理投影；运行页面只归属客户源，总部与代理源不复制运行路由。",
    level: 1,
    columnCode: category.order,
    selectionKey: SHARED_SOCIAL_GOVERNANCE_SELECTION_KEY,
    projection: "client-source-governance",
    runtimeSourceScope: "client_source",
    children: category.applications.map((application, applicationIndex) => {
      const applicationCode = `${category.order}.${String(applicationIndex + 1).padStart(2, "0")}`;
      return {
        id: getFactoryPlatformApplicationLayoutLockId(application.id),
        label: application.navigationLabel,
        description: `${application.label}；共享治理锁会继承到客户源真实工作区。`,
        level: 2 as const,
        columnCode: applicationCode,
        projection: "client-source-governance" as const,
        runtimeSourceScope: "client_source" as const,
        children: application.navigationChildren.flatMap((child, childIndex) => {
          const id = getRouteLockId(child.route);
          if (!id) return [];
          return [{
            id,
            label: child.label,
            description: `${child.fullLabel}；client_source 真实运行页。`,
            level: 3 as const,
            columnCode: `${applicationCode}.${String(childIndex + 1).padStart(2, "0")}`,
            projection: "client-source-governance" as const,
            runtimeSourceScope: "client_source" as const,
            children: [],
          }];
        }),
      };
    }),
  }];
}

function getPageLockTreeSelectionKey(item: PageLockTreeItem) {
  return item.selectionKey || item.columnCode;
}

function buildFactoryApplicationLockTree(
  categoryKey: string,
  items: ProductItem[],
  allItems: ProductItem[],
): PageLockTreeItem[] {
  const category = getFactoryPlatformCategory(categoryKey);
  return items.flatMap((item) => {
    const globalIndex = allItems.indexOf(item);
    if (globalIndex < 0) return [];
    const application = category?.applications.find((candidate) => candidate.route === item.path);
    const id = application ? getFactoryPlatformApplicationLayoutLockId(application.id) : getRouteLockId(item.path);
    if (!id) return [];
    const columnCode = String(globalIndex + 1).padStart(2, "0");
    return [{
      id,
      label: (item.customLabel || item.label || "未命名栏目").trim(),
      description: item.description || "一级应用",
      level: 1,
      columnCode,
      children: Array.isArray(item.children) ? buildColumnLockTree(item.children, 2, columnCode, id) : [],
    }];
  });
}

type PageLockKind = keyof typeof THREE_TIER_PAGE_LOCK_CONTRACT;
type PageLockScope = "primary" | "secondary" | "all";
type PageLockOperationTrigger = "tree-checkbox" | "title-batch" | "all" | "custom" | "footer";
type PageLockStateSnapshot = { direct: boolean; effective: boolean; inherited: boolean };
type PageLockOperationResult = {
  lockId: CompletedLayoutLock;
  kind: PageLockKind;
  requestedLocked: boolean;
  before: PageLockStateSnapshot;
  after: PageLockStateSnapshot;
  stateAuthority: "server" | "local";
  serverUpdatedAt?: string;
  status: "passed" | "failed" | "blocked";
  error?: string;
};

function inspectPageLockState(kind: PageLockKind, lock: CompletedLayoutLock): PageLockStateSnapshot {
  const direct = kind === "source"
    ? getCompletedSourceLockOverride(lock) === true
    : kind === "page"
      ? getCompletedPageHardLockOverride(lock) === true
      : getCompletedLayoutLockOverride(lock) === true;
  const effective = kind === "source"
    ? isCompletedSourceLocked(lock)
    : kind === "page"
      ? isCompletedPageHardLocked(lock)
      : isCompletedLayoutLocked(lock);
  return { direct, effective, inherited: effective && !direct };
}

const PAGE_LOCK_RULES = (Object.keys(THREE_TIER_PAGE_LOCK_CONTRACT) as PageLockKind[]).map((kind) => {
  const contract = THREE_TIER_PAGE_LOCK_CONTRACT[kind];
  const blockedActions = contract.blocks.join("、");
  return {
    kind,
    label: contract.label,
    description: `${contract.protects}；禁止${blockedActions}。`,
    guide: `${contract.label}：保护${contract.protects}。禁止${blockedActions}。`,
  };
});

const PAGE_FACTORY_USAGE_STEPS = [
  "07 页面工厂是 01 至 06 后的独立只读治理栏目，不再嵌套在 01 全局框架器中。",
  "预检可查看源码注册、采用状态、固定能力、基线和只读覆盖率。",
  "新建或采用仍必须逐页生成计划、确认影响后执行；禁止批量 adopt。",
  "恢复默认只恢复代码拥有的结构、共享样式、区域标注、自适应和开发工具。",
] as const;

const PAGE_FACTORY_PROTECTED_BOUNDARY = "数据库、业务数据、上传素材、租户内容、下游自定义与正式备份始终保留。";

const PILOT_PATHNAME = "/zb/client-source/social";
const DEVELOPMENT_APPLICATION_SCOPE_STORAGE_PREFIX = "tradepro:development-standard:application-scope:v2";
const INACTIVE_PAGE_LOCK_COLUMNS: ProductItem[] = [];
const INACTIVE_PAGE_LOCK_CATEGORY_ORDER: string[] = [];
const INACTIVE_PAGE_LOCK_CATEGORY_ASSIGNMENTS: Record<string, never> = {};

function buildDevelopmentApplicationScopeStorageKey(
  sourceLabel: string,
  workspaceScope: string,
) {
  return `${DEVELOPMENT_APPLICATION_SCOPE_STORAGE_PREFIX}:${encodeURIComponent(sourceLabel)}:${encodeURIComponent(workspaceScope)}`;
}

function resolveDevelopmentProjectPageName(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  const requestedName = params.get("projectPageName");
  if (requestedName) return requestedName;
  const pageKey = pathname.split("/").filter(Boolean).at(-1) || "";
  if (pageKey === "product-market") {
    return ({
      operations: "运营市场",
      modules: "栏目配置",
      layout: "版面风格",
      service: "客服音效",
      development: "开发规范",
    } as Record<string, string>)[params.get("tab") || ""] || "产品市场";
  }
  return ({
    "product-analysis": "产品分析",
    templates: "网站风格",
    "ai-chat": "AI 智能",
    "ai-models": "模型中心",
    "ai-customer-service": "智能客服",
    projects: "已创计划",
    "site-settings": "网站设置",
    "company-info": "企业资料",
    social: "痛点路线",
  } as Record<string, string>)[pageKey] || "当前项目页面";
}

export function DevelopmentStandardApplyConsole({
  pathname,
  search,
  readOnly,
  sourceLabel,
}: {
  pathname: string;
  search: string;
  readOnly: boolean;
  sourceLabel: string;
}) {
  const navigate = useNavigate();
  const performanceExperienceScope = resolvePageFactoryRuntimeScope(pathname);
  const applicationScopeStorageKey = useMemo(
    () => buildDevelopmentApplicationScopeStorageKey(sourceLabel, performanceExperienceScope),
    [performanceExperienceScope, sourceLabel],
  );
  const [activeTool, setActiveTool] = useState<DeveloperTopLevelAppId>("visual-frame");
  const pageLockSubscriptionsActive = activeTool === "page-lock";
  const configuredColumns = useProductMarketStore((state) => pageLockSubscriptionsActive ? state.products : INACTIVE_PAGE_LOCK_COLUMNS);
  const configuredCatalogScope = useProductMarketStore((state) => pageLockSubscriptionsActive ? state.catalogScope : null);
  const configuredCategoryOrder = useProductMarketStore((state) => pageLockSubscriptionsActive ? state.moduleCategoryOrder : INACTIVE_PAGE_LOCK_CATEGORY_ORDER);
  const configuredCategoryAssignments = useProductMarketStore((state) => pageLockSubscriptionsActive ? state.moduleCategoryAssignments : INACTIVE_PAGE_LOCK_CATEGORY_ASSIGNMENTS);
  const [workflowScope, setWorkflowScope] = useState<DeveloperWorkflowScope>(() => {
    if (typeof window === "undefined") return "page";
    try {
      return window.localStorage.getItem(applicationScopeStorageKey) === "global" ? "global" : "page";
    } catch {
      return "page";
    }
  });
  const workflowPageDna = useMemo(
    () => resolveDeveloperPageDna(pathname, search, workflowScope),
    [pathname, search, workflowScope],
  );
  const workflowRuntimeTargetPageDna = useMemo(
    () => workflowPageDna.auditScope === "page" || activeTool !== "visual-evidence"
      ? workflowPageDna
      : resolveDeveloperPageDna(pathname, search, "page"),
    [activeTool, pathname, search, workflowPageDna],
  );
  const workflowTargets = useMemo(
    () => workflowPageDna.targetManifest.targets.map((target) => ({
      id: target.identityKey,
      sourceScope: target.sourceScope,
      normalizedRoute: target.normalizedRoute,
      version: target.lifecycle,
    })),
    [workflowPageDna],
  );
  const workflowTargetIds = useMemo(() => workflowTargets.map((target) => target.id), [workflowTargets]);
  const workflowScopeIdentity = useMemo(
    () => buildDeveloperWorkflowScopeIdentity({
      scope: workflowScope,
      sourceScope: workflowPageDna.sourceScope,
      normalizedRoute: workflowPageDna.normalizedRoute,
    }),
    [workflowPageDna.normalizedRoute, workflowPageDna.sourceScope, workflowScope],
  );
  const workflowTargetManifestFingerprint = useMemo(
    () => fingerprintDeveloperWorkflowTargetManifest(workflowTargets),
    [workflowTargets],
  );
  const [workflowRun, setWorkflowRun] = useState<DeveloperWorkflowRun | null>(null);
  const [workflowNotice, setWorkflowNotice] = useState("");
  const [globalBatchRunning, setGlobalBatchRunning] = useState(false);
  const [localRecordRevision, setLocalRecordRevision] = useState(0);
  const [sourceLockRegistry, setSourceLockRegistry] = useState<SourcePageLockRegistryResponse | null>(null);
  const [sourceLockRegistryReadAt, setSourceLockRegistryReadAt] = useState<string | null>(null);
  const [pageFactorySourceRecords, setPageFactorySourceRecords] = useState<readonly DeveloperRecordEntry[]>([]);
  const [pageFactorySourceRecordsResolved, setPageFactorySourceRecordsResolved] = useState(false);
  const [workflowAuditCache, setWorkflowAuditCache] = useState<{
    runId: string;
    scopeIdentity: string;
    sourceFingerprint: string;
    contractVersion: string;
    targetManifestFingerprint: string;
    report: PerformanceCodeAuditReport;
  } | null>(null);
  const [workflowPrEvidenceCache, setWorkflowPrEvidenceCache] = useState<{
    runId: string;
    scopeIdentity: string;
    sourceFingerprint: string;
    contractVersion: string;
    targetManifestFingerprint: string;
    evidence: DeveloperPrEvidence;
  } | null>(null);
  const [releaseGateAuthorization, setReleaseGateAuthorization] = useState<GlobalFrameReleaseAuthorization | null>(null);
  const workflowExecutionContext = useMemo<DeveloperWorkflowExecutionContext>(() => ({
    runId: workflowRun?.id ?? "",
    scope: workflowScope,
    scopeIdentity: workflowScopeIdentity,
    sourceFingerprint: workflowRun?.sourceFingerprint ?? workflowPageDna.sourceFingerprint,
    contractVersion: workflowRun?.contractVersion ?? DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version,
    targetManifestFingerprint: workflowTargetManifestFingerprint,
  }), [workflowPageDna.sourceFingerprint, workflowRun?.contractVersion, workflowRun?.id, workflowRun?.sourceFingerprint, workflowScope, workflowScopeIdentity, workflowTargetManifestFingerprint]);
  const workflowContextRef = useRef(workflowExecutionContext);
  const developerApplicationHoverTimerRef = useRef<number | null>(null);
  const [lockTreeRevision, setLockTreeRevision] = useState(0);
  const [lastLockMutationAt, setLastLockMutationAt] = useState<string | null>(null);
  const [selectedPrimaryColumn, setSelectedPrimaryColumn] = useState("all");
  const [customLockPanelOpen, setCustomLockPanelOpen] = useState(false);
  const [customLockScope, setCustomLockScope] = useState<PageLockScope>("all");
  const [customLockMode, setCustomLockMode] = useState<"lock" | "unlock">("lock");
  const [customLockKinds, setCustomLockKinds] = useState<PageLockKind[]>(["source", "page", "column"]);
  const lockOperationRunningRef = useRef(false);
  const pendingLockRefreshRef = useRef(false);
  const [lockOperationRunning, setLockOperationRunning] = useState(false);
  const pageLock = resolveCompletedLayoutLock(pathname, search);
  const developerRecords = useMemo<readonly DeveloperRecordEntry[]>(() => {
    void localRecordRevision;
    return sortDeveloperRecords([
      ...pageFactorySourceRecords,
      ...(workflowRun ? adaptDeveloperWorkflowArtifacts(workflowRun) : []),
      ...listLocalDeveloperRecords(workflowScopeIdentity),
    ]);
  }, [localRecordRevision, pageFactorySourceRecords, workflowRun, workflowScopeIdentity]);
  const resolvePageFactorySourceRecords = useCallback((records: readonly DeveloperRecordEntry[]) => {
    setPageFactorySourceRecords(records);
    setPageFactorySourceRecordsResolved(true);
  }, []);

  useLayoutEffect(() => {
    workflowContextRef.current = workflowExecutionContext;
  }, [workflowExecutionContext]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(applicationScopeStorageKey);
      setWorkflowScope(stored === "global" ? "global" : "page");
    } catch {
      setWorkflowScope("page");
    }
  }, [applicationScopeStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(applicationScopeStorageKey, workflowScope);
    } catch {
      // The workflow remains usable in-memory when local storage is unavailable.
    }
  }, [applicationScopeStorageKey, workflowScope]);

  useEffect(() => {
    const loaded = loadDeveloperWorkflowRun(workflowScopeIdentity, undefined, {
      expectedContractVersion: DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version,
      expectedSourceFingerprint: workflowPageDna.sourceFingerprint,
      expectedTargetManifestFingerprint: workflowTargetManifestFingerprint,
    });
    let next = loaded && !loaded.issues.length
      ? loaded
      : createDeveloperWorkflowRun({
        scope: workflowScope,
        sourceScope: workflowPageDna.sourceScope,
        normalizedRoute: workflowPageDna.normalizedRoute,
        contractVersion: DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version,
        sourceFingerprint: workflowPageDna.sourceFingerprint,
          targets: workflowTargets,
        });
    next = downgradeExpiredDeveloperWorkflowReleaseEvidence(next);
    saveDeveloperWorkflowRun(next);
    setWorkflowRun(next);
    setWorkflowNotice(loaded?.issues.length ? "源码、契约或目标范围已变化，已建立新的执行记录。" : "");
  }, [
    workflowPageDna.normalizedRoute,
    workflowPageDna.sourceFingerprint,
    workflowPageDna.sourceScope,
    workflowScope,
    workflowScopeIdentity,
    workflowTargetManifestFingerprint,
    workflowTargets,
  ]);

  const workflowReleaseEvidence = workflowRun?.artifacts["06"] ?? null;
  const workflowRunId = workflowRun?.id ?? null;

  useEffect(() => {
    const release = workflowReleaseEvidence;
    if (!workflowRunId || release?.status !== "passed") return undefined;
    const expiresAt = Date.parse(String(release.payload.verificationExpiresAt || ""));
    const expireReleaseEvidence = () => {
      setWorkflowRun((current) => {
        if (!current) return current;
        const next = downgradeExpiredDeveloperWorkflowReleaseEvidence(current);
        if (next === current) return current;
        saveDeveloperWorkflowRun(next);
        setWorkflowPrEvidenceCache(null);
        setReleaseGateAuthorization(null);
        setWorkflowNotice("06 发布证据已到期；已自动撤销发布授权，请重新核验 GitHub PR。 ");
        return next;
      });
    };
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      expireReleaseEvidence();
      return undefined;
    }
    const timeoutId = window.setTimeout(expireReleaseEvidence, Math.min(expiresAt - Date.now() + 25, 2_147_483_647));
    return () => window.clearTimeout(timeoutId);
  }, [workflowReleaseEvidence, workflowRunId]);

  useEffect(() => {
    const authorization = releaseGateAuthorization;
    if (!authorization) return undefined;
    const expiresAt = Date.parse(authorization.expiresAt);
    const expireAuthorization = () => {
      setReleaseGateAuthorization((current) => (
        current?.authorizationId === authorization.authorizationId ? null : current
      ));
    };
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      expireAuthorization();
      return undefined;
    }
    const timeoutId = window.setTimeout(expireAuthorization, Math.min(expiresAt - Date.now() + 25, 2_147_483_647));
    return () => window.clearTimeout(timeoutId);
  }, [releaseGateAuthorization]);

  useEffect(() => {
    setReleaseGateAuthorization(null);
  }, [workflowExecutionContext]);

  const changeWorkflowScope = useCallback((scope: DeveloperWorkflowScope) => {
    setWorkflowScope(scope);
    setWorkflowNotice(scope === "global" ? "已切换为全局共享目标。" : "已切换为当前页面最小覆盖。 ");
  }, []);

  const openDeveloperRecordLedger = useCallback(() => {
    setActiveTool("page-factory");
  }, []);

  useEffect(() => {
    const nextApplication = getNextDeveloperTopLevelApp(activeTool);
    if (!nextApplication || !DEVELOPER_APPLICATION_PRELOADERS[nextApplication.id]) return undefined;
    return schedulePostPaintIdle(() => preloadDeveloperApplication(nextApplication.id), 1_000);
  }, [activeTool]);

  const cancelDeveloperApplicationHoverPreload = useCallback(() => {
    if (developerApplicationHoverTimerRef.current === null) return;
    window.clearTimeout(developerApplicationHoverTimerRef.current);
    developerApplicationHoverTimerRef.current = null;
  }, []);

  const scheduleDeveloperApplicationHoverPreload = useCallback((appId: DeveloperTopLevelAppId) => {
    cancelDeveloperApplicationHoverPreload();
    if (!DEVELOPER_APPLICATION_PRELOADERS[appId]) return;
    developerApplicationHoverTimerRef.current = window.setTimeout(() => {
      developerApplicationHoverTimerRef.current = null;
      preloadDeveloperApplication(appId);
    }, 120);
  }, [cancelDeveloperApplicationHoverPreload]);

  useEffect(() => cancelDeveloperApplicationHoverPreload, [cancelDeveloperApplicationHoverPreload]);

  const recordWorkflowArtifact = useCallback(function recordWorkflowArtifact<S extends DeveloperWorkflowStageId>(
    stage: S,
    input: UpdateDeveloperWorkflowArtifactInput<S>,
    expectedContext: DeveloperWorkflowExecutionContext,
  ) {
    setWorkflowRun((current) => {
      if (!current) return current;
      try {
        const next = updateDeveloperWorkflowArtifact(current, stage, { ...input, expectedContext });
        saveDeveloperWorkflowRun(next);
        setWorkflowNotice(input.message || "执行证据已更新。 ");
        return next;
      } catch (error) {
        setWorkflowNotice(resolveVisibleDeveloperWorkflowNotice(error));
        return current;
      }
    });
  }, []);

  const recordStage01 = useCallback((input: UpdateDeveloperWorkflowArtifactInput<"01">) => recordWorkflowArtifact("01", input, workflowExecutionContext), [recordWorkflowArtifact, workflowExecutionContext]);
  const recordStage02 = useCallback((input: UpdateDeveloperWorkflowArtifactInput<"02">) => recordWorkflowArtifact("02", input, workflowExecutionContext), [recordWorkflowArtifact, workflowExecutionContext]);
  const recordStage03 = useCallback((input: UpdateDeveloperWorkflowArtifactInput<"03">) => recordWorkflowArtifact("03", input, workflowExecutionContext), [recordWorkflowArtifact, workflowExecutionContext]);
  const recordStage04 = useCallback((input: UpdateDeveloperWorkflowArtifactInput<"04">) => recordWorkflowArtifact("04", input, workflowExecutionContext), [recordWorkflowArtifact, workflowExecutionContext]);
  const recordStage05 = useCallback((input: UpdateDeveloperWorkflowArtifactInput<"05">) => recordWorkflowArtifact("05", input, workflowExecutionContext), [recordWorkflowArtifact, workflowExecutionContext]);
  const recordStage06 = useCallback((input: UpdateDeveloperWorkflowArtifactInput<"06">) => {
    const expected = workflowExecutionContext;
    const payload = input.payload as Record<string, unknown>;
    if (payload.workflowRunId !== expected.runId
      || payload.workflowContractVersion !== expected.contractVersion
      || payload.workflowScopeIdentity !== expected.scopeIdentity
      || payload.workflowSourceFingerprint !== expected.sourceFingerprint
      || payload.workflowTargetManifestFingerprint !== expected.targetManifestFingerprint) {
      setWorkflowNotice("06 证据不属于当前执行上下文，已拒绝写入。");
      return;
    }
    recordWorkflowArtifact("06", input, expected);
  }, [recordWorkflowArtifact, workflowExecutionContext]);

  const cacheGlobalAuditReport = useCallback((report: PerformanceCodeAuditReport) => {
    if (report.scope !== "global") return;
    setWorkflowAuditCache({
      runId: workflowRun?.id ?? "",
      scopeIdentity: workflowScopeIdentity,
      sourceFingerprint: workflowRun?.sourceFingerprint ?? workflowPageDna.sourceFingerprint,
      contractVersion: workflowRun?.contractVersion ?? DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version,
      targetManifestFingerprint: workflowTargetManifestFingerprint,
      report,
    });
  }, [workflowPageDna.sourceFingerprint, workflowRun?.contractVersion, workflowRun?.id, workflowRun?.sourceFingerprint, workflowScopeIdentity, workflowTargetManifestFingerprint]);

  const cacheVerifiedPrEvidence = useCallback((evidence: DeveloperPrEvidence | null) => {
    if (!evidence) {
      setWorkflowPrEvidenceCache(null);
      return;
    }
    setWorkflowPrEvidenceCache({
      runId: workflowRun?.id ?? "",
      scopeIdentity: workflowScopeIdentity,
      sourceFingerprint: workflowRun?.sourceFingerprint ?? workflowPageDna.sourceFingerprint,
      contractVersion: workflowRun?.contractVersion ?? DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version,
      targetManifestFingerprint: workflowTargetManifestFingerprint,
      evidence,
    });
  }, [workflowPageDna.sourceFingerprint, workflowRun?.contractVersion, workflowRun?.id, workflowRun?.sourceFingerprint, workflowScopeIdentity, workflowTargetManifestFingerprint]);

  const runGlobalWorkflowBatch = useCallback(async () => {
    const expectedContext = { ...workflowContextRef.current };
    const designArtifact = workflowRun?.artifacts["03"];
    if (expectedContext.scope !== "global") return;
    if (designArtifact?.status !== "passed") {
      setWorkflowNotice("请先完成 03 Figma 插件 UI，再运行全局 04–05 批检。 ");
      toast.error("全局批检需要新鲜的 03 设计快照。 ");
      return;
    }
    setGlobalBatchRunning(true);
    setWorkflowNotice("正在运行全局视觉矩阵、生产构建与加载预算，请保持当前范围不变…");
    try {
      const [{ runPerformanceCodeAudit, buildGlobalPerformanceWorkflowArtifact }, { evaluateGlobalVisualAuditCoverage }] = await Promise.all([
        import("@/lib/performance-code-audit"),
        import("@/lib/developer-global-workflow-evidence"),
      ]);
      const report = await runPerformanceCodeAudit({ scope: "global", runBuild: true });
      const currentContext = workflowContextRef.current;
      if (currentContext.scope !== expectedContext.scope
        || currentContext.runId !== expectedContext.runId
        || currentContext.scopeIdentity !== expectedContext.scopeIdentity
        || currentContext.sourceFingerprint !== expectedContext.sourceFingerprint
        || currentContext.contractVersion !== expectedContext.contractVersion
        || currentContext.targetManifestFingerprint !== expectedContext.targetManifestFingerprint) {
        setWorkflowNotice("全局批检完成时范围已变化，旧报告未写入当前流程。 ");
        return;
      }
      const visualCoverage = evaluateGlobalVisualAuditCoverage(report, workflowTargetIds.length, workflowTargetManifestFingerprint, workflowTargetIds);
      const commonRefs = [...new Set([
        ...(report.buildReportPath ? [`frontend/${report.buildReportPath}`] : []),
        ...(report.bundleBudgetReport?.fingerprint ? [`bundle-budget:${report.bundleBudgetReport.fingerprint}`] : []),
        `visual-global-coverage:${visualCoverage.analyzedRoutes}/${visualCoverage.targetCount}`,
      ])];
      cacheGlobalAuditReport(report);
      recordStage04({
        status: visualCoverage.status,
        payload: {
          pageDnaFingerprint: String(designArtifact.payload.pageDnaFingerprint || "unavailable"),
          viewportIds: visualCoverage.viewportIds,
          checkIds: visualCoverage.requiredCommandIds,
          artifactRefs: commonRefs,
          coverageMode: visualCoverage.coverageMode,
          targetCount: visualCoverage.targetCount,
          registeredPages: visualCoverage.registeredPages,
          analyzedRoutes: visualCoverage.analyzedRoutes,
          analysisErrors: visualCoverage.analysisErrors,
          failedCommandIds: visualCoverage.failedCommandIds,
          targetManifestFingerprint: visualCoverage.targetManifestFingerprint,
        },
        artifactRefs: commonRefs,
        message: visualCoverage.complete
          ? `全局视觉矩阵通过：${visualCoverage.analyzedRoutes}/${visualCoverage.targetCount} 个登记目标，并完成 390/768/1440 代表矩阵。`
          : `全局视觉矩阵阻断：${visualCoverage.issues.join("、")}。`,
        recordedAt: report.generatedAt,
      });
      if (visualCoverage.complete) {
        const performanceArtifact = buildGlobalPerformanceWorkflowArtifact(
          report,
          workflowTargetIds.length,
          workflowTargetManifestFingerprint,
          workflowTargetIds,
        );
        recordStage05(performanceArtifact);
        if (performanceArtifact.status === "passed") {
          setWorkflowNotice(`全局 04–05 批检完成：${visualCoverage.analyzedRoutes}/${visualCoverage.targetCount} 个目标。`);
          toast.success("全局视觉与加载批检已通过，可继续进入 06。 ");
        } else {
          setWorkflowNotice(performanceArtifact.message);
          toast.error("全局视觉已通过，但加载与性能证据仍有阻断，暂不能进入 06。 ");
        }
      } else {
        setWorkflowNotice(`全局批检被阻断：${visualCoverage.issues.join("、")}。`);
        toast.error("全局视觉矩阵存在阻断证据。 ");
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setWorkflowNotice(`全局批检失败：${message}`);
      toast.error(message);
    } finally {
      setGlobalBatchRunning(false);
    }
  }, [cacheGlobalAuditReport, recordStage04, recordStage05, workflowRun, workflowTargetIds, workflowTargetManifestFingerprint]);

  useEffect(() => {
    if (!workflowRun || workflowRun.artifacts["01"]) return;
    recordStage01({
      status: workflowTargetIds.length ? "passed" : "blocked",
      payload: {
        targetIds: workflowTargetIds,
        loadPlanPolicyVersion: workflowPageDna.loadPlan.policyVersion,
        loadPlanProfileId: workflowPageDna.loadPlan.profileId,
        loadPlanFingerprint: workflowPageDna.loadPlan.fingerprint,
      },
      message: workflowTargetIds.length
        ? `${workflowScope === "global" ? "全局" : "当前页面"}范围已解析 ${workflowTargetIds.length} 个目标。`
        : "当前范围没有可解析的页面目标。",
    });
  }, [recordStage01, workflowPageDna.loadPlan, workflowRun, workflowScope, workflowTargetIds]);

  const commitLockTreeRefresh = useCallback(() => {
    setReleaseGateAuthorization(null);
    setLastLockMutationAt(new Date().toISOString());
    setLockTreeRevision((revision) => revision + 1);
  }, []);

  const flushPendingLockTreeRefresh = useCallback(() => {
    if (!pendingLockRefreshRef.current) return;
    pendingLockRefreshRef.current = false;
    commitLockTreeRefresh();
  }, [commitLockTreeRefresh]);

  useEffect(() => {
    const refreshLocks = () => {
      if (lockOperationRunningRef.current) {
        pendingLockRefreshRef.current = true;
        return;
      }
      commitLockTreeRefresh();
    };
    window.addEventListener(PAGE_LAYOUT_LOCK_EVENT, refreshLocks);
    return () => window.removeEventListener(PAGE_LAYOUT_LOCK_EVENT, refreshLocks);
  }, [commitLockTreeRefresh]);

  const configuredColumnLockTree = useMemo<PageLockTreeItem[]>(() => {
    if (activeTool !== "page-lock") return [];
    if (configuredCatalogScope !== "client" && configuredCatalogScope !== "client_source") {
      return buildColumnLockTree(configuredColumns);
    }
    return normalizeProductModuleCategoryOrder(configuredCategoryOrder).map((categoryKey, categoryIndex) => {
      const category = PRODUCT_MODULE_CATEGORIES.find((item) => item.key === categoryKey)!;
      const applications = configuredColumns.filter((item) =>
        getProductModuleCategoryByPath(item.path, configuredCategoryAssignments)?.key === categoryKey
      );
      return {
        id: getFactoryPlatformCategoryLayoutLockId(categoryKey),
        label: formatProductModuleCategoryLabel(categoryIndex + 1, category.label),
        description: `${category.label}经营分类分组；本身不占栏目级别，一级应用和二级页面读取栏目配置的全局编号。`,
        level: 0,
        selectionKey: `category:${categoryKey}`,
        children: buildFactoryApplicationLockTree(categoryKey, applications, configuredColumns),
      };
    });
  }, [activeTool, configuredCatalogScope, configuredCategoryAssignments, configuredCategoryOrder, configuredColumns]);

  const sharedGovernanceLockTree = useMemo<PageLockTreeItem[]>(
    () => activeTool !== "page-lock" || configuredCatalogScope === "client" || configuredCatalogScope === "client_source"
      ? []
      : buildSharedSocialGovernanceLockTree(),
    [activeTool, configuredCatalogScope],
  );

  const pageLockTree = useMemo<PageLockTreeItem[]>(() => activeTool === "page-lock" ? [
      {
        id: PRODUCT_MARKET_LOCK_GROUP_ID as CompletedLayoutLock,
        label: "产品市场",
        description: "运营市场、栏目配置、版面风格与客服音效；锁定后，全局框架迁移与批次发布同步受保护。",
        level: 1,
        children: PRODUCT_MARKET_NAV_ITEMS.map(({ tab, label }) => ({
          id: `tool:product-market:${tab}` as CompletedLayoutLock,
          label,
          description: "产品市场页面",
          level: 2,
          children: [],
        })),
      },
      ...configuredColumnLockTree,
      ...sharedGovernanceLockTree,
    ] : [], [activeTool, configuredColumnLockTree, sharedGovernanceLockTree]);

  const primaryColumnOptions = useMemo(
    () => pageLockTree.slice(1).filter((item) => (
      item.level === 0 && item.selectionKey || item.level === 1 && item.columnCode
    )),
    [pageLockTree],
  );
  const selectedPrimaryColumnLabel = useMemo(() => {
    if (selectedPrimaryColumn === "all") return "全部一级栏";
    if (selectedPrimaryColumn === "product-market") return "产品市场";
    const item = primaryColumnOptions.find((candidate) => getPageLockTreeSelectionKey(candidate) === selectedPrimaryColumn);
    if (!item) return "全部一级栏";
    return item.level === 0
      ? item.label
      : `${item.projection === "client-source-governance" ? "共享" : "一级"} ${item.columnCode}栏 · ${item.label}`;
  }, [primaryColumnOptions, selectedPrimaryColumn]);

  const pageLockStateSnapshot = useMemo(() => {
    // PAGE_LAYOUT_LOCK_EVENT increments this revision after every lock write.
    void lockTreeRevision;
    return readCompletedLayoutLockSnapshot();
  }, [lockTreeRevision]);
  const currentPageLockState = pageLock ? pageLockStateSnapshot.get(pageLock) : null;
  const effectiveStructureLocked = currentPageLockState?.structure.effective ?? false;
  const effectiveHardLocked = currentPageLockState?.page.effective ?? false;
  const effectiveSourceLocked = currentPageLockState?.source.effective ?? false;
  const effectiveWriteLocked = effectiveHardLocked || effectiveSourceLocked;
  const pageLockStats = useMemo(() => {
    const nodes: PageLockTreeItem[] = [];
    const collect = (items: PageLockTreeItem[]) => items.forEach((item) => { nodes.push(item); collect(item.children); });
    collect(pageLockTree);
    const stats = {
      total: nodes.length,
      structureDirect: 0,
      hardDirect: 0,
      sourceDirect: 0,
      structureInherited: 0,
      hardInherited: 0,
      sourceInherited: 0,
    };
    nodes.forEach((item) => {
      const state = pageLockStateSnapshot.get(item.id);
      if (state.structure.direct) stats.structureDirect += 1;
      if (state.page.direct) stats.hardDirect += 1;
      if (state.source.direct) stats.sourceDirect += 1;
      if (state.structure.inherited) stats.structureInherited += 1;
      if (state.page.inherited) stats.hardInherited += 1;
      if (state.source.inherited) stats.sourceInherited += 1;
    });
    return stats;
  }, [pageLockStateSnapshot, pageLockTree]);

  useEffect(() => {
    if (activeTool !== "page-lock") return undefined;
    let cancelled = false;
    setSourceLockRegistryReadAt(null);
    void readSourcePageLocks()
      .then((registry) => {
        if (cancelled) return;
        setSourceLockRegistry(registry);
        setSourceLockRegistryReadAt(new Date().toISOString());
      })
      .catch(() => {
        if (cancelled) return;
        setSourceLockRegistry(null);
        setSourceLockRegistryReadAt(null);
      });
    return () => { cancelled = true; };
  }, [activeTool]);

  const appendPageLockReceipt = (
    trigger: PageLockOperationTrigger,
    locked: boolean,
    targetIds: readonly CompletedLayoutLock[],
    kinds: readonly PageLockKind[],
    results: readonly PageLockOperationResult[],
  ) => {
    const passed = results.filter((result) => result.status === "passed").length;
    const blocked = results.filter((result) => result.status === "blocked").length;
    const failed = results.filter((result) => result.status === "failed").length;
    const status = failed ? "failed" : blocked ? "blocked" : "passed";
    const recordedAt = new Date().toISOString();
    const kindLabel = kinds.map((kind) => kind === "source" ? "源码锁" : kind === "page" ? "页面锁" : "栏目锁").join("、");
    const triggerLabel = trigger === "tree-checkbox" ? "锁树单项"
      : trigger === "title-batch" ? "标题批量"
        : trigger === "all" ? "全部锁"
          : trigger === "custom" ? "自定义规则"
            : "尾栏控制";
    const resultSamples = results.slice(0, 12).map((result) => (
      `${result.kind}:${result.lockId}=${result.status}${result.after.inherited ? "(仍继承)" : ""}${result.error ? `(${result.error})` : ""}`
    ));
    const serverRefs = [...new Set(results
      .filter((result) => result.stateAuthority === "server" && result.serverUpdatedAt)
      .map((result) => `source-lock-registry:v1@${result.serverUpdatedAt}`))];
    const receipt = createDeveloperLockReceipt({
      recordId: `lock-receipt:${encodeURIComponent(workflowScopeIdentity)}:${recordedAt.replace(/[^0-9]/gu, "")}:${trigger}:${kinds.join("-")}`,
      action: locked ? "lock" : "unlock",
      scope: workflowScope,
      scopeIdentity: workflowScopeIdentity,
      sourceScope: workflowPageDna.sourceScope,
      pageIdentity: `${workflowPageDna.sourceScope}:${workflowPageDna.normalizedRoute}`,
      targetIds,
      status,
      recordedAt,
      contractVersion: DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version,
      sourceFingerprint: workflowRun?.sourceFingerprint ?? workflowPageDna.sourceFingerprint,
      targetManifestFingerprint: workflowTargetManifestFingerprint,
      summary: `${triggerLabel}已${locked ? "请求锁定" : "请求解除"}${kindLabel}：目标 ${targetIds.length} 个，结果通过 ${passed}、继承阻断 ${blocked}、失败 ${failed}。`,
      validation: `操作项 ${results.length} 个；${resultSamples.join("；")}${results.length > resultSamples.length ? `；另有 ${results.length - resultSamples.length} 项` : ""}。`,
      risks: failed
        ? "部分锁操作失败；请按失败项重新执行并核对服务端源码锁登记。"
        : blocked
          ? "直接锁已处理，但部分目标仍继承上级锁；必须到上级解除后才会完全解锁。"
          : "回执保存在当前浏览器；源码锁结果经过本地服务端回读，页面锁与栏目锁属于本地状态。",
      artifactRefs: serverRefs,
    });
    if (!receipt) return;
    const saved = appendLocalDeveloperRecord(receipt);
    if (saved.saved) setLocalRecordRevision((revision) => revision + 1);
  };

  const verifyGlobalReleaseLockGate = async () => {
    setReleaseGateAuthorization(null);
    const run = workflowRun;
    const qualityEvidence = run?.artifacts["06"];
    if (!run || run.scope !== "global" || qualityEvidence?.status !== "passed") {
      toast.error("请先按顺序完成并通过 02–06，再核对发布门。 ");
      return;
    }
    if (RELEASE_GATE_WORKFLOW_STAGES.some((stage) => run.artifacts[stage]?.status !== "passed") || run.issues.length) {
      toast.error("02–06 存在缺失、过期或阻断证据，当前不能生成发布授权。 ");
      return;
    }
    const qualityExpiresAt = Date.parse(String(qualityEvidence.payload.verificationExpiresAt || ""));
    if (!Number.isFinite(qualityExpiresAt) || qualityExpiresAt <= Date.now()) {
      toast.error("06 发布证据已经到期，请重新核验后再进入 08。 ");
      return;
    }
    if (lockOperationRunningRef.current) {
      toast.info("锁状态仍在处理中，请等待服务端回读完成。 ");
      return;
    }
    lockOperationRunningRef.current = true;
    setLockOperationRunning(true);
    try {
      const registry = await readSourcePageLocks();
      const readAt = new Date().toISOString();
      setSourceLockRegistry(registry);
      setSourceLockRegistryReadAt(readAt);
      const { locks, unresolvedTargetIds } = resolveWorkflowTargetLockIds(run.targets);
      // The release receipt and its fingerprint must use the exact same local
      // lock view after the authoritative server registry readback.
      const localLockSnapshot = readCompletedLayoutLockSnapshot();
      const lockStates = [...locks.keys()].map((lock) => ({
        lock,
        local: localLockSnapshot.get(lock),
      }));
      const hardLocked = lockStates.filter(({ local }) => local.page.effective).map(({ lock }) => lock);
      const sourceLocked = lockStates.filter(({ lock, local }) => (
        local.source.effective || isSourcePageLockRegistered(registry, lock)
      )).map(({ lock }) => lock);
      const structureFrozen = lockStates.filter(({ local }) => local.structure.effective).map(({ lock }) => lock);
      const passed = !unresolvedTargetIds.length && !hardLocked.length && !sourceLocked.length && !structureFrozen.length;
      const lockSnapshotFingerprint = fingerprintDeveloperWorkflowValue({
        workflowRunId: run.id,
        targetManifestFingerprint: run.targetManifestFingerprint,
        registryVersion: registry.version,
        locks: lockStates.sort((left, right) => left.lock.localeCompare(right.lock)).map(({ lock, local }) => ({
          lock,
          sourceLocked: local.source.effective || isSourcePageLockRegistered(registry, lock),
          pageHardLocked: local.page.effective,
          structureFrozen: local.structure.effective,
        })),
        unresolvedTargetIds: [...unresolvedTargetIds].sort(),
      });
      const workflowRef = `${RELEASE_GATE_WORKFLOW_REF_PREFIX}${run.id}`;
      const qualityRef = `${RELEASE_GATE_QUALITY_REF_PREFIX}${qualityEvidence.fingerprint}`;
      const receipt = createDeveloperLockReceipt({
        recordId: `lock-receipt:${encodeURIComponent(run.scopeIdentity)}:workflow:${encodeURIComponent(run.id)}:check`,
        action: "check",
        scope: run.scope,
        scopeIdentity: run.scopeIdentity,
        sourceScope: run.sourceScope,
        pageIdentity: run.normalizedRoute ? `${run.sourceScope}:${run.normalizedRoute}` : null,
        targetIds: run.targets.map((target) => target.id),
        status: passed ? "passed" : "blocked",
        recordedAt: readAt,
        contractVersion: run.contractVersion,
        sourceFingerprint: run.sourceFingerprint,
        targetManifestFingerprint: run.targetManifestFingerprint,
        summary: passed
          ? `发布门只读核对通过：02–06 与 ${run.targets.length} 个目标绑定一致，三层锁均未阻断。`
          : `发布门只读核对被阻断：未解析 ${unresolvedTargetIds.length}、源码锁 ${sourceLocked.length}、页面硬锁 ${hardLocked.length}、栏目锁 ${structureFrozen.length}。`,
        validation: `服务端源码锁登记 v${registry.version} 已于 ${readAt} 回读；解析锁目标 ${locks.size} 个，并核对源码锁、页面硬锁和栏目锁三层有效状态。`,
        risks: passed
          ? "本回执仅在短时有效期内授权唯一协调器；任何执行记录、源码、契约、目标或 06 证据变化都会使其失效。"
          : `阻断详情：${[...unresolvedTargetIds.slice(0, 4), ...sourceLocked.slice(0, 4), ...hardLocked.slice(0, 4), ...structureFrozen.slice(0, 4)].join("、") || "未知锁状态"}。`,
        artifactRefs: [
          workflowRef,
          qualityRef,
          `lock-snapshot:${lockSnapshotFingerprint}`,
          `source-lock-registry:v${registry.version}@${registry.updatedAt || readAt}`,
        ],
      });
      if (!receipt) throw new Error("无法生成当前执行记录的 08 核对回执");
      const saved = appendLocalDeveloperRecord(receipt);
      if (!saved.saved) throw new Error("08 核对回执无法写入当前浏览器记录账本");
      setLocalRecordRevision((revision) => revision + 1);
      if (passed) {
        const authorizationIdentity = {
          workflowRunId: run.id,
          qualityEvidenceFingerprint: qualityEvidence.fingerprint,
          lockReceiptId: receipt.recordId,
          lockReceiptRecordedAt: receipt.recordedAt,
          lockSnapshotFingerprint,
        };
        setReleaseGateAuthorization({
          schemaVersion: GLOBAL_FRAME_RELEASE_AUTHORIZATION_SCHEMA_VERSION,
          authorizationId: `release-auth:${fingerprintDeveloperWorkflowValue(authorizationIdentity).slice(0, 24)}`,
          workflowRunId: run.id,
          workflowScopeIdentity: run.scopeIdentity,
          workflowContractVersion: run.contractVersion,
          workflowSourceFingerprint: run.sourceFingerprint,
          workflowTargetManifestFingerprint: run.targetManifestFingerprint,
          qualityEvidenceFingerprint: qualityEvidence.fingerprint,
          lockReceiptId: receipt.recordId,
          lockReceiptRecordedAt: receipt.recordedAt,
          lockSnapshotFingerprint,
          issuedAt: receipt.recordedAt,
          expiresAt: new Date(Math.min(Date.parse(receipt.recordedAt) + GLOBAL_FRAME_RELEASE_AUTHORIZATION_MAX_AGE_MS, qualityExpiresAt)).toISOString(),
        });
        toast.success("发布门核对通过；可返回 01 由唯一协调器继续同步与发布。 ");
      } else {
        toast.error("发布门存在锁状态阻断，已记录原因但未授权发布。 ");
      }
    } catch (error) {
      setSourceLockRegistryReadAt(null);
      toast.error(error instanceof Error ? error.message : "发布门核对失败，未生成授权。 ");
    } finally {
      lockOperationRunningRef.current = false;
      flushPendingLockTreeRefresh();
      setLockOperationRunning(false);
    }
  };

  const applyPageLockOperation = async ({
    targets,
    kinds,
    locked,
    trigger,
  }: {
    targets: readonly CompletedLayoutLock[];
    kinds: readonly PageLockKind[];
    locked: boolean;
    trigger: PageLockOperationTrigger;
  }) => {
    if (readOnly || !targets.length || !kinds.length) return;
    if (lockOperationRunningRef.current) {
      toast.info("上一项锁操作仍在处理中，请等待回读完成。 ");
      return;
    }
    lockOperationRunningRef.current = true;
    setLockOperationRunning(true);
    try {
      const results: PageLockOperationResult[] = [];
      let latestSourceRegistry: SourcePageLockRegistryResponse | null = null;
      for (const kind of kinds) {
        for (const lock of targets) {
        const before = inspectPageLockState(kind, lock);
        if (!locked && before.inherited) {
          results.push({ lockId: lock, kind, requestedLocked: locked, before, after: before, stateAuthority: "local", status: "blocked", error: "继承上级锁" });
          continue;
        }
        let stateAuthority: "server" | "local" = "local";
        let serverUpdatedAt: string | undefined;
        try {
          if (kind === "source") {
            if (supportsSourcePageLock(lock)) {
              const registry = await syncSourcePageLockWithReadback(lock, locked);
              latestSourceRegistry = registry;
              stateAuthority = "server";
              serverUpdatedAt = registry.updatedAt;
            }
            setCompletedSourceLocked(lock, locked, "development-standard");
          } else if (kind === "page") {
            setCompletedPageHardLocked(lock, locked, "development-standard");
          } else {
            setCompletedLayoutLocked(lock, locked, "development-standard");
          }
          const after = inspectPageLockState(kind, lock);
          const status = !locked && after.inherited
            ? "blocked"
            : after.direct === locked && after.effective === locked
              ? "passed"
              : "failed";
          results.push({ lockId: lock, kind, requestedLocked: locked, before, after, stateAuthority, serverUpdatedAt, status, error: status === "failed" ? "操作后回读不一致" : undefined });
        } catch (error) {
          results.push({
            lockId: lock,
            kind,
            requestedLocked: locked,
            before,
            after: inspectPageLockState(kind, lock),
            stateAuthority,
            serverUpdatedAt,
            status: "failed",
            error: error instanceof Error ? error.message : "锁操作失败",
          });
        }
        }
      }
      if (latestSourceRegistry) {
        setSourceLockRegistry(latestSourceRegistry);
        setSourceLockRegistryReadAt(new Date().toISOString());
      }
      appendPageLockReceipt(trigger, locked, targets, kinds, results);
      const failed = results.filter((result) => result.status === "failed").length;
      const blocked = results.filter((result) => result.status === "blocked").length;
      if (failed) toast.error(`锁操作完成，但有 ${failed} 项失败；已生成回执。`);
      else if (blocked) toast.warning(`直接锁已处理，但有 ${blocked} 项仍继承上级锁；已生成回执。`);
      else toast.success(`${locked ? "已锁定" : "已解除"} ${results.length} 个锁操作项，并生成 08 回执。`);
    } finally {
      lockOperationRunningRef.current = false;
      flushPendingLockTreeRefresh();
      setLockOperationRunning(false);
    }
  };

  const togglePageStructureLock = (lock: CompletedLayoutLock, checked: boolean, trigger: PageLockOperationTrigger = "tree-checkbox") => {
    void applyPageLockOperation({ targets: [lock], kinds: ["column"], locked: checked, trigger });
  };

  const togglePageHardLock = (lock: CompletedLayoutLock, checked: boolean, trigger: PageLockOperationTrigger = "tree-checkbox") => {
    void applyPageLockOperation({ targets: [lock], kinds: ["page"], locked: checked, trigger });
  };

  const toggleSourceLock = (lock: CompletedLayoutLock, checked: boolean, trigger: PageLockOperationTrigger = "tree-checkbox") => {
    void applyPageLockOperation({ targets: [lock], kinds: ["source"], locked: checked, trigger });
  };

  const requireCurrentFooterLock = () => {
    if (pageLock) return pageLock;
    toast.info("当前页面未配置可操作的三层锁。");
    return null;
  };

  const toggleFooterColumnLock = () => {
    const lock = requireCurrentFooterLock();
    if (lock) togglePageStructureLock(lock, !effectiveStructureLocked, "footer");
  };

  const toggleFooterPageLock = () => {
    const lock = requireCurrentFooterLock();
    if (lock) togglePageHardLock(lock, !effectiveHardLocked, "footer");
  };

  const toggleFooterSourceLock = async () => {
    const lock = requireCurrentFooterLock();
    if (lock) toggleSourceLock(lock, !effectiveSourceLocked, "footer");
  };

  const renderPageLockNode = (item: PageLockTreeItem) => {
    const state = pageLockStateSnapshot.get(item.id);
    const directStructureLock = state.structure.direct;
    const directHardLock = state.page.direct;
    const directSourceLock = state.source.direct;
    const inheritedStructureLock = state.structure.inherited;
    const inheritedHardLock = state.page.inherited;
    const inheritedSourceLock = state.source.inherited;
    const levelLabel = item.level === 1 ? "一级" : item.level === 2 ? "二级" : item.level === 3 ? "三级" : "";
    const isCategoryGroup = item.level === 0;
    return (
      <li key={item.id} data-development-standard-page-lock-target={item.id} data-development-standard-page-lock-group={isCategoryGroup ? item.selectionKey : undefined} data-page-lock-level={isCategoryGroup ? undefined : item.level} data-page-lock-projection={item.projection || "scope-catalog"} data-page-lock-runtime-source-scope={item.runtimeSourceScope} className="space-y-1">
        <div data-development-standard-page-lock-row className={`grid grid-cols-[auto_auto_auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-current/15 px-2 py-2 ${item.level <= 1 ? "bg-current/[0.06]" : "bg-background/20"}`} style={{ marginLeft: `${Math.max(0, item.level - 1) * 12}px` }}>
          <input data-development-standard-source-lock-input={item.id} aria-label={`${item.label} 源码锁`} type="checkbox" className="h-4 w-4 accent-current" checked={directSourceLock} disabled={readOnly || lockOperationRunning || inheritedSourceLock} onChange={(event) => void toggleSourceLock(item.id, event.currentTarget.checked)} />
          <input data-development-standard-page-lock-hard-input={item.id} aria-label={`${item.label} 页面锁`} type="checkbox" className="h-4 w-4 accent-current" checked={directHardLock} disabled={readOnly || lockOperationRunning || inheritedHardLock} onChange={(event) => togglePageHardLock(item.id, event.currentTarget.checked)} />
          <input data-development-standard-page-lock-structure-input={item.id} aria-label={`${item.label} 栏目锁`} type="checkbox" className="h-4 w-4 accent-current" checked={directStructureLock} disabled={readOnly || lockOperationRunning || inheritedStructureLock} onChange={(event) => togglePageStructureLock(item.id, event.currentTarget.checked)} />
          <span className="flex min-w-0 items-center gap-1.5"><span className="truncate text-[12px] font-medium">{item.label}</span>{levelLabel ? <span data-shared-contract-plugin="column-lock-code" className="shrink-0 rounded-full border border-current/20 px-1.5 py-0.5 text-[9px] opacity-65">{item.columnCode ? `${levelLabel} ${item.columnCode}栏` : levelLabel}</span> : null}</span>
          {inheritedStructureLock || inheritedHardLock || inheritedSourceLock ? <span className="text-[9px] opacity-55">{inheritedSourceLock ? "继承源码锁" : inheritedHardLock ? "继承页面锁" : "继承栏目锁"}</span> : null}
        </div>
        {item.children.length ? <ul className="space-y-1">{item.children.map(renderPageLockNode)}</ul> : null}
      </li>
    );
  };

  const renderPageLockWorkspace = () => {
    const shouldShowProductMarket = selectedPrimaryColumn === "all" || selectedPrimaryColumn === "product-market";
    const visibleColumns = selectedPrimaryColumn === "all"
      ? pageLockTree.slice(1)
      : selectedPrimaryColumn === "product-market"
        ? []
        : pageLockTree.slice(1).filter((item) => getPageLockTreeSelectionKey(item) === selectedPrimaryColumn);
    const visibleConfiguredColumns = visibleColumns.filter((item) => item.projection !== "client-source-governance");
    const visibleGovernanceColumns = visibleColumns.filter((item) => item.projection === "client-source-governance");
    return (
      <section data-development-standard-page-lock-tree data-page-lock-tree-revision={lockTreeRevision} data-page-lock-max-level="3" aria-busy={lockOperationRunning} className="flex h-full min-h-0 w-full flex-col overflow-hidden p-4">
        <div data-development-standard-source-lock-readback className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-md border border-current/15 px-2 py-1.5 text-[10px] leading-4">
          <span><b>08 锁定回执：</b>本开发器内的单项、批量、自定义与尾栏操作统一进入记录账本。</span>
          <div className="flex items-center gap-2">
            <span className="opacity-65">源码登记 {sourceLockRegistry ? `v${sourceLockRegistry.version} · ${Object.keys(sourceLockRegistry.locks).length} 项 · ${sourceLockRegistryReadAt || sourceLockRegistry.updatedAt || "时间未记录"}` : "服务端暂未回读"}</span>
            <Button data-development-standard-release-gate-check type="button" size="sm" variant="outline" className="h-7 px-2 text-[10px]" disabled={readOnly || lockOperationRunning || workflowScope !== "global"} title={workflowScope === "global" ? "只读核对当前全局执行记录的三层锁发布边界" : "切换为全局作用域后才需要发布门"} onClick={() => void verifyGlobalReleaseLockGate()}>核对发布门</Button>
          </div>
        </div>
        <div data-development-standard-page-lock-selection className="min-h-0 flex-1 overflow-y-auto">
          {shouldShowProductMarket ? <section><h3 className="mb-2 text-xs font-semibold">产品市场</h3><ul className="space-y-1">{pageLockTree.slice(0, 1).map(renderPageLockNode)}</ul></section> : null}
          {visibleConfiguredColumns.length ? <section className={shouldShowProductMarket ? "mt-4" : ""}><h3 className="mb-2 text-xs font-semibold">栏目配置</h3><ul className="space-y-1">{visibleConfiguredColumns.map(renderPageLockNode)}</ul></section> : null}
          {visibleGovernanceColumns.length ? <section data-development-standard-shared-governance-lock-tree="deepen" className={shouldShowProductMarket || visibleConfiguredColumns.length ? "mt-4" : ""}><h3 className="mb-1 text-xs font-semibold">共享 05 治理投影 · 客户源运行</h3><p className="mb-2 text-[10px] opacity-65">只复用分类、应用与页面锁语义；不会在总部或代理源生成 /social 运行页。</p><ul className="space-y-1">{visibleGovernanceColumns.map(renderPageLockNode)}</ul></section> : null}
        </div>
      </section>
    );
  };

  const getFilteredLockNodes = () => {
    const roots = selectedPrimaryColumn === "all"
      ? pageLockTree
      : selectedPrimaryColumn === "product-market"
        ? pageLockTree.slice(0, 1)
        : pageLockTree.slice(1).filter((item) => getPageLockTreeSelectionKey(item) === selectedPrimaryColumn);
    const nodes: PageLockTreeItem[] = [];
    const collect = (items: PageLockTreeItem[]) => items.forEach((item) => { nodes.push(item); collect(item.children); });
    collect(roots);
    return nodes;
  };

  const applyLockBatch = async (kind: PageLockKind, level: PageLockScope, locked: boolean) => {
    const targets = getFilteredLockNodes().filter((item) => level === "all" || (level === "primary" ? item.level === 1 : item.level >= 2));
    await applyPageLockOperation({ targets: targets.map((item) => item.id), kinds: [kind], locked, trigger: "title-batch" });
  };

  const applyAllFilteredLocks = async (locked: boolean) => {
    const targets = getFilteredLockNodes().map((item) => item.id);
    await applyPageLockOperation({ targets, kinds: PAGE_LOCK_RULES.map((rule) => rule.kind), locked, trigger: "all" });
  };

  const applyCustomLockRules = async () => {
    if (!customLockKinds.length) {
      toast.error("请至少选择一把锁。 ");
      return;
    }
    const targets = getFilteredLockNodes()
      .filter((item) => customLockScope === "all" || (customLockScope === "primary" ? item.level === 1 : item.level >= 2))
      .map((item) => item.id);
    await applyPageLockOperation({ targets, kinds: customLockKinds, locked: customLockMode === "lock", trigger: "custom" });
    setCustomLockPanelOpen(false);
  };

  const activeDefinition = getDeveloperTopLevelApp(activeTool);
  const nextDefinition = getNextDeveloperTopLevelApp(activeTool);
  const projectPageName = resolveDevelopmentProjectPageName(pathname, search);
  const developerToolPath = `${activeDefinition.order}${activeDefinition.label}：${projectPageName}`;
  const developerBreadcrumb = `${sourceLabel} → ${sourceLabel}开发器 → ${developerToolPath}`;
  const pageLockSummary = `共 ${pageLockStats.total} 个栏目。源码锁：直接 ${pageLockStats.sourceDirect}，继承 ${pageLockStats.sourceInherited}；页面锁：直接 ${pageLockStats.hardDirect}，继承 ${pageLockStats.hardInherited}；栏目锁：直接 ${pageLockStats.structureDirect}，继承 ${pageLockStats.structureInherited}。`;
  const activeWorkflowStage = DEVELOPER_WORKFLOW_STAGES.find((stage) => stage.appId === activeTool)?.id ?? null;
  const activeWorkflowArtifact = activeWorkflowStage && workflowRun ? workflowRun.artifacts[activeWorkflowStage] : null;
  const activeWorkflowStagePassed = activeWorkflowArtifact?.status === "passed";
  const workflowGate = workflowRun ? evaluateDeveloperWorkflowNextStep(workflowRun) : null;
  const workflowPassedCount = workflowRun
    ? DEVELOPER_WORKFLOW_STAGES.filter((stage) => workflowRun.artifacts[stage.id]?.status === "passed").length
    : 0;
  const globalFrameReleaseAuthorization = useMemo<GlobalFrameReleaseAuthorization | null>(() => {
    const run = workflowRun;
    const qualityEvidence = run?.artifacts["06"];
    const authorization = releaseGateAuthorization;
    if (!run || !authorization || run.scope !== "global" || run.issues.length || qualityEvidence?.status !== "passed") return null;
    if (RELEASE_GATE_WORKFLOW_STAGES.some((stage) => run.artifacts[stage]?.status !== "passed")) return null;
    const qualityExpiresAt = Date.parse(String(qualityEvidence.payload.verificationExpiresAt || ""));
    const authorizationExpiresAt = Date.parse(authorization.expiresAt);
    if (!Number.isFinite(qualityExpiresAt)
      || !Number.isFinite(authorizationExpiresAt)
      || authorization.workflowRunId !== run.id
      || authorization.workflowScopeIdentity !== run.scopeIdentity
      || authorization.workflowContractVersion !== run.contractVersion
      || authorization.workflowSourceFingerprint !== run.sourceFingerprint
      || authorization.workflowTargetManifestFingerprint !== run.targetManifestFingerprint
      || authorization.qualityEvidenceFingerprint !== qualityEvidence.fingerprint) return null;
    const currentLocks = resolveWorkflowTargetLockIds(run.targets);
    if (currentLocks.unresolvedTargetIds.length
      || [...currentLocks.locks.keys()].some((lock) => (
        pageLockStateSnapshot.get(lock).source.effective
        || pageLockStateSnapshot.get(lock).page.effective
        || pageLockStateSnapshot.get(lock).structure.effective
      ))) return null;
    if (lastLockMutationAt && Date.parse(authorization.issuedAt) < Date.parse(lastLockMutationAt)) return null;
    return authorization;
  }, [lastLockMutationAt, pageLockStateSnapshot, releaseGateAuthorization, workflowRun]);
  const activeGlobalAuditReport = workflowAuditCache
    && workflowAuditCache.runId === (workflowRun?.id ?? "")
    && workflowAuditCache.scopeIdentity === workflowScopeIdentity
    && workflowAuditCache.sourceFingerprint === (workflowRun?.sourceFingerprint ?? workflowPageDna.sourceFingerprint)
    && workflowAuditCache.contractVersion === (workflowRun?.contractVersion ?? DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version)
    && workflowAuditCache.targetManifestFingerprint === workflowTargetManifestFingerprint
    ? workflowAuditCache.report
    : null;
  const activePrEvidence = workflowPrEvidenceCache
    && workflowPrEvidenceCache.runId === (workflowRun?.id ?? "")
    && workflowPrEvidenceCache.scopeIdentity === workflowScopeIdentity
    && workflowPrEvidenceCache.sourceFingerprint === (workflowRun?.sourceFingerprint ?? workflowPageDna.sourceFingerprint)
    && workflowPrEvidenceCache.contractVersion === (workflowRun?.contractVersion ?? DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version)
    && workflowPrEvidenceCache.targetManifestFingerprint === workflowTargetManifestFingerprint
    ? workflowPrEvidenceCache.evidence
    : null;
  const workflowStage05BundleFingerprint = (() => {
    const stage05 = workflowRun?.artifacts["05"];
    const value = stage05?.status === "passed" ? stage05.payload.bundleFingerprint : null;
    return typeof value === "string" ? value.trim() : "";
  })();
  const workflowStage05BenchmarkSummary = useMemo(
    () => normalizeDeveloperWorkflowPerformanceBenchmarkSummary(
      workflowRun?.artifacts["05"]?.payload.benchmarkSummary,
    ),
    [workflowRun?.artifacts],
  );

  const renderActiveWorkbench = () => {
    if (activeTool === "page-lock") return renderPageLockWorkspace();
    if (activeTool === "page-factory") {
      return (
        <section data-development-standard-page-factory-lifecycle className="flex h-full min-h-0 flex-col overflow-hidden">
          <header className="shrink-0 space-y-2 border-b border-current/15 px-3 py-2">
            <div>
              <b>07 页面工厂 · 只读治理视图</b>
              <p className="mt-1 text-[11px] leading-5 opacity-70">页面工厂集中负责登记、覆盖率、版本、快照和恢复边界；这里统一查阅 01 至 06 的执行证据与 08 锁定回执，不自动改写业务页面。</p>
            </div>
            <ol data-page-factory-usage-guide className="list-decimal space-y-1 pl-5 text-[11px] leading-5 opacity-75">{PAGE_FACTORY_USAGE_STEPS.map((step) => <li key={step}>{step}</li>)}</ol>
            <p data-page-factory-protected-boundary className="rounded-md border border-current/15 px-2 py-1.5 text-[11px] leading-5"><b>固定保护边界：</b>{PAGE_FACTORY_PROTECTED_BOUNDARY}</p>
          </header>
          <div className="min-h-0 flex-1 overflow-hidden" data-page-factory-read-only-coverage>
            <Suspense fallback={<DeveloperApplicationLoading label="正在按需加载页面工厂生命周期…" />}>
              <LazyPageFactoryWorkbench pathname={pathname} search={search} sourceLabel={sourceLabel} readOnly developerRecords={developerRecords} onSourceRecordsResolved={resolvePageFactorySourceRecords} onNavigate={navigate} />
            </Suspense>
          </div>
        </section>
      );
    }
    if (activeTool === "shared-contract") {
      return (
        <Suspense fallback={<DeveloperApplicationLoading label="正在加载共享契约…" />}>
          <LazySharedContractWorkbench
            pathname={pathname}
            search={search}
            scope={performanceExperienceScope}
            workflowScope={workflowScope}
            workflowPageDna={workflowPageDna}
            workflowScopeIdentity={workflowScopeIdentity}
            workflowTargetManifestFingerprint={workflowTargetManifestFingerprint}
            onWorkflowArtifact={recordStage02}
          />
        </Suspense>
      );
    }
    if (activeTool === "figma-ui") {
      return (
        <Suspense fallback={<DeveloperApplicationLoading label="正在按需加载 Figma 设计桥…" />}>
          <LazyDeveloperFigmaDesignWorkbench readOnly={readOnly || effectiveWriteLocked} workflowScope={workflowScope} workflowPageDna={workflowPageDna} onWorkflowScopeChange={changeWorkflowScope} onWorkflowArtifact={recordStage03} />
        </Suspense>
      );
    }
    if (activeTool === "visual-evidence") {
      return (
        <Suspense fallback={<DeveloperApplicationLoading label="正在按需生成可视化证据…" />}>
          <LazyDeveloperVisualEvidenceWorkbench workflowScope={workflowScope} workflowPageDna={workflowPageDna} runtimeTargetPageDna={workflowRuntimeTargetPageDna} workflowTargetManifestFingerprint={workflowTargetManifestFingerprint} onWorkflowScopeChange={changeWorkflowScope} onWorkflowArtifact={recordStage04} globalBatchRunning={globalBatchRunning} globalBatchStatus={workflowRun?.artifacts["04"]?.status ?? null} onRunGlobalBatch={runGlobalWorkflowBatch} />
        </Suspense>
      );
    }
    if (activeTool === "performance-experience") {
      return (
        <Suspense fallback={<DeveloperApplicationLoading label="正在加载当前页体验检测…" />}>
          <LazyPerformanceExperienceWorkbench
            scope={performanceExperienceScope}
            readOnly={readOnly}
            workflowScope={workflowScope}
            workflowRunId={workflowRun?.id ?? ""}
            workflowScopeIdentity={workflowScopeIdentity}
            workflowSourceFingerprint={workflowRun?.sourceFingerprint ?? workflowPageDna.sourceFingerprint}
            workflowContractVersion={workflowRun?.contractVersion ?? DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version}
            workflowTargetCount={workflowTargetIds.length}
            workflowTargetManifestFingerprint={workflowTargetManifestFingerprint}
            workflowTargetIds={workflowTargetIds}
            initialReport={workflowScope === "global" ? activeGlobalAuditReport : null}
            benchmarkSummary={workflowStage05BenchmarkSummary}
            onGlobalAuditReport={cacheGlobalAuditReport}
            onWorkflowArtifact={recordStage05}
          />
        </Suspense>
      );
    }
    if (activeTool === "quality-release") {
      return (
        <Suspense fallback={<DeveloperApplicationLoading label="正在加载质量与发布中心…" />}>
          <LazyPerformanceQualityReleaseWorkbench
            pathname={pathname}
            search={search}
            scope={performanceExperienceScope}
            workflowScope={workflowScope}
            onWorkflowScopeChange={changeWorkflowScope}
            onWorkflowArtifact={recordStage06}
            initialReport={workflowScope === "global" ? activeGlobalAuditReport : null}
            onAuditReport={cacheGlobalAuditReport}
            initialPrEvidence={activePrEvidence}
            onPrEvidence={cacheVerifiedPrEvidence}
            workflowScopeIdentity={workflowScopeIdentity}
            workflowRunId={workflowRun?.id ?? ""}
            workflowContractVersion={workflowRun?.contractVersion ?? DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version}
            workflowSourceFingerprint={workflowRun?.sourceFingerprint || workflowPageDna.sourceFingerprint}
            workflowTargetManifestFingerprint={workflowTargetManifestFingerprint}
            workflowTargetIds={workflowTargetIds}
            workflowStage05BundleFingerprint={workflowStage05BundleFingerprint}
            workflowNormalizedRoute={workflowPageDna.normalizedRoute}
          />
        </Suspense>
      );
    }
    return (
      <UnifiedFrameMigrationWorkbench
        pathname={pathname}
        search={search}
        sourceLabel={sourceLabel}
        readOnly={readOnly}
        writeLocked={effectiveWriteLocked}
        structureLocked={effectiveStructureLocked}
        workflowScope={workflowScope}
        workflowScopeIdentity={workflowScopeIdentity}
        releaseAuthorization={globalFrameReleaseAuthorization}
      />
    );
  };

  const footerSummary = activeTool === "page-lock"
    ? pageLockSummary
    : activeTool === "figma-ui"
      ? "Design 引用与标准快照 · 不保存凭证、不直接写源码"
      : activeTool === "visual-evidence"
        ? "页面 DNA · Figma 差异 · 三屏、媒体与影响证据"
    : activeTool === "performance-experience"
      ? "当前路由实时体检 · 可逆加载策略"
      : activeTool === "quality-release"
        ? "当前页或全局审计 · 结果进入 PR 复核"
        : activeTool === "page-factory"
          ? "01 至 06 执行证据与 08 锁定回执总账 · 覆盖率、版本、快照与恢复边界"
        : activeTool === "shared-contract"
          ? "共享预算、结构和回归规则 · 三端读取同一契约"
          : `全局框架工作流 · 页面结构锁${effectiveStructureLocked ? "已启用" : "未启用"}`;

  return (
    <section data-development-standard-apply-console data-development-standard-responsive-frame data-development-standard-top-level-count={DEVELOPER_TOP_LEVEL_APPS.length} data-development-standard-navigation-order-migration={DEVELOPER_NAVIGATION_ORDER_ALIASES.map((alias) => `${alias.previousOrder}:${alias.appId}->${alias.currentOrder}`).join(",")} data-development-standard-vertical-marker-contract={VERTICAL_CONTEXT_CAPSULE_CONTRACT.sectionIds.join(",")} data-shared-page-workspace data-page-layout-frame data-shared-window-region="content" className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ backgroundColor: "var(--tradepro-panel-bg, #ffffff)", color: "var(--tradepro-panel-text, #0f172a)", fontFamily: "var(--tradepro-shared-title-font-family, var(--tradepro-global-font-family, inherit))", fontSize: "var(--tradepro-page-body-size, 0.875rem)" }}>
      <nav data-development-standard-style-nav data-development-standard-runtime-tools={DEVELOPER_TOP_LEVEL_APPS.map((item) => item.id).join(",")} data-development-standard-region-label="topbar" data-shared-layout-section="header" data-shared-window-region="topbar" data-developer-app-scroll-owner data-drag-handle title="按住表头空白处可移动窗口" className="app-topbar order-2 flex shrink-0 cursor-move flex-nowrap gap-1.5 overflow-x-auto rounded-none border py-1.5 pl-2 pr-12" aria-label={`${sourceLabel}开发器应用流程表头`} style={{ backgroundColor: "var(--tradepro-shared-table-bg, var(--tradepro-panel-table-bg, var(--tradepro-panel-bg)))", color: "var(--tradepro-shared-table-text, var(--tradepro-panel-table-text, var(--tradepro-panel-text)))", borderColor: "var(--tradepro-shared-table-border, var(--tradepro-shell-border))", fontSize: "var(--tradepro-shared-table-header-font-size, 0.75rem)", fontWeight: "var(--tradepro-shared-table-header-font-weight, 500)" }}>
        {DEVELOPER_TOP_LEVEL_APPS.map((item) => (
          <Button
            key={item.id}
            data-development-standard-style-nav-item={item.id}
            data-development-standard-region-label="topbar"
            data-shared-selection-control="true"
            data-selected={item.id === activeTool}
            data-state={item.id === activeTool ? "active" : "inactive"}
            aria-pressed={item.id === activeTool}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 shrink-0 px-2 text-inherit"
            style={{
              flex: "0 0 auto",
              backgroundColor: item.id === activeTool ? "var(--tradepro-shared-selection-bg, var(--tradepro-panel-action-bg))" : "color-mix(in srgb, var(--tradepro-shared-table-text, var(--tradepro-panel-table-text, var(--tradepro-panel-text))) 10%, transparent)",
              color: item.id === activeTool ? "var(--tradepro-shared-selection-text, var(--tradepro-panel-action-text))" : "var(--tradepro-shared-table-text, var(--tradepro-panel-table-text, var(--tradepro-panel-text)))",
              borderColor: item.id === activeTool ? "var(--tradepro-shared-selection-outline, var(--tradepro-shell-border))" : "color-mix(in srgb, var(--tradepro-shared-table-text, var(--tradepro-panel-table-text, var(--tradepro-panel-text))) 42%, transparent)",
            }}
            onPointerEnter={() => scheduleDeveloperApplicationHoverPreload(item.id)}
            onPointerLeave={cancelDeveloperApplicationHoverPreload}
            onPointerDown={() => preloadDeveloperApplication(item.id)}
            onFocus={() => preloadDeveloperApplication(item.id)}
            onClick={() => {
              setActiveTool(item.id);
              setCustomLockPanelOpen(false);
            }}
          >
            <span className="mr-1 opacity-70">{item.order}</span>{item.label}
          </Button>
        ))}
      </nav>

      <DialogHeader data-development-standard-title-header data-shared-layout-section="title" data-shared-window-region="title" className="relative order-1 shrink-0 space-y-0 border-b text-left" style={{ display: "flex", flexDirection: "column", backgroundColor: "var(--tradepro-shared-title-bg, var(--tradepro-panel-title-bg))", color: "var(--tradepro-shared-title-text, var(--tradepro-panel-title-text))", borderColor: "var(--tradepro-shared-title-border, var(--tradepro-shell-border))", rowGap: "var(--tradepro-shared-title-gap, 0.625rem)", padding: "var(--tradepro-shared-title-padding, 0.875rem 1.25rem)", minHeight: "var(--tradepro-shared-title-frame-min-height, auto)", width: "var(--tradepro-shared-title-width, 100%)", justifyContent: "var(--tradepro-shared-title-justify, flex-start)", alignItems: "var(--tradepro-shared-title-align, flex-start)", fontSize: "var(--tradepro-shared-title-font-size, 0.75rem)", fontWeight: "var(--tradepro-shared-title-font-weight, 500)", fontFamily: "var(--tradepro-shared-title-font-family, inherit)" }}>
        <div data-shared-title-action-layout data-shared-title-action-layout-contract="inline-rail" data-shared-title-action-alignment-contract={SHARED_WINDOW_TITLE_ACTION_ALIGNMENT_CONTRACT} data-responsive-live-title-layout data-responsive-capacity-row data-responsive-capacity-flow="inline" className="grid min-w-0 grid-cols-[minmax(8rem,1fr)_fit-content(36rem)] items-center gap-2 pr-12">
          <div data-shared-window-title-copy-stack className="flex min-w-0 flex-col justify-center gap-2">
            <DialogTitle data-development-standard-current-path data-shared-title-heading data-page-title-content data-development-standard-region-label="title" title={`开发路径：${developerBreadcrumb}`} className="flex min-w-0 items-baseline gap-1 text-inherit font-[inherit]" style={{ margin: 0, color: "inherit", fontSize: "var(--tradepro-shared-title-heading-size, 1.25rem)", fontWeight: "var(--tradepro-shared-title-font-weight, 500)", lineHeight: "var(--tradepro-shared-title-heading-line-height, 1.25)" }}><span data-development-standard-application-title className="shrink-0">{sourceLabel}开发器</span><span data-development-standard-title-path className="min-w-0 truncate font-[inherit]">· {developerToolPath}</span></DialogTitle>
            <DialogDescription data-development-standard-explanation data-shared-title-description className="flex min-h-5 w-full min-w-0 items-center gap-2 text-inherit font-normal" style={{ margin: 0, color: "inherit", gap: "var(--tradepro-shared-title-description-gap, 0.5rem)", fontSize: "var(--tradepro-shared-title-description-font-size, 0.75rem)", fontWeight: 400, lineHeight: "var(--tradepro-shared-title-description-line-height, 1.25rem)", opacity: 0.8 }}><span data-development-standard-title-explanation={activeTool}>{activeDefinition.description}</span>{activeTool === "page-factory" ? <span data-developer-page-factory-notice className="min-w-0 truncate opacity-70">· 汇总 01 至 06 与既有 08 回执，下一步进入 08 最终保护门</span> : activeTool !== "page-lock" ? <span data-developer-workflow-notice className="min-w-0 truncate opacity-70">· {workflowNotice || `${workflowScope === "global" ? "全局" : "当前页"}流程 ${workflowPassedCount}/6`}</span> : null}</DialogDescription>
          </div>
          {activeTool === "page-lock" ? (
            <div data-page-title-actions data-development-standard-page-lock-action-rail data-shared-title-action-rail="true" data-shared-window-title-actions="inline" data-responsive-title-action-rail="shared" data-shared-function-actions data-responsive-capacity-row="host-actions" data-responsive-capacity-flow="inline" className="flex min-w-0 flex-nowrap items-center justify-start gap-1">
              <label data-development-standard-page-lock-filter data-development-standard-page-lock-filter-capsule className="relative flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md border pl-3 pr-2 text-[11px] font-normal" style={{ borderColor: "color-mix(in srgb, var(--tradepro-shared-title-text, var(--tradepro-panel-title-text)) 52%, transparent)" }}>
                <span data-development-standard-page-lock-filter-label className="pointer-events-none whitespace-nowrap">{selectedPrimaryColumnLabel}</span>
                <ChevronDown data-development-standard-page-lock-filter-chevron aria-hidden="true" className="pointer-events-none block size-3.5 shrink-0 opacity-75" />
                <select data-development-standard-page-lock-filter-select aria-label="按栏目分组快速筛选页面锁定器" value={selectedPrimaryColumn} disabled={lockOperationRunning} onChange={(event) => setSelectedPrimaryColumn(event.currentTarget.value)} className="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none opacity-0">
                  <option value="all" style={{ backgroundColor: "#ffffff", color: "#0f172a" }}>全部一级栏</option>
                  <option value="product-market" style={{ backgroundColor: "#ffffff", color: "#0f172a" }}>产品市场</option>
                  {primaryColumnOptions.map((item) => <option key={item.id} value={getPageLockTreeSelectionKey(item)} style={{ backgroundColor: "#ffffff", color: "#0f172a" }}>{item.level === 0 ? item.label : `${item.projection === "client-source-governance" ? "共享" : "一级"} ${item.columnCode}栏 · ${item.label}`}</option>)}
                </select>
              </label>
              {PAGE_LOCK_RULES.map((rule) => <Button key={rule.kind} data-development-standard-page-lock-action data-development-standard-lock-guide-owner="title" type="button" size="sm" variant="outline" disabled={lockOperationRunning} title={rule.guide} className="h-8 px-2 text-[10px]" onClick={() => void applyLockBatch(rule.kind, "all", true)}>{rule.label}</Button>)}
              <Button data-development-standard-page-lock-action type="button" size="sm" variant="outline" disabled={lockOperationRunning} className="h-8 px-2 text-[10px]" aria-expanded={customLockPanelOpen} onClick={() => setCustomLockPanelOpen((current) => !current)}>自定义规则</Button>
              <Button data-development-standard-page-lock-action type="button" size="sm" disabled={lockOperationRunning} className="h-8 px-1.5 text-[10px]" onClick={() => void applyAllFilteredLocks(true)}>全锁</Button>
              <Button data-development-standard-page-lock-action type="button" size="sm" variant="outline" disabled={lockOperationRunning} className="h-8 px-1.5 text-[10px]" onClick={() => void applyAllFilteredLocks(false)}>解除</Button>
            </div>
          ) : activeTool === "page-factory" && nextDefinition ? (
            <div data-page-title-actions data-development-standard-page-factory-action-rail data-shared-title-action-rail="true" data-shared-window-title-actions="inline" data-responsive-title-action-rail="shared" data-shared-function-actions className="flex min-w-0 items-center justify-end gap-1.5">
              <span data-development-standard-page-factory-read-only-status className="shrink-0 text-[10px] opacity-70">只读治理</span>
              <Button
                data-development-standard-next-step={nextDefinition.id}
                data-development-standard-next-gate-status="not-applicable"
                type="button"
                size="sm"
                className="h-8 max-w-[min(20rem,42vw)] truncate px-2 text-[10px]"
                title={`进入下一步：${nextDefinition.order} ${nextDefinition.label}`}
                onPointerEnter={() => preloadDeveloperApplication(nextDefinition.id)}
                onPointerDown={() => preloadDeveloperApplication(nextDefinition.id)}
                onFocus={() => preloadDeveloperApplication(nextDefinition.id)}
                onClick={() => {
                  setActiveTool(nextDefinition.id);
                  setCustomLockPanelOpen(false);
                }}
              >
                下一步：{nextDefinition.order} {nextDefinition.label}
              </Button>
            </div>
          ) : nextDefinition ? (
            <div data-page-title-actions data-shared-title-action-rail="true" data-shared-window-title-actions="inline" data-responsive-title-action-rail="shared" data-shared-function-actions className="flex min-w-0 items-center justify-end gap-1.5">
              <div
                data-development-standard-application-scope={workflowScope}
                data-development-standard-application-scope-options="separate-capsules"
                data-shared-selection-group="right-side"
                data-developer-workflow-scope-identity={workflowRun?.scopeIdentity || "pending"}
                className="flex shrink-0 items-center gap-1.5"
                aria-label="01 至 06 统一优化范围"
              >
                <span
                  data-development-standard-application-scope-capsule="current-page"
                  data-selected={workflowScope === "page"}
                  className="flex h-8 shrink-0 overflow-hidden rounded-full border"
                  style={{
                    borderColor: workflowScope === "page" ? "var(--tradepro-shared-selection-outline, var(--tradepro-panel-action-bg))" : "color-mix(in srgb, currentColor 36%, transparent)",
                    backgroundColor: workflowScope === "page" ? "var(--tradepro-shared-selection-bg, var(--tradepro-panel-action-bg))" : "transparent",
                    color: workflowScope === "page" ? "var(--tradepro-shared-selection-text, var(--tradepro-panel-action-text))" : "inherit",
                    boxShadow: workflowScope === "page" ? "inset 0 0 0 1px var(--tradepro-shared-selection-outline, var(--tradepro-panel-action-bg))" : "none",
                  }}
                >
                  <Button
                    data-development-standard-application-scope-option="current-page"
                    data-shared-selection-control="true"
                    data-selected={workflowScope === "page"}
                    data-state={workflowScope === "page" ? "active" : "inactive"}
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-pressed={workflowScope === "page"}
                    className="h-full shrink-0 rounded-none border-0 px-2.5 text-[9px] text-inherit shadow-none"
                    onClick={() => changeWorkflowScope("page")}
                  >
                    当前页
                  </Button>
                </span>
                <span
                  data-development-standard-application-scope-capsule="global"
                  data-selected={workflowScope === "global"}
                  className="flex h-8 shrink-0 overflow-hidden rounded-full border"
                  style={{
                    borderColor: workflowScope === "global" ? "var(--tradepro-shared-selection-outline, var(--tradepro-panel-action-bg))" : "color-mix(in srgb, currentColor 36%, transparent)",
                    backgroundColor: workflowScope === "global" ? "var(--tradepro-shared-selection-bg, var(--tradepro-panel-action-bg))" : "transparent",
                    color: workflowScope === "global" ? "var(--tradepro-shared-selection-text, var(--tradepro-panel-action-text))" : "inherit",
                    boxShadow: workflowScope === "global" ? "inset 0 0 0 1px var(--tradepro-shared-selection-outline, var(--tradepro-panel-action-bg))" : "none",
                  }}
                >
                  <Button
                    data-development-standard-application-scope-option="global"
                    data-shared-selection-control="true"
                    data-selected={workflowScope === "global"}
                    data-state={workflowScope === "global" ? "active" : "inactive"}
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-pressed={workflowScope === "global"}
                    className="h-full shrink-0 rounded-none border-0 px-2.5 text-[9px] text-inherit shadow-none"
                    onClick={() => changeWorkflowScope("global")}
                  >
                    全局
                  </Button>
                </span>
              </div>
              <span data-developer-workflow-progress={`${workflowPassedCount}/6`} className="shrink-0 text-[9px] opacity-65">{workflowPassedCount}/6</span>
              <Button
                data-development-standard-next-step={nextDefinition.id}
                data-development-standard-next-gate-status={activeWorkflowArtifact?.status || "pending"}
                type="button"
                size="sm"
                disabled={!activeWorkflowStagePassed}
                className="h-8 max-w-[min(20rem,42vw)] truncate px-2 text-[10px]"
                title={activeWorkflowStagePassed
                  ? `进入下一步：${nextDefinition.order} ${nextDefinition.label}`
                  : `请先完成 ${activeDefinition.order} ${activeDefinition.label}；当前状态：${activeWorkflowArtifact?.status || workflowGate?.reason || "pending"}`}
                onPointerEnter={() => preloadDeveloperApplication(nextDefinition.id)}
                onPointerDown={() => preloadDeveloperApplication(nextDefinition.id)}
                onFocus={() => preloadDeveloperApplication(nextDefinition.id)}
                onClick={() => {
                  setActiveTool(nextDefinition.id);
                  setCustomLockPanelOpen(false);
                }}
              >
                下一步：{nextDefinition.order} {nextDefinition.label}
              </Button>
            </div>
          ) : null}
        </div>
        <DeveloperLoadingSpeedLearningPlan appId={activeTool} loadPlan={workflowPageDna.loadPlan} scope={workflowScope} />
        {activeTool === "page-lock" && customLockPanelOpen ? (
          <section data-development-standard-lock-rule-panel className="absolute right-3 top-full z-40 mt-1 w-[min(31rem,calc(100%-1.5rem))] rounded-lg border p-3 text-[12px] leading-5 shadow-2xl" style={{ backgroundColor: "#0b1220", color: "#f8fafc", borderColor: "#60a5fa", boxShadow: "0 14px 30px rgba(2, 6, 23, 0.45)" }}>
            <div className="flex items-center justify-between gap-3"><strong className="text-sm">自定义锁定规则</strong><button type="button" aria-label="关闭自定义锁定规则" className="grid size-7 place-items-center rounded-md border border-white/25 text-base hover:bg-white/10" onClick={() => setCustomLockPanelOpen(false)}>×</button></div>
            <p className="mt-1 text-slate-200">请选择范围、锁种与动作。页面锁中的保存、同步、发布保持联动，避免发布旧版本。</p>
            <fieldset className="mt-3 grid gap-1 rounded-md border border-white/20 p-2"><legend className="px-1 text-slate-300">作用范围</legend>{([ ["all", "全部层级（一级、二级、三级）"], ["primary", "仅一级栏目"], ["secondary", "二级及三级栏目"] ] as const).map(([scope, label]) => <label key={scope} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-white/10"><input type="radio" name="page-lock-scope" checked={customLockScope === scope} onChange={() => setCustomLockScope(scope)} />{label}</label>)}</fieldset>
            <fieldset className="mt-3 grid gap-1 rounded-md border border-white/20 p-2"><legend className="px-1 text-slate-300">选择锁种</legend>{PAGE_LOCK_RULES.map((rule) => <label key={rule.kind} data-development-standard-custom-lock-kind={rule.kind} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-white/10"><input type="checkbox" checked={customLockKinds.includes(rule.kind)} onChange={(event) => setCustomLockKinds((current) => event.currentTarget.checked ? [...current, rule.kind] : current.filter((kind) => kind !== rule.kind))} /><b>{rule.label}</b></label>)}</fieldset>
            <div className="mt-3 flex flex-wrap items-center gap-2"><Button type="button" size="sm" disabled={lockOperationRunning} variant={customLockMode === "lock" ? "default" : "outline"} onClick={() => setCustomLockMode("lock")}>打√锁住</Button><Button type="button" size="sm" disabled={lockOperationRunning} variant={customLockMode === "unlock" ? "default" : "outline"} onClick={() => setCustomLockMode("unlock")}>打×解除</Button><Button type="button" size="sm" disabled={lockOperationRunning} className="ml-auto" onClick={() => void applyCustomLockRules()}>{lockOperationRunning ? "处理中…" : customLockMode === "lock" ? "应用锁定" : "应用解除"}</Button></div>
          </section>
        ) : null}
      </DialogHeader>

      <div data-shared-layout-section="content" data-shared-window-region="content" data-development-standard-content-frame className={`order-3 grid min-h-0 flex-1 overflow-hidden ${activeTool === "page-factory" ? "grid-rows-1" : "grid-rows-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,1fr)_22rem] xl:grid-rows-1"}`}>
        <div className="min-h-0 min-w-0 overflow-hidden">{renderActiveWorkbench()}</div>
        {activeTool !== "page-factory" ? <aside data-development-standard-application-record-projection className="max-h-[min(16rem,38vh)] min-w-0 overflow-y-auto border-t border-current/15 p-2 xl:max-h-none xl:border-l xl:border-t-0">
          <DeveloperRecordPanel records={developerRecords} activeAppId={activeTool} mode="projection" sourceRecordsResolved={pageFactorySourceRecordsResolved} onOpenLedger={openDeveloperRecordLedger} />
        </aside> : null}
      </div>

      <footer data-development-standard-application-footer data-development-standard-fullwidth-footer data-page-layout-footer data-shared-layout-section="footer" data-shared-window-region="footer" className="order-4 flex w-full shrink-0 flex-wrap items-center justify-between gap-2 border px-3 py-2">
        <div data-shared-window-footer-leading className="flex min-w-0 flex-wrap items-center gap-2">
          {activeTool !== "page-factory" ? <div data-shared-window-footer-lock-slot>
            <PageFooterLockControls
              compact
              sourceLocked={effectiveSourceLocked}
              pageLocked={effectiveHardLocked}
              columnLocked={effectiveStructureLocked}
              onToggleSource={() => { void toggleFooterSourceLock(); }}
              onTogglePage={toggleFooterPageLock}
              onToggleColumn={toggleFooterColumnLock}
            />
          </div> : null}
          <span data-developer-active-footer-summary={activeTool} data-shared-window-footer-status className="min-w-0 text-[10px] leading-4 sm:text-[11px]">{footerSummary}</span>
        </div>
        <span data-shared-window-footer-note className="text-[10px] opacity-70">{activeDefinition.footer}</span>
      </footer>
    </section>
  );
}
