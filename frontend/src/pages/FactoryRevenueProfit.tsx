import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Calculator, GitBranch, Link2, Plus, RefreshCw, Scale, ShieldCheck, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FactoryPage } from "@/page-factory/FactoryPage";
import {
  approveAttributionPolicyVersion, calculateRevenueProfit, createAttributionPolicy,
  createAttributionPolicyVersion, createRevenueProfitBinding, listRevenueProfitWorkspace,
  recordAttributionTouchpoint, submitAttributionPolicyVersion, verifyRevenueProfitAnalysis,
  verifyRevenueProfitBinding, type AttributionPolicy, type AttributionPolicyVersion,
  type RevenueProfitBinding, type RevenueProfitRun, type RevenueProfitWorkspace,
} from "@/lib/factory-revenue-profit-api";

const EMPTY: RevenueProfitWorkspace = {
  policies: [], policy_versions: [], touchpoints: [], bindings: [], analysis_runs: [], allocations: [], evidence: [], warehouse_candidates: [],
  contract: { profit_classification: "management-contribution-estimate", formal_accounting_profit: false, published_warehouse_required: true, touchpoint_evidence_required: true, policy_approval_independent: true, binding_verification_independent: true, analysis_verification_independent: true, historical_recalculation: false },
};
const STATUS: Record<string, string> = { draft: "草稿", active: "已生效", "pending-approval": "待独立审批", published: "已发布", superseded: "历史版本", "pending-verification": "待独立验证", verified: "已验证", calculated: "待独立复核" };
const touchpointTimestamp = () => Date.now();

export default function FactoryRevenueProfit() {
  const [projectText, setProjectText] = useState("1");
  const [mode, setMode] = useState<"loading" | "live" | "error">("loading");
  const [workspace, setWorkspace] = useState<RevenueProfitWorkspace>(EMPTY);
  const [policyCode, setPolicyCode] = useState("revenue.linear");
  const [policyLabel, setPolicyLabel] = useState("线性贡献归因");
  const [policyOwner, setPolicyOwner] = useState("finance-marketing-owner");
  const [modelType, setModelType] = useState<"first-touch" | "last-touch" | "linear">("linear");
  const [lookbackDays, setLookbackDays] = useState("30");
  const [referencePrefix, setReferencePrefix] = useState("REVENUE-PROFIT");
  const [revenueFactId, setRevenueFactId] = useState("");
  const [quoteFactId, setQuoteFactId] = useState("");
  const projectId = Number(projectText);

  const load = async (silent = false) => {
    if (!Number.isInteger(projectId) || projectId <= 0) return;
    if (!silent) setMode("loading");
    try {
      const result = await listRevenueProfitWorkspace(projectId); setWorkspace(result);
      setRevenueFactId((value) => value || result.warehouse_candidates.find((item) => item.source_code === "revenue")?.fact_id || "");
      setQuoteFactId((value) => value || result.warehouse_candidates.find((item) => item.source_code === "quotes")?.fact_id || "");
      setMode("live");
    } catch (error) { setMode("error"); toast.error(error instanceof Error ? error.message : "归因利润中心加载失败"); }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const versions = useMemo(() => new Map(workspace.policies.map((policy) => [policy.id, workspace.policy_versions.filter((version) => version.policy_id === policy.id)])), [workspace.policies, workspace.policy_versions]);
  const allocations = useMemo(() => new Map(workspace.analysis_runs.map((run) => [run.id, workspace.allocations.filter((item) => item.analysis_run_id === run.id)])), [workspace.analysis_runs, workspace.allocations]);
  const revenueCandidates = workspace.warehouse_candidates.filter((item) => item.source_code === "revenue");
  const quoteCandidates = workspace.warehouse_candidates.filter((item) => item.source_code === "quotes");
  const revenueCandidate = revenueCandidates.find((item) => item.fact_id === revenueFactId);
  const quoteCandidate = quoteCandidates.find((item) => item.fact_id === quoteFactId);

  const execute = async (operation: () => Promise<unknown>, message: string) => {
    try { await operation(); toast.success(message); await load(true); }
    catch (error) { toast.error(error instanceof Error ? error.message : "归因利润治理操作失败"); await load(true); }
  };
  const versionPayload = (versionReference: string, reason: string) => ({ version_reference: versionReference, label: policyLabel, model_type: modelType, lookback_days: Number(lookbackDays), effective_from: new Date().toISOString(), change_reason: reason });
  const createPolicy = () => execute(() => createAttributionPolicy(projectId, {
    policy_reference: `${referencePrefix}-POLICY`, policy_code: policyCode, owner: policyOwner,
    purpose: "用已发布回款与报价成本事实形成可审计管理贡献利润，不替代正式财务利润",
    ...versionPayload(`${referencePrefix}-POLICY-V1`, "建立首个独立审批的归因策略版本"),
  }), "归因策略与 V1 草稿已建立");
  const newVersion = (policy: AttributionPolicy) => execute(() => createAttributionPolicyVersion(projectId, policy.id, {
    expected_policy_revision: policy.revision,
    ...versionPayload(`${referencePrefix}-POLICY-V${(policy.current_version_number ?? 1) + 1}-${Date.now()}`, "新策略只用于未来计算并保留全部历史结果"),
  }), "新归因策略版本已建立");
  const submit = (version: AttributionPolicyVersion) => execute(() => submitAttributionPolicyVersion(projectId, version.id, { expected_revision: version.revision, evidence_reference: `${referencePrefix}-${version.version_number_record}-SUBMIT` }), "归因策略已提交独立审批");
  const approve = (version: AttributionPolicyVersion) => execute(() => approveAttributionPolicyVersion(projectId, version.id, { expected_revision: version.revision, evidence_reference: `${referencePrefix}-${version.version_number_record}-APPROVE` }), "归因策略已独立审批发布");
  const createTouchpoints = () => {
    if (!revenueCandidate) return Promise.resolve();
    const payload = revenueCandidate.payload; const conversion = new Date(revenueCandidate.source_updated_at).getTime(); const stamp = touchpointTimestamp();
    return execute(() => Promise.all([
      recordAttributionTouchpoint(projectId, { external_event_reference: `${referencePrefix}-TOUCH-GOOGLE-${stamp}`, correlation_id: payload.correlation_id, account_reference: payload.account_reference, channel: "google", campaign_reference: "SEARCH-PRODUCT", content_reference: "LANDING-PRODUCT", occurred_at: new Date(conversion - 2 * 86400000).toISOString(), spend_amount: "100", currency: payload.currency, consent_reference: `${referencePrefix}-CONSENT-GOOGLE` }),
      recordAttributionTouchpoint(projectId, { external_event_reference: `${referencePrefix}-TOUCH-LINKEDIN-${stamp}`, correlation_id: payload.correlation_id, account_reference: payload.account_reference, channel: "linkedin", campaign_reference: "ABM-FACTORY", content_reference: "CASE-STUDY", occurred_at: new Date(conversion - 86400000).toISOString(), spend_amount: "50", currency: payload.currency, consent_reference: `${referencePrefix}-CONSENT-LINKEDIN` }),
    ]), "两个带同意证据的营销触点已登记");
  };
  const createBinding = () => {
    if (!revenueCandidate || !quoteCandidate) return Promise.resolve();
    return execute(() => createRevenueProfitBinding(projectId, { binding_reference: `${referencePrefix}-BIND-${Date.now()}`, revenue_load_run_id: revenueCandidate.load_run_id, revenue_fact_id: revenueCandidate.fact_id, quote_load_run_id: quoteCandidate.load_run_id, quote_fact_id: quoteCandidate.fact_id }), "回款与报价成本事实绑定已建立");
  };
  const verifyBinding = (binding: RevenueProfitBinding) => execute(() => verifyRevenueProfitBinding(projectId, binding.id, { expected_revision: binding.revision, evidence_reference: `${referencePrefix}-${binding.binding_number}-VERIFY` }), "事实绑定已独立验证");
  const calculate = (binding: RevenueProfitBinding) => {
    const policyVersion = workspace.policy_versions.find((item) => item.status === "published");
    if (!policyVersion) { toast.error("尚无已发布归因策略"); return Promise.resolve(); }
    return execute(() => calculateRevenueProfit(projectId, { binding_id: binding.id, policy_version_id: policyVersion.id, analysis_reference: `${referencePrefix}-ANALYSIS-${Date.now()}` }), "管理贡献利润已计算，等待独立复核");
  };
  const verifyAnalysis = (run: RevenueProfitRun) => execute(() => verifyRevenueProfitAnalysis(projectId, run.id, { expected_revision: run.revision, verification_reference: `${referencePrefix}-${run.run_number}-VERIFY`, verification_note: "已复核回款、报价成本、营销花费、策略指纹和全部渠道分摊，确认仅作为管理贡献估算" }), "归因利润结果已独立复核发布");

  return <FactoryPage pageId="client-revenue-profit" template="dashboard" sourceScope="client_source" autoRegions><main className="p-4 md:p-6" data-factory-revenue-profit-page data-revenue-profit-mode={mode}>
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-xl font-bold"><TrendingUp className="h-5 w-5" />归因与利润分析</h1><p className="mt-1 text-sm opacity-70">用已发布回款、报价成本和有同意证据的营销触点计算管理贡献利润；结果不可冒充正式财务利润。</p></div><div className="flex gap-2"><Input aria-label="归因利润项目ID" className="w-24" value={projectText} onChange={(event) => setProjectText(event.target.value)} /><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />载入利润</Button></div></div>

      <Card><CardHeader><CardTitle className="text-base">归因策略版本</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <Input aria-label="归因策略代码" value={policyCode} onChange={(event) => setPolicyCode(event.target.value)} /><Input aria-label="归因策略名称" value={policyLabel} onChange={(event) => setPolicyLabel(event.target.value)} /><Input aria-label="归因策略责任人" value={policyOwner} onChange={(event) => setPolicyOwner(event.target.value)} /><select aria-label="归因模型" className="h-10 rounded-md border bg-background px-3 text-sm" value={modelType} onChange={(event) => setModelType(event.target.value as typeof modelType)}><option value="linear">linear</option><option value="first-touch">first-touch</option><option value="last-touch">last-touch</option></select><Input aria-label="归因回溯天数" value={lookbackDays} onChange={(event) => setLookbackDays(event.target.value)} /><Input aria-label="归因证据前缀" value={referencePrefix} onChange={(event) => setReferencePrefix(event.target.value)} /><Button className="md:col-span-2" data-attribution-policy-create onClick={() => void createPolicy()}><Scale className="mr-1 h-4 w-4" />建立策略与 V1 草稿</Button>
        <div className="md:col-span-2 xl:col-span-4 space-y-2">{workspace.policies.map((policy) => <div key={policy.id} className="rounded-lg border p-3" data-attribution-policy-status={policy.status}><div className="flex flex-wrap items-center justify-between gap-2"><b>{policy.policy_number} · {policy.policy_code}</b><Badge>{STATUS[policy.status]}</Badge></div><p className="mt-1 text-sm">{policy.purpose}</p>{policy.status === "active" ? <Button className="mt-2" size="sm" variant="outline" data-attribution-policy-new-version onClick={() => void newVersion(policy)}><GitBranch className="mr-1 h-4 w-4" />建立新策略版本</Button> : null}<div className="mt-2 grid gap-2 md:grid-cols-2">{(versions.get(policy.id) ?? []).map((version) => <div key={version.id} className="rounded bg-muted/40 p-2" data-attribution-version-status={version.status} data-attribution-history-pinned={version.status === "superseded" ? "true" : undefined}><div className="flex items-center justify-between gap-2"><b>V{version.version_number} · {version.label}</b><Badge variant="secondary">{STATUS[version.status]}</Badge></div><p className="mt-1 text-xs">{version.model_type} · {version.lookback_days}天</p><p className="break-all text-[11px] opacity-60" data-attribution-policy-fingerprint>{version.policy_fingerprint}</p><div className="mt-2 flex gap-2">{version.status === "draft" ? <Button size="sm" data-attribution-policy-submit onClick={() => void submit(version)}>提交审批</Button> : null}{version.status === "pending-approval" ? <Button size="sm" data-attribution-policy-approve onClick={() => void approve(version)}><ShieldCheck className="mr-1 h-4 w-4" />独立审批</Button> : null}</div></div>)}</div></div>)}</div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">已发布事实与营销证据</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-2">
        <select aria-label="已发布回款事实" className="h-10 rounded-md border bg-background px-3 text-sm" value={revenueFactId} onChange={(event) => setRevenueFactId(event.target.value)}>{revenueCandidates.map((item) => <option key={`${item.load_run_id}-${item.fact_id}`} value={item.fact_id}>{item.source_object_number} · 已回款 {String(item.payload.paid_amount ?? "0")}</option>)}</select><select aria-label="已发布报价成本事实" className="h-10 rounded-md border bg-background px-3 text-sm" value={quoteFactId} onChange={(event) => setQuoteFactId(event.target.value)}>{quoteCandidates.map((item) => <option key={`${item.load_run_id}-${item.fact_id}`} value={item.fact_id}>{item.source_object_number} · 收入 {String(item.payload.subtotal ?? "0")} / 成本 {String(item.payload.cost_total ?? "0")}</option>)}</select><Button data-attribution-touchpoints-create disabled={!revenueCandidate} onClick={() => void createTouchpoints()}><Plus className="mr-1 h-4 w-4" />登记 Google 与 LinkedIn 触点</Button><Button data-revenue-profit-binding-create disabled={!revenueCandidate || !quoteCandidate} onClick={() => void createBinding()}><Link2 className="mr-1 h-4 w-4" />绑定回款与报价成本</Button>
        <div className="md:col-span-2 grid gap-2 md:grid-cols-2">{workspace.touchpoints.map((item) => <div key={item.id} className="rounded border p-2 text-sm" data-attribution-touchpoint={item.id}><b>{item.channel} · {item.campaign_reference}</b><p>{item.spend_amount} {item.currency} · {item.external_event_reference}</p></div>)}</div>
      </CardContent></Card>

      <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">权威事实绑定</CardTitle></CardHeader><CardContent className="space-y-2">{workspace.bindings.map((binding) => <div key={binding.id} className="rounded-lg border p-3" data-revenue-profit-binding-status={binding.status}><div className="flex items-center justify-between gap-2"><b>{binding.binding_number}</b><Badge>{STATUS[binding.status]}</Badge></div><p className="mt-1 text-xs">{binding.correlation_id} · {binding.account_reference} · {binding.currency}</p><p className="text-xs opacity-70">回款 {binding.revenue_fact_number}@r{binding.revenue_source_revision} · 报价 {binding.quote_fact_number}@r{binding.quote_source_revision}</p>{binding.status === "pending-verification" ? <Button className="mt-2" size="sm" data-revenue-profit-binding-verify onClick={() => void verifyBinding(binding)}><BadgeCheck className="mr-1 h-4 w-4" />独立验证绑定</Button> : <Button className="mt-2" size="sm" data-revenue-profit-calculate onClick={() => void calculate(binding)}><Calculator className="mr-1 h-4 w-4" />计算贡献利润</Button>}</div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">贡献利润发布</CardTitle></CardHeader><CardContent className="space-y-2">{workspace.analysis_runs.map((run) => <div key={run.id} className="rounded-lg border p-3" data-revenue-profit-run-status={run.status}><div className="flex items-center justify-between gap-2"><b>{run.run_number}</b><Badge>{STATUS[run.status]}</Badge></div><p className="mt-2 text-sm">回款 <b>{run.recognized_revenue}</b> · 成本 <b>{run.governed_sales_cost}</b> · 营销 <b>{run.marketing_spend}</b></p><p className="text-sm">管理贡献 <strong className="text-lg" data-revenue-profit-contribution>{run.contribution_margin}</strong> {run.currency} · {run.contribution_margin_percent}%</p><p className="text-xs font-semibold text-amber-600" data-revenue-profit-classification>{run.profit_classification} · 非正式财务利润</p>{run.status === "calculated" ? <Button className="mt-2" size="sm" data-revenue-profit-analysis-verify onClick={() => void verifyAnalysis(run)}><ShieldCheck className="mr-1 h-4 w-4" />独立复核发布</Button> : <p className="mt-2 text-xs font-semibold text-emerald-600" data-revenue-profit-published>已形成可审计管理贡献结果</p>}<div className="mt-2 grid gap-2 sm:grid-cols-2">{(allocations.get(run.id) ?? []).map((item) => <div key={item.id} className="rounded bg-muted/50 p-2 text-xs" data-revenue-profit-allocation={item.id}><b>{item.channel} · {(Number(item.weight) * 100).toFixed(2)}%</b><p>收入 {item.attributed_revenue} · 成本 {item.attributed_sales_cost} · 花费 {item.touchpoint_spend} · 贡献 {item.attributed_contribution}</p></div>)}</div></div>)}</CardContent></Card></div>

      <Card><CardContent className="flex flex-wrap gap-2 py-4 text-xs"><Badge>{workspace.contract.profit_classification}</Badge><Badge>正式财务利润：{workspace.contract.formal_accounting_profit ? "是" : "否"}</Badge><Badge>仓库发布：{workspace.contract.published_warehouse_required ? "必须" : "可选"}</Badge><Badge>触点证据：{workspace.contract.touchpoint_evidence_required ? "必须" : "可选"}</Badge><Badge>历史重算：{workspace.contract.historical_recalculation ? "允许" : "禁止"}</Badge></CardContent></Card>
    </div>
  </main></FactoryPage>;
}
