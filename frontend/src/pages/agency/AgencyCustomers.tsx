import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { Input } from "@/components/ui/input";
import { Mail, Phone, Plus, Search } from "lucide-react";

import { collectAgencyClients, loadAgencyLiveSnapshot } from "@/lib/agency-live-data";
import { provisionClientPlan } from "@/lib/business-operations";
import { sanitizeDisplayText } from "@/lib/text-sanitizer";
import type { PlatformNode } from "@/lib/platform-api";

type CustomerRow = {
  customer: PlatformNode;
  parent: PlatformNode | null;
  latestPlan: PlatformNode["projects"][number] | null;
};

const statusMap: Record<string, { label: string; cls: string }> = {
  active: { label: "使用中", cls: "bg-emerald-100 text-emerald-700" },
  trial: { label: "试用", cls: "bg-blue-100 text-blue-700" },
  paused: { label: "已暂停", cls: "bg-slate-100 text-slate-700" },
  disabled: { label: "已禁用", cls: "bg-slate-100 text-slate-700" },
};

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

function StatusBadge({ status }: { status: string }) {
  const info = statusMap[status] || { label: sanitizeDisplayText(status, "未知"), cls: "bg-slate-100 text-slate-700" };
  return <Badge className={`${info.cls} hover:${info.cls}`}>{info.label}</Badge>;
}

export default function AgencyCustomers() {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadAgencyLiveSnapshot>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showProvision, setShowProvision] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ clientName: "", clientCode: "", planName: "", planCode: "" });

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const next = await loadAgencyLiveSnapshot();
        if (!mounted) return;
        setSnapshot(next);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "加载客户数据失败");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    const refresh = () => void load();
    window.addEventListener("storage", refresh);
    window.addEventListener("sites-updated", refresh);
    window.addEventListener("site-project-version-updated", refresh);

    return () => {
      mounted = false;
      window.removeEventListener("storage", refresh);
      window.removeEventListener("sites-updated", refresh);
      window.removeEventListener("site-project-version-updated", refresh);
    };
  }, []);

  const customerRows = useMemo<CustomerRow[]>(() => {
    if (!snapshot?.currentAgency) return [];
    return collectAgencyClients(snapshot.currentAgency).map((customer) => ({
      customer,
      parent: customer.parent_id ? snapshot.parentMap.get(customer.parent_id) || null : snapshot.currentAgency,
      latestPlan:
        [...customer.projects].sort((a, b) => {
          const updatedDiff = Date.parse(b.updated_at || "") - Date.parse(a.updated_at || "");
          if (updatedDiff !== 0) return updatedDiff;
          const createdDiff = Date.parse(b.created_at || "") - Date.parse(a.created_at || "");
          if (createdDiff !== 0) return createdDiff;
          return b.id - a.id;
        })[0] || null,
    }));
  }, [snapshot]);

  const stats = useMemo(
    () => [
      { label: "客户总数", value: customerRows.length },
      { label: "最新客户", value: customerRows[0]?.customer.code || "-" },
      { label: "计划总数", value: customerRows.reduce((sum, row) => sum + row.customer.projects.length, 0) },
      { label: "当前代理", value: snapshot?.currentAgency?.code || "-" },
    ],
    [customerRows, snapshot]
  );

  const createCustomerPlan = async () => {
    if (!snapshot?.currentAgency) return;
    if (!form.clientName.trim() || !form.clientCode.trim() || !form.planName.trim() || !form.planCode.trim()) {
      setError("请填写客户名称、客户编号、计划名称和计划编号。");
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      await provisionClientPlan({ agencyOrgId: snapshot.currentAgency.id, ...form });
      setShowProvision(false);
      setForm({ clientName: "", clientCode: "", planName: "", planCode: "" });
      setSnapshot(await loadAgencyLiveSnapshot());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "客户源计划创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FactoryPage pageId="agency-customers" template="list" sourceScope="agency_source" className="space-y-6">
      <div data-page-factory-region="content" data-development-standard-frame-region="content" data-development-standard-frame-label="内容" className="space-y-6">
      <div data-page-factory-region="title-2" data-development-standard-frame-region="title-2" data-development-standard-frame-label="标题二" className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">客户管理</h1>
          <p className="mt-1 text-sm text-slate-500">当前代理下的真实客户列表，按最新优先显示。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">批量导入</Button>
          <Button className="bg-violet-600 hover:bg-violet-700" onClick={() => setShowProvision(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新增客户
          </Button>
        </div>
      </div>

      {showProvision ? (
        <Card className="border-violet-200 bg-violet-50/40">
          <CardContent className="space-y-4 p-5">
            <div><div className="font-semibold text-slate-900">注册客户并创建客户源计划</div><p className="mt-1 text-sm text-slate-600">计划会自动绑定当前代理链可用的客户源模板；后续总部或上级代理发布更新时可预览、同步和回退。</p>{!snapshot?.currentAgency ? <p className="mt-2 text-sm text-amber-700">正在识别当前代理，请稍候后提交。</p> : null}</div>
            <div className="grid gap-3 md:grid-cols-2">
              {([['clientName', '客户名称'], ['clientCode', '客户编号'], ['planName', '计划名称'], ['planCode', '计划编号']] as const).map(([key, label]) => (
                <label key={key} className="space-y-1 text-sm font-medium text-slate-700"><span>{label}</span><Input value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>
              ))}
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowProvision(false)} disabled={submitting}>取消</Button><Button className="bg-violet-600 hover:bg-violet-700" onClick={() => void createCustomerPlan()} disabled={submitting || !snapshot?.currentAgency}>{submitting ? "正在创建..." : "注册并创建计划"}</Button></div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {stats.map((item) => (
          <Card key={item.label} className="border-slate-200">
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">{item.label}</div>
              <div className="text-2xl font-bold text-slate-900">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">客户数据加载失败：{error}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card className="border-slate-200">
          <CardContent className="p-5 text-sm text-slate-500">正在加载真实客户数据...</CardContent>
        </Card>
      ) : (
        <Card data-page-factory-region="table-shell" data-development-standard-frame-region="table-shell" data-development-standard-frame-label="表内" className="border-slate-200">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b border-slate-200 p-4">
              <Search className="h-4 w-4 text-slate-400" />
              <Input placeholder="搜索客户名称、客户编号或计划编号" className="h-8 flex-1 border-0 shadow-none focus-visible:ring-0" />
              <Button variant="outline" size="sm">
                筛选
              </Button>
            </div>
            <div data-page-factory-region="scrollbar" data-development-standard-frame-region="scrollbar" data-development-standard-frame-label="滚动条" className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead data-page-factory-region="table-header" data-development-standard-frame-region="table-header" data-development-standard-frame-label="表头" className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">客户</th>
                    <th className="px-4 py-3 text-left font-medium">上级代理</th>
                    <th className="px-4 py-3 text-center font-medium">计划数量</th>
                    <th className="px-4 py-3 text-left font-medium">最新计划</th>
                    <th className="px-4 py-3 text-left font-medium">客户编号</th>
                    <th className="px-4 py-3 text-left font-medium">创建时间</th>
                    <th className="px-4 py-3 text-left font-medium">状态</th>
                    <th className="px-4 py-3 text-center font-medium">进入</th>
                    <th className="px-4 py-3 text-center font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {customerRows.map((row) => (
                    <tr key={row.customer.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{sanitizeDisplayText(row.customer.name, row.customer.code)}</div>
                        <div className="font-mono text-[11px] text-slate-500">{row.customer.code}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-cyan-700">
                        {row.parent ? sanitizeDisplayText(row.parent.name, row.parent.code) : "-"}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">{row.customer.projects.length}</td>
                      <td className="px-4 py-3">
                        {row.latestPlan ? (
                          <div>
                            <div className="font-medium text-slate-900">
                              {sanitizeDisplayText(row.latestPlan.name, row.latestPlan.code)}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500">{row.latestPlan.code}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">暂无计划</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.customer.code}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDateLabel(row.customer.created_at)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.customer.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          to={`/kh?client=${encodeURIComponent(row.customer.code)}${row.latestPlan ? `&plan=${encodeURIComponent(row.latestPlan.code)}` : ""}`}
                          className="inline-flex h-8 items-center rounded-md border border-violet-200 bg-violet-50 px-2.5 text-xs font-medium text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 hover:text-violet-800"
                          title={`进入 ${sanitizeDisplayText(row.customer.name, row.customer.code)} 的客户源后台`}
                        >
                          进入
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <Mail className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <Phone className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </FactoryPage>
  );
}
