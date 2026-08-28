import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type ApprovalWorkflow={id:string;workflow_number:string;workflow_code:string;workflow_name:string;subject_type:string;status:"draft"|"active";current_version:number;authored_by:string;approved_by?:string|null;revision:number};
export type ApprovalRequest={id:string;request_number:string;request_reference:string;workflow_id:string;workflow_number:string;workflow_version:number;subject_type:string;subject_id:string;subject_number:string;subject_revision:number;subject_status_snapshot:string;business_reason:string;evidence_reference:string;status:"in-review"|"approved"|"rejected"|"returned";current_sequence:number;requested_by:string;requested_at:string;due_at:string;decided_at?:string|null;revision:number};
export type ApprovalStep={id:string;step_number:string;request_id:string;request_number:string;sequence:number;step_name:string;assignee_reference:string;status:string;due_at:string;acted_by?:string|null;acted_as_delegate:boolean;revision:number};
export type ApprovalAction={id:string;action_number:string;request_id:string;request_number:string;step_id?:string|null;sequence?:number|null;action:string;reason:string;evidence_reference:string;actor_reference:string;acting_for_reference?:string|null;channel:string;source_revision_verified:boolean;created_at:string};
export type ApprovalDelegation={id:string;delegation_number:string;workflow_id?:string|null;subject_type?:string|null;delegator_reference:string;delegate_reference:string;starts_at:string;ends_at:string;reason:string;evidence_reference:string;status:string;created_by:string;revision:number};
export type ApprovalHandoff={id:string;handoff_number:string;request_id:string;request_number:string;subject_type:string;subject_id:string;subject_number:string;subject_revision:number;status:"ready"|"acknowledged";created_by:string;acknowledged_by?:string|null;revision:number};
export type ApprovalSource={subject_type:string;id:string;number:string;status:string;revision:number};
export type ApprovalWorkspace={workflows:ApprovalWorkflow[];workflow_versions:Array<{id:string;workflow_id:string;version_number:number;steps_json:string;sla_hours:number;allow_delegation:boolean;status:string}>;requests:ApprovalRequest[];steps:ApprovalStep[];actions:ApprovalAction[];delegations:ApprovalDelegation[];handoffs:ApprovalHandoff[];eligible_sources:ApprovalSource[];evidence:Array<{id:string;subject_type:string;subject_id:string;evidence_type:string;evidence_reference:string;recorded_by:string}>;metrics:{active_workflows:number;pending_requests:number;median_approval_hours:number;overdue_rate_percent:number};contract:{domain_records_remain_authoritative:boolean;source_revision_pinned:boolean;requester_self_approval:boolean;ordered_steps:boolean;delegation_expands_permission:boolean;mobile_approval_lowers_assurance:boolean;final_approval_mutates_domain_record:boolean;domain_handoff_acknowledgement_required:boolean;supported_subject_types:string[]}};

async function request<T>(path:string,init?:RequestInit):Promise<T>{
  let token=authApi.getStoredToken();
  if(!token&&await authApi.restoreLocalDemoSession("hq"))token=authApi.getStoredToken();
  const headers=new Headers(init?.headers);headers.set("Content-Type","application/json");if(token)headers.set("Authorization",`Bearer ${token}`);
  let response=await fetch(`${getAPIBaseURL()}${path}`,{...init,headers});
  if(response.status===401&&await authApi.restoreLocalDemoSession("hq")){const restored=authApi.getStoredToken();if(restored)headers.set("Authorization",`Bearer ${restored}`);response=await fetch(`${getAPIBaseURL()}${path}`,{...init,headers});}
  if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(typeof body.detail==="string"?body.detail:`审批中心请求失败（${response.status}）`)}
  return response.json() as Promise<T>;
}
const base=(projectId:number)=>`/api/v1/factory-platform/projects/${projectId}/approval-center`;
const post=<T>(path:string,payload:Record<string,unknown>)=>request<T>(path,{method:"POST",body:JSON.stringify(payload)});
export const listApprovalWorkspace=(projectId:number)=>request<ApprovalWorkspace>(base(projectId));
export const createApprovalWorkflow=(projectId:number,payload:Record<string,unknown>)=>post<{workflow:ApprovalWorkflow;version:ApprovalWorkspace["workflow_versions"][number]}>(`${base(projectId)}/workflows`,payload);
export const approveApprovalWorkflow=(projectId:number,id:string,payload:Record<string,unknown>)=>post<ApprovalWorkflow>(`${base(projectId)}/workflows/${encodeURIComponent(id)}/approve`,payload);
export const createApprovalRequest=(projectId:number,payload:Record<string,unknown>)=>post<ApprovalRequest>(`${base(projectId)}/requests`,payload);
export const reviewApprovalRequest=(projectId:number,id:string,payload:Record<string,unknown>)=>post<ApprovalRequest>(`${base(projectId)}/requests/${encodeURIComponent(id)}/review`,payload);
export const createApprovalDelegation=(projectId:number,payload:Record<string,unknown>)=>post<ApprovalDelegation>(`${base(projectId)}/delegations`,payload);
export const acknowledgeApprovalHandoff=(projectId:number,id:string,payload:Record<string,unknown>)=>post<ApprovalHandoff>(`${base(projectId)}/handoffs/${encodeURIComponent(id)}/acknowledge`,payload);
