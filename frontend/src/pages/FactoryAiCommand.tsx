import { useEffect, useMemo, useState } from "react";
import { Bot, BrainCircuit, Calculator, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FactoryPage } from "@/page-factory/FactoryPage";
import {
  approveAiRecommendation, askAiCommand, closeAiHandoff, createAiRecommendation,
  handoffAiRecommendation, listAiCommandWorkspace, simulateAiCommand,
  type AiCommandRecommendation, type AiCommandWorkspace,
} from "@/lib/factory-ai-command-api";

const EMPTY: AiCommandWorkspace = {
  queries: [], citations: [], scenarios: [], recommendations: [], handoffs: [], evidence: [], readiness: [],
  contract: { engine: "deterministic-governed-retrieval-and-scenario", external_llm_called: false, answers_require_citations: true, scenario_writeback: false, recommendation_requires_independent_approval: true, business_execution_remains_in_target_system: true },
};
const SOURCE_LABEL: Record<string, string> = { "health-snapshot": "经营健康", "revenue-profit-run": "贡献利润", "forecast-run": "经营预测" };
const STATUS: Record<string, string> = { "pending-approval": "待异人审批", approved: "已审批", "handed-off": "已交接", closed: "已闭环", calculated: "已计算", answered: "已回答" };

export default function FactoryAiCommand() {
  const [projectText, setProjectText] = useState("1");
  const [mode, setMode] = useState<"loading" | "live" | "error">("loading");
  const [workspace, setWorkspace] = useState<AiCommandWorkspace>(EMPTY);
  const [question, setQuestion] = useState("未来现金和产能情况怎么样？");
  const [demand, setDemand] = useState("20");
  const [capacity, setCapacity] = useState("-10");
  const [cashIn, setCashIn] = useState("-15");
  const [cashOut, setCashOut] = useState("10");
  const [recommendationTitle, setRecommendationTitle] = useState("复核经营风险并建立责任行动");
  const [targetSystem, setTargetSystem] = useState("ERP");
  const [owner, setOwner] = useState("operations-owner");
  const projectId = Number(projectText);

  const load = async (silent = false) => {
    if (!Number.isInteger(projectId) || projectId <= 0) return;
    if (!silent) setMode("loading");
    try { setWorkspace(await listAiCommandWorkspace(projectId)); setMode("live"); }
    catch (error) { setMode("error"); toast.error(error instanceof Error ? error.message : "AI战情加载失败"); }
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const execute = async (operation: () => Promise<unknown>, message: string) => {
    try { await operation(); toast.success(message); await load(true); }
    catch (error) { toast.error(error instanceof Error ? error.message : "治理操作失败"); await load(true); }
  };
  const citations = useMemo(() => new Map(workspace.queries.map((item) => [
    item.id, workspace.citations.filter((citation) => citation.query_id === item.id),
  ])), [workspace.queries, workspace.citations]);
  const ready = workspace.readiness.length === 3 && workspace.readiness.every((item) => item.ready);
  const ask = () => execute(() => askAiCommand(projectId, {
    query_reference: `AI-QUERY-${Date.now()}`, question,
  }), "已从发布事实生成带引用的回答");
  const simulate = () => execute(() => simulateAiCommand(projectId, {
    scenario_reference: `AI-SCENARIO-${Date.now()}`, name: "经营压力情景",
    demand_change_percent: demand, capacity_change_percent: capacity,
    cash_in_change_percent: cashIn, cash_out_change_percent: cashOut,
  }), "情景已计算，原预测未回写");
  const createRecommendation = () => {
    const scenario = workspace.scenarios[0]; const query = workspace.queries[0];
    return execute(() => createAiRecommendation(projectId, {
      query_id: scenario ? null : query?.id, scenario_id: scenario?.id ?? null,
      title: recommendationTitle,
      rationale: "依据已固定来源修订号的问数或情景结果建立责任行动，执行事实仍由目标业务系统负责。",
      target_system: targetSystem, owner,
      due_at: new Date(Date.now() + 3 * 86400000).toISOString(), risk_level: "high",
    }), "建议已提交异人审批");
  };
  const approve = (item: AiCommandRecommendation) => execute(() => approveAiRecommendation(projectId, item.id, {
    expected_revision: item.revision, evidence_reference: `AI-APPROVAL-${item.recommendation_number}`,
  }), "建议已独立审批");
  const handoff = (item: AiCommandRecommendation) => execute(() => handoffAiRecommendation(projectId, item.id, {
    expected_revision: item.revision, evidence_reference: `${item.target_system}-TASK-${Date.now()}`,
  }), `建议已交接 ${item.target_system}`);

  return <FactoryPage pageId="client-ai-command" template="dashboard" sourceScope="client_source"><main data-page-factory-region="content" className="p-4 md:p-6" data-factory-ai-command-page data-ai-command-mode={mode}>
    <div className="mx-auto max-w-7xl space-y-4">
      <div data-page-factory-region="title-2" className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-xl font-bold"><BrainCircuit className="h-5 w-5" />AI问数与战情中心</h1><p className="mt-1 text-sm opacity-70">用已发布经营事实回答、模拟和生成责任行动；本版是可解释规则引擎，不冒充已调用外部大模型。</p></div>
        <div className="flex gap-2"><Input aria-label="AI战情项目ID" className="w-24" value={projectText} onChange={(event) => setProjectText(event.target.value)} /><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />载入战情</Button></div>
      </div>

      <Card data-page-factory-region="large-card"><CardHeader><CardTitle className="text-base">发布事实准备度</CardTitle></CardHeader><CardContent data-page-factory-region="small-card" className="grid gap-2 md:grid-cols-3">{workspace.readiness.map((item) => <div key={item.source_type} className="rounded-lg border p-3" data-ai-source-ready={item.ready ? "true" : "false"}><div className="flex items-center justify-between"><b>{SOURCE_LABEL[item.source_type] ?? item.source_type}</b><Badge variant={item.ready ? "default" : "destructive"}>{item.ready ? "已发布" : "未就绪"}</Badge></div><p className="mt-1 text-xs opacity-70">已发布 {item.published_count} 份</p></div>)}</CardContent></Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4" />授权问数</CardTitle></CardHeader><CardContent className="space-y-3"><Textarea aria-label="经营问题" value={question} onChange={(event) => setQuestion(event.target.value)} /><Button disabled={!ready} data-ai-command-ask onClick={() => void ask()}>生成有据回答</Button><div className="space-y-2">{workspace.queries.map((item) => <div key={item.id} className="rounded-lg border p-3" data-ai-query-status={item.status}><div className="flex items-center justify-between"><b>{item.query_number}</b><Badge>{STATUS[item.status] ?? item.status}</Badge></div><p className="mt-2 text-sm">{item.answer}</p><p className="mt-2 text-xs font-semibold text-emerald-700" data-ai-citation-count>{(citations.get(item.id) ?? []).length} 条发布事实引用 · 置信度 {item.confidence}</p>{(citations.get(item.id) ?? []).map((citation) => <p key={citation.id} className="mt-1 break-all text-[11px] opacity-60" data-ai-citation>{citation.source_number} · 修订 {citation.source_revision} · {citation.content_fingerprint}</p>)}</div>)}</div></CardContent></Card>

        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Calculator className="h-4 w-4" />情景模拟</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-2"><Input aria-label="需求变化百分比" value={demand} onChange={(e) => setDemand(e.target.value)} /><Input aria-label="产能变化百分比" value={capacity} onChange={(e) => setCapacity(e.target.value)} /><Input aria-label="现金流入变化百分比" value={cashIn} onChange={(e) => setCashIn(e.target.value)} /><Input aria-label="现金流出变化百分比" value={cashOut} onChange={(e) => setCashOut(e.target.value)} /></div><Button disabled={!workspace.readiness.find((item) => item.source_type === "forecast-run")?.ready} data-ai-command-simulate onClick={() => void simulate()}>计算压力情景</Button>{workspace.scenarios.map((item) => <div key={item.id} className="rounded-lg border p-3" data-ai-scenario-status={item.status}><div className="flex items-center justify-between"><b>{item.scenario_number}</b><Badge>{STATUS[item.status] ?? item.status}</Badge></div><div className="mt-2 grid grid-cols-2 gap-2 text-sm"><p>订单 <b>{item.simulated_order_value}</b></p><p>产能余量 <b data-ai-scenario-capacity>{item.simulated_capacity_gap}</b></p><p>现金流入 <b>{item.simulated_cash_in}</b></p><p>净现金 <b data-ai-scenario-cash>{item.simulated_net_cash}</b></p></div><p className="mt-2 text-xs opacity-70">固定 {item.base_forecast_run_number} 修订 {item.base_forecast_revision} · 不回写原预测</p></div>)}</CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle className="text-base">建议审批与业务系统交接</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid gap-2 md:grid-cols-3"><Input aria-label="建议标题" value={recommendationTitle} onChange={(e) => setRecommendationTitle(e.target.value)} /><Input aria-label="目标系统" value={targetSystem} onChange={(e) => setTargetSystem(e.target.value)} /><Input aria-label="责任人" value={owner} onChange={(e) => setOwner(e.target.value)} /></div><Button disabled={!workspace.queries.length && !workspace.scenarios.length} data-ai-recommendation-create onClick={() => void createRecommendation()}>建立责任建议</Button>{workspace.recommendations.map((item) => { const linked = workspace.handoffs.find((handoff) => handoff.recommendation_id === item.id); return <div key={item.id} className="rounded-lg border p-3" data-ai-recommendation-status={item.status}><div className="flex flex-wrap items-center justify-between gap-2"><b>{item.recommendation_number} · {item.title}</b><Badge>{STATUS[item.status] ?? item.status}</Badge></div><p className="mt-1 text-sm">{item.rationale}</p><p className="mt-1 text-xs">目标 {item.target_system} · 责任人 {item.owner} · 风险 {item.risk_level}</p><div className="mt-2 flex flex-wrap gap-2">{item.status === "pending-approval" ? <Button size="sm" data-ai-recommendation-approve onClick={() => void approve(item)}><ShieldCheck className="mr-1 h-4 w-4" />异人审批</Button> : null}{item.status === "approved" ? <Button size="sm" data-ai-recommendation-handoff onClick={() => void handoff(item)}><ExternalLink className="mr-1 h-4 w-4" />交接 {item.target_system}</Button> : null}{linked?.status === "handed-off" ? <Button size="sm" data-ai-handoff-close onClick={() => void execute(() => closeAiHandoff(projectId, linked.id, { expected_revision: linked.revision, evidence_reference: `${linked.target_system}-EXECUTED-${Date.now()}` }), "目标系统执行证据已闭环")}>记录执行证据</Button> : null}</div>{linked ? <p className="mt-2 text-xs font-semibold text-emerald-700" data-ai-handoff-status={linked.status}>{linked.handoff_number} · {linked.target_system} · {STATUS[linked.status]}</p> : null}</div>; })}</CardContent></Card>

      <Card><CardContent className="flex flex-wrap gap-2 py-4 text-xs"><Badge>{workspace.contract.engine}</Badge><Badge>外部大模型已调用：{workspace.contract.external_llm_called ? "是" : "否"}</Badge><Badge>回答引用：{workspace.contract.answers_require_citations ? "强制" : "可选"}</Badge><Badge>情景回写：{workspace.contract.scenario_writeback ? "允许" : "禁止"}</Badge><Badge>建议异人审批：{workspace.contract.recommendation_requires_independent_approval ? "强制" : "否"}</Badge><Badge>业务执行：目标系统负责</Badge></CardContent></Card>
    </div>
  </main></FactoryPage>;
}
