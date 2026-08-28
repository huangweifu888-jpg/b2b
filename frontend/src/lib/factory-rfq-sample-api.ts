import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type RfqCase = { id:string; rfq_number:string; source_flow_id:string; source_correlation_id:string; source_revision:number; source_stage:string; source_fingerprint:string; account_reference_hash:string; product_reference:string; objective:string; status:string; created_by:string; revision:number };
export type RfqRequirement = { id:string; requirement_number:string; case_id:string; rfq_number:string; requirement_code:string; requirement_name:string; specification:string; quantity:number; target_date:string; critical:boolean; status:string; authored_by:string; approved_by?:string|null; approval_reference?:string|null; revision:number };
export type SampleTask = { id:string; sample_number:string; case_id:string; rfq_number:string; sample_code:string; requirement_ids_json:string[]; quantity:number; unit_cost:string; currency:string; promised_at:string; status:string; created_by:string; approved_by?:string|null; approval_reference?:string|null; shipping_reference?:string|null; dispatched_by?:string|null; revision:number };
export type SampleFeedback = { id:string; feedback_number:string; case_id:string; sample_id:string; sample_number:string; outcome:string; quality_score:number; feedback_note:string; conversion_intent:boolean; feedback_hash:string; status:string; recorded_by:string; acknowledged_by?:string|null; revision:number };
export type RfqSource = { source_flow_id:string; correlation_id:string; product_reference:string; source_stage:string; account_reference_hash:string };
export type RfqWorkspace = {
  cases:RfqCase[]; requirements:RfqRequirement[]; samples:SampleTask[]; feedback:SampleFeedback[];
  evidence:Array<{id:string;subject_type:string;subject_id:string;evidence_type:string;evidence_reference:string;recorded_by:string}>;
  sources:RfqSource[];
  metrics:{rfq_cases:number;requirement_review_percent:number;approved_samples:number;dispatched_samples:number;accepted_feedback:number;feedback_acknowledgement_percent:number};
  contract:Record<string,boolean>;
};

async function request<T>(path:string, init?:RequestInit):Promise<T> {
  let token=authApi.getStoredToken();
  if(!token && await authApi.restoreLocalDemoSession("hq")) token=authApi.getStoredToken();
  const headers=new Headers(init?.headers); headers.set("Content-Type","application/json");
  if(token) headers.set("Authorization",`Bearer ${token}`);
  let response=await fetch(`${getAPIBaseURL()}${path}`,{...init,headers});
  if(response.status===401 && await authApi.restoreLocalDemoSession("hq")) {
    const restored=authApi.getStoredToken(); if(restored) headers.set("Authorization",`Bearer ${restored}`);
    response=await fetch(`${getAPIBaseURL()}${path}`,{...init,headers});
  }
  if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(typeof body.detail==="string"?body.detail:`样品管理请求失败（${response.status}）`)}
  return response.json() as Promise<T>;
}
const base=(projectId:number)=>`/api/v1/factory-platform/projects/${projectId}/rfq-samples`;
const post=<T>(path:string,payload:Record<string,unknown>)=>request<T>(path,{method:"POST",body:JSON.stringify(payload)});
export const listRfqWorkspace=(projectId:number)=>request<RfqWorkspace>(base(projectId));
export const createRfqCase=(projectId:number,payload:Record<string,unknown>)=>post<RfqCase>(`${base(projectId)}/cases`,payload);
export const createRfqRequirement=(projectId:number,caseId:string,payload:Record<string,unknown>)=>post<RfqRequirement>(`${base(projectId)}/cases/${encodeURIComponent(caseId)}/requirements`,payload);
export const approveRfqRequirement=(projectId:number,id:string,payload:Record<string,unknown>)=>post<RfqRequirement>(`${base(projectId)}/requirements/${encodeURIComponent(id)}/approve`,payload);
export const createSampleTask=(projectId:number,caseId:string,payload:Record<string,unknown>)=>post<SampleTask>(`${base(projectId)}/cases/${encodeURIComponent(caseId)}/samples`,payload);
export const approveSampleTask=(projectId:number,id:string,payload:Record<string,unknown>)=>post<SampleTask>(`${base(projectId)}/samples/${encodeURIComponent(id)}/approve`,payload);
export const dispatchSampleTask=(projectId:number,id:string,payload:Record<string,unknown>)=>post<SampleTask>(`${base(projectId)}/samples/${encodeURIComponent(id)}/dispatch`,payload);
export const recordSampleFeedback=(projectId:number,id:string,payload:Record<string,unknown>)=>post<SampleFeedback>(`${base(projectId)}/samples/${encodeURIComponent(id)}/feedback`,payload);
export const acknowledgeSampleFeedback=(projectId:number,id:string,payload:Record<string,unknown>)=>post<SampleFeedback>(`${base(projectId)}/feedback/${encodeURIComponent(id)}/acknowledge`,payload);
