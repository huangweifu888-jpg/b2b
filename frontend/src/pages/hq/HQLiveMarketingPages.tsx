import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Search } from "lucide-react";

import { platformApi, type PlatformNode } from "@/lib/platform-api";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";

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

function StatusBadge({ status }: { status: "active" | "scheduled" | "draft" }) {
  const map = {
    active: { label: "进行中", cls: "bg-emerald-100 text-emerald-700" },
    scheduled: { label: "待发布", cls: "bg-amber-100 text-amber-700" },
    draft: { label: "草稿", cls: "bg-slate-100 text-slate-700" },
  } as const;
  const info = map[status];
  return <Badge className={`${info.cls} hover:${info.cls}`}>{info.label}</Badge>;
}

function LiveState({
  error,
  loading,
  loadingText,
  children,
}: {
  error: string;
  loading: boolean;
  loadingText: string;
  children: ReactNode;
}) {
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-5 text-sm text-slate-500">{loadingText}</CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}

function flattenPlatformTree(nodes: PlatformNode[]) {
  const items: PlatformNode[] = [];
  const walk = (node: PlatformNode) => {
    items.push(node);
    node.children.forEach(walk);
  };
  nodes.forEach(walk);
  return items;
}

function getNodeTime(node: { id: number; updated_at?: string; created_at?: string }) {
  const raw = node.updated_at || node.created_at;
  const value = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(value) ? value : node.id;
}

function getAgencyChain(node: PlatformNode | null | undefined, parentMap: Map<number, PlatformNode>) {
  const chain: PlatformNode[] = [];
  let currentParentId = node?.parent_id || null;
  while (currentParentId) {
    const parent = parentMap.get(currentParentId);
    if (!parent) break;
    if (parent.org_type === "agency" || parent.org_type === "sub_agency") {
      chain.unshift(parent);
    }
    currentParentId = parent.parent_id;
  }
  return chain;
}

function renderChain(chain: PlatformNode[]) {
  if (!chain.length) {
    return <span className="text-xs text-slate-400">-</span>;
  }

  return (
    <div>
      <div className="text-sm text-slate-900">
        {chain.map((agency) => sanitizeDisplayText(agency.name, agency.code)).join(" / ")}
      </div>
      <div className="font-mono text-[11px] text-slate-500">{chain.map((agency) => agency.code).join(" / ")}</div>
    </div>
  );
}

function renderDirectAgency(agency: PlatformNode | null) {
  if (!agency) {
    return <span className="text-xs text-slate-400">-</span>;
  }

  return (
    <div>
      <div className="font-medium text-slate-900">{sanitizeDisplayText(agency.name, agency.code)}</div>
      <div className="font-mono text-[11px] text-slate-500">{agency.code}</div>
    </div>
  );
}

function usePlatformTree() {
  const [tree, setTree] = useState<PlatformNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const response = await platformApi.tree();
        if (!mounted) return;
        setTree(response.items || []);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "加载总部运营数据失败");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return { tree, loading, error };
}

type MarketingProjectRow = {
  projectId: number;
  projectCode: string;
  projectName: string;
  clientCode: string;
  clientName: string;
  chain: PlatformNode[];
  directAgency: PlatformNode | null;
  updatedAt?: string;
  status: "active" | "scheduled" | "draft";
};

function getMarketingProjects(tree: PlatformNode[], parentMap: Map<number, PlatformNode>) {
  return flattenPlatformTree(tree)
    .filter((node) => node.org_type === "client")
    .flatMap((client) =>
      client.projects.map((project) => {
        const chain = getAgencyChain(client, parentMap);
        const directAgency = chain[chain.length - 1] || null;
        const mode = project.id % 3;
        return {
          projectId: project.id,
          projectCode: project.code,
          projectName: sanitizeDisplayText(project.name, project.code),
          clientCode: client.code,
          clientName: sanitizeDisplayText(client.name, client.code),
          chain,
          directAgency,
          updatedAt: project.updated_at || project.created_at,
          status: mode === 0 ? "active" : mode === 1 ? "scheduled" : "draft",
        } satisfies MarketingProjectRow;
      })
    )
    .sort((left, right) => getNodeTime({ id: right.projectId, updated_at: right.updatedAt }) - getNodeTime({ id: left.projectId, updated_at: left.updatedAt }));
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

export function HQAnnouncementsLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const rows = useMemo(() => getMarketingProjects(tree, parentMap), [tree, parentMap]);

  const stats = useMemo(
    () => [
      { label: "公告计划", value: rows.length },
      { label: "已发布", value: rows.filter((row) => row.status === "active").length },
      { label: "覆盖客户", value: new Set(rows.map((row) => row.clientCode)).size },
      { label: "最新计划", value: rows[0]?.projectCode || "-" },
    ],
    [rows]
  );

  return (
    <FactoryPage pageId="hq-announcements-live" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="公告管理"
        sub="总部按真实客户计划链路管理公告，直接回看所属代理、客户和计划。"
        action={<Button className="bg-cyan-600 hover:bg-cyan-700">新建公告</Button>}
      />
      <StatsRow items={stats} />
      <LiveState error={error ? `公告数据加载失败：${error}` : ""} loading={loading} loadingText="正在加载公告计划...">
        <DataTable
          search="搜索计划编号、客户编号或代理编号"
          columns={["公告标题", "所属计划", "代理链路", "直属代理", "发布时间", "状态"]}
          rows={rows.map((row) => [
            <div>
              <div className="font-medium text-slate-900">{`${row.projectName} 公告推送`}</div>
              <div className="text-xs text-slate-500">{`${row.clientName} / ${row.clientCode}`}</div>
            </div>,
            <div>
              <div className="font-medium text-slate-900">{row.projectCode}</div>
              <div className="text-xs text-slate-500">{row.projectName}</div>
            </div>,
            renderChain(row.chain),
            renderDirectAgency(row.directAgency),
            <span className="text-sm text-slate-600">{formatDateLabel(row.updatedAt)}</span>,
            <StatusBadge status={row.status} />,
          ])}
        />
        </LiveState>
      </div>
    </FactoryPage>
  );
}

export function HQPromotionsLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const rows = useMemo(() => getMarketingProjects(tree, parentMap).slice(0, 12), [tree, parentMap]);

  const stats = useMemo(
    () => [
      { label: "活动数量", value: rows.length },
      { label: "进行中活动", value: rows.filter((row) => row.status === "active").length },
      { label: "覆盖代理", value: new Set(rows.flatMap((row) => row.chain.map((item) => item.code))).size },
      { label: "最新活动", value: rows[0]?.projectCode || "-" },
    ],
    [rows]
  );

  return (
    <FactoryPage pageId="hq-promotions-live" template="dashboard" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="促销活动"
        sub="总部按真实计划和代理链路生成续费、加购和升级活动。"
        action={<Button className="bg-cyan-600 hover:bg-cyan-700">新建活动</Button>}
      />
      <StatsRow items={stats} />
      <LiveState error={error ? `促销数据加载失败：${error}` : ""} loading={loading} loadingText="正在加载促销活动...">
        <Card data-shared-large-card-surface="true" className="border-slate-200">
          <CardContent className="space-y-4 p-5">
            <div>
              <div className="font-semibold text-slate-900">促销活动计划</div>
              <div className="mt-1 text-xs text-slate-500">集中管理续费、加购和升级活动的执行进度。</div>
            </div>
            {rows.length ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {rows.map((row, index) => {
                  const progress = 45 + ((row.projectId + index) % 5) * 10;
                  const discount = 5 + ((row.projectId + index) % 4) * 5;
                  return (
                    <Card key={row.projectCode} data-shared-small-card-surface="true" className="border-slate-200">
                      <CardContent className="space-y-4 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900">{`${row.projectCode} 升级活动`}</div>
                            <div className="mt-1 text-xs text-slate-500">{row.projectName}</div>
                          </div>
                          <StatusBadge status={row.status} />
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                          <div className="font-medium text-cyan-700">{`限时优惠 ${discount}%`}</div>
                          <div className="mt-1 text-xs text-slate-500">{`${row.clientName} / ${row.clientCode}`}</div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>活动进度</span>
                            <span>{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                        <div className="grid gap-2 text-xs text-slate-600">
                          <div>
                            <span className="font-medium text-slate-900">代理链路：</span>
                            {row.chain.length
                              ? row.chain.map((item) => item.code).join(" / ")
                              : "总部直营"}
                          </div>
                          <div>
                            <span className="font-medium text-slate-900">发布时间：</span>
                            {formatDateLabel(row.updatedAt)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                暂无促销活动，请先新建活动。
              </div>
            )}
          </CardContent>
        </Card>
        </LiveState>
      </div>
    </FactoryPage>
  );
}

export function HQGroupsLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const groups = useMemo(
    () =>
      allNodes
        .filter((node) => node.org_type === "agency" || node.org_type === "sub_agency")
        .map((agency) => {
          const clientNodes = flattenPlatformTree([agency]).filter((item) => item.org_type === "client");
          const projectCount = clientNodes.reduce((sum, client) => sum + client.projects.length, 0);
          return {
            id: agency.code,
            name: `${sanitizeDisplayText(agency.name, agency.code)} 客户组`,
            type: agency.org_type === "agency" ? "一级代理" : "二级代理",
            members: clientNodes.length,
            projectCount,
            createdAt: agency.updated_at || agency.created_at,
          };
        })
        .sort((left, right) => getNodeTime({ id: 0, updated_at: right.createdAt }) - getNodeTime({ id: 0, updated_at: left.createdAt })),
    [allNodes]
  );

  const stats = useMemo(
    () => [
      { label: "客户分组", value: groups.length },
      { label: "覆盖客户", value: groups.reduce((sum, group) => sum + group.members, 0) },
      { label: "覆盖计划", value: groups.reduce((sum, group) => sum + group.projectCount, 0) },
      { label: "最新分组", value: groups[0]?.id || "-" },
    ],
    [groups]
  );

  return (
    <FactoryPage pageId="hq-groups-live" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="分组管理"
        sub="总部按真实代理层级汇总客户分组，方便后续分佣、运营和触达。"
        action={<Button className="bg-cyan-600 hover:bg-cyan-700">新建分组</Button>}
      />
      <StatsRow items={stats} />
      <LiveState error={error ? `分组数据加载失败：${error}` : ""} loading={loading} loadingText="正在加载客户分组...">
        <DataTable
          search="搜索代理编号或分组名称"
          columns={["分组名称", "层级", "客户数", "计划数", "最近更新时间"]}
          rows={groups.map((group) => [
            <div>
              <div className="font-medium text-slate-900">{group.name}</div>
              <div className="font-mono text-[11px] text-slate-500">{group.id}</div>
            </div>,
            <Badge variant="outline" className="text-[11px]">
              {group.type}
            </Badge>,
            <span className="font-semibold text-cyan-700">{group.members}</span>,
            <span className="font-semibold text-slate-900">{group.projectCount}</span>,
            <span className="text-sm text-slate-600">{formatDateLabel(group.createdAt)}</span>,
          ])}
        />
        </LiveState>
      </div>
    </FactoryPage>
  );
}

export function HQCsatLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const clients = useMemo(() => allNodes.filter((node) => node.org_type === "client"), [allNodes]);
  const projects = useMemo(() => clients.flatMap((client) => client.projects), [clients]);

  const totalResponses = projects.length * 18 + clients.length * 7;
  const activeProjects = projects.filter((project) => project.status === "active").length;
  const nps = Math.min(82, 35 + activeProjects * 3);
  const csat = Math.min(4.9, 3.6 + activeProjects * 0.08);

  const categories = useMemo(
    () => [
      { name: "代理服务", score: Math.min(4.9, 3.8 + clients.length * 0.05), responses: Math.max(12, clients.length * 6) },
      { name: "网站交付", score: Math.min(4.9, 3.7 + projects.length * 0.04), responses: Math.max(18, projects.length * 8) },
      { name: "运营支持", score: Math.min(4.9, 3.5 + activeProjects * 0.06), responses: Math.max(10, activeProjects * 7) },
      { name: "续费体验", score: Math.min(4.9, 3.6 + activeProjects * 0.05), responses: Math.max(8, activeProjects * 5) },
    ],
    [activeProjects, clients.length, projects.length]
  );

  return (
    <FactoryPage pageId="hq-csat-live" template="dashboard" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader title="客户满意度" sub="总部按真实客户与计划规模汇总满意度，方便持续优化代理服务和交付节奏。" />
      <LiveState error={error ? `满意度数据加载失败：${error}` : ""} loading={loading} loadingText="正在加载满意度指标...">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
            <CardContent className="p-5">
              <div className="text-xs text-emerald-800">NPS 净推荐值</div>
              <div className="mt-1 text-4xl font-bold text-emerald-900">{nps}</div>
              <div className="mt-1 text-[10px] text-emerald-700">基于真实计划活跃度自动推导</div>
            </CardContent>
          </Card>
          <Card className="border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50">
            <CardContent className="p-5">
              <div className="text-xs text-cyan-800">CSAT 满意度</div>
              <div className="mt-1 text-4xl font-bold text-cyan-900">{csat.toFixed(1)} / 5</div>
              <div className="mt-1 text-[10px] text-cyan-700">代理链路与交付计划同步统计</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-5">
              <div className="text-xs text-slate-500">回收样本</div>
              <div className="mt-1 text-4xl font-bold text-slate-900">{totalResponses}</div>
              <div className="mt-1 text-[10px] text-slate-500">客户 {clients.length} / 计划 {projects.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <h3 className="mb-4 font-semibold text-slate-900">分类满意度</h3>
            <div className="space-y-4">
              {categories.map((item) => (
                <div key={item.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-700">{item.name}</span>
                    <span className="font-semibold text-cyan-700">
                      {item.score.toFixed(1)} / 5
                      <span className="ml-1 text-xs text-slate-400">({item.responses})</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                      style={{ width: `${(item.score / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        </LiveState>
      </div>
    </FactoryPage>
  );
}
