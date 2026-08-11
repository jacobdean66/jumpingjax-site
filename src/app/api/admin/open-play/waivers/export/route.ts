import { requireOwnerAuth, publicSafeError } from "@/lib/open-play/staff-auth";
import { createCompleteWaiverCsv } from "@/lib/waivers/waiver-export-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireOwnerAuth();
  if (!auth.ok) return auth.response;

  try {
    const csv = await createCompleteWaiverCsv();
    const date = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="jumping-jax-waivers-${date}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return publicSafeError("database", 503, "Waiver export is temporarily unavailable");
  }
}

