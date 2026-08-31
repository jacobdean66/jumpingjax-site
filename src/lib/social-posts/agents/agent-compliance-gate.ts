import { SOCIAL_CAMPAIGNS } from "../social-campaigns";
import { listSocialPosts, type SocialPost } from "../social-post-data";
import { replayDraftComplianceValidator } from "../draft-compliance-validator/draft-compliance-validator-replay";
import type {
  DraftCandidate,
  DraftComplianceEvaluation,
  DraftComplianceResultState,
} from "../draft-compliance-validator/draft-compliance-validator-types";
import type { ContentDraftSpecification } from "../content-draft-specification/content-draft-specification-types";
import { scanProhibitedBusinessClaims } from "./agent-input-bounds";

export type ComplianceGateDecision =
  | "allow"
  | "quarantine"
  | "block";

export type ComplianceGateResult = {
  deterministic: true;
  modelApproved: false;
  resultState: DraftComplianceResultState | "hard-claim-blocked";
  decision: ComplianceGateDecision;
  allowedToProceed: boolean;
  summary: string;
  blockingCodes: string[];
  hardClaimFindings: string[];
  evaluationId: string | null;
  specificationId: string | null;
};

function toCandidate(input: {
  id: string;
  title: string;
  caption: string;
  generationPrompt: string;
  campaignId: string | null;
  platforms?: readonly string[] | null;
  mediaType?: "image" | "video" | null;
  imageAltText?: string | null;
  claimsImageOnly?: boolean;
}): DraftCandidate {
  return {
    id: input.id,
    sourceSpecificationId: null,
    campaignId: input.campaignId ?? "unspecified",
    label: input.title.slice(0, 160),
    fixtureKind: "explicit-caller-input",
    sections: {
      hook: input.title.slice(0, 240),
      primaryMessage: input.caption.slice(0, 1200),
      supportingProof: null,
      cta: null,
      fullCaption: `${input.caption}\n\n${input.generationPrompt}`.slice(0, 4500),
    },
    declaredPlatform: input.platforms?.[0] ?? null,
    declaredPlacement: null,
    mediaDeclarations: {
      hasImage: input.mediaType === "image",
      hasVideo: input.mediaType === "video",
      imageAltText: input.mediaType === "image" ? input.imageAltText?.trim() || null : null,
      videoCaptionsOrTranscript: null,
      claimsImageOnly: input.claimsImageOnly ?? false,
    },
  };
}

function decisionFromEvaluation(
  evaluation: DraftComplianceEvaluation | undefined,
  hardFindings: string[],
): ComplianceGateDecision {
  if (hardFindings.length > 0) return "block";
  if (!evaluation) return "quarantine";
  if (evaluation.resultState === "violations-found") return "block";
  if (
    evaluation.resultState === "insufficient-spec" ||
    evaluation.resultState === "not-evaluated" ||
    evaluation.resultState === "unknown"
  ) {
    return "quarantine";
  }
  if (evaluation.resultState === "compliant") return "allow";
  return "quarantine";
}

export function evaluateAgentComplianceGate(input: {
  title: string;
  caption: string;
  generationPrompt: string;
  campaignId: string | null;
  platforms?: readonly string[] | null;
  mediaType?: "image" | "video" | null;
  imageAltText?: string | null;
  claimsImageOnly?: boolean;
  posts: readonly SocialPost[];
  asOf?: string;
  candidateId?: string;
}): ComplianceGateResult {
  const asOf = input.asOf ?? new Date().toISOString();
  const combined = `${input.title}\n${input.caption}\n${input.generationPrompt}`;
  const hardClaimFindings = scanProhibitedBusinessClaims(combined);

  const candidate = toCandidate({
    id: input.candidateId ?? `explicit:agent-${asOf}`,
    title: input.title,
    caption: input.caption,
    generationPrompt: input.generationPrompt,
    campaignId: input.campaignId,
    platforms: input.platforms,
    mediaType: input.mediaType,
    imageAltText: input.imageAltText,
    claimsImageOnly: input.claimsImageOnly,
  });

  const snapshot = replayDraftComplianceValidator({
    posts: input.posts,
    campaigns: SOCIAL_CAMPAIGNS,
    asOf,
    candidates: [candidate],
  });
  const evaluation = snapshot.evaluations[0];
  const decision = decisionFromEvaluation(evaluation, hardClaimFindings);
  const blockingCodes = [
    ...hardClaimFindings.map(() => "hard-prohibited-business-claim"),
    ...(evaluation?.blockingViolations.map((item) => item.code) ?? []),
  ];

  const resultState: ComplianceGateResult["resultState"] =
    hardClaimFindings.length > 0
      ? "hard-claim-blocked"
      : (evaluation?.resultState ?? "not-evaluated");

  const summaryParts = [
    `Deterministic compliance decision: ${decision}.`,
    `Result state: ${resultState}.`,
    hardClaimFindings.length
      ? `Hard claim findings: ${hardClaimFindings.join(" ")}`
      : null,
    evaluation?.blockingViolations[0]
      ? `Blocking: ${evaluation.blockingViolations[0].explanation}`
      : null,
    decision === "quarantine"
      ? "Output is quarantined for owner review and is not treated as successful compliance."
      : null,
    decision === "block"
      ? "Output is blocked from persistence or paid generation."
      : null,
  ].filter(Boolean);

  return {
    deterministic: true,
    modelApproved: false,
    resultState,
    decision,
    allowedToProceed: decision === "allow",
    summary: summaryParts.join(" "),
    blockingCodes,
    hardClaimFindings,
    evaluationId: evaluation?.id ?? null,
    specificationId: evaluation?.specificationId ?? null,
  };
}

export async function evaluateAgentComplianceGateWithPosts(
  input: Omit<Parameters<typeof evaluateAgentComplianceGate>[0], "posts"> & {
    posts?: readonly SocialPost[];
  },
): Promise<ComplianceGateResult> {
  const posts = input.posts ?? (await listSocialPosts());
  return evaluateAgentComplianceGate({ ...input, posts });
}

/** Lightweight gate for edited generation prompts (image/video generate). */
export function evaluateEditedPromptCompliance(input: {
  prompt: string;
  caption?: string | null;
  title?: string | null;
  campaignId: string | null;
  posts: readonly SocialPost[];
}): ComplianceGateResult {
  return evaluateAgentComplianceGate({
    title: input.title?.trim() || "Edited media prompt",
    caption: input.caption?.trim() || "Edited media prompt review",
    generationPrompt: input.prompt,
    campaignId: input.campaignId,
    posts: input.posts,
    candidateId: "explicit:edited-prompt",
  });
}

export type { ContentDraftSpecification };
