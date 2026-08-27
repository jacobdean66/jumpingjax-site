"use client";

import { useEffect, useState } from "react";

type ProofRun = { id:string; status:string; isCompleted:boolean; isSuccess:boolean; isFailed:boolean; idempotencyKey:string|null; createdAt:string; finishedAt:string|null; output:{attempt:number;retried:boolean;handler:string;aiInvocations:number}|null; error:string|null };

export function TriggerProofClient() {
  const [run,setRun]=useState<ProofRun|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function refresh(){const response=await fetch("/api/admin/agents/trigger-proof",{cache:"no-store"});const body=await response.json();if(response.ok)setRun(body.run);}
  useEffect(()=>{let active=true;void fetch("/api/admin/agents/trigger-proof",{cache:"no-store"}).then(response=>response.json().then(body=>({response,body}))).then(({response,body})=>{if(active&&response.ok)setRun(body.run);});return()=>{active=false};},[]);
  useEffect(()=>{if(!run||run.isCompleted)return;const timer=window.setInterval(()=>void refresh(),1500);return()=>window.clearInterval(timer);},[run]);

  async function start(kind:"success"|"retry"|"duplicate"){
    setBusy(true);setMessage("");
    try{
      const stamp=Date.now();const key=`jj-proof-${kind}-${stamp}`;const payload={probeId:`${kind}-${stamp}`,failureMode:kind==="retry"?"fail_once":"none",idempotencyKey:key};
      const first=await fetch("/api/admin/agents/trigger-proof",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const firstBody=await first.json();if(!first.ok)throw new Error(firstBody.error);
      if(kind==="duplicate"){const second=await fetch("/api/admin/agents/trigger-proof",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const secondBody=await second.json();if(!second.ok)throw new Error(secondBody.error);setMessage(firstBody.runId===secondBody.runId?`Idempotency PASS — both requests returned ${firstBody.runId}.`:"Idempotency FAIL — different run IDs returned.");}
      else setMessage(kind==="retry"?"Safe fail-once run started; Trigger.dev will retry it.":"Deterministic run started; no AI is used.");
      await refresh();
    }catch(error){setMessage(error instanceof Error?error.message:"Proof failed safely.");}finally{setBusy(false)}
  }

  return <section className="mt-7 rounded-3xl border border-indigo-200 bg-indigo-50 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-indigo-700">Trigger.dev architecture proof</p><h2 className="mt-1 text-2xl font-black">{run?.status??"No run yet"}</h2><p className="mt-1 text-sm font-semibold text-slate-700">Durable deterministic TypeScript · AI calls {run?.output?.aiInvocations??0}</p></div><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={()=>start("success")} className="rounded-full bg-indigo-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50">Run success</button><button disabled={busy} onClick={()=>start("duplicate")} className="rounded-full bg-sky-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50">Prove duplicate</button><button disabled={busy} onClick={()=>start("retry")} className="rounded-full bg-amber-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">Prove retry</button></div></div>{message?<p role="status" className="mt-3 rounded-xl bg-white p-3 text-sm font-bold">{message}</p>:null}{run?<dl className="mt-4 grid gap-2 text-xs sm:grid-cols-4"><div><dt className="font-black text-slate-500">Run</dt><dd className="break-all font-semibold">{run.id}</dd></div><div><dt className="font-black text-slate-500">Result</dt><dd className="font-semibold">{run.isSuccess?"SUCCESS":run.isFailed?"FAILED":"IN PROGRESS"}</dd></div><div><dt className="font-black text-slate-500">Attempt</dt><dd className="font-semibold">{run.output?.attempt??"—"}{run.output?.retried?" (retried)":""}</dd></div><div><dt className="font-black text-slate-500">Finished</dt><dd className="font-semibold">{run.finishedAt?new Date(run.finishedAt).toLocaleString():"—"}</dd></div></dl>:null}</section>;
}
