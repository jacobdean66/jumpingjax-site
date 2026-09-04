import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { loadAnsweringMachineVoicemailMedia } from "@/lib/answering-machine/service";
import { downloadWhatsAppMedia } from "@/lib/answering-machine/whatsapp-media";
import { privateJson } from "@/lib/security/request-guard";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return privateJson({ ok: false, error: "Owner authorization required." }, 401);
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return privateJson({ ok: false, error: "Invalid voicemail reference." }, 400);
  try {
    const stored = await loadAnsweringMachineVoicemailMedia(id);
    const media = await downloadWhatsAppMedia({
      mediaId: stored.mediaId,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
      graphApiVersion: process.env.WHATSAPP_GRAPH_API_VERSION ?? "",
    });
    return new Response(media.body, {
      headers: {
        "Content-Type": media.contentType,
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return privateJson({ ok: false, error: "Voicemail audio is unavailable." }, 503);
  }
}
