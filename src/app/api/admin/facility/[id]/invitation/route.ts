import { revalidatePath } from "next/cache";
import { savePartyInvitation } from "@/lib/facility-parties/invitations/admin-save";
import { z } from "zod";
import { verifyAdminAccess } from "@/lib/admin/session";
import { isValidBookingId } from "@/lib/admin/booking-edit";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const inputSchema = z.object({ sourceText: z.string().trim().min(1).max(160), confirmationToken: z.string().min(1).max(18000), optionIndex: z.number().int().min(0).max(2) });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return Response.json({ error: "Admin authentication required." }, { status: auth.reason === "missing_config" ? 503 : 401 });
  const { id } = await params;
  if (!isValidBookingId(id)) return Response.json({ error: "Invalid party ID." }, { status: 400 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid invitation selection." }, { status: 400 });
  const response = await savePartyInvitation(createServiceRoleClient(), id, parsed.data);
  if (response.ok) {
    revalidatePath(`/admin/facility/${id}/invitations`);
    revalidatePath("/admin/facility");
  }
  return response;
}
