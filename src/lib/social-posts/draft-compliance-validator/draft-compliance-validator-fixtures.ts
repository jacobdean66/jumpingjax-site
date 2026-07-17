import type { DraftCandidate } from "./draft-compliance-validator-types";

function emptyMedia(
  overrides: Partial<DraftCandidate["mediaDeclarations"]> = {},
): DraftCandidate["mediaDeclarations"] {
  return {
    hasImage: false,
    hasVideo: false,
    imageAltText: null,
    videoCaptionsOrTranscript: null,
    claimsImageOnly: false,
    ...overrides,
  };
}

function fixture(
  overrides: {
    id: string;
    campaignId: string;
    label: string;
    sourceSpecificationId?: string | null;
    sections: DraftCandidate["sections"];
    declaredPlatform?: string | null;
    declaredPlacement?: string | null;
    mediaDeclarations: DraftCandidate["mediaDeclarations"];
  },
): DraftCandidate {
  return {
    sourceSpecificationId: overrides.sourceSpecificationId ?? null,
    fixtureKind: "deterministic-test-fixture",
    id: overrides.id,
    campaignId: overrides.campaignId,
    label: overrides.label,
    sections: overrides.sections,
    declaredPlatform: overrides.declaredPlatform ?? null,
    declaredPlacement: overrides.declaredPlacement ?? null,
    mediaDeclarations: overrides.mediaDeclarations,
  };
}

/**
 * Deterministic admin/test fixture drafts.
 * Labels make clear these are review fixtures, not generated copy.
 */
export const DRAFT_COMPLIANCE_FIXTURE_CANDIDATES: readonly DraftCandidate[] = [
  fixture({
    id: "fixture:private-parties:authorized-prices",
    campaignId: "private-parties",
    label: "[Fixture] Private Parties — authorized $220 / $255",
    sections: {
      hook: "Come celebrate with us!",
      primaryMessage: "Plan your next party with Jumping Jax.",
      supportingProof:
        "Private party weekend 90 minutes package price reference is $220.00 (facility-package).",
      cta: "Explore party options with Jumping Jax.",
      fullCaption: null,
    },
    mediaDeclarations: emptyMedia(),
  }),
  fixture({
    id: "fixture:private-parties:unauthorized-foam-price",
    campaignId: "private-parties",
    label: "[Fixture] Private Parties — unauthorized foam/rental price",
    sections: {
      hook: "Come celebrate with us!",
      primaryMessage: "Book a private party this weekend for only $200.",
      supportingProof: null,
      cta: "Visit Jumping Jax for family fun.",
      fullCaption: null,
    },
    mediaDeclarations: emptyMedia(),
  }),
  fixture({
    id: "fixture:private-parties:invented-package",
    campaignId: "private-parties",
    label: "[Fixture] Private Parties — invented package contents",
    sections: {
      hook: "Family-friendly fun awaits!",
      primaryMessage: "Our weekend package includes free pizza and cake.",
      supportingProof: null,
      cta: "Explore party options with Jumping Jax.",
      fullCaption: null,
    },
    mediaDeclarations: emptyMedia(),
  }),
  fixture({
    id: "fixture:summer-water-slides:unauthorized-price",
    campaignId: "summer-water-slides",
    label: "[Fixture] Summer Water Slides — unauthorized price",
    sections: {
      hook: "Ready for backyard fun?",
      primaryMessage: "Cool off this summer with a waterslide starting at $275.",
      supportingProof: null,
      cta: "Visit Jumping Jax for family fun.",
      fullCaption: null,
    },
    mediaDeclarations: emptyMedia({ hasVideo: true }),
  }),
  fixture({
    id: "fixture:summer-water-slides:availability-scarcity",
    campaignId: "summer-water-slides",
    label: "[Fixture] Summer Water Slides — availability and scarcity",
    sections: {
      hook: "Ready for backyard fun?",
      primaryMessage: "Waterslides are available this weekend and only two left.",
      supportingProof: null,
      cta: "Book today before they are gone.",
      fullCaption: null,
    },
    mediaDeclarations: emptyMedia({ hasVideo: true, videoCaptionsOrTranscript: null }),
  }),
  fixture({
    id: "fixture:last-minute-availability:open-dates",
    campaignId: "last-minute-availability",
    label: "[Fixture] Last-Minute — open dates / scarcity",
    sections: {
      hook: "Make your weekend memorable.",
      primaryMessage: "Dates are open and immediate availability is guaranteed.",
      supportingProof: "Only a few remain for same-week rentals.",
      cta: "Book now before they are gone.",
      fullCaption: null,
    },
    mediaDeclarations: emptyMedia(),
  }),
  fixture({
    id: "fixture:customer-testimonials:invented-quote",
    campaignId: "customer-testimonials",
    label: "[Fixture] Testimonials — invented quotation and rating",
    sections: {
      hook: "Families love Jumping Jax!",
      primaryMessage: 'Customers say "Best party ever!" with a 5 star rating.',
      supportingProof: "4.9 / 5 from happy parents.",
      cta: "Visit Jumping Jax for family fun.",
      fullCaption: null,
    },
    mediaDeclarations: emptyMedia(),
  }),
  fixture({
    id: "fixture:birthday-parties:invented-contents",
    campaignId: "birthday-parties",
    label: "[Fixture] Birthday — invented price, rooms, package",
    sections: {
      hook: "Come celebrate with us!",
      primaryMessage: "Birthday packages start at $199 and 2 rooms available.",
      supportingProof: "Package includes free tables and all setup included.",
      cta: "Book today before it is gone.",
      fullCaption: null,
    },
    mediaDeclarations: emptyMedia({ hasImage: true, imageAltText: null }),
  }),
  fixture({
    id: "fixture:summer-water-slides:unclassifiable-assertion",
    campaignId: "summer-water-slides",
    label: "[Fixture] Summer Water Slides — unclassifiable factual assertion",
    sections: {
      hook: "Ready for backyard fun?",
      primaryMessage: "Our premium express delivery lane guarantees same-day setup capacity.",
      supportingProof: null,
      cta: "Visit Jumping Jax for family fun.",
      fullCaption: null,
    },
    mediaDeclarations: emptyMedia(),
  }),
  fixture({
    id: "fixture:private-parties:rhetoric-only",
    campaignId: "private-parties",
    label: "[Fixture] Private Parties — rhetoric-only safe draft",
    sections: {
      hook: "Come celebrate with us!",
      primaryMessage: "Family-friendly fun awaits!",
      supportingProof: null,
      cta: "Explore party options with Jumping Jax.",
      fullCaption: null,
    },
    mediaDeclarations: emptyMedia(),
  }),
];

export function listDraftComplianceFixtureCandidates(): readonly DraftCandidate[] {
  return DRAFT_COMPLIANCE_FIXTURE_CANDIDATES;
}
