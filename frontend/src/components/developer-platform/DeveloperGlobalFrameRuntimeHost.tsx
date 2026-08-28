import { useEffect } from "react";

import "@/developer-global-frame-runtime.css";
import {
  buildDeveloperGlobalFrameAdapterRootSelector,
} from "@/lib/developer-global-frame-adapter-registry";
import { resolveDeveloperGlobalFrameAdapterForRoute } from "@/lib/developer-global-frame-adapter-resolution";
import type { PageFactoryScope } from "@/page-factory/page-factory";
import {
  DEVELOPER_GLOBAL_FRAME_SECTION_NAME,
  DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
} from "@/lib/developer-global-frame-draft";
import {
  DEVELOPER_GLOBAL_FRAME_PUBLISHED_EVENT,
  parseDeveloperGlobalFramePublishedEventDetail,
  readLatestDeveloperGlobalFramePublishedEvent,
  readDeveloperGlobalFramePublishedStorageEvent,
  type DeveloperGlobalFramePublishedEventDetail,
} from "@/lib/developer-global-frame-published-event";
import {
  applyDeveloperGlobalFrameRuntimeProfile,
  applyDeveloperGlobalFrameTemplateRuntimeProfile,
  inspectDeveloperGlobalFrameCanonicalRoot,
  resolveDeveloperGlobalFrameRuntimeApplication,
  resolveDeveloperGlobalFrameTemplateRuntimeApplication,
  type DeveloperGlobalFrameCanonicalNodes,
} from "@/lib/developer-global-frame-runtime";
import { fetchTemplate } from "@/lib/template-snapshot/api";

type DeveloperGlobalFrameRuntimeHostProps = {
  pathname: string;
  search: string;
  sourceScope: PageFactoryScope;
};

type PublishedSectionLoadResult =
  | { status: "loaded"; section: unknown | null; serverHash: string | null; serverHashKind: PublishedServerHashKind | null }
  | { status: "failed"; section: null; serverHash: null; serverHashKind: null };

type PublishedServerHashKind = "published-config-hash";

type PublishedSectionCacheEntry = {
  hasValue: boolean;
  value: unknown | null;
  serverHash: string | null;
  serverHashKind: PublishedServerHashKind | null;
  expiresAt: number;
  invalidationRevision: number;
  requestRevision: number | null;
  inFlight: Promise<PublishedSectionLoadResult> | null;
  queuedRefresh: Promise<PublishedSectionLoadResult> | null;
  lastConsumedNonce: string | null;
};

export const DEVELOPER_GLOBAL_FRAME_PUBLISHED_CACHE_TTL_MS = 30_000;
export const DEVELOPER_GLOBAL_FRAME_EMPTY_CACHE_TTL_MS = 5_000;
const DEVELOPER_GLOBAL_FRAME_RETRY_DELAYS_MS = [1_000, 4_000] as const;
const DEVELOPER_GLOBAL_FRAME_DOM_RETRY_DELAYS_MS = [0, 50, 250, 1_000, 4_000] as const;
const publishedSectionCache = new Map<string, PublishedSectionCacheEntry>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function extractPublishedDeveloperGlobalFrameSection(value: unknown) {
  if (!isRecord(value)
    || value.template_id !== DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID
    || value.owner_scope !== "client_source"
    || value.is_published !== true
    || typeof value.latest_version !== "string") return null;
  const latestVersion = value.latest_version.trim();
  if (!latestVersion || !isRecord(value.config_json)) return null;
  const section = value.config_json[DEVELOPER_GLOBAL_FRAME_SECTION_NAME];
  if (!isRecord(section) || section.profile_version !== latestVersion) return null;
  return section;
}

function extractPublishedDeveloperGlobalFrameServerHash(value: unknown): { hash: string; kind: PublishedServerHashKind } | null {
  if (!isRecord(value)) return null;
  const publishedHash = typeof value.published_config_hash === "string" ? value.published_config_hash.trim() : "";
  return /^[0-9a-f]{64}$/u.test(publishedHash) ? { hash: publishedHash, kind: "published-config-hash" } : null;
}

function getPublishedSectionCacheEntry(templateId: string) {
  const cached = publishedSectionCache.get(templateId);
  if (cached) return cached;
  const entry: PublishedSectionCacheEntry = {
    hasValue: false,
    value: null,
    serverHash: null,
    serverHashKind: null,
    expiresAt: 0,
    invalidationRevision: 0,
    requestRevision: null,
    inFlight: null,
    queuedRefresh: null,
    lastConsumedNonce: null,
  };
  publishedSectionCache.set(templateId, entry);
  return entry;
}

export function invalidateDeveloperGlobalFramePublishedSection(templateId = DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID) {
  const entry = getPublishedSectionCacheEntry(templateId);
  entry.invalidationRevision += 1;
  entry.expiresAt = 0;
}

export function consumeDeveloperGlobalFramePublishedInvalidation(detail: DeveloperGlobalFramePublishedEventDetail) {
  const entry = getPublishedSectionCacheEntry(detail.templateId);
  if (entry.lastConsumedNonce === detail.nonce) return false;
  entry.lastConsumedNonce = detail.nonce;
  entry.invalidationRevision += 1;
  entry.expiresAt = 0;
  return true;
}

export function loadPublishedDeveloperGlobalFrameSection(
  templateId = DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID,
  options: { force?: boolean } = {},
): Promise<PublishedSectionLoadResult> {
  const entry = getPublishedSectionCacheEntry(templateId);
  if (entry.inFlight) {
    if (entry.requestRevision === entry.invalidationRevision) return entry.inFlight;
    if (!entry.queuedRefresh) {
      const activeRequest = entry.inFlight;
      const queuedRefresh = activeRequest.then(
        () => loadPublishedDeveloperGlobalFrameSection(templateId, { force: true }),
        () => loadPublishedDeveloperGlobalFrameSection(templateId, { force: true }),
      ).finally(() => {
        if (entry.queuedRefresh === queuedRefresh) entry.queuedRefresh = null;
      });
      entry.queuedRefresh = queuedRefresh;
    }
    return entry.queuedRefresh;
  }
  if (!options.force && entry.hasValue && Date.now() < entry.expiresAt) {
    return Promise.resolve({
      status: "loaded",
      section: entry.value,
      serverHash: entry.serverHash,
      serverHashKind: entry.serverHashKind,
    });
  }

  const requestRevision = entry.invalidationRevision;
  const request = fetchTemplate(templateId).then((value): PublishedSectionLoadResult => {
    const extractedSection = extractPublishedDeveloperGlobalFrameSection(value);
    const serverHash = extractPublishedDeveloperGlobalFrameServerHash(value);
    const section = extractedSection && serverHash ? extractedSection : null;
    if (entry.invalidationRevision === requestRevision) {
      entry.hasValue = true;
      entry.value = section;
      entry.serverHash = section ? serverHash?.hash ?? null : null;
      entry.serverHashKind = section ? serverHash?.kind ?? null : null;
      entry.expiresAt = Date.now() + (section
        ? DEVELOPER_GLOBAL_FRAME_PUBLISHED_CACHE_TTL_MS
        : DEVELOPER_GLOBAL_FRAME_EMPTY_CACHE_TTL_MS);
    }
    return {
      status: "loaded",
      section,
      serverHash: section ? serverHash?.hash ?? null : null,
      serverHashKind: section ? serverHash?.kind ?? null : null,
    };
  }).catch((): PublishedSectionLoadResult => ({ status: "failed", section: null, serverHash: null, serverHashKind: null })).finally(() => {
    if (entry.inFlight === request) {
      entry.inFlight = null;
      entry.requestRevision = null;
    }
  });
  entry.requestRevision = requestRevision;
  entry.inFlight = request;
  return request;
}

export function clearDeveloperGlobalFramePublishedSectionCacheForTests() {
  publishedSectionCache.clear();
}

function sameCanonicalNodes(left: DeveloperGlobalFrameCanonicalNodes | null, right: DeveloperGlobalFrameCanonicalNodes) {
  return Boolean(left
    && left.workspace === right.workspace
    && left.bodyMarkerHost === right.bodyMarkerHost
    && left.bodyMarkerHitArea === right.bodyMarkerHitArea
    && left.bridge === right.bridge
    && left.title === right.title
    && left.tableShell === right.tableShell
    && left.tableHeader === right.tableHeader
    && left.content === right.content
    && left.scrollbar === right.scrollbar);
}

export function DeveloperGlobalFrameRuntimeHost({ pathname, search, sourceScope }: DeveloperGlobalFrameRuntimeHostProps) {
  useEffect(() => {
    let refreshAfterInvalidation: (() => void) | null = null;
    const consumePublishedInvalidation = (detailValue: unknown) => {
      const detail = parseDeveloperGlobalFramePublishedEventDetail(detailValue);
      if (!detail || !consumeDeveloperGlobalFramePublishedInvalidation(detail)) return;
      refreshAfterInvalidation?.();
    };
    const handlePublishedEvent = (event: Event) => {
      consumePublishedInvalidation(event instanceof CustomEvent ? event.detail : null);
    };
    const handlePublishedStorageEvent = (event: StorageEvent) => {
      const detail = readDeveloperGlobalFramePublishedStorageEvent(event);
      if (detail) consumePublishedInvalidation(detail);
    };
    const removePublishedListeners = () => {
      window.removeEventListener(DEVELOPER_GLOBAL_FRAME_PUBLISHED_EVENT, handlePublishedEvent);
      window.removeEventListener("storage", handlePublishedStorageEvent);
    };
    window.addEventListener(DEVELOPER_GLOBAL_FRAME_PUBLISHED_EVENT, handlePublishedEvent);
    window.addEventListener("storage", handlePublishedStorageEvent);
    consumePublishedInvalidation(readLatestDeveloperGlobalFramePublishedEvent());

    const resolution = resolveDeveloperGlobalFrameAdapterForRoute(pathname, search, sourceScope);
    if (!resolution || resolution.sourceScope !== sourceScope) return removePublishedListeners;
    const registration = resolution?.explicitRegistration ?? null;
    if (registration && resolution.pageFactoryId !== registration.pageFactoryId) {
      return removePublishedListeners;
    }
    const responsiveShellScope = sourceScope === "agency_source" ? "agency-source" : sourceScope === "client_source" ? "client-source" : "hq";
    const shellMatches = document.querySelectorAll<HTMLElement>(`[data-responsive-shell="${responsiveShellScope}"]`);
    if (shellMatches.length !== 1) return removePublishedListeners;
    const shell = shellMatches[0];
    let disposed = false;
    let loadRevision = 0;
    let hasPublishedSection = false;
    let publishedSection: unknown | null = null;
    let publishedServerHash: string | null = null;
    let publishedServerHashKind: PublishedServerHashKind | null = null;
    let appliedNodes: DeveloperGlobalFrameCanonicalNodes | null = null;
    let appliedTopbar: HTMLElement | null = null;
    let appliedFooter: HTMLElement | null = null;
    let appliedTemplateHost: HTMLElement | null = null;
    let appliedEvidenceElements: HTMLElement[] = [];
    let appliedEvidenceHash: string | null = null;
    let appliedProfileVersion: string | null = null;
    let cleanupApplication: (() => void) | null = null;
    let retryTimer: number | null = null;
    let retryAttempt = 0;
    let domRetryTimer: number | null = null;
    let domRetryAttempt = 0;

    const clearApplication = () => {
      for (const element of appliedEvidenceElements) {
        if (element.dataset.developerGlobalFramePublishedHash === appliedEvidenceHash) {
          delete element.dataset.developerGlobalFramePublishedHash;
          delete element.dataset.developerGlobalFramePublishedHashKind;
          delete element.dataset.developerGlobalFramePublishedVersion;
        }
      }
      appliedEvidenceElements = [];
      appliedEvidenceHash = null;
      if (appliedTemplateHost?.dataset.developerGlobalFramePublishedRuntime === "applied") {
        delete appliedTemplateHost.dataset.developerGlobalFramePublishedRuntime;
      }
      cleanupApplication?.();
      cleanupApplication = null;
      appliedNodes = null;
      appliedTopbar = null;
      appliedFooter = null;
      appliedTemplateHost = null;
      appliedProfileVersion = null;
    };
    const markPublishedEvidence = (elements: readonly HTMLElement[], profileVersion: string) => {
      if (!publishedServerHash || !publishedServerHashKind) return false;
      appliedEvidenceElements = [...new Set(elements)];
      appliedEvidenceHash = publishedServerHash;
      for (const element of appliedEvidenceElements) {
        element.dataset.developerGlobalFramePublishedHash = publishedServerHash;
        element.dataset.developerGlobalFramePublishedHashKind = publishedServerHashKind;
        element.dataset.developerGlobalFramePublishedVersion = profileVersion;
      }
      return true;
    };
    const reconcile = () => {
      if (disposed || !hasPublishedSection || !publishedSection) {
        clearApplication();
        return;
      }
      if (!registration) {
        const application = resolveDeveloperGlobalFrameTemplateRuntimeApplication(publishedSection, resolution);
        const responsiveHosts = Array.from(shell.querySelectorAll<HTMLElement>("[data-responsive-page-host]"))
          .filter((candidate) => candidate.dataset.developerGlobalFrameResolvedPageId === resolution.pageFactoryId);
        if (!application) {
          clearApplication();
          return;
        }
        if (responsiveHosts.length !== 1) {
          clearApplication();
          scheduleDomRetry();
          return;
        }
        const templateHost = responsiveHosts[0];
        if (appliedTemplateHost === templateHost
          && appliedProfileVersion === application.section.profile_version
          && appliedEvidenceHash === publishedServerHash) {
          resetDomRetry();
          return;
        }
        clearApplication();
        cleanupApplication = applyDeveloperGlobalFrameTemplateRuntimeProfile(application.section, templateHost);
        templateHost.dataset.developerGlobalFramePublishedRuntime = "applied";
        appliedTemplateHost = templateHost;
        if (!markPublishedEvidence([templateHost, shell, document.documentElement], application.section.profile_version)) {
          clearApplication();
          return;
        }
        appliedProfileVersion = application.section.profile_version;
        resetDomRetry();
        return;
      }

      const application = resolveDeveloperGlobalFrameRuntimeApplication(publishedSection, registration);
      const roots = shell.querySelectorAll<HTMLElement>(buildDeveloperGlobalFrameAdapterRootSelector(registration));
      const topbars = shell.querySelectorAll<HTMLElement>("[data-responsive-topbar]");
      const footers = shell.querySelectorAll<HTMLElement>("[data-page-layout-footer]");
      if (!application) {
        clearApplication();
        return;
      }
      if (roots.length !== 1 || topbars.length !== 1 || footers.length !== 1) {
        clearApplication();
        scheduleDomRetry();
        return;
      }
      const nodes = inspectDeveloperGlobalFrameCanonicalRoot(roots[0], registration, {
        requireMarkerGeometry: false,
      });
      if (!nodes) {
        clearApplication();
        scheduleDomRetry();
        return;
      }
      // Once the same immutable profile owns the same canonical nodes, a
      // drawer/editor layout transition must not tear it down merely because
      // the portal hit-area is one frame behind the workspace geometry.
      if (sameCanonicalNodes(appliedNodes, nodes)
        && appliedTopbar === topbars[0]
        && appliedFooter === footers[0]
        && appliedProfileVersion === application.section.profile_version
        && appliedEvidenceHash === publishedServerHash) {
        resetDomRetry();
        return;
      }
      const geometryReadyNodes = inspectDeveloperGlobalFrameCanonicalRoot(roots[0], registration);
      if (!geometryReadyNodes) {
        clearApplication();
        scheduleDomRetry();
        return;
      }
      clearApplication();
      cleanupApplication = applyDeveloperGlobalFrameRuntimeProfile(application, {
        ...geometryReadyNodes,
        topbar: topbars[0],
        footer: footers[0],
      });
      if (!markPublishedEvidence([geometryReadyNodes.workspace, shell, document.documentElement], application.section.profile_version)) {
        clearApplication();
        return;
      }
      appliedNodes = geometryReadyNodes;
      appliedTopbar = topbars[0];
      appliedFooter = footers[0];
      appliedProfileVersion = application.section.profile_version;
      resetDomRetry();
    };
    function resetDomRetry() {
      if (domRetryTimer !== null) window.clearTimeout(domRetryTimer);
      domRetryTimer = null;
      domRetryAttempt = 0;
    }
    function scheduleDomRetry() {
      if (disposed || domRetryTimer !== null || domRetryAttempt >= DEVELOPER_GLOBAL_FRAME_DOM_RETRY_DELAYS_MS.length) return;
      const delay = DEVELOPER_GLOBAL_FRAME_DOM_RETRY_DELAYS_MS[domRetryAttempt];
      domRetryAttempt += 1;
      domRetryTimer = window.setTimeout(() => {
        domRetryTimer = null;
        reconcile();
      }, delay);
    }

    function resetRetry() {
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      retryTimer = null;
      retryAttempt = 0;
    }
    function scheduleRetry() {
      if (disposed || retryTimer !== null || retryAttempt >= DEVELOPER_GLOBAL_FRAME_RETRY_DELAYS_MS.length) return;
      const delay = DEVELOPER_GLOBAL_FRAME_RETRY_DELAYS_MS[retryAttempt];
      retryAttempt += 1;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        refreshPublishedSection(true);
      }, delay);
    }
    function refreshPublishedSection(force = false) {
      const currentLoadRevision = ++loadRevision;
      void loadPublishedDeveloperGlobalFrameSection(DEVELOPER_GLOBAL_FRAME_TEMPLATE_ID, { force }).then((result) => {
        if (disposed || currentLoadRevision !== loadRevision) return;
        if (result.status === "failed") {
          scheduleRetry();
          return;
        }
        resetRetry();
        hasPublishedSection = true;
        publishedSection = result.section;
        publishedServerHash = result.serverHash;
        publishedServerHashKind = result.serverHashKind;
        reconcile();
      });
    }
    refreshAfterInvalidation = () => {
      resetRetry();
      refreshPublishedSection(true);
    };
    const handleWorkspaceMarkerLayout = () => {
      resetDomRetry();
      reconcile();
    };

    const observer = new MutationObserver(reconcile);
    observer.observe(shell, { childList: true, subtree: true });
    window.addEventListener("tradepro:workspace-marker-layout", handleWorkspaceMarkerLayout);
    refreshPublishedSection();
    reconcile();
    return () => {
      disposed = true;
      loadRevision += 1;
      observer.disconnect();
      window.removeEventListener("tradepro:workspace-marker-layout", handleWorkspaceMarkerLayout);
      removePublishedListeners();
      resetRetry();
      resetDomRetry();
      clearApplication();
    };
  }, [pathname, search, sourceScope]);

  return null;
}
