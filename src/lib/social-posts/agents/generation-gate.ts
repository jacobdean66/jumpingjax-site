import type { ComplianceGateResult } from "./agent-compliance-gate";

/**
 * Draft persistence policy (Social Strategy / regeneration):
 * - quarantine: may save only as a clearly labeled, non-approved working draft.
 *   Not compliant, not approved, not publishable, not generation-ready.
 *   Does NOT unlock paid image/video generation. Owner review remains required.
 * - block: must NOT be persisted through agent-draft or regeneration flows.
 * - allow: may persist as a normal working draft; still requires Jacob approval
 *   before publish; paid generation still requires a fresh allow on the exact prompt.
 */
export const DRAFT_COMPLIANCE_PERSISTENCE_POLICY = {
  quarantineMayPersistWorkingDraft: true,
  quarantineUnlocksPaidGeneration: false,
  blockMayPersistViaAgentFlows: false,
  ownerApprovalAlwaysRequired: true,
} as const;

export function complianceAllowsPaidGeneration(
  compliance: ComplianceGateResult,
): boolean {
  return compliance.allowedToProceed === true && compliance.decision === "allow";
}

export function complianceBlocksPersistence(
  compliance: ComplianceGateResult,
): boolean {
  return compliance.decision === "block";
}

export function paidGenerationDeniedResponse(compliance: ComplianceGateResult): {
  ok: false;
  error: string;
  code: "compliance_not_allow" | "compliance_blocked";
  compliance: ComplianceGateResult;
  publication: { published: false; note: string };
} {
  const blocked = compliance.decision === "block";
  return {
    ok: false,
    error: blocked
      ? "Paid generation blocked by deterministic compliance validation."
      : "Paid generation requires deterministic compliance decision allow (allowedToProceed=true). Quarantined or non-allow prompts cannot start paid media.",
    code: blocked ? "compliance_blocked" : "compliance_not_allow",
    compliance,
    publication: {
      published: false,
      note: "No paid media generation was started. Nothing was published.",
    },
  };
}

export function previewGenerationReady(compliance: ComplianceGateResult | null | undefined): {
  generationReady: boolean;
  reason: string;
} {
  if (!compliance) {
    return {
      generationReady: false,
      reason: "No compliance result for the exact current prompt.",
    };
  }
  if (complianceAllowsPaidGeneration(compliance)) {
    return {
      generationReady: true,
      reason: "Deterministic compliance allow on the exact current prompt.",
    };
  }
  return {
    generationReady: false,
    reason: `Compliance decision is ${compliance.decision}; generation stays disabled until allow.`,
  };
}
