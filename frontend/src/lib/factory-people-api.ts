import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type PeopleOrgUnit = { id:string; unit_number:string; unit_reference:string; unit_code:string; unit_name:string; unit_type:string; parent_unit_id?:string|null; erp_operating_unit_id?:string|null; country_code:string; timezone_name:string; status:"draft"|"active"; authored_by:string; approved_by?:string|null; revision:number };
export type PeoplePosition = { id:string; position_number:string; position_reference:string; position_code:string; position_title:string; org_unit_id:string; org_unit_number:string; job_family:string; employment_level:string; planned_headcount:number; weekly_capacity_hours:string; critical_role:boolean; status:string; revision:number };
export type PeopleEmployee = { id:string; employee_number:string; employee_reference:string; preferred_name:string; work_email:string; country_code:string; source_type:string; source_reference:string; privacy_notice_reference:string; status:"draft"|"active"; authored_by:string; activated_by?:string|null; revision:number };
export type PeopleContract = { id:string; contract_number:string; contract_reference:string; employee_id:string; employee_number:string; position_id:string; position_number:string; employment_type:string; work_location:string; start_date:string; end_date?:string|null; weekly_hours:string; compensation_band:string; payroll_reference:string; signed_document_reference:string; status:"draft"|"pending-approval"|"active"; authored_by:string; submitted_by?:string|null; approved_by?:string|null; revision:number };
export type PeopleTimeRecord = { id:string; time_number:string; employee_id:string; employee_number:string; period_code:string; scheduled_hours:string; worked_hours:string; approved_absence_hours:string; overtime_hours:string; source_reference:string; status:"draft"|"submitted"|"approved"; authored_by:string; submitted_by?:string|null; approved_by?:string|null; revision:number };
export type PeoplePerformanceReview = { id:string; review_number:string; employee_id:string; employee_number:string; position_id:string; position_number:string; cycle_code:string; goals_score:string; competency_score:string; overall_score:string; evidence_reference:string; manager_comment:string; status:"draft"|"calibrated"; authored_by:string; calibrated_by?:string|null; revision:number };
export type PeopleTrainingRecord = { id:string; training_number:string; employee_id:string; employee_number:string; course_code:string; course_title:string; mandatory:boolean; assigned_at:string; due_date:string; completed_at?:string|null; completion_evidence_reference?:string|null; expires_at?:string|null; status:"assigned"|"completed"|"verified"; assigned_by:string; completed_by?:string|null; verified_by?:string|null; revision:number };
export type PeopleWorkspace = {
  org_units:PeopleOrgUnit[]; positions:PeoplePosition[]; employees:PeopleEmployee[]; contracts:PeopleContract[];
  time_records:PeopleTimeRecord[]; performance_reviews:PeoplePerformanceReview[]; training_records:PeopleTrainingRecord[];
  evidence:Array<{id:string;evidence_number:string;subject_type:string;subject_id:string;evidence_type:string;evidence_reference:string;note:string;recorded_by:string;created_at:string}>;
  eligible_erp_units:Array<{id:string;unit_number:string;unit_code:string;unit_name:string;base_currency:string}>;
  metrics:{active_headcount:number;planned_headcount:number;critical_role_fill_rate:string;mandatory_training_compliance:string};
  contract:{system_of_record:string;marketing_contact_import:boolean;customer_profile_import:boolean;raw_bank_tax_health_data_stored:boolean;payroll_amount_authority:boolean;employment_lifecycle_authority:boolean;independent_master_activation:boolean;independent_contract_approval:boolean;independent_time_approval:boolean;independent_performance_calibration:boolean;independent_training_verification:boolean};
};

async function request<T>(path:string, init?:RequestInit):Promise<T>{
  let token=authApi.getStoredToken();
  if(!token&&await authApi.restoreLocalDemoSession("hq")) token=authApi.getStoredToken();
  const headers=new Headers(init?.headers); headers.set("Content-Type","application/json");
  if(token) headers.set("Authorization",`Bearer ${token}`);
  let response=await fetch(`${getAPIBaseURL()}${path}`,{...init,headers});
  if(response.status===401&&await authApi.restoreLocalDemoSession("hq")){
    const restored=authApi.getStoredToken(); if(restored) headers.set("Authorization",`Bearer ${restored}`);
    response=await fetch(`${getAPIBaseURL()}${path}`,{...init,headers});
  }
  if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(typeof body.detail==="string"?body.detail:`HR人事中心请求失败（${response.status}）`);}
  return response.json() as Promise<T>;
}
const base=(projectId:number)=>`/api/v1/factory-platform/projects/${projectId}/people`;
const post=<T>(path:string,payload:Record<string,unknown>)=>request<T>(path,{method:"POST",body:JSON.stringify(payload)});
export const listPeopleWorkspace=(projectId:number)=>request<PeopleWorkspace>(base(projectId));
export const createPeopleOrgUnit=(projectId:number,payload:Record<string,unknown>)=>post<PeopleOrgUnit>(`${base(projectId)}/org-units`,payload);
export const approvePeopleOrgUnit=(projectId:number,id:string,payload:Record<string,unknown>)=>post<PeopleOrgUnit>(`${base(projectId)}/org-units/${encodeURIComponent(id)}/approve`,payload);
export const createPeoplePosition=(projectId:number,payload:Record<string,unknown>)=>post<PeoplePosition>(`${base(projectId)}/positions`,payload);
export const createPeopleEmployee=(projectId:number,payload:Record<string,unknown>)=>post<PeopleEmployee>(`${base(projectId)}/employees`,payload);
export const activatePeopleEmployee=(projectId:number,id:string,payload:Record<string,unknown>)=>post<PeopleEmployee>(`${base(projectId)}/employees/${encodeURIComponent(id)}/activate`,payload);
export const createPeopleContract=(projectId:number,payload:Record<string,unknown>)=>post<PeopleContract>(`${base(projectId)}/contracts`,payload);
export const submitPeopleContract=(projectId:number,id:string,payload:Record<string,unknown>)=>post<PeopleContract>(`${base(projectId)}/contracts/${encodeURIComponent(id)}/submit`,payload);
export const approvePeopleContract=(projectId:number,id:string,payload:Record<string,unknown>)=>post<PeopleContract>(`${base(projectId)}/contracts/${encodeURIComponent(id)}/approve`,payload);
export const createPeopleTimeRecord=(projectId:number,payload:Record<string,unknown>)=>post<PeopleTimeRecord>(`${base(projectId)}/time-records`,payload);
export const submitPeopleTimeRecord=(projectId:number,id:string,payload:Record<string,unknown>)=>post<PeopleTimeRecord>(`${base(projectId)}/time-records/${encodeURIComponent(id)}/submit`,payload);
export const approvePeopleTimeRecord=(projectId:number,id:string,payload:Record<string,unknown>)=>post<PeopleTimeRecord>(`${base(projectId)}/time-records/${encodeURIComponent(id)}/approve`,payload);
export const createPeoplePerformanceReview=(projectId:number,payload:Record<string,unknown>)=>post<PeoplePerformanceReview>(`${base(projectId)}/performance-reviews`,payload);
export const calibratePeoplePerformanceReview=(projectId:number,id:string,payload:Record<string,unknown>)=>post<PeoplePerformanceReview>(`${base(projectId)}/performance-reviews/${encodeURIComponent(id)}/calibrate`,payload);
export const assignPeopleTraining=(projectId:number,payload:Record<string,unknown>)=>post<PeopleTrainingRecord>(`${base(projectId)}/training`,payload);
export const completePeopleTraining=(projectId:number,id:string,payload:Record<string,unknown>)=>post<PeopleTrainingRecord>(`${base(projectId)}/training/${encodeURIComponent(id)}/complete`,payload);
export const verifyPeopleTraining=(projectId:number,id:string,payload:Record<string,unknown>)=>post<PeopleTrainingRecord>(`${base(projectId)}/training/${encodeURIComponent(id)}/verify`,payload);
