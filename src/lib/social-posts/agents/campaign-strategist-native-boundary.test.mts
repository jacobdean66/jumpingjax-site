import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCampaignStrategistRequestPayload,
  buildDeterministicCampaignStrategistPlan,
  requireNativeStrategistOutput,
  runCampaignStrategistAgent,
} from "./campaign-strategist-agent";
import type { LlmJsonClient } from "./llm-json-client";

const input = {goal:"Internal QA fixture",platform:"facebook",mediaType:"image",businessFocus:"facility-parties"} as const;
function client(parsed:unknown,provider:"n8n-thunder"|"openai"="n8n-thunder"):LlmJsonClient {
  return {
    isConfigured:()=>true, getConfiguredModel:()=>"fixture-model",
    async completeJson(args) {
      return {ok:true,parsed,rawText:JSON.stringify(parsed),model:"fixture-model",provider,
        requestId:args.requestId??"fixture",truncatedInput:false,timedOut:false};
    },
  };
}
test("valid transport with missing campaignObjective fails the native stage without another model call",async()=>{
  let calls=0;
  const {campaignObjective: _unused,...missing}=buildDeterministicCampaignStrategistPlan(input);
  const result=await runCampaignStrategistAgent(input,{client:client(missing),onModelCall:()=>calls++});
  assert.equal(calls,1);
  assert.equal(result.diagnostics.failureKind,"schema_failure");
  assert.match(result.diagnostics.fallbackReason??"",/campaignObjective/);
  assert.throws(()=>requireNativeStrategistOutput(result),/No later stage was started/);
});
test("only schema-valid native n8n output can pass the staged boundary",async()=>{
  const valid={...buildDeterministicCampaignStrategistPlan(input),campaignObjective:"Prepare a private facility-party test strategy."};
  const native=await runCampaignStrategistAgent(input,{client:client(valid)});
  assert.equal(requireNativeStrategistOutput(native).diagnostics.source,"model");
  const wrongProvider=await runCampaignStrategistAgent(input,{client:client(valid,"openai")});
  assert.throws(()=>requireNativeStrategistOutput(wrongProvider),/valid native model result/);
  assert.match(buildCampaignStrategistRequestPayload(input).system,/campaignObjective is required/);
});
