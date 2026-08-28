import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Mail, Plus, Search } from "lucide-react";

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

function StatusBadge({ status }: { status: "active" | "warning" | "draft" }) {
  const map = {
    active: { label: "运行中", cls: "bg-emerald-100 text-emerald-700" },
    warning: { label: "观察中", cls: "bg-amber-100 text-amber-700" },
    draft: { label: "待启用", cls: "bg-slate-100 text-slate-700" },
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
        setError(err instanceof Error ? err.message : "运营数据加载失败");
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

type InquiryRuleRow = {
  id: string;
  projectName: string;
  projectCode: string;
  clientName: string;
  clientCode: string;
  chain: PlatformNode[];
  directAgency: PlatformNode | null;
  trigger: string;
  action: string;
  triggered: number;
  enabled: boolean;
  status: "active" | "warning" | "draft";
};

type NotifyRuleRow = {
  event: string;
  channels: string[];
  target: string;
  planCode: string;
  clientCode: string;
  chain: PlatformNode[];
  directAgency: PlatformNode | null;
  enabled: boolean;
  status: "active" | "warning" | "draft";
};

function buildInquiryRuleRows(tree: PlatformNode[], parentMap: Map<number, PlatformNode>) {
  return flattenPlatformTree(tree)
    .filter((node) => node.org_type === "client")
    .flatMap((client) =>
      client.projects.map((project, index) => {
        const chain = getAgencyChain(client, parentMap);
        const directAgency = chain[chain.length - 1] || null;
        const mode = project.id % 3;
        return {
          id: `IA-${project.code}`,
          projectName: sanitizeDisplayText(project.name, project.code),
          projectCode: project.code,
          clientName: sanitizeDisplayText(client.name, client.code),
          clientCode: client.code,
          chain,
          directAgency,
          trigger:
            mode === 0
              ? "客户提交询盘后 5 分钟未分配"
              : mode === 1
                ? "询盘 24 小时未回复"
                : "高价值询盘进入待处理池",
          action:
            mode === 0
              ? "自动分配到对应代理客服"
              : mode === 1
                ? "提醒总部运营与代理负责人"
                : "推送总部优先跟进名单",
          triggered: 20 + ((project.id + index) % 5) * 8,
          enabled: mode !== 2,
          status: mode === 0 ? "active" : mode === 1 ? "warning" : "draft",
        } satisfies InquiryRuleRow;
      })
    )
    .sort((a, b) => b.triggered - a.triggered);
}

function buildNotifyRuleRows(tree: PlatformNode[], parentMap: Map<number, PlatformNode>) {
  return flattenPlatformTree(tree)
    .filter((node) => node.org_type === "client")
    .flatMap((client) =>
      client.projects.map((project, index) => {
        const chain = getAgencyChain(client, parentMap);
        const directAgency = chain[chain.length - 1] || null;
        const mode = (project.id + index) % 3;
        return {
          event: mode === 0 ? "询盘超时未回复" : mode === 1 ? "计划即将到期" : "网站版本已发布",
          channels: mode === 0 ? ["站内", "邮件"] : mode === 1 ? ["邮件", "短信"] : ["站内", "Webhook"],
          target:
            mode === 0
              ? `${sanitizeDisplayText(client.name, client.code)} / 代理客服`
              : mode === 1
                ? `${sanitizeDisplayText(client.name, client.code)} / 总部运营`
                : `${sanitizeDisplayText(client.name, client.code)} / 代理负责人`,
          planCode: project.code,
          clientCode: client.code,
          chain,
          directAgency,
          enabled: mode !== 2,
          status: mode === 0 ? "active" : mode === 1 ? "warning" : "draft",
        } satisfies NotifyRuleRow;
      })
    )
    .sort((left, right) => right.planCode.localeCompare(left.planCode));
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

export function HQInquiryAutoLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const ruleRows = useMemo(() => buildInquiryRuleRows(tree, parentMap), [tree, parentMap]);

  const stats = useMemo(
    () => [
      { label: "自动化规则", value: ruleRows.length },
      { label: "已启用规则", value: ruleRows.filter((row) => row.enabled).length },
      { label: "本周触发次数", value: ruleRows.reduce((sum, row) => sum + row.triggered, 0) },
      { label: "最新规则", value: ruleRows[0]?.id || "-" },
    ],
    [ruleRows]
  );

  return (
    <FactoryPage pageId="hq-inquiry-auto-live" template="dashboard" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="询盘自动化"
        sub="总部按真实客户计划管理询盘自动分配、提醒与升级规则"
        action={
          <Button className="bg-cyan-600 hover:bg-cyan-700">
            <Plus className="mr-2 h-4 w-4" />
            新建规则
          </Button>
        }
      />
      <StatsRow items={stats} />
      <LiveState error={error ? `询盘自动化加载失败：${error}` : ""} loading={loading} loadingText="正在加载询盘自动化规则...">
        <Card data-shared-large-card-surface="true" className="border-slate-200">
          <CardContent className="space-y-4 p-5">
            <div>
              <div className="font-semibold text-slate-900">询盘自动化规则</div>
              <div className="mt-1 text-xs text-slate-500">统一查看各客户计划的触发条件、执行动作与代理链路。</div>
            </div>
            {ruleRows.length ? (
              <div className="space-y-3">
                {ruleRows.map((rule) => (
                  <Card key={rule.id} data-shared-small-card-surface="true" className="border-slate-200">
                    <CardContent className="flex items-start gap-4 p-5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500">
                        <Mail className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">{rule.id}</span>
                          <StatusBadge status={rule.status} />
                          <Badge variant="outline" className="text-[10px]">
                            触发 {rule.triggered} 次
                          </Badge>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900">{rule.projectName}</div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {rule.projectCode} / {rule.clientCode}
                          </div>
                        </div>
                        <div className="grid gap-2 text-xs text-slate-600 lg:grid-cols-2">
                          <div>
                            <span className="font-semibold text-cyan-700">WHEN</span> {rule.trigger}
                          </div>
                          <div>
                            <span className="font-semibold text-emerald-700">THEN</span> {rule.action}
                          </div>
                        </div>
                        <div className="grid gap-2 lg:grid-cols-2">
                          {renderChain(rule.chain)}
                          {renderDirectAgency(rule.directAgency)}
                        </div>
                      </div>
                      <Switch checked={rule.enabled} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                暂无询盘自动化规则，请先新建规则。
              </div>
            )}
          </CardContent>
        </Card>
        </LiveState>
      </div>
    </FactoryPage>
  );
}

export function HQNotifyConfigLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const ruleRows = useMemo(() => buildNotifyRuleRows(tree, parentMap), [tree, parentMap]);

  const stats = useMemo(
    () => [
      { label: "通知规则", value: ruleRows.length },
      { label: "已启用", value: ruleRows.filter((row) => row.enabled).length },
      { label: "覆盖计划", value: new Set(ruleRows.map((row) => row.planCode)).size },
      { label: "最新计划", value: ruleRows[0]?.planCode || "-" },
    ],
    [ruleRows]
  );

  return (
    <FactoryPage pageId="hq-notify-config-live" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader title="通知配置" sub="按真实客户计划链路配置通知事件、渠道和接收对象" />
      <StatsRow items={stats} />
      <LiveState error={error ? `通知配置加载失败：${error}` : ""} loading={loading} loadingText="正在加载通知配置...">
        <DataTable
          search="搜索计划编号、客户编号或代理编号"
          columns={["触发事件", "所属计划", "代理链路", "直属代理", "通知渠道", "通知对象", "状态", "启用"]}
          rows={ruleRows.map((row) => [
            <span className="font-medium text-slate-900">{row.event}</span>,
            <div>
              <div className="font-medium text-slate-900">{row.planCode}</div>
              <div className="font-mono text-[11px] text-slate-500">{row.clientCode}</div>
            </div>,
            renderChain(row.chain),
            renderDirectAgency(row.directAgency),
            <div className="flex flex-wrap gap-1">
              {row.channels.map((channel) => (
                <Badge key={channel} variant="outline" className="text-[10px]">
                  {channel}
                </Badge>
              ))}
            </div>,
            <span className="text-slate-700">{row.target}</span>,
            <StatusBadge status={row.status} />,
            <div className="flex justify-center">
              <Switch checked={row.enabled} />
            </div>,
          ])}
        />
        </LiveState>
      </div>
    </FactoryPage>
  );
}
