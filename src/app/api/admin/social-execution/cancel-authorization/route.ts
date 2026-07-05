import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { cancelExecutionAuthorizationForOwner } from "@/lib/social-posts/execution-authorization/social-execution-authorization-service";
import { validateExecutionAuthorizationCancellationRequest } from "@/lib/social-posts/execution-authorization/social-execution-authorization-cancellation-request";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token = String(formData.get("token") ?? "");
  const authorizationId = String(formData.get("authorization_id") ?? "");
  const sanitizedDetail = String(formData.get("sanitized_detail") ?? "");

  const auth = await verifyAdminOwnerAccess(token);
  if (!auth.ok) {
    return NextResponse.json({ error: "Owner authorization required." }, { status: 401 });
  }

  const validation = validateExecutionAuthorizationCancellationRequest({
    authorizationId,
    sanitizedDetail: sanitizedDetail || undefined,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  const cancellation = await cancelExecutionAuthorizationForOwner({
    authorizationId: validation.authorizationId,
    sanitizedDetail: validation.sanitizedDetail,
    adminActorId: auth.identity.id,
  });

  const redirectUrl = new URL("/admin/social-posts/publication-execution", req.url);
  if (token) redirectUrl.searchParams.set("token", token);
  redirectUrl.searchParams.set("exec_auth_id", validation.authorizationId);

  if (!cancellation.ok) {
    redirectUrl.searchParams.set("exec_auth", "cancel_failed");
    redirectUrl.searchParams.set("exec_auth_error", cancellation.code);
    redirectUrl.searchParams.set("exec_auth_message", cancellation.message);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  redirectUrl.searchParams.set("exec_auth", "cancelled");
  redirectUrl.searchParams.set("exec_auth_correlation_id", cancellation.correlationId);
  redirectUrl.searchParams.set("exec_auth_cancellation_id", cancellation.cancellationId);
  return NextResponse.redirect(redirectUrl, { status: 303 });
}
