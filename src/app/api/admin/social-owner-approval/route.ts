import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { evaluateStatusTransitionFromStoredPost } from "@/lib/social-posts/agents/status-transition-gate";
import { createOwnerApprovalAuthoritySnapshot } from "@/lib/social-posts/social-owner-approval-authorization";
import { decideOwnerApproval } from "@/lib/social-posts/social-owner-approval-decision-flow";
import type {
  SocialOwnerApprovalApprovalId,
  SocialOwnerApprovalEventId,
  SocialOwnerApprovalProposalFingerprint,
  SocialOwnerApprovalProposalId,
  SocialOwnerApprovalProposalVersion,
  SocialOwnerApprovalSocialPostId,
} from "@/lib/social-posts/social-owner-approval-persistence";
import {
  prepareOwnerApprovalRequestProposal,
  requestOwnerApproval,
  type OwnerApprovalRequestInput,
} from "@/lib/social-posts/social-owner-approval-request-flow";
import { getOwnerApprovalCurrentStateByApprovalId } from "@/lib/social-posts/social-owner-approval-state-service";
import {
  appendOwnerApprovalEvent,
  getOwnerApprovalProposalByApprovalId,
} from "@/lib/social-posts/social-owner-approval-store";
import {
  getSocialPostById,
  listSocialPosts,
  updateSocialPostStatus,
} from "@/lib/social-posts/social-post-data";

function isAgentInvocation(req: NextRequest): boolean {
  const purpose = req.headers.get("x-purpose")?.trim().toLowerCase();
  return Boolean(
    req.headers.get("x-social-agent") ||
      req.headers.get("x-cursor-agent") ||
      req.headers.get("x-agent-invoke") ||
      purpose === "agent" ||
      purpose === "llm" ||
      purpose === "autonomous",
  );
}
function proposalFingerprint(post: NonNullable<Awaited<ReturnType<typeof getSocialPostById>>>): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: post.id,
        title: post.title,
        caption: post.caption,
        prompt: post.prompt,
        campaignId: post.campaign_id,
        mediaType: post.media_type,
        mediaUrl:
          post.media_url ??
          post.approved_image_url ??
          post.generated_image_url ??
          post.source_image_url,
        platforms: [...post.platforms].sort(),
        placement: post.post_placement,
      }),
    )
    .digest("hex");
}

function deterministicUuid(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function approvalSuccess(input: {
  socialPostId: string;
  proposalId: SocialOwnerApprovalProposalId;
  approvalId: SocialOwnerApprovalApprovalId;
  executionIntentId: string;
}) {
  return NextResponse.json({
    ok: true,
    socialPostId: input.socialPostId,
    proposalId: input.proposalId,
    ownerApprovalId: input.approvalId,
    approvalId: input.approvalId,
    executionIntentId: input.executionIntentId,
  });
}

export async function POST(req: NextRequest) {
  if (isAgentInvocation(req)) {
    return NextResponse.json(
      { error: "Agents and LLMs cannot grant owner approval.", code: "agent_approval_forbidden" },
      { status: 403 },
    );
  }

  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) {
    return NextResponse.json({ error: "Owner authorization required." }, { status: 401 });
  }

  const body = (await req.json()) as { social_post_id?: unknown };
  const socialPostId =
    typeof body.social_post_id === "string" ? body.social_post_id.trim() : "";
  if (!socialPostId) {
    return NextResponse.json({ error: "social_post_id is required." }, { status: 400 });
  }

  const post = await getSocialPostById(socialPostId);
  if (!post) {
    return NextResponse.json({ error: "Social post not found." }, { status: 404 });
  }

  const transition = evaluateStatusTransitionFromStoredPost({
    post,
    requestedStatus: "approved",
    posts: await listSocialPosts(),
  });
  if (!transition.eligible) {
    return NextResponse.json(
      {
        error: `Not approval-ready: ${transition.reason}`,
        code: "compliance_blocked",
      },
      { status: 422 },
    );
  }

  const now = new Date().toISOString();
  const brandedPostId = post.id as SocialOwnerApprovalSocialPostId;
  const fingerprint = proposalFingerprint(post) as SocialOwnerApprovalProposalFingerprint;
  const proposalVersion = `social-post:${post.updated_at}` as SocialOwnerApprovalProposalVersion;
  const identitySeed = `${post.id}:${fingerprint}:${proposalVersion}`;
  const proposalId = deterministicUuid(`proposal:${identitySeed}`) as SocialOwnerApprovalProposalId;
  const approvalId = deterministicUuid(`approval:${identitySeed}`) as SocialOwnerApprovalApprovalId;
  const requestEventId = deterministicUuid(`request:${identitySeed}`) as SocialOwnerApprovalEventId;
  const decisionEventId = deterministicUuid(`decision:${identitySeed}`) as SocialOwnerApprovalEventId;
  const executionIntentId = `owner-publish:${deterministicUuid(`execution:${identitySeed}`)}`;
  const mediaUrl =
    post.media_url ??
    post.approved_image_url ??
    post.generated_image_url ??
    post.source_image_url;
  const authoritySnapshot = createOwnerApprovalAuthoritySnapshot({
    actorId: auth.identity.id,
    actorType: "human",
    authorityRole: "owner",
    canApprove: true,
    authoritySource: "admin_session",
  });
  const actor = {
    actorId: auth.identity.id,
    actorType: "human" as const,
    displayName: auth.identity.name,
    authoritySnapshot,
    authorityScope: {
      socialPostId: brandedPostId,
      campaignId: post.campaign_id,
      manifestId: null,
    },
  };

  const approvalRequest: OwnerApprovalRequestInput = {
      proposalId,
      approvalId,
      requestEventId,
      socialPostId: brandedPostId,
      proposalFingerprint: fingerprint,
      proposalVersion,
      campaignId: post.campaign_id,
      platforms: post.platforms,
      actor,
      createdAt: now,
      requestedAt: now,
      reviewedSnapshot: {
        title: post.title,
        caption: post.caption,
        mediaType: post.media_type,
        businessFocus: post.business_focus,
        socialPostStatusAtRequest: post.status,
        mediaReference: mediaUrl
          ? {
              assetId: null,
              assetFamilyId: null,
              assetType: post.media_type,
              assetStage: "owner_reviewed",
              url: mediaUrl,
              storagePath: null,
            }
          : null,
        selectedAssetReferences: [],
        approvedAssetReferences: [],
        humanSummary: `Owner reviewed ${post.title ?? "social post"}.`,
      },
      manifestReference: null,
      eligibilityReference: null,
      warningCodes: [],
      notes: "Approved by the owner from Social Post Drafts.",
      context: { source: "social_posts_admin" },
  };

  const existing = await getOwnerApprovalProposalByApprovalId(approvalId);
  if (existing.ok) {
    if (
      existing.value.socialPostId !== brandedPostId ||
      existing.value.proposalFingerprint !== fingerprint ||
      existing.value.proposalVersion !== proposalVersion
    ) {
      return NextResponse.json(
        { error: "Existing owner approval identity does not match this post.", code: "approval_identity_conflict" },
        { status: 409 },
      );
    }

    const current = await getOwnerApprovalCurrentStateByApprovalId({ approvalId });
    if (!current.ok) {
      return NextResponse.json(
        { error: "Owner approval history could not be verified.", code: current.error.code },
        { status: 409 },
      );
    }
    if (current.value.lifecycleStatus === "approved") {
      await updateSocialPostStatus(post.id, "approved");
      return approvalSuccess({ socialPostId: post.id, proposalId, approvalId, executionIntentId });
    }
    if (current.value.lifecycleStatus === "no_events") {
      const prepared = prepareOwnerApprovalRequestProposal(approvalRequest);
      const recovered = await appendOwnerApprovalEvent({
        proposal: existing.value,
        event: prepared.requestEvent,
      });
      if (!recovered.ok) {
        return NextResponse.json(
          { error: "Incomplete owner approval requires operational review.", code: "approval_recovery_required" },
          { status: 409 },
        );
      }
    } else if (current.value.lifecycleStatus !== "requested") {
      return NextResponse.json(
        { error: "This exact owner approval is no longer active. Update the draft before approving again.", code: "approval_not_active" },
        { status: 409 },
      );
    }
  } else if (existing.error.code === "not_found") {
    const requested = await requestOwnerApproval({ request: approvalRequest });
    if (!requested.ok) {
      return NextResponse.json(
        {
          error: "Owner approval could not be recorded. Please retry or review Social Posts operations.",
          code: requested.error.code,
        },
        { status: 409 },
      );
    }
  } else {
    return NextResponse.json(
      { error: "Owner approval storage is unavailable.", code: existing.error.code },
      { status: 503 },
    );
  }

  const decided = await decideOwnerApproval({
    decision: {
      proposalId,
      approvalId,
      decisionEventId,
      decisionKind: "approve",
      actor,
      occurredAt: now,
      eventSequence: 2,
      reason: "Explicit owner approval from Social Post Drafts.",
      context: { source: "social_posts_admin" },
    },
  });
  if (!decided.ok) {
    const replay = await getOwnerApprovalCurrentStateByApprovalId({ approvalId });
    if (replay.ok && replay.value.lifecycleStatus === "approved") {
      await updateSocialPostStatus(post.id, "approved");
      return approvalSuccess({ socialPostId: post.id, proposalId, approvalId, executionIntentId });
    }
    return NextResponse.json(
      {
        error: "Owner approval decision could not be recorded. Please review Social Posts operations before retrying.",
        code: decided.error.code,
      },
      { status: 409 },
    );
  }

  await updateSocialPostStatus(post.id, "approved");
  revalidatePath("/admin/social-posts");
  revalidatePath("/admin/social-posts/publication-execution");

  return approvalSuccess({ socialPostId: post.id, proposalId, approvalId, executionIntentId });
}
