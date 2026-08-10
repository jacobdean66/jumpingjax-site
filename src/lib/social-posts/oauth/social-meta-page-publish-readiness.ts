import { isSupabaseServiceConfigured } from "../../supabase/admin";
import {
  deriveExecutionAuthorizationState,
  type SocialExecutionAuthorizationRecord,
} from "../execution-authorization/social-execution-authorization-domain";
import type { SocialExecutionAuthorizationPersistenceSnapshot } from "../execution-authorization/social-execution-authorization-store";
import { verifyOwnerApprovalForExecutionAuthorization } from "../execution-authorization/social-execution-authorization-owner-approval";
import { evaluateAgentComplianceGate } from "../agents/agent-compliance-gate";
import { getSocialPostById } from "../social-post-data";
import {
  isSocialOAuthConnectConfigured,
  resolveSocialOAuthRuntimeConfig,
} from "./social-oauth-config";
import { resolveActiveBoundMetaPageForPublicationTarget } from "./social-meta-asset-binding-service";
import {
  countActiveMetaPageAccessVaultRecords,
  loadConnectedMetaOAuthSession,
} from "./social-oauth-token-loader";
import {
  resolveMetaOrganicPublishDurableStatus,
  type MetaOrganicPublishDurableStatus,
} from "./social-meta-page-publish-ledger";

export type MetaOrganicPublishReadinessState =
  | "meta_not_configured"
  | "meta_not_connected"
  | "page_unbound"
  | "page_token_missing"
  | "owner_approval_missing"
  | "execution_authorization_missing"
  | "compliance_not_ready"
  | "durable_ledger_unavailable"
  | "ready_to_publish"
  | "publishing"
  | "published"
  | "failed"
  | "recovery_required"
  | "readiness_unavailable";

export type MetaOrganicPublishReadiness = Readonly<{
  state: MetaOrganicPublishReadinessState;
  label: string;
  canPublish: boolean;
  pageId: string | null;
  vaultedPageTokenCount: number;
  notes: readonly string[];
  durableStatus: MetaOrganicPublishDurableStatus["kind"] | null;
}>;

export type MetaOrganicPublishVerifiedGates = Readonly<{
  verifiedOwnerApproval: boolean | null;
  verifiedValidExecutionAuthorization: boolean | null;
  complianceAllowed: boolean | null;
  durableStatus: MetaOrganicPublishDurableStatus;
}>;

export type MetaOrganicPublishReadinessDependencies = Readonly<{
  isConfigured: () => boolean;
  isLedgerConfigured: () => boolean;
  loadConnectedSession: (
    publicationTargetId: string,
  ) => Promise<{ ok: true } | { ok: false }>;
  resolveBoundPage: (
    publicationTargetId: string,
  ) => Promise<{ ok: true; pageId: string } | { ok: false }>;
  countVaultedPageTokens: (publicationTargetId: string) => Promise<number>;
}>;

let testReadinessDependencies: MetaOrganicPublishReadinessDependencies | null =
  null;

export function configureMetaOrganicPublishReadinessTestDependencies(
  dependencies: MetaOrganicPublishReadinessDependencies | null,
): void {
  testReadinessDependencies = dependencies;
}

function readinessDependencies(): MetaOrganicPublishReadinessDependencies {
  return (
    testReadinessDependencies ?? {
      isConfigured: () =>
        isSocialOAuthConnectConfigured(resolveSocialOAuthRuntimeConfig()),
      isLedgerConfigured: () => isSupabaseServiceConfigured(),
      loadConnectedSession: async (publicationTargetId) => {
        const session = await loadConnectedMetaOAuthSession(publicationTargetId);
        return session.ok ? { ok: true } : { ok: false };
      },
      resolveBoundPage: async (publicationTargetId) => {
        const bound =
          await resolveActiveBoundMetaPageForPublicationTarget(publicationTargetId);
        return bound.ok ? { ok: true, pageId: bound.pageId } : { ok: false };
      },
      countVaultedPageTokens: countActiveMetaPageAccessVaultRecords,
    }
  );
}

function failClosed(
  state: MetaOrganicPublishReadinessState,
  label: string,
  notes: string[],
  extras?: Partial<MetaOrganicPublishReadiness>,
): MetaOrganicPublishReadiness {
  return {
    state,
    label,
    canPublish: false,
    pageId: extras?.pageId ?? null,
    vaultedPageTokenCount: extras?.vaultedPageTokenCount ?? 0,
    notes,
    durableStatus: extras?.durableStatus ?? null,
  };
}

function buildMessageFromPost(post: {
  caption?: string | null;
  title?: string | null;
}): string {
  return (post.caption?.trim() || post.title?.trim() || "").trim();
}

/**
 * Server-side readiness for the owner-only Publish to Facebook control.
 * Never returns tokens. Local draft Approve is not treated as publish-ready.
 * Fail-closed: ambiguous/null gates never yield ready_to_publish.
 * Published requires durable recorded result — never query-param alone.
 */
export async function evaluateMetaOrganicPublishReadiness(input: {
  publicationTargetId: string | null | undefined;
  verifiedOwnerApproval: boolean | null;
  verifiedValidExecutionAuthorization: boolean | null;
  complianceAllowed: boolean | null;
  durableStatus: MetaOrganicPublishDurableStatus | null;
  publishStatusHint?: "idle" | "publishing" | "failed" | null;
}): Promise<MetaOrganicPublishReadiness> {
  const notes: string[] = [
    "Local draft Approve is not Facebook publish authorization.",
    "Owner approval is not execution authorization.",
  ];
  const durableKind = input.durableStatus?.kind ?? null;
  const deps = readinessDependencies();

  if (!deps.isConfigured()) {
    return failClosed("meta_not_configured", "Meta not configured", notes, {
      durableStatus: durableKind,
    });
  }

  if (!deps.isLedgerConfigured()) {
    notes.push(
      "Durable Meta publish claim store unavailable — publish remains fail-closed.",
    );
    return failClosed(
      "durable_ledger_unavailable",
      "Durable publish ledger unavailable",
      notes,
      {
        durableStatus: durableKind,
      },
    );
  }

  const targetId = input.publicationTargetId?.trim() || "";
  if (!targetId) {
    return failClosed("page_unbound", "Page not discovered/bound", notes, {
      durableStatus: durableKind,
    });
  }

  const session = await deps.loadConnectedSession(targetId);
  if (!session.ok) {
    return failClosed("meta_not_connected", "Meta not connected", notes, {
      durableStatus: durableKind,
    });
  }

  const bound = await deps.resolveBoundPage(targetId);
  if (!bound.ok) {
    return failClosed("page_unbound", "Page not discovered/bound", notes, {
      durableStatus: durableKind,
    });
  }

  const vaultedPageTokenCount = await deps.countVaultedPageTokens(targetId);
  if (vaultedPageTokenCount < 1) {
    return failClosed("page_token_missing", "Page access token missing", notes, {
      pageId: bound.pageId,
      vaultedPageTokenCount,
      durableStatus: durableKind,
    });
  }

  if (input.durableStatus?.kind === "recorded") {
    notes.push(
      "Durable publication result recorded; no further Meta mutation for this authorization.",
    );
    return failClosed("published", "Published", notes, {
      pageId: bound.pageId,
      vaultedPageTokenCount,
      durableStatus: "recorded",
    });
  }
  if (input.durableStatus?.kind === "uncertain") {
    notes.push(
      input.durableStatus.message ||
        "External Meta success may have occurred; durable completion requires manual review.",
    );
    return failClosed("recovery_required", "Recovery / manual review required", notes, {
      pageId: bound.pageId,
      vaultedPageTokenCount,
      durableStatus: "uncertain",
    });
  }
  if (input.durableStatus?.kind === "in_progress") {
    return failClosed("publishing", "Publishing / attempt in progress", notes, {
      pageId: bound.pageId,
      vaultedPageTokenCount,
      durableStatus: "in_progress",
    });
  }
  if (input.durableStatus?.kind === "consumed_failed") {
    notes.push(input.durableStatus.message);
    return failClosed("failed", "Failed", notes, {
      pageId: bound.pageId,
      vaultedPageTokenCount,
      durableStatus: "consumed_failed",
    });
  }
  if (input.durableStatus?.kind === "unavailable" || input.durableStatus == null) {
    notes.push("Durable publish status unavailable — fail closed.");
    return failClosed("readiness_unavailable", "Publish readiness unavailable", notes, {
      pageId: bound.pageId,
      vaultedPageTokenCount,
      durableStatus: durableKind,
    });
  }

  if (input.verifiedOwnerApproval !== true) {
    if (input.verifiedOwnerApproval == null) {
      notes.push("Owner approval could not be verified — fail closed.");
      return failClosed("readiness_unavailable", "Owner approval unverified", notes, {
        pageId: bound.pageId,
        vaultedPageTokenCount,
        durableStatus: durableKind,
      });
    }
    return failClosed("owner_approval_missing", "Owner approval missing", notes, {
      pageId: bound.pageId,
      vaultedPageTokenCount,
      durableStatus: durableKind,
    });
  }

  if (input.verifiedValidExecutionAuthorization !== true) {
    if (input.verifiedValidExecutionAuthorization == null) {
      notes.push("Execution authorization could not be verified — fail closed.");
      return failClosed(
        "readiness_unavailable",
        "Execution authorization unverified",
        notes,
        {
          pageId: bound.pageId,
          vaultedPageTokenCount,
          durableStatus: durableKind,
        },
      );
    }
    return failClosed(
      "execution_authorization_missing",
      "Execution authorization missing",
      notes,
      {
        pageId: bound.pageId,
        vaultedPageTokenCount,
        durableStatus: durableKind,
      },
    );
  }

  if (input.complianceAllowed !== true) {
    return failClosed("compliance_not_ready", "Compliance not ready", notes, {
      pageId: bound.pageId,
      vaultedPageTokenCount,
      durableStatus: durableKind,
    });
  }

  if (input.publishStatusHint === "publishing") {
    return failClosed("publishing", "Publishing", notes, {
      pageId: bound.pageId,
      vaultedPageTokenCount,
      durableStatus: durableKind,
    });
  }
  if (input.publishStatusHint === "failed") {
    return failClosed("failed", "Failed", notes, {
      pageId: bound.pageId,
      vaultedPageTokenCount,
      durableStatus: durableKind,
    });
  }

  return {
    state: "ready_to_publish",
    label: "Ready to publish",
    canPublish: true,
    pageId: bound.pageId,
    vaultedPageTokenCount,
    notes,
    durableStatus: durableKind,
  };
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

/**
 * Resolve server-verified gates for Publication Execution UI.
 * Does not trust filter-string presence alone.
 */
export async function resolveVerifiedMetaOrganicPublishGates(input: {
  publicationTargetId: string | null | undefined;
  socialPostId: string | null | undefined;
  authorizationId: string | null | undefined;
  authorizationSnapshot: SocialExecutionAuthorizationPersistenceSnapshot;
  now?: Date;
  resolveDurableStatus?: (
    authorizationId: string,
  ) => Promise<MetaOrganicPublishDurableStatus>;
}): Promise<MetaOrganicPublishVerifiedGates> {
  const resolveDurable =
    input.resolveDurableStatus ?? resolveMetaOrganicPublishDurableStatus;

  const publicationTargetId = input.publicationTargetId?.trim() || "";
  const socialPostId = input.socialPostId?.trim() || "";
  const authorizationId = input.authorizationId?.trim() || "";

  if (!authorizationId) {
    return {
      verifiedOwnerApproval: false,
      verifiedValidExecutionAuthorization: false,
      complianceAllowed: socialPostId ? null : false,
      durableStatus: { kind: "none" },
    };
  }

  let durableStatus: MetaOrganicPublishDurableStatus;
  try {
    durableStatus = await resolveDurable(authorizationId);
  } catch {
    durableStatus = { kind: "unavailable" };
  }

  const authorization =
    input.authorizationSnapshot.authorizations.find(
      (record) => record.authorizationId === authorizationId,
    ) ?? null;

  if (!authorization || !publicationTargetId || !socialPostId) {
    return {
      verifiedOwnerApproval: authorization ? null : false,
      verifiedValidExecutionAuthorization: false,
      complianceAllowed: socialPostId ? null : false,
      durableStatus,
    };
  }

  const cancellation =
    input.authorizationSnapshot.cancellations.find(
      (record) => record.authorizationId === authorization.authorizationId,
    ) ?? null;
  const derived = deriveExecutionAuthorizationState({
    authorization,
    cancellation,
    now: input.now ?? new Date(),
  });
  const scopeOk = authorizationMatchesPublishScope(
    authorization,
    socialPostId,
    publicationTargetId,
  );
  const verifiedValidExecutionAuthorization = derived === "valid" && scopeOk;

  let verifiedOwnerApproval: boolean | null = false;
  if (verifiedValidExecutionAuthorization) {
    try {
      const ownerApproval = await verifyOwnerApprovalForExecutionAuthorization({
        ownerApprovalId: authorization.ownerApprovalId,
        executionIntentId: authorization.executionIntentId,
        publicationTargetId,
        socialPostId,
        approvalId: authorization.scope.approvalId,
      });
      verifiedOwnerApproval = ownerApproval.ok;
    } catch {
      verifiedOwnerApproval = null;
    }
  }

  let complianceAllowed: boolean | null = null;
  try {
    const post = await getSocialPostById(socialPostId);
    if (!post) {
      complianceAllowed = false;
    } else {
      const message = buildMessageFromPost(post);
      if (!message) {
        complianceAllowed = false;
      } else {
        const compliance = evaluateAgentComplianceGate({
          title: post.title?.trim() || "Social post",
          caption: message,
          generationPrompt: post.prompt?.trim() || message,
          campaignId: post.campaign_id,
          platforms: post.platforms,
          mediaType: post.media_type,
          posts: [post],
          candidateId: `publish-readiness:${post.id}`,
        });
        complianceAllowed =
          compliance.allowedToProceed === true && compliance.decision === "allow";
      }
    }
  } catch {
    complianceAllowed = null;
  }

  return {
    verifiedOwnerApproval,
    verifiedValidExecutionAuthorization,
    complianceAllowed,
    durableStatus,
  };
}
