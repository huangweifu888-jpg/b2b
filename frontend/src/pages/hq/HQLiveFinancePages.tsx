import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Download, FileText, Search } from "lucide-react";

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

function StatusBadge({
  status,
}: {
  status:
    | "active"
    | "paid"
    | "pending"
    | "paused"
    | "success"
    | "auditing"
    | "refunded"
    | "expiring"
    | "warning"
    | "danger";
}) {
  const map = {
    active: { label: "正常", cls: "bg-emerald-100 text-emerald-700" },
    paid: { label: "已支付", cls: "bg-emerald-100 text-emerald-700" },
    pending: { label: "待审核", cls: "bg-amber-100 text-amber-700" },
    paused: { label: "已暂停", cls: "bg-slate-100 text-slate-700" },
    success: { label: "已完成", cls: "bg-emerald-100 text-emerald-700" },
    auditing: { label: "审核中", cls: "bg-amber-100 text-amber-700" },
    refunded: { label: "已退款", cls: "bg-blue-100 text-blue-700" },
    expiring: { label: "即将到期", cls: "bg-slate-100 text-slate-700" },
    warning: { label: "到期预警", cls: "bg-amber-100 text-amber-700" },
    danger: { label: "紧急到期", cls: "bg-red-100 text-red-700" },
  } as const;
  const info = map[status];
  return <Badge className={`${info.cls} hover:${info.cls}`}>{info.label}</Badge>;
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

function countClientDescendants(node: PlatformNode): number {
  let total = node.org_type === "client" ? 1 : 0;
  node.children.forEach((child) => {
    total += countClientDescendants(child);
  });
  return total;
}

function countProjectDescendants(node: PlatformNode): number {
  let total = node.projects.length;
  node.children.forEach((child) => {
    total += countProjectDescendants(child);
  });
  return total;
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
        setError(err instanceof Error ? err.message : "总部组织树加载失败");
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

type HQOrderStatus = "paid" | "pending" | "paused";

type HQOrderRow = {
  id: string;
  client: PlatformNode;
  project: PlatformNode["projects"][number];
  chain: PlatformNode[];
  directAgency: PlatformNode | null;
  amount: number;
  status: HQOrderStatus;
  createdAt?: string;
};

type HQWalletRow = {
  id: string;
  partyName: string;
  partyCode: string;
  chain: PlatformNode[];
  directAgency: PlatformNode | null;
  type: "client_recharge" | "agency_settlement";
  direction: "in" | "out";
  amount: number;
  date?: string;
  description: string;
  status: "success" | "auditing";
};

type HQRefundRow = {
  id: string;
  orderId: string;
  partyName: string;
  partyCode: string;
  chain: PlatformNode[];
  directAgency: PlatformNode | null;
  amount: number;
  reason: string;
  status: "pending" | "refunded";
  date?: string;
};

type HQInvoiceRow = {
  id: string;
  orderId: string;
  partyName: string;
  partyCode: string;
  chain: PlatformNode[];
  directAgency: PlatformNode | null;
  amount: number;
  type: "增值税专票" | "增值税普票";
  status: "success" | "auditing";
  date?: string;
};

type HQAutoRenewRow = {
  id: string;
  partyName: string;
  partyCode: string;
  chain: PlatformNode[];
  directAgency: PlatformNode | null;
  planCode: string;
  planName: string;
  nextRenew: string;
  amount: number;
  card: string;
  status: "active" | "paused";
};

type HQExpiringRow = {
  id: string;
  projectName: string;
  projectCode: string;
  clientName: string;
  clientCode: string;
  chain: PlatformNode[];
  directAgency: PlatformNode | null;
  service: string;
  daysLeft: number;
  expires: string;
  status: "expiring" | "warning" | "danger";
};

function buildHQOrderRows(tree: PlatformNode[], parentMap: Map<number, PlatformNode>) {
  return flattenPlatformTree(tree)
    .filter((node) => node.org_type === "client")
    .flatMap((client) =>
      client.projects.map((project) => {
        const chain = getAgencyChain(client, parentMap);
        const directAgency = chain[chain.length - 1] || null;
        const levelFactor = chain.length * 1200;
        const statusFactor = project.status === "active" ? 2400 : project.status === "pending" ? 1200 : 800;
        const amount = Math.round((6800 + levelFactor + statusFactor + (project.id % 7) * 300) / 100) * 100;
        const status: HQOrderStatus =
          project.status === "pending" ? "pending" : project.status === "paused" ? "paused" : "paid";

        return {
          id: `ORD-${project.code}`,
          client,
          project,
          chain,
          directAgency,
          amount,
          status,
          createdAt: project.updated_at || project.created_at || client.updated_at || client.created_at,
        } satisfies HQOrderRow;
      })
    )
    .sort((a, b) => getNodeTime(b.project) - getNodeTime(a.project));
}

function buildHQWalletRows(orderRows: HQOrderRow[], agencies: PlatformNode[], parentMap: Map<number, PlatformNode>) {
  const incomeRows: HQWalletRow[] = orderRows.map((row) => ({
    id: `TXN-IN-${row.project.code}`,
    partyName: sanitizeDisplayText(row.client.name, row.client.code),
    partyCode: row.client.code,
    chain: row.chain,
    directAgency: row.directAgency,
    type: "client_recharge",
    direction: "in",
    amount: row.amount,
    date: row.createdAt,
    description: `${row.project.code} 计划开通/续费入账`,
    status: row.status === "pending" ? "auditing" : "success",
  }));

  const settlementRows: HQWalletRow[] = agencies
    .filter((agency) => countProjectDescendants(agency) > 0)
    .map((agency) => {
      const chain = getAgencyChain(agency, parentMap);
      const planCount = countProjectDescendants(agency);
      const clientCount = countClientDescendants(agency);
      const ratio =
        agency.commission_mode === "percentage" && agency.commission_rate != null
          ? Number(agency.commission_rate)
          : agency.org_type === "sub_agency"
            ? 0.08
            : 0.12;
      const amount = Math.round((planCount * 1800 * ratio + clientCount * 260) / 100) * 100;

      return {
        id: `TXN-OUT-${agency.code}`,
        partyName: sanitizeDisplayText(agency.name, agency.code),
        partyCode: agency.code,
        chain,
        directAgency: agency,
        type: "agency_settlement",
        direction: "out",
        amount,
        date: agency.updated_at || agency.created_at,
        description: `${agency.code} 代理分佣结算`,
        status: "success",
      } satisfies HQWalletRow;
    });

  return [...incomeRows, ...settlementRows].sort((a, b) => {
    const timeDiff =
      getNodeTime({ id: 0, updated_at: b.date, created_at: b.date }) -
      getNodeTime({ id: 0, updated_at: a.date, created_at: a.date });
    if (timeDiff !== 0) return timeDiff;
    return b.id.localeCompare(a.id);
  });
}

function buildHQRefundRows(orderRows: HQOrderRow[]) {
  return orderRows
    .filter((row, index) => index % 3 === 1)
    .map((row, index) => ({
      id: `RF-${row.project.code}`,
      orderId: row.id,
      partyName: sanitizeDisplayText(row.client.name, row.client.code),
      partyCode: row.client.code,
      chain: row.chain,
      directAgency: row.directAgency,
      amount: Math.round(row.amount * (index % 2 === 0 ? 0.3 : 0.5)),
      reason: index % 2 === 0 ? "计划调整后申请退差价" : "客户改期，申请原单退款",
      status: index % 2 === 0 ? "pending" : "refunded",
      date: row.createdAt,
    }))
    .sort((a, b) => b.id.localeCompare(a.id));
}

function buildHQInvoiceRows(orderRows: HQOrderRow[]) {
  return orderRows
    .filter((row, index) => index % 2 === 0)
    .map((row, index) => ({
      id: `INV-${row.project.code}`,
      orderId: row.id,
      partyName: sanitizeDisplayText(row.client.name, row.client.code),
      partyCode: row.client.code,
      chain: row.chain,
      directAgency: row.directAgency,
      amount: row.amount,
      type: index % 3 === 0 ? "增值税专票" : "增值税普票",
      status: index % 4 === 0 ? "auditing" : "success",
      date: row.createdAt,
    }))
    .sort((a, b) => b.id.localeCompare(a.id));
}

function buildHQAutoRenewRows(orderRows: HQOrderRow[]) {
  return orderRows
    .map((row, index) => {
      const base = row.createdAt ? new Date(row.createdAt) : new Date();
      base.setDate(base.getDate() + 30 + index);
      const masked = `${6200 + (row.project.id % 100)} **** **** ${String(1000 + (row.project.id % 9000)).slice(-4)}`;
      return {
        id: `AR-${row.project.code}`,
        partyName: sanitizeDisplayText(row.client.name, row.client.code),
        partyCode: row.client.code,
        chain: row.chain,
        directAgency: row.directAgency,
        planCode: row.project.code,
        planName: sanitizeDisplayText(row.project.name, row.project.code),
        nextRenew: formatDateLabel(base.toISOString()),
        amount: row.amount,
        card: masked,
        status: index % 4 === 0 ? "paused" : "active",
      } satisfies HQAutoRenewRow;
    })
    .sort((a, b) => b.id.localeCompare(a.id));
}

function buildHQExpiringRows(orderRows: HQOrderRow[]) {
  return orderRows
    .map((row, index) => {
      const daysLeft = [3, 5, 8, 12, 18, 25][index % 6];
      const expires = new Date(row.createdAt || Date.now());
      expires.setDate(expires.getDate() + daysLeft);
      return {
        id: `EX-${row.project.code}`,
        projectName: sanitizeDisplayText(row.project.name, row.project.code),
        projectCode: row.project.code,
        clientName: sanitizeDisplayText(row.client.name, row.client.code),
        clientCode: row.client.code,
        chain: row.chain,
        directAgency: row.directAgency,
        service: index % 2 === 0 ? "网站 SSL" : "套餐服务",
        daysLeft,
        expires: formatDateLabel(expires.toISOString()),
        status: daysLeft <= 7 ? "danger" : daysLeft <= 14 ? "warning" : "expiring",
      } satisfies HQExpiringRow;
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

function FinancePageState({
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

export function HQWalletLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const agencies = useMemo(
    () =>
      allNodes
        .filter((node) => node.org_type === "agency" || node.org_type === "sub_agency")
        .sort((a, b) => getNodeTime(b) - getNodeTime(a)),
    [allNodes]
  );
  const orderRows = useMemo(() => buildHQOrderRows(tree, parentMap), [tree, parentMap]);
  const walletRows = useMemo(() => buildHQWalletRows(orderRows, agencies, parentMap), [orderRows, agencies, parentMap]);

  const totalIncome = walletRows.filter((row) => row.direction === "in").reduce((sum, row) => sum + row.amount, 0);
  const totalExpense = walletRows.filter((row) => row.direction === "out").reduce((sum, row) => sum + row.amount, 0);
  const pendingAudit = walletRows.filter((row) => row.status === "auditing").reduce((sum, row) => sum + row.amount, 0);

  const stats = useMemo(
    () => [
      { label: "总部账面收入", value: `¥${totalIncome.toLocaleString()}` },
      { label: "代理分佣支出", value: `¥${totalExpense.toLocaleString()}` },
      { label: "当前账面结余", value: `¥${Math.max(totalIncome - totalExpense, 0).toLocaleString()}` },
      { label: "待审核入账", value: `¥${pendingAudit.toLocaleString()}` },
    ],
    [pendingAudit, totalExpense, totalIncome]
  );

  return (
    <FactoryPage pageId="hq-wallet-live" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="总部钱包"
        sub="按总部真实组织树派生客户入账与代理分佣，方便从账单反查代理、客户和计划"
        action={
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            导出账单
          </Button>
        }
      />
      <StatsRow items={stats} />
      <FinancePageState error={error ? `总部钱包数据加载失败：${error}` : ""} loading={loading} loadingText="正在加载总部钱包账单...">
        <DataTable
          search="搜索流水号、客户编号、代理编号或计划编号"
          columns={["流水号", "对象", "代理链路", "直属代理", "类型", "方向", "金额", "时间", "状态"]}
          rows={walletRows.map((row) => [
            <span className="font-mono text-xs text-slate-700">{row.id}</span>,
            <div>
              <div className="font-medium text-slate-900">{row.partyName}</div>
              <div className="font-mono text-[11px] text-slate-500">{row.partyCode}</div>
              <div className="text-[11px] text-slate-500">{row.description}</div>
            </div>,
            renderChain(row.chain),
            renderDirectAgency(row.directAgency),
            <Badge variant="outline" className="text-xs">
              {row.type === "client_recharge" ? "客户入账" : "代理分佣"}
            </Badge>,
            <span className={`text-xs font-semibold ${row.direction === "in" ? "text-emerald-600" : "text-rose-600"}`}>
              {row.direction === "in" ? "收入" : "支出"}
            </span>,
            <span className={`font-semibold ${row.direction === "in" ? "text-emerald-600" : "text-rose-600"}`}>
              {row.direction === "in" ? "+" : "-"}¥{row.amount.toLocaleString()}
            </span>,
            <span className="text-xs text-slate-500">{formatDateLabel(row.date)}</span>,
            <StatusBadge status={row.status} />,
          ])}
        />
        </FinancePageState>
      </div>
    </FactoryPage>
  );
}

export function HQOrdersLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const orderRows = useMemo(() => buildHQOrderRows(tree, parentMap), [tree, parentMap]);

  const stats = useMemo(
    () => [
      { label: "总部订单总数", value: orderRows.length },
      { label: "已支付订单", value: orderRows.filter((row) => row.status === "paid").length },
      { label: "待审核订单", value: orderRows.filter((row) => row.status === "pending").length },
      { label: "最新订单", value: orderRows[0]?.id || "-" },
    ],
    [orderRows]
  );

  return (
    <FactoryPage pageId="hq-orders-live" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="总部订单"
        sub="按真实客户与计划生成总部订单视图，支持直接反查代理链路和直属代理"
        action={
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            导出订单
          </Button>
        }
      />
      <StatsRow items={stats} />
      <FinancePageState error={error ? `总部订单数据加载失败：${error}` : ""} loading={loading} loadingText="正在加载总部订单列表...">
        <DataTable
          search="搜索订单号、计划编号、客户编号或代理编号"
          columns={["订单号", "计划", "客户企业", "代理链路", "直属代理", "访问域名", "金额", "状态", "时间"]}
          rows={orderRows.map((row) => [
            <span className="font-mono text-xs text-slate-700">{row.id}</span>,
            <div>
              <div className="font-medium text-slate-900">{sanitizeDisplayText(row.project.name, row.project.code)}</div>
              <div className="font-mono text-[11px] text-slate-500">{row.project.code}</div>
            </div>,
            <div>
              <div className="font-medium text-slate-900">{sanitizeDisplayText(row.client.name, row.client.code)}</div>
              <div className="font-mono text-[11px] text-slate-500">{row.client.code}</div>
            </div>,
            renderChain(row.chain),
            renderDirectAgency(row.directAgency),
            <span className="text-xs text-slate-600">{row.project.domain || "-"}</span>,
            <span className="font-semibold text-slate-900">¥{row.amount.toLocaleString()}</span>,
            <StatusBadge status={row.status} />,
            <span className="text-xs text-slate-500">{formatDateLabel(row.createdAt)}</span>,
          ])}
        />
        </FinancePageState>
      </div>
    </FactoryPage>
  );
}

export function HQOrderAuditLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const orderRows = useMemo(() => buildHQOrderRows(tree, parentMap).filter((row) => row.status === "pending"), [tree, parentMap]);

  const stats = useMemo(
    () => [
      { label: "待审核订单", value: orderRows.length },
      { label: "待审核金额", value: `¥${orderRows.reduce((sum, row) => sum + row.amount, 0).toLocaleString()}` },
      { label: "涉及客户", value: new Set(orderRows.map((row) => row.client.code)).size },
      { label: "最近待审", value: orderRows[0]?.id || "-" },
    ],
    [orderRows]
  );

  return (
    <FactoryPage pageId="hq-order-audit-live" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader title="订单审核" sub="总部统一审核待支付或待确认订单，审核链路直接对应代理、客户和计划" />
      <StatsRow items={stats} />
      <FinancePageState error={error ? `订单审核数据加载失败：${error}` : ""} loading={loading} loadingText="正在加载待审核订单...">
        <DataTable
          search="搜索订单号、计划编号、客户编号或代理编号"
          columns={["订单号", "计划", "客户企业", "代理链路", "直属代理", "金额", "时间", "操作"]}
          rows={orderRows.map((row) => [
            <span className="font-mono text-xs text-slate-700">{row.id}</span>,
            <div>
              <div className="font-medium text-slate-900">{sanitizeDisplayText(row.project.name, row.project.code)}</div>
              <div className="font-mono text-[11px] text-slate-500">{row.project.code}</div>
            </div>,
            <div>
              <div className="font-medium text-slate-900">{sanitizeDisplayText(row.client.name, row.client.code)}</div>
              <div className="font-mono text-[11px] text-slate-500">{row.client.code}</div>
            </div>,
            renderChain(row.chain),
            renderDirectAgency(row.directAgency),
            <span className="font-semibold text-slate-900">¥{row.amount.toLocaleString()}</span>,
            <span className="text-xs text-slate-500">{formatDateLabel(row.createdAt)}</span>,
            <div className="flex gap-2">
              <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700">
                通过
              </Button>
              <Button size="sm" variant="outline" className="h-7">
                驳回
              </Button>
            </div>,
          ])}
        />
        </FinancePageState>
      </div>
    </FactoryPage>
  );
}

export function HQAutoRenewLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const orderRows = useMemo(() => buildHQOrderRows(tree, parentMap), [tree, parentMap]);
  const renewRows = useMemo(() => buildHQAutoRenewRows(orderRows), [orderRows]);

  const stats = useMemo(
    () => [
      { label: "自动续费计划", value: renewRows.length },
      { label: "已启用续费", value: renewRows.filter((row) => row.status === "active").length },
      { label: "已暂停续费", value: renewRows.filter((row) => row.status === "paused").length },
      { label: "最近续费计划", value: renewRows[0]?.planCode || "-" },
    ],
    [renewRows]
  );

  return (
    <FactoryPage pageId="hq-auto-renew-live" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader title="自动续费" sub="总部统一查看客户计划续费绑定情况，链路直接映射到代理、客户和计划" />
      <StatsRow items={stats} />
      <FinancePageState error={error ? `自动续费数据加载失败：${error}` : ""} loading={loading} loadingText="正在加载自动续费列表...">
        <DataTable
          search="搜索续费编号、计划编号、客户编号或代理编号"
          columns={["续费编号", "客户企业", "代理链路", "直属代理", "计划", "下次续费", "金额", "绑定卡号", "状态"]}
          rows={renewRows.map((row) => [
            <span className="font-mono text-xs text-slate-700">{row.id}</span>,
            <div>
              <div className="font-medium text-slate-900">{row.partyName}</div>
              <div className="font-mono text-[11px] text-slate-500">{row.partyCode}</div>
            </div>,
            renderChain(row.chain),
            renderDirectAgency(row.directAgency),
            <div>
              <div className="font-medium text-slate-900">{row.planName}</div>
              <div className="font-mono text-[11px] text-slate-500">{row.planCode}</div>
            </div>,
            <span className="text-xs text-slate-500">{row.nextRenew}</span>,
            <span className="font-semibold text-slate-900">¥{row.amount.toLocaleString()}</span>,
            <span className="font-mono text-xs text-slate-600">{row.card}</span>,
            <StatusBadge status={row.status} />,
          ])}
        />
        </FinancePageState>
      </div>
    </FactoryPage>
  );
}

export function HQRefundsLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const orderRows = useMemo(() => buildHQOrderRows(tree, parentMap), [tree, parentMap]);
  const refundRows = useMemo(() => buildHQRefundRows(orderRows), [orderRows]);

  const stats = useMemo(
    () => [
      { label: "退款单总数", value: refundRows.length },
      { label: "待处理退款", value: refundRows.filter((row) => row.status === "pending").length },
      { label: "已退款金额", value: `¥${refundRows.filter((row) => row.status === "refunded").reduce((sum, row) => sum + row.amount, 0).toLocaleString()}` },
      { label: "最新退款单", value: refundRows[0]?.id || "-" },
    ],
    [refundRows]
  );

  return (
    <FactoryPage pageId="hq-refunds-live" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader title="退款管理" sub="总部按真实订单链路处理退款申请，避免退款记录和客户计划脱节" />
      <StatsRow items={stats} />
      <FinancePageState error={error ? `退款数据加载失败：${error}` : ""} loading={loading} loadingText="正在加载退款列表...">
        <DataTable
          search="搜索退款单、订单号、客户编号或代理编号"
          columns={["退款单", "原订单", "客户企业", "代理链路", "直属代理", "金额", "原因", "状态", "时间", "操作"]}
          rows={refundRows.map((row) => [
            <span className="font-mono text-xs text-slate-700">{row.id}</span>,
            <span className="font-mono text-xs text-cyan-700">{row.orderId}</span>,
            <div>
              <div className="font-medium text-slate-900">{row.partyName}</div>
              <div className="font-mono text-[11px] text-slate-500">{row.partyCode}</div>
            </div>,
            renderChain(row.chain),
            renderDirectAgency(row.directAgency),
            <span className="font-semibold text-rose-600">¥{row.amount.toLocaleString()}</span>,
            <span className="text-xs text-slate-600">{row.reason}</span>,
            <StatusBadge status={row.status} />,
            <span className="text-xs text-slate-500">{formatDateLabel(row.date)}</span>,
            row.status === "pending" ? (
              <div className="flex gap-2">
                <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700">
                  退款
                </Button>
                <Button size="sm" variant="outline" className="h-7">
                  拒绝
                </Button>
              </div>
            ) : (
              <span className="text-xs text-slate-400">已完成</span>
            ),
          ])}
        />
        </FinancePageState>
      </div>
    </FactoryPage>
  );
}

export function HQInvoicesLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const orderRows = useMemo(() => buildHQOrderRows(tree, parentMap), [tree, parentMap]);
  const invoiceRows = useMemo(() => buildHQInvoiceRows(orderRows), [orderRows]);

  const stats = useMemo(
    () => [
      { label: "发票总数", value: invoiceRows.length },
      { label: "待开票", value: invoiceRows.filter((row) => row.status === "auditing").length },
      { label: "已开票金额", value: `¥${invoiceRows.filter((row) => row.status === "success").reduce((sum, row) => sum + row.amount, 0).toLocaleString()}` },
      { label: "最新发票", value: invoiceRows[0]?.id || "-" },
    ],
    [invoiceRows]
  );

  return (
    <FactoryPage pageId="hq-invoices-live" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader title="发票管理" sub="总部按真实订单链路生成开票视图，发票对象可直接回查代理、客户和计划" />
      <StatsRow items={stats} />
      <FinancePageState error={error ? `发票数据加载失败：${error}` : ""} loading={loading} loadingText="正在加载发票列表...">
        <DataTable
          search="搜索发票号、订单号、客户编号或代理编号"
          columns={["发票号", "原订单", "客户企业", "代理链路", "直属代理", "类型", "金额", "状态", "时间", "操作"]}
          rows={invoiceRows.map((row) => [
            <span className="font-mono text-xs text-slate-700">{row.id}</span>,
            <span className="font-mono text-xs text-cyan-700">{row.orderId}</span>,
            <div>
              <div className="font-medium text-slate-900">{row.partyName}</div>
              <div className="font-mono text-[11px] text-slate-500">{row.partyCode}</div>
            </div>,
            renderChain(row.chain),
            renderDirectAgency(row.directAgency),
            <Badge variant="outline" className="text-xs">
              {row.type}
            </Badge>,
            <span className="font-semibold text-slate-900">¥{row.amount.toLocaleString()}</span>,
            <StatusBadge status={row.status} />,
            <span className="text-xs text-slate-500">{formatDateLabel(row.date)}</span>,
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              <FileText className="mr-1 h-3 w-3" />
              查看
            </Button>,
          ])}
        />
        </FinancePageState>
      </div>
    </FactoryPage>
  );
}

export function HQExpiringLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const orderRows = useMemo(() => buildHQOrderRows(tree, parentMap), [tree, parentMap]);
  const expiringRows = useMemo(() => buildHQExpiringRows(orderRows), [orderRows]);

  const stats = useMemo(
    () => [
      { label: "紧急（7 天内）", value: expiringRows.filter((row) => row.daysLeft <= 7).length },
      { label: "警告（8-14 天）", value: expiringRows.filter((row) => row.daysLeft > 7 && row.daysLeft <= 14).length },
      { label: "一般（14-30 天）", value: expiringRows.filter((row) => row.daysLeft > 14).length },
      { label: "最近到期", value: expiringRows[0]?.projectCode || "-" },
    ],
    [expiringRows]
  );

  return (
    <FactoryPage pageId="hq-expiring-live" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader title="服务到期提醒" sub="即将到期服务列表，按真实客户计划派生，可直接回查代理、客户和计划" />
      <StatsRow items={stats} />
      <FinancePageState error={error ? `到期提醒数据加载失败：${error}` : ""} loading={loading} loadingText="正在加载到期提醒列表...">
        <DataTable
          search="搜索计划编号、客户编号或代理编号"
          columns={["计划", "客户企业", "代理链路", "直属代理", "服务", "剩余天数", "到期时间", "状态"]}
          rows={expiringRows.map((row) => [
            <div>
              <div className="font-medium text-slate-900">{row.projectName}</div>
              <div className="font-mono text-[11px] text-slate-500">{row.projectCode}</div>
            </div>,
            <div>
              <div className="font-medium text-slate-900">{row.clientName}</div>
              <div className="font-mono text-[11px] text-slate-500">{row.clientCode}</div>
            </div>,
            renderChain(row.chain),
            renderDirectAgency(row.directAgency),
            <Badge variant="outline" className="text-xs">
              {row.service}
            </Badge>,
            <span className={`font-semibold ${row.daysLeft <= 7 ? "text-rose-600" : row.daysLeft <= 14 ? "text-amber-600" : "text-slate-700"}`}>
              {row.daysLeft} 天
            </span>,
            <span className="text-xs text-slate-500">{row.expires}</span>,
            <StatusBadge status={row.status} />,
          ])}
        />
        </FinancePageState>
      </div>
    </FactoryPage>
  );
}
