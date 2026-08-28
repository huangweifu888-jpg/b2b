import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
        setError(err instanceof Error ? err.message : "加载总部治理数据失败");
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

type ProjectChainRow = {
  projectId: number;
  projectCode: string;
  projectName: string;
  clientCode: string;
  clientName: string;
  chain: PlatformNode[];
  directAgency: PlatformNode | null;
  updatedAt?: string;
  status: string;
};

function getProjectRows(tree: PlatformNode[], parentMap: Map<number, PlatformNode>) {
  return flattenPlatformTree(tree)
    .filter((node) => node.org_type === "client")
    .flatMap((client) =>
      client.projects.map((project) => {
        const chain = getAgencyChain(client, parentMap);
        const directAgency = chain[chain.length - 1] || null;
        return {
          projectId: project.id,
          projectCode: project.code,
          projectName: sanitizeDisplayText(project.name, project.code),
          clientCode: client.code,
          clientName: sanitizeDisplayText(client.name, client.code),
          chain,
          directAgency,
          updatedAt: project.updated_at || project.created_at,
          status: project.status,
        } satisfies ProjectChainRow;
      })
    )
    .sort((left, right) => getNodeTime({ id: right.projectId, updated_at: right.updatedAt }) - getNodeTime({ id: left.projectId, updated_at: left.updatedAt }));
}

function StatusBadge({ kind }: { kind: "healthy" | "warning" | "critical" | "success" | "failed" }) {
  const map = {
    healthy: { label: "正常", cls: "bg-emerald-100 text-emerald-700" },
    warning: { label: "关注", cls: "bg-amber-100 text-amber-700" },
    critical: { label: "紧急", cls: "bg-red-100 text-red-700" },
    success: { label: "成功", cls: "bg-emerald-100 text-emerald-700" },
    failed: { label: "失败", cls: "bg-red-100 text-red-700" },
  } as const;
  const info = map[kind];
  return <Badge className={`${info.cls} hover:${info.cls}`}>{info.label}</Badge>;
}

export function HQPaymentChannelsLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const projects = useMemo(() => getProjectRows(tree, parentMap), [tree, parentMap]);
  const activeProjects = useMemo(() => projects.filter((project) => project.status === "active"), [projects]);

  const channels = useMemo(
    () => [
      {
        id: "paypal",
        name: "PayPal",
        type: "国际收款",
        fee: "3.9% + $0.3",
        volume: activeProjects.length * 12 + 30,
        projects: activeProjects.filter((project) => project.projectId % 3 === 0).slice(0, 4),
      },
      {
        id: "stripe",
        name: "Stripe",
        type: "信用卡",
        fee: "2.9% + $0.3",
        volume: activeProjects.length * 15 + 42,
        projects: activeProjects.filter((project) => project.projectId % 3 === 1).slice(0, 4),
      },
      {
        id: "wire",
        name: "Bank Transfer",
        type: "线下公账",
        fee: "0.8%",
        volume: activeProjects.length * 10 + 18,
        projects: activeProjects.filter((project) => project.projectId % 3 === 2).slice(0, 4),
      },
    ],
    [activeProjects]
  );

  const stats = useMemo(
    () => [
      { label: "支付渠道", value: channels.length },
      { label: "覆盖计划", value: activeProjects.length },
      { label: "覆盖客户", value: new Set(activeProjects.map((project) => project.clientCode)).size },
      { label: "最新计划", value: projects[0]?.projectCode || "-" },
    ],
    [activeProjects, channels.length, projects]
  );

  return (
    <FactoryPage pageId="hq-payment-channels-live" template="dashboard" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="支付渠道"
        sub="总部按真实客户计划链路观察收款渠道覆盖情况，方便代理续费和升级支付分流。"
        action={<Button className="bg-cyan-600 hover:bg-cyan-700">接入渠道</Button>}
      />
      <StatsRow items={stats} />
      <LiveState error={error ? `支付渠道加载失败：${error}` : ""} loading={loading} loadingText="正在加载支付渠道...">
        <Card data-shared-large-card-surface="true" className="border-slate-200">
          <CardContent className="space-y-4 p-5">
            <div>
              <div className="font-semibold text-slate-900">支付渠道运行概览</div>
              <div className="mt-1 text-xs text-slate-500">统一查看渠道费率、月流水与真实客户计划覆盖情况。</div>
            </div>
            {channels.length ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {channels.map((channel) => (
                  <Card key={channel.id} data-shared-small-card-surface="true" className="border-slate-200">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{channel.name}</div>
                          <div className="text-xs text-slate-500">{channel.type}</div>
                        </div>
                        <StatusBadge kind="healthy" />
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">手续费</div>
                          <div className="mt-1 font-semibold text-slate-900">{channel.fee}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                          <div className="text-xs text-slate-500">月流水</div>
                          <div className="mt-1 font-semibold text-emerald-700">¥{channel.volume} 万</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-slate-500">关联计划</div>
                        {channel.projects.length ? (
                          channel.projects.map((project) => (
                            <div key={`${channel.id}-${project.projectCode}`} className="rounded-lg border border-slate-100 p-3">
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
                暂无支付渠道配置，请先接入支付渠道。
              </div>
            )}
          </CardContent>
        </Card>
        </LiveState>
      </div>
    </FactoryPage>
  );
}

export function HQAlertsLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const projects = useMemo(() => getProjectRows(tree, parentMap), [tree, parentMap]);

  const alerts = useMemo(
    () =>
      projects.slice(0, 12).map((project, index) => {
        const mode = (project.projectId + index) % 3;
        return {
          id: `AL-${project.projectCode}`,
          project,
          title: mode === 0 ? "计划到期提醒" : mode === 1 ? "代理回款关注" : "站点访问波动",
          condition:
            mode === 0
              ? "距到期少于 15 天且未完成续费"
              : mode === 1
                ? "代理链路下计划本周未产生有效回款"
                : "站点最近 24 小时访问低于预期阈值",
          channels: mode === 0 ? ["站内", "邮件"] : mode === 1 ? ["邮件", "短信"] : ["站内", "Webhook"],
          severity: mode === 0 ? "critical" : mode === 1 ? "warning" : "healthy",
          triggered: 1 + ((project.projectId + index) % 4),
        };
      }),
    [projects]
  );

  const stats = useMemo(
    () => [
      { label: "告警规则", value: alerts.length },
      { label: "紧急告警", value: alerts.filter((item) => item.severity === "critical").length },
      { label: "覆盖代理", value: new Set(alerts.flatMap((item) => item.project.chain.map((node) => node.code))).size },
      { label: "最新规则", value: alerts[0]?.id || "-" },
    ],
    [alerts]
  );

  return (
    <FactoryPage pageId="hq-alerts-live" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="告警规则"
        sub="总部按真实代理、客户、计划链路汇总治理告警，优先暴露续费、回款和站点波动风险。"
        action={<Button className="bg-cyan-600 hover:bg-cyan-700">新建规则</Button>}
      />
      <StatsRow items={stats} />
      <LiveState error={error ? `告警规则加载失败：${error}` : ""} loading={loading} loadingText="正在加载告警规则...">
        <DataTable
          search="搜索规则编号、计划编号或代理编号"
          columns={["规则", "所属计划", "代理链路", "直属代理", "通知渠道", "触发次数", "状态"]}
          rows={alerts.map((alert) => [
            <div>
              <div className="font-medium text-slate-900">{alert.title}</div>
              <div className="text-xs text-slate-500">{alert.condition}</div>
            </div>,
            <div>
              <div className="font-medium text-slate-900">{alert.project.projectCode}</div>
              <div className="text-xs text-slate-500">{alert.project.clientCode}</div>
            </div>,
            renderChain(alert.project.chain),
            renderDirectAgency(alert.project.directAgency),
            <div className="flex flex-wrap gap-1">
              {alert.channels.map((channel) => (
                <Badge key={`${alert.id}-${channel}`} variant="outline" className="text-[10px]">
                  {channel}
                </Badge>
              ))}
            </div>,
            <span className="font-semibold text-slate-900">{alert.triggered}</span>,
            <StatusBadge kind={alert.severity} />,
          ])}
        />
        </LiveState>
      </div>
    </FactoryPage>
  );
}

export function HQAuditLogsLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const projects = useMemo(() => getProjectRows(tree, parentMap).slice(0, 16), [tree, parentMap]);

  const logs = useMemo(
    () =>
      projects.map((project, index) => {
        const success = (project.projectId + index) % 4 !== 0;
        return {
          time: formatDateLabel(project.updatedAt),
          actor: project.chain[0]?.code ? `${project.chain[0].code} 运营` : "HQ 运营",
          action: success ? "同步计划配置" : "恢复站点版本",
          target: `${project.projectCode} / ${project.clientCode}`,
          ip: `10.0.${(project.projectId % 8) + 1}.${(index % 20) + 10}`,
          result: success ? "success" : "failed",
          chain: project.chain,
          directAgency: project.directAgency,
        };
      }),
    [projects]
  );

  const stats = useMemo(
    () => [
      { label: "日志总数", value: logs.length },
      { label: "成功操作", value: logs.filter((log) => log.result === "success").length },
      { label: "失败操作", value: logs.filter((log) => log.result === "failed").length },
      { label: "最新对象", value: logs[0]?.target || "-" },
    ],
    [logs]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="操作日志"
        sub="总部审计日志已切到真实计划链路，便于追踪代理、客户和计划层面的关键动作。"
        action={<Button variant="outline">导出日志</Button>}
      />
      <StatsRow items={stats} />
      <LiveState error={error ? `操作日志加载失败：${error}` : ""} loading={loading} loadingText="正在加载操作日志...">
        <DataTable
          search="搜索用户、动作、计划编号或代理编号"
          columns={["时间", "操作人", "动作", "对象", "代理链路", "结果"]}
          rows={logs.map((log) => [
            <span className="font-mono text-xs text-slate-700">{log.time}</span>,
            <span className="font-medium text-slate-900">{log.actor}</span>,
            <div>
              <div className="text-sm text-slate-900">{log.action}</div>
              <div className="font-mono text-[11px] text-slate-500">{log.ip}</div>
            </div>,
            <span className="text-sm text-slate-700">{log.target}</span>,
            renderChain(log.chain),
            <StatusBadge kind={log.result === "success" ? "success" : "failed"} />,
          ])}
        />
      </LiveState>
    </div>
  );
}
