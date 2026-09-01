"use client";

import { FormEvent, useState } from "react";

import type { SupervisorSnapshot } from "@/lib/agent-manager/supervisor";

type ConversationItem = { id: string; question: string; reply: string; createdAt: string };

const STARTERS = ["Check the whole website", "Check bookings and calendars", "Check rentals and inventory", "Check code and security"];

export function SupervisorChat({ initialMessages, initialSnapshot }: { initialMessages: ConversationItem[]; initialSnapshot: SupervisorSnapshot | null }) {
  const [messages, setMessages] = useState(initialMessages);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(value: string) {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/agents/supervisor-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const body = await response.json() as { ok?: boolean; jobId?: string; reply?: string; snapshot?: SupervisorSnapshot; error?: string };
      if (!response.ok || !body.jobId || !body.reply || !body.snapshot) throw new Error(body.error || "Permanent Agent request failed safely.");
      setMessages((current) => [...current, { id: body.jobId!, question: trimmed, reply: body.reply!, createdAt: new Date().toISOString() }].slice(-20));
      setSnapshot(body.snapshot);
      setMessage("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Permanent Agent request failed safely.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(message);
  }

  const critical = snapshot?.issues.filter((issue) => issue.severity === "critical").length ?? 0;
  const warnings = snapshot?.issues.filter((issue) => issue.severity === "warning").length ?? 0;

  return (
    <section className="mt-7 rounded-3xl border border-slate-300 bg-slate-950 p-5 text-white shadow-xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">Permanent Agent</p>
          <h2 className="mt-1 text-2xl font-black">Website supervisor</h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-300">Talk to the supervisor about the website, bookings, rentals, agents, answering machine, deployments, and code/security health.</p>
        </div>
        <div className="flex gap-2 text-xs font-black">
          <span className={`rounded-full px-3 py-1 ${critical ? "bg-rose-500" : "bg-emerald-600"}`}>{critical} critical</span>
          <span className={`rounded-full px-3 py-1 ${warnings ? "bg-amber-400 text-slate-950" : "bg-slate-700"}`}>{warnings} warnings</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {STARTERS.map((starter) => <button key={starter} disabled={busy} onClick={() => void send(starter)} className="rounded-full border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-black hover:border-sky-400 disabled:opacity-50">{starter}</button>)}
      </div>

      <div className="mt-5 max-h-[32rem] space-y-4 overflow-y-auto rounded-2xl bg-white p-4 text-slate-950">
        {messages.length === 0 ? (
          <div className="rounded-xl bg-sky-50 p-4 text-sm font-semibold text-slate-700">
            I am ready. Ask me what is wrong, what needs attention, or to run a safe check. Exact controls include “pause booking agent,” “run booking scan,” and “emergency stop.”
          </div>
        ) : messages.map((item) => (
          <div key={item.id} className="space-y-2">
            <div className="ml-auto max-w-3xl rounded-2xl bg-sky-700 px-4 py-3 text-sm font-bold text-white">{item.question}</div>
            <div className="max-w-3xl rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold leading-6 text-slate-800">{item.reply}</div>
          </div>
        ))}
        {busy ? <p className="text-sm font-bold text-slate-500">Checking the live systems…</p> : null}
      </div>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="permanent-agent-message">Message the Permanent Agent</label>
        <textarea id="permanent-agent-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={800} rows={2} placeholder="Ask the Permanent Agent…" className="min-h-14 flex-1 resize-y rounded-2xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-500 focus:border-sky-400" />
        <button disabled={busy || !message.trim()} className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50">{busy ? "Checking…" : "Send"}</button>
      </form>
      {error ? <p role="alert" className="mt-3 rounded-xl bg-rose-950 p-3 text-sm font-bold text-rose-100">{error}</p> : null}
      <p className="mt-3 text-xs font-semibold text-slate-400">Do not paste passwords, tokens, or customer details. Safe checks and exact pause/emergency controls may run immediately; code, content, booking, calendar, customer-message, payment, deletion, and deployment changes remain approval-gated.</p>
    </section>
  );
}
