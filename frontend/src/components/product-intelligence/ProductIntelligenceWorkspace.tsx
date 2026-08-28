import { useEffect, useState } from "react";
import { BadgeCheck, BarChart3, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCurrentClientPlanId } from "@/lib/current-client-plan";
import {
  approveProductRelease,
  createProductAssessment,
  createProductSignal,
  createProductStudy,
  listProductIntelligence,
  prepareProductRelease,
  reviewProductAssessment,
  verifyProductSignal,
  type ProductIntelligenceWorkspace as Workspace,
} from "@/lib/factory-product-intelligence-api";

const EMPTY: Workspace = {
  studies: [], signals: [], assessments: [], releases: [], evidence: [],
  metrics: { studies: 0, verified_signal_percent: 0, approved_assessments: 0, available_releases: 0, latest_opportunity_score: null },
  availability: { application_id: "identity.product-intelligence", status: "pilot", release_version: null, support_until: null },
  contract: {},
};

const SIGNAL_TYPES = ["demand", "margin", "growth", "competition", "capability-fit"] as const;
const SIGNAL_LABELS: Record<string, string> = {
  demand: "需求强度", margin: "毛利空间", growth: "增长趋势", competition: "竞争有利度", "capability-fit": "工厂能力匹配",
};
const STATUS: Record<string, string> = {
  gathering: "信号采集中", "assessment-pending": "评估待审", assessed: "评估通过", available: "正式可用",
  "pending-verification": "待核验", verified: "已核验", "pending-review": "待评估审核", approved: "已批准", "pending-approval": "待发布审批",
};

type ReleaseDraft = {
  release_version: string; tenant_scope: string; region_scope: string; connector_scope: string; support_owner: string;
  end_to_end_demo_reference: string; role_training_reference: string; issue_closure_reference: string;
  pilot_report_reference: string; runtime_monitoring_reference: string; rollback_drill_reference: string;
};

const RELEASE_FIELDS: Array<{ key: keyof ReleaseDraft; label: string }> = [
  { key: "release_version", label: "版本号" }, { key: "tenant_scope", label: "租户范围" },
  { key: "region_scope", label: "区域范围（逗号分隔）" }, { key: "connector_scope", label: "连接器范围（逗号分隔）" },
  { key: "support_owner", label: "支持负责人" }, { key: "end_to_end_demo_reference", label: "端到端演示证据" },
  { key: "role_training_reference", label: "角色培训证据" }, { key: "issue_closure_reference", label: "问题闭环证据" },
  { key: "pilot_report_reference", label: "试点报告证据" }, { key: "runtime_monitoring_reference", label: "运行监控证据" },
  { key: "rollback_drill_reference", label: "回滚演练证据" },
];

export function ProductIntelligenceWorkspace() {
  const activePlanId = useCurrentClientPlanId();
  const projectId = activePlanId ?? 0;
  const [workspace, setWorkspace] = useState<Workspace>(EMPTY);
  const [mode, setMode] = useState("loading");
  const [studyDraft, setStudyDraft] = useState({ product_reference: "ROBOT-CELL", product_name: "柔性机器人工作站", business_objective: "验证海外市场需求、可实现毛利与工厂交付能力后决定产品投入", base_currency: "USD" });
  const [signalScore, setSignalScore] = useState("80");
  const [signalRaw, setSignalRaw] = useState("1000");
  const [sourceReference, setSourceReference] = useState("");
  const [releaseDraft, setReleaseDraft] = useState<ReleaseDraft>({
    release_version: "2026.08.1", tenant_scope: "project-current", region_scope: "CN,US", connector_scope: "governed-connector", support_owner: "growth-ops",
    end_to_end_demo_reference: "", role_training_reference: "", issue_closure_reference: "", pilot_report_reference: "", runtime_monitoring_reference: "", rollback_drill_reference: "",
  });

  const load = async () => {
    if (!activePlanId) { setWorkspace(EMPTY); setMode("waiting-plan"); return; }
    try { setMode("loading"); setWorkspace(await listProductIntelligence(projectId)); setMode("live"); }
    catch (error) { setMode("error"); toast.error(error instanceof Error ? error.message : "产品分析载入失败"); }
  };
  useEffect(() => { void load(); }, [activePlanId]);
  const run = async (action: () => Promise<unknown>, message: string) => {
    try { await action(); toast.success(message); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "产品分析操作失败"); await load(); }
  };

  const study = workspace.studies[0];
  const signals = workspace.signals.filter((item) => item.study_id === study?.id);
  const nextSignalType = SIGNAL_TYPES.find((type) => !signals.some((item) => item.signal_type === type));
  const pendingSignal = signals.find((item) => item.status === "pending-verification");
  const assessment = workspace.assessments.find((item) => item.study_id === study?.id);
  const release = workspace.releases.find((item) => item.assessment_id === assessment?.id);
  const evidenceReady = RELEASE_FIELDS.filter(({ key }) => key.endsWith("_reference")).every(({ key }) => releaseDraft[key].trim());
  const updateRelease = (key: keyof ReleaseDraft, value: string) => setReleaseDraft((current) => ({ ...current, [key]: value }));

  return <main className="space-y-4" data-product-intelligence-page data-product-intelligence-mode={mode} data-product-intelligence-availability={workspace.availability.status}>
    <div data-page-factory-responsive-row className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-bold"><BarChart3 className="h-5 w-5" />产品机会研究室</h2><p className="mt-1 text-sm text-slate-500">只消费带来源版本的市场、毛利、增长、竞争与工厂能力信号；异人核验后形成机会评分，不改写 PLM 工程事实。</p></div><div data-page-factory-responsive-actions className="flex items-center gap-2"><Input aria-label="项目编号" className="w-20" type="number" min={1} value={activePlanId ?? ""} placeholder="加载中" readOnly aria-readonly="true" /><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />刷新</Button><Badge variant={workspace.availability.status === "available" ? "default" : "outline"}>{workspace.availability.status === "available" ? "正式可用" : "试点"}</Badge></div></div>
    <div data-page-factory-responsive-grid className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["研究项目", workspace.metrics.studies], ["信号核验", `${workspace.metrics.verified_signal_percent}%`], ["批准评估", workspace.metrics.approved_assessments], ["可用发布", workspace.metrics.available_releases], ["机会评分", workspace.metrics.latest_opportunity_score ?? "—"]].map(([label, value]) => <Card key={label} data-page-factory-region="small-card" data-development-standard-frame-region="small-card" data-development-standard-frame-label="小卡片" data-shared-small-card-surface="true"><CardContent className="py-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></CardContent></Card>)}</div>
    <Card data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" data-shared-large-card-surface="true"><CardHeader><CardTitle className="text-base">1. 产品研究与五类来源信号</CardTitle></CardHeader><CardContent className="space-y-3">
      <div data-page-factory-responsive-grid className="grid gap-2 md:grid-cols-4"><Input value={studyDraft.product_reference} onChange={(event) => setStudyDraft({ ...studyDraft, product_reference: event.target.value })} placeholder="产品引用" /><Input value={studyDraft.product_name} onChange={(event) => setStudyDraft({ ...studyDraft, product_name: event.target.value })} placeholder="产品名称" /><Input value={studyDraft.business_objective} onChange={(event) => setStudyDraft({ ...studyDraft, business_objective: event.target.value })} placeholder="业务目标" /><Button data-product-study-create disabled={!activePlanId || !!study} onClick={() => void run(() => createProductStudy(projectId, { ...studyDraft }), "研究项目已创建")}>建立研究</Button></div>
      <div data-page-factory-responsive-grid className="grid gap-2 md:grid-cols-5"><Input value={nextSignalType ? SIGNAL_LABELS[nextSignalType] : "五类信号已齐"} disabled /><Input type="number" min={0} max={100} value={signalScore} onChange={(event) => setSignalScore(event.target.value)} placeholder="标准分" /><Input type="number" value={signalRaw} onChange={(event) => setSignalRaw(event.target.value)} placeholder="原始值" /><Input value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} placeholder="权威来源引用" /><Button data-product-signal-create disabled={!activePlanId || !study || !nextSignalType || !sourceReference.trim()} onClick={() => study && nextSignalType && void run(() => createProductSignal(projectId, study.id, { signal_type: nextSignalType, normalized_score: Number(signalScore), raw_value: Number(signalRaw), measurement_unit: "index", region: "GLOBAL", source_system: "governed-connector", source_reference: sourceReference, source_revision: "2026.08", source_observed_at: new Date().toISOString() }), "来源信号已固证")}>记录信号</Button></div>
      <div data-page-factory-responsive-actions className="flex flex-wrap gap-2"><Button data-product-signal-verify disabled={!activePlanId || !pendingSignal} onClick={() => pendingSignal && void run(() => verifyProductSignal(projectId, pendingSignal.id, { expected_revision: pendingSignal.revision, verification_reference: `SIGNAL-QA-${Date.now()}` }), "信号已独立核验")}>独立核验信号</Button><Button data-product-assessment-create disabled={!activePlanId || !study || !!assessment || signals.filter((item) => item.status === "verified").length !== 5} onClick={() => study && void run(() => createProductAssessment(projectId, study.id, { assumptions: "采用当前批准的区域、币种、来源版本和归一化口径" }), "机会评估已生成")}>生成机会评估</Button><Button data-product-assessment-review disabled={!activePlanId || !assessment || assessment.status !== "pending-review"} onClick={() => assessment && void run(() => reviewProductAssessment(projectId, assessment.id, { expected_revision: assessment.revision, decision: "approve", review_reference: `PORTFOLIO-QA-${Date.now()}`, review_note: "已独立核验五类来源、评分权重与业务假设" }), "机会评估已独立审核")}>独立审核评估</Button></div>
      {signals.map((item) => <div key={item.id} data-product-intelligence-record data-product-intelligence-status={item.status} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"><span><b>{SIGNAL_LABELS[item.signal_type]}</b> · {item.source_system}/{item.source_revision} · {item.region}</span><span className="flex items-center gap-2"><span>{item.normalized_score}分</span><Badge>{STATUS[item.status] ?? item.status}</Badge></span></div>)}
      {assessment ? <div data-product-intelligence-record data-product-intelligence-status={assessment.status} className="rounded-md border p-3 text-sm"><b>{assessment.assessment_number}</b> · 评分 {assessment.opportunity_score} · 建议 {assessment.recommendation} · <Badge>{STATUS[assessment.status] ?? assessment.status}</Badge><p className="mt-1 break-all text-xs text-slate-500">输入哈希 {assessment.input_hash}</p></div> : null}
    </CardContent></Card>
    <Card data-page-factory-region="large-card" data-development-standard-frame-region="large-card" data-development-standard-frame-label="大卡片" data-shared-large-card-surface="true"><CardHeader><CardTitle className="text-base">2. 当前版本商业可用证据</CardTitle></CardHeader><CardContent className="space-y-3">
      <div data-page-factory-responsive-grid className="grid gap-2 md:grid-cols-3">{RELEASE_FIELDS.map(({ key, label }) => <Input key={key} value={releaseDraft[key]} onChange={(event) => updateRelease(key, event.target.value)} placeholder={label} aria-label={label} />)}</div>
      <div data-page-factory-responsive-actions className="flex flex-wrap gap-2"><Button data-product-release-prepare disabled={!activePlanId || !assessment || assessment.status !== "approved" || !!release || !evidenceReady} onClick={() => assessment && void run(() => prepareProductRelease(projectId, assessment.id, { ...releaseDraft, region_scope: releaseDraft.region_scope.split(",").map((value) => value.trim()).filter(Boolean), connector_scope: releaseDraft.connector_scope.split(",").map((value) => value.trim()).filter(Boolean), support_until: new Date(Date.now() + 180 * 86400000).toISOString() }), "当前版本证据清单已固证")}>准备正式发布</Button><Button data-product-release-approve disabled={!activePlanId || !release || release.status !== "pending-approval"} onClick={() => release && void run(() => approveProductRelease(projectId, release.id, { expected_revision: release.revision, approval_reference: `GA-APPROVAL-${Date.now()}` }), "产品分析已批准为正式可用")}>独立批准发布</Button></div>
      {release ? <div data-product-intelligence-record data-product-intelligence-status={release.status} className="rounded-md border p-3 text-sm"><div className="flex items-center justify-between"><b>{release.release_number} · {release.release_version}</b><Badge><BadgeCheck className="mr-1 h-3 w-3" />{release.available ? "正式可用" : STATUS[release.status] ?? release.status}</Badge></div><p className="mt-1 break-all text-xs text-slate-500">清单哈希 {release.manifest_hash} · 支持至 {new Date(release.support_until).toLocaleDateString()}</p></div> : null}
    </CardContent></Card>
  </main>;
}
