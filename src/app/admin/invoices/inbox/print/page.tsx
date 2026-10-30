import Link from "next/link";
import { AdminAuthError } from "@/app/admin/_components";
import { PrintInvoiceButton } from "@/app/admin/invoices/PrintInvoiceButton";
import { verifyAdminAccess } from "@/lib/admin/session";
import { isMailId, readOfficeMessage, type MailFolder } from "@/lib/email/office-inbox";
import { printableEmailHtml } from "@/lib/email/printable-email";

export const dynamic = "force-dynamic";
export const metadata = { title: "Print email | Jumping Jax", robots: { index: false, follow: false } };

export default async function PrintEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return <AdminAuthError reason={auth.reason} />;
  const params = await searchParams;
  const folder: MailFolder = params.folder === "sent" ? "sent" : "inbox";
  const id = typeof params.id === "string" && isMailId(params.id) ? params.id : "";
  let message = null;
  try { if (id) message = await readOfficeMessage(folder, id); } catch { /* Show a safe error below. */ }
  if (!message) return <main className="p-6"><h1 className="text-xl font-black">Email unavailable</h1><p className="mt-2">This message could not be loaded. Return to the inbox and try again.</p><Link href="/admin/invoices/inbox" className="mt-4 inline-block font-bold text-indigo-700 underline">Back to office inbox</Link></main>;
  const date = new Date(message.created_at);
  const time = Number.isNaN(date.getTime()) ? "Unknown date" : new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }).format(date) + " ET";
  return <main className="min-h-screen bg-slate-100 p-4 text-slate-950 print:bg-white print:p-0">
    <div className="mx-auto mb-4 flex max-w-4xl flex-wrap justify-end gap-3 print:hidden"><Link href={`/admin/invoices/inbox?folder=${folder}&id=${message.id}`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-bold">Back to email</Link><PrintInvoiceButton label="Print email" /></div>
    <article className="mx-auto max-w-4xl bg-white p-6 shadow-sm print:max-w-none print:p-0 print:shadow-none">
      <div className="border-b border-slate-300 pb-4"><h1 className="break-words text-2xl font-black">{message.subject || "(No subject)"}</h1><p className="mt-3 break-all text-sm"><strong>From:</strong> {message.from}</p><p className="mt-1 break-all text-sm"><strong>To:</strong> {message.to.join(", ")}</p>{message.cc?.length ? <p className="mt-1 break-all text-sm"><strong>CC:</strong> {message.cc.join(", ")}</p> : null}{folder === "sent" && message.bcc?.length ? <p className="mt-1 break-all text-sm"><strong>Office BCC:</strong> {message.bcc.join(", ")}</p> : null}<p className="mt-1 text-sm"><strong>Date:</strong> {time}</p></div>
      {message.html ? <div className="printable-mail mt-5 break-words text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: printableEmailHtml(message.html) }} /> : <div className="mt-5 whitespace-pre-wrap break-words text-sm leading-relaxed">{message.text || "This email has no text content."}</div>}
      {!!message.attachments?.length && <p className="mt-6 border-t border-slate-300 pt-3 text-sm"><strong>Attachments:</strong> {message.attachments.map(item => item.filename || "Attachment").join(", ")}</p>}
    </article>
    <style>{`.printable-mail table{border-collapse:collapse;width:100%;margin:12px 0}.printable-mail td,.printable-mail th{border:1px solid #cbd5e1;padding:7px;vertical-align:top}.printable-mail p{margin:0 0 10px}.printable-mail img{max-width:100%;height:auto}.printable-mail pre{white-space:pre-wrap}.printable-mail h1,.printable-mail h2,.printable-mail h3{font-weight:700;margin:12px 0}`}</style>
  </main>;
}
