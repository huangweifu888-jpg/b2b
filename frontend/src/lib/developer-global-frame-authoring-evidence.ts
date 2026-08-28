import {
  resolveDeveloperGlobalFrameAdapterForRoute,
  type DeveloperGlobalFrameAdapterResolution,
} from "@/lib/developer-global-frame-adapter-resolution";

export const DEVELOPER_GLOBAL_FRAME_AUTHORING_EVIDENCE_VERSION = "2026.08.23.1" as const;

export type DeveloperGlobalFrameAuthoringEvidenceCheck = {
  id: string;
  label: string;
  status: "passed" | "issue";
  detail: string;
};

export type DeveloperGlobalFrameAuthoringEvidence = {
  version: typeof DEVELOPER_GLOBAL_FRAME_AUTHORING_EVIDENCE_VERSION;
  passed: boolean;
  pageFactoryId: string | null;
  adapterId: string | null;
  strategy: DeveloperGlobalFrameAdapterResolution["strategy"] | null;
  checks: DeveloperGlobalFrameAuthoringEvidenceCheck[];
};

const SHA256 = /^[0-9a-f]{64}$/u;

function visibleElements(root: ParentNode, documentRoot: Document, selector: string) {
  const view = documentRoot.defaultView;
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((element) => {
    const style = view?.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style?.display !== "none"
      && style?.visibility !== "hidden"
      && rect.width > 0
      && rect.height > 0;
  });
}

function expectedResponsiveScope(resolution: DeveloperGlobalFrameAdapterResolution) {
  if (resolution.sourceScope === "agency_source") return "agency-source";
  if (resolution.sourceScope === "client_source") return "client-source";
  return "hq";
}

function addCheck(
  checks: DeveloperGlobalFrameAuthoringEvidenceCheck[],
  id: string,
  label: string,
  passed: boolean,
  passedDetail: string,
  issueDetail: string,
) {
  checks.push({ id, label, status: passed ? "passed" : "issue", detail: passed ? passedDetail : issueDetail });
}

/**
 * Authoring evidence is deliberately page-owned and route-bound. It verifies
 * the runtime adapter actually mounted the current page into the shared frame;
 * it does not treat legacy document-wide visual heuristics as release facts.
 */
export function inspectDeveloperGlobalFrameAuthoringRuntimeEvidence({
  pathname,
  search = "",
  documentRoot = typeof document === "undefined" ? null : document,
}: {
  pathname: string;
  search?: string;
  documentRoot?: Document | null;
}): DeveloperGlobalFrameAuthoringEvidence {
  const checks: DeveloperGlobalFrameAuthoringEvidenceCheck[] = [];
  const resolution = resolveDeveloperGlobalFrameAdapterForRoute(pathname, search);
  addCheck(
    checks,
    "authoring-route-resolution-v1",
    "当前路由精确适配",
    Boolean(resolution),
    resolution ? `${resolution.pageFactoryId} · ${resolution.adapterId} · ${resolution.strategy}` : "",
    "当前路由没有唯一页面工厂身份与共享框架适配器，保持隔离。",
  );

  if (!documentRoot) {
    addCheck(checks, "authoring-document-v1", "当前页面文档", false, "", "当前环境没有可检查的页面文档。");
    return {
      version: DEVELOPER_GLOBAL_FRAME_AUTHORING_EVIDENCE_VERSION,
      passed: false,
      pageFactoryId: resolution?.pageFactoryId ?? null,
      adapterId: resolution?.adapterId ?? null,
      strategy: resolution?.strategy ?? null,
      checks,
    };
  }

  const hosts = visibleElements(documentRoot, documentRoot, "[data-responsive-page-host]");
  const host = hosts.length === 1 ? hosts[0] : null;
  const hostIdentityMatches = Boolean(host && resolution
    && host.dataset.responsivePageRoute === pathname
    && host.dataset.responsivePageScope === expectedResponsiveScope(resolution)
    && host.dataset.developerGlobalFrameResolvedPageId === resolution.pageFactoryId
    && host.dataset.developerGlobalFrameResolvedAdapter === resolution.adapterId
    && host.dataset.developerGlobalFrameResolvedStrategy === resolution.strategy);
  addCheck(
    checks,
    "authoring-responsive-host-v1",
    "唯一响应宿主",
    hosts.length === 1 && hostIdentityMatches,
    host && resolution ? `${resolution.pageFactoryId} 已绑定唯一宿主。` : "",
    hosts.length !== 1
      ? `当前文档可见响应宿主数量为 ${hosts.length}，必须恰好为 1。`
      : "响应宿主的 route、scope、pageFactoryId、adapter 或 strategy 与当前路由解析不一致。",
  );

  const contentReady = host?.dataset.responsiveContentReady === "true";
  addCheck(
    checks,
    "authoring-content-ready-v1",
    "页面内容就绪",
    contentReady,
    "响应宿主已完成内容稳定等待。",
    "响应宿主尚未报告 data-responsive-content-ready=true，请等待页面稳定后重试。",
  );

  const sharedContractValues = host ? [
    host.dataset.responsivePageFactoryDefault,
    host.dataset.responsiveAdaptiveStructure,
    host.dataset.responsiveMobileArchitecture,
    host.dataset.sharedAdaptiveSurfaceContract,
    host.dataset.sharedWindowContract,
  ] : [];
  const sharedContractsReady = sharedContractValues.length === 5
    && sharedContractValues.every((value) => typeof value === "string" && value.trim().length > 0);
  const titleSurfaces = host
    ? visibleElements(host, documentRoot, "[data-responsive-shared-surface='title-1'], [data-shared-adaptive-surface='title-1']")
    : [];
  const contentSurfaces = host
    ? visibleElements(host, documentRoot, "[data-shared-adaptive-surface='content']")
    : [];
  const surfaceContract = host?.dataset.sharedAdaptiveSurfaceContract ?? "";
  const surfacesMatchContract = [...titleSurfaces, ...contentSurfaces].every(
    (surface) => surface.dataset.sharedAdaptiveSurfaceContract === surfaceContract,
  );
  addCheck(
    checks,
    "authoring-shared-contracts-v1",
    "共享框架运行时契约",
    sharedContractsReady && titleSurfaces.length === 1 && contentSurfaces.length >= 1 && surfacesMatchContract,
    `页面工厂、三端响应、共享窗口和自适应表面已挂载（${surfaceContract}）。`,
    "页面缺少唯一标题表面、内容表面，或页面工厂/三端响应/共享窗口的版本化运行时标记不完整。",
  );

  const boundaries = host
    ? visibleElements(host, documentRoot, "[data-responsive-factory-workspace-boundary='true']")
    : [];
  const boundary = boundaries.length === 1 ? boundaries[0] : null;
  addCheck(
    checks,
    "authoring-workspace-boundary-v1",
    "唯一主体边界",
    boundaries.length === 1,
    "当前页面工厂主体边界唯一。",
    `当前响应宿主可见主体边界数量为 ${boundaries.length}，必须恰好为 1。`,
  );

  const scrollOwners = host
    ? [...new Set(visibleElements(host, documentRoot, "[data-page-list-scroll-owner], [data-product-market-scroll-list]"))]
    : [];
  const scrollOwnerInsideBoundary = scrollOwners.length === 1
    && Boolean(boundary?.contains(scrollOwners[0]));
  addCheck(
    checks,
    "authoring-scroll-owner-v1",
    "唯一内容滚动条",
    scrollOwnerInsideBoundary,
    "唯一可见内容滚动 owner 位于当前主体边界内。",
    `当前响应宿主可见内容滚动 owner 数量为 ${scrollOwners.length}，或滚动 owner 不属于当前主体边界。`,
  );

  const appMain = host?.closest<HTMLElement>(".app-main, .app-main-roomy") ?? null;
  const directMarkerAreas = appMain
    ? visibleElements(appMain, documentRoot, ":scope > [data-existing-workspace-body-marker-hit-area='left']")
    : [];
  const fallbackMarkerAreas = appMain
    ? visibleElements(appMain, documentRoot, ":scope > [data-responsive-factory-body-marker-hit-area='true']")
    : [];
  const markerAreaCount = directMarkerAreas.length + fallbackMarkerAreas.length;
  addCheck(
    checks,
    "authoring-subject-hit-area-v1",
    "主体左侧命中层",
    markerAreaCount === 1,
    directMarkerAreas.length === 1 ? "使用共享工作区左侧主体命中层。" : "使用页面工厂左侧主体命中层。",
    `当前 app-main 的左侧主体命中层数量为 ${markerAreaCount}，必须在共享命中层和工厂 fallback 中二选一。`,
  );

  const evidenceNodes = host
    ? [host, boundary, host.closest<HTMLElement>("[data-responsive-shell]"), documentRoot.documentElement]
      .filter((node): node is HTMLElement => Boolean(node))
    : [documentRoot.documentElement];
  const publishedNodes = evidenceNodes.filter((node) => Boolean(
    node.dataset.developerGlobalFramePublishedHash
    || node.dataset.developerGlobalFramePublishedVersion
    || node.dataset.developerGlobalFramePublishedHashKind,
  ));
  const publishedHashes = new Set(publishedNodes.map((node) => node.dataset.developerGlobalFramePublishedHash ?? ""));
  const publishedVersions = new Set(publishedNodes.map((node) => node.dataset.developerGlobalFramePublishedVersion ?? ""));
  const publishedKinds = new Set(publishedNodes.map((node) => node.dataset.developerGlobalFramePublishedHashKind ?? ""));
  const publishedEvidenceValid = publishedNodes.length === 0 || (
    publishedHashes.size === 1
    && publishedVersions.size === 1
    && publishedKinds.size === 1
    && SHA256.test([...publishedHashes][0] ?? "")
    && Boolean([...publishedVersions][0])
    && ["published-config-hash", "server-draft-config-hash"].includes([...publishedKinds][0] ?? "")
  );
  addCheck(
    checks,
    "authoring-published-evidence-v1",
    "已发布运行时证据",
    publishedEvidenceValid,
    publishedNodes.length
      ? `已发布版本 ${[...publishedVersions][0]} 使用服务端 hash ${[...publishedHashes][0]?.slice(0, 12)}…。`
      : "当前为未发布作者态；不伪造发布版本或 hash。",
    "当前页面暴露了不完整、冲突或非服务端格式的已发布版本/hash 证据。",
  );

  return {
    version: DEVELOPER_GLOBAL_FRAME_AUTHORING_EVIDENCE_VERSION,
    passed: checks.every((check) => check.status === "passed"),
    pageFactoryId: resolution?.pageFactoryId ?? null,
    adapterId: resolution?.adapterId ?? null,
    strategy: resolution?.strategy ?? null,
    checks,
  };
}
