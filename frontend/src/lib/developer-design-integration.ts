import designContractData from "@website-style/design-integration-contract.json" with { type: "json" };
import mediaContractData from "@website-style/media-optimization-contract.json" with { type: "json" };
import visualEvidenceContractData from "@website-style/visual-evidence-contract.json" with { type: "json" };

import {
  DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS,
  resolveDeveloperGlobalFrameAdapterForRoute,
} from "@/lib/developer-global-frame-adapter-resolution";
import {
  PAGE_FACTORY_PAGES,
  PAGE_FACTORY_STANDARD,
  normalizePageFactoryRoute,
  resolvePageFactoryScope,
  type PageFactoryPage,
  type PageFactoryScope,
} from "@/page-factory/page-factory";
import {
  DEVELOPER_LOADING_SPEED_LEARNING_CONTRACT,
  DEVELOPER_ROUTE_COMPOSITION_CONTRACT,
  SHARED_OPTIMIZATION_CONTRACT,
  type DeveloperLoadingIntent,
  type DeveloperLoadingSpeedRuleId,
  type SharedOptimizationBudgetId,
} from "@/lib/developer-optimization-contract";
import {
  fingerprintDeveloperWorkflowTargetManifest,
  fingerprintDeveloperWorkflowValue,
} from "@/lib/developer-workflow-run";
import {
  buildDeveloperWorkflowRouteTarget,
  compareDeveloperWorkflowCodeUnits,
} from "@/lib/developer-workflow-target-manifest.mjs";
import { HQ_SOFTWARE_VERSION, HQ_SOURCE_FINGERPRINT } from "@/lib/software-version";

export type DeveloperDesignScope = "global" | "page";
export type DeveloperLoadPriority = "critical" | "post-paint" | "viewport" | "interaction" | "background";
export type DeveloperVisualEvidenceViewportId = "mobile" | "tablet" | "desktop";

export type DeveloperVisualEvidenceViewport = {
  id: DeveloperVisualEvidenceViewportId;
  width: number;
  height: number;
  label: string;
};

export const DEVELOPER_GLOBAL_DESIGN_IDENTITY_KEY = "global:registered-page-targets" as const;

export type DeveloperDesignTargetManifestEntry = {
  identityKey: string;
  pageFactoryId: string | null;
  sourceScope: PageFactoryScope;
  normalizedRoute: string;
  component: string | null;
  entryComponent: string | null;
  template: PageFactoryPage["template"] | null;
  lifecycle: PageFactoryPage["status"] | "unregistered";
};

export type DeveloperDesignTargetManifest = {
  scope: DeveloperDesignScope;
  manifestId: string;
  targets: readonly DeveloperDesignTargetManifestEntry[];
};

export type DeveloperPageLoadPlanUnit = {
  unitId: string;
  moduleRef: string;
  owner: "shared" | "page";
  intent: DeveloperLoadingIntent;
};

export type DeveloperResolvedPageLoadPlan = {
  schemaVersion: 1;
  identityKey: string;
  policyVersion: string;
  profileId: string;
  targetManifestFingerprint: string;
  units: readonly DeveloperPageLoadPlanUnit[];
  budgetIds: readonly SharedOptimizationBudgetId[];
  ruleIds: readonly DeveloperLoadingSpeedRuleId[];
  overrideKeys: readonly string[];
  fingerprint: string;
};

export type DeveloperDesignComponentMapping = {
  figmaName: string;
  region: string;
  owner: "shared-contract";
  defaultLoadPriority: DeveloperLoadPriority;
};

type DeveloperDesignIntegrationContract = {
  version: string;
  ownership: "shared-first";
  authority: "shared-contract";
  pageDna: {
    identityFields: readonly ["sourceScope", "normalizedRoute"];
    registry: string;
    resolver: string;
    artifacts: readonly string[];
  };
  workflow: readonly {
    order: string;
    appId: string;
    label: string;
    artifact: string;
  }[];
  figma: {
    connection: "codex-plugin";
    editableDesignRequired: true;
    acceptedHosts: readonly string[];
    acceptedPathPrefixes: readonly string[];
    storedMetadata: readonly string[];
    forbiddenStorage: readonly string[];
    syncPolicy: {
      contractToFigma: string;
      figmaToContract: string;
      figmaToSource: "never-direct";
      sourceMutation: "github-pr-only";
    };
  };
  componentMappings: readonly DeveloperDesignComponentMapping[];
  loadPriorities: readonly {
    id: DeveloperLoadPriority;
    label: string;
    trigger: string;
    description: string;
  }[];
  responsiveViewports: readonly DeveloperVisualEvidenceViewport[];
  requiredStates: readonly string[];
  visualEvidence: readonly string[];
  designComplexityBudgets: readonly { id: string; label: string; limit: number }[];
  releaseSequence: readonly string[];
};

export type DeveloperPageDna = {
  identityKey: string;
  sourceScope: PageFactoryScope | "global";
  normalizedRoute: string;
  pageFactoryId: string | null;
  label: string;
  template: PageFactoryPage["template"] | null;
  lifecycle: PageFactoryPage["status"] | "unregistered" | "aggregate";
  component: string | null;
  entryComponent: string | null;
  requiredRegions: readonly string[];
  capabilities: readonly string[];
  governanceScopes: readonly PageFactoryScope[];
  adapterStrategy: "explicit-exception" | "template-projection" | "unresolved" | "aggregate";
  adapterId: string | null;
  auditScope: DeveloperDesignScope;
  targetManifest: DeveloperDesignTargetManifest;
  loadPlan: DeveloperResolvedPageLoadPlan;
  impactTargetCount: number;
  contractVersion: string;
  pageFactoryVersion: string;
  sharedOptimizationVersion: string;
  mediaContractVersion: string;
  visualEvidenceContractVersion: string;
  baseHVersion: string;
  sourceFingerprint: string;
};

export type DeveloperFigmaReference = {
  fileUrl: string;
  fileKey: string;
  nodeId: string | null;
  revision: string | null;
  capturedAt: string;
};

export type DeveloperFigmaSnapshot = {
  source: "codex-figma-snapshot";
  components: string[];
  variables: string[];
  frames: string[];
  capturedAt: string;
  fileKey: string | null;
  nodeId: string | null;
  revision: string | null;
  pageDnaFingerprint: string | null;
  sharedContractVersion: string | null;
};

export type DeveloperDesignSession = {
  schemaVersion: 1;
  identityKey: string;
  scope: DeveloperDesignScope;
  contractVersion: string;
  figma: DeveloperFigmaReference | null;
  snapshot: DeveloperFigmaSnapshot | null;
  updatedAt: string;
};

export type DeveloperDesignMappingCoverage = {
  status: "awaiting-snapshot" | "mapped" | "incomplete";
  mapped: string[];
  missing: string[];
  unmapped: string[];
  percent: number | null;
};

export type DeveloperRuntimeVisualEvidence = {
  sampleSchemaVersion: 3;
  targetIdentityKey: string;
  sourceScope: PageFactoryScope;
  normalizedRoute: string;
  targetManifestFingerprint: string;
  checkedAt: string;
  viewportWidth: number;
  viewportHeight: number;
  documentOverflow: boolean;
  visibleRegionCount: number;
  requiredRegionCount: number;
  missingRegions: string[];
  imageCount: number;
  lazyImageCount: number;
  asyncImageCount: number;
  videoCount: number;
  posterVideoCount: number;
  metadataVideoCount: number;
  resourceCount: number;
  longTaskCount: number;
};

export type DeveloperVisualEvidenceRecord = {
  schemaVersion: 1;
  evidenceId: string;
  capturedAt: string;
  scope: DeveloperDesignScope;
  identityKey: string;
  targetManifestFingerprint: string;
  pageDnaFingerprint: string;
  designRevision: string | null;
  sharedContractVersion: string;
  sourceFingerprint: string;
  baseHVersion: string;
  viewportResults: readonly {
    id: string;
    width: number;
    height: number;
    status: "passed" | "pending";
    sampleCount: number;
    coveredTargetCount: number;
    requiredTargetCount: number;
    capturedAt: string | null;
  }[];
  targetCoverage: {
    targetCount: number;
    coveredTargetCount: number;
    completeTargetCount: number;
    requiredSampleCount: number;
    capturedSampleCount: number;
    coveredTargetIds: readonly string[];
    completeTargetIds: readonly string[];
  };
  checkResults: readonly {
    id: string;
    status: "passed" | "failed" | "pending";
    detail: string;
  }[];
  artifactRefs: readonly string[];
  status: "pending" | "passed" | "failed" | "stale";
  fingerprint: string;
};

type DeveloperVisualEvidenceTargetResult = {
  identityKey: string;
  covered: boolean;
  complete: boolean;
  viewportResults: readonly {
    id: string;
    width: number;
    height: number;
    captured: boolean;
    sampleCount: number;
    capturedAt: string | null;
  }[];
};

export type DeveloperVisualEvidenceSampleIndex = {
  samples: readonly DeveloperRuntimeVisualEvidence[];
  invalidSampleCount: number;
  latestByTargetIdentity: ReadonlyMap<string, DeveloperRuntimeVisualEvidence>;
  targetResults: readonly DeveloperVisualEvidenceTargetResult[];
  viewportResults: DeveloperVisualEvidenceRecord["viewportResults"];
  targetCoverage: DeveloperVisualEvidenceRecord["targetCoverage"];
};

type DeveloperDesignIntegrationContractSource = Omit<DeveloperDesignIntegrationContract, "responsiveViewports"> & {
  responsiveViewportLabels: Readonly<Record<DeveloperVisualEvidenceViewportId, string>>;
};

type DeveloperVisualEvidenceContract = {
  version: string;
  viewports: readonly {
    id: DeveloperVisualEvidenceViewportId;
    width: number;
    height: number;
  }[];
};

const designContractSource = designContractData as unknown as DeveloperDesignIntegrationContractSource;
const visualEvidenceContract = visualEvidenceContractData as unknown as DeveloperVisualEvidenceContract;

export const DEVELOPER_VISUAL_EVIDENCE_CONTRACT_VERSION = visualEvidenceContract.version;
export const DEVELOPER_VISUAL_EVIDENCE_VIEWPORTS = Object.freeze(
  visualEvidenceContract.viewports.map((viewport) => {
    const label = designContractSource.responsiveViewportLabels[viewport.id];
    if (!label) throw new Error(`visual evidence viewport label is missing: ${viewport.id}`);
    return Object.freeze({ ...viewport, label });
  }),
) as readonly DeveloperVisualEvidenceViewport[];

function buildDeveloperDesignIntegrationContract(): DeveloperDesignIntegrationContract {
  const { responsiveViewportLabels: _labels, ...contract } = designContractSource;
  return Object.freeze({
    ...contract,
    responsiveViewports: DEVELOPER_VISUAL_EVIDENCE_VIEWPORTS,
  });
}

export const DEVELOPER_DESIGN_INTEGRATION_CONTRACT = buildDeveloperDesignIntegrationContract();
export const DEVELOPER_DESIGN_SESSION_EVENT = "tradepro:developer-design-session" as const;
const DEVELOPER_DESIGN_SESSION_STORAGE_PREFIX = "tradepro:developer-design-session:v1";
const SHARED_OPTIMIZATION_VERSION = SHARED_OPTIMIZATION_CONTRACT.version;
const MEDIA_CONTRACT_VERSION = (mediaContractData as { version: string }).version;

function findResolvedPage(pathname: string, search: string) {
  const resolution = resolveDeveloperGlobalFrameAdapterForRoute(pathname, search);
  const page = resolution?.pageRegistration ?? null;
  return { resolution, page };
}

function toTargetManifestEntry(
  page: PageFactoryPage | null,
  sourceScope: PageFactoryScope,
  route: string,
): DeveloperDesignTargetManifestEntry {
  const routeTarget = buildDeveloperWorkflowRouteTarget(
    sourceScope,
    route,
    page?.status ?? "unregistered",
  );
  return {
    identityKey: routeTarget.id,
    pageFactoryId: page?.id ?? null,
    sourceScope: routeTarget.sourceScope as PageFactoryScope,
    normalizedRoute: routeTarget.normalizedRoute,
    component: page?.component ?? null,
    entryComponent: page?.entryComponent ?? null,
    template: page?.template ?? null,
    lifecycle: page?.status ?? "unregistered",
  };
}

function buildPageTargetManifest(
  page: PageFactoryPage | null,
  sourceScope: PageFactoryScope,
  normalizedRoute: string,
): DeveloperDesignTargetManifest {
  const target = toTargetManifestEntry(page, sourceScope, normalizedRoute);
  return {
    scope: "page",
    manifestId: target.identityKey,
    targets: [target],
  };
}

function uniqueSorted(values: readonly string[]) {
  return [...new Set(values)].sort(compareDeveloperWorkflowCodeUnits);
}

type DeveloperPageLoadPlanUnitCandidate = DeveloperPageLoadPlanUnit & { bucket: string };

function collectDeveloperPageLoadPlanUnits(
  page: PageFactoryPage | null,
  sourceScope: PageFactoryScope | "global",
) {
  const projection = DEVELOPER_LOADING_SPEED_LEARNING_CONTRACT.loadPlanProjection;
  const candidates: DeveloperPageLoadPlanUnitCandidate[] = [];
  const add = (
    bucket: string,
    moduleRefs: readonly (string | null | undefined)[],
    owner: DeveloperPageLoadPlanUnit["owner"],
    intent: DeveloperLoadingIntent,
  ) => {
    for (const moduleRef of moduleRefs) {
      const normalizedModuleRef = moduleRef?.trim();
      if (!normalizedModuleRef) continue;
      candidates.push({
        unitId: `${bucket}:${normalizedModuleRef}`,
        moduleRef: normalizedModuleRef,
        owner,
        intent,
        bucket,
      });
    }
  };

  add("always", DEVELOPER_ROUTE_COMPOSITION_CONTRACT.alwaysEntries, "shared", projection.bucketIntents.alwaysEntries);
  if (sourceScope === "global") {
    add("layout", Object.values(DEVELOPER_ROUTE_COMPOSITION_CONTRACT.layoutEntries), "shared", projection.bucketIntents.layoutEntries);
    add("source-deferred", Object.values(DEVELOPER_ROUTE_COMPOSITION_CONTRACT.deferredLazyEntriesBySourceScope).flat(), "shared", projection.bucketIntents.deferredLazyEntriesBySourceScope);
  } else {
    add("layout", [DEVELOPER_ROUTE_COMPOSITION_CONTRACT.layoutEntries[sourceScope]], "shared", projection.bucketIntents.layoutEntries);
    add("source-deferred", DEVELOPER_ROUTE_COMPOSITION_CONTRACT.deferredLazyEntriesBySourceScope[sourceScope] || [], "shared", projection.bucketIntents.deferredLazyEntriesBySourceScope);
    add("page-entry", [page?.entryComponent ?? page?.component], "page", projection.pageEntryIntent);
    if (page) {
      add("page-initial", DEVELOPER_ROUTE_COMPOSITION_CONTRACT.initialLazyEntriesByPageId[page.id] || [], "page", projection.bucketIntents.initialLazyEntriesByPageId);
      add("page-deferred", DEVELOPER_ROUTE_COMPOSITION_CONTRACT.deferredLazyEntriesByPageId[page.id] || [], "page", projection.bucketIntents.deferredLazyEntriesByPageId);
    }
  }

  const seen = new Set<string>();
  return candidates
    .filter((candidate) => {
      const key = `${candidate.moduleRef}|${candidate.owner}|${candidate.intent}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ bucket: _bucket, ...unit }) => unit)
    .sort((left, right) => compareDeveloperWorkflowCodeUnits(left.unitId, right.unitId));
}

function buildDeveloperResolvedPageLoadPlan(input: {
  identityKey: string;
  page: PageFactoryPage | null;
  sourceScope: PageFactoryScope | "global";
  targetManifest: DeveloperDesignTargetManifest;
}): DeveloperResolvedPageLoadPlan {
  const projection = DEVELOPER_LOADING_SPEED_LEARNING_CONTRACT.loadPlanProjection;
  const pageId = input.page?.id ?? null;
  const pageInitialEntries = pageId ? DEVELOPER_ROUTE_COMPOSITION_CONTRACT.initialLazyEntriesByPageId[pageId] || [] : [];
  const pageDeferredEntries = pageId ? DEVELOPER_ROUTE_COMPOSITION_CONTRACT.deferredLazyEntriesByPageId[pageId] || [] : [];
  const base = {
    schemaVersion: projection.schemaVersion,
    identityKey: input.identityKey,
    policyVersion: DEVELOPER_LOADING_SPEED_LEARNING_CONTRACT.version,
    profileId: input.sourceScope === "global"
      ? projection.globalProfileId
      : pageId || projection.unregisteredProfileId,
    targetManifestFingerprint: fingerprintDeveloperDesignTargetManifest(input.targetManifest),
    units: collectDeveloperPageLoadPlanUnits(input.page, input.sourceScope),
    budgetIds: SHARED_OPTIMIZATION_CONTRACT.budgets.map((budget) => budget.id),
    ruleIds: DEVELOPER_LOADING_SPEED_LEARNING_CONTRACT.rules.map((rule) => rule.id),
    overrideKeys: input.sourceScope === "global" ? [] : [
      ...(pageInitialEntries.length ? ["initialLazyEntriesByPageId"] : []),
      ...(pageDeferredEntries.length ? ["deferredLazyEntriesByPageId"] : []),
    ],
  } as const;
  return { ...base, fingerprint: fingerprintDeveloperWorkflowValue(base) };
}

let cachedGlobalDeveloperPageDna: DeveloperPageDna | null = null;

function buildGlobalDeveloperPageDna(): DeveloperPageDna {
  const pageById = new Map(PAGE_FACTORY_PAGES.map((page) => [page.id, page] as const));
  const targetPages: PageFactoryPage[] = [];
  const targets = DEVELOPER_GLOBAL_FRAME_RESOLVABLE_TARGET_REGISTRATIONS
    .flatMap((registration) => {
      const page = pageById.get(registration.pageFactoryId);
      if (!page) return [];
      targetPages.push(page);
      return [toTargetManifestEntry(page, page.sourceScope, page.route)];
    })
    .sort((left, right) => compareDeveloperWorkflowCodeUnits(left.identityKey, right.identityKey));
  const targetManifest: DeveloperDesignTargetManifest = {
    scope: "global",
    manifestId: DEVELOPER_GLOBAL_DESIGN_IDENTITY_KEY,
    targets,
  };
  const loadPlan = buildDeveloperResolvedPageLoadPlan({
    identityKey: DEVELOPER_GLOBAL_DESIGN_IDENTITY_KEY,
    page: null,
    sourceScope: "global",
    targetManifest,
  });
  return {
    identityKey: DEVELOPER_GLOBAL_DESIGN_IDENTITY_KEY,
    sourceScope: "global",
    normalizedRoute: "*",
    pageFactoryId: null,
    label: "全局已登记页面",
    template: null,
    lifecycle: "aggregate",
    component: null,
    entryComponent: null,
    requiredRegions: uniqueSorted(targetPages.flatMap((page) => page.requiredRegions)),
    capabilities: uniqueSorted(targetPages.flatMap((page) => page.capabilities)),
    governanceScopes: ["hq", "agency_source", "client_source"],
    adapterStrategy: "aggregate",
    adapterId: "global-target-manifest",
    auditScope: "global",
    targetManifest,
    loadPlan,
    impactTargetCount: targets.length,
    contractVersion: DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version,
    pageFactoryVersion: PAGE_FACTORY_STANDARD.factoryVersion,
    sharedOptimizationVersion: SHARED_OPTIMIZATION_VERSION,
    mediaContractVersion: MEDIA_CONTRACT_VERSION,
    visualEvidenceContractVersion: DEVELOPER_VISUAL_EVIDENCE_CONTRACT_VERSION,
    baseHVersion: HQ_SOFTWARE_VERSION,
    sourceFingerprint: HQ_SOURCE_FINGERPRINT,
  };
}

export function fingerprintDeveloperDesignTargetManifest(manifest: DeveloperDesignTargetManifest) {
  return fingerprintDeveloperWorkflowTargetManifest(manifest.targets.map((target) => ({
    id: target.identityKey,
    sourceScope: target.sourceScope,
    normalizedRoute: target.normalizedRoute,
    version: target.lifecycle,
  })));
}

export function resolveDeveloperPageDna(
  pathname: string,
  search = "",
  auditScope: DeveloperDesignScope = "page",
): DeveloperPageDna {
  if (auditScope === "global") {
    cachedGlobalDeveloperPageDna ??= buildGlobalDeveloperPageDna();
    return cachedGlobalDeveloperPageDna;
  }
  const { resolution, page } = findResolvedPage(pathname, search);
  const sourceScope = resolution?.sourceScope ?? resolvePageFactoryScope(pathname);
  const normalizedRoute = resolution?.route
    ?? normalizePageFactoryRoute(pathname, search);
  const governanceScopes = page?.governanceScopes ?? [sourceScope];
  const targetManifest = buildPageTargetManifest(page, sourceScope, normalizedRoute);
  const identityKey = `${sourceScope}:${normalizedRoute}`;
  const loadPlan = buildDeveloperResolvedPageLoadPlan({
    identityKey,
    page,
    sourceScope,
    targetManifest,
  });
  return {
    identityKey,
    sourceScope,
    normalizedRoute,
    pageFactoryId: page?.id ?? null,
    label: page?.label ?? "未登记页面",
    template: page?.template ?? null,
    lifecycle: page?.status ?? "unregistered",
    component: page?.component ?? null,
    entryComponent: page?.entryComponent ?? null,
    requiredRegions: page?.requiredRegions ?? [],
    capabilities: page?.capabilities ?? [],
    governanceScopes,
    adapterStrategy: resolution?.strategy ?? "unresolved",
    adapterId: resolution?.adapterId ?? null,
    auditScope,
    targetManifest,
    loadPlan,
    impactTargetCount: page ? 1 : 0,
    contractVersion: DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version,
    pageFactoryVersion: PAGE_FACTORY_STANDARD.factoryVersion,
    sharedOptimizationVersion: SHARED_OPTIMIZATION_VERSION,
    mediaContractVersion: MEDIA_CONTRACT_VERSION,
    visualEvidenceContractVersion: DEVELOPER_VISUAL_EVIDENCE_CONTRACT_VERSION,
    baseHVersion: HQ_SOFTWARE_VERSION,
    sourceFingerprint: HQ_SOURCE_FINGERPRINT,
  };
}

async function sha256(value: string) {
  if (!globalThis.crypto?.subtle) throw new Error("当前环境不支持 SHA-256 证据指纹。");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function computeDeveloperPageDnaFingerprint(pageDna: DeveloperPageDna) {
  return sha256(JSON.stringify({
    auditScope: pageDna.auditScope,
    identityKey: pageDna.identityKey,
    targetManifest: pageDna.targetManifest,
    loadPlan: pageDna.loadPlan,
    pageFactoryVersion: pageDna.pageFactoryVersion,
    sharedOptimizationVersion: pageDna.sharedOptimizationVersion,
    mediaContractVersion: pageDna.mediaContractVersion,
    visualEvidenceContractVersion: pageDna.visualEvidenceContractVersion,
    sourceFingerprint: pageDna.sourceFingerprint,
  }));
}

export function buildDeveloperDesignSessionStorageKey(identityKey: string, scope: DeveloperDesignScope) {
  const storageIdentity = scope === "global" ? DEVELOPER_GLOBAL_DESIGN_IDENTITY_KEY : identityKey;
  return `${DEVELOPER_DESIGN_SESSION_STORAGE_PREFIX}:${scope}:${encodeURIComponent(storageIdentity)}`;
}

export function createDeveloperDesignSession(pageDna: DeveloperPageDna): DeveloperDesignSession {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    identityKey: pageDna.identityKey,
    scope: pageDna.auditScope,
    contractVersion: DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version,
    figma: null,
    snapshot: null,
    updatedAt: now,
  };
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean))];
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeDesignSession(value: unknown, fallback: DeveloperDesignSession): DeveloperDesignSession {
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Partial<DeveloperDesignSession>;
  const figma = candidate.figma && typeof candidate.figma === "object"
    && typeof candidate.figma.fileUrl === "string"
    && typeof candidate.figma.fileKey === "string"
    ? {
        fileUrl: candidate.figma.fileUrl,
        fileKey: candidate.figma.fileKey,
        nodeId: typeof candidate.figma.nodeId === "string" ? candidate.figma.nodeId : null,
        revision: typeof candidate.figma.revision === "string" ? candidate.figma.revision : null,
        capturedAt: typeof candidate.figma.capturedAt === "string" ? candidate.figma.capturedAt : fallback.updatedAt,
      }
    : null;
  const snapshot = candidate.snapshot && typeof candidate.snapshot === "object"
    ? {
        source: "codex-figma-snapshot" as const,
        components: normalizeStringArray(candidate.snapshot.components),
        variables: normalizeStringArray(candidate.snapshot.variables),
        frames: normalizeStringArray(candidate.snapshot.frames),
        capturedAt: typeof candidate.snapshot.capturedAt === "string" ? candidate.snapshot.capturedAt : fallback.updatedAt,
        fileKey: normalizeOptionalString(candidate.snapshot.fileKey),
        nodeId: normalizeOptionalString(candidate.snapshot.nodeId),
        revision: normalizeOptionalString(candidate.snapshot.revision),
        pageDnaFingerprint: normalizeOptionalString(candidate.snapshot.pageDnaFingerprint),
        sharedContractVersion: normalizeOptionalString(candidate.snapshot.sharedContractVersion),
      }
    : null;
  return {
    ...fallback,
    figma,
    snapshot,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : fallback.updatedAt,
  };
}

export function readDeveloperDesignSession(pageDna: DeveloperPageDna): DeveloperDesignSession {
  const fallback = createDeveloperDesignSession(pageDna);
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(buildDeveloperDesignSessionStorageKey(pageDna.identityKey, pageDna.auditScope));
    return raw ? normalizeDesignSession(JSON.parse(raw), fallback) : fallback;
  } catch {
    return fallback;
  }
}

export function saveDeveloperDesignSession(session: DeveloperDesignSession) {
  const next = { ...session, updatedAt: new Date().toISOString() } satisfies DeveloperDesignSession;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(buildDeveloperDesignSessionStorageKey(next.identityKey, next.scope), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(DEVELOPER_DESIGN_SESSION_EVENT, { detail: next }));
  }
  return next;
}

export function parseFigmaDesignReference(
  input: string,
  revisionInput = "",
): DeveloperFigmaReference {
  const url = new URL(input.trim());
  if (!DEVELOPER_DESIGN_INTEGRATION_CONTRACT.figma.acceptedHosts.includes(url.hostname)) {
    throw new Error("只接受 figma.com 的 Design 文件链接。");
  }
  if (!DEVELOPER_DESIGN_INTEGRATION_CONTRACT.figma.acceptedPathPrefixes.some((prefix) => url.pathname.startsWith(prefix))) {
    throw new Error("请提供 /design/ 类型的 Figma Design 文件链接。");
  }
  const [, prefix, fileKey] = url.pathname.split("/");
  if (prefix !== "design" || !fileKey) throw new Error("Figma Design 文件缺少有效 fileKey。");
  return {
    fileUrl: url.toString(),
    fileKey,
    nodeId: url.searchParams.get("node-id"),
    revision: revisionInput.trim() || null,
    capturedAt: new Date().toISOString(),
  };
}

export function parseFigmaSnapshotJson(input: string): DeveloperFigmaSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("设计快照不是有效 JSON。");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("设计快照必须是对象。");
  const candidate = parsed as Record<string, unknown>;
  const components = normalizeStringArray(candidate.components);
  const variables = normalizeStringArray(candidate.variables);
  const frames = normalizeStringArray(candidate.frames);
  if (!components.length && !variables.length && !frames.length) {
    throw new Error("设计快照至少需要 components、variables 或 frames 中的一项。");
  }
  return {
    source: "codex-figma-snapshot",
    components,
    variables,
    frames,
    capturedAt: normalizeOptionalString(candidate.capturedAt) ?? new Date().toISOString(),
    fileKey: normalizeOptionalString(candidate.fileKey),
    nodeId: normalizeOptionalString(candidate.nodeId),
    revision: normalizeOptionalString(candidate.revision),
    pageDnaFingerprint: normalizeOptionalString(candidate.pageDnaFingerprint),
    sharedContractVersion: normalizeOptionalString(candidate.sharedContractVersion),
  };
}

export function inspectDeveloperDesignMappingCoverage(
  snapshot: DeveloperFigmaSnapshot | null,
): DeveloperDesignMappingCoverage {
  if (!snapshot) return { status: "awaiting-snapshot", mapped: [], missing: [], unmapped: [], percent: null };
  const normalizedComponents = new Map(snapshot.components.map((name) => [name.toLocaleLowerCase(), name]));
  const expected = DEVELOPER_DESIGN_INTEGRATION_CONTRACT.componentMappings.map((mapping) => mapping.figmaName);
  const mapped = expected.filter((name) => normalizedComponents.has(name.toLocaleLowerCase()));
  const missing = expected.filter((name) => !normalizedComponents.has(name.toLocaleLowerCase()));
  const expectedSet = new Set(expected.map((name) => name.toLocaleLowerCase()));
  const unmapped = snapshot.components.filter((name) => !expectedSet.has(name.toLocaleLowerCase()));
  return {
    status: missing.length || unmapped.length ? "incomplete" : "mapped",
    mapped,
    missing,
    unmapped,
    percent: expected.length ? Math.round((mapped.length / expected.length) * 100) : 100,
  };
}

function regionSelector(region: string) {
  if (region === "action") return "[data-page-title-actions], [data-shared-function-actions]";
  return `[data-page-factory-region="${region}"], [data-development-standard-frame-region="${region}"]`;
}

function hasVisibleElement(selector: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).some((element) => {
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
  });
}

export function isDeveloperRuntimeVisualEvidenceSample(value: unknown): value is DeveloperRuntimeVisualEvidence {
  if (!value || typeof value !== "object") return false;
  const sample = value as Partial<DeveloperRuntimeVisualEvidence>;
  return sample.sampleSchemaVersion === 3
    && typeof sample.targetIdentityKey === "string"
    && Boolean(sample.targetIdentityKey.trim())
    && (sample.sourceScope === "hq" || sample.sourceScope === "agency_source" || sample.sourceScope === "client_source")
    && typeof sample.normalizedRoute === "string"
    && Boolean(sample.normalizedRoute.trim())
    && typeof sample.targetManifestFingerprint === "string"
    && Boolean(sample.targetManifestFingerprint.trim())
    && typeof sample.checkedAt === "string"
    && Number.isFinite(sample.viewportWidth)
    && Number.isFinite(sample.viewportHeight)
    && typeof sample.documentOverflow === "boolean"
    && Number.isFinite(sample.visibleRegionCount)
    && Number.isFinite(sample.requiredRegionCount)
    && Array.isArray(sample.missingRegions)
    && sample.missingRegions.every((region) => typeof region === "string")
    && Number.isFinite(sample.imageCount)
    && Number.isFinite(sample.lazyImageCount)
    && Number.isFinite(sample.asyncImageCount)
    && Number.isFinite(sample.videoCount)
    && Number.isFinite(sample.posterVideoCount)
    && Number.isFinite(sample.metadataVideoCount)
    && Number.isFinite(sample.resourceCount)
    && Number.isFinite(sample.longTaskCount);
}

export function resolveDeveloperVisualEvidenceViewport(
  sample: Pick<DeveloperRuntimeVisualEvidence, "viewportWidth" | "viewportHeight">,
) {
  return DEVELOPER_VISUAL_EVIDENCE_VIEWPORTS.find(
    (candidate) => Math.abs(sample.viewportWidth - candidate.width) <= 2
      && Math.abs(sample.viewportHeight - candidate.height) <= 2,
  ) ?? null;
}

const developerVisualEvidenceSampleIndexCache = new WeakMap<
  readonly unknown[],
  Map<string, DeveloperVisualEvidenceSampleIndex>
>();

function cacheDeveloperVisualEvidenceSampleIndex(
  values: readonly unknown[],
  targetManifestFingerprint: string,
  index: DeveloperVisualEvidenceSampleIndex,
) {
  const cachedByManifest = developerVisualEvidenceSampleIndexCache.get(values) ?? new Map();
  cachedByManifest.set(targetManifestFingerprint, index);
  developerVisualEvidenceSampleIndexCache.set(values, cachedByManifest);
}

function developerVisualEvidenceTargetViewportKey(targetIdentityKey: string, viewportId: string) {
  return `${targetIdentityKey}\u0000${viewportId}`;
}

export function buildDeveloperVisualEvidenceSampleIndex(
  pageDna: DeveloperPageDna,
  rawSamples: readonly unknown[],
): DeveloperVisualEvidenceSampleIndex {
  const targetManifestFingerprint = fingerprintDeveloperDesignTargetManifest(pageDna.targetManifest);
  const cached = developerVisualEvidenceSampleIndexCache.get(rawSamples)?.get(targetManifestFingerprint);
  if (cached) return cached;

  const targetByIdentity = new Map(pageDna.targetManifest.targets.map((target) => [target.identityKey, target]));
  const samples = rawSamples
    .filter(isDeveloperRuntimeVisualEvidenceSample)
    .filter((sample) => {
      const target = targetByIdentity.get(sample.targetIdentityKey);
      return sample.targetManifestFingerprint === targetManifestFingerprint
        && target?.sourceScope === sample.sourceScope
        && target.normalizedRoute === sample.normalizedRoute;
    })
    .sort((left, right) => left.checkedAt.localeCompare(right.checkedAt));
  const samplesByViewport = new Map<string, DeveloperRuntimeVisualEvidence[]>();
  const samplesByTargetViewport = new Map<string, DeveloperRuntimeVisualEvidence[]>();
  const latestByTargetIdentity = new Map<string, DeveloperRuntimeVisualEvidence>();

  for (const sample of samples) {
    latestByTargetIdentity.set(sample.targetIdentityKey, sample);
    const viewport = resolveDeveloperVisualEvidenceViewport(sample);
    if (!viewport) continue;
    const viewportSamples = samplesByViewport.get(viewport.id) ?? [];
    viewportSamples.push(sample);
    samplesByViewport.set(viewport.id, viewportSamples);
    const targetViewportKey = developerVisualEvidenceTargetViewportKey(sample.targetIdentityKey, viewport.id);
    const targetViewportSamples = samplesByTargetViewport.get(targetViewportKey) ?? [];
    targetViewportSamples.push(sample);
    samplesByTargetViewport.set(targetViewportKey, targetViewportSamples);
  }

  const targetResults = pageDna.targetManifest.targets.map((target): DeveloperVisualEvidenceTargetResult => {
    const viewportResults = DEVELOPER_DESIGN_INTEGRATION_CONTRACT.responsiveViewports.map((viewport) => {
      const matchingSamples = samplesByTargetViewport.get(
        developerVisualEvidenceTargetViewportKey(target.identityKey, viewport.id),
      ) ?? [];
      return {
        id: viewport.id,
        width: viewport.width,
        height: viewport.height,
        captured: matchingSamples.length > 0,
        sampleCount: matchingSamples.length,
        capturedAt: matchingSamples.at(-1)?.checkedAt ?? null,
      };
    });
    return {
      identityKey: target.identityKey,
      covered: viewportResults.some((result) => result.captured),
      complete: viewportResults.every((result) => result.captured),
      viewportResults,
    };
  });
  const viewportResults: DeveloperVisualEvidenceRecord["viewportResults"] = DEVELOPER_DESIGN_INTEGRATION_CONTRACT.responsiveViewports.map((viewport) => {
    const matchingSamples = samplesByViewport.get(viewport.id) ?? [];
    const coveredTargetCount = new Set(matchingSamples.map((sample) => sample.targetIdentityKey)).size;
    const requiredTargetCount = pageDna.targetManifest.targets.length;
    return {
      id: viewport.id,
      width: viewport.width,
      height: viewport.height,
      status: requiredTargetCount > 0 && coveredTargetCount === requiredTargetCount ? "passed" : "pending",
      sampleCount: matchingSamples.length,
      coveredTargetCount,
      requiredTargetCount,
      capturedAt: matchingSamples.at(-1)?.checkedAt ?? null,
    };
  });
  const coveredTargetIds = targetResults.filter((target) => target.covered).map((target) => target.identityKey);
  const completeTargetIds = targetResults.filter((target) => target.complete).map((target) => target.identityKey);
  const targetCoverage: DeveloperVisualEvidenceRecord["targetCoverage"] = {
    targetCount: targetResults.length,
    coveredTargetCount: coveredTargetIds.length,
    completeTargetCount: completeTargetIds.length,
    requiredSampleCount: targetResults.length * DEVELOPER_DESIGN_INTEGRATION_CONTRACT.responsiveViewports.length,
    capturedSampleCount: targetResults.reduce((total, target) => total
      + target.viewportResults.filter((viewport) => viewport.captured).length, 0),
    coveredTargetIds,
    completeTargetIds,
  };
  const index: DeveloperVisualEvidenceSampleIndex = {
    samples,
    invalidSampleCount: rawSamples.length - samples.length,
    latestByTargetIdentity,
    targetResults,
    viewportResults,
    targetCoverage,
  };
  cacheDeveloperVisualEvidenceSampleIndex(rawSamples, targetManifestFingerprint, index);
  cacheDeveloperVisualEvidenceSampleIndex(samples, targetManifestFingerprint, index);
  return index;
}

export function inspectDeveloperRuntimeVisualEvidence(
  targetPageDna: DeveloperPageDna,
  targetManifestFingerprint = fingerprintDeveloperDesignTargetManifest(targetPageDna.targetManifest),
): DeveloperRuntimeVisualEvidence {
  if (targetPageDna.auditScope !== "page" || targetPageDna.sourceScope === "global") {
    throw new Error("运行时可视化样本必须绑定一个实际登记页面，不能直接绑定全局聚合身份。");
  }
  if (typeof document === "undefined") {
    return {
      sampleSchemaVersion: 3,
      targetIdentityKey: targetPageDna.identityKey,
      sourceScope: targetPageDna.sourceScope,
      normalizedRoute: targetPageDna.normalizedRoute,
      targetManifestFingerprint,
      checkedAt: new Date().toISOString(), viewportWidth: 0, viewportHeight: 0, documentOverflow: false,
      visibleRegionCount: 0, requiredRegionCount: targetPageDna.requiredRegions.length, missingRegions: [...targetPageDna.requiredRegions],
      imageCount: 0, lazyImageCount: 0, asyncImageCount: 0, videoCount: 0, posterVideoCount: 0,
      metadataVideoCount: 0, resourceCount: 0, longTaskCount: 0,
    };
  }
  const requiredRegions = targetPageDna.requiredRegions.filter((region) => region !== "top" && region !== "body" && region !== "footer");
  const missingRegions = requiredRegions.filter((region) => !hasVisibleElement(regionSelector(region)));
  const images = Array.from(document.images);
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>("video"));
  const resources = typeof performance === "undefined" ? [] : performance.getEntriesByType("resource");
  const longTasks = typeof performance === "undefined" ? [] : performance.getEntriesByType("longtask");
  return {
    sampleSchemaVersion: 3,
    targetIdentityKey: targetPageDna.identityKey,
    sourceScope: targetPageDna.sourceScope,
    normalizedRoute: targetPageDna.normalizedRoute,
    targetManifestFingerprint,
    checkedAt: new Date().toISOString(),
    viewportWidth: document.documentElement.clientWidth,
    viewportHeight: document.documentElement.clientHeight,
    documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    visibleRegionCount: requiredRegions.length - missingRegions.length,
    requiredRegionCount: requiredRegions.length,
    missingRegions,
    imageCount: images.length,
    lazyImageCount: images.filter((image) => image.loading === "lazy").length,
    asyncImageCount: images.filter((image) => image.decoding === "async").length,
    videoCount: videos.length,
    posterVideoCount: videos.filter((video) => Boolean(video.poster)).length,
    metadataVideoCount: videos.filter((video) => video.preload === "metadata").length,
    resourceCount: resources.length,
    longTaskCount: longTasks.length,
  };
}

export async function buildDeveloperVisualEvidenceRecord(
  pageDna: DeveloperPageDna,
  session: DeveloperDesignSession,
  evidence: DeveloperRuntimeVisualEvidence | readonly DeveloperRuntimeVisualEvidence[],
): Promise<DeveloperVisualEvidenceRecord> {
  const rawSamples = Array.isArray(evidence) ? evidence : [evidence as DeveloperRuntimeVisualEvidence];
  if (!rawSamples.length) throw new Error("视觉证据至少需要一个运行时样本。");
  const targetManifestFingerprint = fingerprintDeveloperDesignTargetManifest(pageDna.targetManifest);
  const sampleIndex = buildDeveloperVisualEvidenceSampleIndex(pageDna, rawSamples);
  const { samples, invalidSampleCount, targetResults, viewportResults, targetCoverage } = sampleIndex;
  const pageDnaFingerprint = await computeDeveloperPageDnaFingerprint(pageDna);
  const mapping = inspectDeveloperDesignMappingCoverage(session.snapshot);
  const missingRegions = uniqueSorted(samples.flatMap((sample) => sample.missingRegions));
  const overflowSamples = samples.filter((sample) => sample.documentOverflow);
  const invalidMediaSamples = samples.filter((sample) => (
    sample.videoCount > sample.posterVideoCount || sample.videoCount > sample.metadataVideoCount
  ));
  const snapshot = session.snapshot;
  const snapshotMetadataMissing = !snapshot?.fileKey
    || !snapshot.revision
    || !snapshot.pageDnaFingerprint
    || !snapshot.sharedContractVersion;
  const snapshotMetadataStale = Boolean(snapshot && (
    (snapshot.pageDnaFingerprint && snapshot.pageDnaFingerprint !== pageDnaFingerprint)
    || (snapshot.sharedContractVersion && snapshot.sharedContractVersion !== DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version)
    || (snapshot.fileKey && session.figma?.fileKey && snapshot.fileKey !== session.figma.fileKey)
    || (snapshot.revision && session.figma?.revision && snapshot.revision !== session.figma.revision)
  ));
  const checkResults: DeveloperVisualEvidenceRecord["checkResults"] = [
    {
      id: "sample-binding",
      status: invalidSampleCount ? "failed" : samples.length ? "passed" : "pending",
      detail: invalidSampleCount
        ? `${invalidSampleCount} 个旧版、目标不匹配或清单指纹过期的样本未计入证据`
        : `${samples.length} 个样本均绑定实际页面身份与目标清单指纹`,
    },
    {
      id: "semantic-regions",
      status: missingRegions.length ? "failed" : samples.length ? "passed" : "pending",
      detail: missingRegions.length ? `缺少：${missingRegions.join("、")}` : samples.length ? `${samples.length} 个样本的登记区域均可见` : "等待绑定实际页面的运行时样本",
    },
    {
      id: "component-mapping",
      status: mapping.status === "mapped" ? "passed" : mapping.status === "incomplete" ? "failed" : "pending",
      detail: mapping.percent === null ? "等待 Figma 快照" : `映射覆盖 ${mapping.percent}%`,
    },
    {
      id: "design-snapshot-freshness",
      status: snapshotMetadataStale ? "failed" : snapshotMetadataMissing ? "pending" : "passed",
      detail: snapshotMetadataStale
        ? "Figma 快照记录的页面 DNA、共享契约或 Design 修订已过期"
        : snapshotMetadataMissing
          ? "等待包含 fileKey、revision、pageDnaFingerprint 与 sharedContractVersion 的 Figma 快照"
          : "Figma 快照与当前页面 DNA 和共享契约一致",
    },
    {
      id: "geometry-and-overflow",
      status: overflowSamples.length ? "failed" : samples.length ? "passed" : "pending",
      detail: overflowSamples.length ? `${overflowSamples.length} 个样本发现文档级横向溢出` : samples.length ? `${samples.length} 个样本未发现文档级横向溢出` : "等待运行时几何证据",
    },
    {
      id: "responsive-matrix",
      status: viewportResults.every((result) => result.status === "passed") ? "passed" : "pending",
      detail: `${targetCoverage.capturedSampleCount}/${targetCoverage.requiredSampleCount} 个目标视口已采样`,
    },
    {
      id: "target-coverage",
      status: targetCoverage.targetCount > 0 && targetCoverage.completeTargetCount === targetCoverage.targetCount ? "passed" : "pending",
      detail: `${targetCoverage.completeTargetCount}/${targetCoverage.targetCount} 个目标完成三视口证据`,
    },
    {
      id: "media-policy",
      status: invalidMediaSamples.length ? "failed" : samples.length ? "passed" : "pending",
      detail: invalidMediaSamples.length
        ? `${invalidMediaSamples.length} 个样本的视频缺少 poster 或 metadata 预载策略`
        : samples.length ? `${samples.length} 个样本均符合视频 poster 与 metadata 策略` : "等待运行时媒体证据",
    },
    {
      id: "impact-boundary",
      status: pageDna.impactTargetCount <= 0 || pageDna.impactTargetCount !== targetCoverage.targetCount
        ? "failed"
        : targetCoverage.completeTargetCount === targetCoverage.targetCount
          ? "passed"
          : "pending",
      detail: `${targetCoverage.completeTargetCount}/${pageDna.impactTargetCount} 个影响目标已完成三视口覆盖`,
    },
  ];
  const stale = session.contractVersion !== DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version || snapshotMetadataStale;
  const hasFailure = checkResults.some((check) => check.status === "failed");
  const allPassed = checkResults.every((check) => check.status === "passed") && Boolean(session.figma?.revision);
  const status: DeveloperVisualEvidenceRecord["status"] = stale
    ? "stale"
    : hasFailure
      ? "failed"
      : allPassed
        ? "passed"
        : "pending";
  const designRevision = snapshot?.revision ?? session.figma?.revision ?? null;
  const fingerprint = await sha256(JSON.stringify([
    pageDna.identityKey,
    pageDnaFingerprint,
    designRevision,
    DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version,
    pageDna.sourceFingerprint,
    targetManifestFingerprint,
    targetCoverage,
    samples,
  ]));
  const capturedAt = samples.at(-1)?.checkedAt
    ?? rawSamples.map((sample) => sample?.checkedAt).filter((value): value is string => typeof value === "string").sort().at(-1)
    ?? new Date(0).toISOString();
  return {
    schemaVersion: 1,
    evidenceId: `visual-${fingerprint.slice(0, 16)}`,
    capturedAt,
    scope: pageDna.auditScope,
    identityKey: pageDna.identityKey,
    targetManifestFingerprint,
    pageDnaFingerprint,
    designRevision,
    sharedContractVersion: DEVELOPER_DESIGN_INTEGRATION_CONTRACT.version,
    sourceFingerprint: pageDna.sourceFingerprint,
    baseHVersion: pageDna.baseHVersion,
    viewportResults,
    targetCoverage,
    checkResults,
    artifactRefs: [],
    status,
    fingerprint,
  };
}
