import { NextResponse } from "next/server";

import {
  agreementIpHmac,
  hashAgreementToken,
  requestIp,
} from "@/lib/facility-parties/agreement";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function POST(req: Request, context: { params: Promise<{ token: string }> }) {
  const limited = rateLimit(req, { scope: "facility-agreement-sign", limit: 10, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;
  const { token } = await context.params;
  if (!token || token.length < 32 || token.length > 128) {
    return NextResponse.json({ ok: false, message: "Agreement not found." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid signature." }, { status: 400 });
  }
  const legalName = typeof body.legalName === "string" ? body.legalName.trim() : "";
  if (body.accepted !== true || legalName.length < 2 || legalName.length > 120) {
    return NextResponse.json({ ok: false, message: "Enter your legal name and accept the agreement." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("sign_facility_party_agreement", {
    p_public_token_hash: hashAgreementToken(token),
    p_signer_legal_name: legalName,
    p_signer_ip_hmac: agreementIpHmac(requestIp(req)),
    p_signer_user_agent: req.headers.get("user-agent")?.slice(0, 512) ?? null,
  });
  const result = data as { outcome?: string } | null;
  if (error) {
    return NextResponse.json({ ok: false, message: "The agreement could not be signed." }, { status: 503 });
  }
  if (result?.outcome === "superseded") {
    return NextResponse.json({ ok: false, message: "This agreement was replaced. Please use the newest email link." }, { status: 409 });
  }
  if (result?.outcome === "not_found") {
    return NextResponse.json({ ok: false, message: "Agreement not found." }, { status: 404 });
  }
  if (result?.outcome !== "signed" && result?.outcome !== "already_signed") {
    return NextResponse.json({ ok: false, message: "The agreement could not be signed." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, alreadySigned: result.outcome === "already_signed" });
}
