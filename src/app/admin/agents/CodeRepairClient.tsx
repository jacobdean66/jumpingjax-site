"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CodeRepairItem } from "@/lib/agent-manager/code-repair";
import { CodeRepairHistory } from "./CodeRepairHistory";

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
    <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">Tell us what is wrong with a public website page. The agent prepares and tests a fix for you to review before it goes live.</p>
    <p role="status" className={`mt-3 text-sm font-bold ${connected ? "text-emerald-800" : "text-amber-800"}`}>{connected ? "Coding worker connected · queued requests are checked about every five minutes" : configured ? "Worker has not checked in recently · requests will wait in the queue" : "Worker activation required · repairs cannot start yet"}</p>
    <form onSubmit={submit} className="mt-5 grid gap-4">
      <label className="text-sm font-bold">What needs fixing?<textarea required minLength={3} maxLength={800} rows={3} value={description} onChange={event => setDescription(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3" placeholder="Describe what happens and what should happen instead." /></label>
      <label className="text-sm font-bold">Public page<input required value={pagePath} onChange={event => setPagePath(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3" placeholder="/rentals" /></label>
      <label className="text-sm font-bold">Text we should see on the fixed page<input required minLength={3} maxLength={180} value={expectedText} onChange={event => setExpectedText(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3" placeholder="A heading, button label, or other text on the page" /></label>
      <button disabled={busy || !configured} className="justify-self-start rounded-full bg-indigo-800 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "Queuing…" : "Prepare a code fix"}</button>
    </form>
    {error ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-900">{error}</p> : null}
    <p className="mt-4 text-sm leading-6 text-slate-500">Describe the problem in your own words. Leave out customer details and passwords. This tool fixes public pages; admin tools, payments, login, waivers and integrations need separate review. You approve changes before they go live.</p>
    <CodeRepairHistory repairs={repairs} onCancel={id => void cancel(id)} />
  </section>;
}
