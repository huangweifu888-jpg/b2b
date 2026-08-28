import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FactoryPage } from "@/page-factory/FactoryPage";
import { BadgeCheck, FlaskConical, PackageCheck, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  acknowledgeSampleFeedback, approveRfqRequirement, approveSampleTask,
  createRfqCase, createRfqRequirement, createSampleTask, dispatchSampleTask,
  listRfqWorkspace, recordSampleFeedback, type RfqWorkspace,
} from "@/lib/factory-rfq-sample-api";

const EMPTY:RfqWorkspace={cases:[],requirements:[],samples:[],feedback:[],evidence:[],sources:[],metrics:{rfq_cases:0,requirement_review_percent:0,approved_samples:0,dispatched_samples:0,accepted_feedback:0,feedback_acknowledgement_percent:0},contract:{}};
const STATUS:Record<string,string>={clarifying:"需求澄清", "pending-review":"待技术审核", approved:"已批准", "sample-planned":"样品待批", dispatched:"已发运", received:"已收样", "feedback-pending":"反馈待回执", acknowledged:"已回执", "sample-accepted":"样品通过", "sample-revision":"样品修订", "sample-rejected":"样品拒绝"};
const futureDate=(days:number)=>new Date(Date.now()+days*86400000).toISOString();

export default function FactoryRfqSamples(){
  const[projectId,setProjectId]=useState(1); const[workspace,setWorkspace]=useState<RfqWorkspace>(EMPTY); const[mode,setMode]=useState("loading");
  const load=async()=>{try{setMode("loading");setWorkspace(await listRfqWorkspace(projectId));setMode("live")}catch(error){setMode("error");toast.error(error instanceof Error?error.message:"样品管理载入失败")}};
  useEffect(()=>{void load()},[projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  const run=async(action:()=>Promise<unknown>,message:string)=>{try{await action();toast.success(message);await load()}catch(error){toast.error(error instanceof Error?error.message:"样品管理操作失败");await load()}};
  const rfq=workspace.cases[0]; const requirements=workspace.requirements.filter(x=>x.case_id===rfq?.id); const requirement=requirements[0]; const sample=workspace.samples.find(x=>x.case_id===rfq?.id); const feedback=workspace.feedback.find(x=>x.sample_id===sample?.id);
  return <FactoryPage pageId="client-rfq-samples" template="dashboard" sourceScope="client_source" autoRegions><main className="p-4 md:p-6" data-factory-rfq-page data-rfq-mode={mode}><div className="mx-auto max-w-7xl space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="flex items-center gap-2 text-xl font-bold"><FlaskConical className="h-5 w-5"/>RFQ与样品管理</h1><p className="mt-1 text-sm opacity-75">固定权威询盘版本，完成需求异人审核、样品成本与范围审批、发运证据、客户反馈和销售回执；不改写订单、物流或财务。</p></div><div className="flex gap-2"><input className="h-9 w-24 rounded-md border bg-transparent px-3" type="number" min={1} value={projectId} onChange={event=>setProjectId(Number(event.target.value)||1)}/><Button variant="outline" onClick={()=>void load()}><RefreshCw className="mr-1 h-4 w-4"/>刷新样品</Button></div></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Metric label="RFQ项目" value={workspace.metrics.rfq_cases}/><Metric label="需求审核" value={`${workspace.metrics.requirement_review_percent}%`}/><Metric label="批准样品" value={workspace.metrics.approved_samples}/><Metric label="已发运" value={workspace.metrics.dispatched_samples}/><Metric label="通过反馈" value={workspace.metrics.accepted_feedback}/><Metric label="反馈回执" value={`${workspace.metrics.feedback_acknowledgement_percent}%`}/></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4"/>询盘固定与技术澄清</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex flex-wrap gap-2">
      <Button data-rfq-case-create disabled={!!rfq||!workspace.sources.length} onClick={()=>workspace.sources[0]&&void run(()=>createRfqCase(projectId,{source_flow_id:workspace.sources[0].source_flow_id,objective:"在报价承诺前验证客户技术范围与样品适配"}),"已固定权威询盘版本")}>建立RFQ项目</Button>
      <Button data-rfq-requirement-create disabled={!rfq||rfq.status!=="clarifying"||!!requirement} onClick={()=>rfq&&void run(()=>createRfqRequirement(projectId,rfq.id,{requirement_code:"VALIDATION",requirement_name:"客户样品验证",specification:"按客户用途、环境、接口与验收标准完成样品验证",quantity:1,target_date:futureDate(14).slice(0,10),critical:true}),"技术需求已提交独立审核")}>提交技术需求</Button>
      <Button data-rfq-requirement-approve disabled={!requirement||requirement.status!=="pending-review"} onClick={()=>requirement&&void run(()=>approveRfqRequirement(projectId,requirement.id,{expected_revision:requirement.revision,approval_reference:`TECH-QA-${Date.now()}`}),"技术需求已独立批准")}>独立审核需求</Button>
    </div>{workspace.cases.map(item=><Row key={item.id} title={`${item.rfq_number} · ${item.product_reference}`} status={item.status} detail={`来源 ${item.source_correlation_id} / r${item.source_revision} · ${item.source_fingerprint.slice(0,18)}…`}/>)}{requirements.map(item=><Row key={item.id} title={`${item.requirement_number} · ${item.requirement_name}`} status={item.status} detail={`${item.specification} · 数量 ${item.quantity} · ${item.critical?"关键":"普通"}`}/>)}</CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><PackageCheck className="h-4 w-4"/>样品成本、发运与客户反馈</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex flex-wrap gap-2">
      <Button data-rfq-sample-create disabled={!rfq||!requirements.length||requirements.some(x=>x.status!=="approved")||!!sample} onClick={()=>rfq&&void run(()=>createSampleTask(projectId,rfq.id,{sample_code:"VALIDATION-A",requirement_ids:requirements.map(x=>x.id),quantity:1,unit_cost:"125.50",currency:"USD",promised_at:futureDate(7)}),"样品计划与管理成本已提交审批")}>创建样品任务</Button>
      <Button data-rfq-sample-approve disabled={!sample||sample.status!=="pending-approval"} onClick={()=>sample&&void run(()=>approveSampleTask(projectId,sample.id,{expected_revision:sample.revision,approval_reference:`SAMPLE-QA-${Date.now()}`}),"样品范围与成本已独立批准")}>独立审批样品</Button>
      <Button data-rfq-sample-dispatch disabled={!sample||sample.status!=="approved"} onClick={()=>sample&&void run(()=>dispatchSampleTask(projectId,sample.id,{expected_revision:sample.revision,shipping_reference:`SHIP-${Date.now()}`}),"样品发运凭证已记录")}>记录样品发运</Button>
      <Button data-rfq-feedback-record disabled={!sample||sample.status!=="dispatched"||!!feedback} onClick={()=>sample&&void run(()=>recordSampleFeedback(projectId,sample.id,{outcome:"accepted",quality_score:96,feedback_note:"客户确认样品符合全部已审核技术要求",conversion_intent:true}),"客户反馈已固化，等待销售回执")}>记录客户反馈</Button>
      <Button data-rfq-feedback-ack disabled={!feedback||feedback.status!=="pending-acknowledgement"} onClick={()=>feedback&&void run(()=>acknowledgeSampleFeedback(projectId,feedback.id,{expected_revision:feedback.revision,acknowledgement_reference:`SALES-ACK-${Date.now()}`}),"客户反馈已由销售确认回执")}>销售确认回执</Button>
    </div>{workspace.samples.map(item=><Row key={item.id} title={`${item.sample_number} · ${item.sample_code}`} status={item.status} detail={`${item.quantity}件 · ${item.currency} ${item.unit_cost} · ${item.shipping_reference??"待发运"}`}/>)}{workspace.feedback.map(item=><Row key={item.id} title={`${item.feedback_number} · 评分 ${item.quality_score}`} status={item.status} detail={`${item.outcome} · 转单意向 ${item.conversion_intent?"是":"否"} · ${item.feedback_hash.slice(0,18)}…`}/>)}</CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">运营边界</CardTitle></CardHeader><CardContent className="grid gap-2 text-sm md:grid-cols-2">{Object.entries(workspace.contract).map(([key,value])=><div key={key} className="flex items-center justify-between rounded-md border p-2"><span>{key}</span><Badge variant={value?"default":"outline"}>{String(value)}</Badge></div>)}</CardContent></Card>
  </div></main></FactoryPage>;
}
function Metric({label,value}:{label:string;value:string|number}){return <Card><CardContent className="py-4"><p className="text-xs opacity-70">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></CardContent></Card>}
function Row({title,status,detail}:{title:string;status:string;detail:string}){return <div className="rounded-lg border p-3" data-rfq-record data-rfq-status={status}><div className="flex flex-wrap items-center justify-between gap-2"><b>{title}</b><Badge><BadgeCheck className="mr-1 h-3 w-3"/>{STATUS[status]??status}</Badge></div><p className="mt-1 break-all text-xs opacity-75">{detail}</p></div>}
