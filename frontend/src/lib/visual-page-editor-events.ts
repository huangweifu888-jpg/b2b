import {
  isCompletedSourceLocked,
  isRouteCompletedPageHardLocked,
  resolveCompletedLayoutLock,
} from "@/lib/page-layout-lock";

export const VISUAL_PAGE_EDITOR_OPEN_EVENT = "tradepro:open-visual-page-editor";
export const VISUAL_PAGE_EDITOR_BLOCKED_EVENT = "tradepro:visual-page-editor-blocked";
export const DEVELOPMENT_CONSOLE_REOPEN_EVENT = "tradepro:reopen-development-console";
export const GLOBAL_FRAME_WORKFLOW_ACTION_EVENT = "tradepro:global-frame-workflow-action";
export const GLOBAL_FRAME_WORKFLOW_STATUS_EVENT = "tradepro:global-frame-workflow-status";
export const GLOBAL_FRAME_WORKFLOW_STATUS_HANDOFF_SCHEMA_VERSION = "1.0.0" as const;
export const GLOBAL_FRAME_WORKFLOW_STATUS_HANDOFF_MAX_AGE_MS = 30_000;
export const GLOBAL_FRAME_RELEASE_AUTHORIZATION_SCHEMA_VERSION = "1.0.0" as const;
export const GLOBAL_FRAME_RELEASE_AUTHORIZATION_MAX_AGE_MS = 5 * 60_000;
export const DEVELOPMENT_CONSOLE_OPEN_HANDOFF_SCHEMA_VERSION = "1.0.0" as const;
export const DEVELOPMENT_CONSOLE_OPEN_HANDOFF_MAX_AGE_MS = 30_000;

const DEVELOPMENT_CONSOLE_OPEN_HANDOFF_PREFIX = "tradepro:development-console-open-handoff:v1";
const GLOBAL_FRAME_WORKFLOW_STATUS_HANDOFF_PREFIX = "tradepro:global-frame-workflow-status-handoff:v1";
const DEVELOPMENT_CONSOLE_IDENTITY_KEYS = ["agentPath", "tenantId", "clientId", "planId", "siteId"] as const;

export type VisualPageEditorInitialApplicationScope = "global" | "current-page" | "canary-profile";
export type VisualPageEditorWorkspaceScope = "hq" | "agency_source" | "client_source" | "agency" | "client";

export type VisualPageEditorOpenDetail = {
  pathname?: string;
  search?: string;
  initialApplicationScope?: VisualPageEditorInitialApplicationScope;
  /** Workflow-owned editors cannot switch around their governance boundary. */
  applicationScopeLock?: VisualPageEditorInitialApplicationScope;
  /** Keeps the Developer workbench mounted while Visualizer edits one governed draft. */
  workflowOrigin?: "global-frame-workbench";
};

export type GlobalFrameWorkflowAction =
  | "generate-draft"
  | "preflight"
  | "sync-passed-pages"
  | "publish-three-end"
  | "save-factory-default";

export type GlobalFrameWorkflowStatus = "running" | "waiting" | "passed" | "blocked";

export type GlobalFrameWorkflowTargetSummary = {
  total: number;
  passed: number;
  isolated: number;
};

/**
 * Short-lived, exact-context authorization assembled by the parent Developer
 * chain after 02–06 pass and 08 performs a fresh read-only lock check. It is
 * deliberately carried on the action and checked again by the coordinator so
 * a stale/custom DOM event cannot bypass the release boundary.
 */
export type GlobalFrameReleaseAuthorization = {
  schemaVersion: typeof GLOBAL_FRAME_RELEASE_AUTHORIZATION_SCHEMA_VERSION;
  authorizationId: string;
  workflowRunId: string;
  workflowScopeIdentity: string;
  workflowContractVersion: string;
  workflowSourceFingerprint: string;
  workflowTargetManifestFingerprint: string;
  qualityEvidenceFingerprint: string;
  lockReceiptId: string;
  lockReceiptRecordedAt: string;
  lockSnapshotFingerprint: string;
  issuedAt: string;
  expiresAt: string;
};

/**
 * Narrow UI-to-coordinator request. The workbench never writes release state
 * directly; the single batch coordinator (or the release center handoff) owns
 * version/hash verification, publishing and factory snapshots.
 */
export type GlobalFrameWorkflowActionDetail = {
  pathname: string;
  search: string;
  action: Exclude<GlobalFrameWorkflowAction, "generate-draft">;
  contractVersion: string;
  draftId?: string;
  baseVersion?: string;
  baseHash?: string;
  recoveryPointId?: string;
  releaseAuthorization?: GlobalFrameReleaseAuthorization | null;
  releaseAuthorizationRequestId?: string;
};

type PendingGlobalFrameReleaseAuthorization = {
  action: Exclude<GlobalFrameWorkflowAction, "generate-draft" | "preflight">;
  authorization: GlobalFrameReleaseAuthorization;
};

const pendingGlobalFrameReleaseAuthorizations = new Map<string, PendingGlobalFrameReleaseAuthorization>();
const GLOBAL_FRAME_RELEASE_AUTHORIZATION_FIELDS: readonly (keyof GlobalFrameReleaseAuthorization)[] = [
  "schemaVersion",
  "authorizationId",
  "workflowRunId",
  "workflowScopeIdentity",
  "workflowContractVersion",
  "workflowSourceFingerprint",
  "workflowTargetManifestFingerprint",
  "qualityEvidenceFingerprint",
  "lockReceiptId",
  "lockReceiptRecordedAt",
  "lockSnapshotFingerprint",
  "issuedAt",
  "expiresAt",
];

function isReleaseWritingAction(
  action: Exclude<GlobalFrameWorkflowAction, "generate-draft">,
): action is PendingGlobalFrameReleaseAuthorization["action"] {
  return action === "sync-passed-pages" || action === "publish-three-end" || action === "save-factory-default";
}

function sameGlobalFrameReleaseAuthorization(
  left: GlobalFrameReleaseAuthorization,
  right: GlobalFrameReleaseAuthorization,
) {
  return GLOBAL_FRAME_RELEASE_AUTHORIZATION_FIELDS.every((field) => left[field] === right[field]);
}

/** Result sent back by Visualizer (draft only) or the single coordinator. */
export type GlobalFrameWorkflowStatusDetail = {
  pathname: string;
  search: string;
  action: GlobalFrameWorkflowAction;
  status: GlobalFrameWorkflowStatus;
  message: string;
  draftId?: string;
  baseVersion?: string;
  baseHash?: string;
  releaseVersion?: string;
  releaseHash?: string;
  recoveryPointId?: string;
  targets?: GlobalFrameWorkflowTargetSummary;
  isolatedPageIds?: string[];
  validationEntries?: string[];
};

export type DevelopmentConsoleReopenDetail = {
  pathname: string;
  search: string;
  workspaceScope: VisualPageEditorWorkspaceScope;
  applicationScope: "canary-profile";
  reason: "canary-confirmed";
};

export type DevelopmentConsoleOpenHandoffRequest = {
  pathname: string;
  search: string;
  workspaceScope: VisualPageEditorWorkspaceScope;
  applicationScope: "global";
};

type DevelopmentConsoleOpenHandoff = DevelopmentConsoleOpenHandoffRequest & {
  schemaVersion: typeof DEVELOPMENT_CONSOLE_OPEN_HANDOFF_SCHEMA_VERSION;
  identitySignature: string;
  createdAt: number;
  expiresAt: number;
};

type GlobalFrameWorkflowStatusHandoff = {
  schemaVersion: typeof GLOBAL_FRAME_WORKFLOW_STATUS_HANDOFF_SCHEMA_VERSION;
  detail: GlobalFrameWorkflowStatusDetail;
  createdAt: number;
  expiresAt: number;
};

type SessionStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function resolveWorkspaceScope(pathname: string): VisualPageEditorWorkspaceScope {
  if (pathname.startsWith("/zb/agency-source")) return "agency_source";
  if (pathname.startsWith("/zb/client-source")) return "client_source";
  if (pathname.startsWith("/zb")) return "hq";
  if (pathname.startsWith("/dl")) return "agency";
  return "client";
}

function isRouteWriteLocked(pathname: string, search: string) {
  if (isRouteCompletedPageHardLocked(pathname, search)) return true;
  const lock = resolveCompletedLayoutLock(pathname, search);
  return Boolean(lock && isCompletedSourceLocked(lock));
}

function buildDevelopmentConsoleIdentitySignature(search: string) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return DEVELOPMENT_CONSOLE_IDENTITY_KEYS
    .map((key) => `${key}=${encodeURIComponent(params.get(key)?.trim() || "")}`)
    .join("&");
}

function buildDevelopmentConsoleOpenHandoffKey(request: DevelopmentConsoleOpenHandoffRequest) {
  return `${DEVELOPMENT_CONSOLE_OPEN_HANDOFF_PREFIX}:${encodeURIComponent(request.workspaceScope)}:${encodeURIComponent(`${request.pathname}${request.search}`)}`;
}

function buildGlobalFrameWorkflowStatusHandoffKey(pathname: string, search: string) {
  return `${GLOBAL_FRAME_WORKFLOW_STATUS_HANDOFF_PREFIX}:${encodeURIComponent(`${pathname}${search}`)}`;
}

function isGlobalFrameWorkflowStatusDetail(value: unknown): value is GlobalFrameWorkflowStatusDetail {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const detail = value as Partial<GlobalFrameWorkflowStatusDetail>;
  return typeof detail.pathname === "string"
    && detail.pathname.startsWith("/")
    && typeof detail.search === "string"
    && ["generate-draft", "preflight", "sync-passed-pages", "publish-three-end", "save-factory-default"].includes(detail.action || "")
    && ["running", "waiting", "passed", "blocked"].includes(detail.status || "")
    && typeof detail.message === "string"
    && detail.message.trim().length > 0
    && detail.message.length <= 2_000
    && (!detail.validationEntries || (Array.isArray(detail.validationEntries) && detail.validationEntries.length <= 64))
    && (!detail.isolatedPageIds || (Array.isArray(detail.isolatedPageIds) && detail.isolatedPageIds.length <= 201));
}

/**
 * Persists one short-lived status before dispatching the in-memory event. The
 * Visualizer can close the shared modal in the same tick, so the workbench must
 * be able to recover the exact result after it mounts again.
 */
export function writeGlobalFrameWorkflowStatusHandoff(
  storage: SessionStorageLike,
  detail: GlobalFrameWorkflowStatusDetail,
  now = Date.now(),
) {
  if (!isGlobalFrameWorkflowStatusDetail(detail) || !Number.isFinite(now)) return false;
  const handoff: GlobalFrameWorkflowStatusHandoff = {
    schemaVersion: GLOBAL_FRAME_WORKFLOW_STATUS_HANDOFF_SCHEMA_VERSION,
    detail,
    createdAt: now,
    expiresAt: now + GLOBAL_FRAME_WORKFLOW_STATUS_HANDOFF_MAX_AGE_MS,
  };
  try {
    storage.setItem(
      buildGlobalFrameWorkflowStatusHandoffKey(detail.pathname, detail.search),
      JSON.stringify(handoff),
    );
    return true;
  } catch {
    return false;
  }
}

export function consumeGlobalFrameWorkflowStatusHandoff(
  storage: SessionStorageLike,
  request: { pathname: string; search: string },
  now = Date.now(),
) {
  const key = buildGlobalFrameWorkflowStatusHandoffKey(request.pathname, request.search);
  const raw = storage.getItem(key);
  if (!raw) return null;
  storage.removeItem(key);
  try {
    const handoff = JSON.parse(raw) as Partial<GlobalFrameWorkflowStatusHandoff>;
    if (handoff.schemaVersion !== GLOBAL_FRAME_WORKFLOW_STATUS_HANDOFF_SCHEMA_VERSION
      || !isGlobalFrameWorkflowStatusDetail(handoff.detail)
      || handoff.detail.pathname !== request.pathname
      || handoff.detail.search !== request.search
      || typeof handoff.createdAt !== "number"
      || typeof handoff.expiresAt !== "number"
      || !Number.isFinite(now)
      || handoff.createdAt > now + 5_000
      || handoff.expiresAt < now
      || now - handoff.createdAt > GLOBAL_FRAME_WORKFLOW_STATUS_HANDOFF_MAX_AGE_MS) return null;
    return handoff.detail;
  } catch {
    return null;
  }
}

export function writeDevelopmentConsoleOpenHandoff(
  storage: SessionStorageLike,
  request: DevelopmentConsoleOpenHandoffRequest,
  now = Date.now(),
) {
  if (request.applicationScope !== "global"
    || request.workspaceScope !== resolveWorkspaceScope(request.pathname)
    || !request.pathname.startsWith("/")
    || !Number.isFinite(now)) return false;
  const handoff: DevelopmentConsoleOpenHandoff = {
    ...request,
    schemaVersion: DEVELOPMENT_CONSOLE_OPEN_HANDOFF_SCHEMA_VERSION,
    identitySignature: buildDevelopmentConsoleIdentitySignature(request.search),
    createdAt: now,
    expiresAt: now + DEVELOPMENT_CONSOLE_OPEN_HANDOFF_MAX_AGE_MS,
  };
  try {
    storage.setItem(buildDevelopmentConsoleOpenHandoffKey(request), JSON.stringify(handoff));
    return true;
  } catch {
    return false;
  }
}

export function consumeDevelopmentConsoleOpenHandoff(
  storage: SessionStorageLike,
  request: DevelopmentConsoleOpenHandoffRequest,
  now = Date.now(),
) {
  const key = buildDevelopmentConsoleOpenHandoffKey(request);
  const raw = storage.getItem(key);
  if (!raw) return null;
  storage.removeItem(key);
  try {
    const parsed = JSON.parse(raw) as Partial<DevelopmentConsoleOpenHandoff>;
    if (parsed.schemaVersion !== DEVELOPMENT_CONSOLE_OPEN_HANDOFF_SCHEMA_VERSION
      || parsed.applicationScope !== "global"
      || parsed.workspaceScope !== request.workspaceScope
      || parsed.pathname !== request.pathname
      || parsed.search !== request.search
      || parsed.identitySignature !== buildDevelopmentConsoleIdentitySignature(request.search)
      || typeof parsed.createdAt !== "number"
      || typeof parsed.expiresAt !== "number"
      || parsed.createdAt > now + 5_000
      || parsed.expiresAt < now
      || now - parsed.createdAt > DEVELOPMENT_CONSOLE_OPEN_HANDOFF_MAX_AGE_MS) return null;
    return parsed as DevelopmentConsoleOpenHandoff;
  } catch {
    return null;
  }
}

export function requestVisualPageEditorOpen(detail: VisualPageEditorOpenDetail = {}) {
  const pathname = detail.pathname || window.location.pathname;
  const search = detail.search ?? window.location.search;
  const normalizedDetail: VisualPageEditorOpenDetail = {
    pathname,
    search,
    initialApplicationScope: detail.initialApplicationScope ?? "current-page",
    applicationScopeLock: detail.applicationScopeLock,
    workflowOrigin: detail.workflowOrigin,
  };
  if (isRouteWriteLocked(pathname, search)) {
    window.dispatchEvent(new CustomEvent<VisualPageEditorOpenDetail>(VISUAL_PAGE_EDITOR_BLOCKED_EVENT, {
      detail: normalizedDetail,
    }));
    return false;
  }
  window.dispatchEvent(new CustomEvent<VisualPageEditorOpenDetail>(VISUAL_PAGE_EDITOR_OPEN_EVENT, { detail: normalizedDetail }));
  return true;
}

export function requestGlobalFrameWorkflowAction(detail: GlobalFrameWorkflowActionDetail) {
  if (!detail.pathname.startsWith("/")) return false;
  const { releaseAuthorization, ...publicDetail } = detail;
  let releaseAuthorizationRequestId: string | undefined;
  if (isReleaseWritingAction(detail.action)) {
    if (!releaseAuthorization || Date.parse(releaseAuthorization.expiresAt) <= Date.now()) return false;
    releaseAuthorizationRequestId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `release-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    pendingGlobalFrameReleaseAuthorizations.set(releaseAuthorizationRequestId, {
      action: detail.action,
      authorization: releaseAuthorization,
    });
  }
  window.dispatchEvent(new CustomEvent<GlobalFrameWorkflowActionDetail>(GLOBAL_FRAME_WORKFLOW_ACTION_EVENT, {
    detail: { ...publicDetail, releaseAuthorizationRequestId },
  }));
  if (releaseAuthorizationRequestId) pendingGlobalFrameReleaseAuthorizations.delete(releaseAuthorizationRequestId);
  return true;
}

/**
 * Consumes one module-private authorization. The CustomEvent carries only an
 * opaque request id, so forged, replayed or wrong-action events fail closed.
 */
export function consumeGlobalFrameReleaseAuthorization(
  detail: GlobalFrameWorkflowActionDetail,
  current: GlobalFrameReleaseAuthorization | null,
  now = Date.now(),
) {
  const requestId = detail.releaseAuthorizationRequestId;
  if (!requestId || !current || !isReleaseWritingAction(detail.action)) return null;
  const pending = pendingGlobalFrameReleaseAuthorizations.get(requestId);
  pendingGlobalFrameReleaseAuthorizations.delete(requestId);
  if (!pending
    || pending.action !== detail.action
    || Date.parse(pending.authorization.expiresAt) <= now
    || Date.parse(current.expiresAt) <= now
    || !sameGlobalFrameReleaseAuthorization(pending.authorization, current)) return null;
  return pending.authorization;
}

export function reportGlobalFrameWorkflowStatus(detail: GlobalFrameWorkflowStatusDetail) {
  if (!detail.pathname.startsWith("/") || !detail.message.trim()) return false;
  writeGlobalFrameWorkflowStatusHandoff(window.sessionStorage, detail);
  window.dispatchEvent(new CustomEvent<GlobalFrameWorkflowStatusDetail>(GLOBAL_FRAME_WORKFLOW_STATUS_EVENT, { detail }));
  return true;
}

/**
 * Reopens only the same route's source console after a confirmed canary save.
 * Both the dispatcher and the listener validate the route and workspace so a
 * stale Visualizer cannot open a different project's developer console.
 */
export function requestDevelopmentConsoleReopen(detail: DevelopmentConsoleReopenDetail) {
  if (detail.reason !== "canary-confirmed"
    || detail.applicationScope !== "canary-profile"
    || detail.pathname !== window.location.pathname
    || detail.search !== window.location.search
    || detail.workspaceScope !== resolveWorkspaceScope(detail.pathname)) return false;
  window.dispatchEvent(new CustomEvent<DevelopmentConsoleReopenDetail>(DEVELOPMENT_CONSOLE_REOPEN_EVENT, { detail }));
  return true;
}
