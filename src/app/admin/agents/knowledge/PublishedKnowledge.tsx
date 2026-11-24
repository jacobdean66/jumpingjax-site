"use client";
import {useEffect,useState} from "react";

type Entry={topic:string;body:string;source:string;checked:number;publishedAt:number};
export function PublishedKnowledge(){
  const [entries,setEntries]=useState<Entry[]>([]);
  const [query,setQuery]=useState("");
  const [error,setError]=useState("");
  const [waiting,setWaiting]=useState(true);
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/admin/agents/published-knowledge",{cache:"no-store",signal:controller.signal})
      .then(async response=>{if(!response.ok)throw Error("Published staff knowledge is unavailable.");return response.json();})
      .then(data=>{setEntries(data.entries);setError("");})
      .catch(error=>{if(!controller.signal.aborted){setEntries([]);setError(error.message);}})
      .finally(()=>{if(!controller.signal.aborted)setWaiting(false);});
    return()=>controller.abort();
  },[refresh]);
  const visible=waiting?[]:entries.filter(entry=>(entry.topic+" "+entry.body).toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="mx-auto max-w-3xl space-y-4 px-4 py-5">
    <h1 className="text-2xl font-semibold">Published staff knowledge</h1>
    <p className="text-sm">This view contains only current versions published by an owner.</p>
    <form className="flex flex-wrap gap-2" onSubmit={event=>{event.preventDefault();setWaiting(true);setRefresh(value=>value+1);}}>
      <input aria-label="Search published knowledge" className="min-w-0 flex-1 rounded-lg border p-2" value={query} onChange={event=>setQuery(event.target.value)}/>
      <button className="rounded-lg bg-slate-950 px-3 py-2 text-white">Refresh results</button>
    </form>
    {error&&<p role="alert">{error}</p>}
    {!error&&!waiting&&!visible.length&&<p>No matching published entries.</p>}
    {visible.map((entry,index)=><article key={entry.topic+index} className="min-w-0 rounded-lg border p-3">
      <h2 className="font-semibold">{entry.topic}</h2><p className="whitespace-pre-wrap break-words">{entry.body}</p>
      <p className="mt-2 break-all text-xs">{entry.source} · checked {new Date(entry.checked).toISOString()}</p>
    </article>)}
  </section>;
}
