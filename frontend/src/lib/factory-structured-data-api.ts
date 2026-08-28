import {authApi} from "@/lib/auth";
import {getAPIBaseURL} from "@/lib/config";

export type StructuredBundle={id:string;bundle_number:string;bundle_code:string;bundle_name:string;target_site_reference:string;default_locale:string;graph_id:string;graph_number:string;graph_version_id:string;graph_version_number:number;graph_manifest_hash:string;status:string;authored_by:string;published_by?:string|null;revision:number};
export type StructuredMapping={id:string;mapping_number:string;bundle_id:string;schema_type:string;source_entity_type:string;source_entity_id:string;source_entity_number:string;source_entity_revision:number;source_entity_fingerprint:string;field_map_json:Record<string,string>;required_fields_json:string[];status:string;created_by:string;verified_by?:string|null;revision:number};
export type StructuredValidation={id:string;validation_number:string;bundle_id:string;graph_manifest_hash:string;mapping_count:number;error_count:number;warning_count:number;report_json:Record<string,unknown>;generated_document_json:Record<string,unknown>;generated_hash:string;status:string;executed_by:string};
export type StructuredRelease={id:string;release_number:string;bundle_id:string;validation_id:string;validation_number:string;version_number:number;document_json:Record<string,unknown>;document_hash:string;schema_types_json:string[];status:string;published_by:string};
export type StructuredPublication={id:string;publication_number:string;bundle_id:string;release_id:string;release_number:string;document_hash:string;consumer:string;deployment_reference:string;consumer_mutated:boolean;status:string;created_by:string;acknowledged_by?:string|null;revision:number};
export type StructuredGraphVersion={id:string;version_reference:string;graph_id:string;graph_number:string;version_number:number;manifest_hash:string;entity_type_coverage:string[]};
export type StructuredWorkspace={bundles:StructuredBundle[];mappings:StructuredMapping[];validations:StructuredValidation[];releases:StructuredRelease[];publications:StructuredPublication[];evidence:Array<{id:string;subject_type:string;subject_id:string;evidence_type:string;evidence_reference:string;recorded_by:string}>;graph_versions:StructuredGraphVersion[];graph_entities:Array<{id:string;entity_number:string;graph_id:string;entity_type:string;canonical_name:string;source_fingerprint:string}>;metrics:{verified_mappings:number;schema_coverage_percent:number;passed_validations:number;validation_pass_percent:number;published_releases:number;publication_acknowledgement_percent:number};contract:Record<string,boolean>};

async function request<T>(path:string,init?:RequestInit):Promise<T>{
  let token=authApi.getStoredToken();
  if(!token&&await authApi.restoreLocalDemoSession("hq"))token=authApi.getStoredToken();
  const headers=new Headers(init?.headers);headers.set("Content-Type","application/json");if(token)headers.set("Authorization",`Bearer ${token}`);
  let response=await fetch(`${getAPIBaseURL()}${path}`,{...init,headers});
  if(response.status===401&&await authApi.restoreLocalDemoSession("hq")){const restored=authApi.getStoredToken();if(restored)headers.set("Authorization",`Bearer ${restored}`);response=await fetch(`${getAPIBaseURL()}${path}`,{...init,headers});}
  if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(typeof body.detail==="string"?body.detail:`结构化数据请求失败（${response.status}）`)}
  return response.json() as Promise<T>;
}
const base=(projectId:number)=>`/api/v1/factory-platform/projects/${projectId}/structured-data`;
const post=<T>(path:string,payload:Record<string,unknown>)=>request<T>(path,{method:"POST",body:JSON.stringify(payload)});
export const listStructuredWorkspace=(projectId:number)=>request<StructuredWorkspace>(base(projectId));
export const createStructuredBundle=(projectId:number,payload:Record<string,unknown>)=>post<StructuredBundle>(`${base(projectId)}/bundles`,payload);
export const addStructuredMapping=(projectId:number,bundleId:string,payload:Record<string,unknown>)=>post<StructuredMapping>(`${base(projectId)}/bundles/${encodeURIComponent(bundleId)}/mappings`,payload);
export const verifyStructuredMapping=(projectId:number,mappingId:string,payload:Record<string,unknown>)=>post<StructuredMapping>(`${base(projectId)}/mappings/${encodeURIComponent(mappingId)}/verify`,payload);
export const validateStructuredBundle=(projectId:number,bundleId:string,payload:Record<string,unknown>)=>post<StructuredValidation>(`${base(projectId)}/bundles/${encodeURIComponent(bundleId)}/validate`,payload);
export const publishStructuredBundle=(projectId:number,bundleId:string,payload:Record<string,unknown>)=>post<{bundle:StructuredBundle;release:StructuredRelease;publication:StructuredPublication}>(`${base(projectId)}/bundles/${encodeURIComponent(bundleId)}/publish`,payload);
export const acknowledgeStructuredPublication=(projectId:number,publicationId:string,payload:Record<string,unknown>)=>post<StructuredPublication>(`${base(projectId)}/publications/${encodeURIComponent(publicationId)}/acknowledge`,payload);
