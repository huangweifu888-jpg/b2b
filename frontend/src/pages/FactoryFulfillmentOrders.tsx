import { useState } from "react";
import { CheckCircle2, ClipboardCheck, Factory, PackageCheck, RefreshCw, Send, Truck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { advanceFactoryFulfillmentOrder, decideFactoryFulfillmentOrder, listFactoryFulfillmentOrders, registerFactoryOrderIntent, type FactoryFulfillmentOrder } from "@/lib/factory-fulfillment-api";

const STATUS_LABEL: Record<string, string> = {
  "pending-validation": "待权威确认", rejected: "已拒绝", confirmed: "已确认订单", allocated: "已锁定库存",
  "in-production": "生产中", "production-completed": "生产完成", "quality-released": "质量放行", shipped: "已发运", delivered: "已签收",
};
const NEXT_ACTION: Partial<Record<FactoryFulfillmentOrder["status"], "allocate" | "start-production" | "complete-production" | "release-quality" | "ship" | "deliver">> = {
  confirmed: "allocate", allocated: "start-production", "in-production": "complete-production", "production-completed": "release-quality", "quality-released": "ship", shipped: "deliver",
};
const ACTION_LABEL = { allocate: "锁定库存", "start-production": "开始生产", "complete-production": "完成生产", "release-quality": "质量放行", ship: "确认发运", deliver: "确认签收" } as const;
const DEFAULT_REFERENCE = { allocate: "INV-LOCK-001", "start-production": "WO-001", "complete-production": "BATCH-001", "release-quality": "QMS-001", ship: "SHIP-001", deliver: "POD-001" } as const;

export default function FactoryFulfillmentOrders() {
  const [projectIdText, setProjectIdText] = useState("1");
  const [orders, setOrders] = useState<FactoryFulfillmentOrder[]>([]);
  const [mode, setMode] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [intentId, setIntentId] = useState("");
  const [checks, setChecks] = useState({ product: true, payment: true, inventory: true, capacity: true });
  const [decisionNote, setDecisionNote] = useState("产品、付款条件、库存和产能均已由履约负责人核验");
  const [evidenceReference, setEvidenceReference] = useState("INV-LOCK-001");
  const [milestoneNote, setMilestoneNote] = useState("权威业务回执已核验并归档");
  const projectId = Number(projectIdText);

  const replace = (item: FactoryFulfillmentOrder) => setOrders((current) => current.map((order) => order.id === item.id ? item : order));
  const load = async () => {
    setMode("loading");
    try { setOrders((await listFactoryFulfillmentOrders(projectId)).items); setMode("live"); }
    catch (error) { setMode("error"); toast.error(error instanceof Error ? error.message : "订单履约连接失败"); }
  };
  const register = async () => {
    try { const item = await registerFactoryOrderIntent(projectId, intentId); setOrders((current) => [item, ...current]); setMode("live"); toast.success("订单意向已登记，尚未成为确认订单"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "订单意向登记失败"); }
  };
  const decide = async (order: FactoryFulfillmentOrder, action: "confirm" | "reject") => {
    try { replace(await decideFactoryFulfillmentOrder(projectId, order.id, { expected_revision: order.revision, action, ...checks, note: decisionNote })); toast.success(action === "confirm" ? "权威确认订单已生成" : "订单意向已拒绝"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "订单决策失败"); await load(); }
  };
  const advance = async (order: FactoryFulfillmentOrder, action: NonNullable<(typeof NEXT_ACTION)[FactoryFulfillmentOrder["status"]]>) => {
    try { const item = await advanceFactoryFulfillmentOrder(projectId, order.id, { expected_revision: order.revision, action, evidence_reference: evidenceReference || DEFAULT_REFERENCE[action], note: milestoneNote }); replace(item); const upcoming = NEXT_ACTION[item.status]; if (upcoming) setEvidenceReference(DEFAULT_REFERENCE[upcoming]); toast.success(`${ACTION_LABEL[action]}完成`); }
    catch (error) { toast.error(error instanceof Error ? error.message : "履约推进失败"); await load(); }
  };

  return <FactoryPage pageId="client-fulfillment-orders" template="dashboard" sourceScope="client_source" autoRegions><main className="p-4 md:p-6" data-factory-fulfillment-page data-fulfillment-mode={mode}>
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-xl font-bold"><Truck className="h-5 w-5" />全球交付 · OMS履约</h1><p className="mt-1 text-sm opacity-70">报价接受只产生订单意向；履约域完成产品、付款、库存、产能校验后，才生成权威确认订单。</p></div>
        <div className="flex items-center gap-2"><Input aria-label="履约计划ID" value={projectIdText} onChange={(event) => setProjectIdText(event.target.value)} className="w-24" /><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />载入计划</Button></div>
      </div>
      <Card><CardHeader><CardTitle className="text-base">登记待确认订单意向</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2"><Input aria-label="订单意向ID" placeholder="order-intent-..." value={intentId} onChange={(event) => setIntentId(event.target.value)} className="min-w-72 flex-1" /><Button data-fulfillment-register onClick={() => void register()}><ClipboardCheck className="mr-1 h-4 w-4" />登记意向</Button></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">订单权威检查与履约证据</CardTitle></CardHeader><CardContent className="space-y-3">
        <div className="flex flex-wrap gap-4">{(["product", "payment", "inventory", "capacity"] as const).map((key) => <label key={key} className="flex items-center gap-2 text-sm"><Checkbox checked={checks[key]} onCheckedChange={(value) => setChecks((current) => ({ ...current, [key]: value === true }))} />{{ product: "产品有效", payment: "付款条件", inventory: "库存可用", capacity: "产能可交" }[key]}</label>)}</div>
        <div className="grid gap-2 md:grid-cols-3"><Input aria-label="订单决策意见" value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} /><Input aria-label="履约证据编号" value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} /><Input aria-label="履约证据说明" value={milestoneNote} onChange={(event) => setMilestoneNote(event.target.value)} /></div>
      </CardContent></Card>
      <div className="grid gap-3 xl:grid-cols-2">{orders.map((order) => {
        const next = NEXT_ACTION[order.status];
        return <Card key={order.id} data-fulfillment-order={order.id} data-fulfillment-status={order.status}>
          <CardHeader className="pb-2"><CardTitle className="flex items-center justify-between gap-2 text-sm"><span>{order.order_number} · {order.account_reference}</span><Badge>{STATUS_LABEL[order.status] || order.status}</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>来源报价 <b>{order.quote_number}</b> · 金额 <b>{order.order_total} {order.currency}</b> · 权威源 {order.authority_source}</p>
            <p>订单意向 {order.order_intent_id} · 修订 {order.revision} · 事件 {order.emitted_events.length} · 证据 {order.fulfillment_evidence.length}</p>
            {order.status === "pending-validation" ? <div className="flex gap-2"><Button data-fulfillment-confirm size="sm" onClick={() => void decide(order, "confirm")}><CheckCircle2 className="mr-1 h-4 w-4" />确认订单</Button><Button variant="outline" size="sm" onClick={() => void decide(order, "reject")}>拒绝意向</Button></div> : null}
            {next ? <Button data-fulfillment-advance={next} size="sm" onClick={() => void advance(order, next)}>{next === "start-production" || next === "complete-production" ? <Factory className="mr-1 h-4 w-4" /> : next === "release-quality" ? <PackageCheck className="mr-1 h-4 w-4" /> : next === "ship" || next === "deliver" ? <Send className="mr-1 h-4 w-4" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}{ACTION_LABEL[next]}</Button> : null}
            {order.status === "delivered" ? <p data-fulfillment-delivered className="font-semibold text-emerald-600">签收闭环完成：确认订单、生产、质量、发运与签收证据均可追溯。</p> : null}
          </CardContent>
        </Card>;
      })}</div>
    </div>
  </main></FactoryPage>;
}
