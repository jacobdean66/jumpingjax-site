import "server-only";

export const OFFICE_EMAIL = "info@jumpingjaxllc.com";
export type MailFolder = "inbox" | "sent";
export type OfficeMessage = {
  id: string;
  from: string;
  to: string[];
  cc?: string[] | null;
  bcc?: string[] | null;
  received_for?: string[] | null;
  subject: string | null;
  created_at: string;
  last_event?: string;
  html?: string | null;
  text?: string | null;
  attachments?: { id: string; filename: string | null; size?: number }[];
};

export function isMailId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function officeAddress(): string {
  return process.env.INVOICE_OFFICE_EMAIL?.trim().toLowerCase() || OFFICE_EMAIL;
}

function containsAddress(values: string[] | null | undefined, address: string): boolean {
  return (values ?? []).some(value => {
    const extracted = value.match(/<([^<>]+)>/)?.[1] ?? value;
    return extracted.trim().toLowerCase() === address;
  });
}

export function belongsToOffice(message: OfficeMessage, folder: MailFolder): boolean {
  const office = officeAddress();
  const addressed = [message.to, message.cc, message.bcc, message.received_for]
    .some(values => containsAddress(values, office));
  return addressed && (folder === "inbox" || /^(?:Office copy\s*[—–-]\s*)?Jumping Jax invoice\s/i.test(message.subject ?? ""));
}

async function resendRead<T>(path: string): Promise<T> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error("Office email is not configured. Please contact the owner.");
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await fetch(`https://api.resend.com${path}`, {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new Error("Email could not be reached. Please refresh to try again.");
    }
    if (response.status === 429 && attempt === 0) {
      const wait = Math.min(2000, Math.max(600, Number(response.headers.get("retry-after") || "1") * 1000));
      await new Promise(resolve => setTimeout(resolve, wait));
      continue;
    }
    if (!response.ok) throw new Error(response.status === 404
      ? "This message is no longer available."
      : "Email could not be loaded. Please refresh to try again.");
    return await response.json() as T;
  }
  throw new Error("Email is busy. Please refresh in a moment.");
}

export async function readOfficeMessage(folder: MailFolder, id: string): Promise<OfficeMessage | null> {
  if (!isMailId(id)) return null;
  const message = await resendRead<OfficeMessage>(`/emails/${folder === "inbox" ? "receiving/" : ""}${id}`);
  return belongsToOffice(message, folder) ? message : null;
}

export async function listOfficeMessages(folder: MailFolder, after = "") {
  const query = new URLSearchParams({ limit: "20" });
  if (isMailId(after)) query.set("after", after);
  const result = await resendRead<{ data: OfficeMessage[]; has_more: boolean }>(`/emails${folder === "inbox" ? "/receiving" : ""}?${query}`);
  const messages: OfficeMessage[] = [];
  for (const row of result.data) {
    if (belongsToOffice(row, folder)) {
      messages.push(row);
    } else if (folder === "inbox") {
      // BCC and forwarded recipients may appear only in the detailed envelope.
      // Never expose another mailbox's messages simply because they share an account.
      await new Promise(resolve => setTimeout(resolve, 550));
      const full = await readOfficeMessage(folder, row.id);
      if (full) messages.push(full);
    }
  }
  return { messages, next: result.has_more ? result.data.at(-1)?.id ?? null : null };
}

export async function officeAttachment(emailId: string, attachmentId: string): Promise<string | null> {
  if (!isMailId(attachmentId)) return null;
  const message = await readOfficeMessage("inbox", emailId);
  if (!message?.attachments?.some(item => item.id === attachmentId)) return null;
  const attachment = await resendRead<{ download_url: string }>(`/emails/receiving/${emailId}/attachments/${attachmentId}`);
  const url = new URL(attachment.download_url);
  return url.protocol === "https:" ? url.href : null;
}

export function emailDocument(html: string): string {
  // The iframe also has an empty sandbox and the parent forbids remote frames.
  // No scripts, forms, tracking pixels, stylesheets or other remote resources.
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'; base-uri 'none'"><meta name="referrer" content="no-referrer"><style>body{font-family:Arial,sans-serif;overflow-wrap:anywhere;margin:16px;color:#0f172a}img,table{max-width:100%}pre{white-space:pre-wrap}</style></head><body>${html}</body></html>`;
}
