import type { SocialCampaign } from "../social-campaigns";
import type { SocialPost } from "../social-post-data";
import { replayContentDraftSpecification } from "../content-draft-specification/content-draft-specification-replay";
import type { CreativeBriefAuthoritativeFacts } from "../creative-brief-intelligence/creative-brief-intelligence-types";
import { listDraftComplianceFixtureCandidates } from "./draft-compliance-validator-fixtures";
import { buildDraftComplianceValidator } from "./draft-compliance-validator-service";
import type {
  DraftCandidate,
  DraftComplianceValidatorSnapshot,
} from "./draft-compliance-validator-types";

/**
 * Replays Wave 10 Content Draft Specifications, then evaluates explicit draft candidates.
 * Does not generate drafts, rematch prices, or rescore campaigns.
 */
export function replayDraftComplianceValidator(input: {
  posts: readonly SocialPost[];
  campaigns: readonly SocialCampaign[];
  asOf: string;
  candidates?: readonly DraftCandidate[];
  authoritativeFacts?: CreativeBriefAuthoritativeFacts;
}): DraftComplianceValidatorSnapshot {
  const specifications = replayContentDraftSpecification({
    posts: input.posts,
    campaigns: input.campaigns,
    asOf: input.asOf,
    authoritativeFacts: input.authoritativeFacts,
  });

  return buildDraftComplianceValidator({
    specifications: specifications.specifications,
    candidates: input.candidates ?? listDraftComplianceFixtureCandidates(),
    asOf: input.asOf,
  });
}
