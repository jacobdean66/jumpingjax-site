import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  createSocialAgentPlanWithMeta,
  type SocialAgentInput,
} from "@/lib/social-posts/social-agent";
import {
  acceptSocialPostGeneratedImage,
  deleteSocialPost,
  discardImageStudioConcepts,
  duplicateSocialPostDraft,
  getSocialPostById,
  listSocialPosts,
  rejectSocialPostGeneratedImage,
  removeImageStudioSourceImage,
  scheduleSocialPost,
  updateSocialPostDraft,
  updateSocialPostStatus,
  approveImageStudioSource,
  type SocialPost,
} from "@/lib/social-posts/social-post-data";
import {
  createSocialPostAsset,
  findSocialPostAssetByPrediction,
  findSocialPostAssetByUrl,
  selectSocialPostAsset,
  updateSocialPostAsset,
} from "@/lib/social-posts/social-post-assets";
import { recordSocialPostDecision } from "@/lib/social-posts/social-post-decisions";
import { socialPostAdminSchemaGuardResponse } from "@/lib/social-posts/social-post-admin-schema-guard";
import { verifyAdminAccess } from "@/lib/admin/session";
import { socialPostAdminRateLimitResponse } from "@/lib/social-posts/social-post-admin-rate-limit";
import { buildSocialPostAdminRateLimitClientKey } from "@/lib/social-posts/social-post-admin-rate-limit-core";
import { resolveApprovedAssetContext } from "@/lib/social-posts/agents/approved-asset-context";
import {
  AGENT_INPUT_LIMITS,
  AgentInputValidationError,
  boundOptionalText,
  requireExactStringArray,
  scanProhibitedBusinessClaims,
} from "@/lib/social-posts/agents/agent-input-bounds";
import {
  beginAgentIdempotentAction,
  buildAgentActionFingerprint,
  completeAgentIdempotentAction,
  failAgentIdempotentAction,
  normalizeIdempotencyKey,
} from "@/lib/social-posts/agents/agent-idempotency";
import { evaluateAgentComplianceGateWithPosts } from "@/lib/social-posts/agents/agent-compliance-gate";
import {
  DRAFT_COMPLIANCE_PERSISTENCE_POLICY,
  complianceBlocksPersistence,
} from "@/lib/social-posts/agents/generation-gate";
import {
  billableModelProtectionBlock,
  protectionMetadata,
} from "@/lib/social-posts/agents/agent-protection-mode";
import {
  evaluateStatusTransitionFromStoredPost,
  isApprovalReadyStatus,
  statusTransitionDecision,
  statusTransitionDeniedBody,
} from "@/lib/social-posts/agents/status-transition-gate";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function formRedirect(req: NextRequest, token: string, params: Record<string, string>) {
  const search = new URLSearchParams({ token, ...params });
  return NextResponse.redirect(
    new URL(`/admin/social-posts?${search.toString()}`, req.url),
    { status: 303 },
  );
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function arrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * Authoritative resulting media type for compliance evaluation: the
 * requested value when valid, otherwise the stored value. Compliance must
 * always evaluate the post state that would exist AFTER the update.
 */
function resolveResultingMediaType(
  requested: string,
  stored: string | null | undefined,
): "image" | "video" | null {
  const candidate = requested || stored || "";
  return candidate === "image" || candidate === "video" ? candidate : null;
}

function agentInputFromBody(body: Record<string, unknown>): SocialAgentInput {
  return {
    goal: stringValue(body.goal),
    campaignId: stringValue(body.campaign_id),
    platform: "both",
    mediaType: stringValue(body.media_type) === "image" ? "image" : "video",
    businessFocus:
      stringValue(body.business_focus) === "rentals" ||
      stringValue(body.business_focus) === "facility-parties"
        ? (stringValue(body.business_focus) as SocialAgentInput["businessFocus"])
        : "both",
  };
}

async function findCurrentGeneratedImageAsset(
  post: SocialPost,
) {
  if (post.image_prediction_id) {
    return findSocialPostAssetByPrediction({
      socialPostId: post.id,
      predictionId: post.image_prediction_id,
      assetType: "image",
    });
  }

  if (!post.generated_image_url) return null;
  return findSocialPostAssetByUrl({
    socialPostId: post.id,
    url: post.generated_image_url,
    assetType: "image",
  });
}

async function recordApprovedImageAsset(input: {
  post: SocialPost;
  imageUrl: string;
  sourceUrl?: string | null;
}) {
  const selectedAsset = await findSocialPostAssetByUrl({
    socialPostId: input.post.id,
    url: input.imageUrl,
    assetType: "image",
  });
  if (!selectedAsset) {
    throw new Error("Selected image asset not found.");
  }

  let approvedAsset = await findSocialPostAssetByUrl({
    socialPostId: input.post.id,
    url: input.imageUrl,
    assetType: "image",
    assetStage: "approved",
  });
  if (!approvedAsset) {
    approvedAsset = await createSocialPostAsset({
      socialPostId: input.post.id,
      parentAssetId: selectedAsset.id,
      assetType: "image",
      assetStage: "approved",
      url: input.imageUrl,
      sourceUrl: input.sourceUrl ?? null,
      createdBy: "human",
    });
  }

  await selectSocialPostAsset({
    socialPostId: input.post.id,
    assetId: approvedAsset.id,
  });

  return approvedAsset;
}

async function recordSocialPostDecisionBestEffort(
  input: Parameters<typeof recordSocialPostDecision>[0],
) {
  try {
    await recordSocialPostDecision(input);
  } catch (error) {
    console.error("Failed to record social post decision", error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await req.json()) as Record<string, unknown> & {
      token?: string;
      status?: string;
      scheduled_for?: string;
      action?: string;
    };
    const auth = await verifyAdminAccess(body.token);

    if (!auth.ok) {
      return NextResponse.json({ error: "Invalid admin login" }, { status: 401 });
    }

    const schemaGuard = await socialPostAdminSchemaGuardResponse();
    if (schemaGuard) {
      return schemaGuard;
    }

    try {
      if (body.action === "duplicate") {
        const post = await duplicateSocialPostDraft(id);
        revalidatePath("/admin/social-posts");
        return NextResponse.json({ post });
      }

      if (body.action === "accept_image") {
        const existing = await getSocialPostById(id);
        if (!existing) {
          return NextResponse.json({ error: "Social post not found" }, { status: 404 });
        }
        if (!existing.generated_image_url) {
          return NextResponse.json(
            { error: "No generated image is available to accept." },
            { status: 400 },
          );
        }
        const approvedAsset = await recordApprovedImageAsset({
          post: existing,
          imageUrl: existing.generated_image_url,
          sourceUrl: existing.generated_image_source_url,
        });
        const post = await acceptSocialPostGeneratedImage(id);
        await recordSocialPostDecisionBestEffort({
          socialPostId: id,
          assetId: approvedAsset.id,
          assetFamilyId: approvedAsset.asset_family_id,
          campaignId: existing.campaign_id,
          decisionStage: "image_review",
          decisionType: "accepted",
          decision: "Accepted generated image for video source.",
          inputSnapshot: {
            generated_image_url: existing.generated_image_url,
            generated_image_source_url: existing.generated_image_source_url,
            image_prediction_id: existing.image_prediction_id,
          },
          outputSnapshot: {
            approved_image_url: post.approved_image_url,
            asset_id: approvedAsset.id,
            asset_family_id: approvedAsset.asset_family_id,
          },
          createdBy: "human",
        });
        revalidatePath("/admin/social-posts");
        return NextResponse.json({ post });
      }

      if (body.action === "reject_image") {
        const existing = await getSocialPostById(id);
        if (!existing) {
          return NextResponse.json({ error: "Social post not found" }, { status: 404 });
        }
        const generatedAsset = await findCurrentGeneratedImageAsset(existing);
        if (!generatedAsset) {
          return NextResponse.json(
            { error: "Generated image asset not found." },
            { status: 400 },
          );
        }
        await updateSocialPostAsset({
          socialPostId: id,
          assetId: generatedAsset.id,
          isSelected: false,
          isRejected: true,
        });
        const post = await rejectSocialPostGeneratedImage(id);
        await recordSocialPostDecisionBestEffort({
          socialPostId: id,
          assetId: generatedAsset.id,
          assetFamilyId: generatedAsset.asset_family_id,
          campaignId: existing.campaign_id,
          decisionStage: "image_review",
          decisionType: "rejected",
          decision: "Rejected generated image.",
          inputSnapshot: {
            generated_image_url: existing.generated_image_url,
            image_prediction_id: existing.image_prediction_id,
          },
          outputSnapshot: {
            asset_id: generatedAsset.id,
            asset_family_id: generatedAsset.asset_family_id,
            is_rejected: true,
            generated_image_url: post.generated_image_url,
            image_prediction_id: post.image_prediction_id,
          },
          provider: generatedAsset.provider,
          model: generatedAsset.model,
          createdBy: "human",
        });
        revalidatePath("/admin/social-posts");
        return NextResponse.json({ post });
      }

      if (body.action === "use_as_source_image") {
        const imageUrl = stringValue(body.image_url);
        const existing = await getSocialPostById(id);
        if (!existing) {
          return NextResponse.json({ error: "Social post not found" }, { status: 404 });
        }
        if (!imageUrl) {
          return NextResponse.json(
            { error: "Approved image URL is required." },
            { status: 400 },
          );
        }
        await recordApprovedImageAsset({ post: existing, imageUrl });
        const post = await approveImageStudioSource(id, imageUrl);
        revalidatePath("/admin/social-posts");
        return NextResponse.json({ post });
      }

      if (body.action === "remove_source_image") {
        const post = await removeImageStudioSourceImage(id);
        revalidatePath("/admin/social-posts");
        return NextResponse.json({ post });
      }

      if (body.action === "discard_image_concepts") {
        const existing = await getSocialPostById(id);
        const post = await discardImageStudioConcepts(id);
        await recordSocialPostDecisionBestEffort({
          socialPostId: id,
          campaignId: existing?.campaign_id ?? post.campaign_id,
          decisionStage: "image_review",
          decisionType: "discarded",
          decision: "Discarded image concepts and cleared generated image state.",
          inputSnapshot: {
            image_concepts_count: existing?.image_concepts.length ?? null,
            generated_image_url: existing?.generated_image_url ?? null,
            image_prediction_id: existing?.image_prediction_id ?? null,
          },
          outputSnapshot: {
            image_concepts_count: post.image_concepts.length,
            generated_image_url: post.generated_image_url,
            image_prediction_id: post.image_prediction_id,
          },
          createdBy: "human",
        });
        revalidatePath("/admin/social-posts");
        return NextResponse.json({ post });
      }

      if (
        body.action === "regenerate_caption" ||
        body.action === "regenerate_prompt" ||
        body.action === "regenerate_all"
      ) {
        // Regeneration is a billable model-backed action: fail closed before
        // any lookup, quota use, or provider call when durable protection is
        // unavailable (production).
        const modelBlock = billableModelProtectionBlock();
        if (modelBlock) {
          return NextResponse.json(modelBlock, { status: 503 });
        }

        // Lookup before rate-limit so nonexistent posts do not consume quota.
        const existing = await getSocialPostById(id);
        if (!existing) {
          return NextResponse.json(
            { ok: false, error: "Social post not found" },
            { status: 404 },
          );
        }

        const limited = socialPostAdminRateLimitResponse(req, {
          route: "/api/social-posts/[id]#regenerate",
          category: "draft",
          token: body.token,
        });
        if (limited) {
          return limited;
        }

        const goal = boundOptionalText(
          stringValue(body.goal) || existing.goal,
          "goal",
          AGENT_INPUT_LIMITS.goal,
        );
        const assetResolved = resolveApprovedAssetContext(
          stringValue(body.source_image_url) || existing.source_image_url,
        );
        if (!assetResolved.ok) {
          return NextResponse.json(
            { ok: false, error: assetResolved.error },
            { status: 400 },
          );
        }

        const agentInput = {
          ...agentInputFromBody(body),
          goal,
          campaignId:
            stringValue(body.campaign_id) || existing.campaign_id || undefined,
          assetContext: assetResolved.asset?.metadataSummary ?? null,
        };

        const fingerprint = buildAgentActionFingerprint({
          action: body.action,
          postId: id,
          goal: agentInput.goal ?? null,
          campaignId: agentInput.campaignId ?? null,
          mediaType: agentInput.mediaType ?? null,
          businessFocus: agentInput.businessFocus ?? null,
          assetUrl: assetResolved.asset?.url ?? null,
        });
        const idempotencyKey = normalizeIdempotencyKey(
          body.idempotencyKey ?? req.headers.get("idempotency-key"),
        );
        const clientKey = buildSocialPostAdminRateLimitClientKey(req, body.token);
        const idem = beginAgentIdempotentAction({
          clientKey,
          action: "regenerate",
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
              error: "An identical regeneration request is already in progress.",
              code: "duplicate_in_progress",
              retryAfterSeconds: idem.retryAfterSeconds,
            },
            {
              status: 409,
              headers: { "Retry-After": String(idem.retryAfterSeconds) },
            },
          );
        }

        try {
          const { plan, diagnostics } =
            await createSocialAgentPlanWithMeta(agentInput);
          const creativeSource =
            diagnostics.source === "model" ? "openai" : "rule-fallback";

          const nextTitle =
            body.action === "regenerate_all"
              ? plan.title
              : stringValue(body.title) || existing.title;
          const nextCaption =
            body.action === "regenerate_caption" || body.action === "regenerate_all"
              ? plan.caption
              : stringValue(body.caption) || existing.caption;
          const nextPrompt =
            body.action === "regenerate_prompt" || body.action === "regenerate_all"
              ? plan.generationPrompt
              : stringValue(body.prompt) || existing.prompt;

          const compliance = await evaluateAgentComplianceGateWithPosts({
            title: nextTitle ?? "Regenerated draft",
            caption: nextCaption ?? "",
            generationPrompt: nextPrompt ?? "",
            campaignId:
              body.action === "regenerate_all"
                ? plan.campaignId
                : existing.campaign_id,
            platforms:
              body.action === "regenerate_all" ? plan.platforms : existing.platforms,
            // Evaluate the RESULTING media type that will be persisted.
            mediaType:
              body.action === "regenerate_all"
                ? plan.mediaType
                : resolveResultingMediaType(
                    stringValue(body.media_type),
                    existing.media_type,
                  ),
            candidateId: `explicit:regenerate:${id}`,
          });

          if (complianceBlocksPersistence(compliance)) {
            const blocked = {
              ok: false,
              error: "Regeneration blocked by deterministic compliance validation.",
              code: "compliance_blocked",
              agent: diagnostics,
              compliance,
              draftPolicy: DRAFT_COMPLIANCE_PERSISTENCE_POLICY,
              protection: protectionMetadata(),
              publication: {
                published: false,
                note: "Nothing was persisted or published.",
              },
            };
            completeAgentIdempotentAction({
              storeKey: idem.storeKey,
              fingerprint,
              status: 422,
              body: blocked,
            });
            return NextResponse.json(blocked, { status: 422 });
          }

          // Regenerated content may not carry or set an approval-ready
          // status unless the fresh compliance decision is allow.
          const resultingStatus =
            stringValue(body.status) ||
            (stringValue(body.scheduled_for) ? "scheduled" : "") ||
            existing.status;
          if (isApprovalReadyStatus(resultingStatus)) {
            const transition = statusTransitionDecision({
              requestedStatus: resultingStatus,
              compliance,
            });
            if (!transition.eligible) {
              const denied = statusTransitionDeniedBody(transition);
              completeAgentIdempotentAction({
                storeKey: idem.storeKey,
                fingerprint,
                status: 422,
                body: denied,
              });
              return NextResponse.json(denied, { status: 422 });
            }
          }

          const post = await updateSocialPostDraft(id, {
            title: nextTitle,
            campaign_id:
              body.action === "regenerate_all"
                ? plan.campaignId
                : stringValue(body.campaign_id) || existing.campaign_id,
            goal: goal || existing.goal,
            prompt: nextPrompt,
            caption: nextCaption,
            media_type:
              body.action === "regenerate_all"
                ? plan.mediaType
                : stringValue(body.media_type) || existing.media_type,
            business_focus:
              body.action === "regenerate_all"
                ? plan.businessFocus
                : stringValue(body.business_focus) || existing.business_focus,
            source_image_url:
              body.action === "regenerate_all"
                ? assetResolved.asset?.url ?? plan.sourceImageUrl
                : assetResolved.asset?.url ||
                  stringValue(body.source_image_url) ||
                  existing.source_image_url,
            platforms:
              body.action === "regenerate_all"
                ? plan.platforms
                : arrayValue(body.platforms),
            post_placement:
              stringValue(body.post_placement) || existing.post_placement,
            format_variant_id:
              stringValue(body.format_variant_id) || existing.format_variant_id,
            creative_source: creativeSource,
            status: stringValue(body.status) || existing.status,
            scheduled_for: stringValue(body.scheduled_for) || null,
          });
          revalidatePath("/admin/social-posts");
          const quarantined = compliance.decision === "quarantine";
          const okBody = {
            ok: true,
            post,
            agent: diagnostics,
            compliance,
            draftPolicy: DRAFT_COMPLIANCE_PERSISTENCE_POLICY,
            generationReady: false,
            generationReadyReason: quarantined
              ? "Quarantined working draft updated. Paid generation stays locked until compliance allow."
              : "Draft updated. Paid generation still requires compliance allow on the exact prompt.",
            protection: protectionMetadata(),
            publication: {
              published: false,
              note: quarantined
                ? "QUARANTINE: non-approved working draft updated for owner review. Not compliant, not publishable, not generation-ready."
                : "Draft fields updated only. Nothing was published.",
            },
          };
          completeAgentIdempotentAction({
            storeKey: idem.storeKey,
            fingerprint,
            status: 200,
            body: okBody,
          });
          return NextResponse.json(okBody);
        } catch (error) {
          failAgentIdempotentAction(idem.storeKey);
          if (error instanceof AgentInputValidationError) {
            return NextResponse.json(
              { ok: false, error: error.message },
              { status: 400 },
            );
          }
          throw error;
        }
      }

      if (body.scheduled_for && !body.title) {
        // Scheduling is an approval-ready transition: recompute compliance on
        // the stored draft server-side. Client flags are never trusted.
        const existing = await getSocialPostById(id);
        if (!existing) {
          return NextResponse.json(
            { ok: false, error: "Social post not found" },
            { status: 404 },
          );
        }
        const transition = evaluateStatusTransitionFromStoredPost({
          post: existing,
          requestedStatus: "scheduled",
          posts: await listSocialPosts(),
        });
        if (!transition.eligible) {
          return NextResponse.json(statusTransitionDeniedBody(transition), {
            status: 422,
          });
        }
        const post = await scheduleSocialPost(id, body.scheduled_for);
        revalidatePath("/admin/social-posts");
        return NextResponse.json({
          post,
          compliance: transition.compliance,
          statusTransition: { requestedStatus: "scheduled", eligible: true },
        });
      }

      if (body.status && !body.title) {
        const requestedStatus = stringValue(body.status);
        if (isApprovalReadyStatus(requestedStatus)) {
          const existing = await getSocialPostById(id);
          if (!existing) {
            return NextResponse.json(
              { ok: false, error: "Social post not found" },
              { status: 404 },
            );
          }
          const transition = evaluateStatusTransitionFromStoredPost({
            post: existing,
            requestedStatus,
            posts: await listSocialPosts(),
          });
          if (!transition.eligible) {
            return NextResponse.json(statusTransitionDeniedBody(transition), {
              status: 422,
            });
          }
          const post = await updateSocialPostStatus(id, requestedStatus);
          revalidatePath("/admin/social-posts");
          return NextResponse.json({
            post,
            compliance: transition.compliance,
            statusTransition: { requestedStatus, eligible: true },
          });
        }
        const post = await updateSocialPostStatus(id, requestedStatus);
        revalidatePath("/admin/social-posts");
        return NextResponse.json({ post });
      }

      const title = boundOptionalText(
        stringValue(body.title) || undefined,
        "title",
        AGENT_INPUT_LIMITS.title,
      );
      const goal = boundOptionalText(
        stringValue(body.goal) || undefined,
        "goal",
        AGENT_INPUT_LIMITS.goal,
      );
      const prompt = boundOptionalText(
        stringValue(body.prompt) || undefined,
        "prompt",
        AGENT_INPUT_LIMITS.prompt,
      );
      const caption = boundOptionalText(
        stringValue(body.caption) || undefined,
        "caption",
        AGENT_INPUT_LIMITS.caption,
      );

      const sourceCandidate = stringValue(body.source_image_url);
      const assetResolved = resolveApprovedAssetContext(
        sourceCandidate || null,
      );
      if (!assetResolved.ok) {
        return NextResponse.json(
          { ok: false, error: assetResolved.error, code: "unapproved_asset" },
          { status: 400 },
        );
      }

      let platforms: string[] | undefined;
      if (body.platforms !== undefined) {
        platforms = requireExactStringArray(body.platforms, "platforms", {
          min: 1,
          max: 2,
          itemMax: 32,
          allowedValues: ["facebook", "instagram"],
        });
      }

      const claimText = [title, caption, prompt, goal].filter(Boolean).join("\n");
      const hardClaims = scanProhibitedBusinessClaims(claimText);
      if (hardClaims.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "Manual draft update blocked by prohibited business claims.",
            code: "compliance_blocked",
            hardClaimFindings: hardClaims,
            publication: {
              published: false,
              note: "Nothing was persisted or published.",
            },
          },
          { status: 422 },
        );
      }

      const existingForPatch = await getSocialPostById(id);
      if (!existingForPatch) {
        return NextResponse.json(
          { ok: false, error: "Social post not found" },
          { status: 404 },
        );
      }

      const compliance = await evaluateAgentComplianceGateWithPosts({
        title: title || existingForPatch.title || "Draft update",
        caption: caption || existingForPatch.caption || "",
        generationPrompt: prompt || existingForPatch.prompt || "",
        campaignId:
          stringValue(body.campaign_id) || existingForPatch.campaign_id,
        platforms: platforms ?? existingForPatch.platforms,
        // Evaluate the RESULTING media type, never the stored one, so a
        // combined media_type change + approval-ready transition is gated
        // against the post state that would actually be approved.
        mediaType: resolveResultingMediaType(
          stringValue(body.media_type),
          existingForPatch.media_type,
        ),
        candidateId: `explicit:manual-patch:${id}`,
      });

      if (complianceBlocksPersistence(compliance)) {
        return NextResponse.json(
          {
            ok: false,
            error: "Manual draft update blocked by deterministic compliance validation.",
            code: "compliance_blocked",
            compliance,
            draftPolicy: DRAFT_COMPLIANCE_PERSISTENCE_POLICY,
            publication: {
              published: false,
              note: "Nothing was persisted or published.",
            },
          },
          { status: 422 },
        );
      }

      // Combined content+status updates cannot approve/schedule atomically
      // without the freshly recomputed compliance on the NEW content being
      // an allow. Rejection persists nothing.
      const requestedPatchStatus =
        stringValue(body.status) ||
        (stringValue(body.scheduled_for) ? "scheduled" : "");
      if (isApprovalReadyStatus(requestedPatchStatus)) {
        const transition = statusTransitionDecision({
          requestedStatus: requestedPatchStatus,
          compliance,
        });
        if (!transition.eligible) {
          return NextResponse.json(statusTransitionDeniedBody(transition), {
            status: 422,
          });
        }
      }

      const post = await updateSocialPostDraft(id, {
        title: title || stringValue(body.title),
        campaign_id: stringValue(body.campaign_id),
        goal: goal || stringValue(body.goal),
        prompt: prompt || stringValue(body.prompt),
        caption: caption || stringValue(body.caption),
        media_type: stringValue(body.media_type),
        business_focus: stringValue(body.business_focus),
        source_image_url:
          assetResolved.asset?.url ||
          (sourceCandidate ? sourceCandidate : existingForPatch.source_image_url),
        platforms: platforms ?? arrayValue(body.platforms),
        post_placement: stringValue(body.post_placement),
        format_variant_id: stringValue(body.format_variant_id) || null,
        status: stringValue(body.status),
        scheduled_for: stringValue(body.scheduled_for) || null,
      });
      revalidatePath("/admin/social-posts");
      return NextResponse.json({
        ok: true,
        post,
        compliance,
        draftPolicy: DRAFT_COMPLIANCE_PERSISTENCE_POLICY,
        generationReady: false,
        generationReadyReason:
          compliance.decision === "quarantine"
            ? "QUARANTINE: working draft saved. Not generation-ready."
            : "Draft updated. Paid generation still requires compliance allow on the exact prompt.",
        protection: protectionMetadata(),
        publication: {
          published: false,
          note:
            compliance.decision === "quarantine"
              ? "QUARANTINE: non-approved working draft persisted. Not publishable or generation-ready."
              : "Draft fields updated only. Nothing was published.",
        },
      });
    } catch (error) {
      if (error instanceof AgentInputValidationError) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Social post update failed" },
        { status: 400 },
      );
    }
  }

  const form = await req.formData();
  const token = clean(form.get("token"));
  const auth = await verifyAdminAccess(token);

  if (!auth.ok) {
    return formRedirect(req, token, { error: "Invalid admin login" });
  }

  const schemaGuard = await socialPostAdminSchemaGuardResponse();
  if (schemaGuard) {
    const payload = (await schemaGuard.json()) as { error?: string };
    return formRedirect(req, token, {
      error: payload.error ?? "Social posts database schema is not ready.",
    });
  }

  try {
    const scheduledFor = clean(form.get("scheduled_for"));
    const requestedStatus = scheduledFor
      ? "scheduled"
      : clean(form.get("status"));

    // Form posts follow the same server-side approval gate as JSON PATCH:
    // approval-ready transitions require a fresh deterministic allow on the
    // stored draft. A rejected transition leaves the post unchanged.
    if (isApprovalReadyStatus(requestedStatus)) {
      const existing = await getSocialPostById(id);
      if (!existing) {
        return formRedirect(req, token, { error: "Social post not found" });
      }
      const transition = evaluateStatusTransitionFromStoredPost({
        post: existing,
        requestedStatus,
        posts: await listSocialPosts(),
      });
      if (!transition.eligible) {
        return formRedirect(req, token, {
          error: `Not approval-ready: ${transition.reason} Edit the draft until deterministic compliance is allow, then retry.`,
        });
      }
    }

    if (scheduledFor) {
      await scheduleSocialPost(id, scheduledFor);
    } else {
      await updateSocialPostStatus(id, clean(form.get("status")));
    }
    revalidatePath("/admin/social-posts");
    return formRedirect(req, token, { message: "Social post updated" });
  } catch (error) {
    return formRedirect(req, token, {
      error: error instanceof Error ? error.message : "Social post update failed",
    });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const token = req.nextUrl.searchParams.get("token");
  const auth = await verifyAdminAccess(token);

  if (!auth.ok) {
    return NextResponse.json({ error: "Invalid admin login" }, { status: 401 });
  }

  const schemaGuard = await socialPostAdminSchemaGuardResponse();
  if (schemaGuard) {
    return schemaGuard;
  }

  try {
    await deleteSocialPost(id);
    revalidatePath("/admin/social-posts");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Social post delete failed" },
      { status: 400 },
    );
  }
}
