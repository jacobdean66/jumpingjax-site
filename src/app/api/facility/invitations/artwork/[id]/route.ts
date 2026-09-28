import { createServiceRoleClient } from "@/lib/supabase/admin";
import { invitationArtworkBucket } from "@/lib/facility-parties/invitations/artwork-bucket";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{64}$/.test(id)) return new Response("Not found", { status: 404 });
  try {
    const { data, error } = await createServiceRoleClient().storage.from(invitationArtworkBucket()).download(`${id}.png`);
    if (error || !data) return new Response("Not found", { status: 404 });
    return new Response(data, { headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
  } catch { return new Response("Artwork temporarily unavailable", { status: 503 }); }
}
