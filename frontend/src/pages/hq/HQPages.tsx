// Consolidated HQ pages - all admin-style list/detail pages
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Search, Download, Edit3, MoreHorizontal, Check, X, Copy, Upload,
  DollarSign, TrendingUp, AlertTriangle, CheckCircle2,
  Globe, Key, Cpu, FileText, Wallet, Tag, Mail, Bell,
  Shield, Sparkles, Users, Image as ImageIcon,
} from "lucide-react";
import * as M from "@/lib/hq-mock";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { platformApi, type PlatformNode } from "@/lib/platform-api";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";

// ==================== 共用组件 ====================

function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-slate-900">{sanitizeDisplayText(title, "总部后台")}</h1>
        {sub && <p className="mt-1 text-sm text-slate-500">{sanitizeDisplayText(sub)}</p>}
      </div>
      {action}
    </div>
  );
}

function StatsRow({ items }: { items: Array<{ label: string; value: string | number; color?: string }> }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((s) => (
        <Card key={s.label} className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-xs text-slate-500">{sanitizeDisplayText(s.label, "统计项")}</div>
            <div className={`text-2xl font-bold ${s.color || "text-slate-900"}`}>{s.value}</div>
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
        {search && (
          <div className="p-4 border-b border-slate-200 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <Input placeholder={sanitizeDisplayText(search, "搜索")} className="h-8 border-0 focus-visible:ring-0 shadow-none flex-1" />
            <Button variant="outline" size="sm">筛选</Button>
          </div>
        )}
        <div className="responsive-table-wrap">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="text-left py-3 px-4 font-medium whitespace-nowrap">{sanitizeDisplayText(c, "字段")}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                  {r.map((cell, j) => <td key={j} className="py-3 px-4">{cell}</td>)}
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
    approved: { label: "已通过", cls: "bg-emerald-100 text-emerald-700" },
    rejected: { label: "已拒绝", cls: "bg-red-100 text-red-700" },
    disabled: { label: "已禁用", cls: "bg-slate-100 text-slate-700" },
    paused: { label: "已暂停", cls: "bg-slate-100 text-slate-700" },
    trial: { label: "试用中", cls: "bg-blue-100 text-blue-700" },
    online: { label: "在线", cls: "bg-emerald-100 text-emerald-700" },
    building: { label: "建设中", cls: "bg-amber-100 text-amber-700" },
    success: { label: "成功", cls: "bg-emerald-100 text-emerald-700" },
    error: { label: "失败", cls: "bg-red-100 text-red-700" },
    paid: { label: "已支付", cls: "bg-emerald-100 text-emerald-700" },
    auditing: { label: "审核中", cls: "bg-amber-100 text-amber-700" },
    refunded: { label: "已退款", cls: "bg-blue-100 text-blue-700" },
    issued: { label: "已开具", cls: "bg-emerald-100 text-emerald-700" },
    published: { label: "已发布", cls: "bg-emerald-100 text-emerald-700" },
    draft: { label: "草稿", cls: "bg-slate-100 text-slate-700" },
    scheduled: { label: "待开始", cls: "bg-blue-100 text-blue-700" },
    done: { label: "已完成", cls: "bg-emerald-100 text-emerald-700" },
    in_progress: { label: "进行中", cls: "bg-blue-100 text-blue-700" },
    running: { label: "运行中", cls: "bg-blue-100 text-blue-700" },
    warning: { label: "告警", cls: "bg-amber-100 text-amber-700" },
    danger: { label: "紧急", cls: "bg-red-100 text-red-700" },
    ok: { label: "正常", cls: "bg-emerald-100 text-emerald-700" },
    expired: { label: "已过期", cls: "bg-slate-100 text-slate-700" },
    expiring: { label: "即将到期", cls: "bg-amber-100 text-amber-700" },
    failed: { label: "失败", cls: "bg-red-100 text-red-700" },
  };
  const info = map[status] || { label: sanitizeDisplayText(status, "未知"), cls: "bg-slate-100 text-slate-700" };
  return <Badge className={`${info.cls} hover:${info.cls}`}>{info.label}</Badge>;
}

function TableActions() {
  return (
    <div className="flex gap-1">
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Edit3 className="w-3.5 h-3.5" /></Button>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
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
  const time = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(time) ? time : node.id;
}

function countClientDescendants(node: PlatformNode) {
  let total = node.org_type === "client" ? 1 : 0;
  node.children.forEach((child) => {
    total += countClientDescendants(child);
  });
  return total;
}

function countProjectDescendants(node: PlatformNode) {
  let total = node.projects.length;
  node.children.forEach((child) => {
    total += countProjectDescendants(child);
  });
  return total;
}

function getAgencyLevelLabel(node: PlatformNode, parentMap: Map<number, PlatformNode>) {
  if (node.org_type === "hq") return "总部";
  if (node.org_type === "client") return "客户端";

  let level = 1;
  let currentParentId = node.parent_id;
  while (currentParentId) {
    const parent = parentMap.get(currentParentId);
    if (!parent || parent.org_type === "hq") {
      break;
    }
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
        setError(err instanceof Error ? err.message : "加载失败");
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

// ==================== 账号管理 ====================

export function HQMembers() {
  return (
    <div className="space-y-6">
      <PageHeader title="平台成员列表" sub="总部账号管理" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Plus className="w-4 h-4 mr-2" />新增成员</Button>} />
      <DataTable
        search="搜索成员姓名、邮箱、角色..."
        columns={["成员", "角色", "部门", "最后登录", "状态", "操作"]}
        rows={M.hqMembers.map((m) => [
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-white text-xs font-bold">{m.name.slice(0, 1)}</div>
            <div><div className="font-medium text-slate-900">{m.name}</div><div className="text-[11px] text-slate-500">{m.email}</div></div>
          </div>,
          <Badge variant="outline" className="text-xs">{m.role}</Badge>,
          m.dept,
          <span className="text-xs text-slate-500">{m.lastLogin}</span>,
          <StatusBadge status={m.status} />,
          <TableActions />,
        ])}
      />
    </div>
  );
}

export function HQRoles() {
  return (
    <div className="space-y-6">
      <PageHeader title="角色管理" sub="总部内部角色与权限" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Plus className="w-4 h-4 mr-2" />新增角色</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {M.hqRoles.map((r) => (
          <Card key={r.id} className="border-slate-200 hover:shadow-md transition">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <Badge variant="outline" className="text-xs"><Users className="w-3 h-3 mr-1" />{r.members}</Badge>
              </div>
              <div className="font-semibold">{r.name}</div>
              <div className="text-xs text-slate-500 mt-1 mb-3">{r.desc}</div>
              <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100">
                <span className="text-slate-500">权限点数</span>
                <span className="font-semibold text-cyan-600">{r.permissions}</span>
              </div>
              <Button variant="outline" size="sm" className="w-full mt-3 h-7 text-xs"><Edit3 className="w-3 h-3 mr-1" />编辑权限</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function HQDepts() {
  return (
    <div className="space-y-6">
      <PageHeader title="部门管理" sub="组织架构与层级" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Plus className="w-4 h-4 mr-2" />新建部门</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {M.hqDepts.map((d) => (
          <Card key={d.id} className="border-slate-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-semibold">{d.name}</div>
                  <div className="text-xs text-slate-500">负责人：{d.manager} · {d.members} 人</div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Edit3 className="w-3.5 h-3.5" /></Button>
              </div>
              <div className="text-xs text-slate-500 mb-2">下属团队</div>
              <div className="flex flex-wrap gap-1.5">
                {d.children.map((c) => <Badge key={c} variant="outline" className="text-xs bg-slate-50">{c}</Badge>)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ==================== 代理商管理 ====================

export function HQAgencies() {
  const levelColor: Record<string, string> = { 钻石: "bg-violet-100 text-violet-700", 白金: "bg-slate-100 text-slate-700", 黄金: "bg-amber-100 text-amber-700", 白银: "bg-blue-100 text-blue-700" };
  return (
    <div className="space-y-6">
      <PageHeader title="代理商列表" sub="所有注册代理商" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Download className="w-4 h-4 mr-2" />导出</Button>} />
      <StatsRow items={[
        { label: "代理商总数", value: M.agencies.length },
        { label: "钻石/白金", value: M.agencies.filter((a) => ["钻石", "白金"].includes(a.level)).length },
        { label: "总 MRR", value: `¥${(M.agencies.reduce((s, a) => s + a.mrr, 0) / 10000).toFixed(0)}w` },
        { label: "旗下企业", value: M.agencies.reduce((s, a) => s + a.enterprises, 0) },
      ]} />
      <DataTable
        search="搜索代理商..."
        columns={["代理商", "负责人", "等级", "企业数", "站点数", "月 MRR", "加入", "状态", "操作"]}
        rows={M.agencies.map((a) => [
          <div><div className="font-medium">{a.name}</div><div className="text-[11px] text-slate-500 font-mono">{a.id}</div></div>,
          a.owner,
          <Badge className={`${levelColor[a.level]} hover:${levelColor[a.level]}`}>{a.level}</Badge>,
          <span className="text-center block">{a.enterprises}</span>,
          <span className="text-center block">{a.sites}</span>,
          <span className="font-semibold text-emerald-600">¥{a.mrr.toLocaleString()}</span>,
          <span className="text-xs text-slate-500">{a.joined}</span>,
          <StatusBadge status={a.status} />,
          <TableActions />,
        ])}
      />
    </div>
  );
}

export function HQRechargeAudit() {
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
        id: `RA${String(index + 1).padStart(4, "0")}`,
        agency,
        amount: Math.max(50000, countProjectDescendants(agency) * 12000 + countClientDescendants(agency) * 3000),
        method: agency.commission_mode === "percentage" ? "对公转账" : "线下汇款",
        voucher: `${agency.code.toLowerCase()}-recharge.pdf`,
        submitted: formatDateLabel(agency.updated_at || agency.created_at),
        status: index === 0 ? "pending" : index === 1 ? "pending" : index % 4 === 0 ? "rejected" : "approved",
      })),
    [agencies]
  );

  return (
    <div className="space-y-6">
      <PageHeader title="充值审核" sub="代理商对公转账 / 线下汇款审核" />
      <StatsRow items={[
        { label: "待审核", value: rows.filter((r) => r.status === "pending").length, color: "text-amber-600" },
        { label: "本轮通过", value: rows.filter((r) => r.status === "approved").length, color: "text-emerald-600" },
        { label: "本轮拒绝", value: rows.filter((r) => r.status === "rejected").length, color: "text-red-600" },
        { label: "待审金额", value: `¥${rows.filter((r) => r.status === "pending").reduce((s, r) => s + r.amount, 0).toLocaleString()}` },
      ]} />
      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">充值审核数据加载失败：{error}</CardContent>
        </Card>
      ) : null}
      {loading ? (
        <Card className="border-slate-200">
          <CardContent className="p-5 text-sm text-slate-500">正在加载真实充值审核列表...</CardContent>
        </Card>
      ) : (
      <DataTable
        columns={["流水号", "代理商", "层级", "客户数", "计划数", "金额", "方式", "凭证", "提交时间", "状态", "操作"]}
        rows={rows.map((r) => [
          <span className="font-mono text-xs">{r.id}</span>,
          <div>
            <div className="font-medium">{sanitizeDisplayText(r.agency.name, r.agency.code)}</div>
            <div className="font-mono text-[11px] text-slate-500">{r.agency.code}</div>
          </div>,
          <Badge variant="outline" className="text-xs">{getAgencyLevelLabel(r.agency, parentMap)}</Badge>,
          <span className="text-center block font-semibold">{countClientDescendants(r.agency)}</span>,
          <span className="text-center block font-semibold">{countProjectDescendants(r.agency)}</span>,
          <span className="font-semibold">¥{r.amount.toLocaleString()}</span>,
          r.method,
          <a href="#" className="text-cyan-600 text-xs hover:underline">{r.voucher}</a>,
          <span className="text-xs text-slate-500">{r.submitted}</span>,
          <StatusBadge status={r.status} />,
          r.status === "pending" ? (
            <div className="flex gap-1">
              <Button size="sm" className="h-6 text-xs bg-emerald-600 hover:bg-emerald-700"><Check className="w-3 h-3" /></Button>
              <Button size="sm" variant="outline" className="h-6 text-xs"><X className="w-3 h-3" /></Button>
            </div>
          ) : <TableActions />,
        ])}
      />
      )}
    </div>
  );
}

export function HQOEMAudit() {
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
        logo: "✓",
        submitted: formatDateLabel(agency.updated_at || agency.created_at),
        status: index === 0 ? "pending" : index === 1 ? "pending" : index % 3 === 0 ? "approved" : "rejected",
      })),
    [agencies]
  );

  return (
    <div className="space-y-6">
      <PageHeader title="OEM 审核" sub="代理商白标定制审核（品牌 / 域名 / Logo）" />
      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">OEM 审核数据加载失败：{error}</CardContent>
        </Card>
      ) : null}
      {loading ? (
        <Card className="border-slate-200">
          <CardContent className="p-5 text-sm text-slate-500">正在加载真实 OEM 审核列表...</CardContent>
        </Card>
      ) : (
      <DataTable
        columns={["审核号", "代理商", "层级", "品牌名", "域名", "客户数", "计划数", "Logo", "提交日期", "状态", "操作"]}
        rows={rows.map((o) => [
          <span className="font-mono text-xs">{o.id}</span>,
          <div>
            <div className="font-medium">{sanitizeDisplayText(o.agency.name, o.agency.code)}</div>
            <div className="font-mono text-[11px] text-slate-500">{o.agency.code}</div>
          </div>,
          <Badge variant="outline" className="text-xs">{getAgencyLevelLabel(o.agency, parentMap)}</Badge>,
          <span className="font-medium">{o.brand}</span>,
          <span className="text-cyan-600 text-xs font-mono">{o.domain}</span>,
          <span className="text-center block font-semibold">{countClientDescendants(o.agency)}</span>,
          <span className="text-center block font-semibold">{countProjectDescendants(o.agency)}</span>,
          <span className="text-emerald-600">{o.logo}</span>,
          o.submitted,
          <StatusBadge status={o.status} />,
          o.status === "pending" ? (
            <div className="flex gap-1">
              <Button size="sm" className="h-6 text-xs bg-emerald-600 hover:bg-emerald-700">通过</Button>
              <Button size="sm" variant="outline" className="h-6 text-xs">驳回</Button>
            </div>
          ) : <TableActions />,
        ])}
      />
      )}
    </div>
  );
}

// ==================== 企业 & 站点 ====================

export function HQEnterprises() {
  return (
    <div className="space-y-6">
      <PageHeader title="外贸企业列表" sub="平台所有终端企业客户" action={<Button variant="outline"><Download className="w-4 h-4 mr-2" />导出</Button>} />
      <DataTable
        search="搜索企业名称、行业..."
        columns={["企业", "所属代理", "行业", "站点", "套餐", "月付", "注册", "状态"]}
        rows={M.hqEnterprises.map((e) => [
          <div><div className="font-medium">{e.name}</div><div className="text-[11px] text-slate-500 font-mono">{e.id}</div></div>,
          <span className="text-cyan-600 text-xs">{e.agency}</span>,
          e.industry,
          <span className="text-center block">{e.sites}</span>,
          <Badge variant="outline" className="text-xs">{e.plan}</Badge>,
          <span className="font-semibold">¥{e.mrr.toLocaleString()}</span>,
          <span className="text-xs text-slate-500">{e.joined}</span>,
          <StatusBadge status={e.status} />,
        ])}
      />
    </div>
  );
}

export function HQSites() {
  return (
    <div className="space-y-6">
      <PageHeader title="站点列表" sub="平台所有在线独立站" />
      <StatsRow items={[
        { label: "站点总数", value: M.hqSites.length },
        { label: "总流量 / 日", value: M.hqSites.reduce((s, v) => s + v.traffic, 0).toLocaleString() },
        { label: "总存储", value: `${M.hqSites.reduce((s, v) => s + v.storage, 0).toFixed(1)} GB` },
        { label: "总带宽", value: `${M.hqSites.reduce((s, v) => s + v.bandwidth, 0)} GB` },
      ]} />
      <DataTable
        columns={["域名", "企业", "代理商", "日访客", "存储", "带宽", "SSL", "状态"]}
        rows={M.hqSites.map((s) => [
          <a href={`https://${s.domain}`} className="text-cyan-600 text-sm hover:underline font-mono">{s.domain}</a>,
          s.enterprise,
          <span className="text-xs text-slate-500">{s.agency}</span>,
          <span className="font-semibold">{s.traffic.toLocaleString()}</span>,
          <span>{s.storage} GB</span>,
          <span>{s.bandwidth} GB</span>,
          <span className={s.ssl === "✓" ? "text-emerald-600" : "text-slate-400"}>{s.ssl}</span>,
          <StatusBadge status={s.status} />,
        ])}
      />
    </div>
  );
}

export function HQDomains() {
  return (
    <div className="space-y-6">
      <PageHeader title="域名管理" sub="域名 / SSL / 续费统一管理" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Plus className="w-4 h-4 mr-2" />添加域名</Button>} />
      <DataTable
        columns={["域名", "类型", "所属站点", "SSL 到期", "状态", "续费方式", "操作"]}
        rows={M.domains.map((d) => [
          <span className="font-mono text-sm text-cyan-600">{d.domain}</span>,
          <Badge variant="outline" className="text-xs">{d.type}</Badge>,
          d.site,
          <span className="text-xs">{d.sslExpires}</span>,
          <StatusBadge status={d.status} />,
          <Badge variant="outline" className="text-xs">{d.renew === "auto" ? "自动续费" : "手动"}</Badge>,
          <TableActions />,
        ])}
      />
    </div>
  );
}

// ==================== 素材 ====================

export function HQTemplates() {
  return (
    <div className="space-y-6">
      <PageHeader title="模板库" sub="平台官方 / 代理商共享模板" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Upload className="w-4 h-4 mr-2" />上传模板</Button>} />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {M.templates.map((t) => (
          <Card key={t.id} className="border-slate-200 hover:shadow-md transition">
            <div className="h-40 bg-gradient-to-br from-cyan-50 to-emerald-50 flex items-center justify-center text-6xl">{t.thumbnail}</div>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-1">
                <div className="font-semibold text-sm">{t.name}</div>
                <StatusBadge status={t.status} />
              </div>
              <div className="text-xs text-slate-500">{t.category}</div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-xs">
                <span className="text-slate-500">⭐ {t.rating}</span>
                <span className="text-slate-500">{t.uses} 使用</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function HQGallery() {
  return (
    <div className="space-y-6">
      <PageHeader title="图库" sub="平台素材图片库" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Upload className="w-4 h-4 mr-2" />上传图片</Button>} />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {M.gallery.map((g) => (
          <Card key={g.id} className="border-slate-200 overflow-hidden hover:shadow-md">
            <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-400">
              <ImageIcon className="w-10 h-10" />
            </div>
            <CardContent className="p-3">
              <div className="text-xs font-medium truncate">{g.name}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{g.size}</div>
              <div className="flex items-center justify-between text-[10px] mt-1.5 pt-1.5 border-t border-slate-100">
                <Badge variant="outline" className="text-[9px] h-4">{g.category}</Badge>
                <span className="text-slate-500">{g.uses}×</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ==================== AI 服务 ====================

export function HQAIVendors() {
  return (
    <div className="space-y-6">
      <PageHeader title="AI 供应商管理" sub="统一管理所有 AI 服务商" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Plus className="w-4 h-4 mr-2" />接入供应商</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {M.aiVendors.map((v) => (
          <Card key={v.id} className="border-slate-200 hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{v.logo}</div>
                  <div>
                    <div className="font-semibold">{v.name}</div>
                    <div className="text-xs text-slate-500">{v.region}</div>
                  </div>
                </div>
                <Switch defaultChecked={v.status === "active"} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><div className="text-slate-500">接入模型</div><div className="font-semibold text-base mt-0.5">{v.models}</div></div>
                <div><div className="text-slate-500">月成本</div><div className="font-semibold text-base mt-0.5">¥{v.monthlyCost.toLocaleString()}</div></div>
              </div>
              {v.status === "active" && (
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] mb-1"><span className="text-slate-500">月配额</span><span>{v.quotaUsed}%</span></div>
                  <Progress value={v.quotaUsed} className="h-1.5" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function HQAIModels() {
  return (
    <div className="space-y-6">
      <PageHeader title="AI 模型管理" sub="平台可用模型及定价" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Plus className="w-4 h-4 mr-2" />添加模型</Button>} />
      <DataTable
        columns={["模型", "供应商", "类型", "输入单价", "输出单价", "调用量", "月成本", "状态"]}
        rows={M.aiModels.map((m) => [
          <div className="flex items-center gap-2"><Cpu className="w-4 h-4 text-cyan-500" /><span className="font-mono text-sm">{m.name}</span></div>,
          m.vendor,
          <Badge variant="outline" className="text-xs">{m.type}</Badge>,
          <span className="font-mono text-xs">${m.inputPrice}/1M</span>,
          <span className="font-mono text-xs">${m.outputPrice}/1M</span>,
          <span className="font-semibold">{m.calls.toLocaleString()}</span>,
          <span className="font-semibold text-emerald-600">¥{m.cost.toLocaleString()}</span>,
          <StatusBadge status={m.status} />,
        ])}
      />
    </div>
  );
}

export function HQAIKeys() {
  return (
    <div className="space-y-6">
      <PageHeader title="AI Key 管理" sub="供应商 API Key 轮换与监控" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Plus className="w-4 h-4 mr-2" />添加 Key</Button>} />
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-amber-900">Key 安全建议</div>
            <div className="text-xs text-amber-700 mt-0.5">每个供应商至少配置 2 个 Key 实现故障转移；定期轮换（建议 90 天）；开启用量告警</div>
          </div>
        </CardContent>
      </Card>
      <DataTable
        columns={["Key 别名", "供应商", "掩码", "环境", "用量", "过期", "状态", "操作"]}
        rows={M.aiKeys.map((k) => [
          <div className="flex items-center gap-2"><Key className="w-4 h-4 text-cyan-500" /><span className="font-medium">{k.alias}</span></div>,
          k.vendor,
          <code className="font-mono text-xs bg-slate-50 px-2 py-0.5 rounded">{k.maskedKey}</code>,
          <Badge variant="outline" className="text-xs">{k.env}</Badge>,
          <span className={`font-semibold ${parseInt(k.usage) > 80 ? "text-red-600" : parseInt(k.usage) > 50 ? "text-amber-600" : "text-emerald-600"}`}>{k.usage}</span>,
          <span className="text-xs text-slate-500">{k.expires}</span>,
          <StatusBadge status={k.status === "disabled" ? "disabled" : "active"} />,
          <TableActions />,
        ])}
      />
    </div>
  );
}

export function HQAILogs() {
  return (
    <div className="space-y-6">
      <PageHeader title="AI 调用日志" sub="全平台 AI 调用明细（实时）" />
      <StatsRow items={[
        { label: "今日调用", value: `${(M.hqKpis.aiCallsToday / 1000).toFixed(0)}k` },
        { label: "成功率", value: "99.4%", color: "text-emerald-600" },
        { label: "平均延迟", value: "2.4s" },
        { label: "今日成本", value: "¥6,234" },
      ]} />
      <DataTable
        search="搜索模型、企业、代理商..."
        columns={["时间", "代理商", "企业", "模型", "Token / 产出", "成本", "延迟", "状态"]}
        rows={M.aiLogs.map((l) => [
          <span className="font-mono text-xs">{l.time}</span>,
          l.agency,
          l.enterprise,
          <span className="font-mono text-xs">{l.model}</span>,
          <span className="text-xs">{l.tokens}</span>,
          <span className="font-semibold">¥{l.cost.toFixed(2)}</span>,
          <span className="text-xs">{(l.latency / 1000).toFixed(1)}s</span>,
          <StatusBadge status={l.status} />,
        ])}
      />
    </div>
  );
}

export function HQAICost() {
  const maxCost = Math.max(...M.aiModels.map((m) => m.cost));
  return (
    <div className="space-y-6">
      <PageHeader title="AI 成本看板" sub="按供应商 / 模型 / 类型的成本分析" />
      <StatsRow items={[
        { label: "本月成本", value: `¥${(M.hqKpis.aiCostMonth / 10000).toFixed(1)}w`, color: "text-rose-600" },
        { label: "对企业收费", value: "¥42.6w", color: "text-emerald-600" },
        { label: "毛利", value: "¥24.0w", color: "text-cyan-600" },
        { label: "毛利率", value: "56.3%", color: "text-emerald-600" },
      ]} />
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4">模型成本 TOP 榜</h3>
          <div className="space-y-3">
            {M.aiModels.slice().sort((a, b) => b.cost - a.cost).map((m, i) => (
              <div key={m.id} className="flex items-center gap-3">
                <div className="w-6 text-xs text-slate-400 text-center">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium font-mono">{m.name}</span>
                    <span className="text-sm font-bold text-rose-600">¥{m.cost.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-rose-400 to-rose-500" style={{ width: `${(m.cost / maxCost) * 100}%` }} />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{m.vendor} · {m.calls.toLocaleString()} 次调用</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== 资金管理 ====================

export function HQWallet() {
  const typeMap: Record<string, { label: string; cls: string }> = {
    agency_recharge: { label: "代理商充值", cls: "text-emerald-600" },
    agency_settle: { label: "代理商结算", cls: "text-amber-600" },
    ai_cost: { label: "AI 成本", cls: "text-rose-600" },
    refund: { label: "退款", cls: "text-blue-600" },
  };
  return (
    <div className="space-y-6">
      <PageHeader title="平台钱包管理" sub="总部资金流水与结算" action={<Button variant="outline"><Download className="w-4 h-4 mr-2" />导出账单</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-2 bg-gradient-to-br from-cyan-600 via-teal-600 to-emerald-600 text-white border-0">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5" />
              <span className="text-sm opacity-90">平台总余额</span>
            </div>
            <div className="text-4xl font-bold">¥{M.hqWallet.balance.toLocaleString()}</div>
            <div className="flex gap-4 mt-4 text-xs">
              <div><div className="opacity-70">累计充值</div><div className="font-semibold">¥{(M.hqWallet.totalRecharge / 10000).toFixed(0)}w</div></div>
              <div><div className="opacity-70">累计支出</div><div className="font-semibold">¥{(M.hqWallet.totalConsume / 10000).toFixed(0)}w</div></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200"><CardContent className="p-5"><div className="text-xs text-slate-500">待结算</div><div className="text-2xl font-bold text-amber-600 mt-1">¥{(M.hqWallet.pendingSettle / 10000).toFixed(1)}w</div><div className="text-[10px] text-slate-400 mt-1">8 家代理商待结算</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-5"><div className="text-xs text-slate-500">本月流水</div><div className="text-2xl font-bold mt-1">¥52w</div><div className="text-[10px] text-emerald-600 mt-1">+15.3%</div></CardContent></Card>
      </div>
      <DataTable
        columns={["流水号", "类型", "方向", "对方", "说明", "金额", "时间"]}
        rows={M.hqWalletTxns.map((t) => [
          <span className="font-mono text-xs">{t.id}</span>,
          <Badge variant="outline" className={`text-xs ${typeMap[t.type].cls}`}>{typeMap[t.type].label}</Badge>,
          t.direction === "in" ? <span className="text-emerald-600 text-xs">▼ 收入</span> : <span className="text-rose-600 text-xs">▲ 支出</span>,
          t.party,
          <span className="text-xs text-slate-600">{t.desc}</span>,
          <span className={`font-semibold ${t.direction === "in" ? "text-emerald-600" : "text-rose-600"}`}>{t.direction === "in" ? "+" : "-"}¥{t.amount.toLocaleString()}</span>,
          <span className="text-xs text-slate-500">{t.date}</span>,
        ])}
      />
    </div>
  );
}

// ==================== 套餐与积分 ====================

export function HQPlans() {
  return (
    <div className="space-y-6">
      <PageHeader title="套餐管理" sub="企业客户 + 代理商 全部套餐" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Plus className="w-4 h-4 mr-2" />新建套餐</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {["企业客户", "代理商"].map((scope) => (
          <div key={scope}>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Badge className="bg-cyan-100 text-cyan-700 hover:bg-cyan-100">{scope}</Badge>
              <span className="text-sm text-slate-500">{M.hqPlans.filter((p) => p.scope === scope).length} 个套餐</span>
            </h3>
            <div className="space-y-2">
              {M.hqPlans.filter((p) => p.scope === scope).map((p) => (
                <Card key={p.id} className={`border-slate-200 ${p.popular ? "ring-2 ring-cyan-400" : ""}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                      <Package className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{p.name} {p.popular && <Badge className="bg-cyan-500 text-white hover:bg-cyan-500 ml-1 text-[9px]">热卖</Badge>}</div>
                      <div className="text-xs text-slate-500">{p.features} 项功能 · 已售 {p.sold}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">¥{p.price}</div>
                      <div className="text-[10px] text-slate-500">/{p.period}</div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Edit3 className="w-3.5 h-3.5" /></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HQBoosters() {
  return (
    <div className="space-y-6">
      <PageHeader title="加油包管理" sub="按量补充的资源包" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Plus className="w-4 h-4 mr-2" />新建加油包</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {M.boosters.map((b) => (
          <Card key={b.id} className="border-slate-200 hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-xl">🚀</div>
                <Badge variant="outline" className="text-xs">已售 {b.sold}</Badge>
              </div>
              <div className="font-semibold">{b.name}</div>
              <div className="text-xs text-slate-500 mt-1 mb-3">{b.desc}</div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="text-xl font-bold text-amber-600">¥{b.price}</div>
                <Button variant="outline" size="sm" className="h-7 text-xs"><Edit3 className="w-3 h-3 mr-1" />编辑</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function HQCoupons() {
  return (
    <div className="space-y-6">
      <PageHeader title="兑换码管理" sub="优惠券 / 折扣码 / 批量生成" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Plus className="w-4 h-4 mr-2" />生成兑换码</Button>} />
      <DataTable
        columns={["兑换码", "名称", "折扣", "限量", "已用", "有效期至", "状态", "操作"]}
        rows={M.coupons.map((c) => [
          <code className="font-mono text-xs bg-slate-50 px-2 py-1 rounded font-semibold text-cyan-600">{c.code}</code>,
          <span className="font-medium">{c.name}</span>,
          <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">{c.discount}</Badge>,
          c.limit,
          <div className="text-xs">
            <div className="font-semibold">{c.used}</div>
            <Progress value={(c.used / c.limit) * 100} className="h-1 mt-0.5 w-16" />
          </div>,
          <span className="text-xs">{c.validUntil}</span>,
          <StatusBadge status={c.status} />,
          <TableActions />,
        ])}
      />
    </div>
  );
}

export function HQPoints() {
  return (
    <div className="space-y-6">
      <PageHeader title="积分配置" sub="平台积分获取与消耗规则" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Plus className="w-4 h-4 mr-2" />新增规则</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {["获取", "消耗"].map((type) => (
          <div key={type}>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Badge className={type === "获取" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-rose-100 text-rose-700 hover:bg-rose-100"}>{type}规则</Badge>
            </h3>
            <Card className="border-slate-200">
              <CardContent className="p-0">
                {M.pointRules.filter((r) => r.type === type).map((r, i) => (
                  <div key={i} className={`flex items-center gap-3 p-4 ${i > 0 ? "border-t border-slate-100" : ""}`}>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{r.action}</div>
                    </div>
                    <div className={`font-bold ${type === "获取" ? "text-emerald-600" : "text-rose-600"}`}>
                      {type === "获取" ? "+" : "-"}{r.points}
                    </div>
                    <Switch defaultChecked={r.enabled} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== 订单管理 ====================

export function HQOrders() {
  return (
    <div className="space-y-6">
      <PageHeader title="订单列表" sub="全平台订单（代理商 + 企业）" action={<Button variant="outline"><Download className="w-4 h-4 mr-2" />导出</Button>} />
      <DataTable
        search="搜索订单号、对方..."
        columns={["订单号", "对方", "类型", "套餐", "金额", "状态", "日期"]}
        rows={M.hqOrders.map((o) => [
          <span className="font-mono text-xs">{o.id}</span>,
          <span className="font-medium">{o.party}</span>,
          <Badge variant="outline" className="text-xs">{o.type}</Badge>,
          <span className="text-xs text-slate-600">{o.plan}</span>,
          <span className={`font-semibold ${o.amount < 0 ? "text-rose-600" : "text-emerald-600"}`}>¥{Math.abs(o.amount).toLocaleString()}</span>,
          <StatusBadge status={o.status} />,
          <span className="text-xs text-slate-500">{o.date}</span>,
        ])}
      />
    </div>
  );
}

export function HQOrderAudit() {
  return (
    <div className="space-y-6">
      <PageHeader title="订单审核" sub="需人工审核的订单" />
      <DataTable
        columns={["订单号", "对方", "类型", "金额", "状态", "日期", "操作"]}
        rows={M.hqOrders.filter((o) => ["auditing", "pending"].includes(o.status)).map((o) => [
          <span className="font-mono text-xs">{o.id}</span>,
          o.party,
          <Badge variant="outline" className="text-xs">{o.type}</Badge>,
          <span className="font-semibold">¥{o.amount.toLocaleString()}</span>,
          <StatusBadge status={o.status} />,
          <span className="text-xs text-slate-500">{o.date}</span>,
          <div className="flex gap-1">
            <Button size="sm" className="h-6 text-xs bg-emerald-600 hover:bg-emerald-700">通过</Button>
            <Button size="sm" variant="outline" className="h-6 text-xs">驳回</Button>
          </div>,
        ])}
      />
    </div>
  );
}

export function HQAutoRenew() {
  return (
    <div className="space-y-6">
      <PageHeader title="自动续费" sub="订阅用户自动续费设置" />
      <DataTable
        columns={["ID", "对方", "套餐", "下次续费", "金额", "绑定卡", "状态", "操作"]}
        rows={M.autoRenewals.map((a) => [
          <span className="font-mono text-xs">{a.id}</span>,
          <span className="font-medium">{a.party}</span>,
          <Badge variant="outline" className="text-xs">{a.plan}</Badge>,
          <span className="text-xs">{a.nextRenew}</span>,
          <span className="font-semibold">¥{a.amount.toLocaleString()}</span>,
          <code className="font-mono text-xs">{a.card}</code>,
          <StatusBadge status={a.status} />,
          <TableActions />,
        ])}
      />
    </div>
  );
}

export function HQRefunds() {
  return (
    <div className="space-y-6">
      <PageHeader title="退款管理" sub="退款申请与处理" />
      <DataTable
        columns={["退款号", "对方", "原订单", "金额", "原因", "状态", "日期", "操作"]}
        rows={M.refunds.map((r) => [
          <span className="font-mono text-xs">{r.id}</span>,
          r.party,
          <span className="font-mono text-xs text-cyan-600">{r.order}</span>,
          <span className="font-semibold text-rose-600">¥{r.amount.toLocaleString()}</span>,
          <span className="text-xs text-slate-600">{r.reason}</span>,
          <StatusBadge status={r.status} />,
          <span className="text-xs text-slate-500">{r.date}</span>,
          r.status === "pending" ? (
            <div className="flex gap-1">
              <Button size="sm" className="h-6 text-xs bg-emerald-600 hover:bg-emerald-700">退款</Button>
              <Button size="sm" variant="outline" className="h-6 text-xs">拒绝</Button>
            </div>
          ) : <TableActions />,
        ])}
      />
    </div>
  );
}

export function HQInvoices() {
  return (
    <div className="space-y-6">
      <PageHeader title="发票管理" sub="发票开具记录" />
      <DataTable
        columns={["发票号", "对方", "类型", "金额", "状态", "日期", "操作"]}
        rows={M.invoices.map((inv) => [
          <span className="font-mono text-xs">{inv.id}</span>,
          inv.party,
          <Badge variant="outline" className="text-xs">{inv.type}</Badge>,
          <span className="font-semibold">¥{inv.amount.toLocaleString()}</span>,
          <StatusBadge status={inv.status} />,
          <span className="text-xs text-slate-500">{inv.date}</span>,
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs"><FileText className="w-3 h-3 mr-1" />查看</Button>
          </div>,
        ])}
      />
    </div>
  );
}

// ==================== 运营推广 ====================

export function HQAnnouncements() {
  const priorityColor: Record<string, string> = { high: "bg-red-100 text-red-700", medium: "bg-amber-100 text-amber-700", low: "bg-slate-100 text-slate-700" };
  return (
    <div className="space-y-6">
      <PageHeader title="公告管理" sub="平台公告发布" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Plus className="w-4 h-4 mr-2" />新建公告</Button>} />
      <DataTable
        columns={["标题", "推送目标", "优先级", "阅读量", "发布时间", "状态", "操作"]}
        rows={M.announcements.map((a) => [
          <span className="font-medium">{a.title}</span>,
          <Badge variant="outline" className="text-xs">{a.target}</Badge>,
          <Badge className={`${priorityColor[a.priority]} hover:${priorityColor[a.priority]}`}>{a.priority === "high" ? "高" : a.priority === "medium" ? "中" : "低"}</Badge>,
          <span className="text-xs">{a.views.toLocaleString()}</span>,
          <span className="text-xs text-slate-500">{a.published}</span>,
          <StatusBadge status={a.status} />,
          <TableActions />,
        ])}
      />
    </div>
  );
}

export function HQPromotions() {
  return (
    <div className="space-y-6">
      <PageHeader title="促销活动" sub="满减 / 折扣 / 满赠" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Plus className="w-4 h-4 mr-2" />新建活动</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {M.promotions.map((p) => (
          <Card key={p.id} className="border-slate-200 hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
                    <Tag className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-rose-600 font-semibold">{p.discount}</div>
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="text-xs text-slate-500 mb-3">
                {p.scope} · {p.startDate} → {p.endDate}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <div><div className="text-[10px] text-slate-500">参与</div><div className="text-base font-semibold">{p.joined}</div></div>
                <div><div className="text-[10px] text-slate-500">带来 GMV</div><div className="text-base font-semibold text-emerald-600">¥{(p.gmv / 10000).toFixed(0)}w</div></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function HQGroups() {
  return (
    <div className="space-y-6">
      <PageHeader title="分组管理" sub="用户分群与精细运营" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Plus className="w-4 h-4 mr-2" />新建分组</Button>} />
      <DataTable
        columns={["分组名", "类型", "成员数", "规则", "创建人", "操作"]}
        rows={M.groups.map((g) => [
          <span className="font-medium">{g.name}</span>,
          <Badge variant="outline" className="text-xs">{g.type}</Badge>,
          <span className="font-semibold text-cyan-600">{g.members}</span>,
          <code className="text-xs bg-slate-50 px-2 py-0.5 rounded">{g.rule}</code>,
          g.createdBy,
          <TableActions />,
        ])}
      />
    </div>
  );
}

export function HQCsat() {
  return (
    <div className="space-y-6">
      <PageHeader title="客户满意度" sub="NPS / CSAT 指标监测" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50"><CardContent className="p-5"><div className="text-xs text-emerald-800">NPS 净推荐值</div><div className="text-4xl font-bold text-emerald-900 mt-1">{M.csat.nps}</div><div className="text-[10px] text-emerald-700 mt-1">较上月 +4</div></CardContent></Card>
        <Card className="border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50"><CardContent className="p-5"><div className="text-xs text-cyan-800">CSAT 满意度</div><div className="text-4xl font-bold text-cyan-900 mt-1">{M.csat.csat} / 5</div><div className="text-[10px] text-cyan-700 mt-1">⭐⭐⭐⭐⭐</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-5"><div className="text-xs text-slate-500">调研回收</div><div className="text-4xl font-bold mt-1">{M.csat.totalResponses.toLocaleString()}</div><div className="text-[10px] text-slate-500 mt-1">回收率 68.2%</div></CardContent></Card>
      </div>
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4">分类满意度</h3>
          <div className="space-y-3">
            {M.csat.byCategory.map((c) => (
              <div key={c.category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm">{c.category}</span>
                  <span className="text-sm font-semibold text-cyan-600">{c.score} / 5 <span className="text-xs text-slate-400">({c.responses})</span></span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${(c.score / 5) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function HQQaPlans() {
  return (
    <div className="space-y-6">
      <PageHeader title="问答计划" sub="问卷与调研计划" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Plus className="w-4 h-4 mr-2" />新建计划</Button>} />
      <DataTable
        columns={["计划名", "目标群体", "渠道", "发送", "回收", "回收率", "状态", "操作"]}
        rows={M.qaPlans.map((p) => [
          <span className="font-medium">{p.name}</span>,
          <Badge variant="outline" className="text-xs">{p.target}</Badge>,
          <span className="text-xs">{p.channel}</span>,
          p.sent,
          p.responses,
          <span className="font-semibold text-emerald-600">{p.rate}</span>,
          <StatusBadge status={p.status} />,
          <TableActions />,
        ])}
      />
    </div>
  );
}

export function HQQaTasks() {
  return (
    <div className="space-y-6">
      <PageHeader title="问答任务" sub="具体问卷执行任务" />
      <DataTable
        columns={["任务号", "所属计划", "执行人", "目标", "完成日期", "评分", "状态"]}
        rows={M.qaTasks.map((t) => [
          <span className="font-mono text-xs">{t.id}</span>,
          <span className="text-xs">{t.plan}</span>,
          t.assignee,
          <span className="font-medium">{t.target}</span>,
          <span className="text-xs text-slate-500">{t.date}</span>,
          t.score ? <span className={`font-semibold ${t.score >= 4 ? "text-emerald-600" : t.score >= 3 ? "text-amber-600" : "text-rose-600"}`}>⭐ {t.score}</span> : <span className="text-slate-400">-</span>,
          <StatusBadge status={t.status} />,
        ])}
      />
    </div>
  );
}

export function HQInquiryAuto() {
  return (
    <div className="space-y-6">
      <PageHeader title="询盘自动化" sub="自动回复 / 自动分配 / 智能提醒规则" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Plus className="w-4 h-4 mr-2" />新建规则</Button>} />
      <div className="space-y-3">
        {M.inquiryAuto.map((r) => (
          <Card key={r.id} className="border-slate-200">
            <CardContent className="p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{r.name}</span>
                  <Badge variant="outline" className="text-[10px]">触发 {r.triggered.toLocaleString()} 次</Badge>
                </div>
                <div className="text-xs text-slate-500 mb-1"><span className="text-cyan-600 font-semibold">WHEN</span> {r.trigger}</div>
                <div className="text-xs text-slate-500"><span className="text-emerald-600 font-semibold">THEN</span> {r.action}</div>
              </div>
              <Switch defaultChecked={r.enabled} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ==================== SEO ====================

export function HQTdkRules() {
  return (
    <div className="space-y-6">
      <PageHeader title="TDK 规则配置" sub="Title / Description / Keywords 自动生成规则" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Plus className="w-4 h-4 mr-2" />新建规则</Button>} />
      <div className="space-y-3">
        {M.tdkRules.map((t) => (
          <Card key={t.id} className="border-slate-200">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{t.name}</span>
                    <Badge variant="outline" className="text-[10px]">{t.scope}</Badge>
                  </div>
                  <code className="block text-xs bg-slate-50 px-3 py-2 rounded mt-2 font-mono text-slate-700">{t.template}</code>
                </div>
                <Switch defaultChecked={t.enabled} />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Edit3 className="w-3.5 h-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function HQSeoBlogs() {
  return (
    <div className="space-y-6">
      <PageHeader title="SEO 引流博客" sub="批量博客生产计划" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Plus className="w-4 h-4 mr-2" />新建计划</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {M.seoBlogPlans.map((p) => {
          const pct = (p.progress / p.total) * 100;
          return (
            <Card key={p.id} className="border-slate-200">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">目标站点：{p.target}</div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">进度</span>
                    <span className="font-semibold">{p.progress} / {p.total}</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
                <div className="flex items-center justify-between text-xs pt-2">
                  <span className="text-slate-500">AI 生成占比</span>
                  <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100"><Sparkles className="w-3 h-3 mr-1" />{p.aiGen}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ==================== 通知 ====================

export function HQNotifyConfig() {
  return (
    <div className="space-y-6">
      <PageHeader title="通知配置" sub="事件触发通知规则" />
      <Card className="border-slate-200">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="text-left py-3 px-4 font-medium">触发事件</th>
                <th className="text-left py-3 px-4 font-medium">通知渠道</th>
                <th className="text-left py-3 px-4 font-medium">通知对象</th>
                <th className="text-center py-3 px-4 font-medium">启用</th>
              </tr>
            </thead>
            <tbody>
              {M.notifyConfigs.map((n, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium">{n.event}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      {n.channels.map((c) => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{n.target}</td>
                  <td className="py-3 px-4 text-center"><Switch defaultChecked={n.enabled} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

export function HQEmailConfig() {
  return (
    <div className="space-y-6">
      <PageHeader title="邮件配置" sub="SMTP / 发件人 / 模板" action={<Button className="bg-cyan-600 hover:bg-cyan-700">保存</Button>} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Mail className="w-4 h-4 text-cyan-500" />SMTP 服务器</h3>
            <div className="space-y-3">
              <div><Label className="text-sm">SMTP 主机</Label><Input defaultValue="smtp.exmail.qq.com" className="mt-1 font-mono text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-sm">端口</Label><Input defaultValue="465" className="mt-1 font-mono text-sm" /></div>
                <div><Label className="text-sm">加密</Label><Input defaultValue="SSL/TLS" className="mt-1 text-sm" /></div>
              </div>
              <div><Label className="text-sm">用户名</Label><Input defaultValue="noreply@tradehq.com" className="mt-1 font-mono text-sm" /></div>
              <div><Label className="text-sm">密码</Label><Input type="password" defaultValue="**************" className="mt-1 font-mono text-sm" /></div>
              <Button variant="outline" size="sm" className="w-full">测试连接</Button>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">发件人信息</h3>
            <div className="space-y-3">
              <div><Label className="text-sm">发件人名称</Label><Input defaultValue="TradeHQ 平台" className="mt-1" /></div>
              <div><Label className="text-sm">发件地址</Label><Input defaultValue="noreply@tradehq.com" className="mt-1 font-mono text-sm" /></div>
              <div><Label className="text-sm">回复地址</Label><Input defaultValue="support@tradehq.com" className="mt-1 font-mono text-sm" /></div>
              <div><Label className="text-sm">默认签名</Label><Textarea defaultValue="—\nTradeHQ 团队\n让外贸独立站更简单" className="mt-1 min-h-[80px]" /></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function HQExpiring() {
  const statusColor: Record<string, string> = { danger: "border-red-300 bg-red-50", warning: "border-amber-300 bg-amber-50", ok: "border-slate-200" };
  return (
    <div className="space-y-6">
      <PageHeader title="服务到期提醒" sub="即将到期服务列表" />
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-red-200 bg-red-50"><CardContent className="p-4"><div className="text-xs text-red-800">紧急（7 天内）</div><div className="text-2xl font-bold text-red-900">{M.expiringServices.filter((e) => e.daysLeft <= 7).length}</div></CardContent></Card>
        <Card className="border-amber-200 bg-amber-50"><CardContent className="p-4"><div className="text-xs text-amber-800">警告（8-14 天）</div><div className="text-2xl font-bold text-amber-900">{M.expiringServices.filter((e) => e.daysLeft > 7 && e.daysLeft <= 14).length}</div></CardContent></Card>
        <Card className="border-slate-200"><CardContent className="p-4"><div className="text-xs text-slate-500">一般（14-30 天）</div><div className="text-2xl font-bold">{M.expiringServices.filter((e) => e.daysLeft > 14).length}</div></CardContent></Card>
      </div>
      <div className="space-y-3">
        {M.expiringServices.map((e) => (
          <Card key={e.id} className={`${statusColor[e.status]} border`}>
            <CardContent className="p-4 flex items-center gap-4">
              <Clock className={`w-5 h-5 ${e.status === "danger" ? "text-red-600" : e.status === "warning" ? "text-amber-600" : "text-slate-400"}`} />
              <div className="flex-1">
                <div className="font-semibold">{e.party}</div>
                <div className="text-xs text-slate-500">{e.plan} · 到期 {e.expires}</div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${e.status === "danger" ? "text-red-600" : e.status === "warning" ? "text-amber-600" : "text-slate-900"}`}>{e.daysLeft}</div>
                <div className="text-[10px] text-slate-500">天后到期</div>
              </div>
              <div className="text-xs text-slate-500">已提醒 {e.notified} 次</div>
              <Button size="sm" variant="outline" className="h-7 text-xs">手动提醒</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Import missing icons
import { Package, Clock } from "lucide-react";

// ==================== 平台设置 ====================

export function HQPlatformConfig() {
  return (
    <div className="space-y-6">
      <PageHeader title="平台配置" sub="全局参数设置" action={<Button className="bg-cyan-600 hover:bg-cyan-700">保存配置</Button>} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-6 space-y-3">
            <h3 className="font-semibold mb-2">基础信息</h3>
            <div><Label className="text-sm">平台名称</Label><Input defaultValue="TradeHQ 外贸独立站平台" className="mt-1" /></div>
            <div><Label className="text-sm">平台 Logo URL</Label><Input defaultValue="/assets/logo.svg" className="mt-1 font-mono text-sm" /></div>
            <div><Label className="text-sm">平台域名</Label><Input defaultValue="tradehq.com" className="mt-1 font-mono text-sm" /></div>
            <div><Label className="text-sm">客服电话</Label><Input defaultValue="400-888-8888" className="mt-1 font-mono" /></div>
            <div><Label className="text-sm">ICP 备案号</Label><Input defaultValue="粤 ICP 备 2024000000 号" className="mt-1" /></div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-6 space-y-3">
            <h3 className="font-semibold mb-2">功能开关</h3>
            {[
              { k: "允许代理商 OEM", v: true },
              { k: "开放新用户注册", v: true },
              { k: "启用积分系统", v: true },
              { k: "启用自动续费", v: true },
              { k: "启用国际支付（Stripe）", v: true },
              { k: "维护模式", v: false },
              { k: "调试日志", v: false },
            ].map((f) => (
              <div key={f.k} className="flex items-center justify-between p-2 rounded hover:bg-slate-50">
                <span className="text-sm">{f.k}</span>
                <Switch defaultChecked={f.v} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function HQPaymentChannels() {
  return (
    <div className="space-y-6">
      <PageHeader title="支付渠道" sub="平台收款渠道管理" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Plus className="w-4 h-4 mr-2" />接入渠道</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {M.paymentChannels.map((p) => (
          <Card key={p.id} className="border-slate-200 hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{p.icon}</div>
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.type}</div>
                  </div>
                </div>
                <Switch defaultChecked={p.status === "active"} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-slate-100">
                <div><div className="text-slate-500">手续费</div><div className="font-semibold text-sm mt-0.5">{p.fee}</div></div>
                <div><div className="text-slate-500">月流水</div><div className="font-semibold text-sm mt-0.5 text-emerald-600">¥{(p.monthVol / 10000).toFixed(1)}w</div></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function HQAlerts() {
  const sevColor: Record<string, string> = { critical: "bg-red-100 text-red-700 border-red-300", high: "bg-orange-100 text-orange-700 border-orange-300", warning: "bg-amber-100 text-amber-700 border-amber-300" };
  return (
    <div className="space-y-6">
      <PageHeader title="告警规则" sub="平台监控告警配置" action={<Button className="bg-cyan-600 hover:bg-cyan-700"><Plus className="w-4 h-4 mr-2" />新建规则</Button>} />
      <div className="space-y-3">
        {M.alertRules.map((a) => (
          <Card key={a.id} className="border-slate-200">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${sevColor[a.severity]}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{a.name}</span>
                  <Badge className={`${sevColor[a.severity]} border-0 text-[10px]`}>{a.severity.toUpperCase()}</Badge>
                  {a.triggered > 0 && <Badge className="bg-red-500 text-white hover:bg-red-500 text-[10px]">本月触发 {a.triggered} 次</Badge>}
                </div>
                <div className="text-xs text-slate-500">条件：<code className="bg-slate-50 px-1 rounded">{a.condition}</code></div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-slate-500">通知：</span>
                  {a.channels.map((c) => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
                </div>
              </div>
              <Switch defaultChecked={a.enabled} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ==================== 审计日志 ====================

export function HQAuditLogs() {
  return (
    <div className="space-y-6">
      <PageHeader title="操作日志" sub="总部操作审计记录" action={<Button variant="outline"><Download className="w-4 h-4 mr-2" />导出日志</Button>} />
      <DataTable
        search="搜索用户、操作、目标..."
        columns={["时间", "用户", "操作", "目标", "IP", "结果"]}
        rows={M.auditLogs.map((l) => [
          <span className="font-mono text-xs">{l.time}</span>,
          <span className="font-medium">{l.user}</span>,
          <span className="text-xs">{l.action}</span>,
          <span className="text-xs text-slate-600">{l.target}</span>,
          <code className="font-mono text-[10px] bg-slate-50 px-1 rounded">{l.ip}</code>,
          l.result === "success" ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="w-3 h-3 mr-1" />成功</Badge> : <Badge className="bg-red-100 text-red-700 hover:bg-red-100"><X className="w-3 h-3 mr-1" />失败</Badge>,
        ])}
      />
    </div>
  );
}
