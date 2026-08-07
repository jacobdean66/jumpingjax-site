import {
  SOCIAL_SOURCE_IMAGES,
  type SocialSourceImage,
} from "@/lib/social-posts/social-source-images";
import {
  runSocialStrategyAgent,
  type SocialStrategyAgentInput,
  type SocialStrategyPlan,
} from "./agents/social-strategy-agent";
import type { AgentDiagnostics } from "./agents/agent-types";
import { getSocialCampaign } from "./social-campaigns";

export type SocialAgentInput = {
  goal?: string;
  campaignId?: string;
  platform?: "facebook" | "instagram" | "both";
  mediaType?: "image" | "video";
  businessFocus?: "rentals" | "facility-parties" | "both";
  audience?: string;
  tone?: string;
  callToAction?: string;
  seasonalContext?: string | null;
  assetContext?: string | null;
};

export type SocialAgentPlan = {
  title: string;
  caption: string;
  mediaType: "image" | "video";
  platforms: ("facebook" | "instagram")[];
  generationPrompt: string;
  businessFocus: "rentals" | "facility-parties" | "both";
  sourceImageUrl: string | null;
  campaignId: string | null;
};

export type SocialAgentPlanResult = {
  plan: SocialAgentPlan;
  strategy: SocialStrategyPlan;
  diagnostics: AgentDiagnostics;
};

function normalizePlatforms(
  platform: SocialAgentInput["platform"],
): SocialAgentPlan["platforms"] {
  if (platform === "facebook") return ["facebook"];
  if (platform === "instagram") return ["instagram"];
  return ["facebook", "instagram"];
}

function normalizeBusinessFocus(
  businessFocus: SocialAgentInput["businessFocus"],
): SocialAgentPlan["businessFocus"] {
  if (businessFocus === "rentals") return "rentals";
  if (businessFocus === "facility-parties") return "facility-parties";
  return "both";
}

function optionalGoal(goal: string | undefined): string {
  const cleaned = goal?.trim();
  return cleaned ? ` Focus the message on: ${cleaned}.` : "";
}

function findSourceImage(
  predicate: (image: SocialSourceImage) => boolean,
): string | null {
  return SOCIAL_SOURCE_IMAGES.find(predicate)?.url ?? null;
}

function findSourceImageByLabel(pattern: RegExp): string | null {
  return findSourceImage((image) => pattern.test(image.label));
}

function findSourceImageByCategory(category: string): string | null {
  return findSourceImage((image) => image.category === category);
}

function keywordMatch(value: string, words: string[]): boolean {
  return words.some((word) => value.includes(word));
}

export function chooseSourceImageUrl(
  goal: string | undefined,
  businessFocus: SocialAgentPlan["businessFocus"],
  preferredImageKeywords: string[] = [],
): string | null {
  const text = `${goal ?? ""} ${businessFocus} ${preferredImageKeywords.join(" ")}`.toLowerCase();

  if (businessFocus === "facility-parties") {
    return (
      findSourceImage((image) => image.focus === "facility-parties") ??
      findSourceImage((image) => /birthday|party|facility|indoor/i.test(image.label)) ??
      findSourceImage((image) => image.focus === "both") ??
      SOCIAL_SOURCE_IMAGES[0]?.url ??
      null
    );
  }

  if (keywordMatch(text, ["toddler", "little kids", "preschool"])) {
    return (
      findSourceImageByLabel(/toddler|toddle|candy land/i) ??
      findSourceImageByCategory("Combos") ??
      SOCIAL_SOURCE_IMAGES[0]?.url ??
      null
    );
  }

  if (keywordMatch(text, ["water", "waterslide", "water slide", "summer", "hot", "splash", "slide"])) {
    return (
      findSourceImageByCategory("Water Slides") ??
      SOCIAL_SOURCE_IMAGES[0]?.url ??
      null
    );
  }

  if (keywordMatch(text, ["church", "daycare", "school", "event"])) {
    return (
      findSourceImageByCategory("Combos") ??
      findSourceImageByCategory("Bounce Houses") ??
      SOCIAL_SOURCE_IMAGES[0]?.url ??
      null
    );
  }

  if (keywordMatch(text, ["combo"])) {
    return (
      findSourceImageByCategory("Combos") ??
      findSourceImageByCategory("Bounce Houses") ??
      SOCIAL_SOURCE_IMAGES[0]?.url ??
      null
    );
  }

  if (keywordMatch(text, ["bounce", "birthday", "party", "castle", "jumper"])) {
    return (
      findSourceImageByCategory("Bounce Houses") ??
      findSourceImageByCategory("Combos") ??
      SOCIAL_SOURCE_IMAGES[0]?.url ??
      null
    );
  }

  return (
    findSourceImageByCategory("Homepage") ??
    findSourceImage((image) => image.focus === businessFocus || image.focus === "both") ??
    SOCIAL_SOURCE_IMAGES[0]?.url ??
    null
  );
}

function createRuleBasedSocialAgentPlan(input: SocialAgentInput): SocialAgentPlan {
  const campaign = getSocialCampaign(input.campaignId);
  const campaignGoal = campaign?.goalTemplates[0];
  const mediaType = input.mediaType ?? campaign?.defaultMediaType ?? "video";
  const platforms = normalizePlatforms(input.platform);
  const businessFocus = campaign
    ? campaign.businessFocus
    : normalizeBusinessFocus(input.businessFocus);
  const effectiveGoal = input.goal?.trim() || campaignGoal;
  const goalText = optionalGoal(effectiveGoal);
  const sourceImageUrl = chooseSourceImageUrl(
    effectiveGoal,
    businessFocus,
    campaign?.preferredImageKeywords,
  );

  if (campaign) {
    const captionAngle = campaign.captionAngles[0] ?? "";
    const promptAngle = campaign.promptAngles[0] ?? "";
    return {
      title: campaign.label,
      caption: `${captionAngle} ${campaign.description}`.trim(),
      mediaType,
      platforms,
      generationPrompt: `Create a short family-friendly promotional ${mediaType} for Jumping Jax. Campaign: ${campaign.label}. Visual direction: ${promptAngle}. Keep it upbeat, clean, local, and safe. No text on screen.${goalText}`,
      businessFocus,
      sourceImageUrl,
      campaignId: campaign.id,
    };
  }

  if (businessFocus === "rentals") {
    return {
      title: "Inflatable Rentals for Greenwood SC Parties",
      caption:
        "Bring the fun to your next birthday party with Jumping Jax inflatable rentals. We keep it family-friendly, clean, exciting, and local for families across the Greenwood SC area.",
      mediaType,
      platforms,
      generationPrompt: `Create a short family-friendly promotional ${mediaType} for Jumping Jax showing colorful inflatable rentals being set up in a backyard, happy families, bright daytime lighting, upbeat Facebook ad style, no text on screen.${goalText}`,
      businessFocus,
      sourceImageUrl,
      campaignId: null,
    };
  }

  if (businessFocus === "facility-parties") {
    return {
      title: "Birthday Parties at Jumping Jax",
      caption:
        "Plan a birthday party that feels easy, fun, and exciting. Jumping Jax gives families in the Greenwood SC area a clean, family-friendly place to celebrate.",
      mediaType,
      platforms,
      generationPrompt: `Create a short family-friendly promotional ${mediaType} for Jumping Jax showing an exciting indoor birthday party setup, smiling kids and families, clean party rooms, bright cheerful lighting, local business tone, no text on screen.${goalText}`,
      businessFocus,
      sourceImageUrl,
      campaignId: null,
    };
  }

  return {
    title: "Family-Friendly Fun with Jumping Jax",
    caption:
      "From birthday parties to inflatable rentals, Jumping Jax brings clean, exciting, family-friendly fun to the Greenwood SC area.",
    mediaType,
    platforms,
    generationPrompt: `Create a short family-friendly promotional ${mediaType} for Jumping Jax showing colorful inflatable rentals, birthday parties, happy families, clean setups, bright daytime lighting, fun local business energy, no text on screen.${goalText}`,
    businessFocus,
    sourceImageUrl,
    campaignId: null,
  };
}

function planFromStrategy(strategy: SocialStrategyPlan): SocialAgentPlan {
  return {
    title: strategy.title,
    caption: strategy.caption,
    mediaType: strategy.mediaType,
    platforms: strategy.platforms,
    generationPrompt: strategy.generationPrompt,
    businessFocus: strategy.businessFocus,
    sourceImageUrl: chooseSourceImageUrl(
      strategy.goal,
      strategy.businessFocus,
      strategy.sourceImageKeywords,
    ),
    campaignId: strategy.campaignId,
  };
}

export async function createSocialAgentPlanWithMeta(
  input: SocialStrategyAgentInput,
  options?: { client?: import("./agents/llm-json-client").LlmJsonClient },
): Promise<SocialAgentPlanResult> {
  const result = await runSocialStrategyAgent(input, { client: options?.client });
  if (!result.ok) {
    const { buildDeterministicSocialStrategyPlan } = await import(
      "./agents/social-strategy-agent"
    );
    const strategy = buildDeterministicSocialStrategyPlan(input);
    return {
      plan: createRuleBasedSocialAgentPlan(input),
      strategy,
      diagnostics: {
        ...result.diagnostics,
        source: "deterministic-fallback",
        fallbackReason: result.error,
      },
    };
  }

  return {
    plan: planFromStrategy(result.output),
    strategy: result.output,
    diagnostics: result.diagnostics,
  };
}

export async function createSocialAgentPlan(
  input: SocialAgentInput,
): Promise<SocialAgentPlan> {
  const { plan } = await createSocialAgentPlanWithMeta(input);
  return plan;
}

export { createRuleBasedSocialAgentPlan };
