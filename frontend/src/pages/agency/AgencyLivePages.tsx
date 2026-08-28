import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Download, Edit3, MoreHorizontal, Search } from "lucide-react";

import { platformApi, type PlatformNode } from "@/lib/platform-api";
import { fetchAllSitesFromBackend, type PublishedSite } from "@/lib/sites";
import { resolveCurrentAgencyContext } from "@/lib/platform-live";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";
import { FactoryPage } from "@/page-factory/FactoryPage";

function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {sub ? <p className="mt-1 text-sm text-slate-500">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

function StatsRow({ items }: { items: Array<{ label: string; value: string | number }> }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500">{item.label}</div>
            <div className="text-2xl font-bold text-slate-900">{item.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DataTable({ columns, rows, search }: { columns: string[]; rows: ReactNode[][]; search?: string }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-0">
        {search ? (
          <div className="flex items-center gap-2 border-b border-slate-200 p-4">
            <Search className="h-4 w-4 text-slate-400" />
            <Input placeholder={search} className="h-8 flex-1 border-0 shadow-none focus-visible:ring-0" />
            <Button variant="outline" size="sm">
              筛选
            </Button>
          </div>
        ) : null}
        <div className="responsive-table-wrap">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="whitespace-nowrap px-4 py-3 text-left font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-slate-100 hover:bg-slate-50">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-4 py-3 align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "正常", cls: "bg-emerald-100 text-emerald-700" },
    pending: { label: "待处理", cls: "bg-amber-100 text-amber-700" },
    paused: { label: "已暂停", cls: "bg-slate-100 text-slate-700" },
    disabled: { label: "已禁用", cls: "bg-slate-100 text-slate-700" },
    trial: { label: "试用中", cls: "bg-blue-100 text-blue-700" },
  };
  const info = map[status] || { label: sanitizeDisplayText(status, "未知"), cls: "bg-slate-100 text-slate-700" };
  return <Badge className={`${info.cls} hover:${info.cls}`}>{info.label}</Badge>;
}

function TableActions() {
  return (
    <div className="flex gap-1">
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
        <Edit3 className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
        <MoreHorizontal className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function formatDateLabel(value?: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
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

function getNodeTime(node: Pick<PlatformNode, "updated_at" | "created_at" | "id">) {
  const raw = node.updated_at || node.created_at;
  const value = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(value) ? value : node.id;
}

function collectClientNodes(node: PlatformNode): PlatformNode[] {
  const items: PlatformNode[] = [];
  const visit = (current: PlatformNode) => {
    if (current.org_type === "client") {
      items.push(current);
    }
    current.children.forEach(visit);
  };
  visit(node);
  return items;
}

function collectProjects(node: PlatformNode) {
  const items: Array<PlatformNode["projects"][number] & { client: PlatformNode }> = [];
  const visit = (current: PlatformNode) => {
    if (current.org_type === "client") {
      current.projects.forEach((project) => {
        items.push({ ...project, client: current });
      });
    }
    current.children.forEach(visit);
  };
  visit(node);
  return items;
}

function useCurrentAgencyTree() {
  const [tree, setTree] = useState<PlatformNode[]>([]);
  const [sites, setSites] = useState<PublishedSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const [response, siteResponse] = await Promise.all([platformApi.tree(), fetchAllSitesFromBackend()]);
        if (!mounted) return;
        setTree(response.items || []);
        setSites(siteResponse.filter((site) => (site.scope || "client") === "client"));
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "加载代理数据失败");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const currentAgency = useMemo(
    () =>
      resolveCurrentAgencyContext(tree, {
        url: typeof window !== "undefined" ? window.location.href : "",
        fallbackSites: sites,
      }).agency,
    [sites, tree]
  );
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);

  return { loading, error, currentAgency, parentMap };
}

export function AgencyEnterprisesLive() {
  const { loading, error, currentAgency, parentMap } = useCurrentAgencyTree();
  const enterprises = useMemo(
    () => (currentAgency ? collectClientNodes(currentAgency).sort((a, b) => getNodeTime(b) - getNodeTime(a)) : []),
    [currentAgency]
  );

  const stats = useMemo(
    () => [
      { label: "当前代理", value: currentAgency?.code || "-" },
      { label: "企业客户数", value: enterprises.length },
      { label: "计划总数", value: enterprises.reduce((sum, enterprise) => sum + enterprise.projects.length, 0) },
      { label: "最新客户", value: enterprises[0]?.code || "-" },
    ],
    [currentAgency, enterprises]
  );

  return (
    <FactoryPage pageId="agency-live-pages" template="dashboard" sourceScope="agency_source" autoRegions>
    <div className="space-y-6">
      <PageHeader
        title="企业客户"
        sub={
          currentAgency
            ? `当前查看 ${sanitizeDisplayText(currentAgency.name, currentAgency.code)} 名下的真实客户与计划数据`
            : "当前还没有可用的代理组织数据"
        }
        action={
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            导出
          </Button>
        }
      />
      <StatsRow items={stats} />
      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">企业客户数据加载失败：{error}</CardContent>
        </Card>
      ) : null}
      {loading ? (
        <Card className="border-slate-200">
          <CardContent className="p-5 text-sm text-slate-500">正在加载代理企业客户列表...</CardContent>
        </Card>
      ) : !currentAgency ? (
        <Card className="border-slate-200">
          <CardContent className="p-5 text-sm text-slate-500">当前未找到可绑定的代理组织。</CardContent>
        </Card>
      ) : (
        <DataTable
          search="搜索企业名称、客户编号或计划编号"
          columns={["企业客户", "上级代理", "计划数量", "最新计划", "客户编号", "创建时间", "状态", "操作"]}
          rows={enterprises.map((enterprise) => {
            const parent = enterprise.parent_id ? parentMap.get(enterprise.parent_id) : null;
            const latestProject = [...enterprise.projects].sort((a, b) => getNodeTime(b) - getNodeTime(a))[0];
            return [
              <div>
                <div className="font-medium text-slate-900">{sanitizeDisplayText(enterprise.name, enterprise.code)}</div>
                <div className="font-mono text-[11px] text-slate-500">{enterprise.code}</div>
              </div>,
              <div className="text-xs text-cyan-700">{parent ? sanitizeDisplayText(parent.name, parent.code) : "-"}</div>,
              <span className="block text-center font-semibold">{enterprise.projects.length}</span>,
              latestProject ? (
                <div>
                  <div className="font-medium text-slate-900">
                    {sanitizeDisplayText(latestProject.name, latestProject.code)}
                  </div>
                  <div className="font-mono text-[11px] text-slate-500">{latestProject.code}</div>
                </div>
              ) : (
                <span className="text-xs text-slate-400">暂无计划</span>
              ),
              <span className="font-mono text-xs text-slate-600">{enterprise.code}</span>,
              <span className="text-xs text-slate-500">{formatDateLabel(enterprise.created_at)}</span>,
              <StatusBadge status={enterprise.status} />,
              <TableActions />,
            ];
          })}
        />
      )}
    </div>
    </FactoryPage>
  );
}

export function AgencyPlansLive() {
  const { loading, error, currentAgency, parentMap } = useCurrentAgencyTree();
  const plans = useMemo(
    () => (currentAgency ? collectProjects(currentAgency).sort((a, b) => getNodeTime(b) - getNodeTime(a)) : []),
    [currentAgency]
  );

  const stats = useMemo(
    () => [
      { label: "当前代理", value: currentAgency?.code || "-" },
      { label: "计划总数", value: plans.length },
      { label: "运行中计划", value: plans.filter((plan) => plan.status === "active").length },
      { label: "最新计划", value: plans[0]?.code || "-" },
    ],
    [currentAgency, plans]
  );

  return (
    <FactoryPage pageId="agency-plans-live" template="dashboard" sourceScope="agency_source" autoRegions>
    <div className="space-y-6">
      <PageHeader
        title="客户计划"
        sub={
          currentAgency
            ? `当前查看 ${sanitizeDisplayText(currentAgency.name, currentAgency.code)} 名下的全部真实计划`
            : "当前还没有可用的代理组织数据"
        }
        action={
          <Button className="bg-violet-600 hover:bg-violet-700">
            <Download className="mr-2 h-4 w-4" />
            导出
          </Button>
        }
      />
      <StatsRow items={stats} />
      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">计划数据加载失败：{error}</CardContent>
        </Card>
      ) : null}
      {loading ? (
        <Card className="border-slate-200">
          <CardContent className="p-5 text-sm text-slate-500">正在加载代理计划列表...</CardContent>
        </Card>
      ) : !currentAgency ? (
        <Card className="border-slate-200">
          <CardContent className="p-5 text-sm text-slate-500">当前未找到可绑定的代理组织。</CardContent>
        </Card>
      ) : (
        <DataTable
          search="搜索计划名称、计划编号或客户编号"
          columns={["计划", "客户企业", "所属代理", "访问域名", "创建时间", "状态", "操作"]}
          rows={plans.map((plan) => {
            const directAgency = plan.client.parent_id ? parentMap.get(plan.client.parent_id) : null;
            return [
              <div>
                <div className="font-medium text-slate-900">{sanitizeDisplayText(plan.name, plan.code)}</div>
                <div className="font-mono text-[11px] text-slate-500">{plan.code}</div>
              </div>,
              <div>
                <div className="font-medium text-slate-900">{sanitizeDisplayText(plan.client.name, plan.client.code)}</div>
                <div className="font-mono text-[11px] text-slate-500">{plan.client.code}</div>
              </div>,
              <div className="text-xs text-cyan-700">
                {directAgency ? sanitizeDisplayText(directAgency.name, directAgency.code) : currentAgency.code}
              </div>,
              <span className="text-xs text-slate-600">{plan.domain || "-"}</span>,
              <span className="text-xs text-slate-500">{formatDateLabel(plan.created_at)}</span>,
              <StatusBadge status={plan.status} />,
              <TableActions />,
            ];
          })}
        />
      )}
    </div>
    </FactoryPage>
  );
}
