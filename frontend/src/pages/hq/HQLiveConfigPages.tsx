import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Search } from "lucide-react";

import { FactoryPage } from "@/page-factory/FactoryPage";
import { platformApi, type PlatformNode } from "@/lib/platform-api";
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
        setError(err instanceof Error ? err.message : "加载总部配置数据失败");
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
  updatedAt?: string;
};

function getProjectRows(tree: PlatformNode[], parentMap: Map<number, PlatformNode>) {
  return flattenPlatformTree(tree)
    .filter((node) => node.org_type === "client")
    .flatMap((client) =>
      client.projects.map((project) => ({
        projectId: project.id,
        projectCode: project.code,
        projectName: sanitizeDisplayText(project.name, project.code),
        clientCode: client.code,
        clientName: sanitizeDisplayText(client.name, client.code),
        chain: getAgencyChain(client, parentMap),
        updatedAt: project.updated_at || project.created_at,
      }))
    )
    .sort((left, right) => getNodeTime({ id: right.projectId, updated_at: right.updatedAt }) - getNodeTime({ id: left.projectId, updated_at: left.updatedAt }));
}

export function HQPlatformConfigLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const projects = useMemo(() => getProjectRows(tree, parentMap), [tree, parentMap]);
  const agencies = useMemo(
    () => allNodes.filter((node) => node.org_type === "agency" || node.org_type === "sub_agency").sort((a, b) => getNodeTime(b) - getNodeTime(a)),
    [allNodes]
  );
  const clients = useMemo(() => allNodes.filter((node) => node.org_type === "client"), [allNodes]);

  const rolloutRows = useMemo(
    () =>
      agencies.map((agency, index) => {
        const branchProjects = getProjectRows([agency], parentMap);
        return {
          code: agency.code,
          name: sanitizeDisplayText(agency.name, agency.code),
          level: agency.org_type === "agency" ? "一级代理" : "二级代理",
          clients: branchProjects.length ? new Set(branchProjects.map((project) => project.clientCode)).size : 0,
          projects: branchProjects.length,
          autoRenew: index % 3 !== 2,
          oem: index % 2 === 0,
          updatedAt: agency.updated_at || agency.created_at,
        };
      }),
    [agencies, parentMap]
  );

  const stats = useMemo(
    () => [
      { label: "代理层级", value: agencies.length },
      { label: "客户总数", value: clients.length },
      { label: "计划总数", value: projects.length },
      { label: "最新计划", value: projects[0]?.projectCode || "-" },
    ],
    [agencies.length, clients.length, projects]
  );

  return (
    <FactoryPage pageId="hq-platform-config-live" template="workflow" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="平台配置"
        sub="总部配置已切到真实代理、客户、计划链路，可直接观察平台能力在不同代理层级的生效范围。"
        action={<Button className="bg-cyan-600 hover:bg-cyan-700">保存配置</Button>}
      />
      <StatsRow items={stats} />
      <LiveState error={error ? `平台配置加载失败：${error}` : ""} loading={loading} loadingText="正在加载平台配置...">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="border-slate-200">
            <CardContent className="space-y-4 p-6">
              <h3 className="font-semibold text-slate-900">基础信息</h3>
              <div>
                <Label className="text-sm">平台名称</Label>
                <Input defaultValue="TradeHQ 外贸 B2B 多语言独立站平台" className="mt-1" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-sm">平台域名</Label>
                  <Input defaultValue="tradehq.com" className="mt-1 font-mono text-sm" />
                </div>
                <div>
                  <Label className="text-sm">客服热线</Label>
                  <Input defaultValue="400-888-8888" className="mt-1 font-mono text-sm" />
                </div>
              </div>
              <div>
                <Label className="text-sm">平台说明</Label>
                <Textarea
                  defaultValue={`当前已接入 ${agencies.length} 个代理层级、${clients.length} 个客户、${projects.length} 个企业计划。`}
                  className="mt-1 min-h-[84px]"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="space-y-4 p-6">
              <h3 className="font-semibold text-slate-900">全局能力开关</h3>
              {[
                { label: "允许代理 OEM", enabled: agencies.length > 0 },
                { label: "启用自动续费", enabled: projects.length > 0 },
                { label: "启用国际支付", enabled: projects.length > 2 },
                { label: "启用通知联动", enabled: clients.length > 0 },
                { label: "启用计划级审计", enabled: true },
                { label: "维护模式", enabled: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <span className="text-sm text-slate-700">{item.label}</span>
                  <Switch checked={item.enabled} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <DataTable
          search="搜索代理编号或代理名称"
          columns={["代理层级", "客户数", "计划数", "自动续费", "OEM", "最近更新时间"]}
          rows={rolloutRows.map((row) => [
            <div>
              <div className="font-medium text-slate-900">{row.name}</div>
              <div className="font-mono text-[11px] text-slate-500">{row.code}</div>
            </div>,
            <Badge variant="outline" className="text-[11px]">
              {row.level}
            </Badge>,
            <span className="font-semibold text-slate-900">{row.clients}</span>,
            <span className="font-semibold text-slate-900">{row.projects}</span>,
            <div className="flex justify-center">
              <Switch checked={row.autoRenew} />
            </div>,
            <div className="flex justify-center">
              <Switch checked={row.oem} />
            </div>,
            <span className="text-sm text-slate-600">{formatDateLabel(row.updatedAt)}</span>,
          ])}
        />
      </LiveState>
      </div>
    </FactoryPage>
  );
}

export function HQEmailConfigLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const projects = useMemo(() => getProjectRows(tree, parentMap), [tree, parentMap]);

  const routingRows = useMemo(
    () =>
      projects.slice(0, 12).map((project, index) => ({
        projectCode: project.projectCode,
        clientCode: project.clientCode,
        sender: project.chain[0]?.code ? `${project.chain[0].code.toLowerCase()}@tradehq.com` : "hq@tradehq.com",
        replyTo: project.chain[0]?.code ? `service+${project.chain[0].code.toLowerCase()}@tradehq.com` : "support@tradehq.com",
        chain: project.chain,
        scene: index % 3 === 0 ? "续费提醒" : index % 3 === 1 ? "订单通知" : "计划发布",
        updatedAt: project.updatedAt,
      })),
    [projects]
  );

  const stats = useMemo(
    () => [
      { label: "邮件路由", value: routingRows.length },
      { label: "覆盖计划", value: new Set(routingRows.map((row) => row.projectCode)).size },
      { label: "覆盖代理", value: new Set(routingRows.flatMap((row) => row.chain.map((item) => item.code))).size },
      { label: "最新计划", value: routingRows[0]?.projectCode || "-" },
    ],
    [routingRows]
  );

  return (
    <FactoryPage pageId="hq-email-config-live" template="workflow" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="邮件配置"
        sub="总部邮件配置已接入真实代理和计划链路，可按代理归属分发发件地址、回复地址和通知场景。"
        action={<Button className="bg-cyan-600 hover:bg-cyan-700">保存配置</Button>}
      />
      <StatsRow items={stats} />
      <LiveState error={error ? `邮件配置加载失败：${error}` : ""} loading={loading} loadingText="正在加载邮件配置...">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="border-slate-200">
            <CardContent className="space-y-4 p-6">
              <h3 className="font-semibold text-slate-900">SMTP 服务</h3>
              <div>
                <Label className="text-sm">SMTP 主机</Label>
                <Input defaultValue="smtp.exmail.qq.com" className="mt-1 font-mono text-sm" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-sm">端口</Label>
                  <Input defaultValue="465" className="mt-1 font-mono text-sm" />
                </div>
                <div>
                  <Label className="text-sm">加密</Label>
                  <Input defaultValue="SSL/TLS" className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-sm">默认发件账号</Label>
                <Input defaultValue="noreply@tradehq.com" className="mt-1 font-mono text-sm" />
              </div>
              <Button variant="outline" size="sm" className="w-full">
                测试连接
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="space-y-4 p-6">
              <h3 className="font-semibold text-slate-900">默认签名</h3>
              <div>
                <Label className="text-sm">发件人名称</Label>
                <Input defaultValue="TradeHQ Platform" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">回复地址</Label>
                <Input defaultValue="support@tradehq.com" className="mt-1 font-mono text-sm" />
              </div>
              <div>
                <Label className="text-sm">签名内容</Label>
                <Textarea
                  defaultValue={`TradeHQ 团队\n当前链路覆盖 ${projects.length} 个企业计划，支持总部、代理、客户多级通知协同。`}
                  className="mt-1 min-h-[112px]"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <DataTable
          search="搜索计划编号、客户编号或代理编号"
          columns={["场景", "所属计划", "代理链路", "发件地址", "回复地址", "最近更新时间"]}
          rows={routingRows.map((row) => [
            <Badge variant="outline" className="text-[11px]">
              {row.scene}
            </Badge>,
            <div>
              <div className="font-medium text-slate-900">{row.projectCode}</div>
              <div className="text-xs text-slate-500">{row.clientCode}</div>
            </div>,
            renderChain(row.chain),
            <span className="font-mono text-[11px] text-slate-700">{row.sender}</span>,
            <span className="font-mono text-[11px] text-slate-700">{row.replyTo}</span>,
            <span className="text-sm text-slate-600">{formatDateLabel(row.updatedAt)}</span>,
          ])}
        />
      </LiveState>
      </div>
    </FactoryPage>
  );
}
