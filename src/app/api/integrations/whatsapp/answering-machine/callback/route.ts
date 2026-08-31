import { ingestAnsweringMachineCall } from "@/lib/answering-machine/service";
import { parseAnsweringMachineIngest } from "@/lib/answering-machine/validation";
import { hasAnsweringMachineCallbackAuthorization } from "@/lib/answering-machine/whatsapp";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.ANSWERING_MACHINE_CALLBACK_SECRET ?? "";
  if (!hasAnsweringMachineCallbackAuthorization(request, secret)) {
    return Response.json({ ok: false, error: "Callback authorization required." }, { status: 401 });
  }
  const input = parseAnsweringMachineIngest(await request.json().catch(() => null));
  if (!input) return Response.json({ ok: false, error: "Invalid answering-machine callback." }, { status: 400 });
  try {
    const call = await ingestAnsweringMachineCall(input);
    return Response.json({ ok: true, id: call.id, status: call.status });
  } catch {
    return Response.json({ ok: false, error: "Answering-machine callback failed safely." }, { status: 503 });
  }
}
