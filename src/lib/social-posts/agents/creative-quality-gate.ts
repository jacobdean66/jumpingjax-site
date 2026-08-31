import type { CreativeDirectorOutput } from "./orchestration-types";

export type CreativeQualityGateResult = Readonly<{
  allowed: boolean;
  findings: readonly string[];
}>;

export function evaluateCreativeQualityGate(input: {
  creative: CreativeDirectorOutput;
  themeLabel?: string | null;
  themeSource?: string | null;
}): CreativeQualityGateResult {
  const findings: string[] = [];
  const title = input.creative.title.trim();
  const caption = input.creative.caption.trim();
  const combined = `${title}\n${caption}\n${input.creative.generationPrompt}`.toLowerCase();
  if (title.length < 16 || /^jumping jax:\s*(promote|create|drive)/i.test(title)) {
    findings.push("Title is an instruction echo, not finished social copy.");
  }
  if (caption.length < 100) findings.push("Caption is too thin for owner review.");
  if (/\b(promote\s+indoor|aligned with:|objective:|owner confirms facts|revision focus:|remove the sonic|simplify the generation prompt)\b/i.test(`${title}\n${caption}`)) {
    findings.push("Copy exposes internal instructions or workflow language.");
  }
  if (input.creative.businessFocus === "facility-parties" && !/\b(indoor|facility party|facility-party)\b/i.test(combined)) {
    findings.push("Facility-party setting is not explicit.");
  }
  if (input.themeLabel) {
    const label = input.themeLabel.toLowerCase();
    const source = input.themeSource?.toLowerCase() ?? "";
    if (!combined.includes(label) && (!source || !combined.includes(source))) {
      findings.push("Matched theme is missing from the creative direction.");
    }
  }
  return { allowed: findings.length === 0, findings };
}
