import { createHash } from "node:crypto";

import {
  evaluateAgentComplianceGate,
  type ComplianceGateResult,
} from "../agents/agent-compliance-gate";
import {
  deriveExecutionAuthorizationState,
  type SocialExecutionAuthorizationRecord,
} from "../execution-authorization/social-execution-authorization-domain";
import { loadSocialExecutionAuthorizationSnapshot } from "../execution-authorization/social-execution-authorization-store";
import { verifyOwnerApprovalForExecutionAuthorization } from "../execution-authorization/social-execution-authorization-owner-approval";
import {
  getSocialPostById,
  type SocialPost,
} from "../social-post-data";
import {
  createDurableMetaOrganicPublishLedger,
  createMemoryMetaOrganicPublishLedger,
  type MetaOrganicPublishLedger,
} from "./social-meta-page-publish-ledger";
import {
  isSocialOAuthConnectConfigured,
  resolveSocialOAuthRuntimeConfig,
  type SocialOAuthRuntimeConfig,
} from "./social-oauth-config";
import {
  resolveActiveBoundMetaPageForPublicationTarget,
  type ActiveBoundMetaPageResolveResult,
} from "./social-meta-asset-binding-service";
import { loadMetaPageAccessTokenForPublicationTarget } from "./social-oauth-token-loader";
import { publishMetaPageFeedPost } from "./social-meta-page-publish-client";

export type MetaOrganicPublishResultMetadata = Readonly<{
  externalPostId: string;
  status: "published";
  socialPostId: string;
  publicationTargetId: string;
  pageId: string;
  authorizationId: string;
  fingerprint: string;
}>;

export type MetaOrganicPublishResult = Readonly<
  | {
      ok: true;
      replay: boolean;
      result: MetaOrganicPublishResultMetadata;
    }
  | {
      ok: false;
      code: string;
      message: string;
      phase?: "pre_meta" | "in_progress" | "uncertain_completion";
      needsManualReview?: boolean;
      externalPostId?: string | null;
    }
>;

export type MetaOrganicPublishDependencies = Readonly<{
  isConfigured: (config: SocialOAuthRuntimeConfig) => boolean;
  loadAuthorizationSnapshot: typeof loadSocialExecutionAuthorizationSnapshot;
  verifyOwnerApproval: typeof verifyOwnerApprovalForExecutionAuthorization;
  resolveBoundPage: (
    publicationTargetId: string,
  ) => Promise<ActiveBoundMetaPageResolveResult>;
  loadSocialPost: typeof getSocialPostById;
  evaluateCompliance: (input: {
    post: SocialPost;
    message: string;
  }) => ComplianceGateResult | Promise<ComplianceGateResult>;
  ledger: MetaOrganicPublishLedger;
  loadPageAccessToken: typeof loadMetaPageAccessTokenForPublicationTarget;
  publishFeedPost: typeof publishMetaPageFeedPost;
  now: () => Date;
}>;

let testDependencies: MetaOrganicPublishDependencies | null = null;

export function configureMetaOrganicPublishTestDependencies(
  dependencies: MetaOrganicPublishDependencies | null,
): void {
  testDependencies = dependencies;
}

function defaultEvaluateCompliance(input: {
  post: SocialPost;
  message: string;
}): ComplianceGateResult {
  return evaluateAgentComplianceGate({
    title: input.post.title?.trim() || "Social post",
    caption: input.message,
    generationPrompt: input.post.prompt?.trim() || input.message,
    campaignId: input.post.campaign_id,
    platforms: input.post.platforms,
    mediaType: input.post.media_type,
    posts: [input.post],
    candidateId: `publish:${input.post.id}`,
  });
}

function dependencies(): MetaOrganicPublishDependencies {
  return (
    testDependencies ?? {
      isConfigured: isSocialOAuthConnectConfigured,
      loadAuthorizationSnapshot: loadSocialExecutionAuthorizationSnapshot,
      verifyOwnerApproval: verifyOwnerApprovalForExecutionAuthorization,
      resolveBoundPage: resolveActiveBoundMetaPageForPublicationTarget,
      loadSocialPost: getSocialPostById,
      evaluateCompliance: defaultEvaluateCompliance,
      ledger: createDurableMetaOrganicPublishLedger(),
      loadPageAccessToken: loadMetaPageAccessTokenForPublicationTarget,
      publishFeedPost: publishMetaPageFeedPost,
      now: () => new Date(),
    }
  );
}

export function buildMetaOrganicPublishFingerprint(input: {
  socialPostId: string;
  publicationTargetId: string;
  pageId: string;
  message: string;
  link?: string | null;
  authorizationId?: string | null;
}): string {
  return createHash("sha256")
    .update(
      [
        input.socialPostId.trim(),
        input.publicationTargetId.trim(),
        input.pageId.trim(),
        input.message.trim(),
        (input.link ?? "").trim(),
        (input.authorizationId ?? "").trim(),
      ].join("\n"),
    )
    .digest("hex");
}

export function buildMetaOrganicPublishMessageFromPost(post: SocialPost): string {
  return (post.caption?.trim() || post.title?.trim() || "").trim();
}

/**
 * Organic Meta Page publish behind durable execution authorization + dedicated
 * claim store (social_meta_organic_publish_claims).
 *
 * Local draft Approve is never sufficient. Agents/LLMs cannot autonomously publish.
 */
export async function publishOrganicMetaPagePost(input: {
  socialPostId: string;
  publicationTargetId: string;
  pageId: string;
  message?: string | null;
  link?: string | null;
  authorizationId: string | null | undefined;
  /** Ignored for authorization — present so callers cannot confuse draft Approve with publish auth. */
  draftStatus?: string | null;
  idempotencyKey?: string | null;
  adminActorId: string;
  config?: SocialOAuthRuntimeConfig;
  fetchImpl?: typeof fetch;
}): Promise<MetaOrganicPublishResult> {
  void input.idempotencyKey;
  void input.draftStatus;
  const deps = dependencies();
  const config = input.config ?? resolveSocialOAuthRuntimeConfig();

  if (!deps.isConfigured(config)) {
    return {
      ok: false,
      code: "oauth_not_configured",
      message:
        "Meta organic publish is not configured. Configure OAuth/vault env before publishing.",
      phase: "pre_meta",
    };
  }

  if (!input.authorizationId?.trim()) {
    return {
      ok: false,
      code: "execution_authorization_required",
      message:
        "Durable execution authorization is required. Local draft Approve cannot publish to Meta.",
      phase: "pre_meta",
    };
  }

  const socialPostId = input.socialPostId.trim();
  const publicationTargetId = input.publicationTargetId.trim();
  const pageId = input.pageId.trim();
  if (!socialPostId || !publicationTargetId || !pageId) {
    return {
      ok: false,
      code: "invalid_publish_input",
      message: "socialPostId, publicationTargetId, and pageId are required.",
      phase: "pre_meta",
    };
  }

  const authorizationId = input.authorizationId.trim();
  const snapshot = await deps.loadAuthorizationSnapshot();
  const authorization =
    snapshot.authorizations.find(
      (record) => record.authorizationId === authorizationId,
    ) ?? null;

  if (!authorization) {
    return {
      ok: false,
      code: "authorization_not_found",
      message: "Execution authorization could not be found for Meta publication.",
      phase: "pre_meta",
    };
  }

  const cancellation =
    snapshot.cancellations.find(
      (record) => record.authorizationId === authorization.authorizationId,
    ) ?? null;
  const derived = deriveExecutionAuthorizationState({
    authorization,
    cancellation,
    now: deps.now(),
  });
  if (derived !== "valid") {
    return {
      ok: false,
      code: `authorization_${derived}`,
      message: `Execution authorization is ${derived}; Meta publication denied.`,
      phase: "pre_meta",
    };
  }

  if (!authorizationMatchesPublishScope(authorization, socialPostId, publicationTargetId)) {
    return {
      ok: false,
      code: "authorization_scope_mismatch",
      message:
        "Execution authorization is not scoped to this social post and publication target.",
      phase: "pre_meta",
    };
  }

  const ownerApproval = await deps.verifyOwnerApproval({
    ownerApprovalId: authorization.ownerApprovalId,
    executionIntentId: authorization.executionIntentId,
    publicationTargetId,
    socialPostId,
    approvalId: authorization.scope.approvalId,
  });
  if (!ownerApproval.ok) {
    return {
      ok: false,
      code: ownerApproval.code,
      message: ownerApproval.message,
      phase: "pre_meta",
    };
  }

  const boundPage = await deps.resolveBoundPage(publicationTargetId);
  if (!boundPage.ok) {
    return {
      ok: false,
      code: boundPage.code,
      message: boundPage.message,
      phase: "pre_meta",
    };
  }
  if (boundPage.pageId !== pageId) {
    return {
      ok: false,
      code: "meta_page_binding_mismatch",
      message:
        "Requested Meta Page does not match the active bound publication target Page.",
      phase: "pre_meta",
    };
  }

  const post = await deps.loadSocialPost(socialPostId);
  if (!post) {
    return {
      ok: false,
      code: "social_post_not_found",
      message: "Authoritative social post could not be loaded for Meta publication.",
      phase: "pre_meta",
    };
  }

  const authoritativeMessage = buildMetaOrganicPublishMessageFromPost(post);
  if (!authoritativeMessage) {
    return {
      ok: false,
      code: "publish_content_empty",
      message: "Authoritative social post has no caption/title to publish.",
      phase: "pre_meta",
    };
  }

  const requestedMessage = input.message?.trim() ?? "";
  if (requestedMessage && requestedMessage !== authoritativeMessage) {
    return {
      ok: false,
      code: "content_changed_after_authorization",
      message:
        "Requested publish text does not match the authoritative social post content. Re-authorize after updating the post.",
      phase: "pre_meta",
    };
  }

  const message = authoritativeMessage;
  const compliance = await deps.evaluateCompliance({ post, message });
  if (!compliance.allowedToProceed || compliance.decision !== "allow") {
    return {
      ok: false,
      code:
        compliance.decision === "block"
          ? "compliance_blocked"
          : "compliance_not_allowed",
      message:
        compliance.summary ||
        "Deterministic compliance denied Meta publication.",
      phase: "pre_meta",
    };
  }

  const fingerprint = buildMetaOrganicPublishFingerprint({
    socialPostId,
    publicationTargetId,
    pageId,
    message,
    link: input.link,
    authorizationId,
  });

  const ledgerAvailable = await deps.ledger.isAvailable();
  if (!ledgerAvailable) {
    return {
      ok: false,
      code: "durable_publish_ledger_unavailable",
      message:
        "Durable Meta publish claim store is unavailable. Meta publish fails closed before any provider call.",
      phase: "pre_meta",
    };
  }

  const claim = await deps.ledger.claim({
    authorizationId,
    socialPostId,
    publicationTargetId,
    pageId,
    fingerprint,
    ownerApprovalId: authorization.ownerApprovalId,
    adminActorId: input.adminActorId,
  });
  if (!claim.ok) {
    return {
      ok: false,
      code: claim.code,
      message: claim.message,
      phase: "pre_meta",
    };
  }
  if (claim.kind === "replay") {
    return { ok: true, replay: true, result: claim.result };
  }
  if (claim.kind === "awaiting_reconciliation") {
    return {
      ok: false,
      code: "publish_completion_uncertain",
      message: claim.message,
      phase: "uncertain_completion",
      needsManualReview: true,
      externalPostId: claim.externalPostId,
    };
  }
  if (claim.kind === "in_progress") {
    return {
      ok: false,
      code: "publish_in_progress",
      message: claim.message,
      phase: "in_progress",
      needsManualReview: true,
    };
  }

  const tokenResult = await deps.loadPageAccessToken({
    publicationTargetId,
    pageId,
    config,
  });
  if (!tokenResult.ok) {
    await deps.ledger.fail({
      authorizationId,
      claimId: claim.claimId,
      errorCode: tokenResult.code,
      message: tokenResult.message,
    });
    return {
      ok: false,
      code: tokenResult.code,
      message: tokenResult.message,
      phase: "pre_meta",
    };
  }

  const marked = await deps.ledger.markMetaInvoked({
    authorizationId,
    claimId: claim.claimId,
  });
  if (!marked.ok) {
    await deps.ledger.fail({
      authorizationId,
      claimId: claim.claimId,
      errorCode: marked.code,
      message: marked.message,
    });
    return {
      ok: false,
      code: marked.code,
      message: marked.message,
      phase: "pre_meta",
    };
  }

  const publish = await deps.publishFeedPost({
    pageId,
    pageAccessToken: tokenResult.accessToken,
    message,
    link: input.link,
    fetchImpl: input.fetchImpl,
  });
  if (!publish.ok) {
    // Meta was marked invoked — never reopen for another mutation.
    return {
      ok: false,
      code: "publish_completion_uncertain",
      message:
        "Meta HTTP failed after invocation was marked. Manual review required — do not retry with a new authorization or create another Meta post.",
      phase: "uncertain_completion",
      needsManualReview: true,
      externalPostId: null,
    };
  }

  const result: MetaOrganicPublishResultMetadata = {
    externalPostId: publish.externalPostId,
    status: "published",
    socialPostId,
    publicationTargetId,
    pageId,
    authorizationId,
    fingerprint,
  };

  const completed = await deps.ledger.complete({
    authorizationId,
    claimId: claim.claimId,
    result,
  });
  if (!completed.ok) {
    return {
      ok: false,
      code: "publish_completion_uncertain",
      message:
        "Meta may have accepted the post, but durable completion failed. Manual review required — do not retry with a new authorization.",
      phase: "uncertain_completion",
      needsManualReview: true,
      externalPostId: publish.externalPostId,
    };
  }

  return { ok: true, replay: false, result };
}

function authorizationMatchesPublishScope(
  authorization: SocialExecutionAuthorizationRecord,
  socialPostId: string,
  publicationTargetId: string,
): boolean {
  if (authorization.publicationTargetId !== publicationTargetId) return false;
  if (authorization.scope.publicationTargetId !== publicationTargetId) return false;
  if (authorization.scope.socialPostId !== socialPostId) return false;
  return true;
}

/** Test helper: memory claim store mirroring RPC semantics (not production correctness). */
export function createTestMetaOrganicPublishLedger(): MetaOrganicPublishLedger {
  return createMemoryMetaOrganicPublishLedger();
}
