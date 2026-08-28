import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type ErpOperatingUnit = { id:string; unit_number:string; unit_reference:string; unit_code:string; unit_name:string; unit_type:string; base_currency:string; manager:string; status:"draft"|"active"; authored_by:string; approval_reference?:string|null; approved_by?:string|null; approved_at?:string|null; revision:number };
export type ErpCostCenter = { id:string; center_number:string; center_reference:string; center_code:string; center_name:string; center_type:string; operating_unit_id:string; unit_number:string; owner:string; status:string; revision:number };
export type ErpOrderProject = { id:string; erp_project_number:string; project_reference:string; operating_unit_id:string; unit_number:string; order_id:string; order_number:string; order_revision:number; account_reference:string; currency:string; order_total:string; status:string; registered_by:string; registered_at:string; revision:number };
export type ErpPeriod = { id:string; period_number:string; period_reference:string; operating_unit_id:string; unit_number:string; period_code:string; period_start:string; period_end:string; currency:string; total_inflow:string; total_outflow:string; net_result:string; posting_count:number; status:"open"|"closing"|"closed"; opened_by:string; close_submitted_by?:string|null; close_evidence_reference?:string|null; closed_by?:string|null; closed_at?:string|null; revision:number };
export type ErpPosting = { id:string; posting_number:string; posting_reference:string; period_id:string; period_number:string; order_project_id:string; erp_project_number:string; cost_center_id:string; center_number:string; posting_date:string; category:string; direction:"inflow"|"outflow"; currency:string; amount:string; description:string; evidence_reference:string; correction_of_posting_id?:string|null; status:"draft"|"pending-approval"|"posted"; authored_by:string; submitted_by?:string|null; approval_reference?:string|null; approved_by?:string|null; posted_at?:string|null; revision:number };
export type ErpBalance = { id:string; balance_number:string; period_id:string; period_number:string; order_project_id:string; erp_project_number:string; cost_center_id:string; center_number:string; currency:string; inflow:string; outflow:string; net_result:string; posting_count:number };
export type ErpWorkspace = { operating_units:ErpOperatingUnit[]; cost_centers:ErpCostCenter[]; order_projects:ErpOrderProject[]; periods:ErpPeriod[]; postings:ErpPosting[]; balances:ErpBalance[]; evidence:Array<Record<string,unknown>>; eligible_orders:Array<{id:string;order_number:string;account_reference:string;currency:string;order_total:string;status:string;revision:number;registered:boolean}>; contract:{ledger_classification:string;formal_financial_general_ledger:boolean;oms_order_authority:boolean;order_confirmation_writeback:boolean;posted_records_mutable:boolean;historical_recalculation:boolean;period_close_independent:boolean} };

async function request<T>(path:string, init?:RequestInit):Promise<T>{
  let token=authApi.getStoredToken(); if(!token&&await authApi.restoreLocalDemoSession("hq")) token=authApi.getStoredToken();
  const headers=new Headers(init?.headers); headers.set("Content-Type","application/json"); if(token) headers.set("Authorization",`Bearer ${token}`);
  let response=await fetch(`${getAPIBaseURL()}${path}`,{...init,headers});
  if(response.status===401&&await authApi.restoreLocalDemoSession("hq")){const restored=authApi.getStoredToken();if(restored)headers.set("Authorization",`Bearer ${restored}`);response=await fetch(`${getAPIBaseURL()}${path}`,{...init,headers});}
  if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(typeof body.detail==="string"?body.detail:`ERP经营总台请求失败（${response.status}）`);}
  return response.json() as Promise<T>;
}
const base=(projectId:number)=>`/api/v1/factory-platform/projects/${projectId}/erp`;
const post=<T>(path:string,payload:Record<string,unknown>)=>request<T>(path,{method:"POST",body:JSON.stringify(payload)});
export const listErpWorkspace=(projectId:number)=>request<ErpWorkspace>(base(projectId));
export const createErpUnit=(projectId:number,payload:Record<string,unknown>)=>post<ErpOperatingUnit>(`${base(projectId)}/operating-units`,payload);
export const approveErpUnit=(projectId:number,id:string,payload:Record<string,unknown>)=>post<ErpOperatingUnit>(`${base(projectId)}/operating-units/${encodeURIComponent(id)}/approve`,payload);
export const createErpCostCenter=(projectId:number,payload:Record<string,unknown>)=>post<ErpCostCenter>(`${base(projectId)}/cost-centers`,payload);
export const registerErpOrderProject=(projectId:number,payload:Record<string,unknown>)=>post<ErpOrderProject>(`${base(projectId)}/order-projects`,payload);
export const openErpPeriod=(projectId:number,payload:Record<string,unknown>)=>post<ErpPeriod>(`${base(projectId)}/periods`,payload);
export const createErpPosting=(projectId:number,payload:Record<string,unknown>)=>post<ErpPosting>(`${base(projectId)}/postings`,payload);
export const submitErpPosting=(projectId:number,id:string,payload:Record<string,unknown>)=>post<ErpPosting>(`${base(projectId)}/postings/${encodeURIComponent(id)}/submit`,payload);
export const approveErpPosting=(projectId:number,id:string,payload:Record<string,unknown>)=>post<ErpPosting>(`${base(projectId)}/postings/${encodeURIComponent(id)}/approve`,payload);
export const submitErpPeriodClose=(projectId:number,id:string,payload:Record<string,unknown>)=>post<{period:ErpPeriod;balances:ErpBalance[]}>(`${base(projectId)}/periods/${encodeURIComponent(id)}/submit-close`,payload);
export const closeErpPeriod=(projectId:number,id:string,payload:Record<string,unknown>)=>post<ErpPeriod>(`${base(projectId)}/periods/${encodeURIComponent(id)}/close`,payload);
