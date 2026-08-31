import { ingestAnsweringMachineCall } from "@/lib/answering-machine/service";
import {
  extractWhatsAppCallSignals,
  verifyMetaWebhookSignature,
  verifyWebhookChallenge,
} from "@/lib/answering-machine/whatsapp";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const verified = verifyWebhookChallenge(
    url.searchParams.get("hub.mode"),
    url.searchParams.get("hub.verify_token"),
    process.env.WHATSAPP_VERIFY_TOKEN ?? "",
  );
  const challenge = url.searchParams.get("hub.challenge");
  return verified && challenge
    ? new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } })
    : new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  if (process.env.WHATSAPP_CALLING_ENABLED !== "1") {
    return Response.json({ ok: false, error: "WhatsApp calling is disabled." }, { status: 503 });
  }
  const appSecret = process.env.WHATSAPP_APP_SECRET ?? "";
  const rawBody = await request.text();
  if (!verifyMetaWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    return Response.json({ ok: false, error: "Invalid WhatsApp signature." }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return Response.json({ ok: false, error: "Invalid WhatsApp payload." }, { status: 400 });
  }
  const signals = extractWhatsAppCallSignals(payload);
  if (signals.length === 0) return Response.json({ ok: true, accepted: 0 });

  try {
    for (const signal of signals) await ingestAnsweringMachineCall(signal);
    const bridgeUrl = process.env.ANSWERING_MACHINE_MEDIA_BRIDGE_URL?.trim();
    const bridgeSecret = process.env.ANSWERING_MACHINE_CALLBACK_SECRET?.trim();
    if (!bridgeUrl || !bridgeSecret || !bridgeUrl.startsWith("https://")) {
      return Response.json({ ok: false, error: "WhatsApp media bridge is not configured." }, { status: 503 });
    }
    const forwarded = await fetch(bridgeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bridgeSecret}` },
      body: rawBody,
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!forwarded.ok) throw new Error("media bridge rejected call event");
    return Response.json({ ok: true, accepted: signals.length });
  } catch {
    return Response.json({ ok: false, error: "WhatsApp call could not be handed off safely." }, { status: 503 });
  }
}
