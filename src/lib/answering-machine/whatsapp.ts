import { createHmac, timingSafeEqual } from "node:crypto";

import type { AnsweringMachineIngest, AnsweringMachineVoicemailIngest } from "./validation";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyMetaWebhookSignature(rawBody: string, signature: string | null, appSecret: string) {
  if (!signature?.startsWith("sha256=") || !appSecret) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  return safeEqual(signature, expected);
}

export function verifyWebhookChallenge(mode: string | null, token: string | null, expectedToken: string) {
  return mode === "subscribe" && Boolean(token) && Boolean(expectedToken) && safeEqual(token ?? "", expectedToken);
}

export function hasAnsweringMachineCallbackAuthorization(request: Request, secret: string) {
  const value = request.headers.get("authorization") ?? "";
  return Boolean(secret) && value.startsWith("Bearer ") && safeEqual(value.slice(7), secret);
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

/** A valid Meta signature identifies the app, not the intended WABA or number. */
export function selectWhatsAppWebhookAccount(value: unknown, wabaId: string, phoneNumberId: string) {
  const root = record(value);
  if (root?.object !== "whatsapp_business_account" || !wabaId || !phoneNumberId) return null;
  const entries = Array.isArray(root.entry) ? root.entry : [];
  const selected = entries.flatMap((item) => {
    const entry = record(item);
    if (entry?.id !== wabaId || !Array.isArray(entry.changes)) return [];
    const changes = entry.changes.filter((item) => {
      const change = record(item);
      const body = record(change?.value);
      return (change?.field === "calls" || change?.field === "messages")
        && body?.messaging_product === "whatsapp"
        && record(body.metadata)?.phone_number_id === phoneNumberId;
    });
    return changes.length ? [{ ...entry, changes }] : [];
  });
  return selected.length ? { ...root, entry: selected } : null;
}

export function extractWhatsAppCallSignals(value: unknown): AnsweringMachineIngest[] {
  if (!value || typeof value !== "object") return [];
  const entries = Array.isArray((value as UnknownRecord).entry) ? (value as UnknownRecord).entry as unknown[] : [];
  const signals: AnsweringMachineIngest[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const changes = Array.isArray((entry as UnknownRecord).changes) ? (entry as UnknownRecord).changes as unknown[] : [];
    for (const change of changes) {
      const payload = change && typeof change === "object" ? (change as UnknownRecord).value : null;
      if (!payload || typeof payload !== "object") continue;
      const body = payload as UnknownRecord;
      const calls = Array.isArray(body.calls) ? body.calls as unknown[] : [];
      const contacts = Array.isArray(body.contacts) ? body.contacts as UnknownRecord[] : [];
      const profile = contacts[0]?.profile && typeof contacts[0].profile === "object"
        ? contacts[0].profile as UnknownRecord : null;
      const displayName = typeof profile?.name === "string" ? profile.name.slice(0, 160) : null;
      for (const callValue of calls) {
        if (!callValue || typeof callValue !== "object") continue;
        const call = callValue as UnknownRecord;
        if (typeof call.id !== "string" || !call.id.startsWith("wacid.") || call.id.length > 240
          || typeof call.from !== "string" || !call.from || call.from.length > 240) continue;
        const event = typeof call.event === "string" ? call.event.toLowerCase() : "connect";
        if (event !== "connect" && event !== "terminate") continue;
        const timestamp = typeof call.timestamp === "string" ? call.timestamp : "unknown";
        const status = event === "terminate" ? "processing" : event === "connect" ? "in_progress" : "received";
        signals.push({
          providerCallId: call.id,
          sourceEventId: `${call.id}:${event}:${timestamp}`.slice(0, 300),
          callerRef: call.from,
          callerDisplayName: displayName,
          status,
          transcript: "",
          transcriptComplete: false,
          serviceKind: null,
          eventDate: null,
          facilityStartTime: null,
          rentalItems: [],
          agentSummary: "",
        });
        if (signals.length === 10) return signals;
      }
    }
  }
  return signals.slice(0, 10);
}

export function extractWhatsAppVoicemails(value: unknown): AnsweringMachineVoicemailIngest[] {
  if (!value || typeof value !== "object") return [];
  const entries = Array.isArray((value as UnknownRecord).entry) ? (value as UnknownRecord).entry as unknown[] : [];
  const voicemails: AnsweringMachineVoicemailIngest[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const changes = Array.isArray((entry as UnknownRecord).changes) ? (entry as UnknownRecord).changes as unknown[] : [];
    for (const change of changes) {
      const payload = change && typeof change === "object" ? (change as UnknownRecord).value : null;
      if (!payload || typeof payload !== "object") continue;
      const body = payload as UnknownRecord;
      const contacts = Array.isArray(body.contacts) ? body.contacts as UnknownRecord[] : [];
      const profile = contacts[0]?.profile && typeof contacts[0].profile === "object"
        ? contacts[0].profile as UnknownRecord : null;
      const displayName = typeof profile?.name === "string" ? profile.name.slice(0, 160) : null;
      const messages = Array.isArray(body.messages) ? body.messages as unknown[] : [];
      for (const messageValue of messages) {
        if (!messageValue || typeof messageValue !== "object") continue;
        const message = messageValue as UnknownRecord;
        const audio = message.audio && typeof message.audio === "object" ? message.audio as UnknownRecord : null;
        const providerCallId = typeof message.id === "string" ? message.id : "";
        const callerRef = typeof message.from === "string" ? message.from
          : typeof message.from_user_id === "string" ? message.from_user_id : "";
        const mediaId = typeof audio?.id === "string" ? audio.id : "";
        const mimeType = typeof audio?.mime_type === "string" ? audio.mime_type : "";
        if (message.type !== "audio" || !providerCallId.startsWith("wacid.") || providerCallId.length > 240
          || !callerRef || callerRef.length > 240
          || !mediaId || !mimeType.startsWith("audio/") || mediaId.length > 240 || mimeType.length > 120) continue;
        const timestamp = typeof message.timestamp === "string" ? message.timestamp : "unknown";
        voicemails.push({
          providerCallId,
          sourceEventId: `${providerCallId}:voicemail:${timestamp}`.slice(0, 300),
          callerRef,
          callerDisplayName: displayName,
          mediaId,
          mimeType,
          sha256: typeof audio?.sha256 === "string" ? audio.sha256.slice(0, 128) : null,
        });
        if (voicemails.length === 10) return voicemails;
      }
    }
  }
  return voicemails.slice(0, 10);
}
