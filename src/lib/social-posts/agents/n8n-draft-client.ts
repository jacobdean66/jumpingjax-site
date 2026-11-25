import "server-only";
import { randomUUID } from "node:crypto";
import type { LlmJsonClient } from "./llm-json-client";
import type { SocialAgentStage } from "@/lib/agent-manager/social-run";

export class SocialDraftWorkerUnconfirmed extends Error {}

export const SOCIAL_DRAFT_THUNDER_MODEL = "deepseek-coder-v2:16b";

export function socialDraftModelClient(runId: string, stage: SocialAgentStage, observed: (executionId: string, model: string) => void): LlmJsonClient {
  const endpoint=process.env.SOCIAL_DRAFT_N8N_URL;
  const credential=process.env.SOCIAL_DRAFT_N8N_BEARER;
  let url: URL | undefined;
  try {
    const target=new URL(endpoint??"");
    if(target.protocol==="https:" && target.pathname.endsWith("/webhook/jjx-social-draft-model-v1") &&
      !target.username&&!target.password&&!target.search&&!target.hash) url=target;
  }catch{}
  const configured=!!url&&!!credential&&/^[A-Za-z0-9._~-]{32,256}$/.test(credential);
  return {
    isConfigured:()=>configured,
    getConfiguredModel:()=>configured?SOCIAL_DRAFT_THUNDER_MODEL:null,
    async completeJson(input){
      const requestId=input.requestId??randomUUID();
      if(!configured||!url)throw new Error("The authenticated Social Posts draft worker is not configured.");
      if(input.system.length+input.user.length>12000)throw new Error("The draft model input exceeded its allowed size.");
      try {
        const response=await fetch(url,{method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(100000),
          headers:{"content-type":"application/json",Authorization:"Bearer "+credential},
          body:JSON.stringify({runId,stage,requestId,model:SOCIAL_DRAFT_THUNDER_MODEL,system:input.system,user:input.user,
            maxTokens:Math.min(input.maxOutputTokens??1200,1200)})});
        if(!response.ok)throw new Error("Unsuccessful response");
        const result=await response.json();
        if(result.requestId!==requestId||result.model!==SOCIAL_DRAFT_THUNDER_MODEL||
          !/^\d{1,30}$/.test(result.executionId??"")||typeof result.text!=="string"||result.text.length>24000)
          throw new Error("Unverified response");
        observed(result.executionId,result.model);
        return {ok:true,parsed:JSON.parse(result.text),rawText:result.text,model:result.model,
          provider:"n8n-thunder",requestId,truncatedInput:false,timedOut:false};
      } catch {
        throw new SocialDraftWorkerUnconfirmed("The n8n draft worker did not confirm a valid result. Check its execution and Agent Manager before retrying.");
      }
    },
  };
}
