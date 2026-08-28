import {
  DEVELOPER_GLOBAL_STYLE_PILOT_CHECK_IDS,
  type DeveloperGlobalStylePilotCheckId,
} from "@/lib/developer-global-style-contract";
import {
  EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT,
  existingWorkspaceBodyMarkerHitAreaMatchesGeometry,
  findExistingWorkspaceBodyMarkerHost,
} from "@/lib/layout-frame-contract";

type PilotRegionId = "workspace" | "title" | "table-shell" | "table-header" | "content";
type PilotRect = { left: number; right: number };
type CssQuad = readonly [top: number, right: number, bottom: number, left: number];
type PilotPseudoElement = "::after" | "::before";

const MARKETING_PLAYBOOK_PILOT_PATHNAME = "/zb/client-source/social";
const MARKETING_PLAYBOOK_PILOT_PAGE_ID = "client-social-marketing-playbook";

export const DEVELOPER_FLOW_IDENTITY_QUERY_KEYS = [
  "agentPath",
  "agent_path",
  "tenantId",
  "tenant_id",
  "tenant",
  "clientId",
  "client_id",
  "client",
  "planId",
  "plan_id",
  "plan",
  "siteId",
  "site_id",
] as const;

const DEVELOPER_FLOW_IDENTITY_QUERY_GROUPS = [
  ["agentPath", ["agentPath", "agent_path"]],
  ["tenantId", ["tenantId", "tenant_id", "tenant"]],
  ["clientId", ["clientId", "client_id", "client"]],
  ["planId", ["planId", "plan_id", "plan"]],
  ["siteId", ["siteId", "site_id"]],
] as const;

/** Preserve project identity only; source-tab and unrelated UI query state are dropped. */
export function buildMarketingPlaybookPilotSearch(search: string) {
  const source = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const target = new URLSearchParams({ tab: "marketing-playbook" });
  for (const [canonicalKey, aliases] of DEVELOPER_FLOW_IDENTITY_QUERY_GROUPS) {
    const value = aliases.map((key) => source.get(key)?.trim() || "").find(Boolean);
    if (value) target.set(canonicalKey, value.slice(0, 256));
  }
  target.sort();
  return `?${target.toString()}`;
}

export const MARKETING_PLAYBOOK_DEVELOPER_MARKER_PROOF_SCHEMA_VERSION = "1.1.0" as const;
export const MARKETING_PLAYBOOK_DEVELOPER_MARKER_PROOF_MAX_AGE_MS = 30 * 60 * 1000;

export type MarketingPlaybookDeveloperMarkerProofRegion = {
  label: string;
  pseudo: PilotPseudoElement;
  content: string;
  display: string;
  visibility: string;
  opacity: string;
};

export type MarketingPlaybookDeveloperMarkerProof = {
  schemaVersion: typeof MARKETING_PLAYBOOK_DEVELOPER_MARKER_PROOF_SCHEMA_VERSION;
  contract: {
    version: string;
    referencePageId: string;
  };
  canaryProfileDraftId: string;
  visualAuditId: string;
  workspaceScope: string;
  page: {
    kind: "marketing-pilot";
    pageId: string;
    pathname: string;
    search: string;
  };
  capturedAt: string;
  regions: Record<PilotRegionId, MarketingPlaybookDeveloperMarkerProofRegion>;
};

export type MarketingPlaybookDeveloperMarkerCapture = Omit<MarketingPlaybookDeveloperMarkerProof, "visualAuditId">;

export type MarketingPlaybookDeveloperMarkerProofContext = {
  proof: unknown;
  workspaceScope: string;
  canaryProfileDraftId: string;
  visualAuditId: string;
  sourcePathname: string;
  sourceSearch: string;
  now?: number;
};

export type MarketingPlaybookMarkerEvidence = {
  expectedLabel: string;
  attributeMatches: boolean;
  productionVisible: boolean;
  mechanismAvailable: boolean;
  activation: "developer-open" | "always" | "hover-or-focus" | "none";
  pseudo: PilotPseudoElement | null;
  content: string;
  display: string;
  visibility: string;
  opacity: string;
};

export type MarketingPlaybookPilotSnapshot = {
  routeMatches: boolean;
  regionCounts: Record<PilotRegionId, number>;
  markerEvidence: Record<PilotRegionId, MarketingPlaybookMarkerEvidence>;
  rects: Record<PilotRegionId, PilotRect | null>;
  workspaceMargins: CssQuad;
  workspaceScrollbarGutter: string;
  scrollOwnerCount: number;
  scrollOwnerIsCanonicalContent: boolean;
  contentOverflowX: string;
  contentOverflowY: string;
  contentScrollbarGutter: string;
  contentClientWidth: number;
  contentScrollWidth: number;
  contentClientHeight: number;
  contentScrollHeight: number;
  reference: {
    pageId: string;
    version: string;
    canonicalRootMatches: boolean;
    tableShellPaddingMatches: boolean;
    tableHeaderMinHeightMatches: boolean;
    contentPaddingMatches: boolean;
  };
};

export type MarketingPlaybookPilotCheck = {
  id: DeveloperGlobalStylePilotCheckId;
  passed: boolean;
  detail: string;
};

export type MarketingPlaybookPilotReport = {
  passed: boolean;
  passedCheckIds: DeveloperGlobalStylePilotCheckId[];
  checks: MarketingPlaybookPilotCheck[];
  snapshot: MarketingPlaybookPilotSnapshot;
};

const EXPECTED_MARKERS: Record<PilotRegionId, string> = {
  workspace: EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.labels.workspace,
  title: EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.labels.title,
  "table-shell": EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.labels.tableShell,
  "table-header": EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.labels.tableHeader,
  content: EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.labels.content,
};

const EDGE_TOLERANCE = EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.geometry.edgeToleranceCssPixels;
const withinTolerance = (first: number, second: number, tolerance: number = EDGE_TOLERANCE) => Math.abs(first - second) <= tolerance;
const hasSingleRegions = (snapshot: MarketingPlaybookPilotSnapshot) => Object.values(snapshot.regionCounts).every((count) => count === 1);
const markerMechanismIsReal = (evidence: MarketingPlaybookMarkerEvidence) => (
  evidence.attributeMatches
  && evidence.mechanismAvailable
  && evidence.content === evidence.expectedLabel
  && evidence.display !== "none"
  && evidence.visibility !== "hidden"
  && evidence.visibility !== "collapse"
  && Number.parseFloat(evidence.opacity || "1") > 0
);

const markerProofRegionIsVisible = (
  region: MarketingPlaybookDeveloperMarkerProofRegion | undefined,
  expectedLabel: string,
) => Boolean(region
  && region.label === expectedLabel
  && region.content === expectedLabel
  && region.display !== "none"
  && region.visibility !== "hidden"
  && region.visibility !== "collapse"
  && Number.parseFloat(region.opacity || "1") > 0);

const markerIsAccepted = (
  evidence: MarketingPlaybookMarkerEvidence,
  proofRegion?: MarketingPlaybookDeveloperMarkerProofRegion,
) => markerMechanismIsReal(evidence)
  && markerProofRegionIsVisible(proofRegion, evidence.expectedLabel);

export function evaluateMarketingPlaybookPilotSnapshot(
  snapshot: MarketingPlaybookPilotSnapshot,
  proofContext?: MarketingPlaybookDeveloperMarkerProofContext,
): MarketingPlaybookPilotReport {
  const rects = snapshot.rects;
  const unique = hasSingleRegions(snapshot);
  const developerMarkerProof = proofContext
    ? validateMarketingPlaybookDeveloperMarkerProof(proofContext.proof, proofContext)
    : null;
  const referenceReady = snapshot.reference.pageId === EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.referencePageId
    && snapshot.reference.version === EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.version
    && snapshot.reference.canonicalRootMatches
    && snapshot.reference.tableShellPaddingMatches
    && snapshot.reference.tableHeaderMinHeightMatches
    && snapshot.reference.contentPaddingMatches;
  const workspaceAnnotation = snapshot.routeMatches
    && snapshot.regionCounts.workspace === 1
    && snapshot.regionCounts.title === 1
    && markerIsAccepted(snapshot.markerEvidence.workspace, developerMarkerProof?.regions.workspace)
    && markerIsAccepted(snapshot.markerEvidence.title, developerMarkerProof?.regions.title);
  const tableShellAnnotation = snapshot.routeMatches
    && snapshot.regionCounts["table-shell"] === 1
    && snapshot.regionCounts["table-header"] === 1
    && snapshot.regionCounts.content === 1
    && markerIsAccepted(snapshot.markerEvidence["table-shell"], developerMarkerProof?.regions["table-shell"])
    && markerIsAccepted(snapshot.markerEvidence["table-header"], developerMarkerProof?.regions["table-header"])
    && markerIsAccepted(snapshot.markerEvidence.content, developerMarkerProof?.regions.content);
  const spacingParity = snapshot.routeMatches
    && unique
    && referenceReady
    && Boolean(rects.workspace && rects.title && rects["table-shell"] && rects["table-header"] && rects.content)
    && withinTolerance(rects.workspace!.left, rects.title!.left)
    && withinTolerance(rects.workspace!.left, rects["table-shell"]!.left)
    && withinTolerance(rects["table-header"]!.left, rects.content!.left)
    && snapshot.workspaceMargins.every((margin) => Math.abs(margin) <= 0.5)
    && snapshot.workspaceScrollbarGutter === "auto";
  const realVerticalScrollOwner = snapshot.scrollOwnerCount === 1
    && snapshot.scrollOwnerIsCanonicalContent
    && ["auto", "scroll"].includes(snapshot.contentOverflowY)
    && ["hidden", "clip"].includes(snapshot.contentOverflowX)
    && snapshot.contentScrollHeight > snapshot.contentClientHeight + 1;
  const rightEdgeParity = snapshot.routeMatches
    && unique
    && referenceReady
    && Boolean(rects.workspace && rects.title && rects["table-shell"] && rects["table-header"] && rects.content)
    && withinTolerance(rects.workspace!.right, rects.title!.right)
    && withinTolerance(rects.workspace!.right, rects["table-shell"]!.right)
    && withinTolerance(rects["table-header"]!.right, rects.content!.right)
    && realVerticalScrollOwner
    && snapshot.contentScrollbarGutter.startsWith("stable")
    && snapshot.contentScrollWidth <= snapshot.contentClientWidth + EDGE_TOLERANCE;

  const checks: MarketingPlaybookPilotCheck[] = [
    {
      id: "workspace-annotation",
      passed: workspaceAnnotation,
      detail: workspaceAnnotation
        ? "主体与标题已由同一路由的真实开发态证据确认，当前 DOM 标注机制与契约一致。"
        : "主体/标题缺少同一路由、同草稿审计且未过期的真实开发态证据，或当前 DOM 标注机制不符合契约。",
    },
    {
      id: "table-shell-annotation",
      passed: tableShellAnnotation,
      detail: tableShellAnnotation
        ? "表内、表头与内容已由真实开发态证据确认，当前区域与标注机制唯一。"
        : "表内/表头/内容缺少受绑定的真实开发态证据、标注机制不可用或区域重复。",
    },
    {
      id: "spacing-parity",
      passed: spacingParity,
      detail: spacingParity
        ? `已匹配运营市场 ${snapshot.reference.version} 共享 token 几何基线与左边界关系。`
        : "未匹配运营市场版本化参考、共享 token padding/min-height 或左边界关系。",
    },
    {
      id: "right-edge-parity",
      passed: rightEdgeParity,
      detail: rightEdgeParity
        ? "右边界匹配参考；唯一真实内容滚动宿主具有 computed overflow-y、stable gutter 且无横向溢出。"
        : "右边界、版本化参考或真实滚动宿主的 computed overflow/gutter/溢出检查失败。",
    },
  ];
  const passedCheckIds = checks.filter((check) => check.passed).map((check) => check.id);
  return {
    passed: DEVELOPER_GLOBAL_STYLE_PILOT_CHECK_IDS.every((checkId) => passedCheckIds.includes(checkId)),
    passedCheckIds,
    checks,
    snapshot,
  };
}

export function isMarketingPlaybookPilotRoute(pathname: string, search: string) {
  return pathname === MARKETING_PLAYBOOK_PILOT_PATHNAME
    && new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("tab") === "marketing-playbook";
}

function numericCss(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function cssQuad(style: CSSStyleDeclaration, prefix: "margin" | "padding"): CssQuad {
  return [
    numericCss(style[`${prefix}Top`]),
    numericCss(style[`${prefix}Right`]),
    numericCss(style[`${prefix}Bottom`]),
    numericCss(style[`${prefix}Left`]),
  ];
}

function quadsMatch(actual: CssQuad, expected: CssQuad) {
  return actual.every((value, index) => withinTolerance(value, expected[index], 0.5));
}

function normalizePseudoContent(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "none" || trimmed === "normal" || trimmed === '""') return "";
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
  }
  return trimmed;
}

function readPseudoEvidence(
  view: Window,
  paintElement: HTMLElement,
  expectedLabel: string,
  semanticOwner: HTMLElement = paintElement,
): Array<MarketingPlaybookMarkerEvidence & { pseudo: PilotPseudoElement }> {
  return EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.pseudoElements.map((pseudo) => {
    const style = view.getComputedStyle(paintElement, pseudo);
    const content = normalizePseudoContent(style.content);
    return {
      expectedLabel,
      attributeMatches: semanticOwner.getAttribute("data-development-standard-frame-label") === expectedLabel,
      productionVisible: content === expectedLabel
        && style.display !== "none"
        && style.visibility !== "hidden"
        && style.visibility !== "collapse"
        && Number.parseFloat(style.opacity || "1") > 0,
      mechanismAvailable: content === expectedLabel && style.display !== "none",
      activation: "none",
      pseudo,
      content,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
    };
  });
}

function normalizeProofSearch(search: string) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.sort();
  const normalized = params.toString();
  return normalized ? `?${normalized}` : "";
}

function classifyProofPage(pathname: string, search: string): MarketingPlaybookDeveloperMarkerProof["page"]["kind"] | null {
  if (isMarketingPlaybookPilotRoute(pathname, search)) return "marketing-pilot";
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

const PILOT_REGION_IDS = ["workspace", "title", "table-shell", "table-header", "content"] as const satisfies readonly PilotRegionId[];

export function validateMarketingPlaybookDeveloperMarkerProof(
  value: unknown,
  expected: Omit<MarketingPlaybookDeveloperMarkerProofContext, "proof"> & { savedAt?: string },
): MarketingPlaybookDeveloperMarkerProof | null {
  if (!isRecord(value)
    || !hasExactKeys(value, ["schemaVersion", "contract", "canaryProfileDraftId", "visualAuditId", "workspaceScope", "page", "capturedAt", "regions"])
    || value.schemaVersion !== MARKETING_PLAYBOOK_DEVELOPER_MARKER_PROOF_SCHEMA_VERSION
    || value.canaryProfileDraftId !== expected.canaryProfileDraftId
    || value.visualAuditId !== expected.visualAuditId
    || value.workspaceScope !== expected.workspaceScope
    || !isRecord(value.contract)
    || !hasExactKeys(value.contract, ["version", "referencePageId"])
    || value.contract.version !== EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.version
    || value.contract.referencePageId !== EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.referencePageId
    || !isRecord(value.page)
    || !hasExactKeys(value.page, ["kind", "pageId", "pathname", "search"])
    || value.page.pageId !== MARKETING_PLAYBOOK_PILOT_PAGE_ID
    || value.page.pathname !== MARKETING_PLAYBOOK_PILOT_PATHNAME
    || value.page.pathname !== expected.sourcePathname
    || value.page.search !== normalizeProofSearch(expected.sourceSearch)
    || value.page.kind !== classifyProofPage(expected.sourcePathname, expected.sourceSearch)
    || typeof value.capturedAt !== "string"
    || !Number.isFinite(Date.parse(value.capturedAt))
    || !isRecord(value.regions)
    || !hasExactKeys(value.regions, PILOT_REGION_IDS)) return null;

  const now = expected.now ?? Date.now();
  const capturedAt = Date.parse(value.capturedAt);
  const age = now - capturedAt;
  if (age < -5_000 || age > MARKETING_PLAYBOOK_DEVELOPER_MARKER_PROOF_MAX_AGE_MS) return null;
  if (expected.savedAt) {
    const savedAt = Date.parse(expected.savedAt);
    if (!Number.isFinite(savedAt)
      || capturedAt > savedAt + 5_000
      || savedAt - capturedAt > MARKETING_PLAYBOOK_DEVELOPER_MARKER_PROOF_MAX_AGE_MS) return null;
  }

  for (const regionId of PILOT_REGION_IDS) {
    const region = value.regions[regionId];
    const expectedLabel = EXPECTED_MARKERS[regionId];
    if (!isRecord(region)
      || !hasExactKeys(region, ["label", "pseudo", "content", "display", "visibility", "opacity"])
      || region.label !== expectedLabel
      || (region.pseudo !== "::after" && region.pseudo !== "::before")
      || region.content !== expectedLabel
      || typeof region.display !== "string"
      || region.display === "none"
      || typeof region.visibility !== "string"
      || region.visibility === "hidden"
      || region.visibility === "collapse"
      || typeof region.opacity !== "string"
      || !(Number.parseFloat(region.opacity || "1") > 0)) return null;
  }
  return value as MarketingPlaybookDeveloperMarkerProof;
}

/**
 * Captures naturally visible marker evidence while the real visual developer
 * is open. This function is deliberately read-only: it never writes marker
 * visibility attributes, classes or inline styles.
 */
export function captureMarketingPlaybookDeveloperMarkerProof(
  documentRef: Document,
  route: { pathname: string; search: string },
  binding: {
    workspaceScope: string;
    canaryProfileDraftId: string;
    capturedAt?: string;
  },
): MarketingPlaybookDeveloperMarkerCapture | null {
  const view = documentRef.defaultView;
  const pageKind = classifyProofPage(route.pathname, route.search);
  const roots = Array.from(documentRef.querySelectorAll<HTMLElement>(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.rootSelector));
  const workspace = roots[0] ?? null;
  if (!view
    || !pageKind
    || roots.length !== 1
    || !workspace
    || !documentRef.documentElement.hasAttribute("data-visual-card-editor-open")
    || !binding.workspaceScope
    || !binding.canaryProfileDraftId) return null;

  const contract = EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT;
  const nestedRegionCounts = {
    title: workspace.querySelectorAll(contract.regionSelectors.title).length,
    "table-shell": workspace.querySelectorAll(contract.regionSelectors.tableShell).length,
    "table-header": workspace.querySelectorAll(contract.regionSelectors.tableHeader).length,
    content: workspace.querySelectorAll(contract.regionSelectors.content).length,
  } satisfies Record<Exclude<PilotRegionId, "workspace">, number>;
  if (Object.values(nestedRegionCounts).some((count) => count !== 1)) return null;
  const elements = {
    workspace,
    title: workspace.querySelector<HTMLElement>(contract.regionSelectors.title),
    "table-shell": workspace.querySelector<HTMLElement>(contract.regionSelectors.tableShell),
    "table-header": workspace.querySelector<HTMLElement>(contract.regionSelectors.tableHeader),
    content: workspace.querySelector<HTMLElement>(contract.regionSelectors.content),
  } satisfies Record<PilotRegionId, HTMLElement | null>;
  const workspaceMarkerHost = findExistingWorkspaceBodyMarkerHost(workspace);
  if (!workspaceMarkerHost || !existingWorkspaceBodyMarkerHitAreaMatchesGeometry(workspace)) return null;
  const markerElements = { ...elements, workspace: workspaceMarkerHost };
  const pageOwner = workspace.closest<HTMLElement>("[data-page-factory-page-id]");
  const pageId = pageOwner?.getAttribute("data-page-factory-page-id")?.trim() || "";
  if (pageId !== MARKETING_PLAYBOOK_PILOT_PAGE_ID) return null;

  const regions = {} as Record<PilotRegionId, MarketingPlaybookDeveloperMarkerProofRegion>;
  for (const regionId of PILOT_REGION_IDS) {
    const element = elements[regionId];
    if (!element) return null;
    if (element.getAttribute("data-visual-card-runtime-region") !== regionId
      || element.getAttribute("data-visual-contract-region") !== regionId) return null;
    const evidence = readPseudoEvidence(view, markerElements[regionId]!, EXPECTED_MARKERS[regionId], element).find((candidate) => (
      candidate.attributeMatches && candidate.productionVisible && candidate.content === candidate.expectedLabel
    ));
    if (!evidence || !evidence.pseudo) return null;
    regions[regionId] = {
      label: evidence.expectedLabel,
      pseudo: evidence.pseudo,
      content: evidence.content,
      display: evidence.display,
      visibility: evidence.visibility,
      opacity: evidence.opacity,
    };
  }

  const capturedAt = binding.capturedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(capturedAt))) return null;
  return {
    schemaVersion: MARKETING_PLAYBOOK_DEVELOPER_MARKER_PROOF_SCHEMA_VERSION,
    contract: {
      version: contract.version,
      referencePageId: contract.referencePageId,
    },
    canaryProfileDraftId: binding.canaryProfileDraftId,
    workspaceScope: binding.workspaceScope,
    page: {
      kind: pageKind,
      pageId,
      pathname: route.pathname,
      search: normalizeProofSearch(route.search),
    },
    capturedAt,
    regions,
  };
}

export function bindMarketingPlaybookDeveloperMarkerProof(
  capture: MarketingPlaybookDeveloperMarkerCapture,
  visualAuditId: string,
): MarketingPlaybookDeveloperMarkerProof | null {
  const proof: MarketingPlaybookDeveloperMarkerProof = { ...capture, visualAuditId };
  return validateMarketingPlaybookDeveloperMarkerProof(proof, {
    workspaceScope: capture.workspaceScope,
    canaryProfileDraftId: capture.canaryProfileDraftId,
    visualAuditId,
    sourcePathname: capture.page.pathname,
    sourceSearch: capture.page.search,
    now: Date.parse(capture.capturedAt),
  });
}

function inspectMarker(
  view: Window,
  element: HTMLElement | null,
  expectedLabel: string,
  paintElement: HTMLElement | null = element,
): MarketingPlaybookMarkerEvidence {
  const empty: MarketingPlaybookMarkerEvidence = {
    expectedLabel,
    attributeMatches: false,
    productionVisible: false,
    mechanismAvailable: false,
    activation: "none",
    pseudo: null,
    content: "",
    display: "none",
    visibility: "hidden",
    opacity: "0",
  };
  if (!element || !paintElement) return empty;

  const current = readPseudoEvidence(view, paintElement, expectedLabel, element);
  const visible = current.find((candidate) => candidate.productionVisible);
  const developerOpen = element.ownerDocument.documentElement.hasAttribute("data-visual-card-editor-open");
  if (visible) {
    return {
      ...visible,
      mechanismAvailable: true,
      activation: developerOpen
        ? "developer-open"
        : element.getAttribute(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.activationAttribute) === EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.activationValue
          ? "always"
          : "hover-or-focus",
    };
  }

  // Probe the canonical always mechanism only to distinguish missing CSS from
  // a marker that is correctly hover-only. A probe never makes the check pass:
  // productionVisible remains the pre-probe computed state above.
  const attribute = EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.activationAttribute;
  const previous = element.getAttribute(attribute);
  element.setAttribute(attribute, EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.marker.activationValue);
  const probed = readPseudoEvidence(view, paintElement, expectedLabel, element).find((candidate) => candidate.productionVisible);
  if (previous === null) element.removeAttribute(attribute);
  else element.setAttribute(attribute, previous);
  const fallback = probed ?? current.find((candidate) => candidate.content === expectedLabel) ?? current[0];
  return {
    ...fallback,
    productionVisible: false,
    mechanismAvailable: Boolean(probed),
    activation: "none",
  };
}

function resolveReferenceBaselines(documentRef: Document, workspace: HTMLElement, view: Window) {
  const probe = documentRef.createElement("div");
  probe.setAttribute("data-existing-workspace-reference-probe", EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.version);
  probe.style.cssText = "position:absolute;inset:auto;left:-100000px;top:-100000px;box-sizing:border-box;width:1px;height:1px;visibility:hidden;pointer-events:none;contain:strict";
  workspace.appendChild(probe);
  const resolvePadding = (expression: string) => {
    probe.style.padding = "0";
    probe.style.padding = expression;
    return cssQuad(view.getComputedStyle(probe), "padding");
  };
  const tableShellPadding = resolvePadding(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.geometry.tokenBaselines.tableShellPadding);
  const contentPadding = resolvePadding(EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.geometry.tokenBaselines.contentPadding);
  probe.style.minHeight = "0";
  probe.style.minHeight = EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT.geometry.tokenBaselines.tableHeaderMinHeight;
  const tableHeaderMinHeight = numericCss(view.getComputedStyle(probe).minHeight);
  probe.remove();
  return { tableShellPadding, contentPadding, tableHeaderMinHeight };
}

export function inspectMarketingPlaybookPilotDom(
  documentRef: Document,
  route: { pathname: string; search: string },
  proofContext?: MarketingPlaybookDeveloperMarkerProofContext,
): MarketingPlaybookPilotReport {
  const contract = EXISTING_WORKSPACE_FRAME_REFERENCE_CONTRACT;
  const workspaces = Array.from(documentRef.querySelectorAll<HTMLElement>(contract.rootSelector));
  const workspace = workspaces[0] ?? null;
  const selectorByRegion: Record<Exclude<PilotRegionId, "workspace">, string> = {
    title: contract.regionSelectors.title,
    "table-shell": contract.regionSelectors.tableShell,
    "table-header": contract.regionSelectors.tableHeader,
    content: contract.regionSelectors.content,
  };
  const elements = {
    workspace,
    title: workspace?.querySelector<HTMLElement>(selectorByRegion.title) ?? null,
    "table-shell": workspace?.querySelector<HTMLElement>(selectorByRegion["table-shell"]) ?? null,
    "table-header": workspace?.querySelector<HTMLElement>(selectorByRegion["table-header"]) ?? null,
    content: workspace?.querySelector<HTMLElement>(selectorByRegion.content) ?? null,
  } satisfies Record<PilotRegionId, HTMLElement | null>;
  const workspaceMarkerHost = workspace ? findExistingWorkspaceBodyMarkerHost(workspace) : null;
  const workspaceMarkerReady = Boolean(
    workspace
    && workspaceMarkerHost
    && existingWorkspaceBodyMarkerHitAreaMatchesGeometry(workspace),
  );
  const regionCounts = {
    workspace: workspaces.length,
    title: workspaces.reduce((count, root) => count + root.querySelectorAll(selectorByRegion.title).length, 0),
    "table-shell": workspaces.reduce((count, root) => count + root.querySelectorAll(selectorByRegion["table-shell"]).length, 0),
    "table-header": workspaces.reduce((count, root) => count + root.querySelectorAll(selectorByRegion["table-header"]).length, 0),
    content: workspaces.reduce((count, root) => count + root.querySelectorAll(selectorByRegion.content).length, 0),
  } satisfies Record<PilotRegionId, number>;
  const rects = Object.fromEntries((Object.entries(elements) as Array<[PilotRegionId, HTMLElement | null]>).map(([region, element]) => {
    const rect = element?.getBoundingClientRect();
    return [region, rect ? { left: rect.left, right: rect.right } : null];
  })) as Record<PilotRegionId, PilotRect | null>;
  const view = documentRef.defaultView;
  const workspaceStyle = workspace && view ? view.getComputedStyle(workspace) : null;
  const shellStyle = elements["table-shell"] && view ? view.getComputedStyle(elements["table-shell"]!) : null;
  const headerStyle = elements["table-header"] && view ? view.getComputedStyle(elements["table-header"]!) : null;
  const contentStyle = elements.content && view ? view.getComputedStyle(elements.content) : null;
  const baselines = workspace && view
    ? resolveReferenceBaselines(documentRef, workspace, view)
    : {
        tableShellPadding: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY] as CssQuad,
        contentPadding: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY] as CssQuad,
        tableHeaderMinHeight: Number.POSITIVE_INFINITY,
      };
  const markerEvidence = Object.fromEntries((Object.entries(elements) as Array<[PilotRegionId, HTMLElement | null]>).map(([region, element]) => [
    region,
    view ? inspectMarker(view, element, EXPECTED_MARKERS[region], region === "workspace" && workspaceMarkerReady ? workspaceMarkerHost : element) : {
      expectedLabel: EXPECTED_MARKERS[region],
      attributeMatches: false,
      productionVisible: false,
      mechanismAvailable: false,
      activation: "none",
      pseudo: null,
      content: "",
      display: "none",
      visibility: "hidden",
      opacity: "0",
    },
  ])) as Record<PilotRegionId, MarketingPlaybookMarkerEvidence>;
  const content = elements.content;
  return evaluateMarketingPlaybookPilotSnapshot({
    routeMatches: isMarketingPlaybookPilotRoute(route.pathname, route.search),
    regionCounts,
    markerEvidence,
    rects,
    workspaceMargins: workspaceStyle ? cssQuad(workspaceStyle, "margin") : [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
    workspaceScrollbarGutter: workspaceStyle?.scrollbarGutter ?? "",
    scrollOwnerCount: workspace?.querySelectorAll("[data-page-list-scroll-owner]").length ?? 0,
    scrollOwnerIsCanonicalContent: Boolean(content?.hasAttribute("data-page-list-scroll-owner") && content.getAttribute("data-shared-scroll-contract") === contract.scrollContract),
    contentOverflowX: contentStyle?.overflowX ?? "",
    contentOverflowY: contentStyle?.overflowY ?? "",
    contentScrollbarGutter: contentStyle?.scrollbarGutter ?? "",
    contentClientWidth: content?.clientWidth ?? 0,
    contentScrollWidth: content?.scrollWidth ?? Number.POSITIVE_INFINITY,
    contentClientHeight: content?.clientHeight ?? 0,
    contentScrollHeight: content?.scrollHeight ?? 0,
    reference: {
      pageId: contract.referencePageId,
      version: contract.version,
      canonicalRootMatches: workspaces.length === 1 && workspaceMarkerReady,
      tableShellPaddingMatches: Boolean(shellStyle && quadsMatch(cssQuad(shellStyle, "padding"), baselines.tableShellPadding)),
      tableHeaderMinHeightMatches: Boolean(headerStyle && withinTolerance(numericCss(headerStyle.minHeight), baselines.tableHeaderMinHeight, 0.5)),
      contentPaddingMatches: Boolean(contentStyle && quadsMatch(cssQuad(contentStyle, "padding"), baselines.contentPadding)),
    },
  }, proofContext);
}
