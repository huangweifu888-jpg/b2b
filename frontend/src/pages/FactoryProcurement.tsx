import { useState } from "react";
import { BadgeCheck, ClipboardList, PackageCheck, RefreshCw, Send, ShieldCheck, Truck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FactoryPage } from "@/page-factory/FactoryPage";
import {
  approveFactorySupplier, createFactoryPurchaseOrder, createFactorySupplier, listFactoryProcurement,
  transitionFactoryPurchaseOrder, type FactoryProcurementDemandOrder, type FactoryProcurementEngineering,
  type FactoryPurchaseOrder, type FactorySupplier,
} from "@/lib/factory-procurement-api";

const dateAfter = (days: number) => new Date(Date.now() + days * 86400000).toISOString();

export default function FactoryProcurement() {
  const [projectIdText, setProjectIdText] = useState("1");
  const [mode, setMode] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [suppliers, setSuppliers] = useState<FactorySupplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<FactoryPurchaseOrder[]>([]);
  const [engineering, setEngineering] = useState<FactoryProcurementEngineering[]>([]);
  const [orders, setOrders] = useState<FactoryProcurementDemandOrder[]>([]);
  const [engineeringId, setEngineeringId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [supplierReference, setSupplierReference] = useState(() => `VENDOR-${Date.now().toString().slice(-8)}`);
  const [legalName, setLegalName] = useState("精密机电组件有限公司");
  const [qualificationEvidence, setQualificationEvidence] = useState("SUPPLIER-AUDIT-2026-001");
  const [approvalReference, setApprovalReference] = useState("SUPPLIER-APPROVAL-001");
  const [poApprovalReference, setPoApprovalReference] = useState("PO-APPROVAL-001");
  const projectId = Number(projectIdText);

  const replaceSupplier = (item: FactorySupplier) => setSuppliers((current) => current.map((candidate) => candidate.id === item.id ? item : candidate));
  const replacePurchaseOrder = (item: FactoryPurchaseOrder) => setPurchaseOrders((current) => current.map((candidate) => candidate.id === item.id ? item : candidate));
  const selectedEngineering = engineering.find((item) => item.id === engineeringId) ?? engineering[0];
  const materials = (selectedEngineering?.bom_components ?? []).map((item) => String(item.material_reference ?? "")).filter(Boolean);

  const load = async () => {
    setMode("loading");
    try {
      const workspace = await listFactoryProcurement(projectId);
      setSuppliers(workspace.suppliers); setPurchaseOrders(workspace.purchase_orders);
      setEngineering(workspace.released_engineering_versions); setOrders(workspace.eligible_demand_orders);
      setEngineeringId((current) => current || workspace.released_engineering_versions[0]?.id || "");
      setOrderId((current) => current || workspace.eligible_demand_orders[0]?.id || "");
      setMode("live");
    } catch (error) { setMode("error"); toast.error(error instanceof Error ? error.message : "供应采购工作台加载失败"); }
  };
  const createSupplier = async () => {
    try {
      const item = await createFactorySupplier(projectId, { supplier_reference: supplierReference, legal_name: legalName, country_code: "CN", currency: "USD", standard_lead_time_days: 30, qualified_materials: materials, qualification_evidence_reference: qualificationEvidence, risk_level: "low" });
      setSuppliers((current) => [item, ...current]); setMode("live"); toast.success("供应商资格档案已建立");
    } catch (error) { toast.error(error instanceof Error ? error.message : "供应商创建失败"); }
  };
  const approveSupplier = async (item: FactorySupplier) => {
    try { replaceSupplier(await approveFactorySupplier(projectId, item.id, { expected_revision: item.revision, approval_reference: approvalReference, approval_note: "现场审核、质量体系、产能与材料范围均已复核通过" })); toast.success("供应商准入已批准"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "供应商审批失败"); await load(); }
  };
  const createPurchaseOrder = async (supplier: FactorySupplier) => {
    if (!selectedEngineering) return;
    try {
      const item = await createFactoryPurchaseOrder(projectId, { supplier_id: supplier.id, demand_order_id: orderId, engineering_version_id: selectedEngineering.id, needed_by: dateAfter(60), unit_prices: selectedEngineering.bom_components.map((component, index) => ({ material_reference: String(component.material_reference), unit_price: index === 0 ? "55.00" : "8.00" })) });
      setPurchaseOrders((current) => [item, ...current]); toast.success("BOM采购需求已生成采购单");
    } catch (error) { toast.error(error instanceof Error ? error.message : "采购单创建失败"); }
  };
  const advance = async (item: FactoryPurchaseOrder, action: "submit" | "approve" | "issue" | "acknowledge" | "receive") => {
    const payload: Parameters<typeof transitionFactoryPurchaseOrder>[2] = { expected_revision: item.revision, action };
    if (action === "submit") payload.note = "已确认客户订单需求、工程BOM数量与预算用途";
    if (action === "approve") { payload.note = "采购预算、供应商准入与交期风险已经审批"; payload.approval_reference = poApprovalReference; }
    if (action === "issue") payload.issue_document_reference = `SIGNED-${item.purchase_order_number}`;
    if (action === "acknowledge") { payload.acknowledgement_reference = `ACK-${item.purchase_order_number}`; payload.promised_delivery_at = dateAfter(30); }
    if (action === "receive") { payload.receiving_reference = `GRN-${item.purchase_order_number}`; payload.received_quantities = item.lines.map((line) => ({ material_reference: line.material_reference, received_quantity: line.required_quantity })); }
    try { replacePurchaseOrder(await transitionFactoryPurchaseOrder(projectId, item.id, payload)); toast.success(action === "receive" ? "独立收货凭证与数量已核对" : "采购里程碑已推进"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "采购状态推进失败"); await load(); }
  };

  return <FactoryPage pageId="client-procurement" template="dashboard" sourceScope="client_source" autoRegions><main className="p-4 md:p-6" data-factory-procurement-page data-procurement-mode={mode}>
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-xl font-bold"><ClipboardList className="h-5 w-5" />供应采购 · SRM</h1><p className="mt-1 text-sm opacity-70">从已发布工程 BOM 和确认订单计算材料需求，分离供应商承诺、采购审批与真实收货事实。</p></div><div className="flex gap-2"><Input aria-label="供应采购计划ID" className="w-24" value={projectIdText} onChange={(event) => setProjectIdText(event.target.value)} /><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />载入计划</Button></div></div>
      <Card><CardHeader><CardTitle className="text-base">供应商准入与采购依据</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
        <select aria-label="采购工程版本" className="h-10 rounded-md border bg-background px-3 text-sm" value={engineeringId} onChange={(event) => setEngineeringId(event.target.value)}><option value="">选择已发布工程</option>{engineering.map((item) => <option key={item.id} value={item.id}>{item.engineering_number} · {item.engineering_version}</option>)}</select>
        <select aria-label="采购需求订单" className="h-10 rounded-md border bg-background px-3 text-sm" value={orderId} onChange={(event) => setOrderId(event.target.value)}><option value="">选择确认订单</option>{orders.map((item) => <option key={item.id} value={item.id}>{item.order_number} · {item.status}</option>)}</select>
        <Input aria-label="供应商外部编号" value={supplierReference} onChange={(event) => setSupplierReference(event.target.value)} /><Input aria-label="供应商法定名称" value={legalName} onChange={(event) => setLegalName(event.target.value)} /><Input aria-label="准入审核证据" value={qualificationEvidence} onChange={(event) => setQualificationEvidence(event.target.value)} /><Input aria-label="供应商审批依据" value={approvalReference} onChange={(event) => setApprovalReference(event.target.value)} /><Input aria-label="采购审批依据" value={poApprovalReference} onChange={(event) => setPoApprovalReference(event.target.value)} /><Button data-supplier-create onClick={() => void createSupplier()}><ShieldCheck className="mr-1 h-4 w-4" />建立供应商</Button>
        <p className="md:col-span-3 xl:col-span-4 text-xs opacity-70">准入材料：{materials.join("、") || "请先选择工程版本"}</p>
      </CardContent></Card>
      <div className="grid gap-3 xl:grid-cols-2">{suppliers.map((item) => <Card key={item.id} data-procurement-supplier={item.id} data-supplier-status={item.lifecycle_status}><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between gap-2 text-sm"><span>{item.supplier_number} · {item.legal_name}</span><Badge>{item.lifecycle_status}</Badge></CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>外部编号 {item.supplier_reference} · {item.country_code}/{item.currency} · 标准交期 {item.standard_lead_time_days} 天 · 风险 {item.risk_level}</p><p>准入材料 {item.qualified_materials.join("、")} · 证据 {item.qualification_evidence_reference}</p><div className="flex flex-wrap gap-2">{item.lifecycle_status === "draft" ? <Button data-supplier-approve size="sm" onClick={() => void approveSupplier(item)}><BadgeCheck className="mr-1 h-4 w-4" />批准准入</Button> : <Button data-purchase-order-create size="sm" onClick={() => void createPurchaseOrder(item)}><ClipboardList className="mr-1 h-4 w-4" />生成采购单</Button>}</div></CardContent></Card>)}</div>
      <div className="grid gap-3 xl:grid-cols-2">{purchaseOrders.map((item) => {
        const next: Record<FactoryPurchaseOrder["lifecycle_status"], "submit" | "approve" | "issue" | "acknowledge" | "receive" | undefined> = { draft: "submit", "pending-approval": "approve", approved: "issue", issued: "acknowledge", acknowledged: "receive", received: undefined };
        const action = next[item.lifecycle_status]; const labels = { submit: "提交审批", approve: "批准采购", issue: "正式下单", acknowledge: "供应确认", receive: "核对收货" };
        return <Card key={item.id} data-purchase-order={item.id} data-purchase-status={item.lifecycle_status}><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between gap-2 text-sm"><span>{item.purchase_order_number}</span><Badge>{item.lifecycle_status}</Badge></CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>供应商 {item.supplier_number} · 需求订单 {item.demand_order_number} · 工程 {item.engineering_number}</p><p>{item.lines.length} 项材料 · {item.currency} <b>{item.subtotal}</b> · 需求日 {new Date(item.needed_by).toLocaleDateString()}</p>{item.promised_delivery_at ? <p data-supplier-promise><Truck className="mr-1 inline h-4 w-4" />供应商承诺 {new Date(item.promised_delivery_at).toLocaleDateString()}（尚不等于到货）</p> : null}{item.lifecycle_status === "received" ? <p data-purchase-received className="flex items-center gap-1 font-semibold text-emerald-600"><PackageCheck className="h-4 w-4" />已按独立凭证收货 {item.receiving_reference}</p> : action ? <Button data-purchase-transition={action} size="sm" onClick={() => void advance(item, action)}>{action === "issue" ? <Send className="mr-1 h-4 w-4" /> : action === "receive" ? <PackageCheck className="mr-1 h-4 w-4" /> : <BadgeCheck className="mr-1 h-4 w-4" />}{labels[action]}</Button> : null}</CardContent></Card>;
      })}</div>
    </div>
  </main></FactoryPage>;
}
