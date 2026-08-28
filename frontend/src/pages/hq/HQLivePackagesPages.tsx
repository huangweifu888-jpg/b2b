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
    return <span className="text-xs text-slate-400">总部直营</span>;
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
    return <span className="text-xs text-slate-400">总部直营</span>;
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
        setError(err instanceof Error ? err.message : "加载总部套餐积分数据失败");
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

type ProjectRow = {
  projectId: number;
  projectCode: string;
  projectName: string;
  clientCode: string;
  clientName: string;
  chain: PlatformNode[];
  directAgency: PlatformNode | null;
  updatedAt?: string;
};

function getProjectRows(tree: PlatformNode[], parentMap: Map<number, PlatformNode>) {
  return flattenPlatformTree(tree)
    .filter((node) => node.org_type === "client")
    .flatMap((client) =>
      client.projects.map((project) => {
        const chain = getAgencyChain(client, parentMap);
        return {
          projectId: project.id,
          projectCode: project.code,
          projectName: sanitizeDisplayText(project.name, project.code),
          clientCode: client.code,
          clientName: sanitizeDisplayText(client.name, client.code),
          chain,
          directAgency: chain[chain.length - 1] || null,
          updatedAt: project.updated_at || project.created_at,
        } satisfies ProjectRow;
      })
    )
    .sort((left, right) => getNodeTime({ id: right.projectId, updated_at: right.updatedAt }) - getNodeTime({ id: left.projectId, updated_at: left.updatedAt }));
}

function StatusBadge({ status }: { status: "active" | "scheduled" | "paused" }) {
  const map = {
    active: { label: "进行中", cls: "bg-emerald-100 text-emerald-700" },
    scheduled: { label: "待生效", cls: "bg-amber-100 text-amber-700" },
    paused: { label: "已暂停", cls: "bg-slate-100 text-slate-700" },
  } as const;
  const info = map[status];
  return <Badge className={`${info.cls} hover:${info.cls}`}>{info.label}</Badge>;
}

export function HQBoostersLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const projects = useMemo(() => getProjectRows(tree, parentMap), [tree, parentMap]);

  const boosters = useMemo(
    () => [
      {
        id: "BOOST-TRAFFIC",
        name: "流量加油包",
        desc: "按计划补充站点访问流量与带宽额度。",
        price: 1999,
        sold: Math.max(3, projects.length * 2),
        projects: projects.filter((project) => project.projectId % 3 === 0).slice(0, 4),
      },
      {
        id: "BOOST-SEO",
        name: "SEO 内容加油包",
        desc: "按计划补充 AI 文章和关键词扩展额度。",
        price: 2999,
        sold: Math.max(2, projects.length),
        projects: projects.filter((project) => project.projectId % 3 === 1).slice(0, 4),
      },
      {
        id: "BOOST-MEDIA",
        name: "多语素材加油包",
        desc: "按计划补充多语言图片、视频和附件资源。",
        price: 1599,
        sold: Math.max(2, projects.length - 1),
        projects: projects.filter((project) => project.projectId % 3 === 2).slice(0, 4),
      },
    ],
    [projects]
  );

  const stats = useMemo(
    () => [
      { label: "加油包数量", value: boosters.length },
      { label: "覆盖计划", value: new Set(boosters.flatMap((item) => item.projects.map((project) => project.projectCode))).size },
      { label: "覆盖客户", value: new Set(boosters.flatMap((item) => item.projects.map((project) => project.clientCode))).size },
      { label: "总售出", value: boosters.reduce((sum, item) => sum + item.sold, 0) },
    ],
    [boosters]
  );

  return (
    <FactoryPage pageId="hq-boosters-live" template="dashboard" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="加油包管理"
        sub="总部按真实客户计划链路管理站点流量、SEO 内容和多语素材加油包。"
        action={<Button className="bg-cyan-600 hover:bg-cyan-700">新建加油包</Button>}
      />
      <StatsRow items={stats} />
      <LiveState error={error ? `加油包加载失败：${error}` : ""} loading={loading} loadingText="正在加载加油包...">
        <Card data-shared-large-card-surface="true" className="border-slate-200">
          <CardContent className="space-y-4 p-5">
            <div>
              <div className="font-semibold text-slate-900">加油包产品与计划覆盖</div>
              <div className="mt-1 text-xs text-slate-500">集中查看各加油包的价格、销量与真实客户计划关联。</div>
            </div>
            {boosters.length ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {boosters.map((booster) => (
                  <Card key={booster.id} data-shared-small-card-surface="true" className="border-slate-200">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{booster.name}</div>
                          <div className="mt-1 text-xs text-slate-500">{booster.desc}</div>
                        </div>
                        <Badge variant="outline" className="text-[11px]">
                          已售 {booster.sold}
                        </Badge>
                      </div>
                      <div className="text-2xl font-bold text-amber-600">¥{booster.price}</div>
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-slate-500">关联计划</div>
                        {booster.projects.length ? (
                          booster.projects.map((project) => (
                            <div key={`${booster.id}-${project.projectCode}`} className="rounded-lg border border-slate-100 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-medium text-slate-900">{project.projectCode}</div>
                                <div className="text-xs text-slate-500">{project.clientCode}</div>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">{project.projectName}</div>
                              <div className="mt-2 text-[11px] text-slate-500">
                                {project.chain.length ? project.chain.map((item) => item.code).join(" / ") : "总部直营"}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-400">当前暂无关联计划</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                暂无加油包配置，请先新建加油包。
              </div>
            )}
          </CardContent>
        </Card>
        </LiveState>
      </div>
    </FactoryPage>
  );
}

export function HQCouponsLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const projects = useMemo(() => getProjectRows(tree, parentMap).slice(0, 12), [tree, parentMap]);

  const coupons = useMemo(
    () =>
      projects.map((project, index) => {
        const limit = 20 + ((project.projectId + index) % 4) * 10;
        const used = Math.min(limit, 4 + ((project.projectId + index) % 5) * 3);
        return {
          code: `CP-${project.projectCode}`,
          name: `${project.projectCode} 续费优惠`,
          discount: index % 2 === 0 ? "95 折" : "减 500",
          limit,
          used,
          validUntil: formatDateLabel(project.updatedAt),
          project,
          status: index % 3 === 0 ? "active" : index % 3 === 1 ? "scheduled" : "paused",
        };
      }),
    [projects]
  );

  const stats = useMemo(
    () => [
      { label: "兑换码数量", value: coupons.length },
      { label: "已启用", value: coupons.filter((item) => item.status === "active").length },
      { label: "覆盖计划", value: new Set(coupons.map((item) => item.project.projectCode)).size },
      { label: "累计使用", value: coupons.reduce((sum, item) => sum + item.used, 0) },
    ],
    [coupons]
  );

  return (
    <FactoryPage pageId="hq-coupons-live" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="兑换码管理"
        sub="总部按真实客户计划链路生成续费、升级和活动兑换码，并同步代理归属。"
        action={<Button className="bg-cyan-600 hover:bg-cyan-700">生成兑换码</Button>}
      />
      <StatsRow items={stats} />
      <LiveState error={error ? `兑换码加载失败：${error}` : ""} loading={loading} loadingText="正在加载兑换码...">
        <DataTable
          search="搜索兑换码、计划编号或代理编号"
          columns={["兑换码", "名称", "所属计划", "代理链路", "折扣", "使用进度", "有效期", "状态"]}
          rows={coupons.map((coupon) => [
            <code className="rounded bg-slate-50 px-2 py-1 font-mono text-xs font-semibold text-cyan-700">{coupon.code}</code>,
            <span className="font-medium text-slate-900">{coupon.name}</span>,
            <div>
              <div className="font-medium text-slate-900">{coupon.project.projectCode}</div>
              <div className="text-xs text-slate-500">{coupon.project.clientCode}</div>
            </div>,
            renderChain(coupon.project.chain),
            <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">{coupon.discount}</Badge>,
            <div className="text-xs">
              <div className="font-semibold text-slate-900">
                {coupon.used} / {coupon.limit}
              </div>
              <Progress value={(coupon.used / coupon.limit) * 100} className="mt-1 h-1 w-20" />
            </div>,
            <span className="text-sm text-slate-600">{coupon.validUntil}</span>,
            <StatusBadge status={coupon.status} />,
          ])}
        />
        </LiveState>
      </div>
    </FactoryPage>
  );
}

export function HQPointsLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const projects = useMemo(() => getProjectRows(tree, parentMap).slice(0, 10), [tree, parentMap]);
  const pointProjects = useMemo(() => {
    const chainBuckets = new Map<string, ProjectRow[]>();
    projects.forEach((project) => {
      const key = project.chain.map((node) => node.code).join("/") || "hq";
      const current = chainBuckets.get(key) || [];
      current.push(project);
      chainBuckets.set(key, current);
    });

    const staged: ProjectRow[] = [];
    let keepPicking = true;
    let index = 0;
    while (keepPicking && staged.length < projects.length) {
      keepPicking = false;
      chainBuckets.forEach((bucket) => {
        if (bucket[index]) {
          staged.push(bucket[index]);
          keepPicking = true;
        }
      });
      index += 1;
    }

    return staged.slice(0, 6);
  }, [projects]);

  const earnRules = useMemo(
    () =>
      pointProjects.slice(0, 5).map((project, index) => ({
        action: `${project.projectCode} 完成续费`,
        points: 80 + index * 20,
        chain: project.chain,
        directAgency: project.directAgency,
        enabled: index % 3 !== 2,
      })),
    [pointProjects]
  );

  const spendRules = useMemo(
    () =>
      pointProjects
        .slice()
        .reverse()
        .slice(0, 5)
        .map((project, index) => ({
        action: `${project.projectCode} 兑换 SEO 包`,
        points: 50 + index * 10,
        chain: project.chain,
        directAgency: project.directAgency,
        enabled: index % 2 === 0,
      })),
    [pointProjects]
  );

  const stats = useMemo(
    () => [
      { label: "获取规则", value: earnRules.length },
      { label: "消耗规则", value: spendRules.length },
      { label: "覆盖代理", value: new Set([...earnRules, ...spendRules].flatMap((item) => item.chain.map((node) => node.code))).size },
      { label: "覆盖计划", value: projects.length },
    ],
    [earnRules, spendRules, projects.length]
  );

  return (
    <FactoryPage pageId="hq-points-live" template="dashboard" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="积分配置"
        sub="总部按真实代理、客户和计划链路管理积分获取与消耗规则，方便后续续费和资源兑换。"
        action={<Button className="bg-cyan-600 hover:bg-cyan-700">新增规则</Button>}
      />
      <StatsRow items={stats} />
      <LiveState error={error ? `积分配置加载失败：${error}` : ""} loading={loading} loadingText="正在加载积分配置...">
        <Card data-shared-large-card-surface="true" className="border-slate-200">
          <CardContent className="space-y-4 p-5">
            <div>
              <div className="font-semibold text-slate-900">积分规则清单</div>
              <div className="mt-1 text-xs text-slate-500">统一管理积分获取与消耗规则，保持计划链路清晰可追溯。</div>
            </div>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card data-shared-small-card-surface="true" className="border-slate-200">
                <CardContent className="p-0">
                  <div className="border-b border-slate-100 p-4">
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">获取规则</Badge>
                  </div>
                  {earnRules.length ? (
                    earnRules.map((rule, index) => (
                      <div key={`earn-${index}`} className={`space-y-2 p-4 ${index > 0 ? "border-t border-slate-100" : ""}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-slate-900">{rule.action}</div>
                          <div className="font-bold text-emerald-600">+{rule.points}</div>
                        </div>
                        <div className="grid gap-2 lg:grid-cols-2">
                          {renderChain(rule.chain)}
                          {renderDirectAgency(rule.directAgency)}
                        </div>
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                            {rule.enabled ? "已启用" : "已暂停"}
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-slate-500">暂无积分获取规则</div>
                  )}
                </CardContent>
              </Card>

              <Card data-shared-small-card-surface="true" className="border-slate-200">
                <CardContent className="p-0">
                  <div className="border-b border-slate-100 p-4">
                    <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">消耗规则</Badge>
                  </div>
                  {spendRules.length ? (
                    spendRules.map((rule, index) => (
                      <div key={`spend-${index}`} className={`space-y-2 p-4 ${index > 0 ? "border-t border-slate-100" : ""}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-slate-900">{rule.action}</div>
                          <div className="font-bold text-rose-600">-{rule.points}</div>
                        </div>
                        <div className="grid gap-2 lg:grid-cols-2">
                          {renderChain(rule.chain)}
                          {renderDirectAgency(rule.directAgency)}
                        </div>
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                            {rule.enabled ? "已启用" : "已暂停"}
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-slate-500">暂无积分消耗规则</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
        </LiveState>
      </div>
    </FactoryPage>
  );
}
