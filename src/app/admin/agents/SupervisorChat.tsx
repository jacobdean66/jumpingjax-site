"use client";
import { formatAgentTime } from "./time";

import { FormEvent, useRef, useState } from "react";

import type { SupervisorRelatedAction, SupervisorSnapshot } from "@/lib/agent-manager/supervisor";
import { supervisorIssueAction } from "./navigation";
import { SupervisorComposer } from "./SupervisorComposer";
import { SupervisorReply } from "./SupervisorReply";
import { parseInvestigationEvidence, type InvestigationTrace } from '@/lib/agent-manager/investigation';
import Image from 'next/image';
import { MAX_CHAT_PICTURES, type ChatPicture } from '@/lib/agent-manager/chat-pictures';
import { prepareChatPicture } from './chat-picture-client';
import { createSupervisorRequest } from './supervisor-chat-request';

type ConversationItem = { id: string; question: string; reply: string; createdAt: string; relatedAction?: SupervisorRelatedAction | null; evidence?: InvestigationTrace[]; pictureCount?: number; pictures?: ChatPicture[] };

export function SupervisorChat({ initialMessages, initialSnapshot }: { initialMessages: ConversationItem[]; initialSnapshot: SupervisorSnapshot | null }) {
  const [messages, setMessages] = useState(() => [...initialMessages].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
  const historyRef = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState('');
  const [stopping, setStopping] = useState(false);
  const activeRequest = useRef<ReturnType<typeof createSupervisorRequest> | null>(null);
  const [pictures, setPictures] = useState<ChatPicture[]>([]);
  const [preparingPictures, setPreparingPictures] = useState(false);
  const addingPicturesRef = useRef(false);
  const [issueFilter, setIssueFilter] = useState<"critical" | "warning" | null>(null);
  const [servicesOpen, setServicesOpen] = useState(false);
  const inFlightRef = useRef(false);

  async function send(value: string) {
    const trimmed = value.trim() || (pictures.length ? 'Please look at the attached pictures and tell me what you see.' : '');
    if (!trimmed || inFlightRef.current || addingPicturesRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setError("");
    setNotice('');
    const request = createSupervisorRequest();
    activeRequest.current = request;
    try {
      const body = await request.send(trimmed, pictures);
      if (!body || request.stopped || activeRequest.current !== request) return;
      setMessages((current) => [{ id: body.jobId!, question: trimmed, reply: body.reply!, createdAt: new Date().toISOString(), relatedAction: body.relatedAction ?? null, evidence: parseInvestigationEvidence(body.evidence), pictureCount: pictures.length, pictures }, ...current.filter((item) => item.id !== body.jobId)].slice(0, 20));
      requestAnimationFrame(() => historyRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
      setSnapshot(body.snapshot);
      window.dispatchEvent(new Event("agent-manager:refresh"));
      setMessage("");
      setPictures([]);
    } catch (caught) {
      if (!request.stopped) setError(caught instanceof Error ? caught.message : "Permanent Agent request failed safely.");
    } finally {
      if (activeRequest.current === request && !request.stopped) {
        activeRequest.current = null;
        inFlightRef.current = false;
        setBusy(false);
      }
    }
  }

  async function stop() {
    const request = activeRequest.current;
    if (!request || stopping) return;
    setStopping(true);
    setError('');
    try {
      const result = await request.stop();
      if (activeRequest.current !== request) return;
      activeRequest.current = null;
      inFlightRef.current = false;
      setBusy(false);
      setNotice(result.stopped ? 'Reply stopped. You can edit your message and send again. Completed actions are not undone.' : 'This request had already finished. Check Recent chats after refreshing.');
      requestAnimationFrame(() => document.getElementById('permanent-agent-message')?.focus());
    } catch { setError('Could not confirm the server stopped. Press Stop again to retry.'); }
    finally { setStopping(false); }
  }

  async function addPictures(files: File[]) {
    if (inFlightRef.current || addingPicturesRef.current || !files.length) return;
    setError('');
    if (pictures.length + files.length > MAX_CHAT_PICTURES) { setError(`Attach up to ${MAX_CHAT_PICTURES} pictures per message. Remove one first.`); return; }
    addingPicturesRef.current = true;
    setPreparingPictures(true);
    try {
      const prepared = await Promise.all(files.map(prepareChatPicture));
      setPictures(current => [...current, ...prepared]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The picture could not be prepared. Try another picture.'); }
    finally { addingPicturesRef.current = false; setPreparingPictures(false); }
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

  function renderMessage(item: ConversationItem) {
    return <article key={item.id} className="space-y-2 border-b border-slate-200 pb-4 last:border-0 last:pb-0">
      <time dateTime={item.createdAt} className="block text-xs font-semibold text-slate-500">{formatAgentTime(item.createdAt)}</time>
      <div className="ml-auto max-w-3xl rounded-2xl bg-sky-700 px-4 py-3 text-sm font-bold text-white">
        {item.question}
        {item.pictures?.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{item.pictures.map((picture, index) => <Image key={index} src={picture.dataUrl} alt={`Attached picture ${index + 1}`} width={512} height={384} unoptimized className="max-h-64 w-full rounded-lg bg-white object-contain" />)}</div> : item.pictureCount ? <p className="mt-2 text-xs font-normal">{item.pictureCount} {item.pictureCount === 1 ? 'picture was' : 'pictures were'} attached. Reattach to inspect again.</p> : null}
      </div>
      <div className="max-w-3xl rounded-2xl bg-slate-100 px-4 py-4 text-slate-800 sm:px-5">
        <SupervisorReply text={item.reply} />
        {item.evidence?.length ? <details className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-600"><summary className="cursor-pointer font-semibold">Sources checked ({item.evidence.length})</summary><ul className="mt-2 space-y-2">{item.evidence.map((entry, index) => <li key={index} className="break-words"><span className={entry.ok ? 'text-emerald-800' : 'text-rose-800'}>{entry.ok ? 'Checked' : 'Unavailable'}</span> · {entry.source}<span className="block text-xs">{formatAgentTime(entry.checkedAt)}{entry.limited ? ' · Limited scope' : ''}</span></li>)}</ul></details> : null}
        {item.relatedAction ? <a href={item.relatedAction.href} className="mt-3 inline-flex rounded-full bg-violet-700 px-4 py-2 text-xs font-black text-white hover:bg-violet-800">{item.relatedAction.label}</a> : null}
      </div>
    </article>;
  }

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
          {snapshot.issues.filter((issue) => issue.severity === issueFilter).map((issue) => {
            const action = supervisorIssueAction(issue, snapshot.services);
            return <li key={issue.code} className="text-sm text-slate-200"><p>{issue.summary}</p><div className="mt-1 flex flex-wrap gap-4"><a className="inline-block font-bold text-sky-300 underline" href={action.href}>{action.label} →</a><a className="inline-block font-bold text-sky-300 underline" href={`/admin/agents?researchIssue=${encodeURIComponent(issue.code)}#tech-search`}>Research this finding →</a></div></li>;
          })}
        </ul> : <p className="mt-2 text-sm text-slate-300">No {issueFilter} issues in the latest check.</p>}
      </div>}

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

      <SupervisorComposer message={message} busy={busy || preparingPictures} stopping={stopping} onStop={() => { void stop(); }} preparingPictures={preparingPictures} pictures={pictures} onAddPictures={files => { void addPictures(files); }} onRemovePicture={index => { setPictures(current => current.filter((_, at) => at !== index)); setError(''); }} onChange={setMessage} onSubmit={submit} />
      {notice ? <p role="status" className="mt-3 text-sm font-semibold text-sky-200">{notice}</p> : null}

      <div className="mt-5 flex items-center justify-between gap-2"><h3 className="text-sm font-black">Recent chats</h3><span className="text-xs text-slate-300">Newest first · Eastern time</span></div>
      <div ref={historyRef} aria-label="Permanent agent chat history" className="mt-2 scroll-mt-4 space-y-4 rounded-2xl bg-white p-4 text-slate-950">
        {busy ? <p role="status" className="text-sm font-bold text-slate-500">{stopping ? 'Stopping…' : 'Preparing a reply…'}</p> : null}
        {messages.length === 0 ? (
          <div className="rounded-xl bg-sky-50 p-4 text-sm font-semibold text-slate-700">
            I am ready. Ask me what is wrong, what needs attention, or to run a safe check. Exact controls include “pause booking agent,” “run booking scan,” and “emergency stop.”
          </div>
        ) : <>
          {renderMessage(messages[0])}
          {messages.length > 1 ? <details className="border-t border-slate-200 pt-4">
            <summary className="min-h-11 cursor-pointer text-sm font-bold text-sky-800">Earlier chats ({messages.length - 1})</summary>
            <div className="mt-3 space-y-4">{messages.slice(1).map(renderMessage)}</div>
          </details> : null}
        </>}
      </div>

      {error ? <p role="alert" className="mt-3 rounded-xl bg-rose-950 p-3 text-sm font-bold text-rose-100">{error}</p> : null}
      <p className="mt-3 text-xs font-semibold text-slate-400">Do not paste passwords, tokens, or customer details. Ask for a rental item draft or a website, dashboard or print coding fix. Review drafts before saving; protected pages require owner preview checks. Production code, content, booking, calendar, customer-message, payment, deletion, and deployment changes remain approval-gated.</p>
    </section>
  );
}
