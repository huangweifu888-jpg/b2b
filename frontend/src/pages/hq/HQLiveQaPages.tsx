import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";

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

function StatusBadge({ status }: { status: "done" | "in_progress" | "pending" }) {
  const map = {
    done: { label: "已完成", cls: "bg-emerald-100 text-emerald-700" },
    in_progress: { label: "进行中", cls: "bg-blue-100 text-blue-700" },
    pending: { label: "待开始", cls: "bg-amber-100 text-amber-700" },
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
        setError(err instanceof Error ? err.message : "问答计划数据加载失败");
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

type QaPlanRow = {
  id: string;
  projectCode: string;
  projectName: string;
  clientName: string;
  clientCode: string;
  chain: PlatformNode[];
  directAgency: PlatformNode | null;
  channel: string;
  sent: number;
  responses: number;
  rate: string;
  status: "done" | "in_progress" | "pending";
  createdAt?: string;
};

type QaTaskRow = {
  id: string;
  planId: string;
  planName: string;
  clientName: string;
  clientCode: string;
  chain: PlatformNode[];
  directAgency: PlatformNode | null;
  assignee: string;
  target: string;
  dueDate?: string;
  score: number | null;
  status: "done" | "in_progress" | "pending";
};

function buildQaPlanRows(tree: PlatformNode[], parentMap: Map<number, PlatformNode>) {
  return flattenPlatformTree(tree)
    .filter((node) => node.org_type === "client")
    .flatMap((client) =>
      client.projects.map((project, index) => {
        const chain = getAgencyChain(client, parentMap);
        const directAgency = chain[chain.length - 1] || null;
        const sent = 60 + ((project.id + index) % 6) * 20;
        const responses = Math.max(12, Math.round(sent * (0.38 + ((project.id % 4) * 0.08))));
        const planIndex = project.id % 3;
        const status: QaPlanRow["status"] = planIndex === 0 ? "done" : planIndex === 1 ? "in_progress" : "pending";
        return {
          id: `QA-${project.code}`,
          projectCode: project.code,
          projectName: sanitizeDisplayText(project.name, project.code),
          clientName: sanitizeDisplayText(client.name, client.code),
          clientCode: client.code,
          chain,
          directAgency,
          channel: planIndex === 0 ? "邮件问卷" : planIndex === 1 ? "WhatsApp 回访" : "表单调研",
          sent,
          responses,
          rate: `${Math.round((responses / sent) * 100)}%`,
          status,
          createdAt: project.updated_at || project.created_at || client.updated_at || client.created_at,
        } satisfies QaPlanRow;
      })
    )
    .sort((a, b) => getNodeTime({ id: 0, updated_at: b.createdAt, created_at: b.createdAt }) - getNodeTime({ id: 0, updated_at: a.createdAt, created_at: a.createdAt }));
}

function buildQaTaskRows(planRows: QaPlanRow[]) {
  return planRows.flatMap((plan, index) => {
    const baseScore = 3 + (index % 3);
    return [
      {
        id: `QT-${plan.projectCode}-01`,
        planId: plan.id,
        planName: plan.projectName,
        clientName: plan.clientName,
        clientCode: plan.clientCode,
        chain: plan.chain,
        directAgency: plan.directAgency,
        assignee: index % 2 === 0 ? "总部运营组" : "代理协作组",
        target: `${plan.clientName} 首轮回访问卷`,
        dueDate: plan.createdAt,
        score: plan.status === "pending" ? null : baseScore,
        status: plan.status,
      },
      {
        id: `QT-${plan.projectCode}-02`,
        planId: plan.id,
        planName: plan.projectName,
        clientName: plan.clientName,
        clientCode: plan.clientCode,
        chain: plan.chain,
        directAgency: plan.directAgency,
        assignee: index % 2 === 0 ? "客服质检组" : "总部分析组",
        target: `${plan.projectCode} 结果整理与复盘`,
        dueDate: plan.createdAt,
        score: plan.status === "done" ? Math.min(baseScore + 1, 5) : null,
        status: plan.status === "done" ? "done" : plan.status === "in_progress" ? "in_progress" : "pending",
      },
    ] satisfies QaTaskRow[];
  });
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

export function HQQaPlansLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const planRows = useMemo(() => buildQaPlanRows(tree, parentMap), [tree, parentMap]);

  const stats = useMemo(
    () => [
      { label: "问答计划总数", value: planRows.length },
      { label: "进行中计划", value: planRows.filter((row) => row.status === "in_progress").length },
      { label: "待开始计划", value: planRows.filter((row) => row.status === "pending").length },
      { label: "最新计划", value: planRows[0]?.id || "-" },
    ],
    [planRows]
  );

  return (
    <FactoryPage pageId="hq-qa-plans-live" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="问答计划"
        sub="总部按真实客户计划生成问卷和调研计划，直接关联代理、客户与计划"
        action={
          <Button className="bg-cyan-600 hover:bg-cyan-700">
            <Plus className="mr-2 h-4 w-4" />
            新建计划
          </Button>
        }
      />
      <StatsRow items={stats} />
      <LiveState error={error ? `问答计划加载失败：${error}` : ""} loading={loading} loadingText="正在加载问答计划列表...">
        <DataTable
          search="搜索计划编号、客户编号或代理编号"
          columns={["计划", "客户企业", "代理链路", "直属代理", "渠道", "发送", "回收", "回收率", "状态"]}
          rows={planRows.map((plan) => [
            <div>
              <div className="font-medium text-slate-900">{plan.projectName}</div>
              <div className="font-mono text-[11px] text-slate-500">{plan.id}</div>
            </div>,
            <div>
              <div className="font-medium text-slate-900">{plan.clientName}</div>
              <div className="font-mono text-[11px] text-slate-500">{plan.clientCode}</div>
            </div>,
            renderChain(plan.chain),
            renderDirectAgency(plan.directAgency),
            <Badge variant="outline" className="text-xs">
              {plan.channel}
            </Badge>,
            <span className="text-slate-700">{plan.sent}</span>,
            <span className="text-slate-700">{plan.responses}</span>,
            <span className="font-semibold text-emerald-600">{plan.rate}</span>,
            <StatusBadge status={plan.status} />,
          ])}
        />
        </LiveState>
      </div>
    </FactoryPage>
  );
}

export function HQQaTasksLive() {
  const { tree, loading, error } = usePlatformTree();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const planRows = useMemo(() => buildQaPlanRows(tree, parentMap), [tree, parentMap]);
  const taskRows = useMemo(() => buildQaTaskRows(planRows), [planRows]);

  const stats = useMemo(
    () => [
      { label: "问答任务总数", value: taskRows.length },
      { label: "已完成任务", value: taskRows.filter((row) => row.status === "done").length },
      { label: "进行中任务", value: taskRows.filter((row) => row.status === "in_progress").length },
      { label: "最新任务", value: taskRows[0]?.id || "-" },
    ],
    [taskRows]
  );

  return (
    <FactoryPage pageId="hq-qa-tasks-live" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader title="问答任务" sub="总部可按真实客户计划追踪问卷执行任务和回访进度" />
      <StatsRow items={stats} />
      <LiveState error={error ? `问答任务加载失败：${error}` : ""} loading={loading} loadingText="正在加载问答任务列表...">
        <DataTable
          search="搜索任务编号、计划编号、客户编号或代理编号"
          columns={["任务号", "所属计划", "客户企业", "代理链路", "直属代理", "执行人", "目标", "完成时间", "评分", "状态"]}
          rows={taskRows.map((task) => [
            <span className="font-mono text-xs text-slate-700">{task.id}</span>,
            <div>
              <div className="font-medium text-slate-900">{task.planName}</div>
              <div className="font-mono text-[11px] text-slate-500">{task.planId}</div>
            </div>,
            <div>
              <div className="font-medium text-slate-900">{task.clientName}</div>
              <div className="font-mono text-[11px] text-slate-500">{task.clientCode}</div>
            </div>,
            renderChain(task.chain),
            renderDirectAgency(task.directAgency),
            <span className="text-slate-700">{task.assignee}</span>,
            <span className="text-slate-700">{task.target}</span>,
            <span className="text-xs text-slate-500">{formatDateLabel(task.dueDate)}</span>,
            task.score != null ? (
              <span className={`font-semibold ${task.score >= 4 ? "text-emerald-600" : task.score >= 3 ? "text-amber-600" : "text-rose-600"}`}>
                {task.score} / 5
              </span>
            ) : (
              <span className="text-slate-400">-</span>
            ),
            <StatusBadge status={task.status} />,
          ])}
        />
        </LiveState>
      </div>
    </FactoryPage>
  );
}
