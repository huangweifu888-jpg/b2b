import { useState } from "react";
import { ArrowRight, ClipboardCheck, Plus, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { advanceFactoryImplementationProgram, createFactoryImplementationProgram, listFactoryImplementationPrograms, updateFactoryImplementationProgram, type FactoryImplementationProgram, type ImplementationGoldenFlow } from "@/lib/factory-implementation-api";

const STAGE_LABELS = { "day-7": "7天就绪", "day-30": "30天通链", "day-90": "90天价值", completed: "周期完成" } as const;
const FLOW_LABELS: Record<ImplementationGoldenFlow, string> = { revenue: "收入闭环", manufacturing: "制造履约", "asset-renewal": "资产续费", "global-compliance": "出海合规", "intelligent-action": "智能行动" };
const ARTIFACT_LABELS: Record<string, string> = {
  "readiness-score": "准备度评分", "project-roles": "项目角色", "data-inventory": "数据清单", "connector-inventory": "连接器清单", "permission-matrix": "权限矩阵", "risk-register": "风险清单", "thirty-day-goal": "30天黄金链目标",
  "end-to-end-demo": "端到端演示", "role-training": "角色培训", "issue-closure": "问题闭环", "pilot-report": "试点报告", "runtime-monitoring": "运行监控", "rollback-drill": "回退演练",
  "value-proof": "价值证明", "metric-definition": "指标口径", "customer-confirmation": "客户确认", "expansion-plan": "扩展方案", "renewal-recommendation": "续费建议", "next-owner": "下一轮负责人",
};
type Draft = { artifacts: Record<string, string>; blockers: string; nextAction: string };

const toDraft = (item: FactoryImplementationProgram): Draft => ({ artifacts: { ...item.artifacts }, blockers: item.blockers.join("\n"), nextAction: item.next_action });

export function FactoryImplementationCenter() {
  const [projectIdText, setProjectIdText] = useState("1");
  const [programs, setPrograms] = useState<FactoryImplementationProgram[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [title, setTitle] = useState("首个客户7/30/90天实施");
  const [goldenFlow, setGoldenFlow] = useState<ImplementationGoldenFlow>("revenue");
  const [baseline, setBaseline] = useState("记录上线前流程、周期、人工投入与结果基线");
  const [target, setTarget] = useState("30天内以受控真实样本跑通第一条黄金业务链");
  const [mode, setMode] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const projectId = Number(projectIdText);

  const replace = (item: FactoryImplementationProgram) => {
    setPrograms((current) => current.map((candidate) => candidate.id === item.id ? item : candidate));
    setDrafts((current) => ({ ...current, [item.id]: toDraft(item) }));
  };
  const load = async () => {
    if (!Number.isInteger(projectId) || projectId <= 0) return toast.error("请输入有效计划ID");
    setMode("loading"); setError(null);
    try {
      const items = (await listFactoryImplementationPrograms(projectId)).items;
      setPrograms(items); setDrafts(Object.fromEntries(items.map((item) => [item.id, toDraft(item)]))); setMode("live");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "实施中心连接失败"); setMode("error"); }
  };
  const create = async () => {
    if (!Number.isInteger(projectId) || projectId <= 0) return toast.error("请输入有效计划ID");
    try {
      const item = await createFactoryImplementationProgram(projectId, { title, golden_flow: goldenFlow, baseline_summary: baseline, target_outcome: target });
      setPrograms((current) => [item, ...current]); setDrafts((current) => ({ ...current, [item.id]: toDraft(item) })); setMode("live"); toast.success("实施周期已创建");
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "创建失败"); }
  };
  const updateDraft = (id: string, changes: Partial<Draft>) => setDrafts((current) => ({ ...current, [id]: { ...(current[id] || { artifacts: {}, blockers: "", nextAction: "" }), ...changes } }));
  const save = async (item: FactoryImplementationProgram) => {
    const draft = drafts[item.id] || toDraft(item);
    try {
      replace(await updateFactoryImplementationProgram(projectId, item.id, { expected_revision: item.revision, artifacts: draft.artifacts, blockers: draft.blockers.split(/\r?\n/).map((value) => value.trim()).filter(Boolean), next_action: draft.nextAction }));
      toast.success("实施证据已保存");
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "保存失败"); await load(); }
  };
  const advance = async (item: FactoryImplementationProgram) => {
    try { replace(await advanceFactoryImplementationProgram(projectId, item.id, item.revision)); toast.success("已通过当前实施门禁"); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "门禁未通过"); }
  };

  return <section className="mt-5" data-factory-platform-implementation-workbench data-implementation-mode={mode}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="h-4 w-4" />客户实施中心 · 7/30/90天<Badge variant={mode === "live" ? "default" : "outline"}>{mode === "live" ? "实时" : "待连接"}</Badge></div><div className="flex gap-2"><Input aria-label="实施中心计划ID" value={projectIdText} onChange={(event) => setProjectIdText(event.target.value)} className="h-8 w-24" /><Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-3.5 w-3.5" />载入计划</Button></div></div>
    <p className="mb-3 text-xs opacity-75">一个客户计划同时只能运行一个实施周期。每阶段必须补齐标准证据、清零阻断并通过门禁；所有更新使用修订号防止覆盖，并写入审计。</p>
    {error ? <p data-implementation-error className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">{error}</p> : null}
    <Card className="mb-3 border-current/20 bg-transparent shadow-none"><CardContent className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-5"><Input aria-label="实施周期名称" value={title} onChange={(event) => setTitle(event.target.value)} /><select aria-label="黄金业务链" value={goldenFlow} onChange={(event) => setGoldenFlow(event.target.value as ImplementationGoldenFlow)} className="h-10 rounded-md border border-current/20 bg-transparent px-3 text-sm">{Object.entries(FLOW_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Input aria-label="上线前基线" value={baseline} onChange={(event) => setBaseline(event.target.value)} /><Input aria-label="实施目标" value={target} onChange={(event) => setTarget(event.target.value)} /><Button data-implementation-create onClick={() => void create()}><Plus className="mr-1 h-4 w-4" />新建实施周期</Button></CardContent></Card>
    <div className="grid gap-3 xl:grid-cols-2">{programs.map((item) => { const draft = drafts[item.id] || toDraft(item); return <Card key={item.id} data-implementation-program={item.id} data-implementation-stage={item.current_stage} className="border-current/20 bg-transparent shadow-none"><CardHeader className="pb-2"><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{item.title} · {FLOW_LABELS[item.golden_flow]}</span><Badge variant={item.status === "completed" ? "default" : item.status === "blocked" ? "destructive" : "outline"}>{STAGE_LABELS[item.current_stage]}</Badge></CardTitle></CardHeader><CardContent className="space-y-3 text-xs"><p className="opacity-70">{item.plan_id} · 修订 {item.revision}</p><p><b>基线：</b>{item.baseline_summary}</p><p><b>目标：</b>{item.target_outcome}</p>{item.current_stage !== "completed" ? <><div className="grid gap-2 sm:grid-cols-2">{item.required_artifacts.map((key) => <label key={key} className="block"><span className="font-semibold">{ARTIFACT_LABELS[key] || key}</span><textarea data-implementation-artifact={key} value={draft.artifacts[key] || ""} onChange={(event) => updateDraft(item.id, { artifacts: { ...draft.artifacts, [key]: event.target.value } })} className="mt-1 min-h-16 w-full rounded border border-current/20 bg-transparent px-2 py-1" /></label>)}</div><label className="block"><span className="font-semibold">阻断（每行一项，推进前须清零）</span><textarea value={draft.blockers} onChange={(event) => updateDraft(item.id, { blockers: event.target.value })} className="mt-1 min-h-16 w-full rounded border border-current/20 bg-transparent px-2 py-1" /></label><label className="block"><span className="font-semibold">下一动作</span><textarea value={draft.nextAction} onChange={(event) => updateDraft(item.id, { nextAction: event.target.value })} className="mt-1 min-h-16 w-full rounded border border-current/20 bg-transparent px-2 py-1" /></label><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" data-implementation-save onClick={() => void save(item)}><Save className="mr-1 h-3.5 w-3.5" />保存证据</Button><Button size="sm" data-implementation-advance onClick={() => void advance(item)}>通过门禁<ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></div></> : <p className="font-semibold text-emerald-600">7/30/90天实施周期已完成，证据保留为只读审计记录。</p>}</CardContent></Card>; })}</div>
  </section>;
}
