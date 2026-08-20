import assert from "node:assert/strict";
import test from "node:test";
import { DeterministicWorker, selectWorker } from "./worker.ts";

const job = { id:"11111111-1111-1111-1111-111111111111", agent_id:"a", job_type:"system.health_check", source:"test", priority:100, status:"claimed", payload:{}, idempotency_key:"demo-key", attempt_count:1, max_attempts:3, worker_invocation_count:0, max_worker_invocations:0, timeout_seconds:10, approval_required:false, approval_status:"not_required", result_summary:null, error_summary:null, created_at:new Date(0).toISOString(), completed_at:null } as const;

test("safe demo selects deterministic worker and never a model adapter", async()=>{const worker=selectWorker(job as never,[new DeterministicWorker()]);assert.equal(worker?.kind,"deterministic");const result=await worker!.execute(job as never,new AbortController().signal);assert.equal(result.ok,true);assert.match(result.summary,/no AI invoked/i);});
test("unsupported work does not fall through to a model",()=>{assert.equal(selectWorker({...job,job_type:"production.deploy"} as never,[new DeterministicWorker()]),null);});
test("cancelled deterministic work fails without retry",async()=>{const controller=new AbortController();controller.abort();const result=await new DeterministicWorker().execute(job as never,controller.signal);assert.deepEqual(result,{ok:false,summary:"Job cancelled before execution",transient:false});});
