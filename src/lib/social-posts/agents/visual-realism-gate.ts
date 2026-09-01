export const VISUAL_REALISM_REQUIREMENTS = [
  "Preserve the exact source product or approved artwork; do not redraw, stretch, compress, or alter its geometry, colors, branding, or proportions.",
  "Keep children and adults at realistic human scale relative to the scene and any known real-world product dimensions, with consistent camera perspective and depth.",
  "Require natural anatomy, faces, hands, limbs, ground contact, shadows, occlusion, and eye lines; reject duplicated, missing, fused, or distorted body parts.",
  "Do not place people inside, through, floating above, or impossibly behind the inflatable or facility structure.",
] as const;

export function applyVisualRealismConstraints(input: {
  prompt: string;
  hasReferenceAsset: boolean;
  assetKind?: "product" | "lifestyle" | "theme-artwork" | "brand" | null;
  themeLabel?: string | null;
}): string {
  const referenceRule = input.hasReferenceAsset
    ? VISUAL_REALISM_REQUIREMENTS[0]
    : "No verified product reference is available: use licensed graphic motifs only and do not synthesize a real inflatable, facility layout, child, or adult.";
  const themeRule = input.themeLabel
    ? `Theme direction comes from the Party / Invitation Agent library match “${input.themeLabel}”; do not imply endorsement, partnership, or official character licensing.`
    : null;
  const peopleRule = input.assetKind === "lifestyle"
    ? "Use only the people already visible in the approved lifestyle source; do not add, remove, replace, or synthesize people."
    : input.assetKind === "product"
      ? "Use the approved product source as the exact visual subject. You may add only generic, non-identifiable children and supervising adults enjoying it safely; do not use recognizably real people, customer likenesses, or close-up faces."
      : null;
  return [
    input.prompt.trim(),
    "VISUAL QA REQUIREMENTS:",
    referenceRule,
    ...VISUAL_REALISM_REQUIREMENTS.slice(1),
    peopleRule,
    themeRule,
    "Render target: 4:5 portrait social feed composition with safe crop margins.",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 4_500);
}

export type VisualRealismGateResult = Readonly<{
  allowed: boolean;
  findings: readonly string[];
}>;

export function evaluateVisualRealismGate(input: {
  prompt: string;
  sourceImageUrl: string | null;
  themeLabel?: string | null;
}): VisualRealismGateResult {
  const findings: string[] = [];
  const prompt = input.prompt.toLowerCase();
  if (!prompt.includes("realistic human scale")) {
    findings.push("Missing explicit human-to-scene scale control.");
  }
  if (!prompt.includes("natural anatomy")) {
    findings.push("Missing anatomy and limb-quality control.");
  }
  if (!prompt.includes("ground contact")) {
    findings.push("Missing ground-contact, shadow, and occlusion control.");
  }
  if (input.sourceImageUrl && !prompt.includes("preserve the exact source")) {
    findings.push("Reference asset is present but exact geometry preservation is missing.");
  }
  if (!input.sourceImageUrl && !prompt.includes("licensed graphic motifs only")) {
    findings.push("No source reference: generation must be restricted to graphic motifs.");
  }
  if (input.themeLabel && !prompt.includes("party / invitation agent")) {
    findings.push("Theme-library provenance is missing from the visual direction.");
  }
  if (!prompt.includes("4:5 portrait")) {
    findings.push("Feed aspect-ratio requirement is missing.");
  }
  return { allowed: findings.length === 0, findings };
}
