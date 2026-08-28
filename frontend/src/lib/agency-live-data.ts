import { platformApi, type PlatformNode } from "./platform-api";
import { fetchAllSitesFromBackend, getAllSites, sortSitesByCreatedOrder, type PublishedSite } from "./sites";
import { getPlatformNodeTime, resolveCurrentAgencyContext } from "./platform-live";

export interface AgencyLiveSnapshot {
  tree: PlatformNode[];
  allNodes: PlatformNode[];
  parentMap: Map<number, PlatformNode>;
  currentAgency: PlatformNode | null;
  sites: PublishedSite[];
}

function flattenPlatformTree(nodes: PlatformNode[]): PlatformNode[] {
  const items: PlatformNode[] = [];
  const visit = (node: PlatformNode) => {
    items.push(node);
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return items;
}

function collectDescendants(root: PlatformNode, predicate: (node: PlatformNode) => boolean) {
  const items: PlatformNode[] = [];
  const visit = (node: PlatformNode) => {
    if (predicate(node)) items.push(node);
    node.children.forEach(visit);
  };
  visit(root);
  return items;
}

function parseTime(value?: string) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

export function sortLatestFirst<T extends { created_at?: string; updated_at?: string; id: number }>(items: T[]) {
  return [...items].sort((a, b) => {
    const updatedDiff = parseTime(b.updated_at) - parseTime(a.updated_at);
    if (updatedDiff !== 0) return updatedDiff;
    const createdDiff = parseTime(b.created_at) - parseTime(a.created_at);
    if (createdDiff !== 0) return createdDiff;
    return b.id - a.id;
  });
}

export function collectAgencyClients(agency: PlatformNode | null) {
  if (!agency) return [] as PlatformNode[];
  return sortLatestFirst(collectDescendants(agency, (node) => node.org_type === "client"));
}

export function collectAgencyProjects(agency: PlatformNode | null) {
  if (!agency) return [] as Array<PlatformNode["projects"][number] & { client: PlatformNode }>;
  const clients = collectAgencyClients(agency);
  const items: Array<PlatformNode["projects"][number] & { client: PlatformNode }> = [];
  clients.forEach((client) => {
    client.projects.forEach((project) => {
      items.push({ ...project, client });
    });
  });
  return items.sort((a, b) => {
    const updatedDiff = parseTime(b.updated_at) - parseTime(a.updated_at);
    if (updatedDiff !== 0) return updatedDiff;
    const createdDiff = parseTime(b.created_at) - parseTime(a.created_at);
    if (createdDiff !== 0) return createdDiff;
    return b.id - a.id;
  });
}

export function collectAgencySites(agency: PlatformNode | null, sites: PublishedSite[]) {
  if (!agency) return [] as PublishedSite[];
  const agencyCode = agency.code.trim().toUpperCase();
  return sortSitesByCreatedOrder(sites.filter((site) => (site.agencyCode || "").trim().toUpperCase() === agencyCode));
}

function findLatestAgency(nodes: PlatformNode[]) {
  return (
    nodes
      .filter((node) => node.org_type === "agency" || node.org_type === "sub_agency")
      .sort((a, b) => getPlatformNodeTime(b) - getPlatformNodeTime(a))[0] || null
  );
}

export async function loadAgencyLiveSnapshot(): Promise<AgencyLiveSnapshot> {
  const [treeResult, sitesResult] = await Promise.allSettled([platformApi.tree(), fetchAllSitesFromBackend()]);

  const tree = treeResult.status === "fulfilled" ? treeResult.value.items || [] : [];
  const sites = sitesResult.status === "fulfilled" ? sitesResult.value : getAllSites();
  const allNodes = flattenPlatformTree(tree);
  const parentMap = new Map(allNodes.map((node) => [node.id, node]));
  const currentAgencyContext = resolveCurrentAgencyContext(tree, {
    url: typeof window !== "undefined" ? window.location.href : "",
    fallbackSites: sites,
  });

  return {
    tree,
    allNodes,
    parentMap,
    currentAgency: currentAgencyContext.agency || findLatestAgency(allNodes),
    sites,
  };
}
