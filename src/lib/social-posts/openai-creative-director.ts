import OpenAI from "openai";
import type { SocialAgentInput } from "./social-agent";
import { getSocialCampaign, SOCIAL_CAMPAIGNS } from "./social-campaigns";
import { SOCIAL_SOURCE_IMAGES } from "./social-source-images";

const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";

const VALID_MEDIA_TYPES = ["image", "video"] as const;
const VALID_PLATFORMS = ["facebook", "instagram"] as const;
const VALID_BUSINESS_FOCUS = ["rentals", "facility-parties", "both"] as const;

export type OpenAICreativeDirectorPlan = {
  title: string;
  caption: string;
  generationPrompt: string;
  mediaType: "image" | "video";
  platforms: ("facebook" | "instagram")[];
  businessFocus: "rentals" | "facility-parties" | "both";
  goal: string;
  campaignId: string | null;
  sourceImageKeywords: string[];
};

function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function buildMessages(input: SocialAgentInput): {
  system: string;
  user: string;
} {
  const campaign = getSocialCampaign(input.campaignId);
  const campaignCatalog = SOCIAL_CAMPAIGNS.map((entry) => ({
    id: entry.id,
    label: entry.label,
    description: entry.description,
    businessFocus: entry.businessFocus,
    goalTemplates: entry.goalTemplates,
  }));
  const sourceImageCatalog = SOCIAL_SOURCE_IMAGES.map((image) => ({
    label: image.label,
    category: image.category,
    focus: image.focus,
  }));

  const system = `You are the Creative Director for Jumping Jax, a family-friendly inflatable rental and party business in Greenwood, SC.
Return ONLY valid JSON matching the requested schema. No markdown fences or extra keys.
Voice: upbeat, clean, local, family-friendly, and safe.
generationPrompt must describe a short promotional clip with no on-screen text.
mediaType should be "video" unless the request clearly needs a still image.
platforms must be an array of "facebook" and/or "instagram".
campaignId must be one of the provided campaign ids, or null when no campaign fits.
sourceImageKeywords must be 3-8 lowercase keywords that help match rental/product source imagery.`;

  const user = JSON.stringify({
    request: {
      goal: input.goal ?? null,
      campaignId: input.campaignId ?? null,
      platform: input.platform ?? "both",
      mediaType: input.mediaType ?? null,
      businessFocus: input.businessFocus ?? "both",
    },
    selectedCampaign: campaign
      ? {
          id: campaign.id,
          label: campaign.label,
          description: campaign.description,
        }
      : null,
    availableCampaigns: campaignCatalog,
    availableSourceImageMetadata: sourceImageCatalog,
    outputSchema: {
      title: "string",
      caption: "string",
      generationPrompt: "string",
      mediaType: "image | video",
      platforms: 'array of "facebook" and/or "instagram"',
      businessFocus: "rentals | facility-parties | both",
      goal: "string",
      campaignId: "string | null",
      sourceImageKeywords: "array of strings",
    },
  });

  return { system, user };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateOpenAICreativeDirectorPlan(
  raw: unknown,
): OpenAICreativeDirectorPlan | null {
  if (!raw || typeof raw !== "object") return null;

  const plan = raw as Record<string, unknown>;

  if (!isNonEmptyString(plan.title)) return null;
  if (!isNonEmptyString(plan.caption)) return null;
  if (!isNonEmptyString(plan.generationPrompt)) return null;
  if (!isNonEmptyString(plan.goal)) return null;

  if (
    !VALID_MEDIA_TYPES.includes(
      plan.mediaType as (typeof VALID_MEDIA_TYPES)[number],
    )
  ) {
    return null;
  }

  if (
    !VALID_BUSINESS_FOCUS.includes(
      plan.businessFocus as (typeof VALID_BUSINESS_FOCUS)[number],
    )
  ) {
    return null;
  }

  if (!Array.isArray(plan.platforms) || plan.platforms.length === 0) {
    return null;
  }

  const platforms = plan.platforms.filter(
    (platform): platform is "facebook" | "instagram" =>
      typeof platform === "string" &&
      VALID_PLATFORMS.includes(platform as (typeof VALID_PLATFORMS)[number]),
  );
  if (platforms.length === 0) return null;

  let campaignId: string | null = null;
  if (plan.campaignId !== null && plan.campaignId !== undefined) {
    if (!isNonEmptyString(plan.campaignId)) return null;
    if (!SOCIAL_CAMPAIGNS.some((campaign) => campaign.id === plan.campaignId)) {
      return null;
    }
    campaignId = plan.campaignId.trim();
  }

  if (!Array.isArray(plan.sourceImageKeywords)) return null;

  const sourceImageKeywords = plan.sourceImageKeywords
    .filter(
      (keyword): keyword is string =>
        typeof keyword === "string" && keyword.trim().length > 0,
    )
    .map((keyword) => keyword.trim().toLowerCase());
  if (sourceImageKeywords.length === 0) return null;

  return {
    title: plan.title.trim(),
    caption: plan.caption.trim(),
    generationPrompt: plan.generationPrompt.trim(),
    mediaType: plan.mediaType as "image" | "video",
    platforms,
    businessFocus: plan.businessFocus as "rentals" | "facility-parties" | "both",
    goal: plan.goal.trim(),
    campaignId,
    sourceImageKeywords,
  };
}

export async function planWithOpenAICreativeDirector(
  input: SocialAgentInput,
): Promise<OpenAICreativeDirectorPlan | null> {
  const client = getOpenAIClient();
  if (!client) return null;

  const { system, user } = buildMessages(input);

  try {
    const completion = await client.chat.completions.create({
      model: getOpenAIModel(),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return null;
    }

    return validateOpenAICreativeDirectorPlan(parsed);
  } catch {
    return null;
  }
}
