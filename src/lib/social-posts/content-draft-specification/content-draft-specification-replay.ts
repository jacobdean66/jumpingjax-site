import type { SocialCampaign } from "../social-campaigns";
import type { SocialPost } from "../social-post-data";
import {
  projectAuthoritativeCreativeBriefFacts,
  replayCreativeBriefIntelligence,
} from "../creative-brief-intelligence/creative-brief-intelligence-replay";
import type { CreativeBriefAuthoritativeFacts } from "../creative-brief-intelligence/creative-brief-intelligence-types";
import { buildContentDraftSpecificationIntelligence } from "./content-draft-specification-service";
import type { ContentDraftSpecificationSnapshot } from "./content-draft-specification-types";

/**
 * Replays the intelligence chain through Creative Brief Intelligence, then builds
 * Content Draft Specifications. Does not rescore campaigns or rematch prices.
 */
export function replayContentDraftSpecification(input: {
  posts: readonly SocialPost[];
  campaigns: readonly SocialCampaign[];
  asOf: string;
  authoritativeFacts?: CreativeBriefAuthoritativeFacts;
}): ContentDraftSpecificationSnapshot {
  const creativeBriefs = replayCreativeBriefIntelligence({
    posts: input.posts,
    campaigns: input.campaigns,
    asOf: input.asOf,
    authoritativeFacts:
      input.authoritativeFacts ?? projectAuthoritativeCreativeBriefFacts(),
  });

  return buildContentDraftSpecificationIntelligence({
    creativeBriefs,
    asOf: input.asOf,
  });
}
