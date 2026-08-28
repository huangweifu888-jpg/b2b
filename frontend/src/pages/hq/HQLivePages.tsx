import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ContentPluginIconSetting, ContentPluginOrderBadge } from "@/components/content-plugins/ContentPluginControls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DraggableDialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Download, Edit3, GripHorizontal, Plus, Search, ShieldCheck, Sparkles } from "lucide-react";

import { toast } from "@/hooks/use-toast";
import { platformApi, type PlatformNode, type PlatformOrganization } from "@/lib/platform-api";
import { ICON_OPTIONS } from "@/lib/product-market-store";
import { fetchAllSitesFromBackend, getSitePublicUrl, type PublishedSite } from "@/lib/sites";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";
import { FactoryPage } from "@/page-factory/FactoryPage";

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

function DataTable({
  columns,
  rows,
  search,
  compact = false,
}: {
  columns: string[];
  rows: ReactNode[][];
  search?: string;
  compact?: boolean;
}) {
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
                  <th key={column} className={`whitespace-nowrap text-left font-medium ${compact ? "px-3 py-2.5" : "px-4 py-3"}`}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-slate-100 hover:bg-slate-50">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className={`align-middle ${compact ? "px-3 py-2.5" : "px-4 py-3"}`}>
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "正常", cls: "bg-emerald-100 text-emerald-700" },
    online: { label: "已发布", cls: "bg-emerald-100 text-emerald-700" },
    pending: { label: "待处理", cls: "bg-amber-100 text-amber-700" },
    paused: { label: "已暂停", cls: "bg-slate-100 text-slate-700" },
    disabled: { label: "已禁用", cls: "bg-slate-100 text-slate-700" },
    trial: { label: "试用中", cls: "bg-blue-100 text-blue-700" },
  };
  const info = map[status] || { label: sanitizeDisplayText(status, "未知"), cls: "bg-slate-100 text-slate-700" };
  return <Badge className={`${info.cls} hover:${info.cls}`}>{info.label}</Badge>;
}

function TableActions({ onEdit }: { onEdit?: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        className="h-8 border-cyan-200 bg-white px-2.5 text-cyan-700 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800"
        onClick={onEdit}
        disabled={!onEdit}
        title={onEdit ? "修改代理商信息" : "暂不支持修改"}
      >
        <span>修改</span>
      </Button>
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
  const walk = (node: PlatformNode) => {
    items.push(node);
    node.children.forEach(walk);
  };
  nodes.forEach(walk);
  return items;
}

function getNodeTime(node: Pick<PlatformNode, "updated_at" | "created_at" | "id">) {
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

function renderAgencyChain(
  node: PlatformNode | null | undefined,
  parentMap: Map<number, PlatformNode>,
  emptyLabel = "-"
) {
  const chain = getAgencyChain(node, parentMap);
  if (!chain.length) {
    return <span className="text-xs text-slate-400">{emptyLabel}</span>;
  }

  return (
    <div className="space-y-0.5">
      <div className="text-sm text-slate-900">
        {chain.map((agency) => sanitizeDisplayText(agency.name, agency.code)).join(" / ")}
      </div>
      <div className="font-mono text-[11px] text-slate-500">{chain.map((agency) => agency.code).join(" / ")}</div>
    </div>
  );
}

function formatCommissionValue(mode?: string | null, rate?: number | null) {
  if (rate == null) return "-";
  if (mode === "percentage") {
    return `${(Number(rate) * 100).toFixed(1).replace(/\.0$/, "")}%`;
  }
  if (mode === "fixed") {
    return `固定 ${Number(rate)}`;
  }
  if (mode === "tiered") {
    return `阶梯 ${Number(rate)}`;
  }
  return String(rate);
}

function usePlatformTree() {
  const [tree, setTree] = useState<PlatformNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

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
  }, [revision]);

  return { tree, loading, error, refresh: () => setRevision((value) => value + 1) };
}

function flattenClients(nodes: PlatformNode[]) {
  return flattenPlatformTree(nodes)
    .filter((node) => node.org_type === "client")
    .sort((a, b) => getNodeTime(b) - getNodeTime(a));
}

function flattenAgencies(nodes: PlatformNode[]) {
  return flattenPlatformTree(nodes)
    .filter((node) => node.org_type === "agency" || node.org_type === "sub_agency")
    .sort((a, b) => getNodeTime(b) - getNodeTime(a) || b.id - a.id);
}

function CreateAgencyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [companyShortName, setCompanyShortName] = useState("");
  const [contactName, setContactName] = useState("");
  const [mobilePhone, setMobilePhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [orgType, setOrgType] = useState<"agency" | "sub_agency">("agency");
  const [parentId, setParentId] = useState<string>("root");
  const [commissionMode, setCommissionMode] = useState("percentage");
  const [commissionRate, setCommissionRate] = useState("0.1");
  const [discountRate, setDiscountRate] = useState("1");
  const [inviteCode, setInviteCode] = useState("");
  const [agencyStatus, setAgencyStatus] = useState("active");
  const [codePreview, setCodePreview] = useState("");
  const [agencies, setAgencies] = useState<PlatformNode[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const selectedParentId = parentId === "root" ? null : Number(parentId);
    void platformApi
      .nextOrganizationCode(orgType, selectedParentId)
      .then((result) => setCodePreview(result.code))
      .catch(() => setCodePreview(""));
    void platformApi.tree().then((result) => setAgencies(flattenAgencies(result.items || []))).catch(() => setAgencies([]));
  }, [open, orgType, parentId]);

  useEffect(() => {
    if (!open) {
      setName("");
      setCompanyShortName("");
      setContactName("");
      setMobilePhone("");
      setAddress("");
      setEmail("");
      setOrgType("agency");
      setParentId("root");
      setCommissionMode("percentage");
      setCommissionRate("0.1");
      setDiscountRate("1");
      setInviteCode("");
      setAgencyStatus("active");
      setCodePreview("");
      setSaving(false);
    }
  }, [open]);

  async function handleSubmit() {
    if (!name.trim()) {
      toast({ title: "请填写代理名称" });
      return;
    }
    if (!contactName.trim() || !mobilePhone.trim() || !address.trim() || !email.trim()) {
      toast({ title: "请完整填写联系人、手机号码、地址和邮箱" });
      return;
    }
    if (orgType === "sub_agency" && parentId === "root") {
      toast({ title: "二级代理必须选择上级代理" });
      return;
    }
    setSaving(true);
    try {
      await platformApi.createOrganization({
        name: name.trim(),
        org_type: orgType,
        parent_id: parentId === "root" ? null : Number(parentId),
        commission_mode: commissionMode,
        commission_rate: Number(commissionRate || "0"),
        discount_rate: Number(discountRate || "1"),
        invite_code: inviteCode.trim() || null,
        company_short_name: companyShortName.trim() || null,
        contact_name: contactName.trim(),
        mobile_phone: mobilePhone.trim(),
        address: address.trim(),
        email: email.trim(),
        status: agencyStatus,
      });
      toast({ title: "创建成功", description: `${name.trim()} 已加入总部代理树。` });
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast({ title: "创建失败", description: error instanceof Error ? error.message : "请稍后再试。" });
    } finally {
      setSaving(false);
    }
  }

  const availableParents = agencies;
  const fieldClassName =
    "h-10 border-slate-200 bg-slate-50/80 text-slate-900 shadow-sm transition focus-visible:border-cyan-500 focus-visible:bg-white focus-visible:ring-cyan-500/20";
  const selectClassName =
    "h-10 border-slate-200 bg-slate-50/80 text-slate-900 shadow-sm transition data-[placeholder]:text-slate-400 focus:ring-cyan-500/20";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DraggableDialogContent
        aria-describedby={undefined}
        resizable
        minWidth={360}
        minHeight={430}
        className="h-[min(88dvh,760px)] min-h-[430px] w-[min(94vw,920px)] max-w-[920px] gap-0 overflow-hidden rounded-2xl border border-cyan-100/80 bg-white p-0 shadow-[0_28px_90px_rgba(2,44,34,0.38)]"
      >
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader data-drag-handle className="relative cursor-move overflow-hidden border-b border-cyan-200/40 bg-gradient-to-br from-slate-950 via-emerald-950 to-cyan-950 px-5 py-4 pr-14 text-left sm:px-6">
            <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 left-1/3 h-32 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
            <div className="relative flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-200/25 bg-cyan-300/10 text-cyan-100 shadow-inner shadow-cyan-100/10">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-cyan-200/80">
                  <Sparkles className="h-3 w-3" />
                  AGENCY ONBOARDING · 01
                </div>
                <DialogTitle className="text-xl font-semibold tracking-tight text-white">代理注册</DialogTitle>
                <DialogDescription className="mt-1 max-w-2xl text-xs leading-5 text-cyan-50/70">
                  录入代理身份、联络资料与商务规则；创建后将写入总部代理组织树。
                </DialogDescription>
              </div>
              <GripHorizontal className="mt-1 h-5 w-5 shrink-0 text-cyan-100/45" aria-hidden="true" />
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(135deg,#f8fffe_0%,#f2fbff_48%,#f8fafc_100%)] px-5 py-5 sm:px-6">
            <div className="mb-5 grid gap-3 rounded-xl border border-cyan-100 bg-white/80 p-3 shadow-sm sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="flex items-center gap-2.5 text-xs text-slate-600">
                <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
                <span>必填信息完整后即可建立代理组织节点；编号由系统自动分配。</span>
              </div>
              <div className="rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2 text-left sm:text-right">
                <div className="text-[10px] font-medium tracking-wider text-cyan-700">SYSTEM ID</div>
                <div className="font-mono text-sm font-semibold text-slate-800">{codePreview || "生成中..."}</div>
              </div>
            </div>

            <div className="space-y-5">
              <section className="rounded-xl border border-slate-200/90 bg-white/85 p-4 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-600 text-[10px] font-bold text-white">01</span>
                  <h3 className="text-sm font-semibold text-slate-800">组织身份</h3>
                  <span className="text-xs text-slate-400">定义代理层级与企业主体</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">代理类型</Label>
                    <Select value={orgType} onValueChange={(value) => setOrgType(value as "agency" | "sub_agency")}>
                      <SelectTrigger className={selectClassName}><SelectValue placeholder="选择代理类型" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="agency">一级代理</SelectItem>
                        <SelectItem value="sub_agency">二级代理</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">自动编号</Label>
                    <Input value={codePreview || "生成中..."} readOnly className={`${fieldClassName} font-mono text-cyan-800`} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold text-slate-700">公司名称 <span className="text-rose-500">*</span></Label>
                    <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：一级代理01有限公司" className={fieldClassName} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold text-slate-700">公司简称</Label>
                    <Input value={companyShortName} onChange={(event) => setCompanyShortName(event.target.value)} placeholder="列表优先显示；留空则显示公司全称" className={fieldClassName} />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200/90 bg-white/85 p-4 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-600 text-[10px] font-bold text-white">02</span>
                  <h3 className="text-sm font-semibold text-slate-800">联络资料</h3>
                  <span className="text-xs text-slate-400">用于业务对接和通知</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">联系人 <span className="text-rose-500">*</span></Label>
                    <Input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="请输入联系人姓名" className={fieldClassName} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">手机号码 <span className="text-rose-500">*</span></Label>
                    <Input value={mobilePhone} onChange={(event) => setMobilePhone(event.target.value)} inputMode="tel" placeholder="请输入手机号码" className={fieldClassName} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold text-slate-700">地址 <span className="text-rose-500">*</span></Label>
                    <Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="请输入公司地址" className={fieldClassName} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold text-slate-700">邮箱 <span className="text-rose-500">*</span></Label>
                    <Input value={email} onChange={(event) => setEmail(event.target.value)} inputMode="email" placeholder="请输入邮箱" className={fieldClassName} />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200/90 bg-white/85 p-4 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-600 text-[10px] font-bold text-white">03</span>
                  <h3 className="text-sm font-semibold text-slate-800">商务规则</h3>
                  <span className="text-xs text-slate-400">归属、分佣与运营状态</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold text-slate-700">上级归属</Label>
                    <Select value={parentId} onValueChange={setParentId}>
                      <SelectTrigger className={selectClassName}><SelectValue placeholder="选择上级归属" /></SelectTrigger>
                      <SelectContent>
                        {orgType === "agency" ? <SelectItem value="root">总部直属</SelectItem> : null}
                        {availableParents.map((agency) => (
                          <SelectItem key={agency.id} value={String(agency.id)}>
                            {sanitizeDisplayText(agency.name, agency.code)} ({agency.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">分佣方式</Label>
                    <Select value={commissionMode} onValueChange={setCommissionMode}>
                      <SelectTrigger className={selectClassName}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">按比例</SelectItem>
                        <SelectItem value="fixed">固定金额</SelectItem>
                        <SelectItem value="tiered">阶梯分佣</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">分佣数值</Label>
                    <Input value={commissionRate} onChange={(event) => setCommissionRate(event.target.value)} inputMode="decimal" placeholder="0.1 = 10%" className={fieldClassName} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">折扣系数</Label>
                    <Input value={discountRate} onChange={(event) => setDiscountRate(event.target.value)} inputMode="decimal" placeholder="0.9 = 9 折" className={fieldClassName} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">邀请码</Label>
                    <Input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="留空则自动生成" className={fieldClassName} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold text-slate-700">状态</Label>
                    <Select value={agencyStatus} onValueChange={setAgencyStatus}>
                      <SelectTrigger className={selectClassName}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">正常</SelectItem>
                        <SelectItem value="pending">待审核</SelectItem>
                        <SelectItem value="disabled">已禁用</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-slate-200 bg-white/95 px-5 py-3 sm:px-6">
            <div className="mr-auto hidden items-center gap-1.5 text-[11px] text-slate-400 sm:flex">
              <GripHorizontal className="h-3.5 w-3.5" />
              可拖动顶部移动窗口，右下角可拖拉调整大小
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9 border-slate-200">取消</Button>
            <Button onClick={handleSubmit} disabled={saving} className="h-9 bg-gradient-to-r from-cyan-600 to-emerald-600 px-5 shadow-lg shadow-cyan-600/20 hover:from-cyan-700 hover:to-emerald-700">
              {saving ? "注册中..." : "确认注册"}
            </Button>
          </DialogFooter>
        </div>
      </DraggableDialogContent>
    </Dialog>
  );
}

/** Agency list intentionally shows the calendar date only. */
function formatAgencyCreatedAt(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}/${month}/${day}`;
}

/** Keep the directory's "newest first" order stable while an operator edits a row. */
function getOrganizationCreatedOrder(node: Pick<PlatformNode, "created_at" | "id">) {
  const value = node.created_at ? new Date(node.created_at).getTime() : 0;
  return Number.isFinite(value) ? value : node.id;
}

function getOrganizationSetting(node: PlatformNode, key: string) {
  const value = node.settings?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function EditAgencyDialog({
  agency,
  onClose,
  onUpdated,
}: {
  agency: PlatformNode | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState("");
  const [companyShortName, setCompanyShortName] = useState("");
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [companyLogoAssetId, setCompanyLogoAssetId] = useState<string | null>(null);
  const [companyLogoIcon, setCompanyLogoIcon] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [mobilePhone, setMobilePhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [commissionMode, setCommissionMode] = useState("percentage");
  const [commissionRate, setCommissionRate] = useState("0");
  const [discountRate, setDiscountRate] = useState("1");
  const [inviteCode, setInviteCode] = useState("");
  const [agencyStatus, setAgencyStatus] = useState("active");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!agency) return;
    setName(agency.name || "");
    setCompanyShortName(getOrganizationSetting(agency, "companyShortName"));
    setCompanyLogoUrl(getOrganizationSetting(agency, "companyLogoUrl") || null);
    setCompanyLogoAssetId(getOrganizationSetting(agency, "companyLogoAssetId") || null);
    setCompanyLogoIcon(getOrganizationSetting(agency, "companyLogoIcon") || null);
    setContactName(getOrganizationSetting(agency, "contactName"));
    setMobilePhone(getOrganizationSetting(agency, "mobilePhone"));
    setAddress(getOrganizationSetting(agency, "address"));
    setEmail(getOrganizationSetting(agency, "email"));
    setCommissionMode(agency.commission_mode || "percentage");
    setCommissionRate(String(agency.commission_rate ?? 0));
    setDiscountRate(String(agency.discount_rate ?? 1));
    setInviteCode(agency.invite_code || "");
    setAgencyStatus(agency.status || "active");
    setSaving(false);
  }, [agency]);

  async function handleSave() {
    if (!agency) return;
    if (!name.trim()) {
      toast({ title: "请填写公司名称" });
      return;
    }
    if (!contactName.trim() || !mobilePhone.trim() || !address.trim() || !email.trim()) {
      toast({ title: "请完整填写联系人、手机号码、地址和邮箱" });
      return;
    }

    setSaving(true);
    try {
      await platformApi.updateOrganization(agency.id, {
        name: name.trim(),
        company_short_name: companyShortName.trim() || null,
        company_logo_url: companyLogoUrl,
        company_logo_asset_id: companyLogoAssetId,
        company_logo_icon: companyLogoIcon,
        contact_name: contactName.trim(),
        mobile_phone: mobilePhone.trim(),
        address: address.trim(),
        email: email.trim(),
        commission_mode: commissionMode,
        commission_rate: Number(commissionRate || "0"),
        discount_rate: Number(discountRate || "1"),
        invite_code: inviteCode.trim() || null,
        status: agencyStatus,
      });
      toast({ title: "修改成功", description: `${name.trim()} 的资料已更新。` });
      onClose();
      onUpdated();
    } catch (error) {
      toast({ title: "修改失败", description: error instanceof Error ? error.message : "请稍后再试。" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(agency)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DraggableDialogContent
        aria-describedby={undefined}
        resizable
        minWidth={360}
        minHeight={420}
        className="h-[min(84dvh,680px)] min-h-[420px] w-[min(94vw,760px)] max-w-[760px] gap-0 overflow-hidden rounded-2xl border border-cyan-100 bg-white p-0 shadow-[0_24px_72px_rgba(2,44,34,0.32)]"
      >
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader data-drag-handle className="cursor-move border-b border-cyan-100 bg-gradient-to-r from-slate-950 via-emerald-950 to-cyan-950 px-5 py-4 pr-14 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-200/25 bg-cyan-300/10 text-cyan-100"><Edit3 className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg text-white">修改代理商信息</DialogTitle>
                <DialogDescription className="mt-1 truncate text-xs text-cyan-100/70">{agency?.code || "-"} · 不改变代理层级和归属，只更新资料与商务规则。</DialogDescription>
              </div>
              <GripHorizontal className="h-5 w-5 text-cyan-100/45" aria-hidden="true" />
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-5 py-5 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>公司名称 <span className="text-rose-500">*</span></Label>
                <Input value={name} onChange={(event) => setName(event.target.value)} className="h-10 bg-white" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>公司简称</Label>
                <Input value={companyShortName} onChange={(event) => setCompanyShortName(event.target.value)} placeholder="列表优先显示；留空则显示公司全称" className="h-10 bg-white" />
              </div>
              <ContentPluginIconSetting
                className="sm:col-span-2"
                label="公司商标"
                description="使用内容插件的图标设置：上传或复用公共图片素材"
                useCustomerSourceIconLibrary
                value={{ assetId: companyLogoAssetId, url: companyLogoUrl, iconName: companyLogoIcon }}
                onChange={({ assetId, url, iconName }) => {
                  setCompanyLogoAssetId(assetId);
                  setCompanyLogoUrl(url);
                  setCompanyLogoIcon(iconName || null);
                }}
              />
              <div className="space-y-1.5">
                <Label>联系人 <span className="text-rose-500">*</span></Label>
                <Input value={contactName} onChange={(event) => setContactName(event.target.value)} className="h-10 bg-white" />
              </div>
              <div className="space-y-1.5">
                <Label>手机号码 <span className="text-rose-500">*</span></Label>
                <Input value={mobilePhone} onChange={(event) => setMobilePhone(event.target.value)} inputMode="tel" className="h-10 bg-white" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>地址 <span className="text-rose-500">*</span></Label>
                <Input value={address} onChange={(event) => setAddress(event.target.value)} className="h-10 bg-white" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>邮箱 <span className="text-rose-500">*</span></Label>
                <Input value={email} onChange={(event) => setEmail(event.target.value)} inputMode="email" className="h-10 bg-white" />
              </div>
              <div className="space-y-1.5">
                <Label>分佣方式</Label>
                <Select value={commissionMode} onValueChange={setCommissionMode}>
                  <SelectTrigger className="h-10 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">按比例</SelectItem>
                    <SelectItem value="fixed">固定金额</SelectItem>
                    <SelectItem value="tiered">阶梯分佣</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>分佣数值</Label>
                <Input value={commissionRate} onChange={(event) => setCommissionRate(event.target.value)} inputMode="decimal" className="h-10 bg-white" />
              </div>
              <div className="space-y-1.5">
                <Label>折扣系数</Label>
                <Input value={discountRate} onChange={(event) => setDiscountRate(event.target.value)} inputMode="decimal" className="h-10 bg-white" />
              </div>
              <div className="space-y-1.5">
                <Label>邀请码</Label>
                <Input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="留空使用组织编号" className="h-10 bg-white" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>状态</Label>
                <Select value={agencyStatus} onValueChange={setAgencyStatus}>
                  <SelectTrigger className="h-10 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">正常</SelectItem>
                    <SelectItem value="pending">待审核</SelectItem>
                    <SelectItem value="disabled">已禁用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-slate-200 bg-white px-5 py-3">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-cyan-600 hover:bg-cyan-700">{saving ? "保存中..." : "保存修改"}</Button>
          </DialogFooter>
        </div>
      </DraggableDialogContent>
    </Dialog>
  );
}

function CreateEnterpriseDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [codePreview, setCodePreview] = useState("");
  const [agencies, setAgencies] = useState<PlatformNode[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void platformApi
      .nextOrganizationCode("client", parentId ? Number(parentId) : null)
      .then((result) => setCodePreview(result.code))
      .catch(() => setCodePreview(""));
    void platformApi.tree().then((result) => setAgencies(flattenAgencies(result.items || []))).catch(() => setAgencies([]));
  }, [open, parentId]);

  useEffect(() => {
    if (!open) {
      setName("");
      setParentId("");
      setCodePreview("");
      setSaving(false);
    }
  }, [open]);

  async function handleSubmit() {
    if (!name.trim()) {
      toast({ title: "请填写企业名称" });
      return;
    }
    if (!parentId) {
      toast({ title: "请选择所属代理" });
      return;
    }
    setSaving(true);
    try {
      await platformApi.createOrganization({
        name: name.trim(),
        org_type: "client",
        parent_id: Number(parentId),
      });
      toast({ title: "创建成功", description: `${name.trim()} 已加入企业列表。` });
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast({ title: "创建失败", description: error instanceof Error ? error.message : "请稍后再试。" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>新增企业</DialogTitle>
          <DialogDescription>总部端直接创建客户企业，自动生成 K 编号并挂到指定代理名下。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>自动编号</Label>
            <Input value={codePreview || "生成中..."} readOnly className="font-mono" />
          </div>
          <div className="space-y-2">
            <Label>企业名称</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：Machina Global Equipment Co., Ltd." />
          </div>
          <div className="space-y-2">
            <Label>所属代理</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue placeholder="选择所属代理" />
              </SelectTrigger>
              <SelectContent>
                {agencies.map((agency) => (
                  <SelectItem key={agency.id} value={String(agency.id)}>
                    {sanitizeDisplayText(agency.name, agency.code)} ({agency.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-cyan-600 hover:bg-cyan-700">
            {saving ? "创建中..." : "确认创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreatePlanDialog({
  open,
  onOpenChange,
  onCreated,
  clients,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  clients: PlatformNode[];
}) {
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [domain, setDomain] = useState("");
  const [notes, setNotes] = useState("");
  const [codePreview, setCodePreview] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void platformApi.nextProjectCode().then((result) => setCodePreview(result.code)).catch(() => setCodePreview(""));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setName("");
      setClientId("");
      setDomain("");
      setNotes("");
      setCodePreview("");
      setSaving(false);
    }
  }, [open]);

  async function handleSubmit() {
    if (!name.trim()) {
      toast({ title: "请填写计划名称" });
      return;
    }
    if (!clientId) {
      toast({ title: "请选择所属企业" });
      return;
    }
    setSaving(true);
    try {
      await platformApi.createProject({
        client_org_id: Number(clientId),
        name: notes.trim() ? `${name.trim()} - ${notes.trim()}` : name.trim(),
        domain: domain.trim() || null,
      });
      toast({ title: "创建成功", description: `${name.trim()} 已加入企业计划列表。` });
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast({ title: "创建失败", description: error instanceof Error ? error.message : "请稍后再试。" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>新增计划</DialogTitle>
          <DialogDescription>总部端直接创建网站计划，自动生成 J 编号并绑定到指定企业。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>自动编号</Label>
            <Input value={codePreview || "生成中..."} readOnly className="font-mono" />
          </div>
          <div className="space-y-2">
            <Label>计划名称</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：独立站多语言正式版" />
          </div>
          <div className="space-y-2">
            <Label>所属企业</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="选择所属企业" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={String(client.id)}>
                    {sanitizeDisplayText(client.name, client.code)} ({client.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>访问域名</Label>
            <Input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="例如：machina-global.local" />
          </div>
          <div className="space-y-2">
            <Label>计划备注</Label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="这里可补充行业、语种、用途等说明。" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-cyan-600 hover:bg-cyan-700">
            {saving ? "创建中..." : "确认创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildSiteAdminRoute(baseRoute: string, siteId: string) {
  return `${baseRoute}?siteId=${encodeURIComponent(siteId)}`;
}

function parseSiteTime(value?: string) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function sortSitesLatestFirst(sites: PublishedSite[]) {
  return [...sites].sort((a, b) => {
    const updatedDiff = parseSiteTime(b.updatedAt) - parseSiteTime(a.updatedAt);
    if (updatedDiff !== 0) return updatedDiff;
    const createdDiff = parseSiteTime(b.createdAt) - parseSiteTime(a.createdAt);
    if (createdDiff !== 0) return createdDiff;
    return b.id.localeCompare(a.id);
  });
}

function deriveDomainLabel(site: PublishedSite) {
  const publicUrl = getSitePublicUrl(site);
  try {
    const parsed = new URL(publicUrl);
    if (parsed.hostname === "127.0.0.1") {
      return `${parsed.hostname}:${parsed.port}${site.urlPath || parsed.pathname}`;
    }
    return parsed.host;
  } catch {
    return site.publicUrl || site.urlPath || "-";
  }
}

function buildSiteAgencyChain(site: PublishedSite) {
  const names = [site.agencyName, (site as PublishedSite & { subAgencyName?: string | null }).subAgencyName]
    .map((value) => sanitizeDisplayText(value, ""))
    .filter(Boolean);
  const codes = [site.agencyCode, (site as PublishedSite & { subAgencyCode?: string | null }).subAgencyCode].filter(Boolean);
  return {
    nameText: names.join(" / "),
    codeText: codes.join(" / "),
  };
}

function resolveSiteAgencySummary(
  site: PublishedSite,
  clientLookup: Map<string, PlatformNode>,
  parentMap: Map<number, PlatformNode>
) {
  const clientCode = (site.clientCode || "").trim().toUpperCase();
  const client = clientLookup.get(clientCode) || null;
  const chain = client ? getAgencyChain(client, parentMap) : [];
  const directAgency = chain[chain.length - 1] || null;

  if (chain.length) {
    return {
      chainNameText: chain.map((agency) => sanitizeDisplayText(agency.name, agency.code)).join(" / "),
      chainCodeText: chain.map((agency) => agency.code).join(" / "),
      directAgencyName: sanitizeDisplayText(directAgency?.name, directAgency?.code || "-"),
      directAgencyCode: directAgency?.code || "-",
    };
  }

  const fallbackChain = buildSiteAgencyChain(site);
  const siteExt = site as PublishedSite & { subAgencyName?: string | null; subAgencyCode?: string | null };
  return {
    chainNameText: fallbackChain.nameText,
    chainCodeText: fallbackChain.codeText,
    directAgencyName: sanitizeDisplayText(siteExt.subAgencyName || site.agencyName, siteExt.subAgencyCode || site.agencyCode || "-"),
    directAgencyCode: siteExt.subAgencyCode || site.agencyCode || "-",
  };
}

function usePublishedSites() {
  const [sites, setSites] = useState<PublishedSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const items = await fetchAllSitesFromBackend();
        if (!mounted) return;
        setSites(sortSitesLatestFirst(items.filter((site) => (site.scope || "client") === "client")));
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "加载站点失败");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return { sites, loading, error };
}

export function HQAgenciesLive({ partnerMode = false }: { partnerMode?: boolean } = {}) {
  const { tree, loading, error, refresh } = usePlatformTree();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState<PlatformNode | null>(null);
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const agencies = useMemo(
    () =>
      allNodes
        .filter((node) => node.org_type === "agency" || node.org_type === "sub_agency")
        .sort((a, b) => getOrganizationCreatedOrder(b) - getOrganizationCreatedOrder(a) || b.id - a.id),
    [allNodes]
  );

  const stats = useMemo(
    () => [
      { label: "代理商总数", value: agencies.length },
      { label: "下属客户", value: allNodes.filter((node) => node.org_type === "client").length },
      { label: "下属计划", value: allNodes.reduce((sum, node) => sum + node.projects.length, 0) },
      { label: "最新代理", value: agencies[0]?.code || "-" },
    ],
    [agencies, allNodes]
  );
  const requiresLogin = /^(401|403)\b/.test(error);
  const copy = partnerMode
    ? {
        title: "合伙人列表",
        subtitle: "代理源可查看多级合伙人，并开通下级合伙人形成三级代理树",
        create: "开通合伙人",
        search: "搜索合伙人名称",
        organizationColumn: "合伙人",
      }
    : {
        title: "代理商列表",
        subtitle: "总部真实组织树中的多级代理",
        create: "代理注册",
        search: "搜索代理商名称",
        organizationColumn: "代理商",
      };

  return (
    <FactoryPage
      pageId={partnerMode ? "agency-source-partners-live" : "hq-agencies-live"}
      template="list"
      sourceScope={partnerMode ? "agency_source" : "hq"}
      autoRegions
    >
      <div className="space-y-6">
      <PageHeader
        title={copy.title}
        sub={copy.subtitle}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              导出
            </Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {copy.create}
            </Button>
          </div>
        }
      />
      <StatsRow items={stats} />
      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col gap-3 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {requiresLogin
                ? "总部空登录尚未建立或已过期。请使用顶栏右侧“总部端空登录”后重新读取代理商列表。"
                : `代理数据加载失败：${error}`}
            </span>
          </CardContent>
        </Card>
      ) : null}
      {loading ? (
        <Card className="border-slate-200">
          <CardContent className="p-5 text-sm text-slate-500">正在加载代理商列表...</CardContent>
        </Card>
      ) : (
        <DataTable
          compact
          search={copy.search}
          columns={["序号", "进入", copy.organizationColumn, "上级", "客户数", "计划数", "分佣", "折扣", "邀请码", "创建时间", "状态", "操作"]}
          rows={agencies.map((agency, index) => {
            const parent = agency.parent_id ? parentMap.get(agency.parent_id) : null;
            const commissionValue = formatCommissionValue(agency.commission_mode, agency.commission_rate);
            const discountValue =
              agency.discount_rate != null ? `${(Number(agency.discount_rate) * 10).toFixed(1)} 折` : "-";
            const companyLogoUrl = getOrganizationSetting(agency, "companyLogoUrl");
            const companyLogoIconName = getOrganizationSetting(agency, "companyLogoIcon");
            const CompanyLogoIcon = ICON_OPTIONS.find((option) => option.name === companyLogoIconName)?.icon || Building2;
            const companyDisplayName = getOrganizationSetting(agency, "companyShortName") || sanitizeDisplayText(agency.name, agency.code);
            return [
              <ContentPluginOrderBadge order={agencies.length - index} className="mx-auto" />,
              <Link
                to={`/dl?agency=${encodeURIComponent(agency.code)}`}
                className="inline-flex h-8 items-center rounded-md border border-violet-200 bg-violet-50 px-2.5 text-xs font-medium text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 hover:text-violet-800"
                title={`进入 ${sanitizeDisplayText(agency.name, agency.code)} 的代理端`}
              >
                进入
              </Link>,
              <span className="flex min-w-[8rem] items-center gap-2 font-medium text-slate-900" title={companyDisplayName}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-slate-500">
                  {companyLogoUrl ? <img src={companyLogoUrl} alt="" className="h-full w-full object-contain p-0.5" /> : <CompanyLogoIcon className="h-4 w-4" aria-hidden="true" />}
                </span>
                <span className="min-w-0 truncate">{companyDisplayName}</span>
              </span>,
              parent ? (
                <span className="block min-w-[7rem] truncate text-sm text-slate-700" title={sanitizeDisplayText(parent.name, parent.code)}>
                  {sanitizeDisplayText(parent.name, parent.code)}
                </span>
              ) : <span className="text-sm text-slate-600">总部</span>,
              <span className="block text-center font-semibold">{countClientDescendants(agency)}</span>,
              <span className="block text-center font-semibold">{countProjectDescendants(agency)}</span>,
              <span className="text-xs text-slate-700">{commissionValue}</span>,
              <span className="text-xs text-slate-700">{discountValue}</span>,
              <span className="font-mono text-xs text-cyan-700">{agency.invite_code || "-"}</span>,
              <span className="text-xs text-slate-500">{formatAgencyCreatedAt(agency.created_at)}</span>,
              <StatusBadge status={agency.status} />,
              <TableActions onEdit={() => setEditingAgency(agency)} />,
            ];
          })}
        />
      )}
      <CreateAgencyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          refresh();
        }}
      />
      <EditAgencyDialog
        agency={editingAgency}
        onClose={() => setEditingAgency(null)}
        onUpdated={refresh}
        />
      </div>
    </FactoryPage>
  );
}

export function HQEnterprisesLive() {
  const { tree, loading, error, refresh } = usePlatformTree();
  const [createOpen, setCreateOpen] = useState(false);
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const enterprises = useMemo(
    () =>
      allNodes
        .filter((node) => node.org_type === "client")
        .sort((a, b) => getNodeTime(b) - getNodeTime(a)),
    [allNodes]
  );

  const stats = useMemo(
    () => [
      { label: "企业总数", value: enterprises.length },
      { label: "计划总数", value: enterprises.reduce((sum, enterprise) => sum + enterprise.projects.length, 0) },
      {
        label: "运行中计划",
        value: enterprises.reduce(
          (sum, enterprise) => sum + enterprise.projects.filter((project) => project.status === "active").length,
          0
        ),
      },
      { label: "最新客户", value: enterprises[0]?.code || "-" },
    ],
    [enterprises]
  );

  return (
    <FactoryPage pageId="hq-enterprises-live" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="外贸企业列表"
        sub="总部可查看全部客户企业及对应计划"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              导出
            </Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              新增企业
            </Button>
          </div>
        }
      />
      <StatsRow items={stats} />
      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">企业数据加载失败：{error}</CardContent>
        </Card>
      ) : null}
      {loading ? (
        <Card className="border-slate-200">
          <CardContent className="p-5 text-sm text-slate-500">正在加载企业列表...</CardContent>
        </Card>
      ) : (
        <DataTable
          search="搜索企业名称、编号或所属代理"
          columns={["企业", "代理链路", "直属代理", "计划数", "最新计划", "企业编号", "注册时间", "状态"]}
          rows={enterprises.map((enterprise) => {
            const chain = getAgencyChain(enterprise, parentMap);
            const directAgency = chain[chain.length - 1] || null;
            const latestProject = [...enterprise.projects].sort((a, b) => getNodeTime(b) - getNodeTime(a))[0];
            return [
              <div>
                <div className="font-medium">{sanitizeDisplayText(enterprise.name, enterprise.code)}</div>
                <div className="font-mono text-[11px] text-slate-500">{enterprise.code}</div>
              </div>,
              renderAgencyChain(enterprise, parentMap),
              directAgency ? (
                <div>
                  <div className="text-sm text-cyan-700">{sanitizeDisplayText(directAgency.name, directAgency.code)}</div>
                  <div className="font-mono text-[11px] text-slate-500">{directAgency.code}</div>
                </div>
              ) : (
                <span className="text-xs text-slate-400">-</span>
              ),
              <span className="block text-center font-semibold">{enterprise.projects.length}</span>,
              latestProject ? (
                <div>
                  <div className="font-medium text-slate-900">{sanitizeDisplayText(latestProject.name, latestProject.code)}</div>
                  <div className="font-mono text-[11px] text-slate-500">{latestProject.code}</div>
                </div>
              ) : (
                <span className="text-xs text-slate-400">暂无计划</span>
              ),
              <span className="font-mono text-xs text-slate-600">{enterprise.code}</span>,
              <span className="text-xs text-slate-500">{formatDateLabel(enterprise.created_at)}</span>,
              <StatusBadge status={enterprise.status} />,
            ];
          })}
        />
      )}
      <CreateEnterpriseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          refresh();
        }}
        />
      </div>
    </FactoryPage>
  );
}

export function HQPlansLive() {
  const { tree, loading, error, refresh } = usePlatformTree();
  const [createOpen, setCreateOpen] = useState(false);
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const clients = useMemo(() => flattenClients(tree), [tree]);
  const plans = useMemo(
    () =>
      allNodes
        .filter((node) => node.org_type === "client")
        .flatMap((client) => client.projects.map((project) => ({ ...project, client })))
        .sort((a, b) => getNodeTime(b) - getNodeTime(a)),
    [allNodes]
  );

  const stats = useMemo(
    () => [
      { label: "总部计划总数", value: plans.length },
      { label: "运行中计划", value: plans.filter((plan) => plan.status === "active").length },
      { label: "覆盖客户数", value: new Set(plans.map((plan) => plan.client.code)).size },
      { label: "最新计划", value: plans[0]?.code || "-" },
    ],
    [plans]
  );

  return (
    <FactoryPage pageId="hq-plans-live" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="企业计划列表"
        sub="总部实时查看全部代理、客户与对应计划的真实数据链路"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              导出
            </Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              新增计划
            </Button>
          </div>
        }
      />
      <StatsRow items={stats} />
      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">总部计划数据加载失败：{error}</CardContent>
        </Card>
      ) : null}
      {loading ? (
        <Card className="border-slate-200">
          <CardContent className="p-5 text-sm text-slate-500">正在加载总部真实计划列表...</CardContent>
        </Card>
      ) : (
        <DataTable
          search="搜索计划名称、计划编号、客户编号或代理编号"
          columns={["计划", "客户企业", "代理链路", "直属代理", "访问域名", "创建时间", "状态", "操作"]}
          rows={plans.map((plan) => {
            const chain = getAgencyChain(plan.client, parentMap);
            const directAgency = chain[chain.length - 1] || null;
            return [
              <div>
                <div className="font-medium text-slate-900">{sanitizeDisplayText(plan.name, plan.code)}</div>
                <div className="font-mono text-[11px] text-slate-500">{plan.code}</div>
              </div>,
              <div>
                <div className="font-medium text-slate-900">{sanitizeDisplayText(plan.client.name, plan.client.code)}</div>
                <div className="font-mono text-[11px] text-slate-500">{plan.client.code}</div>
              </div>,
              renderAgencyChain(plan.client, parentMap),
              directAgency ? (
                <div>
                  <div className="font-medium text-slate-900">{sanitizeDisplayText(directAgency.name, directAgency.code)}</div>
                  <div className="font-mono text-[11px] text-slate-500">{directAgency.code}</div>
                </div>
              ) : (
                <span className="text-xs text-slate-400">-</span>
              ),
              <span className="text-xs text-slate-600">{plan.domain || "-"}</span>,
              <span className="text-xs text-slate-500">{formatDateLabel(plan.created_at)}</span>,
              <StatusBadge status={plan.status} />,
              <TableActions />,
            ];
          })}
        />
      )}
      <CreatePlanDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          refresh();
        }}
        clients={clients}
        />
      </div>
    </FactoryPage>
  );
}

export function HQSitesLive() {
  const { tree } = usePlatformTree();
  const { sites, loading, error } = usePublishedSites();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const clientLookup = useMemo(
    () =>
      new Map(
        allNodes
          .filter((node) => node.org_type === "client")
          .map((node) => [node.code.trim().toUpperCase(), node])
      ),
    [allNodes]
  );

  const stats = useMemo(
    () => [
      { label: "已发布站点", value: sites.length },
      { label: "覆盖代理", value: new Set(sites.map((site) => site.agencyCode).filter(Boolean)).size },
      { label: "覆盖客户", value: new Set(sites.map((site) => site.clientCode).filter(Boolean)).size },
      { label: "最新站点", value: sites[0]?.planCode || sites[0]?.id || "-" },
    ],
    [sites]
  );

  return (
    <FactoryPage pageId="hq-sites-live" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="站点列表"
        sub="总部实时查看全部已发布网站与所属代理、客户、计划"
        action={
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            导出
          </Button>
        }
      />
      <StatsRow items={stats} />
      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">站点数据加载失败：{error}</CardContent>
        </Card>
      ) : null}
      {loading ? (
        <Card className="border-slate-200">
          <CardContent className="p-5 text-sm text-slate-500">正在加载总部已发布站点列表...</CardContent>
        </Card>
      ) : (
        <DataTable
          search="搜索计划编号、客户编号、代理编号或站点名称"
          columns={["站点", "客户企业", "代理链路", "直属代理", "计划编号", "访问网站", "本地目录", "更新时间", "状态", "后台"]}
          rows={sites.map((site) => {
            const summary = resolveSiteAgencySummary(site, clientLookup, parentMap);
            return [
              <div>
                <div className="font-medium text-slate-900">{sanitizeDisplayText(site.planName || site.name, site.id)}</div>
                <div className="font-mono text-[11px] text-slate-500">{site.id}</div>
              </div>,
              <div>
                <div className="font-medium text-slate-900">{sanitizeDisplayText(site.clientName, site.clientCode || "-")}</div>
                <div className="font-mono text-[11px] text-slate-500">{site.clientCode || "-"}</div>
              </div>,
              summary.chainNameText ? (
                <div>
                  <div className="text-sm text-slate-900">{summary.chainNameText}</div>
                  <div className="font-mono text-[11px] text-slate-500">{summary.chainCodeText || "-"}</div>
                </div>
              ) : (
                <span className="text-xs text-slate-400">-</span>
              ),
              <div>
                <div className="font-medium text-slate-900">{summary.directAgencyName}</div>
                <div className="font-mono text-[11px] text-slate-500">{summary.directAgencyCode}</div>
              </div>,
              <span className="font-mono text-xs text-slate-600">{site.planCode || "-"}</span>,
              <a
                href={getSitePublicUrl(site)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-cyan-700 hover:underline"
              >
                {deriveDomainLabel(site)}
              </a>,
              <span className="text-xs text-slate-500">{site.urlPath || "-"}</span>,
              <span className="text-xs text-slate-500">{formatDateLabel(site.updatedAt || site.createdAt)}</span>,
              <StatusBadge status="online" />,
              <Link to={buildSiteAdminRoute("/zb/kh/company-info", site.id)}>
                <Button size="sm" className="h-8 bg-slate-900 text-white hover:bg-slate-800">
                  进入后台
                </Button>
              </Link>,
            ];
          })}
        />
        )}
      </div>
    </FactoryPage>
  );
}

export function HQDomainsLive() {
  const { tree } = usePlatformTree();
  const { sites, loading, error } = usePublishedSites();
  const allNodes = useMemo(() => flattenPlatformTree(tree), [tree]);
  const parentMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const clientLookup = useMemo(
    () =>
      new Map(
        allNodes
          .filter((node) => node.org_type === "client")
          .map((node) => [node.code.trim().toUpperCase(), node])
      ),
    [allNodes]
  );

  const domainRows = useMemo(
    () =>
      sites.map((site) => ({
        id: site.id,
        domain: deriveDomainLabel(site),
        planName: sanitizeDisplayText(site.planName || site.name, site.planCode || site.id),
        planCode: site.planCode || "-",
        agencyName: sanitizeDisplayText(site.agencyName, site.agencyCode || "-"),
        publicUrl: getSitePublicUrl(site),
        updatedAt: site.updatedAt || site.createdAt,
      })),
    [sites]
  );

  const stats = useMemo(
    () => [
      { label: "访问地址总数", value: domainRows.length },
      { label: "本地预览地址", value: domainRows.filter((row) => row.publicUrl.includes("127.0.0.1:3004")).length },
      { label: "最新计划地址", value: domainRows[0]?.planCode || "-" },
      { label: "最新更新时间", value: domainRows[0] ? formatDateLabel(domainRows[0].updatedAt) : "-" },
    ],
    [domainRows]
  );

  return (
    <FactoryPage pageId="hq-domains-live" template="list" sourceScope="hq" autoRegions>
      <div className="space-y-6">
      <PageHeader
        title="域名管理"
        sub="总部统一查看已发布网站访问地址、计划归属与更新时间"
        action={
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            导出
          </Button>
        }
      />
      <StatsRow items={stats} />
      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">域名数据加载失败：{error}</CardContent>
        </Card>
      ) : null}
      {loading ? (
        <Card className="border-slate-200">
          <CardContent className="p-5 text-sm text-slate-500">正在加载站点访问地址...</CardContent>
        </Card>
      ) : (
        <DataTable
          search="搜索访问地址、计划编号或代理编号"
          columns={["访问地址", "所属计划", "代理链路", "直属代理", "SSL", "访问网站", "最近更新", "状态", "后台"]}
          rows={domainRows.map((row) => {
            const site = sites.find((item) => item.id === row.id);
            const summary = site
              ? resolveSiteAgencySummary(site, clientLookup, parentMap)
              : { chainNameText: "", chainCodeText: "", directAgencyName: "-", directAgencyCode: "-" };
            return [
              <div>
                <div className="font-mono text-xs text-cyan-700">{row.domain}</div>
                <div className="font-mono text-[11px] text-slate-500">{row.planCode}</div>
              </div>,
              <span className="text-sm text-slate-900">{row.planName}</span>,
              summary.chainNameText ? (
                <div>
                  <div className="text-sm text-slate-900">{summary.chainNameText}</div>
                  <div className="font-mono text-[11px] text-slate-500">{summary.chainCodeText || "-"}</div>
                </div>
              ) : (
                <span className="text-xs text-slate-400">-</span>
              ),
              <div>
                <div className="text-sm text-slate-700">{summary.directAgencyName}</div>
                <div className="font-mono text-[11px] text-slate-500">{summary.directAgencyCode}</div>
              </div>,
              <Badge variant="outline" className="text-xs">
                本地预览 SSL
              </Badge>,
              <a href={row.publicUrl} target="_blank" rel="noreferrer" className="text-xs text-cyan-700 hover:underline">
                打开网站
              </a>,
              <span className="text-xs text-slate-500">{formatDateLabel(row.updatedAt)}</span>,
              <StatusBadge status="online" />,
              <Link to={buildSiteAdminRoute("/zb/kh/company-info", row.id)}>
                <Button size="sm" className="h-8 bg-slate-900 text-white hover:bg-slate-800">
                  进入后台
                </Button>
              </Link>,
            ];
          })}
        />
        )}
      </div>
    </FactoryPage>
  );
}
