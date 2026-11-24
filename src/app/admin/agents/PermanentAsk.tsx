"use client";

import {useEffect,useRef,useState,type FormEvent} from "react";

type Source={title:string;reference:string;checked:number|null;category?:string};
type Answer={text:string;kind:string;sources:Source[];draft?:{name:string;instructions:string}};
type Turn={id:string;question:string;answer:Answer};
type Thread={id:string;title:string};
type PolicyQuestion={id:string;topic:string;prompt:string;version:number};
type Finding={id:string;title:string;observed:string;next:string;reference:string};
type Entry={id:string;version:number;topic:string;category:string;body:string;source:string;checked:number;state:string;published?:boolean};
const api="/api/admin/agents/ask";
const field="block w-full min-w-0 rounded-lg border border-slate-300 bg-white p-2.5 text-sm";
const button="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold";
const primary="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const blank=()=>({id:crypto.randomUUID(),version:0,topic:"",category:"Handbook",body:"",source:"",checked:0,state:"active"});
async function post(endpoint:string,body:Record<string,unknown>){
  const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const value=await response.json();
  if(!response.ok)throw Error(value.error||"Command Center is unavailable.");
  return value;
}

export function PermanentAsk(){
  const [threads,setThreads]=useState<Thread[]>([]);
  const [questions,setQuestions]=useState<PolicyQuestion[]>([]);
  const [policy,setPolicy]=useState<{question:PolicyQuestion;content:string;source:string;publish:boolean}|null>(null);
  const [knowledge,setKnowledge]=useState<Entry[]>([]);
  const [catalog,setCatalog]=useState<Entry[]>([]);
  const [findings,setFindings]=useState<Finding[]>([]);
  const [gaps,setGaps]=useState<string[]>([]);
  const [view,setView]=useState("ask");
  const [thread,setThread]=useState("");
  const [turns,setTurns]=useState<Turn[]>([]);
  const [question,setQuestion]=useState("");
  const [reference,setReference]=useState<{name:string;text:string}|null>(null);
  const [edit,setEdit]=useState<Entry|null>(null);
  const [draft,setDraft]=useState<{id:string;name:string;instructions:string}|null>(null);
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const request=useRef<{thread:string;turnId:string;question:string;reference:string}|null>(null);
  const lock=useRef(false);

  async function refresh(){
    const response=await fetch(api,{cache:"no-store"});
    if(!response.ok)throw Error("Command Center knowledge is unavailable.");
    const data=await response.json();
    setThreads(data.threads);setKnowledge(data.knowledge);setCatalog(data.catalog);setGaps(data.gaps);setFindings(data.findings??[]);setQuestions(data.questions??[]);
    return data.threads as Thread[];
  }
  useEffect(()=>{
    let live=true;
    async function restore(){
      try{
        const list=await refresh();
        const last=list.find(item=>item.id===localStorage.getItem("jax-ask-thread"));
        if(last&&live){
          const result=await post(api,{action:"thread",id:last.id});
          if(live){setThread(last.id);setTurns(result.turns);}
        }
      }catch(error){if(live)setNotice(error instanceof Error?error.message:"Could not restore conversations.");}
    }
    void restore();return()=>{live=false};
  },[]);
  async function open(id:string){
    setNotice("");
    request.current=null;
    if(!id){setThread("");setTurns([]);localStorage.removeItem("jax-ask-thread");return;}
    try{
      const result=await post(api,{action:"thread",id});
      setThread(id);setTurns(result.turns);localStorage.setItem("jax-ask-thread",id);
    }catch(error){setNotice(String(error));}
  }
  async function send(event:FormEvent){
    event.preventDefault();
    if(lock.current||!question.trim())return;
    lock.current=true;setBusy(true);setNotice("");
    const q=question.trim(), ref=reference?.text??"";
    const saved=request.current;
    const pending=saved?.question===q&&saved.reference===ref?saved:{thread:thread||crypto.randomUUID(),turnId:crypto.randomUUID(),question:q,reference:ref};
    request.current=pending;
    try{
      const value=await post(api,{action:"ask",id:pending.thread,question:q,turnId:pending.turnId,reference:ref});
      setThread(pending.thread);localStorage.setItem("jax-ask-thread",pending.thread);
      setTurns(old=>[...old.filter(x=>x.id!==pending.turnId),{id:pending.turnId,question:q,answer:value.answer}]);
      setQuestion("");setReference(null);request.current=null;void refresh().catch(()=>{});
      if(value.answer.draft)setDraft({id:pending.turnId,...value.answer.draft});
    }catch(error){setNotice(error instanceof Error?error.message:"Send failed. Retry the same question.");}
    finally{lock.current=false;setBusy(false);}
  }
  async function change(entry:Entry,operation:string){
    try{
      await post(api,{action:"knowledge",id:entry.id,version:entry.version,operation,topic:entry.topic,
        category:entry.category,content:entry.body,source:entry.source});
      setEdit(null);await refresh();setNotice("Knowledge updated.");
    }catch(error){setNotice(error instanceof Error?error.message:"Knowledge update failed.");}
  }
  async function saveDraft(){
    if(!draft||lock.current)return;
    lock.current=true;setBusy(true);
    try{
      const value=await post("/api/admin/agents/projects",{action:"save-draft",id:draft.id,name:draft.name,
        instructions:draft.instructions,compute:"thunder",attachment:null,
        workers:["builder","reviewer","tester"].map(role=>({role,host:"thunder",model:""}))});
      setDraft(null);setNotice("Project saved as a draft. Start it from the Projects panel.");
      window.dispatchEvent(new CustomEvent("jax-project-saved",{detail:value.project.id}));
    }catch(error){setNotice(error instanceof Error?error.message:"Project save failed.");}
    finally{lock.current=false;setBusy(false);}
  }

  return <section className="mt-4 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 text-slate-950">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-xl font-semibold">Ask the Permanent Agent</h2>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Permanent Agent views">
        <button className={button} type="button" onClick={()=>setView("ask")} aria-pressed={view==="ask"}>Ask</button>
        <button className={button} type="button" onClick={()=>setView("knowledge")} aria-pressed={view==="knowledge"}>Knowledge</button>
        {findings.length>0&&<button className={button} type="button" onClick={()=>setView("findings")} aria-pressed={view==="findings"}>Needs attention ({findings.length})</button>}
        <a className={button} href="#jax-project-workspace">Projects</a>
      </div>
    </div>
    {notice&&<p role="status" className="mt-3 rounded bg-slate-100 p-2 text-sm">{notice}</p>}
    {view==="ask"?<>
      <form className="mt-3 space-y-2" onSubmit={send}>
        <textarea aria-label="Ask a question" className={field} rows={3} maxLength={1700} placeholder="Ask a question or describe an idea" value={question} onChange={e=>setQuestion(e.target.value)}/>
        <div className="flex flex-wrap items-center gap-2">
          <button className={primary} disabled={busy||!question.trim()}>Send</button>
          <label className="max-w-full break-words text-sm">Optional text reference<input type="file" className="block max-w-full text-xs" accept=".txt,.md" onChange={async e=>{
            const file=e.target.files?.[0];setReference(null);
            if(file&&file.size<=600&&/\.(txt|md)$/i.test(file.name))setReference({name:file.name,text:await file.text()});
            else if(file)setNotice("Use a text reference under 600 bytes.");
          }}/></label>
          {reference&&<span className="break-all text-xs">{reference.name} · search context only</span>}
        </div>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={button} onClick={()=>void open("")} disabled={busy}>New conversation</button>
        {threads.length>0&&<select aria-label="Saved conversations" className={field+" w-auto max-w-full"} value={thread} disabled={busy} onChange={e=>void open(e.target.value)}>
          <option value="">Saved conversations</option>{threads.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}
        </select>}
      </div>
      <div className="mt-3 space-y-3" aria-live="polite">
        {turns.map(turn=><article key={turn.id} className="min-w-0 rounded-xl border p-3 text-sm">
          <p className="break-words font-semibold">{turn.question}</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{turn.answer.text}</p>
          {turn.answer.sources.length>0&&<details className="mt-2"><summary>Sources ({turn.answer.sources.length})</summary>
            <ul className="mt-1 space-y-1">{turn.answer.sources.map((source,index)=><li key={index} className="break-words">{source.title} · {/^\/(?!\/)[a-z0-9]/i.test(source.reference)?<a className="underline" href={source.reference.split(" · ")[0]}>{source.reference}</a>:source.reference}{source.checked&&" · "+new Date(source.checked).toLocaleString()}</li>)}</ul>
          </details>}
          <button type="button" className={button+" mt-2"} onClick={()=>setDraft({id:turn.id,...(turn.answer.draft??{name:turn.question.slice(0,65),instructions:turn.question})})}>Draft a project</button>
        </article>)}
      </div>
      {draft&&<section className="mt-3 space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-3">
        <h3 className="font-semibold">Project draft</h3>
        <label className="block text-sm">Draft name<input className={field} value={draft.name} maxLength={80} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
        <label className="block text-sm">Draft instructions<textarea className={field} rows={5} value={draft.instructions} onChange={e=>setDraft({...draft,instructions:e.target.value})}/></label>
        <p className="text-sm">Defaults: Builder, Reviewer, Tester · Thunder preferred. Saving does not start execution.</p>
        <button type="button" className={primary} disabled={busy||!draft.name.trim()||!draft.instructions.trim()} onClick={()=>void saveDraft()}>Save project draft</button>
      </section>}
    </>:view==="findings"?<div className="mt-3 space-y-2">{findings.map(finding=><article key={finding.id} className="rounded-lg border p-3 text-sm">
      <h3 className="font-semibold">{finding.title}</h3><p>{finding.observed}</p><p>{finding.next}</p>
      <p className="break-all text-xs">{finding.reference}</p>
      {finding.reference.startsWith("/admin/agents#project-")&&<a className={button+" mt-2 inline-block"} href={finding.reference}>Open project</a>}
      <button type="button" className={button+" mt-2"} onClick={async()=>{try{await post(api,{action:"dismiss",id:finding.id});await refresh();}catch(error){setNotice(String(error));}}}>Dismiss</button>
    </article>)}</div>:<div className="mt-3 space-y-3">
      <p className="text-sm">Entries stay owner-only until published. Corrections and retirement remove the old publication.</p>
      <a className={button+" inline-block"} href="/admin/agents/knowledge">Published staff knowledge</a>
      <button type="button" className={primary} onClick={()=>setEdit(blank())}>Add knowledge</button>
      {questions.length>0&&<section className="space-y-2 rounded-lg border p-3">
        <h3 className="font-semibold">Needs your answer</h3>
        {questions.map(question=><div key={question.id} className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-sm">{question.prompt}</p>
          <button type="button" className={button} onClick={()=>setPolicy({question,content:"",source:"",publish:false})}>Answer {question.topic}</button>
        </div>)}
        {policy&&<form className="space-y-2" onSubmit={async event=>{
          event.preventDefault();
          try{
            await post(api,{action:"knowledge",operation:"confirm",id:policy.question.id,version:policy.question.version,
              content:policy.content,source:policy.source,publish:policy.publish});
            setPolicy(null);await refresh();setNotice("Owner-confirmed knowledge saved.");
          }catch(error){setNotice(error instanceof Error?error.message:"Could not save the answer.");}
        }}>
          <label className="block text-sm">Owner answer<textarea className={field} required value={policy.content} onChange={e=>setPolicy({...policy,content:e.target.value})}/></label>
          <label className="block text-sm">Authority or source<input className={field} required value={policy.source} onChange={e=>setPolicy({...policy,source:e.target.value})}/></label>
          <label className="block text-sm"><input type="checkbox" checked={policy.publish} onChange={e=>setPolicy({...policy,publish:e.target.checked})}/> Publish this answer to staff</label>
          <button className={primary}>Save owner answer</button>
        </form>}
      </section>}
      {edit&&<form className="space-y-2 rounded-lg border p-3" onSubmit={e=>{e.preventDefault();void change(edit,"save");}}>
        <label className="block text-sm">Topic<input className={field} value={edit.topic} maxLength={100} required onChange={e=>setEdit({...edit,topic:e.target.value})}/></label>
        <label className="block text-sm">Category<select className={field} value={edit.category} onChange={e=>setEdit({...edit,category:e.target.value})}><option>Handbook</option><option>Project memory</option><option>Integration</option></select></label>
        <label className="block text-sm">Approved fact<textarea className={field} value={edit.body} required maxLength={1700} onChange={e=>setEdit({...edit,body:e.target.value})}/></label>
        <label className="block text-sm">Source reference<input className={field} value={edit.source} maxLength={250} required onChange={e=>setEdit({...edit,source:e.target.value})}/></label>
        <button className={primary}>Save knowledge</button>
      </form>}
      {[...knowledge,...catalog].map(entry=><article key={entry.id} className="rounded-lg border p-3 text-sm">
        <h3 className="break-words font-semibold">{entry.topic}</h3><p className="whitespace-pre-wrap break-words">{entry.body}</p>
        <p className="break-words text-xs text-slate-500">{entry.category} · {entry.state} · {entry.source}{entry.checked&&" · "+new Date(entry.checked).toLocaleString()}</p>
        {entry.version&&<div className="mt-2 flex gap-2"><button type="button" className={button} onClick={()=>setEdit(entry)}>Correct</button>
          <button type="button" className={button} onClick={()=>void change(entry,entry.state==="active"?"retire":"restore")}>{entry.state==="active"?"Retire":"Restore"}</button>
          {entry.state==="active"&&["Handbook","Integration"].includes(entry.category)&&
            <button type="button" className={button} onClick={()=>void change(entry,entry.published?"withdraw":"publish")}>{entry.published?"Withdraw from staff":"Publish to staff"}</button>}
          </div>}
      </article>)}
      {gaps.length>0&&<details><summary>Known gaps ({gaps.length})</summary><ul>{gaps.map(gap=><li key={gap} className="text-sm">{gap}</li>)}</ul></details>}
    </div>}
  </section>;
}
