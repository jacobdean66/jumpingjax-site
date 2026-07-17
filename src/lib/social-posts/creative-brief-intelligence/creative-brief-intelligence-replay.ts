import { DEFAULT_FACILITY_PRICING } from "@/lib/facility-parties/pricing";
import { RENTALS } from "@/data/rentals";
import { location } from "@/data/site";
import type { SocialCampaign } from "../social-campaigns";
import type { SocialPost } from "../social-post-data";
import { replayCampaignPlanner } from "../campaign-planner/campaign-planner-replay";
import type { CampaignPlannerCampaign } from "../campaign-planner/campaign-planner-types";
import { buildCreativeBriefIntelligence } from "./creative-brief-intelligence-service";
import type {
  CreativeBriefAuthoritativeFacts,
  CreativeBriefIntelligenceSnapshot,
} from "./creative-brief-intelligence-types";

function plannerCampaign(campaign: SocialCampaign): CampaignPlannerCampaign {
  return {
    id: campaign.id,
    label: campaign.label,
    description: campaign.description,
    businessFocus: campaign.businessFocus,
    defaultMediaType: campaign.defaultMediaType,
    goalTemplates: campaign.goalTemplates,
    captionAngles: campaign.captionAngles,
    promptAngles: campaign.promptAngles,
  };
}

/**
 * Projects only configured catalog and site facts.
 * Does not invent discounts, live availability, or unverified testimonials.
 */
export function projectAuthoritativeCreativeBriefFacts(): CreativeBriefAuthoritativeFacts {
  const rentalStartingPrices = RENTALS
    .filter((rental) => Number.isFinite(rental.startingPrice) && rental.startingPrice > 0)
    .map((rental) => ({
      source: "rental-catalog" as const,
      id: rental.slug,
      label: rental.title,
      amountUsd: rental.startingPrice,
      priceKind: "starting-price" as const,
    }))
    .sort((left, right) =>
      left.id.localeCompare(right.id) || left.label.localeCompare(right.label),
    );

  const facilityPackagePrices = [
    {
      source: "facility-package" as const,
      id: "public-room-10",
      label: "Public room package (10 guests)",
      amountUsd: DEFAULT_FACILITY_PRICING.publicRoom10,
      priceKind: "package-price" as const,
    },
    {
      source: "facility-package" as const,
      id: "private-weekend-90",
      label: "Private party weekend 90 minutes",
      amountUsd: DEFAULT_FACILITY_PRICING.privateWeekend90,
      priceKind: "package-price" as const,
    },
    {
      source: "facility-package" as const,
      id: "private-weekend-120",
      label: "Private party weekend 120 minutes",
      amountUsd: DEFAULT_FACILITY_PRICING.privateWeekend120,
      priceKind: "package-price" as const,
    },
  ].sort((left, right) => left.id.localeCompare(right.id));

  return {
    serviceAreas: location.serviceAreas.slice().sort((left, right) => left.localeCompare(right)),
    city: location.city,
    state: location.state,
    rentalStartingPrices,
    facilityPackagePrices,
  };
}

export function replayCreativeBriefIntelligence(input: {
  posts: readonly SocialPost[];
  campaigns: readonly SocialCampaign[];
  asOf: string;
  authoritativeFacts?: CreativeBriefAuthoritativeFacts;
}): CreativeBriefIntelligenceSnapshot {
  const campaignPlanner = replayCampaignPlanner({
    posts: input.posts,
    campaigns: input.campaigns,
    generatedAt: input.asOf,
  });

  return buildCreativeBriefIntelligence({
    campaignPlanner,
    campaigns: input.campaigns.map(plannerCampaign),
    asOf: input.asOf,
    authoritativeFacts:
      input.authoritativeFacts ?? projectAuthoritativeCreativeBriefFacts(),
  });
}
