import {
  evaluateAgentComplianceGate,
  type ComplianceGateResult,
} from "../agents/agent-compliance-gate";
import { deriveExecutionAuthorizationState } from "../execution-authorization/social-execution-authorization-domain";
import { loadSocialExecutionAuthorizationSnapshot } from "../execution-authorization/social-execution-authorization-store";
import { verifyOwnerApprovalForExecutionAuthorization } from "../execution-authorization/social-execution-authorization-owner-approval";
import {
  getSocialPostById,
  type SocialPost,
} from "../social-post-data";
import { createServiceRoleClient } from "../../supabase/admin";
import { resolveActiveBoundMetaPageForPublicationTarget } from "./social-meta-asset-binding-service";
import { publishOrganicMetaPagePost } from "./social-meta-page-publish-service";

export type MetaScheduledPublicationState =
  | "pending"
  | "processing"
  | "published"
  | "failed"
  | "recovery_required"
  | "cancelled";

export type MetaScheduledPublication = Readonly<{
  scheduleId: string;
  socialPostId: string;
  publicationTargetId: string;
  pageId: string;
  authorizationId: string;
  scheduledFor: string;
  state: MetaScheduledPublicationState;
  attemptCount: number;
  externalPostId: string | null;
  resultCode: string | null;
  resultMessage: string | null;
  createdByActor: string;
}>;

type ScheduledPublicationRow = Readonly<{
  schedule_id: string;
  social_post_id: string;
  publication_target_id: string;
  page_id: string;
  authorization_id: string;
  scheduled_for: string;
  state: MetaScheduledPublicationState;
  attempt_count: number;
  external_post_id: string | null;
  result_code: string | null;
  result_message: string | null;
  created_by_actor: string;
}>;

type ScheduledPublicationStore = Readonly<{
  create(input: {
    socialPostId: string;
    publicationTargetId: string;
    pageId: string;
    authorizationId: string;
    scheduledFor: string;
    createdByActor: string;
  }): Promise<MetaScheduledPublication>;
  claimDue(limit: number): Promise<readonly MetaScheduledPublication[]>;
  complete(input: {
    scheduleId: string;
    state: "published" | "failed" | "recovery_required";
    externalPostId: string | null;
    resultCode: string;
    resultMessage: string;
  }): Promise<void>;
}>;

export type MetaScheduledPublicationDependencies = Readonly<{
  loadAuthorizationSnapshot: typeof loadSocialExecutionAuthorizationSnapshot;
  verifyOwnerApproval: typeof verifyOwnerApprovalForExecutionAuthorization;
  resolveBoundPage: typeof resolveActiveBoundMetaPageForPublicationTarget;
  loadSocialPost: typeof getSocialPostById;
  evaluateCompliance: (input: {
    post: SocialPost;
    message: string;
  }) => ComplianceGateResult | Promise<ComplianceGateResult>;
  publish: typeof publishOrganicMetaPagePost;
  store: ScheduledPublicationStore;
  now: () => Date;
}>;

let testDependencies: MetaScheduledPublicationDependencies | null = null;

export function configureMetaScheduledPublicationTestDependencies(
  dependencies: MetaScheduledPublicationDependencies | null,
): void {
  testDependencies = dependencies;
}
function dependencies(): MetaScheduledPublicationDependencies {
  return (
    testDependencies ?? {
      loadAuthorizationSnapshot: loadSocialExecutionAuthorizationSnapshot,
      verifyOwnerApproval: verifyOwnerApprovalForExecutionAuthorization,
      resolveBoundPage: resolveActiveBoundMetaPageForPublicationTarget,
      loadSocialPost: getSocialPostById,
      evaluateCompliance: defaultEvaluateCompliance,
      publish: publishOrganicMetaPagePost,
      store: createSupabaseScheduledPublicationStore(),
      now: () => new Date(),
    }
  );
}

export async function scheduleMetaOrganicPublication(input: {
  socialPostId: string;
  publicationTargetId: string;
  pageId: string;
  authorizationId: string;
  scheduledFor: string;
  adminActorId: string;
}): Promise<
  | { ok: true; schedule: MetaScheduledPublication }
  | { ok: false; code: string; message: string }
> {
  const deps = dependencies();
  const socialPostId = input.socialPostId.trim();
  const publicationTargetId = input.publicationTargetId.trim();
  const pageId = input.pageId.trim();
  const authorizationId = input.authorizationId.trim();
  const scheduledAt = Date.parse(input.scheduledFor);
  const now = deps.now();

  if (!socialPostId || !publicationTargetId || !pageId || !authorizationId) {
    return { ok: false, code: "schedule_scope_required", message: "Post, target, Page, and authorization are required." };
  }
  if (!Number.isFinite(scheduledAt) || scheduledAt <= now.getTime()) {
    return { ok: false, code: "scheduled_for_not_future", message: "Choose a valid future publication time." };
  }

  const snapshot = await deps.loadAuthorizationSnapshot();
  const authorization =
    snapshot.authorizations.find((item) => item.authorizationId === authorizationId) ?? null;
  if (!authorization) {
    return { ok: false, code: "authorization_not_found", message: "Execution authorization was not found." };
  }
  const cancellation =
    snapshot.cancellations.find((item) => item.authorizationId === authorizationId) ?? null;
  const derived = deriveExecutionAuthorizationState({ authorization, cancellation, now });
  if (derived !== "valid") {
    return { ok: false, code: `authorization_${derived}`, message: `Execution authorization is ${derived}.` };
  }
  if (
    authorization.publicationTargetId !== publicationTargetId ||
    authorization.scope.publicationTargetId !== publicationTargetId ||
    authorization.scope.socialPostId !== socialPostId
  ) {
    return { ok: false, code: "authorization_scope_mismatch", message: "Execution authorization does not match this post and target." };
  }
  if (scheduledAt >= Date.parse(authorization.expiresAt)) {
    return { ok: false, code: "authorization_expires_before_schedule", message: "Re-authorize this post for its scheduled publication time." };
  }

  const approval = await deps.verifyOwnerApproval({
    ownerApprovalId: authorization.ownerApprovalId,
    executionIntentId: authorization.executionIntentId,
    publicationTargetId,
    socialPostId,
    approvalId: authorization.scope.approvalId,
  });
  if (!approval.ok) return approval;

  const boundPage = await deps.resolveBoundPage(publicationTargetId);
  if (!boundPage.ok) return boundPage;
  if (boundPage.pageId !== pageId) {
    return { ok: false, code: "meta_page_binding_mismatch", message: "The selected Page no longer matches the bound publication target." };
  }

  const post = await deps.loadSocialPost(socialPostId);
  if (!post) return { ok: false, code: "social_post_not_found", message: "Social post was not found." };
  const message = (post.caption?.trim() || post.title?.trim() || "").trim();
  if (!message) return { ok: false, code: "publish_content_empty", message: "The reviewed post has no text to publish." };
  const compliance = await deps.evaluateCompliance({ post, message });
  if (!compliance.allowedToProceed || compliance.decision !== "allow") {
    return { ok: false, code: "compliance_not_allowed", message: compliance.summary || "Compliance denied scheduling." };
  }

  try {
    const schedule = await deps.store.create({
      socialPostId,
      publicationTargetId,
      pageId,
      authorizationId,
      scheduledFor: new Date(scheduledAt).toISOString(),
      createdByActor: input.adminActorId,
    });
    return { ok: true, schedule };
  } catch (error) {
    return {
      ok: false,
      code: "schedule_store_failed",
      message: error instanceof Error ? error.message : "Scheduled publication could not be stored.",
    };
  }
}

export async function runDueMetaOrganicPublications(input: {
  limit?: number;
} = {}): Promise<{
  claimed: number;
  published: number;
  failed: number;
  recoveryRequired: number;
  results: readonly Readonly<{ scheduleId: string; state: MetaScheduledPublicationState; code: string }>[];
}> {
  const deps = dependencies();
  const jobs = await deps.store.claimDue(Math.max(1, Math.min(input.limit ?? 10, 50)));
  let published = 0;
  let failed = 0;
  let recoveryRequired = 0;
  const results: { scheduleId: string; state: MetaScheduledPublicationState; code: string }[] = [];

  for (const job of jobs) {
    const result = await deps.publish({
      socialPostId: job.socialPostId,
      publicationTargetId: job.publicationTargetId,
      pageId: job.pageId,
      authorizationId: job.authorizationId,
      adminActorId: `scheduler:${job.scheduleId}`,
    });
    if (result.ok) {
      await deps.store.complete({
        scheduleId: job.scheduleId,
        state: "published",
        externalPostId: result.result.externalPostId,
        resultCode: result.replay ? "published_replay" : "published",
        resultMessage: result.warning ?? "Published to Meta.",
      });
      published += 1;
      results.push({ scheduleId: job.scheduleId, state: "published", code: result.replay ? "published_replay" : "published" });
      continue;
    }

    const uncertain = result.code === "publish_completion_uncertain";
    const state = uncertain ? "recovery_required" : "failed";
    await deps.store.complete({
      scheduleId: job.scheduleId,
      state,
      externalPostId: result.externalPostId ?? null,
      resultCode: result.code,
      resultMessage: result.message,
    });
    if (uncertain) recoveryRequired += 1;
    else failed += 1;
    results.push({ scheduleId: job.scheduleId, state, code: result.code });
  }

  return { claimed: jobs.length, published, failed, recoveryRequired, results };
}

function defaultEvaluateCompliance(input: { post: SocialPost; message: string }): ComplianceGateResult {
  return evaluateAgentComplianceGate({
    title: input.post.title?.trim() || "Social post",
    caption: input.message,
    generationPrompt: input.post.prompt?.trim() || input.message,
    campaignId: input.post.campaign_id,
    platforms: input.post.platforms,
    mediaType: input.post.media_type,
    posts: [input.post],
    candidateId: `schedule:${input.post.id}`,
  });
}

function createSupabaseScheduledPublicationStore(): ScheduledPublicationStore {
  return {
    async create(input) {
      const client = createServiceRoleClient();
      const { data, error } = await client.rpc("create_social_meta_scheduled_publication", {
        p_social_post_id: input.socialPostId,
        p_publication_target_id: input.publicationTargetId,
        p_page_id: input.pageId,
        p_authorization_id: input.authorizationId,
        p_scheduled_for: input.scheduledFor,
        p_created_by_actor: input.createdByActor,
      });
      if (error) throw new Error(error.message);
      const row = (data as ScheduledPublicationRow[] | null)?.[0];
      if (!row) throw new Error("Scheduled publication store returned no record.");
      return mapRow(row);
    },
    async claimDue(limit) {
      const client = createServiceRoleClient();
      const { data, error } = await client.rpc("claim_due_social_meta_scheduled_publications", {
        p_limit: limit,
      });
      if (error) throw new Error(error.message);
      return ((data ?? []) as ScheduledPublicationRow[]).map(mapRow);
    },
    async complete(input) {
      const client = createServiceRoleClient();
      const { error } = await client.rpc("finish_social_meta_scheduled_publication", {
        p_schedule_id: input.scheduleId,
        p_state: input.state,
        p_external_post_id: input.externalPostId ?? "",
        p_result_code: input.resultCode,
        p_result_message: input.resultMessage,
      });
      if (error) throw new Error(error.message);
    },
  };
}

function mapRow(row: ScheduledPublicationRow): MetaScheduledPublication {
  return {
    scheduleId: row.schedule_id,
    socialPostId: row.social_post_id,
    publicationTargetId: row.publication_target_id,
    pageId: row.page_id,
    authorizationId: row.authorization_id,
    scheduledFor: row.scheduled_for,
    state: row.state,
    attemptCount: row.attempt_count,
    externalPostId: row.external_post_id,
    resultCode: row.result_code,
    resultMessage: row.result_message,
    createdByActor: row.created_by_actor,
  };
}
