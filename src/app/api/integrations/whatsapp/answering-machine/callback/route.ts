import { ingestAnsweringMachineCall } from "@/lib/answering-machine/service";
import { parseAnsweringMachineIngest } from "@/lib/answering-machine/validation";
import { hasAnsweringMachineCallbackAuthorization } from "@/lib/answering-machine/whatsapp";
import { getAnsweringMachineReadiness } from "@/lib/answering-machine/readiness";
import { readBoundedWebhookBody } from "@/lib/answering-machine/webhook-request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const readiness = getAnsweringMachineReadiness();
  if (!readiness.live || readiness.mode !== "interactive_bridge") {
    return Response.json({ ok: false, error: "Interactive answering-machine callbacks are disabled." }, { status: 503 });
  }
  const secret = process.env.ANSWERING_MACHINE_CALLBACK_SECRET ?? "";
  if (!hasAnsweringMachineCallbackAuthorization(request, secret)) {
    return Response.json({ ok: false, error: "Callback authorization required." }, { status: 401 });
  }
  let payload: unknown;
  try { payload = JSON.parse(await readBoundedWebhookBody(request)) as unknown; }
  catch { return Response.json({ ok: false, error: "Invalid answering-machine callback." }, { status: 400 }); }
  const input = parseAnsweringMachineIngest(payload);
  if (!input) return Response.json({ ok: false, error: "Invalid answering-machine callback." }, { status: 400 });
  try {
    const call = await ingestAnsweringMachineCall(input);
    return Response.json({ ok: true, id: call.id, status: call.status });
  } catch {
    return Response.json({ ok: false, error: "Answering-machine callback failed safely." }, { status: 503 });
  }
}
