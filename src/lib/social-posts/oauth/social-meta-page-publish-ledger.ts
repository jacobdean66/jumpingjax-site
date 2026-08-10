import { randomUUID } from "node:crypto";

import {
  createServiceRoleClient,
  isSupabaseServiceConfigured,
} from "../../supabase/admin";
import type { MetaOrganicPublishResultMetadata } from "./social-meta-page-publish-service";

const DEFAULT_LEASE_MS = 120_000;
const FINGERPRINT_LENGTH = 64;

export type MetaOrganicPublishDurableStatus =
  | { kind: "none" }
  | { kind: "in_progress"; message: string }
  | {
      kind: "recorded";
      result: MetaOrganicPublishResultMetadata;
    }
  | {
      kind: "uncertain";
      externalPostId: string | null;
      message: string;
    }
  | { kind: "consumed_failed"; message: string }
  | { kind: "unavailable" };

export type MetaOrganicPublishLedgerClaim =
  | {
      ok: true;
      kind: "proceed";
      claimId: string;
      authorizationId: string;
    }
  | {
      ok: true;
      kind: "replay";
      result: MetaOrganicPublishResultMetadata;
    }
  | {
      ok: true;
      kind: "in_progress";
      message: string;
    }
  | {
      ok: true;
      kind: "awaiting_reconciliation";
      claimId: string;
      authorizationId: string;
      externalPostId: string | null;
      message: string;
    }
  | { ok: false; code: string; message: string };

export type MetaOrganicPublishLedger = Readonly<{
  isAvailable(): Promise<boolean>;
  claim(input: {
    authorizationId: string;
    socialPostId: string;
    publicationTargetId: string;
    pageId: string;
    fingerprint: string;
    ownerApprovalId: string;
    adminActorId: string;
    leaseMs?: number;
  }): Promise<MetaOrganicPublishLedgerClaim>;
  markMetaInvoked(input: {
    authorizationId: string;
    claimId: string;
  }): Promise<{ ok: true } | { ok: false; code: string; message: string }>;
  complete(input: {
    authorizationId: string;
    claimId: string;
    result: MetaOrganicPublishResultMetadata;
  }): Promise<{ ok: true } | { ok: false; code: string; message: string }>;
  fail(input: {
    authorizationId: string;
    claimId: string;
    errorCode: string;
    message: string;
  }): Promise<
    | { ok: true }
    | {
        ok: false;
        code: string;
        message: string;
        awaitingReconciliation?: boolean;
      }
  >;
}>;

type MemoryClaim = {
  authorizationId: string;
  claimId: string;
  socialPostId: string;
  publicationTargetId: string;
  pageId: string;
  ownerApprovalId: string;
  adminActorId: string;
  fingerprint: string;
  state: "in_progress" | "completed" | "failed";
  leaseExpiresAtMs: number;
  metaInvokedAtMs: number | null;
  externalPublicationId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  result: MetaOrganicPublishResultMetadata | null;
};

/**
 * Test-only shared memory store that mirrors RPC semantics.
 * Production correctness depends on Postgres RPCs, not this Map.
 */
const sharedMemoryClaims = new Map<string, MemoryClaim>();

export function resetMetaOrganicPublishLedgerMemoryForTests(): void {
  sharedMemoryClaims.clear();
}

function requireFingerprint(fingerprint: string): string | null {
  const trimmed = fingerprint.trim();
  if (trimmed.length !== FINGERPRINT_LENGTH) return null;
  return trimmed;
}

function resultFromCompleted(row: MemoryClaim): MetaOrganicPublishResultMetadata {
  if (!row.result || !row.externalPublicationId) {
    throw new Error("completed claim missing sanitized result");
  }
  return row.result;
}

function classifyMemoryClaim(
  row: MemoryClaim,
  fingerprint: string,
  nowMs: number,
): MetaOrganicPublishLedgerClaim {
  if (row.state === "completed") {
    if (row.fingerprint !== fingerprint) {
      return {
        ok: false,
        code: "fingerprint_conflict",
        message: "Completed Meta publish claim fingerprint mismatch.",
      };
    }
    return { ok: true, kind: "replay", result: resultFromCompleted(row) };
  }
  if (row.state === "failed") {
    return {
      ok: false,
      code: "authorization_consumed",
      message:
        "This execution authorization already recorded a Meta publish attempt and cannot create another post.",
    };
  }
  if (row.fingerprint !== fingerprint) {
    return {
      ok: false,
      code: "fingerprint_conflict",
      message:
        "Publish content no longer matches the durable authorization claim. Re-authorize before publishing.",
    };
  }
  if (row.metaInvokedAtMs != null) {
    return {
      ok: true,
      kind: "awaiting_reconciliation",
      claimId: row.claimId,
      authorizationId: row.authorizationId,
      externalPostId: row.externalPublicationId,
      message:
        "Meta may already have been invoked for this authorization. Manual reconciliation required — no second Meta mutation will be attempted.",
    };
  }
  if (row.leaseExpiresAtMs > nowMs) {
    return {
      ok: true,
      kind: "in_progress",
      message: "A Meta publish attempt is already in progress for this authorization.",
    };
  }
  return {
    ok: true,
    kind: "proceed",
    claimId: row.claimId,
    authorizationId: row.authorizationId,
  };
}

export function createMemoryMetaOrganicPublishLedger(options?: {
  now?: () => number;
}): MetaOrganicPublishLedger {
  const now = options?.now ?? (() => Date.now());

  return {
    async isAvailable() {
      return true;
    },
    async claim(input) {
      const fingerprint = requireFingerprint(input.fingerprint);
      if (!fingerprint) {
        return {
          ok: false,
          code: "invalid_claim_input",
          message: "Invalid Meta publish claim input.",
        };
      }
      const authorizationId = input.authorizationId.trim();
      const leaseMs = Math.max(input.leaseMs ?? DEFAULT_LEASE_MS, 1000);
      const nowMs = now();
      const existing = sharedMemoryClaims.get(authorizationId);
      if (existing) {
        const classified = classifyMemoryClaim(existing, fingerprint, nowMs);
        if (
          classified.ok &&
          classified.kind === "proceed" &&
          existing.state === "in_progress" &&
          existing.metaInvokedAtMs == null &&
          existing.leaseExpiresAtMs <= nowMs
        ) {
          const claimId = randomUUID();
          sharedMemoryClaims.set(authorizationId, {
            ...existing,
            claimId,
            socialPostId: input.socialPostId.trim(),
            publicationTargetId: input.publicationTargetId.trim(),
            pageId: input.pageId.trim(),
            ownerApprovalId: input.ownerApprovalId.trim(),
            adminActorId: input.adminActorId.trim(),
            fingerprint,
            state: "in_progress",
            leaseExpiresAtMs: nowMs + leaseMs,
            metaInvokedAtMs: null,
            externalPublicationId: null,
            errorCode: null,
            errorMessage: null,
            result: null,
          });
          return {
            ok: true,
            kind: "proceed",
            claimId,
            authorizationId,
          };
        }
        return classified;
      }

      const claimId = randomUUID();
      sharedMemoryClaims.set(authorizationId, {
        authorizationId,
        claimId,
        socialPostId: input.socialPostId.trim(),
        publicationTargetId: input.publicationTargetId.trim(),
        pageId: input.pageId.trim(),
        ownerApprovalId: input.ownerApprovalId.trim(),
        adminActorId: input.adminActorId.trim(),
        fingerprint,
        state: "in_progress",
        leaseExpiresAtMs: nowMs + leaseMs,
        metaInvokedAtMs: null,
        externalPublicationId: null,
        errorCode: null,
        errorMessage: null,
        result: null,
      });
      return {
        ok: true,
        kind: "proceed",
        claimId,
        authorizationId,
      };
    },
    async markMetaInvoked(input) {
      const row = sharedMemoryClaims.get(input.authorizationId.trim());
      if (!row) {
        return {
          ok: false,
          code: "claim_not_found",
          message: "Durable Meta publish claim not found.",
        };
      }
      if (row.claimId !== input.claimId) {
        return {
          ok: false,
          code: "claim_id_mismatch",
          message: "Durable Meta publish claim id mismatch.",
        };
      }
      if (row.state !== "in_progress") {
        return {
          ok: false,
          code: "claim_not_in_progress",
          message: "Durable Meta publish claim is not in progress.",
        };
      }
      if (row.metaInvokedAtMs != null) {
        return {
          ok: false,
          code: "meta_already_invoked",
          message: "Meta has already been marked invoked for this claim.",
        };
      }
      row.metaInvokedAtMs = now();
      return { ok: true };
    },
    async complete(input) {
      const row = sharedMemoryClaims.get(input.authorizationId.trim());
      if (!row) {
        return {
          ok: false,
          code: "claim_not_found",
          message: "Durable Meta publish claim not found at completion.",
        };
      }
      if (row.claimId !== input.claimId) {
        return {
          ok: false,
          code: "claim_id_mismatch",
          message: "Durable Meta publish claim id mismatch at completion.",
        };
      }
      const external = input.result.externalPostId.trim();
      if (!external) {
        return {
          ok: false,
          code: "external_publication_id_required",
          message: "Sanitized external publication id is required to complete.",
        };
      }
      if (row.state === "completed") {
        if (row.externalPublicationId === external) return { ok: true };
        return {
          ok: false,
          code: "external_publication_id_conflict",
          message:
            "Completed claim already stores a different external publication id.",
        };
      }
      if (row.state !== "in_progress") {
        return {
          ok: false,
          code: "claim_not_completable",
          message:
            "Durable Meta publish claim cannot be completed from current state.",
        };
      }
      row.state = "completed";
      row.externalPublicationId = external;
      row.result = { ...input.result, externalPostId: external };
      row.errorCode = null;
      row.errorMessage = null;
      return { ok: true };
    },
    async fail(input) {
      const row = sharedMemoryClaims.get(input.authorizationId.trim());
      if (!row) {
        return {
          ok: false,
          code: "claim_not_found",
          message: "Durable Meta publish claim not found at failure.",
        };
      }
      if (row.claimId !== input.claimId) {
        return {
          ok: false,
          code: "claim_id_mismatch",
          message: "Durable Meta publish claim id mismatch at failure.",
        };
      }
      if (row.state === "completed") {
        return {
          ok: false,
          code: "already_completed",
          message: "Completed Meta publish claim cannot be failed.",
        };
      }
      if (row.state === "failed") return { ok: true };
      if (row.metaInvokedAtMs != null) {
        return {
          ok: false,
          code: "meta_already_invoked",
          message:
            "Meta may already have been invoked. Failure cannot reopen this authorization for another Meta mutation.",
          awaitingReconciliation: true,
        };
      }
      row.state = "failed";
      row.errorCode = input.errorCode;
      row.errorMessage = input.message.slice(0, 500);
      return { ok: true };
    },
  };
}

function parseRpcPayload(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  return data as Record<string, unknown>;
}

function replayFromRpc(payload: Record<string, unknown>): MetaOrganicPublishLedgerClaim {
  const external = String(payload.external_publication_id ?? "").trim();
  const authorizationId = String(payload.authorization_id ?? "").trim();
  const socialPostId = String(payload.social_post_id ?? "").trim();
  const publicationTargetId = String(payload.publication_target_id ?? "").trim();
  const pageId = String(payload.page_id ?? "").trim();
  const fingerprint = String(payload.fingerprint ?? "").trim();
  if (
    !external ||
    !authorizationId ||
    !socialPostId ||
    !publicationTargetId ||
    !pageId ||
    !fingerprint
  ) {
    return {
      ok: false,
      code: "durable_publish_ledger_unavailable",
      message: "Durable completed claim replay payload was incomplete.",
    };
  }
  return {
    ok: true,
    kind: "replay",
    result: {
      externalPostId: external,
      status: "published",
      socialPostId,
      publicationTargetId,
      pageId,
      authorizationId,
      fingerprint,
    },
  };
}

export function createDurableMetaOrganicPublishLedger(): MetaOrganicPublishLedger {
  return {
    async isAvailable() {
      return isSupabaseServiceConfigured();
    },
    async claim(input) {
      if (!isSupabaseServiceConfigured()) {
        return {
          ok: false,
          code: "durable_publish_ledger_unavailable",
          message: "Durable Meta publish claim store is unavailable.",
        };
      }
      try {
        const supabase = createServiceRoleClient();
        const { data, error } = await supabase.rpc(
          "social_meta_organic_publish_claim_begin",
          {
            p_authorization_id: input.authorizationId,
            p_social_post_id: input.socialPostId,
            p_publication_target_id: input.publicationTargetId,
            p_page_id: input.pageId,
            p_owner_approval_id: input.ownerApprovalId,
            p_admin_actor_id: input.adminActorId,
            p_fingerprint: input.fingerprint,
            p_lease_ms: input.leaseMs ?? DEFAULT_LEASE_MS,
          },
        );
        if (error) {
          return {
            ok: false,
            code: "durable_publish_ledger_unavailable",
            message: error.message || "Durable claim begin failed.",
          };
        }
        const payload = parseRpcPayload(data);
        const kind = String(payload.kind ?? "");
        if (payload.ok === false || kind === "error") {
          return {
            ok: false,
            code: String(payload.code ?? "claim_denied"),
            message: String(payload.message ?? "Meta publish claim denied."),
          };
        }
        if (kind === "proceed") {
          return {
            ok: true,
            kind: "proceed",
            claimId: String(payload.claim_id),
            authorizationId: input.authorizationId.trim(),
          };
        }
        if (kind === "replay") {
          return replayFromRpc(payload);
        }
        if (kind === "awaiting_reconciliation") {
          return {
            ok: true,
            kind: "awaiting_reconciliation",
            claimId: String(payload.claim_id ?? ""),
            authorizationId: input.authorizationId.trim(),
            externalPostId: payload.external_publication_id
              ? String(payload.external_publication_id)
              : null,
            message: String(
              payload.message ??
                "Meta may already have been invoked for this authorization.",
            ),
          };
        }
        return {
          ok: true,
          kind: "in_progress",
          message: String(
            payload.message ??
              "A Meta publish attempt is already in progress for this authorization.",
          ),
        };
      } catch (cause) {
        return {
          ok: false,
          code: "durable_publish_ledger_unavailable",
          message:
            cause instanceof Error
              ? cause.message
              : "Durable Meta publish claim store unavailable.",
        };
      }
    },
    async markMetaInvoked(input) {
      if (!isSupabaseServiceConfigured()) {
        return {
          ok: false,
          code: "durable_publish_ledger_unavailable",
          message: "Durable Meta publish claim store is unavailable.",
        };
      }
      try {
        const supabase = createServiceRoleClient();
        const { data, error } = await supabase.rpc(
          "social_meta_organic_publish_mark_meta_invoked",
          {
            p_authorization_id: input.authorizationId,
            p_claim_id: input.claimId,
          },
        );
        if (error) {
          return {
            ok: false,
            code: "durable_publish_ledger_unavailable",
            message: error.message || "mark_meta_invoked failed.",
          };
        }
        const payload = parseRpcPayload(data);
        if (payload.ok === true) return { ok: true };
        return {
          ok: false,
          code: String(payload.code ?? "mark_meta_invoked_failed"),
          message: String(
            payload.message ?? "Unable to mark Meta invoked; fail closed.",
          ),
        };
      } catch (cause) {
        return {
          ok: false,
          code: "durable_publish_ledger_unavailable",
          message:
            cause instanceof Error
              ? cause.message
              : "Durable mark_meta_invoked unavailable.",
        };
      }
    },
    async complete(input) {
      if (!isSupabaseServiceConfigured()) {
        return {
          ok: false,
          code: "durable_publish_ledger_unavailable",
          message: "Durable Meta publish claim store is unavailable at completion.",
        };
      }
      try {
        const supabase = createServiceRoleClient();
        const resultSummary = {
          externalPublicationId: input.result.externalPostId,
          status: input.result.status,
          socialPostId: input.result.socialPostId,
          publicationTargetId: input.result.publicationTargetId,
          pageId: input.result.pageId,
          authorizationId: input.result.authorizationId,
          fingerprint: input.result.fingerprint,
          containsSecrets: false,
        };
        const { data, error } = await supabase.rpc(
          "social_meta_organic_publish_complete",
          {
            p_authorization_id: input.authorizationId,
            p_claim_id: input.claimId,
            p_external_publication_id: input.result.externalPostId,
            p_result_summary: resultSummary,
          },
        );
        if (error) {
          return {
            ok: false,
            code: "durable_publish_ledger_unavailable",
            message: error.message || "Durable complete failed.",
          };
        }
        const payload = parseRpcPayload(data);
        if (payload.ok === true) return { ok: true };
        return {
          ok: false,
          code: String(payload.code ?? "complete_failed"),
          message: String(payload.message ?? "Unable to complete Meta publish claim."),
        };
      } catch (cause) {
        return {
          ok: false,
          code: "durable_publish_ledger_unavailable",
          message:
            cause instanceof Error
              ? cause.message
              : "Durable complete unavailable.",
        };
      }
    },
    async fail(input) {
      if (!isSupabaseServiceConfigured()) {
        return {
          ok: false,
          code: "durable_publish_ledger_unavailable",
          message: "Durable Meta publish claim store is unavailable at failure.",
        };
      }
      try {
        const supabase = createServiceRoleClient();
        const { data, error } = await supabase.rpc(
          "social_meta_organic_publish_fail",
          {
            p_authorization_id: input.authorizationId,
            p_claim_id: input.claimId,
            p_error_code: input.errorCode,
            p_error_message: input.message,
          },
        );
        if (error) {
          return {
            ok: false,
            code: "durable_publish_ledger_unavailable",
            message: error.message || "Durable fail failed.",
          };
        }
        const payload = parseRpcPayload(data);
        if (payload.ok === true) return { ok: true };
        return {
          ok: false,
          code: String(payload.code ?? "fail_denied"),
          message: String(payload.message ?? "Unable to fail Meta publish claim."),
          awaitingReconciliation:
            payload.kind === "awaiting_reconciliation" ||
            payload.code === "meta_already_invoked",
        };
      } catch (cause) {
        return {
          ok: false,
          code: "durable_publish_ledger_unavailable",
          message:
            cause instanceof Error ? cause.message : "Durable fail unavailable.",
        };
      }
    },
  };
}

export async function resolveMetaOrganicPublishDurableStatus(
  authorizationId: string,
): Promise<MetaOrganicPublishDurableStatus> {
  const trimmed = authorizationId.trim();
  if (!trimmed) return { kind: "none" };

  if (!isSupabaseServiceConfigured()) {
    return { kind: "unavailable" };
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc(
      "social_meta_organic_publish_claim_get",
      { p_authorization_id: trimmed },
    );
    if (error) return { kind: "unavailable" };
    const payload = parseRpcPayload(data);
    const kind = String(payload.kind ?? "none");
    if (kind === "none") return { kind: "none" };

    const state = String(payload.state ?? "");
    if (state === "completed") {
      const external = String(payload.external_publication_id ?? "").trim();
      if (!external) {
        return {
          kind: "uncertain",
          externalPostId: null,
          message:
            "Completed claim missing sanitized external publication id. Manual review required.",
        };
      }
      return {
        kind: "recorded",
        result: {
          externalPostId: external,
          status: "published",
          socialPostId: String(payload.social_post_id ?? ""),
          publicationTargetId: String(payload.publication_target_id ?? ""),
          pageId: String(payload.page_id ?? ""),
          authorizationId: trimmed,
          fingerprint: String(payload.fingerprint ?? ""),
        },
      };
    }
    if (state === "failed") {
      return {
        kind: "consumed_failed",
        message: String(
          payload.error_message ??
            "This execution authorization already failed before Meta and cannot publish.",
        ),
      };
    }
    if (state === "in_progress") {
      if (payload.meta_invoked_at) {
        return {
          kind: "uncertain",
          externalPostId: payload.external_publication_id
            ? String(payload.external_publication_id)
            : null,
          message:
            "Meta may already have been invoked. Durable completion/reconciliation required — do not retry with a new authorization.",
        };
      }
      return {
        kind: "in_progress",
        message: "A Meta publish attempt is already in progress for this authorization.",
      };
    }
    return { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

export function resolveMetaOrganicPublishDurableStatusFromMemory(
  authorizationId: string,
): MetaOrganicPublishDurableStatus {
  const row = sharedMemoryClaims.get(authorizationId.trim());
  if (!row) return { kind: "none" };
  if (row.state === "completed" && row.result) {
    return { kind: "recorded", result: row.result };
  }
  if (row.state === "failed") {
    return {
      kind: "consumed_failed",
      message: row.errorMessage || "failed",
    };
  }
  if (row.metaInvokedAtMs != null) {
    return {
      kind: "uncertain",
      externalPostId: row.externalPublicationId,
      message:
        "Meta may already have been invoked. Durable completion/reconciliation required.",
    };
  }
  return {
    kind: "in_progress",
    message: "A Meta publish attempt is already in progress for this authorization.",
  };
}
