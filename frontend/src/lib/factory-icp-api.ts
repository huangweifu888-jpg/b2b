import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type IcpProfile={id:string;profile_number:string;profile_code:string;profile_name:string;market_mode:string;customer_type:string;objective:string;current_version:number;status:string;authored_by:string;approved_by?:string|null;revision:number};
export type IcpVersion={id:string;profile_id:string;version_number:number;countries_json:string[];industries_json:string[];company_size_bands_json:string[];product_references_json:string[];required_roles_json:string[];buying_triggers_json:string[];minimum_potential_value:string;currency:string;scoring_weights_json:Record<string,number>;definition_hash:string;status:string};
export type IcpRole={id:string;role_number:string;profile_id:string;role_code:string;role_name:string;influence_type:string;pains_json:string[];proof_requirements_json:string[];preferred_channels_json:string[]};
export type IcpScenario={id:string;scenario_number:string;profile_id:string;scenario_code:string;scenario_name:string;job_to_be_done:string;buying_trigger:string;product_references_json:string[];success_outcomes_json:string[];disqualifiers_json:string[]};
export type IcpAccountEvidence={id:string;evidence_number:string;profile_id:string;account_reference:string;source_type:string;source_id:string;source_number:string;source_revision:number;source_status:string;firmographic_country?:string|null;firmographic_industry?:string|null;firmographic_company_size?:string|null;observed_roles_json:string[];observed_triggers_json:string[];observed_products_json:string[];potential_value:string;currency:string;verification_status:string;captured_by:string;verified_by?:string|null;revision:number};
export type IcpAssessment={id:string;assessment_number:string;profile_id:string;profile_version:number;definition_hash:string;account_evidence_id:string;account_reference:string;score_components_json:Record<string,{matched:boolean;weight:number;score:number}>;total_score:string;fit_tier:string;explanation:string;status:string;assessed_by:string;verified_by?:string|null;revision:number};
export type IcpActivation={id:string;activation_number:string;profile_id:string;profile_version:number;definition_hash:string;consumer:string;minimum_fit_tier:string;delivery_reference:string;status:string;created_by:string;acknowledged_by?:string|null;revision:number};
export type IcpAuthoritativeSource={source_type:"cpq-quote"|"fulfillment-order"|"customer-asset"|"voice-of-customer";source_id:string;source_number:string;account_reference:string;status:string;revision:number;currency:string;value:string;products:string[];captured_profile_ids:string[]};
export type IcpWorkspace={profiles:IcpProfile[];versions:IcpVersion[];buying_roles:IcpRole[];scenarios:IcpScenario[];account_evidence:IcpAccountEvidence[];fit_assessments:IcpAssessment[];activations:IcpActivation[];authoritative_sources:IcpAuthoritativeSource[];evidence:Array<{id:string;subject_type:string;subject_id:string;evidence_type:string;reference:string;recorded_by:string}>;metrics:{active_icps:number;assessed_accounts:number;high_fit_rate_percent:number;verified_evidence_coverage_percent:number;buying_role_coverage:number;activation_acknowledgement_percent:number};contract:Record<string,boolean>};

async function request<T>(path:string,init?:RequestInit):Promise<T>{
  let token=authApi.getStoredToken();
  if(!token&&await authApi.restoreLocalDemoSession("hq"))token=authApi.getStoredToken();
  const headers=new Headers(init?.headers);headers.set("Content-Type","application/json");if(token)headers.set("Authorization",`Bearer ${token}`);
  let response=await fetch(`${getAPIBaseURL()}${path}`,{...init,headers});
  if(response.status===401&&await authApi.restoreLocalDemoSession("hq")){const restored=authApi.getStoredToken();if(restored)headers.set("Authorization",`Bearer ${restored}`);response=await fetch(`${getAPIBaseURL()}${path}`,{...init,headers});}
  if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(typeof body.detail==="string"?body.detail:`ICP客户定位请求失败（${response.status}）`)}
  return response.json() as Promise<T>;
}
const base=(projectId:number)=>`/api/v1/factory-platform/projects/${projectId}/icp-profiles`;
const post=<T>(path:string,payload:Record<string,unknown>)=>request<T>(path,{method:"POST",body:JSON.stringify(payload)});

export const listIcpWorkspace=(projectId:number)=>request<IcpWorkspace>(base(projectId));
export const createIcpProfile=(projectId:number,payload:Record<string,unknown>)=>post<{profile:IcpProfile;version:IcpVersion}>(base(projectId),payload);
export const addIcpRole=(projectId:number,profileId:string,payload:Record<string,unknown>)=>post<IcpRole>(`${base(projectId)}/${encodeURIComponent(profileId)}/roles`,payload);
export const addIcpScenario=(projectId:number,profileId:string,payload:Record<string,unknown>)=>post<IcpScenario>(`${base(projectId)}/${encodeURIComponent(profileId)}/scenarios`,payload);
export const approveIcpProfile=(projectId:number,profileId:string,payload:Record<string,unknown>)=>post<IcpProfile>(`${base(projectId)}/${encodeURIComponent(profileId)}/approve`,payload);
export const captureIcpEvidence=(projectId:number,profileId:string,payload:Record<string,unknown>)=>post<IcpAccountEvidence>(`${base(projectId)}/${encodeURIComponent(profileId)}/account-evidence`,payload);
export const verifyIcpEvidence=(projectId:number,evidenceId:string,payload:Record<string,unknown>)=>post<IcpAccountEvidence>(`${base(projectId)}/account-evidence/${encodeURIComponent(evidenceId)}/verify`,payload);
export const assessIcpFit=(projectId:number,profileId:string,payload:Record<string,unknown>)=>post<IcpAssessment>(`${base(projectId)}/${encodeURIComponent(profileId)}/assessments`,payload);
export const verifyIcpAssessment=(projectId:number,assessmentId:string,payload:Record<string,unknown>)=>post<IcpAssessment>(`${base(projectId)}/assessments/${encodeURIComponent(assessmentId)}/verify`,payload);
export const createIcpActivation=(projectId:number,profileId:string,payload:Record<string,unknown>)=>post<IcpActivation>(`${base(projectId)}/${encodeURIComponent(profileId)}/activations`,payload);
export const acknowledgeIcpActivation=(projectId:number,activationId:string,payload:Record<string,unknown>)=>post<IcpActivation>(`${base(projectId)}/activations/${encodeURIComponent(activationId)}/acknowledge`,payload);
export const retireIcpProfile=(projectId:number,profileId:string,payload:Record<string,unknown>)=>post<IcpProfile>(`${base(projectId)}/${encodeURIComponent(profileId)}/retire`,payload);
