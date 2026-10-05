import { NextResponse } from "next/server";
import { loadAgreementByToken } from "@/lib/rental-agreements/store";
import { createServiceRoleClient } from "@/lib/supabase/admin";
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const agreement = await loadAgreementByToken(token);
  if (!agreement?.signed_at || agreement.signature_method !== "paper" || !agreement.paper_copy_path) return NextResponse.json({ error: "Signed paper copy not found." }, { status: 404 });
  const { data, error } = await createServiceRoleClient().storage.from("rental-agreement-paper").createSignedUrl(agreement.paper_copy_path, 60, { download: true });
  if (error || !data) return NextResponse.json({ error: "The signed copy could not be loaded." }, { status: 503 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
