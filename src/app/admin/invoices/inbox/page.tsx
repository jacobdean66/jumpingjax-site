import Link from "next/link";
import { ArrowLeft, Inbox, Mail, RefreshCw, Send } from "lucide-react";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "@/app/admin/_components";
import { verifyAdminAccess } from "@/lib/admin/session";
import { emailDocument, isMailId, listOfficeMessages, officeAddress, readOfficeMessage, type MailFolder, type OfficeMessage } from "@/lib/email/office-inbox";

export const dynamic = "force-dynamic";
export const metadata = { title: "Office inbox | Jumping Jax", robots: { index: false, follow: false } };

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

export default async function OfficeInboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const params = await searchParams;
  const folder: MailFolder = params.folder === "sent" ? "sent" : "inbox";
  const after = typeof params.after === "string" && isMailId(params.after) ? params.after : "";
  const id = typeof params.id === "string" && isMailId(params.id) ? params.id : "";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  let result: Awaited<ReturnType<typeof listOfficeMessages>> | null = null;
  let selected: OfficeMessage | null = null;
  let error = "";
  let messageError = "";
  try { result = await listOfficeMessages(folder, after); } catch (failure) { error = failure instanceof Error ? failure.message : "Email could not be loaded."; }
  if (id) {
    try { selected = await readOfficeMessage(folder, id); if (!selected) messageError = "This message is not in the office mailbox."; }
    catch (failure) { messageError = failure instanceof Error ? failure.message : "This message could not be loaded."; }
  }
  const href = (changes: Record<string, string>) => {
    const next = new URLSearchParams({ folder, ...(after ? { after } : {}), ...(q ? { q } : {}), ...changes });
    for (const [key, value] of [...next]) if (!value) next.delete(key);
    return `/admin/invoices/inbox?${next}`;
  };
  const messages = result?.messages.filter(message => !q || `${message.subject ?? ""} ${message.from} ${message.to.join(" ")}`.toLowerCase().includes(q.toLowerCase())) ?? [];
  const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50";
  return <AdminShell>
    <AdminHeader eyebrow="Billing · Office email" title="Office inbox"><AdminNav token="" role={auth.role} active="invoices" /></AdminHeader>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <div><p className="break-all text-lg font-black text-sky-950">{officeAddress()}</p><p className="mt-1 text-sm text-slate-600">Customer replies, incoming mail, and sent invoice copies.</p></div>
      <div className="flex flex-wrap gap-2"><Link href="/admin/invoices" className={button}><ArrowLeft size={16} /> Invoices</Link><Link href={href({ id })} className={button}><RefreshCw size={16} /> Refresh</Link></div>
    </div>
    <nav aria-label="Email folders" className="mt-6 flex flex-wrap gap-2">
      <Link href="/admin/invoices/inbox" aria-current={folder === "inbox" ? "page" : undefined} className={`${button} ${folder === "inbox" ? "!border-indigo-600 !bg-indigo-600 !text-white" : ""}`}><Inbox size={18} /> Inbox</Link>
      <Link href="/admin/invoices/inbox?folder=sent" aria-current={folder === "sent" ? "page" : undefined} className={`${button} ${folder === "sent" ? "!border-indigo-600 !bg-indigo-600 !text-white" : ""}`}><Send size={18} /> Sent office copies</Link>
    </nav>
    {folder === "sent" && <p className="mt-3 text-sm text-slate-600">Emails sent to the office or copied to the office. Delivery status is for the outgoing message and does not confirm each recipient separately.</p>}
    <p className="mt-3 text-xs text-slate-500">This viewer shows recent email within the email provider&apos;s retention period. Saved invoices remain in <Link href="/admin/invoices/history" className="font-bold text-indigo-700 underline">Invoice history</Link>.</p>
    {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 font-semibold text-rose-800">{error}</p>}
    <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section aria-label="Messages" className="min-w-0 self-start overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <form action="/admin/invoices/inbox" role="search" className="border-b border-slate-200 bg-slate-50 p-4">
          <input type="hidden" name="folder" value={folder} />{after && <input type="hidden" name="after" value={after} />}
          <label className="text-xs font-black text-slate-600" htmlFor="mail-search">Search these messages</label>
          <div className="mt-1 flex gap-2"><input id="mail-search" name="q" type="search" maxLength={100} defaultValue={q} placeholder="Name, email, or invoice #" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /><button className="rounded-lg bg-sky-950 px-3 py-2 text-sm font-bold text-white">Search</button></div>
        </form>
        {!error && messages.length === 0 && <div className="p-7 text-center text-slate-600"><Mail className="mx-auto mb-3 text-slate-400" size={30} /><p className="font-bold">{q ? "No matches on this page" : folder === "inbox" ? "No incoming messages on this page" : "No office copies on this page"}</p><p className="mt-2 text-sm">{folder === "inbox" ? "New incoming messages will appear here. Earlier sends remain under Sent office copies." : "Use Older messages to check earlier sends."}</p></div>}
        <ul className="divide-y divide-slate-100">{messages.map(message => <li key={message.id}><Link href={href({ id: message.id })} aria-current={id === message.id ? "true" : undefined} className={`block border-l-4 p-4 transition hover:bg-indigo-50 ${id === message.id ? "border-indigo-600 bg-indigo-50" : "border-transparent"}`}>
          <p className="break-words text-sm font-black text-slate-950">{message.subject || "(No subject)"}</p><p className="mt-1 break-all text-xs text-slate-600">{folder === "sent" ? `To: ${message.to.join(", ")}` : message.from}</p><p className="mt-2 text-xs text-slate-500">{dateLabel(message.created_at)} ET{folder === "sent" && message.last_event ? ` · ${message.last_event.replaceAll("_", " ")}` : ""}</p>
        </Link></li>)}</ul>
        {result && <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 p-4">{after && <Link href={href({ after: "", id: "" })} className="text-sm font-bold text-indigo-700 underline">Back to latest</Link>}{result.next && <Link href={href({ after: result.next, id: "" })} className="ml-auto text-sm font-bold text-indigo-700 underline">Older messages →</Link>}</div>}
      </section>
      <section aria-label="Message reader" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {messageError ? <p role="alert" className="p-6 text-rose-800">{messageError}</p> : selected ? <>
          <header className="border-b border-slate-200 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><h2 className="break-words text-xl font-black">{selected.subject || "(No subject)"}</h2><Link href={`/admin/invoices/inbox/print?folder=${folder}&id=${selected.id}`} target="_blank" rel="noopener noreferrer" className={button}>Print email</Link></div><dl className="mt-3 space-y-1 break-all text-sm text-slate-600"><div><dt className="inline font-bold">From: </dt><dd className="inline">{selected.from}</dd></div><div><dt className="inline font-bold">To: </dt><dd className="inline">{selected.to.join(", ")}</dd></div>{selected.cc?.length ? <div><dt className="inline font-bold">CC: </dt><dd className="inline">{selected.cc.join(", ")}</dd></div> : null}{folder === "sent" && selected.bcc?.length ? <div><dt className="inline font-bold">Office BCC: </dt><dd className="inline">{selected.bcc.join(", ")}</dd></div> : null}<div><dt className="inline font-bold">Date: </dt><dd className="inline">{dateLabel(selected.created_at)} ET</dd></div></dl></header>
          {selected.html ? <iframe title="Email message" sandbox="" referrerPolicy="no-referrer" srcDoc={emailDocument(selected.html)} className="h-[75vh] min-h-[480px] w-full border-0 bg-white" /> : <div className="min-h-72 whitespace-pre-wrap break-words p-6 text-sm leading-relaxed">{selected.text || "This email has no text content."}</div>}
          {folder === "inbox" && !!selected.attachments?.length && <div className="border-t border-slate-200 p-5"><h3 className="text-sm font-black">Attachments</h3><ul className="mt-2 space-y-2">{selected.attachments.map(attachment => <li key={attachment.id}><a className="break-all text-sm font-bold text-indigo-700 underline" href={`/api/admin/invoices/inbox/${selected.id}/attachments/${attachment.id}`}>{attachment.filename || "Download attachment"}</a></li>)}</ul></div>}
        </> : <div className="flex min-h-80 flex-col items-center justify-center gap-3 p-8 text-center text-slate-500"><Inbox size={40} className="text-indigo-300" /><h2 className="text-xl font-black text-slate-800">Select a message</h2><p className="max-w-sm text-sm">Choose an email to read it here. Use Sent office copies to find earlier emails.</p></div>}
      </section>
    </div>
  </AdminShell>;
}
