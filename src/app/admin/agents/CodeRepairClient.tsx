"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CodeRepairItem } from "@/lib/agent-manager/code-repair";
import { formatAgentTime } from "./time";

export function CodeRepairClient() {
  const [repairs, setRepairs] = useState<CodeRepairItem[]>([]);
  const [description, setDescription] = useState("");
  const [pagePath, setPagePath] = useState("/");
  const [expectedText, setExpectedText] = useState("");
  const [configured, setConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef<{ value: string; id: string } | null>(null);
  async function refresh() {
    const response = await fetch("/api/admin/agents/code-repairs", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Code repair queue is unavailable.");
    setRepairs(body.repairs); setConfigured(body.worker.configured); setConnected(body.worker.connected);
  }
  useEffect(() => {
    let active = true;
    const poll = () => { if (active) void refresh().catch(caught => { if (active) setError(caught.message); }); };
    poll();
    const timer = setInterval(poll, 15000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const value = JSON.stringify({ description, pagePath, expectedText });
    if (requestRef.current?.value !== value) requestRef.current = { value, id: crypto.randomUUID() };
    try {
      const response = await fetch("/api/admin/agents/code-repairs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description, pagePath, expectedText, requestId: requestRef.current.id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Repair request failed.");
      requestRef.current = null; setDescription(""); setExpectedText(""); await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Repair request failed."); }
    finally { setBusy(false); }
  }
  async function cancel(id: string) {
    setError("");
    try {
      const response = await fetch(`/api/admin/agents/code-repairs?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
      if (!response.ok) throw new Error("Repair is already finished or could not be cancelled.");
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Cancellation failed."); }
  }
  return <section className="mt-7 rounded-3xl border border-slate-300 bg-white p-5 text-slate-950">
    <h2 className="text-2xl font-black">Website code repairs</h2>
    <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-600">Describe a problem on a public page. The coding agent prepares a fix, runs tests and checks the page in a browser. Passing changes arrive as a draft pull request for review. It can try one correction if verification fails.</p>
    <p role="status" className={`mt-3 text-sm font-bold ${connected ? "text-emerald-800" : "text-amber-800"}`}>{connected ? "Coding worker connected · queued requests are checked about every five minutes" : configured ? "Worker has not checked in recently · requests will wait in the queue" : "Worker activation required · repairs cannot start yet"}</p>
    <form onSubmit={submit} className="mt-5 grid gap-4">
      <label className="text-sm font-bold">What needs fixing?<textarea required minLength={3} maxLength={800} rows={3} value={description} onChange={event => setDescription(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3" placeholder="Describe what happens and what should happen instead." /></label>
      <label className="text-sm font-bold">Public page<input required value={pagePath} onChange={event => setPagePath(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3" placeholder="/rentals" /></label>
      <label className="text-sm font-bold">Text that should be visible after the fix<input required minLength={3} maxLength={180} value={expectedText} onChange={event => setExpectedText(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3" placeholder="The wording the browser should find" /></label>
      <button disabled={busy || !configured} className="justify-self-start rounded-full bg-indigo-800 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "Queuing…" : "Prepare a code fix"}</button>
    </form>
    {error ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-900">{error}</p> : null}
    <p className="mt-4 text-xs text-slate-500">Use technical descriptions without customer details or credentials. This workflow covers public-page code. Payments, login/security, legal waiver terms and production integrations need a separate reviewed task. It never merges or deploys a repair.</p>
    <div className="mt-6 space-y-3" aria-label="Code repair history">
      {repairs.length === 0 ? <p className="text-sm text-slate-500">No repair requests yet.</p> : repairs.map(repair => <article key={repair.id} className="rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{repair.description}</h3><span className="text-sm font-black">{repair.status.replaceAll("_", " ")}</span></div>
        <p className="mt-1 text-xs text-slate-500">{repair.page_path} · {formatAgentTime(repair.created_at)}</p>
        {repair.result ? <p className="mt-2 text-sm">{repair.result.summary}</p> : null}
        {repair.result?.pullRequestUrl ? <a href={repair.result.pullRequestUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-bold text-indigo-800 underline">Review the proposed fix →</a> : null}
        {repair.run_url ? <a href={repair.run_url} target="_blank" rel="noopener noreferrer" className="ml-4 mt-3 inline-block text-sm text-slate-600 underline">Worker checks</a> : null}
        {["queued", "running"].includes(repair.status) ? <button type="button" onClick={() => void cancel(repair.id)} className="ml-4 text-sm font-bold text-rose-800 underline">Cancel repair</button> : null}
      </article>)}
    </div>
  </section>;
}
