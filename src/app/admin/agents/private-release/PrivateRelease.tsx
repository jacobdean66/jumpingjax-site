"use client";
import {useEffect,useState} from "react";

type Release={digest:string;label:string;updated:number;website?:{html:string;css:string;digest:string}};
export function PrivateRelease(){
  const [release,setRelease]=useState<Release|null>(null);
  const [status,setStatus]=useState("Loading the disposable release target…");
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/admin/agents/projects",{cache:"no-store",signal:controller.signal}).then(async response=>{
      if(!response.ok)throw Error();
      const result=await response.json();setRelease(result.privateRelease);setStatus("");
    }).catch(()=>{if(!controller.signal.aborted)setStatus("Private release status is unavailable.");});
    return()=>controller.abort();
  },[]);
  return <section className="mx-auto max-w-3xl space-y-3 px-4 py-5">
    <p className="text-sm font-semibold text-slate-500">Disposable private release target</p>
    {status?<p role="status">{status}</p>:<>
      {release?.website&&<iframe title="Reviewed isolated website" sandbox="" className="h-64 w-full rounded-xl border"
        srcDoc={String.raw`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`+"<style>"+release.website.css+"</style>"+release.website.html}/>}
      <h1 className="break-words text-3xl font-semibold">{release?.label??"Jumping Jax preview starter"}</h1>
      <p className="break-all text-sm">Served revision: {release?.digest??"private-preview-baseline"}</p>
    </>}
    <a className="underline" href="/admin/agents">Return to Permanent Agent</a>
  </section>;
}
