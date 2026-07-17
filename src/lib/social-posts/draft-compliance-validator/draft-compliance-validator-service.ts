import {
  resolveSpecificationForCandidate,
  validateDraftCandidate,
} from "./draft-compliance-validator-domain";
import type {
  DraftComplianceValidatorInput,
  DraftComplianceValidatorSnapshot,
} from "./draft-compliance-validator-types";

export function buildDraftComplianceValidator(
  input: DraftComplianceValidatorInput,
): DraftComplianceValidatorSnapshot {
  const evaluations = input.candidates
    .map((candidate) =>
      validateDraftCandidate({
        candidate,
        specification: resolveSpecificationForCandidate(candidate, input.specifications),
        asOf: input.asOf,
      }),
    )
    .slice()
    .sort(
      (left, right) =>
        left.candidateId.localeCompare(right.candidateId) ||
        (left.specificationId ?? "").localeCompare(right.specificationId ?? "") ||
        left.id.localeCompare(right.id),
    );

  const assumptions = [
    "Draft Compliance Validator Intelligence evaluates explicitly supplied DraftCandidate text only.",
    "Candidates are never auto-generated from campaigns, briefs, or specifications.",
    "Allowed claims remain a closed set inherited from Wave 10 Content Draft Specifications.",
    "Wave 9/10 price allowlists remain authoritative; no new campaign-to-price matching is introduced.",
    "Results are non-publishable review artifacts and grant no generation or publishing authority.",
    "Underlying Wave 10 generation readiness is preserved and never upgraded.",
  ].sort((left, right) => left.localeCompare(right));

  const warnings = Array.from(
    new Set(
      evaluations.flatMap((evaluation) => {
        const items: string[] = [];
        if (evaluation.underlyingReadiness === "needs-facts") {
          items.push(
            `${evaluation.candidateId}: underlying specification still needs facts.`,
          );
        }
        if (evaluation.underlyingReadiness === "needs-assets") {
          items.push(
            `${evaluation.candidateId}: underlying specification still needs assets.`,
          );
        }
        if (evaluation.underlyingReadiness === "blocked") {
          items.push(`${evaluation.candidateId}: underlying specification remains blocked.`);
        }
        if (evaluation.resultState === "insufficient-spec") {
          items.push(
            `${evaluation.candidateId}: validation result is insufficient-spec because authoritative facts are incomplete.`,
          );
        }
        return items;
      }),
    ),
  ).sort((left, right) => left.localeCompare(right));

  const diagnostics = Array.from(
    new Set([
      `evaluations:${evaluations.length}`,
      `asOf:${input.asOf}`,
      `specifications:${input.specifications.length}`,
      `candidates:${input.candidates.length}`,
      ...evaluations.map(
        (evaluation) =>
          `eval:${evaluation.candidateId}:${evaluation.resultState}:${evaluation.underlyingReadiness}`,
      ),
    ]),
  ).sort((left, right) => left.localeCompare(right));

  return deepFreeze({
    generatedAt: input.asOf,
    asOf: input.asOf,
    evaluations,
    summary: {
      compliant: evaluations.filter((item) => item.resultState === "compliant").length,
      violationsFound: evaluations.filter((item) => item.resultState === "violations-found")
        .length,
      insufficientSpec: evaluations.filter((item) => item.resultState === "insufficient-spec")
        .length,
      unknown: evaluations.filter((item) => item.resultState === "unknown").length,
      notEvaluated: evaluations.filter((item) => item.resultState === "not-evaluated").length,
    },
    assumptions,
    warnings,
    diagnostics,
    constraints: {
      readOnly: true,
      deterministic: true,
      authoritative: false,
      performsNoWrites: true,
      performsNoNetworkCalls: true,
      createsNoDrafts: true,
      generatesNoFinalCopy: true,
      generatesNoMedia: true,
      approvesNothing: true,
      schedulesNothing: true,
      publishesNothing: true,
      executesNothing: true,
    },
  });
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
  } else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
  }
  return Object.freeze(value);
}
