import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { diffLatest, fetchInstance, syncLatest } from "@/lib/template-snapshot/api";
import type { DiffEntry } from "@/lib/template-snapshot/types";
import { resolveAgencySourceAgencyCode } from "@/lib/agency-source-route-context";
import { FactoryPage } from "@/page-factory/FactoryPage";

function instanceId(code: string) { return `agency-runtime-${code}`; }

export default function AgencyVersionCenter() {
  const agencyCode = useMemo(() => resolveAgencySourceAgencyCode(window.location.search), []);
  const [version, setVersion] = useState("待安装");
  const [entries, setEntries] = useState<DiffEntry[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const sectionEntries = useMemo(() => {
    const groups = new Map<string, DiffEntry[]>();
    entries.forEach((entry) => {
      const section = entry.path.split(".")[0] || "其它配置";
      groups.set(section, [...(groups.get(section) || []), entry]);
    });
    return [...groups.entries()];
  }, [entries]);

  const load = useCallback(async () => {
    if (!agencyCode) { setLoading(false); return; }
    setLoading(true);
    try {
      const instance = await fetchInstance(instanceId(agencyCode)) as Record<string, unknown>;
      setVersion(String(instance.base_template_version || "待总部下发"));
      const diff = await diffLatest(instanceId(agencyCode));
      const nextEntries = Array.isArray(diff.entries) ? diff.entries : [];
      setEntries(nextEntries);
      const nextSections = [...new Set(nextEntries.map((item) => item.path.split(".")[0] || "其它配置"))];
      setSelectedSections((current) => current.length ? current.filter((section) => nextSections.includes(section)) : nextSections);
    } catch {
      setVersion("待总部下发");
      setEntries([]);
      setSelectedSections([]);
    } finally { setLoading(false); }
  }, [agencyCode]);

  useEffect(() => { void load(); }, [load]);

  const installSelected = async () => {
    if (!agencyCode || !selectedSections.length) return;
    setSyncing(true);
    try {
      const next = await syncLatest(instanceId(agencyCode), {
        syncMode: "merge", createBackup: true, sections: selectedSections,
      }) as Record<string, unknown>;
      setVersion(String(next.base_template_version || version));
      window.dispatchEvent(new CustomEvent("agency-runtime-template-synced", { detail: { agencyCode } }));
      toast.success(`已安装 ${selectedSections.length} 类已选更新；安装前快照已备份。`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "当前没有可安装的总部版本");
    } finally { setSyncing(false); }
  };

  const toggleSection = (section: string) => setSelectedSections((current) => current.includes(section)
    ? current.filter((item) => item !== section)
    : [...current, section]);

  if (!agencyCode) return <FactoryPage pageId="agency-version-center" template="dashboard" sourceScope="agency_source" autoRegions><section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">请从总部代理商列表的“进入”入口打开代理端，以加载对应代理的版本上下文。</section></FactoryPage>;

  return <FactoryPage pageId="agency-version-center" template="dashboard" sourceScope="agency_source" autoRegions><section className="mx-auto max-w-4xl space-y-5 pb-10">
    <div data-page-factory-region="large-card" className="rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-violet-50 p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-sky-700"><ShieldCheck className="h-5 w-5" /><span className="text-sm font-semibold">代理端 · 版本中心</span></div><h1 className="mt-2 text-2xl font-bold text-slate-900">查看差异并选择安装总部代理源更新</h1><p className="mt-2 text-sm leading-6 text-slate-600">代理端只能安装总部发布的版本，不能直接修改通用模板。商标、简称、客户、订单等代理经营数据不会被模板更新覆盖。</p></div><Badge className="bg-sky-600 px-3 py-1.5">代理：{agencyCode}</Badge></div></div>
    <div className="grid gap-5 sm:grid-cols-2"><div data-page-factory-region="small-card" className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">当前已安装</p><p className="mt-2 text-3xl font-bold text-slate-900">{loading ? "读取中…" : version}</p><p className="mt-3 text-xs text-slate-500">版本由总部代理源发布中心统一下发。</p></div><div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">可选择差异</p><p className="mt-2 text-3xl font-bold text-slate-900">{loading ? "…" : entries.length}</p><p className="mt-3 text-xs text-slate-500">按顶层配置类别勾选，不会误装未选择内容。</p></div></div>
    <div className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">安装操作</h2><p className="mt-1 text-sm text-slate-500">先勾选要安装的配置类别；每次安装都会先创建快照备份。</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading || syncing}><RefreshCw className="mr-2 h-4 w-4" />检查更新</Button><Button onClick={() => void installSelected()} disabled={loading || syncing || !selectedSections.length || version === "待总部下发"}><Download className="mr-2 h-4 w-4" />{syncing ? "安装中…" : `安装已选 ${selectedSections.length} 类`}</Button></div></div>
      {sectionEntries.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{sectionEntries.map(([section, sectionItems]) => <label key={section} className="flex cursor-pointer items-center justify-between rounded-xl border bg-slate-50 px-3 py-2.5 text-sm"><span className="flex items-center gap-2"><input type="checkbox" checked={selectedSections.includes(section)} onChange={() => toggleSection(section)} />{section}</span><Badge variant="secondary">{sectionItems.length} 项</Badge></label>)}</div> : <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">当前代理端已与总部发布版本一致。</p>}
      <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-600" />局部安装不会改变完整版本基线，后续仍可核对和安装其它差异；异常时可由总部从发布中心执行可审计回退。</div></div>
  </section></FactoryPage>;
}
