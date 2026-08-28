import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type LegalParty={id:string;party_number:string;party_reference:string;party_type:string;legal_name:string;country_code:string;identity_fingerprint:string;source_type:string;source_id:string;source_number:string;source_revision:number;status:string;authored_by:string;approved_by?:string|null;revision:number};
export type LegalTemplate={id:string;template_number:string;template_code:string;template_name:string;contract_type:string;current_version:number;status:string;authored_by:string;approved_by?:string|null;revision:number};
export type BusinessContract={id:string;contract_number:string;contract_reference:string;contract_type:string;party_id:string;party_number:string;party_revision:number;template_id:string;template_number:string;template_version:number;source_type:string;source_id:string;source_number:string;source_revision:number;approval_handoff_id:string;approval_handoff_number:string;currency:string;contract_value:string;effective_date:string;expiry_date:string;auto_renew:boolean;notice_days:number;status:string;authored_by:string;submitted_by?:string|null;approved_by?:string|null;revision:number};
export type LegalReview={id:string;review_number:string;contract_id:string;contract_number:string;risk_level:string;recommendation:string;legal_comment:string;reviewed_by:string};
export type SealAuthorization={id:string;seal_number:string;contract_id:string;contract_number:string;seal_type:string;document_hash:string;purpose:string;status:string;requested_by:string;approved_by?:string|null;used_by?:string|null;revision:number};
export type SignatureEnvelope={id:string;envelope_number:string;contract_id:string;contract_number:string;seal_authorization_id:string;provider_reference:string;provider_envelope_reference:string;signers_json:string;signatures_json:string;signed_document_reference:string;status:string;created_by:string;sent_by?:string|null;revision:number};
export type ContractObligation={id:string;obligation_number:string;obligation_reference:string;contract_id:string;contract_number:string;obligation_type:string;title:string;description:string;owner_reference:string;due_date:string;status:string;created_by:string;completed_by?:string|null;revision:number};
export type EligibleLegalSource={source_type:"cpq-quote"|"purchase-order";source_id:string;source_number:string;source_revision:number;status:string;party_reference:string;party_source_type:"cpq-quote"|"supplier";party_source_id:string;currency:string;value:string;approval_handoff_id:string;approval_handoff_number:string};
export type LegalWorkspace={parties:LegalParty[];templates:LegalTemplate[];template_versions:Array<{id:string;template_id:string;version_number:number;content_hash:string;status:string}>;contracts:BusinessContract[];reviews:LegalReview[];seal_authorizations:SealAuthorization[];signature_envelopes:SignatureEnvelope[];obligations:ContractObligation[];eligible_sources:EligibleLegalSource[];evidence:Array<{id:string;subject_type:string;subject_id:string;evidence_type:string;evidence_reference:string;recorded_by:string}>;metrics:{active_contracts:number;obligation_fulfillment_percent:number;overdue_obligations:number;expiring_90_days:number;duplicate_party_rate_percent:number};contract:{system_of_record:string;raw_registration_number_stored:boolean;template_versions_mutable:boolean;approval_center_handoff_required:boolean;source_revision_pinned:boolean;signature_private_keys_stored:boolean;seal_self_approval:boolean;legal_author_self_review:boolean;signature_completion_activates_contract:boolean;source_business_record_mutated:boolean;obligation_evidence_required:boolean}};

async function request<T>(path:string,init?:RequestInit):Promise<T>{
  let token=authApi.getStoredToken();
  if(!token&&await authApi.restoreLocalDemoSession("hq"))token=authApi.getStoredToken();
  const headers=new Headers(init?.headers);headers.set("Content-Type","application/json");if(token)headers.set("Authorization",`Bearer ${token}`);
  let response=await fetch(`${getAPIBaseURL()}${path}`,{...init,headers});
  if(response.status===401&&await authApi.restoreLocalDemoSession("hq")){const restored=authApi.getStoredToken();if(restored)headers.set("Authorization",`Bearer ${restored}`);response=await fetch(`${getAPIBaseURL()}${path}`,{...init,headers});}
  if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(typeof body.detail==="string"?body.detail:`合同法务请求失败（${response.status}）`)}
  return response.json() as Promise<T>;
}
const base=(projectId:number)=>`/api/v1/factory-platform/projects/${projectId}/contract-legal`;
const post=<T>(path:string,payload:Record<string,unknown>)=>request<T>(path,{method:"POST",body:JSON.stringify(payload)});

export const listLegalWorkspace=(projectId:number)=>request<LegalWorkspace>(base(projectId));
export const createLegalParty=(projectId:number,payload:Record<string,unknown>)=>post<LegalParty>(`${base(projectId)}/parties`,payload);
export const approveLegalParty=(projectId:number,id:string,payload:Record<string,unknown>)=>post<LegalParty>(`${base(projectId)}/parties/${encodeURIComponent(id)}/approve`,payload);
export const createLegalTemplate=(projectId:number,payload:Record<string,unknown>)=>post<{template:LegalTemplate}>(`${base(projectId)}/templates`,payload);
export const approveLegalTemplate=(projectId:number,id:string,payload:Record<string,unknown>)=>post<LegalTemplate>(`${base(projectId)}/templates/${encodeURIComponent(id)}/approve`,payload);
export const createBusinessContract=(projectId:number,payload:Record<string,unknown>)=>post<BusinessContract>(`${base(projectId)}/contracts`,payload);
export const submitBusinessContract=(projectId:number,id:string,payload:Record<string,unknown>)=>post<BusinessContract>(`${base(projectId)}/contracts/${encodeURIComponent(id)}/submit`,payload);
export const reviewBusinessContract=(projectId:number,id:string,payload:Record<string,unknown>)=>post<{contract:BusinessContract;review:LegalReview}>(`${base(projectId)}/contracts/${encodeURIComponent(id)}/review`,payload);
export const requestLegalSeal=(projectId:number,payload:Record<string,unknown>)=>post<SealAuthorization>(`${base(projectId)}/seals`,payload);
export const approveLegalSeal=(projectId:number,id:string,payload:Record<string,unknown>)=>post<SealAuthorization>(`${base(projectId)}/seals/${encodeURIComponent(id)}/approve`,payload);
export const useLegalSeal=(projectId:number,id:string,payload:Record<string,unknown>)=>post<SealAuthorization>(`${base(projectId)}/seals/${encodeURIComponent(id)}/use`,payload);
export const createSignatureEnvelope=(projectId:number,payload:Record<string,unknown>)=>post<SignatureEnvelope>(`${base(projectId)}/signatures`,payload);
export const sendSignatureEnvelope=(projectId:number,id:string,payload:Record<string,unknown>)=>post<SignatureEnvelope>(`${base(projectId)}/signatures/${encodeURIComponent(id)}/send`,payload);
export const recordLegalSignature=(projectId:number,id:string,payload:Record<string,unknown>)=>post<SignatureEnvelope>(`${base(projectId)}/signatures/${encodeURIComponent(id)}/record`,payload);
export const createContractObligation=(projectId:number,payload:Record<string,unknown>)=>post<ContractObligation>(`${base(projectId)}/obligations`,payload);
export const completeContractObligation=(projectId:number,id:string,payload:Record<string,unknown>)=>post<ContractObligation>(`${base(projectId)}/obligations/${encodeURIComponent(id)}/complete`,payload);
export const waiveContractObligation=(projectId:number,id:string,payload:Record<string,unknown>)=>post<ContractObligation>(`${base(projectId)}/obligations/${encodeURIComponent(id)}/waive`,payload);
