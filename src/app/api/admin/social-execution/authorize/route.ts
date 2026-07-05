import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { authorizeExecutionForOwner } from "@/lib/social-posts/execution-authorization/social-execution-authorization-service";
import { validateExecutionAuthorizationRequest } from "@/lib/social-posts/execution-authorization/social-execution-authorization-request";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token = String(formData.get("token") ?? "");
  const executionIntentId = String(formData.get("execution_intent_id") ?? "");
  const publicationTargetId = String(formData.get("publication_target_id") ?? "");
  const ownerApprovalId = String(formData.get("owner_approval_id") ?? "");
  const approvalId = String(formData.get("approval_id") ?? "");
  const socialPostId = String(formData.get("social_post_id") ?? "");

  const auth = await verifyAdminOwnerAccess(token);
  if (!auth.ok) {
    return NextResponse.json({ error: "Owner authorization required." }, { status: 401 });
  }

  const validation = validateExecutionAuthorizationRequest({
    executionIntentId,
    publicationTargetId,
    ownerApprovalId,
    approvalId: approvalId || undefined,
    socialPostId: socialPostId || undefined,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  const authorization = await authorizeExecutionForOwner({
    executionIntentId: validation.executionIntentId,
    publicationTargetId: validation.publicationTargetId,
    ownerApprovalId: validation.ownerApprovalId,
    approvalId: validation.approvalId,
    socialPostId: validation.socialPostId,
    adminActorId: auth.identity.id,
  });

  const redirectUrl = new URL("/admin/social-posts/publication-execution", req.url);
  if (token) redirectUrl.searchParams.set("token", token);
  redirectUrl.searchParams.set("executionIntentId", validation.executionIntentId);
  redirectUrl.searchParams.set("publicationTargetId", validation.publicationTargetId);
  redirectUrl.searchParams.set("ownerApprovalId", validation.ownerApprovalId);

  if (!authorization.ok) {
    redirectUrl.searchParams.set("exec_auth", "authorize_failed");
    redirectUrl.searchParams.set("exec_auth_error", authorization.code);
    redirectUrl.searchParams.set("exec_auth_message", authorization.message);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  redirectUrl.searchParams.set("exec_auth", "authorized");
  redirectUrl.searchParams.set("exec_auth_id", authorization.authorizationId);
  redirectUrl.searchParams.set("exec_auth_correlation_id", authorization.correlationId);
  redirectUrl.searchParams.set("exec_auth_session_id", authorization.sessionId);
  return NextResponse.redirect(redirectUrl, { status: 303 });
}
