import "server-only";
import { gmailAccessToken, listGmailMessages, readGmailMessage } from "./gmail-inbox";
import { emailDocument, listOfficeMessages, readOfficeMessage, type OfficeMessage } from "./office-inbox";
import { decorateEmail, EMPTY_WORKFLOW, type EmailAccount, type EmailDetail, type EmailFolder, type Workflow } from "./dashboard-core";
import { readEmailWorkflow, readEmailWorkflows } from "./dashboard-store";

const officeFields = (message: OfficeMessage, folder: EmailFolder) => ({ account: "office" as const, folder, id: message.id, from: message.from,
  to: message.to.join(", "), subject: message.subject || "", date: message.created_at, snippet: message.text?.slice(0, 200) || "", providerUnread: folder === "inbox" });
export async function loadEmailPage(account: EmailAccount, folder: EmailFolder, cursor: string, signal?: AbortSignal) {
  const page = account === "office"
    ? await listOfficeMessages(folder, cursor, { signal, maxPages: 3, maxMessages: 20 })
    : await listGmailMessages(await gmailAccessToken(), folder, "", cursor);
  const fields = account === "office" ? (page.messages as OfficeMessage[]).map(message => officeFields(message, folder))
    : (page.messages as Awaited<ReturnType<typeof listGmailMessages>>["messages"]).map(message => ({ account, folder, id: message.id, from: message.from, to: message.to,
      subject: message.subject, date: message.date, snippet: message.snippet, providerUnread: message.unread }));
  let warning = "";
  let workflows = new Map<string, Workflow>();
  try { workflows = await readEmailWorkflows(account, fields.map(row => row.id)); }
  catch { warning = "Saved categories and reply statuses could not be loaded. Refresh before changing them."; }
  return { messages: fields.map(row => decorateEmail(row, workflows.get(row.id))), next: page.next, warning };
}
async function detailWorkflow(account: EmailAccount, id: string) {
  try { return { workflow: await readEmailWorkflow(account, id), warning: "" }; }
  catch { return { workflow: EMPTY_WORKFLOW, warning: "Saved categories and reply statuses are unavailable. You can still read this email; refresh before changing it." }; }
}
export async function loadEmailDetail(account: EmailAccount, folder: EmailFolder, id: string): Promise<EmailDetail | null> {
  if (account === "office") {
    const message = await readOfficeMessage(folder, id);
    if (!message) return null;
    const saved = await detailWorkflow(account, id);
    return { ...decorateEmail(officeFields(message, folder), saved.workflow), workflowWarning: saved.warning, text: message.text || "", document: message.html ? emailDocument(message.html) : "",
      cc: message.cc?.join(", "), bcc: folder === "sent" ? message.bcc?.join(", ") : undefined,
      attachments: folder === "inbox" ? (message.attachments ?? []).map(row => ({ name: row.filename || "Attachment", url: `/api/admin/invoices/inbox/${id}/attachments/${row.id}` })) : [] };
  }
  const message = await readGmailMessage(await gmailAccessToken(), id);
  if (!message) return null;
  const saved = await detailWorkflow(account, id);
  return { ...decorateEmail({ account, folder, id: message.id, from: message.from, to: message.to, subject: message.subject, date: message.date, snippet: message.snippet, providerUnread: message.unread }, saved.workflow), workflowWarning: saved.warning,
    text: message.text || message.snippet, document: message.html ? emailDocument(message.html) : "", attachments: [] };
}
