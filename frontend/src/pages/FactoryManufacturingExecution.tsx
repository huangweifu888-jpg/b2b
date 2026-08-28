import { useState } from "react";
import { AlertTriangle, BadgeCheck, Factory, PauseCircle, Play, RefreshCw, SquareCheckBig, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FactoryPage } from "@/page-factory/FactoryPage";
import {
  completeMesOperation, createMesWorkOrder, listMesWorkspace, openMesDowntime,
  resolveMesDowntime, startMesOperation, transitionMesWorkOrder,
  type MesReleasedPlan, type MesWorkOrder,
} from "@/lib/factory-mes-api";

const routing = [
  { operation_sequence: 10, operation_code: "KITTING", operation_name: "齐套备料", work_center_reference: "WC-KITTING" },
  { operation_sequence: 20, operation_code: "ASSEMBLY", operation_name: "总装作业", work_center_reference: "WC-ASSEMBLY" },
  { operation_sequence: 30, operation_code: "TEST", operation_name: "性能测试", work_center_reference: "WC-TEST" },
  { operation_sequence: 40, operation_code: "PACK", operation_name: "包装入库", work_center_reference: "WC-PACK" },
];

export default function FactoryManufacturingExecution() {
  const [projectText, setProjectText] = useState("1");
  const [mode, setMode] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [plans, setPlans] = useState<MesReleasedPlan[]>([]);
  const [workOrders, setWorkOrders] = useState<MesWorkOrder[]>([]);
  const [planId, setPlanId] = useState("");
  const [batchReference, setBatchReference] = useState(() => `BATCH-${Date.now().toString().slice(-10)}`);
  const [operatorReference, setOperatorReference] = useState("OPERATOR-001");
  const [evidenceReference, setEvidenceReference] = useState("MES-EVIDENCE-001");
  const [reasonCode, setReasonCode] = useState("EQUIPMENT");
  const [reasonNote, setReasonNote] = useState("设备传感器报警，需要暂停检查并保留维修证据");
  const projectId = Number(projectText);
  const selectedPlan = plans.find((item) => item.id === planId);
  const replace = (item: MesWorkOrder) => setWorkOrders((current) => current.map((row) => row.id === item.id ? item : row));
  const run = async (task: () => Promise<MesWorkOrder>, success: string) => {
    try { const item = await task(); replace(item); toast.success(success); }
    catch (error) { toast.error(error instanceof Error ? error.message : "制造执行操作失败"); await load(); }
  };
  const load = async () => {
    setMode("loading");
    try {
      const workspace = await listMesWorkspace(projectId);
      setPlans(workspace.released_production_plans); setWorkOrders(workspace.work_orders);
      setPlanId((current) => current || workspace.released_production_plans.find((row) => !row.already_work_ordered)?.id || workspace.released_production_plans[0]?.id || "");
      setMode("live");
    } catch (error) { setMode("error"); toast.error(error instanceof Error ? error.message : "制造执行加载失败"); }
  };
  const create = async () => {
    if (!selectedPlan) return toast.error("请选择已释放生产计划");
    const material_lots = selectedPlan.material_requirements.map((row, index) => ({
      material_reference: row.material_reference,
      lot_reference: `LOT-${row.material_reference}-${String(index + 1).padStart(2, "0")}`,
      issued_quantity: row.required_quantity,
      source_receiving_reference: row.receiving_evidence?.[0] || "GRN-CONTROLLED-RECEIPT",
    }));
    try {
      const item = await createMesWorkOrder(projectId, { production_plan_id: selectedPlan.id, batch_reference: batchReference, material_lots, routing });
      setWorkOrders((current) => [item, ...current]);
      setPlans((current) => current.map((row) => row.id === selectedPlan.id ? { ...row, already_work_ordered: true } : row));
      toast.success("制造工单与物料批次谱系已建立");
    } catch (error) { toast.error(error instanceof Error ? error.message : "制造工单创建失败"); }
  };

  return <FactoryPage pageId="client-manufacturing-execution" template="dashboard" sourceScope="client_source" autoRegions><main className="p-4 md:p-6" data-factory-mes-page data-mes-mode={mode}>
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-xl font-bold"><Factory className="h-5 w-5" />制造执行 · MES</h1><p className="mt-1 text-sm opacity-70">把已释放产销计划转为可追溯工单，控制物料批次、顺序报工、停机恢复、良品与报废。</p></div><div className="flex gap-2"><Input aria-label="制造执行项目ID" className="w-24" value={projectText} onChange={(event) => setProjectText(event.target.value)} /><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />载入MES</Button></div></div>
      <Card><CardHeader><CardTitle className="text-base">下达制造工单</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <select aria-label="MES生产计划" className="h-10 rounded-md border bg-background px-3 text-sm" value={planId} onChange={(event) => setPlanId(event.target.value)}><option value="">选择已释放计划</option>{plans.map((item) => <option key={item.id} value={item.id} disabled={item.already_work_ordered}>{item.production_plan_number} · {item.already_work_ordered ? "已下达" : item.demand_quantity}</option>)}</select>
        <Input aria-label="MES批次编号" value={batchReference} onChange={(event) => setBatchReference(event.target.value)} />
        <Input aria-label="MES操作员" value={operatorReference} onChange={(event) => setOperatorReference(event.target.value)} />
        <Input aria-label="MES证据编号" value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} />
        <Input aria-label="停机原因代码" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} />
        <Input aria-label="停机原因说明" className="md:col-span-2" value={reasonNote} onChange={(event) => setReasonNote(event.target.value)} />
        <Button data-mes-work-order-create onClick={() => void create()}><Factory className="mr-1 h-4 w-4" />建立工单</Button>
      </CardContent></Card>
      <div className="space-y-3">{workOrders.map((item) => {
        const openDowntime = item.downtimes.find((row) => row.lifecycle_status === "open");
        return <Card key={item.id} data-mes-work-order={item.id} data-mes-work-order-status={item.lifecycle_status}><CardHeader className="pb-2"><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{item.work_order_number} · {item.batch_reference}</span><Badge>{item.lifecycle_status}</Badge></CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
          <p>计划 {item.production_plan_number} · 订单 {item.demand_order_number} · 工程 {item.engineering_number} · 目标 {item.target_quantity}</p>
          <div className="flex flex-wrap gap-2"><Badge data-mes-material-trace>物料批次 {item.material_lots.length}</Badge><Badge data-mes-output>良品 {item.completed_quantity}</Badge><Badge variant={Number(item.scrap_quantity) ? "destructive" : "secondary"}>报废 {item.scrap_quantity}</Badge></div>
          {item.lifecycle_status === "draft" ? <Button data-mes-work-order-transition="release" size="sm" onClick={() => void run(() => transitionMesWorkOrder(projectId, item.id, { expected_revision: item.revision, action: "release", evidence_reference: evidenceReference }), "制造工单已批准释放")}><BadgeCheck className="mr-1 h-4 w-4" />释放工单</Button> : null}
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">{item.operations.map((operation, index) => {
            const previousReady = index === 0 || item.operations[index - 1].lifecycle_status === "completed";
            return <div key={operation.id} className="rounded-md border p-3" data-mes-operation={operation.id} data-mes-operation-status={operation.lifecycle_status}><div className="flex items-center justify-between gap-2"><strong>{operation.operation_sequence}. {operation.operation_name}</strong><Badge variant="outline">{operation.lifecycle_status}</Badge></div><p className="mt-1 opacity-70">{operation.operation_code} · {operation.work_center_reference}</p><p>投入 {operation.input_quantity} · 良品 {operation.good_quantity} · 报废 {operation.scrap_quantity}</p>
              {operation.lifecycle_status === "pending" && previousReady && ["released", "in-progress"].includes(item.lifecycle_status) ? <Button data-mes-operation-start size="sm" className="mt-2" onClick={() => void run(() => startMesOperation(projectId, operation.id, { expected_revision: operation.revision, operator_reference: operatorReference, evidence_reference: evidenceReference }), "工序已开始") }><Play className="mr-1 h-4 w-4" />开始工序</Button> : null}
              {operation.lifecycle_status === "in-progress" && item.lifecycle_status === "in-progress" ? <div className="mt-2 flex flex-wrap gap-2"><Button data-mes-downtime-open size="sm" variant="destructive" onClick={() => void run(() => openMesDowntime(projectId, operation.id, { reason_code: reasonCode, reason_note: reasonNote }), "停机事件已记录") }><PauseCircle className="mr-1 h-4 w-4" />记录停机</Button><Button data-mes-operation-complete size="sm" onClick={() => void run(() => completeMesOperation(projectId, operation.id, { expected_revision: operation.revision, good_quantity: operation.input_quantity, scrap_quantity: "0", evidence_reference: evidenceReference }), "工序报工已完成") }><SquareCheckBig className="mr-1 h-4 w-4" />完成工序</Button></div> : null}
            </div>;
          })}</div>
          {openDowntime ? <div data-mes-downtime-open-card className="rounded-md border border-amber-400 bg-amber-50 p-3 text-amber-950"><p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />{openDowntime.downtime_number} · {openDowntime.operation_code} · {openDowntime.reason_code}</p><p>{openDowntime.reason_note}</p><Button data-mes-downtime-resolve size="sm" className="mt-2" onClick={() => void run(() => resolveMesDowntime(projectId, openDowntime.id, { expected_revision: openDowntime.revision, resolution_note: "故障已排除，安全点检和首件复核通过", evidence_reference: evidenceReference }), "停机已恢复并保留维修证据") }><Wrench className="mr-1 h-4 w-4" />恢复生产</Button></div> : null}
          {item.lifecycle_status === "ready-to-complete" ? <Button data-mes-work-order-transition="complete" size="sm" onClick={() => void run(() => transitionMesWorkOrder(projectId, item.id, { expected_revision: item.revision, action: "complete", evidence_reference: evidenceReference }), "制造工单已完工关闭") }><SquareCheckBig className="mr-1 h-4 w-4" />关闭工单</Button> : null}
          {item.lifecycle_status === "completed" ? <p data-mes-work-order-completed className="font-semibold text-emerald-600">制造谱系已冻结，可供质量放行、产品护照与交付引用。</p> : null}
        </CardContent></Card>;
      })}</div>
    </div>
  </main></FactoryPage>;
}
