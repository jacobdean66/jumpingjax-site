import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { createExecutionAttemptForOwner } from "@/lib/social-posts/execution-attempt/social-execution-attempt-service";
import { validateExecutionAttemptRequest } from "@/lib/social-posts/execution-attempt/social-execution-attempt-request";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token = String(formData.get("token") ?? "");
  const authorizationId = String(formData.get("authorization_id") ?? "");
  const executionIntentId = String(formData.get("execution_intent_id") ?? "");
  const publicationTargetId = String(formData.get("publication_target_id") ?? "");

  const auth = await verifyAdminOwnerAccess(token);
  if (!auth.ok) {
    return NextResponse.json({ error: "Owner authorization required." }, { status: 401 });
  }

  const validation = validateExecutionAttemptRequest({
    authorizationId,
    executionIntentId,
    publicationTargetId,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  const creation = await createExecutionAttemptForOwner({
    authorizationId: validation.authorizationId,
    executionIntentId: validation.executionIntentId,
    publicationTargetId: validation.publicationTargetId,
    adminActorId: auth.identity.id,
  });

  const redirectUrl = new URL("/admin/social-posts/publication-execution", req.url);
  if (token) redirectUrl.searchParams.set("token", token);
  redirectUrl.searchParams.set("executionIntentId", validation.executionIntentId);
  redirectUrl.searchParams.set("publicationTargetId", validation.publicationTargetId);
  redirectUrl.searchParams.set("exec_auth_id", validation.authorizationId);

  if (!creation.ok) {
    redirectUrl.searchParams.set("exec_attempt", "create_failed");
    redirectUrl.searchParams.set("exec_attempt_error", creation.code);
    redirectUrl.searchParams.set("exec_attempt_message", creation.message);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  redirectUrl.searchParams.set("exec_attempt", "created");
  redirectUrl.searchParams.set("exec_attempt_id", creation.attemptId);
  redirectUrl.searchParams.set("exec_attempt_correlation_id", creation.correlationId);
  redirectUrl.searchParams.set("exec_attempt_idempotency_key", creation.idempotencyKey);
  redirectUrl.searchParams.set("exec_attempt_session_id", creation.sessionId);
  return NextResponse.redirect(redirectUrl, { status: 303 });
}
