import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type ProductStudy = { id:string;study_number:string;product_reference:string;product_name:string;business_objective:string;base_currency:string;status:string;created_by:string;revision:number };
export type ProductSignal = { id:string;signal_number:string;study_id:string;study_number:string;signal_type:string;normalized_score:string;raw_value:string;measurement_unit:string;region:string;source_system:string;source_reference:string;source_revision:string;source_observed_at:string;source_hash:string;status:string;recorded_by:string;verified_by?:string|null;verification_reference?:string|null;revision:number };
export type ProductAssessment = { id:string;assessment_number:string;study_id:string;study_number:string;input_hash:string;opportunity_score:string;recommendation:string;assumptions:string;status:string;authored_by:string;reviewed_by?:string|null;review_reference?:string|null;review_note?:string|null;revision:number };
export type ProductAvailabilityRelease = { id:string;release_number:string;application_id:string;release_version:string;study_id:string;study_number:string;assessment_id:string;assessment_number:string;assessment_hash:string;manifest_hash:string;tenant_scope:string;region_scope_json:string[];connector_scope_json:string[];support_owner:string;support_until:string;end_to_end_demo_reference:string;role_training_reference:string;issue_closure_reference:string;pilot_report_reference:string;runtime_monitoring_reference:string;rollback_drill_reference:string;status:string;available:boolean;prepared_by:string;approved_by?:string|null;approval_reference?:string|null;revision:number };
export type ProductIntelligenceWorkspace = { studies:ProductStudy[];signals:ProductSignal[];assessments:ProductAssessment[];releases:ProductAvailabilityRelease[];evidence:Array<{id:string;subject_type:string;subject_id:string;evidence_type:string;evidence_reference:string;recorded_by:string}>;metrics:{studies:number;verified_signal_percent:number;approved_assessments:number;available_releases:number;latest_opportunity_score:string|null};availability:{application_id:string;status:"pilot"|"available";release_version:string|null;support_until:string|null};contract:Record<string,unknown> };

async function request<T>(path:string,init?:RequestInit):Promise<T>{
  let token=authApi.getStoredToken();
  if(!token&&await authApi.restoreLocalDemoSession("hq"))token=authApi.getStoredToken();
  const headers=new Headers(init?.headers);headers.set("Content-Type","application/json");if(token)headers.set("Authorization",`Bearer ${token}`);
  let response=await fetch(`${getAPIBaseURL()}${path}`,{...init,headers});
  if(response.status===401&&await authApi.restoreLocalDemoSession("hq")){const restored=authApi.getStoredToken();if(restored)headers.set("Authorization",`Bearer ${restored}`);response=await fetch(`${getAPIBaseURL()}${path}`,{...init,headers});}
  if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(typeof body.detail==="string"?body.detail:`产品分析请求失败（${response.status}）`);}
  return response.json() as Promise<T>;
}
const base=(projectId:number)=>`/api/v1/factory-platform/projects/${projectId}/product-intelligence`;
const post=<T>(path:string,payload:Record<string,unknown>)=>request<T>(path,{method:"POST",body:JSON.stringify(payload)});
export const listProductIntelligence=(projectId:number)=>request<ProductIntelligenceWorkspace>(base(projectId));
export const createProductStudy=(projectId:number,payload:Record<string,unknown>)=>post<ProductStudy>(`${base(projectId)}/studies`,payload);
export const createProductSignal=(projectId:number,studyId:string,payload:Record<string,unknown>)=>post<ProductSignal>(`${base(projectId)}/studies/${encodeURIComponent(studyId)}/signals`,payload);
export const verifyProductSignal=(projectId:number,signalId:string,payload:Record<string,unknown>)=>post<ProductSignal>(`${base(projectId)}/signals/${encodeURIComponent(signalId)}/verify`,payload);
export const createProductAssessment=(projectId:number,studyId:string,payload:Record<string,unknown>)=>post<ProductAssessment>(`${base(projectId)}/studies/${encodeURIComponent(studyId)}/assessments`,payload);
export const reviewProductAssessment=(projectId:number,assessmentId:string,payload:Record<string,unknown>)=>post<ProductAssessment>(`${base(projectId)}/assessments/${encodeURIComponent(assessmentId)}/review`,payload);
export const prepareProductRelease=(projectId:number,assessmentId:string,payload:Record<string,unknown>)=>post<ProductAvailabilityRelease>(`${base(projectId)}/assessments/${encodeURIComponent(assessmentId)}/releases`,payload);
export const approveProductRelease=(projectId:number,releaseId:string,payload:Record<string,unknown>)=>post<ProductAvailabilityRelease>(`${base(projectId)}/releases/${encodeURIComponent(releaseId)}/approve`,payload);
