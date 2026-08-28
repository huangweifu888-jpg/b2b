/**
 * Query values in this list select runtime context or a business sub-view;
 * they do not create a second page frame.  Every frame/layout/template
 * resolver must consume this single list so a capability link cannot fall
 * out of the registered Page Factory contract.
 */
export const PAGE_FRAME_NON_IDENTITY_QUERY_KEYS = Object.freeze([
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
  "projectPageName",
  "developmentApply",
  "developmentDraft",
  "visualCardLayout",
  "createTask",
  "capability",
] as const);

const CONTENT_LIBRARY_SHARED_FRAME_PATHS = new Set([
  "/news",
  "/cases",
  "/videos",
  "/blog",
]);

const SOURCE_SCOPE_PREFIX = /^\/(?:zb\/agency-source|zb\/client-source|zb|dl|kh)(?=\/|$)/;

function isContentLibrarySubview(pathname: string, tab: string | null) {
  if (tab !== "list" && tab !== "category") return false;
  const normalizedPath = (pathname.replace(SOURCE_SCOPE_PREFIX, "") || "/").replace(/\/+$/u, "") || "/";
  return CONTENT_LIBRARY_SHARED_FRAME_PATHS.has(normalizedPath);
}

export function normalizePageFrameSearch(pathname: string, search = "") {
  const params = new URLSearchParams(search);
  for (const key of PAGE_FRAME_NON_IDENTITY_QUERY_KEYS) params.delete(key);
  if (isContentLibrarySubview(pathname, params.get("tab"))) params.delete("tab");
  params.sort();
  return params.toString();
}
