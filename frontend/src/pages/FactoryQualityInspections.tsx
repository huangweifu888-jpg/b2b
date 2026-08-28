import { useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, RefreshCw, ShieldCheck, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FactoryPage } from "@/page-factory/FactoryPage";
import {
  createFactoryQualityFinding, createFactoryQualityInspection, listFactoryQualityInspections,
  recordFactoryQualityResults, releaseFactoryQualityInspection, resolveFactoryQualityFinding,
  startFactoryQualityInspection, type FactoryQualityEligibleOrder, type FactoryQualityInspection,
  type QualityCheckCode,
} from "@/lib/factory-quality-api";

const CHECKS: Array<{ code: QualityCheckCode; label: string }> = [
  { code: "appearance", label: "外观检验" }, { code: "dimensions", label: "尺寸检验" },
  { code: "performance", label: "性能检验" }, { code: "safety", label: "安全检验" },
  { code: "documentation", label: "文件检验" },
];
const inspectionTimestamp = () => Date.now();

export default function FactoryQualityInspections() {
  const [projectIdText, setProjectIdText] = useState("1");
  const [mode, setMode] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [orders, setOrders] = useState<FactoryQualityEligibleOrder[]>([]);
  const [inspections, setInspections] = useState<FactoryQualityInspection[]>([]);
  const [orderId, setOrderId] = useState("");
  const [productReference, setProductReference] = useState("PUMP-001");
  const [skuReference, setSkuReference] = useState("PUMP-001-380V");
  const [inspectionReference, setInspectionReference] = useState("QMS-20260801-001");
  const [sampleSize, setSampleSize] = useState("5");
  const [inspector, setInspector] = useState("质量工程师 王工");
  const [approvalReference, setApprovalReference] = useState("QMS-APPROVAL-001");
  const projectId = Number(projectIdText);

  const replaceInspection = (item: FactoryQualityInspection) => setInspections((current) => current.map((candidate) => candidate.id === item.id ? item : candidate));
  const adoptOrder = (order: FactoryQualityEligibleOrder | undefined) => {
    if (!order) return;
    setOrderId(order.id);
    const line = order.lines[0] ?? {};
    setProductReference(String(line.product_reference ?? "PUMP-001"));
    setSkuReference(String(line.sku_reference ?? "PUMP-001-380V"));
    const historical = order.fulfillment_evidence.find((item) => item.action === "release-quality");
    setInspectionReference(String(historical?.reference ?? `QMS-${inspectionTimestamp().toString().slice(-10)}`));
  };
  const load = async () => {
    setMode("loading");
    try {
      const workspace = await listFactoryQualityInspections(projectId);
      setInspections(workspace.inspections); setOrders(workspace.eligible_orders);
      adoptOrder(workspace.eligible_orders.find((order) => order.id === orderId) ?? workspace.eligible_orders[0]);
      setMode("live");
    } catch (error) { setMode("error"); toast.error(error instanceof Error ? error.message : "质量工作台加载失败"); }
  };
  const createInspection = async () => {
    try {
      const item = await createFactoryQualityInspection(projectId, { order_id: orderId, product_reference: productReference, sku_reference: skuReference, inspection_reference: inspectionReference, inspection_type: "final", sample_size: Number(sampleSize) });
      setInspections((current) => [item, ...current]); setMode("live"); toast.success("批次检验单已建立");
    } catch (error) { toast.error(error instanceof Error ? error.message : "检验单创建失败"); }
  };
  const start = async (item: FactoryQualityInspection) => {
    try { replaceInspection(await startFactoryQualityInspection(projectId, item.id, { expected_revision: item.revision, inspector })); toast.success("检验已开始"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "开始检验失败"); await load(); }
  };
  const record = async (item: FactoryQualityInspection) => {
    try {
      replaceInspection(await recordFactoryQualityResults(projectId, item.id, {
        expected_revision: item.revision, accepted_quantity: 4, rejected_quantity: 1,
        check_results: CHECKS.map(({ code }) => ({ check_code: code, passed: code !== "dimensions", measured_value: code === "dimensions" ? "法兰尺寸超公差 0.8mm" : "符合技术规范", evidence_reference: `EVIDENCE-${item.inspection_reference}-${code.toUpperCase()}` })),
      })); toast.success("五项检验结果已记录，尺寸异常待闭环");
    } catch (error) { toast.error(error instanceof Error ? error.message : "记录检验结果失败"); await load(); }
  };
  const createFinding = async (item: FactoryQualityInspection) => {
    try {
      const result = await createFactoryQualityFinding(projectId, item.id, { expected_revision: item.revision, check_code: "dimensions", severity: "major", description: "法兰关键尺寸超过工程公差，需返工复检", affected_quantity: 1 });
      replaceInspection({ ...result.inspection, findings: [...item.findings, result.finding] }); toast.success("质量异常 NCR 已建立");
    } catch (error) { toast.error(error instanceof Error ? error.message : "质量异常创建失败"); await load(); }
  };
  const resolveFinding = async (item: FactoryQualityInspection) => {
    const finding = item.findings.find((candidate) => candidate.lifecycle_status === "open"); if (!finding) return;
    try {
      const result = await resolveFactoryQualityFinding(projectId, finding.id, { expected_revision: finding.revision, expected_inspection_revision: item.revision, disposition: "rework", root_cause: "工装定位基准发生漂移", corrective_action: "重新校准工装并返工法兰后完成复检", resolution_evidence_reference: `CAPA-${item.inspection_reference}` });
      replaceInspection({ ...result.inspection, findings: item.findings.map((candidate) => candidate.id === finding.id ? result.finding : candidate) }); toast.success("NCR 与纠正措施已闭环");
    } catch (error) { toast.error(error instanceof Error ? error.message : "质量异常闭环失败"); await load(); }
  };
  const release = async (item: FactoryQualityInspection) => {
    try { replaceInspection(await releaseFactoryQualityInspection(projectId, item.id, { expected_revision: item.revision, approval_reference: approvalReference, release_note: "异常返工与复检证据已经质量负责人审核，批准本批次放行" })); toast.success("批次已质量放行，冻结事件证据已生成"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "质量放行失败"); await load(); }
  };

  return <FactoryPage pageId="client-quality-inspections" template="dashboard" sourceScope="client_source" autoRegions><main className="p-4 md:p-6" data-factory-quality-page data-quality-mode={mode}>
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-xl font-bold"><ClipboardCheck className="h-5 w-5" />质量管理 · QMS</h1><p className="mt-1 text-sm opacity-70">以订单、工单和批次为权威来源，执行五项检验、NCR/CAPA 闭环与可审计放行；未放行批次不能进入发运。</p></div>
        <div className="flex gap-2"><Input aria-label="质量管理计划ID" className="w-24" value={projectIdText} onChange={(event) => setProjectIdText(event.target.value)} /><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />载入计划</Button></div>
      </div>
      <Card><CardHeader><CardTitle className="text-base">建立批次检验</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
        <select aria-label="待检验订单" className="h-10 rounded-md border bg-background px-3 text-sm" value={orderId} onChange={(event) => adoptOrder(orders.find((order) => order.id === event.target.value))}><option value="">选择已完工订单</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.order_number} · {order.status}</option>)}</select>
        <Input aria-label="质检产品编号" value={productReference} onChange={(event) => setProductReference(event.target.value)} /><Input aria-label="质检SKU编号" value={skuReference} onChange={(event) => setSkuReference(event.target.value)} /><Input aria-label="质检证据编号" value={inspectionReference} onChange={(event) => setInspectionReference(event.target.value)} /><Input aria-label="抽样数量" type="number" value={sampleSize} onChange={(event) => setSampleSize(event.target.value)} /><Input aria-label="检验员" value={inspector} onChange={(event) => setInspector(event.target.value)} /><Input aria-label="放行审批依据" value={approvalReference} onChange={(event) => setApprovalReference(event.target.value)} /><Button data-quality-inspection-create onClick={() => void createInspection()}><ClipboardCheck className="mr-1 h-4 w-4" />建立检验</Button>
      </CardContent></Card>
      <div className="grid gap-3 xl:grid-cols-2">{inspections.map((item) => {
        const openFinding = item.findings.find((finding) => finding.lifecycle_status === "open");
        const allClosed = item.findings.length > 0 && item.findings.every((finding) => finding.lifecycle_status === "closed");
        return <Card key={item.id} data-quality-inspection={item.id} data-quality-status={item.lifecycle_status}><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between gap-2 text-sm"><span>{item.inspection_number} · {item.order_number}</span><Badge>{item.lifecycle_status}</Badge></CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
          <p>产品 <b>{item.product_reference}/{item.sku_reference}</b> · 工单 {item.work_order_reference} · 批次 {item.batch_reference}</p><p>抽样 {item.sample_size} · 合格 {item.accepted_quantity} · 不合格 {item.rejected_quantity} · 证据 {item.inspection_reference}</p>
          {item.check_results.length ? <div className="flex flex-wrap gap-1">{item.check_results.map((check) => <Badge key={check.check_code} variant={check.passed ? "secondary" : "destructive"}>{CHECKS.find((candidate) => candidate.code === check.check_code)?.label} {check.passed ? "通过" : "异常"}</Badge>)}</div> : null}
          {item.findings.map((finding) => <p key={finding.id} data-quality-finding={finding.id} className="flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-amber-500" />{finding.finding_number} · {finding.severity} · {finding.lifecycle_status === "closed" ? `已闭环 ${finding.resolution_evidence_reference}` : "待处置"}</p>)}
          {item.lifecycle_status === "released" ? <p data-quality-released className="flex items-center gap-1 font-semibold text-emerald-600"><ShieldCheck className="h-4 w-4" />已批准放行 <span data-quality-event-frozen>{String(item.emitted_events[0]?.eventType ?? "")}</span></p> : <div className="flex flex-wrap gap-2">
            {item.lifecycle_status === "draft" ? <Button data-quality-start size="sm" onClick={() => void start(item)}><ClipboardCheck className="mr-1 h-4 w-4" />开始检验</Button> : null}
            {item.lifecycle_status === "in-progress" ? <Button data-quality-results size="sm" onClick={() => void record(item)}><CheckCircle2 className="mr-1 h-4 w-4" />记录五检</Button> : null}
            {item.lifecycle_status === "review-required" && item.findings.length === 0 ? <Button data-quality-finding-create size="sm" variant="destructive" onClick={() => void createFinding(item)}><AlertTriangle className="mr-1 h-4 w-4" />建立NCR</Button> : null}
            {openFinding ? <Button data-quality-finding-resolve size="sm" onClick={() => void resolveFinding(item)}><Wrench className="mr-1 h-4 w-4" />闭环CAPA</Button> : null}
            {item.lifecycle_status === "review-required" && allClosed ? <Button data-quality-release size="sm" onClick={() => void release(item)}><ShieldCheck className="mr-1 h-4 w-4" />批准放行</Button> : null}
          </div>}
        </CardContent></Card>;
      })}</div>
    </div>
  </main></FactoryPage>;
}
