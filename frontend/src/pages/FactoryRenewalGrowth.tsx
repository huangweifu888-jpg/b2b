import { useState } from "react";
import { BadgeCheck, ClipboardCheck, FileSignature, Handshake, RefreshCw, Repeat2, Send, ShieldCheck, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { createFactoryCpqQuote, transitionFactoryCpqQuote, type FactoryCpqQuote } from "@/lib/factory-cpq-api";
import { decideFactoryFulfillmentOrder, registerFactoryOrderIntent, type FactoryFulfillmentOrder } from "@/lib/factory-fulfillment-api";
import {
  approveFactoryRenewalOpportunity, assessFactoryRenewalOpportunity,
  confirmFactoryRenewalWon, createFactoryRenewalOpportunity,
  handoffFactoryRenewalToCpq, linkFactoryRenewalQuote,
  listFactoryRenewalWorkspace, recommendFactoryRenewalOpportunity,
  type FactoryRenewalGrowthOpportunity, type FactoryRenewalMotion,
} from "@/lib/factory-renewal-growth-api";
import type { FactoryCustomerAsset } from "@/lib/factory-customer-asset-api";

const STATUS_LABEL: Record<string, string> = {
  draft: "机会草稿", assessed: "价值已评估", recommended: "方案已推荐",
  approved: "方案已批准", "cpq-requested": "等待CPQ", quoted: "报价已接受",
  won: "续约成交", lost: "机会流失",
};
const CPQ_ACTION: Partial<Record<FactoryCpqQuote["status"], "submit" | "approve" | "send" | "accept">> = {
  draft: "submit", "pending-approval": "approve", approved: "send", sent: "accept",
};
const CPQ_LABEL: Record<string, string> = { submit: "提交报价审批", approve: "批准报价", send: "发送客户", accept: "客户接受报价" };

const tomorrow = () => {
  const date = new Date(Date.now() + 2 * 86400000);
  return date.toISOString().slice(0, 10);
};
const validUntil = () => new Date(Date.now() + 30 * 86400000).toISOString();

export default function FactoryRenewalGrowth() {
  const [projectText, setProjectText] = useState("1");
  const [mode, setMode] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [assets, setAssets] = useState<FactoryCustomerAsset[]>([]);
  const [opportunities, setOpportunities] = useState<FactoryRenewalGrowthOpportunity[]>([]);
  const [quotes, setQuotes] = useState<FactoryCpqQuote[]>([]);
  const [orders, setOrders] = useState<FactoryFulfillmentOrder[]>([]);
  const [opportunityReference, setOpportunityReference] = useState(() => `RENEWAL-${Date.now().toString().slice(-10)}`);
  const [owner, setOwner] = useState("account-manager-001");
  const [nextActionAt, setNextActionAt] = useState(tomorrow);
  const [motion, setMotion] = useState<FactoryRenewalMotion>("upsell");
  const [evidencePrefix, setEvidencePrefix] = useState("RENEWAL-EVIDENCE-001");
  const [customerGoal, setCustomerGoal] = useState("扩大下一年度生产能力，同时续签年度维保服务并降低停机风险");
  const [recommendedProduct, setRecommendedProduct] = useState("PUMP-002");
  const [recommendedSku, setRecommendedSku] = useState("PUMP-002-380V");
  const [quantity, setQuantity] = useState("2");
  const [unitPrice, setUnitPrice] = useState("3200");
  const [unitCost, setUnitCost] = useState("2200");
  const projectId = Number(projectText);

  const load = async () => {
    setMode("loading");
    try {
      const workspace = await listFactoryRenewalWorkspace(projectId);
      setAssets(workspace.assets); setOpportunities(workspace.opportunities);
      setQuotes(workspace.quotes); setOrders(workspace.orders); setMode("live");
    } catch (error) {
      setMode("error"); toast.error(error instanceof Error ? error.message : "续约增长工作台加载失败");
    }
  };
  const replaceOpportunity = (item: FactoryRenewalGrowthOpportunity) => setOpportunities((rows) => rows.map((row) => row.id === item.id ? item : row));
  const execute = async (task: () => Promise<FactoryRenewalGrowthOpportunity>, success: string) => {
    try { const item = await task(); replaceOpportunity(item); toast.success(success); }
    catch (error) { toast.error(error instanceof Error ? error.message : "续约增长操作失败"); await load(); }
  };
  const openAssetIds = new Set(opportunities.filter((item) => !["won", "lost"].includes(item.lifecycle_status)).map((item) => item.asset_id));
  const selectedAsset = assets.find((asset) => asset.renewal_status === "action-required" && !openAssetIds.has(asset.id));
  const create = async () => {
    if (!selectedAsset) return toast.error("需要已进入到期行动的有效客户资产");
    try {
      const item = await createFactoryRenewalOpportunity(projectId, {
        asset_id: selectedAsset.id, opportunity_reference: opportunityReference,
        owner, next_action_at: new Date(`${nextActionAt}T09:00:00`).toISOString(),
      });
      setOpportunities((rows) => [item, ...rows]); toast.success("续约机会已建立并冻结资产健康快照");
    } catch (error) { toast.error(error instanceof Error ? error.message : "续约机会建立失败"); }
  };
  const advance = (item: FactoryRenewalGrowthOpportunity) => {
    if (item.lifecycle_status === "draft") return execute(() => assessFactoryRenewalOpportunity(projectId, item.id, {
      expected_revision: item.revision, value_evidence_reference: `${evidencePrefix}-VALUE`,
      value_summary: "客户确认设备运行稳定、服务问题已闭环，扩产需求和下一年度维保价值均可追溯",
    }), "客户价值、服务与质量风险已评估");
    if (item.lifecycle_status === "assessed") return execute(() => recommendFactoryRenewalOpportunity(projectId, item.id, {
      expected_revision: item.revision, motion, customer_goal: customerGoal,
      customer_confirmation_reference: `${evidencePrefix}-CUSTOMER-DEMAND`,
      recommendation_reference: `${evidencePrefix}-PLAN`,
      recommended_product_reference: recommendedProduct,
      recommended_sku_reference: recommendedSku, recommended_quantity: quantity,
      currency: "USD", estimated_unit_price: unitPrice, estimated_unit_cost: unitCost,
      recommendation_rationale: "基于装机周期、两次服务闭环、质保RMA责任和客户确认的扩产目标，建议升级两台设备并续签维保",
    }), "续约增购建议、客户确认和预计毛利已冻结");
    if (item.lifecycle_status === "recommended") return execute(() => approveFactoryRenewalOpportunity(projectId, item.id, {
      expected_revision: item.revision, approval_reference: `${evidencePrefix}-APPROVAL`,
      approval_note: "已复核客户价值证据、质量风险、价格底线、预计毛利与交付边界，同意进入CPQ",
    }), "续约增购方案已由独立权限批准");
    if (item.lifecycle_status === "approved") return execute(() => handoffFactoryRenewalToCpq(projectId, item.id, {
      expected_revision: item.revision, cpq_handoff_reference: `${evidencePrefix}-CPQ-HANDOFF`,
    }), "已移交CPQ，续约系统未直接生成订单");
  };
  const matchingQuote = (item: FactoryRenewalGrowthOpportunity) => quotes.find((quote) => quote.account_reference === item.account_reference && quote.lines.some((line) => line.product_reference === item.recommended_product_reference && line.sku_reference === item.recommended_sku_reference && Number(line.quantity) >= Number(item.recommended_quantity || 0)));
  const createQuote = async (item: FactoryRenewalGrowthOpportunity) => {
    try {
      const quote = await createFactoryCpqQuote(projectId, {
        account_reference: item.account_reference, currency: item.currency || "USD", exchange_rate: "1",
        valid_until: validUntil(), lines: [{ product_reference: item.recommended_product_reference || recommendedProduct,
          sku_reference: item.recommended_sku_reference || recommendedSku, quantity: item.recommended_quantity || quantity,
          moq: "1", unit_price: item.estimated_unit_price || unitPrice,
          unit_cost: item.estimated_unit_cost || unitCost, lead_time_days: 30 }],
      });
      setQuotes((rows) => [quote, ...rows]); toast.success("CPQ报价草稿已由报价系统建立");
    } catch (error) { toast.error(error instanceof Error ? error.message : "CPQ报价建立失败"); }
  };
  const transitionQuote = async (quote: FactoryCpqQuote) => {
    const action = CPQ_ACTION[quote.status];
    if (!action) return;
    try {
      const updated = await transitionFactoryCpqQuote(projectId, quote.id, { expected_revision: quote.revision, action, note: action === "approve" ? "续约价值、价格底线和毛利审核通过" : undefined });
      setQuotes((rows) => rows.map((row) => row.id === updated.id ? updated : row)); toast.success(CPQ_LABEL[action]);
    } catch (error) { toast.error(error instanceof Error ? error.message : "CPQ状态推进失败"); await load(); }
  };
  const linkQuote = (item: FactoryRenewalGrowthOpportunity, quote: FactoryCpqQuote) => execute(() => linkFactoryRenewalQuote(projectId, item.id, { expected_revision: item.revision, quote_id: quote.id }), "已接受CPQ报价已关联续约机会");
  const matchingOrder = (item: FactoryRenewalGrowthOpportunity) => orders.find((order) => order.quote_id === item.quote_id);
  const registerOrder = async (item: FactoryRenewalGrowthOpportunity, quote: FactoryCpqQuote) => {
    if (!quote.order_intent_id) return toast.error("CPQ报价尚未产生订单意向");
    try { const order = await registerFactoryOrderIntent(projectId, quote.order_intent_id); setOrders((rows) => [order, ...rows]); toast.success("订单意向已交由OMS登记"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "OMS订单登记失败"); await load(); }
  };
  const confirmOrder = async (order: FactoryFulfillmentOrder) => {
    try {
      const updated = await decideFactoryFulfillmentOrder(projectId, order.id, { expected_revision: order.revision, action: "confirm", product: true, payment: true, inventory: true, capacity: true, note: "续约订单产品、付款、库存和产能检查全部通过" });
      setOrders((rows) => rows.map((row) => row.id === updated.id ? updated : row)); toast.success("OMS已独立确认正式续约订单");
    } catch (error) { toast.error(error instanceof Error ? error.message : "OMS订单确认失败"); await load(); }
  };

  return <FactoryPage pageId="client-renewal-growth" template="dashboard" sourceScope="client_source" autoRegions><main className="p-4 md:p-6" data-factory-renewal-growth-page data-renewal-growth-mode={mode}>
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-xl font-bold"><TrendingUp className="h-5 w-5" />续约增长 · 复购增购</h1><p className="mt-1 text-sm opacity-70">资产健康与客户确认形成建议；CPQ负责报价审批，OMS负责订单确认，续约台只关联权威结果。</p></div><div className="flex gap-2"><Input aria-label="续约增长项目ID" className="w-24" value={projectText} onChange={(event) => setProjectText(event.target.value)} /><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />载入续约</Button></div></div>
      <Card><CardHeader><CardTitle className="text-base">建立续约机会</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <Input aria-label="续约机会外部编号" value={opportunityReference} onChange={(event) => setOpportunityReference(event.target.value)} />
        <Input aria-label="续约负责人" value={owner} onChange={(event) => setOwner(event.target.value)} />
        <Input aria-label="下一行动日期" type="date" value={nextActionAt} onChange={(event) => setNextActionAt(event.target.value)} />
        <select aria-label="续约动作" value={motion} onChange={(event) => setMotion(event.target.value as FactoryRenewalMotion)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="renewal">续约</option><option value="repurchase">复购</option><option value="upsell">增购</option></select>
        <Input aria-label="续约证据前缀" value={evidencePrefix} onChange={(event) => setEvidencePrefix(event.target.value)} />
        <Input aria-label="客户确认目标" className="xl:col-span-2" value={customerGoal} onChange={(event) => setCustomerGoal(event.target.value)} />
        <div className="rounded-md border p-2 text-xs"><b>{selectedAsset?.asset_number || "暂无可建机会资产"}</b><p>{selectedAsset ? `${selectedAsset.account_reference} · ${selectedAsset.product_reference}/${selectedAsset.sku_reference}` : "先在客户资产中心完成到期行动"}</p></div>
        <Input aria-label="推荐产品" value={recommendedProduct} onChange={(event) => setRecommendedProduct(event.target.value)} />
        <Input aria-label="推荐SKU" value={recommendedSku} onChange={(event) => setRecommendedSku(event.target.value)} />
        <Input aria-label="推荐数量" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        <div className="grid grid-cols-2 gap-2"><Input aria-label="预计单价" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} /><Input aria-label="预计单位成本" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} /></div>
        <Button data-renewal-create disabled={!selectedAsset} onClick={() => void create()}><Repeat2 className="mr-1 h-4 w-4" />建立续约机会</Button>
      </CardContent></Card>
      <div className="space-y-3">{opportunities.map((item) => {
        const quote = matchingQuote(item);
        const order = matchingOrder(item);
        const actionLabel: Record<string, string> = { draft: "完成价值评估", assessed: "生成续约建议", recommended: "批准增长方案", approved: "移交CPQ报价" };
        return <Card key={item.id} data-renewal-opportunity={item.id} data-renewal-status={item.lifecycle_status} data-renewal-health={item.health_score}><CardHeader className="pb-2"><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{item.opportunity_number} · {item.asset_number} · {item.account_reference}</span><span className="flex gap-2"><Badge>{STATUS_LABEL[item.lifecycle_status]}</Badge><Badge data-renewal-risk variant={item.risk_level === "high" ? "destructive" : "secondary"}>健康 {item.health_score} · {item.risk_level}</Badge></span></CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
          <p>原订单 {item.original_order_number} · {item.current_product_reference}/{item.current_sku_reference} · 序列号 {item.serial_number}</p>
          <div className="flex flex-wrap gap-2"><Badge variant="outline">服务 {item.resolved_service_count}</Badge><Badge variant="outline">RMA {item.closed_rma_count}</Badge><Badge variant="outline">制造责任 {item.manufacturer_fault_count}</Badge><Badge variant="outline">保修至 {new Date(item.warranty_until).toLocaleDateString()}</Badge><Badge data-renewal-estimated-value variant="outline">预计 {item.currency || "USD"} {item.estimated_value || "0.00"}</Badge></div>
          {actionLabel[item.lifecycle_status] ? <Button data-renewal-action={item.lifecycle_status} size="sm" onClick={() => void advance(item)}><ClipboardCheck className="mr-1 h-4 w-4" />{actionLabel[item.lifecycle_status]}</Button> : null}
          {item.lifecycle_status === "cpq-requested" && !quote ? <Button data-renewal-cpq-create size="sm" onClick={() => void createQuote(item)}><FileSignature className="mr-1 h-4 w-4" />由CPQ建立报价</Button> : null}
          {item.lifecycle_status === "cpq-requested" && quote && quote.status !== "accepted" ? <Button data-renewal-cpq-action={quote.status} size="sm" onClick={() => void transitionQuote(quote)}><Send className="mr-1 h-4 w-4" />{CPQ_LABEL[CPQ_ACTION[quote.status] || ""] || quote.status}</Button> : null}
          {item.lifecycle_status === "cpq-requested" && quote?.status === "accepted" ? <Button data-renewal-link-quote size="sm" onClick={() => void linkQuote(item, quote)}><Handshake className="mr-1 h-4 w-4" />关联已接受报价</Button> : null}
          {item.lifecycle_status === "quoted" && quote && !order ? <Button data-renewal-order-register size="sm" onClick={() => void registerOrder(item, quote)}><FileSignature className="mr-1 h-4 w-4" />OMS登记订单意向</Button> : null}
          {item.lifecycle_status === "quoted" && order?.status === "pending-validation" ? <Button data-renewal-order-confirm size="sm" onClick={() => void confirmOrder(order)}><ShieldCheck className="mr-1 h-4 w-4" />OMS确认正式订单</Button> : null}
          {item.lifecycle_status === "quoted" && order && !["pending-validation", "rejected"].includes(order.status) ? <Button data-renewal-confirm-won size="sm" onClick={() => void execute(() => confirmFactoryRenewalWon(projectId, item.id, { expected_revision: item.revision, order_id: order.id }), "续约成交已由权威订单证实") }><BadgeCheck className="mr-1 h-4 w-4" />确认续约成交</Button> : null}
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">{item.evidence.map((evidence) => <div key={evidence.id} className="rounded-md border p-2"><b>{evidence.evidence_type}</b><p>{evidence.evidence_reference}</p><small className="opacity-70">{evidence.note}</small></div>)}</div>
          {item.lifecycle_status === "won" ? <p data-renewal-won className="font-semibold text-emerald-600">续约增长已成交 · {item.order_number} · 实际 {item.currency} {item.actual_value} · 报价 {item.quote_number}</p> : null}
        </CardContent></Card>;
      })}</div>
    </div>
  </main></FactoryPage>;
}
