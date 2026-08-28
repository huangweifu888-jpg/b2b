import type { PublishedSite } from "./sites";
import type { PlatformNode } from "./platform-api";

export const CURRENT_AGENCY_STORAGE_KEY = "tradepro.currentAgencyCode";
export const CURRENT_CLIENT_STORAGE_KEY = "tradepro.currentClientCode";

function safeReadStoredCode(storageKey: string) {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(storageKey)?.trim().toUpperCase() || "";
}

function safeWriteStoredCode(storageKey: string, value?: string | null) {
  if (typeof window === "undefined" || !value) return;
  window.localStorage.setItem(storageKey, value);
}

function parseQueryCode(url: string | undefined, key: string) {
  if (!url) return "";
  try {
    return new URL(url).searchParams.get(key)?.trim().toUpperCase() || "";
  } catch {
    return "";
  }
}

function parseQueryValue(url: string | undefined, key: string) {
  if (!url) return "";
  try {
    return new URL(url).searchParams.get(key)?.trim() || "";
  } catch {
    return "";
  }
}

function parseSiteTime(value?: string) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

type ContextSite = Pick<
  PublishedSite,
  "id" | "agencyCode" | "clientCode" | "planCode" | "updatedAt" | "createdAt"
>;

function normalizeCode(value?: string | null) {
  return value?.trim().toUpperCase() || "";
}

function uniqueCodes(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((value) => normalizeCode(value)).filter(Boolean)));
}

function sortContextSitesByLatest(sites?: ContextSite[]) {
  return (sites || [])
    .slice()
    .sort((a, b) => parseSiteTime(b.updatedAt || b.createdAt) - parseSiteTime(a.updatedAt || a.createdAt));
}

function resolveCurrentSiteFromOptions(url?: string, fallbackSites?: ContextSite[]) {
  const siteId = parseQueryValue(url, "siteId");
  if (!siteId) return null;
  return (fallbackSites || []).find((site) => site.id === siteId) || null;
}

function getLatestSiteCode(fallbackSites: ContextSite[] | undefined, key: "agencyCode" | "clientCode" | "planCode") {
  return sortContextSitesByLatest(fallbackSites).map((site) => site[key]).find((value) => normalizeCode(value)) || "";
}

export function flattenPlatformTree(nodes: PlatformNode[]): PlatformNode[] {
  const items: PlatformNode[] = [];
  const visit = (node: PlatformNode) => {
    items.push(node);
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return items;
}

export function getPlatformNodeTime(node: Pick<PlatformNode, "updated_at" | "created_at" | "id">) {
  const raw = node.updated_at || node.created_at;
  const value = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(value) ? value : node.id;
}

export function resolveCurrentClientContext(
  tree: PlatformNode[],
  options?: {
    url?: string;
    fallbackSites?: ContextSite[];
  }
) {
  const allNodes = flattenPlatformTree(tree);
  const clients = allNodes
    .filter((node) => node.org_type === "client")
    .sort((a, b) => getPlatformNodeTime(b) - getPlatformNodeTime(a));
  const parentMap = new Map(allNodes.map((node) => [node.id, node]));

  if (!clients.length) {
    return { client: null as PlatformNode | null, agency: null as PlatformNode | null };
  }

  const currentSite = resolveCurrentSiteFromOptions(options?.url, options?.fallbackSites);
  const queryCode = parseQueryCode(options?.url, "client");
  const storedCode = safeReadStoredCode(CURRENT_CLIENT_STORAGE_KEY);
  const latestClientCode = getLatestSiteCode(options?.fallbackSites, "clientCode");
  const fallbackClientCodes = sortContextSitesByLatest(options?.fallbackSites).map((site) => site.clientCode);

  const candidateCodes = uniqueCodes([currentSite?.clientCode, queryCode, latestClientCode, ...fallbackClientCodes, storedCode]);
  const client = candidateCodes.map((code) => clients.find((item) => item.code === code)).find(Boolean) || clients[0];
  const agency = client.parent_id ? parentMap.get(client.parent_id) || null : null;

  safeWriteStoredCode(CURRENT_CLIENT_STORAGE_KEY, client.code);
  if (agency?.code) {
    safeWriteStoredCode(CURRENT_AGENCY_STORAGE_KEY, agency.code);
  }

  return { client, agency };
}

export function resolveCurrentAgencyContext(
  tree: PlatformNode[],
  options?: {
    url?: string;
    fallbackSites?: ContextSite[];
  }
) {
  const allNodes = flattenPlatformTree(tree);
  const agencies = allNodes
    .filter((node) => node.org_type === "agency" || node.org_type === "sub_agency")
    .sort((a, b) => getPlatformNodeTime(b) - getPlatformNodeTime(a));

  if (!agencies.length) {
    return { agency: null as PlatformNode | null };
  }

  const currentSite = resolveCurrentSiteFromOptions(options?.url, options?.fallbackSites);
  const queryCode = parseQueryCode(options?.url, "agency");
  const storedCode = safeReadStoredCode(CURRENT_AGENCY_STORAGE_KEY);
  const latestAgencyCode = getLatestSiteCode(options?.fallbackSites, "agencyCode");
  const fallbackAgencyCodes = sortContextSitesByLatest(options?.fallbackSites).map((site) => site.agencyCode);

  const candidateCodes = uniqueCodes([currentSite?.agencyCode, queryCode, latestAgencyCode, ...fallbackAgencyCodes, storedCode]);
  const agency = candidateCodes.map((code) => agencies.find((item) => item.code === code)).find(Boolean) || agencies[0];

  safeWriteStoredCode(CURRENT_AGENCY_STORAGE_KEY, agency.code);
  return { agency };
}

export function resolveProjectContext(
  tree: PlatformNode[],
  options?: {
    url?: string;
    clientCode?: string | null;
    planCode?: string | null;
    fallbackSites?: ContextSite[];
  }
) {
  const allNodes = flattenPlatformTree(tree);
  const parentMap = new Map(allNodes.map((node) => [node.id, node]));
  const currentSite = resolveCurrentSiteFromOptions(options?.url, options?.fallbackSites);
  const desiredClientCode =
    normalizeCode(currentSite?.clientCode) ||
    normalizeCode(options?.clientCode) ||
    parseQueryCode(options?.url, "client") ||
    normalizeCode(getLatestSiteCode(options?.fallbackSites, "clientCode"));
  const desiredPlanCode =
    normalizeCode(currentSite?.planCode) ||
    normalizeCode(options?.planCode) ||
    parseQueryCode(options?.url, "plan") ||
    normalizeCode(getLatestSiteCode(options?.fallbackSites, "planCode"));
  const { client: fallbackClient, agency: fallbackAgency } = resolveCurrentClientContext(tree, {
    url: options?.url,
    fallbackSites: options?.fallbackSites,
  });

  let client =
    allNodes.find((node) => node.org_type === "client" && node.code === desiredClientCode) || fallbackClient;

  const project =
    (client?.projects || []).find((item) => item.code === desiredPlanCode) ||
    allNodes
      .filter((node) => node.org_type === "client")
      .flatMap((node) => node.projects.map((project) => ({ client: node, project })))
      .find((entry) => entry.project.code === desiredPlanCode)?.project ||
    null;

  if (!client && project) {
    client = allNodes.find((node) => node.org_type === "client" && node.id === project.client_org_id) || fallbackClient;
  }

  const agency = client?.parent_id ? parentMap.get(client.parent_id) || null : fallbackAgency;
  return { agency, client, project };
}
