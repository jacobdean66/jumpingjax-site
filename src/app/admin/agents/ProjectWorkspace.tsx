"use client";

import {useEffect,useRef,useState,type FormEvent} from "react";

const presets = [
  ["lead","Project lead","Planning and coordination"],
  ["researcher","Researcher","Source and requirements investigation"],
  ["designer","Designer","Interface and user flows"],
  ["builder","Builder","Implements the isolated artifact"],
  ["reviewer","Reviewer","Reviews the exact final patch"],
  ["tester","Tester","Isolated syntax and functional checks"],
  ["release","Release manager","Release planning and rollback"],
] as const;
type Host = "thunder" | "contabo";
type Worker = {role:string;host:Host;model:string};
type Inventory = Record<Host,{reachable:boolean;models:{model:string;agent:string|null}[]}>;
type Event = {kind:string;at:number;data:{role?:string;host?:Host;model?:string;status?:string;
  outputTokens?:number;test?:string;passed?:boolean;patch?:string;digest?:string;patchSHA256?:string;review?:string|{finding?:string};approved?:boolean;interpretation?:string;output?:string}};
type Project = {id:string;name:string;instructions:string;sitePaths?:string[];repositoryScope?:string[];repositoryNormalization?:{builder_execution:string}|null;repositoryModelRecovery?:{failed_execution:string}|null;repositoryPreflight?:{original_execution:string;failed_execution:string}|null;repositoryBuild?:{stage:string;reason?:string}|null;workers:Worker[];compute:string;state:string;reason:string|null;
  result:string|null;approval:string|null;privateRelease?:{digest:string;state:string;origin?:string;buildId?:string;error?:string}|null;priorExecution?:{id:string;status:string;error:string|null;taskId:string|null}|null;attachment:{name:string}|null;
  conversationId:string|null;taskId:string|null;executionId:string|null;
  assignment:Record<string,{model:string;host:Host}>|null;events:Event[];messages:{body:string;at:number}[]};
const endpoint="/api/admin/agents/projects";
const field="mt-1 block w-full min-w-0 rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-950";
const button="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40";
const primary="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40";
const defaultModel = (role:string)=>role==="builder"?"qwen3-coder:30b":role==="reviewer"?"deepseek-coder-v2:16b":role==="tester"?"":"phi4-mini:3.8b";
const modelRoles = ["lead","researcher","designer","builder","reviewer","release"];
const queueStates=["queued","waiting","paused"];
const phaseLabel = (role?:string)=>presets.find(p=>p[0]===role)?.[1]??role??"Execution";

export function ProjectWorkspace({scope}:{scope:string}){
  const [projects,setProjects]=useState<Project[]>([]);
  const [inventory,setInventory]=useState<Inventory|null>(null);
  const [lifecycle,setLifecycle]=useState("");
  const [selected,setSelected]=useState("");
  const [tab,setTab]=useState("Project");
  const [creating,setCreating]=useState(true);
  const [editingDraft,setEditingDraft]=useState<string|null>(null);
  const [details,setDetails]=useState(true);
  const [name,setName]=useState("");
  const [instructions,setInstructions]=useState("");
  const [attachment,setAttachment]=useState<{name:string;text?:string;image?:string}|null>(null);
  const [compute,setCompute]=useState("contabo");
  const [site,setSite]=useState(false);
  const [repository,setRepository]=useState(false);
  const [repositoryScope,setRepositoryScope]=useState(["src/app/visit/facility/page.tsx"]);
  const [help,setHelp]=useState(false);
  const [workers,setWorkers]=useState<Worker[]>(["builder","reviewer","tester"].map(role=>({role,host:"thunder",model:""})));
  const [note,setNote]=useState("");
  const [notice,setNotice]=useState("");
  const [connection,setConnection]=useState("");
  const [busy,setBusy]=useState(false);
  const [refresh,setRefresh]=useState(0);
  const pending=useRef<{id:string;fingerprint:string}|null>(null);
  const lock=useRef(false);
  const current=projects.find(x=>x.id===selected)??projects[0];
  useEffect(()=>{
    const stop=new AbortController();
    let timer:ReturnType<typeof setTimeout>;
    async function load(){
      try{
        const response=await fetch(endpoint,{cache:"no-store",signal:stop.signal});
        if(!response.ok)throw Error("Command Center project status is unavailable.");
        const data=await response.json();
        if(stop.signal.aborted)return;
        setProjects(data.projects);setInventory(data.inventory);setLifecycle(data.lifecycle);setConnection("");
        if(data.projects.length){
          setSelected(old=>old||data.projects[0].id);
          setCreating(old=>old&&sessionStorage.getItem("jax-project-create")==="true");
        }
      }catch(error){
        if(!stop.signal.aborted)setConnection(error instanceof Error?error.message:"Connection unavailable.");
      }finally{if(!stop.signal.aborted)timer=setTimeout(load,5000);}
    }
    void load();
    return ()=>{stop.abort();clearTimeout(timer);};
  },[refresh]);

  useEffect(()=>{
    const change=(event:Event)=>{
      setSelected((event as unknown as CustomEvent<string>).detail);setCreating(false);setRefresh(value=>value+1);
    };
    window.addEventListener("jax-project-saved",change as unknown as EventListener);
    return ()=>window.removeEventListener("jax-project-saved",change as unknown as EventListener);
  },[]);

  useEffect(()=>{
    function selectHash(){
      const key=location.hash.match(/^#project-([a-f0-9-]{36})$/)?.[1];
      if(key){setSelected(key);setCreating(false);setTab("Project");}
    }
    window.addEventListener("hashchange",selectHash);
    selectHash();
    return ()=>window.removeEventListener("hashchange",selectHash);
  },[]);

  async function send(body:Record<string,unknown>){
    if(lock.current)return null;
    lock.current=true;setBusy(true);setNotice("");
    try{
      const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const data=await response.json();
      if(!response.ok)throw Error(data.error??"Project request failed.");
      const project=data.project as Project;
      setProjects(old=>[project,...old.filter(x=>x.id!==project.id)]);
      setRefresh(value=>value+1);
      return project;
    }catch(error){setNotice(error instanceof Error?error.message:"Project request failed.");return null;}
    finally{lock.current=false;setBusy(false);}
  }
  async function start(event:FormEvent){
    event.preventDefault();
    if(lock.current)return;
    const spec={name,instructions,workers,compute,attachment,...(repository?{repositoryScope}:{}),...(site?{sitePaths:["public/index.html","public/site.css",...(help?["public/help.html"]:[])]}:{})};
    const input=new TextEncoder().encode(JSON.stringify(spec));
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",input)),x=>x.toString(16).padStart(2,"0")).join("");
    const key="jax-project:"+scope+":"+digest;
    const id=editingDraft??(pending.current?.fingerprint===digest?pending.current.id:(localStorage.getItem(key)??crypto.randomUUID()));
    pending.current={id,fingerprint:digest};localStorage.setItem(key,id);
    const project=await send({action:editingDraft?"save-draft":"start",id,...spec});
    if(project){pending.current=null;localStorage.removeItem(key);openProject(project.id);}
  }
  function openProject(id:string){setEditingDraft(null);setSelected(id);setCreating(false);setTab("Project");sessionStorage.removeItem("jax-project-create");}
  function editWorker(role:string,patch:Partial<Worker>){
    setWorkers(old=>old.map(item=>item.role===role?{...item,...patch}:item));
  }
  function toggle(role:string){
    setWorkers(old=>old.some(x=>x.role===role)?old.filter(x=>x.role!==role):[...old,{role,host:"thunder",model:""}]);
  }
  const displayWorkers=creating?workers:(current?.workers??[]);
  const displayCompute=creating?compute:(current?.compute??"thunder");
  const artifact=current?.events.findLast(event=>["artifact","repository artifact"].includes(event.data.role??""));
  const releaseDigest=artifact?.data.digest??artifact?.data.patchSHA256;
  const reviewText=typeof artifact?.data.review==="string"?artifact.data.review:
    (artifact?.data.review as {finding?:string}|undefined)?.finding;
  const lastPhase=current?.events.findLast(event=>event.kind==="stage"&&["builder","reviewer"].includes(event.data.role??""))?.data.role;
  const panel=(key:string)=>tab===key?"block":"hidden md:block";
  return <section id="jax-project-workspace" className="mt-5 min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4">
      <div><p className="text-xs font-semibold text-slate-500">Permanent Agent</p><h2 className="text-xl font-semibold">Project workspace</h2></div>
      <button type="button" className={button+" hidden md:block"} aria-expanded={details} onClick={()=>setDetails(!details)}>Team & details</button>
    </header>
    <div className="flex gap-1 border-b border-slate-200 p-2 md:hidden" role="group" aria-label="Workspace panels">
      {["Projects","Project","Team"].map(item=><button key={item} type="button" aria-pressed={tab===item}
        className={(tab===item?primary:button)+" flex-1 px-1"} onClick={()=>setTab(item)}>{item}</button>)}
    </div>
    {(notice||connection)&&<p role="status" className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-sm">{notice||connection}</p>}
    <div className={"grid min-w-0 divide-y divide-slate-200 md:divide-x md:divide-y-0 "+(details?"md:grid-cols-[11rem_minmax(0,1fr)_minmax(12rem,16rem)]":"md:grid-cols-[11rem_minmax(0,1fr)]")}>
      <aside aria-label="Projects" className={panel("Projects")+" min-w-0 bg-slate-50 p-3"}>
        <button type="button" className={primary+" w-full"} onClick={()=>{setEditingDraft(null);setCreating(true);setTab("Project");sessionStorage.setItem("jax-project-create","true");}}>New project</button>
        <ul className="mt-3 space-y-1">
          {projects.map(project=><li key={project.id}><button type="button" onClick={()=>openProject(project.id)}
            aria-current={!creating&&current?.id===project.id?"true":undefined}
            className={"w-full break-words rounded-lg p-2 text-left text-sm hover:bg-slate-200 "+(!creating&&current?.id===project.id?"bg-slate-200 font-semibold":"")}>
            {project.name}<span className="block text-xs text-slate-600">{project.state}</span></button></li>)}
        </ul>
      </aside>
      <section aria-label="Project conversation" className={panel("Project")+" min-w-0 p-4"}>
        {creating||!current?<form className="space-y-4" onSubmit={start}>
          <h3 className="text-lg font-semibold">Start a project</h3>
          <label className="block text-sm font-medium">Project name<input className={field} maxLength={80} required value={name} onChange={e=>setName(e.target.value)}/></label>
          <label className="block text-sm font-medium">Instructions<textarea className={field} rows={7} maxLength={4000} required value={instructions} onChange={e=>setInstructions(e.target.value)}/></label>
          <label className="block text-sm font-medium">Reference attachment (small text or PNG)
            <input className={field+" max-w-full"} type="file" accept=".txt,.md,.png,text/plain,text/markdown,image/png" onChange={async e=>{
              const file=e.target.files?.[0];setAttachment(null);
              if(!file)return;
              if(/\.png$/i.test(file.name)&&file.size<=5800){
                const image=btoa(Array.from(new Uint8Array(await file.arrayBuffer()),byte=>String.fromCharCode(byte)).join(""));
                setAttachment({name:file.name,image});setNotice("");return;
              }
              if(file.size>1200||!(/\.(txt|md)$/i.test(file.name))){setNotice("Attach text up to 1,200 bytes or PNG up to 5,800 bytes.");return;}
              setAttachment({name:file.name,text:await file.text()});setNotice("");
            }}/>
          </label>
          <label className="block text-sm font-medium">Compute<select aria-label="Compute" className={field} value={compute} onChange={e=>setCompute(e.target.value)}>
            <option value="thunder">Thunder preferred</option><option value="contabo">Contabo only</option><option value="per-worker">Per-worker hosts</option>
          </select></label>
          <label className="block text-sm font-medium">Repository and scope<select aria-label="Repository and scope" className={field} value={repository?"repository":site?"website":"artifact"} onChange={e=>{setSite(e.target.value==="website");setRepository(e.target.value==="repository");}}>
            <option value="artifact">Isolated artifact seed</option><option value="website">Authorized disposable static website seed</option><option value="repository">Jumping Jax public Visit pages</option>
          </select></label>
          {repository&&<fieldset className="space-y-1 text-sm"><legend>Editable pages</legend>
            {["src/app/visit/facility/page.tsx","src/app/visit/rentals/page.tsx"].map(file=><label className="block break-all" key={file}>
              <input type="checkbox" checked={repositoryScope.includes(file)} onChange={e=>setRepositoryScope(previous=>e.target.checked?[...previous,file]:previous.filter(item=>item!==file))}/> {file}
            </label>)}
          </fieldset>}
          {site&&<p className="text-sm">Editable: public/index.html, public/site.css. <label><input type="checkbox" checked={help} onChange={e=>setHelp(e.target.checked)}/> Also allow public/help.html</label></p>}
          <p className="text-sm text-slate-600">Builder and Reviewer are required. Repository projects use the selected editable pages and an isolated full build.</p>
          <button type="submit" className={primary} disabled={busy||(repository&&!repositoryScope.length)||!workers.some(x=>x.role==="builder")||!workers.some(x=>x.role==="reviewer")}>{editingDraft?"Save team and draft":"Start Project"}</button>
        </form>:<div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="break-all text-lg font-semibold">{current.name}</h3>
            <span role="status" className="rounded-full bg-slate-100 px-3 py-1 text-sm">{current.state==="pause-requested"?"Pause requested":current.state==="paused-active"?"Paused between stages":current.state}{lastPhase&&" · "+phaseLabel(lastPhase)}</span></div>
          <p className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm">{current.instructions}</p>
          {current.attachment&&<p className="break-all text-sm">Reference: {current.attachment.name}</p>}
          {current.repositoryBuild&&<p role="status" className="text-sm">Build worker: {current.repositoryBuild.stage}
            {current.repositoryBuild.reason&&" · "+current.repositoryBuild.reason}</p>}
          {current.reason&&<p role="status" className="rounded-lg bg-amber-50 p-3 text-sm">{current.reason}</p>}
          <div className="flex flex-wrap gap-2">
            {current.state==="draft"&&<>
              <button className={button} onClick={()=>{
                setEditingDraft(current.id);setName(current.name);setInstructions(current.instructions);
                setWorkers(current.workers);setCompute(current.compute);setAttachment(null);setSite(!!current.sitePaths);setRepository(!!current.repositoryScope);setRepositoryScope(current.repositoryScope??["src/app/visit/facility/page.tsx"]);setHelp(!!current.sitePaths?.includes("public/help.html"));
                sessionStorage.setItem("jax-project-create","true");setCreating(true);setTab("Project");
              }}>Edit saved draft</button>
              <button className={primary} onClick={()=>void send({action:"start-draft",id:current.id})}>Start saved project</button>
            </>}
            {current.executionId&&((!current.priorExecution&&["error","interrupted","timed_out","cancelled"].includes(current.state))||
              (current.repositoryScope&&!current.repositoryPreflight&&current.state==="error"&&!current.events.some(e=>e.kind==="stage"||e.kind==="model")))&&
              <button className={button} onClick={()=>void send({action:"retry-core",id:current.id})}>{current.sitePaths?"Recover saved website stage":"Retry core build"}</button>}
            {current.repositoryScope&&!current.repositoryNormalization&&current.state==="error"&&current.reason?.startsWith("Invalid TSX:")&&
              <button className={button} onClick={()=>void send({action:"normalize-repository-jsx",id:current.id})}>Review saved model edit with JSX wrapper</button>}
            {current.repositoryScope&&!current.repositoryModelRecovery&&current.repositoryBuild?.stage==="failed"&&["error","interrupted"].includes(current.state)&&
              <button className={button} onClick={()=>void send({action:"retry-repository-build",id:current.id})}>Retry with scoped JSX and Qwen 8B</button>}
            {current.state==="error"&&!current.executionId&&<button className={button} onClick={()=>void send({action:"retry-start",id:current.id})}>Retry project start</button>}
            {["queued","waiting"].includes(current.state)&&<button className={button} onClick={()=>void send({action:"pause",id:current.id})}>Pause queue</button>}
            {current.state==="running"&&<button className={button} onClick={()=>void send({action:"pause",id:current.id})}>Pause after current stage</button>}
            {["paused","pause-requested","paused-active"].includes(current.state)&&<button className={button} onClick={()=>void send({action:"resume",id:current.id})}>Resume</button>}
            {([...queueStates,"running","pause-requested","paused-active"].includes(current.state)||
              (current.state==="interrupted"&&["preparing","dependencies","test","build","smoke"].includes(current.repositoryBuild?.stage??"")))&&<button className={button} onClick={()=>void send({action:"cancel",id:current.id})}>Cancel</button>}
            {queueStates.includes(current.state)&&current.compute!=="contabo"&&<button className={button} onClick={()=>void send({action:"use-contabo",id:current.id})}>Use Contabo instead</button>}
          </div>
          {current.state==="waiting"&&<p className="text-sm text-slate-600">The project will wait for readiness. {lifecycle}</p>}
          {current.result&&<p className="rounded-lg bg-emerald-50 p-3 text-sm">{current.result}</p>}
          {current.events.filter(event=>event.data.interpretation).map(event=><details key={event.at} className="rounded-lg border p-3"><summary>Image interpretation · {event.data.model} · {event.data.host}</summary><p className="whitespace-pre-wrap break-words text-sm">{event.data.interpretation}</p></details>)}
          {current.events.filter(event=>event.data.output&&event.data.role?.endsWith(" output")).map(event=><details key={event.at} className="rounded-lg border p-3"><summary>{phaseLabel(event.data.role?.replace(" output",""))} · {event.data.model} · {event.data.host}</summary><p className="whitespace-pre-wrap break-words text-sm">{event.data.output}</p></details>)}
          {artifact&&<details className="rounded-lg border p-3"><summary className="cursor-pointer font-semibold">Files and exact review</summary>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{reviewText}</p>
            <pre className="mt-2 max-w-full overflow-auto rounded bg-slate-950 p-2 text-xs text-white">{artifact.data.patch}</pre></details>}
          <section className="rounded-lg border p-3"><h4 className="font-semibold">Approvals</h4>
            <p className="text-sm text-slate-600">{current.approval??"No release review requested."} Release and production actions are disabled here.</p>
            {current.state==="completed"&&!current.approval&&<button className={button+" mt-2"} onClick={()=>void send({action:"request-approval",id:current.id})}>Request release review</button>}
            {current.approval==="requested"&&<button className={button+" mt-2"} onClick={()=>void send({action:"deny-approval",id:current.id})}>Decline request</button>}
          </section>
          {current.state==="completed"&&releaseDigest&&<section className="space-y-2 rounded-lg border p-3 text-sm">
            <h4 className="font-semibold">Disposable private release</h4>
            <p className="break-all">Reviewed revision {releaseDigest}</p>
            <p>Release approval applies to this reviewed patch. Repository releases open on a separate private hostname.</p>
            <p>Status: {current.privateRelease?.state??"Awaiting request"}</p>
            {current.privateRelease?.error&&<p role="alert">{current.privateRelease.error}</p>}
            {current.privateRelease?.state==="deployed"&&current.privateRelease.origin&&
              <a className="underline" target="_blank" rel="noreferrer" href={current.privateRelease.origin+"/visit/facility"}>Open isolated website {current.privateRelease.buildId}</a>}
            <div className="flex flex-wrap gap-2">
              {(!current.privateRelease||current.privateRelease.state==="failed")&&<button className={button} onClick={()=>void send({action:"private-request",id:current.id,digest:releaseDigest})}>Request exact preview release</button>}
              {current.privateRelease?.state==="requested"&&<button className={button} onClick={()=>void send({action:"private-approve",id:current.id,digest:releaseDigest})}>Approve exact revision</button>}
              {current.privateRelease?.state==="approved"&&<button className={button} onClick={()=>void send({action:"private-deploy",id:current.id,digest:releaseDigest})}>Deploy to disposable preview</button>}
              {current.privateRelease?.state==="deployed"&&<button className={button} onClick={()=>void send({action:"private-rollback",id:current.id,digest:releaseDigest})}>Roll back disposable release</button>}
              <a className={button} href="/admin/agents/private-release">Open disposable target</a>
            </div>
          </section>}
          {current.messages.map((message,index)=><p key={index} className="whitespace-pre-wrap break-words rounded bg-slate-50 p-2 text-sm">{message.body}</p>)}
          <form className="flex gap-2" onSubmit={async e=>{e.preventDefault();if(await send({action:"message",id:current.id,messageId:crypto.randomUUID(),text:note}))setNote("");}}>
            <input aria-label="Project note" className={field+" mt-0 flex-1"} value={note} onChange={e=>setNote(e.target.value)} maxLength={1000}/>
            <button className={button} disabled={!note.trim()||busy}>Save note</button>
          </form>
          <details className="rounded-lg border p-3"><summary className="cursor-pointer font-semibold">Activity and execution details</summary>
            {[["Project",current.id],["Conversation",current.conversationId],["Task",current.taskId],["Execution",current.executionId]].map(([label,id])=>id&&<p key={label} className="break-all text-sm">{label} {id}</p>)}
            {current.priorExecution&&<p className="break-all text-sm">Prior execution {current.priorExecution.id} · {current.priorExecution.status} {current.priorExecution.error}</p>}
            <ul className="mt-2 space-y-1 text-sm">{current.events.map((event,i)=><li key={i}>{phaseLabel(event.data.role)} {event.data.model} {event.data.host} {event.data.status??event.data.test} {event.data.passed!==undefined&&(event.data.passed?"passed":"failed")}</li>)}</ul>
          </details>
        </div>}
      </section>
      <aside aria-label="Team" className={panel("Team")+" min-w-0 bg-slate-50 p-3 "+(!details?"md:hidden":"")}>
        <h3 className="font-semibold">Team <span className="text-sm text-slate-500">{displayWorkers.length}/7</span></h3>
        <ul className="mt-2 space-y-2">{presets.map(([role,label,description])=>{
          const worker=displayWorkers.find(x=>x.role===role);
          const host=displayCompute==="per-worker"?(worker?.host??"thunder"):displayCompute==="contabo"?"contabo":"thunder";
          const actual=current?.assignment?.[role];
          const model=worker?.model||defaultModel(role);
          const models=inventory?.[host].models.filter(candidate=>role==="builder"?candidate.agent==="qwen"&&candidate.model!=="qwen3-vl:8b":role==="reviewer"?candidate.agent==="deepseek":!!candidate.agent&&candidate.model!=="qwen3-vl:8b")??[];
          return <li key={role} className="min-w-0 rounded-lg border border-slate-200 bg-white p-2 text-sm">
            <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={!!worker} disabled={!creating} onChange={()=>toggle(role)}/>{label}</label>
            <p className="text-xs text-slate-600">{description}</p>
            {worker&&<div className="mt-2 space-y-1">
              {creating&&compute==="per-worker"&&<label className="block text-xs">{label} host<select aria-label={label+" host"} className={field} value={worker.host} onChange={e=>editWorker(role,{host:e.target.value as Host})}><option value="thunder">Thunder</option><option value="contabo">Contabo</option></select></label>}
              {creating&&modelRoles.includes(role)&&<label className="block text-xs">{label} model<select aria-label={label+" model"} className={field} value={worker.model} onChange={e=>editWorker(role,{model:e.target.value})}><option value="">{defaultModel(role)}</option>{models.filter(x=>x.model!==defaultModel(role)).map(x=><option key={x.model}>{x.model}</option>)}</select></label>}
              <p className="break-all text-xs">{actual?actual.model+" · "+actual.host:role==="tester"?"Contabo sandbox":model+" · "+host}</p>
              <p className="text-xs text-slate-600">{role==="tester"?"Runs fixed checks when the build executes":actual?"Assigned":models.some(x=>x.model===model)?"Installed · checked on dispatch":"Unavailable or unverified"}</p>
            </div>}
          </li>;
        })}</ul>
        {lifecycle&&<p className="mt-3 text-xs text-slate-600">{lifecycle}</p>}
      </aside>
    </div>
  </section>;
}
