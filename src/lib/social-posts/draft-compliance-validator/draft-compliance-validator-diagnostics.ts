import type { DraftComplianceValidatorSnapshot } from "./draft-compliance-validator-types";

export type DraftComplianceValidatorDiagnostic = Readonly<{
  code:
    | "no_evaluations"
    | "violations_found"
    | "insufficient_spec"
    | "not_evaluated"
    | "compliant_reviews"
    | "readiness_not_upgraded";
  severity: "info" | "warning";
  message: string;
}>;

export function diagnoseDraftComplianceValidator(
  snapshot: DraftComplianceValidatorSnapshot,
): readonly DraftComplianceValidatorDiagnostic[] {
  const diagnostics: DraftComplianceValidatorDiagnostic[] = [];

  if (snapshot.evaluations.length === 0) {
    diagnostics.push({
      code: "no_evaluations",
      severity: "warning",
      message: "No draft compliance evaluations were produced.",
    });
  }

  if (snapshot.summary.violationsFound > 0) {
    diagnostics.push({
      code: "violations_found",
      severity: "warning",
      message: `${snapshot.summary.violationsFound} evaluation${snapshot.summary.violationsFound === 1 ? "" : "s"} found blocking violations.`,
    });
  }

  if (snapshot.summary.insufficientSpec > 0) {
    diagnostics.push({
      code: "insufficient_spec",
      severity: "warning",
      message: `${snapshot.summary.insufficientSpec} evaluation${snapshot.summary.insufficientSpec === 1 ? "" : "s"} are insufficient-spec because authoritative facts are incomplete.`,
    });
  }

  if (snapshot.summary.notEvaluated > 0) {
    diagnostics.push({
      code: "not_evaluated",
      severity: "warning",
      message: `${snapshot.summary.notEvaluated} evaluation${snapshot.summary.notEvaluated === 1 ? "" : "s"} were not evaluated.`,
    });
  }

  if (snapshot.summary.compliant > 0) {
    diagnostics.push({
      code: "compliant_reviews",
      severity: "info",
      message: `${snapshot.summary.compliant} evaluation${snapshot.summary.compliant === 1 ? "" : "s"} are text-compliant review artifacts only and grant no generation or publishing authority.`,
    });
  }

  diagnostics.push({
    code: "readiness_not_upgraded",
    severity: "info",
    message:
      "Underlying Wave 10 generation readiness is preserved on every evaluation and was never upgraded.",
  });

  return diagnostics;
}
