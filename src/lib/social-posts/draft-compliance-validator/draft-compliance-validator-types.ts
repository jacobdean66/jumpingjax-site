import type {
  ContentDraftSpecification,
  ContentDraftSpecificationReadiness,
} from "../content-draft-specification/content-draft-specification-types";

export type DraftComplianceResultState =
  | "compliant"
  | "violations-found"
  | "insufficient-spec"
  | "unknown"
  | "not-evaluated";

export type DraftComplianceSeverity = "blocking" | "advisory";

export type DraftComplianceViolationCode =
  | "unsupported-claim"
  | "unverified-claim"
  | "prohibited-claim"
  | "unauthorized-price"
  | "availability-claim"
  | "scarcity-claim"
  | "urgency-claim"
  | "testimonial-claim"
  | "package-content-invention"
  | "cta-constraint-violation"
  | "platform-mismatch"
  | "placement-mismatch"
  | "length-limit-exceeded"
  | "required-section-missing"
  | "required-media-missing"
  | "accessibility-gap"
  | "empty-candidate"
  | "malformed-candidate"
  | "specification-missing"
  | "insufficient-authoritative-facts";

export type DraftCandidateSectionId =
  | "hook"
  | "primary-message"
  | "supporting-proof"
  | "cta"
  | "full-caption";

export type DraftCandidateMediaDeclarations = Readonly<{
  hasImage: boolean;
  hasVideo: boolean;
  imageAltText: string | null;
  videoCaptionsOrTranscript: string | null;
  claimsImageOnly: boolean;
}>;

/**
 * Explicit draft candidate supplied by caller or fixture.
 * Never auto-derived from campaign, brief, or specification.
 */
export type DraftCandidate = Readonly<{
  id: string;
  /** When set, must match the Wave 10 specification id exactly. */
  sourceSpecificationId: string | null;
  campaignId: string;
  label: string;
  /** Marks deterministic test/review fixtures. */
  fixtureKind: "deterministic-test-fixture" | "explicit-caller-input";
  sections: Readonly<{
    hook: string | null;
    primaryMessage: string | null;
    supportingProof: string | null;
    cta: string | null;
    fullCaption: string | null;
  }>;
  declaredPlatform: string | null;
  declaredPlacement: string | null;
  mediaDeclarations: DraftCandidateMediaDeclarations;
}>;

export type DraftComplianceFinding = Readonly<{
  code: DraftComplianceViolationCode;
  severity: DraftComplianceSeverity;
  explanation: string;
  sectionId: DraftCandidateSectionId | "candidate" | null;
  textExcerpt: string | null;
  relatedConstraint: string | null;
}>;

export type DraftComplianceEvaluation = Readonly<{
  id: string;
  candidateId: string;
  specificationId: string | null;
  campaignId: string;
  asOf: string;
  resultState: DraftComplianceResultState;
  underlyingReadiness: ContentDraftSpecificationReadiness | "specification-missing";
  blockingViolations: readonly DraftComplianceFinding[];
  advisoryFindings: readonly DraftComplianceFinding[];
  diagnostics: readonly string[];
  reviewArtifactOnly: true;
  nonPublishable: true;
  grantsNoGenerationAuthority: true;
  grantsNoPublishingAuthority: true;
  readinessUpgraded: false;
}>;

export type DraftComplianceValidatorConstraints = Readonly<{
  readOnly: true;
  deterministic: true;
  authoritative: false;
  performsNoWrites: true;
  performsNoNetworkCalls: true;
  createsNoDrafts: true;
  generatesNoFinalCopy: true;
  generatesNoMedia: true;
  approvesNothing: true;
  schedulesNothing: true;
  publishesNothing: true;
  executesNothing: true;
}>;

export type DraftComplianceValidatorSnapshot = Readonly<{
  generatedAt: string;
  asOf: string;
  evaluations: readonly DraftComplianceEvaluation[];
  summary: Readonly<{
    compliant: number;
    violationsFound: number;
    insufficientSpec: number;
    unknown: number;
    notEvaluated: number;
  }>;
  assumptions: readonly string[];
  warnings: readonly string[];
  diagnostics: readonly string[];
  constraints: DraftComplianceValidatorConstraints;
}>;

export type DraftComplianceValidatorInput = Readonly<{
  specifications: readonly ContentDraftSpecification[];
  candidates: readonly DraftCandidate[];
  asOf: string;
}>;
