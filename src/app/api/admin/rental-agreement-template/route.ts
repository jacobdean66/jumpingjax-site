import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadAgreementTemplate } from "@/lib/rental-agreements/store";
export async function GET() {
  if (!(await verifyAdminOwnerAccess()).ok) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  return NextResponse.json(await loadAgreementTemplate(), { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  let body;
  try { const raw = await req.text(); if (raw.length > 30000) throw new Error(); body = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Invalid agreement text." }, { status: 400 }); }
  if (typeof body?.title !== "string" || !body.title.trim() || body.title.trim().length > 160 || typeof body.terms !== "string" || body.terms.trim().length < 20 || body.terms.trim().length > 20000 || !Number.isInteger(body.version)) return NextResponse.json({ error: "Enter a title and agreement terms (20–20,000 characters)." }, { status: 400 });
  const { data, error } = await createServiceRoleClient().rpc("save_rental_agreement_template", { p_expected_version: body.version, p_title: body.title, p_terms: body.terms, p_actor: auth.identity.name });
  if (error) return NextResponse.json({ error: "The agreement template could not be saved." }, { status: 503 });
  if (data?.outcome !== "saved") return NextResponse.json({ error: "Another edit was saved. Reload the template before editing again." }, { status: 409 });
  revalidatePath("/admin/rentals");
  return NextResponse.json({ ok: true, version: data.version });
}
