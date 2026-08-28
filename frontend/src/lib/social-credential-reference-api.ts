import { authApi } from "@/lib/auth";
import { getAPIBaseURL } from "@/lib/config";
export type SocialCredentialReferenceRecord={id:string;project_id:number;provider:string;status:string;scopes:string[];secret_configured:boolean};
export const socialCredentialReferenceApi={list:async(projectId:number)=>{let token=authApi.getStoredToken();if(!token&&await authApi.restoreLocalDemoSession("hq"))token=authApi.getStoredToken();const response=await fetch(`${getAPIBaseURL()}/api/v1/social-credential-references?project_id=${encodeURIComponent(projectId)}`,{headers:token?{Authorization:`Bearer ${token}`}:{}});if(!response.ok)throw new Error(`Social credential references API: ${response.status}`);return response.json() as Promise<{items:SocialCredentialReferenceRecord[]}>;}};
