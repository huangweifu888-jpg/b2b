import { useState } from "react";
import { ArrowRight, CircleDollarSign, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { advanceFactoryRevenueRun, createFactoryRevenueRun, listFactoryRevenueRuns, type FactoryRevenueRun, type RevenueEventType, type RevenueStage } from "@/lib/factory-revenue-api";

const STAGES: RevenueStage[] = ["product-selected", "inquiry-created", "quote-submitted", "quote-accepted", "order-confirmed", "invoice-issued", "payment-received"];
const LABELS: Record<RevenueStage, string> = { "product-selected": "产品确认", "inquiry-created": "询盘创建", "quote-submitted": "报价提交", "quote-accepted": "报价接受", "order-confirmed": "订单确认", "invoice-issued": "发票开具", "payment-received": "回款完成" };
const NEEDS_AMOUNT = new Set<RevenueEventType>(["quote-submitted", "order-confirmed", "invoice-issued", "payment-received"]);

export function FactoryRevenueGoldenFlowDesk() {
  const [projectIdText, setProjectIdText] = useState("1");
  const [runs, setRuns] = useState<FactoryRevenueRun[]>([]);
  const [product, setProduct] = useState("MACHINE-001");
  const [account, setAccount] = useState("BUYER-001");
  const [currency, setCurrency] = useState("USD");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const projectId = Number(projectIdText);

  const load = async () => {
    if (!Number.isInteger(projectId) || projectId <= 0) return toast.error("请输入有效计划ID");
    setMode("loading"); setError(null);
    try { setRuns((await listFactoryRevenueRuns(projectId)).items); setMode("live"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "成交金链连接失败"); setMode("error"); }
  };
  const create = async () => {
    if (!Number.isInteger(projectId) || projectId <= 0) return toast.error("请输入有效计划ID");
    try { const item = await createFactoryRevenueRun(projectId, { product_reference: product, account_reference: account, currency }); setRuns((current) => [item, ...current]); setMode("live"); toast.success("成交金链样本已创建"); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "创建失败"); }
  };
  const advance = async (run: FactoryRevenueRun) => {
    const index = STAGES.indexOf(run.current_stage);
    const eventType = STAGES[index + 1] as RevenueEventType | undefined;
    if (!eventType) return;
    const amount = amounts[run.id];
    if (NEEDS_AMOUNT.has(eventType) && !amount) return toast.error(`${LABELS[eventType]}需要金额`);
    try { const item = await advanceFactoryRevenueRun(projectId, run.id, { expected_revision: run.revision, event_type: eventType, ...(amount ? { amount } : {}) }); setRuns((current) => current.map((candidate) => candidate.id === run.id ? item : candidate)); toast.success(`已推进：${LABELS[eventType]}`); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "推进失败"); await load(); }
  };

  return <section className="mt-5" data-factory-platform-revenue-flow data-revenue-flow-mode={mode}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-semibold"><CircleDollarSign className="h-4 w-4" />成交金链 · 租户试点<Badge variant={mode === "live" ? "default" : "outline"}>{mode === "live" ? "实时" : "待连接"}</Badge></div><div className="flex gap-2"><Input aria-label="成交金链计划ID" value={projectIdText} onChange={(event) => setProjectIdText(event.target.value)} className="h-8 w-24" /><Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-3.5 w-3.5" />载入计划</Button></div></div>
    <p className="mb-3 text-xs opacity-75">每条链路绑定一个客户计划和 correlationId；只能按产品→询盘→报价→订单→发票→回款顺序推进，金额必须逐层对账，所有事件携带冻结的 V1 信封。</p>
    {error ? <p data-revenue-flow-error className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">{error}</p> : null}
    <Card className="mb-3 border-current/20 bg-transparent shadow-none"><CardContent className="grid gap-2 p-3 md:grid-cols-4"><Input aria-label="试点产品" value={product} onChange={(event) => setProduct(event.target.value)} placeholder="产品编号" /><Input aria-label="试点客户" value={account} onChange={(event) => setAccount(event.target.value)} placeholder="客户编号" /><Input aria-label="交易币种" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} maxLength={3} /><Button data-revenue-flow-create onClick={() => void create()}><Plus className="mr-1 h-4 w-4" />新建试点链路</Button></CardContent></Card>
    <div className="grid gap-3 xl:grid-cols-2">{runs.map((run) => { const next = STAGES[STAGES.indexOf(run.current_stage) + 1] as RevenueEventType | undefined; return <Card key={run.id} data-revenue-flow-run={run.id} data-revenue-stage={run.current_stage} className="border-current/20 bg-transparent shadow-none"><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between gap-2 text-sm"><span>{run.product_reference} → {run.account_reference}</span><Badge variant={run.current_stage === "payment-received" ? "default" : "outline"}>{LABELS[run.current_stage]}</Badge></CardTitle></CardHeader><CardContent className="space-y-2 text-xs"><p className="break-all opacity-70">{run.correlation_id} · {run.plan_id} · 修订 {run.revision}</p><div className="flex flex-wrap gap-1">{STAGES.map((stage, index) => <Badge key={stage} variant={index <= STAGES.indexOf(run.current_stage) ? "default" : "outline"}>{LABELS[stage]}</Badge>)}</div><p>报价 {run.quoted_amount} · 订单 {run.ordered_amount} · 发票 {run.invoiced_amount} · 回款 {run.paid_amount} {run.currency}</p><p>已产生 {run.emitted_events.length} 个可追踪事件</p>{next ? <div className="flex gap-2">{NEEDS_AMOUNT.has(next) ? <Input aria-label={`${run.id} 推进金额`} value={amounts[run.id] || ""} onChange={(event) => setAmounts((current) => ({ ...current, [run.id]: event.target.value }))} placeholder={`${LABELS[next]}金额`} /> : null}<Button data-revenue-flow-advance size="sm" onClick={() => void advance(run)}>推进到 {LABELS[next]}<ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></div> : <p className="font-semibold text-emerald-600">链路已完成并完成回款对账</p>}</CardContent></Card>; })}</div>
  </section>;
}
