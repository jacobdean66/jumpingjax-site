import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const KAREN_GMAIL = "karen.mcclain.jumpingjaxllc@gmail.com";
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
type Env = Record<string, string | undefined>;
export type GmailPart = {
  mimeType?: string; filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPart[];
};
export type GmailMessage = { id: string; internalDate?: string; snippet?: string; labelIds?: string[]; payload?: GmailPart };
export type GmailMail = {
  id: string; subject: string; from: string; to: string; date: string;
  text: string; html: string; snippet: string; unread: boolean;
};
export function isGmailId(value: string): boolean { return /^[a-f0-9]{1,32}$/i.test(value); }
export function isGmailPageToken(value: string): boolean { return /^[A-Za-z0-9_=-]{1,2048}$/.test(value); }
export function isKarenGmail(email: unknown): boolean {
  return typeof email === "string" && email.trim().toLowerCase() === KAREN_GMAIL;
}
export function gmailMail(message: GmailMessage): GmailMail {
  const headers = message.payload?.headers ?? [];
  const header = (name: string) => headers.find(row => row.name.toLowerCase() === name)?.value || "";
  const texts: string[] = [], html: string[] = [];
  function visit(part: GmailPart, depth = 0) {
    if (depth > 30 || part.filename) return;
    if (part.body?.data) {
      const decoded = Buffer.from(part.body.data, "base64url").toString("utf8");
      if (part.mimeType === "text/plain") texts.push(decoded);
      if (part.mimeType === "text/html") html.push(decoded);
    }
    for (const child of part.parts ?? []) visit(child, depth + 1);
  }
  if (message.payload) visit(message.payload);
  const timestamp = Number(message.internalDate);
  return { id: message.id, subject: header("subject"), from: header("from"), to: header("to"),
    date: Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp).toISOString() : header("date"),
    text: texts.join("\n"), html: html.join("\n"), snippet: message.snippet || "", unread: message.labelIds?.includes("UNREAD") ?? false };
}
function key(env: Env) {
  const secret = env.GOOGLE_ADS_COOKIE_SECRET?.trim() || env.ADMIN_SESSION_SECRET?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) throw new Error("Gmail connection storage is not configured.");
  return createHash("sha256").update(`jumpingjax-gmail-v1:${secret}`).digest();
}
export function sealGmailToken(token: string, env: Env): string {
  if (!token || token.length > 8192) throw new Error("Invalid Gmail authorization.");
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(env), iv);
  cipher.setAAD(Buffer.from(KAREN_GMAIL));
  const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}
export function openGmailToken(value: string, env: Env): string | null {
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.length < 29 || bytes.length > 8300) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(env), bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(KAREN_GMAIL)); decipher.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8") || null;
  } catch { return null; }
}

export async function gmailGet<T>(accessToken: string, path: string, fetcher: typeof fetch = fetch): Promise<T> {
  const response = await fetcher(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    if ([401, 403].includes(response.status)) throw new Error("Gmail access is unavailable. Reconnect Karen’s Gmail; if prompted, enable the Gmail API for the Google app.");
    if (response.status === 404) throw new Error("This Gmail message is no longer available.");
    throw new Error("Gmail could not be loaded. Please try again.");
  }
  return await response.json() as T;
}
export async function verifyKarenGmail(accessToken: string, fetcher: typeof fetch = fetch) {
  const profile = await gmailGet<{ emailAddress?: string }>(accessToken, "profile", fetcher);
  if (!isKarenGmail(profile.emailAddress)) throw new Error("Choose Karen’s Jumping Jax Gmail account to connect this inbox.");
}
