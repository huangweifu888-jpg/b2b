import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Gauge, RefreshCw, Save, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { platformApi, type PlatformOrganization, type TenantHealthReport, type TenantQuotaStatus } from "@/lib/platform-api";
import { FactoryPage } from "@/page-factory/FactoryPage";

const RESOURCE_LABEL: Record<TenantQuotaStatus["resource"], string> = {
  agencies: "一级代理",
  sub_agencies: "下级代理",
  clients: "客户",
  plans: "计划",
};

const resourcesFor = (organization?: PlatformOrganization) => {
  if (!organization) return [] as TenantQuotaStatus["resource"][];
  if (organization.org_type === "hq") return ["agencies"] as const;
  if (organization.org_type === "client") return ["plans"] as const;
  return ["sub_agencies", "clients"] as const;
};

function statusVariant(status: TenantQuotaStatus["status"]): "default" | "secondary" | "destructive" | "outline" {
  return status === "blocked" ? "destructive" : status === "warning" ? "outline" : "secondary";
}

export default function TenantGovernance() {
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [quotas, setQuotas] = useState<TenantQuotaStatus[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [health, setHealth] = useState<TenantHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const selected = useMemo(() => organizations.find((item) => String(item.id) === selectedId) || null, [organizations, selectedId]);
  const managedOrganizations = useMemo(
    () => organizations
      .filter((item) => ["hq", "agency", "sub_agency", "client"].includes(item.org_type))
      .sort((left, right) => left.code.localeCompare(right.code)),
    [organizations]
  );

  const load = useCallback(async (organizationId?: number) => {
    try {
      setLoading(true);
      setLoadError(null);
      const [orgResponse, healthResponse] = await Promise.all([
        platformApi.organizations(),
        platformApi.tenantHealth(organizationId),
      ]);
      const nextOrganizations = orgResponse.items || [];
      setOrganizations(nextOrganizations);
      setHealth(healthResponse);
      const nextId = organizationId || nextOrganizations.find((item) => item.org_type === "hq")?.id;
      if (nextId) {
        setSelectedId(String(nextId));
        const quotaResponse = await platformApi.organizationQuotaStatus(nextId);
        setQuotas(quotaResponse.items || []);
        setDraft(Object.fromEntries((quotaResponse.items || []).map((item) => [item.resource, String(item.limit)])));
      }
    } catch (error) {
      setLoadError("请先使用顶部“总部端空登录”进入本地总部会话，再读取真实租户治理数据。");
      toast({ title: "租户治理数据加载失败", description: error instanceof Error ? error.message : "请稍后重试", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectOrganization = async (value: string) => {
    setSelectedId(value);
    try {
      const [quotaResponse, healthResponse] = await Promise.all([
        platformApi.organizationQuotaStatus(Number(value)),
        platformApi.tenantHealth(Number(value)),
      ]);
      setQuotas(quotaResponse.items || []);
      setDraft(Object.fromEntries((quotaResponse.items || []).map((item) => [item.resource, String(item.limit)])));
      setHealth(healthResponse);
    } catch (error) {
      setLoadError("当前会话无法读取该组织；请确认总部本地会话仍有效后重试。");
      toast({ title: "组织治理数据加载失败", description: error instanceof Error ? error.message : "请稍后重试", variant: "destructive" });
    }
  };

  const save = async () => {
    if (!selected) return;
    const values: Record<string, number> = {};
    for (const resource of resourcesFor(selected)) {
      const parsed = Number(draft[resource]);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1_000_000) {
        toast({ title: "配额格式不正确", description: `${RESOURCE_LABEL[resource]}必须是 0 到 1,000,000 的整数。`, variant: "destructive" });
        return;
      }
      values[resource] = parsed;
    }
    try {
      setSaving(true);
      await platformApi.updateOrganization(selected.id, { quota_limits: values });
      toast({ title: "配额已保存", description: "新建下级代理、客户或计划时将立即按此规则校验。" });
      await load(selected.id);
    } catch (error) {
      toast({ title: "配额保存失败", description: error instanceof Error ? error.message : "请稍后重试", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const healthVariant = health?.status === "healthy" ? "secondary" : "destructive";

  return (
    <FactoryPage pageId="hq-tenant-governance" template="workflow" sourceScope="hq" autoRegions>
      <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">租户治理中心</h1>
          <p className="mt-1 text-sm text-slate-500">总部统一设置直属容量，并检查多级代理、客户、计划与模板运行链路。</p>
        </div>
        <Button variant="outline" disabled={loading} onClick={() => void load(selected ? selected.id : undefined)}>
          <RefreshCw className="mr-2 h-4 w-4" />刷新检查
        </Button>
      </div>

      <div className="rounded-2xl border border-violet-200 bg-violet-50/70 px-5 py-4 text-sm text-violet-950">
        <div className="font-semibold">应用目的</div>
        <div className="mt-2 grid gap-2 leading-6 md:grid-cols-3">
          <p><span className="font-medium">配额控制：</span>限制总部、代理、客户可新增的直属代理、客户和计划数量，避免超额或误操作。</p>
          <p><span className="font-medium">链路健康：</span>检查代理层级、客户归属、计划运行配置和模板实例是否完整、正确。</p>
          <p><span className="font-medium">租户隔离：</span>及早发现权限或模板同步异常，避免不同代理、客户、计划之间的数据串联。</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-semibold text-slate-900">层级配额</h2><p className="mt-1 text-sm text-slate-500">容量按直属关系计算；保存后立即阻止超额新建。</p></div>
              <Badge variant="outline">总部控制</Badge>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div><Label htmlFor="tenant-governance-org">管理对象</Label><Select value={selectedId} onValueChange={(value) => void selectOrganization(value)}><SelectTrigger id="tenant-governance-org" className="mt-1"><SelectValue placeholder="选择组织" /></SelectTrigger><SelectContent>{managedOrganizations.map((item) => <SelectItem value={String(item.id)} key={item.id}>{item.code} · {item.name}</SelectItem>)}</SelectContent></Select></div>
              <Button onClick={() => void save()} disabled={!selected || saving || loading}><Save className="mr-2 h-4 w-4" />保存配额</Button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {quotas.map((quota) => {
                const percent = quota.limit ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 100;
                return <div key={quota.resource} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 font-medium text-slate-900"><Gauge className="h-4 w-4 text-violet-600" />{RESOURCE_LABEL[quota.resource]}</div><Badge variant={statusVariant(quota.status)}>{quota.status === "blocked" ? "已阻止" : quota.status === "warning" ? "接近上限" : "可用"}</Badge></div><div className="mt-4 flex items-end gap-2"><Input aria-label={`${RESOURCE_LABEL[quota.resource]}配额`} type="number" min="0" max="1000000" value={draft[quota.resource] || ""} onChange={(event) => setDraft((current) => ({ ...current, [quota.resource]: event.target.value }))} /><span className="pb-2 text-xs text-slate-500">已用 {quota.used}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className={quota.status === "blocked" ? "h-full bg-red-500" : quota.status === "warning" ? "h-full bg-amber-500" : "h-full bg-emerald-500"} style={{ width: `${percent}%` }} /></div></div>;
              })}
              {!loading && !quotas.length ? <div className="rounded-xl border border-dashed p-5 text-sm text-slate-500">{loadError || "当前组织没有可配置的直属容量。"}</div> : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm"><CardContent className="p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">链路健康</h2><p className="mt-1 text-sm text-slate-500">当前范围的结构和运行实例校验。</p></div><Badge variant={healthVariant} className="gap-1">{health?.status === "healthy" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}{health?.status === "healthy" ? "健康" : loadError ? "需登录" : "待检查"}</Badge></div><div className="mt-5 grid grid-cols-2 gap-3">{[["组织", health?.totals.organizations], ["计划", health?.totals.projects], ["运行配置", health?.totals.runtime_configs], ["模板实例", health?.totals.template_instances]].map(([label, value]) => <div className="rounded-lg bg-slate-50 p-3" key={String(label)}><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-xl font-semibold text-slate-900">{value ?? "-"}</div></div>)}</div><div className="mt-5 rounded-lg border border-slate-200 p-3 text-sm"><div className="flex items-center justify-between"><span className="font-medium">发现问题</span><span className={health?.finding_counts.total ? "text-red-600" : "text-emerald-600"}>{health?.finding_counts.total ?? 0}</span></div><p className="mt-1 text-xs leading-5 text-slate-500">{loadError || "检查代理层级、客户归属、计划运行配置、模板实例和模板发布状态。"}</p></div></CardContent></Card>
      </div>

      <Card className="border-slate-200 shadow-sm"><CardContent className="p-0"><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-semibold text-slate-900">问题明细</h2><p className="mt-1 text-sm text-slate-500">无问题时代表当前范围的租户链路完整。</p></div><ShieldCheck className="h-5 w-5 text-slate-400" /></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-5 py-3">级别</th><th className="px-5 py-3">检查项</th><th className="px-5 py-3">对象</th><th className="px-5 py-3">说明</th></tr></thead><tbody>{health?.findings.map((finding) => <tr className="border-t" key={`${finding.code}:${finding.subject_id}`}><td className="px-5 py-3"><Badge variant={finding.severity === "error" ? "destructive" : "outline"}>{finding.severity}</Badge></td><td className="px-5 py-3 font-mono text-xs">{finding.code}</td><td className="px-5 py-3">{finding.subject_type} #{finding.subject_id}</td><td className="px-5 py-3 text-slate-600">{finding.detail}</td></tr>)}{!loading && !health?.findings.length ? <tr><td colSpan={4} className="px-5 py-10 text-center text-emerald-700"><CheckCircle2 className="mr-2 inline h-4 w-4" />当前范围没有发现结构或运行链路问题。</td></tr> : null}</tbody></table></div></CardContent></Card>
      </section>
    </FactoryPage>
  );
}
