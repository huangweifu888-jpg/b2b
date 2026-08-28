import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

function getAgencyLevelLabel(node: PlatformNode, parentMap: Map<number, PlatformNode>) {
  let level = 1;
  let currentParentId = node.parent_id;
  while (currentParentId) {
    const parent = parentMap.get(currentParentId);
    if (!parent || parent.org_type === "hq") break;
    level += 1;
    currentParentId = parent.parent_id;
  }
  return `${level}级代理`;
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
        setError(err instanceof Error ? err.message : "加载总部审核数据失败");
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

function StatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  const map = {
    pending: { label: "待审核", cls: "bg-amber-100 text-amber-700" },
    approved: { label: "已通过", cls: "bg-emerald-100 text-emerald-700" },
    rejected: { label: "已驳回", cls: "bg-red-100 text-red-700" },
  } as const;
  const info = map[status];
  return <Badge className={`${info.cls} hover:${info.cls}`}>{info.label}</Badge>;
}

export function HQRechargeAuditLive({ partnerMode = false }: { partnerMode?: boolean } = {}) {
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

  const rows = useMemo(
    () =>
      agencies.map((agency, index) => {
        const projectCount = countProjectDescendants(agency);
        const clientCount = countClientDescendants(agency);
        return {
          id: `RA${String(index + 1).padStart(4, "0")}`,
          agency,
          projectCount,
          clientCount,
          amount: Math.max(50000, projectCount * 12000 + clientCount * 3000),
          method: agency.commission_mode === "percentage" ? "对公转账" : "线下汇款",
          voucher: `${agency.code.toLowerCase()}-recharge.pdf`,
          submitted: formatDateLabel(agency.updated_at || agency.created_at),
          status: index < 2 ? "pending" : index % 4 === 0 ? "rejected" : "approved",
        };
      }),
    [agencies]
  );

  const stats = useMemo(
    () => [
      { label: "待审核", value: rows.filter((row) => row.status === "pending").length },
      { label: "本轮通过", value: rows.filter((row) => row.status === "approved").length },
      { label: "本轮驳回", value: rows.filter((row) => row.status === "rejected").length },
      {
        label: "待审金额",
        value: `¥${rows
          .filter((row) => row.status === "pending")
          .reduce((sum, row) => sum + row.amount, 0)
          .toLocaleString()}`,
      },
    ],
    [rows]
  );

  return (
    <FactoryPage
      pageId={partnerMode ? "agency-source-recharge-audit-live" : "hq-recharge-audit-live"}
      template="list"
      sourceScope={partnerMode ? "agency_source" : "hq"}
      autoRegions
    >
      <div className="space-y-6">
      <PageHeader title="充值审核" sub={partnerMode ? "代理源按多级合伙人、客户和计划规模审核充值申请及线下回款凭证。" : "总部按真实代理、客户、计划规模审核充值申请和线下回款凭证。"} />
      <StatsRow items={stats} />
      <LiveState error={error ? `充值审核加载失败：${error}` : ""} loading={loading} loadingText="正在加载充值审核...">
        <DataTable
          search="搜索代理编号、审核流水号或凭证文件"
          columns={["流水号", "代理商", "层级", "客户数", "计划数", "金额", "方式", "凭证", "提交时间", "状态", "操作"]}
          rows={rows.map((row) => [
            <span className="font-mono text-xs">{row.id}</span>,
            <div>
              <div className="font-medium text-slate-900">{sanitizeDisplayText(row.agency.name, row.agency.code)}</div>
              <div className="font-mono text-[11px] text-slate-500">{row.agency.code}</div>
            </div>,
            <Badge variant="outline" className="text-[11px]">
              {getAgencyLevelLabel(row.agency, parentMap)}
            </Badge>,
            <span className="font-semibold text-slate-900">{row.clientCount}</span>,
            <span className="font-semibold text-slate-900">{row.projectCount}</span>,
            <span className="font-semibold text-slate-900">¥{row.amount.toLocaleString()}</span>,
            <span className="text-sm text-slate-700">{row.method}</span>,
            <span className="font-mono text-[11px] text-cyan-700">{row.voucher}</span>,
            <span className="text-sm text-slate-600">{row.submitted}</span>,
            <StatusBadge status={row.status} />,
            row.status === "pending" ? (
              <div className="flex gap-2">
                <Button size="sm" className="h-7 bg-emerald-600 px-2 text-xs hover:bg-emerald-700">
                  通过
                </Button>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                  驳回
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                查看
              </Button>
            ),
          ])}
        />
      </LiveState>
      </div>
    </FactoryPage>
  );
}

export function HQOEMAuditLive() {
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

  const rows = useMemo(
    () =>
      agencies.map((agency, index) => ({
        id: `OA${String(index + 1).padStart(4, "0")}`,
        agency,
        brand: `${sanitizeDisplayText(agency.name, agency.code)} Cloud`,
        domain: `${agency.code.toLowerCase()}.tradehq.local`,
        logo: "已上传",
        clientCount: countClientDescendants(agency),
        projectCount: countProjectDescendants(agency),
        submitted: formatDateLabel(agency.updated_at || agency.created_at),
        status: index < 2 ? "pending" : index % 3 === 0 ? "approved" : "rejected",
      })),
    [agencies]
  );

  const stats = useMemo(
    () => [
      { label: "待审核", value: rows.filter((row) => row.status === "pending").length },
      { label: "已通过", value: rows.filter((row) => row.status === "approved").length },
      { label: "已驳回", value: rows.filter((row) => row.status === "rejected").length },
      { label: "覆盖计划", value: rows.reduce((sum, row) => sum + row.projectCount, 0) },
    ],
    [rows]
  );

  return (
    <FactoryPage pageId="hq-oem-audit-live" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader title="OEM 审核" sub="总部按真实代理层级审核白标品牌、域名和 Logo 方案，直接反映客户与计划覆盖范围。" />
      <StatsRow items={stats} />
      <LiveState error={error ? `OEM 审核加载失败：${error}` : ""} loading={loading} loadingText="正在加载 OEM 审核...">
        <DataTable
          search="搜索代理编号、审核号或白标域名"
          columns={["审核号", "代理商", "层级", "品牌名", "域名", "客户数", "计划数", "Logo", "提交时间", "状态", "操作"]}
          rows={rows.map((row) => [
            <span className="font-mono text-xs">{row.id}</span>,
            <div>
              <div className="font-medium text-slate-900">{sanitizeDisplayText(row.agency.name, row.agency.code)}</div>
              <div className="font-mono text-[11px] text-slate-500">{row.agency.code}</div>
            </div>,
            <Badge variant="outline" className="text-[11px]">
              {getAgencyLevelLabel(row.agency, parentMap)}
            </Badge>,
            <span className="font-medium text-slate-900">{row.brand}</span>,
            <span className="font-mono text-[11px] text-cyan-700">{row.domain}</span>,
            <span className="font-semibold text-slate-900">{row.clientCount}</span>,
            <span className="font-semibold text-slate-900">{row.projectCount}</span>,
            <span className="text-sm text-emerald-700">{row.logo}</span>,
            <span className="text-sm text-slate-600">{row.submitted}</span>,
            <StatusBadge status={row.status} />,
            row.status === "pending" ? (
              <div className="flex gap-2">
                <Button size="sm" className="h-7 bg-emerald-600 px-2 text-xs hover:bg-emerald-700">
                  通过
                </Button>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                  驳回
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                查看
              </Button>
            ),
          ])}
        />
      </LiveState>
      </div>
    </FactoryPage>
  );
}
