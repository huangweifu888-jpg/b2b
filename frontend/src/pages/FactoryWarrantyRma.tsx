import { useState } from "react";
import { BadgeCheck, CircleDollarSign, ClipboardCheck, PackageCheck, RefreshCw, RotateCcw, SearchCheck, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FactoryPage } from "@/page-factory/FactoryPage";
import {
  approveWarrantyRmaDisposition, authorizeWarrantyRmaCase, closeWarrantyRmaCase,
  createWarrantyRmaCase, inspectWarrantyRmaReturn, listWarrantyRmaWorkspace,
  receiveWarrantyRmaReturn, shipWarrantyRmaReturn, submitWarrantyRmaCase,
  type WarrantyRmaCase,
} from "@/lib/factory-warranty-rma-api";
import type { FactoryAssetServiceTicket, FactoryCustomerAsset } from "@/lib/factory-customer-asset-api";

const STATUS_LABEL: Record<string, string> = {
  draft: "草稿", "pending-review": "资格审核", authorized: "已授权",
  "return-in-transit": "退回运输", received: "已收货", inspected: "已检验",
  "disposition-approved": "处置批准", closed: "已闭环",
};

export default function FactoryWarrantyRma() {
  const [projectText, setProjectText] = useState("1");
  const [mode, setMode] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [assets, setAssets] = useState<FactoryCustomerAsset[]>([]);
  const [tickets, setTickets] = useState<FactoryAssetServiceTicket[]>([]);
  const [cases, setCases] = useState<WarrantyRmaCase[]>([]);
  const [claimReference, setClaimReference] = useState(() => `CLAIM-${Date.now().toString().slice(-10)}`);
  const [claimSummary, setClaimSummary] = useState("现场诊断确认轴承异常，需要授权退回工厂检验并完成质保维修");
  const [requestedRemedy, setRequestedRemedy] = useState<"repair" | "replace" | "refund">("repair");
  const [evidencePrefix, setEvidencePrefix] = useState("RMA-EVIDENCE-001");
  const [warehouseReceipt, setWarehouseReceipt] = useState("WH-RMA-RECEIPT-001");
  const [qmsEvidence, setQmsEvidence] = useState("QMS-NCR-RMA-001");
  const [customerAck, setCustomerAck] = useState("CUSTOMER-RMA-ACK-001");
  const projectId = Number(projectText);

  const replace = (item: WarrantyRmaCase) => setCases((rows) => rows.map((row) => row.id === item.id ? item : row));
  const load = async () => {
    setMode("loading");
    try {
      const workspace = await listWarrantyRmaWorkspace(projectId);
      setAssets(workspace.assets); setTickets(workspace.resolved_tickets); setCases(workspace.cases); setMode("live");
    } catch (error) { setMode("error"); toast.error(error instanceof Error ? error.message : "质保退货工作台加载失败"); }
  };
  const execute = async (task: () => Promise<WarrantyRmaCase>, success: string) => {
    try { const item = await task(); replace(item); toast.success(success); }
    catch (error) { toast.error(error instanceof Error ? error.message : "质保退货操作失败"); await load(); }
  };
  const existingTickets = new Set(cases.map((item) => item.service_ticket_id));
  const selectedTicket = tickets.find((ticket) => !existingTickets.has(ticket.id));
  const selectedAsset = assets.find((asset) => asset.id === selectedTicket?.asset_id);
  const create = async () => {
    if (!selectedTicket || !selectedAsset) return toast.error("需要同一客户资产的已解决服务工单");
    try {
      const item = await createWarrantyRmaCase(projectId, { asset_id: selectedAsset.id, service_ticket_id: selectedTicket.id, claim_reference: claimReference, claim_summary: claimSummary, requested_remedy: requestedRemedy });
      setCases((rows) => [item, ...rows]); toast.success("RMA主单已建立，等待质保资格审核");
    } catch (error) { toast.error(error instanceof Error ? error.message : "RMA建单失败"); }
  };
  const act = (item: WarrantyRmaCase) => {
    if (item.lifecycle_status === "draft") return execute(() => submitWarrantyRmaCase(projectId, item.id, { expected_revision: item.revision, submission_reference: `${evidencePrefix}-CLAIM` }), "质保资格已按资产快照判定");
    if (item.lifecycle_status === "pending-review") return execute(() => authorizeWarrantyRmaCase(projectId, item.id, { expected_revision: item.revision, authorization_reference: `${evidencePrefix}-AUTH`, return_instructions: "排空设备、固定轴系、粘贴RMA标签并退回指定服务仓" }), "退回授权和操作说明已冻结");
    if (item.lifecycle_status === "authorized") return execute(() => shipWarrantyRmaReturn(projectId, item.id, { expected_revision: item.revision, return_shipment_reference: `${evidencePrefix}-CARRIER` }), "客户退回运输凭证已登记");
    if (item.lifecycle_status === "return-in-transit") return execute(() => receiveWarrantyRmaReturn(projectId, item.id, { expected_revision: item.revision, warehouse_receipt_reference: warehouseReceipt, received_condition: "包装完好、序列号一致，退回设备已进入隔离区等待检验" }), "仓库已独立收货并记录设备状态");
    if (item.lifecycle_status === "received") return execute(() => inspectWarrantyRmaReturn(projectId, item.id, { expected_revision: item.revision, inspection_reference: `${evidencePrefix}-INSPECTION`, inspection_result: "manufacturing-defect", inspection_note: "拆检确认轴承滚道材料缺陷，与现场振动和温升异常一致", quality_evidence_reference: qmsEvidence }), "RMA检验与QMS证据已关联");
    if (item.lifecycle_status === "inspected") return execute(() => approveWarrantyRmaDisposition(projectId, item.id, { expected_revision: item.revision, disposition: "repair", responsibility: "manufacturer", disposition_approval_reference: `${evidencePrefix}-DISPOSITION`, currency: "USD", estimated_parts_cost: "400", estimated_labor_cost: "100", estimated_logistics_cost: "25" }), "维修处置与预计质量成本已批准");
    if (item.lifecycle_status === "disposition-approved") return execute(() => closeWarrantyRmaCase(projectId, item.id, { expected_revision: item.revision, remedy_evidence_reference: `${evidencePrefix}-REPAIR-TEST`, customer_acknowledgement_reference: customerAck }), "维修结果和客户确认已完成闭环");
  };

  return <FactoryPage pageId="client-warranty-rma" template="dashboard" sourceScope="client_source" autoRegions><main className="p-4 md:p-6" data-factory-warranty-rma-page data-warranty-rma-mode={mode}>
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-xl font-bold"><RotateCcw className="h-5 w-5" />质保退货 · RMA</h1><p className="mt-1 text-sm opacity-70">以已解决服务工单为入口，分离质保资格、退回授权、运输、仓库收货、QMS检验、处置成本和客户确认。</p></div><div className="flex gap-2"><Input aria-label="质保退货项目ID" className="w-24" value={projectText} onChange={(event) => setProjectText(event.target.value)} /><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />载入RMA</Button></div></div>
      <Card><CardHeader><CardTitle className="text-base">建立质保申请</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <Input aria-label="客户索赔编号" value={claimReference} onChange={(event) => setClaimReference(event.target.value)} />
        <Input aria-label="质保问题说明" className="xl:col-span-2" value={claimSummary} onChange={(event) => setClaimSummary(event.target.value)} />
        <select aria-label="客户期望处理" className="h-10 rounded-md border bg-background px-3 text-sm" value={requestedRemedy} onChange={(event) => setRequestedRemedy(event.target.value as typeof requestedRemedy)}><option value="repair">维修</option><option value="replace">换货</option><option value="refund">退款</option></select>
        <div className="rounded-md border p-2 text-xs"><b>{selectedAsset?.asset_number || "暂无可申请资产"}</b><p>{selectedTicket ? `${selectedTicket.ticket_number} · ${selectedTicket.resolution_reference}` : "需要未关联RMA的已解决服务工单"}</p></div>
        <Input aria-label="RMA证据前缀" value={evidencePrefix} onChange={(event) => setEvidencePrefix(event.target.value)} />
        <Input data-rma-warehouse-evidence aria-label="仓库收货凭证" value={warehouseReceipt} onChange={(event) => setWarehouseReceipt(event.target.value)} />
        <Input data-rma-qms-evidence aria-label="QMS质量凭证" value={qmsEvidence} onChange={(event) => setQmsEvidence(event.target.value)} />
        <Input data-rma-customer-ack aria-label="客户确认凭证" value={customerAck} onChange={(event) => setCustomerAck(event.target.value)} />
        <Button data-rma-create disabled={!selectedAsset || !selectedTicket} onClick={() => void create()}><ShieldCheck className="mr-1 h-4 w-4" />建立RMA</Button>
      </CardContent></Card>
      <div className="space-y-3">{cases.map((item) => {
        const action = ({ draft: "submit", "pending-review": "authorize", authorized: "ship", "return-in-transit": "receive", received: "inspect", inspected: "disposition", "disposition-approved": "close" } as const)[item.lifecycle_status as Exclude<WarrantyRmaCase["lifecycle_status"], "closed">];
        const buttonLabel: Record<string, string> = { submit: "提交资格审核", authorize: "授权退回", ship: "登记退回运输", receive: "仓库独立收货", inspect: "完成RMA检验", disposition: "批准维修处置", close: "客户确认闭环" };
        const Icon = action === "ship" ? Send : action === "receive" ? PackageCheck : action === "inspect" ? SearchCheck : action === "disposition" ? CircleDollarSign : action === "close" ? BadgeCheck : ClipboardCheck;
        return <Card key={item.id} data-rma-case={item.id} data-rma-status={item.lifecycle_status} data-rma-eligibility={item.eligibility_status}><CardHeader className="pb-2"><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{item.rma_number} · {item.claim_reference} · {item.asset_number}</span><span className="flex gap-2"><Badge>{STATUS_LABEL[item.lifecycle_status]}</Badge><Badge variant={item.eligibility_status === "expired" ? "destructive" : "secondary"}>{item.eligibility_status}</Badge></span></CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
          <p>{item.claim_summary}</p><p>服务工单 {item.service_ticket_number} · 订单 {item.order_number} · {item.product_reference}/{item.sku_reference} · 序列号 {item.serial_number}</p>
          <div className="flex flex-wrap gap-2"><Badge variant="outline">期望 {item.requested_remedy}</Badge><Badge variant="outline">检验 {item.inspection_result || "未检"}</Badge><Badge variant="outline">处置 {item.disposition || "未定"}</Badge><Badge data-rma-cost-total variant="outline">预计成本 {item.currency} {item.estimated_total_cost}</Badge></div>
          {action ? <Button data-rma-action={action} size="sm" onClick={() => void act(item)}><Icon className="mr-1 h-4 w-4" />{buttonLabel[action]}</Button> : null}
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">{item.evidence.map((evidence) => <div key={evidence.id} className="rounded-md border p-2"><b>{evidence.evidence_type}</b><p>{evidence.evidence_reference}</p><small className="opacity-70">{evidence.note}</small></div>)}</div>
          {item.lifecycle_status === "closed" ? <p data-rma-closed className="font-semibold text-emerald-600">RMA已闭环 · {item.disposition} · 客户确认 {item.customer_acknowledgement_reference} · 预计质量成本 {item.currency} {item.estimated_total_cost}</p> : null}
        </CardContent></Card>;
      })}</div>
    </div>
  </main></FactoryPage>;
}
