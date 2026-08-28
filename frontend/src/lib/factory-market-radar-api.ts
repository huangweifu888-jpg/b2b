import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";

export type MarketScan={id:string;scan_number:string;product_reference:string;product_name:string;target_country:string;target_channel:string;objective:string;status:string;created_by:string;revision:number};
export type MarketSignal={id:string;signal_number:string;scan_id:string;signal_type:string;normalized_score:string;source_system:string;source_revision:string;source_hash:string;status:string;recorded_by:string;verified_by?:string|null;revision:number};
export type MarketDecision={id:string;decision_number:string;scan_id:string;input_hash:string;opportunity_score:string;entry_recommendation:string;entry_gate_note:string;status:string;revision:number};
export type MarketRelease={id:string;release_number:string;release_version:string;decision_id:string;manifest_hash:string;support_until:string;status:string;available:boolean;revision:number};
export type MarketRadarWorkspace={scans:MarketScan[];signals:MarketSignal[];decisions:MarketDecision[];releases:MarketRelease[];evidence:Array<{id:string;subject_type:string;evidence_type:string;evidence_reference:string;recorded_by:string}>;metrics:{market_scans:number;verified_signal_percent:number;approved_decisions:number;available_releases:number;latest_opportunity_score:string|null};availability:{application_id:string;status:"pilot"|"available";release_version:string|null;support_until:string|null};contract:Record<string,unknown>};

async function request<T>(path:string,init?:RequestInit):Promise<T>{
  let token=authApi.getStoredToken(); if(!token&&await authApi.restoreLocalDemoSession("hq"))token=authApi.getStoredToken();
  const headers=new Headers(init?.headers);headers.set("Content-Type","application/json");if(token)headers.set("Authorization",`Bearer ${token}`);
  let response=await fetch(`${getAPIBaseURL()}${path}`,{...init,headers});
  if(response.status===401&&await authApi.restoreLocalDemoSession("hq")){const restored=authApi.getStoredToken();if(restored)headers.set("Authorization",`Bearer ${restored}`);response=await fetch(`${getAPIBaseURL()}${path}`,{...init,headers});}
  if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(typeof body.detail==="string"?body.detail:`市场雷达请求失败（${response.status}）`);} return response.json() as Promise<T>;
}
const base=(projectId:number)=>`/api/v1/factory-platform/projects/${projectId}/market-radar`;
const post=<T>(path:string,payload:Record<string,unknown>)=>request<T>(path,{method:"POST",body:JSON.stringify(payload)});
export const listMarketRadar=(projectId:number)=>request<MarketRadarWorkspace>(base(projectId));
export const createMarketScan=(projectId:number,payload:Record<string,unknown>)=>post<MarketScan>(`${base(projectId)}/scans`,payload);
export const createMarketSignal=(projectId:number,scanId:string,payload:Record<string,unknown>)=>post<MarketSignal>(`${base(projectId)}/scans/${encodeURIComponent(scanId)}/signals`,payload);
export const verifyMarketSignal=(projectId:number,signalId:string,payload:Record<string,unknown>)=>post<MarketSignal>(`${base(projectId)}/signals/${encodeURIComponent(signalId)}/verify`,payload);
export const createMarketDecision=(projectId:number,scanId:string,payload:Record<string,unknown>)=>post<MarketDecision>(`${base(projectId)}/scans/${encodeURIComponent(scanId)}/decisions`,payload);
export const reviewMarketDecision=(projectId:number,decisionId:string,payload:Record<string,unknown>)=>post<MarketDecision>(`${base(projectId)}/decisions/${encodeURIComponent(decisionId)}/review`,payload);
export const prepareMarketRelease=(projectId:number,decisionId:string,payload:Record<string,unknown>)=>post<MarketRelease>(`${base(projectId)}/decisions/${encodeURIComponent(decisionId)}/releases`,payload);
export const approveMarketRelease=(projectId:number,releaseId:string,payload:Record<string,unknown>)=>post<MarketRelease>(`${base(projectId)}/releases/${encodeURIComponent(releaseId)}/approve`,payload);
