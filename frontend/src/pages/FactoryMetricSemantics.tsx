import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Calculator, GitBranch, Play, RefreshCw, Scale, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FactoryPage } from "@/page-factory/FactoryPage";
import {
  approveMetricVersion, createMetricDefinition, createMetricVersion, evaluateMetricVersion,
  listMetricSemanticsWorkspace, submitMetricVersion, verifyMetricEvaluation,
  type MetricDefinition, type MetricEvaluationRun, type MetricSemanticsWorkspace, type MetricVersion,
} from "@/lib/factory-metric-semantics-api";

const EMPTY: MetricSemanticsWorkspace = {
  definitions: [], versions: [], evaluation_runs: [], observations: [], evidence: [],
  warehouse_sources: [], warehouse_runs: [],
  contract: { formula_mode: "declarative-only", allowed_aggregations: [], historical_recalculation: false,
    approval_independent: true, evaluation_verification_independent: true, warehouse_publication_required: true },
};
const STATUS_LABEL: Record<string, string> = {
  draft: "草稿", active: "已生效", "pending-approval": "待独立审批",
  published: "已发布", superseded: "历史版本", evaluated: "待独立验证",
};

export default function FactoryMetricSemantics() {
  const [projectText, setProjectText] = useState("1");
  const [mode, setMode] = useState<"loading" | "live" | "error">("loading");
  const [workspace, setWorkspace] = useState<MetricSemanticsWorkspace>(EMPTY);
  const [sourceId, setSourceId] = useState("");
  const [metricCode, setMetricCode] = useState("orders.value");
  const [label, setLabel] = useState("订单金额");
  const [owner, setOwner] = useState("finance-data-owner");
  const [aggregation, setAggregation] = useState("sum");
  const [valueField, setValueField] = useState("order_total");
  const [dimension, setDimension] = useState("status");
  const [referencePrefix, setReferencePrefix] = useState("METRIC-ORDER-VALUE");
  const projectId = Number(projectText);

  const load = async (silent = false) => {
    if (!Number.isInteger(projectId) || projectId <= 0) return;
    if (!silent) setMode("loading");
    try {
      const result = await listMetricSemanticsWorkspace(projectId);
      setWorkspace(result);
      setSourceId((current) => current || result.warehouse_sources[0]?.id || "");
      setMode("live");
    } catch (error) { setMode("error"); toast.error(error instanceof Error ? error.message : "指标语义中心加载失败"); }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const source = workspace.warehouse_sources.find((item) => item.id === sourceId);
  const versionsByDefinition = useMemo(() => {
    const map = new Map<string, MetricVersion[]>();
    workspace.versions.forEach((version) => map.set(version.definition_id, [...(map.get(version.definition_id) ?? []), version]));
    return map;
  }, [workspace.versions]);
  const observationsByRun = useMemo(() => {
    const map = new Map<string, typeof workspace.observations>();
    workspace.observations.forEach((item) => map.set(item.evaluation_run_id, [...(map.get(item.evaluation_run_id) ?? []), item]));
    return map;
  }, [workspace.observations]); // eslint-disable-line react-hooks/exhaustive-deps

  const execute = async (operation: () => Promise<unknown>, message: string) => {
    try { await operation(); toast.success(message); await load(true); }
    catch (error) { toast.error(error instanceof Error ? error.message : "指标治理操作失败"); await load(true); }
  };
  const formulaPayload = (versionReference: string, changeReason: string) => ({
    version_reference: versionReference, label,
    description: `${label}使用已发布数据仓库事实，按${aggregation}声明式口径计算`, unit: "USD",
    aggregation, source_id: sourceId, value_field: aggregation === "sum" || aggregation === "average" ? valueField : null,
    numerator_field: null, denominator_field: null, filter_field: null, filter_operator: null,
    filter_value: null, dimensions: dimension ? [dimension] : [], effective_from: new Date().toISOString(), change_reason: changeReason,
  });
  const create = () => execute(() => createMetricDefinition(projectId, {
    definition_reference: `${referencePrefix}-DEFINITION`, metric_code: metricCode,
    domain: source?.source_code === "orders" ? "delivery" : "operations", owner,
    purpose: "建立跨部门统一、可审计且不会静默重算历史结果的经营指标口径",
    ...formulaPayload(`${referencePrefix}-V1`, "建立首个受治理指标语义版本"),
  }), "指标定义与不可变 V1 草稿已建立");
  const newVersion = (definition: MetricDefinition) => execute(() => createMetricVersion(projectId, definition.id, {
    expected_definition_revision: definition.revision,
    ...formulaPayload(`${referencePrefix}-V${(definition.current_version_number ?? 1) + 1}-${Date.now()}`, "通过新版本调整口径并保留全部历史计算结果"),
  }), "新口径草稿已建立，旧版结果保持锁定");
  const submit = (version: MetricVersion) => execute(() => submitMetricVersion(projectId, version.id, {
    expected_revision: version.revision, submission_reference: `${referencePrefix}-${version.version_number_record}-SUBMIT`,
  }), "指标版本已提交独立审批");
  const approve = (version: MetricVersion) => execute(() => approveMetricVersion(projectId, version.id, {
    expected_revision: version.revision, approval_reference: `${referencePrefix}-${version.version_number_record}-APPROVE`,
  }), "指标版本已独立审批并发布");
  const evaluate = (version: MetricVersion) => {
    const warehouseRun = workspace.warehouse_runs.find((item) => item.source_id === version.source_id);
    if (!warehouseRun) { toast.error("该指标来源尚无已发布数据仓库批次"); return Promise.resolve(); }
    return execute(() => evaluateMetricVersion(projectId, version.id, {
      warehouse_load_run_id: warehouseRun.id,
      evaluation_reference: `${referencePrefix}-${version.version_number_record}-${warehouseRun.run_number}-EVALUATE`,
    }), "指标已按版本和仓库水位计算，等待独立验证");
  };
  const verify = (run: MetricEvaluationRun) => execute(() => verifyMetricEvaluation(projectId, run.id, {
    expected_revision: run.revision,
    verification_reference: `${referencePrefix}-${run.run_number}-VERIFY`,
    verification_note: "已复核口径哈希、仓库发布水位、事实数量、血缘覆盖和分维度观测结果",
  }), "指标结果已独立验证并发布");

  return <FactoryPage pageId="client-metric-center" template="dashboard" sourceScope="client_source" autoRegions><main className="p-4 md:p-6" data-factory-metric-center-page data-metric-center-mode={mode}>
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-xl font-bold"><Scale className="h-5 w-5" />指标语义中心</h1><p className="mt-1 text-sm opacity-70">统一跨部门指标口径；指标只能引用已审批数据仓库字段，新口径必须发布新版本，历史计算永不静默重算。</p></div>
        <div className="flex gap-2"><Input aria-label="指标中心项目ID" className="w-24" value={projectText} onChange={(event) => setProjectText(event.target.value)} /><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />载入指标</Button></div>
      </div>

      <Card><CardHeader><CardTitle className="text-base">建立受治理指标口径</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <select aria-label="指标仓库来源" className="h-10 rounded-md border bg-background px-3 text-sm" value={sourceId} onChange={(event) => setSourceId(event.target.value)}>{workspace.warehouse_sources.map((item) => <option key={item.id} value={item.id}>{item.source_code} · {item.source_number}</option>)}</select>
        <Input aria-label="指标代码" value={metricCode} onChange={(event) => setMetricCode(event.target.value)} />
        <Input aria-label="指标名称" value={label} onChange={(event) => setLabel(event.target.value)} />
        <Input aria-label="指标责任人" value={owner} onChange={(event) => setOwner(event.target.value)} />
        <select aria-label="指标聚合方式" className="h-10 rounded-md border bg-background px-3 text-sm" value={aggregation} onChange={(event) => setAggregation(event.target.value)}>{["sum", "average", "count"].map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select aria-label="指标数值字段" className="h-10 rounded-md border bg-background px-3 text-sm" value={valueField} onChange={(event) => setValueField(event.target.value)}>{source?.fields.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select aria-label="指标维度字段" className="h-10 rounded-md border bg-background px-3 text-sm" value={dimension} onChange={(event) => setDimension(event.target.value)}><option value="">无维度</option>{source?.fields.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <Input aria-label="指标证据前缀" value={referencePrefix} onChange={(event) => setReferencePrefix(event.target.value)} />
        <Button className="md:col-span-2 xl:col-span-4" data-metric-definition-create disabled={!sourceId} onClick={() => void create()}><Calculator className="mr-1 h-4 w-4" />建立指标定义与 V1 草稿</Button>
      </CardContent></Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-base">定义与不可变版本</CardTitle></CardHeader><CardContent className="space-y-3">
          {workspace.definitions.length === 0 ? <p className="text-sm opacity-70">尚未建立指标定义。</p> : workspace.definitions.map((definition) => <div key={definition.id} className="rounded-lg border p-3" data-metric-definition-status={definition.status}>
            <div className="flex flex-wrap items-center justify-between gap-2"><div><b>{definition.definition_number} · {definition.metric_code}</b><p className="text-xs opacity-70">{definition.owner} · {definition.domain}</p></div><Badge>{STATUS_LABEL[definition.status]}</Badge></div>
            <p className="mt-2 text-sm">{definition.purpose}</p>
            {definition.status === "active" ? <Button className="mt-2" size="sm" variant="outline" data-metric-version-new onClick={() => void newVersion(definition)}><GitBranch className="mr-1 h-4 w-4" />建立新口径版本</Button> : null}
            <div className="mt-3 space-y-2">{(versionsByDefinition.get(definition.id) ?? []).map((version) => <div key={version.id} className="rounded-md bg-muted/40 p-2" data-metric-version-status={version.status} data-metric-history-pinned={version.status === "superseded" ? "true" : undefined}>
              <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm">V{version.version_number} · {version.label}</b><Badge variant={version.status === "published" ? "default" : "secondary"}>{STATUS_LABEL[version.status]}</Badge></div>
              <p className="mt-1 text-xs">{version.aggregation}({version.value_field ?? "facts"}) · {version.unit} · 维度 {version.dimensions.join("、") || "无"}</p><p className="mt-1 break-all text-[11px] opacity-60" data-metric-formula-hash>公式哈希 {version.formula_hash}</p>
              <div className="mt-2 flex flex-wrap gap-2">{version.status === "draft" ? <Button size="sm" data-metric-version-submit onClick={() => void submit(version)}>提交审批</Button> : null}{version.status === "pending-approval" ? <Button size="sm" data-metric-version-approve onClick={() => void approve(version)}><ShieldCheck className="mr-1 h-4 w-4" />独立审批发布</Button> : null}{version.status === "published" ? <Button size="sm" data-metric-evaluate onClick={() => void evaluate(version)}><Play className="mr-1 h-4 w-4" />按仓库水位计算</Button> : null}{version.status === "superseded" ? <span className="text-xs font-semibold text-amber-600">历史结果保持版本锁定</span> : null}</div>
            </div>)}</div>
          </div>)}
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="text-base">计算、验证与发布</CardTitle></CardHeader><CardContent className="space-y-3">
          {workspace.evaluation_runs.length === 0 ? <p className="text-sm opacity-70">尚无指标计算批次。</p> : workspace.evaluation_runs.map((run) => <div key={run.id} className="rounded-lg border p-3" data-metric-run-status={run.status}>
            <div className="flex flex-wrap items-center justify-between gap-2"><div><b>{run.run_number} · {run.metric_code}@V{run.metric_version_number}</b><p className="text-xs opacity-70">仓库批次 {run.warehouse_run_number}</p></div><Badge>{STATUS_LABEL[run.status]}</Badge></div>
            <p className="mt-2 text-sm">指标值 <strong className="text-lg">{run.metric_value}</strong> · 事实 {run.fact_count} · 血缘 {run.lineage_count} · 观测 {run.observation_count}</p>
            {run.status === "evaluated" ? <Button className="mt-2" size="sm" data-metric-verify onClick={() => void verify(run)}><BadgeCheck className="mr-1 h-4 w-4" />独立验证发布</Button> : <p className="mt-2 text-xs font-semibold text-emerald-600" data-metric-published>已形成可审计指标发布结果</p>}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">{(observationsByRun.get(run.id) ?? []).map((item) => <div key={item.id} className="rounded bg-muted/50 p-2 text-xs" data-metric-observation={item.id}><b>{Object.entries(item.dimensions).map(([key, value]) => `${key}=${String(value)}`).join(" · ") || "全部"}</b><p>{item.metric_value} · {item.fact_count} 条事实</p></div>)}</div>
          </div>)}
        </CardContent></Card>
      </div>

      <Card><CardContent className="flex flex-wrap gap-2 py-4 text-xs"><Badge>{workspace.contract.formula_mode}</Badge><Badge>历史重算：{workspace.contract.historical_recalculation ? "允许" : "禁止"}</Badge><Badge>作者/审批分离：{workspace.contract.approval_independent ? "是" : "否"}</Badge><Badge>计算/验证分离：{workspace.contract.evaluation_verification_independent ? "是" : "否"}</Badge><Badge>必须使用已发布仓库：{workspace.contract.warehouse_publication_required ? "是" : "否"}</Badge></CardContent></Card>
    </div>
  </main></FactoryPage>;
}
