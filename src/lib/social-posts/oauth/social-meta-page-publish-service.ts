import { createHash } from "node:crypto";

import {
  deriveExecutionAuthorizationState,
  type SocialExecutionAuthorizationRecord,
} from "../execution-authorization/social-execution-authorization-domain";
import { loadSocialExecutionAuthorizationSnapshot } from "../execution-authorization/social-execution-authorization-store";
import { verifyOwnerApprovalForExecutionAuthorization } from "../execution-authorization/social-execution-authorization-owner-approval";
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
  | { ok: false; code: string; message: string }
>;

export type MetaOrganicPublishDependencies = Readonly<{
  isConfigured: (config: SocialOAuthRuntimeConfig) => boolean;
  loadAuthorizationSnapshot: typeof loadSocialExecutionAuthorizationSnapshot;
  verifyOwnerApproval: typeof verifyOwnerApprovalForExecutionAuthorization;
  resolveBoundPage: (
    publicationTargetId: string,
  ) => Promise<ActiveBoundMetaPageResolveResult>;
  loadPageAccessToken: typeof loadMetaPageAccessTokenForPublicationTarget;
  publishFeedPost: typeof publishMetaPageFeedPost;
  now: () => Date;
  completedPublishes: Map<string, MetaOrganicPublishResultMetadata>;
  consumedAuthorizationIds: Set<string>;
}>;

const defaultCompletedPublishes = new Map<string, MetaOrganicPublishResultMetadata>();
const defaultConsumedAuthorizationIds = setFromEmpty();

function setFromEmpty(): Set<string> {
  return new Set<string>();
}

let testDependencies: MetaOrganicPublishDependencies | null = null;

export function configureMetaOrganicPublishTestDependencies(
  dependencies: MetaOrganicPublishDependencies | null,
): void {
  testDependencies = dependencies;
  if (!dependencies) {
    defaultCompletedPublishes.clear();
    defaultConsumedAuthorizationIds.clear();
  }
}

function dependencies(): MetaOrganicPublishDependencies {
  return (
    testDependencies ?? {
      isConfigured: isSocialOAuthConnectConfigured,
      loadAuthorizationSnapshot: loadSocialExecutionAuthorizationSnapshot,
      verifyOwnerApproval: verifyOwnerApprovalForExecutionAuthorization,
      resolveBoundPage: resolveActiveBoundMetaPageForPublicationTarget,
      loadPageAccessToken: loadMetaPageAccessTokenForPublicationTarget,
      publishFeedPost: publishMetaPageFeedPost,
      now: () => new Date(),
      completedPublishes: defaultCompletedPublishes,
      consumedAuthorizationIds: defaultConsumedAuthorizationIds,
    }
  );
}

export function buildMetaOrganicPublishFingerprint(input: {
  socialPostId: string;
  publicationTargetId: string;
  pageId: string;
  message: string;
  link?: string | null;
}): string {
  return createHash("sha256")
    .update(
      [
        input.socialPostId.trim(),
        input.publicationTargetId.trim(),
        input.pageId.trim(),
        input.message.trim(),
        (input.link ?? "").trim(),
      ].join("\n"),
    )
    .digest("hex");
}

/**
 * Organic Meta Page publish behind durable execution authorization.
 *
 * Explicitly rejects local draft Approve (`social_posts.status`) as authorization.
 * Requires a valid, unconsumed execution authorization scoped to this post/target,
 * plus durable owner-approval verification.
 */
export async function publishOrganicMetaPagePost(input: {
  socialPostId: string;
  publicationTargetId: string;
  pageId: string;
  message: string;
  link?: string | null;
  authorizationId: string | null | undefined;
  /** Ignored for authorization — present only so callers cannot confuse draft Approve with publish auth. */
  draftStatus?: string | null;
  idempotencyKey?: string | null;
  adminActorId: string;
  config?: SocialOAuthRuntimeConfig;
  fetchImpl?: typeof fetch;
}): Promise<MetaOrganicPublishResult> {
  void input.adminActorId;
  const deps = dependencies();
  const config = input.config ?? resolveSocialOAuthRuntimeConfig();

  if (!deps.isConfigured(config)) {
    return {
      ok: false,
      code: "oauth_not_configured",
      message:
        "Meta organic publish is not configured. Configure OAuth/vault env before publishing.",
    };
  }

  // Local draft Approve alone is never sufficient.
  if (!input.authorizationId?.trim()) {
    return {
      ok: false,
      code: "execution_authorization_required",
      message:
        "Durable execution authorization is required. Local draft Approve cannot publish to Meta.",
    };
  }

  const socialPostId = input.socialPostId.trim();
  const publicationTargetId = input.publicationTargetId.trim();
  const pageId = input.pageId.trim();
  const message = input.message.trim();
  if (!socialPostId || !publicationTargetId || !pageId || !message) {
    return {
      ok: false,
      code: "invalid_publish_input",
      message:
        "socialPostId, publicationTargetId, pageId, and message are required.",
    };
  }

  const fingerprint = buildMetaOrganicPublishFingerprint({
    socialPostId,
    publicationTargetId,
    pageId,
    message,
    link: input.link,
  });
  const idempotencyKey = (input.idempotencyKey?.trim() || fingerprint).slice(0, 200);
  const prior = deps.completedPublishes.get(idempotencyKey);
  if (prior && prior.fingerprint === fingerprint) {
    return { ok: true, replay: true, result: prior };
  }

  const authorizationId = input.authorizationId.trim();
  if (deps.consumedAuthorizationIds.has(authorizationId)) {
    return {
      ok: false,
      code: "authorization_consumed",
      message: "This execution authorization was already consumed for Meta publication.",
    };
  }

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
    };
  }

  if (!authorizationMatchesPublishScope(authorization, socialPostId, publicationTargetId)) {
    return {
      ok: false,
      code: "authorization_scope_mismatch",
      message:
        "Execution authorization is not scoped to this social post and publication target.",
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
    };
  }

  // Require the requested Page to match the active bound Meta Page before
  // any vault token load or Meta Graph mutation.
  const boundPage = await deps.resolveBoundPage(publicationTargetId);
  if (!boundPage.ok) {
    return {
      ok: false,
      code: boundPage.code,
      message: boundPage.message,
    };
  }
  if (boundPage.pageId !== pageId) {
    return {
      ok: false,
      code: "meta_page_binding_mismatch",
      message:
        "Requested Meta Page does not match the active bound publication target Page.",
    };
  }

  const tokenResult = await deps.loadPageAccessToken({
    publicationTargetId,
    pageId,
    config,
  });
  if (!tokenResult.ok) {
    return {
      ok: false,
      code: tokenResult.code,
      message: tokenResult.message,
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
    return {
      ok: false,
      code: publish.errorCode,
      message: publish.message,
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
  deps.completedPublishes.set(idempotencyKey, result);
  deps.consumedAuthorizationIds.add(authorizationId);

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
