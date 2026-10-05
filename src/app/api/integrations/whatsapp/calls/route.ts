import { ingestAnsweringMachineCall, ingestAnsweringMachineVoicemail } from "@/lib/answering-machine/service";
import { forwardWhatsAppCallToMediaBridge } from "@/lib/answering-machine/media-bridge";
import { readWhatsAppWebhook } from "@/lib/answering-machine/webhook-request";
import {
  extractWhatsAppCallSignals,
  extractWhatsAppVoicemails,
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
  const result = await readWhatsAppWebhook(request);
  if ("error" in result) return Response.json({ ok: false, error: result.error }, { status: result.status });
  const { payload } = result;
  const signals = extractWhatsAppCallSignals(payload);
  const voicemails = extractWhatsAppVoicemails(payload);
  if (signals.length === 0 && voicemails.length === 0) return Response.json({ ok: true, accepted: 0 });

  try {
    for (const signal of signals) await ingestAnsweringMachineCall(signal);
    for (const voicemail of voicemails) await ingestAnsweringMachineVoicemail(voicemail);
    if (result.mode === "native_voicemail") {
      return Response.json({ ok: true, accepted: signals.length + voicemails.length });
    }
    const bridgeUrl = process.env.ANSWERING_MACHINE_MEDIA_BRIDGE_URL?.trim();
    const bridgeSecret = process.env.ANSWERING_MACHINE_CALLBACK_SECRET?.trim();
    if (!bridgeUrl || !bridgeSecret || !bridgeUrl.startsWith("https://")) {
      return Response.json({ ok: false, error: "WhatsApp media bridge is not configured." }, { status: 503 });
    }
    // Forward only this number's selected events, never another account in a signed batch.
    await forwardWhatsAppCallToMediaBridge({ bridgeUrl, bridgeSecret, rawBody: JSON.stringify(payload) });
    return Response.json({ ok: true, accepted: signals.length + voicemails.length });
  } catch {
    return Response.json({ ok: false, error: "WhatsApp call could not be handed off safely." }, { status: 503 });
  }
}
