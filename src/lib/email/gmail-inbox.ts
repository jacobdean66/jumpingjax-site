import "server-only";
import { googleReportingConfig } from "@/lib/analytics/google-reporting-core";
import { readGoogleReportingObject, writeGoogleReportingObject } from "@/lib/analytics/shared-google-store";
import { gmailGet, gmailMail, isGmailId, isGmailPageToken, KAREN_GMAIL, openGmailToken, sealGmailToken, verifyKarenGmail, type GmailMessage } from "./gmail-core";

const connectionPath = "connections/gmail-karen.json";
type Connection = { email: string; encryptedToken: string; connectedAt: string; connectedBy: string };
export async function gmailConnected(): Promise<boolean> {
  const saved = await readGoogleReportingObject<Connection>(connectionPath);
  return Boolean(saved?.email === KAREN_GMAIL && openGmailToken(saved.encryptedToken, process.env));
}
export async function saveGmailConnection(refreshToken: string, accessToken: string, ownerId: string) {
  await verifyKarenGmail(accessToken);
  await writeGoogleReportingObject(connectionPath, {
    email: KAREN_GMAIL, encryptedToken: sealGmailToken(refreshToken, process.env),
    connectedAt: new Date().toISOString(), connectedBy: ownerId,
  });
}
export async function gmailAccessToken(): Promise<string> {
  const saved = await readGoogleReportingObject<Connection>(connectionPath);
  const refreshToken = saved?.email === KAREN_GMAIL && openGmailToken(saved.encryptedToken, process.env);
  if (!refreshToken) throw new Error("Connect Karen’s Gmail to read messages here.");
  const config = googleReportingConfig(process.env);
  if (!config.oauthReady) throw new Error("Gmail connection is not configured.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!response.ok) throw new Error("Please reconnect Karen’s Gmail to restore access.");
  const token = await response.json() as { access_token?: string };
  if (!token.access_token) throw new Error("Please reconnect Karen’s Gmail to restore access.");
  return token.access_token;
}
export async function listGmailMessages(accessToken: string, folder: "inbox" | "sent", q = "", page = "") {
  const params = new URLSearchParams({ maxResults: "20", labelIds: folder === "sent" ? "SENT" : "INBOX" });
  if (q.trim()) params.set("q", q.trim().slice(0, 500));
  if (isGmailPageToken(page)) params.set("pageToken", page);
  const result = await gmailGet<{ messages?: { id: string }[]; nextPageToken?: string }>(accessToken, `messages?${params}`);
  // Bound concurrent provider requests while keeping one access token per page.
  const messages = [];
  for (let index = 0; index < (result.messages?.length ?? 0); index += 5) {
    const batch = await Promise.all((result.messages ?? []).slice(index, index + 5).map(async row => {
      if (!isGmailId(row.id)) throw new Error("Gmail returned an invalid message.");
      return gmailMail(await gmailGet<GmailMessage>(accessToken, `messages/${row.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`));
    }));
    messages.push(...batch);
  }
  return { messages, next: result.nextPageToken && isGmailPageToken(result.nextPageToken) ? result.nextPageToken : null };
}
export async function readGmailMessage(accessToken: string, id: string) {
  if (!isGmailId(id)) return null;
  return gmailMail(await gmailGet<GmailMessage>(accessToken, `messages/${id}?format=full`));
}
