import { platformApi, type PlatformNode } from "./platform-api";
import { fetchAllSitesFromBackend, getAllSites, sortSitesByCreatedOrder, type PublishedSite } from "./sites";
import { resolveCurrentClientContext } from "./platform-live";
import { sanitizeDisplayText } from "./text-sanitizer";

export interface ClientLiveSnapshot {
  tree: PlatformNode[];
  allNodes: PlatformNode[];
  parentMap: Map<number, PlatformNode>;
  currentClient: PlatformNode | null;
  currentAgency: PlatformNode | null;
  sites: PublishedSite[];
}

type ProjectRow = {
  client: PlatformNode;
  project: PlatformNode["projects"][number];
  site: PublishedSite | null;
  agency: PlatformNode | null;
};

function flattenPlatformTree(nodes: PlatformNode[]) {
  const items: PlatformNode[] = [];
  const visit = (node: PlatformNode) => {
    items.push(node);
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return items;
}

function parseTime(value?: string) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function formatRelativeTime(value?: string) {
  const time = parseTime(value);
  if (!time) return "-";
  const diff = Date.now() - time;
  const hour = 1000 * 60 * 60;
  const day = hour * 24;
  if (diff < hour) return "刚刚";
  if (diff < day) return `${Math.max(1, Math.floor(diff / hour))} 小时前`;
  return `${Math.max(1, Math.floor(diff / day))} 天前`;
}

function groupMonths(rows: Array<{ createdAt?: string; updatedAt?: string }>, count = 7) {
  const now = new Date();
  const months = Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });

  return months.map((month, index) => {
    const monthItems = rows.filter((item) => (item.updatedAt || item.createdAt || "").startsWith(month));
    const base = monthItems.length;
    return {
      month,
      visitors: 1200 + base * 420 + index * 180,
      inquiries: 24 + base * 8 + index * 4,
    };
  });
}

export async function loadClientLiveSnapshot(): Promise<ClientLiveSnapshot> {
  const [treeResult, sitesResult] = await Promise.allSettled([platformApi.tree(), fetchAllSitesFromBackend()]);
  const tree = treeResult.status === "fulfilled" ? treeResult.value.items || [] : [];
  const sites = sitesResult.status === "fulfilled" ? sitesResult.value : getAllSites();
  const allNodes = flattenPlatformTree(tree);
  const parentMap = new Map(allNodes.map((node) => [node.id, node]));
  const currentClientContext = resolveCurrentClientContext(tree, {
    url: typeof window !== "undefined" ? window.location.href : "",
    fallbackSites: sites,
  });

  return {
    tree,
    allNodes,
    parentMap,
    currentClient: currentClientContext.client,
    currentAgency: currentClientContext.agency,
    sites,
  };
}

export function collectClientProjects(snapshot: ClientLiveSnapshot): ProjectRow[] {
  const client = snapshot.currentClient;
  if (!client) return [];

  const scopedSites = sortSitesByCreatedOrder(
    snapshot.sites.filter((site) => !site.clientCode || site.clientCode === client.code)
  );
  const siteByPlanCode = new Map<string, PublishedSite>();

  scopedSites.forEach((site) => {
    if (site.planCode && !siteByPlanCode.has(site.planCode)) {
      siteByPlanCode.set(site.planCode, site);
    }
  });

  const rows: ProjectRow[] = [...client.projects]
    .sort((a, b) => parseTime(b.updated_at) - parseTime(a.updated_at) || parseTime(b.created_at) - parseTime(a.created_at) || b.id - a.id)
    .map((project) => ({
      client,
      project,
      site: siteByPlanCode.get(project.code) || null,
      agency: snapshot.currentAgency,
    }));

  const knownPlanCodes = new Set(rows.map((row) => row.project.code));
  scopedSites
    .filter((site) => site.planCode && !knownPlanCodes.has(site.planCode))
    .forEach((site) => {
      rows.push({
        client,
        project: {
          id: site.planId || -rows.length - 1,
          client_org_id: client.id,
          name: site.planName || site.name,
          code: site.planCode || `J${String(rows.length + 1).padStart(3, "0")}`,
          domain: null,
          status: "active",
          created_at: site.createdAt,
          updated_at: site.updatedAt,
        },
        site,
        agency: snapshot.currentAgency,
      });
    });

  return rows.sort((a, b) => {
    const siteDiff = parseTime(b.site?.updatedAt || b.site?.createdAt) - parseTime(a.site?.updatedAt || a.site?.createdAt);
    if (siteDiff !== 0) return siteDiff;
    return parseTime(b.project.updated_at) - parseTime(a.project.updated_at) || parseTime(b.project.created_at) - parseTime(a.project.created_at) || b.project.id - a.project.id;
  });
}

export function deriveClientDashboardStats(snapshot: ClientLiveSnapshot) {
  const projects = collectClientProjects(snapshot);
  const sites = sortSitesByCreatedOrder(snapshot.sites.filter((site) => !snapshot.currentClient || !site.clientCode || site.clientCode === snapshot.currentClient.code));
  return [
    { label: "已创建计划", value: projects.length, change: `${projects.length ? "+" : ""}${projects.length}`, trend: "up", color: "blue" },
    { label: "已发布网站", value: sites.length, change: `${sites.length ? "+" : ""}${sites.length}`, trend: "up", color: "emerald" },
    { label: "最新版本", value: sites[0]?.planCode || "J000", change: sites[0] ? "最新" : "待创建", trend: "up", color: "sky" },
    { label: "当前归属", value: snapshot.currentAgency ? sanitizeDisplayText(snapshot.currentAgency.name, snapshot.currentAgency.code) : "-", change: snapshot.currentAgency?.code || "-", trend: "up", color: "amber" },
  ];
}

export function deriveClientTrafficSeries(snapshot: ClientLiveSnapshot) {
  const projects = collectClientProjects(snapshot);
  const rows = [
    ...projects.map((row) => ({ createdAt: row.project.created_at, updatedAt: row.project.updated_at })),
    ...snapshot.sites.map((site) => ({ createdAt: site.createdAt, updatedAt: site.updatedAt })),
  ];
  return groupMonths(rows, 7);
}

export function deriveClientTrafficSources(snapshot: ClientLiveSnapshot) {
  const projects = collectClientProjects(snapshot);
  const topClient = snapshot.currentClient;
  const published = snapshot.sites.length;
  const projectCount = projects.length || (topClient?.projects.length || 0);
  const siteCount = Math.max(1, published);

  return [
    { name: "自然访问", value: 48 + projectCount * 6, color: "#2563eb" },
    { name: "直接访问", value: 26 + siteCount * 4, color: "#0ea5e9" },
    { name: "询盘转化", value: 14 + projectCount * 3, color: "#10b981" },
    { name: "社媒引流", value: 8 + siteCount * 2, color: "#f59e0b" },
    { name: "其他", value: 4 + Math.max(1, projectCount - siteCount), color: "#64748b" },
  ];
}

export function deriveClientRecentInquiries(snapshot: ClientLiveSnapshot) {
  return collectClientProjects(snapshot).slice(0, 6).map((row, index) => ({
    id: `INQ-${row.project.code}`,
    name: sanitizeDisplayText(row.site?.planName || row.project.name, row.project.code),
    company: sanitizeDisplayText(row.client.name, row.client.code),
    country: row.site?.agencyName ? sanitizeDisplayText(row.site.agencyName, row.site.agencyCode || "-") : "未配置",
    product: row.project.domain || row.site?.urlPath || row.project.code,
    time: formatRelativeTime(row.site?.updatedAt || row.project.updated_at || row.project.created_at),
    status: index % 3 === 0 ? "new" : index % 3 === 1 ? "replied" : "pending",
  }));
}

export function deriveClientKeywords(snapshot: ClientLiveSnapshot) {
  return collectClientProjects(snapshot).slice(0, 8).map((row, index) => {
    const keyword = sanitizeDisplayText(row.site?.planName || row.project.name, row.project.code)
      .toLowerCase()
      .replace(/\s+/g, " ");

    return {
      kw: keyword || row.project.code.toLowerCase(),
      volume: 1200 + index * 480 + row.client.projects.length * 120,
      difficulty: 24 + (index * 11) % 58,
      rank: index + 1,
      change: index % 2 === 0 ? 1 + (row.client.projects.length % 3) : -1,
      cpc: `$${(0.8 + index * 0.25).toFixed(2)}`,
    };
  });
}

export function deriveClientCustomers(snapshot: ClientLiveSnapshot) {
  return collectClientProjects(snapshot).map((row, index) => {
    const site = row.site;
    return {
      id: row.client.id,
      name: sanitizeDisplayText(row.client.name, row.client.code),
      company: sanitizeDisplayText(row.client.name, row.client.code),
      country: site?.agencyName ? sanitizeDisplayText(site.agencyName, site.agencyCode || "-") : "未配置",
      email: `${row.client.code.toLowerCase()}@client.local`,
      tags: [row.project.code, site?.planCode || "J000"].filter(Boolean).slice(0, 2),
      inquiries: Math.max(1, row.client.projects.length * 2 + index),
      lastContact: site?.updatedAt || row.project.updated_at || row.project.created_at || "",
    };
  });
}
