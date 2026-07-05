import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { appendExecutionAttemptEvidenceForOwner } from "@/lib/social-posts/execution-attempt/social-execution-attempt-evidence-service";
import { validateExecutionAttemptEvidenceAppendRequest } from "@/lib/social-posts/execution-attempt/social-execution-attempt-evidence-request";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token = String(formData.get("token") ?? "");
  const attemptId = String(formData.get("attempt_id") ?? "");
  const ownerApprovalId = String(formData.get("owner_approval_id") ?? "");
  const evidenceKind = String(formData.get("evidence_kind") ?? "");
  const sanitizedSummary = String(formData.get("sanitized_summary") ?? "");
  const transitionKind = String(formData.get("transition_kind") ?? "");

  const auth = await verifyAdminOwnerAccess(token);
  if (!auth.ok) {
    return NextResponse.json({ error: "Owner authorization required." }, { status: 401 });
  }

  const validation = validateExecutionAttemptEvidenceAppendRequest({
    attemptId,
    ownerApprovalId,
    evidenceKind,
    sanitizedSummary,
    transitionKind: transitionKind || undefined,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  const append = await appendExecutionAttemptEvidenceForOwner({
    attemptId: validation.attemptId,
    ownerApprovalId: validation.ownerApprovalId,
    evidenceKind: validation.evidenceKind,
    sanitizedSummary: validation.sanitizedSummary,
    transitionKind: validation.transitionKind ?? undefined,
    adminActorId: auth.identity.id,
  });

  const redirectUrl = new URL("/admin/social-posts/publication-execution", req.url);
  if (token) redirectUrl.searchParams.set("token", token);
  redirectUrl.searchParams.set("exec_attempt_id", validation.attemptId);
  redirectUrl.searchParams.set("ownerApprovalId", validation.ownerApprovalId);

  if (!append.ok) {
    redirectUrl.searchParams.set("exec_evidence", "append_failed");
    redirectUrl.searchParams.set("exec_evidence_error", append.code);
    redirectUrl.searchParams.set("exec_evidence_message", append.message);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  redirectUrl.searchParams.set("exec_evidence", "appended");
  redirectUrl.searchParams.set("exec_evidence_id", append.evidenceId);
  redirectUrl.searchParams.set("exec_evidence_correlation_id", append.correlationId);
  if (append.transitionId) {
    redirectUrl.searchParams.set("exec_evidence_transition_id", append.transitionId);
  }
  return NextResponse.redirect(redirectUrl, { status: 303 });
}
