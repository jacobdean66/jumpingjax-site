import type { SocialPost } from "../social-post-data";
import {
  evaluateAgentComplianceGate,
  type ComplianceGateResult,
} from "./agent-compliance-gate";
import { DRAFT_COMPLIANCE_PERSISTENCE_POLICY } from "./generation-gate";

/**
 * Server-side approval/scheduling transition gate.
 *
 * Any transition into an approval-ready state (approved / scheduled / posted)
 * must be re-validated against the authoritative deterministic compliance
 * policy on the server-owned stored content immediately before the transition.
 * Client-supplied compliance booleans, quarantine flags, fingerprints, or
 * approval claims are never trusted. There is no owner override: ineligible
 * transitions fail closed and leave the stored post unchanged.
 * Jacob remains the only final human approver; nothing here publishes,
 * schedules externally, creates publication intents, or triggers paid media.
 */

export const APPROVAL_READY_STATUSES = [
  "approved",
  "scheduled",
  "posted",
] as const;

export type ApprovalReadyStatus = (typeof APPROVAL_READY_STATUSES)[number];

export function isApprovalReadyStatus(
  status: string | null | undefined,
): status is ApprovalReadyStatus {
  return (
    typeof status === "string" &&
    (APPROVAL_READY_STATUSES as readonly string[]).includes(status.trim())
  );
}

export type StatusTransitionEvaluation = {
  eligible: boolean;
  requestedStatus: string;
  approvalReady: boolean;
  compliance: ComplianceGateResult | null;
  reason: string;
};

/**
 * Pure decision core: given the requested status and a freshly recomputed
 * server-side compliance result, decide eligibility. Approval-ready
 * transitions require a current deterministic `allow`
 * (allowedToProceed === true). Blocked, quarantined, or unevaluated content
 * can never be approved, scheduled, or marked posted.
 */
export function statusTransitionDecision(input: {
  requestedStatus: string;
  compliance: ComplianceGateResult | null;
}): StatusTransitionEvaluation {
  const requestedStatus = input.requestedStatus.trim();
  const approvalReady = isApprovalReadyStatus(requestedStatus);

  if (!approvalReady) {
    return {
      eligible: true,
      requestedStatus,
      approvalReady: false,
      compliance: input.compliance,
      reason:
        "Non-approval status transition; deterministic approval gate not required.",
    };
  }

  const compliance = input.compliance;
  if (!compliance) {
    return {
      eligible: false,
      requestedStatus,
      approvalReady: true,
      compliance: null,
      reason:
        "No authoritative compliance evaluation is available for the stored draft; approval-ready transitions fail closed.",
    };
  }

  if (compliance.allowedToProceed === true && compliance.decision === "allow") {
    return {
      eligible: true,
      requestedStatus,
      approvalReady: true,
      compliance,
      reason:
        "Deterministic compliance allow on the current stored content. Owner (Jacob) approval remains the final human decision.",
    };
  }

  return {
    eligible: false,
    requestedStatus,
    approvalReady: true,
    compliance,
    reason: `Deterministic compliance decision is ${compliance.decision}; ${
      compliance.decision === "quarantine"
        ? "quarantined working drafts are never approval-ready."
        : compliance.decision === "block"
          ? "blocked content can never be approved or scheduled."
          : "only a current allow permits approval-ready transitions."
    }`,
  };
}

/**
 * Recompute compliance from the server-owned stored post fields and evaluate
 * a requested status transition. `scheduled_for`-only updates are treated as
 * a transition into "scheduled".
 */
export function evaluateStatusTransitionFromStoredPost(input: {
  post: Pick<
    SocialPost,
    | "id"
    | "title"
    | "caption"
    | "prompt"
    | "campaign_id"
    | "platforms"
    | "media_type"
  >;
  requestedStatus: string;
  posts: readonly SocialPost[];
}): StatusTransitionEvaluation {
  const requestedStatus = input.requestedStatus.trim();
  if (!isApprovalReadyStatus(requestedStatus)) {
    return statusTransitionDecision({ requestedStatus, compliance: null });
  }

  const compliance = evaluateAgentComplianceGate({
    title: input.post.title ?? "",
    caption: input.post.caption ?? "",
    generationPrompt: input.post.prompt ?? "",
    campaignId: input.post.campaign_id,
    platforms: input.post.platforms,
    mediaType:
      input.post.media_type === "image" || input.post.media_type === "video"
        ? input.post.media_type
        : null,
    posts: input.posts,
    candidateId: `explicit:status-transition:${input.post.id}`,
  });

  return statusTransitionDecision({ requestedStatus, compliance });
}

export function statusTransitionDeniedBody(
  evaluation: StatusTransitionEvaluation,
): {
  ok: false;
  error: string;
  code: "status_transition_denied";
  requestedStatus: string;
  compliance: ComplianceGateResult | null;
  draftPolicy: typeof DRAFT_COMPLIANCE_PERSISTENCE_POLICY;
  publication: { published: false; note: string };
} {
  return {
    ok: false,
    error: `Status transition to "${evaluation.requestedStatus}" was rejected by the server-side approval gate. ${evaluation.reason}`,
    code: "status_transition_denied",
    requestedStatus: evaluation.requestedStatus,
    compliance: evaluation.compliance,
    draftPolicy: DRAFT_COMPLIANCE_PERSISTENCE_POLICY,
    publication: {
      published: false,
      note: "Nothing was approved, scheduled, published, or persisted. The stored post is unchanged.",
    },
  };
}
