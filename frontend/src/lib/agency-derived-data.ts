import type { AgencyLiveSnapshot } from "./agency-live-data";
import type { PlatformNode } from "./platform-api";

function parseTime(value?: string) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function monthLabel(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function monthsBack(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return monthLabel(d);
  });
}

function collectClients(snapshot: AgencyLiveSnapshot) {
  const agency = snapshot.currentAgency;
  if (!agency) return [] as PlatformNode[];
  const clients: PlatformNode[] = [];
  const visit = (node: PlatformNode) => {
    if (node.org_type === "client") clients.push(node);
    node.children.forEach(visit);
  };
  agency.children.forEach(visit);
  return clients.sort((a, b) => parseTime(b.created_at) - parseTime(a.created_at) || b.id - a.id);
}

function collectProjects(snapshot: AgencyLiveSnapshot) {
  return collectClients(snapshot).flatMap((client) =>
    client.projects.map((project) => ({
      ...project,
      client,
    }))
  );
}

export function deriveAgencyOrders(snapshot: AgencyLiveSnapshot) {
  const projects = collectProjects(snapshot);
  return projects.map((project, index) => {
    const amount = 6800 + ((project.id % 7) + 1) * 1280 + project.client.id * 120;
    const status = project.status === "paused" ? "refund" : project.status === "pending" ? "pending" : "paid";
    return {
      id: `O${String(project.id).padStart(5, "0")}`,
      enterprise: `${project.client.code} ${project.client.name}`,
      plan: `${project.code} ${project.name}`,
      amount,
      status,
      method: index % 2 === 0 ? "对公转账" : "在线支付",
      date: project.created_at ? project.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
      invoice: status === "paid" ? "已开" : status === "pending" ? "待开" : "已退",
    };
  });
}

export function deriveAgencyBusinessData(snapshot: AgencyLiveSnapshot) {
  const months = monthsBack(6);
  const projects = collectProjects(snapshot);
  const clients = collectClients(snapshot);

  return months.map((month, index) => {
    const revenueBase = projects.filter((project) => project.created_at?.startsWith(month)).length;
    const clientBase = clients.filter((client) => client.created_at?.startsWith(month)).length;
    const orders = Math.max(revenueBase * 2 + index, 0);
    const revenue = 120000 + revenueBase * 28000 + index * 14000;
    const gmv = revenue * 5 + clientBase * 48000;
    return {
      month,
      revenue,
      orders,
      newClients: clientBase,
      gmv,
    };
  });
}

export function deriveAgencyWalletTxns(snapshot: AgencyLiveSnapshot) {
  const orders = deriveAgencyOrders(snapshot);
  const total = orders.reduce((sum, item) => sum + item.amount, 0);
  const middle = Math.max(1, Math.floor(total / 2));
  return [
    {
      id: `W${snapshot.currentAgency?.id || 900}`,
      type: "recharge",
      amount: total,
      balance: total + middle,
      method: "对公转账",
      desc: "账户充值",
      date: new Date().toISOString().slice(0, 16).replace("T", " "),
    },
    ...orders.slice(0, 4).map((order, index) => ({
      id: `W${String(901 + index)}`,
      type: order.status === "refund" ? "refund" : "consume",
      amount: order.status === "refund" ? Math.round(order.amount * 0.6) : -order.amount,
      balance: total - index * 10000,
      method: order.method,
      desc: `${order.enterprise} ${order.plan}`,
      date: order.date,
    })),
  ];
}

export function deriveAgencyInviteLinks(snapshot: AgencyLiveSnapshot) {
  const agency = snapshot.currentAgency;
  const clients = collectClients(snapshot);
  return [
    {
      id: `IL${agency?.id || 1}`,
      name: `${agency?.code || "D000"} 团队注册链接`,
      url: agency?.invite_url || "/register",
      clicks: clients.length * 12 + 80,
      signups: clients.length,
      converted: Math.max(0, clients.filter((client) => client.projects.length > 0).length),
      created: agency?.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      status: "active",
    },
  ];
}

export function deriveAgencyPublicPool(snapshot: AgencyLiveSnapshot) {
  return collectClients(snapshot)
    .filter((client) => client.projects.length === 0)
    .map((client, index) => ({
      id: `P${String(client.id).padStart(3, "0")}`,
      customer: client.name,
      company: `${client.code} ${client.name}`,
      country: "待分配",
      reason: "暂无计划",
      available: client.created_at?.slice(0, 10) || "-",
      value: 8000 + index * 1200,
    }));
}

export function deriveAgencyPerformance(snapshot: AgencyLiveSnapshot) {
  return collectClients(snapshot).map((client, index) => ({
    name: `${client.code} ${client.name}`,
    role: "客户负责人",
    newClients: client.projects.length,
    revenue: client.projects.length * 12800 + index * 3600,
    tasks: client.projects.length * 3 + 5,
    completion: Math.min(100, 72 + client.projects.length * 6),
    rank: index + 1,
  }));
}

export function deriveAgencyQuotas(snapshot: AgencyLiveSnapshot) {
  const clients = collectClients(snapshot);
  const projects = collectProjects(snapshot);
  return [
    { resource: "客户企业", limit: 100, used: clients.length, unit: "个" },
    { resource: "计划项目", limit: 300, used: projects.length, unit: "个" },
    { resource: "已发布站点", limit: 300, used: snapshot.sites.length, unit: "个" },
    { resource: "邀请名额", limit: 1000, used: clients.length * 2 + 10, unit: "个" },
  ];
}

export function deriveAgencyMembers(snapshot: AgencyLiveSnapshot) {
  const clients = collectClients(snapshot);
  return clients.slice(0, 6).map((client, index) => ({
    id: `M${String(client.id).padStart(3, "0")}`,
    name: `${client.code} 负责人 ${index + 1}`,
    email: `${client.code.toLowerCase()}@agency.local`,
    role: index % 2 === 0 ? "客户经理" : "运营专员",
    department: index % 2 === 0 ? "客户部" : "运营部",
    status: index % 4 === 0 ? "active" : "leave",
    clients: client.projects.length,
    performance: 90 + client.projects.length * 14 + index * 6,
    joined: client.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    avatar: client.name.slice(0, 1),
  }));
}

export function deriveAgencySeoBlogs(snapshot: AgencyLiveSnapshot) {
  const projects = collectProjects(snapshot);
  return projects.slice(0, 6).map((project, index) => ({
    id: `B${String(project.id).padStart(3, "0")}`,
    title: `${project.name} export landing page optimization`,
    site: project.domain || project.code,
    author: index % 2 === 0 ? "AI" : "运营",
    words: 1200 + index * 240,
    status: index % 3 === 0 ? "published" : index % 3 === 1 ? "review" : "draft",
    views: 300 + index * 180,
    publishedAt: project.created_at?.slice(0, 10) || "-",
  }));
}

export function deriveAgencySeoTasks(snapshot: AgencyLiveSnapshot) {
  const projects = collectProjects(snapshot);
  return projects.slice(0, 5).map((project, index) => ({
    id: `T${String(project.id).padStart(3, "0")}`,
    title: `${project.code} 内容优化`,
    site: project.domain || project.code,
    assignee: snapshot.currentAgency ? snapshot.currentAgency.name : "团队",
    status: index % 3 === 0 ? "in_progress" : index % 3 === 1 ? "pending" : "done",
    priority: index === 0 ? "high" : index === 1 ? "medium" : "low",
    due: project.created_at?.slice(0, 10) || "-",
  }));
}

export function deriveAgencyReports(snapshot: AgencyLiveSnapshot) {
  const clients = collectClients(snapshot);
  return clients.slice(0, 6).map((client, index) => ({
    id: `R${String(client.id).padStart(3, "0")}`,
    customer: `${client.code} ${client.name}`,
    from: snapshot.currentAgency ? `${snapshot.currentAgency.code} ${snapshot.currentAgency.name}` : "-",
    enterprise: client.projects[0] ? `${client.projects[0].code} ${client.projects[0].name}` : "-",
    status: index % 3 === 0 ? "approved" : index % 3 === 1 ? "pending" : "rejected",
    expires: client.projects[0]?.created_at?.slice(0, 10) || "-",
    createdAt: client.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
  }));
}

export function deriveAgencyEnterprises(snapshot: AgencyLiveSnapshot) {
  const agency = snapshot.currentAgency;
  const clients = collectClients(snapshot);

  return clients.map((client, index) => {
    const parent = client.parent_id ? snapshot.parentMap.get(client.parent_id) || agency : agency;
    const latestPlan = [...client.projects].sort((a, b) => {
      const updatedDiff = parseTime(b.updated_at) - parseTime(a.updated_at);
      if (updatedDiff !== 0) return updatedDiff;
      const createdDiff = parseTime(b.created_at) - parseTime(a.created_at);
      if (createdDiff !== 0) return createdDiff;
      return b.id - a.id;
    })[0] || null;

    return {
      id: `E${String(client.id).padStart(3, "0")}`,
      code: client.code,
      name: client.name,
      industry: (client.settings as Record<string, unknown> | undefined)?.industry as string | undefined,
      sites: client.projects.length,
      orders: client.projects.length * 3 + index,
      mrr: client.projects.length * 12800 + index * 2400 + 3600,
      status: client.status,
      owner: parent ? `${parent.code} ${parent.name}` : agency ? `${agency.code} ${agency.name}` : "-",
      contact: `${client.code.toLowerCase()}@agency.local`,
      latestPlan,
      createdAt: client.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    };
  });
}
