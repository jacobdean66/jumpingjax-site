import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { prepareRentalBooking } from "@/lib/rental-agreements/prepare-booking";
import { buildRentalAgreementSnapshot } from "@/lib/rental-agreements/snapshot";
import { loadAgreementTemplate } from "@/lib/rental-agreements/store";
import { createPreviewToken } from "@/lib/rental-agreements/security";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const limited = rateLimit(req, { scope: "rental-agreement-preview", limit: 60, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;
  try {
    const raw = await req.text();
    if (raw.length > 65536) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const prepared = await prepareRentalBooking({ ...body, idempotency_key: "agreement-preview" });
    if (prepared instanceof Response) return prepared;
    const snapshot = buildRentalAgreementSnapshot(prepared.input, await loadAgreementTemplate());
    return NextResponse.json({ snapshot, previewToken: createPreviewToken(snapshot) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The agreement could not be loaded. Please try again." }, { status: 503 });
  }
}
