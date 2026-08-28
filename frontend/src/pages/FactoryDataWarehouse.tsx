import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Database, GitBranch, Play, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FactoryPage } from "@/page-factory/FactoryPage";
import {
  activateWarehouseSource, createWarehouseSource, extractWarehouseSource,
  listFactoryDataWarehouse, publishWarehouseRun, validateWarehouseRun,
  type FactoryDataWarehouseWorkspace, type WarehouseLoadRun, type WarehouseSource,
} from "@/lib/factory-data-warehouse-api";

const EMPTY: FactoryDataWarehouseWorkspace = {
  sources: [], runs: [], facts: [], quality_issues: [], lineage: [], evidence: [], available_sources: [],
  contract: { copy_mode: "analytical-read-only", fact_version: "source-id+revision", lineage_required: true, credentials_exposed: false },
};
const STATUS_LABEL: Record<string, string> = { draft: "待审批", active: "已启用", extracted: "已抽取", validated: "已校验", failed: "已阻断", published: "已发布" };

export default function FactoryDataWarehouse() {
  const [projectText, setProjectText] = useState("1");
  const [mode, setMode] = useState<"loading" | "live" | "error">("loading");
  const [workspace, setWorkspace] = useState<FactoryDataWarehouseWorkspace>(EMPTY);
  const [sourceCode, setSourceCode] = useState("orders");
  const [owner, setOwner] = useState("data-owner-001");
  const [purpose, setPurpose] = useState("汇聚订单权威事实，用于经营分析、履约监控与跨系统指标计算");
  const [referencePrefix, setReferencePrefix] = useState("DW-ORDERS-001");
  const projectId = Number(projectText);

  const load = async (silent = false) => {
    if (!Number.isInteger(projectId) || projectId <= 0) return;
    if (!silent) setMode("loading");
    try { setWorkspace(await listFactoryDataWarehouse(projectId)); setMode("live"); }
    catch (error) { setMode("error"); toast.error(error instanceof Error ? error.message : "数据仓库加载失败"); }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sourceById = useMemo(() => new Map(workspace.sources.map((item) => [item.id, item])), [workspace.sources]);
  const execute = async (operation: () => Promise<unknown>, message: string) => {
    try { await operation(); toast.success(message); await load(true); }
    catch (error) { toast.error(error instanceof Error ? error.message : "数据仓库操作失败"); await load(true); }
  };
  const create = () => execute(() => createWarehouseSource(projectId, {
    source_reference: `${referencePrefix}-SOURCE`, source_code: sourceCode, owner, purpose, retention_days: 730,
  }), "受控数据源已登记，等待审批启用");
  const activate = (source: WarehouseSource) => execute(() => activateWarehouseSource(projectId, source.id, {
    expected_revision: source.revision,
    schema_contract_reference: `${referencePrefix}-SCHEMA-V1`, approval_reference: `${referencePrefix}-APPROVAL`,
  }), "数据源已按模式契约审批启用");
  const extract = (source: WarehouseSource) => execute(() => extractWarehouseSource(projectId, source.id, {
    expected_source_revision: source.revision, load_reference: `${referencePrefix}-LOAD-${Date.now()}`,
    cutoff_at: new Date().toISOString(),
  }), "权威事实已只读抽取，版本与血缘已建立");
  const validate = (run: WarehouseLoadRun) => execute(() => validateWarehouseRun(projectId, run.id, {
    expected_revision: run.revision, validation_reference: `${referencePrefix}-${run.run_number}-VALIDATE`,
  }), "装载批次已完成质量校验");
  const publish = (run: WarehouseLoadRun) => execute(() => publishWarehouseRun(projectId, run.id, {
    expected_revision: run.revision, publication_reference: `${referencePrefix}-${run.run_number}-PUBLISH`,
  }), "装载批次已独立发布");

  return <FactoryPage pageId="client-data-warehouse" template="dashboard" sourceScope="client_source" autoRegions><main className="p-4 md:p-6" data-factory-data-warehouse-page data-data-warehouse-mode={mode}>
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-xl font-bold"><Database className="h-5 w-5" />经营数据仓库</h1><p className="mt-1 text-sm opacity-70">只读复制权威业务事实；每条事实按来源ID与修订号固化，批次必须通过质量校验、血缘审计和独立发布。</p></div>
        <div className="flex gap-2"><Input aria-label="数据仓库项目ID" className="w-24" value={projectText} onChange={(event) => setProjectText(event.target.value)} /><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />载入仓库</Button></div>
      </div>

      <Card><CardHeader><CardTitle className="text-base">登记受控数据源</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <select aria-label="权威数据源" className="h-10 rounded-md border bg-background px-3 text-sm" value={sourceCode} onChange={(event) => setSourceCode(event.target.value)}>{workspace.available_sources.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.system}</option>)}</select>
        <Input aria-label="数据所有者" value={owner} onChange={(event) => setOwner(event.target.value)} />
        <Input aria-label="数据源证据前缀" value={referencePrefix} onChange={(event) => setReferencePrefix(event.target.value)} />
        <Button data-warehouse-source-create onClick={() => void create()}><Database className="mr-1 h-4 w-4" />登记数据源</Button>
        <Input aria-label="数据使用目的" className="md:col-span-2 xl:col-span-4" value={purpose} onChange={(event) => setPurpose(event.target.value)} />
      </CardContent></Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-base">数据源与水位</CardTitle></CardHeader><CardContent className="space-y-3">
          {workspace.sources.length === 0 ? <p className="text-sm opacity-70">尚未登记数据源。</p> : workspace.sources.map((source) => <div key={source.id} className="rounded-lg border p-3" data-warehouse-source-status={source.status}>
            <div className="flex flex-wrap items-center justify-between gap-2"><div><b>{source.source_number} · {source.source_code}</b><p className="text-xs opacity-70">{source.source_system}/{source.source_table}</p></div><Badge>{STATUS_LABEL[source.status]}</Badge></div>
            <p className="mt-2 text-sm">责任人 {source.owner} · 保留 {source.retention_days} 天</p><p className="mt-1 break-all text-xs opacity-60">模式指纹 {source.schema_fingerprint ?? "待审批生成"}</p><p className="mt-1 text-xs opacity-70">已发布水位 {source.last_watermark_at ? new Date(source.last_watermark_at).toLocaleString() : "暂无"}</p>
            <div className="mt-3 flex gap-2">{source.status === "draft" ? <Button size="sm" data-warehouse-source-activate onClick={() => void activate(source)}><ShieldCheck className="mr-1 h-4 w-4" />审批启用</Button> : <Button size="sm" data-warehouse-extract onClick={() => void extract(source)}><Play className="mr-1 h-4 w-4" />只读抽取</Button>}</div>
          </div>)}
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="text-base">装载质量与发布</CardTitle></CardHeader><CardContent className="space-y-3">
          {workspace.runs.length === 0 ? <p className="text-sm opacity-70">尚无装载批次。</p> : workspace.runs.map((run) => <div key={run.id} className="rounded-lg border p-3" data-warehouse-run-status={run.status}>
            <div className="flex flex-wrap items-center justify-between gap-2"><div><b>{run.run_number} · {run.source_code}</b><p className="text-xs opacity-70">{run.load_reference}</p></div><Badge variant={run.status === "failed" ? "destructive" : "secondary"}>{STATUS_LABEL[run.status]}</Badge></div>
            <p className="mt-2 text-sm">读取 {run.rows_read} · 接受 {run.rows_accepted} · 拒绝 {run.rows_rejected} · 复用 {run.reused_fact_count} · 质量 {run.quality_score}%</p>
            {run.failure_reason ? <p className="mt-1 text-xs text-destructive">{run.failure_reason}</p> : null}
            <div className="mt-3 flex gap-2">{run.status === "extracted" ? <Button size="sm" data-warehouse-validate onClick={() => void validate(run)}><BadgeCheck className="mr-1 h-4 w-4" />质量校验</Button> : null}{run.status === "validated" ? <Button size="sm" data-warehouse-publish onClick={() => void publish(run)}><ShieldCheck className="mr-1 h-4 w-4" />独立发布</Button> : null}{run.status === "published" ? <span className="text-xs font-semibold text-emerald-600" data-warehouse-published>已形成可审计发布水位</span> : null}</div>
          </div>)}
        </CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><GitBranch className="h-4 w-4" />事实版本与血缘</CardTitle></CardHeader><CardContent>
        <div className="mb-3 flex flex-wrap gap-2 text-xs"><Badge>{workspace.contract.copy_mode}</Badge><Badge>{workspace.contract.fact_version}</Badge><Badge>血缘必填：{workspace.contract.lineage_required ? "是" : "否"}</Badge><Badge>暴露凭证：{workspace.contract.credentials_exposed ? "是" : "否"}</Badge></div>
        <div className="grid gap-3 md:grid-cols-2">{workspace.facts.map((fact) => <div key={fact.id} className="rounded-lg border p-3" data-warehouse-fact={fact.id}><b className="text-sm">{fact.fact_number} · {fact.source_object_number}</b><p className="text-xs opacity-70">{fact.source_table}/{fact.source_object_id}@rev{fact.source_revision}</p><p className="mt-1 break-all text-[11px] opacity-60">hash {fact.content_hash}</p>{workspace.lineage.filter((edge) => edge.fact_id === fact.id).map((edge) => <p key={edge.id} className="mt-2 rounded bg-muted/50 p-2 text-xs" data-warehouse-lineage={edge.id}>{edge.run_number} → {edge.transformation_reference}</p>)}</div>)}</div>
        {workspace.facts.length === 0 ? <p className="py-5 text-center text-sm opacity-70">完成抽取后，这里会显示不可变事实版本和逐批血缘。</p> : null}
      </CardContent></Card>
    </div>
  </main></FactoryPage>;
}
