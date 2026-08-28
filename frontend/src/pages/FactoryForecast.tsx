import { useEffect, useMemo, useState } from "react";
import { Activity, Calculator, Database, GitBranch, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FactoryPage } from "@/page-factory/FactoryPage";
import {
  approveForecastPolicyVersion, calculateForecast, createForecastPolicy,
  createForecastPolicyVersion, listForecastWorkspace, submitForecastPolicyVersion,
  verifyForecast, type ForecastPolicy, type ForecastPolicyVersion,
  type ForecastRun, type ForecastWorkspace,
} from "@/lib/factory-forecast-api";

const EMPTY: ForecastWorkspace = {
  policies: [], policy_versions: [], forecast_runs: [], input_edges: [], buckets: [], evidence: [], source_readiness: [],
  contract: { forecast_classification: "management-rolling-forecast", formal_financial_forecast: false, published_warehouse_required: true, policy_approval_independent: true, run_verification_independent: true, historical_recalculation: false, authority_writeback: false, required_source_codes: [] },
};
const STATUS: Record<string, string> = { draft: "草稿", active: "已生效", "pending-approval": "待独立审批", published: "已发布", superseded: "历史版本", calculated: "待独立复核" };
const SOURCE_LABELS: Record<string, string> = { quotes: "报价商机", orders: "确认订单", revenue: "回款应收", "capacity-resources": "产能资源", "production-plans": "生产计划", "purchase-orders": "采购付款" };

export default function FactoryForecast() {
  const [projectText, setProjectText] = useState("1");
  const [mode, setMode] = useState<"loading" | "live" | "error">("loading");
  const [workspace, setWorkspace] = useState<ForecastWorkspace>(EMPTY);
  const [policyCode, setPolicyCode] = useState("forecast.rolling.base");
  const [policyOwner, setPolicyOwner] = useState("s-and-op-owner");
  const [horizonDays, setHorizonDays] = useState("90");
  const [bucketDays, setBucketDays] = useState("30");
  const [growth, setGrowth] = useState("10");
  const [probability, setProbability] = useState("40");
  const [collection, setCollection] = useState("80");
  const [capacityBuffer, setCapacityBuffer] = useState("10");
  const [procurementPayment, setProcurementPayment] = useState("50");
  const [referencePrefix, setReferencePrefix] = useState("FORECAST");
  const projectId = Number(projectText);

  const load = async (silent = false) => {
    if (!Number.isInteger(projectId) || projectId <= 0) return;
    if (!silent) setMode("loading");
    try { setWorkspace(await listForecastWorkspace(projectId)); setMode("live"); }
    catch (error) { setMode("error"); toast.error(error instanceof Error ? error.message : "经营预测加载失败"); }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const versions = useMemo(() => new Map(workspace.policies.map((policy) => [
    policy.id, workspace.policy_versions.filter((version) => version.policy_id === policy.id),
  ])), [workspace.policies, workspace.policy_versions]);
  const edges = useMemo(() => new Map(workspace.forecast_runs.map((run) => [
    run.id, workspace.input_edges.filter((edge) => edge.forecast_run_id === run.id),
  ])), [workspace.forecast_runs, workspace.input_edges]);
  const buckets = useMemo(() => new Map(workspace.forecast_runs.map((run) => [
    run.id, workspace.buckets.filter((bucket) => bucket.forecast_run_id === run.id).sort((a, b) => a.bucket_index - b.bucket_index),
  ])), [workspace.forecast_runs, workspace.buckets]);
  const sourcesReady = workspace.source_readiness.length === 6 && workspace.source_readiness.every((item) => item.ready);

  const execute = async (operation: () => Promise<unknown>, message: string) => {
    try { await operation(); toast.success(message); await load(true); }
    catch (error) { toast.error(error instanceof Error ? error.message : "经营预测治理操作失败"); await load(true); }
  };
  const versionPayload = (versionReference: string, reason: string) => ({
    version_reference: versionReference, label: `${horizonDays}天滚动经营预测`,
    model_type: "weighted-pipeline-capacity-cash", horizon_days: Number(horizonDays), bucket_days: Number(bucketDays),
    demand_growth_percent: growth, pipeline_probability_percent: probability,
    collection_percent: collection, capacity_buffer_percent: capacityBuffer,
    procurement_payment_percent: procurementPayment, effective_from: new Date().toISOString(), change_reason: reason,
  });
  const createPolicy = () => execute(() => createForecastPolicy(projectId, {
    policy_reference: `${referencePrefix}-POLICY`, policy_code: policyCode, owner: policyOwner,
    purpose: "以已发布报价、订单、回款、产能、生产计划和采购事实形成管理滚动预测，不替代正式财务预测",
    ...versionPayload(`${referencePrefix}-POLICY-V1`, "建立首个由独立角色审批的需求、产能和现金预测策略"),
  }), "经营预测策略 V1 草稿已建立");
  const newVersion = (policy: ForecastPolicy) => execute(() => createForecastPolicyVersion(projectId, policy.id, {
    expected_policy_revision: policy.revision,
    ...versionPayload(`${referencePrefix}-POLICY-V${(policy.current_version_number ?? 1) + 1}-${Date.now()}`, "新假设只作用于未来预测并保留全部历史输入与结果"),
  }), "新经营预测策略版本已建立");
  const submit = (version: ForecastPolicyVersion) => execute(() => submitForecastPolicyVersion(projectId, version.id, {
    expected_revision: version.revision, evidence_reference: `${referencePrefix}-${version.version_number_record}-SUBMIT`,
  }), "经营预测策略已提交独立审批");
  const approve = (version: ForecastPolicyVersion) => execute(() => approveForecastPolicyVersion(projectId, version.id, {
    expected_revision: version.revision, evidence_reference: `${referencePrefix}-${version.version_number_record}-APPROVE`,
  }), "经营预测策略已独立审批发布");
  const calculate = (version: ForecastPolicyVersion) => execute(() => calculateForecast(projectId, {
    policy_version_id: version.id, forecast_reference: `${referencePrefix}-RUN-${Date.now()}`,
    as_of_at: new Date().toISOString(),
  }), "需求、产能与现金预测已计算，等待独立复核");
  const verify = (run: ForecastRun) => execute(() => verifyForecast(projectId, run.id, {
    expected_revision: run.revision, verification_reference: `${referencePrefix}-${run.run_number}-VERIFY`,
    verification_note: "已复核六类已发布仓库批次、输入修订、策略指纹、预测总额和全部滚动分桶；确认仅作为管理预测",
  }), "经营预测已独立复核发布");

  return <FactoryPage pageId="client-forecast" template="dashboard" sourceScope="client_source" autoRegions><main className="p-4 md:p-6" data-factory-forecast-page data-forecast-mode={mode}>
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-xl font-bold"><Activity className="h-5 w-5" />经营预测</h1><p className="mt-1 text-sm opacity-70">用六类已发布经营事实形成需求、产能和现金滚动预测；结果不可冒充正式财务预测，也不回写权威业务系统。</p></div><div className="flex gap-2"><Input aria-label="经营预测项目ID" className="w-24" value={projectText} onChange={(event) => setProjectText(event.target.value)} /><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />载入预测</Button></div></div>

      <Card><CardHeader><CardTitle className="text-base">六类已发布输入</CardTitle></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{workspace.source_readiness.map((item) => <div key={item.source_code} className="rounded-lg border p-3" data-forecast-source-ready={item.ready ? "true" : "false"}><div className="flex items-center justify-between gap-2"><b className="flex items-center gap-1"><Database className="h-4 w-4" />{SOURCE_LABELS[item.source_code] ?? item.source_code}</b><Badge variant={item.ready ? "default" : "destructive"}>{item.ready ? "已发布" : "未就绪"}</Badge></div><p className="mt-1 text-xs opacity-70">{item.run_number ?? "需先在经营数据仓库发布"}</p></div>)}</CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">预测策略与假设版本</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <Input aria-label="预测策略代码" value={policyCode} onChange={(event) => setPolicyCode(event.target.value)} /><Input aria-label="预测策略责任人" value={policyOwner} onChange={(event) => setPolicyOwner(event.target.value)} /><Input aria-label="预测周期天数" value={horizonDays} onChange={(event) => setHorizonDays(event.target.value)} /><Input aria-label="预测分桶天数" value={bucketDays} onChange={(event) => setBucketDays(event.target.value)} /><Input aria-label="预测证据前缀" value={referencePrefix} onChange={(event) => setReferencePrefix(event.target.value)} /><Input aria-label="需求增长百分比" value={growth} onChange={(event) => setGrowth(event.target.value)} /><Input aria-label="商机概率百分比" value={probability} onChange={(event) => setProbability(event.target.value)} /><Input aria-label="回款比例百分比" value={collection} onChange={(event) => setCollection(event.target.value)} /><Input aria-label="产能缓冲百分比" value={capacityBuffer} onChange={(event) => setCapacityBuffer(event.target.value)} /><Input aria-label="采购付款百分比" value={procurementPayment} onChange={(event) => setProcurementPayment(event.target.value)} /><Button className="md:col-span-2 xl:col-span-5" data-forecast-policy-create onClick={() => void createPolicy()}><ShieldCheck className="mr-1 h-4 w-4" />建立预测策略 V1 草稿</Button>
        <div className="md:col-span-2 xl:col-span-5 space-y-2">{workspace.policies.map((policy) => <div key={policy.id} className="rounded-lg border p-3" data-forecast-policy-status={policy.status}><div className="flex flex-wrap items-center justify-between gap-2"><b>{policy.policy_number} · {policy.policy_code}</b><Badge>{STATUS[policy.status]}</Badge></div><p className="mt-1 text-sm">{policy.purpose}</p>{policy.status === "active" ? <Button className="mt-2" size="sm" variant="outline" data-forecast-policy-new-version onClick={() => void newVersion(policy)}><GitBranch className="mr-1 h-4 w-4" />建立新策略版本</Button> : null}<div className="mt-2 grid gap-2 lg:grid-cols-2">{(versions.get(policy.id) ?? []).map((version) => <div key={version.id} className="rounded bg-muted/40 p-3" data-forecast-version-status={version.status} data-forecast-history-pinned={version.status === "superseded" ? "true" : undefined}><div className="flex items-center justify-between gap-2"><b>V{version.version_number} · {version.label}</b><Badge variant="secondary">{STATUS[version.status]}</Badge></div><p className="mt-1 text-xs">增长 {version.demand_growth_percent}% · 商机 {version.pipeline_probability_percent}% · 回款 {version.collection_percent}% · 产能缓冲 {version.capacity_buffer_percent}% · 采购付款 {version.procurement_payment_percent}%</p><p className="mt-1 break-all text-[11px] opacity-60" data-forecast-policy-fingerprint>{version.policy_fingerprint}</p><div className="mt-2 flex flex-wrap gap-2">{version.status === "draft" ? <Button size="sm" data-forecast-policy-submit onClick={() => void submit(version)}>提交审批</Button> : null}{version.status === "pending-approval" ? <Button size="sm" data-forecast-policy-approve onClick={() => void approve(version)}>独立审批</Button> : null}{version.status === "published" ? <Button size="sm" disabled={!sourcesReady} data-forecast-calculate onClick={() => void calculate(version)}><Calculator className="mr-1 h-4 w-4" />计算滚动预测</Button> : null}</div></div>)}</div></div>)}</div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">需求、产能与现金预测发布</CardTitle></CardHeader><CardContent className="space-y-3">{workspace.forecast_runs.map((run) => <div key={run.id} className="rounded-lg border p-3" data-forecast-run-status={run.status}><div className="flex flex-wrap items-center justify-between gap-2"><b>{run.run_number} · {run.horizon_days}天</b><Badge>{STATUS[run.status]}</Badge></div><div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4 text-sm"><p>加权商机 <b>{run.pipeline_demand_value}</b> {run.currency}</p><p>确认订单 <b>{run.confirmed_order_value}</b> {run.currency}</p><p>产能需求 <b>{run.required_capacity_units}</b> / 可用 <b>{run.available_capacity_units}</b></p><p>产能差额 <b data-forecast-capacity-gap>{run.capacity_gap_units}</b></p><p>预计流入 <b>{run.expected_cash_in}</b> {run.currency}</p><p>预计流出 <b>{run.expected_cash_out}</b> {run.currency}</p><p>净现金变化 <strong className="text-lg" data-forecast-net-cash>{run.net_cash_change}</strong> {run.currency}</p><p>{run.source_count} 类来源 · {run.input_fact_count} 个固定事实</p></div><p className="mt-1 text-xs font-semibold text-amber-600" data-forecast-classification>{run.forecast_classification} · 非正式财务预测</p>{run.status === "calculated" ? <Button className="mt-2" size="sm" data-forecast-run-verify onClick={() => void verify(run)}><ShieldCheck className="mr-1 h-4 w-4" />独立复核发布</Button> : <p className="mt-2 text-xs font-semibold text-emerald-600" data-forecast-published>已形成可审计滚动经营预测</p>}<div className="mt-3 grid gap-2 md:grid-cols-3">{(buckets.get(run.id) ?? []).map((bucket) => <div key={bucket.id} className="rounded bg-muted/50 p-2 text-xs" data-forecast-bucket={bucket.id}><b>第 {bucket.bucket_index} 期 · {new Date(bucket.bucket_start).toLocaleDateString()}—{new Date(bucket.bucket_end).toLocaleDateString()}</b><p>商机 {bucket.pipeline_demand_value} · 订单 {bucket.confirmed_order_value}</p><p>产能 {bucket.required_capacity_units}/{bucket.available_capacity_units} · 净现金 {bucket.net_cash_change}</p></div>)}</div><p className="mt-2 text-[11px] opacity-60" data-forecast-lineage-count>{(edges.get(run.id) ?? []).length} 条输入血缘已固定修订号与内容指纹</p></div>)}</CardContent></Card>

      <Card><CardContent className="flex flex-wrap gap-2 py-4 text-xs"><Badge>{workspace.contract.forecast_classification}</Badge><Badge>正式财务预测：{workspace.contract.formal_financial_forecast ? "是" : "否"}</Badge><Badge>仓库发布：{workspace.contract.published_warehouse_required ? "必须" : "可选"}</Badge><Badge>历史重算：{workspace.contract.historical_recalculation ? "允许" : "禁止"}</Badge><Badge>权威系统回写：{workspace.contract.authority_writeback ? "允许" : "禁止"}</Badge></CardContent></Card>
    </div>
  </main></FactoryPage>;
}
