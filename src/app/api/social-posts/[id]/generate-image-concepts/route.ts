import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/admin/session";
import { socialPostAdminSchemaGuardResponse } from "@/lib/social-posts/social-post-admin-schema-guard";
import { socialPostAdminRateLimitResponse } from "@/lib/social-posts/social-post-admin-rate-limit";
import { buildSocialPostAdminRateLimitClientKey } from "@/lib/social-posts/social-post-admin-rate-limit-core";
import {
  buildImageDirectorPrompt,
  normalizeImageStudioPresetValue,
} from "@/lib/social-posts/image-director";
import {
  regenerateImageConcept,
  startImageConceptGenerations,
} from "@/lib/social-posts/image-concepts";
import { resolveImageGenerationMode } from "@/lib/social-posts/image-engine";
import {
  createSocialPostAsset,
  findLatestSocialPostConceptAsset,
  findOrCreateSocialPostSourceAsset,
  findSocialPostAssetByPrediction,
  updateSocialPostAsset,
} from "@/lib/social-posts/social-post-assets";
import { getSocialCampaign } from "@/lib/social-posts/social-campaigns";
import {
  buildSocialPostImageConcept,
  getSocialPostById,
  saveSocialPostImageConcepts,
  upsertSocialPostImageConcept,
} from "@/lib/social-posts/social-post-data";
import { socialVideoSourceImageUrl } from "@/lib/social-posts/social-video-utils";
import { sourceImageCategory } from "@/lib/social-posts/video-director";
import { durableAgentStoreErrorResponse } from "@/lib/social-posts/agents/agent-durable-store";
import {
  beginAgentIdempotentActionAsync,
  completeAgentIdempotentActionAsync,
  failAgentIdempotentActionAsync,
  normalizeIdempotencyKey,
} from "@/lib/social-posts/agents/agent-idempotency";
import {
  paidGenerationProtectionBlock,
  protectionMetadata,
} from "@/lib/social-posts/agents/agent-protection-mode";
import { buildImageConceptGenerationFingerprint } from "@/lib/social-posts/agents/preview-fingerprint";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type GenerateConceptsRequest = {
  token?: string;
  finalImagePrompt?: string;
  imageStudioPreset?: string | null;
  imageDirectionPreset?: string | null;
  sourceImageUrl?: string | null;
  providerId?: string | null;
  mode?: "edit" | "generate" | null;
  conceptId?: "A" | "B" | "C" | "D" | null;
  idempotencyKey?: string;
};

function normalizeProviderStatus(status: string): string {
  if (status === "starting" || status === "processing") return "processing";
  if (status === "succeeded") return "succeeded";
  if (status === "failed" || status === "canceled") return "failed";
  return "processing";
}

export async function POST(req: NextRequest, context: RouteContext) {
  const route = "/api/social-posts/[id]/generate-image-concepts";
  let idemStoreKey: string | null = null;
  let fingerprint = "";

  try {
    const body = (await req.json()) as GenerateConceptsRequest;
    const auth = await verifyAdminAccess(body.token);

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: "Invalid admin login" },
        { status: 401 },
      );
    }

    const schemaGuard = await socialPostAdminSchemaGuardResponse();
    if (schemaGuard) {
      return schemaGuard;
    }

    // Paid image-provider concept generation: fail closed before any
    // quota use or provider start when durable protection is unavailable.
    const protectionBlock = await paidGenerationProtectionBlock();
    if (protectionBlock) {
      return NextResponse.json(protectionBlock, { status: 503 });
    }

    const limited = await socialPostAdminRateLimitResponse(req, {
      route,
      category: "generation",
      token: body.token,
    });
    if (limited) {
      return limited;
    }

    const { id } = await context.params;
    const post = await getSocialPostById(id);

    if (!post) {
      return NextResponse.json(
        { ok: false, error: "Social post not found" },
        { status: 404 },
      );
    }

    if (post.media_type !== "video") {
      return NextResponse.json(
        { ok: false, error: "Image Studio is only available for video drafts." },
        { status: 400 },
      );
    }

    const preset = normalizeImageStudioPresetValue(
      body.imageStudioPreset ?? body.imageDirectionPreset,
    );
    const resolvedSourceImageUrl = socialVideoSourceImageUrl(
      typeof body.sourceImageUrl === "string" && body.sourceImageUrl.trim()
        ? body.sourceImageUrl.trim()
        : post.source_image_url,
    );
    const category = sourceImageCategory(resolvedSourceImageUrl);
    const campaignName =
      getSocialCampaign(post.campaign_id)?.label ??
      (post.campaign_id ? post.campaign_id : null);

    const { prompt: builtPrompt } = buildImageDirectorPrompt({
      originalSourceImageUrl: resolvedSourceImageUrl,
      campaignName,
      postPrompt: post.prompt ?? "",
      sourceImageCategory: category,
      imageStudioPreset: preset,
    });

    const generationPrompt = body.finalImagePrompt?.trim() || builtPrompt;
    const mode = resolveImageGenerationMode({
      mode: body.mode,
      sourceImageUrl: resolvedSourceImageUrl,
    });

    fingerprint = buildImageConceptGenerationFingerprint({
      postId: id,
      prompt: generationPrompt,
      preset,
      mode,
      assetId: resolvedSourceImageUrl,
      conceptId: body.conceptId ?? null,
      providerId: body.providerId ?? null,
    });
    const idempotencyKey = normalizeIdempotencyKey(
      body.idempotencyKey ?? req.headers.get("idempotency-key"),
    );
    const clientKey = buildSocialPostAdminRateLimitClientKey(req, body.token);
    const idem = await beginAgentIdempotentActionAsync({
      clientKey,
      action: "generate-image-concepts",
      idempotencyKey,
      fingerprint,
    });
    if (idem.kind === "replay") {
      return NextResponse.json(idem.body, { status: idem.status });
    }
    if (idem.kind === "in_progress") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "An identical image-concept generation request is already in progress.",
          code: "duplicate_in_progress",
          retryAfterSeconds: idem.retryAfterSeconds,
          protection: protectionMetadata(),
        },
        {
          status: 409,
          headers: { "Retry-After": String(idem.retryAfterSeconds) },
        },
      );
    }
    idemStoreKey = idem.storeKey;

    if (body.conceptId) {
      const existing = post.image_concepts.find((item) => item.id === body.conceptId);
      const concept = await regenerateImageConcept({
        basePrompt: generationPrompt,
        sourceImageUrl: resolvedSourceImageUrl,
        conceptId: body.conceptId,
        mode,
        providerId: body.providerId ?? undefined,
      });
      const sourceAsset = resolvedSourceImageUrl
        ? await findOrCreateSocialPostSourceAsset({
            socialPostId: id,
            sourceUrl: resolvedSourceImageUrl,
            createdBy: "image_director",
          })
        : null;
      const previousConceptAsset = await findLatestSocialPostConceptAsset({
        socialPostId: id,
        conceptId: body.conceptId,
      });
      const existingAsset = await findSocialPostAssetByPrediction({
        socialPostId: id,
        predictionId: concept.predictionId,
        assetType: "image",
      });

      if (existingAsset) {
        await updateSocialPostAsset({
          socialPostId: id,
          assetId: existingAsset.id,
          url: concept.generatedImageUrl ?? null,
          generationStatus: normalizeProviderStatus(concept.status),
        });
      } else {
        await createSocialPostAsset({
          socialPostId: id,
          parentAssetId: previousConceptAsset?.id ?? sourceAsset?.id,
          assetType: "image",
          assetStage: "concept",
          url: concept.generatedImageUrl ?? null,
          provider: concept.provider,
          generationEngine: concept.provider,
          model: concept.model,
          predictionId: concept.predictionId,
          generationStatus: normalizeProviderStatus(concept.status),
          generationPrompt: concept.prompt,
          conceptId: concept.id,
          createdBy: "image_director",
          metadata: { mode, source_image_url: resolvedSourceImageUrl },
        });
      }

      const persisted = buildSocialPostImageConcept({
        id: concept.id,
        status: normalizeProviderStatus(concept.status),
        predictionId: concept.predictionId,
        prompt: concept.prompt,
        provider: concept.provider,
        model: concept.model,
        imageUrl: concept.generatedImageUrl,
        favorite: existing?.favorite ?? false,
        rejected: false,
        createdAt: existing?.createdAt,
      });
      const updatedPost = await upsertSocialPostImageConcept(id, persisted);
      revalidatePath("/admin/social-posts");

      const responseBody = {
        ok: true,
        concepts: updatedPost.image_concepts,
        post: updatedPost,
        protection: protectionMetadata(),
        publication: {
          published: false,
          note: "Image concept regeneration started only. Nothing was published.",
        },
      };
      await completeAgentIdempotentActionAsync({
        storeKey: idemStoreKey,
        fingerprint,
        status: 200,
        body: responseBody,
      });
      return NextResponse.json(responseBody);
    }

    const concepts = await startImageConceptGenerations({
      basePrompt: generationPrompt,
      sourceImageUrl: resolvedSourceImageUrl,
      mode,
      providerId: body.providerId ?? undefined,
    });
    const sourceAsset = resolvedSourceImageUrl
      ? await findOrCreateSocialPostSourceAsset({
          socialPostId: id,
          sourceUrl: resolvedSourceImageUrl,
          createdBy: "image_director",
        })
      : null;

    await Promise.all(
      concepts.map(async (concept) => {
        const existingAsset = await findSocialPostAssetByPrediction({
          socialPostId: id,
          predictionId: concept.predictionId,
          assetType: "image",
        });

        if (existingAsset) {
          return updateSocialPostAsset({
            socialPostId: id,
            assetId: existingAsset.id,
            url: concept.generatedImageUrl ?? null,
            generationStatus: normalizeProviderStatus(concept.status),
          });
        }

        return createSocialPostAsset({
          socialPostId: id,
          parentAssetId: sourceAsset?.id,
          assetType: "image",
          assetStage: "concept",
          url: concept.generatedImageUrl ?? null,
          provider: concept.provider,
          generationEngine: concept.provider,
          model: concept.model,
          predictionId: concept.predictionId,
          generationStatus: normalizeProviderStatus(concept.status),
          generationPrompt: concept.prompt,
          conceptId: concept.id,
          createdBy: "image_director",
          metadata: { mode, source_image_url: resolvedSourceImageUrl },
        });
      }),
    );

    const persisted = concepts.map((concept) =>
      buildSocialPostImageConcept({
        id: concept.id,
        status: normalizeProviderStatus(concept.status),
        predictionId: concept.predictionId,
        prompt: concept.prompt,
        provider: concept.provider,
        model: concept.model,
        imageUrl: concept.generatedImageUrl,
      }),
    );
    const updatedPost = await saveSocialPostImageConcepts(id, persisted);
    revalidatePath("/admin/social-posts");

    const responseBody = {
      ok: true,
      concepts: updatedPost.image_concepts,
      post: updatedPost,
      preset,
      sourceImageCategory: category,
      protection: protectionMetadata(),
      publication: {
        published: false,
        note: "Image concept generation started only. Nothing was published.",
      },
    };
    await completeAgentIdempotentActionAsync({
      storeKey: idemStoreKey,
      fingerprint,
      status: 200,
      body: responseBody,
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    if (idemStoreKey) {
      await failAgentIdempotentActionAsync(idemStoreKey);
    }
    const storeUnavailable = durableAgentStoreErrorResponse(error);
    if (storeUnavailable) return storeUnavailable;
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Image concept generation failed.",
      },
      { status: 500 },
    );
  }
}
