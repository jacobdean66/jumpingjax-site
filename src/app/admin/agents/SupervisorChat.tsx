"use client";

import { FormEvent, useRef, useState } from "react";

import type { SupervisorRelatedAction, SupervisorSnapshot } from "@/lib/agent-manager/supervisor";

type ConversationItem = { id: string; question: string; reply: string; createdAt: string; relatedAction?: SupervisorRelatedAction | null };

const STARTERS = ["Check the whole website", "Check bookings and calendars", "Check agent connections", "Check code and security", "Ask Waiver Agent to review waiver integrity", "Ask Booking Agent to review booking workflows"];

export function SupervisorChat({ initialMessages, initialSnapshot }: { initialMessages: ConversationItem[]; initialSnapshot: SupervisorSnapshot | null }) {
  const [messages, setMessages] = useState(() => [...initialMessages].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
  const historyRef = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issueFilter, setIssueFilter] = useState<"critical" | "warning" | null>(null);
  const [servicesOpen, setServicesOpen] = useState(false);
  const inFlightRef = useRef(false);

  async function send(value: string) {
    const trimmed = value.trim();
    if (!trimmed || inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/agents/supervisor-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, clientRequestId: crypto.randomUUID() }),
      });
      const body = await response.json() as { ok?: boolean; jobId?: string; reply?: string; snapshot?: SupervisorSnapshot; relatedAction?: SupervisorRelatedAction | null; error?: string };
      if (!response.ok || !body.jobId || !body.reply || !body.snapshot) throw new Error(body.error || "Permanent Agent request failed safely.");
      setMessages((current) => [{ id: body.jobId!, question: trimmed, reply: body.reply!, createdAt: new Date().toISOString(), relatedAction: body.relatedAction ?? null }, ...current.filter((item) => item.id !== body.jobId)].slice(0, 20));
      historyRef.current?.scrollTo({ top: 0 });
      setSnapshot(body.snapshot);
      window.dispatchEvent(new Event("agent-manager:refresh"));
      setMessage("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Permanent Agent request failed safely.");
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(message);
  }

  const critical = snapshot?.issues.filter((issue) => issue.severity === "critical").length ?? 0;
  const warnings = snapshot?.issues.filter((issue) => issue.severity === "warning").length ?? 0;
  const connectedServices = snapshot?.services.filter((service) => service.state === "connected").length ?? 0;
  const serviceTotal = snapshot?.services.length ?? 0;
  const attentionServices = snapshot?.services.filter((service) => service.state !== "connected") ?? [];

  return (
    <section className="mt-7 rounded-3xl border border-slate-300 bg-slate-950 p-5 text-white shadow-xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">Permanent Agent</p>
          <h2 className="mt-1 text-2xl font-black">Website supervisor</h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-300">Talk to the supervisor about the website, bookings, rentals, agents, answering machine, deployments, and code/security health.</p>
        </div>
        <div className="flex gap-2 text-xs font-black">
          <button type="button" aria-expanded={issueFilter === "critical"} aria-controls="supervisor-issues" onClick={() => setIssueFilter(issueFilter === "critical" ? null : "critical")} className={`rounded-full px-3 py-1 hover:ring-2 hover:ring-white ${critical ? "bg-rose-500" : "bg-emerald-600"}`}>{critical} critical</button>
          <button type="button" aria-expanded={issueFilter === "warning"} aria-controls="supervisor-issues" onClick={() => setIssueFilter(issueFilter === "warning" ? null : "warning")} className={`rounded-full px-3 py-1 hover:ring-2 hover:ring-white ${warnings ? "bg-amber-400 text-slate-950" : "bg-slate-700"}`}>{warnings} warnings</button>
        </div>
      </div>

      {issueFilter && <div id="supervisor-issues" className="mt-4 rounded-2xl border border-slate-600 bg-slate-900 p-4">
        <h3 className="text-sm font-black">{issueFilter === "critical" ? "Critical issues" : "Warnings"}</h3>
        {snapshot?.issues.some((issue) => issue.severity === issueFilter) ? <ul className="mt-2 space-y-2">
          {snapshot.issues.filter((issue) => issue.severity === issueFilter).map((issue) => <li key={issue.code} className="text-sm text-slate-200"><p>{issue.summary}</p><a className="mt-1 inline-block font-bold text-sky-300 underline" href={{ website: "/admin/site-settings", bookings: "/admin/rentals", rentals: "/admin/rentals", agents: "#agent-controls", answering_machine: "/admin/answering-machine", security: "/admin/security" }[issue.area]}>Open {issue.area.replaceAll("_", " ")} →</a></li>)}
        </ul> : <p className="mt-2 text-sm text-slate-300">No {issueFilter} issues in the latest check.</p>}
      </div>}

      <div className="mt-4 flex flex-wrap gap-2">
        {STARTERS.map((starter) => <button key={starter} disabled={busy} onClick={() => void send(starter)} className="rounded-full border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-black hover:border-sky-400 disabled:opacity-50">{starter}</button>)}
      </div>

      {snapshot ? (
        <div className="mt-5 grid gap-3 border-y border-slate-700 py-4 lg:grid-cols-[220px_1fr]">
          <div className="p-2">
            <p className="text-xs font-black uppercase text-slate-400">Service coverage</p>
            <button type="button" aria-expanded={servicesOpen} aria-controls="supervisor-services" onClick={() => setServicesOpen(!servicesOpen)} className="mt-1 text-3xl font-black text-sky-300 underline decoration-slate-600 underline-offset-4">{connectedServices}/{serviceTotal}</button>
            <p className="mt-1 text-xs font-semibold text-slate-300">connected with a current read-only check</p>
          </div>
          <div className="border-l-0 border-slate-700 p-2 lg:border-l lg:pl-5">
            <p className="text-xs font-black uppercase text-slate-400">Needs attention</p>
            {attentionServices.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {attentionServices.map((service) => (
                  <a key={service.key} href={service.href} title={service.blocker ?? service.summary} className={`rounded-full px-3 py-1 text-xs font-black ${service.state === "unavailable" ? "bg-rose-600 text-white" : service.state === "setup_required" ? "bg-amber-400 text-slate-950" : "bg-slate-700 text-white"}`}>
                    {service.name}
                  </a>
                ))}
              </div>
            ) : <p className="mt-2 text-sm font-bold text-emerald-300">All registered services are connected.</p>}
          </div>
          <details id="supervisor-services" open={servicesOpen} onToggle={(event) => setServicesOpen(event.currentTarget.open)} className="lg:col-span-2">
            <summary className="cursor-pointer text-sm font-black text-sky-300">View all service connections</summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {snapshot.services.map((service) => (
                <a key={service.key} href={service.href} className="border-l-2 border-slate-600 px-3 py-2 hover:border-sky-400">
                  <span className="flex items-center justify-between gap-2 text-sm font-black">
                    {service.name}
                    <span className={service.state === "connected" ? "text-emerald-300" : service.state === "unavailable" ? "text-rose-300" : "text-amber-300"}>{service.state.replaceAll("_", " ")}</span>
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-slate-300">{service.summary}</span>
                </a>
              ))}
            </div>
          </details>
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="permanent-agent-message">Message the Permanent Agent</label>
        <textarea id="permanent-agent-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={800} rows={2} placeholder="Ask the Permanent Agent…" className="min-h-14 flex-1 resize-y rounded-2xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-500 focus:border-sky-400" />
        <button disabled={busy || !message.trim()} className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50">{busy ? "Checking…" : "Send"}</button>
      </form>

      <div className="mt-5 flex items-center justify-between gap-2"><h3 className="text-sm font-black">Recent chats</h3><span className="text-xs text-slate-300">Newest first</span></div>
      <div ref={historyRef} aria-label="Permanent agent chat history" className="mt-2 max-h-[32rem] space-y-4 overflow-y-auto rounded-2xl bg-white p-4 text-slate-950">
        {busy ? <p role="status" className="text-sm font-bold text-slate-500">Checking the live systems…</p> : null}
        {messages.length === 0 ? (
          <div className="rounded-xl bg-sky-50 p-4 text-sm font-semibold text-slate-700">
            I am ready. Ask me what is wrong, what needs attention, or to run a safe check. Exact controls include “pause booking agent,” “run booking scan,” and “emergency stop.”
          </div>
        ) : messages.map((item) => (
          <article key={item.id} className="space-y-2 border-b border-slate-200 pb-4 last:border-0 last:pb-0">
            <time suppressHydrationWarning dateTime={item.createdAt} className="block text-xs font-semibold text-slate-500">{new Date(item.createdAt).toLocaleString()}</time>
            <div className="ml-auto max-w-3xl rounded-2xl bg-sky-700 px-4 py-3 text-sm font-bold text-white">{item.question}</div>
            <div className="max-w-3xl rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold leading-6 text-slate-800">
              <p>{item.reply}</p>
              {item.relatedAction ? <a href={item.relatedAction.href} className="mt-3 inline-flex rounded-full bg-violet-700 px-4 py-2 text-xs font-black text-white hover:bg-violet-800">{item.relatedAction.label}</a> : null}
            </div>
          </article>
        ))}
      </div>

      {error ? <p role="alert" className="mt-3 rounded-xl bg-rose-950 p-3 text-sm font-bold text-rose-100">{error}</p> : null}
      <p className="mt-3 text-xs font-semibold text-slate-400">Do not paste passwords, tokens, or customer details. Safe checks and exact pause/emergency controls may run immediately; code, content, booking, calendar, customer-message, payment, deletion, and deployment changes remain approval-gated.</p>
    </section>
  );
}
