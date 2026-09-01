import { buildContentDraftSpecificationIntelligence } from "../content-draft-specification/content-draft-specification-service";
import { replayCreativeBriefIntelligence } from "../creative-brief-intelligence/creative-brief-intelligence-replay";
import { SOCIAL_CAMPAIGNS } from "../social-campaigns";
import { buildSocialWorkingContext } from "../social-working-context";
import { listSocialPosts, type SocialPost } from "../social-post-data";
import type { ApprovedAssetContext } from "./approved-asset-context";
import {
  createSocialDraftWorkflowContext,
  type SocialDraftWorkflowContext,
} from "./staged-workflow-context";
import type { SocialThemeLibraryContext } from "../social-theme-library";

type BuildSocialDraftWorkflowContextInput = Readonly<{
  campaignId: string | null;
  themeContext: SocialThemeLibraryContext | null;
  approvedAsset: ApprovedAssetContext | null;
  asOf?: string;
}>;

type SocialDraftWorkflowContextDependencies = {
  listPosts: () => Promise<SocialPost[]>;
};

let socialDraftWorkflowContextDependencies: SocialDraftWorkflowContextDependencies =
  {
    listPosts: listSocialPosts,
  };

export function configureSocialDraftWorkflowContextTestDependencies(
  dependencies: Partial<SocialDraftWorkflowContextDependencies> | null,
): void {
  socialDraftWorkflowContextDependencies = {
    listPosts: dependencies?.listPosts ?? listSocialPosts,
  };
}

export async function buildSocialDraftWorkflowContext(
  input: BuildSocialDraftWorkflowContextInput,
): Promise<SocialDraftWorkflowContext> {
  const asOf = input.asOf ?? new Date().toISOString();
  const posts = await socialDraftWorkflowContextDependencies.listPosts();
  const workingContext = await buildSocialWorkingContext({
    campaignId: input.campaignId,
  });
  const creativeBriefSnapshot = replayCreativeBriefIntelligence({
    posts,
    campaigns: SOCIAL_CAMPAIGNS,
    asOf,
  });
  const specificationSnapshot = buildContentDraftSpecificationIntelligence({
    creativeBriefs: creativeBriefSnapshot,
    asOf,
  });

  const creativeBrief =
    input.campaignId == null
      ? null
      : creativeBriefSnapshot.briefs.find(
          (brief) => brief.campaignId === input.campaignId,
        ) ?? null;
  const specification =
    input.campaignId == null
      ? null
      : specificationSnapshot.specifications.find(
          (spec) => spec.campaignId === input.campaignId,
        ) ?? null;

  return createSocialDraftWorkflowContext({
    workingContext,
    creativeBrief,
    specification,
    themeContext: input.themeContext,
    approvedAsset: input.approvedAsset,
  });
}
