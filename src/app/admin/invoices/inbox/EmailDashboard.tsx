"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, Inbox, Mail, RefreshCw, Send } from "lucide-react";
import { applyEmailChange, EMAIL_CATEGORIES, EMAIL_STATUSES, filterEmails, type EmailAccount, type EmailAccountInfo, type EmailCategory, type EmailDetail, type EmailFolder, type EmailStatus, type EmailSummary, type WorkflowChange } from "@/lib/email/dashboard-core";

type MailboxState = { messages: EmailSummary[]; next: string | null; loading: boolean; connected: boolean; error: string; warning: string };
type Page = { messages: EmailSummary[]; next: string | null; warning: string };
const emptyMailbox = (): MailboxState => ({ messages: [], next: null, loading: false, connected: false, error: "", warning: "" });
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50";
const input = "min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}
async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Email could not be loaded.");
  return data as T;
}
export function EmailDashboard({ accounts, initialAccount = "all", initialFolder = "inbox", initialId = "", connectionMessage = "" }: {
  accounts: EmailAccountInfo[]; initialAccount?: "all" | EmailAccount; initialFolder?: EmailFolder; initialId?: string; connectionMessage?: string;
}) {
  const [account, setAccount] = useState(initialAccount);
  const [folder, setFolder] = useState<EmailFolder>(initialFolder);
  const [category, setCategory] = useState<"all" | EmailCategory>("all");
  const [status, setStatus] = useState<"all" | EmailStatus>("all");
  const [unread, setUnread] = useState(false);
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [boxes, setBoxes] = useState<Record<EmailAccount, MailboxState>>({ office: emptyMailbox(), gmail: emptyMailbox() });
  const [selection, setSelection] = useState<{ account: EmailAccount; id: string } | null>(initialId ? { account: initialAccount === "gmail" ? "gmail" : "office", id: initialId } : null);
  const [detail, setDetail] = useState<EmailDetail | null>(null);
  const [reading, setReading] = useState(false);
  const [readerError, setReaderError] = useState("");
  const [saving, setSaving] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const generation = useRef(0);
  const savedChanges = useRef(new Map<string, WorkflowChange[]>());
  const reader = useRef<HTMLElement>(null);

  const saveChange = useCallback(async (change: WorkflowChange, automatic = false) => {
    const key = `${change.account}:${change.id}`;
    setSaving(key); setSaveError(""); if (!automatic) setSaveNotice("");
    try {
      const response = await fetch("/api/admin/email/workflow", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "This change was not saved.");
      const changes = savedChanges.current.get(key) ?? [];
      savedChanges.current.set(key, [...changes.filter(row => row.field !== change.field), change]);
      setBoxes(current => ({ ...current, [change.account]: { ...current[change.account], messages: current[change.account].messages.map(row => applyEmailChange(row, change)) } }));
      setDetail(current => current ? applyEmailChange(current, change) : current);
      if (!automatic) setSaveNotice("Saved for your team.");
    } catch (failure) { setSaveError(failure instanceof Error ? failure.message : "This change was not saved. Please try again."); }
    finally { setSaving(current => current === key ? "" : current); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const currentGeneration = ++generation.current;
    savedChanges.current.clear();
    setBoxes({ office: emptyMailbox(), gmail: emptyMailbox() });
    for (const info of accounts) {
      if (!info.ready) continue;
      setBoxes(current => ({ ...current, [info.id]: { ...emptyMailbox(), loading: true } }));
      void getJson<Page>(`/api/admin/email/messages?account=${info.id}&folder=${folder}`, controller.signal).then(page => {
        if (generation.current !== currentGeneration || controller.signal.aborted) return;
        const messages = page.messages.map(row => (savedChanges.current.get(row.key) ?? []).reduce(applyEmailChange, row));
        setBoxes(current => ({ ...current, [info.id]: { messages, next: page.next, loading: false, connected: true, error: "", warning: page.warning } }));
      }).catch(failure => {
        if (!controller.signal.aborted && generation.current === currentGeneration) setBoxes(current => ({ ...current, [info.id]: { ...emptyMailbox(), error: failure instanceof Error ? failure.message : "Email could not be loaded." } }));
      });
    }
    return () => controller.abort();
  }, [accounts, folder, revision]);

  useEffect(() => {
    if (!selection) { setDetail(null); setReading(false); return; }
    const controller = new AbortController();
    setDetail(null); setReading(true); setReaderError(""); setSaveError(""); setSaveNotice("");
    reader.current?.scrollIntoView({ block: "start" });
    const query = new URLSearchParams({ ...selection, folder });
    void getJson<{ message: EmailDetail }>(`/api/admin/email/message?${query}`, controller.signal).then(({ message }) => {
      if (controller.signal.aborted) return;
      const current = (savedChanges.current.get(message.key) ?? []).reduce<EmailDetail>((row, change) => applyEmailChange(row, change), message);
      setDetail(current); setReading(false);
      if (current.unread && !current.workflowWarning) void saveChange({ ...selection, folder, field: "read", value: true }, true);
    }).catch(failure => {
      if (!controller.signal.aborted) { setReaderError(failure instanceof Error ? failure.message : "Email could not be loaded."); setReading(false); }
    });
    return () => controller.abort();
  }, [selection, folder, revision, saveChange]);

  async function loadOlder(info: EmailAccountInfo) {
    const cursor = boxes[info.id].next;
    if (!cursor || boxes[info.id].loading) return;
    const version = generation.current;
    setBoxes(current => ({ ...current, [info.id]: { ...current[info.id], loading: true, error: "" } }));
    try {
      const query = new URLSearchParams({ account: info.id, folder, cursor });
      const page = await getJson<Page>(`/api/admin/email/messages?${query}`);
      if (version !== generation.current) return;
      setBoxes(current => {
        const rows = new Map(current[info.id].messages.map(row => [row.key, row]));
        for (const row of page.messages) rows.set(row.key, (savedChanges.current.get(row.key) ?? []).reduce(applyEmailChange, row));
        return { ...current, [info.id]: { messages: [...rows.values()], next: page.next === cursor ? null : page.next, connected: true, loading: false, error: "", warning: page.warning } };
      });
    } catch (failure) {
      if (version === generation.current) setBoxes(current => ({ ...current, [info.id]: { ...current[info.id], loading: false, error: failure instanceof Error ? failure.message : "Earlier email could not be loaded." } }));
    }
  }
  const messages = useMemo(() => accounts.flatMap(info => boxes[info.id].messages), [accounts, boxes]);
  const scopedMessages = messages.filter(row => account === "all" || row.account === account);
  const shown = filterEmails(messages, { account, category, status, unread, search });
  const selected = selection ? messages.find(row => row.account === selection.account && row.id === selection.id) ?? detail : null;
  const activeAccounts = accounts.filter(info => account === "all" || info.id === account);
  const loading = activeAccounts.some(info => boxes[info.id].loading);
  const categoryCount = (id: EmailCategory) => scopedMessages.filter(row => row.category === id).length;
  const busy = Boolean(saving) || Boolean(selected && boxes[selected.account].warning) || Boolean(detail?.workflowWarning);
  const categoryLabel = (id: EmailCategory) => EMAIL_CATEGORIES.find(row => row.id === id)?.label || "Other";
  function chooseAccount(value: "all" | EmailAccount) { setAccount(value); setSelection(null); }
  function updateSelected(field: WorkflowChange["field"], value: string | boolean) {
    if (!selected) return;
    void saveChange({ account: selected.account, folder, id: selected.id, field, value } as WorkflowChange);
  }
  return <div className="mt-6 min-w-0">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">Your inboxes, organized in one place.</p><Link href="/admin/invoices" className="text-sm font-bold text-indigo-700 underline">Invoices</Link></div>
    <section aria-label="Connected email accounts" className="grid gap-3 sm:grid-cols-2">
      {accounts.map(info => {
        const box = boxes[info.id];
        const state = info.needsConnection ? "Needs connection" : info.error || box.error ? "Needs attention" : box.connected ? "Connected" : info.ready ? "Checking connection…" : "Not connected";
        return <article key={info.id} className={`min-w-0 rounded-2xl border bg-white p-4 shadow-sm ${account === info.id ? "border-indigo-500 ring-1 ring-indigo-500" : "border-slate-200"}`}>
          <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${info.id === "gmail" ? "bg-indigo-100 text-indigo-700" : "bg-sky-100 text-sky-900"}`}><Mail size={21} /></span><div className="min-w-0"><p className="text-sm font-black text-slate-900">{info.name}</p><p className="mt-1 break-all text-xs text-slate-600">{info.address}</p></div></div></div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${state === "Connected" ? "bg-emerald-50 text-emerald-800" : state === "Checking connection…" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-900"}`}>{state === "Connected" && <Check size={13} />}{state}</span>
            {info.id === "gmail" && (info.needsConnection || box.error || info.error) ? <form action="/api/admin/ad-analytics/google/connect?service=gmail" method="post"><button className="min-h-10 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">{info.needsConnection ? "Connect Gmail" : "Reconnect Gmail"}</button></form> : <button onClick={() => chooseAccount(info.id)} aria-pressed={account === info.id} className="min-h-10 rounded-lg px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50">View account</button>}
          </div>
          {(info.error || box.error) && <p role="alert" className="mt-3 text-xs leading-5 text-rose-700">{info.error || box.error}</p>}
          {info.needsConnection && <p className="mt-3 text-xs leading-5 text-slate-500">Approve Google access once to keep this account connected across devices.</p>}
        </article>;
      })}
    </section>
    {connectionMessage && <p role="status" className="mt-4 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-950">{connectionMessage}</p>}
    {accounts.map(info => boxes[info.id].warning && <p key={info.id} role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{info.name}: {boxes[info.id].warning}</p>)}
    <section aria-label="Email filters" className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2"><button onClick={() => chooseAccount("all")} aria-pressed={account === "all"} className={`${button} ${account === "all" ? "!border-indigo-600 !bg-indigo-600 !text-white" : ""}`}>All accounts</button><button onClick={() => { setFolder("inbox"); setSelection(null); }} aria-pressed={folder === "inbox"} className={`${button} ${folder === "inbox" ? "!border-indigo-300 !bg-indigo-50 !text-indigo-900" : ""}`}><Inbox size={16} />Inbox</button><button onClick={() => { setFolder("sent"); setSelection(null); }} aria-pressed={folder === "sent"} className={`${button} ${folder === "sent" ? "!border-indigo-300 !bg-indigo-50 !text-indigo-900" : ""}`}><Send size={16} />Sent</button></div><button onClick={() => setRevision(value => value + 1)} disabled={loading} className={button}><RefreshCw size={15} className={loading ? "animate-spin motion-reduce:animate-none" : ""} />Refresh</button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px_130px]">
        <label className="min-w-0"><span className="mb-1 block text-xs font-bold text-slate-600">Search loaded emails</span><input className={input} type="search" value={search} onChange={event => setSearch(event.target.value)} maxLength={200} placeholder="Name, subject, email, or invoice #" /></label>
        <label><span className="mb-1 block text-xs font-bold text-slate-600">Reply status</span><select aria-label="Filter by reply status" className={input} value={status} onChange={event => setStatus(event.target.value as typeof status)}><option value="all">All reply statuses</option>{EMAIL_STATUSES.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
        <label className="flex min-h-11 items-center gap-2 self-end rounded-xl border border-slate-300 px-3 text-sm font-bold"><input type="checkbox" checked={unread} onChange={event => setUnread(event.target.checked)} className="h-4 w-4 accent-indigo-600" />Unread only</label>
        <label className="sm:col-span-2 xl:hidden"><span className="mb-1 block text-xs font-bold text-slate-600">Category</span><select aria-label="Filter by category" className={input} value={category} onChange={event => setCategory(event.target.value as typeof category)}><option value="all">All categories ({scopedMessages.length})</option>{EMAIL_CATEGORIES.map(row => <option key={row.id} value={row.id}>{row.label} ({categoryCount(row.id)})</option>)}</select></label>
      </div>
    </section>
    <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-[210px_310px_minmax(0,1fr)]">
      <aside aria-label="Email categories" className="hidden self-start rounded-2xl border border-slate-200 bg-white p-3 xl:block"><p className="px-2 py-2 text-xs font-black uppercase tracking-wider text-slate-500">Categories</p><button className={`mb-1 flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-bold ${category === "all" ? "bg-indigo-50 text-indigo-800" : "text-slate-700 hover:bg-slate-50"}`} onClick={() => setCategory("all")} aria-pressed={category === "all"}>All categories<span className="text-xs text-slate-500">{scopedMessages.length}</span></button>{EMAIL_CATEGORIES.map(row => <button key={row.id} onClick={() => setCategory(row.id)} aria-pressed={category === row.id} className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold ${category === row.id ? "bg-indigo-50 text-indigo-800" : "text-slate-600 hover:bg-slate-50"}`}><span>{row.label}</span><span className="text-slate-400">{categoryCount(row.id)}</span></button>)}<p className="mt-3 border-t border-slate-100 px-2 pt-3 text-xs leading-5 text-slate-500">Counts reflect loaded emails. Load older emails to include earlier messages.</p></aside>
      <section aria-label="Email messages" className={`min-w-0 self-start overflow-hidden rounded-2xl border border-slate-200 bg-white ${selection ? "hidden xl:block" : ""}`}>
        <header className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-black">{category === "all" ? "All categories" : categoryLabel(category)}</h2><p className="mt-1 text-xs text-slate-500" aria-live="polite">{shown.length} shown · {scopedMessages.length} loaded{loading ? " · Loading…" : ""}</p></header>
        {shown.length === 0 && <div className="p-7 text-center"><Mail size={30} className="mx-auto mb-3 text-slate-300" /><p className="text-sm font-bold text-slate-700">{loading ? "Loading your emails…" : "No emails to show"}</p><p className="mt-2 text-xs leading-5 text-slate-500">{loading ? "Each account loads separately." : scopedMessages.length ? "Try another category, clear the filters, or load older emails." : "Check the account connection above, or try refreshing."}</p><button onClick={() => { setCategory("all"); setStatus("all"); setUnread(false); setSearch(""); }} className="mt-4 min-h-11 text-xs font-bold text-indigo-700">Clear filters</button></div>}
        <ul className="divide-y divide-slate-100">{shown.map(mail => <li key={mail.key}><button onClick={() => setSelection({ account: mail.account, id: mail.id })} aria-pressed={selection?.account === mail.account && selection.id === mail.id} className={`block w-full border-l-4 p-4 text-left transition hover:bg-indigo-50 ${selection?.account === mail.account && selection.id === mail.id ? "border-indigo-600 bg-indigo-50" : "border-transparent"}`}>
          <div className="flex items-start gap-2">{mail.unread && <span aria-label="Unread" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-600" />}<p className={`min-w-0 break-words text-sm text-slate-950 ${mail.unread ? "font-black" : "font-semibold"}`}>{mail.subject || "(No subject)"}</p></div><p className="mt-1 truncate text-xs text-slate-600">{folder === "sent" ? `To: ${mail.to}` : mail.from}</p>
          <div className="mt-3 flex flex-wrap gap-1.5"><span className={`rounded-md px-2 py-1 text-[10px] font-bold ${mail.account === "gmail" ? "bg-indigo-100 text-indigo-800" : "bg-sky-100 text-sky-900"}`}>{accounts.find(info => info.id === mail.account)?.name}</span><span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] text-slate-600">{categoryLabel(mail.category)}</span>{mail.status !== "none" && <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-900">{EMAIL_STATUSES.find(row => row.id === mail.status)?.label}</span>}</div><p className="mt-2 text-[11px] text-slate-400">{dateLabel(mail.date)} ET</p>
        </button></li>)}</ul>
        <div className="space-y-2 border-t border-slate-100 p-3">{activeAccounts.map(info => boxes[info.id].next && <button key={info.id} disabled={boxes[info.id].loading} onClick={() => void loadOlder(info)} className={`${button} w-full !text-xs`}><ChevronDown size={15} />{boxes[info.id].loading ? "Loading…" : `Load older: ${info.name}`}</button>)}</div>
      </section>
      <section ref={reader} aria-label="Email reader" className={`min-w-0 scroll-mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white ${selection ? "" : "hidden xl:block"}`}>
        {selection && <div className="border-b border-slate-100 p-3 xl:hidden"><button onClick={() => setSelection(null)} className={button}><ArrowLeft size={16} />Back to emails</button></div>}
        {reading ? <p role="status" className="p-8 text-sm text-slate-500">Loading email…</p> : readerError ? <p role="alert" className="p-6 text-sm text-rose-700">{readerError}</p> : detail && selected && detail.key === selected.key ? <>
          <header className="border-b border-slate-200 p-5"><p className="mb-2 break-all text-xs font-bold text-indigo-700">{accounts.find(info => info.id === selected.account)?.address}</p><h2 className="break-words text-xl font-black text-slate-950">{selected.subject || "(No subject)"}</h2><dl className="mt-4 space-y-1 break-words text-xs leading-5 text-slate-600"><div><dt className="inline font-bold">From: </dt><dd className="inline break-all">{detail.from}</dd></div><div><dt className="inline font-bold">To: </dt><dd className="inline break-all">{detail.to}</dd></div>{detail.cc && <div><dt className="inline font-bold">CC: </dt><dd className="inline break-all">{detail.cc}</dd></div>}{detail.bcc && <div><dt className="inline font-bold">Office BCC: </dt><dd className="inline break-all">{detail.bcc}</dd></div>}<div><dt className="inline font-bold">Date: </dt><dd className="inline">{dateLabel(detail.date)} ET</dd></div></dl>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"><label><span className="mb-1 block text-xs font-bold text-slate-600">Category{selected.manualCategory ? "" : " · Suggested"}</span><select aria-label="Email category" className={input} value={selected.manualCategory ? selected.category : "auto"} disabled={busy} onChange={event => updateSelected("category", event.target.value)}><option value="auto">Auto: {categoryLabel(selected.suggestedCategory)}</option>{EMAIL_CATEGORIES.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label><label><span className="mb-1 block text-xs font-bold text-slate-600">Reply status</span><select aria-label="Email reply status" className={input} value={selected.status} disabled={busy} onChange={event => updateSelected("status", event.target.value)}>{EMAIL_STATUSES.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label></div>
            <div className="mt-3 flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={() => updateSelected("read", selected.unread)}>{selected.unread ? "Mark read" : "Mark unread"}</button>{selected.account === "office" ? <Link href={`/admin/invoices/inbox/print?folder=${folder}&id=${selected.id}`} target="_blank" rel="noopener noreferrer" className={button}>Print</Link> : <a href={`https://mail.google.com/mail/?authuser=${encodeURIComponent(accounts.find(info => info.id === "gmail")?.address || "")}#${folder === "sent" ? "sent" : "inbox"}/${selected.id}`} target="_blank" rel="noopener noreferrer" className={button}>Reply in Gmail ↗</a>}</div>
            <p className="mt-3 text-[11px] leading-5 text-slate-500">Categories, reply status, and read markers are shared in this dashboard.</p>
            {detail.workflowWarning && <p role="alert" className="mt-3 text-xs font-semibold text-amber-900">{detail.workflowWarning}</p>}
            {(saveNotice || saving) && <p role="status" className="mt-2 text-xs font-semibold text-emerald-700">{saving ? "Saving…" : saveNotice}</p>}{saveError && <p role="alert" className="mt-2 text-xs font-bold text-rose-700">{saveError}</p>}
          </header>
          {detail.document ? <iframe title="Email message" sandbox="" referrerPolicy="no-referrer" srcDoc={detail.document} className="h-[65vh] min-h-[400px] w-full border-0 bg-white" /> : <div className="min-h-72 whitespace-pre-wrap break-words p-5 text-sm leading-7 text-slate-800">{detail.text || "This email has no text content."}</div>}
          {!!detail.attachments.length && <div className="border-t border-slate-200 p-5"><h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Attachments</h3><ul className="mt-3 space-y-2">{detail.attachments.map(item => <li key={item.url}><a href={item.url} className="break-all text-sm font-bold text-indigo-700 underline">{item.name}</a></li>)}</ul></div>}
          {selected.account === "gmail" && <p className="border-t border-slate-100 p-4 text-xs text-slate-500">Open Gmail to reply, send email, or download attachments.</p>}
        </> : <div className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center"><Mail size={38} className="mb-4 text-indigo-200" /><h2 className="text-lg font-black text-slate-800">Everything in one place</h2><p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">Choose an email to read it, change its category, or set a reply status.</p></div>}
      </section>
    </div>
    <p className="mt-4 text-xs leading-5 text-slate-500">Filters and counts cover loaded emails. Use Older emails to bring in more. Office mail history is limited to the email provider’s retention period.</p>
  </div>;
}
