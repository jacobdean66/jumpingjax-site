import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  createSocialAgentPlan,
  type SocialAgentInput,
} from "@/lib/social-posts/social-agent";
import { createSocialPost } from "@/lib/social-posts/social-post-data";
import { verifyAdminAccess } from "@/lib/admin/session";

const VALID_PLATFORMS = ["facebook", "instagram", "both"] as const;
const VALID_MEDIA_TYPES = ["image", "video"] as const;
const VALID_BUSINESS_FOCUS = ["rentals", "facility-parties", "both"] as const;

type AgentDraftRequest = SocialAgentInput & {
  token?: string;
  campaign_id?: string;
  source_image_url?: string;
};

function isValidOptionalValue<T extends readonly string[]>(
  value: unknown,
  validValues: T,
): value is T[number] | undefined {
  return value === undefined || validValues.includes(value as T[number]);
}

function cleanGoal(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cleanOptionalUrl(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isValidPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateInput(body: AgentDraftRequest): SocialAgentInput {
  if (!isValidOptionalValue(body.platform, VALID_PLATFORMS)) {
    throw new Error("platform must be facebook, instagram, or both.");
  }

  if (!isValidOptionalValue(body.mediaType, VALID_MEDIA_TYPES)) {
    throw new Error("mediaType must be image or video.");
  }

  if (!isValidOptionalValue(body.businessFocus, VALID_BUSINESS_FOCUS)) {
    throw new Error("businessFocus must be rentals, facility-parties, or both.");
  }

  return {
    goal: cleanGoal(body.goal),
    campaignId: cleanGoal(body.campaignId ?? body.campaign_id),
    platform: body.platform,
    mediaType: body.mediaType,
    businessFocus: body.businessFocus,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AgentDraftRequest;
    const auth = await verifyAdminAccess(body.token);

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: "Invalid admin login" },
        { status: 401 },
      );
    }

    const input = validateInput(body);
    const manualSourceImageUrl = cleanOptionalUrl(body.source_image_url);

    if (manualSourceImageUrl && !isValidPublicHttpUrl(manualSourceImageUrl)) {
      return NextResponse.json(
        { ok: false, error: "source_image_url must be a valid http or https URL." },
        { status: 400 },
      );
    }

    const plan = await createSocialAgentPlan(input);
    const sourceImageUrl = manualSourceImageUrl ?? plan.sourceImageUrl;
    const post = await createSocialPost({
      title: plan.title,
      campaign_id: plan.campaignId,
      goal: input.goal,
      prompt: plan.generationPrompt,
      caption: plan.caption,
      media_type: plan.mediaType,
      business_focus: plan.businessFocus,
      source_image_url: sourceImageUrl,
      platforms: plan.platforms,
    });

    revalidatePath("/admin/social-posts");
    return NextResponse.json({ ok: true, post, plan });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body." },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      (error.message.startsWith("platform must") ||
        error.message.startsWith("mediaType must") ||
        error.message.startsWith("businessFocus must"))
    ) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Agent draft failed.",
      },
      { status: 500 },
    );
  }
}
