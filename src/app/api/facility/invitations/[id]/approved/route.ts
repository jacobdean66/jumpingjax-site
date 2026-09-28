import { loadFacilityInvitationView } from "@/lib/facility-parties/invitations/load-invitation";
import { APPROVED_PRINT_BUCKET, approvedPrintStorageKey } from "@/lib/facility-parties/invitations/approved-print";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format") === "pdf" ? "pdf" : "png";
  const headers = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };
  try {
    const view = await loadFacilityInvitationView(id);
    const print = view?.snapshot.approvedPrint;
    if (!print) return Response.json({ error: "Saved invitation not found." }, { status: 404, headers });
    const { data, error } = await createServiceRoleClient().storage.from(APPROVED_PRINT_BUCKET).download(approvedPrintStorageKey(print, format));
    if (error || !data) return Response.json({ error: "The saved invitation is temporarily unavailable." }, { status: 503, headers });
    return new Response(data, { headers: { ...headers,
      "content-type": format === "pdf" ? "application/pdf" : "image/png",
      ...(format === "pdf" ? { "content-disposition": 'attachment; filename="party-invitations-four-per-sheet.pdf"' } : {}),
    } });
  } catch {
    return Response.json({ error: "The saved invitation is temporarily unavailable." }, { status: 503, headers });
  }
}
