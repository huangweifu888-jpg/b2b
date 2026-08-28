import { useState } from "react";
import { BadgeCheck, CheckCircle2, ClipboardPlus, MapPin, Play, RefreshCw, Route, UserCheck, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FactoryPage } from "@/page-factory/FactoryPage";
import {
  addFieldServiceEntry, approveFieldServiceTechnician, completeFieldServiceVisit,
  createFieldServiceTechnician, createFieldServiceTicket, dispatchFieldServiceVisit,
  listFieldServiceWorkspace, transitionFieldServiceVisit,
  type FieldServiceTechnician, type FieldServiceVisit,
} from "@/lib/factory-field-service-api";
import type { FactoryAssetServiceTicket, FactoryCustomerAsset } from "@/lib/factory-customer-asset-api";

const isoAfter = (milliseconds: number) => new Date(Date.now() + milliseconds).toISOString();
const visitAction: Partial<Record<FieldServiceVisit["lifecycle_status"], "depart" | "arrive" | "start">> = {
  dispatched: "depart", "en-route": "arrive", "on-site": "start",
};
const actionLabel = { depart: "工程师出发", arrive: "到达签到", start: "开始服务" };

export default function FactoryFieldService() {
  const [projectText, setProjectText] = useState("1");
  const [mode, setMode] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [assets, setAssets] = useState<FactoryCustomerAsset[]>([]);
  const [tickets, setTickets] = useState<FactoryAssetServiceTicket[]>([]);
  const [technicians, setTechnicians] = useState<FieldServiceTechnician[]>([]);
  const [visits, setVisits] = useState<FieldServiceVisit[]>([]);
  const [issue, setIssue] = useState("轴承振动与温升异常，需要现场诊断与复测");
  const [severity, setSeverity] = useState<FactoryAssetServiceTicket["severity"]>("medium");
  const [technicianReference, setTechnicianReference] = useState(() => `FIELD-${Date.now().toString().slice(-8)}`);
  const [technicianName, setTechnicianName] = useState("华东泵阀服务工程师");
  const [skills, setSkills] = useState("泵阀机械,电气诊断");
  const [regions, setRegions] = useState("华东");
  const [arrivalLocation, setArrivalLocation] = useState("客户上海工厂 / 1号产线");
  const [evidenceReference, setEvidenceReference] = useState("FIELD-EVIDENCE-001");
  const [customerSigner, setCustomerSigner] = useState("客户设备经理");
  const [customerSignoff, setCustomerSignoff] = useState("CUSTOMER-SIGNOFF-001");
  const projectId = Number(projectText);

  const replaceAsset = (item: FactoryCustomerAsset) => setAssets((rows) => rows.map((row) => row.id === item.id ? item : row));
  const replaceTicket = (item: FactoryAssetServiceTicket) => setTickets((rows) => rows.map((row) => row.id === item.id ? item : row));
  const replaceVisit = (item: FieldServiceVisit) => setVisits((rows) => rows.map((row) => row.id === item.id ? item : row));
  const fail = async (error: unknown) => { toast.error(error instanceof Error ? error.message : "现场服务操作失败"); await load(); };
  const load = async () => {
    setMode("loading");
    try {
      const workspace = await listFieldServiceWorkspace(projectId);
      setAssets(workspace.assets); setTickets(workspace.tickets); setTechnicians(workspace.technicians); setVisits(workspace.visits); setMode("live");
    } catch (error) { setMode("error"); toast.error(error instanceof Error ? error.message : "现场服务工作台加载失败"); }
  };
  const createTicket = async (asset: FactoryCustomerAsset) => {
    try {
      const result = await createFieldServiceTicket(projectId, { asset_id: asset.id, issue_summary: issue, severity });
      replaceAsset(result.asset); setTickets((rows) => [result.ticket, ...rows]); toast.success("服务工单已创建，SLA 开始计时");
    } catch (error) { await fail(error); }
  };
  const createTechnician = async () => {
    try {
      const item = await createFieldServiceTechnician(projectId, { technician_reference: technicianReference, technician_name: technicianName, skills: skills.split(",").map((v) => v.trim()).filter(Boolean), service_regions: regions.split(",").map((v) => v.trim()).filter(Boolean) });
      setTechnicians((rows) => [item, ...rows]); toast.success("现场工程师已建档，等待授权");
    } catch (error) { await fail(error); }
  };
  const approve = async (item: FieldServiceTechnician) => {
    try {
      const approved = await approveFieldServiceTechnician(projectId, item.id, { expected_revision: item.revision, approval_reference: `APPROVAL-${item.technician_reference}` });
      setTechnicians((rows) => rows.map((row) => row.id === approved.id ? approved : row)); toast.success("工程师技能与服务区域已授权");
    } catch (error) { await fail(error); }
  };
  const dispatch = async (ticket: FactoryAssetServiceTicket, technician: FieldServiceTechnician) => {
    try {
      const result = await dispatchFieldServiceVisit(projectId, ticket.id, { technician_id: technician.id, scheduled_for: isoAfter(3600000) });
      replaceAsset(result.asset); replaceTicket(result.ticket); setVisits((rows) => [result.visit, ...rows]); toast.success("工程师已派工，现场履约链开始");
    } catch (error) { await fail(error); }
  };
  const transition = async (visit: FieldServiceVisit, action: "depart" | "arrive" | "start") => {
    try {
      const result = await transitionFieldServiceVisit(projectId, visit.id, { expected_revision: visit.revision, action, evidence_reference: `${evidenceReference}-${action.toUpperCase()}`, ...(action === "arrive" ? { arrival_location: arrivalLocation } : {}) });
      replaceVisit(result.visit); replaceTicket(result.ticket); replaceAsset(result.asset); toast.success(`${actionLabel[action]}已留证`);
    } catch (error) { await fail(error); }
  };
  const addEntry = async (visit: FieldServiceVisit, entryType: "diagnostic" | "labor" | "part") => {
    const payload = entryType === "diagnostic"
      ? { entry_type: entryType, description: "现场测得轴承温升和振动超过服务阈值，确认需更换轴承并校准轴系", evidence_reference: `${evidenceReference}-DIAG` }
      : entryType === "labor"
        ? { entry_type: entryType, description: "完成轴承拆装、轴系对中和带载复测，运行指标恢复正常", evidence_reference: `${evidenceReference}-LABOR`, labor_minutes: 90 }
        : { entry_type: entryType, description: "更换轴承套件并记录库存领用凭证及安装结果", evidence_reference: `${evidenceReference}-PART`, part_reference: "BEARING-KIT-001", quantity: "1", unit: "EA", stock_evidence_reference: "STOCK-ISSUE-001" };
    try { const result = await addFieldServiceEntry(projectId, visit.id, payload); replaceVisit(result.visit); toast.success("现场工作证据已追加"); }
    catch (error) { await fail(error); }
  };
  const complete = async (visit: FieldServiceVisit) => {
    try {
      const result = await completeFieldServiceVisit(projectId, visit.id, { expected_revision: visit.revision, resolution_reference: "SERVICE-REPORT-001", resolution_note: "轴承已更换，轴系对中和带载复测通过，设备恢复稳定运行", customer_signer: customerSigner, customer_signoff_reference: customerSignoff, next_service_due_at: isoAfter(90 * 86400000) });
      replaceVisit(result.visit); replaceTicket(result.ticket); replaceAsset(result.asset); toast.success("客户已签收，服务工单与 SLA 正式闭环");
    } catch (error) { await fail(error); }
  };

  const activeAsset = assets.find((row) => row.status === "active");
  const openTicket = tickets.find((row) => row.status === "open" && !visits.some((visit) => visit.service_ticket_id === row.id));
  const approvedTechnician = technicians.find((row) => row.lifecycle_status === "approved");
  return <FactoryPage pageId="client-field-service" template="dashboard" sourceScope="client_source" autoRegions><main className="p-4 md:p-6" data-factory-field-service-page data-field-service-mode={mode}>
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-xl font-bold"><Wrench className="h-5 w-5" />服务工单 · 现场 SLA</h1><p className="mt-1 text-sm opacity-70">从客户装机资产建单，经技能授权、派工、到场、诊断、工时、备件凭证和客户签收，形成可审计的服务闭环。</p></div><div className="flex gap-2"><Input aria-label="服务工单项目ID" className="w-24" value={projectText} onChange={(event) => setProjectText(event.target.value)} /><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />载入服务</Button></div></div>
      <Card><CardHeader><CardTitle className="text-base">建单与工程师授权</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <Input aria-label="服务问题" value={issue} onChange={(event) => setIssue(event.target.value)} />
        <select aria-label="服务严重度" className="h-10 rounded-md border bg-background px-3 text-sm" value={severity} onChange={(event) => setSeverity(event.target.value as FactoryAssetServiceTicket["severity"])}><option value="critical">紧急 · 4小时</option><option value="high">高 · 8小时</option><option value="medium">中 · 24小时</option><option value="low">低 · 72小时</option></select>
        <Button data-field-ticket-create disabled={!activeAsset} onClick={() => activeAsset && void createTicket(activeAsset)}><ClipboardPlus className="mr-1 h-4 w-4" />创建工单</Button><span className="self-center text-xs opacity-70">{activeAsset ? `${activeAsset.asset_number} · ${activeAsset.serial_number}` : "暂无可建单资产"}</span>
        <Input aria-label="工程师编号" value={technicianReference} onChange={(event) => setTechnicianReference(event.target.value)} /><Input aria-label="工程师姓名" value={technicianName} onChange={(event) => setTechnicianName(event.target.value)} /><Input aria-label="工程师技能" value={skills} onChange={(event) => setSkills(event.target.value)} /><Input aria-label="服务区域" value={regions} onChange={(event) => setRegions(event.target.value)} /><Button data-field-technician-create onClick={() => void createTechnician()}><UserCheck className="mr-1 h-4 w-4" />工程师建档</Button>
      </CardContent></Card>
      <div className="grid gap-3 xl:grid-cols-2">
        {technicians.map((item) => <Card key={item.id} data-field-technician={item.id} data-field-technician-status={item.lifecycle_status}><CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm"><div><strong>{item.technician_name}</strong><p className="opacity-70">{item.technician_number} · {item.skills.join(" / ")} · {item.service_regions.join(" / ")}</p></div>{item.lifecycle_status === "draft" ? <Button data-field-technician-approve size="sm" onClick={() => void approve(item)}><BadgeCheck className="mr-1 h-4 w-4" />审核授权</Button> : <Badge>已授权</Badge>}</CardContent></Card>)}
        {openTicket && approvedTechnician ? <Card><CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm"><div><strong>{openTicket.ticket_number}</strong><p>{openTicket.issue_summary} · SLA {new Date(openTicket.sla_due_at).toLocaleString()}</p></div><Button data-field-dispatch size="sm" onClick={() => void dispatch(openTicket, approvedTechnician)}><Route className="mr-1 h-4 w-4" />派工</Button></CardContent></Card> : null}
      </div>
      <Card><CardHeader><CardTitle className="text-base">现场执行参数</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-4"><Input aria-label="到场位置" value={arrivalLocation} onChange={(event) => setArrivalLocation(event.target.value)} /><Input aria-label="现场证据编号" value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} /><Input aria-label="客户签收人" value={customerSigner} onChange={(event) => setCustomerSigner(event.target.value)} /><Input data-field-customer-signoff aria-label="客户签收凭证" value={customerSignoff} onChange={(event) => setCustomerSignoff(event.target.value)} /></CardContent></Card>
      <div className="space-y-3">{visits.map((visit) => {
        const action = visitAction[visit.lifecycle_status];
        const types = new Set(visit.entries.map((row) => row.entry_type));
        return <Card key={visit.id} data-field-visit={visit.id} data-field-visit-status={visit.lifecycle_status} data-field-sla-status={visit.sla_status}><CardHeader className="pb-2"><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{visit.visit_number} · {visit.service_ticket_number} · {visit.asset_number}</span><span className="flex gap-2"><Badge>{visit.lifecycle_status}</Badge><Badge variant={visit.sla_status === "breached" ? "destructive" : "secondary"}>SLA {visit.sla_status}</Badge></span></CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
          <p>工程师 {visit.technician_name} · 排期 {new Date(visit.scheduled_for).toLocaleString()} · 截止 {new Date(visit.sla_due_at).toLocaleString()}</p>
          <div className="flex flex-wrap gap-2">{action ? <Button data-field-visit-transition={action} size="sm" onClick={() => void transition(visit, action)}>{action === "arrive" ? <MapPin className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}{actionLabel[action]}</Button> : null}{visit.lifecycle_status === "in-progress" ? <><Button data-field-entry-add="diagnostic" size="sm" variant="outline" disabled={types.has("diagnostic")} onClick={() => void addEntry(visit, "diagnostic")}>记录诊断</Button><Button data-field-entry-add="labor" size="sm" variant="outline" disabled={types.has("labor")} onClick={() => void addEntry(visit, "labor")}>记录工时</Button><Button data-field-entry-add="part" size="sm" variant="outline" disabled={types.has("part")} onClick={() => void addEntry(visit, "part")}>记录备件</Button><Button size="sm" disabled={!types.has("diagnostic") || !types.has("labor")} onClick={() => void complete(visit)}><CheckCircle2 className="mr-1 h-4 w-4" />客户签收</Button></> : null}</div>
          <div className="grid gap-2 md:grid-cols-3">{visit.entries.map((entry) => <div key={entry.id} className="rounded-md border p-2"><b>{entry.entry_type}</b><p>{entry.description}</p><small>证据 {entry.evidence_reference}{entry.stock_evidence_reference ? ` · 库存 ${entry.stock_evidence_reference}` : ""}</small></div>)}</div>
          {visit.lifecycle_status === "completed" ? <p data-field-service-completed className="font-semibold text-emerald-600">客户签收完成 · {visit.customer_signer} · {visit.customer_signoff_reference} · SLA {visit.sla_status}</p> : null}
        </CardContent></Card>;
      })}</div>
    </div>
  </main></FactoryPage>;
}
