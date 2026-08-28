import { useState } from "react";
import { BadgeCheck, CalendarClock, Factory, RefreshCw, Rocket, RotateCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FactoryPage } from "@/page-factory/FactoryPage";
import {
  approveFactoryPlanningResource, createFactoryPlanningResource, createFactoryProductionPlan,
  listFactoryProductionPlanning, recalculateFactoryProductionPlan, transitionFactoryProductionPlan,
  type FactoryPlanningDemandOrder, type FactoryPlanningEngineering, type FactoryPlanningResource,
  type FactoryProductionPlan,
} from "@/lib/factory-planning-api";

const dateAfter = (days: number) => new Date(Date.now() + days * 86400000).toISOString();

export default function FactoryProductionPlanning() {
  const [projectIdText, setProjectIdText] = useState("1");
  const [mode, setMode] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [resources, setResources] = useState<FactoryPlanningResource[]>([]);
  const [plans, setPlans] = useState<FactoryProductionPlan[]>([]);
  const [engineering, setEngineering] = useState<FactoryPlanningEngineering[]>([]);
  const [orders, setOrders] = useState<FactoryPlanningDemandOrder[]>([]);
  const [engineeringId, setEngineeringId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [resourceReference, setResourceReference] = useState(() => `LINE-${Date.now().toString().slice(-8)}`);
  const [resourceName, setResourceName] = useState("水泵总装一线");
  const [dailyCapacity, setDailyCapacity] = useState("5");
  const [efficiency, setEfficiency] = useState("80");
  const [calendarEvidence, setCalendarEvidence] = useState("SHIFT-CALENDAR-2026-001");
  const [capacityApproval, setCapacityApproval] = useState("CAPACITY-APPROVAL-001");
  const [planApproval, setPlanApproval] = useState("PLAN-APPROVAL-001");
  const [planRelease, setPlanRelease] = useState("PLAN-RELEASE-001");
  const projectId = Number(projectIdText);

  const replaceResource = (item: FactoryPlanningResource) => setResources((current) => current.map((candidate) => candidate.id === item.id ? item : candidate));
  const replacePlan = (item: FactoryProductionPlan) => setPlans((current) => current.map((candidate) => candidate.id === item.id ? item : candidate));
  const load = async () => {
    setMode("loading");
    try {
      const workspace = await listFactoryProductionPlanning(projectId);
      setResources(workspace.resources); setPlans(workspace.production_plans);
      setEngineering(workspace.released_engineering_versions); setOrders(workspace.eligible_demand_orders);
      setEngineeringId((current) => current || workspace.released_engineering_versions[0]?.id || "");
      setOrderId((current) => current || workspace.eligible_demand_orders[0]?.id || "");
      setMode("live");
    } catch (error) { setMode("error"); toast.error(error instanceof Error ? error.message : "产销计划加载失败"); }
  };
  const createResource = async () => {
    try {
      const item = await createFactoryPlanningResource(projectId, { resource_reference: resourceReference, resource_name: resourceName, daily_capacity: dailyCapacity, shift_hours: "8", efficiency_percent: efficiency, calendar_evidence_reference: calendarEvidence });
      setResources((current) => [item, ...current]); setMode("live"); toast.success("有限产能资源已建立");
    } catch (error) { toast.error(error instanceof Error ? error.message : "产能资源创建失败"); }
  };
  const approveResource = async (item: FactoryPlanningResource) => {
    try { replaceResource(await approveFactoryPlanningResource(projectId, item.id, { expected_revision: item.revision, approval_reference: capacityApproval, approval_note: "班次日历、有效日产能与历史效率已经运营负责人复核" })); toast.success("产能基线已批准"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "产能审批失败"); await load(); }
  };
  const createPlan = async (resource: FactoryPlanningResource) => {
    try {
      const item = await createFactoryProductionPlan(projectId, { demand_order_id: orderId, engineering_version_id: engineeringId, resource_id: resource.id, due_at: dateAfter(30) });
      setPlans((current) => [item, ...current]); toast.success(item.material_readiness_status === "ready" ? "物料与有限产能计划已生成" : "风险计划已生成，缺料未清零前禁止释放");
    } catch (error) { toast.error(error instanceof Error ? error.message : "生产计划创建失败"); }
  };
  const recalculate = async (item: FactoryProductionPlan) => {
    try { replacePlan(await recalculateFactoryProductionPlan(projectId, item.id, { expected_revision: item.revision })); toast.success("已按最新采购收货与产能重新计算，旧审批已撤销"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "计划重算失败"); await load(); }
  };
  const advance = async (item: FactoryProductionPlan, action: "submit" | "approve" | "release") => {
    const payload: Parameters<typeof transitionFactoryProductionPlan>[2] = { expected_revision: item.revision, action };
    if (action === "submit") payload.note = "订单、BOM、采购到料、产能与交期假设已经提交评审";
    if (action === "approve") { payload.note = "销售、采购、生产和运营已完成产销协同审批"; payload.approval_reference = planApproval; }
    if (action === "release") payload.release_reference = planRelease;
    try { replacePlan(await transitionFactoryProductionPlan(projectId, item.id, payload)); toast.success(action === "release" ? "生产计划已释放工作单意向" : "产销计划里程碑已推进"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "计划推进失败"); await load(); }
  };

  return <FactoryPage pageId="client-production-planning" template="dashboard" sourceScope="client_source" autoRegions><main className="p-4 md:p-6" data-factory-production-planning-page data-planning-mode={mode}>
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-xl font-bold"><CalendarClock className="h-5 w-5" />产销计划 · S&OP/MRP/APS</h1><p className="mt-1 text-sm opacity-70">把确认订单、工程BOM、真实采购收货与有限产能合并为可兑现生产计划；缺料或延期禁止释放。</p></div><div className="flex gap-2"><Input aria-label="产销计划项目ID" className="w-24" value={projectIdText} onChange={(event) => setProjectIdText(event.target.value)} /><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />载入计划</Button></div></div>
      <Card><CardHeader><CardTitle className="text-base">产能基线与需求来源</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
        <select aria-label="计划工程版本" className="h-10 rounded-md border bg-background px-3 text-sm" value={engineeringId} onChange={(event) => setEngineeringId(event.target.value)}><option value="">选择已发布工程</option>{engineering.map((item) => <option key={item.id} value={item.id}>{item.engineering_number} · {item.engineering_version}</option>)}</select>
        <select aria-label="计划需求订单" className="h-10 rounded-md border bg-background px-3 text-sm" value={orderId} onChange={(event) => setOrderId(event.target.value)}><option value="">选择确认订单</option>{orders.map((item) => <option key={item.id} value={item.id}>{item.order_number} · {item.status}</option>)}</select>
        <Input aria-label="产线外部编号" value={resourceReference} onChange={(event) => setResourceReference(event.target.value)} /><Input aria-label="产线名称" value={resourceName} onChange={(event) => setResourceName(event.target.value)} /><Input aria-label="理论日产能" type="number" value={dailyCapacity} onChange={(event) => setDailyCapacity(event.target.value)} /><Input aria-label="效率百分比" type="number" value={efficiency} onChange={(event) => setEfficiency(event.target.value)} /><Input aria-label="班次日历证据" value={calendarEvidence} onChange={(event) => setCalendarEvidence(event.target.value)} /><Input aria-label="产能审批依据" value={capacityApproval} onChange={(event) => setCapacityApproval(event.target.value)} /><Input aria-label="计划审批依据" value={planApproval} onChange={(event) => setPlanApproval(event.target.value)} /><Input aria-label="计划释放依据" value={planRelease} onChange={(event) => setPlanRelease(event.target.value)} /><Button data-planning-resource-create onClick={() => void createResource()}><Factory className="mr-1 h-4 w-4" />建立产能</Button>
      </CardContent></Card>
      <div className="grid gap-3 xl:grid-cols-2">{resources.map((item) => <Card key={item.id} data-planning-resource={item.id} data-resource-status={item.lifecycle_status}><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between gap-2 text-sm"><span>{item.resource_number} · {item.resource_name}</span><Badge>{item.lifecycle_status}</Badge></CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>理论日产能 {item.daily_capacity} · 8小时班次 · 效率 {item.efficiency_percent}% · 日历 {item.calendar_evidence_reference}</p>{item.lifecycle_status === "draft" ? <Button data-planning-resource-approve size="sm" onClick={() => void approveResource(item)}><BadgeCheck className="mr-1 h-4 w-4" />批准产能</Button> : <Button data-production-plan-create size="sm" onClick={() => void createPlan(item)}><CalendarClock className="mr-1 h-4 w-4" />生成计划</Button>}</CardContent></Card>)}</div>
      <div className="grid gap-3 xl:grid-cols-2">{plans.map((item) => {
        const next = item.lifecycle_status === "draft" ? "submit" : item.lifecycle_status === "pending-review" ? "approve" : item.lifecycle_status === "approved" ? "release" : undefined;
        const labels = { submit: "提交评审", approve: "批准计划", release: "释放计划" };
        return <Card key={item.id} data-production-plan={item.id} data-production-plan-status={item.lifecycle_status}><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between gap-2 text-sm"><span>{item.production_plan_number}</span><Badge>{item.lifecycle_status}</Badge></CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>订单 {item.demand_order_number} · 工程 {item.engineering_number} · 需求 {item.demand_quantity}</p><p>有效日产能 {item.effective_daily_capacity} · 工作日 {item.capacity_days} 天 · 完工 {new Date(item.planned_end_at).toLocaleDateString()} · 交期 {new Date(item.due_at).toLocaleDateString()}</p><div className="flex flex-wrap gap-2"><Badge data-material-readiness variant={item.material_readiness_status === "ready" ? "secondary" : "destructive"}>物料 {item.material_readiness_status}</Badge><Badge data-schedule-readiness variant={item.schedule_status === "on-time" ? "secondary" : "destructive"}>排程 {item.schedule_status}</Badge></div>{item.shortages.length ? <p data-planning-shortage className="flex items-center gap-1 text-red-600"><TriangleAlert className="h-4 w-4" />缺料 {item.shortages.map((row) => `${row.material_reference}:${row.shortage_quantity}`).join("、")}</p> : <p data-planning-ready className="font-semibold text-emerald-600">BOM材料已由独立收货凭证覆盖</p>}{item.lifecycle_status === "released" ? <p data-production-plan-released className="flex items-center gap-1 font-semibold text-emerald-600"><Rocket className="h-4 w-4" />已释放 {item.work_order_intent_reference}</p> : <div className="flex flex-wrap gap-2">{next ? <Button data-production-plan-transition={next} size="sm" onClick={() => void advance(item, next)}><BadgeCheck className="mr-1 h-4 w-4" />{labels[next]}</Button> : null}<Button data-production-plan-recalculate size="sm" variant="outline" onClick={() => void recalculate(item)}><RotateCw className="mr-1 h-4 w-4" />重算计划</Button></div>}</CardContent></Card>;
      })}</div>
    </div>
  </main></FactoryPage>;
}
