import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type FinanceBook = { id:string; book_number:string; book_reference:string; book_code:string; book_name:string; operating_unit_id:string; unit_number:string; base_currency:string; accounting_basis:string; status:"draft"|"active"; authored_by:string; approval_reference?:string|null; approved_by?:string|null; revision:number };
export type FinanceAccount = { id:string; account_number:string; book_id:string; book_number:string; account_code:string; account_name:string; account_type:string; normal_side:"debit"|"credit"; system_role:string; status:string };
export type FinancePeriod = { id:string; period_number:string; period_reference:string; book_id:string; book_number:string; period_code:string; period_start:string; period_end:string; currency:string; total_debit:string; total_credit:string; journal_count:number; status:"open"|"closing"|"closed"; opened_by:string; close_submitted_by?:string|null; closed_by?:string|null; revision:number };
export type FinanceDocument = { id:string; document_number:string; document_reference:string; document_type:"ar-invoice"|"ap-bill"|"cash-receipt"|"cash-payment"|"budget"; book_id:string; book_number:string; period_id:string; period_number:string; document_date:string; due_date?:string|null; source_type:string; source_id?:string|null; source_number?:string|null; source_revision?:number|null; settlement_of_document_id?:string|null; counterparty_reference:string; currency:string; amount:string; settled_amount:string; description:string; source_evidence_reference:string; status:"draft"|"approved"|"posted"|"partially-settled"|"settled"; authored_by:string; approved_by?:string|null; revision:number };
export type FinanceJournal = { id:string; journal_number:string; book_id:string; period_id:string; document_id:string; document_number:string; journal_date:string; currency:string; total_debit:string; total_credit:string; description:string; status:string; prepared_by:string; approved_by:string; approval_reference:string; posted_at:string; revision:number };
export type FinanceJournalLine = { id:string; journal_id:string; journal_number:string; line_sequence:number; account_id:string; account_code:string; side:"debit"|"credit"; amount:string; counterparty_reference:string; memo:string };
export type FinanceBalance = { id:string; balance_number:string; period_id:string; period_number:string; account_id:string; account_code:string; account_type:string; debit:string; credit:string; net_balance:string; line_count:number };
export type FinanceSource = { id:string; number:string; order_number?:string; counterparty_reference:string; currency:string; amount:string; revision:number };
export type FinanceWorkspace = { books:FinanceBook[]; accounts:FinanceAccount[]; periods:FinancePeriod[]; documents:FinanceDocument[]; journals:FinanceJournal[]; journal_lines:FinanceJournalLine[]; balances:FinanceBalance[]; operating_units:Array<{id:string;unit_number:string;unit_code:string;unit_name:string;base_currency:string;status:string}>; eligible_ar_sources:FinanceSource[]; eligible_ap_sources:FinanceSource[]; contract:{ledger_classification:string;double_entry_required:boolean;posted_journals_mutable:boolean;oms_order_authority:boolean;procurement_authority:boolean;engineering_standard_cost_authority:boolean;period_close_independent:boolean} };

async function request<T>(path:string, init?:RequestInit):Promise<T>{
  let token=authApi.getStoredToken(); if(!token&&await authApi.restoreLocalDemoSession("hq")) token=authApi.getStoredToken();
  const headers=new Headers(init?.headers); headers.set("Content-Type","application/json"); if(token) headers.set("Authorization",`Bearer ${token}`);
  let response=await fetch(`${getAPIBaseURL()}${path}`,{...init,headers});
  if(response.status===401&&await authApi.restoreLocalDemoSession("hq")){const restored=authApi.getStoredToken();if(restored)headers.set("Authorization",`Bearer ${restored}`);response=await fetch(`${getAPIBaseURL()}${path}`,{...init,headers});}
  if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(typeof body.detail==="string"?body.detail:`财务资金中心请求失败（${response.status}）`);}
  return response.json() as Promise<T>;
}
const base=(projectId:number)=>`/api/v1/factory-platform/projects/${projectId}/finance`;
const post=<T>(path:string,payload:Record<string,unknown>)=>request<T>(path,{method:"POST",body:JSON.stringify(payload)});
export const listFinanceWorkspace=(projectId:number)=>request<FinanceWorkspace>(base(projectId));
export const createFinanceBook=(projectId:number,payload:Record<string,unknown>)=>post<FinanceBook>(`${base(projectId)}/books`,payload);
export const approveFinanceBook=(projectId:number,id:string,payload:Record<string,unknown>)=>post<FinanceBook>(`${base(projectId)}/books/${encodeURIComponent(id)}/approve`,payload);
export const openFinancePeriod=(projectId:number,payload:Record<string,unknown>)=>post<FinancePeriod>(`${base(projectId)}/periods`,payload);
export const createFinanceDocument=(projectId:number,payload:Record<string,unknown>)=>post<FinanceDocument>(`${base(projectId)}/documents`,payload);
export const approveFinanceDocument=(projectId:number,id:string,payload:Record<string,unknown>)=>post<FinanceDocument>(`${base(projectId)}/documents/${encodeURIComponent(id)}/approve`,payload);
export const submitFinancePeriodClose=(projectId:number,id:string,payload:Record<string,unknown>)=>post<FinancePeriod>(`${base(projectId)}/periods/${encodeURIComponent(id)}/submit-close`,payload);
export const closeFinancePeriod=(projectId:number,id:string,payload:Record<string,unknown>)=>post<FinancePeriod>(`${base(projectId)}/periods/${encodeURIComponent(id)}/close`,payload);
