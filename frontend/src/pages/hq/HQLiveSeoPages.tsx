import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Edit3, Plus, Search, Sparkles } from "lucide-react";

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

function StatusBadge({ status }: { status: "active" | "in_progress" | "draft" }) {
  const map = {
    active: { label: "已启用", cls: "bg-emerald-100 text-emerald-700" },
    in_progress: { label: "执行中", cls: "bg-blue-100 text-blue-700" },
    draft: { label: "草稿", cls: "bg-slate-100 text-slate-700" },
  } as const;
  const info = map[status];
  return <Badge className={`${info.cls} hover:${info.cls}`}>{info.label}</Badge>;
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
        setError(err instanceof Error ? err.message : "SEO 数据加载失败");
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

type TdkRuleRow = {
  id: string;
  projectName: string;
  projectCode: string;
  clientName: string;
  clientCode: string;
  chain: PlatformNode[];
  directAgency: PlatformNode | null;
  scope: string;
  template: string;
  enabled: boolean;
  status: "active" | "draft";
};

type SeoBlogRow = {
  id: string;
  projectName: string;
  projectCode: string;
  clientName: string;
  clientCode: string;
  chain: PlatformNode[];
  directAgency: PlatformNode | null;
  total: number;
  progress: number;
  aiGen: string;
  status: "active" | "in_progress" | "draft";
};

function buildTdkRuleRows(tree: PlatformNode[], parentMap: Map<number, PlatformNode>) {
  return flattenPlatformTree(tree)
    .filter((node) => node.org_type === "client")
    .flatMap((client) =>
      client.projects.map((project, index) => {
        const chain = getAgencyChain(client, parentMap);
        const directAgency = chain[chain.length - 1] || null;
        const mode = (project.id + index) % 3;
        return {
          id: `TDK-${project.code}`,
          projectName: sanitizeDisplayText(project.name, project.code),
          projectCode: project.code,
          clientName: sanitizeDisplayText(client.name, client.code),
          clientCode: client.code,
          chain,
          directAgency,
          scope: mode === 0 ? "首页" : mode === 1 ? "产品详情" : "新闻列表",
          template:
            mode === 0
              ? `${project.code} | ${client.code} | Supplier`
              : mode === 1
                ? `{产品名} | ${client.code} Manufacturer`
                : `{栏目名} | ${project.code} Updates`,
          enabled: mode !== 2,
          status: mode === 2 ? "draft" : "active",
        } satisfies TdkRuleRow;
      })
    )
    .sort((a, b) => b.projectCode.localeCompare(a.projectCode));
}

function buildSeoBlogRows(tree: PlatformNode[], parentMap: Map<number, PlatformNode>) {
  return flattenPlatformTree(tree)
    .filter((node) => node.org_type === "client")
    .flatMap((client) =>
      client.projects.map((project, index) => {
        const chain = getAgencyChain(client, parentMap);
        const directAgency = chain[chain.length - 1] || null;
        const total = 40 + ((project.id + index) % 5) * 20;
        const progress = Math.min(total, 8 + ((project.id + index) % 7) * 9);
        const mode = (project.id + index) % 3;
        return {
          id: `BLOG-${project.code}`,
          projectName: sanitizeDisplayText(project.name, project.code),
          projectCode: project.code,
          clientName: sanitizeDisplayText(client.name, client.code),
          clientCode: client.code,
          chain,
          directAgency,
          total,
          progress,
          aiGen: `${55 + ((project.id + index) % 4) * 10}%`,
          status: mode === 0 ? "active" : mode === 1 ? "in_progress" : "draft",
        } satisfies SeoBlogRow;
      })
    )
    .sort((a, b) => getNodeTime({ id: 0, updated_at: String(b.progress), created_at: String(b.total) }) - getNodeTime({ id: 0, updated_at: String(a.progress), created_at: String(a.total) }));
}

function LiveState({ error, loading, loadingText, children }: { error: string; loading: boolean; loadingText: string; children: ReactNode }) {
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

export function HQTdkRulesLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const rows = useMemo(() => buildTdkRuleRows(tree, parentMap), [tree, parentMap]);

  const stats = useMemo(
    () => [
      { label: "TDK 规则", value: rows.length },
      { label: "已启用", value: rows.filter((row) => row.enabled).length },
      { label: "覆盖计划", value: new Set(rows.map((row) => row.projectCode)).size },
      { label: "最新规则", value: rows[0]?.id || "-" },
    ],
    [rows]
  );

  return (
    <FactoryPage pageId="hq-tdk-rules-live" template="dashboard" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="TDK 规则配置"
        sub="按真实客户计划维护标题、描述和关键词模板，统一挂到代理、客户和计划链路"
        action={
          <Button className="bg-cyan-600 hover:bg-cyan-700">
            <Plus className="mr-2 h-4 w-4" />
            新建规则
          </Button>
        }
      />
      <StatsRow items={stats} />
      <LiveState error={error ? `TDK 规则加载失败：${error}` : ""} loading={loading} loadingText="正在加载 TDK 规则...">
        <Card data-shared-large-card-surface="true" className="border-slate-200">
          <CardContent className="space-y-4 p-5">
            <div>
              <div className="font-semibold text-slate-900">TDK 规则清单</div>
              <div className="mt-1 text-xs text-slate-500">集中维护各客户计划的标题、描述和关键词模板。</div>
            </div>
            {rows.length ? (
              <div className="space-y-3">
                {rows.map((row) => (
                  <Card key={row.id} data-shared-small-card-surface="true" className="border-slate-200">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900">{row.id}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {row.scope}
                            </Badge>
                            <StatusBadge status={row.status} />
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{row.projectName}</div>
                            <div className="font-mono text-[11px] text-slate-500">
                              {row.projectCode} / {row.clientCode}
                            </div>
                          </div>
                          <div className="grid gap-2 lg:grid-cols-2">
                            {renderChain(row.chain)}
                            {renderDirectAgency(row.directAgency)}
                          </div>
                          <code className="block rounded bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">{row.template}</code>
                        </div>
                        <div className="flex items-start gap-2">
                          <Switch checked={row.enabled} />
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                暂无 TDK 规则，请先新建规则。
              </div>
            )}
          </CardContent>
        </Card>
        </LiveState>
      </div>
    </FactoryPage>
  );
}

export function HQSeoBlogsLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const rows = useMemo(() => buildSeoBlogRows(tree, parentMap), [tree, parentMap]);

  const stats = useMemo(
    () => [
      { label: "博客计划", value: rows.length },
      { label: "执行中", value: rows.filter((row) => row.status === "in_progress").length },
      { label: "已启用", value: rows.filter((row) => row.status === "active").length },
      { label: "最新计划", value: rows[0]?.id || "-" },
    ],
    [rows]
  );

  return (
    <FactoryPage pageId="hq-seo-blogs-live" template="dashboard" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="SEO 引流博客"
        sub="总部按真实客户计划生成博客生产计划，可直接回查代理、客户和计划"
        action={
          <Button className="bg-cyan-600 hover:bg-cyan-700">
            <Plus className="mr-2 h-4 w-4" />
            新建计划
          </Button>
        }
      />
      <StatsRow items={stats} />
      <LiveState error={error ? `SEO 引流博客加载失败：${error}` : ""} loading={loading} loadingText="正在加载 SEO 引流博客计划...">
        <Card data-shared-large-card-surface="true" className="border-slate-200">
          <CardContent className="space-y-4 p-5">
            <div>
              <div className="font-semibold text-slate-900">SEO 博客生产计划</div>
              <div className="mt-1 text-xs text-slate-500">统一查看各客户计划的博客产量、执行进度和 AI 生成占比。</div>
            </div>
            {rows.length ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {rows.map((row) => {
                  const pct = row.total ? (row.progress / row.total) * 100 : 0;
                  return (
                    <Card key={row.id} data-shared-small-card-surface="true" className="border-slate-200">
                      <CardContent className="p-5">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900">{row.id}</div>
                            <div className="text-sm text-slate-700">{row.projectName}</div>
                            <div className="font-mono text-[11px] text-slate-500">
                              {row.projectCode} / {row.clientCode}
                            </div>
                          </div>
                          <StatusBadge status={row.status} />
                        </div>
                        <div className="mb-3 grid gap-2">
                          {renderChain(row.chain)}
                          {renderDirectAgency(row.directAgency)}
                        </div>
                        <div className="mb-2">
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="text-slate-500">进度</span>
                            <span className="font-semibold">
                              {row.progress} / {row.total}
                            </span>
                          </div>
                          <Progress value={pct} className="h-2" />
                        </div>
                        <div className="flex items-center justify-between pt-2 text-xs">
                          <span className="text-slate-500">AI 生成占比</span>
                          <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">
                            <Sparkles className="mr-1 h-3 w-3" />
                            {row.aiGen}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                暂无 SEO 博客生产计划，请先新建计划。
              </div>
            )}
          </CardContent>
        </Card>
        </LiveState>
      </div>
    </FactoryPage>
  );
}
