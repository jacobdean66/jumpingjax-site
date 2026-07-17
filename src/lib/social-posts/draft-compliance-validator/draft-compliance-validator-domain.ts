/**
 * Draft Compliance Validator — deterministic matching and fail-closed policy.
 *
 * 1. Allowed factual claims are a closed set from the Wave 10 ContentDraftSpecification.
 *    The set is never expanded. Prices are never inferred from campaign names or categories.
 * 2. A draft fragment is "supported" only when:
 *    - an extracted monetary amount exactly matches an allowed price amount (cent-normalized), OR
 *    - a normalized exact substring of an allowed claim text appears in the fragment
 *      (casefold + whitespace collapse).
 * 3. Prohibited phrases come from specification.prohibitedClaims, CTA constraint lists,
 *    and deterministic safety catalogs (availability, scarcity, urgency, testimonials,
 *    package invention). Catalog matches are blocking unless an exact allowed claim covers
 *    the same assertive content.
 * 4. Business-assertive sentences that cannot be deterministically tied to an allowed claim
 *    are blocking `unsupported-claim` or `unverified-claim`. They never become `compliant`.
 * 5. Pure rhetoric is a narrow allowlist: invitation / tone language with no dollars,
 *    ratings, availability, scarcity, package inclusions, quotations, or numeric business
 *    assertions. Rhetoric must not become a loophole for factual claims.
 * 6. Empty allowed-price sets reject every candidate price. Prices never transfer across
 *    specifications. Approximate, range, discount, or sale interpretations are forbidden
 *    unless explicitly present as an allowed claim string.
 * 7. `compliant` requires zero blocking violations and every business-assertive fragment
 *    supported or classified as pure rhetoric. When the specification lacks authoritative
 *    facts needed for safe validation, prefer `insufficient-spec` or `unknown` over
 *    `compliant`. Underlying Wave 10 readiness is never upgraded.
 * 8. No fuzzy matching, stemming, embeddings, model calls, or external moderation.
 */

import type { ContentDraftSpecification } from "../content-draft-specification/content-draft-specification-types";
import type {
  DraftCandidate,
  DraftCandidateSectionId,
  DraftComplianceEvaluation,
  DraftComplianceFinding,
  DraftComplianceResultState,
  DraftComplianceViolationCode,
} from "./draft-compliance-validator-types";

const PRICE_PATTERN = /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;

const AVAILABILITY_PATTERNS: readonly RegExp[] = [
  /\bavailable this weekend\b/i,
  /\bdates? (are|is) open\b/i,
  /\bopen dates?\b/i,
  /\bimmediate (availability|inventory)\b/i,
  /\bguaranteed availability\b/i,
  /\bsame[- ]week availability\b/i,
  /\bbook today before\b/i,
  /\broom(?:s)? (?:are |is )?available\b/i,
  /\bcurrently available\b/i,
];

const SCARCITY_PATTERNS: readonly RegExp[] = [
  /\bonly\s+\d+\s+left\b/i,
  /\bonly a few remain\b/i,
  /\blast chance\b/i,
  /\bbefore (they|it) (are|is) gone\b/i,
  /\bselling out\b/i,
  /\blimited spots?\b/i,
  /\bwhile (supplies|spots) last\b/i,
];

const URGENCY_PATTERNS: readonly RegExp[] = [
  /\bbook (now|today) before\b/i,
  /\bact (now|fast|quickly)\b/i,
  /\bhurry\b/i,
  /\bdon't miss\b/i,
  /\bdo not miss\b/i,
];

const TESTIMONIAL_PATTERNS: readonly RegExp[] = [
  /"[^"]{8,}"/,
  /'[^{']{8,}'/,
  /\bcustomers? say\b/i,
  /\bfamilies? (love|rave|recommend)\b/i,
  /\b\d+(\.\d+)?\s*\/\s*5\b/,
  /\b\d+(\.\d+)?\s*stars?\b/i,
  /\bstar rating\b/i,
  /\breviews? say\b/i,
  /\baccording to (our )?customers?\b/i,
  /\btestimonial\b/i,
];

const PACKAGE_PATTERNS: readonly RegExp[] = [
  /\bpackage includes?\b/i,
  /\bcomes with\b/i,
  /\bincludes? free\b/i,
  /\bfree (pizza|cake|tables?|chairs?|setup)\b/i,
  /\b\d+\s+rooms? (included|available)\b/i,
  /\bincluded add[- ]?ons?\b/i,
  /\ball setup included\b/i,
];

/** Narrow non-assertive invitation phrases (whole-sentence classification helpers). */
const PURE_RHETORIC_ALLOWLIST: readonly RegExp[] = [
  /^come celebrate with us!?$/i,
  /^family[- ]friendly fun awaits!?$/i,
  /^plan your next party with jumping jax\.?$/i,
  /^make your weekend memorable\.?$/i,
  /^ready for backyard fun\??$/i,
  /^let'?s make it a party\.?$/i,
  /^visit jumping jax for family fun\.?$/i,
  /^explore party options with jumping jax\.?$/i,
];

const BUSINESS_ASSERTION_HINTS: readonly RegExp[] = [
  /\$/,
  /\b\d+\s*%/,
  /\bavailable\b/i,
  /\binventory\b/i,
  /\bopen dates?\b/i,
  /\bguarantees?\b/i,
  /\bsame[- ]day\b/i,
  /\bexpress delivery\b/i,
  /\bsetup capacity\b/i,
  /\bcapacity\b/i,
  /\bincludes?\b/i,
  /\bpackage\b/i,
  /\breview\b/i,
  /\brating\b/i,
  /\bstars?\b/i,
  /\bcustomers? say\b/i,
  /\broom(?:s)?\b/i,
  /\bstarting at\b/i,
  /\bonly\s+\$?\d/i,
  /\bweekend package\b/i,
  /\b90 minutes?\b/i,
  /\b120 minutes?\b/i,
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function stableHashFragment(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function extractMonetaryAmountsCents(text: string): readonly number[] {
  const amounts: number[] = [];
  const pattern = new RegExp(PRICE_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) != null) {
    const raw = match[1]!.replace(/,/g, "");
    const dollars = Number.parseFloat(raw);
    if (Number.isFinite(dollars)) {
      amounts.push(Math.round(dollars * 100));
    }
  }
  return Array.from(new Set(amounts)).sort((left, right) => left - right);
}

export function allowedPriceAmountsCents(
  specification: ContentDraftSpecification,
): readonly number[] {
  const fromClaims = specification.allowedFactualClaims
    .filter((claim) => claim.sourceCategory === "price")
    .flatMap((claim) => extractMonetaryAmountsCents(claim.claimText));
  return Array.from(new Set(fromClaims)).sort((left, right) => left - right);
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function splitSentences(text: string): readonly string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function isPureRhetoric(sentence: string): boolean {
  const normalized = normalizeText(sentence);
  if (BUSINESS_ASSERTION_HINTS.some((pattern) => pattern.test(sentence))) {
    return false;
  }
  return PURE_RHETORIC_ALLOWLIST.some((pattern) => pattern.test(normalized));
}

function isBusinessAssertive(sentence: string): boolean {
  if (isPureRhetoric(sentence)) return false;
  return BUSINESS_ASSERTION_HINTS.some((pattern) => pattern.test(sentence));
}

function claimSupportsSentence(
  sentence: string,
  specification: ContentDraftSpecification,
): boolean {
  const normalizedSentence = normalizeText(sentence);
  const allowedPrices = allowedPriceAmountsCents(specification);
  const sentencePrices = extractMonetaryAmountsCents(sentence);

  if (sentencePrices.length > 0) {
    return sentencePrices.every((amount) => allowedPrices.includes(amount));
  }

  for (const claim of specification.allowedFactualClaims) {
    const normalizedClaim = normalizeText(claim.claimText);
    if (normalizedClaim.length >= 12 && normalizedSentence.includes(normalizedClaim)) {
      return true;
    }
    // Allow short service-area tokens when they appear as whole words and are in an allowed claim.
    if (claim.sourceCategory === "service-area") {
      const areaMatch = claim.claimText.match(/\b(Greenwood|Clinton|Ninety Six|South Carolina)\b/gi);
      if (
        areaMatch &&
        areaMatch.some((token) => new RegExp(`\\b${token.replace(/\s+/g, "\\s+")}\\b`, "i").test(sentence))
      ) {
        // Service-area mention alone is supported only when the sentence has no other assertive hints
        // beyond location/business name.
        const withoutArea = sentence
          .replace(/\b(Greenwood|Clinton|Ninety Six|South Carolina|Jumping Jax)\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();
        if (!isBusinessAssertive(withoutArea) && withoutArea.length < 40) {
          return true;
        }
      }
    }
  }

  return false;
}

function finding(
  code: DraftComplianceViolationCode,
  severity: DraftComplianceFinding["severity"],
  explanation: string,
  sectionId: DraftComplianceFinding["sectionId"],
  textExcerpt: string | null,
  relatedConstraint: string | null,
): DraftComplianceFinding {
  return {
    code,
    severity,
    explanation,
    sectionId,
    textExcerpt: textExcerpt == null ? null : textExcerpt.slice(0, 160),
    relatedConstraint,
  };
}

function collectSectionEntries(
  candidate: DraftCandidate,
): readonly { sectionId: DraftCandidateSectionId; text: string }[] {
  const entries: { sectionId: DraftCandidateSectionId; text: string }[] = [];
  const map: readonly [DraftCandidateSectionId, string | null][] = [
    ["hook", candidate.sections.hook],
    ["primary-message", candidate.sections.primaryMessage],
    ["supporting-proof", candidate.sections.supportingProof],
    ["cta", candidate.sections.cta],
    ["full-caption", candidate.sections.fullCaption],
  ];
  for (const [sectionId, text] of map) {
    if (typeof text === "string" && text.trim().length > 0) {
      entries.push({ sectionId, text: text.trim() });
    }
  }
  return entries;
}

function matchCatalog(
  text: string,
  patterns: readonly RegExp[],
): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0]!;
  }
  return null;
}

function prohibitedClaimHit(
  text: string,
  specification: ContentDraftSpecification,
): string | null {
  const normalized = normalizeText(text);
  for (const claim of specification.prohibitedClaims) {
    const normalizedClaim = normalizeText(claim);
    // Use distinctive phrases from prohibition strings when long enough.
    const keywords = normalizedClaim
      .replace(/^do not\s+/i, "")
      .split(/[,.;:]/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 12);
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) return claim;
    }
    if (
      /testimonial|quotation|review statement/i.test(claim) &&
      TESTIMONIAL_PATTERNS.some((pattern) => pattern.test(text))
    ) {
      return claim;
    }
    if (
      /availability|open date|inventory/i.test(claim) &&
      AVAILABILITY_PATTERNS.some((pattern) => pattern.test(text))
    ) {
      return claim;
    }
    if (
      /scarcity|limited|countdown|selling/i.test(claim) &&
      SCARCITY_PATTERNS.some((pattern) => pattern.test(text))
    ) {
      return claim;
    }
    if (
      /package contents|included add/i.test(claim) &&
      PACKAGE_PATTERNS.some((pattern) => pattern.test(text))
    ) {
      return claim;
    }
  }
  return null;
}

function validatePrices(
  text: string,
  sectionId: DraftCandidateSectionId,
  specification: ContentDraftSpecification,
): DraftComplianceFinding[] {
  const findings: DraftComplianceFinding[] = [];
  const amounts = extractMonetaryAmountsCents(text);
  const allowed = allowedPriceAmountsCents(specification);

  for (const amount of amounts) {
    if (!allowed.includes(amount)) {
      findings.push(
        finding(
          "unauthorized-price",
          "blocking",
          allowed.length === 0
            ? `Price ${formatCents(amount)} is unauthorized because the specification has an empty allowed-price set.`
            : `Price ${formatCents(amount)} is not present in this specification's allowed price facts.`,
          sectionId,
          text,
          `allowed-prices:${allowed.map(formatCents).join(",") || "none"}`,
        ),
      );
    }
  }
  return findings;
}

function validateCatalogs(
  text: string,
  sectionId: DraftCandidateSectionId,
  specification: ContentDraftSpecification,
): DraftComplianceFinding[] {
  const findings: DraftComplianceFinding[] = [];
  const prohibited = prohibitedClaimHit(text, specification);
  if (prohibited) {
    findings.push(
      finding(
        "prohibited-claim",
        "blocking",
        "Draft text matches an explicitly prohibited claim from the specification.",
        sectionId,
        text,
        prohibited,
      ),
    );
  }

  const availability = matchCatalog(text, AVAILABILITY_PATTERNS);
  if (availability) {
    findings.push(
      finding(
        "availability-claim",
        "blocking",
        "Draft asserts availability that is not authorized by live availability facts.",
        sectionId,
        availability,
        specification.ctaConstraints.prohibitedAvailabilityImplications.join(" | ") ||
          "availability-catalog",
      ),
    );
  }

  const scarcity = matchCatalog(text, SCARCITY_PATTERNS);
  if (scarcity) {
    findings.push(
      finding(
        "scarcity-claim",
        "blocking",
        "Draft asserts scarcity or remaining-quantity language without authoritative inventory facts.",
        sectionId,
        scarcity,
        specification.ctaConstraints.prohibitedScarcityImplications.join(" | ") ||
          "scarcity-catalog",
      ),
    );
  }

  const urgency = matchCatalog(text, URGENCY_PATTERNS);
  if (urgency) {
    findings.push(
      finding(
        "urgency-claim",
        "blocking",
        "Draft uses unsupported urgency language.",
        sectionId,
        urgency,
        "urgency-catalog",
      ),
    );
  }

  const testimonial = matchCatalog(text, TESTIMONIAL_PATTERNS);
  if (testimonial) {
    // Objective references mentioning the word "testimonial" are not authoritative quote/rating facts.
    const hasAuthoritativeTestimonialFact = specification.allowedFactualClaims.some(
      (claim) =>
        claim.sourceCategory !== "objective" &&
        (/quotation|quoted|star rating|\d+(\.\d+)?\s*\/\s*5|"[^"]{8,}"/i.test(claim.claimText) ||
          (/testimonial/i.test(claim.claimText) && !/campaign objective reference/i.test(claim.claimText))),
    );
    if (!hasAuthoritativeTestimonialFact) {
      findings.push(
        finding(
          "testimonial-claim",
          "blocking",
          "Draft includes testimonial, quotation, or rating language without an authoritative testimonial fact.",
          sectionId,
          testimonial,
          "testimonial-review",
        ),
      );
    }
  }

  const packageHit = matchCatalog(text, PACKAGE_PATTERNS);
  if (packageHit) {
    const hasPackageFact = specification.allowedFactualClaims.some((claim) =>
      /package includes|comes with|included/i.test(claim.claimText),
    );
    if (!hasPackageFact) {
      findings.push(
        finding(
          "package-content-invention",
          "blocking",
          "Draft invents package contents or inclusions not present in allowed claims.",
          sectionId,
          packageHit,
          "package-content-policy",
        ),
      );
    }
  }

  return findings;
}

function validateUnsupportedClaims(
  text: string,
  sectionId: DraftCandidateSectionId,
  specification: ContentDraftSpecification,
): DraftComplianceFinding[] {
  const findings: DraftComplianceFinding[] = [];
  for (const sentence of splitSentences(text)) {
    if (!isBusinessAssertive(sentence)) continue;
    if (claimSupportsSentence(sentence, specification)) continue;

    const code: DraftComplianceViolationCode =
      specification.allowedFactualClaims.length === 0
        ? "unverified-claim"
        : "unsupported-claim";

    findings.push(
      finding(
        code,
        "blocking",
        "Business-assertive statement cannot be deterministically tied to an allowed specification claim.",
        sectionId,
        sentence,
        "closed-set-allowed-claims",
      ),
    );
  }
  return findings;
}

function validateCta(
  candidate: DraftCandidate,
  specification: ContentDraftSpecification,
): DraftComplianceFinding[] {
  const cta = candidate.sections.cta?.trim() ?? "";
  if (!cta) return [];

  const findings: DraftComplianceFinding[] = [];
  const ctaLower = normalizeText(cta);

  for (const rule of specification.ctaConstraints.prohibitedAvailabilityImplications) {
    if (
      (/open dates/i.test(rule) && /\bopen dates?\b/i.test(cta)) ||
      (/immediate inventory/i.test(rule) && /\bimmediately?\b|\binventory\b/i.test(cta)) ||
      (/guaranteed availability/i.test(rule) && /\bguaranteed\b/i.test(cta)) ||
      (/remaining quantities/i.test(rule) && /\bonly\s+\d+\b|\bleft\b/i.test(cta)) ||
      (/same-week/i.test(rule) && /\bsame[- ]week\b/i.test(cta)) ||
      (/room availability/i.test(rule) && /\broom(?:s)?\b/i.test(cta))
    ) {
      findings.push(
        finding(
          "cta-constraint-violation",
          "blocking",
          "CTA text contradicts a Wave 10 CTA availability restriction.",
          "cta",
          cta,
          rule,
        ),
      );
    }
  }

  for (const rule of specification.ctaConstraints.prohibitedScarcityImplications) {
    if (SCARCITY_PATTERNS.some((pattern) => pattern.test(cta)) || /\bselling out\b/i.test(ctaLower)) {
      findings.push(
        finding(
          "cta-constraint-violation",
          "blocking",
          "CTA text contradicts a Wave 10 CTA scarcity restriction.",
          "cta",
          cta,
          rule,
        ),
      );
      break;
    }
  }

  if (
    specification.reviewGates.some((gate) => gate.blocking) &&
    (AVAILABILITY_PATTERNS.some((pattern) => pattern.test(cta)) ||
      SCARCITY_PATTERNS.some((pattern) => pattern.test(cta)) ||
      URGENCY_PATTERNS.some((pattern) => pattern.test(cta)))
  ) {
    findings.push(
      finding(
        "cta-constraint-violation",
        "blocking",
        "CTA asserts constrained claims while a blocking review gate remains open.",
        "cta",
        cta,
        specification.reviewGates
          .filter((gate) => gate.blocking)
          .map((gate) => gate.gateId)
          .join(","),
      ),
    );
  }

  return findings;
}

function validatePlacementAndSections(
  candidate: DraftCandidate,
  specification: ContentDraftSpecification,
): DraftComplianceFinding[] {
  const findings: DraftComplianceFinding[] = [];

  for (const section of specification.requiredContentSections) {
    if (section.optional) continue;
    const text =
      section.sectionId === "hook"
        ? candidate.sections.hook
        : section.sectionId === "primary-message"
          ? candidate.sections.primaryMessage
          : section.sectionId === "supporting-proof"
            ? candidate.sections.supportingProof
            : section.sectionId === "cta"
              ? candidate.sections.cta
              : null;
    const full = candidate.sections.fullCaption;
    if ((!text || !text.trim()) && (!full || !full.trim())) {
      findings.push(
        finding(
          "required-section-missing",
          "advisory",
          `Required section "${section.sectionId}" is missing from the candidate.`,
          section.sectionId,
          null,
          section.purpose,
        ),
      );
    }
  }

  const knownPlatforms = specification.platformPlacementRequirements
    .map((item) => item.platform)
    .filter((platform) => platform !== "unknown");
  if (
    candidate.declaredPlatform &&
    knownPlatforms.length > 0 &&
    !knownPlatforms.includes(candidate.declaredPlatform)
  ) {
    findings.push(
      finding(
        "platform-mismatch",
        "blocking",
        `Declared platform "${candidate.declaredPlatform}" is not among specification platforms.`,
        "candidate",
        candidate.declaredPlatform,
        knownPlatforms.join(","),
      ),
    );
  } else if (candidate.declaredPlatform && knownPlatforms.length === 0) {
    findings.push(
      finding(
        "platform-mismatch",
        "advisory",
        "Declared platform cannot be machine-checked because specification platforms are unknown.",
        "candidate",
        candidate.declaredPlatform,
        "placementConfidence:unknown",
      ),
    );
  }

  const knownPlacements = specification.platformPlacementRequirements
    .map((item) => item.placement)
    .filter((placement) => placement !== "unknown");
  if (
    candidate.declaredPlacement &&
    knownPlacements.length > 0 &&
    !knownPlacements.includes(candidate.declaredPlacement)
  ) {
    findings.push(
      finding(
        "placement-mismatch",
        "blocking",
        `Declared placement "${candidate.declaredPlacement}" is not among specification placements.`,
        "candidate",
        candidate.declaredPlacement,
        knownPlacements.join(","),
      ),
    );
  }

  for (const requirement of specification.platformPlacementRequirements) {
    const limitMatch = requirement.characterOrLengthTarget.match(/^(\d+)\s*characters?$/i);
    if (!limitMatch) {
      if (
        requirement.characterOrLengthTarget !== "unknown" &&
        requirement.characterOrLengthTarget.trim().length > 0
      ) {
        findings.push(
          finding(
            "length-limit-exceeded",
            "advisory",
            "Character/length target is present but not machine-checkable; not treated as passed.",
            "full-caption",
            requirement.characterOrLengthTarget,
            requirement.formatRuleSource,
          ),
        );
      }
      continue;
    }
    const limit = Number.parseInt(limitMatch[1]!, 10);
    const caption =
      candidate.sections.fullCaption ??
      [candidate.sections.hook, candidate.sections.primaryMessage, candidate.sections.cta]
        .filter(Boolean)
        .join(" ");
    if (caption.length > limit) {
      findings.push(
        finding(
          "length-limit-exceeded",
          "blocking",
          `Combined draft length ${caption.length} exceeds machine-checkable limit ${limit}.`,
          "full-caption",
          caption.slice(0, 80),
          requirement.characterOrLengthTarget,
        ),
      );
    }
  }

  const mediaRequired = specification.platformPlacementRequirements.some(
    (item) => item.mediaRequirement === "video-required",
  );
  if (mediaRequired && !candidate.mediaDeclarations.hasVideo) {
    findings.push(
      finding(
        "required-media-missing",
        "advisory",
        "Specification prefers/requires video but candidate declares no video.",
        "candidate",
        null,
        "mediaRequirement:video-required",
      ),
    );
  }

  if (
    specification.assetSlots.some((slot) => slot.authoritativeDimensionStatus === "unknown")
  ) {
    findings.push(
      finding(
        "insufficient-authoritative-facts",
        "advisory",
        "Unknown asset dimensions remain unresolved; completeness is not assumed.",
        "candidate",
        null,
        "asset-dimensions:unknown",
      ),
    );
  }

  return findings;
}

function validateAccessibility(
  candidate: DraftCandidate,
  specification: ContentDraftSpecification,
): DraftComplianceFinding[] {
  const findings: DraftComplianceFinding[] = [];
  const media = candidate.mediaDeclarations;
  const requirements = specification.accessibilityRequirements;

  const byId = (id: string) => requirements.find((item) => item.requirementId === id);

  if (media.hasImage) {
    const altReq = byId("alt-text-for-images");
    if (altReq?.status === "required" && !media.imageAltText?.trim()) {
      findings.push(
        finding(
          "accessibility-gap",
          "blocking",
          "Image is declared but required alt text metadata is missing.",
          "candidate",
          null,
          altReq.requirementId,
        ),
      );
    }
  }

  if (media.hasVideo) {
    const captionReq = byId("captions-or-transcript-for-video");
    if (captionReq?.status === "required" && !media.videoCaptionsOrTranscript?.trim()) {
      findings.push(
        finding(
          "accessibility-gap",
          "blocking",
          "Video is declared but required captions/transcript metadata is missing.",
          "candidate",
          null,
          captionReq.requirementId,
        ),
      );
    }
  }

  if (media.claimsImageOnly) {
    const imageOnlyReq = byId("claims-not-image-only");
    if (imageOnlyReq && imageOnlyReq.status !== "not-applicable") {
      findings.push(
        finding(
          "accessibility-gap",
          "blocking",
          "Candidate declares claims communicated only through an image.",
          "candidate",
          null,
          imageOnlyReq.requirementId,
        ),
      );
    }
  }

  const unknownGaps = byId("unknown-accessibility-gaps");
  if (unknownGaps?.status === "unknown") {
    findings.push(
      finding(
        "accessibility-gap",
        "advisory",
        "Specification records unresolved accessibility gaps.",
        "candidate",
        null,
        unknownGaps.requirementId,
      ),
    );
  }

  return findings;
}

function dedupeFindings(
  findings: readonly DraftComplianceFinding[],
): readonly DraftComplianceFinding[] {
  const seen = new Set<string>();
  const unique: DraftComplianceFinding[] = [];
  for (const item of findings
    .slice()
    .sort(
      (left, right) =>
        left.code.localeCompare(right.code) ||
        left.severity.localeCompare(right.severity) ||
        (left.sectionId ?? "").localeCompare(right.sectionId ?? "") ||
        left.explanation.localeCompare(right.explanation) ||
        (left.textExcerpt ?? "").localeCompare(right.textExcerpt ?? ""),
    )) {
    const key = [
      item.code,
      item.severity,
      item.sectionId ?? "",
      item.explanation,
      item.textExcerpt ?? "",
      item.relatedConstraint ?? "",
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

function resolveResultState(input: {
  candidateValid: boolean;
  specification: ContentDraftSpecification | null;
  blocking: readonly DraftComplianceFinding[];
  hasUnsupported: boolean;
}): DraftComplianceResultState {
  if (!input.candidateValid) return "not-evaluated";
  if (!input.specification) return "not-evaluated";

  if (input.blocking.length > 0) return "violations-found";

  const readiness = input.specification.generationReadiness;
  if (readiness === "blocked" || readiness === "needs-facts") {
    return "insufficient-spec";
  }
  if (readiness === "unknown") return "unknown";

  if (input.hasUnsupported) return "violations-found";

  return "compliant";
}

export function resolveSpecificationForCandidate(
  candidate: DraftCandidate,
  specifications: readonly ContentDraftSpecification[],
): ContentDraftSpecification | null {
  if (candidate.sourceSpecificationId) {
    return (
      specifications.find((spec) => spec.id === candidate.sourceSpecificationId) ?? null
    );
  }
  const byCampaign = specifications.filter((spec) => spec.campaignId === candidate.campaignId);
  if (byCampaign.length === 1) return byCampaign[0]!;
  return null;
}

export function validateDraftCandidate(input: {
  candidate: DraftCandidate;
  specification: ContentDraftSpecification | null;
  asOf: string;
}): DraftComplianceEvaluation {
  const { candidate, specification, asOf } = input;
  const evaluationId = `eval:${candidate.id}:${specification?.id ?? "missing-spec"}:${stableHashFragment(asOf)}`;

  if (!candidate.id.trim() || !candidate.campaignId.trim()) {
    return {
      id: evaluationId,
      candidateId: candidate.id || "missing-candidate-id",
      specificationId: specification?.id ?? null,
      campaignId: candidate.campaignId || "missing-campaign-id",
      asOf,
      resultState: "not-evaluated",
      underlyingReadiness: specification?.generationReadiness ?? "specification-missing",
      blockingViolations: [
        finding(
          "malformed-candidate",
          "blocking",
          "Candidate lacks stable id and/or campaignId required for evaluation.",
          "candidate",
          null,
          "candidate-identity",
        ),
      ],
      advisoryFindings: [],
      diagnostics: ["malformed-candidate:true", "readiness-upgraded:false"],
      reviewArtifactOnly: true,
      nonPublishable: true,
      grantsNoGenerationAuthority: true,
      grantsNoPublishingAuthority: true,
      readinessUpgraded: false,
    };
  }

  const sections = collectSectionEntries(candidate);
  if (sections.length === 0) {
    return {
      id: evaluationId,
      candidateId: candidate.id,
      specificationId: specification?.id ?? null,
      campaignId: candidate.campaignId,
      asOf,
      resultState: "not-evaluated",
      underlyingReadiness: specification?.generationReadiness ?? "specification-missing",
      blockingViolations: [
        finding(
          "empty-candidate",
          "blocking",
          "Candidate contains no draft text sections to evaluate.",
          "candidate",
          null,
          "empty-sections",
        ),
      ],
      advisoryFindings: [],
      diagnostics: ["empty-candidate:true", "readiness-upgraded:false"],
      reviewArtifactOnly: true,
      nonPublishable: true,
      grantsNoGenerationAuthority: true,
      grantsNoPublishingAuthority: true,
      readinessUpgraded: false,
    };
  }

  if (!specification) {
    return {
      id: evaluationId,
      candidateId: candidate.id,
      specificationId: null,
      campaignId: candidate.campaignId,
      asOf,
      resultState: "not-evaluated",
      underlyingReadiness: "specification-missing",
      blockingViolations: [
        finding(
          "specification-missing",
          "blocking",
          "No matching Wave 10 Content Draft Specification was found for this candidate.",
          "candidate",
          null,
          candidate.sourceSpecificationId ?? candidate.campaignId,
        ),
      ],
      advisoryFindings: [],
      diagnostics: ["specification-missing:true", "readiness-upgraded:false"],
      reviewArtifactOnly: true,
      nonPublishable: true,
      grantsNoGenerationAuthority: true,
      grantsNoPublishingAuthority: true,
      readinessUpgraded: false,
    };
  }

  const allFindings: DraftComplianceFinding[] = [];
  for (const section of sections) {
    allFindings.push(...validatePrices(section.text, section.sectionId, specification));
    allFindings.push(...validateCatalogs(section.text, section.sectionId, specification));
    allFindings.push(
      ...validateUnsupportedClaims(section.text, section.sectionId, specification),
    );
  }
  allFindings.push(...validateCta(candidate, specification));
  allFindings.push(...validatePlacementAndSections(candidate, specification));
  allFindings.push(...validateAccessibility(candidate, specification));

  if (
    specification.missingInputs.some((item) => item.category === "availability") ||
    specification.reviewGates.some(
      (gate) => gate.gateId === "availability-review" && gate.blocking,
    )
  ) {
    allFindings.push(
      finding(
        "insufficient-authoritative-facts",
        "advisory",
        "Live availability facts remain missing; Last-Minute style availability claims stay blocked and readiness is not upgraded.",
        "candidate",
        null,
        "availability-review",
      ),
    );
  }

  const unique = dedupeFindings(allFindings);
  const blocking = unique.filter((item) => item.severity === "blocking");
  const advisory = unique.filter((item) => item.severity === "advisory");
  const hasUnsupported = blocking.some(
    (item) => item.code === "unsupported-claim" || item.code === "unverified-claim",
  );

  const resultState = resolveResultState({
    candidateValid: true,
    specification,
    blocking,
    hasUnsupported,
  });

  const diagnostics = [
    `candidate:${candidate.id}`,
    `specification:${specification.id}`,
    `underlying-readiness:${specification.generationReadiness}`,
    `result:${resultState}`,
    `blocking:${blocking.length}`,
    `advisory:${advisory.length}`,
    `allowed-claims:${specification.allowedFactualClaims.length}`,
    `allowed-prices:${allowedPriceAmountsCents(specification).map(formatCents).join(",") || "none"}`,
    `readiness-upgraded:false`,
    `fixture-kind:${candidate.fixtureKind}`,
    `grants-generation-authority:false`,
    `grants-publishing-authority:false`,
  ].sort((left, right) => left.localeCompare(right));

  return {
    id: evaluationId,
    candidateId: candidate.id,
    specificationId: specification.id,
    campaignId: candidate.campaignId,
    asOf,
    resultState,
    underlyingReadiness: specification.generationReadiness,
    blockingViolations: blocking,
    advisoryFindings: advisory,
    diagnostics,
    reviewArtifactOnly: true,
    nonPublishable: true,
    grantsNoGenerationAuthority: true,
    grantsNoPublishingAuthority: true,
    readinessUpgraded: false,
  };
}
