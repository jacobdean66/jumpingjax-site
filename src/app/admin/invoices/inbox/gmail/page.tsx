import Link from "next/link";
import { AdminAuthError, AdminHeader, AdminNav, AdminShell } from "@/app/admin/_components";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { emailDocument } from "@/lib/email/office-inbox";
import { gmailAccessToken, gmailConnected, listGmailMessages, readGmailMessage } from "@/lib/email/gmail-inbox";
import { isGmailId, isGmailPageToken, KAREN_GMAIL, type GmailMail } from "@/lib/email/gmail-core";

export const dynamic = "force-dynamic";
export const metadata = { title: "Karen’s Gmail | Jumping Jax", robots: { index: false, follow: false } };
const path = "/admin/invoices/inbox/gmail";
const button = "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50";
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short",
  }).format(date) + " ET";
}

export default async function GmailInboxPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const params = await searchParams;
  const folder = params.folder === "sent" ? "sent" : "inbox";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 500) : "";
  const page = typeof params.page === "string" && isGmailPageToken(params.page) ? params.page : "";
  const id = typeof params.id === "string" && isGmailId(params.id) ? params.id : "";
  let connected = false, error = "", messageError = "";
  let result: Awaited<ReturnType<typeof listGmailMessages>> | null = null;
  let message: GmailMail | null = null;
  try {
    connected = await gmailConnected();
    if (connected) {
      const token = await gmailAccessToken();
      result = await listGmailMessages(token, folder, q, page);
      if (id) {
        try { message = await readGmailMessage(token, id); }
        catch (failure) { messageError = failure instanceof Error ? failure.message : "This message could not be loaded."; }
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : "Gmail could not be loaded. Please try again.";
  }
  function href(changes: Record<string, string>) {
    const query = new URLSearchParams({ folder, q, page, ...changes });
    for (const [key, value] of [...query]) if (!value) query.delete(key);
    return `${path}?${query}`;
  }
  const connectionMessages: Record<string, string> = {
    connected: "Karen’s Gmail is connected.", cancelled: "Google connection was cancelled. You can try again below.",
    invalid_state: "The connection request expired. Please try connecting again.",
    configuration_required: "Google connection setup needs attention from the site administrator.",
    authorization_failed: "Gmail could not be connected. Choose Karen’s account and allow email viewing. The Google app must have the Gmail API enabled.",
  };
  const connectionMessage = typeof params.connection === "string" ? connectionMessages[params.connection] : null;
  return <AdminShell>
    <AdminHeader eyebrow="Office email" title="Karen’s Gmail"><AdminNav token="" role={auth.role} active="invoices" /></AdminHeader>
    <nav aria-label="Email accounts" className="mt-6 flex flex-wrap gap-2">
      <Link href="/admin/invoices/inbox" className={button}>info@jumpingjaxllc.com</Link>
      <Link href={path} aria-current="page" className={`${button} !border-indigo-600 !bg-indigo-600 !text-white`}>Karen’s Gmail</Link>
    </nav>
    <section className="mt-5 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="min-w-0"><p className="break-all font-black text-sky-950">{KAREN_GMAIL}</p>
        <p className="mt-2 text-sm text-slate-600">Read email here. Open Gmail to reply, send, or download attachments.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={`https://mail.google.com/mail/?authuser=${encodeURIComponent(KAREN_GMAIL)}`} target="_blank" rel="noopener noreferrer" className={button}>Open Gmail ↗</a>
        <form action="/api/admin/ad-analytics/google/connect?service=gmail" method="post">
          <button className={`${button} !bg-sky-950 !text-white`}>{connected ? "Reconnect Gmail" : "Connect Karen’s Gmail"}</button>
        </form>
      </div>
    </section>
    {connectionMessage && <p role="status" className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm font-semibold text-indigo-950">{connectionMessage}</p>}
    {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 font-semibold text-rose-800">{error}</p>}
    {!connected && !error && <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-black">Connect Karen’s inbox</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Select Connect Karen’s Gmail, choose {KAREN_GMAIL}, and approve viewing email. This inbox is available to signed-in owners on the website.</p>
    </section>}
    {connected && <>
      <nav aria-label="Gmail folders" className="mt-5 flex flex-wrap gap-2">
        <Link href={path} aria-current={folder === "inbox" ? "page" : undefined} className={`${button} ${folder === "inbox" ? "!border-indigo-600 !text-indigo-700" : ""}`}>Inbox</Link>
        <Link href={`${path}?folder=sent`} aria-current={folder === "sent" ? "page" : undefined} className={`${button} ${folder === "sent" ? "!border-indigo-600 !text-indigo-700" : ""}`}>Sent</Link>
        <Link href={href({ id })} className={button}>Refresh</Link>
      </nav>
      <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section aria-label="Gmail messages" className="min-w-0 self-start overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <form action={path} role="search" className="border-b border-slate-200 bg-slate-50 p-4">
            <input type="hidden" name="folder" value={folder} />
            <label htmlFor="gmail-search" className="text-xs font-black text-slate-600">Search {folder === "sent" ? "sent mail" : "inbox"}</label>
            <div className="mt-2 flex gap-2"><input type="search" name="q" id="gmail-search" maxLength={500} defaultValue={q} placeholder="Name, subject, or Gmail search" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" /><button className="rounded-lg bg-sky-950 px-3 py-2 text-sm font-bold text-white">Search</button></div>
          </form>
          {result?.messages.length === 0 && <p className="p-6 text-sm text-slate-600">{q ? "No matching emails in this folder." : "No emails in this folder."}</p>}
          <ul className="divide-y divide-slate-100">{result?.messages.map(row => <li key={row.id}>
            <Link href={href({ id: row.id })} aria-current={id === row.id ? "true" : undefined} className={`block border-l-4 p-4 hover:bg-indigo-50 ${id === row.id ? "border-indigo-600 bg-indigo-50" : "border-transparent"}`}>
              <p className="break-words text-sm font-black">{row.subject || "(No subject)"}</p>
              <p className="mt-1 break-all text-xs text-slate-600">{folder === "sent" ? `To: ${row.to}` : row.from}</p>
              <p className="mt-2 text-xs text-slate-500">{dateLabel(row.date)}</p>
            </Link>
          </li>)}</ul>
          {(page || result?.next) && <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 p-4">
            {page && <Link href={href({ page: "", id: "" })} className="text-sm font-bold text-indigo-700 underline">Back to latest</Link>}
            {result?.next && <Link href={href({ page: result.next, id: "" })} className="ml-auto text-sm font-bold text-indigo-700 underline">Older messages →</Link>}
          </div>}
        </section>
        <section aria-label="Gmail message reader" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {messageError ? <p role="alert" className="p-6 text-rose-800">{messageError}</p> : message ? <>
            <header className="border-b border-slate-200 p-5"><h2 className="break-words text-xl font-black">{message.subject || "(No subject)"}</h2>
              <dl className="mt-3 space-y-1 break-all text-sm text-slate-600">
                <div><dt className="inline font-bold">From: </dt><dd className="inline">{message.from}</dd></div>
                <div><dt className="inline font-bold">To: </dt><dd className="inline">{message.to}</dd></div>
                <div><dt className="inline font-bold">Date: </dt><dd className="inline">{dateLabel(message.date)}</dd></div>
              </dl>
            </header>
            {message.html ? <iframe title="Gmail message" sandbox="" referrerPolicy="no-referrer" srcDoc={emailDocument(message.html)} className="h-[75vh] min-h-[480px] w-full border-0 bg-white" /> : <div className="min-h-72 whitespace-pre-wrap break-words p-6 text-sm leading-relaxed">{message.text || message.snippet || "This email has no text content. Open Gmail to view attachments."}</div>}
          </> : <div className="flex min-h-80 items-center justify-center p-8 text-center text-slate-500">Select an email to read it here.</div>}
        </section>
      </div>
    </>}
  </AdminShell>;
}
