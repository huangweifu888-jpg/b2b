import { useState } from "react";
import { ArrowRight, Calculator, CheckCircle2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { createFactoryCpqQuote, listFactoryCpqQuotes, transitionFactoryCpqQuote, type FactoryCpqQuote } from "@/lib/factory-cpq-api";

const STATUS: Record<string, string> = { draft: "草稿", "pending-approval": "待审批", approved: "已审批", rejected: "已拒绝", sent: "已发送", accepted: "买家接受" };
const nextAction = (status: string) => status === "draft" ? "submit" : status === "pending-approval" ? "approve" : status === "approved" ? "send" : status === "sent" ? "accept" : null;
const ACTION_LABEL: Record<string, string> = { submit: "提交审批", approve: "审批通过", send: "发送报价", accept: "买家接受" };

export default function FactoryCpqQuotes() {
  const [projectIdText, setProjectIdText] = useState("1");
  const [quotes, setQuotes] = useState<FactoryCpqQuote[]>([]);
  const [mode, setMode] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [account, setAccount] = useState("BUYER-001");
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [validUntil, setValidUntil] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [product, setProduct] = useState("PUMP-001");
  const [sku, setSku] = useState("PUMP-001-380V");
  const [quantity, setQuantity] = useState("10");
  const [moq, setMoq] = useState("5");
  const [unitPrice, setUnitPrice] = useState("100");
  const [unitCost, setUnitCost] = useState("70");
  const [leadTime, setLeadTime] = useState("30");
  const [reviewNote, setReviewNote] = useState("毛利、MOQ、币种和交期已由销售经理审核");
  const projectId = Number(projectIdText);

  const load = async () => { setMode("loading"); try { setQuotes((await listFactoryCpqQuotes(projectId)).items); setMode("live"); } catch (error) { setMode("error"); toast.error(error instanceof Error ? error.message : "CPQ连接失败"); } };
  const create = async () => { try { const item = await createFactoryCpqQuote(projectId, { account_reference: account, currency: currency.toUpperCase(), exchange_rate: exchangeRate, valid_until: `${validUntil}T23:59:59Z`, lines: [{ product_reference: product, sku_reference: sku, quantity, moq, unit_price: unitPrice, unit_cost: unitCost, lead_time_days: Number(leadTime) }] }); setQuotes((current) => [item, ...current]); setMode("live"); toast.success("CPQ报价草稿已创建"); } catch (error) { toast.error(error instanceof Error ? error.message : "创建失败"); } };
  const transition = async (quote: FactoryCpqQuote, action: "submit" | "approve" | "send" | "accept") => { try { const item = await transitionFactoryCpqQuote(projectId, quote.id, { expected_revision: quote.revision, action, ...(action === "approve" ? { note: reviewNote } : {}) }); setQuotes((current) => current.map((candidate) => candidate.id === item.id ? item : candidate)); toast.success(`${ACTION_LABEL[action]}完成`); } catch (error) { toast.error(error instanceof Error ? error.message : "状态推进失败"); await load(); } };

  return <FactoryPage pageId="client-cpq-quotes" template="dashboard" sourceScope="client_source"><main data-page-factory-region="content" className="p-4 md:p-6" data-factory-cpq-page data-cpq-mode={mode}>
    <div className="mx-auto max-w-7xl space-y-4">
      <div data-page-factory-region="title-2" className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-xl font-bold"><Calculator className="h-5 w-5" />智能报价 · CPQ</h1><p className="mt-1 text-sm opacity-70">统一产品版本、MOQ、成本、毛利、汇率、交期和审批；买家接受后只产生待确认订单意向。</p></div><div className="flex items-center gap-2"><Input aria-label="CPQ计划ID" value={projectIdText} onChange={(event) => setProjectIdText(event.target.value)} className="w-24" /><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />载入计划</Button></div></div>
      <Card data-page-factory-region="large-card"><CardHeader><CardTitle className="text-base">新建单产品报价</CardTitle></CardHeader><CardContent data-page-factory-region="small-card" className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Input aria-label="客户编号" value={account} onChange={(e) => setAccount(e.target.value)} /><Input aria-label="币种" value={currency} onChange={(e) => setCurrency(e.target.value)} /><Input aria-label="汇率" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} /><Input aria-label="有效期" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /><Input aria-label="产品编号" value={product} onChange={(e) => setProduct(e.target.value)} /><Input aria-label="SKU编号" value={sku} onChange={(e) => setSku(e.target.value)} /><Input aria-label="数量" value={quantity} onChange={(e) => setQuantity(e.target.value)} /><Input aria-label="MOQ" value={moq} onChange={(e) => setMoq(e.target.value)} /><Input aria-label="销售单价" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} /><Input aria-label="单位成本" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} /><Input aria-label="交期天数" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} /><Button data-cpq-create onClick={() => void create()}><Calculator className="mr-1 h-4 w-4" />计算并建报价</Button>
      </CardContent></Card>
      <label className="block text-sm"><span className="font-semibold">审批意见</span><Input aria-label="审批意见" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} className="mt-1" /></label>
      <div className="grid gap-3 xl:grid-cols-2">{quotes.map((quote) => { const action = nextAction(quote.status) as "submit" | "approve" | "send" | "accept" | null; return <Card key={quote.id} data-cpq-quote={quote.id} data-cpq-status={quote.status}><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between gap-2 text-sm"><span>{quote.quote_number} · {quote.account_reference}</span><Badge>{STATUS[quote.status] || quote.status}</Badge></CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>{quote.lines.map((line) => `${line.product_reference}/${line.sku_reference} × ${line.quantity}`).join("；")}</p><p>报价 <b>{quote.subtotal} {quote.currency}</b> · 成本 {quote.cost_total} · 毛利 {quote.gross_margin_percent}% · 汇率 {quote.exchange_rate}</p><p>有效期 {new Date(quote.valid_until).toLocaleDateString()} · 修订 {quote.revision} · 事件 {quote.emitted_events.length}</p>{quote.approval_note ? <p>审批：{quote.approval_note}</p> : null}{quote.order_intent_id ? <p data-cpq-order-intent className="font-semibold text-emerald-600">待确认订单意向：{quote.order_intent_id}（非确认订单）</p> : null}{action ? <Button data-cpq-transition={action} size="sm" onClick={() => void transition(quote, action)}>{action === "send" ? <Send className="mr-1 h-4 w-4" /> : action === "accept" ? <CheckCircle2 className="mr-1 h-4 w-4" /> : <ArrowRight className="mr-1 h-4 w-4" />}{ACTION_LABEL[action]}</Button> : null}</CardContent></Card>; })}</div>
    </div>
  </main></FactoryPage>;
}
