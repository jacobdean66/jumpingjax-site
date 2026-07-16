import type { MarketingMemorySnapshot } from "./marketing-memory-types";

export type MarketingMemoryDiagnostic = Readonly<{
  code: "empty_history" | "duplicate_risk_detected";
  severity: "info" | "warning";
  message: string;
}>;

export function diagnoseMarketingMemory(
  memory: MarketingMemorySnapshot,
): readonly MarketingMemoryDiagnostic[] {
  const diagnostics: MarketingMemoryDiagnostic[] = [];
  if (memory.campaignHistory.length === 0) {
    diagnostics.push({
      code: "empty_history",
      severity: "info",
      message: "No campaign history is available.",
    });
  }
  if (memory.duplicateRisk.length > 0) {
    diagnostics.push({
      code: "duplicate_risk_detected",
      severity: "warning",
      message: `${memory.duplicateRisk.length} duplicate-risk warning(s) detected.`,
    });
  }
  return diagnostics;
}
