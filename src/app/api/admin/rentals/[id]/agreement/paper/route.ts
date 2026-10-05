import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyAdminAccess } from "@/lib/admin/session";
import { isValidBookingId } from "@/lib/admin/booking-edit";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadAgreementById } from "@/lib/rental-agreements/store";
import { validSignerName } from "@/lib/rental-agreements/types";
import { rateLimit } from "@/lib/rate-limit";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdminAccess();
  if (!auth.ok) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  const limited = rateLimit(req, { scope: "admin-rental-paper-agreement", limit: 30, windowMs: 3600000 });
  if (limited) return limited;
  const { id } = await params;
  if (!isValidBookingId(id)) return NextResponse.json({ error: "Invalid booking." }, { status: 400 });
  if (Number(req.headers.get("content-length")) > 4.5 * 1024 * 1024) return NextResponse.json({ error: "Upload a PDF, JPG or PNG smaller than 4 MB." }, { status: 413 });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Invalid upload." }, { status: 400 }); }
  const file = form.get("file"), agreementId = form.get("agreementId"), requestId = form.get("requestId"), name = form.get("name"), signedOn = form.get("signedOn");
  if (!(file instanceof File) || !file.size || file.size > 4 * 1024 * 1024 || typeof agreementId !== "string" || !uuid.test(agreementId)
    || typeof requestId !== "string" || !uuid.test(requestId) || !validSignerName(name) || typeof signedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(signedOn) || form.get("verified") !== "true") {
    return NextResponse.json({ error: "Enter the signer’s name, signature date, and a signed PDF, JPG or PNG smaller than 4 MB." }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = bytes.subarray(0,5).toString() === "%PDF-" ? { type: "application/pdf", ext: "pdf" }
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? { type: "image/jpeg", ext: "jpg" }
    : bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? { type: "image/png", ext: "png" } : null;
  if (!kind) return NextResponse.json({ error: "The file must be a PDF, JPG or PNG." }, { status: 400 });
  const agreement = await loadAgreementById(id, agreementId);
  if (!agreement || agreement.status === "superseded") return NextResponse.json({ error: "This agreement changed. Reload and use the current unsigned version." }, { status: 409 });
  const path = `${agreementId}/${requestId}-${createHash("sha256").update(bytes).digest("hex")}.${kind.ext}`;
  if (agreement.status === "signed") {
    if (agreement.signature_method === "paper" && agreement.paper_copy_path === path && agreement.signer_legal_name === name.trim() && agreement.paper_signed_on === signedOn) return NextResponse.json({ ok: true, message: "Signed paper copy already recorded." });
    return NextResponse.json({ error: "This agreement is already signed." }, { status: 409 });
  }
  const db = createServiceRoleClient();
  const { error: uploadError } = await db.storage.from("rental-agreement-paper").upload(path, bytes, { contentType: kind.type, upsert: false });
  if (uploadError && String(uploadError.statusCode) !== "409") return NextResponse.json({ error: "The signed copy could not be uploaded. Retry with the same file." }, { status: 503 });
  const { data, error } = await db.rpc("record_rental_paper_agreement", { p_id: agreementId, p_booking_id: id, p_name: name.trim(), p_signed_on: signedOn, p_copy_path: path, p_actor: auth.identity.name });
  if (error) return NextResponse.json({ error: "The upload was received, but recording is unconfirmed. Retry with the same file." }, { status: 503 });
  if (data?.outcome !== "recorded") {
    if (!uploadError) await db.storage.from("rental-agreement-paper").remove([path]);
    return NextResponse.json({ error: "The agreement changed, is already signed, or the signature date is outside this version’s dates. Reload and check the copy." }, { status: 409 });
  }
  revalidatePath("/admin/rentals");
  return NextResponse.json({ ok: true, message: "Signed paper copy recorded and attached to this agreement." });
}
