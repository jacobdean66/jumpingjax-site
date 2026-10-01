import { getAnsweringMachineReadiness, getWhatsAppAppSecret } from "./readiness";
import { selectWhatsAppWebhookAccount, verifyMetaWebhookSignature } from "./whatsapp";

const MAX_WEBHOOK_BYTES = 256 * 1024;

export async function readBoundedWebhookBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_WEBHOOK_BYTES) {
        await reader.cancel();
        throw new Error("Webhook payload is too large.");
      }
      chunks.push(next.value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally { reader.releaseLock(); }
}

export async function readWhatsAppWebhook(request: Request, env: NodeJS.ProcessEnv = process.env) {
  const readiness = getAnsweringMachineReadiness(env);
  if (!readiness.live) return { error: "WhatsApp calling is disabled or not configured.", status: 503 } as const;
  let rawBody: string;
  try { rawBody = await readBoundedWebhookBody(request); }
  catch { return { error: "Invalid WhatsApp payload size.", status: 413 } as const; }
  if (!verifyMetaWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"), getWhatsAppAppSecret(env))) {
    return { error: "Invalid WhatsApp signature.", status: 401 } as const;
  }
  let payload: unknown;
  try { payload = JSON.parse(rawBody) as unknown; }
  catch { return { error: "Invalid WhatsApp payload.", status: 400 } as const; }
  return {
    payload: selectWhatsAppWebhookAccount(payload, env.WHATSAPP_WABA_ID!.trim(), env.WHATSAPP_PHONE_NUMBER_ID!.trim()),
    mode: readiness.mode,
  } as const;
}
